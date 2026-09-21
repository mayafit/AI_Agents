#!/usr/bin/env node
/**
 * Tests for Story 30.3: Bump bmad-method to 6.10.0 + Rebuild Cache and Plugin
 *
 * Task 1: Verify package.json dependency + live install pinned at 6.10.0
 * Task 2: Verify build:bmad-cache reads the package-root registry contract
 * Task 3: Verify bmad.js CLI compatibility with bmad-cli.js entry point
 * Task 4: Verify prePopulateBmadCache compatibility
 *
 * Lineage: originally Story 15.1 (6.2.2); rewritten for Story 22.1 (6.3.0);
 * updated for Story 24.1 (6.6.0); Story 27.3/27.5 moved the pin to 6.8.0 and
 * reworked the registry contract; Story 28.1 bumped the pin to 6.9.0; Story
 * 30.2 closed the bundle filter to an ALLOWLIST + two-sided set-EQUALITY guard
 * (still at 6.9.0, to unblock this bump safely); Story 30.3 bumps the pin to
 * 6.10.0. The installer layout is unchanged since 6.3.0
 * (tools/installer/bmad-cli.js, tools/installer/commands/install.js).
 * fs-extra removed in 6.4.0 -> replaced with native node:fs in bmad-method
 * internals; ma-agents keeps its own fs-extra.
 *
 * The module source lives in a package-root `bmad-modules.yaml` (relocated at
 * v6.8.0, Decision P5-5; schema UNCHANGED at v6.9.0/v6.10.0, Decisions P5-6/
 * P5-8) and the bundle decision used to be a bare `type: bmad-org` filter. At
 * v6.10.0 the registry gained a NEW `bmad-loop` module (`type: bmad-org`,
 * `marketplace-plugin: true`, air-gap-hostile) and flagged `bmad-automator`
 * `deprecated: true` — so `scripts/build-bmad-cache.js`'s reader (Story 30.2)
 * now filters on a CLOSED ALLOWLIST (`KNOWN_BUNDLED_MODULES`) rather than the
 * raw `type` field, and a two-sided `diffBundleSet()` guard fails the build on
 * either a MISSING or an EXTRA module versus that allowlist. The reader tags
 * the schema `package-root-v68` and this file's AC3 gate re-confirms, against
 * the LIVE-installed bmad-method@6.10.0, that this posture holds end-to-end —
 * not just against the 30.2 hand-written fixtures.
 *
 * v6.10.0 GATE NOTE (Story 30.3 / P5-8): the 30.1 gate confirmed live against
 * `bmad-method@6.10.0` that the registry PATH and SCHEMA are unchanged (additive
 * new fields only: `marketplace-plugin`, `deprecated`, `deprecation-message`,
 * `post-install-message`, `aliases`), so `build-bmad-cache.js`'s reader
 * (`parseModulesYaml`/`normalizeModules`) needed NO change beyond the 30.2
 * allowlist/guard rework that already landed at 6.9.0. The AC3 assertion below
 * re-confirms this against the npm-INSTALLED bmad-method@6.10.0 on disk: it
 * resolves the package root via require.resolve and asserts the shipped
 * `bmad-modules.yaml` exists there (path unchanged) with a `modules:` map whose
 * entries carry code/url/name/type (schema unchanged); that `bmad-loop` is
 * present as `type: bmad-org` + `marketplace-plugin: true` and `bmad-automator`
 * is `deprecated: true`; and that running the REAL closed-allowlist reader
 * against the live YAML resolves EXACTLY {tea, bmb, cis} with
 * `bmad-loop` excluded. Fully offline (reads the installed file; no network, no
 * clone). If the path or schema ever drifts, THIS is the gate that fails — not
 * a silently thin (or silently over-broad) cache.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// The pure reader functions (parseModulesYaml / normalizeModules / locateRegistry
// + exported constants, including the 30.2 closed allowlist + diffBundleSet
// guard). Requiring the script exports them instead of running the build (it
// guards on require.main === module), so the contract can be exercised against
// fixtures and the live install without cloning anything.
const reader = require('../scripts/build-bmad-cache.js');

// A faithful slice of the relocated v6.8.0 package-root bmad-modules.yaml: a
// `modules:` map whose entries carry code/url/name/type, the url UNQUOTED and
// the name quoted, plus extra fields the reader must tolerate and ignore. tea/
// bmb/cis/gds/wds are `type: bmad-org` (bundled); automator is `experimental`
// (excluded); bmm/core are built into the npm package and absent from the
// registry entirely. There is NO `branch` field (defaults to main) and NO
// `built_in` flag (superseded by `type`). This fixture predates 6.10.0's
// `bmad-loop`/`deprecated` additions on purpose — it exercises the reader
// against the schema shape unchanged since 6.8.0; the 30.2 fixtures already
// cover `bmad-loop` and `deprecated` exhaustively (test/bundle-filter-set-equality.test.js).
const FIXTURE_V68 = `# Official module registry (relocated to package root at v6.8.0)
modules:
  bmad-method-test-architecture-enterprise:
    url: https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise
    module-definition: src/module.yaml
    code: tea
    name: "BMad Test Architect"
    type: bmad-org
    default_channel: stable

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

// --- Fail-loud end-to-end harness (AC3/AC5/NFR56) ---------------------------
//
// The thin-cache / missing-registry assertions run the REAL build script
// end-to-end against a FAKE bmad-method package on disk, so the negative path
// is exercised without a genuinely broken install and without ever reaching a
// git clone (the guards abort first). The script is copied under a temp root so
// its CACHE_DIR (../lib/bmad-cache, relative to the copied script) resolves
// inside the temp tree — the real repo cache is never touched.

// Resolve a node_modules directory that actually contains fs-extra (and its
// transitive deps). In a git worktree the worktree itself MAY have no
// node_modules, so walk up from this test file until one is found — this is the
// directory the spawned script must see on NODE_PATH so its `require('fs-extra')`
// resolves. (AC5: no network, fixtures/installed package only.)
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

/**
 * Build an isolated package tree the spawned script runs inside:
 *   <tmp>/scripts/build-bmad-cache.js   (a copy of the real script)
 *   <tmp>/node_modules/bmad-method/...  (a FAKE bmad-method + registry YAML)
 *
 * The fake bmad-method sits in the temp tree's own node_modules so it wins the
 * `bmad-method` specifier; fs-extra + transitive deps come via NODE_PATH
 * pointing at the project's real node_modules. Pass `null` to skip writing the
 * registry YAML (simulating the relocated path 404 / a downgrade below 6.8.0).
 *
 * @param {?string} registryYaml Contents to write as bmad-modules.yaml, or null.
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

/**
 * Spawn the copied build script and capture its exit code + stderr.
 * @returns {{ code: number, stderr: string }}
 */
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

console.log('\nStory 30.3: Bump bmad-method to 6.10.0 + Rebuild Cache and Plugin\n');

// ---- Task 1: package.json dependency ----

console.log('Task 1: package.json dependency');

test('package.json pins bmad-method at 6.10.0 (exact, no caret/tilde)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.dependencies['bmad-method'], '6.10.0');
});

test('installed bmad-method is version 6.10.0', () => {
  const bmadPkg = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'node_modules', 'bmad-method', 'package.json'), 'utf8')
  );
  assert.strictEqual(bmadPkg.version, '6.10.0');
});

// ---- Story 30.3 AC (P5-8 hard verification gate): LIVE-INSTALL registry check ----
//
// The "registry path/schema unchanged at v6.10.0, but a NEW bmad-loop module +
// deprecated automator appeared" claim was verified live by the 30.1 gate
// (out-of-tree scratch install). This assertion re-confirms it against the
// npm-INSTALLED bmad-method@6.10.0 on disk: it resolves the package root via
// require.resolve and asserts the shipped `bmad-modules.yaml` exists there
// (path unchanged) with a `modules:` map whose entries carry
// code/url/name/type (schema unchanged); that `bmad-loop` now exists as
// `type: bmad-org` + `marketplace-plugin: true`; that `bmad-automator` carries
// `deprecated: true`; and — the actual safety property Story 30.2/30.3 exist to
// guarantee — that running the REAL closed-allowlist reader
// (`normalizeModules`) against this live YAML resolves EXACTLY
// {tea, bmb, cis}, with `bmad-loop` excluded despite being
// `type: bmad-org`. Fully offline (reads the installed file; no network, no
// clone). If the path, schema, or bundled-set ever drifts, THIS is the gate
// that fails — not a silently thin or silently over-broad cache.
test('AC (P5-8 gate): live-installed bmad-modules.yaml is at the package root, schema unchanged, bmad-loop present-but-excluded', () => {
  const bmadRoot = path.dirname(require.resolve('bmad-method/package.json'));
  const registryPath = path.join(bmadRoot, 'bmad-modules.yaml');
  assert.ok(
    fs.existsSync(registryPath),
    `HALT (P5-8 drift): bmad-modules.yaml not at the package root (${registryPath}). The registry may have relocated at v6.10.0 — build-bmad-cache.js's reader would need rework; do not paper over.`
  );
  const rawText = fs.readFileSync(registryPath, 'utf8');
  const yaml = require('js-yaml');
  const doc = yaml.load(rawText);
  assert.ok(doc && doc.modules && typeof doc.modules === 'object',
    'live registry must expose a `modules:` map (the v6.8.0 schema shape, unchanged at 6.10.0)');
  const entries = Object.values(doc.modules);
  for (const e of entries) {
    assert.ok(e.code && e.url && e.name && e.type,
      `every live registry entry must carry code/url/name/type (got ${JSON.stringify(e)})`);
  }

  // bmad-loop: NEW at 6.10.0 — bmad-org + marketplace-plugin (air-gap-hostile).
  const bmadLoop = entries.find(e => e.code === 'bmad-loop');
  assert.ok(bmadLoop, 'bmad-loop must be present in the live 6.10.0 registry (30.1 gate finding)');
  assert.strictEqual(bmadLoop.type, 'bmad-org', 'bmad-loop must carry type: bmad-org at 6.10.0');
  assert.ok(reader.isFlagTrue(bmadLoop['marketplace-plugin']),
    'bmad-loop must carry marketplace-plugin: true at 6.10.0');

  // bmad-automator: now explicitly deprecated (was already type: experimental).
  const automator = entries.find(e => e.code === 'automator');
  assert.ok(automator, 'automator must remain present (type: experimental) at 6.10.0');
  assert.strictEqual(automator.type, 'experimental');
  assert.ok(reader.isFlagTrue(automator.deprecated),
    'bmad-automator must carry deprecated: true at 6.10.0');

  // The actual safety property: the REAL closed-allowlist reader run against
  // this live YAML resolves exactly the three — bmad-loop excluded even though
  // it is type: bmad-org, because the filter is a closed allowlist (Story 30.2),
  // not an open "keep every bmad-org" predicate.
  const resolved = reader.normalizeModules(reader.parseModulesYaml(rawText)).map(m => m.code).sort();
  assert.deepStrictEqual(resolved, ['bmb', 'cis', 'tea'],
    `live closed-allowlist resolution must be exactly tea/bmb/cis with bmad-loop excluded; got ${resolved.join(', ')}`);
  assert.ok(!resolved.includes('bmad-loop'),
    'bmad-loop must NEVER be force-bundled — this is the concrete bug Story 30.2 closes and 30.3 proves end-to-end at 6.10.0');
});

test('require.resolve finds bmad-cli.js (6.10.0 entry point)', () => {
  const resolved = require.resolve('bmad-method/tools/installer/bmad-cli.js');
  assert.ok(resolved.includes('bmad-cli.js'), `Unexpected path: ${resolved}`);
  assert.ok(fs.existsSync(resolved), `File does not exist: ${resolved}`);
});

// ---- Task 2: build:bmad-cache reads the relocated v6.8.0 registry contract ----
//
// Story 27.3 (AC1, AC2): these assertions used to pin the v6.6.0 reality — the
// `registry-fallback.yaml` path, the `built_in`-flag filter, and wds-as-retired.
// They now pin the relocated package-root YAML source tag (`package-root-v68`),
// the CLOSED-ALLOWLIST filter (Story 30.2 — bmad-org in AND on the allowlist;
// experimental out; a shape-flip on a bundled module halts the build), and
// wds-as-active. These reader-contract assertions stay driven by FIXTURE_V68 +
// the exported reader (see header) so the pure reader logic is exercised in
// isolation, offline — no network or clone. The LIVE-installed registry (now
// bmad-method@6.10.0) is re-confirmed separately by the Task 1 "AC (P5-8 gate)"
// assertion above; the exhaustive allowlist/shape-flip/set-equality fixture
// matrix lives in test/bundle-filter-set-equality.test.js (Story 30.2).

console.log('\nTask 2: relocated v6.8.0 registry contract (fixture-driven)');

test('AC1: reader tags the relocated package-root YAML source as package-root-v68 (not v63/legacy)', () => {
  // The schema tag flows into cache-manifest.json. The pre-6.8.0 v63/legacy tags
  // are now impossible for the supported path — assert the relocated source tag
  // and that the two retired tags are NOT what the package-root YAML resolves to.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-vbump-locate-'));
  try {
    fs.writeFileSync(path.join(tmp, 'bmad-modules.yaml'), FIXTURE_V68);
    const { yamlPath, schema } = reader.locateRegistry(tmp);
    assert.strictEqual(schema, 'package-root-v68', `expected package-root-v68 source tag, got ${schema}`);
    assert.strictEqual(path.basename(yamlPath), 'bmad-modules.yaml');
    assert.notStrictEqual(schema, 'v63', 'the retired v63 schema tag must no longer be emitted for the supported path');
    assert.notStrictEqual(schema, 'legacy', 'the retired legacy schema tag must no longer be emitted for the supported path');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('AC1: the relocated package-root path is the FIRST registry candidate, tagged package-root-v68', () => {
  // The supported 6.8.0 location must win resolution over the diagnostic-only
  // pre-6.8.0 fallback paths.
  const first = reader.REGISTRY_CANDIDATES[0];
  assert.deepStrictEqual(first.parts, ['bmad-modules.yaml'],
    `package-root bmad-modules.yaml must be the first candidate; got ${JSON.stringify(first.parts)}`);
  assert.strictEqual(first.schema, 'package-root-v68');
});

test('AC1: closed-allowlist filter keeps the three bundled codes and excludes type: experimental', () => {
  // Story 30.2 replaced the old `type: bmad-org` include predicate with a
  // closed allowlist (KNOWN_BUNDLED_MODULES). Drive the real normalizeModules
  // over the 6.8.0-shaped fixture: the three allowlisted codes survive,
  // experimental (automator) is dropped (it was never on the allowlist).
  const codes = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_V68)).map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'tea'],
    `expected the three allowlisted modules; automator (experimental) must be excluded. Got: ${codes.join(', ')}`);
});

test('AC1: bmm/core exclusion invariant retained (closed allowlist excludes anything not explicitly bundled)', () => {
  // bmm/core are first-party modules built into the npm package and are absent
  // from the 6.8.0/6.10.0 registry. The exclusion invariant now holds
  // structurally twice over: an entry must both carry a bundled `type` shape
  // AND be on the closed allowlist — so even a future registry that
  // erroneously listed bmm/core (under any type) would not pull them into the
  // external clone set.
  const raw = [
    { key: 'bmad-method', code: 'bmm', url: 'https://example.com/bmm' },            // untyped built-in
    { key: 'bmad-core', code: 'core', url: 'https://example.com/core', type: 'core' }, // non-bundled type
    { key: 'bmad-builder', code: 'bmb', url: 'https://example.com/bmb', type: 'bmad-org' },
  ];
  const codes = reader.normalizeModules(raw).map(m => m.code);
  assert.deepStrictEqual(codes, ['bmb'],
    `bmm/core must be excluded from the external module set; got: ${codes.join(', ')}`);
});

test('AC2: wds IS in the v6.8.0 registry as an active type: bmad-org module (was: retired)', () => {
  // Inverts the old `'wds module is NOT in the v6.6.0 upstream registry (retired)'`
  // assertion. At v6.8.0 wds is a live, bundled bmad-org expansion — present in
  // the registry with the bundled type, NOT a retired/absent entry.
  const parsed = reader.parseModulesYaml(FIXTURE_V68);
  const wdsRaw = parsed.find(m => m.code === 'wds');
  assert.ok(wdsRaw, 'wds must be present in the v6.8.0 registry');
  assert.strictEqual(wdsRaw.type, 'bmad-org', 'wds must carry type: bmad-org at v6.8.0');
  assert.strictEqual(wdsRaw.url, 'https://github.com/bmad-code-org/bmad-method-wds-expansion');
});

// FR75. wds IS an active bmad-org entry in the registry (the test above pins
// that), and gds likewise; neither is bundled, and the reason is the allowlist
// alone. Stated as a normalization assertion rather than a manifest one so it
// fails on the code path, not just on the shipped artifact.
test('FR75: gds and wds normalize away despite being live, unflagged bmad-org entries', () => {
  const parsed = reader.parseModulesYaml(FIXTURE_V68);
  for (const code of ['gds', 'wds']) {
    const raw = parsed.find(m => m.code === code);
    assert.ok(raw, `fixture precondition: ${code} is present in the registry`);
    assert.strictEqual(raw.type, 'bmad-org',
      `fixture precondition: ${code} is an ordinary bmad-org module`);
  }
  const out = reader.normalizeModules(parsed).map(m => m.code);
  assert.ok(!out.includes('gds'), `gds must not be bundled (FR75); got: ${out.join(', ')}`);
  assert.ok(!out.includes('wds'), `wds must not be bundled (FR75); got: ${out.join(', ')}`);
});

test('AC4: bundled set is exactly tea/bmb/cis; automator/bmm/core absent', () => {
  // The full bundled-set assertion for the externally-cloned modules: the three
  // allowlisted codes present, experimental automator absent, and the built-in
  // bmm/core absent (never in the registry). Also pin KNOWN_BUNDLED_MODULES so a
  // future edit to the bundled set is caught here too.
  const codes = reader.normalizeModules(reader.parseModulesYaml(FIXTURE_V68)).map(m => m.code).sort();
  for (const required of ['tea', 'bmb', 'cis']) {
    assert.ok(codes.includes(required), `bundled set missing ${required}; got: ${codes.join(', ')}`);
  }
  assert.ok(!codes.includes('automator'), 'automator (experimental) must be absent from the bundled set');
  assert.ok(!codes.includes('bmm'), 'bmm (built-in) must be absent from the externally-cloned set');
  assert.ok(!codes.includes('core'), 'core (built-in) must be absent from the externally-cloned set');
  assert.deepStrictEqual([...reader.KNOWN_BUNDLED_MODULES].sort(), ['bmb', 'cis', 'tea'],
    'KNOWN_BUNDLED_MODULES must stay aligned with the bundled set the cache build guards on');
});

test('AC3/NFR56: a deficient bmad-org set exits non-zero and writes NO cache-manifest.json', () => {
  // Thin-cache fail-loud regression: drive the negative path with a FIXTURE that
  // resolves a single bmad-org module (a deficient set) against a fake
  // bmad-method package — never a genuinely broken install, never the network.
  // The real script runs end-to-end via spawn and must abort BEFORE writing any
  // manifest so a partial/empty cache cannot ship looking successful.
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
    assert.notStrictEqual(result.code, 0,
      `expected non-zero exit on a thin set, got ${result.code}. stderr:\n${result.stderr}`);
    assert.ok(/thin module set|Missing:/i.test(result.stderr),
      `expected an actionable thin-cache message, got:\n${result.stderr}`);
    const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
    assert.ok(!fs.existsSync(manifestPath),
      `fail-loud path must NOT leave a partial cache-manifest.json (found ${manifestPath})`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('AC3/AC5/NFR56: a missing relocated YAML (registry moved again) exits non-zero, no manifest', () => {
  // The other half of the recurring-relocation risk: the package-root YAML is
  // gone (the path moved a third time / downgrade below 6.8.0) and no candidate
  // resolves. The build must abort with an actionable message and write nothing —
  // exercised against a fake package with NO registry file, fully offline.
  const { tmpRoot, scriptPath, env } = makeFakeBmadEnv(null);
  try {
    const result = runScript(scriptPath, env);
    assert.notStrictEqual(result.code, 0,
      `expected non-zero exit when no registry resolves, got ${result.code}. stderr:\n${result.stderr}`);
    assert.ok(/no module registry YAML found|bmad-modules\.yaml/i.test(result.stderr),
      `expected a 'registry not found' message, got:\n${result.stderr}`);
    const manifestPath = path.join(tmpRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
    assert.ok(!fs.existsSync(manifestPath), 'no manifest must be written when the registry is missing');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('cache-manifest.json exists and records bmadMethodVersion 6.10.0', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(fs.existsSync(manifestPath), `Manifest not found at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.bmadMethodVersion, '6.10.0');
});

test('cache-manifest.json registrySchema is unchanged (package-root-v68) at v6.10.0', () => {
  // P5-8: the registry path/schema did not move at v6.10.0, so the schema tag the
  // reader stamps is carried forward verbatim — a drift here would signal the
  // reader resolved a different (relocated) source.
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.registrySchema, 'package-root-v68');
});

test('cache-manifest.json contains EXACTLY the three allowlisted modules — bmad-loop absent', () => {
  // The concrete end-to-end proof for this story: at v6.10.0 the manifest built
  // from the LIVE registry must resolve to exactly the closed allowlist, with
  // the new bmad-loop module excluded (never force-bundled/installed-by-default
  // on an air-gapped machine).
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const codes = Object.keys(manifest.modules).filter(c => !manifest.modules[c].retiredUpstream).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'tea'],
    `expected exactly the three allowlisted modules (bmad-loop must be absent); got: ${codes.join(', ')}`);
  assert.ok(!('bmad-loop' in manifest.modules), 'bmad-loop must never appear in cache-manifest.json');
  for (const code of ['gds', 'wds']) {
    assert.ok(!(code in manifest.modules),
      `FR75: ${code} must not appear in cache-manifest.json, retained or otherwise`);
  }
});

test('each cached module has a commit SHA in manifest', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [code, info] of Object.entries(manifest.modules)) {
    assert.ok(info.commitSha, `Module ${code} missing commitSha`);
    assert.ok(info.commitSha.match(/^[a-f0-9]+$/), `Module ${code} has invalid SHA: ${info.commitSha}`);
  }
});

test('all non-retired cached modules have _git_preserved directory', () => {
  // Read module codes from the manifest rather than hardcoding so the test
  // adapts automatically when upstream adds or renames modules. Exclude
  // entries flagged retiredUpstream — those are preserved as-is and may lag
  // behind a current rebuild.
  const cacheDir = path.join(projectRoot, 'lib', 'bmad-cache');
  const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, 'cache-manifest.json'), 'utf8'));
  const liveModules = Object.entries(manifest.modules || {})
    .filter(([, info]) => !info.retiredUpstream)
    .map(([code]) => code);
  assert.ok(liveModules.length > 0, 'Manifest has no non-retired modules — did the cache build fail?');
  for (const mod of liveModules) {
    const preserved = path.join(cacheDir, mod, '_git_preserved');
    assert.ok(fs.existsSync(preserved), `${mod} missing _git_preserved at ${preserved}`);
  }
});

// NOTE (Story 27.3, AC2): the former `'retired upstream modules (e.g. wds) are
// flagged in manifest when retained'` test was REMOVED here. It pinned the
// pre-6.8.0 reality (wds retired upstream, retained with retiredUpstream: true
// in the live 6.6.0 manifest). At v6.8.0 wds is a normal live `type: bmad-org`
// clone, not a retained relic, so that assertion is inverted by the
// fixture-driven 'AC2/AC4: wds is bundled — a normal bmad-org clone, not a
// retained relic' test in the Task 2 section above. Keeping the old test would
// directly contradict the inverted one, so it is retired together with the
// reality it described.

// ---- Task 3: bmad.js CLI compatibility ----

console.log('\nTask 3: bmad.js CLI compatibility');

const bmad = require('../lib/bmad');

test('BMAD_TARGET_VERSION lockstep with the pinned dependency (6.10.0)', () => {
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(/BMAD_TARGET_VERSION\s*=\s*'6\.10\.0'/.test(bmadSource),
    'BMAD_TARGET_VERSION in lib/bmad.js must read 6.10.0 in lockstep with the package.json pin');
});

test('getBmadCommand resolves bmad-cli.js from 6.10.0', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('bmad-cli.js'), `Expected bmad-cli.js path in: ${result}`);
  assert.ok(result.startsWith('node "'), `Expected node command prefix: ${result}`);
});

test('buildBmadArgs generates valid --action update flag', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm', 'bmb'],
    tools: ['claude-code'],
    action: 'update',
  });
  assert.ok(result.includes('--action update'), `Expected --action update in: ${result}`);
});

// Helper: locate the CLI install command across both the legacy and v6.6.0
// layouts so the flag-existence checks below survive minor reorganizations
// within bmad-method itself.
function readInstallCommand() {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const candidates = [
    path.join(bmadDir, 'tools', 'installer', 'commands', 'install.js'),
    path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, content: fs.readFileSync(candidate, 'utf8') };
    }
  }
  throw new Error(`install.js not found in any known location: ${candidates.join(', ')}`);
}

test('6.10.0 CLI accepts --directory flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--directory'), '6.10.0 install.js missing --directory flag');
});

test('6.10.0 CLI accepts --modules flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--modules'), '6.10.0 install.js missing --modules flag');
});

test('6.10.0 CLI accepts --tools flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--tools'), '6.10.0 install.js missing --tools flag');
});

test('6.10.0 CLI accepts the current custom-module flag', () => {
  // bmad-method 6.3.0 renamed --custom-content to --custom-source.
  // Accept either so the test survives both versions during bisects and
  // documents the rename.
  const { content } = readInstallCommand();
  const hasFlag = content.includes('--custom-source') || content.includes('--custom-content');
  assert.ok(hasFlag, '6.10.0 install.js missing both --custom-source and --custom-content flags');
});

test('buildBmadArgs uses --custom-source on v6.10.0 (was --custom-content on v6.2.x)', () => {
  // Verify the dynamic flag resolver picks the right name for the installed
  // bmad-method. On v6.10.0 it must be --custom-source; on v6.2.x it stays
  // --custom-content. This is what makes ma-agents' staged plugin install work.
  const flag = bmad.resolveCustomContentFlag();
  assert.ok(['--custom-source', '--custom-content'].includes(flag),
    `Unexpected flag returned: ${flag}`);
  // Since we pin 6.10.0 in this repo, assert the specific value:
  assert.strictEqual(flag, '--custom-source',
    `Expected --custom-source for bmad-method 6.10.0, got ${flag}`);
});

test('6.10.0 CLI accepts --action flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--action'), '6.10.0 install.js missing --action flag');
});

test('6.10.0 CLI accepts --yes flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--yes'), '6.10.0 install.js missing --yes flag');
});

test('6.10.0 CLI accepts --user-name flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--user-name'), '6.10.0 install.js missing --user-name flag');
});

test('6.10.0 CLI accepts --communication-language flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--communication-language'), '6.10.0 install.js missing --communication-language flag');
});

test('6.10.0 CLI accepts --document-output-language flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--document-output-language'), '6.10.0 install.js missing --document-output-language flag');
});

test('6.10.0 CLI accepts --output-folder flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--output-folder'), '6.10.0 install.js missing --output-folder flag');
});

test('module.yaml custom-content format is still referenced by 6.10.0 installer', () => {
  // 6.3.0 consolidated the custom-module flow into
  // tools/installer/modules/custom-module-manager.js (the legacy
  // tools/cli/installers/lib/custom/handler.js was removed). This structure
  // is unchanged through 6.10.0. Verify the entry point still references
  // module.yaml so the extension ma-agents ships
  // (lib/bmad-extension/skills/module.yaml) is still a valid custom module
  // payload.
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const candidates = [
    path.join(bmadDir, 'tools', 'installer', 'modules', 'custom-module-manager.js'),
    path.join(bmadDir, 'tools', 'installer', 'installers', 'lib', 'custom', 'handler.js'),
    path.join(bmadDir, 'tools', 'cli', 'installers', 'lib', 'custom', 'handler.js'),
  ];
  let found = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      if (content.includes('module.yaml')) {
        found = candidate;
        break;
      }
    }
  }
  assert.ok(found, `No known custom-module entry references module.yaml. Checked: ${candidates.join(', ')}`);
});

// ---- Task 4: prePopulateBmadCache compatibility ----

console.log('\nTask 4: prePopulateBmadCache compatibility');

test('prePopulateBmadCache is exported', () => {
  assert.strictEqual(typeof bmad.prePopulateBmadCache, 'function');
});

test('prePopulateBmadCache source handles all cache modules dynamically', () => {
  // The function iterates fs.readdir(cacheSource) and handles any number of
  // modules, so it automatically absorbs registry changes (fewer, renamed, or
  // added modules like bmad-loop) without code changes — the allowlist in
  // build-bmad-cache.js is what decides what ends up in the cache dir at all.
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('fs.readdir(cacheSource)'), 'prePopulateBmadCache should iterate cache directory');
  assert.ok(!bmadSource.includes("['bmb',"), 'prePopulateBmadCache should not hardcode module list');
});

test('restoreGitDir logic exists in bmad.js', () => {
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('restoreGitDir'), 'Missing restoreGitDir function');
  assert.ok(bmadSource.includes('_git_preserved'), 'Missing _git_preserved reference');
  assert.ok(bmadSource.includes('file://'), 'Missing file:// URL for offline fetch');
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
