# Story 12.2: Create Add-to-Sprint Extension Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want an extension workflow to assign backlog items to a sprint using multi-criteria prioritization,
So that highest-value items are selected within capacity.

## Acceptance Criteria

1. **Given** add-to-sprint workflow exists in lib/bmad-extension/workflows/add-to-sprint/workflow.md,
   **When** invoked (NFR19),
   **Then** it presents flat backlog (stories + bugs) for selection (FR65),
   **And** items can be assigned to a sprint

2. **Given** items being prioritized (FR67),
   **When** workflow guides prioritization,
   **Then** multiple criteria considered (business value, dependencies, severity),
   **And** agent assists ranking within capacity

3. **Given** sprint at capacity,
   **When** attempt to add another item,
   **Then** workflow warns capacity exceeded,
   **And** suggests removing item or increasing capacity

## Tasks / Subtasks

- [ ] Task 1: Create add-to-sprint workflow (AC: #1, #2, #3)
  - [ ] 1.1: Create directory `lib/bmad-extension/workflows/add-to-sprint/`
  - [ ] 1.2: Create `lib/bmad-extension/workflows/add-to-sprint/workflow.md` with guided flow

- [ ] Task 2: Implement backlog discovery step (AC: #1)
  - [ ] 2.1: Workflow step 1: Read sprint-status.yaml to discover all backlog items (stories and bugs)
  - [ ] 2.2: Workflow step 2: Present flat backlog listing all items with type (story/bug), title, and current status
  - [ ] 2.3: Backlog must be flat — no epic grouping — stories and bugs are peers (FR65)

- [ ] Task 3: Implement sprint selection and capacity check (AC: #1, #3)
  - [ ] 3.1: Workflow step 3: List available sprints by reading sprint artifact files from `_bmad-output/implementation-artifacts/sprint-*.yaml`
  - [ ] 3.2: Workflow step 4: User selects target sprint
  - [ ] 3.3: Workflow step 5: Display current sprint capacity usage (assigned items count vs capacity limit)

- [ ] Task 4: Implement multi-criteria prioritization guidance (AC: #2)
  - [ ] 4.1: Workflow step 6: For each candidate item, guide agent to evaluate: business value (high/medium/low), technical dependencies (blocked/blocking/independent), bug severity (critical/high/medium/low — bugs only), effort estimation (small/medium/large)
  - [ ] 4.2: Workflow step 7: Agent suggests a ranked ordering based on multi-criteria evaluation
  - [ ] 4.3: Workflow step 8: User confirms or adjusts ranking

- [ ] Task 5: Implement assignment with capacity enforcement (AC: #1, #3)
  - [ ] 5.1: Workflow step 9: Assign selected items to sprint by updating sprint artifact YAML (add to assigned_items list)
  - [ ] 5.2: Workflow step 10: After each assignment, check if sprint is at capacity — if at or over capacity, warn user and suggest removing an item or increasing capacity via modify-sprint workflow
  - [ ] 5.3: Update sprint-status.yaml to reflect item assignments if applicable

- [ ] Task 6: Register workflow in module-help.csv (AC: #1)
  - [ ] 6.1: Add entry to `lib/bmad-extension/module-help.csv` for add-to-sprint workflow
  - [ ] 6.2: Entry must include: workflow name, slash command `/add-to-sprint`, description, phase association

## Dev Notes

### Architecture Compliance

- **Extension module pattern:** Workflow lives in lib/bmad-extension/workflows/add-to-sprint/
- **Flat backlog (FR65):** Stories and bugs are peers in a flat list — no epic hierarchy in backlog presentation
- **Multi-criteria prioritization (FR67):** Agent assists with ranking using business value, dependencies, severity, and effort — but user makes final decisions
- **Capacity enforcement:** Count-based (item count, not points) — matches sprint artifact format from 12-1
- **Sprint artifact integration:** Reads and updates sprint YAML files created by add-sprint workflow (12-1)

### Critical Guardrails

- Do NOT place workflow in `_bmad/bmm/workflows/` — use `lib/bmad-extension/workflows/`
- Do NOT modify any existing BMAD base module files
- Do NOT add npm dependencies
- Do NOT group items by epic — present flat backlog (FR65)
- Do NOT auto-assign items without user confirmation
- Do NOT silently exceed capacity — always warn and offer alternatives
- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/workflows/add-to-sprint/workflow.md`
- **Files to update:**
  - `lib/bmad-extension/module-help.csv` — add workflow registration entry
- **Files to read (at runtime):**
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — backlog item discovery
  - `_bmad-output/implementation-artifacts/sprint-*.yaml` — sprint artifact files

### References

- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Backlog items source
- [Source: lib/bmad-extension/workflows/add-sprint/workflow.md] — Sprint artifact format (created in 12-1)
- [Source: lib/bmad-extension/workflows/modify-sprint/workflow.md] — Cross-reference for capacity adjustment (created in 12-3)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
