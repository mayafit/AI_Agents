# Story 24.1: Bump bmad-method to 6.5.0 and Audit fs-extra Compatibility

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the bundled bmad-method dependency upgraded from 6.3.0 to 6.5.0 and all fs-extra call sites audited for compatibility with BMAD's native node:fs migration,
So that all downstream Epic 24 stories can rely on a v6.5.0 baseline and no runtime breakage is introduced by the fs-extra → node:fs change upstream.

## Acceptance Criteria

1. **Given** a fresh checkout of the feature branch, **When** I open `package.json`, **Then** the `dependencies` section declares `"bmad-method": "6.5.0"` (exact pin, no caret/tilde).

2. **Given** the dependency is bumped, **When** I run `npm install` followed by `npm test`, **Then** both commands succeed with exit code 0.

3. **Given** BMAD v6.4.0 removed `fs-extra` and replaced it with native `node:fs` (#2253), **When** I audit `lib/bmad.js` and `lib/installer.js`, **Then** every `fs-extra` call site is classified as either: (a) safe — ma-agents' own logic, no BMAD API boundary crossing; or (b) boundary — passes fs state to or from bmad-method internals that changed. All boundary calls are resolved before this story closes.

4. **Given** a scratch install against a clean project, **When** `npx ma-agents install --yes --force --tools claude-code` completes, **Then** the install succeeds and the resulting `_bmad/` tree is documented in Dev Notes.

5. **Given** the scratch install in AC4, **When** I inspect the `_bmad/` tree, **Then** Dev Notes document: (a) whether `_bmad/bmm/config.yaml` still exists and contains the expected keys (`planning_artifacts`, `user_name`, `communication_language`, `document_output_language`, `implementation_artifacts`); (b) whether any config has moved to a TOML file. This finding gates Story 24.2's P5-1 confirmation scope.

6. **Given** `lib/bmad-extension-plugin/skills/module.yaml`, **When** I diff it against the upstream v6.5.0 module.yaml schema, **Then** any schema changes are documented and `scripts/build-plugin.js` is updated if needed; the schema version comment is updated to `# BMAD v6.5.0 schema`.

7. **Given** `lib/bmad.js`, **When** I update the `BMAD_TARGET_VERSION` constant, **Then** it reads `'6.5.0'`.

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1, 7)

- [ ] 1.1 Edit `package.json` — change `"bmad-method": "6.3.0"` to `"bmad-method": "6.5.0"`
- [ ] 1.2 Run `npm install` to update `package-lock.json`
- [ ] 1.3 Verify `node_modules/bmad-method/package.json` shows version `6.5.0`
- [ ] 1.4 Update `BMAD_TARGET_VERSION = '6.5.0'` in `lib/bmad.js`

### Task 2: fs-extra call-site audit (AC: 3)

- [ ] 2.1 Enumerate all fs-extra API calls in `lib/bmad.js` and `lib/installer.js`
- [ ] 2.2 For each call site, classify: (a) safe — ma-agents' own logic only; or (b) boundary — value crosses into/out of a bmad-method public API
- [ ] 2.3 For each boundary call: verify the bmad-method v6.5.0 equivalent behavior (e.g., `fs.ensureDir` → `fs.mkdir({ recursive: true })`). Fix any behavioral differences.
- [ ] 2.4 Document the full audit in Dev Notes: total call sites, boundary count, what was changed
- [ ] 2.5 Run `npm test` — exit 0 after any fixes

### Task 3: Run full test suite (AC: 2)

- [ ] 3.1 `npm install` — clean install
- [ ] 3.2 `npm test` — exit 0; document any pre-existing failures separately
- [ ] 3.3 Fix any test failures caused by the version bump

### Task 4: Scratch install + _bmad/ tree inspection (AC: 4, 5)

- [ ] 4.1 Create scratch project and run full install via CLI or library API
- [ ] 4.2 Capture full `_bmad/` tree: `find <scratch>/_bmad -type f | sort`
- [ ] 4.3 Check `_bmad/bmm/config.yaml` — exists? Keys present? Document all keys found.
- [ ] 4.4 Check for any `*.toml` files in `_bmad/` — document if present and what they contain
- [ ] 4.5 Record findings in Dev Notes — directly informs Story 24.2 scope

### Task 5: module.yaml schema diff (AC: 6)

- [ ] 5.1 Locate upstream v6.5.0 module.yaml schema reference in `node_modules/bmad-method`
- [ ] 5.2 Diff against `lib/bmad-extension-plugin/skills/module.yaml`
- [ ] 5.3 Update `scripts/build-plugin.js` output if schema changed
- [ ] 5.4 Update schema version comment in `module.yaml` to `# BMAD v6.5.0 schema`

## Dev Notes

### Why Medium, not Small

BMAD v6.4.0 removed `fs-extra` (46 call sites across `lib/bmad.js` and `lib/installer.js`) and deleted 1,683 lines of installer code. The version bump requires an audit to confirm ma-agents' own fs-extra usage doesn't cross any changed boundary. The audit may find nothing to fix — but that conclusion requires the work to reach it.

### Key finding to capture (gates 24.2)

The most important output of Task 4 is: "Does `_bmad/bmm/config.yaml` still exist with its expected keys in v6.5.0 output?" This is the load-bearing assumption behind Architecture Decision P5-1 Sub-decision A (marked TENTATIVE). Document exact file path, keys present, and any TOML equivalents found.

### What this story does NOT do

- Does NOT implement TOML config support (Story 24.3 — conditional on findings here)
- Does NOT reconcile or absorb custom workflow skills (Story 24.4)
- Does NOT add new CI matrix entries (Story 24.8)
- Does NOT assess `.agents/skills/` routing (Story 24.11)

### Reference Files

- `package.json` — dependency declaration
- `lib/bmad.js` — `BMAD_TARGET_VERSION` constant; fs-extra usage (~29 sites)
- `lib/installer.js` — fs-extra usage (~17 sites)
- `scripts/build-bmad-cache.js` — may need registry schema re-verification for v6.5.0
- `lib/bmad-extension-plugin/skills/module.yaml` — schema version comment
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decision P5-1, TENTATIVE)

### PRD Traceability

- **FR196:** The ma-agents npm package bundles bmad-method v6.5.0 as a direct dependency
- **NFR20:** The bundled BMAD cache must be version-pinned (v6.5.0 current)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-27 | 1.1.0 | (pending) | Bump target changed to v6.5.0; reclassified Medium; added fs-extra audit tasks and module.yaml schema diff per adversarial review findings 1, 7, 10 |
