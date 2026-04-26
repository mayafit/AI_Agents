# Story 24.4: Reconcile 4 Forked Workflow Skills with Upstream customize.toml

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to process each of the 4 forked workflow skills per the Story 24.2 decision table, either migrating them to customize.toml overlays or documenting why the fork must be retained,
So that ma-agents carries the minimum necessary divergence from upstream BMAD and benefits from upstream improvements in v6.4.0.

## Acceptance Criteria

1. **Given** the Story 24.2 per-skill decision table, **When** this story is implemented, **Then** each of the 4 forked skills (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, `bmad-code-review`) has been processed according to its decision (migrate / retain / delete).

2. **Given** a skill is decided as "migrate", **When** the migration is complete, **Then** the forked SKILL.md is removed from `lib/bmad-extension/skills/`, a `customize.toml` expressing the ma-agents delta is committed, and `MANIFEST.yaml` is updated to reflect the removal.

3. **Given** a skill is decided as "retain fork", **When** the skill is reviewed, **Then** a comment block is added to the SKILL.md explaining why customize.toml cannot express the required delta, citing the specific TOML limitation.

4. **Given** any skill deletions or additions, **When** I run `scripts/build-plugin.js`, **Then** the script exits 0 and produces a valid plugin bundle with no references to deleted skills.

5. **Given** all changes are applied, **When** I run `npm test` and perform a scratch install, **Then** the test suite exits 0 and the scratch install shows correct behavior for all 4 skill areas (planning, status, dev-story, code-review).

## Tasks / Subtasks

### Task 1: Read Story 24.2 per-skill decision table (AC: 1)

- [ ] 1.1 Open Story 24.2 Dev Notes — locate the per-skill decision table
- [ ] 1.2 Record each skill's decision here for reference during Tasks 2-5
- [ ] 1.3 Confirm Story 24.2 is done before proceeding

### Task 2: Process bmad-sprint-planning (AC: 1, 2, 3)

- [ ] 2.1 Apply the decision from the table: migrate, retain, or delete
- [ ] 2.2 If migrate: write `lib/bmad-extension/skills/bmad-sprint-planning/customize.toml` expressing our delta; delete the forked SKILL.md
- [ ] 2.3 If retain: add a comment block to SKILL.md explaining the TOML limitation
- [ ] 2.4 If delete: remove the skill directory; verify no other files reference it

### Task 3: Process bmad-sprint-status (AC: 1, 2, 3)

- [ ] 3.1 Apply the decision from the table: migrate, retain, or delete
- [ ] 3.2 If migrate: write `lib/bmad-extension/skills/bmad-sprint-status/customize.toml`; delete the forked SKILL.md
- [ ] 3.3 If retain: add a comment block to SKILL.md
- [ ] 3.4 If delete: remove the skill directory; verify no other files reference it

### Task 4: Process bmad-dev-story (AC: 1, 2, 3)

- [ ] 4.1 Apply the decision from the table: migrate, retain, or delete
- [ ] 4.2 If migrate: write `lib/bmad-extension/skills/bmad-dev-story/customize.toml`; delete the forked SKILL.md
- [ ] 4.3 If retain: add a comment block to SKILL.md
- [ ] 4.4 If delete: remove the skill directory; verify no other files reference it

### Task 5: Process bmad-code-review (AC: 1, 2, 3)

- [ ] 5.1 Apply the decision from the table: migrate, retain, or delete
- [ ] 5.2 If migrate: write `lib/bmad-extension/skills/bmad-code-review/customize.toml`; delete the forked SKILL.md
- [ ] 5.3 If retain: add a comment block to SKILL.md
- [ ] 5.4 If delete: remove the skill directory; verify no other files reference it

### Task 6: Update MANIFEST.yaml (AC: 2, 4)

- [ ] 6.1 For every deleted SKILL.md: remove or update the MANIFEST.yaml entry
- [ ] 6.2 For every new customize.toml: verify MANIFEST.yaml entry still points to the skill correctly (the skill itself now comes from upstream; we only ship the TOML overlay)
- [ ] 6.3 Confirm MANIFEST.yaml is valid YAML after edits

### Task 7: Run build-plugin.js and npm test (AC: 4, 5)

- [ ] 7.1 Run `node scripts/build-plugin.js` — exit code 0
- [ ] 7.2 Inspect bundle output — confirm no references to deleted SKILL.md files
- [ ] 7.3 Run `npm test` — exit code 0
- [ ] 7.4 Perform scratch install — exercise each of the 4 skill areas; confirm expected behavior

## Dev Notes

### Per-skill decision table (to be populated by Story 24.2)

| Skill | Our Delta | Upstream v6.4.0 Delta | Decision | Rationale |
|-------|-----------|----------------------|----------|-----------|
| bmad-sprint-planning | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) |
| bmad-sprint-status | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) |
| bmad-dev-story | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) |
| bmad-code-review | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) | (fill from 24.2) |

Story 24.2 must populate this table before Story 24.4 begins implementation.

### What this story does NOT do

- Does NOT implement TOML config support for the module config path (Story 24.3)
- Does NOT add bmad-customize skill (Story 24.6)
- Does NOT wire on_complete hooks (Story 24.7)
- Does NOT add Kimi routing (Story 24.5)

### Migrate vs. retain criteria (from Story 24.2)

Migrate: delta consists only of additional instructions, tone/framing changes, or parameter defaults that TOML `override`/`append` can express cleanly.

Retain: delta includes structural reordering, removal of upstream steps, or additions that TOML merge rules cannot express without losing behavioral fidelity.

Delete: skill fully superseded by upstream v6.4.0 behavior; our delta is no longer needed.

### customize.toml placement note

If migrated overlays are placed in `lib/bmad-extension/skills/<skill-name>/customize.toml`, confirm that `scripts/build-plugin.js` picks them up and packages them into the plugin bundle correctly. If the TOML overlay needs to land in a different location (e.g., `lib/bmad-extension-plugin/_bmad/custom/`), adjust the build script accordingly and document the change.

### Reference Files

- `lib/bmad-extension/skills/` — forked skill directory
- `MANIFEST.yaml` — extension skill manifest
- `scripts/build-plugin.js` — plugin bundler
- Story 24.2 Dev Notes — per-skill decision table
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decision P5-1)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
