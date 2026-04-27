---
type: bug
severity: low
status: ready-for-dev
title: Stale .github/copilot/skills/ directory not cleaned on upgrade after F2b routing fix
---

# Bug: Stale `.github/copilot/skills/` directory not cleaned on upgrade after F2b routing fix

**Severity:** low
**Affected Component:** installer pipeline — upgrade-time cleanup of obsolete tool skill directories

## Reproduction Steps

1. Set up a scratch project that was previously installed with the buggy pre-F2b copilot routing (i.e., before PR #70 merged):
   ```bash
   # Simulate the pre-F2b state by manually creating the obsolete directory
   mkdir -p /tmp/stale-copilot-repro/.github/copilot/skills
   echo "stale" > /tmp/stale-copilot-repro/.github/copilot/skills/old-skill-marker.txt
   cd /tmp/stale-copilot-repro && git init -q
   ```
2. Run an upgrade install (post-F2b code):
   ```bash
   (cd /tmp/stale-copilot-repro && node <repo>/bin/cli.js install --yes --force)
   ```
3. Inspect both the new and old copilot skills paths:
   ```bash
   ls /tmp/stale-copilot-repro/.github/skills/  # NEW correct path — populated
   ls /tmp/stale-copilot-repro/.github/copilot/skills/  # OLD stale path — STILL EXISTS
   ```

## Expected Behavior

After the F2b routing fix (PR #70) realigned copilot's `skillsDir` from `.github/copilot/skills` to `.github/skills`, the installer should detect the legacy directory on upgrade and clean it up — either by removing it outright or by moving any user-edited content into the new location with a clear log message.

This mirrors how `migrateRetiredSkills` (`lib/installer.js`, from Story 22.3) handles obsolete skill IDs in `.ma-agents.json` and on disk.

## Actual Behavior

`.github/copilot/skills/` from a pre-F2b install remains on disk indefinitely. It is not deleted, not referenced by any current code path (skills are now installed into `.github/skills/`), and not flagged in any user-facing output. It just sits there as cruft.

If the user is running source control with `.github/copilot/skills/` tracked (because the previous gitignore policy was per-skill-dir per the now-fixed Story 22.8 bug), they will see stale content forever unless they manually remove it.

## Root Cause Hypothesis

F2b's PR #70 corrected the `skillsDir` value in `lib/agents.js` and verified the new path receives skills correctly, but did not add a migration step to clean up the old path. This was deliberately scoped out of F2b ("a migration cleanup is a separate ticket" per the F2b agent's report).

## Affected Files

- `lib/installer.js` — natural home for an `obsoleteSkillDirs` registry similar to `RETIRED_SKILL_IDS` / `RENAMED_SKILL_IDS` from Stories 22.2 / 22.3
- `lib/bmad.js` — possibly: hook the cleanup into the existing migration sweep that already runs on upgrade

## Suggested Fix

1. Define an `OBSOLETE_TOOL_SKILL_DIRS` constant listing paths that earlier ma-agents versions wrote to but no longer use:
   ```js
   const OBSOLETE_TOOL_SKILL_DIRS = [
     // Pre-F2b copilot wrote to .github/copilot/skills; F2b moved it to .github/skills
     { obsolete: '.github/copilot/skills', replacedBy: '.github/skills', sinceVersion: '<F2b version>' },
   ];
   ```
2. On install/upgrade, iterate the registry and for each entry:
   - If the obsolete dir exists AND the replacement dir also exists with content → remove the obsolete dir, log "Removed legacy copilot skills directory at <path> (moved to <new-path> in version X)"
   - If the obsolete dir exists BUT the replacement dir is empty → user may have local edits; preserve the obsolete dir, log a warning with manual-cleanup instructions
   - If the obsolete dir is absent → no-op (idempotent)
3. Add a regression test:
   - Pre-populate the obsolete path
   - Run install
   - Assert the obsolete path is removed AND the new path is populated
4. The cleanup pass can run as part of `migrateRetiredSkills` or as a sibling helper.

**Scope estimate:** small — registry + cleanup loop + test. ~80 LOC.

## Why low severity

- Not destructive — old content sits inert, no functional regression
- Affects only users upgrading from pre-F2b versions
- Manual cleanup (one `rm -rf .github/copilot/skills`) is trivial
- Will affect fewer users over time as installs roll forward

## Notes

- Created via `create-bug-story` workflow
- Surfaced as out-of-scope finding in F2b PR #70
- Bundle for fix consideration with Story 22.2's `RENAMED_SKILL_IDS` pattern — same shape of problem
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`

## Dev Notes

### Project Structure Notes

Key files for this fix:

- `lib/installer.js` — primary implementation site. Pattern to follow:
  - `RETIRED_SKILL_IDS` (line ~1542) and `RENAMED_SKILL_IDS` (line ~1551) are frozen arrays of obsolete skill IDs
  - `OBSOLETE_SKILL_IDS` (line ~1561) is their union — the sweep target
  - `migrateRetiredSkills(options)` (line ~1563) iterates all agent install paths and removes obsolete entries from `.ma-agents.json` + disk
  - New constant `OBSOLETE_TOOL_SKILL_DIRS` should follow the same pattern: a frozen array of `{ obsolete: string, replacedBy: string, sinceVersion: string }` objects
  - Cleanup logic should mirror the `OBSOLETE_SKILL_IDS` sweep but operate on **directories**, not skill IDs inside `.ma-agents.json`
  - The cleanup function should be called from `installSkill()` (line ~1247) and exported for test use

- `lib/agents.js` — registry showing current `skillsDir` values. Copilot's corrected path is `.github/skills` (line ~91). The stale path is `.github/copilot/skills`.

- `lib/bmad.js` — `runMigration()` and `installBmad()`/`updateBmad()` are alternative call sites if the cleanup should also run on BMAD install/update flows.

Naming conventions:
- Follow `OBSOLETE_SKILL_IDS` → name the new export `OBSOLETE_TOOL_SKILL_DIRS`
- Export the cleanup function as `migrateObsoleteToolDirs` or similar, alongside `migrateRetiredSkills` in `module.exports`
- Story 24.11 AC5 will extend this registry — define it in a way that new entries can be added trivially

### Testing Requirements

Existing tests to check before submitting:
- `test/retired-skills-migration.test.js` — covers `migrateRetiredSkills`; the new tool-dir migration should follow the same fixture pattern
- `test/rename-migration.test.js` — covers the RENAMED_SKILL_IDS sweep
- `test/gitignore-plugin-stage.test.js` — example of testing .gitignore-adjacent file system changes

New test required by this fix (add to `test/retired-skills-migration.test.js` or new `test/obsolete-tool-dirs.test.js`):
1. Pre-populate `.github/copilot/skills/` with a marker file in a temp project
2. Populate `.github/skills/` with content (simulates a post-F2b install)
3. Call the cleanup function
4. Assert `.github/copilot/skills/` is removed
5. Assert `.github/skills/` is intact
6. Run the cleanup again — assert idempotent (no error, no change)
7. Case: obsolete dir exists but replacement dir is empty — assert obsolete dir is preserved and a warning is logged

How to run tests: `npm test` in `d:\Code\agents`

### What this story does NOT do

- Does NOT change any `skillsDir` registry entries in `lib/agents.js` — only cleans up the old path
- Does NOT handle skill ID migrations (that is `migrateRetiredSkills` territory)
- Does NOT assess `.agents/skills/` routing (Story 24.11)
- Does NOT fix the `--agent` flag scope bug (Bug B1)

## Dev Agent Record

### Agent Model Used
(to be filled by implementing agent)

### Debug Log References
(none)

### Completion Notes List
(none — story not yet implemented)

### File List
(to be filled by implementing agent)
