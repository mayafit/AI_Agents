# Sprint & Backlog Management

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capability F10. Architecture: P2-5, P2-11 (unified sprint-status.yaml).
> 
> NOTE: the Sprint Management NFR section exists but defines ZERO quality
> attributes — 19 functional requirements with no non-functional constraints.

---

## Functional Requirements

### Sprint & Backlog Management — Unified Sprint-Status

#### Unified Data Model

- FR65: All sprint, backlog, and epic status data is managed in a single `sprint-status.yaml` file with three sections: `epics` (epic-level status tracking), `backlog` (items not assigned to any sprint), and `sprints` (sprint entities with their assigned items). The separate `backlog.yaml` and per-sprint `sprints/sprint-N.yaml` files are eliminated — there is one file, one source of truth
- FR66: Sprint capacity is defined by number of items (stories + bugs), configured by the Scrum Master during sprint planning
- FR67: Story/bug prioritization supports multiple criteria beyond epic precedence — criteria include severity, business value, dependencies, type, and age
- FR128: Bugs are a story type in the backlog — they have the same lifecycle as stories (backlog → ready-for-dev → in-progress → review → done) plus bug-specific fields (problem description, reproduction steps, severity, version found)
- FR133: The `sprint-status.yaml` file includes top-level metadata: `generated` (creation timestamp), `last_updated` (last modification timestamp), `project` (project name), `project_key` (short identifier), `tracking_system` (`file-system` or `jira`), and `story_location` (path to story `.md` files, default `_bmad-output/implementation-artifacts`)
- FR134: Each item in the backlog or sprint sections carries a consistent structure: `id` (story/bug identifier), `type` (`story` or `bug`), `epic` (parent epic number or null for bugs), `title`, `priority` (numeric), `status` (backlog / ready-for-dev / in-progress / review / done / canceled), and `severity` (null for stories, critical/high/medium/low for bugs)
- FR135: Each sprint entity in the `sprints` section carries: `name`, `status` (planning / active / closed), `capacity`, optional `start` and `end` dates, and an `items` list containing the assigned stories and bugs

#### Unified Sprint-Status Schema

The canonical `sprint-status.yaml` schema is:

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-03T12:00:00Z"
project: ProjectName
project_key: KEY
tracking_system: file-system    # or "jira"
story_location: _bmad-output/implementation-artifacts

epics:
  epic-1:
    status: in-progress          # planning | in-progress | done
    retrospective: null          # optional — path or summary after epic completion

backlog:                         # Stories/bugs NOT assigned to any sprint
  - id: "3-1-story-name"
    type: story
    epic: 3
    title: "Story Title"
    priority: 1
    status: backlog
    severity: null

sprints:
  sprint-1:
    name: "Foundation Sprint"
    status: active               # planning | active | closed
    capacity: 21
    start: "2026-04-03"
    end: "2026-04-14"
    items:                       # Stories/bugs MOVED here from backlog
      - id: "1-2-story-name"
        type: story
        epic: 1
        title: "Story Title"
        priority: 2
        status: in-progress
        severity: null
```

#### Movement Semantics

- FR69: A BMAD extension workflow enables moving stories and bugs from the `backlog` section into a sprint's `items` list — the item is removed from `backlog` and added to the target sprint. Items are never duplicated across sections
- FR129: A BMAD extension workflow (`remove-from-sprint`) enables removing stories or bugs from a sprint's `items` list and moving them back to the `backlog` section of `sprint-status.yaml` — the item is removed from the sprint and returned to the backlog without changing its status
- FR136: When moving items between sprints (e.g., during sprint close), items are removed from the source sprint's `items` list and added to the destination sprint's `items` list — maintaining the invariant that each item exists in exactly one location

#### Sprint Lifecycle

- FR68: A BMAD extension workflow enables adding a new sprint with defined capacity, iteration identifier, optional start/end dates, and initial status of `planning`
- FR70: A BMAD extension workflow enables changing/modifying a sprint (reorder items, swap items, adjust capacity, update dates, change status)
- FR137: A BMAD extension workflow enables closing a sprint. The close workflow executes the following lifecycle:
  1. Items with status `done` are removed from the sprint's `items` list and their `.md` files are archived to a `done/` subfolder
  2. Items with status `canceled` are removed from the sprint's `items` list and their `.md` files are archived to a `done/canceled/` subfolder
  3. Remaining items (in-progress, blocked, backlog, ready-for-dev) are presented to the user with three options: (a) move all to the next sprint, (b) return all to backlog, or (c) decide per item — the user can assign each remaining item individually to the next sprint or to the backlog
  4. The sprint's status is set to `closed`
- FR71: Sprint status displays the unified `sprint-status.yaml` contents — real sprint definitions with assigned items, epic status, and the unassigned backlog — not just a list of epics

#### Done Archival

- FR130: When a story or bug reaches "done" status, it is removed from `sprint-status.yaml` entirely — done items do not clutter the active status view
- FR131: When a story or bug reaches "done" status, its story `.md` file is moved from the active stories directory to a `done/` subfolder — preserving the artifact while keeping the active directory clean
- FR138: The `generate-backlog` skill regenerates the `backlog` section of `sprint-status.yaml` from epics and bug stories, preserving items that are already assigned to sprints (items in any sprint's `items` list are not duplicated into the backlog)

#### Sprint Backend Selection

- FR139: During installation, the installer wizard prompts the user to select a sprint management backend: (a) **local file-system** — `sprint-status.yaml` at the default project path, (b) **remote git repository** — a git URL that is cloned to a local path; `sprint-status.yaml` is read from the cloned repo, (c) **custom filesystem path** — a user-specified path to a `sprint-status.yaml` file, or (d) **Jira** — requires the user to provide a Jira server URL and project key. The selection is stored in `_bmad/bmm/config.yaml` under `sprint_backend`. The `tracking_system` field in `sprint-status.yaml` reflects the active backend (`file-system` or `jira`).
- FR140: When `tracking_system: jira` is active, all sprint management skills operate against Jira as the source of truth for all issue types — stories, epics, bugs, and sprints. Skills use whatever Jira-capable tool the agent has available (any MCP server, plugin, or integration that can communicate with the configured Jira instance). On failure, the skill pauses and presents the user with two options: retry the Jira operation, or switch to file management. If the user chooses to switch, the skill updates `tracking_system` to `file-system` in `sprint-status.yaml` and continues the operation using the local file. The switch is permanent.

> Applies to the 3.x line; the 4.x line is specified in F29 (FR296 / FR300).

## Quality Attributes (Non-Functional Requirements)

### Sprint Management

- FR132: (reserved — see FR65-FR71, FR128-FR140 for all sprint management requirements)
