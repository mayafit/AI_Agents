# Story 9.2: JSON Injection — Create opencode.json When Absent

Status: ready-for-dev

depends-on: 9-1-register-opencode-agent

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to create opencode.json from scratch when it does not yet exist,
So that OpenCode receives skill instructions on first install without requiring any manual setup.

## Acceptance Criteria

1. **Given** no opencode.json exists in the project root, **When** the installer runs for the OpenCode agent, **Then** a new opencode.json is created containing an `instructions` array whose entries are ma-agents-owned objects (shape: `{ "_source": "ma-agents", "text": "<instruction text>" }`), **And** the file is valid JSON with 2-space indentation, **And** the file contains no other keys.

## Tasks / Subtasks

- [ ] Define the named constant `MA_AGENTS_SOURCE = 'ma-agents'` at the top of lib/installer.js (AC: #1)
  - [ ] Use this constant everywhere `'ma-agents'` appears — never use the bare string literal
- [ ] In `updateAgentInstructions()` (installer.js line 110), add a conditional branch that routes to JSON merge logic when `agent.injectionStrategy?.position === 'json-merge'` (AC: #1)
  - [ ] Guard: if `injectionStrategy.position` is not exactly `'json-merge'`, do not enter the JSON path — fall through to existing markdown logic unchanged
- [ ] Implement the file-absent creation path (AC: #1)
  - [ ] Check if the target file (resolved from `agent.instructionFiles[0]` relative to `projectRoot`) exists using `fs.existsSync()`
  - [ ] If file does NOT exist: build a fresh JSON object `{ instructions: [] }`
  - [ ] Append ma-agents instruction entries to `instructions` — each entry must be an object: `{ "_source": MA_AGENTS_SOURCE, "text": "<generated instruction text>" }`
  - [ ] Write the resulting object to the target path using `JSON.stringify(data, null, 2)` via `fs.outputFile()`
- [ ] Write fixture-based unit test for the creation path (AC: #1)
  - [ ] Fixture: directory with no opencode.json present
  - [ ] Assert: file created, is valid JSON, contains `instructions` array, every entry has `_source === 'ma-agents'` and a non-empty `text` string
  - [ ] Assert: no extra top-level keys in the written JSON

## Dev Notes

### Named Constant — CRITICAL
Define once at the top of installer.js:
```js
const MA_AGENTS_SOURCE = 'ma-agents';
```
Use `MA_AGENTS_SOURCE` in every comparison and every object literal that sets `_source`. A mismatched string literal across filter logic, generation logic, and tests will cause silent ownership detection failures.

### Entry Format
Each ma-agents-managed instruction entry is a structured object, NOT a plain string:
```json
{ "_source": "ma-agents", "text": "<instruction content>" }
```
Detection logic (used in Stories 9.3 and 9.4) checks `entry._source === MA_AGENTS_SOURCE`. This is safe against any user instruction that happens to contain the string `'ma-agents'` — user plain-string entries will never match an object property check.

### Architecture Compliance
- NFR18: Additive-only JSON merge — only the `instructions` key is written on creation; no other keys added.
- No new npm dependencies — use built-in `JSON.parse` / `JSON.stringify` and `fs-extra` (already a project dependency).
- Do NOT add `configDir` or `skillsDir` as code fields — path resolution uses `agent.getProjectPath()` as per the existing pattern in `updateAgentInstructions()`.
- Stories 9.3 (merge path) and 9.4 (error path) add the remaining branches to this same conditional block. Architect the branch structure so those cases can be added cleanly alongside this one.

### Critical Guardrails
- Do NOT modify the existing markdown injection code path — this is a new parallel branch for `json-merge` strategy only
- Do NOT use `'ma-agents'` as a bare string literal anywhere — always use `MA_AGENTS_SOURCE`
- Do NOT restructure `updateAgentInstructions()` — add the conditional path alongside existing logic

### Project Structure Notes
- Modify: `lib/installer.js` — `updateAgentInstructions()` at line 110, add `json-merge` branch and `MA_AGENTS_SOURCE` constant
- No new files created
- Test fixture: directory with no opencode.json

### References
- [Source: lib/installer.js#L110 — `updateAgentInstructions()` function]
- [Source: lib/installer.js#L111 — `agent.instructionFiles` array consumption pattern]
- [Source: lib/installer.js#L130-146 — existing MA-AGENTS-START/END markdown marker system — do not modify]
- [Source: lib/agents.js — OpenCode agent entry with `injectionStrategy` field from Story 9-1]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
