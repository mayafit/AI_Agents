# Sprint Status View

Display a formatted, read-only dashboard of all sprint, backlog, and epic data from the unified `sprint-status.yaml` file.

> **READ-ONLY SKILL:** This skill NEVER writes to `sprint-status.yaml` or any other file. It is purely a display/reporting skill.

---

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query all sprint data for project `{jira_project_key}` at `{jira_url}`: active sprint with all its issues and their statuses, backlog issues count and list, epic summary and progress. Map Jira sprint states to canonical vocabulary (future → planning, active → active, closed → closed). Map Jira issue statuses to canonical statuses per the status mapping below. Use this data for the display — no writes. Status mapping: Backlog/Open → backlog, To Do/Selected for Development → ready-for-dev, In Progress → in-progress, In Review/Code Review → review, Done/Resolved → done, On Hold/Blocked → on-hold, Won't Do/Cancelled → cancelled.
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
