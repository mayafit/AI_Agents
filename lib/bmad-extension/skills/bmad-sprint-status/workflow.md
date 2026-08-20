# Sprint Status Health Workflow

**Goal:** Produce an analysis-focused sprint health summary with risk flags and next-action recommendations by reading the unified `sprint-status.yaml`.

**Your Role:** You are a Scrum Master providing clear, actionable sprint visibility. Focus on health metrics, risk flags, and next steps — not display tables (use `/sprint-status-view` for that).

**READ-ONLY:** This skill NEVER writes to `sprint-status.yaml` or any other file.

---

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
| always | `software_requirements_store` → its `path:` (a store whose `backend:` is not `file-system` has no `path:` at all, and so generates `.`); the artifacts field is that same path, except that a path of `.` gives `{project-root}/_bmad-output/planning-artifacts`; its resolved `backend:` (an absent or empty `backend:` resolves to `file-system`), and, when that backend is `confluence`, its `space_key:` — the generated space-key field is empty for every other backend, so a store re-bound away from Confluence does not keep the old space | `software_requirements_path:`, `knowledgebase_path:`, `planning_artifacts:`, `software_requirements_backend:`, `software_requirements_space_key:` |
| always | `system_requirements_store` → its `path:` (a store whose `backend:` is not `file-system` has no `path:` at all, and so generates `.`); its resolved `backend:` (an absent or empty `backend:` resolves to `file-system`), and, when that backend is `confluence`, its `space_key:` — the generated space-key field is empty for every other backend, so a store re-bound away from Confluence does not keep the old space | `system_requirements_path:`, `system_requirements_backend:`, `system_requirements_space_key:` |
| `sprint_management` has `mode: jira` | `sprint_management` → its `jira_url:` and `jira_project_key:`; the backend field is the literal `jira`; the artifacts field is always `{project-root}/_bmad-output/implementation-artifacts`, because a Jira sprint store has no path | `sprint_backend:`, `jira_url:`, `jira_project_key:`, `implementation_artifacts:` |
| `sprint_management` has any other mode | `sprint_management` → its `path:`; the backend field is the literal `file-system`; the artifacts field is that same path, except that a path of `.` gives `{project-root}/_bmad-output/implementation-artifacts` | `sprint_backend:`, `sprint_management_path:`, `implementation_artifacts:` |

**When the binding says `mode: jira`, `sprint_management_path:` is not compared at all.** The generator writes no `sprint_management_path:` in that mode — and it never DELETES a field, it only updates or appends one. So a project that was bound to the file system and later re-bound to Jira still carries its old `sprint_management_path:` line in a freshly generated `config.yaml`. That leftover line is not drift, and comparing it would halt every Jira project that was ever file-system-bound.

Not every field in that table is a path. Where a store's `backend:` or `space_key:` is what disagrees, the comparison is the same and so is the halt — read the message template's `{path in …}` placeholders as "the value that disagrees", and name the two values you actually compared.

**Any disagreement is drift** → **HALT** and report, naming every store that moved and both of its paths:

> **ma-agents — stopping: `_bmad/bmm/config.yaml` is stale.**
> The committed binding in `_bmad-output/project-layout.yaml` no longer matches the state `_bmad/bmm/config.yaml` was generated from:
> - {store name}: was `{path in config.yaml}`, is now `{path in project-layout.yaml}`
> (one line per store that moved)
> Running this skill now would read and write artifacts where those stores used to be. Run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from the committed binding, then run this skill again.
> Nothing has been read or written on your behalf. Stopping rather than guessing.

**If everything in the table agrees** → go to **Step P5**.

The stamp covers binding state that `config.yaml` does not carry — a Confluence `root_page:`, a `gitUrl:` — so the table alone cannot see every kind of move. If, and only if, a command shell is available to you and `ma-agents` resolves as a local dependency of this project, you may confirm the comparison exactly, without parsing the stamp yourself:

```bash
node -e "const c=require('ma-agents/bin/cli.js'),f=require('fs'),p=process.cwd();const t=c.resolveProjectTopology(p);if(!t.ok){console.log('binding:'+t.reason)}else{const s=c.readProjectLayoutStamp(f.readFileSync('_bmad/bmm/config.yaml','utf8'));console.log(s.ok?(s.value===c.computeProjectLayoutStamp(t.topology,p)?'MATCH':'DRIFT'):'stamp:'+s.reason)}"
```

`DRIFT` is authoritative: HALT with the stale-config message above even when the table found nothing, and say that the binding changed in a way `config.yaml` does not record. Never treat a failure to run this command as a result — if it does not run, the table is the check, and you say nothing about the stamp.

### Step P5 — PROCEED

The generated config matches the committed binding. Say NOTHING about the binding, the stamp or this preflight — a matched project gets no message — and continue with the rest of this skill.

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

### Paths

- `sprint_status_file` = `{implementation_artifacts}/sprint-status.yaml`
- `done_folder` = `{implementation_artifacts}/done/`

### Input Files

| Input | Path | Load Strategy |
|-------|------|---------------|
| Sprint status | `{sprint_status_file}` | FULL_LOAD |

### Context

- `project_context` = `**/project-context.md` (load if exists)

---

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query the active sprint for project `{jira_project_key}` at `{jira_url}` and retrieve all sprint issues with their statuses. Query backlog issue count. Query epic progress (completed stories per epic). Map Jira sprint states and issue statuses to canonical vocabulary per the status mapping below. Use this data for health analysis — no writes. Status mapping: Backlog/Open → backlog, To Do/Selected for Development → ready-for-dev, In Progress → in-progress, In Review/Code Review → review, Done/Resolved → done, On Hold/Blocked → on-hold, Won't Do/Cancelled → cancelled.
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

4. **File-System Backend** — execute the steps below.

---

## EXECUTION

<workflow>

<step n="0" goal="Determine execution mode">
  <action>Set mode = {{mode}} if provided by caller; otherwise mode = "interactive"</action>

  <check if="mode == data">
    <action>Jump to Step 20</action>
  </check>

  <check if="mode == validate">
    <action>Jump to Step 30</action>
  </check>

  <check if="mode == interactive">
    <action>Continue to Step 1</action>
  </check>
</step>

<step n="1" goal="Locate and load sprint-status.yaml">
  <action>Load {project_context} for project-wide patterns and conventions (if exists)</action>
  <action>Try to read {sprint_status_file}</action>
  <check if="file not found">
    <output>No sprint-status.yaml found. Run `/bmad-sprint-planning` to initialize.</output>
    <action>Exit workflow</action>
  </check>
  <action>Parse YAML — extract metadata fields: generated, last_updated, project, project_key, tracking_system, story_location</action>
  <action>Parse three data sections: epics (map), backlog (array), sprints (map)</action>
  <action>Continue to Step 2</action>
</step>

<step n="2" goal="Analyze active sprint health">
  <action>Scan sprints map for the sprint entry with status: active</action>
  <check if="no active sprint found">
    <action>Set active_sprint = null</action>
    <action>Continue to Step 2b (backlog health)</action>
  </check>
  <check if="active sprint found">
    <action>Store as active_sprint with all its fields (name, capacity, start, end, items)</action>
    <action>Compute items_by_status: count items in active_sprint.items grouped by status field (in-progress, review, ready-for-dev, backlog, on-hold, cancelled, done)</action>
    <action>capacity_used = length of active_sprint.items array</action>
    <action>capacity_total = active_sprint.capacity</action>
    <action>capacity_pct = if capacity_total > 0 then round((capacity_used / capacity_total) * 100) else 0 (treat capacity=0 as "no limit set")</action>
    <action>If active_sprint.start is populated: compute sprint_age_days = number of days between active_sprint.start date and today</action>
    <action>For each item in active_sprint.items with status: in-progress: compute item_age_days = sprint_age_days (proxy — item assumed in-progress since sprint start)</action>
  </check>
</step>

<step n="2b" goal="Analyze backlog health">
  <action>backlog_total = length of backlog array</action>
  <action>backlog_bugs = count of backlog items where type == "bug"</action>
  <action>backlog_stories = backlog_total - backlog_bugs</action>
  <action>backlog_critical_bugs = count of backlog bugs where severity == "critical" or severity == "high"</action>
  <action>Continue to Step 2c</action>
</step>

<step n="2c" goal="Compute epic progress">
  <action>For each epic key in the epics map:
    - epic_number = numeric portion of key (e.g., key "epic-17" → epic_number = 17)
    - active_count = count of items across backlog array AND all sprints[*].items arrays where item.epic == epic_number
    - done_count = count of files in {done_folder} whose filename starts with "{epic_number}-" (e.g., "17-*.md")
    - total_count = done_count + active_count
    - Store as: {epic_key, status, retrospective, done_count, active_count, total_count}
  </action>
  <action>Continue to Step 2d</action>
</step>

<step n="2d" goal="Compute sprint history">
  <action>closed_sprints = all sprint entries where status == "closed"</action>
  <action>closed_count = length of closed_sprints</action>
  <action>For each closed sprint: capture name, item count (length of items array), start, end dates</action>
  <action>Continue to Step 3</action>
</step>

<step n="3" goal="Detect risk flags">
  <action>Initialize risks = [] (empty list)</action>

  <!-- Risk: No active sprint -->
  <check if="active_sprint == null">
    <action>Append to risks: "No active sprint — consider running `/add-sprint` to create one or activating a planning sprint"</action>
  </check>

  <!-- Risk: Stale items (in-progress for more than 14 days based on sprint start) -->
  <check if="active_sprint is not null AND sprint_age_days > 14">
    <action>For each item in active_sprint.items where status == "in-progress":
      Append to risks: "Item {{item.id}} has been in-progress for {{sprint_age_days}} days (sprint started {{active_sprint.start}})"
    </action>
  </check>

  <!-- Risk: Items not started -->
  <check if="active_sprint is not null">
    <action>not_started_count = count of items in active_sprint.items where status == "ready-for-dev" or status == "backlog"</action>
    <check if="not_started_count > 0">
      <action>Append to risks: "{{not_started_count}} of {{capacity_used}} items still in ready-for-dev status — not yet started"</action>
    </check>
  </check>

  <!-- Risk: Over-capacity -->
  <check if="active_sprint is not null AND capacity_total > 0 AND capacity_used > capacity_total">
    <action>overage = capacity_used - capacity_total</action>
    <action>Append to risks: "Sprint over capacity: {{capacity_used}}/{{capacity_total}} items ({{overage}} over limit)"</action>
  </check>

  <!-- Risk: At capacity with unstarted items -->
  <check if="active_sprint is not null AND capacity_total > 0 AND capacity_used >= capacity_total AND not_started_count > 0">
    <action>Append to risks: "Sprint at {{capacity_pct}}% capacity ({{capacity_used}}/{{capacity_total}}) with {{not_started_count}} items still in ready-for-dev"</action>
  </check>

  <!-- Risk: No progress toward completion -->
  <check if="active_sprint is not null AND sprint_age_days >= 3">
    <action>review_or_done_count = count of items in active_sprint.items where status == "review" or status == "done"</action>
    <check if="review_or_done_count == 0">
      <action>Append to risks: "No items in review or done — sprint may be at risk (sprint is {{sprint_age_days}} days old)"</action>
    </check>
  </check>

  <!-- Risk: On-hold or cancelled items in active sprint -->
  <check if="active_sprint is not null">
    <action>For each item in active_sprint.items where status == "on-hold" or status == "cancelled":
      Append to risks: "1 item {{item.status}}: {{item.id}}"
    </action>
  </check>

  <!-- Risk: Stale sprint-status.yaml file -->
  <action>staleness_date = last_updated if present, else generated</action>
  <action>file_age_days = number of days between staleness_date and today</action>
  <check if="file_age_days > 7">
    <action>Append to risks: "`last_updated` is {{file_age_days}} days old — sprint-status.yaml may be stale"</action>
  </check>

  <!-- Risk: Orphaned stories (item references epic not in epics section) -->
  <action>For each item in backlog array AND each item in all sprints[*].items arrays:
    If item.epic is not null AND "epic-{{item.epic}}" key does not exist in epics map:
      Append to risks: "Orphaned story detected: item {{item.id}} references epic-{{item.epic}} which is not in the epics section"
  </action>

  <!-- Risk: In-progress epic with no stories -->
  <action>For each epic in epics map where epic.status == "in-progress":
    active_count from Step 2c for this epic
    If active_count == 0 AND done_count (from Step 2c) == 0:
      Append to risks: "In-progress epic {{epic_key}} has no associated stories"
  </action>

  <!-- Risk: Critical bugs in backlog -->
  <action>For each item in backlog array where type == "bug" AND (severity == "critical" or severity == "high"):
    Append to risks: "Critical/high severity bug in backlog: {{item.id}} ({{item.severity}})"
  </action>

  <action>Continue to Step 4</action>
</step>

<step n="4" goal="Select next action recommendation">
  <note>When selecting "first" item: prefer active sprint items over backlog items; within each group, sort by epic number then story number</note>
  <action>Scan for next recommended workflow using priority order:</action>
  1. If any item in active_sprint.items has status == "in-progress" → set next_workflow_id = "dev-story", next_story_id = first such item's id
  2. Else if any item in active_sprint.items has status == "review" → set next_workflow_id = "code-review", next_story_id = first such item's id
  3. Else if any item in active_sprint.items OR backlog has status == "ready-for-dev" → set next_workflow_id = "dev-story", next_story_id = first such item's id
  4. Else if any item in backlog has status == "backlog" → set next_workflow_id = "create-story", next_story_id = first such item's id
  5. Else if any epic has retrospective == "optional" AND status == "done" → set next_workflow_id = "retrospective", next_story_id = that epic's key
  6. Else → set next_workflow_id = null, next_story_id = null (all work complete)
  <action>Store next_workflow_id, next_story_id</action>
  <action>Continue to Step 5</action>
</step>

<step n="5" goal="Display interactive health summary">
  <output>
## Sprint Health Summary

- Project: {{project}} ({{project_key}})
- Tracking: {{tracking_system}}
- Last updated: {{last_updated}}

{{#if active_sprint}}
### Active Sprint: {{active_sprint.name}}
**Capacity:** {{capacity_used}} / {{capacity_total}} ({{capacity_pct}}%)
**Dates:** {{active_sprint.start}} to {{active_sprint.end}}
**Items by status:** in-progress {{items_by_status.in-progress}}, review {{items_by_status.review}}, ready-for-dev {{items_by_status.ready-for-dev}}, backlog {{items_by_status.backlog}}, on-hold {{items_by_status.on-hold}}
{{else}}
### Active Sprint
No active sprint found.
{{/if}}

### Risk Flags
{{#if risks}}
{{#each risks}}
- {{this}}
{{/each}}
{{else}}
No risks detected.
{{/if}}

### Backlog Health
- Total unassigned: {{backlog_total}} ({{backlog_stories}} stories, {{backlog_bugs}} bugs)
- Critical/high bugs in backlog: {{backlog_critical_bugs}}

### Epic Progress
{{#each epic_progress}}
- {{epic_key}} ({{status}}): {{done_count}}/{{total_count}} done
{{/each}}

### Sprint History
- {{closed_count}} closed sprint(s)
{{#each closed_sprints}}
- {{name}}: {{item_count}} items, {{start}} to {{end}}
{{/each}}

### Next Recommendation
{{#if next_workflow_id}}
/{{next_workflow_id}} ({{next_story_id}})
{{else}}
All work complete — great job!
{{/if}}
  </output>
</step>

<step n="6" goal="Offer interactive actions">
  <ask>Pick an option:
1) Run recommended workflow now
2) Show all items grouped by status (active sprint + backlog)
3) Show detailed sprint view (runs `/sprint-status-view`)
4) Show raw sprint-status.yaml
5) Exit
Choice:</ask>

  <check if="choice == 1">
    <check if="next_workflow_id is null">
      <output>No workflow to run — all work is complete.</output>
    </check>
    <check if="next_workflow_id is not null">
      <output>Run `/{{next_workflow_id}}`.
If the command targets a story, set `story_key={{next_story_id}}` when prompted.</output>
    </check>
  </check>

  <check if="choice == 2">
    <output>
### Items by Status

**In Progress:**
{{#each active_sprint.items where status == "in-progress"}}
- {{id}}: {{title}}
{{/each}}

**Review:**
{{#each active_sprint.items where status == "review"}}
- {{id}}: {{title}}
{{/each}}

**Ready for Dev (sprint):**
{{#each active_sprint.items where status == "ready-for-dev"}}
- {{id}}: {{title}}
{{/each}}

**Ready for Dev (backlog):**
{{#each backlog where status == "ready-for-dev"}}
- {{id}}: {{title}}
{{/each}}

**Backlog (unassigned):**
{{#each backlog where status == "backlog"}}
- {{id}}: {{title}}
{{/each}}
    </output>
  </check>

  <check if="choice == 3">
    <output>For a full formatted table view with all items, run `/sprint-status-view`.</output>
  </check>

  <check if="choice == 4">
    <action>Display the full contents of {sprint_status_file}</action>
  </check>

  <check if="choice == 5">
    <action>Exit workflow</action>
  </check>
</step>

<!-- ========================= -->
<!-- Data mode for other flows -->
<!-- ========================= -->

<step n="20" goal="Data mode output">
  <action>Load and parse {sprint_status_file} same as Steps 1–2d</action>
  <action>Detect risks same as Step 3</action>
  <action>Compute recommendation same as Step 4</action>
  <template-output>active_sprint_id = {{active_sprint_id}}</template-output>
  <template-output>active_sprint_name = {{active_sprint_name}}</template-output>
  <template-output>next_workflow_id = {{next_workflow_id}}</template-output>
  <template-output>next_story_id = {{next_story_id}}</template-output>
  <template-output>count_backlog = {{count_backlog}}</template-output>
  <template-output>count_ready = {{count_ready}}</template-output>
  <template-output>count_in_progress = {{count_in_progress}}</template-output>
  <template-output>count_review = {{count_review}}</template-output>
  <template-output>count_done = {{count_done}}</template-output>
  <template-output>count_on_hold = {{count_on_hold}}</template-output>
  <template-output>capacity_used = {{capacity_used}}</template-output>
  <template-output>capacity_total = {{capacity_total}}</template-output>
  <template-output>capacity_pct = {{capacity_pct}}</template-output>
  <template-output>backlog_total = {{backlog_total}}</template-output>
  <template-output>backlog_bugs = {{backlog_bugs}}</template-output>
  <template-output>backlog_critical_bugs = {{backlog_critical_bugs}}</template-output>
  <template-output>epic_summary = {{epic_summary}}</template-output>
  <template-output>risks = {{risks}}</template-output>
  <action>Return to caller</action>
</step>

<!-- Notes on count_* field semantics in data mode:
  count_backlog   = items with status "backlog" across active sprint items + backlog array
  count_ready     = items with status "ready-for-dev" across active sprint items + backlog array
  count_in_progress = items with status "in-progress" in active sprint
  count_review    = items with status "review" in active sprint
  count_done      = items with status "done" in active sprint (not counting done/ folder archived items)
  count_on_hold   = items with status "on-hold" or "cancelled" in active sprint
  Backward compatibility: count_backlog, count_ready, count_in_progress, count_review, count_done,
    next_workflow_id, next_story_id, and risks keys are preserved from the original built-in data mode output.
-->

<!-- ========================= -->
<!-- Validate mode -->
<!-- ========================= -->

<step n="30" goal="Validate sprint-status.yaml against unified schema">
  <action>Check that {sprint_status_file} exists</action>
  <check if="missing">
    <template-output>is_valid = false</template-output>
    <template-output>error = "sprint-status.yaml missing"</template-output>
    <template-output>suggestion = "Run /bmad-sprint-planning to create it"</template-output>
    <action>Return</action>
  </check>

  <action>Read and parse {sprint_status_file}</action>

  <action>Validate required metadata fields exist: generated, last_updated, project, project_key, tracking_system, story_location</action>
  <check if="any required field missing">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Missing required metadata field(s): {{missing_fields}}"</template-output>
    <template-output>suggestion = "Re-run /bmad-sprint-planning or add missing fields manually"</template-output>
    <action>Return</action>
  </check>

  <action>Verify three data sections exist: epics (map or empty map {}), backlog (array or empty array []), sprints (map or empty map {})</action>
  <check if="any data section missing">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Missing data section(s): {{missing_sections}}. Expected: epics, backlog, sprints"</template-output>
    <template-output>suggestion = "Re-run /bmad-sprint-planning or repair the file manually to add missing sections"</template-output>
    <action>Return</action>
  </check>

  <action>Validate all epic status values: must be one of backlog, in-progress, done, on-hold, cancelled</action>
  <check if="invalid epic status found">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Invalid epic status value(s): {{invalid_epic_entries}}"</template-output>
    <template-output>suggestion = "Valid epic statuses: backlog, in-progress, done, on-hold, cancelled"</template-output>
    <action>Return</action>
  </check>

  <action>Validate all item status values (across backlog array and all sprints[*].items arrays): must be one of backlog, ready-for-dev, in-progress, review, done, on-hold, cancelled</action>
  <check if="invalid item status found">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Invalid item status value(s): {{invalid_item_entries}}"</template-output>
    <template-output>suggestion = "Valid item statuses: backlog, ready-for-dev, in-progress, review, done, on-hold, cancelled"</template-output>
    <action>Return</action>
  </check>

  <action>Validate all sprint status values: must be one of planning, active, closed</action>
  <check if="invalid sprint status found">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Invalid sprint status value(s): {{invalid_sprint_entries}}"</template-output>
    <template-output>suggestion = "Valid sprint statuses: planning, active, closed"</template-output>
    <action>Return</action>
  </check>

  <action>Check single-active-sprint constraint: count sprints with status == "active"</action>
  <check if="active_sprint_count > 1">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Multiple active sprints detected ({{active_sprint_count}}). At most one sprint may have status: active."</template-output>
    <template-output>suggestion = "Close or set other active sprints to planning status"</template-output>
    <action>Return</action>
  </check>

  <action>Spot check single-location invariant: sample up to 5 item IDs from across all locations and verify each ID appears in exactly one location (either backlog array OR one sprint's items array, never both)</action>
  <check if="any item found in multiple locations">
    <template-output>is_valid = false</template-output>
    <template-output>error = "Single-location invariant violated: item(s) {{duplicate_ids}} appear in multiple locations"</template-output>
    <template-output>suggestion = "Remove duplicate item entries — each item ID must appear in exactly one location"</template-output>
    <action>Return</action>
  </check>

  <template-output>is_valid = true</template-output>
  <template-output>message = "sprint-status.yaml valid: unified schema structure verified"</template-output>
</step>

</workflow>
