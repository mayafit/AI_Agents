# Story 24.8: Verify Plugin Resolver Compatibility with v6.4.0

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to confirm that the ma-agents plugin bundle is resolved correctly under the new v6.4.0 PluginResolver precedence order (`package.json > module.yaml > marketplace.json`),
So that the plugin staging mechanism continues to work after the v6.4.0 upgrade without silent mis-resolution.

## Acceptance Criteria

1. **Given** a v6.4.0 install, **When** the PluginResolver runs, **Then** the correct ma-agents plugin version and identity are resolved — no stale cache or mis-resolution occurs.

2. **Given** the plugin stage directory layout, **When** BMAD's PluginResolver processes it using the local-file strategy, **Then** it picks up the plugin without error and the resolution result matches expected plugin metadata.

3. **Given** the new `package.json > module.yaml > marketplace.json` precedence order, **When** I inspect the plugin bundle files, **Then** the fields read by the resolver (name, version, code, etc.) in `package.json` and `module.yaml` are set correctly and take precedence appropriately over `marketplace.json`.

4. **Given** all changes (if any), **When** I perform a scratch install, **Then** all expected skills land in the correct tool directory.

## Tasks / Subtasks

### Task 1: Inspect v6.4.0 PluginResolver source (AC: 1, 2, 3)

- [ ] 1.1 Search `node_modules/bmad-method` for the PluginResolver class or module (likely in `tools/installer/` or similar path)
- [ ] 1.2 Read the resolver to understand the new `package.json > module.yaml > marketplace.json` precedence logic (PR #2298)
- [ ] 1.3 Note exactly which fields are read from each file: name, version, code, skillsPath, etc.
- [ ] 1.4 Document the resolution algorithm in Dev Notes

### Task 2: Audit our plugin bundle files against the new resolver (AC: 3)

- [ ] 2.1 Inspect `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` — check all resolver-read fields
- [ ] 2.2 Inspect `lib/bmad-extension-plugin/skills/module.yaml` (or wherever `module.yaml` lives in our bundle) — check all resolver-read fields
- [ ] 2.3 Check whether `package.json` exists in our plugin bundle stage directory; if not, determine if one is needed
- [ ] 2.4 For each field the resolver reads at higher priority (package.json, module.yaml): confirm the value is correct and consistent with marketplace.json

### Task 3: Update build-plugin.js if any fields need correction (AC: 3)

- [ ] 3.1 If any resolver-read field is missing or incorrect in package.json or module.yaml — update `scripts/build-plugin.js` to emit the correct values
- [ ] 3.2 Run `node scripts/build-plugin.js` — exit code 0
- [ ] 3.3 Commit updated bundle output if build-plugin.js changed

### Task 4: Scratch install smoke test (AC: 1, 2, 4)

- [ ] 4.1 Perform scratch install against a temp project
- [ ] 4.2 Confirm all expected skills land in `.claude/skills/` (or the appropriate tool directory)
- [ ] 4.3 Confirm no PluginResolver warnings or errors appear in install output
- [ ] 4.4 Run `npm test` — exit code 0

## Dev Notes

### Expected outcome

This is primarily a verification story. The expected outcome is "no change needed" — PR #2298 was a bug fix upstream (marketplace.json was incorrectly taking precedence over package.json in some edge cases), and our plugin structure was likely already setting the authoritative fields in the right places. The risk is that we were relying on the buggy precedence behavior without realizing it.

### What this story does NOT do

- Does NOT change the plugin's skill content
- Does NOT change the plugin stage directory structure (unless a field correction is needed)
- Does NOT add any new skills to the bundle (other stories handle that)

### Resolution order context

Before v6.4.0: the resolver had a bug where `marketplace.json` could shadow `package.json` in certain resolution paths. PR #2298 corrected the order to `package.json > module.yaml > marketplace.json` as originally designed. Our `marketplace.json` is now definitively the lowest-priority fallback.

### Reference Files

- `node_modules/bmad-method` — PluginResolver source
- `lib/bmad-extension-plugin/` — plugin bundle directory
- `lib/bmad-extension-plugin/.claude-plugin/marketplace.json` — marketplace metadata
- `scripts/build-plugin.js` — plugin bundler
- BMAD v6.4.0 PR #2298 — PluginResolver precedence fix

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
