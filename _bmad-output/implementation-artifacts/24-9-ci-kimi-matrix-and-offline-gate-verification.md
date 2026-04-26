# Story 24.9: CI — Add Kimi Code to Multi-Tool Smoke Matrix and Verify Offline Gate

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the CI suite updated with a Kimi Code smoke test matrix entry and the offline install gate re-verified against v6.4.0,
So that Kimi Code support is regression-protected and the offline install guarantee is maintained after the version bump.

## Acceptance Criteria

1. **Given** `.github/workflows/multi-tool-smoke.yml`, **When** I inspect the tool matrix, **Then** `kimi-code` is present as a matrix entry alongside the other tools.

2. **Given** the Kimi Code matrix step, **When** the smoke workflow runs, **Then** it asserts `.kimi/skills/` exists and contains the expected skill files.

3. **Given** the offline install gate job, **When** it runs against the v6.4.0 bump and all Epic 24 changes, **Then** it passes (npm pack → egress-blocked container → install completes without network access).

4. **Given** the bundle-drift CI job, **When** it runs after all Epic 24 story changes are merged, **Then** running `npm run build:plugin` produces no diff against the committed `lib/bmad-extension-plugin/` directory.

5. **Given** a CI run triggered with all Epic 24 changes, **When** all matrix jobs complete, **Then** all jobs pass — or any failures are documented as pre-existing issues with a tracking note.

## Tasks / Subtasks

### Task 1: Add kimi-code matrix entry to multi-tool-smoke.yml (AC: 1)

- [ ] 1.1 Open `.github/workflows/multi-tool-smoke.yml`
- [ ] 1.2 Locate the tool matrix definition (e.g., `strategy.matrix.tool`)
- [ ] 1.3 Add `kimi-code` to the matrix list
- [ ] 1.4 Confirm the matrix entry follows the same shape as existing entries (e.g., `claude-code`, `kilocode`)

### Task 2: Add smoke assertion for .kimi/skills/ (AC: 2)

- [ ] 2.1 Locate the smoke verification script invoked by the multi-tool-smoke workflow (e.g., `scripts/verify-smoke.sh` or inline steps)
- [ ] 2.2 Add an assertion for the `kimi-code` case: check that `.kimi/skills/` exists and is non-empty after install
- [ ] 2.3 If verification is conditional on tool code (e.g., a case statement), add the `kimi-code` branch
- [ ] 2.4 Confirm existing tool assertions are unaffected

### Task 3: Verify offline install gate (AC: 3)

- [ ] 3.1 Locate the offline install gate job in `.github/workflows/` (added in Epic 22 Story 22.9)
- [ ] 3.2 Run the gate locally if feasible (npm pack + install without network) or push a draft branch to trigger CI
- [ ] 3.3 Confirm the gate passes with the v6.4.0 bundle and all Epic 24 changes
- [ ] 3.4 If the gate fails — investigate: is the v6.4.0 bundle larger? Are new transitive dependencies required? Document and fix.

### Task 4: Run bundle-drift check (AC: 4)

- [ ] 4.1 Run `npm run build:plugin` locally after all other Epic 24 stories are merged to the feature branch
- [ ] 4.2 Check `git diff lib/bmad-extension-plugin/` — confirm no diff
- [ ] 4.3 If there is a diff — a previous story (24.4, 24.6, or 24.7) forgot to commit the regenerated bundle; commit it now and document which story caused the drift

### Task 5: Trigger CI run and review results (AC: 5)

- [ ] 5.1 Push the branch or open a draft PR to trigger the full CI suite
- [ ] 5.2 Review each job result — multi-tool-smoke (all tools including kimi-code), offline gate, bundle-drift
- [ ] 5.3 If all pass — document in Dev Notes
- [ ] 5.4 If any fail — triage: fix if Epic 24 caused the failure; document as pre-existing if not

## Dev Notes

### Dependency on Story 24.5

Story 24.5 adds the Kimi Code routing to `lib/agents.js` and a unit test. This story adds the CI-level matrix entry and smoke assertion. Story 24.5 must be merged before this story's matrix entry will produce meaningful results — but the workflow YAML edit can be done in parallel.

### Bundle-drift gate

The bundle-drift check runs `npm run build:plugin` and fails if the output differs from the committed `lib/bmad-extension-plugin/` tree. This gate prevents the build script and the committed bundle from diverging silently. If any Epic 24 story changed the plugin bundle contents (Stories 24.4, 24.6, 24.7), the author of that story is responsible for committing the regenerated bundle. This story serves as the final check that the committed bundle is current.

### What this story does NOT do

- Does NOT add Kimi Code routing (Story 24.5)
- Does NOT change the offline gate logic — only verifies it still passes
- Does NOT fix pre-existing CI failures unrelated to Epic 24

### Reference Files

- `.github/workflows/multi-tool-smoke.yml` — multi-tool smoke workflow
- `.github/workflows/` — offline gate and bundle-drift workflows (locate by name from Epic 22 Story 22.9)
- `scripts/` — smoke verification script
- `lib/bmad-extension-plugin/` — plugin bundle committed tree

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
