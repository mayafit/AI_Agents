# Story 24.1: Bump bmad-method to 6.4.0 and Verify fs-native Compatibility

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the bundled bmad-method dependency bumped from 6.3.0 to 6.4.0 and the existing install flow verified against the new version,
So that all downstream stories in Epic 24 can rely on a working v6.4.0 baseline before deeper changes begin.

## Acceptance Criteria

1. **Given** a fresh checkout of the feature branch, **When** I open `package.json`, **Then** the `dependencies` section declares `"bmad-method": "6.4.0"` (exact pin, no caret/tilde).

2. **Given** the dependency is bumped, **When** I run `npm install` followed by `npm test`, **Then** both commands exit with code 0.

3. **Given** a clean install, **When** I run `npx ma-agents install --yes --force --tools claude-code` against a scratch project, **Then** the install completes successfully and the resulting `_bmad/` tree shows v6.4.0 metadata.

4. **Given** the new dependency is installed, **When** I inspect `lib/bmad.js`, **Then** the `BMAD_TARGET_VERSION` constant reads `'6.4.0'`.

5. **Given** v6.4.0 may have moved the module config format, **When** I inspect the `_bmad/` output of a scratch install, **Then** the Dev Notes document whether `_bmad/bmm/config.yaml` still exists (or has moved to TOML), gating Story 24.3 scope.

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1)

- [ ] 1.1 Edit `package.json` — change `"bmad-method": "6.3.0"` to `"bmad-method": "6.4.0"`
- [ ] 1.2 Run `npm install` to update `package-lock.json`
- [ ] 1.3 Verify `node_modules/bmad-method/package.json` shows version `6.4.0`

### Task 2: Run test suite (AC: 2)

- [ ] 2.1 Run `npm test` — confirm exit code 0
- [ ] 2.2 If any tests fail due to version expectations, update version strings in test fixtures to `6.4.0` and re-run

### Task 3: fs-extra audit (AC: 2)

- [ ] 3.1 Grep ma-agents source for any `require('fs-extra')` or `import ... from 'fs-extra'`
- [ ] 3.2 If found, note affected files — BMAD removed implicit fs-extra usage in v6.4.0 (#2253); ma-agents must not depend on it transitively
- [ ] 3.3 Document findings in Dev Notes

### Task 4: Scratch install end-to-end (AC: 3)

- [ ] 4.1 Create a temp project directory
- [ ] 4.2 Invoke the library API (`bmad.installBmad(...)`) or CLI against the temp project
- [ ] 4.3 Capture and record the `_bmad/` directory tree layout in Dev Notes
- [ ] 4.4 Confirm install result is `true` / exit 0

### Task 5: Update BMAD_TARGET_VERSION constant (AC: 4)

- [ ] 5.1 Edit `lib/bmad.js` — update `BMAD_TARGET_VERSION` from `'6.3.0'` to `'6.4.0'`
- [ ] 5.2 Re-run `npm test` to confirm no version-string assertions regressed

### Task 6: Module config format check (AC: 5)

- [ ] 6.1 After scratch install, check whether `_bmad/bmm/config.yaml` exists in v6.4.0 output
- [ ] 6.2 If it still exists as YAML — document "config.yaml present; Story 24.3 is likely no-op"
- [ ] 6.3 If it has moved to TOML — document the new path and note that Story 24.3 scope expands (TOML read/write required in installer)

## Dev Notes

### Why this story is first

Every other story in Epic 24 assumes a working v6.4.0 baseline. This story lands the dependency bump cleanly, leaving the existing flow intact, so subsequent stories can be developed against a stable foundation. The TOML config adoption (Story 24.3), skill reconciliation (Story 24.4), and Kimi routing (Story 24.5) all depend on findings from this story.

### What this story does NOT do

- Does NOT implement TOML config support (Story 24.3)
- Does NOT reconcile forked skills with customize.toml (Story 24.4)
- Does NOT add Kimi Code routing (Story 24.5)
- Does NOT add bmad-customize skill (Story 24.6)
- Does NOT wire on_complete hooks (Story 24.7)

This story is intentionally narrow — version bump + fs-native verification + scratch install + document config format finding.

### fs-extra context

BMAD v6.4.0 PR #2253 removed the implicit `fs-extra` transitive dependency from the installer pipeline, replacing all usages with Node.js native `fs` APIs. If ma-agents calls any `fs-extra`-specific APIs (e.g., `fs.copy`, `fs.move`, `fs.ensureDir`), those calls will silently fail if `fs-extra` is no longer in the dependency tree. Task 3 audits for this.

### Config format gate for Story 24.3

If `_bmad/bmm/config.yaml` still exists post-install, Story 24.3 is a trivial no-op (document and close). If it has moved to TOML (e.g., `_bmad/bmm/config.toml`), Story 24.3 becomes a moderate coding task requiring `tomllib`/`tomli` support in `bmad-init.py` and a `CANONICAL_CONFIG_REL` update in `lib/bmad.js`.

### Reference Files

- `package.json` — dependency declaration
- `lib/bmad.js` — `BMAD_TARGET_VERSION` constant
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decision P5-1)

### PRD Traceability

- **FR74 (v6.4.0 variant):** The ma-agents npm package bundles bmad-method v6.4.0 as a direct dependency
- **NFR20:** The bundled BMAD version must be pinned (exact, no caret/tilde)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
