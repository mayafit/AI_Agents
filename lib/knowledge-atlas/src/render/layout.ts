/**
 * lib/knowledge-atlas/src/render/layout.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — HTML page shell for the Knowledge Atlas site.
 *
 * The shell:
 *   - Inlines DESIGN_SYSTEM_CSS (no external CSS)
 *   - Includes a skip-to-content link for accessibility
 *   - Provides site navigation with Home + Search links
 *   - Provides a plain <form> search box linking to search.html (no JS)
 *   - Wraps body in <main id="main-content">
 *   - Includes <footer> with generation timestamp
 *   - Progressive enhancement: legible with zero JS
 *   - No <script> tags in home/shell (home page must pass 29.1 smoke test)
 *   - ARIA roles on landmarks
 *   - LF endings throughout
 */

import { DESIGN_SYSTEM_CSS } from './design-system.js';
import type { KnowledgeManifest } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageShellOpts {
  title: string;
  body: string;
  /** Optional extra nav items HTML (appended after default nav links). */
  nav?: string;
  manifest: KnowledgeManifest;
  /** Affects body class for per-page styling. */
  pageType?: 'home' | 'document' | 'search';
  /**
   * Site-root-relative prefix for nav/search links, so pages in subdirectories
   * link correctly. Root pages (index.html, search.html) pass "" (default);
   * document pages under docs/ pass "../". Without this, a reading view's Home
   * link resolves to docs/index.html → 404.
   */
  baseHref?: string;
  /**
   * Extra <script> blocks to inject before </body>.
   * These are ONLY used by document and search pages — never by the home page.
   * Each string must be a complete <script>...</script> block.
   * The home page MUST NOT pass any scripts (29.1 smoke test constraint).
   */
  scripts?: string[];
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Search box — plain HTML form, no JS required
// ---------------------------------------------------------------------------

export function renderSearchBoxHtml(baseHref = ''): string {
  // A plain HTML form that GETs <baseHref>search.html?q=... — works without JS.
  return [
    `<form class="nav-search" action="${esc(baseHref)}search.html" method="get" role="search" aria-label="Site search">`,
    '<input type="search" name="q" placeholder="Search…" aria-label="Search">',
    '<button type="submit">Go</button>',
    '</form>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function pageShell(opts: PageShellOpts): string {
  const { title, body, manifest, pageType = 'home', scripts = [], nav, baseHref = '' } = opts;
  const { projectTitle, generatedAt } = manifest;

  const escapedTitle = esc(title);
  const escapedProjectTitle = esc(projectTitle);
  const escapedGeneratedAt = esc(generatedAt);
  const escapedBase = esc(baseHref);
  const bodyClass = `page-type-${pageType}`;

  const navExtras = nav ? `\n${nav}` : '';
  const scriptBlocks = scripts.length > 0 ? `\n${scripts.join('\n')}` : '';

  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapedTitle} — ${escapedProjectTitle} Knowledge Atlas</title>`,
    `<meta name="description" content="Knowledge Atlas: ${escapedTitle} — ${escapedProjectTitle}">`,
    '<style>',
    DESIGN_SYSTEM_CSS.trimEnd(),
    '</style>',
    '</head>',
    '<body>',
    `<div class="page-body ${bodyClass}">`,
    '<a href="#main-content" class="skip-link">Skip to content</a>',
    '<div class="page-wrap">',
    '<nav class="site-nav" aria-label="Site navigation">',
    `<a href="${escapedBase}index.html" class="nav-brand">${escapedProjectTitle}</a>`,
    `<a href="${escapedBase}index.html">Home</a>`,
    `<a href="${escapedBase}search.html">Search</a>`,
    navExtras,
    renderSearchBoxHtml(baseHref),
    '</nav>',
    '<main id="main-content" tabindex="-1">',
    body,
    '</main>',
    '<footer role="contentinfo">',
    `Knowledge Atlas · Generated at: ${escapedGeneratedAt}`,
    '</footer>',
    '</div>',
    scriptBlocks,
    '</div>',
    '</body>',
    '</html>',
    '', // trailing newline
  ];

  return lines.join('\n');
}
