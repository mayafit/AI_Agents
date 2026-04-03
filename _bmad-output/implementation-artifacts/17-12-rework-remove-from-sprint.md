# Story 17.12: Rework remove-from-sprint Skill (Heavy Rework — Movement Semantics)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `remove-from-sprint` skill to MOVE items from a sprint's `items` array back to the `backlog` section,
So that sprint scope adjustments are clean, reversible, single-file operations.

## Acceptance Criteria

1. **Given** a sprint has assigned items,
   **When** the Scrum Master invokes `remove-from-sprint`,
   **Then** it displays the sprint's currently assigned items with their statuses,
   **And** the Scrum Master selects which items to remove.

2. **Given** items are removed from the sprint,
   **When** the removal completes,
   **Then** each selected item is REMOVED from the sprint's `items` array (FR134),
   **And** ADDED back to the `backlog` array with a `priority` field set to position 1 (top of backlog — Scrum Master can reprioritize later),
   **And** the item's `status` is NOT changed — it retains its current status (e.g., stays `ready-for-dev`).

3. **Given** a sprint's capacity was full (e.g., 6/6 items),
   **When** an item is removed,
   **Then** the sprint's effective capacity usage decreases (e.g., 5/6).

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current remove-from-sprint skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/remove-from-sprint/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current dual-write pattern: reads backlog.yaml + sprint-N.yaml, writes both
  - [ ] 1.3 Identify the concurrency guard pattern (last_modified check)

- [ ] Task 2: Modify the data source to unified sprint-status.yaml (AC: 1)
  - [ ] 2.1 Replace `Glob sprints/sprint-*.yaml` with parsing the `sprints` section of sprint-status.yaml
  - [ ] 2.2 Build sprint list from the `sprints` map, filter to sprints with at least 1 item
  - [ ] 2.3 Display selected sprint's items with full metadata from the inline `items` array
  - [ ] 2.4 No need to cross-reference backlog.yaml for item metadata (items carry their own metadata in sprints)

- [ ] Task 3: Implement reverse movement semantics (AC: 2)
  - [ ] 3.1 When items are removed, REMOVE them from the sprint's `items` array
  - [ ] 3.2 ADD a `priority` field set to 1 (top of backlog) on each removed item
  - [ ] 3.3 Re-number existing backlog items' priorities to accommodate the insertions at position 1
  - [ ] 3.4 APPEND the items to the `backlog` array (at the top, with priority 1)
  - [ ] 3.5 Preserve the item's `status` unchanged (do NOT reset to `backlog`)
  - [ ] 3.6 Perform a single atomic write to sprint-status.yaml

- [ ] Task 4: Update capacity display (AC: 3)
  - [ ] 4.1 Show capacity usage before and after removal
  - [ ] 4.2 Calculate from `items.length / capacity`

- [ ] Task 5: Simplify concurrency handling (AC: 1-3)
  - [ ] 5.1 The current skill has a concurrency guard comparing `last_modified` timestamps. Evaluate whether this is still needed with single-file operations.
  - [ ] 5.2 If retained, adapt to use `last_updated` from the unified file's top-level metadata

- [ ] Task 6: Remove old dual-write pattern (AC: 2)
  - [ ] 6.1 Remove the step that writes to `sprints/sprint-N.yaml`
  - [ ] 6.2 Remove the step that writes to `backlog.yaml`
  - [ ] 6.3 Replace with single write to `sprint-status.yaml`

- [ ] Task 7: Update summary output (AC: 1-3)
  - [ ] 7.1 Update capacity display to read from unified file
  - [ ] 7.2 Update next-steps references

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The remove-from-sprint skill reads sprint items from `sprints/sprint-N.yaml` and metadata from `backlog.yaml`. Removal means: (1) removing the item ID from the sprint file's `items` array, and (2) setting `sprint: null` on the item in backlog.yaml. Includes a concurrency guard using `last_modified` timestamps on the sprint file.

**New behavior:** The skill reads and writes a single `sprint-status.yaml` file. Removal means: (1) removing the item object from the sprint's `items` array, and (2) inserting it into the `backlog` array at priority position 1 with a `priority` field added. Status is preserved. Single atomic write operation.

### Key Differences

- **No more dual-write:** Single file read-modify-write
- **Item metadata available inline:** Sprint items in the unified model carry their own metadata (title, type, epic, status, severity), so no cross-reference to backlog.yaml needed
- **Priority re-insertion:** Removed items enter backlog at priority 1, pushing existing items down
- **Concurrency guard simplified:** Single file means simpler conflict detection

### Skill File(s) to Modify

- `.claude/skills/remove-from-sprint/SKILL.md` — complete rewrite of workflow steps

### Unified Schema Sections Touched

- **`sprints`** — read (list sprints with items) + write (remove items from sprint's `items` array)
- **`backlog`** — write (insert removed items at top with priority 1, re-number existing)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema
- **Story 17.11** (inverse): add-to-sprint is the forward operation; this is the reverse
- **Story 17.16** (prerequisite): add-sprint creates the sprint entries
- **Original implementation**: Reworks the remove-from-sprint skill from Epic 12

### Gotchas from Current Implementation

1. The current skill sets `sprint: null` on the backlog item. In the new model, the `sprint` field does not exist — assignment is structural (which section the item is in).
2. The current skill reads item metadata from backlog.yaml to display titles. In the new model, items carry their own metadata in the sprint's `items` array.
3. The current skill has a concurrency guard that re-reads the sprint file before writing. This pattern should be simplified since we are now reading/writing a single file.
4. When items re-enter backlog at priority 1, all existing backlog items must have their priorities re-numbered (shifted by the count of items being re-inserted).

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR134 (movement semantics), FR70 (modify-sprint/remove operations)

### Project Structure Notes
- Skill files are in `.claude/skills/remove-from-sprint/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
