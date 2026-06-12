# Story 27.5: Bump bmad-method to v6.8.0, Rebuild Cache + Plugin, Re-baseline Bundle Drift

Status: backlog

## Story

As a **ma-agents user**,
I want all upstream v6.7.0–v6.8.0 improvements (outcome-driven PRD/brief facilitators, `bmad-investigate`, `bmad-spec`, the v6.7.1 orphaned-module installer fix, strengthened skill activation guardrails, 19 new elicitation techniques) inherited transparently via the version bump,
So that I get them with no manual intervention.

**Blocked by:** Stories 27.2 (reworked cache reader) and 27.3 (updated tests) — the cache build must succeed against v6.8.0 before the pin is bumped.

**FR:** FR208 (supersedes FR197's v6.6.0 pin).

## Acceptance Criteria

1. **Given** the feature branch, **When** I inspect `package.json`, **Then** `dependencies` declares `"bmad-method": "6.8.0"` (exact pin, no caret/tilde), and `package-lock.json` + `node_modules/bmad-method/package.json` show `6.8.0`.

2. **Given** `BMAD_TARGET_VERSION` in `lib/bmad.js`, **When** I inspect it, **Then** it reads `'6.8.0'`.

3. **Given** the bump, **When** I run `npm run build:bmad-cache`, **Then** it exits 0 and `cache-manifest.json` `bmadMethodVersion` is `6.8.0` (depends on 27.2).

4. **Given** the bump, **When** I run `npm run build:plugin`, **Then** `lib/bmad-extension-plugin/` is regenerated and committed verbatim, the CI Bundle Drift Guard passes, and the regenerated diff is reviewed line-by-line to confirm it contains only the expected version bump + ma-agents-owned changes (no unexplained drift).

5. **Given** the pre-existing Windows CRLF drift, **When** the upgrade is evaluated, **Then** the drift is **resolved (the actual MIL-498 template CRLF drift fixed, not waived) and `npm test` is green on Windows before the bump**, so the regression is measured against a known-clean floor. This is the same resolution 27.7 AC3 requires — there is no "run on CI to dodge Windows" escape.

6. **Given** all changes, **When** I run `npm test`, **Then** it is green on Linux/CI; `project_name`/config auto-migration is confirmed non-breaking (no ma-agents code change required).

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1, 2)

- [ ] 1.1 Edit `package.json` — `"bmad-method": "6.6.0"` → `"6.8.0"` (exact pin)
- [ ] 1.2 `npm install`; verify `node_modules/bmad-method/package.json` shows `6.8.0`
- [ ] 1.3 Update `BMAD_TARGET_VERSION = '6.8.0'` in `lib/bmad.js`

### Task 2: Establish clean baseline (AC: 5)

- [ ] 2.1 Resolve the MIL-498 template CRLF drift (fix it, do not waive) so `npm test` is green on Windows; reference/extend the Epic 26 CRLF-fix follow-up
- [ ] 2.2 Capture the pre-bump green baseline for comparison

### Task 3: Rebuild cache + plugin (AC: 3, 4)

- [ ] 3.1 `npm run build:bmad-cache`; confirm exit 0 and `bmadMethodVersion: 6.8.0`
- [ ] 3.2 `npm run build:plugin`; commit the regenerated `lib/bmad-extension-plugin/` verbatim
- [ ] 3.3 Read the regenerated bundle diff line-by-line; confirm only expected changes (Bundle Drift Guard passes)

### Task 4: Verify (AC: 6)

- [ ] 4.1 `npm test` green on Linux/CI
- [ ] 4.2 Scratch install; confirm `project_name` auto-migration non-breaking, no ma-agents code change needed

## Dev Notes

- Satisfy the Bundle Drift Guard by regenerating and reading the diff — not by blindly re-running `build:plugin` until green.
- Check `test/plugin-manifests.test.js` for any `bmad_min_version` assertion to update.
