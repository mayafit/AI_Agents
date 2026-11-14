#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pip>=24"]
# ///
"""build-wheelhouse — the offline wheelhouse for the BMAD v7 skill scripts (Story 36.2, FR282, P5-11.6).

Every v7 skill activates with `uv run --no-cache <script>`. `--no-cache` builds a fresh environment
from scratch on every run, so offline the only package source is a local wheelhouse handed to uv as
`find-links`. This script builds that wheelhouse from the PEP 723 headers of the bundled scripts:

  1. Enumerate. Read the `# /// script` block of every `*.py` under `skills/**/scripts/` of the
     snapshot (`--snapshot`, a BMAD-METHOD checkout at `bmadRef.core`) and of every `--extra-skills`
     folder (our modules). Files with a `tests` path segment are excluded: they are upstream's unit
     tests, which declare `pytest` and are never run by a skill activation.
  2. Resolve. Per target platform, `uv pip compile --only-binary :all:` the union of the declared
     dependencies for CPython 3.11 on that platform.
  3. Download. Per pinned package, `pip download --no-deps --only-binary :all:` for the platform's
     tags into `<out>/wheelhouse/<platform>/`. A package with no wheel for a platform fails the
     build, naming the package and the platform.
  4. Manifest. `<out>/wheelhouse/wheelhouse-manifest.json`: the snapshot commit, every script with
     its `requires-python` and `dependencies`, the dependency union, and per platform the commands,
     the pin set and every wheel with its platform tag and SHA-256.
  5. Verify. Re-hash every wheel against the manifest and refuse stray files (`--verify` runs only
     this step, offline, with the standard library alone).

The build needs the network (PyPI or the index named by the usual `UV_INDEX_URL` / `PIP_INDEX_URL`);
only its output goes offline. Run it with `npm run build:wheelhouse -- <args>`.

Exit codes: 0 ok; 2 usage or unreadable input; 3 resolve or download failure (no wheel for a
platform); 4 verify failure; 5 a `--require`d dependency is not declared by any script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path

PYTHON_VERSION = "3.11"
MANIFEST_NAME = "wheelhouse-manifest.json"

# Target platforms: the wheel tags pip may accept, and the platform uv resolves for.
# manylinux2014 is manylinux_2_17; both spellings are passed because wheels carry either.
PLATFORMS = {
    "linux-x64": {
        "pip_platforms": ["manylinux2014_x86_64", "manylinux_2_17_x86_64"],
        "uv_python_platform": "x86_64-manylinux_2_17",
    },
    "win-x64": {
        "pip_platforms": ["win_amd64"],
        "uv_python_platform": "x86_64-pc-windows-msvc",
    },
}

HEADER_RE = re.compile(r"^# /// script\s*$(?P<body>.*?)^# ///\s*$", re.MULTILINE | re.DOTALL)
NAME_RE = re.compile(r"^\s*([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)")
EXCLUDED_SEGMENT = "tests"
EXCLUSION_REASON = (
    "upstream unit tests: they declare pytest and are never run by a skill activation, "
    "so their dependencies do not belong in the offline runtime"
)


class BuildError(Exception):
    """A failure the build reports and exits on; `code` is the process exit code."""

    def __init__(self, message: str, code: int):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------- enumerate


def normalize(name: str) -> str:
    """PEP 503 normalised project name."""
    return re.sub(r"[-_.]+", "-", name).lower()


def requirement_name(requirement: str) -> str:
    """The project name of a PEP 508 requirement string."""
    match = NAME_RE.match(requirement)
    if not match:
        raise BuildError(f"cannot read a project name from requirement {requirement!r}", 2)
    return normalize(match.group(1))


def parse_header(text: str, where: str) -> dict | None:
    """The PEP 723 `script` metadata of a file, or None when it has no block."""
    match = HEADER_RE.search(text)
    if not match:
        return None
    lines = []
    for line in match.group("body").splitlines():
        if not line.strip():
            continue
        if line == "#":
            lines.append("")
        elif line.startswith("# "):
            lines.append(line[2:])
        else:
            raise BuildError(f"{where}: PEP 723 block line does not start with '# ': {line!r}", 2)
    try:
        data = tomllib.loads("\n".join(lines))
    except tomllib.TOMLDecodeError as e:
        raise BuildError(f"{where}: PEP 723 block is not valid TOML: {e}", 2) from e
    deps = data.get("dependencies", [])
    if not isinstance(deps, list) or not all(isinstance(d, str) for d in deps):
        raise BuildError(f"{where}: `dependencies` must be a list of strings", 2)
    return {"requires_python": data.get("requires-python"), "dependencies": deps}


def script_files(skills_root: Path) -> tuple[list[Path], list[Path]]:
    """(included, excluded) `*.py` files under `skills/**/scripts/`, sorted by POSIX path."""
    included, excluded = [], []
    for path in sorted(skills_root.rglob("*.py"), key=lambda p: p.as_posix()):
        rel = path.relative_to(skills_root).parts
        if "scripts" not in rel[:-1]:
            continue
        (excluded if EXCLUDED_SEGMENT in rel[:-1] else included).append(path)
    return included, excluded


def enumerate_scripts(sources: list[tuple[str, Path]]) -> tuple[list[dict], list[str]]:
    """Every bundled script with its header, and the excluded test files, as manifest entries."""
    scripts, excluded = [], []
    for label, root in sources:
        skills_root = root / "skills"
        if not skills_root.is_dir():
            raise BuildError(f"{label}: no skills/ folder under {root}", 2)
        included, skipped = script_files(skills_root)
        excluded += [f"{label}:skills/{p.relative_to(skills_root).as_posix()}" for p in skipped]
        for path in included:
            rel = f"skills/{path.relative_to(skills_root).as_posix()}"
            header = parse_header(path.read_text(encoding="utf-8-sig"), f"{label}:{rel}")
            scripts.append({
                "source": label,
                "path": rel,
                "has_header": header is not None,
                "requires_python": header["requires_python"] if header else None,
                "dependencies": header["dependencies"] if header else [],
            })
    return scripts, excluded


def check_requires_python(scripts: list[dict]) -> None:
    """Every declared `requires-python` must admit the bundled interpreter (3.11)."""
    try:
        from pip._vendor.packaging.specifiers import SpecifierSet  # noqa: PLC0415 — only for the build
    except ImportError:
        return
    bad = [
        f"{s['source']}:{s['path']} requires-python {s['requires_python']!r}"
        for s in scripts
        if s["requires_python"] and not SpecifierSet(s["requires_python"]).contains(f"{PYTHON_VERSION}.0")
    ]
    if bad:
        raise BuildError(f"scripts that Python {PYTHON_VERSION} cannot run: " + "; ".join(bad), 2)


def snapshot_commit(snapshot: Path, override: str | None) -> str | None:
    if override:
        return override
    try:
        out = subprocess.run(
            ["git", "-C", str(snapshot), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout.strip() or None


# ---------------------------------------------------------------- resolve and download


def uv_binary(explicit: str | None) -> str:
    # `uv run` exports UV (the running uv binary); fall back to PATH.
    found = explicit or os.environ.get("UV") or shutil.which("uv")
    if not found:
        raise BuildError("uv not found: pass --uv <path> or put uv on PATH", 2)
    return found


def run(argv: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(argv, capture_output=True, text=True, check=False)


def last_lines(text: str, count: int = 6) -> str:
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    return " | ".join(lines[-count:])


def resolve(uv: str, requirements: list[str], platform: str, workdir: Path) -> tuple[list[str], list[str]]:
    """Pinned `name==version` lines for the platform, and the resolve argv (paths as placeholders)."""
    spec = PLATFORMS[platform]
    req_in = workdir / f"requirements-{platform}.in"
    req_in.write_text("".join(f"{r}\n" for r in requirements), encoding="utf-8")
    tail = [
        "--python-version", PYTHON_VERSION,
        "--python-platform", spec["uv_python_platform"],
        "--only-binary", ":all:",
        "--no-header", "--no-annotate", "--quiet",
    ]
    result = run([uv, "pip", "compile", str(req_in), *tail])
    recorded = ["uv", "pip", "compile", "<requirements.in>", *tail]
    if result.returncode != 0:
        raise BuildError(
            f"resolve failed for platform {platform} ({', '.join(spec['pip_platforms'])}, Python {PYTHON_VERSION}): "
            f"no wheel-only solution: {last_lines(result.stderr)}",
            3,
        )
    pins = sorted(
        (ln.strip() for ln in result.stdout.splitlines() if ln.strip() and not ln.lstrip().startswith("#")),
        key=lambda p: requirement_name(p),
    )
    return pins, recorded


def download(pins: list[str], platform: str, dest: Path) -> list[str]:
    """Download one wheel per pin (no dependencies: the resolve already chose them); the download argv."""
    spec = PLATFORMS[platform]
    tail = ["--no-deps", "--only-binary", ":all:"]
    for tag in spec["pip_platforms"]:
        tail += ["--platform", tag]
    tail += [
        "--python-version", PYTHON_VERSION, "--implementation", "cp",
        "--abi", "cp311", "--abi", "abi3", "--abi", "none",
        "--disable-pip-version-check", "--no-input", "--quiet",
    ]
    for pin in pins:
        result = run([sys.executable, "-m", "pip", "download", *tail, "-d", str(dest), pin])
        if result.returncode != 0:
            raise BuildError(
                f"no wheel for {pin} on platform {platform} ({', '.join(spec['pip_platforms'])}, "
                f"cp311): {last_lines(result.stderr, 3)}",
                3,
            )
    return ["python", "-m", "pip", "download", *tail, "-d", f"<wheelhouse>/{platform}", "<pin>"]


# ---------------------------------------------------------------- manifest and verify


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wheel_entry(path: Path) -> dict:
    # {name}-{version}(-{build})?-{python}-{abi}-{platform}.whl
    parts = path.name[: -len(".whl")].split("-")
    if len(parts) not in (5, 6):
        raise BuildError(f"not a wheel file name: {path.name}", 3)
    return {
        "file": path.name,
        "name": normalize(parts[0]),
        "version": parts[1],
        "python_tag": parts[-3],
        "abi_tag": parts[-2],
        "platform_tag": parts[-1],
        "sha256": sha256(path),
    }


def verify(wheelhouse: Path) -> list[str]:
    """Problems found re-checking the wheelhouse against its manifest; empty when it holds."""
    manifest_path = wheelhouse / MANIFEST_NAME
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return [f"{manifest_path}: unreadable manifest: {e}"]
    problems = []
    for platform, entry in sorted(manifest.get("platforms", {}).items()):
        folder = wheelhouse / platform
        listed = {w["file"]: w for w in entry.get("wheels", [])}
        present = {p.name for p in folder.glob("*")} if folder.is_dir() else set()
        for name in sorted(present - set(listed)):
            problems.append(f"{platform}/{name}: in the wheelhouse but not in the manifest")
        for name, wheel in sorted(listed.items()):
            path = folder / name
            if not path.is_file():
                problems.append(f"{platform}/{name}: listed in the manifest but missing")
            elif (actual := sha256(path)) != wheel["sha256"]:
                problems.append(f"{platform}/{name}: sha256 {actual} != manifest {wheel['sha256']}")
        pinned = {requirement_name(p) for p in entry.get("pins", [])}
        wheeled = {w["name"] for w in listed.values()}
        for name in sorted(pinned - wheeled):
            problems.append(f"{platform}: pin {name} has no wheel in the manifest")
    return problems


# ---------------------------------------------------------------- main


def build(args: argparse.Namespace) -> int:
    sources = [("snapshot", args.snapshot)] + [(f"extra:{p.name}", p) for p in args.extra_skills]
    scripts, excluded = enumerate_scripts(sources)
    check_requires_python(scripts)
    requirements = sorted({d for s in scripts for d in s["dependencies"]}, key=lambda r: (requirement_name(r), r))
    dependency_names = sorted({requirement_name(r) for r in requirements})

    missing = sorted({normalize(r) for r in args.require} - set(dependency_names))
    if missing:
        raise BuildError(f"required dependencies not declared by any script: {', '.join(missing)}", 5)

    manifest = {
        "schema": 1,
        "generator": "scripts/build-wheelhouse.py",
        "python_version": PYTHON_VERSION,
        "snapshot": {"commit": snapshot_commit(args.snapshot, args.snapshot_commit)},
        "extra_skills": [p.name for p in args.extra_skills],
        "scan": {
            "glob": "skills/**/scripts/**/*.py",
            "excluded_rule": f"any path segment named '{EXCLUDED_SEGMENT}'",
            "excluded_reason": EXCLUSION_REASON,
            "excluded": excluded,
        },
        "scripts": scripts,
        "requirements": requirements,
        "dependencies": dependency_names,
        "platforms": {},
    }

    if args.enumerate_only:
        listed = [f"{s['source']}:{s['path']}" for s in scripts if s["dependencies"]]
        print(json.dumps({"snapshot": manifest["snapshot"], "requirements": requirements,
                          "dependencies": dependency_names, "scripts_with_dependencies": listed}, indent=2))
        return 0

    wheelhouse = args.out / "wheelhouse"
    uv = uv_binary(args.uv)
    wheelhouse.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="wheelhouse-") as tmp:
        for platform in args.platform:
            dest = wheelhouse / platform
            if dest.exists():
                shutil.rmtree(dest)
            dest.mkdir(parents=True)
            pins, resolve_cmd = resolve(uv, requirements, platform, Path(tmp))
            download_cmd = download(pins, platform, dest)
            wheels = [wheel_entry(p) for p in sorted(dest.glob("*.whl"), key=lambda p: p.name)]
            stray = sorted(p.name for p in dest.iterdir() if p.suffix != ".whl")
            if stray:
                raise BuildError(f"{platform}: non-wheel files downloaded: {', '.join(stray)}", 3)
            manifest["platforms"][platform] = {
                "pip_platforms": PLATFORMS[platform]["pip_platforms"],
                "uv_python_platform": PLATFORMS[platform]["uv_python_platform"],
                "commands": {"resolve": resolve_cmd, "download": download_cmd},
                "pins": pins,
                "wheels": wheels,
            }
            print(f"{platform}: {len(wheels)} wheels: {', '.join(w['file'] for w in wheels)}")

    (wheelhouse / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    problems = verify(wheelhouse)
    if problems:
        raise BuildError("verify failed after build:\n  " + "\n  ".join(problems), 4)
    print(f"wrote {wheelhouse / MANIFEST_NAME} (sha256 {sha256(wheelhouse / MANIFEST_NAME)}); verify ok")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        prog="build-wheelhouse.py",
        description="Build the offline wheelhouse for the bundled skill scripts (PEP 723 headers).",
    )
    ap.add_argument("--snapshot", type=Path, help="BMAD-METHOD checkout at bmadRef.core (holds skills/)")
    ap.add_argument("--extra-skills", type=Path, action="append", default=[],
                    help="another repository with a skills/ folder (repeatable), e.g. ma-bmad-extensions")
    ap.add_argument("--platform", action="append", choices=sorted(PLATFORMS),
                    help="target platform (repeatable; default: all)")
    ap.add_argument("--out", type=Path, help="runtime folder; wheels go to <out>/wheelhouse/<platform>/")
    ap.add_argument("--snapshot-commit", help="commit to record when the snapshot is not a git checkout")
    ap.add_argument("--require", action="append", default=[],
                    help="fail (exit 5) unless some script declares this dependency (repeatable)")
    ap.add_argument("--uv", help="uv binary used to resolve (default: $UV, then PATH)")
    ap.add_argument("--enumerate-only", action="store_true",
                    help="print the enumerated dependency set and stop (no network)")
    ap.add_argument("--verify", type=Path, metavar="WHEELHOUSE",
                    help="only re-check an existing <out>/wheelhouse against its manifest (offline)")
    args = ap.parse_args(argv)
    if args.verify is None:
        if args.snapshot is None or (args.out is None and not args.enumerate_only):
            ap.error("--snapshot and --out are required (or use --verify <wheelhouse>)")
        args.platform = args.platform or sorted(PLATFORMS)
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        if args.verify is not None:
            problems = verify(args.verify)
            if problems:
                print("verify failed:\n  " + "\n  ".join(problems), file=sys.stderr)
                return 4
            print(f"verify ok: {args.verify / MANIFEST_NAME}")
            return 0
        return build(args)
    except BuildError as e:
        print(f"error: {e}", file=sys.stderr)
        return e.code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
