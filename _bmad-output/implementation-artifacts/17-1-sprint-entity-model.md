# Story 17.1: Sprint Entity Model

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want sprints defined as first-class YAML entities with capacity, assigned items, and status,
So that sprint planning is based on real sprint definitions, not just a flat status list.

## Acceptance Criteria

1. **Given** the Scrum Master creates a sprint,
   **When** the sprint is persisted,
   **Then** a YAML file is created at `{implementation_artifacts}/sprints/sprint-{id}.yaml` containing:
   ```yaml
   id: sprint-3
   name: "Sprint 3"
   status: planning  # planning | active | closed
   capacity: 6       # max items (stories + bugs)
   start: "2026-04-01"   # optional, ISO YYYY-MM-DD or empty string
   end: "2026-04-14"     # optional, ISO YYYY-MM-DD or empty string
   items: []             # assigned story/bug IDs
   created_date: "2026-03-28T10:00:00Z"
   last_modified: "2026-03-28T10:00:00Z"
   ```
   **And** `created_date` and `last_modified` are ISO timestamps for concurrency guards (required by modify-sprint workflow).

2. **[Contract — enforced by Story 17.4]** **Given** a sprint has items assigned (via backlog-to-sprint workflow),
   **When** the sprint file is read,
   **Then** `items` contains an ordered list of item IDs using these formats:
   - Story IDs: `{epic}-{story}-{slug}` (e.g., `"5-5-explicit-parameter-passing"`)
   - Bug IDs: `BUG-{slug}` (e.g., `"BUG-path-spaces"`)
   **And** the count of items never exceeds `capacity`.
   **Note:** This AC defines the contract for `items`. Within this story, `items` is always `[]` because add-sprint creates empty sprints. Capacity enforcement is implemented by Story 17.4 (backlog-to-sprint).

3. **[Contract — activation path delivered by modify-sprint rework]** **Given** a sprint transitions from `planning` to `active`,
   **When** the sprint is activated,
   **Then** only one sprint can be `active` at a time,
   **And** the previous active sprint (if any) must be `closed` first.
   **Note:** This story defines and documents the single-active constraint and the full state transition matrix. The add-sprint workflow always creates sprints in `planning` status. The activation path (setting status to `active`) is delivered when modify-sprint is reworked in a later story.

   **Valid state transitions (full matrix):**
   - `planning` -> `active` (requires no other active sprint)
   - `active` -> `closed`
   - All other transitions are **invalid**: `closed` -> `active`, `closed` -> `planning`, `active` -> `planning`, and direct creation in `active` or `closed` status.

## Tasks / Subtasks

- [ ] Task 1: Create sprints directory structure (AC: #1)
  - [ ] 1.1: Create `_bmad-output/implementation-artifacts/sprints/` directory with `.gitkeep`
  - [ ] 1.2: Check for existing `sprint-plan-*.yaml` files at the old path (`_bmad-output/implementation-artifacts/`). If any exist, add a note to the story completion log documenting them. Do NOT auto-migrate.

- [ ] Task 2: Rework add-sprint SKILL.md to new YAML schema (AC: #1)
  - [ ] 2.1: Update `lib/bmad-extension/skills/add-sprint/SKILL.md` step 1 to gather sprint number as a positive integer:
    - Validate: must match `^[1-9]\d*$` (positive integer, no leading zeros, no non-numeric)
    - Reject zero, negative, non-numeric, and leading-zero inputs (e.g., `03`) with error and re-prompt
    - Add reasonable upper bound: sprint number <= 9999
    - Construct ID as `sprint-{number}` (e.g., user enters `3` -> ID is `sprint-3`)
  - [ ] 2.2: Capacity validation (step 2) — retain existing positive-integer validation unchanged
  - [ ] 2.3: Rework step 3 for `start` and `end` dates:
    - Dates are **optional** (press Enter to skip -> stored as empty string `""`)
    - When provided, validate ISO format via regex `^\d{4}-\d{2}-\d{2}$` AND verify it resolves to a real calendar date (reject `2026-02-30`, `2026-13-45`, etc.)
    - If invalid, display error and re-prompt for that field
    - If both dates provided, validate `start <= end` (reject inverted ranges with error and re-prompt)
    - This preserves FR132's "start/end context" semantics while preferring structured dates
  - [ ] 2.4: Update step 4 confirmation display:
    - Show new schema fields (id, name, status, capacity, start, end)
    - Show output path as `_bmad-output/implementation-artifacts/sprints/sprint-{number}.yaml`
    - After editing sprint number via 'e' option, re-run overwrite protection check against new path before returning to confirmation
    - Handle unrecognized input at confirmation prompt (not y/n/e) with error and re-prompt
  - [ ] 2.5: Rework step 5 to write new YAML schema:
    - Ensure `_bmad-output/implementation-artifacts/sprints/` directory exists before writing (mkdir -p equivalent — do not assume Task 1 has run)
    - Always quote the `name` field in YAML output to handle special characters (colons, hash, quotes)
    - Output path: `_bmad-output/implementation-artifacts/sprints/sprint-{number}.yaml`
    - Schema:
      ```yaml
      id: sprint-{number}
      name: "Sprint {number}"
      status: planning
      capacity: {capacity}
      start: "{start_date}"    # empty string if skipped
      end: "{end_date}"        # empty string if skipped
      items: []
      created_date: "{iso_timestamp}"
      last_modified: "{iso_timestamp}"
      ```
  - [ ] 2.6: Overwrite protection for new path `sprints/sprint-{number}.yaml`
    - Also add advisory check: if `sprint-plan-{number}.yaml` exists at the OLD path, warn user about potential duplication between old and new format

- [ ] Task 3: Update SKILL.md frontmatter and workflow.md (AC: #1)
  - [ ] 3.1: Update `lib/bmad-extension/skills/add-sprint/SKILL.md` frontmatter description to reflect new schema
  - [ ] 3.2: Update `lib/bmad-extension/workflows/add-sprint/workflow.md` to match SKILL.md content (keep files in sync, or delete workflow.md if SKILL.md is the sole source of truth — verify which file is authoritative via module-help.csv `skill:add-sprint` resolution)
  - [ ] 3.3: Update `lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml` if any fields need updating

- [ ] Task 4: Update module-help.csv registration (AC: #1)
  - [ ] 4.1: Verify `lib/bmad-extension/module-help.csv` add-sprint entry points to `skill:add-sprint`
  - [ ] 4.2: Update the `output-location` column from `_bmad-output/implementation-artifacts` to `_bmad-output/implementation-artifacts/sprints`
  - [ ] 4.3: Update the `description` column — remove "optional start/end context" phrasing, reflect new schema

- [ ] Task 5: Update and rename shared guardrails document (AC: #1, #3)
  - [ ] 5.1: Rename `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` to `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` to reflect its expanded scope across Epics 11, 12, and 17
  - [ ] 5.2: Update Sprint Artifact Naming section:
    - New path: `_bmad-output/implementation-artifacts/sprints/sprint-{id}.yaml`
    - New discovery glob: `sprints/sprint-*.yaml`
  - [ ] 5.3: Add Sprint Status Transitions section with the full valid transition matrix:
    - `planning` -> `active` (requires no other active sprint)
    - `active` -> `closed`
    - All others invalid. Document: no reopening closed sprints, no deactivation without closing, no direct creation in non-planning status.
  - [ ] 5.4: Add Item ID Format Contract section:
    - Story IDs: `{epic}-{story}-{slug}` (e.g., `5-5-explicit-parameter-passing`)
    - Bug IDs: `BUG-{slug}` (e.g., `BUG-path-spaces`)
  - [ ] 5.5: Update Data Authority Rules table to reflect new sprint file path and add concurrency note: glob-then-write is not atomic; concurrent sprint modification is unsupported

- [ ] Task 6: Add deprecation notices to broken workflows (interim mitigation)
  - [ ] 6.1: Add a deprecation notice at the TOP of `lib/bmad-extension/skills/add-to-sprint/SKILL.md` (if exists) or `lib/bmad-extension/workflows/add-to-sprint/workflow.md`:
    ```
    <!-- DEPRECATED: This workflow references the old sprint-plan-{n}.yaml format.
         It will be reworked in Story 17.4. Use /add-sprint to create sprints in the new format. -->
    ```
  - [ ] 6.2: Add same deprecation notice to `modify-sprint` and `sprint-status-view` SKILL.md/workflow.md files
  - [ ] 6.3: These are informational notices only — do NOT modify the workflow logic itself

- [ ] Task 7: Verify workflow (AC: #1, #2, #3)
  - [ ] 7.1: Trace add-sprint SKILL.md step paths — confirm all routes produce valid YAML at correct path
  - [ ] 7.2: Verify schema fields match AC #1 (all 9 fields: id, name, status, capacity, start, end, items, created_date, last_modified)
  - [ ] 7.3: Verify sprint number validation rejects: zero, negative, non-numeric, leading zeros, values > 9999
  - [ ] 7.4: Verify date validation rejects: non-ISO format, impossible dates, inverted ranges; accepts empty string (skip)
  - [ ] 7.5: Verify `items` array is initialized empty
  - [ ] 7.6: Verify overwrite protection works for new path and advisory check for old path
  - [ ] 7.7: Verify unrecognized input at confirmation prompt triggers re-prompt
  - [ ] 7.8: Verify directory creation (sprints/) happens before file write

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** Epic 15 converted `add-sprint` from a bare workflow.md to a SKILL.md skill package. The `module-help.csv` entry points to `skill:add-sprint`, which resolves to `lib/bmad-extension/skills/add-sprint/SKILL.md`. The file at `lib/bmad-extension/workflows/add-sprint/workflow.md` is a legacy copy — either keep it in sync or delete it. **If you only modify workflow.md, the actual invoked skill will remain unchanged.**
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/add-sprint/` (NOT in `_bmad/bmm/workflows/`)
- **YAML artifact format:** Sprint artifacts use YAML, consistent with existing patterns
- **Capacity as item count:** FR66 specifies capacity as item count (not story points or hours)
- **Sprint ID format:** `sprint-{number}` in kebab-case
- **Directory change:** Sprint files move from `implementation-artifacts/sprint-plan-{n}.yaml` (flat) to `implementation-artifacts/sprints/sprint-{id}.yaml` (dedicated directory)
- **FR132 deviation:** FR132 says "start/end context" (implying freeform). This story narrows to optional ISO dates for downstream machine-parseability while keeping them optional to preserve the spirit of freeform context. This is a deliberate, documented deviation.

### Sprint YAML Schema (Authoritative)

```yaml
id: sprint-{number}          # string, kebab-case, e.g., "sprint-3"
name: "Sprint {number}"      # string, always quoted, user-editable
status: planning              # enum: planning | active | closed
capacity: {int}              # positive integer, item count (stories + bugs)
start: ""                    # optional, ISO YYYY-MM-DD or empty string
end: ""                      # optional, ISO YYYY-MM-DD or empty string
items: []                    # ordered list of item IDs (empty at creation)
created_date: "{ISO-8601}"   # set at creation, never updated
last_modified: "{ISO-8601}"  # updated on every write (concurrency guard)
```

### Item ID Format Contract

Item IDs stored in the `items` array follow these formats:
- **Story IDs:** `{epic}-{story}-{slug}` (e.g., `"5-5-explicit-parameter-passing"`) — matches sprint-status.yaml key format
- **Bug IDs:** `BUG-{slug}` (e.g., `"BUG-path-spaces"`) — matches bug story file naming `bug-{slug}.md` but with uppercase `BUG-` prefix

This contract is consumed by Stories 17.4 (writes items), 17.5 (removes items), 17.6 (cleanup), and 17.8 (display).

### Valid State Transitions (Full Matrix)

| From | To | Condition |
|---|---|---|
| `planning` | `active` | No other sprint is `active` |
| `active` | `closed` | Always allowed |
| `closed` | `active` | **INVALID** — no reopening |
| `closed` | `planning` | **INVALID** |
| `active` | `planning` | **INVALID** — must close first |
| (creation) | `active` | **INVALID** — always start as `planning` |
| (creation) | `closed` | **INVALID** — always start as `planning` |

### What Changes from Epic 12's Implementation

| Aspect | Epic 12 (Current) | Epic 17 (New) |
|---|---|---|
| Authoritative file | `workflows/add-sprint/workflow.md` | `skills/add-sprint/SKILL.md` |
| Output location | `implementation-artifacts/sprint-plan-{n}.yaml` | `implementation-artifacts/sprints/sprint-{id}.yaml` |
| ID field | `sprint_number: 3` (integer) | `id: sprint-3` (string, kebab-case) |
| Name field | `sprint_name: "Sprint 3"` | `name: "Sprint 3"` |
| Date fields | `start_context` / `end_context` (freeform, optional) | `start` / `end` (ISO YYYY-MM-DD, optional) |
| Items field | `assigned_items: []` | `items: []` |
| Status values | `planning` only | `planning \| active \| closed` |
| Active constraint | None | Single-active-sprint enforced |
| Discovery glob | `sprint-plan-*.yaml` | `sprints/sprint-*.yaml` |
| Number validation | None | Positive integer, no leading zeros, <= 9999 |
| Date validation | None (freeform) | ISO format, real date, start <= end |

### Impact on Other Epic 17 Stories

Stories 17.2 through 17.8 depend on this sprint entity model:
- **17.2 (Flat Backlog):** Will reference sprint IDs from this format
- **17.4 (Backlog-to-Sprint):** Will write to `items` array and enforce capacity constraint (AC #2)
- **17.5 (Sprint-to-Backlog):** Will remove from `items` array
- **17.6 (Done Item Cleanup):** Will remove done items from `items` array and potentially close sprints
- **17.8 (Sprint Status Display):** Will read and display this format

### Interim Breakage Mitigation

After this story lands, the existing `add-to-sprint`, `modify-sprint`, and `sprint-status-view` workflows will be **broken** because they reference `sprint-plan-*.yaml` paths and old field names. Task 6 adds deprecation notices to these files so a Scrum Master invoking them gets a clear explanation instead of a cryptic "no sprint plans found" error. The workflow logic itself is NOT modified — just an informational notice at the top.

### Shared Guardrails

See `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` (renamed from `epic-11-12-shared-guardrails.md` in Task 5) for universal constraints, data authority rules, and sprint conventions.

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT rework add-to-sprint, modify-sprint, or sprint-status-view workflow **logic** — only add deprecation notices (Task 6)
- Do NOT auto-migrate existing `sprint-plan-*.yaml` files — migration is out of scope
- Do NOT use story points or hours for capacity — use item count only (FR66)
- `items` array MUST be initialized as empty `[]` — never pre-populated during sprint creation
- Sprint ID MUST follow `sprint-{number}` kebab-case format
- New sprints MUST default to `status: planning` — never auto-activate
- Sprint name MUST always be quoted in YAML output to handle special characters
- **Modify SKILL.md, not just workflow.md** — SKILL.md is the file invoked by `skill:add-sprint`

### Project Structure Notes

- **Files to modify (primary):**
  - `lib/bmad-extension/skills/add-sprint/SKILL.md` — rework to new YAML schema and output path **(this is the authoritative file)**
  - `lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml` — verify/update if needed
  - `lib/bmad-extension/module-help.csv` — update output-location and description columns
  - `_bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md` — rename to `sprint-management-guardrails.md`, update contents
- **Files to modify (sync/deprecation):**
  - `lib/bmad-extension/workflows/add-sprint/workflow.md` — sync with SKILL.md or delete if redundant
  - `lib/bmad-extension/skills/add-to-sprint/SKILL.md` or `lib/bmad-extension/workflows/add-to-sprint/workflow.md` — add deprecation notice only
  - `lib/bmad-extension/skills/modify-sprint/SKILL.md` or `lib/bmad-extension/workflows/modify-sprint/workflow.md` — add deprecation notice only
  - `lib/bmad-extension/skills/sprint-status-view/SKILL.md` or `lib/bmad-extension/workflows/sprint-status-view/workflow.md` — add deprecation notice only
- **Files/directories to create:**
  - `_bmad-output/implementation-artifacts/sprints/` — new directory for sprint YAML files
  - `_bmad-output/implementation-artifacts/sprints/.gitkeep` — ensure directory is tracked
- **Files NOT to touch (workflow logic):**
  - `add-to-sprint` workflow logic (Story 17.4)
  - `modify-sprint` workflow logic (Story 17.4/17.5)
  - `sprint-status-view` workflow logic (Story 17.8)
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (Story 17.8)
  - Any files under `_bmad/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.1] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR132] — Sprint entity model: sprints as first-class YAML entities
- [Source: _bmad-output/planning-artifacts/prd.md#FR66] — Capacity as item count
- [Source: _bmad-output/planning-artifacts/prd.md#FR68] — Add sprint workflow requirement
- [Source: _bmad-output/planning-artifacts/architecture.md#P2-5] — Pre-built extension workflows including add-sprint
- [Source: _bmad-output/implementation-artifacts/done/12-1-add-sprint-workflow.md] — Current add-sprint implementation to rework
- [Source: lib/bmad-extension/skills/add-sprint/SKILL.md] — Current SKILL.md file to modify (authoritative)
- [Source: lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml] — Skill manifest
- [Source: lib/bmad-extension/workflows/add-sprint/workflow.md] — Legacy workflow copy (sync or delete)
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration (points to skill:add-sprint)
- [Source: _bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md] — Shared guardrails to rename and update
- [Source: _bmad-output/implementation-artifacts/epic-17-adversarial-review.md] — Adversarial review (14 findings, all addressed)
- [Source: _bmad-output/implementation-artifacts/epic-17-edge-case-review.md] — Edge case review (21 findings, all addressed)

### Git Intelligence

Recent commits show Epic 15 (BMAD 6.2.1 migration) converted workflows to SKILL.md packages. Key patterns:
- Conventional commit format: `feat(epic-15): story 15-X description`
- This story should use: `feat(epic-17): story 17-1 sprint entity model`
- SKILL.md + bmad-skill-manifest.yaml is now the standard skill package format
- `module-help.csv` uses `skill:add-sprint` to resolve to SKILL.md, not workflow.md

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
