# Story 17.18: Rework bmad-dev-story Skill (Moderate Rework -- Extension Override for Cross-Section Status Update)

Status: ready-for-dev

## Story

As a **Developer**,
I want the `bmad-dev-story` skill to read and update story status using the unified `sprint-status.yaml` schema (searching `backlog` and `sprints[].items` arrays by item `id`),
So that development progress is reflected correctly in the unified file regardless of whether the story resides in the backlog or a sprint.

## Acceptance Criteria

1. **Given** `bmad-dev-story` is a BMAD built-in skill (source: `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/`),
   **When** the extension override files are created in `lib/bmad-extension/skills/bmad-dev-story/`,
   **Then** the extension version takes precedence over the built-in during BMAD deployment (via the `--custom-content` flag),
   **And** the built-in is NOT modified,
   **And** the override provides replacement files for ALL three built-in files (`SKILL.md`, `workflow.md`, `checklist.md`) plus a `bmad-skill-manifest.yaml`, so no built-in file leaks through.

2. **Given** the skill auto-discovers the next story to develop,
   **When** no explicit `story_path` is provided and `sprint-status.yaml` exists,
   **Then** the skill searches for the first item with `status: ready-for-dev` by checking:
     - All sprint `items` arrays (sprints with `status: active` first, then `planning`), then
     - The `backlog` array,
   **And** the first match becomes the story to develop,
   **And** items in `closed` sprints are skipped.

3. **Given** a developer starts working on a story via `bmad-dev-story`,
   **When** the story transitions from `ready-for-dev` to `in-progress`,
   **Then** the skill finds the item by its `id` field in `sprint-status.yaml` (searching both `backlog` array and all `sprints[].items` arrays),
   **And** updates the item's `status` field in-place to `in-progress` (FR135),
   **And** all other fields on the item (`id`, `type`, `epic`, `title`, `priority`, `severity`) are preserved,
   **And** all other sections of `sprint-status.yaml` are preserved,
   **And** the `last_updated` metadata field is updated to the current ISO-8601 timestamp.

4. **Given** a developer completes story implementation and all tasks pass,
   **When** the story transitions to `review`,
   **Then** the status is updated in-place to `review` in whichever section the item currently resides,
   **And** the same preservation guarantees from AC 3 apply.

5. **Given** the story ID is not found in any section of `sprint-status.yaml`,
   **When** the skill attempts to update status,
   **Then** it checks the `done/` archive folder for a file matching `{story_location}/done/{story_key}.md`,
   **And** if found in `done/`, reports: "Story {id} has been archived (done). It cannot be developed again without manual re-introduction to the backlog.",
   **And** if not found anywhere, reports: "Story {id} not found in sprint-status.yaml. It may not yet have been added to the backlog. Run sprint planning or generate-backlog first."

6. **Given** the developer story execution workflow (task sequencing, red-green-refactor, definition of done, review continuation),
   **When** the skill executes,
   **Then** ALL non-status-related workflow behavior is preserved unchanged from the built-in,
   **And** only the sprint-status discovery and status update mechanisms are modified.

7. **Given** this skill is tightly coupled to the BMAD methodology workflow (config loading from `_bmad/bmm/config.yaml`, BMAD-specific agent context, multi-step execution workflow with critical directives),
   **When** the implementation decision is made about IDE skill creation,
   **Then** NO standalone IDE skill is created in `skills/bmad-dev-story/`,
   **And** this decision is documented: the skill requires BMAD agent context (config resolution, skill delegation patterns, workflow XML semantics) that non-BMAD IDE agents cannot provide.

## Agent Discussion: IDE Skill Decision

**Winston (Architect):** `bmad-dev-story` is fundamentally different from sprint management skills like `add-to-sprint` or `generate-backlog`. Those skills perform a discrete operation on `sprint-status.yaml` that any agent can invoke. `bmad-dev-story` is an entire developer execution workflow -- it loads BMAD config, delegates to a workflow.md file, uses XML workflow semantics with `<step>`, `<check>`, `<critical>`, `<goto>` directives, and references BMAD-specific paths (`_bmad/bmm/config.yaml`). Non-BMAD agents wouldn't know how to execute this workflow format. The IDE skill pipeline (`lib/installer.js`) deploys flat SKILL.md files -- it doesn't handle multi-file workflow delegation.

**John (PM):** The acceptance criteria need to be clear that we are NOT creating an IDE skill. The user story is about the developer's workflow within the BMAD ecosystem. Developers using non-BMAD agents (pure Claude Code, Cursor without BMAD) wouldn't invoke this skill -- they'd either use `bmad-quick-dev` or implement stories manually. The BMAD extension override is the only deployment target.

**Mary (Analyst):** The PRD (FR135) says "Each item carries its own status field, updated in-place within the section where it resides." This requirement applies to the status update mechanism, not to which deployment pipeline delivers it. The skill's core value (in-place status update across sections) is correctly scoped to the BMAD extension override. No PRD requirement mandates IDE-agent availability for the dev story execution workflow. Agreed: BMAD extension only.

**Decision: BMAD extension override only. No IDE skill.**

## Tasks / Subtasks

### Task 1: Read and understand the built-in skill files (AC: 1, 6)

Before writing replacement files, study the three built-in files that the extension override must replace.

- [ ] 1.1 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/SKILL.md` -- note: a thin entry point that delegates to `./workflow.md`
- [ ] 1.2 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/workflow.md` -- the main implementation (~450 lines). Document:
  - INITIALIZATION section: config loading from `_bmad/bmm/config.yaml`, variable resolution
  - Step 1 (`tag="sprint-status"`): story discovery via `development_status` flat map with key pattern matching
  - Step 4 (`tag="sprint-status"`): mark story `in-progress` by writing `development_status[story_key] = "in-progress"`
  - Step 9 (`tag="sprint-status"`): mark story `review` by writing `development_status[story_key] = "review"`
  - Identify all `development_status` references (at least Steps 1, 4, 9)
- [ ] 1.3 Read `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/checklist.md` -- the definition-of-done checklist. Document which items reference sprint status (the "Sprint Status Updated" item in the Final Status Verification section)
- [ ] 1.4 Create a change inventory: list every section/line in `workflow.md` that reads or writes `development_status` or references the flat map format. These are the surgical change points.

### Task 2: Create the BMAD extension override directory and manifest (AC: 1)

The extension override MUST provide replacements for ALL three built-in files plus a manifest.

- [ ] 2.1 Create `lib/bmad-extension/skills/bmad-dev-story/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: bmad-dev-story
  module: ma-skills
  ```

- [ ] 2.2 Create `lib/bmad-extension/skills/bmad-dev-story/SKILL.md` -- override of the built-in SKILL.md. Preserve the same delegation pattern:
  ```markdown
  ---
  name: bmad-dev-story
  description: 'Execute story implementation following a context filled story spec file. Use when the user says "dev this story [story file]" or "implement the next story in the sprint plan"'
  ---

  Follow the instructions in ./workflow.md.
  ```

### Task 3: Rewrite story auto-discovery in workflow.md Step 1 (AC: 2)

The current Step 1 discovers the next story by scanning `development_status` keys. Replace with unified schema search.

- [ ] 3.1 Replace the `development_status` flat-map parsing in Step 1 with a cross-section search:
  - Read and parse `sprint-status.yaml` fully (preserve all content for later write-back)
  - Search `sprints` map: for each sprint (prefer `active` sprints first, then `planning`; skip `closed`), iterate its `items` array looking for items with `status: ready-for-dev`
  - If not found in any sprint, search the `backlog` array for items with `status: ready-for-dev`
  - The first match (sprint items prioritized over backlog) becomes the story to develop
- [ ] 3.2 When a story is found, extract its `id` as the `story_key` and record its location context:
  - If found in a sprint: `"in {sprint-id}"` (e.g., `"in sprint-3"`)
  - If found in backlog: `"in backlog (unassigned)"`
- [ ] 3.3 Remove the old key-pattern matching logic (distinguishing epics from stories by key format like `number-number-name`). The unified schema uses the `type` field (`story` or `bug`) on each item explicitly -- no pattern matching needed.
- [ ] 3.4 Update the "no ready-for-dev story found" output message to reference the unified schema:
  ```
  No ready-for-dev stories found in sprint-status.yaml.

  Current Sprint Status: {summary of active/planning sprints and backlog item count}

  What would you like to do?
  1. Run `create-story` to create next story from epics
  2. Run `*validate-create-story` to improve existing stories
  3. Specify a particular story file to develop (provide full path)
  4. Check sprint-status.yaml to see current sprint status
  ```
- [ ] 3.5 Preserve the explicit `story_path` branch (when user provides a path directly) -- this code path does NOT read `sprint-status.yaml` for discovery and needs no change.
- [ ] 3.6 Preserve the non-sprint discovery fallback (when `sprint-status.yaml` does not exist) -- search implementation artifacts for story files directly. This code path needs no change.

### Task 4: Rewrite status update in workflow.md Step 4 (AC: 3)

Step 4 marks the story `in-progress`. Replace the flat-map write with in-place item update.

- [ ] 4.1 Replace the `development_status[story_key]` lookup with a cross-section search by item `id`:
  - Search `backlog` array: iterate items, match `item.id == story_key`
  - Search all `sprints` map entries: iterate each sprint's `items` array, match `item.id == story_key`
- [ ] 4.2 When the item is found, update its `status` field in-place to `"in-progress"`
- [ ] 4.3 Preserve ALL other fields on the item (`id`, `type`, `epic`, `title`, `priority` if in backlog, `severity`)
- [ ] 4.4 Preserve ALL other sections and items in `sprint-status.yaml` (read-modify-write pattern)
- [ ] 4.5 Update the `last_updated` metadata field to the current ISO-8601 timestamp
- [ ] 4.6 If the item is not found, invoke the not-found handling (see Task 6)
- [ ] 4.7 Include location context in the status output:
  ```
  Starting work on story {story_key} ({location_context})
  Status updated: ready-for-dev -> in-progress
  ```
  where `{location_context}` is e.g., "in sprint-3" or "in backlog"

### Task 5: Rewrite status update in workflow.md Step 9 (AC: 4)

Step 9 marks the story `review` on completion. Apply the same in-place pattern.

- [ ] 5.1 Replace the `development_status[story_key] = "review"` write with a cross-section search by item `id` (same pattern as Task 4)
- [ ] 5.2 Update the item's `status` field in-place to `"review"`
- [ ] 5.3 Apply the same preservation guarantees (all other fields, all other sections, `last_updated` update)
- [ ] 5.4 If the item is not found, report a warning but do NOT block completion:
  ```
  Story file updated to "review", but sprint-status.yaml update failed: {story_key} not found.
  Sprint-status.yaml may be out of sync.
  ```
- [ ] 5.5 Include location context in the success output:
  ```
  Story status updated to "review" in sprint-status.yaml ({location_context})
  ```

### Task 6: Implement not-found handling (AC: 5)

- [ ] 6.1 When the story `id` is not found in any section of `sprint-status.yaml`, check for a file at `{story_location}/done/{story_key}.md`
- [ ] 6.2 If found in `done/`, report: "Story {id} has been archived (done). It cannot be developed again without manual re-introduction to the backlog."
- [ ] 6.3 If not found anywhere, report: "Story {id} not found in sprint-status.yaml. It may not yet have been added to the backlog. Run sprint planning or generate-backlog first."
- [ ] 6.4 In Step 4 (marking in-progress), this is a HALT condition -- the developer cannot proceed without status tracking.
- [ ] 6.5 In Step 9 (marking review), this is a WARNING -- the story file itself still gets updated to "review" even if sprint-status update fails.

### Task 7: Update the checklist.md override (AC: 1, 6)

- [ ] 7.1 Create `lib/bmad-extension/skills/bmad-dev-story/checklist.md` -- copy of the upstream checklist with one change:
  - In the "Final Status Verification" section, update the "Sprint Status Updated" item description from referencing the flat `development_status` map to: "Sprint status updated to 'review' in sprint-status.yaml (item found by id in backlog or sprint items)"
- [ ] 7.2 Preserve all other checklist items unchanged -- they validate story implementation quality, not sprint-status schema format

### Task 8: Register the extension override in module-help.csv (AC: 1)

- [ ] 8.1 Add a row to `lib/bmad-extension/module-help.csv`:
  ```csv
  ma-skills,4-implementation,Dev Story,bmad-dev-story,,skill:bmad-dev-story,bmad-dev-story,false,bmm-dev,,"Execute story implementation following a context filled story spec file.",_bmad-output/implementation-artifacts,"story implementation",
  ```
  The `agent` column is `bmm-dev` (Developer) because story execution is a Developer responsibility.

### Task 9: Remove legacy flat-map references from the workflow (AC: 3, 4, 6)

- [ ] 9.1 Verify that NO references to `development_status` remain in the override `workflow.md` after Tasks 3-5
- [ ] 9.2 Verify that NO key-pattern matching logic (distinguishing epics from stories by key format) remains -- the `type` field on items replaces this
- [ ] 9.3 Verify that the `tag="sprint-status"` attribute on Steps 1, 4, and 9 is preserved -- other skills may reference these step tags for cross-skill awareness
- [ ] 9.4 Verify that the sprint status summary display (in the "no ready-for-dev" output) uses the new schema sections rather than the flat map

### Task 10: Deployment verification (AC: 1)

- [ ] 10.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer
- [ ] 10.2 Verify the BMAD extension override exists at `_bmad/extensions/ma-agents-skills/skills/bmad-dev-story/` after deployment, containing all four files (`SKILL.md`, `workflow.md`, `checklist.md`, `bmad-skill-manifest.yaml`)
- [ ] 10.3 Verify the override takes precedence: the deployed `workflow.md` should contain cross-section search logic (references to `backlog` array and `sprints[].items`), NOT the flat `development_status` map
- [ ] 10.4 Verify `bmad-dev-story` appears in the BMAD module help output
- [ ] 10.5 Verify that NO `skills/bmad-dev-story/` directory exists in the IDE skill sources (`skills/` directory) -- confirming the IDE-skill-exclusion decision
- [ ] 10.6 Verify the built-in at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/` is UNTOUCHED

## Dev Notes

### CRITICAL: Extension Override for Built-in Skill (Read This First)

`bmad-dev-story` is a **BMAD built-in skill** shipped by `bmad-method` at `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/`. Per project policy (MEMORY: `feedback_bmad_builtin_override.md`), all changes to built-in skills MUST be done as extension overrides in `lib/bmad-extension/skills/`, never as upstream modifications.

The built-in contains **three files**:
1. `SKILL.md` -- thin entry point that delegates to `./workflow.md`
2. `workflow.md` -- main implementation (~450 lines, 10-step workflow with XML semantics)
3. `checklist.md` -- definition-of-done validation checklist

The extension override MUST provide replacements for ALL three files plus a `bmad-skill-manifest.yaml`. When `lib/bmad-extension/skills/` has a skill with the same name as a built-in, the extension takes precedence via the `--custom-content` deployment flag in `lib/bmad.js`.

### Why No IDE Skill

Unlike other Epic 17 skills (e.g., `generate-backlog`, `add-to-sprint`, `bmad-sprint-planning`) which perform discrete operations that any IDE agent can invoke, `bmad-dev-story` is an entire multi-step developer execution workflow that:

1. **Loads BMAD config** from `_bmad/bmm/config.yaml` (resolves `project_name`, `user_name`, `communication_language`, `user_skill_level`, etc.)
2. **Uses XML workflow semantics** (`<workflow>`, `<step>`, `<check>`, `<critical>`, `<goto>`, `<anchor>`) that are specific to the BMAD agent execution model
3. **Delegates to auxiliary files** (`./workflow.md`, `./checklist.md`) using BMAD's multi-file skill pattern
4. **Enforces BMAD execution directives** (no session pausing, continuous execution until HALT, red-green-refactor cycle)

Non-BMAD IDE agents (pure Claude Code, Cursor without BMAD, etc.) cannot execute this workflow format. The IDE skill pipeline (`lib/installer.js`) deploys flat `SKILL.md` files and does not support multi-file workflow delegation. Developers using non-BMAD agents would use `bmad-quick-dev` or implement stories manually.

### Scope of Changes -- Surgical, Not Full Rewrite

This is NOT a rewrite of the entire `bmad-dev-story` workflow. The developer execution workflow (task sequencing, red-green-refactor, definition of done, review continuation, etc.) remains unchanged. Only three aspects change:

1. **Story auto-discovery (Step 1):** Replace flat `development_status` key scan with cross-section search of `backlog` + `sprints[].items` arrays
2. **Status update to in-progress (Step 4):** Replace `development_status[key] = "in-progress"` with in-place update on the item object found by `id`
3. **Status update to review (Step 9):** Replace `development_status[key] = "review"` with in-place update on the item object found by `id`

Everything else in the 450-line workflow.md is preserved verbatim.

### Cross-Section Search Pattern

The search pattern is consistent with Story 17.19 (`story-status-lookup`):

```
function findItemById(sprintStatus, storyKey):
  // Search sprints first (active > planning; skip closed)
  for each sprint in sprints (sorted: active first, then planning):
    if sprint.status == "closed": skip
    for each item in sprint.items:
      if item.id == storyKey:
        return { item, location: "in {sprint-id}" }

  // Then search backlog
  for each item in backlog:
    if item.id == storyKey:
      return { item, location: "in backlog" }

  // Not found
  return null
```

For auto-discovery (Step 1), the search looks for `status: ready-for-dev` instead of matching by `id`. Active sprint items are prioritized over planning sprint items, which are prioritized over backlog items.

### In-Place Update Pattern

The status update follows the schema's in-place update rule (Section 6.2):

```
function updateItemStatus(sprintStatus, storyKey, newStatus):
  result = findItemById(sprintStatus, storyKey)
  if result is null:
    return checkDoneArchive(storyKey)  // fallback

  result.item.status = newStatus      // only status changes
  sprintStatus.last_updated = now()   // update timestamp
  writeFile(sprintStatus)             // atomic write, preserving all structure
```

### Workflow.md Change Points (Detailed)

**Step 1 (tag="sprint-status") -- Story Discovery:**
- CURRENT: Reads `development_status` section, iterates keys, uses regex to distinguish epics (`epic-X`) from stories (`N-M-name`), finds first `ready-for-dev`
- NEW: Reads full file, searches `sprints[].items` (active first, then planning) then `backlog` array for items with `status: ready-for-dev`
- PRESERVE: The `story_path` branch (explicit path), the non-sprint fallback (no `sprint-status.yaml`), the user prompting for options

**Step 4 (tag="sprint-status") -- Mark In-Progress:**
- CURRENT: `development_status[story_key] = "in-progress"`
- NEW: Find item by `id` across sections, update `status` in-place to `"in-progress"`, update `last_updated`
- PRESERVE: The `sprint_status` file existence check, the "already in-progress" detection, the "unexpected status" warning

**Step 9 (tag="sprint-status") -- Mark Review:**
- CURRENT: `development_status[story_key] = "review"`
- NEW: Find item by `id` across sections, update `status` in-place to `"review"`, update `last_updated`
- PRESERVE: The `sprint_status` file existence check, the "key not found" warning behavior, the "no sprint tracking" fallback

### Unified Schema Sections Touched

- **`backlog`** -- searched for story by `id`; `status` may be updated in-place
- **`sprints`** -- all sprint entries' `items` arrays are searched; `status` may be updated in-place
- **`epics`** -- NOT modified, but MUST be preserved during read-modify-write
- **Metadata** -- `last_updated` is updated on every write

### Reference Files

- **Built-in source:** `node_modules/bmad-method/src/bmm-skills/4-implementation/bmad-dev-story/` (SKILL.md, workflow.md, checklist.md)
- **Schema:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for sprint-status.yaml)
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Done archive:** `_bmad-output/implementation-artifacts/done/`
- **BMAD skill reference:** `lib/bmad-extension/skills/add-to-sprint/` (SKILL.md + bmad-skill-manifest.yaml pattern)
- **Built-in override reference:** Story 17.15 (`bmad-sprint-planning`) -- same override pattern for a BMAD built-in
- **Module help CSV:** `lib/bmad-extension/module-help.csv`

### Cross-References

- **Story 17.9** (prerequisite, done): Defines the unified `sprint-status.yaml` schema this skill operates on
- **Story 17.15** (parallel): `bmad-sprint-planning` -- same built-in override pattern; reference for how to structure the extension override with multiple files
- **Story 17.19** (parallel): `story-status-lookup` -- same cross-section search pattern for finding items by `id`
- **Story 17.14** (downstream): `cleanup-done` -- handles archival of done items after this skill might set status to done (though currently the workflow only sets `in-progress` and `review`)
- **Story 17.21** (downstream): `close-sprint` -- may also update item statuses during sprint closure

### PRD Traceability

- **FR135:** "Each item carries its own status field, updated in-place within the section where it resides" -- this is the core requirement being implemented. The status update in Steps 4 and 9 now operates on item objects within the unified schema rather than on flat map keys.
- **FR65:** "All sprint, backlog, and epic status data is managed in a single sprint-status.yaml" -- the skill now reads from and writes to the unified three-section file.
- **FR134:** "Each item carries a consistent structure (id, type, epic, title, priority, status, severity)" -- the cross-section search matches items by their `id` field and preserves all other fields during status update.

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- Unified Sprint-Status Data Architecture
- Architecture P2-5 in `_bmad-output/planning-artifacts/architecture.md` -- Pre-built Extension Workflows (deployment via `--custom-content`)
- Skill Integration Map in architecture doc -- `bmad-dev-story` is listed as "Moderate" rework, operating on `backlog:` or `sprints:` sections

### Gotchas and Warnings

1. **The workflow.md is large (~450 lines).** The override must be a complete copy with targeted edits to Steps 1, 4, and 9. Do NOT accidentally omit any steps or directives.
2. **XML workflow semantics** (`<workflow>`, `<step>`, `<check>`, `<critical>`, `<goto>`, `<anchor>`) must be preserved exactly. These are interpreted by the BMAD agent runtime.
3. **Step tags** (`tag="sprint-status"` on Steps 1, 4, 9) may be referenced by other skills for cross-skill awareness. Preserve these attributes.
4. **Review continuation logic** (Step 3) is unrelated to sprint-status and must be preserved unchanged.
5. **The checklist.md changes are minimal** -- only one line in the "Final Status Verification" section references sprint status format. All other items validate story implementation quality.
6. **Config variable resolution** (`{implementation_artifacts}`, `{sprint_status}`, etc.) must be preserved exactly as the built-in defines them.
7. **The `development_status` parsing in the current Step 1 uses key patterns to distinguish epics from stories.** The unified schema makes this distinction explicit via the `type` field on each item, so the pattern-matching logic is no longer needed and should be removed.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
