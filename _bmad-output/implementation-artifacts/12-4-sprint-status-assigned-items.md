# Story 12.4: Update Sprint Status with Assigned Items

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want sprint status workflow to show assigned items per sprint,
So that sprint progress is visible with all stories and bugs listed.

## Acceptance Criteria

1. **Given** existing sprint status workflow,
   **When** it displays sprint information,
   **Then** it shows all assigned items (stories + bugs) with their current status (FR71),
   **And** remaining capacity visible,
   **And** bugs and stories distinguishable in listing

## Tasks / Subtasks

- [ ] Task 1: Assess existing sprint-status workflow (AC: #1)
  - [ ] 1.1: Read existing sprint-status workflow in `_bmad/bmm/workflows/` to understand current format and capabilities
  - [ ] 1.2: Read existing `_bmad-output/implementation-artifacts/sprint-status.yaml` to understand current data structure
  - [ ] 1.3: Determine whether to extend the existing workflow or create a new extension workflow — prefer extension workflow in `lib/bmad-extension/workflows/` if base workflow should not be modified

- [ ] Task 2: Create or extend sprint-status workflow for assigned items view (AC: #1)
  - [ ] 2.1: If creating extension: create `lib/bmad-extension/workflows/sprint-status-view/workflow.md` (or update existing workflow if appropriate)
  - [ ] 2.2: Workflow step 1: Read all sprint artifact files from `_bmad-output/implementation-artifacts/sprint-*.yaml`
  - [ ] 2.3: Workflow step 2: For each sprint, display: sprint name/number, capacity, status (planning/active/completed)
  - [ ] 2.4: Workflow step 3: For each sprint, list assigned items with: item identifier, title, type (story or bug), current status
  - [ ] 2.5: Workflow step 4: Display remaining capacity per sprint (capacity - assigned items count)

- [ ] Task 3: Implement type distinction for stories vs bugs (AC: #1)
  - [ ] 3.1: Stories and bugs must be visually distinguishable in the listing — use type labels or markers
  - [ ] 3.2: Bug items should show severity alongside status
  - [ ] 3.3: Story items should show standard status (not-started/in-progress/done)

- [ ] Task 4: Integrate with sprint-status.yaml data (AC: #1)
  - [ ] 4.1: Cross-reference sprint assigned_items with sprint-status.yaml to get current item statuses
  - [ ] 4.2: Handle items that exist in sprint but not in sprint-status.yaml (show as "status unknown")
  - [ ] 4.3: Handle items in sprint-status.yaml not assigned to any sprint (show as "unassigned" in summary)

- [ ] Task 5: Register workflow if new (AC: #1)
  - [ ] 5.1: If a new extension workflow was created, add entry to `lib/bmad-extension/module-help.csv`
  - [ ] 5.2: Entry must include: workflow name, slash command, description, phase association

## Dev Notes

### Architecture Compliance

- **Extension vs base modification:** Prefer creating a new extension workflow over modifying the existing base sprint-status workflow — keeps base BMAD module untouched
- **Sprint artifact integration:** Reads sprint YAML files created by add-sprint (12-1) and modified by add-to-sprint (12-2) and modify-sprint (12-3)
- **Flat listing (FR65):** Items displayed in a flat list within each sprint — no epic grouping
- **Remaining capacity (FR71):** Must be prominently displayed per sprint
- **Item type distinction:** Stories and bugs are clearly labeled — bugs show severity, stories show status

### Critical Guardrails

- Do NOT modify `_bmad/bmm/workflows/` base module files unless absolutely necessary — prefer extension workflow
- Do NOT add npm dependencies
- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js
- Do NOT group items by epic — maintain flat backlog view within sprints
- Do NOT hide unassigned items — surface them in a summary section

### Project Structure Notes

- **Files to create (likely):**
  - `lib/bmad-extension/workflows/sprint-status-view/workflow.md` (or similar name)
- **Files to update:**
  - `lib/bmad-extension/module-help.csv` — add workflow registration entry (if new workflow)
- **Files to read (at runtime):**
  - `_bmad-output/implementation-artifacts/sprint-*.yaml` — sprint artifact files
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — item statuses
- **Existing files to review (not modify):**
  - `_bmad/bmm/workflows/` — existing sprint-status workflow for reference

### References

- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Current sprint status data
- [Source: _bmad/bmm/workflows/] — Existing sprint-status workflow for pattern reference
- [Source: lib/bmad-extension/workflows/add-sprint/workflow.md] — Sprint artifact format (created in 12-1)
- [Source: lib/bmad-extension/workflows/add-to-sprint/workflow.md] — Item assignment format (created in 12-2)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
