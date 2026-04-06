# Jira Adapter Pattern Specification

> Canonical adapter pattern specification for sprint management skill backend detection.
>
> **Story:** 17.22 — Jira Adapter Pattern (tracking_system Switch)
> **Architecture:** Decision P2-11
> **Companion document:** `sprint-status-schema.md` (Story 17.9)
> **Consumers:** 13 skills (Stories 17.10-17.21, 17.24) + Epic 14 Jira implementation (Stories 14.3, 14.4)

---

## 1. Overview and Purpose

### 1.1 What This Specification Defines

This document defines the **adapter pattern** that all 13 sprint management skills use to detect and switch between storage backends based on the `tracking_system` field in `sprint-status.yaml`. It is the companion to Story 17.9's schema specification:

| Specification | Story | Deliverable | Defines |
|---|---|---|---|
| Data model | 17.9 | `sprint-status-schema.md` | What the data looks like |
| Access pattern | 17.22 | `adapter-pattern-spec.md` | How skills read/write the data |

Together, these two documents form the complete interface specification for the sprint management system.

### 1.2 What This Specification Is Not

This specification does **not**:
- Implement a Jira adapter — that is Epic 14, Story 14.4
- Create any executable code, modules, or libraries
- Modify any existing skill files — Stories 17.10-17.21 and 17.24 each embed the template themselves
- Design the Jira authentication architecture — that is Epic 14, Story 14.3
- Change any deployment pipeline logic (no changes to `lib/installer.js` or `lib/bmad.js`)

### 1.3 Why the Adapter Is a Pattern, Not a Module

Skills in this project are **markdown instruction documents**, not executable code. A SKILL.md file is a natural-language instruction set that AI agents follow. There is no runtime, no module system, no import mechanism. The "adapter" is therefore a conditional instruction pattern embedded in each skill's SKILL.md, not a shared code module:

- Each skill includes its own copy of the backend detection instructions
- The "interface" is a specification of what operations the Jira adapter must support, not a TypeScript interface
- Skills are self-contained instruction documents — consistent with how both IDE and BMAD deployment pipelines work

### 1.4 Relationship to PRD Requirements

| Requirement | Description | How This Specification Addresses It |
|---|---|---|
| FR138 | Same data model, different storage backend (`tracking_system` switch) | Defines the adapter pattern that enables this: same schema (Story 17.9), different I/O layer |
| FR139 | `tracking_system` field determines backend; `jira` config surfaces "not yet implemented" message | Specifies the exact detection logic and message text for the `jira` branch |
| FR140 | All sprint skills reworked for unified file | Provides the backend detection template that all reworked skills must embed |
| FR133 | `sprint-status.yaml` metadata includes `tracking_system` field | Documents how skills read and interpret this field |

---

## 2. Backend Detection Logic

### 2.1 Field Location

The `tracking_system` field is a top-level metadata field in `sprint-status.yaml`, defined in Section 1.1 of `sprint-status-schema.md`:

```yaml
# sprint-status.yaml — top-level metadata
generated: "2026-03-15T10:00:00Z"
last_updated: "2026-04-06T00:00:00Z"
project: agents
project_key: NOKEY
tracking_system: file-system      # ← this field drives backend selection
story_location: _bmad-output/implementation-artifacts
```

**File path:** `{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml`

In single-repo mode, `sprint_management_path` defaults to `.` (project root). See Section 7.5 and sprint-status-schema.md Section 8 for path resolution details.

### 2.2 Detection Algorithm

Every sprint management skill executes this detection algorithm **before any read or write operations**:

1. Read `sprint-status.yaml` from its resolved path
2. Extract the value of the `tracking_system` metadata field
3. Branch based on value:
   - **`file-system`** → proceed with File-System Backend workflow
   - **`jira`** → halt with "not yet implemented" message (FR139)
   - **absent or empty** → treat as `file-system` (default behavior)
   - **any other value** → halt with unsupported backend error

### 2.3 Branch Definitions

| `tracking_system` value | Action |
|---|---|
| `"file-system"` | Proceed with local YAML read/write as defined in the skill's workflow |
| `"jira"` | STOP — output the standard Jira not-implemented message (Section 2.4) |
| absent or `""` | Treat as `"file-system"` — default behavior when field is not set |
| any other value | STOP — output the unsupported backend error (Section 2.5) |

### 2.4 Jira Not-Implemented Message (FR139)

When `tracking_system: jira` is detected, skills MUST output this exact message and halt:

> "Jira backend is not yet implemented. The `tracking_system` field in sprint-status.yaml is set to `jira`, but Jira integration requires Epic 14 (External Tooling Integration). Set `tracking_system: file-system` to use local file management, or wait for Jira support."

Skills MUST NOT proceed with any file-system fallback when `jira` is configured. Explicit halt with a clear message is required (no silent fallback — see also Section 6.4).

### 2.5 Unsupported Backend Error

When `tracking_system` is set to any value other than `file-system` or `jira`:

> "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira` (future)."

### 2.6 Detection Timing

The backend detection check occurs at the **START** of every skill workflow, before any read or write operations. It is a gateway check, not an afterthought. No skill logic executes before the backend is confirmed.

### 2.7 Default Behavior

If `tracking_system` is absent from `sprint-status.yaml` or is an empty string, the skill treats the backend as `file-system`. This ensures backward compatibility with files created before the field was introduced and with minimal/bootstrapped configurations.

---

## 3. Adapter Interface Contract

This section enumerates every data operation category that the 13 sprint management skills perform. This is the contract that:
1. All skills reference when reading/writing sprint data
2. The Jira adapter (Epic 14, Story 14.4) must implement to replace the "not yet implemented" stubs

All operations consume and produce data conforming to the `sprint-status.yaml` schema (Story 17.9, Sections 1-4). The schema IS the data contract for all backends.

### 3.1 Read Operations

| Operation | Description | Returns |
|---|---|---|
| `readFullState()` | Read the entire sprint-status.yaml equivalent | Full data model: metadata + epics map + backlog array + sprints map |
| `findItem(id)` | Search backlog and all sprint items for a specific item ID | Item object + location (`backlog` or `sprint-N`) |
| `readSprint(sprintId)` | Read a single sprint entity with its items | Sprint object including `items` array |
| `readBacklog()` | Read the backlog array | Array of backlog item objects (ordered by priority) |
| `readEpics()` | Read the epics map | Map of epic-N → epic object |

### 3.2 Write Operations

| Operation | Description | Notes |
|---|---|---|
| `writeFullState(data)` | Write the complete data model | Used by bootstrap/regeneration skills (e.g., `bmad-sprint-planning`, `generate-backlog`) |
| `updateItemStatus(id, newStatus)` | In-place status update on an item wherever it resides | Item does not move between sections; status field updated in-place (see schema Section 6.2) |
| `moveItemToSprint(id, targetSprintId)` | Atomic move from backlog to sprint | Drops `priority` field; validates item has status `ready-for-dev`; atomic (remove from backlog + add to sprint in single write) |
| `moveItemToBacklog(id)` | Atomic move from sprint to backlog | Adds `priority` field (max existing + 1); resets status to `ready-for-dev`; atomic |
| `addItems(section, items)` | Add new items to backlog or a specific sprint | Used for new story/bug creation |
| `removeItems(section, itemIds)` | Remove items from backlog or a sprint | Used by archival operations |
| `updateBacklogPriorities(orderedIds)` | Reorder backlog and renumber `priority` fields | Array position 0 = `priority: 1`; all priorities renumbered to match new order |

### 3.3 Lifecycle Operations

| Operation | Description | Notes |
|---|---|---|
| `createSprint(sprintData)` | Add a new sprint entry to the `sprints` map | New sprint starts in `planning` status |
| `activateSprint(sprintId)` | Transition sprint from `planning` to `active` | Enforces single-active constraint (Section 6.4 of schema) |
| `closeSprint(sprintId)` | Transition sprint from `active` to `closed` | Sprint becomes immutable after this operation |
| `archiveItems(itemIds, archivePath)` | Remove items from sprint-status.yaml and move story files | Moves `{story_location}/{id}.md` → `{story_location}/done/{id}.md`; removes item from file |
| `updateEpics(epicsData)` | Refresh the epics section | Used after sprint close or backlog regeneration |

### 3.4 Schema Invariants Enforced by All Operations

Regardless of backend, all operations MUST enforce the invariants defined in sprint-status-schema.md Section 6:

- **Single-location invariant** — An item ID appears in exactly one location (backlog OR one sprint's items, never both)
- **In-place status update rule** — Status changes do not move items between sections
- **Done-removal rule** — Done items are removed from the file and archived to `done/`
- **Single-active-sprint constraint** — At most one sprint has `status: active` at any time
- **Valid sprint status transitions** — `planning → active → closed` only, no reversals

### 3.5 Skill-to-Operation Mapping

Which operations each skill invokes (see Section 5 for the full skill mapping table):

| Operation | Skills That Invoke It |
|---|---|
| `readFullState()` | `bmad-sprint-planning` (to check existing state), `sprint-status-view`, `bmad-sprint-status`, `close-sprint` |
| `findItem(id)` | `bmad-dev-story`, `story-status-lookup`, `add-to-sprint`, `remove-from-sprint` |
| `readSprint(sprintId)` | `modify-sprint`, `close-sprint`, `sprint-status-view` |
| `readBacklog()` | `add-to-sprint`, `prioritize-backlog`, `sprint-status-view`, `generate-backlog` |
| `readEpics()` | `generate-backlog`, `bmad-sprint-planning` |
| `writeFullState(data)` | `bmad-sprint-planning`, `generate-backlog` |
| `updateItemStatus(id, newStatus)` | `bmad-dev-story` |
| `moveItemToSprint(id, targetSprintId)` | `add-to-sprint` |
| `moveItemToBacklog(id)` | `remove-from-sprint`, `close-sprint` (for undisposed items) |
| `addItems(section, items)` | `generate-backlog`, `bmad-sprint-planning` |
| `removeItems(section, itemIds)` | `cleanup-done`, `close-sprint` |
| `updateBacklogPriorities(orderedIds)` | `prioritize-backlog`, `remove-from-sprint` (appends one item) |
| `createSprint(sprintData)` | `add-sprint` |
| `activateSprint(sprintId)` | `modify-sprint` (when changing sprint status to active) |
| `closeSprint(sprintId)` | `close-sprint` |
| `archiveItems(itemIds, archivePath)` | `cleanup-done`, `close-sprint` |
| `updateEpics(epicsData)` | `generate-backlog`, `bmad-sprint-planning` |

---

## 4. Skill Instruction Template

### 4.1 The Backend Detection Block

This is the **exact markdown instruction block** that each sprint management skill's SKILL.md embeds at the start of its workflow. Skills embed this verbatim (or adapt it to their specific context while preserving all branch logic and message text).

```markdown
## Backend Detection

Before performing any read or write operations:

1. Read `sprint-status.yaml` from `_bmad-output/implementation-artifacts/sprint-status.yaml`
   (or the path resolved via `sprint_management_path` in `_bmad/bmm/config.yaml` for multi-repo mode)
   and extract the `tracking_system` metadata field.

2. If `tracking_system` is `file-system` (or absent/empty):
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`: **STOP** — output the following message and halt:
   > "Jira backend is not yet implemented. The `tracking_system` field in sprint-status.yaml
   > is set to `jira`, but Jira integration requires Epic 14 (External Tooling Integration).
   > Set `tracking_system: file-system` to use local file management, or wait for Jira support."

4. If `tracking_system` is any other value: **STOP** — output:
   > "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira` (future)."
```

### 4.2 Placement Rules

- The backend detection block MUST appear **before** the skill's main workflow steps — it is a gateway check, not an afterthought
- No skill logic (reads, writes, user prompts for data) executes before the backend is confirmed
- The block is placed immediately after the skill's introductory description, before any numbered workflow steps

### 4.3 Where to Embed the Template

The template MUST appear in:

- **IDE skill version:** `skills/<name>/SKILL.md` — embedded in the skill workflow
- **BMAD extension version (where applicable):** `lib/bmad-extension/skills/<name>/SKILL.md` — same template embedded in the BMAD extension version

IDE-only skills (e.g., `story-status-lookup` per Story 17.19) embed the template only in their single SKILL.md. Dual-pipeline skills embed it in both copies.

### 4.4 Future Evolution (When Jira Is Implemented)

When the Jira adapter is implemented in Epic 14 (Story 14.4), the `jira` branch in each skill's SKILL.md will be replaced with actual Jira adapter instructions. The replacement will:
- Remove the "not yet implemented" halt message
- Add the Jira operation instructions (API calls, data mapping, error handling)
- Maintain the same conditional structure so the `file-system` path is unchanged

No changes to the detection logic structure are required — only the `jira` branch body changes.

### 4.5 Existing Implementation: story-status-lookup

The `story-status-lookup` skill (Story 17.19) already contains a Jira extension point placeholder that predates this specification. Its "Future: Jira Backend" section is the first instance of the adapter pattern. This specification formalizes and generalizes that approach for all 13 skills.

The existing placeholder in `skills/story-status-lookup/SKILL.md` uses a slightly different structure (checking `project-context.md` instead of `sprint-status.yaml`) because it was written before the unified schema defined `tracking_system` in the YAML file itself. When Story 17.19 reworks `story-status-lookup`, it will align to the standard template above.

---

## 5. Skill-to-Operation Mapping Table

All 13 sprint management skills, their story numbers, deployment pipelines, operations used, and read/write classification.

| Skill | Story | Pipeline | Read/Write | Operations Used | Notes |
|---|---|---|---|---|---|
| `generate-backlog` | 17.10 | IDE + BMAD | Write | `readEpics`, `readBacklog`, `writeFullState`, `addItems`, `updateEpics` | Regenerates backlog and epics sections from story files |
| `add-to-sprint` | 17.11 | IDE + BMAD | Write | `findItem`, `readBacklog`, `moveItemToSprint` | Moves items backlog → sprint; validates `ready-for-dev` status |
| `remove-from-sprint` | 17.12 | IDE + BMAD | Write | `findItem`, `moveItemToBacklog`, `updateBacklogPriorities` | Moves items sprint → backlog; resets status to `ready-for-dev` |
| `sprint-status-view` | 17.13 | IDE + BMAD | Read-only | `readFullState`, `readSprint`, `readBacklog` | Renders sprint progress display; no writes |
| `cleanup-done` | 17.14 | IDE + BMAD | Write | `readFullState`, `removeItems`, `archiveItems`, `updateEpics` | Archives done items; removes from file; moves story files |
| `bmad-sprint-planning` | 17.15 | IDE + BMAD | Write | `readFullState`, `readEpics`, `writeFullState`, `addItems`, `updateEpics` | Bootstraps entire sprint-status.yaml from scratch |
| `add-sprint` | 17.16 | IDE + BMAD | Write | `readFullState`, `createSprint` | Adds new sprint entry |
| `modify-sprint` | 17.17 | IDE + BMAD | Write | `readSprint`, `activateSprint`, `updateEpics` | Updates sprint metadata or item order; handles activate transition |
| `bmad-dev-story` | 17.18 | IDE + BMAD | Write | `findItem`, `updateItemStatus` | Updates item status during development workflow |
| `story-status-lookup` | 17.19 | IDE only | Read-only | `findItem` | Searches for item status; used by `auto-bug-detection`; always-loaded skill |
| `bmad-sprint-status` | 17.20 | IDE + BMAD | Read-only | `readFullState` | Summarizes sprint health metrics; no writes |
| `close-sprint` | 17.21 | IDE + BMAD | Write | `readFullState`, `readSprint`, `removeItems`, `archiveItems`, `moveItemToBacklog`, `closeSprint`, `updateEpics` | Full sprint close lifecycle |
| `prioritize-backlog` | 17.24 | IDE + BMAD | Write | `readBacklog`, `updateBacklogPriorities` | Reorders backlog items by priority criteria |

### 5.1 Consistency with Skill Integration Map

This mapping is consistent with the Skill Integration Map in sprint-status-schema.md (Section 7). The schema document lists the same 13 skills with their operation categories and rework levels.

### 5.2 Read-Only vs Write Classification

**Read-only skills** (simpler to adapt for Jira — no write API mapping needed):
- `sprint-status-view` (17.13)
- `story-status-lookup` (17.19)
- `bmad-sprint-status` (17.20)

**Write skills** (require careful Jira API mapping for mutations):
- All remaining 10 skills (17.10, 17.11, 17.12, 17.14, 17.15, 17.16, 17.17, 17.18, 17.21, 17.24)

### 5.3 Pipeline Classification

**IDE-only skills:**
- `story-status-lookup` (17.19) — always-loaded skill, no BMAD extension needed

**Dual-pipeline skills (IDE + BMAD extension):**
- All remaining 12 skills embed the backend detection template in both `skills/<name>/SKILL.md` and `lib/bmad-extension/skills/<name>/SKILL.md`

---

## 6. Jira Adapter Requirements for Epic 14

This section defines the requirements that the Jira adapter implementation (Epic 14, Story 14.4) must satisfy. It is written as a contract for the Epic 14 architect (Story 14.3) and developer (Story 14.4).

### 6.1 Operation Coverage

The Jira adapter MUST implement every operation category defined in Section 3. There are no operations that are inherently N/A for Jira — all sprint management operations have Jira equivalents:

| Adapter Operation | Jira API Equivalent |
|---|---|
| `readFullState()` | Query sprint board + backlog + all sprints |
| `findItem(id)` | Jira issue search by key/ID |
| `readSprint(sprintId)` | Agile sprint issues API |
| `readBacklog()` | Agile board backlog API |
| `readEpics()` | Epic-level JQL query |
| `writeFullState(data)` | Bulk create/update (bootstrapping only — rare in Jira context) |
| `updateItemStatus(id, newStatus)` | Jira issue transition API |
| `moveItemToSprint(id, targetSprintId)` | Add issue to sprint API |
| `moveItemToBacklog(id)` | Remove issue from sprint (move to board backlog) |
| `addItems(section, items)` | Jira issue create API |
| `removeItems(section, itemIds)` | Archive/delete via Jira transition |
| `updateBacklogPriorities(orderedIds)` | Jira board rank update API |
| `createSprint(sprintData)` | Jira sprint create API |
| `activateSprint(sprintId)` | Jira sprint start API |
| `closeSprint(sprintId)` | Jira sprint close API |
| `archiveItems(itemIds, archivePath)` | Jira issue resolution + local story file move |
| `updateEpics(epicsData)` | Jira epic update API |

### 6.2 Jira Data Model Mapping

The adapter MUST map Jira entities to the canonical sprint-status.yaml schema (Story 17.9 Sections 2-4):

| Jira Entity | Canonical Schema | Notes |
|---|---|---|
| Jira Sprint | `sprints[]` entry | `items` populated from sprint issues API; `status` mapped from Jira sprint state |
| Board Backlog | `backlog[]` entries | Issues not in any sprint; `priority` from Jira rank |
| Jira Epic | `epics[]` entry | `status` derived from epic's resolution and linked story states |
| Jira Issue Status | Canonical status vocabulary | See Section 6.3 for status mapping |

### 6.3 Status Mapping

Jira workflow statuses vary by project. The adapter MUST use a **configurable status mapping** defined in the project configuration (details deferred to Epic 14, Story 14.1 research and Story 14.3 architecture). Default mapping guidance:

| Canonical Status | Example Jira Workflow Status |
|---|---|
| `backlog` | "Backlog", "Open" |
| `ready-for-dev` | "Selected for Development", "To Do" |
| `in-progress` | "In Progress" |
| `review` | "In Review", "Code Review" |
| `done` | "Done", "Resolved", "Closed" |
| `on-hold` | "On Hold", "Blocked" |
| `cancelled` | "Won't Do", "Cancelled" |

The mapping MUST be configurable because Jira workflow status names are project-specific. A default mapping is a starting point only.

### 6.4 Error Handling Requirements

The Jira adapter MUST handle errors explicitly. **No silent fallback to the file-system backend is permitted.**

| Error Type | Required Behavior |
|---|---|
| Network errors | Report error with connection details; do NOT fall back to `file-system` |
| Authentication failures (HTTP 401/403) | Report credential issue; suggest checking project configuration |
| Rate limits (HTTP 429) | Report rate limit hit; include `Retry-After` value if available; do NOT fall back |
| API errors (other 4xx/5xx) | Report the specific error with HTTP status and Jira error message |
| Missing credentials | Detect at detection time (before any operations); report with clear message |

Every error message must identify itself as coming from the Jira adapter and provide actionable guidance.

### 6.5 Credential Configuration

Credential storage and configuration are **deferred to Epic 14 research** (Story 14.1) and architecture (Story 14.3). This specification only requires that:

- The adapter has access to credentials before executing any API call
- Missing or invalid credentials cause a clear error at detection time (not mid-operation)
- Credential storage location is documented in `project-context.md` or equivalent project configuration

This specification does not prescribe whether credentials are stored as environment variables, in a secrets file, or in a secrets manager.

### 6.6 Source of Truth When Jira Is Active

When `tracking_system: jira` is active:
- **Jira is the source of truth** — not `sprint-status.yaml`
- The local `sprint-status.yaml` file MAY exist as a read-only cache but MUST NOT be written to by any skill
- Skills MUST read from and write to Jira via the adapter only
- Any local cache is informational only; skills do not rely on cache freshness

### 6.7 Extensibility for Future Backends

The adapter pattern MUST support future backends (Linear, Azure DevOps, GitHub Projects). Adding a new backend requires changes only to skill SKILL.md files (adding a new branch) and the new adapter implementation — it does NOT require restructuring or replacing existing skill logic. Extensibility mechanism:

1. The `tracking_system` field in `sprint-status.yaml` gains a new valid value (e.g., `"linear"`, `"azure-devops"`)
2. Each skill's backend detection block gains a new branch for the new value (additive change only)
3. A new adapter implementation is created for the new backend
4. The `file-system` branch in every skill is completely unchanged — only the new branch is added

The skill instruction template (Section 4.1) is designed to be extended: new `else if tracking_system is X` branches are added alongside the `jira` branch, with the `unknown value` catch-all remaining at the end. See Section 8 for the full extension pattern.

---

## 7. Deployment Pipeline Integration

### 7.1 No Shared Adapter Module

The adapter pattern does **not** create a shared module, library, or importable file. Skills are markdown instruction documents executed by AI agents. The "adapter" is a pattern embedded in each skill's instructions, not a code artifact. This is consistent with how both deployment pipelines work — they deploy self-contained instruction documents.

### 7.2 Pipeline 1: IDE Skills

Each IDE skill at `skills/<name>/SKILL.md` embeds the backend detection template from Section 4.1. The deployment flow:

```
Source:   skills/<name>/SKILL.md    (contains backend detection template)
              ↓ lib/installer.js (deploys unchanged)
Deployed: .claude/skills/<name>/SKILL.md
          .cursor/skills/<name>/SKILL.md
          (etc. for all configured IDE agent directories)
```

**No changes to `lib/installer.js`** — the adapter pattern is in the skill content, not the deployment mechanism. The installer deploys skills verbatim.

**NEVER edit installed copies** under `.claude/skills/`, `.cursor/skills/`, etc. Always edit the source at `skills/<name>/SKILL.md`.

### 7.3 Pipeline 2: BMAD Extension Skills

Each BMAD extension skill at `lib/bmad-extension/skills/<name>/SKILL.md` embeds the same backend detection template. The deployment flow:

```
Source:   lib/bmad-extension/skills/<name>/SKILL.md    (contains backend detection template)
              ↓ lib/bmad.js (deploys unchanged)
Deployed: _bmad/extensions/ma-agents-skills/<name>/SKILL.md
```

**No changes to `lib/bmad.js`** — same principle as Pipeline 1. The BMAD deployer copies skills verbatim.

### 7.4 IDE-Only vs Dual-Pipeline Skills

| Classification | Skills | Where Template Appears |
|---|---|---|
| IDE-only | `story-status-lookup` (17.19) | `skills/story-status-lookup/SKILL.md` only |
| Dual-pipeline | All other 12 skills | Both `skills/<name>/SKILL.md` AND `lib/bmad-extension/skills/<name>/SKILL.md` |

See Section 5 (Skill-to-Operation Mapping Table) for the complete pipeline classification of all 13 skills.

### 7.5 File Path Resolution

The `sprint-status.yaml` path is resolved as follows — **the adapter pattern does not affect file location logic**:

- **Single-repo mode:** `sprint_management_path` from `_bmad/bmm/config.yaml` defaults to `.` (project root). The file is at `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Multi-repo mode:** `sprint_management_path` from `_bmad/bmm/config.yaml` resolves to the sprint management repository root.

Path resolution is unchanged by this story. All 13 skills use the same path resolution they used before this specification was written.

---

## 8. Future Backend Extensibility

### 8.1 Adding a New Backend

To add support for a new backend (e.g., Linear, Azure DevOps, GitHub Projects):

1. **Define the new `tracking_system` value** — document the new valid value (e.g., `"linear"`)
2. **Update the schema** — add the new value to the `tracking_system` field's valid values in `sprint-status-schema.md`
3. **Update the skill instruction template** — add a new branch to the backend detection block in Section 4.1 of this document
4. **Update each skill SKILL.md** — add the new branch to each of the 13 skills' backend detection blocks
5. **Implement the adapter** — create the new adapter implementation (Epic 14 or equivalent)

Steps 1-4 are the only structural changes required to existing skill files. The new adapter branch body follows the same pattern as the Jira branch.

### 8.2 Template Extension Pattern

The backend detection block from Section 4.1 extends as follows when a new backend is added:

```markdown
## Backend Detection

Before performing any read or write operations:

1. Read `sprint-status.yaml` and extract the `tracking_system` metadata field.

2. If `tracking_system` is `file-system` (or absent/empty):
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   [Replace "not yet implemented" message with Jira adapter instructions when Epic 14 is complete]

4. If `tracking_system` is `linear`:
   [New backend instructions added here — new branch without touching existing branches]

5. If `tracking_system` is any other value: **STOP** — output:
   > "Unsupported tracking system: `{value}`. Supported values are `file-system`, `jira`, and `linear`."
```

New backends are additive — they insert a new numbered branch before the catch-all `unknown value` branch. Existing branches are not modified.

### 8.3 Consistency Requirement

When a new backend is added, the template must be updated consistently across all 13 skills. This is a known operational cost of the embedded-pattern approach (vs. a shared module). The benefit is that skills remain self-contained instruction documents with no external dependencies.

---

## Cross-References

| Reference | Description |
|---|---|
| `sprint-status-schema.md` | Story 17.9: Unified YAML schema — the data contract for all backends |
| Architecture P2-11 | Decision: Unified Sprint-Status File Architecture, including Jira Adapter Pattern subsection |
| PRD FR133, FR138, FR139, FR140 | Requirements addressed by this specification |
| Story 17.19 (`story-status-lookup`) | Existing Jira extension point placeholder — first instance of the adapter pattern |
| Stories 17.10-17.21, 17.24 | All 13 skills that embed the backend detection template from Section 4 |
| Epic 14, Story 14.1 | Analyst research on Jira integration — informs adapter requirements |
| Epic 14, Story 14.3 | Architecture design for external tooling abstraction layer — must satisfy Section 6 |
| Epic 14, Story 14.4 | Jira backend implementation — implements the adapter operations from Section 3 |
