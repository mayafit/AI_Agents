# Story 17.19: Rework story-status-lookup Skill (Light Rework -- Cross-Section Search)

Status: ready-for-dev

## Story

As a **Developer**,
I want the `story-status-lookup` skill to search the unified `sprint-status.yaml` schema (backlog array and sprints[].items arrays) for any story's current status,
So that code can be classified as delivered or work-in-progress from a single data source without relying on the deprecated flat `development_status` map.

## Acceptance Criteria

1. **Given** the `story-status-lookup` skill is invoked with a story ID,
   **When** the story exists in the `backlog` array of `sprint-status.yaml`,
   **Then** it returns the item's `status` field value and notes it is "in backlog (unassigned)".

2. **Given** the story exists in a sprint's `items` array,
   **When** the lookup completes,
   **Then** it returns the item's `status` field value and notes which sprint it is assigned to (e.g., "in sprint-3").

3. **Given** the story is not found in any section of `sprint-status.yaml`,
   **When** the lookup checks the `done/` archive folder,
   **Then** it reports "Story {id} is archived (done)" if a file matching `{story_location}/done/{id}.md` exists,
   **And** classifies the story as **delivered**.

4. **Given** the story is not found in `sprint-status.yaml` AND not found in the `done/` archive,
   **When** the lookup completes,
   **Then** it reports "Story {id} not found in sprint-status.yaml or done/ archive",
   **And** classifies the story as **WIP** (per the existing fallback rule: when in doubt, WIP).

5. **Given** the status-to-classification mapping (delivered vs WIP),
   **When** the skill returns a result,
   **Then** the classification table is unchanged from the current implementation:
   | Status | Classification |
   |--------|---------------|
   | `done` | Delivered |
   | `review` | Delivered |
   | `in-progress` | WIP |
   | `ready-for-dev` | WIP |
   | `backlog` | WIP |
   | `on-hold` | WIP |
   | `cancelled` | WIP |

6. **Given** the skill source file exists at `skills/story-status-lookup/SKILL.md` (IDE skill pipeline),
   **When** the ma-agents installer is run,
   **Then** the IDE skill is deployed to all agent directories via `lib/installer.js` (`performInstall`),
   **And** the installed copies are byte-identical to the source (minus frontmatter injection by the installer),
   **And** `always_load: true` remains set in `skill.json` so the skill loads for every agent task.

7. **Given** the skill's Backend Configuration section supports file-system and Jira backends,
   **When** the Jira backend is not yet implemented,
   **Then** the "Future: Jira Backend" section is preserved unchanged for Story 17.22 activation.

## Agent Discussion: IDE Skill Only -- No BMAD Extension

**Winston (Architect):** `story-status-lookup` is fundamentally different from sprint management workflow skills. It is a passive, read-only lookup used by all agents to classify code. It has no BMAD-specific context requirements -- no config loading from `_bmad/bmm/config.yaml`, no XML workflow semantics, no multi-file delegation. It reads one file (`sprint-status.yaml`) and returns a status string. The IDE skill pipeline (`lib/installer.js`) already deploys it to all agent directories, and BMAD agents receive it through the same mechanism. Creating a BMAD extension version would mean maintaining two copies of the same trivially simple skill with zero functional divergence.

**John (PM):** The acceptance criteria cover all agents via AC 6 -- the installer deploys to everyone. There is no agent-specific behavior to differentiate. A BMAD extension would add maintenance overhead (two SKILL.md files, a bmad-skill-manifest.yaml, a module-help.csv entry) for zero user-facing value. The skill has `always_load: true` -- it is already loaded for every BMAD agent task via MANIFEST.yaml. No BMAD user would benefit from a separate extension version.

**Mary (Analyst):** The PRD (FR120) says sprint artifacts resolve paths from `{sprint_management_path}`. The skill already uses `_bmad-output/implementation-artifacts/sprint-status.yaml` from the project root, which is the correct default for single-repo mode. Multi-repo path resolution is a Story 17.22/17.23 concern and applies uniformly to all skills. No PRD requirement mandates BMAD-specific behavior for passive status lookup. The epics.md technical notes for 17.19 say "Reworks the existing skill" -- confirming the intent is to update the existing IDE skill, not create a new BMAD extension.

**Decision: IDE skill only (`skills/story-status-lookup/`). No BMAD extension version.**

## Tasks / Subtasks

### Task 1: Read and understand the current skill (AC: 1-5, 7)

- [ ] 1.1 Read `skills/story-status-lookup/SKILL.md` -- the canonical source file (this is NOT the installed copy). Understand the current three-step flow:
  - Step 1: Slug derivation (from filename, branch, or explicit reference)
  - Step 2: Flat `development_status` map lookup
  - Step 3: Status-to-delivered/WIP classification
- [ ] 1.2 Read `skills/story-status-lookup/skill.json` -- confirm metadata and `always_load: true`
- [ ] 1.3 Document the current "Backend Configuration" section logic (file-system vs Jira backend selection)

### Task 2: Rewrite Step 2 -- replace flat map lookup with cross-section search (AC: 1, 2)

The current Step 2 says: "Find the slug as a key under `development_status` in `sprint-status.yaml`." Replace this entire step with a cross-section search.

- [ ] 2.1 Replace the instruction to look up `development_status[slug]` with a search across two sections:
  - **Backlog search:** Iterate the `backlog` array. For each item, check if `item.id` matches the derived slug.
  - **Sprint search:** Iterate the `sprints` map. For each sprint, iterate its `items` array. For each item, check if `item.id` matches the derived slug.
- [ ] 2.2 When found in `backlog`, the result includes: the item's `status` field value + location context "in backlog (unassigned)"
- [ ] 2.3 When found in a sprint's `items` array, the result includes: the item's `status` field value + location context "in {sprint-id}" (e.g., "in sprint-3")
- [ ] 2.4 Remove ALL references to the `development_status` flat map key format
- [ ] 2.5 The search is read-only -- the skill NEVER writes to `sprint-status.yaml`

### Task 3: Implement done/ archive fallback (AC: 3, 4)

If the slug is not found in any section of `sprint-status.yaml`, check the archive before falling back to "not found."

- [ ] 3.1 Check for a file at `{story_location}/done/{slug}.md` where `story_location` is the value from the `story_location` metadata field in `sprint-status.yaml` (default: `_bmad-output/implementation-artifacts`)
- [ ] 3.2 If the file exists in `done/`, return: "Story {id} is archived (done)" -- classify as **delivered**
- [ ] 3.3 If not found anywhere (not in backlog, not in any sprint, not in done/), return: "Story {id} not found in sprint-status.yaml or done/ archive" -- classify as **WIP** per the existing fallback rule

### Task 4: Preserve unchanged skill sections (AC: 5, 7)

- [ ] 4.1 **Step 1 (slug derivation)** -- preserve entirely unchanged. The three-method derivation (filename, branch, explicit reference) works regardless of schema format.
- [ ] 4.2 **Step 3 (status-to-classification table)** -- preserve the delivered/WIP mapping table. Add `cancelled` status mapped to WIP if not already present (the unified schema adds this status).
- [ ] 4.3 **Fallback rule** -- preserve the "When in doubt, WIP" rule. Update it to include the new done/ archive check as an intermediate step before the final WIP fallback:
  1. Slug not determined -> WIP
  2. Slug not found in sprint-status.yaml -> check done/ archive
  3. Found in done/ -> delivered
  4. Not found anywhere -> WIP
  5. Status file does not exist -> WIP
- [ ] 4.4 **Backend Configuration section** -- preserve unchanged (file-system vs Jira backend selection logic)
- [ ] 4.5 **Future: Jira Backend section** -- preserve unchanged. Story 17.22 will activate this extension point.

### Task 5: Update skill.json if needed (AC: 6)

- [ ] 5.1 Read `skills/story-status-lookup/skill.json` and verify:
  - `always_load: true` is present
  - `version` should be bumped to `"2.0.0"` (the lookup mechanism is fundamentally changed)
  - `description` accurately reflects the new behavior -- update if it still references the flat map
- [ ] 5.2 Update the `description` field to reflect unified schema search:
  ```json
  "description": "Looks up the current status of a story by searching the unified sprint-status.yaml (backlog and sprint items arrays) to classify code as delivered or work-in-progress. Supports file-system backend; Jira backend reserved for future configuration."
  ```

### Task 6: Deployment verification (AC: 6)

- [ ] 6.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer
- [ ] 6.2 Verify the installed SKILL.md for at least one agent (e.g., `.claude/skills/story-status-lookup/SKILL.md`) contains the new cross-section search instructions and does NOT reference `development_status`
- [ ] 6.3 Diff the installed copy against the source (`skills/story-status-lookup/SKILL.md`) -- content should match after accounting for frontmatter injection by the installer
- [ ] 6.4 Verify `always_load: true` appears in the installed MANIFEST.yaml entry for `story-status-lookup`
- [ ] 6.5 Confirm NO `lib/bmad-extension/skills/story-status-lookup/` directory exists -- per the decision to keep this IDE-only

## Dev Notes

### CRITICAL: Source File Location (Read This First)

The source file to modify is:

- **`skills/story-status-lookup/SKILL.md`** -- the canonical skill content
- **`skills/story-status-lookup/skill.json`** -- the skill metadata

These are the SOURCE files in the IDE skill pipeline. The installer (`lib/installer.js`) reads these and deploys copies to all agent directories (`.claude/skills/`, `.cursor/skills/`, `.cline/skills/`, `.roo/skills/`, `.gemini/skills/`, `.github/copilot/skills/`, `.kilocode/skills/`).

**NEVER edit the installed copies directly** (e.g., `.claude/skills/story-status-lookup/SKILL.md`). They are overwritten on every install.

### What This Story Changes vs Current Behavior

**Current behavior (Step 2):** The skill reads `sprint-status.yaml`, finds the story slug as a key under the flat `development_status` map:

```yaml
development_status:
  5-5-explicit-parameter-passing: review
  17-19-rework-story-status-lookup: ready-for-dev
```

It reads `development_status[slug]` and returns the status string.

**New behavior (Step 2):** The skill reads `sprint-status.yaml`, searches for the story ID across two structured sections:

```yaml
backlog:
  - id: "17-19-rework-story-status-lookup"
    status: ready-for-dev
    ...

sprints:
  sprint-3:
    items:
      - id: "5-5-explicit-parameter-passing"
        status: review
        ...
```

It iterates `backlog` items and all `sprints[].items` arrays, matching `item.id` against the slug. When found, it returns both the status and the location context (e.g., "in sprint-3" or "in backlog (unassigned)").

**New behavior (done/ fallback):** If the slug is not found in any section, the skill checks `{story_location}/done/{slug}.md`. If the file exists, the story is classified as delivered (archived). This is a new intermediate step before the existing "not found = WIP" fallback.

### Scope of Changes -- Surgical, Not Full Rewrite

This is a **light rework** because:

- **Step 1 (slug derivation)** is unchanged -- the three-method derivation works regardless of schema format
- **Step 3 (status classification table)** is unchanged -- delivered/WIP mapping is the same
- **Backend Configuration section** is unchanged -- file-system vs Jira selection logic is the same
- **Future: Jira Backend section** is unchanged -- Story 17.22 activates this
- **Only Step 2 (the lookup mechanism)** changes from flat-key to cross-section search
- **One addition:** done/ archive fallback check (new intermediate step in the fallback chain)

The SKILL.md file is approximately 75 lines. The change touches roughly 15-20 lines in the Step 2 section and adds approximately 10 lines for the done/ archive fallback.

### Cross-Section Search Pattern

The search pattern is consistent with Story 17.18 (`bmad-dev-story`) and Story 17.13 (`sprint-status-view`):

```
Search order:
  1. backlog array -- iterate items, match item.id == slug
  2. sprints map -- iterate each sprint's items array, match item.id == slug
  3. done/ folder -- check for file existence at {story_location}/done/{slug}.md
  4. Not found -- classify as WIP
```

Unlike `bmad-dev-story` (which prioritizes active sprints for auto-discovery), this skill does NOT need to prioritize by sprint status -- it just needs to find the item wherever it lives. Search order does not affect the result.

### Why No BMAD Extension Version

Per the agent discussion above, this skill:
- Has no BMAD-specific context requirements (no config loading, no XML workflows, no multi-file delegation)
- Is already deployed to all agents via `lib/installer.js` (including BMAD agents)
- Is `always_load: true` -- loaded for every task in every agent
- Would require maintaining two identical SKILL.md files for zero functional benefit

This is unlike `bmad-dev-story` (Story 17.18) which requires BMAD agent context, or `generate-backlog` (Story 17.10) which has BMAD-specific phrasing. `story-status-lookup` is agent-agnostic and pipeline-1-only.

### Unified Schema Sections Touched

- **`backlog`** -- searched for item by `id` (read-only)
- **`sprints`** -- all sprint entries' `items` arrays searched for item by `id` (read-only)
- **Metadata** -- `story_location` field read to resolve the done/ archive path
- This skill is **strictly read-only** -- it NEVER writes to `sprint-status.yaml`

### Reference Files

- **Skill source:** `skills/story-status-lookup/skill.json` + `skills/story-status-lookup/SKILL.md`
- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for sprint-status.yaml)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **MANIFEST:** `.claude/skills/MANIFEST.yaml` (installed manifest -- verify `always_load: true` entry)

### Cross-References

- **Story 17.9** (prerequisite, done): Defines the unified `sprint-status.yaml` schema this skill searches
- **Story 17.18** (parallel): `bmad-dev-story` uses the same cross-section search pattern for finding items by `id`. The search logic should be consistent between both skills.
- **Story 17.13** (parallel): `sprint-status-view` reads all sections for summary display -- similar read-only traversal
- **Story 17.22** (downstream): Jira adapter pattern -- will activate the Jira backend extension point preserved in this skill
- **Story 17.23** (downstream): Migration/deprecation -- will remove the legacy `development_status` map from `sprint-status.yaml`; this skill must be updated BEFORE that migration runs
- **Epic 11** (consumer): `auto-bug-detection` skill consumes this skill's delivered/WIP classification. The classification table must remain compatible.

### Gotchas and Warnings

1. **The current SKILL.md explicitly says "Find the slug as a key under `development_status`" in Step 2.** This sentence and surrounding instructions must be fully replaced -- do not leave any reference to the flat map.
2. **The `cancelled` status** is new in the unified schema (Section 6.6 of the schema doc). It should map to WIP in the classification table if not already present.
3. **The done/ archive check is a NEW addition** to the fallback chain. The current skill has no done/ check -- it goes directly from "not found" to "classify as WIP." The new chain is: not found in file -> check done/ -> found = delivered, not found = WIP.
4. **The `story_location` metadata field** in `sprint-status.yaml` provides the path to the implementation artifacts directory. Use this to resolve `{story_location}/done/{slug}.md` rather than hardcoding `_bmad-output/implementation-artifacts`.
5. **This skill must be updated BEFORE Story 17.23 (migration)** runs. Story 17.23 will remove the `development_status` map from `sprint-status.yaml`. If this skill still reads `development_status` when migration runs, all lookups will fail (fallback to WIP, which is safe but incorrect for delivered stories).
6. **The `always_load: true` flag means every agent session loads this skill.** Keep the SKILL.md concise -- avoid verbose instructions that waste context window in every session.

### PRD Traceability

- **FR62:** `auto-bug-detection` skill uses this skill's delivered/WIP classification to decide whether to flag bugs -- the classification must remain compatible after rework
- **FR65:** "All sprint, backlog, and epic status data is managed in a single sprint-status.yaml" -- this skill now reads from the unified three-section file
- **FR120:** "All BMAD workflows that produce or consume sprint artifacts resolve their paths from the configured `{sprint_management_path}`" -- this skill reads `sprint-status.yaml` from the implementation artifacts path
- **FR134:** "Each item carries a consistent structure (id, type, epic, title, priority, status, severity)" -- the cross-section search matches items by their `id` field
- **FR135:** "Each item carries its own status field, updated in-place within the section where it resides" -- this skill reads the result of those in-place status updates

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified Sprint-Status Data Architecture
- Skill Integration Map in architecture doc and schema doc (Section 7) -- `story-status-lookup` listed as "Light" rework, operating on all sections (read-only)
