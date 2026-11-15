# Story 36.6 — 4.x Gate Record: release record, CI runtime proof, gate tag

Status: review
Blocked on: 36-1, 36-2, 36-3, 36-4, 36-5
Wave: 2 (closes Epic 36 for the pinned commit; its PASS opens 37.3–37.6)

**FR:** FR280 (verdict per commit), FR282 (offline runtime proved in CI), FR298 (`engines.node`), FR301 (coexistence test green), FR302 (`bmadRef` recorded), FR303 (contract validator green), FR304 (uv runner guard green). **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap with uv), NFR84 (validator and install premises recorded). **Decisions:** P5-11.5 (target commit and GA gate), P5-11.6 (offline Python runtime).

## Story

As the **ma-agents release owner**,
I want one evidence-backed record that the target commit, the offline runtime, the `customize.toml` contract and instruction-file coexistence all hold, with the test chain's health stated honestly, and a git tag `v4-gate-<short-sha>` on the qualified commit,
so that the product owner opens 37.3–37.6 on facts, and no ma-agents package reaches npm before the 4.x installer exists (39.4).

## Context

No GitHub workflow runs `npm test`; the three workflows are `.github/workflows/bundle-drift.yml`, `multi-tool-smoke.yml` and `offline-install.yml`, and none installs uv or Python. The `npm test` script chains 110 test files with `&&` (`package.json:11`; 121 files under `test/`), and on Windows it halts early on pre-existing failures tracked as `bug-npm-test-windows-suite-health-chain` (`_bmad-output/implementation-artifacts/bug-npm-test-windows-suite-health-chain.md`). The package version is `3.18.1` (`package.json:3`); `CHANGELOG.md` does not ship on npm, so known limitations are mirrored into `README.md`. `test/release-gate-epic-31.test.js` is the shape precedent for a release-gate test. The 3.x line is maintained from branch `maint/3.x`, cut at `v3.18.1` (`38ea256`).

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 re-asserts it on the GA snapshot.

1. **Release record.** (Re-run at GA: no.) `_bmad-output/implementation-artifacts/epic-runs/epic-36/36-6-release-gate.md` names the commit (`package.json` `bmadRef.core`), links `36-1-gate-findings.md` and each of 36.2–36.5's Verification records, lists every item any of them marked unverified, and ends in **PASS** (37.3–37.6 may start) or **FAIL** with the blocking item. A 36.1 STOP not resolved by the PO's re-plan is a FAIL.
2. **`npm test` chain health, recorded honestly.** (Re-run at GA: yes.) The chain is run on Windows and in the AC3 Linux job. The record lists, by file name, every failing test file and, for each, **pre-existing** (fails identically on `main` at `38ea256`, shown by running it there) or **new**. Any new failure blocks the gate. On Windows the halt position is recorded and every file after it is run individually (`node test/<file>`), so no file is reported green without having run; the result is appended to `bug-npm-test-windows-suite-health-chain` as a dated note. Known failures are listed by name, never summarised as "flaky".
3. **Linux CI job with uv — merge-blocking for new failures.** (Re-run at GA: yes.) `.github/workflows/test-linux.yml` runs on `ubuntu-latest` for pull requests and pushes to `main`: Node ≥ 22.20 (the bundled Skills CLI's floor); uv at a pinned version (`astral-sh/setup-uv` at a pinned tag); `uv python install 3.11`; `npm ci --ignore-scripts`; `ma-agents bundle build`; then every file of the chain run individually (not `&&`), with a summary. A **known-failure allowlist** (`test/known-failures-linux.json`: file name → bug key) is committed; the job fails on any failure not in the allowlist **and** on any allowlisted file that passes (stale entry). The log shows `uv --version` and the Python version before the tests; 36.4's and 36.5's tests run and pass (not skipped). A negative run on a throwaway branch with the uv step removed shows 36.4's test failing with its prerequisite message. **Merge-blocking:** the record states whether the job is a required status check on `main` (a repo-admin setting the PO applies); the gate requires it to be required before PASS. Run URLs recorded.
4. **Offline runtime in CI.** (Re-run at GA: yes.) A `--network none` job (new, or a new step in `offline-install.yml` that leaves its existing steps untouched) reproduces 36.2 AC4 (five scripts with `uv run --no-cache`) and AC5(a) (wheelhouse removed → failure), with uv, Python and the wheelhouse fetched in the pre-pull step while the runner has network. The container never downloads uv, Python or wheels. The job's `OFFLINE_NODE_IMAGE` is a Node ≥ 22.20 image pinned by digest (`node:22-bookworm` digest recorded); the bundled Skills CLI does not load on Node 20. Run URL recorded.
5. **Epic 36 invariants in one test.** (Re-run at GA: yes.) `test/release-gate-epic-36.test.js` asserts against outside authorities: `package.json` `bmadRef.core` = bundle manifest core commit = `git rev-parse HEAD` recorded by the build (36.3); `bmadRef.skillsCli` = the bundled Skills CLI's version (36.3); `engines.node` not looser than the recorded floor (36.3); the wheelhouse manifest covers every PEP 723 dependency in the snapshot (36.2); 36.4's and 36.5's test files are in the chain. It is added to the chain.
6. **Snapshot reproducible on the release commit.** (Re-run at GA: yes.) The AC3 job's `bundle build` produces a `manifest.json` byte-identical to one built locally from the same commit on Windows (FR299); both SHA-256 values are recorded.
7. **Gate tag and maintenance branch.** (Re-run at GA: no.) On PASS, the release owner creates the annotated git tag `v4-gate-<short-sha>` on the commit the release record names (`<short-sha>`: its abbreviated SHA) and pushes it; the record pastes `git show --no-patch v4-gate-<short-sha>`. This story publishes nothing to npm. Branch `maint/3.x` exists at `v3.18.1` (`38ea256`); if it is absent, the release owner creates it with PO approval and records it before tagging.
8. **CHANGELOG "Unreleased (4.x)" note.** (Re-run at GA: no.) An "Unreleased (4.x)" section states: targets BMAD v7 at `bmadRef.core` (a preview-alpha upstream commit); until 39.5, the 3.x line is the supported on-prem release (FR281), and 4.x packages from 39.4 are pre-releases on dist-tag `next`; Node ≥ 22.20; uv + Python 3.11 + wheelhouse for the v7 runtime (`docs/on-prem-runtime.md`); and Known limitations — every unverified item from AC1, the 36.5 AC9 adopt finding, the 36.1 FALLBACK items. The same Known limitations are mirrored in `README.md`; a test asserts both lists name the same items.
9. **Retro and verdict.** (Re-run at GA: no.) `bmad-retrospective` is run for Epic 36 (output under `epic-runs/epic-36/`), naming at least what 36.1 could not answer, any count re-pinned and why, and whether 37.3–37.6 may start (yes/no). The PO updates the tracker.

## Tasks / Subtasks

- [x] T1 `test-linux.yml` with uv + Python 3.11 + `bundle build`; per-file runner; allowlist; positive and negative runs (AC3) — before T2 (required status check: not set, cannot be set on the current plan — PO)
- [x] T2 Chain health on Windows + Linux; per-file disposition vs `main@38ea256`; bug-file note (AC2)
- [x] T3 Offline runtime CI job (AC4)
- [x] T4 `test/release-gate-epic-36.test.js` (AC5); manifest reproducibility (AC6)
- [ ] T5 `maint/3.x` confirmed or created with PO approval; gate tag `v4-gate-<short-sha>` (AC7) — `maint/3.x` confirmed at `38ea256`; tag `v4-gate-e734d3a` not created (verdict FAIL; release owner creates it on PASS)
- [x] T6 CHANGELOG + README Known limitations + parity test (AC8)
- [x] T7 Retro; release record (AC1, AC9)

## Dev Notes

- Seeding uv in CI: bake it in the pre-pull step while the runner has network, then start the `--network none` container from that image (`.github/workflows/offline-install.yml:68` pins the base digest as `OFFLINE_NODE_IMAGE`; the 4.x offline runtime job runs a Node ≥ 22.20 digest).
- No `npm publish` runs in this story; 39.4 publishes the first `4.0.0-next.N`.
- Branch the release PR off `main` after the Epic 36 PR merges, not off the epic branch.
- `npm test` mutates `.agents/`, `AGENTS.md` and `project-context.md`; restore them before committing.
- The allowlist is the honest form of "known failures": every entry names a bug key; adding an entry needs that key to exist.

## Testing

`test/release-gate-epic-36.test.js` (new), the README/CHANGELOG parity assertion, and the two CI jobs (AC3, AC4) with their negative runs.

## Out of scope

- Fixing pre-existing chain failures (`bug-npm-test-windows-suite-health-chain`) — list them, do not fix them.
- The 4.x installer, the complete bundle and every npm publish (Epic 39); the GA re-gate (36.7).
- Epic 37–38 work.

## Verification record

Commit: `bmadRef.core` `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (ma-agents `main` `5468e4e` + this story's working tree) ; Linux CI runs (pos/neg): positive https://github.com/mayafit/AI_Agents/actions/runs/43655910096 (success, 116 files, 108 pass, 8 allowlisted, gate holds), negative https://github.com/mayafit/AI_Agents/actions/runs/43656256468 (uv steps removed: `uv: not on PATH`, `customize-contract-v7` fails `prerequisite: uv not found on PATH (ENOENT); install uv 0.13+`, job fails) ; required-check status: **not required, cannot be set** — branch protection and rulesets APIs return HTTP 403 (private repository, free plan); PO action ; offline CI run: https://github.com/mayafit/AI_Agents/actions/runs/43655929762 job `offline-runtime` success (five scripts exit 0, both controls fail as expected, `--network none`), `OFFLINE_NODE_IMAGE` `node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb` ; chain (Windows) halt + per-file: `npm test` halts at position 22 `test/migration-validation.test.js`; 22–116 run one by one: 4 pre-existing (`migration-validation`, `project-layout-staleness-guard`, `project-layout-artifact-routing`, `project-layout-confluence-publish-hook` — identical at `38ea256`), 1 new (`customize-contract-v7` m2, fixed) ; chain (Linux) allowlist: 8 files, identical at `38ea256` (https://github.com/mayafit/AI_Agents/actions/runs/43655069772): `migration-validation`, `config-storage`, `cross-repo-validation`, `project-layout-binding-spine`, `project-layout-config-generation`, `project-layout-staleness-guard` → `bug-npm-test-windows-suite-health-chain`; `project-layout-artifact-routing` → `bug-blocking-4-citation-guard-is-blind-in-ci`; `project-layout-confluence-publish-hook` → `bug-ac9c-tripwire-…`; 1 new in the first run (`release-gate-epic-31`, counts re-pinned) ; manifest SHA-256 (CI / local): `8515f1d4d0e5b189e48ff8249e1a4353412ddecfed8d6be2daa7e8a61c748cd7` / `8515f1d4d0e5b189e48ff8249e1a4353412ddecfed8d6be2daa7e8a61c748cd7` ; gate tag: `v4-gate-e734d3a` — not created (verdict FAIL) ; `maint/3.x`: exists at `38ea25603f2e0810ea95348dc00263abd75e374d` = `v3.18.1^{}` (recorded, not created) ; retro file: `epic-runs/epic-36/epic-36-retro-2026-11-15.md` ; verdict: **FAIL** — blocking item AC3 merge-blocking (record: `epic-runs/epic-36/36-6-release-gate.md`) ; unverified: listed in the release record (36.2–36.6), mirrored as Known limitations in `CHANGELOG.md` / `README.md`

### Dev Agent Record

Run 2026-11-15, Windows 11 (Git Bash, Node v24.15.0, npm 11.12.1, uv 0.13.8), Docker Desktop 29.9.2, GitHub Actions `ubuntu-latest`. CI was observed on snapshot commits of the working tree pushed to throwaway branches `ci/36-6-release-gate-probe`, `ci/36-6-negative-no-uv`, `ci/36-6-disposition-38ea256` (left on the remote for review); each probe's `test-linux.yml` adds `'ci/36-6-**'` to the `push` branches, the committed file does not. Local: `node bin/cli.js bundle build` → manifest `8515f1d4…`; `uv run scripts/build-wheelhouse.py --snapshot bundle/bmad-method --snapshot-commit e734d3a… --out bundle/runtime` → wheelhouse manifest `1ca62852…`; `node test/release-gate-epic-36.test.js` → 17 passed; eight mutants red (release record). The offline verify script was first run locally in `node:22-bookworm` (`--network none`, PASS) before CI. `npm test` was run in full (AC2); `.agents/`, `AGENTS.md`, `_bmad-output/project-context.md`, `skills/git-workflow-skill/skill.json`, `lib/knowledge-atlas/dist/atlas.cjs` and the ignored droppings the suites create were restored/removed afterwards.

### File List

- `.github/workflows/test-linux.yml` (new)
- `.github/scripts/run-test-chain.js` (new)
- `.github/scripts/offline-runtime-verify.sh` (new)
- `.github/workflows/offline-install.yml` (`workflow_dispatch`; `OFFLINE_NODE_IMAGE` → Node 22 digest; new `offline-runtime` job)
- `test/release-gate-epic-36.test.js` (new; appended to the `npm test` chain)
- `test/known-failures-linux.json` (new)
- `test/release-gate-epic-31.test.js` (AC7.5c / AC7.5h counts re-pinned for Epic 36's shipped files)
- `test/customize-contract-v7.test.js` (m2 regex accepts CRLF)
- `package.json` (chain)
- `CHANGELOG.md` ("Unreleased (4.x)"), `README.md` ("4.x line" + Known limitations)
- `_bmad-output/implementation-artifacts/epic-runs/epic-36/36-6-release-gate.md` (new), `epic-runs/epic-36/epic-36-retro-2026-11-15.md` (new)
- `_bmad-output/implementation-artifacts/bug-npm-test-windows-suite-health-chain.md` (dated note)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, this story

Note: `.gitignore` ignores `.github/` and its negations cannot re-include files under it, so the three new `.github/` files need `git add -f`.
