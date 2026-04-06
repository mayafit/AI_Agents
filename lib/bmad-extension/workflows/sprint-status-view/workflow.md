# Sprint Status View Workflow

Extension workflow that displays sprint progress, backlog, and epic status from the unified `sprint-status.yaml` file.

> **READ-ONLY:** This workflow NEVER writes to `sprint-status.yaml` or any other file.
>
> **Architecture mandate:** This workflow is a NEW extension at `lib/bmad-extension/workflows/sprint-status-view/`. It does NOT modify any files under `_bmad/bmm/workflows/`.

<workflow>

<step n="1" goal="Load sprint-status.yaml">
  <action>
    Resolve the path to `sprint-status.yaml`:
    - Check `_bmad/bmm/config.yaml` for `sprint_management_path` (multi-repo mode)
    - Default: `_bmad-output/implementation-artifacts/sprint-status.yaml`

    Read the file.
  </action>
  <check if="file not found">
    <output>No sprint-status.yaml found. Run `/bmad-sprint-planning` to initialize.</output>
    <action>Exit workflow</action>
  </check>
  <check if="file uses old development_status schema (no epics/backlog/sprints keys)">
    <output>sprint-status.yaml uses the pre-Epic-17 schema. Run `/bmad-sprint-planning` to migrate to the unified schema.</output>
    <action>Exit workflow</action>
  </check>
  <action>
    Parse all sections:
    - Metadata: `project`, `last_updated`, `generated`, `project_key`, `tracking_system`, `story_location`
    - `epics` — map of epic entries (keys: `epic-N`)
    - `backlog` — array of unassigned item objects
    - `sprints` — map of sprint entries (keys: `sprint-N`)

    Store as {{meta}}, {{epics}}, {{backlog}}, {{sprints}}.
  </action>
</step>

<step n="2" goal="Classify sprints by status">
  <action>
    Partition the `sprints` map into three groups:
    - {{active_sprints}}  — entries where `status: active`
    - {{planning_sprints}} — entries where `status: planning`
    - {{closed_sprints}}  — entries where `status: closed`

    Sort each group by sprint key (`sprint-N`) ascending by numeric value of N.
  </action>
</step>

<step n="3" goal="Render header">
  <output>
# Sprint Status — {{meta.project}}
*Last updated: {{meta.last_updated}}*

---
  </output>
</step>

<step n="4" goal="Display active sprints">
  <check if="active_sprints is empty">
    <action>Skip this step (no header, no output)</action>
  </check>
  <output>
## Active Sprints
  </output>
  <action>
    For each sprint in {{active_sprints}} (sorted by key ascending):

    1. Calculate {{items_count}} = length(sprint.items)
    2. Determine {{over_capacity}} = items_count > sprint.capacity
    3. Render sprint header:
       - Name, status, capacity bar (items_count / capacity), start/end (or "—" if empty)
       - If over_capacity: append `⚠️ over capacity by {items_count - capacity} item(s)`

    4. If sprint.items is non-empty: render items table with columns: Item, Title, Type, Status, Severity
       - Type: "Story" for `type: story`, "Bug" for `type: bug`
       - Severity: show value for bugs, "—" for stories
    5. If sprint.items is empty: output `*(No items assigned to this sprint)*`
  </action>
  <output>
### {{sprint.name}}
**Status:** active | **Capacity:** {{items_count}} / {{sprint.capacity}} | **Start:** {{sprint.start or "—"}} | **End:** {{sprint.end or "—"}}
{{#if over_capacity}}⚠️ over capacity by {{items_count - sprint.capacity}} item(s){{/if}}

{{#if sprint.items}}
| Item | Title | Type | Status | Severity |
|------|-------|------|--------|----------|
{{#each sprint.items}}
| {{id}} | {{title}} | {{#if type == "story"}}Story{{else}}Bug{{/if}} | {{status}} | {{#if severity}}{{severity}}{{else}}—{{/if}} |
{{/each}}
{{else}}
*(No items assigned to this sprint)*
{{/if}}

---
  </output>
</step>

<step n="5" goal="Display planning sprints">
  <check if="planning_sprints is empty">
    <action>Skip this step (no header, no output)</action>
  </check>
  <output>
## Planning Sprints
  </output>
  <action>
    For each sprint in {{planning_sprints}} (sorted by key ascending):
    Use the same rendering logic as Step 4 with status "planning".
  </action>
  <output>
### {{sprint.name}}
**Status:** planning | **Capacity:** {{items_count}} / {{sprint.capacity}} | **Start:** {{sprint.start or "—"}} | **End:** {{sprint.end or "—"}}

{{#if sprint.items}}
| Item | Title | Type | Status | Severity |
|------|-------|------|--------|----------|
{{#each sprint.items}}
| {{id}} | {{title}} | {{#if type == "story"}}Story{{else}}Bug{{/if}} | {{status}} | {{#if severity}}{{severity}}{{else}}—{{/if}} |
{{/each}}
{{else}}
*(No items assigned to this sprint)*
{{/if}}

---
  </output>
</step>

<step n="6" goal="Display closed sprint summaries">
  <check if="closed_sprints is empty">
    <action>Skip this step (no header, no output)</action>
  </check>
  <output>
## Closed Sprints

| Sprint | Items | Start | End |
|--------|-------|-------|-----|
{{#each closed_sprints}}
| {{name}} | {{items.length}} items (archived) | {{start or "—"}} | {{end or "—"}} |
{{/each}}

---
  </output>
  <action>Store {{closed_sprints}} for possible expansion in Step 10 (next actions).</action>
</step>

<step n="7" goal="Display backlog">
  <action>Calculate {{backlog_count}} = length({{backlog}})</action>
  <output>
## Backlog — {{backlog_count}} items

{{#if backlog}}
| # | Item | Title | Type | Status | Severity |
|---|------|-------|------|--------|----------|
{{#each backlog}}
| {{@index + 1}} | {{id}} | {{title}} | {{#if type == "story"}}Story{{else}}Bug{{/if}} | {{status}} | {{#if severity}}{{severity}}{{else}}—{{/if}} |
{{/each}}
{{else}}
*(No items in backlog)*
{{/if}}

---
  </output>
</step>

<step n="8" goal="Display epics overview">
  <action>
    For each epic in {{epics}} (sorted by key ascending by numeric N in `epic-N`):
    - Extract N from the key (e.g., `epic-17` → N = 17)
    - Count items in {{backlog}} where `epic == N`
    - Count items in all {{sprints[*].items}} where `epic == N`
    - Tally by status: e.g., { "in-progress": 2, "ready-for-dev": 3 }
    - Build status_breakdown string: list non-zero counts, e.g., "2 in-progress, 3 ready-for-dev"
    - total_count = sum of all status counts
    - retrospective_display = epic.retrospective value, or "—" if null
  </action>
  <output>
## Epics

{{#if epics}}
| Epic | Status | Retrospective | Items (active) |
|------|--------|---------------|----------------|
{{#each epics}}
| {{key}} | {{status}} | {{retrospective_display}} | {{total_count}} total{{#if status_breakdown}} ({{status_breakdown}}){{/if}} |
{{/each}}
{{else}}
*(No epics defined)*
{{/if}}

---
  </output>
</step>

<step n="9" goal="Display alerts (conditional)">
  <action>
    Scan for alert conditions:

    1. Over-capacity sprints: any sprint where items.length > capacity
    2. Stale in-progress items: items with status `in-progress` in active sprints where sprint.start is more than 14 days before today
       - Calculate days_stale = today - sprint.start (in days)
    3. Empty active sprints: active sprints with zero items

    Collect all alerts into {{alert_list}}.
  </action>
  <check if="alert_list is empty">
    <action>Skip — do not render this section at all</action>
  </check>
  <check if="alert_list is non-empty">
    <output>
## Alerts

{{#each alert_list}}
- {{this}}
{{/each}}

---
    </output>
  </check>
</step>

<step n="10" goal="Offer next actions">
  <ask>Options:
1. Expand a closed sprint to see its items
2. Assign backlog items to a sprint — run `/add-to-sprint`
3. Change sprint settings — run `/modify-sprint`
4. Create a new sprint — run `/add-sprint`
5. Exit

Choice:</ask>

  <check if="choice == 1">
    <check if="closed_sprints is empty">
      <output>No closed sprints to expand.</output>
      <goto step="10" />
    </check>
    <ask>Which closed sprint? (Enter sprint key such as `sprint-2` or sprint name):</ask>
    <action>
      Find the matching sprint in {{closed_sprints}} by key or name (case-insensitive match).
      If not found, output "Sprint not found." and return to menu.
      If found, display the full items table for that sprint.
    </action>
    <output>
### {{sprint.name}} — Items

{{#if sprint.items}}
| Item | Title | Type | Status | Severity |
|------|-------|------|--------|----------|
{{#each sprint.items}}
| {{id}} | {{title}} | {{#if type == "story"}}Story{{else}}Bug{{/if}} | {{status}} | {{#if severity}}{{severity}}{{else}}—{{/if}} |
{{/each}}
{{else}}
*(No items recorded — all items were archived at sprint close)*
{{/if}}
    </output>
    <goto step="10" />
  </check>

  <check if="choice == 2">
    <output>Run `/add-to-sprint` to assign backlog items to a sprint.</output>
  </check>

  <check if="choice == 3">
    <output>Run `/modify-sprint` to change sprint settings.</output>
  </check>

  <check if="choice == 4">
    <output>Run `/add-sprint` to create a new sprint.</output>
  </check>

  <check if="choice == 5">
    <action>Exit workflow</action>
  </check>
</step>

</workflow>
