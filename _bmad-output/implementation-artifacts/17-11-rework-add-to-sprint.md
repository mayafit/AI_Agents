# Story 17.11: Rework add-to-sprint Skill (Heavy Rework — Movement Semantics)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `add-to-sprint` skill to MOVE items from the `backlog` section to a sprint's `items` array within the same file,
So that sprint assignment is a single-file atomic operation with movement semantics.

## Acceptance Criteria

1. **Given** the `backlog` section contains unassigned items,
   **When** the Scrum Master invokes `add-to-sprint`,
   **Then** it displays the target sprint (active or planning) and its current capacity usage (items.length / capacity),
   **And** shows the top N unassigned items from the `backlog` section in priority order,
   **And** the Scrum Master selects which items to add.

2. **Given** the Scrum Master selects items for the sprint,
   **When** the items are assigned,
   **Then** each selected item is REMOVED from the `backlog` array (FR134),
   **And** ADDED to the target sprint's `items` array in the `sprints` section,
   **And** the item's `priority` field is dropped (priority only applies in backlog),
   **And** the item's other fields (`id`, `type`, `epic`, `title`, `status`) are preserved.

3. **Given** assigning items would exceed sprint capacity,
   **When** the assignment is attempted,
   **Then** the skill warns that capacity would be exceeded,
   **And** suggests removing items or increasing capacity before proceeding.

4. **Given** the skill is invoked via menu or slash command,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current add-to-sprint skill (AC: 1-4)
  - [ ] 1.1 Read `.claude/skills/add-to-sprint/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current dual-write pattern: reads backlog.yaml + sprint-N.yaml, writes both
  - [ ] 1.3 Identify the sprint selection logic (active first, then planning)

- [ ] Task 2: Modify the data source to unified sprint-status.yaml (AC: 1)
  - [ ] 2.1 Replace `Read backlog.yaml` with `Read sprint-status.yaml` and parse `backlog` section
  - [ ] 2.2 Replace `Glob sprints/sprint-*.yaml` with parsing the `sprints` section of sprint-status.yaml
  - [ ] 2.3 Build sprint list from the `sprints` map (show active first, then planning, then closed)
  - [ ] 2.4 Display unassigned items from the `backlog` array in priority order

- [ ] Task 3: Implement movement semantics (AC: 2)
  - [ ] 3.1 When an item is selected for assignment, REMOVE it from the `backlog` array
  - [ ] 3.2 DROP the `priority` field from the item
  - [ ] 3.3 APPEND the item to the target sprint's `items` array (preserving `id`, `type`, `epic`, `title`, `status`, `severity`)
  - [ ] 3.4 Perform a single atomic write to sprint-status.yaml (both removal and addition in one write)

- [ ] Task 4: Implement capacity checking (AC: 3)
  - [ ] 4.1 Calculate capacity usage: `items.length / capacity` for the target sprint
  - [ ] 4.2 Warn when adding items would exceed capacity
  - [ ] 4.3 Offer options: add anyway, skip item, or quit

- [ ] Task 5: Validate sprint target (AC: 1, 4)
  - [ ] 5.1 Validate the target sprint exists in the `sprints` section
  - [ ] 5.2 Validate sprint status is `planning` or `active` (reject `closed`)
  - [ ] 5.3 Auto-select if exactly one active sprint exists

- [ ] Task 6: Remove old dual-write pattern (AC: 2)
  - [ ] 6.1 Remove the step that writes to `backlog.yaml` (sprint field update)
  - [ ] 6.2 Remove the step that writes to `sprints/sprint-N.yaml` (items array update)
  - [ ] 6.3 Replace with single write to `sprint-status.yaml`

- [ ] Task 7: Update summary output (AC: 1-4)
  - [ ] 7.1 Update capacity display to read from unified file
  - [ ] 7.2 Update next-steps references

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The add-to-sprint skill reads from `backlog.yaml` (unassigned items) and `sprints/sprint-N.yaml` (sprint entity files). Assignment means: (1) setting `sprint: sprint-N` on the item in backlog.yaml, and (2) adding the item ID to the sprint file's `items` array. This is a dual-write that can fail partially, leaving inconsistent state.

**New behavior:** The skill reads and writes a single `sprint-status.yaml` file. Assignment means: (1) removing the item from the `backlog` array, and (2) appending it to the target sprint's `items` array. The `priority` field is dropped during the move. This is a single atomic write operation.

### Key Differences

- **No more dual-write:** Single file read-modify-write eliminates inconsistency risk
- **Movement semantics:** Items physically move between sections instead of having a `sprint` field toggled
- **Priority dropped on move:** Items in sprints don't carry a `priority` field
- **Sprint data inline:** Sprint metadata (capacity, status, dates) is in the same file, not separate files

### Skill File(s) to Modify

- `.claude/skills/add-to-sprint/SKILL.md` — complete rewrite of workflow steps

### Unified Schema Sections Touched

- **`backlog`** — read (unassigned items) + write (remove assigned items)
- **`sprints`** — read (capacity, status) + write (append items to target sprint)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema
- **Story 17.10** (prerequisite): generate-backlog populates the backlog section this skill reads from
- **Story 17.12** (inverse): remove-from-sprint is the reverse operation
- **Story 17.16** (prerequisite): add-sprint creates the sprint entries this skill assigns items to
- **Story 12.2** (original): This skill was originally created in Epic 12

### Gotchas from Current Implementation

1. The current skill uses a `sprint` field on backlog items to track assignment. In the new model, assignment is structural (item location determines assignment). The `sprint` field does not exist.
2. The current skill has a concurrency warning about backlog.yaml and sprint file writes failing independently. The new model eliminates this with single-file writes.
3. The current skill adds item IDs to the sprint's `items` array. The new model adds full item objects (with `id`, `type`, `epic`, `title`, `status`, `severity`).
4. The instruction "Do NOT read or write sprint-plan-*.yaml or sprint-status.yaml" must be reversed — sprint-status.yaml is now the primary target.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR134 (movement semantics), FR69 (add-to-sprint workflow)

### Project Structure Notes
- Skill files are in `.claude/skills/add-to-sprint/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
