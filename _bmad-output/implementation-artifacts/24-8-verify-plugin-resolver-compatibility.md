# Story 24.8: Verify Plugin Resolver Compatibility and CI Gate Health

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to verify that the plugin resolver works correctly under v6.5.0's new precedence order, and that the offline install gate and bundle-drift CI jobs pass clean after all Epic 24 changes,
So that the resolver path is validated, the air-gapped install guarantee is maintained, and CI is green before the release gate.

## Acceptance Criteria

1. **Given** v6.5.0's shared resolver preferring `package.json > module.yaml > marketplace.json` (#2298), **When** I inspect the ma-agents plugin bundle structure, **Then** I can confirm which precedence level the bundle is resolved at, and if the bundle lacks a `package.json`, one is added so the bundle is discoverable at the highest-priority level.

2. **Given** the plugin bundle is staged to `.ma-agents-plugin-stage/`, **When** BMAD's PluginResolver runs during install, **Then** it resolves the bundle without error and all expected skills land in the correct tool directory.

3. **Given** the offline install gate job (added in Epic 22 Story 22.9), **When** it runs against the v6.5.0 bump and all Epic 24 changes, **Then** it passes (`npm pack` → egress-blocked container → install completes without network access).

4. **Given** the bundle-drift CI job, **When** it runs after all Epic 24 story changes are merged to the branch, **Then** running `npm run build:plugin` produces no diff against the committed `lib/bmad-extension-plugin/` directory.

5. **Given** the multi-tool smoke matrix (5 tools — Claude Code, Copilot, Cline, Roo Code, Kilocode), **When** all matrix jobs run, **Then** all pass — or any failures are documented as pre-existing issues with a tracking note.

6. **Given** a full CI run triggered with all Epic 24 changes, **When** all jobs complete, **Then** the branch is green and Story 24.10 is unblocked.

## Tasks / Subtasks

### Task 1: Audit plugin bundle resolver structure (AC: 1)

- [ ] 1.1 Inspect `lib/bmad-extension-plugin/` — does a `package.json` exist at bundle root?
- [ ] 1.2 Inspect `lib/bmad-extension-plugin/skills/module.yaml` — is it present and does it carry the fields the resolver reads (`code`, `version`, `description`)?
- [ ] 1.3 Inspect `.claude-plugin/marketplace.json` — confirm it is present (lowest priority, fallback)
- [ ] 1.4 Decision: if no `package.json` exists and the resolver now prefers it, add a minimal `package.json` to the bundle root (name, version, description matching the plugin identity) and update `scripts/build-plugin.js` to generate it

### Task 2: End-to-end resolver smoke test (AC: 2)

- [ ] 2.1 Run a scratch install with verbose logging (or read bmad-method installer logs) to confirm PluginResolver picked up the bundle via the expected precedence level
- [ ] 2.2 Confirm all expected skills appear in `.claude/skills/` after install
- [ ] 2.3 If resolution fails — diagnose: wrong path, wrong field name, schema mismatch. Fix in `scripts/build-plugin.js`.

### Task 3: Verify offline install gate (AC: 3)

- [ ] 3.1 Locate the offline install gate job in `.github/workflows/`
- [ ] 3.2 Push the Epic 24 branch to trigger CI, or reproduce locally (`npm pack` + install without network)
- [ ] 3.3 Confirm gate passes; if it fails — investigate new transitive dependencies or upstream network calls introduced in v6.5.0

### Task 4: Run bundle-drift check (AC: 4)

- [ ] 4.1 Run `npm run build:plugin` locally after all other Epic 24 stories are merged to the feature branch
- [ ] 4.2 `git diff lib/bmad-extension-plugin/` — confirm no diff
- [ ] 4.3 If diff exists: a prior story (24.4, 24.6, 24.7) forgot to commit the regenerated bundle — commit it and document which story caused the drift

### Task 5: Multi-tool smoke matrix review (AC: 5)

- [ ] 5.1 Confirm `.github/workflows/multi-tool-smoke.yml` 5-tool matrix is intact after Epic 24 changes
- [ ] 5.2 Review CI results for all 5 tools
- [ ] 5.3 Triage any failures: fix if Epic 24 caused them; document as pre-existing if not

### Task 6: Full CI triage (AC: 6)

- [ ] 6.1 Trigger full CI run from Epic 24 branch
- [ ] 6.2 All jobs pass (offline gate, bundle-drift, multi-tool smoke, unit tests)
- [ ] 6.3 Document CI status in Dev Notes; advance Story 24.10 to ready-for-dev when green

## Dev Notes

### Two concerns merged into one story

This story combines what were originally two stories (resolver compatibility verification + CI gate health) because they share the same execution context: both run after all other Epic 24 stories are merged, both validate the full integrated artifact, and the resolver check is a prerequisite to understanding whether CI passes for the right reasons.

### Resolver precedence change (v6.4.0 #2298)

Before v6.4.0, BMAD's resolver treated `marketplace.json` and `module.yaml` roughly equally. v6.4.0 formalised a strict preference order: `package.json > module.yaml > marketplace.json`. Our bundle currently ships `module.yaml` and `marketplace.json` but no `package.json`. Task 1 determines whether this matters (the resolver may still pick up `module.yaml` correctly) or whether we need to add a `package.json` to be at highest priority.

### What this story does NOT do

- Does NOT add new tool targets (Kimi or otherwise)
- Does NOT change the offline gate logic — verifies it passes
- Does NOT fix pre-existing CI failures unrelated to Epic 24

### Reference Files

- `lib/bmad-extension-plugin/` — plugin bundle committed tree
- `scripts/build-plugin.js` — plugin build script
- `.github/workflows/multi-tool-smoke.yml` — 5-tool smoke matrix
- `.github/workflows/` — offline gate and bundle-drift workflow files

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story 24.8 drafted as resolver compatibility verification |
| 2026-04-26 | 1.0.0 | (pending) | Story 24.9 drafted as CI offline gate + bundle-drift verification |
| 2026-04-27 | 2.0.0 | (pending) | Stories 24.8 and 24.9 merged into single story. Added resolver precedence audit task. Per adversarial review findings 9. |
