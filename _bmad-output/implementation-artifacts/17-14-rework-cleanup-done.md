# Story 17.14: Rework cleanup-done Skill (Heavy Rework — Single Source)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `cleanup-done` skill to scan the unified `sprint-status.yaml` for done items, remove them from the file, and archive their story files,
So that the active sprint view stays clean and done work is preserved in the archive.

## Acceptance Criteria

1. **Given** items with `status: done` exist in the `sprints` section of `sprint-status.yaml`,
   **When** the `cleanup-done` skill is invoked,
   **Then** each done item is REMOVED from its sprint's `items` array (FR136),
   **And** the corresponding story/bug file is moved to `{implementation_artifacts}/done/` (FR131),
   **And** if the `done/` subfolder doesn't exist, it is created.

2. **Given** items with `status: done` exist in the `backlog` section (edge case -- done but never sprint-assigned),
   **When** the `cleanup-done` skill is invoked,
   **Then** those items are also REMOVED from the `backlog` array and their files archived.

3. **Given** a story file exists at `{implementation_artifacts}/{story-id}.md`,
   **When** the story reaches `done` status and cleanup runs,
   **Then** the file is moved to `{implementation_artifacts}/done/{story-id}.md`.

4. **Given** a bug file exists at `{implementation_artifacts}/BUG-{title}.md`,
   **When** the bug reaches `done` status and cleanup runs,
   **Then** the file is moved to `{implementation_artifacts}/done/BUG-{title}.md`.

5. **Given** all items in a sprint reach `done` status and are cleaned up,
   **When** the sprint has zero remaining items,
   **Then** the sprint's `items` array is empty but the sprint definition is preserved (historical record),
   **And** the skill suggests closing the sprint (see Story 17.21).

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current cleanup-done skill (AC: 1-5)
  - [ ] 1.1 Read `.claude/skills/cleanup-done/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current three-source scan: sprint-status.yaml (status), backlog.yaml (items), sprint-*.yaml (sprint items)
  - [ ] 1.3 Identify the file move and backlog/sprint update steps

- [ ] Task 2: Modify the done-item scan to single file (AC: 1, 2)
  - [ ] 2.1 Replace the three-source scan with a single read of `sprint-status.yaml`
  - [ ] 2.2 Scan the `sprints` section: for each sprint, find items where `status: done`
  - [ ] 2.3 Scan the `backlog` section: find items where `status: done` (edge case)
  - [ ] 2.4 Optionally scan `bug-*.md` files for bugs with `status: done` that are not yet tracked in sprint-status.yaml
  - [ ] 2.5 Deduplicate and build the done items list

- [ ] Task 3: Implement file archival (AC: 3, 4)
  - [ ] 3.1 Ensure `done/` directory exists (create if not)
  - [ ] 3.2 For stories: move `{id}.md` to `done/{id}.md`
  - [ ] 3.3 For bugs: move `bug-{slug}.md` or `BUG-{slug}.md` to `done/` (handle naming variants)
  - [ ] 3.4 Use rename/move (not copy+delete)
  - [ ] 3.5 Handle missing source files gracefully (log warning, skip)
  - [ ] 3.6 Handle existing destination files gracefully (log warning, skip — do not overwrite)

- [ ] Task 4: Remove done items from sprint-status.yaml (AC: 1, 2, 5)
  - [ ] 4.1 Remove done items from their sprint's `items` array
  - [ ] 4.2 Remove done items from the `backlog` array
  - [ ] 4.3 Re-number backlog priorities if items were removed from backlog
  - [ ] 4.4 Preserve sprint definitions even if all items are removed (empty `items: []`)
  - [ ] 4.5 Update `last_updated` timestamp
  - [ ] 4.6 Single atomic write to sprint-status.yaml

- [ ] Task 5: Suggest sprint closure when empty (AC: 5)
  - [ ] 5.1 After cleanup, check if any sprint now has an empty `items` array
  - [ ] 5.2 If so, suggest: "Sprint {name} has no remaining items. Consider running close-sprint (Story 17.21)."

- [ ] Task 6: Remove old multi-file update logic (AC: 1-5)
  - [ ] 6.1 Remove the step that writes to separate `sprints/sprint-N.yaml` files
  - [ ] 6.2 Remove the step that writes to `backlog.yaml`
  - [ ] 6.3 Remove the step that updates the old `development_status` section of sprint-status.yaml
  - [ ] 6.4 Replace with single write to sprint-status.yaml

- [ ] Task 7: Update summary output (AC: 1-5)
  - [ ] 7.1 Report: files moved, items removed from sprints, items removed from backlog
  - [ ] 7.2 Flag sprints that became empty
  - [ ] 7.3 Update next-steps references

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The cleanup-done skill scans three sources for done items: `sprint-status.yaml` (flat `development_status` section), `backlog.yaml` (items with status done), and `bug-*.md` frontmatter. It then performs three separate file updates: (1) removes IDs from sprint files, (2) removes items from backlog.yaml and re-numbers priorities, (3) removes entries from sprint-status.yaml's `development_status` section. File archival moves story/bug files to `done/`.

**New behavior:** The skill reads a single `sprint-status.yaml` to find all done items (in both `sprints[].items` and `backlog` sections). It removes them from the file in a single atomic write. File archival to `done/` is unchanged. The old backlog.yaml and sprint-*.yaml writes are eliminated.

### Key Differences

- **Single source scan:** One file read instead of three
- **Single file write:** One atomic write to sprint-status.yaml instead of three separate writes
- **No `development_status` cleanup:** The old flat status section no longer exists
- **Backlog priority re-numbering:** Still needed if done items existed in the backlog section
- **Sprint preservation:** Empty sprints keep their definition (historical record) — only items are removed

### Skill File(s) to Modify

- `.claude/skills/cleanup-done/SKILL.md` — complete rewrite of workflow steps

### Unified Schema Sections Touched

- **`sprints`** — read (find done items in `items` arrays) + write (remove done items)
- **`backlog`** — read (find done items) + write (remove done items, re-number priorities)
- **File system** — move story/bug files from implementation-artifacts to done/ subfolder

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema
- **Story 17.15** (related): bmad-sprint-planning may invoke cleanup as part of its planning workflow
- **Story 17.21** (downstream): close-sprint handles full sprint lifecycle closure; cleanup-done is the archival step
- **FR131** (file archival), **FR136** (done removal)

### Gotchas from Current Implementation

1. The current skill auto-closes active sprints when all items are removed. The new behavior should NOT auto-close — it should suggest closure and let the Scrum Master decide (Story 17.21 handles close-sprint).
2. The current skill removes entries from `development_status` section. This section no longer exists in the new schema — skip this step entirely.
3. The current skill re-numbers priorities in backlog.yaml after removal. This still applies to the `backlog` array in the unified file.
4. The current skill marks epics as `done` when all their stories are removed. In the new model, epic status is managed in the `epics` section and should be updated when the last story of an epic is archived.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR131 (file archival to done/), FR136 (done item removal from tracking)

### Project Structure Notes
- Skill files are in `.claude/skills/cleanup-done/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Done archive at `_bmad-output/implementation-artifacts/done/`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
