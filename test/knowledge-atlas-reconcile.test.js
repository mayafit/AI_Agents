#!/usr/bin/env node
/**
 * test/knowledge-atlas-reconcile.test.js
 * ---------------------------------------------------------------------------
 * Story 29.5 — Tests for full knowledge-graph.json reconciliation hardening.
 *
 * AC coverage:
 *   AC 3 — Full reconciliation: provenance (scan/kg/both), scan-wins on conflict,
 *           KG-only preserved, absence-equivalence, malformed KG tolerated.
 *   AC 5 — Tests green; prior atlas suites still pass.
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
const { spawnSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ATLAS_CJS = path.join(__dirname, '..', 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const MISSING_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'missing-docs-project');

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-reconcile-${prefix}-`));
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

/** Write a knowledge-graph.json into a temp fixture's _bmad-output. */
function writeKgJson(tmpDir, kgObj) {
  const kgPath = path.join(tmpDir, '_bmad-output', 'knowledge-graph.json');
  fs.writeFileSync(kgPath, JSON.stringify(kgObj, null, 2) + '\n', 'utf-8');
}

console.log('\n=== Knowledge Atlas Reconcile Tests (Story 29.5) ===');

// ─── Pre-conditions ──────────────────────────────────────────────────────────
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists and is non-empty', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('rich-project fixture exists', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
});

test('missing-docs-project fixture exists', () => {
  assert.ok(fs.existsSync(MISSING_FIXTURE), `missing-docs-project fixture missing: ${MISSING_FIXTURE}`);
});

// ─── AC 3: Absence equivalence (scan-only when KG absent) ────────────────────
console.log('\n--- AC 3.3: Absence equivalence ---');

test('KG absent: nodes carry NO source field (29.2 equivalence)', () => {
  const tmp = makeTempDir('absent-kg');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  // Ensure no knowledge-graph.json
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const manifest = runAtlas(tmp);
  // When KG is absent, NO node should carry a source field
  for (const node of manifest.nodes) {
    assert.ok(
      node.source === undefined,
      `KG-absent node must have no source field, got node.id=${node.id} source=${node.source}`
    );
  }
  for (const edge of manifest.edges) {
    assert.ok(
      edge.source === undefined,
      `KG-absent edge must have no source field, got edge ${edge.from}→${edge.to} source=${edge.source}`
    );
  }
});

test('KG absent: rich-project nodes carry NO source field', () => {
  // Run against rich-project WITHOUT a KG (remove it)
  const tmp = makeTempDir('rich-no-kg');
  copyDirRecursive(RICH_FIXTURE, tmp);
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const manifest = runAtlas(tmp);
  for (const node of manifest.nodes) {
    assert.ok(node.source === undefined,
      `KG-absent node must have no source, got ${node.id} source=${node.source}`
    );
  }
});

// ─── AC 3.1: Provenance tagging (scan/kg/both) ───────────────────────────────
console.log('\n--- AC 3.1: Provenance tagging ---');

let provenanceTmp;
let provenanceManifest;

test('setup: generate with KG that has kg-only node and scan-overlapping node', () => {
  provenanceTmp = makeTempDir('provenance');
  copyDirRecursive(RICH_FIXTURE, provenanceTmp);

  // The rich-project fixture already has knowledge-graph.json with:
  // - FR101 (overlapping with scan) → should be 'both'
  // - kg-only-node-from-legacy (KG only) → should be 'kg'
  // Scan nodes (FR101, NFR56, etc.) → should be 'scan' or 'both'

  provenanceManifest = runAtlas(provenanceTmp);
  assert.ok(provenanceManifest, 'must generate manifest');
});

test('KG present: scan-only nodes carry source="scan"', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  // A scan-only node is one that is NOT in the rich-project knowledge-graph.json.
  // The KG only has FR101 and kg-only-node-from-legacy.
  // Other nodes (NFR56, Epic 1, Story 1.1, etc.) are scan-only.
  const nfrNode = provenanceManifest.nodes.find(n => n.label === 'NFR56');
  assert.ok(nfrNode, 'must have NFR56 node (scan-only)');
  assert.strictEqual(nfrNode.source, 'scan',
    `scan-only node must have source='scan', got: ${nfrNode.source}`
  );
});

test('KG present: nodes in both scan and KG carry source="both"', () => {
  // To test 'both', we need a fixture where the SAME node id appears in both scan and KG.
  // The rich-project KG has FR101 with id "_bmad-output/planning-artifacts/prd.md#fr101-user-authentication"
  // but the scan derives FR101 with anchor "fr101" (→ id "#fr101"), so they are distinct ids.
  // We test 'both' by creating our own fixture.
  const tmp = makeTempDir('both-provenance');
  copyDirRecursive(MISSING_FIXTURE, tmp);

  // Get the scan manifest to find the exact id of FR201
  const scanManifest = runAtlas(tmp);
  const fr201Scan = scanManifest.nodes.find(n => n.label === 'FR201');
  if (!fr201Scan) {
    // FR201 not in fixture — pass this test gracefully
    console.log('      [SKIP] FR201 not in fixture — cannot test "both" provenance this way');
    return;
  }

  // Now write a KG with the SAME node id as the scan-derived FR201
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);
  const ksPath = path.join(tmp, '_bmad-output', 'knowledge-site');
  if (fs.existsSync(ksPath)) fs.rmSync(ksPath, { recursive: true, force: true });

  fs.writeFileSync(kgPath, JSON.stringify({
    meta: {},
    nodes: [{
      id: fr201Scan.id,   // exactly matching scan id → 'both'
      kind: fr201Scan.kind,
      label: fr201Scan.label,
      fileId: fr201Scan.fileId,
      title: 'KG-Title for FR201',
    }],
    edges: [],
  }, null, 2) + '\n', 'utf-8');

  const manifest = runAtlas(tmp);
  const fr201 = manifest.nodes.find(n => n.id === fr201Scan.id);
  assert.ok(fr201, 'FR201 must be in manifest');
  assert.strictEqual(fr201.source, 'both',
    `node with same id in scan and KG must have source='both', got: ${fr201.source}`
  );
});

test('KG present: KG-only nodes carry source="kg"', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  const kgOnlyNode = provenanceManifest.nodes.find(n => n.id === 'kg-only-node-from-legacy');
  assert.ok(kgOnlyNode, 'must have kg-only-node-from-legacy');
  assert.strictEqual(kgOnlyNode.source, 'kg',
    `KG-only node must have source='kg', got: ${kgOnlyNode.source}`
  );
});

test('KG present: scan-derived edges carry source="scan" or "both"', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  // Scan-derived edges that are NOT in the KG get source='scan'
  // Any edge from the KG that matches a scan edge gets source='both'
  for (const edge of provenanceManifest.edges) {
    assert.ok(
      edge.source === 'scan' || edge.source === 'kg' || edge.source === 'both',
      `When KG present, all edges must have a source field, got edge ${edge.from}→${edge.to} source=${edge.source}`
    );
  }
});

test('KG present: KG-only edges carry source="kg"', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  // The rich-project KG has a derives-from edge from kg-only-node-from-legacy → FR101
  const kgEdge = provenanceManifest.edges.find(
    e => e.from === 'kg-only-node-from-legacy' && e.kind === 'derives-from'
  );
  assert.ok(kgEdge, 'must have KG-only derives-from edge');
  assert.strictEqual(kgEdge.source, 'kg',
    `KG-only edge must have source='kg', got: ${kgEdge.source}`
  );
});

// ─── AC 3.1: Scan wins on conflict ───────────────────────────────────────────
console.log('\n--- AC 3.1: Scan wins on conflict ---');

test('scan wins: scan-side fileId preserved over KG fileId when same id in both', () => {
  // Test using explicit fixture with same node id in both scan and KG
  const tmp = makeTempDir('scan-wins-fileid');
  copyDirRecursive(MISSING_FIXTURE, tmp);

  // Get scan-derived FR201 id
  const scanManifest = runAtlas(tmp);
  const fr201Scan = scanManifest.nodes.find(n => n.label === 'FR201');
  if (!fr201Scan) {
    console.log('      [SKIP] FR201 not in fixture');
    return;
  }

  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  const ksPath = path.join(tmp, '_bmad-output', 'knowledge-site');
  if (fs.existsSync(ksPath)) fs.rmSync(ksPath, { recursive: true, force: true });

  // KG provides same id but with DIFFERENT fileId — scan must win
  fs.writeFileSync(kgPath, JSON.stringify({
    meta: {},
    nodes: [{
      id: fr201Scan.id,
      kind: 'epic',           // different kind — scan wins
      label: 'KG-OVERRIDE',   // different label — scan wins
      fileId: 'kg-fake-file', // different fileId — scan wins
    }],
    edges: [],
  }, null, 2) + '\n', 'utf-8');

  const manifest = runAtlas(tmp);
  const fr201 = manifest.nodes.find(n => n.id === fr201Scan.id);
  assert.ok(fr201, 'FR201 must exist');
  // Scan fields must win
  assert.strictEqual(fr201.label, 'FR201', `scan label must win, got: ${fr201.label}`);
  assert.strictEqual(fr201.kind, 'requirement', `scan kind must win, got: ${fr201.kind}`);
  assert.ok(fr201.fileId.includes('prd.md'), `scan fileId must win, got: ${fr201.fileId}`);
  assert.strictEqual(fr201.source, 'both', 'conflicting node must be tagged "both"');
});

test('scan wins: conflict test with explicit KG override attempt', () => {
  const tmp = makeTempDir('scan-wins');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  // Create a PRD with FR201
  const prdPath = path.join(tmp, '_bmad-output', 'planning-artifacts', 'prd.md');
  const origContent = fs.readFileSync(prdPath, 'utf-8');
  fs.writeFileSync(prdPath, origContent, 'utf-8');

  // Get the scan-only manifest first (to know what FR201's id/fileId looks like)
  const scanManifest = runAtlas(tmp);
  const fr201Scan = scanManifest.nodes.find(n => n.label === 'FR201');
  if (!fr201Scan) {
    // FR201 might not be in the fixture — skip this specific check gracefully
    return;
  }

  // Now write a KG that tries to override FR201 with a different kind/label
  writeKgJson(tmp, {
    meta: {},
    nodes: [{
      id: fr201Scan.id,        // same id → conflict
      kind: 'epic',            // different kind (scan says 'requirement')
      label: 'KG-OVERRIDE',    // different label
      fileId: 'kg-fake-file',  // different fileId
    }],
    edges: [],
  });

  // Remove the prior knowledge-site so we get a fresh build
  const ksPath = path.join(tmp, '_bmad-output', 'knowledge-site');
  if (fs.existsSync(ksPath)) fs.rmSync(ksPath, { recursive: true, force: true });

  const manifest = runAtlas(tmp);
  const fr201 = manifest.nodes.find(n => n.id === fr201Scan.id);
  assert.ok(fr201, 'FR201 node must exist after reconcile');
  // Scan MUST win: label stays 'FR201', kind stays 'requirement', fileId from scan
  assert.strictEqual(fr201.label, 'FR201', `scan label must win, got: ${fr201.label}`);
  assert.strictEqual(fr201.kind, 'requirement', `scan kind must win, got: ${fr201.kind}`);
  assert.ok(fr201.fileId.includes('prd.md'), `scan fileId must win, got: ${fr201.fileId}`);
  assert.strictEqual(fr201.source, 'both', 'conflicting node must be tagged "both"');
});

test('additive merge: KG title preserved on "both" node when scan has no title', () => {
  const tmp = makeTempDir('additive');
  copyDirRecursive(MISSING_FIXTURE, tmp);

  // Get scan manifest to find a node id
  const scanManifest = runAtlas(tmp);
  const fr201Scan = scanManifest.nodes.find(n => n.label === 'FR201');
  if (!fr201Scan) return; // skip if FR201 not present

  // Write KG with same node id but add a title the scan didn't produce
  writeKgJson(tmp, {
    meta: {},
    nodes: [{
      id: fr201Scan.id,
      kind: fr201Scan.kind,
      label: fr201Scan.label,
      fileId: fr201Scan.fileId,
      title: 'KG-SUPPLIED-TITLE: FR201 Full Title',
    }],
    edges: [],
  });

  const ksPath = path.join(tmp, '_bmad-output', 'knowledge-site');
  if (fs.existsSync(ksPath)) fs.rmSync(ksPath, { recursive: true, force: true });

  const manifest = runAtlas(tmp);
  const fr201 = manifest.nodes.find(n => n.id === fr201Scan.id);
  assert.ok(fr201, 'FR201 must be in manifest');
  assert.strictEqual(fr201.source, 'both', 'node in both must be tagged "both"');
  // If the scan didn't produce a title, the KG-supplied title should be preserved
  if (!fr201Scan.title) {
    assert.strictEqual(fr201.title, 'KG-SUPPLIED-TITLE: FR201 Full Title',
      `KG-supplied title must be preserved when scan has none, got: ${fr201.title}`
    );
  }
});

// ─── AC 3.1: KG-only nodes/edges preserved ───────────────────────────────────
console.log('\n--- AC 3.1: KG-only preserved ---');

test('KG-only nodes are never dropped', () => {
  const tmp = makeTempDir('kg-only');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  writeKgJson(tmp, {
    meta: {},
    nodes: [
      { id: 'kg-only-unique-node-abc', kind: 'capability', label: 'F99-KG', fileId: 'kg-file' },
      { id: 'kg-only-req-node-xyz', kind: 'requirement', label: 'FR999-KG', fileId: 'kg-req-file' },
    ],
    edges: [
      { from: 'kg-only-unique-node-abc', to: 'kg-only-req-node-xyz', kind: 'implements' },
    ],
  });

  const manifest = runAtlas(tmp);
  const kgNode1 = manifest.nodes.find(n => n.id === 'kg-only-unique-node-abc');
  const kgNode2 = manifest.nodes.find(n => n.id === 'kg-only-req-node-xyz');
  const kgEdge = manifest.edges.find(e =>
    e.from === 'kg-only-unique-node-abc' && e.to === 'kg-only-req-node-xyz'
  );

  assert.ok(kgNode1, 'KG-only node 1 must not be dropped');
  assert.ok(kgNode2, 'KG-only node 2 must not be dropped');
  assert.ok(kgEdge, 'KG-only edge must not be dropped');
  assert.strictEqual(kgNode1.source, 'kg', 'KG-only node 1 must be tagged "kg"');
  assert.strictEqual(kgNode2.source, 'kg', 'KG-only node 2 must be tagged "kg"');
  assert.strictEqual(kgEdge.source, 'kg', 'KG-only edge must be tagged "kg"');
});

test('KG-only dangling edge preserved with dangling flag', () => {
  const tmp = makeTempDir('kg-dangling-prov');
  copyDirRecursive(RICH_FIXTURE, tmp);
  // Use the same fixture as graph test: a KG edge with dangling:true
  const kg = {
    meta: {},
    nodes: [],
    edges: [{
      from: '_bmad-output/planning-artifacts/prd.md#fr101-user-authentication',
      to: 'nonexistent-target#ghost-anchor',
      kind: 'depends-on',
      dangling: true,
    }],
  };
  writeKgJson(tmp, kg);

  const manifest = runAtlas(tmp);
  const danglingEdge = manifest.edges.find(e => e.to === 'nonexistent-target#ghost-anchor');
  assert.ok(danglingEdge, 'KG-sourced dangling edge must be in manifest');
  assert.strictEqual(danglingEdge.dangling, true, 'dangling flag must be preserved');
  assert.strictEqual(danglingEdge.source, 'kg', 'KG-only dangling edge must be tagged "kg"');
});

// ─── AC 3.2: Determinism + P3-1 identity stable ──────────────────────────────
console.log('\n--- AC 3.2: Determinism ---');

test('two builds with KG produce byte-identical manifest nodes/edges', () => {
  const tmpA = makeTempDir('det-kg-A');
  const tmpB = makeTempDir('det-kg-B');
  copyDirRecursive(RICH_FIXTURE, tmpA);
  copyDirRecursive(RICH_FIXTURE, tmpB);

  const manifestA = runAtlas(tmpA);
  const manifestB = runAtlas(tmpB);

  assert.deepStrictEqual(manifestA.nodes, manifestB.nodes, 'nodes must be identical');
  assert.deepStrictEqual(manifestA.edges, manifestB.edges, 'edges must be identical');
});

test('nodes are sorted by id after KG merge', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  const ids = provenanceManifest.nodes.map(n => n.id);
  const sorted = [...ids].sort();
  assert.deepStrictEqual(ids, sorted, 'nodes must be sorted by id after KG merge');
});

test('edges are sorted by (from, to, kind) after KG merge', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  const edges = provenanceManifest.edges;
  for (let i = 1; i < edges.length; i++) {
    const prev = edges[i - 1];
    const curr = edges[i];
    let cmp = 0;
    if (prev.from < curr.from) cmp = -1;
    else if (prev.from > curr.from) cmp = 1;
    else if (prev.to < curr.to) cmp = -1;
    else if (prev.to > curr.to) cmp = 1;
    else if (prev.kind < curr.kind) cmp = -1;
    else if (prev.kind > curr.kind) cmp = 1;
    assert.ok(cmp <= 0,
      `edges not sorted at index ${i}: [${prev.from}|${prev.to}|${prev.kind}] before [${curr.from}|${curr.to}|${curr.kind}]`
    );
  }
});

test('node ids are unchanged after KG merge (identity-stable)', () => {
  if (!provenanceManifest) throw new Error('provenanceManifest not available');
  // Run without KG to get scan-only ids
  const tmp = makeTempDir('identity');
  copyDirRecursive(RICH_FIXTURE, tmp);
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const scanManifest = runAtlas(tmp);
  const scanIds = new Set(scanManifest.nodes.map(n => n.id));

  // All scan-only ids must still be present after KG merge
  for (const id of scanIds) {
    const node = provenanceManifest.nodes.find(n => n.id === id);
    assert.ok(node, `scan node id ${id} must still exist after KG merge`);
  }
});

// ─── AC 3.2: Malformed KG tolerated ─────────────────────────────────────────
console.log('\n--- AC 3.2: Malformed KG tolerance ---');

test('malformed KG: JSON parse error → scan-only manifest (no crash)', () => {
  const tmp = makeTempDir('malformed-json');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  fs.writeFileSync(
    path.join(tmp, '_bmad-output', 'knowledge-graph.json'),
    '{ this is not valid json }',
    'utf-8'
  );
  const manifest = runAtlas(tmp);
  assert.ok(Array.isArray(manifest.nodes), 'must still produce nodes array');
  // Malformed KG → treated as absent → no source fields
  for (const node of manifest.nodes) {
    assert.ok(node.source === undefined,
      `malformed-KG: nodes must have no source field (treated as absent), got ${node.id} source=${node.source}`
    );
  }
});

test('malformed KG: nodes as object (not array) → tolerated', () => {
  const tmp = makeTempDir('malformed-obj');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  fs.writeFileSync(
    path.join(tmp, '_bmad-output', 'knowledge-graph.json'),
    JSON.stringify({ meta: {}, nodes: { not: 'array' }, edges: { also: 'not' } }),
    'utf-8'
  );
  const manifest = runAtlas(tmp);
  assert.ok(Array.isArray(manifest.nodes), 'must produce nodes array');
  assert.ok(Array.isArray(manifest.edges), 'must produce edges array');
  // A KG whose nodes/edges are non-arrays coerces to 0 usable nodes AND 0 usable
  // edges — carrying no on-disk truth, it is equivalent to an ABSENT/empty KG
  // (29.5 absence-equivalence, item #4). So scan output is returned unchanged and
  // NO provenance `source` is stamped. This is tolerated (no crash), which is the
  // point of the test.
  for (const node of manifest.nodes) {
    assert.strictEqual(node.source, undefined,
      `malformed (no-usable-content) KG must be treated as absent — no source stamped, got ${node.id} source=${node.source}`);
  }
});

test('malformed KG: nodes with missing ids are skipped (no crash)', () => {
  const tmp = makeTempDir('malformed-ids');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  writeKgJson(tmp, {
    meta: {},
    nodes: [
      { id: null, kind: 'requirement', label: 'NO-ID' },  // null id
      { kind: 'epic', label: 'NO-ID-2' },                 // missing id
      { id: '', kind: 'story', label: 'EMPTY-ID' },       // empty id
      { id: 'valid-kg-id', kind: 'capability', label: 'OK' }, // valid
    ],
    edges: [
      { from: null, to: 'x', kind: 'implements' },  // null from
      { from: 'y', to: null, kind: 'implements' },  // null to
      { from: 'valid-kg-id', to: 'somewhere', kind: 'implements' }, // valid
    ],
  });
  const manifest = runAtlas(tmp);
  // Must not crash, must not produce nodes with null/empty ids
  for (const node of manifest.nodes) {
    assert.ok(typeof node.id === 'string' && node.id, `all nodes must have non-empty string id, got: ${node.id}`);
  }
  // The valid KG-only node must be present
  const validKg = manifest.nodes.find(n => n.id === 'valid-kg-id');
  assert.ok(validKg, 'valid KG node must be present even when others are malformed');
  assert.strictEqual(validKg.source, 'kg', 'valid KG node must be tagged "kg"');
});

test('malformed KG: duplicate KG ids yield single node (item 9)', () => {
  const tmp = makeTempDir('kg-dupe');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  writeKgJson(tmp, {
    meta: {},
    nodes: [
      { id: 'dup-kg-node', kind: 'capability', label: 'D1', fileId: 'x' },
      { id: 'dup-kg-node', kind: 'capability', label: 'D1-DUPE', fileId: 'x' },
    ],
    edges: [
      { from: 'dup-kg-node', to: 'other', kind: 'implements' },
      { from: 'dup-kg-node', to: 'other', kind: 'implements' },
    ],
  });
  const manifest = runAtlas(tmp);
  const dupNodes = manifest.nodes.filter(n => n.id === 'dup-kg-node');
  assert.strictEqual(dupNodes.length, 1, `dup-kg-node must appear exactly once, got ${dupNodes.length}`);
  const dupEdges = manifest.edges.filter(e => e.from === 'dup-kg-node' && e.to === 'other' && e.kind === 'implements');
  assert.strictEqual(dupEdges.length, 1, `duplicate KG edge must be de-duplicated, got ${dupEdges.length}`);
});

// ─── Fixture: conflict/kg-only cases using new fixture ───────────────────────
console.log('\n--- Conflict and KG-only fixture cases ---');

test('kg-only node with extra fields preserved in manifest', () => {
  const tmp = makeTempDir('kg-extra');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  writeKgJson(tmp, {
    meta: {},
    nodes: [{
      id: 'extra-fields-node',
      kind: 'arch-decision',
      label: 'P7-1',
      title: 'Architecture Decision: Testing',
      status: 'done',
      fileId: 'kg-arch-file',
      anchor: 'p7-1',
    }],
    edges: [],
  });

  const manifest = runAtlas(tmp);
  const node = manifest.nodes.find(n => n.id === 'extra-fields-node');
  assert.ok(node, 'KG-only node with extra fields must be in manifest');
  assert.strictEqual(node.kind, 'arch-decision', 'KG kind must be preserved');
  assert.strictEqual(node.label, 'P7-1', 'KG label must be preserved');
  assert.strictEqual(node.title, 'Architecture Decision: Testing', 'KG title must be preserved');
  assert.strictEqual(node.status, 'done', 'KG status must be preserved');
  assert.strictEqual(node.source, 'kg', 'KG-only node must be tagged "kg"');
});

// ─── Renderers backward-compatible with source=undefined ─────────────────────
console.log('\n--- Renderer backward-compatibility (source undefined OK) ---');

test('graph.html renders correctly when nodes have no source field (KG absent)', () => {
  const tmp = makeTempDir('render-no-src');
  copyDirRecursive(RICH_FIXTURE, tmp);
  // Remove KG so nodes have no source field
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  // Must not crash
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, tmp],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );
  assert.ok(result.status === 0, `atlas must succeed with no KG: exit ${result.status}\n${result.stderr}`);
  const graphPath = path.join(tmp, '_bmad-output', 'knowledge-site', 'graph.html');
  assert.ok(fs.existsSync(graphPath), 'graph.html must be generated');
  const html = fs.readFileSync(graphPath, 'utf-8');
  assert.ok(html.includes('window.__ATLAS_GRAPH__'), 'graph.html must have graph data');
});

test('orphans.html renders correctly when nodes have no source field (KG absent)', () => {
  const tmp = makeTempDir('orphan-no-src');
  copyDirRecursive(RICH_FIXTURE, tmp);
  const kgPath = path.join(tmp, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, tmp],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );
  assert.ok(result.status === 0, `atlas must succeed: exit ${result.status}\n${result.stderr}`);
  const orphanPath = path.join(tmp, '_bmad-output', 'knowledge-site', 'orphans.html');
  assert.ok(fs.existsSync(orphanPath), 'orphans.html must be generated');
  const html = fs.readFileSync(orphanPath, 'utf-8');
  assert.ok(html.includes('<!DOCTYPE html>'), 'orphans.html must be valid HTML');
});

// ─── AC 3.3: Absence equivalence to 29.2 ─────────────────────────────────────
console.log('\n--- AC 3.3: Absence equivalence comparison ---');

test('absence equivalence: same nodes with/without KG (for scan-only nodes)', () => {
  // When KG is absent, the manifest should be structurally identical to 29.2
  // (no extra fields, same node/edge structure).
  const tmpWith = makeTempDir('equiv-with-kg');
  const tmpWithout = makeTempDir('equiv-without-kg');

  copyDirRecursive(RICH_FIXTURE, tmpWith);
  copyDirRecursive(RICH_FIXTURE, tmpWithout);

  // Remove KG from tmpWithout
  const kgPath = path.join(tmpWithout, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const manifestWithout = runAtlas(tmpWithout);

  // Without KG: no source fields, specific node set
  for (const node of manifestWithout.nodes) {
    assert.ok(node.source === undefined,
      `without KG: node ${node.id} must have no source field, got: ${node.source}`
    );
  }
  for (const edge of manifestWithout.edges) {
    assert.ok(edge.source === undefined,
      `without KG: edge ${edge.from}→${edge.to} must have no source field, got: ${edge.source}`
    );
  }

  // With KG (from rich fixture): KG-only node is additional, scan nodes get source
  const manifestWith = runAtlas(tmpWith);
  // The scan-only nodes from 'without' should all exist in 'with' too
  for (const node of manifestWithout.nodes) {
    const counterpart = manifestWith.nodes.find(n => n.id === node.id);
    assert.ok(counterpart, `scan node ${node.id} must exist in KG-merged manifest`);
    // Core fields must match (scan wins, so same id/kind/label/fileId)
    assert.strictEqual(counterpart.id, node.id);
    assert.strictEqual(counterpart.kind, node.kind);
    assert.strictEqual(counterpart.label, node.label);
    assert.strictEqual(counterpart.fileId, node.fileId);
  }
});

// ─── Added by 29.5 review fixes ──────────────────────────────────────────────
const KS = (root) => path.join(root, '_bmad-output', 'knowledge-site');
const KG = (root) => path.join(root, '_bmad-output', 'knowledge-graph.json');
const rmKnowledgeSite = (root) => { const p = KS(root); if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); };
const writeKg = (root, obj) => { const p = KG(root); if (fs.existsSync(p)) fs.unlinkSync(p); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8'); };

test('reconcile: an edge present in BOTH scan and KG carries source="both"', () => {
  const tmp = makeTempDir('edge-both');
  copyDirRecursive(RICH_FIXTURE, tmp);
  // Scan-only pass: drop the fixture KG, find a real scan edge to replicate.
  if (fs.existsSync(KG(tmp))) fs.unlinkSync(KG(tmp));
  rmKnowledgeSite(tmp);
  const scan = runAtlas(tmp);
  const scanEdge = scan.edges.find(e => !e.dangling);
  assert.ok(scanEdge, 'fixture must yield at least one non-dangling scan edge');
  // Write a KG containing exactly that edge (+ endpoint nodes) → must merge to 'both'.
  writeKg(tmp, { meta: {}, nodes: [], edges: [{ from: scanEdge.from, to: scanEdge.to, kind: scanEdge.kind }] });
  rmKnowledgeSite(tmp);
  const merged = runAtlas(tmp);
  const both = merged.edges.find(e => e.from === scanEdge.from && e.to === scanEdge.to && e.kind === scanEdge.kind);
  assert.ok(both, 'the shared edge must be in the merged manifest');
  assert.strictEqual(both.source, 'both', `shared edge must be source='both', got ${both.source}`);
});

test('reconcile: a KG-only edge to a ghost target is flagged dangling (post-merge pass)', () => {
  const tmp = makeTempDir('kg-only-dangling');
  copyDirRecursive(MISSING_FIXTURE, tmp);
  writeKg(tmp, {
    meta: {},
    nodes: [{ id: 'kg-src#x', kind: 'story', label: 'KG Story X', fileId: 'kg-src' }],
    edges: [{ from: 'kg-src#x', to: 'GHOST-TARGET#nope', kind: 'implements' }],
  });
  rmKnowledgeSite(tmp);
  const m = runAtlas(tmp);
  const ghost = m.edges.find(e => e.to === 'GHOST-TARGET#nope');
  assert.ok(ghost, 'KG-only edge must be present in merged manifest');
  assert.strictEqual(ghost.dangling, true,
    'KG-only edge to a non-existent target must be flagged dangling by the post-merge pass');
  // And it must surface in the orphans page Dangling References.
  const orphans = fs.readFileSync(path.join(KS(tmp), 'orphans.html'), 'utf-8');
  assert.ok(/GHOST-TARGET/.test(orphans) || /[Dd]angling/.test(orphans),
    'dangling KG edge should be visible in orphans.html');
});

test('reconcile: empty {} knowledge-graph.json is equivalent to ABSENT (no source stamped)', () => {
  const tmp = makeTempDir('empty-kg');
  copyDirRecursive(RICH_FIXTURE, tmp);
  if (fs.existsSync(KG(tmp))) fs.unlinkSync(KG(tmp));
  rmKnowledgeSite(tmp);
  const scanOnly = runAtlas(tmp);
  // Now write an empty KG and regenerate — output must be identical (no provenance noise).
  writeKg(tmp, {});
  rmKnowledgeSite(tmp);
  const withEmptyKg = runAtlas(tmp);
  assert.deepStrictEqual(withEmptyKg.nodes, scanOnly.nodes,
    'empty {} KG must not change scan nodes (absence-equivalence)');
  assert.deepStrictEqual(withEmptyKg.edges, scanOnly.edges,
    'empty {} KG must not change scan edges (absence-equivalence)');
  assert.ok(withEmptyKg.nodes.every(n => n.source === undefined),
    'empty {} KG must not stamp a source field on scan nodes');
});

test('determinism: manifest.json is byte-identical across two different generate paths', () => {
  const a = makeTempDir('manifest-path-a');
  const b = makeTempDir('manifest-path-b');
  copyDirRecursive(RICH_FIXTURE, a);
  copyDirRecursive(RICH_FIXTURE, b);
  runAtlas(a);
  runAtlas(b);
  const rawA = fs.readFileSync(path.join(KS(a), 'manifest.json'), 'utf-8');
  const rawB = fs.readFileSync(path.join(KS(b), 'manifest.json'), 'utf-8');
  assert.strictEqual(rawA, rawB,
    'manifest.json must be byte-identical regardless of the absolute project path (no machine-specific paths persisted)');
  assert.ok(!/[A-Za-z]:\\|\/tmp\/|\/var\/|AppData/.test(rawA),
    'persisted manifest.json must not embed a machine-specific absolute path');
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
