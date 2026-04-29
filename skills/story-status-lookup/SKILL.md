# Story Status Lookup

Look up the current status of a story to determine whether its code is **delivered** or **work-in-progress**.

## Purpose

Used by other skills (notably `auto-bug-detection`) to classify code before deciding whether to flag defects.
Do not flag bugs in WIP code. Do flag bugs in delivered code.

---

## Backend Routing

Before performing a lookup, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Search for the Jira issue matching the item ID in project `{jira_project_key}` at `{jira_url}` (search by issue key or summary match). Return the issue's current Jira status. Map to canonical vocabulary: Backlog/Open → backlog, To Do/Selected for Development → ready-for-dev, In Progress → in-progress, In Review/Code Review → review, Done/Resolved/Closed → done, On Hold/Blocked → on-hold, Won't Do/Cancelled → cancelled. If the issue is not found in Jira, report "not found" and classify as WIP.
      Use whatever Jira-capable tool is available in your current tool context.
      Map Jira entities to the canonical schema (Sprint → sprints[], Backlog → backlog[],
      Epic → epics[], Jira status → canonical vocabulary per Section 6.3 of the routing spec).
   b. If the Jira operation SUCCEEDS: continue with the Jira data returned. Jira is the source of truth.
   c. If the Jira operation FAILS for any reason:
      Pause and present the user with:
      > "The Jira operation failed: {error details}. How would you like to proceed?
      > (a) Retry — attempt the Jira operation again
      > (b) Switch to file management — update sprint-status.yaml and config to use
      >     file-system backend, then complete this operation locally. This change is permanent."
      If user chooses (b): write `tracking_system: file-system` to `sprint-status.yaml`,
      update `sprint_backend: file-system` in `_bmad/bmm/config.yaml`,
      then proceed with **File-System Backend** instructions below.

4. **File-System Backend** — execute the steps below.

---

## File-System Backend

**Status file:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Step 1 — Identify the story slug

Derive the story slug from the available context, in this order of preference:

1. The story file name currently in scope (e.g. `11-1-auto-bug-detection-skill.md` → slug is `11-1-auto-bug-detection-skill`)
2. The git branch name — strip prefixes (`feature/`, `fix/`, `chore/`) and normalize: lowercase, replace spaces and underscores with hyphens, remove non-alphanumeric characters except hyphens
3. Any explicit story reference in the current task description

### Step 2 — Search for the slug across all sections

Read `sprint-status.yaml` and search the following sections in order. Stop at the first match.

**2a. Backlog search:** Iterate the `backlog` array. For each item, check if `item.id` equals the derived slug.
- If found: record the item's `status` field value and note location as `"in backlog (unassigned)"`.

**2b. Sprint search:** Iterate the `sprints` map. For each sprint entry, iterate its `items` array. For each item, check if `item.id` equals the derived slug.
- If found: record the item's `status` field value and note location as `"in {sprint-id}"` (e.g., `"in sprint-3"`).

**2c. Done archive fallback:** If the slug was not found in any section above, check for a file at `{story_location}/done/{slug}.md`, where `story_location` is the metadata field from `sprint-status.yaml` (default: `_bmad-output/implementation-artifacts`).
- If the file exists: classify as **Delivered** — report `"Story {id} is archived (done)"`.

**2d. Not found:** If not found in backlog, sprints, or done archive, report `"Story {id} not found in sprint-status.yaml or done/ archive"` and classify as **WIP**.

### Step 3 — Map status to delivered / WIP

| Status value | Classification | Action |
|---|---|---|
| `done` | **Delivered** | Flag bugs |
| `review` | **Delivered** | Flag bugs — dev work is complete, code is awaiting review |
| `in-progress` | WIP | Do not flag |
| `ready-for-dev` | WIP | Do not flag |
| `backlog` | WIP | Do not flag |
| `on-hold` | WIP | Do not flag |
| `cancelled` | WIP | Do not flag |

### Fallback rule

Apply the first matching rule; do not continue down the list:

1. Slug cannot be determined from context → **WIP**
2. Slug not found in `sprint-status.yaml` → check `done/` archive (Step 2c)
3. Found in `done/` archive → **Delivered**
4. Not found anywhere → **WIP**
5. Status file does not exist → **WIP**

Never guess or assume delivered status. When in doubt, WIP.

---

## Jira Backend

When `tracking_system: jira` is configured in `sprint-status.yaml`, the Backend Routing section above handles the lookup. The Jira backend queries the issue by key or summary and maps the Jira workflow status to the canonical vocabulary. The file-system backend remains the fallback if the Jira operation fails and the user chooses to switch backends.
