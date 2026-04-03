# Story 17.18: Rework bmad-dev-story Skill (Moderate Rework — Cross-Section Status Update)

Status: ready-for-dev

## Story

As a **Developer**,
I want the `bmad-dev-story` skill to update story status in-place within `sprint-status.yaml` regardless of which section the story resides in,
So that development progress is reflected in the unified file without manual status updates.

## Acceptance Criteria

1. **Given** a developer starts working on a story via `bmad-dev-story`,
   **When** the story transitions from `ready-for-dev` to `in-progress`,
   **Then** the skill finds the item in `sprint-status.yaml` (searching both `backlog` and all `sprints[].items`),
   **And** updates the item's `status` field in-place (FR135).

2. **Given** a developer completes a story,
   **When** the story transitions to `review` or `done`,
   **Then** the status is updated in-place in whichever section the item currently resides,
   **And** if the status becomes `done`, the cleanup-done logic can be triggered (or deferred to explicit cleanup).

3. **Given** the story ID is not found in `sprint-status.yaml`,
   **When** the skill attempts to update status,
   **Then** it reports: "Story {id} not found in sprint-status.yaml. It may have been archived to done/ or not yet added to the backlog."

## Tasks / Subtasks

- [ ] Task 1: Read and understand current bmad-dev-story skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/bmad-dev-story/SKILL.md` and `.claude/skills/bmad-dev-story/workflow.md`
  - [ ] 1.2 Document the current story discovery logic in Step 1 (sprint-based discovery via `development_status` flat map)
  - [ ] 1.3 Document the current status update logic — where and how it writes status changes
  - [ ] 1.4 Identify all places the workflow reads/writes `sprint-status.yaml`
- [ ] Task 2: Rewrite story discovery to search unified schema (AC: 1)
  - [ ] 2.1 Replace the flat `development_status` key lookup with a cross-section search
  - [ ] 2.2 Search the `backlog` array for items matching the story ID
  - [ ] 2.3 Search all sprint `items` arrays (iterate `sprints` map entries, then each sprint's `items` array)
  - [ ] 2.4 Return both the item and its location context (e.g., "in backlog" or "in sprint-3")
- [ ] Task 3: Rewrite status update to in-place modification (AC: 1, 2)
  - [ ] 3.1 When story transitions to `in-progress`, find the item in whichever section it resides and update `status` in-place
  - [ ] 3.2 When story transitions to `review` or `done`, update `status` in-place in the same location
  - [ ] 3.3 Ensure read-modify-write preserves ALL other fields on the item (id, type, epic, title, priority, severity)
  - [ ] 3.4 Ensure read-modify-write preserves ALL other sections of sprint-status.yaml
- [ ] Task 4: Implement not-found handling (AC: 3)
  - [ ] 4.1 If the story ID is not found in any section, check the `done/` archive folder for the story file
  - [ ] 4.2 If found in `done/`, report "Story {id} has been archived (done)"
  - [ ] 4.3 If not found anywhere, report the error message from AC 3
- [ ] Task 5: Update story discovery for first-ready-story (AC: 1)
  - [ ] 5.1 Update the "find first ready-for-dev story" logic to search both `backlog` and all sprint `items` arrays
  - [ ] 5.2 Prioritize sprint-assigned items over backlog items when auto-discovering the next story
  - [ ] 5.3 Preserve the existing story key derivation logic (filename, branch name, explicit reference)
- [ ] Task 6: Remove legacy flat-map references (AC: 1-3)
  - [ ] 6.1 Remove all references to `development_status` flat map parsing
  - [ ] 6.2 Update key matching patterns from flat map key lookup to array item search
  - [ ] 6.3 Update the sprint status summary display to use new schema sections

## Dev Notes

### What This Story Changes vs Current Behavior

The current `bmad-dev-story` workflow (in `workflow.md`) performs story discovery by:
1. Reading `sprint-status.yaml` and parsing the `development_status` flat map
2. Finding the first key that matches `number-number-name` pattern with status `ready-for-dev`
3. Updating status by writing back to the flat map

After this rework:
- Story discovery searches the `backlog` array and all `sprints[].items` arrays
- Status updates are in-place on the item object in whichever section it resides
- Cross-section search means a dev can work on a story whether or not it is sprint-assigned
- The "not found" case now checks the `done/` archive as a fallback

### Skill Files to Modify

- `.claude/skills/bmad-dev-story/SKILL.md` — entry point (delegates to workflow.md)
- `.claude/skills/bmad-dev-story/workflow.md` — main workflow file with all the logic; **this is where the bulk of changes go** (Steps 1 and status-update logic)

### Unified Schema Sections Touched

- **`backlog`** — searched for story by ID; status may be updated in-place
- **`sprints`** — all sprint entries' `items` arrays are searched; status may be updated in-place
- **`epics`** — NOT modified, but must be preserved during read-modify-write

### Cross-References

- **Story 17.9** (schema) — defines the item schema and section structure
- **Story 17.19** (story-status-lookup) — similar cross-section search pattern; can share the search approach
- **Story 17.14** (cleanup-done) — handles archival of done items after this skill marks them done
- **Story 17.21** (close-sprint) — may also update item statuses during sprint closure

### Gotchas from Current Implementation

- The workflow.md is large and complex — the status update logic is embedded within a multi-step workflow, not a standalone function
- The `development_status` parsing in Step 1 uses pattern matching on key names to distinguish epics from stories — the new schema makes this explicit via `type` field
- The workflow has a `tag="sprint-status"` attribute on Step 1 — this may be used by other skills to reference this step
- The workflow already has a "no ready-for-dev story found" case — update the output message to reference the new schema
- The existing logic maps status "drafted" to "ready-for-dev" — this legacy mapping may no longer be needed with the unified schema

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD: FR135 (in-place status update)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
