# Story 3.5: Specialized Agent Development Tooling

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Note: This story is derived from FR42 in the PRD. It does not have a matching definition in the epics file. -->

## Story

As a **Chief Architect**,
I want CLI tooling to develop new specialized agent personas for enterprise-specific roles,
So that I can create purpose-built agents (like the existing SRE, DevOps, Cyber, MIL-498 agents) for additional organizational roles.

## Acceptance Criteria

1. **Given** the user runs `npx ma-agents create-agent <agent-name>`
   **When** the command executes
   **Then** a new agent scaffolding is generated with:
   - A `.customize.yaml` file with persona, menu, and critical_actions sections (template-filled)
   - The agent is registered as a "custom" type (full customization)
   - Skill-loading critical_actions 1-3 are pre-populated

2. **Given** the agent name conflicts with an existing agent
   **When** the create-agent command is run
   **Then** the command fails with an error listing the conflicting agent

3. **Given** the new agent is created
   **When** BMAD is installed with the extension module
   **Then** the new agent appears in the BMAD agent menu and can be loaded

## Tasks / Subtasks

- [ ] Task 1: Add `create-agent` command to CLI router (AC: #1, #2)
  - [ ] 1.1: Add `create-agent` to command routing in `bin/cli.js`
  - [ ] 1.2: Create `createAgent(agentName)` function in `lib/skill-authoring.js`
  - [ ] 1.3: Add `create-agent` to help text
- [ ] Task 2: Implement agent name validation (AC: #2)
  - [ ] 2.1: Validate name is kebab-case with `bmm-` prefix: pattern `/^bmm-[a-z][a-z0-9]*(-[a-z0-9]+)*$/`
  - [ ] 2.2: If missing `bmm-` prefix, auto-prepend it and inform user: `Agent name normalized to 'bmm-<name>'`
  - [ ] 2.3: Check against existing agents in `lib/bmad-extension/agents/` directory — if exists: `Error: Agent 'bmm-<name>' already exists` / `Hint: Use customize-agent to modify it, or choose a different name`
- [ ] Task 3: Interactive agent definition wizard (AC: #1)
  - [ ] 3.1: Prompt for persona description (multiline text): role name, expertise areas, communication tone, operational focus
  - [ ] 3.2: Prompt for menu items: list of workflows/commands the agent offers (freeform or structured)
  - [ ] 3.3: Auto-include critical_actions 1-3 (immutable skill loading):
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "Follow all skill directives during this session"
    ```
  - [ ] 3.4: Prompt for additional critical_actions (4+) specific to this agent's role
- [ ] Task 4: Generate agent files (AC: #1, #3)
  - [ ] 4.1: Generate `lib/bmad-extension/agents/<agent-name>.customize.yaml` with full customization (persona + menu + critical_actions)
  - [ ] 4.2: Use YAML block style, quoted action strings per architecture patterns
  - [ ] 4.3: Add header comment: `# MA-AGENTS: full customization for <agent-name>`
  - [ ] 4.4: Update `lib/bmad-extension/module-help.csv` if the agent should appear in BMAD's phase registration (check existing CSV format)
- [ ] Task 5: Print next steps guidance (AC: #3)
  - [ ] 5.1: Print success: `Agent '<agent-name>' created at lib/bmad-extension/agents/<agent-name>.customize.yaml`
  - [ ] 5.2: Print next steps:
    ```
    Next steps:
    1. Review and refine the persona in the .customize.yaml file
    2. Run 'npx ma-agents install' to deploy the extension module
    3. Run 'npx bmad-method install --action recompile' to activate the agent
    4. The agent will appear in the BMAD agent menu
    ```
- [ ] Task 6: Test the command
  - [ ] 6.1: Run `create-agent bmm-test-role` — verify files created
  - [ ] 6.2: Run `create-agent bmm-test-role` again — verify duplicate error
  - [ ] 6.3: Run `create-agent test-role` — verify auto-prefix to `bmm-test-role`
  - [ ] 6.4: Verify generated YAML is valid and matches architecture patterns
  - [ ] 6.5: Clean up test agent after testing

## Dev Notes

### Architecture Compliance

- **New agents are "custom" type:** All user-created agents get full customization (persona + menu + critical_actions), same as SRE/DevOps/Cyber/MIL-498. They are NOT "built-in" — built-in agents are the 7 standard BMM agents that ship with bmad-method. [Source: architecture.md#Decision-P2-4]
- **Extension module deployment:** New agents live in `lib/bmad-extension/agents/` and are deployed to the BMAD installation via `bmad.js` during install. No changes to `bmad.js` needed — it copies the entire extension directory. [Source: architecture.md#Decision-P2-3]
- **critical_actions 1-3 are immutable** and identical to all other agents. [Source: architecture.md#Decision-P2-4]
- **BMAD naming convention:** Agent names use `bmm-` prefix + kebab-case role (e.g., `bmm-sre`, `bmm-devops`). [Source: architecture.md#Naming-Patterns]

### Relationship to Story 3-4

This story creates NEW agents. Story 3-4 customizes EXISTING agents. They share:
- Same output directory (`lib/bmad-extension/agents/`)
- Same `.customize.yaml` format
- Same critical_actions 1-3 template
- Same module (`lib/skill-authoring.js`)

The key difference: `create-agent` always generates full customization (custom agent), while `customize-agent` respects the built-in vs custom distinction.

### module-help.csv Registration

The BMAD `module-help.csv` maps agent names to their capabilities for phase registration. New custom agents may need an entry here. Check the existing CSV format:
- If it maps agent-name -> available workflows, add the new agent
- If it only lists module-level registration, no change needed

### Interactive Prompts and --yes Mode

Like Story 3-4, agent creation is inherently interactive (persona requires human input). In `--yes` mode, either skip or generate a minimal placeholder that the user edits manually.

### Critical Guardrails

- **critical_actions 1-3 are NEVER modifiable** [Source: architecture.md#Decision-P2-4]
- **New agents are always "custom" type** — full persona + menu + critical_actions
- **YAML block style, quoted strings** [Source: architecture.md#Extension-Module-Authoring-Patterns]
- **`bmm-` prefix required** for BMAD agent naming [Source: architecture.md#Naming-Patterns]
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]

### Project Structure Notes

- Files to modify: `bin/cli.js` (add command route), `lib/skill-authoring.js` (add function)
- Files created by the tool: `lib/bmad-extension/agents/<agent-name>.customize.yaml`
- Possibly modify: `lib/bmad-extension/module-help.csv` (agent registration)

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR42] — FR42: Develop new specialized agent personas
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-P2-3] — Extension module structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-P2-4] — critical_actions patterns, custom vs built-in
- [Source: _bmad-output/planning-artifacts/architecture.md#Extension-Module-Authoring-Patterns] — YAML format and rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] — bmm- prefix convention
- [Source: lib/bmad-extension/agents/] — Target directory for agent files
- [Source: lib/bmad-extension/module-help.csv] — Phase registration file

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
