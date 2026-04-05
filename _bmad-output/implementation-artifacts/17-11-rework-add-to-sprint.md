# Story 17.11: Rework add-to-sprint Skill (Heavy Rework — Movement Semantics)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `add-to-sprint` skill to MOVE items from the `backlog` section to a sprint's `items` array within `sprint-status.yaml`,
So that sprint assignment is a single-file atomic operation with movement semantics, available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** the `backlog` section of `sprint-status.yaml` contains unassigned items,
   **When** the Scrum Master invokes `add-to-sprint`,
   **Then** it reads the `sprints` section and displays target sprints (with `planning` or `active` status),
   **And** shows the current capacity usage for the selected sprint (`items.length / capacity`),
   **And** shows unassigned items from the `backlog` section in priority order,
   **And** the Scrum Master selects which items to add.

2. **Given** the Scrum Master selects items for the sprint,
   **When** the items are assigned,
   **Then** each selected item is REMOVED from the `backlog` array (FR134),
   **And** ADDED to the target sprint's `items` array in the `sprints` section,
   **And** the item's `priority` field is dropped (priority only exists in backlog — sprint-item schema has no `priority`),
   **And** the item's other fields (`id`, `type`, `epic`, `title`, `status`, `severity`) are preserved unchanged,
   **And** remaining backlog items have their `priority` values renumbered sequentially (1..N) to match new array positions,
   **And** the `last_updated` metadata field is set to the current ISO-8601 timestamp,
   **And** all changes are persisted in a SINGLE atomic write to `sprint-status.yaml`.

3. **Given** an item in the `backlog` has a status other than `ready-for-dev`,
   **When** the Scrum Master attempts to add it to a sprint,
   **Then** the skill rejects the item with a message explaining only `ready-for-dev` items may be added to sprints (per schema section 4.5 movement rules).

4. **Given** assigning items would exceed the target sprint's capacity,
   **When** the assignment is attempted,
   **Then** the skill warns that capacity would be exceeded (showing current count/capacity and overage),
   **And** offers options: add anyway (over-capacity acknowledged), skip the item, or exit to run `/modify-sprint` first.

5. **Given** the target sprint has `status: closed`,
   **When** the Scrum Master attempts to assign items to it,
   **Then** the skill rejects the closed sprint and only allows selection of `planning` or `active` sprints.

6. **Given** no sprints exist in the `sprints` section (or all sprints are `closed`),
   **When** `add-to-sprint` is invoked,
   **Then** the skill reports an error: "No assignable sprints found. Run `/add-sprint` first to create a sprint."

7. **Given** `sprint-status.yaml` does not exist,
   **When** `add-to-sprint` is invoked,
   **Then** the skill reports an error: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

8. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/add-to-sprint/` and BMAD extension at `lib/bmad-extension/skills/add-to-sprint/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

9. **Given** the skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 8, 9) — NEW

The IDE skill does NOT yet exist. This task creates it from scratch.

- [ ] 1.1 Create `skills/add-to-sprint/skill.json` with metadata:
  ```json
  {
    "name": "add-to-sprint",
    "version": "1.0.0",
    "description": "Guided workflow to move backlog items to a sprint in the unified sprint-status.yaml using movement semantics",
    "category": "workflow",
    "tags": ["sprint-management", "backlog", "movement-semantics"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) — this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/add-to-sprint/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Modify the BMAD extension skill (AC: 8, 9) — EXISTS, MODIFY

The BMAD extension skill ALREADY EXISTS at `lib/bmad-extension/skills/add-to-sprint/SKILL.md`. This task modifies it in place. The `bmad-skill-manifest.yaml` does NOT need changes.

- [ ] 2.1 Rewrite `lib/bmad-extension/skills/add-to-sprint/SKILL.md` — replace the entire pre-Epic-17 workflow (which uses the old `development_status` map, `bug-*.md` globbing, and `sprint-plan-*.yaml` files) with the new unified schema workflow (see Task 3 for content specification). The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may include BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Verify `lib/bmad-extension/skills/add-to-sprint/bmad-skill-manifest.yaml` is unchanged:
  ```yaml
  type: skill
  name: add-to-sprint
  module: ma-skills
  ```

- [ ] 2.3 Update the description in `lib/bmad-extension/module-help.csv` for the `add-to-sprint` row if needed. The current description ("Assign backlog items (stories + bugs) to a sprint using multi-criteria prioritization.") should be updated to mention movement semantics:
  ```
  "Move backlog items to a sprint in the unified sprint-status.yaml using movement semantics."
  ```

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5, 6, 7)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 — Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` (or resolve path from config).
  - If the file does not exist, report error and suggest running sprint planning first (AC 7). Exit.
  - Parse the full file: `epics`, `backlog`, and `sprints` sections.

- [ ] 3.2 **Step 1 — Identify assignable sprints:**
  - Parse the `sprints` section. Filter to sprints with `status: planning` or `status: active`.
  - Exclude sprints with `status: closed` (AC 5).
  - If no assignable sprints remain, report error and suggest running `/add-sprint` (AC 6). Exit.
  - If exactly one assignable sprint, auto-select it.
  - If multiple assignable sprints, display a sprint selection table (name, status, capacity, current item count, remaining capacity) and prompt for selection.

- [ ] 3.3 **Step 2 — Display backlog items:**
  - Read the `backlog` array from `sprint-status.yaml`.
  - Filter to items with `status: ready-for-dev` only (AC 3 — schema section 4.5 movement rules: "Only items with status `ready-for-dev` may be added to a sprint").
  - If no `ready-for-dev` items exist in the backlog, report: "No items eligible for sprint assignment. Items must have status `ready-for-dev` to be added to a sprint." Exit.
  - Display items in priority order with columns: #, ID, Title, Type, Epic, Severity.
  - Show total count of eligible items.

- [ ] 3.4 **Step 3 — Display sprint capacity:**
  - Calculate capacity usage: `items.length / capacity` for the selected sprint.
  - Display capacity: total capacity, currently assigned count, remaining slots.
  - If already at or over capacity, show a warning.

- [ ] 3.5 **Step 4 — Select candidate items:**
  - Prompt the Scrum Master to select items from the displayed backlog (enter numbers, comma-separated, or "all").
  - Validate that all entered numbers correspond to displayed backlog items.

- [ ] 3.6 **Step 5 — Multi-criteria prioritization analysis:**
  - For each candidate item, evaluate: business value (H/M/L), dependency status (blocked/blocking/independent), severity (bugs only), effort estimation (S/M/L).
  - Generate a ranked recommendation factoring in: blocking dependencies first, high-value quick wins, critical/high bugs ahead of lower severity.
  - Display ranking table with rationale.
  - Recommend a selection fitting within remaining capacity.

- [ ] 3.7 **Step 6 — User confirms or adjusts:**
  - Options: [c] Confirm recommended selection, [m] Modify selection (specify item numbers), [r] Re-rank (provide new order), [x] Cancel.
  - On cancel, exit without changes.
  - Store confirmed ranking for audit trail.

- [ ] 3.8 **Step 7 — Execute movement with capacity enforcement (AC: 2, 4):**
  - For each confirmed item, in ranking order:
    - Check if adding the item would exceed capacity. If so, warn and offer: [a] Add anyway, [s] Skip item, [m] Exit to `/modify-sprint` (AC 4).
    - REMOVE the item object from the `backlog` array.
    - DROP the `priority` field from the item object.
    - APPEND the item (with `id`, `type`, `epic`, `title`, `status`, `severity`) to the target sprint's `items` array.
  - After all movements: renumber remaining backlog items' `priority` values sequentially (1..N) to match new array positions.
  - Update `last_updated` to current ISO-8601 timestamp.
  - Write the complete `sprint-status.yaml` in a single atomic write (all removals + additions + renumbering in one operation) (AC 2).

- [ ] 3.9 **Step 8 — Summary output:**
  - Display assignment summary: sprint name, items assigned this session, confirmed ranking audit record.
  - Display updated capacity: new assigned count / capacity (remaining).
  - Suggest next steps: `/modify-sprint` to adjust, `/sprint-status-view` to view, `/remove-from-sprint` to undo.

### Task 4: Update the BMAD extension workflow file (AC: 9)

- [ ] 4.1 Rewrite `lib/bmad-extension/workflows/add-to-sprint/workflow.md` to match the new unified schema workflow. This workflow file is the BMAD-specific invocation wrapper and must align with the SKILL.md content. Replace all references to `development_status`, `bug-*.md` globbing, and `sprint-plan-*.yaml` with the new `sprint-status.yaml` unified schema operations.

### Task 5: Verify the old dual-write pattern is NOT present (AC: 2)

- [ ] 5.1 Confirm neither SKILL.md file contains any reference to writing `sprint-plan-*.yaml` files.
- [ ] 5.2 Confirm neither SKILL.md file contains any reference to reading/writing `backlog.yaml` as a standalone file.
- [ ] 5.3 Confirm neither SKILL.md file contains any instruction to read the `development_status` map (old schema).
- [ ] 5.4 Confirm neither SKILL.md file references `bug-*.md` globbing for item discovery (items come from `backlog` section now).
- [ ] 5.5 Confirm the only data file read/written is `sprint-status.yaml`.

### Task 6: Deployment verification (AC: 8)

- [ ] 6.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 6.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `add-to-sprint`).
- [ ] 6.3 Diff the installed IDE copy (e.g., `.claude/skills/add-to-sprint/SKILL.md`) against the source (`skills/add-to-sprint/SKILL.md`) — the content should match after accounting for frontmatter injection by the installer.
- [ ] 6.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/add-to-sprint/SKILL.md` after a BMAD install.
- [ ] 6.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/add-to-sprint/SKILL.md`.
- [ ] 6.6 Verify `add-to-sprint` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story touches source files in BOTH. Understanding the distinction between "creating new" (IDE skill) and "modifying existing" (BMAD extension skill) is essential.

**Why this matters:** The previous version of this story was fundamentally wrong — it directed edits to `.claude/skills/add-to-sprint/SKILL.md`, which is an INSTALLED COPY (a read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live.

#### Pipeline 1: IDE Skills (all IDE agents) — NEW for add-to-sprint

- **Source location:** `skills/add-to-sprint/skill.json` + `skills/add-to-sprint/SKILL.md`
- **Status:** Does NOT exist yet. Task 1 creates these files from scratch.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) — EXISTS, MODIFY

- **Source location:** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** ALREADY EXISTS with the pre-Epic-17 workflow (old `development_status` map, `sprint-plan-*.yaml`, `bug-*.md` globbing). Task 2 rewrites the SKILL.md in place.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` (row: `bmm-sm` agent) — already registered, may need description update.
- **Workflow file:** `lib/bmad-extension/workflows/add-to-sprint/workflow.md` — also exists and needs updating (Task 4).

#### Install locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` — all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` — managed by BMAD deployer

### What This Story Changes vs Current Behavior

**Current behavior (pre-Epic-17, restored after rollback):** The `add-to-sprint` skill reads from the flat `development_status` map in `sprint-status.yaml` to discover stories and their statuses. Bugs are discovered by globbing `bug-*.md` files. Sprints are read from standalone `sprint-plan-*.yaml` files. Assignment means: (1) adding the item identifier to the sprint file's `assigned_items` list, and (2) writing to the sprint-plan file. Item metadata is NOT stored in the sprint file — only IDs. The skill explicitly states "Do NOT modify sprint-status.yaml" in its persist step.

**New behavior (unified schema):** The skill reads and writes a SINGLE `sprint-status.yaml` file. The `backlog` array is the source of unassigned items (no more `development_status` map parsing or `bug-*.md` globbing). Sprints and their assigned items are in the `sprints` map (no more standalone `sprint-plan-*.yaml` files). Assignment means: (1) REMOVING the full item object from the `backlog` array, and (2) APPENDING it to the target sprint's `items` array with the `priority` field dropped. This is a single atomic write to one file.

### Key Differences from Old Implementation

| Aspect | Old (pre-Epic-17) | New (unified schema) |
|--------|-------------------|---------------------|
| Item discovery | `development_status` map + `bug-*.md` globbing | `backlog` array in `sprint-status.yaml` |
| Sprint discovery | Glob `sprint-plan-*.yaml` files | `sprints` map in `sprint-status.yaml` |
| Assignment action | Add item ID to sprint file's `assigned_items` list | REMOVE item from `backlog`, APPEND to sprint `items` |
| Data stored in sprint | Item IDs only | Full item objects (id, type, epic, title, status, severity) |
| Priority handling | Not tracked in sprint | `priority` field DROPPED on move from backlog |
| File writes | Sprint-plan file only (sprint-status.yaml explicitly excluded) | Single atomic write to `sprint-status.yaml` |
| Status gate | None (any status could be assigned) | Only `ready-for-dev` items may be added (schema 4.5) |

### Key Design Decisions

- **Status gate:** Only items with `status: ready-for-dev` may be added to a sprint (schema section 4.5). This is a NEW constraint not present in the old implementation. Items with `status: backlog` must first have their status changed to `ready-for-dev` (typically by creating the story file).
- **Priority renumbering:** After removing items from backlog, remaining items' `priority` values are renumbered 1..N to keep the denormalized index in sync with array positions (schema section 3.3).
- **Capacity is advisory:** The schema (section 4.2) says skills SHOULD warn when count exceeds capacity but MUST NOT block the operation. The user can always add anyway.
- **Movement is atomic:** Both the removal from backlog and addition to sprint happen in one file write to maintain the single-location invariant (schema section 6.1).

### Unified Schema Sections Touched

- **`backlog`** — read (display eligible items) + write (remove assigned items, renumber priorities)
- **`sprints`** — read (sprint selection, capacity) + write (append items to target sprint's `items` array)
- **`epics`** — preserved unchanged (pass-through on write)
- **Metadata** — `last_updated` is updated on every write

### Gotchas from Current Implementation

1. **Item discovery is completely different.** The old skill parses `development_status` (a flat key-value map) and globs `bug-*.md` files. The new skill reads the `backlog` array — items are already structured objects with all metadata.
2. **Sprint discovery is completely different.** The old skill globs `sprint-plan-*.yaml` files. The new skill reads the `sprints` map from the same file.
3. **The old skill explicitly says "Do NOT modify sprint-status.yaml."** This instruction must be REVERSED — `sprint-status.yaml` is now the PRIMARY and ONLY write target.
4. **The old skill stores only item IDs in sprint files.** The new model stores full item objects (minus `priority`). This means the "move" carries all metadata with the item.
5. **The old skill has no status gate.** Any item could be assigned regardless of status. The new schema requires `ready-for-dev` status for sprint assignment.
6. **The old workflow file** at `lib/bmad-extension/workflows/add-to-sprint/workflow.md` mirrors the old SKILL.md and also needs updating (Task 4).

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema and movement rules
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file this skill reads/writes
- **Story 17.10** (prerequisite): `generate-backlog` populates the `backlog` section this skill moves items from
- **Story 17.16** (prerequisite): `add-sprint` creates the sprint entries in the `sprints` section this skill assigns items to
- **Story 17.12** (inverse): `remove-from-sprint` is the reverse operation — moves items from sprint back to backlog
- **Story 12.2** (original): This skill was originally created in Epic 12; this story reworks it for the unified model

### PRD Traceability

- **FR69:** A BMAD extension workflow enables moving stories and bugs from the `backlog` section into a sprint's `items` list — the item is removed from `backlog` and added to the target sprint. Items are never duplicated across sections.
- **FR134:** Each item carries a consistent structure (id, type, epic, title, priority, status, severity). Movement semantics — items MOVE between the `backlog` and `sprints` sections; an item exists in exactly one location at any time.
- **FR66:** Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning.
- **FR65:** Stories and bugs are peers in the backlog — no epic grouping in the flat backlog view.
- **FR133:** `sprint-status.yaml` includes top-level metadata (generated, last_updated, project, etc.) — `last_updated` must be refreshed on write.
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow).

### Architecture Reference

- Architecture Decision P2-5 in `_bmad-output/planning-artifacts/architecture.md` — Pre-built Extension Workflows (FR61, FR68-FR70)
- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` — Unified sprint-status.yaml model
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` — canonical schema, especially sections 4.5 (movement rules), 6.1 (single-location invariant), 6.6 (valid status for sprint assignment)

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **BMAD skill to modify:** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` (current pre-Epic-17 content)
- **BMAD manifest (no change):** `lib/bmad-extension/skills/add-to-sprint/bmad-skill-manifest.yaml`
- **BMAD workflow to modify:** `lib/bmad-extension/workflows/add-to-sprint/workflow.md`
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **Epics source:** `_bmad-output/planning-artifacts/epics.md` (Story 17.11 definition)
- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR69, FR134, FR66, FR65, FR133)
