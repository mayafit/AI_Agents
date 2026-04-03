# Story 17.17: Rework modify-sprint Skill (Moderate Rework — Section-Based)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `modify-sprint` skill to update sprint metadata within the `sprints` section of `sprint-status.yaml`,
So that sprint adjustments (capacity, dates, name, status) are made in the unified file.

## Acceptance Criteria

1. **Given** the Scrum Master invokes `modify-sprint` with a target sprint ID,
   **When** the sprint exists in the `sprints` section,
   **Then** the skill allows modification of: `name`, `capacity`, `start`, `end`, `status`,
   **And** the updated sprint is written back to `sprint-status.yaml`.

2. **Given** the Scrum Master changes a sprint's `status` to `active`,
   **When** another sprint is already `active`,
   **Then** the skill warns that only one sprint can be active,
   **And** requires the existing active sprint to be closed first (or offers to close it).

3. **Given** the Scrum Master reduces capacity below the current item count,
   **When** the modification is attempted,
   **Then** the skill warns: "Sprint has N items but new capacity is M (M < N). Remove items first.",
   **And** does NOT apply the capacity change until items are removed.

## Tasks / Subtasks

- [ ] Task 1: Read and understand current modify-sprint skill (AC: 1)
  - [ ] 1.1 Read `.claude/skills/modify-sprint/SKILL.md` — understand the current workflow steps, triggers, and output format
  - [ ] 1.2 Document what file paths and data structures the skill currently reads/writes (currently reads `sprints/sprint-*.yaml` files)
  - [ ] 1.3 Identify the "partially reworked" state — item assignment/removal already delegated to add-to-sprint/remove-from-sprint
- [ ] Task 2: Rewrite file I/O to use unified sprint-status.yaml (AC: 1)
  - [ ] 2.1 Change sprint discovery from globbing `sprints/sprint-*.yaml` to reading the `sprints` section of `sprint-status.yaml`
  - [ ] 2.2 Change sprint display to iterate the `sprints` map (keys are sprint IDs, values have `name`, `status`, `capacity`, `items` array)
  - [ ] 2.3 Change sprint write-back from writing individual `sprints/sprint-N.yaml` to updating the sprint entry in-place in `sprint-status.yaml`
  - [ ] 2.4 Ensure read-modify-write preserves all other sections (`epics`, `backlog`, other sprints)
- [ ] Task 3: Implement modifiable fields (AC: 1)
  - [ ] 3.1 Allow modification of `name` (string)
  - [ ] 3.2 Allow modification of `capacity` (integer) with validation (see Task 4)
  - [ ] 3.3 Allow modification of `start` and `end` (ISO date strings)
  - [ ] 3.4 Allow modification of `status` with transition validation (see Task 5)
- [ ] Task 4: Implement capacity validation guard (AC: 3)
  - [ ] 4.1 Before applying a capacity change, compare new capacity with `items.length`
  - [ ] 4.2 If new capacity < items.length, display warning and reject the change
  - [ ] 4.3 Suggest using `/remove-from-sprint` to reduce items first
- [ ] Task 5: Implement single-active-sprint guard (AC: 2)
  - [ ] 5.1 When status is changed to `active`, scan all other sprints in the `sprints` section
  - [ ] 5.2 If another sprint has `status: active`, display warning with the active sprint's name and ID
  - [ ] 5.3 Offer to close the existing active sprint or cancel the activation
  - [ ] 5.4 Enforce valid status transitions: `planning` -> `active` -> `closed` (no backward transitions without explicit override)
- [ ] Task 6: Remove legacy file paths and references (AC: 1)
  - [ ] 6.1 Remove all references to `sprints/sprint-*.yaml` file paths
  - [ ] 6.2 Remove all references to `sprint-plan-*.yaml` file paths
  - [ ] 6.3 Update the "partially reworked" comment to reflect full rework completion

## Dev Notes

### What This Story Changes vs Current Behavior

The current `modify-sprint` skill is in a "partially reworked" state:
- Item assignment/removal were already delegated to `/add-to-sprint` and `/remove-from-sprint`
- Sprint activation (`planning` -> `active`) works but reads from individual `sprints/sprint-*.yaml` files
- Other operations still reference legacy `sprint-plan-{n}.yaml` paths
- The skill globs the filesystem to discover sprints

After this rework:
- All sprint data is read from and written to the `sprints` section of `sprint-status.yaml`
- No filesystem globbing needed — sprints are entries in a YAML map
- All modifiable fields (`name`, `capacity`, `start`, `end`, `status`) are handled
- Capacity and single-active-sprint guards are enforced

### Skill Files to Modify

- `.claude/skills/modify-sprint/SKILL.md` — the main (and only) file for this skill; contains the full workflow inline

### Unified Schema Sections Touched

- **`sprints`** — reads sprint entries to display, modifies sprint metadata in-place, writes back
- Does NOT touch `epics` or `backlog` sections (read-modify-write must preserve them)

### Cross-References

- **Story 17.9** (schema) — defines the `sprints` map schema this skill reads/writes
- **Story 17.16** (add-sprint) — creates the sprint entries this skill modifies; must use same sprint ID format (`sprint-{N}`)
- **Story 17.11** (add-to-sprint) — handles item assignment (not this skill's responsibility)
- **Story 17.12** (remove-from-sprint) — handles item removal (not this skill's responsibility)
- **Story 17.21** (close-sprint) — full sprint closure lifecycle; modify-sprint can set status to `closed` but close-sprint handles item disposition

### Gotchas from Current Implementation

- The current skill has TWO glob patterns: `sprints/sprint-*.yaml` (step 3e) and `sprint-plan-*.yaml` (step 1) — both are legacy and must be replaced
- The "partially reworked" comment at the top of the file must be removed or updated
- The step numbering starts at `3e` (the activation step) before `1` — this may cause confusion; consider renormalizing

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD: FR134 (movement semantics), sprint lifecycle states (planning -> active -> closed)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
