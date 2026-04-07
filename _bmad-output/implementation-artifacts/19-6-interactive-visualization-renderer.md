# Story 19.6: Interactive Visualization Renderer

Status: ready-for-dev

## Story

As an **Engineer**,
I want the knowledge graph HTML file to render an interactive, navigable visualization of all project artifacts and their relationships,
so that I can explore cross-document traceability visually and jump directly to any document section from the graph.

## Acceptance Criteria

1. **Given** `knowledge-graph.html` is opened in a browser or VSCode webview
   **When** the graph renders
   **Then** each node appears as a circle color-coded by document type:
   - `prd` → blue
   - `architecture` → orange
   - `epic` → green
   - `story` → teal
   - `decision` → purple
   - `validation` → red
   **And** directed edges are rendered as arrows with the edge type as a label
   **And** the initial render completes within 3 seconds for graphs up to 500 nodes and 1000 edges (NFR38)

2. **Given** the user clicks a node
   **When** the click handler fires
   **Then** the node's source document opens at the specific heading anchor via the IDE's file protocol or a browser file URL
   - For `relative_path` / `absolute_path` pointer types: construct `vscode://file/{absolute-path}#{anchor}` URI and navigate; fallback: display a copyable Markdown link `[title](file.md#anchor)`
   - For `url` pointer type: open the registered URL in a new browser tab

3. **Given** the user hovers over an edge
   **When** the tooltip renders
   **Then** it displays: edge type, label (if set), created_by, agent, created_at (FR155)

4. **Given** the user selects a node
   **When** the selection occurs
   **Then** the immediate neighbors (one hop in either direction) are highlighted
   **And** non-neighbor nodes and edges are dimmed (FR156)

5. **Given** the user uses the filter controls
   **When** a node type or edge type is deselected
   **Then** nodes and edges of that type are hidden from the visualization
   **And** re-selecting them restores visibility (FR156)

6. **Given** the HTML file is opened in an air-gapped environment with no network access
   **When** the page loads
   **Then** the graph renders identically to a connected environment — no CDN requests, no external fonts, no script fetches (FR157, NFR41)

## Tasks / Subtasks

### Task 1: Replace `generate-html.js` placeholder with full renderer generator (AC: 1–6)

Story 19.5 created `lib/bmad-extension/skills/open-graph/generate-html.js` as a placeholder. This story replaces it with the full implementation. **Interface is unchanged:** `node generate-html.js <jsonPath> <htmlPath>`.

- [ ] 1.1 Read the existing placeholder at `lib/bmad-extension/skills/open-graph/generate-html.js`
- [ ] 1.2 Overwrite with the full renderer generator script:
  - Read `knowledge-graph.json` from `<jsonPath>`
  - Generate the complete self-contained HTML with:
    - All CSS inlined in `<style>` block
    - Graph data embedded as `const GRAPH_DATA = <JSON literal>;`
    - All JS inlined in `<script>` block
  - Write complete HTML to `<htmlPath>`

### Task 2: Implement SVG-based force-directed layout (AC: 1, 4 — performance/NFR38)

- [ ] 2.1 Implement force-directed simulation in vanilla JS (NO external libraries, NO bundler):
  - **Coulomb repulsion:** each pair of nodes repels with force ∝ 1/distance²
  - **Spring attraction:** edges attract connected nodes with Hooke's law spring force
  - **Pre-compute first 100 ticks** at HTML generation time in `generate-html.js` — embed final positions as `cx`, `cy` attributes in the generated HTML (no startup animation jitter, renders immediately)
- [ ] 2.2 Node rendering: SVG `<circle>` elements, radius 12px, color from the node `type` field (see color map in AC1), with `<text>` label below
- [ ] 2.3 Edge rendering: SVG `<line>` elements with arrowhead markers (`<marker>` element), edge type label as SVG `<text>` at midpoint
- [ ] 2.4 Performance target: 500 nodes / 1000 edges render to first interactive frame in ≤3 seconds. Pre-computed layout achieves this by eliminating runtime physics startup.

### Task 3: Implement node click-to-navigate (AC: 2)

- [ ] 3.1 On node click, look up `files[node.file]` to get pointer and pointer_type
- [ ] 3.2 For `relative_path`: construct path relative to HTML file location; try `vscode://file/<absolute-path>#<anchor>` first; fallback to showing a copyable `[title](file.md#anchor)` link in a panel
- [ ] 3.3 For `absolute_path`: use the absolute path directly
- [ ] 3.4 For `url`: `window.open(files[node.file].pointer + '#' + node.anchor, '_blank')`

### Task 4: Implement edge tooltip (AC: 3)

- [ ] 4.1 On `mouseover` of edge line, show a floating `<div id="tooltip">` with:
  ```
  Type: <edge.type>
  Label: <edge.label || "—">
  Created by: <edge.created_by>
  Agent: <edge.agent>
  Date: <edge.created_at formatted as YYYY-MM-DD HH:MM>
  ```
- [ ] 4.2 Position tooltip near the cursor (mouse position + offset)
- [ ] 4.3 On `mouseout`, hide the tooltip

### Task 5: Implement neighbor highlight and filter controls (AC: 4, 5)

- [ ] 5.1 **Neighbor highlight on node select:**
  - On node click/select: build forward + backward adjacency sets for the selected node
  - Highlight selected node (brighter fill) and all directly connected nodes (slightly brighter)
  - Dim all other nodes and edges (opacity: 0.1)
  - Click on background to deselect and restore full opacity
  - Implementation: CSS class toggle on SVG elements; no re-layout needed

- [ ] 5.2 **Filter checkboxes:**
  - Create `<div id="controls">` above the SVG canvas with:
    - One checkbox per node type (prd, architecture, epic, story, decision, validation)
    - One checkbox per edge type (implements, derives-from, traces-to, informed-by, validates, refines)
  - On checkbox toggle: use CSS `display: none` to hide/show matching elements — no re-layout
  - All checkboxes checked by default (all visible)

### Task 6: Verify self-containment (AC: 6)

- [ ] 6.1 Open the generated HTML in a browser with network connectivity disabled (Chrome DevTools → Network → Offline)
- [ ] 6.2 Verify the graph renders identically
- [ ] 6.3 Confirm no CDN requests appear in the Network tab
- [ ] 6.4 Search the generated HTML for `http://`, `https://`, `<script src`, `<link href` — none should be present

## Dev Notes

### CRITICAL: This Story Replaces a Placeholder (Story 19.5)

Story 19.5 created `lib/bmad-extension/skills/open-graph/generate-html.js` as a placeholder diagnostic page. This story **replaces** that file with the full renderer. The interface is unchanged:
```
node lib/bmad-extension/skills/open-graph/generate-html.js <jsonPath> <htmlPath>
```

### No External Libraries — Vanilla JS Only (FR157, NFR41)

This is a hard constraint from the architecture. Do NOT use:
- D3.js (even inlined)
- React, Vue, or any framework
- Any `import` or `require` for third-party packages
- CDN scripts or stylesheets

The renderer must be approximately 300–500 lines of vanilla JS. If it grows larger, review for verbosity.

### Pre-Computed Layout (NFR38 Performance)

The key to achieving ≤3 second initial render for 500 nodes / 1000 edges is **pre-computing the layout at generation time** in `generate-html.js`. The force simulation runs server-side (Node.js) and final positions are baked into the HTML. The browser only renders — no physics calculation at runtime.

Implementation strategy in `generate-html.js`:
1. Build adjacency graph from `GRAPH_DATA.edges`
2. Initialize node positions randomly
3. Run force simulation loop for 100 iterations
4. Embed final `{ id, cx, cy }` positions in the HTML as a separate `const POSITIONS = [...]` literal

### HTML Structure (Architecture-Authoritative)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Knowledge Graph — {project}</title>
  <style>/* all CSS inlined — no external stylesheets */</style>
</head>
<body>
  <div id="controls"><!-- filter checkboxes --></div>
  <svg id="graph" width="100%" height="90vh">
    <!-- nodes and edges rendered here as SVG elements -->
  </svg>
  <div id="tooltip" style="display:none; position:fixed"><!-- edge hover panel --></div>
  <script>
    const GRAPH_DATA = /* full JSON embedded at generation time */;
    const POSITIONS = /* pre-computed layout positions */;
    /* all rendering, interaction, and filter logic inlined */
  </script>
</body>
</html>
```

### Node Color Map

| Node type | Color |
|-----------|-------|
| `prd` | `#4A90D9` (blue) |
| `architecture` | `#E8A838` (orange) |
| `epic` | `#5CB85C` (green) |
| `story` | `#5BC0DE` (teal) |
| `decision` | `#9B59B6` (purple) |
| `validation` | `#E74C3C` (red) |
| (unknown) | `#95A5A6` (gray — fallback) |

Note: architecture.md specifies `requirement=blue, architecture=orange, epic=purple, story=green, design=teal, test=red`. The epics.md specifies `prd=blue, architecture=orange, epic=green, story=teal, decision=purple, validation=red`. Use the epics.md definitions (they are more specific to actual node types emitted). The color map above reflects this.

### SVG Arrowhead Marker

Standard SVG `<defs>` marker for directed edges:
```svg
<defs>
  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
  </marker>
</defs>
```
Apply with `marker-end="url(#arrowhead)"` on edge `<line>` elements.

### Bidirectional Adjacency Map

Build in-browser at render time (from GRAPH_DATA):
```javascript
const forward = {};  // nodeId → [nodeId, ...]
const backward = {}; // nodeId → [nodeId, ...]
GRAPH_DATA.edges.forEach(e => {
  (forward[e.from] = forward[e.from] || []).push(e.to);
  (backward[e.to] = backward[e.to] || []).push(e.from);
});
```
Used for neighbor highlight (AC: 4). NFR38 / FR143 (bidirectional index).

### CSS-Based Filtering (No Re-Layout)

Filtering by type should use CSS class toggling for performance:
```javascript
// Add data-type attribute to each SVG element at render time
// e.g., <circle data-node-type="prd" ...>
// On filter toggle:
document.querySelectorAll('[data-node-type="prd"]').forEach(el => {
  el.style.display = checked ? '' : 'none';
});
```
This avoids re-running the physics simulation or rebuilding the SVG on filter change.

### File Only Changed by This Story

```
lib/
└── bmad-extension/
    └── skills/
        └── open-graph/
            └── generate-html.js    ← REPLACE placeholder with full renderer
```

No other files are created or modified by this story. The installer automatically picks up the updated file on next deployment.

### Project Structure Notes

- This story modifies exactly one file: `lib/bmad-extension/skills/open-graph/generate-html.js`
- No new skill registration needed (registered in Story 19.5)
- No module-help.csv changes

### References

- Architecture Decision P3-1 — Renderer features (FR154–FR157): `_bmad-output/planning-artifacts/architecture.md#renderer-features-fr154fr156`
- Architecture Decision P3-1 — Performance contract (NFR38): `_bmad-output/planning-artifacts/architecture.md#performance-contract-nfr38`
- Story 19.5: `_bmad-output/implementation-artifacts/19-5-open-graph-skill.md` — creates the placeholder
- FRs: FR154 (interactive viz, node navigation), FR155 (edge tooltip), FR156 (filtering, neighbor highlight), FR157 (no external dependencies)
- NFRs: NFR38 (≤3s for 500/1000), NFR41 (air-gapped)

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
