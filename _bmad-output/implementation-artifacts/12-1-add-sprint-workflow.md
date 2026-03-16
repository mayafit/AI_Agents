# Story 12.1: Create Add Sprint Extension Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want an extension workflow to create new sprints with capacity limits,
So that sprint planning uses realistic capacity-based constraints.

## Acceptance Criteria

1. **Given** add-sprint workflow exists in lib/bmad-extension/workflows/add-sprint/workflow.md,
   **When** invoked via menu or slash command (NFR19),
   **Then** it guides creation with: sprint name/number, capacity (item count), start/end context,
   **And** sprint created as trackable artifact

2. **Given** sprint capacity defined by item count (FR66),
   **When** sprint created,
   **Then** capacity expressed as max items (stories + bugs),
   **And** workflow validates capacity is positive integer

## Tasks / Subtasks

- [ ] Task 1: Verify extension module scaffolding exists — **depends on Story 11.2 being complete** (AC: #1)
  - [ ] 1.1: Verify `lib/bmad-extension/module.yaml` exists with `extends-module: bmm` — this file is created by Story 11.2. If it does not exist, Story 11.2 has not been completed; do not proceed.
  - [ ] 1.2: Verify `lib/bmad-extension/module-help.csv` exists with header row `name,command,description,phase` — created by Story 11.2.

- [ ] Task 2: Create add-sprint workflow (AC: #1, #2)
  - [ ] 2.1: Create directory `lib/bmad-extension/workflows/add-sprint/`
  - [ ] 2.2: Create `lib/bmad-extension/workflows/add-sprint/workflow.md` with guided flow
  - [ ] 2.3: Workflow step 1: Gather sprint number/name (e.g., "Sprint 5")
  - [ ] 2.4: Workflow step 2: Gather capacity as positive integer (max items including stories + bugs)
  - [ ] 2.5: Workflow step 3: Gather optional start/end context (dates or milestones)
  - [ ] 2.6: Workflow step 4: Validate capacity is a positive integer — reject zero or negative values
  - [ ] 2.7: Workflow step 5: Generate sprint artifact file

- [ ] Task 3: Define sprint artifact format (AC: #1, #2)
  - [ ] 3.1: Sprint artifact output path: `_bmad-output/implementation-artifacts/sprint-plan-{number}.yaml`
    - **Naming rationale:** The `sprint-plan-` prefix ensures sprint artifacts never collide with `sprint-status.yaml` when glob patterns like `sprint-plan-*.yaml` are used.
  - [ ] 3.2: Sprint artifact YAML structure: sprint_number, sprint_name, capacity (integer), assigned_items (empty list initially), status (planning), start_context, end_context, created_date, last_modified (ISO timestamp — updated on every write)
  - [ ] 3.3: Ensure artifact format is compatible with add-to-sprint (12-2) and modify-sprint (12-3) workflows

- [ ] Task 4: Register workflow in module-help.csv (AC: #1)
  - [ ] 4.1: Add entry to `lib/bmad-extension/module-help.csv` for add-sprint workflow
  - [ ] 4.2: Entry must include: workflow name, slash command `/add-sprint`, description, phase association

- [ ] Task 5: Verify workflow (AC: #1, #2)
  - [ ] 5.1: Invoke via `/add-sprint` and verify guided flow completes
  - [ ] 5.2: Verify sprint artifact YAML file is created at expected path
  - [ ] 5.3: Verify capacity validation rejects non-positive-integer values

## Dev Notes

### Architecture Compliance

- **Extension module pattern:** Workflow lives in lib/bmad-extension/workflows/add-sprint/ (NOT in _bmad/bmm/workflows/)
- **YAML artifact format:** Sprint artifacts use YAML for structured data — consistent with sprint-status.yaml pattern
- **Capacity as item count:** FR66 specifies capacity as item count (not story points or hours) — keep it simple
- **BMAD workflow conventions:** Step-by-step guided agent flow, invocable via menu and slash command

### Shared Guardrails

See `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` for universal constraints, data authority rules, sprint artifact naming, and story implementation order.

### Critical Guardrails (story-specific)

- Do NOT place workflow in `_bmad/bmm/workflows/` — use `lib/bmad-extension/workflows/`
- Do NOT modify any existing BMAD base module files
- Do NOT add npm dependencies
- Do NOT use story points or hours for capacity — use item count only (FR66)
- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js
- Capacity MUST be validated as a positive integer

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/workflows/add-sprint/workflow.md`
- **Files to update:**
  - `lib/bmad-extension/module-help.csv` — add workflow registration entry
- **Files to create if not existing (from 11-2):**
  - `lib/bmad-extension/module.yaml`
  - `lib/bmad-extension/module-help.csv`

### References

- [Source: _bmad/bmm/workflows/] — Existing BMAD workflows for pattern reference
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Existing sprint status for format reference
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration file

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
