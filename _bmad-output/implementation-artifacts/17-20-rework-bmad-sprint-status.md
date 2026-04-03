# Story 17.20: Rework bmad-sprint-status Skill (Light Rework — Structured Sections)

Status: ready-for-dev

## Story

As a **Project Manager**,
I want the `bmad-sprint-status` skill to produce a concise risk-focused summary from the structured sections of `sprint-status.yaml`,
So that sprint health and risks are surfaced quickly from the single source of truth.

## Acceptance Criteria

1. **Given** the `bmad-sprint-status` skill is invoked,
   **When** it reads the `sprints` section of `sprint-status.yaml`,
   **Then** it identifies the active sprint and calculates:
   - Items by status: how many `in-progress`, `review`, `ready-for-dev`, `backlog`
   - Capacity usage: items.length / capacity
   - Blocked items: items with `status: blocked` (if any)

2. **Given** the active sprint has items with concerning statuses,
   **When** the summary is generated,
   **Then** it flags risks:
   - "3 of 6 items still in `backlog` status — not yet started"
   - "Sprint at 100% capacity with 2 items in `ready-for-dev`"
   - "No items in `review` or `done` — sprint may be at risk"

3. **Given** the `epics` section contains epic-level data,
   **When** the summary is generated,
   **Then** it includes epic progress: "Epic 5: 2/6 done, Epic 17: 0/15 done".

## Tasks / Subtasks

- [ ] Task 1: Read and understand current bmad-sprint-status skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/bmad-sprint-status/SKILL.md` and `.claude/skills/bmad-sprint-status/workflow.md`
  - [ ] 1.2 Document the current parsing logic (reads `development_status` flat map, classifies keys into epics/stories/retrospectives)
  - [ ] 1.3 Document the current output format and risk surfacing logic
  - [ ] 1.4 Identify the three execution modes: interactive, data, validate
- [ ] Task 2: Rewrite parsing to use structured sections (AC: 1)
  - [ ] 2.1 Replace `development_status` flat map parsing with direct reads of `epics`, `backlog`, and `sprints` sections
  - [ ] 2.2 Find the active sprint by scanning the `sprints` map for `status: active`
  - [ ] 2.3 Count items by status from the active sprint's `items` array
  - [ ] 2.4 Calculate capacity usage: `items.length / capacity`
  - [ ] 2.5 Detect blocked items (status = `blocked`) if the status vocabulary supports it
- [ ] Task 3: Rewrite epic progress calculation (AC: 3)
  - [ ] 3.1 Read the `epics` section for epic status values
  - [ ] 3.2 Calculate done/total counts by scanning `backlog` and all `sprints[].items` for items with matching `epic` field
  - [ ] 3.3 Include items in `done/` archive — check the folder for story files matching each epic
  - [ ] 3.4 Display as "Epic N: X/Y done"
- [ ] Task 4: Rewrite risk flagging logic (AC: 2)
  - [ ] 4.1 Flag: many items still in `backlog` or `ready-for-dev` status (not started)
  - [ ] 4.2 Flag: sprint at or over capacity
  - [ ] 4.3 Flag: no items in `review` or `done` (nothing progressing toward completion)
  - [ ] 4.4 Flag: blocked items (any item with `status: blocked`)
  - [ ] 4.5 Preserve the concise, structured output format optimized for both human reading and LLM parsing
- [ ] Task 5: Preserve execution modes (AC: 1-3)
  - [ ] 5.1 Keep the three modes: interactive (full display), data (machine-readable), validate (checks)
  - [ ] 5.2 Update each mode's logic to read from structured sections instead of flat map
- [ ] Task 6: Remove legacy parsing references (AC: 1-3)
  - [ ] 6.1 Remove all `development_status` flat map parsing logic
  - [ ] 6.2 Remove key-pattern classification (epic-*, retrospective, story pattern matching)
  - [ ] 6.3 Remove the "drafted" -> "ready-for-dev" legacy status mapping (no longer needed)
  - [ ] 6.4 Remove the "contexted" -> "in-progress" legacy epic status mapping (no longer needed)

## Dev Notes

### What This Story Changes vs Current Behavior

The current `bmad-sprint-status` workflow (in `workflow.md`) parses the flat `development_status` map:
- Classifies keys by pattern: `epic-*` = epic, `*-retrospective` = retrospective, everything else = story
- Counts statuses across all stories (no sprint concept in the flat model)
- Maps legacy statuses ("drafted" -> "ready-for-dev", "contexted" -> "in-progress")
- Has no capacity tracking or sprint-scoped analysis

After this rework:
- Reads structured `epics`, `backlog`, and `sprints` sections directly
- Identifies the active sprint and scopes status analysis to it
- Calculates capacity usage (items vs capacity limit)
- Epic progress is computed from items across all sections
- Risk flagging is sprint-scoped, not global
- Legacy status mappings are removed (unified schema uses canonical statuses)

This is a **light rework** because:
- The skill's purpose and output style remain the same (concise risk summary)
- The three execution modes (interactive, data, validate) remain
- Only the data source and parsing logic change

### Skill Files to Modify

- `.claude/skills/bmad-sprint-status/SKILL.md` — entry point (delegates to workflow.md)
- `.claude/skills/bmad-sprint-status/workflow.md` — main workflow file; **Steps 2-3 need rewriting** (parsing and analysis)

### Unified Schema Sections Touched

- **`epics`** — read for epic status and progress calculation (read-only)
- **`backlog`** — read for item counts contributing to epic progress (read-only)
- **`sprints`** — read for active sprint identification, item status counts, capacity usage (read-only)
- This skill is **read-only** — it never writes to `sprint-status.yaml`

### Cross-References

- **Story 17.9** (schema) — defines the section structure this skill reads
- **Story 17.13** (sprint-status-view) — detailed view counterpart; this skill is the quick-summary variant
- **Story 17.14** (cleanup-done) — done items are removed from the file; this skill should note items in `done/` for epic progress
- **Story 17.18** (bmad-dev-story) — updates item statuses that this skill reads

### Gotchas from Current Implementation

- The workflow has Step 0 (mode selection) which dispatches to different step ranges — keep this routing intact
- The current parsing in Step 2 is tightly coupled to the flat map format — the entire parsing action block needs replacement
- The "data" mode may return structured output consumed by other skills — ensure the output contract remains compatible
- The "validate" mode checks file integrity — update validation checks for new schema (e.g., ensure `epics`/`backlog`/`sprints` sections exist)
- Epic done/total counts currently scan the flat map — the new logic must scan `backlog`, `sprints[].items`, and `done/` folder

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD: FR133 (unified file), skill integration map (bmad-sprint-status = Light rework, read-only)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
