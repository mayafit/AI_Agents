# Story 9.1: Register OpenCode Agent in Registry

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want OpenCode added to agents.js as the 12th agent with JSON injection strategy,
So that the installer can target OpenCode using the same config-driven pattern.

## Acceptance Criteria

1. **Given** the agents.js registry, **When** the OpenCode agent entry is added, **Then** it includes: `id: 'opencode'`, `name: 'OpenCode'`, `category: 'ide'`, `getProjectPath()` returning `path.join(process.cwd(), '.opencode', 'skills')`, `getGlobalPath()` with per-platform paths under `.opencode`, `instructionFiles: ['opencode.json']`, **And** `injectionStrategy` is `{ position: 'json-merge', targetKey: 'instructions' }`.
2. **Given** the installer runs with `--agent opencode`, **When** agent resolution occurs, **Then** OpenCode is found and processed like any other agent, **And** no code changes to installer.js were needed (NFR13).

## Tasks / Subtasks

- [x] Add OpenCode agent object to agents array in lib/agents.js (AC: #1)
  - [x] Define agent entry with `id: 'opencode'`, `name: 'OpenCode'`, `version: '1.0.0'`, `category: 'ide'`, `description: 'OpenCode AI Assistant'`
  - [x] Implement `getProjectPath()` returning `path.join(process.cwd(), '.opencode', 'skills')` — this fulfils the epics spec's `configDir: '.opencode'` / `skillsDir: '.opencode/skills'` requirement using the function-based pattern canonical to agents.js
  - [x] Implement `getGlobalPath()` following the same per-platform pattern as existing agents (win32 → AppData/Roaming, darwin → Library/Application Support, linux → ~/.config), using `.opencode` as the root directory
  - [x] Set `fileExtension: '.md'` — this is the extension for deployed skill template files, NOT for the instruction config file. OpenCode skill assets are markdown documents; the instruction config file is declared separately via `instructionFiles`. The `.md` value is correct here.
  - [x] Set `template: 'generic'`
  - [x] Set `instructionFiles: ['opencode.json']` — canonical plural-array form as consumed by `updateAgentInstructions()` in installer.js line 111. **Note:** the epics spec uses singular `instructionFile`, but the codebase field is `instructionFiles` (array). The array form is authoritative; use it.
  - [x] Set `injectionStrategy: { position: 'json-merge', targetKey: 'instructions' }` — **CRITICAL:** `position` must be exactly the string `'json-merge'`. Any typo silently falls through to the wrong code path with no runtime error. Double-check spelling before committing.
- [x] Write unit test verifying the new agent object conforms to required schema: id (string), name (string), category (string), getProjectPath (function), getGlobalPath (function), fileExtension (string), template (string), instructionFiles (non-empty array of strings), injectionStrategy.position (string), injectionStrategy.targetKey (string) — all fields present and correctly typed (AC: #1)
- [x] Test that `--agent opencode` resolves correctly through existing installer logic (AC: #2)
- [x] Verify no changes to installer.js are required for agent resolution (AC: #2)

## Dev Notes

### Architecture Compliance
- NFR13: Config-driven registry pattern. Adding an agent must only require a new entry in agents.js; no installer.js changes for resolution.
- Agent structure must follow the exact same shape as existing agents. Reference entries: `claude-code` (lines 18-38 of agents.js) and `antigravity` (lines 171-190 of agents.js).
- `antigravity` is the Google Deepmind Antigravity Agent (`id: 'antigravity'`, `category: 'ide'`). It appears before OpenCode in the array. Do not assert on absolute agent positions — the registry order may change as agents are added.
- The `injectionStrategy` field is new — it is NOT present on any existing agent. It will be read by the JSON merge logic added in Stories 9.2, 9.3, and 9.4 in installer.js.
- `version: '1.0.0'` follows the convention used by existing agents (except `bmm-mil498` which is `'2.0.0'`). This field is informational only — installer.js does not read or validate it. Use `'1.0.0'`.

### Critical Guardrails
- Do NOT modify installer.js for this story — agent resolution must work via existing config-driven patterns
- Do NOT hardcode agent names anywhere in the installer
- Do NOT change the structure of existing agent entries
- Do NOT assert on total agent count in tests — the count changes as agents are added/removed and is not a stable invariant for this story's behavior

### Project Structure Notes
- Modify: `lib/agents.js` — add one new agent object to the agents array
- No new files created

### References
- [Source: lib/agents.js lines 18-38 — claude-code entry for exact structure reference]
- [Source: lib/agents.js lines 171-190 — antigravity entry: `id='antigravity'`, `name='Antigravity'`, Google Deepmind Antigravity Agent, `category='ide'`, uses getProjectPath/getGlobalPath functions, `fileExtension='.md'`, `template='generic'`, `instructionFiles=['.antigravity/antigravity.md']`]
- [Source: lib/installer.js#L111 — `if (!agent.instructionFiles || agent.instructionFiles.length === 0) return;` — confirms `instructionFiles` (plural array) is the canonical field name]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — implementation was straightforward with no debugging required.

### Completion Notes List
- Added opencode agent as the 12th entry in lib/agents.js immediately after the `antigravity` entry, with all required fields: id, name, version, category, description, getProjectPath, getGlobalPath (per-platform win32/darwin/linux), fileExtension, template, instructionFiles, and injectionStrategy with position `json-merge` and targetKey `instructions`.
- Created test/opencode-agent.test.js with 19 unit tests covering full schema validation and registry resolution via getAgent() and getAllAgents().
- Updated test/agent-injection-strategy.test.js to accommodate the new opencode agent: relaxed exact agent count assertion, made skipPatterns check conditional on non-json-merge strategy, and updated position check to skip json-merge agents.
- No changes to installer.js were required — the opencode agent resolves via the existing config-driven getAgent() lookup pattern (NFR13 compliant).

### File List
- lib/agents.js
- test/opencode-agent.test.js
- test/agent-injection-strategy.test.js
