<!-- DEPRECATED: This workflow references the old sprint-plan-{n}.yaml format.
     It will be reworked in Story 17.8. Use /add-sprint to create sprints in the new format. -->

> **DEPRECATED:** This workflow references the old `sprint-plan-{n}.yaml` format. It will be reworked in Story 17.8. Use `/add-sprint` to create sprints in the new format.

# Sprint Status View Workflow

Extension workflow that displays sprint progress with assigned items (stories + bugs), type distinction, and remaining capacity.

> **Architecture mandate:** This workflow is a NEW extension at `lib/bmad-extension/workflows/sprint-status-view/`. It does NOT modify any files under `_bmad/bmm/workflows/`.

<workflow>

<step n="1" goal="Discover all sprint artifact files">
  <action>Glob `_bmad-output/implementation-artifacts/sprint-plan-*.yaml` to discover all sprint artifact files</action>
  <check if="no sprint files found">
    <output>
ℹ️ **No Sprints Found**

No sprint plan files exist yet (`sprint-plan-*.yaml`).

**To get started:**
- Run `/add-sprint` to create your first sprint
- Run `/add-to-sprint` to assign backlog items to it
    </output>
    <action>Exit workflow</action>
  </check>
  <action>For each sprint file found, read the full YAML content and store as {{sprint_plans}} list</action>
  <action>Sort {{sprint_plans}} by sprint_number ascending</action>
</step>

<step n="2" goal="Load sprint-status.yaml for user story execution statuses">
  <action>Read `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
  <check if="file not found">
    <output>⚠️ `sprint-status.yaml` not found. User story execution statuses will not be available. Run `/sprint-planning` to initialize.</output>
    <action>Set {{story_status_map}} = {} (empty — will show data integrity warnings per missing item)</action>
  </check>
  <check if="file found">
    <action>Parse development_status section into {{story_status_map}} — key: story key, value: status</action>
    <action>Exclude epic-* keys and *-retrospective keys from the map</action>
  </check>
</step>

<step n="3" goal="Discover bug stories for type/severity data">
  <action>Glob `_bmad-output/implementation-artifacts/bug-*.md` to discover all bug story files</action>
  <check if="no bug files found">
    <action>Set {{bug_metadata_map}} = {} (empty)</action>
  </check>
  <check if="bug files found">
    <action>For each bug file, parse YAML frontmatter to extract: type, severity, title</action>
    <action>Build {{bug_metadata_map}} — key: file basename (e.g., `bug-login-crash`), value: {severity, title}</action>
  </check>
</step>

<step n="4" goal="Display sprint status for each sprint">
  <action>For each sprint in {{sprint_plans}} (in order):</action>
  <action>Calculate: {{assigned_count}} = length(sprint.assigned_items)</action>
  <action>Calculate: {{remaining_capacity}} = sprint.capacity - {{assigned_count}}</action>

  <action>For each item identifier in sprint.assigned_items, resolve item details:

    **If item is a story (key matches regex `^\d+-\d+-.+`):**
    - Look up status in {{story_status_map}}[item_key]
    - If NOT found in {{story_status_map}}:
      → Record as DATA INTEGRITY WARNING: "Item {item_key} has no status entry in sprint-status.yaml — run /sprint-planning to initialize status tracking for this item."
      → Display item with marker: ⚠️ [status unknown]
    - If found: display with current status label

    **If item is a bug (key matches regex `^bug-.+`):**
    - Look up in {{bug_metadata_map}}[item_key]
    - If NOT found: display with title as item_key, severity as "unknown"
    - If found: display with title and severity from frontmatter
    - Bug execution status: use `status` from bug file frontmatter if present; otherwise "not-started"

    **If item matches neither pattern:** display as type "Unknown" with raw identifier as title
  </action>

  <output>
---

## 🏃 {{sprint.sprint_name}} (Sprint {{sprint.sprint_number}})

**Status:** {{sprint.status}} | **Capacity:** {{sprint.capacity}} items | **Assigned:** {{assigned_count}} | **Remaining:** {{remaining_capacity}}
{{#if sprint.start_context}}**Start:** {{sprint.start_context}}{{/if}} {{#if sprint.end_context}}| **End:** {{sprint.end_context}}{{/if}}

{{#if over_capacity}}
⚠️ **Over capacity by {{overage}} item(s)**
{{/if}}

### Assigned Items

| Item | Title | Type | Status / Severity |
|---|---|---|---|
{{#each resolved_items}}
{{#if is_story}}
| {{item_key}} | {{title}} | 📋 Story | {{status}} |
{{/if}}
{{#if is_bug}}
| {{item_key}} | {{title}} | 🐛 Bug | Severity: {{severity}} / {{bug_status}} |
{{/if}}
{{/each}}

{{#if data_integrity_warnings}}
**⚠️ Data Integrity Warnings:**
{{#each data_integrity_warnings}}
- {{this}}
{{/each}}
{{/if}}

{{#if assigned_items_empty}}
*(No items assigned to this sprint)*
{{/if}}
  </output>
</step>

<step n="5" goal="Display unassigned backlog summary">
  <action>Collect all item keys from {{story_status_map}} that are NOT in any sprint's assigned_items list — these are unassigned user stories</action>
  <action>Collect all bug basenames from {{bug_metadata_map}} that are NOT in any sprint's assigned_items list — these are unassigned bugs</action>
  <action>Count unassigned stories by status: {{unassigned_by_status}}</action>
  <output>
---

## 📦 Unassigned Backlog

### 📋 Unassigned Stories

| Status | Count |
|---|---|
| backlog | {{count_backlog}} |
| ready-for-dev | {{count_ready}} |
| in-progress | {{count_in_progress}} |
| review | {{count_review}} |
| done | {{count_done}} |

*Total unassigned stories: {{total_unassigned}}*

### 🐛 Unassigned Bugs

{{#if unassigned_bugs}}
| ID / File | Title | Severity |
|---|---|---|
{{#each unassigned_bugs}}
| {{id}} | {{title}} | {{severity}} |
{{/each}}
{{else}}
*(No unassigned bugs)*
{{/if}}

**Tip:** Use `/add-to-sprint` to assign unassigned items to a sprint.
  </output>
</step>

<step n="6" goal="Offer next actions">
  <ask>Options:
1. Show full unassigned backlog item list (IDs + titles + statuses)
2. Add items to a sprint — run `/add-to-sprint`
3. Modify a sprint — run `/modify-sprint`
4. Create a new sprint — run `/add-sprint`
5. Exit

Choice:</ask>
  <check if="choice == 1">
    <action>For each unassigned story key in {{story_status_map}} not assigned to any sprint, display: key, inferred title, status</action>
    <action>For each unassigned bug in {{bug_metadata_map}} not assigned to any sprint, display: id, title, severity</action>
    <output>
### Full Unassigned Backlog

**Stories:**
| Key | Title | Status |
|---|---|---|
{{#each unassigned_story_items}}
| {{key}} | {{title}} | {{status}} |
{{/each}}

**Bugs:**
| ID | Title | Severity |
|---|---|---|
{{#each unassigned_bugs}}
| {{id}} | {{title}} | {{severity}} |
{{/each}}
    </output>
    <goto step="6" />
  </check>
  <check if="choice == 2">
    <output>▶️ Run `/add-to-sprint` to assign backlog items to a sprint.</output>
  </check>
  <check if="choice == 3">
    <output>▶️ Run `/modify-sprint` to add/remove items or change sprint settings.</output>
  </check>
  <check if="choice == 4">
    <output>▶️ Run `/add-sprint` to create a new sprint.</output>
  </check>
  <check if="choice == 5">
    <action>Exit workflow</action>
  </check>
</step>

</workflow>
