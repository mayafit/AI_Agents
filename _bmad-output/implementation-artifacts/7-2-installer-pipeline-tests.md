# Story 7.2: Add Tests for installer.js Core Operations

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dependency: Story 7-1 must be completed first (test framework setup) -->

## Story

As a **developer**,
I want tests covering the installer engine's core operations,
So that skill installation, manifest management, and MANIFEST.yaml generation are protected against regressions.

## Acceptance Criteria

1. **Given** tests exist for `installer.js`
   **When** the test suite runs
   **Then** it verifies:
   - Skill discovery scans the `skills/` directory and finds all valid skills
   - Template resolution follows priority chain (agent-specific → generic → SKILL.md)
   - Manifest read/write operations are atomic (no partial states)
   - MANIFEST.yaml generation produces valid YAML from installed skills
   - Additive-only installation does not remove existing agent configurations (NFR5)

2. **Given** a test skill directory is set up in a temp directory
   **When** install operations are tested
   **Then** files are written to the temp directory, not actual agent config directories

## Tasks / Subtasks

- [ ] Task 1: Create test fixtures (AC: #2)
  - [ ] 1.1: Create `tests/fixtures/` directory for test skill data
  - [ ] 1.2: Create a minimal test skill: `tests/fixtures/test-skill/skill.json` + `SKILL.md`
  - [ ] 1.3: Create a test skill with templates: `tests/fixtures/test-skill-with-templates/` including `templates/claude-code.md` and `templates/generic.md`
  - [ ] 1.4: Create a test skill with resources: `tests/fixtures/test-skill-with-resources/` including `references/` and `assets/` directories
- [ ] Task 2: Test skill discovery functions (AC: #1)
  - [ ] 2.1: Create `tests/installer.test.js`
  - [ ] 2.2: Test: `listSkills()` returns an array of skill objects (currently 28 skills)
  - [ ] 2.3: Test: each skill object has required fields from `skill.json` (name, version, description, category)
  - [ ] 2.4: Test: `listAgents()` returns the same as `getAllAgents()` from agents.js
  - [ ] 2.5: Test: `getInstalledSkillInfo()` returns null/undefined for non-installed skills
- [ ] Task 3: Test manifest operations (AC: #1)
  - [ ] 3.1: Test: `readManifest()` returns empty manifest for non-existent path
  - [ ] 3.2: Test: `writeManifest()` creates valid JSON file
  - [ ] 3.3: Test: `ensureManifest()` creates manifest entry for agent+scope
  - [ ] 3.4: Test: `getManifestAgents()` returns agent IDs from manifest
  - [ ] 3.5: Test: manifest write → read roundtrip preserves data
  - [ ] 3.6: All manifest tests use `os.tmpdir()` temp directory, cleaned up after
- [ ] Task 4: Test MANIFEST.yaml generation (AC: #1)
  - [ ] 4.1: Test: `generateSkillsManifest()` produces a file ending in `.yaml`
  - [ ] 4.2: Test: generated MANIFEST.yaml content includes skill names and metadata
  - [ ] 4.3: Use temp directory for generation output
- [ ] Task 5: Test semver comparison (AC: #1)
  - [ ] 5.1: Test: `compareSemver('1.0.0', '1.0.0')` returns 0
  - [ ] 5.2: Test: `compareSemver('1.0.0', '2.0.0')` returns -1
  - [ ] 5.3: Test: `compareSemver('2.0.0', '1.0.0')` returns 1
  - [ ] 5.4: Test: `compareSemver('1.0.1', '1.0.0')` returns 1

## Dev Notes

### Architecture Compliance

- **Test location:** `tests/installer.test.js` in the tests directory [Source: architecture.md#Structure-Patterns]
- **Temp directory isolation:** All file-writing tests must use `os.tmpdir()` or `fs.mkdtempSync()`. Never write to actual agent config directories or the project's `skills/` directory during tests. [Source: AC #2]
- **No mocking the database:** Tests should use real file system operations in temp directories, not mocked fs. [Source: architecture.md — integration test philosophy]

### installer.js Exported Functions

From [installer.js:10-591](lib/installer.js) — 16 functions, key ones for testing:

**Pure/stateless (easy to test):**
- `listSkills()` (line 178) — scans `skills/` directory, returns array of skill metadata
- `listAgents()` (line 204) — delegates to agents.js `getAllAgents()`
- `compareSemver(a, b)` (line 166) — pure comparison function
- `getPackageVersion()` (line 10) — reads package.json version

**Manifest operations (need temp dir):**
- `readManifest(installPath)` (line 17) — reads `.ma-agents.json`
- `writeManifest(installPath, manifest)` (line 29) — writes `.ma-agents.json`
- `ensureManifest(installPath, agentId, scope)` (line 34) — creates manifest structure
- `getManifestAgents(manifest)` (line 59) — extracts agent IDs from manifest
- `getInstalledSkillInfo(installPath, skillId)` (line 67) — reads installed skill version

**File-writing operations (need temp dir + careful isolation):**
- `generateSkillsManifest(installPath)` (line 75) — generates MANIFEST.yaml
- `performInstall(skillId, skill, agent, installPath)` (line 210) — copies skill files
- `installSkill(skillId, agentIds, ...)` (line 278) — full install orchestration

**Note:** `performInstall` and `installSkill` involve complex file operations and agent path resolution. Consider testing these in Story 7.2 only at the unit level (manifest + discovery), deferring full integration install tests if they require too much setup.

### Test Fixture Skill Schema

Minimal `skill.json` for test fixtures:
```json
{
  "name": "test-skill",
  "version": "1.0.0",
  "description": "Test skill for automated testing",
  "category": "testing",
  "tags": ["test"],
  "always_load": false
}
```

### Critical Guardrails

- **Never write to real agent directories** — all file operations in temp dirs only
- **Clean up temp dirs after each test** — use `t.after()` or `after()` hooks
- **No new npm dependencies** — use `node:test`, `node:assert`, `node:fs`, `node:os`, `node:path`
- **Do not modify `lib/installer.js`** — tests validate existing behavior

### Project Structure Notes

- Files to create: `tests/installer.test.js`, `tests/fixtures/test-skill/` (skill.json + SKILL.md), `tests/fixtures/test-skill-with-templates/`
- No changes to `lib/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7] — Story 7.2 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure-Patterns] — Test directory structure
- [Source: lib/installer.js] — Installer module (591 lines, 16 functions)
- [Source: _bmad-output/implementation-artifacts/7-1-test-infrastructure-setup.md] — Prerequisite story

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
