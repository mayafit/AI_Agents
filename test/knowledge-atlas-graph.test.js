#!/usr/bin/env node
/**
 * test/knowledge-atlas-graph.test.js
 * ---------------------------------------------------------------------------
 * Story 29.4 — Tests for graph, diagrams, and orphan/gap renderers.
 *
 * AC coverage:
 *   AC 1 — Interactive graph page: __ATLAS_GRAPH__ data matches manifest nodes/edges
 *   AC 2 — Generated diagrams: traceability spine, epic trees, status board
 *   AC 3 — Orphan/gap view: seeded orphans detected; dangling refs excluded for shipped-in
 *   AC 4 — Graceful degradation: no-JS fallback present in graph.html
 *   AC 5 — No CDN/external URLs/fetch()/web-fonts in any generated page
 *   AC 6 — Tests green; 29.1 smoke + 29.2 manifest still pass; determinism
 *
 * Test style: plain Node assert (no framework), repo style.
 *
 * Key principles:
 *   - NEVER mutate committed fixtures. All generation against TEMP COPY.
 *   - Pin SOURCE_DATE_EPOCH for deterministic output.
 *   - Windows/Linux compatible (LF-normalized reads, path.join everywhere).
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ATLAS_CJS = path.join(__dirname, '..', 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');

// Pin SOURCE_DATE_EPOCH for determinism (NFR62)
const PINNED_EPOCH = '1700000000'; // 2023-11-14T22:13:20Z

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-graph-${prefix}-`));
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
function readKnowledgeSiteFile(tmpDir, filename) {
  const p = path.join(tmpDir, '_bmad-output', 'knowledge-site', filename);
  if (!fs.existsSync(p)) throw new Error(`Generated file not found: ${p}`);
  return fs.readFileSync(p, 'utf-8');
}

/** SHA-256 of file content (bytes). */
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ─── Pre-conditions ──────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Graph Tests (Story 29.4) ===');

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

let richTmpDir;
let richManifest;
let graphHtml;
let diagramsHtml;
let orphansHtml;

test('generate rich-project (temp copy)', () => {
  richTmpDir = makeTempDir('rich');
  copyDirRecursive(RICH_FIXTURE, richTmpDir);
  richManifest = runAtlas(richTmpDir);
  assert.ok(richManifest, 'manifest must be a parsed object');
});

test('graph.html is generated', () => {
  if (!richTmpDir) throw new Error('richTmpDir not created (prior test failed)');
  graphHtml = readKnowledgeSiteFile(richTmpDir, 'graph.html');
  assert.ok(graphHtml.length > 1000, `graph.html too short: ${graphHtml.length} bytes`);
});

test('diagrams.html is generated', () => {
  if (!richTmpDir) throw new Error('richTmpDir not created (prior test failed)');
  diagramsHtml = readKnowledgeSiteFile(richTmpDir, 'diagrams.html');
  assert.ok(diagramsHtml.length > 500, `diagrams.html too short: ${diagramsHtml.length} bytes`);
});

test('orphans.html is generated', () => {
  if (!richTmpDir) throw new Error('richTmpDir not created (prior test failed)');
  orphansHtml = readKnowledgeSiteFile(richTmpDir, 'orphans.html');
  assert.ok(orphansHtml.length > 500, `orphans.html too short: ${orphansHtml.length} bytes`);
});

// ─── AC 1: __ATLAS_GRAPH__ node/edge counts and kinds match manifest ─────────
console.log('\n--- AC 1: __ATLAS_GRAPH__ data matches manifest ---');

/**
 * Extract the __ATLAS_GRAPH__ JS object from graph.html.
 *
 * Parses from the opening '{' with proper brace-matching that respects JSON
 * string literals (and their backslash escapes), rather than cutting at the
 * first ';' — a ';' inside a string value (e.g. a node label) would otherwise
 * truncate the JSON and break the parse (test hardening #10).
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
  const jsonStr = html.slice(objStart, end + 1);
  return JSON.parse(jsonStr);
}

test('graph.html embeds __ATLAS_GRAPH__ variable', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  assert.ok(graphHtml.includes('window.__ATLAS_GRAPH__'), 'must contain __ATLAS_GRAPH__');
});

test('__ATLAS_GRAPH__.nodes count matches manifest.nodes.length', () => {
  if (!graphHtml || !richManifest) throw new Error('prerequisites not available');
  const graphData = extractAtlasGraph(graphHtml);
  assert.ok(Array.isArray(graphData.nodes), '__ATLAS_GRAPH__.nodes must be an array');
  assert.strictEqual(
    graphData.nodes.length,
    richManifest.nodes.length,
    `Graph node count ${graphData.nodes.length} must match manifest node count ${richManifest.nodes.length}`
  );
});

test('__ATLAS_GRAPH__.edges count matches manifest.edges.length', () => {
  if (!graphHtml || !richManifest) throw new Error('prerequisites not available');
  const graphData = extractAtlasGraph(graphHtml);
  assert.ok(Array.isArray(graphData.edges), '__ATLAS_GRAPH__.edges must be an array');
  assert.strictEqual(
    graphData.edges.length,
    richManifest.edges.length,
    `Graph edge count ${graphData.edges.length} must match manifest edge count ${richManifest.edges.length}`
  );
});

test('__ATLAS_GRAPH__ nodes include all manifest node kinds', () => {
  if (!graphHtml || !richManifest) throw new Error('prerequisites not available');
  const graphData = extractAtlasGraph(graphHtml);
  const graphKinds = new Set(graphData.nodes.map(n => n.kind));
  const manifestKinds = new Set(richManifest.nodes.map(n => n.kind));
  for (const kind of manifestKinds) {
    assert.ok(graphKinds.has(kind), `graph must include nodes of kind: ${kind}`);
  }
});

test('__ATLAS_GRAPH__ nodes have required fields: id, label, kind, fileId', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  const graphData = extractAtlasGraph(graphHtml);
  for (const node of graphData.nodes.slice(0, 20)) { // check first 20 for speed
    assert.ok(typeof node.id === 'string' && node.id, `node must have string id`);
    assert.ok(typeof node.label === 'string' && node.label, `node must have label`);
    assert.ok(typeof node.kind === 'string' && node.kind, `node must have kind`);
    assert.ok(typeof node.fileId === 'string' && node.fileId, `node must have fileId`);
    assert.ok(typeof node.color === 'string', 'node must have color');
    assert.ok(typeof node.shape === 'string', 'node must have shape');
  }
});

test('__ATLAS_GRAPH__ edges have source, target, kind fields', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  const graphData = extractAtlasGraph(graphHtml);
  for (const edge of graphData.edges.slice(0, 20)) {
    assert.ok(typeof edge.source === 'string', 'edge must have source');
    assert.ok(typeof edge.target === 'string', 'edge must have target');
    assert.ok(typeof edge.kind === 'string', 'edge must have kind');
    assert.ok(typeof edge.color === 'string', 'edge must have color');
  }
});

// ─── AC 2: Generated diagrams ────────────────────────────────────────────────
console.log('\n--- AC 2: Generated diagrams ---');

test('diagrams.html contains traceability spine section', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  assert.ok(
    diagramsHtml.includes('Traceability Spine'),
    'diagrams.html must have a Traceability Spine section'
  );
  // Must have the spine-table element
  assert.ok(diagramsHtml.includes('spine-table'), 'must have spine-table');
});

test('diagrams.html traceability spine renders connectors (finding #7)', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  // The rich fixture has cross-column relationships, so at least one forward
  // connector glyph must render (proves edges drive the spine, not just columns).
  assert.ok(diagramsHtml.includes('spine-connector'),
    'traceability spine must render forward-link connectors driven by manifest edges'
  );
});

test('diagrams.html traceability spine contains expected node kinds', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  // Column headers for node kinds
  assert.ok(diagramsHtml.includes('Requirements (FR)'), 'must have Requirements column');
  assert.ok(diagramsHtml.includes('Epics'), 'must have Epics column');
  assert.ok(diagramsHtml.includes('Stories'), 'must have Stories column');
});

test('diagrams.html contains epic-story tree section', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  assert.ok(
    diagramsHtml.includes('Epic') && diagramsHtml.includes('Story'),
    'diagrams.html must have epic-story trees'
  );
  assert.ok(diagramsHtml.includes('epic-tree') || diagramsHtml.includes('epic-trees'),
    'must have epic-trees element'
  );
});

test('diagrams.html contains status board section', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  assert.ok(
    diagramsHtml.includes('Status Board') || diagramsHtml.includes('Status board') ||
    diagramsHtml.includes('Sprint / Status Board'),
    'diagrams.html must have a status board'
  );
  // Must have lifecycle status columns
  assert.ok(diagramsHtml.includes('In Progress') || diagramsHtml.includes('in-progress'),
    'status board must include in-progress column'
  );
  assert.ok(diagramsHtml.includes('Done') || diagramsHtml.includes('done'),
    'status board must include done column'
  );
});

test('diagrams.html has ARIA labels on diagram sections', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  assert.ok(diagramsHtml.includes('aria-label'), 'diagrams.html must have aria-label attributes');
});

test('diagrams.html has horizontal scroll wrappers for wide content', () => {
  if (!diagramsHtml) throw new Error('diagramsHtml not loaded (prior test failed)');
  assert.ok(diagramsHtml.includes('scroll-wrapper'), 'must have scroll-wrapper elements for wide diagrams');
});

// ─── AC 3: Orphan / gap view ─────────────────────────────────────────────────
console.log('\n--- AC 3: Orphan / gap view ---');

test('orphans.html contains all required orphan sections', () => {
  if (!orphansHtml) throw new Error('orphansHtml not loaded (prior test failed)');
  assert.ok(orphansHtml.includes('Unreferenced Requirements'), 'must have Unreferenced Requirements section');
  assert.ok(orphansHtml.includes('Stories with No Requirement'), 'must have Stories with No Requirement section');
  assert.ok(orphansHtml.includes('Bugs with No Link'), 'must have Bugs with No Link section');
  assert.ok(orphansHtml.includes('Epics with No Retrospective'), 'must have Epics with No Retrospective section');
  assert.ok(orphansHtml.includes('Dangling References'), 'must have Dangling References section');
});

test('orphans.html has a summary section', () => {
  if (!orphansHtml) throw new Error('orphansHtml not loaded (prior test failed)');
  assert.ok(orphansHtml.includes('Summary'), 'must have a Summary section');
});

// ─── AC 3 (seeded orphans): Add fixture orphans and verify detection ──────────
console.log('\n--- AC 3: Seeded orphan detection ---');

let orphanTmpDir;
let seededOrphansHtml;
let seededManifest;

test('setup: create fixture with seeded orphans (req with no story + epic with no retro)', () => {
  orphanTmpDir = makeTempDir('seeded-orphans');
  copyDirRecursive(RICH_FIXTURE, orphanTmpDir);

  // Add a requirement with no implementing story (FR999: orphaned requirement)
  const prdPath = path.join(orphanTmpDir, '_bmad-output', 'planning-artifacts', 'prd.md');
  const prdContent = fs.readFileSync(prdPath, 'utf-8');
  fs.writeFileSync(prdPath,
    prdContent + '\n### FR999: Orphaned Requirement\n\nThis requirement has no implementing story.\n',
    'utf-8'
  );

  // Add an epic with no retrospective (Epic 3 — orphaned epic)
  const epicsPath = path.join(orphanTmpDir, '_bmad-output', 'planning-artifacts', 'epics.md');
  const epicsContent = fs.readFileSync(epicsPath, 'utf-8');
  fs.writeFileSync(epicsPath,
    epicsContent + '\n## Epic 3: Orphaned Epic\n\nEpic 3 has no retrospective.\nImplements FR999.\n',
    'utf-8'
  );

  // Generate
  seededManifest = runAtlas(orphanTmpDir);
  assert.ok(seededManifest, 'must generate manifest');
});

test('seeded orphan: FR999 appears in manifest as a requirement node', () => {
  if (!seededManifest) throw new Error('seededManifest not available (prior test failed)');
  const fr999 = seededManifest.nodes.find(n => n.label === 'FR999');
  assert.ok(fr999, `FR999 node must exist in manifest, got: ${seededManifest.nodes.map(n => n.label).join(', ')}`);
  assert.strictEqual(fr999.kind, 'requirement', 'FR999 must be classified as requirement');
});

test('seeded orphan: orphans.html flags FR999 as unreferenced requirement', () => {
  if (!orphanTmpDir) throw new Error('orphanTmpDir not created (prior test failed)');
  seededOrphansHtml = readKnowledgeSiteFile(orphanTmpDir, 'orphans.html');
  assert.ok(
    seededOrphansHtml.includes('FR999'),
    'orphans.html must mention FR999 as an unreferenced requirement'
  );
});

test('seeded orphan: orphans.html flags Epic 3 as epic with no retrospective', () => {
  if (!seededOrphansHtml) throw new Error('seededOrphansHtml not available (prior test failed)');
  // Epic 3 should appear in the "Epics with No Retrospective" section
  // The text "Epic 3" must be in the page
  assert.ok(
    seededOrphansHtml.includes('Epic 3'),
    'orphans.html must mention Epic 3 as an epic with no retrospective'
  );
});

test('seeded orphan: shipped-in edges are NOT flagged as dangling', () => {
  if (!seededManifest) throw new Error('seededManifest not available (prior test failed)');
  // shipped-in edges target version: ids which are terminal by design
  const shipEdges = seededManifest.edges.filter(e => e.kind === 'shipped-in');
  for (const e of shipEdges) {
    assert.ok(!e.dangling, `shipped-in edge must not be dangling: ${e.to}`);
  }
  // Also verify they don't appear in orphans.html dangling section
  if (seededOrphansHtml) {
    const danglingSection = seededOrphansHtml.slice(
      seededOrphansHtml.indexOf('Dangling References')
    );
    // 'version:' style ids should not appear in dangling table
    const hasVersionDangling = danglingSection.includes('version:');
    assert.ok(!hasVersionDangling,
      'Dangling references section must not contain version: targets from shipped-in edges'
    );
  }
});

// ─── KG-sourced dangling edge surfaces in orphan view (finding #3) ───────────
console.log('\n--- KG-sourced dangling edge (finding #3) ---');

test('KG edge with dangling:true surfaces in orphans.html Dangling References (finding #3)', () => {
  const tmp = makeTempDir('kg-dangling');
  copyDirRecursive(RICH_FIXTURE, tmp);
  // Seed a knowledge-graph.json edge flagged dangling whose target does not exist.
  const kg = {
    meta: { generated: '2026-06-01T00:00:00Z', version: '1.0' },
    nodes: [],
    edges: [
      {
        from: '_bmad-output/planning-artifacts/prd.md#fr101-user-authentication',
        to: 'missing-target-from-kg#ghost',
        kind: 'depends-on',
        dangling: true,
      },
    ],
  };
  fs.writeFileSync(
    path.join(tmp, '_bmad-output', 'knowledge-graph.json'),
    JSON.stringify(kg, null, 2) + '\n',
    'utf-8'
  );
  const manifest = runAtlas(tmp);
  // The reconciled manifest must retain the dangling flag (the bug dropped it).
  const danglingEdge = manifest.edges.find(e => e.to === 'missing-target-from-kg#ghost');
  assert.ok(danglingEdge, 'KG-sourced edge must be present in manifest');
  assert.strictEqual(danglingEdge.dangling, true,
    'KG-sourced edge must keep dangling:true through reconcile (finding #3)'
  );
  // And it must surface in the orphan view's Dangling References section.
  const html = readKnowledgeSiteFile(tmp, 'orphans.html');
  const danglingSection = html.slice(html.indexOf('Dangling References'));
  assert.ok(danglingSection.includes('missing-target-from-kg'),
    'orphans.html Dangling References must list the KG-sourced dangling target'
  );
});

// ─── Security: XSS / protocol injection (review findings #1, #2) ─────────────
console.log('\n--- Security: XSS / protocol injection ---');

let xssTmpDir;
let xssGraphHtml;
let xssDiagramsHtml;
let xssOrphansHtml;

test('setup: fixture with hostile KG node (</script> label + javascript: fileId)', () => {
  xssTmpDir = makeTempDir('xss');
  copyDirRecursive(RICH_FIXTURE, xssTmpDir);

  // The knowledge-graph.json reconcile path accepts arbitrary label/id/fileId —
  // the realistic injection vector. Seed a node whose label tries to break out of
  // the inline <script> block and whose fileId is a javascript: URL.
  const kg = {
    meta: { generated: '2026-06-01T00:00:00Z', version: '1.0' },
    nodes: [
      {
        id: 'evil-node-1',
        kind: 'story',
        label: '</script><script>window.__XSS__=1//',
        fileId: 'javascript:alert(1)//',
        anchor: 'x',
      },
      {
        id: 'evil-node-2',
        kind: 'requirement',
        label: 'EVIL-REQ',
        fileId: 'https://evil.example.com/payload',
        anchor: 'y',
      },
    ],
    edges: [],
  };
  const kgPath = path.join(xssTmpDir, '_bmad-output', 'knowledge-graph.json');
  fs.writeFileSync(kgPath, JSON.stringify(kg, null, 2) + '\n', 'utf-8');

  runAtlas(xssTmpDir);
  xssGraphHtml = readKnowledgeSiteFile(xssTmpDir, 'graph.html');
  xssDiagramsHtml = readKnowledgeSiteFile(xssTmpDir, 'diagrams.html');
  xssOrphansHtml = readKnowledgeSiteFile(xssTmpDir, 'orphans.html');
});

test('XSS: </script> in a node label does NOT inject a new script block (finding #1)', () => {
  if (!xssGraphHtml) throw new Error('xssGraphHtml not loaded (prior test failed)');
  // Count <script ...> opening tags. graph.html has exactly 3 legitimate ones:
  //   (1) vendored force-graph, (2) __ATLAS_GRAPH__ data, (3) app script.
  // The hostile '</script><script>' payload must be neutralized (unicode-escaped),
  // so it must NOT raise the count.
  const scriptOpens = (xssGraphHtml.match(/<script(\s|>)/gi) || []).length;
  assert.strictEqual(scriptOpens, 3,
    `graph.html must have exactly 3 <script> blocks (payload escaped), got ${scriptOpens}`
  );
  // The literal closing-tag payload must not appear unescaped in the data block.
  assert.ok(!xssGraphHtml.includes('</script><script>window.__XSS__'),
    'raw breakout payload must not appear unescaped'
  );
  // The escaped form must be present, proving the data was embedded but neutralized.
  assert.ok(xssGraphHtml.includes('\\u003c/script\\u003e') || xssGraphHtml.includes('\\u003c'),
    'the < of the payload must be unicode-escaped in the embedded JSON'
  );
});

test('XSS: embedded graph data still parses as JSON after escaping (finding #1)', () => {
  if (!xssGraphHtml) throw new Error('xssGraphHtml not loaded (prior test failed)');
  // extractAtlasGraph un-escapes < automatically via JSON.parse — the node
  // must round-trip with its original label intact (data preserved, just safe).
  const data = extractAtlasGraph(xssGraphHtml);
  const evil = data.nodes.find(n => n.id === 'evil-node-1');
  assert.ok(evil, 'hostile node must still be present in parsed data');
  assert.ok(evil.label.includes('</script>'),
    'label round-trips to its original value after JSON.parse (escaping is transport-only)'
  );
});

test('protocol injection: javascript: fileId is neutralized in graph data (finding #2)', () => {
  if (!xssGraphHtml) throw new Error('xssGraphHtml not loaded (prior test failed)');
  const data = extractAtlasGraph(xssGraphHtml);
  const evil = data.nodes.find(n => n.id === 'evil-node-1');
  assert.ok(evil, 'hostile node must be present');
  assert.strictEqual(evil.fileId, '#invalid',
    `javascript: fileId must be neutralized to #invalid, got: ${evil.fileId}`
  );
});

test('protocol injection: javascript: fileId yields non-executable href in diagrams.html (finding #2)', () => {
  if (!xssDiagramsHtml) throw new Error('xssDiagramsHtml not loaded (prior test failed)');
  assert.ok(!/href="javascript:/i.test(xssDiagramsHtml),
    'diagrams.html must not contain a javascript: href'
  );
});

test('protocol injection: javascript:/https: fileId yields non-executable href in orphans.html (finding #2)', () => {
  if (!xssOrphansHtml) throw new Error('xssOrphansHtml not loaded (prior test failed)');
  assert.ok(!/href="javascript:/i.test(xssOrphansHtml),
    'orphans.html must not contain a javascript: href'
  );
  // The https: external fileId (evil-node-2) must also be neutralized — no
  // href that points off-origin via the hostile fileId.
  assert.ok(!xssOrphansHtml.includes('href="https://evil.example.com'),
    'orphans.html must not contain an external https: href from a hostile fileId'
  );
});

test('protocol injection: hostile fileIds do not produce external href in graph.html either', () => {
  if (!xssGraphHtml) throw new Error('xssGraphHtml not loaded (prior test failed)');
  // graph.html has no <a href> for nodes (it navigates via JS), but assert there
  // is no javascript: href anywhere regardless.
  assert.ok(!/href="javascript:/i.test(xssGraphHtml),
    'graph.html must not contain a javascript: href'
  );
});

// ─── AC 4: Graceful degradation — no-JS fallback ────────────────────────────
console.log('\n--- AC 4: Graceful degradation (no-JS fallback) ---');

test('graph.html has <noscript> fallback element', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  assert.ok(graphHtml.includes('<noscript>'), 'graph.html must have <noscript> fallback');
});

test('graph.html no-JS fallback contains node count', () => {
  if (!graphHtml || !richManifest) throw new Error('prerequisites not available');
  // The fallback must show the total node count from the manifest
  const nodeCount = richManifest.counts['nodes'] ?? 0;
  assert.ok(
    graphHtml.includes(String(nodeCount)),
    `graph.html fallback must display node count ${nodeCount}`
  );
});

test('graph.html no-JS fallback contains links to diagrams.html and orphans.html', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  assert.ok(graphHtml.includes('diagrams.html'), 'graph.html fallback must link to diagrams.html');
  assert.ok(graphHtml.includes('orphans.html'), 'graph.html fallback must link to orphans.html');
});

test('graph.html no-JS fallback contains legend with node kinds', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  // Legend must be present in the static HTML (not JS-only)
  assert.ok(graphHtml.includes('legend'), 'graph.html must have legend in static HTML');
  // At least one node kind label should be in the static legend
  assert.ok(
    graphHtml.includes('Epic') || graphHtml.includes('Story') || graphHtml.includes('Requirement'),
    'graph.html legend must include node kind labels'
  );
});

test('graph.html fallback is legible (no blank canvas on zero-JS)', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded (prior test failed)');
  // The noscript element must contain meaningful content
  const noscriptStart = graphHtml.indexOf('<noscript>');
  const noscriptEnd = graphHtml.indexOf('</noscript>');
  assert.ok(noscriptStart >= 0 && noscriptEnd > noscriptStart, 'must have complete <noscript> block');
  const noscriptContent = graphHtml.slice(noscriptStart, noscriptEnd);
  // Must have more than trivial content
  assert.ok(noscriptContent.length > 200, `noscript content must be substantial, got ${noscriptContent.length} chars`);
});

// ─── AC 5: No external URLs, CDN scripts, fetch calls, or web fonts ──────────
console.log('\n--- AC 5: Sealed packaging (no CDN/fetch/external) ---');

const pages = [
  { name: 'graph.html',    content: () => graphHtml },
  { name: 'diagrams.html', content: () => diagramsHtml },
  { name: 'orphans.html',  content: () => orphansHtml },
];

/**
 * Strip the vendored force-graph script block from graph.html before URL checks.
 * The force-graph UMD bundle contains W3C namespace URIs (e.g. http://www.w3.org/...)
 * and GitHub repo links in comments. These are not network fetches — they are string
 * literals baked into the vendored code. The AC "no external URLs" means no CDN/fetch
 * at view-time, not that namespace URIs are forbidden inside vendored bundles.
 */
function stripVendorBlock(html, filename) {
  if (filename !== 'graph.html') return html;
  // Strip from the force-graph vendor comment to the closing </script> of that block
  const vendorStart = html.indexOf('/* force-graph v');
  const vendorEnd = html.indexOf('</script>', vendorStart);
  if (vendorStart >= 0 && vendorEnd >= 0) {
    return html.slice(0, vendorStart) + html.slice(vendorEnd);
  }
  return html;
}

for (const page of pages) {
  test(`${page.name}: no http:// URLs (excluding vendored bundle)`, () => {
    const html = page.content();
    if (!html) throw new Error(`${page.name} not loaded`);
    const stripped = stripVendorBlock(html, page.name);
    assert.ok(!stripped.includes('http://'), `${page.name} must not contain http:// URLs outside vendored bundle`);
  });

  test(`${page.name}: no https:// URLs (excluding vendored bundle)`, () => {
    const html = page.content();
    if (!html) throw new Error(`${page.name} not loaded`);
    const stripped = stripVendorBlock(html, page.name);
    assert.ok(!stripped.includes('https://'), `${page.name} must not contain https:// URLs outside vendored bundle`);
  });

  test(`${page.name}: no external <script src=`, () => {
    const html = page.content();
    if (!html) throw new Error(`${page.name} not loaded`);
    // Allow inline <script> and <script> without src, but not <script src=
    const externalScript = /<script\s+src=/i.test(html);
    assert.ok(!externalScript, `${page.name} must not have external <script src=...>`);
  });

  test(`${page.name}: no fetch( calls`, () => {
    const html = page.content();
    if (!html) throw new Error(`${page.name} not loaded`);
    // Allow 'prefetch' but not window.fetch() or import.fetch; strip vendor block first
    const stripped = stripVendorBlock(html, page.name);
    const hasFetchCall = /[^a-z-]fetch\s*\(/.test(stripped);
    assert.ok(!hasFetchCall, `${page.name} must not contain fetch() calls outside vendored bundle`);
  });

  test(`${page.name}: no web font imports`, () => {
    const html = page.content();
    if (!html) throw new Error(`${page.name} not loaded`);
    assert.ok(!html.includes('fonts.googleapis'), `${page.name} must not reference Google Fonts`);
    assert.ok(!html.includes('fonts.gstatic'), `${page.name} must not reference Google Fonts CDN`);
    assert.ok(!/\@import\s+url\s*\(['"]https?:/.test(html), `${page.name} must not import web fonts via URL`);
  });
}

// ─── AC 6: Determinism (two builds byte-identical) ───────────────────────────
console.log('\n--- AC 6: Determinism ---');

test('two builds with pinned epoch produce byte-identical graph.html, diagrams.html, orphans.html', () => {
  const tmpA = makeTempDir('det-A');
  const tmpB = makeTempDir('det-B');
  copyDirRecursive(RICH_FIXTURE, tmpA);
  copyDirRecursive(RICH_FIXTURE, tmpB);

  runAtlas(tmpA);
  runAtlas(tmpB);

  for (const filename of ['graph.html', 'diagrams.html', 'orphans.html']) {
    const pathA = path.join(tmpA, '_bmad-output', 'knowledge-site', filename);
    const pathB = path.join(tmpB, '_bmad-output', 'knowledge-site', filename);
    assert.ok(fs.existsSync(pathA), `${filename} must exist in run A`);
    assert.ok(fs.existsSync(pathB), `${filename} must exist in run B`);
    const hashA = fileHash(pathA);
    const hashB = fileHash(pathB);
    assert.strictEqual(hashA, hashB,
      `Two builds must produce byte-identical ${filename}: hashA=${hashA.slice(0,8)}, hashB=${hashB.slice(0,8)}`
    );
  }
});

// ─── LF line endings ─────────────────────────────────────────────────────────
console.log('\n--- LF line endings ---');

for (const { name } of pages) {
  test(`${name}: uses LF line endings`, () => {
    if (!richTmpDir) throw new Error('richTmpDir not created');
    const p = path.join(richTmpDir, '_bmad-output', 'knowledge-site', name);
    if (!fs.existsSync(p)) throw new Error(`${name} not found at ${p}`);
    const raw = fs.readFileSync(p);
    const str = raw.toString('binary');
    assert.ok(!str.includes('\r\n'), `${name} must use LF line endings, not CRLF`);
  });
}

// ─── Write isolation ─────────────────────────────────────────────────────────
console.log('\n--- Write isolation ---');

test('nothing written outside _bmad-output/knowledge-site/', () => {
  if (!richTmpDir) throw new Error('richTmpDir not created');

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

  const allFiles = collectFiles(richTmpDir);
  const outsideKS = allFiles.filter(f => !f.startsWith('_bmad-output/knowledge-site/'));
  const originalFiles = collectFiles(RICH_FIXTURE);

  for (const f of outsideKS) {
    assert.ok(originalFiles.includes(f),
      `Engine wrote a new file outside _bmad-output/knowledge-site/: ${f}`
    );
  }
});

// ─── graph.html pages are valid HTML ─────────────────────────────────────────
console.log('\n--- HTML validity ---');

for (const { name, content } of pages) {
  test(`${name}: valid HTML structure`, () => {
    const html = content();
    if (!html) throw new Error(`${name} not loaded`);
    assert.ok(html.startsWith('<!DOCTYPE html>'), `${name} must start with <!DOCTYPE html>`);
    assert.ok(html.includes('<html lang="en">'), `${name} must have <html lang="en">`);
    assert.ok(html.includes('<head>'), `${name} must have <head>`);
    // Allow body with or without class attributes (e.g. <body class="graph-page">)
    assert.ok(/<body[\s>]/.test(html), `${name} must have <body>`);
    assert.ok(html.includes('</html>'), `${name} must have </html>`);
    assert.ok(html.endsWith('\n'), `${name} must end with a trailing newline`);
  });
}

// ─── force-graph is vendored (no CDN reference) ───────────────────────────────
console.log('\n--- force-graph vendoring ---');

test('graph.html contains vendored force-graph JS (inline, no CDN)', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  // The UMD bundle includes a characteristic marker (module factory pattern)
  const hasForceGraphMarker = graphHtml.includes('ForceGraph') || graphHtml.includes('force-graph');
  assert.ok(hasForceGraphMarker, 'graph.html must contain vendored force-graph code');
  // No CDN reference
  assert.ok(!graphHtml.includes('unpkg.com'), 'must not reference unpkg CDN');
  assert.ok(!graphHtml.includes('cdn.jsdelivr'), 'must not reference jsDelivr CDN');
  assert.ok(!graphHtml.includes('cdnjs.cloudflare'), 'must not reference cdnjs CDN');
});

// ─── Filter correctness (finding #5) ────────────────────────────────────────
console.log('\n--- Filter correctness ---');

test('edge-kind filter restricts nodes to matching-edge endpoints (finding #5)', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  // The buggy version kept a `|| !filterNodeKind` short-circuit that let every
  // node pass when only an edge filter was active. Assert that short-circuit is
  // gone and the corrected restriction is present in the embedded app script.
  assert.ok(!/referencedIds\.has\(n\.id\)\s*\|\|\s*!filterNodeKind/.test(graphHtml),
    'edge filter must not short-circuit node restriction with || !filterNodeKind'
  );
  assert.ok(graphHtml.includes('return referencedIds.has(n.id);'),
    'edge filter must restrict nodes to endpoints of matching edges'
  );
});

// ─── FR222: distinct shape per entity type ──────────────────────────────────
console.log('\n--- FR222: node shape rendering ---');

test('the force-graph canvas config paints a distinct shape per node (not color+size only)', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  // Before the fix, the canvas only called .nodeColor()/.nodeVal() — shape was
  // never read from NODE_STYLES/window.__ATLAS_GRAPH__ node.shape at all.
  assert.ok(graphHtml.includes('.nodeCanvasObject('),
    'graph.html app script must register a nodeCanvasObject to draw per-kind shapes');
  assert.ok(graphHtml.includes('.nodePointerAreaPaint('),
    'graph.html app script must register a matching nodePointerAreaPaint (so click/hover ' +
    'hit-testing still works for non-circle shapes)');
  assert.ok(/traceNodeShapePath\([^)]*n\.shape/.test(graphHtml),
    'the canvas draw path must be driven by the per-node `shape` field embedded in __ATLAS_GRAPH__');
});

test('the shape-tracing helper distinguishes circle/square/diamond/triangle', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  for (const shape of ['square', 'diamond', 'triangle']) {
    assert.ok(graphHtml.includes(`case '${shape}':`),
      `graph.html app script must have a distinct draw case for shape "${shape}"`);
  }
});

test('legend swatches carry data-shape and CSS renders a distinct shape per data-shape value', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  // Every NODE_STYLES shape actually used must appear as a data-shape attribute...
  for (const shape of ['circle', 'square', 'diamond', 'triangle']) {
    assert.ok(new RegExp(`data-shape="${shape}"`).test(graphHtml),
      `legend must tag a swatch with data-shape="${shape}"`);
    // ...and the inline <style> block must style that data-shape selector (the
    // pre-fix bug: data-shape was emitted but never matched by any CSS rule,
    // so every swatch rendered identically regardless of the attribute).
    assert.ok(new RegExp(`\\.legend-swatch\\[data-shape="${shape}"\\]`).test(graphHtml),
      `graph.html <style> must have a rule for .legend-swatch[data-shape="${shape}"]`);
  }
});

test('__ATLAS_GRAPH__ nodes retain a shape field the canvas can consume', () => {
  if (!graphHtml) throw new Error('graphHtml not loaded');
  const data = extractAtlasGraph(graphHtml);
  assert.ok(data.nodes.length > 0, 'must have nodes to check');
  for (const node of data.nodes) {
    assert.ok(typeof node.shape === 'string' && node.shape.length > 0,
      `node ${node.id} must carry a non-empty shape string for canvas rendering`);
  }
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
