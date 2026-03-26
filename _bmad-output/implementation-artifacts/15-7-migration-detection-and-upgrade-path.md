# Story 15.7: Migration Detection and Upgrade Path

Status: ready-for-dev

## Story

As a **DevOps engineer**,
I want the installer to automatically detect and upgrade from 6.0.4 to 6.2.1 during normal installation,
So that I don't need a separate upgrade command and my existing customizations are preserved.

## Acceptance Criteria

1. Installer detects old version from `_bmad/core/config.yaml` and logs `"Upgrading BMAD from 6.0.4 to 6.2.1..."`
2. Installer passes `--action update` to bmad-method when existing `_bmad/` detected
3. Existing `_bmad/_config/agents/*.customize.yaml` files are backed up before updating
4. After module deploys, backed-up files are checked for user-added `memories`, extra `critical_actions`, or persona overrides — user customizations carried forward
5. Legacy artifacts are cleaned up after successful migration (old custom agent `.customize.yaml`, XML agent definitions, YAML workflow files)
6. A migration log is printed listing what was cleaned up
7. If bmad-method update fails, backed-up `.customize.yaml` files are restored and project remains functional on old version (NFR29)
8. Fresh installs (no existing `_bmad/`) deploy directly in 6.2.1 format with no migration logic

## Tasks / Subtasks

- [ ] Task 1: Implement detectMigrationNeed() function (AC: #1, #8)
  - [ ] 1.1 Add `detectMigrationNeed(projectRoot)` function to `lib/bmad.js`
  - [ ] 1.2 Read `_bmad/core/config.yaml` — extract version field
  - [ ] 1.3 Return `{ action: 'install', migrate: false }` if no `_bmad/` exists (fresh install)
  - [ ] 1.4 Return `{ action: 'update', migrate: true, fromVersion: version }` if version < 6.2.0
  - [ ] 1.5 Return `{ action: 'update', migrate: false }` if version >= 6.2.0
  - [ ] 1.6 Log migration detection result

- [ ] Task 2: Implement backup before migration (AC: #3)
  - [ ] 2.1 Create backup directory: `_bmad/_config/agents/.backup-pre-migration/`
  - [ ] 2.2 Copy all `_bmad/_config/agents/*.customize.yaml` to backup directory
  - [ ] 2.3 Log which files were backed up

- [ ] Task 3: Implement user customization preservation (AC: #4)
  - [ ] 3.1 After new module deploys, compare backed-up `.customize.yaml` files with new ones
  - [ ] 3.2 Detect user-added content: extra `memories`, additional `critical_actions` beyond standard set, persona overrides
  - [ ] 3.3 For built-in agent customizations: merge user additions into new `.customize.yaml` files
  - [ ] 3.4 For custom agent customizations (SRE, DevOps, Cyber, MIL-498): if user had added custom `memories` or extra `critical_actions`, carry those into the new agent SKILL.md
  - [ ] 3.5 Log what was preserved and what was dropped (if anything)

- [ ] Task 4: Implement legacy artifact cleanup (AC: #5, #6)
  - [ ] 4.1 After successful migration, remove legacy artifacts:
    - Old `.customize.yaml` files for custom agents (now replaced by module agent skills)
    - XML agent definitions in `_bmad/custom/agents/` (if present)
    - YAML workflow files (legacy engine artifacts)
  - [ ] 4.2 Print migration log listing what was cleaned up
  - [ ] 4.3 Be conservative — only clean up files that are KNOWN to be replaced, not unknown user files

- [ ] Task 5: Implement rollback on failure (AC: #7)
  - [ ] 5.1 Wrap bmad-method update call in try/catch
  - [ ] 5.2 On failure: restore backed-up `.customize.yaml` files from `.backup-pre-migration/`
  - [ ] 5.3 Log error with recovery suggestion
  - [ ] 5.4 Ensure project remains functional on old version

- [ ] Task 6: Integrate into installation flow (AC: #1, #2, #8)
  - [ ] 6.1 Call `detectMigrationNeed()` early in `installBmad()` flow
  - [ ] 6.2 If migration needed: run backup → update → deploy new module → deploy built-in customizes → merge user customizations → cleanup
  - [ ] 6.3 If fresh install: standard install flow (no migration)
  - [ ] 6.4 Pass detection result to `buildBmadArgs()` to set correct `--action` flag

## Dev Notes

### Architecture: detectMigrationNeed() Pattern

From architecture P2-9:

```javascript
function detectMigrationNeed(projectRoot) {
  const configPath = path.join(projectRoot, '_bmad', 'core', 'config.yaml');
  if (!fs.existsSync(configPath)) return { action: 'install', migrate: false };

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const version = config?.version || '0.0.0';

  if (semver.lt(version, '6.2.0')) {
    return { action: 'update', migrate: true, fromVersion: version };
  }
  return { action: 'update', migrate: false };
}
```

**Note:** This uses `semver` — check if it's already a dependency or needs to be added. Alternative: simple string comparison since we only need to detect < 6.2.0.

### Migration Sequence (from P2-9)

1. Detect old version from `_bmad/core/config.yaml`
2. Back up existing `_bmad/_config/agents/*.customize.yaml`
3. Invoke bmad-method with `--action update` + `--custom-content` — bmad-method handles core upgrade
4. Deploy new `.customize.yaml` files for built-in agents (from `lib/bmad-customize/`)
5. Merge user customizations back
6. Clean up legacy artifacts

### Customization Merge Logic

Standard critical_actions (what ma-agents injects):
```yaml
critical_actions:
  - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  - "For each skill marked always_load: true, read the skill file completely"
  - "If _bmad-output/project-context.md exists, read it completely"
  - "Follow all skill directives and project-context rules during this session"
```

User might have added:
- Extra `critical_actions` entries beyond the standard 4
- `memories` field (user-specific agent memories)
- Persona overrides (changed agent name, communication style, etc.)

**Merge rule:** Keep ALL user additions. Only replace the standard critical_actions block with the new version.

### Existing buildBmadArgs() Integration

Current `buildBmadArgs(ctx)` in `lib/bmad.js` (lines 41-74) already handles `--action update` vs `--action install`. The migration detection output should feed into the existing context object.

### YAML Parsing Dependency

Need to parse `_bmad/core/config.yaml` to read version. Check if the project already has a YAML parser dependency (e.g., `js-yaml`). The `scripts/build-bmad-cache.js` uses a custom parser — DO NOT use that for config parsing. Use a proper YAML library.

### Files to Touch

| File | Change |
|------|--------|
| `lib/bmad.js` | Add `detectMigrationNeed()`, backup/restore functions, cleanup function, integrate into install flow |
| `package.json` | May need `semver` or `js-yaml` dependency (verify if already present) |

### Testing Approach

1. Test fresh install: no `_bmad/` → install action, no migration
2. Test 6.0.4 upgrade: `_bmad/core/config.yaml` with old version → update + migrate
3. Test re-run: `_bmad/core/config.yaml` with 6.2.1 → update, no migration
4. Test rollback: simulate bmad-method failure → verify backup restored
5. Test customization merge: add custom memories to a `.customize.yaml`, migrate, verify preserved

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, migration detection and upgrade path]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.7]
- [Source: lib/bmad.js — buildBmadArgs(), installBmad(), applyCustomizations()]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
