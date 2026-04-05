# Story 17.12: Rework remove-from-sprint Skill (Heavy Rework — Reverse Movement Semantics)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `remove-from-sprint` skill to MOVE items from a sprint's `items` array back to the `backlog` section of `sprint-status.yaml`,
So that sprint scope adjustments are clean, reversible, single-file operations available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** a sprint has assigned items,
   **When** the Scrum Master invokes `remove-from-sprint`,
   **Then** it reads the `sprints` section and displays sprints that contain at least one item,
   **And** the Scrum Master selects a sprint,
   **And** the skill displays the selected sprint's items with metadata (ID, title, type, epic, status, severity),
   **And** the Scrum Master selects which items to remove.

2. **Given** items are selected for removal from the sprint,
   **When** the removal completes,
   **Then** each selected item is REMOVED from the sprint's `items` array (FR134, FR141),
   **And** ADDED to the `backlog` array with a `priority` field set to `max(existing_backlog_priorities) + 1` for each item (appended to end of backlog; if backlog is empty, first item gets priority 1),
   **And** the item's `status` is RESET to `ready-for-dev` (per schema section 4.5 — this is the only permitted backward status transition, triggered by movement),
   **And** remaining backlog items have their `priority` values renumbered sequentially (1..N) to match array positions,
   **And** the `last_updated` metadata field is set to the current ISO-8601 timestamp,
   **And** all changes are persisted in a SINGLE atomic write to `sprint-status.yaml`.

3. **Given** an item in the sprint has `status: done`,
   **When** the Scrum Master attempts to remove it from the sprint,
   **Then** the skill rejects the item with a message: "Done items cannot be moved back to backlog. Use `/cleanup-done` or `/close-sprint` to archive done items." (per schema section 4.5 — done items MUST NOT be moved back to backlog via remove-from-sprint).

4. **Given** a sprint's capacity was full (e.g., 6/6 items),
   **When** an item is removed,
   **Then** the skill displays updated capacity usage (e.g., 5/6) showing the freed capacity.

5. **Given** no sprints exist in the `sprints` section, or all sprints have empty `items` arrays,
   **When** `remove-from-sprint` is invoked,
   **Then** the skill reports: "No sprints with assigned items found. Nothing to remove."

6. **Given** `sprint-status.yaml` does not exist,
   **When** `remove-from-sprint` is invoked,
   **Then** the skill reports an error: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

7. **Given** items with `status: cancelled` exist in the sprint,
   **When** the Scrum Master attempts to remove them,
   **Then** the skill rejects cancelled items with the same rationale as done items — they should be archived, not returned to the backlog.

8. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/remove-from-sprint/` and BMAD extension at `lib/bmad-extension/skills/remove-from-sprint/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

9. **Given** the skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 8, 9) — NEW

The IDE skill does NOT exist. This task creates it from scratch.

- [ ] 1.1 Create `skills/remove-from-sprint/skill.json` with metadata:
  ```json
  {
    "name": "remove-from-sprint",
    "version": "1.0.0",
    "description": "Guided workflow to move sprint items back to the backlog in the unified sprint-status.yaml using reverse movement semantics",
    "category": "workflow",
    "tags": ["sprint-management", "backlog", "movement-semantics"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) — this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/remove-from-sprint/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Create the BMAD extension skill (AC: 8, 9) — NEW

The BMAD extension skill does NOT exist (it was rolled back/deleted along with all Epic 17 Phase 1 code). This task creates it from scratch.

- [ ] 2.1 Create `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` with the BMAD extension version of the workflow (see Task 3 for content specification). The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may include BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Create `lib/bmad-extension/skills/remove-from-sprint/bmad-skill-manifest.yaml` with:
  ```yaml
  type: skill
  name: remove-from-sprint
  module: ma-skills
  ```

- [ ] 2.3 Add a NEW row to `lib/bmad-extension/module-help.csv` for `remove-from-sprint`:
  ```
  ma-skills,4-implementation,Remove from Sprint,remove-from-sprint,,skill:remove-from-sprint,remove-from-sprint,false,bmm-sm,,"Move items from a sprint back to the backlog in the unified sprint-status.yaml using reverse movement semantics.",_bmad-output/implementation-artifacts,"sprint plan",
  ```

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5, 6, 7)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 — Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` (or resolve path from config).
  - If the file does not exist, report error and suggest running sprint planning first (AC 6). Exit.
  - Parse the full file: `epics`, `backlog`, and `sprints` sections.

- [ ] 3.2 **Step 1 — Identify sprints with removable items:**
  - Parse the `sprints` section. Filter to sprints that have at least one item in their `items` array.
  - Include sprints with ANY status (`planning`, `active`, or even `closed`) as long as they have items — but note that closed sprints should show a warning that removing from a closed sprint is atypical (schema section 6.7 immutability, with archival as the only standard exception). If the implementation chooses to block closed sprints, that is acceptable — but `planning` and `active` sprints MUST be supported.
  - If no sprints with items are found, report: "No sprints with assigned items found. Nothing to remove." (AC 5). Exit.
  - If exactly one sprint has items, auto-select it.
  - If multiple sprints have items, display a sprint selection table (name, status, capacity, current item count) and prompt for selection.

- [ ] 3.3 **Step 2 — Display sprint items:**
  - Read the selected sprint's `items` array.
  - Filter OUT items with `status: done` or `status: cancelled` — these are NOT eligible for removal (AC 3, AC 7). Display them separately with a note: "N done/cancelled item(s) cannot be removed. Use `/cleanup-done` or `/close-sprint` to archive them."
  - Display eligible items in a table with columns: #, ID, Title, Type, Epic, Status, Severity.
  - If no eligible items remain after filtering, report: "All items in this sprint are done or cancelled. Use `/cleanup-done` or `/close-sprint` to archive them." Exit.

- [ ] 3.4 **Step 3 — Select items to remove:**
  - Prompt the Scrum Master to select items from the displayed list (enter numbers, comma-separated, or "all").
  - Validate that all entered numbers correspond to displayed eligible items.

- [ ] 3.5 **Step 4 — Confirmation:**
  - Display a summary of selected items and their current statuses.
  - Warn that status will be RESET to `ready-for-dev` for any item whose current status is not already `ready-for-dev` (e.g., items in `in-progress` or `review` will lose their progress status).
  - Options: [c] Confirm removal, [x] Cancel.
  - On cancel, exit without changes.

- [ ] 3.6 **Step 5 — Execute reverse movement (AC: 2, 4):**
  - For each confirmed item:
    - REMOVE the item object from the sprint's `items` array.
    - SET `status` to `ready-for-dev` (schema section 4.5 reset rule).
    - ADD a `priority` field with value `max(existing_backlog_priorities) + 1`. If backlog is currently empty, assign `priority: 1`. Each subsequent item in the batch gets the next sequential priority.
    - APPEND the item (with fields: `id`, `type`, `epic`, `title`, `priority`, `status`, `severity`) to the `backlog` array.
  - After all movements: renumber ALL backlog items' `priority` values sequentially (1..N) to match array positions. This ensures consistency even if items were appended at the end.
  - Update `last_updated` to current ISO-8601 timestamp.
  - Write the complete `sprint-status.yaml` in a single atomic write (all removals + additions + renumbering in one operation) (AC 2).

- [ ] 3.7 **Step 6 — Summary output:**
  - Display removal summary: sprint name, items removed this session, their new backlog priorities.
  - Display updated sprint capacity: remaining assigned count / capacity.
  - Display updated backlog count.
  - Suggest next steps: `/prioritize-backlog` to reorder the backlog after removals, `/add-to-sprint` to reassign items, `/sprint-status-view` to view updated status.

### Task 4: Create the BMAD extension workflow file (AC: 9)

- [ ] 4.1 Create `lib/bmad-extension/workflows/remove-from-sprint/workflow.md` — this is the BMAD-specific invocation wrapper. It must align with the SKILL.md content and reference the unified schema operations. Use the `add-to-sprint` workflow (`lib/bmad-extension/workflows/add-to-sprint/workflow.md`) as a structural reference.

### Task 5: Verify no legacy patterns are present (AC: 2)

- [ ] 5.1 Confirm neither SKILL.md file contains any reference to writing standalone `sprint-plan-*.yaml` files.
- [ ] 5.2 Confirm neither SKILL.md file contains any reference to reading/writing `backlog.yaml` as a standalone file.
- [ ] 5.3 Confirm neither SKILL.md file contains any instruction to read the `development_status` map (old schema).
- [ ] 5.4 Confirm neither SKILL.md file references `bug-*.md` globbing for item discovery.
- [ ] 5.5 Confirm the only data file read/written is `sprint-status.yaml`.

### Task 6: Deployment verification (AC: 8)

- [ ] 6.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 6.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `remove-from-sprint`).
- [ ] 6.3 Diff the installed IDE copy (e.g., `.claude/skills/remove-from-sprint/SKILL.md`) against the source (`skills/remove-from-sprint/SKILL.md`) — the content should match after accounting for frontmatter injection by the installer.
- [ ] 6.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/remove-from-sprint/SKILL.md` after a BMAD install.
- [ ] 6.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/remove-from-sprint/SKILL.md`.
- [ ] 6.6 Verify `remove-from-sprint` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files in BOTH from scratch. Understanding the deployment architecture is essential.

**Why this matters:** The previous version of this story (pre-rewrite) directed edits to `.claude/skills/remove-from-sprint/SKILL.md`, which is an INSTALLED COPY (a read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live. Additionally, the Epic 17 Phase 1 implementation was rolled back, so the BMAD extension skill was also deleted. This story creates everything fresh.

#### Pipeline 1: IDE Skills (all IDE agents) — NEW (create from scratch)

- **Source location:** `skills/remove-from-sprint/skill.json` + `skills/remove-from-sprint/SKILL.md`
- **Status:** Does NOT exist. Task 1 creates these files.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) — NEW (create from scratch)

- **Source location:** `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** Does NOT exist (was deleted during Epic 17 rollback). Task 2 creates these files.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` — a NEW row must be added (Task 2.3).
- **Workflow file:** `lib/bmad-extension/workflows/remove-from-sprint/workflow.md` — also does NOT exist and must be created (Task 4).

#### Install locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` — all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` — managed by BMAD deployer

### Relationship to add-to-sprint (Story 17.11) — Inverse Operation

This skill is the **exact inverse** of `add-to-sprint` (Story 17.11). The two skills form a symmetrical pair:

| Aspect | add-to-sprint (17.11) | remove-from-sprint (17.12) |
|--------|----------------------|---------------------------|
| Direction | backlog -> sprint | sprint -> backlog |
| `priority` field | DROPPED on move | ADDED on move |
| Status gate (source) | Only `ready-for-dev` items may be added | `done` and `cancelled` items CANNOT be removed (must be archived) |
| Status on arrival | Preserved unchanged | RESET to `ready-for-dev` (schema 4.5) |
| Capacity effect | Usage increases | Usage decreases |
| Backlog renumbering | Remaining backlog priorities renumbered 1..N after removal | All backlog priorities renumbered 1..N after insertion |

### What This Story Creates (Nothing Exists Yet)

**After Epic 17 Phase 1 rollback, nothing exists.** This story creates from scratch:

1. `skills/remove-from-sprint/skill.json` — IDE skill metadata (NEW)
2. `skills/remove-from-sprint/SKILL.md` — IDE skill workflow (NEW)
3. `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` — BMAD extension skill workflow (NEW)
4. `lib/bmad-extension/skills/remove-from-sprint/bmad-skill-manifest.yaml` — BMAD manifest (NEW)
5. `lib/bmad-extension/workflows/remove-from-sprint/workflow.md` — BMAD workflow wrapper (NEW)
6. New row in `lib/bmad-extension/module-help.csv` — BMAD module registration (NEW)

### Schema Section 4.5 — Movement Rules (Authoritative Reference)

The schema at `_bmad-output/planning-artifacts/sprint-status-schema.md` section 4.5 is the canonical authority for movement behavior:

> **Sprint -> Backlog (`remove-from-sprint`):** A `priority` field is **added** with value `max(existing backlog priorities) + 1` (appended to end). If the backlog is empty, the item receives `priority: 1`. The item's status is **reset to `ready-for-dev`** (not `backlog`, because a story file already exists).

> **Done items:** Items with status `done` MUST NOT be moved back to backlog via `remove-from-sprint`. They can only be archived via `cleanup-done` or `close-sprint`.

**Note on discrepancies:** The epics definition (epics.md Story 17.12) says "priority set to position 1 (top of backlog)" and "status is NOT changed." The schema section 4.5 says "priority = max + 1 (appended to end)" and "status reset to ready-for-dev." The **schema is authoritative** — it was written later as the canonical specification. This story follows the schema.

### PRD Requirement Conflict

FR129 in the PRD states: "returned to the backlog without changing its status." However, schema section 4.5 explicitly states: "status is reset to ready-for-dev." The schema was written as a refinement of FR129 and represents the final design decision. The rationale: items returning to backlog from a sprint have already had their story file created (unlike items originally in `backlog` status), so `ready-for-dev` is the correct reset point — it indicates the item is prepared but not yet assigned.

### Key Design Decisions

- **Status reset on removal:** Items returning to backlog always get `status: ready-for-dev`, regardless of their in-sprint status. This prevents stale `in-progress` or `review` items from sitting in the backlog with misleading statuses.
- **Priority at end of backlog:** Removed items are appended to the end of the backlog (highest priority number = lowest priority). This avoids disrupting the existing backlog order. The Scrum Master should run `/prioritize-backlog` after bulk removals.
- **Done/cancelled item prohibition:** Items with `status: done` or `status: cancelled` cannot be returned to backlog. They are terminal states handled by archival workflows (`cleanup-done`, `close-sprint`).
- **Priority renumbering:** After insertion, all backlog `priority` values are renumbered 1..N to keep the denormalized index in sync with array positions (schema section 3.3).
- **Movement is atomic:** Both the removal from sprint and addition to backlog happen in one file write to maintain the single-location invariant (schema section 6.1).

### Unified Schema Sections Touched

- **`sprints`** — read (list sprints with items, display items) + write (remove items from sprint's `items` array)
- **`backlog`** — read (determine max priority for insertion) + write (append removed items with priority field, renumber all priorities)
- **`epics`** — preserved unchanged (pass-through on write)
- **Metadata** — `last_updated` is updated on every write

### Gotchas and Edge Cases

1. **Empty backlog:** If the backlog is empty when items are removed from a sprint, the first removed item gets `priority: 1`, second gets `priority: 2`, etc.
2. **Batch removal:** When removing multiple items in one operation, each item gets the next sequential priority after the current max. For example, if backlog max priority is 5, three removed items get priorities 6, 7, 8 — then all are renumbered 1..N.
3. **Closed sprint removal:** Whether to allow removal from closed sprints is an implementation decision. Schema section 6.7 says closed sprints are immutable except for archival. The safest approach is to block removal from closed sprints and direct the user to `/close-sprint` instead. If implemented, show: "Cannot remove items from a closed sprint. Use `/close-sprint` to disposition remaining items."
4. **All items done/cancelled:** If every item in the selected sprint is done or cancelled, there are no eligible items to remove. The skill should report this and suggest archival workflows.
5. **Status reset warning:** When an item in `in-progress` or `review` is removed, its status is forcibly reset to `ready-for-dev`. The confirmation step (Task 3.5) MUST warn the user about this — work-in-progress status will be lost.
6. **On-hold items:** Items with `status: on-hold` ARE eligible for removal. Their status is reset to `ready-for-dev` like any other non-terminal status.

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema and movement rules
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file this skill reads/writes
- **Story 17.10** (prerequisite): `generate-backlog` populates the `backlog` section
- **Story 17.16** (prerequisite): `add-sprint` creates the sprint entries in the `sprints` section
- **Story 17.11** (inverse): `add-to-sprint` is the forward operation; this is the reverse
- **Story 17.14** (related): `cleanup-done` handles done-item archival (done items cannot be moved by this skill)
- **Story 17.21** (related): `close-sprint` handles full sprint close lifecycle including returning incomplete items to backlog
- **Story 17.24** (follow-up): `prioritize-backlog` should be run after bulk removals to reorder the backlog

### PRD Traceability

- **FR129:** A BMAD extension workflow (`remove-from-sprint`) enables removing stories or bugs from a sprint's `items` list and moving them back to the `backlog` section of `sprint-status.yaml`.
- **FR134:** Each item carries a consistent structure (id, type, epic, title, priority, status, severity). Movement semantics — items MOVE between the `backlog` and `sprints` sections; an item exists in exactly one location at any time.
- **FR141:** Remove items from sprint back to backlog (remove-from-sprint skill).
- **FR133:** `sprint-status.yaml` includes top-level metadata (generated, last_updated, project, etc.) — `last_updated` must be refreshed on write.
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow).

### Architecture Reference

- Architecture Decision P2-5 in `_bmad-output/planning-artifacts/architecture.md` — Pre-built Extension Workflows (FR61, FR68-FR70)
- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` — Unified sprint-status.yaml model
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` — canonical schema, especially sections 4.5 (movement rules), 6.1 (single-location invariant), 6.6 (valid status transitions), 6.7 (closed sprint immutability)

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **Inverse skill (IDE, to create):** `skills/add-to-sprint/skill.json` + `skills/add-to-sprint/SKILL.md` (Story 17.11 creates this; use as structural reference if available)
- **Inverse skill (BMAD, exists):** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **BMAD workflow reference:** `lib/bmad-extension/workflows/add-to-sprint/workflow.md`
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **Epics source:** `_bmad-output/planning-artifacts/epics.md` (Story 17.12 definition)
- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR129, FR134, FR141, FR133)
