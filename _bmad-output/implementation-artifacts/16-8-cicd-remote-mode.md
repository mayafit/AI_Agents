# Story 16.8: CI/CD Remote Repository Mode

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **CI/CD pipeline operator**,
I want to configure remote git repositories for knowledgebase and sprint management in headless mode,
So that automated pipelines can set up multi-repo layouts without interactive prompts.

## Problem Context

The `collectRepoLayout()` function with `flags.yes` at [cli.js:372-383](bin/cli.js#L372-L383) only supports `mode: 'local'` (via env var) or `mode: 'same'` (default). There is no env var for git URLs, no automated clone step, and no `mode: 'remote'` handling. A CI pipeline cannot set up a remote multi-repo layout. It silently degrades to local-path-or-default with no warning that remote mode is unavailable in automation.

## Acceptance Criteria

1. **Given** `--yes` flag and `MA_KNOWLEDGEBASE_GIT_URL` env var set, **When** `collectRepoLayout()` runs, **Then** it clones the repo to the path specified by `MA_KNOWLEDGEBASE_PATH` (required when git URL is set) and returns `mode: 'remote'` with the gitUrl stored
2. **Given** `--yes` flag and `MA_SPRINT_GIT_URL` env var set, **When** `collectRepoLayout()` runs, **Then** it clones the sprint repo to `MA_SPRINT_PATH` and returns `mode: 'remote'`
3. **Given** git URL env var set but corresponding path env var missing, **When** `collectRepoLayout()` runs, **Then** it exits with a clear error: "MA_KNOWLEDGEBASE_GIT_URL requires MA_KNOWLEDGEBASE_PATH to be set (clone destination)"
4. **Given** the clone destination already exists and contains a `.git` directory, **When** the clone is attempted, **Then** it skips cloning and uses the existing directory (idempotent for re-runs)
5. **Given** the clone destination already exists but is NOT a git repo, **When** the clone is attempted, **Then** it exits with error: "Destination exists but is not a git repo — remove it or use a different path"
6. **Given** a clone failure in CI mode, **When** the clone fails, **Then** it exits with non-zero status and a clear error message (no fallback to same mode — CI should fail loudly)
7. **Given** only `MA_KNOWLEDGEBASE_PATH` set (no git URL), **When** `collectRepoLayout()` runs, **Then** behavior is unchanged: `mode: 'local'` with the resolved path (backward compatible)
8. **Given** both git URL and path env vars for both concerns point to the same repo, **Then** only one clone is performed

## Tasks / Subtasks

- [x] Task 1: Add new env var support to `collectRepoLayout()`
  - [x] 1.1 Check `MA_KNOWLEDGEBASE_GIT_URL` and `MA_SPRINT_GIT_URL` env vars
  - [x] 1.2 Validate that when git URL is set, corresponding PATH var is also set — exit with clear error if not
  - [x] 1.3 When both are set: mode is `'remote'`, path is resolved PATH, gitUrl is the URL

- [x] Task 2: Implement CI-mode clone logic
  - [x] 2.1 If destination exists with `.git/`: skip clone, log info "Using existing clone at {path}"
  - [x] 2.2 If destination exists without `.git/`: exit with error (ambiguous state)
  - [x] 2.3 If destination doesn't exist: clone using same `execFileSync` pattern as interactive mode
  - [x] 2.4 On clone failure: exit with non-zero code (no fallback — CI must fail explicitly)
  - [x] 2.5 If both concerns have same git URL + path: clone once, reference for both

- [x] Task 3: Write unit tests
  - [x] 3.1 Test `--yes` + git URL + path env vars returns remote mode with correct fields
  - [x] 3.2 Test `--yes` + git URL without path env var exits with error
  - [x] 3.3 Test existing git repo at destination skips clone
  - [x] 3.4 Test existing non-git directory at destination errors
  - [x] 3.5 Test backward compatibility: PATH without URL still returns local mode

## Dev Notes

### Env Var Summary (After This Story)

| Env Var | Purpose | Required With |
|---------|---------|---------------|
| `MA_KNOWLEDGEBASE_PATH` | Local path for knowledgebase | Standalone or with GIT_URL |
| `MA_SPRINT_PATH` | Local path for sprint management | Standalone or with GIT_URL |
| `MA_KNOWLEDGEBASE_GIT_URL` | Git URL for knowledgebase repo | Requires MA_KNOWLEDGEBASE_PATH |
| `MA_SPRINT_GIT_URL` | Git URL for sprint management repo | Requires MA_SPRINT_PATH |

### CI Behavior: Fail Loudly

Interactive mode falls back to `same` on clone failure. CI mode must NOT do this — a failed clone in CI means the pipeline is broken and should exit non-zero. Use `process.exit(1)` with a clear error, not a silent fallback.

### Idempotency

CI pipelines re-run frequently. If the clone destination already exists and is a valid git repo, skip the clone. This makes the step idempotent without needing `rm -rf` in pipeline scripts.

### References

- [Source: bin/cli.js — collectRepoLayout() --yes mode at line 372]
- [Source: Adversarial Review Finding #8 — CI/CD can't do remote mode]

## Dev Agent Record

### Implementation Plan
- Added `ciCloneIfNeeded(destPath, gitUrl, clonedRepos)` — handles clone-or-skip logic with dedup tracking
- Extended `collectRepoLayout()` --yes mode to check `MA_KNOWLEDGEBASE_GIT_URL` / `MA_SPRINT_GIT_URL` env vars
- Validation: git URL without corresponding PATH exits with clear error
- Clone idempotency: existing `.git/` = skip; existing non-git = error; missing = clone
- Deduplication: same URL+path tracked via Map to avoid double clones

### Completion Notes
- All 3 tasks implemented with 9 dedicated tests
- Full regression suite passes
- CI behavior: fail loudly with `process.exit(1)` on errors — no silent fallback
- Backward compatible: PATH without URL still returns local mode

## File List

- `bin/cli.js` — Added `ciCloneIfNeeded()`, extended `collectRepoLayout()` --yes mode with git URL env vars, updated exports
- `test/cicd-remote-mode.test.js` — New: 9 tests covering remote mode, validation errors, clone logic, backward compat
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 16-8 status
- `_bmad-output/implementation-artifacts/16-8-cicd-remote-mode.md` — Story file updated

## Change Log

- 2026-03-28: Implemented CI/CD remote mode — `MA_KNOWLEDGEBASE_GIT_URL` / `MA_SPRINT_GIT_URL` env vars enable remote repo cloning in --yes mode. 9 tests added.
