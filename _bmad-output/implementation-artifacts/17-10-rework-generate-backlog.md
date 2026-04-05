# Story 17.10: Rework generate-backlog Skill (Heavy Rework)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `generate-backlog` skill to populate the `backlog` section of the unified `sprint-status.yaml`,
So that all unassigned stories and bugs are maintained in a single file rather than a separate `backlog.yaml`.

## Acceptance Criteria

1. **Given** the `generate-backlog` skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** it parses the epics document and bug files,
   **Then** it writes all unassigned stories and bugs to the `backlog` section of `sprint-status.yaml` in priority order,
   **And** it updates the `epics` section with current epic metadata (status, retrospective),
   **And** it does NOT touch the `sprints` section -- sprint-assigned items are preserved.

2. **Given** items already exist in the `sprints` section of `sprint-status.yaml`,
   **When** the backlog is regenerated,
   **Then** items currently assigned to any sprint are NOT duplicated in the `backlog` section (single-location invariant),
   **And** new stories from `epics.md` that don't exist anywhere in `sprint-status.yaml` are added to `backlog`.

3. **Given** a story exists in `backlog` but has been removed from `epics.md`,
   **When** the backlog is regenerated,
   **Then** the orphaned item is flagged with a warning but NOT automatically removed (human review required).

4. **Given** bugs exist as standalone story files (FR64),
   **When** the backlog is regenerated,
   **Then** bugs are included in the `backlog` section with `type: bug` and `epic: null`,
   **And** bug-specific fields (`severity`) are preserved.

5. **Given** items have been archived in the `done/` folder,
   **When** the backlog is regenerated,
   **Then** archived items are NOT reintroduced into the `backlog` section.

6. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill + BMAD extension),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 1, 6)

- [ ] 1.1 Create `skills/generate-backlog/skill.json` with metadata:
  ```json
  {
    "name": "generate-backlog",
    "version": "1.0.0",
    "description": "Generate or refresh the backlog section of sprint-status.yaml from epics and bug stories, preserving existing priorities and sprint assignments",
    "category": "workflow",
    "tags": ["backlog", "sprint-management", "epics", "bugs"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/generate-backlog/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Create the BMAD extension skill source files (AC: 1, 6)

- [ ] 2.1 Create `lib/bmad-extension/skills/generate-backlog/SKILL.md` -- this is a SEPARATE file from the IDE skill SKILL.md. The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may have BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Create `lib/bmad-extension/skills/generate-backlog/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: generate-backlog
  module: ma-skills
  ```

- [ ] 2.3 Register the skill in `lib/bmad-extension/module-help.csv` by adding a row:
  ```csv
  ma-skills,4-implementation,Generate Backlog,generate-backlog,,skill:generate-backlog,generate-backlog,false,bmm-sm,,"Generate or refresh the backlog section of sprint-status.yaml from epics and bug stories.",_bmad-output/implementation-artifacts,"backlog",
  ```
  The `agent` column is `bmm-sm` (Scrum Master) because backlog generation is a Scrum Master responsibility.

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow:

- [ ] 3.1 **Step 1 -- Load existing state:** Read `sprint-status.yaml` (if it exists). Parse the `sprints` section to build a set of all item IDs already assigned to sprints (`sprint_item_ids`). Parse the `backlog` section for existing items (to preserve priorities during merge). Scan the `done/` folder to build a set of archived item IDs (`done_item_ids`). If `sprint-status.yaml` does not exist, report an error and suggest running `bmad-sprint-planning` first.

- [ ] 3.2 **Step 2 -- Extract stories from epics.md:** Parse `epics.md` to extract all epics and their stories. For each story, generate the kebab-case item ID (`N-M-title-slug`). Exclude items in `sprint_item_ids` (already in a sprint). Exclude items in `done_item_ids` (archived).

- [ ] 3.3 **Step 3 -- Extract bugs:** Glob for `bug-*.md` files in the implementation artifacts directory. Parse YAML frontmatter for title, severity, status. Create bug items with `type: bug`, `epic: null`, `severity` from frontmatter. Exclude bugs in `sprint_item_ids` or `done_item_ids`.

- [ ] 3.4 **Step 4 -- Merge with existing backlog:** For items already in the existing `backlog` section, preserve their `priority` and `status` values. For items in existing backlog whose IDs do NOT appear in `epics.md` or bug files, flag as orphaned with a WARNING but keep them in the backlog (do not auto-remove). For newly discovered items (not in existing backlog, not in sprints, not in done), add with `status: backlog`.

- [ ] 3.5 **Step 5 -- Priority ordering:** Sort all backlog items: critical bugs first, then by explicit priority (preserved from existing backlog), then by epic order. Re-number priorities sequentially 1..N to match array position.

- [ ] 3.6 **Step 6 -- Build epics section:** Rebuild the `epics` section from parsed epics in `epics.md`. Preserve existing `status` and `retrospective` values for epics already in the file (never downgrade). Add new epics with `status: backlog`, `retrospective: optional`.

- [ ] 3.7 **Step 7 -- Write sprint-status.yaml:** Assemble the complete file: preserve top-level metadata (`generated`, `project`, `project_key`, `tracking_system`, `story_location`), update `last_updated` timestamp, write refreshed `epics` section, write refreshed `backlog` section, preserve `sprints` section UNCHANGED. Single atomic write (read-modify-write pattern).

- [ ] 3.8 **Step 8 -- Report summary:** Output summary with counts: total stories, total bugs, new items added, orphaned items flagged, items excluded (sprint-assigned), items excluded (archived in done/).

### Task 4: Verify the old `backlog.yaml` standalone write is NOT present (AC: 1)

- [ ] 4.1 Confirm neither SKILL.md file contains any instruction to write a standalone `backlog.yaml` file.
- [ ] 4.2 Confirm the only write target is `sprint-status.yaml`.
- [ ] 4.3 If the previous (rolled-back) implementation left any references to `backlog.yaml` as an output, remove them.

### Task 5: Deployment verification (AC: 6)

- [ ] 5.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 5.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `generate-backlog`).
- [ ] 5.3 Diff the installed IDE copy (e.g., `.claude/skills/generate-backlog/SKILL.md`) against the source (`skills/generate-backlog/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer.
- [ ] 5.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/generate-backlog/SKILL.md` after a BMAD install.
- [ ] 5.5 Verify `generate-backlog` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files for BOTH.

**Why this matters:** The previous version of this story was fundamentally wrong -- it directed edits to `.claude/skills/generate-backlog/SKILL.md`, which is an INSTALLED COPY (read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live.

#### Pipeline 1: IDE Skills (all IDE agents)
- **Source location:** `skills/generate-backlog/skill.json` + `skills/generate-backlog/SKILL.md`
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only)
- **Source location:** `lib/bmad-extension/skills/generate-backlog/SKILL.md` + `bmad-skill-manifest.yaml`
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` (maps skill to `bmm-sm` agent)
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install locations (NEVER edit these directly)
- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer

### What This Story Changes vs Current Behavior

**Current state:** The `generate-backlog` skill does NOT currently exist in either pipeline. The previous (rolled-back) implementation only modified an installed copy at `.claude/skills/generate-backlog/SKILL.md`, which would have been overwritten on the next install. This story creates the skill from scratch in both source locations.

**New behavior:** The skill reads `epics.md` and `bug-*.md` files, then writes the `backlog` and `epics` sections of `sprint-status.yaml`. The `sprints` section is preserved unchanged. Items in sprints or in the `done/` archive are excluded. Orphaned items are flagged but kept.

### Key Design Decisions

- **Output target:** `sprint-status.yaml` `backlog` + `epics` sections (NOT a standalone `backlog.yaml`)
- **Sprint-assigned item exclusion:** Must read `sprints` section to build exclusion set (single-location invariant from Story 17.9)
- **Done exclusion:** Scans `done/` folder to prevent reintroducing archived items
- **Orphan detection:** Items in existing backlog that no longer appear in source files get a warning but are NOT removed
- **Atomic write:** Single read-modify-write to `sprint-status.yaml`; `sprints` section passed through unchanged
- **Priority sort:** Critical bugs > explicit priority (preserved) > epic order; renumbered 1..N
- **No `sprint` field on backlog items:** Sprint assignment is structural in the unified model (items in a sprint's `items` array are "assigned")

### Unified Schema Sections Touched

- **`backlog`** -- primary write target (full replacement of items not in sprints or done)
- **`epics`** -- updated with refreshed epic metadata from epics.md
- **`sprints`** -- read-only (used to build the exclusion set; preserved unchanged on write)

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for sprint-status.yaml)
- **Epics source:** `_bmad-output/planning-artifacts/epics.md`
- **Bug files:** `_bmad-output/implementation-artifacts/bug-*.md`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md`
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/` (SKILL.md + bmad-skill-manifest.yaml)
- **Module help CSV:** `lib/bmad-extension/module-help.csv`

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema this skill writes to
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file; `generate-backlog` refreshes the backlog section on subsequent runs
- **Story 17.11** (downstream): `add-to-sprint` moves items from the backlog section this skill populates into sprints
- **Story 17.24** (downstream): `prioritize-backlog` reorders items in the backlog section this skill populates
- **Story 17.23** (future): Migration story that deprecates the old standalone `backlog.yaml` file

### PRD Traceability

- **FR64:** Bugs exist in the backlog as standalone items -- never assigned to an epic
- **FR133:** `sprint-status.yaml` includes top-level metadata (generated, last_updated, project, etc.)
- **FR134:** Each item carries consistent structure (id, type, epic, title, priority, status, severity)
- **FR67:** Prioritization supports multiple criteria beyond epic precedence

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md`
