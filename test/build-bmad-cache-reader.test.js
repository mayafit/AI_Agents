#!/usr/bin/env node
/**
 * Tests for Story 27.2: Point build-bmad-cache.js at the relocated v6.8.0
 * registry (type filter + thin-cache fail-loud guard).
 *
 * Covers the *reader* logic only — deliberately scoped to NOT overlap Story
 * 27.3's suite-wide assertion rewrites in bmad-version-bump.test.js:
 *
 *   1. parseModulesYaml() against a 6.8.0-shaped fixture (modules: map +
 *      unquoted url + `type` field + extra fields it must ignore).
 *   2. normalizeModules() type filter: `type: bmad-org` in, `type:
 *      experimental` out, untyped (built-in bmm/core) out; branch defaults to
 *      main; output shape stays { code, url, name, branch }.
 *   3. The thin-cache fail-loud guard (NFR56): a deficient registry must exit
 *      non-zero and leave NO cache-manifest.json — exercised end-to-end by
 *      spawning the real script against a fake bmad-method package on disk.
 *
 * All assertions run WITHOUT network — they use in-repo fixtures and a fake
 * package; the fail-loud path aborts before any git clone is attempted.
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

// Requiring the script as a module exports the pure reader functions instead
// of running the build (the script guards on require.main === module).
const reader = require('../scripts/build-bmad-cache.js');

// Resolve a node_modules directory that actually contains fs-extra (and its
// transitive deps). In a git worktree the worktree itself has no node_modules,
// so we walk up from this test file until we find one — this is the directory
// the spawned script must see on NODE_PATH so its `require('fs-extra')` works.
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

// A faithful slice of the real bmad-method@6.8.0 package-root bmad-modules.yaml
// (verified live during 27.2 development). Note: `url` is UNQUOTED, names ARE
// quoted, and entries carry extra fields (description/defaultSelected/
// npmPackage/default_channel/module-definition/plugin_name) the reader must
// tolerate and ignore.
const FIXTURE_68 = `# Official module registry
modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    module-definition: src/module.yaml
    code: tea
    name: "BMad Test Architect"
    description: "Quality strategy and release gates"
    defaultSelected: false
    type: bmad-org
    npmPackage: bmad-method-test-architecture-enterprise
    default_channel: stable

  bmad-builder:
    url: https://github.com/bmad-code-org/bmad-builder
    module-definition: skills/module.yaml
    code: bmb
    name: "BMad Builder"
    type: bmad-org
    default_channel: stable

  bmad-automator:
    url: https://github.com/bmad-code-org/bmad-automator
    code: automator
    name: "BMad Automator Experimental"
    type: experimental
    default_channel: next

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
    plugin_name: bmad-wds
    name: "Whiteport Design Studio"
    type: bmad-org
`;

// ---- parseModulesYaml() ----

console.log('\nStory 27.2: build-bmad-cache reader (relocated v6.8.0 registry)\n');
console.log('parseModulesYaml() — 6.8.0-shaped fixture');

test('parses every module entry in the modules: map', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_68);
  const codes = parsed.map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['automator', 'bmb', 'cis', 'gds', 'tea', 'wds']);
});

test('captures the type field for each entry', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_68);
  const byCode = Object.fromEntries(parsed.map(m => [m.code, m]));
  assert.strictEqual(byCode.tea.type, 'bmad-org');
  assert.strictEqual(byCode.automator.type, 'experimental');
  assert.strictEqual(byCode.wds.type, 'bmad-org');
});

test('reads UNQUOTED url values (6.8.0 leaves url unquoted)', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_68);
  const tea = parsed.find(m => m.code === 'tea');
  assert.strictEqual(tea.url, 'https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise');
});

test('reads QUOTED name values', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_68);
  const wds = parsed.find(m => m.code === 'wds');
  assert.strictEqual(wds.name, 'Whiteport Design Studio');
});

// ---- normalizeModules() type filter ----

console.log('\nnormalizeModules() — type filter (bmad-org in, experimental out)');

test('keeps exactly the five bmad-org modules and drops experimental', () => {
  const out = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_68));
  const codes = out.map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'gds', 'tea', 'wds'],
    `automator (experimental) must be excluded; got: ${codes.join(', ')}`);
});

test('drops untyped built-in entries (bmm/core are absent from registry anyway)', () => {
  // bmm/core never appear in the 6.8.0 registry, but guard against a future
  // registry that lists them without a bmad-org type.
  const raw = [
    { key: 'bmad-method', code: 'bmm', url: 'https://example.com/bmm' },
    { key: 'bmad-core', code: 'core', url: 'https://example.com/core', type: 'core' },
    { key: 'bmad-builder', code: 'bmb', url: 'https://example.com/bmb', type: 'bmad-org' },
  ];
  const out = reader.normalizeModules(raw);
  assert.deepStrictEqual(out.map(m => m.code), ['bmb']);
});

test('output shape is { code, url, name, branch } with branch defaulting to main', () => {
  const out = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_68));
  const tea = out.find(m => m.code === 'tea');
  assert.deepStrictEqual(Object.keys(tea).sort(), ['branch', 'code', 'name', 'url']);
  assert.strictEqual(tea.branch, 'main', '6.8.0 omits branch → must default to main');
});

test('wds is a normal bmad-org clone (no retired/skip path)', () => {
  const out = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_68));
  const wds = out.find(m => m.code === 'wds');
  assert.ok(wds, 'wds must be present as an active bmad-org module');
  assert.strictEqual(wds.branch, 'main');
  assert.strictEqual(wds.url, 'https://github.com/bmad-code-org/bmad-method-wds-expansion');
});

test('rejects a module code with path-traversal characters', () => {
  const raw = [
    { key: 'evil', code: '../escape', url: 'https://example.com/x', type: 'bmad-org' },
    { key: 'ok', code: 'tea', url: 'https://example.com/tea', type: 'bmad-org' },
  ];
  const out = reader.normalizeModules(raw);
  assert.deepStrictEqual(out.map(m => m.code), ['tea']);
});

// ---- exported constants ----

console.log('\nexported reader constants');

test('KNOWN_BUNDLED_MODULES is exactly the five bundled modules', () => {
  assert.deepStrictEqual([...reader.KNOWN_BUNDLED_MODULES].sort(),
    ['bmb', 'cis', 'gds', 'tea', 'wds']);
});

test('the relocated package-root path is first in REGISTRY_CANDIDATES', () => {
  const first = reader.REGISTRY_CANDIDATES[0];
  assert.deepStrictEqual(first.parts, ['bmad-modules.yaml']);
  assert.strictEqual(first.schema, 'package-root-v68');
});

test('locateRegistry tags the relocated package-root YAML as package-root-v68 (AC5)', () => {
  // Build a fake bmad-method dir on disk containing only the relocated YAML and
  // confirm the schema tag that flows into the manifest is the NEW value
  // (never the now-impossible v63/legacy).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-locate-'));
  try {
    fs.writeFileSync(path.join(tmp, 'bmad-modules.yaml'), FIXTURE_68);
    const { yamlPath, schema } = reader.locateRegistry(tmp);
    assert.strictEqual(schema, 'package-root-v68', `expected package-root-v68, got ${schema}`);
    assert.strictEqual(path.basename(yamlPath), 'bmad-modules.yaml');
    assert.notStrictEqual(schema, 'v63');
    assert.notStrictEqual(schema, 'legacy');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- thin-cache fail-loud guard (end-to-end) ----

console.log('\nthin-cache fail-loud guard (NFR56) — end-to-end spawn');

/**
 * Build an isolated package tree the spawned script runs inside:
 *   <tmp>/scripts/build-bmad-cache.js   (a copy of the real script)
 *   <tmp>/node_modules/bmad-method/...  (a FAKE bmad-method + registry YAML)
 *
 * The copy lives under a temp root so the script's CACHE_DIR (../lib/bmad-cache)
 * resolves under the temp tree — never touching the real repo cache. The fake
 * bmad-method sits in the temp tree's own node_modules so it wins the
 * `bmad-method` specifier; fs-extra and its transitive deps are supplied via
 * NODE_PATH pointing at the project's real node_modules.
 *
 * @param {string} registryYaml Contents to write as bmad-modules.yaml (omit to
 *   skip writing the registry file, simulating the relocated path 404).
 * @returns {{ tmpRoot: string, scriptPath: string, env: Object }}
 */
function makeFakeBmadEnv(registryYaml) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-failloud-'));
  const fakeBmad = path.join(tmpRoot, 'node_modules', 'bmad-method');
  fs.mkdirSync(fakeBmad, { recursive: true });
  fs.writeFileSync(
    path.join(fakeBmad, 'package.json'),
    JSON.stringify({ name: 'bmad-method', version: '6.8.0' }, null, 2)
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
    // Fake bmad-method first (wins the specifier), then the real node_modules
    // for fs-extra + transitive deps.
    NODE_PATH: [path.join(tmpRoot, 'node_modules'), REAL_NODE_MODULES].join(path.delimiter),
  };
  return { tmpRoot, scriptPath, env };
}

function runScript(scriptPath, env) {
  try {
    execFileSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000,
      env,
    });
    return { code: 0, stderr: '' };
  } catch (err) {
    return { code: err.status == null ? -1 : err.status, stderr: String(err.stderr || '') };
  }
}

test('deficient registry (only tea) exits non-zero and writes NO manifest', () => {
  const deficient = `modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    code: tea
    name: "BMad Test Architect"
    type: bmad-org
`;
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(deficient);
  const result = runScript(scriptPath, env);

  assert.notStrictEqual(result.code, 0, `expected non-zero exit, got ${result.code}. stderr:\n${result.stderr}`);
  assert.ok(/thin module set|Missing:/i.test(result.stderr),
    `expected an actionable thin-cache message, got:\n${result.stderr}`);

  const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(!fs.existsSync(manifestPath),
    `fail-loud path must NOT leave a partial cache-manifest.json (found ${manifestPath})`);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('duplicate module codes abort the build with no manifest written', () => {
  // Two bmad-org entries share code "tea": the build must refuse rather than
  // clone-and-overwrite the same cache dir (last-write-wins) silently.
  const dupes = `modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    code: tea
    name: "BMad Test Architect"
    type: bmad-org
  bmad-test-architecture-clone:
    url: https://github.com/bmad-code-org/some-other-repo
    code: tea
    name: "Duplicate tea"
    type: bmad-org
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
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(dupes);
  const result = runScript(scriptPath, env);

  assert.notStrictEqual(result.code, 0, `expected non-zero exit, stderr:\n${result.stderr}`);
  assert.ok(/duplicate module codes/i.test(result.stderr),
    `expected a duplicate-code message, got:\n${result.stderr}`);
  const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(!fs.existsSync(manifestPath), 'no manifest must be written on the duplicate-code path');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('missing registry YAML exits non-zero with an actionable message', () => {
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(null); // no YAML written
  const result = runScript(scriptPath, env);

  assert.notStrictEqual(result.code, 0, `expected non-zero exit, stderr:\n${result.stderr}`);
  assert.ok(/no module registry YAML found|bmad-modules\.yaml/i.test(result.stderr),
    `expected a 'registry not found' message, got:\n${result.stderr}`);

  const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(!fs.existsSync(manifestPath), 'no manifest must be written when the registry is missing');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
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
