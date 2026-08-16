# Remove-from-Sprint Skill

Guided workflow to move sprint items back to the backlog in the unified `sprint-status.yaml` using reverse movement semantics (inverse of `add-to-sprint`).

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
| software store path is `.` | `planning_artifacts: _bmad-output/planning-artifacts` — otherwise `planning_artifacts:` equals that path |
| sprint path is `.` | `implementation_artifacts: _bmad-output/implementation-artifacts` — otherwise `implementation_artifacts:` equals that path |

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
   a. Perform the Jira operation: Find the Jira issue matching the item ID in project `{jira_project_key}` at `{jira_url}` (search by issue key or summary). Remove the issue from its current sprint using the "remove issue from sprint" operation, returning it to the board backlog.
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
  <action>Read `_bmad-output/implementation-artifacts/sprint-status.yaml` — the unified single source of truth for sprint and backlog state</action>
  <check if="file does not exist">
    <output>No sprint-status.yaml found. Run sprint planning first to initialize the file.</output>
    <action>Exit workflow</action>
  </check>
  <action>Parse the full file: metadata fields (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`), `epics` section, `backlog` array, and `sprints` map</action>
  <action>Store parsed data as {{sprint_file}}</action>
</step>

<step n="1" goal="Identify sprints with removable items">
  <action>Scan the `sprints` map in {{sprint_file}}. For each sprint entry, check if its `items` array has at least one element.</action>
  <action>Build {{sprints_with_items}} = list of sprints where `items` is non-empty, ordered by sprint key (sprint-1, sprint-2, …)</action>
  <check if="{{sprints_with_items}} is empty">
    <output>No sprints with assigned items found. Nothing to remove.</output>
    <action>Exit workflow</action>
  </check>
  <check if="exactly one sprint has items">
    <action>Auto-select that sprint. Store as {{selected_sprint_id}} and {{selected_sprint}}</action>
    <output>Auto-selected the only sprint with items: **{{selected_sprint.name}}** ({{selected_sprint.status}})</output>
  </check>
  <check if="multiple sprints have items">
    <output>
## Sprints with Assigned Items

| # | Sprint ID | Name | Status | Capacity | Items |
|---|-----------|------|--------|----------|-------|
{{#each sprints_with_items}}
| {{@index+1}} | {{id}} | {{name}} | {{status}} | {{capacity}} | {{items.length}} |
{{/each}}
    </output>
    <ask>Select sprint to remove items from (enter number):</ask>
    <action>Store selected sprint as {{selected_sprint_id}} and {{selected_sprint}}</action>
  </check>
  <check if="selected_sprint.status == 'closed'">
    <output>Cannot remove items from a closed sprint. Closed sprints are immutable (schema section 6.7). Use `/close-sprint` or `/cleanup-done` to disposition items in closed sprints.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="2" goal="Display sprint items and identify eligible items for removal">
  <action>Read {{selected_sprint.items}} array</action>
  <action>Partition items into two groups:
    - {{ineligible_items}} = items where `status` is `done` or `cancelled`
    - {{eligible_items}} = all other items (status: ready-for-dev, in-progress, review, on-hold, backlog)
  </action>
  <check if="{{ineligible_items}} is non-empty">
    <output>
> **Note:** {{ineligible_items.length}} done/cancelled item(s) cannot be removed. Use `/cleanup-done` or `/close-sprint` to archive them.
>
> Ineligible items: {{#each ineligible_items}}{{id}} ({{status}}){{#unless @last}}, {{/unless}}{{/each}}
    </output>
  </check>
  <check if="{{eligible_items}} is empty">
    <output>All items in **{{selected_sprint.name}}** are done or cancelled. Use `/cleanup-done` or `/close-sprint` to archive them.</output>
    <action>Exit workflow</action>
  </check>
  <output>
## Items in {{selected_sprint.name}} — Eligible for Removal

| # | ID | Title | Type | Epic | Status | Severity |
|---|----|-------|------|------|--------|----------|
{{#each eligible_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{epic ?? "—"}} | {{status}} | {{severity ?? "—"}} |
{{/each}}

*Sprint capacity: {{selected_sprint.items.length}}/{{selected_sprint.capacity}}*
  </output>
</step>

<step n="3" goal="Select items to remove">
  <ask>Which items do you want to remove from the sprint? Enter item numbers (comma-separated) or "all" to remove all eligible items:</ask>
  <check if="user enters 'all'">
    <action>Set {{items_to_remove}} = all items in {{eligible_items}}</action>
  </check>
  <check if="user enters item numbers">
    <action>Resolve entered numbers against the eligible_items table. Validate all numbers are in range.</action>
    <check if="any number is out of range">
      <output>Invalid selection: number(s) out of range. Please enter valid item numbers from the table above.</output>
      <goto step="3" />
    </check>
    <action>Set {{items_to_remove}} = items at the specified positions in {{eligible_items}}</action>
  </check>
</step>

<step n="4" goal="Confirmation — warn about status resets">
  <output>
## Confirm Removal from {{selected_sprint.name}}

The following items will be moved back to the backlog:

| ID | Title | Current Status | Backlog Status After |
|----|-------|---------------|----------------------|
{{#each items_to_remove}}
| {{id}} | {{title}} | {{status}} | ready-for-dev{{#if (ne status "ready-for-dev")}} ⚠️ status will be reset{{/if}} |
{{/each}}

**Effect on sprint capacity:** {{selected_sprint.items.length}} → {{selected_sprint.items.length - items_to_remove.length}} / {{selected_sprint.capacity}} items

**Note:** Each removed item will be appended to the end of the backlog with `status: ready-for-dev`. Run `/prioritize-backlog` after this operation to reorder the backlog.
  </output>
  <check if="any item_to_remove has status != 'ready-for-dev'">
    <output>
> **Warning:** {{#each items_to_remove}}{{#if (ne status "ready-for-dev")}}**{{id}}** is currently `{{status}}` — its status will be reset to `ready-for-dev`. Any in-progress work tracking will be lost.{{/if}}{{/each}}
    </output>
  </check>
  <ask>Options: [c] Confirm removal / [x] Cancel:</ask>
  <check if="user selects 'x'">
    <output>Removal cancelled — no changes made.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="5" goal="Execute reverse movement — atomic write">
  <action>Load current {{sprint_file}} state (re-read if needed to get latest data)</action>

  <action>**Pre-write: single-location invariant check.** Build {{current_backlog_ids}} = set of all item IDs currently in {{sprint_file}}.backlog. For each item in {{items_to_remove}}: check if its ID exists in {{current_backlog_ids}}. If ANY match is found:
    <output>**Error:** Data integrity violation — item {{item.id}} already exists in the backlog. Aborting to prevent duplicate. The sprint-status.yaml file may be corrupted. No changes have been written.</output>
    <action>Exit workflow without writing</action>
  </action>

  <action>**Pre-write: required field validation.** For each item in {{items_to_remove}}: verify it has all 6 required backlog fields present (the key must exist; epic and severity may be null by schema): id, type, epic, title, status, severity. (priority will be assigned by this skill.) If ANY item is missing a required field:
    <output>**Error:** Item {{item.id}} is missing required field '{{missing_field}}'. Cannot safely return this item to the backlog. No changes have been written. Please inspect sprint-status.yaml manually.</output>
    <action>Exit workflow without writing</action>
  </action>

  <action>Determine {{current_max_priority}}:
    - If {{sprint_file.backlog}} is empty, set {{current_max_priority}} = 0
    - Otherwise, set {{current_max_priority}} = max(item.priority for item in sprint_file.backlog)
  </action>
  <action>For each item in {{items_to_remove}} (in the order they appear in the sprint's items array):
    1. REMOVE the item object from {{selected_sprint_id}}.items in the sprints map
    2. INCREMENT {{current_max_priority}} by 1
    3. SET item.status = "ready-for-dev"
    4. ADD item.priority = {{current_max_priority}}
    5. APPEND the item (with fields: id, type, epic, title, priority, status, severity) to the backlog array
  </action>
  <action>After all items are moved: renumber ALL backlog items' priority values sequentially (1..N) to match their array positions. First item in array gets priority 1, second gets priority 2, etc. Track each removed item's final renumbered priority in {{items_to_remove[n].final_priority}} for use in the summary.</action>
  <action>Set {{sprint_file.last_updated}} = current ISO-8601 timestamp (e.g., "2026-04-06T12:00:00Z")</action>
  <action>Write the complete updated sprint-status.yaml in a SINGLE atomic operation. The write MUST include all three sections (epics, backlog, sprints) and all metadata fields. Preserve the `generated` timestamp unchanged.</action>
</step>

<step n="6" goal="Display removal summary">
  <output>
## Removal Complete

**Sprint:** {{selected_sprint.name}}
**Items removed this session:** {{items_to_remove.length}}
**Updated sprint capacity:** {{selected_sprint.items.length - items_to_remove.length}}/{{selected_sprint.capacity}} items

### Removed Items — Now in Backlog

| ID | Title | Backlog Priority | Status |
|----|-------|-----------------|--------|
{{#each items_to_remove}}
| {{id}} | {{title}} | {{final_priority}} | ready-for-dev |
{{/each}}

**Updated backlog count:** {{sprint_file.backlog.length}} items

**Next Steps:**
- Run `/prioritize-backlog` to reorder the backlog after removals
- Run `/add-to-sprint` to reassign items to a sprint
- Run `/sprint-status-view` to view the updated sprint status
  </output>
</step>

</workflow>
