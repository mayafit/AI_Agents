# Sprint & Backlog Management — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/sprint-and-backlog-management.md. Companion specs:
> sprint-status-schema.md and mcp-detection-pattern-spec.md.

---

## Decisions

### Decision P2-5: Pre-built Extension Workflows (FR61, FR68-FR70)

**Decision:** Author workflows directly in `lib/bmad-extension/skills/` as static content

6 workflows shipped as pre-built BMAD skill files:
1. `create-bug-story` — generates a structured bug story from a bug report (FR61)
2. `add-sprint` — creates a new sprint entry in the unified `sprint-status.yaml` with capacity and iteration ID (FR68)
3. `add-to-sprint` — moves items from `backlog:` section to a sprint's `items:` in unified `sprint-status.yaml` (FR69)
4. `modify-sprint` — updates sprint metadata, reorder items, adjust capacity in unified `sprint-status.yaml` (FR70)
5. `close-sprint` — sprint close lifecycle: archive done items, handle canceled items, disposition remaining items (new — see P2-11)
6. `remove-from-sprint` — moves items from a sprint's `items:` back to `backlog:` section in unified `sprint-status.yaml`

All sprint management workflows operate on the unified `sprint-status.yaml` file (see P2-11 for data architecture). Workflows are registered in `module-help.csv` for phase discovery. They function identically whether invoked via BMAD agent menu or direct slash command (NFR19).

**Affects:** `lib/bmad-extension/skills/` (6 workflow directories), `lib/bmad-extension/module-help.csv`

### Decision P2-11: Unified Sprint-Status File Architecture (2026-04-03)

**Decision:** Consolidate sprint/backlog management into a single `sprint-status.yaml` file with structured sections, movement semantics, and a tracking-system adapter pattern

**Problem:** The previous sprint management design used 3 separate files: `backlog.yaml` (flat prioritized story list), `sprints/sprint-N.yaml` (individual sprint entity files), and `sprint-status.yaml` (status tracking). Multiple files create consistency issues — dual-writes fail, status diverges across files, and users encounter contradictory data. Skills that read or write sprint data must cross-reference multiple sources, increasing complexity and error surface.

**Architecture — Unified File Schema:**

All sprint and backlog data lives in a single `sprint-status.yaml`:

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-03T12:00:00Z"
project: ProjectName
project_key: KEY
tracking_system: file-system    # or "jira" — see MCP integration pattern below
story_location: _bmad-output/implementation-artifacts

epics:
  epic-1:
    status: in-progress          # backlog → in-progress → done
    retrospective: optional      # link to retrospective artifact

backlog:
  - id: "3-1-story-name"
    type: story                  # story | bug
    epic: 3
    title: "Story Title"
    priority: 1
    status: backlog              # backlog → ready-for-dev → in-progress → review → done
    severity: null               # only for bugs: critical | high | medium | low

sprints:
  sprint-1:
    name: "Foundation Sprint"
    status: active               # planning → active → closed
    capacity: 21
    start: "2026-04-03"
    end: "2026-04-14"
    items:
      - id: "1-2-story-name"
        type: story
        epic: 1
        title: "Story Title"
        status: in-progress
        severity: null
```

**Core Design Principles:**

1. **Single file, atomic operations** — all reads and writes target one file, eliminating dual-write consistency bugs. Skills use read-modify-write with YAML validation before write.

2. **Movement semantics** — an item exists in exactly ONE section at any time: either `backlog:` or a specific sprint's `items:` list. Moving an item means removing it from the source section and appending it to the target section in a single atomic write. No item duplication, no cross-reference reconciliation.

3. **Status progression on items:**
   - `backlog` → `ready-for-dev` → `in-progress` → `review` → `done` (plus `on-hold` and `cancelled` — see schema spec)
   - Items in `backlog:` section typically have status `backlog`, but may have other statuses (e.g., `ready-for-dev` awaiting sprint assignment)
   - Items in a sprint's `items:` may have any status from `ready-for-dev` through `done`
   - Only items with status `ready-for-dev` may be added to a sprint via `add-to-sprint`

4. **Epic status in structured section:**
   - `backlog` → `in-progress` → `done`
   - Epic status is derived from constituent story progress but stored explicitly for fast lookup
   - Each epic key holds a map with `status` and optional `retrospective` link

5. **Sprint lifecycle states:**
   - `planning` → `active` → `closed`
   - Only one sprint may be `active` at a time
   - `planning` sprints can receive items via `add-to-sprint`
   - `closed` sprints are immutable — no item changes allowed

**Close-Sprint Lifecycle Workflow:**

The `close-sprint` skill implements a structured sprint closure:

1. **Done items → archive:** Items with status `done` are removed from the sprint's `items:` list. Their corresponding story files are moved from `{story_location}/` to `{story_location}/done/`.

2. **Canceled items → archive separately:** Items explicitly marked as canceled are removed and their story files moved to `{story_location}/done/` with a canceled notation.

3. **Remaining items → user decides:** For each item still in-progress, review, or ready-for-dev, the user is prompted:
   - Move to next sprint (if one exists in `planning` state)
   - Return to backlog (resets status to `backlog`, item moves to `backlog:` section)
   - Decide per-item (interactive item-by-item disposition)

4. **Sprint status → closed:** After all items are dispositioned, the sprint's `status` is set to `closed`. The sprint entry remains in the file as historical record (no deletion).

5. **Timestamps updated:** `last_updated` is refreshed. Sprint `end` date is set to actual close date if different from planned.

**Done Archival Pattern:**

When items are archived (removed from `sprint-status.yaml`):
- The item is deleted from the sprint's `items:` list
- The corresponding story file at `{story_location}/{id}.md` is moved to `{story_location}/done/{id}.md`
- No trace of the item remains in `sprint-status.yaml` — the `done/` folder is the archive
- This keeps the active file lean and focused on current work

**Sprint Backend Selection & Jira Integration (2026-04-29 revised):**

The backend is selected at install time and stored in `_bmad/bmm/config.yaml` under `sprint_backend`. The `tracking_system` field in `sprint-status.yaml` reflects the active selection:

```yaml
tracking_system: file-system    # default — all operations read/write sprint-status.yaml
tracking_system: jira           # Jira selected at install time or switched interactively
```

**Install-time selection:** The installer wizard presents four choices:
1. **Local file-system** — `sprint-status.yaml` at the default project path (default)
2. **Remote git repository** — a git URL that is cloned to a local destination path; `sprint-status.yaml` is read from the cloned repo
3. **Custom filesystem path** — user-specified path to `sprint-status.yaml`
4. **Jira** — user provides a Jira server URL and project key; stored in `sprint_backend` config

- **`file-system` backend:** All 13 affected skills read/write `sprint-status.yaml` directly. The file is the single source of truth.
- **`jira` backend:** Skills perform the required Jira operation (create issue, update status, query sprint, etc.) using whatever Jira-capable tool the agent has available — any MCP server, plugin, or integration connected to the configured Jira instance. Skills describe the operation in natural language; the agent resolves it to the appropriate tool at runtime. No specific MCP server or tool name is required.
- **Interactive error handling:** If a Jira operation fails, the skill pauses and asks the user: (a) retry the Jira operation, or (b) switch to file management. If the user switches, the skill writes `tracking_system: file-system` to `sprint-status.yaml`, updates `sprint_backend` in `_bmad/bmm/config.yaml`, and completes the operation using the local file. The switch is permanent.
- **Same data model:** Both execution paths expose identical data shapes. Skills never branch on backend for business logic — only the I/O routing differs.

**Skill Integration Map (13 skills affected):**

| Skill | Rework Level | Operation | Section(s) Touched |
|-------|-------------|-----------|-------------------|
| `generate-backlog` | Heavy | Writes items to `backlog:` section from epics | `backlog:`, `epics:` |
| `add-to-sprint` | Heavy | Moves item from `backlog:` to sprint `items:` | `backlog:`, `sprints:` |
| `remove-from-sprint` | Heavy | Moves item from sprint `items:` back to `backlog:` | `sprints:`, `backlog:` |
| `sprint-status-view` | Heavy | Reads single file, renders progress | All sections (read-only) |
| `cleanup-done` | Heavy | Scans for done items, archives, removes from file | `sprints:`, file system |
| `bmad-sprint-planning` | Heavy | Bootstraps unified file from epics data | Creates entire file |
| `add-sprint` | Moderate | Adds sprint entry to `sprints:` section | `sprints:` |
| `modify-sprint` | Moderate | Updates sprint entry in-place (metadata, items) | `sprints:` |
| `bmad-dev-story` | Moderate | Finds item across sections, updates status field | `backlog:` or `sprints:` |
| `story-status-lookup` | Light | Searches `backlog:` + all sprint `items:` for item | All sections (read-only) |
| `bmad-sprint-status` | Light | Reads structured sections for summary | All sections (read-only) |
| `prioritize-backlog` | Light | Reads/writes `backlog:` section to reorder items by priority criteria | `backlog:` |
| `close-sprint` | New | Full sprint close lifecycle (see above) | `sprints:`, `backlog:`, file system |

**Note on skill ownership:** Of the 13 affected skills, 6 are extension module skills delivered via `lib/bmad-extension/skills/` (add-sprint, add-to-sprint, remove-from-sprint, modify-sprint, close-sprint, cleanup-done) and 7 are existing BMAD/ma-agents skills being reworked (generate-backlog, sprint-status-view, bmad-sprint-planning, bmad-dev-story, story-status-lookup, bmad-sprint-status, prioritize-backlog).

**File Location Resolution:**

In single-repo mode, `sprint-status.yaml` lives at:
```
{sprint_management_path}/_bmad-output/implementation-artifacts/sprint-status.yaml
```

In multi-repo mode (P2-10), `sprint_management_path` from `_bmad/core/config.yaml` resolves to the sprint management repository. The file path is always `_bmad-output/implementation-artifacts/sprint-status.yaml` relative to that root.

**Migration from 3-file model:**

If a project has existing `backlog.yaml`, `sprints/sprint-N.yaml`, or the old `sprint-status.yaml`:
1. `bmad-sprint-planning` detects the legacy files and offers to migrate
2. Items from `backlog.yaml` are loaded into the `backlog:` section
3. Sprint entities from `sprints/sprint-N.yaml` are loaded into `sprints:` with their items
4. Status data from old `sprint-status.yaml` is used to set item statuses
5. Legacy files are renamed with `.legacy` suffix (not deleted — user can verify and remove)

**Affects:** All 13 skills listed in the integration map above, `sprint-status.yaml` (new unified file), `{story_location}/done/` (archive directory)

#### P2-11 amendment (2026-10-31, P5-10): the tracker hook contract

The backend-routing block (`mcp-detection-pattern-spec.md`) no longer lives inside each sprint skill. From P5-10:

- **`ma-sprint` skills expose a hook, not a branch.** Each skill's `customize.toml` declares `[workflow] tracker = "file-system"` and an `activation_steps_prepend` slot. The skill body implements file-system behaviour only and reads `{workflow.tracker}` at activation.
- **The Jira branch is one adapter reference** (`ma-atlassian/references/jira-tracker.md`): the routing block, the identity clause (`assignee = currentUser()`, shared-account STOP), the entity mapping to the canonical schema (§6.3) and the retry / switch-to-file-system failure contract — moved verbatim from the 13 skills, maintained once.
- **Binding is by override.** `ma-atlassian`'s setup skill writes a marker-delimited `_bmad/custom/<skill>.toml` for each installed target: `tracker = "jira"` plus a prepend step that loads the adapter reference. Removing the override (or the module) returns the skill to file-system behaviour with no edit.
- **Upstream skills are bound the same way.** `bmad-sprint-planning` (v6.12, `sprint_plan.py` core — preserves `project_key`, `tracking_system`, `story_location`), `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-correct-course`, `bmad-retrospective`, `bmad-walkthrough`. ma-agents' shadow `bmad-sprint-planning` / `bmad-sprint-status` / `bmad-dev-story` are deleted; `v6-shims/` are never bound.
- **Unknown tracker value** keeps §2.5's fall-back-to-file-system semantics (unchanged — this is sprint state, not a knowledge store; contrast FR262).
- **`project_key`, `tracking_system`** continue to be written to `sprint-status.yaml` by whichever skill initialises it; the Atlassian module's config questions (Jira URL, project key) feed them via the binding generated from `project-layout.yaml` (P5-9), not via the ma-agents wizard.
