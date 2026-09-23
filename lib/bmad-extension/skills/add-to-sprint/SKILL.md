---
name: add-to-sprint
description: Move backlog items to a sprint in the unified sprint-status.yaml using movement semantics
type: skill
triggers:
  - "add to sprint"
  - "assign to sprint"
---

# Add-to-Sprint Workflow

Guided workflow to move backlog items to a sprint in the unified `sprint-status.yaml` using movement semantics.

**Movement semantics:** Each item exists in exactly one location — either the `backlog` array OR a sprint's `items` array, never both. This skill atomically removes items from `backlog` and appends them to the target sprint's `items` array in a single file write.

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
   a. Perform the Jira operation: Find the Jira issue matching the item ID in project `{jira_project_key}` at `{jira_url}` (search by issue key or summary). Find the active sprint on the board for project `{jira_project_key}`. Move the issue to the active sprint using the "add issue to sprint" operation.
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

4. **File-System Backend** — execute the workflow steps below.

---

<workflow>

<step n="0" goal="Load configuration and validate file existence">
  <action>Resolve the path to `sprint-status.yaml`:
    1. If `_bmad/bmm/config.yaml` exists, read `sprint_management_path` from it; the file is at `{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml`
    2. Otherwise, use the default single-repo path: `_bmad-output/implementation-artifacts/sprint-status.yaml`
  </action>
  <check if="file does not exist at resolved path">
    <output>❌ No sprint-status.yaml found. Run `/bmad-sprint-planning` first to initialize the file.</output>
    <action>Exit workflow</action>
  </check>
  <action>Read and parse the full file: `epics`, `backlog`, and `sprints` sections plus metadata fields</action>
  <action>Store the complete parsed document as {{sprint_status}} for atomic write-back later</action>
</step>

<step n="1" goal="Identify assignable sprints">
  <action>Parse the `sprints` map from {{sprint_status}}</action>
  <action>Filter to sprints with `status: planning` or `status: active` — exclude `status: closed` sprints</action>
  <check if="no assignable sprints remain (all sprints are closed or sprints map is empty)">
    <output>❌ No assignable sprints found. Run `/add-sprint` first to create a sprint before assigning items.</output>
    <action>Exit workflow</action>
  </check>
  <check if="exactly one assignable sprint">
    <action>Auto-select it as {{target_sprint}} (skip selection prompt)</action>
    <output>ℹ️ Auto-selected the only assignable sprint: **{{target_sprint.name}}** ({{target_sprint.status}})</output>
  </check>
  <check if="multiple assignable sprints">
    <action>Build a sprint selection table from the assignable sprints</action>
    <output>
## Available Sprints

| # | Sprint | Status | Capacity | Assigned | Remaining |
|---|--------|--------|----------|----------|-----------|
{{#each assignable_sprints}}
| {{@index+1}} | {{name}} | {{status}} | {{capacity}} | {{items.length}} | {{capacity - items.length}} |
{{/each}}
    </output>
    <ask>Select target sprint (enter number):</ask>
    <action>Resolve entered number to the corresponding sprint entry and store as {{target_sprint}} (the sprint's map key and full sprint object)</action>
  </check>
</step>

<step n="2" goal="Display backlog items eligible for sprint assignment">
  <action>Read the `backlog` array from {{sprint_status}}</action>
  <action>Filter to items with `status: ready-for-dev` ONLY — schema section 4.5 movement rules require this status for sprint assignment</action>
  <check if="no ready-for-dev items exist in the backlog">
    <output>❌ No items eligible for sprint assignment. Items must have `status: ready-for-dev` to be added to a sprint. Items with `status: backlog` must first have a story file created (which advances them to `ready-for-dev`).</output>
    <action>Exit workflow</action>
  </check>
  <action>Display eligible backlog items in priority order (array order = priority order, position 0 = highest priority)</action>
  <output>
## Backlog Items (eligible for sprint assignment)

| # | ID | Title | Type | Epic | Severity |
|---|-----|-------|------|------|----------|
{{#each eligible_backlog_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{epic}} | {{severity}} |
{{/each}}

*Total eligible: {{eligible_count}} items (status: ready-for-dev)*
  </output>
</step>

<step n="3" goal="Display sprint capacity">
  <action>Calculate capacity usage: current assigned count = `{{target_sprint.items.length}}`</action>
  <action>Calculate remaining = `{{target_sprint.capacity}} - {{target_sprint.items.length}}`</action>
  <output>
## Sprint Capacity: {{target_sprint.name}}

- **Capacity:** {{target_sprint.capacity}} items
- **Assigned:** {{target_sprint.items.length}} items
- **Remaining:** {{remaining_capacity}} slots

{{#if remaining_capacity <= 0}}
⚠️ This sprint is **at or over capacity**. Adding items will exceed the limit.
{{/if}}
  </output>
</step>

<step n="4" goal="Select candidate items for this sprint">
  <ask>Which backlog items do you want to consider for this sprint? Enter item numbers (comma-separated), or "all" to evaluate the full eligible backlog:</ask>
  <check if="user enters 'all'">
    <action>Set {{candidate_items}} = all items from the eligible backlog list displayed in step 2</action>
  </check>
  <check if="user enters item numbers">
    <action>Resolve the entered numbers against the eligible backlog table from step 2</action>
    <action>Validate all entered numbers correspond to displayed items — report error for any invalid numbers</action>
    <action>Set {{candidate_items}} = those specific items</action>
  </check>
</step>

<step n="5" goal="Multi-criteria prioritization analysis">
  <action>For each item in {{candidate_items}}, evaluate and score across criteria:
    - **Business value:** High (H) / Medium (M) / Low (L) — impact on users or project goals
    - **Dependency status:** Blocked (blocked by another item) / Blocking (blocks other items) / Independent
    - **Severity** (bugs only): Critical / High / Medium / Low — N/A for stories
    - **Effort estimation:** Small (S ≤ 1 day) / Medium (M 2–3 days) / Large (L 4+ days)
  </action>
  <action>Generate a ranked ordering recommendation, factoring in:
    1. Blocking dependencies first (items that unlock others)
    2. High business value + low/medium effort (quick wins)
    3. Critical/High bugs ahead of Medium/Low bugs
    4. Avoid blocked items unless capacity allows waiting
  </action>
  <output>
## Prioritization Analysis

| Rank | ID | Title | Type | Business Value | Dependencies | Severity | Effort | Rationale |
|------|----|-------|------|----------------|--------------|----------|--------|-----------|
{{#each ranked_items}}
| {{rank}} | {{id}} | {{title}} | {{type}} | {{business_value}} | {{dependency_status}} | {{severity}} | {{effort}} | {{rationale}} |
{{/each}}

**Recommended selection** (up to {{remaining_capacity}} items to stay within capacity): {{recommended_selection}}
  </output>
</step>

<step n="6" goal="User confirms or adjusts selection">
  <ask>Review the ranking above. Options:
- [c] Confirm recommended selection as-is
- [m] Modify selection (specify item numbers to include)
- [r] Re-rank items (provide new priority order)
- [x] Cancel without assigning

Choice:</ask>
  <check if="user selects 'x'">
    <output>❌ Assignment cancelled — no changes made.</output>
    <action>Exit workflow</action>
  </check>
  <check if="user selects 'm'">
    <ask>Enter item numbers to assign (comma-separated):</ask>
    <action>Resolve entered numbers against the eligible backlog table from step 2</action>
    <action>Set {{confirmed_items}} = those specific items</action>
  </check>
  <check if="user selects 'r'">
    <ask>Enter item numbers in your preferred priority order (comma-separated). Only items you include will be assigned — items not listed will be excluded from this session and remain in the backlog:</ask>
    <action>Set {{confirmed_items}} = items matching the user-provided numbers, in the order provided. Items from {{candidate_items}} NOT mentioned are excluded from this session (they remain in the backlog for future sprints).</action>
  </check>
  <check if="user selects 'c'">
    <action>Set {{confirmed_items}} = recommended selection from step 5</action>
  </check>
  <action>Store confirmed ranking in {{confirmed_ranking}} for the audit record</action>
</step>

<step n="7" goal="Execute movement with capacity enforcement">
  <action>Initialize {{current_sprint_count}} = {{target_sprint.items.length}} (current assigned count before any additions this session)</action>
  <action>Initialize {{items_to_move}} = [] (items confirmed for movement)</action>
  <action>For each item in {{confirmed_items}}, in confirmed ranking order:</action>
  <check if="adding this item would exceed sprint capacity (current_sprint_count + 1 > target_sprint.capacity)">
    <output>⚠️ **Capacity Warning:** Adding "{{item.title}}" would bring assigned items to {{current_sprint_count + 1}}/{{target_sprint.capacity}} — exceeding sprint capacity by {{current_sprint_count + 1 - target_sprint.capacity}}.</output>
    <ask>Options:
- [a] Add anyway (over-capacity acknowledged)
- [s] Skip this item (leave in backlog)
- [m] Exit to run `/modify-sprint` to increase capacity first

Choice:</ask>
    <check if="user selects 's'">
      <action>Skip this item — do NOT add to {{items_to_move}}. Continue to next item.</action>
    </check>
    <check if="user selects 'm'">
      <output>💡 Run `/modify-sprint` to increase capacity for **{{target_sprint.name}}**, then re-run `/add-to-sprint`.</output>
      <action>Exit workflow without making any changes</action>
    </check>
    <check if="user selects 'a'">
      <action>Add to {{items_to_move}} and increment {{current_sprint_count}}</action>
    </check>
  </check>
  <check if="item is within capacity">
    <action>Add to {{items_to_move}} and increment {{current_sprint_count}}</action>
  </check>
</step>

<step n="8" goal="Atomic write — persist all movements to sprint-status.yaml">
  <action>If {{items_to_move}} is empty (all items were skipped or cancelled), exit without writing.</action>

  <action>**Pre-write: single-location invariant check.** Build {{all_sprint_item_ids}} = flat set of all item IDs across ALL sprints in {{sprint_status}}.sprints (every sprint, every status). For each item in {{items_to_move}}: check if its ID exists in {{all_sprint_item_ids}}. If ANY match is found:
    <output>**Error:** Data integrity violation — item {{item.id}} already exists in a sprint. Aborting to prevent duplicate. The sprint-status.yaml file may be corrupted. No changes have been written.</output>
    <action>Exit workflow without writing</action>
  </action>

  <action>**Pre-write: backlog re-validation.** Build {{current_backlog_ids}} = set of all item IDs currently in {{sprint_status}}.backlog. For each item in {{items_to_move}}: check if its ID exists in {{current_backlog_ids}}. If ANY item is missing:
    <output>**Error:** Item {{item.id}} was selected for sprint assignment but is no longer in the backlog. The file may have been modified externally. No changes have been written. Please re-run `/add-to-sprint` to start fresh.</output>
    <action>Exit workflow without writing</action>
  </action>

  <action>Perform ALL of the following in a single atomic write to `sprint-status.yaml`:</action>
  <action>1. For each item in {{items_to_move}}:
    - Build the sprint item object: copy `id`, `type`, `epic`, `title`, `status`, `severity` from the backlog item — DROP the `priority` field (sprint items do not have priority)
    - APPEND the sprint item object to `sprints[{{target_sprint_key}}].items`
    - REMOVE the original item object from the `backlog` array
  </action>
  <action>2. Renumber remaining backlog items' `priority` values sequentially (1..N) to match their new array positions (position 0 → priority 1, position 1 → priority 2, etc.)</action>
  <action>3. Update `last_updated` to the current ISO-8601 timestamp</action>
  <action>4. Preserve `generated`, `epics`, and all other metadata fields unchanged</action>
  <action>5. Write the complete updated `sprint-status.yaml` in a single write operation (all removals + additions + renumbering happen together — no partial state)</action>
</step>

<step n="9" goal="Display summary">
  <output>
## Assignment Complete

**Sprint:** {{target_sprint.name}}
**Items assigned this session:** {{items_to_move.length}}

| # | ID | Title | Type |
|---|----|-------|------|
{{#each items_to_move}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} |
{{/each}}

### Confirmed Ranking (Audit Record)

| Rank | ID | Title | Type | Business Value | Dependencies | Severity | Effort |
|------|----|-------|------|----------------|--------------|----------|--------|
{{#each confirmed_ranking}}
| {{rank}} | {{id}} | {{title}} | {{type}} | {{business_value}} | {{dependency_status}} | {{severity}} | {{effort}} |
{{/each}}

**Updated Capacity:** {{current_sprint_count}}/{{target_sprint.capacity}} items used ({{target_sprint.capacity - current_sprint_count}} remaining)

**Next Steps:**
- Use `/remove-from-sprint` to move items back to backlog if needed
- Use `/modify-sprint` to adjust capacity or sprint metadata
- Use `/sprint-status-view` to view the full sprint with all assigned items
  </output>
</step>

</workflow>
