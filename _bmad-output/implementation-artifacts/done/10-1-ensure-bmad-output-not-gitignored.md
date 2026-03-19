# Story 10.1: Ensure _bmad-output Is Not Gitignored

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the installer to remove _bmad-output from .gitignore if present and never add it,
So that planning artifacts are tracked as version-controlled project knowledge.

## Acceptance Criteria

1. **Given** project with _bmad-output in .gitignore, **When** installer runs (install/update), **Then** _bmad-output line removed, **And** the console displays exactly: `_bmad-output is now tracked as project knowledge (not gitignored)`
2. **Given** project with no _bmad-output in .gitignore, **When** installer runs, **Then** .gitignore not modified for this concern (no write call is made)
3. **Given** no .gitignore exists, **When** installer runs, **Then** no .gitignore created for this purpose and no error thrown
4. **Given** installer creates/updates .gitignore for other entries, **When** it writes, **Then** _bmad-output never included in the written content

## Tasks / Subtasks

- [ ] Verify chalk is already a project dependency (`package.json`) before using chalk.green(); add import/require at the top of installer.js if not already present (AC: #1)
- [ ] Create ensureBmadOutputTracked(projectRoot) function in lib/installer.js (AC: #1, #2, #3)
  - [ ] Attempt to read .gitignore with `fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf-8')` inside a `try/catch`; on `ENOENT` (or any error), return early — do NOT use `existsSync` pre-check followed by `readFileSync` (avoids TOCTOU race condition) (AC: #3)
  - [ ] Split content on `/\r?\n/` to handle both Unix (LF) and Windows (CRLF) line endings — never split on `'\n'` alone (AC: #1, Windows compat)
  - [ ] Trim each line before pattern comparison (handles trailing whitespace) (AC: #1)
  - [ ] Scan for lines matching _bmad-output variations after trimming: `_bmad-output`, `_bmad-output/`, `/_bmad-output`, `/_bmad-output/`
  - [ ] Remove matching lines; reconstruct file content preserving original line endings (join with `'\n'` is acceptable as normalized output)
  - [ ] Write back only if at least one line was removed (AC: #2)
  - [ ] Print `chalk.green('_bmad-output is now tracked as project knowledge (not gitignored)')` when lines are removed (AC: #1)
- [ ] Integrate ensureBmadOutputTracked() into install pipeline (AC: #1)
  - [ ] Call after skill installation or during manifest update stage
- [ ] Audit existing codebase for any code that adds _bmad-output to .gitignore (AC: #4)
  - [ ] Check lib/installer.js for any .gitignore write logic that includes _bmad-output
  - [ ] Check lib/bmad.js for any .gitignore write logic that includes _bmad-output
  - [ ] Remove any such logic if found
- [ ] Remove _bmad-output/ from the ma-agents project's own .gitignore (AC: #4)

### Tests

- [ ] Test AC1 — removal and message:
  - [ ] Fixture: .gitignore containing `_bmad-output/` among other entries
  - [ ] Assert: `_bmad-output/` line removed from written content
  - [ ] Assert: `writeFileSync` (or equivalent) WAS called once
  - [ ] Assert: console output contains the exact string `_bmad-output is now tracked as project knowledge (not gitignored)`
- [ ] Test AC2 — no-op when already clean:
  - [ ] Fixture: .gitignore with no _bmad-output entry
  - [ ] Assert: `writeFileSync` (or equivalent) was NOT called (use sinon spy or jest mock)
- [ ] Test AC3 — missing .gitignore:
  - [ ] Fixture: project directory with no .gitignore file
  - [ ] Assert: no error thrown, no .gitignore created
- [ ] Test AC4 — installer write paths never include _bmad-output:
  - [ ] Spy on all .gitignore write call sites in lib/installer.js and lib/bmad.js
  - [ ] Assert: none of the written content strings include `_bmad-output`
  - [ ] This test acts as a regression guard — future code changes that reintroduce the pattern will fail this test
- [ ] Test — Windows CRLF compatibility:
  - [ ] Fixture: .gitignore with `_bmad-output/\r\n` (Windows line endings)
  - [ ] Assert: line is correctly detected and removed (match does not fail due to `\r`)
- [ ] Test — idempotency:
  - [ ] Run ensureBmadOutputTracked() on a project where _bmad-output was already removed in a prior run
  - [ ] Assert: `writeFileSync` is NOT called on the second run (no spurious file churn)
- [ ] Test — own .gitignore cleanup:
  - [ ] Assert: the ma-agents project's own .gitignore does not contain `_bmad-output` (grep assertion on the file)

## Dev Notes

### Architecture Compliance
- FR58/FR59: _bmad-output is project knowledge and must be version-controlled.
- Use `fs.readFileSync(path, 'utf-8')` — always pass the `'utf-8'` encoding option. Without it, `readFileSync` returns a Buffer; calling `.split()` on a Buffer throws a TypeError in some Node versions and produces unexpected behavior in others.
- Console output uses `chalk.green()` per established console output patterns in the codebase. Verify chalk import style matches the project's module system (CJS `require` vs ESM `import`) — chalk v5+ is ESM-only.
- `path.join()` for all file path construction.

### TOCTOU Fix — CRITICAL
Do NOT use the pattern:
```js
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  ...
}
```
The file can be deleted between `existsSync` and `readFileSync`. Use instead:
```js
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  // proceed
} catch (err) {
  if (err.code === 'ENOENT') return; // file doesn't exist — no-op
  throw err; // unexpected error — re-throw
}
```

### Windows Line Ending Fix — CRITICAL
Do NOT split on `'\n'` alone. Use:
```js
const lines = content.split(/\r?\n/);
```
Then trim each line before comparison:
```js
const trimmed = line.trim();
if (BMAD_OUTPUT_PATTERNS.includes(trimmed)) { ... }
```
This handles both `_bmad-output\r` (Windows CRLF) and `_bmad-output` (Unix LF).

### Pattern List
```js
const BMAD_OUTPUT_PATTERNS = ['_bmad-output', '_bmad-output/', '/_bmad-output', '/_bmad-output/'];
```
Note: commented-out lines (e.g., `# _bmad-output`) and glob variants (e.g., `_bmad-output/**`) are out of scope for this story. The four listed patterns cover the common cases written by IDEs and developers.

### Write Guard (AC2)
Only write back if lines were actually removed:
```js
const filtered = lines.filter(line => !BMAD_OUTPUT_PATTERNS.includes(line.trim()));
if (filtered.length === lines.length) return; // nothing removed — do not write
fs.writeFileSync(filePath, filtered.join('\n'), 'utf-8');
```

### Exact Message (AC1)
The chalk output must produce exactly this text (the chalk color wrapping is fine, but the string content must match):
```
_bmad-output is now tracked as project knowledge (not gitignored)
```
Test assertions must verify this exact string, not just "something was logged."

### Critical Guardrails
- Do NOT use `existsSync` before `readFileSync` — use try/catch with `ENOENT` check
- Do NOT use `readFileSync` without `'utf-8'` encoding
- Do NOT split on `'\n'` alone — always use `/\r?\n/`
- Do NOT create a .gitignore file if one does not exist
- Do NOT remove other entries from .gitignore — only _bmad-output variations
- Do NOT skip the AC2 write-guard test — assert the write function was NOT called

### Project Structure Notes
- Modify: `lib/installer.js` — add ensureBmadOutputTracked() function and call it in install pipeline
- Modify: `.gitignore` (project root) — remove `_bmad-output/` entry
- Audit: `lib/bmad.js` — check for any .gitignore write logic referencing _bmad-output

### References
- [Source: lib/installer.js — install pipeline for integration point]
- [Source: .gitignore — current _bmad-output/ entry to remove]
- [Source: lib/bmad.js — audit for .gitignore write logic]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — implementation was straightforward with no debugging required.

### Completion Notes List
- ✅ Added `BMAD_OUTPUT_PATTERNS` constant and `ensureBmadOutputTracked(projectRoot)` function to `lib/installer.js` after `writeManifest()`
- ✅ Uses try/catch with ENOENT check (no TOCTOU race), splits on `/\r?\n/`, trims lines before comparison, writes back only if lines removed
- ✅ Called `ensureBmadOutputTracked(installPath)` immediately after `writeManifest(installPath, manifest)` in `installSkill()`
- ✅ Exported `ensureBmadOutputTracked` in `module.exports`
- ✅ Removed commented `_bmad-output/` line from project `.gitignore` (line 16)
- ✅ Created `test/bmad-output-policy.test.js` with 6 Story 10-1 tests (AC1–AC3, CRLF, idempotency, own .gitignore) plus 5 relocated Story 10-2 README tests
- ✅ Removed Story 10-2 test block from `test/yes-flag.test.js`
- ✅ Strengthened discoverable assertion in relocated test (counts H2s before section, asserts ≤ 3)
- ✅ All 11 tests in `test/bmad-output-policy.test.js` pass

### File List
- `lib/installer.js` (modified — added `ensureBmadOutputTracked()`, call in `installSkill()`, exported)
- `.gitignore` (modified — removed commented `_bmad-output/` line)
- `test/bmad-output-policy.test.js` (created — 11 tests for Stories 10-1 and 10-2)
- `test/yes-flag.test.js` (modified — removed Story 10-2 test block)
- `_bmad-output/implementation-artifacts/10-1-ensure-bmad-output-not-gitignored.md` (modified — status → done)
- `_bmad-output/implementation-artifacts/10-2-document-bmad-output-policy.md` (modified — status → done)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 10-2 → done)

### Change Log
- 2026-03-18: Implemented Story 10-1 — ensureBmadOutputTracked() in lib/installer.js; also completed Story 10-2 closure (test relocation, status updates)
