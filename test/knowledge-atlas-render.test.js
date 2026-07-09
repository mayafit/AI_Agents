#!/usr/bin/env node
/**
 * test/knowledge-atlas-render.test.js
 * ---------------------------------------------------------------------------
 * Story 29.3 — Tests for the reading-views rendering site.
 *
 * AC coverage:
 *   AC 1 — reading views with TOC + status badges; mermaid fences rendered locally
 *   AC 2 — entity tokens become links to canonical fileId#anchor locations
 *   AC 3 — backlinks ("Referenced by") present and symmetric with edges
 *   AC 4 — home page with health snapshot (counts by kind, statuses, orphans)
 *   AC 5 — offline full-text search returns expected hits (no network/fetch)
 *   AC 6 — curated design system (status pills, system fonts, ARIA, reduced motion)
 *   AC 7 — progressive enhancement: home + reading + links present without JS
 *   AC 8 — self-contained + sanitized (no script/onerror from doc content; NFR64)
 *   AC 9 — suite green; entity links resolve, backlinks symmetric, search offline,
 *          sanitized, determinism; 29.1 smoke + 29.2 manifest still pass.
 *
 * Test style: plain Node assert (no framework), repo style. Generation runs
 * against a TEMP COPY of the rich-project fixture — never the committed one.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ATLAS_CJS = path.join(PROJECT_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const LUNR = path.join(PROJECT_ROOT, 'node_modules', 'lunr');

const PINNED_EPOCH = '1700000000'; // 2023-11-14T22:13:20Z

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

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-render-${prefix}-`));
  tempDirs.push(d);
  return d;
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** Run atlas.cjs against a projectRoot with the pinned epoch. */
function runAtlas(projectRoot) {
  const res = spawnSync(process.execPath, [ATLAS_CJS, projectRoot], {
    encoding: 'utf-8',
    env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
    timeout: 60000,
  });
  if (res.error) throw new Error(`atlas.cjs failed to run: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`atlas.cjs exited ${res.status}\nstderr:${res.stderr}`);
  return path.join(projectRoot, '_bmad-output', 'knowledge-site');
}

/** Recursively list every file under a dir as POSIX-relative paths. */
function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

function readManifest(siteDir) {
  return JSON.parse(fs.readFileSync(path.join(siteDir, 'manifest.json'), 'utf-8'));
}

function read(siteDir, rel) {
  return fs.readFileSync(path.join(siteDir, rel), 'utf-8');
}

console.log('\n=== Knowledge Atlas Render Tests (Story 29.3) ===');

// ─── Build a shared generated site (with an injected XSS payload doc) ─────────
console.log('\n--- Setup: generate site from rich-project (+ XSS payload) ---');

let siteDir;
let manifest;
let allFiles;

test('generate the reading site from a temp copy of rich-project', () => {
  const tmp = makeTempDir('main');
  copyDirRecursive(RICH_FIXTURE, tmp);

  // AC 8 / NFR64: inject a malicious doc to prove sanitization neutralizes it.
  // The heading text carries a </script> breakout payload so it flows into a
  // node label AND into the search index (search-index breakout test).
  //
  // MUST-FIX #1 (adversarial review) additions below: HTML-entity-obfuscated
  // javascript: hrefs that decode to an executable scheme only AFTER the
  // browser HTML-decodes the attribute — the raw-text scheme allowlist check
  // used to miss these. NOTE: the markdown-LINK form of this payload
  // (`[x](javascript` + a decimal char-reference for `:` + `alert(1))`) is
  // deliberately NOT included in this fixture doc — markdown-it does not
  // parse it as a link at all, so its decoded colon survives as inert
  // DISPLAY TEXT (not inside an href=), which would spuriously trip this
  // file's blanket no-"javascript:"-substring-anywhere assertions further
  // below. That markdown-link variant is covered separately by
  // knowledge-atlas-degradation.test.js's xss-injection-story.md fixture,
  // whose checks are href-attribute-scoped rather than whole-page-substring.
  const xssDoc = [
    '---',
    'title: XSS Probe',
    'status: in-progress',
    '---',
    '# XSS Probe </script><script>window.__searchpwned=1;</script>',
    '',
    'Inline script: <script>window.__pwned=1;</script>',
    '',
    'Event handler: <img src="x" onerror="window.__pwned=2">',
    '',
    'JS link: <a href="javascript:window.__pwned=3">click</a>',
    '',
    'VBScript link: <a href="vbscript:MsgBox(1)">vb</a>',
    '',
    'An iframe: <iframe src="data:text/html,evil"></iframe>',
    '',
    'Raw HTML hex-entity tab obfuscation: <a href="jav&#x09;ascript:alert(1)">entity-tab</a>',
    '',
    'Raw HTML hex-entity leading char: <a href="&#x6a;avascript:alert(1)">entity-hex</a>',
    '',
    'Raw HTML decimal-entity leading char: <a href="&#106;avascript:alert(1)">entity-dec</a>',
    '',
    'This doc also references FR101 and Story 1.1.',
    '',
    '```mermaid',
    'graph TD; A-->B;',
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(tmp, '_bmad-output', 'implementation-artifacts', '9-9-xss-probe.md'),
    xssDoc, 'utf-8',
  );

  siteDir = runAtlas(tmp);
  manifest = readManifest(siteDir);
  allFiles = listFiles(siteDir);
  assert.ok(fs.existsSync(path.join(siteDir, 'index.html')), 'index.html must exist');
});

// ─── AC 1: reading views, TOC, status badges, mermaid ────────────────────────
console.log('\n--- AC 1: reading views (TOC, status badges, mermaid) ---');

test('one reading view per document is written under docs/', () => {
  const docPages = allFiles.filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  assert.strictEqual(docPages.length, manifest.files.length,
    `expected ${manifest.files.length} doc pages, got ${docPages.length}`);
});

test('a document reading view has a table of contents', () => {
  const prd = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  assert.ok(/class="toc"/.test(prd), 'PRD reading view must contain a TOC');
  assert.ok(/<a href="#functional-requirements"/.test(prd),
    'TOC must link to a heading anchor produced by the slug algorithm');
});

test('headings carry slug ids that match TOC anchors', () => {
  const prd = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  assert.ok(/id="functional-requirements"/.test(prd), 'heading must have matching id');
  assert.ok(/id="fr101-user-authentication"/.test(prd), 'sub-heading slug must match node anchors');
});

test('status badges render from the file statuses', () => {
  const story = read(siteDir, 'docs/bmad-output-implementation-artifacts-1-1-oauth2-integration.html');
  assert.ok(/class="status-pill status-done"/.test(story),
    'a done story must show a done status pill');
});

test('authored mermaid fence renders locally as a vendored figure (no CDN)', () => {
  const xss = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  assert.ok(/class="mermaid-block"/.test(xss), 'mermaid fence must become a mermaid-block figure');
  assert.ok(/graph TD/.test(xss), 'mermaid source must remain present (plain-text fallback)');
  assert.ok(!/cdn|unpkg|jsdelivr/i.test(xss), 'mermaid must never reference a CDN');
});

// ─── AC 2: entity cross-linking ──────────────────────────────────────────────
console.log('\n--- AC 2: entity cross-linking ---');

test('entity tokens become links in reading views', () => {
  const epics = read(siteDir, 'docs/bmad-output-planning-artifacts-epics.html');
  assert.ok(/class="entity-link"/.test(epics), 'epics page must contain entity links');
  assert.ok(/href="bmad-output-planning-artifacts-prd\.html#fr101"[^>]*>FR101</.test(epics)
        || /href="[^"]*#fr101"[^>]*>FR101</.test(epics),
    'FR101 must link to the PRD definition anchor');
});

test('mermaid fence renders as a live <pre class="mermaid"> with uncorrupted source + runtime', () => {
  // The xss-probe doc (see setup) contains a ```mermaid graph TD; A-->B; fence.
  const page = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  const m = page.match(/<pre class="mermaid">([\s\S]*?)<\/pre>/);
  assert.ok(m, 'mermaid fence must become a <pre class="mermaid"> render target');
  // Source must survive verbatim — linkify must NOT inject <a> tags into it,
  // or mermaid would fail to parse the diagram.
  assert.ok(/graph TD/.test(m[1]), 'diagram source must be present');
  assert.ok(!/<a\b/.test(m[1]), 'no <a> may be injected into the mermaid source');
  // The vendored runtime + init must be present on this page (local relative src).
  assert.ok(/<script src="\.\.\/assets\/mermaid\.min\.js"><\/script>/.test(page),
    'mermaid page must load the vendored runtime');
  assert.ok(/mermaid\.initialize\(/.test(page), 'mermaid page must initialize the runtime');
  // And the asset itself must be written.
  assert.ok(allFiles.includes('assets/mermaid.min.js'), 'assets/mermaid.min.js must be written');
});

test('every entity-link href resolves to a real page (and anchor) in the site', () => {
  const docPages = allFiles.filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  // Build a set of available page basenames + the set of ids per page.
  const pageSet = new Set(docPages.map(f => f.replace(/^docs\//, '')));
  const idsByPage = new Map();
  for (const f of docPages) {
    const html = read(siteDir, f);
    const ids = new Set();
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
    idsByPage.set(f.replace(/^docs\//, ''), ids);
  }

  let checked = 0;
  for (const f of docPages) {
    const html = read(siteDir, f);
    const thisPage = f.replace(/^docs\//, '');
    for (const m of html.matchAll(/<a href="([^"]+)" class="entity-link">/g)) {
      const href = m[1];
      checked++;
      let targetPage, anchor;
      if (href.startsWith('#')) {
        targetPage = thisPage;
        anchor = href.slice(1);
      } else {
        const [p, a] = href.split('#');
        targetPage = p;
        anchor = a;
        assert.ok(pageSet.has(targetPage),
          `entity-link in ${f} points to a missing page: ${href}`);
      }
      if (anchor) {
        const ids = idsByPage.get(targetPage) || new Set();
        assert.ok(ids.has(anchor),
          `entity-link in ${f} points to a missing anchor #${anchor} on ${targetPage}`);
      }
    }
  }
  assert.ok(checked > 0, 'must have checked at least one entity link');
});

test('entity tokens inside code spans are NOT linkified', () => {
  // The PRD has no code spans with entities, but the rendered <code>/<pre> must
  // never contain an entity-link anchor.
  for (const f of allFiles.filter(x => x.startsWith('docs/'))) {
    const html = read(siteDir, f);
    for (const m of html.matchAll(/<(code|pre)[\s>][\s\S]*?<\/\1>/g)) {
      assert.ok(!/class="entity-link"/.test(m[0]),
        `code/pre span in ${f} must not contain an entity link`);
    }
  }
});

// ─── AC 3: backlinks + symmetry ──────────────────────────────────────────────
console.log('\n--- AC 3: backlinks (Referenced by) + symmetry ---');

test('a referenced entity shows a "Referenced by" section', () => {
  const prd = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  assert.ok(/Referenced by/.test(prd), 'PRD (defines FR101) must show backlinks');
});

test('backlinks are symmetric with manifest edges (A→B ⇒ B lists A)', () => {
  // For every non-dangling, non-self edge whose SOURCE and TARGET both have
  // rendered doc pages, the target page must list the source in its backlinks
  // (as a clickable link). Sources with no rendered page (e.g. kg-only nodes)
  // are correctly listed non-clickable; those we assert appear as text.
  const nodeById = new Map(manifest.nodes.map(n => [n.id, n]));
  const docFileIds = new Set(manifest.files.map(f => f.path));
  const slug = (p) => p.replace(/\.(md|markdown|yaml|yml|json|txt)$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  let checkedLinked = 0;
  for (const edge of manifest.edges) {
    if (edge.dangling) continue;
    if (edge.from === edge.to) continue; // self-edge is never a backlink
    const toNode = nodeById.get(edge.to);
    const fromNode = nodeById.get(edge.from);
    if (!toNode || !fromNode) continue;
    const targetPage = `docs/${slug(toNode.fileId)}.html`;
    if (!allFiles.includes(targetPage)) continue;
    const html = read(siteDir, targetPage);

    const sourceHasPage = docFileIds.has(fromNode.fileId);
    if (sourceHasPage) {
      const expectFromSlug = slug(fromNode.fileId);
      // SF-3: assert the EXACT sibling href "<slug>.html" (optionally with an
      // #anchor) — NOT a loose [^"]* that would absorb a spurious "../../".
      // Both doc pages live in docs/, so a correct backlink is a bare sibling.
      const exactHref = new RegExp(
        `<section class="backlinks-section"[\\s\\S]*?href="${expectFromSlug}\\.html(?:#[^"]*)?"`,
      );
      assert.ok(exactHref.test(html),
        `edge ${edge.from} --${edge.kind}--> ${edge.to}: target ${targetPage} must list a ` +
        `backlink with EXACT sibling href "${expectFromSlug}.html" (no ../), in: ` +
        (html.match(/<section class="backlinks-section"[\s\S]*?<\/section>/) || ['<none>'])[0].slice(0, 300));
      checkedLinked++;
    } else {
      // Source has no page → must appear, but non-clickable (never a 404 link).
      assert.ok(html.includes(`>${fromNode.label}</span>`) || html.includes(`>${fromNode.label}<`),
        `edge from page-less source ${fromNode.label} must still be listed (non-clickable) ` +
        `on ${targetPage}`);
      assert.ok(!new RegExp(`href="[^"]*${slug(fromNode.fileId)}\\.html`).test(html),
        `page-less backlink source ${fromNode.label} must NOT be a live link`);
    }
  }
  assert.ok(checkedLinked > 0, 'must have checked at least one clickable symmetric backlink');
});

test('backlink hrefs are sibling-relative and hit real pages (MF-2: no ../)', () => {
  const docPages = allFiles.filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const pageSet = new Set(docPages.map(f => f.replace(/^docs\//, '')));
  let checked = 0;
  for (const f of docPages) {
    const html = read(siteDir, f);
    const section = (html.match(/<section class="backlinks-section"[\s\S]*?<\/section>/g) || []);
    for (const sec of section) {
      for (const m of sec.matchAll(/href="([^"]+)"/g)) {
        const href = m[1];
        checked++;
        assert.ok(!href.includes('..'),
          `backlink href in ${f} must be sibling-relative (no ".."): ${href}`);
        const page = href.split('#')[0];
        assert.ok(pageSet.has(page),
          `backlink href in ${f} must point at a real emitted page: ${href}`);
      }
    }
  }
  assert.ok(checked > 0, 'must have checked at least one backlink href');
});

// ─── AC 4: home + health snapshot ────────────────────────────────────────────
console.log('\n--- AC 4: home + health snapshot ---');

test('home page shows a health snapshot with counts, statuses, orphans', () => {
  const home = read(siteDir, 'index.html');
  assert.ok(/Health snapshot/i.test(home), 'home must have a Health snapshot section');
  assert.ok(/Documents/.test(home) && /Entities/.test(home), 'must show document/entity counts');
  assert.ok(/Orphaned entities/i.test(home), 'must show an orphan count tile');
  assert.ok(/Entities by kind/i.test(home), 'must show counts by kind');
});

test('orphan count is a pure manifest read (nodes with no non-dangling edge)', () => {
  const connected = new Set();
  for (const e of manifest.edges) {
    if (!e.dangling) { connected.add(e.from); connected.add(e.to); }
  }
  const orphans = manifest.nodes.filter(n => !connected.has(n.id)).length;
  const home = read(siteDir, 'index.html');
  const m = home.match(/<span class="stat-num tabular">(\d+)<\/span><div class="stat-label">Orphaned entities/);
  assert.ok(m, 'orphan stat tile must be present');
  assert.strictEqual(Number(m[1]), orphans, 'rendered orphan count must equal manifest computation');
});

test('home links graph.html when 29.4 has written it (integrated site)', () => {
  // In the integrated epic, generate() always emits graph.html (Story 29.4),
  // so the home nav must surface the interactive graph link. The graceful-omit
  // branch (graph.html absent) is guarded by site.ts's fs.existsSync check.
  const home = read(siteDir, 'index.html');
  assert.ok(/href="graph\.html"/.test(home),
    'home must link graph.html when 29.4 emitted it');
});

// SHOULD-FIX #2 (adversarial review): diagrams.html and orphans.html were
// unreachable from home or any reading/search page — the 29.3 shared nav only
// linked Home/Search, the 29.4 pages hand-rolled a nav missing Search, and
// home's entry points surfaced Graph but not Diagrams/Orphans. Assert every
// page type now shares ONE nav set (Home · Graph · Diagrams · Orphans ·
// Search) so no page is a dead end.
console.log('\n--- SHOULD-FIX #2: unified nav / no unreachable page ---');

test('home surfaces Graph, Diagrams, Orphans, and Search as entry points', () => {
  const home = read(siteDir, 'index.html');
  for (const page of ['graph.html', 'diagrams.html', 'orphans.html', 'search.html']) {
    assert.ok(new RegExp(`href="${page.replace('.', '\\.')}"`).test(home),
      `home (index.html) must link ${page}`);
  }
});

test('every page type (doc, home, search, graph, diagrams, orphans) carries the full nav set', () => {
  // A doc page's nav is baseHref-prefixed ("../graph.html"); the six
  // top-level page types use bare hrefs ("graph.html"). Build a regex that
  // accepts an optional "../" prefix so one check covers both.
  const navLink = (page) => new RegExp(`href="(?:\\.\\./)?${page.replace('.', '\\.')}"`);
  const expectedLinks = ['index.html', 'graph.html', 'diagrams.html', 'orphans.html', 'search.html'];

  const samplePages = [
    'index.html',
    'search.html',
    'graph.html',
    'diagrams.html',
    'orphans.html',
    // One representative reading view (docs/ page, baseHref "../").
    'docs/bmad-output-planning-artifacts-prd.html',
  ];

  for (const page of samplePages) {
    const html = read(siteDir, page);
    for (const expected of expectedLinks) {
      // A page never needs to link itself; every OTHER page in the set must
      // be reachable from here.
      if (page === expected) continue;
      assert.ok(navLink(expected).test(html),
        `${page} must carry a nav link to ${expected} (unified nav, SHOULD-FIX #2)`);
    }
  }
});

test('Search is reachable from every page type (previously missing from graph/diagrams/orphans nav)', () => {
  for (const page of ['graph.html', 'diagrams.html', 'orphans.html', 'index.html']) {
    const html = read(siteDir, page);
    assert.ok(/href="search\.html"/.test(html), `${page} must link search.html`);
  }
  const doc = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  assert.ok(/href="\.\.\/search\.html"/.test(doc), 'a reading view must link ../search.html');
});

// ─── AC 5: offline search ────────────────────────────────────────────────────
console.log('\n--- AC 5: offline full-text search ---');

test('search index is embedded as window.__ATLAS_SEARCH__ (never fetched)', () => {
  const search = read(siteDir, 'search.html');
  assert.ok(/window\.__ATLAS_SEARCH__\s*=/.test(search), 'search index must be embedded as a JS var');
  assert.ok(!/fetch\s*\(/.test(search), 'search must not fetch');
  assert.ok(!/XMLHttpRequest/.test(search), 'search must not use XMLHttpRequest');
});

test('the lunr runtime is vendored inline (no external script src)', () => {
  const search = read(siteDir, 'search.html');
  assert.ok(/lunr/.test(search), 'lunr runtime must be present inline');
  for (const m of search.matchAll(/<script\s+src="([^"]+)"/g)) {
    assert.fail(`search.html must not load an external script: ${m[1]}`);
  }
});

test('offline search returns the expected document for a query', () => {
  const search = read(siteDir, 'search.html');
  const m = search.match(/window\.__ATLAS_SEARCH__\s*=\s*\{\s*index:\s*([\s\S]*?),\s*docs:\s*([\s\S]*?)\s*\};/);
  assert.ok(m, 'must extract embedded index + docs');
  const index = JSON.parse(m[1]);
  const docs = JSON.parse(m[2]);
  const lunr = require(LUNR);
  const idx = lunr.Index.load(index);
  const byId = new Map(docs.map(d => [d.id, d]));
  const query = (q) => idx.search(q).map(r => byId.get(r.ref)).filter(Boolean).map(d => d.title);

  assert.ok(query('FR101').includes('FR101'), 'search "FR101" must return the FR101 entity');
  assert.ok(query('oauth2').some(t => /oauth2/i.test(t)),
    'search "oauth2" must return the oauth2 story');
});

test('search index bodies are article content, not shell boilerplate (SF-1)', () => {
  const search = read(siteDir, 'search.html');
  const m = search.match(/window\.__ATLAS_SEARCH__\s*=\s*\{\s*index:\s*([\s\S]*?),\s*docs:\s*([\s\S]*?)\s*\};/);
  const docs = JSON.parse(m[2]);
  // File docs should carry real document text; none should contain the nav/
  // footer chrome string "Generated at" or the "Search requires JavaScript"
  // note, which would prove shell boilerplate leaked into the index.
  const fileDocs = docs.filter(d => d.id && d.id.startsWith('file:'));
  assert.ok(fileDocs.length > 0, 'must have file docs in the index');
  for (const d of fileDocs) {
    assert.ok(!/Generated at:/.test(d.body || ''),
      `doc ${d.id} body must not contain footer boilerplate: ${(d.body||'').slice(0,80)}`);
    assert.ok(!/Skip to content/.test(d.body || ''),
      `doc ${d.id} body must not contain the skip-link chrome`);
  }
  // The PRD doc's body should contain its actual content (e.g. "OAuth2"/"Export").
  const prdDoc = fileDocs.find(d => /prd/.test(d.fileId));
  assert.ok(prdDoc && /authentication|export|requirement/i.test(prdDoc.body || ''),
    'PRD search body must contain document content, not just boilerplate');
});

test('a </script> payload in content does NOT break out of the search index', () => {
  const search = read(siteDir, 'search.html');
  // The injected heading contained "</script><script>window.__searchpwned=1"
  // which must NOT appear as a live closing tag / executable script inside the
  // embedded index script block. All "<" must be unicode-escaped (<).
  assert.ok(!/window\.__searchpwned/.test(search),
    'search-index breakout payload must not appear as executable JS');
  // No literal "</script>" other than the legitimate closing tags of the three
  // known script blocks (index, lunr runtime, UI). The payload one must be gone.
  const scriptCloses = (search.match(/<\/script>/g) || []).length;
  assert.ok(scriptCloses <= 3,
    `expected at most 3 legitimate </script> closers, found ${scriptCloses} (breakout leaked)`);
  // The embedded index must still be valid JSON that parses.
  const m = search.match(/window\.__ATLAS_SEARCH__\s*=\s*\{\s*index:\s*([\s\S]*?),\s*docs:\s*([\s\S]*?)\s*\};/);
  assert.ok(m, 'embedded search var must still be present and parseable');
  assert.doesNotThrow(() => { JSON.parse(m[1]); JSON.parse(m[2]); },
    'index + docs must remain valid JSON after escaping');
});

// ─── AC 6: design system / a11y ──────────────────────────────────────────────
console.log('\n--- AC 6: curated design system + a11y ---');

test('pages inline the design system (status pills, system fonts)', () => {
  const home = read(siteDir, 'index.html');
  assert.ok(/--status-done/.test(home), 'status color tokens must be present');
  assert.ok(/system-ui/.test(home), 'must use a system font stack');
  assert.ok(!/@font-face|fonts\.googleapis|fonts\.gstatic/.test(home), 'no web fonts');
});

test('structural ARIA + reduced-motion are present', () => {
  const home = read(siteDir, 'index.html');
  assert.ok(/<nav[^>]*aria-label=/.test(home), 'nav must have aria-label');
  assert.ok(/role="contentinfo"/.test(home), 'footer landmark must be present');
  assert.ok(/prefers-reduced-motion/.test(home), 'must honor prefers-reduced-motion');
  assert.ok(/class="skip-link"/.test(home), 'must include a skip link');
});

// ─── AC 7: progressive enhancement ───────────────────────────────────────────
console.log('\n--- AC 7: progressive enhancement (no blank screen w/o JS) ---');

test('home page has zero JS (no <script>, no src=) — fully static', () => {
  const home = read(siteDir, 'index.html');
  assert.ok(!/<script/i.test(home), 'home must contain no <script> tags');
  assert.ok(!/\ssrc=/.test(home), 'home must contain no src= attributes');
});

test('reading views are legible and navigable without JS', () => {
  const prd = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  // Body content + links present without needing JS.
  assert.ok(/<article class="doc-body">/.test(prd), 'reading view must render article content');
  assert.ok(/class="entity-link"/.test(prd) || /<a href=/.test(prd), 'links present statically');
  assert.ok(!/<script/i.test(prd), 'reading view requires no JS to read (no scripts emitted)');
});

test('search page degrades to a navigable document list without JS', () => {
  const search = read(siteDir, 'search.html');
  assert.ok(/Search requires JavaScript/i.test(search), 'must show a no-JS note');
  assert.ok(/id="nojs-fallback"/.test(search), 'must have a no-JS fallback container');
  assert.ok(/class="doc-list"/.test(search), 'fallback must list documents');
});

test('reading-view nav/search links resolve from docs/ (MF-1: ../-prefixed)', () => {
  const prd = read(siteDir, 'docs/bmad-output-planning-artifacts-prd.html');
  // A doc page lives at docs/<slug>.html — bare index.html/search.html would
  // resolve to docs/index.html (404). All nav + search links must be ../-prefixed.
  assert.ok(!/href="index\.html"/.test(prd), 'no bare href="index.html" on a doc page');
  assert.ok(!/href="search\.html"/.test(prd), 'no bare href="search.html" on a doc page');
  assert.ok(!/action="search\.html"/.test(prd), 'search form action must not be bare search.html');
  assert.ok(/href="\.\.\/index\.html"/.test(prd), 'Home link must be ../index.html');
  assert.ok(/href="\.\.\/search\.html"/.test(prd), 'Search link must be ../search.html');
  assert.ok(/action="\.\.\/search\.html"/.test(prd), 'search form action must be ../search.html');
});

test('root pages (home, search) keep bare nav links (baseHref empty)', () => {
  const home = read(siteDir, 'index.html');
  assert.ok(/href="index\.html"/.test(home) && /href="search\.html"/.test(home),
    'root pages use bare (baseHref="") nav links');
  assert.ok(!/href="\.\.\/(index|search)\.html"/.test(home),
    'root pages must not ../-prefix their own nav links');
});

// ─── AC 8: self-contained + sanitized ────────────────────────────────────────
console.log('\n--- AC 8: self-contained + sanitized (NFR64) ---');

test('no http(s):// URLs anywhere in the generated site', () => {
  // graph.html (Story 29.4) embeds the vendored force-graph bundle, which bakes
  // W3C XML namespace URIs (e.g. http://www.w3.org/2000/svg) into its code —
  // these are not network fetches. Strip that vendored block before scanning
  // (mirrors the 29.4 graph test) so the assertion still catches any REAL
  // external URL in application code.
  const stripVendor = (txt, f) => {
    if (!/graph\.html$/.test(f)) return txt;
    const s = txt.indexOf('/* force-graph v');
    const e = txt.indexOf('</script>', s);
    return (s >= 0 && e >= 0) ? txt.slice(0, s) + txt.slice(e) : txt;
  };
  // Vendored offline runtimes (mermaid, drawio viewer) copied into assets/ bake
  // W3C namespace URIs + license-comment links into their code — never fetched,
  // exactly like the inlined force-graph block. Exempt them from the URL scan.
  const vendoredAssets = new Set(['mermaid.min.js', 'drawio-viewer.min.js']);
  for (const f of allFiles) {
    if (!/\.(html|js|json)$/.test(f)) continue;
    if (f.endsWith('manifest.json')) continue; // manifest holds absolute fs paths, not URLs
    if (vendoredAssets.has(f.split('/').pop())) continue; // vendored offline runtime
    const txt = stripVendor(read(siteDir, f), f);
    const m = txt.match(/https?:\/\//);
    assert.ok(!m, `${f} must not contain http(s):// (found: ${m && m[0]})`);
  }
});

test('no external <script src=> and no web fonts anywhere', () => {
  for (const f of allFiles.filter(x => x.endsWith('.html'))) {
    const txt = read(siteDir, f);
    for (const mm of txt.matchAll(/<script\s+src="([^"]+)"/g)) {
      assert.ok(/^\.{0,2}\//.test(mm[1]) || !mm[1].includes(':'),
        `${f}: external script src not allowed: ${mm[1]}`);
    }
    assert.ok(!/@font-face|fonts\.(googleapis|gstatic)/.test(txt), `${f}: no web fonts`);
  }
});

test('injected <script> from document content is neutralized', () => {
  const xss = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  // The doc body must NOT contain an executable inline script from content.
  assert.ok(!/window\.__pwned\s*=\s*1/.test(xss),
    'inline <script> payload from doc content must be stripped');
  assert.ok(!/window\.__searchpwned/.test(xss),
    'heading </script> breakout payload from doc content must be stripped');
  // No CONTENT-injected script may survive. This doc contains a ```mermaid fence,
  // so the page legitimately carries the vendored mermaid runtime + its init —
  // those are the ONLY scripts permitted; any other <script> means content leaked.
  const scripts = [...xss.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m => m[0]);
  for (const s of scripts) {
    assert.ok(
      /assets\/mermaid\.min\.js/.test(s) || /mermaid\.initialize/.test(s),
      `only the vendored mermaid runtime may appear as a script; got: ${s.slice(0, 90)}`,
    );
  }
});

test('injected event handlers and javascript: URLs are neutralized', () => {
  const xss = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  assert.ok(!/onerror\s*=/i.test(xss), 'onerror= handler must be stripped');
  assert.ok(!/javascript:/i.test(xss), 'javascript: URL must be stripped');
  assert.ok(!/<iframe/i.test(xss), '<iframe> must be stripped');
  assert.ok(!/window\.__pwned/.test(xss), 'no XSS payload may survive');
});

test('injected vbscript: href is neutralized (allowlist, not just javascript:)', () => {
  const xss = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  assert.ok(!/vbscript:/i.test(xss), 'vbscript: URL must be stripped from href');
  // The <a> may survive but must carry no executable scheme in href.
  for (const m of xss.matchAll(/<a\s[^>]*href="([^"]*)"/gi)) {
    assert.ok(!/^\s*(javascript|vbscript|data):/i.test(m[1]),
      `anchor href must not use an executable scheme: ${m[1]}`);
  }
});

// MUST-FIX #1 regression: HTML-entity-obfuscated javascript: hrefs. The old
// isSafeUrl() tested the RAW attribute text; the browser HTML-decodes the
// attribute value AFTER our sanitizer runs, so `jav&#x09;ascript:alert(1)`,
// `&#x6a;avascript:alert(1)`, `&#106;avascript:alert(1)`, and the markdown
// decimal-entity form `javascript&#58;alert(1)` all fired a javascript: URI
// on click despite the "sanitized" output. This mirrors the browser's own
// HTML-decoding of a raw href attribute value before asserting on scheme.
function decodeHtmlEntitiesForUrlCheck(v) {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[\x00-\x20]+/g, '')
    .toLowerCase();
}

test('HTML-entity-obfuscated javascript:/vbscript: hrefs never decode to an executable scheme anywhere in the site', () => {
  const violations = [];
  for (const f of allFiles.filter(x => x.endsWith('.html'))) {
    const html = read(siteDir, f);
    for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*"([^"]*)"/gi)) {
      const decoded = decodeHtmlEntitiesForUrlCheck(m[1]);
      if (/^(javascript|vbscript|data):/.test(decoded)) {
        violations.push(`${f}: href="${m[1]}" decodes to "${decoded}"`);
      }
    }
  }
  assert.deepStrictEqual(violations, [],
    `entity-obfuscated executable-scheme href(s) survived sanitization:\n  ${violations.join('\n  ')}`);
});

test('the entity-obfuscation payloads from the XSS probe doc are neutralized', () => {
  const xss = read(siteDir, 'docs/bmad-output-implementation-artifacts-9-9-xss-probe.html');
  // None of the hostile source strings may survive verbatim as a live href
  // (whether raw or partially re-escaped) — the attribute must either be
  // dropped entirely or its decoded form must not be a javascript: URI.
  for (const m of xss.matchAll(/<a\s[^>]*href\s*=\s*"([^"]*)"/gi)) {
    const decoded = decodeHtmlEntitiesForUrlCheck(m[1]);
    assert.ok(!decoded.startsWith('javascript:') && !decoded.startsWith('vbscript:'),
      `href="${m[1]}" must not decode to an executable scheme (decoded: "${decoded}")`);
  }
  // Sanity: prove the probe's raw hostile substrings are not merely
  // re-encoded/relabeled elsewhere in the page as a live, clickable href.
  assert.ok(!/href="jav&#x09;ascript:/i.test(xss), 'tab-entity payload must not survive as a raw href');
  assert.ok(!/href="&#x6a;avascript:/i.test(xss), 'hex-entity payload must not survive as a raw href');
  assert.ok(!/href="&#106;avascript:/i.test(xss), 'decimal-entity payload must not survive as a raw href');
});

// ─── AC 9: determinism ───────────────────────────────────────────────────────
console.log('\n--- AC 9: determinism ---');

test('two builds of the same fixture are byte-identical', () => {
  const a = makeTempDir('detA');
  const b = makeTempDir('detB');
  copyDirRecursive(RICH_FIXTURE, a);
  copyDirRecursive(RICH_FIXTURE, b);
  const sa = runAtlas(a);
  const sb = runAtlas(b);
  const fa = listFiles(sa).filter(f => f !== 'manifest.json'); // manifest holds abs paths
  const fb = listFiles(sb).filter(f => f !== 'manifest.json');
  assert.deepStrictEqual(fa, fb, 'the two builds must write the same file set');
  for (const f of fa) {
    assert.strictEqual(fileHash(path.join(sa, f)), fileHash(path.join(sb, f)),
      `file ${f} must be byte-identical across two builds`);
  }
});

// ─── Slug collision (two colliding paths → two distinct pages, no lost doc) ──
console.log('\n--- Slug collision handling ---');

test('two docs whose paths collide under the base slug produce distinct pages', () => {
  const tmp = makeTempDir('collide');
  const pa = path.join(tmp, '_bmad-output', 'planning-artifacts');
  fs.mkdirSync(pa, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'collide' }));
  // "planning-artifacts/notes.md" and "planning_artifacts/notes.md" both
  // slugify to "bmad-output-planning-artifacts-notes" under the base rule.
  fs.writeFileSync(path.join(pa, 'notes.md'), '# Notes A\n\nFR1 here.\n', 'utf-8');
  const pa2 = path.join(tmp, '_bmad-output', 'planning_artifacts');
  fs.mkdirSync(pa2, { recursive: true });
  fs.writeFileSync(path.join(pa2, 'notes.md'), '# Notes B\n\nFR2 here.\n', 'utf-8');

  const site = runAtlas(tmp);
  const m = readManifest(site);
  const docPages = listFiles(site).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  // Both documents must be present in the manifest…
  const collidingFiles = m.files.filter(f => /notes\.md$/.test(f.path));
  assert.strictEqual(collidingFiles.length, 2, 'both colliding docs must be scanned');
  // …and BOTH must have their own distinct rendered page (no silent overwrite).
  assert.ok(docPages.length >= 2, 'must render at least two doc pages');
  const notesPages = docPages.filter(f => /notes/.test(f));
  assert.strictEqual(new Set(notesPages).size, notesPages.length, 'page names must be unique');
  assert.strictEqual(notesPages.length, 2,
    `both colliding docs must get their own page, got: ${notesPages.join(', ')}`);
  // The two pages must have different content (A vs B), proving neither was lost.
  const [p1, p2] = notesPages.sort();
  const c1 = read(site, p1);
  const c2 = read(site, p2);
  assert.ok((/Notes A/.test(c1) && /Notes B/.test(c2)) || (/Notes B/.test(c1) && /Notes A/.test(c2)),
    'the two pages must contain the two distinct documents (no doc lost to overwrite)');
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────
for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
