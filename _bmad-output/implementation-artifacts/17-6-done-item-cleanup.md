# Story 17.6: Done Item Cleanup

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want done stories and bugs automatically removed from the sprint status and their files moved to a done/ subfolder,
So that the active sprint view stays clean and the archive is organized.

## Acceptance Criteria

1. **Given** a story or bug status changes to `done`,
   **When** the sprint status is refreshed (via sprint-planning workflow or sprint-status workflow),
   **Then** the done item is removed from `sprint-status.yaml`'s `development_status` section,
   **And** the done item is removed from its sprint file's `items` array,
   **And** the sprint file's effective capacity increases by 1 (slot freed).

2. **Given** a story file exists at `{implementation_artifacts}/{story-id}.md`,
   **When** the story reaches `done` status,
   **Then** the file is moved to `{implementation_artifacts}/done/{story-id}.md`,
   **And** if the `done/` subfolder doesn't exist, it is created.

3. **Given** a bug file exists at `{implementation_artifacts}/BUG-{title}.md`,
   **When** the bug reaches `done` status,
   **Then** the file is moved to `{implementation_artifacts}/done/BUG-{title}.md`.
   **Note:** Bug files use lowercase `bug-{slug}.md` naming. The file is moved as-is: `done/bug-{slug}.md`.

4. **Given** all items in a sprint reach `done` status,
   **When** the sprint is refreshed,
   **Then** the sprint status changes to `closed`,
   **And** the sprint file is preserved (historical record) but `items` array is empty.

## Tasks / Subtasks

- [ ] Task 1: Create cleanup-done SKILL.md (AC: #1, #2, #3, #4)
  - [ ] 1.1: Create skill package at `lib/bmad-extension/skills/cleanup-done/SKILL.md` with YAML frontmatter:
    ```yaml
    ---
    name: cleanup-done
    description: Archive done stories and bugs — move files to done/ subfolder and remove from sprint/backlog
    type: skill
    triggers:
      - "cleanup done"
      - "archive done items"
    ---
    ```
  - [ ] 1.2: Create `lib/bmad-extension/skills/cleanup-done/bmad-skill-manifest.yaml`
  - [ ] 1.3: Implement workflow steps:

    **Step 1: Identify done items**
    - Read `_bmad-output/implementation-artifacts/sprint-status.yaml` — find all entries in `development_status` with status `done`
    - Read `_bmad-output/implementation-artifacts/backlog.yaml` (if exists) — find all entries with `status: done`
    - Glob `_bmad-output/implementation-artifacts/bug-*.md` — check frontmatter for `status: done`
    - Build consolidated list of done items from all sources (deduplicate by ID)
    - If no done items found: display "No done items to clean up." and exit

    **Step 2: Display done items for confirmation**
    - Show table: #, ID, Title, Type, Current Location, Sprint (if assigned)
    - Prompt: "[a] Archive all / [s] Select specific items / [q] Cancel"
    - If 'q': exit
    - If 's': prompt for item numbers

    **Step 3: Ensure done/ directory exists**
    - Check if `_bmad-output/implementation-artifacts/done/` exists
    - If not, create it (AC #2)

    **Step 4: Move files to done/ subfolder (AC: #2, #3)**
    - For each confirmed done item:
      - **Stories:** Move `_bmad-output/implementation-artifacts/{story-id}.md` to `_bmad-output/implementation-artifacts/done/{story-id}.md`
      - **Bugs:** Move `_bmad-output/implementation-artifacts/bug-{slug}.md` to `_bmad-output/implementation-artifacts/done/bug-{slug}.md`
      - Use file rename (not copy+delete) — preserves git history tracking
      - If source file doesn't exist (already moved or never created): log warning, skip
      - If destination file already exists: log warning "File already in done/ archive", skip move

    **Step 5: Remove from sprint files (AC: #1, #4)**
    - Glob `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml`
    - For each sprint file:
      - Read `items` array
      - Remove any done item IDs from the array
      - If items were removed: update `last_modified` timestamp, write file
      - If `items` array is now empty AND sprint status is `active`: change sprint status to `closed` (AC #4)
      - If `items` array is now empty AND sprint status is `planning`: leave as `planning` (empty planning sprint is valid)

    **Step 6: Remove from backlog.yaml (AC: #1)**
    - Read `backlog.yaml`
    - Remove all done items from the backlog list
    - Re-number priorities as sequential integers 1..N (no gaps)
    - Write updated backlog.yaml

    **Step 7: Remove from sprint-status.yaml (AC: #1)**
    - Read `sprint-status.yaml`
    - For each done story item: remove the key from `development_status` section
    - Do NOT remove epic keys or retrospective keys — only story/bug keys
    - If all stories in an epic are now removed (all done): update epic status to `done`
    - Preserve ALL comments and structure including STATUS DEFINITIONS header
    - Update `last_updated` field (if it exists)
    - Write updated file

    **Step 8: Report**
    - Display summary:
      - Files moved to done/: count and list
      - Items removed from sprint files: count
      - Sprint(s) auto-closed: list (if any)
      - Items removed from backlog: count
      - Items removed from sprint-status.yaml: count
    - Display: "Sprint capacity freed: {count} slot(s)"

- [ ] Task 2: Register in module-help.csv (AC: #1)
  - [ ] 2.1: Add row to `lib/bmad-extension/module-help.csv`:
    ```
    ma-skills,4-implementation,Cleanup Done,cleanup-done,,skill:cleanup-done,cleanup-done,false,bmm-sm,,"Archive done items — move files to done/ and remove from sprint/backlog.",_bmad-output/implementation-artifacts,"archived items",
    ```

- [ ] Task 3: Add cleanup trigger to sprint-status and sprint-planning workflows
  - [ ] 3.1: Add a note in the cleanup-done SKILL.md output section that sprint-status and sprint-planning workflows should invoke `/cleanup-done` as a pre-step to ensure the view is clean before display/planning
  - [ ] 3.2: Do NOT modify `_bmad/bmm/4-implementation/bmad-sprint-planning/workflow.md` or `_bmad/bmm/4-implementation/bmad-sprint-status/workflow.md` directly — those are bmm core workflows. Instead, document the integration point.

- [ ] Task 4: Update guardrails (AC: #1, #2, #3, #4)
  - [ ] 4.1: Add to `sprint-management-guardrails.md`:
    - Done Item Archive section: files move to `done/` subfolder via rename
    - Sprint Auto-Close rule: sprint closes when all items are done and removed
    - Document that cleanup-done is the ONLY workflow that removes items from sprint-status.yaml's development_status (other than manual edits)

- [ ] Task 5: Verify (AC: #1, #2, #3, #4)
  - [ ] 5.1: Verify file move uses rename (not copy+delete) for stories and bugs
  - [ ] 5.2: Verify done/ directory is created if missing
  - [ ] 5.3: Verify sprint file items array is updated and last_modified set
  - [ ] 5.4: Verify sprint auto-close when items array becomes empty on active sprint
  - [ ] 5.5: Verify backlog.yaml is cleaned and priorities re-numbered
  - [ ] 5.6: Verify sprint-status.yaml comments and structure are preserved
  - [ ] 5.7: Verify epic status is updated to done when all stories removed
  - [ ] 5.8: Verify existing done/ files are not overwritten (skip with warning)

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** New skill at `lib/bmad-extension/skills/cleanup-done/SKILL.md`
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/cleanup-done/`
- **Multi-write pattern:** This workflow writes to up to 4 file types: done/ files, sprint files, backlog.yaml, sprint-status.yaml
- **File rename, not copy+delete:** Use `fs.rename()` equivalent to preserve git history tracking (FR131)
- **The `done/` subfolder already exists** at `_bmad-output/implementation-artifacts/done/` — this story formalizes its use

### Data Flow

```
READ:  sprint-status.yaml → identify done story items
READ:  backlog.yaml → identify done items with backlog entries
READ:  bug-*.md frontmatter → identify done bugs
READ:  sprints/sprint-*.yaml → find sprints containing done items

WRITE: done/{file}.md → move file from active to archive
WRITE: sprints/sprint-{id}.yaml → remove done items from items array
WRITE: backlog.yaml → remove done items, renumber priorities
WRITE: sprint-status.yaml → remove done story entries, update epic statuses
```

### Done Detection Sources

Done items can be detected from multiple sources:
1. `sprint-status.yaml` development_status entries with value `done` — primary source for stories
2. `backlog.yaml` entries with `status: done` — if backlog model is active
3. `bug-*.md` frontmatter with `status: done` — for bugs

The cleanup workflow checks ALL sources and deduplicates by ID to ensure comprehensive cleanup.

### Sprint Auto-Close Logic

```
IF sprint.items becomes empty after cleanup
  AND sprint.status == "active"
THEN sprint.status = "closed"

IF sprint.items becomes empty after cleanup
  AND sprint.status == "planning"
THEN no status change (empty planning sprint is valid)

IF sprint.status == "closed"
THEN skip (already closed, no action needed)
```

### Epic Auto-Done Logic

```
IF all story keys matching epic-{N}-* pattern
  are removed from sprint-status.yaml (all done)
  AND epic-{N} entry exists
THEN set epic-{N} status to "done"
```

### Impact on Other Epic 17 Stories

- **17.1 (Sprint Entity):** Sprint files modified by cleanup (items array, status, last_modified)
- **17.2 (Flat Backlog):** Backlog.yaml modified by cleanup (done items removed)
- **17.4 (Backlog-to-Sprint):** After cleanup, freed capacity in sprints becomes available
- **17.5 (Sprint-to-Backlog):** Different operation — 17.5 returns items to backlog, 17.6 archives them
- **17.8 (Sprint Status Display):** After cleanup, done items no longer appear in sprint views

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT delete files — MOVE them to done/ subfolder (FR131)
- Do NOT overwrite existing files in done/ — skip with warning
- Do NOT remove epic keys or retrospective keys from sprint-status.yaml — only remove story/bug keys
- ALWAYS preserve sprint-status.yaml comments and structure
- ALWAYS use file rename, not copy+delete
- ALWAYS re-number backlog priorities after removal (no gaps)
- Sprint auto-close ONLY applies to `active` sprints, not `planning` sprints
- **Do NOT modify bmm core workflows** — document integration points only

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/skills/cleanup-done/SKILL.md` — new skill (authoritative)
  - `lib/bmad-extension/skills/cleanup-done/bmad-skill-manifest.yaml` — skill manifest
- **Files to modify:**
  - `lib/bmad-extension/module-help.csv` — add cleanup-done row
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — document archive rules, auto-close, auto-done
- **Files modified at runtime (by the skill):**
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — removes done entries
  - `_bmad-output/implementation-artifacts/backlog.yaml` — removes done items
  - `_bmad-output/implementation-artifacts/sprints/sprint-*.yaml` — removes done items from arrays
  - `_bmad-output/implementation-artifacts/*.md` → `done/*.md` — file moves
- **Files NOT to touch (at development time):**
  - `_bmad/bmm/4-implementation/bmad-sprint-planning/workflow.md`
  - `_bmad/bmm/4-implementation/bmad-sprint-status/workflow.md`
  - Any files under `_bmad/core/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.6] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR130] — Done items removed from sprint status file
- [Source: _bmad-output/planning-artifacts/prd.md#FR131] — Done story files moved to done/ subfolder
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Sprint YAML schema, status transitions (active -> closed)
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog schema (done items excluded)
- [Source: lib/bmad-extension/skills/create-bug-story/SKILL.md] — Bug file format and naming convention
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration

### Git Intelligence

Recent commits show Epic 15/16 patterns:
- Conventional commit format: `feat(epic-17): story 17-6 done item cleanup`
- New skill creation follows: SKILL.md + bmad-skill-manifest.yaml + module-help.csv registration

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
