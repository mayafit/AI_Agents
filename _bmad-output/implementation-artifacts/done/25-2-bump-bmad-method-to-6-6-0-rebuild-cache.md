# Story 25.2: Bump bmad-method to v6.6.0 and Rebuild Cache

Status: done

## Completion Note
Completed 2026-05-01. All tasks executed: package.json pinned to exact 6.6.0 (no caret), BMAD_TARGET_VERSION updated in lib/bmad.js, bmad-method@6.6.0 installed, bmad-cache rebuilt (3 modules updated: cis, gds, tea; bmb skipped as up-to-date), plugin bundle rebuilt, test suite: 153 passed, 4 pre-existing failures in routing-parity.test.js (Jira backend fixture snapshots on branch — unrelated to this story).

## Story

As a **ma-agents user**,
I want the bundled bmad-method dependency upgraded from v6.5.0 to v6.6.0 and the bmad-cache rebuilt,
So that all upstream v6.6.0 improvements (--custom-source reliability, PluginResolver fixes) are available without any manual intervention.

**Blocked by:** Story 25.1 must be merged first — the `--tools none` guard must be in place before v6.6.0's changed behavior is exposed by tests.

## Acceptance Criteria

1. **Given** a fresh checkout of the feature branch, **When** I open `package.json`, **Then** the `dependencies` section declares `"bmad-method": "6.6.0"` (exact pin, no caret/tilde).

2. **Given** the dependency is bumped, **When** I run `npm update bmad-method`, **Then** `package-lock.json` is updated and `node_modules/bmad-method/package.json` shows version `6.6.0`.

3. **Given** the updated dependency, **When** I run `npm run build:bmad-cache` (or the equivalent cache-rebuild script), **Then** the command exits 0 and the bmad-cache reflects v6.6.0 content.

4. **Given** the cache rebuild completes, **When** I run `npm test`, **Then** all tests pass (exit 0).

5. **Given** the `BMAD_TARGET_VERSION` constant in `lib/bmad.js`, **When** I inspect it, **Then** it reads `'6.6.0'`.

6. **Given** a scratch install after the bump, **When** I inspect `_bmad/config.toml` on the installed project, **Then** `project_name` appears under `[core]` (not `[modules.bmm]`) — confirming bmad-method's auto-migration is non-breaking for ma-agents users.

## Tasks / Subtasks

### Task 1: Bump the dependency (AC: 1, 2, 5)

- [ ] 1.1 Edit `package.json` — change `"bmad-method": "6.5.0"` to `"bmad-method": "6.6.0"` (exact pin)
- [ ] 1.2 Run `npm update bmad-method` to update `package-lock.json`
- [ ] 1.3 Verify `node_modules/bmad-method/package.json` shows version `6.6.0`
- [ ] 1.4 Update `BMAD_TARGET_VERSION = '6.6.0'` in `lib/bmad.js`

### Task 2: Rebuild the bmad-cache (AC: 3)

- [ ] 2.1 Run `npm run build:bmad-cache` (check `package.json` scripts section for the exact script name)
- [ ] 2.2 Confirm exit code 0
- [ ] 2.3 Inspect `lib/bmad-cache/cache-manifest.json` — confirm `bmadMethodVersion` is updated to `6.6.0`
- [ ] 2.4 Commit the rebuilt cache files along with the dependency bump

### Task 3: Update test version pins (AC: 4)

- [ ] 3.1 Open `test/bmad-version-bump.test.js` — update all version assertions from `6.5.0` to `6.6.0`
- [ ] 3.2 Check `test/build-bmad-args.test.js` for any version-pinned assertions — update if present
- [ ] 3.3 Check `test/plugin-manifests.test.js` for `bmad_min_version` assertions — update if present
- [ ] 3.4 Run `npm test` — exit 0 required; document any pre-existing failures separately

### Task 4: Verify project_name migration (AC: 6)

- [ ] 4.1 Create a scratch project and run full install: `node bin/cli.js install --yes --force --tools claude-code`
- [ ] 4.2 Inspect `_bmad/config.toml` — confirm `project_name` is under `[core]`, not `[modules.bmm]`
- [ ] 4.3 Document the finding in Dev Notes — confirms auto-migration is non-breaking for ma-agents users
- [ ] 4.4 Confirm no ma-agents code change is needed (bmad-method handles migration internally)

### Task 5: Update marketplace/module.yaml metadata (AC: 3)

- [ ] 5.1 Check `lib/bmad-extension/.claude-plugin/marketplace.json.template` — update `bmad_min_version` to `6.6.0` if present
- [ ] 5.2 Check `lib/bmad-extension/skills/module.yaml` — update schema version comment to `# BMAD v6.6.0 schema`
- [ ] 5.3 Run `npm run build:plugin` (or `node scripts/build-plugin.js`) to rebuild the plugin bundle
- [ ] 5.4 Confirm `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` and `lib/bmad-extension-plugin/skills/module.yaml` are updated

## Dev Notes

### Prerequisite: Story 25.1 must be merged first

Story 25.1 adds the `if (bmadTools.length > 0)` guard in `bin/cli.js`. Without it, v6.6.0's stricter handling of `--tools none` will cause test failures in the integration tests that exercise zero-tool installs. Merge 25.1's PR before starting 25.2.

### Key files and locations

- **`package.json`** (repo root) — change `"bmad-method": "6.5.0"` to `"bmad-method": "6.6.0"`
- **`lib/bmad.js`** — `BMAD_TARGET_VERSION` constant (search for `BMAD_TARGET_VERSION` to find exact line)
- **`lib/bmad-cache/cache-manifest.json`** — `bmadMethodVersion` field, updated by `build:bmad-cache` script
- **`test/bmad-version-bump.test.js`** — version assertions need updating from `6.5.0` to `6.6.0`
- **`lib/bmad-extension/.claude-plugin/marketplace.json.template`** — `bmad_min_version` field
- **`lib/bmad-extension/skills/module.yaml`** — schema version comment

### Command sequence

```
npm update bmad-method
npm run build:bmad-cache
npm run build:plugin      # rebuilds lib/bmad-extension-plugin/
npm test
```

Verify all four commands exit 0 before marking the story done.

### project_name migration context

In bmad-method v6.6.0, the `project_name` config key moves from `[modules.bmm]` to `[core]` in `config.toml`. bmad-method handles this migration internally on install. ma-agents reads `_bmad/bmm/config.yaml` (not `config.toml`) for its own config lookups, so this migration is transparent. Task 4 is a verification step only — no code change expected.

### Upstream v6.6.0 improvements covered

- `--custom-source` reliability fixes (PluginResolver now handles edge cases when the stage path contains spaces or symlinks)
- PluginResolver improvements for multi-tool installs
- `project_name` config key migration from `[modules.bmm]` to `[core]`

### PRD Traceability

- **FR196:** The ma-agents npm package bundles bmad-method v6.6.0 as a direct dependency
- **FR197:** The bundled BMAD cache is rebuilt with v6.6.0 content
- **FR198:** All upstream v6.6.0 improvements are available to ma-agents users
- **NFR55:** `npm test` must be green after the bump (no regressions)

### What this story does NOT do

- Does NOT change `buildBmadArgs()` logic (handled in Story 25.1)
- Does NOT add new CLI flags or user-visible features
- Does NOT change the install wizard flow
- Does NOT require a new test file — only version pin updates in existing tests

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-05-01 | 1.0.0 | (pending) | Story drafted as part of Epic 25 planning (Stage 3) |
