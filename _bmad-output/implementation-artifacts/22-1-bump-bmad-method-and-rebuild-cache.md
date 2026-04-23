# Story 22.1: Bump bmad-method to 6.3.0 and Rebuild Cache

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the bundled bmad-method dependency upgraded from 6.2.2 to 6.3.0 and `lib/bmad-cache/` rebuilt against the new version,
So that all downstream stories in Epic 22 can rely on v6.3.0 module structure and behavior.

## Acceptance Criteria

1. **Given** a fresh checkout of the feature branch, **When** I open `package.json`, **Then** the `dependencies` section declares `"bmad-method": "6.3.0"` (exact pin, no caret/tilde).

2. **Given** the dependency is bumped, **When** I open `lib/bmad-cache/cache-manifest.json`, **Then** `bmadMethodVersion` equals `"6.3.0"` and the per-module entries are regenerated against the v6.3.0 source.

3. **Given** the cache build script, **When** I run `npm run build:bmad-cache` (or the equivalent script invocation from `package.json`), **Then** the script completes with exit code 0 and produces an updated `lib/bmad-cache/` containing v6.3.0 sources for `bmb`, `cis`, `tea`, `gds`, and `wds` (or whatever modules v6.3.0 ships — confirm against upstream `external-official-modules.yaml` first).

4. **Given** v6.3.0 may have moved or renamed the upstream module registry, **When** the cache script runs, **Then** `scripts/build-bmad-cache.js` reads from the correct upstream registry path for v6.3.0 — any path constants in the script are updated as needed.

5. **Given** a clean install, **When** I run `npm install` followed by `npm test`, **Then** both commands succeed with exit code 0.

6. **Given** the new dependency is installed, **When** I run `npx ma-agents install --yes --force --tools claude-code` against a scratch project, **Then** the install completes successfully and the resulting `_bmad/` tree shows v6.3.0 install metadata in whatever manifest file 6.3.0 generates (note: the install path may still go through the legacy `applyCustomizations()` flow at this point — that is acceptable for this story; Story 22.6 replaces it).

7. **Given** any v6.3.0 upstream module that ma-agents previously bundled is now removed (e.g., a module retired in 6.3.0), **When** the cache rebuild runs, **Then** the missing module is documented in the story's Dev Notes and confirmed with the maintainer before any cache directory is deleted.

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1)

- [ ] 1.1 Edit `package.json` — change `"bmad-method": "6.2.2"` to `"bmad-method": "6.3.0"`
- [ ] 1.2 Run `npm install` to update `package-lock.json`
- [ ] 1.3 Verify `node_modules/bmad-method/package.json` shows version `6.3.0`

### Task 2: Update the cache build script for v6.3.0 (AC: 4)

- [ ] 2.1 Inspect upstream BMAD v6.3.0 layout — confirm whether `tools/cli/external-official-modules.yaml` (the source `scripts/build-bmad-cache.js` reads) still exists at that path or has moved
- [ ] 2.2 If the path moved, update `scripts/build-bmad-cache.js` to read from the new location
- [ ] 2.3 If the upstream module list changed (modules added or removed), reflect that in the cache build logic

### Task 3: Rebuild the cache (AC: 2, 3, 7)

- [ ] 3.1 Run `npm run build:bmad-cache` (or whichever script triggers the cache rebuild)
- [ ] 3.2 Verify the script exit code is 0
- [ ] 3.3 Inspect `lib/bmad-cache/` — confirm each module subdirectory exists and is populated with v6.3.0 source
- [ ] 3.4 Verify `lib/bmad-cache/cache-manifest.json` records `bmadMethodVersion: "6.3.0"`
- [ ] 3.5 If any previously bundled module is no longer in the v6.3.0 upstream list, document it in the story's Dev Notes section and pause for maintainer confirmation before deleting

### Task 4: Verify install end-to-end against a scratch project (AC: 5, 6)

- [ ] 4.1 Run `npm install` in the ma-agents repo — confirm clean install
- [ ] 4.2 Run `npm test` — confirm all existing tests pass against v6.3.0
- [ ] 4.3 Create a scratch project in a temp directory (e.g., `mkdir /tmp/ma-agents-scratch && cd /tmp/ma-agents-scratch && git init`)
- [ ] 4.4 Run `npx ma-agents install --yes --force --tools claude-code --directory .` against the scratch project
- [ ] 4.5 Verify the install completes with exit code 0 and produces a `_bmad/` tree
- [ ] 4.6 Capture observations about the legacy `applyCustomizations()` behavior on v6.3.0 (does it still complete? does it produce warnings? what manifest format does v6.3.0 generate?) — these observations feed Story 22.6's planning

### Task 5: Capture findings for Story 22.6 (AC: 6)

- [ ] 5.1 In the story's Dev Notes section, record:
  - Whether `_bmad/_config/manifest.yaml` still exists in v6.3.0 output, or whether it moved to `_bmad/bmm/config.yaml`
  - Whether the existing `applyCustomizations()` filter for `["custom", "bmb"]` module names still finds matching entries in v6.3.0
  - Any new manifest fields v6.3.0 introduces that the legacy code does not handle
  - Any errors or warnings produced by `lib/bmad.js` against v6.3.0

## Dev Notes

### Why this story is first

Every other story in Epic 22 assumes a working v6.3.0 baseline. This story lands the dependency cleanly, with the existing (possibly-still-working) `applyCustomizations()` path intact, so subsequent stories can be developed against a stable foundation. The actual replacement of `applyCustomizations()` happens in Story 22.6.

### What this story does NOT do

- Does NOT replace `applyCustomizations()` (Story 22.6)
- Does NOT add the plugin packaging (Stories 22.4, 22.5)
- Does NOT rename skills (Story 22.2)
- Does NOT change config read paths (Story 22.7)

This story is intentionally narrow — version bump + cache rebuild + verify the existing flow still works (or document how it breaks).

### Coupling to v6.3.0 internals to investigate

Architecture decision P4-1 enumerates the fragile points in the current `lib/bmad.js`:
- Hardcoded module-name filter `["custom", "bmb"]` (line ~252)
- CSV column-index parsing `fields[2]`
- Custom-agent YAML staging into `_bmad/_config/custom/agents/`

For Task 5, exercise each of these against v6.3.0 and document what still works vs. what breaks. Story 22.6 will use these findings.

### Reference Files

- `package.json` — dependency declaration
- `lib/bmad-cache/cache-manifest.json` — cache version record
- `scripts/build-bmad-cache.js` — cache build script
- `lib/bmad.js` (lines 205-346) — the legacy `applyCustomizations()` to be observed but not yet modified
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decision P4-1)
- PRD: FR74 (bumped pin), NFR20 (version pin convention)

### PRD Traceability

- **FR74:** The ma-agents npm package bundles bmad-method v6.3.0 as a direct dependency
- **NFR20:** The bundled BMAD cache must be version-pinned (v6.3.0 current)

### Architecture Reference

- Decision P4-1, "Affects" list — enumerates all files this story touches at the dependency-bump level

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
