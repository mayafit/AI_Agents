---
name: cleanup-done
description: Archive done and cancelled items — remove from sprint-status.yaml and move story/bug files to done/ subfolder
type: skill
triggers:
  - "cleanup done"
  - "archive done items"
  - "clean up done"
---

# Cleanup Done

Archive done and cancelled items from `sprint-status.yaml` — remove them from the active file and move their story/bug `.md` files to the `done/` subfolder.

## Knowledge Store Binding Preflight

**Gateway check — run this before anything else in this skill.** Before any read, any write, any user prompt, and before any other routing or configuration step below. No other step of this skill executes until this preflight returns PROCEED.

`_bmad/bmm/config.yaml` is a GENERATED file. `ma-agents` derives it from the committed binding in `_bmad-output/project-layout.yaml` on install and on `ma-agents bind`, and records which binding it was generated from in its `project_layout_stamp:` field. If the binding has moved since — the usual cause is a `git pull` that relocated a knowledge store — every path this skill would resolve from `config.yaml` points at where the stores used to be. This preflight refuses to let that happen silently.

**This preflight is read-only.** Whatever it finds, do NOT regenerate, repair, edit or create `config.yaml`, `_bmad-output/project-layout.yaml`, or any other file, and do not offer to. Regenerating the config belongs to the installer and to `ma-agents bind`, never to a skill.

**Compare content, never timestamps.** Never decide staleness from file modification times: mtime ordering is not preserved by `git pull`, `git checkout` or a fresh clone, so it both misses real drift and reports drift on a clean checkout.

Work through the steps below IN ORDER and stop at the first branch that matches. The order is load-bearing — `_bmad-output/project-layout.yaml` is the fact, and the stamp only ever corroborates it.

### Step P1 — Read `_bmad-output/project-layout.yaml`

- **Missing, or present but blank / comments-only** → go to **Step P2**.
- **Present but not cleanly readable** — it is not valid YAML, it carries unresolved merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), it yields no readable fields, its `schema_version:` is greater than `2`, its `schema_version:` is present but is not a number, it names a `backend:` or a `mode:` this build does not recognise, or any store record in it cannot be read → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding cannot be read.**
  > `_bmad-output/project-layout.yaml` exists but this build cannot use it: {say exactly what is wrong}.
  > Every knowledge-store path in `_bmad/bmm/config.yaml` is derived from that file, so nothing this skill would resolve can be trusted. Fix the binding by hand — if this is a merge conflict, resolve it; the file is committed, so conflicts are ordinary — then run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from it.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  That list of faults is illustrative, not exhaustive. **Default-deny:** the only two ways out of this step without halting are "absent, or blank / comments-only" (→ Step P2) and "resolves cleanly" (→ Step P3). Anything else takes this HALT, including a fault not named above. Do not fall back to defaults and do not treat this as "no binding". A binding that cannot be read is a different fact from a project that has none.
- **Present and resolves cleanly** → go to **Step P3**.

### Step P2 — There is no committed binding

No `_bmad-output/project-layout.yaml`. That is the pre-F26 shape and by itself it is NOT drift — but corroborate it instead of trusting it, because "a binding was never written here" and "the binding was deleted, ignored, or not pulled" look identical from the missing file alone. Read `_bmad/bmm/config.yaml`:

- **`config.yaml` does not exist either** → **HALT** and report:

  > **ma-agents — stopping: this project is not configured.**
  > Neither `_bmad-output/project-layout.yaml` nor `_bmad/bmm/config.yaml` exists, so nothing states where this project's knowledge stores live. Run `npx ma-agents install` to configure the project, or `ma-agents bind` if ma-agents is already installed and only the binding is missing.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`config.yaml` exists and carries, at column 0, any of `project_layout_stamp:`, `system_requirements_path:` or `software_requirements_path:`** (a commented-out or indented one does not count — it is not the field) → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding is missing.**
  > `_bmad/bmm/config.yaml` carries {name the fields you found}, which only an F26 generation writes — so this project HAS been bound — but `_bmad-output/project-layout.yaml` is not here. The binding was deleted, is untracked or ignored, or has not been pulled. This is not a pre-F26 project, so proceeding would mean trusting generated paths against a binding that no longer exists.
  > Restore the file (for example `git checkout -- _bmad-output/project-layout.yaml`), or run `ma-agents bind` to write a fresh one.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  Those three fields are the discriminator and they are reliable: a genuine pre-F26 `config.yaml` carries none of them. Do not skip this check. An absent stamp on its own is never evidence that a project predates the stamp.

- **`config.yaml` exists and carries none of those three fields at column 0** → this is genuinely a pre-F26 project. **PROCEED** with the rest of this skill exactly as it behaved before F26, and say nothing at all about the binding — no warning, no prompt, no offer to bind. Nothing has moved, so there is nothing to re-bind. The existence of `config.yaml` is NOT on its own a reason to take this branch: all three fields must be absent.

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

The table below IS the whole comparison: every field named in its right-hand column is compared, and no field outside that column is. Read each field only from a line at column 0, and compare VALUES rather than bytes — the generator quotes its scalars (`sprint_backend: "jira"`, `knowledgebase_path: "."`), so strip one balanced pair of surrounding quotes from each side first.

| When | Binding record it is derived from | Field(s) it generates in `config.yaml` |
| --- | --- | --- |
| always | `software_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`); the artifacts field is that same path, except that a path of `.` gives `{project-root}/_bmad-output/planning-artifacts` | `software_requirements_path:`, `knowledgebase_path:`, `planning_artifacts:` |
| always | `system_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`) | `system_requirements_path:` |
| `sprint_management` has `mode: jira` | `sprint_management` → its `jira_url:` and `jira_project_key:`; the backend field is the literal `jira`; the artifacts field is always `{project-root}/_bmad-output/implementation-artifacts`, because a Jira sprint store has no path | `sprint_backend:`, `jira_url:`, `jira_project_key:`, `implementation_artifacts:` |
| `sprint_management` has any other mode | `sprint_management` → its `path:`; the backend field is the literal `file-system`; the artifacts field is that same path, except that a path of `.` gives `{project-root}/_bmad-output/implementation-artifacts` | `sprint_backend:`, `sprint_management_path:`, `implementation_artifacts:` |

**When the binding says `mode: jira`, `sprint_management_path:` is not compared at all.** The generator writes no `sprint_management_path:` in that mode — and it never DELETES a field, it only updates or appends one. So a project that was bound to the file system and later re-bound to Jira still carries its old `sprint_management_path:` line in a freshly generated `config.yaml`. That leftover line is not drift, and comparing it would halt every Jira project that was ever file-system-bound.

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

## Purpose

Keeps the active sprint view lean by archiving completed and cancelled work. Preserves story artifacts in `done/` for historical reference. Updates epic statuses when all stories for an epic have been archived.

**BMAD context:** Path resolution uses `story_location` from `sprint-status.yaml` metadata (or `_bmad-output/implementation-artifacts` as the default). The Scrum Master agent (`bmm-sm`) is the primary invoker of this skill.

---

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query all issues in project `{jira_project_key}` at `{jira_url}` with status Done/Resolved/Closed. For each such issue that maps to a local story file at `{story_location}/{id}.md`: transition the issue to the resolved/done Jira workflow state if not already there (using the issue transition API). Then move the local story file to `{story_location}/done/{id}.md` — this local file operation always executes regardless of backend. Note: Jira issues are NOT deleted; they remain in Jira as resolved.
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

<workflow>

<step n="0" goal="Load configuration and validate file existence">
  <action>Set default `story_location` = `_bmad-output/implementation-artifacts`. Check whether `{story_location}/sprint-status.yaml` exists at the default path.</action>
  <check if="file does not exist">
    <output>Error: No sprint-status.yaml found at `{story_location}/sprint-status.yaml`. Run `/bmad-sprint-planning` first to initialize the file.</output>
    <action>Exit — no changes made.</action>
  </check>
  <action>Read `{story_location}/sprint-status.yaml` and parse all sections: metadata, `epics`, `backlog`, `sprints`.</action>
  <action>If the parsed metadata contains a `story_location` field, update `story_location` to that value (allows the skill to resolve file paths correctly for non-default locations).</action>
  <action>Store parsed data as {{sprint_data}} with sub-objects: {{sprint_data.metadata}}, {{sprint_data.epics}}, {{sprint_data.backlog}}, {{sprint_data.sprints}}.</action>
</step>

<step n="1" goal="Scan all sections for archivable items">
  <action>Initialize {{archivable_items}} = [] (empty list).</action>

  <action>Scan the `backlog` array: for each item where `status` is `done` or `cancelled`, add to {{archivable_items}} with source = "backlog".</action>

  <action>Scan ALL sprints in the `sprints` map — including sprints with `status: closed` (schema section 6.7 explicitly permits cleanup-done to archive items from closed sprints):
    For each sprint key (e.g., `sprint-1`, `sprint-2`):
      For each item in sprint's `items` array:
        If item's `status` is `done` or `cancelled`:
          Add to {{archivable_items}} with source = "{sprint_key} ({sprint_name})"
  </action>

  <check if="archivable_items is empty">
    <output>No done or cancelled items found. Nothing to clean up.</output>
    <action>Exit — no changes made.</action>
  </check>
</step>

<step n="2" goal="Display archivable items and confirm">
  <action>Count done vs cancelled: {{done_count}} = items where status = "done", {{cancelled_count}} = items where status = "cancelled".</action>
  <output>
## Items to Archive

| # | ID | Title | Type | Status | Source |
|---|----|----|------|--------|--------|
{{#each archivable_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{status}} | {{source}} |
{{/each}}

**Found {{archivable_items.length}} items to archive ({{done_count}} done, {{cancelled_count}} cancelled).**
  </output>

  <ask>Options:
- [c] Confirm and archive all listed items
- [s] Select specific items (enter numbers, e.g. 1,3,5)
- [x] Cancel without changes

Choice:</ask>

  <check if="user selects 'x'">
    <output>Cancelled — no changes made.</output>
    <action>Exit.</action>
  </check>

  <check if="user selects 's'">
    <ask>Enter item numbers to archive (comma-separated):</ask>
    <action>Filter {{archivable_items}} to only the items matching the user's selection. Store as {{confirmed_items}}.</action>
  </check>

  <check if="user selects 'c'">
    <action>Set {{confirmed_items}} = {{archivable_items}} (all items).</action>
  </check>
</step>

<step n="3" goal="Archive story/bug files">
  <action>Ensure `{story_location}/done/` directory exists. Create it if it does not exist.</action>
  <action>Initialize {{files_moved}} = [], {{files_skipped_missing}} = [], {{files_skipped_exists}} = [].</action>

  <action>For each item in {{confirmed_items}}:
    1. Resolve source path: `{story_location}/{item.id}.md`
       - For bug items, also try `{story_location}/bug-{slug}.md` and `{story_location}/BUG-{slug}.md` as fallbacks if the primary path does not exist (where {slug} is derived from the id by removing any leading BUG- or bug- prefix, lowercased).
    2. Resolve destination path: `{story_location}/done/{item.id}.md`

    3. If no source file exists at any resolved path:
       - Log warning: "File not found: {resolved_path} — skipping file move."
       - Add to {{files_skipped_missing}}.
       - Continue to next item (YAML removal proceeds regardless).

    4. If destination file already exists:
       - Log warning: "File already exists at destination: {destination_path} — skipping file move."
       - Add to {{files_skipped_exists}}.
       - Continue to next item (YAML removal proceeds regardless).

    5. Move (rename) the source file to the destination path.
       Use a move/rename operation (not copy+delete) to preserve git history.
       Add {from: source_path, to: destination_path} to {{files_moved}}.
  </action>
</step>

<step n="4" goal="Remove archived items from sprint-status.yaml">
  <action>For each item in {{confirmed_items}}:
    - If item's source is "backlog": remove the item object from {{sprint_data.backlog}} array.
    - If item's source is a sprint (e.g., "sprint-1 (Sprint Name)"): extract the sprint key from the source string (the part before the space and parenthesis, e.g., "sprint-1"), then remove the item object from that sprint's `items` array in {{sprint_data.sprints}}.
  </action>

  <action>Track whether any backlog items were removed. If yes: renumber remaining backlog items' `priority` values sequentially starting at 1 to match their new array positions (priority[0] = 1, priority[1] = 2, ..., priority[N-1] = N). Store the count of remaining backlog items as {{backlog_items_renumbered}} (0 if no backlog items were removed). This keeps the `priority` field in sync with array position per schema section 3.3.</action>
</step>

<step n="5" goal="Update epic statuses">
  <action>For each epic in {{sprint_data.epics}} where epic's current `status` is `in-progress`:
    1. Determine the epic number N from the key (e.g., `epic-5` → N = 5).
    2. Check if ANY items with `epic: N` remain in:
       a. {{sprint_data.backlog}} (after removal in Step 4)
       b. Any sprint's `items` array in {{sprint_data.sprints}} (after removal in Step 4)
    3. Also verify that at least one item for this epic was archived now or previously exists in `{story_location}/done/` (to guard against marking an epic done that never had stories — epics with zero items anywhere should NOT be auto-marked done unless there are archived stories for them).
    4. If no remaining items for this epic exist in backlog or any sprint, AND at least one archived item exists for this epic: update the epic's `status` to `done`.
    5. Record which epics were transitioned to `done` in {{epics_marked_done}}.
  </action>
</step>

<step n="6" goal="Detect empty active sprints">
  <action>After item removal (Step 4), check each sprint that had items removed from its `items` array:
    - If the sprint's `items` array is now empty AND the sprint's `status` is `active`:
      - Add to {{empty_active_sprints}} list with sprint name.
  </action>
</step>

<step n="7" goal="Atomic write to sprint-status.yaml">
  <action>Update {{sprint_data.metadata.last_updated}} to the current ISO-8601 date (YYYY-MM-DD). Preserve {{sprint_data.metadata.generated}} unchanged.</action>
  <action>Write the complete updated `sprint-status.yaml` in a single write operation, incorporating:
    - All item removals from sprint `items` arrays (Step 4)
    - All item removals from `backlog` array (Step 4)
    - Backlog priority renumbering (Step 4)
    - Epic status updates (Step 5)
    - Updated `last_updated` metadata (this step)
    - All sections NOT modified pass through unchanged.
  </action>
</step>

<step n="8" goal="Display summary output">
  <output>
## Cleanup Complete

### Items Archived ({{confirmed_items.length}})

| ID | Title | Type | Status | Source |
|----|-------|------|--------|--------|
{{#each confirmed_items}}
| {{id}} | {{title}} | {{type}} | {{status}} | {{source}} |
{{/each}}

### Files Moved ({{files_moved.length}})

{{#each files_moved}}
- `{{from}}` → `{{to}}`
{{/each}}

{{#if files_skipped_missing.length > 0}}
### Warnings — Files Not Found (skipped, YAML still cleaned up)

{{#each files_skipped_missing}}
- File not found: `{{this}}` — skipping file move.
{{/each}}
{{/if}}

{{#if files_skipped_exists.length > 0}}
### Warnings — Destination Already Exists (skipped, YAML still cleaned up)

{{#each files_skipped_exists}}
- File already exists at destination: `{{this}}` — skipping file move.
{{/each}}
{{/if}}

{{#if backlog_items_renumbered > 0}}
### Backlog Renumbered

{{backlog_items_renumbered}} remaining backlog items renumbered (priorities 1..{{backlog_items_renumbered}}).
{{/if}}

{{#if epics_marked_done.length > 0}}
### Epics Marked Done

{{#each epics_marked_done}}
- **{{this}}** — all stories archived; epic status updated to `done`.
{{/each}}
{{/if}}

{{#if empty_active_sprints.length > 0}}
### Suggestion

{{#each empty_active_sprints}}
Sprint **{{this}}** has no remaining items. Consider running `/close-sprint` to close it.
{{/each}}
{{/if}}

**Next steps:** `/sprint-status-view` to review the updated sprint | `/close-sprint` if a sprint is empty | `/generate-backlog` to refresh the backlog
  </output>
</step>

</workflow>
