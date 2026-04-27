# Story 24.9: CI — Verify Offline Gate and Bundle Drift After v6.4.0 Upgrade

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the offline install gate and bundle-drift CI job verified to pass after all Epic 24 story changes,
So that the air-gapped install guarantee and deterministic bundle guarantee are maintained through the v6.4.0 upgrade.

## Acceptance Criteria

1. **Given** the offline install gate job, **When** it runs against the v6.4.0 bump and all Epic 24 changes, **Then** it passes (`npm pack` → egress-blocked container → install completes without network access).

2. **Given** the bundle-drift CI job, **When** it runs after all Epic 24 story changes are merged to the branch, **Then** running `npm run build:plugin` produces no diff against the committed `lib/bmad-extension-plugin/` directory.

3. **Given** the multi-tool smoke matrix (existing 5 tools — Claude Code, Copilot, Cline, Roo Code, Kilocode), **When** all matrix jobs run, **Then** all pass — or any failures are documented as pre-existing issues with a tracking note.

4. **Given** a full CI run triggered with all Epic 24 changes, **When** all jobs complete, **Then** the branch is green (or all failures are triaged and resolved).

## Tasks / Subtasks

### Task 1: Verify offline install gate (AC: 1)

- [ ] 1.1 Locate the offline install gate job in `.github/workflows/` (added in Epic 22 Story 22.9)
- [ ] 1.2 Push the Epic 24 branch to trigger CI, or reproduce the gate locally (`npm pack` + install without network)
- [ ] 1.3 Confirm the gate passes with the v6.4.0 bundle and all Epic 24 story changes applied
- [ ] 1.4 If the gate fails — investigate: new transitive dependency pulled at install time? v6.4.0 upstream trying to reach the network? Document and fix.

### Task 2: Run bundle-drift check (AC: 2)

- [ ] 2.1 Run `npm run build:plugin` locally after all other Epic 24 stories are merged to the feature branch
- [ ] 2.2 Check `git diff lib/bmad-extension-plugin/` — confirm no diff
- [ ] 2.3 If there is a diff — a previous story (24.4, 24.6, or 24.7) forgot to commit the regenerated bundle; commit it now and document which story caused the drift

### Task 3: Confirm multi-tool smoke matrix passes (AC: 3)

- [ ] 3.1 Inspect `.github/workflows/multi-tool-smoke.yml` — confirm the existing 5-tool matrix is intact after Epic 24 changes
- [ ] 3.2 Review CI results for each tool (Claude Code, Copilot, Cline, Roo Code, Kilocode)
- [ ] 3.3 If any tool fails — determine whether Epic 24 caused the regression; fix if yes, document with tracking note if pre-existing

### Task 4: Full CI triage (AC: 4)

- [ ] 4.1 Trigger a full CI run from the Epic 24 branch
- [ ] 4.2 Confirm all jobs pass (offline gate, bundle-drift, multi-tool smoke, unit tests)
- [ ] 4.3 Document CI status in Dev Notes; unblock Story 24.10 when green

## Dev Notes

### What this story verifies

Epic 24 changes the plugin bundle contents (Stories 24.4, 24.6, 24.7) and bumps bmad-method (Story 24.1). Both affect what ships in the tarball and what the offline gate exercises. This story is the integration checkpoint before the release gate (Story 24.10).

The bundle-drift check enforces that `lib/bmad-extension-plugin/` in the repo exactly matches what `build-plugin.js` would generate. If any Epic 24 story added or removed a skill without regenerating the bundle, this check will catch it.

### What this story does NOT do

- Does NOT add new tool targets (Kimi or otherwise) — tool set is unchanged at 5
- Does NOT change the offline gate logic — only verifies it still passes
- Does NOT fix pre-existing CI failures unrelated to Epic 24

### Reference Files

- `.github/workflows/` — offline gate job and bundle-drift job (locate by name from Epic 22 Story 22.9)
- `.github/workflows/multi-tool-smoke.yml` — 5-tool smoke matrix
- `lib/bmad-extension-plugin/` — committed plugin bundle tree
- `scripts/build-plugin.js` — plugin build script

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-27 | 1.1.0 | (pending) | Kimi Code scope removed — Kimi not being added to ma-agents; story narrowed to offline gate + bundle-drift verification |
