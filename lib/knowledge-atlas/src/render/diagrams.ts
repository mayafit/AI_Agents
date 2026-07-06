/**
 * lib/knowledge-atlas/src/render/diagrams.ts
 * ---------------------------------------------------------------------------
 * Story 29.4 — Generated diagrams page renderer.
 *
 * Exports: renderDiagrams(manifest, outDir): string[]
 *
 * Produces: diagrams.html — hand-built HTML/CSS/SVG (no heavy lib) containing:
 *   1. Traceability spine: Capability→Requirement/NFR→Epic→Story→Bug→Retrospective
 *   2. Epic→Story trees: one tree per epic showing its stories
 *   3. Sprint/Status board: columns by lifecycle status (backlog→done)
 *
 * Invariants:
 *   - Pure CSS/SVG, no force-graph, no Mermaid, no CDN.
 *   - ARIA labels on all diagrams.
 *   - Horizontal-scroll wrappers for wide diagrams.
 *   - LF line endings; deterministic (sorts before rendering).
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeManifest, GraphNode, GraphEdge, NodeKind } from '../types.js';
import { DESIGN_SYSTEM_CSS } from './design-system.js';
import { buildNavLinksHtml } from './layout.js';
import { buildDocPageMap } from './paths.js';

// ---------------------------------------------------------------------------
// HTML escape
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
 * Rejects URI schemes (javascript:, data:, http:, …) and protocol-relative
 * URLs (//host). fileIds are relative document paths; anything else → '#invalid'.
 */
function safePath(p: string): string {
  const s = (p ?? '').toString();
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(s)) return '#invalid';
  if (/^\/\//.test(s)) return '#invalid';
  return s;
}

// ---------------------------------------------------------------------------
// Node kind colors (consistent with graph.ts)
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
  capability:      '#7b1fa2',
  requirement:     '#1565c0',
  nfr:             '#0277bd',
  epic:            '#2e7d32',
  story:           '#00897b',
  bug:             '#c62828',
  'arch-decision': '#4527a0',
  retrospective:   '#e65100',
};

function nodeColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#546e7a';
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  done:          '#2e7d32',
  review:        '#1565c0',
  'in-progress': '#e65100',
  'ready-for-dev': '#7b1fa2',
  backlog:       '#546e7a',
};

function statusBadge(status: string | undefined): string {
  if (!status) return '';
  const color = STATUS_COLORS[status] ?? '#546e7a';
  return `<span class="status-badge" style="background:${esc(color)}" aria-label="Status: ${esc(status)}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Node link helper
// ---------------------------------------------------------------------------

/**
 * Render a link to a node's rendered reading-view page (docs/<slug>.html),
 * resolved via the shared 29.3 resolver (paths.ts::buildDocPageMap) — NOT the
 * raw source fileId, which is a `.md` path in the project and does not exist
 * in the generated static site.
 *
 * `docPages` maps fileId -> "docs/<slug>.html" for every fileId that has a
 * rendered doc page. A node whose fileId is absent from that map (e.g. a
 * knowledge-graph-only node with no corresponding scanned document) has no
 * page to link to; it renders as non-clickable text instead of a live href
 * that would 404 (mirrors backlinks.ts's dangling-backlink treatment).
 */
function nodeLink(node: GraphNode, docPages: Map<string, string>): string {
  const page = docPages.get(node.fileId);
  if (!page) {
    return (
      `<span class="node-link node-link-nodoc" aria-disabled="true" ` +
      `aria-label="${esc(node.label)} (${esc(node.kind)}, no page)">${esc(node.label)}</span>`
    );
  }
  const base = safePath(page);
  if (base === '#invalid') {
    // Defense-in-depth: page is server-resolved ("docs/<slug>.html") and can
    // never actually trip safePath's scheme/protocol-relative checks.
    return (
      `<span class="node-link node-link-nodoc" aria-disabled="true" ` +
      `aria-label="${esc(node.label)} (${esc(node.kind)}, no page)">${esc(node.label)}</span>`
    );
  }
  const href = base + (node.anchor ? '#' + node.anchor : '');
  return `<a href="${esc(href)}" class="node-link" aria-label="${esc(node.label)} (${esc(node.kind)})">${esc(node.label)}</a>`;
}

// ---------------------------------------------------------------------------
// 1. Traceability spine
// ---------------------------------------------------------------------------

/**
 * Build the traceability spine diagram.
 * Shows the chain: Capability → Requirements/NFR → Epic → Story → Bug → Retrospective
 * as a swimlane table with connected rows.
 */
function buildTraceabilitySpine(manifest: KnowledgeManifest, docPages: Map<string, string>): string {
  const nodes = manifest.nodes;
  const edges = manifest.edges;

  // Group nodes by kind
  const byKind = (kind: NodeKind) => nodes.filter(n => n.kind === kind);

  const capabilities = byKind('capability');
  const requirements = byKind('requirement');
  const nfrs = byKind('nfr');
  const epics = byKind('epic');
  const stories = byKind('story');
  const bugs = byKind('bug');
  const retros = byKind('retrospective');

  // Story 29.8 — the spine must stay legible: PREFER semantic edges
  // (implements/derives-from/refines/blocks/depends-on/validates/
  // addressed-by/shipped-in) for the connector glyph/degree, and only FALL
  // BACK to `references` edges for a node that has ZERO semantic edges in
  // either direction. Otherwise a heavily-referenced entity (FR26 mentioned
  // 47×) would flood every already-connected node's connector tooltip with
  // weak "mentions" noise on top of its real semantic links.
  const semanticEdges = edges.filter(e => e.kind !== 'references');
  const referenceEdges = edges.filter(e => e.kind === 'references');

  function buildDegreeMaps(edgeList: GraphEdge[]): { fwd: Map<string, string[]>; rev: Map<string, string[]> } {
    const fwd = new Map<string, string[]>();
    const rev = new Map<string, string[]>();
    for (const e of edgeList) {
      if (!fwd.has(e.from)) fwd.set(e.from, []);
      fwd.get(e.from)!.push(e.to);
      if (!rev.has(e.to)) rev.set(e.to, []);
      rev.get(e.to)!.push(e.from);
    }
    return { fwd, rev };
  }

  const semanticMaps = buildDegreeMaps(semanticEdges);
  const referenceMaps = buildDegreeMaps(referenceEdges);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  /** True if `id` has at least one semantic edge (either direction). */
  function hasSemanticLink(id: string): boolean {
    return (semanticMaps.fwd.get(id)?.length ?? 0) > 0 || (semanticMaps.rev.get(id)?.length ?? 0) > 0;
  }

  /** Count of forward (outgoing) edges from a node — drives the connector glyph. */
  function outDegree(id: string): number {
    if (hasSemanticLink(id)) return semanticMaps.fwd.get(id)?.length ?? 0;
    return referenceMaps.fwd.get(id)?.length ?? 0;
  }
  /** Count of reverse (incoming) edges into a node. */
  function inDegree(id: string): number {
    if (hasSemanticLink(id)) return semanticMaps.rev.get(id)?.length ?? 0;
    return referenceMaps.rev.get(id)?.length ?? 0;
  }

  const colDefs: { kind: string; label: string; nodes: GraphNode[] }[] = [
    { kind: 'capability',    label: 'Capabilities',       nodes: capabilities },
    { kind: 'requirement',   label: 'Requirements (FR)',  nodes: requirements },
    { kind: 'nfr',           label: 'Non-Functional (NFR)', nodes: nfrs },
    { kind: 'epic',          label: 'Epics',              nodes: epics },
    { kind: 'story',         label: 'Stories',            nodes: stories },
    { kind: 'bug',           label: 'Bugs',               nodes: bugs },
    { kind: 'retrospective', label: 'Retrospectives',     nodes: retros },
  ];

  // Connector resolver (finding #7): for a node, list the labels of its
  // forward-linked targets that exist in the graph (so the spine shows real
  // relationships, not just colored columns). Mirrors outDegree/inDegree's
  // semantic-preferred, references-as-fallback rule (Story 29.8) so the
  // tooltip text always matches the connector count shown.
  function linkedTargetLabels(id: string): string[] {
    const maps = hasSemanticLink(id) ? semanticMaps : referenceMaps;
    const tos = maps.fwd.get(id) ?? [];
    const labels: string[] = [];
    for (const to of tos) {
      const target = nodeById.get(to);
      if (target) labels.push(target.label);
    }
    return labels.sort();
  }

  const lines: string[] = [
    '<section class="diagram-section" aria-label="Traceability spine diagram">',
    '<h2>Traceability Spine</h2>',
    '<p class="diagram-desc">From capabilities through requirements, epics, stories, bugs, and retrospectives. ' +
      'The <span class="spine-connector" aria-hidden="true">&rarr;</span> glyph marks an entity with outgoing links; ' +
      'hover it to see the connected entities.</p>',
    '<div class="scroll-wrapper" role="region" aria-label="Traceability table (scroll horizontally if needed)">',
    '<table class="spine-table" aria-label="Traceability spine">',
    '<thead>',
    '<tr>',
  ];

  for (const col of colDefs) {
    const color = nodeColor(col.kind);
    lines.push(
      `<th class="spine-col-header" style="border-top:3px solid ${esc(color)}" scope="col">` +
      `${esc(col.label)}<br><small>(${col.nodes.length})</small></th>`,
    );
  }
  lines.push('</tr>', '</thead>', '<tbody>');

  // Determine the max rows
  const maxRows = Math.max(...colDefs.map(c => c.nodes.length), 1);

  for (let i = 0; i < maxRows; i++) {
    lines.push('<tr>');
    for (const col of colDefs) {
      const node = col.nodes[i];
      if (!node) {
        lines.push('<td class="spine-cell spine-cell--empty" aria-hidden="true"></td>');
      } else {
        const badge = statusBadge(node.status);
        // Connector glyph: render when the node has forward links (out-degree),
        // titled with the linked entity labels. An "orphan dot" marks a node with
        // neither incoming nor outgoing edges so isolated entities are visible.
        const out = outDegree(node.id);
        const deg = out + inDegree(node.id);
        let connector = '';
        if (out > 0) {
          const targets = linkedTargetLabels(node.id);
          const titleAttr = targets.length
            ? ` title="Links to: ${esc(targets.join(', '))}"`
            : '';
          connector =
            `<span class="spine-connector" aria-label="${out} outgoing link${out === 1 ? '' : 's'}"${titleAttr}>` +
            `&rarr;<span class="spine-connector-count">${out}</span></span>`;
        } else if (deg === 0) {
          connector = '<span class="spine-orphan-dot" aria-label="No links" title="No links">&deg;</span>';
        }
        lines.push(
          `<td class="spine-cell" style="border-left:2px solid ${esc(nodeColor(node.kind))}">` +
          `${nodeLink(node, docPages)}${badge}${connector}</td>`,
        );
      }
    }
    lines.push('</tr>');
  }

  lines.push('</tbody>', '</table>', '</div>', '</section>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 2. Epic → Story trees
// ---------------------------------------------------------------------------

function buildEpicStoryTrees(manifest: KnowledgeManifest, docPages: Map<string, string>): string {
  const nodes = manifest.nodes;
  const edges = manifest.edges;

  const epics = nodes.filter(n => n.kind === 'epic');
  if (epics.length === 0) {
    return '<section class="diagram-section" aria-label="Epic story trees"><h2>Epic → Story Trees</h2><p class="meta">No epics found.</p></section>';
  }

  // Index nodes by id once (finding #10: replaces repeated O(N) nodes.find).
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // For each epic, collect its stories. A story belongs to an epic when there is
  // any edge directly connecting the two (derives-from / implements / either
  // direction). One edge pass, O(E), with Set-based dedup per epic.
  const epicStories = new Map<string, GraphNode[]>();
  const epicStorySeen = new Map<string, Set<string>>();
  for (const epic of epics) {
    epicStories.set(epic.id, []);
    epicStorySeen.set(epic.id, new Set());
  }

  function linkEpicStory(epicId: string, story: GraphNode): void {
    const seen = epicStorySeen.get(epicId);
    const arr = epicStories.get(epicId);
    if (!seen || !arr || seen.has(story.id)) return;
    seen.add(story.id);
    arr.push(story);
  }

  // Story 29.8: membership must stay on SEMANTIC edges (derives-from/
  // implements/…) — a `references` edge is just a prose mention, not epic
  // membership, and would otherwise falsely list every story an epic's
  // section happens to name.
  for (const edge of edges) {
    if (edge.kind === 'references') continue;
    const a = nodeById.get(edge.from);
    const b = nodeById.get(edge.to);
    if (!a || !b) continue;
    // Identify which endpoint is the epic and which is the story.
    if (a.kind === 'epic' && b.kind === 'story' && epicStories.has(a.id)) {
      linkEpicStory(a.id, b);
    } else if (b.kind === 'epic' && a.kind === 'story' && epicStories.has(b.id)) {
      linkEpicStory(b.id, a);
    }
  }

  const lines: string[] = [
    '<section class="diagram-section" aria-label="Epic story trees">',
    '<h2>Epic → Story Trees</h2>',
    '<p class="diagram-desc">Each epic with its related stories.</p>',
    '<div class="epic-trees">',
  ];

  for (const epic of epics) {
    const epicStoryList = (epicStories.get(epic.id) ?? []).sort((a, b) => a.id < b.id ? -1 : 1);
    const color = nodeColor('epic');

    lines.push(
      `<div class="epic-tree" aria-label="Epic: ${esc(epic.label)}">`,
      `<div class="epic-root" style="border-left:4px solid ${esc(color)}">`,
      `<span class="epic-icon" aria-hidden="true">&#9733;</span>`,
      `${nodeLink(epic, docPages)}${statusBadge(epic.status)}`,
      '</div>',
    );

    if (epicStoryList.length > 0) {
      lines.push(
        '<ul class="story-list" aria-label="Stories in this epic">',
      );
      for (const story of epicStoryList) {
        lines.push(
          `<li class="story-item" style="border-left:2px solid ${esc(nodeColor(story.kind))}">` +
          `${nodeLink(story, docPages)}${statusBadge(story.status)}</li>`,
        );
      }
      lines.push('</ul>');
    } else {
      lines.push('<p class="meta no-stories">No stories linked to this epic.</p>');
    }

    lines.push('</div>');
  }

  lines.push('</div>', '</section>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 3. Sprint/Status board
// ---------------------------------------------------------------------------

const LIFECYCLE_STATUSES = ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done'] as const;
type LifecycleStatus = typeof LIFECYCLE_STATUSES[number];

const STATUS_LABELS: Record<LifecycleStatus, string> = {
  backlog:        'Backlog',
  'ready-for-dev': 'Ready for Dev',
  'in-progress':  'In Progress',
  review:         'Review',
  done:           'Done',
};

function buildStatusBoard(manifest: KnowledgeManifest, docPages: Map<string, string>): string {
  const nodes = manifest.nodes;

  // Collect story + bug nodes by status
  const boardNodes = nodes.filter(n => n.kind === 'story' || n.kind === 'bug');

  const columns = new Map<string, GraphNode[]>();
  for (const s of LIFECYCLE_STATUSES) {
    columns.set(s, []);
  }
  const unclassified: GraphNode[] = [];

  for (const node of boardNodes) {
    const status = node.status ?? '';
    if (LIFECYCLE_STATUSES.includes(status as LifecycleStatus)) {
      columns.get(status)!.push(node);
    } else {
      unclassified.push(node);
    }
  }

  // Sort each column by id for determinism
  for (const [, arr] of columns) {
    arr.sort((a, b) => a.id < b.id ? -1 : 1);
  }
  unclassified.sort((a, b) => a.id < b.id ? -1 : 1);

  const lines: string[] = [
    '<section class="diagram-section" aria-label="Sprint status board">',
    '<h2>Sprint / Status Board</h2>',
    '<p class="diagram-desc">Stories and bugs grouped by lifecycle status.</p>',
    '<div class="scroll-wrapper" role="region" aria-label="Status board (scroll horizontally if needed)">',
    '<div class="status-board" aria-label="Status board">',
  ];

  for (const status of LIFECYCLE_STATUSES) {
    const col = columns.get(status)!;
    const color = STATUS_COLORS[status] ?? '#546e7a';
    const label = STATUS_LABELS[status];

    lines.push(
      `<div class="status-col" aria-label="Column: ${esc(label)} (${col.length} items)">`,
      `<div class="status-col-header" style="background:${esc(color)}" aria-hidden="false">`,
      `<span class="status-col-title">${esc(label)}</span>`,
      `<span class="status-col-count" aria-label="${col.length} items">${col.length}</span>`,
      '</div>',
      '<ul class="status-col-items">',
    );

    if (col.length === 0) {
      lines.push('<li class="status-card status-card--empty" aria-label="No items"><span class="meta">—</span></li>');
    } else {
      for (const node of col) {
        lines.push(
          `<li class="status-card" aria-label="${esc(node.label)} (${esc(node.kind)})">`,
          `<span class="card-kind" style="color:${esc(nodeColor(node.kind))}" aria-hidden="true">${esc(node.kind)}</span>`,
          nodeLink(node, docPages),
          '</li>',
        );
      }
    }

    lines.push('</ul>', '</div>');
  }

  // Unclassified column (nodes with no known status)
  if (unclassified.length > 0) {
    lines.push(
      `<div class="status-col" aria-label="Column: Unclassified (${unclassified.length} items)">`,
      `<div class="status-col-header" style="background:#78909c">`,
      '<span class="status-col-title">Unclassified</span>',
      `<span class="status-col-count">${unclassified.length}</span>`,
      '</div>',
      '<ul class="status-col-items">',
    );
    for (const node of unclassified) {
      lines.push(
        `<li class="status-card" aria-label="${esc(node.label)} (${esc(node.kind)})">`,
        `<span class="card-kind" style="color:${esc(nodeColor(node.kind))}" aria-hidden="true">${esc(node.kind)}</span>`,
        nodeLink(node, docPages),
        '</li>',
      );
    }
    lines.push('</ul>', '</div>');
  }

  lines.push('</div>', '</div>', '</section>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Page CSS
// ---------------------------------------------------------------------------

const DIAGRAMS_CSS = `
/* Diagrams page additional styles */
.diagram-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.25);
  margin-bottom: calc(var(--gap) * 1.5);
}

.diagram-section h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent-dk);
  margin-bottom: 0.35rem;
}

.diagram-desc {
  font-size: 0.85rem;
  color: var(--ink-wash);
  margin-bottom: var(--gap);
}

/* Scroll wrapper for wide content */
.scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

/* Traceability spine table */
.spine-table {
  border-collapse: collapse;
  min-width: 800px;
  width: 100%;
  table-layout: fixed;
}

.spine-col-header {
  background: var(--surface-alt);
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink-wash);
}

.spine-col-header small {
  font-weight: 400;
  font-size: 0.78rem;
}

.spine-cell {
  padding: 0.4rem 0.65rem;
  vertical-align: top;
  font-size: 0.83rem;
  border-bottom: 1px solid var(--border);
}

.spine-cell--empty {
  background: var(--surface-alt);
}

.status-badge {
  display: inline-block;
  font-size: 0.7rem;
  color: #fff;
  border-radius: 3px;
  padding: 1px 5px;
  margin-left: 0.35rem;
  vertical-align: middle;
}

/* Traceability connectors (finding #7) */
.spine-connector {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  margin-left: 0.35rem;
  color: var(--accent-dk);
  font-weight: 700;
  cursor: help;
  vertical-align: middle;
}

.spine-connector-count {
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 4px;
  color: var(--ink-wash);
}

.spine-orphan-dot {
  margin-left: 0.35rem;
  color: var(--warn);
  font-weight: 700;
  cursor: help;
  vertical-align: middle;
}

.node-link {
  color: var(--accent-dk);
  text-decoration: none;
  font-size: 0.83rem;
}
.node-link:hover { text-decoration: underline; }

/* Epic trees */
.epic-trees {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--gap);
}

.epic-tree {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--gap);
}

.epic-root {
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border-radius: var(--radius);
  margin-bottom: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.epic-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.story-list {
  list-style: none;
  padding-left: 1rem;
}

.story-item {
  padding: 0.3rem 0.5rem;
  margin-bottom: 0.35rem;
  background: var(--surface);
  border-radius: 3px;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.no-stories {
  font-size: 0.8rem;
  padding-left: 1rem;
}

/* Status board */
.status-board {
  display: flex;
  gap: 0.75rem;
  min-width: 900px;
  padding-bottom: 0.5rem;
}

.status-col {
  flex: 1 0 160px;
  display: flex;
  flex-direction: column;
}

.status-col-header {
  color: #fff;
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 0.4rem 0.65rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-col-title { font-size: 0.82rem; font-weight: 600; }
.status-col-count {
  font-size: 0.78rem;
  background: rgba(255,255,255,0.25);
  border-radius: 10px;
  padding: 1px 7px;
}

.status-col-items {
  list-style: none;
  flex: 1;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  padding: 0.5rem;
  min-height: 60px;
}

.status-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
}

.status-card--empty {
  background: transparent;
  border: none;
  color: var(--ink-wash);
  text-align: center;
}

.card-kind {
  font-size: 0.7rem;
  font-weight: 600;
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}
`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Render the generated diagrams page and write it to outDir.
 *
 * @param manifest  The knowledge manifest from 29.2 discovery.
 * @param outDir    Absolute path to the output directory.
 * @returns Array of relative paths written (always ['diagrams.html']).
 */
export function renderDiagrams(manifest: KnowledgeManifest, outDir: string): string[] {
  const title = esc(manifest.projectTitle);

  // fileId -> rendered doc-page path ("docs/<slug>.html"), via the shared
  // 29.3 resolver (paths.ts). Every node link on this page must resolve
  // against the RENDERED page, never the raw source fileId (Epic 29 bug fix).
  const docPages = buildDocPageMap(manifest.files.map(f => f.path));

  const spineHtml = buildTraceabilitySpine(manifest, docPages);
  const treesHtml = buildEpicStoryTrees(manifest, docPages);
  const boardHtml = buildStatusBoard(manifest, docPages);

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} — Diagrams</title>`,
    `<meta name="description" content="Auto-generated diagrams for ${title}">`,
    '<style>',
    DESIGN_SYSTEM_CSS.trimEnd(),
    DIAGRAMS_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<h1>${title}</h1>`,
    '<p class="subtitle">Generated Diagrams</p>',
    // SHOULD-FIX #2: shared Home/Graph/Diagrams/Orphans/Search nav set (the
    // old hand-rolled nav omitted Search — a dead end back to search from here).
    '<nav aria-label="Site navigation">',
    buildNavLinksHtml('', { hasGraphPage: true, hasDiagramsPage: false, hasOrphansPage: true }, 'diagrams'),
    '</nav>',
    '</header>',
    '<main>',

    spineHtml,
    treesHtml,
    boardHtml,

    '</main>',
    '<footer>',
    `Knowledge Atlas &bull; ${title} &bull; diagrams.html`,
    '</footer>',
    '</body>',
    '</html>',
    '', // trailing newline
  ].join('\n');

  const outPath = path.join(outDir, 'diagrams.html');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });

  return ['diagrams.html'];
}
