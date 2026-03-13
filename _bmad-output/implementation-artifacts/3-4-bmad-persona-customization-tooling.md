# Story 3.4: BMAD Persona Customization Tooling

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Note: This story is derived from FR41 in the PRD. It does not have a matching definition in the epics file. -->

## Story

As a **Chief Architect**,
I want CLI tooling to customize BMAD agent personas for organizational processes,
So that I can adapt BMAD agents (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer) to fit our team's specific workflows without manually editing YAML files.

## Acceptance Criteria

1. **Given** the user runs `npx ma-agents customize-agent <agent-name>`
   **When** the agent exists in the BMAD agent registry
   **Then** an interactive wizard guides through persona customization:
   - Persona description (role, tone, expertise areas)
   - Menu items (available workflows/commands)
   - Critical actions (skill loading, custom pre-session actions)
   **And** a `.customize.yaml` file is generated in the BMAD extension directory

2. **Given** a `.customize.yaml` already exists for the agent
   **When** the customize command is run
   **Then** the existing customization is loaded as defaults in the wizard
   **And** the user can modify individual sections without re-entering everything

3. **Given** the customization is saved
   **When** BMAD is recompiled (via `npx bmad-method install --action recompile`)
   **Then** the agent reflects the customized persona, menu, and critical actions

## Tasks / Subtasks

- [ ] Task 1: Add `customize-agent` command to CLI router (AC: #1)
  - [ ] 1.1: Add `customize-agent` to command routing in `bin/cli.js`
  - [ ] 1.2: Create `customizeAgent(agentName)` function in `lib/skill-authoring.js`
  - [ ] 1.3: Add `customize-agent` to help text
- [ ] Task 2: Implement agent validation (AC: #1)
  - [ ] 2.1: Validate `agentName` is a known BMAD agent — check against the BMAD agent names in the extension module or a known list (SRE, DevOps, Cyber, MIL-498 for custom; PM, Architect, Dev, QA, SM, Tech Writer, UX Designer for built-in)
  - [ ] 2.2: If unknown: `Error: Unknown BMAD agent '<name>'` / `Hint: Available agents: bmm-sre, bmm-devops, bmm-cyber, bmm-mil498, bmm-pm, bmm-architect, bmm-dev, bmm-qa, bmm-sm, bmm-tech-writer, bmm-ux-designer`
- [ ] Task 3: Implement customization wizard (AC: #1, #2)
  - [ ] 3.1: If existing `.customize.yaml` found, load it as defaults
  - [ ] 3.2: Prompt for persona section (text input, multiline) — pre-filled if existing
  - [ ] 3.3: Prompt for menu items (structured input or freeform YAML) — pre-filled if existing
  - [ ] 3.4: Auto-include `critical_actions` 1-3 (skill loading — these are mandatory and identical across all agents per architecture):
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
  - [ ] 3.5: Prompt for additional critical actions (4+) if the user wants agent-specific actions
- [ ] Task 4: Generate .customize.yaml (AC: #1, #3)
  - [ ] 4.1: Determine output path: `lib/bmad-extension/agents/<agent-name>.customize.yaml`
  - [ ] 4.2: For **custom agents** (SRE, DevOps, Cyber, MIL-498): generate full file with persona + menu + critical_actions
  - [ ] 4.3: For **built-in agents** (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer): generate minimal file with critical_actions only (no persona/menu override per architecture decision P2-4)
  - [ ] 4.4: Write YAML using block style (not flow style), quoted action strings
  - [ ] 4.5: Add header comment: `# MA-AGENTS: customization for <agent-name>`
- [ ] Task 5: Test the command
  - [ ] 5.1: Run `customize-agent bmm-sre` — verify full customization wizard
  - [ ] 5.2: Run `customize-agent bmm-pm` — verify minimal (critical_actions only) path
  - [ ] 5.3: Run again on existing — verify defaults loaded
  - [ ] 5.4: Verify generated YAML is valid

## Dev Notes

### Architecture Compliance

- **Extension module structure:** All customize files go to `lib/bmad-extension/agents/`. This is the BMAD extension directory defined in architecture decision P2-3. [Source: architecture.md#Decision-P2-3]
- **critical_actions 1-3 are immutable:** These are identical across all 11 agents per P2-4. The tooling must always include them and never allow modification. Custom actions start at index 4+. [Source: architecture.md#Decision-P2-4]
- **Built-in vs Custom distinction:** Built-in BMM agents (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer) get ONLY critical_actions — no persona or menu overrides. Custom agents (SRE, DevOps, Cyber, MIL-498) get full customization. This distinction MUST be enforced by the tool.
- **YAML format:** Block style, quoted strings, per extension module authoring patterns. [Source: architecture.md#Extension-Module-Authoring-Patterns]

### Agent Categories

| Category | Agents | Customization Level |
|----------|--------|-------------------|
| Custom | bmm-sre, bmm-devops, bmm-cyber, bmm-mil498 | Full: persona + menu + critical_actions |
| Built-in | bmm-pm, bmm-architect, bmm-dev, bmm-qa, bmm-sm, bmm-tech-writer, bmm-ux-designer | Minimal: critical_actions only |

### Existing Customize Files

Check `lib/bmad-extension/agents/` for existing `.customize.yaml` files. If the directory or files don't exist yet (Phase 2 not implemented), create the directory structure. This story creates the tooling — the actual files may be created by this tool or by Epic 8 (Skill Enforcement Architecture).

### Interactive Prompts and --yes Mode

If `--yes` flag is active (from Story 1-1), this command should either:
- Skip with a message: `Skipping customize-agent in non-interactive mode` (since customization is inherently interactive)
- Or use sensible defaults: generate minimal critical_actions-only file

Recommend the skip approach — persona customization requires human input.

### Critical Guardrails

- **critical_actions 1-3 are NEVER modifiable** — hardcode them [Source: architecture.md#Decision-P2-4]
- **Built-in agents MUST NOT get persona/menu overrides** [Source: architecture.md#Decision-P2-4]
- **YAML block style, quoted strings** [Source: architecture.md#Extension-Module-Authoring-Patterns]
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** — use built-in YAML generation (simple template strings for YAML output, or extract from existing bmad.js patterns)

### Project Structure Notes

- Files to modify: `bin/cli.js` (add command route), `lib/skill-authoring.js` (add function)
- Files created by the tool: `lib/bmad-extension/agents/<agent-name>.customize.yaml`
- Directory to ensure exists: `lib/bmad-extension/agents/`

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR41] — FR41: Customize BMAD agent personas
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-P2-3] — Extension module structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-P2-4] — critical_actions for all agents
- [Source: _bmad-output/planning-artifacts/architecture.md#Extension-Module-Authoring-Patterns] — YAML format rules
- [Source: lib/bmad-extension/agents/] — Target directory for customize files

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
