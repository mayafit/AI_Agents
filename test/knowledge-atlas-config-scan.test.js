#!/usr/bin/env node
/**
 * test/knowledge-atlas-config-scan.test.js
 * ---------------------------------------------------------------------------
 * Story 29.7 — Config-aware knowledge-source discovery.
 *
 * The engine used to hard-scan `<projectRoot>/_bmad-output` only. Real projects
 * (e.g. Prophesee) set `_bmad/bmm/config.yaml` `planning_artifacts` /
 * `knowledgebase_path` to folders OUTSIDE `_bmad-output`, so their PRD /
 * architecture / requirements were invisible to the Atlas. This suite proves:
 *
 *   AC1/AC2 — config discovery: `{project-root}` placeholder substitution,
 *             surrounding/embedded quote stripping, external docs scanned,
 *             classified, entity-extracted, and cross-source edges resolve.
 *   AC3     — backward-compat: no-config projects keep IDENTICAL fileIds.
 *   AC4     — deterministic fileIds: external sources use `<basename>/...`
 *             (never absolute / `../`); union+dedup of nested/equal sources;
 *             deterministic basename-collision disambiguation.
 *   AC5     — stale-output purge: a removed source doc leaves no orphan page.
 *   AC6     — output honors `output_folder` (default `_bmad-output`).
 *
 * Test style: plain Node assert (no framework), matching repo convention —
 * every assertion runs against the BUILT `atlas.cjs` via spawnSync (never a
 * direct TS/internal import), same as every other knowledge-atlas-*.test.js.
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
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'knowledge-atlas');
const CONFIG_PROJECT = path.join(FIXTURES_DIR, 'config-project');
const CONFIG_PROJECT_KNOWLEDGE = path.join(FIXTURES_DIR, 'config-project-knowledge');
const RICH_FIXTURE = path.join(FIXTURES_DIR, 'rich-project');
const MINIMAL_FIXTURE = path.join(FIXTURES_DIR, 'minimal-project');

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-cfgscan-${prefix}-`));
  tempDirs.push(d);
  return d;
}

/** Write a small file tree: { 'rel/path.md': 'content', ... } under `root`. */
function writeFileTree(root, tree) {
  for (const [rel, content] of Object.entries(tree)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
}

/** Run atlas.cjs against a projectRoot with pinned epoch. Returns the raw spawnSync result. */
function runAtlasRaw(projectRoot, extraEnv) {
  return spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH, ...extraEnv },
      timeout: 30000,
    }
  );
}

/** Run atlas.cjs; throw with full context on non-zero exit; return parsed manifest.json. */
function runAtlas(projectRoot) {
  const result = runAtlasRaw(projectRoot);
  if (result.error) throw new Error(`atlas.cjs failed to run: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`atlas.cjs exited ${result.status}\nstdout:${result.stdout}\nstderr:${result.stderr}`);
  }
  const manifestPath = path.join(projectRoot, '_bmad-output', 'knowledge-site', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not written: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
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

function fileHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/**
 * Set up a projectRoot + its SIBLING `config-project-knowledge` fixture under
 * a common temp parent, so a `{project-root}/../config-project-knowledge`
 * reference in config.yaml resolves correctly (the fixture uses a
 * `{project-root}`-relative sibling path — never a hardcoded absolute machine
 * path — specifically so it is portable across machines/CI).
 */
function setupConfigProjectPair(prefix) {
  const parent = makeTempDir(prefix);
  copyDirRecursive(CONFIG_PROJECT, path.join(parent, 'config-project'));
  copyDirRecursive(CONFIG_PROJECT_KNOWLEDGE, path.join(parent, 'config-project-knowledge'));
  return path.join(parent, 'config-project');
}

/** Extract every href="..." from an HTML string. */
function extractHrefs(html) {
  const hrefs = [];
  const re = /href="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

console.log('\n=== Knowledge Atlas Config-Aware Source Discovery Tests (Story 29.7) ===');

// ─────────────────────────────────────────────────────────────────────────────
// Pre-conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists and is non-empty', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('config-project + config-project-knowledge fixtures exist', () => {
  assert.ok(fs.existsSync(CONFIG_PROJECT), `config-project fixture missing: ${CONFIG_PROJECT}`);
  assert.ok(fs.existsSync(CONFIG_PROJECT_KNOWLEDGE), `config-project-knowledge fixture missing: ${CONFIG_PROJECT_KNOWLEDGE}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC1/AC2 — narrative test: external planning_artifacts/knowledgebase_path,
// quote-stripped + {project-root}-substituted, scanned/classified/extracted,
// with a cross-source implements edge and resolving reading-view links.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC1/AC2: config-project narrative (external source) ---');

let cfgManifest;
let cfgSiteDir;

test('generate config-project (external planning_artifacts/knowledgebase_path)', () => {
  const projectRoot = setupConfigProjectPair('narrative');
  cfgManifest = runAtlas(projectRoot);
  cfgSiteDir = path.join(projectRoot, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(cfgSiteDir), 'knowledge-site output dir must exist');
});

test('external prd.md / architecture.md are scanned with basename-prefixed fileIds', () => {
  const paths = cfgManifest.files.map(f => f.path).sort();
  assert.ok(paths.includes('config-project-knowledge/planning/prd.md'),
    `external prd.md must be scanned, got: ${JSON.stringify(paths)}`);
  assert.ok(paths.includes('config-project-knowledge/planning/architecture.md'),
    `external architecture.md must be scanned, got: ${JSON.stringify(paths)}`);
  assert.ok(paths.includes('_bmad-output/implementation-artifacts/9-1-config-scan.md'),
    `the default _bmad-output source must ALSO still be scanned (union, not replace)`);
});

test('external docs are classified correctly (prd / architecture, not "unknown")', () => {
  const prdRec = cfgManifest.files.find(f => f.path === 'config-project-knowledge/planning/prd.md');
  const archRec = cfgManifest.files.find(f => f.path === 'config-project-knowledge/planning/architecture.md');
  assert.ok(prdRec, 'prd.md record must exist');
  assert.ok(archRec, 'architecture.md record must exist');
  assert.strictEqual(prdRec.type, 'prd', `external prd.md must classify as 'prd', got '${prdRec.type}'`);
  assert.strictEqual(archRec.type, 'architecture', `external architecture.md must classify as 'architecture', got '${archRec.type}'`);
});

test('implementation_artifacts (nested under default _bmad-output) is deduped, not double-scanned', () => {
  const storyOccurrences = cfgManifest.files.filter(f => f.path.endsWith('9-1-config-scan.md'));
  assert.strictEqual(storyOccurrences.length, 1,
    `story file must appear exactly once (implementation_artifacts nests under the default source), got ${storyOccurrences.length}`);
  assert.strictEqual(storyOccurrences[0].path, '_bmad-output/implementation-artifacts/9-1-config-scan.md',
    'the deduped copy must keep the DEFAULT (under-root) fileId scheme, not an "implementation-artifacts/" external prefix');
});

test('planning_artifacts == knowledgebase_path (same external folder) is deduped to ONE source', () => {
  const prdOccurrences = cfgManifest.files.filter(f => f.path.endsWith('planning/prd.md'));
  assert.strictEqual(prdOccurrences.length, 1,
    `prd.md must appear exactly once even though planning_artifacts and knowledgebase_path point at the same folder, got ${prdOccurrences.length}`);
});

test('FR/NFR/P#-# entities are extracted from the external docs', () => {
  const labels = cfgManifest.nodes.map(n => n.label);
  for (const expected of ['FR501', 'FR502', 'NFR501', 'P9-1']) {
    assert.ok(labels.includes(expected), `expected entity ${expected} in nodes, got: ${JSON.stringify(labels)}`);
  }
  const fr501 = cfgManifest.nodes.find(n => n.label === 'FR501');
  assert.strictEqual(fr501.fileId, 'config-project-knowledge/planning/prd.md',
    'FR501 must be defined at the external prd.md (its def-site), not a synthetic/local file');
});

test('story -> FR "implements" edge SPANS sources (default source -> external source)', () => {
  const spanningEdges = cfgManifest.edges.filter(e =>
    e.kind === 'implements' &&
    e.from.startsWith('_bmad-output/') &&
    e.to.startsWith('config-project-knowledge/'));
  assert.ok(spanningEdges.length >= 2,
    `expected >= 2 cross-source implements edges (FR501, NFR501), got: ${JSON.stringify(cfgManifest.edges)}`);
  for (const e of spanningEdges) {
    assert.notStrictEqual(e.dangling, true, `cross-source edge ${e.from} -> ${e.to} must NOT be dangling`);
  }
});

test('reading view for the external prd.md renders REAL content (not "File not found")', () => {
  const prdSlug = 'config-project-knowledge-planning-prd';
  const prdPagePath = path.join(cfgSiteDir, 'docs', `${prdSlug}.html`);
  assert.ok(fs.existsSync(prdPagePath), `external prd.md reading view must exist: ${prdPagePath}`);
  const html = fs.readFileSync(prdPagePath, 'utf-8');
  assert.ok(!html.includes('File not found'),
    'external prd.md must render its REAL content — the absPath resolver must not fall back to path.join(projectRoot, fileId) for an external source');
  assert.ok(html.includes('FR501'), 'external prd.md reading view must contain FR501');
});

test('links from the story reading view to the external FR/NFR/arch nodes resolve on disk', () => {
  const storySlug = 'bmad-output-implementation-artifacts-9-1-config-scan';
  const storyHtml = fs.readFileSync(path.join(cfgSiteDir, 'docs', `${storySlug}.html`), 'utf-8');
  const hrefs = extractHrefs(storyHtml).filter(h => h.includes('config-project-knowledge'));
  assert.ok(hrefs.length > 0, 'story reading view must link to the external source at least once');
  for (const href of hrefs) {
    const target = path.join(cfgSiteDir, 'docs', href.split('#')[0]);
    assert.ok(fs.existsSync(target), `href="${href}" must resolve to an existing file, got missing: ${target}`);
  }
});

test('every internal href in every generated page resolves (full-site sweep, reused link-integrity style)', () => {
  const htmlFiles = collectFiles(cfgSiteDir).filter(f => f.endsWith('.html'));
  const failures = [];
  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(cfgSiteDir, rel), 'utf-8');
    for (const href of extractHrefs(html)) {
      if (!href || href.startsWith('#') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('//')) continue;
      const pageDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      const joined = pageDir ? `${pageDir}/${href.split('#')[0]}` : href.split('#')[0];
      const stack = [];
      for (const part of joined.split('/')) {
        if (part === '..') stack.pop();
        else if (part === '.' || part === '') continue;
        else stack.push(part);
      }
      const target = path.join(cfgSiteDir, stack.join('/'));
      if (!fs.existsSync(target)) failures.push(`${rel} -> href="${href}"`);
    }
  }
  assert.strictEqual(failures.length, 0, `broken internal link(s):\n${failures.join('\n')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — value normalization unit-style tests (synthetic, minimal fixtures
// built inline so each parsing rule is isolated).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC2: config-value normalization ---');

test('missing _bmad/bmm/config.yaml falls back to default _bmad-output only', () => {
  const parent = makeTempDir('no-config');
  writeFileTree(parent, {
    '_bmad-output/doc.md': '# Doc\nFR1\n',
  });
  const manifest = runAtlas(parent);
  assert.deepStrictEqual(manifest.files.map(f => f.path), ['_bmad-output/doc.md']);
});

test('malformed YAML config is tolerated (falls back to default, exits 0)', () => {
  const parent = makeTempDir('malformed-config');
  writeFileTree(parent, {
    '_bmad-output/doc.md': '# Doc\nFR1\n',
    '_bmad/bmm/config.yaml': 'planning_artifacts: ["unterminated\n  - broken: [\n',
  });
  const result = runAtlasRaw(parent);
  assert.strictEqual(result.status, 0, `must exit 0 on malformed config, got ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(parent, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8'));
  assert.deepStrictEqual(manifest.files.map(f => f.path), ['_bmad-output/doc.md']);
});

test('{project-root} placeholder + quote-stripping resolves an under-root folder', () => {
  const parent = makeTempDir('placeholder-quote');
  writeFileTree(parent, {
    '_bmad/bmm/config.yaml': 'planning_artifacts: "\\"{project-root}/ext-quoted\\""\n',
    'ext-quoted/doc.md': '# Ext quoted\nFR900\n',
  });
  const manifest = runAtlas(parent);
  const paths = manifest.files.map(f => f.path).sort();
  assert.ok(paths.includes('ext-quoted/doc.md'),
    `quote-wrapped {project-root} placeholder must resolve and scan the folder, got: ${JSON.stringify(paths)}`);
});

test('bare {project_root} (underscore variant) placeholder also resolves', () => {
  const parent = makeTempDir('placeholder-underscore');
  writeFileTree(parent, {
    '_bmad/bmm/config.yaml': 'implementation_artifacts: "{project_root}/impl-ext"\n',
    'impl-ext/doc.md': '# Impl ext\nFR901\n',
  });
  const manifest = runAtlas(parent);
  const paths = manifest.files.map(f => f.path).sort();
  assert.ok(paths.includes('impl-ext/doc.md'), `{project_root} (underscore) must also substitute, got: ${JSON.stringify(paths)}`);
});

test('a configured path that does not exist on disk is silently skipped (no crash)', () => {
  const parent = makeTempDir('nonexistent-configured');
  writeFileTree(parent, {
    '_bmad-output/doc.md': '# Doc\nFR2\n',
    '_bmad/bmm/config.yaml': 'planning_artifacts: "{project-root}/does-not-exist"\n',
  });
  const manifest = runAtlas(parent);
  assert.deepStrictEqual(manifest.files.map(f => f.path), ['_bmad-output/doc.md']);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — union + dedup + external fileId scheme + collision disambiguation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC4: union, dedup, external fileId scheme, collision disambiguation ---');

test('nested source (implementation_artifacts under default _bmad-output) is deduped to the broader source', () => {
  const parent = makeTempDir('nested-dedup');
  writeFileTree(parent, {
    '_bmad-output/implementation-artifacts/nested.md': '# Nested\nFR10\n',
    '_bmad/bmm/config.yaml': 'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"\n',
  });
  const manifest = runAtlas(parent);
  const paths = manifest.files.map(f => f.path).sort();
  assert.deepStrictEqual(paths, ['_bmad-output/implementation-artifacts/nested.md'],
    `nested source must not produce a second/duplicate record, got: ${JSON.stringify(paths)}`);
});

test('two config keys pointing at the SAME external folder are deduped to ONE source', () => {
  // ext-shared must be a SIBLING of the project root for "{project-root}/../ext-shared"
  // to resolve to it — use a dedicated tracked tmpParent wrapping BOTH dirs
  // (never write the sibling directly into the shared OS temp root).
  const tmpParent = makeTempDir('external-dedup');
  const projectRoot = path.join(tmpParent, 'proj');
  writeFileTree(projectRoot, {
    '_bmad/bmm/config.yaml': [
      'planning_artifacts: "{project-root}/../ext-shared"',
      'knowledgebase_path: "{project-root}/../ext-shared"',
    ].join('\n') + '\n',
  });
  writeFileTree(path.join(tmpParent, 'ext-shared'), { 'shared.md': '# Shared\nFR11\n' });
  const manifest = runAtlas(projectRoot);
  const paths = manifest.files.map(f => f.path).sort();
  assert.deepStrictEqual(paths, ['ext-shared/shared.md'],
    `planning_artifacts == knowledgebase_path must be scanned exactly once, got: ${JSON.stringify(paths)}`);
});

test('external-source fileIds use <basename>/<relPath> — never absolute, never "../"', () => {
  for (const f of cfgManifest.files) {
    assert.ok(!path.isAbsolute(f.path), `fileId must not be absolute: ${f.path}`);
    assert.ok(!f.path.includes('..'), `fileId must not contain "..": ${f.path}`);
    assert.ok(!/^[A-Za-z]:/.test(f.path), `fileId must not contain a Windows drive letter: ${f.path}`);
  }
});

test('two external sources sharing a basename are disambiguated deterministically (-2 suffix)', () => {
  const parent = makeTempDir('collision');
  const projectRoot = path.join(parent, 'proj');
  writeFileTree(path.join(parent, 'group-a', 'shared-name'), { 'one.md': '# One\nFR20\n' });
  writeFileTree(path.join(parent, 'group-b', 'shared-name'), { 'two.md': '# Two\nFR21\n' });
  writeFileTree(projectRoot, {
    '_bmad/bmm/config.yaml': [
      'planning_artifacts: "{project-root}/../group-a/shared-name"',
      'implementation_artifacts: "{project-root}/../group-b/shared-name"',
    ].join('\n') + '\n',
  });
  const manifest = runAtlas(projectRoot);
  const paths = manifest.files.map(f => f.path).sort();
  assert.ok(paths.includes('shared-name/one.md'), `first (alphabetically-lowest absPath) source keeps the bare basename, got: ${JSON.stringify(paths)}`);
  assert.ok(paths.includes('shared-name-2/two.md'), `second source gets a deterministic -2 suffix, got: ${JSON.stringify(paths)}`);
});

test('MUST-FIX #2: internal prefix vs external basename collision keeps BOTH docs (none dropped)', () => {
  // Internal `implementation_artifacts: {project-root}/docs` (under-root prefix
  // "docs") and external `knowledgebase_path: {project-root}/../docs` (basename
  // "docs") collide. Before the fix, scanSources' dedup-by-fileId silently
  // dropped one same-named file. Both must now survive with distinct fileIds.
  const parent = makeTempDir('internal-external-collision');
  const projectRoot = path.join(parent, 'proj');
  writeFileTree(projectRoot, {
    'docs/internal.md': '# Internal doc\nFR40\n',
    '_bmad/bmm/config.yaml': [
      'implementation_artifacts: "{project-root}/docs"',
      'knowledgebase_path: "{project-root}/../docs"',
    ].join('\n') + '\n',
  });
  writeFileTree(path.join(parent, 'docs'), { 'external.md': '# External doc\nFR41\n' });

  const manifest = runAtlas(projectRoot);
  const paths = manifest.files.map(f => f.path).sort();
  // Both docs present, under DISTINCT prefixes (one keeps "docs", the other "docs-2").
  const internalPresent = paths.some(p => p.endsWith('/internal.md'));
  const externalPresent = paths.some(p => p.endsWith('/external.md'));
  assert.ok(internalPresent, `internal.md must be present, got: ${JSON.stringify(paths)}`);
  assert.ok(externalPresent, `external.md must be present (not silently dropped by fileId collision), got: ${JSON.stringify(paths)}`);
  // The two files must have DIFFERENT fileIds.
  const internalId = paths.find(p => p.endsWith('/internal.md'));
  const externalId = paths.find(p => p.endsWith('/external.md'));
  assert.notStrictEqual(internalId, externalId, 'the two same-basename sources must produce distinct fileId prefixes');
  // Both FRs must be extracted (proof both docs were actually scanned).
  const labels = manifest.nodes.map(n => n.label);
  assert.ok(labels.includes('FR40') && labels.includes('FR41'),
    `both FR40 (internal) and FR41 (external) must appear as nodes, got: ${JSON.stringify(labels)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOULD-FIX #3 — walkDir must skip VCS/dependency/IDE/dot dirs (the real
// Prophesee `.git` bug: `.git/HEAD`, `.git/hooks/*.sample` scanned as docs).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SHOULD-FIX #3: walkDir directory exclusions ---');

test('a source containing .git/ and node_modules/ scans real docs but NOT their contents', () => {
  const parent = makeTempDir('walkdir-exclusions');
  writeFileTree(parent, {
    '_bmad-output/planning-artifacts/prd.md': '# PRD\nFR50\n',
    '_bmad-output/.git/HEAD': 'ref: refs/heads/main\n',
    '_bmad-output/.git/hooks/pre-commit.sample': '#!/bin/sh\necho hi\n',
    '_bmad-output/node_modules/pkg/index.md': '# Should be ignored\nFR51\n',
    '_bmad-output/.vscode/settings.md': '# ide\nFR52\n',
    '_bmad-output/.hidden-dir/secret.md': '# hidden\nFR53\n',
  });
  const manifest = runAtlas(parent);
  const paths = manifest.files.map(f => f.path).sort();
  // The real doc is scanned.
  assert.ok(paths.includes('_bmad-output/planning-artifacts/prd.md'),
    `real doc must be scanned, got: ${JSON.stringify(paths)}`);
  // Nothing from the excluded dirs appears.
  const leaked = paths.filter(p =>
    p.includes('/.git/') || p.includes('/node_modules/') || p.includes('/.vscode/') || p.includes('/.hidden-dir/'));
  assert.strictEqual(leaked.length, 0, `no excluded-dir files may be scanned, leaked: ${JSON.stringify(leaked)}`);
  // And their entity tokens must NOT have leaked into the graph.
  const labels = manifest.nodes.map(n => n.label);
  for (const bad of ['FR51', 'FR52', 'FR53']) {
    assert.ok(!labels.includes(bad), `entity ${bad} from an excluded dir must not appear, got: ${JSON.stringify(labels)}`);
  }
  assert.ok(labels.includes('FR50'), 'the real doc\'s FR50 must still be extracted');
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — backward-compat hard gate: no-config fixtures produce IDENTICAL fileIds
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC3: backward-compat (no bmm config) ---');

test('rich-project (no bmm config) produces the SAME fileId set as before Story 29.7', () => {
  const tmp = makeTempDir('backcompat-rich');
  copyDirRecursive(RICH_FIXTURE, tmp);
  const manifest = runAtlas(tmp);
  const expected = [
    '_bmad-output/implementation-artifacts/1-1-oauth2-integration.md',
    '_bmad-output/implementation-artifacts/bug-null-pointer-on-export.md',
    '_bmad-output/implementation-artifacts/done/1-2-session-management.md',
    '_bmad-output/implementation-artifacts/epic-1-retrospective.md',
    '_bmad-output/implementation-artifacts/sprint-status.yaml',
    '_bmad-output/knowledge-graph.json',
    '_bmad-output/planning-artifacts/architecture.md',
    '_bmad-output/planning-artifacts/briefs/brief-auth-2026-01-15.md',
    '_bmad-output/planning-artifacts/epics.md',
    '_bmad-output/planning-artifacts/prd.md',
    '_bmad-output/project-context.md',
  ].sort();
  assert.deepStrictEqual(manifest.files.map(f => f.path).sort(), expected);
});

test('minimal-project (no bmm config) produces the SAME fileId set as before Story 29.7', () => {
  const tmp = makeTempDir('backcompat-minimal');
  copyDirRecursive(MINIMAL_FIXTURE, tmp);
  const manifest = runAtlas(tmp);
  const expected = [
    '_bmad-output/implementation-artifacts/1-1-hello-world.md',
    '_bmad-output/implementation-artifacts/sprint-status.yaml',
    '_bmad-output/planning-artifacts/prd.md',
  ].sort();
  assert.deepStrictEqual(manifest.files.map(f => f.path).sort(), expected);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — stale-output purge: removed source doc leaves no orphaned page
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC5: stale-output purge ---');

test('a doc removed since the last run leaves NO orphaned page after regeneration', () => {
  const tmp = makeTempDir('purge');
  copyDirRecursive(MINIMAL_FIXTURE, tmp);
  const siteDir = path.join(tmp, '_bmad-output', 'knowledge-site');

  const manifest1 = runAtlas(tmp);
  const docsBefore = collectFiles(path.join(siteDir, 'docs'));
  assert.strictEqual(docsBefore.length, manifest1.files.length,
    'first run: one doc page per manifest file, no extras');

  const storyRec = manifest1.files.find(f => f.path.endsWith('1-1-hello-world.md'));
  assert.ok(storyRec, 'baseline must include the story file');
  // Locate its rendered page by elimination (slug scheme is exercised elsewhere).
  const removedPage = docsBefore.find(p => p.includes('1-1-hello-world'));
  assert.ok(removedPage, `must find the story's rendered page among: ${JSON.stringify(docsBefore)}`);

  fs.unlinkSync(path.join(tmp, '_bmad-output', 'implementation-artifacts', '1-1-hello-world.md'));

  const manifest2 = runAtlas(tmp);
  assert.ok(!manifest2.files.find(f => f.path.endsWith('1-1-hello-world.md')),
    'removed file must not appear in manifest2');

  const docsAfter = collectFiles(path.join(siteDir, 'docs'));
  assert.strictEqual(docsAfter.length, manifest2.files.length,
    `after purge+regenerate, doc page count must match manifest file count exactly (no orphans), got ${docsAfter.length} pages vs ${manifest2.files.length} files`);
  assert.ok(!docsAfter.includes(removedPage),
    `the removed doc's page (${removedPage}) must be gone after regeneration, got: ${JSON.stringify(docsAfter)}`);
});

test('purge never touches source files (only the generated knowledge-site/ dir)', () => {
  const tmp = makeTempDir('purge-source-safety');
  copyDirRecursive(MINIMAL_FIXTURE, tmp);
  runAtlas(tmp);
  runAtlas(tmp); // second run purges + regenerates
  assert.ok(fs.existsSync(path.join(tmp, '_bmad-output', 'implementation-artifacts', '1-1-hello-world.md')),
    'source story file must survive a purge+regenerate cycle');
  assert.ok(fs.existsSync(path.join(tmp, '_bmad-output', 'planning-artifacts', 'prd.md')),
    'source prd.md must survive a purge+regenerate cycle');
});

test('MUST-FIX #1: a knowledge source configured AT output_folder/knowledge-site is NOT destroyed by the purge', () => {
  // A misconfigured project points knowledgebase_path at the very dir the Atlas
  // generates into. The purge (fs.rmSync outDir) would delete the user's data.
  // Guard: the source is dropped-with-warning (not scanned) AND the purge is
  // skipped, so the user's file survives across TWO generate runs.
  const parent = makeTempDir('source-at-outdir');
  const userDoc = path.join(parent, '_bmad-output', 'knowledge-site', 'user-notes.md');
  writeFileTree(parent, {
    '_bmad-output/planning-artifacts/prd.md': '# PRD\nFR60\n',
    '_bmad-output/knowledge-site/user-notes.md': '# Precious user notes\nFR61\n',
    '_bmad/bmm/config.yaml': 'knowledgebase_path: "{project-root}/_bmad-output/knowledge-site"\n',
  });

  const r1 = runAtlasRaw(parent);
  assert.strictEqual(r1.status, 0, `run 1 must exit 0, got ${r1.status}: ${r1.stderr}`);
  assert.ok(/overlaps the output dir|refusing to purge/.test(r1.stderr),
    `run 1 must warn about the overlapping source, stderr was: ${r1.stderr}`);
  assert.ok(fs.existsSync(userDoc), 'the user file at the output dir must SURVIVE run 1 (never purged/deleted)');

  const r2 = runAtlasRaw(parent);
  assert.strictEqual(r2.status, 0, `run 2 must exit 0, got ${r2.status}: ${r2.stderr}`);
  assert.ok(fs.existsSync(userDoc), 'the user file must still SURVIVE a second run (purge stays disabled while the overlap exists)');

  // And it was NOT scanned-then-rendered as a doc (it overlaps the generated dir).
  const manifest = JSON.parse(fs.readFileSync(path.join(parent, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8'));
  assert.ok(!manifest.files.some(f => f.path.includes('user-notes')),
    'the overlapping source must be skipped from scanning (not ingested as generated output)');
  assert.ok(manifest.files.some(f => f.path.endsWith('planning-artifacts/prd.md')),
    'the real (non-overlapping) doc must still be scanned');
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 — output honors output_folder (default _bmad-output)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- AC6: output_folder honored ---');

test('default output_folder (_bmad-output) is used when config has no output_folder key', () => {
  const parent = makeTempDir('default-output-folder');
  writeFileTree(parent, {
    '_bmad-output/doc.md': '# Doc\nFR30\n',
    '_bmad/bmm/config.yaml': 'planning_artifacts: "{project-root}/_bmad-output"\n',
  });
  const result = runAtlasRaw(parent);
  assert.strictEqual(result.status, 0, `must exit 0, got ${result.status}: ${result.stderr}`);
  assert.ok(fs.existsSync(path.join(parent, '_bmad-output', 'knowledge-site', 'index.html')),
    'output must land under the default _bmad-output/knowledge-site/');
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4/NFR62 — determinism: external-source fileIds are machine-independent
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Determinism: config-project from two different temp paths ---');

test('config-project generates byte-identical manifests from two different absolute temp paths', () => {
  const projectRootA = setupConfigProjectPair('det-a');
  const projectRootB = setupConfigProjectPair('det-b-deeper-nested-parent');

  runAtlas(projectRootA);
  runAtlas(projectRootB);

  const readStripped = (root) => {
    const raw = fs.readFileSync(path.join(root, '_bmad-output', 'knowledge-site', 'manifest.json'), 'utf-8');
    const m = JSON.parse(raw);
    delete m.projectRoot;
    delete m.bmadOutputDir;
    return JSON.stringify(m);
  };

  assert.strictEqual(readStripped(projectRootA), readStripped(projectRootB),
    'manifest.json (modulo path meta) must be byte-identical regardless of the absolute temp path depth/name');
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression (3.15.3): a PRD validation report must NOT win the def-site
// election for a requirement the PRD itself defines. `prd-validation-report.md`
// used to classify as 'prd' (basename contains "prd") and could become the
// canonical def-site, so an FR link in another doc pointed at the report instead
// of the PRD (real Prophesee bug: FR1/FR3/FR21 → prd-validation-report.html).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Regression: PRD wins def-site over prd-validation-report ---');

test('FR defined in prd.md anchors in the PRD, not in prd-validation-report.md', () => {
  const projectRoot = makeTempDir('prd-vs-report');
  writeFileTree(projectRoot, {
    '_bmad-output/planning-artifacts/planning/prd.md':
      '# Product Requirements\n\n## Functional Requirements\n\n' +
      '- **FR1:** Users can view a 2D map with base layers.\n' +
      '- **FR2:** Users can pan and zoom the map.\n',
    '_bmad-output/planning-artifacts/planning/prd-validation-report.md':
      '# PRD Validation Report\n\n| Req | Area | Score |\n| --- | --- | --- |\n' +
      '| FR1 | Map | 5 |\n| FR2 | Map | 4 |\n',
    '_bmad-output/planning-artifacts/planning/architecture.md':
      '# Architecture\n\nThe map component implements FR1 and FR2.\n',
  });
  runAtlas(projectRoot);

  const docsDir = path.join(projectRoot, '_bmad-output', 'knowledge-site', 'docs');
  const docFiles = fs.readdirSync(docsDir);
  const prdFile = docFiles.find(f => /prd\.html$/.test(f) && !/validation|report/.test(f));
  assert.ok(prdFile, `PRD doc page must exist; got: ${JSON.stringify(docFiles)}`);
  const prdHtml = fs.readFileSync(path.join(docsDir, prdFile), 'utf-8');
  assert.ok(prdHtml.includes('id="fr1"'), 'PRD page must carry the fr1 anchor (it defines FR1)');

  const archFile = docFiles.find(f => /architecture\.html$/.test(f));
  assert.ok(archFile, 'architecture doc page must exist');
  const archHtml = fs.readFileSync(path.join(docsDir, archFile), 'utf-8');
  const fr1Hrefs = extractHrefs(archHtml).filter(h => /#fr1"?$/.test(h) || /#fr1$/.test(h));
  assert.ok(fr1Hrefs.length > 0, `architecture must link FR1; hrefs: ${JSON.stringify(extractHrefs(archHtml))}`);
  assert.ok(fr1Hrefs.some(h => h.includes('prd.html#fr1')),
    `FR1 link must target the PRD; got: ${JSON.stringify(fr1Hrefs)}`);
  assert.ok(!fr1Hrefs.some(h => h.includes('validation-report')),
    `FR1 link must NOT target the validation report; got: ${JSON.stringify(fr1Hrefs)}`);
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
