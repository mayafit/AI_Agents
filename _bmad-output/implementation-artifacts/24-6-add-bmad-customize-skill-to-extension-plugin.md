# Story 24.6: Add bmad-customize Skill to Extension Plugin

Status: backlog

## Story

As a **ma-agents user who wants to customize BMAD workflows**,
I want the `bmad-customize` guided skill available after running `ma-agents install`,
So that I can use the upstream-authored TOML customization workflow without needing to manually locate or copy the skill file.

## Acceptance Criteria

1. **Given** a fresh clone of the ma-agents repo, **When** I inspect `lib/bmad-extension/skills/bmad-customize/`, **Then** a valid SKILL.md exists that matches the upstream v6.4.0 `bmad-customize` content.

2. **Given** the `MANIFEST.yaml` extension manifest, **When** I search for `bmad-customize`, **Then** an entry exists with an appropriate `applies_when` condition (e.g., when the user wants to customize BMAD workflows or override agent behavior).

3. **Given** I run `node scripts/build-plugin.js`, **When** the script completes, **Then** the plugin bundle output includes `bmad-customize` and the script exits 0.

4. **Given** a scratch install with `--tools claude-code`, **When** the install completes, **Then** `bmad-customize` SKILL.md is present in `.claude/skills/`.

## Tasks / Subtasks

### Task 1: Locate upstream bmad-customize SKILL.md (AC: 1)

- [ ] 1.1 Search `node_modules/bmad-method` for the `bmad-customize` skill file (expected path: something like `node_modules/bmad-method/tools/skills/bmad-customize/SKILL.md` or a similar path)
- [ ] 1.2 If found — copy it to `lib/bmad-extension/skills/bmad-customize/SKILL.md`
- [ ] 1.3 If not found in node_modules — check the v6.4.0 BMAD repository at the upstream path; transcribe/download the content manually and note the source in Dev Notes
- [ ] 1.4 Do NOT modify the skill content — it is upstream-authoritative

### Task 2: Add MANIFEST.yaml entry (AC: 2)

- [ ] 2.1 Open `MANIFEST.yaml` (or `lib/bmad-extension/MANIFEST.yaml`) — inspect an existing entry for format reference
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

### Finding source if not in node_modules

If `bmad-customize` is not shipped inside the `node_modules/bmad-method` npm package (e.g., it lives only in the GitHub repo), document the exact source path used and commit a note in Dev Notes so future maintainers know where to find updates.

### Reference Files

- `node_modules/bmad-method` — upstream skill source
- `lib/bmad-extension/skills/` — skill extension directory
- `MANIFEST.yaml` — extension skill manifest
- `scripts/build-plugin.js` — plugin bundler

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
