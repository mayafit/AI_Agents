# Story 11.3: Integrate Bug Detection into Code Review

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Developer**,
I want code review to include explicit bug detection checks,
So that defects in delivered code are caught during review.

## Acceptance Criteria

1. **Given** code review is in progress,
   **When** auto-bug-detection skill is loaded via critical_actions,
   **Then** reviewing agent evaluates delivered code for defects,
   **And** detected bugs flagged separately from review feedback

2. **Given** bug detected during review,
   **When** reviewer documents it,
   **Then** reviewer recommends creating bug story via create-bug-story workflow,
   **And** bug tracked independently from story being reviewed

## Tasks / Subtasks

- [ ] Task 1: Update code-review skill to reference bug detection (AC: #1)
  - [ ] 1.1: Read existing `skills/code-review/SKILL.md` to understand current review directives
  - [ ] 1.2: Add a "Bug Detection During Review" section to `skills/code-review/SKILL.md`
  - [ ] 1.3: Section should instruct reviewing agents to: evaluate delivered code (not just the diff) for defects, flag bugs separately from code review feedback (style, suggestions, etc.), clearly label bug findings with severity
  - [ ] 1.4: Add instruction that bugs in delivered code are distinct from issues in the code under review — review feedback applies to current changes, bug reports apply to pre-existing defects

- [ ] Task 2: Add cross-reference to create-bug-story workflow (AC: #2)
  - [ ] 2.1: In the new "Bug Detection During Review" section, add directive: when a bug is detected in delivered code during review, recommend the reviewer invoke `/create-bug-story` to formally log it
  - [ ] 2.2: Instruct that bugs should be tracked independently — do not block the current story review for pre-existing bugs
  - [ ] 2.3: Add note that auto-bug-detection skill (always_load: true) provides the detection criteria — code-review skill provides the integration point

- [ ] Task 3: Verify integration works end-to-end (AC: #1, #2)
  - [ ] 3.1: Run ma-agents install and verify both auto-bug-detection and code-review skills are injected
  - [ ] 3.2: Confirm auto-bug-detection loads via always_load: true alongside code-review during a review session
  - [ ] 3.3: Verify code-review SKILL.md references bug detection and create-bug-story workflow

## Dev Notes

### Architecture Compliance

- **Primarily a content story:** Minimal code changes — mostly updates to SKILL.md content
- **Skill interaction via always_load:** auto-bug-detection skill (from 11-1) loads automatically via always_load: true — no explicit wiring needed in installer
- **Code-review skill update:** Adding a section to existing SKILL.md, not changing skill.json or creating new files
- **No installer changes:** The existing installer already loads both skills — this story is about making their content work together

### Critical Guardrails

- Do NOT modify lib/installer.js, lib/agents.js, or bin/cli.js
- Do NOT change the code-review skill.json — only update SKILL.md content
- Do NOT add npm dependencies
- Do NOT duplicate bug detection criteria in code-review SKILL.md — reference the auto-bug-detection skill instead
- Do NOT make code review block on bug reporting — bugs are tracked independently

### Project Structure Notes

- **File to modify:**
  - `skills/code-review/SKILL.md` — add "Bug Detection During Review" section
- **Dependencies:**
  - Story 11-1 (auto-bug-detection skill must exist)
  - Story 11-2 (create-bug-story workflow must exist for cross-reference)

### References

- [Source: skills/code-review/SKILL.md] — Existing code review skill content to update
- [Source: skills/auto-bug-detection/SKILL.md] — Bug detection criteria (created in 11-1)
- [Source: lib/bmad-extension/workflows/create-bug-story/workflow.md] — Workflow to cross-reference (created in 11-2)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
