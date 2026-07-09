/**
 * lib/knowledge-atlas/src/render/search.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Offline full-text search using lunr (AC 5, AC 8).
 *
 * Provides:
 *   buildSearchIndex()     — builds the lunr index + docs, embedded as a
 *                            `window.__ATLAS_SEARCH__` JS variable (never fetched)
 *   renderSearchPageHtml() — renders the standalone search.html page
 *   (the nav search box widget lives in layout.ts::renderSearchBoxHtml)
 *
 * Sealed-packaging invariant:
 *   - The lunr RUNTIME is vendored into the bundle at build time as the global
 *     string `__ATLAS_LUNR_JS__` (see scripts/build-atlas.js) and inlined into
 *     search.html verbatim. NO CDN, NO <script src> to a remote host, NO fetch.
 *   - The lunr INDEX is built here (Node) and embedded as a JS object literal.
 *   - Works under file:// (origin null → fetch/CORS would fail; we never fetch).
 *
 * Progressive enhancement:
 *   - With JS: instant lunr search.
 *   - Without JS: a visible note + the full document list remains navigable.
 *
 * Determinism: lunr index construction is deterministic for identical input;
 *   docs are emitted in manifest order (files sorted by path, then nodes by id).
 */

import { DESIGN_SYSTEM_CSS } from './design-system.js';
import { filePathToSlug, buildSlugMap } from './paths.js';
import { buildNavLinksHtml } from './layout.js';
import type { NavFlags } from './layout.js';
import type { KnowledgeManifest } from '../types.js';

// lunr is bundled by esbuild for build-time index construction.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const lunr = require('lunr') as any;

// The vendored lunr browser runtime, injected by scripts/build-atlas.js.
// Declared here; resolves to undefined in a raw tsc typecheck (harmless) and to
// the real lunr.min.js source in the built atlas.cjs.
declare const __ATLAS_LUNR_JS__: string | undefined;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchDoc {
  id: string;
  title: string;
  kind?: string;
  fileId: string;
  anchor?: string;
  body: string;
  /**
   * Resolved doc-page slug (collision-free), so the client links directly to
   * `docs/<page>.html` without re-slugifying (which could not reproduce a
   * disambiguation suffix). Always set for docs/entities backed by a real page.
   */
  page?: string;
}

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

/** Strip HTML tags for plain-text indexing. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fileDisplayName(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.(md|markdown|yaml|yml|json|txt)$/i, '') ?? filePath;
}

// ---------------------------------------------------------------------------
// buildSearchDocs — deterministic doc set over files + entities
// ---------------------------------------------------------------------------

function buildSearchDocs(manifest: KnowledgeManifest, docBodies: Map<string, string>): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const seen = new Set<string>();
  // Collision-free page slugs, identical to the page writer's.
  const slugMap = buildSlugMap(manifest.files.map(f => f.path));
  const pageFor = (fileId: string): string | undefined => slugMap.get(fileId);

  // Documents (in manifest.files order — already sorted by path).
  // docBodies now holds ARTICLE-ONLY plain text (SF-1), so stripHtml is a
  // defensive no-op guarding against any accidental markup.
  for (const file of manifest.files) {
    const docId = `file:${file.path}`;
    if (seen.has(docId)) continue;
    seen.add(docId);
    const bodyText = stripHtml(docBodies.get(file.path) ?? '');
    docs.push({
      id: docId,
      title: fileDisplayName(file.path),
      kind: file.type,
      fileId: file.path,
      body: bodyText.slice(0, 2000),
      page: pageFor(file.path),
    });
  }

  // Entities (in manifest.nodes order — already sorted by id). Only entities
  // whose fileId maps to a rendered doc page get a linkable `page`.
  for (const node of manifest.nodes) {
    const docId = `node:${node.id}`;
    if (seen.has(docId)) continue;
    seen.add(docId);
    docs.push({
      id: docId,
      title: node.label,
      kind: node.kind,
      fileId: node.fileId,
      anchor: node.anchor,
      body: [node.label, node.kind, node.title ?? ''].join(' ').trim(),
      page: pageFor(node.fileId),
    });
  }

  return docs;
}

// ---------------------------------------------------------------------------
// buildSearchIndex — embedded JS variable (never fetched)
// ---------------------------------------------------------------------------

/**
 * Build the lunr index and return a `<script>` block that sets
 * `window.__ATLAS_SEARCH__ = { index, docs }`. Embedded inline — never fetched.
 */
export function buildSearchIndex(
  manifest: KnowledgeManifest,
  docBodies: Map<string, string>,
): string {
  const docs = buildSearchDocs(manifest, docBodies);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = lunr(function (this: any) {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('kind', { boost: 3 });
    this.field('body');
    for (const doc of docs) {
      this.add(doc);
    }
  });

  // NFR64 / XSS: the index + docs are inlined inside a <script> block, so any
  // content containing "</script>" could break out of the script and execute.
  // Unicode-escape "<" and ">" — this keeps the string valid JSON that
  // JSON.parse decodes identically, but no "</script>"/"<!--" token survives
  // in the HTML. U+2028/U+2029 (LINE/PARAGRAPH SEPARATOR) are valid inside a
  // JSON string but are illegal, script-terminating raw characters in a JS
  // string literal — escape those too. Matches graph.ts's embedded-JSON
  // escaping (NICE-TO-HAVE #4); applied to BOTH docs and the lunr index.
  const safeJson = (value: unknown): string =>
    JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  const indexJson = safeJson(idx);
  const docsJson = safeJson(docs);

  return [
    '<script>',
    'window.__ATLAS_SEARCH__ = {',
    `  index: ${indexJson},`,
    `  docs: ${docsJson}`,
    '};',
    '</script>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Search UI script (inline; uses the inlined lunr runtime + embedded index)
// ---------------------------------------------------------------------------

const SEARCH_UI_SCRIPT = [
  '<script>',
  '(function(){',
  '  function getParam(name){',
  '    try { return new URLSearchParams(window.location.search).get(name) || ""; }',
  '    catch(e){ return ""; }',
  '  }',
  '  function filePathToSlug(p){',
  '    return p.replace(/\\.(md|markdown|yaml|yml|json|txt)$/i,"")',
  '            .replace(/[^a-zA-Z0-9]/g,"-").replace(/-+/g,"-")',
  '            .replace(/^-+|-+$/g,"");',
  '  }',
  '  function escHtml(s){',
  '    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")',
  '            .replace(/>/g,"&gt;").replace(/"/g,"&quot;");',
  '  }',
  '  function doSearch(query){',
  '    var d = window.__ATLAS_SEARCH__;',
  '    if(!d) return [];',
  '    var docsMap = {};',
  '    d.docs.forEach(function(doc){ docsMap[doc.id] = doc; });',
  '    if(typeof lunr !== "undefined"){',
  '      try {',
  '        var idx = lunr.Index.load(d.index);',
  '        return idx.search(query).map(function(r){ return docsMap[r.ref]; }).filter(Boolean);',
  '      } catch(e){ /* fall through to substring scan */ }',
  '    }',
  '    var q = query.toLowerCase();',
  '    return d.docs.filter(function(doc){',
  '      return (doc.title + " " + (doc.body || "")).toLowerCase().indexOf(q) !== -1;',
  '    });',
  '  }',
  '  function renderResults(results, query){',
  '    var el = document.getElementById("search-results");',
  '    var st = document.getElementById("search-status");',
  '    if(!el) return;',
  '    if(!results.length){',
  '      if(st) st.textContent = "No results for \\u201c" + query + "\\u201d";',
  '      el.innerHTML = "";',
  '      return;',
  '    }',
  '    if(st) st.textContent = results.length + " result" + (results.length===1?"":"s") + " for \\u201c" + query + "\\u201d";',
  '    el.innerHTML = results.slice(0,50).map(function(doc){',
  '      var slug = doc.page || (doc.fileId ? filePathToSlug(doc.fileId) : "");',
  '      var href = slug ? ("docs/" + slug + ".html" + (doc.anchor ? "#" + doc.anchor : "")) : "#";',
  '      var html = "<li><a href=\\"" + href + "\\">" + escHtml(doc.title) + "</a>";',
  '      if(doc.kind) html += " <span class=\\"result-kind\\">" + escHtml(doc.kind) + "</span>";',
  '      if(doc.body) html += "<p>" + escHtml(doc.body.slice(0,140)) + "\\u2026</p>";',
  '      html += "</li>";',
  '      return html;',
  '    }).join("");',
  '  }',
  '  document.addEventListener("DOMContentLoaded", function(){',
  '    var inp = document.getElementById("search-input");',
  '    var btn = document.getElementById("search-btn");',
  '    var nojs = document.getElementById("nojs-fallback");',
  '    if(nojs) nojs.style.display = "none";',
  '    var q = getParam("q");',
  '    if(inp) inp.value = q;',
  '    if(q) renderResults(doSearch(q), q);',
  '    function onSearch(){',
  '      var q2 = inp ? inp.value.trim() : "";',
  '      if(!q2){ renderResults([], ""); return; }',
  '      try { history.replaceState({}, "", "search.html?q=" + encodeURIComponent(q2)); } catch(e){}',
  '      renderResults(doSearch(q2), q2);',
  '    }',
  '    if(btn) btn.addEventListener("click", onSearch);',
  '    if(inp) inp.addEventListener("keydown", function(e){',
  '      if(e.key === "Enter"){ e.preventDefault(); onSearch(); }',
  '    });',
  '  });',
  '})();',
  '</script>',
].join('\n');

// ---------------------------------------------------------------------------
// renderSearchPageHtml — standalone search.html
// ---------------------------------------------------------------------------

/**
 * Render the standalone search page. It inlines the design system CSS, the
 * vendored lunr runtime, the embedded index, and the search UI. It is fully
 * legible and navigable with zero JS (no-JS note + full document list).
 */
export function renderSearchPageHtml(
  manifest: KnowledgeManifest,
  docBodies: Map<string, string>,
  navFlags?: NavFlags,
): string {
  const { projectTitle, generatedAt } = manifest;
  const escapedTitle = esc(projectTitle);
  const escapedGeneratedAt = esc(generatedAt);

  const indexScript = buildSearchIndex(manifest, docBodies);

  // Vendored lunr runtime (inlined verbatim; empty under bare tsc typecheck).
  const lunrSrc = typeof __ATLAS_LUNR_JS__ === 'string' ? __ATLAS_LUNR_JS__ : '';
  const lunrRuntime = lunrSrc.length > 0 ? `<script>${lunrSrc}</script>` : '';

  // No-JS fallback: full document list (sorted by path via manifest order),
  // using the collision-free slug map so links match the written page names.
  const fallbackSlugMap = buildSlugMap(manifest.files.map(f => f.path));
  const fallbackItems = manifest.files.map((file) => {
    const slug = fallbackSlugMap.get(file.path) ?? filePathToSlug(file.path);
    const name = fileDisplayName(file.path);
    return `<li><a href="docs/${esc(slug)}.html">${esc(name)}</a> <span class="result-kind">${esc(file.type)}</span></li>`;
  });

  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Search — ${escapedTitle} Knowledge Atlas</title>`,
    `<meta name="description" content="Search the ${escapedTitle} Knowledge Atlas offline">`,
    '<style>',
    DESIGN_SYSTEM_CSS.trimEnd(),
    '</style>',
    '</head>',
    '<body class="page-type-search">',
    '<a href="#main-content" class="skip-link">Skip to content</a>',
    '<div class="page-wrap">',
    '<nav class="site-nav" aria-label="Site navigation">',
    `<a href="index.html" class="nav-brand">${escapedTitle}</a>`,
    buildNavLinksHtml('', navFlags, 'search'),
    '</nav>',
    '<main id="main-content" tabindex="-1">',
    '<div class="content-wrap">',
    '<h1>Search</h1>',
    '<div class="search-input-wrap">',
    '<input type="search" id="search-input" placeholder="Search documents and entities…" aria-label="Search query" autofocus>',
    '<button id="search-btn" type="button">Search</button>',
    '</div>',
    '<p id="search-status" aria-live="polite"></p>',
    '<ul id="search-results" aria-label="Search results"></ul>',
    '<div id="nojs-fallback">',
    '<p class="no-js-note">Search requires JavaScript. All documents are listed below and remain fully navigable.</p>',
    '<ul class="doc-list">',
    ...fallbackItems,
    '</ul>',
    '</div>',
    '</div>',
    '</main>',
    `<footer class="atlas-footer" role="contentinfo">Knowledge Atlas · Generated at: ${escapedGeneratedAt}</footer>`,
    '</div>',
    indexScript,
    lunrRuntime,
    SEARCH_UI_SCRIPT,
    '</body>',
    '</html>',
    '', // trailing newline
  ];

  return lines.join('\n');
}
