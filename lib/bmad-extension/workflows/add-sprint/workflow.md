# Add Sprint Workflow

Guided workflow to create a new sprint with capacity limits for realistic sprint planning.

<workflow>

<step n="1" goal="Gather sprint number and name">
  <action>Ask the user for the sprint number (e.g., 1, 2, 3)</action>
  <ask>What is the sprint number? (e.g., 1)</ask>
  <action>Store as {{sprint_number}}</action>
  <ask>What is the sprint name? (e.g., "Sprint 1 — Foundation") — press Enter to use "Sprint {{sprint_number}}"</ask>
  <action>If user presses Enter or leaves blank, default to "Sprint {{sprint_number}}"</action>
  <action>Store as {{sprint_name}}</action>
</step>

<step n="2" goal="Gather capacity as positive integer">
  <action>Explain capacity: the maximum number of items (stories + bugs) that can be assigned to this sprint</action>
  <ask>What is the sprint capacity? (Enter a positive integer — the maximum number of stories/bugs for this sprint)</ask>
  <action>Store input as {{capacity_input}}</action>
  <action>Validate {{capacity_input}} is a positive integer (greater than zero, no decimals, no non-numeric characters)</action>
  <check if="{{capacity_input}} is NOT a positive integer">
    <output>❌ Invalid capacity: "{{capacity_input}}". Capacity must be a positive integer (e.g., 5, 10, 20). Zero and negative values are not allowed.</output>
    <goto step="2" />
  </check>
  <action>Store as {{capacity}} (integer)</action>
</step>

<step n="3" goal="Gather optional start and end context">
  <action>Explain: start/end context can be dates (e.g., "2026-03-18") or milestone descriptions (e.g., "Q1 Planning Complete")</action>
  <ask>Optional — Sprint start context (date or milestone, press Enter to skip):</ask>
  <action>Store as {{start_context}} (empty string if skipped)</action>
  <ask>Optional — Sprint end context (date or milestone, press Enter to skip):</ask>
  <action>Store as {{end_context}} (empty string if skipped)</action>
</step>

<step n="4" goal="Confirm and validate all inputs">
  <output>
## Sprint Summary — Please Confirm

- **Sprint Number:** {{sprint_number}}
- **Sprint Name:** {{sprint_name}}
- **Capacity (max items):** {{capacity}}
- **Start Context:** {{start_context}} *(empty if skipped)*
- **End Context:** {{end_context}} *(empty if skipped)*
- **Output File:** `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml`
  </output>
  <ask>Confirm creation? [y] Yes / [n] Cancel / [e] Edit a field:</ask>
  <check if="user selects 'e'">
    <ask>Which field to edit? (number / name / capacity / start / end)</ask>
    <check if="field == 'number'">
      <ask>New sprint number:</ask>
      <action>Store as {{sprint_number}}</action>
      <action>If sprint name was auto-defaulted to the old "Sprint {n}", update it to "Sprint {{sprint_number}}"</action>
      <goto step="4" />
    </check>
    <check if="field == 'name'">
      <ask>New sprint name (or press Enter to use "Sprint {{sprint_number}}"):</ask>
      <action>If blank, set {{sprint_name}} = "Sprint {{sprint_number}}"; else store user input as {{sprint_name}}</action>
      <goto step="4" />
    </check>
    <check if="field == 'capacity'"><goto step="2" /></check>
    <check if="field == 'start'"><goto step="3" /></check>
    <check if="field == 'end'"><goto step="3" /></check>
  </check>
  <check if="user selects 'n'">
    <output>❌ Sprint creation cancelled.</output>
    <action>Exit workflow</action>
  </check>
</step>

<step n="5" goal="Generate sprint artifact file">
  <action>Determine output path: `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml`</action>
  <action>Check if file already exists at output path</action>
  <check if="file already exists">
    <output>⚠️ A sprint plan already exists at `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml`.</output>
    <ask>Overwrite existing sprint plan? [y] Yes / [n] Cancel:</ask>
    <check if="user selects 'n'">
      <output>❌ Sprint creation cancelled to preserve existing sprint plan.</output>
      <action>Exit workflow</action>
    </check>
  </check>
  <action>Get current ISO timestamp for created_date and last_modified</action>
  <action>Write sprint artifact YAML to `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml` with this structure:

```yaml
sprint_number: {{sprint_number}}
sprint_name: "{{sprint_name}}"
capacity: {{capacity}}
assigned_items: []
status: planning
start_context: "{{start_context}}"
end_context: "{{end_context}}"
created_date: "{{current_iso_timestamp}}"
last_modified: "{{current_iso_timestamp}}"
```
  </action>
  <output>
✅ **Sprint created successfully!**

- **File:** `_bmad-output/implementation-artifacts/sprint-plan-{{sprint_number}}.yaml`
- **Sprint:** {{sprint_name}}
- **Capacity:** {{capacity}} items
- **Status:** planning

**Next Steps:**
- Use `/add-to-sprint` to assign backlog items to this sprint
- Use `/modify-sprint` to update sprint details later
- Use `/sprint-status-view` to view sprint progress
  </output>
</step>

</workflow>
