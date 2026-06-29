/**
 * lib/knowledge-atlas/src/generate.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — Core generate() function: discovery → manifest → render.
 *
 * Architecture invariants (Decision P5-7):
 *   - Write ONLY under `_bmad-output/knowledge-site/`. Never touch source.
 *   - No network access. Node built-ins + esbuild-inlined modules only.
 *   - LF output throughout (never emit CRLF into the HTML).
 *   - Deterministic: identical inputs + pinned SOURCE_DATE_EPOCH → byte-identical output.
 *
 * Discovery ↔ rendering seam:
 *   buildManifest() is the discovery half; renderHtml() is the rendering half.
 *   Story 29.2 extends buildManifest() (adds scan of _bmad-output).
 *   Story 29.3+ extend renderHtml() with richer views.
 *   Neither half reaches into the other's domain.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GenerateOptions, GenerateResult, KnowledgeManifest } from './types';

// ---------------------------------------------------------------------------
// Timestamp resolution — NFR62 determinism contract
// ---------------------------------------------------------------------------

/**
 * Maximum absolute millisecond value the ECMAScript Date type can represent
 * (±100,000,000 days from the epoch — see ECMA-262 "Time Values and Time Range").
 * A value outside this range makes `new Date(ms)` an Invalid Date, whose
 * `toISOString()` throws `RangeError: Invalid time value`. We bounds-check
 * against it so a hostile/typo'd SOURCE_DATE_EPOCH degrades gracefully to the
 * wall clock instead of crashing the whole generate run.
 */
const MAX_TIME_VALUE_MS = 8640000000000000;

/**
 * Resolve the "generated at" timestamp with this precedence:
 *   1. opts.now (caller-supplied override — used by tests and 29.6 gate)
 *   2. process.env.SOURCE_DATE_EPOCH (CI/reproducible-builds convention, seconds)
 *   3. current wall-clock time
 *
 * The result is always an ISO-8601 string with second precision (no sub-second
 * component) so the same SOURCE_DATE_EPOCH value produces byte-identical output
 * regardless of when the build runs.
 *
 * Robustness (edge-case hunter):
 *   - A `now` value that resolves to an Invalid Date throws a CLEAR error
 *     naming the offending value (not a cryptic RangeError deep in toISOString).
 *   - A numeric-string `now` (e.g. "1700000000") is treated as Unix SECONDS,
 *     the same domain as SOURCE_DATE_EPOCH, so CLI/string callers and the env
 *     var agree.
 *   - An out-of-range / non-numeric SOURCE_DATE_EPOCH falls through to the wall
 *     clock rather than emitting an Invalid Date.
 */
function resolveTimestamp(now?: Date | string | number): string {
  if (now !== undefined && now !== null) {
    let d: Date;
    if (now instanceof Date) {
      d = now;
    } else if (typeof now === 'number') {
      // Numbers are Unix seconds (same domain as SOURCE_DATE_EPOCH).
      d = new Date(now * 1000);
    } else if (/^\d+$/.test(now.trim())) {
      // A bare digit string is Unix seconds, matching SOURCE_DATE_EPOCH.
      d = new Date(parseInt(now.trim(), 10) * 1000);
    } else {
      // Otherwise treat as an ISO-8601 (or other Date-parseable) string.
      d = new Date(now);
    }
    if (!isValidDate(d)) {
      throw new Error(
        `generate: invalid \`now\` value: ${JSON.stringify(now)} — ` +
        `provide a Date, an ISO-8601 string, or Unix seconds.`,
      );
    }
    return isoSecond(d);
  }

  const epoch = process.env['SOURCE_DATE_EPOCH'];
  if (epoch) {
    const secs = parseInt(epoch, 10);
    // Reject NaN, negatives, and values that overflow the Date time range —
    // any of these would otherwise produce an Invalid Date.
    if (!isNaN(secs) && secs >= 0 && secs * 1000 <= MAX_TIME_VALUE_MS) {
      const d = new Date(secs * 1000);
      if (isValidDate(d)) {
        return isoSecond(d);
      }
    }
    // Fall through to wall clock on any invalid SOURCE_DATE_EPOCH.
  }

  return isoSecond(new Date());
}

/** True iff `d` is a valid Date (not an Invalid Date sentinel). */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

/** Truncate a Date to second precision and return ISO-8601 (no ms component). */
function isoSecond(d: Date): string {
  // toISOString() returns "…T…Z"; strip the milliseconds part.
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// Project title derivation
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable project title:
 *   1. `name` field in `<projectRoot>/package.json` (if it exists and is a string)
 *   2. Basename of projectRoot as fallback
 *   3. `'Unknown Project'` when the basename is empty (e.g. a filesystem root
 *      like `/` or `C:\`) so the <title>/<h1> are never blank.
 */
function deriveProjectTitle(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pkg['name'] === 'string' && pkg['name'].trim()) {
        return pkg['name'].trim();
      }
    }
  } catch {
    // Non-fatal: fall through to basename
  }
  const base = path.basename(projectRoot).trim();
  return base.length > 0 ? base : 'Unknown Project';
}

// ---------------------------------------------------------------------------
// Discovery half: buildManifest()
// Story 29.2 extends this with actual _bmad-output scanning.
// ---------------------------------------------------------------------------

function buildManifest(
  projectRoot: string,
  bmadOutputDir: string,
  generatedAt: string,
): KnowledgeManifest {
  return {
    projectTitle: deriveProjectTitle(projectRoot),
    generatedAt,
    projectRoot,
    bmadOutputDir,
  };
}

// ---------------------------------------------------------------------------
// Design-system CSS tokens (seeded for 29.3 extension)
//
// Token inventory mirrors the brief-knowledge-atlas-2026-06-27 design reference:
//   --ink         text
//   --paper       page background
//   --surface     card / panel background
//   --ok          success / green accent
//   --warn        warning / amber accent
//   --gap         spacing unit
//   --ink-wash    muted text
//   --surface-alt alternate surface (hover, zebra)
//   --accent      teal primary accent
//   --accent-dk   darker teal (hover)
//
// Rule: NO external URLs, NO web fonts, system font stack only.
// NO <script> in this story (29.3 may add vendored JS, never CDN).
// ---------------------------------------------------------------------------

const CSS = `\
/* Knowledge Atlas — design system tokens (Story 29.1 seed) */
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

main {
  max-width: 900px;
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

// ---------------------------------------------------------------------------
// Rendering half: renderHtml()
// Produces a fully self-contained HTML document — no external URLs,
// no <script src>, no web fonts.
// ---------------------------------------------------------------------------

function renderHtml(manifest: KnowledgeManifest): string {
  const { projectTitle, generatedAt } = manifest;

  // Escape user-supplied strings for HTML
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const title = esc(projectTitle);

  // LF-normalized: join lines with \n, never \r\n
  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${title} — Knowledge Atlas</title>`,
    `<meta name="description" content="Knowledge Atlas for ${title}">`,
    '<style>',
    CSS.trimEnd(),
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<h1>${title}</h1>`,
    `<p class="subtitle">Knowledge Atlas</p>`,
    '</header>',
    '<main>',
    '<div class="card">',
    '<h2>Project</h2>',
    `<p class="meta">Title: ${title}</p>`,
    '</div>',
    '<div class="card">',
    '<h2>Generation</h2>',
    `<p class="meta">Generated at: ${esc(generatedAt)}</p>`,
    '</div>',
    '</main>',
    '<footer>',
    `Knowledge Atlas &bull; generated at ${esc(generatedAt)}`,
    '</footer>',
    '</body>',
    '</html>',
    '', // trailing newline
  ];

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API: generate()
// ---------------------------------------------------------------------------

/**
 * Generate the Knowledge Atlas site for a project.
 *
 * Writes ONLY under `_bmad-output/knowledge-site/`.
 * Returns a GenerateResult describing what was written.
 */
export function generate(opts: GenerateOptions): GenerateResult {
  const { projectRoot, outDir: outDirOverride } = opts;

  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new Error('generate: projectRoot is required and must be a non-empty string');
  }

  // Edge-case (hunter #8): projectRoot must be an absolute path to an EXISTING
  // directory. Otherwise a typo'd root would silently `mkdirSync` a whole tree
  // under garbage — non-destructive-isolated-output invariant demands we fail
  // loud instead. (The CLI always passes a path.resolve()'d argument.)
  if (!path.isAbsolute(projectRoot)) {
    throw new Error(`generate: projectRoot must be an absolute path (got: ${projectRoot})`);
  }
  const rootStat = fs.statSync(projectRoot, { throwIfNoEntry: false });
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`generate: projectRoot does not exist or is not a directory: ${projectRoot}`);
  }

  const bmadOutputDir = path.join(projectRoot, '_bmad-output');
  const outDir = outDirOverride ?? path.join(bmadOutputDir, 'knowledge-site');

  // Safety (hunter #7): ALWAYS enforce that the resolved outDir stays under
  // projectRoot — including when the caller supplied `--out`/outDir. The CLI's
  // `--out` flows straight here, so skipping the guard for overrides was a
  // write-anywhere hole. `path.relative` of a sibling/parent starts with ".."
  // and of a different drive (Windows) is absolute.
  const rel = path.relative(projectRoot, outDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`generate: outDir escapes projectRoot: ${outDir}`);
  }

  // Resolve the timestamp (NFR62 determinism)
  const generatedAt = resolveTimestamp(opts.now);

  // Discovery half
  const manifest = buildManifest(projectRoot, bmadOutputDir, generatedAt);

  // Rendering half
  const html = renderHtml(manifest);

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Write index.html with LF line endings (normalize, just in case)
  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, html.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });

  return {
    outDir,
    indexPath,
    fileCount: 1,
  };
}
