# bmad-sprint-status

Analyze sprint health, surface risk flags, and recommend next actions from the unified `sprint-status.yaml`.

**READ-ONLY:** This skill NEVER writes to `sprint-status.yaml` or any other file.

**Path resolution:** This skill resolves paths directly from the project structure. The sprint status file is at `_bmad-output/implementation-artifacts/sprint-status.yaml` relative to the project root. The done folder is at `_bmad-output/implementation-artifacts/done/`.

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

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query the active sprint for project `{jira_project_key}` at `{jira_url}` and retrieve all sprint issues with their statuses. Query backlog issue count. Query epic progress (completed stories per epic). Map Jira sprint states and issue statuses to canonical vocabulary per the status mapping below. Use this data for health analysis — no writes. Status mapping: Backlog/Open → backlog, To Do/Selected for Development → ready-for-dev, In Progress → in-progress, In Review/Code Review → review, Done/Resolved → done, On Hold/Blocked → on-hold, Won't Do/Cancelled → cancelled.
      Use whatever Jira-capable tool is available in your current tool context.
      Resolve the operating user from the Jira tool's OWN authenticated identity: in JQL,
      `assignee = currentUser()`. Jira evaluates `currentUser()` against the credential the
      tool already holds, so it needs no configuration and never goes stale. Do NOT derive
      the user from the OS login name and do NOT store a Jira user id in config — a local
      account name has no defined relation to an Atlassian accountId (it resolves to nothing
      on Cloud, and can silently resolve to a DIFFERENT person on Server/DC where directory
      usernames collide).
      Whenever the request is scoped to the operator — "my issues", "assigned to me", "what
      should I work on" — add `AND assignee = currentUser()` to the JQL.
      If `currentUser()` resolves to no user (a shared service-account token), STOP and tell
      the user that the Jira tool is authenticated as a shared account, so user-scoped
      queries are unavailable. Do NOT silently widen the query back to whole-project scope.
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

## Invocation Modes

This skill supports three execution modes. Set `mode` before invoking:

- `mode = interactive` (default) — full health summary with risk flags and interactive action menu
- `mode = data` — structured key-value output for consumption by other skills/workflows
- `mode = validate` — schema validation of sprint-status.yaml against the unified schema

---

## Step 0: Determine Execution Mode

Set `mode` = value provided by caller; if not provided, default to `"interactive"`.

- If `mode == "data"` → skip to Step 20
- If `mode == "validate"` → skip to Step 30
- If `mode == "interactive"` → continue to Step 1

---

## Step 1: Locate and Load sprint-status.yaml

1. Try to read `_bmad-output/implementation-artifacts/sprint-status.yaml` from the project root.
2. If file not found: output `"No sprint-status.yaml found. Run /bmad-sprint-planning to initialize."` and stop.
3. Parse YAML — extract:
   - Metadata fields: `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`
   - Three data sections: `epics` (map), `backlog` (array), `sprints` (map)

---

## Step 2: Analyze Active Sprint Health

1. Scan the `sprints` map for the entry with `status: active`.
2. If no active sprint found: set `active_sprint = null` and skip to Step 2b.
3. If active sprint found, store it and compute:
   - `items_by_status`: count items in `active_sprint.items` grouped by `status` field
   - `capacity_used` = length of `active_sprint.items` array
   - `capacity_total` = `active_sprint.capacity`
   - `capacity_pct` = `round((capacity_used / capacity_total) * 100)` if `capacity_total > 0`, else `0`
   - If `active_sprint.start` is populated: `sprint_age_days` = days between `active_sprint.start` and today

---

## Step 2b: Analyze Backlog Health

1. `backlog_total` = length of `backlog` array
2. `backlog_bugs` = count of backlog items where `type == "bug"`
3. `backlog_stories` = `backlog_total - backlog_bugs`
4. `backlog_critical_bugs` = count of backlog bugs where `severity == "critical"` or `severity == "high"`

---

## Step 2c: Compute Epic Progress

For each epic key in the `epics` map:

1. `epic_number` = numeric portion of key (e.g., `"epic-17"` → `17`)
2. `active_count` = count of items across `backlog` array AND all `sprints[*].items` arrays where `item.epic == epic_number`
3. `done_count` = count of files in `_bmad-output/implementation-artifacts/done/` whose filename starts with `"{epic_number}-"` (e.g., `"17-*.md"`)
4. `total_count` = `done_count + active_count`
5. Store: `{epic_key, status, retrospective, done_count, active_count, total_count}`

---

## Step 2d: Compute Sprint History

1. `closed_sprints` = all sprint entries where `status == "closed"`
2. `closed_count` = length of `closed_sprints`
3. For each closed sprint: capture `name`, item count (length of `items` array), `start`, `end`

---

## Step 3: Detect Risk Flags

Initialize `risks = []` (empty list). Check each risk condition and append messages as applicable:

**Risk: No active sprint**
- If `active_sprint == null`: append `"No active sprint — consider running /add-sprint to create one or activating a planning sprint"`

**Risk: Stale in-progress items** (sprint has been running for more than 14 days)
- If `active_sprint` exists AND `sprint_age_days > 14`: for each item in `active_sprint.items` with `status == "in-progress"`:
  append `"Item {item.id} has been in-progress for {sprint_age_days} days (sprint started {active_sprint.start})"`

**Risk: Items not started**
- If `active_sprint` exists: count items where `status == "ready-for-dev"` or `status == "backlog"` → `not_started_count`
- If `not_started_count > 0`: append `"{not_started_count} of {capacity_used} items still in ready-for-dev status — not yet started"`

**Risk: Over-capacity**
- If `active_sprint` exists AND `capacity_total > 0` AND `capacity_used > capacity_total`:
  `overage = capacity_used - capacity_total`
  append `"Sprint over capacity: {capacity_used}/{capacity_total} items ({overage} over limit)"`

**Risk: At capacity with unstarted items**
- If `active_sprint` exists AND `capacity_total > 0` AND `capacity_used >= capacity_total` AND `not_started_count > 0`:
  append `"Sprint at {capacity_pct}% capacity ({capacity_used}/{capacity_total}) with {not_started_count} items still in ready-for-dev"`

**Risk: No progress toward completion** (only flag if sprint is at least 3 days old)
- If `active_sprint` exists AND `sprint_age_days >= 3`:
  `review_or_done_count` = count of items where `status == "review"` or `status == "done"`
  If `review_or_done_count == 0`: append `"No items in review or done — sprint may be at risk (sprint is {sprint_age_days} days old)"`

**Risk: On-hold or cancelled items in active sprint**
- If `active_sprint` exists: for each item where `status == "on-hold"` or `status == "cancelled"`:
  append `"1 item {item.status}: {item.id}"`

**Risk: Stale sprint-status.yaml file**
- `staleness_date` = `last_updated` if present, else `generated`
- `file_age_days` = days between `staleness_date` and today
- If `file_age_days > 7`: append `"\`last_updated\` is {file_age_days} days old — sprint-status.yaml may be stale"`

**Risk: Orphaned stories** (item references epic not in epics section)
- For each item in `backlog` array AND each item in all `sprints[*].items` arrays:
  If `item.epic` is not null AND `"epic-{item.epic}"` does not exist in `epics` map:
  append `"Orphaned story detected: item {item.id} references epic-{item.epic} which is not in the epics section"`

**Risk: In-progress epic with no stories**
- For each epic in `epics` map where `epic.status == "in-progress"`:
  If `active_count == 0` AND `done_count == 0`:
  append `"In-progress epic {epic_key} has no associated stories"`

**Risk: Critical/high bugs in backlog**
- For each item in `backlog` array where `type == "bug"` AND (`severity == "critical"` or `severity == "high"`):
  append `"Critical/high severity bug in backlog: {item.id} ({item.severity})"`

---

## Step 4: Select Next Action Recommendation

Priority order (highest to lowest). When selecting "first" item: prefer active sprint items over backlog items; within each group, sort by epic number then story number.

1. If any item in `active_sprint.items` has `status == "in-progress"` → `next_workflow_id = "dev-story"`, `next_story_id` = first such item's id
2. Else if any item in `active_sprint.items` has `status == "review"` → `next_workflow_id = "code-review"`, `next_story_id` = first such item's id
3. Else if any item in `active_sprint.items` OR `backlog` has `status == "ready-for-dev"` → `next_workflow_id = "dev-story"`, `next_story_id` = first such item's id
4. Else if any item in `backlog` has `status == "backlog"` → `next_workflow_id = "create-story"`, `next_story_id` = first such item's id
5. Else if any epic has `retrospective == "optional"` AND `status == "done"` → `next_workflow_id = "retrospective"`, `next_story_id` = that epic's key
6. Else → `next_workflow_id = null`, `next_story_id = null` (all work complete)

---

## Step 5: Display Interactive Health Summary

Output this health summary (replace all `{{...}}` with computed values):

```
## Sprint Health Summary

- Project: {{project}} ({{project_key}})
- Tracking: {{tracking_system}}
- Last updated: {{last_updated}}

### Active Sprint: {{active_sprint.name}}
(If no active sprint: "No active sprint found.")
**Capacity:** {{capacity_used}} / {{capacity_total}} ({{capacity_pct}}%)
**Dates:** {{active_sprint.start}} to {{active_sprint.end}}
**Items by status:** in-progress {{n}}, review {{n}}, ready-for-dev {{n}}, backlog {{n}}, on-hold {{n}}

### Risk Flags
- {{risk_1}}
- {{risk_2}}
(or "No risks detected." if empty)

### Backlog Health
- Total unassigned: {{backlog_total}} ({{backlog_stories}} stories, {{backlog_bugs}} bugs)
- Critical/high bugs in backlog: {{backlog_critical_bugs}}

### Epic Progress
- {{epic_key}} ({{status}}): {{done_count}}/{{total_count}} done
(one line per epic)

### Sprint History
- {{closed_count}} closed sprint(s)
- {{sprint_name}}: {{item_count}} items, {{start}} to {{end}}
(one line per closed sprint)

### Next Recommendation
/{{next_workflow_id}} ({{next_story_id}})
(or "All work complete — great job!" if no recommendation)
```

---

## Step 6: Offer Interactive Actions

Present the following menu and handle the user's choice:

```
Pick an option:
1) Run recommended workflow now
2) Show all items grouped by status (active sprint + backlog)
3) Show detailed sprint view (runs /sprint-status-view)
4) Show raw sprint-status.yaml
5) Exit
Choice:
```

- **Choice 1:** If `next_workflow_id` is null, output "No workflow to run — all work is complete." Otherwise output: `"Run /{next_workflow_id}. If the command targets a story, set story_key={next_story_id} when prompted."`
- **Choice 2:** List items grouped by status: in-progress, review, ready-for-dev (sprint), ready-for-dev (backlog), backlog (unassigned). Show `id: title` per item.
- **Choice 3:** Output: `"For a full formatted table view with all items, run /sprint-status-view."`
- **Choice 4:** Display the full contents of `sprint-status.yaml`.
- **Choice 5:** Exit.

---

## Step 20: Data Mode Output

Load and parse sprint-status.yaml (same as Steps 1–2d), detect risks (same as Step 3), compute recommendation (same as Step 4), then output these key-value pairs:

```
active_sprint_id = {{active_sprint_id}}
active_sprint_name = {{active_sprint_name}}
next_workflow_id = {{next_workflow_id}}
next_story_id = {{next_story_id}}
count_backlog = {{count_backlog}}
count_ready = {{count_ready}}
count_in_progress = {{count_in_progress}}
count_review = {{count_review}}
count_done = {{count_done}}
count_on_hold = {{count_on_hold}}
capacity_used = {{capacity_used}}
capacity_total = {{capacity_total}}
capacity_pct = {{capacity_pct}}
backlog_total = {{backlog_total}}
backlog_bugs = {{backlog_bugs}}
backlog_critical_bugs = {{backlog_critical_bugs}}
epic_summary = {{epic_summary}}
risks = {{risks}}
```

**Count field semantics:**
- `count_backlog` = items with `status "backlog"` across active sprint items + backlog array
- `count_ready` = items with `status "ready-for-dev"` across active sprint items + backlog array
- `count_in_progress` = items with `status "in-progress"` in active sprint
- `count_review` = items with `status "review"` in active sprint
- `count_done` = items with `status "done"` in active sprint (does not count `done/` archived items)
- `count_on_hold` = items with `status "on-hold"` or `"cancelled"` in active sprint

**Backward compatibility:** `count_backlog`, `count_ready`, `count_in_progress`, `count_review`, `count_done`, `next_workflow_id`, `next_story_id`, and `risks` are preserved from the original built-in data mode output. The additional keys (`active_sprint_id`, `active_sprint_name`, `capacity_*`, `backlog_*`, `epic_summary`, `count_on_hold`) are new extensions that do not break existing consumers.

Return output to caller.

---

## Step 30: Validate Mode

Validate `_bmad-output/implementation-artifacts/sprint-status.yaml` against the unified schema. Return `is_valid`, `error`, `suggestion` (or `message`) keys.

1. **File exists?** If not: `is_valid = false`, `error = "sprint-status.yaml missing"`, `suggestion = "Run /bmad-sprint-planning to create it"`

2. **Required metadata fields present?** Check: `generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`. If any missing: `is_valid = false`, `error = "Missing required metadata field(s): {missing_fields}"`, `suggestion = "Re-run /bmad-sprint-planning or add missing fields manually"`

3. **Three data sections present?** Check: `epics` (map or `{}`), `backlog` (array or `[]`), `sprints` (map or `{}`). If any missing: `is_valid = false`, `error = "Missing data section(s): {missing_sections}. Expected: epics, backlog, sprints"`, `suggestion = "Re-run /bmad-sprint-planning or repair the file manually"`

4. **Valid epic statuses?** Check all epic `status` values against: `backlog`, `in-progress`, `done`, `on-hold`, `cancelled`. If invalid: `is_valid = false`, `error = "Invalid epic status value(s): {invalid_entries}"`, `suggestion = "Valid epic statuses: backlog, in-progress, done, on-hold, cancelled"`

5. **Valid item statuses?** Check all item `status` values (across `backlog` array AND all `sprints[*].items` arrays) against: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `on-hold`, `cancelled`. If invalid: `is_valid = false`, `error = "Invalid item status value(s): {invalid_entries}"`, `suggestion = "Valid item statuses: backlog, ready-for-dev, in-progress, review, done, on-hold, cancelled"`

6. **Valid sprint statuses?** Check all sprint `status` values against: `planning`, `active`, `closed`. If invalid: `is_valid = false`, `error = "Invalid sprint status value(s): {invalid_entries}"`, `suggestion = "Valid sprint statuses: planning, active, closed"`

7. **Single active sprint?** Count sprints with `status: active`. If count > 1: `is_valid = false`, `error = "Multiple active sprints detected ({count}). At most one sprint may have status: active."`, `suggestion = "Close or set other active sprints to planning status"`

8. **Single-location invariant (spot check)?** Sample up to 5 item IDs from all locations. Verify each ID appears in exactly one location (either `backlog` array OR one sprint's `items` array, never both). If duplicate: `is_valid = false`, `error = "Single-location invariant violated: item(s) {duplicate_ids} appear in multiple locations"`, `suggestion = "Remove duplicate item entries — each item ID must appear in exactly one location"`

9. **All checks passed:** `is_valid = true`, `message = "sprint-status.yaml valid: unified schema structure verified"`
