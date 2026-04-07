# Story 19.2: Graph Emission — `create-prd` (Graph Seed)

Status: ready-for-dev

## Story

As a **Product Manager**,
I want the `create-prd` skill to automatically seed the knowledge graph when a PRD is generated,
so that the PRD becomes the root of the project knowledge graph without any user action.

## Acceptance Criteria

1. **Given** the `create-prd` skill completes generation of `_bmad-output/planning-artifacts/prd.md`
   **When** the artifact write step finishes
   **Then** `emitToGraph()` is called silently as the final step — no user prompt, no output message
   **And** the PRD file is registered in the `files` table as `{ pointer: "_bmad-output/planning-artifacts/prd.md", title: "Product Requirements Document", pointer_type: "relative_path" }` with file-id `prd`

2. **Given** the PRD contains top-level `##` headings (e.g., `## Executive Summary`, `## Functional Requirements`)
   **When** emission runs
   **Then** one node is emitted per `##` heading: `{ id: "prd#<anchor>", file: "prd", anchor: "<anchor>", title: "<heading text>", type: "prd" }`

3. **Given** the graph is seeded from a new PRD
   **When** the `knowledge-graph.json` file is inspected
   **Then** it contains no edges (PRD is the root — it does not reference other documents yet)
   **And** `meta.node_count` equals the number of `##` headings in the PRD

4. **Given** `create-prd` runs on a project where `knowledge-graph.json` already exists
   **When** emission runs
   **Then** only new headings (not yet present as nodes) are added — re-runs are idempotent

## Tasks / Subtasks

### Task 1: Add emission call to `create-prd` workflow (AC: 1, 2, 3, 4)

**IMPORTANT:** The `create-prd` skill exists in TWO locations — IDE skill and BMAD extension skill (see Dev Notes). Both must be updated.

- [ ] 1.1 Locate the IDE skill source: `skills/bmad-create-prd/SKILL.md`
- [ ] 1.2 Locate the BMAD extension skill source: `lib/bmad-extension/skills/bmad-create-prd/SKILL.md`
- [ ] 1.3 In both SKILL.md files, add a final step after the artifact write:
  - **Step: Silent graph emission** (no user output)
  - Scan the generated PRD markdown for `## ` lines (level-2 headings only)
  - For each heading, derive anchor using `headingToAnchor()` from `lib/knowledge-graph/emit.js`
  - Build emission payload:
    ```javascript
    const emission = {
      files: {
        prd: {
          pointer: "_bmad-output/planning-artifacts/prd.md",
          title: "Product Requirements Document",
          pointer_type: "relative_path"
        }
      },
      nodes: headings.map(h => ({
        id: `prd#${headingToAnchor(h)}`,
        file: "prd",
        anchor: headingToAnchor(h),
        title: h,
        type: "prd"
      })),
      edges: []  // PRD seeding emits no edges — it is the root
    };
    ```
  - Call `emitToGraph(projectRoot, emission)` silently (no output to user)
- [ ] 1.4 Determine `projectRoot` in each skill context:
  - For BMAD extension skill: derive from `_bmad/bmm/config.yaml` path or `process.cwd()`
  - For IDE skill: use `process.cwd()` (the project root where the skill is invoked)

### Task 2: Verify idempotency (AC: 4)

- [ ] 2.1 After implementing, manually verify that invoking `create-prd` twice on the same project results in the same node count (no duplicates)
- [ ] 2.2 Confirm `meta.node_count` equals the actual number of nodes in the `nodes` array

### Task 3: Verify emission is truly silent (AC: 1)

- [ ] 3.1 Confirm no `console.log`, no output to user, no prompt is added for the emission step
- [ ] 3.2 Confirm error from `emitToGraph()` (e.g., write permission failure) does not propagate to the user as a skill failure — log to stderr at most, do not abort the skill

## Dev Notes

### CRITICAL: Two Deployment Pipelines

The `create-prd` skill (like all BMAD skills in this project) exists in two locations:
1. **IDE skill source:** `skills/bmad-create-prd/SKILL.md` — deployed by `lib/installer.js` to all IDE agent directories
2. **BMAD extension skill source:** `lib/bmad-extension/skills/bmad-create-prd/SKILL.md` — deployed by `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`

**Both files must be updated.** Do NOT edit installed copies at `.claude/skills/bmad-create-prd/` or `_bmad/extensions/ma-agents-skills/skills/bmad-create-prd/`.

### Prerequisite: Story 19.1 Must Be Complete

This story requires `lib/knowledge-graph/emit.js` to exist (created in Story 19.1). Do NOT begin implementation until Story 19.1 is done.

### Heading Extraction — Level-2 Only

Extract only `## ` (two hashes + space) headings from the PRD. Level-3+ headings (`###`, `####`) create noise without adding navigation value. The regex pattern:
```javascript
const headings = content.match(/^## (.+)$/gm)?.map(line => line.replace(/^## /, '')) || [];
```

### PRD is the Only Emission With Zero Edges

This is the only skill in the 7-skill emission chain that emits zero edges. All other skills emit edges pointing back to PRD nodes. The knowledge graph is a directed graph rooted at the PRD.

### Emission Payload Shape

```javascript
{
  files: {
    "prd": { pointer: "_bmad-output/planning-artifacts/prd.md", title: "Product Requirements Document", pointer_type: "relative_path" }
  },
  nodes: [
    { id: "prd#executive-summary", file: "prd", anchor: "executive-summary", title: "Executive Summary", type: "prd" },
    { id: "prd#functional-requirements", file: "prd", anchor: "functional-requirements", title: "Functional Requirements", type: "prd" }
    // ... one per ## heading
  ],
  edges: []
}
```

### Silent Emission Contract

The emission step MUST be silent:
- No output to user (no `console.log`, no markdown output in SKILL.md steps)
- Emission failures (e.g., disk write error) must NOT abort the skill — the PRD is already written; a graph update failure is non-critical
- Wrap the `emitToGraph()` call in try/catch; log to stderr on failure, do not re-throw

### Idempotency

The `emitToGraph()` function from Story 19.1 already handles idempotency (no duplicate nodes by id). However, the skill must also ensure it does not re-extract headings if the PRD content is the same. Since `emitToGraph` is idempotent, calling it twice with the same payload is always safe.

### File Structure Reference

```
skills/
└── bmad-create-prd/
    └── SKILL.md    ← MODIFY: add emission step at end

lib/
└── bmad-extension/
    └── skills/
        └── bmad-create-prd/
            └── SKILL.md    ← MODIFY: add emission step at end

lib/
└── knowledge-graph/
    └── emit.js    ← IMPORT from here (Story 19.1 output)
```

### Project Structure Notes

- No new files are created by this story — only modifications to existing SKILL.md files.
- The `lib/knowledge-graph/emit.js` module (Story 19.1) must be importable from both SKILL.md contexts.
- For BMAD extension skills (SKILL.md workflow files): the emission call is expressed as a workflow instruction in markdown, not literal JavaScript. The dev agent executes the instruction. The `lib/knowledge-graph/emit.js` code is what actually runs when a JavaScript execution context is available. In pure markdown SKILL.md context (no JS runtime), document the emission payload and call as a clear instruction.

### References

- Story 19.1: `_bmad-output/implementation-artifacts/19-1-knowledge-graph-core-library.md` — `emitToGraph()` implementation
- Architecture Decision P3-1: `_bmad-output/planning-artifacts/architecture.md#decision-p3-1-bmad-knowledge-graph`
- Epics source: `_bmad-output/planning-artifacts/epics.md#story-192-graph-emission--create-prd-graph-seed`
- FRs: FR149 (automatic emission), FR150 (file registration), FR152 (additive-only, no duplicates)

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
