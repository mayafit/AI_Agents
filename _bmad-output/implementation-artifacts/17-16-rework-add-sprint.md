# Story 17.16: Rework add-sprint Skill (Moderate Rework — Section-Based)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `add-sprint` skill to create a new sprint entry in the `sprints` section of `sprint-status.yaml`,
So that new sprints are defined within the unified file rather than as separate files.

## Acceptance Criteria

1. **Given** the Scrum Master invokes `add-sprint`,
   **When** the sprint details are provided (name, capacity, optional ISO start/end dates),
   **Then** a new sprint entry is appended to the `sprints` map in `sprint-status.yaml`:
   ```yaml
   sprints:
     sprint-4:
       name: "Sprint 4"
       status: planning
       capacity: 6
       start: "2026-04-15"
       end: "2026-04-28"
       items: []
   ```
   **And** the sprint ID is auto-incremented from the highest existing sprint ID.

2. **Given** a sprint with `status: planning` already exists,
   **When** a new sprint is created,
   **Then** the new sprint is also created with `status: planning` (multiple planning sprints are allowed),
   **And** only one sprint can be `active` at a time.

3. **Given** `sprint-status.yaml` does not exist,
   **When** `add-sprint` is invoked,
   **Then** the skill reports: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

## Tasks / Subtasks

- [ ] Task 1: Read and understand the current add-sprint skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/add-sprint/SKILL.md` to understand current I/O pattern
  - [ ] 1.2 Document the current output: creates standalone `sprints/sprint-N.yaml` files
  - [ ] 1.3 Identify the input gathering flow (sprint number, name, capacity, dates)

- [ ] Task 2: Modify the output target to unified sprint-status.yaml (AC: 1, 3)
  - [ ] 2.1 Replace `Write sprints/sprint-N.yaml` with `Read-modify-write sprint-status.yaml`
  - [ ] 2.2 Handle missing sprint-status.yaml: report error and suggest running sprint-planning
  - [ ] 2.3 Read existing `sprints` section from sprint-status.yaml
  - [ ] 2.4 Append new sprint entry to the `sprints` map

- [ ] Task 3: Implement sprint ID auto-increment (AC: 1)
  - [ ] 3.1 Parse existing sprint IDs from the `sprints` section (e.g., `sprint-1`, `sprint-3`)
  - [ ] 3.2 Find the highest numeric suffix
  - [ ] 3.3 Auto-increment: new sprint ID = `sprint-{max + 1}`
  - [ ] 3.4 Allow user override of the sprint number if desired

- [ ] Task 4: Validate sprint constraints (AC: 2)
  - [ ] 4.1 Multiple `planning` sprints are allowed — no constraint needed
  - [ ] 4.2 Only one `active` sprint at a time — new sprints always start as `planning`, so this constraint is satisfied by default
  - [ ] 4.3 Validate the sprint ID does not already exist in the `sprints` section

- [ ] Task 5: Preserve existing file content (AC: 1)
  - [ ] 5.1 Read-modify-write pattern: read entire sprint-status.yaml, add new sprint, write back
  - [ ] 5.2 Preserve `epics` section unchanged
  - [ ] 5.3 Preserve `backlog` section unchanged
  - [ ] 5.4 Preserve existing `sprints` entries unchanged
  - [ ] 5.5 Update `last_updated` timestamp

- [ ] Task 6: Simplify input gathering (AC: 1)
  - [ ] 6.1 Keep the existing input gathering flow (number, name, capacity, dates, confirmation)
  - [ ] 6.2 Remove the sprint number prompt — auto-increment by default, prompt only for override
  - [ ] 6.3 Remove the smart name detection from existing sprint files (now reads from sprints section)
  - [ ] 6.4 Remove the old-format file advisory check (sprint-plan-N.yaml)

- [ ] Task 7: Remove old file creation (AC: 1, 3)
  - [ ] 7.1 Remove the step that creates `sprints/sprint-N.yaml` file
  - [ ] 7.2 Remove the `sprints/` directory creation step
  - [ ] 7.3 Remove the overwrite-protection check for standalone sprint files

- [ ] Task 8: Update summary output (AC: 1-3)
  - [ ] 8.1 Update output to reference sprint-status.yaml instead of individual sprint files
  - [ ] 8.2 Show the new sprint's position in the `sprints` section
  - [ ] 8.3 Update next-steps references

## Dev Notes

### What This Story Changes vs Current Behavior

**Current behavior:** The add-sprint skill gathers sprint details (number, name, capacity, dates) through a guided workflow, then writes a standalone YAML file at `_bmad-output/implementation-artifacts/sprints/sprint-N.yaml`. It checks for existing files, handles overwrite protection, and includes smart name detection from existing sprint files.

**New behavior:** The skill gathers the same sprint details but writes the new sprint as an entry in the `sprints` section of `sprint-status.yaml`. No standalone file is created. Sprint ID is auto-incremented from the highest existing sprint ID in the map. The file must already exist (created by sprint-planning).

### Key Differences

- **Output target:** Standalone `sprints/sprint-N.yaml` -> entry in `sprint-status.yaml` `sprints` section
- **No file creation:** No `sprints/` directory, no individual sprint files
- **Auto-increment ID:** Derived from existing sprints in the unified file, not from globbing sprint files
- **File must exist:** sprint-status.yaml must already exist (bootstrapped by sprint-planning). No implicit creation.
- **Read-modify-write:** Must preserve all existing content in sprint-status.yaml

### Skill File(s) to Modify

- `.claude/skills/add-sprint/SKILL.md` — rewrite of data output steps; input gathering flow largely preserved

### Unified Schema Sections Touched

- **`sprints`** — write (append new sprint entry with empty `items: []`)
- **`epics`** — preserved unchanged
- **`backlog`** — preserved unchanged

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified schema
- **Story 17.15** (prerequisite): bmad-sprint-planning bootstraps the file; add-sprint requires it to exist
- **Story 17.11** (downstream): add-to-sprint assigns items to sprints created by this skill
- **Story 17.17** (downstream): modify-sprint updates sprint metadata created by this skill
- **Story 12.1** (original): This skill was originally created in Epic 12

### Gotchas from Current Implementation

1. The current skill creates a `sprints/` directory and writes individual files. The new skill must NOT create any directory — it writes to the existing sprint-status.yaml.
2. The current skill has overwrite protection checking if `sprints/sprint-N.yaml` exists. The new skill should check if the sprint ID already exists in the `sprints` map instead.
3. The current skill has a "smart default name" feature that reads existing sprint files for naming patterns. This can be adapted to read from the `sprints` section of sprint-status.yaml instead.
4. The current skill includes `created_date` and `last_modified` fields on the sprint entity. The new schema does not include these per-sprint — only the file-level `last_updated` timestamp exists.
5. The current skill writes `start` and `end` as empty strings `""` when skipped. The new schema should use the same convention or null — match Story 17.9's schema definition.
6. Sprint ID format: `sprint-{number}` (kebab-case). This is consistent with both old and new models.

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD FR68 (add-sprint workflow), FR66 (capacity by item count)

### Project Structure Notes
- Skill files are in `.claude/skills/add-sprint/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
