# Story 17.15: Rework bmad-sprint-planning Skill (Heavy Rework — Bootstrap Unified File)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `bmad-sprint-planning` skill to bootstrap or update the unified `sprint-status.yaml` from the epics document,
So that sprint planning always starts from a complete, consistent single file.

## Acceptance Criteria

1. **Given** no `sprint-status.yaml` exists (first-time setup),
   **When** the Scrum Master invokes `bmad-sprint-planning`,
   **Then** it creates `sprint-status.yaml` with:
     - `epics` section populated from `epics.md` (all epics with title, status, story counts)
     - `backlog` section populated with all non-done stories and bugs in priority order
     - `sprints` section initialized as an empty array `[]`

2. **Given** `sprint-status.yaml` already exists,
   **When** the Scrum Master invokes `bmad-sprint-planning`,
   **Then** the `epics` section is refreshed from `epics.md` (new epics added, counts updated),
   **And** new stories from `epics.md` that don't exist in `backlog` or any `sprints` section are added to `backlog`,
   **And** existing items in `backlog` and `sprints` sections are NOT modified (preserves status, priority, sprint assignments),
   **And** done items are NOT reintroduced (they stay in the `done/` archive).

3. **Given** the sprint-planning workflow includes cleanup,
   **When** it detects items with `status: done` still in the file,
   **Then** it runs the cleanup-done logic (Story 17.14) as part of the planning workflow.

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current bmad-sprint-planning skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/bmad-sprint-planning/SKILL.md` and `.claude/skills/bmad-sprint-planning/workflow.md`
  - [ ] 1.2 Document the current output: flat `development_status` map in sprint-status.yaml
  - [ ] 1.3 Identify the epic parsing logic, story detection, and status preservation rules

- [ ] Task 2: Implement first-time bootstrap (AC: 1)
  - [ ] 2.1 Detect when no sprint-status.yaml exists
  - [ ] 2.2 Parse `epics.md` to extract all epics and their stories
  - [ ] 2.3 Build the `epics` section: map keyed by `epic-N` with `status` and `retrospective` fields
  - [ ] 2.4 Build the `backlog` section: array of all non-done stories and bugs in priority order
  - [ ] 2.5 Initialize the `sprints` section as an empty map `{}`
  - [ ] 2.6 Add top-level metadata: `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`
  - [ ] 2.7 Write the complete file

- [ ] Task 3: Implement refresh/update mode (AC: 2)
  - [ ] 3.1 Read existing sprint-status.yaml
  - [ ] 3.2 Refresh the `epics` section from epics.md (fully regenerated — reference data)
  - [ ] 3.3 Build a set of all item IDs currently in the file (across `backlog` and all `sprints[].items`)
  - [ ] 3.4 Build a set of all item IDs in the `done/` folder (archived items)
  - [ ] 3.5 Parse epics.md for all stories; identify items NOT in any of the above sets
  - [ ] 3.6 Add newly discovered items to the `backlog` section (append at end, assign new priority numbers)
  - [ ] 3.7 Preserve existing `backlog` items unchanged (status, priority)
  - [ ] 3.8 Preserve existing `sprints` section unchanged (sprint entities, items, statuses)
  - [ ] 3.9 Update `last_updated` timestamp

- [ ] Task 4: Integrate cleanup-done logic (AC: 3)
  - [ ] 4.1 Before the refresh/update, scan for items with `status: done` in the file
  - [ ] 4.2 If found, invoke the cleanup-done logic (or suggest running it)
  - [ ] 4.3 This ensures done items are archived before new items are added

- [ ] Task 5: Story ID generation and epic parsing (AC: 1, 2)
  - [ ] 5.1 Parse epic headers from epics.md (`## Epic N: Title`)
  - [ ] 5.2 Parse story entries (`### Story N.M: Title`)
  - [ ] 5.3 Generate kebab-case story IDs: `{epic}-{story}-{title-slug}`
  - [ ] 5.4 Detect story status from story file existence (file exists -> `ready-for-dev`)
  - [ ] 5.5 Preserve higher statuses from existing data (never downgrade)

- [ ] Task 6: Handle bugs (AC: 1, 2)
  - [ ] 6.1 Glob for `bug-*.md` files in implementation-artifacts
  - [ ] 6.2 Parse YAML frontmatter for title, severity, status
  - [ ] 6.3 Add bugs to `backlog` section with `type: bug`, `epic: null`

- [ ] Task 7: Rewrite the skill files (AC: 1-3)
  - [ ] 7.1 Rewrite `.claude/skills/bmad-sprint-planning/workflow.md` with the new logic
  - [ ] 7.2 Update `.claude/skills/bmad-sprint-planning/SKILL.md` description if needed
  - [ ] 7.3 Remove any references to the old flat `development_status` format

- [ ] Task 8: Validation and reporting (AC: 1-3)
  - [ ] 8.1 Validate the output file is valid YAML
  - [ ] 8.2 Validate every epic in epics.md has an entry in the `epics` section
  - [ ] 8.3 Validate every story appears in exactly one location (backlog, sprint, or done/)
  - [ ] 8.4 Report: total epics, total stories, new items added, existing preserved, done archived

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The bmad-sprint-planning skill creates or updates a `sprint-status.yaml` file with a flat `development_status` map. Each epic, story, and retrospective is a top-level key with a status value. The file has header comments with status definitions and metadata. Story status is detected from file existence (story file exists -> ready-for-dev) and preserved from existing data (never downgraded).

**New behavior:** The skill creates or updates a `sprint-status.yaml` file with three structured sections: `epics` (map), `backlog` (array), and `sprints` (map). The flat `development_status` section is entirely replaced. On first run, it bootstraps the complete file. On subsequent runs, it refreshes the `epics` section and adds new stories to `backlog` while preserving everything else.

### Key Differences

- **Output format:** Flat `development_status` map -> structured `epics`/`backlog`/`sprints` sections
- **Retrospective tracking:** Moved into the `epics` section as a field on each epic entry
- **Sprint awareness:** The old skill had no concept of sprints in its output. The new skill preserves the `sprints` section (which is managed by other skills like add-sprint, add-to-sprint).
- **Merge strategy on update:** Instead of updating status values in a flat map, must merge new items into the `backlog` array without disturbing existing `backlog` items or `sprints` data
- **Done exclusion:** Must check the `done/` folder to avoid reintroducing archived items

### Skill File(s) to Modify

- `.claude/skills/bmad-sprint-planning/SKILL.md` — update description
- `.claude/skills/bmad-sprint-planning/workflow.md` — complete rewrite of workflow logic

### Unified Schema Sections Touched

- **`epics`** — full regeneration from epics.md (this section is reference data, always overwritten)
- **`backlog`** — read (preserve existing items) + write (add new items from epics.md)
- **`sprints`** — read (identify sprint-assigned items for exclusion) + preserve unchanged
- **Top-level metadata** — `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema this skill bootstraps
- **Story 17.10** (downstream): generate-backlog refreshes the backlog section; sprint-planning creates the initial version
- **Story 17.14** (integration): cleanup-done logic may be invoked during planning to archive done items
- **Story 17.16** (downstream): add-sprint creates sprints in the `sprints` section that this skill preserves
- **Execution order**: This is the FIRST skill to run after the schema is defined (17.9 -> 17.15)

### Gotchas from Current Implementation

1. The current workflow.md is extensive (~265 lines) with a complex epic parsing and status detection workflow. The parsing logic can be largely reused, but the output format changes completely.
2. The current skill writes metadata both as YAML comments and as key-value fields (dual metadata). The new schema uses only key-value fields for metadata.
3. The current skill's status detection (story file exists -> ready-for-dev) should still work, but the output target changes from `development_status[key]: status` to `backlog[index].status: status`.
4. The `epics` section is always fully regenerated (it's reference data). But the `backlog` section must carefully merge: preserve existing items, add new items, never reintroduce done items.
5. The `sprints` section is completely untouched by this skill — it just preserves whatever is already there.
6. Config loading from `_bmad/bmm/config.yaml` should be preserved for path resolution.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR133 (unified file), FR134 (movement semantics)

### Project Structure Notes
- Skill files are in `.claude/skills/bmad-sprint-planning/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics source at `_bmad-output/planning-artifacts/epics.md`
- Done archive at `_bmad-output/implementation-artifacts/done/`
- Config at `_bmad/bmm/config.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
