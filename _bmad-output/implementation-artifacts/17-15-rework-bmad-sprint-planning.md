# Story 17.15: Rework bmad-sprint-planning Skill (Heavy Rework — Bootstrap Unified File)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `bmad-sprint-planning` skill to bootstrap or update the unified `sprint-status.yaml` from the epics document,
So that sprint planning always starts from a complete, consistent single file with the three-section schema (`epics`, `backlog`, `sprints`).

## Acceptance Criteria

1. **Given** no `sprint-status.yaml` exists (first-time bootstrap),
   **When** the Scrum Master invokes `bmad-sprint-planning`,
   **Then** it creates `sprint-status.yaml` with:
     - Six metadata fields (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`)
     - `epics` section populated from `epics.md` (all epics with `status` and `retrospective`)
     - `backlog` section populated with all non-done stories and bugs in priority order
     - `sprints` section initialized as an empty map `{}`

2. **Given** `sprint-status.yaml` already exists (refresh mode),
   **When** the Scrum Master invokes `bmad-sprint-planning`,
   **Then** the `epics` section is fully regenerated from `epics.md` (reference data -- always overwritten),
   **And** new stories from `epics.md` that don't exist in `backlog`, any `sprints[].items`, or the `done/` archive are added to the end of `backlog`,
   **And** existing items in `backlog` are preserved unchanged (status, priority),
   **And** existing `sprints` section is preserved unchanged (sprint entities, items, statuses),
   **And** done items are NOT reintroduced (they stay in the `done/` archive),
   **And** the `last_updated` timestamp is updated.

3. **Given** items with `status: done` still exist in `backlog` or any sprint's `items`,
   **When** the planning workflow detects them during refresh,
   **Then** it reports the done items and suggests running `cleanup-done` (Story 17.14) to archive them before proceeding.

4. **Given** bugs exist as standalone `bug-*.md` files in the implementation artifacts directory,
   **When** the skill bootstraps or refreshes,
   **Then** bugs are included in the `backlog` section with `type: bug`, `epic: null`, and `severity` parsed from frontmatter.

5. **Given** `bmad-sprint-planning` is a BMAD built-in skill (originating from `node_modules/bmad-method/`),
   **When** the extension override files are created in `lib/bmad-extension/skills/bmad-sprint-planning/`,
   **Then** the extension version takes precedence over the built-in during BMAD deployment (via the `--custom-content` flag),
   **And** the built-in at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/` is NOT modified.

6. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/bmad-sprint-planning/` and BMAD extension override at `lib/bmad-extension/skills/bmad-sprint-planning/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension override is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the BMAD extension override replaces the upstream built-in during BMAD agent compilation.

7. **Given** the skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it executes,
   **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the BMAD extension override skill files (AC: 5, 6) -- CRITICAL OVERRIDE

`bmad-sprint-planning` is a **BMAD built-in skill** that ships with `bmad-method` at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/`. Per project policy, we NEVER modify built-in skills directly. Instead, we create an **extension override** in `lib/bmad-extension/skills/bmad-sprint-planning/` that takes precedence at deployment time.

The built-in contains four files (`SKILL.md`, `workflow.md`, `checklist.md`, `sprint-status-template.yaml`). The extension override MUST provide replacements for ALL four files (plus a `bmad-skill-manifest.yaml`) so the override is complete and no built-in file leaks through.

- [ ] 1.1 Create `lib/bmad-extension/skills/bmad-sprint-planning/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: bmad-sprint-planning
  module: ma-skills
  ```

- [ ] 1.2 Create `lib/bmad-extension/skills/bmad-sprint-planning/SKILL.md` -- override of the built-in SKILL.md. The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and references `_bmad/bmm/config.yaml` for path resolution. It MUST delegate to `./workflow.md` (same pattern as the upstream built-in):
  ```markdown
  ---
  name: bmad-sprint-planning
  description: 'Bootstrap or update the unified sprint-status.yaml from epics. Use when the user says "run sprint planning" or "generate sprint plan"'
  ---

  Follow the instructions in ./workflow.md.
  ```

- [ ] 1.3 Create `lib/bmad-extension/skills/bmad-sprint-planning/workflow.md` -- complete replacement of the upstream built-in workflow. This is the main implementation file. See Task 4 for content specification.

- [ ] 1.4 Create `lib/bmad-extension/skills/bmad-sprint-planning/checklist.md` -- replacement validation checklist for the unified three-section schema. See Task 5 for content specification.

- [ ] 1.5 Create `lib/bmad-extension/skills/bmad-sprint-planning/sprint-status-template.yaml` -- replacement template demonstrating the unified schema format. See Task 6 for content specification.

- [ ] 1.6 Register the skill in `lib/bmad-extension/module-help.csv` by adding a row:
  ```csv
  ma-skills,4-implementation,Sprint Planning,bmad-sprint-planning,,skill:bmad-sprint-planning,bmad-sprint-planning,false,bmm-sm,,"Bootstrap or update the unified sprint-status.yaml from epics with three sections (epics, backlog, sprints).",_bmad-output/implementation-artifacts,"sprint plan",
  ```
  The `agent` column is `bmm-sm` (Scrum Master) because sprint planning is a Scrum Master responsibility.

### Task 2: Create the IDE skill source files (AC: 6, 7) -- NEW

The IDE skill does NOT yet exist. This task creates it from scratch so all 8+ IDE coding agents can invoke sprint planning directly.

- [ ] 2.1 Create `skills/bmad-sprint-planning/skill.json` with metadata:
  ```json
  {
    "name": "bmad-sprint-planning",
    "version": "1.0.0",
    "description": "Bootstrap or update the unified sprint-status.yaml from epics. Creates the file with three sections (epics, backlog, sprints) on first run; refreshes epics and adds new items on subsequent runs.",
    "category": "workflow",
    "tags": ["sprint-planning", "sprint-management", "epics", "bootstrap"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 2.2 Create `skills/bmad-sprint-planning/SKILL.md` with the complete skill workflow. This is the canonical skill content that the installer deploys to all IDE agents. The workflow logic MUST be functionally identical to the BMAD extension version (Task 1.3), but the IDE version is self-contained (does not reference `./workflow.md`) and does not rely on BMAD config loading -- it resolves paths from the project structure directly.

### Task 3: Read and understand the current built-in skill (AC: 1-4)

Before writing the replacement files, study the built-in to understand what is being overridden.

- [ ] 3.1 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/SKILL.md` (upstream built-in)
- [ ] 3.2 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/workflow.md` (upstream built-in) -- document the 5-step workflow, config loading, epic parsing, status detection, flat `development_status` output format
- [ ] 3.3 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/checklist.md` and `sprint-status-template.yaml` (upstream built-in)
- [ ] 3.4 Identify reusable logic: config loading from `_bmad/bmm/config.yaml`, epic parsing (headers, story extraction, kebab-case conversion), story status detection (file existence), status preservation (never downgrade)
- [ ] 3.5 Identify what MUST change: output format (flat `development_status` to `epics`/`backlog`/`sprints`), retrospective handling (separate keys to `epics` section field), template file format, checklist validation rules

### Task 4: Implement the workflow.md content (AC: 1, 2, 3, 4)

The `workflow.md` file (for `lib/bmad-extension/skills/bmad-sprint-planning/workflow.md`) must implement the following workflow. The IDE version (`skills/bmad-sprint-planning/SKILL.md`) must be functionally identical.

- [ ] 4.1 **Initialization -- Config loading:** Load config from `{project-root}/_bmad/bmm/config.yaml`. Resolve: `project_name`, `implementation_artifacts`, `planning_artifacts`, `communication_language`, `user_name`. Set derived values: `tracking_system` = `file-system`, `project_key` = `NOKEY`, `story_location` = `{implementation_artifacts}`, `status_file` = `{implementation_artifacts}/sprint-status.yaml`, `done_folder` = `{implementation_artifacts}/done/`.

- [ ] 4.2 **Step 1 -- Parse epics:** Load all epic files matching `{planning_artifacts}/*epic*.md` (or sharded `epics/index.md` + parts). For each epic, extract: epic number from headers (`## Epic N: Title`), story entries (`### Story N.M: Title`), epic status from narrative cues (in-progress, on-hold, etc.). For each story, generate kebab-case ID (`N-M-title-slug`). Build complete inventory of all epics and stories.

- [ ] 4.3 **Step 2 -- Scan bugs:** Glob for `{implementation_artifacts}/bug-*.md`. Parse YAML frontmatter for title, severity, status. Create bug items with `type: bug`, `epic: null`, `severity` from frontmatter, `id` from filename slug (e.g., `bug-path-spaces` becomes `BUG-path-spaces`).

- [ ] 4.4 **Step 3 -- Mode detection:** Check if `{status_file}` exists. If NO: enter Bootstrap Mode (Step 5). If YES: enter Refresh Mode (Step 6). In both cases, also run the done-exclusion scan (Step 4).

- [ ] 4.5 **Step 4 -- Done exclusion scan:** Scan `{done_folder}` for archived files. Build a set of done item IDs (`done_item_ids`). In refresh mode, also scan the existing `sprint-status.yaml` for items with `status: done` in `backlog` or any `sprints[].items` -- report these and suggest running `cleanup-done`.

- [ ] 4.6 **Step 5 -- Bootstrap mode (first run):** Build the complete file from scratch:
  - **Metadata:** `generated` = now, `last_updated` = now, `project` = `{project_name}`, `project_key` = `NOKEY`, `tracking_system` = `file-system`, `story_location` = `{story_location}`
  - **`epics` section:** Map keyed by `epic-N`, each with `status` and `retrospective` fields. Status detected from parsed epic narrative. Default: `status: backlog`, `retrospective: optional`.
  - **`backlog` section:** Array of all non-done stories and bugs. Each item: `id`, `type` (story/bug), `epic` (integer or null), `title`, `priority` (sequential 1..N), `status` (detect from story file existence -- file exists = `ready-for-dev`, else `backlog`), `severity` (null for stories, value for bugs). Ordering: critical bugs first, then by epic order.
  - **`sprints` section:** Empty map `{}`.
  - Write the complete file to `{status_file}`.

- [ ] 4.7 **Step 6 -- Refresh mode (subsequent runs):** Read existing `sprint-status.yaml`. Perform an additive merge:
  - **`epics` section:** Fully regenerated from `epics.md` (reference data -- always overwritten). Preserve existing epic `status` and `retrospective` values -- never downgrade (e.g., don't change `in-progress` back to `backlog`). Add new epics with defaults.
  - **`backlog` section:** Build exclusion sets: (a) all item IDs in existing `backlog`, (b) all item IDs in any `sprints[].items`, (c) all item IDs in `done_item_ids`. For newly discovered items (not in any exclusion set), append to end of `backlog` with `priority` = max(existing priorities) + 1. Preserve existing backlog items unchanged (status, priority, all fields).
  - **`sprints` section:** Preserve unchanged -- pass through exactly as read.
  - Update `last_updated` timestamp. Preserve `generated` (never change).
  - Single atomic write (read-modify-write pattern).

- [ ] 4.8 **Step 7 -- Validation:** Run checklist (see Task 5): valid YAML syntax, every epic in `epics.md` appears in `epics` section, every story appears in exactly one location (backlog, sprint, or done/), all status values are legal, backlog `priority` values are sequential 1..N.

- [ ] 4.9 **Step 8 -- Report summary:** Output counts: total epics, total stories, total bugs, new items added (refresh mode), items preserved, items excluded (sprint-assigned), items excluded (done-archived). Suggest next steps: review the file, run `generate-backlog` for priority refresh, run `add-sprint` to create a sprint.

### Task 5: Implement the checklist.md content (AC: 1, 2)

- [ ] 5.1 Create validation checklist for the unified three-section schema:
  - Every epic in `epics.md` has an entry in the `epics` section
  - Every story in `epics.md` appears in exactly one location: `backlog`, a sprint's `items`, or `done/`
  - No item appears in more than one location (single-location invariant)
  - All `status` values are legal per the schema state machines
  - Backlog `priority` values are sequential 1..N matching array positions
  - The `sprints` section has not been modified (in refresh mode)
  - File is valid YAML syntax
  - Metadata fields are present and correctly formatted

### Task 6: Implement the sprint-status-template.yaml content (AC: 1)

- [ ] 6.1 Create template file demonstrating the unified schema with all three sections:
  ```yaml
  generated: "2026-01-15T10:00:00Z"
  last_updated: "2026-01-15T10:00:00Z"
  project: "Example Project"
  project_key: NOKEY
  tracking_system: file-system
  story_location: "_bmad-output/implementation-artifacts"

  epics:
    epic-1:
      status: in-progress
      retrospective: optional
    epic-2:
      status: backlog
      retrospective: optional

  backlog:
    - id: "1-2-account-management"
      type: story
      epic: 1
      title: "Account Management"
      priority: 1
      status: ready-for-dev
      severity: null
    - id: "2-1-personality-system"
      type: story
      epic: 2
      title: "Personality System"
      priority: 2
      status: backlog
      severity: null

  sprints: {}
  ```

### Task 7: Verify no old-format references remain (AC: 1, 2)

- [ ] 7.1 Confirm the extension override `workflow.md` does NOT reference the flat `development_status` format
- [ ] 7.2 Confirm the extension override `workflow.md` does NOT reference retrospective as separate keys (e.g., `epic-N-retrospective`)
- [ ] 7.3 Confirm the IDE `SKILL.md` does NOT reference any `.claude/skills/` or agent-specific paths
- [ ] 7.4 Confirm the template file uses the three-section format, NOT the flat format

### Task 8: Deployment verification (AC: 5, 6, 7)

- [ ] 8.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 8.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `bmad-sprint-planning`).
- [ ] 8.3 Diff the installed IDE copy (e.g., `.claude/skills/bmad-sprint-planning/SKILL.md`) against the source (`skills/bmad-sprint-planning/SKILL.md`) -- content should match after accounting for frontmatter injection by the installer.
- [ ] 8.4 Verify the BMAD extension override exists at `_bmad/extensions/ma-agents-skills/skills/bmad-sprint-planning/SKILL.md` after a BMAD install.
- [ ] 8.5 Verify the extension override directory contains ALL five files: `SKILL.md`, `bmad-skill-manifest.yaml`, `workflow.md`, `checklist.md`, `sprint-status-template.yaml`.
- [ ] 8.6 Verify the extension override takes precedence: the deployed `_bmad/extensions/ma-agents-skills/skills/bmad-sprint-planning/workflow.md` should contain the unified schema workflow (with `epics`/`backlog`/`sprints` sections), NOT the upstream flat `development_status` format.
- [ ] 8.7 Verify `bmad-sprint-planning` appears in the BMAD module help output (registered via `module-help.csv`).

## Dev Notes

### CRITICAL: Extension Override Pattern (Read This First)

**This is the most architecturally complex story in Epic 17** because `bmad-sprint-planning` is NOT an ma-agents extension skill -- it is a **BMAD built-in skill** that ships with the `bmad-method` npm package. The project policy is absolute: **all changes to built-in skills must be done as extension overrides, never as upstream PRs to bmad-method**.

#### How the Override Works

1. **Built-in location:** `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/` -- this is the upstream skill installed by npm. It contains `SKILL.md`, `workflow.md`, `checklist.md`, and `sprint-status-template.yaml`. These produce the OLD flat `development_status` format. **NEVER modify these files.**

2. **Extension override location:** `lib/bmad-extension/skills/bmad-sprint-planning/` -- this is where we place our replacement files. When `lib/bmad.js` runs, it deploys the entire `lib/bmad-extension/` directory to `_bmad/extensions/ma-agents-skills/` via `fs.copy()`. Because the bmad-method installer uses `--custom-content` to load extension modules, and extension skills with the same name as built-in skills take precedence, our override replaces the built-in during BMAD agent compilation.

3. **Override completeness:** The extension override MUST provide replacements for ALL files in the built-in skill directory (`SKILL.md`, `workflow.md`, `checklist.md`, `sprint-status-template.yaml`), plus a `bmad-skill-manifest.yaml`. If any built-in file is not overridden, the old version could leak through and produce inconsistent behavior.

4. **Registration:** The skill must also be registered in `lib/bmad-extension/module-help.csv` so it appears in the BMAD module help menu.

#### Why This Is Different from Other Epic 17 Stories

Most other Epic 17 skills (e.g., `add-sprint`, `add-to-sprint`, `remove-from-sprint`, `generate-backlog`) are extension skills that were CREATED by ma-agents. They only exist in `lib/bmad-extension/skills/` and optionally in `skills/` (IDE pipeline). There is no upstream built-in to override.

`bmad-sprint-planning` is different: it already exists upstream. We must shadow it with an extension override, not replace it.

### Three Skill Origins in ma-agents

| Origin | Source Location | Deployed By | Install Location |
|--------|----------------|-------------|-----------------|
| IDE Skills | `skills/<name>/skill.json` + `SKILL.md` | `lib/installer.js` | `.claude/skills/`, `.cursor/skills/`, etc. (all agents) |
| BMAD Extension Skills | `lib/bmad-extension/skills/<name>/SKILL.md` + `bmad-skill-manifest.yaml` | `lib/bmad.js` | `_bmad/extensions/ma-agents-skills/skills/` |
| BMAD Built-in Skills | `node_modules/bmad-method/src/bmm-skills/` | npm + bmad-method installer | `_bmad/` (compiled by BMAD) |

For `bmad-sprint-planning`, this story creates files in the first TWO rows (IDE skill + extension override), which together override the THIRD row (built-in).

### Two Deployment Pipelines

**Pipeline 1: IDE Skills (all IDE agents)**
- **Source location:** `skills/bmad-sprint-planning/skill.json` + `skills/bmad-sprint-planning/SKILL.md`
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

**Pipeline 2: BMAD Extension Override (BMAD agents only)**
- **Source location:** `lib/bmad-extension/skills/bmad-sprint-planning/` (5 files)
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Override mechanism:** The `--custom-content` flag passed to the bmad-method installer ensures extension skills with the same name as built-in skills take precedence.
- **Registered in:** `lib/bmad-extension/module-help.csv` (maps skill to `bmm-sm` agent)
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install Locations (NEVER edit these directly)
- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer
- `.claude/skills/bmad-sprint-planning/` -- this is an INSTALLED COPY, not a source file

### What This Story Changes vs Current Behavior

**Current behavior (upstream built-in):** The `bmad-sprint-planning` skill creates or updates a `sprint-status.yaml` file with a flat `development_status` map. Each epic, story, and retrospective is a top-level key under `development_status` with a status value. The file has dual metadata (comments + YAML fields). Story status is detected from file existence (story file exists -> `ready-for-dev`) and preserved from existing data (never downgraded).

**New behavior (extension override):** The skill creates or updates a `sprint-status.yaml` file with three structured sections: `epics` (map), `backlog` (array), and `sprints` (map). The flat `development_status` section is entirely replaced. On first run (bootstrap), it creates the complete file. On subsequent runs (refresh), it regenerates the `epics` section, adds new items to `backlog`, and preserves the `sprints` section unchanged.

### Key Differences from Built-in

| Aspect | Built-in (upstream) | Extension Override (this story) |
|--------|---------------------|-------------------------------|
| Output format | Flat `development_status` map | Structured `epics`/`backlog`/`sprints` sections |
| Retrospective | Separate keys (`epic-N-retrospective: optional`) | Field on epic entry (`retrospective: optional`) |
| Sprint awareness | None -- no concept of sprints | Preserves `sprints` section; does not manage it |
| Bug handling | Not supported | Scans `bug-*.md` files, adds to backlog |
| Done exclusion | Not supported | Scans `done/` folder, prevents reintroduction |
| Merge strategy | Overwrites with preserved statuses | Additive: new items appended, existing preserved |
| Metadata | Dual (comments + YAML fields) | YAML fields only |
| Cleanup integration | Not supported | Detects done items, suggests `cleanup-done` |

### Unified Schema Sections Touched

- **`epics`** -- full regeneration from `epics.md` (this section is reference data, always overwritten; but existing statuses are preserved via never-downgrade rule)
- **`backlog`** -- bootstrap: full creation; refresh: read (preserve existing items) + write (append new items from `epics.md` and `bug-*.md`)
- **`sprints`** -- bootstrap: initialize as `{}`; refresh: read (identify sprint-assigned items for exclusion) + preserve unchanged
- **Top-level metadata** -- `generated` (bootstrap only), `last_updated` (always), `project`, `project_key`, `tracking_system`, `story_location`

### Reusable Logic from Built-in

The following logic from the upstream `workflow.md` can be adapted:
1. **Config loading** from `_bmad/bmm/config.yaml` (Step: Initialization)
2. **Epic parsing**: header patterns (`## Epic N: Title`), story patterns (`### Story N.M: Title`), kebab-case conversion
3. **Story status detection**: story file existence -> `ready-for-dev`; never downgrade existing status
4. **Epic discovery**: whole file vs sharded, fuzzy matching on filenames

### Gotchas

1. The upstream built-in `workflow.md` is ~265 lines with a 5-step workflow. The replacement will be longer due to the more complex three-section output format, bug handling, done exclusion, and merge logic.
2. The upstream `SKILL.md` simply delegates to `./workflow.md`. The extension override SKILL.md must follow the same pattern so the BMAD skill loader resolves the workflow correctly.
3. The IDE skill version (`skills/bmad-sprint-planning/SKILL.md`) must be self-contained (no `./workflow.md` reference) because IDE skills are single-file.
4. The `epics` section is always fully regenerated (reference data). But the `backlog` section must carefully merge: preserve existing items, add new items, never reintroduce done items.
5. The `sprints` section is completely untouched by this skill -- it just preserves whatever is already there. Sprint creation/modification is managed by `add-sprint` and `modify-sprint`.
6. Config loading from `_bmad/bmm/config.yaml` should be preserved in the BMAD extension version for path resolution. The IDE version resolves paths from project structure.
7. The extension override directory MUST contain all five files. Missing any file means the upstream version could leak through and produce the old flat format alongside the new structured format.

### Reference Files

- **Upstream built-in:** `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-sprint-planning/` (4 files -- NEVER modify)
- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for `sprint-status.yaml`)
- **Epics source:** `_bmad-output/planning-artifacts/epics.md`
- **Bug files:** `_bmad-output/implementation-artifacts/bug-*.md`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md`
- **BMAD extension reference:** `lib/bmad-extension/skills/add-to-sprint/` (`SKILL.md` + `bmad-skill-manifest.yaml`)
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **BMAD deployer:** `lib/bmad.js` (see `--custom-content` flag usage and `fs.copy` of extension directory)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema that this skill bootstraps
- **Story 17.10** (downstream): `generate-backlog` refreshes the `backlog` section; `bmad-sprint-planning` creates the initial version. Both write to `backlog`, but sprint-planning is the bootstrapper and generate-backlog is the ongoing refresher.
- **Story 17.14** (integration): `cleanup-done` logic may be invoked during the planning workflow to archive done items before adding new ones
- **Story 17.16** (downstream): `add-sprint` creates sprints in the `sprints` section that this skill preserves
- **Story 17.11** (downstream): `add-to-sprint` moves items from `backlog` to sprints -- depends on the backlog this skill creates
- **Story 17.23** (future): Migration story that deprecates the old flat `development_status` format
- **Execution order**: This is the FIRST skill to run after the schema is defined (17.9 -> 17.15 -> 17.10 -> 17.16 -> ...)

### PRD Traceability

- **FR64:** Bugs exist in the backlog as standalone items -- never assigned to an epic (`type: bug`, `epic: null`)
- **FR67:** Story/bug prioritization supports multiple criteria beyond epic precedence
- **FR133:** `sprint-status.yaml` includes top-level metadata (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`)
- **FR134:** Each item carries consistent structure (`id`, `type`, `epic`, `title`, `priority`, `status`, `severity`)

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` (Unified Sprint-Status File Architecture)
- Architecture Decision P2-5 (Extension Module Structure) -- governs how `lib/bmad-extension/skills/` overrides built-in skills
