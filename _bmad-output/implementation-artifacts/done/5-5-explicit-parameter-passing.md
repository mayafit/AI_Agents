# Story 5.5: Explicit Parameter Passing to bmad-method

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 5 — Bundled BMAD Installation (Phase 2) -->
<!-- Sprint Phase: Phase A — Installation Fixes (next release) -->
<!-- Dependencies: Stories 5.1-5.4 (all done). Story 5.6 (space-in-path) shares same code — coordinate. -->

## Story

As a **DevOps engineer**,
I want ma-agents to pass all collected installation parameters to bmad-method as explicit CLI flags,
so that BMAD is fully configured for all selected platforms (including OpenCode) without relying on the broken silent install mode.

## Acceptance Criteria

1. **Given** the user selects platforms during the ma-agents wizard (e.g., claude-code, cursor, opencode)
   **When** bmad.js invokes bmad-method
   **Then** it passes `--tools claude-code,cursor,opencode` explicitly
   **And** bmad-method configures all selected platforms correctly

2. **Given** the user provides their name and language preference during the ma-agents wizard
   **When** bmad.js invokes bmad-method
   **Then** it passes `--user-name`, `--communication-language`, `--document-output-language`, and `--output-folder` as explicit flags
   **And** bmad-method uses these values without prompting

3. **Given** all BMAD-relevant parameters are passed as explicit CLI flags
   **When** the `--yes` flag is also included
   **Then** bmad-method skips prompts only for parameters already supplied via flags
   **And** applies its own defaults for any new parameters ma-agents hasn't mapped (FR125)
   **And** no interactive BMAD prompt appears to the user (FR126)

4. **Given** the installer runs in CI/CD mode (`--yes --force`)
   **When** bmad.js constructs the bmad-method command
   **Then** it uses the same `buildBmadArgs()` function with pre-determined default answers
   **And** produces identical BMAD configuration as interactive mode (FR127)

5. **Given** the extension module exists at `lib/bmad-extension/`
   **When** bmad.js invokes bmad-method
   **Then** it passes `--custom-content` with the quoted path to the extension module
   **And** bmad-method validates the module.yaml and deploys the extension

6. **Given** bmad-method is invoked with `--action update` for existing installations
   **When** the update completes
   **Then** all explicit parameters are applied to the update
   **And** existing customizations are preserved per bmad-method's update behavior

## Tasks / Subtasks

- [x] Task 1: Create `buildBmadArgs()` function in `lib/bmad.js` (AC: #1, #2, #3, #5)
  - [x] 1.1 Define `buildBmadArgs(installContext)` that returns a complete command string
  - [x] 1.2 Map all available parameters to bmad-method CLI flags (see parameter mapping table below)
  - [x] 1.3 Quote ALL path arguments with double quotes for space-in-path safety (AC ties to Story 5.6)
  - [x] 1.4 Always include `--yes` flag to suppress interactive prompts
  - [x] 1.5 Include `--custom-content` pointing to `lib/bmad-extension/` if it exists
- [x] Task 2: Update `installBmad()` to use `buildBmadArgs()` (AC: #1, #2, #3)
  - [x] 2.1 Replace string-concatenation command building with `buildBmadArgs()` call
  - [x] 2.2 Pass `action: 'install'` in the install context
  - [x] 2.3 Verify `prePopulateBmadCache(force)` still runs BEFORE execSync
- [x] Task 3: Update `updateBmad()` to use `buildBmadArgs()` (AC: #6)
  - [x] 3.1 Replace string-concatenation command building with `buildBmadArgs()` call
  - [x] 3.2 Pass `action: 'update'` in the install context
- [x] Task 4: Update `applyCustomizations()` recompile step to use `buildBmadArgs()` (AC: #3, #4)
  - [x] 4.1 Replace the recompile command at current line ~130 with `buildBmadArgs()` call
  - [x] 4.2 This call uses `action: 'install'` (it's a recompile, not update)
- [x] Task 5: Update function signatures to accept install context (AC: #2, #4)
  - [x] 5.1 Add `userName`, `commLang`, `docLang`, `outputFolder` parameters (with defaults)
  - [x] 5.2 Verify `cli.js` call sites are backward-compatible with new optional params (no changes needed — defaults apply)
  - [x] 5.3 Ensure CI/CD path (`--yes`) uses same `buildBmadArgs()` with default values (FR127)
- [x] Task 6: Manual smoke test (AC: #1-#6)
  - [x] 6.1 Run `npx ma-agents install --yes` and verify command output includes all explicit flags
  - [x] 6.2 Verify `_bmad/` output includes all expected modules and tool configurations
  - [x] 6.3 Test update path on existing installation

## Dev Notes

### Core Change: Replace ad-hoc command building with `buildBmadArgs()`

The current `lib/bmad.js` builds bmad-method commands via string concatenation in 3 places (lines 26, 52, 130). Each duplicates the pattern: `getBmadCommand('install --yes --directory "..."')` + manual `+= --modules` + manual `+= --tools`. This story replaces all 3 with a single `buildBmadArgs(installContext)` function per architecture Decision P2-6.

### Current State of `lib/bmad.js` (428 lines)

**3 command construction sites to replace:**

| Function | Line | Current pattern | Action flag |
|---|---|---|---|
| `installBmad()` | 26 | `getBmadCommand('install --yes --directory "..."')` + modules + tools | `install` |
| `updateBmad()` | 52 | `getBmadCommand('install --action update --yes --directory "..."')` + modules + tools | `update` |
| `applyCustomizations()` | 130 | `getBmadCommand('install --yes --directory "..."')` + modules + tools | `install` (recompile) |

**What is NOT changing:**
- `getBmadCommand(args)` stays — it resolves `bmad-npx-wrapper.js` via `require.resolve()` (Story 5.1)
- `prePopulateBmadCache(force)` stays — cache pre-population logic is correct (Story 5.3)
- `deployMethodology()` stays — runs AFTER execSync, unrelated to parameter passing
- `restoreGitDir()` stays — internal cache helper
- `applyCustomizations()` stages 1-7 (file copy, extension deploy, workflow deploy) stay — only the recompile execSync changes

### `buildBmadArgs()` Reference Implementation (from Architecture P2-6)

```javascript
function buildBmadArgs(installContext) {
  const bmadPath = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
  const args = [
    'node', `"${bmadPath}"`, 'install',
    '--directory', `"${installContext.projectRoot}"`,
    '--modules', installContext.modules.join(','),
    '--tools', installContext.tools.length > 0 ? installContext.tools.join(',') : 'none',
    '--yes',
  ];
  // Optional params — only include if provided (let bmad-method default otherwise)
  if (installContext.userName) {
    args.push('--user-name', `"${installContext.userName}"`);
  }
  if (installContext.commLang) {
    args.push('--communication-language', installContext.commLang);
  }
  if (installContext.docLang) {
    args.push('--document-output-language', installContext.docLang);
  }
  if (installContext.outputFolder) {
    args.push('--output-folder', installContext.outputFolder);
  }
  // Extension module — only if directory exists
  const extensionPath = path.join(__dirname, 'bmad-extension');
  if (fs.existsSync(extensionPath)) {
    args.push('--custom-content', `"${extensionPath}"`);
  }
  if (installContext.action === 'update') {
    args.push('--action', 'update');
  }
  return args.join(' ');
}
```

### Parameter Mapping Table (FR123)

| ma-agents source | bmad-method flag | Current state | Notes |
|---|---|---|---|
| `projectRoot` (detected) | `--directory` | Already passed (Story 5.4 fix) | **Must quote for spaces** |
| `tools` array from wizard | `--tools` | Already passed | Fixes OpenCode bug — previously not configured |
| `modules` array | `--modules` | Already passed | Default: `['bmm', 'bmb']` |
| `userName` | `--user-name` | **NOT passed** — new | Optional; let bmad-method default if absent |
| `commLang` | `--communication-language` | **NOT passed** — new | Optional; defaults to "English" |
| `docLang` | `--document-output-language` | **NOT passed** — new | Optional; defaults to "English" |
| `outputFolder` | `--output-folder` | **NOT passed** — new | Optional; defaults to "_bmad-output" |
| extension module path | `--custom-content` | **NOT passed** — new | Path to `lib/bmad-extension/`; quote for spaces |
| install vs update | `--action` | Already passed for update | `install` (default) or `update` |
| `--yes` | `--yes` | Already passed | Suppresses prompts for supplied params only |

### bmad-method v6.0.4 CLI Flags (Verified from `node_modules`)

From `node_modules/bmad-method/tools/cli/commands/install.js` lines 14-26:
```
--directory <path>               Installation directory
--modules <modules>              Comma-separated list of module IDs
--tools <tools>                  Comma-separated list of tools/IDEs
--custom-content <paths>         Comma-separated list of custom module paths
--action <type>                  install, update, quick-update, compile-agents
--user-name <name>               Name for agents to use
--communication-language <lang>  Language for agent communication
--document-output-language <lang> Language for document output
--output-folder <path>           Output folder relative to project root
-y, --yes                        Accept all defaults and skip prompts
```

### Critical: `--custom-content` Replaces Manual Extension Deployment

Currently `applyCustomizations()` manually copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/` (lines 156-162). With `--custom-content`, bmad-method handles this natively. **However**, the manual copy may still be needed for the recompile step in `applyCustomizations()` if bmad-method's `--custom-content` doesn't deploy to the same target path. Verify during implementation:
- Does `--custom-content` deploy to `_bmad/extensions/<module-name>/`?
- If yes: the manual `fs.copy` at line 160 can be removed (bmad-method handles it)
- If no: keep the manual copy AND pass `--custom-content` (belt-and-suspenders)

### Wizard Gap: `userName`, `commLang`, `docLang` Not Collected

The `bin/cli.js` wizard does NOT currently prompt for user name, communication language, document output language, or output folder. These are new parameters from FR123. For this story:
- Add the new params to function signatures with sensible defaults
- Pass defaults to `buildBmadArgs()` — bmad-method's `--yes` behavior will apply its own defaults for unprovided params
- **Do NOT add wizard prompts in this story** — that's a future enhancement. The goal is to stop the silent install from skipping config, not to collect new data from users yet.

### Three Bugs This Story Fixes

1. **OpenCode not configured**: `--tools` explicitly lists all selected platforms including opencode (currently tools ARE passed, but this ensures consistency through `buildBmadArgs()`)
2. **Spaces in paths**: All path arguments quoted in `buildBmadArgs()` — `--directory "d:\My Projects\agents"` (ties to Story 5.6)
3. **Silent install skips config**: `--yes` combined with explicit flags means bmad-method applies full config from flags, defaults only for unmapped params

### Project Structure Notes

- **Primary file**: `lib/bmad.js` — all changes in this file (existing 428 lines)
- **Secondary file**: `bin/cli.js` — update call sites to pass new optional params (existing patterns)
- **No new files created**
- **No new dependencies**
- Extension module at `lib/bmad-extension/` stays unchanged — just referenced by `--custom-content`

### References

- [Source: architecture.md, Decision P2-6] — Full `buildBmadArgs()` architecture with parameter mapping table
- [Source: epics.md, Story 5.5 lines 531-577] — Acceptance criteria and technical notes
- [Source: epics.md, Story 5.6 lines 578-603] — Space-in-path bug fix (shares code with this story)
- [Source: prd.md, FR123-FR127] — Explicit parameter passing requirements
- [Source: prd.md, NFR20-NFR21] — Version pinning and deterministic installation
- [Source: lib/bmad.js lines 25-49] — Current `installBmad()` implementation
- [Source: lib/bmad.js lines 51-75] — Current `updateBmad()` implementation
- [Source: lib/bmad.js lines 77-200] — Current `applyCustomizations()` with recompile at line 130
- [Source: node_modules/bmad-method/tools/cli/commands/install.js lines 14-26] — Verified CLI flag definitions
- [Source: bin/cli.js lines 374-432] — Call sites for installBmad/updateBmad/applyCustomizations
- [Source: 5-4-validate-bundled-installation.md] — Previous story: critical `--directory` bug fix, validation results

## Previous Story Intelligence (5.4)

**Critical bug found and fixed**: All 3 `getBmadCommand()` callsites were missing `--directory "${projectRoot}"`. bmad-method v6.0.4 only skips the directory prompt when `--directory` is explicitly provided; without it, non-TTY `execSync` silently exits with code 0 and no `_bmad/` is created. This was fixed in Story 5.4.

**Learnings to apply:**
- bmad-method silently succeeds when params are missing — always verify `_bmad/` output after install
- The `--directory` parameter MUST be quoted for paths with spaces (discovered but not fully fixed in 5.4 — this story completes the fix)
- `force` parameter must thread through all callsites — verify `buildBmadArgs()` doesn't drop it
- The `ac#3 status gap` (BMAD module status not surfaced by `npx ma-agents status`) is out of scope

**From Story 5.3 code review:**
- `prePopulateBmadCache()` removed `projectRoot` param — call is `prePopulateBmadCache(force)` only
- `fs.existsSync()` replaced with `await fs.pathExists()` — use async consistently
- Summary log only prints when `copied > 0 || replaced > 0` — correct behavior

## Git Intelligence

Recent commits (descending):
```
998fa13 docs(planning): add F9 migration, F10 multi-repo, F6 explicit params, Epic 17 sprint rework
8e88686 chore(release): bump version to 2.21.0
63610de feat(epic-13): auto-generate project-context.md at install time
```

Current version: **2.21.0**. bmad-method pinned at **6.0.4** in `package.json` line 29.

No recent code changes to `lib/bmad.js` since Story 5.4 — the file is stable and ready for modification.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Verified bmad-method `--custom-content` deploys to `_bmad/custom/` NOT `_bmad/extensions/` — kept manual extension copy (belt-and-suspenders approach per Dev Notes)
- cli.js call sites unchanged since new params use default destructured options `{} = {}` — backward compatible without modification

### Completion Notes List

- Created `buildBmadArgs(ctx)` function implementing Architecture Decision P2-6, replacing 3 ad-hoc string-concatenation command construction sites
- `buildBmadArgs()` delegates to existing `getBmadCommand()` for wrapper path resolution (preserving Story 5.1 fix)
- All 3 callsites (`installBmad`, `updateBmad`, `applyCustomizations` recompile) now use `buildBmadArgs()`
- Added `{ userName, commLang, docLang, outputFolder }` options object to `installBmad()`, `updateBmad()`, and `applyCustomizations()` with empty-string defaults
- `--custom-content` automatically included when `lib/bmad-extension/` directory exists
- ALL string arguments double-quoted for space-in-path safety: `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content` (ties to Story 5.6)
- Input validation added: `buildBmadArgs()` throws clear error on missing `projectRoot` or non-array `modules`
- Graceful handling of undefined/null `tools` array (defaults to `--tools none`)
- 31 unit tests covering all parameter combinations, quoting, edge cases, input validation, and function signatures
- Full regression suite: 148 tests pass, 0 failures
- Code review findings addressed: H1 (--output-folder quoting), H2 (language flag quoting), M2 (Task 5.2 clarification), M3/M4 (unconditional --custom-content test + edge case), M5 (input validation), L1 (null tools test)
- M1 (shell injection via execSync) noted as pre-existing pattern — deferred to future wizard story when user-facing params are collected

### File List

- `lib/bmad.js` — Added `buildBmadArgs()`, updated `installBmad()`, `updateBmad()`, `applyCustomizations()` signatures and command construction
- `test/build-bmad-args.test.js` — New: 22 unit tests for `buildBmadArgs()` and updated function signatures
- `package.json` — Added `build-bmad-args.test.js` to test script
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Status: ready-for-dev → review
- `_bmad-output/implementation-artifacts/5-5-explicit-parameter-passing.md` — Story file updates (tasks, status, dev record)

## Change Log

- 2026-03-26: Implemented Story 5.5 — replaced 3 ad-hoc command construction sites with single `buildBmadArgs()` function per Architecture Decision P2-6. Added explicit parameter passing for `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, and `--custom-content` flags. All string arguments double-quoted for space safety. 31 tests, 0 regressions.
- 2026-03-26: Addressed code review findings — 2 High, 5 Medium, 1 Low. Fixed inconsistent quoting (H1/H2), added input validation (M5), improved test coverage (M3/M4/L1), clarified Task 5.2 (M2). Shell injection concern (M1) noted for future wizard story.
