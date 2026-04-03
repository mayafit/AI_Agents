# Story 17.9: Unified sprint-status.yaml Schema

Status: done

## Story

As a **Scrum Master**,
I want all sprint management data consolidated into a single `sprint-status.yaml` file with three structured sections (epics, backlog, sprints),
So that there is one source of truth for all sprint/backlog state — eliminating data duplication and cross-file consistency bugs.

## Acceptance Criteria

1. **Given** the unified schema is defined,
   **When** `sprint-status.yaml` is created or updated by any skill,
   **Then** it contains exactly three data sections (`epics`, `backlog`, `sprints`) plus top-level metadata fields (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`).

2. **Given** the `epics` section exists,
   **When** any skill reads it,
   **Then** it is a YAML **map** keyed by epic ID (e.g., `epic-5:`) with fields `status` (`backlog` | `in-progress` | `done`) and `retrospective` (`optional` | `done` | null).

3. **Given** the `backlog` section exists,
   **When** any skill reads it,
   **Then** it is a YAML **array** of item objects. Each item has: `id` (string), `type` (`story` | `bug`), `epic` (integer | null), `title` (string), `priority` (integer), `status` (string), and optional `severity` (null | `critical` | `high` | `medium` | `low`).

4. **Given** the `sprints` section exists,
   **When** any skill reads it,
   **Then** it is a YAML **map** keyed by sprint ID (e.g., `sprint-3:`) with fields: `name` (string), `status` (`planning` | `active` | `closed`), `capacity` (integer), `start` (ISO date string or empty), `end` (ISO date string or empty), and `items` (array of item objects — same schema as backlog items but WITHOUT the `priority` field).

5. **Given** a story or bug exists in the file,
   **When** any skill searches for it,
   **Then** the item exists in exactly **one** location — either the `backlog` array OR a single sprint's `items` array. Never both.

6. **Given** an item's status changes (e.g., `ready-for-dev` to `in-progress`),
   **When** the status is updated by any skill,
   **Then** the `status` field is updated **in-place** on the item in whichever section it resides.

7. **Given** an item reaches `done` status,
   **When** cleanup runs (Story 17.14),
   **Then** the item is REMOVED from `sprint-status.yaml` entirely and archived to `done/`.

8. **Given** a sprint transitions from `planning` to `active`,
   **When** the activation occurs,
   **Then** only one sprint can have `status: active` at a time. The previous active sprint must be closed first.

9. **Given** the `tracking_system` field is set to `file-system` (default),
   **When** any sprint skill runs,
   **Then** it reads/writes the local YAML file. When set to `jira`, skills route to the Jira adapter (Story 17.22).

## Tasks / Subtasks

- [x] Task 1: Define canonical YAML schema (AC: 1-4)
  - [x] 1.1 Write the canonical schema as a reference specification — this is the contract ALL 13 skills will code against
  - [x] 1.2 Document the top-level metadata fields and their semantics
  - [x] 1.3 Document the `epics` map schema with status transitions
  - [x] 1.4 Document the `backlog` array item schema with all fields
  - [x] 1.5 Document the `sprints` map schema with sprint entity and items sub-schema
  - [x] 1.6 Document the item schema difference between backlog (has `priority`) and sprint items (no `priority`)
- [x] Task 2: Define invariants and constraints (AC: 5-8)
  - [x] 2.1 Document the single-location invariant — an item ID must appear in exactly one section
  - [x] 2.2 Document the in-place status update rule
  - [x] 2.3 Document the done-removal rule
  - [x] 2.4 Document the single-active-sprint constraint
  - [x] 2.5 Document valid sprint status transitions: `planning` → `active` → `closed` (no backward)
  - [x] 2.6 Document valid story status transitions: `backlog` → `ready-for-dev` → `in-progress` → `review` → `done`
- [x] Task 3: Define the tracking_system adapter contract (AC: 9)
  - [x] 3.1 Document the `tracking_system` field semantics (`file-system` vs `jira`)
  - [x] 3.2 Document that the schema is the canonical data contract for both backends
- [x] Task 4: Create a reference example file (AC: 1-9)
  - [x] 4.1 Write a fully populated example `sprint-status.yaml` showing all sections with realistic data from the agents project
  - [x] 4.2 Include edge cases: a bug in backlog, a closed sprint with empty items, a planning sprint with no items

### Review Findings

- [x] [Review][Decision] #1 `on-hold` and `cancelled` statuses added to schema — Added to epic statuses (Section 2.3) and item statuses (Section 6.6) with transition rules. `on-hold` is bidirectional pause; `cancelled` is terminal from any non-done state. **Resolved.**
- [x] [Review][Decision] #2 `canceled` status — Resolved by #1. Added `cancelled` as terminal status for both epics and items.
- [x] [Review][Decision] #3 Priority dual-authority resolved — Array position is now authoritative; `priority` field is denormalized index kept in sync (Section 3.3). Validation rule 12 added.
- [x] [Review][Decision] #4 `remove-from-sprint` status reset — Status resets to `ready-for-dev` (not `backlog`, because story file already exists). Only `ready-for-dev` items may be added to sprints. Documented in Section 4.5 and Section 6.6. **Resolved.**
- [x] [Review][Decision] #5 Closed sprint immutability exception — Section 6.7 now has explicit exception for done/cancelled item archival by `cleanup-done`. Section 6.8 added for sprint item disposition on close. **Resolved.**
- [x] [Review][Decision] #6 Capacity is advisory — Section 4.2 updated: skills SHOULD warn but MUST NOT block when items exceed capacity. **Resolved.**
- [x] [Review][Patch] #7 P2-11 sprint item `priority` removed — architecture.md line 956 fixed. **Applied.**
- [x] [Review][Patch] #8 P2-11 backlog status constraint aligned — architecture.md line 969 updated to match schema Section 3.3. **Applied.**
- [x] [Review][Patch] #9 Story Dev Notes reference fixed — "17.2-17.16" → "17.10-17.24". **Applied.**
- [x] [Review][Patch] #10 Empty section validity notes added — `backlog: []` and `epics: {}` documented as valid (Sections 2.4 and 3.3). **Applied.**
- [x] [Review][Patch] #11 Epic-to-item mapping rule added — `epic: N` maps to `epic-N` key; `epic: null` excluded from derivation (Section 3.3). **Applied.**
- [x] [Review][Patch] #12 Done item movement restriction added — `done` items cannot be moved to backlog; only archived (Section 4.5). **Applied.**
- [x] [Review][Patch] #13 Priority reassignment rule defined — `max(existing) + 1`; empty backlog gets `priority: 1` (Section 4.5). **Applied.**
- [x] [Review][Patch] #14 Closed sprint disposition note added — New Section 6.8 documents item disposition before close. **Applied.**
- [x] [Review][Defer] #15 sprint-status.yaml still uses old flat `development_status` format — deferred, pre-existing (migration is Story 17.23)
- [x] [Review][Defer] #16 `generated` field in sprint-status.yaml is bare date, not ISO-8601 datetime — deferred, pre-existing (will be reformatted by Story 17.15 bootstrap)
- [x] [Review][Defer] #17 No `schema_version` metadata field — deferred, out of scope for 17.9 (can be added in a future story if schema evolution is needed)
- [x] [Review][Defer] #18 Concurrent modification has no locking guidance — deferred, skills run serially in current architecture
- [x] [Review][Defer] #19 `correct-course` referenced in Section 4.6 but not in skill map — deferred, informational reference only

## Dev Notes

### What This Story IS

This is a **schema definition** story, not a skill implementation story. The deliverable is a canonical YAML schema specification that serves as the contract for all 13 skills that will be reworked in subsequent stories (17.10-17.24). Think of it as the "protobuf definition" — the interface contract that everything else implements against.

### What This Story Is NOT

This story does NOT:
- Modify any existing skills
- Write any JavaScript/TypeScript code
- Change how any skill reads or writes sprint-status.yaml
- Migrate existing data

Those are all subsequent stories (17.10-17.24).

### Current State (What's Being Replaced)

The current `sprint-status.yaml` uses a **flat `development_status` map**:

```yaml
generated: 2026-03-15
project: agents
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-1: done
  1-1-ci-cd-yes-flag: done
  epic-1-retrospective: optional
  epic-5: in-progress
  5-5-explicit-parameter-passing: review
```

**Problems with this format:**
- Epics, stories, and retrospectives share a flat namespace
- No sprint entity — just a status list
- No backlog concept — items are either in the list or not
- No movement semantics — status is a string, not a lifecycle
- Separate `backlog.yaml` and `sprints/sprint-N.yaml` files exist but drift out of sync

### New Schema (The Deliverable)

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-03T12:00:00Z"
project: agents
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

epics:
  epic-5:
    status: in-progress
    retrospective: optional
  epic-17:
    status: in-progress
    retrospective: optional

backlog:
  - id: "17-10-rework-generate-backlog"
    type: story
    epic: 17
    title: "Rework generate-backlog Skill"
    priority: 1
    status: backlog
    severity: null
  - id: "BUG-path-spaces"
    type: bug
    epic: null
    title: "Fix space-in-path bug"
    priority: 2
    status: backlog
    severity: high

sprints:
  sprint-3:
    name: "Sprint 3"
    status: active
    capacity: 6
    start: "2026-04-03"
    end: "2026-04-14"
    items:
      - id: "5-5-explicit-parameter-passing"
        type: story
        epic: 5
        title: "Explicit Parameter Passing"
        status: in-progress
        severity: null
      - id: "5-6-fix-space-in-path-bug"
        type: story
        epic: 5
        title: "Fix Space-in-Path Bug"
        status: review
        severity: null
  sprint-2:
    name: "Sprint 2"
    status: closed
    capacity: 8
    start: "2026-03-15"
    end: "2026-03-28"
    items: []
```

### Key Schema Decisions

| Decision | Rationale |
|----------|-----------|
| `epics` is a **map**, not array | Keyed lookup by `epic-N` — matches how skills search for epic status |
| `backlog` is an **array** | Ordered by priority — position in array = priority rank |
| `sprints` is a **map** keyed by sprint ID | Fast lookup by `sprint-N` key; matches existing sprint ID convention |
| Items in backlog have `priority` field | Explicit numeric priority for sorting |
| Items in sprint do NOT have `priority` | Once in a sprint, priority is implicit (order within the sprint) |
| `severity` is null for stories | Only bugs have severity; null distinguishes stories from bugs alongside `type` |
| Sprint `items` uses same schema minus `priority` | Consistency — same item object, just drops one field on move |

### Skills That Will Consume This Schema (13 total)

All of these will be reworked in subsequent stories to read/write the new schema:

| Skill | Story | Operation | Current Schema Assumption |
|-------|-------|-----------|--------------------------|
| `bmad-sprint-planning` | 17.15 | Bootstraps entire file | Writes flat `development_status` map |
| `generate-backlog` | 17.10 | Writes `backlog` section | Writes separate `backlog.yaml` |
| `add-sprint` | 17.16 | Writes `sprints` section | Creates separate `sprints/sprint-N.yaml` |
| `add-to-sprint` | 17.11 | Moves items backlog→sprint | Dual-writes `backlog.yaml` + `sprint-N.yaml` |
| `remove-from-sprint` | 17.12 | Moves items sprint→backlog | Dual-writes reverse |
| `sprint-status-view` | 17.13 | Reads all sections | Cross-references 3 files |
| `cleanup-done` | 17.14 | Removes done items | Scans 3 files |
| `modify-sprint` | 17.17 | Updates sprint entry | Reads/writes `sprint-N.yaml` |
| `bmad-dev-story` | 17.18 | Updates item status | Writes flat `development_status[key]` |
| `story-status-lookup` | 17.19 | Searches for item | Reads flat `development_status[key]` |
| `bmad-sprint-status` | 17.20 | Summarizes sprint health | Parses flat key map |
| `prioritize-backlog` | 17.24 | Reorders backlog items | Reads/writes `backlog.yaml` |
| `close-sprint` | 17.21 | Closes sprint lifecycle | NEW — does not exist yet |

### Architecture Reference

- [Architecture P2-11: Unified Sprint-Status File Architecture](../_bmad-output/planning-artifacts/architecture.md) — full schema, design principles, skill integration map, adapter pattern
- [PRD FR133-FR140](../_bmad-output/planning-artifacts/prd.md) — functional requirements for unified sprint-status
- [Epics: Epic 17](../_bmad-output/planning-artifacts/epics.md) — all 16 stories with acceptance criteria

### Project Structure Notes

- Schema file location: `{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml` (resolved via `config.yaml`, defaults to `_bmad-output/implementation-artifacts/sprint-status.yaml`)
- `done/` archive folder: `{implementation_artifacts}/done/`
- Config path: `_bmad/bmm/config.yaml` → `sprint_management_path`, `implementation_artifacts`

### Deliverable Location

The schema specification should be written as a reference document. Suggested location: `_bmad-output/planning-artifacts/sprint-status-schema.md` — a standalone schema reference that dev agents can load when implementing skills 17.10-17.24.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Validated reference YAML example programmatically using Python `yaml.safe_load()` + structural assertions
- All invariants verified: single-location, single-active-sprint, field completeness, sprint items lack `priority`

### Completion Notes List

- Created canonical schema specification at `_bmad-output/planning-artifacts/sprint-status-schema.md` (10 sections)
- Section 1: Top-level structure — 6 metadata fields + 3 data sections
- Section 2: Epics map schema — keyed by `epic-N`, status transitions `backlog → in-progress → done`
- Section 3: Backlog array schema — 7 required fields per item including `priority`
- Section 4: Sprints map schema — sprint entity + items sub-schema (6 fields, NO `priority`)
- Section 5: Tracking system adapter contract — `file-system` vs `jira` backend behavior
- Section 6: Invariants and constraints — 7 rules (single-location, in-place update, done-removal, single-active-sprint, sprint transitions, item transitions, closed sprint immutability)
- Section 7: Skill integration map — all 13 consuming skills with rework level
- Section 8: File location resolution — single-repo and multi-repo modes
- Section 9: Reference example — fully populated YAML with 3 epics, 4 backlog items, 3 sprints (active/planning/closed)
- Section 10: Schema validation checklist — 10-point validation rules for writing skills

### Change Log

- 2026-04-03: Created sprint-status-schema.md — canonical YAML schema specification (Story 17.9)

### File List

- `_bmad-output/planning-artifacts/sprint-status-schema.md` (NEW) — canonical schema reference document
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED) — status updated for story 17-9
- `_bmad-output/implementation-artifacts/17-9-unified-sprint-status-schema.md` (MODIFIED) — story file updates
