# Story 22.2: Skill Namespace Rename Sweep (`bmad-ma-agent-*` → `ma-agent-*`)

Status: backlog

## Story

As a **ma-agents maintainer**,
I want all extension skills renamed out of the upstream-reserved `bmad-*` prefix into a `ma-agent-*` namespace,
So that the extension module no longer collides with the BMAD Builder reserved namespace and the rename is complete before the plugin packaging story (22.5) lands.

## Acceptance Criteria

1. **Given** the five custom-agent skill folders, **When** the rename is applied, **Then** the directories are renamed via `git mv`:
   - `lib/bmad-extension/skills/bmad-ma-agent-cyber/` → `lib/bmad-extension/skills/ma-agent-cyber/`
   - `lib/bmad-extension/skills/bmad-ma-agent-devops/` → `lib/bmad-extension/skills/ma-agent-devops/`
   - `lib/bmad-extension/skills/bmad-ma-agent-sre/` → `lib/bmad-extension/skills/ma-agent-sre/`
   - `lib/bmad-extension/skills/bmad-ma-agent-ml/` → `lib/bmad-extension/skills/ma-agent-ml/`
   - `lib/bmad-extension/skills/bmad-ma-agent-sqa/` → `lib/bmad-extension/skills/ma-agent-sqa/`

2. **Given** each renamed `SKILL.md`, **When** I read its frontmatter, **Then** the `name:` field reflects the new ID and any internal trigger phrases that referenced the old name are updated.

3. **Given** each renamed `bmad-skill-manifest.yaml`, **When** I read it, **Then** the `name:` field reflects the new ID.

4. **Given** `lib/bmad-extension/module-help.csv`, **When** I read it, **Then** every row that previously referenced one of the five old skill IDs now references the new ID — no row is dropped, no row is duplicated.

5. **Given** all MANIFEST.yaml files the installer maintains (`.claude/skills/MANIFEST.yaml`, `.cursor/skills/MANIFEST.yaml`, `.cline/skills/MANIFEST.yaml`, `.roo/skills/MANIFEST.yaml`, `.gemini/skills/MANIFEST.yaml`, `.github/copilot/skills/MANIFEST.yaml`, `.kilocode/skills/MANIFEST.yaml`, `.opencode/skills/MANIFEST.yaml`, `.agent/skills/MANIFEST.yaml`), **When** I run a fresh install, **Then** they list only the new IDs (no `bmad-ma-agent-*` entries remain).

6. **Given** a repo-wide search, **When** I run `grep -r "bmad-ma-agent-" .` excluding `.git`, **Then** the only remaining matches are intentional historical references in: PRD edit history (`_bmad-output/planning-artifacts/prd.md` editHistory), architecture edit history, this epic's edit history (`epics.md` phase4EditHistory), retrospectives, and other dated history records. No live source file references remain.

7. **Given** an existing user installation that has the old skill IDs in `.ma-agents.json`, **When** the user runs `npx ma-agents install` with this story's code, **Then** the installer detects the old IDs, removes them from the manifest, and installs the new IDs — no orphaned files remain in any agent's skills directory.

8. **Given** `test/extension-module-restructure.test.js`, **When** I read its `expectedAgentSkills` array, **Then** it lists the five new IDs (`ma-agent-cyber`, `ma-agent-devops`, `ma-agent-sre`, `ma-agent-ml`, `ma-agent-sqa`) and the test passes.

9. **Given** documentation files (`README.md`, `docs/*.md`, user-facing markdown in `_bmad-output/` other than dated history), **When** I read them, **Then** all live references to the old skill IDs are updated to the new IDs.

## Tasks / Subtasks

### Task 1: Plan the sweep (AC: 1, 6)

- [ ] 1.1 Run `grep -rn "bmad-ma-agent-" --include="*.md" --include="*.yaml" --include="*.csv" --include="*.json" --include="*.js" .` and capture the full match list
- [ ] 1.2 Categorize each match: (a) a directory or filename to be renamed, (b) a content reference inside a file that needs updating, (c) a dated historical entry that should be left alone
- [ ] 1.3 Confirm the categorization with the maintainer before proceeding (the rename is mechanical but irreversible — get sign-off on the historical-entries list)

### Task 2: Execute the directory renames (AC: 1)

- [ ] 2.1 `git mv lib/bmad-extension/skills/bmad-ma-agent-cyber lib/bmad-extension/skills/ma-agent-cyber`
- [ ] 2.2 Repeat for `devops`, `sre`, `ml`, `sqa`
- [ ] 2.3 Verify with `git status` that the moves are tracked as renames (not delete + add)

### Task 3: Update SKILL.md frontmatter and content (AC: 2)

- [ ] 3.1 In each renamed folder, edit `SKILL.md`:
  - Update frontmatter `name:` field
  - Update any `description:` text that includes the old ID
  - Sweep the body for trigger phrases or self-references that include the old ID
- [ ] 3.2 Verify no `bmad-ma-agent-` substring remains in any SKILL.md inside the renamed folders

### Task 4: Update bmad-skill-manifest.yaml files (AC: 3)

- [ ] 4.1 In each renamed folder, edit `bmad-skill-manifest.yaml`:
  - Update `name:` field

### Task 5: Update module-help.csv (AC: 4)

- [ ] 5.1 Edit `lib/bmad-extension/module-help.csv` — find every row whose skill identifier column references an old ID and rewrite the cell with the new ID
- [ ] 5.2 Verify row count is unchanged before/after

### Task 6: Update MANIFEST.yaml in all installed agent locations (AC: 5)

- [ ] 6.1 The MANIFEST.yaml files are generated by the installer — running a fresh `npx ma-agents install --yes --force` against a scratch project should produce updated manifests automatically
- [ ] 6.2 Verify by inspecting the generated `.claude/skills/MANIFEST.yaml`, `.copilot/skills/MANIFEST.yaml`, etc. — no old IDs should appear

### Task 7: Implement migration of existing user installations (AC: 7)

- [ ] 7.1 In `lib/installer.js` (or wherever `.ma-agents.json` is read/written), add a migration step:
  - On install, check whether `.ma-agents.json` lists any old skill IDs (`bmad-ma-agent-*`)
  - If found, remove them from the manifest
  - Also remove their installed files from each agent's skills directory (e.g., delete `.claude/skills/bmad-ma-agent-cyber/`)
- [ ] 7.2 Make the migration idempotent: running it twice produces the same result

### Task 8: Sweep documentation (AC: 9)

- [ ] 8.1 Update `README.md`
- [ ] 8.2 Update any `docs/*.md` references
- [ ] 8.3 Update `project-context.md` template if it lists agent IDs

### Task 9: Update tests (AC: 8)

- [ ] 9.1 Edit `test/extension-module-restructure.test.js` — update `expectedAgentSkills` to list the five new IDs
- [ ] 9.2 Run `npm test` and confirm the test passes
- [ ] 9.3 If any other test asserts on the old IDs, update them

### Task 10: Final verification (AC: 6)

- [ ] 10.1 Re-run `grep -rn "bmad-ma-agent-" --include="*.md" --include="*.yaml" --include="*.csv" --include="*.json" --include="*.js" .` and confirm only intentional historical entries remain
- [ ] 10.2 Document the remaining matches in the story's File List section so reviewers can verify the categorization

## Dev Notes

### Mechanical sweep, not a refactor

This story is a search-and-replace at scale. It does not change behavior — every renamed skill produces identical output to its pre-rename version. Because of the breadth, use a scripted sweep to catch every reference; manual edits will miss something.

### Why now, before plugin packaging

Story 22.5 produces `lib/bmad-extension-plugin/` from source. If the rename happens after Story 22.5, the bundled plugin contains the old IDs and a second sweep is required. Doing 22.2 first means 22.5 picks up the new names cleanly.

### Historical entries to leave alone

The PRD `editHistory` and architecture `phase*EditHistory` entries refer to the old names accurately at the time they were written. These are dated records — leave them intact. Same for any retrospective files.

### Migration of existing user installations

A user who upgrades from a previous ma-agents version will have the old skill IDs in their `.ma-agents.json` and old files in their agent skills directories. The installer must detect and clean these up — otherwise users see two copies of each agent (old and new) until they manually clean up.

### Reference Files

- `lib/bmad-extension/skills/` — the source tree to rename
- `lib/bmad-extension/module-help.csv` — registry that needs sweeping
- `lib/installer.js` — where the migration helper lives
- `test/extension-module-restructure.test.js` — assertion list to update
- `.ma-agents.json` — per-project manifest that needs migration

### PRD Traceability

- **FR183:** Module definitions move to `skills/module.yaml` and the extension is renamed out of the reserved `bmad-*` namespace

### Architecture Reference

- Decision P4-1, "Skill namespace rename" subsection — enumerates the rename targets

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
