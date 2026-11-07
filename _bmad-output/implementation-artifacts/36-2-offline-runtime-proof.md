# Story 36.2 — Offline Runtime Proof: uv + Python 3.11 + PEP 723 wheelhouse under `--network none`

Status: ready-for-dev (runs in parallel with 36.1; if 36.1 AC11 records STOP, stop and wait for the re-scope)
Blocked on: none
Wave: 0 (parallel with 36.1)

**FR:** FR282 (offline runtime bundle), FR277 (uv + Python 3.11). **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap, with uv in the loop); NFR74 (skill scripts run through `uv run`; the installer's own CLI is Node). **Decisions:** P5-11.6 (offline Python runtime), P5-11.5 (target commit).

## Story

As an **on-prem operator deploying ma-agents into an air-gapped network**,
I want a tested recipe and a build script that produce a uv binary, a Python 3.11 interpreter and a wheelhouse that let every v7 skill script run with `uv run --no-cache` and no network,
so that the 4.x skills activate on my machines, and I learn the runtime prerequisites from our docs instead of from a halted skill.

## Context

Every v7 skill activates with `uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py"` (`skills/bmad-build/SKILL.md:12` at `e734d3a`). `--no-cache` uses a temporary cache, so a warm cache never satisfies a dependency offline. `render_skill.py` declares `dependencies = ["jinja2>=3.1"]` (`skills/bmad/scripts/render_skill.py:4`) and `tickets.py` declares `pyyaml>=6.0.2,<7` (`skills/bmad-agent-po/scripts/tickets.py:4`); `resolve_config.py`, `resolve_customization.py` and `setup.py` declare `requires-python = ">=3.11"` and no third-party dependencies. The offline recipe is therefore a local wheelhouse plus `UV_FIND_LINKS` / `UV_OFFLINE` and a pre-placed interpreter. Scripts install to `_bmad/scripts/` (core) and `_bmad/<code>/scripts/` (module scripts, e.g. `_bmad/method/scripts/tickets.py`, `skills/bmod-method/migration-1.toml:191`).

Repo constraints: `test/uv-transition-resilience.test.js:194` fails if any `lib/**`, `scripts/**`, `bin/**` JavaScript contains `uv run` (36.3 narrows it to execution sites outside the uv runner). The wheelhouse builder is therefore a Python script with a PEP 723 header, run as `uv run scripts/build-wheelhouse.py`; 39.1 calls it from `ma-agents bundle build`. `docs/` ships on npm (`package.json` `files`), so `docs/on-prem-runtime.md` reaches users. The on-prem README section is `README.md:364`.

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 repeats it on the GA snapshot.

1. **Dependency enumeration from the snapshot.** (Re-run at GA: yes.) `scripts/build-wheelhouse.py` (PEP 723 header, `requires-python = ">=3.11"`) takes `--snapshot <dir>` (a BMAD-METHOD checkout at the pin; 36.3's `bundle/` snapshot once it exists) and any number of `--extra-skills <dir>` (later: `ma-bmad-extensions`), parses the PEP 723 `# /// script` block of every `*.py` under `skills/**/scripts/` (tests excluded by path, reason stated), and writes `wheelhouse-manifest.json`: per script, its declared `requires-python` and `dependencies`; the resolved pin set; per wheel, file name, platform tag and sha256; the snapshot commit. Asserted against the pin: the dependency set contains `jinja2` and `pyyaml`, and every script that declares a dependency is listed.
2. **Wheels for every target platform.** (Re-run at GA: yes.) The builder resolves the union for Python 3.11 on `manylinux_2_17_x86_64` (linux-x64) and `win_amd64` (win-x64) and downloads wheels only (`--only-binary :all:`); the resolve and download commands are recorded in the manifest. A dependency with no wheel for a target fails the build naming the package and platform (`markupsafe`, pulled by `jinja2`, ships platform wheels — it is the expected first failure if a platform is missed).
3. **Runtime folder layout fixed.** (Re-run at GA: yes.) The recipe produces, in one folder: the uv binary at a pinned version; a python-build-standalone 3.11 interpreter installed with `uv python install 3.11` into a known `UV_PYTHON_INSTALL_DIR`; the wheelhouse. Recorded: folder layout, uv version, Python build, total size.
4. **Five scripts under `--network none` (THE proof).** (Re-run at GA: yes.) In a container from the `node:20.18.1-bookworm` digest pinned at `.github/workflows/offline-install.yml:68`, started with `--network none`, with only the AC3 folder and a project set up from the snapshot (via 36.1 AC2's local `npx skills add` + `setup.py`, or a copy of the resulting `_bmad/` if 36.1 records a Skills-CLI FALLBACK — which one is recorded): after a network-unreachable self-check, each of these exits 0 with `UV_OFFLINE=1`, `UV_FIND_LINKS=<wheelhouse>`, `UV_PYTHON=<interpreter>` and `UV_PYTHON_DOWNLOADS=never` (exact env recorded): (a) `uv run --no-cache _bmad/scripts/render_skill.py` for `bmad-build` and for `bmad-agent-po`; (b) `resolve_config.py --key core.output_folder`; (c) `resolve_customization.py --skill <bmad-build> --key workflow`; (d) `tickets.py --project-root … status <fixture initiative>`; (e) `setup.py --status`. Each command, exit code and first output line recorded.
5. **Controls prove the proof is not vacuous.** (Re-run at GA: yes.) With the same container: (a) `UV_FIND_LINKS` unset → (a) and (d) of AC4 fail; (b) wheelhouse absent but a warm `UV_CACHE_DIR` present → still fails (`--no-cache` ignores the cache); (c) interpreter absent → fails without attempting a download. Exact errors recorded; they become the troubleshooting table in AC8.
6. **Activation cost recorded.** (Re-run at GA: yes.) Wall time of AC4(a) cold and repeated five times (each `--no-cache` run builds a fresh environment from the wheelhouse); if the median exceeds 5 s the finding is flagged to the PO as an on-prem UX risk, not fixed here.
7. **Windows host.** (Re-run at GA: yes.) The AC4 commands are run on a Windows host with `win_amd64` wheels and `UV_OFFLINE=1` (network disabled at the adapter if possible; otherwise the record says the run used `UV_OFFLINE` only and is weaker evidence). Paths with spaces are exercised.
8. **`docs/on-prem-runtime.md`.** (Re-run at GA: yes — updated if a command changes.) Written from the run, not re-invented: prerequisites (Node ≥ 20.12, git, uv, Python 3.11 — from the bundle); runtime folder contents; the exact env vars and where to set them (shell profile, IDE agent env); the seeding commands copied from AC4; the AC5 errors as a troubleshooting table; how to regenerate the wheelhouse when `bmadRef.core` changes. `README.md:364` (`## On-Prem / Air-Gapped Deployment`) gains a one-paragraph pointer to it stating that it applies to the 4.x line.
9. **Coverage test in the chain.** (Re-run at GA: yes.) `test/wheelhouse-coverage.test.js` (pure Node, no uv needed) parses PEP 723 headers of a fixture snapshot and a fixture manifest and asserts every declared dependency has a wheel for every listed platform; it is added to the `npm test` chain. A second assertion, skipped with a printed reason only when no snapshot is on disk, runs the same check against the real `bundle/` snapshot 36.3 produces.
10. **Mutation-checked.** (Re-run at GA: no.) (m1) a fixture script declares `requests` with no wheel → AC9 red naming script and package; (m2) the builder skips scripts under `skills/bmad-agent-po/` → AC1 assertion that `pyyaml` is present goes red; (m3) AC4 run with `UV_OFFLINE` removed and the network still cut → recorded behaviour (hang or fail; a hang longer than 60 s is a finding); (m4) the manifest's sha256 for one wheel altered → the builder's verify step fails.

## Tasks / Subtasks

- [ ] T1 Scratch checkout at the pin (or reuse 36.1's) (AC1)
- [ ] T2 `scripts/build-wheelhouse.py`: enumerate, resolve, download, manifest, verify (AC1, AC2)
- [ ] T3 Runtime folder: uv, Python 3.11, wheelhouse (AC3)
- [ ] T4 Docker `--network none`: five scripts, then controls (AC4, AC5); timings (AC6)
- [ ] T5 Windows run (AC7)
- [ ] T6 `docs/on-prem-runtime.md` + README pointer (AC8)
- [ ] T7 `test/wheelhouse-coverage.test.js` + fixtures; add to chain (AC9); mutants (AC10)

## Dev Notes

- uv has no `download` subcommand. Resolve with `uv pip compile --python-version 3.11 --python-platform <p>` and download with `uv run --with pip pip download --only-binary :all: --platform <p> --python-version 3.11 -r …` (or an equivalent recorded in the manifest). The builder runs at bundle-build time with network; only the result goes offline.
- Do not commit wheels or interpreters to the repo. The runtime folder is a build artefact that 39.1 places in `bundle/`; this story commits the script, the test, fixtures and the doc.
- `UV_NO_INDEX` / `UV_INDEX_URL` alternatives (on-prem index) are recorded in the doc as an option, not built.
- `setup.py --status` fetches remote `bmod.toml` with a 10 s timeout (`skills/bmad/scripts/setup.py:1945-1958`); offline it should report `could-not-check`. Record it; 36.1 AC7 owns the conclusion.
- The uv guard (`test/uv-transition-resilience.test.js:194`) must stay green: no `.js` file added here executes or names `uv run`. `package.json` gains a script entry (e.g. `build:wheelhouse`) that calls `uv run scripts/build-wheelhouse.py` — `package.json` is not scanned by that guard; confirm.
- Windows chain: run the new test directly (`node test/wheelhouse-coverage.test.js`) as well as via `npm test` (known halt, `bug-npm-test-windows-suite-health-chain`).

## Testing

`test/wheelhouse-coverage.test.js` (in the chain, AC9, AC10). The Docker proof (AC4, AC5) is a recorded [RUN]; 36.6 turns it into a CI job.

## Out of scope

- Placing the runtime folder, the BMAD-METHOD snapshot, the Skills CLI tarball or our modules in the bundle (39.1); setting the env vars at install (39.2).
- Porting any Node code to Python.

## Verification record

Snapshot commit: … ; uv / Python versions: … ; wheelhouse manifest sha256: … ; AC4 results (a–e): … ; controls (a–c): … ; Windows: … ; timings: … ; mutants m1–m4: … ; unverified: …
