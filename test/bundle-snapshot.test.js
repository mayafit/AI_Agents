#!/usr/bin/env node
/**
 * Story 36.3 (FR280, FR283, FR299, FR302; Decisions P5-11.2/.5/.10) — the
 * `bundle build` snapshot, verified from outside the builder.
 *
 * The hashes are recomputed here with this file's own code (not lib/bundle.js),
 * so a builder that records the wrong thing cannot also certify it.
 *
 *   AC2  fetch by exact commit / exact tag against local repositories: HEAD is
 *        the requested commit (a fetch of the default branch is caught), the tag
 *        describes exactly, branch names are refused; the Skills CLI check
 *        fails on a tree without its runtime dependencies.
 *   AC3  manifest contents on a fixture: per-item source, requested and resolved
 *        ref, file count, tree hash, per-file SHA-256; omitted module recorded and
 *        absent from `modules`; `bmod-method` version and the `bmad`
 *        required_skills source read from the snapshot (a moved folder moves it).
 *   AC4  two manifests written from the same inputs into different folders are
 *        byte-identical, with no timestamp and no absolute path.
 *   AC5  fixture manifest + tree on every run (golden: test/fixtures/bundle/
 *        manifest.json); the real `bundle/` when present (else skipped with the
 *        reason): core commit = package.json bmadRef.core, the required v7
 *        scripts exist, every tree hash and file SHA-256 recomputed from disk
 *        equals the manifest, and the Skills CLI prints its version.
 *
 * `node test/bundle-snapshot.test.js --write-fixture` regenerates the golden.
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const bundle = require('../lib/bundle');

const projectRoot = path.resolve(__dirname, '..');
const GOLDEN = path.join(__dirname, 'fixtures', 'bundle', 'manifest.json');
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];
const cleanup = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

function skip(name, reason) {
  console.log(`  - SKIP ${name}: ${reason}`);
  skipped++;
}

function tmpDir(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `bundle-snap-${tag}-`));
  cleanup.push(d);
  return d;
}

function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

// ─── independent hashing (the outside authority) ─────────────────────────────

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function filesOnDisk(root) {
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

function recomputeTree(root) {
  const files = filesOnDisk(root).map((rel) => ({ path: rel, sha256: sha256(fs.readFileSync(path.join(root, ...rel.split('/')))) }));
  return { files, treeSha256: sha256(files.map((f) => `${f.sha256}  ${f.path}\n`).join('')) };
}

const REQUIRED_SCRIPTS = [
  ...['render_skill', 'resolve_config', 'resolve_customization', 'setup', 'validate_manifests', 'migrate_v6']
    .map((s) => `skills/bmad/scripts/${s}.py`),
  'skills/bmad-agent-po/scripts/tickets.py',
];

/** Problems with a bundle folder against the expected core commit; empty when it verifies. */
function verifyBundle(dir, expectedCore, { requiredScripts = REQUIRED_SCRIPTS } = {}) {
  const problems = [];
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return [`no manifest.json in ${dir}`];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const core = (manifest.items || []).find((i) => i.name === 'bmad-method');
  if (manifest.bmadRef.core !== expectedCore) problems.push(`manifest bmadRef.core ${manifest.bmadRef.core} != ${expectedCore}`);
  if (!core || core.resolvedCommit !== expectedCore) problems.push(`bmad-method resolvedCommit ${core && core.resolvedCommit} != ${expectedCore}`);
  for (const s of requiredScripts) {
    if (!fs.existsSync(path.join(dir, 'bmad-method', ...s.split('/')))) problems.push(`missing bmad-method/${s}`);
  }
  for (const item of manifest.items || []) {
    const root = path.join(dir, item.path);
    if (!fs.existsSync(root)) { problems.push(`${item.name}: ${item.path}/ missing`); continue; }
    const disk = recomputeTree(root);
    if (disk.treeSha256 !== item.treeSha256) problems.push(`${item.name}: tree hash on disk ${disk.treeSha256} != manifest ${item.treeSha256}`);
    if (disk.files.length !== item.fileCount) problems.push(`${item.name}: ${disk.files.length} files on disk, manifest says ${item.fileCount}`);
    const listed = new Map((item.files || []).map((f) => [f.path, f.sha256]));
    for (const f of disk.files) {
      if (!listed.has(f.path)) problems.push(`${item.name}: ${f.path} on disk is not in the manifest`);
      else if (listed.get(f.path) !== f.sha256) problems.push(`${item.name}: ${f.path} sha256 differs from the manifest`);
    }
    const onDisk = new Set(disk.files.map((f) => f.path));
    for (const p of listed.keys()) if (!onDisk.has(p)) problems.push(`${item.name}: ${p} listed but missing on disk`);
  }
  const cli = (manifest.items || []).find((i) => i.name === 'skills-cli');
  if (!cli) problems.push('no skills-cli item');
  else if (manifest.skillsCli.treeSha256 !== cli.treeSha256) problems.push('skillsCli.treeSha256 differs from the skills-cli item');
  return problems;
}

// ─── fixture snapshot ────────────────────────────────────────────────────────

const FIXTURE_REF = Object.freeze({
  core: '1111111111111111111111111111111111111111',
  skillsCli: '1.2.3',
  tea: 'v4.0.1',
  cis: '',
  extensions: '',
});
const FIXTURE_RESOLVED = Object.freeze({ core: FIXTURE_REF.core, tea: '2222222222222222222222222222222222222222', skillsCli: 'sha512-fixture' });

const FIXTURE_CLI_BIN = [
  "import { readFileSync } from 'node:fs';",
  "import { dep } from 'fixture-dep';",
  "if (process.argv[2] === '--version') console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version + dep);",
  '',
].join('\n');

function fixtureFiles({ bmadFolder = 'skills' } = {}) {
  const core = {};
  for (const s of REQUIRED_SCRIPTS) core[`bmad-method/${s.replace(/^skills\//, `${bmadFolder}/`)}`] = `# ${s}\nprint("fixture")\n`;
  core[`bmad-method/${bmadFolder}/bmad/SKILL.md`] = '---\nname: bmad\n---\n';
  core['bmad-method/skills/bmod-method/bmod.toml'] = '[bmod]\ncode = "method"\nversion = "6.13.0-next"\nskills = [\n  "bmad-build",\n]\n\n[other]\nversion = "9"\n';
  return {
    ...core,
    'tea/skills/bmod-tea/bmod.toml': '[bmod]\ncode = "tea"\nversion = "4.0.1"\n',
    'tea/skills/bmad-tea/SKILL.md': '---\nname: bmad-tea\n---\n',
    'skills-cli/package.json': `${JSON.stringify({ name: 'skills', version: FIXTURE_REF.skillsCli, type: 'module', bin: { skills: './bin/cli.mjs' }, engines: { node: '>=22.20.0' }, dependencies: { 'fixture-dep': '1.0.0' } }, null, 2)}\n`,
    'skills-cli/bin/cli.mjs': FIXTURE_CLI_BIN,
    'skills-cli/node_modules/fixture-dep/package.json': '{ "name": "fixture-dep", "version": "1.0.0", "type": "module", "main": "index.js" }\n',
    'skills-cli/node_modules/fixture-dep/index.js': "export const dep = '';\n",
  };
}

function buildFixture(dir, opts) {
  writeFiles(dir, fixtureFiles(opts));
  return bundle.writeManifest(dir, {
    bmadRef: FIXTURE_REF,
    repositories: { core: bundle.UPSTREAM.core.repository, tea: bundle.UPSTREAM.tea.repository, cis: bundle.UPSTREAM.cis.repository },
    resolved: FIXTURE_RESOLVED,
  });
}

if (process.argv.includes('--write-fixture')) {
  const d = tmpDir('golden');
  const { text } = buildFixture(d);
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, text);
  console.log(`wrote ${GOLDEN}`);
  for (const c of cleanup) bundle.removeTree(c);
  process.exit(0);
}

console.log('\nStory 36.3: bundle build snapshot (FR280, FR283, FR299, FR302)\n');

// ─── AC5 (fixture) + AC3 ─────────────────────────────────────────────────────
console.log('AC3 / AC5: fixture manifest and tree');

const fixtureDir = tmpDir('fixture');
const fixture = buildFixture(fixtureDir);
const fm = fixture.manifest;

test('the builder\'s manifest for the fixture tree equals the committed golden fixture manifest', () => {
  assert.deepStrictEqual(JSON.parse(fixture.text), JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
});

test('fixture: every tree hash and file SHA-256 recomputed from disk equals the manifest', () => {
  assert.deepStrictEqual(verifyBundle(fixtureDir, FIXTURE_REF.core), []);
});

test('fixture: a snapshot checked against a different commit fails', () => {
  const problems = verifyBundle(fixtureDir, FIXTURE_REF.core.replace(/1$/, '2'));
  assert.ok(problems.some((p) => p.includes('bmadRef.core')), problems.join('\n'));
});

test('fixture: a changed, an added and a removed file each fail verification', () => {
  const d = tmpDir('tamper');
  writeFiles(d, fixtureFiles());
  fs.copyFileSync(path.join(fixtureDir, 'manifest.json'), path.join(d, 'manifest.json'));
  fs.appendFileSync(path.join(d, 'bmad-method', 'skills', 'bmad', 'SKILL.md'), 'x');
  fs.writeFileSync(path.join(d, 'tea', 'skills', 'stray.md'), 'stray');
  fs.rmSync(path.join(d, 'skills-cli', 'bin', 'cli.mjs'));
  const problems = verifyBundle(d, FIXTURE_REF.core).join('\n');
  assert.match(problems, /bmad-method: skills\/bmad\/SKILL\.md sha256 differs/);
  assert.match(problems, /tea: skills\/stray\.md on disk is not in the manifest/);
  assert.match(problems, /skills-cli: bin\/cli\.mjs listed but missing on disk/);
});

test('fixture: a missing required v7 script fails verification', () => {
  const d = tmpDir('noscript');
  writeFiles(d, fixtureFiles());
  fs.copyFileSync(path.join(fixtureDir, 'manifest.json'), path.join(d, 'manifest.json'));
  fs.rmSync(path.join(d, 'bmad-method', 'skills', 'bmad-agent-po', 'scripts', 'tickets.py'));
  assert.ok(verifyBundle(d, FIXTURE_REF.core).includes('missing bmad-method/skills/bmad-agent-po/scripts/tickets.py'));
});

test('manifest items record source, requested and resolved ref, file count, tree hash and per-file SHA-256', () => {
  assert.deepStrictEqual(fm.items.map((i) => i.name), ['bmad-method', 'tea', 'skills-cli']);
  const core = fm.items[0];
  assert.strictEqual(core.repository, 'https://github.com/bmad-code-org/BMAD-METHOD');
  assert.strictEqual(core.requestedRef, FIXTURE_REF.core);
  assert.strictEqual(core.resolvedCommit, FIXTURE_RESOLVED.core);
  assert.strictEqual(fm.items[1].requestedRef, 'v4.0.1');
  assert.strictEqual(fm.items[1].resolvedCommit, FIXTURE_RESOLVED.tea);
  for (const i of fm.items) {
    assert.ok(/^[0-9a-f]{64}$/.test(i.treeSha256), `${i.name} tree hash`);
    assert.strictEqual(i.files.length, i.fileCount);
    assert.ok(i.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)), `${i.name} file hashes`);
  }
  assert.deepStrictEqual(fm.repositories, {
    core: 'https://github.com/bmad-code-org/BMAD-METHOD',
    tea: 'https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise',
    cis: 'https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite',
  });
});

test('an empty tag omits the module: absent from `modules` and `items`, recorded in `omitted` with a reason', () => {
  assert.deepStrictEqual(fm.modules, ['bmad-method', 'tea']);
  assert.ok(!fm.items.some((i) => i.name === 'cis'));
  assert.strictEqual(fm.omitted.length, 1);
  assert.strictEqual(fm.omitted[0].name, 'cis');
  assert.match(fm.omitted[0].reason, /empty/);
});

test('bmod-method version, Skills CLI version / bin / engines / tree hash / dependencies are recorded', () => {
  assert.deepStrictEqual(fm.bmodMethod, { path: 'skills/bmod-method/bmod.toml', version: '6.13.0-next' });
  assert.strictEqual(fm.skillsCli.version, FIXTURE_REF.skillsCli);
  assert.strictEqual(fm.skillsCli.bin, 'bin/cli.mjs');
  assert.strictEqual(fm.skillsCli.enginesNode, '>=22.20.0');
  assert.deepStrictEqual(fm.skillsCli.dependencies, ['fixture-dep@1.0.0']);
  assert.strictEqual(fm.skillsCli.treeSha256, recomputeTree(path.join(fixtureDir, 'skills-cli')).treeSha256);
});

test('the bmad required_skills source is read from the snapshot, and moves when the folder moves', () => {
  assert.strictEqual(fm.bmadRequiredSkillsSource, 'github:bmad-code-org/BMAD-METHOD/skills');
  const d = tmpDir('moved');
  const moved = buildFixture(d, { bmadFolder: 'skills/core-tools' }).manifest;
  assert.strictEqual(moved.bmadRequiredSkillsSource, 'github:bmad-code-org/BMAD-METHOD/skills/core-tools');
  assert.strictEqual(moved.bmadSkill, 'bmad-method/skills/core-tools/bmad/SKILL.md');
});

// ─── AC4 ─────────────────────────────────────────────────────────────────────
console.log('\nAC4: determinism');

test('two manifests from the same inputs in different folders are byte-identical, with no timestamp or absolute path', () => {
  const a = tmpDir('detA');
  const b = tmpDir('detB');
  const ta = buildFixture(a).text;
  const until = Date.now() + 20;
  while (Date.now() < until) { /* let any clock-derived value move */ }
  const tb = buildFixture(b).text;
  assert.strictEqual(ta, tb);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(ta), 'manifest contains a timestamp');
  for (const d of [a, b, os.tmpdir()]) {
    assert.ok(!ta.includes(d) && !ta.includes(d.split(path.sep).join('/')), `manifest contains the path ${d}`);
  }
  assert.ok(!ta.includes(':\\\\') && !/"\/(tmp|home|Users)\//.test(ta), 'manifest contains an absolute path');
});

// ─── AC2 ─────────────────────────────────────────────────────────────────────
console.log('\nAC2: fetch by exact commit / exact tag; Skills CLI completeness');

function git(args, cwd) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

const upstreamRepo = tmpDir('upstream');
git(['init', '-q', '-b', 'main'], upstreamRepo);
writeFiles(upstreamRepo, { 'skills/bmad/SKILL.md': 'one\n', 'README.md': 'outside skills\n' });
git(['add', '-A'], upstreamRepo);
git(['commit', '-q', '-m', 'one'], upstreamRepo);
const sha1 = git(['rev-parse', 'HEAD'], upstreamRepo);
git(['tag', '-a', 'v1.0.0', '-m', 'v1.0.0'], upstreamRepo);
writeFiles(upstreamRepo, { 'skills/bmad/SKILL.md': 'two\n' });
git(['commit', '-q', '-am', 'two'], upstreamRepo);
const sha2 = git(['rev-parse', 'HEAD'], upstreamRepo);
git(['config', 'uploadpack.allowReachableSHA1InWant', 'true'], upstreamRepo);
const upstreamUrl = pathToFileURL(upstreamRepo).href;

test('fetchCommit checks out exactly the requested (non-tip) commit, limited to skills/', () => {
  const d = path.join(tmpDir('fc'), 'core');
  assert.notStrictEqual(sha1, sha2);
  assert.strictEqual(bundle.fetchCommit(upstreamUrl, sha1, d), sha1);
  assert.strictEqual(fs.readFileSync(path.join(d, 'skills', 'bmad', 'SKILL.md'), 'utf8'), 'one\n');
  assert.ok(!fs.existsSync(path.join(d, 'README.md')), 'checkout is limited to skills/');
});

test('fetchCommit refuses a branch name or a short sha (never fetches a branch head)', () => {
  assert.throws(() => bundle.fetchCommit(upstreamUrl, 'main', path.join(tmpDir('fcb'), 'x')), /not a full commit/);
  assert.throws(() => bundle.fetchCommit(upstreamUrl, sha1.slice(0, 7), path.join(tmpDir('fcs'), 'x')), /not a full commit/);
});

test('fetchTag checks out the tag and its commit; a branch name is refused', () => {
  const d = path.join(tmpDir('ft'), 'tea');
  assert.strictEqual(bundle.fetchTag(upstreamUrl, 'v1.0.0', d), sha1);
  assert.strictEqual(git(['describe', '--tags', '--exact-match', 'HEAD'], d), 'v1.0.0');
  assert.throws(() => bundle.fetchTag(upstreamUrl, 'main', path.join(tmpDir('ftb'), 'x')), /not a release tag/);
});

test('verifySkillsCli passes on a tree with its dependencies and fails on the bare package', () => {
  const d = tmpDir('cli');
  writeFiles(d, Object.fromEntries(Object.entries(fixtureFiles()).filter(([k]) => k.startsWith('skills-cli/'))));
  const cli = path.join(d, 'skills-cli');
  assert.strictEqual(bundle.verifySkillsCli(cli, FIXTURE_REF.skillsCli), 'bin/cli.mjs');
  bundle.removeTree(path.join(cli, 'node_modules'));
  assert.throws(() => bundle.verifySkillsCli(cli, FIXTURE_REF.skillsCli), /--version: exit 1/);
});

// ─── AC5 (real bundle) ───────────────────────────────────────────────────────
console.log('\nAC5: real bundle/');

const realBundle = process.env.MA_BUNDLE_DIR || path.join(projectRoot, 'bundle');
if (!fs.existsSync(path.join(realBundle, 'manifest.json'))) {
  skip('real bundle verification', `no bundle at ${realBundle} (run \`ma-agents bundle build\` first; the 36.6 CI job builds it)`);
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(realBundle, 'manifest.json'), 'utf8'));
  test('real: manifest bmadRef equals package.json bmadRef', () => {
    assert.deepStrictEqual(manifest.bmadRef, pkg.bmadRef);
  });
  test('real: core commit = bmadRef.core, required v7 scripts present, hashes recomputed from disk match', () => {
    assert.deepStrictEqual(verifyBundle(realBundle, pkg.bmadRef.core), []);
  });
  test('real: the bundled Skills CLI prints bmadRef.skillsCli with --version', () => {
    const cliPkg = JSON.parse(fs.readFileSync(path.join(realBundle, 'skills-cli', 'package.json'), 'utf8'));
    const bin = typeof cliPkg.bin === 'string' ? cliPkg.bin : cliPkg.bin[cliPkg.name];
    const r = spawnSync(process.execPath, [path.join(realBundle, 'skills-cli', bin), '--version'], {
      encoding: 'utf8', env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' },
    });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(r.stdout.trim(), pkg.bmadRef.skillsCli);
  });
  test('real: modules / omitted follow bmadRef (an empty tag is omitted)', () => {
    for (const [key, item] of [['tea', 'tea'], ['cis', 'cis']]) {
      if (pkg.bmadRef[key] === '') {
        assert.ok(!manifest.modules.includes(item) && manifest.omitted.some((o) => o.name === item), `${item} should be omitted`);
      } else {
        assert.ok(manifest.modules.includes(item), `${item} should be listed`);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
for (const c of cleanup) {
  try { bundle.removeTree(c); } catch (err) { console.log(`  (could not remove ${c}: ${err.message})`); }
}
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
