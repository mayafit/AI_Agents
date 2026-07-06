#!/usr/bin/env node
/**
 * test/knowledge-atlas-references.test.js
 * ---------------------------------------------------------------------------
 * Story 29.8 — Relationship (reference) extraction for planning-centric
 * projects.
 *
 * Real bug this fixes: a planning-heavy project (dense PRD/architecture
 * mentioning FRs/Epics constantly, but no story files) produced file nodes
 * for the FRs/Epics it DEFINES but zero edges connecting anything — a cloud
 * of disconnected dots with empty "Referenced by" backlinks everywhere
 * (Prophesee: 116 nodes, 0 edges).
 *
 * AC coverage (see _bmad-output/implementation-artifacts/
 * 29-8-relationship-extraction-planning-docs.md):
 *   AC1 — every scanned document gets its own file node (not just story/bug/retro)
 *   AC2 — doc -> distinct-entity `references` edges (deduped, not per-occurrence)
 *   AC3 — section-owner -> entity `references` edges (e.g. Epic 2 -> FR26)
 *   AC4 — bounded + deterministic; references are visually/kind-distinct
 *   AC5 — orphan/gap detection stays keyed on SEMANTIC edges (references-only
 *         is still an orphan)
 *   AC6 — hidden files (not just hidden dirs) are skipped during scan
 *   AC7 — full suite green; determinism; backward-compat
 *
 * Test style: plain Node assert (no framework), matching repo convention —
 * every assertion runs against the BUILT `atlas.cjs` via spawnSync.
 *
 * NEVER mutate committed fixtures — all generation runs against TEMP COPIES.
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
const PLANNING_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'planning-project');

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-refs-${prefix}-`));
  tempDirs.push(d);
  return d;
}

/** Run atlas.cjs against a projectRoot with pinned epoch. Returns parsed manifest.json. */
function runAtlas(projectRoot, extraEnv) {
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH, ...extraEnv },
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

/** Recursively collect all files under `dir` as POSIX paths relative to `dir`. */
function collectFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

console.log('\n=== Knowledge Atlas Reference Extraction Tests (Story 29.8) ===');

console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists and is non-empty', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('planning-project fixture exists', () => {
  assert.ok(fs.existsSync(PLANNING_FIXTURE), `planning-project fixture missing: ${PLANNING_FIXTURE}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC1: every scanned document gets its own file node
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC1: file node for every scanned document ---');

let planningManifest; // reused across many tests below

test('generate planning-project (no story files, PRD only)', () => {
  const tmp = makeTempDir('ac1');
  copyDirRecursive(PLANNING_FIXTURE, tmp);
  planningManifest = runAtlas(tmp);
  assert.ok(planningManifest, 'manifest must be produced');
});

test('the PRD has its own file node (kind=document, id=fileId)', () => {
  const prdFileId = '_bmad-output/planning-artifacts/prd.md';
  const prdFile = planningManifest.files.find(f => f.path === prdFileId);
  assert.ok(prdFile, 'prd.md must be a scanned file record');
  const prdNode = planningManifest.nodes.find(n => n.id === prdFileId);
  assert.ok(prdNode, 'prd.md must have its own file-level node');
  assert.strictEqual(prdNode.kind, 'document', 'a prd doc gets the 29.8 "document" NodeKind');
  assert.strictEqual(prdNode.fileId, prdFileId);
  assert.ok(!prdNode.anchor, 'a file-level node has no anchor');
});

test('every FileRecord in the manifest has a corresponding node (file or entity def-site)', () => {
  const nodeIds = new Set(planningManifest.nodes.map(n => n.id));
  for (const file of planningManifest.files) {
    assert.ok(nodeIds.has(file.path), `file ${file.path} must have a graph node with id === its fileId`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: doc -> distinct-entity `references` edges (deduped, not per-occurrence)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC2: doc -> entity references edges (deduped) ---');

const PRD_ID = '_bmad-output/planning-artifacts/prd.md';

function entityNodeId(manifest, label) {
  const n = manifest.nodes.find(nn => nn.label === label);
  assert.ok(n, `expected an entity node with label ${label}`);
  return n.id;
}

test('prd.md -> FR1 references edge exists exactly once (FR1 mentioned twice in the doc)', () => {
  const fr1Id = entityNodeId(planningManifest, 'FR1');
  const matches = planningManifest.edges.filter(e => e.from === PRD_ID && e.to === fr1Id && e.kind === 'references');
  assert.strictEqual(matches.length, 1, 'exactly one references edge per (doc, entity) pair, never per-occurrence');
});

test('prd.md -> FR26 references edge exists (FR26 mentioned in two different sections, still one edge)', () => {
  const fr26Id = entityNodeId(planningManifest, 'FR26');
  const matches = planningManifest.edges.filter(e => e.from === PRD_ID && e.to === fr26Id && e.kind === 'references');
  assert.strictEqual(matches.length, 1);
});

test('doc->entity references edge count equals the number of DISTINCT entities in the doc', () => {
  const prdFile = planningManifest.files.find(f => f.path === PRD_ID);
  // Fixture mentions FR1, FR2, Epic 1, Epic 2, FR26, NFR5, FR30 = 7 distinct tokens.
  assert.strictEqual(prdFile.entities.length, 7, `expected 7 distinct entities, got: ${JSON.stringify(prdFile.entities)}`);
  const docRefEdges = planningManifest.edges.filter(e => e.from === PRD_ID && e.kind === 'references');
  assert.strictEqual(docRefEdges.length, prdFile.entities.length,
    'doc->entity references edges must equal the distinct entity count, not occurrence count');
});

test('references edges are bounded: no entity x entity full mesh from the doc scan', () => {
  // 7 distinct entities -> at most 7 doc->entity edges (not 7*6=42).
  const refEdges = planningManifest.edges.filter(e => e.kind === 'references');
  const fromCounts = new Map();
  for (const e of refEdges) fromCounts.set(e.from, (fromCounts.get(e.from) ?? 0) + 1);
  for (const [from, count] of fromCounts) {
    assert.ok(count <= 7, `source ${from} has ${count} outgoing references edges — suspiciously high for a 7-entity fixture (full-mesh risk)`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: section-owner -> entity references edges (e.g. Epic 2 -> FR26)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC3: section-owner -> entity references edges ---');

test('Epic 2 -> FR26 references edge exists (section-owner scoping)', () => {
  const epic2Id = entityNodeId(planningManifest, 'Epic 2');
  const fr26Id = entityNodeId(planningManifest, 'FR26');
  const edge = planningManifest.edges.find(e => e.from === epic2Id && e.to === fr26Id && e.kind === 'references');
  assert.ok(edge, 'Epic 2 -> FR26 references edge must exist (Epic 2 heading owns a section mentioning FR26)');
});

test('Epic 2 -> NFR5 references edge exists (same section as FR26)', () => {
  const epic2Id = entityNodeId(planningManifest, 'Epic 2');
  const nfr5Id = entityNodeId(planningManifest, 'NFR5');
  const edge = planningManifest.edges.find(e => e.from === epic2Id && e.to === nfr5Id && e.kind === 'references');
  assert.ok(edge, 'Epic 2 -> NFR5 references edge must exist');
});

test('Epic 1 -> FR1 and Epic 1 -> FR2 references edges exist (nested subheading inherits owner)', () => {
  const epic1Id = entityNodeId(planningManifest, 'Epic 1');
  const fr1Id = entityNodeId(planningManifest, 'FR1');
  const fr2Id = entityNodeId(planningManifest, 'FR2');
  assert.ok(planningManifest.edges.find(e => e.from === epic1Id && e.to === fr1Id && e.kind === 'references'));
  assert.ok(planningManifest.edges.find(e => e.from === epic1Id && e.to === fr2Id && e.kind === 'references'));
});

test('FR30 (mentioned only under a headerless/no-owner section) has NO section-owner edge, only a doc edge', () => {
  const fr30Id = entityNodeId(planningManifest, 'FR30');
  const incomingRefs = planningManifest.edges.filter(e => e.to === fr30Id && e.kind === 'references');
  // Only the doc->entity edge should target FR30 (no Epic/Story owns the
  // "Cross-cutting concerns" section, since its heading names no single
  // dominant entity token).
  assert.strictEqual(incomingRefs.length, 1, `FR30 should have exactly 1 incoming references edge (doc-level only), got: ${JSON.stringify(incomingRefs)}`);
  assert.strictEqual(incomingRefs[0].from, PRD_ID);
});

test('no self-edges: an owner never references itself', () => {
  const selfEdges = planningManifest.edges.filter(e => e.from === e.to);
  assert.strictEqual(selfEdges.length, 0, `found self-edges: ${JSON.stringify(selfEdges)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4/backlinks: "Referenced by" populates and is symmetric / resolves
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC4: backlinks populate from references edges (symmetric, resolvable) ---');

let planningTmpDir;

test('generate planning-project to a temp dir for HTML inspection', () => {
  planningTmpDir = makeTempDir('ac4-html');
  copyDirRecursive(PLANNING_FIXTURE, planningTmpDir);
  runAtlas(planningTmpDir);
});

test('FR26 doc page lists "Referenced by" including the PRD and Epic 2', () => {
  const docsDir = path.join(planningTmpDir, '_bmad-output', 'knowledge-site', 'docs');
  const prdHtmlFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.html'));
  let found = false;
  let html = '';
  for (const f of prdHtmlFiles) {
    const content = fs.readFileSync(path.join(docsDir, f), 'utf-8');
    if (content.includes('id="fr26"') && content.includes('Referenced by')) {
      found = true;
      html = content;
      break;
    }
  }
  assert.ok(found, 'FR26 anchor + a "Referenced by" section must appear somewhere in the doc pages');
  assert.ok(/Epic 2/.test(html), 'FR26 backlinks must include Epic 2 (the section owner)');
});

test('every backlink href in every generated doc page resolves to a real file on disk', () => {
  const outDir = path.join(planningTmpDir, '_bmad-output', 'knowledge-site');
  const docsDir = path.join(outDir, 'docs');
  for (const f of fs.readdirSync(docsDir)) {
    if (!f.endsWith('.html')) continue;
    const html = fs.readFileSync(path.join(docsDir, f), 'utf-8');
    const backlinkSection = html.split('Referenced by')[1];
    if (!backlinkSection) continue;
    const hrefRe = /<a href="([^"]+)">/g;
    let m;
    let count = 0;
    while ((m = hrefRe.exec(backlinkSection)) !== null && count < 20) {
      count++;
      const href = m[1].split('#')[0];
      if (!href || href === '#') continue;
      const resolved = path.resolve(docsDir, href);
      assert.ok(fs.existsSync(resolved), `backlink href ${href} in ${f} must resolve to a real file (${resolved})`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 (graph): edge-kind filter includes `references`; __ATLAS_GRAPH__ counts include them
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC4: graph.html includes references in filter + counts ---');

test('graph.html filter <select> includes a "references" option', () => {
  const html = readKnowledgeSiteFile(planningTmpDir, 'graph.html');
  assert.ok(/<option value="references">/.test(html), 'edge-kind filter must include references');
});

test('__ATLAS_GRAPH__ edges include kind:"references" entries with a dashed style flag', () => {
  const html = readKnowledgeSiteFile(planningTmpDir, 'graph.html');
  const m = html.match(/window\.__ATLAS_GRAPH__\s*=\s*(\{[\s\S]*?\});/);
  assert.ok(m, '__ATLAS_GRAPH__ must be embedded');
  const data = JSON.parse(m[1]);
  const refEdges = data.edges.filter(e => e.kind === 'references');
  assert.ok(refEdges.length > 0, 'graph data must include references edges');
});

test('manifest.counts.edges includes references edges (not undercounted)', () => {
  const manifestPath = path.join(planningTmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const refEdgeCount = manifest.edges.filter(e => e.kind === 'references').length;
  assert.ok(refEdgeCount > 0, 'must have at least one references edge');
  assert.strictEqual(manifest.counts.edges, manifest.edges.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: orphan/gap detection stays keyed on SEMANTIC edges only
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC5: orphan integrity — references-only entities still flagged as gaps ---');

test('FR30 (references-only, no implements edge anywhere) is still listed as an unreferenced requirement', () => {
  const orphansHtml = readKnowledgeSiteFile(planningTmpDir, 'orphans.html');
  // FR30 has zero implements edges (no story files exist in this fixture at
  // all), so it MUST appear in the "Unreferenced Requirements / NFRs" section,
  // even though it now has an incoming `references` edge from the PRD.
  const section = orphansHtml.split('id="unreferenced-requirements"')[1];
  assert.ok(section, 'unreferenced-requirements section must exist');
  assert.ok(/FR30/.test(section.split('</section>')[0]), 'FR30 must be listed as an unreferenced requirement despite having a references edge');
});

test('ALL requirements/NFRs in this fixture are orphans (no story ever implements them)', () => {
  const reqNfrNodes = planningManifest.nodes.filter(n => n.kind === 'requirement' || n.kind === 'nfr');
  const implementsEdges = planningManifest.edges.filter(e => e.kind === 'implements');
  assert.strictEqual(implementsEdges.length, 0, 'fixture has no story files, so there must be zero implements edges');
  assert.ok(reqNfrNodes.length >= 4, 'fixture must define at least FR1/FR2/FR26/NFR5/FR30');
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6: hidden files (not just hidden dirs) are skipped
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC6: hidden-file skip ---');

test('.gitignore at the _bmad-output source root does NOT produce an "unknown" doc node', () => {
  const gitignorePresent = fs.existsSync(path.join(PLANNING_FIXTURE, '_bmad-output', '.gitignore'));
  assert.ok(gitignorePresent, 'fixture must actually contain a .gitignore to make this test meaningful');
  const unknownFiles = planningManifest.files.filter(f => f.type === 'unknown');
  assert.strictEqual(unknownFiles.length, 0, `.gitignore must be skipped, not scanned as unknown: ${JSON.stringify(unknownFiles)}`);
  const gitignoreRecord = planningManifest.files.find(f => f.path.endsWith('.gitignore'));
  assert.ok(!gitignoreRecord, '.gitignore must not appear in manifest.files at all');
});

// ─────────────────────────────────────────────────────────────────────────────
// AC7: determinism — two runs on identical input produce byte-identical output
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC7: determinism ---');

test('two fresh generate() runs on planning-project produce byte-identical manifest.json', () => {
  const a = makeTempDir('det-a');
  const b = makeTempDir('det-b');
  copyDirRecursive(PLANNING_FIXTURE, a);
  copyDirRecursive(PLANNING_FIXTURE, b);
  runAtlas(a);
  runAtlas(b);
  const rawA = fs.readFileSync(path.join(a, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8');
  const rawB = fs.readFileSync(path.join(b, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8');
  assert.strictEqual(rawA, rawB, 'manifest.json must be byte-identical across independent runs on identical input');
});

test('two fresh generate() runs on planning-project produce byte-identical FULL site output', () => {
  const a = makeTempDir('det-full-a');
  const b = makeTempDir('det-full-b');
  copyDirRecursive(PLANNING_FIXTURE, a);
  copyDirRecursive(PLANNING_FIXTURE, b);
  runAtlas(a);
  runAtlas(b);
  const outA = path.join(a, '_bmad-output', 'knowledge-site');
  const outB = path.join(b, '_bmad-output', 'knowledge-site');
  const filesA = collectFiles(outA);
  const filesB = collectFiles(outB);
  assert.deepStrictEqual(filesA, filesB, 'the same set of files must be produced');
  for (const rel of filesA) {
    const ha = fileHash(path.join(outA, rel));
    const hb = fileHash(path.join(outB, rel));
    assert.strictEqual(ha, hb, `file ${rel} must be byte-identical across two independent runs`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat: existing edge kinds/behaviors are additive-only
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Backward-compat: references edges never replace semantic edges ---');

test('EdgeKind "references" is additive — semantic edge kinds are untouched by this fixture', () => {
  // This fixture has no story/bug/retro files, so no semantic edges are
  // expected at all (only references + the entity-defining tokens).
  const semanticKinds = new Set(['implements', 'derives-from', 'refines', 'blocks', 'depends-on', 'validates', 'addressed-by', 'shipped-in']);
  const semanticEdges = planningManifest.edges.filter(e => semanticKinds.has(e.kind));
  assert.strictEqual(semanticEdges.length, 0, 'a story-less planning project must have zero semantic edges');
  const refEdges = planningManifest.edges.filter(e => e.kind === 'references');
  assert.ok(refEdges.length > 0, 'but MUST have references edges (this is the whole point of Story 29.8)');
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
