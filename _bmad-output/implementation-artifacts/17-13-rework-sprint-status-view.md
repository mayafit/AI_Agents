# Story 17.13: Rework sprint-status-view Skill (Heavy Rework — Single Source Read)

Status: ready-for-dev

## Story

As a **Project Manager**,
I want the `sprint-status-view` skill to read all sprint data from the single `sprint-status.yaml` file,
So that sprint status display is fast and consistent with no cross-file reconciliation needed, and works identically across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** the `sprint-status-view` skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it reads `sprint-status.yaml`,
   **Then** it displays a formatted view organized into sections: active sprint(s), planning sprint(s), closed sprint summaries, backlog, epics, and alerts/warnings,
   **And** the display is read-only (the skill does NOT write to `sprint-status.yaml` or any other file),
   **And** no cross-file reconciliation is performed — all data comes from the single `sprint-status.yaml` file.

2. **Given** `sprint-status.yaml` contains sprints with `status: active`,
   **When** the status is displayed,
   **Then** each active sprint shows: name, status, a capacity bar (assigned items count / capacity), start date, end date,
   **And** each item within the sprint is listed with: id, title, type (story/bug), status, and severity (for bugs),
   **And** items are grouped or visually distinguished by type (story vs bug).

3. **Given** `sprint-status.yaml` contains sprints with `status: planning`,
   **When** the status is displayed,
   **Then** planning sprints are shown after active sprint(s) with the same format: name, capacity bar, items with status,
   **And** if a planning sprint has no items assigned, it shows "(No items assigned)" instead of an empty table.

4. **Given** `sprint-status.yaml` contains sprints with `status: closed`,
   **When** the status is displayed,
   **Then** closed sprints are shown as a collapsed summary: name, item count (at time of close), start/end dates,
   **And** individual items within closed sprints are NOT listed by default (collapsed view),
   **And** the user is offered an option to expand any closed sprint to see its items.

5. **Given** `sprint-status.yaml` contains a `backlog` section with items,
   **When** the status is displayed,
   **Then** backlog items are shown in priority order (array position = priority),
   **And** each item shows: id, title, type (story/bug), status, severity (for bugs),
   **And** bugs display their severity level alongside the status.

6. **Given** `sprint-status.yaml` contains an `epics` section,
   **When** the status is displayed,
   **Then** each epic is listed with: epic ID, status, retrospective state,
   **And** epic item counts are derived from backlog + sprint items that reference the epic (via the `epic` field).

7. **Given** the data contains conditions that warrant alerts,
   **When** the status is displayed,
   **Then** an Alerts/Warnings section is shown at the end with:
   - Over-capacity sprints (where `items.length > capacity`) with the overage count
   - Stale items: items with `status: in-progress` in sprints that are `active` with a `start` date more than 14 days before today
   - Empty active sprints (active sprint with zero items)
   **And** if no alert conditions are detected, the Alerts section is omitted entirely (not shown as "No alerts").

8. **Given** no `sprint-status.yaml` file exists,
   **When** the skill is invoked,
   **Then** it reports: "No sprint-status.yaml found. Run `/bmad-sprint-planning` to initialize.",
   **And** the skill exits without error.

9. **Given** the display format is rendered,
   **When** a human or LLM reads it,
   **Then** the output is formatted in Markdown that is both human-readable in the terminal and parseable by LLMs,
   **And** the display uses clear section headers, tables for item lists, and inline indicators for status.

10. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill + BMAD extension),
    **When** the ma-agents installer is run,
    **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
    **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/`,
    **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 1, 10)

- [ ] 1.1 Create `skills/sprint-status-view/skill.json` with metadata:
  ```json
  {
    "name": "sprint-status-view",
    "version": "1.0.0",
    "description": "Display formatted sprint progress, backlog, and epic status from the unified sprint-status.yaml",
    "category": "workflow",
    "tags": ["sprint-status", "sprint-management", "dashboard", "read-only"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) — this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/sprint-status-view/SKILL.md` with the complete skill workflow (see Task 4 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Update the BMAD extension skill source files (AC: 1, 10)

- [ ] 2.1 Modify `lib/bmad-extension/skills/sprint-status-view/SKILL.md` — rewrite the existing pre-Epic-17 BMAD extension SKILL.md to implement the new unified-schema workflow (see Task 3 for content). The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may have BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core display logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Verify `lib/bmad-extension/skills/sprint-status-view/bmad-skill-manifest.yaml` is correct (already exists, no changes expected):
  ```yaml
  type: skill
  name: sprint-status-view
  module: ma-skills
  ```

- [ ] 2.3 Verify the registration row in `lib/bmad-extension/module-help.csv` — the existing row reads:
  ```csv
  ma-skills,4-implementation,Sprint Status View,sprint-status-view,,skill:sprint-status-view,sprint-status-view,false,bmm-sm,,"View sprint progress with assigned items and remaining capacity.",_bmad-output/implementation-artifacts,"status display",
  ```
  Update the description to: "Display formatted sprint progress, backlog, and epic status from the unified sprint-status.yaml."

### Task 3: Rewrite the BMAD extension workflow (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)

Rewrite `lib/bmad-extension/workflows/sprint-status-view/workflow.md` to replace the old multi-file reconciliation logic with unified-schema reading. The workflow MUST implement the following steps:

- [ ] 3.1 **Step 1 — Load sprint-status.yaml:** Read `_bmad-output/implementation-artifacts/sprint-status.yaml`. If the file does not exist, output the missing-file message (AC 8) and exit. Parse all three data sections (`epics`, `backlog`, `sprints`) and top-level metadata.

- [ ] 3.2 **Step 2 — Classify sprints by status:** Partition the `sprints` map into three groups: active (`status: active`), planning (`status: planning`), closed (`status: closed`). Sort each group by sprint key (`sprint-N`) ascending.

- [ ] 3.3 **Step 3 — Display active sprint(s):** For each active sprint, display:
  - Sprint header: name, status, capacity bar showing `items.length / capacity`
  - Date range: start and end dates (if populated; show "—" if empty string)
  - Items table with columns: Item ID, Title, Type (story/bug icon), Status, Severity (for bugs; "—" for stories)
  - Over-capacity warning inline if `items.length > capacity`

- [ ] 3.4 **Step 4 — Display planning sprint(s):** For each planning sprint, display the same format as active sprints. If a planning sprint has zero items, show "*(No items assigned to this sprint)*" instead of the items table.

- [ ] 3.5 **Step 5 — Display closed sprint summaries:** For each closed sprint, display a one-line collapsed summary: name, item count, start/end dates. Do NOT list individual items by default.

- [ ] 3.6 **Step 6 — Display backlog:** Display all items from the `backlog` array in array order (priority order). Use a table with columns: Priority (#), Item ID, Title, Type, Status, Severity. Show total item count.

- [ ] 3.7 **Step 7 — Display epics overview:** For each epic in the `epics` map, display: epic ID, status, retrospective state. Derive item counts by scanning the `backlog` and all `sprints[*].items` for items whose `epic` field matches the epic number. Show a summary per epic (e.g., "3 in-progress, 2 backlog").

- [ ] 3.8 **Step 8 — Display alerts/warnings (conditional):** Scan for alert conditions:
  - **Over-capacity:** Any sprint where `items.length > capacity` (include sprint name and overage)
  - **Stale items:** Items with `status: in-progress` in active sprints where `start` date is more than 14 days before today
  - **Empty active sprints:** Active sprint with zero items
  If no alerts exist, skip this section entirely (do not output "No alerts").

- [ ] 3.9 **Step 9 — Offer next actions:** Present interactive options:
  1. Expand a closed sprint to see its items
  2. Run `/add-to-sprint` to assign backlog items
  3. Run `/modify-sprint` to change sprint settings
  4. Run `/add-sprint` to create a new sprint
  5. Exit

### Task 4: Implement the IDE skill SKILL.md content (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)

- [ ] 4.1 Write `skills/sprint-status-view/SKILL.md` implementing the same display logic as the workflow (Task 3), but authored as a standalone skill instruction (not wrapped in `<workflow>` XML tags). The content should:
  - Load and parse `sprint-status.yaml` (single file read)
  - Render the same sections in the same order: active sprints, planning sprints, closed sprint summaries, backlog, epics, alerts
  - Use the same display format (Markdown tables, section headers, capacity bars)
  - Include the same alert/warning logic
  - Omit the interactive "next actions" menu (IDE skills are typically invoked and displayed, not interactive multi-step)
  - Include a note that this is a READ-ONLY skill — no writes to any file

- [ ] 4.2 Ensure the SKILL.md does not include any hardcoded frontmatter — the installer will strip existing frontmatter and inject fresh frontmatter from `skill.json`.

### Task 5: Remove old multi-file reconciliation logic (AC: 1)

- [ ] 5.1 Confirm neither the IDE SKILL.md nor the BMAD extension SKILL.md contains any instruction to read `sprint-plan-*.yaml` files, `backlog.yaml`, or `bug-*.md` files for status data.
- [ ] 5.2 Confirm the only data source is `sprint-status.yaml`.
- [ ] 5.3 Confirm neither file writes to `sprint-status.yaml` or any other file (read-only invariant).
- [ ] 5.4 If the rewritten BMAD extension SKILL.md or workflow.md still contains references to the old multi-file approach (globbing `sprint-plan-*.yaml`, parsing `development_status` map, scanning `bug-*.md` frontmatter), remove them entirely and replace with the unified-schema single-file read.

### Task 6: Deployment verification (AC: 10)

- [ ] 6.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 6.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `sprint-status-view`).
- [ ] 6.3 Diff the installed IDE copy (e.g., `.claude/skills/sprint-status-view/SKILL.md`) against the source (`skills/sprint-status-view/SKILL.md`) — the content should match after accounting for frontmatter injection by the installer.
- [ ] 6.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/sprint-status-view/SKILL.md` after a BMAD install.
- [ ] 6.5 Verify `sprint-status-view` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates/modifies source files for BOTH.

**Why this matters:** Never edit files in agent install directories (`.claude/skills/`, `.cursor/skills/`, etc.) — those are deployed artifacts overwritten on each install. Always edit the SOURCE files described below.

#### Pipeline 1: IDE Skills (all IDE agents)
- **Source location:** `skills/sprint-status-view/skill.json` + `skills/sprint-status-view/SKILL.md` (NEW — create both)
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only)
- **Source location:** `lib/bmad-extension/skills/sprint-status-view/SKILL.md` + `bmad-skill-manifest.yaml` (EXISTS — modify SKILL.md only)
- **Workflow:** `lib/bmad-extension/workflows/sprint-status-view/workflow.md` (EXISTS — rewrite)
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` (maps skill to `bmm-sm` agent)
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install locations (NEVER edit these directly)
- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` — all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` — managed by BMAD deployer

### What This Story Changes vs Current Behavior

**Current state (pre-Epic-17, post-rollback):** The `sprint-status-view` BMAD extension skill exists at `lib/bmad-extension/skills/sprint-status-view/SKILL.md`. It reads the old flat `development_status` map from `sprint-status.yaml`, globs for `sprint-plan-*.yaml` files to get sprint definitions, and scans `bug-*.md` frontmatter for bug metadata. There is NO IDE skill counterpart — it only exists in the BMAD pipeline. The workflow at `lib/bmad-extension/workflows/sprint-status-view/workflow.md` orchestrates this multi-file reconciliation.

**New behavior (unified schema):** The skill reads `sprint-status.yaml` which now contains three self-contained sections (`epics`, `backlog`, `sprints`). All data needed for the display is in one file — no cross-referencing `sprint-plan-*.yaml`, no scanning `bug-*.md`, no parsing `development_status` flat maps. The skill also gets a NEW IDE counterpart so it works across all 8+ IDE agents, not just BMAD.

### Key Design Decisions

- **Read-only:** This skill NEVER writes to `sprint-status.yaml` or any other file. It is purely a display/reporting skill. The previous version had a regeneration step (step 7) that wrote to `sprint-status.yaml` — this is removed entirely.
- **Single file source:** All data comes from `sprint-status.yaml`. No secondary file reads (`sprint-plan-*.yaml`, `backlog.yaml`, `bug-*.md`).
- **Display order:** Active sprints first (highest visibility), then planning sprints, then closed sprint summaries, then backlog, then epics, then alerts. This prioritizes what the user most likely wants to see.
- **Closed sprint collapsing:** Closed sprints show only a summary line by default to keep the view focused on active work. Users can expand them on demand via the BMAD workflow interactive menu.
- **Alerts are conditional:** The alerts section only appears when there are actual alert conditions. No "everything is fine" noise.
- **Epic item counts are derived on the fly:** The `epics` section in `sprint-status.yaml` only stores `status` and `retrospective`. Item counts per epic are computed by scanning `backlog` and `sprints[*].items` for items whose `epic` field matches. This avoids stale denormalized counts. Note: done/archived items are not in the file, so epic counts reflect only active items.
- **Stale item threshold:** 14 days is the default threshold for flagging in-progress items as stale. Computed by comparing the sprint's `start` date to today. Only applies to active sprints.
- **IDE skill vs BMAD workflow:** The IDE SKILL.md provides the same display output but without the interactive menu (options 1-5). IDE skills are typically fire-and-display. The BMAD workflow includes the interactive next-actions menu for follow-up operations.
- **No done-folder scanning:** Unlike the old version's suggestion to scan `done/` for accurate epic totals, the new version displays only items currently in `sprint-status.yaml`. Done items have been archived and removed from the file per the schema design (FR130). Epic counts therefore reflect active/pending work only, which is the appropriate view for sprint management.

### Unified Schema Sections Read

- **`epics`** — read for epic status overview and retrospective state
- **`backlog`** — read for unassigned items display in priority order
- **`sprints`** — read for sprint display (active, planning, closed) with their items
- **Metadata** — `project`, `last_updated` shown in the header for context and data freshness

### Display Format Reference

The output should follow this structure (example with realistic data):

```markdown
# Sprint Status — agents
*Last updated: 2026-04-03*

---

## Active Sprints

### Sprint 3 — Epic 17 Foundation
**Status:** active | **Capacity:** 3 / 6 | **Start:** 2026-04-03 | **End:** 2026-04-14

| Item | Title | Type | Status | Severity |
|------|-------|------|--------|----------|
| 17-9-unified-sprint-status-schema | Unified sprint-status.yaml Schema | Story | in-progress | — |
| 17-15-rework-bmad-sprint-planning | Rework bmad-sprint-planning Skill | Story | ready-for-dev | — |
| 5-5-explicit-parameter-passing | Explicit Parameter Passing | Story | review | — |

---

## Planning Sprints

### Sprint 4 — Epic 17 Skills
**Status:** planning | **Capacity:** 0 / 8 | **Start:** — | **End:** —

*(No items assigned to this sprint)*

---

## Closed Sprints

| Sprint | Items | Start | End |
|--------|-------|-------|-----|
| Sprint 2 — Epic 5 Bundled Install | 0 items (archived) | 2026-03-15 | 2026-03-28 |

---

## Backlog — 4 items

| # | Item | Title | Type | Status | Severity |
|---|------|-------|------|--------|----------|
| 1 | 17-10-rework-generate-backlog | Rework generate-backlog Skill | Story | ready-for-dev | — |
| 2 | 17-16-rework-add-sprint | Rework add-sprint Skill | Story | backlog | — |
| 3 | BUG-path-spaces | Fix space-in-path bug in CLI | Bug | backlog | high |
| 4 | 14-1-research-sprint-management-integration | Research Sprint Management Integration | Story | backlog | — |

---

## Epics

| Epic | Status | Retrospective | Items (active) |
|------|--------|---------------|----------------|
| epic-4 | on-hold | optional | 2 total (2 on-hold) |
| epic-5 | in-progress | optional | 2 total (2 review) |
| epic-14 | backlog | — | 5 total (5 backlog) |
| epic-17 | in-progress | optional | 16 total (1 in-progress, 2 ready-for-dev, ...) |

---

## Alerts

- **Over capacity:** Sprint X is over capacity by N item(s) (M / C)
- **Stale in-progress:** item-id has been in-progress for N days (Sprint X started 2026-MM-DD)
- **Empty active sprint:** Sprint Y is active but has no items assigned
```

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for sprint-status.yaml)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Current BMAD extension SKILL.md:** `lib/bmad-extension/skills/sprint-status-view/SKILL.md` (pre-Epic-17, to be rewritten)
- **Current BMAD workflow:** `lib/bmad-extension/workflows/sprint-status-view/workflow.md` (pre-Epic-17, to be rewritten)
- **BMAD manifest:** `lib/bmad-extension/skills/sprint-status-view/bmad-skill-manifest.yaml` (no changes needed)
- **Module help CSV:** `lib/bmad-extension/module-help.csv` (description update only)
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md`
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/` (SKILL.md + bmad-skill-manifest.yaml)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema this skill reads from — three sections (epics, backlog, sprints) with consistent item structure
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file; this skill relies on the file existing and being well-formed
- **Story 17.10** (upstream): `generate-backlog` populates the backlog section this skill displays
- **Story 17.16** (upstream): `add-sprint` creates sprint entries this skill displays
- **Story 17.11** (upstream): `add-to-sprint` moves items into sprints; sprint-status-view shows the result
- **Story 17.12** (upstream): `remove-from-sprint` moves items back to backlog; sprint-status-view shows the result
- **Story 17.14** (related): `cleanup-done` removes archived items from the file; this skill will show fewer items after cleanup runs
- **Story 17.20** (related): `bmad-sprint-status` is the quick-summary health check variant; this story (17.13) is the detailed interactive view
- **Story 17.19** (related): `story-status-lookup` is single-item lookup; this story is full-sprint dashboard display

### PRD Traceability

- **FR65:** All sprint, backlog, and epic status data is managed in a single `sprint-status.yaml` file — this skill reads that single file exclusively
- **FR71:** Sprint status displays the unified `sprint-status.yaml` contents — real sprint definitions with assigned items, epic status, and the unassigned backlog — not just a list of epics
- **FR130:** Done items are removed from `sprint-status.yaml` — they do not clutter the active status view
- **FR133:** `sprint-status.yaml` includes top-level metadata (generated, last_updated, project, etc.) — displayed in the view header
- **FR134:** Each item carries consistent structure (id, type, epic, title, priority, status, severity) — displayed in item tables
- **FR135:** Each sprint entity carries: name, status, capacity, optional start/end dates, and items list — all displayed in sprint sections
- **FR66:** Sprint capacity is defined by number of items — displayed as capacity bar (assigned/capacity) per sprint
- **NFR19:** Sprint extension workflows must read/write the unified `sprint-status.yaml` file — this skill reads only that file, no secondary sources

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- Skill Integration Map entry: `sprint-status-view | 17.13 | Reads all sections, renders progress | All (read-only) | Heavy`
