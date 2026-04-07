# Story 19.3: Graph Emission — `create-architecture` and `create-epics-and-stories`

Status: ready-for-dev

## Story

As a **Chief Architect** and **Product Manager**,
I want the `create-architecture` and `create-epics-and-stories` skills to emit traceability edges to the knowledge graph automatically,
so that every architectural decision and every epic traces back to the PRD sections that motivated it.

## Acceptance Criteria

1. **Given** the `create-architecture` skill completes generation of `_bmad-output/planning-artifacts/architecture.md`
   **When** emission runs
   **Then** the architecture file is registered as file-id `arch` with `pointer_type: "relative_path"`
   **And** one node is emitted per `##` heading in architecture.md (type: `architecture`)
   **And** for each architecture decision section (headings matching `## Decision` or `## P[0-9]` patterns), an `implements` edge is emitted: `{ from: "arch#<decision-slug>", to: "prd#relevant-fr-section", type: "implements", label: "implements PRD requirement", created_by: <user>, agent: <agent-id>, created_at: <timestamp> }`

2. **Given** the `create-architecture` skill is run when PRD nodes do not yet exist in the graph
   **When** an edge references a PRD node that is not yet in `nodes`
   **Then** a stub node is emitted for the referenced PRD heading so the edge is not orphaned
   **And** the stub node carries `type: "prd"` and the correct `file` and `anchor` fields

3. **Given** the `create-epics-and-stories` skill completes updating `_bmad-output/planning-artifacts/epics.md`
   **When** emission runs
   **Then** the epics file is registered as file-id `epics` with `pointer_type: "relative_path"`
   **And** one node is emitted per epic heading (type: `epic`) — headings matching `## Epic [0-9]+:` pattern
   **And** for each epic, a `derives-from` edge is emitted to the PRD Functional Requirements node: `{ from: "epics#epic-N-name", to: "prd#functional-requirements", type: "derives-from", ... }`
   **And** where an epic was informed by an architecture decision, an `informed-by` edge is also emitted: `{ from: "epics#epic-N-name", to: "arch#<decision-slug>", type: "informed-by", ... }`

4. **Given** emission runs for `create-architecture` or `create-epics-and-stories`
   **When** the same skill runs a second time (re-run)
   **Then** all emissions are idempotent — no duplicate nodes or edges are added

## Tasks / Subtasks

### Task 1: Add emission to `create-architecture` (AC: 1, 2, 4)

Both the IDE skill and BMAD extension skill must be updated (see Dev Notes on two pipelines).

- [ ] 1.1 Locate: `skills/bmad-create-architecture/SKILL.md` and `lib/bmad-extension/skills/bmad-create-architecture/SKILL.md`
- [ ] 1.2 Add final silent step after artifact write:
  - Scan `architecture.md` for `## ` headings; derive anchors with `headingToAnchor()`
  - Identify decision headings: match `^## Decision` or `^## P\d+-\d+` (e.g., `## P3-1: BMAD Knowledge Graph`)
  - For each decision heading, infer the target PRD FR section. Strategy:
    - If the decision section body contains explicit FR references (e.g., `FR141`), map to `prd#functional-requirements` (the broad FR section as the canonical target)
    - If no explicit FR found, still emit to `prd#functional-requirements` as default
  - Build emission: all architecture nodes + `implements` edges for decision nodes + stub PRD nodes if PRD nodes are absent
- [ ] 1.3 Stub node format (when PRD node does not yet exist):
  ```javascript
  { id: "prd#functional-requirements", file: "prd", anchor: "functional-requirements", title: "Functional Requirements", type: "prd" }
  ```
- [ ] 1.4 Edge format for architecture decisions:
  ```javascript
  {
    from: "arch#<decision-slug>",
    to: "prd#functional-requirements",
    type: "implements",
    label: "implements PRD requirement",
    created_by: "<user from config>",
    agent: "bmad-create-architecture",
    created_at: new Date().toISOString()
  }
  ```

### Task 2: Add emission to `create-epics-and-stories` (AC: 3, 4)

Both the IDE skill and BMAD extension skill must be updated.

- [ ] 2.1 Locate: `skills/bmad-create-epics-and-stories/SKILL.md` and `lib/bmad-extension/skills/bmad-create-epics-and-stories/SKILL.md`
- [ ] 2.2 Add final silent step after artifact write:
  - Scan `epics.md` for epic headings matching `^## Epic [0-9]+:` pattern
  - For each epic heading, derive anchor; emit node with `type: "epic"`
  - Emit `derives-from` edge to `prd#functional-requirements` for each epic
  - For epics that reference architecture decisions (scan epic body for `Decision P\d+-\d+` or `arch#` patterns), emit `informed-by` edges to the relevant `arch#<decision-slug>` node
- [ ] 2.3 Edge formats:
  ```javascript
  // derives-from edge
  { from: "epics#<epic-slug>", to: "prd#functional-requirements", type: "derives-from", label: "derives from PRD requirements", created_by: "<user>", agent: "bmad-create-epics-and-stories", created_at: <timestamp> }
  // informed-by edge (only when architecture decision referenced in epic body)
  { from: "epics#<epic-slug>", to: "arch#<decision-slug>", type: "informed-by", label: "informed by architecture decision", created_by: "<user>", agent: "bmad-create-epics-and-stories", created_at: <timestamp> }
  ```

### Task 3: Verify idempotency and stub node correctness (AC: 2, 4)

- [ ] 3.1 Run emission twice; confirm node/edge counts are identical on both runs
- [ ] 3.2 Verify stub PRD nodes created by this skill are accepted (not duplicated) when Story 19.2 later emits the real PRD nodes (they share the same `id`; `emitToGraph` deduplicates by id with title update allowed)

## Dev Notes

### CRITICAL: Two Deployment Pipelines

Same constraint as Story 19.2. For each skill, update BOTH:
1. `skills/<skill-name>/SKILL.md` — IDE source
2. `lib/bmad-extension/skills/<skill-name>/SKILL.md` — BMAD extension source

Do NOT edit installed copies.

### Prerequisite: Story 19.1 Must Be Complete

Requires `lib/knowledge-graph/emit.js`. Do not begin until Story 19.1 is done. Stories 19.2, 19.3, and 19.4 can proceed in parallel once 19.1 is done.

### Decision Heading Detection

The architecture document uses two patterns for decision headings:
- `## Decision P3-1: BMAD Knowledge Graph` — matches `^## .*P\d+-\d+` or `^## Decision`
- Both patterns should be detected for forward compatibility

Current architecture decisions in the file:
- `P2-1` through `P2-11`, `P3-1` — use pattern `## Decision P[0-9]+-[0-9]+:` or abbreviated `## P[0-9]+-[0-9]+:`

Scan for both `^## Decision` and `^## P\d` to be safe.

### Epic Heading Detection

The epics file uses: `^## Epic [0-9]+:` (e.g., `## Epic 19: BMAD Knowledge Graph (Phase 3)`)

For each matched heading, `headingToAnchor()` produces the node anchor:
- `"Epic 19: BMAD Knowledge Graph (Phase 3)"` → `"epic-19-bmad-knowledge-graph-phase-3"`

### Stub Nodes for Orphan Edge Prevention (AC: 2)

When an `implements` or `informed-by` edge references a node that does not yet exist (e.g., PRD not yet emitted, or architecture not yet emitted), the emitting skill adds a stub node. The `emitToGraph()` function from Story 19.1 handles this naturally — just include the stub in the `nodes` array of the emission payload. If the real node is later emitted by its own skill, the `title` field is updated (Story 19.1 allows title updates on existing nodes).

### `informed-by` Edge — The Non-Hierarchical Edge

`informed-by` is the key non-hierarchical edge type. It records influence without asserting derivation or implementation. An epic can be simultaneously `derives-from` a PRD requirement AND `informed-by` an architecture decision — both edges are valid and coexist.

Detection strategy for `informed-by` edges in epics:
- Scan epic section body (from heading to next `##` heading) for architecture decision references
- Patterns to match: `Decision P\d+-\d+`, `arch#`, or explicit architecture decision names

### User Identity for Provenance

Read `created_by` from BMAD config `_bmad/bmm/config.yaml` field `user_name`, or fall back to `"unknown"`. The `agent` field is a static string identifying the skill: `"bmad-create-architecture"` or `"bmad-create-epics-and-stories"`.

### File Structure Reference

```
skills/
├── bmad-create-architecture/
│   └── SKILL.md    ← MODIFY
└── bmad-create-epics-and-stories/
    └── SKILL.md    ← MODIFY

lib/bmad-extension/skills/
├── bmad-create-architecture/
│   └── SKILL.md    ← MODIFY
└── bmad-create-epics-and-stories/
    └── SKILL.md    ← MODIFY
```

No new files are created by this story.

### Project Structure Notes

- This story touches 4 SKILL.md files (2 skills × 2 pipelines).
- No new skills, no new directories, no module-help.csv changes.
- Emission logic added as a silent final step in each skill's workflow.

### References

- Story 19.1: `_bmad-output/implementation-artifacts/19-1-knowledge-graph-core-library.md`
- Architecture Decision P3-1: `_bmad-output/planning-artifacts/architecture.md#decision-p3-1-bmad-knowledge-graph`
- Skill emission table in architecture: architecture.md section "Skills that emit (and what they emit)"
- FRs: FR149, FR150, FR151, FR152
- Edge type vocabulary: `implements`, `derives-from`, `informed-by`

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
