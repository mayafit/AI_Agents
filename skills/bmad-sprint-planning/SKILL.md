---
name: bmad-sprint-planning
description: 'Bootstrap or update the unified sprint-status.yaml from epics. Creates the file with three sections (epics, backlog, sprints) on first run; refreshes epics and adds new items on subsequent runs.'
---

# Sprint Planning Skill

**Goal:** Bootstrap or refresh the unified `sprint-status.yaml` from epics, building a complete three-section file (`epics`, `backlog`, `sprints`).

**Your Role:** You are a Scrum Master bootstrapping or refreshing sprint tracking. Parse epic files, scan bugs, detect story statuses, and produce or update a structured `sprint-status.yaml` with the unified schema.

---

## INITIALIZATION

### Path Resolution

Resolve project root as the directory containing `_bmad-output/`. Then set:

- `implementation_artifacts` = `_bmad-output/implementation-artifacts`
- `planning_artifacts` = `_bmad-output/planning-artifacts`
- `status_file` = `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `done_folder` = `_bmad-output/implementation-artifacts/done/`
- `story_location` = `_bmad-output/implementation-artifacts`

Attempt to read project name from `_bmad/bmm/config.yaml` (field `project_name`). If the file does not exist or `project_name` is absent, derive project name from the root directory name or use `"Unknown Project"`.

---

## Knowledge Store Binding Preflight

**Gateway check — run this before anything else in this skill.** Before any read, any write, any user prompt, and before any other routing or configuration step below. No other step of this skill executes until this preflight returns PROCEED.

`_bmad/bmm/config.yaml` is a GENERATED file. `ma-agents` derives it from the committed binding in `_bmad-output/project-layout.yaml` on install and on `ma-agents bind`, and records which binding it was generated from in its `project_layout_stamp:` field. If the binding has moved since — the usual cause is a `git pull` that relocated a knowledge store — every path this skill would resolve from `config.yaml` points at where the stores used to be. This preflight refuses to let that happen silently.

**This preflight is read-only.** Whatever it finds, do NOT regenerate, repair, edit or create `config.yaml`, `_bmad-output/project-layout.yaml`, or any other file, and do not offer to. Regenerating the config belongs to the installer and to `ma-agents bind`, never to a skill.

**Compare content, never timestamps.** Never decide staleness from file modification times: mtime ordering is not preserved by `git pull`, `git checkout` or a fresh clone, so it both misses real drift and reports drift on a clean checkout.

Work through the steps below IN ORDER and stop at the first branch that matches. The order is load-bearing — `_bmad-output/project-layout.yaml` is the fact, and the stamp only ever corroborates it.

### Step P1 — Read `_bmad-output/project-layout.yaml`

- **Missing, or present but blank / comments-only** → go to **Step P2**.
- **Present but unusable** — not valid YAML, unresolved merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), no readable fields, or a `schema_version:` greater than `2` → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding cannot be read.**
  > `_bmad-output/project-layout.yaml` exists but this build cannot use it: {say exactly what is wrong}.
  > Every knowledge-store path in `_bmad/bmm/config.yaml` is derived from that file, so nothing this skill would resolve can be trusted. Fix the binding by hand — if this is a merge conflict, resolve it; the file is committed, so conflicts are ordinary — then run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from it.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  Do not fall back to defaults and do not treat this as "no binding". A binding that cannot be read is a different fact from a project that has none.
- **Present and readable** → go to **Step P3**.

### Step P2 — There is no committed binding

No `_bmad-output/project-layout.yaml`. That is the pre-F26 shape and by itself it is NOT drift — but corroborate it instead of trusting it, because "a binding was never written here" and "the binding was deleted, ignored, or not pulled" look identical from the missing file alone. Read `_bmad/bmm/config.yaml`:

- **`config.yaml` does not exist either** → **HALT** and report:

  > **ma-agents — stopping: this project is not configured.**
  > Neither `_bmad-output/project-layout.yaml` nor `_bmad/bmm/config.yaml` exists, so nothing states where this project's knowledge stores live. Run `npx ma-agents install` to configure the project, or `ma-agents bind` if ma-agents is already installed and only the binding is missing.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`config.yaml` exists and contains any of `project_layout_stamp:`, `system_requirements_path:` or `software_requirements_path:`** → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding is missing.**
  > `_bmad/bmm/config.yaml` carries {name the fields you found}, which only an F26 generation writes — so this project HAS been bound — but `_bmad-output/project-layout.yaml` is not here. The binding was deleted, is untracked or ignored, or has not been pulled. This is not a pre-F26 project, so proceeding would mean trusting generated paths against a binding that no longer exists.
  > Restore the file (for example `git checkout -- _bmad-output/project-layout.yaml`), or run `ma-agents bind` to write a fresh one.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  Those three fields are the discriminator and they are reliable: a genuine pre-F26 `config.yaml` carries none of them. Do not skip this check. An absent stamp on its own is never evidence that a project predates the stamp.

- **`config.yaml` exists and carries none of those three fields** → this is genuinely a pre-F26 project. **PROCEED** with the rest of this skill exactly as it behaved before F26, and say nothing at all about the binding — no warning, no prompt, no offer to bind. Nothing has moved, so there is nothing to re-bind.

### Step P3 — The binding is readable: check what `config.yaml` was generated from

Read `_bmad/bmm/config.yaml`.

- **`config.yaml` does not exist** → **HALT** and report:

  > **ma-agents — stopping: the generated config is missing.**
  > `_bmad-output/project-layout.yaml` commits this project's knowledge binding, but `_bmad/bmm/config.yaml` — the file this skill resolves its paths from — has never been generated from it. Run `npx ma-agents install` to install into this project, or `ma-agents bind` if ma-agents is already installed, to generate `_bmad/bmm/config.yaml` from the committed binding.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **No `project_layout_stamp:` line at column 0 of `config.yaml`** (a commented-out or indented one does not count — it is not the field) → **HALT** and report:

  > **ma-agents — stopping: `_bmad/bmm/config.yaml` does not record which binding it came from.**
  > `_bmad-output/project-layout.yaml` exists, but `config.yaml` carries no `project_layout_stamp:`, so there is no evidence its paths were generated from the committed binding. Run `ma-agents bind` to regenerate it.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`project_layout_stamp:` is present but its value is not `sha256:` followed by exactly 64 lowercase hexadecimal characters** — truncated, uppercased, a different algorithm, unbalanced quotes, or trailing content after the digest → **HALT** and report:

  > **ma-agents — stopping: `_bmad/bmm/config.yaml` claims to have been generated and the claim cannot be read.**
  > Its `project_layout_stamp:` is {quote the value you found}, which is not a stamp ma-agents wrote (expected `sha256:` followed by 64 lowercase hex characters) — merge damage, a hand-edit, or a truncated write. Treat this config as unverified; it is NOT a config that predates the stamp. Run `ma-agents bind` to regenerate it from `_bmad-output/project-layout.yaml`.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`project_layout_stamp:` is well-formed** → go to **Step P4**.

### Step P4 — Compare the committed binding against the generated fields

Derive, from `_bmad-output/project-layout.yaml`, what each generated field in `config.yaml` WOULD be if it were regenerated right now, and compare it to what `config.yaml` actually carries. This is a content comparison of the two files — never a timestamp comparison.

A schema-2 binding holds three records: `system_requirements_store:`, `software_requirements_store:` and `sprint_management:`. A legacy schema-1 binding holds a single `knowledgebase:` record, which stands for BOTH requirement stores.

| Derived from the binding | Field it generates in `config.yaml` |
| --- | --- |
| `software_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`) | `software_requirements_path:` and `knowledgebase_path:` |
| `system_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`) | `system_requirements_path:` |
| `sprint_management` with `mode: jira` | `sprint_backend: jira`, `jira_url:`, `jira_project_key:` — and no `sprint_management_path:` |
| `sprint_management` with any other mode → its `path:` | `sprint_backend: file-system` and `sprint_management_path:` |
| software store path is `.` | `planning_artifacts: {project-root}/_bmad-output/planning-artifacts` — otherwise `planning_artifacts:` equals that path |
| sprint path is `.` | `implementation_artifacts: {project-root}/_bmad-output/implementation-artifacts` — otherwise `implementation_artifacts:` equals that path |

**Any disagreement is drift** → **HALT** and report, naming every store that moved and both of its paths:

> **ma-agents — stopping: `_bmad/bmm/config.yaml` is stale.**
> The committed binding in `_bmad-output/project-layout.yaml` no longer matches the state `_bmad/bmm/config.yaml` was generated from:
> - {store name}: was `{path in config.yaml}`, is now `{path in project-layout.yaml}`
> (one line per store that moved)
> Running this skill now would read and write artifacts where those stores used to be. Run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from the committed binding, then run this skill again.
> Nothing has been read or written on your behalf. Stopping rather than guessing.

**If everything in the table agrees** → go to **Step P5**.

The stamp covers binding state that `config.yaml` does not carry — a store's `backend:`, a Confluence `space_key:` or `root_page:`, a `gitUrl:` — so the table alone cannot see every kind of move. If, and only if, a command shell is available to you and `ma-agents` resolves as a local dependency of this project, you may confirm the comparison exactly, without parsing the stamp yourself:

```bash
node -e "const c=require('ma-agents/bin/cli.js'),f=require('fs'),p=process.cwd();const t=c.resolveProjectTopology(p);if(!t.ok){console.log('binding:'+t.reason)}else{const s=c.readProjectLayoutStamp(f.readFileSync('_bmad/bmm/config.yaml','utf8'));console.log(s.ok?(s.value===c.computeProjectLayoutStamp(t.topology,p)?'MATCH':'DRIFT'):'stamp:'+s.reason)}"
```

`DRIFT` is authoritative: HALT with the stale-config message above even when the table found nothing, and say that the binding changed in a way `config.yaml` does not record. Never treat a failure to run this command as a result — if it does not run, the table is the check, and you say nothing about the stamp.

### Step P5 — PROCEED

The generated config matches the committed binding. Say NOTHING about the binding, the stamp or this preflight — a matched project gets no message — and continue with the rest of this skill.

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   > "This operation will create/update Jira sprints and items in bulk. If it fails mid-way, Jira may be in partial state. The Jira server URL is `{jira_url}` and project key is `{jira_project_key}` (from `_bmad/bmm/config.yaml`). Proceed?"

   a. Perform the Jira operation: Query all epics, backlog issues, sprint definitions, and sprint items for project `{jira_project_key}` at `{jira_url}` (multiple sequential read calls). For the write phase: create new Jira sprints for each sprint definition not already in Jira (one API call per sprint). Create or update Jira issues for each item in the plan (one API call per item). Map item fields as follows: title → issue summary, type → issue type (story → Story, bug → Bug), status → Jira workflow status (see status mapping below), priority → issue priority/rank. Map sprint fields: name → sprint name, start_date → sprint start date, end_date → sprint end date. Status mapping: backlog → Backlog/Open, ready-for-dev → To Do/Selected for Development, in-progress → In Progress, review → In Review/Code Review, done → Done/Resolved, on-hold → On Hold/Blocked, cancelled → Won't Do/Cancelled.
      Use whatever Jira-capable tool is available in your current tool context.
      Map Jira entities to the canonical schema (Sprint → sprints[], Backlog → backlog[],
      Epic → epics[], Jira status → canonical vocabulary per Section 6.3 of the routing spec).
   b. If the Jira operation SUCCEEDS: continue with the Jira data returned. Jira is the source of truth.
   c. If the Jira operation FAILS for any reason:
      - If no Jira-capable tool is available in your current context:
        Pause and present the user with:
        > "No Jira-capable tool is available. To use Jira tracking, configure a Jira integration
        > in your agent (an MCP server, plugin, or native integration connected to the Jira
        > instance at `{jira_url}`). How would you like to proceed?
        > (a) Retry — attempt the Jira operation again once a Jira tool is configured
        > (b) Switch to file management — update sprint-status.yaml and config to use
        >     file-system backend, then complete this operation locally. This change is permanent."
      - If a Jira tool attempted the operation but returned an error:
        Pause and present the user with:
        > "The Jira operation failed: {actual Jira error details}. How would you like to proceed?
        > (a) Retry — attempt the Jira operation again
        > (b) Switch to file management — update sprint-status.yaml and config to use
        >     file-system backend, then complete this operation locally. This change is permanent."
      If user chooses (b) in either case: write `tracking_system: file-system` to `sprint-status.yaml`,
      update `sprint_backend: file-system` in `_bmad/bmm/config.yaml`,
      then proceed with **File-System Backend** instructions below.

4. **File-System Backend** — execute the workflow steps below.

---

## EXECUTION

<workflow>

<step n="1" goal="Parse epic files and extract all work items">

**Epic Discovery Process:**

1. Search for whole document first — look for `epics.md`, `bmm-epics.md`, or any `*epic*.md` file in `_bmad-output/planning-artifacts/`
2. If whole document not found, look for `_bmad-output/planning-artifacts/epics/index.md` (sharded version)
3. If sharded version found: read `index.md` then read ALL referenced epic section files
4. If both exist, use the whole document

<action>For each epic file found, extract:</action>

- Epic numbers from headers like `## Epic 1:` or `## Epic 2:`
- Story IDs and titles from patterns like `### Story 1.1: User Authentication`
- Epic status cues from narrative text:
  - "in progress", "started", "active" → `in-progress`
  - "on hold", "paused", "blocked" → `on-hold`
  - "cancelled", "dropped" → `cancelled`
  - default → `backlog`

**Story ID Conversion Rules:**

- Original: `### Story 1.1: User Authentication`
- Replace period with dash: `1-1`
- Convert title to kebab-case: `user-authentication`
- Final ID: `1-1-user-authentication`

<action>Build:
  - `{{all_epics}}` — list of epic objects: `epic_num`, `title`, `detected_status`
  - `{{all_stories}}` — list of story objects: `id`, `epic_num`, `title`
</action>
</step>

<step n="2" goal="Scan bug files">
<action>Glob `_bmad-output/implementation-artifacts/bug-*.md` to find all bug story files</action>
<check if="no bug files found">
  <action>Set `{{all_bugs}}` = []</action>
</check>
<check if="bug files found">
  <action>For each bug file, parse YAML frontmatter to extract: `title`, `severity`, `status`</action>
  <action>Derive bug ID: strip `bug-` prefix and `.md` extension, then prefix with `BUG-` (e.g., `bug-path-spaces.md` → `BUG-path-spaces`)</action>
  <action>Set `{{all_bugs}}` = list of bug objects: `id`, `title`, `severity` (default `medium`), `status` (default `backlog`)</action>
</check>
</step>

<step n="3" goal="Mode detection — bootstrap vs refresh">
<check if="`_bmad-output/implementation-artifacts/sprint-status.yaml` does NOT exist">
  <action>Set `{{mode}}` = `bootstrap`</action>
  <action>Proceed to Step 4 then Step 5</action>
</check>
<check if="`_bmad-output/implementation-artifacts/sprint-status.yaml` EXISTS">
  <action>Set `{{mode}}` = `refresh`</action>
  <action>Read existing file into `{{existing_file}}`</action>
  <action>Proceed to Step 4 then Step 6</action>
</check>
</step>

<step n="4" goal="Done exclusion scan">
<action>Scan `_bmad-output/implementation-artifacts/done/` for archived files. Build `{{done_item_ids}}` = set of basenames (without `.md`) from all files in the done folder</action>
<check if="`{{mode}}` == `refresh`">
  <action>Scan `{{existing_file}}` for items with `status: done` in `backlog` or any `sprints[*].items`</action>
  <check if="any done items found in backlog or sprints">
    <output>
## Warning: Done Items Detected in Active File

The following items have `status: done` but are still present in the active `sprint-status.yaml`:

{{#each done_items_in_file}}
- `{{id}}` (in: {{location}})
{{/each}}

These items should be archived before adding new items. Consider running `cleanup-done` to archive them first.

Continuing with planning — done items will be excluded from new additions.
    </output>
    <action>Add these IDs to `{{done_item_ids}}`</action>
  </check>
</check>
</step>

<step n="5" goal="Bootstrap mode — build complete file from scratch">
<check if="`{{mode}}` != `bootstrap`">
  <action>Skip this step</action>
</check>

**Build metadata:**
- `generated` = current ISO-8601 datetime
- `last_updated` = current ISO-8601 datetime
- `project` = resolved project name
- `project_key` = `NOKEY`
- `tracking_system` = `file-system`
- `story_location` = `_bmad-output/implementation-artifacts`

**Build `epics` section:**
<action>For each epic in `{{all_epics}}`:
  - Key: `epic-{epic_num}`
  - `status`: use detected status from epic narrative, default `backlog`
  - `retrospective`: `optional`
</action>

**Build `backlog` section:**
<action>Combine `{{all_stories}}` and `{{all_bugs}}` into candidate list, excluding any IDs in `{{done_item_ids}}`</action>
<action>For each story candidate:
  - Detect status: check if `_bmad-output/implementation-artifacts/{story_id}.md` exists → `ready-for-dev`; else → `backlog`
</action>

**Ordering rules for initial priority:**
1. Bugs with `severity: critical` — first (highest priority)
2. Stories in epic order, then story number within each epic
3. Remaining bugs (`high`, `medium`, `low`) — after stories

<action>Assign sequential `priority` values (1, 2, 3...) based on ordering</action>

**Build each backlog item:**
```
id:       story ID (e.g., "1-1-user-auth") or bug ID (e.g., "BUG-path-spaces")
type:     "story" or "bug"
epic:     epic number as integer for stories, null for bugs
title:    story/bug title
priority: sequential integer (1 = highest)
status:   detected status for stories; "backlog" for bugs (or from frontmatter)
severity: null for stories; value for bugs
```

**`sprints` section:** empty map `{}`

<action>Write complete `sprint-status.yaml` to `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
</step>

<step n="6" goal="Refresh mode — additive merge">
<check if="`{{mode}}` != `refresh`">
  <action>Skip this step</action>
</check>

<action>From `{{existing_file}}` extract:
  - `generated` timestamp (preserve — never change)
  - existing `epics` map
  - existing `backlog` array
  - existing `sprints` map
</action>

**Regenerate `epics` section with status preservation:**
<action>For each epic in `{{all_epics}}`:
  - If epic already exists in existing file: apply never-downgrade rule for `status`; preserve existing `retrospective`
  - If epic is NEW: use detected status (default `backlog`), `retrospective: optional`
</action>

**Never-downgrade status rules:**
- `done` → keep `done` (no downgrade)
- `in-progress` + detected `backlog` → keep `in-progress`
- `on-hold` → keep `on-hold` (sticky)
- `cancelled` → keep `cancelled` (terminal)
- Otherwise → use detected status

**Build exclusion sets:**
- `{{existing_backlog_ids}}` = all `id` values in existing `backlog` array
- `{{sprint_item_ids}}` = all `id` values in any `sprints[*].items` arrays
- `{{excluded_ids}}` = union of above + `{{done_item_ids}}`

**Find new items to append:**
<action>From `{{all_stories}}` and `{{all_bugs}}`, identify items whose ID is NOT in `{{excluded_ids}}`</action>

**Append new items:**
<action>Calculate `{{max_priority}}` = max `priority` in existing backlog (0 if empty)</action>
<action>For each new item (stories in epic order first, then bugs):
  - `priority` = `{{max_priority}}` + sequential increment
  - For stories: detect status from file existence
  - For bugs: use frontmatter status or default `backlog`
</action>

**Final file:**
- `backlog` = existing items (unchanged) + new items (appended)
- `sprints` = existing sprints (unchanged — pass through exactly)
- `epics` = regenerated (with preservation)
- `last_updated` = current ISO-8601 datetime
- `generated` = original value (NEVER change)

<action>Write updated file (atomic read-modify-write)</action>
</step>

<step n="7" goal="Validation">
<action>Validate the written file:</action>

- [ ] File is valid YAML syntax
- [ ] 6 metadata fields present: `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`
- [ ] 3 data sections: `epics`, `backlog`, `sprints`
- [ ] No `development_status` section (old flat format must not appear)
- [ ] Every epic in source files appears in `epics` section
- [ ] Every story appears in exactly one location (backlog, sprint, or done/)
- [ ] No item ID in more than one active location (single-location invariant)
- [ ] All `status` values are legal (epic: backlog/in-progress/done/on-hold/cancelled; item: backlog/ready-for-dev/in-progress/review/done/on-hold/cancelled)
- [ ] Backlog `priority` values are sequential 1..N
- [ ] `sprints` section unchanged (refresh mode)
- [ ] `generated` timestamp unchanged (refresh mode)

<check if="validation errors found">
  <output>
## Validation Errors

{{#each validation_errors}}
- {{message}}
{{/each}}

Please review `_bmad-output/implementation-artifacts/sprint-status.yaml` and correct the issues.
  </output>
</check>
</step>

<step n="8" goal="Report summary">
<output>
## Sprint Planning Complete

**Mode:** {{mode}} ({{#if bootstrap}}first run — file created{{else}}refresh — file updated{{/if}})
**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Summary

| Section | Count |
|---------|-------|
| Total epics | {{epic_count}} |
| Total stories | {{story_count}} |
| Total bugs | {{bug_count}} |
{{#if refresh}}
| New items added | {{new_items_count}} |
| Items preserved (backlog) | {{preserved_backlog_count}} |
| Items excluded (sprint-assigned) | {{sprint_assigned_count}} |
| Items excluded (done-archived) | {{done_archived_count}} |
{{/if}}

### Epic Status Overview

| Epic | Title | Status |
|------|-------|--------|
{{#each epics_summary}}
| `{{id}}` | {{title}} | {{status}} |
{{/each}}

### Next Steps

1. Review the generated `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. Run `generate-backlog` to refresh and reprioritize backlog items
3. Run `add-sprint` to create a sprint for the next iteration
4. Run `add-to-sprint` to assign backlog items to a sprint
</output>
</step>

</workflow>

---

## Additional Documentation

### Status State Machines

**Epic Status Flow:**
```
backlog → in-progress → done
              ↕
           on-hold

Any non-done → cancelled (terminal)
```

**Story/Bug Status Flow:**
```
backlog → ready-for-dev → in-progress → review → done
               ↕              ↕           ↕
            on-hold        on-hold      on-hold

Any non-done → cancelled (terminal)
```

### Three-Section Schema Summary

```yaml
epics:        # Map keyed by epic-N — regenerated each run with preservation
backlog:      # Array of items — additive only (new items appended, existing preserved)
sprints:      # Map keyed by sprint-N — NEVER modified by this skill
```

### Never-Downgrade Rule

Status is never downgraded on refresh. If the existing file says `in-progress`, a re-detected `backlog` from the epic file does NOT override it. This ensures human-set statuses are preserved across planning runs.

### Schema Quick Reference

**Backlog item fields:** `id`, `type`, `epic`, `title`, `priority`, `status`, `severity`
**Sprint item fields:** `id`, `type`, `epic`, `title`, `status`, `severity` (no `priority`)
**Epic fields:** `status`, `retrospective`
