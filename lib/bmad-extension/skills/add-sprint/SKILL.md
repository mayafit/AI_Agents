---
name: add-sprint
description: Guided workflow to create a new sprint entry in the sprints section of sprint-status.yaml with capacity limits, optional ISO dates, and auto-incremented ID
type: skill
triggers:
  - "add sprint"
  - "create sprint"
---

# Add Sprint Workflow

Guided workflow to create a new sprint entry in the `sprints` section of `sprint-status.yaml` with capacity limits, optional ISO dates, and auto-incremented sprint ID.

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
   a. Perform the Jira operation: Create a new sprint in the board for project `{jira_project_key}` at `{jira_url}` using the sprint create API. Set the sprint name, goal (if provided), start date, and end date from the provided sprint data. The new sprint starts in "future/planning" state.
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
  <action>Resolve the path to `sprint-status.yaml`. Check `_bmad/bmm/config.yaml` for a configured `story_location` path; if not set, default to `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
  <action>Attempt to read the file at the resolved path</action>
  <check if="sprint-status.yaml does not exist">
    <output>No sprint-status.yaml found. Run sprint planning first to initialize the file.</output>
    <action>Exit workflow</action>
  </check>
  <action>Read and parse the full file: `epics`, `backlog`, and `sprints` sections plus all metadata fields</action>
  <action>Store parsed content as {{file_content}}</action>
</step>

<step n="1" goal="Auto-increment sprint ID and derive default name">
  <action>Extract all keys from the `sprints` map in {{file_content}}</action>
  <action>Parse numeric suffix from each key matching pattern `sprint-N` (e.g., `sprint-1` → 1, `sprint-3` → 3)</action>
  <check if="no sprint keys exist in sprints map">
    <action>Set {{new_number}} = 1</action>
    <action>Set {{default_name}} = "Sprint 1"</action>
  </check>
  <check if="sprint keys exist">
    <action>Find the highest numeric suffix among all sprint keys; store as {{max_number}}</action>
    <action>Set {{new_number}} = {{max_number}} + 1</action>
    <action>Look up the sprint entry whose key has suffix {{max_number}}; read its `name` field</action>
    <action>If the name matches pattern "Sprint N" or "Sprint N — description" or "Sprint N - description", set {{default_name}} = "Sprint {{new_number}}"; otherwise set {{default_name}} = "Sprint {{new_number}}" as safe fallback</action>
  </check>
  <action>Set {{sprint_id}} = "sprint-{{new_number}}"</action>
  <action>Set {{sprint_name}} = {{default_name}}</action>
  <output>
Auto-generated Sprint ID: **{{sprint_id}}**
Default Sprint Name: **{{sprint_name}}**
  </output>
  <ask>Sprint ID: {{sprint_id}} — press Enter to accept or type a different number:</ask>
  <check if="user provides a different number">
    <action>Set {{sprint_id}} = "sprint-{user_number}"</action>
    <action>Check if {{sprint_id}} already exists as a key in the `sprints` map</action>
    <check if="sprint_id already exists">
      <output>Sprint ID {{sprint_id}} already exists in sprint-status.yaml. Please choose a different number.</output>
      <goto step="1" sub="re-prompt for number only" />
    </check>
    <action>Update {{sprint_name}} default to "Sprint {user_number}"</action>
  </check>
  <ask>Sprint name: '{{sprint_name}}' — press Enter to accept or type a different name:</ask>
  <check if="user provides a different name">
    <action>Set {{sprint_name}} = user input</action>
  </check>
</step>

<step n="2" goal="Gather capacity (required)">
  <action>Explain: capacity is the maximum number of items (stories + bugs) that can be assigned to this sprint. This is advisory — skills will warn but not block when exceeded (per schema section 4.2).</action>
  <ask>What is the sprint capacity? (Enter a positive integer)</ask>
  <action>Store input as {{capacity_input}}</action>
  <action>Validate {{capacity_input}} is a positive integer (greater than zero, no decimals, no non-numeric characters)</action>
  <check if="{{capacity_input}} is NOT a positive integer">
    <output>Invalid capacity: "{{capacity_input}}". Capacity must be a positive integer (e.g., 5, 10, 20). Zero and negative values are not allowed.</output>
    <goto step="2" />
  </check>
  <action>Store as {{capacity}} (integer)</action>
</step>

<step n="3" goal="Gather optional start and end dates">
  <ask>Optional — Sprint start date (ISO format YYYY-MM-DD, press Enter to skip):</ask>
  <action>Store as {{start_input}}</action>
  <check if="start_input is not empty">
    <action>Validate {{start_input}} matches ISO date pattern YYYY-MM-DD (4-digit year, 2-digit month 01-12, 2-digit day 01-31)</action>
    <check if="start_input does not match ISO date pattern">
      <output>Invalid date format: "{{start_input}}". Please use YYYY-MM-DD (e.g., 2026-04-15).</output>
      <goto step="3" sub="re-prompt for start date only" />
    </check>
    <action>Store as {{start}} = {{start_input}}</action>
  </check>
  <check if="start_input is empty">
    <action>Store as {{start}} = "" (empty string)</action>
  </check>
  <ask>Optional — Sprint end date (ISO format YYYY-MM-DD, press Enter to skip):</ask>
  <action>Store as {{end_input}}</action>
  <check if="end_input is not empty">
    <action>Validate {{end_input}} matches ISO date pattern YYYY-MM-DD</action>
    <check if="end_input does not match ISO date pattern">
      <output>Invalid date format: "{{end_input}}". Please use YYYY-MM-DD (e.g., 2026-04-28).</output>
      <goto step="3" sub="re-prompt for end date only" />
    </check>
    <check if="end_input is before start and start is not empty">
      <output>Warning: end date {{end_input}} is before start date {{start}}. Continuing as requested.</output>
    </check>
    <action>Store as {{end}} = {{end_input}}</action>
  </check>
  <check if="end_input is empty">
    <action>Store as {{end}} = "" (empty string)</action>
  </check>
</step>

<step n="4" goal="Confirmation">
  <output>
## New Sprint Summary — Please Confirm

- Sprint ID: {{sprint_id}}
- Sprint Name: {{sprint_name}}
- Capacity: {{capacity}} items
- Start Date: {{start}} *(empty if skipped)*
- End Date: {{end}} *(empty if skipped)*
- Status: planning
- Items: [] *(empty — use /add-to-sprint to assign items)*
- Target: sprint-status.yaml sprints section
  </output>
  <ask>Confirm creation? [y] Yes / [n] Cancel / [e] Edit a field</ask>
  <check if="user selects 'e'">
    <ask>Which field to edit? (id / name / capacity / start / end)</ask>
    <check if="field == 'id'"><goto step="1" /></check>
    <check if="field == 'name'">
      <ask>Sprint name (or press Enter to use "{{sprint_name}}"):</ask>
      <check if="input is not empty"><action>Set {{sprint_name}} = user input</action></check>
      <goto step="4" />
    </check>
    <check if="field == 'capacity'"><goto step="2" /></check>
    <check if="field == 'start'"><goto step="3" sub="start date only" /></check>
    <check if="field == 'end'"><goto step="3" sub="end date only" /></check>
  </check>
  <check if="user selects 'n'">
    <output>Sprint creation cancelled.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="5" goal="Write sprint entry to sprint-status.yaml">
  <action>Re-read the current content of `sprint-status.yaml` (resolved path from Step 0) to get the latest state</action>
  <action>Get the current ISO-8601 timestamp for `last_updated`</action>
  <action>Append a new entry to the `sprints` map with this structure:
```yaml
  {{sprint_id}}:
    name: "{{sprint_name}}"
    status: planning
    capacity: {{capacity}}
    start: "{{start}}"
    end: "{{end}}"
    items: []
```
  </action>
  <action>Preserve the `epics` section unchanged</action>
  <action>Preserve the `backlog` section unchanged</action>
  <action>Preserve all existing entries in the `sprints` section unchanged</action>
  <action>Update the `last_updated` metadata field to the current ISO-8601 timestamp</action>
  <action>Preserve the `generated` field unchanged (never modify)</action>
  <action>Write the complete updated file in a single atomic write (read-modify-write pattern)</action>
</step>

<step n="6" goal="Summary output">
  <output>
Sprint created successfully!

- Sprint: {{sprint_name}} ({{sprint_id}})
- Capacity: {{capacity}} items
- Status: planning

Next Steps:
- Use /add-to-sprint to assign backlog items to this sprint
- Use /modify-sprint to update sprint details later
- Use /sprint-status-view to view sprint progress
  </output>
</step>

</workflow>
