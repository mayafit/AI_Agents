# Story 3.3: Mandatory Skill Designation Tooling

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Note: This story is derived from FR40 in the PRD. It does not have a matching definition in the epics file. -->

## Story

As a **Chief Architect**,
I want to designate skills as mandatory (`always_load: true`) through a CLI command,
So that I can enforce organizational standards by ensuring critical skills are always loaded by agents.

## Acceptance Criteria

1. **Given** the user runs `npx ma-agents set-mandatory <skill-name>`
   **When** the skill exists and `always_load` is currently `false` or absent
   **Then** `skill.json` is updated with `always_load: true`
   **And** MANIFEST.yaml is regenerated to reflect the change
   **And** a success message confirms the skill is now mandatory

2. **Given** the user runs `npx ma-agents set-mandatory <skill-name> --off`
   **When** the skill exists and `always_load` is currently `true`
   **Then** `skill.json` is updated with `always_load: false`
   **And** MANIFEST.yaml is regenerated to reflect the change

3. **Given** the user runs `npx ma-agents list --mandatory`
   **When** skills with `always_load: true` exist
   **Then** only mandatory skills are listed with their metadata

## Tasks / Subtasks

- [ ] Task 1: Add `set-mandatory` command to CLI router (AC: #1, #2)
  - [ ] 1.1: Add `set-mandatory` to command routing in `bin/cli.js`
  - [ ] 1.2: Create `setMandatory(skillName, enable)` function in `lib/skill-authoring.js`
  - [ ] 1.3: Parse `--off` flag to determine enable/disable
  - [ ] 1.4: Add `set-mandatory` to help text
- [ ] Task 2: Implement always_load toggle (AC: #1, #2)
  - [ ] 2.1: Validate skill exists: check `skills/<skill-name>/skill.json` — if not found: `Error: Skill '<skill-name>' not found`
  - [ ] 2.2: Read `skill.json`, parse JSON
  - [ ] 2.3: Set `always_load` to `true` (default) or `false` (with `--off`)
  - [ ] 2.4: Write back `skill.json` preserving all existing fields and formatting (use `JSON.stringify(data, null, 2)`)
  - [ ] 2.5: Print confirmation: `Skill '<skill-name>' is now mandatory (always_load: true)` or `Skill '<skill-name>' is no longer mandatory (always_load: false)`
- [ ] Task 3: Regenerate MANIFEST.yaml (AC: #1, #2)
  - [ ] 3.1: After updating skill.json, trigger MANIFEST.yaml regeneration
  - [ ] 3.2: Check how MANIFEST.yaml is currently generated — it may happen during `install` only. If so, call the existing generation function from `lib/installer.js` (search: `MANIFEST` or `generateManifest`)
  - [ ] 3.3: If no standalone generation function exists, extract it from the install flow into a reusable function
- [ ] Task 4: Add `--mandatory` filter to list command (AC: #3)
  - [ ] 4.1: Add `--mandatory` flag parsing to the `list` command handler
  - [ ] 4.2: When `--mandatory` is present, filter skills to only those with `always_load: true`
  - [ ] 4.3: Display filtered list using existing list output format
- [ ] Task 5: Test the command
  - [ ] 5.1: Run `set-mandatory` on a skill with `always_load: false` — verify update
  - [ ] 5.2: Run `set-mandatory --off` on a mandatory skill — verify toggle
  - [ ] 5.3: Run `list --mandatory` — verify filtering
  - [ ] 5.4: Verify MANIFEST.yaml reflects changes

## Dev Notes

### Architecture Compliance

- **Module placement:** `lib/skill-authoring.js` (same module as stories 3-1, 3-2)
- **MANIFEST.yaml dependency:** The MANIFEST.yaml generation may currently be coupled to the install flow in `lib/installer.js`. This story may require extracting a `regenerateManifest()` function that can be called independently. This is a minor refactor within `installer.js` — not a boundary violation.
- **File operations:** Read-modify-write pattern for skill.json. Use `JSON.stringify(data, null, 2)` for consistent formatting. Use `path.join()` for all paths.

### Currently Mandatory Skills

From the codebase analysis, these skills currently have `always_load: true`:
- `python-security-skill`
- `code-documentation`
- `git-workflow-skill`
- `ai-audit-trail`

This command provides a CLI interface to manage this flag rather than requiring manual JSON editing.

### MANIFEST.yaml Regeneration

The MANIFEST.yaml is the agent-facing index of all skills. When `always_load` changes, agents need the updated manifest to know which skills to auto-load. The regeneration must:
1. Scan all `skills/*/skill.json` files
2. Build the manifest data structure
3. Write to `skills/MANIFEST.yaml`

If this logic is currently embedded in the install flow, extract it as a standalone function that both `install` and `set-mandatory` can call.

### Critical Guardrails

- **Preserve existing skill.json fields** — read, modify `always_load` only, write back all fields
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]
- **Error format:** `Error: <what>` / `Hint: <fix>` [Source: architecture.md#Format-Patterns]
- **snake_case** keys in skill.json [Source: architecture.md#JSON/YAML-Fields]

### Project Structure Notes

- Files to modify: `bin/cli.js` (add command routes), `lib/skill-authoring.js` (add function), possibly `lib/installer.js` (extract manifest generation)
- No new files
- No changes to existing skills content

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR40] — FR40: Mandatory skill designation
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract (always_load field)
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Skill library scanning
- [Source: skills/MANIFEST.yaml] — Generated skill index consumed by agents

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
