---
name: sprint-status-view
description: Display formatted sprint progress, backlog, and epic status from the unified sprint-status.yaml
type: skill
triggers:
  - "sprint status view"
  - "view sprint status"
  - "/sprint-status-view"
---

# Sprint Status View

Display a formatted, read-only dashboard of all sprint, backlog, and epic data from the unified `sprint-status.yaml` file.

> **READ-ONLY SKILL:** This skill NEVER writes to `sprint-status.yaml` or any other file. It is purely a display/reporting skill.

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
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query all sprint data for project `{jira_project_key}` at `{jira_url}`: active sprint with all its issues and their statuses, backlog issues count and list, epic summary and progress. Map Jira sprint states to canonical vocabulary (future → planning, active → active, closed → closed). Map Jira issue statuses to canonical statuses per the status mapping below. Use this data for the display — no writes. Status mapping: Backlog/Open → backlog, To Do/Selected for Development → ready-for-dev, In Progress → in-progress, In Review/Code Review → review, Done/Resolved → done, On Hold/Blocked → on-hold, Won't Do/Cancelled → cancelled.
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

## Step 1 — Load sprint-status.yaml

Resolve the path to `sprint-status.yaml` using the BMAD config:
- Check `_bmad/bmm/config.yaml` for `sprint_management_path` (if configured for multi-repo mode)
- Default path: `_bmad-output/implementation-artifacts/sprint-status.yaml`

Read the file. If it does not exist:
- Output: "No sprint-status.yaml found. Run `/bmad-sprint-planning` to initialize."
- Exit without error.

Parse all sections from the file:
- **Metadata:** `project`, `last_updated` (plus `generated`, `project_key`, `tracking_system`, `story_location` if present)
- **`epics`** — map of epic entries (keys: `epic-N`)
- **`backlog`** — array of unassigned item objects
- **`sprints`** — map of sprint entries (keys: `sprint-N`)

If the file exists but uses the old flat `development_status` schema (no `epics`/`backlog`/`sprints` sections), output:
"sprint-status.yaml uses the pre-Epic-17 schema. Run `/bmad-sprint-planning` to migrate to the unified schema."
Then exit.

---

## Step 2 — Classify Sprints

Partition the `sprints` map into three groups:
- **active** — entries where `status: active`
- **planning** — entries where `status: planning`
- **closed** — entries where `status: closed`

Sort each group by sprint key (`sprint-N`) ascending by numeric value of N.

---

## Step 3 — Render Header

Output:

```
# Sprint Status — {project}
*Last updated: {last_updated}*

---
```

---

## Step 4 — Render Active Sprints

If there are active sprints, output a `## Active Sprints` section header.

For each active sprint (sorted by key ascending):

1. Sprint header:
   ```
   ### {sprint.name}
   **Status:** active | **Capacity:** {items.length} / {capacity} | **Start:** {start or "—"} | **End:** {end or "—"}
   ```
   If `items.length > capacity`, append inline: `⚠️ over capacity by {items.length - capacity} item(s)`

2. Items table (if items array is non-empty):
   ```
   | Item | Title | Type | Status | Severity |
   |------|-------|------|--------|----------|
   | {id} | {title} | Story | {status} | — |
   | {id} | {title} | Bug   | {status} | {severity} |
   ```
   - Type column: use "Story" for `type: story`, "Bug" for `type: bug`
   - Severity column: show severity value for bugs, "—" for stories

3. If items array is empty, output: `*(No items assigned to this sprint)*`

---

## Step 5 — Render Planning Sprints

If there are planning sprints, output a `## Planning Sprints` section header.

For each planning sprint (sorted by key ascending), use the same format as Step 4 with `status: planning`.

---

## Step 6 — Render Closed Sprint Summaries

If there are closed sprints, output a `## Closed Sprints` section header followed by a summary table:

```
| Sprint | Items | Start | End |
|--------|-------|-------|-----|
| {sprint.name} | {items.length} items (archived) | {start or "—"} | {end or "—"} |
```

Do NOT list individual items within closed sprints (collapsed view by default).

---

## Step 7 — Render Backlog

Count total backlog items: `{backlog.length}`.

Output a `## Backlog — {backlog.length} items` section header.

If backlog is empty, output: `*(No items in backlog)*`

Otherwise, output a table in array order (position = priority):

```
| # | Item | Title | Type | Status | Severity |
|---|------|-------|------|--------|----------|
| 1 | {id} | {title} | Story | {status} | — |
| 2 | {id} | {title} | Bug   | {status} | {severity} |
```

- `#` column: 1-based position in the array (= priority rank)
- Severity column: show severity for bugs, "—" for stories

---

## Step 8 — Render Epics Overview

Output a `## Epics` section header.

If the `epics` map is empty, output: `*(No epics defined)*`

Otherwise, for each epic in the map (sorted by key ascending by numeric value of N):

1. Count items referencing this epic across all sections:
   - Scan `backlog` items where `epic == N` (N = epic number, e.g., `17` for `epic-17`)
   - Scan all `sprints[*].items` where `epic == N`
   - Tally counts by status

2. Output a table row:
   ```
   | Epic | Status | Retrospective | Items (active) |
   |------|--------|---------------|----------------|
   | epic-4 | on-hold | optional | {count} total ({status breakdown}) |
   ```
   - Status breakdown: list non-zero status counts, e.g., "2 in-progress, 1 ready-for-dev"
   - If no items reference the epic, show "0 total"
   - `retrospective` field: show value or "—" if null

---

## Step 9 — Render Alerts (Conditional)

Scan for alert conditions:

1. **Over-capacity sprints:** Any sprint where `items.length > capacity`
   - Alert: `Over capacity: {sprint.name} is over capacity by {items.length - capacity} item(s) ({items.length} / {capacity})`

2. **Stale in-progress items:** Items with `status: in-progress` in **active** sprints where the sprint's `start` date is more than 14 days before today
   - Alert: `Stale in-progress: {item.id} has been in-progress for {N} days ({sprint.name} started {start})`

3. **Empty active sprints:** Active sprints with zero items
   - Alert: `Empty active sprint: {sprint.name} is active but has no items assigned`

If NO alert conditions exist, omit this section entirely (do not output "No alerts" or any placeholder).

If alerts exist, output a `## Alerts` section header followed by a bulleted list.

