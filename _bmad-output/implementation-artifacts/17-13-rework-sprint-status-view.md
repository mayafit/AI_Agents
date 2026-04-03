# Story 17.13: Rework sprint-status-view Skill (Heavy Rework — Single Source Read)

Status: ready-for-dev

## Story

As a **Project Manager**,
I want the `sprint-status-view` skill to read all sprint data from the single `sprint-status.yaml` file,
So that sprint status display is fast and consistent with no cross-file reconciliation needed.

## Acceptance Criteria

1. **Given** the `sprint-status-view` skill is invoked,
   **When** it reads `sprint-status.yaml`,
   **Then** it displays a formatted view from the three sections:
   ```
   === Epics ===
   Epic 5: Bundled BMAD Installation [in-progress] (2/6 done)
   Epic 17: Sprint Management Model Rework [planning] (0/15 done)

   === Sprint 3 (active) -- 4/6 items ===
     * 5-5-explicit-parameter-passing [story] -- in-progress
     * 5-6-fix-space-in-path-bug [story] -- review
     * BUG-path-spaces [bug, high] -- ready-for-dev
     * 15-1-bump-bmad-method [story] -- backlog

   === Backlog -- 12 items ===
     1. 15-2-restructure-extension-module [story] -- ready-for-dev
     2. 15-3-convert-custom-agents [story] -- backlog
     ...
   ```

2. **Given** no `sprint-status.yaml` file exists,
   **When** the skill is invoked,
   **Then** it reports: "No sprint-status.yaml found. Run sprint planning to initialize."

3. **Given** the file contains multiple sprints (one active, others closed or planning),
   **When** the status is displayed,
   **Then** the active sprint is shown first, followed by planning sprints, then a summary of closed sprints.

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current sprint-status-view skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/sprint-status-view/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current cross-file reconciliation: reads sprint-*.yaml + backlog.yaml + sprint-status.yaml + bug-*.md
  - [ ] 1.3 Identify the display format sections and ordering logic

- [ ] Task 2: Simplify data loading to single file read (AC: 1, 2)
  - [ ] 2.1 Replace all multi-file reads (sprints/*.yaml, backlog.yaml, bug-*.md, sprint-status.yaml) with a single `Read sprint-status.yaml`
  - [ ] 2.2 Handle missing file case: report "No sprint-status.yaml found. Run sprint planning to initialize."
  - [ ] 2.3 Parse all three sections: `epics`, `backlog`, `sprints`

- [ ] Task 3: Build Epics display section (AC: 1)
  - [ ] 3.1 Read the `epics` section (map keyed by epic ID)
  - [ ] 3.2 Compute done/total story counts per epic by scanning `backlog` and `sprints[].items` for items matching each epic
  - [ ] 3.3 Also count items in `done/` folder for accurate totals (done items are removed from sprint-status.yaml)
  - [ ] 3.4 Format: `Epic N: Title [status] (done_count/total_count done)`

- [ ] Task 4: Build Sprint display section (AC: 1, 3)
  - [ ] 4.1 Read the `sprints` section (map keyed by sprint ID)
  - [ ] 4.2 Sort sprints: active first, then planning, then closed
  - [ ] 4.3 For active/planning sprints, display each item with: id, type, severity (for bugs), status
  - [ ] 4.4 For closed sprints, display a collapsed summary line
  - [ ] 4.5 Show capacity usage: items.length / capacity

- [ ] Task 5: Build Backlog display section (AC: 1)
  - [ ] 5.1 Read the `backlog` array
  - [ ] 5.2 Display items in priority order with: priority number, id, type, status
  - [ ] 5.3 Show total count; display top 15 items, note remaining count

- [ ] Task 6: Remove the sprint-status.yaml regeneration step (AC: 1-3)
  - [ ] 6.1 The current skill has an internal step 7 that regenerates sprint-status.yaml from cross-file sources. This is no longer needed — the file IS the source of truth.
  - [ ] 6.2 Remove the `development_status` regeneration logic entirely
  - [ ] 6.3 This skill is now READ-ONLY — it does NOT write to any file

- [ ] Task 7: Update the next-actions menu (AC: 1-3)
  - [ ] 7.1 Update menu references to reflect unified model commands
  - [ ] 7.2 Remove stale references to backlog.yaml or sprint entity files

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The sprint-status-view skill performs a complex cross-file reconciliation: it reads sprint entity files (`sprints/sprint-*.yaml`), `backlog.yaml`, `bug-*.md` frontmatter, and the existing `sprint-status.yaml` (for fallback status). It then merges data from all sources to build a display. After display, it regenerates `sprint-status.yaml` from the merged data (step 7).

**New behavior:** The skill reads a single `sprint-status.yaml` file and renders all three sections (epics, sprints, backlog) directly. No cross-file reconciliation. No file writes. Pure read-only display operation.

### Key Differences

- **Single file read:** Eliminates 4+ file reads and cross-file merge logic
- **No write step:** The internal step 7 (regenerate sprint-status.yaml) is removed entirely
- **Epics section display:** New — displays epic-level progress from the `epics` section
- **Item metadata inline:** Sprint items carry their own metadata; no need to cross-reference backlog for titles/types
- **Done count computation:** Done items are archived (not in file), so done counts must factor in `done/` folder contents

### Skill File(s) to Modify

- `.claude/skills/sprint-status-view/SKILL.md` — complete rewrite of workflow steps

### Unified Schema Sections Touched

- **`epics`** — read (epic status for display)
- **`backlog`** — read (unassigned items for display)
- **`sprints`** — read (sprint entities and items for display)
- **All sections are read-only** — this skill does NOT write to the file

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema
- **Story 17.14** (related): cleanup-done archives done items; this skill may suggest running cleanup
- **Story 17.20** (related): bmad-sprint-status is the quick-summary variant; this is the detailed view
- **Story 12.4** (original): This skill was originally created in Epic 12

### Gotchas from Current Implementation

1. The current skill has 7 steps including an internal regeneration step. The new skill should be 5-6 steps maximum (all read/display, no write).
2. The current skill's step 7 regenerates sprint-status.yaml from cross-file sources. This must be completely removed — it would overwrite the unified file with the old format.
3. The current skill uses a `status_fallback_map` from sprint-status.yaml's `development_status` section. This section no longer exists in the new schema.
4. The current skill globbing for `bug-*.md` files to build bug metadata is no longer needed — bugs are inline in the backlog/sprint sections.
5. Done count computation: items with status `done` are removed from the file. To show accurate epic progress, the skill must count files in `done/` folder matching each epic's story pattern.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR133 (unified file), FR135 (in-place status update)

### Project Structure Notes
- Skill files are in `.claude/skills/sprint-status-view/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Done archive at `_bmad-output/implementation-artifacts/done/`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
