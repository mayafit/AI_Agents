# Story 9.3: JSON Injection — Merge Into Existing opencode.json

Status: review

depends-on: 9-2-json-merge-injection

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to merge skill instructions into an existing opencode.json without destroying user configuration,
So that re-running the installer on a project that already has opencode.json updates ma-agents entries while leaving everything else untouched (NFR18).

## Acceptance Criteria

1. **Given** an existing valid opencode.json that contains an `instructions` array with a mix of user-owned entries and ma-agents-owned entries (identified by `_source === MA_AGENTS_SOURCE`), and additional top-level JSON keys, **When** the installer runs for the OpenCode agent, **Then** all user-owned instruction entries (those without `_source === MA_AGENTS_SOURCE`) are preserved in their original positions, **And** all previous ma-agents entries are removed and replaced with fresh ones appended at the end of the `instructions` array, **And** all other top-level JSON keys (not `instructions`) have semantically identical values in the output (object structure and values preserved; 2-space indentation is the normalized output format), **And** the write is performed atomically (write to a temp file, then rename over the target).

## Tasks / Subtasks

- [x] Implement the file-present merge path in the `json-merge` branch of `updateAgentInstructions()` (AC: #1)
  - [x] When `fs.existsSync(filePath)` is true and JSON parsing succeeds (see Story 9.4 for the parse-failure path): proceed with merge
  - [x] Read file content with `fs.readFile(filePath, 'utf-8')`
  - [x] Parse with `JSON.parse()` — if parse throws, delegate to the Story 9.4 error path
  - [x] If parsed object has no `instructions` key, initialize it as an empty array before merging (do not error or skip — create the key)
  - [x] Filter the existing `instructions` array: keep entries where `entry._source !== MA_AGENTS_SOURCE` (user entries), discard entries where `entry._source === MA_AGENTS_SOURCE` (stale ma-agents entries)
  - [x] Append fresh ma-agents entries (objects of shape `{ "_source": MA_AGENTS_SOURCE, "text": "<instruction text>" }`) to the preserved user entries
  - [x] Reassign `data.instructions` to the merged array; leave all other top-level keys on `data` untouched
  - [x] Perform atomic write: serialize with `JSON.stringify(data, null, 2)`, write to `filePath + '.tmp'`, then `fs.rename(tmpPath, filePath)`
- [x] Write fixture-based unit test for the merge path (AC: #1)
  - [x] Fixture: opencode.json with 2 user entries (plain string and object without `_source`), 1 stale ma-agents entry (`_source: 'ma-agents'`), and 1 unrelated top-level key (`"theme": "dark"`)
  - [x] Assert: user entries preserved (count = 2, original values intact)
  - [x] Assert: stale ma-agents entry removed; fresh ma-agents entries appended
  - [x] Assert: `theme` key present in output with value `"dark"` unchanged
  - [x] Assert: output is valid JSON
  - [x] Assert: no `.tmp` file left on disk after successful write

## Dev Notes

### Named Constant — CRITICAL
Use the `MA_AGENTS_SOURCE` constant defined in Story 9.2. Never use `'ma-agents'` as a bare string literal. Every ownership check must reference the constant:
```js
entry._source !== MA_AGENTS_SOURCE  // keep user entries
entry._source === MA_AGENTS_SOURCE  // identify ma-agents entries to replace
```

### Entry Format
Ma-agents instruction entries are structured objects:
```json
{ "_source": "ma-agents", "text": "<instruction content>" }
```
User entries may be plain strings or objects with any other shape. The filter must only remove entries where `_source === MA_AGENTS_SOURCE` — no other entries may be touched.

### Missing `instructions` Key Behavior
If a valid opencode.json exists but has no `instructions` key, treat it as if `instructions` is an empty array:
```js
if (!Array.isArray(data.instructions)) data.instructions = [];
```
Then proceed normally with merge. Do not emit an error or skip the file.

### Atomic Write
Do not write directly to the target file. Use:
```js
const tmpPath = filePath + '.tmp';
await fs.outputFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
await fs.rename(tmpPath, filePath);
```
A crash between write and rename leaves a `.tmp` file that can be inspected. A crash during direct write corrupts the production file. Always use the temp-rename pattern.

### JSON Formatting
`JSON.stringify(data, null, 2)` normalizes indentation to 2 spaces. This is the documented output format — "preserved exactly" in AC #1 means all non-instructions keys have semantically identical values (same keys, same values, same nesting). Whitespace and key ordering are not guaranteed to match the original. This is a known trade-off given the no-new-npm-deps constraint.

### Architecture Compliance
- NFR18: Additive-only merge — only `instructions` key contents change; all other keys pass through unmodified.
- NFR7: Read-validate-write pattern — read → parse → validate → modify → atomic write.
- No new npm dependencies.

### Critical Guardrails
- Do NOT remove or modify any entry where `entry._source !== MA_AGENTS_SOURCE`
- Do NOT write directly to the target file — always use atomic temp-rename
- Do NOT use `'ma-agents'` as a bare string — always use `MA_AGENTS_SOURCE`
- Do NOT modify the existing markdown injection code path

### Project Structure Notes
- Modify: `lib/installer.js` — extend the `json-merge` branch started in Story 9.2, adding the file-present merge sub-path
- No new files created
- Test fixture: opencode.json with mixed entries and extra top-level keys

### References
- [Source: lib/installer.js#L110 — `updateAgentInstructions()` function]
- [Source: lib/installer.js#L130-146 — existing markdown marker system — do not modify]
- [Source: lib/agents.js — OpenCode agent entry with `injectionStrategy` from Story 9-1]
- [Source: Story 9.2 — `MA_AGENTS_SOURCE` constant definition and entry shape]
- [Source: Story 9.4 — error path that handles JSON.parse failure for this same file-present branch]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — implementation was straightforward.

### Completion Notes List
- Replaced the `return` placeholder in the file-present branch of the `json-merge` section in `updateAgentInstructions()` with full merge logic
- Merge logic: reads existing JSON, initializes `instructions` array if absent, filters out stale `MA_AGENTS_SOURCE` entries while preserving all user entries, appends fresh ma-agents entries, performs atomic write via temp-file-then-rename pattern
- Created `test/opencode-json-merge.test.js` with 10 fixture-based tests covering: user entry preservation, stale entry removal, fresh entry append order, extra top-level key preservation, valid JSON output, no leftover .tmp file, missing instructions key initialization, and idempotent re-runs
- Updated Story 9.2 test 9.2.12 from a placeholder "does not overwrite" assertion to the now-correct merge behavior assertion

### File List
- `lib/installer.js` — implemented file-present merge path in `updateAgentInstructions()` json-merge branch
- `test/opencode-json-merge.test.js` — new test file with 10 Story 9.3 tests
- `test/opencode-json-injection.test.js` — updated test 9.2.12 to reflect actual merge behavior
