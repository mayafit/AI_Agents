# Story 22.7: Migrate Config Reads to `_bmad/bmm/config.yaml`

Status: backlog

## Story

As a **ma-agents installer and skill**,
I want every read of BMAD-canonical config redirected from `_bmad/_config/*` to `_bmad/bmm/config.yaml`,
So that ma-agents aligns with the v6.3.0 canonical config location and the removed `bmad-init` skill is no longer required.

## Acceptance Criteria

1. **Given** all ma-agents code that previously read `_bmad/_config/manifest.yaml` for canonical BMAD config values, **When** that code is updated, **Then** it now reads `_bmad/bmm/config.yaml` instead.

2. **Given** all ma-agents skills in `lib/bmad-extension/skills/` and `skills/` that previously declared a dependency on `bmad-init` or assumed config was loaded externally, **When** they are updated, **Then** they read `_bmad/bmm/config.yaml` directly at the start of their workflow (before any other step that needs config values).

3. **Given** path-resolution helpers (e.g., functions that resolve `output_folder`, `story_location`, `project_name`), **When** they execute, **Then** they read these values from the new config location.

4. **Given** ma-agents-owned files that are NOT BMAD-canonical (`.ma-agents.json`, `_bmad-output/project-context.md`, `lib/bmad-cache/cache-manifest.json`), **When** the changes land, **Then** their paths are unaffected — they remain where they are.

5. **Given** a repo-wide grep for `_bmad/_config/`, **When** I run it, **Then** the only matches are intentional references with explanatory comments (e.g., a backward-compatibility check that explicitly states the path is the legacy location).

6. **Given** an existing user installation with `_bmad/_config/manifest.yaml` but no `_bmad/bmm/config.yaml` (an older install upgrading), **When** the user runs `npx ma-agents install`, **Then** the installer either:
   - Migrates the old config in place into the new location, OR
   - Invokes bmad-method to regenerate the new layout
   - And NEVER reads from `_bmad/_config/manifest.yaml` silently as fallback

7. **Given** test coverage, **When** the test suite runs, **Then** at least one test asserts the new path is read and the legacy path is not used silently. The test fails if a regression reintroduces a silent read of the old path.

## Tasks / Subtasks

### Task 1: Inventory all reads of the old config path (AC: 1, 5)

- [ ] 1.1 Run `grep -rn "_bmad/_config" --include="*.js" --include="*.md" --include="*.yaml" .`
- [ ] 1.2 Categorize matches:
  - (a) Code in `lib/` that reads BMAD-canonical config — UPDATE to new path
  - (b) Skill SKILL.md files that reference the old path — UPDATE to new path
  - (c) Documentation explaining BMAD layout (historical) — UPDATE to reference new path with a note about the v6.3.0 move
  - (d) Dated history entries — LEAVE ALONE
  - (e) Backward-compat checks (none expected initially; if any are found, evaluate)
- [ ] 1.3 Document the inventory in the story's Dev Notes

### Task 2: Update lib/ code paths (AC: 1, 3)

- [ ] 2.1 For each match in category (a), update the path:
  - From: `path.join(projectRoot, '_bmad', '_config', 'manifest.yaml')`
  - To: `path.join(projectRoot, '_bmad', 'bmm', 'config.yaml')`
- [ ] 2.2 If the parsed structure differs between the old and new files (likely — a `manifest.yaml` and a `config.yaml` may have different schemas), adapt the parsing code to read the new structure
- [ ] 2.3 If a helper function wraps config reads, update the helper rather than every call site

### Task 3: Update skill SKILL.md files (AC: 2)

- [ ] 3.1 For each skill that reads config, update its `## Step 0 — Load configuration` section to point at `_bmad/bmm/config.yaml`
- [ ] 3.2 Remove any text that says "after bmad-init has loaded config" (bmad-init is being retired in Story 22.3)

### Task 4: Implement migration shim for upgrades (AC: 6)

- [ ] 4.1 In the installer (likely `lib/installer.js` or `lib/bmad.js`), add a check at the start of install:
  - If `_bmad/bmm/config.yaml` exists, proceed normally
  - Else if `_bmad/_config/manifest.yaml` exists (legacy install), either:
    - Run a one-shot migration that translates the old manifest to the new config format, OR
    - Invoke bmad-method's own setup to regenerate the new layout, AND
    - Log clearly that an upgrade migration occurred
  - Else, no prior install exists — proceed with fresh install
- [ ] 4.2 Make the migration idempotent: running the installer twice produces the same result and does not loop on the migration

### Task 5: Add test coverage (AC: 7)

- [ ] 5.1 Add a test (e.g., `test/config-path-migration.test.js`) that:
  - Sets up a scratch directory with `_bmad/bmm/config.yaml` populated
  - Invokes the config-read helper
  - Asserts the value comes from `_bmad/bmm/config.yaml`
- [ ] 5.2 Add a regression test that:
  - Sets up a scratch directory with both `_bmad/bmm/config.yaml` AND `_bmad/_config/manifest.yaml`
  - Invokes the config-read helper
  - Asserts the value comes from the new path (not the legacy path)
  - Optionally asserts a warning is logged about the legacy path being present

### Task 6: Update documentation (AC: 5)

- [ ] 6.1 Update `README.md` and `docs/` references to BMAD config paths
- [ ] 6.2 Add a note in `CHANGELOG.md` (or release notes) describing the path migration for users running upgrades
- [ ] 6.3 Update `project-context.md` template if it references the old path

### Task 7: Final grep verification (AC: 5)

- [ ] 7.1 Re-run `grep -rn "_bmad/_config" --include="*.js" --include="*.md" --include="*.yaml" .`
- [ ] 7.2 Confirm only intentional references remain (history entries, explicit backward-compat checks with comments)

## Dev Notes

### Why this change

BMAD 6.3.0 PR #2159 removed the `bmad-init` skill. Agents now read `_bmad/bmm/config.yaml` directly. The legacy `_bmad/_config/*` paths still exist in upstream output for some files but the canonical config is at the new location.

### Coordination with Story 22.3

Story 22.3 retires `bmad-init` and updates the immediate skills that called it. This story (22.7) does the broader sweep — every config read across ma-agents lib code, every skill, every doc. The two stories overlap by design; either ordering works.

### What about other files in `_bmad/_config/`?

`_bmad/_config/` may still contain other files in v6.3.0 (e.g., per-tool config). This story only changes reads of *canonical config* (the `manifest.yaml` → `config.yaml` move). If `lib/bmad.js` reads other files in `_bmad/_config/` for legitimate reasons (e.g., a per-tool override), those reads stay — capture them in the Task 1 inventory and discuss with the maintainer if uncertain.

After Story 22.6 lands, much of `_bmad/_config/` won't be created by ma-agents anyway (the manifest-surgery code that wrote there is deleted), so the surface shrinks naturally.

### Migration strategy

Two viable approaches for the upgrade shim:
1. **Translate in place** — read the old `manifest.yaml`, write a new `config.yaml` from the same values. Pro: fast, no bmad-method invocation needed. Con: requires understanding both schemas.
2. **Regenerate via bmad-method** — invoke `bmad-method install --action update` (or equivalent) and let upstream regenerate the new layout. Pro: schema-correct by definition. Con: heavier, may overwrite user-edited values.

Recommend approach (2) for simplicity and correctness, with approach (1) as a fast-path optimization if the schema mapping turns out to be trivial.

### Reference Files

- `lib/bmad.js`, `lib/installer.js` — primary code update targets
- `lib/bmad-extension/skills/*/SKILL.md` — skill content sweep
- `test/config-path-migration.test.js` — new test file
- Architecture: Decision P4-1, "Config & Path Updates" subsection
- Upstream: BMAD 6.3.0 PR #2159 (bmad-init removal motivation)

### PRD Traceability

- **FR188:** All ma-agents reads of BMAD canonical config redirected to `_bmad/bmm/config.yaml`

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
