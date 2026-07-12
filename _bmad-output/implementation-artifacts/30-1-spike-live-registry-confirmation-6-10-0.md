# Story 30.1: Spike/GATE — Live-Registry Confirmation for bmad-method@6.10.0

Status: review

## Story

As the **ma-agents maintainer**,
I want to confirm — against a live `npm install bmad-method@6.10.0` — that the P5-8 assumptions hold (registry PATH/SCHEMA unchanged, `bmad-loop` = `type: bmad-org` + `marketplace-plugin: true`, `bmad-automator` = `deprecated: true`, and the bundle set is still exactly `{tea, bmb, cis, gds, wds}`) and to locate the exact downstream call-sites,
So that Stories 30.2 and 30.3 implement a known-small filter/guard change against ground truth rather than discovering the registry shape mid-build.

**Gate:** This is a HARD GATE for Epic 30. No implementation story on the safety spine (30.2, 30.3) begins until these assumptions are confirmed. This is a CONFIRMATION spike, not open design — the fix approach is already fixed by P5-8 (closed-by-default allowlist + two-sided set-equality guard). The spike de-risks it against the live package and produces a PASS/STOP verdict.

## Acceptance Criteria

1. **Given** a scratch `npm install bmad-method@6.10.0` (outside the repo), **When** the maintainer inspects the package, **Then** every `type: bmad-org` module and its additive `marketplace-plugin`/`deprecated` flags are enumerated from the package-root `bmad-modules.yaml`.

2. **Given** the enumeration, **When** the P5-8 assumptions are checked, **Then** all four hold or the gate STOPS and re-briefs:
   - (3a) `bmad-loop` exists as `type: bmad-org` with `marketplace-plugin: true`.
   - (3b) `bmad-automator` is marked `deprecated: true`.
   - (3c) The registry PATH (package-root `bmad-modules.yaml`) and parse SCHEMA are unchanged vs 6.9.0 (new fields purely additive) — the P5-5 reader/`parseModulesYaml` carry forward verbatim.
   - (3d) The bundle set among non-deprecated, non-`marketplace-plugin` `type: bmad-org` modules is still exactly `{tea, bmb, cis, gds, wds}`.

3. **Given** the confirmed registry, **When** the current `normalizeModules()` + thin-cache guard are run against the live YAML, **Then** the P5-8 "silent addition" break is reproduced (bmad-loop force-bundled; guard sees no MISSING and ignores the EXTRA) — proving the 30.2 fix is required.

4. **Given** the confirmed source, **When** the downstream call-sites are located, **Then** file:line references are recorded for (a) the #2511 custom-source `isLocalSourcePath` change and (b) the official-modules fail-loud path (`_copyResolvedSkills` + marketplace-plugin unresolved) — in BOTH the installed bmad-method package and the ma-agents repo staging path that regression-verifies them.

5. **Given** the findings, **When** the gate is decided, **Then** a one-line GATE VERDICT (PASS or STOP/RE-BRIEF) is written to `epic-runs/epic-30/30-1-gate-findings.md`, blocking or unblocking 30.2/30.3.

## Tasks / Subtasks

### Task 1: Enumerate the live 6.10.0 registry (AC: 1)
- [x] 1.1 `npm install bmad-method@6.10.0` to a scratch dir (NOT the repo)
- [x] 1.2 Read package-root `bmad-modules.yaml`; record code/type/marketplace-plugin/deprecated per module
- [x] 1.3 Confirm old registry paths (`registry-fallback.yaml`, `external-official-modules.yaml`) absent

### Task 2: Verify P5-8 assumptions 3a–3d (AC: 2)
- [x] 2.1 bmad-loop = bmad-org + marketplace-plugin:true
- [x] 2.2 bmad-automator = deprecated:true (type experimental)
- [x] 2.3 Path/schema unchanged, additive-only fields — run the ma-agents reader against the live YAML
- [x] 2.4 Non-deprecated/non-plugin bmad-org set == {tea,bmb,cis,gds,wds}

### Task 3: Reproduce the break (AC: 3)
- [x] 3.1 Run current `parseModulesYaml`/`normalizeModules` on the live YAML; confirm bmad-loop is EXTRA and the guard passes silently

### Task 4: Locate call-sites in both repos (AC: 4)
- [x] 4.1 #2511 `isLocalSourcePath` in installed `custom-module-manager.js`
- [x] 4.2 fail-loud `_copyResolvedSkills` + marketplace-plugin abort in installed `official-modules.js`
- [x] 4.3 ma-agents staging path (`lib/bmad.js` stagePlugin/buildBmadArgs/resolveCustomContentFlag) that these two touch

### Task 5: Write the gate verdict (AC: 5)
- [x] 5.1 PASS/STOP one-liner + full findings in `epic-runs/epic-30/30-1-gate-findings.md`

## Dev Notes

- Do NOT change product source — this is a gate. The 30.2 filter/guard change and the 30.3 pin bump are separate stories.
- Reader under test: `parseModulesYaml`/`normalizeModules`/`locateRegistry` in `scripts/build-bmad-cache.js` (exported when required as a module).
- The full evidence-based findings live in `_bmad-output/implementation-artifacts/epic-runs/epic-30/30-1-gate-findings.md`.

## Spike Findings (Dev Agent Record)

GATE VERDICT: **PASS** — all four P5-8 assumptions confirmed against a live `npm install bmad-method@6.10.0` (LIVE_INSTALL: confirmed, version string `6.10.0`). The predicted "silent addition" break is reproducible with the current reader (bmad-loop resolves as an EXTRA the thin-cache guard ignores). Registry PATH unchanged (package-root `bmad-modules.yaml`); SCHEMA additive-only. Call-sites located in both repos. Waves 2–4 (Stories 30.2/30.3) are valid to proceed. See the findings report for the enumerated table, evidence, and exact file:line references.
