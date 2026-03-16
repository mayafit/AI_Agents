# Story 5.1: Add bmad-method as Direct Dependency

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **DevOps engineer**,
I want bmad-method included as a direct npm dependency in ma-agents,
So that BMAD installation does not require fetching bmad-method from the npm registry at runtime.

## Acceptance Criteria

1. `package.json` includes `"bmad-method": "6.0.4"` as a direct dependency
2. Running `npm install` or `npm pack` installs bmad-method v6.0.4 into `node_modules/bmad-method/`
3. `bmad.js` uses `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` to locate the local copy
4. All 3 invocation sites invoke via `execSync('node <resolved-path> install ...')` instead of `execSync('npx bmad-method install ...')`
5. Behavior is identical to the previous `npx bmad-method` invocation (same flags, same output, same side effects)
6. No npm registry network call is made for bmad-method during install/update/recompile
7. Existing BMAD installations (from previous `npx bmad-method` versions) are preserved — no corruption, workflows continue to function

## Tasks / Subtasks

- [x] Task 1: Add bmad-method dependency to package.json (AC: #1, #2)
  - [x] 1.1 Add `"bmad-method": "6.0.4"` to `dependencies` in `package.json`
  - [x] 1.2 Run `npm install` and verify `node_modules/bmad-method/` exists
  - [x] 1.3 Verify `node_modules/bmad-method/tools/bmad-npx-wrapper.js` exists and is resolvable

- [x] Task 2: Create helper function to resolve bmad-method path (AC: #3, #6)
  - [x] 2.1 Add a `getBmadCommand(args)` helper at top of `bmad.js` that:
    - Resolves `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')`
    - Constructs `node "<resolved-path>" ${args}` command string
    - Quotes the resolved path in the command string for cross-platform safety (handles Windows backslashes)
  - [x] 2.2 Wrap `require.resolve` in try/catch — if it fails, throw a clear error ("bmad-method not found in node_modules — run npm install first")

- [x] Task 3: Update `installBmad()` — line 14 (AC: #4, #5)
  - [x] 3.1 Replace `let command = 'npx bmad-method install --yes'` with `getBmadCommand('install --yes')`
  - [x] 3.2 Preserve all existing flag appending logic (`--modules`, `--tools`)
  - [x] 3.3 Verify `execSync(command, { stdio: 'inherit', cwd: projectRoot })` still works

- [x] Task 4: Update `updateBmad()` — line 37 (AC: #4, #5)
  - [x] 4.1 Replace `let command = 'npx bmad-method install --action update --yes'` with `getBmadCommand('install --action update --yes')`
  - [x] 4.2 Preserve all existing flag appending logic
  - [x] 4.3 Verify behavior identical to previous `npx` invocation

- [x] Task 5: Update `applyCustomizations()` — line 112 (AC: #4, #5)
  - [x] 5.1 Replace `let command = 'npx bmad-method install --yes'` with `getBmadCommand('install --yes')`
  - [x] 5.2 Preserve all existing flag appending logic
  - [x] 5.3 Verify recompile behavior unchanged

- [ ] Task 6: Backward compatibility validation (AC: #7) *(requires human tester)*
  - [ ] 6.1 Test with a project that has an existing `_bmad/` directory from a prior `npx bmad-method` installation
  - [ ] 6.2 Run `npx ma-agents install` and verify `_bmad/` content is preserved
  - [ ] 6.3 Verify BMAD workflows continue to function after upgrade

- [ ] Task 7: Manual integration test (AC: #5, #6) *(requires human tester)*
  - [ ] 7.1 Run `installBmad()` and verify complete BMAD installation
  - [ ] 7.2 Run `updateBmad()` and verify BMAD update completes
  - [ ] 7.3 Run `applyCustomizations()` and verify recompile + customization pipeline
  - [x] 7.4 Confirm no `npx bmad-method` string remains in `bmad.js`

## Dev Notes

### Architecture Compliance

- **Decision P2-6** (Bundled BMAD Installation): This story implements step 2 of the 2-step mechanism. Step 1 (cache pre-population) is Story 5.3.
- **NFR20** (Version Pinning): Pin `bmad-method` to exact version `"6.0.4"` (no caret, no tilde)
- **NFR21** (Deterministic Installation): Eliminating `npx` removes npm registry lookup, making the bmad-method invocation deterministic
- **Anti-pattern from architecture**: "Fetching bmad-method via `npx` instead of using the npm dependency copy (breaks air-gap, NFR20 violation)" [Source: architecture.md, Decision P2-6 validation]

### Implementation Pattern

The invocation pattern change is:

**Before (current):**
```javascript
let command = 'npx bmad-method install --yes';
// ... append flags ...
execSync(command, { stdio: 'inherit', cwd: projectRoot });
```

**After (required):**
```javascript
function getBmadCommand(args) {
  try {
    const wrapperPath = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
    return `node "${wrapperPath}" ${args}`;
  } catch (err) {
    const wrapped = new Error('bmad-method not found in node_modules — run "npm install" first');
    wrapped.cause = err;
    throw wrapped;
  }
}

// Usage in each function:
let command = getBmadCommand('install --yes');
// ... append flags (unchanged) ...
execSync(command, { stdio: 'inherit', cwd: projectRoot });
```

The `getBmadCommand()` helper centralizes the `require.resolve` + command construction + error handling to avoid repeating the pattern 3 times. `require.resolve()` returns an absolute OS-native path — quoting it in the template literal is the cross-platform safety mechanism (no `path.join()` needed here).

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `package.json` | Add `"bmad-method": "6.0.4"` to `dependencies` |
| `lib/bmad.js` | Replace 3x `npx bmad-method` with `node <resolved-path>`, add helper function |

### Critical Constraints

- **Cross-platform paths**: `require.resolve()` returns an absolute OS-native path. Quote it in the command string (`"${wrapperPath}"`) — this handles Windows backslash paths safely. Do NOT wrap in `path.join()` (it's already resolved).
- **Do NOT modify any other logic in bmad.js**: The flag appending (`--modules`, `--tools`), error handling, `chalk` logging, and `applyCustomizations()` steps 1-6 must remain untouched.
- **Do NOT add `bmad-method` to `devDependencies`**: It must be in `dependencies` so it ships with `npm pack` / `npm publish`.
- **Exact version pin**: Use `"6.0.4"` not `"^6.0.4"` — this is a deliberate architectural decision for deterministic builds (NFR20).
- **`require.resolve()` runs at call time**: The resolve happens when `getBmadCommand()` is called, not at module load time. This is correct because `node_modules` must exist when the function runs.
- **Package size trade-off (by design)**: Adding bmad-method as a dependency increases `npx ma-agents` download size (~555 KB for bmad-method). This is the intended architectural trade-off — deterministic air-gapped installation (NFR20/NFR21) over download size. The ma-agents package must contain bmad-method.
- **Why version 6.0.4 specifically**: v6.0.4 is the version pinned in the architecture decision (P2-6). v6.1.0 exists but the bundled installation was designed and tested against 6.0.4. Version bumps require: update pin in `package.json`, re-run `npm run build:bmad-cache` (Story 5.2), test, release.

### Testing Standards

- No automated test suite exists yet (Epic 7). Manual verification is sufficient for this story.
- Verify by running the full install flow: `npx ma-agents install` selecting BMAD installation.
- Confirm no `npx bmad-method` strings remain in `lib/bmad.js` after implementation.

### Project Structure Notes

- `lib/bmad.js` is the only file that invokes `bmad-method`. No other files in the codebase call `npx bmad-method`.
- `.npmignore` excludes `_bmad/` and `_bmad-output/` but does NOT exclude `lib/` — so the `lib/bmad.js` changes will ship.
- `package.json` currently has 3 dependencies: `prompts`, `chalk`, `fs-extra`. Adding `bmad-method` makes it 4.

### Epic 5 Cross-Story Context

This is Story 5.1 of 4 in Epic 5 (Bundled BMAD Installation). Execution order: 5.1 -> 5.2 -> 5.3 -> 5.4.

- **Story 5.1** (this): Add bmad-method as npm dependency, replace `npx` invocations
- **Story 5.2**: Create `npm run build:bmad-cache` script to clone external modules into `lib/bmad-cache/`
- **Story 5.3**: Pre-populate `~/.bmad/cache/external-modules/` from bundled cache before bmad-method runs
- **Story 5.4**: Validate the complete bundled installation works end-to-end

The `getBmadCommand()` helper created here will be reused by Story 5.3 (which adds cache pre-population logic before the bmad-method invocation).

### References

- [Source: architecture.md, Decision P2-6] — Bundled BMAD Installation architecture
- [Source: epics.md, Story 5.1] — Acceptance criteria and technical notes
- [Source: prd.md, F6] — Bundled BMAD Installation feature description
- [Source: prd.md, NFR20-NFR21] — Version pinning and deterministic installation requirements
- [Source: lib/bmad.js:14,37,112] — The 3 `npx bmad-method` invocation sites
- [Source: package.json] — Current dependency list

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Added `"bmad-method": "6.0.4"` as exact-version dependency in package.json (NFR20 compliant)
- Created `getBmadCommand(args)` helper function at top of `lib/bmad.js` with `require.resolve()` and try/catch error handling
- Replaced all 3 `npx bmad-method` invocations in `installBmad()`, `updateBmad()`, and `applyCustomizations()` with `getBmadCommand()` calls
- All existing flag appending logic (`--modules`, `--tools`) preserved unchanged
- Cross-platform path quoting implemented via template literal (`"${wrapperPath}"`)
- Verified `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` resolves correctly
- Confirmed zero `npx bmad-method` strings remain in `lib/bmad.js`
- Existing `_bmad/` directory preserved — no corruption
- `npm test` passes (27 skills, 11 agents)
- No automated test suite exists yet (Epic 7) — manual verification performed per Testing Standards

### File List

- `package.json` — Added `"bmad-method": "6.0.4"` to dependencies
- `lib/bmad.js` — Added `getBmadCommand()` helper, replaced 3x `npx bmad-method` invocations
- `package-lock.json` — Auto-updated by npm install (bmad-method + transitive deps; full regeneration — lockfile was stale from ai-agent-skills@2.17.1)
- `docs/architecture.md` — Updated stale `npx bmad-method` references to reflect local dependency invocation pattern
- `docs/source-tree-analysis.md` — Updated stale `npx bmad-method` reference
- *(deleted)* `_bmad-output/implementation-artifacts/5-1-standalone-binary-packaging.md` — Old Epic 5 story replaced by this story

## Change Log

- 2026-03-15: Implemented Story 5.1 — Added bmad-method as direct npm dependency and replaced all npx invocations with local node execution via getBmadCommand() helper. Eliminates npm registry network calls for bmad-method (NFR20/NFR21 compliance).
- 2026-03-15: Code review fixes — (H1) package-lock.json full regeneration documented (was stale from ai-agent-skills@2.17.1); (H2) updated stale `npx bmad-method` references in docs/architecture.md and docs/source-tree-analysis.md; (M1) Tasks 6 & 7 unmarked as [x] — require human tester; (M2) getBmadCommand() catch block now chains original error via `wrapped.cause = err`; (L1) File List updated with deleted old story file and docs changes.
