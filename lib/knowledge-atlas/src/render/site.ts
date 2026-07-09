/**
 * lib/knowledge-atlas/src/render/site.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Site renderer for the Knowledge Atlas.
 *
 * Provides:
 *   renderSite(manifest, outDir) — writes all HTML pages and assets,
 *   returns sorted list of relative paths written.
 *
 * Output structure:
 *   outDir/
 *     index.html         — home page (NO <script> tags — 29.1 smoke test)
 *     search.html        — search page (with lunr inline)
 *     docs/              — one .html per document in manifest.files
 *       {slug}.html
 *     assets/
 *       mermaid.min.js   — vendored mermaid browser bundle (if available)
 *
 * Constraints:
 *   - index.html must NOT contain <script>, src=, fetch(, XMLHttpRequest, http://, https://
 *   - Document pages may include <script src="../assets/mermaid.min.js"> (local relative only)
 *   - All output uses LF endings
 *   - Deterministic: same inputs → same output
 */

import * as fs from 'fs';
import * as path from 'path';
import { pageShell } from './layout.js';
import type { NavFlags } from './layout.js';
import { renderDocumentPage } from './document.js';
import { writeVendorAsset } from './vendor.js';
import { renderSearchPageHtml } from './search.js';
import { filePathToSlug, buildSlugMap } from './paths.js';
import type { KnowledgeManifest, FileRecord } from '../types.js';

export { filePathToSlug } from './paths.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Write a file with LF normalization, creating parent dirs as needed. */
function writeHtml(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });
}

// ---------------------------------------------------------------------------
// Home page renderer
// ---------------------------------------------------------------------------

function renderHomePage(manifest: KnowledgeManifest, navFlags: NavFlags): string {
  const { projectTitle, generatedAt, counts, nodes, edges } = manifest;
  const escapedTitle = esc(projectTitle);

  // Stats section
  const totalFiles   = counts['files']   ?? 0;
  const totalNodes   = counts['nodes']   ?? 0;
  const totalEdges   = counts['edges']   ?? 0;

  // Node kind counts from manifest
  const kindCounts: Record<string, number> = {};
  for (const node of nodes) {
    kindCounts[node.kind] = (kindCounts[node.kind] ?? 0) + 1;
  }

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const node of nodes) {
    if (node.status) {
      statusCounts[node.status] = (statusCounts[node.status] ?? 0) + 1;
    }
  }

  // Orphan count: nodes with no edges (neither from nor to), excluding dangling edges
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.dangling) {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    }
  }
  const orphanCount = nodes.filter(n => !connectedNodeIds.has(n.id)).length;

  // Stat cards
  const statCardsHtml = [
    `<div class="stat-card"><span class="stat-num tabular">${totalFiles}</span><div class="stat-label">Documents</div></div>`,
    `<div class="stat-card"><span class="stat-num tabular">${totalNodes}</span><div class="stat-label">Entities</div></div>`,
    `<div class="stat-card"><span class="stat-num tabular">${totalEdges}</span><div class="stat-label">Relationships</div></div>`,
    `<div class="stat-card"><span class="stat-num tabular">${orphanCount}</span><div class="stat-label">Orphaned entities</div></div>`,
  ].join('\n');

  // Kind distribution table (sorted by count desc)
  const kindRows = Object.entries(kindCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([kind, count]) => `<tr><td>${esc(kind)}</td><td class="tabular">${count}</td></tr>`)
    .join('\n');

  const kindTableHtml = kindRows
    ? [
        '<div class="atlas-table-wrap">',
        '<table class="atlas-table">',
        '<thead><tr><th>Entity kind</th><th>Count</th></tr></thead>',
        '<tbody>',
        kindRows,
        '</tbody>',
        '</table>',
        '</div>',
      ].join('\n')
    : '<p class="meta">No entities found.</p>';

  // Status distribution
  const statusRows = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => {
      const cls = `status-pill status-${status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      return `<tr><td><span class="${esc(cls)}">${esc(status)}</span></td><td class="tabular">${count}</td></tr>`;
    })
    .join('\n');

  const statusTableHtml = statusRows
    ? [
        '<div class="atlas-table-wrap">',
        '<table class="atlas-table">',
        '<thead><tr><th>Status</th><th>Count</th></tr></thead>',
        '<tbody>',
        statusRows,
        '</tbody>',
        '</table>',
        '</div>',
      ].join('\n')
    : '<p class="meta">No status data.</p>';

  // Document list grouped by type
  const homeSlugMap = buildSlugMap(manifest.files.map(f => f.path));
  const filesByType: Record<string, FileRecord[]> = {};
  for (const file of manifest.files) {
    const t = file.type ?? 'unknown';
    if (!filesByType[t]) filesByType[t] = [];
    filesByType[t].push(file);
  }

  const docListParts: string[] = [];
  for (const [type, files] of Object.entries(filesByType).sort(([a], [b]) => a.localeCompare(b))) {
    const items = files.map(f => {
      const slug = homeSlugMap.get(f.path) ?? filePathToSlug(f.path);
      const name = f.path.split('/').pop()?.replace(/\.(md|yaml|json)$/i, '') ?? f.path;
      const badges = (f.statuses ?? []).map(s => {
        const cls = `status-pill status-${s.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        return `<span class="${esc(cls)}">${esc(s)}</span>`;
      }).join(' ');
      return `<li><a href="docs/${esc(slug)}.html">${esc(name)}</a> ${badges}</li>`;
    }).join('\n');

    docListParts.push(
      `<div class="card">`,
      `<h2>${esc(type)}</h2>`,
      `<ul>`,
      items,
      `</ul>`,
      `</div>`,
    );
  }

  const docListHtml = docListParts.join('\n') || '<p>No documents found. Run BMAD workflows to generate content.</p>';

  // Graph link — only if graph.html exists (29.4 writes it)
  // We don't know yet if graph.html will exist, so we omit it (29.4 handles this)
  // The home page should gracefully omit graph link if not present.

  const heroHtml = [
    '<div class="hero">',
    `<h1>${escapedTitle}</h1>`,
    '<p class="subtitle">Knowledge Atlas — your project\'s living documentation graph</p>',
    '</div>',
  ].join('\n');

  const healthSnapshotHtml = [
    '<div class="card">',
    '<h2>Health snapshot</h2>',
    '<div class="card-grid">',
    statCardsHtml,
    '</div>',
    '<h3>Entities by kind</h3>',
    kindTableHtml,
    ...(statusRows ? ['<h3>Status distribution</h3>', statusTableHtml] : []),
    '</div>',
  ].join('\n');

  // Graph/Diagrams/Orphans entry points are included ONLY if 29.4 has written
  // that page into outDir (detected by renderSite before this runs, passed as
  // navFlags). Home must surface ALL entry points, not just the graph
  // (SHOULD-FIX #2 — diagrams.html/orphans.html were previously unreachable
  // from home).
  const graphNavItem = navFlags.hasGraphPage
    ? '<li><a href="graph.html">Explore the knowledge graph</a></li>'
    : '';
  const diagramsNavItem = navFlags.hasDiagramsPage
    ? '<li><a href="diagrams.html">View generated diagrams</a></li>'
    : '';
  const orphansNavItem = navFlags.hasOrphansPage
    ? '<li><a href="orphans.html">View orphans &amp; gaps</a></li>'
    : '';

  const quickNavHtml = [
    '<div class="card">',
    '<h2>Navigation</h2>',
    '<ul>',
    '<li><a href="search.html">Search all documents and entities</a></li>',
    graphNavItem,
    diagramsNavItem,
    orphansNavItem,
    '</ul>',
    '</div>',
  ].filter(Boolean).join('\n');

  const body = [
    heroHtml,
    '<div class="content-wrap">',
    quickNavHtml,
    healthSnapshotHtml,
    '<h2>Documents</h2>',
    docListHtml,
    '</div>',
  ].join('\n');

  // HOME PAGE: NO scripts passed — must not contain <script> tags or src=
  // (29.1 smoke test). pageShell renders a plain <form> search box (PE-safe).
  return pageShell({
    title:    projectTitle,
    body,
    manifest,
    pageType: 'home',
    navFlags,
    // scripts intentionally omitted → home page has zero JS
  });
}

// ---------------------------------------------------------------------------
// renderSite
// ---------------------------------------------------------------------------

/**
 * Write all pages and assets under outDir.
 * Returns a sorted list of relative paths written.
 *
 * @param resolveAbsPath  Story 29.7 — optional fileId → absolute-path resolver
 *   forwarded to `renderDocumentPage()` for files scanned from a knowledge
 *   source outside `projectRoot` (whose fileId is `<basename>/<relPath>`, not
 *   joinable with projectRoot). generate.ts always supplies this, built from
 *   the current scan; omitted callers keep the historical
 *   `path.join(projectRoot, fileId)` behavior.
 */
export function renderSite(
  manifest: KnowledgeManifest,
  outDir: string,
  resolveAbsPath?: (fileId: string) => string | undefined,
): string[] {
  const written: string[] = [];
  const docBodies = new Map<string, string>();

  // Ensure output dirs exist
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'docs'), { recursive: true });

  // Collision-free slug map: distinct fileIds can slugify to the same base
  // name (e.g. `a/prd.md` vs `a_prd.md`). Resolve ONCE against the full sorted
  // file list so no doc page overwrites another; every consumer (linkify,
  // backlinks, search, home doc-list) recomputes the identical map from
  // manifest.files, so links stay consistent.
  const fileIds = manifest.files.map(f => f.path);
  const slugMap = buildSlugMap(fileIds);

  // SHOULD-FIX #2: which 29.4 pages (graph/diagrams/orphans) exist, so every
  // page type below can share ONE consistent nav (Home · Graph · Diagrams ·
  // Orphans · Search) instead of the previous per-page-type divergent set.
  // generate.ts always writes graph.html/diagrams.html/orphans.html BEFORE
  // calling renderSite, so this check is reliable here.
  const navFlags: NavFlags = {
    hasGraphPage: fs.existsSync(path.join(outDir, 'graph.html')),
    hasDiagramsPage: fs.existsSync(path.join(outDir, 'diagrams.html')),
    hasOrphansPage: fs.existsSync(path.join(outDir, 'orphans.html')),
  };

  // Step 1: Render document pages (reading views). Legible with zero JS; pages
  // that contain a mermaid diagram additionally load the vendored runtime.
  let anyMermaid = false;
  let anyDrawio = false;
  for (const file of manifest.files) {
    const slug = slugMap.get(file.path) ?? filePathToSlug(file.path);
    const { html, articleText, usedMermaid, usedDrawio } = renderDocumentPage(file, manifest, manifest.projectRoot, navFlags, resolveAbsPath);
    const relPath = `docs/${slug}.html`;
    writeHtml(path.join(outDir, relPath), html);
    written.push(relPath);
    if (usedMermaid) anyMermaid = true;
    if (usedDrawio) anyDrawio = true;

    // Index ONLY the article text (no nav/footer/TOC/status chrome), so search
    // hits reflect document content rather than shell boilerplate.
    docBodies.set(file.path, articleText);
  }

  // Step 1b: Copy the vendored browser runtimes into assets/ — but only the ones
  // a page actually references (mermaid runtime / draw.io viewer), so a site with
  // no such diagrams carries no extra weight.
  if (anyMermaid) {
    const rel = writeVendorAsset(outDir, 'mermaid.min.js');
    if (rel) written.push(rel);
  }
  if (anyDrawio) {
    const rel = writeVendorAsset(outDir, 'drawio-viewer.min.js');
    if (rel) written.push(rel);
  }

  // Step 2: Render search.html (offline lunr search; PE fallback).
  const searchHtml = renderSearchPageHtml(manifest, docBodies, navFlags);
  writeHtml(path.join(outDir, 'search.html'), searchHtml);
  written.push('search.html');

  // Step 3: Render index.html (home page — NO <script>/src=). Surfaces
  // Graph/Diagrams/Orphans/Search as entry points whenever those pages exist.
  const indexHtml = renderHomePage(manifest, navFlags);
  writeHtml(path.join(outDir, 'index.html'), indexHtml);
  written.push('index.html');

  // Return sorted list of relative paths (determinism).
  return written.sort();
}
