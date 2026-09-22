---
name: my-next-issue
description: Return the highest-priority open item assigned to the operating user (Jira: assignee = currentUser()) and answer "what should I work on next?"
type: skill
triggers:
  - "my next issue"
  - "what should I work on"
  - "most important issue assigned to me"
  - "/my-next-issue"
---

# My Next Issue

Answer the question "what should **I** work on next?" — return the single
highest-priority open item **assigned to the operating user**, with the runners-up
listed for context.

This is the user-scoped counterpart to `sprint-status-view` (whole board) and
`prioritize-backlog` (whole backlog reordering). Neither of those filters by
assignee, so neither can answer this question.

> **READ-ONLY SKILL:** This skill NEVER writes to `sprint-status.yaml`, to Jira, or
> to any other file. It selects and reports; it does not transition, assign, or
> reorder anything. To start work on what it returns, hand the item to `bmad-dev-story`.

---

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, read `sprint_backend` from `_bmad/bmm/config.yaml`. Use that value if present, otherwise default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   a. Perform the Jira operation: Query the open issues assigned to the operating user in project `{jira_project_key}` at `{jira_url}` with the JQL
      `project = {jira_project_key} AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, rank ASC`.
      Prefer issues in the board's active sprint over backlog issues; within the same
      scope, rank by the ORDER BY above. Return the top issue plus the next four as
      runners-up.
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

### A note on assignee under the file-system backend

`sprint-status.yaml` has no assignee field, and it does not need one: the file-system
backend is inherently **single-operator** — whoever owns the working tree owns the
file. Under this backend the assignee filter is therefore a deliberate no-op, and the
skill degrades to "the highest-priority item I could pick up next". Do NOT invent an
assignee field, do NOT read the OS login name, and do NOT ask the user who they are.
State the degradation once in the output so the answer is not mistaken for a
user-scoped result on a shared board.

---

<workflow>

<step n="0" goal="Load state">
  <action>Read `_bmad-output/implementation-artifacts/sprint-status.yaml` — the single source of truth for all sprint and backlog state.</action>
  <check if="sprint-status.yaml does not exist">
    <output>No sprint-status.yaml found. Run `bmad-sprint-planning` first to initialize the file.</output>
    <action>Exit workflow — do not create any file.</action>
  </check>
  <action>Parse the `epics`, `backlog` and `sprints` sections. Store as {{file_data}}.</action>
</step>

<step n="1" goal="Build the candidate set">
  <action>Collect candidates in this precedence order:
  1. Items in the **active** sprint (`status: active`) whose item status is `ready-for-dev` or `in-progress`.
  2. If no sprint is active, or the active sprint yields no candidates: items from `backlog` whose status is `ready-for-dev`.
  </action>
  <action>EXCLUDE any item whose status is `done`, `cancelled`, `wont-fix`, `review`, or `on-hold`. An item in `review` is finished work awaiting someone else; an `on-hold`/`blocked` item cannot be started.</action>
  <action>EXCLUDE any item with an unsatisfied `blocked-on` dependency — that is, any item listing a blocker whose own status is not `done`. Record these separately as {{blocked_items}} so they can be reported rather than silently dropped.</action>
  <check if="candidate set is empty">
    <output>
## Nothing ready to pick up

No item is currently `ready-for-dev` or `in-progress`{{#if active_sprint}} in sprint **{{active_sprint.name}}**{{/if}}.

{{#if blocked_items.length > 0}}
**{{blocked_items.length}} item(s) are ready but blocked:**

| ID | Title | Blocked on | Blocker status |
|---|---|---|---|
{{#each blocked_items}}
| {{id}} | {{title}} | {{blocked_on}} | {{blocker_status}} |
{{/each}}
{{/if}}

**Next steps:**
- `/add-to-sprint` — pull `ready-for-dev` backlog items into the active sprint
- `/bmad-create-story` — prepare the next story if the backlog has none ready
- `/sprint-status-view` — see the whole board
    </output>
    <action>Exit workflow.</action>
  </check>
</step>

<step n="2" goal="Rank the candidates">
  <action>Score each candidate with the SAME composite criteria `prioritize-backlog` uses, so the two skills never disagree about what "most important" means:
  - **Severity:** critical +40, high +30, medium +10, low +5, none +0
  - **Business value:** the item's existing `priority` value (lower = more important) contributes `max(0, (N - priority + 1) * 2)` where N is the candidate count
  - **Dependency:** +15 if this item blocks others
  - **Type:** bug +3, story +0
  - **Age:** lower-numbered epics get a small starvation-prevention boost
  </action>
  <action>Apply two selection rules that outrank the composite score:
  1. An `in-progress` item always wins over a `ready-for-dev` item — finish what is started before starting more.
  2. An active-sprint item always wins over a backlog item.
  </action>
  <action>Sort by (in-progress first, then active-sprint first, then composite score descending). Break ties by `priority` ascending, then by ID.</action>
  <action>Store {{top}} = first item, {{runners_up}} = next four.</action>
</step>

<step n="3" goal="Report">
  <output>
## Work on this next

**{{top.id}}** — {{top.title}}

| | |
|---|---|
| Type | {{top.type}} |
| Status | {{top.status}} |
| Epic | {{#if top.epic}}epic-{{top.epic}}{{else}}—{{/if}} |
| Severity | {{top.severity or "—"}} |
| Scope | {{#if top.in_active_sprint}}active sprint — {{active_sprint.name}}{{else}}backlog{{/if}} |
| Story file | {{top.story_file_path or "not yet created"}} |

**Why this one:** {{top.rationale}}

{{#if runners_up.length > 0}}
### Next in line

| ID | Title | Type | Status | Why lower |
|---|---|---|---|---|
{{#each runners_up}}
| {{id}} | {{title}} | {{type}} | {{status}} | {{reason}} |
{{/each}}
{{/if}}

{{#if blocked_items.length > 0}}
> **{{blocked_items.length}} item(s) excluded as blocked:** {{blocked_ids_list}}
{{/if}}

> **Note — file-system backend:** `sprint-status.yaml` tracks no assignee, so this is
> "the highest-priority item available to pick up", not "the highest-priority item
> assigned to you". On a Jira-backed project this same skill filters on
> `assignee = currentUser()`.

**Next steps:**
- `/bmad-dev-story {{top.id}}` — implement it
- `/bmad-create-story {{top.id}}` — prepare the story file first, if none exists
- `/prioritize-backlog` — if this ranking looks wrong
  </output>
</step>

</workflow>
