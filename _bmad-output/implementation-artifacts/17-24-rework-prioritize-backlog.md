# Story 17.24: Rework prioritize-backlog Skill (Light Rework -- Create from Scratch)

Status: ready-for-dev

## Story

As a **Scrum Master**,
I want the `prioritize-backlog` skill to reorder items in the `backlog` section of the unified `sprint-status.yaml` using multiple prioritization criteria (severity, business value, dependencies, type, age),
So that backlog reprioritization works against the single source of truth, is available across all IDE agents and BMAD workflows, and supports interactive, automated, and suggestion-only modes.

## Acceptance Criteria

1. **Given** the `prioritize-backlog` skill is invoked from ANY IDE agent (Claude Code, Cursor, Cline, Roo Code, Gemini, Copilot, Kilocode, etc.) OR from a BMAD workflow,
   **When** the unified `sprint-status.yaml` exists,
   **Then** it reads items from the `backlog` section only (items assigned to a sprint are NOT shown and NOT reprioritized),
   **And** the display shows items in current priority order with columns: Priority, ID, Title, Type, Epic, Severity, Status.

2. **Given** the `backlog` section contains items,
   **When** the Scrum Master selects **Full** mode (interactive reprioritization),
   **Then** the skill presents the current backlog order alongside a suggested new order based on multi-criteria analysis,
   **And** the Scrum Master can accept, modify, or reject the suggested order,
   **And** upon acceptance the skill renumbers `priority` values 1..N to match the new array positions,
   **And** writes the reordered `backlog` section back to `sprint-status.yaml` in a single atomic write,
   **And** updates the `last_updated` metadata timestamp,
   **And** all other sections (`epics`, `sprints`) are preserved unchanged.

3. **Given** the `backlog` section contains items,
   **When** the Scrum Master selects **Quick** mode (automated reprioritization),
   **Then** the skill applies the default prioritization rules automatically without interactive approval,
   **And** renumbers `priority` values 1..N,
   **And** writes the reordered backlog in a single atomic write,
   **And** displays a summary of what changed (items that moved up, down, or stayed in place).

4. **Given** the `backlog` section contains items,
   **When** the Scrum Master selects **Auto-suggest** mode,
   **Then** the skill generates a suggested new ordering with per-item rationale,
   **And** displays the suggestions without modifying `sprint-status.yaml`,
   **And** no file write occurs.

5. **Given** the prioritization criteria are applied,
   **When** the skill scores and ranks backlog items,
   **Then** the following criteria are evaluated in weighted order (FR67):
   - **Severity** -- critical and high bugs float to the top
   - **Business value** -- high-value items rank higher
   - **Dependencies** -- items blocking other items receive a priority boost
   - **Type weighting** -- bugs receive a slight priority boost over stories (at equal value)
   - **Age** -- older items (lower epic number or earlier creation) receive a slight boost to prevent starvation

6. **Given** `sprint-status.yaml` does not exist,
   **When** the skill is invoked,
   **Then** it reports: "No sprint-status.yaml found. Run sprint planning first to initialize the file.",
   **And** exits without creating any file.

7. **Given** the `backlog` section is empty (all items assigned to sprints or no items exist),
   **When** the skill is invoked,
   **Then** it reports: "Backlog is empty. Nothing to prioritize.",
   **And** exits without modifying the file.

8. **Given** the old `backlog.yaml` file exists alongside `sprint-status.yaml`,
   **When** the skill is invoked,
   **Then** it operates on `sprint-status.yaml` only (the old file is ignored; see Story 17.23 for migration),
   **And** logs a note: "Legacy backlog.yaml detected. Run migration to consolidate."

9. **Given** the skill source files exist in BOTH deployment pipelines (IDE skill at `skills/prioritize-backlog/` and BMAD extension at `lib/bmad-extension/skills/prioritize-backlog/`),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the BMAD extension skill is deployed via `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`,
   **And** the installed copies are byte-identical to their source (minus frontmatter injection by the installer for the IDE path).

10. **Given** the skill is invoked from ANY IDE agent OR from a BMAD workflow,
    **When** it executes,
    **Then** it works identically in both invocation modes (NFR19).

## Tasks / Subtasks

### Task 1: Create the IDE skill source files (AC: 9, 10) -- NEW

The IDE skill does NOT exist. The previous (rolled-back) Phase 1 implementation only modified an installed copy at `.claude/skills/prioritize-backlog/SKILL.md`, which was wiped on rollback. This task creates the skill from scratch in the correct source location.

- [ ] 1.1 Create `skills/prioritize-backlog/skill.json` with metadata:
  ```json
  {
    "name": "prioritize-backlog",
    "version": "1.0.0",
    "description": "Reprioritize backlog items using multiple criteria -- severity, business value, dependencies, type, age",
    "category": "workflow",
    "tags": ["backlog", "prioritization", "sprint-management"]
  }
  ```
  Note: `always_load` is intentionally omitted (defaults to false) -- this skill is invoked on demand, not loaded for every task.

- [ ] 1.2 Create `skills/prioritize-backlog/SKILL.md` with the complete skill workflow (see Task 3 for content specification). This is the canonical skill content that the installer deploys to all IDE agents.

### Task 2: Create the BMAD extension skill source files (AC: 9, 10) -- NEW

The BMAD extension skill does NOT exist. The previous Phase 1 implementation never created files in this pipeline. This task creates the skill from scratch.

- [ ] 2.1 Create `lib/bmad-extension/skills/prioritize-backlog/SKILL.md` -- this is a SEPARATE file from the IDE skill SKILL.md. The BMAD extension version is authored for the BMAD Scrum Master agent (`bmm-sm`) context and may have BMAD-specific phrasing (e.g., referencing `_bmad/bmm/config.yaml` for path resolution). The core workflow logic MUST be functionally identical to the IDE version.

- [ ] 2.2 Create `lib/bmad-extension/skills/prioritize-backlog/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: prioritize-backlog
  module: ma-skills
  ```

- [ ] 2.3 Register the skill in `lib/bmad-extension/module-help.csv` by adding a row:
  ```csv
  ma-skills,4-implementation,Prioritize Backlog,prioritize-backlog,,skill:prioritize-backlog,prioritize-backlog,false,bmm-sm,,"Reprioritize backlog items using multiple criteria -- severity, business value, dependencies, type, age.",_bmad-output/implementation-artifacts,"backlog",
  ```
  The `agent` column is `bmm-sm` (Scrum Master) because backlog prioritization is a Scrum Master responsibility.

### Task 3: Implement the skill workflow content (AC: 1, 2, 3, 4, 5, 6, 7, 8)

The SKILL.md content (for both the IDE and BMAD extension versions) must implement the following workflow. Both versions MUST be functionally identical in their workflow logic.

- [ ] 3.1 **Step 0 -- Load configuration and validate file existence:**
  - Read `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` (or resolve path from config).
  - If the file does not exist, report error: "No sprint-status.yaml found. Run sprint planning first to initialize the file." Exit (AC 6).
  - Parse the full file: `epics`, `backlog`, and `sprints` sections.
  - If a legacy `backlog.yaml` file exists in the same directory, log a note: "Legacy backlog.yaml detected. Run migration to consolidate." Do NOT read or operate on the legacy file (AC 8).
  - If the `backlog` array is empty, report: "Backlog is empty. Nothing to prioritize." Exit (AC 7).

- [ ] 3.2 **Step 1 -- Display current backlog order:**
  - Read the `backlog` array from the parsed `sprint-status.yaml`.
  - Display items in current priority order in a table with columns: Priority (#), ID, Title, Type, Epic, Severity, Status.
  - Show total count of backlog items.
  - Do NOT display items from any sprint's `items` array -- only `backlog` section items are shown (AC 1).

- [ ] 3.3 **Step 2 -- Choose prioritization mode:**
  - Prompt the Scrum Master to select a mode:
    - **[f] Full** -- interactive: generates a suggested order, presents current vs proposed side-by-side, user approves or adjusts before write.
    - **[q] Quick** -- automated: applies default rules and reorders immediately, then shows summary of changes.
    - **[a] Auto-suggest** -- read-only: generates suggestions with per-item rationale, no file modification.
  - Store selected mode for the workflow branch.

- [ ] 3.4 **Step 3 -- Multi-criteria prioritization analysis (all modes):**
  - For each item in the `backlog` array, compute a composite priority score using weighted criteria (AC 5, FR67):
    1. **Severity weight (highest impact):** Items with `severity: critical` get the highest score boost. `high` > `medium` > `low`. Items with `severity: null` (stories) get no severity adjustment.
    2. **Business value weight:** Inferred from item context -- items in earlier epics or with explicit priority indicators rank higher. If the item's current `priority` value is low (was previously prioritized high), preserve that signal.
    3. **Dependency weight:** Read `epics.md` to identify explicit dependencies between stories. Items that BLOCK other items (other items depend on them) get a priority boost. Items that ARE BLOCKED get a slight deprioritization (they cannot proceed anyway). Within the same epic, assume stories are sequential (lower story number first).
    4. **Type weight:** Bugs (`type: bug`) receive a slight priority boost over stories (`type: story`) at otherwise equal scoring, reflecting the principle that defects should be addressed before new features.
    5. **Age weight (starvation prevention):** Items from lower-numbered epics or with lower item numbers within their epic get a slight boost to prevent indefinite deferral. This is the weakest signal -- it is a tiebreaker, not a dominant factor.
  - Produce a ranked list sorted by composite score (highest score = priority 1).

- [ ] 3.5 **Step 3a -- Full mode workflow (AC: 2):**
  - Display a comparison table: current order (left) vs suggested order (right), highlighting items that would move.
  - For each item that changes position, show a brief rationale (e.g., "critical bug", "blocks 3 items", "age > 2 epics").
  - Prompt: "[a] Accept suggested order / [m] Manually adjust (enter new order) / [c] Cancel"
  - On `a`: proceed to Step 4 with the suggested order.
  - On `m`: prompt the user to enter item numbers in their desired order. Validate that all items are accounted for (no duplicates, no missing). Proceed to Step 4 with the manual order.
  - On `c`: exit without changes.

- [ ] 3.6 **Step 3b -- Quick mode workflow (AC: 3):**
  - Apply the computed ranked order directly without prompting.
  - Proceed immediately to Step 4 with the computed order.

- [ ] 3.7 **Step 3c -- Auto-suggest mode workflow (AC: 4):**
  - Display the suggested new order with per-item rationale in a detailed table: New Priority, ID, Title, Rationale, Change (e.g., "+3 up", "-2 down", "unchanged").
  - Display a summary: N items would move up, M items would move down, K items unchanged.
  - Do NOT proceed to Step 4. Exit with: "Suggestions displayed. No changes written. Run again in Full or Quick mode to apply."

- [ ] 3.8 **Step 4 -- Apply reordering and persist (AC: 2, 3):**
  - Take the confirmed ordering (from Full or Quick mode).
  - Reorder the `backlog` array to match the new order.
  - Renumber the `priority` field on each item sequentially: position 0 gets `priority: 1`, position 1 gets `priority: 2`, etc. (schema section 3.3: `priority` is a denormalized index that MUST be kept in sync with array position).
  - Update the `last_updated` metadata field to the current ISO-8601 timestamp.
  - Preserve the `generated` metadata field unchanged.
  - Preserve the `epics` section unchanged.
  - Preserve the `sprints` section unchanged.
  - Write the complete `sprint-status.yaml` in a single atomic write (read-modify-write pattern).

- [ ] 3.9 **Step 5 -- Summary output:**
  - Display the reprioritization summary:
    - Mode used (Full / Quick).
    - Items reordered: total count.
    - Items that moved up (with old and new priority).
    - Items that moved down (with old and new priority).
    - Items unchanged.
  - Suggest next steps: `/add-to-sprint` to assign top-priority items to a sprint, `/sprint-status-view` to view overall progress.

### Task 4: Verify no legacy file references (AC: 8)

- [ ] 4.1 Confirm neither SKILL.md file contains any instruction to read from or write to `backlog.yaml` as a data source or write target.
- [ ] 4.2 Confirm neither SKILL.md file contains any instruction to write a standalone `backlog.yaml` file.
- [ ] 4.3 Confirm the only data file read/written is `sprint-status.yaml`.
- [ ] 4.4 Confirm neither SKILL.md file references the old `development_status` map or `sprint-plan-*.yaml` files.

### Task 5: Deployment verification (AC: 9)

- [ ] 5.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer.
- [ ] 5.2 Verify the IDE skill appears in the installed MANIFEST.yaml for at least one agent (e.g., check `.claude/skills/MANIFEST.yaml` includes `prioritize-backlog`).
- [ ] 5.3 Diff the installed IDE copy (e.g., `.claude/skills/prioritize-backlog/SKILL.md`) against the source (`skills/prioritize-backlog/SKILL.md`) -- the content should match after accounting for frontmatter injection by the installer.
- [ ] 5.4 Verify the BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/prioritize-backlog/SKILL.md` after a BMAD install.
- [ ] 5.5 Verify the BMAD extension copy matches the source at `lib/bmad-extension/skills/prioritize-backlog/SKILL.md`.
- [ ] 5.6 Verify `prioritize-backlog` appears in the BMAD module help output.

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Read This First)

The ma-agents project is a **multi-agent skill installer** that deploys skills to 8+ IDE coding agents. There are TWO independent deployment pipelines, and this story creates source files for BOTH.

**Why this matters:** The previous version of this story was fundamentally wrong -- it directed edits to `.claude/skills/prioritize-backlog/SKILL.md`, which is an INSTALLED COPY (a read-only deployed artifact). That path is where the installer OUTPUTS files, not where source files live. Furthermore, the Phase 1 implementation was rolled back entirely, so `prioritize-backlog` does NOT currently exist in either pipeline. This story creates it from scratch in both locations.

#### Pipeline 1: IDE Skills (all IDE agents) -- NEW

- **Source location:** `skills/prioritize-backlog/skill.json` + `skills/prioritize-backlog/SKILL.md`
- **Status:** Does NOT exist. Task 1 creates these files from scratch.
- **Deployed by:** `lib/installer.js` -> `performInstall()` which:
  1. Reads `skill.json` for metadata
  2. Falls back through: `templates/<agent>.md` -> `templates/generic.md` -> `SKILL.md`
  3. Strips existing frontmatter, injects fresh frontmatter from `skill.json`
  4. Copies to each agent's install directory (e.g., `.claude/skills/`, `.cursor/skills/`, etc.)
- **Never hardcode agent paths.** The installer handles deployment to all agents automatically.
- **Reference skill:** See `skills/story-status-lookup/` for a working example of `skill.json` + `SKILL.md`.

#### Pipeline 2: BMAD Extension Skills (BMAD agents only) -- NEW

- **Source location:** `lib/bmad-extension/skills/prioritize-backlog/SKILL.md` + `bmad-skill-manifest.yaml`
- **Status:** Does NOT exist. Task 2 creates these files from scratch.
- **Deployed by:** `lib/bmad.js` which copies `lib/bmad-extension/` to `_bmad/extensions/ma-agents-skills/`
- **Registered in:** `lib/bmad-extension/module-help.csv` (new row mapping to `bmm-sm` agent)
- **Reference skill:** See `lib/bmad-extension/skills/add-to-sprint/` for a working example of `SKILL.md` + `bmad-skill-manifest.yaml`.

#### Install Locations (NEVER edit these directly)

- `.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/` -- all managed by installer
- `_bmad/extensions/ma-agents-skills/skills/` -- managed by BMAD deployer

### What This Story Changes vs Current Behavior

**Current state (post-rollback):** The `prioritize-backlog` skill does NOT exist in either pipeline. The Phase 1 implementation created an installed copy at `.claude/skills/prioritize-backlog/SKILL.md` that read/wrote a standalone `backlog.yaml` file. That implementation was rolled back in commit `85fad06`. No source files for this skill exist anywhere in the repository.

**New behavior:** The skill is created from scratch in BOTH deployment pipelines. It reads the `backlog` array from `sprint-status.yaml`, applies multi-criteria prioritization scoring, and writes the reordered backlog back to the same file. Three modes are supported: Full (interactive), Quick (automated), and Auto-suggest (read-only). The `sprints` and `epics` sections are preserved unchanged on every write.

### Key Design Decisions

- **Output target:** `sprint-status.yaml` `backlog` section only. No standalone `backlog.yaml` is read or written.
- **Scope boundary:** Only items in the `backlog` array are subject to reprioritization. Items in `sprints[].items` are completely excluded from the view and from scoring. This respects the single-location invariant (schema section 6.1).
- **Three modes:** Full (interactive approval), Quick (automated apply), Auto-suggest (display-only). This provides flexibility from full control to quick automation.
- **Priority renumbering:** After reordering, `priority` values are renumbered 1..N to keep the denormalized index in sync with array positions (schema section 3.3).
- **Atomic write:** Single read-modify-write to `sprint-status.yaml`. The `backlog` section is replaced with the reordered version; `epics` and `sprints` sections are passed through unchanged.
- **Weighted criteria (FR67):** Severity > Business Value > Dependencies > Type > Age. Severity is the strongest signal (critical bugs must float to top); age is the weakest (tiebreaker to prevent starvation).
- **Dependency inference:** Reads `epics.md` for explicit inter-story dependencies. Within the same epic, assumes sequential ordering (lower story number = earlier dependency). Items that block other items get a priority boost.
- **Legacy file handling:** If `backlog.yaml` exists alongside `sprint-status.yaml`, it is ignored with a logged note suggesting migration (Story 17.23).

### Unified Schema Sections Touched

- **`backlog`** -- read (display items, compute scores) + write (reordered array with renumbered priorities)
- **`epics`** -- preserved unchanged (pass-through on write)
- **`sprints`** -- preserved unchanged (pass-through on write); NOT read for item discovery (only `backlog` is in scope)
- **Metadata** -- `last_updated` is updated on every write; `generated` is preserved unchanged

### Rework Level: Light (but Create from Scratch)

The epics document classifies this as a "Light rework" because the core prioritization logic (multi-criteria scoring, three modes, dependency analysis) is conceptually simple and well-defined. However, because the Phase 1 implementation was fully rolled back, the dev agent must create all files from scratch rather than modifying existing files. The tasks reflect this reality -- there are no files to read or modify, only files to create.

### Prioritization Criteria Details (FR67)

The following criteria are used to compute a composite priority score for each backlog item:

| Criteria | Weight | Signal Source | Effect |
|----------|--------|---------------|--------|
| Severity | Highest | `severity` field on item | `critical` = top, `high` = elevated, `medium`/`low` = moderate/slight boost, `null` = no effect |
| Business Value | High | Existing `priority` value, epic importance | Preserves existing prioritization signals; items from higher-priority epics rank higher |
| Dependencies | Medium | `epics.md` inter-story dependencies | Blocking items boosted; blocked items slightly deprioritized |
| Type | Low | `type` field on item | `bug` gets slight boost over `story` at equal composite score |
| Age | Lowest | Epic number, item position | Lower epic number = older = slight boost; tiebreaker only |

### Reference Files

- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema, especially section 3 for backlog items, section 3.3 for priority renumbering)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Epics source:** `_bmad-output/planning-artifacts/epics.md` (for dependency inference in prioritization scoring)
- **IDE skill reference:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md` (example of `skill.json` + `SKILL.md` structure)
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/` (example of `SKILL.md` + `bmad-skill-manifest.yaml`)
- **Module help CSV:** `lib/bmad-extension/module-help.csv`
- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR67, FR133, FR134)

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema and the `backlog` array item structure with `priority` field (section 3)
- **Story 17.15** (prerequisite): `bmad-sprint-planning` bootstraps the file; `prioritize-backlog` requires it to exist
- **Story 17.10** (prerequisite): `generate-backlog` populates the `backlog` section that this skill reorders
- **Story 17.11** (downstream): `add-to-sprint` moves top-priority items from the backlog this skill orders into sprints
- **Story 17.12** (peer): `remove-from-sprint` may return items to backlog, which may then need reprioritization
- **Story 17.23** (migration): Migrates old `backlog.yaml` to the unified file; this skill ignores the legacy file if present

### PRD Traceability

- **FR67:** Story/bug prioritization supports multiple criteria beyond epic precedence -- criteria include severity, business value, dependencies, type, and age. This is the primary FR for this story; the multi-criteria scoring engine implements it directly.
- **FR133:** `sprint-status.yaml` includes top-level metadata (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`) -- `last_updated` must be refreshed on write.
- **FR134:** Each item in the backlog carries a consistent structure (`id`, `type`, `epic`, `title`, `priority`, `status`, `severity`). Prioritization respects section boundaries -- items in `backlog` are reordered; items in `sprints` are untouched.
- **FR65:** All sprint, backlog, and epic status data is managed in a single `sprint-status.yaml` file. This skill reads from and writes to that single file.
- **NFR19:** Skills work identically across invocation modes (slash command, menu, workflow).

### Architecture Reference

- Architecture Decision P2-5 in `_bmad-output/planning-artifacts/architecture.md` -- Pre-built Extension Workflows (FR61, FR68-FR70)
- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified sprint-status.yaml model
- Schema: `_bmad-output/planning-artifacts/sprint-status-schema.md` -- canonical schema, especially section 3 (backlog), section 3.3 (priority renumbering invariant), section 6.1 (single-location invariant)
