# Story 10.1: Ensure _bmad-output Is Not Gitignored

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to remove _bmad-output from .gitignore if present and never add it,
So that planning artifacts are tracked as version-controlled project knowledge.

## Acceptance Criteria

1. **Given** project with _bmad-output in .gitignore, **When** installer runs (install/update), **Then** _bmad-output line removed, **And** message displayed: "_bmad-output is now tracked as project knowledge (not gitignored)"
2. **Given** project with no _bmad-output in .gitignore, **When** installer runs, **Then** .gitignore not modified for this concern
3. **Given** no .gitignore exists, **When** installer runs, **Then** no .gitignore created for this purpose
4. **Given** installer creates/updates .gitignore for other entries, **When** it writes, **Then** _bmad-output never included

## Tasks / Subtasks

- [ ] Create ensureBmadOutputTracked(projectRoot) function in lib/installer.js (AC: #1, #2, #3)
  - [ ] Check if .gitignore exists at projectRoot; if not, return early (AC: #3)
  - [ ] Read .gitignore content
  - [ ] Scan for lines matching _bmad-output variations: `_bmad-output`, `_bmad-output/`, `/_bmad-output`, `/_bmad-output/`
  - [ ] Remove matching lines
  - [ ] Write back only if changes were made (AC: #2)
  - [ ] Print chalk.green() message when lines are removed (AC: #1)
- [ ] Integrate ensureBmadOutputTracked() into install pipeline (AC: #1)
  - [ ] Call after skill installation or during manifest update stage
- [ ] Audit existing codebase for any code that adds _bmad-output to .gitignore (AC: #4)
  - [ ] Check lib/installer.js for any .gitignore write logic that includes _bmad-output
  - [ ] Check lib/bmad.js for any .gitignore write logic that includes _bmad-output
  - [ ] Remove any such logic if found
- [ ] Remove _bmad-output/ from the ma-agents project's own .gitignore (AC: #4)
- [ ] Test: .gitignore with _bmad-output entry gets it removed and message displayed (AC: #1)
- [ ] Test: .gitignore without _bmad-output entry is not modified (AC: #2)
- [ ] Test: missing .gitignore does not cause error or file creation (AC: #3)

## Dev Notes

### Architecture Compliance
- FR58/FR59: _bmad-output is project knowledge and must be version-controlled.
- Use fs.readFileSync/writeFileSync for .gitignore operations, consistent with existing file I/O patterns.
- Console output uses chalk.green() per established console output patterns in the codebase.
- path.join() for all file path construction.

### Critical Guardrails
- Do NOT create a .gitignore file if one does not exist
- Do NOT remove other entries from .gitignore — only _bmad-output variations
- Do NOT leave trailing blank lines or corrupt .gitignore formatting when removing lines
- Do NOT skip the audit step — check all existing code paths for any logic that adds _bmad-output to .gitignore

### Project Structure Notes
- Modify: `lib/installer.js` — add ensureBmadOutputTracked() function and call it in install pipeline
- Modify: `.gitignore` (project root) — remove `_bmad-output/` entry
- Audit: `lib/bmad.js` — check for any .gitignore write logic referencing _bmad-output

### References
- [Source: lib/installer.js — install pipeline for integration point]
- [Source: .gitignore — current _bmad-output/ entry to remove]
- [Source: lib/bmad.js — audit for .gitignore write logic]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
