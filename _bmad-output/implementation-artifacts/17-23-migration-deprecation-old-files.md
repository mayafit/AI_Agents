# Story 17.23: Migration & Deprecation of Old File Formats

Status: ready-for-dev

## Story

As a **DevOps Engineer / Scrum Master**,
I want a one-time migration procedure that converts the old three-file sprint model (`sprint-status.yaml` with flat `development_status`, `backlog.yaml`, `sprints/sprint-N.yaml`, `sprint-plan-*.yaml`) into the unified `sprint-status.yaml` schema, relocates deprecated files, and verifies that all 13 reworked skills no longer reference the old formats,
So that the project transitions cleanly to the unified model without data loss and no old-format code paths remain.

## Context: Why This Story Exists

This is the LAST functional story in Epic 17's execution order. By the time this story is implemented, ALL 13 sprint management skills will have been reworked (Stories 17.10 through 17.22, plus 17.24) to operate exclusively on the unified three-section `sprint-status.yaml` schema defined in Story 17.9. This story handles two concerns that remain after the skills are reworked:

1. **Data migration** -- Projects that adopted the old file model before Epic 17 need their data consolidated into the unified format.
2. **Old-format verification** -- Confirm that no reworked skill still reads, writes, or references the deprecated file formats.

## Deliverable Form: Migration Procedure (NOT a Persistent Skill)

**Winston (Architect) decision:** This story does NOT produce a persistent IDE skill or BMAD extension skill. It produces:

1. A **one-time migration procedure** documented in a migration guide (markdown). The Scrum Master or DevOps Engineer runs it once per project, guided by the document.
2. A **verification checklist** embedded in this story's tasks that the dev agent executes to confirm all old-format references are eliminated from skill source files.
3. An optional **migration helper script** (Node.js) at `scripts/migrate-sprint-status.js` that automates the data conversion. This script is a one-time utility, not a deployed skill -- it lives in `scripts/` (not `skills/` or `lib/bmad-extension/skills/`).

**Rationale:** A persistent skill would add permanent deployment overhead (two pipelines, MANIFEST entry, module-help.csv row) for something that runs exactly once per project. The migration is a transitional artifact that should NOT be installed into agent skill directories.

## Acceptance Criteria

1. **Given** a project has the old `sprint-status.yaml` with a flat `development_status` map (old schema),
   **When** the migration procedure is executed,
   **Then** it creates a new `sprint-status.yaml` with the three-section schema (`epics`, `backlog`, `sprints`) as defined by Story 17.9,
   **And** epic entries are extracted from `development_status` keys matching `epic-*` (with their statuses),
   **And** retrospective entries are extracted from keys matching `*-retrospective` and folded into the corresponding epic's `retrospective` field,
   **And** story/bug statuses are extracted from remaining keys and applied to the corresponding items,
   **And** the original file is backed up to `sprint-status.yaml.old` before overwriting.

2. **Given** a project has an old `backlog.yaml` file in the implementation artifacts directory,
   **When** the migration procedure is executed,
   **Then** all items from `backlog.yaml` are imported into the `backlog` section of the new unified `sprint-status.yaml`,
   **And** priority ordering from the old file is preserved,
   **And** items that are already assigned to a sprint (per old sprint files or old `development_status`) are placed in the appropriate sprint's `items` array instead of `backlog`,
   **And** no item is duplicated across sections (single-location invariant from Story 17.9).

3. **Given** a project has old `sprints/sprint-N.yaml` files or `sprint-plan-*.yaml` files in the implementation artifacts directory,
   **When** the migration procedure is executed,
   **Then** each sprint is imported as an entry in the `sprints` map of the unified `sprint-status.yaml`,
   **And** items referenced in old sprint files are matched by ID and placed in the sprint's `items` array,
   **And** sprint metadata (`name`, `status`, `capacity`, `start`, `end`) is preserved where available,
   **And** the `items` array conforms to the unified schema (no `priority` field on sprint items).

4. **Given** the migration encounters conflicting statuses for the same item across old files,
   **When** the conflict is detected,
   **Then** the migration uses the status from `sprint-status.yaml` (the `development_status` map is the authority for status),
   **And** a migration report is generated listing all conflicts and their resolutions.

5. **Given** the migration completes successfully,
   **When** the new unified `sprint-status.yaml` passes validation,
   **Then** deprecated files are MOVED (not deleted) to a `deprecated/` subfolder under implementation artifacts:
   - `backlog.yaml` -> `deprecated/backlog.yaml`
   - `sprints/` directory -> `deprecated/sprints/`
   - `sprint-plan-*.yaml` -> `deprecated/sprint-plan-*.yaml`
   - `sprint-status.yaml.old` (the backup) remains in place for manual review
   **And** the `deprecated/` folder is added to `.gitignore` (or documented as safe to delete after verification).

6. **Given** the migration has already been run (unified schema detected, no legacy files present),
   **When** the migration procedure is invoked again,
   **Then** it reports "No migration needed -- unified schema already in use" and exits without changes (idempotent).

7. **Given** all 13 reworked skills have been implemented (Stories 17.10-17.22 + 17.24),
   **When** the verification checklist is executed against all skill source files,
   **Then** NO skill source file in `skills/` or `lib/bmad-extension/skills/` contains references to:
   - `backlog.yaml` as a read/write target
   - `sprints/sprint-N.yaml` or `sprint-plan-*.yaml` as a read/write target
   - The flat `development_status` map format
   - Direct file creation of `sprint-plan-*.yaml`
   **And** all skills exclusively read/write the unified `sprint-status.yaml` with three-section schema.

8. **Given** the migration procedure is documented,
   **When** a project maintainer reads the migration guide,
   **Then** the guide includes: pre-migration checklist, step-by-step instructions, rollback procedure (restore from `sprint-status.yaml.old`), and post-migration verification steps.

## Tasks / Subtasks

### Task 1: Audit all 13 reworked skill source files for old-format references (AC: 7)

This is the VERIFICATION task. It confirms that all preceding stories (17.10-17.22, 17.24) have successfully eliminated old-format references. If any old references remain, they must be fixed before the migration story can be marked done.

- [ ] 1.1 Scan all BMAD extension skill source files (`lib/bmad-extension/skills/*/SKILL.md`, `lib/bmad-extension/skills/*/workflow.md`) for references to `backlog.yaml`, `sprint-plan-*.yaml`, `sprints/sprint-`, and `development_status`. List all findings.
- [ ] 1.2 Scan all IDE skill source files (`skills/*/SKILL.md`) for the same patterns. List all findings.
- [ ] 1.3 For each finding, determine if it is:
  - (a) A stale reference from a pre-rework version that needs to be fixed NOW as part of this story
  - (b) A legitimate reference (e.g., migration documentation, comments explaining what was replaced)
- [ ] 1.4 Fix all stale references found in 1.3(a). For each fix, update the skill source to use the unified `sprint-status.yaml` three-section schema.
- [ ] 1.5 Document the audit results: which skills were clean, which needed fixes, and what was changed.

**Known pre-existing old-format references (as of story creation):**
- `skills/story-status-lookup/SKILL.md` -- references `development_status` (rework: Story 17.19)
- `lib/bmad-extension/skills/add-sprint/SKILL.md` -- references `sprint-plan-*.yaml` output (rework: Story 17.16)
- `lib/bmad-extension/skills/add-to-sprint/SKILL.md` -- references `development_status` and `sprint-plan-*.yaml` (rework: Story 17.11)
- `lib/bmad-extension/skills/sprint-status-view/SKILL.md` -- references `sprint-plan-*.yaml` and `development_status` (rework: Story 17.13)
- `lib/bmad-extension/skills/modify-sprint/SKILL.md` -- references `sprint-plan-*.yaml` (rework: Story 17.17)

These should all be resolved by their respective rework stories BEFORE this story begins. Task 1 verifies that they were actually resolved.

### Task 2: Implement the migration helper script (AC: 1, 2, 3, 4, 5, 6)

Create `scripts/migrate-sprint-status.js` -- a one-time Node.js script that automates the data migration. This is NOT a deployed skill; it runs via `node scripts/migrate-sprint-status.js` from the project root.

- [ ] 2.1 Implement old-schema detection:
  - Read `sprint-status.yaml` and check for `development_status` top-level key (old schema) vs `epics`/`backlog`/`sprints` keys (new schema)
  - Check for existence of `backlog.yaml` in the implementation artifacts directory
  - Check for existence of `sprints/` directory with `sprint-*.yaml` files
  - Check for existence of `sprint-plan-*.yaml` files in the implementation artifacts directory
  - If new schema already detected AND no legacy files exist, print "No migration needed" and exit

- [ ] 2.2 Implement backup step:
  - If old-schema `sprint-status.yaml` exists, copy it to `sprint-status.yaml.old`
  - Log the backup creation with timestamp

- [ ] 2.3 Implement epic extraction from old `development_status`:
  - Keys matching `epic-N` pattern -> extract to `epics` map with `status` field
  - Keys matching `epic-N-retrospective` pattern -> fold into corresponding epic's `retrospective` field
  - Keys matching neither pattern -> these are story/bug statuses (handled in 2.5)

- [ ] 2.4 Implement backlog import from `backlog.yaml` (if file exists):
  - Parse the old `backlog.yaml` format
  - Map each item to the unified item schema: `id`, `type` (story/bug), `epic` (integer or null), `title`, `priority`, `status`, `severity`
  - Preserve priority ordering from the old file

- [ ] 2.5 Implement sprint import from old sprint files (if they exist):
  - Glob for `sprints/sprint-*.yaml` and `sprint-plan-*.yaml`
  - For each sprint file, extract: sprint number/ID, name, status, capacity, start/end dates, assigned items
  - Map each sprint to the unified sprint schema in the `sprints` map
  - Items referenced in sprint files are placed in the sprint's `items` array (with `priority` field dropped per schema)
  - Items from `backlog.yaml` that are also in a sprint are placed in the sprint, NOT in backlog (single-location invariant)

- [ ] 2.6 Implement status application from old `development_status`:
  - For each story/bug key in the old `development_status` map, find the corresponding item (in backlog or any sprint)
  - Apply the status from `development_status` (this is the authoritative status source)
  - If the item was not found in backlog or any sprint import, log a warning (orphaned status entry)

- [ ] 2.7 Implement conflict detection and resolution:
  - If an item appears in multiple old files with different statuses, log the conflict
  - Resolution rule: `development_status` value wins (it is the live status tracker)
  - Generate a conflict report section in the migration output

- [ ] 2.8 Implement metadata assembly:
  - Preserve `generated` from old file (or set to now if missing)
  - Set `last_updated` to current ISO-8601 timestamp
  - Preserve `project`, `project_key`, `tracking_system`, `story_location` from old file
  - Default `tracking_system` to `file-system` if missing

- [ ] 2.9 Write the unified `sprint-status.yaml`:
  - Assemble complete file with metadata + `epics` + `backlog` + `sprints` sections
  - Validate output against Story 17.9 schema rules:
    - Every item has required fields (`id`, `type`, `epic`, `title`, `status`, `severity`)
    - Backlog items have `priority`; sprint items do not
    - No item appears in more than one location
    - `epics` is a map, `backlog` is an array, `sprints` is a map
  - Write atomically (write to temp file, then rename)

- [ ] 2.10 Implement file relocation:
  - Create `deprecated/` subfolder under implementation artifacts (if it does not exist)
  - Move `backlog.yaml` -> `deprecated/backlog.yaml`
  - Move `sprints/` directory -> `deprecated/sprints/`
  - Move `sprint-plan-*.yaml` files -> `deprecated/sprint-plan-*.yaml`
  - Log each file moved

- [ ] 2.11 Implement idempotency:
  - If the new schema is already present AND no legacy files exist, exit cleanly
  - If legacy files exist but the new schema is already present, only relocate the legacy files (do not re-migrate)

- [ ] 2.12 Generate migration report:
  - List all items migrated with their source file and destination section
  - List all epics extracted with their statuses
  - List all sprints imported with their item counts
  - List all conflicts detected and their resolutions
  - List all files relocated
  - Output to console AND write to `deprecated/migration-report.md`

### Task 3: Write the migration guide (AC: 8)

Create `scripts/MIGRATION-GUIDE.md` -- a step-by-step document for running the migration.

- [ ] 3.1 Write pre-migration checklist:
  - Ensure all 13 reworked skills have been deployed (Stories 17.10-17.22, 17.24 all in `done` status)
  - Commit or stash any uncommitted changes to sprint management files
  - Verify Node.js is available (`node --version`)

- [ ] 3.2 Write migration steps:
  - Step 1: Run `node scripts/migrate-sprint-status.js` from the project root
  - Step 2: Review the migration report output
  - Step 3: Run `bmad-sprint-planning` (Story 17.15) to validate the new file parses correctly
  - Step 4: Run `sprint-status-view` (Story 17.13) to visually verify the migrated data
  - Step 5: Commit the new `sprint-status.yaml` and the `deprecated/` folder

- [ ] 3.3 Write rollback procedure:
  - Copy `sprint-status.yaml.old` back to `sprint-status.yaml`
  - Move files from `deprecated/` back to their original locations
  - The original data is never destroyed

- [ ] 3.4 Write post-migration verification:
  - Confirm `sprint-status.yaml` has `epics`, `backlog`, `sprints` top-level keys
  - Confirm no `development_status` key exists
  - Confirm `backlog.yaml` no longer exists in the active directory
  - Confirm `sprints/` directory no longer exists in the active directory
  - Confirm `sprint-plan-*.yaml` files no longer exist in the active directory
  - Run each sprint management skill once to verify it operates on the new format

- [ ] 3.5 Write cleanup instructions:
  - After successful verification over 1 sprint cycle, the `deprecated/` folder and `sprint-status.yaml.old` can be safely deleted
  - Optionally add `deprecated/` to `.gitignore`

### Task 4: Handle the ma-agents project's own sprint-status.yaml (AC: 1, 6)

The ma-agents project itself currently uses the old flat `development_status` format. This task migrates the project's own data.

- [ ] 4.1 Assess current state: the ma-agents `sprint-status.yaml` at `_bmad-output/implementation-artifacts/sprint-status.yaml` uses the old `development_status` format. However, `backlog.yaml` and `sprints/` directory no longer exist (confirmed during story creation).
- [ ] 4.2 Run the migration script against the ma-agents project itself.
- [ ] 4.3 Verify the migrated `sprint-status.yaml` contains all epics, stories, and statuses from the old file.
- [ ] 4.4 Since no `backlog.yaml` or `sprints/` exist for this project, the migration for ma-agents only converts the flat `development_status` into the three-section schema. Items not currently tracked in a sprint go to `backlog`; items in flight stay in their current status.

### Task 5: Verify the migration script against the Story 17.9 schema (AC: 1, 2, 3)

- [ ] 5.1 Load the canonical schema specification from `_bmad-output/planning-artifacts/sprint-status-schema.md`.
- [ ] 5.2 Validate the migration output against all 10 schema validation rules from Section 10 of the schema spec.
- [ ] 5.3 Verify the single-location invariant: no item ID appears in both `backlog` and any sprint's `items`.
- [ ] 5.4 Verify that `backlog` items have `priority` and sprint `items` do NOT have `priority`.
- [ ] 5.5 Verify that `epics` entries have `status` and `retrospective` fields.

## Dev Notes

### What This Story IS

This is a **one-time migration and verification** story. It produces:
1. A migration helper script (`scripts/migrate-sprint-status.js`)
2. A migration guide (`scripts/MIGRATION-GUIDE.md`)
3. A verification audit of all 13 reworked skill source files
4. The actual migration of the ma-agents project's own `sprint-status.yaml`

### What This Story Is NOT

This story does NOT:
- Create a persistent IDE skill (no `skills/migrate-sprint-status/` directory)
- Create a BMAD extension skill (no `lib/bmad-extension/skills/migrate-sprint-status/` directory)
- Modify any of the 13 reworked skills (those are done in Stories 17.10-17.22, 17.24)
- Delete old files permanently (they are relocated to `deprecated/`, not destroyed)

### Why NOT a Persistent Skill

**Winston (Architect):** A migration runs once per project. Deploying it as a skill would mean:
- Adding entries to `skills/migrate-sprint-status/skill.json` and the MANIFEST
- Adding entries to `lib/bmad-extension/skills/migrate-sprint-status/` and `module-help.csv`
- Every IDE agent would receive a "migrate old formats" skill that is useless after first run
- The skill would need logic to detect "already migrated" on every invocation, wasting agent context

A one-time script in `scripts/` is the correct architectural choice. It runs once, produces its output, and is forgotten.

### Old Files Being Deprecated

| Old File/Format | What It Contains | Where It Goes |
|----------------|-----------------|---------------|
| `sprint-status.yaml` with `development_status` key | Flat map of epic/story/retro statuses | Overwritten by unified three-section schema (backup at `.old`) |
| `backlog.yaml` | Flat prioritized story/bug list | Relocated to `deprecated/backlog.yaml` |
| `sprints/sprint-N.yaml` | Individual sprint entity files | Relocated to `deprecated/sprints/` |
| `sprint-plan-*.yaml` | Old sprint plan format (per-sprint artifact) | Relocated to `deprecated/sprint-plan-*.yaml` |

### New Unified Format (Target)

The migration output conforms to the Story 17.9 schema:

```yaml
generated: "2026-04-03T12:00:00Z"
last_updated: "2026-04-04T12:00:00Z"
project: agents
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

epics:
  epic-5:
    status: in-progress
    retrospective: optional
  epic-17:
    status: in-progress
    retrospective: optional

backlog:
  - id: "17-13-rework-sprint-status-view"
    type: story
    epic: 17
    title: "Rework sprint-status-view Skill"
    priority: 1
    status: ready-for-dev
    severity: null

sprints:
  sprint-1:
    name: "Sprint 1"
    status: active
    capacity: 8
    start: ""
    end: ""
    items:
      - id: "5-5-explicit-parameter-passing"
        type: story
        epic: 5
        title: "Explicit Parameter Passing"
        status: review
        severity: null
```

### Migration Script Location and Rationale

- **Script:** `scripts/migrate-sprint-status.js`
- **Guide:** `scripts/MIGRATION-GUIDE.md`
- **NOT in:** `skills/`, `lib/bmad-extension/skills/`, `.claude/skills/`, or any agent directory
- **Reason:** One-time utility scripts belong in `scripts/`, not in deployment pipelines

### Conflict Resolution Strategy

When an item appears in multiple old files with different statuses:

| Source 1 | Source 2 | Resolution |
|---------|---------|------------|
| `development_status` map | `backlog.yaml` | `development_status` wins (authoritative for status) |
| `development_status` map | `sprint-plan-*.yaml` | `development_status` wins |
| `backlog.yaml` | `sprint-plan-*.yaml` | Sprint file wins for placement (item goes to sprint); `development_status` wins for status |

**Mary (Analyst) note:** The old `development_status` map was always the authoritative status tracker. `backlog.yaml` and sprint files tracked structure (what's in the backlog, what's in which sprint), while `development_status` tracked lifecycle status. The migration preserves this separation: sprint files determine WHERE an item goes; `development_status` determines its STATUS.

### Idempotency Rules

1. If `sprint-status.yaml` already has `epics`/`backlog`/`sprints` keys AND no legacy files exist -> skip entirely
2. If `sprint-status.yaml` already has the new schema BUT legacy files exist -> relocate legacy files only (no data re-import)
3. If `sprint-status.yaml` has the old `development_status` key -> full migration
4. Running the migration twice produces the same result (after first run, rule #1 applies)

### Current State of the ma-agents Project

As of story creation (2026-04-04):
- `sprint-status.yaml` exists with old `development_status` format (confirmed)
- `backlog.yaml` does NOT exist (already removed in earlier work)
- `sprints/` directory does NOT exist (never created for this project)
- `sprint-plan-*.yaml` files do NOT exist (never created for this project)
- Therefore, migration for ma-agents only requires converting the flat `development_status` map into the three-section schema

### Cross-References

- **Story 17.9** (prerequisite): Defines the unified `sprint-status.yaml` schema -- this story's migration output must conform to it
- **Story 17.15** (prerequisite): `bmad-sprint-planning` rework -- the architecture originally proposed embedding migration in 17.15, but that creates coupling between bootstrap and migration. This story handles migration independently
- **Story 17.10** (prerequisite): `generate-backlog` rework -- must be done before verification (Task 1)
- **Story 17.11** (prerequisite): `add-to-sprint` rework -- must be done before verification (Task 1)
- **Story 17.12** (prerequisite): `remove-from-sprint` rework -- must be done before verification (Task 1)
- **Story 17.13** (prerequisite): `sprint-status-view` rework -- must be done before verification (Task 1)
- **Story 17.14** (prerequisite): `cleanup-done` rework -- must be done before verification (Task 1)
- **Story 17.16** (prerequisite): `add-sprint` rework -- must be done before verification (Task 1)
- **Story 17.17** (prerequisite): `modify-sprint` rework -- must be done before verification (Task 1)
- **Story 17.18** (prerequisite): `bmad-dev-story` rework -- must be done before verification (Task 1)
- **Story 17.19** (prerequisite): `story-status-lookup` rework -- must be done before verification (Task 1)
- **Story 17.20** (prerequisite): `bmad-sprint-status` rework -- must be done before verification (Task 1)
- **Story 17.21** (prerequisite): `close-sprint` (new) -- must be done before verification (Task 1)
- **Story 17.22** (prerequisite): `jira-adapter-pattern` -- must be done before verification (Task 1)
- **Story 17.24** (prerequisite): `prioritize-backlog` rework -- must be done before verification (Task 1)
- **Execution order:** This is the LAST story: 17.9 -> 17.15 -> 17.10 -> 17.16 -> 17.11 -> 17.12 -> 17.13 -> 17.14 -> 17.17 -> 17.18 -> 17.19 -> 17.20 -> 17.24 -> 17.21 -> 17.22 -> **17.23**

### PRD Traceability

- **FR133:** `sprint-status.yaml` includes top-level metadata (`generated`, `last_updated`, `project`, `project_key`, `tracking_system`, `story_location`) -- migration must produce these fields
- **FR134:** Each item carries consistent structure (`id`, `type`, `epic`, `title`, `priority`, `status`, `severity`) -- migration must map old items to this schema
- **FR135:** Each sprint entity carries `name`, `status`, `capacity`, optional `start`/`end` dates, and `items` list -- migration must produce sprint entries in this format
- **FR136:** Items exist in exactly one location (movement semantics, single-location invariant) -- migration must deduplicate items across old files
- **FR138:** `generate-backlog` regenerates the `backlog` section preserving sprint-assigned items -- migration must establish the initial backlog that this skill will subsequently maintain
- **FR139:** `tracking_system` field determines data backend -- migration must preserve or set this field
- **FR140:** Skills must check `tracking_system` and route appropriately -- not directly relevant to migration, but the migrated file must have a valid `tracking_system` value

### Architecture Reference

- Architecture Decision P2-11 in `_bmad-output/planning-artifacts/architecture.md` -- "Migration from 3-file model" section (lines 1050-1057)
- The architecture specifies: "`bmad-sprint-planning` detects the legacy files and offers to migrate" -- this story separates migration into its own procedure rather than embedding it in sprint planning, which is a refinement (not a contradiction) of the architecture. Sprint planning (17.15) handles bootstrap of NEW projects; this story handles migration of OLD projects.
- Schema specification: `_bmad-output/planning-artifacts/sprint-status-schema.md` (canonical schema for output validation)

### Gotchas

1. **The old `development_status` map uses a flat namespace.** Keys like `epic-1`, `1-1-ci-cd-yes-flag`, `epic-1-retrospective`, `5-5-explicit-parameter-passing`, and `epic-5` all share the same level. The migration must correctly classify each key as: epic status, retrospective, or story/bug status.
2. **Key classification heuristic:** `epic-N` (where N is a number) -> epic entry. `epic-N-retrospective` -> retrospective field on epic. Everything else -> story/bug status.
3. **On-hold and done epics may exist in the flat map.** The old format doesn't distinguish between active and archived epics. The migration should import ALL epics, including done ones (they can be cleaned up later by `cleanup-done`).
4. **The old `development_status` does not contain item titles or types.** The migration script needs a secondary source (like `epics.md` and story `.md` files) to populate `title`, `type`, `epic`, and `severity` fields. For items where the secondary source is unavailable, use sensible defaults and flag in the report.
5. **Sprint items in the unified schema do NOT have a `priority` field.** When importing items from `backlog.yaml` into a sprint, the `priority` field must be dropped.
6. **The `deprecated/` folder should NOT be deployed anywhere.** It is a local archive for the project maintainer.
7. **The migration script uses Node.js** because the project is a Node.js project (`lib/installer.js`, `lib/bmad.js`, `lib/cli.js` are all Node). No additional runtime dependencies should be introduced.
8. **File paths must be resolved from project root, not hardcoded.** The script should accept the implementation artifacts path as a CLI argument or resolve it from `_bmad/bmm/config.yaml` (if available) or default to `_bmad-output/implementation-artifacts/`.

### Project Structure Notes

- Migration script: `scripts/migrate-sprint-status.js` (NEW -- one-time utility)
- Migration guide: `scripts/MIGRATION-GUIDE.md` (NEW -- step-by-step documentation)
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED -- migrated to unified schema)
- Deprecated folder: `_bmad-output/implementation-artifacts/deprecated/` (NEW -- receives old files)
- Schema spec: `_bmad-output/planning-artifacts/sprint-status-schema.md` (READ -- validation reference)
- Epics source: `_bmad-output/planning-artifacts/epics.md` (READ -- item metadata source)
- Skill source audit targets: `skills/*/SKILL.md`, `lib/bmad-extension/skills/*/SKILL.md`, `lib/bmad-extension/skills/*/workflow.md`
