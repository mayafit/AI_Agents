# Story 9.2: Implement JSON Merge Injection for OpenCode

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to support JSON-merge injection that creates or additively merges opencode.json,
So that skill instructions reach OpenCode without corrupting existing config (NFR18).

## Acceptance Criteria

1. **Given** no opencode.json exists, **When** installer runs for OpenCode, **Then** new opencode.json created with instructions array entries tagged with [ma-agents]
2. **Given** existing opencode.json with user-defined instructions and other config keys, **When** installer runs, **Then** existing non-ma-agents instructions preserved, **And** existing ma-agents entries replaced with fresh ones, **And** all other JSON keys preserved exactly
3. **Given** existing opencode.json with invalid JSON, **When** installer attempts injection, **Then** clear error displayed and file NOT modified, **And** installer continues with other agents (non-fatal)

## Tasks / Subtasks

- [ ] Add JSON-merge conditional branch in updateAgentInstructions() in lib/installer.js (AC: #1, #2)
  - [ ] Detect injectionStrategy.position === 'json-merge' and route to JSON logic
  - [ ] Read existing file or start with empty object if file does not exist
  - [ ] Parse JSON content and extract targetKey array (e.g., 'instructions')
  - [ ] Filter out existing entries containing '[ma-agents]' tag
  - [ ] Append new ma-agents tagged entries to the array
  - [ ] Write back with JSON.stringify(data, null, 2)
- [ ] Implement graceful error handling for invalid JSON (AC: #3)
  - [ ] Wrap JSON.parse in try/catch
  - [ ] Log clear error message on parse failure
  - [ ] Skip file modification on error and continue with other agents
- [ ] Ensure all other JSON keys are preserved during merge (AC: #2)
  - [ ] Only read and write the targetKey array, leave all other keys untouched
- [ ] Test: no existing file creates new valid JSON with ma-agents entries (AC: #1)
- [ ] Test: existing file with mixed entries preserves user entries and replaces ma-agents entries (AC: #2)
- [ ] Test: corrupt JSON file triggers error log and does not modify file (AC: #3)

## Dev Notes

### Architecture Compliance
- NFR18: Additive-only JSON merge. Only the targetKey array is touched; all other keys in the JSON object must be preserved exactly as-is.
- NFR7: Read-validate-write pattern for JSON files, same as manifest handling.
- No new npm dependencies — use built-in JSON.parse/JSON.stringify only.
- Detection of ma-agents entries: string entries containing '[ma-agents]' prefix/tag in the targetKey array.

### Critical Guardrails
- Do NOT overwrite or remove non-ma-agents instruction entries — only filter and replace entries containing '[ma-agents]'
- Do NOT modify the file if JSON parsing fails — log error and continue
- Do NOT add any new npm dependencies
- Do NOT restructure updateAgentInstructions() — add a conditional path alongside existing markdown logic
- Do NOT modify any existing markdown injection behavior — this is a new code path for JSON strategy only

### Project Structure Notes
- Modify: `lib/installer.js` — updateAgentInstructions() at line 110, add conditional branch for json-merge strategy
- No new files created
- Depends on: Story 9-1 (OpenCode agent entry with injectionStrategy field)

### References
- [Source: lib/installer.js#L110 — updateAgentInstructions() function]
- [Source: lib/installer.js#L130-146 — existing MA-AGENTS-START/END marker system for markdown]
- [Source: lib/agents.js — OpenCode agent entry with injectionStrategy field from Story 9-1]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
