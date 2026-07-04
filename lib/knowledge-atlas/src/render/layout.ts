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

/**
 * Which of the 29.4 pages (graph.html / diagrams.html / orphans.html) exist
 * in this build, so the shared nav can link to them without producing a dead
 * link. Search and Home always exist (renderSite always writes both), so they
 * need no flag. Callers compute these via `fs.existsSync` against outDir —
 * 29.4 pages are always written BEFORE the 29.3/site pages that consume this
 * (see generate.ts), so the check is reliable by the time any of these pages
 * render (SHOULD-FIX #2).
 */
export interface NavFlags {
  hasGraphPage: boolean;
  hasDiagramsPage: boolean;
  hasOrphansPage: boolean;
}

const NO_NAV_FLAGS: NavFlags = { hasGraphPage: false, hasDiagramsPage: false, hasOrphansPage: false };

/**
 * Build the shared list of site nav `<a>` links: Home · Graph · Diagrams ·
 * Orphans · Search — in that order, every page type includes the same set
 * (SHOULD-FIX #2: previously the 29.4 pages hand-rolled a divergent nav that
 * omitted Search, and document/home/search pages omitted Graph/Diagrams/
 * Orphans entirely, leaving diagrams.html/orphans.html unreachable from home
 * or any reading/search page). Graph/Diagrams/Orphans links are included only
 * when that page actually exists in this build (see NavFlags above); Home and
 * Search are unconditional.
 *
 * `current` marks the active page with aria-current="page" for a11y and is
 * purely cosmetic — omit it for hand-rolled pages that don't track it.
 */
export function buildNavLinksHtml(
  baseHref: string,
  flags: NavFlags = NO_NAV_FLAGS,
  current?: 'home' | 'graph' | 'diagrams' | 'orphans' | 'search' | 'document',
): string {
  const base = esc(baseHref);
  const link = (href: string, label: string, key: NonNullable<typeof current>): string => {
    const aria = current === key ? ' aria-current="page"' : '';
    return `<a href="${base}${href}"${aria}>${label}</a>`;
  };
  const links: string[] = [link('index.html', 'Home', 'home')];
  if (flags.hasGraphPage) links.push(link('graph.html', 'Graph', 'graph'));
  if (flags.hasDiagramsPage) links.push(link('diagrams.html', 'Diagrams', 'diagrams'));
  if (flags.hasOrphansPage) links.push(link('orphans.html', 'Orphans', 'orphans'));
  links.push(link('search.html', 'Search', 'search'));
  return links.join('\n');
}

export interface PageShellOpts {
  title: string;
  body: string;
  /** Optional extra nav items HTML (appended after the shared nav links). */
  nav?: string;
  /** Which 29.4 pages exist, so the shared nav can include Graph/Diagrams/Orphans. */
  navFlags?: NavFlags;
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
  const { title, body, manifest, pageType = 'home', scripts = [], nav, navFlags, baseHref = '' } = opts;
  const { projectTitle, generatedAt } = manifest;

  const escapedTitle = esc(title);
  const escapedProjectTitle = esc(projectTitle);
  const escapedGeneratedAt = esc(generatedAt);
  const escapedBase = esc(baseHref);
  const bodyClass = `page-type-${pageType}`;

  const navCurrent = pageType === 'home' ? 'home' : pageType === 'search' ? 'search' : 'document';
  const navLinksHtml = buildNavLinksHtml(baseHref, navFlags, navCurrent);
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
    navLinksHtml,
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
