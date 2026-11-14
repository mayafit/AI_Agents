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
 *   FR304 (Story 36.3, Decision P5-11.6) — uv EXECUTION RULE, replacing the
 *     former NFR59c "no `uv run` anywhere in lib/scripts/bin" rule: the 4.x
 *     installer runs `setup.py` through uv, so the rule is about WHERE uv is
 *     executed. Installer JavaScript spawns uv only through one runner module,
 *     `lib/runtime/uv.js`, always as `uv run --no-cache` with an argv array. The
 *     guard fails on any spawn / exec / execFile / execSync call (and their
 *     Sync variants) whose command or argv names uv outside that module, and on
 *     a spawn inside the module whose argv does not start with
 *     `'run', '--no-cache'`. Message strings that merely mention `uv run` pass.
 *
 * PYTHON-vs-UV SCOPING BOUNDARY (AC4 — read this before touching anything Python):
 *   BMAD's `uv` standardization governs BMAD-INSTALLED skill scripts, which
 *   ma-agents neither owns nor modifies (they live under vendored
 *   `lib/bmad-cache/**` and `node_modules/bmad-method/**`). Offline, uv and its
 *   Python come from the bundle (P5-11.6), never from the network (NFR58).
 *
 *   Story 30.4 / FR247 — the former `uv run` exception scoped to the
 *   `ml-experiment` / `ml-infra` / `ml-eda` skills (which ran the USER's
 *   ML-project scripts in the user's own `uv` env) is REMOVED along with those
 *   skills: Demerzel (`ma-agent-ml` + the 12 `ml-*` skills) is deprecated and
 *   no longer ships for new installs, so there is no remaining ma-agents-owned
 *   skill with a legitimate `uv run` use. The guard below now asserts NO
 *   ma-agents-owned skill uses `uv run`, full stop. See Architecture Decision
 *   P5-6(c) / FR213 for the (now-historical) exception this simplifies.
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
console.log('\nFR304: uv is executed only through lib/runtime/uv.js, always `run --no-cache` (P5-11.6)');

const UV_RUNNER = 'lib/runtime/uv.js';
const EXEC_CALL_RE = /(?<![\w$])(spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(/g;

// Source with comments blanked (strings and template literals kept), so a
// comment that quotes a call is not a call. Regex literals are not parsed; a
// false positive here is loud and fixable, a false negative is not.
function blankComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && n === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1;
    } else { out += c; i++; }
  }
  return out;
}

// The text between the call's `(` and its matching `)`, skipping strings.
function callArgsText(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      i = j;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return src.slice(openParen + 1, i);
  }
  return src.slice(openParen + 1);
}

// Does a call's argument text name uv as a command or argv element? A string
// literal whose words include `uv` / `uv.exe` / a path ending in it, or an
// identifier `uv` / `uvSomething` (e.g. `uvPath`).
function namesUv(argText) {
  const strings = [];
  const code = argText.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, (_, q, body) => { strings.push(body); return ' "" '; });
  if (strings.some((s) => /(^|[\s/\\])uv(\.exe)?(?=$|\s)/.test(s))) return true;
  return /(?<![\w$.])uv(?:[A-Z_]\w*)?(?![\w$])/.test(code);
}

// FR304 problems in one source file (relative `/` path); empty when it complies.
function uvExecutionProblems(src, rel) {
  const text = blankComments(src);
  const problems = [];
  const isRunner = rel === UV_RUNNER;
  let calls = 0;
  for (const m of text.matchAll(EXEC_CALL_RE)) {
    const args = callArgsText(text, m.index + m[0].length - 1);
    const line = text.slice(0, m.index).split('\n').length;
    if (isRunner) {
      calls++;
      if (!/^[^,]*,\s*\[\s*(['"])run\1\s*,\s*(['"])--no-cache\2/.test(args)) {
        problems.push(`${rel}:${line} ${m[1]}(…) does not pass an argv array starting 'run', '--no-cache'`);
      }
      if (/shell\s*:\s*true/.test(args)) problems.push(`${rel}:${line} ${m[1]}(…) uses a shell`);
    } else if (namesUv(args)) {
      problems.push(`${rel}:${line} ${m[1]}(…) executes uv outside ${UV_RUNNER}`);
    }
  }
  if (isRunner && calls === 0) problems.push(`${rel} spawns nothing; it must be the uv execution site`);
  return problems;
}

test('FR304 guard (fixtures): execSync(\'uv run x.py\') outside the runner fails; a message mentioning uv run passes', () => {
  assert.strictEqual(uvExecutionProblems("const cp = require('child_process');\ncp.execSync('uv run x.py');\n", 'lib/other.js').length, 1);
  assert.strictEqual(uvExecutionProblems("spawnSync(uvPath, ['run', 'x.py']);\n", 'lib/other.js').length, 1);
  assert.strictEqual(uvExecutionProblems("execFile('C:\\\\rt\\\\uv.exe', ['run', 'x.py'], cb);\n", 'scripts/x.js').length, 1);
  assert.deepStrictEqual(uvExecutionProblems("console.log('run it with uv run x.py');\n", 'lib/other.js'), []);
  assert.deepStrictEqual(uvExecutionProblems("// execSync('uv run x.py')\nexecSync('git status');\n", 'lib/other.js'), []);
  assert.deepStrictEqual(uvExecutionProblems("/regex/.exec(line); spawnSync('node', ['--version']);\n", 'bin/x.js'), []);
});

test('FR304 guard (fixtures): a runner spawn without --no-cache, or with a shell, fails', () => {
  assert.strictEqual(uvExecutionProblems("spawn(uv, ['run', ...argv], {});\n", UV_RUNNER).length, 1);
  assert.strictEqual(uvExecutionProblems("spawn(uv, ['run', '--no-cache', ...argv], { shell: true });\n", UV_RUNNER).length, 1);
  assert.strictEqual(uvExecutionProblems("spawn(uv, `run --no-cache ${a}`);\n", UV_RUNNER).length, 1);
  assert.deepStrictEqual(uvExecutionProblems("spawn(uv, ['run', '--no-cache', ...argv], { shell: false });\n", UV_RUNNER), []);
});

test('FR304: no uv execution site in lib/, scripts/, bin/ outside lib/runtime/uv.js, and the runner always passes run --no-cache', () => {
  const skip = new Set(['bmad-cache', 'bmad-extension-plugin', 'node_modules']);
  const isJs = (n) => /\.(c|m)?js$/.test(n);
  const files = [
    ...walk(path.join(projectRoot, 'lib'), isJs, skip),
    ...walk(path.join(projectRoot, 'scripts'), isJs, skip),
    ...walk(path.join(projectRoot, 'bin'), isJs, skip),
  ];
  const rels = files.map((f) => path.relative(projectRoot, f).split(path.sep).join('/'));
  assert.ok(rels.includes(UV_RUNNER), `the uv runner ${UV_RUNNER} must exist`);
  const problems = files.flatMap((f, i) => uvExecutionProblems(fs.readFileSync(f, 'utf8'), rels[i]));
  assert.deepStrictEqual(problems, [],
    `uv may be executed only through ${UV_RUNNER} as \`run --no-cache\` with an argv array (FR304). Problems:\n  ${problems.join('\n  ')}`);
});

test('FR304: runUv spawns uv with [run, --no-cache, ...argv], no shell, and rejects a non-array argv', () => {
  const { runUv } = require('../lib/runtime/uv');
  const calls = [];
  const fake = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: 'ok', stderr: '' }; };
  const r = runUv(['setup.py', '--project-root', 'a b'], { uv: '/rt/uv', spawnSync: fake, env: { UV_OFFLINE: '1' } });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(calls[0].cmd, '/rt/uv');
  assert.deepStrictEqual(calls[0].args, ['run', '--no-cache', 'setup.py', '--project-root', 'a b']);
  assert.strictEqual(calls[0].opts.shell, false);
  assert.strictEqual(calls[0].opts.env.UV_OFFLINE, '1');
  assert.throws(() => runUv('setup.py', { spawnSync: fake }), TypeError);
  assert.throws(() => runUv([], { spawnSync: fake }), TypeError);
});

test('no ma-agents-owned skill uses `uv run` (FR247 — the ml-* exception is gone along with ml-*)', () => {
  // Scan ma-agents-owned skill source (lib/bmad-extension/skills) — NOT vendored
  // bmad-cache. The ml-experiment/ml-infra/ml-eda skills that formerly carried
  // the sole `uv run` exception were removed in Story 30.4 (Demerzel
  // deprecation), so no remaining skill may use it.
  const skillsRoot = path.join(projectRoot, 'lib', 'bmad-extension', 'skills');
  const mdFiles = walk(skillsRoot, (n) => n.endsWith('.md'));
  const offenders = [];
  for (const f of mdFiles) {
    if (!fs.readFileSync(f, 'utf8').includes('uv run')) continue;
    offenders.push(path.relative(skillsRoot, f));
  }
  assert.deepStrictEqual(offenders, [],
    `no ma-agents-owned skill may use \`uv run\` post-Story-30.4; unexpected usage in: ${offenders.join(', ')}`);
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
