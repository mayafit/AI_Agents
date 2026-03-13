# Story 7.1: Set Up Test Framework and First Tests for agents.js

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want a test framework configured with initial tests for the agent registry module,
So that agent configuration changes are verified automatically.

## Acceptance Criteria

1. **Given** Node.js built-in test runner is configured in `package.json`
   **When** `npm test` is executed
   **Then** tests run and report results (exit 0 on pass, non-zero on failure)

2. **Given** tests exist for `agents.js`
   **When** the test suite runs
   **Then** it verifies:
   - All 11 agents are registered with required fields (`id`, `name`, `version`, `category`, `description`, `getProjectPath`, `getGlobalPath`, `fileExtension`, `template`, `instructionFiles`)
   - `getProjectPath()` returns a string containing the agent's expected directory name
   - `getGlobalPath()` returns a valid path for the current OS
   - `resourceMap` is defined for agents that need it (currently only `cline`)
   - No duplicate agent `id` values exist in the registry
   - `getAgent(id)` returns the correct agent object
   - `getAllAgents()` returns all 11 agents
   - `getAgentsByCategory('ide')` returns 7 agents, `getAgentsByCategory('bmad')` returns 4 agents

## Tasks / Subtasks

- [ ] Task 1: Configure Node.js built-in test runner (AC: #1)
  - [ ] 1.1: Replace the current placeholder test script in `package.json:11` with `node --test tests/`
  - [ ] 1.2: Verify `node --test` works with the project's minimum Node.js version (`>=16.0.0` per `package.json:33`) — Note: `node --test` requires Node 18+. If minimum version must stay at 16, consider `node --test tests/*.test.js` with a version check
  - [ ] 1.3: Create `tests/` directory at project root
  - [ ] 1.4: Run `npm test` — verify it discovers and runs test files (even if empty initially)
- [ ] Task 2: Write agents.js tests (AC: #2)
  - [ ] 2.1: Create `tests/agents.test.js`
  - [ ] 2.2: Test: `getAllAgents()` returns exactly 11 agents
  - [ ] 2.3: Test: every agent has all required fields (`id`, `name`, `version`, `category`, `description`, `getProjectPath`, `getGlobalPath`, `fileExtension`, `template`, `instructionFiles`)
  - [ ] 2.4: Test: `getProjectPath()` returns a string for each agent
  - [ ] 2.5: Test: `getGlobalPath()` returns a string for each agent
  - [ ] 2.6: Test: no duplicate `id` values across agents
  - [ ] 2.7: Test: `getAgent('claude-code')` returns agent with `name: 'Claude Code'`
  - [ ] 2.8: Test: `getAgent('nonexistent')` returns `undefined`
  - [ ] 2.9: Test: `getAgentsByCategory('ide')` returns 7 agents
  - [ ] 2.10: Test: `getAgentsByCategory('bmad')` returns 4 agents
  - [ ] 2.11: Test: `cline` agent has `resourceMap` with `references` and `assets` keys
  - [ ] 2.12: Test: agents without `resourceMap` don't have the property (or it's undefined)
  - [ ] 2.13: Test: all `instructionFiles` entries are non-empty strings

## Dev Notes

### Architecture Compliance

- **Test location:** `tests/` directory at project root, mirroring source structure. Co-located tests are not used. [Source: architecture.md#Structure-Patterns]
- **No new runtime dependencies:** The test runner is built into Node.js. No Jest, Mocha, or Vitest needed. [Source: architecture.md#Anti-Patterns]
- **Test framework decision:** Architecture recommends Node.js built-in test runner (no dependencies, aligns with minimal approach). [Source: architecture.md#Infrastructure-Deployment]

### Node.js Built-in Test Runner

Use `node:test` module (available since Node 18.x, stable in Node 20+):

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getAgent, getAllAgents, getAgentsByCategory } = require('../lib/agents');

describe('agents registry', () => {
  it('should have 11 agents', () => {
    assert.strictEqual(getAllAgents().length, 11);
  });
});
```

Run with: `node --test tests/`

### Node.js Version Consideration

Current `package.json` specifies `"node": ">=16.0.0"`. The built-in test runner requires Node 18+. Options:
1. **Recommended:** Bump minimum to `>=18.0.0` (Node 16 EOL was September 2023 — well past)
2. **Alternative:** Keep >=16 but note tests require 18+ (add check in test script)

### Current Test Script

The existing `package.json` test script is a placeholder:
```json
"test": "node -e \"const {listSkills,listAgents}=require('./lib/installer'); console.log('Skills:',listSkills().length,'Agents:',listAgents().length)\""
```
This should be replaced with the proper test runner command.

### Exported Functions from agents.js

From [agents.js:256-272](lib/agents.js#L256-L272):
- `getAgent(agentId)` — returns single agent by id
- `getAllAgents()` — returns full array (11 agents)
- `getAgentsByCategory(category)` — filtered by 'ide' or 'bmad'

### Agent Registry Schema (from actual code)

Every agent object has these fields (verified from [agents.js:17-253](lib/agents.js#L17-L253)):
- `id` (string) — unique identifier (e.g., 'claude-code', 'copilot')
- `name` (string) — display name (e.g., 'Claude Code', 'GitHub Copilot')
- `version` (string) — semver (e.g., '1.0.0')
- `category` (string) — 'ide' or 'bmad'
- `description` (string) — brief description
- `getProjectPath` (function) — returns project-level skills directory path
- `getGlobalPath` (function) — returns global/user-level skills directory path
- `fileExtension` (string) — '.md' for all current agents
- `template` (string) — 'claude-code', 'cline', or 'generic'
- `instructionFiles` (array of strings) — instruction file paths

Optional:
- `resourceMap` (object) — only on `cline` agent (maps 'references' → 'docs', 'assets' → 'templates')

### Critical Guardrails

- **No new npm dependencies** — use Node.js built-in `node:test` and `node:assert` only
- **Tests must not modify the file system** — agents.js is pure data + functions, no side effects
- **Do not modify `lib/agents.js`** — tests should validate existing behavior, not change it

### Project Structure Notes

- Files to create: `tests/agents.test.js`
- Files to modify: `package.json` (update test script, optionally bump engine version)
- No changes to `lib/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7] — Story 7.1 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure-Patterns] — Tests directory location
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-Deployment] — Test framework recommendation
- [Source: lib/agents.js] — Agent registry (11 agents, 272 lines, 3 exported functions)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
