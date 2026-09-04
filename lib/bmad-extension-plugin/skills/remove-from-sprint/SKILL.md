---
name: remove-from-sprint
description: Guided workflow to move sprint items back to the backlog in the unified sprint-status.yaml using reverse movement semantics
type: skill
triggers:
  - "remove from sprint"
  - "move back to backlog"
---

# Remove-from-Sprint Workflow

Guided workflow to move sprint items back to the backlog in the unified `sprint-status.yaml` using reverse movement semantics (inverse of `add-to-sprint`).

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Find the Jira issue matching the item ID in project `{jira_project_key}` at `{jira_url}` (search by issue key or summary). Remove the issue from its current sprint using the "remove issue from sprint" operation, returning it to the board backlog.
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
  <action>Resolve the sprint-status.yaml path: check `_bmad/bmm/config.yaml` for `sprint_management_path`; if not set, default to `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
  <action>Read the resolved `sprint-status.yaml` — the unified single source of truth for sprint and backlog state</action>
  <check if="file does not exist">
    <output>No sprint-status.yaml found. Run sprint planning first to initialize the file (`/bmad-sprint-planning`).</output>
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
