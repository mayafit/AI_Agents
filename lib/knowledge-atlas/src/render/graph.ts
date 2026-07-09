/**
 * lib/knowledge-atlas/src/render/graph.ts
 * ---------------------------------------------------------------------------
 * Story 29.4 — Interactive force-directed graph page renderer.
 *
 * Exports: renderGraphPage(manifest, outDir): string[]
 *
 * Produces: graph.html — a self-contained interactive graph of the whole
 * project. force-graph is vendored locally (embedded as inline <script>);
 * graph data is embedded as window.__ATLAS_GRAPH__ (never fetched).
 *
 * Invariants:
 *   - No CDN, no external fetch, no web fonts.
 *   - Graceful degradation (FR234): zero-JS fallback shows counts + legend.
 *   - ARIA labels; deterministic output (no Date.now/Math.random).
 *   - LF line endings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeManifest, NodeKind, EdgeKind } from '../types.js';
import { DESIGN_SYSTEM_CSS } from './design-system.js';
import { FORCE_GRAPH_UMD } from './force-graph-umd.js';
import { buildNavLinksHtml } from './layout.js';
import { buildDocPageMap } from './paths.js';

// ---------------------------------------------------------------------------
// Node kind → visual style mapping
// ---------------------------------------------------------------------------

interface NodeStyle {
  color: string;
  // 'hexagon' added in Story 29.8 for the 'document' NodeKind (the client
  // canvas already implements a hexagon path in traceNodeShapePath()).
  shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon';
  size: number;
}

const NODE_STYLES: Record<NodeKind, NodeStyle> = {
  capability:      { color: '#7b1fa2', shape: 'diamond', size: 10 },
  requirement:     { color: '#1565c0', shape: 'circle',  size: 8  },
  nfr:             { color: '#0277bd', shape: 'circle',  size: 7  },
  epic:            { color: '#2e7d32', shape: 'square',  size: 12 },
  story:           { color: '#00897b', shape: 'circle',  size: 8  },
  bug:             { color: '#c62828', shape: 'triangle', size: 9 },
  'arch-decision': { color: '#4527a0', shape: 'diamond', size: 9  },
  retrospective:   { color: '#e65100', shape: 'square',  size: 8  },
  // Story 29.8 — whole-document file node (prd/architecture/epics/report/…).
  // Muted gray hexagon so it reads as "container/document", distinct from the
  // brighter typed entity shapes above.
  document:        { color: '#78909c', shape: 'hexagon', size: 9  },
};

// Edge kind → color mapping
const EDGE_COLORS: Record<EdgeKind, string> = {
  'implements':    '#1565c0',
  'derives-from':  '#2e7d32',
  'refines':       '#6a1b9a',
  'blocks':        '#c62828',
  'depends-on':    '#e65100',
  'validates':     '#00695c',
  'addressed-by':  '#ad1457',
  'shipped-in':    '#546e7a',
  // Story 29.8 — weak/structural "mentions" edge. Light gray so it visually
  // recedes behind the semantic (implements/derives-from/…) edges above.
  'references':    '#b0bec5',
};

// Human-readable labels for legend
const NODE_KIND_LABELS: Record<NodeKind, string> = {
  capability:      'Capability (F##)',
  requirement:     'Requirement (FR###)',
  nfr:             'Non-Functional Req (NFR##)',
  epic:            'Epic',
  story:           'Story',
  bug:             'Bug',
  'arch-decision': 'Architecture Decision',
  retrospective:   'Retrospective',
  document:        'Document',
};

const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  'implements':    'implements',
  'derives-from':  'derives-from',
  'refines':       'refines',
  'blocks':        'blocks',
  'depends-on':    'depends-on',
  'validates':     'validates',
  'addressed-by':  'addressed-by',
  'shipped-in':    'shipped-in',
  'references':    'references',
};

// All NodeKind values for iteration (sorted for determinism)
const ALL_NODE_KINDS: NodeKind[] = [
  'capability', 'requirement', 'nfr', 'epic', 'story', 'bug', 'arch-decision', 'retrospective', 'document',
];

// All EdgeKind values for iteration
const ALL_EDGE_KINDS: EdgeKind[] = [
  'implements', 'derives-from', 'refines', 'blocks', 'depends-on', 'validates', 'addressed-by', 'shipped-in', 'references',
];

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return (s ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Guard a path/href against protocol-based injection (XSS finding #2).
 * Rejects anything with a URI scheme (`javascript:`, `data:`, `https:`, …) and
 * protocol-relative URLs (`//evil.com`). fileIds are POSIX-relative document
 * paths; a value that looks like a URL is hostile/malformed → '#invalid'.
 */
function safePath(p: string): string {
  const s = (p ?? '').toString();
  // Scheme: a letter followed by letters/digits/+/-/. then a colon, e.g. "javascript:"
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(s)) return '#invalid';
  // Protocol-relative ("//host/...") would resolve to an external origin
  if (/^\/\//.test(s)) return '#invalid';
  return s;
}

// ---------------------------------------------------------------------------
// Graph data builder
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  fileId: string;
  anchor: string | undefined;
  color: string;
  shape: string;
  size: number;
  status: string | undefined;
  /**
   * Server-resolved rendered doc-page path ("docs/<slug>.html"), via the
   * shared 29.3 resolver (paths.ts::buildDocPageMap) — mirrors the `page`
   * field search.ts already embeds per search entry. `undefined` when this
   * node's fileId has no corresponding rendered page (e.g. a knowledge-graph-
   * only node): the client MUST treat that as non-navigable rather than
   * falling back to the raw fileId (which is a `.md` source path, not a site
   * URL, and would 404).
   */
  page: string | undefined;
}

interface GraphEdge {
  source: string;
  target: string;
  kind: string;
  color: string;
  dangling: boolean;
  /** Story 29.8 — render this edge dashed (used for weak `references` links). */
  dashed: boolean;
}

function buildGraphData(manifest: KnowledgeManifest): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // fileId -> rendered doc-page path ("docs/<slug>.html"), via the shared
  // 29.3 resolver (paths.ts). This is the ONLY thing the client should ever
  // navigate to — the raw fileId is a `.md` source path that does not exist
  // in the generated static site (Epic 29 bug fix). Resolved once here
  // (rather than per-node via docPageRelPath) to avoid rebuilding the slug
  // map for every node.
  const docPages = buildDocPageMap(manifest.files.map(f => f.path));

  const nodes: GraphNode[] = manifest.nodes.map(n => {
    const style = NODE_STYLES[n.kind] ?? NODE_STYLES.story;
    return {
      id: n.id,
      label: n.label,
      kind: n.kind,
      // Sanitize the navigation target server-side (finding #2). The runtime
      // click handler also guards, but a clean embedded value is defense-in-depth.
      fileId: safePath(n.fileId),
      anchor: n.anchor,
      color: style.color,
      shape: style.shape,
      size: style.size,
      status: n.status,
      // undefined when this fileId has no rendered doc page (KG-only node) —
      // the client's onNodeClick must no-op rather than navigate to a raw path.
      page: docPages.get(n.fileId),
    };
  });

  const edges: GraphEdge[] = manifest.edges.map(e => {
    const color = EDGE_COLORS[e.kind as EdgeKind] ?? '#999';
    return {
      source: e.from,
      target: e.to,
      kind: e.kind,
      color,
      dangling: e.dangling === true,
      // Story 29.8 — `references` edges render DASHED (in addition to their
      // lighter color) so a weak "mentions" link is unmistakably distinct from
      // a strong semantic edge and never reads as a false `implements` claim.
      dashed: e.kind === 'references',
    };
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Legend HTML (used in both JS and no-JS fallback)
// ---------------------------------------------------------------------------

function buildLegendHtml(): string {
  const lines: string[] = [
    '<section class="legend" aria-label="Graph legend">',
    '<h2>Legend</h2>',
    '<div class="legend-grid">',
    '<div class="legend-section">',
    '<h3>Node Types</h3>',
    '<ul class="legend-list">',
  ];

  for (const kind of ALL_NODE_KINDS) {
    const style = NODE_STYLES[kind];
    const label = NODE_KIND_LABELS[kind];
    // FR222: --swatch-color feeds the shape-specific CSS above (e.g. the
    // triangle shape can't use `background`, since its box is 0×0 — the
    // color has to come from a border, via this custom property instead).
    lines.push(
      `<li><span class="legend-swatch" style="background:${esc(style.color)};--swatch-color:${esc(style.color)}" ` +
      `aria-hidden="true" data-shape="${esc(style.shape)}"></span>${esc(label)}</li>`,
    );
  }

  lines.push(
    '</ul>',
    '</div>',
    '<div class="legend-section">',
    '<h3>Edge Types</h3>',
    '<ul class="legend-list">',
  );

  for (const kind of ALL_EDGE_KINDS) {
    const color = EDGE_COLORS[kind];
    const label = EDGE_KIND_LABELS[kind];
    lines.push(
      `<li><span class="legend-edge" style="background:${esc(color)}" aria-hidden="true"></span>${esc(label)}</li>`,
    );
  }

  lines.push(
    '</ul>',
    '</div>',
    '</div>',
    '</section>',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// No-JS fallback HTML
// ---------------------------------------------------------------------------

function buildFallbackHtml(manifest: KnowledgeManifest): string {
  const counts = manifest.counts;
  const lines: string[] = [
    '<noscript>',
    '<div class="noscript-fallback" role="complementary" aria-label="Graph unavailable without JavaScript">',
    '<h2>Interactive Graph (JavaScript required)</h2>',
    '<p class="meta">The interactive graph requires JavaScript. Below is a summary and links to static views.</p>',
    '<div class="fallback-counts" aria-label="Project knowledge counts">',
    `<div class="count-chip"><strong>${counts['nodes'] ?? 0}</strong> nodes</div>`,
    `<div class="count-chip"><strong>${counts['edges'] ?? 0}</strong> edges</div>`,
  ];

  for (const kind of ALL_NODE_KINDS) {
    const count = counts[`nodes.${kind}`];
    if (count != null && count > 0) {
      const style = NODE_STYLES[kind];
      lines.push(
        `<div class="count-chip" style="border-left:3px solid ${esc(style.color)}">` +
        `<strong>${count}</strong> ${esc(NODE_KIND_LABELS[kind])}</div>`,
      );
    }
  }

  lines.push(
    '</div>',
    '<div class="fallback-links">',
    '<a href="diagrams.html">Generated Diagrams</a>',
    '<a href="orphans.html">Orphan / Gap View</a>',
    '<a href="search.html">Search</a>',
    '<a href="index.html">Knowledge Atlas Home</a>',
    '</div>',
    '</div>',
    '</noscript>',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the interactive graph page and write it to outDir.
 *
 * @param manifest  The knowledge manifest from 29.2 discovery.
 * @param outDir    Absolute path to the output directory.
 * @returns Array of relative paths written (always ['graph.html']).
 */
export function renderGraphPage(manifest: KnowledgeManifest, outDir: string): string[] {
  const { nodes, edges } = buildGraphData(manifest);
  const title = esc(manifest.projectTitle);

  // Serialise graph data as a JS object literal (embedded, never fetched).
  // SECURITY (finding #1): JSON.stringify does NOT escape '<' or '/', so a node
  // label/title/fileId containing '</script>' would close the inline <script>
  // block and execute arbitrary markup. Unicode-escape every '<' (and the closing
  // '/' of an end-tag, defensively) — this stays valid JSON and renders identically.
  const graphDataJson = JSON.stringify({ nodes, edges }, null, 0)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const fallbackHtml = buildFallbackHtml(manifest);
  const legendHtml = buildLegendHtml();

  // Build all node kind options for filter
  const usedKinds = [...new Set(manifest.nodes.map(n => n.kind))].sort();
  const usedEdgeKinds = [...new Set(manifest.edges.map(e => e.kind))].sort();

  const nodeKindOptions = usedKinds.map(k =>
    `<option value="${esc(k)}">${esc(NODE_KIND_LABELS[k as NodeKind] ?? k)}</option>`,
  ).join('\n        ');

  const edgeKindOptions = usedEdgeKinds.map(k =>
    `<option value="${esc(k)}">${esc(EDGE_KIND_LABELS[k as EdgeKind] ?? k)}</option>`,
  ).join('\n        ');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} — Knowledge Graph</title>`,
    `<meta name="description" content="Interactive knowledge graph for ${title}">`,
    '<style>',
    DESIGN_SYSTEM_CSS.trimEnd(),
    `
/* Graph-page specific styles */
.graph-page main { max-width: none; padding: 0 var(--gap); }

.controls-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem var(--gap);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.75rem;
}

.controls-bar label { font-size: 0.85rem; color: var(--ink-wash); }
.controls-bar select {
  font-size: 0.82rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
}

.controls-bar button {
  font-size: 0.82rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.controls-bar button:hover { background: var(--accent-dk); }

#graph-container {
  width: 100%;
  height: calc(100vh - 220px);
  min-height: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
}

.legend {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--gap);
  margin-top: var(--gap);
}

.legend h2 { font-size: 0.95rem; font-weight: 600; color: var(--accent-dk); margin-bottom: 0.5rem; }
.legend h3 { font-size: 0.82rem; font-weight: 600; color: var(--ink-wash); margin-bottom: 0.35rem; }

.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--gap);
}

.legend-list {
  list-style: none;
  font-size: 0.82rem;
}

.legend-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* FR222: the legend swatch shape must match the canvas node shape for that
   kind (data-shape is emitted per NODE_STYLES) — previously data-shape was
   emitted but never styled, so every kind rendered as the same square. */
.legend-swatch[data-shape="circle"] {
  border-radius: 50%;
}
.legend-swatch[data-shape="square"] {
  border-radius: 2px; /* same as the base rule — explicit for clarity/symmetry */
}
.legend-swatch[data-shape="diamond"] {
  border-radius: 1px;
  transform: rotate(45deg);
}
.legend-swatch[data-shape="triangle"] {
  width: 0;
  height: 0;
  background: transparent !important;
  border-radius: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 11px solid var(--swatch-color, currentColor);
}
.legend-swatch[data-shape="hexagon"] {
  border-radius: 0;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

.legend-edge {
  display: inline-block;
  width: 20px;
  height: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* No-JS fallback */
.noscript-fallback {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.5);
  margin: var(--gap) 0;
}

.noscript-fallback h2 {
  font-size: 1.1rem;
  color: var(--accent-dk);
  margin-bottom: 0.5rem;
}

.fallback-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: var(--gap) 0;
}

.count-chip {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
}

.fallback-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: var(--gap);
}

.fallback-links a {
  color: var(--accent);
  text-decoration: underline;
  font-size: 0.9rem;
}

.tooltip {
  position: fixed;
  background: rgba(26,26,46,0.92);
  color: #fff;
  border-radius: 4px;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  pointer-events: none;
  max-width: 240px;
  word-break: break-word;
  z-index: 10;
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  #graph-container canvas { animation: none !important; }
}
`,
    '</style>',
    '</head>',
    `<body class="graph-page">`,
    '<header>',
    `<h1>${title}</h1>`,
    '<p class="subtitle">Knowledge Graph — Interactive Navigation</p>',
    // SHOULD-FIX #2: same shared Home/Graph/Diagrams/Orphans/Search set as
    // every other page type (the old hand-rolled nav omitted Search, leaving
    // no way back to search from the graph view). graph.ts/diagrams.ts/
    // orphans.ts are always attempted together by generate.ts, so — matching
    // this page's pre-existing assumption that its siblings exist — the other
    // two 29.4 pages are always linked; only Graph itself is naturally
    // omitted (this IS graph.html).
    '<nav aria-label="Site navigation">',
    buildNavLinksHtml('', { hasGraphPage: false, hasDiagramsPage: true, hasOrphansPage: true }, 'graph'),
    '</nav>',
    '</header>',
    '<main>',

    // No-JS fallback (hidden when JS is available, always visible in noscript)
    fallbackHtml,

    // Controls bar (JS only)
    '<div class="controls-bar" id="controls-bar" aria-label="Graph filter controls" style="display:none">',
    '<label for="filter-node-kind">Node kind:</label>',
    '<select id="filter-node-kind" aria-label="Filter by node kind">',
    '<option value="">All nodes</option>',
    nodeKindOptions,
    '</select>',
    '<label for="filter-edge-kind">Edge kind:</label>',
    '<select id="filter-edge-kind" aria-label="Filter by edge kind">',
    '<option value="">All edges</option>',
    edgeKindOptions,
    '</select>',
    '<button id="btn-reset-zoom" type="button" aria-label="Reset graph zoom">Reset zoom</button>',
    '</div>',

    // Graph container
    '<div id="graph-container" role="img" aria-label="Interactive knowledge graph" style="display:none"></div>',
    '<div class="tooltip" id="graph-tooltip" role="tooltip" aria-live="polite"></div>',

    legendHtml,

    '</main>',
    '<footer>',
    `Knowledge Atlas &bull; ${title} &bull; graph.html`,
    '</footer>',

    // Inline force-graph UMD bundle
    '<script>',
    '/* force-graph v1.51 (vendored, MIT) */',
    FORCE_GRAPH_UMD,
    '</script>',

    // Embed graph data (never fetched — FR234)
    '<script>',
    `window.__ATLAS_GRAPH__ = ${graphDataJson};`,
    '</script>',

    // Application script
    '<script>',
    buildAppScript(),
    '</script>',

    '</body>',
    '</html>',
    '', // trailing newline
  ].join('\n');

  // LF-normalize and write
  const outPath = path.join(outDir, 'graph.html');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });

  return ['graph.html'];
}

// ---------------------------------------------------------------------------
// App script (inline JS, post-force-graph)
// ---------------------------------------------------------------------------

function buildAppScript(): string {
  // This runs after the force-graph UMD and __ATLAS_GRAPH__ data are defined.
  // Using 'ForceGraph' global from the UMD bundle.
  return `
(function() {
  'use strict';

  // Show the interactive controls + container (hide was default for no-JS)
  var controlsBar = document.getElementById('controls-bar');
  var container = document.getElementById('graph-container');
  var tooltip = document.getElementById('graph-tooltip');
  if (controlsBar) controlsBar.style.display = '';
  if (container) container.style.display = '';

  var data = window.__ATLAS_GRAPH__;
  if (!data || !data.nodes || !data.edges) {
    if (container) container.textContent = 'Graph data unavailable.';
    return;
  }

  // Deep-copy working arrays so filters don't mutate originals
  var allNodes = data.nodes.slice();
  var allEdges = data.edges.slice();

  // Node kind filter
  var filterNodeKind = '';
  var filterEdgeKind = '';

  // Tracks the node currently under the cursor so the tooltip can follow the
  // mouse (finding #8: tooltip was shown with display:block but no left/top,
  // so it rendered at the bottom of <main>).
  var lastHoverNode = null;
  var selectedLink = null; // edge highlighted on click: drawn bold + its two endpoints ringed

  function getFilteredData() {
    var nodes = allNodes;
    var edges = allEdges;

    if (filterNodeKind) {
      var nodeIds = new Set(allNodes.filter(function(n) { return n.kind === filterNodeKind; }).map(function(n) { return n.id; }));
      nodes = allNodes.filter(function(n) { return nodeIds.has(n.id); });
      edges = edges.filter(function(e) { return nodeIds.has(e.source) && nodeIds.has(e.target); });
    }

    if (filterEdgeKind) {
      // Restrict to matching edges, then keep ONLY their endpoint nodes — an
      // edge filter must hide nodes that are not an endpoint of a matching edge
      // (finding #5: no short-circuit, so isolated nodes do not stay visible).
      edges = edges.filter(function(e) { return e.kind === filterEdgeKind; });
      var referencedIds = new Set();
      edges.forEach(function(e) { referencedIds.add(e.source); referencedIds.add(e.target); });
      nodes = nodes.filter(function(n) { return referencedIds.has(n.id); });
    }

    return { nodes: nodes, edges: edges };
  }

  // Initialize force-graph
  var ForceGraphLib = (typeof ForceGraph === 'function') ? ForceGraph : (window.ForceGraph);
  if (!ForceGraphLib) {
    if (container) container.textContent = 'force-graph library failed to load.';
    return;
  }

  var graph;
  try {
    graph = ForceGraphLib()(container);
  } catch(e) {
    if (container) container.textContent = 'Graph initialization failed: ' + e.message;
    return;
  }

  // Layout forces (fixes the overlapping-blob): stronger charge repulsion + a
  // larger link distance push nodes apart; a gentler velocity decay lets a
  // dragged node's neighbourhood follow it and settle rather than everything
  // snapping. The vendored force-graph exposes charge/link via d3Force but no
  // collide, so spacing comes from charge+distance. All best-effort.
  try {
    var _charge = graph.d3Force && graph.d3Force('charge');
    if (_charge && _charge.strength) _charge.strength(-160);
    var _link = graph.d3Force && graph.d3Force('link');
    if (_link && _link.distance) _link.distance(48);
    if (graph.d3VelocityDecay) graph.d3VelocityDecay(0.3);
    if (graph.warmupTicks) graph.warmupTicks(80); // pre-spread before first paint
  } catch (_e) { /* forces best-effort; graph still renders without them */ }

  // FR222: distinct shape per entity type (previously color+size only — the
  // canvas never read NODE_STYLES' shape/data-shape, so every node was a
  // circle regardless of kind). Traces the path for the node's shape
  // (embedded per-node from NODE_STYLES server-side) into the 2D canvas
  // context; shared by both the visible paint and the (invisible,
  // color-keyed) hit-test paint so click/hover keep working with the new
  // shapes.
  function traceNodeShapePath(ctx, shape, x, y, size) {
    ctx.beginPath();
    switch (shape) {
      case 'square': {
        var s = size;
        ctx.rect(x - s, y - s, s * 2, s * 2);
        break;
      }
      case 'diamond': {
        var d = size * 1.15;
        ctx.moveTo(x, y - d);
        ctx.lineTo(x + d, y);
        ctx.lineTo(x, y + d);
        ctx.lineTo(x - d, y);
        ctx.closePath();
        break;
      }
      case 'triangle': {
        var t = size * 1.3;
        ctx.moveTo(x, y - t);
        ctx.lineTo(x + t * 0.87, y + t * 0.5);
        ctx.lineTo(x - t * 0.87, y + t * 0.5);
        ctx.closePath();
        break;
      }
      case 'hexagon': {
        var h = size * 1.05;
        for (var i = 0; i < 6; i++) {
          var angle = (Math.PI / 3) * i - Math.PI / 6;
          var px = x + h * Math.cos(angle);
          var py = y + h * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'circle':
      default:
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        break;
    }
  }

  function applyGraphData() {
    var filtered = getFilteredData();
    // Deep-copy to avoid force-graph mutating shared objects
    var nodesCopy = filtered.nodes.map(function(n) { return Object.assign({}, n); });
    var edgesCopy = filtered.edges.map(function(e) { return Object.assign({}, e); });
    graph
      .graphData({ nodes: nodesCopy, links: edgesCopy })
      .nodeId('id')
      .nodeLabel(function(n) { return n.label + ' [' + n.kind + ']' + (n.status ? ' (' + n.status + ')' : ''); })
      .nodeColor(function(n) { return n.color || '#888'; })
      .nodeRelSize(1)
      .nodeVal(function(n) { return (n.size || 6) * (n.size || 6); })
      // FR222: paint the node as its per-kind shape (circle/square/diamond/
      // triangle) instead of force-graph's default circle-only rendering.
      .nodeCanvasObject(function(n, ctx) {
        var size = (n.size || 6) * 0.5; // smaller nodes (were visually oversized/overlapping)
        ctx.fillStyle = n.color || '#888';
        traceNodeShapePath(ctx, n.shape, n.x, n.y, size);
        ctx.fill();
        // Ring the two endpoints of the selected edge so both ends are easy to
        // find, however far apart they sit in the layout.
        if (selectedLink) {
          var s = selectedLink.source, t = selectedLink.target;
          if (n === s || n === t) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, size + 3.5, 0, 2 * Math.PI);
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
        }
      })
      // Matching hit-test paint: without this, force-graph's click/hover
      // detection falls back to a generic area that no longer matches the
      // custom shape drawn above (non-circle nodes would get unreliable
      // hover/click hit-boxes).
      .nodePointerAreaPaint(function(n, color, ctx) {
        var size = (n.size || 6) * 0.5 + 2; // match the smaller draw size, +2 to stay easy to hit
        ctx.fillStyle = color;
        traceNodeShapePath(ctx, n.shape, n.x, n.y, size);
        ctx.fill();
      })
      .linkSource('source')
      .linkTarget('target')
      // Selected edge is drawn dark + thick so you can trace it end to end.
      .linkColor(function(e) { return e === selectedLink ? '#111827' : (e.color || '#aaa'); })
      .linkWidth(function(e) { return e === selectedLink ? 3.5 : (e.dashed ? 0.5 : 1); })
      // Story 29.8 - dashed stroke for weak references edges; solid otherwise.
      .linkLineDash(function(e) { return e.dashed ? [4, 3] : null; })
      .linkDirectionalArrowLength(function(e) { return e === selectedLink ? 7 : 4; })
      .linkDirectionalArrowRelPos(1)
      .linkCurvature(0.1)
      // Click an edge to highlight it (bold + ringed endpoints); click it again
      // or click empty space to clear. Re-applying the accessors forces an
      // immediate repaint of the new selection state.
      .onLinkClick(function(e) {
        selectedLink = (selectedLink === e) ? null : e;
        graph.linkWidth(graph.linkWidth()).linkColor(graph.linkColor());
      })
      .onLinkHover(function(e) {
        if (container) container.style.cursor = e ? 'pointer' : 'default';
        if (!tooltip) return;
        if (!e) { tooltip.style.display = 'none'; return; }
        var s = (e.source && e.source.label) || e.source;
        var t = (e.target && e.target.label) || e.target;
        tooltip.style.display = 'block';
        tooltip.textContent = s + '  →  ' + t + (e.kind ? '  [' + e.kind + ']' : '');
      })
      .onNodeClick(function(n) {
        // Navigate to the reading view via the server-resolved doc page (the
        // 'page' field, e.g. "docs/<slug>.html"), NOT the raw fileId — the
        // raw fileId is a '.md' source path in the project and does not exist
        // in the generated static site (Epic 29 bug fix). Nodes with no
        // resolvable page (e.g. a knowledge-graph-only node with no rendered
        // doc) must never navigate anywhere — no-op.
        var page = n.page || '';
        if (!page) { return; }
        // SECURITY (finding #2, kept as defense-in-depth): reject any URI
        // scheme (javascript:, data:, http:) and protocol-relative paths so a
        // hostile/malformed page value cannot execute or navigate off-origin.
        if (/^[a-zA-Z][a-zA-Z0-9+.\\-]*:/.test(page) || /^\\/\\//.test(page)) { return; }
        var href = page + (n.anchor ? '#' + n.anchor : '');
        window.location.href = href;
      })
      // Drag-to-pin (fixes the spring-back): keep the node exactly where it was
      // dropped (fx/fy). Because the simulation stays warm, its linked neighbours
      // follow the drag and nodes farther along the graph move progressively less.
      // Right-click a node to release its pin back into the layout.
      .onNodeDrag(function(n) { n.fx = n.x; n.fy = n.y; })
      .onNodeDragEnd(function(n) { n.fx = n.x; n.fy = n.y; })
      .onNodeRightClick(function(n) {
        n.fx = undefined; n.fy = undefined;
        if (graph.d3ReheatSimulation) graph.d3ReheatSimulation();
      })
      .onNodeHover(function(n) {
        // Distinct cursor hint: pointer only over nodes that actually
        // navigate somewhere (have a resolved page); default cursor otherwise
        // (secondary to correctness, but signals non-clickable nodes clearly).
        if (container) container.style.cursor = (n && n.page) ? 'pointer' : 'default';
        if (!tooltip) return;
        if (!n) { tooltip.style.display = 'none'; lastHoverNode = null; return; }
        lastHoverNode = n;
        tooltip.style.display = 'block';
        tooltip.textContent = n.label + (n.kind ? ' [' + n.kind + ']' : '') + (n.status ? ' (' + n.status + ')' : '');
      })
      .onBackgroundClick(function() {
        if (tooltip) tooltip.style.display = 'none';
        lastHoverNode = null;
        if (selectedLink) {
          selectedLink = null;
          graph.linkWidth(graph.linkWidth()).linkColor(graph.linkColor());
        }
      });
  }

  applyGraphData();

  // Filter controls
  var nodeKindSelect = document.getElementById('filter-node-kind');
  var edgeKindSelect = document.getElementById('filter-edge-kind');
  var resetBtn = document.getElementById('btn-reset-zoom');

  if (nodeKindSelect) {
    nodeKindSelect.addEventListener('change', function() {
      filterNodeKind = this.value;
      applyGraphData();
    });
  }
  if (edgeKindSelect) {
    edgeKindSelect.addEventListener('change', function() {
      filterEdgeKind = this.value;
      applyGraphData();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (graph && graph.zoomToFit) graph.zoomToFit(400);
    });
  }

  // Position the tooltip next to the cursor while hovering a node (finding #8).
  if (container && tooltip) {
    container.addEventListener('mousemove', function(ev) {
      if (!lastHoverNode) { tooltip.style.display = 'none'; return; }
      // position:fixed → use viewport coordinates directly.
      tooltip.style.left = (ev.clientX + 12) + 'px';
      tooltip.style.top = (ev.clientY + 12) + 'px';
    });
    container.addEventListener('mouseleave', function() {
      tooltip.style.display = 'none';
      lastHoverNode = null;
    });
  }

  // Resize observer
  if (typeof ResizeObserver !== 'undefined' && container) {
    new ResizeObserver(function() {
      if (graph && container) {
        graph.width(container.clientWidth);
        graph.height(container.clientHeight);
      }
    }).observe(container);
  }

  // Initial fit
  setTimeout(function() {
    if (graph && graph.zoomToFit) graph.zoomToFit(400);
  }, 500);
})();
`;
}
