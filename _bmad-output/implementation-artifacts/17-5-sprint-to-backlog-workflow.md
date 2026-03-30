# Story 17.5: Sprint-to-Backlog Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want a workflow to move items from a sprint back to the backlog,
So that I can adjust sprint scope when priorities change without losing the item.

## Acceptance Criteria

1. **Given** a sprint has assigned items,
   **When** the Scrum Master invokes the remove-from-sprint workflow,
   **Then** it displays the sprint's currently assigned items,
   **And** the Scrum Master selects which items to remove.

2. **Given** items are removed from the sprint,
   **When** the removal completes,
   **Then** the item's `sprint` field in `backlog.yaml` is cleared (set to `null`),
   **And** the item is removed from the sprint file's `items` array,
   **And** the item's status is NOT changed — it retains its current status (e.g., stays `ready-for-dev`),
   **And** the item remains in the backlog at its current priority position.

## Tasks / Subtasks

- [ ] Task 1: Decide implementation location (AC: #1, #2)
  - [ ] 1.1: Evaluate whether to rework the existing `modify-sprint` skill or create a new `remove-from-sprint` skill:
    - **Option A (Recommended):** Create new `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` — focused, single-purpose workflow aligned with FR129
    - **Option B:** Add remove capability to `modify-sprint` — but modify-sprint already handles add/remove/capacity/metadata and will need its own rework for the new sprint model
    - **Decision:** Use **Option A** — a dedicated skill is cleaner and avoids coupling the remove operation to the larger modify-sprint rework
  - [ ] 1.2: If Option A, also add a deprecation/update note to `modify-sprint` SKILL.md indicating that item removal is now handled by `/remove-from-sprint`

- [ ] Task 2: Create remove-from-sprint SKILL.md (AC: #1, #2)
  - [ ] 2.1: Create skill package at `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` with YAML frontmatter:
    ```yaml
    ---
    name: remove-from-sprint
    description: Remove items from a sprint and return them to the unassigned backlog
    type: skill
    triggers:
      - "remove from sprint"
      - "unassign from sprint"
    ---
    ```
  - [ ] 2.2: Create `lib/bmad-extension/skills/remove-from-sprint/bmad-skill-manifest.yaml`
  - [ ] 2.3: Implement workflow steps:

    **Step 1: Select sprint**
    - Glob `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml` to find all sprint files
    - If no sprint files: display "No sprints exist." and exit
    - Read each sprint file; display table: #, Sprint Name, Status, Items Count
    - Filter to sprints with at least 1 item (empty sprints have nothing to remove)
    - If no sprints have items: display "No sprints have assigned items." and exit
    - Prompt user to select a sprint
    - Store selected sprint and its `last_modified` for concurrency guard

    **Step 2: Display assigned items**
    - Read `_bmad-output/implementation-artifacts/backlog.yaml`
    - For each item ID in the sprint's `items` array, look up details from backlog.yaml: title, type, status, priority
    - If an item ID is in the sprint but NOT in the backlog (data inconsistency): display with warning marker and raw ID
    - Display items table: #, ID, Title, Type, Status, Priority

    **Step 3: Select items to remove**
    - Prompt: "Select items to remove (comma-separated numbers, 'all' to remove all, or 'q' to cancel)"
    - If 'q': exit without changes
    - Validate selections

    **Step 4: Confirm removal**
    - Display selected items for confirmation
    - Emphasize: "Item status will NOT change — items retain their current status"
    - Prompt: "[y] Confirm removal / [n] Cancel / [e] Edit selection"
    - If 'n': exit without changes
    - If 'e': go back to Step 3

    **Step 5: Concurrency guard**
    - Re-read sprint file and check `last_modified` against stored value
    - If changed: warn about conflict, offer [o]verwrite / [r]eload / [x]cancel (same pattern as modify-sprint)

    **Step 6: Persist changes**
    - For each confirmed item:
      - Remove item ID from sprint file's `items` array
      - Set item's `sprint` field in `backlog.yaml` to `null`
      - Do NOT change item's `status` field (AC #2 — status preserved)
    - Update sprint file's `last_modified` timestamp
    - Write updated sprint file
    - Write updated backlog.yaml
    - Display summary: items removed, new sprint capacity usage

- [ ] Task 3: Register in module-help.csv (AC: #1)
  - [ ] 3.1: Add row to `lib/bmad-extension/module-help.csv`:
    ```
    ma-skills,4-implementation,Remove from Sprint,remove-from-sprint,,skill:remove-from-sprint,remove-from-sprint,false,bmm-sm,,"Remove items from a sprint and return to unassigned backlog.",_bmad-output/implementation-artifacts,"sprint plan",
    ```

- [ ] Task 4: Update modify-sprint with cross-reference (AC: #1)
  - [ ] 4.1: Add note at the top of `lib/bmad-extension/skills/modify-sprint/SKILL.md`:
    ```
    <!-- NOTE: Item removal from sprints is now handled by /remove-from-sprint (Story 17.5).
         The "Remove item" option in this workflow's menu is superseded.
         This workflow will be fully reworked when converted to the new sprint model. -->
    ```

- [ ] Task 5: Update guardrails (AC: #2)
  - [ ] 5.1: Add to `sprint-management-guardrails.md`: "remove-from-sprint writes to both `backlog.yaml` (clears sprint field) and `sprints/sprint-{id}.yaml` (removes from items array) — dual-write contract same as add-to-sprint"
  - [ ] 5.2: Document invariant: removing an item from a sprint NEVER changes the item's status

- [ ] Task 6: Verify (AC: #1, #2)
  - [ ] 6.1: Trace SKILL.md — confirm all paths read from `backlog.yaml` and `sprints/sprint-*.yaml`
  - [ ] 6.2: Verify dual-write: both backlog.yaml `sprint` field cleared and sprint file `items` array updated
  - [ ] 6.3: Verify status preservation: item status is NEVER modified by this workflow
  - [ ] 6.4: Verify concurrency guard: checks `last_modified` before writing
  - [ ] 6.5: Verify `last_modified` timestamp is updated on sprint file after removal
  - [ ] 6.6: Verify backlog priority is preserved (items stay at same priority position)

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** New skill at `lib/bmad-extension/skills/remove-from-sprint/SKILL.md`
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/remove-from-sprint/`
- **Dual-write pattern:** Same as Story 17.4 — writes to both `backlog.yaml` and sprint file
- **Concurrency guard:** Same pattern as `modify-sprint` — check `last_modified` before writing
- **Status invariant:** This workflow NEVER modifies item status. This is a hard constraint from FR129.

### Data Flow

```
READ:  sprints/sprint-*.yaml → sprint list with items
READ:  backlog.yaml → item details (title, type, status, priority)
WRITE: sprints/sprint-{id}.yaml → remove from items array, update last_modified
WRITE: backlog.yaml → clear sprint field on removed items
```

### Inverse of Story 17.4

This is the exact inverse operation of Story 17.4 (Backlog-to-Sprint):
- 17.4: sets `sprint` field, appends to sprint `items`
- 17.5: clears `sprint` field, removes from sprint `items`

Both follow the same dual-write pattern and concurrency guard.

### Impact on Other Epic 17 Stories

- **17.1 (Sprint Entity):** Sprint file format this story reads/writes
- **17.2 (Flat Backlog):** Backlog format this story reads/writes
- **17.4 (Backlog-to-Sprint):** Inverse operation
- **17.6 (Done Item Cleanup):** Different removal path — 17.6 removes done items permanently, 17.5 returns items to unassigned backlog
- **17.8 (Sprint Status Display):** Reads sprint files modified by this story

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify `sprint-status.yaml` — it is derived and read-only
- Do NOT change item status when removing from sprint (FR129 — status preserved)
- Do NOT change item priority when removing from sprint (position preserved)
- ALWAYS update both `backlog.yaml` AND the sprint file when removing items
- ALWAYS update `last_modified` on the sprint file after modification
- ALWAYS check concurrency guard before writing to sprint file

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` — new skill (authoritative)
  - `lib/bmad-extension/skills/remove-from-sprint/bmad-skill-manifest.yaml` — skill manifest
- **Files to modify:**
  - `lib/bmad-extension/module-help.csv` — add remove-from-sprint row
  - `lib/bmad-extension/skills/modify-sprint/SKILL.md` — add cross-reference note only
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — document dual-write and status invariant
- **Files NOT to touch:**
  - `sprint-status.yaml` (derived, read-only)
  - `sprint-plan-*.yaml` (old format, deprecated)
  - Any files under `_bmad/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.5] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR129] — Move items from sprint back to backlog without status change
- [Source: _bmad-output/planning-artifacts/prd.md#NFR19] — Menu + slash command invocation
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Sprint YAML schema, concurrency guard pattern
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog YAML schema
- [Source: _bmad-output/implementation-artifacts/17-4-backlog-to-sprint-workflow.md] — Inverse operation (assign to sprint)
- [Source: lib/bmad-extension/skills/modify-sprint/SKILL.md] — Current modify-sprint with remove capability (to be superseded)
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration
- [Source: _bmad-output/implementation-artifacts/done/12-3-modify-sprint-workflow.md] — Original Epic 12 modify-sprint story

### Git Intelligence

Recent commits show Epic 15/16 patterns:
- Conventional commit format: `feat(epic-17): story 17-5 sprint-to-backlog workflow`
- New skill creation follows: SKILL.md + bmad-skill-manifest.yaml + module-help.csv registration

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
