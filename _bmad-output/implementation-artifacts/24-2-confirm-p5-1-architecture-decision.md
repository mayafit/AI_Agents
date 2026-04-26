# Story 24.2: Confirm Architecture Decision P5-1 (TOML Config + Skill Reconciliation)

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to confirm (or amend) Architecture Decision P5-1 in light of Story 24.1 findings, and produce a per-skill decision table for the 4 forked workflow skills,
So that Stories 24.3 and 24.4 have a definitive, researched specification before implementation begins.

## Acceptance Criteria

1. **Given** Story 24.1 Dev Notes are complete, **When** the config format finding is reviewed, **Then** if `_bmad/bmm/config.yaml` no longer exists in v6.4.0 output, P5-1 Sub-decision A is amended to require TOML read/write support in `bmad-init.py` and the Story 24.3 scope note is updated accordingly.

2. **Given** v6.4.0 upstream source is installed in `node_modules/bmad-method`, **When** each of the 4 forked skills (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, `bmad-code-review`) is diffed against its upstream counterpart, **Then** a per-skill decision (migrate to customize.toml / retain fork / delete entirely) is documented in the architecture document or Story 24.4 Dev Notes.

3. **Given** the per-skill decisions are documented, **When** `architecture.md` Decision P5-1 is reviewed, **Then** any required amendments reflecting findings from ACs 1 and 2 are committed to `architecture.md`.

4. **Given** the per-skill decision table is finalized, **When** Story 24.4 Dev Notes are reviewed, **Then** the table is present as a prerequisite section and Story 24.4 status may be advanced to ready-for-dev.

## Tasks / Subtasks

### Task 1: Review Story 24.1 config format finding and update P5-1 Sub-decision A if needed (AC: 1)

- [ ] 1.1 Read Story 24.1 Dev Notes — locate the "Module config format check" finding
- [ ] 1.2 If config.yaml still exists — note "P5-1 Sub-decision A confirmed as written; Story 24.3 scope remains no-op path"
- [ ] 1.3 If config moved to TOML — amend P5-1 Sub-decision A text in `architecture.md` to require TOML support; update Story 24.3 scope note

### Task 2: Diff bmad-sprint-planning against upstream v6.4.0 (AC: 2)

- [ ] 2.1 Locate our forked `lib/bmad-extension/skills/bmad-sprint-planning/` SKILL.md
- [ ] 2.2 Locate upstream counterpart in `node_modules/bmad-method` (search for sprint-planning skill path)
- [ ] 2.3 Produce a diff summary — list lines/sections unique to our fork vs. upstream
- [ ] 2.4 Record recommendation: migrate / retain / delete — with rationale

### Task 3: Diff bmad-sprint-status against upstream v6.4.0 (AC: 2)

- [ ] 3.1 Locate our forked `lib/bmad-extension/skills/bmad-sprint-status/` SKILL.md
- [ ] 3.2 Locate upstream counterpart in `node_modules/bmad-method`
- [ ] 3.3 Produce a diff summary
- [ ] 3.4 Record recommendation: migrate / retain / delete — with rationale

### Task 4: Diff bmad-dev-story against upstream v6.4.0 (AC: 2)

- [ ] 4.1 Locate our forked `lib/bmad-extension/skills/bmad-dev-story/` SKILL.md
- [ ] 4.2 Locate upstream counterpart in `node_modules/bmad-method`
- [ ] 4.3 Produce a diff summary
- [ ] 4.4 Record recommendation: migrate / retain / delete — with rationale

### Task 5: Diff bmad-code-review against upstream v6.4.0 (AC: 2)

- [ ] 5.1 Locate our forked `lib/bmad-extension/skills/bmad-code-review/` SKILL.md
- [ ] 5.2 Locate upstream counterpart in `node_modules/bmad-method`
- [ ] 5.3 Produce a diff summary
- [ ] 5.4 Record recommendation: migrate / retain / delete — with rationale

### Task 6: Update architecture.md and Story 24.4 Dev Notes (AC: 3, 4)

- [ ] 6.1 Open `_bmad-output/planning-artifacts/architecture.md` — locate Decision P5-1
- [ ] 6.2 Apply any amendments from Tasks 1-5; commit changes
- [ ] 6.3 Open Story 24.4 Dev Notes — add per-skill decision table with columns: Skill | Our Delta | Upstream v6.4.0 Delta | Decision | Rationale
- [ ] 6.4 Update sprint-status.yaml: set `24-4-reconcile-forked-skills-with-customize-toml` to `ready-for-dev` if all decisions are documented

## Dev Notes

### Why this story exists

Architecture Decision P5-1 was drafted pre-implementation, before Story 24.1 findings were available. This story is the "measure twice" gate. It may be lightweight (confirming P5-1 as written) or require amendments. The per-skill diff determines whether Story 24.4 is a quick hour of work or a full day.

### What this story does NOT do

- Does NOT implement any TOML support (Story 24.3)
- Does NOT modify any SKILL.md files (Story 24.4)
- Does NOT add customize.toml overlays (Stories 24.4, 24.7)

This story is a research and documentation story only. No source files outside `architecture.md` and the Story 24.4 Dev Notes section should be modified.

### Per-skill decision criteria

**Migrate to customize.toml** — if our fork's delta consists only of: additional instructions, tone/framing changes, or parameter defaults that the TOML `override` and `append` mechanisms can express cleanly.

**Retain fork** — if our fork's delta includes: structural reordering of steps, removal of upstream steps, or additions that TOML merge rules cannot express without losing behavioral fidelity.

**Delete entirely** — if the skill is fully superseded by upstream v6.4.0 behavior and our delta is no longer needed.

### Reference Files

- `_bmad-output/planning-artifacts/architecture.md` — Decision P5-1
- `lib/bmad-extension/skills/bmad-sprint-planning/`
- `lib/bmad-extension/skills/bmad-sprint-status/`
- `lib/bmad-extension/skills/bmad-dev-story/`
- `lib/bmad-extension/skills/bmad-code-review/`
- `node_modules/bmad-method` — upstream v6.4.0 skill sources

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
