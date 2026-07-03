/**
 * lib/knowledge-atlas/src/render/design-system.ts
 * ---------------------------------------------------------------------------
 * Story 29.4 — MINIMAL STUB for co-owned design system.
 *
 * *** CO-OWNERSHIP NOTE ***
 * This file is OWNED by Story 29.3. At merge, 29.3's richer version WINS.
 * All 29.4 pages import `DESIGN_SYSTEM_CSS` by this exact name — do not rename.
 *
 * This stub exports the same CSS token set that is currently inlined in
 * generate.ts (Story 29.1 seed) so that the 29.4 branch builds and tests
 * without requiring 29.3's merge.
 *
 * Rule: NO external URLs, NO web fonts, system font stack only.
 * ---------------------------------------------------------------------------
 */

/** Shared design-system CSS (token set seeded by Story 29.1 in generate.ts). */
export const DESIGN_SYSTEM_CSS = `\
/* Knowledge Atlas — design system tokens (Story 29.1 seed / 29.4 stub) */
:root {
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
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--paper);
  color: var(--ink);
  line-height: 1.6;
  padding: var(--gap);
}

header {
  background: var(--accent);
  color: #fff;
  padding: calc(var(--gap) * 1.5) calc(var(--gap) * 2);
  border-radius: var(--radius);
  margin-bottom: calc(var(--gap) * 1.5);
}

header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

header .subtitle {
  font-size: 0.9rem;
  opacity: 0.85;
  margin-top: 0.25rem;
}

header nav {
  margin-top: 0.75rem;
  font-size: 0.9rem;
}

header nav a {
  color: rgba(255,255,255,0.9);
  text-decoration: none;
  margin-right: 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.4);
  padding-bottom: 1px;
}

header nav a:hover {
  color: #fff;
  border-bottom-color: #fff;
}

main {
  max-width: 1100px;
  margin: 0 auto;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.25);
  margin-bottom: var(--gap);
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent-dk);
  margin-bottom: 0.5rem;
}

.meta {
  font-size: 0.85rem;
  color: var(--ink-wash);
}

footer {
  margin-top: calc(var(--gap) * 2);
  font-size: 0.8rem;
  color: var(--ink-wash);
  text-align: center;
  border-top: 1px solid var(--border);
  padding-top: var(--gap);
}
`;
