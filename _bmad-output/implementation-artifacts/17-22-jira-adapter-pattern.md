# Story 17.22: Jira Adapter Pattern (tracking_system Switch)

Status: ready-for-dev

## Story

As a **Project Manager**,
I want sprint management skills to read/write from Jira when `tracking_system` is configured as `jira`,
So that teams using Jira for project tracking can use the same BMAD sprint skills with their Jira instance.

## Acceptance Criteria

1. **Given** `project-context.md` (or root directives) contains `tracking_system: file-system` (default),
   **When** any sprint management skill is invoked,
   **Then** it reads/writes `sprint-status.yaml` on the local file system (current behavior).

2. **Given** `project-context.md` contains `tracking_system: jira` with Jira connection config,
   **When** any sprint management skill is invoked,
   **Then** it reads/writes from the Jira API using the same data model (epics, backlog items, sprint items),
   **And** the Jira adapter maps: Jira Sprint -> `sprints[]` entries, Jira Backlog -> `backlog[]` entries, Jira Epic -> `epics[]` entries,
   **And** Jira status fields are mapped to the same status vocabulary: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`.

3. **Given** the Jira adapter is active,
   **When** an item is moved from backlog to sprint (Story 17.11 logic),
   **Then** the adapter calls the Jira REST API to move the issue to the target sprint,
   **And** the local `sprint-status.yaml` is NOT written (Jira is the source of truth).

4. **Given** the Jira connection fails (network error, auth failure, rate limit),
   **When** the skill detects the failure,
   **Then** it reports the error clearly and suggests checking credentials/connectivity,
   **And** does NOT fall back to file-system silently (explicit fail, no silent data divergence).

5. **Given** the adapter pattern is implemented,
   **When** a new backend is added in the future (e.g., Linear, Azure DevOps),
   **Then** only a new adapter module is needed — no changes to skill logic.

## Tasks / Subtasks

- [ ] Task 1: Design the backend adapter interface (AC: 1, 2, 5)
  - [ ] 1.1 Define the `resolveBackend(config)` function signature — reads `tracking_system` from config, returns appropriate backend object
  - [ ] 1.2 Define the backend interface methods: `readSprintStatus()`, `writeSprintStatus(data)`, `moveItem(itemId, fromSection, toSection)`, `updateItemStatus(itemId, newStatus)`, `archiveItem(itemId)`
  - [ ] 1.3 Document the interface contract — input/output types must match the unified schema from Story 17.9
  - [ ] 1.4 Ensure the interface is extensible for future backends (Linear, Azure DevOps) without changing skill logic
- [ ] Task 2: Implement the FilesystemBackend (AC: 1)
  - [ ] 2.1 Create the `FilesystemBackend` object implementing all interface methods
  - [ ] 2.2 `readSprintStatus()` reads and parses `sprint-status.yaml`
  - [ ] 2.3 `writeSprintStatus(data)` serializes and writes `sprint-status.yaml`
  - [ ] 2.4 `moveItem()` performs the read-modify-write with movement semantics
  - [ ] 2.5 `updateItemStatus()` performs the cross-section search and in-place update
  - [ ] 2.6 `archiveItem()` removes from YAML and moves file to `done/`
- [ ] Task 3: Implement the JiraBackend (AC: 2, 3)
  - [ ] 3.1 Create the `JiraBackend` object implementing all interface methods
  - [ ] 3.2 `readSprintStatus()` calls Jira REST API (boards, sprints, issues) and maps to unified schema
  - [ ] 3.3 `writeSprintStatus(data)` — NOT supported for Jira (Jira is mutated via individual operations)
  - [ ] 3.4 `moveItem()` calls Jira API to move issue between sprints/backlog
  - [ ] 3.5 `updateItemStatus()` calls Jira API to transition issue status
  - [ ] 3.6 `archiveItem()` transitions issue to "Done" in Jira
  - [ ] 3.7 Map Jira status fields to the canonical vocabulary: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`
- [ ] Task 4: Implement error handling for Jira failures (AC: 4)
  - [ ] 4.1 Wrap all Jira API calls in error handling
  - [ ] 4.2 On network error: report "Jira connection failed: {error}. Check network connectivity."
  - [ ] 4.3 On auth failure (401/403): report "Jira authentication failed. Check JIRA_API_TOKEN and JIRA_USER_EMAIL."
  - [ ] 4.4 On rate limit (429): report "Jira rate limit hit. Retry after {retry-after} seconds."
  - [ ] 4.5 NEVER fall back to file-system silently — explicit fail with clear error message
- [ ] Task 5: Integrate backend resolution into sprint skills (AC: 1, 2)
  - [ ] 5.1 Identify all 13 sprint-related skills that need the backend switch
  - [ ] 5.2 Add `resolveBackend()` call at the start of each skill's I/O path
  - [ ] 5.3 Replace direct file reads/writes with backend method calls
  - [ ] 5.4 Verify that skill business logic does NOT branch on backend type — only the I/O layer differs
- [ ] Task 6: Configure Jira credentials (AC: 2)
  - [ ] 6.1 Document environment variables: `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_USER_EMAIL`
  - [ ] 6.2 Document the `tracking_system: jira` config in `project-context.md`
  - [ ] 6.3 Validate credentials at backend resolution time (fail fast if missing)

## Dev Notes

### What This Story Creates

This story implements the **adapter pattern** that decouples sprint skill business logic from the storage backend. Currently, all skills directly read/write `sprint-status.yaml`. After this story, skills call through a backend interface that routes to either `FilesystemBackend` or `JiraBackend` based on the `tracking_system` config.

This is primarily an **architectural pattern** story. The Jira backend is functional but depends on Epic 14 Story 14.3 (External Tooling Abstraction Layer) for the full architecture contract. The file-system backend is the immediate deliverable; the Jira backend is the extension.

### Skill Files to Modify

All 13 sprint-related skills need the backend integration, but the pattern is defined once and referenced by each skill:
- The adapter module itself (new file — could be a shared utility or a skill-level include)
- `.claude/skills/story-status-lookup/SKILL.md` — already has a Jira extension point placeholder
- All other sprint skills get the `resolveBackend()` integration

### Unified Schema Sections Touched

- **All sections** — the adapter wraps all read/write operations
- The adapter's data contract IS the unified schema from Story 17.9

### Cross-References

- **Story 17.9** (schema) — the adapter's data contract
- **Epic 14 Story 14.3** (External Tooling Abstraction Layer) — blocked dependency; the adapter interface contract must align with the broader abstraction layer design
- **Story 17.19** (story-status-lookup) — already has a Jira backend extension point that this story activates
- **All stories 17.10-17.21, 17.24** — all skills become consumers of the adapter interface

### Gotchas

- The Jira backend `writeSprintStatus()` is not a direct write — Jira is mutated via individual API calls (move issue, transition status), not bulk file writes
- The status vocabulary mapping (Jira -> canonical) will vary by project — the mapping should be configurable, not hardcoded
- Jira API pagination: boards with many sprints or issues may require pagination handling
- The `sprint-status.yaml` is NOT written when Jira is active — Jira IS the source of truth
- Skills should not import Jira-specific concepts — the adapter abstracts all Jira details behind the unified interface
- Rate limiting and retry logic should be in the adapter, not in individual skills

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md` — Jira Adapter Pattern section
- PRD: FR138 (same data model, different storage backend)
- Epic 14 Story 14.3 (External Tooling Abstraction Layer) — upstream dependency

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9
- Jira credentials via environment variables: `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_USER_EMAIL`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
