---
name: close-sprint
description: Close an active sprint — archive done/cancelled items, disposition incomplete items (move to next sprint or return to backlog), set sprint status to closed
type: skill
triggers:
  - "close sprint"
  - "close active sprint"
---

# Close Sprint Workflow

Close an active sprint — archive done/cancelled items, disposition incomplete items (move to next sprint or return to backlog), and set sprint status to `closed`.

**Schema Reference:** `_bmad-output/planning-artifacts/sprint-status-schema.md` (Story 17.9)

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
   a. Perform the Jira operation: Query all issues in the active sprint for project `{jira_project_key}` at `{jira_url}`. For done/cancelled items: transition each to resolved/done Jira state using the issue transition API; then move each corresponding local story file from `{story_location}/{id}.md` to `{story_location}/done/{id}.md` (local file operation — always executes). For incomplete items (not done/cancelled): remove each issue from the sprint using the "remove issue from sprint" operation (returns them to board backlog). Then close the sprint using the sprint close API.
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
  <action>Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve `implementation_artifacts`</action>
  <action>Set {{status_file}} = `{implementation_artifacts}/sprint-status.yaml`</action>

  <check if="{{status_file}} does NOT exist">
    <output>**Error:** No sprint-status.yaml found. Run sprint planning first to initialize the file.</output>
    <action>Exit workflow</action>
  </check>

  <action>Read the FULL {{status_file}}</action>
  <action>Parse into {{data}} with sections: metadata, `epics`, `backlog`, and `sprints`</action>
  <action>Store {{story_location}} from {{data}}.metadata.story_location (e.g., `_bmad-output/implementation-artifacts`)</action>
</step>

<step n="1" goal="Identify the active sprint">
  <action>Scan {{data}}.sprints for a sprint with `status: active`</action>
  <check if="no active sprint found">
    <output>No active sprint found. Nothing to close.</output>
    <action>Exit workflow</action>
  </check>
  <action>Store the active sprint as {{active_sprint}} (id + full sprint data)</action>
  <action>Store {{active_sprint_id}} = the sprint's map key (e.g., `sprint-1`)</action>
</step>

<step n="2" goal="Display sprint summary and confirm closure">
  <action>Read {{active_sprint}}.items array</action>
  <action>Store {{all_items}} = {{active_sprint}}.items</action>
  <action>Store {{total_count}} = length of {{all_items}}</action>

  <!-- Initialize counters and collections (always, to prevent undefined in summary output) -->
  <action>Set {{done_count}} = 0</action>
  <action>Set {{cancelled_count}} = 0</action>
  <action>Set {{moved_to_sprint_count}} = 0</action>
  <action>Set {{moved_to_sprint_name}} = ""</action>
  <action>Set {{returned_to_backlog_count}} = 0</action>
  <action>Set {{archived_done_files}} = []</action>
  <action>Set {{archived_cancelled_files}} = []</action>
  <action>Set {{skipped_done}} = []</action>
  <action>Set {{skipped_cancelled}} = []</action>

  <check if="{{total_count}} == 0">
    <action>Set {{empty_sprint_fast_path}} = true</action>
    <action>Jump to step 7 (empty sprint fast path)</action>
  </check>

  <action>Set {{empty_sprint_fast_path}} = false</action>
  <action>Categorize items:
    - {{done_items}} = items where status == `done`
    - {{cancelled_items}} = items where status == `cancelled`
    - {{incomplete_items}} = items where status is `ready-for-dev`, `in-progress`, `review`, or `on-hold`
  </action>

  <output>
## Sprint Closure Summary: {{active_sprint.name}} ({{active_sprint_id}})

**Total items:** {{total_count}}
- Done: {{done_items.length}} (will be archived)
- Cancelled: {{cancelled_items.length}} (will be archived)
- Incomplete: {{incomplete_items.length}} (requires disposition)

| # | ID | Title | Type | Status | Disposition |
|---|----|----|----|----|---|
{{#each done_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | done | archive to done/ |
{{/each}}
{{#each cancelled_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | cancelled | archive to done/ |
{{/each}}
{{#each incomplete_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{status}} | pending decision |
{{/each}}
  </output>

  <ask>Proceed with sprint closure? [c] Confirm and proceed / [x] Cancel:</ask>
  <check if="user selects 'x'">
    <output>Sprint closure cancelled. No changes made.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="3" goal="Archive done items (AC: 2)">
  <check if="{{done_items}} is empty">
    <action>Skip to step 4 (done_count stays 0, archived_done_files stays [])</action>
  </check>

  <action>Ensure `{{story_location}}/done/` directory exists. If it does not exist, create it.</action>

  <action>For each item in {{done_items}}:
    1. Resolve source path: `{{story_location}}/{{item.id}}.md`
       - For bug items (type == bug): also try `{{story_location}}/bug-{{item.id_slug}}.md` as fallback (handle case variations)
    2. Resolve destination path: `{{story_location}}/done/{{item.id}}.md`
    3. If source file does NOT exist:
       - Log warning: "File not found: {{source_path}} — skipping file move."
       - Add item to {{skipped_done}} with reason "source missing"
       - Continue to next item
    4. If destination file ALREADY EXISTS in done/:
       - Log warning: "File already exists at destination: {{destination_path}} — skipping file move."
       - Add item to {{skipped_done}} with reason "destination exists"
       - Continue to next item
    5. Move (rename) the file: source → destination
    6. Add item to {{archived_done_files}}
  </action>

  <action>Remove ALL done items from {{active_sprint}}.items in {{data}}</action>
  <action>Store {{done_count}} = length of {{done_items}}</action>
</step>

<step n="4" goal="Archive cancelled items (AC: 3)">
  <check if="{{cancelled_items}} is empty">
    <action>Skip to step 5 (cancelled_count stays 0, archived_cancelled_files stays [])</action>
  </check>

  <action>Ensure `{{story_location}}/done/` directory exists (may already exist from step 3)</action>

  <action>For each item in {{cancelled_items}}:
    1. Resolve source path: `{{story_location}}/{{item.id}}.md`
       - For bug items (type == bug): also try `{{story_location}}/bug-{{item.id_slug}}.md` as fallback (handle case variations)
    2. Resolve destination path: `{{story_location}}/done/{{item.id}}.md`
    3. If source file does NOT exist:
       - Log warning: "File not found: {{source_path}} — skipping file move."
       - Add item to {{skipped_cancelled}} with reason "source missing"
       - Continue to next item
    4. If destination file ALREADY EXISTS in done/:
       - Log warning: "File already exists at destination: {{destination_path}} — skipping file move."
       - Add item to {{skipped_cancelled}} with reason "destination exists"
       - Continue to next item
    5. Move (rename) the file: source → destination
    6. Add item to {{archived_cancelled_files}}
  </action>

  <action>Remove ALL cancelled items from {{active_sprint}}.items in {{data}}</action>
  <action>Store {{cancelled_count}} = length of {{cancelled_items}}</action>
</step>

<step n="5" goal="Disposition incomplete items (AC: 4, 11)">
  <check if="{{incomplete_items}} is empty">
    <action>Skip to step 6</action>
  </check>

  <output>
## Incomplete Items Requiring Disposition

| # | ID | Title | Type | Status |
|---|----|----|----|----|
{{#each incomplete_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{status}} |
{{/each}}

**Options:**
**(a)** Move all to the next sprint
**(b)** Return all to backlog
**(c)** Decide per item
  </output>

  <ask>Choose disposition option [a/b/c]:</ask>

  <!-- OPTION A: Move all to next sprint -->
  <check if="user selects 'a'">
    <action>Scan {{data}}.sprints for sprints with `status: planning`</action>
    <action>Store {{planning_sprints}} = list of planning sprints</action>

    <check if="{{planning_sprints}} is empty">
      <output>**No planning sprint found.** Run `/add-sprint` to create one, or choose option (b) to return items to backlog.</output>
      <ask>Choose disposition option [b] Return all to backlog / [c] Decide per item:</ask>
      <check if="user selects 'b'"><goto option_b /></check>
      <check if="user selects 'c'"><goto option_c /></check>
    </check>

    <check if="{{planning_sprints}}.length > 1">
      <output>
## Planning Sprints Available

| # | Sprint | Capacity | Items | Remaining |
|---|---|---|---|---|
{{#each planning_sprints}}
| {{@index+1}} | {{name}} ({{id}}) | {{capacity}} | {{items_count}} | {{remaining}} |
{{/each}}
      </output>
      <ask>Select target sprint (enter number):</ask>
      <action>Store {{target_sprint}} = selected planning sprint</action>
    </check>

    <check if="{{planning_sprints}}.length == 1">
      <action>Store {{target_sprint}} = {{planning_sprints}}[0]</action>
    </check>

    <action>Calculate {{new_count}} = {{target_sprint}}.items.length + {{incomplete_items}}.length</action>
    <check if="{{new_count}} > {{target_sprint}}.capacity">
      <output>**Capacity Warning:** Adding {{incomplete_items.length}} items would bring {{target_sprint.name}} to {{new_count}}/{{target_sprint.capacity}} capacity (exceeds limit). Proceeding anyway (capacity is advisory).</output>
    </check>

    <action>For each item in {{incomplete_items}}:
      1. REMOVE the item from {{active_sprint}}.items in {{data}}
      2. ADD the item to {{target_sprint}}.items in {{data}}
      3. PRESERVE the item's current `status` unchanged (no reset)
    </action>
    <action>Store {{moved_to_sprint_count}} = length of {{incomplete_items}}</action>
    <action>Store {{moved_to_sprint_name}} = {{target_sprint}}.name</action>
    <action>Store {{returned_to_backlog_count}} = 0</action>
  </check>

  <!-- OPTION B: Return all to backlog -->
  <check if="user selects 'b'" id="option_b">
    <action>Calculate {{max_priority}} = max `priority` value among all items currently in {{data}}.backlog (0 if backlog is empty)</action>

    <action>For each item in {{incomplete_items}} (processing in order):
      1. REMOVE the item from {{active_sprint}}.items in {{data}}
      2. SET item.status = `ready-for-dev` (schema section 4.5 — status reset on backlog return)
      3. SET item.priority = {{max_priority}} + 1 (then increment {{max_priority}} for the next item)
      4. APPEND the item to the END of {{data}}.backlog
      5. PRESERVE all other fields: `id`, `type`, `epic`, `title`, `severity`
    </action>

    <action>Re-number ALL {{data}}.backlog items' `priority` fields sequentially 1..N (array position 0 = priority 1) to maintain the denormalized index invariant</action>
    <action>Store {{returned_to_backlog_count}} = length of {{incomplete_items}}</action>
    <action>Store {{moved_to_sprint_count}} = 0</action>
    <action>Store {{moved_to_sprint_name}} = ""</action>
  </check>

  <!-- OPTION C: Per-item decision -->
  <check if="user selects 'c'" id="option_c">
    <action>Initialize {{per_item_sprint_targets}} = {} and {{per_item_backlog}} = []</action>
    <action>Initialize {{moved_to_sprint_count}} = 0 and {{returned_to_backlog_count}} = 0</action>

    <action>For each item in {{incomplete_items}} (iterate one by one):
      Display: "**Item:** {{item.id}} — {{item.title}} (status: {{item.status}})"
    </action>
    <ask>**[s]** Move to next sprint / **[b]** Return to backlog:</ask>

    <check if="user selects 's'">
      <action>Scan {{data}}.sprints for sprints with `status: planning`</action>
      <check if="no planning sprint exists">
        <output>No planning sprint found. Returning this item to the backlog instead.</output>
        <action>Add item to {{per_item_backlog}}</action>
      </check>
      <check if="planning sprint(s) exist">
        <check if="multiple planning sprints">
          <output>Select target sprint:</output>
          <ask>Planning sprint number:</ask>
          <action>Store selected sprint as {{item_target_sprint}}</action>
        </check>
        <check if="single planning sprint">
          <action>Store as {{item_target_sprint}}</action>
        </check>
        <action>Check capacity warning (same advisory logic as option a)</action>
        <action>REMOVE item from {{active_sprint}}.items in {{data}}</action>
        <action>ADD item to {{item_target_sprint}}.items in {{data}} preserving current status</action>
        <action>Increment {{moved_to_sprint_count}}</action>
      </check>
    </check>

    <check if="user selects 'b'">
      <action>Add item to {{per_item_backlog}}</action>
    </check>

    <action>After all per-item decisions, process {{per_item_backlog}}:
      1. Calculate {{max_priority}} = max `priority` value among all items in {{data}}.backlog (0 if empty)
      2. For each item in {{per_item_backlog}}:
         - REMOVE item from {{active_sprint}}.items in {{data}}
         - SET item.status = `ready-for-dev`
         - SET item.priority = {{max_priority}} + 1 (then increment for next)
         - APPEND to END of {{data}}.backlog
      3. Re-number ALL {{data}}.backlog items' `priority` fields sequentially 1..N
      4. Set {{returned_to_backlog_count}} = length of {{per_item_backlog}}
    </action>
    <action>Store {{moved_to_sprint_name}} = name of the planning sprint used (if any items moved to sprint)</action>
  </check>
</step>

<step n="6" goal="Validate single-location invariant before write">
  <action>Build a flat list of all item IDs across {{data}}.backlog and all sprints in {{data}}.sprints</action>
  <action>Check for any ID that appears more than once across all locations</action>
  <check if="any duplicate ID found">
    <output>**Error:** Data integrity violation — item {{duplicate_id}} appears in more than one location. Aborting write to prevent data corruption. Please report this as a bug in the skill.</output>
    <action>Exit workflow without writing</action>
  </check>
</step>

<step n="7" goal="Finalize sprint closure (AC: 5, 8)">
  <action>Set {{data}}.sprints.{{active_sprint_id}}.status = `closed`</action>
  <action>Verify {{data}}.sprints.{{active_sprint_id}}.items is now empty (`[]`)</action>
  <check if="items array is NOT empty">
    <output>**Warning:** Sprint items array is not empty after disposition. This may indicate a processing error. Proceeding with closure anyway — remaining items are listed below for manual review.</output>
  </check>
  <action>Update {{data}}.metadata.last_updated = current ISO-8601 timestamp</action>
  <action>Preserve {{data}}.metadata.generated unchanged</action>
  <action>Preserve {{data}}.epics unchanged</action>
  <action>Preserve all other sprints in {{data}}.sprints unchanged</action>

  <critical>Write the complete updated {{data}} to {{status_file}} as a SINGLE atomic write. This one write includes: item removals from the active sprint, backlog additions, next-sprint additions, sprint status change to closed, and metadata update.</critical>
</step>

<step n="8" goal="Display summary output">
  <!-- Handle empty sprint fast path from step 2 -->
  <check if="{{empty_sprint_fast_path}} == true">
    <output>
## Sprint Closed Successfully

**Sprint:** {{active_sprint.name}} ({{active_sprint_id}})
**Status:** closed

Sprint {{active_sprint.name}} closed. No items to disposition.

**Next Steps:**
- Use `/add-sprint` to create the next sprint
- Use `/sprint-status-view` to review the updated status
    </output>
    <action>Exit workflow</action>
  </check>

  <output>
## Sprint Closed Successfully

**Sprint:** {{active_sprint.name}} ({{active_sprint_id}})
**Status:** closed

**Disposition:**
- Done items archived: {{done_count}}
- Cancelled items archived: {{cancelled_count}}
{{#if moved_to_sprint_count}}
- Items moved to {{moved_to_sprint_name}}: {{moved_to_sprint_count}}
{{/if}}
{{#if returned_to_backlog_count}}
- Items returned to backlog: {{returned_to_backlog_count}}
{{/if}}

{{#if archived_done_files.length}}
**Files moved to done/:**
{{#each archived_done_files}}
- {{id}} → done/
{{/each}}
{{/if}}

{{#if archived_cancelled_files.length}}
**Cancelled files moved to done/:**
{{#each archived_cancelled_files}}
- {{id}} → done/
{{/each}}
{{/if}}

{{#if skipped_done.length}}
**Skipped (warnings):**
{{#each skipped_done}}
- {{id}} — {{reason}}
{{/each}}
{{/if}}

{{#if skipped_cancelled.length}}
**Skipped (warnings):**
{{#each skipped_cancelled}}
- {{id}} — {{reason}}
{{/each}}
{{/if}}

**Next Steps:**
- Use `/add-sprint` to create the next sprint
- Use `/prioritize-backlog` to reorder the backlog after returns
- Use `/sprint-status-view` to review the updated status
  </output>
</step>

</workflow>
