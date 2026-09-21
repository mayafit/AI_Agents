#!/usr/bin/env node
/**
 * Tests for Story 30.2: Closed-by-default bundle filter + two-sided
 * set-EQUALITY thin-cache guard (P5-8 / FR235 / NFR73).
 *
 * Safety-critical (fail-closed): these prove that `build-bmad-cache.js` will
 * NEVER force-bundle a module ma-agents does not explicitly allowlist — the
 * exact break the 30.1 gate reproduced against a live bmad-method@6.10.0
 * (bmad-loop = type: bmad-org + marketplace-plugin: true slipping past the old
 * open-by-default "keep every bmad-org" filter).
 *
 * Scoped to NOT overlap the 27.2 reader suite (build-bmad-cache-reader.test.js)
 * or the 27.3 version-bump suite (bmad-version-bump.test.js): those pin the
 * relocated-registry reader and schema; THIS pins the closed allowlist, the
 * shape-flip halt, and the two-sided equality guard.
 *
 * All assertions run WITHOUT network — pure functions over fixtures plus a few
 * end-to-end spawns whose fail-loud paths abort BEFORE any git clone.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let passed = 0;
let failed = 0;
const errors = [];

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

const projectRoot = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(projectRoot, 'scripts', 'build-bmad-cache.js');
const reader = require('../scripts/build-bmad-cache.js');

// A faithful slice of the LIVE bmad-method@6.10.0 package-root bmad-modules.yaml
// (enumerated by the 30.1 gate). It carries the two v6.10.0 additions the old
// filter mishandled: `bmad-loop` (type: bmad-org + marketplace-plugin: true) and
// `bmad-automator` (type: experimental + deprecated: true), plus the five
// genuinely-bundled bmad-org modules.
const FIXTURE_6_10_0 = `# Official module registry (v6.10.0)
modules:
  bmad-loop:
    url: https://github.com/bmad-code-org/bmad-loop
    code: bmad-loop
    name: "BMad Loop"
    type: bmad-org
    marketplace-plugin: true
    defaultSelected: false
    post-install-message: "Run bmad-loop-setup to finish configuring the orchestrator."

  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    code: tea
    name: "BMad Test Architect"
    type: bmad-org

  bmad-builder:
    url: https://github.com/bmad-code-org/bmad-builder
    code: bmb
    name: "BMad Builder"
    type: bmad-org

  bmad-automator:
    url: https://github.com/bmad-code-org/bmad-automator
    code: automator
    name: "BMad Automator Experimental"
    type: experimental
    deprecated: true
    deprecation-message: "Replaced by BMad Loop (bmad-loop)."

  bmad-creative-intelligence-suite:
    url: https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite
    code: cis
    name: "BMad Creative Intelligence Suite"
    type: bmad-org

  bmad-game-dev-studio:
    url: https://github.com/bmad-code-org/bmad-module-game-dev-studio.git
    code: gds
    name: "BMad Game Dev Studio"
    type: bmad-org

  bmad-method-wds-expansion:
    url: https://github.com/bmad-code-org/bmad-method-wds-expansion
    code: wds
    name: "Whiteport Design Studio"
    type: bmad-org
`;

console.log('\nStory 30.2: closed-by-default bundle filter + two-sided set-EQUALITY guard\n');

// ---- Closed-by-default allowlist (normalizeModules) ----

console.log('normalizeModules() — closed-by-default allowlist');

test('exactly the three allowlisted modules survive the live 6.10.0 registry', () => {
  const codes = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_6_10_0)).map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'tea'],
    `expected exactly {tea,bmb,cis}; got: ${codes.join(', ')}`);
});

// FR75. The registry fixture is a snapshot of the live v6.10.0 registry, in
// which gds and wds are ordinary healthy bmad-org entries — the same shape as
// tea, bmb and cis. Nothing about the DATA excludes them; only the allowlist
// does. Asserted here as well as in build-bmad-cache-reader because this suite
// is the one that owns the closed-allowlist posture.
test('FR75: gds and wds are EXCLUDED even though the registry offers them unflagged', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_6_10_0);
  for (const code of ['gds', 'wds']) {
    const entry = parsed.find(m => m.code === code);
    assert.ok(entry, `fixture precondition: the 6.10.0 registry still carries ${code}`);
    assert.strictEqual(entry.type, 'bmad-org',
      `fixture precondition: ${code} is an ordinary first-party module`);
    assert.ok(!reader.DISQUALIFYING_FLAGS.some(f => reader.isFlagTrue(entry[f])),
      `fixture precondition: ${code} carries no disqualifying flag`);
  }
  const codes = reader.normalizeModules(parsed).map(m => m.code);
  assert.ok(!codes.includes('gds'), `gds must not be bundled (FR75); got: ${codes.join(', ')}`);
  assert.ok(!codes.includes('wds'), `wds must not be bundled (FR75); got: ${codes.join(', ')}`);
});

test('bmad-loop (type: bmad-org + marketplace-plugin: true) is EXCLUDED — the exact 30.1 break', () => {
  const codes = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_6_10_0)).map(m => m.code);
  assert.ok(!codes.includes('bmad-loop'),
    `bmad-loop must never be force-bundled (air-gap-hostile); got: ${codes.join(', ')}`);
});

test('bmad-automator (deprecated experimental) is EXCLUDED', () => {
  const codes = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_6_10_0)).map(m => m.code);
  assert.ok(!codes.includes('automator'), `automator must be excluded; got: ${codes.join(', ')}`);
});

test('a plain NEW type: bmad-org module carrying NEITHER flag FAILS CLOSED (excluded)', () => {
  // The class the open-by-default filter could not catch: an innocent future
  // first-party module. The allowlist drops it — the resolved set stays three.
  const raw = reader.parseModulesYaml(FIXTURE_6_10_0).concat([
    { key: 'bmad-shiny-new', code: 'shiny', url: 'https://github.com/bmad-code-org/bmad-shiny-new', name: 'Shiny New', type: 'bmad-org' },
  ]);
  const codes = reader.normalizeModules(raw).map(m => m.code).sort();
  assert.ok(!codes.includes('shiny'),
    `a new un-allowlisted bmad-org module must fail closed; got: ${codes.join(', ')}`);
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'tea'],
    `resolved set must stay exactly the three; got: ${codes.join(', ')}`);
});

test('output shape is still { code, url, name, branch } with branch defaulting to main', () => {
  const out = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_6_10_0));
  const tea = out.find(m => m.code === 'tea');
  assert.deepStrictEqual(Object.keys(tea).sort(), ['branch', 'code', 'name', 'url']);
  assert.strictEqual(tea.branch, 'main');
});

// ---- Shape-flip halt (an allowlisted module gains a disqualifying flag) ----

console.log('\nnormalizeModules() — shape-flip HALT on an allowlisted module');

test('allowlisted module gaining marketplace-plugin: true THROWS (halts the build)', () => {
  const raw = [
    { key: 'tea', code: 'tea', url: 'https://example.com/tea', type: 'bmad-org', 'marketplace-plugin': 'true' },
  ];
  assert.throws(() => reader.normalizeModules(raw), /tea.*marketplace-plugin|marketplace-plugin.*tea/i,
    'a bundled module turning into a marketplace-plugin must abort the build');
});

test('allowlisted module gaining deprecated: true THROWS (halts the build)', () => {
  const raw = [
    { key: 'bmb', code: 'bmb', url: 'https://example.com/bmb', type: 'bmad-org', deprecated: 'true' },
  ];
  assert.throws(() => reader.normalizeModules(raw), /bmb.*deprecated|deprecated.*bmb/i,
    'a bundled module being deprecated must abort the build');
});

test('a boolean-true flag (not just the string) also trips the halt', () => {
  const raw = [
    { key: 'cis', code: 'cis', url: 'https://example.com/cis', type: 'bmad-org', deprecated: true },
  ];
  assert.throws(() => reader.normalizeModules(raw), /deprecated/i);
});

test('a NON-allowlisted module carrying a flag does NOT throw (it is simply dropped)', () => {
  // bmad-loop carries marketplace-plugin: true but is not allowlisted — the flag
  // assertion only guards modules we bundle, so this must be a silent exclusion,
  // not a throw.
  assert.doesNotThrow(() => reader.normalizeModules(reader.parseModulesYaml(FIXTURE_6_10_0)));
});

// ---- Two-sided set-EQUALITY guard (diffBundleSet) ----

console.log('\ndiffBundleSet() — two-sided set-EQUALITY');

test('the exact three resolve to no drift (missing + extra both empty)', () => {
  const { missing, extra } = reader.diffBundleSet(['tea', 'bmb', 'cis']);
  assert.deepStrictEqual(missing, []);
  assert.deepStrictEqual(extra, []);
});

// NFR73 needed no redesign for FR75 because KNOWN_BUNDLED_MODULES is BOTH the
// include filter in normalizeModules() and the allowlist diffBundleSet()
// compares against: dropping a code shrinks both sides together, so missing
// and extra both stay empty. The load-bearing consequence is asserted here —
// a build that somehow resolved gds or wds again would be caught as EXTRA
// rather than passing silently.
test('NFR73: re-resolving gds or wds is reported as EXTRA, not silently accepted', () => {
  const { missing, extra } = reader.diffBundleSet(['tea', 'bmb', 'cis', 'gds', 'wds']);
  assert.deepStrictEqual(missing, [], 'the allowlisted three are all present');
  assert.deepStrictEqual(extra, ['gds', 'wds'],
    'an unbundled module reappearing in the resolved set must fail the equality guard');
});

test('an EXTRA module (bmad-loop) is caught — the two-sided half NFR56 missed', () => {
  // This is the exact silent-addition bug: the resolved set is a SUPERSET of the
  // allowlist. The old subset-only guard saw MISSING=(none) and passed; the
  // equality guard must flag the extra.
  const { missing, extra } = reader.diffBundleSet(['tea', 'bmb', 'cis', 'bmad-loop']);
  assert.deepStrictEqual(missing, [], 'nothing is missing in the addition case');
  assert.deepStrictEqual(extra, ['bmad-loop'], 'the extra module must be reported');
});

test('a MISSING module (thin cache) is still caught', () => {
  const { missing, extra } = reader.diffBundleSet(['tea']);
  assert.deepStrictEqual(missing, ['bmb', 'cis']);
  assert.deepStrictEqual(extra, []);
});

test('simultaneous missing AND extra are both reported', () => {
  const { missing, extra } = reader.diffBundleSet(['tea', 'bmb', 'bmad-loop']);
  assert.deepStrictEqual(missing, ['cis']);
  assert.deepStrictEqual(extra, ['bmad-loop']);
});

test('diffBundleSet accepts a Set or an array and is order-independent', () => {
  const fromArr = reader.diffBundleSet(['cis', 'tea', 'bmb']);
  const fromSet = reader.diffBundleSet(new Set(['bmb', 'cis', 'tea']));
  assert.deepStrictEqual(fromArr, { missing: [], extra: [] });
  assert.deepStrictEqual(fromSet, { missing: [], extra: [] });
});

// ---- isFlagTrue helper ----

console.log('\nisFlagTrue()');

test('recognizes string and boolean true; rejects everything else', () => {
  assert.strictEqual(reader.isFlagTrue('true'), true);
  assert.strictEqual(reader.isFlagTrue(true), true);
  assert.strictEqual(reader.isFlagTrue(' True '), true);
  assert.strictEqual(reader.isFlagTrue('false'), false);
  assert.strictEqual(reader.isFlagTrue(undefined), false);
  assert.strictEqual(reader.isFlagTrue(''), false);
  assert.strictEqual(reader.isFlagTrue('yes'), false);
});

// ---- exported constants ----

console.log('\nexported constants');

test('KNOWN_BUNDLED_MODULES is exactly the three bundled modules', () => {
  assert.deepStrictEqual([...reader.KNOWN_BUNDLED_MODULES].sort(), ['bmb', 'cis', 'tea']);
});

test('DISQUALIFYING_FLAGS pins marketplace-plugin + deprecated', () => {
  assert.deepStrictEqual([...reader.DISQUALIFYING_FLAGS].sort(), ['deprecated', 'marketplace-plugin']);
});

// ---- End-to-end fail-loud (real script, offline — aborts before any clone) ----

console.log('\nend-to-end fail-loud (real script, no network)');

function findRealNodeModules() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'node_modules', 'fs-extra', 'package.json');
    if (fs.existsSync(candidate)) return path.join(dir, 'node_modules');
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate a node_modules containing fs-extra (run npm install).');
}
const REAL_NODE_MODULES = findRealNodeModules();

function makeFakeBmadEnv(registryYaml) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-30-2-'));
  const fakeBmad = path.join(tmpRoot, 'node_modules', 'bmad-method');
  fs.mkdirSync(fakeBmad, { recursive: true });
  fs.writeFileSync(
    path.join(fakeBmad, 'package.json'),
    JSON.stringify({ name: 'bmad-method', version: '6.10.0' }, null, 2)
  );
  if (registryYaml != null) {
    fs.writeFileSync(path.join(fakeBmad, 'bmad-modules.yaml'), registryYaml);
  }
  const scriptsDir = path.join(tmpRoot, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const scriptPath = path.join(scriptsDir, 'build-bmad-cache.js');
  fs.copyFileSync(SCRIPT_PATH, scriptPath);
  const env = {
    ...process.env,
    NODE_PATH: [path.join(tmpRoot, 'node_modules'), REAL_NODE_MODULES].join(path.delimiter),
  };
  return { tmpRoot, scriptPath, env };
}

function runScript(scriptPath, env) {
  try {
    execFileSync(process.execPath, [scriptPath], { encoding: 'utf8', stdio: 'pipe', timeout: 60000, env });
    return { code: 0, stderr: '' };
  } catch (err) {
    return { code: err.status == null ? -1 : err.status, stderr: String(err.stderr || '') };
  }
}

test('an allowlisted module carrying marketplace-plugin: true aborts the build, no manifest', () => {
  // tea flips to a marketplace-plugin upstream — the shape-flip halt must abort
  // the real script end-to-end, before any clone or manifest write.
  const flipped = `modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    code: tea
    name: "BMad Test Architect"
    type: bmad-org
    marketplace-plugin: true
  bmad-builder:
    url: https://github.com/bmad-code-org/bmad-builder
    code: bmb
    name: "BMad Builder"
    type: bmad-org
  bmad-creative-intelligence-suite:
    url: https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite
    code: cis
    name: "BMad Creative Intelligence Suite"
    type: bmad-org
  bmad-game-dev-studio:
    url: https://github.com/bmad-code-org/bmad-module-game-dev-studio.git
    code: gds
    name: "BMad Game Dev Studio"
    type: bmad-org
  bmad-method-wds-expansion:
    url: https://github.com/bmad-code-org/bmad-method-wds-expansion
    code: wds
    name: "Whiteport Design Studio"
    type: bmad-org
`;
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(flipped);
  try {
    const result = runScript(scriptPath, env);
    assert.notStrictEqual(result.code, 0, `expected non-zero exit, got ${result.code}. stderr:\n${result.stderr}`);
    assert.ok(/marketplace-plugin|disqualifying flag/i.test(result.stderr),
      `expected a shape-flip halt message, got:\n${result.stderr}`);
    const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
    assert.ok(!fs.existsSync(manifestPath), 'shape-flip halt must NOT leave a manifest');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a deficient set still aborts (thin-cache regression) with no manifest', () => {
  const deficient = `modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    code: tea
    name: "BMad Test Architect"
    type: bmad-org
`;
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(deficient);
  try {
    const result = runScript(scriptPath, env);
    assert.notStrictEqual(result.code, 0, `expected non-zero exit, got ${result.code}. stderr:\n${result.stderr}`);
    assert.ok(/thin cache|Missing:/i.test(result.stderr),
      `expected a thin-cache message, got:\n${result.stderr}`);
    const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
    assert.ok(!fs.existsSync(manifestPath), 'thin-cache abort must NOT leave a manifest');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
