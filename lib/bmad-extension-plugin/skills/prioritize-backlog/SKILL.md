---
name: prioritize-backlog
description: Reprioritize backlog items in sprint-status.yaml using multiple criteria -- severity, business value, dependencies, type, age
type: skill
triggers:
  - "prioritize backlog"
  - "reprioritize backlog"
  - "sort backlog"
---

# Prioritize Backlog

Reprioritize backlog items in `sprint-status.yaml` using multiple criteria: severity, business value, dependencies, type, and age.

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
   a. Perform the Jira operation: Query all backlog issues (not assigned to any sprint) for project `{jira_project_key}` at `{jira_url}`. Apply the prioritization criteria specified by the user. Reorder the issues in the board backlog by updating the issue rank/priority order (use whatever ranking capability is available on the board — NextGen board issue ranking or classic board priority field). Map canonical priority back to Jira fields.
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
  <action>Determine the path to `sprint-status.yaml`:
  1. Check `_bmad/bmm/config.yaml` for an `artifacts_path` or `sprint_status_path` override.
  2. If not set, default to `_bmad-output/implementation-artifacts/sprint-status.yaml`.
  </action>
  <action>Read the resolved `sprint-status.yaml` path.</action>
  <check if="sprint-status.yaml does not exist">
    <output>No sprint-status.yaml found. Run sprint planning first to initialize the file.</output>
    <action>Exit workflow — do not create any file.</action>
  </check>
  <action>Parse the full file: read `epics`, `backlog`, and `sprints` sections plus all metadata fields (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`). Store the entire parsed structure as {{file_data}} for later atomic write.</action>
  <check if="legacy backlog.yaml exists in the same directory as sprint-status.yaml">
    <output>Note: Legacy backlog.yaml detected. Run migration to consolidate.</output>
    <action>Continue — do NOT read from or write to the legacy file. Operate on sprint-status.yaml only.</action>
  </check>
  <check if="{{file_data.backlog}} is empty or null">
    <output>Backlog is empty. Nothing to prioritize.</output>
    <action>Exit workflow — do not modify the file.</action>
  </check>
  <action>Store {{backlog_items}} = {{file_data.backlog}} (the array of items to work with).</action>
  <action>Store {{original_order}} = copy of {{backlog_items}} with their current priority values, for use in the change summary later.</action>
</step>

<step n="1" goal="Display current backlog order">
  <action>Read {{backlog_items}} in their current array order (position 0 = highest priority).</action>
  <output>
## Current Backlog ({{backlog_items.length}} items)

| Priority | ID | Title | Type | Epic | Severity | Status |
|---|---|---|---|---|---|---|
{{#each backlog_items}}
| {{priority}} | {{id}} | {{title}} | {{type}} | {{#if epic}}epic-{{epic}}{{else}}—{{/if}} | {{severity or "—"}} | {{status}} |
{{/each}}

*Note: Items assigned to sprints are not shown — only unassigned backlog items are listed here.*
  </output>
</step>

<step n="2" goal="Choose prioritization mode">
  <ask>Select a prioritization mode:

**[f] Full** — Interactive: generates a suggested order, presents current vs proposed side-by-side. You review and approve (or adjust) before any write occurs.
**[q] Quick** — Automated: applies default multi-criteria rules immediately, then shows a summary of what moved.
**[a] Auto-suggest** — Read-only: shows the suggested order with per-item rationale. No file is modified.
**[x] Cancel** — Exit without changes.

Choice:</ask>
  <check if="user selects 'x'">
    <output>Cancelled — no changes made.</output>
    <action>Exit workflow.</action>
  </check>
  <action>Store {{selected_mode}} = user choice.</action>
</step>

<step n="3" goal="Multi-criteria prioritization analysis">
  <action>For each item in {{backlog_items}}, compute a composite priority score using the following weighted criteria (highest weight listed first):</action>

  <action>**1. Severity weight (highest impact):**
  - `severity: critical` → +40 points
  - `severity: high`     → +30 points
  - `severity: medium`   → +10 points
  - `severity: low`      → +5 points
  - `severity: null`     → +0 points (no adjustment for stories)
  </action>

  <action>**2. Business value weight:**
  - Use the item's existing `priority` value as a signal for current business value ranking. Items with lower `priority` values (higher priority) receive a proportional boost: score += max(0, ({{backlog_items.length}} - current_priority + 1) * 2). This preserves existing prioritization signals while allowing other criteria to override.
  - Items from lower-numbered epics (or `epic: null`) receive a slight additional boost: score += max(0, (20 - epic_number)) * 1, treating null as epic 0.
  </action>

  <action>**3. Dependency weight:**
  - Resolve `{planning_artifacts}` from the `planning_artifacts:` field of `_bmad/bmm/config.yaml` — epics are a *software requirements* artifact (FR256) whose store may live in another repository, so the path is read rather than assumed, and is never derived from `sprint_management_path` (FR267). Only Step P2's genuinely pre-F26 config may lack the field; there it has always been `{project-root}/_bmad-output/planning-artifacts`.
  - Read `{planning_artifacts}/epics.md` if it exists to identify explicit inter-story dependencies.
  - Within the same epic, items with lower story numbers are assumed to be prerequisites for higher-numbered stories. Items that block others get a +15 point boost.
  - Items that are explicitly blocked by other UNASSIGNED backlog items get a -10 point adjustment (they cannot proceed anyway).
  - If epics.md cannot be read or does not define explicit dependencies, use only the intra-epic ordering heuristic.
  </action>

  <action>**4. Type weight (tiebreaker):**
  - `type: bug` → +3 points (bugs receive a slight boost over stories at equal composite score)
  - `type: story` → +0 points
  </action>

  <action>**5. Age weight (starvation prevention — weakest signal):**
  - Items from epics with lower epic numbers receive +1 point per 5 epic numbers below the maximum epic in the backlog (e.g., if max epic is 17, epic-12 gets +1, epic-7 gets +2).
  - Items with `epic: null` are treated as oldest (receive the maximum age boost among all items).
  - This is a tiebreaker only — it prevents starvation but does not override higher-priority signals.
  </action>

  <action>Compute {{composite_score}} for each item = severity_score + business_value_score + dependency_score + type_score + age_score.</action>
  <action>Sort items by {{composite_score}} descending (highest score = priority 1). Break ties by current `priority` value (lower = higher priority stays higher).</action>
  <action>Store {{suggested_order}} = sorted list of items. Store {{rationale_map}} = per-item map of score breakdown and reason summary.</action>
</step>

<step n="3a" goal="Full mode: present comparison and get approval" condition="{{selected_mode}} == 'f'">
  <output>
## Prioritization Analysis: Current vs Suggested

| Current Priority | ID | Suggested Priority | Change | Key Rationale |
|---|---|---|---|---|
{{#each original_order}}
| {{priority}} | {{id}} | {{suggested_position}} | {{change_indicator}} | {{rationale}} |
{{/each}}

*Items highlighted with ↑ move up, ↓ move down, = stay in place.*
  </output>
  <ask>Options:
- **[a]** Accept the suggested order as-is
- **[m]** Manually adjust — enter item IDs in your preferred order (comma-separated)
- **[c]** Cancel — exit without changes

Choice:</ask>
  <check if="user selects 'c'">
    <output>Cancelled — no changes made.</output>
    <action>Exit workflow.</action>
  </check>
  <check if="user selects 'a'">
    <action>Set {{final_order}} = {{suggested_order}}.</action>
  </check>
  <check if="user selects 'm'">
    <ask>Enter item IDs in your preferred priority order (highest priority first), comma-separated. You MUST include all {{backlog_items.length}} items — no duplicates or omissions allowed:
Example: 17-10-rework-generate-backlog, 17-11-rework-add-to-sprint, ...</ask>
    <action>Parse the user-provided list into {{manual_order_ids}}.</action>
    <action>Validate:
    - Count must equal {{backlog_items.length}} (no missing items)
    - All IDs must exist in {{backlog_items}} (no unknown IDs)
    - No duplicate IDs
    </action>
    <check if="validation fails">
      <output>Invalid input: {{validation_error}}. Please re-enter the complete list of all {{backlog_items.length}} item IDs in your preferred order.</output>
      <action>Repeat the manual-entry prompt until valid input is received or user cancels.</action>
    </check>
    <action>Reorder {{backlog_items}} to match {{manual_order_ids}} sequence. Set {{final_order}} = reordered list.</action>
  </check>
  <action>Proceed to Step 4 with {{final_order}}.</action>
</step>

<step n="3b" goal="Quick mode: apply suggested order automatically" condition="{{selected_mode}} == 'q'">
  <action>Set {{final_order}} = {{suggested_order}}.</action>
  <action>Proceed to Step 4 with {{final_order}}.</action>
</step>

<step n="3c" goal="Auto-suggest mode: display suggestions without writing" condition="{{selected_mode}} == 'a'">
  <output>
## Suggested Backlog Order (Read-Only — No Changes Written)

| New Priority | ID | Title | Old Priority | Change | Rationale |
|---|---|---|---|---|---|
{{#each suggested_order}}
| {{new_priority}} | {{id}} | {{title}} | {{old_priority}} | {{change_indicator}} | {{rationale}} |
{{/each}}

**Summary:**
- Items that would move up: {{move_up_count}}
- Items that would move down: {{move_down_count}}
- Items unchanged: {{unchanged_count}}

Suggestions displayed. No changes written. Run again in Full or Quick mode to apply.
  </output>
  <action>Exit workflow — do NOT proceed to Step 4.</action>
</step>

<step n="4" goal="Apply reordering and persist">
  <action>Take {{final_order}} (from Full or Quick mode).</action>
  <action>Renumber `priority` field on each item sequentially: position 0 in the array gets `priority: 1`, position 1 gets `priority: 2`, and so on through position N-1 gets `priority: N`. This keeps the denormalized index in sync with array position (schema section 3.3).</action>
  <action>Get the current ISO-8601 timestamp (format: YYYY-MM-DDTHH:MM:SS). Update {{file_data.last_updated}} to this timestamp.</action>
  <action>Preserve {{file_data.generated}} unchanged.</action>
  <action>Preserve {{file_data.epics}} section unchanged — do NOT modify any epic entries.</action>
  <action>Preserve {{file_data.sprints}} section unchanged — do NOT modify any sprint entries or items within sprints.</action>
  <action>Set {{file_data.backlog}} = {{final_order}} (the reordered array with renumbered priorities).</action>
  <action>Write the complete updated {{file_data}} back to the resolved sprint-status.yaml path in a single atomic write (read-modify-write pattern). This single write replaces the file entirely — no partial updates.</action>
</step>

<step n="5" goal="Display summary output">
  <action>Compute change summary by comparing {{original_order}} (old positions) against {{final_order}} (new positions).</action>
  <output>
## Reprioritization Complete

**Mode:** {{mode_label}} ({{current_datetime}})
**Items reordered:** {{backlog_items.length}} total

### Changes Made

| ID | Title | Old Priority | New Priority | Direction |
|---|---|---|---|---|
{{#each changed_items}}
| {{id}} | {{title}} | {{old_priority}} | {{new_priority}} | {{direction}} |
{{/each}}

{{#if unchanged_items.length > 0}}
**Unchanged ({{unchanged_items.length}} items):** {{unchanged_ids_list}}
{{/if}}

**sprint-status.yaml updated successfully.**

**Next steps:**
- `/add-to-sprint` — Assign the top-priority backlog items to the current sprint
- `/sprint-status-view` — View overall sprint progress and capacity
  </output>
</step>

</workflow>
