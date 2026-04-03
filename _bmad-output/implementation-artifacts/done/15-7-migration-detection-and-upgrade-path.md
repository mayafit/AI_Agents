# Story 15.7: Migration Detection and Upgrade Path

Status: done

## Story

As a **DevOps engineer**,
I want the installer to automatically detect and upgrade from 6.0.4 to 6.2.1 during normal installation,
So that I don't need a separate upgrade command and my existing customizations are preserved.

## Acceptance Criteria

1. Installer detects old version from `_bmad/core/config.yaml` and logs `"Upgrading BMAD from 6.0.4 to 6.2.1..."` -- DONE
2. Installer passes `--action update` to bmad-method when existing `_bmad/` detected -- DONE
3. Existing `_bmad/_config/agents/*.customize.yaml` files are backed up before updating -- DONE
4. After module deploys, backed-up files are checked for user-added `memories`, extra `critical_actions`, or persona overrides — user customizations carried forward -- DONE
5. Legacy artifacts are cleaned up after successful migration (old custom agent `.customize.yaml`, XML agent definitions, YAML workflow files) -- DONE
6. A migration log is printed listing what was cleaned up -- DONE
7. If bmad-method update fails, backed-up `.customize.yaml` files are restored and project remains functional on old version (NFR29) -- DONE
8. Fresh installs (no existing `_bmad/`) deploy directly in 6.2.1 format with no migration logic -- DONE

## Tasks / Subtasks

- [x] Task 1: Implement detectMigrationNeed() function (AC: #1, #8)
  - [x] 1.1 Add `detectMigrationNeed(projectRoot)` function to `lib/bmad.js`
  - [x] 1.2 Read `_bmad/core/config.yaml` — extract version field via regex
  - [x] 1.3 Return `{ action: 'install', migrate: false }` if no `_bmad/` exists (fresh install)
  - [x] 1.4 Return `{ action: 'update', migrate: true, fromVersion: version }` if version < 6.2.0
  - [x] 1.5 Return `{ action: 'update', migrate: false }` if version >= 6.2.0
  - [x] 1.6 Log migration detection result — handles empty config.yaml and missing version

- [x] Task 2: Implement backup before migration (AC: #3)
  - [x] 2.1 Create backup directory: `_bmad/_config/agents/.backup-pre-migration/`
  - [x] 2.2 Copy all `_bmad/_config/agents/*.customize.yaml` to backup directory
  - [x] 2.3 Log which files were backed up

- [x] Task 3: Implement user customization preservation (AC: #4)
  - [x] 3.1 After new module deploys, compare backed-up `.customize.yaml` files with new ones
  - [x] 3.2 Detect user-added content: extra `memories`, additional `critical_actions` beyond standard set, persona overrides
  - [x] 3.3 Merge user additions into new `.customize.yaml` files
  - [x] 3.4 Handle case where backup file has no corresponding new file (use backup as base)
  - [x] 3.5 Log what was preserved and what was skipped

- [x] Task 4: Implement legacy artifact cleanup (AC: #5, #6)
  - [x] 4.1 After successful migration, remove legacy artifacts:
    - XML agent definitions in `_bmad/custom/agents/` (if present)
    - YAML workflow files at root of `_bmad/bmm/workflows/` (legacy engine artifacts)
    - Migration backup directory
  - [x] 4.2 Print migration log listing what was cleaned up
  - [x] 4.3 Conservative approach — only clean files matching known legacy patterns, preserve subdirectories

- [x] Task 5: Implement rollback on failure (AC: #7)
  - [x] 5.1 Wrap bmad-method update call in try/catch within `runMigration()`
  - [x] 5.2 On failure: restore backed-up `.customize.yaml` files from `.backup-pre-migration/`
  - [x] 5.3 Log error with recovery suggestion
  - [x] 5.4 Return false to indicate migration failure

- [x] Task 6: Integrate into installation flow (AC: #1, #2, #8)
  - [x] 6.1 Call `detectMigrationNeed()` at start of `installBmad()` flow
  - [x] 6.2 If migration needed: run backup → update → merge → cleanup via `runMigration()`
  - [x] 6.3 If fresh install: standard install flow (no migration)
  - [x] 6.4 Detection result feeds action into `buildBmadArgs()` context

## Dev Notes

### Architecture: detectMigrationNeed() Pattern

Used simple regex-based version extraction from `_bmad/core/config.yaml` — no additional dependencies needed. The `compareVersions()` helper uses numeric semver comparison (split on `.`, compare each part). Handles quoted versions, comments after version, and missing/empty config files.

### Key Design Decisions

1. **No new dependencies**: Used regex for YAML version extraction and custom `compareVersions()` for semver comparison — avoided adding `js-yaml` or `semver` packages
2. **Conservative cleanup**: Only removes `.xml` files in `custom/agents/`, `.yaml` files at root of `bmm/workflows/`, and the backup dir — never touches subdirectories or unknown files
3. **Standard critical_actions detection**: Uses substring matching against 4 known standard patterns to distinguish user-added entries from ma-agents-injected ones
4. **Persona override detection**: Compares against shipped customize files in `lib/bmad-customizations/` to detect user changes
5. **Graceful empty config handling**: If `_bmad/` exists but config.yaml is empty (`{}`) or missing the version field, treats as needing migration (pre-6.2.0)

### Migration Sequence (implemented in runMigration)

1. `backupCustomizations()` — backs up all `*.customize.yaml` to `.backup-pre-migration/`
2. `buildBmadArgs()` with `action: 'update'` — runs bmad-method update
3. `mergeUserCustomizations()` — detects and merges user memories, extra critical_actions, persona overrides
4. `cleanupLegacyArtifacts()` — removes known legacy files, backup dir
5. `deployMethodology()` — standard methodology deployment

### Files Changed

| File | Change |
|------|--------|
| `lib/bmad.js` | Added 5 migration functions + `runMigration()` + `compareVersions()` + `parseCustomizeYaml()` + `isStandardCriticalAction()`. Integrated `detectMigrationNeed()` into `installBmad()`. Exported new functions for testing. |
| `test/migration.test.js` | 33 comprehensive tests covering all 6 tasks |
| `package.json` | Added `migration.test.js` to test script |

### Testing: 33 tests across all tasks

- Task 1: 10 tests (fresh install, various old versions, current versions, empty config, missing config, quoted versions)
- Task 2: 4 tests (backup, no dir, no files)
- Task 3: 5 tests (merge memories, merge CAs, skip standard-only, no backup, backup without new file)
- Task 4: 5 tests (XML cleanup, workflow cleanup, backup cleanup, no artifacts)
- Task 5: 3 tests (restore, no backup)
- Task 6: 2 tests (export verification)
- Edge cases: 4 tests (quoted versions, comments, missing new files)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, migration detection and upgrade path]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.7]
- [Source: lib/bmad.js — buildBmadArgs(), installBmad(), applyCustomizations()]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

N/A

### Completion Notes List

- All 33 tests pass
- No new dependencies added
- Existing 31 build-bmad-args tests still pass (no regressions)
- Exported 5 new functions for testing: detectMigrationNeed, backupCustomizations, restoreCustomizations, mergeUserCustomizations, cleanupLegacyArtifacts

### File List

- `lib/bmad.js` (modified)
- `test/migration.test.js` (new)
- `package.json` (modified — test script updated)
- `_bmad-output/implementation-artifacts/15-7-migration-detection-and-upgrade-path.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)
