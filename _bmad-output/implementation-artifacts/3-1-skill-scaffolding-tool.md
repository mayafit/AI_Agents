# Story 3.1: Skill Scaffolding Command

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to run `npx ma-agents create-skill <skill-name>` to generate a new skill directory with all required files,
So that I can author new skills quickly without manually creating the directory structure.

## Acceptance Criteria

1. **Given** the user runs `npx ma-agents create-skill my-new-skill`
   **When** the command executes
   **Then** a directory `skills/my-new-skill/` is created with:
   - `skill.json` populated with name, version "1.0.0", empty description, default category, empty tags, `always_load: false`
   - `SKILL.md` with a template structure including placeholder content sections
   - `templates/` directory (empty, ready for agent-specific templates)
   - `references/` directory (empty)
   - `assets/` directory (empty)

2. **Given** a skill with the same name already exists
   **When** the create-skill command is run
   **Then** the command fails with an error message and does not overwrite the existing skill
   **And** a hint suggests using a different name or removing the existing skill first

3. **Given** the skill name contains invalid characters (spaces, uppercase, special chars)
   **When** the create-skill command is run
   **Then** the command fails with an error explaining kebab-case naming requirement

## Tasks / Subtasks

- [ ] Task 1: Add `create-skill` command to CLI router (AC: #1, #2, #3)
  - [ ] 1.1: Add `create-skill` to the command routing in `bin/cli.js` (search: command routing logic, likely a switch/if-else block handling `install`, `list`, `status`, `uninstall`)
  - [ ] 1.2: Create handler function `handleCreateSkill(args)` in `bin/cli.js` or a new `lib/skill-authoring.js` module (see Dev Notes on module placement)
  - [ ] 1.3: Add `create-skill` to help text (search: `console.log.*Usage`)
- [ ] Task 2: Implement name validation (AC: #3)
  - [ ] 2.1: Validate skill name matches kebab-case pattern: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`
  - [ ] 2.2: On invalid name: print `Error: Skill name must be kebab-case (lowercase letters, numbers, hyphens)` / `Hint: Example: my-new-skill, python-linting, api-security`
  - [ ] 2.3: Exit with code 1 on validation failure
- [ ] Task 3: Implement duplicate detection (AC: #2)
  - [ ] 3.1: Check if `skills/<skill-name>/` directory already exists
  - [ ] 3.2: On duplicate: print `Error: Skill '<skill-name>' already exists at skills/<skill-name>/` / `Hint: Choose a different name or remove the existing skill first`
  - [ ] 3.3: Exit with code 1 on duplicate
- [ ] Task 4: Generate skill directory and files (AC: #1)
  - [ ] 4.1: Create `skills/<skill-name>/` directory
  - [ ] 4.2: Generate `skill.json` with template values:
    ```json
    {
      "name": "<Skill Name from kebab>",
      "description": "",
      "version": "1.0.0",
      "category": "workflow",
      "author": "ma-agents",
      "tags": [],
      "always_load": false
    }
    ```
    Convert kebab-case to Title Case for the name field (e.g., `my-new-skill` -> `My New Skill`)
  - [ ] 4.3: Generate `SKILL.md` with template structure (see Dev Notes for template content)
  - [ ] 4.4: Create empty directories: `templates/`, `references/`, `assets/`
  - [ ] 4.5: Print success message: `Skill '<skill-name>' created at skills/<skill-name>/`
  - [ ] 4.6: Print next steps hint: `  Next: Edit skill.json and SKILL.md to add your skill content`
- [ ] Task 5: Test the command
  - [ ] 5.1: Run `npx ma-agents create-skill test-skill` and verify all files/dirs created
  - [ ] 5.2: Run `npx ma-agents create-skill test-skill` again and verify duplicate error
  - [ ] 5.3: Run `npx ma-agents create-skill InvalidName` and verify kebab-case error
  - [ ] 5.4: Run `npx ma-agents list` and verify new skill appears
  - [ ] 5.5: Clean up test skill directory after testing

## Dev Notes

### Architecture Compliance

- **Command routing:** New commands are added to the CLI router in `bin/cli.js`. The router dispatches to handler functions. [Source: architecture.md#Module-Boundaries]
- **Module placement decision:** This command primarily creates files on disk. Two options:
  1. **Inline in cli.js** — if the logic is <50 lines, keep it in cli.js as a handler function (simpler, follows existing pattern for simple commands)
  2. **New module `lib/skill-authoring.js`** — if the logic grows beyond scaffolding (validation, test-install in stories 3-2/3-3), create a new module. The 4-module architecture allows new modules when genuinely needed. [Source: architecture.md#Enforcement-Guidelines]
  **Recommendation:** Create `lib/skill-authoring.js` since Epic 3 has multiple skill authoring commands that share context. This keeps cli.js as a thin router.
- **File operations:** Use `fs.mkdirSync` with `{ recursive: true }` for directory creation. Use `path.join()` for all paths. [Source: architecture.md#Enforcement-Guidelines]
- **No new dependencies:** Use Node.js built-in `fs` and `path` only.

### SKILL.md Template Content

The generated SKILL.md should provide a useful starting structure:

```markdown
# <Skill Name>

<Brief description of what this skill does and when it applies.>

## Policies

### 1. <First Policy>

**Rule:** <What the agent must do or not do>

**Action:**
- <Specific instruction>
- <Specific instruction>

### 2. <Second Policy>

**Rule:** <What the agent must do or not do>

**Action:**
- <Specific instruction>

## References

- <Link to any supporting documents in references/ directory>
```

This matches the policy-based pattern used by existing skills (e.g., `cpp-memory-handling`, `python-security-skill`).

### skill.json Default Category

The architecture specifies valid categories: `security|architecture|testing|documentation|workflow|language`. Default to `"workflow"` as the most generic category. The author will change it to the appropriate category.

### Kebab-to-Title Conversion

For the `name` field in skill.json, convert kebab-case to Title Case:
- `my-new-skill` -> `My New Skill`
- `python-best-practices` -> `Python Best Practices`
- `api-security` -> `Api Security`

Simple implementation: `name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')`

### Critical Guardrails

- **Use `path.join()` for all file paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]
- **Error format:** `Error: <what>` then `  Hint: <how to fix>` [Source: architecture.md#Format-Patterns]
- **Console output:** plain text, chalk colors, no emoji [Source: architecture.md#Format-Patterns]
- **File naming:** `kebab-case` for directories, `snake_case` for skill.json keys [Source: architecture.md#Naming-Patterns]

### Project Structure Notes

- Files to modify: `bin/cli.js` (add command route)
- Files to create: `lib/skill-authoring.js` (new module for skill authoring commands)
- No changes to existing skills, installer, or agents modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3] — Story 3.1 definition
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — FR39: Skill authoring format
- [Source: _bmad-output/planning-artifacts/architecture.md#Skill-Directory-Structure] — Mandatory skill structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Skill schema contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] — Naming conventions
- [Source: _bmad-output/planning-artifacts/architecture.md#Format-Patterns] — Console output and error format
- [Source: skills/skill-creator/SKILL.md] — Existing skill-creator skill (reference for authoring guidance)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
