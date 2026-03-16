# Story 12.4: Update Sprint Status with Assigned Items

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want sprint status workflow to show assigned items per sprint,
So that sprint progress is visible with all stories and bugs listed.

## Acceptance Criteria

0. **Architecture mandate:**
   Implementation MUST create a new extension workflow at `lib/bmad-extension/workflows/sprint-status-view/workflow.md`. Do NOT modify any files under `_bmad/bmm/workflows/`. This is not a decision left to the implementing developer — the extension approach is required.

1. **Given** existing sprint status workflow,
   **When** it displays sprint information,
   **Then** it shows all assigned items (stories + bugs) with their current status (FR71),
   **And** remaining capacity visible,
   **And** bugs and stories distinguishable in listing

## Tasks / Subtasks

- [ ] Task 1: Prepare extension workflow — **architecture is pre-decided: create extension only** (AC: #0)
  - [ ] 1.1: Read existing sprint-status workflow in `_bmad/bmm/workflows/` to understand current format for reference only — do NOT modify it
  - [ ] 1.2: Read existing `_bmad-output/implementation-artifacts/sprint-status.yaml` to understand current data structure
  - [ ] 1.3: Create `lib/bmad-extension/workflows/sprint-status-view/workflow.md` — this is the mandated approach. Do not modify base module files.

- [ ] Task 2: Create sprint-status-view extension workflow (AC: #1)
  - [ ] 2.1: Create `lib/bmad-extension/workflows/sprint-status-view/workflow.md`
  - [ ] 2.2: Workflow step 1: Read all sprint artifact files from `_bmad-output/implementation-artifacts/sprint-plan-*.yaml`
  - [ ] 2.3: Workflow step 2: For each sprint, display: sprint name/number, capacity, status (planning/active/completed)
  - [ ] 2.4: Workflow step 3: For each sprint, list assigned items with: item identifier, title, type (story or bug), current status
  - [ ] 2.5: Workflow step 4: Display remaining capacity per sprint (capacity - assigned items count)

- [ ] Task 3: Implement type distinction for stories vs bugs (AC: #1)
  - [ ] 3.1: Stories and bugs must be visually distinguishable in the listing — use type labels or markers
  - [ ] 3.2: Bug items should show severity alongside status
  - [ ] 3.3: Story items should show standard status (not-started/in-progress/done)

- [ ] Task 4: Integrate with sprint-status.yaml data (AC: #1)
  - [ ] 4.1: Cross-reference sprint assigned_items (from sprint-plan-*.yaml) with sprint-status.yaml to get current item execution statuses. Data authority: sprint-plan-{n}.yaml owns membership; sprint-status.yaml owns execution status.
  - [ ] 4.2: For bug items (discovered via `bug-*.md` glob): execution status comes from the bug file's YAML frontmatter (or shows as "not-started" if no status field present — bugs start unstarted).
  - [ ] 4.3: Handle items that exist in a sprint plan but have no entry in sprint-status.yaml (user stories only): display a **data integrity warning** — *"Item {id} has no status entry in sprint-status.yaml — run /sprint-planning to initialize status tracking for this item."* Do NOT silently show "status unknown."
  - [ ] 4.4: Handle items in sprint-status.yaml not assigned to any sprint: show in an "Unassigned Backlog" summary section.

- [ ] Task 5: Register workflow in module-help.csv (AC: #1)
  - [ ] 5.1: Add entry to `lib/bmad-extension/module-help.csv` for sprint-status-view workflow
  - [ ] 5.2: Entry must include: workflow name, slash command `/sprint-status-view`, description, phase association

## Dev Notes

### Architecture Compliance

- **Extension workflow mandatory:** Implementation MUST be a new extension workflow at `lib/bmad-extension/workflows/sprint-status-view/workflow.md`. This is not a preference — it is required. The base `_bmad/bmm/workflows/` must not be modified.
- **Sprint artifact integration:** Reads sprint-plan-{n}.yaml files created by add-sprint (12-1) and modified by add-to-sprint (12-2) and modify-sprint (12-3)
- **Flat listing (FR65):** Items displayed in a flat list within each sprint — no epic grouping
- **Remaining capacity (FR71):** Must be prominently displayed per sprint
- **Item type distinction:** Stories and bugs are clearly labeled — bugs show severity, stories show status
- **Data authority split:** sprint-plan-{n}.yaml owns sprint membership. sprint-status.yaml owns user story execution status. Bug execution status comes from bug file frontmatter. Never conflate these sources.
- **Bug story discovery:** Bug stories are discovered via glob `_bmad-output/implementation-artifacts/bug-*.md` with YAML frontmatter parsing. They are NOT in sprint-status.yaml.
- **Data integrity warnings:** Items in sprint plan but missing from sprint-status.yaml must surface as an actionable warning (run /sprint-planning), not silently as "status unknown."

### Shared Guardrails

See `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` for universal constraints, data authority rules, sprint artifact naming, and bug story discovery contract.

### Critical Guardrails (story-specific)

- Do NOT modify `_bmad/bmm/workflows/` base module files — extension workflow is mandatory (see AC #0)
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
  - `_bmad-output/implementation-artifacts/sprint-plan-*.yaml` — sprint artifact files
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
