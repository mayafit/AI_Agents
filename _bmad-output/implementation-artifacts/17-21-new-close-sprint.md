# Story 17.21: New close-sprint Skill

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want a `close-sprint` skill that transitions a sprint from `active` to `closed`, archives done and cancelled items, and disposes incomplete items via user-selected options (move to next sprint, return to backlog, or per-item decision),
So that sprint closure is a clean, well-defined workflow available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** the Scrum Master invokes `close-sprint` from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** an active sprint exists in `sprint-status.yaml`,
   **Then** the skill displays the sprint summary: sprint name, total items, done count, cancelled count, and incomplete count (items with status `ready-for-dev`, `in-progress`, `review`, or `on-hold`).

2. **Given** the sprint has items with `status: done`,
   **When** the sprint is closed,
   **Then** all done items are REMOVED from the sprint's `items` array,
   **And** their corresponding story/bug `.md` files are moved to `{story_location}/done/` (same archival pattern as `cleanup-done`, Story 17.14),
   **And** if the `done/` subfolder does not exist, it is created.

3. **Given** the sprint has items with `status: cancelled`,
   **When** the sprint is closed,
   **Then** all cancelled items are REMOVED from the sprint's `items` array,
   **And** their corresponding story/bug `.md` files are moved to `{story_location}/done/` (same archival as done items, per schema section 6.6),
   **And** if the source `.md` file does not exist, the skill logs a warning and proceeds with the YAML removal,
   **And** if the destination file already exists in `done/`, the skill logs a warning and skips the file move but still removes the item from `sprint-status.yaml`.

4. **Given** the sprint has incomplete items (status is `ready-for-dev`, `in-progress`, `review`, or `on-hold`),
   **When** the sprint is being closed,
   **Then** the skill presents three options for handling incomplete items (FR137):
   (a) **Move all to the next sprint** -- all incomplete items are MOVED from the current sprint's `items` array to the next sprint's `items` array (the target sprint must exist in `planning` status; if no planning sprint exists, the skill suggests running `/add-sprint` first or falls back to option b),
   (b) **Return all to backlog** -- all incomplete items are MOVED from the sprint's `items` array back to the `backlog` section (FR134 -- movement semantics); each item receives a `priority` field with value `max(existing_backlog_priorities) + 1` (appended to end); if the backlog is empty, the first item gets `priority: 1`; after all insertions, all backlog priorities are renumbered 1..N to match array positions (schema section 3.3); each item's status is RESET to `ready-for-dev` (schema section 4.5 -- the only permitted backward status transition, triggered by movement),
   (c) **Decide per item** -- the skill iterates through each incomplete item and asks whether to move it to the next sprint or return it to the backlog,
   **And** items moved to the next sprint preserve their current status (e.g., `in-progress` stays `in-progress`),
   **And** items returned to the backlog have their status RESET to `ready-for-dev` (schema section 4.5).

5. **Given** all items have been archived or dispositioned,
   **When** the sprint is fully processed,
   **Then** the sprint's `status` is set to `closed`,
   **And** the sprint's `items` array is empty (`[]`),
   **And** the sprint definition is preserved in the `sprints` section (historical record),
   **And** `last_updated` is set to the current ISO-8601 timestamp,
   **And** all changes are persisted in a SINGLE atomic write to `sprint-status.yaml` (item removals, backlog additions, sprint status change, metadata update -- one file write),
   **And** a summary is displayed: "Sprint {name} closed. X items archived, Y items moved to {target sprint}, Z items returned to backlog."

6. **Given** no active sprint exists in `sprint-status.yaml`,
   **When** `close-sprint` is invoked,
   **Then** it reports: "No active sprint found. Nothing to close."

7. **Given** `sprint-status.yaml` does not exist,
   **When** `close-sprint` is invoked,
   **Then** it reports: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

8. **Given** the active sprint has zero items (`items: []`),
   **When** `close-sprint` is invoked,
   **Then** the sprint is closed immediately (no archival or disposition needed),
   **And** the sprint's `status` is set to `closed`,
   **And** a summary is displayed: "Sprint {name} closed. No items to disposition."

9. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/close-sprint/` and BMAD extension at `lib/bmad-extension/skills/close-sprint/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

10. **Given** the skill is invoked from ANY IDE agent OR from a BMAD workflow,
    **When** it executes,
    **Then** it works identically in both invocation modes (NFR19).

11. **Given** moving incomplete items to the next sprint would exceed that sprint's capacity,
    **When** the user chooses option (a) or moves items via option (c),
    **Then** the skill warns: "Adding N items would bring {target sprint} to X/Y capacity (exceeds limit)",
    **And** proceeds with the move (capacity is advisory per schema section 4.2 -- skills warn but do not block).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 9, 10) -- NEW

The IDE skill does NOT exist anywhere. This task creates it from scratch.

- [ ] 1.1 Create `skills/close-sprint/skill.json` with metadata:
  ```json
  {
    "name": "close-sprint",
    "version": "1.0.0",
    "description": "Close an active sprint — archive done/cancelled items, disposition incomplete items (move to next sprint or return to backlog), set sprint status to closed",
    "category": "workflow",
    "tags": ["sprint-management", "close-sprint", "archival", "movement-semantics"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/close-sprint/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Create the BMAD extension skill (AC: 9, 10) -- NEW

The BMAD extension skill does NOT exist anywhere (this is a brand new skill). This task creates it from scratch.

- [ ] 2.1 Create `lib/bmad-extension/skills/close-sprint/SKILL.md` with the BMAD extension version of the workflow (see Task 3 for content specification). The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may include BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Create `lib/bmad-extension/skills/close-sprint/bmad-skill-manifest.yaml` with:
  ```yaml
  type: skill
  name: close-sprint
  module: ma-skills
  ```

- [ ] 2.3 Add a NEW row to `lib/bmad-extension/module-help.csv` for `close-sprint`:
  ```
  ma-skills,4-implementation,Close Sprint,close-sprint,,skill:close-sprint,close-sprint,false,bmm-sm,,"Close an active sprint — archive done/cancelled items, disposition incomplete items, set sprint status to closed.",_bmad-output/implementation-artifacts,"sprint plan",
  ```

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5, 6, 7, 8, 11)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 -- Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` (or resolve path from config).
  - If the file does not exist, report error: "No sprint-status.yaml found. Run sprint planning first to initialize the file." Exit (AC 7).
  - Parse the full file: metadata, `epics`, `backlog`, and `sprints` sections.

- [ ] 3.2 **Step 1 -- Identify the active sprint:**
  - Scan the `sprints` section for a sprint with `status: active`.
  - Per schema section 6.4, at most one sprint can be active.
  - If no active sprint found, report: "No active sprint found. Nothing to close." (AC 6). Exit.
  - Store the active sprint's ID and data.

- [ ] 3.3 **Step 2 -- Display sprint summary:**
  - Read the active sprint's `items` array.
  - If the items array is empty, display: "Sprint {name} has no items." Skip to Step 7 (immediate close) (AC 8).
  - Categorize items by status:
    - **Done:** items with `status: done`
    - **Cancelled:** items with `status: cancelled`
    - **Incomplete:** items with `status: ready-for-dev`, `in-progress`, `review`, or `on-hold`
  - Display a summary table:
    ```
    ## Sprint Closure Summary: {sprint_name} ({sprint_id})

    Total items: N
    - Done: X (will be archived)
    - Cancelled: Y (will be archived)
    - Incomplete: Z (requires disposition)

    | # | ID | Title | Type | Status | Disposition |
    |---|....|.......|......|........|.............|
    ```
  - Prompt for confirmation: [c] Confirm and proceed, [x] Cancel closure.
  - On cancel, exit without changes.

- [ ] 3.4 **Step 3 -- Archive done items (AC: 2):**
  - Ensure `{story_location}/done/` directory exists (create if not).
  - For each item with `status: done`:
    - Resolve the file path: `{story_location}/{id}.md`.
    - If the source file does not exist, log warning: "File not found: {path} -- skipping file move." Continue.
    - If the destination file already exists in `done/`, log warning: "File already exists at destination: {path} -- skipping file move." Continue.
    - Move the file: `{story_location}/{id}.md` -> `{story_location}/done/{id}.md`.
    - Handle bug naming variants: try `{id}.md` first, then case variations if the ID follows bug naming convention.
  - Remove all done items from the sprint's `items` array.
  - Record count of archived done items.

- [ ] 3.5 **Step 4 -- Archive cancelled items (AC: 3):**
  - For each item with `status: cancelled`:
    - Apply the same file archival logic as done items (Step 3).
  - Remove all cancelled items from the sprint's `items` array.
  - Record count of archived cancelled items.

- [ ] 3.6 **Step 5 -- Disposition incomplete items (AC: 4, 11):**
  - If no incomplete items remain, skip to Step 7.
  - Display incomplete items:
    ```
    ## Incomplete Items Requiring Disposition

    | # | ID | Title | Type | Status |
    |---|....|.......|......|........|
    ```
  - Present three options:
    - **(a) Move all to the next sprint**
    - **(b) Return all to backlog**
    - **(c) Decide per item**

  **Option (a) -- Move to next sprint:**
  - Scan the `sprints` section for a sprint with `status: planning`.
  - If no planning sprint exists, report: "No planning sprint found. Run `/add-sprint` to create one, or choose option (b) to return items to backlog." Re-prompt with options (b) and (c) only.
  - If multiple planning sprints exist, display them and prompt for selection.
  - Check capacity: if adding N incomplete items would exceed the target sprint's `capacity`, warn: "Adding N items would bring {target sprint} to X/Y capacity (exceeds limit)." Proceed anyway (advisory).
  - For each incomplete item:
    - REMOVE the item from the active sprint's `items` array.
    - ADD the item to the target sprint's `items` array.
    - PRESERVE the item's current `status` (no reset).
  - Record count and target sprint name.

  **Option (b) -- Return to backlog:**
  - For each incomplete item:
    - REMOVE the item from the active sprint's `items` array.
    - SET `status` to `ready-for-dev` (schema section 4.5 -- backward status transition triggered by movement).
    - ADD a `priority` field: `max(existing_backlog_priorities) + 1`. If backlog is empty, `priority: 1`. Each subsequent item gets the next sequential value.
    - APPEND the item (with fields: `id`, `type`, `epic`, `title`, `priority`, `status`, `severity`) to the `backlog` array.
  - After all movements: renumber ALL backlog items' `priority` values sequentially (1..N) to match array positions (schema section 3.3).
  - Record count.

  **Option (c) -- Per-item decision:**
  - For each incomplete item:
    - Display: "Item: {id} -- {title} (status: {status})"
    - Prompt: "[s] Move to next sprint / [b] Return to backlog"
    - If the user chooses (s), validate a planning sprint exists (same check as option a; if none exists, inform and default to backlog).
    - Apply the chosen action using the same logic as options (a) or (b) for that individual item.
  - Record counts per destination.

- [ ] 3.7 **Step 6 -- Validate single-location invariant:**
  - Before writing, verify that no item ID appears in more than one location (backlog + all sprints). This is a safety check against bugs in the movement logic (schema section 6.1).
  - If a duplicate is detected, report the error and abort the write.

- [ ] 3.8 **Step 7 -- Finalize sprint closure (AC: 5, 8):**
  - Set the active sprint's `status` to `closed`.
  - Verify the sprint's `items` array is empty (`[]`). If items remain (should not happen after Steps 3-6), report a warning but proceed with closure.
  - Preserve the sprint definition in the `sprints` section (do not delete the sprint entry).
  - Update `last_updated` to current ISO-8601 timestamp.
  - Preserve `generated` (never change).
  - Preserve all other sections unchanged (`epics`, other sprints, unmodified backlog entries).
  - Write the complete `sprint-status.yaml` in a single atomic write.

- [ ] 3.9 **Step 8 -- Summary output:**
  - Display closure summary:
    ```
    ## Sprint Closed Successfully

    Sprint: {sprint_name} ({sprint_id})
    Status: closed

    Disposition:
    - Done items archived: X
    - Cancelled items archived: Y
    - Items moved to {target_sprint}: M
    - Items returned to backlog: N

    Files moved to done/: [list]
    Files skipped (warnings): [list if any]

    Next Steps:
    - Use /add-sprint to create the next sprint
    - Use /prioritize-backlog to reorder the backlog after returns
    - Use /sprint-status-view to review the updated status
    ```

### Task 4: Verify no legacy patterns are present (AC: 2, 4, 5)

- [ ] 4.1 Confirm neither SKILL.md file contains any reference to writing standalone `sprint-plan-*.yaml` files.
- [ ] 4.2 Confirm neither SKILL.md file contains any reference to reading/writing a standalone `backlog.yaml` file.
- [ ] 4.3 Confirm neither SKILL.md file contains any instruction to read the `development_status` map (old schema).
- [ ] 4.4 Confirm neither SKILL.md file references `bug-*.md` globbing for item discovery (items come from `sprint-status.yaml` -- file globbing is only for resolving `.md` file paths for archival moves).
- [ ] 4.5 Confirm the only data file read/written is `sprint-status.yaml`.
- [ ] 4.6 Confirm neither SKILL.md file references any hardcoded agent install paths (`.claude/skills/`, `.cursor/skills/`, etc.).

### Task 5: Deployment verification (AC: 9)

- [ ] 5.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 5.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `close-sprint`).
- [ ] 5.3 Diff the installed IDE copy (e.g., `.claude/skills/close-sprint/SKILL.md`) against the source (`skills/close-sprint/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer.
- [ ] 5.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/close-sprint/SKILL.md` after a BMAD install.
- [ ] 5.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/close-sprint/SKILL.md`.
- [ ] 5.6 Verify `close-sprint` appears in the BMAD module help output (check `module-help.csv` row is present).

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files in BOTH from scratch. Understanding the deployment architecture is essential.

**Why this matters:** The previous version of this story directed edits to `.claude/skills/close-sprint/SKILL.md` and `.claude/skills/MANIFEST.yaml`, which are INSTALLED COPIES (read-only deployed artifacts). Those paths are where the installer OUTPUTS files, not where source files live. Additionally, the previous version only mentioned the BMAD extension pipeline and completely omitted the IDE skill pipeline. This rewrite creates everything in the correct source locations.

#### Pipeline 1: IDE Skills (all IDE agents) -- NEW, CREATE

- **Source location:** `skills/close-sprint/skill.json` + `skills/close-sprint/SKILL.md`
- **Status:** Does NOT exist anywhere. Task 1 creates these files from scratch.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) -- NEW, CREATE

- **Source location:** `lib/bmad-extension/skills/close-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** Does NOT exist anywhere. Task 2 creates these files from scratch.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` -- must add a NEW row for `close-sprint` (Task 2.3).
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer

### What This Story Creates (Nothing Exists Yet)

This is a **brand new skill** -- not a rework. Nothing exists in either pipeline. This story creates from scratch:

1. `skills/close-sprint/skill.json` -- IDE skill metadata (NEW)
2. `skills/close-sprint/SKILL.md` -- IDE skill workflow (NEW)
3. `lib/bmad-extension/skills/close-sprint/SKILL.md` -- BMAD extension skill workflow (NEW)
4. `lib/bmad-extension/skills/close-sprint/bmad-skill-manifest.yaml` -- BMAD manifest (NEW)
5. New row in `lib/bmad-extension/module-help.csv` -- BMAD module registration (NEW)

### Relationship to Other Skills -- Combines Two Patterns

The `close-sprint` skill is a **composite workflow** that combines patterns from two existing skills:

| Pattern | Source Skill | Usage in close-sprint |
|---------|-------------|----------------------|
| Done/cancelled item archival | `cleanup-done` (17.14) | Steps 3-4: remove from YAML, move `.md` file to `done/` |
| Return to backlog (movement) | `remove-from-sprint` (17.12) | Step 5 option (b): move item from sprint to backlog with status reset and priority assignment |
| Move to another sprint | N/A (new to close-sprint) | Step 5 option (a): move item between sprints preserving status |

### Schema Section 4.5 -- Status Reset on Backlog Return

The schema at `_bmad-output/planning-artifacts/sprint-status-schema.md` section 4.5 is authoritative:

> **Sprint -> Backlog (`remove-from-sprint`):** A `priority` field is **added** with value `max(existing backlog priorities) + 1` (appended to end). The item's status is **reset to `ready-for-dev`**.

**Discrepancy with epics.md:** The epics definition for Story 17.21 says "each item's status is preserved." The schema section 4.5 says status is reset to `ready-for-dev` on backlog return. **The schema is authoritative** -- it was written later as the canonical specification. This story follows the schema: items returned to backlog get `ready-for-dev`, while items moved to the next sprint preserve their status.

### Schema Section 6.8 -- Sprint Item Disposition on Close

The schema provides the authoritative close-sprint behavior:

> Before a sprint is set to `closed` via `close-sprint`, all items SHOULD be dispositioned:
> - **`done` items** -- Archived (removed from file, story file moved to `done/`).
> - **`cancelled` items** -- Archived similarly with a cancelled notation.
> - **Remaining items** (`ready-for-dev`, `in-progress`, `review`) -- User decides per-item: move to next sprint (if one exists in `planning` state) or return to backlog (status reset to `ready-for-dev`).

### PRD FR137 Refinement

FR137 mentions archiving cancelled items to `done/canceled/` subfolder. The architecture (P2-11) and schema (section 6.6) simplify this: both done and cancelled items are archived to `done/` (same folder). This story follows the architecture/schema, not the FR137 subfolder split.

### Key Design Decisions

- **Status reset on backlog return:** Items returned to backlog always get `status: ready-for-dev`, per schema section 4.5. This prevents stale `in-progress`/`review` items in the backlog.
- **Status preserved on sprint-to-sprint move:** Items moved to the next sprint keep their current status. This is a different movement type than return-to-backlog -- it is a forward continuation.
- **Cancelled items included:** Both `done` and `cancelled` items are archivable. Schema section 6.6 defines `cancelled` as a terminal state archived similarly to `done`.
- **Capacity is advisory:** Moving items to the next sprint may exceed capacity. The skill warns but does not block (schema section 4.2).
- **Priority at end of backlog:** Items returned to backlog are appended to the end (highest priority number = lowest priority). Run `/prioritize-backlog` afterward.
- **Atomic write:** All changes (archival removal, backlog insertion, sprint-to-sprint movement, status change, metadata) happen in one file write to maintain the single-location invariant.
- **Empty sprint fast path:** If the active sprint has zero items, it is closed immediately with no archival or disposition workflow.
- **Single-location validation:** Before writing, the skill validates no item ID appears in multiple locations. This guards against movement logic bugs.

### Unified Schema Sections Touched

- **`sprints`** -- read (find active sprint, display items) + write (remove items from active sprint, add items to planning sprint if option a, set `status: closed`, empty `items: []`)
- **`backlog`** -- read (determine max priority for insertion) + write (append returned items with priority field, renumber all priorities 1..N)
- **`epics`** -- preserved unchanged (pass-through on write)
- **Metadata** -- `last_updated` is updated on every write
- **File system** -- move story/bug `.md` files from `{story_location}/` to `{story_location}/done/`

### Gotchas and Edge Cases

1. **All items done/cancelled:** If every item in the sprint is done or cancelled, there are no incomplete items to disposition. Skip straight to closure after archival.
2. **No planning sprint for option (a):** If the user chooses "move all to next sprint" but no planning sprint exists, fall back to offering options (b) and (c) only. Suggest running `/add-sprint` first.
3. **Multiple planning sprints:** If more than one planning sprint exists, display them and let the user choose the target.
4. **Empty active sprint:** A sprint with `items: []` can be closed immediately (AC 8).
5. **Bug file naming variants:** Bug IDs in `sprint-status.yaml` follow `BUG-slug` convention, but actual files may be `BUG-slug.md` or `bug-slug.md`. Handle case variations during file resolution.
6. **File not found during archival:** If a story file does not exist at the expected path, log a warning and proceed with the YAML cleanup. Do not abort the entire operation.
7. **File already exists in done/:** If the destination file already exists (from a previous partial cleanup), log a warning and skip the file move. Still remove the item from YAML.
8. **The `done/` directory may not exist on first run.** Create it if needed.
9. **Priority renumbering after backlog insertion:** After appending returned items to the backlog, renumber ALL `priority` values 1..N to keep the denormalized index in sync with array positions (schema section 3.3).
10. **Movement is atomic:** All removals from the sprint and additions to backlog/next-sprint happen in one file write. No intermediate state where an item exists in neither or both locations (schema section 6.1).
11. **On-hold items:** Items with `status: on-hold` are treated as incomplete (not done, not cancelled). They follow the same disposition options as `in-progress` or `review` items.
12. **Sprint transitions are forward-only:** `planning -> active -> closed` (schema section 4.6). This skill only transitions `active -> closed`. It must NOT close a `planning` sprint (that would skip `active`).

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema, including section 6.8 (Sprint Item Disposition on Close), 4.5 (movement rules), 6.1 (single-location invariant), 6.4 (single-active-sprint constraint), 6.7 (closed sprint immutability)
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file this skill reads/writes
- **Story 17.10** (prerequisite): `generate-backlog` populates the `backlog` section
- **Story 17.16** (prerequisite): `add-sprint` creates the sprint entries; if no planning sprint exists for option (a), the SM is directed to use `/add-sprint`
- **Story 17.14** (pattern source): `cleanup-done` provides the done-item archival pattern (file move to `done/`, YAML removal) reused in Steps 3-4
- **Story 17.12** (pattern source): `remove-from-sprint` provides the return-to-backlog movement pattern (status reset, priority assignment, renumbering) reused in Step 5 option (b)
- **Story 17.11** (related): `add-to-sprint` is the forward movement skill; `close-sprint` includes the reverse (option b)
- **Story 17.17** (related): `modify-sprint` can update sprint metadata; `close-sprint` handles the full closure lifecycle
- **Story 17.24** (follow-up): `prioritize-backlog` should be run after items are returned to backlog to reorder priorities

### PRD Traceability

- **FR137:** A BMAD extension workflow enables closing a sprint. The close workflow: (1) archives done items, (2) archives cancelled items, (3) presents disposition options for remaining items (move to next sprint, return to backlog, or per-item decision), (4) sets sprint status to closed.
- **FR134:** Each item carries a consistent structure. Movement semantics -- items MOVE between sections; an item exists in exactly one location at any time.
- **FR136:** When moving items between sprints, items are removed from the source sprint's `items` list and added to the destination -- maintaining the single-location invariant.
- **FR130:** When a story or bug reaches `done` status, it is removed from `sprint-status.yaml` entirely -- done items do not clutter the active status view.
- **FR131:** When a story or bug reaches `done` status, its `.md` file is moved to a `done/` subfolder.
- **FR133:** `sprint-status.yaml` includes top-level metadata (`generated`, `last_updated`, `project`, etc.) -- `last_updated` must be refreshed on write.
- **FR135:** Each sprint entity carries: `name`, `status` (planning / active / closed), `capacity`, optional dates, and `items` list.
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow).

### Architecture Reference

- Architecture Decision P2-5 in `_bmad-output/planning-artifacts/architecture.md` -- Pre-built Extension Workflows (FR61, FR68-FR70)
- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified sprint-status.yaml model, specifically the "Close-Sprint Lifecycle Workflow" section
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` -- canonical schema, especially sections 4.5 (movement rules), 4.6 (sprint status transitions), 6.1 (single-location invariant), 6.3 (done-removal rule), 6.4 (single-active-sprint), 6.7 (closed sprint immutability), 6.8 (sprint item disposition on close)

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **Epics source:** `_bmad-output/planning-artifacts/epics.md` (Story 17.21 definition)
- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR130, FR131, FR133, FR134, FR135, FR136, FR137)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (P2-5, P2-11)
