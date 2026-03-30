<!-- DEPRECATED: This workflow references the old sprint-plan-{n}.yaml format.
     It will be reworked in Story 17.4. Use /add-sprint to create sprints in the new format. -->

> **DEPRECATED:** This workflow references the old `sprint-plan-{n}.yaml` format. It will be reworked in Story 17.4. Use `/add-sprint` to create sprints in the new format.

# Add-to-Sprint Workflow

Guided workflow to assign backlog items (stories + bugs) to a sprint using multi-criteria prioritization.

<workflow>

<step n="1a" goal="Discover user story backlog items from sprint-status.yaml">
  <action>Read `_bmad-output/implementation-artifacts/sprint-status.yaml` — authoritative source for user story execution status</action>
  <action>Parse the development_status section. For each entry:
    - Skip epic keys (keys matching `epic-*`)
    - Skip retrospective keys (keys ending with `-retrospective`)
    - Collect story keys and their current status (backlog, ready-for-dev, in-progress, review, done)
  </action>
  <action>Store as {{user_stories}} — list of objects with: key, status</action>
  <action>Infer story title from key (e.g., `12-1-add-sprint-workflow` → "Add Sprint Workflow")</action>
</step>

<step n="1b" goal="Discover bug story backlog items">
  <action>Glob `_bmad-output/implementation-artifacts/bug-*.md` to discover all bug story files</action>
  <check if="no bug files found">
    <action>Set {{bug_stories}} = [] (empty list)</action>
  </check>
  <check if="bug files found">
    <action>For each bug file, parse YAML frontmatter to extract: `type`, `severity`, `title`</action>
    <action>Store as {{bug_stories}} — list of objects with: file, type (bug), severity, title</action>
  </check>
</step>

<step n="1c" goal="Filter out items already assigned to any sprint">
  <action>Glob `_bmad-output/implementation-artifacts/sprint-plan-*.yaml` to discover all existing sprint artifact files</action>
  <action>For each sprint file found, read its assigned_items list</action>
  <action>Build {{all_assigned_items}} = flat set of every item identifier (story keys and bug basenames) across ALL sprint plans</action>
  <action>Filter {{user_stories}}: remove any story whose key is present in {{all_assigned_items}}</action>
  <action>Filter {{bug_stories}}: remove any bug whose file basename is present in {{all_assigned_items}}</action>
  <action>Items already assigned to any sprint will NOT appear in the backlog — this prevents duplicate assignment</action>
  <check if="no sprint files found">
    <action>Set {{all_assigned_items}} = [] — no filtering needed when no sprints exist yet</action>
  </check>
</step>

<step n="2" goal="Present flat backlog combining stories and bugs">
  <action>Combine {{user_stories}} and {{bug_stories}} into a flat backlog list</action>
  <action>Stories and bugs are peers — no epic grouping (FR65)</action>
  <output>
## 📋 Backlog Items

| # | ID / File | Title | Type | Status/Severity |
|---|---|---|---|---|
{{#each backlog_items}}
| {{@index+1}} | {{id}} | {{title}} | {{type}} | {{status_or_severity}} |
{{/each}}

*Total: {{story_count}} stories, {{bug_count}} bugs*
  </output>
</step>

<step n="3" goal="List available sprints and select target sprint">
  <action>Glob `_bmad-output/implementation-artifacts/sprint-plan-*.yaml` to discover all sprint artifact files</action>
  <check if="no sprint files found">
    <output>❌ No sprint plans found. Run `/add-sprint` first to create a sprint before assigning items.</output>
    <action>Exit workflow</action>
  </check>
  <action>For each sprint file found, read and extract: sprint_number, sprint_name, capacity, assigned_items count, status</action>
  <output>
## 🏃 Available Sprints

| # | Sprint | Status | Capacity | Assigned | Remaining |
|---|---|---|---|---|---|
{{#each sprints}}
| {{@index+1}} | {{sprint_name}} | {{status}} | {{capacity}} | {{assigned_count}} | {{remaining}} |
{{/each}}
  </output>
  <ask>Select target sprint (enter number):</ask>
  <action>Store selected sprint data as {{target_sprint}}</action>
</step>

<step n="4" goal="Display current sprint capacity usage">
  <action>Calculate: {{assigned_count}} = length of {{target_sprint.assigned_items}}</action>
  <action>Calculate: {{remaining_capacity}} = {{target_sprint.capacity}} - {{assigned_count}}</action>
  <output>
## Sprint Capacity: {{target_sprint.sprint_name}}

- **Capacity:** {{target_sprint.capacity}} items
- **Assigned:** {{assigned_count}} items
- **Remaining:** {{remaining_capacity}} slots

{{#if remaining_capacity <= 0}}
⚠️ This sprint is **at or over capacity**. Adding items will exceed the limit.
{{/if}}
  </output>
</step>

<step n="5" goal="Select candidate items for this sprint">
  <ask>Which backlog items do you want to consider for this sprint? Enter item numbers (comma-separated), or "all" to evaluate the full backlog:</ask>
  <check if="user enters 'all'">
    <action>Set {{candidate_items}} = all items in {{backlog_items}} (the full filtered backlog list from step 2)</action>
  </check>
  <check if="user enters item numbers">
    <action>Resolve the entered numbers against the backlog table from step 2 and set {{candidate_items}} = those specific items</action>
  </check>
</step>

<step n="6" goal="Multi-criteria prioritization guidance">
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
## 🎯 Prioritization Analysis

| Rank | ID / File | Title | Type | Business Value | Dependencies | Severity | Effort | Rationale |
|---|---|---|---|---|---|---|---|---|
{{#each ranked_items}}
| {{rank}} | {{id}} | {{title}} | {{type}} | {{business_value}} | {{dependency_status}} | {{severity}} | {{effort}} | {{rationale}} |
{{/each}}

**Recommended selection** (up to {{remaining_capacity}} items to stay within capacity): {{recommended_selection}}
  </output>
</step>

<step n="7" goal="User confirms or adjusts ranking">
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
    <action>Update {{confirmed_items}} with user selection</action>
  </check>
  <check if="user selects 'r'">
    <ask>Enter item numbers in your preferred priority order (comma-separated). Only items you include will be assigned — items not listed will be excluded from this session and remain in the unassigned backlog:</ask>
    <action>Set {{confirmed_items}} = only the items matching the user-provided numbers, in the order provided. Items from {{candidate_items}} NOT mentioned are excluded from assignment in this session (they remain available in the backlog for future sprints).</action>
  </check>
  <check if="user selects 'c'">
    <action>Set {{confirmed_items}} = recommended selection</action>
  </check>
  <action>Store confirmed ranking in {{confirmed_ranking}} for auditability (included in workflow output)</action>
</step>

<step n="8" goal="Assign selected items to sprint with capacity enforcement">
  <action>For each item in {{confirmed_items}}, in confirmed ranking order:</action>
  <action>Re-calculate current assigned count (in case multiple items are being added)</action>
  <check if="assigning this item would exceed capacity">
    <output>⚠️ **Capacity Warning:** Adding "{{item.title}}" would bring assigned items to {{new_count}}/{{target_sprint.capacity}} — exceeding sprint capacity by {{overage}}.</output>
    <ask>Options:
- [a] Add anyway (over-capacity acknowledged)
- [s] Skip this item
- [m] Modify sprint capacity first via `/modify-sprint`

Choice:</ask>
    <check if="user selects 's'">
      <action>Skip this item — do not add to sprint. Continue to next item in the {{confirmed_items}} loop.</action>
    </check>
    <check if="user selects 'm'">
      <output>💡 Run `/modify-sprint` to increase capacity for {{target_sprint.sprint_name}}, then re-run `/add-to-sprint`.</output>
      <action>Exit workflow</action>
    </check>
  </check>
  <action>Add item identifier to {{target_sprint.assigned_items}} list in the sprint-plan-{{target_sprint.sprint_number}}.yaml artifact</action>
  <action>Item identifier format: story key for user stories (e.g., `12-1-add-sprint-workflow`), file basename for bugs (e.g., `bug-login-crash`)</action>
</step>

<step n="9" goal="Persist changes and display confirmed ranking for auditability">
  <action>Update `_bmad-output/implementation-artifacts/sprint-plan-{{target_sprint.sprint_number}}.yaml`:
    - Update `assigned_items` list with all newly assigned item identifiers
    - Update `last_modified` to current ISO timestamp
  </action>
  <action>**Do NOT modify sprint-status.yaml** — sprint membership is exclusively tracked in sprint-plan-{n}.yaml</action>
  <output>
## ✅ Assignment Complete

**Sprint:** {{target_sprint.sprint_name}}
**Items assigned this session:** {{assigned_this_session}}

### Confirmed Ranking (Audit Record)

| Rank | ID | Title | Type | Business Value | Dependencies | Severity | Effort |
|---|---|---|---|---|---|---|---|
{{#each confirmed_ranking}}
| {{rank}} | {{id}} | {{title}} | {{type}} | {{business_value}} | {{dependency_status}} | {{severity}} | {{effort}} |
{{/each}}

**Updated Capacity:** {{new_assigned_count}}/{{target_sprint.capacity}} items used ({{new_remaining}} remaining)

**Next Steps:**
- Use `/modify-sprint` to adjust capacity or remove items
- Use `/sprint-status-view` to view the full sprint with all assigned items
  </output>
</step>

</workflow>
