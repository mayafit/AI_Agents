# Story 22.1: Bump bmad-method to 6.3.0 and Rebuild Cache

Status: in-progress

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

- [x] 1.1 Edit `package.json` — change `"bmad-method": "6.2.2"` to `"bmad-method": "6.3.0"`
- [x] 1.2 Run `npm install` to update `package-lock.json`
- [x] 1.3 Verify `node_modules/bmad-method/package.json` shows version `6.3.0`

### Task 2: Update the cache build script for v6.3.0 (AC: 4)

- [x] 2.1 Inspect upstream BMAD v6.3.0 layout — confirmed `tools/cli/external-official-modules.yaml` was **removed** in 6.3.0 and replaced with `tools/installer/modules/registry-fallback.yaml`
- [x] 2.2 Updated `scripts/build-bmad-cache.js` to read from the new path (with legacy fallback for downgrades)
- [x] 2.3 Upstream list changed: `wds` was retired; `core`/`bmm` are now flagged `built_in: true` and bundled inside bmad-method itself. Script filters out `built_in: true` entries and retains retired modules in the manifest with `retiredUpstream: true` pending maintainer confirmation (AC #7 gate).

### Task 3: Rebuild the cache (AC: 2, 3, 7)

- [x] 3.1 Ran `npm run build:bmad-cache`
- [x] 3.2 Exit code 0
- [x] 3.3 Verified `lib/bmad-cache/bmb`, `cis`, `gds`, `tea` all populated with fresh v6.3.0 source and `_git_preserved/` directories
- [x] 3.4 `cache-manifest.json.bmadMethodVersion = "6.3.0"` (also records `registrySchema: "v63"`)
- [x] 3.5 `wds` retained in cache and manifest with `retiredUpstream: true` — awaiting maintainer confirmation before deletion (documented below)

### Task 4: Verify install end-to-end against a scratch project (AC: 5, 6)

- [x] 4.1 `npm install` — clean install
- [x] 4.2 `npm test` — exit 0 after fixing a pre-existing hardcoded-path issue in `lib/bmad-customizations/demerzel.md` (unrelated to Story 22.1 but blocking tests on main too)
- [x] 4.3 Scratch project created at `C:/Users/726125/AppData/Local/Temp/bmad-scratch`
- [x] 4.4 Invoked `bmad.installBmad(['bmm'], ['claude-code'], scratchDir, ...)` — the public CLI does not expose a direct BMAD-only install path, so exercised through the library API instead
- [x] 4.5 Install completed with `RESULT: true`; `_bmad/` tree has `_config/`, `bmm/`, `core/`; `_bmad/core/config.yaml` reports `Version: 6.3.0`
- [x] 4.6 Observations captured in Dev Notes below

### Task 5: Capture findings for Story 22.6 (AC: 6)

- [x] 5.1 Findings recorded below:
  - `_bmad/_config/manifest.yaml` **still exists** in v6.3.0 output at the same path (not moved to `bmm/config.yaml`)
  - `applyCustomizations()` filter for `["custom", "bmb"]` will find **no matching entries** on a bare `['bmm']` install — in v6.3.0 `bmb` is an external plugin and `custom` is only present when `--custom-source` is passed
  - v6.3.0 manifest adds `source`, `npmPackage`, `repoUrl` fields that legacy code does not read (but does not break on either)
  - **Critical break:** `lib/bmad.js buildBmadArgs` was passing `--custom-content` which v6.3.0 rejects (flag renamed to `--custom-source`). Fixed minimally via a version-detecting helper `resolveCustomContentFlag()` so both versions work. Story 22.6's stage-and-invoke refactor should supersede this.
  - **Other break to investigate in 22.6:** `tools/cli/installers/lib/custom/handler.js` was removed in v6.3.0. Custom module handling is consolidated in `tools/installer/modules/custom-module-manager.js`. Any code that reaches into the old handler path will fail.

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

### Story 22.1 Implementation Findings (Apr 2026)

**v6.3.0 upstream layout changes affecting ma-agents:**

1. **Registry moved:** `tools/cli/external-official-modules.yaml` → `tools/installer/modules/registry-fallback.yaml`. New schema: `built_in: true` flag added for core/bmm, no `branch` field, module keys are module-name-style (`bmad-builder`) not code-style (`bmb`).

2. **CLI entry moved:** `tools/bmad-npx-wrapper.js` → `tools/installer/bmad-cli.js` (per `bin.bmad-method` in upstream package.json).

3. **Install command flags:**
   - `--custom-content` renamed to `--custom-source`
   - All other ma-agents-used flags (`--directory`, `--modules`, `--tools`, `--yes`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--action`) unchanged.

4. **Install command moved:** `tools/cli/commands/install.js` → `tools/installer/commands/install.js`.

5. **Custom module handler replaced:** `tools/cli/installers/lib/custom/handler.js` → consolidated into `tools/installer/modules/custom-module-manager.js` (module.yaml is still the accepted custom-module format).

6. **Upstream modules retired:** `wds` (web-dev-studio) is no longer in the official registry. Retained in the ma-agents cache with `retiredUpstream: true` pending maintainer confirmation (AC #7).

7. **Output structure:** `_bmad/_config/manifest.yaml` still exists at the same path. New fields `source`, `npmPackage`, `repoUrl` are additive (legacy ma-agents code ignores them and does not break).

**Changes made in this story:**
- `package.json` — pinned `bmad-method: 6.3.0`
- `scripts/build-bmad-cache.js` — rewritten to read new registry path, filter `built_in`, retain retired modules with flag
- `lib/bmad.js`:
  - `getBmadCommand()` now resolves `bmad-cli.js` first, falls back to `bmad-npx-wrapper.js`
  - Added `resolveCustomContentFlag()` helper that picks `--custom-source` on v6.3.0 and `--custom-content` on v6.2.x
  - `buildBmadArgs()` uses the dynamic flag
  - `BMAD_TARGET_VERSION = '6.3.0'`
- `test/bmad-version-bump.test.js` — rewritten for v6.3.0 expectations
- `test/build-bmad-args.test.js` — two tests accept either flag name
- `lib/bmad-customizations/demerzel.md` — fixed a pre-existing hardcoded `_bmad-output/implementation-artifacts/` path that broke `cross-repo-validation.test.js` on main (unrelated to the version bump but blocking the test suite)

**Deferred to Story 22.6:**
- Replace `applyCustomizations()` with stage-and-invoke design (the current flag rename is a minimum-viable shim).
- Revisit how ma-agents should handle retired `wds` cache.

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
| 2026-04-23 | 1.1.0 | dev-agent | Implementation complete — bmad-method bumped to 6.3.0, cache rebuilt, lib/bmad.js adjusted for new CLI entry point and `--custom-source` flag, findings captured for Story 22.6 |
