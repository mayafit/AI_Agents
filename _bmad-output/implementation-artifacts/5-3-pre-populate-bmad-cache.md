# Story 5.3: Pre-populate BMAD External Module Cache

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **DevOps engineer**,
I want the installer to pre-populate `~/.bmad/cache/external-modules/` from the bundled cache before invoking bmad-method,
So that bmad-method finds the external modules locally and skips git clone.

## Acceptance Criteria

1. Before invoking bmad-method (install or update), the installer copies each module from `lib/bmad-cache/<code>/` to `~/.bmad/cache/external-modules/<code>/` — only if the target directory does not already exist (or `--force` is set)
2. If the target cache directory `~/.bmad/cache/external-modules/<code>/` already exists and `--force` is NOT set, the existing cache is preserved (no overwrite)
3. If `--force` is set, the existing cache is replaced with the bundled version
4. The installer sets `GIT_TERMINAL_PROMPT=0` in the child process environment when invoking bmad-method to prevent interactive git prompts
5. After cache pre-population, bmad-method's `cloneExternalModule()` detects `fs.pathExists(moduleCacheDir)` is true, skips git clone, and uses the cached copy
6. On connected machines, bmad-method may `git fetch` on existing cache dirs — this succeeds silently but does not alter the deterministic outcome. In air-gapped environments, `git fetch` fails silently and the pre-populated cache is used as-is
7. The installation result is deterministic per NFR20/NFR21 — same bmad-method version + same module cache = identical `_bmad/` output regardless of network connectivity

## Tasks / Subtasks

- [ ] Task 1: Create `prePopulateBmadCache()` function in `lib/bmad.js` (AC: #1, #2, #3)
  - [ ] 1.1 Add a new exported async function `prePopulateBmadCache(projectRoot, force = false)` in `bmad.js`
  - [ ] 1.2 Resolve the bundled cache source: `path.join(__dirname, 'bmad-cache')` — if directory doesn't exist, log warning and return (graceful no-op for packages built without cache)
  - [ ] 1.3 Determine target directory: `path.join(os.homedir(), '.bmad', 'cache', 'external-modules')` — use `os.homedir()` (add `const os = require('os')` at top)
  - [ ] 1.4 Create target directory structure if it doesn't exist: `fs.ensureDir(targetDir)`
  - [ ] 1.5 Read module directories from `lib/bmad-cache/` (exclude `cache-manifest.json`)
  - [ ] 1.6 For each module directory:
    - Check if `path.join(targetDir, moduleCode)` exists
    - If exists AND NOT force: skip with log message (`chalk.gray`)
    - If exists AND force: remove existing (`fs.remove`), then copy
    - If not exists: copy (`fs.copy`)
  - [ ] 1.7 Log summary of pre-population results (modules copied, skipped, replaced)

- [ ] Task 2: Integrate cache pre-population into install flow (AC: #1, #5)
  - [ ] 2.1 In `installBmad()`: call `await prePopulateBmadCache(projectRoot)` BEFORE the `execSync(command, ...)` line
  - [ ] 2.2 In `updateBmad()`: call `await prePopulateBmadCache(projectRoot)` BEFORE the `execSync(command, ...)` line
  - [ ] 2.3 In `applyCustomizations()`: call `await prePopulateBmadCache(projectRoot)` BEFORE the recompile `execSync(command, ...)` line (step 3's recompile, around line 133)
  - [ ] 2.4 Pass `force` parameter through from caller if available (default false)

- [ ] Task 3: Set `GIT_TERMINAL_PROMPT=0` on bmad-method invocation (AC: #4)
  - [ ] 3.1 In all 3 `execSync` calls that invoke bmad-method, add environment variable: `execSync(command, { stdio: 'inherit', cwd: projectRoot, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })`
  - [ ] 3.2 This prevents interactive git credential prompts in air-gapped environments where `git fetch` might hang

- [ ] Task 4: Export new function (AC: #1)
  - [ ] 4.1 Add `prePopulateBmadCache` to the `module.exports` block

- [ ] Task 5: Manual integration test (AC: #5, #6, #7) *(requires human tester)*
  - [ ] 5.1 Run full install flow with bundled cache present — verify modules appear in `~/.bmad/cache/external-modules/`
  - [ ] 5.2 Run install again without `--force` — verify existing cache is NOT overwritten
  - [ ] 5.3 Run install with `--force` — verify cache is replaced
  - [ ] 5.4 Verify complete BMAD installation succeeds using pre-populated cache
  - [ ] 5.5 Verify no interactive git prompts appear (GIT_TERMINAL_PROMPT=0)

## Dev Notes

### Architecture Compliance

- **Decision P2-6** (Bundled BMAD Installation): This story implements step 1 of the 2-step mechanism. Step 2 (invoke from npm dependency) was completed in Story 5.1.
- **NFR20** (Version Pinning): Cache modules are pinned at clone time by Story 5.2's build script. This story copies them without modification.
- **NFR21** (Deterministic Installation): Pre-populating the cache ensures bmad-method's `cloneExternalModule()` finds existing modules and skips `git clone`, producing identical output regardless of network connectivity.
- **Anti-pattern from architecture**: "Letting bmad-method auto-fetch external modules without pre-populating the cache first (breaks air-gap)" [Source: architecture.md, Decision P2-6 validation]

### Implementation Pattern

The pre-population function should follow this pattern:

```javascript
const os = require('os');

async function prePopulateBmadCache(projectRoot, force = false) {
    const cacheSource = path.join(__dirname, 'bmad-cache');
    if (!fs.existsSync(cacheSource)) {
        console.log(chalk.gray('  No bundled BMAD cache found — skipping pre-population'));
        return;
    }

    const targetDir = path.join(os.homedir(), '.bmad', 'cache', 'external-modules');
    await fs.ensureDir(targetDir);

    const entries = await fs.readdir(cacheSource);
    const modules = entries.filter(e => e !== 'cache-manifest.json');

    for (const mod of modules) {
        const src = path.join(cacheSource, mod);
        const dst = path.join(targetDir, mod);
        const stat = await fs.stat(src);
        if (!stat.isDirectory()) continue;

        if (await fs.pathExists(dst)) {
            if (force) {
                await fs.remove(dst);
                await fs.copy(src, dst);
                console.log(chalk.cyan(`    + Replaced cached module: ${mod}`));
            } else {
                console.log(chalk.gray(`    ~ Cached module exists, skipping: ${mod}`));
            }
        } else {
            await fs.copy(src, dst);
            console.log(chalk.cyan(`    + Pre-populated cached module: ${mod}`));
        }
    }
}
```

The `GIT_TERMINAL_PROMPT=0` environment variable is added to the `execSync` options:

```javascript
// In installBmad(), updateBmad(), and applyCustomizations():
execSync(command, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
});
```

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/bmad.js` | Add `os` require, add `prePopulateBmadCache()` function, call it before each bmad-method invocation, add `GIT_TERMINAL_PROMPT=0` to execSync env, export new function |

### Critical Constraints

- **Call order matters**: `prePopulateBmadCache()` MUST run BEFORE any `execSync` that invokes bmad-method. If it runs after, bmad-method will have already attempted `git clone` and failed in air-gapped environments.
- **Do NOT modify any other logic in bmad.js**: The `getBmadCommand()` helper, flag appending, `applyCustomizations()` steps 1-6, CSV registry logic — all must remain untouched. Only add the pre-population call and env variable.
- **Graceful degradation**: If `lib/bmad-cache/` doesn't exist (package built without running `npm run build:bmad-cache`), the function must return silently. It should NOT throw or block installation.
- **Cross-platform paths**: Use `os.homedir()` for the user's home directory. Use `path.join()` for all path construction. Works on Windows, macOS, and Linux.
- **No new dependencies**: Uses only `os` (Node.js built-in), `fs-extra` (existing dependency), `path` (built-in), `chalk` (existing dependency).
- **Module codes must match bmad-method expectations**: The directory names in `lib/bmad-cache/` (bmb, cis, tea, gds) must match exactly what bmad-method's `cloneExternalModule()` looks for in `~/.bmad/cache/external-modules/`. These codes come from `external-official-modules.yaml` and are set by Story 5.2's build script.
- **`fs.copy()` semantics**: `fs-extra`'s `fs.copy()` copies directory contents recursively. It does NOT require the destination to not exist — but for predictable behavior with `--force`, explicitly `fs.remove()` first.
- **Three invocation sites**: Pre-population must be called in `installBmad()`, `updateBmad()`, and `applyCustomizations()`. Missing any one creates a gap where bmad-method might attempt network fetches.
- **Design decision on determinism**: The epics note: "bmad-method's internal git fetch on existing cache directories does a `git fetch` + `git reset --hard origin/main` only if fetch succeeds. To guarantee deterministic output per NFR20/NFR21, the pre-population step should set the cache directories as read-only or the installer should re-copy bundled cache after bmad-method completes." For the initial implementation, rely on the fact that `git fetch` failing silently in air-gapped environments is sufficient. If determinism on connected machines is required, add a post-invocation re-copy step. This can be addressed in Story 5.4 validation.

### Testing Standards

- No automated test suite exists yet (Epic 7). Manual verification is sufficient for this story.
- Verify by running the full install flow: `npx ma-agents install` selecting BMAD installation.
- Confirm modules appear in `~/.bmad/cache/external-modules/` before bmad-method is invoked.
- Test idempotency: running install twice should skip already-cached modules.
- Test `--force`: should replace cached modules.

### Project Structure Notes

- `lib/bmad.js` is the only file that needs changes. It currently has 261 lines.
- `lib/bmad-cache/` does not exist yet — it will be created by Story 5.2's build script. The pre-population function handles this gracefully.
- `.npmignore` does NOT exclude `lib/bmad-cache/` — confirmed, it will ship with `npm pack`.
- The `module.exports` block at line 256-261 currently exports: `isBmadInstalled`, `installBmad`, `updateBmad`, `applyCustomizations`.

### Previous Story Intelligence (5.1)

- Story 5.1 established `getBmadCommand()` helper in `bmad.js` — this story's pre-population runs BEFORE `getBmadCommand()` output is used in `execSync`
- Story 5.1 confirmed `bmad-method@6.0.4` is in `package.json` as exact-version dependency
- Story 5.1 verified `require.resolve('bmad-method/tools/bmad-npx-wrapper.js')` works correctly
- Story 5.1 noted: "Version bumps require: update pin in `package.json`, re-run `npm run build:bmad-cache` (Story 5.2), test, release" — pre-population uses whatever is in `lib/bmad-cache/`, so version coordination is handled by the build script
- Story 5.1 code review added `wrapped.cause = err` error chaining — follow same pattern for any new error handling
- Story 5.1 is currently in `review` status — Tasks 6 & 7 require human tester (backward compatibility and integration)

### Previous Story Intelligence (5.2)

- Story 5.2 creates the `lib/bmad-cache/` directory with modules (bmb, cis, tea, gds) and `cache-manifest.json`
- Story 5.2 uses `fs-extra` for all file operations — same approach should be used here
- Story 5.2 is in `backlog` status — this story's pre-population function gracefully handles the case where `lib/bmad-cache/` doesn't exist yet

### Git Intelligence

Recent commits show:
- `476b717` — Added all BMAD planning and implementation artifacts
- `4fa0596` — Track `_bmad-output/` in git per FR58
- `c32b7c0` — Fix to prevent BMAD agent files from being overwritten with empty stubs
- Code patterns: uses `chalk` for colored output (`.cyan` for actions, `.gray` for info, `.red` for errors), `fs-extra` for file ops, `execSync` for shell commands

### Epic 5 Cross-Story Context

This is Story 5.3 of 4 in Epic 5 (Bundled BMAD Installation). Execution order: 5.1 -> 5.2 -> 5.3 -> 5.4.

- **Story 5.1** (review): Add bmad-method as npm dependency, replace `npx` invocations — DONE, in code review
- **Story 5.2** (backlog): Create `npm run build:bmad-cache` script to clone external modules into `lib/bmad-cache/` — prerequisite for this story's cache to exist
- **Story 5.3** (this): Pre-populate `~/.bmad/cache/external-modules/` from bundled cache before bmad-method runs
- **Story 5.4**: Validate the complete bundled installation works end-to-end

**Dependency note**: This story can be implemented and tested independently of Story 5.2. The `prePopulateBmadCache()` function gracefully returns if `lib/bmad-cache/` doesn't exist. Once Story 5.2 is completed and the cache is built, this story's code will automatically use it.

### References

- [Source: architecture.md, Decision P2-6] — Bundled BMAD Installation architecture, pre-population mechanism
- [Source: architecture.md, Decision P2-6 validation] — Anti-pattern: not pre-populating cache before bmad-method runs
- [Source: epics.md, Story 5.3] — Acceptance criteria and technical notes
- [Source: prd.md, FR76] — Cache pre-population for air-gapped installation
- [Source: prd.md, NFR20-NFR21] — Version pinning and deterministic installation requirements
- [Source: lib/bmad.js] — Current bmad.js implementation (261 lines, 4 exports, 3 execSync invocation sites)
- [Source: 5-1-bmad-method-direct-dependency.md] — Previous story establishing bmad-method dependency and getBmadCommand() helper
- [Source: 5-2-bmad-cache-build-script.md] — Previous story defining lib/bmad-cache/ structure and cache-manifest.json format

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

### File List
