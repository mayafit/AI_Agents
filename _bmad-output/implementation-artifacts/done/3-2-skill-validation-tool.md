# Story 3.2: Skill Validation Command

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to run `npx ma-agents validate-skill <skill-name>` to check a skill for schema compliance,
So that I can catch skill format errors before distribution.

## Acceptance Criteria

1. **Given** the user runs `npx ma-agents validate-skill my-skill`
   **When** the skill directory exists and contains valid files
   **Then** the command reports "VALID" with a summary of skill metadata

2. **Given** the skill is missing `skill.json`
   **When** the validate command runs
   **Then** it reports "INVALID: missing required file skill.json"

3. **Given** the skill is missing `SKILL.md`
   **When** the validate command runs
   **Then** it reports "INVALID: missing required file SKILL.md"

4. **Given** the `skill.json` has missing or invalid fields (no name, no version, invalid category)
   **When** the validate command runs
   **Then** it reports each validation error with the field name and expected format

5. **Given** the skill has agent-specific templates in `templates/`
   **When** the validate command runs
   **Then** it verifies each template filename matches a known agent registry key
   **And** warns about templates targeting unknown agents

## Tasks / Subtasks

- [x] Task 1: Add `validate-skill` command to CLI router (AC: #1-#5)
  - [x] 1.1: Add `validate-skill` to command routing in `bin/cli.js`
  - [x] 1.2: Create `validateSkill(skillName)` function in `lib/skill-authoring.js` (created in Story 3-1)
  - [x] 1.3: Add `validate-skill` to help text
- [x] Task 2: Implement file existence checks (AC: #2, #3)
  - [x] 2.1: Check `skills/<skill-name>/` directory exists — if not: `Error: Skill '<skill-name>' not found` / `Hint: Run "list" to see available skills`
  - [x] 2.2: Check `skill.json` exists — if not: add to errors list "missing required file skill.json"
  - [x] 2.3: Check `SKILL.md` exists — if not: add to errors list "missing required file SKILL.md"
- [x] Task 3: Implement skill.json field validation (AC: #4)
  - [x] 3.1: Parse skill.json — if invalid JSON: `INVALID: skill.json is not valid JSON`
  - [x] 3.2: Validate required fields:
    - `name` (string, non-empty)
    - `version` (string, semver pattern)
    - `description` (string, present)
  - [x] 3.3: Validate optional fields if present:
    - `category` (one of: security, architecture, testing, documentation, workflow, language)
    - `tags` (array of strings)
    - `always_load` (boolean)
    - `author` (string)
    - `applies_when` (array of strings)
  - [x] 3.4: Report each field error individually: `  - name: required, must be a non-empty string`
- [x] Task 4: Implement template validation (AC: #5)
  - [x] 4.1: If `templates/` directory exists, scan for `.md` files
  - [x] 4.2: Extract agent name from filename (e.g., `claude-code.md` -> `claude-code`)
  - [x] 4.3: Check each name against agent registry keys from `lib/agents.js` (call `getAllAgents()`)
  - [x] 4.4: Warn (yellow) about unknown agents: `Warning: Template 'unknown-agent.md' targets unknown agent 'unknown-agent'`
  - [x] 4.5: Valid templates get a checkmark: `  Template: claude-code.md (valid agent)`
- [x] Task 5: Implement output summary (AC: #1)
  - [x] 5.1: If all checks pass: print `VALID` (green) + metadata summary (name, version, category, tags count, always_load)
  - [x] 5.2: If any errors: print `INVALID` (red) + list of all errors
  - [x] 5.3: Exit code 0 on valid, 1 on invalid
- [x] Task 6: Test the command
  - [x] 6.1: Run on a known valid skill (e.g., `git-workflow-skill`) — verify VALID
  - [x] 6.2: Create a deliberately broken skill and validate — verify all errors caught
  - [x] 6.3: Test with template targeting unknown agent — verify warning

## Dev Notes

### Architecture Compliance

- **Module placement:** Add to `lib/skill-authoring.js` (created in Story 3-1). Validation logic lives alongside scaffolding — both are skill authoring tools.
- **Agent registry access:** Use `lib/agents.js` for template validation (AC #5). Import agent listing function to check template filenames. This is a read-only dependency — agents.js is "pure data + path functions" per the boundary table. [Source: architecture.md#Module-Boundaries]
- **No new dependencies.** JSON parsing is built-in. Semver validation can use a simple regex pattern — no need for the `semver` package.

### Validation Rules Summary

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Non-empty |
| `version` | string | Yes | Matches `/^\d+\.\d+\.\d+$/` (basic semver) |
| `description` | string | Yes | Non-empty |
| `category` | string | No | One of: security, architecture, testing, documentation, workflow, language |
| `tags` | array | No | Array of strings |
| `always_load` | boolean | No | Must be boolean if present |
| `author` | string | No | Non-empty string if present |
| `applies_when` | array | No | Array of strings |

### Output Format

**Valid skill:**
```
VALID: git-workflow-skill
  Name: Git Workflow
  Version: 2.1.0
  Category: workflow
  Tags: 6 tags
  Always Load: true
  Templates: claude-code.md (valid)
```

**Invalid skill:**
```
INVALID: broken-skill
  Errors:
  - missing required file SKILL.md
  - name: required, must be a non-empty string
  - version: must match semver format (e.g., 1.0.0)
  - category: must be one of: security, architecture, testing, documentation, workflow, language
  Warnings:
  - Template 'unknown-agent.md' targets unknown agent 'unknown-agent'
```

### Dependency on Story 3-1

This story depends on `lib/skill-authoring.js` being created in Story 3-1. If Story 3-1 is not yet implemented, create the module as part of this story. The module is lightweight — it exports functions, no class hierarchy.

### Critical Guardrails

- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]
- **Error format:** `Error: <what>` / `Hint: <fix>` [Source: architecture.md#Format-Patterns]
- **Read-only access to agents.js** — import listing function, do not modify agent registry
- **Exit code 0 on valid, 1 on invalid** — enables CI/CD usage of validation

### Project Structure Notes

- Files to modify: `bin/cli.js` (add command route), `lib/skill-authoring.js` (add validation function)
- No new files beyond what Story 3-1 creates
- No changes to existing skills, installer, or agents modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3] — Story 3.2 definition
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — FR39: Skill authoring format
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract (skill.json fields)
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Template resolution and agent registry
- [Source: _bmad-output/planning-artifacts/architecture.md#Format-Patterns] — Console output format
- [Source: lib/agents.js] — Agent registry for template validation

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward.

### Completion Notes List

- Added `validateSkill(skillName, skillsDir)` and `handleValidateSkill(args)` to `lib/skill-authoring.js`
- Added `getAllAgents` import from `lib/agents.js` for template agent-ID validation
- Added `VALID_CATEGORIES` constant and `SEMVER_PATTERN` regex at module scope
- Wired `validate-skill` into `bin/cli.js` switch + help text + import
- Added `validate-skill` to `npm test` in `package.json`
- Created `test/skill-validation.test.js` with 21 tests: 14 unit + 7 CLI integration, all passing
- Zero regressions across all 55 total project tests
- `validateSkill` returns `{ valid, notFound?, errors[], warnings[], metadata? }` — label-free data, display handled by handler
- Warnings (unknown agent templates) do not set `valid=false` — only errors do

### File List

- `lib/skill-authoring.js` (modified — added validateSkill, handleValidateSkill, constants)
- `bin/cli.js` (modified — added import, validate-skill case, help text)
- `test/skill-validation.test.js` (new)
- `package.json` (modified — added skill-validation.test.js to test script)

### Change Log

- 2026-03-19: Implemented Story 3.2 — validate-skill command with schema validation, template agent checks, and 21 tests
