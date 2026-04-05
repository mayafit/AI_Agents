# Story 17.14: Rework cleanup-done Skill (Heavy Rework — Create From Scratch)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `cleanup-done` skill to scan the unified `sprint-status.yaml` for done and cancelled items, remove them from the file, and archive their story/bug files to the `done/` subfolder,
So that the active sprint view stays clean, done work is preserved in the archive, and the skill is available across all IDE agents and BMAD workflows.

## Acceptance Criteria

1. **Given** items with `status: done` exist in the `sprints` section of `sprint-status.yaml`,
   **When** the `cleanup-done` skill is invoked,
   **Then** each done item is REMOVED from its sprint's `items` array (FR130),
   **And** the corresponding story/bug `.md` file is moved to `{story_location}/done/` (FR131),
   **And** if the `done/` subfolder does not exist, it is created.

2. **Given** items with `status: cancelled` exist in the `sprints` section of `sprint-status.yaml`,
   **When** the `cleanup-done` skill is invoked,
   **Then** each cancelled item is REMOVED from its sprint's `items` array,
   **And** the corresponding story/bug `.md` file is moved to `{story_location}/done/` (same archival as done items per schema section 6.6).

3. **Given** items with `status: done` or `status: cancelled` exist in the `backlog` section (edge case -- items marked done/cancelled but never sprint-assigned),
   **When** the `cleanup-done` skill is invoked,
   **Then** those items are also REMOVED from the `backlog` array and their files archived to `done/`,
   **And** remaining backlog items have their `priority` values renumbered sequentially (1..N) to match new array positions (schema section 3.3).

4. **Given** a story file exists at `{story_location}/{id}.md` (e.g., `17-10-rework-generate-backlog.md`),
   **When** the story reaches `done` or `cancelled` status and cleanup runs,
   **Then** the file is moved to `{story_location}/done/{id}.md`.

5. **Given** a bug file exists at `{story_location}/{id}.md` (e.g., `BUG-path-spaces.md` or `bug-path-spaces.md`),
   **When** the bug reaches `done` or `cancelled` status and cleanup runs,
   **Then** the file is moved to `{story_location}/done/{id}.md` (handles naming variants case-insensitively).

6. **Given** all items in a sprint reach `done`/`cancelled` status and are cleaned up,
   **When** the sprint has zero remaining items after cleanup,
   **Then** the sprint's `items` array is empty (`items: []`) but the sprint definition is preserved (historical record),
   **And** if the sprint has `status: active`, the skill suggests closing the sprint: "Sprint {name} has no remaining items. Consider running `/close-sprint` (Story 17.21) to close it."

7. **Given** a closed sprint (`status: closed`) contains items with `status: done` or `status: cancelled`,
   **When** the `cleanup-done` skill is invoked,
   **Then** those done/cancelled items are REMOVED from the closed sprint's `items` array (per schema section 6.7 -- closed sprint immutability exception for done/cancelled item archival),
   **And** their story/bug files are archived to `done/`.

8. **Given** the source `.md` file for a done/cancelled item does not exist at the expected path,
   **When** cleanup attempts to archive it,
   **Then** the skill logs a warning ("File not found: {path} -- skipping file move") and proceeds with removing the item from `sprint-status.yaml` (the YAML cleanup is not blocked by a missing file).

9. **Given** the destination file already exists in `{story_location}/done/` (e.g., a previous partial cleanup),
   **When** cleanup attempts to move a file there,
   **Then** the skill logs a warning ("File already exists at destination: {path} -- skipping file move") and does NOT overwrite the existing file, but still removes the item from `sprint-status.yaml`.

10. **Given** no items with `status: done` or `status: cancelled` exist anywhere in `sprint-status.yaml`,
    **When** the `cleanup-done` skill is invoked,
    **Then** the skill reports: "No done or cancelled items found. Nothing to clean up." and exits without writing the file.

11. **Given** `sprint-status.yaml` does not exist,
    **When** the `cleanup-done` skill is invoked,
    **Then** the skill reports an error: "No sprint-status.yaml found. Run sprint planning first to initialize the file."

12. **Given** the epics section contains epics where ALL stories (across backlog and all sprints) have been archived,
    **When** cleanup completes,
    **Then** the skill updates the epic's status to `done` in the `epics` section (if it was `in-progress`),
    **And** reports which epic(s) were marked as done.

13. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/cleanup-done/` and BMAD extension at `lib/bmad-extension/skills/cleanup-done/`),
    **When** the ma-agents installer is run,
    **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
    **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
    **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

14. **Given** the skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
    **When** it executes,
    **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 13, 14) -- NEW

The IDE skill does NOT exist. This task creates it from scratch.

- [ ] 1.1 Create `skills/cleanup-done/skill.json` with metadata:
  ```json
  {
    "name": "cleanup-done",
    "version": "1.0.0",
    "description": "Archive done and cancelled items — remove from sprint-status.yaml and move story/bug files to done/ subfolder",
    "category": "workflow",
    "tags": ["sprint-management", "archival", "cleanup", "done"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/cleanup-done/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Create the BMAD extension skill source files (AC: 13, 14) -- NEW

The BMAD extension skill does NOT exist. This task creates it from scratch.

- [ ] 2.1 Create `lib/bmad-extension/skills/cleanup-done/SKILL.md` -- this is a SEPARATE file from the IDE skill SKILL.md. The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may include BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Create `lib/bmad-extension/skills/cleanup-done/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: cleanup-done
  module: ma-skills
  ```

- [ ] 2.3 Register the skill in `lib/bmad-extension/module-help.csv` by adding a row:
  ```csv
  ma-skills,4-implementation,Cleanup Done,cleanup-done,,skill:cleanup-done,cleanup-done,false,bmm-sm,,"Archive done and cancelled items — remove from sprint-status.yaml and move files to done/ subfolder.",_bmad-output/implementation-artifacts,"archival",
  ```
  The `agent` column is `bmm-sm` (Scrum Master) because archival cleanup is a Scrum Master responsibility.

### Task 3: Implement the skill workflow content (AC: 1-12)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 -- Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `{story_location}/sprint-status.yaml` (resolve `story_location` from config or default to `_bmad-output/implementation-artifacts`).
  - If the file does not exist, report error and suggest running sprint planning first (AC 11). Exit.
  - Parse the full file: `epics`, `backlog`, and `sprints` sections plus metadata.

- [ ] 3.2 **Step 1 -- Scan all sections for archivable items:**
  - Scan the `backlog` array: collect all items where `status` is `done` or `cancelled`.
  - Scan ALL sprints in the `sprints` map (including `status: closed` sprints per schema section 6.7): for each sprint, collect items where `status` is `done` or `cancelled`.
  - Build a combined list of archivable items, each annotated with its source location (backlog, or sprint ID).
  - If no archivable items found, report "No done or cancelled items found. Nothing to clean up." (AC 10). Exit without writing.

- [ ] 3.3 **Step 2 -- Display archivable items and confirm:**
  - Display a summary table of items to be archived:
    | # | ID | Title | Type | Status | Source |
    Where Source = "backlog" or "sprint-N (name)".
  - Show total count: "Found {N} items to archive ({done_count} done, {cancelled_count} cancelled)."
  - Prompt for confirmation: [c] Confirm and archive all, [s] Select specific items, [x] Cancel.
  - If cancelled, exit without changes.
  - If select, allow the user to choose specific item numbers (comma-separated).

- [ ] 3.4 **Step 3 -- Archive story/bug files:**
  - Ensure `{story_location}/done/` directory exists (create if not).
  - For each confirmed archivable item:
    - Resolve the file path: `{story_location}/{id}.md`.
    - If the source file does not exist, log warning and skip file move (AC 8). Continue.
    - If the destination file already exists in `done/`, log warning and skip file move (AC 9). Continue.
    - Move the file using rename/move (NOT copy+delete) to preserve git history: `{story_location}/{id}.md` -> `{story_location}/done/{id}.md`.
    - Handle bug naming variants: try `{id}.md` first, then `bug-{slug}.md`, then `BUG-{slug}.md` if the ID follows bug naming convention (AC 5).
  - Record which files were successfully moved and which were skipped.

- [ ] 3.5 **Step 4 -- Remove archived items from sprint-status.yaml:**
  - For each confirmed archivable item:
    - If the item was in a sprint's `items` array, remove it from that sprint's `items` array.
    - If the item was in the `backlog` array, remove it from the `backlog` array.
  - After removing items from the `backlog` array, renumber remaining backlog items' `priority` values sequentially (1..N) to match new array positions (AC 3, schema section 3.3).
  - Sprint definitions are preserved even if all items are removed -- empty `items: []` is valid (AC 6).

- [ ] 3.6 **Step 5 -- Update epic statuses:**
  - For each epic in the `epics` section:
    - Determine if ALL stories belonging to this epic (across backlog, all sprints, and now-archived items) have been archived (no remaining items with this epic number in backlog or any sprint).
    - If ALL stories for the epic are archived AND the epic's current status is `in-progress`, update the epic's status to `done` (AC 12).
    - Do NOT downgrade an epic that is already `done` or change an `on-hold`/`cancelled` epic.
  - Record which epic(s) were marked as done for the summary.

- [ ] 3.7 **Step 6 -- Detect empty active sprints:**
  - After removal, check each sprint that had items removed.
  - If any sprint now has an empty `items` array AND has `status: active`, note it for the summary suggestion (AC 6).

- [ ] 3.8 **Step 7 -- Atomic write:**
  - Update `last_updated` to current ISO-8601 timestamp.
  - Write the complete `sprint-status.yaml` in a single atomic write (all item removals, backlog renumbering, epic status updates, and metadata update in one operation).
  - Preserve all sections that were not modified (pass-through).

- [ ] 3.9 **Step 8 -- Summary output:**
  - Display archival summary:
    - Items archived: list each item (ID, title, source, status).
    - Files moved: list each file move (`{from}` -> `{to}`).
    - Files skipped: list warnings (not found, already exists).
    - Backlog items renumbered: count if any were removed from backlog.
    - Epics marked done: list any epic(s) transitioned to done.
  - If any active sprint is now empty, display suggestion: "Sprint {name} has no remaining items. Consider running `/close-sprint` to close it."
  - Suggest next steps: `/sprint-status-view` to review, `/close-sprint` if sprint is empty, `/generate-backlog` to refresh backlog.

### Task 4: Verify no old multi-file patterns are present (AC: 1-3)

- [ ] 4.1 Confirm neither SKILL.md file contains any reference to writing separate `sprint-plan-*.yaml` files.
- [ ] 4.2 Confirm neither SKILL.md file contains any reference to reading/writing a standalone `backlog.yaml` file.
- [ ] 4.3 Confirm neither SKILL.md file contains any instruction to read the `development_status` map (old schema).
- [ ] 4.4 Confirm neither SKILL.md file references `bug-*.md` globbing for item discovery (items come from `sprint-status.yaml` sections now -- file globbing is only used for resolving the `.md` file path for archival moves).
- [ ] 4.5 Confirm the only data file read/written is `sprint-status.yaml`.

### Task 5: Deployment verification (AC: 13)

- [ ] 5.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 5.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `cleanup-done`).
- [ ] 5.3 Diff the installed IDE copy (e.g., `.claude/skills/cleanup-done/SKILL.md`) against the source (`skills/cleanup-done/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer.
- [ ] 5.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/cleanup-done/SKILL.md` after a BMAD install.
- [ ] 5.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/cleanup-done/SKILL.md`.
- [ ] 5.6 Verify `cleanup-done` appears in the BMAD module help output (check `module-help.csv` row is present).

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files in BOTH from scratch.

**Why this matters:** The previous version of this story was fundamentally wrong -- it directed edits to `.claude/skills/cleanup-done/SKILL.md`, which is an INSTALLED COPY (a read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live. Furthermore, the old story assumed the skill already existed -- it does not. After the Epic 17 rollback, `cleanup-done` was fully removed from both pipelines and must be created from scratch.

#### Pipeline 1: IDE Skills (all IDE agents) -- NEW, CREATE

- **Source location:** `skills/cleanup-done/skill.json` + `skills/cleanup-done/SKILL.md`
- **Status:** Does NOT exist. Task 1 creates these files from scratch.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) -- NEW, CREATE

- **Source location:** `lib/bmad-extension/skills/cleanup-done/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** Does NOT exist. Task 2 creates these files from scratch.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` -- must add a NEW row for `cleanup-done` (Task 2.3).
- **No workflow file needed.** Unlike `add-to-sprint` or `remove-from-sprint`, `cleanup-done` is a straightforward archival operation that does not require a separate BMAD workflow wrapper. The SKILL.md is sufficient.
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer

### What This Story Creates (vs Old Story's Assumptions)

**Old story assumed:** The `cleanup-done` skill already existed and needed modification from a three-source scan (sprint-status.yaml `development_status` + backlog.yaml + bug-*.md) to the unified schema.

**Reality after rollback:** The skill does NOT exist in either pipeline. The Phase 1 implementation was fully reverted. This story creates all source files from scratch:
1. `skills/cleanup-done/skill.json` -- NEW
2. `skills/cleanup-done/SKILL.md` -- NEW
3. `lib/bmad-extension/skills/cleanup-done/SKILL.md` -- NEW
4. `lib/bmad-extension/skills/cleanup-done/bmad-skill-manifest.yaml` -- NEW
5. New row in `lib/bmad-extension/module-help.csv` -- NEW

There is nothing to "rework" -- everything is greenfield.

### Key Design Decisions

- **Done AND cancelled items:** Both `done` and `cancelled` items are archivable. The schema (section 6.6) defines `cancelled` as a terminal state archived similarly to `done`. The old story only mentioned `done` -- this is a gap that this rewrite corrects.
- **Closed sprint exception:** Schema section 6.7 explicitly allows `cleanup-done` to remove done/cancelled items from closed sprints. This is an exception to the closed sprint immutability rule. The skill MUST scan closed sprints, not skip them.
- **No auto-close:** The skill does NOT auto-close sprints when they become empty. It only suggests closure and defers to `close-sprint` (Story 17.21). This is a deliberate change from the old (pre-Epic-17) behavior.
- **Epic status derivation:** When all stories for an epic have been archived, the epic should be marked `done`. This requires cross-referencing the `epics` section with all item locations.
- **File move, not copy+delete:** Use rename/move to preserve git history. The `done/` folder is a subdirectory, so renames work within the same filesystem.
- **Graceful file handling:** Missing source files and pre-existing destination files are warnings, not errors. The YAML cleanup always proceeds.
- **Atomic write:** All changes to `sprint-status.yaml` (item removals from sprints, item removals from backlog, backlog renumbering, epic status updates, metadata update) happen in a single write operation.
- **Confirmation prompt:** The skill shows what will be archived and asks for confirmation before making changes. This prevents accidental archival.

### Unified Schema Sections Touched

- **`sprints`** -- read (find done/cancelled items in all sprints including closed) + write (remove archived items from `items` arrays)
- **`backlog`** -- read (find done/cancelled items) + write (remove archived items, renumber priorities)
- **`epics`** -- read (check if all stories for an epic are archived) + write (update epic status to `done` when applicable)
- **Metadata** -- `last_updated` is updated on every write
- **File system** -- move story/bug `.md` files from `{story_location}/` to `{story_location}/done/`

### Gotchas and Edge Cases

1. **Cancelled items were missing from the old story.** The old AC only mentioned `status: done`. The schema (sections 6.6, 6.7) clearly states cancelled items are archived the same way. This rewrite includes both.
2. **Closed sprints must be scanned.** Schema section 6.7 explicitly names `cleanup-done` as the exception to closed sprint immutability. Do NOT skip closed sprints.
3. **Bug file naming variants.** Bug IDs in `sprint-status.yaml` follow `BUG-slug` convention, but the actual file might be `BUG-slug.md`, `bug-slug.md`, or `BUG-Slug.md`. The file resolution step must handle case variations.
4. **Priority renumbering after backlog removal.** If done/cancelled items existed in the backlog (edge case), remaining items need `priority` renumbered 1..N per schema section 3.3.
5. **Epic status derivation complexity.** To determine if an epic is fully done, the skill must check: (a) no items for this epic remain in the backlog, (b) no items for this epic remain in any sprint's items array, (c) at least one item for this epic was archived (either now or previously in `done/`). An epic with zero items anywhere (never had stories) should NOT be auto-marked done.
6. **The `done/` directory may not exist on first run.** Create it if needed.
7. **Items without corresponding files.** Some items in `sprint-status.yaml` may not have a matching `.md` file (e.g., if the file was manually deleted). The YAML cleanup must proceed regardless.

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema, including section 6.3 (Done-Removal Rule), 6.7 (Closed Sprint Immutability exception for cleanup-done)
- **Story 17.15** (related): `bmad-sprint-planning` may invoke cleanup as part of its planning workflow
- **Story 17.21** (downstream): `close-sprint` handles full sprint lifecycle closure; shares the done-item archival logic with `cleanup-done` (Story 17.21 combines 17.14 archival + 17.12 return-to-backlog for incomplete items)
- **Story 17.12** (related): `remove-from-sprint` rejects done/cancelled items and directs users to `cleanup-done` instead
- **Story 17.10** (related): `generate-backlog` excludes items archived in `done/` to prevent reintroduction
- **Story 17.13** (related): `sprint-status-view` may suggest running cleanup when done items are detected

### PRD Traceability

- **FR130:** When a story or bug reaches "done" status, it is removed from `sprint-status.yaml` entirely -- done items do not clutter the active status view
- **FR131:** When a story or bug reaches "done" status, its story `.md` file is moved from the active stories directory to a `done/` subfolder -- preserving the artifact while keeping the active directory clean
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow)

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified sprint-status.yaml model
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` -- canonical schema, especially sections 6.3 (Done-Removal Rule), 6.7 (Closed Sprint Immutability exception), 6.6 (Valid Item Status Transitions including cancelled archival)

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/SKILL.md` + `bmad-skill-manifest.yaml`
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **Epics source:** `_bmad-output/planning-artifacts/epics.md` (Story 17.14 definition)
- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR130, FR131)
