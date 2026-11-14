# On-Prem Runtime for the 4.x Line (uv + Python 3.11 + Wheelhouse)

This page applies to **ma-agents 4.x**, which installs BMAD v7 skills. It does not apply to the 3.x line.

Every BMAD v7 skill activates by running a Python script through uv:

```bash
uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py" --project-root "{project-root}" --skill "{skill-root}"
```

`--no-cache` builds a fresh, temporary environment on every run and ignores any uv cache. On a machine with no network, the scripts' third-party dependencies (declared in each script's PEP 723 header) can therefore only come from a local **wheelhouse**, and the interpreter can only come from a local **uv-managed Python**. This page describes that runtime, how skills find it, and what the errors look like when something is missing.

Everything below was recorded on 2026-11-14 against BMAD-METHOD `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (the initial `bmadRef.core`) with uv 0.13.8, in a `node:22-bookworm` container started with `--network none` and on a Windows 11 host (Story 36.2).

## Prerequisites

| Install | You need |
|---|---|
| Offline (air-gapped, from the ma-agents 4.x package) | Node.js ≥ 22.20 and npm (the bundled Skills CLI 1.7.6 declares `engines.node >=22.20.0` and fails on Node 20). Git. uv, Python 3.11 and the wheelhouse come from the bundle. |
| Online | Node.js ≥ 22.20, npm, Git, uv, Python ≥ 3.11 (uv can download a managed Python on first use). |

## Runtime folder

The installer copies the runtime for the host platform to `<project-root>/.ma-agents/runtime/` (project scope) or `~/.ma-agents/runtime/` (global scope):

```
<runtime>/
  bin/uv                      uv 0.13.8 (uv.exe, uvx.exe, uvw.exe on Windows)
  python/
    cpython-3.11.18-linux-x86_64-gnu/      python-build-standalone 20261110
    cpython-3.11-linux-x86_64-gnu          minor-version link created by uv (see Troubleshooting)
  wheelhouse/
    wheelhouse-manifest.json  scripts, dependency set, pins, wheels with SHA-256, snapshot commit
    linux-x64/  or  win-x64/  one wheel per pinned package
```

| Platform | uv | Python | Wheelhouse | Total |
|---|---|---|---|---|
| linux-x64 | `uv-x86_64-unknown-linux-gnu.tar.gz`, 37 MB | `cpython-3.11.18-linux-x86_64-gnu`, 89 MB | 10 wheels, 3.6 MB | 129 MB |
| win-x64 | `uv-x86_64-pc-windows-msvc.zip`, 32 MB | `cpython-3.11.18-windows-x86_64-none`, 77 MB | 10 wheels, 2.1 MB | 111 MB |

The interpreter is installed with uv into the runtime folder, never into the user's default location:

```bash
UV_PYTHON_INSTALL_DIR=<runtime>/python uv python install 3.11 --no-bin --no-registry
```

`--no-bin` keeps uv from adding `python3.11` to `~/.local/bin`, and `--no-registry` keeps it from registering the interpreter in the Windows registry (`HKCU\Software\Python\Astral`).

Wheelhouse at `e734d3a`: the scripts declare `jinja2>=3.1` (`render_skill.py`), `pyyaml>=6.0.2,<7` (`tickets.py`, `scan_legacy_module.py`) and `tiktoken` (`count_tokens.py`, `prepass.py` in `bmad-toolsmith`). Resolved for CPython 3.11 they give `jinja2`, `markupsafe` (platform wheels), `pyyaml` (platform wheels), `tiktoken`, `regex`, `requests`, `charset-normalizer`, `certifi`, `idna` and `urllib3`.

## How skills find the runtime

### Installed by ma-agents (project scope)

The installer writes `<project-root>/.ma-agents/uv.toml`:

```toml
python-preference = "only-managed"
python-downloads = "never"
find-links = ["<runtime>/wheelhouse/<platform>"]
offline = true
no-cache = true
```

Skill activations select that file through `UV_CONFIG_FILE`, and also need `UV_PYTHON_INSTALL_DIR`, because uv has no `uv.toml` key for the managed-Python directory: uv 0.13.8 rejects `python-install-dir` in `uv.toml` (`unknown field 'python-install-dir'`). The injected `ma-agents` instruction block tells the coding tool to set both:

```bash
UV_CONFIG_FILE=<project-root>/.ma-agents/uv.toml
UV_PYTHON_INSTALL_DIR=<project-root>/.ma-agents/runtime/python
```

With `UV_CONFIG_FILE` alone uv finds no interpreter (see Troubleshooting). For global scope, the installer writes the same keys to the uv user configuration file (`~/.config/uv/uv.toml` on Linux and macOS, `%APPDATA%\uv\uv.toml` on Windows) and the activation environment still needs `UV_PYTHON_INSTALL_DIR`.

### Manual install (environment only)

The installer exports these for its own uv calls. Set the same six variables to run skills from a shell without `uv.toml`:

```bash
# Linux
export UV_PYTHON_INSTALL_DIR="<runtime>/python"
export UV_PYTHON_PREFERENCE=only-managed
export UV_PYTHON_DOWNLOADS=never
export UV_FIND_LINKS="<runtime>/wheelhouse/linux-x64"
export UV_OFFLINE=1
export UV_NO_CACHE=1
export PATH="<runtime>/bin:$PATH"
```

```powershell
# Windows (PowerShell)
$env:UV_PYTHON_INSTALL_DIR = "<runtime>\python"
$env:UV_PYTHON_PREFERENCE = "only-managed"
$env:UV_PYTHON_DOWNLOADS = "never"
$env:UV_FIND_LINKS = "<runtime>\wheelhouse\win-x64"
$env:UV_OFFLINE = "1"
$env:UV_NO_CACHE = "1"
$env:PATH = "<runtime>\bin;$env:PATH"
```

Do not set `UV_PYTHON`. `UV_OFFLINE=1` (or `offline = true`) is required, not optional: without it uv also queries PyPI even when every wheel is in `find-links` (see Troubleshooting).

## Checking an installation

Run from the project root, with the environment or `UV_CONFIG_FILE` + `UV_PYTHON_INSTALL_DIR` set. Each command exits 0 offline:

```bash
uv run --no-cache _bmad/scripts/render_skill.py --project-root "$PWD" --skill "$PWD/.claude/skills/bmad-build"
uv run --no-cache _bmad/scripts/render_skill.py --project-root "$PWD" --skill "$PWD/.claude/skills/bmad-agent-po"
uv run --no-cache _bmad/scripts/resolve_config.py --project-root "$PWD" --key core.output_folder
uv run --no-cache _bmad/scripts/resolve_customization.py --skill "$PWD/.claude/skills/bmad-build" --project-root "$PWD" --key workflow
uv run --no-cache _bmad/method/scripts/tickets.py --project-root "$PWD" status <initiative-folder>
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root "$PWD" --skill "$PWD/.claude/skills/bmad" --root "$PWD/.claude/skills" --status
```

Expected first lines: `Installed 2 packages in …ms` then `# Build New Preview Workflow` (bmad-build) or `# Sofia — Product Owner` (bmad-agent-po); a JSON object for `resolve_config.py`, `resolve_customization.py` and `setup.py --status`; `Installed 1 package in …ms` then a JSON object with `"tickets"` for `tickets.py`. Offline, `setup.py --status` reports every module `could-not-check` (`Temporary failure in name resolution`) with `"current": true`; that is expected.

Each activation takes about 1–2.5 s (container on a Windows bind mount: median 1.9 s; Windows host: 1.0 s; container-local disk: 0.8 s), because every `--no-cache` run builds its environment from the wheelhouse.

## Troubleshooting

| Symptom (exit code) | Cause | Fix |
|---|---|---|
| `error: No solution found when resolving script dependencies` / `cause: Because jinja2 was not found in the cache and you require jinja2>=3.1, …` / `hint: Packages were unavailable because the network was disabled.` (1) | No wheelhouse: `UV_FIND_LINKS` (or `find-links`) is not set, or it points to an empty folder. A warm uv cache does not help: `--no-cache` ignores it. The same message names `pyyaml` for `tickets.py`. | Set `UV_FIND_LINKS` / `find-links` to `<runtime>/wheelhouse/<platform>`, and check that the folder holds the wheels listed in `wheelhouse-manifest.json`. |
| ``error: Failed to read `--find-links` directory: <path>`` / `cause: No such file or directory (os error 2)` (2) | `find-links` names a folder that does not exist (runtime not copied, or moved). | Copy the runtime again or correct the path. |
| `error: No interpreter found for Python >=3.11 in virtual environments or managed installations` / `hint: A managed Python download is available for Python >=3.11, but Python downloads are set to 'never'` (2) | uv cannot find the bundled interpreter: `UV_PYTHON_INSTALL_DIR` is not set in the activation environment (common with `UV_CONFIG_FILE` alone, since `uv.toml` cannot carry it), or `<runtime>/python` is empty. uv does not try to download. | Set `UV_PYTHON_INSTALL_DIR=<runtime>/python`; check that `<runtime>/python/cpython-3.11.*` exists. |
| `error: Failed to parse: …uv.toml` / `unknown field 'python-install-dir'` (2) | `python-install-dir` written to `uv.toml`. | Remove the key; use `UV_PYTHON_INSTALL_DIR`. |
| `error: Request failed after 3 retries in 8.8s` / `cause: Failed to fetch: https://pypi.org/simple/jinja2/` / `… dns error` (2, after about 9 s) | `UV_OFFLINE` / `offline = true` missing: uv also queries the index, even with every wheel in `find-links`. On a network that stalls instead of refusing, this can take longer. | Set `UV_OFFLINE=1` (or `offline = true`). |
| `bmad-toolsmith` `count_tokens.py` returns `"method": "fallback"` | `tiktoken` is installed from the wheelhouse but downloads its `cl100k_base` encoding file at first use, which fails offline; the script falls back to `len(text) // 4`. | Known limit at `e734d3a`; token counts are estimates offline. |
| `setup.py --status` shows `could-not-check` for every module | The update check fetches `bmod.toml` from GitHub with a 10 s timeout per module. | Expected offline. |

The minor-version link uv creates in `<runtime>/python` (`cpython-3.11-linux-x86_64-gnu`, a junction on Windows) points to the absolute path the runtime was built at. After the runtime is copied elsewhere the link dangles; uv still finds the versioned folder and every command above exits 0 (checked on linux-x64 with the runtime copied to a new path and the original path absent).

## Regenerating the wheelhouse

When `bmadRef.core` (or `ma-bmad-extensions`) changes, rebuild the wheelhouse from the new snapshot. This needs network access (PyPI, or the index named by `UV_INDEX_URL` / `PIP_INDEX_URL`) and uv on the build machine:

```bash
npm run build:wheelhouse -- --snapshot <BMAD-METHOD checkout at bmadRef.core> \
    [--extra-skills <ma-bmad-extensions checkout>] \
    --out <runtime> [--platform linux-x64] [--platform win-x64] \
    --require jinja2 --require pyyaml
```

`scripts/build-wheelhouse.py` reads the PEP 723 header of every `skills/**/scripts/**/*.py` (paths with a `tests` segment excluded: upstream unit tests declare `pytest` and never run in an activation), resolves the union for CPython 3.11 per platform with `uv pip compile --only-binary :all:`, downloads one wheel per pin with `pip download --no-deps --only-binary :all:`, writes `<runtime>/wheelhouse/wheelhouse-manifest.json` and verifies every wheel's SHA-256. A dependency with no wheel for a platform fails the build (exit 3) and names the package and the platform. To re-check a wheelhouse later, offline:

```bash
python scripts/build-wheelhouse.py --verify <runtime>/wheelhouse
```

Compare the manifest's `dependencies` with the previous one; a new dependency is a new wheel to ship. `test/wheelhouse-coverage.test.js` checks that every declared dependency has a wheel for every platform (point it at a snapshot and manifest with `MA_WHEELHOUSE_SNAPSHOT` and `MA_WHEELHOUSE_MANIFEST`).

Pins can differ per platform: at `e734d3a`, `tiktoken` resolves to 0.11.0 on linux-x64 (the newest release with a `manylinux_2_17` wheel) and to 0.14.0 on win-x64.

## Alternative: an on-prem package index

Instead of a wheelhouse, uv can read an internal index that mirrors the pinned packages: set `UV_INDEX_URL=<internal index>` (or `UV_DEFAULT_INDEX`) and leave `UV_OFFLINE` unset, or keep `UV_OFFLINE=1` with `UV_FIND_LINKS` and add `UV_NO_INDEX=1` to forbid any index. ma-agents does not build or test this setup.
