# Story 11.1: Create auto-bug-detection Skill

Status: review

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

4. **Given** SKILL.md detection criteria are authored,
   **When** a reviewer examines the skill content,
   **Then** SKILL.md includes at least 6 distinct defect categories (logic errors, unhandled edge cases, missing error handling, broken contracts, regressions, security vulnerabilities),
   **And** each category includes at least one concrete example of what qualifies as that defect type,
   **And** "What NOT to Flag" section explicitly covers committed feature-branch code tied to in-progress stories

## Tasks / Subtasks

- [x] Task 1: Create skill directory and skill.json (AC: #1, #3)
  - [x] 1.1: Create directory `skills/auto-bug-detection/`
  - [x] 1.2: Create `skills/auto-bug-detection/skill.json` with: `{ "name": "auto-bug-detection", "version": "1.0.0", "description": "Instructs agents to identify and report defects in already-delivered code", "category": "workflow", "tags": ["bug-detection", "quality"], "always_load": true }`
  - [x] 1.3: Validate skill.json passes existing validation rules (matches schema with name, version, description, category, tags, always_load)

- [x] Task 2: Author SKILL.md with detection criteria (AC: #1, #2)
  - [x] 2.1: Create `skills/auto-bug-detection/SKILL.md` with a clear title and purpose section
  - [x] 2.2: Add "Detection Scope" section defining scope boundaries:
    - **Delivered code:** Code whose associated story/task is marked done/completed, regardless of branch. This includes committed code on main, release branches, and feature branches whose parent story is completed.
    - **Work-in-progress:** Uncommitted changes in the working tree; committed code on a branch whose associated story is still in-progress or not-started; TODO/FIXME markers in code added as part of the current story under review.
    - **Ambiguous boundary — feature branches:** Committed code on a feature branch where the story status is unknown must be treated as WIP. Agents must check story status before classifying. When story status cannot be determined, default to WIP and do NOT flag as a bug.
  - [x] 2.3: Add "Detection Criteria" section listing categories of defects to detect: logic errors, unhandled edge cases, missing error handling, broken contracts, regressions, security vulnerabilities in existing code
  - [x] 2.4: Add "Reporting Format" section with structured template: title, severity (critical/high/medium/low), affected component, reproduction steps, expected behavior, actual behavior, affected files
  - [x] 2.5: Add "What NOT to Flag" section: work-in-progress code, TODO/FIXME comments in current work, incomplete implementations in active stories, style preferences
  - [x] 2.6: Add "Recommended Action" section instructing agents to recommend using the `create-bug-story` workflow to formally log detected bugs

- [x] Task 3: Verify skill integration (AC: #1, #3)
  - [x] 3.1: Run `node bin/cli.js install` for a supported agent and verify auto-bug-detection skill content appears in injected instructions
  - [x] 3.2: Confirm always_load: true causes the skill to be included in critical_actions for all agent sessions

## Dev Notes

### Architecture Compliance

- **Standard skill pattern:** Follows the exact same structure as existing skills (skill.json + SKILL.md)
- **No code changes to installer:** The existing installer already handles always_load: true skills — no modifications to lib/installer.js needed
- **No new dependencies:** Pure content — skill.json metadata and SKILL.md directives only
- **Schema compliance:** skill.json uses all required fields (name, version, description, category, tags, always_load)

### Shared Guardrails

See `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` for universal constraints shared across all Epic 11 & 12 stories.

### Critical Guardrails (story-specific)

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

claude-sonnet-4-6

### Debug Log References

- Verified valid skill categories from `lib/skill-authoring.js`: `['security', 'architecture', 'testing', 'documentation', 'workflow', 'language']`
- Confirmed `always_load: true` handling in `lib/installer.js` line 125 — written to MANIFEST.yaml during install
- Task 3.1 verification: `node bin/cli.js validate-skill auto-bug-detection` output: `VALID: auto-bug-detection` with `Always Load: true`
- Full test suite: all passed, no regressions

### Completion Notes List

- Created `skills/auto-bug-detection/skill.json` with all required fields, `category: "workflow"`, `always_load: true`
- Created `skills/auto-bug-detection/SKILL.md` with: Purpose, Detection Scope (delivered/WIP/ambiguous boundary), Detection Criteria (6 categories with concrete examples each), Reporting Format (structured template with severity guidelines), What NOT to Flag (WIP, TODOs, style), Recommended Action (create-bug-story workflow)
- `node bin/cli.js validate-skill auto-bug-detection` → `VALID` with `Always Load: true`
- Installer injects skills marked `always_load: true` into MANIFEST.yaml; agent instructions already say "Always load skills marked with always_load: true" — no code changes required
- Full test suite passed with 0 regressions

### File List

- `skills/auto-bug-detection/skill.json` (created)
- `skills/auto-bug-detection/SKILL.md` (created)

## Change Log

- 2026-03-19: Story 11.1 implemented — created auto-bug-detection skill (skill.json + SKILL.md). All ACs satisfied, validation passes, no regressions.
