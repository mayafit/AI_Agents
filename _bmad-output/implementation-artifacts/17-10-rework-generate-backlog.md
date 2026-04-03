# Story 17.10: Rework generate-backlog Skill (Heavy Rework)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `generate-backlog` skill to populate the `backlog` section of the unified `sprint-status.yaml`,
So that all unassigned stories and bugs are maintained in a single file rather than a separate `backlog.yaml`.

## Acceptance Criteria

1. **Given** the `generate-backlog` skill is invoked,
   **When** it parses the epics document,
   **Then** it writes all unassigned stories and bugs to the `backlog` section of `sprint-status.yaml` in priority order,
   **And** it updates the `epics` section with current epic metadata (title, status, story counts),
   **And** it does NOT touch the `sprints` section — sprint-assigned items are preserved.

2. **Given** items already exist in the `sprints` section of `sprint-status.yaml`,
   **When** the backlog is regenerated,
   **Then** items currently assigned to sprints are NOT duplicated in the `backlog` section,
   **And** new stories from `epics.md` that don't exist anywhere in `sprint-status.yaml` are added to `backlog`.

3. **Given** a story exists in `backlog` but has been removed from `epics.md`,
   **When** the backlog is regenerated,
   **Then** the orphaned item is flagged with a warning but NOT automatically removed (human review required).

4. **Given** bugs exist as standalone story files (FR64),
   **When** the backlog is regenerated,
   **Then** bugs are included in the `backlog` section with `type: bug` and `epic: null`,
   **And** bug-specific fields (`severity`, `version_found`, `bug_type`) are preserved.

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current generate-backlog skill (AC: 1-4)
  - [ ] 1.1 Read `.claude/skills/generate-backlog/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current data flow: epics.md -> backlog.yaml (standalone file)
  - [ ] 1.3 Identify all data sources: epics.md, bug-*.md files, existing sprint-status.yaml

- [ ] Task 2: Modify the skill to read unified sprint-status.yaml (AC: 1, 2)
  - [ ] 2.1 Replace the `Read backlog.yaml` step with `Read sprint-status.yaml`
  - [ ] 2.2 Parse the existing `sprints` section to build a set of already-assigned item IDs
  - [ ] 2.3 Parse the existing `backlog` section for merge (preserve priority on existing items)
  - [ ] 2.4 Parse the existing `epics` section for merge

- [ ] Task 3: Modify the skill to write to unified sprint-status.yaml (AC: 1, 2, 3, 4)
  - [ ] 3.1 Replace the `Write backlog.yaml` output with write to `sprint-status.yaml` `backlog` section
  - [ ] 3.2 Update the `epics` section with refreshed epic metadata from epics.md
  - [ ] 3.3 Preserve the `sprints` section unchanged (read-modify-write pattern)
  - [ ] 3.4 Preserve top-level metadata fields (`generated`, `project`, `tracking_system`, etc.)
  - [ ] 3.5 Update `last_updated` timestamp

- [ ] Task 4: Handle sprint-assigned item exclusion (AC: 2)
  - [ ] 4.1 Build a set of all item IDs found in any `sprints[].items` array
  - [ ] 4.2 Exclude those IDs from the `backlog` section output
  - [ ] 4.3 Ensure new stories from epics.md not in any section are added to backlog

- [ ] Task 5: Handle orphaned items (AC: 3)
  - [ ] 5.1 Detect items in existing `backlog` whose IDs don't appear in epics.md or bug files
  - [ ] 5.2 Flag orphaned items with a warning message in the output
  - [ ] 5.3 Keep orphaned items in the backlog (do not auto-remove)

- [ ] Task 6: Handle bugs (AC: 4)
  - [ ] 6.1 Glob for `bug-*.md` files and parse YAML frontmatter
  - [ ] 6.2 Include bugs in the `backlog` section with `type: bug`, `epic: null`
  - [ ] 6.3 Preserve bug-specific fields (`severity`)

- [ ] Task 7: Priority ordering (AC: 1)
  - [ ] 7.1 Implement priority sort: critical bugs first, then by explicit priority, then by epic order
  - [ ] 7.2 Re-number priorities sequentially 1..N

- [ ] Task 8: Remove old backlog.yaml write (AC: 1)
  - [ ] 8.1 Remove the step that writes standalone `backlog.yaml`
  - [ ] 8.2 Update the summary output to reference sprint-status.yaml instead

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The generate-backlog skill writes a standalone `_bmad-output/implementation-artifacts/backlog.yaml` file containing all unassigned stories and bugs. It reads sprint-status.yaml only for status lookup, and backlog.yaml is a separate data store.

**New behavior:** The generate-backlog skill writes to the `backlog` section of `sprint-status.yaml` directly. It must also update the `epics` section. The `sprints` section is preserved unchanged. The standalone `backlog.yaml` file is no longer written (migration handled by Story 17.23).

### Key Differences

- **Output target:** `backlog.yaml` (standalone) -> `sprint-status.yaml` `backlog` section
- **Sprint-assigned item exclusion:** Must read the `sprints` section to identify items already assigned to sprints and exclude them from backlog
- **Epics section:** Must update the `epics` section with epic metadata (status, retrospective) derived from epics.md
- **Orphan detection:** New requirement to flag items in backlog that no longer exist in source files
- **Atomic write:** Single file write to sprint-status.yaml (read-modify-write pattern) instead of standalone file write

### Skill File(s) to Modify

- `.claude/skills/generate-backlog/SKILL.md` — primary skill file, complete rewrite of workflow steps

### Unified Schema Sections Touched

- **`backlog`** — primary write target (full replacement of items not in sprints)
- **`epics`** — updated with refreshed epic metadata
- **`sprints`** — read-only (used to identify sprint-assigned items for exclusion)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema this skill writes to
- **Story 17.15** (dependency): bmad-sprint-planning bootstraps the file; generate-backlog refreshes the backlog section
- **Story 17.23** (future): Migration story that deprecates the old `backlog.yaml` file
- **Story 17.24** (downstream): prioritize-backlog will reorder items in the backlog section

### Gotchas from Current Implementation

1. The current skill writes a `sprint` field on each backlog item (e.g., `sprint: sprint-3`). In the unified model, sprint assignment is structural — items in a sprint's `items` array are "assigned." The `sprint` field on backlog items is removed.
2. The current merge logic preserves `sprint` and `priority` from existing backlog entries. In the new model, only `priority` needs preserving (sprint-assigned items are excluded entirely).
3. The current skill defaults new item status to `backlog`. This remains correct for the new model.
4. Priority ordering rules change: critical bugs float to top, then by explicit `priority`, then by epic order.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR133 (unified file), FR134 (movement semantics), FR64 (bug stories in backlog)

### Project Structure Notes
- Skill files are in `.claude/skills/generate-backlog/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
