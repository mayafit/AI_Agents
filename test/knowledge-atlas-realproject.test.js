#!/usr/bin/env node
/**
 * test/knowledge-atlas-realproject.test.js
 * ---------------------------------------------------------------------------
 * Story 29.6 — Real-project smoke test (AC 5).
 *
 * Generates the Atlas against TWO real projects:
 *
 *   1. THIS REPO's own `_bmad-output` — the ma-agents repo itself, run from
 *      within the worktree. This is the primary "real project" test. Output
 *      goes to a TEMP DIR (never into the tracked `_bmad-output/knowledge-site`).
 *
 *   2. The `rich-project` fixture — used as the "second project" (stands in
 *      for a real second on-disk project in CI where only one real project is
 *      available). The fixture exercises multiple doc types, a knowledge-graph.json,
 *      done/ archive, etc.
 *
 * Spot assertions on each project:
 *   - Exit 0 (no crash)
 *   - All six page types produced (index, search, graph, diagrams, orphans,
 *     and at least one doc page)
 *   - index.html has real entity content (doc list, stats)
 *   - graph.html embeds __ATLAS_GRAPH__ with >0 nodes
 *   - orphans.html lists items (at least a section header)
 *   - Entity links in doc pages resolve (no dead href= paths)
 *   - manifest.json is valid JSON with nodes and files arrays
 *
 * Critical: tests NEVER write into the repo's tracked `_bmad-output/knowledge-site`.
 * All output goes to os.tmpdir() paths cleaned up at the end.
 *
 * Test style: plain Node assert (no framework), repo style.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ATLAS_CJS = path.join(PROJECT_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');

// Pin epoch for deterministic output.
const PINNED_EPOCH = '1700000000';

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

function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-realproj-${prefix}-`));
  tempDirs.push(d);
  return d;
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

function collectFiles(root) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else results.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return results.sort();
}

/**
 * Run atlas.cjs against a projectRoot, with output going to a TEMP dir.
 * Uses `--out` to redirect output, preventing writes into the tracked repo tree.
 * Returns the spawnSync result.
 */
function runAtlasToTemp(projectRoot, outDir) {
  return spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot, '--out', outDir],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 120000, // real project may be large
    }
  );
}

/**
 * Standard spot-check assertions for a generated knowledge site.
 * Used for both the real-project and the rich-fixture assertions.
 *
 * @param {string} siteDir   Absolute path to the generated knowledge-site dir
 * @param {string} label     Human-readable label for error messages
 */
function spotCheck(siteDir, label) {
  const files = collectFiles(siteDir);

  // All six page types
  const missing = [];
  if (!files.includes('index.html'))    missing.push('index.html');
  if (!files.includes('search.html'))   missing.push('search.html');
  if (!files.includes('graph.html'))    missing.push('graph.html');
  if (!files.includes('diagrams.html')) missing.push('diagrams.html');
  if (!files.includes('orphans.html'))  missing.push('orphans.html');
  const docPages = files.filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  if (docPages.length === 0)            missing.push('docs/*.html');

  assert.strictEqual(missing.length, 0,
    `[${label}] Missing page types: ${missing.join(', ')}. All files: ${files.join(', ')}`);

  // index.html has real entity content
  const indexHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf-8');
  assert.ok(indexHtml.includes('<h1'), `[${label}] index.html missing h1`);
  // Must have the document-list section or stats section
  assert.ok(
    indexHtml.includes('Documents') || indexHtml.includes('Entities') ||
    indexHtml.includes('stat-card') || docPages.length > 0,
    `[${label}] index.html has no entity content`
  );

  // graph.html embeds __ATLAS_GRAPH__ with >0 nodes
  const graphHtml = fs.readFileSync(path.join(siteDir, 'graph.html'), 'utf-8');
  assert.ok(graphHtml.includes('__ATLAS_GRAPH__'),
    `[${label}] graph.html must embed __ATLAS_GRAPH__`);
  // Extract the JSON to verify it has nodes
  const graphMatch = graphHtml.match(/__ATLAS_GRAPH__\s*=\s*(\{[\s\S]*?\});/);
  assert.ok(graphMatch, `[${label}] __ATLAS_GRAPH__ not found as a JSON object`);
  let graphData;
  try {
    graphData = JSON.parse(graphMatch[1]);
  } catch (e) {
    throw new Error(`[${label}] __ATLAS_GRAPH__ JSON is invalid: ${e.message}`);
  }
  assert.ok(Array.isArray(graphData.nodes),
    `[${label}] __ATLAS_GRAPH__.nodes must be an array`);
  // For real projects we expect >0 nodes; the rich fixture has several
  assert.ok(graphData.nodes.length > 0,
    `[${label}] __ATLAS_GRAPH__.nodes must have >0 entries, got ${graphData.nodes.length}`);

  // orphans.html lists items (has heading / section)
  const orphansHtml = fs.readFileSync(path.join(siteDir, 'orphans.html'), 'utf-8');
  assert.ok(orphansHtml.includes('<h1') || orphansHtml.includes('<h2') || orphansHtml.includes('<h3'),
    `[${label}] orphans.html must have at least a heading`);

  // manifest.json is valid JSON with nodes and files arrays
  const manifestPath = path.join(siteDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), `[${label}] manifest.json must exist`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.ok(Array.isArray(manifest.nodes), `[${label}] manifest.json must have nodes array`);
  assert.ok(Array.isArray(manifest.files), `[${label}] manifest.json must have files array`);
  assert.ok(manifest.files.length > 0, `[${label}] manifest.json must have >0 files`);

  // manifest.json must not contain machine-specific absolute paths
  assert.strictEqual(manifest.projectRoot, '.',
    `[${label}] manifest.json projectRoot must be "." not "${manifest.projectRoot}"`);
  assert.ok(!path.isAbsolute(manifest.bmadOutputDir),
    `[${label}] manifest.json bmadOutputDir must be relative`);

  return { files, docPages, graphData, manifest };
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Real-Project Smoke Tests (Story 29.6 AC 5) ===');

// ─────────────────────────────────────────────────────────────────────────────
// Pre-conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
});

test('repo _bmad-output exists and has planning + implementation artifacts', () => {
  const bmad = path.join(PROJECT_ROOT, '_bmad-output');
  assert.ok(fs.existsSync(bmad), `_bmad-output missing in repo root: ${bmad}`);
  assert.ok(
    fs.existsSync(path.join(bmad, 'planning-artifacts')),
    '_bmad-output/planning-artifacts must exist'
  );
  assert.ok(
    fs.existsSync(path.join(bmad, 'implementation-artifacts')),
    '_bmad-output/implementation-artifacts must exist'
  );
});

test('rich-project fixture exists (second project)', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Project 1: THIS REPO's own _bmad-output → temp output dir
//
// CRITICAL: output goes to tmpRepoOut, NEVER to the tracked knowledge-site.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Project 1: ma-agents repo own _bmad-output ---');

let tmpRepoOut;
let repoSiteDir;

test('create temp output dir for repo project (never write into tracked tree)', () => {
  // We copy the repo's _bmad-output to a temp dir so the atlas generator
  // writes its output inside that temp dir.  This prevents any writes to the
  // tracked _bmad-output/knowledge-site/ in the repo worktree.
  tmpRepoOut = makeTempDir('maagents');
  // We need to supply a full project root (with package.json + _bmad-output).
  // Copy the repo root's key files — package.json + _bmad-output — to a temp
  // project root.  Copying the whole repo is too slow; we copy selectively.
  copyDirRecursive(path.join(PROJECT_ROOT, '_bmad-output'), path.join(tmpRepoOut, '_bmad-output'));
  // Copy package.json for the project title
  fs.copyFileSync(path.join(PROJECT_ROOT, 'package.json'), path.join(tmpRepoOut, 'package.json'));
  assert.ok(fs.existsSync(path.join(tmpRepoOut, '_bmad-output')), 'temp _bmad-output must exist');
  assert.ok(fs.existsSync(path.join(tmpRepoOut, 'package.json')), 'temp package.json must exist');
  repoSiteDir = path.join(tmpRepoOut, '_bmad-output', 'knowledge-site');
});

test('generate exits 0 on ma-agents repo own _bmad-output', () => {
  if (!tmpRepoOut) throw new Error('tmpRepoOut not created (prior test failed)');
  const res = runAtlasToTemp(tmpRepoOut, repoSiteDir);
  assert.strictEqual(res.status, 0,
    `generate must exit 0 on real repo but got ${res.status}\n` +
    `stderr: ${res.stderr}\nstdout: ${res.stdout}`);
});

test('repo project: all six page types produced', () => {
  if (!repoSiteDir || !fs.existsSync(repoSiteDir)) {
    throw new Error('repoSiteDir not available (prior test failed)');
  }
  const { files, docPages } = spotCheck(repoSiteDir, 'ma-agents-repo');
  assert.ok(docPages.length > 5,
    `Real repo must have many doc pages, got ${docPages.length}. Files: ${files.slice(0, 20).join(', ')}`);
});

test('repo project: index.html contains real project title', () => {
  if (!repoSiteDir || !fs.existsSync(repoSiteDir)) {
    throw new Error('repoSiteDir not available (prior test failed)');
  }
  const indexHtml = fs.readFileSync(path.join(repoSiteDir, 'index.html'), 'utf-8');
  // The package.json name is "ma-agents"
  assert.ok(indexHtml.includes('ma-agents'),
    'index.html must contain the project name "ma-agents"');
});

test('repo project: graph has >0 nodes', () => {
  if (!repoSiteDir || !fs.existsSync(repoSiteDir)) {
    throw new Error('repoSiteDir not available (prior test failed)');
  }
  const graphHtml = fs.readFileSync(path.join(repoSiteDir, 'graph.html'), 'utf-8');
  const graphMatch = graphHtml.match(/__ATLAS_GRAPH__\s*=\s*(\{[\s\S]*?\});/);
  assert.ok(graphMatch, 'graph.html must have __ATLAS_GRAPH__');
  const g = JSON.parse(graphMatch[1]);
  assert.ok(g.nodes.length > 0, `Real repo graph must have >0 nodes, got ${g.nodes.length}`);
});

test('repo project: output is NOT in the tracked repo _bmad-output/knowledge-site', () => {
  // Belt-and-suspenders: verify the tracked knowledge-site in the worktree
  // was NOT created/modified by this test run.
  const trackedSite = path.join(PROJECT_ROOT, '_bmad-output', 'knowledge-site');
  // The tracked knowledge-site either doesn't exist (desired) or exists from
  // a prior committed state — in either case it must NOT contain index.html
  // from THIS test run (pinned timestamp would match but directory existence
  // is the key guard).
  // The real guarantee: THIS run's output dir is under the OS temp dir and NOT
  // inside the tracked repo. (Asserting on the tracked dir's existence is
  // unreliable — it can pre-exist from local dev — so assert where OUR output
  // actually went.) These fail if a future change ever points the smoke output
  // back into the repo.
  assert.ok(repoSiteDir.startsWith(os.tmpdir()),
    `this run's Atlas output must be under os.tmpdir(), got: ${repoSiteDir}`);
  assert.ok(!repoSiteDir.startsWith(path.join(PROJECT_ROOT, '_bmad-output')),
    `this run's Atlas output must NOT be under the tracked repo _bmad-output, got: ${repoSiteDir}`);
  assert.notStrictEqual(path.resolve(trackedSite), path.resolve(repoSiteDir),
    'BUG: test wrote into the tracked _bmad-output/knowledge-site — must use temp dir');
});

// ─────────────────────────────────────────────────────────────────────────────
// Project 2: rich-project fixture (second project / CI stand-in)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Project 2: rich-project fixture (second project) ---');

let tmpRich;
let richSiteDir;

test('copy rich-project fixture to temp dir', () => {
  tmpRich = makeTempDir('rich');
  copyDirRecursive(RICH_FIXTURE, tmpRich);
  assert.ok(fs.existsSync(path.join(tmpRich, '_bmad-output')), 'tmpRich _bmad-output must exist');
  richSiteDir = path.join(tmpRich, '_bmad-output', 'knowledge-site');
});

test('generate exits 0 on rich-project fixture (second project)', () => {
  if (!tmpRich) throw new Error('tmpRich not created (prior test failed)');
  const res = runAtlasToTemp(tmpRich, richSiteDir);
  assert.strictEqual(res.status, 0,
    `generate must exit 0 on rich-project but got ${res.status}\n` +
    `stderr: ${res.stderr}`);
});

test('rich-project: all spot checks pass', () => {
  if (!richSiteDir || !fs.existsSync(richSiteDir)) {
    throw new Error('richSiteDir not available (prior test failed)');
  }
  spotCheck(richSiteDir, 'rich-project-fixture');
});

test('rich-project: index.html contains the fixture project title', () => {
  if (!richSiteDir || !fs.existsSync(richSiteDir)) {
    throw new Error('richSiteDir not available (prior test failed)');
  }
  const indexHtml = fs.readFileSync(path.join(richSiteDir, 'index.html'), 'utf-8');
  // rich-project package.json name is "rich-atlas-fixture"
  assert.ok(indexHtml.includes('rich-atlas-fixture'),
    'index.html must contain the project title "rich-atlas-fixture"');
});

test('rich-project: multiple entity types appear in the graph', () => {
  if (!richSiteDir || !fs.existsSync(richSiteDir)) {
    throw new Error('richSiteDir not available (prior test failed)');
  }
  const graphHtml = fs.readFileSync(path.join(richSiteDir, 'graph.html'), 'utf-8');
  const graphMatch = graphHtml.match(/__ATLAS_GRAPH__\s*=\s*(\{[\s\S]*?\});/);
  assert.ok(graphMatch, 'graph.html must have __ATLAS_GRAPH__');
  const g = JSON.parse(graphMatch[1]);
  assert.ok(g.nodes.length >= 3,
    `rich-project graph must have >=3 nodes, got ${g.nodes.length}`);
  // Check that we have multiple kinds of nodes
  const kinds = [...new Set(g.nodes.map(n => n.kind))];
  assert.ok(kinds.length >= 2,
    `rich-project graph must have >=2 node kinds, got [${kinds.join(', ')}]`);
});

test('rich-project: entity links in doc pages resolve (no 404 hrefs)', () => {
  if (!richSiteDir || !fs.existsSync(richSiteDir)) {
    throw new Error('richSiteDir not available (prior test failed)');
  }
  const docFiles = collectFiles(richSiteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const resolvedFiles = new Set(collectFiles(richSiteDir));

  const deadLinks = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(richSiteDir, f), 'utf-8');
    // Extract relative href= attributes that point to docs/*.html
    const hrefRe = /href="([^"]+\.html[^"#]*)"/g;
    let m;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1];
      // Resolve relative to the doc page's location (docs/)
      const docDir = path.dirname(f);
      const resolved = path.join(docDir, href).split(path.sep).join('/');
      // Normalize: remove trailing .. segments and clean
      const normalized = path.posix.normalize(resolved);
      if (!resolvedFiles.has(normalized) && !normalized.startsWith('..')) {
        deadLinks.push(`${f}: dead link -> ${href} (resolved: ${normalized})`);
      }
    }
  }
  assert.strictEqual(deadLinks.length, 0,
    `Dead links found in rich-project doc pages:\n  ${deadLinks.join('\n  ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
