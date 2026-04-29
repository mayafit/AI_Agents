# Sprint Backend Routing Pattern Specification

> Canonical detection pattern for sprint management skill backend routing.
>
> **Story:** 17.22 — Backend Routing (tracking_system Switch)
> **Architecture:** Decision P2-11 (revised 2026-04-29)
> **Companion document:** `sprint-status-schema.md` (Story 17.9)
> **Consumers:** 13 skills (Stories 17.10-17.21, 17.24) + Epic 14 Jira integration (Stories 14.1, 14.3)

---

## 1. Overview and Purpose

### 1.1 What This Specification Defines

This document defines the **backend routing pattern** that all 13 sprint management skills use to route operations based on the `tracking_system` field in `sprint-status.yaml`. It is the companion to Story 17.9's schema specification:

| Specification | Story | Deliverable | Defines |
|---|---|---|---|
| Data model | 17.9 | `sprint-status-schema.md` | What the data looks like |
| Routing pattern | 17.22 | `mcp-detection-pattern-spec.md` | How skills route to Jira or file-system, and how failures are handled |

Together, these two documents form the complete interface specification for the sprint management system.

### 1.2 What This Specification Is Not

This specification does **not**:
- Create any executable code, modules, or libraries
- Modify any existing skill files — Stories 17.10-17.21 and 17.24 each embed the template themselves
- Require credentials management or authentication design
- Change any deployment pipeline logic (no changes to `lib/installer.js` or `lib/bmad.js`)

### 1.3 Design Approach — Tool-Agnostic Jira Operations

Skills in this project are **markdown instruction documents**, not executable code. A SKILL.md file is a natural-language instruction set that AI agents follow. There is no runtime, no module system, no import mechanism.

The design therefore uses **tool-agnostic Jira operation instructions**:

- When `tracking_system: jira`, each skill instructs the agent to perform the required Jira operation in natural language
- The agent uses whatever Jira-capable tool it has available (any MCP server, plugin, or native integration connected to the configured Jira instance)
- No specific tool names, MCP server names, or API endpoints are hard-coded into skill instructions
- On failure, the skill pauses and asks the user to retry or switch to file management
- The "routing block" is a conditional instruction block embedded in each SKILL.md, not a shared code module

### 1.4 Relationship to PRD Requirements

| Requirement | Description | How This Specification Addresses It |
|---|---|---|
| FR138 | Same data model, different storage backend (`tracking_system` switch) | Defines the detection pattern: same schema (Story 17.9), MCP routing when available |
| FR139 | Install-time backend selection: the installer wizard adds Jira as a 4th sprint management option; when selected, stores `jira_url` and `jira_project_key` in config; `tracking_system` field in `sprint-status.yaml` reflects the active selection | Section 2.1 defines the `tracking_system` field that reflects the install-time selection; Section 2.4 defines the full Jira behavior (Phase A placeholder + Phase B interactive error handling) when that field is `jira` |
| FR140 | When `tracking_system: jira` is active, all sprint management skills operate against Jira using whatever Jira-capable tool the agent has available; on failure the skill asks the user to retry or switch to file management | Provides the routing template (Sections 4.1-A and 4.1-B) that all 13 skills embed; defines the interactive failure model (Section 6.4) |
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
   - **`jira`** → execute the two-phase behavior defined in Section 2.4: Phase A outputs a placeholder message and falls back to file-system; Phase B attempts the Jira operation and handles failure interactively
   - **absent or empty** → treat as `file-system` (default behavior)
   - **any other value** → output unsupported backend error, then fall back to file-system

### 2.3 Branch Definitions

| `tracking_system` value | Action |
|---|---|
| `"file-system"` | Proceed with local YAML read/write as defined in the skill's workflow |
| `"jira"` | Attempt the Jira operation using whatever Jira-capable tool is available; on failure, ask user to retry or switch (Section 2.4) |
| absent or `""` | Treat as `"file-system"` — default behavior when field is not set |
| any other value | Output unsupported backend message (Section 2.5), then proceed with file-system fallback |

### 2.4 Jira Backend Behavior (FR139/FR140)

There are two phases of implementation for the `jira` branch:

---

**Phase A — Placeholder (Story 17.22, before Epic 14 Story 14.3 completes):**

When `tracking_system: jira` is detected and the Jira operation body has not yet been filled in, the skill outputs the following message and falls back to file-system:

> "Jira tracking is configured (`tracking_system: jira`), but Jira operation support for this skill is not yet implemented (pending Epic 14 Story 14.3). Operating in file-system mode."

The skill then continues with the normal file-system workflow.

---

**Phase B — Full implementation (after Epic 14 Story 14.3 fills in each skill's Jira operation instructions):**

When `tracking_system: jira` is detected, the skill instructs the agent to perform the required Jira operation using whatever Jira-capable tool is available (any MCP server, plugin, or integration connected to the configured Jira instance):

- **Success:** Jira is the source of truth. The skill continues using the returned Jira data.
- **Failure — no Jira-capable tool available:** The skill pauses and presents the user with a message explaining that no Jira tool is configured and describing what to configure (an MCP server, plugin, or native integration connected to the Jira instance URL). Options are (a) Retry once configured or (b) Switch to file-system backend permanently.
- **Failure — Jira tool returned an error:** The skill pauses and presents the user with the actual Jira error details. Options are (a) Retry or (b) Switch to file-system backend permanently.

  In both failure cases, if the user chooses (b), the skill writes `tracking_system: file-system` to `sprint-status.yaml` and updates `sprint_backend` in `_bmad/bmm/config.yaml`, then completes the operation using the local file.

The two failure cases are distinguished so the user receives actionable guidance: a missing-tool failure directs the user to configure a Jira integration, while an API error surfaces the actual error for diagnosis.

### 2.5 Unsupported Backend Message

When `tracking_system` is set to any value other than `file-system` or `jira`:

> "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira`. Proceeding with file-system backend."

The skill falls back to file-system (no halt).

### 2.6 Detection Timing

The backend detection check occurs at the **START** of every skill workflow, before any read or write operations. It is a gateway check, not an afterthought. No skill logic executes before the backend is confirmed.

### 2.7 Default Behavior

If `tracking_system` is absent from `sprint-status.yaml` or is an empty string, the skill treats the backend as `file-system`. This ensures backward compatibility with files created before the field was introduced and with minimal/bootstrapped configurations.

---

## 3. Sprint Data Operations Catalog

This section enumerates every data operation that the 13 sprint management skills need to perform. It serves two purposes:
1. Documents what each skill needs to do (useful for both file-system and Jira paths)
2. Defines what Epic 14 Story 14.3 must map to Jira MCP tool calls when filling in each skill's Jira branch body

All operations produce data conforming to the `sprint-status.yaml` schema (Story 17.9, Sections 1-4). The schema is the canonical data contract regardless of backend. Note: these are natural-language operation descriptions, not code interfaces — there is no shared module or callable API.

### 3.1 Read Operations

| Operation | Description | Returns |
|---|---|---|
| Read full state | Read the entire sprint-status.yaml equivalent | Full data model: metadata + epics map + backlog array + sprints map |
| Find item by ID | Search backlog and all sprint items for a specific item ID | Item object + location (`backlog` or `sprint-N`) |
| Read sprint by ID | Read a single sprint entity with its items | Sprint object including `items` array |
| Read backlog | Read the backlog array | Array of backlog item objects (ordered by priority) |
| Read epics | Read the epics map | Map of epic-N → epic object |

### 3.2 Write Operations

| Operation | Description | Notes |
|---|---|---|
| Write full state | Write the complete data model | Used by bootstrap/regeneration skills (e.g., `bmad-sprint-planning`, `generate-backlog`) |
| Update item status | In-place status update on an item wherever it resides; item ID and new status value provided | Item does not move between sections; status field updated in-place (see schema Section 6.2) |
| Move item to sprint | Atomic move from backlog to a target sprint | Drops `priority` field; validates item has status `ready-for-dev`; atomic (remove from backlog + add to sprint in single write) |
| Move item to backlog | Atomic move from sprint to backlog | Adds `priority` field (max existing + 1); resets status to `ready-for-dev`; atomic |
| Add items | Add new items to backlog or a specific sprint section | Used for new story/bug creation |
| Remove items | Remove items from backlog or a sprint section | Used by archival operations |
| Reorder backlog priorities | Reorder backlog and renumber `priority` fields based on a provided ordered list | Array position 0 = `priority: 1`; all priorities renumbered to match new order |

### 3.3 Lifecycle Operations

| Operation | Description | Notes |
|---|---|---|
| Create sprint | Add a new sprint entry to the `sprints` map using provided sprint data | New sprint starts in `planning` status |
| Activate sprint | Transition sprint from `planning` to `active` | Enforces single-active constraint (Section 6.4 of schema) |
| Close sprint | Transition sprint from `active` to `closed` | Sprint becomes immutable after this operation |
| Archive items | Remove items from sprint-status.yaml and move story files to archive path | Moves `{story_location}/{id}.md` → `{story_location}/done/{id}.md`; removes item from file |
| Update epics | Refresh the epics section with provided epics data | Used after sprint close or backlog regeneration |

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
| Read full state | `bmad-sprint-planning` (to check existing state), `sprint-status-view`, `bmad-sprint-status`, `close-sprint` |
| Find item by ID | `bmad-dev-story`, `story-status-lookup`, `add-to-sprint`, `remove-from-sprint` |
| Read sprint by ID | `modify-sprint`, `close-sprint`, `sprint-status-view` |
| Read backlog | `add-to-sprint`, `prioritize-backlog`, `sprint-status-view`, `generate-backlog` |
| Read epics | `generate-backlog`, `bmad-sprint-planning` |
| Write full state | `bmad-sprint-planning`, `generate-backlog` |
| Update item status | `bmad-dev-story` |
| Move item to sprint | `add-to-sprint` |
| Move item to backlog | `remove-from-sprint`, `close-sprint` (for undisposed items) |
| Add items | `generate-backlog`, `bmad-sprint-planning` |
| Remove items | `cleanup-done`, `close-sprint` |
| Reorder backlog priorities | `prioritize-backlog`, `remove-from-sprint` (appends one item) |
| Create sprint | `add-sprint` |
| Activate sprint | `modify-sprint` (when changing sprint status to active) |
| Close sprint | `close-sprint` |
| Archive items | `cleanup-done`, `close-sprint` |
| Update epics | `generate-backlog`, `bmad-sprint-planning` |

---

## 4. Skill Instruction Template

### 4.1 The Backend Routing Block — Two Templates

There are two templates: the **Phase A template** (embedded by Story 17.22 with a placeholder Jira body) and the **Phase B template** (replaces the placeholder when Epic 14 Story 14.3 fills in each skill's Jira operation instructions). Story 14.3 replaces only the `jira` branch body — the surrounding routing structure is identical in both.

---

#### 4.1-A Phase A Template (Story 17.22 — embed in all 13 skills immediately)

```markdown
## Backend Routing

Before performing any read or write operations:

1. Read `sprint-status.yaml` from `_bmad-output/implementation-artifacts/sprint-status.yaml`
   (or the path resolved via `sprint_management_path` in `_bmad/bmm/config.yaml` for multi-repo mode)
   and extract the `tracking_system` metadata field.

2. If `tracking_system` is `file-system` (or absent/empty):
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   Output the following message, then proceed with the **File-System Backend** instructions below:
   > "Jira tracking is configured (`tracking_system: jira`), but Jira operation support for
   > this skill is not yet implemented (pending Epic 14 Story 14.3). Operating in file-system mode."

4. If `tracking_system` is any other value: output the following message, then proceed with
   the **File-System Backend** instructions below (do not halt):
   > "Unsupported tracking system: `{value}`. Supported values are `file-system` and `jira`.
   > Proceeding with file-system backend."
```

---

#### 4.1-B Phase B Template (Epic 14 Story 14.3 — replace placeholder `jira` branch in each skill)

Story 14.3 replaces step 3 above with the following structure, using the Jira operation description documented for each skill (from Section 6.2):

```markdown
3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: [SKILL-SPECIFIC JIRA OPERATION DESCRIPTION — filled in by Story 14.3]
      Use whatever Jira-capable tool is available in your current tool context.
      Map Jira entities to the canonical schema (Sprint → sprints[], Backlog → backlog[],
      Epic → epics[], Jira status → canonical vocabulary per Section 6.3 of this spec).
   b. If the Jira operation SUCCEEDS: continue with the Jira data returned. Jira is the source of truth.
   c. If the Jira operation FAILS for any reason:
      - If no Jira-capable tool is available in your current context:
        Pause and present the user with:
        > "No Jira-capable tool is available. To use Jira tracking, configure a Jira integration
        > in your agent (an MCP server, plugin, or native integration connected to the Jira
        > instance at `{jira_url}`). How would you like to proceed?
        > (a) Retry — attempt the Jira operation again once a Jira tool is configured
        > (b) Switch to file management — update sprint-status.yaml and config to use
        >     file-system backend, then complete this operation locally. This change is permanent."
      - If a Jira tool attempted the operation but returned an error:
        Pause and present the user with:
        > "The Jira operation failed: {actual Jira error details}. How would you like to proceed?
        > (a) Retry — attempt the Jira operation again
        > (b) Switch to file management — update sprint-status.yaml and config to use
        >     file-system backend, then complete this operation locally. This change is permanent."
      If user chooses (b) in either case: write `tracking_system: file-system` to `sprint-status.yaml`,
      update `sprint_backend: file-system` in `_bmad/bmm/config.yaml`,
      then proceed with **File-System Backend** instructions below.
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

### 4.4 Phase A to Phase B Evolution (Story 14.3)

Epic 14 Story 14.3 upgrades each skill from placeholder to full Jira implementation one at a time. For each skill:

1. Identify the Jira operation required for the skill (from Section 6.2 operation descriptions)
2. Replace step 3 in the Phase A template (Section 4.1-A) with the Phase B template (Section 4.1-B), inserting the skill-specific Jira operation description in step (a)
3. Add Jira status mapping per Section 6.3 where the skill reads or writes item status
4. Leave all other routing structure, the `file-system` branch, and step 4 unchanged

The placeholder message ("not yet implemented") is removed when the Phase B template is in place. No skill ships the placeholder permanently — Story 14.3 completes the full implementation for all 13 skills.

### 4.5 Existing Implementation: story-status-lookup

The `story-status-lookup` skill (Story 17.19) already contains a Jira extension point placeholder that predates this specification. Its "Future: Jira Backend" section is the first instance of the adapter pattern. This specification formalizes and generalizes that approach for all 13 skills.

The existing placeholder in `skills/story-status-lookup/SKILL.md` uses a slightly different structure (checking `project-context.md` instead of `sprint-status.yaml`) because it was written before the unified schema defined `tracking_system` in the YAML file itself. When Story 17.19 reworks `story-status-lookup`, it will align to the standard template above.

---

## 5. Skill-to-Operation Mapping Table

All 13 sprint management skills, their story numbers, deployment pipelines, operations used, and read/write classification.

| Skill | Story | Pipeline | Read/Write | Operations Used | Notes |
|---|---|---|---|---|---|
| `generate-backlog` | 17.10 | IDE + BMAD | Write | Read epics, Read backlog, Write full state, Add items, Update epics | Regenerates backlog and epics sections from story files |
| `add-to-sprint` | 17.11 | IDE + BMAD | Write | Find item by ID, Read backlog, Move item to sprint | Moves items backlog → sprint; validates `ready-for-dev` status |
| `remove-from-sprint` | 17.12 | IDE + BMAD | Write | Find item by ID, Move item to backlog, Reorder backlog priorities | Moves items sprint → backlog; resets status to `ready-for-dev` |
| `sprint-status-view` | 17.13 | IDE + BMAD | Read-only | Read full state, Read sprint by ID, Read backlog | Renders sprint progress display; no writes |
| `cleanup-done` | 17.14 | IDE + BMAD | Write | Read full state, Remove items, Archive items, Update epics | Archives done items; removes from file; moves story files |
| `bmad-sprint-planning` | 17.15 | IDE + BMAD | Write | Read full state, Read epics, Write full state, Add items, Update epics | Bootstraps entire sprint-status.yaml from scratch |
| `add-sprint` | 17.16 | IDE + BMAD | Write | Read full state, Create sprint | Adds new sprint entry |
| `modify-sprint` | 17.17 | IDE + BMAD | Write | Read sprint by ID, Activate sprint, Update epics | Updates sprint metadata or item order; handles activate transition |
| `bmad-dev-story` | 17.18 | IDE + BMAD | Write | Find item by ID, Update item status | Updates item status during development workflow |
| `story-status-lookup` | 17.19 | IDE only | Read-only | Find item by ID | Searches for item status; used by `auto-bug-detection`; always-loaded skill |
| `bmad-sprint-status` | 17.20 | IDE + BMAD | Read-only | Read full state | Summarizes sprint health metrics; no writes |
| `close-sprint` | 17.21 | IDE + BMAD | Write | Read full state, Read sprint by ID, Remove items, Archive items, Move item to backlog, Close sprint, Update epics | Full sprint close lifecycle |
| `prioritize-backlog` | 17.24 | IDE + BMAD | Write | Read backlog, Reorder backlog priorities | Reorders backlog items by priority criteria |

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

## 6. Jira Operation Descriptions (Epic 14 Story 14.1 → Story 14.3)

This section defines the mapping between sprint management operations and their Jira equivalents. It is written as a contract for Epic 14: Story 14.1 produces the operation descriptions; Story 14.3 embeds them in each skill's SKILL.md. Operation descriptions are tool-agnostic — no specific MCP server, tool name, or API endpoint is specified here.

### 6.1 Jira Connection Context

Skills operating in Jira mode use the Jira server URL and project key configured at install time (stored in `_bmad/bmm/config.yaml` under `jira_url` and `jira_project_key`). These values are referenced in operation instructions as `{jira_url}` and `{jira_project_key}`.

**Known limitation — Bulk write operations (`writeFullState`, `addItems` for many items):** These operations translate to multiple sequential Jira calls with no transactionality. If any call fails mid-way, Jira will be in partial state. Skills that use bulk writes in Jira mode (`bmad-sprint-planning`, `generate-backlog`) MUST:
1. Warn the user before proceeding: "This operation will create/update [N] Jira items. If it fails mid-way, Jira may be in partial state. Proceed?"
2. On failure: present the retry/switch prompt per Section 2.4.

### 6.2 Per-Skill Jira Operation Descriptions

This section provides a per-skill mapping from file-system operations to Jira equivalents. These descriptions are the contract that Story 14.3 embeds verbatim into each skill's Jira branch body (Section 4.1-B step (a)). All descriptions are tool-agnostic: no MCP server name, specific tool name, or API endpoint URL is used.

#### generate-backlog

| File-System Operations | Jira Equivalent |
|---|---|
| Read epics | Query all issues of type Epic in project `{jira_project_key}`. Build epics map from returned issues (key → summary). |
| Read backlog | Query all backlog issues (type Story or Bug) in project `{jira_project_key}` that are not assigned to any active sprint. |
| Write full state, Add items, Update epics | Create new Jira issues (type Story or Bug) for any backlog items not already in Jira; update the summary, type, and priority fields of existing issues if changed. One Jira API call per new or changed item. |

**Bulk write warning required.** Before executing writes, the skill MUST output: "This operation will create/update [N] Jira items. If it fails mid-way, Jira may be in partial state. Proceed?" On failure mid-way, present the retry/switch prompt per Section 2.4.

---

#### add-to-sprint

| File-System Operations | Jira Equivalent |
|---|---|
| Find item by ID | Search for the Jira issue matching the item ID in project `{jira_project_key}` — search by issue key if the item ID matches a Jira key format, otherwise search by summary match. |
| Read backlog | No separate Jira call required — item is identified in the find-item step above. |
| Move item to sprint | Find the active sprint on the board for project `{jira_project_key}`. Call the board's "move issue to sprint" operation to add the issue to the active sprint, removing it from the board backlog. |

No bulk write warning required (single-item operation).

---

#### remove-from-sprint

| File-System Operations | Jira Equivalent |
|---|---|
| Find item by ID | Search for the Jira issue matching the item ID in project `{jira_project_key}` — by issue key or summary match. |
| Move item to backlog | Call the "remove issue from sprint" operation to move the issue from the active sprint back to the board backlog (unassigned from sprint). Reset the issue's status to the canonical `ready-for-dev` equivalent per Section 6.3 if the current status is more advanced. |
| Reorder backlog priorities | After removal, query the current board backlog order. Append the removed issue to the end of the board backlog. Backlog ordering in Jira uses the board's ranking capability — update rank accordingly. |

No bulk write warning required (single-item operation).

---

#### sprint-status-view

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state | Query all sprint data for project `{jira_project_key}`: active sprint with its issues (statuses, types, summaries), all planning sprints, backlog issues, and epic-level summary. |
| Read sprint by ID | For each sprint to display: query the sprint's issue list with current statuses. |
| Read backlog | Query all backlog issues for project `{jira_project_key}` not assigned to any sprint. |

**Read-only.** No Jira writes. Map Jira sprint status (`future` → `planning`, `active` → `active`, `closed` → `closed`) and issue statuses to canonical schema vocabulary per Section 6.3 for display.

---

#### cleanup-done

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state | Query all issues in project `{jira_project_key}` that have a done or cancelled status (per Section 6.3 mapping). |
| Remove items | Transition all done/cancelled issues in project `{jira_project_key}` to the "Done" or "Resolved" workflow state if not already in that state. One issue transition call per item. |
| Archive items | **Hybrid operation:** Jira issues are NOT deleted — they remain in Jira as resolved. The local story file move (`{story_location}/{id}.md` → `{story_location}/done/{id}.md`) is a local file operation that executes regardless of backend. |
| Update epics | If all issues for an epic are now resolved, update the epic's status to "Done" in Jira. |

Note: the local file archive step (moving `.md` files to `done/`) always executes as a local operation, even in Jira mode.

---

#### bmad-sprint-planning

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state | Query all epics, all backlog issues (not assigned to any sprint), all sprint definitions, and all sprint item lists for project `{jira_project_key}`. Multiple sequential read calls required. |
| Read epics | Query all issues of type Epic in project `{jira_project_key}`. |
| Write full state, Add items | Create new Jira issues (type Story or Bug) for each planned item not already in Jira; update existing issues' fields if changed. One Jira API call per new or changed item. |
| Update epics | Update epic status fields in Jira to reflect the planned state. |

**Bulk write warning required.** Before executing writes, the skill MUST output: "This operation will create/update [N] Jira items. If it fails mid-way, Jira may be in partial state. Proceed?" On failure mid-way, present the retry/switch prompt per Section 2.4.

---

#### add-sprint

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state | Query existing sprints for the board associated with project `{jira_project_key}` to determine the next sprint number (for default name generation). |
| Create sprint | Create a new sprint on the board for project `{jira_project_key}` using the provided name, start date, and end date. The sprint is created in `future` (planning) state. The `capacity` field has no direct Jira equivalent — it is stored as a sprint goal annotation or custom field if available, otherwise noted only in local context. |

No bulk write warning required (single sprint creation).

---

#### modify-sprint

| File-System Operations | Jira Equivalent |
|---|---|
| Read sprint by ID | Query the sprint by ID from the board for project `{jira_project_key}` to retrieve current name, dates, and state. |
| Activate sprint | If the status change is `planning → active`: start the sprint using the sprint start API. This transitions the sprint from `future` to `active` state in Jira. Enforce the single-active-sprint constraint — check for an existing active sprint before starting. |
| Update epics | If sprint metadata changes affect epic tracking, update epic fields in Jira accordingly. |

For metadata-only changes (name, dates): update the sprint record using the sprint update API. For status change to `closed` without full close lifecycle: use the sprint close API directly (with the same warning to use `close-sprint` for full lifecycle).

---

#### bmad-dev-story

| File-System Operations | Jira Equivalent |
|---|---|
| Find item by ID | Search for the Jira issue matching the item ID in project `{jira_project_key}` — by issue key or summary match. |
| Update item status | Transition the issue to the new status using the issue transition API. Map canonical status to Jira workflow status per Section 6.3. Perform this transition twice during the story lifecycle: once to `in-progress` (at story start, Step 4) and once to `review` (at story completion, Step 9). |

The status transition is an in-place update — the issue does not move between Jira boards or sprints; only its workflow status changes.

---

#### story-status-lookup

| File-System Operations | Jira Equivalent |
|---|---|
| Find item by ID | Search for the Jira issue matching the item ID in project `{jira_project_key}` — by issue key if the item ID matches a Jira key format, otherwise by summary match. Return the issue's current workflow status. |

**Read-only.** Map the returned Jira status to the canonical vocabulary per Section 6.3 to determine Delivered vs. WIP classification.

---

#### bmad-sprint-status

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state | Query the active sprint for project `{jira_project_key}` — retrieve all issues in the sprint with their current statuses, types, and summaries. Query the backlog issue count. Query epic-level progress (count of resolved vs. open issues per epic). |

**Read-only.** No Jira writes. Map Jira sprint status and issue statuses to canonical schema vocabulary per Section 6.3 for health analysis and risk flag computation.

---

#### close-sprint

| File-System Operations | Jira Equivalent |
|---|---|
| Read full state, Read sprint by ID | Query all issues in the active sprint for project `{jira_project_key}` with their current statuses. |
| Remove items, Archive items | For done/cancelled items: transition each issue to the "Resolved" or "Done" workflow state in Jira (one transition call per item). Also perform the local file archive (`{story_location}/{id}.md` → `{story_location}/done/{id}.md`) as a local operation regardless of backend. |
| Move item to backlog | For incomplete items being returned to backlog: call "remove issue from sprint" to move each issue from the active sprint back to the board backlog. Reset status to `ready-for-dev` equivalent per Section 6.3. |
| Close sprint | Call the sprint close API to transition the sprint from active to closed state in Jira. |
| Update epics | After close, update epic statuses in Jira if all stories for an epic are now resolved. |

The local file archive step (moving `.md` files to `done/`) always executes as a local operation.

---

#### prioritize-backlog

| File-System Operations | Jira Equivalent |
|---|---|
| Read backlog | Query all backlog issues for project `{jira_project_key}` not assigned to any sprint. |
| Reorder backlog priorities | Apply the prioritization criteria. Reorder issues in the board backlog by updating each issue's rank or priority order. Use whatever backlog ranking capability is available on the board (issue ranking for next-gen boards, or priority field for classic boards). One rank-update call per issue whose rank changes. |

Note: Jira backlog ordering semantics vary by board type. Use the board's native ranking mechanism — do not assume a specific API method.

---

### 6.2.1 Jira Field Mapping

| sprint-status.yaml field | Jira field |
|---|---|
| `item.id` | Issue key (e.g. `MYPROJ-123`) used for lookup; or matched by summary when issue key is not yet known |
| `item.title` | Issue summary |
| `item.status` | Issue status (mapped via Section 6.3) |
| `item.type` | Issue type: `story` → Story, `bug` → Bug |
| `item.priority` | Issue priority field or board rank (board rank is preferred for backlog ordering) |
| `sprint.name` | Sprint name |
| `sprint.status` | Sprint state: `planning` → `future`, `active` → `active`, `closed` → `closed` |
| `sprint.start_date` | Sprint start date |
| `sprint.end_date` | Sprint end date |
| `sprint.goal` | Sprint goal |
| `epic.title` | Epic summary |
| `epic.status` | Epic status: `in-progress` → "In Progress", `done` → "Done" |
| `tracking_system` | Stored in `sprint-status.yaml` metadata only — no corresponding Jira field |
| `project_key` | Matches `jira_project_key` from `_bmad/bmm/config.yaml` install-time config |

### 6.2.2 Bulk Write Limitations

The `generate-backlog` and `bmad-sprint-planning` skills involve bulk create/update operations with the following constraints:

- **No transaction support.** Multiple sequential Jira API calls are made with no atomicity guarantee. If any call fails mid-way, Jira will be in partial state: some items will have been created or updated, others not.
- **Pre-flight warning required.** Before executing any bulk write, the skill MUST warn the user: "This operation will create/update [N] Jira items. If it fails mid-way, Jira may be in partial state. Proceed?"
- **Failure handling.** On any failure mid-way through a bulk sequence, the skill MUST present the standard retry/switch prompt per Section 2.4. The user decides whether to retry (which may re-attempt already-applied changes) or switch to file management.
- **Skills affected:** `generate-backlog` (bulk backlog + epic creation/update), `bmad-sprint-planning` (bulk sprint, item, and epic creation/update). All other skills perform single-item or single-sprint operations and do not require this warning.

### 6.3 Status Mapping

Jira workflow statuses vary by project. The Jira operation instructions MUST include a default status mapping and note that it is configurable:

| Canonical Status | Default Jira Workflow Status |
|---|---|
| `backlog` | "Backlog", "Open" |
| `ready-for-dev` | "Selected for Development", "To Do" |
| `in-progress` | "In Progress" |
| `review` | "In Review", "Code Review" |
| `done` | "Done", "Resolved", "Closed" |
| `on-hold` | "On Hold", "Blocked" |
| `cancelled` | "Won't Do", "Cancelled" |

### 6.4 Error Handling — Interactive Failure Model

All Jira operation failures use the same interactive model: pause and ask the user to retry or switch. There is no automatic fallback.

| Failure Type | Required Behavior |
|---|---|
| Jira tool not available | Present retry/switch prompt with message explaining the agent needs a Jira-capable tool configured |
| Jira API error (operation attempted) | Present retry/switch prompt with the Jira error details |
| Partial failure (bulk operations) | Present retry/switch prompt; note that Jira may already be partially modified |

The Phase B template in Section 4.1-B implements this model via failure case (c). The Phase A template (Section 4.1-A) never attempts a Jira call, so this does not apply during the placeholder phase.

### 6.5 Source of Truth When Jira Is Active

When `tracking_system: jira`:
- **Jira is the source of truth** — not `sprint-status.yaml`
- The local `sprint-status.yaml` MAY exist as a read-only reference but MUST NOT be written by any skill in this mode
- All reads and writes go through the Jira operation instructions

### 6.6 Extensibility for Future Backends

The routing pattern supports future backends (Linear, Azure DevOps, GitHub Projects). Adding a new backend is additive:

1. Define a new `tracking_system` value (e.g., `"linear"`)
2. Add a new routing branch to each skill's routing block (alongside the `jira` branch)
3. Document the MCP tool name pattern for that provider
4. The `file-system` branch and the `jira` branch are completely unchanged

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
- **Jira mode (Phase A):** When `tracking_system: jira` is configured, `sprint_management_path` is not set in `_bmad/bmm/config.yaml` (no local path applies). Phase A skills fall back to file-system behavior and use the default path: `_bmad-output/implementation-artifacts/sprint-status.yaml` relative to the project root (same as single-repo mode). Skills create this file at the default path if it does not exist.

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

The backend detection block from Section 4.1 extends as follows when a new MCP backend is added:

```markdown
## Backend Routing

Before performing any read or write operations:

1. Read `sprint-status.yaml` and extract the `tracking_system` metadata field.

2. If `tracking_system` is `file-system` (or absent/empty):
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   [Phase B — filled in by Story 14.3 per Section 4.1-B of this spec]

4. If `tracking_system` is `linear`:
   a. Perform the required Linear operation: [SKILL-SPECIFIC LINEAR OPERATION DESCRIPTION].
      Use whatever Linear-capable tool is available in your current tool context.
   b. If the Linear operation SUCCEEDS: continue with the Linear data returned.
   c. If the Linear operation FAILS for any reason:
      Pause and present the user with:
      > "The Linear operation failed: {error details}. How would you like to proceed?
      > (a) Retry — attempt the Linear operation again
      > (b) Switch to file management — update sprint-status.yaml and config to use
      >     file-system backend, then complete this operation locally. This change is permanent."
      If user chooses (b): write `tracking_system: file-system` to `sprint-status.yaml`,
      update `sprint_backend: file-system` in `_bmad/bmm/config.yaml`,
      then proceed with **File-System Backend** instructions below.

5. If `tracking_system` is any other value: output unsupported backend message, fall back to File-System Backend.
```

New backends are additive — they insert a new numbered branch before the catch-all `unknown value` branch. Existing branches are not modified.

### 8.3 Consistency Requirement

When a new backend is added, the template must be updated consistently across all 13 skills. This is a known operational cost of the embedded-pattern approach (vs. a shared module). The benefit is that skills remain self-contained instruction documents with no external dependencies.

---

## Cross-References

| Reference | Description |
|---|---|
| `sprint-status-schema.md` | Story 17.9: Unified YAML schema — the data contract for all backends |
| `mcp-detection-pattern-spec.md` | This document (renamed from `adapter-pattern-spec.md` on 2026-04-29) |
| Architecture P2-11 | Decision: Unified Sprint-Status File Architecture, including install-time backend selection and Jira integration pattern (revised 2026-04-29) |
| PRD FR133, FR138, FR139, FR140 | Requirements addressed by this specification |
| Story 17.19 (`story-status-lookup`) | Existing Jira extension point placeholder — first instance of the routing pattern |
| Stories 17.10-17.21, 17.24 | All 13 skills that embed Section 4.1-A Phase A template; upgraded to 4.1-B by Story 14.3 |
| Epic 14, Story 14.1 | Defines Jira operation descriptions for each skill; produces the mapping that Story 14.3 uses |
| Epic 14, Story 14.3 | Fills in the Phase B template (Section 4.1-B) in all 13 skills, replacing the placeholder |
| Epic 14, Story 14.4 | Updates error message text with actionable guidance per error type |
