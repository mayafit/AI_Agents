# Story 9.4: JSON Injection — Handle Invalid opencode.json Gracefully

Status: review

depends-on: 9-3-json-merge-existing

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to recover gracefully when opencode.json contains invalid JSON,
So that a corrupt or hand-edited config file does not abort the entire install run and all other agents continue to be processed.

## Acceptance Criteria

1. **Given** an existing opencode.json that contains invalid JSON (i.e., `JSON.parse()` throws a `SyntaxError`), **When** the installer attempts injection for the OpenCode agent, **Then** a clear human-readable error message is logged to the console identifying the file path and the parse error, **And** the file is NOT modified (byte-identical to the original after the run), **And** the installer continues processing all remaining agents in the queue without re-throwing the error.

## Tasks / Subtasks

- [x] Wrap the `JSON.parse()` call in the `json-merge` branch with a `try/catch` block (AC: #1)
  - [x] On `catch (err)`: log a clear error message including the file path and `err.message`, e.g.: `console.error(\`[ma-agents] ERROR: Could not parse ${filePath} — ${err.message}. File not modified.\`)`
  - [x] On catch: `return` from the current iteration without writing anything to disk
  - [x] Do NOT re-throw the error — the outer caller must continue processing subsequent agents
- [x] Verify that the `return` on error exits only the current agent's instruction update, not the entire install loop (AC: #1)
  - [x] Trace the call site of `updateAgentInstructions()` in installer.js to confirm the loop continues after a non-throwing return
- [x] Write fixture-based unit test for the error path (AC: #1)
  - [x] Fixture A: opencode.json containing `"not valid json {{{"` (corrupt file)
  - [x] Assert: file content is byte-identical after the installer run (file NOT modified)
  - [x] Assert: console.error was called with a message containing the file path and a description of the parse failure
  - [x] Assert: the installer processes at least one additional agent after the OpenCode error (continuation verified)
  - [x] Fixture B (continuation test): install list `[opencode, someOtherAgent]` where opencode.json is corrupt — assert `someOtherAgent`'s instruction file IS updated successfully

## Dev Notes

### Named Constant — CRITICAL
Use the `MA_AGENTS_SOURCE` constant defined in Story 9.2. This story does not use `MA_AGENTS_SOURCE` directly in logic but must not introduce a new `'ma-agents'` string literal in any log messages (use the constant or a descriptive label):
```js
console.error(`[ma-agents] ERROR: Could not parse ${filePath} — ${err.message}. File not modified.`);
```

### Error Message Requirements
The error message must include:
1. The full file path (so the user can locate and fix the file)
2. The parse error message from `err.message` (so the user knows what is wrong)
3. A statement that the file was NOT modified (so the user does not think their data was lost)

### Non-Fatal Contract
`updateAgentInstructions()` must not throw for the parse-failure case. The caller iterates over agents; a thrown error would abort the loop. The `catch` block must log and `return`, never `throw`.

### Continuation Test Importance
AC #1 requires verifying that subsequent agents are processed. The test in Fixture B is the only way to confirm the non-fatal contract is actually honored — do not skip it. A missing continuation test means the "non-fatal" claim is unverified.

### Architecture Compliance
- NFR7: Read-validate-write — if validation (parse) fails, no write occurs. This story enforces the "validate" gate.
- No new npm dependencies.

### Critical Guardrails
- Do NOT re-throw the caught error
- Do NOT modify the file in the error path — not even to add a comment or a backup
- Do NOT use bare string `'ma-agents'` in log messages if `MA_AGENTS_SOURCE` is in scope — use the constant
- Do NOT modify the existing markdown injection code path

### Project Structure Notes
- Modify: `lib/installer.js` — add `try/catch` around `JSON.parse()` in the `json-merge` branch established by Stories 9.2 and 9.3
- No new files created
- Test fixtures: corrupt opencode.json; multi-agent install list with corrupt opencode as first agent

### References
- [Source: lib/installer.js#L110 — `updateAgentInstructions()` function]
- [Source: Story 9.2 — `MA_AGENTS_SOURCE` constant and `json-merge` branch entry point]
- [Source: Story 9.3 — merge path where `JSON.parse()` is called; this story wraps that call in try/catch]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — implementation was straightforward with no unexpected issues.

### Completion Notes List
- Wrapped `JSON.parse(content)` and subsequent merge logic in a `try/catch` in the `json-merge` branch of `updateAgentInstructions()` in `lib/installer.js`
- On `catch (err)`: logs `[ma-agents] ERROR: Could not parse ${filePath} — ${err.message}. File not modified.` and returns without any write
- The catch block does NOT re-throw — the outer install loop continues processing remaining agents
- All 6 new tests pass: 4 Fixture A tests (corrupt file unchanged, error logged with file path, error describes parse failure, no .tmp file left) and 2 Fixture B tests (continuation: subsequent markdown agent IS updated; non-fatal: no throw)

### File List
- `lib/installer.js` — added try/catch around JSON.parse in the json-merge file-present branch (lines 185-203)
- `test/opencode-json-error.test.js` — new test file with 6 tests covering Fixture A (corrupt file) and Fixture B (continuation)
