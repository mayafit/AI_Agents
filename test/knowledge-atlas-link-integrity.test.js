#!/usr/bin/env node
/**
 * test/knowledge-atlas-link-integrity.test.js
 * ---------------------------------------------------------------------------
 * Epic 29 bug fix — link-integrity regression tests.
 *
 * CONFIRMED BUG (shipped): diagrams.html, orphans.html, and graph.html built
 * entity hyperlinks from the RAW manifest `fileId` (the source `.md` path in
 * the project) instead of the RENDERED doc-page path the site actually serves
 * (`docs/<slug>.html`, computed by the Story 29.3 resolver in
 * lib/knowledge-atlas/src/render/paths.ts). Every link in the traceability
 * spine, the knowledge graph, and the orphan view pointed at a non-existent
 * `_bmad-output/.../file.md#anchor` path and opened an empty/404 page.
 *
 * This suite proves the fix by asserting hrefs/pages ACTUALLY RESOLVE to files
 * that exist in the generated static site — a coverage class that was
 * entirely missing from the existing suites (they checked structure/content
 * but never that a link's target file exists on disk).
 *
 * Test style: plain Node assert (no framework), matching
 * test/knowledge-atlas-graph.test.js.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ATLAS_CJS = path.join(__dirname, '..', 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const AUTHORED_LINKS_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'authored-links-project');

// Pin SOURCE_DATE_EPOCH for determinism (NFR62)
const PINNED_EPOCH = '1700000000'; // 2023-11-14T22:13:20Z

// A raw source-path href/page is never a valid navigation target in the
// generated site — this is exactly the shape of the shipped bug.
const RAW_SOURCE_PATTERN = /_bmad-output\/.*\.md/;

// ─── Test harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const tempDirs = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

/** Copy a directory tree recursively. */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Create a temp dir, track for cleanup. */
function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-linkfix-${prefix}-`));
  tempDirs.push(d);
  return d;
}

/** Run atlas.cjs against a projectRoot with pinned epoch. Returns parsed manifest.json. */
function runAtlas(projectRoot) {
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );
  if (result.error) throw new Error(`atlas.cjs failed to run: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`atlas.cjs exited ${result.status}\nstdout:${result.stdout}\nstderr:${result.stderr}`);
  }
  const manifestPath = path.join(projectRoot, '_bmad-output', 'knowledge-site', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not written: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

/** Read a generated HTML file from the knowledge-site output dir. */
function readSiteFile(siteDir, relPath) {
  const p = path.join(siteDir, relPath);
  if (!fs.existsSync(p)) throw new Error(`Generated file not found: ${p}`);
  return fs.readFileSync(p, 'utf-8');
}

/** Recursively collect all .html files under a directory, as site-root-relative POSIX paths. */
function collectHtmlFiles(siteDir) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        results.push(path.relative(siteDir, full).split(path.sep).join('/'));
      }
    }
  };
  walk(siteDir);
  return results.sort();
}

/**
 * Extract every `href="..."` attribute value from an HTML string, in order.
 * Only <a> elements in this codebase use `href` (forms use `action`), so a
 * generic attribute scan is sufficient and doesn't need tag-aware parsing.
 */
function extractHrefs(html) {
  const hrefs = [];
  const re = /href="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/** True if `href` targets something outside this site (external URL, mailto, etc.) or is a same-page fragment. */
function isNonInternalHref(href) {
  if (!href) return true;
  if (href.startsWith('#')) return true; // same-page fragment only
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(href)) return true; // scheme (http:, mailto:, javascript:, etc.)
  if (href.startsWith('//')) return true; // protocol-relative
  return false;
}

/**
 * Resolve `href` (found inside `pageRelPath`, a site-root-relative path such
 * as "diagrams.html" or "docs/x.html") to a site-root-relative path, handling
 * "../" the way a browser would. Anchor suffix is stripped by the caller.
 */
function resolveHrefAgainstPage(pageRelPath, href) {
  const pageDir = pageRelPath.includes('/') ? pageRelPath.slice(0, pageRelPath.lastIndexOf('/')) : '';
  const joined = pageDir ? `${pageDir}/${href}` : href;
  const stack = [];
  for (const part of joined.split('/')) {
    if (part === '..') stack.pop();
    else if (part === '.' || part === '') continue;
    else stack.push(part);
  }
  return stack.join('/');
}

/**
 * Extract the embedded `window.__ATLAS_GRAPH__ = {...}` JS object from
 * graph.html, using brace-matching that respects JSON string literals (a ';'
 * inside a label would otherwise truncate the parse at the first ';').
 */
function extractAtlasGraph(html) {
  const marker = 'window.__ATLAS_GRAPH__ = ';
  const start = html.indexOf(marker);
  assert.ok(start >= 0, 'graph.html must contain window.__ATLAS_GRAPH__ = ...');
  const objStart = html.indexOf('{', start + marker.length);
  assert.ok(objStart >= 0, 'could not find opening { of __ATLAS_GRAPH__ object');

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = objStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; }
    else if (ch === '{') { depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.ok(end > objStart, 'could not find matching } of __ATLAS_GRAPH__ object');
  return JSON.parse(html.slice(objStart, end + 1));
}

// ─── Pre-conditions ──────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Link Integrity Tests (Epic 29 bug fix) ===');

console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists and is non-empty', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('rich-project fixture exists', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
});

// ─── Setup: generate against rich-project fixture ───────────────────────────
console.log('\n--- Setup: generate rich-project ---');

let siteDir;
let manifest;
let diagramsHtml;
let orphansHtml;
let graphHtml;

test('generate rich-project (temp copy)', () => {
  const tmpProject = makeTempDir('rich');
  copyDirRecursive(RICH_FIXTURE, tmpProject);
  manifest = runAtlas(tmpProject);
  siteDir = path.join(tmpProject, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(siteDir), 'knowledge-site output dir must exist');
});

test('diagrams.html / orphans.html / graph.html are generated', () => {
  diagramsHtml = readSiteFile(siteDir, 'diagrams.html');
  orphansHtml = readSiteFile(siteDir, 'orphans.html');
  graphHtml = readSiteFile(siteDir, 'graph.html');
});

// ─── diagrams.html: every internal href resolves to a real file ─────────────
console.log('\n--- diagrams.html link integrity ---');

test('diagrams.html: no href matches the raw source pattern (_bmad-output/*.md)', () => {
  const hrefs = extractHrefs(diagramsHtml);
  const offenders = hrefs.filter(h => RAW_SOURCE_PATTERN.test(h));
  assert.strictEqual(offenders.length, 0,
    `diagrams.html must not link to raw source paths, found: ${JSON.stringify(offenders)}`);
});

test('diagrams.html: every internal href target exists on disk', () => {
  const hrefs = extractHrefs(diagramsHtml).filter(h => !isNonInternalHref(h));
  assert.ok(hrefs.length > 0, 'diagrams.html must have at least one internal href to check');
  for (const href of hrefs) {
    const target = resolveHrefAgainstPage('diagrams.html', href.split('#')[0]);
    const targetPath = path.join(siteDir, target);
    assert.ok(fs.existsSync(targetPath),
      `diagrams.html href="${href}" resolves to "${target}" which does not exist under the generated site`);
  }
});

test('diagrams.html: spine/tree/board node links point at docs/<slug>.html, not raw fileId', () => {
  // FR101 is a real requirement backed by a rendered doc page (prd.md) — its
  // link must be a docs/*.html page, never "_bmad-output/planning-artifacts/prd.md".
  assert.ok(/href="docs\/[^"]*\.html(#[^"]*)?"/.test(diagramsHtml),
    'diagrams.html must contain at least one href="docs/<slug>.html[#anchor]" node link');
});

test('diagrams.html: KG-only node with no rendered page (F99 / legacy-source) is non-clickable', () => {
  // Fixture seeds a knowledge-graph.json node (id "kg-only-node-from-legacy",
  // label "F99", fileId "legacy-source") that has NO corresponding entry in
  // manifest.files — there is no rendered doc page for it. It must never
  // appear as a live link, and never link to its raw fileId.
  assert.ok(!diagramsHtml.includes('href="legacy-source"'),
    'diagrams.html must not emit a live href to the KG-only node\'s raw fileId');
  const f99Idx = diagramsHtml.indexOf('>F99<');
  assert.ok(f99Idx >= 0, 'diagrams.html must render the F99 label somewhere');
  // Walk backward to the start of its enclosing tag to check it's a <span>, not <a>.
  const tagStart = diagramsHtml.lastIndexOf('<', f99Idx);
  const tagSnippet = diagramsHtml.slice(tagStart, f99Idx);
  assert.ok(tagSnippet.startsWith('<span'),
    `F99 (no rendered page) must render inside a non-clickable <span>, got: ${tagSnippet.slice(0, 60)}`);
});

// ─── orphans.html: every internal href resolves to a real file ──────────────
console.log('\n--- orphans.html link integrity ---');

test('orphans.html: no href matches the raw source pattern (_bmad-output/*.md)', () => {
  const hrefs = extractHrefs(orphansHtml);
  const offenders = hrefs.filter(h => RAW_SOURCE_PATTERN.test(h));
  assert.strictEqual(offenders.length, 0,
    `orphans.html must not link to raw source paths, found: ${JSON.stringify(offenders)}`);
});

test('orphans.html: every internal href target exists on disk', () => {
  const hrefs = extractHrefs(orphansHtml).filter(h => !isNonInternalHref(h));
  for (const href of hrefs) {
    const target = resolveHrefAgainstPage('orphans.html', href.split('#')[0]);
    const targetPath = path.join(siteDir, target);
    assert.ok(fs.existsSync(targetPath),
      `orphans.html href="${href}" resolves to "${target}" which does not exist under the generated site`);
  }
});

test('orphans.html: KG-only node with no rendered page does not emit a live href to its raw fileId', () => {
  assert.ok(!orphansHtml.includes('href="legacy-source"'),
    'orphans.html must not emit a live href to the KG-only node\'s raw fileId');
});

// ─── graph.html: __ATLAS_GRAPH__ node.page resolves to a real docs/*.html ────
console.log('\n--- graph.html link integrity ---');

test('graph.html: no href matches the raw source pattern (_bmad-output/*.md)', () => {
  const hrefs = extractHrefs(graphHtml);
  const offenders = hrefs.filter(h => RAW_SOURCE_PATTERN.test(h));
  assert.strictEqual(offenders.length, 0,
    `graph.html must not have a static href to raw source paths, found: ${JSON.stringify(offenders)}`);
});

test('graph.html: __ATLAS_GRAPH__ nodes carry a `page` field', () => {
  const data = extractAtlasGraph(graphHtml);
  assert.ok(data.nodes.length > 0, 'must have nodes to check');
  const withPage = data.nodes.filter(n => typeof n.page === 'string' && n.page.length > 0);
  assert.ok(withPage.length > 0, 'at least one node must carry a resolved `page` field');
});

test('graph.html: every node.page (when present) resolves to an existing docs/*.html file', () => {
  const data = extractAtlasGraph(graphHtml);
  for (const node of data.nodes) {
    if (!node.page) continue;
    assert.ok(!RAW_SOURCE_PATTERN.test(node.page),
      `node ${node.id} page "${node.page}" must not be a raw source path`);
    assert.ok(/^docs\/.*\.html$/.test(node.page),
      `node ${node.id} page "${node.page}" must look like "docs/<slug>.html"`);
    const targetPath = path.join(siteDir, node.page);
    assert.ok(fs.existsSync(targetPath),
      `node ${node.id} page "${node.page}" does not exist under the generated site`);
  }
});

test('graph.html: KG-only node (F99 / legacy-source) has no resolvable page', () => {
  const data = extractAtlasGraph(graphHtml);
  const kgOnly = data.nodes.find(n => n.id === 'kg-only-node-from-legacy');
  assert.ok(kgOnly, 'kg-only-node-from-legacy must be present in graph data');
  assert.ok(!kgOnly.page, `KG-only node must have no resolvable page, got: ${JSON.stringify(kgOnly.page)}`);
});

test('graph.html: onNodeClick navigates via n.page, not the raw fileId', () => {
  assert.ok(/onNodeClick\(function\s*\(n\)\s*\{/.test(graphHtml),
    'graph.html app script must register an onNodeClick handler');
  // The click handler must read n.page as its navigation source.
  assert.ok(/var page = n\.page/.test(graphHtml),
    'onNodeClick must resolve navigation from n.page (the server-resolved doc page)');
  // And must no-op (not navigate) when there is no page.
  assert.ok(/if \(!page\) \{ return; \}/.test(graphHtml),
    'onNodeClick must no-op when a node has no resolvable page (never navigate to a raw fileId)');
});

// ─── Broad sweep: every internal href in every generated .html file resolves ─
console.log('\n--- Full-site link sweep ---');

test('every internal href in every generated .html file resolves to an existing file', () => {
  const htmlFiles = collectHtmlFiles(siteDir);
  assert.ok(htmlFiles.length > 0, 'must have at least one generated .html file');
  assert.ok(htmlFiles.includes('index.html'), 'index.html must be among the generated files');

  const failures = [];
  for (const relPath of htmlFiles) {
    const html = readSiteFile(siteDir, relPath);
    const hrefs = extractHrefs(html).filter(h => !isNonInternalHref(h));
    for (const href of hrefs) {
      const target = resolveHrefAgainstPage(relPath, href.split('#')[0]);
      const targetPath = path.join(siteDir, target);
      if (!fs.existsSync(targetPath)) {
        failures.push(`${relPath} -> href="${href}" -> resolved "${target}" (missing)`);
      }
    }
  }
  assert.strictEqual(failures.length, 0,
    `Found ${failures.length} broken internal link(s):\n${failures.join('\n')}`);
});

test('no generated .html file anywhere in the site links to a raw _bmad-output/*.md source path', () => {
  const htmlFiles = collectHtmlFiles(siteDir);
  const failures = [];
  for (const relPath of htmlFiles) {
    const html = readSiteFile(siteDir, relPath);
    const hrefs = extractHrefs(html);
    for (const href of hrefs) {
      if (RAW_SOURCE_PATTERN.test(href)) {
        failures.push(`${relPath} -> href="${href}"`);
      }
    }
  }
  assert.strictEqual(failures.length, 0,
    `Found ${failures.length} raw-source-path href(s):\n${failures.join('\n')}`);
});

// ─── 29.3 doc/backlink/search links remain correct (no regression) ──────────
console.log('\n--- 29.3 doc/backlink/search links unaffected ---');

test('a real document page (docs/*.html) still exists for a manifest file', () => {
  assert.ok(manifest.files.length > 0, 'manifest must have files');
  const someFile = manifest.files[0];
  const htmlFiles = collectHtmlFiles(siteDir);
  const docPages = htmlFiles.filter(f => f.startsWith('docs/'));
  assert.ok(docPages.length === manifest.files.length,
    `expected ${manifest.files.length} doc pages, found ${docPages.length}`);
  void someFile;
});

test('index.html doc-list links use docs/<slug>.html (unchanged 29.3 convention)', () => {
  const indexHtml = readSiteFile(siteDir, 'index.html');
  assert.ok(/href="docs\/[^"]*\.html"/.test(indexHtml),
    'index.html must still link into docs/ using the docs/<slug>.html convention');
});

test('search.html embeds resolved `page` fields matching docPageRelPath output', () => {
  const searchHtml = readSiteFile(siteDir, 'search.html');
  const marker = 'window.__ATLAS_SEARCH__ = {';
  assert.ok(searchHtml.includes(marker), 'search.html must embed __ATLAS_SEARCH__');
});

// ─── Authored relative markdown cross-links (bug fix) ───────────────────────
//
// CONFIRMED BUG (real Prophesys project, 18 broken links): reading-view docs
// contain AUTHORED markdown cross-links to sibling source docs, e.g. in
// `prd.md`: `[roadmap](roadmap.md#7-development-timetable)`. markdown-it
// renders these as a plain `<a href="roadmap.md#...">` and passes them
// through verbatim — but every reading view is written FLAT at
// `docs/<slug>.html`, so the raw relative href resolves against the WRONG
// base directory (`docs/roadmap.md` instead of the real
// `docs/<slug-of-roadmap>.html`). The fix (render/linkify.ts
// `rewriteAuthoredLinks`, wired into render/document.ts) resolves the
// authored href against the SOURCE document's directory and rewrites it to
// the sibling docs/-relative page — only when it actually matches a scanned
// document; a genuinely non-scanned target is left untouched.
console.log('\n--- Authored relative markdown cross-links (bug fix) ---');

/** Find the single href attribute value in `html` that contains `needle`. */
function findHrefContaining(html, needle) {
  const hrefs = extractHrefs(html);
  const matches = hrefs.filter(h => h.includes(needle));
  assert.strictEqual(matches.length, 1,
    `expected exactly one href containing "${needle}", found ${matches.length}: ${JSON.stringify(matches)}`);
  return matches[0];
}

let authoredSiteDir;
let authoredManifest;
let prdHtml;
let glossaryHtml;

test('authored-links-project fixture exists', () => {
  assert.ok(fs.existsSync(AUTHORED_LINKS_FIXTURE), `fixture missing: ${AUTHORED_LINKS_FIXTURE}`);
});

test('generate authored-links-project (temp copy)', () => {
  const tmpProject = makeTempDir('authored');
  copyDirRecursive(AUTHORED_LINKS_FIXTURE, tmpProject);
  authoredManifest = runAtlas(tmpProject);
  authoredSiteDir = path.join(tmpProject, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(authoredSiteDir), 'knowledge-site output dir must exist');

  const docsDir = path.join(authoredSiteDir, 'docs');
  const prdFile = fs.readdirSync(docsDir).find(f => /prd\.html$/.test(f));
  const glossaryFile = fs.readdirSync(docsDir).find(f => /glossary\.html$/.test(f));
  assert.ok(prdFile, 'a docs/*prd.html page must be generated');
  assert.ok(glossaryFile, 'a docs/*glossary.html page must be generated');
  prdHtml = readSiteFile(authoredSiteDir, `docs/${prdFile}`);
  glossaryHtml = readSiteFile(authoredSiteDir, `docs/${glossaryFile}`);
});

test('sibling link with #anchor rewrites to the rendered sibling page, anchor preserved', () => {
  // Authored: [roadmap](roadmap.md#7-development-timetable)
  const href = findHrefContaining(prdHtml, 'roadmap.html#7-development-timetable');
  assert.ok(/^[^/]+\.html#7-development-timetable$/.test(href),
    `expected a flat docs/-relative href with the anchor preserved, got "${href}"`);
  const targetPath = path.join(authoredSiteDir, 'docs', href.split('#')[0]);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
  // The anchor must land on a real id in the target page (not just survive as text).
  const targetHtml = fs.readFileSync(targetPath, 'utf-8');
  assert.ok(targetHtml.includes('id="7-development-timetable"'),
    'target page must have a heading anchor matching the preserved fragment');
});

test('sibling link with no anchor rewrites to the rendered sibling page', () => {
  // Authored: [roadmap again](roadmap.md)
  const hrefs = extractHrefs(prdHtml).filter(h => /roadmap/.test(h) && !h.includes('#'));
  assert.strictEqual(hrefs.length, 1, `expected exactly one no-anchor roadmap href, found: ${JSON.stringify(hrefs)}`);
  const targetPath = path.join(authoredSiteDir, 'docs', hrefs[0]);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
});

test('subdirectory link (sub/domain-model.md) rewrites to the rendered flat docs page', () => {
  // Authored: [domain model](sub/domain-model.md)
  const href = findHrefContaining(prdHtml, 'domain-model.html');
  assert.ok(!href.includes('/'), `docs pages are flat — rewritten href must have no subdirectory, got "${href}"`);
  const targetPath = path.join(authoredSiteDir, 'docs', href);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
});

test('parent-directory link (../glossary.md) rewrites to the rendered flat docs page', () => {
  // Authored: [glossary](../glossary.md)
  const href = findHrefContaining(prdHtml, 'glossary.html');
  assert.ok(!href.includes('..'), `rewritten href must not retain "../" traversal, got "${href}"`);
  const targetPath = path.join(authoredSiteDir, 'docs', href);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
});

test('space + uppercase .MD extension link rewrites and resolves', () => {
  // Authored: [system description](General%20System%20Description.MD)
  const href = findHrefContaining(prdHtml, 'General-System-Description');
  assert.ok(/^[^/#\s]+\.html$/.test(href), `expected a clean flat .html href, got "${href}"`);
  const targetPath = path.join(authoredSiteDir, 'docs', href);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
});

test('reverse direction: a root-level doc linking DOWN into a subdirectory also resolves', () => {
  // glossary.md authors: [PRD](planning-artifacts/prd.md)
  const href = findHrefContaining(glossaryHtml, 'prd.html');
  const targetPath = path.join(authoredSiteDir, 'docs', href);
  assert.ok(fs.existsSync(targetPath), `rewritten target must exist on disk: ${targetPath}`);
});

test('genuinely non-scanned target (missing-file.md) is left UNTOUCHED, not falsely rewritten', () => {
  // Authored: [missing doc](missing-file.md) — no such file was ever scanned.
  const hrefs = extractHrefs(prdHtml).filter(h => h.includes('missing-file'));
  assert.strictEqual(hrefs.length, 1, `expected exactly one missing-file href, found: ${JSON.stringify(hrefs)}`);
  assert.strictEqual(hrefs[0], 'missing-file.md',
    'a non-scanned target must be left byte-for-byte unchanged (no invented docs/ page)');
});

test('no authored .md href in the generated site actually matches a scanned document (i.e. the fix did not miss one)', () => {
  const fileIdsLower = new Set(authoredManifest.files.map(f => f.path.toLowerCase()));
  const htmlFiles = collectHtmlFiles(authoredSiteDir).filter(f => f.startsWith('docs/'));
  const straggler = /\.md(#.*)?$/i;
  const unresolvedButShouldveMatched = [];
  for (const relPath of htmlFiles) {
    const html = readSiteFile(authoredSiteDir, relPath);
    for (const href of extractHrefs(html)) {
      if (!straggler.test(href)) continue;
      // A surviving .md href is only correct behavior for a genuinely
      // non-scanned target. If its resolved source path DOES match a scanned
      // fileId, the rewrite pass has a bug (missed a real match).
      if (fileIdsLower.has(href.split('#')[0].toLowerCase())) {
        unresolvedButShouldveMatched.push(`${relPath} -> href="${href}"`);
      }
    }
  }
  assert.strictEqual(unresolvedButShouldveMatched.length, 0,
    `Found authored .md href(s) that should have been rewritten but weren't:\n${unresolvedButShouldveMatched.join('\n')}`);
});

test('authored-links-project: every internal href resolves, EXCEPT the one intentionally non-scanned link', () => {
  const htmlFiles = collectHtmlFiles(authoredSiteDir);
  const failures = [];
  for (const relPath of htmlFiles) {
    const html = readSiteFile(authoredSiteDir, relPath);
    const hrefs = extractHrefs(html).filter(h => !isNonInternalHref(h));
    for (const href of hrefs) {
      if (href === 'missing-file.md') continue; // expected, asserted separately above
      const target = resolveHrefAgainstPage(relPath, href.split('#')[0]);
      const targetPath = path.join(authoredSiteDir, target);
      if (!fs.existsSync(targetPath)) {
        failures.push(`${relPath} -> href="${href}" -> resolved "${target}" (missing)`);
      }
    }
  }
  assert.strictEqual(failures.length, 0,
    `Found ${failures.length} broken internal link(s):\n${failures.join('\n')}`);
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────
for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
