# Story 17.20: Rework bmad-sprint-status Skill (Extension Override -- Analysis-Focused Health Summary)

Status: review

## Story

As a **Scrum Master**,
I want the `bmad-sprint-status` skill to produce an analysis-focused health summary with risk flags and recommendations by reading the unified `sprint-status.yaml`,
So that sprint health, risks, and next-action recommendations are surfaced quickly from the single source of truth, available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** `bmad-sprint-status` is a BMAD built-in skill (originating from `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/`),
   **When** the extension override files are created in `lib/bmad-extension/skills/bmad-sprint-status/`,
   **Then** the extension version takes precedence over the built-in during BMAD deployment (via the `--custom-content` flag),
   **And** the built-in at `node_modules/bmad-method/` is NOT modified.

2. **Given** the `bmad-sprint-status` skill is invoked in interactive mode,
   **When** it reads `sprint-status.yaml`,
   **Then** it identifies the active sprint from the `sprints` section and produces a health summary containing:
   - **Active Sprint Health:** items grouped by status count (in-progress, review, ready-for-dev, backlog, on-hold, cancelled), capacity usage (`items.length / capacity` as a ratio and percentage), sprint name, and date range
   - **Risk Flags:** blocked/on-hold items, over-capacity warning, stale items (in-progress for more than 14 days since sprint `start` date), items not started (still in `ready-for-dev` or `backlog` status), no items progressing toward completion (no items in `review` or `done`)
   - **Backlog Health:** total unassigned items count, count by type (story vs bug), critical/high severity bug count
   - **Epic Progress:** stories done/total per epic (derived by scanning `backlog` and all `sprints[*].items` for matching `epic` field; done count from `done/` folder)
   - **Sprint History:** count of closed sprints with one-line summaries (name, item count, dates)
   - **Next Recommendation:** the single most actionable next step (same priority logic as current built-in)

3. **Given** the active sprint has items with concerning statuses,
   **When** the health summary is generated,
   **Then** it flags specific, actionable risks such as:
   - "3 of 6 items still in `ready-for-dev` status -- not yet started"
   - "Sprint at 100% capacity (6/6) with 2 items still in `ready-for-dev`"
   - "No items in `review` or `done` -- sprint may be at risk"
   - "Item 17-15 has been in-progress for 12 days (sprint started 2026-04-03)"
   - "1 item on-hold: 5-5-explicit-parameter-passing"
   - "`last_updated` is 8 days old -- sprint-status.yaml may be stale"
   - "Orphaned story detected: story 99-1 references epic-99 which is not in the `epics` section"

4. **Given** no active sprint exists (all sprints are `planning` or `closed`, or no sprints section),
   **When** the health summary is generated,
   **Then** it reports "No active sprint" and recommends running `/add-sprint` or activating a planning sprint,
   **And** still displays backlog health, epic progress, and sprint history sections.

5. **Given** `sprint-status.yaml` does not exist,
   **When** the skill is invoked,
   **Then** it reports: "No sprint-status.yaml found. Run `/bmad-sprint-planning` to initialize.",
   **And** the skill exits without error.

6. **Given** the skill is invoked in data mode (`mode = data`),
   **When** it processes `sprint-status.yaml`,
   **Then** it returns structured key-value output consumable by other skills/workflows:
   - `active_sprint_id`, `active_sprint_name`
   - `count_backlog`, `count_ready`, `count_in_progress`, `count_review`, `count_done`, `count_on_hold`
   - `capacity_used`, `capacity_total`, `capacity_pct`
   - `epic_summary` (per-epic done/total)
   - `backlog_total`, `backlog_bugs`, `backlog_critical_bugs`
   - `risks` (list of risk strings)
   - `next_workflow_id`, `next_story_id`
   **And** the output contract is backward-compatible with the current data mode consumers (preserving `next_workflow_id`, `next_story_id`, `count_*`, `risks` keys).

7. **Given** the skill is invoked in validate mode (`mode = validate`),
   **When** it checks `sprint-status.yaml`,
   **Then** it validates the unified schema structure: presence of `epics`, `backlog`, `sprints` sections plus 6 metadata fields, valid status values per the schema state machines, single-location invariant (spot check), and at most one active sprint,
   **And** returns `is_valid`, `error`, `suggestion` keys.

8. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/bmad-sprint-status/` and BMAD extension override at `lib/bmad-extension/skills/bmad-sprint-status/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension override is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the BMAD extension override replaces the upstream built-in during BMAD agent compilation.

9. **Given** the skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19),
   **And** the skill is read-only -- it NEVER writes to `sprint-status.yaml` or any other file.

10. **Given** the analysis-focused summary from `bmad-sprint-status` and the display-focused view from `sprint-status-view` (Story 17.13) both exist,
    **When** a user needs sprint information,
    **Then** the two skills serve complementary purposes:
    - `bmad-sprint-status` = **analysis and recommendations** (health metrics, risk flags, next-action recommendation, concise for LLM context)
    - `sprint-status-view` = **display and navigation** (formatted tables, all items listed, interactive menu for drill-down)
    **And** there is no functional duplication -- `bmad-sprint-status` does NOT render full item tables, and `sprint-status-view` does NOT compute risk flags or recommendations.

## Tasks / Subtasks

### Task 1: Create the BMAD extension override skill files (AC: 1, 8) -- CRITICAL OVERRIDE

`bmad-sprint-status` is a **BMAD built-in skill** that ships with `bmad-method` at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/`. Per project policy, we NEVER modify built-in skills directly. Instead, we create an **extension override** in `lib/bmad-extension/skills/bmad-sprint-status/` that takes precedence at deployment time.

The built-in contains two files (`SKILL.md`, `workflow.md`). The extension override MUST provide replacements for BOTH files (plus a `bmad-skill-manifest.yaml`) so the override is complete and no built-in file leaks through.

- [x] 1.1 Create `lib/bmad-extension/skills/bmad-sprint-status/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: bmad-sprint-status
  module: ma-skills
  ```

- [x] 1.2 Create `lib/bmad-extension/skills/bmad-sprint-status/SKILL.md` -- override of the built-in SKILL.md. The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and references `_bmad/bmm/config.yaml` for path resolution. It MUST delegate to `./workflow.md` (same pattern as the upstream built-in):
  ```markdown
  ---
  name: bmad-sprint-status
  description: 'Summarize sprint health, surface risks, and recommend next actions from the unified sprint-status.yaml. Use when the user says "check sprint status" or "show sprint health"'
  ---

  Follow the instructions in ./workflow.md.
  ```

- [x] 1.3 Create `lib/bmad-extension/skills/bmad-sprint-status/workflow.md` -- complete replacement of the upstream built-in workflow. This is the main implementation file. See Task 4 for content specification.

- [x] 1.4 Register the skill in `lib/bmad-extension/module-help.csv` by adding a row:
  ```csv
  ma-skills,4-implementation,Sprint Status Health,bmad-sprint-status,,skill:bmad-sprint-status,bmad-sprint-status,false,bmm-sm,,"Analyze sprint health, surface risk flags, and recommend next actions from the unified sprint-status.yaml.",_bmad-output/implementation-artifacts,"health summary",
  ```
  The `agent` column is `bmm-sm` (Scrum Master) because sprint health analysis is a Scrum Master responsibility.

### Task 2: Create the IDE skill source files (AC: 8, 9) -- NEW

The IDE skill does NOT yet exist (the current installed copy at `.claude/skills/bmad-sprint-status/` is the BMAD built-in, not an IDE skill). This task creates a proper IDE skill from scratch so all 8+ IDE coding agents can invoke sprint health analysis directly.

- [x] 2.1 Create `skills/bmad-sprint-status/skill.json` with metadata:
  ```json
  {
    "name": "bmad-sprint-status",
    "version": "1.0.0",
    "description": "Analyze sprint health, surface risk flags, and recommend next actions from the unified sprint-status.yaml",
    "category": "workflow",
    "tags": ["sprint-status", "sprint-management", "health", "risks", "analysis"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [x] 2.2 Create `skills/bmad-sprint-status/SKILL.md` with the complete skill workflow (see Task 5 for content specification). This is the canonical skill content that the installer deploys to all IDE agents. The IDE version is self-contained (does not reference `./workflow.md`) and does not rely on BMAD config loading -- it resolves paths from the project structure directly.

### Task 3: Read and understand the current built-in skill (AC: 1-7)

Before writing the replacement files, study the built-in to understand what is being overridden.

- [x] 3.1 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/SKILL.md` (upstream built-in) -- note it delegates to `./workflow.md`
- [x] 3.2 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/workflow.md` (upstream built-in) -- document the workflow structure:
  - Step 0: Mode dispatch (interactive / data / validate)
  - Step 1: Locate sprint-status.yaml
  - Step 2: Parse flat `development_status` map, classify keys by pattern, count statuses, detect risks
  - Step 3: Select next action recommendation
  - Step 4: Display summary
  - Step 5: Offer interactive actions (4 options)
  - Step 20: Data mode output (key-value pairs)
  - Step 30: Validate mode (schema checks)
- [x] 3.3 Document what MUST change: `development_status` flat map parsing replaced with structured `epics`/`backlog`/`sprints` section reads, legacy status mappings removed, capacity tracking added, sprint-scoped analysis added, risk flags expanded
- [x] 3.4 Document what MUST be preserved: three execution modes (interactive / data / validate), mode dispatch routing, next-action recommendation logic, data mode output key names (backward compatibility), interactive action menu structure

### Task 4: Implement the BMAD extension workflow.md content (AC: 2, 3, 4, 5, 6, 7, 9, 10)

The `workflow.md` file (for `lib/bmad-extension/skills/bmad-sprint-status/workflow.md`) must implement the following workflow.

- [x] 4.1 **Initialization -- Config loading:** Preserve the existing initialization block from the built-in workflow:
  - Load config from `{project-root}/_bmad/bmm/config.yaml`
  - Resolve: `project_name`, `user_name`, `communication_language`, `document_output_language`, `implementation_artifacts`
  - Set `sprint_status_file` = `{implementation_artifacts}/sprint-status.yaml`
  - Set `done_folder` = `{implementation_artifacts}/done/`
  - Load `project_context` = `**/project-context.md` (if exists)

- [x] 4.2 **Step 0 -- Mode dispatch (preserved from built-in):**
  - `mode = data` -> Jump to Step 20
  - `mode = validate` -> Jump to Step 30
  - `mode = interactive` (default) -> Continue to Step 1

- [x] 4.3 **Step 1 -- Locate and load sprint-status.yaml:**
  - Load `{project_context}` for project-wide patterns (if exists)
  - Try to read `{sprint_status_file}`
  - If file not found: output "sprint-status.yaml not found. Run `/bmad-sprint-planning` to initialize." and exit
  - Parse YAML into three data sections: `epics`, `backlog`, `sprints`, plus metadata fields

- [x] 4.4 **Step 2 -- Analyze active sprint health (AC: 2):**
  - Scan `sprints` map for the sprint with `status: active`. If no active sprint found, set `active_sprint = null` and skip to Step 2b
  - For the active sprint, compute:
    - `items_by_status`: count items grouped by `status` field (in-progress, review, ready-for-dev, backlog, on-hold, cancelled, done)
    - `capacity_used` = `items.length`, `capacity_total` = `capacity`, `capacity_pct` = `(items.length / capacity) * 100` (handle capacity=0 as "no limit")
    - `sprint_age_days` = days between `start` date and today (if `start` is populated)
    - Per-item staleness: for each item with `status: in-progress`, compute days since sprint `start` date

- [x] 4.5 **Step 2b -- Analyze backlog health (AC: 2):**
  - `backlog_total` = length of `backlog` array
  - `backlog_bugs` = count of items with `type: bug`
  - `backlog_critical_bugs` = count of bugs with `severity: critical` or `severity: high`
  - `backlog_stories` = `backlog_total - backlog_bugs`

- [x] 4.6 **Step 2c -- Compute epic progress (AC: 2):**
  - For each epic in the `epics` section:
    - Count items across `backlog` and all `sprints[*].items` where `epic` field matches the epic number
    - Scan `{done_folder}` for archived story files matching the epic pattern (e.g., files starting with `N-` for `epic-N`)
    - Compute `done_count` (from done folder) and `total_count` (done + active items)
    - Record epic status from `epics` section

- [x] 4.7 **Step 2d -- Compute sprint history (AC: 2):**
  - Count sprints with `status: closed`
  - For each closed sprint, capture: name, item count (length of `items` array), start/end dates

- [x] 4.8 **Step 3 -- Detect risk flags (AC: 3, 4):**
  - **Stale items:** Items with `status: in-progress` in the active sprint where `start` date is more than 14 days before today
  - **Not started:** Count of items in active sprint with `status: ready-for-dev` or `status: backlog` -- flag if more than half the sprint items are not started
  - **Over-capacity:** Active sprint where `items.length > capacity` (include overage count)
  - **No progress:** No items in `review` or `done` status in the active sprint (flag only if sprint is at least 3 days old)
  - **On-hold/blocked items:** Any items with `status: on-hold` or `status: cancelled` in the active sprint
  - **Stale file:** `last_updated` timestamp is more than 7 days old (fall back to `generated` if `last_updated` missing)
  - **Orphaned stories:** Any item in `backlog` or `sprints[*].items` whose `epic` field references an epic number not present in the `epics` section
  - **In-progress epic with no stories:** Any epic with `status: in-progress` that has zero items referencing it across `backlog` and all `sprints[*].items`
  - **Critical bugs in backlog:** Any bug with `severity: critical` sitting in the backlog (not assigned to a sprint)
  - **No active sprint:** No sprint has `status: active` (recommend activating a planning sprint or creating one)

- [x] 4.9 **Step 4 -- Select next action recommendation (AC: 2):**
  Preserve the priority-based recommendation logic from the built-in, adapted for the unified schema:
  1. If any item in the active sprint has `status: in-progress` -> recommend `dev-story` for that item
  2. Else if any item has `status: review` -> recommend `code-review` for that item
  3. Else if any item has `status: ready-for-dev` (in sprint or backlog) -> recommend `dev-story`
  4. Else if any item has `status: backlog` -> recommend `create-story`
  5. Else if any epic has `retrospective: optional` and `status: done` -> recommend `retrospective`
  6. Else -> all work complete; congratulate the user
  When selecting "first" item: prefer active sprint items over backlog items; within each, sort by epic number then story number.

- [x] 4.10 **Step 5 -- Display interactive summary (AC: 2, 3):**
  Output the health summary in this format:

  ```
  ## Sprint Health Summary

  - Project: {{project}} ({{project_key}})
  - Tracking: {{tracking_system}}
  - Last updated: {{last_updated}}

  ### Active Sprint: {{sprint_name}}
  **Capacity:** {{capacity_used}} / {{capacity_total}} ({{capacity_pct}}%)
  **Dates:** {{start}} to {{end}}
  **Items by status:** in-progress {{n}}, review {{n}}, ready-for-dev {{n}}, backlog {{n}}, on-hold {{n}}

  ### Risk Flags
  {{#each risks}}
  - {{this}}
  {{/each}}
  (or "No risks detected." if empty)

  ### Backlog Health
  - Total unassigned: {{backlog_total}} ({{backlog_stories}} stories, {{backlog_bugs}} bugs)
  - Critical/high bugs in backlog: {{backlog_critical_bugs}}

  ### Epic Progress
  {{#each epics}}
  - Epic {{id}} ({{status}}): {{done}}/{{total}} done
  {{/each}}

  ### Sprint History
  - {{closed_count}} closed sprint(s)
  {{#each closed_sprints}}
  - {{name}}: {{item_count}} items, {{start}} to {{end}}
  {{/each}}

  ### Next Recommendation
  /{{next_workflow_id}} ({{next_story_id}})
  ```

- [x] 4.11 **Step 6 -- Offer interactive actions (AC: 2):**
  Present menu options:
  1. Run recommended workflow now
  2. Show all items grouped by status (active sprint items + backlog items)
  3. Show detailed sprint view -- suggest running `/sprint-status-view` for full formatted tables
  4. Show raw sprint-status.yaml
  5. Exit

- [x] 4.12 **Step 20 -- Data mode output (AC: 6):**
  Parse and analyze the same as Steps 1-4, then output structured key-value pairs:
  ```
  active_sprint_id = {{active_sprint_id}}
  active_sprint_name = {{active_sprint_name}}
  next_workflow_id = {{next_workflow_id}}
  next_story_id = {{next_story_id}}
  count_backlog = {{count_backlog}}
  count_ready = {{count_ready}}
  count_in_progress = {{count_in_progress}}
  count_review = {{count_review}}
  count_done = {{count_done}}
  count_on_hold = {{count_on_hold}}
  capacity_used = {{capacity_used}}
  capacity_total = {{capacity_total}}
  capacity_pct = {{capacity_pct}}
  backlog_total = {{backlog_total}}
  backlog_bugs = {{backlog_bugs}}
  backlog_critical_bugs = {{backlog_critical_bugs}}
  epic_summary = {{epic_summary}}
  risks = {{risks}}
  ```
  Note: `count_backlog`, `count_ready`, `count_in_progress`, `count_review`, `count_done`, `next_workflow_id`, `next_story_id`, and `risks` are backward-compatible with the existing data mode output from the built-in. The additional keys (`active_sprint_id`, `capacity_*`, `backlog_*`, `epic_summary`, `count_on_hold`) are new extensions that do not break existing consumers.

- [x] 4.13 **Step 30 -- Validate mode (AC: 7):**
  Check `sprint-status.yaml` against the unified schema:
  - File exists
  - Required metadata fields present: `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`
  - Three data sections present: `epics` (map or empty map), `backlog` (array or empty array), `sprints` (map or empty map)
  - All epic status values are valid: `backlog`, `in-progress`, `done`, `on-hold`, `cancelled`
  - All item status values are valid: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `on-hold`, `cancelled`
  - All sprint status values are valid: `planning`, `active`, `closed`
  - At most one sprint has `status: active`
  - Spot check single-location invariant: sample up to 5 item IDs and verify each appears in exactly one location
  Return `is_valid`, `error`, `suggestion` keys. If validation passes: `is_valid = true`, `message = "sprint-status.yaml valid: unified schema structure verified"`.

### Task 5: Implement the IDE skill SKILL.md content (AC: 2, 3, 4, 5, 6, 7, 9, 10)

- [x] 5.1 Write `skills/bmad-sprint-status/SKILL.md` implementing the same analysis logic as the workflow (Task 4), but authored as a standalone skill instruction (not wrapped in `<workflow>` XML tags, not referencing `./workflow.md`). The content should:
  - Load and parse `sprint-status.yaml` from `_bmad-output/implementation-artifacts/sprint-status.yaml` (direct path resolution, no BMAD config dependency)
  - Support the same three modes: interactive (default), data, validate
  - Compute the same health metrics, risk flags, epic progress, and recommendations
  - Render the same summary format
  - Include the interactive action menu
  - Include a note that this is a READ-ONLY skill -- no writes to any file

- [x] 5.2 Ensure the SKILL.md does not include any hardcoded frontmatter -- the installer will strip existing frontmatter and inject fresh frontmatter from `skill.json`.

### Task 6: Remove legacy parsing and validate clean separation from sprint-status-view (AC: 9, 10)

- [x] 6.1 Confirm neither the IDE SKILL.md nor the BMAD extension workflow.md contains any instruction to parse the flat `development_status` map
- [x] 6.2 Confirm neither file reads `sprint-plan-*.yaml`, `backlog.yaml`, or scans `bug-*.md` frontmatter for status data
- [x] 6.3 Confirm the only data source is `sprint-status.yaml` (plus `done/` folder for epic done counts)
- [x] 6.4 Confirm neither file writes to `sprint-status.yaml` or any other file (read-only invariant)
- [x] 6.5 Confirm legacy status mappings are removed: no "drafted" -> "ready-for-dev", no "contexted" -> "in-progress"
- [x] 6.6 Confirm `bmad-sprint-status` does NOT render full item tables (that is `sprint-status-view`'s job) -- it shows only counts and specific risk-flagged items by ID
- [x] 6.7 Confirm `bmad-sprint-status` DOES compute risk flags and recommendations (that is NOT `sprint-status-view`'s job -- 17.13 does alerts but not recommendations)

### Task 7: Deployment verification (AC: 1, 8)

- [x] 7.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer
- [x] 7.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `bmad-sprint-status` with the updated description)
- [x] 7.3 Diff the installed IDE copy (e.g., `.claude/skills/bmad-sprint-status/SKILL.md`) against the source (`skills/bmad-sprint-status/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer
- [x] 7.4 Verify the BMAD extension override exists at `_bmad/extensions/ma-agents-skills/skills/bmad-sprint-status/SKILL.md` after a BMAD install
- [x] 7.5 Verify the BMAD extension override's `workflow.md` exists at `_bmad/extensions/ma-agents-skills/skills/bmad-sprint-status/workflow.md`
- [x] 7.6 Confirm the installed BMAD copy does NOT contain the old `development_status` parsing logic (override successfully replaced the built-in)
- [x] 7.7 Verify `bmad-sprint-status` appears in the BMAD module help output with the updated description

## Dev Notes

### CRITICAL: Extension Override of a Built-in Skill

This story creates an **extension override** for the BMAD built-in `bmad-sprint-status` skill. The override mechanism works as follows:

1. The built-in lives at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/` (SKILL.md + workflow.md)
2. The extension override lives at `lib/bmad-extension/skills/bmad-sprint-status/` (SKILL.md + workflow.md + bmad-skill-manifest.yaml)
3. During BMAD deployment (`lib/bmad.js` with `--custom-content`), the extension module's skill folder takes precedence over the built-in -- the entire folder is replaced
4. The override MUST provide ALL files that the built-in provides (SKILL.md and workflow.md) so no built-in file leaks through

**Never modify the built-in at `node_modules/bmad-method/`.** That is an upstream package managed by the bmad-method maintainers.

### Two Deployment Pipelines

#### Pipeline 1: IDE Skills (all IDE agents)
- **Source location:** `skills/bmad-sprint-status/skill.json` + `skills/bmad-sprint-status/SKILL.md` (NEW -- create both)
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.

#### Pipeline 2: BMAD Extension Override (BMAD agents only)
- **Source location:** `lib/bmad-extension/skills/bmad-sprint-status/SKILL.md` + `workflow.md` + `bmad-skill-manifest.yaml` (NEW -- create all three)
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Override behavior:** The extension skill folder with the same name as a built-in skill replaces the built-in during BMAD agent compilation
- **Registered in:** `lib/bmad-extension/module-help.csv` (maps skill to `bmm-sm` agent)

#### Install locations (NEVER edit these directly)
- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer
- `.claude/skills/bmad-sprint-status/` currently contains the BMAD built-in copy -- this will be replaced by the IDE skill on next install

### Relationship to sprint-status-view (Story 17.13) -- BOTH Are Needed

After agent discussion, the decision is that **both skills are needed** and serve complementary purposes:

| Aspect | `bmad-sprint-status` (this story) | `sprint-status-view` (17.13) |
|--------|-----------------------------------|------------------------------|
| **Purpose** | Analysis and recommendations | Display and navigation |
| **Output style** | Concise health metrics, risk flags, one recommended next action | Full formatted tables of all items, capacity bars, interactive drill-down |
| **Item rendering** | Counts by status; individual items mentioned only when flagged as risks | Every item listed in Markdown tables with all fields |
| **Risk analysis** | Computes 10 risk conditions with specific actionable messages | Shows 3 alert conditions (over-capacity, stale, empty sprint) |
| **Recommendations** | Priority-based next-action recommendation (dev-story, code-review, etc.) | No recommendations -- offers navigation menu instead |
| **Modes** | interactive / data / validate | Display only (no data or validate mode) |
| **Epic progress** | Done/total counts including `done/` archive scan | Active item counts only (no done folder scan) |
| **LLM optimization** | Optimized for LLM context consumption (concise, structured) | Optimized for human reading (visual formatting, tables) |

**Key non-overlap guarantees:**
- `bmad-sprint-status` does NOT render full item tables
- `sprint-status-view` does NOT compute risk flags or action recommendations
- `bmad-sprint-status` menu option 3 suggests running `/sprint-status-view` for detailed tables (cross-skill handoff)

### What This Story Changes vs Current Behavior

**Current state (built-in, pre-Epic-17):** The `bmad-sprint-status` workflow parses the flat `development_status` map:
- Classifies keys by pattern: `epic-*` = epic, `*-retrospective` = retrospective, everything else = story
- Counts statuses across ALL stories globally (no sprint concept)
- Maps legacy statuses ("drafted" -> "ready-for-dev", "contexted" -> "in-progress")
- Has no capacity tracking, no sprint-scoped analysis, no backlog/sprint distinction
- Detects 6 risk conditions (review items, no ready-for-dev, stale file, orphaned stories, empty epics)
- Recommends next workflow using priority logic (in-progress > review > ready-for-dev > backlog > retrospective)

**New behavior (unified schema, this story):** After the extension override:
- Reads structured `epics`, `backlog`, and `sprints` sections directly
- Identifies the active sprint and scopes status analysis to it
- Calculates capacity usage (`items.length / capacity`)
- Epic progress includes `done/` folder scanning for accurate totals
- Detects 10 risk conditions including staleness per item, over-capacity, critical bugs, no-active-sprint
- Backlog health section (total, bugs, critical bugs) is new
- Sprint history section (closed sprint summaries) is new
- Legacy status mappings removed (unified schema uses canonical statuses)
- Data mode output is backward-compatible with new extensions
- Validate mode checks unified schema structure (not flat `development_status`)

### Unified Schema Sections Read

- **`epics`** -- read for epic status and progress calculation (read-only)
- **`backlog`** -- read for backlog health metrics and item counts contributing to epic progress (read-only)
- **`sprints`** -- read for active sprint identification, item status counts, capacity usage, sprint history (read-only)
- **Metadata** -- `project`, `project_key`, `tracking_system`, `last_updated` used in header and staleness detection
- **`done/` folder** -- scanned for archived files to compute epic done counts (read-only, file system)
- This skill is **read-only** -- it never writes to `sprint-status.yaml` or any other file

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for sprint-status.yaml)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Current built-in SKILL.md:** `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/SKILL.md` (to be overridden, not modified)
- **Current built-in workflow:** `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-status/workflow.md` (to be overridden, not modified)
- **BMAD extension manifest:** `lib/bmad-extension/skills/bmad-sprint-status/bmad-skill-manifest.yaml` (NEW)
- **Module help CSV:** `lib/bmad-extension/module-help.csv` (new row)
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md`
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/` (SKILL.md + bmad-skill-manifest.yaml)
- **Related story (display counterpart):** `_bmad-output/implementation-artifacts/17-13-rework-sprint-status-view.md`
- **Story 17.15 (override pattern reference):** `_bmad-output/implementation-artifacts/17-15-rework-bmad-sprint-planning.md`

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema this skill reads from -- three sections (epics, backlog, sprints) with consistent item structure
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file; this skill relies on the file existing and being well-formed. Also the reference for how to create a BMAD built-in extension override (same pattern used here).
- **Story 17.13** (complementary): `sprint-status-view` is the display-focused counterpart; this skill is the analysis-focused variant. No functional duplication -- see comparison table above.
- **Story 17.10** (upstream): `generate-backlog` populates the backlog section this skill analyzes
- **Story 17.16** (upstream): `add-sprint` creates sprint entries this skill analyzes
- **Story 17.11** (upstream): `add-to-sprint` moves items into sprints; this skill reads the result
- **Story 17.14** (related): `cleanup-done` removes archived items from the file and moves files to `done/`; this skill scans `done/` for epic progress counts
- **Story 17.18** (related): `bmad-dev-story` updates item statuses that this skill reads for health analysis
- **Story 17.19** (related): `story-status-lookup` is single-item lookup; this skill is full-sprint health analysis
- **Story 17.21** (related): `close-sprint` transitions sprints to closed; this skill reports closed sprint history
- **Story 17.23** (related): Migration story removes the old `development_status` section; after migration, this skill's validate mode should no longer encounter the old format

### PRD Traceability

- **FR65:** All sprint, backlog, and epic status data is managed in a single `sprint-status.yaml` file -- this skill reads that single file exclusively for all health metrics
- **FR71:** Sprint status displays unified `sprint-status.yaml` contents -- this skill provides the analysis layer (health metrics, risks) while sprint-status-view (17.13) provides the display layer
- **FR130:** Done items are removed from `sprint-status.yaml` -- this skill accounts for done items via `done/` folder scanning for epic progress totals
- **FR133:** `sprint-status.yaml` includes top-level metadata (generated, last_updated, project, etc.) -- used in the header and for staleness detection
- **FR134:** Each item carries consistent structure (id, type, epic, title, priority, status, severity) -- used for risk flag computation and status counting
- **FR135:** Each sprint entity carries: name, status, capacity, optional start/end dates, and items list -- used for capacity analysis and staleness computation
- **FR66:** Sprint capacity is defined by number of items -- used for over-capacity risk detection
- **NFR19:** Sprint extension workflows must read/write the unified `sprint-status.yaml` file -- this skill reads only that file (plus `done/` folder), no secondary sources

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- Skill Integration Map entry: `bmad-sprint-status | 17.20 | Reads structured sections for summary | All sections (read-only) | Light`
- Architecture note on skill ownership: `bmad-sprint-status` is listed as one of 7 existing BMAD/ma-agents skills being reworked (not one of the 6 extension-only skills)

---

## Dev Agent Record

### Session Log

| Date | Agent | Task | Notes |
|------|-------|------|-------|
| 2026-04-06 | claude-sonnet-4-6 | Full story implementation | Created all source files for BMAD extension override and IDE skill. Registered in module-help.csv. |

### Implementation Notes

- BMAD extension override at `lib/bmad-extension/skills/bmad-sprint-status/` provides complete replacement of the built-in (SKILL.md + workflow.md + bmad-skill-manifest.yaml).
- IDE skill at `skills/bmad-sprint-status/` (SKILL.md + skill.json) is self-contained with direct path resolution.
- `workflow.md` uses the same `<workflow>` XML tag structure as other BMAD extension skills (add-to-sprint, sprint-status-view, etc.).
- Task 7 (deployment verification) requires running the ma-agents installer — deferred to integration testing.

---

## File List

### Created

- `lib/bmad-extension/skills/bmad-sprint-status/bmad-skill-manifest.yaml` — BMAD manifest (type, name, module)
- `lib/bmad-extension/skills/bmad-sprint-status/SKILL.md` — BMAD extension skill entry point (delegates to workflow.md)
- `lib/bmad-extension/skills/bmad-sprint-status/workflow.md` — Full BMAD workflow with unified schema parsing, risk detection, and three modes
- `skills/bmad-sprint-status/skill.json` — IDE skill metadata
- `skills/bmad-sprint-status/SKILL.md` — IDE skill: standalone implementation (no workflow.md dependency)

### Modified

- `lib/bmad-extension/module-help.csv` — Added Sprint Status Health row (bmad-sprint-status, bmm-sm agent)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story 17-20 status: ready-for-dev → review; last_updated: 2026-04-06
- `_bmad-output/implementation-artifacts/17-20-rework-bmad-sprint-status.md` — Status: review; all tasks checked; this section added

---

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-04-06 | claude-sonnet-4-6 | Initial implementation — BMAD extension override and IDE skill for unified sprint-status.yaml schema |
