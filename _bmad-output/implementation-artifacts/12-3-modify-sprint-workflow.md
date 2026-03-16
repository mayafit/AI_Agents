# Story 12.3: Create Modify Sprint Extension Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want an extension workflow to modify existing sprints,
So that scope can be adjusted when priorities change mid-sprint.

## Acceptance Criteria

1. **Given** modify-sprint workflow exists in lib/bmad-extension/workflows/modify-sprint/workflow.md,
   **When** invoked (NFR19),
   **Then** it allows: adding items, removing items, changing capacity, updating metadata

2. **Given** sprint modification requested,
   **When** items added or removed,
   **Then** sprint status reflects updated item list and remaining capacity (FR71)

## Tasks / Subtasks

- [ ] Task 1: Create modify-sprint workflow (AC: #1, #2)
  - [ ] 1.1: Create directory `lib/bmad-extension/workflows/modify-sprint/`
  - [ ] 1.2: Create `lib/bmad-extension/workflows/modify-sprint/workflow.md` with guided flow

- [ ] Task 2: Implement sprint selection step (AC: #1)
  - [ ] 2.1: Workflow step 1: List available sprints by reading `_bmad-output/implementation-artifacts/sprint-plan-*.yaml`
  - [ ] 2.2: Workflow step 2: User selects sprint to modify
  - [ ] 2.3: Workflow step 3: Display current sprint state — name, capacity, assigned items with status, remaining capacity

- [ ] Task 3: Implement modification operations (AC: #1, #2)
  - [ ] 3.1: Workflow step 4: Present modification menu — add item, remove item, change capacity, update metadata
  - [ ] 3.2: **Add item:** Present unassigned backlog items (from sprint-status.yaml), user selects item, add to sprint assigned_items list, check capacity
  - [ ] 3.3: **Remove item:** List currently assigned items, user selects item to remove, remove from assigned_items list, item returns to unassigned backlog
  - [ ] 3.4: **Change capacity:** Prompt for new capacity (positive integer), validate, update sprint artifact
  - [ ] 3.5: **Update metadata:** Allow updating sprint name, start/end context, status (planning/active/completed)

- [ ] Task 4: Implement capacity feedback after each modification (AC: #2)
  - [ ] 4.1: After every modification, display updated remaining capacity (capacity - assigned_items count)
  - [ ] 4.2: If adding an item exceeds capacity, warn user and require confirmation or capacity increase
  - [ ] 4.3: Allow multiple modifications in sequence before finalizing

- [ ] Task 5: Persist changes to sprint artifact with concurrency guard (AC: #2)
  - [ ] 5.1: Before writing, re-read the sprint artifact file and compare its `last_modified` timestamp to the value read at the start of the workflow session. If the timestamp differs, the file was modified externally — halt and display: *"Sprint artifact was modified since this session started. Re-read the current state below and confirm your changes before proceeding."* Then redisplay the current state and await user confirmation.
  - [ ] 5.2: Write updated sprint data back to the sprint YAML artifact file, updating `last_modified` to the current ISO timestamp.
  - **Data authority note:** Do NOT write sprint assignments to sprint-status.yaml. Sprint membership is owned exclusively by sprint-plan-{n}.yaml. sprint-status.yaml is read-only from the perspective of sprint management workflows.

- [ ] Task 6: Register workflow in module-help.csv (AC: #1)
  - [ ] 6.1: Add entry to `lib/bmad-extension/module-help.csv` for modify-sprint workflow
  - [ ] 6.2: Entry must include: workflow name, slash command `/modify-sprint`, description, phase association

## Dev Notes

### Architecture Compliance

- **Extension module pattern:** Workflow lives in lib/bmad-extension/workflows/modify-sprint/
- **Sprint artifact format:** Reads and writes the same YAML format defined in 12-1 (sprint-plan-{number}.yaml), including the `last_modified` timestamp field
- **Capacity as item count:** Consistent with FR66 — capacity is always an integer item count
- **Remaining capacity display (FR71):** After every modification, show remaining capacity
- **Concurrency guard:** Re-read artifact before write and compare `last_modified`. Abort write if file changed externally.
- **Data authority:** sprint-plan-{n}.yaml is authoritative for sprint membership. Do not modify sprint-status.yaml from this workflow.

### Shared Guardrails

See `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` for universal constraints, data authority rules, sprint artifact naming, and concurrency guard requirements.

### Critical Guardrails (story-specific)

- Do NOT place workflow in `_bmad/bmm/workflows/` — use `lib/bmad-extension/workflows/`
- Do NOT modify any existing BMAD base module files
- Do NOT add npm dependencies
- Do NOT allow capacity to be set to zero or negative values
- Do NOT silently exceed capacity when adding items — always warn
- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js
- Do NOT delete sprint artifact files — only modify their contents

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/workflows/modify-sprint/workflow.md`
- **Files to update:**
  - `lib/bmad-extension/module-help.csv` — add workflow registration entry
- **Files to read/write (at runtime):**
  - `_bmad-output/implementation-artifacts/sprint-plan-*.yaml` — sprint artifact files
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — backlog item status

### References

- [Source: lib/bmad-extension/workflows/add-sprint/workflow.md] — Sprint artifact format (created in 12-1)
- [Source: lib/bmad-extension/workflows/add-to-sprint/workflow.md] — Item assignment pattern (created in 12-2)
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Backlog status file

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
