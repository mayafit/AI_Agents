# Story 17.23: Migration and Deprecation of Old Files

Status: ready-for-dev

## Story

As a **DevOps Engineer**,
I want the old three-file sprint model (`backlog.yaml`, `sprints/sprint-N.yaml`, `sprint-status.yaml` with old schema) automatically migrated to the unified `sprint-status.yaml`,
So that existing projects transition cleanly without data loss.

## Acceptance Criteria

1. **Given** a project has the old `backlog.yaml` file,
   **When** `bmad-sprint-planning` is run (Story 17.15) and `sprint-status.yaml` does not yet exist (or has the old schema),
   **Then** the migration reads `backlog.yaml` and imports all items into the `backlog` section of the new unified `sprint-status.yaml`,
   **And** priority ordering from the old file is preserved.

2. **Given** a project has old `sprints/sprint-N.yaml` files,
   **When** the migration runs,
   **Then** each sprint file is imported as an entry in the `sprints` section of `sprint-status.yaml`,
   **And** items referenced in old sprint files are matched to backlog items and moved to the sprint's `items` array.

3. **Given** the old `sprint-status.yaml` exists with the old schema (flat `development_status` list),
   **When** the migration detects the old format,
   **Then** it extracts item statuses from the old file and applies them to the corresponding items in the new schema,
   **And** the old file is backed up to `sprint-status.yaml.bak` before overwriting with the new schema.

4. **Given** the migration completes successfully,
   **When** the new `sprint-status.yaml` is verified,
   **Then** the old files are removed:
   - `backlog.yaml` is deleted,
   - `sprints/` directory is deleted (if empty after migration),
   - `sprint-status.yaml.bak` is preserved for 1 sprint cycle (manual deletion).

5. **Given** the migration encounters conflicts (e.g., item in old backlog with different status than old sprint-status),
   **When** the conflict is detected,
   **Then** the migration logs the conflict and uses the most recent status (from sprint-status.yaml or sprint file, whichever was modified last),
   **And** a migration report is generated listing all conflicts and resolutions.

## Tasks / Subtasks

- [ ] Task 1: Implement old-schema detection (AC: 3)
  - [ ] 1.1 Read `sprint-status.yaml` — check for `development_status` top-level key (old schema) vs `epics`/`backlog`/`sprints` keys (new schema)
  - [ ] 1.2 Check for existence of `backlog.yaml` in the implementation-artifacts directory
  - [ ] 1.3 Check for existence of `sprints/` directory with `sprint-*.yaml` files
  - [ ] 1.4 If new schema already detected and no legacy files exist, skip migration entirely
- [ ] Task 2: Backup old sprint-status.yaml (AC: 3)
  - [ ] 2.1 If old-schema `sprint-status.yaml` exists, copy it to `sprint-status.yaml.bak`
  - [ ] 2.2 Log the backup creation with timestamp
- [ ] Task 3: Migrate backlog.yaml items (AC: 1)
  - [ ] 3.1 Read and parse `backlog.yaml`
  - [ ] 3.2 Map each backlog item to the unified item schema: `id`, `type`, `epic`, `title`, `priority`, `status`, `severity`
  - [ ] 3.3 Preserve the priority ordering from the old file
  - [ ] 3.4 Write items to the `backlog` section of the new `sprint-status.yaml`
- [ ] Task 4: Migrate sprint files (AC: 2)
  - [ ] 4.1 Glob `sprints/sprint-*.yaml` to find all old sprint files
  - [ ] 4.2 For each sprint file, extract: id, name, status, capacity, start, end, and assigned items
  - [ ] 4.3 Map each sprint to the unified sprint schema entry in the `sprints` section
  - [ ] 4.4 Move items referenced in sprint files from the backlog import to the sprint's `items` array (movement semantics — no duplication)
- [ ] Task 5: Apply statuses from old sprint-status.yaml (AC: 3, 5)
  - [ ] 5.1 Parse the `development_status` flat map from the old sprint-status.yaml
  - [ ] 5.2 For each item in the new schema, find its corresponding status in the old flat map
  - [ ] 5.3 If the old status conflicts with the status from backlog.yaml or sprint files, use the most recent (based on file modification timestamps)
  - [ ] 5.4 Log all conflicts and their resolutions
- [ ] Task 6: Build the epics section (AC: 1-3)
  - [ ] 6.1 Extract epic statuses from the old `development_status` flat map (keys starting with `epic-`)
  - [ ] 6.2 Extract retrospective statuses (keys ending with `-retrospective`)
  - [ ] 6.3 Write the `epics` map to the new schema
- [ ] Task 7: Write the unified file and clean up (AC: 4)
  - [ ] 7.1 Write the complete new `sprint-status.yaml` with all three sections populated
  - [ ] 7.2 Delete `backlog.yaml`
  - [ ] 7.3 Delete `sprints/` directory if empty after migration
  - [ ] 7.4 Preserve `sprint-status.yaml.bak` (manual deletion after verification)
- [ ] Task 8: Generate migration report (AC: 5)
  - [ ] 8.1 List all items migrated with their source (backlog.yaml, sprint file, or sprint-status.yaml)
  - [ ] 8.2 List all conflicts detected and their resolutions
  - [ ] 8.3 List all files deleted and backed up
  - [ ] 8.4 Output the report to the console/chat for the user to review
- [ ] Task 9: Ensure idempotency (AC: 1-5)
  - [ ] 9.1 Verify that running the migration twice produces the same result
  - [ ] 9.2 If the new schema is already present, skip migration entirely
  - [ ] 9.3 If legacy files no longer exist, skip migration entirely

## Dev Notes

### What This Story Changes vs Current Behavior

Currently, the project has three separate files for sprint management:
1. `backlog.yaml` — flat prioritized list of stories/bugs
2. `sprints/sprint-N.yaml` — individual sprint entity files with assigned items
3. `sprint-status.yaml` — flat `development_status` map with story/epic statuses

After migration:
- All data is consolidated into the unified `sprint-status.yaml` with `epics`, `backlog`, and `sprints` sections
- Old files are deleted (with backup)
- Subsequent sprint management operations use only the unified file

### Where the Migration Logic Lives

The migration runs as part of `bmad-sprint-planning` (Story 17.15) — NOT as a separate skill. When `bmad-sprint-planning` detects legacy files or old schema, it runs the migration before proceeding with normal planning.

### Skill Files to Modify

- `.claude/skills/bmad-sprint-planning/` — the migration logic is integrated into the sprint-planning workflow (see Story 17.15)
- No standalone migration skill is created

### Unified Schema Sections Touched

- **All sections** — the migration creates the entire unified file from scratch
- **`epics`** — populated from old `development_status` epic entries
- **`backlog`** — populated from old `backlog.yaml`
- **`sprints`** — populated from old `sprints/sprint-N.yaml` files

### Cross-References

- **Story 17.9** (schema) — the target schema for the migration output
- **Story 17.15** (bmad-sprint-planning) — the migration logic is embedded in this skill's workflow
- **Story 17.10** (generate-backlog) — after migration, this skill writes to the `backlog` section (no longer to `backlog.yaml`)
- **Story 17.24** (prioritize-backlog) — after migration, this skill reads/writes the `backlog` section (ignores old `backlog.yaml`)

### Gotchas

- The old `sprint-status.yaml` has a flat `development_status` map where keys like `epic-1`, `1-1-ci-cd-yes-flag`, and `epic-1-retrospective` are all in the same namespace — the migration must correctly classify each key type
- The old `backlog.yaml` may have items that were also referenced in sprint files — the migration must deduplicate (item goes to the sprint, not duplicated in backlog)
- Status conflicts between files are resolved by file modification timestamp — document this clearly in the migration report
- The migration must be idempotent: running it when the new schema already exists should be a no-op
- The `sprint-status.yaml.bak` backup is preserved for manual deletion — do not auto-delete it

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md` — Migration from 3-file model section
- PRD: FR133 (unified file), FR134 (movement semantics)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Old backlog at `_bmad-output/implementation-artifacts/backlog.yaml`
- Old sprints at `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
