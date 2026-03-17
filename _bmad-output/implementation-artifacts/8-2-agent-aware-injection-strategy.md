# Story 8.2: Add Agent-Aware Injection Strategy to Registry

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want each agent in agents.js to have an injectionStrategy property specifying format, position, and skip patterns,
So that the installer can inject instructions correctly without hardcoding per-agent logic.

## Acceptance Criteria

1. **Given** the agents.js registry,
   **When** any agent entry is reviewed,
   **Then** each agent has an `injectionStrategy` object with `position` and optional `skipPatterns`,
   **And** markdown agents have `position: 'top'` with appropriate skip patterns

2. **Given** installer.js performs injection,
   **When** it processes any agent,
   **Then** it reads `injectionStrategy` from agent's registry entry,
   **And** all format-awareness logic lives in agents.js, not installer.js

## Tasks / Subtasks

- [x] Task 1: Add injectionStrategy to all 7 IDE agents (AC: #1)
  - [x] 1.1: Add to `claude-code` agent (line 19): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
    - Claude Code's `.claude/CLAUDE.md` may have YAML frontmatter
  - [x] 1.2: Add to `gemini` agent (line 40): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 1.3: Add to `copilot` agent (line 61): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 1.4: Add to `kilocode` agent (line 82): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 1.5: Add to `cline` agent (line 103): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 1.6: Add to `cursor` agent (line 129): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 1.7: Add to `antigravity` agent (object starts line 170, id at line 171): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`

- [x] Task 2: Add injectionStrategy to all 4 BMAD agents (AC: #1)
  - [x] 2.1: Add to `bmm-sre` agent (id at line 150): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 2.2: Add to `bmm-devops` agent (id at line 192): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 2.3: Add to `bmm-cyber` agent (id at line 213): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
  - [x] 2.4: Add to `bmm-mil498` agent (id at line 234): `injectionStrategy: { position: 'top', skipPatterns: ['---'] }`
    - BMAD agent instruction files (e.g., `_bmad/bmm/agents/sre.md`) may have YAML frontmatter

- [x] Task 3: Verify installer.js reads injectionStrategy (AC: #2)
  - [x] 3.1: Confirm that Story 8.1's implementation in `updateAgentInstructions()` reads `agent.injectionStrategy`
  - [x] 3.2: Verify the default fallback exists: if `injectionStrategy` is undefined, default to `{ position: 'top', skipPatterns: [] }`
  - [x] 3.3: Verify installer.js contains NO agent-name-specific logic (no `if (agent.id === 'claude-code')` patterns) — all format awareness comes from the injectionStrategy property

- [x] Task 4: Validate the registry is complete (AC: #1)
  - [x] 4.1: Count all agents in the registry — should be 11 total (7 IDE + 4 BMAD). IDE agents: claude-code, gemini, copilot, kilocode, cline, cursor, antigravity. BMAD agents: bmm-sre, bmm-devops, bmm-cyber, bmm-mil498.
  - [x] 4.2: Verify every agent entry has `injectionStrategy` — no agent should be missing it
  - [x] 4.3: Verify all agents using `.md` instruction files have `skipPatterns: ['---']`

- [x] Task 5: Manual verification (AC: #1, #2)
  - [x] 5.1: Run `npx ma-agents install` for Claude Code — verified via automated test that injectionStrategy is read and TOP injection works
  - [x] 5.2: Run `npx ma-agents install` for a BMAD agent — verified via automated test (Story 8.1 test 4.5)
  - [x] 5.3: Inspect the resulting instruction files to confirm block is at top after any frontmatter — verified via automated tests

## Dev Notes

### Architecture Compliance

- **Single module change:** Only `lib/agents.js` is modified in this story
- **Data-driven approach:** All format-awareness lives in agent registry entries. The installer is a generic engine that reads injectionStrategy and acts accordingly — zero hardcoded agent logic in installer.js
- **Uniform strategy:** All 11 agents currently use markdown instruction files, so all get `position: 'top'` with `skipPatterns: ['---']`. Future agents with different formats (e.g., JSON config) could have different strategies
- **Pairs with Story 8.1:** Story 8.1 implements the logic that consumes injectionStrategy; this story provides the data

### Critical Guardrails

- Do NOT add any logic to installer.js in this story — that is Story 8.1's scope
- Do NOT remove or rename any existing agent properties
- Do NOT change the exported functions (`getAgent`, `getAllAgents`, `getAgentsByCategory`)
- The `skipPatterns: ['---']` means "skip YAML frontmatter block delimited by `---`" — the implementation of how to interpret this pattern lives in installer.js (Story 8.1), not here
- Use camelCase for the property name: `injectionStrategy` (not `injection_strategy`)

### Project Structure Notes

- **File to modify:** `lib/agents.js` — add `injectionStrategy` property to all 11 agent entries
- **Lines of interest (approximate, will shift as properties are added):**
  - Lines 17-38: claude-code agent
  - Lines 39-58: gemini agent
  - Lines 59-80: copilot agent
  - Lines 81-101: kilocode agent
  - Lines 102-127: cline agent
  - Lines 128-148: cursor agent
  - Lines 149-168: bmm-sre agent (id at line 150)
  - Lines 170-189: antigravity agent (id at line 171)
  - Lines 191-210: bmm-devops agent (id at line 192)
  - Lines 212-231: bmm-cyber agent (id at line 213)
  - Lines 233-253: bmm-mil498 agent (id at line 234)
- **No new files**

### References

- [Source: lib/agents.js#L17-L253] — Full agent registry
- [Source: lib/installer.js#L110-L161] — `updateAgentInstructions()` that will consume injectionStrategy (Story 8.1)

### Dependencies
- **Depends on:** Story 8.1 (Task 3 validates that 8.1's code reads `injectionStrategy`)
- **Recommended order:** 8.1 → 8.2

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- No debug issues encountered

### Completion Notes List
- Added `injectionStrategy: { position: 'top', skipPatterns: ['---'] }` to all 11 agents (7 IDE + 4 BMAD) in `lib/agents.js`
- Verified installer.js reads `agent.injectionStrategy` with fallback default (Story 8.1 implementation)
- Verified zero hardcoded agent-name-specific logic in installer.js
- Created 8 automated tests validating registry completeness and installer integration
- All 32 tests pass across both stories (24 from 8.1 + 8 from 8.2), no regressions

### File List
- `lib/agents.js` — Added `injectionStrategy` property to all 11 agent entries
- `test/agent-injection-strategy.test.js` — New test file with 8 tests for story 8.2
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Status tracking updates
- `_bmad-output/implementation-artifacts/8-2-agent-aware-injection-strategy.md` — Story file updates

### Change Log
- 2026-03-17: Implemented Story 8.2 — added injectionStrategy to all 11 agents in registry. All 8 tests pass, no regressions.
