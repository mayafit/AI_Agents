# Story 36.2 — Offline Runtime Proof: uv + Python 3.11 + PEP 723 wheelhouse under `--network none`

Status: ready-for-dev (runs in parallel with 36.1; if 36.1 AC11 records STOP, stop and wait for the re-scope)
Blocked on: none
Wave: 0 (parallel with 36.1)

**FR:** FR282 (offline runtime bundle), FR277 (uv + Python 3.11). **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap, with uv in the loop); NFR74 as rewritten ("all ma-agents-shipped skill scripts run through `uv run`; the installer's own CLI stays Node"). **Decision inputs:** P5-11.6 (uv + Python 3.11 + wheelhouse, `--no-cache` proof), P5-11.5 (pinned SHA).

## Story

As an **on-prem operator deploying ma-agents into an air-gapped network**,
I want a tested recipe and a build script that produce a uv binary, a Python 3.11 interpreter and a wheelhouse that let every v7 skill script run with `uv run --no-cache` and no network,
so that the v7 line's skills activate on my machines, and I learn the runtime prerequisites from our docs instead of from a halted skill.

## Context

The 32.1 plan proved offline uv by pre-seeding `UV_CACHE_DIR`. That does not transfer to v7: every skill activates with `uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py"` (`skills/bmad-build/SKILL.md:12` @`e734d3a`), `--no-cache` uses a temporary cache, and `render_skill.py` declares `dependencies = ["jinja2>=3.1"]` (`skills/bmad/scripts/render_skill.py:4`) while `tickets.py` declares `pyyaml>=6.0.2,<7` (`skills/bmad-agent-po/scripts/tickets.py:4`). `resolve_config.py`, `resolve_customization.py` and `setup.py` declare `requires-python = ">=3.11"` and no third-party dependencies. The offline recipe is therefore a local wheelhouse plus `UV_FIND_LINKS` / `UV_OFFLINE` and a pre-placed interpreter, not a warm cache (adversarial review finding "The air-gap mitigation is defeated by v7's own `uv run --no-cache`"). Scripts install to `_bmad/scripts/` (core) and `_bmad/<code>/scripts/` (module scripts, e.g. `_bmad/method/scripts/tickets.py`, `skills/bmod-method/migration-1.toml:191`).

Repo constraints: `test/uv-transition-resilience.test.js:194` currently fails if any `lib/**`, `scripts/**`, `bin/**` **JavaScript** contains `uv run` (36.3 narrows it to execution sites). The wheelhouse builder must therefore not be a Node script that executes uv; it is a Python script with a PEP 723 header run as `uv run scripts/build-wheelhouse.py`. `docs/` ships on npm (`package.json` `files`), so `docs/on-prem-runtime.md` reaches users. The current on-prem README section is `README.md:364` and says nothing about uv or Python.

## Acceptance Criteria

Tags: **[v7-carries]** = re-run on the GA tag by 36.7; **[pre-release-only]** = specific to the preview pin.

1. **Dependency enumeration from the snapshot.** [v7-carries] `scripts/build-wheelhouse.py` (PEP 723 header, `requires-python = ">=3.11"`) takes `--snapshot <dir>` (a BMAD-METHOD checkout at the pin; 36.3's snapshot once it exists) and any number of `--extra-skills <dir>` (later: `ma-bmad-extensions`), parses the PEP 723 `# /// script` block of every `*.py` under `skills/**/scripts/` (tests excluded by path, reason stated), and writes `wheelhouse-manifest.json`: per script, its declared `requires-python` and `dependencies`; the resolved pin set; per wheel, file name, platform tag and sha256; the snapshot SHA. Asserted against the pin: the dependency set contains `jinja2` and `pyyaml`, and every script that declares a dependency is listed.
2. **Wheels for every target platform.** [v7-carries] The builder resolves the union for Python 3.11 on each target platform (at least `manylinux_2_17_x86_64` and `win_amd64`; macOS only if the PO names it) and downloads wheels only (`--only-binary :all:`); the resolve and download commands are recorded in the manifest. A dependency with no wheel for a target fails the build naming the package and platform (`markupsafe`, pulled by `jinja2`, ships platform wheels — it is the expected first failure if a platform is missed).
3. **Runtime bundle layout fixed.** [v7-carries] The recipe produces, in one folder: the uv binary at a pinned version; a Python 3.11 standalone interpreter installed with `uv python install 3.11` into a known `UV_PYTHON_INSTALL_DIR`; the wheelhouse. Recorded: folder layout, uv version, Python build, total size.
4. **Five scripts under `--network none` (THE proof).** [v7-carries] In a container from the `node:20.18.1-bookworm` digest pinned at `.github/workflows/offline-install.yml:44-53`, started with `--network none`, with only the AC3 bundle and a project set up from the snapshot (via 36.1 AC2's local `npx skills add` + `setup.py`, or a copy of the resulting `_bmad/` if 36.1 records a Skills-CLI FALLBACK — which one is recorded): after a network-unreachable self-check, each of these exits 0 with `UV_OFFLINE=1`, `UV_FIND_LINKS=<wheelhouse>`, `UV_PYTHON=<interpreter>` and `UV_PYTHON_DOWNLOADS=never` (exact env recorded): (a) `uv run --no-cache _bmad/scripts/render_skill.py` for `bmad-build` and for `bmad-agent-po`; (b) `resolve_config.py --key core.output_folder`; (c) `resolve_customization.py --skill <bmad-build> --key workflow`; (d) `tickets.py --project-root … status <fixture initiative>`; (e) `setup.py --status`. Each command, exit code and first output line recorded.
5. **Controls prove the proof is not vacuous.** [v7-carries] With the same container: (a) `UV_FIND_LINKS` unset → (a) and (d) of AC4 fail; (b) wheelhouse present but a warm `UV_CACHE_DIR` substituted for it → still fails (`--no-cache` ignores the cache); (c) interpreter absent → fails without attempting a download. Exact errors recorded; they become the troubleshooting table in AC8.
6. **Activation cost recorded.** [pre-release-only] Wall time of AC4(a) cold and repeated five times (each `--no-cache` run builds a fresh environment from the wheelhouse); if median > 5 s the finding is flagged to the PO as an on-prem UX risk, not fixed here.
7. **Windows host.** [v7-carries] The AC4 commands are run on a Windows host with `win_amd64` wheels and `UV_OFFLINE=1` (network disabled at the adapter if possible; otherwise the record says the run used `UV_OFFLINE` only and is weaker evidence). Paths with spaces are exercised.
8. **`docs/on-prem-runtime.md`.** [v7-carries] Written from the run, not re-invented: prerequisites (Node ≥ 20.12, git, uv, Python 3.11 — from the bundle); bundle contents; the exact env vars and where to set them (shell profile, IDE agent env); the seeding commands copied from AC4; the AC5 errors as a troubleshooting table; how to regenerate the wheelhouse on a pin bump. `README.md:364` (`## On-Prem / Air-Gapped Deployment`) gains a one-paragraph pointer to it stating that it applies to the v7 pre-release line, not 3.x.
9. **Coverage test in the chain.** [v7-carries] `test/wheelhouse-coverage.test.js` (pure Node, no uv needed) parses PEP 723 headers of a fixture snapshot and a fixture manifest and asserts every declared dependency has a wheel for every listed platform; it is added to the `npm test` chain. A second assertion, skipped with a printed reason only when no snapshot is on disk, runs the same check against the real snapshot path 36.3 produces.
10. **Mutation-checked.** (m1) a fixture script declares `requests` with no wheel → AC9 red naming script and package; (m2) the builder skips scripts under `skills/bmad-agent-po/` → AC1 assertion that `pyyaml` is present goes red; (m3) AC4 run with `UV_OFFLINE` removed and the network still cut → recorded behaviour (hang or fail; a hang longer than 60 s is a finding); (m4) the manifest's sha256 for one wheel altered → the builder's verify step fails.

## Tasks / Subtasks

- [ ] T1 Scratch checkout at the pin (or reuse 36.1's) (AC1)
- [ ] T2 `scripts/build-wheelhouse.py`: enumerate, resolve, download, manifest, verify (AC1, AC2)
- [ ] T3 Bundle folder: uv, Python 3.11, wheelhouse (AC3)
- [ ] T4 Docker `--network none`: five scripts, then controls (AC4, AC5); timings (AC6)
- [ ] T5 Windows run (AC7)
- [ ] T6 `docs/on-prem-runtime.md` + README pointer (AC8)
- [ ] T7 `test/wheelhouse-coverage.test.js` + fixtures; add to chain (AC9); mutants (AC10)

## Dev Notes

- uv has no `download` subcommand. Resolve with `uv pip compile --python-version 3.11 --python-platform <p>` and download with `uv run --with pip pip download --only-binary :all: --platform <p> --python-version 3.11 -r …` (or an equivalent recorded in the manifest). The builder runs at bundle-build time with network; only the result goes offline.
- Do not commit wheels or interpreters to the repo. The bundle is a build artefact for Epic 39.1; this story commits the script, the test, fixtures and the doc.
- `UV_NO_INDEX` / `UV_INDEX_URL` alternatives (on-prem index) are recorded in the doc as an option, not built.
- `setup.py --status` fetches remote `bmod.toml` with a 10 s timeout (`skills/bmad/scripts/setup.py:1945-1958`); offline it should report `could-not-check`. Record it; 36.1 AC7 owns the conclusion.
- The NFR74 JS guard (`test/uv-transition-resilience.test.js:194`) must stay green: no `.js` file added here executes or names `uv run`. `package.json` gains a script entry (e.g. `build:wheelhouse`) that calls `uv run scripts/build-wheelhouse.py` — package.json is not scanned by that guard; confirm.
- Windows chain: run the new test directly (`node test/wheelhouse-coverage.test.js`) as well as via `npm test` (known halt, `bug-npm-test-windows-suite-health-chain`).

## Testing

`test/wheelhouse-coverage.test.js` (in the chain, AC9, AC10). The Docker proof (AC4, AC5) is a recorded [RUN]; 36.6 turns it into a CI job.

## Out of scope

- Bundling the BMAD-METHOD snapshot, the Skills CLI tarball or our modules (39.1); env-var setting by the installer (39.2).
- The 3.x line's offline install (`.github/scripts/offline-install-verify.sh` stays as is).
- Porting any Node code to Python.

## Verification record

Snapshot SHA: … ; uv / Python versions: … ; wheelhouse manifest sha256: … ; AC4 results (a–e): … ; controls (a–c): … ; Windows: … ; timings: … ; mutants m1–m4: … ; unverified: …
