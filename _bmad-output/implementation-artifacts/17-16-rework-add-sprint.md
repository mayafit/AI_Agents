# Story 17.16: Rework add-sprint Skill (Moderate Rework -- Section-Based)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `add-sprint` skill to create a new sprint entry in the `sprints` section of `sprint-status.yaml`,
So that new sprints are defined within the unified file rather than as separate files, and the skill is available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** the Scrum Master invokes `add-sprint` from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** the sprint details are provided (capacity, optional name, optional ISO start/end dates),
   **Then** a new sprint entry is appended to the `sprints` map in `sprint-status.yaml`:
   ```yaml
   sprints:
     sprint-4:
       name: "Sprint 4"
       status: planning
       capacity: 6
       start: "2026-04-15"
       end: "2026-04-28"
       items: []
   ```
   **And** the sprint ID is auto-incremented from the highest existing sprint ID in the `sprints` map,
   **And** the `last_updated` metadata field is set to the current ISO-8601 timestamp,
   **And** all existing content in `sprint-status.yaml` is preserved unchanged (epics, backlog, other sprints).

2. **Given** the `sprints` map already contains sprints,
   **When** a new sprint is created,
   **Then** the sprint ID is `sprint-{max + 1}` where `max` is the highest numeric suffix among existing sprint keys,
   **And** the default sprint name is derived from the previous sprint's naming pattern (e.g., if the last sprint is "Sprint 3 -- Epic 17 Foundation", default to "Sprint 4"),
   **And** the user may override both the auto-generated ID number and the default name.

3. **Given** a sprint with the auto-generated ID already exists in the `sprints` map (e.g., due to non-sequential numbering),
   **When** the skill detects the collision,
   **Then** it reports the conflict and prompts the user for an alternative sprint number,
   **And** re-validates the new number does not collide.

4. **Given** a sprint with `status: planning` already exists,
   **When** a new sprint is created,
   **Then** the new sprint is also created with `status: planning` (multiple planning sprints are allowed per schema section 6.4),
   **And** the skill does NOT enforce any restriction on the number of planning sprints.

5. **Given** `sprint-status.yaml` does not exist,
   **When** `add-sprint` is invoked,
   **Then** the skill reports: "No sprint-status.yaml found. Run sprint planning first to initialize the file.",
   **And** exits without creating any file.

6. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/add-sprint/` and BMAD extension at `lib/bmad-extension/skills/add-sprint/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

7. **Given** the skill is invoked from ANY IDE agent OR from a BMAD workflow,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 1, 6, 7) -- NEW

The IDE skill does NOT yet exist. This task creates it from scratch so all 8+ IDE coding agents can invoke `add-sprint` directly.

- [ ] 1.1 Create `skills/add-sprint/skill.json` with metadata:
  ```json
  {
    "name": "add-sprint",
    "version": "1.0.0",
    "description": "Guided workflow to create a new sprint entry in the sprints section of sprint-status.yaml with capacity limits, optional ISO dates, and auto-incremented ID",
    "category": "workflow",
    "tags": ["sprint-management", "add-sprint", "capacity"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/add-sprint/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Modify the BMAD extension skill (AC: 1, 6, 7) -- EXISTS, MODIFY

The BMAD extension skill ALREADY EXISTS at `lib/bmad-extension/skills/add-sprint/SKILL.md`. This task modifies it in place. The `bmad-skill-manifest.yaml` does NOT need changes.

- [ ] 2.1 Rewrite `lib/bmad-extension/skills/add-sprint/SKILL.md` -- replace the entire pre-Epic-17 workflow (which creates standalone `sprint-plan-N.yaml` files with `sprint_number`, `sprint_name`, `capacity`, `assigned_items`, `status`, `start_context`, `end_context`, `created_date`, `last_modified` fields) with the new unified schema workflow (see Task 3 for content specification). The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may include BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Verify `lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml` is unchanged:
  ```yaml
  type: skill
  name: add-sprint
  module: ma-skills
  ```

- [ ] 2.3 Update the description in `lib/bmad-extension/module-help.csv` for the `add-sprint` row. The current description ("Create a new sprint with capacity limits and optional start/end context.") should be updated to reference the unified schema:
  ```
  "Create a new sprint entry in the sprints section of sprint-status.yaml with capacity limits, optional ISO dates, and auto-incremented ID."
  ```

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 -- Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` (or resolve path from config).
  - If the file does not exist, report error: "No sprint-status.yaml found. Run sprint planning first to initialize the file." Exit (AC 5).
  - Parse the full file: `epics`, `backlog`, and `sprints` sections.

- [ ] 3.2 **Step 1 -- Auto-increment sprint ID and derive default name:**
  - Parse existing sprint keys from the `sprints` section (e.g., `sprint-1`, `sprint-3`, `sprint-5`).
  - Find the highest numeric suffix among all existing sprint keys.
  - Auto-generate new ID: `sprint-{max + 1}`. If no sprints exist, default to `sprint-1`.
  - Derive default name: examine the most recently numbered sprint's `name` field. If it follows the pattern "Sprint N" or "Sprint N -- description", default new name to "Sprint {new_number}". If the pattern is different, default to "Sprint {new_number}" as a safe fallback.
  - Display the auto-generated ID and default name.
  - Prompt: "Sprint ID: sprint-{N} -- press Enter to accept or type a different number."
  - If user provides a different number, validate the new `sprint-{user_number}` key does not already exist in the `sprints` map. If collision, report and re-prompt (AC 3).
  - Prompt: "Sprint name: '{default_name}' -- press Enter to accept or type a different name."
  - Store as `{{sprint_id}}` and `{{sprint_name}}`.

- [ ] 3.3 **Step 2 -- Gather capacity (required):**
  - Explain capacity: the maximum number of items (stories + bugs) that can be assigned to this sprint. This is advisory -- skills will warn but not block when exceeded (per schema section 4.2).
  - Prompt: "What is the sprint capacity? (Enter a positive integer)"
  - Validate input is a positive integer (> 0, no decimals, no non-numeric characters).
  - If invalid, display error and re-prompt.
  - Store as `{{capacity}}` (integer).

- [ ] 3.4 **Step 3 -- Gather optional start and end dates:**
  - Prompt: "Optional -- Sprint start date (ISO format YYYY-MM-DD, press Enter to skip):"
  - If provided, validate ISO date format (YYYY-MM-DD). If invalid, show error and re-prompt.
  - Store as `{{start}}` (ISO date string, or empty string `""` if skipped).
  - Prompt: "Optional -- Sprint end date (ISO format YYYY-MM-DD, press Enter to skip):"
  - If provided, validate ISO date format. If end is before start, warn but allow (user may have reasons).
  - Store as `{{end}}` (ISO date string, or empty string `""` if skipped).

- [ ] 3.5 **Step 4 -- Confirmation:**
  - Display summary:
    ```
    ## New Sprint Summary -- Please Confirm

    - Sprint ID: {{sprint_id}}
    - Sprint Name: {{sprint_name}}
    - Capacity: {{capacity}} items
    - Start Date: {{start}} (empty if skipped)
    - End Date: {{end}} (empty if skipped)
    - Status: planning
    - Items: [] (empty -- use /add-to-sprint to assign items)
    - Target: sprint-status.yaml sprints section
    ```
  - Prompt: "Confirm creation? [y] Yes / [n] Cancel / [e] Edit a field"
  - On `e`: ask which field (id / name / capacity / start / end) and goto the appropriate step.
  - On `n`: display "Sprint creation cancelled." and exit.
  - On `y`: proceed to Step 5.

- [ ] 3.6 **Step 5 -- Write sprint entry to sprint-status.yaml (AC: 1, 2):**
  - Read the current content of `sprint-status.yaml` (re-read to get latest state).
  - Append new entry to the `sprints` map:
    ```yaml
    {{sprint_id}}:
      name: "{{sprint_name}}"
      status: planning
      capacity: {{capacity}}
      start: "{{start}}"
      end: "{{end}}"
      items: []
    ```
  - Preserve the `epics` section unchanged.
  - Preserve the `backlog` section unchanged.
  - Preserve all existing entries in the `sprints` section unchanged.
  - Update `last_updated` to the current ISO-8601 timestamp.
  - Preserve `generated` (never change).
  - Write the complete file in a single atomic write (read-modify-write pattern).

- [ ] 3.7 **Step 6 -- Summary output:**
  - Display creation confirmation:
    ```
    Sprint created successfully!

    - Sprint: {{sprint_name}} ({{sprint_id}})
    - Capacity: {{capacity}} items
    - Status: planning

    Next Steps:
    - Use /add-to-sprint to assign backlog items to this sprint
    - Use /modify-sprint to update sprint details later
    - Use /sprint-status-view to view sprint progress
    ```

### Task 4: Update the BMAD extension workflow file (AC: 7)

- [ ] 4.1 Rewrite `lib/bmad-extension/workflows/add-sprint/workflow.md` to match the new unified schema workflow. Replace all references to standalone `sprint-plan-N.yaml` file creation, `sprints/` directory, `start_context`/`end_context`, `created_date`/`last_modified`, and `assigned_items` with the new `sprint-status.yaml` unified schema operations. The workflow must align with the SKILL.md content from Task 3.

### Task 5: Verify the old standalone-file pattern is NOT present (AC: 1)

- [ ] 5.1 Confirm neither SKILL.md file contains any instruction to create a standalone `sprint-plan-N.yaml` or `sprints/sprint-N.yaml` file.
- [ ] 5.2 Confirm neither SKILL.md file contains any instruction to create a `sprints/` directory.
- [ ] 5.3 Confirm neither SKILL.md file references `start_context` / `end_context` (old schema fields -- replaced by `start` / `end` ISO dates).
- [ ] 5.4 Confirm neither SKILL.md file references `created_date` or `last_modified` as per-sprint fields (removed in unified schema -- only file-level `last_updated` exists).
- [ ] 5.5 Confirm neither SKILL.md file references `assigned_items` (old field name -- replaced by `items` array).
- [ ] 5.6 Confirm the only data file read/written is `sprint-status.yaml`.

### Task 6: Deployment verification (AC: 6)

- [ ] 6.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 6.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `add-sprint`).
- [ ] 6.3 Diff the installed IDE copy (e.g., `.claude/skills/add-sprint/SKILL.md`) against the source (`skills/add-sprint/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer.
- [ ] 6.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/add-sprint/SKILL.md` after a BMAD install.
- [ ] 6.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/add-sprint/SKILL.md`.
- [ ] 6.6 Verify `add-sprint` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files in one and modifies existing source files in the other.

**Why this matters:** The previous version of this story directed edits to `.claude/skills/add-sprint/SKILL.md`, which is an INSTALLED COPY (a read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live.

#### Pipeline 1: IDE Skills (all IDE agents) -- NEW for add-sprint

- **Source location:** `skills/add-sprint/skill.json` + `skills/add-sprint/SKILL.md`
- **Status:** Does NOT exist yet. Task 1 creates these files from scratch.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) -- EXISTS, MODIFY

- **Source location:** `lib/bmad-extension/skills/add-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** ALREADY EXISTS with the pre-Epic-17 workflow (creates standalone `sprint-plan-N.yaml` files). Task 2 rewrites the SKILL.md in place.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` (row: `bmm-sm` agent) -- already registered, description update needed.
- **Workflow file:** `lib/bmad-extension/workflows/add-sprint/workflow.md` -- also exists and needs updating (Task 4).

#### Install Locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer

### What This Story Changes vs Current Behavior

**Current behavior (pre-Epic-17, restored after rollback):** The `add-sprint` skill gathers sprint details (number, name, capacity, start/end context) through a guided workflow, then writes a standalone YAML file at `_bmad-output/implementation-artifacts/sprint-plan-N.yaml`. It manually asks for the sprint number, has no auto-increment, uses `start_context`/`end_context` (free-text, not ISO dates), and includes per-sprint `created_date`/`last_modified` timestamps. The skill only exists as a BMAD extension -- no IDE skill version exists.

**New behavior (unified schema):** The skill gathers sprint details through the same guided workflow pattern but writes the new sprint as an entry in the `sprints` map of `sprint-status.yaml`. No standalone file is created. Sprint ID is auto-incremented from the highest existing sprint ID in the map. Dates are ISO-formatted (`YYYY-MM-DD`) rather than free-text context. The file must already exist (created by `bmad-sprint-planning`). The skill exists in BOTH pipelines -- a new IDE skill and a modified BMAD extension.

### Key Differences from Old Implementation

| Aspect | Old (pre-Epic-17) | New (unified schema) |
|--------|-------------------|---------------------|
| Output target | Standalone `sprint-plan-N.yaml` | Entry in `sprint-status.yaml` `sprints` map |
| File creation | Creates `sprint-plan-N.yaml` and optionally `sprints/` directory | No file creation -- writes to existing `sprint-status.yaml` |
| Sprint ID | User-provided number | Auto-incremented from highest existing, user can override |
| Sprint name | User-provided, defaults to "Sprint N" | Smart default from previous sprint's name pattern |
| Date fields | `start_context` / `end_context` (free text) | `start` / `end` (ISO date `YYYY-MM-DD` or empty string) |
| Per-sprint timestamps | `created_date`, `last_modified` | None (only file-level `last_updated`) |
| Items field | `assigned_items: []` | `items: []` |
| File prerequisite | None (creates its own file) | `sprint-status.yaml` must exist (run sprint-planning first) |
| Overwrite protection | Checks if standalone file exists | Checks if sprint ID exists in `sprints` map |
| IDE availability | BMAD extension only | BOTH IDE skill + BMAD extension |

### Key Design Decisions

- **Auto-increment ID:** Sprint IDs are derived from the highest existing key in the `sprints` map, NOT from globbing files. `sprint-{max + 1}` with collision detection.
- **Smart default name:** Reads the most recently numbered sprint's `name` for pattern detection. Falls back to "Sprint N" if no pattern is detected.
- **ISO dates only:** `start` and `end` are ISO date strings (`YYYY-MM-DD`) or empty strings. Free-text "context" is removed.
- **No per-sprint timestamps:** The unified schema has only file-level `last_updated`. Per-sprint `created_date`/`last_modified` are dropped.
- **New sprints always `planning`:** Schema constraint (section 4.6: `planning -> active -> closed`). No option to create a sprint in any other state.
- **Items starts empty:** Sprint items are added via `add-to-sprint` (Story 17.11), not during sprint creation.
- **Capacity is advisory:** Per schema section 4.2, capacity is a non-negative integer. Skills warn but do not block when exceeded.
- **Atomic write:** Single read-modify-write to `sprint-status.yaml`. All existing content preserved.

### Unified Schema Sections Touched

- **`sprints`** -- write (append new sprint entry with `status: planning` and `items: []`)
- **`epics`** -- preserved unchanged (pass-through on write)
- **`backlog`** -- preserved unchanged (pass-through on write)
- **Metadata** -- `last_updated` is updated on every write

### Gotchas from Current Implementation

1. **The current SKILL.md creates a standalone file.** The new implementation must NOT create any standalone file -- it writes to the existing `sprint-status.yaml`.
2. **The current SKILL.md creates a `sprints/` directory.** The new implementation must NOT create any directory.
3. **The current SKILL.md has overwrite protection for standalone files.** The new implementation must check for sprint ID collision in the `sprints` map instead.
4. **The current SKILL.md uses `start_context`/`end_context` (free-text).** The new schema uses `start`/`end` (ISO date or empty string). The field semantics are different.
5. **The current SKILL.md includes `created_date`/`last_modified` per sprint.** The unified schema does NOT have per-sprint timestamps. Only the file-level `last_updated` exists.
6. **The current SKILL.md uses `assigned_items` as the field name.** The unified schema uses `items`.
7. **The BMAD workflow file** at `lib/bmad-extension/workflows/add-sprint/workflow.md` mirrors the old SKILL.md and also needs updating (Task 4).
8. **Sprint ID format:** `sprint-{number}` (kebab-case). This is consistent between old and new models.

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema, especially sections 4.1-4.6 for sprint entity)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **BMAD skill to modify:** `lib/bmad-extension/skills/add-sprint/SKILL.md` (current pre-Epic-17 content)
- **BMAD manifest (no change):** `lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml`
- **BMAD workflow to modify:** `lib/bmad-extension/workflows/add-sprint/workflow.md`
- **Module help CSV:** `lib/bmad-extension/module-help.csv`

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema and the sprint entity structure this skill writes
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file; `add-sprint` requires it to exist before creating a sprint
- **Story 17.10** (peer): `generate-backlog` populates the `backlog` section; this skill creates sprint entries alongside the backlog
- **Story 17.11** (downstream): `add-to-sprint` assigns items to sprints created by this skill
- **Story 17.12** (downstream): `remove-from-sprint` removes items from sprints created by this skill
- **Story 17.17** (downstream): `modify-sprint` updates sprint metadata on sprints created by this skill
- **Story 17.21** (downstream): `close-sprint` closes sprints created by this skill
- **Story 12.1** (original): This skill was originally created in Epic 12; this story reworks it for the unified model

### PRD Traceability

- **FR68:** A BMAD extension workflow enables creating sprints with defined capacity for realistic sprint planning. The sprint is written as an entry in the unified `sprint-status.yaml` with `status: planning`, capacity, and optional dates.
- **FR66:** Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint creation.
- **FR133:** `sprint-status.yaml` includes top-level metadata (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`) -- `last_updated` must be refreshed on write.
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow).

### Architecture Reference

- Architecture Decision P2-5 in `_bmad-output/planning-artifacts/architecture.md` -- Pre-built Extension Workflows (FR61, FR68-FR70)
- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified sprint-status.yaml model
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` -- canonical schema, especially sections 4.1-4.6 (sprint entity, status transitions, capacity semantics)
