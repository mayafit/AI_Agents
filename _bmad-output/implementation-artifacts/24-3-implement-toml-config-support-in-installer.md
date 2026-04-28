# Story 24.3: Implement TOML Config Support in Installer (Conditional on 24.2)

Status: ready-for-dev

## Story

As a **ma-agents maintainer**,
I want the installer to read and write whichever config format v6.4.0 produces (`config.yaml` or `config.toml`),
So that the ma-agents install flow remains correct regardless of whether BMAD moved its module config to TOML in v6.4.0.

## Acceptance Criteria

1. **Given** Story 24.1/24.2 confirm `_bmad/bmm/config.yaml` still exists in v6.4.0 output, **When** this story is processed, **Then** no code changes are required — the story is documented as a no-op and marked done.

2. **Given** the module config migrated to TOML in v6.4.0, **When** I inspect `lib/bmad.js`, **Then** the `CANONICAL_CONFIG_REL` constant (or equivalent path reference) points to the correct TOML file path.

3. **Given** the module config migrated to TOML, **When** `bmad-init.py` reads or writes the module config, **Then** it uses stdlib `tomllib` (Python 3.11+) or `tomli`/`tomli_w` for earlier Python versions — not a third-party YAML-to-TOML shim.

4. **Given** any code changes, **When** I run `npm test`, **Then** the test suite exits with code 0.

5. **Given** any code changes, **When** I perform a scratch install, **Then** the install reads config values correctly from the TOML format and the ma-agents overlay values are applied as expected.

## Tasks / Subtasks

### Task 1: Confirm scope from Story 24.2 decision (AC: 1)

- [ ] 1.1 Read Story 24.1 Dev Notes — locate the "Module config format check" finding
- [ ] 1.2 If `config.yaml` still present → document "no-op confirmed", mark story done, skip Tasks 2-5
- [ ] 1.3 If config moved to TOML → proceed with Tasks 2-5

### Task 2 (conditional): Update CANONICAL_CONFIG_REL in lib/bmad.js (AC: 2)

- [ ] 2.1 Locate the `CANONICAL_CONFIG_REL` constant (or the hardcoded path string) in `lib/bmad.js`
- [ ] 2.2 Update the value to the TOML path determined in Story 24.1 (e.g., `_bmad/bmm/config.toml`)
- [ ] 2.3 Search for any other hardcoded references to `config.yaml` in the codebase and update them

### Task 3 (conditional): Add TOML read/write to bmad-init.py (AC: 3)

- [ ] 3.1 Identify the Python version constraint for the project (check `bmad-init.py` header or any version guard)
- [ ] 3.2 If Python >= 3.11: use `import tomllib` (stdlib); write using a minimal TOML serializer or `tomli_w`
- [ ] 3.3 If Python < 3.11: add `tomli` as a read dependency and `tomli_w` as a write dependency; document in `bmad-init.py` comments
- [ ] 3.4 Replace any `yaml.safe_load` / `yaml.dump` calls for config reads/writes with TOML equivalents
- [ ] 3.5 Preserve YAML reading for any other YAML files `bmad-init.py` touches (do not over-migrate)

### Task 4: Run test suite (AC: 4)

- [ ] 4.1 Run `npm test` — exit code 0
- [ ] 4.2 If test fixtures contain `config.yaml` paths, update to `config.toml` as appropriate
- [ ] 4.3 Re-run after any fixture updates

### Task 5: Scratch install verification (AC: 5)

- [ ] 5.1 Perform scratch install against a temp project using the library API
- [ ] 5.2 Read back config values from the TOML output; confirm ma-agents overlay values present
- [ ] 5.3 Document findings in Dev Notes

## Dev Notes

### Conditional structure is by design

This story is explicitly gated on Story 24.1/24.2 findings. Do not speculate about whether the config format changed — verify first. If the finding is "still YAML", this story closes in 5 minutes with a one-line documentation update.

### What this story does NOT do

- Does NOT migrate any skill SKILL.md files (Story 24.4)
- Does NOT implement customize.toml overlays (Stories 24.4, 24.7)
- Does NOT change how BMAD is invoked from Node.js (that is `lib/bmad.js` territory, handled minimally here)

### TOML library guidance (if needed)

`tomllib` was added to the Python standard library in 3.11. For compatibility with earlier versions, the idiomatic approach is:

```python
try:
    import tomllib
except ImportError:
    import tomli as tomllib  # pip install tomli
```

For writing, there is no stdlib writer before 3.11+ (and even 3.11 only reads). Use `tomli_w` for writes or a simple hand-rolled serializer if the config structure is flat.

### Reference Files

- `lib/bmad.js` — `CANONICAL_CONFIG_REL` constant
- `lib/bmad-init.py` (or `scripts/bmad-init.py`) — config read/write logic
- Story 24.1 Dev Notes — config format finding
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decision P5-1, Sub-decision A)

## Dev Notes (continued)

### Project Structure Notes

Files to read/modify if the conditional path (TOML migration) is taken:

- `lib/bmad.js` — `CANONICAL_CONFIG_REL` constant is at line ~45: `const CANONICAL_CONFIG_REL = path.join(BMAD_DIR, 'bmm', 'config.yaml');`. If TOML, change `'config.yaml'` to `'config.toml'` (or whatever path 24.1 finds). `LEGACY_MANIFEST_REL` (line ~46) is kept as a detection marker — do not touch it.
- `lib/installer.js` — `resolveBmadOutputDirs(projectRoot)` function (line ~174) reads `configPath` from `CANONICAL_CONFIG_REL` and uses a regex-based YAML scalar scanner. If TOML, the `scanScalar()` helper must be replaced with TOML parsing. The `yaml` package (from `package.json`) is already a dependency — check if it can parse TOML or if `toml-node` / `@iarna/toml` is needed. Note: `package.json` already lists `"yaml": "^2.8.2"` and `"js-yaml": "^4.1.1"` but neither parses TOML.
- `lib/bmad-init.py` (if it exists at repo root or `scripts/`) — Python config read/write logic. Verify existence with `ls scripts/` before attempting edits.

No-op confirmation path: If Task 1.2 determines `config.yaml` still exists in v6.5.0, document the finding in Dev Notes and mark story done. The only file change in that case is adding a one-line note to the Dev Notes section.

TOML parsing in Node.js: The `yaml` package does NOT parse TOML. For Node.js, BMAD's own installer likely uses `@iarna/toml` or the built-in approach. Check `node_modules/bmad-method/package.json` for its TOML dependency before adding a new one — reusing the same library avoids version conflicts.

### Testing Requirements

If no-op (config.yaml still present): no new tests needed.

If TOML migration is needed:
- `test/config-storage.test.js` — covers config read/write; add a fixture with a `config.toml` file and assert `resolveBmadOutputDirs()` reads it correctly
- `test/config-path-migration.test.js` — covers config path transitions; add TOML variant test case
- `test/integration-verification.test.js` — end-to-end install; add scratch install that checks `_bmad/bmm/config.toml` is read correctly

How to run tests: `npm test` in `d:\Code\agents`

### What this story does NOT do

- Does NOT migrate any skill SKILL.md files (Story 24.4)
- Does NOT implement customize.toml overlays (Stories 24.4, 24.7)
- Does NOT change how BMAD is invoked from Node.js beyond the config path constant

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-28 | 1.1.0 | (pending) | Enhanced to ready-for-dev: added project structure notes, exact constant locations, TOML library guidance, testing requirements |

## Dev Agent Record

### Agent Model Used
(to be filled by implementing agent)

### Debug Log References
(none)

### Completion Notes List
(none — story not yet implemented)

### File List
(to be filled by implementing agent)
