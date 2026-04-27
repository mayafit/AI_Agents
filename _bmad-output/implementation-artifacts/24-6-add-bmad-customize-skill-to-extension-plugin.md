# Story 24.6: Add bmad-customize Skill to Extension Plugin

Status: ready-for-dev

## Story

As a **ma-agents user who wants to customize BMAD workflows**,
I want the `bmad-customize` guided skill available after running `ma-agents install`,
So that I can use the upstream-authored TOML customization workflow without needing to manually locate or copy the skill file.

## Acceptance Criteria

0. **Given** Story 24.1 has bumped `bmad-method` to v6.5.0 and run `npm install`, **When** I search `node_modules/bmad-method` for a `bmad-customize` skill file, **Then** the file exists at a known path before any copy step proceeds. If the file is absent after the bump, this story closes as a no-op with a documented finding — do not fabricate or transcribe content from external sources.

1. **Given** AC0 confirms the skill exists and a fresh clone of the ma-agents repo, **When** I inspect `lib/bmad-extension/skills/bmad-customize/`, **Then** a valid SKILL.md exists that matches the upstream v6.5.0 `bmad-customize` content.

2. **Given** the `MANIFEST.yaml` extension manifest, **When** I search for `bmad-customize`, **Then** an entry exists with an appropriate `applies_when` condition (e.g., when the user wants to customize BMAD workflows or override agent behavior).

3. **Given** I run `node scripts/build-plugin.js`, **When** the script completes, **Then** the plugin bundle output includes `bmad-customize` and the script exits 0.

4. **Given** a scratch install with `--tools claude-code`, **When** the install completes, **Then** `bmad-customize` SKILL.md is present in `.claude/skills/`.

## Tasks / Subtasks

### Task 0: Confirm bmad-customize exists post-24.1 bump (AC: 0) — PREREQUISITE

- [ ] 0.1 Confirm Story 24.1 is complete and `node_modules/bmad-method` is at v6.5.0
- [ ] 0.2 Run: `find node_modules/bmad-method -name "SKILL.md" -path "*bmad-customize*"` — must return a result
- [ ] 0.3 If found: record the exact path in Dev Notes and proceed to Task 1
- [ ] 0.4 If NOT found: close this story as no-op; document finding in Dev Notes — "bmad-customize not shipped in npm package at v6.5.0; skill cannot be included without external source"; do NOT proceed

### Task 1: Copy upstream bmad-customize SKILL.md (AC: 1)

- [ ] 1.1 Copy the file found in Task 0 to `lib/bmad-extension/skills/bmad-customize/SKILL.md`
- [ ] 1.2 Do NOT modify the skill content — it is upstream-authoritative

### Task 2: Add MANIFEST.yaml entry (AC: 2)

- [ ] 2.1 Open `MANIFEST.yaml` (or `lib/bmad-extension/MANIFEST.yaml`) — inspect an existing entry for format reference (only proceed if Task 0 confirmed the skill exists)
- [ ] 2.2 Add entry for `bmad-customize`:
  - `name: bmad-customize`
  - `description: Guided workflow for authoring TOML customization overlays for BMAD skills`
  - `applies_when: when the user wants to customize BMAD workflow behavior or override default agent instructions`
  - Any other required fields (e.g., `always_load`, `file`, `category`) matching the existing pattern
- [ ] 2.3 Confirm MANIFEST.yaml is valid YAML after the edit

### Task 3: Run build-plugin.js and verify output (AC: 3)

- [ ] 3.1 Run `node scripts/build-plugin.js` — exit code 0
- [ ] 3.2 Inspect the plugin bundle output directory — confirm `bmad-customize` skill files are present
- [ ] 3.3 Commit any updated plugin bundle files (the bundle-drift CI check requires the committed bundle to match the script output)

### Task 4: Scratch install smoke test (AC: 4)

- [ ] 4.1 Perform scratch install against a temp project with `--tools claude-code`
- [ ] 4.2 Confirm `.claude/skills/bmad-customize` (or `.claude/skills/bmad-customize.md`) exists in the output
- [ ] 4.3 Run `npm test` — exit code 0

## Dev Notes

### Upstream-authoritative content

The `bmad-customize` SKILL.md content is upstream-authoritative. Do not alter it. If the upstream content requires localization (e.g., language tags), apply our standard localization wrapper in MANIFEST.yaml, not in the SKILL.md itself.

### What this story does NOT do

- Does NOT write or apply any customize.toml overlays (Stories 24.4, 24.7)
- Does NOT modify the upstream SKILL.md content
- Does NOT add any ma-agents-specific instructions to the skill

### Prerequisite: Story 24.1 must be at done status before this story begins

This story depends on the v6.5.0 bump in Story 24.1. Do not activate 24.6 until 24.1 is merged (status `done`). Specifically, `node_modules/bmad-method` must already be at v6.5.0 (verify with `node -e "console.log(require('./node_modules/bmad-method/package.json').version)"`) before Task 0's search step has any meaning. The most likely failure mode is that `bmad-customize` ships only in the BMAD GitHub repo (not in the npm package) — Task 0 is the gate that catches this. If the skill is absent from the npm package, this story closes as a no-op and the bmad-customize integration is deferred to a follow-up epic.

### Finding source if not in node_modules

If `bmad-customize` is not shipped inside the `node_modules/bmad-method` npm package, do NOT transcribe or download content from external sources. Close this story as no-op and document the finding so a future maintainer can revisit once BMAD ships the skill in the npm distribution.

### Reference Files

- `node_modules/bmad-method` — upstream skill source
- `lib/bmad-extension/skills/` — skill extension directory
- `MANIFEST.yaml` — extension skill manifest
- `scripts/build-plugin.js` — plugin bundler

## Dev Notes (continued)

### Project Structure Notes

File locations for this story:

- `node_modules/bmad-method` — search for `bmad-customize`: `find node_modules/bmad-method -name "SKILL.md" -path "*bmad-customize*"`. Only proceed if found — if absent, close as no-op per AC0.
- `lib/bmad-extension/skills/bmad-customize/` — destination directory to create. Follow the pattern of existing skills (e.g., `lib/bmad-extension/skills/sre-check-system-status/` or any `mil498-*` skill):
  - `SKILL.md` — copied verbatim from upstream (no modifications)
  - `bmad-skill-manifest.yaml` — create following the pattern in other skill directories (fields: `name`, `description`, `version`, `category`)
- `lib/bmad-extension/MANIFEST.yaml` (if it exists) or `lib/bmad-extension/skills/module.yaml` — the skill registry. Check which file lists all extension skills and add the entry there. `module.yaml` is the BMAD plugin manifest; the ma-agents MANIFEST.yaml is a separate file. Add to both if both exist.
- `scripts/build-plugin.js` — no changes expected; the build script auto-discovers `lib/bmad-extension/skills/` subdirectories. Just run it and verify output.
- `lib/bmad-extension-plugin/` — the committed build output. After running `build-plugin.js`, commit the diff in this directory.

**MANIFEST.yaml entry format** (inspect an existing entry in `lib/bmad-extension/MANIFEST.yaml`):
```yaml
  - id: bmad-customize
    file: bmad-customize/SKILL.md
    description: Guided workflow for authoring TOML customization overlays for BMAD skills
    applies_when:
      - when the user wants to customize BMAD workflow behavior or override default agent instructions
```

### Testing Requirements

Existing tests to run:
- `test/build-plugin.test.js` — add assertion that `bmad-customize` appears in plugin output (or verify test auto-discovers all skills)
- `test/plugin-manifests.test.js` — if it checks the skills list, update expected count

If no-op (skill not in node_modules): run `npm test` to confirm nothing broke; no new test cases.

How to run tests: `npm test` in `d:\Code\agents`

### What this story does NOT do

- Does NOT write or apply any customize.toml overlays (Stories 24.4, 24.7)
- Does NOT modify the upstream SKILL.md content
- Does NOT add any ma-agents-specific instructions to the skill

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-28 | 1.1.0 | (pending) | Added AC0 and Task 0 — prerequisite: confirm bmad-customize exists in node_modules post-24.1 bump before any copy step. No-op exit path added. Per second adversarial review Finding 2 (CRITICAL). |
| 2026-04-28 | 1.2.0 | (pending) | Enhanced to ready-for-dev: added project structure notes, exact file paths, MANIFEST entry format, testing requirements |

## Dev Agent Record

### Agent Model Used
(to be filled by implementing agent)

### Debug Log References
(none)

### Completion Notes List
(none — story not yet implemented)

### File List
(to be filled by implementing agent)
