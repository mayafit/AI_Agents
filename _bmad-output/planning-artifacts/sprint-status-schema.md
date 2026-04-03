# Sprint-Status YAML Schema Reference

> Canonical schema specification for `sprint-status.yaml` — the single source of truth for all sprint and backlog state.
>
> **Story:** 17.9 — Unified sprint-status.yaml Schema
> **Architecture:** Decision P2-11
> **Consumers:** 13 skills (see Skill Integration Map below)

---

## 1. Top-Level Structure

A valid `sprint-status.yaml` contains exactly **three data sections** (`epics`, `backlog`, `sprints`) plus **six metadata fields**.

```yaml
# ── Metadata ──────────────────────────────────────────────────────────────────
generated: <ISO-8601 datetime string>
last_updated: <ISO-8601 datetime string>
project: <string>
project_key: <string>
tracking_system: <"file-system" | "jira">
story_location: <string>

# ── Data Sections ─────────────────────────────────────────────────────────────
epics: <map>
backlog: <array>
sprints: <map>
```

### 1.1 Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `generated` | ISO-8601 datetime string | Yes | Timestamp when the file was first created |
| `last_updated` | ISO-8601 datetime string | Yes | Timestamp of the most recent write to the file. Updated by every skill that modifies the file. |
| `project` | string | Yes | Human-readable project name (from `config.yaml → project_name` or fallback) |
| `project_key` | string | Yes | Short project key for ID prefixes. `NOKEY` if unset. |
| `tracking_system` | string | Yes | Backend selector: `"file-system"` (default) or `"jira"`. See Section 5. |
| `story_location` | string | Yes | Relative path from project root to the directory containing story `.md` files (e.g., `_bmad-output/implementation-artifacts`) |

**Semantics:**
- `generated` is written once at file creation and never changed.
- `last_updated` is overwritten on every write operation. Skills MUST update this field whenever they modify the file.
- `tracking_system` determines whether skills read/write the local YAML file (`file-system`) or delegate to the Jira adapter (`jira`). See Section 5.

---

## 2. Epics Section

The `epics` section is a YAML **map** keyed by epic ID.

### 2.1 Schema

```yaml
epics:
  <epic-id>:
    status: <"backlog" | "in-progress" | "done" | "on-hold" | "cancelled">
    retrospective: <"optional" | "done" | null>
```

### 2.2 Field Definitions

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| _key_ | string | — | `epic-N` where N is a positive integer (e.g., `epic-5`). Gaps in numbering are allowed. | Map key identifying the epic |
| `status` | string | Yes | `backlog`, `in-progress`, `done`, `on-hold`, `cancelled` | Current lifecycle state of the epic |
| `retrospective` | string or null | Yes | `optional`, `done`, `null` | Whether a retrospective has been completed for this epic |

### 2.3 Epic Status Transitions

```
backlog → in-progress → done
             ↕
          on-hold

Any non-done status → cancelled
```

- **`backlog`** — Epic is defined but no stories are actively being worked on.
- **`in-progress`** — At least one story in the epic has moved past `backlog` status.
- **`done`** — All stories in the epic are complete. Epic may be archived by `cleanup-done`.
- **`on-hold`** — Epic is paused. Can transition to `on-hold` from `backlog` or `in-progress`, and return to the previous state when resumed.
- **`cancelled`** — Epic has been abandoned. Terminal state — any non-`done` status may transition to `cancelled`. No transitions out of `cancelled`.

Forward transitions on the main track (`backlog → in-progress → done`) are not reversible. `on-hold` is a bidirectional pause state. `cancelled` is a terminal state reachable from any non-`done` status.

### 2.4 Empty Epics

An empty epics map (`epics: {}`) is valid and represents a project with no epics yet defined.

### 2.5 Retrospective Values

- **`optional`** — Retrospective has not been run and is not blocking.
- **`done`** — Retrospective has been completed.
- **`null`** — Retrospective is not applicable for this epic.

---

## 3. Backlog Section

The `backlog` section is a YAML **array** of item objects. Array order represents priority ranking (first item = highest priority).

### 3.1 Backlog Item Schema

```yaml
backlog:
  - id: <string>
    type: <"story" | "bug">
    epic: <integer | null>
    title: <string>
    priority: <integer>
    status: <string>
    severity: <null | "critical" | "high" | "medium" | "low">
```

### 3.2 Field Definitions

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `id` | string | Yes | e.g., `"17-10-rework-generate-backlog"`, `"BUG-path-spaces"` | Unique identifier for the item. Story IDs follow `N-M-slug` convention. Bug IDs follow `BUG-slug` convention. |
| `type` | string | Yes | `story`, `bug` | Discriminator for item type |
| `epic` | integer or null | Yes | e.g., `17`, `null` | Epic number this item belongs to. `null` for standalone bugs or items not tied to an epic. |
| `title` | string | Yes | — | Human-readable title |
| `priority` | integer | Yes | Positive integer, 1 = highest | Explicit numeric priority for backlog ordering. Lower number = higher priority. |
| `status` | string | Yes | See valid statuses below | Current lifecycle status of the item |
| `severity` | string or null | Yes | `null`, `critical`, `high`, `medium`, `low` | Bug severity. MUST be `null` for stories. Only bugs carry a non-null severity. |

### 3.3 Notes

- Items in the `backlog` section typically have status `backlog`, but may have other statuses if they have not yet been assigned to a sprint (e.g., `ready-for-dev` items awaiting sprint assignment).
- **Array position is the authoritative priority order** (position 0 = highest priority). The `priority` field is a denormalized index that MUST be kept in sync with array position. When items are reordered, `priority` values MUST be renumbered to match the new positions.
- An empty backlog array (`backlog: []`) is valid and represents a state where all items are assigned to sprints or no items have been created yet.
- An item's `epic` field value `N` (integer) corresponds to the epics map key `epic-N`. Items with `epic: null` are not associated with any epic and are excluded from epic status derivation.

---

## 4. Sprints Section

The `sprints` section is a YAML **map** keyed by sprint ID.

### 4.1 Sprint Entity Schema

```yaml
sprints:
  <sprint-id>:
    name: <string>
    status: <"planning" | "active" | "closed">
    capacity: <integer>
    start: <ISO-date string | "">
    end: <ISO-date string | "">
    items: <array of sprint item objects>
```

### 4.2 Sprint Entity Field Definitions

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| _key_ | string | — | `sprint-N` (e.g., `sprint-3`) | Map key identifying the sprint |
| `name` | string | Yes | — | Human-readable sprint name |
| `status` | string | Yes | `planning`, `active`, `closed` | Current lifecycle state |
| `capacity` | integer | Yes | Non-negative integer | Advisory maximum number of items for this sprint. Skills SHOULD warn when `items` count exceeds `capacity` but MUST NOT block the operation. |
| `start` | string | Yes | ISO date (`"YYYY-MM-DD"`) or `""` | Sprint start date. Empty string if not yet scheduled. |
| `end` | string | Yes | ISO date (`"YYYY-MM-DD"`) or `""` | Sprint end date. Empty string if not yet scheduled. |
| `items` | array | Yes | Array of sprint item objects | Items assigned to this sprint. May be empty (`[]`). |

### 4.3 Sprint Item Schema (within `items` array)

```yaml
items:
  - id: <string>
    type: <"story" | "bug">
    epic: <integer | null>
    title: <string>
    status: <string>
    severity: <null | "critical" | "high" | "medium" | "low">
```

### 4.4 Sprint Item Field Definitions

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `id` | string | Yes | Same format as backlog items | Unique identifier |
| `type` | string | Yes | `story`, `bug` | Item type |
| `epic` | integer or null | Yes | — | Epic association |
| `title` | string | Yes | — | Human-readable title |
| `status` | string | Yes | See valid statuses below | Current lifecycle status |
| `severity` | string or null | Yes | `null`, `critical`, `high`, `medium`, `low` | Bug severity. `null` for stories. |

### 4.5 Backlog Item vs Sprint Item — Schema Difference

Sprint items use the **same schema as backlog items** except they do **NOT** have the `priority` field.

| Field | Backlog Item | Sprint Item |
|-------|-------------|-------------|
| `id` | Yes | Yes |
| `type` | Yes | Yes |
| `epic` | Yes | Yes |
| `title` | Yes | Yes |
| `priority` | **Yes** | **No** |
| `status` | Yes | Yes |
| `severity` | Yes | Yes |

**Rationale:** In the backlog, `priority` provides explicit ordering for triage. Once assigned to a sprint, priority is implicit — the item's position within the sprint's `items` array determines its relative order.

**Movement rules:**

- **Backlog → Sprint (`add-to-sprint`):** The `priority` field is **dropped**. Only items with status `ready-for-dev` may be added to a sprint. Skills MUST reject items in any other status.
- **Sprint → Backlog (`remove-from-sprint`):** A `priority` field is **added** with value `max(existing backlog priorities) + 1` (appended to end). If the backlog is empty, the item receives `priority: 1`. The item's status is **reset to `ready-for-dev`** (not `backlog`, because a story file already exists).
- **Done items:** Items with status `done` MUST NOT be moved back to backlog via `remove-from-sprint`. They can only be archived via `cleanup-done` or `close-sprint`.

### 4.6 Sprint Status Transitions

```
planning → active → closed
```

- **`planning`** — Sprint is being assembled. Items can be added or removed.
- **`active`** — Sprint is underway. Items can change status but should not normally be added/removed (use `correct-course` for mid-sprint changes).
- **`closed`** — Sprint is complete. The sprint entry is immutable — no item changes allowed. The entry remains in the file as historical record.

No backward transitions are allowed. A closed sprint cannot be reopened.

---

## 5. Tracking System Adapter Contract

### 5.1 The `tracking_system` Field

```yaml
tracking_system: "file-system"   # default — all operations read/write sprint-status.yaml
tracking_system: "jira"          # future — operations proxy to Jira API
```

### 5.2 Backend Behavior

| Backend | Behavior |
|---------|----------|
| `file-system` | All 13 affected skills read/write `sprint-status.yaml` directly. The local YAML file is the single source of truth. |
| `jira` | Skills detect `tracking_system: jira` and delegate to a Jira adapter module (Story 17.22). The adapter translates unified data model operations into Jira API calls. |

### 5.3 Contract

- **The schema defined in this document is the canonical data contract for BOTH backends.** Jira responses are mapped into the same structure.
- Skills NEVER branch on backend type for business logic — only the I/O layer differs.
- A skill's logic is: read data → operate on data model → write data. The `tracking_system` value only affects the read/write layer.
- When `tracking_system: jira`, the `sprint-status.yaml` file may still exist as a local cache but is NOT authoritative — the Jira instance is the source of truth.

---

## 6. Invariants and Constraints

These rules MUST be enforced by every skill that writes to `sprint-status.yaml`.

### 6.1 Single-Location Invariant (AC: 5)

An item ID MUST appear in **exactly one** location within the file:
- Either in the `backlog` array, **OR**
- In exactly one sprint's `items` array.
- **Never both. Never in multiple sprints.**

Any skill that moves an item MUST perform the move atomically: remove from source section and add to target section in a single write operation.

### 6.2 In-Place Status Update Rule (AC: 6)

When an item's status changes (e.g., `ready-for-dev` → `in-progress`), the `status` field is updated **in-place** on the item object in whichever section it currently resides. The item does NOT move between sections on status change — only `add-to-sprint` and `remove-from-sprint` perform movement.

### 6.3 Done-Removal Rule (AC: 7)

When an item reaches `done` status and cleanup runs (via `cleanup-done` or `close-sprint`):
1. The item is **removed** from `sprint-status.yaml` entirely (deleted from the sprint's `items` array).
2. The corresponding story file at `{story_location}/{id}.md` is **moved** to `{story_location}/done/{id}.md`.
3. No trace of the item remains in the active file. The `done/` folder is the archive.

This keeps the active file lean and focused on current work.

### 6.4 Single-Active-Sprint Constraint (AC: 8)

At most **one** sprint can have `status: active` at any time. Before activating a sprint, the previous active sprint MUST be closed first.

- Multiple sprints with `status: planning` are allowed.
- Multiple sprints with `status: closed` are allowed (historical records).
- Exactly zero or one sprint with `status: active`.

### 6.5 Valid Sprint Status Transitions

```
planning → active → closed
```

No backward transitions. No skipping states. A sprint in `planning` cannot jump directly to `closed`.

### 6.6 Valid Item Status Transitions

```
backlog → ready-for-dev → in-progress → review → done
                ↕              ↕           ↕
             on-hold        on-hold      on-hold

Any non-done status → cancelled
```

- **Main track:** Forward-only progression (`backlog → ready-for-dev → in-progress → review → done`). No backward transitions on the main track under normal operation.
- **Exception — `remove-from-sprint`:** When an item is moved from a sprint back to the backlog, its status is reset to `ready-for-dev` regardless of its current status. This is the only permitted "backward" transition and is triggered by movement, not by in-place status change.
- **`backlog`** — Initial state for new items. Items in the backlog section typically have this status.
- **`ready-for-dev`** — Story file has been created and the item is prepared for development. Items may be set to `ready-for-dev` in the backlog section or after being moved to a sprint. Only items with this status may be added to a sprint via `add-to-sprint`.
- **`in-progress`** — Developer is actively working on the item.
- **`review`** — Implementation complete, awaiting code review.
- **`done`** — Item is complete. Triggers archival eligibility (see 6.3).
- **`on-hold`** — Item is paused. Can transition to `on-hold` from `ready-for-dev`, `in-progress`, or `review`, and return to the previous state when resumed.
- **`cancelled`** — Item has been abandoned. Terminal state — any non-`done` status may transition to `cancelled`. Cancelled items are archived similarly to done items (see 6.3) with a cancelled notation.

### 6.7 Closed Sprint Immutability

Once a sprint has `status: closed`, its `items` array and metadata fields MUST NOT be modified, with two exceptions:
1. **Done/cancelled item archival:** `cleanup-done` may remove items with status `done` or `cancelled` from a closed sprint's `items` array as part of the archival process (see 6.3).
2. **Data compaction:** Full removal of the sprint entry (if ever implemented).

Outside of these exceptions, the entry serves as a historical record and is immutable.

### 6.8 Sprint Item Disposition on Close (#14)

Before a sprint is set to `closed` via `close-sprint`, all items SHOULD be dispositioned:
- **`done` items** — Archived (removed from file, story file moved to `done/`).
- **`cancelled` items** — Archived similarly with a cancelled notation.
- **Remaining items** (`ready-for-dev`, `in-progress`, `review`) — User decides per-item: move to next sprint (if one exists in `planning` state) or return to backlog (status reset to `ready-for-dev`).

A closed sprint MAY retain items that were not dispositioned — the immutability rule (6.7) applies from the moment of close, with the archival exception.

---

## 7. Skill Integration Map

All 13 skills that read or write `sprint-status.yaml`:

| Skill | Story | Operation | Section(s) Touched | Rework Level |
|-------|-------|-----------|-------------------|-------------|
| `bmad-sprint-planning` | 17.15 | Bootstraps entire file from epics | Creates all sections | Heavy |
| `generate-backlog` | 17.10 | Writes items to `backlog` from epics | `backlog`, `epics` | Heavy |
| `add-sprint` | 17.16 | Adds a new sprint entry | `sprints` | Moderate |
| `add-to-sprint` | 17.11 | Moves item from `backlog` to sprint `items` | `backlog`, `sprints` | Heavy |
| `remove-from-sprint` | 17.12 | Moves item from sprint `items` to `backlog` | `sprints`, `backlog` | Heavy |
| `sprint-status-view` | 17.13 | Reads all sections, renders progress | All (read-only) | Heavy |
| `cleanup-done` | 17.14 | Removes done items, archives files | `sprints`, file system | Heavy |
| `modify-sprint` | 17.17 | Updates sprint metadata or item order | `sprints` | Moderate |
| `bmad-dev-story` | 17.18 | Finds item, updates status field | `backlog` or `sprints` | Moderate |
| `story-status-lookup` | 17.19 | Searches all sections for item | All (read-only) | Light |
| `bmad-sprint-status` | 17.20 | Reads sections for health summary | All (read-only) | Light |
| `prioritize-backlog` | 17.24 | Reorders backlog items by criteria | `backlog` | Light |
| `close-sprint` | 17.21 | Full sprint close lifecycle | `sprints`, `backlog`, file system | New |

---

## 8. File Location

```
{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml
```

- **Single-repo mode:** `sprint_management_path` defaults to `.` (project root), so the file is at `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Multi-repo mode:** `sprint_management_path` from `_bmad/bmm/config.yaml` resolves to the sprint management repository root.
- **Archive directory:** `{story_location}/done/` — stores archived story files removed from `sprint-status.yaml`.

---

## 9. Reference Example

A fully populated `sprint-status.yaml` demonstrating all sections with realistic data, edge cases, and schema compliance.

```yaml
# Unified sprint-status.yaml — single source of truth for sprint and backlog state
# Schema version: 1.0 (Story 17.9)
# Architecture: Decision P2-11

generated: "2026-03-15T10:00:00Z"
last_updated: "2026-04-03T14:30:00Z"
project: agents
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

# ── Epics ─────────────────────────────────────────────────────────────────────
epics:
  epic-4:
    status: on-hold
    retrospective: optional
  epic-5:
    status: in-progress
    retrospective: optional
  epic-14:
    status: backlog
    retrospective: null
  epic-17:
    status: in-progress
    retrospective: optional

# ── Backlog ───────────────────────────────────────────────────────────────────
# Ordered by priority (position 0 = highest priority)
backlog:
  - id: "17-10-rework-generate-backlog"
    type: story
    epic: 17
    title: "Rework generate-backlog Skill"
    priority: 1
    status: ready-for-dev
    severity: null
  - id: "17-16-rework-add-sprint"
    type: story
    epic: 17
    title: "Rework add-sprint Skill"
    priority: 2
    status: backlog
    severity: null
  - id: "BUG-path-spaces"
    type: bug
    epic: null
    title: "Fix space-in-path bug in CLI"
    priority: 3
    status: backlog
    severity: high
  - id: "14-1-research-sprint-management-integration"
    type: story
    epic: 14
    title: "Research Sprint Management Integration"
    priority: 4
    status: backlog
    severity: null

# ── Sprints ───────────────────────────────────────────────────────────────────
sprints:
  # Active sprint — the only sprint with status: active
  sprint-3:
    name: "Sprint 3 — Epic 17 Foundation"
    status: active
    capacity: 6
    start: "2026-04-03"
    end: "2026-04-14"
    items:
      - id: "17-9-unified-sprint-status-schema"
        type: story
        epic: 17
        title: "Unified sprint-status.yaml Schema"
        status: in-progress
        severity: null
      - id: "17-15-rework-bmad-sprint-planning"
        type: story
        epic: 17
        title: "Rework bmad-sprint-planning Skill"
        status: ready-for-dev
        severity: null
      - id: "5-5-explicit-parameter-passing"
        type: story
        epic: 5
        title: "Explicit Parameter Passing"
        status: review
        severity: null

  # Planning sprint — items can be added/removed freely
  sprint-4:
    name: "Sprint 4 — Epic 17 Skills"
    status: planning
    capacity: 8
    start: ""
    end: ""
    items: []

  # Closed sprint — immutable historical record, items already archived
  sprint-2:
    name: "Sprint 2 — Epic 5 Bundled Install"
    status: closed
    capacity: 8
    start: "2026-03-15"
    end: "2026-03-28"
    items: []
```

### 9.1 Edge Cases Demonstrated

| Edge Case | Location in Example | Notes |
|-----------|-------------------|-------|
| Epic on hold | `epic-4` | Has `status: on-hold` — paused epic |
| Bug in backlog | `BUG-path-spaces` item | Has `type: bug`, `epic: null`, `severity: high` |
| Story in backlog with no sprint | `14-1-research-sprint-management-integration` | Low-priority item in `backlog` status |
| Closed sprint with empty items | `sprint-2` | Items already archived to `done/`; entry remains as record |
| Planning sprint with no items | `sprint-4` | Not yet populated; `start` and `end` are empty strings |
| Multiple sprints in different states | `sprint-2` (closed), `sprint-3` (active), `sprint-4` (planning) | Only one is `active` |
| Backlog item with `ready-for-dev` status | `17-10-rework-generate-backlog` | Awaiting sprint assignment but already prepared |
| Story with null severity | All story items | `severity: null` distinguishes stories from bugs |

---

## 10. Schema Validation Checklist

Skills that write to `sprint-status.yaml` SHOULD validate these rules before writing:

1. File contains exactly the 6 metadata fields and 3 data sections
2. Every epic key matches pattern `epic-N` (N is a positive integer)
3. Every epic has `status` and `retrospective` fields; `status` is one of: `backlog`, `in-progress`, `done`, `on-hold`, `cancelled`
4. Every backlog item has all 7 required fields: `id`, `type`, `epic`, `title`, `priority`, `status`, `severity`
5. Every sprint key matches pattern `sprint-N`
6. Every sprint has all 6 required fields: `name`, `status`, `capacity`, `start`, `end`, `items`
7. Every sprint item has all 6 required fields: `id`, `type`, `epic`, `title`, `status`, `severity` (NO `priority`)
8. No item ID appears in more than one location (single-location invariant); item IDs are unique across `backlog` and all `sprints[*].items` combined
9. At most one sprint has `status: active`
10. `last_updated` is set to the current timestamp
11. Item `status` is one of: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `on-hold`, `cancelled`
12. Array position of backlog items matches their `priority` field values (position 0 = `priority: 1`)
