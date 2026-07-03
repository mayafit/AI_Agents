/**
 * lib/knowledge-atlas/src/render/orphan.ts
 * ---------------------------------------------------------------------------
 * Story 29.4 — Orphan / gap view renderer.
 *
 * Exports: renderOrphanPage(manifest, outDir): string[]
 *
 * Produces: orphans.html — a pure manifest query, no filesystem access.
 * Surfaces disconnected knowledge:
 *   1. Requirements/NFRs with no implementing story
 *   2. Stories with no requirement (no outgoing implements edge to req/nfr)
 *   3. Bugs with no root-cause / addressed-by link
 *   4. Epics with no retrospective (no validates edge targeting them)
 *   5. Dangling edge references (excluding shipped-in version targets)
 *
 * Invariants:
 *   - Pure manifest query (no fs access beyond writing the output page).
 *   - shipped-in version targets are intentionally terminal — excluded from gaps.
 *   - Deterministic: sorts all output lists by node id.
 *   - ARIA; LF line endings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeManifest, GraphNode } from '../types.js';
import { DESIGN_SYSTEM_CSS } from './design-system.js';

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
// Node link helper
// ---------------------------------------------------------------------------

// Set of rendered document paths (manifest.files[].path), populated by
// renderOrphanPage before any nodeLink call. A node whose fileId is NOT a
// rendered doc page — e.g. a KG-only node from knowledge-graph.json — must not
// emit a live href, or the browser would 404 on click. Such nodes render as
// non-clickable text instead (finding: KG-only orphan link → 404).
let RENDERED_DOC_PATHS: Set<string> = new Set();

function nodeLink(node: GraphNode, extra?: string): string {
  const base = safePath(node.fileId);
  const extraStr = extra ? ` ${esc(extra)}` : '';
  const meta = `<span class="node-meta">[${esc(node.kind)}${extraStr}]</span>`;
  const hasDoc = RENDERED_DOC_PATHS.has(node.fileId);
  if (base === '#invalid' || !hasDoc) {
    // Unsafe or no rendered doc page (KG-only): non-clickable, never a dead link.
    return (
      `<span class="node-link node-link-nodoc" aria-label="${esc(node.label)} (${esc(node.kind)}, no page)">` +
      `${esc(node.label)}</span>${meta}`
    );
  }
  const href = base + (node.anchor ? '#' + node.anchor : '');
  return (
    `<a href="${esc(href)}" class="node-link" aria-label="${esc(node.label)} (${esc(node.kind)})">` +
    `${esc(node.label)}</a>${meta}`
  );
}

// ---------------------------------------------------------------------------
// Orphan / gap computation
// ---------------------------------------------------------------------------

interface OrphanReport {
  unreferencedRequirements: GraphNode[];
  storiesWithNoRequirement: GraphNode[];
  bugsWithNoLink: GraphNode[];
  epicsWithNoRetro: GraphNode[];
  danglingEdges: Array<{ from: string; to: string; kind: string }>;
}

function computeOrphans(manifest: KnowledgeManifest): OrphanReport {
  const nodes = manifest.nodes;
  const edges = manifest.edges;

  // Build edge sets for fast lookup
  const nodeIds = new Set(nodes.map(n => n.id));

  // Edges by kind
  const implementsEdges = edges.filter(e => e.kind === 'implements');
  const addressedByEdges = edges.filter(e => e.kind === 'addressed-by');
  const validatesEdges = edges.filter(e => e.kind === 'validates');
  const derivesFromEdges = edges.filter(e => e.kind === 'derives-from');

  // 1. Requirements/NFRs with no implementing story
  // A requirement/nfr node has no incoming 'implements' edge
  const reqNfrNodes = nodes.filter(n => n.kind === 'requirement' || n.kind === 'nfr');
  const implementedReqIds = new Set(implementsEdges.map(e => e.to));

  const unreferencedRequirements = reqNfrNodes
    .filter(n => !implementedReqIds.has(n.id))
    .sort((a, b) => a.id < b.id ? -1 : 1);

  // 2. Stories with no requirement (no outgoing implements to a req/nfr node)
  const storyNodes = nodes.filter(n => n.kind === 'story');
  const reqNfrNodeIds = new Set(reqNfrNodes.map(n => n.id));

  const storiesWithNoRequirement = storyNodes
    .filter(story => {
      const outgoingImpl = implementsEdges.filter(e => e.from === story.id);
      return !outgoingImpl.some(e => reqNfrNodeIds.has(e.to));
    })
    .sort((a, b) => a.id < b.id ? -1 : 1);

  // 3. Bugs with no root-cause / addressed-by link
  // A bug has no incoming 'addressed-by' edge (meaning no story addresses it)
  // AND no outgoing 'addressed-by' or 'depends-on' or 'implements' edge
  const bugNodes = nodes.filter(n => n.kind === 'bug');
  const addressedBugIds = new Set(addressedByEdges.map(e => e.to));
  const bugsWithOutgoingLinks = new Set(
    [...addressedByEdges, ...implementsEdges]
      .filter(e => bugNodes.some(b => b.id === e.from))
      .map(e => e.from),
  );

  const bugsWithNoLink = bugNodes
    .filter(bug => !addressedBugIds.has(bug.id) && !bugsWithOutgoingLinks.has(bug.id))
    .sort((a, b) => a.id < b.id ? -1 : 1);

  // 4. Epics with no retrospective
  // An epic node has no 'validates' edge targeting it from a retrospective
  const epicNodes = nodes.filter(n => n.kind === 'epic');
  const validatedEpicIds = new Set(validatesEdges.map(e => e.to));
  // Also check derives-from links from retrospectives
  const retroNodes = nodes.filter(n => n.kind === 'retrospective');
  const retroLinkedEpicIds = new Set(
    edges.filter(e => retroNodes.some(r => r.id === e.from)).map(e => e.to),
  );

  const epicsWithNoRetro = epicNodes
    .filter(epic => !validatedEpicIds.has(epic.id) && !retroLinkedEpicIds.has(epic.id))
    .sort((a, b) => a.id < b.id ? -1 : 1);

  // 5. Dangling edge references (excluding shipped-in version targets)
  const danglingEdges = edges
    .filter(e => e.dangling === true && e.kind !== 'shipped-in')
    .map(e => ({ from: e.from, to: e.to, kind: e.kind }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from < b.from ? -1 : 1;
      if (a.to !== b.to) return a.to < b.to ? -1 : 1;
      return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
    });

  return {
    unreferencedRequirements,
    storiesWithNoRequirement,
    bugsWithNoLink,
    epicsWithNoRetro,
    danglingEdges,
  };
}

// ---------------------------------------------------------------------------
// Section renderer helpers
// ---------------------------------------------------------------------------

function renderOrphanSection(
  id: string,
  title: string,
  description: string,
  nodes: GraphNode[],
  emptyMessage: string,
): string {
  const lines: string[] = [
    `<section class="orphan-section ${nodes.length > 0 ? 'has-orphans' : 'no-orphans'}" ` +
      `id="${esc(id)}" aria-label="${esc(title)}">`,
    `<h2>${esc(title)} <span class="orphan-count" aria-label="${nodes.length} items">${nodes.length}</span></h2>`,
    `<p class="diagram-desc">${esc(description)}</p>`,
  ];

  if (nodes.length === 0) {
    lines.push(`<p class="orphan-empty" aria-label="${esc(emptyMessage)}">${esc(emptyMessage)}</p>`);
  } else {
    lines.push('<ul class="orphan-list" role="list">');
    for (const node of nodes) {
      lines.push(`<li class="orphan-item">${nodeLink(node)}</li>`);
    }
    lines.push('</ul>');
  }

  lines.push('</section>');
  return lines.join('\n');
}

function renderDanglingSection(
  danglingEdges: Array<{ from: string; to: string; kind: string }>,
): string {
  const lines: string[] = [
    `<section class="orphan-section ${danglingEdges.length > 0 ? 'has-orphans' : 'no-orphans'}" ` +
      `id="dangling-refs" aria-label="Dangling references">`,
    `<h2>Dangling References <span class="orphan-count" aria-label="${danglingEdges.length} items">${danglingEdges.length}</span></h2>`,
    '<p class="diagram-desc">Edges whose target node was not found in the manifest. ' +
      'Indicates a broken reference or a document that has not yet been created. ' +
      'shipped-in version targets are excluded (they are intentionally terminal).</p>',
  ];

  if (danglingEdges.length === 0) {
    lines.push('<p class="orphan-empty">No dangling references found.</p>');
  } else {
    lines.push(
      '<div class="scroll-wrapper" role="region" aria-label="Dangling references table">',
      '<table class="dangling-table" aria-label="Dangling references">',
      '<thead><tr>',
      '<th scope="col">From</th>',
      '<th scope="col">Edge kind</th>',
      '<th scope="col">To (unresolved)</th>',
      '</tr></thead>',
      '<tbody>',
    );

    for (const edge of danglingEdges) {
      lines.push(
        '<tr>',
        `<td class="dangling-cell"><code>${esc(edge.from)}</code></td>`,
        `<td class="dangling-cell"><span class="edge-kind-badge">${esc(edge.kind)}</span></td>`,
        `<td class="dangling-cell dangling-target"><code>${esc(edge.to)}</code></td>`,
        '</tr>',
      );
    }

    lines.push('</tbody>', '</table>', '</div>');
  }

  lines.push('</section>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Summary / table of contents
// ---------------------------------------------------------------------------

function renderSummary(report: OrphanReport): string {
  const totalIssues =
    report.unreferencedRequirements.length +
    report.storiesWithNoRequirement.length +
    report.bugsWithNoLink.length +
    report.epicsWithNoRetro.length +
    report.danglingEdges.length;

  const statusColor = totalIssues === 0 ? '#2e7d32' : '#e65100';
  const statusLabel = totalIssues === 0 ? 'No gaps detected' : `${totalIssues} gaps detected`;

  const lines: string[] = [
    '<section class="orphan-summary card" aria-label="Orphan summary">',
    `<h2>Summary <span class="summary-status" style="color:${esc(statusColor)}" aria-live="polite">${esc(statusLabel)}</span></h2>`,
    '<ul class="summary-list">',
    `<li><a href="#unreferenced-requirements">Unreferenced requirements/NFRs:</a> <strong>${report.unreferencedRequirements.length}</strong></li>`,
    `<li><a href="#stories-no-requirement">Stories with no requirement:</a> <strong>${report.storiesWithNoRequirement.length}</strong></li>`,
    `<li><a href="#bugs-no-link">Bugs with no link:</a> <strong>${report.bugsWithNoLink.length}</strong></li>`,
    `<li><a href="#epics-no-retro">Epics with no retrospective:</a> <strong>${report.epicsWithNoRetro.length}</strong></li>`,
    `<li><a href="#dangling-refs">Dangling references:</a> <strong>${report.danglingEdges.length}</strong></li>`,
    '</ul>',
    '</section>',
  ];

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Page CSS
// ---------------------------------------------------------------------------

const ORPHAN_CSS = `
/* Orphan page additional styles */
.orphan-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.25);
  margin-bottom: calc(var(--gap) * 1.25);
}

.orphan-section.has-orphans {
  border-left: 4px solid var(--warn);
}

.orphan-section.no-orphans {
  border-left: 4px solid var(--ok);
}

.orphan-section h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-dk);
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.orphan-count {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1px 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink-wash);
}

.orphan-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.orphan-item {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.orphan-item:last-child { border-bottom: none; }

.orphan-empty {
  font-size: 0.85rem;
  color: var(--ok);
  font-style: italic;
}

.node-link {
  color: var(--accent-dk);
  text-decoration: none;
  font-size: 0.85rem;
}
.node-link:hover { text-decoration: underline; }

.node-meta {
  font-size: 0.75rem;
  color: var(--ink-wash);
  margin-left: 0.25rem;
}

/* Summary */
.orphan-summary h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--accent-dk);
  margin-bottom: 0.5rem;
}

.summary-status {
  font-size: 0.85rem;
  font-weight: 400;
  margin-left: 0.75rem;
}

.summary-list {
  list-style: none;
  padding: 0;
  font-size: 0.88rem;
}

.summary-list li {
  padding: 0.2rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-list a {
  color: var(--accent);
  text-decoration: underline;
}

.diagram-desc {
  font-size: 0.85rem;
  color: var(--ink-wash);
  margin-bottom: 0.75rem;
}

/* Dangling references table */
.scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

.dangling-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.82rem;
}

.dangling-table th {
  text-align: left;
  background: var(--surface-alt);
  padding: 0.4rem 0.65rem;
  font-weight: 600;
  color: var(--ink-wash);
  border-bottom: 2px solid var(--border);
}

.dangling-cell {
  padding: 0.35rem 0.65rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.dangling-target { color: var(--warn); }

.edge-kind-badge {
  display: inline-block;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 0.78rem;
  font-family: monospace;
}
`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Render the orphan/gap view page and write it to outDir.
 *
 * @param manifest  The knowledge manifest from 29.2 discovery.
 * @param outDir    Absolute path to the output directory.
 * @returns Array of relative paths written (always ['orphans.html']).
 */
export function renderOrphanPage(manifest: KnowledgeManifest, outDir: string): string[] {
  // Populate the rendered-doc-path set so nodeLink can suppress dead links to
  // KG-only nodes that have no generated reading-view page.
  RENDERED_DOC_PATHS = new Set(manifest.files.map(f => f.path));
  const report = computeOrphans(manifest);
  const title = esc(manifest.projectTitle);

  const summaryHtml = renderSummary(report);

  const unreferencedHtml = renderOrphanSection(
    'unreferenced-requirements',
    'Unreferenced Requirements / NFRs',
    'Requirements and non-functional requirements with no story implementing them.',
    report.unreferencedRequirements,
    'All requirements have at least one implementing story.',
  );

  const storiesNoReqHtml = renderOrphanSection(
    'stories-no-requirement',
    'Stories with No Requirement',
    'Stories that have no outgoing implements edge to a requirement or NFR.',
    report.storiesWithNoRequirement,
    'All stories are linked to at least one requirement.',
  );

  const bugsNoLinkHtml = renderOrphanSection(
    'bugs-no-link',
    'Bugs with No Link',
    'Bugs that have no addressed-by or implements edge connecting them to a story or requirement.',
    report.bugsWithNoLink,
    'All bugs are linked to a story or requirement.',
  );

  const epicsNoRetroHtml = renderOrphanSection(
    'epics-no-retro',
    'Epics with No Retrospective',
    'Epics that have no retrospective node linked via a validates edge.',
    report.epicsWithNoRetro,
    'All epics have an associated retrospective.',
  );

  const danglingHtml = renderDanglingSection(report.danglingEdges);

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} — Orphans &amp; Gaps</title>`,
    `<meta name="description" content="Orphan and gap analysis for ${title}">`,
    '<style>',
    DESIGN_SYSTEM_CSS.trimEnd(),
    ORPHAN_CSS,
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<h1>${title}</h1>`,
    '<p class="subtitle">Orphans &amp; Gaps</p>',
    '<nav aria-label="Site navigation">',
    '<a href="index.html">Home</a>',
    '<a href="graph.html">Interactive Graph</a>',
    '<a href="diagrams.html">Diagrams</a>',
    '</nav>',
    '</header>',
    '<main>',

    summaryHtml,
    unreferencedHtml,
    storiesNoReqHtml,
    bugsNoLinkHtml,
    epicsNoRetroHtml,
    danglingHtml,

    '</main>',
    '<footer>',
    `Knowledge Atlas &bull; ${title} &bull; orphans.html`,
    '</footer>',
    '</body>',
    '</html>',
    '', // trailing newline
  ].join('\n');

  const outPath = path.join(outDir, 'orphans.html');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });

  return ['orphans.html'];
}
