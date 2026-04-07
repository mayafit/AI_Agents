# Story 19.4: Graph Emission — `create-story`, `validate-prd`, `dev-story`, `bmad-sprint-planning`

Status: ready-for-dev

## Story

As a **Developer** and **QA Engineer**,
I want individual story files and validation artifacts to emit traceability edges automatically,
so that the knowledge graph captures the full SDLC chain from PRD through architecture through epics through stories through implementation.

## Acceptance Criteria

1. **Given** the `create-story` skill generates a story file (e.g., `_bmad-output/implementation-artifacts/17-9-unified-sprint-status-schema.md`)
   **When** emission runs
   **Then** the story file is registered in the `files` table with `pointer_type: "relative_path"` and a file-id derived from the story number (e.g., `story-17-9`)
   **And** a node is emitted for the story root heading (type: `story`)
   **And** a `traces-to` edge is emitted from the story node to its parent epic node: `{ from: "story-<epic>-<num>#<story-slug>", to: "epics#epic-<N>-<name>", type: "traces-to", ... }`
   **And** if the story's technical notes reference architecture decisions (e.g., `Decision P3-1`, `arch#`), `informed-by` edges are emitted from the story node to the relevant architecture nodes

2. **Given** the `validate-prd` skill completes a validation report
   **When** emission runs
   **Then** the validation report file is registered with file-id `validation-<date>` (e.g., `validation-2026-04-07`)
   **And** a `validates` edge is emitted from the validation report node to `prd#functional-requirements`: `{ type: "validates", label: "PRD validation report <date>", created_by: <user>, agent: "bmad-validate-prd", created_at: <timestamp> }`

3. **Given** `dev-story` completes implementation guidance for a story
   **When** emission runs
   **Then** a `refines` edge is emitted from the story node to `arch#implementation-notes` (or the most relevant architecture section found by scanning the dev-story output)
   **And** if no architecture section is identifiable, the edge target defaults to the story's own epic node

4. **Given** `bmad-sprint-planning` completes sprint plan generation
   **When** emission runs
   **Then** sprint plan nodes are emitted with `type: "sprint"`
   **And** `derives-from` edges connect sprint nodes to the relevant epic nodes referenced in the sprint plan

5. **Given** any of the 4 skills runs a second time on the same project
   **When** emission runs
   **Then** all emissions are idempotent — no duplicate nodes or edges added

## Tasks / Subtasks

### Task 1: Add emission to `create-story` (AC: 1, 5)

Both IDE skill and BMAD extension skill must be updated.

- [ ] 1.1 Locate: `skills/bmad-create-story/SKILL.md` and `lib/bmad-extension/skills/bmad-create-story/SKILL.md`
- [ ] 1.2 Add final silent step after story file write:
  - Derive `storyFileId` from the story key: `story-<epic_num>-<story_num>` (e.g., `story-19-1`)
  - Register story file in `files`: `{ pointer: "_bmad-output/implementation-artifacts/<filename>.md", title: "<story title>", pointer_type: "relative_path" }`
  - Emit story root node: `{ id: "<storyFileId>#<story-heading-anchor>", file: "<storyFileId>", anchor: "<story-heading-anchor>", title: "<story title>", type: "story" }`
  - Emit `traces-to` edge to parent epic node: `{ from: "<storyFileId>#<story-heading-anchor>", to: "epics#<epic-slug>", type: "traces-to", label: "implements epic", ... }`
  - Scan story's Dev Notes section for `Decision P\d+-\d+` or `arch#` patterns; emit `informed-by` edges to matched architecture nodes
- [ ] 1.3 Epic node slug derivation: scan `epics.md` for `## Epic <N>:` heading and apply `headingToAnchor()` to get the target anchor. Or construct `"epic-<N>-<name>"` from the epic title in the story key.

### Task 2: Add emission to `validate-prd` (AC: 2, 5)

- [ ] 2.1 Locate: `skills/bmad-validate-prd/SKILL.md` and `lib/bmad-extension/skills/bmad-validate-prd/SKILL.md`
- [ ] 2.2 Add final silent step after validation report write:
  - Derive date string from current date (ISO format, date portion only): e.g., `2026-04-07`
  - File-id: `validation-<date>`
  - Infer the validation report path from the skill's output path (typically `_bmad-output/planning-artifacts/validation-report-prd-<date>.md`)
  - Emit `validates` edge: `{ from: "validation-<date>#validation-summary", to: "prd#functional-requirements", type: "validates", label: "PRD validation report <date>", created_by: <user>, agent: "bmad-validate-prd", created_at: <timestamp> }`

### Task 3: Add emission to `dev-story` (AC: 3, 5)

- [ ] 3.1 Locate: `skills/bmad-dev-story/SKILL.md` and `lib/bmad-extension/skills/bmad-dev-story/SKILL.md`
- [ ] 3.2 Add final silent step after dev notes written:
  - Identify the story being worked on (story key from context)
  - The story node should already exist in the graph from `create-story` (Story 19.1 step). Re-emit is safe (idempotent).
  - Scan the dev-story output for architecture section references; prefer the most specific match
  - Emit `refines` edge: `{ from: "<storyFileId>#<story-heading-anchor>", to: "arch#<best-arch-section>", type: "refines", label: "dev implementation of story", created_by: <user>, agent: "bmad-dev-story", created_at: <timestamp> }`
  - If no architecture section identifiable, use the epic node as fallback target

### Task 4: Add emission to `bmad-sprint-planning` (AC: 4, 5)

- [ ] 4.1 Locate: `skills/bmad-sprint-planning/SKILL.md` and `lib/bmad-extension/skills/bmad-sprint-planning/SKILL.md`
- [ ] 4.2 Add final silent step after sprint plan output:
  - Sprint plan file-id: `sprint-plan-<sprint-number>` (e.g., `sprint-plan-1`)
  - Emit sprint plan node: `{ id: "sprint-plan-<N>#sprint-plan", file: "sprint-plan-<N>", anchor: "sprint-plan", title: "Sprint <N> Plan", type: "sprint" }`
  - For each epic referenced in the sprint plan, emit `derives-from` edge: `{ from: "sprint-plan-<N>#sprint-plan", to: "epics#<epic-slug>", type: "derives-from", label: "sprint covers epic", ... }`

### Task 5: Verify all 4 skills emit correctly (AC: 1–5)

- [ ] 5.1 Trace through a full emission sequence: create-prd → create-architecture → create-epics-and-stories → create-story → validate-prd → dev-story → bmad-sprint-planning
- [ ] 5.2 Verify the resulting `knowledge-graph.json` has no duplicate nodes or edges
- [ ] 5.3 Verify `meta` counts match actual array/object sizes

## Dev Notes

### CRITICAL: Two Deployment Pipelines (Same Pattern as 19.2, 19.3)

For each of the 4 skills, update BOTH:
1. `skills/<skill-name>/SKILL.md` — IDE source
2. `lib/bmad-extension/skills/<skill-name>/SKILL.md` — BMAD extension source

Do NOT edit installed copies at `.claude/skills/` or `_bmad/extensions/ma-agents-skills/skills/`.

### Prerequisite: Story 19.1 Must Be Complete

Stories 19.2, 19.3, and 19.4 can proceed in parallel once 19.1 is done. This story does NOT depend on 19.2 or 19.3 completing first — they all independently wire in to the same `emitToGraph()` utility.

### The 7 Emitting Skills — Full Inventory

| Skill | Story | Edge Types Emitted |
|-------|-------|--------------------|
| `bmad-create-prd` | 19.2 | (none — seeds nodes only) |
| `bmad-create-architecture` | 19.3 | `implements` |
| `bmad-create-epics-and-stories` | 19.3 | `derives-from`, `informed-by` |
| `bmad-create-story` | **19.4** | `traces-to`, `informed-by` |
| `bmad-validate-prd` | **19.4** | `validates` |
| `bmad-dev-story` | **19.4** | `refines` |
| `bmad-sprint-planning` | **19.4** | `derives-from` |

### Story File-ID Convention

File-id format: `story-<epic_num>-<story_num>`
- Story key `19-1-knowledge-graph-core-library` → file-id `story-19-1`
- Story key `17-9-unified-sprint-status-schema` → file-id `story-17-9`

This is derived directly from the story file path: `_bmad-output/implementation-artifacts/<epic_num>-<story_num>-*.md`

### Story Heading Anchor

The story root heading is `# Story <epic>.<story_num>: <title>`. Apply `headingToAnchor()`:
- `"Story 19.1: Knowledge Graph Core Library (emitToGraph)"` → `"story-191-knowledge-graph-core-library-emittograph"`

Use the file-id as the node's `file` field, not `story`.

### Epic Slug Lookup

To construct the `traces-to` edge target `"epics#<epic-slug>"`, apply `headingToAnchor()` to the epic heading from `epics.md` (e.g., `"Epic 19: BMAD Knowledge Graph (Phase 3)"` → `"epic-19-bmad-knowledge-graph-phase-3"`).

The story's epic number is known from its story key (first number). Scan `epics.md` for `## Epic <N>:` to find the exact heading text and derive the anchor.

### Validation Report File Path

The `validate-prd` skill outputs files like `_bmad-output/planning-artifacts/validation-report-prd-<date>.md`. The file-id `validation-<date>` is derived from the output path. Anchor for the validation node: `headingToAnchor("Validation Summary")` → `"validation-summary"` (or the actual first `##` heading in the report).

### `refines` Edge for dev-story

The `refines` edge captures that a dev-story execution added implementation guidance to the story's context. The source is the story node (already exists from `create-story` emission). The target is the most relevant architecture section. If none found, use the epic node as fallback.

### Sprint Plan Node Registration

`bmad-sprint-planning` does not write a persistent sprint plan file in the current architecture (it writes to `sprint-status.yaml`). For graph emission, use `sprint-status.yaml` as the sprint plan file:
- File-id: `sprint-status`
- Pointer: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Emit one `sprint` node per sprint entry found in `sprint-status.yaml`
- Emit `derives-from` edges for epics covered by active/current sprint

### Error Handling

Same as Stories 19.2/19.3: wrap all `emitToGraph()` calls in try/catch. Emission failures are non-critical — log to stderr, do not abort the skill or show error to user.

### File Structure Reference

```
skills/
├── bmad-create-story/SKILL.md          ← MODIFY
├── bmad-validate-prd/SKILL.md          ← MODIFY
├── bmad-dev-story/SKILL.md             ← MODIFY
└── bmad-sprint-planning/SKILL.md       ← MODIFY

lib/bmad-extension/skills/
├── bmad-create-story/SKILL.md          ← MODIFY
├── bmad-validate-prd/SKILL.md          ← MODIFY
├── bmad-dev-story/SKILL.md             ← MODIFY
└── bmad-sprint-planning/SKILL.md       ← MODIFY
```

No new files created (8 existing SKILL.md files modified).

### References

- Story 19.1: `_bmad-output/implementation-artifacts/19-1-knowledge-graph-core-library.md`
- Architecture skill emission table: `_bmad-output/planning-artifacts/architecture.md#skills-that-emit-and-what-they-emit`
- Architecture Decision P3-1: `_bmad-output/planning-artifacts/architecture.md#decision-p3-1-bmad-knowledge-graph`
- Epic 19 cross-epic notes: `_bmad-output/planning-artifacts/epics.md#epic-19--cross-epic-notes`
- FRs: FR149, FR150, FR151, FR152

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
