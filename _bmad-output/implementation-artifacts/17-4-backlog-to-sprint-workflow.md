# Story 17.4: Backlog-to-Sprint Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want a workflow to move items from the backlog into a sprint,
So that I can populate sprints by selecting prioritized items across epics.

## Acceptance Criteria

1. **Given** the backlog contains unassigned items (no `sprint` field or `sprint: null`),
   **When** the Scrum Master invokes the assign-to-sprint workflow,
   **Then** it displays the active or planning sprint and its current capacity usage,
   **And** shows the top N unassigned backlog items in priority order,
   **And** the Scrum Master selects which items to add.

2. **Given** the Scrum Master selects items for the sprint,
   **When** the items are assigned,
   **Then** each item's `sprint` field in `backlog.yaml` is set to the sprint ID,
   **And** the sprint file's `items` array is updated with the new IDs,
   **And** the workflow validates that capacity is not exceeded — warns if over capacity.

3. **Given** the workflow is invoked via menu or slash command,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

- [ ] Task 1: Rework add-to-sprint SKILL.md to use backlog + sprint model (AC: #1, #2, #3)
  - [ ] 1.1: Rewrite `lib/bmad-extension/skills/add-to-sprint/SKILL.md` — replace the entire workflow with the new model. The current workflow reads from `sprint-status.yaml` and `sprint-plan-*.yaml` — the new version reads from `backlog.yaml` and `sprints/sprint-*.yaml`.
  - [ ] 1.2: Update YAML frontmatter triggers (keep existing triggers: "add to sprint", "assign to sprint")
  - [ ] 1.3: Implement new workflow steps:

    **Step 1: Load backlog and identify unassigned items**
    - Read `_bmad-output/implementation-artifacts/backlog.yaml`
    - Filter items where `sprint` is `null` (unassigned)
    - Sort by `priority` ascending (highest priority first)
    - If no unassigned items: display "All backlog items are assigned to sprints" and exit

    **Step 2: Load sprints and select target**
    - Glob `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml` to find all sprint files
    - If no sprint files found: display "No sprints exist. Run `/add-sprint` first." and exit
    - Read each sprint file; extract: id, name, status, capacity, items count
    - Display sprints table sorted by status (`active` first, then `planning`, then `closed`)
    - If exactly one `active` sprint exists: auto-select it, confirm with user
    - If no `active` sprint but `planning` sprints exist: prompt user to select
    - Closed sprints are shown but not selectable

    **Step 3: Display sprint capacity and unassigned items**
    - Calculate: assigned = length of sprint.items, remaining = capacity - assigned
    - Display sprint capacity bar
    - Display top 20 unassigned backlog items (or all if fewer than 20) with columns: #, ID, Title, Type, Priority, Severity (bugs only)
    - If remaining capacity <= 0: warn "Sprint is at capacity" but allow override

    **Step 4: Select items to assign**
    - Prompt: "Select items to add (comma-separated numbers, 'all' for all shown, or 'q' to cancel)"
    - If 'q': exit without changes
    - Validate selections are valid numbers from the displayed list

    **Step 5: Capacity check and assignment**
    - For each selected item, check if adding would exceed capacity
    - If over capacity: warn with exact count, offer [a]dd anyway / [s]kip this item / [q]uit
    - For each confirmed item:
      - Add item ID to sprint file's `items` array
      - Set item's `sprint` field in `backlog.yaml` to sprint ID
      - Update sprint file's `last_modified` timestamp

    **Step 6: Persist and report**
    - Write updated `backlog.yaml` (preserving all fields, only `sprint` changed for assigned items)
    - Write updated sprint file (with new items and last_modified)
    - Display summary: items assigned, new capacity usage, remaining slots

- [ ] Task 2: Update bmad-skill-manifest.yaml (AC: #3)
  - [ ] 2.1: Verify/update `lib/bmad-extension/skills/add-to-sprint/bmad-skill-manifest.yaml` description to reflect new model

- [ ] Task 3: Update module-help.csv (AC: #3)
  - [ ] 3.1: Update the `add-to-sprint` row in `lib/bmad-extension/module-help.csv`:
    - Update `output-location` from `_bmad-output/implementation-artifacts` to `_bmad-output/implementation-artifacts` (unchanged path but now writes to both backlog.yaml and sprints/)
    - Update `description` to: "Assign backlog items to a sprint from flat prioritized backlog."

- [ ] Task 4: Sync or remove legacy workflow.md (AC: #3)
  - [ ] 4.1: `lib/bmad-extension/workflows/add-to-sprint/workflow.md` is a legacy copy. Either:
    - Delete it if SKILL.md is the sole source of truth (verify via module-help.csv `skill:add-to-sprint` resolution)
    - Or add a redirect note: "This workflow has moved to `skills/add-to-sprint/SKILL.md`"

- [ ] Task 5: Update guardrails (AC: #2)
  - [ ] 5.1: Update `sprint-management-guardrails.md` Data Authority Rules:
    - `backlog.yaml` is now written by add-to-sprint (sets `sprint` field)
    - Sprint files under `sprints/` are now written by add-to-sprint (appends to `items` array)
  - [ ] 5.2: Document the dual-write contract: when assigning an item, BOTH `backlog.yaml` AND the sprint file must be updated atomically (within same workflow invocation). If one fails, the other must be rolled back or the user must be warned.

- [ ] Task 6: Verify (AC: #1, #2, #3)
  - [ ] 6.1: Trace SKILL.md — confirm all paths read from `backlog.yaml` and `sprints/sprint-*.yaml` (never from `sprint-plan-*.yaml` or `sprint-status.yaml`)
  - [ ] 6.2: Verify capacity enforcement: warn when exceeding, allow override
  - [ ] 6.3: Verify dual-write: both backlog.yaml `sprint` field and sprint file `items` array are updated
  - [ ] 6.4: Verify `last_modified` timestamp is updated on sprint file
  - [ ] 6.5: Verify item IDs in sprint `items` array follow the Item ID Format Contract from Story 17.1
  - [ ] 6.6: Verify closed sprints are not selectable as targets

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` is resolved by `skill:add-to-sprint` in module-help.csv
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/add-to-sprint/`
- **Dual-write pattern:** This workflow writes to TWO files per assignment — `backlog.yaml` and `sprints/sprint-{id}.yaml`. Both must be consistent.
- **No sprint-status.yaml writes:** This workflow does NOT touch sprint-status.yaml. That file is derived (Story 17.8).

### Data Flow

```
READ:  backlog.yaml → unassigned items (sprint: null)
READ:  sprints/sprint-*.yaml → available sprints + capacity
WRITE: backlog.yaml → set sprint field on assigned items
WRITE: sprints/sprint-{id}.yaml → append to items array, update last_modified
```

### What Changes from Current add-to-sprint

| Aspect | Current (Epic 12) | New (Epic 17) |
|---|---|---|
| Item source | sprint-status.yaml + bug-*.md glob | backlog.yaml (single source) |
| Sprint source | sprint-plan-*.yaml | sprints/sprint-*.yaml |
| Sprint discovery glob | `sprint-plan-*.yaml` | `sprints/sprint-*.yaml` |
| Assignment tracking | Only in sprint-plan file | Both backlog.yaml and sprint file |
| Prioritization | Multi-criteria analysis in workflow | Pre-computed priority in backlog.yaml |
| Unassigned filter | Cross-reference all sprint files | Simple: `sprint: null` in backlog.yaml |

### Impact on Other Epic 17 Stories

- **17.1 (Sprint Entity):** Provides the sprint file format this story writes to
- **17.2 (Flat Backlog):** Provides the backlog.yaml format this story reads/writes
- **17.5 (Sprint-to-Backlog):** Inverse operation — removes items this story assigns
- **17.6 (Done Item Cleanup):** Removes done items from both backlog and sprint files
- **17.8 (Sprint Status Display):** Reads the sprint files this story writes

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify `sprint-status.yaml` — it is derived and read-only from this workflow
- Do NOT read from `sprint-plan-*.yaml` (old format) — use `sprints/sprint-*.yaml` exclusively
- ALWAYS update both `backlog.yaml` AND the sprint file when assigning items
- ALWAYS update `last_modified` on the sprint file after modification
- Item IDs in sprint `items` array MUST follow the Item ID Format Contract: `{epic}-{story}-{slug}` for stories, `BUG-{slug}` for bugs
- Closed sprints MUST NOT be selectable as assignment targets
- **Modify SKILL.md, not just workflow.md** — SKILL.md is the file invoked by skill resolution

### Project Structure Notes

- **Files to modify (primary):**
  - `lib/bmad-extension/skills/add-to-sprint/SKILL.md` — complete rewrite to new model **(authoritative)**
  - `lib/bmad-extension/skills/add-to-sprint/bmad-skill-manifest.yaml` — verify/update description
  - `lib/bmad-extension/module-help.csv` — update add-to-sprint description
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — update data authority rules
- **Files to modify (cleanup):**
  - `lib/bmad-extension/workflows/add-to-sprint/workflow.md` — delete or add redirect note
- **Files NOT to touch:**
  - `sprint-status.yaml` (derived, read-only)
  - `sprint-plan-*.yaml` (old format, deprecated)
  - Any files under `_bmad/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.4] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR69] — Workflow to move items from backlog into sprint
- [Source: _bmad-output/planning-artifacts/prd.md#FR66] — Sprint capacity as item count
- [Source: _bmad-output/planning-artifacts/prd.md#NFR19] — Menu + slash command invocation
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Sprint YAML schema, Item ID Format Contract, capacity enforcement
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog YAML schema, sprint field contract
- [Source: lib/bmad-extension/skills/add-to-sprint/SKILL.md] — Current workflow to rewrite
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration (skill:add-to-sprint)
- [Source: _bmad-output/implementation-artifacts/done/12-2-add-to-sprint-workflow.md] — Original Epic 12 story for reference

### Git Intelligence

Recent commits show Epic 15/16 patterns:
- Conventional commit format: `feat(epic-17): story 17-4 backlog-to-sprint workflow`
- Complete SKILL.md rewrites are acceptable when the model fundamentally changes

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
