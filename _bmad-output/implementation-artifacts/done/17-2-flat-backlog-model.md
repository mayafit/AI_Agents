# Story 17.2: Flat Backlog Model

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want a flat backlog file listing all stories and bugs in priority order, independent of their parent epic,
So that sprint planning works from a single prioritized list, not epic-grouped sections.

## Acceptance Criteria

1. **Given** the backlog is generated from the epics document,
   **When** the backlog file is created at `{implementation_artifacts}/backlog.yaml`,
   **Then** it contains ALL stories and bugs as a flat ordered list:
   ```yaml
   backlog:
     - id: "5-5-explicit-parameter-passing"
       type: story
       epic: 5
       title: "Explicit Parameter Passing"
       priority: 1
       status: backlog
     - id: "BUG-path-spaces"
       type: bug
       epic: null
       title: "Fix space-in-path bug"
       priority: 2
       status: backlog
       severity: high
   ```

2. **Given** a story is assigned to a sprint,
   **When** the backlog is viewed,
   **Then** the item shows `sprint: sprint-3` indicating its assignment,
   **And** it is still visible in the backlog (with sprint annotation) for reference.

3. **Given** stories exist across multiple epics,
   **When** the backlog is ordered,
   **Then** ordering is by the `priority` field, not by epic number,
   **And** items from different epics can be interleaved based on priority.

4. **Given** an item has status `done`,
   **When** the backlog is generated or refreshed,
   **Then** it is NOT included in the backlog (done items live in the done archive).

## Tasks / Subtasks

- [x] Task 1: Define backlog.yaml schema (AC: #1, #2, #3, #4)
  - [x] 1.1: Create the authoritative backlog YAML schema documentation in `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` (renamed by Story 17.1). Schema fields per item:
    - `id` (string): Story IDs follow `{epic}-{story}-{slug}` format; Bug IDs follow `BUG-{slug}` format (per Story 17.1 Item ID Format Contract)
    - `type` (enum): `story` or `bug`
    - `epic` (int|null): Epic number for stories; `null` for bugs (FR64 — bugs don't belong to epics)
    - `title` (string): Human-readable title, always quoted in YAML
    - `priority` (int): Sequential integer starting from 1, lower = higher priority
    - `status` (enum): `backlog | ready-for-dev | in-progress | review` (done items excluded per AC #4)
    - `sprint` (string|null): Sprint ID if assigned (e.g., `sprint-3`), `null` if unassigned
    - `severity` (enum|null): `critical | high | medium | low` for bugs only, `null` for stories
  - [x] 1.2: Add backlog schema to guardrails doc under a new "Backlog Model" section

- [x] Task 2: Create `generate-backlog` SKILL.md (AC: #1, #3, #4)
  - [x] 2.1: Create skill package at `lib/bmad-extension/skills/generate-backlog/SKILL.md` with YAML frontmatter:
    ```yaml
    ---
    name: generate-backlog
    description: Generate or refresh the flat backlog from epics and bug story files
    type: skill
    triggers:
      - "generate backlog"
      - "refresh backlog"
    ---
    ```
  - [x] 2.2: Create `lib/bmad-extension/skills/generate-backlog/bmad-skill-manifest.yaml`
  - [x] 2.3: Implement the workflow steps in SKILL.md:
    - **Step 1: Load sources**
      - Read `_bmad-output/planning-artifacts/epics.md` (or sharded equivalent)
      - Glob `_bmad-output/implementation-artifacts/bug-*.md` for bug story files
      - Read existing `_bmad-output/implementation-artifacts/backlog.yaml` if it exists (to preserve priority overrides and sprint assignments)
    - **Step 2: Extract stories from epics**
      - Parse each epic section for stories with format `{epic_num}-{story_num}-{slug}`
      - Extract: id, title, epic number
      - Look up current status from `sprint-status.yaml` development_status entries
      - Exclude any item with status `done` (AC #4)
    - **Step 3: Extract bugs**
      - For each `bug-*.md` file, parse YAML frontmatter for: type, severity, title
      - Derive id as `BUG-{slug}` from filename (strip `bug-` prefix, uppercase to `BUG-`)
      - Set `epic: null` for all bugs
      - Exclude any bug with status `done`
    - **Step 4: Merge with existing backlog**
      - If existing backlog.yaml exists, preserve `priority` and `sprint` assignments for items that still exist
      - New items (not in existing backlog) get appended at the end with sequential priorities after existing items
      - Items in existing backlog that no longer exist in sources are removed
      - Items that have become `done` since last generation are removed
    - **Step 5: Write backlog.yaml**
      - Sort items by `priority` field (ascending)
      - Re-number priorities as sequential integers 1..N (no gaps)
      - Write to `_bmad-output/implementation-artifacts/backlog.yaml`
      - Include header comment with generation timestamp
    - **Step 6: Report**
      - Display summary: total items, stories count, bugs count, new items added, items removed

- [x] Task 3: Register in module-help.csv (AC: #1)
  - [x] 3.1: Add row to `lib/bmad-extension/module-help.csv`:
    ```
    ma-skills,4-implementation,Generate Backlog,generate-backlog,,skill:generate-backlog,generate-backlog,false,bmm-sm,,"Generate or refresh flat backlog from epics and bug stories.",_bmad-output/implementation-artifacts,"backlog",
    ```

- [x] Task 4: Update sprint-planning workflow to call generate-backlog (AC: #1)
  - [x] 4.1: Identify the sprint-planning workflow location (`_bmad/bmm/4-implementation/bmad-sprint-planning/workflow.md`)
  - [x] 4.2: **Do NOT modify** the bmm workflow directly — instead, add a note in the generate-backlog SKILL.md that sprint-planning should invoke `/generate-backlog` as its first step when backlog model is available
  - [x] 4.3: Add guidance in the SKILL.md output that explains the relationship: "Sprint-planning workflow should run `/generate-backlog` first to ensure the backlog is current before selecting stories for sprint creation"

- [x] Task 5: Update guardrails with data authority (AC: #1, #2)
  - [x] 5.1: Add to `sprint-management-guardrails.md` Data Authority Rules table:
    | Concern | Authoritative Source | Read By |
    |---|---|---|
    | Item priority ordering | `backlog.yaml` | 17.4, 17.5, 17.7, 17.8 |
    | Sprint membership | `sprints/sprint-{id}.yaml` | 17.4, 17.5, 17.6, 17.8 |
  - [x] 5.2: Document that `sprint-status.yaml` is now a **derived file** — generated from backlog.yaml + sprint files (Story 17.8 will implement the derivation)
  - [x] 5.3: Document backlog discovery glob: `_bmad-output/implementation-artifacts/backlog.yaml` (single file, not globbed)

- [x] Task 6: Verify (AC: #1, #2, #3, #4)
  - [x] 6.1: Trace SKILL.md logic — confirm all story extraction paths produce valid backlog entries
  - [x] 6.2: Verify bug entries have `epic: null` and include `severity` field
  - [x] 6.3: Verify done items are excluded from output
  - [x] 6.4: Verify priority re-numbering produces sequential integers with no gaps
  - [x] 6.5: Verify existing priority/sprint assignments are preserved on re-generation
  - [x] 6.6: Verify sprint field shows sprint ID when assigned, null when unassigned

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** Following Epic 15 pattern, create the skill as a SKILL.md package at `lib/bmad-extension/skills/generate-backlog/`
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/` (NOT in `_bmad/bmm/workflows/`)
- **YAML artifact format:** Backlog uses YAML, consistent with sprint files
- **Single file model:** The backlog is ONE file (`backlog.yaml`), not sharded — it's the flat list of all active items
- **Idempotent generation:** Running generate-backlog multiple times with no source changes produces identical output (minus timestamp)

### Backlog YAML Schema (Authoritative)

```yaml
# backlog.yaml — Flat prioritized backlog
# Generated by generate-backlog skill
# Last generated: {ISO-8601 timestamp}

backlog:
  - id: "5-5-explicit-parameter-passing"   # Story ID: {epic}-{story}-{slug}
    type: story                             # enum: story | bug
    epic: 5                                 # int for stories, null for bugs
    title: "Explicit Parameter Passing"     # always quoted
    priority: 1                             # sequential int, 1 = highest
    status: backlog                         # from sprint-status.yaml
    sprint: null                            # sprint-{id} if assigned, null if not
    severity: null                          # null for stories
  - id: "BUG-path-spaces"                  # Bug ID: BUG-{slug}
    type: bug
    epic: null                              # bugs don't belong to epics (FR64)
    title: "Fix space-in-path bug"
    priority: 2
    status: backlog
    sprint: "sprint-3"                      # assigned to sprint-3
    severity: high                          # bug-specific: critical|high|medium|low
```

### Relationship to sprint-status.yaml

- `sprint-status.yaml` continues to exist but is now a **derived view** — generated from `backlog.yaml` + `sprints/sprint-{id}.yaml` files
- Story 17.8 implements the derivation logic
- Until 17.8 lands, `sprint-status.yaml` remains the manual source of truth for story status
- The `generate-backlog` skill READS status from `sprint-status.yaml` but NEVER WRITES to it

### What Changes from Current Model

| Aspect | Current (Epic 12) | New (Epic 17) |
|---|---|---|
| Priority source | Epic order in sprint-status.yaml | `priority` field in backlog.yaml |
| Item ordering | Grouped by epic | Flat, interleaved by priority |
| Bug inclusion | Discovered via glob, not in status file | First-class entries in backlog.yaml |
| Sprint assignment | Only in sprint-plan files | Also annotated in backlog.yaml `sprint` field |
| Done items | Remain in sprint-status.yaml forever | Excluded from backlog (archived in done/) |

### Impact on Other Epic 17 Stories

- **17.4 (Backlog-to-Sprint):** Reads backlog.yaml to present unassigned items, writes `sprint` field when assigning
- **17.5 (Sprint-to-Backlog):** Clears `sprint` field when removing from sprint
- **17.6 (Done Item Cleanup):** Removes done items from backlog.yaml
- **17.7 (Prioritization):** Reorders `priority` field in backlog.yaml
- **17.8 (Sprint Status Display):** Reads backlog.yaml for unassigned items section

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify `sprint-status.yaml` — only READ from it for status lookup
- Do NOT include `done` items in the backlog — they are archived
- Do NOT auto-assign priorities based on severity or business value — initial generation uses epic order, subsequent prioritization is via Story 17.7
- Backlog must preserve existing priority/sprint data on re-generation (idempotent merge)
- Always quote the `title` field in YAML output
- Bug entries MUST have `epic: null` (FR64)
- **Modify SKILL.md, not just workflow.md** — SKILL.md is the file invoked by skill resolution

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/skills/generate-backlog/SKILL.md` — new skill (authoritative)
  - `lib/bmad-extension/skills/generate-backlog/bmad-skill-manifest.yaml` — skill manifest
- **Files to modify:**
  - `lib/bmad-extension/module-help.csv` — add generate-backlog row
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — add backlog schema, data authority rules (assumes Story 17.1 has renamed this file)
- **Files to create (output):**
  - `_bmad-output/implementation-artifacts/backlog.yaml` — generated output (not committed to template, generated at runtime)
- **Files NOT to touch:**
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (read-only from this workflow)
  - Any files under `_bmad/` or `lib/installer.js`
  - Sprint files under `sprints/` (read-only for sprint assignment lookup)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.2] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR65] — Flat backlog model, not grouped by epic
- [Source: _bmad-output/planning-artifacts/prd.md#FR66] — Sprint capacity as item count
- [Source: _bmad-output/planning-artifacts/prd.md#FR128] — Bugs as story type in backlog
- [Source: _bmad-output/planning-artifacts/prd.md#FR130] — Done items removed from sprint status
- [Source: _bmad-output/implementation-artifacts/17-1-sprint-entity-model.md] — Sprint YAML schema, Item ID Format Contract
- [Source: _bmad-output/implementation-artifacts/epic-11-12-shared-guardrails.md] — Current guardrails (to be renamed/updated by 17.1)
- [Source: lib/bmad-extension/skills/add-to-sprint/SKILL.md] — Current add-to-sprint workflow that reads from sprint-status.yaml (to be reworked in 17.4)
- [Source: lib/bmad-extension/skills/create-bug-story/SKILL.md] — Bug story creation workflow and file format
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration

### Git Intelligence

Recent commits show Epic 15/16 patterns. Key conventions:
- Conventional commit format: `feat(epic-17): story 17-2 flat backlog model`
- SKILL.md + bmad-skill-manifest.yaml is the standard skill package format
- `module-help.csv` uses `skill:{name}` to resolve to SKILL.md

## Change Log

- 2026-03-30: Story implemented — generate-backlog skill created with flat backlog YAML schema, registered in module-help.csv, guardrails updated with backlog model and data authority rules.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation.

### Completion Notes List

Created generate-backlog skill (SKILL.md + manifest). Registered in module-help.csv. Updated guardrails with backlog model schema.

### File List

- `lib/bmad-extension/skills/generate-backlog/SKILL.md` (new)
- `lib/bmad-extension/skills/generate-backlog/bmad-skill-manifest.yaml` (new)
- `lib/bmad-extension/module-help.csv` (modified)
- `sprint-management-guardrails.md` (modified)
