# Story 17.19: Rework story-status-lookup Skill (Light Rework — Cross-Section Search)

Status: ready-for-dev

## Story

As a **Developer**,
I want the `story-status-lookup` skill to search the unified `sprint-status.yaml` for any story's current status,
So that code can be classified as delivered or work-in-progress from a single data source.

## Acceptance Criteria

1. **Given** the `story-status-lookup` skill is invoked with a story ID,
   **When** the story exists in the `backlog` section of `sprint-status.yaml`,
   **Then** it returns the item's status and notes it is "in backlog (unassigned)".

2. **Given** the story exists in a sprint's `items` array,
   **When** the lookup completes,
   **Then** it returns the item's status and notes which sprint it is assigned to (e.g., "in sprint-3").

3. **Given** the story is not found in `sprint-status.yaml`,
   **When** the lookup checks the `done/` archive folder,
   **Then** it reports: "Story {id} is archived (done)" if the file exists in `done/`,
   **Or** reports: "Story {id} not found in sprint-status.yaml or done/ archive".

## Tasks / Subtasks

- [ ] Task 1: Read and understand current story-status-lookup skill (AC: 1-3)
  - [ ] 1.1 Read `.claude/skills/story-status-lookup/SKILL.md` — understand the current lookup flow (slug derivation, flat map lookup, status classification)
  - [ ] 1.2 Document the current file-system backend logic (reads `development_status` flat map)
  - [ ] 1.3 Document the delivered/WIP classification table (done, review = delivered; in-progress, ready-for-dev, backlog, on-hold = WIP)
- [ ] Task 2: Rewrite Step 2 (slug lookup) for unified schema (AC: 1, 2)
  - [ ] 2.1 Replace the flat `development_status` key lookup with a cross-section search
  - [ ] 2.2 Search the `backlog` array: iterate items, match `item.id` against the derived slug
  - [ ] 2.3 Search all sprint `items` arrays: iterate `sprints` map, then each sprint's `items` array, match `item.id`
  - [ ] 2.4 When found in backlog, return status + context "in backlog (unassigned)"
  - [ ] 2.5 When found in a sprint, return status + context "in {sprint-id}" (e.g., "in sprint-3")
- [ ] Task 3: Implement done/ archive fallback (AC: 3)
  - [ ] 3.1 If slug not found in any section, check `{implementation_artifacts}/done/{slug}.md` file existence
  - [ ] 3.2 If file exists in done/, return "archived (done)" — classify as delivered
  - [ ] 3.3 If not found anywhere, return the "not found" message — classify as WIP per existing fallback rule
- [ ] Task 4: Preserve existing slug derivation and classification logic (AC: 1-3)
  - [ ] 4.1 Keep Step 1 (slug derivation from filename, branch, or explicit reference) unchanged
  - [ ] 4.2 Keep Step 3 (status-to-delivered/WIP classification table) unchanged
  - [ ] 4.3 Keep the fallback rule: "When in doubt, WIP"
- [ ] Task 5: Preserve Jira backend extension point (AC: 1-3)
  - [ ] 5.1 Keep the "Future: Jira Backend" section intact
  - [ ] 5.2 Note that Story 17.22 will activate this extension point
- [ ] Task 6: Update documentation in the skill (AC: 1-3)
  - [ ] 6.1 Update the "File-System Backend" section to describe the new cross-section search
  - [ ] 6.2 Remove references to `development_status` flat map
  - [ ] 6.3 Add documentation for the location context returned (backlog vs sprint assignment)

## Dev Notes

### What This Story Changes vs Current Behavior

The current `story-status-lookup` skill reads the flat `development_status` map:
```yaml
development_status:
  5-5-explicit-parameter-passing: review
```
It finds the key matching the story slug and reads the status value.

After this rework:
- The skill searches the `backlog` array and all `sprints[].items` arrays
- It returns not just the status but also the location context ("in backlog" vs "in sprint-3")
- It checks the `done/` archive folder as a fallback for archived stories
- The delivered/WIP classification table remains identical

This is a **light rework** because:
- Slug derivation logic (Step 1) is unchanged
- Status classification logic (Step 3) is unchanged
- Only the lookup mechanism (Step 2) changes from flat-key to cross-section search
- The Jira extension point is preserved as-is

### Skill Files to Modify

- `.claude/skills/story-status-lookup/SKILL.md` — the single file for this skill; contains all logic inline (no separate workflow.md)

### Unified Schema Sections Touched

- **`backlog`** — searched for story by ID (read-only)
- **`sprints`** — all sprint entries' `items` arrays searched (read-only)
- This skill is **read-only** — it never writes to `sprint-status.yaml`

### Cross-References

- **Story 17.9** (schema) — defines the item schema and section structure this skill searches
- **Story 17.18** (bmad-dev-story) — uses a similar cross-section search; patterns should be consistent
- **Story 17.22** (Jira adapter) — will activate the Jira backend extension point in this skill
- This skill has `always_load: true` in MANIFEST.yaml — it is loaded every session

### Gotchas from Current Implementation

- The current skill explicitly mentions `development_status` in Step 2 — this must be fully replaced
- The current fallback rule (slug not found = WIP) should remain, but now with the additional done/ archive check before falling back
- The skill is consumed by `auto-bug-detection` (Epic 11) — the delivered/WIP classification must remain compatible
- The backend configuration check (file-system vs jira) in the "Backend Configuration" section should remain unchanged

### Architecture Reference
- Architecture P2-11 in `_bmad-output/planning-artifacts/architecture.md`
- PRD: FR135 (in-place status update — this skill reads the result of status updates)

### Project Structure Notes
- Skill files are in `.claude/skills/{skill-name}/`
- Sprint status at `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema defined by Story 17.9

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
