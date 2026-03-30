# Story 16.7: Portable Path Storage

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **team member cloning a project with multi-repo layout**,
I want stored paths to be portable across machines,
So that `project-layout.yaml` and `config.yaml` don't contain absolute paths that only work on the original developer's machine.

## Problem Context

`writeProjectLayoutYaml()` at [cli.js:329-368](bin/cli.js#L329-L368) writes absolute resolved paths like `d:/Code/kb-repo` into `_bmad-output/project-layout.yaml`. This file lives inside `_bmad-output/` which is typically committed to git. When another developer clones the repo, those absolute paths are wrong for their machine.

Similarly, `writeRepoLayoutConfig()` writes absolute paths into `_bmad/bmm/config.yaml`.

## Acceptance Criteria

1. **Given** a local multi-repo path that is a sibling or relative to the project root, **When** the config is written, **Then** the path is stored as a relative path from the project root (e.g., `../kb-repo` instead of `d:/Code/kb-repo`)
2. **Given** a local path that cannot be expressed as a simple relative path (different drive on Windows, no common ancestor), **When** the config is written, **Then** the absolute path is stored but a comment warns: `# PORTABILITY: absolute path — other developers may need to reconfigure`
3. **Given** a remote repo with a gitUrl, **When** the config is written, **Then** the gitUrl is always stored (it's inherently portable), and the local clone path is stored as relative if possible
4. **Given** stored relative paths, **When** `readExistingLayout()` (Story 16.5) reads them back, **Then** it resolves them to absolute paths using `path.resolve(projectRoot, storedPath)` for runtime use
5. **Given** a `project-layout.yaml` with relative paths, **When** agents read the file, **Then** the paths work correctly because agents operate from the project root
6. **Given** a `config.yaml` with artifact paths derived from relative base paths, **When** the derived `planning_artifacts` and `implementation_artifacts` are written, **Then** they are also relative (e.g., `../kb-repo/_bmad-output/planning-artifacts`)

## Tasks / Subtasks

- [x] Task 1: Add relative path computation utility
  - [x] 1.1 Create `toPortablePath(absolutePath, projectRoot)` function in `bin/cli.js`
  - [x] 1.2 Use `path.relative(projectRoot, absolutePath)` to compute relative path
  - [x] 1.3 If the relative path starts with more than 3 levels of `..` or crosses drive boundaries (Windows), fall back to absolute with portability comment
  - [x] 1.4 Normalize to forward slashes (existing `normalizePath()`)

- [x] Task 2: Update `writeProjectLayoutYaml()` to use relative paths
  - [x] 2.1 Convert each concern's path through `toPortablePath()` before writing
  - [x] 2.2 Add portability warning comment for absolute paths that couldn't be made relative

- [x] Task 3: Update `writeRepoLayoutConfig()` to use relative paths
  - [x] 3.1 Convert `knowledgebase_path` and `sprint_management_path` through `toPortablePath()`
  - [x] 3.2 Derive `planning_artifacts` and `implementation_artifacts` from the portable paths

- [x] Task 4: Update `readExistingLayout()` (Story 16.5 dependency) to resolve relative paths
  - [x] 4.1 When reading paths from files, resolve them via `path.resolve(projectRoot, storedPath)`
  - [x] 4.2 Handle both relative and absolute paths (backward compatibility with existing configs)

- [x] Task 5: Write unit tests
  - [x] 5.1 Test sibling path is stored as relative: `d:/Code/kb` from `d:/Code/agents` becomes `../kb`
  - [x] 5.2 Test deeply nested relative still works: `../../other/kb`
  - [x] 5.3 Test cross-drive path falls back to absolute with warning (Windows)
  - [x] 5.4 Test round-trip: write relative, read back, resolve to absolute matches original
  - [x] 5.5 Test `.` path (same repo) remains unchanged
  - [x] 5.6 Test derived artifact paths are relative when base path is relative

## Dev Notes

### Dependencies

- Story 16.5 (`readExistingLayout`) should be implemented first — Task 4 extends it
- Can be developed in parallel if the `readExistingLayout` interface is agreed upon

### Path Resolution Strategy

```
Project root: d:/Code/agents
External KB:  d:/Code/kb-repo

Relative:     ../kb-repo
Stored:       path: "../kb-repo"
Derived:      planning_artifacts: "../kb-repo/_bmad-output/planning-artifacts"
```

### Backward Compatibility

Existing configs with absolute paths must still work. `readExistingLayout()` should handle both forms: if the path is already absolute, use it directly. If relative, resolve from project root.

### References

- [Source: bin/cli.js — writeProjectLayoutYaml() at line 329]
- [Source: bin/cli.js — writeRepoLayoutConfig() at line 304]
- [Source: Adversarial Review Finding #7 — absolute paths break portability]

## Dev Agent Record

### Implementation Plan
- Added `toPortablePath(absolutePath, projectRoot)` — converts absolute paths to relative using `path.relative()`, with fallback to absolute for cross-drive or deeply nested (>3 levels) paths
- Added `resolveStoredPath(storedPath, projectRoot)` — resolves relative paths back to absolute at read time, passes absolute paths through unchanged
- Updated `writeProjectLayoutYaml()` and `writeRepoLayoutConfig()` to convert paths through `toPortablePath()` before writing
- Updated `readExistingLayout()` to resolve stored relative paths via `resolveStoredPath()`
- Portability warning comment added for non-portable absolute paths

### Completion Notes
- All 5 tasks implemented with 20 dedicated tests
- Full regression suite passes (all existing tests unaffected, including 16-5 tests)
- Backward compatible: existing absolute paths in config files still work correctly
- Round-trip verified: write relative -> read back -> resolve = original absolute path
- No new dependencies added

## File List

- `bin/cli.js` — Added `toPortablePath()`, `resolveStoredPath()`, updated `writeProjectLayoutYaml()`, `writeRepoLayoutConfig()`, `readExistingLayout()`, updated exports
- `test/portable-paths.test.js` — New: 20 unit tests covering toPortablePath, resolveStoredPath, write functions with portability, round-trip, backward compat
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 16-7 status
- `_bmad-output/implementation-artifacts/16-7-portable-path-storage.md` — Story file updated

## Change Log

- 2026-03-28: Implemented portable path storage — paths stored as relative when possible, resolved at read time. 20 tests added.
