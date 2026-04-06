# Sprint-Status Migration Guide

**Story:** 17.23 — Migration & Deprecation of Old File Formats
**Applies to:** Projects that adopted the old three-file sprint model before Epic 17

---

## Overview

Epic 17 replaced the old sprint management model (three separate files: `sprint-status.yaml` with
flat `development_status`, `backlog.yaml`, and `sprints/sprint-N.yaml` / `sprint-plan-*.yaml`) with a
single unified `sprint-status.yaml` containing three sections: `epics`, `backlog`, and `sprints`.

This guide walks you through running the one-time migration that:
1. Converts the old flat `development_status` map into the three-section schema
2. Imports items from `backlog.yaml` (if present)
3. Imports sprint data from `sprints/sprint-N.yaml` and `sprint-plan-*.yaml` files (if present)
4. Relocates deprecated files to a `deprecated/` folder for safe archival

---

## Pre-Migration Checklist

Before running the migration, confirm the following:

- [ ] All 13 reworked skills are deployed:
  - Story 17.10 — `generate-backlog` rework (status: done)
  - Story 17.11 — `add-to-sprint` rework (status: done)
  - Story 17.12 — `remove-from-sprint` rework (status: done)
  - Story 17.13 — `sprint-status-view` rework (status: done)
  - Story 17.14 — `cleanup-done` rework (status: done)
  - Story 17.15 — `bmad-sprint-planning` rework (status: done)
  - Story 17.16 — `add-sprint` rework (status: done)
  - Story 17.17 — `modify-sprint` rework (status: done)
  - Story 17.18 — `bmad-dev-story` rework (status: done)
  - Story 17.19 — `story-status-lookup` rework (status: done)
  - Story 17.20 — `bmad-sprint-status` rework (status: done)
  - Story 17.21 — `close-sprint` (new skill, status: done)
  - Story 17.24 — `prioritize-backlog` rework (status: done)
- [ ] All uncommitted changes to sprint management files are committed or stashed
- [ ] Node.js is available: `node --version` (any version 16+)
- [ ] You are in the project root (the directory containing `_bmad-output/`)

---

## Migration Steps

### Step 1: Run the migration script

From the project root, run:

```bash
node scripts/migrate-sprint-status.js
```

Optional: specify a custom artifacts path if your project uses a non-standard location:

```bash
node scripts/migrate-sprint-status.js --artifacts-path path/to/implementation-artifacts
```

The script will:
1. Detect the current schema (`development_status` = old, `epics/backlog/sprints` = new)
2. Back up `sprint-status.yaml` to `sprint-status.yaml.old`
3. Extract epics, retrospectives, and item statuses from `development_status`
4. Import items from `backlog.yaml` (if present)
5. Import sprints from `sprints/sprint-N.yaml` and `sprint-plan-*.yaml` (if present)
6. Write the new unified `sprint-status.yaml`
7. Relocate deprecated files to `_bmad-output/implementation-artifacts/deprecated/`
8. Write a migration report to `deprecated/migration-report.md`

### Step 2: Review the migration report

Open `_bmad-output/implementation-artifacts/deprecated/migration-report.md` and check:
- All epics are listed with correct statuses
- All stories and bugs appear in either the `backlog` section or a sprint's `items`
- Any conflicts are listed and their resolutions make sense
- Any warnings are understood (orphaned status entries, items not found in backlog)

### Step 3: Validate the new file

Run the sprint planning skill to verify the new file parses correctly:

```
/bmad-sprint-planning
```

If the file is already initialized (which it will be after migration), the skill should detect the
existing file and offer to view or update it rather than reinitializing.

### Step 4: Verify visually

Run the sprint status view to confirm the migrated data looks correct:

```
/sprint-status-view
```

Check that:
- All sprints appear with their items
- The backlog shows unassigned items
- Item statuses are correct

### Step 5: Commit the migrated files

```bash
git add _bmad-output/implementation-artifacts/sprint-status.yaml
git add _bmad-output/implementation-artifacts/deprecated/
git commit -m "chore(sprint): migrate sprint-status.yaml to unified three-section schema (Story 17.23)"
```

---

## Rollback Procedure

If anything goes wrong, you can restore the original file at any time:

1. Copy the backup back:
   ```bash
   cp _bmad-output/implementation-artifacts/sprint-status.yaml.old \
      _bmad-output/implementation-artifacts/sprint-status.yaml
   ```

2. Move files from `deprecated/` back to their original locations:
   ```bash
   # If backlog.yaml was relocated:
   mv _bmad-output/implementation-artifacts/deprecated/backlog.yaml \
      _bmad-output/implementation-artifacts/backlog.yaml

   # If sprints/ was relocated:
   mv _bmad-output/implementation-artifacts/deprecated/sprints/ \
      _bmad-output/implementation-artifacts/sprints/

   # If sprint-plan-*.yaml files were relocated:
   mv _bmad-output/implementation-artifacts/deprecated/sprint-plan-*.yaml \
      _bmad-output/implementation-artifacts/
   ```

3. The original data is never destroyed — the backup (`sprint-status.yaml.old`) and the
   `deprecated/` folder persist until you explicitly delete them.

---

## Post-Migration Verification

After running the migration, verify the following:

1. **Three-section schema present:**
   ```bash
   grep -E '^(epics|backlog|sprints):' _bmad-output/implementation-artifacts/sprint-status.yaml
   # Should output exactly three lines
   ```

2. **No old `development_status` key:**
   ```bash
   grep 'development_status' _bmad-output/implementation-artifacts/sprint-status.yaml
   # Should output nothing
   ```

3. **No legacy files in active directory:**
   ```bash
   ls _bmad-output/implementation-artifacts/backlog.yaml 2>/dev/null && echo "FOUND" || echo "Not present (good)"
   ls _bmad-output/implementation-artifacts/sprints/ 2>/dev/null && echo "FOUND" || echo "Not present (good)"
   ls _bmad-output/implementation-artifacts/sprint-plan-*.yaml 2>/dev/null && echo "FOUND" || echo "Not present (good)"
   ```

4. **Run each sprint management skill once** to verify it operates on the new format:
   - `/sprint-status-view` — should display epics, backlog, and sprint sections
   - `/add-sprint` — should add an entry to the `sprints` map
   - `/add-to-sprint` — should move items from `backlog` to `sprints[N].items`

---

## Cleanup (After Successful Verification)

After running at least one full sprint cycle using the new schema and confirming everything works:

1. **Delete the backup file** (it contains duplicate data from before migration):
   ```bash
   rm _bmad-output/implementation-artifacts/sprint-status.yaml.old
   ```

2. **Delete the deprecated folder** (old files are no longer needed):
   ```bash
   rm -rf _bmad-output/implementation-artifacts/deprecated/
   ```

3. Optionally, add `deprecated/` to `.gitignore` if you want to keep the folder locally
   but exclude it from version control:
   ```
   # In _bmad-output/implementation-artifacts/.gitignore (create if needed):
   deprecated/
   sprint-status.yaml.old
   ```

---

## Idempotency

The migration script is idempotent:

- If the new schema is already in use AND no legacy files exist → exits with "No migration needed"
- If the new schema is already in use BUT legacy files still exist → only relocates legacy files
- If the old schema is detected → performs full migration

Running the script a second time after successful migration is safe and will report "No migration needed".

---

## Conflict Resolution

When an item appears in multiple old files with different statuses, the script uses this priority:

| Source 1 | Source 2 | Winner |
|----------|----------|--------|
| `development_status` | `backlog.yaml` | `development_status` |
| `development_status` | `sprint-plan-*.yaml` | `development_status` |
| `backlog.yaml` | `sprint-plan-*.yaml` | Sprint file (for placement); `development_status` for status |

All conflicts are logged in `deprecated/migration-report.md`.

---

## Support

- Schema specification: `_bmad-output/planning-artifacts/sprint-status-schema.md`
- Story file: `_bmad-output/implementation-artifacts/17-23-migration-deprecation-old-files.md`
- Architecture decision: `_bmad-output/planning-artifacts/architecture.md` (Decision P2-11)
