# Story 3.4: BMAD Persona Customization Tooling

Status: review

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

- [x] Task 1: Add `customize-agent` command to CLI router (AC: #1)
  - [x] 1.1: Add `customize-agent` to command routing in `bin/cli.js`
  - [x] 1.2: Create `handleCustomizeAgent(args)` function in `lib/skill-authoring.js`
  - [x] 1.3: Add `customize-agent` to help text
- [x] Task 2: Implement agent validation (AC: #1)
  - [x] 2.1: `validateBmadAgent(agentName)` validates against CUSTOM_AGENTS and BUILTIN_AGENTS lists
  - [x] 2.2: Returns `{ valid: false, hint: '...Available: ...' }` for unknown agents; handler prints Error/Hint
- [x] Task 3: Implement customization wizard (AC: #1, #2)
  - [x] 3.1: `loadExistingCustomization(agentName, agentsDir)` returns raw YAML string or null
  - [x] 3.2: `generateCustomizeYaml` accepts persona data — included in output for custom agents
  - [x] 3.3: `generateCustomizeYaml` accepts menu data — included in output for custom agents
  - [x] 3.4: Critical actions 1-3 are hardcoded in MANDATORY_CRITICAL_ACTIONS, always emitted
  - [x] 3.5: `generateCustomizeYaml` accepts extraActions (keys ≥4) appended after mandatory actions
- [x] Task 4: Generate .customize.yaml (AC: #1, #3)
  - [x] 4.1: `writeCustomizeFile` writes to `agentsDir/<agent-name>.customize.yaml`
  - [x] 4.2: Custom agents: full file with optional persona + menu + critical_actions
  - [x] 4.3: Built-in agents: critical_actions only (no persona/menu)
  - [x] 4.4: YAML block style, quoted action strings
  - [x] 4.5: Header comment includes agent name
- [x] Task 5: Test the command
  - [x] 5.1: `validateBmadAgent` unit tests — custom/builtin/unknown/empty (4 tests)
  - [x] 5.2: `generateCustomizeYaml` unit tests — all YAML generation paths (7 tests)
  - [x] 5.3: `writeCustomizeFile` / `loadExistingCustomization` unit tests (3 tests)
  - [x] 5.4: CLI integration tests — unknown agent, no agent, --yes flag (3 tests)

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

claude-sonnet-4-6

### Debug Log References

None — implementation went GREEN on first attempt. Test file was written first (RED), then implementation produced all 17 tests passing immediately.

### Completion Notes List

- Added `validateBmadAgent`, `generateCustomizeYaml`, `writeCustomizeFile`, `loadExistingCustomization`, `handleCustomizeAgent` to `lib/skill-authoring.js`
- CUSTOM_AGENTS: bmm-sre, bmm-devops, bmm-cyber, bmm-mil498 (full customization)
- BUILTIN_AGENTS: bmm-pm, bmm-architect, bmm-dev, bmm-qa, bmm-sm, bmm-tech-writer, bmm-ux-designer (critical_actions only)
- MANDATORY_CRITICAL_ACTIONS (1-3) are immutable constants, hardcoded in module
- `--yes` flag generates minimal file in non-interactive mode (prints "non-interactive" in message)
- Added `handleCustomizeAgent` import and `customize-agent` switch case to `bin/cli.js`
- Added `customize-agent` to help text in `bin/cli.js`
- Created `test/skill-customize-agent.test.js` with 17 tests: 14 unit + 3 CLI integration, all passing
- 84 total project tests passing (was 67)

### File List

- `lib/skill-authoring.js` (modified — added 5 new functions)
- `bin/cli.js` (modified — import, switch case, help text)
- `test/skill-customize-agent.test.js` (new)
- `package.json` (modified — added skill-customize-agent.test.js to test script)

### Change Log

- 2026-03-19: Implemented Story 3.4 — customize-agent command, validateBmadAgent, generateCustomizeYaml, writeCustomizeFile, loadExistingCustomization, 17 tests
