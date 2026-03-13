# Story 9.1: Register OpenCode Agent in Registry

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want OpenCode added to agents.js as the 13th agent with JSON injection strategy,
So that the installer can target OpenCode using the same config-driven pattern.

## Acceptance Criteria

1. **Given** the agents.js registry, **When** the OpenCode agent entry is added, **Then** it includes: name: 'opencode', category: 'ide', configDir: '.opencode', skillsDir: '.opencode/skills', instructionFile: 'opencode.json', **And** injectionStrategy is { position: 'json-merge', targetKey: 'instructions' }
2. **Given** the installer runs with --agent opencode, **When** agent resolution occurs, **Then** OpenCode is found and processed like any other agent, **And** no code changes to installer.js were needed (NFR13)

## Tasks / Subtasks

- [ ] Add OpenCode agent object to agents array in lib/agents.js (AC: #1)
  - [ ] Define agent entry with id 'opencode', name 'OpenCode', version '1.0.0', category 'ide'
  - [ ] Set projectPath.skills to '.opencode/skills'
  - [ ] Set fileExtension to '.md'
  - [ ] Set template to 'generic'
  - [ ] Set instructionFiles to ['opencode.json']
  - [ ] Set injectionStrategy to { position: 'json-merge', targetKey: 'instructions' }
- [ ] Verify agent count is now 13 (AC: #1)
- [ ] Test that --agent opencode resolves correctly through existing installer logic (AC: #2)
- [ ] Verify no changes to installer.js are required for agent resolution (AC: #2)

## Dev Notes

### Architecture Compliance
- NFR13: Config-driven registry pattern. Adding an agent must only require a new entry in agents.js, no installer.js changes for resolution.
- Agent structure must follow the exact same shape as existing agents (e.g., claude-code at lines 18-38 of agents.js).
- The injectionStrategy field is new to this agent and will be consumed by Story 9-2's JSON merge logic in installer.js.

### Critical Guardrails
- Do NOT modify installer.js for this story — agent resolution must work via existing config-driven patterns
- Do NOT hardcode agent names anywhere in the installer
- Do NOT change the structure of existing agent entries
- The agent count after this change is 13 (there are already 12 agents including antigravity)

### Project Structure Notes
- Modify: `lib/agents.js` — add one new agent object to the agents array
- No new files created

### References
- [Source: lib/agents.js — existing agent entries for structure reference]
- [Source: lib/installer.js#L110 — updateAgentInstructions() for context on how agents are consumed]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
