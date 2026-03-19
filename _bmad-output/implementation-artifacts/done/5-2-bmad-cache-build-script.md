# Story 5.2: Create BMAD Cache Build Script

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want a build script that clones all BMAD external modules and their dependencies into `lib/bmad-cache/`,
So that the external modules can be bundled inside the ma-agents npm package for deterministic installation.

## Acceptance Criteria

1. Running `npm run build:bmad-cache` on a connected machine clones each module listed in bmad-method's `external-official-modules.yaml` (bmb, cis, tea, gds) into `lib/bmad-cache/<module-code>/` using `git clone --depth 1`
2. The script runs `npm install --omit=dev` inside each cloned module directory to install production dependencies
3. The script removes `.git/` directories from each cloned module to reduce package size
4. The script creates `lib/bmad-cache/cache-manifest.json` recording module codes, versions (commit SHA), clone date, and source URLs
5. Running `npm run build:bmad-cache -- --force` when `lib/bmad-cache/` already exists removes the existing cache and rebuilds from scratch
6. Running `npm run build:bmad-cache` without `--force` when a module's cached version matches the upstream HEAD skips that module (incremental update)
7. Running `npm pack` produces a tarball that includes `lib/bmad-cache/` and all module directories

## Tasks / Subtasks

- [x] Task 1: Create the build script file (AC: #1)
  - [x] 1.1 Create `scripts/build-bmad-cache.js` (Node.js script, not shell — cross-platform)
  - [x] 1.2 Add `"build:bmad-cache": "node scripts/build-bmad-cache.js"` to `package.json` scripts section
  - [x] 1.3 Parse `--force` from `process.argv`

- [x] Task 2: Read module definitions from bmad-method (AC: #1)
  - [x] 2.1 Locate `external-official-modules.yaml` via `require.resolve('bmad-method/external-official-modules.yaml')` — if not found, try `path.join(require.resolve('bmad-method/package.json'), '..', 'external-official-modules.yaml')`
  - [x] 2.2 Parse the YAML file to extract module list (code, git URL, branch)
  - [x] 2.3 Add a YAML parser — use `js-yaml` (add to devDependencies) OR parse the simple YAML structure manually to avoid adding a dependency

- [x] Task 3: Implement clone logic for each module (AC: #1, #3)
  - [x] 3.1 For each module: `git clone --depth 1 --branch <branch> <url> lib/bmad-cache/<code>/`
  - [x] 3.2 After clone: remove `lib/bmad-cache/<code>/.git/` directory recursively
  - [x] 3.3 Use `execSync` for git commands, `fs-extra` for directory operations

- [x] Task 4: Install production dependencies per module (AC: #2)
  - [x] 4.1 For each cloned module directory: run `npm install --omit=dev` inside it
  - [x] 4.2 Handle modules that have no `package.json` or no dependencies gracefully (skip npm install)

- [x] Task 5: Generate cache-manifest.json (AC: #4)
  - [x] 5.1 Before removing `.git/`, capture the HEAD commit SHA via `git -C lib/bmad-cache/<code> rev-parse HEAD`
  - [x] 5.2 Write `lib/bmad-cache/cache-manifest.json` with structure:
    ```json
    {
      "generated": "2026-03-15T...",
      "bmadMethodVersion": "6.0.4",
      "modules": {
        "bmb": { "url": "...", "branch": "main", "commitSha": "abc123", "clonedAt": "..." },
        "cis": { ... },
        "tea": { ... },
        "gds": { ... }
      }
    }
    ```

- [x] Task 6: Implement --force flag (AC: #5)
  - [x] 6.1 If `--force` passed and `lib/bmad-cache/` exists: remove entire directory before starting
  - [x] 6.2 Use `fs.remove()` (from fs-extra) for safe recursive deletion

- [x] Task 7: Implement incremental update (AC: #6)
  - [x] 7.1 If `lib/bmad-cache/<code>/` exists and NOT `--force`: check upstream HEAD via `git ls-remote <url> <branch>`
  - [x] 7.2 Compare remote HEAD SHA with `cache-manifest.json` `commitSha` for that module
  - [x] 7.3 If match: skip module with log message. If different: remove and re-clone.

- [x] Task 8: Verify npm pack inclusion (AC: #7)
  - [x] 8.1 Confirm `.npmignore` does NOT exclude `lib/bmad-cache/` (already correct — no change needed)
  - [x] 8.2 Run `npm pack --dry-run` and verify `lib/bmad-cache/` files appear in output

## Dev Notes

### Architecture Compliance

- **Decision P2-6** (Bundled BMAD Installation): This story creates the build-time cache that Story 5.3 will pre-populate at install-time
- **NFR20** (Version Pinning): Modules are pinned at clone time via `--depth 1`. The `cache-manifest.json` records exact commit SHAs for reproducibility
- **NFR21** (Deterministic Installation): The cached modules are committed to the repo, making every `npm pack` produce identical BMAD module content
- **Anti-pattern from architecture**: "Including `.git/` directories in `lib/bmad-cache/` — wastes package size, not needed for installation" [Source: architecture.md, Decision P2-6 validation]

### Implementation Pattern

```javascript
#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '..', 'lib', 'bmad-cache');
const force = process.argv.includes('--force');

// 1. Locate external-official-modules.yaml from bmad-method dependency
const bmadMethodDir = path.dirname(require.resolve('bmad-method/package.json'));
const modulesYamlPath = path.join(bmadMethodDir, 'external-official-modules.yaml');

// 2. Parse YAML, iterate modules, clone, npm install, remove .git, record manifest
// ... (see tasks for detailed steps)
```

### external-official-modules.yaml Format

This file is inside `node_modules/bmad-method/` and lists modules like:
```yaml
modules:
  - code: bmb
    name: bmad-builder
    url: https://github.com/user/bmad-builder.git
    branch: main
  - code: cis
    ...
```

The dev agent MUST read the actual file structure after `npm install` — the exact YAML schema may differ from this example. Parse defensively.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `scripts/build-bmad-cache.js` | **NEW** — the build script |
| `package.json` | Add `"build:bmad-cache"` to `scripts` section |
| `lib/bmad-cache/` | **NEW** directory created by the script (gitignored initially, committed after first build) |
| `lib/bmad-cache/cache-manifest.json` | **NEW** — generated by the script |

### Critical Constraints

- **Cross-platform**: Use `execSync` for git/npm commands. Use `fs-extra` (already a dependency) for all file operations. Do NOT use shell-specific syntax (no `rm -rf`, use `fs.remove()`).
- **No new production dependencies**: The build script uses only `fs-extra` (already in dependencies) and `child_process` (built-in). For YAML parsing, prefer a simple manual parser or use `js-yaml` as a devDependency — do NOT add `js-yaml` to production dependencies.
- **Prerequisite: Story 5.1 must be completed** — `bmad-method` must be in `package.json` dependencies and `npm install` must have been run so `node_modules/bmad-method/` exists with `external-official-modules.yaml`.
- **Git must be available**: The build script requires `git` on PATH. This is a build-time tool that runs on a developer's connected machine, not at install-time.
- **Commit the output**: After running the script, `lib/bmad-cache/` should be committed to the repo so it ships with `npm pack`. The `.gitignore` must NOT exclude `lib/bmad-cache/`.
- **Script runs OUTSIDE the project's git context**: The `git clone` commands create new repos in `lib/bmad-cache/<code>/`. The `.git/` directories inside those clones are removed. This does not affect the project's own git repository.
- **Order of operations matters**: Capture commit SHA BEFORE removing `.git/` directory. The sequence per module is: clone → capture SHA → npm install → remove `.git/`.

### Testing Standards

- No automated test suite exists yet (Epic 7). Manual verification:
  1. Run `npm run build:bmad-cache` — verify 4 modules cloned, `.git/` removed, `cache-manifest.json` created
  2. Run `npm run build:bmad-cache` again without `--force` — verify modules are skipped (incremental)
  3. Run `npm run build:bmad-cache -- --force` — verify full rebuild
  4. Run `npm pack --dry-run` — verify `lib/bmad-cache/` included in tarball

### Project Structure Notes

- `scripts/` directory does NOT exist yet — create it. This is the first build script in the project.
- `.npmignore` does NOT exclude `lib/bmad-cache/` — already correct, no change needed.
- `package.json` has no `files` field — npm includes everything not in `.npmignore`. This means `lib/bmad-cache/` will automatically ship.
- The `lib/` directory currently contains: `agents.js`, `bmad.js`, `installer.js`, `bmad-customizations/`, `bmad-workflows/`, `mil498-templates/`.

### Previous Story Intelligence (5.1)

- Story 5.1 established `bmad-method@6.0.4` as a direct dependency in `package.json`
- Story 5.1 created `getBmadCommand()` helper in `bmad.js` — not directly relevant to this story but confirms bmad-method is available in `node_modules/`
- Story 5.1 noted: "Version bumps require: update pin in `package.json`, re-run `npm run build:bmad-cache` (Story 5.2), test, release" — this story's script is part of that upgrade workflow

### Epic 5 Cross-Story Context

This is Story 5.2 of 4 in Epic 5 (Bundled BMAD Installation). Execution order: 5.1 -> 5.2 -> 5.3 -> 5.4.

- **Story 5.1** (prerequisite, ready-for-dev): Add bmad-method as npm dependency
- **Story 5.2** (this): Create build script to clone external modules into `lib/bmad-cache/`
- **Story 5.3** (depends on this): Pre-populate `~/.bmad/cache/external-modules/` from `lib/bmad-cache/` at install-time
- **Story 5.4**: Validate the complete bundled installation works end-to-end

Story 5.3 depends on the `lib/bmad-cache/` directory structure and `cache-manifest.json` created by this story. The module directory names (bmb, cis, tea, gds) must match what bmad-method expects in `~/.bmad/cache/external-modules/`.

### References

- [Source: architecture.md, Decision P2-6] — Bundled BMAD Installation architecture, build script mechanism
- [Source: architecture.md, Decision P2-6 validation] — Anti-pattern: no .git/ in cache
- [Source: epics.md, Story 5.2] — Acceptance criteria and technical notes
- [Source: prd.md, FR75] — Build script for bundling external modules
- [Source: prd.md, NFR20-NFR21] — Version pinning and deterministic installation
- [Source: package.json] — Current scripts and dependencies
- [Source: .npmignore] — Current exclusion list (lib/bmad-cache/ NOT excluded)
- [Source: 5-1-bmad-method-direct-dependency.md] — Previous story establishing bmad-method dependency

## Change Log

- 2026-03-15: Created build script `scripts/build-bmad-cache.js` and added `build:bmad-cache` npm script. Implemented all 8 tasks: module definition loading from bmad-method, git clone with depth 1, production dependency installation, .git cleanup, cache-manifest.json generation, --force rebuild, incremental update via git ls-remote comparison, and npm pack verification. Used manual YAML parser (no new dependencies). All 4 modules (bmb, cis, gds, tea) successfully cloned and cached.
- 2026-03-16: Addressed code review findings — 6 items resolved (2 High, 3 Medium, 1 Low). H1: Fixed SHA comparison from substring/startsWith to full equality. H2: Removed unnecessary async from main(). M1: Replaced execSync with execFileSync to prevent command injection. M2: Preserve existing manifest entries for failed modules. M3: Made YAML parser indent-flexible (1-4 for keys, 2-8 for props) with separate quoted/unquoted value handling. L1: Fixed by splitting quoted vs unquoted regex paths.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- YAML path discovery: `external-official-modules.yaml` is at `tools/cli/external-official-modules.yaml` inside bmad-method (not at root as story assumed)
- YAML format: modules are keyed objects (not array of objects as story example suggested). No `branch` field exists — defaulted to `main`
- Bug fix: initial incremental skip counter was incorrect — skipped modules inherited `clonedAt` from manifest causing them to count as cloned. Fixed by adding `skipped` flag to return value.
- Code review fix (H1): SHA comparison used `startsWith(substring(0,7))` — replaced with full `===` equality
- Code review fix (H2): `async function main()` had no awaits — removed async to avoid unhandled promise rejection
- Code review fix (M1): All `execSync` calls replaced with `execFileSync` (array args, no shell interpretation) — eliminates command injection risk. `npm` on Windows requires `shell: true` via platform check.
- Code review fix (M2): Failed modules now preserve their existing manifest entry instead of being dropped
- Code review fix (M3): YAML parser indent ranges relaxed from exact 2/4 to 1-4/2-8, with separate quoted/unquoted value regex paths (also fixes L1)

### Completion Notes List

- All 8 tasks completed and verified via manual testing per Testing Standards
- AC #1: `npm run build:bmad-cache` clones bmb, cis, gds, tea into `lib/bmad-cache/` using `git clone --depth 1`
- AC #2: Script runs `npm install --omit=dev` in each module (skips if no deps or no package.json)
- AC #3: `.git/` directories removed from all cloned modules
- AC #4: `cache-manifest.json` records generated date, bmadMethodVersion, and per-module url/branch/commitSha/clonedAt
- AC #5: `--force` removes existing cache and rebuilds from scratch
- AC #6: Incremental update compares cached SHA vs upstream HEAD via `git ls-remote`, skips unchanged modules
- AC #7: `npm pack --dry-run` confirms `lib/bmad-cache/` files included in tarball
- No new production dependencies added — used manual YAML parser and existing `fs-extra`
- Cross-platform: all file operations use `fs-extra`, no shell-specific syntax

### File List

- `scripts/build-bmad-cache.js` — **NEW** — BMAD cache build script (cross-platform Node.js)
- `package.json` — **MODIFIED** — added `"build:bmad-cache"` to scripts section
- `lib/bmad-cache/` — **NEW** directory (generated by script, contains bmb/, cis/, gds/, tea/, cache-manifest.json)
- `lib/bmad-cache/cache-manifest.json` — **NEW** — generated manifest with module versions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **MODIFIED** — story status updated to in-progress then review
