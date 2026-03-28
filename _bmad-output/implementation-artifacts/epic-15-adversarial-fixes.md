# Epic 15: Adversarial Review — Fix Specification

**Source:** Epic 15 adversarial review (2026-03-28)
**Scope:** 9 actionable fixes across test infrastructure, migration safety, code hygiene
**Priority:** Fixes are ordered by importance — complete them in sequence

---

## Fix 1: Add missing test file to npm test script

**Finding:** `test/story-15-5-workflow-skills.test.js` (157 tests covering all 25 SRE/DevOps/Cyber/extension workflow conversions) is not listed in the `npm test` script in `package.json`. These tests never run in CI.

**What to do:**
1. Open `package.json`
2. Find the `"test"` script in the `"scripts"` section
3. Add `node test/story-15-5-workflow-skills.test.js` to the test chain, positioned after the other Epic 15 test files (after `convert-agents-to-skills.test.js` or `migration.test.js`)
4. Run `npm test` to confirm all tests pass including the newly added file

**Acceptance criteria:**
- `npm test` executes `story-15-5-workflow-skills.test.js` and all 157 tests pass
- No other test files are removed or reordered

---

## Fix 2: Fix 3 stale test assertions

**Finding:** Epic 15 changed the module structure but left pre-existing test assertions pointing at the old structure. These are documented as discrepancies D2, D3, D4 in `_bmad-output/implementation-artifacts/15-8-validation-report.md`.

### Fix 2a: `test/bmad-extension.test.js` — stale module.yaml name assertion (D2)

1. Open `test/bmad-extension.test.js`
2. Find the assertion that checks the `name` field of `lib/bmad-extension/module.yaml`
3. The old expected value will reference the pre-6.2.1 module name
4. Update it to match the current value in `lib/bmad-extension/module.yaml`, which is: `"MA-Agents Skills & Agents"`
5. Run this test file to confirm it passes

### Fix 2b: `test/extension-module-restructure.test.js` — stale agents/ directory assertions (D3)

1. Open `test/extension-module-restructure.test.js`
2. Find assertions that expect `lib/bmad-extension/agents/` directory to exist or contain files
3. This directory was deleted in Story 15.6. Remove or update these assertions:
   - If the assertion checks that `agents/` exists → remove it
   - If it counts files in `agents/` → remove it
   - If it checks that specific `.customize.yaml` files exist in `agents/` → remove those specific checks
4. Do NOT remove assertions about `skills/` or other directories that still exist
5. Run this test file to confirm it passes

### Fix 2c: `test/yes-flag.test.js` — environment-dependent flakiness (D4)

1. Open `test/yes-flag.test.js`
2. Identify the flaky test (it will be environment-dependent — likely depends on npm/node version, temp directory availability, or network access)
3. If the test relies on external state (network, specific paths), make it self-contained by:
   - Mocking the external dependency, OR
   - Adding a guard that skips the test with a clear message when the prerequisite is unavailable
4. Run the test file 3 times to confirm it passes consistently

**Acceptance criteria:**
- All three test files pass cleanly
- No unrelated assertions were modified
- `npm test` passes end-to-end

---

## Fix 3: Retain migration backup directory until next successful install

**Finding:** `cleanupLegacyArtifacts()` in `lib/bmad.js` deletes `.backup-pre-migration/` immediately after `mergeUserCustomizations()` runs. If the merge produced corrupt output (e.g., invalid YAML from user content with special characters), the backup is permanently destroyed. The rollback safety net (NFR29) only covers the update step, not a botched merge.

**What to do:**
1. Open `lib/bmad.js`
2. Find `cleanupLegacyArtifacts()` — it has three cleanup targets: old XML agents, legacy workflow YAML, and the backup directory
3. **Remove the backup directory cleanup from `cleanupLegacyArtifacts()`** — specifically, remove or comment out the section that deletes `.backup-pre-migration/`
4. Instead, move backup directory cleanup to the **beginning** of `backupCustomizations()` — so the old backup is only deleted when a NEW backup is about to be created (i.e., on the next migration/install run)
5. Add a console log message when deleting a previous backup: `chalk.dim('Removing previous migration backup...')`

**Implementation detail:**
```
In backupCustomizations():
  1. Check if .backup-pre-migration/ already exists
  2. If yes: log message, delete it
  3. Proceed with creating new backup as before

In cleanupLegacyArtifacts():
  1. Keep old XML cleanup
  2. Keep legacy YAML cleanup
  3. REMOVE backup directory cleanup
```

6. Update `test/migration.test.js`:
   - Add a test: after `cleanupLegacyArtifacts()` runs, `.backup-pre-migration/` directory still exists
   - Add a test: `backupCustomizations()` removes a pre-existing `.backup-pre-migration/` before creating a new one
   - Update any existing test that asserts `.backup-pre-migration/` is deleted by cleanup

**Acceptance criteria:**
- After a migration, `.backup-pre-migration/` is preserved on disk
- On the NEXT migration run, the old backup is replaced with a fresh one
- All migration tests pass

---

## Fix 4: Add output validation to mergeUserCustomizations()

**Finding:** After merging user memories, custom critical_actions, and persona overrides into post-migration customize files, the function never validates that the resulting file is still parseable. A user persona containing YAML special characters (`:`, `#`, `{`, `>`, `|`) could produce corrupt output.

**What to do:**
1. Open `lib/bmad.js`, find `mergeUserCustomizations()`
2. After writing each merged customize file, add a validation step:
   - Re-read the file that was just written
   - Run it through `parseCustomizeYaml()` (the same parser used to read it)
   - If parsing fails or returns unexpected structure, log a warning and restore the pre-merge version from backup
3. The validation logic should be:
   ```
   const merged = fs.readFileSync(targetPath, 'utf8');
   const parsed = parseCustomizeYaml(merged);
   if (!parsed || !parsed.criticalActions || parsed.criticalActions.length === 0) {
     console.warn(chalk.yellow(`  ⚠ Merge produced invalid output for ${file}, restoring backup`));
     fs.copyFileSync(backupPath, targetPath);
     skipped.push(file);
     continue;
   }
   ```
4. Update `test/migration.test.js`:
   - Add a test: merge with user content containing YAML special characters (`memories:\n  - "key: value with colons"`) produces valid output
   - Add a test: if merge produces unparseable output, the backup copy is restored and the file is added to `skipped`

**Acceptance criteria:**
- `mergeUserCustomizations()` validates each merged file before moving on
- Corrupt merges are caught and the backup is restored for that specific file
- Migration continues for other files (doesn't abort entirely)
- New tests cover the happy path and the corrupt-merge path

---

## Fix 5: Flag dead menu items in agent SKILL.md files

**Finding:** Four agent menu items reference skills that were never implemented: `sre-health-check`, `sre-performance-opt`, `devops-optimize-pipelines`, `cyber-threat-modeling`. These are dead links that will confuse users.

**What to do:**
1. Edit `lib/bmad-extension/skills/bmad-ma-agent-sre/SKILL.md`:
   - Find the menu table rows for "Health Check" (referencing `sre-health-check`) and "Performance Optimization" (referencing `sre-performance-opt`)
   - Append ` *(not yet implemented)*` to the description column of each

2. Edit `lib/bmad-extension/skills/bmad-ma-agent-devops/SKILL.md`:
   - Find the menu table row for "Optimize Pipelines" (referencing `devops-optimize-pipelines`)
   - Append ` *(not yet implemented)*` to the description column

3. Edit `lib/bmad-extension/skills/bmad-ma-agent-cyber/SKILL.md`:
   - Find the menu table row for "Threat Modeling" (referencing `cyber-threat-modeling`)
   - Append ` *(not yet implemented)*` to the description column

4. Update `test/migration-validation.test.js` if it has assertions that check these exact description strings — adjust expected values to include the new suffix

**Acceptance criteria:**
- All 4 dead menu items are visibly marked as not yet implemented
- Agents still render menus correctly (no broken markdown)
- Tests pass

---

## Fix 6: Remove redundant agent source files from lib/bmad-customizations/

**Finding:** `lib/bmad-customizations/` still contains the original source files for all 4 migrated agents (`bmm-sre.customize.yaml`, `bmm-cyber.customize.yaml`, `bmm-devops.customize.yaml`, `bmm-mil498.customize.yaml`, plus `sre.md`, `cyber.md`, `devops.md`, `mil498.md`). These are superseded by the skill folders in `lib/bmad-extension/skills/bmad-ma-agent-*/`. No code reads from these paths for the migrated agents.

**What to do:**
1. First, **verify** that no code references these files:
   - Search all `.js` files for `bmad-customizations/bmm-sre`, `bmad-customizations/bmm-cyber`, `bmad-customizations/bmm-devops`, `bmad-customizations/bmm-mil498`
   - Search all `.js` files for `bmad-customizations/sre.md`, `bmad-customizations/cyber.md`, `bmad-customizations/devops.md`, `bmad-customizations/mil498.md`
   - If ANY code still references these files, do NOT delete them — instead add a comment at the top of each: `# DEPRECATED: Canonical source is now lib/bmad-extension/skills/bmad-ma-agent-{name}/SKILL.md`

2. If no code references them, delete these 8 files:
   - `lib/bmad-customizations/bmm-sre.customize.yaml`
   - `lib/bmad-customizations/bmm-cyber.customize.yaml`
   - `lib/bmad-customizations/bmm-devops.customize.yaml`
   - `lib/bmad-customizations/bmm-mil498.customize.yaml`
   - `lib/bmad-customizations/sre.md`
   - `lib/bmad-customizations/cyber.md`
   - `lib/bmad-customizations/devops.md`
   - `lib/bmad-customizations/mil498.md`

3. Do NOT delete the other files in `lib/bmad-customizations/` (the platform-specific customize files like `claude-code.customize.yaml`, `cursor.customize.yaml`, etc.) — those serve a different purpose

4. Update any test that asserts the existence or count of files in `lib/bmad-customizations/`

**Acceptance criteria:**
- No code references the deleted files
- The 8 agent-specific files are removed (or deprecated if still referenced)
- Platform-specific customize files are untouched
- All tests pass

---

## Fix 7: Update story artifact statuses to match sprint status

**Finding:** Stories 15.1 through 15.5 have `status: review` in their implementation artifact `.md` files, while the sprint status YAML says the entire epic is `done`. This inconsistency creates confusion about which source of truth to trust.

**What to do:**
1. Update the `status:` field in each of these files to `done`:
   - `_bmad-output/implementation-artifacts/15-1-bump-bmad-method-to-6-2-1.md`
   - `_bmad-output/implementation-artifacts/15-2-restructure-extension-module.md`
   - `_bmad-output/implementation-artifacts/15-3-convert-custom-agents-to-skill-folders.md`
   - `_bmad-output/implementation-artifacts/15-4-convert-mil498-workflows-to-skill-md.md`
   - `_bmad-output/implementation-artifacts/15-5-convert-sre-devops-cyber-workflows.md`

2. Look for a `status:` key in the YAML frontmatter or a `**Status:**` line in the markdown body — update whichever format the file uses

**Acceptance criteria:**
- All 8 story artifacts show status `done`
- Sprint status YAML and individual story statuses agree

---

## Fix 8: Document compareVersions() limitations

**Finding:** `compareVersions()` in `lib/bmad.js` only handles simple `X.Y.Z` numeric semver. It will mishandle pre-release versions, 4+ segments, leading zeros, and non-numeric segments. Since it gates whether migrations run, failures here are silent and consequential.

**What to do:**
1. Open `lib/bmad.js`, find `compareVersions()`
2. Add a JSDoc comment above the function documenting its constraints:
   ```javascript
   /**
    * Compare two semver version strings (X.Y.Z format only).
    * Limitations: Does not support pre-release suffixes (e.g., 6.2.1-beta.1),
    * versions with more than 3 segments, or non-numeric segments.
    * Returns: -1 if a < b, 0 if equal, 1 if a > b.
    */
   ```
3. Add a guard at the top of the function that logs a warning if either version doesn't match `/^\d+\.\d+\.\d+$/`:
   ```javascript
   const semverPattern = /^\d+\.\d+\.\d+$/;
   if (!semverPattern.test(a) || !semverPattern.test(b)) {
     console.warn(chalk.yellow(`Warning: Non-standard version format detected (${a} vs ${b}), comparison may be unreliable`));
   }
   ```
4. Add a test in `test/migration.test.js`:
   - `compareVersions('6.2.1-beta.1', '6.2.1')` — verify it doesn't crash (behavior can be undefined, but it must not throw)
   - `compareVersions('6.2', '6.2.1')` — same, no crash

**Acceptance criteria:**
- Function has clear documentation of its limitations
- Non-standard version inputs produce a warning, not a crash
- Existing version comparisons continue to work identically

---

## Fix 9: Add basic merge integration test with adversarial YAML content

**Finding:** No test feeds realistic/adversarial user content through the merge pipeline. The regex-based YAML parsing in `parseCustomizeYaml()` and the merge logic in `mergeUserCustomizations()` are untested against content containing colons, hashes, multi-line strings, and other YAML special characters.

**What to do:**
1. Open `test/migration.test.js`
2. Add a new test section: `// Adversarial YAML content tests`
3. Create a mock project where the backed-up customize file contains:
   ```yaml
   critical_actions:
     - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
     - "Custom action: deploy to prod #important"
   memories:
     - "User prefers dark mode: always"
     - "Last deploy was 2026-03-15 at 14:30"
     - "Note: this has a colon in it"
   persona:
     role: "Senior SRE: Platform Team"
     identity: "Expert in k8s | helm | terraform"
   ```
4. Run `mergeUserCustomizations()` against it
5. Assert:
   - The custom critical action (`"Custom action: deploy to prod #important"`) appears in the merged output
   - All 3 memories appear in the merged output
   - The persona with colons and pipes is preserved
   - The merged file can be re-parsed by `parseCustomizeYaml()` without error
6. Add a second test with a truly broken input (e.g., unbalanced quotes, bare `{` characters) to verify the function doesn't crash and handles it gracefully

**Acceptance criteria:**
- Adversarial YAML content survives the merge round-trip
- Broken input is handled without crashing
- All existing migration tests still pass

---

## Execution Notes

- **Run `npm test` after each fix** to catch regressions early
- Fixes 1-2 are pure test maintenance — no production code changes
- Fixes 3-4 modify `lib/bmad.js` — be careful with the migration pipeline; don't break the happy path
- Fix 5 modifies SKILL.md content files — verify markdown rendering
- Fix 6 deletes files — the grep verification step is mandatory before deletion
- Fixes 7-8 are documentation/metadata — lowest risk
- Fix 9 is test-only — adds coverage without production code changes
