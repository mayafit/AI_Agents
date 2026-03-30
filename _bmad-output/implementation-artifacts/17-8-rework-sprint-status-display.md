# Story 17.8: Rework Sprint Status Display

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Project Manager**,
I want sprint status to show real sprint definitions with their assigned items and capacity usage,
So that I can see at a glance what's in each sprint and how much capacity remains.

## Acceptance Criteria

1. **Given** the sprint-status workflow is invoked,
   **When** the status is displayed,
   **Then** it shows:
   ```
   Sprint 3 (active) — 4/6 items
     * 5-5-explicit-parameter-passing [story] — in-progress
     * 5-6-fix-space-in-path-bug [story] — backlog
     * BUG-path-spaces [bug, high] — ready-for-dev
     * 15-1-bump-bmad-method [story] — backlog

   Backlog — 12 unassigned items
     1. 15-2-restructure-extension-module [story]
     2. 15-3-convert-custom-agents [story]
     ...
   ```

2. **Given** done items have been cleaned up (Story 17.6),
   **When** the sprint status is viewed,
   **Then** done items do NOT appear in the sprint or backlog sections,
   **And** a summary line shows: "X items completed this sprint".

3. **Given** the `sprint-status.yaml` file is generated,
   **When** it is written,
   **Then** it only contains non-done items in `development_status`,
   **And** sprint metadata is included in the header comments.

## Tasks / Subtasks

- [ ] Task 1: Rework sprint-status-view SKILL.md (AC: #1, #2)
  - [ ] 1.1: Rewrite `lib/bmad-extension/skills/sprint-status-view/SKILL.md` — replace the entire workflow with the new model. The current workflow reads from `sprint-plan-*.yaml` and `sprint-status.yaml` — the new version reads from `sprints/sprint-*.yaml`, `backlog.yaml`, and `bug-*.md`.
  - [ ] 1.2: Update YAML frontmatter (keep existing triggers: "sprint status view", "view sprint status")
  - [ ] 1.3: Implement new workflow steps:

    **Step 1: Run cleanup pre-step**
    - Suggest: "Consider running `/cleanup-done` first to archive completed items."
    - Do NOT auto-invoke cleanup — just advise

    **Step 2: Load all data sources**
    - Glob `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml` for sprint definitions
    - Read `_bmad-output/implementation-artifacts/backlog.yaml` for item details and priorities
    - Glob `_bmad-output/implementation-artifacts/bug-*.md` for bug metadata (fallback if not in backlog)
    - Read `_bmad-output/implementation-artifacts/sprint-status.yaml` for story status (fallback if not in backlog)
    - If no sprint files AND no backlog: display "No sprint data found. Run `/add-sprint` and `/generate-backlog` first." and exit

    **Step 3: Display each sprint (AC: #1)**
    - Sort sprints: `active` first, then `planning`, then `closed`
    - For each non-closed sprint:
      - Display sprint header: `{name} ({status}) — {items_count}/{capacity} items`
      - Display start/end dates if present
      - For each item in sprint `items` array:
        - Look up item in backlog.yaml for title, type, status, severity
        - If item not in backlog (data inconsistency): show raw ID with warning
        - Display with type tag: `[story]` or `[bug, {severity}]`
        - Display current status
      - Show capacity bar: `Capacity: {used}/{total} ({remaining} remaining)`
      - If over capacity: show warning
    - For closed sprints: show collapsed summary only — "{name} (closed) — {completed_count} items completed"

    **Step 4: Display completed items summary (AC: #2)**
    - Count items that are in sprint files but have status `done` (not yet cleaned up)
    - Count items in `done/` directory that were in this sprint (historical — may not be trackable if already archived)
    - Display: "Completed this sprint: {count} items" per active/planning sprint
    - If items with `done` status still exist in sprint files: display "Run `/cleanup-done` to archive {count} completed items"

    **Step 5: Display unassigned backlog (AC: #1)**
    - From backlog.yaml, filter items where `sprint` is `null`
    - Sort by priority ascending
    - Display: "Backlog — {count} unassigned items"
    - Show top 15 items with: Priority, ID, Title, Type, Status, Severity (for bugs)
    - If more than 15: show "... and {remaining} more items"

    **Step 6: Offer next actions**
    - Options:
      1. Show full unassigned backlog
      2. Assign items to sprint — `/add-to-sprint`
      3. Remove items from sprint — `/remove-from-sprint`
      4. Reprioritize backlog — `/prioritize-backlog`
      5. Create new sprint — `/add-sprint`
      6. Archive done items — `/cleanup-done`
      7. Exit

- [ ] Task 2: Rework sprint-status.yaml generation (AC: #3)
  - [ ] 2.1: Add a new step to the sprint-status-view SKILL.md (or create a separate internal protocol) that regenerates `sprint-status.yaml` from the current data sources:
    - Read `backlog.yaml` for all items with their current statuses
    - Read `sprints/sprint-*.yaml` for sprint membership
    - Generate `development_status` section containing ONLY non-done items
    - Preserve epic keys and retrospective keys from the existing file
    - Include sprint metadata in header comments:
      ```yaml
      # Sprint Status — derived from backlog.yaml + sprint files
      # Generated: {ISO timestamp}
      # Active sprint: sprint-{id} ({name})
      # Backlog items: {count}
      ```
    - Write to `sprint-status.yaml`, preserving STATUS DEFINITIONS comment block
  - [ ] 2.2: The regeneration should happen at the END of the sprint-status-view workflow (after display), so the YAML file reflects what was just shown
  - [ ] 2.3: Sprint-status.yaml is now officially a **derived file** — this story makes it generated, not manually maintained

- [ ] Task 3: Update sprint-status-template.yaml (AC: #3)
  - [ ] 3.1: Update `_bmad/bmm/4-implementation/bmad-sprint-planning/sprint-status-template.yaml` to include a note that sprint-status.yaml is now derived
  - [ ] 3.2: **Wait** — do NOT modify bmm core files. Instead, document in guardrails that the template is superseded by the generation logic in sprint-status-view

- [ ] Task 4: Update module-help.csv (AC: #1)
  - [ ] 4.1: Update the `sprint-status-view` row in `lib/bmad-extension/module-help.csv`:
    - Update `description` to: "View sprint status with capacity, items, and backlog. Regenerates sprint-status.yaml."

- [ ] Task 5: Sync or remove legacy workflow.md
  - [ ] 5.1: `lib/bmad-extension/workflows/sprint-status-view/workflow.md` is a legacy copy. Either:
    - Delete it if SKILL.md is the sole source of truth
    - Or add a redirect note

- [ ] Task 6: Update guardrails (AC: #3)
  - [ ] 6.1: Add to `sprint-management-guardrails.md`:
    - Sprint-Status.yaml Derivation section: document that it's now generated from backlog.yaml + sprint files
    - Document that manual edits to sprint-status.yaml will be overwritten on next generation
    - Document the generation trigger: `/sprint-status-view` regenerates the file after display

- [ ] Task 7: Verify (AC: #1, #2, #3)
  - [ ] 7.1: Verify sprint display reads from `sprints/sprint-*.yaml` and `backlog.yaml` (not `sprint-plan-*.yaml`)
  - [ ] 7.2: Verify done items do NOT appear in sprint or backlog display sections
  - [ ] 7.3: Verify completed items summary count is shown
  - [ ] 7.4: Verify sprint-status.yaml is regenerated with only non-done items
  - [ ] 7.5: Verify STATUS DEFINITIONS comment block is preserved in generated sprint-status.yaml
  - [ ] 7.6: Verify sprint metadata is in header comments
  - [ ] 7.7: Verify unassigned backlog shows items sorted by priority
  - [ ] 7.8: Verify closed sprints show collapsed summary only

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** `lib/bmad-extension/skills/sprint-status-view/SKILL.md` is resolved by `skill:sprint-status-view`
- **Extension module pattern:** Modifications stay in `lib/bmad-extension/skills/sprint-status-view/`
- **Derived file pattern:** `sprint-status.yaml` becomes a generated file — produced from backlog.yaml + sprint files
- **Display format:** Output must work well for both human reading and LLM parsing (per epics.md technical note)

### Data Flow

```
READ:  sprints/sprint-*.yaml → sprint definitions, items, capacity, status
READ:  backlog.yaml → item details (title, type, status, priority, sprint, severity)
READ:  bug-*.md → fallback bug metadata
READ:  sprint-status.yaml → fallback story status, epic/retro keys to preserve

WRITE: sprint-status.yaml → regenerated with non-done items only + sprint metadata headers
```

### sprint-status.yaml Becomes Derived

| Aspect | Current (Manual) | New (Derived) |
|---|---|---|
| Source of truth | Manually maintained | Generated from backlog.yaml + sprint files |
| Contains | All items including done | Only non-done items |
| Epic statuses | Manually set | Computed from story statuses |
| Generation trigger | Manual/sprint-planning | `/sprint-status-view` + `/sprint-planning` |
| Backward compat | N/A | Preserves STATUS DEFINITIONS block, epic keys, retro keys |

### Display Format (AC: #1)

```
=== Sprint 3 (active) — 4/6 items ===
Start: 2026-04-01 | End: 2026-04-14

  * 5-5-explicit-parameter-passing [story] — in-progress
  * 5-6-fix-space-in-path-bug [story] — ready-for-dev
  * BUG-path-spaces [bug, high] — ready-for-dev
  * 15-1-bump-bmad-method [story] — backlog

Capacity: 4/6 (2 remaining)
Completed this sprint: 0 items

=== Sprint 2 (closed) — 5 items completed ===

=== Backlog — 12 unassigned items ===
  1. 15-2-restructure-extension-module [story] — backlog
  2. 15-3-convert-custom-agents [story] — backlog
  3. BUG-auth-timeout [bug, medium] — backlog
  ... and 9 more items
```

### What Changes from Current sprint-status-view

| Aspect | Current (Epic 12) | New (Epic 17) |
|---|---|---|
| Sprint source | `sprint-plan-*.yaml` | `sprints/sprint-*.yaml` |
| Item details | Inferred from key + sprint-status.yaml + bug-*.md | `backlog.yaml` (single source) |
| Status source | sprint-status.yaml | backlog.yaml status field |
| Done handling | Shows all items | Hides done items, shows count |
| Backlog display | From sprint-status.yaml unassigned | From backlog.yaml where sprint is null |
| YAML regeneration | Not generated | sprint-status.yaml regenerated after display |
| Sprint metadata | Not shown | Included in header comments |

### Impact on Other Epic 17 Stories

- **17.1 (Sprint Entity):** Reads sprint files created by this format
- **17.2 (Flat Backlog):** Reads backlog.yaml as primary data source
- **17.6 (Done Item Cleanup):** Pre-step cleans done items before this displays
- **17.7 (Prioritization):** Backlog section shows items in priority order set by 17.7

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT read from `sprint-plan-*.yaml` (old format) — use `sprints/sprint-*.yaml`
- ALWAYS preserve STATUS DEFINITIONS comment block when regenerating sprint-status.yaml
- ALWAYS preserve epic keys and retrospective keys in sprint-status.yaml
- Done items MUST NOT appear in sprint or backlog display sections
- Sprint-status.yaml regeneration MUST happen after display (not before — display shows latest state)
- Closed sprints show collapsed summary only — do not expand item lists
- **Modify SKILL.md, not just workflow.md** — SKILL.md is the file invoked by skill resolution

### Project Structure Notes

- **Files to modify (primary):**
  - `lib/bmad-extension/skills/sprint-status-view/SKILL.md` — complete rewrite to new model **(authoritative)**
  - `lib/bmad-extension/skills/sprint-status-view/bmad-skill-manifest.yaml` — verify/update description
  - `lib/bmad-extension/module-help.csv` — update sprint-status-view description
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — document derived sprint-status.yaml
- **Files to modify (cleanup):**
  - `lib/bmad-extension/workflows/sprint-status-view/workflow.md` — delete or add redirect note
- **Files modified at runtime:**
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — regenerated with non-done items
- **Files NOT to touch:**
  - `_bmad/bmm/4-implementation/bmad-sprint-planning/sprint-status-template.yaml` (bmm core)
  - `_bmad/bmm/4-implementation/bmad-sprint-status/workflow.md` (bmm core)
  - Any files under `_bmad/core/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.8] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR71] — Sprint status shows real sprint definitions with assigned items
- [Source: _bmad-output/planning-artifacts/prd.md#FR130] — Done items removed from sprint status file
- [Source: _bmad-output/planning-artifacts/prd.md#NFR19] — Menu + slash command invocation
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Sprint YAML schema
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog YAML schema
- [Source: _bmad-output/implementation-artifacts/17-6-done-item-cleanup.md] — Done item archive process
- [Source: lib/bmad-extension/skills/sprint-status-view/SKILL.md] — Current workflow to rewrite
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration (skill:sprint-status-view)
- [Source: _bmad-output/implementation-artifacts/done/12-4-sprint-status-assigned-items.md] — Original Epic 12 story

### Git Intelligence

Recent commits show Epic 15/16 patterns:
- Conventional commit format: `feat(epic-17): story 17-8 rework sprint status display`
- Complete SKILL.md rewrites are acceptable when the model fundamentally changes

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
