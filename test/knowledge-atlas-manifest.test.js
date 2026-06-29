#!/usr/bin/env node
/**
 * test/knowledge-atlas-manifest.test.js
 * ---------------------------------------------------------------------------
 * Story 29.2 — Tests for scan→extract→graph→manifest pipeline.
 *
 * AC coverage:
 *   AC 1 — Scanner enumerates all BMAD doc types; tolerates missing types
 *   AC 2 — Entity extraction: each entity type (FR, NFR, F, Epic, Story, bug, P#-#, retro, status)
 *   AC 3 — Graph nodes typed by kind; edges typed by relationship; P3-1 file-id#anchor ids
 *   AC 4 — manifest.json persisted under outDir with meta/files/nodes/edges/counts
 *   AC 5 — Incremental: changed/added/removed/renamed; incremental ≡ full
 *   AC 6 — knowledge-graph.json merge (scan-wins) and absence (scan-only)
 *   AC 7 — POSIX file-id; CRLF ≡ LF hashing; cross-platform determinism
 *   AC 8 — All tests green; 29.1 smoke still passes
 *
 * Test style: plain Node assert (no framework), repo style.
 *
 * Key principles:
 *   - NEVER mutate committed fixtures. All generation runs against a TEMP COPY.
 *   - Pin SOURCE_DATE_EPOCH for deterministic timestamp output.
 *   - Generate into a temp dir, clean up after.
 *   - Windows/Linux compatible (LF-normalized reads, path.join everywhere).
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ─── Module paths ───────────────────────────────────────────────────────────
const ATLAS_CJS = path.join(__dirname, '..', 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const MISSING_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'missing-docs-project');

// Pin SOURCE_DATE_EPOCH for determinism (NFR62)
const PINNED_EPOCH = '1700000000'; // 2023-11-14T22:13:20Z

// ─── Test harness ───────────────────────────────────────────────────────────
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

async function testAsync(name, fn) {
  try {
    await fn();
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-manifest-${prefix}-`));
  tempDirs.push(d);
  return d;
}

/** Run atlas.cjs against a projectRoot with pinned epoch. Returns parsed manifest.json. */
function runAtlas(projectRoot) {
  const { spawnSync } = require('child_process');
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
  // Read the manifest from the output dir
  const manifestPath = path.join(projectRoot, '_bmad-output', 'knowledge-site', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not written: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

/** SHA-256 of CRLF-normalized file content. */
function contentHash(filePath) {
  // Mirror the production hash contract: strip a leading UTF-8 BOM, then CRLF→LF.
  let text = fs.readFileSync(filePath, 'utf-8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf-8').digest('hex');
}

// ─── Pre-conditions ──────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Manifest Tests (Story 29.2) ===');

console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('rich-project fixture exists', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
  assert.ok(fs.existsSync(path.join(RICH_FIXTURE, '_bmad-output')));
  assert.ok(fs.existsSync(path.join(RICH_FIXTURE, '_bmad-output', 'planning-artifacts', 'prd.md')));
  assert.ok(fs.existsSync(path.join(RICH_FIXTURE, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml')));
});

test('missing-docs-project fixture exists', () => {
  assert.ok(fs.existsSync(MISSING_FIXTURE), `missing-docs-project fixture missing: ${MISSING_FIXTURE}`);
  assert.ok(fs.existsSync(path.join(MISSING_FIXTURE, '_bmad-output', 'planning-artifacts', 'prd.md')));
  // Must NOT have implementation-artifacts (that's the point of this fixture)
  assert.ok(!fs.existsSync(path.join(MISSING_FIXTURE, '_bmad-output', 'implementation-artifacts')),
    'missing-docs-project must not have implementation-artifacts/'
  );
});

// ─── manifest.json structure (AC 4) ─────────────────────────────────────────
console.log('\n--- manifest.json structure (AC 4) ---');

let richManifest;
let richTmpDir;

test('rich-project: generate produces manifest.json', () => {
  richTmpDir = makeTempDir('rich');
  copyDirRecursive(RICH_FIXTURE, richTmpDir);
  richManifest = runAtlas(richTmpDir);
  assert.ok(richManifest, 'manifest must be a parsed object');
});

test('manifest has required meta fields', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  assert.ok(typeof richManifest.projectTitle === 'string', 'must have projectTitle');
  assert.ok(typeof richManifest.generatedAt === 'string', 'must have generatedAt');
  assert.ok(typeof richManifest.projectRoot === 'string', 'must have projectRoot');
  assert.ok(typeof richManifest.bmadOutputDir === 'string', 'must have bmadOutputDir');
  assert.ok(typeof richManifest.version === 'number', 'must have version');
  assert.ok(Array.isArray(richManifest.files), 'must have files array');
  assert.ok(Array.isArray(richManifest.nodes), 'must have nodes array');
  assert.ok(Array.isArray(richManifest.edges), 'must have edges array');
  assert.ok(richManifest.counts && typeof richManifest.counts === 'object', 'must have counts');
});

test('manifest projectTitle from package.json', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  assert.strictEqual(richManifest.projectTitle, 'rich-atlas-fixture');
});

test('manifest generatedAt is pinned ISO-8601 timestamp', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  assert.strictEqual(richManifest.generatedAt, '2023-11-14T22:13:20Z');
});

test('manifest.json uses LF line endings and has trailing newline', () => {
  if (!richTmpDir) throw new Error('temp dir not created (prior test failed)');
  const manifestPath = path.join(richTmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  const raw = fs.readFileSync(manifestPath);
  const str = raw.toString('binary');
  assert.ok(!str.includes('\r\n'), 'manifest.json must use LF, not CRLF');
  assert.ok(str.endsWith('\n'), 'manifest.json must end with a trailing newline');
});

test('manifest counts.files matches files array length', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  assert.strictEqual(richManifest.counts.files, richManifest.files.length,
    'counts.files must match files.length'
  );
});

test('manifest counts.nodes matches nodes array length', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  assert.strictEqual(richManifest.counts.nodes, richManifest.nodes.length,
    'counts.nodes must match nodes.length'
  );
});

// ─── Scanner / DocType classification (AC 1) ─────────────────────────────────
console.log('\n--- Scanner / DocType classification (AC 1) ---');

test('prd.md classified as prd', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const prdFile = richManifest.files.find(f => f.path.includes('prd.md') && !f.path.includes('architecture'));
  assert.ok(prdFile, 'must have a prd.md file record');
  assert.strictEqual(prdFile.type, 'prd', `prd.md must be type=prd, got: ${prdFile.type}`);
});

test('epics.md classified as epics', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const epicsFile = richManifest.files.find(f => f.path.endsWith('epics.md'));
  assert.ok(epicsFile, 'must have epics.md file record');
  assert.strictEqual(epicsFile.type, 'epics');
});

test('architecture.md classified as architecture', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const archFile = richManifest.files.find(f => f.path.includes('architecture.md'));
  assert.ok(archFile, 'must have architecture.md file record');
  assert.strictEqual(archFile.type, 'architecture');
});

test('sprint-status.yaml classified as sprint-status', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const ssFile = richManifest.files.find(f => f.path.includes('sprint-status.yaml'));
  assert.ok(ssFile, 'must have sprint-status.yaml file record');
  assert.strictEqual(ssFile.type, 'sprint-status');
});

test('NN-M-slug.md story file classified as story', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const storyFile = richManifest.files.find(f => f.path.includes('1-1-oauth2-integration.md'));
  assert.ok(storyFile, 'must have story file record');
  assert.strictEqual(storyFile.type, 'story');
});

test('bug-*.md classified as bug', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const bugFile = richManifest.files.find(f => f.path.includes('bug-null-pointer'));
  assert.ok(bugFile, 'must have bug file record');
  assert.strictEqual(bugFile.type, 'bug');
});

test('epic-N-retrospective.md classified as retrospective', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const retroFile = richManifest.files.find(f => f.path.includes('epic-1-retrospective'));
  assert.ok(retroFile, 'must have retrospective file record');
  assert.strictEqual(retroFile.type, 'retrospective');
});

test('project-context.md classified as project-context', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const pcFile = richManifest.files.find(f => f.path.includes('project-context.md'));
  assert.ok(pcFile, 'must have project-context.md file record');
  assert.strictEqual(pcFile.type, 'project-context');
});

test('briefs/ file classified as brief', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const briefFile = richManifest.files.find(f => f.path.includes('/briefs/'));
  assert.ok(briefFile, 'must have a brief file record');
  assert.strictEqual(briefFile.type, 'brief');
});

test('knowledge-graph.json classified as knowledge-graph', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const kgFile = richManifest.files.find(f => f.path.includes('knowledge-graph.json'));
  assert.ok(kgFile, 'must have knowledge-graph.json file record');
  assert.strictEqual(kgFile.type, 'knowledge-graph');
});

test('scanner excludes knowledge-site/ directory', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const ksSiteFiles = richManifest.files.filter(f => f.path.includes('knowledge-site/'));
  assert.deepStrictEqual(ksSiteFiles, [], 'knowledge-site/ files must be excluded from scan');
});

test('file-ids are POSIX (forward slashes)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  for (const rec of richManifest.files) {
    assert.ok(!rec.path.includes('\\'),
      `file-id must use forward slashes, got: ${rec.path}`
    );
  }
});

test('files are sorted by path', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const paths = richManifest.files.map(f => f.path);
  const sorted = [...paths].sort();
  assert.deepStrictEqual(paths, sorted, 'files must be sorted by path');
});

// ─── Entity extraction (AC 2) ────────────────────────────────────────────────
console.log('\n--- Entity extraction (AC 2) ---');

test('FR### tokens extracted from prd.md', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const prdRec = richManifest.files.find(f => f.path.includes('prd.md') && !f.path.includes('architecture'));
  assert.ok(prdRec, 'must have prd.md record');
  assert.ok(prdRec.entities.includes('FR101'), `entities must include FR101, got: ${JSON.stringify(prdRec.entities)}`);
  assert.ok(prdRec.entities.includes('FR102'), `entities must include FR102`);
  assert.ok(prdRec.entities.includes('FR103'), `entities must include FR103`);
});

test('NFR## tokens extracted from prd.md', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const prdRec = richManifest.files.find(f => f.path.includes('prd.md') && !f.path.includes('architecture'));
  assert.ok(prdRec.entities.includes('NFR56'), `entities must include NFR56, got: ${JSON.stringify(prdRec.entities)}`);
  assert.ok(prdRec.entities.includes('NFR62'), `entities must include NFR62`);
});

test('F## capability tokens extracted', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const prdRec = richManifest.files.find(f => f.path.includes('prd.md') && !f.path.includes('architecture'));
  // F1, F2, F3 from prd.md
  assert.ok(prdRec.entities.includes('F1'), `entities must include F1, got: ${JSON.stringify(prdRec.entities)}`);
  assert.ok(prdRec.entities.includes('F2'), `entities must include F2`);
  assert.ok(prdRec.entities.includes('F3'), `entities must include F3`);
});

test('Epic N tokens extracted from epics.md', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const epicsRec = richManifest.files.find(f => f.path.endsWith('epics.md'));
  assert.ok(epicsRec, 'must have epics.md');
  assert.ok(epicsRec.entities.includes('Epic 1'), `must include Epic 1, got: ${JSON.stringify(epicsRec.entities)}`);
  assert.ok(epicsRec.entities.includes('Epic 2'), 'must include Epic 2');
});

test('Story N.M tokens extracted from epics.md', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const epicsRec = richManifest.files.find(f => f.path.endsWith('epics.md'));
  assert.ok(epicsRec.entities.includes('Story 1.1'), `must include Story 1.1, got: ${JSON.stringify(epicsRec.entities)}`);
  assert.ok(epicsRec.entities.includes('Story 1.2'), 'must include Story 1.2');
});

test('story file key extracted (NN-M-slug format)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // The sprint-status.yaml references story ids
  const ssRec = richManifest.files.find(f => f.path.includes('sprint-status.yaml'));
  assert.ok(ssRec, 'must have sprint-status.yaml');
  assert.ok(ssRec.entities.includes('1-1-oauth2-integration'),
    `sprint-status entities must include 1-1-oauth2-integration, got: ${JSON.stringify(ssRec.entities)}`
  );
});

test('bug-<slug> tokens extracted', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const bugRec = richManifest.files.find(f => f.path.includes('bug-null-pointer'));
  assert.ok(bugRec, 'must have bug file');
  // The bug file itself should mention related entities
  // Also check sprint-status.yaml has the bug reference
  const ssRec = richManifest.files.find(f => f.path.includes('sprint-status.yaml'));
  assert.ok(ssRec.entities.includes('bug-null-pointer-on-export'),
    `sprint-status entities must include bug reference, got: ${JSON.stringify(ssRec.entities)}`
  );
});

test('P#-# architecture decision tokens extracted', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const archRec = richManifest.files.find(f => f.path.includes('architecture.md'));
  assert.ok(archRec, 'must have architecture.md');
  assert.ok(archRec.entities.includes('P5-7'), `must include P5-7, got: ${JSON.stringify(archRec.entities)}`);
  assert.ok(archRec.entities.includes('P3-1'), 'must include P3-1');
  assert.ok(archRec.entities.includes('P5-1'), 'must include P5-1');
});

test('epic-N-retrospective tokens extracted from retrospective file', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const retroRec = richManifest.files.find(f => f.path.includes('epic-1-retrospective'));
  assert.ok(retroRec, 'must have retrospective file');
  assert.ok(retroRec.entities.includes('epic-1-retrospective'),
    `must include epic-1-retrospective, got: ${JSON.stringify(retroRec.entities)}`
  );
});

test('lifecycle status persisted on FileRecord (item 12)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // The story fixture has frontmatter `status: done`.
  const storyRec = richManifest.files.find(f => f.path.includes('1-1-oauth2-integration'));
  assert.ok(storyRec, 'must have story record');
  assert.ok(Array.isArray(storyRec.statuses), 'FileRecord must carry a statuses array');
  assert.ok(storyRec.statuses.includes('done'),
    `story FileRecord must include status 'done', got: ${JSON.stringify(storyRec.statuses)}`
  );
});

test("story node carries lifecycle status (item 12: 29.3 badges)", () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const storyNode = richManifest.nodes.find(n =>
    n.kind === 'story' && n.fileId.includes('1-1-oauth2-integration'));
  assert.ok(storyNode, 'must have a story node for 1-1-oauth2-integration');
  assert.strictEqual(storyNode.status, 'done',
    `story node must carry status 'done', got: ${storyNode.status}`
  );
});

test('status body false-positive guard: not-in-progress does not match (item 6)', () => {
  const tmpDir = makeTempDir('status-fp');
  fs.mkdirSync(path.join(tmpDir, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'status-fp' }));
  // A story whose body says "not-in-progress" and "not-done" but frontmatter is backlog.
  fs.writeFileSync(
    path.join(tmpDir, '_bmad-output', 'implementation-artifacts', '9-9-guard.md'),
    '---\nstatus: backlog\n---\n# Story 9.9: Guard\n\nThis is not-in-progress and not-done yet.\n',
    'utf-8'
  );
  const manifest = runAtlas(tmpDir);
  const rec = manifest.files.find(f => f.path.includes('9-9-guard'));
  assert.ok(rec, 'must have the guard story record');
  assert.ok(rec.statuses.includes('backlog'), 'frontmatter backlog must be captured');
  assert.ok(!rec.statuses.includes('in-progress'),
    `'not-in-progress' must NOT yield 'in-progress', got: ${JSON.stringify(rec.statuses)}`
  );
  assert.ok(!rec.statuses.includes('done'),
    `'not-done' must NOT yield 'done', got: ${JSON.stringify(rec.statuses)}`
  );
});

// ─── Graph nodes and edges (AC 3) ────────────────────────────────────────────
console.log('\n--- Graph nodes and edges (AC 3) ---');

test('nodes have required fields: id, kind, label, fileId', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  for (const node of richManifest.nodes) {
    assert.ok(typeof node.id === 'string' && node.id, `node must have string id`);
    assert.ok(typeof node.kind === 'string' && node.kind, `node must have kind`);
    assert.ok(typeof node.label === 'string' && node.label, `node must have label`);
    assert.ok(typeof node.fileId === 'string' && node.fileId, `node must have fileId`);
  }
});

test('requirement nodes exist (FR101)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const reqNodes = richManifest.nodes.filter(n => n.kind === 'requirement');
  assert.ok(reqNodes.length > 0, 'must have requirement nodes');
  const fr101 = reqNodes.find(n => n.label === 'FR101');
  assert.ok(fr101, `must have FR101 node, got: ${reqNodes.map(n=>n.label).join(', ')}`);
});

test('nfr nodes exist (NFR56)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const nfrNodes = richManifest.nodes.filter(n => n.kind === 'nfr');
  assert.ok(nfrNodes.length > 0, 'must have nfr nodes');
  const nfr56 = nfrNodes.find(n => n.label === 'NFR56');
  assert.ok(nfr56, `must have NFR56 node, got: ${nfrNodes.map(n=>n.label).join(', ')}`);
});

test('epic nodes exist (Epic 1)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const epicNodes = richManifest.nodes.filter(n => n.kind === 'epic');
  assert.ok(epicNodes.length > 0, 'must have epic nodes');
});

test('story nodes exist', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const storyNodes = richManifest.nodes.filter(n => n.kind === 'story');
  assert.ok(storyNodes.length > 0, 'must have story nodes');
});

test('bug nodes exist', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const bugNodes = richManifest.nodes.filter(n => n.kind === 'bug');
  assert.ok(bugNodes.length > 0, 'must have bug nodes');
});

test('arch-decision nodes exist (P5-7)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const archNodes = richManifest.nodes.filter(n => n.kind === 'arch-decision');
  assert.ok(archNodes.length > 0, 'must have arch-decision nodes');
  const p57 = archNodes.find(n => n.label === 'P5-7');
  assert.ok(p57, `must have P5-7 node, got: ${archNodes.map(n=>n.label).join(', ')}`);
});

test('retrospective nodes exist', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const retroNodes = richManifest.nodes.filter(n => n.kind === 'retrospective');
  assert.ok(retroNodes.length > 0, 'must have retrospective nodes');
});

test('capability nodes exist (F1)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const capNodes = richManifest.nodes.filter(n => n.kind === 'capability');
  assert.ok(capNodes.length > 0, 'must have capability nodes');
  const f1 = capNodes.find(n => n.label === 'F1');
  assert.ok(f1, `must have F1 node, got: ${capNodes.map(n=>n.label).join(', ')}`);
});

test('node ids use file-id#anchor scheme (P3-1)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // Nodes with anchors must have '#' in their id
  const nodesWithAnchors = richManifest.nodes.filter(n => n.anchor);
  for (const node of nodesWithAnchors) {
    assert.ok(node.id.includes('#'),
      `node with anchor must have # in id: ${node.id}`
    );
    assert.ok(node.id.startsWith(node.fileId),
      `node id must start with fileId: id=${node.id}, fileId=${node.fileId}`
    );
  }
});

test('nodes are sorted by id', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const ids = richManifest.nodes.map(n => n.id);
  const sorted = [...ids].sort();
  assert.deepStrictEqual(ids, sorted, 'nodes must be sorted by id');
});

test('edges have required fields: from, to, kind', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  for (const edge of richManifest.edges) {
    assert.ok(typeof edge.from === 'string', 'edge must have from');
    assert.ok(typeof edge.to === 'string', 'edge must have to');
    assert.ok(typeof edge.kind === 'string', 'edge must have kind');
  }
});

test('implements edges exist (story → FR/NFR)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const implEdges = richManifest.edges.filter(e => e.kind === 'implements');
  assert.ok(implEdges.length > 0, `must have implements edges, got ${richManifest.edges.length} total edges`);
});

test('derives-from edges exist (story → epic)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const dfEdges = richManifest.edges.filter(e => e.kind === 'derives-from');
  assert.ok(dfEdges.length > 0, 'must have derives-from edges');
});

test('validates edges exist (retro → epic)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const valEdges = richManifest.edges.filter(e => e.kind === 'validates');
  assert.ok(valEdges.length > 0, 'must have validates edges');
});

test('shipped-in edges exist', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const shipEdges = richManifest.edges.filter(e => e.kind === 'shipped-in');
  assert.ok(shipEdges.length > 0, 'must have shipped-in edges (from "shipped v1.0.0")');
});

test('edges are sorted by (from, to, kind)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // Use a 3-field comparator (not a single concatenated key with a separator,
  // since a separator like '|' can alter sort order relative to chars in the fields).
  const edges = richManifest.edges;
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
      `edges not sorted at index ${i}: ` +
      `[${prev.from}|${prev.to}|${prev.kind}] should come before ` +
      `[${curr.from}|${curr.to}|${curr.kind}]`
    );
  }
});

test('addressed-by edge from bug (item 1): Story 2.1 → bug, kind=addressed-by', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // bug fixture has "## Addressed by: Story 2.1" → edge {from: Story 2.1, to: bug}
  const abEdges = richManifest.edges.filter(e => e.kind === 'addressed-by');
  assert.ok(abEdges.length > 0,
    `must have addressed-by edges, got kinds: ${[...new Set(richManifest.edges.map(e=>e.kind))].join(',')}`
  );
  const toBug = abEdges.find(e => e.to.includes('bug-null-pointer'));
  assert.ok(toBug, `addressed-by edge must target the bug, got: ${JSON.stringify(abEdges)}`);
});

test('depends-on edge has correct direction (story → Story 1.2)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // story 1.1 has "## Depends on: Story 1.2" → {from: story-1.1 file, to: Story 1.2}
  const depEdges = richManifest.edges.filter(e => e.kind === 'depends-on');
  assert.ok(depEdges.length > 0, 'must have depends-on edges');
  const fromStory11 = depEdges.find(e => e.from.includes('1-1-oauth2-integration'));
  assert.ok(fromStory11,
    `depends-on must originate from story 1.1, got: ${JSON.stringify(depEdges)}`
  );
  // The target should resolve to the Story 1.2 entity (anchor story-1-2, item 10).
  assert.ok(/story-1-2|1-2-/.test(fromStory11.to),
    `depends-on target should be Story 1.2, got: ${fromStory11.to}`
  );
});

test('story def-site is the story file, not a referencing file (item 3: no self-edge)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // No depends-on/derives-from edge may have from === to (a self-edge).
  for (const e of richManifest.edges) {
    assert.notStrictEqual(e.from, e.to,
      `self-edge detected: ${e.from} --${e.kind}--> ${e.to}`
    );
  }
});

test('Story 1.2 vs Story 1.20 get distinct anchors (item 10: dot disambiguation)', () => {
  // The collision risk is that a naive heading-slug strips the dot, mapping
  // both `Story 1.2` and `Story 12` to `story-12`. Our entity slug maps dot→`-`
  // so `Story 1.2`→`story-1-2`. Here we prove `Story 1.2` and `Story 1.20`
  // (both real `Story N.M` tokens) get distinct, non-colliding anchors.
  const tmpDir = makeTempDir('anchor-collision');
  fs.mkdirSync(path.join(tmpDir, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'anchor-collision' }));
  fs.writeFileSync(
    path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'epics.md'),
    '# Epics\n\nStory 1.2 is small. Story 1.20 is large. Both are referenced here.\n',
    'utf-8'
  );
  const manifest = runAtlas(tmpDir);
  const storyNodes = manifest.nodes.filter(n => n.kind === 'story');
  const s12 = storyNodes.find(n => n.label === 'Story 1.2');
  const s120 = storyNodes.find(n => n.label === 'Story 1.20');
  assert.ok(s12, `must have a Story 1.2 node, got: ${storyNodes.map(n=>n.label).join(', ')}`);
  assert.ok(s120, `must have a Story 1.20 node, got: ${storyNodes.map(n=>n.label).join(', ')}`);
  assert.notStrictEqual(s12.id, s120.id, 'Story 1.2 and Story 1.20 must have distinct ids');
  assert.strictEqual(s12.anchor, 'story-1-2', `Story 1.2 anchor must be story-1-2, got: ${s12.anchor}`);
  assert.strictEqual(s120.anchor, 'story-1-20', `Story 1.20 anchor must be story-1-20, got: ${s120.anchor}`);
});

test('entity tokens inside code fences are NOT extracted (item 7)', () => {
  const tmpDir = makeTempDir('code-fence');
  fs.mkdirSync(path.join(tmpDir, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'code-fence' }));
  fs.writeFileSync(
    path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'prd.md'),
    [
      '# PRD',
      '',
      'Real requirement: FR500.',
      '',
      '```',
      'const x = "FR999";  // code sample, NOT a real reference',
      'Epic 99 in a code block',
      '```',
      '',
      'Inline `FR888` should also be ignored.',
      '',
    ].join('\n'),
    'utf-8'
  );
  const manifest = runAtlas(tmpDir);
  const allEntities = manifest.files.flatMap(f => f.entities);
  assert.ok(allEntities.includes('FR500'), `real FR500 must be extracted, got: ${JSON.stringify(allEntities)}`);
  assert.ok(!allEntities.includes('FR999'), 'fenced FR999 must NOT be extracted');
  assert.ok(!allEntities.includes('Epic 99'), 'fenced Epic 99 must NOT be extracted');
  assert.ok(!allEntities.includes('FR888'), 'inline-code FR888 must NOT be extracted');
});

test('done/ subfolder files are scanned (item 13)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const doneRec = richManifest.files.find(f => f.path.includes('/done/1-2-session-management'));
  assert.ok(doneRec, `done/ file must be scanned, files: ${richManifest.files.map(f=>f.path).join(', ')}`);
  assert.strictEqual(doneRec.type, 'story', 'done/ story file must classify as story');
});

test('knowledge-graph.json is not entity-extracted (item 2: no spurious nodes)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const kgRec = richManifest.files.find(f => f.path.endsWith('knowledge-graph.json'));
  assert.ok(kgRec, 'must have knowledge-graph.json record');
  assert.deepStrictEqual(kgRec.entities, [],
    `knowledge-graph.json must have NO extracted entities, got: ${JSON.stringify(kgRec.entities)}`
  );
  assert.deepStrictEqual(kgRec.edges, [], 'knowledge-graph.json must have NO extracted edges');
  // And no duplicate F99 capability node beyond the single kg-only one.
  const f99 = richManifest.nodes.filter(n => n.label === 'F99');
  assert.ok(f99.length <= 1, `F99 must appear at most once, got ${f99.length}`);
});

test('shipped-in edges target version nodes and are NOT dangling (item 17)', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  const shipEdges = richManifest.edges.filter(e => e.kind === 'shipped-in');
  assert.ok(shipEdges.length > 0, 'must have shipped-in edges');
  for (const e of shipEdges) {
    assert.ok(e.to.startsWith('version:'), `shipped-in target must be a version: id, got ${e.to}`);
    assert.ok(!e.dangling, `shipped-in edge must NOT be flagged dangling: ${e.to}`);
  }
});

// ─── Tolerant scan: missing docs (AC 1) ─────────────────────────────────────
console.log('\n--- Tolerant scan: missing-docs-project (AC 1) ---');

let missingManifest;

test('missing-docs-project: generate succeeds with only a PRD', () => {
  const tmpDir = makeTempDir('missing');
  copyDirRecursive(MISSING_FIXTURE, tmpDir);
  missingManifest = runAtlas(tmpDir);
  assert.ok(missingManifest, 'must produce a manifest');
  assert.ok(Array.isArray(missingManifest.files), 'must have files array');
});

test('missing-docs-project: only PRD in files list', () => {
  if (!missingManifest) throw new Error('manifest not generated (prior test failed)');
  assert.ok(missingManifest.files.length >= 1, 'must have at least 1 file');
  const prdRec = missingManifest.files.find(f => f.path.includes('prd.md'));
  assert.ok(prdRec, 'must have the PRD in files');
  assert.strictEqual(prdRec.type, 'prd');
});

test('missing-docs-project: FR/NFR extracted from PRD', () => {
  if (!missingManifest) throw new Error('manifest not generated (prior test failed)');
  const allEntities = missingManifest.files.flatMap(f => f.entities);
  assert.ok(allEntities.includes('FR201'), `must extract FR201, got: ${JSON.stringify(allEntities)}`);
  assert.ok(allEntities.includes('NFR10'), `must extract NFR10`);
});

test('missing-docs-project: no implementation-artifacts/ files', () => {
  if (!missingManifest) throw new Error('manifest not generated (prior test failed)');
  const implFiles = missingManifest.files.filter(f => f.path.includes('implementation-artifacts/'));
  assert.deepStrictEqual(implFiles, [], 'must have no implementation-artifacts files');
});

test('no _bmad-output: generates empty but valid manifest', () => {
  const tmpDir = makeTempDir('noBmad');
  // Create a minimal project WITHOUT _bmad-output
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'no-bmad' }));
  const manifest = runAtlas(tmpDir);
  assert.ok(manifest, 'must produce a manifest even without _bmad-output');
  assert.deepStrictEqual(manifest.files, [], 'files must be empty array');
  assert.ok(Array.isArray(manifest.nodes), 'must have nodes array');
  assert.ok(Array.isArray(manifest.edges), 'must have edges array');
});

// ─── CRLF ≡ LF hashing (AC 7) ───────────────────────────────────────────────
console.log('\n--- CRLF ≡ LF hashing (AC 7) ---');

test('CRLF and LF copies of same file produce identical content hash', () => {
  // Read one of our fixture files
  const prdPath = path.join(RICH_FIXTURE, '_bmad-output', 'planning-artifacts', 'prd.md');
  const originalContent = fs.readFileSync(prdPath, 'utf-8');

  const tmpDir = makeTempDir('crlf');

  // Write LF version
  const lfPath = path.join(tmpDir, 'lf.md');
  fs.writeFileSync(lfPath, originalContent.replace(/\r\n/g, '\n'), 'utf-8');

  // Write CRLF version (simulate Windows checkout)
  const crlfPath = path.join(tmpDir, 'crlf.md');
  const crlfContent = originalContent.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(crlfPath, crlfContent, 'utf-8');

  const lfHash = contentHash(lfPath);
  const crlfHash = contentHash(crlfPath);

  assert.strictEqual(lfHash, crlfHash,
    `CRLF and LF copies must hash identically: LF=${lfHash.slice(0,8)}, CRLF=${crlfHash.slice(0,8)}`
  );
});

test('BOM does not change the content hash (item 14)', () => {
  const tmpDir = makeTempDir('bom');
  const body = '# Title\n\nFR1 content.\n';
  const noBom = path.join(tmpDir, 'nobom.md');
  const withBom = path.join(tmpDir, 'withbom.md');
  fs.writeFileSync(noBom, body, 'utf-8');
  fs.writeFileSync(withBom, '﻿' + body, 'utf-8');
  assert.strictEqual(contentHash(noBom), contentHash(withBom),
    'a leading UTF-8 BOM must not change the content hash'
  );
});

test('binary files are skipped (item 15)', () => {
  const tmpDir = makeTempDir('binary');
  fs.mkdirSync(path.join(tmpDir, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'binary-proj' }));
  fs.writeFileSync(path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'prd.md'), '# PRD\n\nFR1.\n', 'utf-8');
  // A PNG (binary extension) and a file with a NUL byte and no binary extension.
  fs.writeFileSync(path.join(tmpDir, '_bmad-output', 'diagram.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  fs.writeFileSync(path.join(tmpDir, '_bmad-output', 'blob.dat'), Buffer.from([0x41, 0x00, 0x42, 0x00]));
  const manifest = runAtlas(tmpDir);
  assert.ok(!manifest.files.find(f => f.path.endsWith('diagram.png')), 'PNG must be skipped');
  assert.ok(!manifest.files.find(f => f.path.endsWith('blob.dat')), 'NUL-byte file must be skipped');
  assert.ok(manifest.files.find(f => f.path.endsWith('prd.md')), 'text PRD must still be scanned');
});

test('output dir is excluded even with trailing slash in outDir (item 20)', () => {
  // Generate once to create knowledge-site/, then generate again — the prior
  // manifest.json under knowledge-site/ must never be scanned into the manifest.
  const tmpDir = makeTempDir('outdir-exclude');
  copyDirRecursive(RICH_FIXTURE, tmpDir);
  runAtlas(tmpDir);
  const manifest = runAtlas(tmpDir);
  const leaked = manifest.files.filter(f => f.path.includes('knowledge-site/'));
  assert.deepStrictEqual(leaked, [], `knowledge-site/ must never be scanned, leaked: ${leaked.map(f=>f.path).join(', ')}`);
});

// ─── Incremental rebuild (AC 5) ─────────────────────────────────────────────
console.log('\n--- Incremental rebuild (AC 5) ---');

test('incremental ≡ full: second run on unchanged tree produces identical manifest', () => {
  const tmpDir = makeTempDir('incr');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // First run (full build)
  const manifest1 = runAtlas(tmpDir);

  // Second run (incremental — no files changed)
  const manifest2 = runAtlas(tmpDir);

  // Compare files, nodes, edges arrays (not generatedAt — it's pinned to same epoch)
  assert.deepStrictEqual(
    manifest1.files.map(f => ({ path: f.path, contentHash: f.contentHash, type: f.type })),
    manifest2.files.map(f => ({ path: f.path, contentHash: f.contentHash, type: f.type })),
    'files must be identical on second run'
  );
  assert.deepStrictEqual(manifest1.nodes, manifest2.nodes, 'nodes must be identical on second run');
  assert.deepStrictEqual(manifest1.edges, manifest2.edges, 'edges must be identical on second run');
});

test('incremental: changed file is reprocessed; unchanged files are reused', () => {
  const tmpDir = makeTempDir('incr-change');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // First run: establish baseline
  const manifest1 = runAtlas(tmpDir);
  const prdPath = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'prd.md');
  const origPrdHash = manifest1.files.find(f => f.path.endsWith('prd.md') && !f.path.includes('architecture')).contentHash;

  // Change the PRD (add a new entity)
  const prdContent = fs.readFileSync(prdPath, 'utf-8');
  fs.writeFileSync(prdPath, prdContent + '\nFR999: New incremental requirement.\n', 'utf-8');

  // Second run: incremental
  const manifest2 = runAtlas(tmpDir);

  // PRD must be reprocessed (hash changed)
  const prdRec2 = manifest2.files.find(f => f.path.endsWith('prd.md') && !f.path.includes('architecture'));
  assert.ok(prdRec2.contentHash !== origPrdHash, 'changed PRD must have new hash');

  // Changed file must now include FR999
  assert.ok(prdRec2.entities.includes('FR999'),
    `changed PRD must have FR999, got: ${JSON.stringify(prdRec2.entities)}`
  );

  // Unchanged files must have same hashes as in manifest1
  for (const rec1 of manifest1.files) {
    const rec2 = manifest2.files.find(f => f.path === rec1.path);
    if (!rec2 || rec1.path.endsWith('prd.md')) continue;
    assert.strictEqual(rec2.contentHash, rec1.contentHash,
      `unchanged file ${rec1.path} must have same hash`
    );
  }
});

test('incremental: added file appears in manifest', () => {
  const tmpDir = makeTempDir('incr-add');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // First run: baseline (no 2-1-csv-export.md)
  const manifest1 = runAtlas(tmpDir);
  assert.ok(!manifest1.files.find(f => f.path.includes('2-1-csv-export')), 'file must not exist in manifest1');

  // Add a new story file
  const newStoryPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', '2-1-csv-export.md');
  fs.writeFileSync(newStoryPath,
    '---\nstatus: in-progress\nepic: epic-2\n---\n# Story 2.1: CSV Export\n\nImplements FR102.\nEpic 2 scope.\n',
    'utf-8'
  );

  // Second run: incremental
  const manifest2 = runAtlas(tmpDir);
  const newRec = manifest2.files.find(f => f.path.includes('2-1-csv-export'));
  assert.ok(newRec, 'added file must appear in manifest2');
  assert.strictEqual(newRec.type, 'story');
  assert.ok(newRec.entities.includes('FR102'), 'added story must reference FR102');
});

test('incremental: removed file disappears from manifest', () => {
  const tmpDir = makeTempDir('incr-remove');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // First run: baseline (includes epic-1-retrospective.md)
  const manifest1 = runAtlas(tmpDir);
  assert.ok(manifest1.files.find(f => f.path.includes('epic-1-retrospective')), 'retro must be in manifest1');

  // Remove the retrospective file
  const retroPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'epic-1-retrospective.md');
  fs.unlinkSync(retroPath);

  // Second run: incremental
  const manifest2 = runAtlas(tmpDir);
  const retroRec2 = manifest2.files.find(f => f.path.includes('epic-1-retrospective'));
  assert.ok(!retroRec2, 'removed file must not appear in manifest2');
});

test('incremental: renamed file (same content, new path) is reconciled', () => {
  const tmpDir = makeTempDir('incr-rename');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // Baseline
  const manifest1 = runAtlas(tmpDir);
  const oldPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'bug-null-pointer-on-export.md');
  const oldRec = manifest1.files.find(f => f.path.includes('bug-null-pointer-on-export'));
  assert.ok(oldRec, 'bug file must be in baseline');

  // Rename (same content, new path) — keep the bug- prefix so it stays a bug type.
  const newPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'bug-null-pointer-renamed.md');
  fs.renameSync(oldPath, newPath);

  const manifest2 = runAtlas(tmpDir);
  assert.ok(!manifest2.files.find(f => f.path.includes('bug-null-pointer-on-export')),
    'old path must be gone after rename');
  const newRec = manifest2.files.find(f => f.path.includes('bug-null-pointer-renamed'));
  assert.ok(newRec, 'renamed path must appear');
  assert.strictEqual(newRec.contentHash, oldRec.contentHash,
    'renamed file keeps the same content hash');
});

test('incremental: schema-version mismatch forces a full rebuild (item 19)', () => {
  const tmpDir = makeTempDir('incr-schema');
  copyDirRecursive(RICH_FIXTURE, tmpDir);

  // Baseline build.
  runAtlas(tmpDir);
  const manifestPath = path.join(tmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Corrupt the prior manifest: bump version AND poison a file record so that if
  // it were (wrongly) reused, the output would reflect the stale record.
  prior.version = 9999;
  if (prior.files[0]) prior.files[0].contentHash = 'STALE_HASH_SHOULD_NOT_SURVIVE';
  fs.writeFileSync(manifestPath, JSON.stringify(prior, null, 2) + '\n', 'utf-8');

  // Rebuild: version mismatch → full rebuild → no stale hash survives.
  const manifest2 = runAtlas(tmpDir);
  assert.strictEqual(manifest2.version, 1, 'rebuilt manifest must use current version');
  assert.ok(!manifest2.files.find(f => f.contentHash === 'STALE_HASH_SHOULD_NOT_SURVIVE'),
    'stale-version prior records must NOT flow through the diff'
  );
});

test('incremental ≡ full: incremental rebuild matches a fresh full build (item 4)', () => {
  // TRUE incremental-vs-full equivalence:
  //   tmpIncr: (a) full build to PRIME a prior manifest → (b) mutate → (c) incremental rebuild
  //   tmpFull: start from the SAME mutated state, (d) single fresh full build
  //   (e) byte-compare the two manifest.json outputs (modulo path-specific meta).
  const tmpIncr = makeTempDir('equiv-incr');
  const tmpFull = makeTempDir('equiv-full');
  copyDirRecursive(RICH_FIXTURE, tmpIncr);

  // (a) Prime tmpIncr with a full build (writes a prior manifest.json).
  runAtlas(tmpIncr);

  // (b) Mutate tmpIncr: change a file, add a file, remove a file.
  const incrPrd = path.join(tmpIncr, '_bmad-output', 'planning-artifacts', 'prd.md');
  fs.appendFileSync(incrPrd, '\nFR888: Equivalence test requirement.\n');
  fs.writeFileSync(
    path.join(tmpIncr, '_bmad-output', 'implementation-artifacts', '3-1-new-feature.md'),
    '---\nstatus: in-progress\nepic: epic-2\n---\n# Story 3.1: New Feature\n\nImplements FR888.\nEpic 2 scope.\n',
    'utf-8'
  );
  fs.unlinkSync(path.join(tmpIncr, '_bmad-output', 'implementation-artifacts', 'epic-1-retrospective.md'));

  // (c) Incremental rebuild on tmpIncr (prior manifest present).
  runAtlas(tmpIncr);

  // (d) Build tmpFull from the SAME mutated end-state, fresh (no prior manifest).
  copyDirRecursive(tmpIncr, tmpFull);
  // Drop tmpFull's copied knowledge-site so its build starts with NO prior manifest.
  fs.rmSync(path.join(tmpFull, '_bmad-output', 'knowledge-site'), { recursive: true, force: true });
  runAtlas(tmpFull);

  // (e) Byte-compare the manifests, modulo path-specific meta (projectRoot/bmadOutputDir
  // differ by temp dir; generatedAt is pinned to the same epoch so it matches).
  const readManifestStripped = (root) => {
    const raw = fs.readFileSync(
      path.join(root, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8');
    const m = JSON.parse(raw);
    delete m.projectRoot;
    delete m.bmadOutputDir;
    return JSON.stringify(m);
  };

  const incrJson = readManifestStripped(tmpIncr);
  const fullJson = readManifestStripped(tmpFull);
  assert.strictEqual(incrJson, fullJson,
    'incremental rebuild must be byte-identical to a fresh full build (modulo path meta)'
  );

  // Sanity: the mutation actually took effect.
  const m = JSON.parse(incrJson);
  assert.ok(m.files.find(f => f.path.includes('3-1-new-feature')), 'added file present');
  assert.ok(!m.files.find(f => f.path.includes('epic-1-retrospective')), 'removed file gone');
  assert.ok(
    m.files.find(f => f.path.endsWith('prd.md') && f.entities.includes('FR888')),
    'changed file reprocessed (FR888 present)'
  );
});

// ─── knowledge-graph.json merge (AC 6) ──────────────────────────────────────
console.log('\n--- knowledge-graph.json merge (AC 6) ---');

test('knowledge-graph.json absent: scan-only manifest has no kg-only nodes', () => {
  const tmpDir = makeTempDir('kg-absent');
  copyDirRecursive(MISSING_FIXTURE, tmpDir);
  // Ensure no knowledge-graph.json
  const kgPath = path.join(tmpDir, '_bmad-output', 'knowledge-graph.json');
  if (fs.existsSync(kgPath)) fs.unlinkSync(kgPath);

  const manifest = runAtlas(tmpDir);
  const kgOnlyNode = manifest.nodes.find(n => n.id === 'kg-only-node-from-legacy');
  assert.ok(!kgOnlyNode, 'kg-only nodes must NOT appear when knowledge-graph.json is absent');
});

test('knowledge-graph.json present: kg-only nodes are merged in', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // rich-project has knowledge-graph.json with 'kg-only-node-from-legacy'
  const kgOnlyNode = richManifest.nodes.find(n => n.id === 'kg-only-node-from-legacy');
  assert.ok(kgOnlyNode, 'kg-only node must be merged from knowledge-graph.json');
  assert.strictEqual(kgOnlyNode.kind, 'capability');
  assert.strictEqual(kgOnlyNode.label, 'F99');
});

test('knowledge-graph.json: scan wins on conflicting node ids', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // The knowledge-graph.json has a node for FR101, but the scan also finds FR101.
  // Scan should win. The node should come from the scan (prd.md), not the kg-only version.
  const fr101Node = richManifest.nodes.find(n => n.label === 'FR101' && n.kind === 'requirement');
  assert.ok(fr101Node, 'FR101 must be in nodes');
  // The scan-derived FR101 node has its fileId pointing to prd.md
  assert.ok(fr101Node.fileId.includes('prd.md'), `FR101 fileId must be from prd.md, got: ${fr101Node.fileId}`);
});

test('knowledge-graph.json: kg-only edges are merged', () => {
  if (!richManifest) throw new Error('manifest not generated (prior test failed)');
  // knowledge-graph.json has an edge from kg-only-node-from-legacy → FR101 (derives-from)
  const kgEdge = richManifest.edges.find(e =>
    e.from === 'kg-only-node-from-legacy' && e.kind === 'derives-from'
  );
  assert.ok(kgEdge, 'kg-only edge must be merged from knowledge-graph.json');
});

test('knowledge-graph.json with nodes/edges as objects does not crash (item 8)', () => {
  const tmpDir = makeTempDir('kg-nonarray');
  copyDirRecursive(MISSING_FIXTURE, tmpDir);
  // Write a malformed knowledge-graph.json where nodes/edges are objects, not arrays.
  fs.writeFileSync(
    path.join(tmpDir, '_bmad-output', 'knowledge-graph.json'),
    JSON.stringify({ meta: {}, nodes: { not: 'an array' }, edges: { also: 'not an array' } }),
    'utf-8'
  );
  // Must not throw; produces a scan-only manifest.
  const manifest = runAtlas(tmpDir);
  assert.ok(Array.isArray(manifest.nodes), 'manifest.nodes must still be an array');
  assert.ok(Array.isArray(manifest.edges), 'manifest.edges must still be an array');
});

test('knowledge-graph.json with duplicate ids yields no duplicate nodes (item 9)', () => {
  const tmpDir = makeTempDir('kg-dupes');
  copyDirRecursive(MISSING_FIXTURE, tmpDir);
  fs.writeFileSync(
    path.join(tmpDir, '_bmad-output', 'knowledge-graph.json'),
    JSON.stringify({
      meta: {},
      nodes: [
        { id: 'dup-node', kind: 'capability', label: 'D1', fileId: 'x', anchor: 'd1' },
        { id: 'dup-node', kind: 'capability', label: 'D1-dupe', fileId: 'x', anchor: 'd1' },
      ],
      edges: [
        { from: 'dup-node', to: 'other', kind: 'implements' },
        { from: 'dup-node', to: 'other', kind: 'implements' },
      ],
    }),
    'utf-8'
  );
  const manifest = runAtlas(tmpDir);
  const dupNodes = manifest.nodes.filter(n => n.id === 'dup-node');
  assert.strictEqual(dupNodes.length, 1, `dup-node must appear exactly once, got ${dupNodes.length}`);
  const dupEdges = manifest.edges.filter(e => e.from === 'dup-node' && e.to === 'other' && e.kind === 'implements');
  assert.strictEqual(dupEdges.length, 1, `duplicate KG edge must be de-duplicated, got ${dupEdges.length}`);
});

// ─── Determinism (AC 7) ──────────────────────────────────────────────────────
console.log('\n--- Determinism (AC 7) ---');

test('two fresh builds of the same tree produce identical manifest.json bytes', () => {
  const tmpA = makeTempDir('det-a');
  const tmpB = makeTempDir('det-b');
  copyDirRecursive(RICH_FIXTURE, tmpA);
  copyDirRecursive(RICH_FIXTURE, tmpB);

  runAtlas(tmpA);
  runAtlas(tmpB);

  const mA = fs.readFileSync(path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json'));
  const mB = fs.readFileSync(path.join(tmpB, '_bmad-output', 'knowledge-site', 'manifest.json'));

  // Compare byte content (excluding projectRoot which will differ between tmp dirs)
  // Parse and compare without projectRoot/bmadOutputDir (those are path-specific)
  const parsedA = JSON.parse(mA.toString('utf-8'));
  const parsedB = JSON.parse(mB.toString('utf-8'));

  // The structural parts must be identical
  assert.deepStrictEqual(
    parsedA.files.map(f => ({ path: f.path, contentHash: f.contentHash, type: f.type })),
    parsedB.files.map(f => ({ path: f.path, contentHash: f.contentHash, type: f.type })),
    'manifest files must be structurally identical across runs'
  );
  assert.deepStrictEqual(parsedA.nodes, parsedB.nodes, 'nodes must be identical');
  assert.deepStrictEqual(parsedA.edges, parsedB.edges, 'edges must be identical');
  assert.deepStrictEqual(parsedA.counts, parsedB.counts, 'counts must be identical');
  assert.strictEqual(parsedA.generatedAt, parsedB.generatedAt, 'generatedAt must be identical');
});

test('manifest.json object keys are in sorted order', () => {
  if (!richTmpDir) throw new Error('rich temp dir not created (prior test failed)');
  const manifestPath = path.join(richTmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');

  // Parse and verify top-level keys are sorted
  const parsed = JSON.parse(raw);
  const topKeys = Object.keys(parsed);
  const sortedKeys = [...topKeys].sort();
  assert.deepStrictEqual(topKeys, sortedKeys, `top-level keys must be sorted: ${topKeys.join(', ')}`);
});

// ─── Write isolation (29.1 compatibility) ────────────────────────────────────
console.log('\n--- Write isolation (29.1 compatibility) ---');

test('nothing written outside _bmad-output/knowledge-site/', () => {
  if (!richTmpDir) throw new Error('rich temp dir not created (prior test failed)');

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
      `Engine wrote outside knowledge-site/: ${f}`
    );
  }
});

test('manifest.json is under _bmad-output/knowledge-site/', () => {
  if (!richTmpDir) throw new Error('rich temp dir not created (prior test failed)');
  const manifestPath = path.join(richTmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), `manifest.json must exist at ${manifestPath}`);
});

test('committed rich-project fixture has no knowledge-site/ dir', () => {
  const ksInFixture = path.join(RICH_FIXTURE, '_bmad-output', 'knowledge-site');
  assert.ok(!fs.existsSync(ksInFixture),
    'Committed fixture must not have knowledge-site/ — tests use temp copies'
  );
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────
for (const dir of tempDirs) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
