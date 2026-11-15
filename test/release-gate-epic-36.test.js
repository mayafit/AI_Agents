#!/usr/bin/env node
/**
 * Story 36.6 — the Epic 36 release gate (AC5, AC8; FR280, FR282, FR298, FR301,
 * FR302, FR303, FR304; NFR84; Decisions P5-11.5 / P5-11.6).
 *
 * The executable half of the 4.x gate record
 * (`_bmad-output/implementation-artifacts/epic-runs/epic-36/36-6-release-gate.md`).
 * Each invariant of Epic 36 is asserted against an authority OUTSIDE the code
 * that produced it, never against a value restated here:
 *
 *   AC5.1  core commit — `package.json` `bmadRef.core` = the bundle manifest's
 *          `bmadRef.core` = the commit `git rev-parse HEAD` returned inside the
 *          build (`resolvedCommit`, 36.3); the `bmad-method/` tree hash recomputed
 *          here from disk equals the manifest; the bundled upstream template that
 *          36.5 pins by git blob is byte-identical to the 36.5 fixture copy (two
 *          independent fetches of the same commit agree).
 *   AC5.2  Skills CLI — `bmadRef.skillsCli` = the version inside the packed
 *          tarball (`bundle/skills-cli/package.json`) = what its bin prints with
 *          `--version` = the manifest record (36.3).
 *   AC5.3  Node floor — `engines.node` is not looser than the floor the bundled
 *          Skills CLI declares (read from its package.json, recorded in the
 *          manifest), and the 4.x CI jobs run Node at or above it: the Linux
 *          chain job, the offline-runtime job and the digest-pinned
 *          `OFFLINE_NODE_IMAGE` (FR298, 36.1 change set).
 *   AC5.4  wheelhouse — every PEP 723 dependency declared by a script anywhere in
 *          the bundled snapshot (every bundled module, read here with this file's
 *          own parser) has a wheel for every platform of the wheelhouse manifest,
 *          and the manifest was built from `bmadRef.core` (36.2).
 *   AC5.5  chain — 36.2-36.5's tests and this file are in the `npm test` chain;
 *          the Linux job runs the chain from package.json file by file and gates
 *          on `test/known-failures-linux.json`, whose every entry names an
 *          existing bug record and a chain file.
 *   AC8    CHANGELOG "Unreleased (4.x)" and README "Known limitations of the 4.x
 *          line" name the same items, and the note states the facts package.json
 *          holds (core commit, Node floor).
 *
 * Prerequisites (missing -> FAIL with a prerequisite message; never skipped):
 *   - the bundle: `ma-agents bundle build` (bundle/manifest.json), or MA_BUNDLE_DIR;
 *   - the wheelhouse manifest for the snapshot:
 *       uv run scripts/build-wheelhouse.py --snapshot bundle/bmad-method \
 *         --snapshot-commit <bmadRef.core> --out bundle/runtime
 *     (bundle/runtime/wheelhouse/wheelhouse-manifest.json), or MA_WHEELHOUSE_MANIFEST.
 * `.github/workflows/test-linux.yml` builds both before the chain runs.
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const BUNDLE = path.resolve(process.env.MA_BUNDLE_DIR || path.join(ROOT, 'bundle'));
const WHEELHOUSE_MANIFEST = path.resolve(process.env.MA_WHEELHOUSE_MANIFEST
  || path.join(BUNDLE, 'runtime', 'wheelhouse', 'wheelhouse-manifest.json'));

let passed = 0;
let failed = 0;
const errors = [];

let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(`\n  FATAL: release-gate-epic-36 exited with code ${code} without printing its summary.`);
  process.exitCode = code === 0 ? 1 : code;
});

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const gitBlob = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function walkFiles(root) {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else out.push(r);
    }
  })(root, '');
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** `>=X.Y.Z` -> [X, Y, Z]; anything else is not a floor this gate can compare. */
function floorOf(range, what) {
  const m = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(String(range || '').trim());
  assert.ok(m, `${what} ${JSON.stringify(range)} is not a ">=X.Y.Z" floor`);
  return m.slice(1).map(Number);
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  return 0;
}

// ─── prerequisites ───────────────────────────────────────────────────────────
console.log('\nStory 36.6: Epic 36 release gate\n');
console.log('Prerequisites (fail, never skip)');

const MANIFEST_FILE = path.join(BUNDLE, 'manifest.json');
const haveBundle = fs.existsSync(MANIFEST_FILE);
const haveWheelhouse = fs.existsSync(WHEELHOUSE_MANIFEST);
test('the bundle is on disk', () => {
  assert.ok(haveBundle, `prerequisite: no ${MANIFEST_FILE}; run \`node bin/cli.js bundle build\` (or set MA_BUNDLE_DIR)`);
});
test('the wheelhouse manifest for the snapshot is on disk', () => {
  assert.ok(haveWheelhouse, `prerequisite: no ${WHEELHOUSE_MANIFEST}; run \`uv run scripts/build-wheelhouse.py --snapshot `
    + `bundle/bmad-method --snapshot-commit ${pkg.bmadRef && pkg.bmadRef.core} --out bundle/runtime\` (or set MA_WHEELHOUSE_MANIFEST)`);
});

const manifest = haveBundle ? readJson(MANIFEST_FILE) : null;
const item = (name) => manifest && (manifest.items || []).find((i) => i.name === name);

// ─── AC5.1 core commit ───────────────────────────────────────────────────────
console.log('\nAC5.1 core commit (FR280, FR302)');

test('bmadRef.core is a full commit and equals the manifest record and the commit the build checked out', () => {
  assert.ok(manifest, 'no bundle manifest');
  const core = pkg.bmadRef && pkg.bmadRef.core;
  assert.ok(/^[0-9a-f]{40}$/.test(core || ''), `package.json bmadRef.core ${JSON.stringify(core)} is not a full commit`);
  assert.strictEqual(manifest.bmadRef.core, core, 'manifest bmadRef.core differs from package.json (rebuild the bundle)');
  const bm = item('bmad-method');
  assert.ok(bm, 'manifest has no bmad-method item');
  assert.strictEqual(bm.requestedRef, core, 'bmad-method requestedRef');
  assert.strictEqual(bm.resolvedCommit, core, 'bmad-method resolvedCommit (git rev-parse HEAD inside the build)');
});

test('the bmad-method tree on disk hashes to the manifest (recomputed here)', () => {
  const bm = item('bmad-method');
  assert.ok(bm, 'manifest has no bmad-method item');
  const root = path.join(BUNDLE, 'bmad-method');
  const lines = walkFiles(root).map((rel) => `${sha256(fs.readFileSync(path.join(root, ...rel.split('/'))))}  ${rel}\n`);
  assert.strictEqual(lines.length, bm.fileCount, 'file count');
  assert.strictEqual(sha256(lines.join('')), bm.treeSha256, 'tree hash');
});

test('the bundled bmad-project-context template is the one 36.5 pinned (independent fetch agrees)', () => {
  const rel = ['skills', 'bmad-project-context', 'references', 'template.md'];
  const bundled = fs.readFileSync(path.join(BUNDLE, 'bmad-method', ...rel));
  // The fixture's blob as git stores it (the working-tree copy may carry CRLF
  // from core.autocrlf; the bundle holds the committed upstream bytes).
  const fixtureRel = 'test/fixtures/instruction-file-coexistence/bmad-project-context-template.md';
  const r = spawnSync('git', ['ls-files', '-s', '--', fixtureRel], { cwd: ROOT, encoding: 'utf8' });
  const indexed = /^\d+ ([0-9a-f]{40}) /.exec(r.stdout || '');
  assert.ok(indexed, `git does not track ${fixtureRel}: ${r.stderr || r.stdout}`);
  assert.strictEqual(gitBlob(bundled), indexed[1],
    'bundle/bmad-method template.md differs from the 36.5 fixture copied from the pinned commit');
});

test('the wheelhouse manifest was built from bmadRef.core', () => {
  assert.ok(haveWheelhouse, 'no wheelhouse manifest');
  const wm = readJson(WHEELHOUSE_MANIFEST);
  assert.strictEqual(wm.snapshot && wm.snapshot.commit, pkg.bmadRef.core);
});

// ─── AC5.2 Skills CLI ────────────────────────────────────────────────────────
console.log('\nAC5.2 Skills CLI (FR302, FR283)');

const cliDir = path.join(BUNDLE, 'skills-cli');
const cliPkgFile = path.join(cliDir, 'package.json');
const cliPkg = fs.existsSync(cliPkgFile) ? readJson(cliPkgFile) : null;

test('bmadRef.skillsCli = the packed tarball\'s package.json version = the manifest record', () => {
  assert.ok(cliPkg, `no ${cliPkgFile}`);
  assert.strictEqual(cliPkg.name, 'skills');
  assert.strictEqual(cliPkg.version, pkg.bmadRef.skillsCli);
  assert.strictEqual(manifest.skillsCli.version, pkg.bmadRef.skillsCli);
  assert.strictEqual(item('skills-cli').requestedRef, pkg.bmadRef.skillsCli);
  assert.ok(/^sha512-/.test(item('skills-cli').resolvedIntegrity || ''), 'the tarball integrity is recorded');
});

test('the bundled Skills CLI runs and prints bmadRef.skillsCli', () => {
  assert.ok(cliPkg, `no ${cliPkgFile}`);
  const bin = typeof cliPkg.bin === 'string' ? cliPkg.bin : cliPkg.bin[cliPkg.name];
  const r = spawnSync(process.execPath, [path.join(cliDir, bin), '--version'], {
    encoding: 'utf8', env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), pkg.bmadRef.skillsCli);
});

// ─── AC5.3 Node floor ────────────────────────────────────────────────────────
console.log('\nAC5.3 Node floor (FR298)');

const workflowsDir = path.join(ROOT, '.github', 'workflows');
const loadWorkflow = (f) => yaml.load(fs.readFileSync(path.join(workflowsDir, f), 'utf8'));

test('engines.node is not looser than the floor the bundled Skills CLI declares', () => {
  assert.ok(cliPkg, `no ${cliPkgFile}`);
  const cliFloor = floorOf(cliPkg.engines && cliPkg.engines.node, 'bundle/skills-cli engines.node');
  assert.strictEqual(manifest.skillsCli.enginesNode, cliPkg.engines.node, 'manifest records the Skills CLI floor');
  const ours = floorOf(pkg.engines && pkg.engines.node, 'package.json engines.node');
  assert.ok(cmp(ours, cliFloor) >= 0, `engines.node >=${ours.join('.')} admits Node below the Skills CLI floor >=${cliFloor.join('.')}`);
});

/** Every `actions/setup-node` node-version in a job, as [major, minor?, patch?]. */
function setupNodeVersions(job) {
  return (job.steps || [])
    .filter((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node@'))
    .map((s) => String(s.with && s.with['node-version']).split('.').map(Number));
}

/** A floor-check of a CI Node version: a bare major must clear the floor's major and float to its latest. */
function clears(version, floor) {
  if (version.length === 1) return version[0] > floor[0] || (version[0] === floor[0]);
  return cmp(version, floor) >= 0;
}

test('the 4.x CI jobs set up Node at or above engines.node', () => {
  const floor = floorOf(pkg.engines.node, 'package.json engines.node');
  const jobs = [['test-linux.yml', 'test-linux'], ['offline-install.yml', 'offline-runtime']];
  for (const [file, id] of jobs) {
    const job = loadWorkflow(file).jobs[id];
    assert.ok(job, `${file} has no job ${id}`);
    const versions = setupNodeVersions(job);
    assert.ok(versions.length > 0, `${file} ${id} does not set up Node`);
    for (const v of versions) assert.ok(clears(v, floor), `${file} ${id} sets up Node ${v.join('.')}, below >=${floor.join('.')}`);
  }
});

test('every OFFLINE_NODE_IMAGE is a Node >= floor-major image pinned by digest', () => {
  const floor = floorOf(pkg.engines.node, 'package.json engines.node');
  const wf = loadWorkflow('offline-install.yml');
  const images = [];
  if (wf.env && wf.env.OFFLINE_NODE_IMAGE) images.push(['(workflow)', wf.env.OFFLINE_NODE_IMAGE]);
  for (const [id, job] of Object.entries(wf.jobs)) if (job.env && job.env.OFFLINE_NODE_IMAGE) images.push([id, job.env.OFFLINE_NODE_IMAGE]);
  assert.ok(images.some(([id]) => id === 'offline-runtime'), 'the offline-runtime job names its OFFLINE_NODE_IMAGE');
  for (const [id, image] of images) {
    const m = /^node:(\d+)(?:\.(\d+))?(?:\.(\d+))?-bookworm@sha256:[0-9a-f]{64}$/.exec(image);
    assert.ok(m, `${id}: OFFLINE_NODE_IMAGE ${image} is not node:<version>-bookworm@sha256:<digest>`);
    const v = [m[1], m[2], m[3]].filter((x) => x !== undefined).map(Number);
    assert.ok(clears(v, floor), `${id}: OFFLINE_NODE_IMAGE Node ${v.join('.')} is below >=${floor.join('.')}`);
  }
});

// ─── AC5.4 wheelhouse covers the snapshot ────────────────────────────────────
console.log('\nAC5.4 wheelhouse coverage (FR282)');

const normalize = (n) => n.replace(/[-_.]+/g, '-').toLowerCase();

/** PEP 723 `dependencies` of a script (this file's own reader; null when no block). */
function pep723Dependencies(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.indexOf('# /// script');
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.trimEnd() === '# ///');
  assert.ok(end > start, 'unterminated PEP 723 block');
  const body = lines.slice(start + 1, end).map((l) => l.replace(/^# ?/, '')).join('\n');
  const m = /^dependencies\s*=\s*\[([\s\S]*?)\]\s*$/m.exec(body);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] !== undefined ? x[1] : x[2]);
}

test('every PEP 723 dependency of every bundled module has a wheel for every wheelhouse platform', () => {
  assert.ok(manifest && haveWheelhouse, 'prerequisites missing');
  const declared = new Map(); // normalized name -> [script, ...]
  let scripts = 0;
  for (const mod of manifest.modules) {
    const skills = path.join(BUNDLE, mod, 'skills');
    for (const rel of walkFiles(skills)) {
      const segs = rel.split('/');
      if (!rel.endsWith('.py') || !segs.slice(0, -1).includes('scripts') || segs.includes('tests')) continue;
      scripts++;
      const deps = pep723Dependencies(fs.readFileSync(path.join(skills, ...segs), 'utf8')) || [];
      for (const d of deps) {
        const name = normalize(/^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(d)[1]);
        declared.set(name, [...(declared.get(name) || []), `${mod}/skills/${rel}`]);
      }
    }
  }
  assert.ok(scripts > 0, 'no scripts found in the bundle');
  assert.ok(declared.size > 0, 'no PEP 723 dependency found: the reader is broken or the snapshot is empty');
  const wm = readJson(WHEELHOUSE_MANIFEST);
  const platforms = Object.keys(wm.platforms || {});
  assert.deepStrictEqual(platforms.sort(), ['linux-x64', 'win-x64'], 'wheelhouse platforms (FR282: linux-x64 and win-x64)');
  const missing = [];
  for (const p of platforms) {
    const have = new Set((wm.platforms[p].wheels || []).map((w) => normalize(w.name)));
    for (const [name, where] of declared) if (!have.has(name)) missing.push(`${p}: ${name} (declared by ${where.join(', ')})`);
  }
  assert.deepStrictEqual(missing, [], 'dependencies without a wheel');
  console.log(`      ${scripts} scripts, dependencies: ${[...declared.keys()].sort().join(', ')}`);
});

// ─── AC5.5 chain ─────────────────────────────────────────────────────────────
console.log('\nAC5.5 the npm test chain and the Linux gate (AC3)');

const chain = String(pkg.scripts.test).split('&&').map((s) => s.trim());

test('36.2-36.5\'s tests and this gate are in the npm test chain, and every chain file exists', () => {
  const files = chain.map((c) => {
    const m = /^node (test\/[A-Za-z0-9._-]+\.js)$/.exec(c);
    assert.ok(m, `chain element is not "node test/<file>.js": ${c}`);
    return m[1];
  });
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is in the chain but does not exist`);
  for (const f of ['test/wheelhouse-coverage.test.js', 'test/bmad-ref-record.test.js', 'test/bundle-snapshot.test.js',
    'test/uv-transition-resilience.test.js', 'test/customize-contract-v7.test.js', 'test/instruction-file-coexistence.test.js',
    'test/release-gate-epic-36.test.js']) {
    assert.ok(files.includes(f), `${f} is not in the npm test chain`);
  }
  assert.strictEqual(new Set(files).size, files.length, 'a file appears twice in the chain');
});

test('the Linux job builds the bundle, installs uv + Python 3.11 and runs the chain file by file against the allowlist', () => {
  const job = loadWorkflow('test-linux.yml').jobs['test-linux'];
  const runs = (job.steps || []).map((s) => String(s.run || '')).join('\n');
  const uses = (job.steps || []).map((s) => String(s.uses || ''));
  assert.ok(uses.some((u) => /^astral-sh\/setup-uv@v\d+\.\d+\.\d+$/.test(u)), 'astral-sh/setup-uv pinned to an exact tag');
  assert.match(runs, /uv python install 3\.11/);
  assert.match(runs, /npm ci [^\n]*--ignore-scripts/);
  assert.match(runs, /node bin\/cli\.js bundle build/);
  assert.match(runs, /run-test-chain\.js[\s\S]*--allowlist test\/known-failures-linux\.json/);
  for (const f of ['customize-contract-v7', 'instruction-file-coexistence']) {
    assert.match(runs, new RegExp(`--require-pass test/${f}\\.test\\.js`), `${f} must be required to pass`);
  }
  const on = loadWorkflow('test-linux.yml').on || loadWorkflow('test-linux.yml')[true];
  assert.ok(on && 'pull_request' in on, 'runs on pull requests');
  assert.ok(on.push && (on.push.branches || []).includes('main'), 'runs on pushes to main');
});

test('every known-failure entry names a chain file and an existing bug record', () => {
  const allow = readJson(path.join(__dirname, 'known-failures-linux.json'));
  assert.ok(allow.failures && typeof allow.failures === 'object', 'expected { "failures": { file: bug-key } }');
  const files = chain.map((c) => c.replace(/^node /, ''));
  for (const [file, key] of Object.entries(allow.failures)) {
    assert.ok(files.includes(file), `${file} is allowlisted but not in the chain`);
    assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(key), `${file}: ${JSON.stringify(key)} is not a bug key`);
    const rec = ['', 'done'].map((d) => path.join(ROOT, '_bmad-output', 'implementation-artifacts', d, `${key}.md`));
    assert.ok(rec.some((r) => fs.existsSync(r)), `${file}: no bug record for ${key}`);
  }
  for (const f of ['test/customize-contract-v7.test.js', 'test/instruction-file-coexistence.test.js', 'test/release-gate-epic-36.test.js']) {
    assert.ok(!(f in allow.failures), `${f} may not be allowlisted`);
  }
});

// ─── AC8 CHANGELOG / README parity ───────────────────────────────────────────
console.log('\nAC8 Unreleased (4.x) note and Known limitations parity');

/** The text under the first heading line matching `re`, up to the next heading of the same or higher level. */
function section(text, re) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const at = lines.findIndex((l) => re.test(l));
  if (at < 0) return null;
  const level = /^(#+)/.exec(lines[at])[1].length;
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    const h = /^(#+)\s/.exec(lines[i]);
    if (h && h[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** Top-level `- ` items of a markdown list, continuation lines joined, whitespace normalised. */
function listItems(text) {
  const items = [];
  for (const line of text.split('\n')) {
    if (/^- /.test(line)) items.push(line.slice(2));
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
    else if (/^#/.test(line)) break;
  }
  return items.map((i) => i.replace(/\s+/g, ' ').trim());
}

const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const unreleased = section(changelog, /^## Unreleased \(4\.x\)\s*$/);

test('CHANGELOG has an "Unreleased (4.x)" section stating the commit, the support line, the floor and the runtime', () => {
  assert.ok(unreleased, 'no "## Unreleased (4.x)" section');
  assert.ok(unreleased.includes(pkg.bmadRef.core), 'names bmadRef.core from package.json');
  assert.ok(unreleased.includes(`Node.js ${pkg.engines.node.replace(/^>=\s*/, '≥ ')}`), `states the floor engines.node (${pkg.engines.node})`);
  assert.match(unreleased, /3\.x line is the supported on-prem release/);
  assert.match(unreleased, /dist-tag `next`/);
  assert.match(unreleased, /docs\/on-prem-runtime\.md/);
  assert.ok(fs.existsSync(path.join(ROOT, 'docs', 'on-prem-runtime.md')), 'docs/on-prem-runtime.md exists');
});

test('CHANGELOG and README Known limitations name the same items', () => {
  const cl = section(unreleased || '', /^### Known limitations\s*$/);
  const rm = section(readme, /^### Known limitations of the 4\.x line\s*$/);
  assert.ok(cl, 'CHANGELOG Unreleased (4.x) has no "### Known limitations"');
  assert.ok(rm, 'README has no "### Known limitations of the 4.x line"');
  const a = listItems(cl);
  const b = listItems(rm);
  assert.ok(a.length > 0, 'the CHANGELOG list is empty');
  assert.deepStrictEqual(b, a, 'README and CHANGELOG known limitations differ');
  const all = a.join('\n');
  assert.match(all, /CLAUDE\.md/, 'names the 36.5 AC9 adopt finding');
  assert.match(all, /\bcis\b/, 'names the 36.1 AC12 FALLBACK (cis)');
});

// ─────────────────────────────────────────────────────────────────────────────
summaryPrinted = true;
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length) {
  console.log('\nFailures:');
  for (const { name, error } of errors) console.log(`  ${name}:\n    ${error}`);
}
process.exit(failed > 0 ? 1 : 0);
