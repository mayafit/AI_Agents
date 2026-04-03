# Story 17.3: Bug as Story Type

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Test Engineer**,
I want bugs to appear in the backlog alongside stories as a distinct type,
So that bugs are prioritized and assigned to sprints using the same workflow as stories.

## Acceptance Criteria

1. **Given** a bug is created via the bug-story workflow (Epic 11, FR61),
   **When** the bug story file is created,
   **Then** it is added to the backlog with `type: bug`,
   **And** it includes bug-specific fields: `severity` (critical/high/medium/low), `version_found`, `bug_type`.

2. **Given** bugs and stories coexist in the backlog,
   **When** the backlog is displayed or used for sprint planning,
   **Then** bugs are visually distinguished (type field) but sorted by the same priority field as stories,
   **And** a critical bug can be prioritized above any story.

3. **Given** a bug follows the same lifecycle as a story,
   **When** the bug progresses through statuses,
   **Then** it uses the same flow: `backlog -> ready-for-dev -> in-progress -> review -> done`,
   **And** done bugs are archived the same way as done stories (FR130, FR131).

## Tasks / Subtasks

- [x] Task 1: Extend bug story file format with new fields (AC: #1)
  - [x] 1.1: Update `lib/bmad-extension/skills/create-bug-story/SKILL.md` to gather two additional optional fields:
    - `version_found` (string, optional): The version/commit where the bug was found (e.g., "3.0.0", "commit abc123"). Press Enter to skip -> stored as empty string.
    - `bug_type` (enum, optional): Classification of bug. Options: `regression | functional | performance | security | ui | data | integration | other`. Press Enter to skip -> defaults to `functional`.
  - [x] 1.2: Add `version_found` and `bug_type` prompts as a new step between current Step 3 (expected/actual) and Step 4 (root cause):
    - Prompt: "What version or commit was this bug found in? (optional, press Enter to skip)"
    - Prompt: "What type of bug is this? [regression / functional / performance / security / ui / data / integration / other] (optional, defaults to functional)"
    - Validate bug_type against the enum list; reject invalid values with error and re-prompt
  - [x] 1.3: Update YAML frontmatter template in Step 6 to include new fields:
    ```yaml
    ---
    type: bug
    severity: {{severity}}
    title: {{bug_title}}
    version_found: "{{version_found}}"
    bug_type: {{bug_type}}
    status: backlog
    ---
    ```
  - [x] 1.4: Add `status: backlog` to the YAML frontmatter — this is the initial lifecycle status for newly created bugs, enabling the backlog generator (Story 17.2) to read bug status directly from the file
  - [x] 1.5: Update the confirmation display in Step 5 to show the new fields

- [x] Task 2: Add backlog integration to create-bug-story (AC: #1, #2)
  - [x] 2.1: After writing the bug file in Step 6, add a new Step 7 that checks if `backlog.yaml` exists:
    - If exists: read it, append new bug entry at the end (lowest priority), re-number priorities, write back
    - If not exists: note in output that user should run `/generate-backlog` to include this bug
  - [x] 2.2: Bug entry format for backlog.yaml (per Story 17.2 schema):
    ```yaml
    - id: "BUG-{{title_slug}}"
      type: bug
      epic: null
      title: "{{bug_title}}"
      priority: {{next_priority}}
      status: backlog
      sprint: null
      severity: {{severity}}
    ```
  - [x] 2.3: After appending to backlog, display: "Bug added to backlog at priority {{priority}}. Use `/prioritize-backlog` to adjust priority."

- [x] Task 3: Update backlog schema for bug-specific fields (AC: #1, #2)
  - [x] 3.1: Update `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` Backlog Model section (added by Story 17.2) to document:
    - Bug entries have `severity` field (non-null)
    - Bug entries have `epic: null` (invariant)
    - Bug entries use `BUG-{slug}` ID format (uppercase prefix)
  - [x] 3.2: Document the bug lifecycle: `backlog -> ready-for-dev -> in-progress -> review -> done`
  - [x] 3.3: Document that bug status is tracked in the bug file's YAML frontmatter `status` field (not in sprint-status.yaml)

- [x] Task 4: Ensure lifecycle parity with stories (AC: #3)
  - [x] 4.1: Verify that the dev-story workflow can process bug files (it reads the story file by path — bug files follow the same markdown structure with different frontmatter)
  - [x] 4.2: Add a note in SKILL.md output that done bugs are archived by Story 17.6's cleanup process to `done/BUG-{slug}.md`
  - [x] 4.3: Verify the create-bug-story SKILL.md slug derivation produces IDs compatible with the Item ID Format Contract from Story 17.1:
    - Bug file: `bug-{slug}.md` (lowercase prefix)
    - Bug ID in backlog/sprint: `BUG-{slug}` (uppercase prefix)
    - These must use the same slug — just different prefix casing

- [x] Task 5: Update module-help.csv description (AC: #1)
  - [x] 5.1: Update the `create-bug-story` row in `lib/bmad-extension/module-help.csv` description to mention backlog integration:
    - Current: "Create a structured bug story from a detected defect and add to backlog."
    - Updated: "Create a structured bug story with severity and type classification, add to backlog.yaml."

- [x] Task 6: Verify (AC: #1, #2, #3)
  - [x] 6.1: Trace create-bug-story SKILL.md — confirm new fields are gathered, validated, and written to frontmatter
  - [x] 6.2: Verify bug entry in backlog.yaml follows schema (type: bug, epic: null, severity present)
  - [x] 6.3: Verify `version_found` and `bug_type` default handling (empty string and "functional" respectively)
  - [x] 6.4: Verify `status: backlog` is in frontmatter for new bugs
  - [x] 6.5: Verify slug derivation: `bug-{slug}.md` filename maps to `BUG-{slug}` backlog ID

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** The create-bug-story skill is at `lib/bmad-extension/skills/create-bug-story/SKILL.md`
- **Extension module pattern:** Modifications stay in `lib/bmad-extension/skills/create-bug-story/`
- **Backward compatible:** Existing bug files without `version_found`, `bug_type`, or `status` fields still work — the generate-backlog skill (17.2) treats missing fields as defaults
- **Bug ID Format Contract:** Bug file is `bug-{slug}.md`, Bug ID in backlog/sprint is `BUG-{slug}` — same slug, different prefix casing

### Extended Bug Frontmatter Schema

```yaml
---
type: bug                    # always "bug"
severity: critical           # critical | high | medium | low
title: "Login fails"         # always quoted
version_found: "3.0.0"      # optional, empty string if skipped
bug_type: regression         # regression|functional|performance|security|ui|data|integration|other
status: backlog              # backlog|ready-for-dev|in-progress|review|done
---
```

### Bug Lifecycle (Same as Stories)

```
backlog -> ready-for-dev -> in-progress -> review -> done
```

- Bug status is tracked in the bug file's own YAML frontmatter `status` field
- Stories track status in `sprint-status.yaml` — bugs do NOT appear there
- Done bugs are archived to `done/BUG-{slug}.md` by Story 17.6

### Backward Compatibility

Existing `bug-*.md` files created before this story will not have `version_found`, `bug_type`, or `status` fields. Consumers must handle:
- Missing `version_found` -> treat as empty/unknown
- Missing `bug_type` -> treat as `functional`
- Missing `status` -> treat as `backlog`

### Impact on Other Epic 17 Stories

- **17.2 (Flat Backlog):** generate-backlog reads bug frontmatter including new fields
- **17.4 (Backlog-to-Sprint):** Displays bug type and severity in prioritization UI
- **17.6 (Done Item Cleanup):** Archives done bugs to `done/` subfolder
- **17.7 (Prioritization):** Uses severity as a prioritization criterion for bugs
- **17.8 (Sprint Status Display):** Shows bug type distinction in sprint view

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify `sprint-status.yaml` — bugs are NOT tracked there
- Do NOT change existing bug file format in a breaking way — new fields are additive only
- Bug entries in backlog MUST have `epic: null` (FR64)
- Bug IDs MUST use `BUG-{slug}` format with uppercase prefix
- `version_found` and `bug_type` MUST be optional (backward compatible with existing bugs)

### Project Structure Notes

- **Files to modify (primary):**
  - `lib/bmad-extension/skills/create-bug-story/SKILL.md` — add version_found, bug_type, status fields; add backlog integration step
  - `lib/bmad-extension/module-help.csv` — update create-bug-story description
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — document bug lifecycle and frontmatter schema
- **Files NOT to touch:**
  - `lib/bmad-extension/workflows/create-bug-story/workflow.md` — legacy copy, sync or leave (SKILL.md is authoritative)
  - `sprint-status.yaml` — bugs are not tracked here
  - Any files under `_bmad/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.3] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR128] — Bugs as story type in backlog with same lifecycle
- [Source: _bmad-output/planning-artifacts/prd.md#FR65] — Flat backlog containing both stories and bugs
- [Source: _bmad-output/planning-artifacts/prd.md#FR130] — Done items removed from sprint status
- [Source: _bmad-output/planning-artifacts/prd.md#FR131] — Done story files moved to done/ subfolder
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Item ID Format Contract (BUG-{slug})
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog YAML schema
- [Source: lib/bmad-extension/skills/create-bug-story/SKILL.md] — Current bug creation workflow to extend
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration

### Git Intelligence

Recent commits show Epic 15/16 patterns. Key conventions:
- Conventional commit format: `feat(epic-17): story 17-3 bug as story type`
- SKILL.md modifications follow the additive pattern — extend, don't rewrite

## Change Log

- 2026-03-30: Story implemented — extended create-bug-story with version_found, bug_type, status fields and backlog integration.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation.

### Completion Notes List

Extended create-bug-story SKILL.md with version_found, bug_type, status fields. Added backlog integration step. Updated module-help.csv description. Updated guardrails with bug lifecycle.

### File List

- `lib/bmad-extension/skills/create-bug-story/SKILL.md` (modified)
- `lib/bmad-extension/module-help.csv` (modified)
- `sprint-management-guardrails.md` (modified)
