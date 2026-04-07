# Story 19.7: LLM-Writability Contract Validation and Integration Tests

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want the knowledge graph JSON format validated against the LLM-writability contract and covered by integration tests,
so that we can verify that any LLM can extend the graph by copying existing patterns, and that the additive-only semantics are enforced.

## Acceptance Criteria

1. **Given** a `knowledge-graph.json` file with one existing node and one existing edge
   **When** an LLM is instructed to add a new node and a new edge by copying the existing patterns (no external schema provided)
   **Then** the resulting JSON is valid and passes `emitToGraph()` ingestion without errors
   **And** the existing node and edge are preserved unchanged (NFR40)

2. **Given** `emitToGraph()` is called with a node id that already exists in `nodes`
   **When** the function completes
   **Then** `nodes` contains exactly one entry with that id (no duplicate)
   **And** the original node's fields are unchanged (except `title` which may be updated)

3. **Given** `emitToGraph()` is called with an edge `(from, to, type)` triple that already exists
   **When** the function completes
   **Then** `edges` contains exactly one entry with that triple (no duplicate)
   **And** the original edge's provenance (created_by, agent) is unchanged

4. **Given** a graph with 500 nodes and 1000 edges
   **When** `emitToGraph()` adds one new node and one new edge
   **Then** the operation completes in under 1 second

5. **Given** the full emission sequence is run (all 7 skills emit in order)
   **When** the resulting `knowledge-graph.json` is inspected
   **Then** all emitted nodes are present
   **And** all emitted edges are present with correct provenance
   **And** `meta.file_count`, `meta.node_count`, `meta.edge_count` are accurate

## Tasks / Subtasks

### Task 1: Set up test directory structure (AC: 1–5)

Story 19.7 integration tests follow the existing Node.js test runner pattern. Epic 7 (Test Suite) is on hold, so these tests use the existing Node.js test runner directly (no Jest, no Vitest — plain Node.js `assert` and test runner, or whichever lightweight pattern is already in use in the repo).

- [ ] 1.1 Create directory `tests/knowledge-graph/`
- [ ] 1.2 Create `tests/knowledge-graph/fixtures/` for test fixture files
- [ ] 1.3 Check existing test files in the repo (e.g., `tests/` root) to identify the test runner pattern in use — do NOT introduce a new test framework; replicate the existing pattern exactly

### Task 2: Test — additive-only semantics (AC: 1, 2, 3)

- [ ] 2.1 Create `tests/knowledge-graph/emit.test.js`:
  - **Test: first call creates valid structure**
    - Use a temp directory; call `emitToGraph(tmpDir, minimalPayload)`
    - Verify file is created, has `meta`, `files`, `nodes`, `edges` sections
    - Verify `meta.node_count` and `meta.edge_count` match array lengths

  - **Test: duplicate node is rejected (AC: 2)**
    - Seed graph with node `{ id: "prd#test", ... }`
    - Call `emitToGraph()` again with the same node id but different title
    - Verify `nodes` has exactly 1 entry with that id
    - Verify title is updated (expected behavior per Story 19.1: title updates are allowed)

  - **Test: duplicate edge is rejected (AC: 3)**
    - Seed graph with edge `{ from: "prd#a", to: "prd#b", type: "implements", created_by: "original", ... }`
    - Call `emitToGraph()` again with same `(from, to, type)` but different `created_by`
    - Verify `edges` has exactly 1 entry with that triple
    - Verify `created_by` is unchanged (provenance preserved — only `created_at`/`agent` can update)

  - **Test: existing entries preserved (AC: 1, 2, 3 — NFR40)**
    - Seed graph with 3 nodes and 2 edges
    - Call `emitToGraph()` with 2 new nodes and 1 new edge
    - Verify total: 5 nodes, 3 edges
    - Verify all original entries are byte-identical to their initial values

### Task 3: Test — LLM-writability contract (AC: 1)

- [ ] 3.1 Create `tests/knowledge-graph/fixtures/llm-seed.json` — a minimal valid `knowledge-graph.json` with exactly 1 node and 1 edge (following the exact schema structure from `architecture.md` Decision P3-1)
- [ ] 3.2 Create `tests/knowledge-graph/llm-writability.test.js`:
  - **Test: copy-pattern extension produces valid JSON**
    - Load `fixtures/llm-seed.json`
    - Programmatically "extend" it by copying the pattern (add a new node entry and new edge entry following the exact same field structure)
    - Write the extended JSON back to a temp file
    - Call `emitToGraph(tmpDir, emptyEmission)` on the extended file — verify no errors thrown
    - Verify total node/edge counts are correct
  - **Test: valid structure can be round-tripped**
    - Read `fixtures/llm-seed.json`, parse, serialize as `JSON.stringify(graph, null, 2)`, parse again — verify no data loss

### Task 4: Test — performance (AC: 4)

- [ ] 4.1 Add to `tests/knowledge-graph/emit.test.js`:
  - **Test: large graph performance**
    - Generate a fixture graph with 500 nodes and 1000 edges programmatically (use a helper function, not a fixture file — 500-node JSON fixture would be large)
    - Write to temp dir
    - Measure time of `emitToGraph()` adding 1 node and 1 edge
    - Assert elapsed < 1000ms (using `Date.now()` before/after)

### Task 5: Test — full emission sequence (AC: 5)

- [ ] 5.1 Create `tests/knowledge-graph/sequence.test.js`:
  - **Test: sequential emission produces correct final graph**
    - Simulate the 7-skill emission sequence using `emitToGraph()` directly (no actual skills invoked — just the payloads each skill would emit)
    - Use representative payloads:
      1. PRD seeding: 3 PRD nodes, 0 edges
      2. Architecture: 2 arch nodes, 2 `implements` edges to PRD nodes
      3. Epics: 2 epic nodes, 2 `derives-from` edges + 1 `informed-by` edge
      4. Story: 1 story node, 1 `traces-to` edge + 1 `informed-by` edge
      5. Validate-prd: 1 validation node, 1 `validates` edge
      6. Dev-story: 1 `refines` edge (story → arch)
      7. Sprint-planning: 1 sprint node, 1 `derives-from` edge
    - Verify final graph:
      - `meta.node_count == 9` (3+2+2+1+1)
      - `meta.edge_count == 8` (2+3+2+1+1) (approximately — adjust to actual test payload)
      - All emitted nodes present
      - All emitted edges present with correct provenance fields

### Task 6: Test — VSCode detection (AC — Story 19.5)

- [ ] 6.1 Create `tests/knowledge-graph/vscode-detection.test.js`:
  - **Test: VSCODE_PID env var triggers VSCode path**
    - Set `process.env.VSCODE_PID = "12345"` before running detection logic
    - Verify detection returns `true`
    - Restore `process.env` after test
  - **Test: TERM_PROGRAM=vscode triggers VSCode path**
    - Set `process.env.TERM_PROGRAM = "vscode"`
    - Verify detection returns `true`
  - **Test: neither env var set returns false**
    - Ensure both env vars are unset; verify detection returns `false`
  - Extract detection logic from `lib/bmad-extension/skills/open-graph/SKILL.md` into a testable helper function `lib/bmad-extension/skills/open-graph/detect-env.js`

## Dev Notes

### CRITICAL: Test Framework — Use Existing Pattern

Epic 7 (Test Suite Foundation) is on hold. Do NOT introduce Jest, Vitest, Mocha, or any new test framework. Check if any test files already exist in `tests/` and replicate their exact pattern.

If no test infrastructure exists: use Node.js built-in `node:test` module (available from Node.js 18+) and `node:assert`. This requires no npm installation.

Pattern to check first:
- Look for any `*.test.js` files in the repo
- Look for `test` script in `package.json`

### Prerequisite: All of Stories 19.1–19.6 Must Be Complete

This story validates the complete Epic 19 implementation. It depends on:
- `lib/knowledge-graph/emit.js` (Story 19.1)
- `lib/bmad-extension/skills/open-graph/` (Stories 19.5, 19.6)

### Test Directory Convention

Tests live in `tests/knowledge-graph/` following the expectation from the Epic 19 cross-epic notes. Temp directories for all file I/O in tests:
```javascript
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir;
setup(() => { tmpDir = mkdtempSync(join(tmpdir(), 'kg-test-')); });
teardown(() => { rmSync(tmpDir, { recursive: true, force: true }); });
```

### LLM-Writability Fixture (Task 3)

The fixture `tests/knowledge-graph/fixtures/llm-seed.json` must be a minimal but complete example:
```json
{
  "meta": {
    "schema_version": "1.0",
    "project": "test-project",
    "generated_at": "2026-04-07T10:00:00Z",
    "last_updated": "2026-04-07T10:00:00Z",
    "file_count": 1,
    "node_count": 1,
    "edge_count": 1
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
      "from": "arch#decision-test",
      "to": "prd#functional-requirements",
      "type": "implements",
      "label": "implements requirement",
      "created_by": "test-user",
      "agent": "test-agent",
      "created_at": "2026-04-07T10:00:00Z"
    }
  ]
}
```

This fixture is intentionally minimal so that an LLM reading it has exactly one example to copy.

### Performance Test Helper (Task 4)

Generate the 500-node / 1000-edge test graph programmatically:
```javascript
function generateLargeGraph(nodeCount, edgeCount) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `prd#node-${i}`, file: 'prd', anchor: `node-${i}`, title: `Node ${i}`, type: 'prd'
  }));
  const edges = Array.from({ length: edgeCount }, (_, i) => ({
    from: `prd#node-${i % nodeCount}`,
    to: `prd#node-${(i + 1) % nodeCount}`,
    type: 'implements',
    label: `edge ${i}`,
    created_by: 'test', agent: 'test', created_at: new Date().toISOString()
  }));
  // ... build and write graph to temp dir
}
```

### `detect-env.js` Extraction (Task 6)

The VSCode detection logic from SKILL.md should be extracted to a testable Node.js module:
```javascript
// lib/bmad-extension/skills/open-graph/detect-env.js
function detectVSCode() {
  return process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined;
}
module.exports = { detectVSCode };
```

This makes it importable by tests without executing the `execSync` open command.

### File Structure Created by This Story

```
tests/
└── knowledge-graph/
    ├── fixtures/
    │   └── llm-seed.json              ← NEW (LLM-writability test fixture)
    ├── emit.test.js                   ← NEW (additive semantics + performance tests)
    ├── llm-writability.test.js        ← NEW (copy-pattern extension tests)
    ├── sequence.test.js               ← NEW (full emission sequence test)
    └── vscode-detection.test.js       ← NEW (env var detection tests)

lib/bmad-extension/skills/open-graph/
└── detect-env.js                      ← NEW (extracted detection logic for testability)
```

### Project Structure Notes

- No SKILL.md files modified by this story.
- No new skills registered.
- The `detect-env.js` extraction from Story 19.5's SKILL.md is a minor refactor to enable testability.
- If no `tests/` directory exists, create it. Add a `test` script to `package.json` if one does not exist: `"test": "node --test tests/**/*.test.js"` (Node.js 18+ built-in runner).

### References

- Story 19.1: `_bmad-output/implementation-artifacts/19-1-knowledge-graph-core-library.md` — `emitToGraph()` behavior under test
- Architecture LLM-writability contract: `_bmad-output/planning-artifacts/architecture.md#llm-writability-contract-nfr39`
- Architecture additive-only semantics: `_bmad-output/planning-artifacts/architecture.md#nfr40-additive-only-emission`
- Epics cross-epic notes on testing: `_bmad-output/planning-artifacts/epics.md#epic-19--cross-epic-notes`
- NFRs: NFR39 (LLM-writability), NFR40 (additive-only)
- FR: FR152 (no duplicates, provenance preservation)

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
