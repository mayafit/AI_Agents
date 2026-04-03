# Story 17.21: New close-sprint Skill

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want a `close-sprint` skill that transitions a sprint from `active` to `closed`, archives all done items, and returns incomplete items to the backlog,
So that sprint closure is a clean, well-defined workflow.

## Acceptance Criteria

1. **Given** the Scrum Master invokes `close-sprint`,
   **When** an active sprint exists,
   **Then** the skill displays the sprint summary: total items, done count, incomplete count.

2. **Given** the sprint has items with `status: done`,
   **When** the sprint is closed,
   **Then** all done items are REMOVED from the sprint's `items` array,
   **And** their story/bug files are moved to `{implementation_artifacts}/done/` (same as cleanup-done).

3. **Given** the sprint has incomplete items (status != `done`),
   **When** the sprint is closed,
   **Then** the skill presents three options for handling incomplete items (FR137):
   (a) **Move all to the next sprint** — all incomplete items are MOVED from the current sprint's `items` array to the next sprint's `items` array (the next sprint must exist in `planning` status; if no next sprint exists, the skill prompts to create one or falls back to option b),
   (b) **Return all to backlog** — all incomplete items are MOVED from the sprint's `items` array back to the `backlog` section (FR134 — movement semantics), each receiving a `priority` value placing it at the top of the backlog (to be reprioritized),
   (c) **Decide per item** — the skill iterates through each incomplete item and asks whether to move it to the next sprint or return it to the backlog,
   **And** regardless of option chosen, each item's status is preserved (e.g., `in-progress` items stay `in-progress`).

4. **Given** all items have been archived or returned to backlog,
   **When** the sprint is fully processed,
   **Then** the sprint's `status` is set to `closed`,
   **And** the sprint's `items` array is empty `[]`,
   **And** the sprint definition is preserved in the `sprints` section (historical record),
   **And** a summary is displayed: "Sprint N closed. X items archived, Y items returned to backlog."

5. **Given** no active sprint exists,
   **When** `close-sprint` is invoked,
   **Then** it reports: "No active sprint found. Nothing to close."

## Tasks / Subtasks

- [ ] Task 1: Create the new close-sprint skill folder and SKILL.md (AC: 1-5)
  - [ ] 1.1 Create `.claude/skills/close-sprint/` directory if it does not already exist
  - [ ] 1.2 Verify the existing SKILL.md (if present) — the skill was registered in MANIFEST.yaml during Epic 12 but may be a stub
  - [ ] 1.3 Create or rewrite `SKILL.md` with frontmatter (name, description, triggers) and workflow
- [ ] Task 2: Implement active sprint detection (AC: 1, 5)
  - [ ] 2.1 Read `sprint-status.yaml` and parse the `sprints` section
  - [ ] 2.2 Find the sprint with `status: active`
  - [ ] 2.3 If no active sprint found, display "No active sprint found. Nothing to close." and exit
  - [ ] 2.4 Display sprint summary: name, total items, items by status (done, in-progress, review, ready-for-dev, backlog)
- [ ] Task 3: Implement done-item archival (AC: 2)
  - [ ] 3.1 Filter the active sprint's `items` array for items with `status: done`
  - [ ] 3.2 For each done item, move the corresponding story file from `{implementation_artifacts}/{id}.md` to `{implementation_artifacts}/done/{id}.md`
  - [ ] 3.3 For bug items, move from `{implementation_artifacts}/BUG-{title}.md` to `{implementation_artifacts}/done/BUG-{title}.md`
  - [ ] 3.4 Remove done items from the sprint's `items` array
  - [ ] 3.5 Create the `done/` directory if it does not exist
- [ ] Task 4: Implement incomplete-item disposition — option (a): move to next sprint (AC: 3)
  - [ ] 4.1 Scan the `sprints` section for a sprint with `status: planning`
  - [ ] 4.2 If a planning sprint exists, move all incomplete items from the active sprint's `items` array to the planning sprint's `items` array
  - [ ] 4.3 If no planning sprint exists, prompt to create one (via `/add-sprint`) or fall back to option (b)
  - [ ] 4.4 Preserve each item's current status during the move
- [ ] Task 5: Implement incomplete-item disposition — option (b): return to backlog (AC: 3)
  - [ ] 5.1 Move all incomplete items from the sprint's `items` array to the `backlog` section
  - [ ] 5.2 Add a `priority` field to each moved item, set to `1` (top of backlog)
  - [ ] 5.3 Shift existing backlog items' priorities down to accommodate the new entries
  - [ ] 5.4 Preserve each item's current status during the move (e.g., `in-progress` stays `in-progress`)
- [ ] Task 6: Implement incomplete-item disposition — option (c): per-item decision (AC: 3)
  - [ ] 6.1 Iterate through each incomplete item and display its ID, title, and current status
  - [ ] 6.2 For each item, ask: move to next sprint or return to backlog
  - [ ] 6.3 Apply the chosen action per item (same logic as options a and b, but item-by-item)
- [ ] Task 7: Finalize sprint closure (AC: 4)
  - [ ] 7.1 Set the sprint's `status` to `closed`
  - [ ] 7.2 Ensure the sprint's `items` array is empty `[]`
  - [ ] 7.3 Preserve the sprint definition in the `sprints` section (do not delete the sprint entry)
  - [ ] 7.4 Update `last_updated` timestamp on `sprint-status.yaml`
  - [ ] 7.5 Display the closure summary: "Sprint N closed. X items archived, Y items returned to backlog."
- [ ] Task 8: Register the skill in MANIFEST.yaml (AC: 1-5)
  - [ ] 8.1 Verify the skill entry exists in `.claude/skills/MANIFEST.yaml` (it may already be registered from Epic 12)
  - [ ] 8.2 If not present, add the entry with appropriate triggers and description

## Dev Notes

### What This Story Creates

This is a **new skill** (not a rework). The `close-sprint` skill implements the sprint closure lifecycle defined in Architecture P2-11. It combines:
- Done-item archival logic (same pattern as Story 17.14 cleanup-done)
- Incomplete-item return to backlog (inverse of Story 17.12 remove-from-sprint)
- Sprint status transition to `closed`

The close-sprint skill may already have a stub SKILL.md from Epic 12 registration. Check `.claude/skills/close-sprint/` and the MANIFEST.yaml.

### Skill Files to Create/Modify

- `.claude/skills/close-sprint/SKILL.md` — new or rewritten skill file with full workflow
- `.claude/skills/MANIFEST.yaml` — verify or add the skill registration

### Unified Schema Sections Touched

- **`sprints`** — reads active sprint, modifies sprint status to `closed`, empties `items` array; may also write to a `planning` sprint when moving incomplete items
- **`backlog`** — writes incomplete items back to backlog (movement semantics)
- **`epics`** — NOT modified, but must be preserved during read-modify-write
- **File system** — moves story/bug files from `{implementation_artifacts}/` to `{implementation_artifacts}/done/`

### Cross-References

- **Story 17.9** (schema) — defines the sprint and item schemas
- **Story 17.14** (cleanup-done) — this skill reuses the done-archival pattern (file move to `done/`)
- **Story 17.12** (remove-from-sprint) — this skill reuses the return-to-backlog pattern (movement semantics)
- **Story 17.16** (add-sprint) — if no planning sprint exists for option (a), the SM is directed to create one
- **Story 17.17** (modify-sprint) — can also set sprint status, but close-sprint handles the full closure lifecycle with item disposition

### Gotchas

- The `done/` directory must be created if it does not exist (use `mkdir -p` equivalent)
- File move for bugs uses `BUG-{title}.md` naming — verify the actual bug file naming convention in the project
- When moving items to the next sprint, check that adding them would not exceed the target sprint's capacity
- The movement semantics (FR134) require atomic remove+add in a single file write — no intermediate state where an item exists in neither section or both sections
- After closing, the sprint entry must remain in the `sprints` section with `status: closed` and `items: []` for historical record

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md` — Close-Sprint Lifecycle Workflow section
- PRD: FR134 (movement semantics), FR136 (done removal), FR137 (incomplete item options)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
