# Generate Backlog

Generate or refresh the `backlog` section of `sprint-status.yaml` from epics and bug story files, while preserving existing sprint assignments and priorities.

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

## Purpose

This skill reads `epics.md` and `bug-*.md` files and writes the `backlog` and `epics` sections of `sprint-status.yaml`. The `sprints` section is preserved unchanged. This implements the single-source-of-truth model: all unassigned stories and bugs live in the `backlog` section of the unified file rather than a separate `backlog.yaml`.

**Output target:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (`backlog` and `epics` sections only)
**Never writes:** A standalone `backlog.yaml` file.

---

## Backend Routing

Before executing any file-system operations, determine and route to the correct backend:

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` and extract the `tracking_system` field.
   If the field is absent or the file does not exist, default to `file-system`.

2. If `tracking_system` is `file-system`:
   Proceed with the **File-System Backend** instructions below.

3. If `tracking_system` is `jira`:
   > "This operation will create/update Jira items in bulk. If it fails mid-way, Jira may be in partial state. The Jira server URL is `{jira_url}` and project key is `{jira_project_key}` (from `_bmad/bmm/config.yaml`). Proceed?"

   a. Perform the Jira operation: Query all Jira epics (issues of type Epic) in project `{jira_project_key}` at `{jira_url}` to build the epics map. Query all backlog issues (Story and Bug type, not assigned to any active sprint) in project `{jira_project_key}`. For any backlog items not already present in Jira, create new Jira issues (one API call per item). For existing items whose fields have changed, update them. Use the Jira field mapping: item.title → issue summary, item.type → issue type (story → Story, bug → Bug), item.status → Jira workflow status (see status mapping below), item.priority → issue priority. Status mapping: backlog → Backlog/Open, ready-for-dev → To Do/Selected for Development, in-progress → In Progress, review → In Review/Code Review, done → Done/Resolved, on-hold → On Hold/Blocked, cancelled → Won't Do/Cancelled.
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

<step n="1" goal="Load existing sprint-status.yaml state">
  <action>Check whether `_bmad-output/implementation-artifacts/sprint-status.yaml` exists</action>
  <check if="file does not exist">
    <output>ERROR: `sprint-status.yaml` not found. Run `/bmad-sprint-planning` first to bootstrap the file before using `generate-backlog`.</output>
    <action>Exit workflow</action>
  </check>
  <action>Read `_bmad-output/implementation-artifacts/sprint-status.yaml`</action>
  <action>Parse the `sprints` section (map keyed by sprint-N). For each sprint, collect all item IDs from the sprint's `items` array. Build {{sprint_item_ids}} = flat set of all item IDs across ALL sprints (across all sprint statuses: planning, active, closed).</action>
  <action>Parse the `backlog` section (array). Build {{existing_backlog_map}} = map from item ID to the full item object (to preserve priority and status during merge).</action>
  <action>Preserve the top-level metadata fields: {{generated}}, {{project}}, {{project_key}}, {{tracking_system}}, {{story_location}}</action>
  <action>Preserve the full {{sprints}} section verbatim (will be passed through unchanged on write)</action>
  <action>Preserve the existing {{epics}} section for status/retrospective merge later</action>
</step>

<step n="2" goal="Build done-items exclusion set from done/ archive">
  <action>Glob `_bmad-output/implementation-artifacts/done/*.md` to discover archived story files</action>
  <action>For each file found, derive the item ID from the filename (strip `.md` extension, use basename)</action>
  <action>Build {{done_item_ids}} = set of all archived item IDs</action>
  <check if="no done/ files found">
    <action>Set {{done_item_ids}} = empty set</action>
  </check>
</step>

<step n="3" goal="Extract stories from epics.md">
  <action>Resolve `{planning_artifacts}` — the directory epics live in — from the `planning_artifacts:` field of `_bmad/bmm/config.yaml`. Epics are a *software requirements* artifact (FR256) and that store can live in another repository, so this path is read, never assumed, and never derived from `sprint_management_path` (FR267). The field is always present in a config the preflight above accepted; only in Step P2's genuinely pre-F26 case may it be absent, and there it has always been `{project-root}/_bmad-output/planning-artifacts`.</action>
  <action>Read `{planning_artifacts}/epics.md`</action>
  <check if="file does not exist">
    <output>WARNING: `epics.md` not found at `{planning_artifacts}/epics.md`. No stories will be extracted from epics. Continuing with bug-only backlog.</output>
    <action>Set {{epic_stories}} = [] and {{parsed_epics}} = []</action>
  </check>
  <action>Parse epics.md to extract:
    - Each epic: epic number (N from "Epic N" header), epic title, epic status (if present in the file)
    - Each story under each epic: story number (M from "Story N.M" format), story title
  </action>
  <action>For each story, generate the kebab-case item ID: `{epic_number}-{story_number}-{title-slug}` where title-slug is the title lowercased, spaces replaced with hyphens, non-alphanumeric characters (except hyphens) removed, consecutive hyphens collapsed</action>
  <action>Exclude stories whose derived ID is in {{sprint_item_ids}} (already assigned to a sprint)</action>
  <action>Exclude stories whose derived ID is in {{done_item_ids}} (archived)</action>
  <action>Store remaining stories as {{epic_stories}} — list of objects with: id, epic (integer), title, type="story", severity=null</action>
  <action>Store parsed epics as {{parsed_epics}} — list of objects with: epic_id (e.g., "epic-5"), epic_number (integer), title</action>
</step>

<step n="4" goal="Extract bugs from bug-*.md files">
  <action>Glob `_bmad-output/implementation-artifacts/bug-*.md` to discover all bug story files</action>
  <check if="no bug files found">
    <action>Set {{bug_stories}} = []</action>
  </check>
  <action>For each bug file found:
    - Parse YAML frontmatter to extract: `id` (or derive from filename: `BUG-{basename-without-bug-prefix-and-extension}`), `title`, `severity` (critical/high/medium/low), `status`
    - If `id` is not in frontmatter, derive from filename: strip `bug-` prefix and `.md` extension, prefix with `BUG-`
    - If `status` is not in frontmatter, default to `backlog`
    - Exclude bugs whose ID is in {{sprint_item_ids}} or {{done_item_ids}}
    - Create bug item: {id, type="bug", epic=null, title, severity, status}
  </action>
  <action>Store as {{bug_stories}}</action>
</step>

<step n="5" goal="Merge with existing backlog — preserve priorities, detect orphans">
  <action>Build {{all_source_ids}} = set of all IDs from {{epic_stories}} + {{bug_stories}}</action>

  <action>**Orphan detection:** For each item in {{existing_backlog_map}} whose ID is NOT in {{all_source_ids}} AND NOT in {{sprint_item_ids}} AND NOT in {{done_item_ids}}:
    - Flag the item as orphaned
    - Collect orphaned items in {{orphaned_items}} list
    - Keep the orphaned item in the backlog (do NOT auto-remove — human review required)
  </action>

  <action>**New item detection:** For each item in {{epic_stories}} and {{bug_stories}} whose ID is NOT in {{existing_backlog_map}}:
    - Assign status = "backlog"
    - Mark as new in {{new_items}} list
  </action>

  <action>**Existing item preservation:** For each item in {{epic_stories}} and {{bug_stories}} whose ID IS in {{existing_backlog_map}}:
    - Preserve the existing item's `priority` and `status` values from {{existing_backlog_map}}
    - Update title from the source file (in case it was renamed)
  </action>

  <action>Assemble {{merged_items}} = all items from {{epic_stories}} (with preserved or new priority/status) + all items from {{bug_stories}} (with preserved or new priority/status) + all items from {{orphaned_items}} (with existing priority/status preserved)</action>

  <action>**Backlog-sprint conflict detection:** Set {{backlog_sprint_conflicts}} = list of items that were in {{existing_backlog_map}} AND in {{sprint_item_ids}} (items found in both the backlog and a sprint — data integrity violation corrected by removing them from the backlog; sprint assignment takes precedence)</action>
</step>

<step n="6" goal="Sort and renumber backlog items by priority">
  <action>Sort {{merged_items}} by the following criteria (most important first):
    1. **Critical bugs first:** Items with type="bug" AND severity="critical" rank highest
       - Among critical bugs: existing items ordered by their current priority (ascending); new critical bugs ordered by their position in the discovered bug file list (alphabetical by filename)
    2. **Explicit priority (preserved from existing backlog):** Items that existed in the previous backlog are ranked by their preserved priority value (lower number = higher rank)
    3. **New items by epic order:** New items (not in existing backlog) are ranked by their epic number (ascending), then by story number within the epic (ascending)
    4. **Bugs without explicit priority:** New bugs (not in existing backlog) are appended after all stories, sorted by severity (high → medium → low → null)
    5. **Orphaned items:** Orphaned items are appended last, maintaining their relative order
  </action>
  <action>Re-number priorities sequentially: assign priority = 1 to the first item, priority = 2 to the second, etc. (position 0 in array = priority 1)</action>
  <action>Store as {{sorted_backlog}}</action>
</step>

<step n="7" goal="Build refreshed epics section">
  <action>For each epic in {{parsed_epics}}:
    - Look up the epic in the existing {{epics}} section by key (e.g., "epic-5")
    - If the epic already exists: preserve its `status` and `retrospective` values. Do NOT downgrade status (e.g., if existing status is "in-progress" and the source implies "backlog", keep "in-progress").
    - If the epic is new (not in existing epics): set status = "backlog", retrospective = "optional"
  </action>
  <action>Build {{refreshed_epics}} = map of all epics from the existing file PLUS any newly discovered epics. Existing epics not present in parsed_epics are preserved unchanged (do not remove epics that are no longer in the source, as they may be in-progress or done).</action>
</step>

<step n="8" goal="Write sprint-status.yaml atomically">
  <action>Assemble the complete file content:
    1. Preserve top-level metadata: `generated`, `project`, `project_key`, `tracking_system`, `story_location` (unchanged)
    2. Set `last_updated` = current ISO-8601 datetime string (e.g., "2026-04-06T10:00:00Z")
    3. Write `epics` section from {{refreshed_epics}}
    4. Write `backlog` section from {{sorted_backlog}} (array, ordered by priority)
    5. Write `sprints` section from the preserved {{sprints}} section (verbatim, NO changes)
  </action>
  <action>Validate before writing:
    - Every backlog item has all 7 required fields: id, type, epic, title, priority, status, severity
    - priority values are sequential starting from 1 and match array position
    - No item ID appears in both backlog and any sprint's items array
    - Every epic has both status and retrospective fields
  </action>
  <action>Write the assembled content to `_bmad-output/implementation-artifacts/sprint-status.yaml` as a single atomic write (read-modify-write pattern)</action>
</step>

<step n="9" goal="Report summary">
  <output>
## Generate Backlog — Complete

**Backlog section refreshed in `sprint-status.yaml`**

| Metric | Count |
|--------|-------|
| Total stories from epics.md | {{epic_story_count}} |
| Total bugs from bug-*.md | {{bug_count}} |
| New items added to backlog | {{new_items_count}} |
| Existing items preserved | {{preserved_count}} |
| Items excluded (sprint-assigned) | {{sprint_excluded_count}} |
| Items excluded (archived in done/) | {{done_excluded_count}} |
| Items corrected (removed from backlog — already in sprint) | {{backlog_sprint_conflicts.length}} |
| Total backlog items | {{total_backlog_count}} |

{{#if backlog_sprint_conflicts}}
⚠️ **Data integrity corrections:**
The following items were found in both the backlog and a sprint. They have been removed from the backlog (sprint assignment takes precedence):
{{#each backlog_sprint_conflicts}}
- {{id}} — {{title}}
{{/each}}

{{/if}}
{{#if orphaned_items}}
### Orphaned Items (WARNING — Human Review Required)

The following items exist in the backlog but were NOT found in `epics.md` or any `bug-*.md` file. They have been kept in the backlog but should be reviewed:

{{#each orphaned_items}}
- `{{id}}` — {{title}} (priority: {{priority}}, status: {{status}})
{{/each}}

These items may represent: renamed stories, deleted epics, or manually added items. Remove them manually if they are no longer needed.
{{/if}}

**Next steps:**
- Use `/prioritize-backlog` to reorder items
- Use `/add-to-sprint` to assign items to a sprint
- Use `/bmad-sprint-planning` to plan a full sprint
  </output>
</step>

</workflow>
