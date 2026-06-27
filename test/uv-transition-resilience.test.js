#!/usr/bin/env node
/**
 * Tests for Story 28.2: uv-Transition Resilience and Python-Scoping Guardrails
 * (FR212, FR213, NFR59 a/b/c — Architecture Decision P5-6).
 *
 * BMAD v6.9.0 replaced the installer's legacy `python3`-presence probe with a
 * `uv` environment check that is WARN-DON'T-BLOCK: it emits a "uv recommended"
 * banner and new stdout text, but adds no CLI flags and leaves all exit codes
 * unchanged — the install proceeds when `uv` is absent. These are REGRESSION
 * GUARDS proving a standing negative; there is NO production behavior change.
 *
 *   AC1/NFR59a — ma-agents' install/update success-or-failure decision rides on
 *     whether the shared `runCommand` primitive THROWS on a non-zero exit (the
 *     `execSync` exit status), never on parsing installer stdout. A uv-missing
 *     warning (exit 0) is therefore non-fatal. Tested against the REAL exported
 *     `runCommand` — not the dead offline/EBUSY classifiers, which are off the
 *     live path (their sole caller `applyCustomizations()` was removed in 22.6).
 *
 *   AC2/NFR59b — no `lib/` code path greps installer stdout for the retired
 *     `python3`-probe text or for the new `uv` banner. Proven two ways: the
 *     exported classifiers ignore a uv/python3 banner, and no ma-agents `lib`
 *     JS source contains the probe-banner needle strings.
 *
 *   AC3/NFR59c — ma-agents CONTROL-PLANE Python (its own `lib`/`scripts`/`bin`
 *     code and the activation steps that invoke
 *     `python3 {project-root}/_bmad/scripts/resolve_customization.py`) stays on
 *     the `python`/`python3` interpreter and is never migrated to `uv run`.
 *
 * PYTHON-vs-UV SCOPING BOUNDARY (AC4 — read this before touching anything Python):
 *   BMAD's `uv` standardization governs BMAD-INSTALLED skill scripts, which
 *   ma-agents neither owns nor modifies (they live under vendored
 *   `lib/bmad-cache/**` and `node_modules/bmad-method/**` — and yes, upstream
 *   bmb content already uses `uv run resolve_customization.py`; that is BMAD's
 *   call, not ours). ma-agents control-plane Python stays on `python`/`python3`
 *   so the air-gapped install surface (NFR58) never gains a `uv` runtime
 *   dependency. The ONLY ma-agents-owned `uv run` usage is the `ml-experiment` /
 *   `ml-infra` / `ml-eda` skills, which run the USER's ML-project scripts in the
 *   user's own `uv` env — a deliberate exception, not control-plane tooling.
 *   See Architecture Decision P5-6(c) / FR213.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bmad = require('../lib/bmad');

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

// Recursively collect files under `dir` matching `extPredicate`, skipping any
// path segment in `skipDirs`. Returns absolute paths. Missing dir → [].
function walk(dir, extPredicate, skipDirs = new Set()) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), extPredicate, skipDirs));
    } else if (extPredicate(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// A representative v6.9.0 uv-check banner (warn-only path) — wording mirrors the
// installer's `uv-check.js` ("uv not found on PATH" + a "uv recommended" note);
// the exact upstream phrasing is NOT load-bearing here (AC1 proves the decision
// is the exit code, AC2 only needs representative needle strings). If ma-agents
// ever started parsing installer stdout, these are the strings it would key on —
// so they must NOT appear in ma-agents lib source, and the classifiers must
// ignore them.
const UV_BANNER =
  'uv not found on PATH. uv is becoming the de facto standard Python runner for BMAD. uv recommended.';
const PROBE_NEEDLES = ['uv recommended', 'uv not found', 'uv run', 'python3 detected', 'python3 not found'];

console.log('\nStory 28.2: uv-Transition Resilience and Python-Scoping Guardrails\n');

// ───────────────────────────────────────────────────────────────────────────
// AC1 / NFR59a — uv-missing is non-fatal: the decision rides on the exit code
// ───────────────────────────────────────────────────────────────────────────
console.log('AC1/NFR59a: install decision keys off exit code, not the uv banner');

const NODE = process.execPath;

// Write a throwaway node script that emits the uv banner then exits with `code`,
// and return a shell command that runs it. A temp FILE (not `node -e`) keeps the
// banner's quotes/emoji/backticks away from cross-platform shell quoting.
function bannerScriptCommand(tmpDir, code) {
  const file = path.join(tmpDir, `uv-banner-exit-${code}.js`);
  const body =
    `const b = ${JSON.stringify(UV_BANNER)};\n` +
    `process.stdout.write(b);\n` +
    `process.stderr.write(b);\n` +
    `process.exit(${code});\n`;
  fs.writeFileSync(file, body);
  return `${JSON.stringify(NODE)} ${JSON.stringify(file)}`;
}

test('runCommand does NOT throw when a command emits the uv-missing banner and exits 0', () => {
  // Simulates the v6.9.0 warn-only path: installer prints the "uv recommended"
  // banner to BOTH streams then exits 0. The real install/update success path
  // is "runCommand did not throw" — so this MUST not throw.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-resil-'));
  try {
    assert.doesNotThrow(
      () => bmad.runCommand(bannerScriptCommand(tmp, 0)),
      'a uv-missing warning with exit 0 must be treated as success (warn-don\'t-block)'
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('runCommand THROWS on a non-zero exit even with identical banner text on stdout', () => {
  // Proves the decision is the EXIT CODE, not the banner: same uv text, exit 1.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-resil-'));
  try {
    assert.throws(
      () => bmad.runCommand(bannerScriptCommand(tmp, 1)),
      'a non-zero exit must propagate as a thrown error regardless of stdout text'
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// AC2 / NFR59b — no live path greps installer stdout for the probe/uv banner
// ───────────────────────────────────────────────────────────────────────────
console.log('\nAC2/NFR59b: no ma-agents lib path parses installer stdout for python3/uv');

test('the offline/EBUSY classifiers ignore a uv-missing / python3 banner (no false positive)', () => {
  // The only installer-output classifiers match network/EBUSY substrings ONLY.
  // Feeding them the uv banner must NOT classify it as an offline or EBUSY
  // failure — confirming they react to neither `uv` nor `python3` text.
  const bannerErr = { message: UV_BANNER, stdout: UV_BANNER, stderr: UV_BANNER };
  assert.strictEqual(bmad.looksLikeOfflineFailure(bannerErr), false,
    'uv/python3 banner must not be misread as an offline failure');
  assert.strictEqual(bmad.looksLikeEbusyFailure(bannerErr), false,
    'uv/python3 banner must not be misread as an EBUSY failure');
});

test('no ma-agents lib JS source greps installer stdout for the probe/uv banner needles', () => {
  // Repo-wide grep proving the standing negative. Scope: ma-agents-OWNED lib JS
  // only — exclude vendored bmad-cache and the generated plugin bundle.
  const libFiles = walk(
    path.join(projectRoot, 'lib'),
    (n) => n.endsWith('.js'),
    new Set(['bmad-cache', 'bmad-extension-plugin', 'node_modules'])
  );
  assert.ok(libFiles.length > 0, 'expected to scan some lib JS files');
  const offenders = [];
  for (const f of libFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const needle of PROBE_NEEDLES) {
      if (src.includes(needle)) {
        offenders.push(`${path.relative(projectRoot, f)} contains "${needle}"`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    `no ma-agents lib JS may reference installer stdout banner text. Offenders:\n  ${offenders.join('\n  ')}`);
});

// ───────────────────────────────────────────────────────────────────────────
// AC3 / NFR59c — control-plane Python stays on python/python3, never `uv run`
// ───────────────────────────────────────────────────────────────────────────
console.log('\nAC3/NFR59c: control-plane Python stays on python/python3 (ml-* skills exempted)');

// The deliberate, documented exception: these ma-agents-owned skills run the
// USER's ML-project scripts via `uv run python` in the user's own uv env.
const ML_UV_EXCEPTION = new Set(['ml-experiment', 'ml-infra', 'ml-eda']);

test('ma-agents control-plane code (lib JS, scripts/, bin/) contains no `uv run`', () => {
  const skip = new Set(['bmad-cache', 'bmad-extension-plugin', 'node_modules']);
  const files = [
    ...walk(path.join(projectRoot, 'lib'), (n) => n.endsWith('.js'), skip),
    ...walk(path.join(projectRoot, 'scripts'), (n) => n.endsWith('.js'), skip),
    ...walk(path.join(projectRoot, 'bin'), (n) => n.endsWith('.js'), skip),
  ];
  const offenders = files
    .filter((f) => fs.readFileSync(f, 'utf8').includes('uv run'))
    .map((f) => path.relative(projectRoot, f));
  assert.deepStrictEqual(offenders, [],
    `control-plane code must invoke python/python3 directly, never \`uv run\`. Offenders: ${offenders.join(', ')}`);
});

test('the only ma-agents-owned skills using `uv run` are the documented ml-* exception', () => {
  // Scan ma-agents-owned skill source (lib/bmad-extension/skills) — NOT vendored
  // bmad-cache. Any `uv run` must belong to ml-experiment/ml-infra/ml-eda.
  const skillsRoot = path.join(projectRoot, 'lib', 'bmad-extension', 'skills');
  const mdFiles = walk(skillsRoot, (n) => n.endsWith('.md'));
  const offenders = [];
  for (const f of mdFiles) {
    if (!fs.readFileSync(f, 'utf8').includes('uv run')) continue;
    const rel = path.relative(skillsRoot, f);
    const skillDir = rel.split(path.sep)[0];
    if (!ML_UV_EXCEPTION.has(skillDir)) {
      offenders.push(rel);
    }
  }
  assert.deepStrictEqual(offenders, [],
    `only the ml-* exception skills may use \`uv run\`; unexpected control-plane uv usage in: ${offenders.join(', ')}`);
});

test('vendored passthrough (lib/bmad-cache) is explicitly OUT of scope for the python/uv guard', () => {
  // Documents the boundary as an assertion: ma-agents does not own and does not
  // police BMAD-installed skill scripts. (Upstream bmb content already uses
  // `uv run resolve_customization.py` — that is BMAD's decision.) This test
  // exists so a future reader understands the guard above is intentionally
  // scoped, not an oversight.
  const cacheDir = path.join(projectRoot, 'lib', 'bmad-cache');
  // Sanity: the vendored tree exists and is the thing we exclude.
  assert.ok(fs.existsSync(cacheDir), 'vendored bmad-cache should exist (built by build:bmad-cache)');
});

// ───────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
