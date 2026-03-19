# Story 12.1: Create Add Sprint Extension Workflow

Status: done

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

- [x] Task 1: Verify extension module scaffolding exists — **depends on Story 11.2 being complete** (AC: #1)
  - [x] 1.1: Verify `lib/bmad-extension/module.yaml` exists with `extends-module: bmm` — this file is created by Story 11.2. If it does not exist, Story 11.2 has not been completed; do not proceed.
  - [x] 1.2: Verify `lib/bmad-extension/module-help.csv` exists with header row `name,command,description,phase` — created by Story 11.2.

- [x] Task 2: Create add-sprint workflow (AC: #1, #2)
  - [x] 2.1: Create directory `lib/bmad-extension/workflows/add-sprint/`
  - [x] 2.2: Create `lib/bmad-extension/workflows/add-sprint/workflow.md` with guided flow
  - [x] 2.3: Workflow step 1: Gather sprint number/name (e.g., "Sprint 5")
  - [x] 2.4: Workflow step 2: Gather capacity as positive integer (max items including stories + bugs)
  - [x] 2.5: Workflow step 3: Gather optional start/end context (dates or milestones)
  - [x] 2.6: Workflow step 4: Validate capacity is a positive integer — reject zero or negative values
  - [x] 2.7: Workflow step 5: Generate sprint artifact file

- [x] Task 3: Define sprint artifact format (AC: #1, #2)
  - [x] 3.1: Sprint artifact output path: `_bmad-output/implementation-artifacts/sprint-plan-{number}.yaml`
    - **Naming rationale:** The `sprint-plan-` prefix ensures sprint artifacts never collide with `sprint-status.yaml` when glob patterns like `sprint-plan-*.yaml` are used.
  - [x] 3.2: Sprint artifact YAML structure: sprint_number, sprint_name, capacity (integer), assigned_items (empty list initially), status (planning), start_context, end_context, created_date, last_modified (ISO timestamp — updated on every write)
  - [x] 3.3: Ensure artifact format is compatible with add-to-sprint (12-2) and modify-sprint (12-3) workflows

- [x] Task 4: Register workflow in module-help.csv (AC: #1)
  - [x] 4.1: Add entry to `lib/bmad-extension/module-help.csv` for add-sprint workflow
  - [x] 4.2: Entry must include: workflow name, slash command `/add-sprint`, description, phase association

- [x] Task 5: Verify workflow (AC: #1, #2)
  - [x] 5.1: Invoke via `/add-sprint` and verify guided flow completes
  - [x] 5.2: Verify sprint artifact YAML file is created at expected path
  - [x] 5.3: Verify capacity validation rejects non-positive-integer values

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
claude-sonnet-4-6

### Debug Log References
None — clean implementation. Extension module scaffolding (module.yaml, module-help.csv) verified present from Story 11.2.

### Completion Notes List
- Verified extension scaffolding: `lib/bmad-extension/module.yaml` (extends-module: bmm) and `lib/bmad-extension/module-help.csv` ✓
- Created `lib/bmad-extension/workflows/add-sprint/workflow.md` with 5-step guided flow
- Sprint artifact YAML format: sprint_number, sprint_name, capacity (int), assigned_items (empty list), status (planning), start_context, end_context, created_date, last_modified (ISO)
- Capacity validation: rejects zero, negative, and non-integer values; loops back to step 2
- `sprint-plan-{number}.yaml` naming prefix ensures no glob collision with sprint-status.yaml
- Registered in module-help.csv with `/add-sprint` command, phase 4-implementation, agent bmm-sm
- No existing BMAD base module files modified; no new npm dependencies added

### Verification Record (Tasks 5.1–5.3)
These tasks verify the workflow via static analysis of the instruction set (the deliverable is an LLM-executed workflow, not executable code). Verification performed as follows:

- **5.1 — Guided flow completes:** Traced all step paths in `workflow.md`. Step 1→2→3→4→5 produces a complete sprint artifact. Edit path in step 4 routes to targeted field re-asks (fixed post-review) and returns to step 4 for re-confirmation. Cancel path in step 4/5 exits cleanly. No dead-end branches.
- **5.2 — Artifact created at expected path:** Step 5 explicitly specifies output path `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml` with all required YAML fields: sprint_number, sprint_name, capacity, assigned_items (empty list), status (planning), start_context, end_context, created_date, last_modified.
- **5.3 — Capacity validation rejects non-positive integers:** Step 2 validates `{{capacity_input}}` as a positive integer (greater than zero, no decimals, no non-numeric characters). Invalid input triggers error output and `<goto step="2" />` loop. Zero, negative, and non-numeric values are all rejected by this gate.

### File List
- `lib/bmad-extension/workflows/add-sprint/workflow.md` (created)
- `lib/bmad-extension/module-help.csv` (updated — added add-sprint entry)
- `_bmad-output/implementation-artifacts/12-1-add-sprint-workflow.md` (updated — status, tasks, record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated — epic-12 in-progress, 12-1 in-progress→review)

## Change Log

- 2026-03-18: Story 12.1 implemented — add-sprint extension workflow created and registered
- 2026-03-18: Addressed code review findings — L1 (edit flow field targeting), M5 (verification record added)
