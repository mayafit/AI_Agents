---
name: modify-sprint
description: Guided workflow to modify an existing sprint's metadata (name, capacity, dates, status) within the sprints section of sprint-status.yaml
type: skill
triggers:
  - "modify sprint"
  - "edit sprint"
---

# Modify Sprint Workflow

Guided workflow to modify an existing sprint's metadata (name, capacity, dates, status) within the `sprints` section of `sprint-status.yaml`.

> **Scope:** This skill modifies sprint **metadata only** — name, capacity, start date, end date, and status.
> To assign items to a sprint, use `/add-to-sprint`. To remove items, use `/remove-from-sprint`.

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
| always | `software_requirements_store` → its `path:` (a store whose `backend:` is not `file-system` has no `path:` at all, and so generates `.`); the artifacts field is that same path, except that a path of `.` gives `{project-root}/_bmad-output/planning-artifacts` | `software_requirements_path:`, `knowledgebase_path:`, `planning_artifacts:` |
| always | `system_requirements_store` → its `path:` (a store whose `backend:` is not `file-system` has no `path:` at all, and so generates `.`) | `system_requirements_path:` |
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

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Find the sprint by name or ID in the board for project `{jira_project_key}` at `{jira_url}`. Update the sprint's name, dates, or goal using the sprint update API. If the status is being changed to `active`: start the sprint using the sprint start API (transitions the sprint from future/planning to active state — enforces the single-active-sprint constraint).
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
  <action>Resolve the path to `sprint-status.yaml` using `_bmad/bmm/config.yaml` if available; default path is `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
  <check if="file does not exist">
    <output>❌ No sprint-status.yaml found. Run sprint planning first to initialize the file.</output>
    <action>Exit workflow</action>
  </check>
  <action>Read and parse the full file, retaining all three sections: `epics`, `backlog`, and `sprints`</action>
  <action>Store file contents as {{file_content}} for use in the final atomic write</action>
</step>

<step n="1" goal="Identify available sprints and select one to modify">
  <action>Parse the `sprints` section from the loaded file</action>
  <check if="sprints section is empty ({})">
    <output>❌ No sprints found. Run `/add-sprint` first to create a sprint.</output>
    <action>Exit workflow</action>
  </check>
  <action>Build sprint list with: sprint ID (map key), name, status, capacity, item count (length of items array), start, end</action>
  <output>
## 🏃 Available Sprints

| # | Sprint ID | Name | Status | Capacity | Items | Start | End |
|---|---|---|---|---|---|---|---|
{{#each sprints}}
| {{@index+1}} | {{sprint_id}} | {{name}} | {{status}} | {{capacity}} | {{item_count}}/{{capacity}} | {{start_or_not_set}} | {{end_or_not_set}} |
{{/each}}

Note: closed sprints are immutable and cannot be modified.
  </output>
  <ask>Select sprint to modify (enter number):</ask>
  <action>Store selected sprint as {{target_sprint}} and its map key as {{sprint_id}}</action>
  <check if="{{target_sprint.status}} == 'closed'">
    <output>⚠️ Sprint '{{target_sprint.name}}' ({{sprint_id}}) is closed. Closed sprints are immutable (schema constraint 6.7). Only archival operations are permitted.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="2" goal="Display current sprint state">
  <action>Calculate {{item_count}} = length of {{target_sprint.items}} array</action>
  <action>Calculate {{remaining}} = {{target_sprint.capacity}} - {{item_count}}</action>
  <output>
## Sprint: {{target_sprint.name}} ({{sprint_id}})

- **Status:** {{target_sprint.status}}
- **Capacity:** {{target_sprint.capacity}} items ({{item_count}} assigned, {{remaining}} remaining)
- **Start:** {{target_sprint.start || "not set"}}
- **End:** {{target_sprint.end || "not set"}}
- **Items:** {{item_count}} assigned (use /add-to-sprint or /remove-from-sprint to manage items)

### Assigned Items (read-only)
{{#if items_empty}}
*(No items assigned yet)*
{{else}}
| ID | Title | Type | Status |
|---|---|---|---|
{{#each target_sprint.items}}
| {{id}} | {{title}} | {{type}} | {{status}} |
{{/each}}
{{/if}}
  </output>
  <action>Initialize {{working_changes}} = empty map to accumulate changes made during this session</action>
  <action>Initialize working state aliases: {{current_name}} = {{target_sprint.name}}, {{current_capacity}} = {{target_sprint.capacity}}, {{current_start}} = {{target_sprint.start}}, {{current_end}} = {{target_sprint.end}}, {{current_status}} = {{target_sprint.status}}. These aliases are updated in-place as changes are made so Step 3's menu always shows the latest values.</action>
  <action>Store {{original_name}} = {{target_sprint.name}} (preserved as the display name in the confirmation summary)</action>
</step>

<step n="3" goal="Present modification menu">
  <output>
## What would you like to modify?

1. **Sprint name** (current: "{{current_name}}")
2. **Capacity** (current: {{current_capacity}})
3. **Start date** (current: {{current_start || "not set"}})
4. **End date** (current: {{current_end || "not set"}})
5. **Status** (current: {{current_status}})
6. **Done** -- save all changes and exit
  </output>
  <ask>Choice:</ask>
  <check if="choice == 6 or choice == 'done'">
    <goto step="4" />
  </check>
</step>

<step n="3a" goal="Modify sprint name" if="choice == 1">
  <ask>New sprint name (current: '{{current_name}}'):</ask>
  <check if="input is empty">
    <output>❌ Sprint name cannot be empty. Please enter a valid name.</output>
    <goto step="3a" />
  </check>
  <action>Store {{new_name}} = input</action>
  <action>Store change: name: {{current_name}} -> {{new_name}} in {{working_changes}}</action>
  <action>Update current display value: {{current_name}} = {{new_name}}</action>
  <output>✅ Sprint name updated: '{{old_name}}' -> '{{new_name}}'.</output>
  <goto step="3" />
</step>

<step n="3b" goal="Modify capacity" if="choice == 2">
  <ask>New capacity (positive integer, current: {{current_capacity}}):</ask>
  <action>Validate input is a positive integer (greater than zero, no decimals, no non-numeric characters)</action>
  <check if="input is NOT a positive integer">
    <output>❌ Invalid capacity. Must be a positive integer greater than zero.</output>
    <goto step="3b" />
  </check>
  <action>Store {{new_capacity}} = validated integer input</action>
  <action>Calculate {{item_count}} = length of {{target_sprint.items}} array</action>
  <check if="{{new_capacity}} < {{item_count}}">
    <output>⚠️ Sprint has {{item_count}} items but new capacity would be {{new_capacity}} ({{new_capacity}} < {{item_count}}). Capacity is advisory -- items will not be removed.</output>
    <ask>Options:
- [a] Apply anyway (capacity is advisory per schema section 4.2)
- [s] Skip -- keep current capacity
- [r] Remove items first (direct to /remove-from-sprint)

Choice:</ask>
    <check if="choice == 's'">
      <goto step="3" />
    </check>
    <check if="choice == 'r'">
      <output>Run `/remove-from-sprint` to remove items, then re-run `/modify-sprint`.</output>
      <action>Exit workflow</action>
    </check>
    <!-- if 'a', proceed with the change -->
  </check>
  <action>Calculate {{new_remaining}} = {{new_capacity}} - {{item_count}}</action>
  <action>Store change: capacity: {{current_capacity}} -> {{new_capacity}} in {{working_changes}}</action>
  <action>Update current display value: {{current_capacity}} = {{new_capacity}}</action>
  <output>✅ Capacity updated: {{old_capacity}} -> {{new_capacity}} ({{new_remaining}} slots remaining with {{item_count}} assigned items).</output>
  <goto step="3" />
</step>

<step n="3c" goal="Modify start date" if="choice == 3">
  <ask>New start date (ISO format YYYY-MM-DD, or press Enter to clear):</ask>
  <check if="input is empty">
    <action>Store {{new_start}} = "" (clears the date)</action>
  </check>
  <check if="input is not empty">
    <action>Validate input matches ISO date format YYYY-MM-DD (regex: ^\d{4}-\d{2}-\d{2}$) and represents a valid calendar date</action>
    <check if="invalid format">
      <output>❌ Invalid date format. Use YYYY-MM-DD (e.g., 2026-05-01).</output>
      <goto step="3c" />
    </check>
    <action>Store {{new_start}} = input</action>
  </check>
  <action>Store change: start: {{current_start || "not set"}} -> {{new_start || "not set"}} in {{working_changes}}</action>
  <action>Update current display value: {{current_start}} = {{new_start}}</action>
  <output>✅ Start date updated: '{{old_start || "not set"}}' -> '{{new_start || "not set"}}'.</output>
  <goto step="3" />
</step>

<step n="3d" goal="Modify end date" if="choice == 4">
  <ask>New end date (ISO format YYYY-MM-DD, or press Enter to clear):</ask>
  <check if="input is empty">
    <action>Store {{new_end}} = "" (clears the date)</action>
  </check>
  <check if="input is not empty">
    <action>Validate input matches ISO date format YYYY-MM-DD (regex: ^\d{4}-\d{2}-\d{2}$) and represents a valid calendar date</action>
    <check if="invalid format">
      <output>❌ Invalid date format. Use YYYY-MM-DD (e.g., 2026-05-31).</output>
      <goto step="3d" />
    </check>
    <action>Store {{new_end}} = input</action>
  </check>
  <action>Determine effective start: use {{current_start}} if start not changed this session, else use newly entered start</action>
  <check if="{{new_end}} is not empty AND {{effective_start}} is not empty AND {{new_end}} < {{effective_start}}">
    <output>⚠️ Warning: End date ({{new_end}}) is before start date ({{effective_start}}). This may be intentional.</output>
  </check>
  <action>Store change: end: {{current_end || "not set"}} -> {{new_end || "not set"}} in {{working_changes}}</action>
  <action>Update current display value: {{current_end}} = {{new_end}}</action>
  <output>✅ End date updated: '{{old_end || "not set"}}' -> '{{new_end || "not set"}}'.</output>
  <goto step="3" />
</step>

<step n="3e" goal="Modify status" if="choice == 5">
  <action>Determine valid transitions based on {{current_status}}:
    - If `planning`: valid next state is `active` only
    - If `active`: valid next state is `closed` only
    - If `closed`: no transitions available (immutable)
  </action>
  <output>
Current status: **{{current_status}}**
{{#if current_status == 'planning'}}Valid transitions: planning -> active{{/if}}
{{#if current_status == 'active'}}Valid transitions: active -> closed{{/if}}
{{#if current_status == 'closed'}}No transitions available. Closed sprints are immutable.{{/if}}
  </output>
  <check if="{{current_status}} == 'closed'">
    <output>⚠️ Sprint '{{current_name}}' is closed. Closed sprints are immutable (schema constraint 6.7). Only archival operations are permitted.</output>
    <goto step="3" />
  </check>
  <ask>New status:</ask>
  <action>Validate transition:
    - planning -> active: allowed (proceed to single-active-sprint check)
    - active -> closed: allowed (with warning about /close-sprint)
    - planning -> closed: REJECTED (skip)
    - active -> planning: REJECTED (backward)
    - closed -> anything: REJECTED (immutable -- already handled above)
    - same state -> same state: REJECTED (no change)
    - any unrecognized value: REJECTED
  </action>
  <check if="transition is invalid (backward, skip, or unrecognized)">
    <output>❌ Invalid status transition: {{current_status}} -> {{requested_status}}. Sprint status transitions are forward-only: planning -> active -> closed.</output>
    <goto step="3e" />
  </check>
  <check if="requested_status == 'closed'">
    <output>⚠️ To properly close a sprint with item disposition (archiving done items, returning incomplete items to backlog), use `/close-sprint` instead. This will only update the status field.</output>
    <ask>Continue with status-only change? [y/n]</ask>
    <check if="answer == 'n'">
      <output>Status change cancelled. Use `/close-sprint` for full sprint close lifecycle.</output>
      <goto step="3" />
    </check>
  </check>
  <check if="requested_status == 'active'">
    <action>Scan all other sprints in the `sprints` map for any sprint with status: active</action>
    <check if="another active sprint found">
      <output>⚠️ Sprint '{{other_sprint_name}}' ({{other_sprint_id}}) is already active. Only one sprint can be active at a time (schema constraint 6.4). Close it first or cancel this change.</output>
      <ask>Options:
- [c] Cancel status change
- [x] Exit to run /close-sprint on {{other_sprint_id}} first

Choice:</ask>
      <check if="choice == 'c'">
        <goto step="3" />
      </check>
      <check if="choice == 'x'">
        <output>Run `/close-sprint` on {{other_sprint_id}} first, then re-run `/modify-sprint`.</output>
        <action>Exit workflow</action>
      </check>
    </check>
  </check>
  <action>Store change: status: {{current_status}} -> {{requested_status}} in {{working_changes}}</action>
  <action>Update current display value: {{current_status}} = {{requested_status}}</action>
  <output>✅ Status updated: {{old_status}} -> {{requested_status}}.</output>
  <goto step="3" />
</step>

<step n="4" goal="Confirmation -- review and confirm all changes">
  <check if="{{working_changes}} is empty">
    <output>ℹ️ No modifications made.</output>
    <action>Exit workflow</action>
  </check>
  <output>
## Modification Summary -- Please Confirm

Sprint: {{sprint_id}} ("{{original_name}}")

Changes:
{{#each working_changes}}
- {{field}}: {{old_value}} -> {{new_value}}
{{/each}}

All other sprint data (items, other sprints, epics, backlog) will be preserved unchanged.
  </output>
  <ask>Confirm changes? [y] Yes / [n] Cancel / [e] Edit more</ask>
  <check if="choice == 'n'">
    <output>❌ Changes discarded.</output>
    <action>Exit workflow</action>
  </check>
  <check if="choice == 'e'">
    <goto step="3" />
  </check>
  <!-- if 'y', proceed to Step 5 -->
</step>

<step n="5" goal="Persist changes to sprint-status.yaml">
  <action>Re-read `sprint-status.yaml` (using the resolved path from Step 0) to get the latest file state before writing</action>
  <action>Locate the target sprint entry at `sprints.{{sprint_id}}` in the re-read file</action>
  <action>Apply all confirmed changes to the target sprint entry:
    - If name was changed: update `name` field
    - If capacity was changed: update `capacity` field
    - If start was changed: update `start` field
    - If end was changed: update `end` field
    - If status was changed: update `status` field
  </action>
  <action>Preserve the sprint's `items` array exactly as-is (no modifications)</action>
  <action>Preserve all other sprint entries in the `sprints` map exactly as-is</action>
  <action>Preserve the `epics` section exactly as-is</action>
  <action>Preserve the `backlog` section exactly as-is</action>
  <action>Preserve the `generated` field exactly as-is (never change)</action>
  <action>Set `last_updated` to the current ISO-8601 timestamp</action>
  <action>Write the complete updated file in a single atomic write to `sprint-status.yaml`</action>
  <output>
## ✅ Sprint Modified Successfully!

**Sprint:** {{sprint_name}} ({{sprint_id}})
{{#each working_changes}}
- **{{field}}:** {{new_value}}
{{/each}}

**Next Steps:**
- Use `/add-to-sprint` to assign backlog items to this sprint
- Use `/remove-from-sprint` to remove items from this sprint
- Use `/sprint-status-view` to view sprint progress
- Use `/close-sprint` to close this sprint when complete
  </output>
</step>

</workflow>
