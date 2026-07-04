/**
 * lib/knowledge-atlas/src/render/design-system.ts
 * ---------------------------------------------------------------------------
 * Story 29.3 — Shared design system tokens for the Knowledge Atlas renderer.
 *
 * STABLE EXPORTS — 29.4 imports DESIGN_SYSTEM_CSS and STATUS_COLORS from here.
 * Do not rename these exports.
 *
 * Constraints:
 *   - System fonts ONLY (no web fonts, no CDN references)
 *   - No external URLs whatsoever
 *   - prefers-reduced-motion respected
 *   - Accessible color contrast for all status tokens
 */

// ---------------------------------------------------------------------------
// Status color map
// ---------------------------------------------------------------------------

/**
 * Maps BMAD lifecycle status names to CSS color values.
 * Used both in the CSS custom properties and in JS rendering logic.
 */
export const STATUS_COLORS: Record<string, string> = {
  'backlog':       '#5c6a7a',
  'ready':         '#1565c0',
  'ready-for-dev': '#1565c0',
  'in-progress':   '#e65100',
  'review':        '#6a1b9a',
  'done':          '#2e7d32',
  'blocked':       '#b71c1c',
};

/**
 * Maps BMAD lifecycle status names to wash (background) CSS color values.
 */
export const STATUS_WASH_COLORS: Record<string, string> = {
  'backlog':       '#f1f4f8',
  'ready':         '#e3f2fd',
  'ready-for-dev': '#e3f2fd',
  'in-progress':   '#fff3e0',
  'review':        '#f3e5f5',
  'done':          '#e8f5e9',
  'blocked':       '#ffebee',
};

// ---------------------------------------------------------------------------
// Comprehensive design system CSS
// ---------------------------------------------------------------------------

export const DESIGN_SYSTEM_CSS: string = `\
/* Knowledge Atlas — design system (Story 29.3) */
/* NO external URLs, NO web fonts, system font stack only. */

:root {
  /* Core color tokens */
  --ink:         #1a1a2e;
  --paper:       #f8f9fb;
  --surface:     #ffffff;
  --surface-alt: #f1f4f8;
  --ok:          #2e7d32;
  --warn:        #e65100;
  --gap:         1rem;
  --ink-wash:    #5c6a7a;
  --accent:      #00897b;
  --accent-dk:   #00695c;
  --border:      #d0d9e4;
  --radius:      6px;
  --font:        system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;

  /* Status colors */
  --status-backlog:     #5c6a7a;
  --status-backlog-wash:#f1f4f8;
  --status-ready:       #1565c0;
  --status-ready-wash:  #e3f2fd;
  --status-in-progress: #e65100;
  --status-in-progress-wash: #fff3e0;
  --status-review:      #6a1b9a;
  --status-review-wash: #f3e5f5;
  --status-done:        #2e7d32;
  --status-done-wash:   #e8f5e9;
  --status-blocked:     #b71c1c;
  --status-blocked-wash:#ffebee;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Skip link for accessibility */
.skip-link {
  position: absolute;
  top: -3rem;
  left: 0;
  background: var(--accent);
  color: #fff;
  padding: 0.5rem 1rem;
  text-decoration: none;
  border-radius: 0 0 var(--radius) 0;
  z-index: 1000;
  font-family: var(--font);
  font-size: 0.9rem;
  transition: top 0.2s;
}
.skip-link:focus {
  top: 0;
}

/* FR223 — smooth scrolling for in-page anchor jumps (TOC, backlinks, orphan
   summary links). Guarded below by prefers-reduced-motion. */
html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font);
  background: var(--paper);
  color: var(--ink);
  line-height: 1.6;
  font-size: 1rem;
}

/* ── Type scale ─────────────────────────────────────────────────────────── */

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font);
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
}

h1 { font-size: 1.75rem; letter-spacing: -0.03em; }
h2 { font-size: 1.35rem; letter-spacing: -0.02em; margin-top: 1.5rem; margin-bottom: 0.5rem; }
h3 { font-size: 1.1rem; letter-spacing: -0.01em; margin-top: 1.25rem; margin-bottom: 0.4rem; }
h4 { font-size: 1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.3rem; }
h5 { font-size: 0.9rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.25rem; }
h6 { font-size: 0.85rem; font-weight: 600; color: var(--ink-wash); margin-top: 0.5rem; }

p {
  margin-bottom: 0.75rem;
  max-width: 68ch;
}

a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.15s, color 0.15s;
}
a:hover, a:focus {
  color: var(--accent-dk);
  text-decoration-color: var(--accent-dk);
}

ul, ol {
  margin-left: 1.5rem;
  margin-bottom: 0.75rem;
}
li { margin-bottom: 0.2rem; }

code {
  font-family: ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 0.875em;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.1em 0.35em;
  color: var(--accent-dk);
}

pre {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  overflow-x: auto;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  line-height: 1.55;
}
pre code {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

/* Mono eyebrow labels */
.eyebrow {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-wash);
  display: block;
  margin-bottom: 0.25rem;
}

/* Tabular numerics */
.tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

.page-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-nav {
  background: var(--accent);
  padding: 0 calc(var(--gap) * 1.5);
  display: flex;
  align-items: center;
  gap: var(--gap);
  height: 3rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}

.site-nav a {
  color: rgba(255,255,255,0.92);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.15s;
}
.site-nav a:hover, .site-nav a:focus {
  background: rgba(255,255,255,0.15);
  color: #fff;
  text-decoration: none;
}

.site-nav .nav-brand {
  font-weight: 700;
  font-size: 0.95rem;
  margin-right: auto;
}

/* Search form in nav */
.nav-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.nav-search input[type="search"] {
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.12);
  color: #fff;
  border-radius: 4px;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  font-family: var(--font);
  width: 12rem;
  outline: none;
  transition: background 0.15s, border-color 0.15s;
}
.nav-search input[type="search"]::placeholder { color: rgba(255,255,255,0.55); }
.nav-search input[type="search"]:focus {
  background: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.6);
}
.nav-search button {
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  border-radius: 4px;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  font-family: var(--font);
  cursor: pointer;
  transition: background 0.15s;
}
.nav-search button:hover { background: rgba(255,255,255,0.28); }

/* Hero banner */
.hero {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dk) 100%);
  color: #fff;
  padding: calc(var(--gap) * 2.5) calc(var(--gap) * 2);
}
.hero h1 {
  color: #fff;
  font-size: 2rem;
  letter-spacing: -0.04em;
  margin-bottom: 0.4rem;
}
.hero .subtitle {
  font-size: 1rem;
  opacity: 0.85;
  max-width: 60ch;
}

/* Main content area */
.content-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: calc(var(--gap) * 1.5) var(--gap);
  width: 100%;
  flex: 1;
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.25);
  margin-bottom: var(--gap);
}
.card h2, .card h3 {
  color: var(--accent-dk);
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  text-align: center;
}
.stat-card .stat-num {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
  display: block;
  font-variant-numeric: tabular-nums;
}
.stat-card .stat-label {
  font-size: 0.8rem;
  color: var(--ink-wash);
}

/* ── Status pill/badge ──────────────────────────────────────────────────── */

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.15em 0.6em;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  vertical-align: middle;
}

.status-pill.status-backlog     { background: var(--status-backlog-wash);     color: var(--status-backlog); }
.status-pill.status-ready       { background: var(--status-ready-wash);       color: var(--status-ready); }
.status-pill.status-ready-for-dev { background: var(--status-ready-wash);     color: var(--status-ready); }
.status-pill.status-in-progress { background: var(--status-in-progress-wash); color: var(--status-in-progress); }
.status-pill.status-review      { background: var(--status-review-wash);      color: var(--status-review); }
.status-pill.status-done        { background: var(--status-done-wash);        color: var(--status-done); }
.status-pill.status-blocked     { background: var(--status-blocked-wash);     color: var(--status-blocked); }

/* ── Table ──────────────────────────────────────────────────────────────── */

.atlas-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}
.atlas-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: var(--surface-alt);
  border-bottom: 2px solid var(--border);
  color: var(--ink-wash);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.atlas-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.atlas-table tbody tr:hover { background: var(--surface-alt); }
.atlas-table-wrap { overflow-x: auto; }

/* ── Callout box ────────────────────────────────────────────────────────── */

.callout {
  border-left: 4px solid var(--accent);
  background: var(--surface-alt);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.callout.callout-warn  { border-color: var(--warn);  background: var(--status-in-progress-wash); }
.callout.callout-ok    { border-color: var(--ok);    background: var(--status-done-wash); }
.callout.callout-error { border-color: var(--status-blocked); background: var(--status-blocked-wash); }

/* ── Mermaid diagrams ───────────────────────────────────────────────────── */

.mermaid {
  overflow-x: auto;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 1rem;
  min-height: 2rem;
}
.mermaid-fallback {
  background: #f8f9fb;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  color: var(--ink-wash);
  margin-bottom: 1rem;
}

/* ── Back-link navigation ───────────────────────────────────────────────── */

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--ink-wash);
  text-decoration: none;
  margin-bottom: 1rem;
  transition: color 0.15s;
}
.back-link:hover, .back-link:focus {
  color: var(--accent);
  text-decoration: none;
}

/* ── Backlinks section ──────────────────────────────────────────────────── */

.backlinks-section {
  border-top: 1px solid var(--border);
  margin-top: 2rem;
  padding-top: 1rem;
}
.backlinks-section h3 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--ink-wash);
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.backlinks-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.backlinks-list li {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}
/* Non-clickable backlink source (no rendered page): muted, not a link. */
.backlink-dangling {
  color: var(--ink-wash);
  text-decoration: none;
  cursor: default;
}

/* ── Table of contents ──────────────────────────────────────────────────── */

.toc {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  max-width: 36rem;
}
.toc-title {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-wash);
  margin-bottom: 0.5rem;
}
.toc ol, .toc ul { margin: 0 0 0 1.25rem; padding: 0; }
.toc li { margin-bottom: 0.15rem; }
.toc a { color: var(--accent-dk); text-decoration: none; }
.toc a:hover { text-decoration: underline; }

/* ── Document body content ─────────────────────────────────────────────── */

.doc-body h1 { margin-top: 0; margin-bottom: 1rem; }
.doc-body h2 { padding-top: 0.5rem; border-top: 1px solid var(--border); }
.doc-body blockquote {
  border-left: 4px solid var(--border);
  margin-left: 0;
  padding-left: 1rem;
  color: var(--ink-wash);
  font-style: italic;
}
.doc-body table { font-size: 0.875rem; border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
.doc-body table th, .doc-body table td {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  text-align: left;
}
.doc-body table th { background: var(--surface-alt); font-weight: 600; }
.doc-body table tr:hover td { background: var(--surface-alt); }
.doc-body img { max-width: 100%; border-radius: var(--radius); }
.doc-body hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

/* ── Search page ────────────────────────────────────────────────────────── */

.search-input-wrap {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
#search-input {
  flex: 1;
  padding: 0.6rem 0.9rem;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font);
  font-size: 1rem;
  background: var(--surface);
  color: var(--ink);
  outline: none;
  transition: border-color 0.15s;
}
#search-input:focus { border-color: var(--accent); }
#search-btn {
  padding: 0.6rem 1.2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
#search-btn:hover { background: var(--accent-dk); }
#search-results { list-style: none; margin: 0; padding: 0; }
#search-results li {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
}
#search-results li a { font-weight: 600; }
#search-results li .result-kind {
  font-size: 0.75rem;
  color: var(--ink-wash);
  margin-left: 0.5rem;
  font-family: ui-monospace, Consolas, monospace;
}
#search-results li p {
  font-size: 0.85rem;
  color: var(--ink-wash);
  margin: 0.25rem 0 0;
  max-width: none;
}
#search-status { font-size: 0.875rem; color: var(--ink-wash); margin-bottom: 0.75rem; }

/* ── Footer ─────────────────────────────────────────────────────────────── */

footer {
  margin-top: auto;
  font-size: 0.8rem;
  color: var(--ink-wash);
  text-align: center;
  border-top: 1px solid var(--border);
  padding: var(--gap) calc(var(--gap) * 2);
  background: var(--surface);
}

/* ── Responsive ─────────────────────────────────────────────────────────── */

@media (max-width: 680px) {
  .site-nav { gap: 0.5rem; height: auto; padding: 0.5rem 1rem; flex-wrap: wrap; }
  .hero { padding: 1.5rem 1rem; }
  .hero h1 { font-size: 1.5rem; }
  .content-wrap { padding: 1rem 0.75rem; }
  .card-grid { grid-template-columns: 1fr; }
  .nav-search input[type="search"] { width: 8rem; }
  p { max-width: 100%; }
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
