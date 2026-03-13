# Story 11.2: Create Bug Story Extension Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want a BMAD extension workflow that creates structured bug stories from detected defects,
So that bugs enter the backlog with consistent format.

## Acceptance Criteria

1. **Given** create-bug-story workflow exists in lib/bmad-extension/workflows/create-bug-story/workflow.md,
   **When** invoked via BMAD agent menu or slash command (NFR19),
   **Then** it guides creating a bug story with: title, reproduction steps, expected vs actual, severity, affected component

2. **Given** a bug story is created,
   **When** saved,
   **Then** it exists as standalone backlog item alongside user stories (FR64),
   **And** follows consistent template format

3. **Given** workflow registered in module-help.csv,
   **When** BMAD agent loads extension module,
   **Then** workflow appears in available workflows

## Tasks / Subtasks

- [ ] Task 1: Create extension module scaffolding if not yet present (AC: #3)
  - [ ] 1.1: Create `lib/bmad-extension/` directory if it does not exist
  - [ ] 1.2: Create `lib/bmad-extension/module.yaml` with `extends-module: bmm` if it does not exist
  - [ ] 1.3: Create or update `lib/bmad-extension/module-help.csv` with header row if it does not exist

- [ ] Task 2: Create create-bug-story workflow (AC: #1, #2)
  - [ ] 2.1: Create directory `lib/bmad-extension/workflows/create-bug-story/`
  - [ ] 2.2: Create `lib/bmad-extension/workflows/create-bug-story/workflow.md` with workflow content
  - [ ] 2.3: Workflow must include step-by-step guided flow: gather title, severity, affected component, reproduction steps, expected behavior, actual behavior, root cause hypothesis, affected files
  - [ ] 2.4: Define bug story output template with all required fields: title, severity (critical/high/medium/low), affected component, reproduction steps, expected behavior, actual behavior, root cause hypothesis, affected files, suggested fix (optional)
  - [ ] 2.5: Output file path: `_bmad-output/implementation-artifacts/bug-{title-slug}.md` (kebab-case title slug)
  - [ ] 2.6: Bug story output must include a `type: bug` marker to distinguish from user stories

- [ ] Task 3: Register workflow in module-help.csv (AC: #3)
  - [ ] 3.1: Add entry to `lib/bmad-extension/module-help.csv` for create-bug-story workflow
  - [ ] 3.2: Entry must include: workflow name, slash command `/create-bug-story`, description, and phase association

- [ ] Task 4: Verify workflow invocation (AC: #1, #3)
  - [ ] 4.1: Confirm workflow is discoverable via BMAD agent menu
  - [ ] 4.2: Confirm workflow is invocable via `/create-bug-story` slash command
  - [ ] 4.3: Run workflow end-to-end and verify output file is created with correct format

## Dev Notes

### Architecture Compliance

- **Extension module pattern:** Workflow lives in lib/bmad-extension/workflows/ (NOT in _bmad/bmm/workflows/)
- **module.yaml:** Must specify `extends-module: bmm` to integrate with base BMAD Method module
- **module-help.csv:** Standard BMAD registration mechanism for workflows — enables both menu and slash command access
- **Output location:** Bug stories are written to `_bmad-output/implementation-artifacts/` as standalone backlog items alongside user stories
- **BMAD workflow conventions:** workflow.md follows the same structure as existing bmm workflows (step-by-step guided agent flow)

### Critical Guardrails

- Do NOT place workflow files inside `_bmad/bmm/workflows/` — extension workflows go in `lib/bmad-extension/workflows/`
- Do NOT modify any existing BMAD base module files
- Do NOT add npm dependencies
- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js
- Output filename must use kebab-case slug derived from bug title — no timestamps in filenames

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/module.yaml` (if not exists)
  - `lib/bmad-extension/module-help.csv` (if not exists, or update)
  - `lib/bmad-extension/workflows/create-bug-story/workflow.md`
- **No files to modify** in the existing codebase (this is all new extension content)

### References

- [Source: _bmad/bmm/workflows/] — Existing BMAD workflows for pattern reference
- [Source: lib/bmad-extension/module.yaml] — Extension module definition (may need creation)
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration file (may need creation)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
