# Story 17.24: Rework prioritize-backlog Skill for Unified File

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `prioritize-backlog` skill to read and write the `backlog` section of the unified `sprint-status.yaml`,
So that backlog reprioritization works against the single source of truth instead of the deprecated standalone `backlog.yaml` file.

## Acceptance Criteria

1. **Given** the `prioritize-backlog` skill is invoked,
   **When** the unified `sprint-status.yaml` exists,
   **Then** it reads items from the `backlog` section only (items already assigned to a sprint keep their priority and are NOT reprioritized).

2. **Given** the Scrum Master reorders or adjusts priority values,
   **When** the reprioritization is applied,
   **Then** the skill writes updated `priority` values back to the `backlog` section of `sprint-status.yaml`,
   **And** all other sections (`epics`, `sprints`) are preserved unchanged.

3. **Given** items exist in both `backlog` and `sprints` sections,
   **When** the skill displays items for prioritization,
   **Then** only `backlog` items are shown — sprint-assigned items are excluded from the prioritization view.

4. **Given** the old `backlog.yaml` file exists but `sprint-status.yaml` also exists,
   **When** the skill is invoked,
   **Then** it operates on `sprint-status.yaml` only (the old file is ignored; see Story 17.23 for migration).

## Tasks / Subtasks

- [ ] Task 1: Read and understand current prioritize-backlog skill (AC: 1-4)
  - [ ] 1.1 Read `.claude/skills/prioritize-backlog/SKILL.md` — understand the full workflow (steps 1-5)
  - [ ] 1.2 Document the current file I/O: reads `backlog.yaml`, writes `backlog.yaml`
  - [ ] 1.3 Document the three prioritization modes: full reprioritization, quick adjust, auto-suggest
  - [ ] 1.4 Document the dependency validation logic (step 4)
  - [ ] 1.5 Document the confirmation and persist logic (step 5)
- [ ] Task 2: Rewrite Step 1 (load backlog) for unified schema (AC: 1, 3, 4)
  - [ ] 2.1 Change the file read from `backlog.yaml` to `sprint-status.yaml`
  - [ ] 2.2 Extract only the `backlog` section items — ignore `sprints` and `epics` sections
  - [ ] 2.3 If `sprint-status.yaml` does not exist, display "No sprint-status.yaml found. Nothing to prioritize." and exit
  - [ ] 2.4 If the `backlog` section is empty, display "Backlog is empty. Nothing to prioritize." and exit
  - [ ] 2.5 If old `backlog.yaml` exists alongside `sprint-status.yaml`, ignore the old file (log a note that migration should be run)
- [ ] Task 3: Preserve core prioritization logic (AC: 1, 2)
  - [ ] 3.1 Keep Step 2 (display current backlog ordering) unchanged — just ensure it reads from the correct data source
  - [ ] 3.2 Keep Step 3 (choose prioritization mode) unchanged — all three modes work the same
  - [ ] 3.3 Keep Step 3a (full reprioritization) unchanged
  - [ ] 3.4 Keep Step 3b (quick adjust) unchanged
  - [ ] 3.5 Keep Step 3c (auto-suggest) unchanged — weighted criteria (blocking dependencies, severity, business value, type priority, age) remain the same
  - [ ] 3.6 Keep Step 4 (dependency validation) unchanged
- [ ] Task 4: Rewrite Step 5 (persist) for unified schema (AC: 2)
  - [ ] 4.1 Change the file write from `backlog.yaml` to `sprint-status.yaml`
  - [ ] 4.2 Update only the `backlog` section with the reordered items and updated `priority` values
  - [ ] 4.3 Preserve all other sections (`epics`, `sprints`) unchanged during the write
  - [ ] 4.4 Update `last_updated` timestamp on `sprint-status.yaml`
- [ ] Task 5: Update display to exclude sprint-assigned items (AC: 3)
  - [ ] 5.1 Ensure the backlog display table does NOT show items from any sprint's `items` array
  - [ ] 5.2 Remove the `Sprint` column from the display table (backlog items are by definition unassigned)
  - [ ] 5.3 If the user asks about an item that is sprint-assigned, note that it is in a sprint and not available for backlog reprioritization
- [ ] Task 6: Remove legacy file references (AC: 4)
  - [ ] 6.1 Remove all references to `backlog.yaml` as a read/write target
  - [ ] 6.2 Update the file path in the workflow to `sprint-status.yaml`
  - [ ] 6.3 Remove or update any comments referencing the old file format

## Dev Notes

### What This Story Changes vs Current Behavior

The current `prioritize-backlog` skill reads and writes `backlog.yaml`:
- Step 1: reads `_bmad-output/implementation-artifacts/backlog.yaml`
- Step 5: writes the reordered items back to `backlog.yaml`
- The display includes a `Sprint` column (items may have a `sprint` field)

After this rework:
- Step 1: reads the `backlog` section from `sprint-status.yaml`
- Step 5: writes the reordered `backlog` section back to `sprint-status.yaml` (preserving other sections)
- Sprint-assigned items are NOT shown (they live in `sprints[].items`, not `backlog`)
- The `Sprint` column is removed from the display (all displayed items are unassigned)
- The old `backlog.yaml` is ignored if it exists alongside the unified file

This is a **light rework** because:
- The core prioritization logic (3 modes, weighted criteria, dependency validation) is completely unchanged
- Only the file I/O layer changes (which file to read from/write to)
- The display changes are minimal (remove Sprint column, scope to backlog section only)

### Skill Files to Modify

- `.claude/skills/prioritize-backlog/SKILL.md` — the single file for this skill; contains all workflow steps inline

### Unified Schema Sections Touched

- **`backlog`** — read for items, write back with updated priorities (read-write)
- **`epics`** — NOT modified, must be preserved during read-modify-write
- **`sprints`** — NOT modified, must be preserved during read-modify-write; may be read to load dependency data from epics.md

### Cross-References

- **Story 17.9** (schema) — defines the `backlog` array item schema with `priority` field
- **Story 17.10** (generate-backlog) — populates the `backlog` section that this skill reprioritizes
- **Story 17.11** (add-to-sprint) — moves items from backlog to sprints; after reprioritization, the top items are candidates for sprint assignment
- **Story 17.23** (migration) — migrates old `backlog.yaml` to the unified file; this skill should work with the migrated data
- **FRs:** FR133 (unified file), FR134 (movement semantics — prioritization respects section boundaries)

### Gotchas from Current Implementation

- The current Step 1 reads `backlog.yaml` — the error message for "file missing" needs to reference `sprint-status.yaml` instead
- The current display table has a `Sprint` column — this needs to be removed since backlog items are by definition not in a sprint
- The dependency inference logic (same epic = sequential) should use the `epic` field on items, which is already present in the unified schema
- The auto-suggest mode reads `epics.md` for explicit dependencies — this should continue to work unchanged
- The write-back (Step 5) must be a careful merge: only the `backlog` section is rewritten; `epics` and `sprints` sections are read and preserved verbatim

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD: FR133 (unified file), FR134 (movement semantics — prioritization respects section boundaries)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
