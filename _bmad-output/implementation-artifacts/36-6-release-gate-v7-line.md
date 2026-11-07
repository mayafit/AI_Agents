# Story 36.6 — Release Gate: v7 pre-release line at the pinned SHA

Status: backlog
Blocked on: 36-1, 36-2, 36-3, 36-4, 36-5
Wave: 2 (closes Epic 36 for the preview pin; its PASS opens Epic 37 — P5-11.10)

**FR:** FR280 (verdict per SHA), FR271 am., FR277, FR278, FR279, FR282 (offline runtime proved in CI); FR281 (stated: this gate does **not** satisfy it — 36.7 does). **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap with uv), NFR84 am. (first CI step: validator + install premises recorded). **Decision inputs:** P5-11.5 ("do not deploy the preview to on-prem users"), P5-11.6, P5-11.10 (36 gates 37); Story 32.9 (cancelled; its AC structure reused).

## Story

As the **ma-agents release owner**,
I want one evidence-backed record that the v7 pin, the offline runtime, the TOML contract and the `AGENTS.md` coexistence all hold at the pinned SHA, with the test chain's health stated honestly and the 3.x release line untouched,
so that the product owner can open Epic 37 and publish a clearly labelled pre-release on facts, and no on-prem user receives the preview by accident.

## Context

No GitHub workflow runs `npm test` today; the three workflows are `.github/workflows/bundle-drift.yml`, `multi-tool-smoke.yml` and `offline-install.yml`, and none installs uv or Python. The `npm test` script chains 110 test files with `&&` (`package.json:11`; 121 files under `test/`), and on Windows it halts early on pre-existing failures tracked as `bug-npm-test-windows-suite-health-chain` (backlog; `_bmad-output/implementation-artifacts/bug-npm-test-windows-suite-health-chain.md`). The current version is `3.18.1` (`package.json:3`); `CHANGELOG.md` does not ship on npm, so known limitations are mirrored into `README.md` (3.18.0 precedent). Epic 31's gate is the shape precedent (`test/release-gate-epic-31.test.js`). The 3.x preflight counts pinned there and elsewhere (`test/release-gate-epic-31.test.js:1153` 41, `:1178` 9, `:1917` 9, `:2360` `{ preflight: 46, gate: 9 }`, `:2363` 46; `test/project-layout-artifact-routing.test.js:1929` 41; `test/project-layout-confluence-page-tree.test.js:2291` 9, `:2428` 41; `test/project-layout-confluence-publish-hook.test.js:4027` 9, `:4040` 41) belong to the 3.x binding spine that Epic 38/39 retire; Epic 36 must not move them.

## Acceptance Criteria

Tags: **[v7-carries]** = re-asserted by 36.7 on the GA tag; **[pre-release-only]** = applies to this preview cut only.

1. **Verdict record.** [pre-release-only] `_bmad-output/implementation-artifacts/epic-runs/epic-36/36-6-release-gate.md` names the SHA (`package.json` `bmadRef.sha`), links `36-1-gate-findings.md` and each of 36.2–36.5's Verification records, lists every item any of them marked unverified, and ends in **PASS** (Epic 37 may start) or **FAIL** with the blocking item. A 36.1 STOP not resolved by correct-course is a FAIL.
2. **`npm test` chain health, recorded honestly.** [v7-carries] The chain is run on Windows and in the AC3 Linux job. The record lists, by file name, every failing test file and, for each, **pre-existing** (fails identically on `main` at `38ea256`, shown by running it there) or **new**. Any new failure blocks the gate. On Windows the halt position is recorded and every file after it is run individually (`node test/<file>`), so no file is reported green that never ran; the result is appended to `bug-npm-test-windows-suite-health-chain` as a dated note. "Known failures" are listed by name, never summarised as "flaky".
3. **Linux CI job with uv — merge-blocking for new failures.** [v7-carries] `.github/workflows/test-linux.yml` runs on `ubuntu-latest` for pull requests and pushes to `main`: Node ≥ 20.12; uv at a pinned version (`astral-sh/setup-uv` at a pinned tag); `uv python install 3.11`; `npm ci --ignore-scripts`; then every file of the chain run individually (not `&&`), with a summary. A **known-failure allowlist** (`test/known-failures-linux.json`: file name → bug key) is committed; the job fails on any failure not in the allowlist **and** on any allowlisted file that now passes (stale entry). The log shows `uv --version` and the Python version before the tests; 36.4's and 36.5's tests run and pass (not skipped). A negative run on a throwaway branch with the uv step removed shows 36.4's test failing with its prerequisite message. **Merge-blocking:** the record states whether the job is a required status check on `main` (a repo-admin setting the PO applies); the gate requires it to be required before PASS. Run URLs recorded.
4. **Offline runtime in CI.** [v7-carries] A `--network none` job (new, or a new step in `offline-install.yml` that leaves the 3.x steps untouched) reproduces 36.2 AC4 (five scripts with `uv run --no-cache`) and AC5(a) (wheelhouse removed → failure), with uv, Python and the wheelhouse fetched in the pre-pull step while the runner has network. The container never downloads uv, Python or wheels. Run URL recorded.
5. **Epic 36 invariants in one test.** [v7-carries] `test/release-gate-epic-36.test.js` asserts against outside authorities: `BMAD_TARGET_REF.sha` = `package.json` `bmadRef.sha` = snapshot manifest SHA = `git rev-parse HEAD` of the snapshot (36.3); `engines.node` not looser than the recorded floor (36.3); the wheelhouse manifest covers every PEP 723 dependency in the snapshot (36.2); 36.4's and 36.5's test files are in the chain; the 3.x preflight counts listed in Context are unchanged (read from those test files, compared to their values at `38ea256`). It is added to the chain.
6. **Bundle drift clean.** [v7-carries] `npm run build:plugin` (and `build:atlas` / `build:bmad-cache` if touched) produce no diff on the release commit; the Bundle Drift Guard passes; `marketplace.json` version equals `package.json` version (memory: drift on every version bump).
7. **3.x semver untouched; pre-release identity.** [pre-release-only] No `3.x` version is cut from this line. The pre-release version is a SemVer pre-release of the next major (e.g. `4.0.0-v7.0`; exact string chosen by the PO and recorded), published with a dist-tag other than `latest` and `beta` (e.g. `next`). After publish, `npm view ma-agents dist-tags` shows `latest` still at a 3.18.x version; the record pastes the output. 3.x fixes ship from a maintenance branch cut at `v3.18.1` (`38ea256`) — its name is recorded; if none exists, the gate is FAIL.
8. **CHANGELOG "v7 line pre-release".** [pre-release-only] A section headed for the pre-release states: targets BMAD v7 at `e734d3a` (preview alpha); **not for on-prem deployment** (FR281: 3.18.x on bmad-method 6.10.0 remains the supported on-prem release until the GA re-gate, 36.7); `ma-agents install` on this line still drives the v6 bmad-method installer until Epic 39 (36.3 AC5); Node ≥ 20.12; uv + Python 3.11 + wheelhouse for the v7 runtime (`docs/on-prem-runtime.md`); and Known limitations — every unverified item from AC1, the 36.5 AC8 adopt finding, the 36.1 FALLBACK items. The same Known limitations are mirrored in `README.md`; a test asserts both lists name the same items.
9. **Pre-release installed from the registry.** [pre-release-only] *(Restated 2026-11-07 per readiness C-3, option (a); PO may still choose option (b): no publish until 39.5.)* The pre-release is published (`npm publish --ignore-scripts --tag <dist-tag>`, per the repo's publish practice) and installed from the registry into a scratch project on a clean machine. Recorded: `ma-agents --version`, `npm view ma-agents dist-tags`, and the installed `package.json` `bmadRef`. **The v7 runtime proof for this cut is AC4 (CI), not the registry install** — this package still drives bmad-method 6.10.0 (36.3 AC5, AC8), so no `_bmad/scripts/render_skill.py` exists in the installed project. The CHANGELOG known-limitations list states that this pre-release installs bmad-method 6.10.0.
10. **Retro and verdict.** [pre-release-only] `bmad-retrospective` is run for Epic 36 (output under `epic-runs/epic-36/`), naming at least what 36.1 could not answer, any count re-pinned and why, and whether Epic 37 may start (yes/no). The epic's status change is handed to the Scrum Master for `sprint-status.yaml` (this story does not edit it directly while the v7 tracker move is pending).

## Tasks / Subtasks

- [ ] T1 `test-linux.yml` with uv + Python 3.11; per-file runner; allowlist; positive and negative runs (AC3) — before T2
- [ ] T2 Chain health on Windows + Linux; per-file disposition vs `main@38ea256`; bug-file note (AC2)
- [ ] T3 Offline runtime CI job (AC4)
- [ ] T4 `test/release-gate-epic-36.test.js` (AC5)
- [ ] T5 Rebuild bundles; drift check (AC6)
- [ ] T6 Maintenance branch confirmed; pre-release version + dist-tag from the PO (AC7)
- [ ] T7 CHANGELOG + README Known limitations + parity test (AC8)
- [ ] T8 Publish pre-release; clean-machine install (AC9)
- [ ] T9 Retro; verdict file (AC1, AC10)

## Dev Notes

- Seeding uv in CI: bake it in the pre-pull step while the runner has network, then start the `--network none` container from that image (`offline-install.yml:44-53` pins the base digest).
- Publish: `npm pack --ignore-scripts` / `npm publish --ignore-scripts` (Windows `prepare` tarball leak); credentials per memory "ma-agents npm publish", never printed. If gh/git keyring auth fails, follow memory "GitHub push credentials location", masked.
- Branch the release PR off `main` after the Epic 36 PR merges, not off the epic branch (memory "stacked-PR squash-merge orphan").
- `npm test` mutates `.agents/`, `AGENTS.md` and `project-context.md`; restore them before committing.
- The allowlist is the honest form of "known failures": every entry names a bug key; adding an entry needs that key to exist.

## Testing

`test/release-gate-epic-36.test.js` (new), the README/CHANGELOG parity assertion, and the two CI jobs (AC3, AC4) with their negative runs.

## Out of scope

- Fixing pre-existing chain failures (`bug-npm-test-windows-suite-health-chain`) — list them, do not fix them.
- Any on-prem bundle or installer change (Epic 39); the GA re-gate (36.7).
- Epic 37–38 work.

## Verification record

SHA: … ; Linux CI runs (pos/neg): … ; required-check status: … ; offline CI run: … ; chain (Windows) halt + per-file: … ; chain (Linux) allowlist: … ; pre-release version + dist-tag + `npm view` output: … ; maintenance branch: … ; retro file: … ; verdict: … ; unverified: …
