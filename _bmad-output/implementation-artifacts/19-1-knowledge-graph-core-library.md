# Story 19.1: Knowledge Graph Core Library (`emitToGraph`)

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want a shared `emitToGraph()` utility function in the BMAD extension module,
so that all BMAD skills can emit nodes and edges to the knowledge graph using a single consistent API without duplicating file I/O logic.

## Acceptance Criteria

1. **Given** the function `emitToGraph(projectRoot, emission)` is called with a valid emission payload
   **When** `_bmad-output/knowledge-graph.json` does not yet exist
   **Then** the function creates the file with a valid four-section structure: `meta`, `files`, `nodes`, `edges`
   **And** `meta` contains `schema_version: "1.0"`, `generated_at` (ISO timestamp), `project` (derived from package.json name or directory name), `file_count: 0`, `node_count: 0`, `edge_count: 0`
   **And** `files`, `nodes`, `edges` are initialized as empty object, empty array, empty array respectively

2. **Given** `knowledge-graph.json` already exists with prior content
   **When** `emitToGraph()` is called
   **Then** it reads the existing file, appends new files/nodes/edges, updates counts in `meta`, and writes the result back atomically
   **And** no existing nodes, edges, or file registrations are deleted or overwritten

3. **Given** an emission payload includes a `files` entry with `pointer_type: "relative_path"`
   **When** that file-id does not yet exist in the `files` table
   **Then** the file is registered: `files[file-id] = { pointer, title, pointer_type }`
   **And** if the file-id already exists, registration is skipped (first-write-wins)

4. **Given** an emission payload includes a node with id `file-id#heading-anchor`
   **When** a node with that id already exists in `nodes`
   **Then** the node is not duplicated (title update is allowed; all other fields preserved)

5. **Given** an emission payload includes an edge with `(from, to, type)` triple
   **When** an edge with the same `(from, to, type)` already exists in `edges`
   **Then** the edge is not duplicated (provenance of the first edge is preserved; `created_at`/`agent` fields may be updated)

6. **Given** the function writes the updated graph
   **When** the write operation completes
   **Then** `meta.file_count`, `meta.node_count`, `meta.edge_count` reflect the total counts in the file
   **And** `meta.last_updated` is set to the current ISO-8601 timestamp

## Tasks / Subtasks

### Task 1: Create the `lib/knowledge-graph/` module (AC: 1, 2, 3, 4, 5, 6)

- [ ] 1.1 Create directory `lib/knowledge-graph/`
- [ ] 1.2 Create `lib/knowledge-graph/emit.js` implementing `emitToGraph(projectRoot, emission)`:
  - Initialize graph if `knowledge-graph.json` does not exist: `{ meta: initMeta(projectRoot), files: {}, nodes: [], edges: [] }`
  - Read and parse existing JSON if file exists
  - Apply emission: register files (first-write-wins), add nodes (no duplicate by `id`; title update allowed), add edges (no duplicate by `from+to+type`; created_at/agent update allowed)
  - Update `meta.file_count`, `meta.node_count`, `meta.edge_count`, `meta.last_updated`
  - Write result as `JSON.stringify(graph, null, 2)` to `path.join(projectRoot, '_bmad-output', 'knowledge-graph.json')`
  - Use synchronous I/O: `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`
- [ ] 1.3 Implement `initMeta(projectRoot)` helper:
  - Reads `package.json` name if present at `projectRoot`; falls back to `path.basename(projectRoot)`
  - Returns `{ schema_version: "1.0", project: <name>, generated_at: <ISO>, last_updated: <ISO>, file_count: 0, node_count: 0, edge_count: 0 }`
- [ ] 1.4 Implement and export `headingToAnchor(heading)` utility function (used by all emitting skills):
  ```javascript
  function headingToAnchor(heading) {
    return heading
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  ```
- [ ] 1.5 Export both functions: `module.exports = { emitToGraph, headingToAnchor }`

### Task 2: Verify the emission data contract (AC: 1–6)

- [ ] 2.1 Manually verify (or write a quick smoke test in `tests/knowledge-graph/smoke.test.js`) that:
  - First call creates a valid JSON file with the four sections
  - Second call with the same payload is idempotent (counts unchanged)
  - Second call with new nodes/edges appends correctly
  - Counts in `meta` always match actual array/object sizes

### Task 3: Verify module is importable by other skills (AC: none — integration readiness)

- [ ] 3.1 Confirm the module path `../../lib/knowledge-graph/emit.js` (relative from a skill like `lib/bmad-extension/skills/open-graph/`) resolves correctly
- [ ] 3.2 Confirm no circular dependencies are introduced

## Dev Notes

### CRITICAL: Two Deployment Pipelines — Where This Module Lives

This story creates a **shared utility module** in `lib/knowledge-graph/`, NOT a skill. It is NOT deployed by the installer and NOT a BMAD extension skill. It is a Node.js module imported by other skills at runtime.

**Module location:** `lib/knowledge-graph/emit.js`
**Imported by:** All 7 emitting skills (Stories 19.2–19.4 wire them in)

### Graph File Location

Always: `path.join(projectRoot, '_bmad-output', 'knowledge-graph.json')`

The `projectRoot` parameter is passed by each skill. Skills can derive `projectRoot` from their own `__dirname` by traversing up to the repo root, or from the BMAD config `_bmad/bmm/config.yaml`.

### JSON Schema — Four-Section Structure

```json
{
  "meta": {
    "schema_version": "1.0",
    "project": "<name>",
    "generated_at": "<ISO>",
    "last_updated": "<ISO>",
    "file_count": 4,
    "node_count": 127,
    "edge_count": 89
  },
  "files": {
    "prd": {
      "pointer": "_bmad-output/planning-artifacts/prd.md",
      "title": "Product Requirements Document",
      "pointer_type": "relative_path"
    }
  },
  "nodes": [
    {
      "id": "prd#functional-requirements",
      "file": "prd",
      "anchor": "functional-requirements",
      "title": "Functional Requirements",
      "type": "prd"
    }
  ],
  "edges": [
    {
      "from": "arch#decision-p3-1-bmad-knowledge-graph",
      "to": "prd#functional-requirements",
      "type": "implements",
      "label": "implements knowledge graph data model requirement",
      "created_by": "Alon",
      "agent": "claude-code",
      "created_at": "2026-04-07T10:00:00Z"
    }
  ]
}
```

### Heading Anchor Algorithm

GitHub slug algorithm (same as VSCode internal link resolution):
```javascript
heading.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
```
Example: `"Decision P3-1: BMAD Knowledge Graph"` → `"decision-p3-1-bmad-knowledge-graph"`

### emitToGraph() Pseudocode (Architecture-Authoritative)

```javascript
async function emitToGraph(projectRoot, emission) {
  const graphPath = path.join(projectRoot, '_bmad-output', 'knowledge-graph.json');
  const graph = fs.existsSync(graphPath)
    ? JSON.parse(fs.readFileSync(graphPath, 'utf8'))
    : { meta: initMeta(projectRoot), files: {}, nodes: [], edges: [] };

  // Register files (first-write-wins for pointer_type; pointer/title always update)
  for (const [fileId, fileEntry] of Object.entries(emission.files || {})) {
    if (!graph.files[fileId]) graph.files[fileId] = fileEntry;
    else { graph.files[fileId].pointer = fileEntry.pointer; graph.files[fileId].title = fileEntry.title; }
  }
  // Add nodes (no duplicates by id; title update allowed)
  for (const node of (emission.nodes || [])) {
    const existing = graph.nodes.find(n => n.id === node.id);
    if (!existing) graph.nodes.push(node);
    else existing.title = node.title;
  }
  // Add edges (no duplicates by from+to+type; created_at/agent update allowed)
  for (const edge of (emission.edges || [])) {
    const existing = graph.edges.find(e => e.from === edge.from && e.to === edge.to && e.type === edge.type);
    if (!existing) graph.edges.push(edge);
    else { existing.created_at = edge.created_at; existing.agent = edge.agent; }
  }
  // Update counts
  graph.meta.file_count = Object.keys(graph.files).length;
  graph.meta.node_count = graph.nodes.length;
  graph.meta.edge_count = graph.edges.length;
  graph.meta.last_updated = new Date().toISOString();

  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf8');
}
```

### I/O Choice: Synchronous

Use synchronous `fs` APIs (`readFileSync`, `writeFileSync`, `existsSync`). Graph updates occur as a post-artifact step — not in any hot path. Synchronous I/O is simpler and avoids async coordination between concurrent skill calls (not a concern since skills run sequentially under a single agent session).

### Edge Type Vocabulary

| Type | Usage |
|------|-------|
| `implements` | arch decision → PRD requirement |
| `derives-from` | epic → PRD requirement |
| `traces-to` | story → epic |
| `informed-by` | any cross-document influence (non-hierarchical) |
| `validates` | review/validation report → artifact |
| `refines` | dev-story implementation notes → story spec |

### LLM-Writability Contract (NFR39)

The flat structure is deliberately copy-pattern-friendly. A model with no prior schema knowledge can correctly extend the graph by observing the first entry in `files`, `nodes`, and `edges` and copying the pattern. Do NOT add nesting beyond 2 levels. Do NOT introduce computed or derived fields inside the JSON.

### File Structure Reference

```
lib/
└── knowledge-graph/
    └── emit.js    ← NEW: emitToGraph() + headingToAnchor() exports
```

### Dependencies

No new npm packages required. Uses only Node.js built-ins: `fs`, `path`.

### Project Structure Notes

- `lib/knowledge-graph/` is a new directory under `lib/` alongside `lib/bmad-extension/`, `lib/installer.js`, etc.
- This module is NOT registered in `module-help.csv` — it is a utility, not a skill.
- No `skill.json`, no `SKILL.md` — plain Node.js module.

### References

- Architecture Decision P3-1: `_bmad-output/planning-artifacts/architecture.md#decision-p3-1-bmad-knowledge-graph`
- FRs: FR141–FR148 — node/edge/file/meta schema definitions
- NFR39 (LLM-writability), NFR40 (additive-only)
- Downstream stories that wire in emission: 19.2, 19.3, 19.4 (require this module to exist first)

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
