# Story 11.1: Create auto-bug-detection Skill

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want an auto-bug-detection skill that instructs agents to identify and report defects in already-delivered code,
So that bugs are caught proactively during all agent sessions.

## Acceptance Criteria

1. **Given** the skill is authored,
   **When** installed via ma-agents,
   **Then** skills/auto-bug-detection/skill.json exists with always_load: true,
   **And** SKILL.md contains detection criteria and reporting instructions

2. **Given** the skill is loaded via critical_actions,
   **When** agent encounters a defect in delivered code,
   **Then** skill directives instruct agent to report using structured format,
   **And** skill distinguishes between bugs in delivered code vs work-in-progress

3. **Given** skill follows standard schema,
   **When** validated,
   **Then** it passes all existing skill validation rules

## Tasks / Subtasks

- [ ] Task 1: Create skill directory and skill.json (AC: #1, #3)
  - [ ] 1.1: Create directory `skills/auto-bug-detection/`
  - [ ] 1.2: Create `skills/auto-bug-detection/skill.json` with: `{ "name": "auto-bug-detection", "version": "1.0.0", "description": "Instructs agents to identify and report defects in already-delivered code", "category": "workflow", "tags": ["bug-detection", "quality"], "always_load": true }`
  - [ ] 1.3: Validate skill.json passes existing validation rules (matches schema with name, version, description, category, tags, always_load)

- [ ] Task 2: Author SKILL.md with detection criteria (AC: #1, #2)
  - [ ] 2.1: Create `skills/auto-bug-detection/SKILL.md` with a clear title and purpose section
  - [ ] 2.2: Add "Detection Scope" section defining what qualifies as delivered code (merged/committed code, completed stories) vs work-in-progress (current branch changes, uncommitted work)
  - [ ] 2.3: Add "Detection Criteria" section listing categories of defects to detect: logic errors, unhandled edge cases, missing error handling, broken contracts, regressions, security vulnerabilities in existing code
  - [ ] 2.4: Add "Reporting Format" section with structured template: title, severity (critical/high/medium/low), affected component, reproduction steps, expected behavior, actual behavior, affected files
  - [ ] 2.5: Add "What NOT to Flag" section: work-in-progress code, TODO/FIXME comments in current work, incomplete implementations in active stories, style preferences
  - [ ] 2.6: Add "Recommended Action" section instructing agents to recommend using the `create-bug-story` workflow to formally log detected bugs

- [ ] Task 3: Verify skill integration (AC: #1, #3)
  - [ ] 3.1: Run `node bin/cli.js install` for a supported agent and verify auto-bug-detection skill content appears in injected instructions
  - [ ] 3.2: Confirm always_load: true causes the skill to be included in critical_actions for all agent sessions

## Dev Notes

### Architecture Compliance

- **Standard skill pattern:** Follows the exact same structure as existing skills (skill.json + SKILL.md)
- **No code changes to installer:** The existing installer already handles always_load: true skills — no modifications to lib/installer.js needed
- **No new dependencies:** Pure content — skill.json metadata and SKILL.md directives only
- **Schema compliance:** skill.json uses all required fields (name, version, description, category, tags, always_load)

### Critical Guardrails

- Do NOT add any new npm dependencies
- Do NOT modify lib/installer.js, lib/agents.js, or lib/bmad.js
- Do NOT create agent-specific templates unless truly needed — start with just skill.json + SKILL.md
- Do NOT flag work-in-progress code as bugs — the SKILL.md must clearly distinguish delivered vs in-progress
- Do NOT introduce a new skill schema field — use only existing fields

### Project Structure Notes

- **Files to create:**
  - `skills/auto-bug-detection/skill.json`
  - `skills/auto-bug-detection/SKILL.md`
- **No files to modify** — existing installer handles always_load skills automatically

### References

- [Source: skills/code-review/skill.json] — Example skill.json for pattern reference
- [Source: skills/code-review/SKILL.md] — Example SKILL.md for content structure reference
- [Source: lib/installer.js] — Installer logic for always_load skill handling (no changes needed)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
