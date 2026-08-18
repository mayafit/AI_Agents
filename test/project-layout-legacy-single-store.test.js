#!/usr/bin/env node
/**
 * Story 31.7 (FR265, NFR82) — LEGACY SINGLE-STORE COMPATIBILITY, AND A MIGRATION
 * THAT IS OFFERED AND NEVER PERFORMED.
 *
 * WHAT THIS SUITE IS FOR. Every other suite in this epic proves something about
 * the TWO-store layout. This one proves the opposite property: that a project
 * configured before F26 keeps working with no action from its maintainer, is
 * TOLD once how to split it, and is NOT split until somebody asks.
 *
 * THE TWO ACs HERE ARE NEGATIVES, and negatives are where this epic's signature
 * defect lives — "a test that proves presence rather than the absence of anything
 * else". So:
 *
 *   - AC3 ("nothing is migrated unless asked") is proved by BYTE IDENTITY of the
 *     committed binding across a REAL `ma-agents install --yes`, a real
 *     `ma-agents config layout --yes`, and a real interactive wizard run — never
 *     by asserting that some function was not called. A not-called assertion
 *     would survive any refactor that moved the migration somewhere else.
 *   - AC5 ("the notice does not nag") asserts the SECOND run's output, not the
 *     first's. A test that only checks run 1 proves the notice appeared; it
 *     cannot tell "once" from "every time". Both runs are captured and both are
 *     asserted, in opposite directions.
 *
 * THE OTHER TRAP, and the reason several assertions here look roundabout: a
 * TAUTOLOGICAL test whose expectation comes from the same place as the code. So
 * the AC6 config.yaml claim ("the only additions are the stamp and the two
 * per-store fields") compares against a LITERAL three-element set written out in
 * this file, against a pre-F26 `config.yaml` fixture also written out by hand —
 * not against anything cli.js computes. If cli.js grows a fourth generated
 * field, this suite fails, which is the point.
 *
 * ORACLE. js-yaml, a declared direct dependency, wherever the subject is what
 * bytes reached `project-layout.yaml`. Hard dependency, not a soft one — the
 * per-record claims below would assert almost nothing without it.
 *
 * THE TEST COUNT IS PINNED IN BOTH DIRECTIONS (EXPECTED_TEST_COUNT). A suite that
 * silently stops running tests must fail, not pass.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// AC1 x4, detection x6, 31.4-agreement x4, AC2 x6, channel-separation x5,
// AC3 x4, AC4 x4, AC5 x4, AC6/NFR82 x7.
const EXPECTED_TEST_COUNT = 44;

let passed = 0;
let failed = 0;
const errors = [];

// THE BACKSTOP, ARMED BEFORE THE FIRST TEST RUNS. `collectRepoLayout`'s
// interactive branch still contains a bare `if (!mode) process.exit(0);`, and
// this suite drives that branch, so a mis-queued answer can kill the process
// mid-run. Registering this at the bottom would arm it only after everything it
// protects had already happened.
let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Something aborted the process ` +
    `mid-run. Forcing a non-zero exit so this cannot read as a pass.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ─── The prompts stub ────────────────────────────────────────────────────────
//
// Installed in the require cache BEFORE cli.js loads, so cli.js's own
// `require('prompts')` binds to it. Copied deliberately from
// project-layout-two-store-wizard.test.js: it NEVER answers a question it was
// not given an answer for, and never answers the WRONG question, because both
// mistakes otherwise surface as "the process aborted" rather than as a named
// failure.
const promptsModulePath = require.resolve('prompts');
require('prompts');
const promptLog = [];

function unexpectedPrompt(question) {
  throw new Error(
    `the wizard asked more questions than the test answered — unanswered prompt ` +
    `${JSON.stringify((question && question.name) || '(unnamed)')} ` +
    `(${JSON.stringify((question && question.message) || '')}).`
  );
}
function requireMatchingAnswer(question, answer) {
  const name = (question && question.name) || '(unnamed)';
  if (!answer || typeof answer !== 'object' || !(name in answer)) {
    throw new Error(
      `the queued answer ${JSON.stringify(answer)} does not answer prompt ${JSON.stringify(name)} ` +
      `(${JSON.stringify((question && question.message) || '')}) — the wizard asked a different ` +
      `question than the queue expected, in a different order, or with a different name.`
    );
  }
  return answer;
}
let promptAnswer = unexpectedPrompt;
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  promptLog.push(question);
  return promptAnswer(question);
};

// ─── Load module ─────────────────────────────────────────────────────────────
let cli;
try {
  cli = require('../bin/cli.js');
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}
const {
  detectLegacySingleStore, showLegacySingleStoreNoticeOnce, resolveProjectTopology,
  writeProjectLayoutYaml, collectRepoLayout, readExistingLayout, generateBmmConfig,
  canonicalBindingBytes, readProjectLayoutStamp, computeProjectLayoutStamp,
  PROJECT_LAYOUT_SCHEMA_VERSION, LEGACY_TWO_STORE,
  LEGACY_SINGLE_STORE_NOTICE_ID, LEGACY_SINGLE_STORE_SPLIT_COMMAND,
  LEGACY_SINGLE_STORE_NOTICE_FACT_1, LEGACY_SINGLE_STORE_NOTICE_FACT_2,
  LEGACY_SINGLE_STORE_NOTICE_FACT_3,
  BINDING_UNBOUND, BINDING_UNREADABLE, BINDING_INVALID, BINDING_TOO_NEW,
  STAMP_ABSENT,
} = cli;

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('\n  FATAL: js-yaml is unavailable, and this suite\'s YAML oracle is not optional.');
  console.error(' ', e.message);
  process.exit(1);
}

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
// Newline-normalised: the working tree is CRLF on Windows and LF on CI, and a
// source-level anchor matching only one of them is a test that silently stops
// asserting on the other platform — this epic's signature defect.
const CLI_SOURCE = fs.readFileSync(CLI_PATH, 'utf-8').replace(/\r\n/g, '\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTmpDir() {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-legacy-')));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  return {
    tmpDir,
    cleanup() { process.chdir(origCwd); fs.rmSync(tmpDir, { recursive: true, force: true }); },
  };
}

function layoutPathOf(root) {
  return path.join(root, '_bmad-output', 'project-layout.yaml');
}

/**
 * A pre-F26 `project-layout.yaml`: NO `schema_version:` line, one
 * `knowledgebase:` record. This is the FR122 / Story 16.2 shape, written out
 * literally rather than produced by cli.js — a fixture generated by the code
 * under test could not detect the code forgetting how to read the old shape.
 */
function writeLegacyLayout(root, { mode = 'same', kbPath = '.', sprintMode = 'same', sprintPath = '.' } = {}) {
  fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
  const content =
    '# Generated by ma-agents — do not edit manually\n' +
    'generated: "2026-03-28"\n' +
    'knowledgebase:\n' +
    `  mode: ${mode}\n` +
    `  path: ${JSON.stringify(kbPath)}\n` +
    'sprint_management:\n' +
    `  mode: ${sprintMode}\n` +
    `  path: ${JSON.stringify(sprintPath)}\n`;
  fs.writeFileSync(layoutPathOf(root), content, 'utf-8');
  return content;
}

/** A schema v2 file, for the NOT-legacy side of every discrimination test. */
function writeTwoStoreLayout(root, { systemPath = '.', softwarePath = '.' } = {}) {
  fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
  const modeFor = (p) => (p === '.' ? 'same' : 'local');
  const content =
    `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}\n` +
    'generated: "2026-08-15"\n' +
    'system_requirements_store:\n' +
    '  backend: file-system\n' +
    `  mode: ${modeFor(systemPath)}\n` +
    `  path: ${JSON.stringify(systemPath)}\n` +
    'software_requirements_store:\n' +
    '  backend: file-system\n' +
    `  mode: ${modeFor(softwarePath)}\n` +
    `  path: ${JSON.stringify(softwarePath)}\n` +
    'sprint_management:\n' +
    '  mode: same\n' +
    '  path: "."\n';
  fs.writeFileSync(layoutPathOf(root), content, 'utf-8');
  return content;
}

/**
 * A pre-F26 `_bmad/bmm/config.yaml`: the FR117 single `knowledgebase_path`, the
 * fields every skill reads today, some FOREIGN upstream-BMAD keys that ma-agents
 * does not own, and — deliberately — NONE of Story 31.4's three F26 marker
 * fields. Written literally, for the same reason as the layout fixture.
 */
function writeLegacyConfig(root, kbPath = '.') {
  fs.mkdirSync(path.join(root, '_bmad', 'bmm'), { recursive: true });
  const content =
    'user_name: "Legacy Maintainer"\n' +
    'output_folder: "{project-root}/docs"\n' +
    `knowledgebase_path: ${JSON.stringify(kbPath)}\n` +
    // Written by ma-agents since Story 16.1/16.2 — i.e. BEFORE F26 — so a genuine
    // pre-F26 config carries it. Omitting it here would have made AC6(c) report
    // it as an F26 addition, which it is not.
    'sprint_backend: "file-system"\n' +
    'sprint_management_path: "."\n' +
    `planning_artifacts: ${JSON.stringify(kbPath)}\n` +
    'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"\n';
  fs.writeFileSync(path.join(root, '_bmad', 'bmm', 'config.yaml'), content, 'utf-8');
  return content;
}

function configPathOf(root) { return path.join(root, '_bmad', 'bmm', 'config.yaml'); }

// Resolved store paths come back in this codebase's portable (forward-slash)
// form. Comparing a raw `path.resolve()` result would compare SEPARATORS rather
// than locations, and would pass on Linux while failing on Windows.
function assertSamePath(actual, expected, message) {
  assert.strictEqual(
    String(actual).replace(/\\/g, '/'),
    String(expected).replace(/\\/g, '/'),
    message
  );
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** sha256 over the full recursive contents AND path list of a directory tree. */
function sha256Tree(dir) {
  const acc = [];
  (function walk(d, rel) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { acc.push(`D ${r}`); walk(full, r); }
      else { acc.push(`F ${r} ${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`); }
    }
  })(dir, '');
  return crypto.createHash('sha256').update(acc.join('\n')).digest('hex');
}

/** Every `key:` at column 0 of a config.yaml, as a Set. */
function configFieldsAtColumnZero(content) {
  const out = new Set();
  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):/);
    if (m) out.add(m[1]);
  }
  return out;
}

function configFieldValue(content, field) {
  const m = content.replace(/\r\n/g, '\n').match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

function captureLog(fn) {
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try { fn(); } finally { console.log = origLog; }
  return lines.join('\n');
}

async function captureLogAsync(fn) {
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try { await fn(); } finally { console.log = origLog; }
  return lines.join('\n');
}

/**
 * A REAL, FULL `ma-agents install --yes` in a spawned process — not a call into
 * an exported helper.
 *
 * `--agent bmm-sre` is a BMAD-category agent, so `bmadTools` (built from
 * `category === 'ide'`) is empty and the installer skips the BMAD-METHOD
 * install/update entirely. That keeps this hermetic and offline while still
 * running the whole installWizard, INCLUDING Step 3.6 — `writeProjectLayoutYaml`
 * then `generateBmmConfig` then the legacy notice — which is the code under test.
 * The BMAD install itself is upstream's and is exercised elsewhere.
 *
 * `input: ''` with a piped stdin is load-bearing for AC6(a): a prompt would read
 * EOF and the run would not complete cleanly, so "it exited 0" is itself part of
 * the zero-prompts evidence.
 */
function runRealInstall(projectRoot, homeRoot, extraArgs = []) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^MA_(KNOWLEDGEBASE|SPRINT)_/.test(k)) delete env[k];
  }
  env.HOME = homeRoot;
  env.USERPROFILE = homeRoot;
  const res = spawnSync(
    process.execPath,
    [CLI_PATH, 'install', '--yes', '--agent', 'bmm-sre', ...extraArgs],
    { cwd: projectRoot, env, encoding: 'utf-8', input: '', stdio: ['pipe', 'pipe', 'pipe'], timeout: 600000 }
  );
  return {
    status: res.status,
    signal: res.signal,
    output: `${res.stdout || ''}\n${res.stderr || ''}`,
  };
}

/** A project root + a fake HOME, outside the repo, for a spawned install. */
function makeInstallBox() {
  const box = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-legacy-box-')));
  const projectRoot = path.join(box, 'proj');
  const homeRoot = path.join(box, 'home');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(homeRoot, { recursive: true });
  return {
    box, projectRoot, homeRoot,
    cleanup() { fs.rmSync(box, { recursive: true, force: true }); },
  };
}

async function runWizard(answers, existingLayout = null) {
  promptLog.length = 0;
  const queue = [...answers];
  promptAnswer = (q) => (queue.length ? requireMatchingAnswer(q, queue.shift()) : unexpectedPrompt(q));
  let layout;
  const origLog = console.log;
  console.log = () => {};
  try {
    layout = await collectRepoLayout({}, existingLayout);
  } finally {
    console.log = origLog;
    promptAnswer = unexpectedPrompt;
  }
  assert.strictEqual(queue.length, 0,
    `${queue.length} prepared answer(s) went unused — the wizard asked fewer questions than expected`);
  return { layout, questions: promptLog.map((q) => ({ name: q.name, message: q.message })) };
}

const ALL_DEFAULTS = [
  { backend: 'file-system' }, { mode: 'same' },
  { backend: 'file-system' }, { mode: 'same' },
  { mode: 'same' },
];

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — a pre-F26 layout resolves as BOTH stores pointing at the ONE location
// ═══════════════════════════════════════════════════════════════════════════

test('AC1 — a pre-F26 layout resolves ok, at schema 1, with both stores at the one location', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    const r = resolveProjectTopology(tmpDir);
    assert.strictEqual(r.ok, true, `a pre-F26 file must RESOLVE, not fault: ${JSON.stringify(r)}`);
    assert.strictEqual(r.topology.schemaVersion, 1,
      'an absent schema_version is schema 1 — the pre-F26 case');
    assert.deepStrictEqual(
      { m: r.topology.systemRequirementsStore.mode, p: r.topology.systemRequirementsStore.path },
      { m: r.topology.softwareRequirementsStore.mode, p: r.topology.softwareRequirementsStore.path },
      'AC1: both stores must point at the ONE legacy location'
    );
    assertSamePath(r.topology.systemRequirementsStore.path, path.resolve(tmpDir, '../kb'),
      'and that one location is the one the legacy file recorded');
  } finally { cleanup(); }
});

test('AC1 — the two resolved stores are SEPARATE objects, so a caller mutating one cannot move the other', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    const t = resolveProjectTopology(tmpDir).topology;
    assert.notStrictEqual(t.systemRequirementsStore, t.softwareRequirementsStore,
      'the collapse must copy, not alias — an alias makes "both point at one location" a ' +
      'shared mutable object, and one store\'s reconfiguration would silently move the other');
    t.softwareRequirementsStore.path = '/moved';
    assertSamePath(t.systemRequirementsStore.path, path.resolve(tmpDir, '../kb'),
      'mutating one store must not move the other');
  } finally { cleanup(); }
});

test('AC1 — every generated artifact path resolves to the one legacy location', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(tmpDir, '../kb');
    captureLog(() => generateBmmConfig({ projectRoot: tmpDir }));
    const c = fs.readFileSync(configPathOf(tmpDir), 'utf-8');
    for (const field of ['knowledgebase_path', 'system_requirements_path',
      'software_requirements_path', 'planning_artifacts']) {
      assert.strictEqual(configFieldValue(c, field), '"../kb"',
        `${field} must resolve to the ONE legacy location, not to a default`);
    }
    assert.strictEqual(configFieldValue(c, 'sprint_management_path'), '"."',
      'sprint management is a separate concern (FR112/FR267) and is unchanged');
  } finally { cleanup(); }
});

test('AC1 — a legacy layout with mode:same resolves both stores to the repository itself', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir);
    const t = resolveProjectTopology(tmpDir).topology;
    assert.strictEqual(t.systemRequirementsStore.mode, 'same');
    assert.strictEqual(t.softwareRequirementsStore.mode, 'same');
  } finally { cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION — by the ABSENCE of `schema_version`, never by field-name heuristics
// ═══════════════════════════════════════════════════════════════════════════

test('detection — an absent schema_version is legacy', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir);
    const d = detectLegacySingleStore(tmpDir);
    assert.strictEqual(d.legacy, true);
    assert.strictEqual(d.topology.schemaVersion, 1);
  } finally { cleanup(); }
});

test('detection — a current schema_version is NOT legacy, and says why by name', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeTwoStoreLayout(tmpDir);
    const d = detectLegacySingleStore(tmpDir);
    assert.strictEqual(d.legacy, false);
    assert.strictEqual(d.reason, LEGACY_TWO_STORE,
      'an already-split project is a NAMED non-legacy outcome, never lumped in with a fault');
  } finally { cleanup(); }
});

test('detection — schema_version ALONE decides it: two files with byte-identical field sets classify oppositely', () => {
  // THE ANTI-HEURISTIC TEST, and the direct pin on the story's technical note
  // ("detect by the ABSENCE of schema_version, not by heuristics over the field
  // names"). Both files below carry the SAME body: a `knowledgebase:` record AND
  // both per-store records AND sprint management. Every field name a heuristic
  // could key on is present in BOTH. The ONLY difference between them is the
  // `schema_version:` line, and they must classify oppositely.
  //
  // A detector keyed on "is `knowledgebase:` present?" calls both legacy. One
  // keyed on "are the per-store records missing?" calls neither legacy. Only the
  // schema_version rule gets this right.
  const a = withTmpDir();
  try {
    fs.mkdirSync(path.join(a.tmpDir, '_bmad-output'), { recursive: true });
    const body =
      'generated: "2026-08-15"\n' +
      'knowledgebase:\n  mode: same\n  path: "."\n' +
      'system_requirements_store:\n  backend: file-system\n  mode: same\n  path: "."\n' +
      'software_requirements_store:\n  backend: file-system\n  mode: same\n  path: "."\n' +
      'sprint_management:\n  mode: same\n  path: "."\n';

    fs.writeFileSync(layoutPathOf(a.tmpDir), body, 'utf-8');
    const withoutVersion = detectLegacySingleStore(a.tmpDir);

    fs.writeFileSync(layoutPathOf(a.tmpDir),
      `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}\n${body}`, 'utf-8');
    const withVersion = detectLegacySingleStore(a.tmpDir);

    assert.strictEqual(withoutVersion.legacy, true,
      'no schema_version ⇒ legacy, however many two-store field names are present');
    assert.strictEqual(withVersion.legacy, false,
      'a schema_version ⇒ not legacy, though the rest of the file is byte-identical');
  } finally { a.cleanup(); }
});

test('detection — `two stores at one location` on schema v2 is NOT legacy', () => {
  // The mirror of the test above: identical RESOLVED locations, current schema.
  // Detection keyed on "do the two stores agree?" would call this legacy.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeTwoStoreLayout(tmpDir, { systemPath: '.', softwarePath: '.' });
    assert.strictEqual(detectLegacySingleStore(tmpDir).legacy, false);
  } finally { cleanup(); }
});

test('detection — every resolver fault, and `unbound`, are NOT legacy and carry the resolver reason through', () => {
  const cases = [
    ['unbound (no file at all)', null, BINDING_UNBOUND],
    ['unreadable (not valid YAML)', 'knowledgebase:\n\tmode: same\n', BINDING_UNREADABLE],
    ['invalid (unknown backend)', 'knowledgebase:\n  backend: notion\n  mode: same\n  path: "."\n',
      BINDING_INVALID],
    ['too-new', `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION + 1}\nknowledgebase:\n  mode: same\n  path: "."\n`,
      BINDING_TOO_NEW],
  ];
  for (const [label, content, expectedReason] of cases) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      if (content !== null) {
        fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
        fs.writeFileSync(layoutPathOf(tmpDir), content, 'utf-8');
      }
      const d = detectLegacySingleStore(tmpDir);
      assert.strictEqual(d.legacy, false, `${label} must NOT read as legacy`);
      assert.strictEqual(d.reason, expectedReason,
        `${label}: the resolver's reason must be carried through verbatim, not flattened`);
      assert.ok(typeof d.message === 'string' && d.message.length > 0,
        `${label}: a fault must carry its message so a caller can report it`);
    } finally { cleanup(); }
  }
});

test('detection — a `too-new` file is never read as legacy even though it has no store records this build knows', () => {
  // Guards the specific degradation the epic keeps producing: a validation
  // falling through to the permissive branch. `too-new` has no
  // `system_requirements_store` this build will read, so a detector that asked
  // "did I fail to find two stores?" would call it legacy and print a notice
  // about a file it must refuse to touch.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
    fs.writeFileSync(layoutPathOf(tmpDir),
      `schema_version: 99\nfuture_store:\n  backend: whatever\n`, 'utf-8');
    const d = detectLegacySingleStore(tmpDir);
    assert.strictEqual(d.legacy, false);
    assert.strictEqual(d.reason, BINDING_TOO_NEW);
  } finally { cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGREEMENT WITH STORY 31.4's `absent`-vs-per-store-fields DISCRIMINATOR
//
// 31.4 decides "is this genuinely pre-F26?" ONLY in its Step P2 — the branch it
// reaches only when `project-layout.yaml` is ABSENT. There it corroborates an
// `absent` stamp against `system_requirements_path` / `software_requirements_path`
// in config.yaml, and HALTS when they are present. This story's detector must
// agree with that, not contradict it. It does so by being DISJOINT: it returns
// legacy:false for every non-ok resolve, so it never classifies a project 31.4
// classifies in P2.
// ═══════════════════════════════════════════════════════════════════════════

test('31.4 agreement — the project 31.4 HALTS on (no layout, but per-store fields in config) is NOT legacy here', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // No project-layout.yaml. A config.yaml carrying 31.4's discriminator fields
    // ⇒ 31.4 Step P2 says "this is NOT a pre-F26 project" and halts.
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(configPathOf(tmpDir),
      'knowledgebase_path: "."\nsystem_requirements_path: "."\nsoftware_requirements_path: "."\n',
      'utf-8');
    const d = detectLegacySingleStore(tmpDir);
    assert.strictEqual(d.legacy, false,
      'claiming legacy here would directly contradict 31.4, which halts on exactly this project');
    assert.strictEqual(d.reason, BINDING_UNBOUND);
  } finally { cleanup(); }
});

test('31.4 agreement — the project 31.4 calls genuinely pre-F26 (no layout, bare config) is ALSO not legacy here', () => {
  // 31.4 PROCEEDS silently here and says nothing about the binding. So must this
  // detector: a notice on a project 31.4 has decided to say nothing about would
  // be the two stories disagreeing about the same input.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyConfig(tmpDir, '../kb');
    const fields = configFieldsAtColumnZero(fs.readFileSync(configPathOf(tmpDir), 'utf-8'));
    for (const marker of ['project_layout_stamp', 'system_requirements_path', 'software_requirements_path']) {
      assert.ok(!fields.has(marker),
        `the pre-F26 config fixture must carry NONE of 31.4's three marker fields; found ${marker}`);
    }
    assert.strictEqual(detectLegacySingleStore(tmpDir).legacy, false);
  } finally { cleanup(); }
});

test('31.4 agreement — detection is disjoint from Step P2 by construction: legacy:true requires a RESOLVING layout file', () => {
  // The structural claim, asserted over the whole space of resolver outcomes
  // rather than over hand-picked examples: legacy:true is possible ONLY when
  // resolveProjectTopology returns ok, and Step P2 is reachable ONLY when it
  // does not. Therefore no project is classified by both.
  const corpus = [
    null,
    '',
    '# only a comment\n',
    'knowledgebase:\n  mode: same\n  path: "."\n',
    'knowledgebase:\n  mode: local\n  path: "../kb"\n',
    `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}\nsystem_requirements_store:\n  backend: file-system\n  mode: same\n  path: "."\nsoftware_requirements_store:\n  backend: file-system\n  mode: same\n  path: "."\n`,
    'knowledgebase:\n\tmode: same\n',
    'knowledgebase:\n  backend: notion\n  mode: same\n  path: "."\n',
    'schema_version: 999\n',
    'schema_version: abc\nknowledgebase:\n  mode: same\n  path: "."\n',
    'nothing: useful\n',
  ];
  let sawLegacy = false;
  for (const content of corpus) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      if (content !== null) {
        fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
        fs.writeFileSync(layoutPathOf(tmpDir), content, 'utf-8');
      }
      const d = detectLegacySingleStore(tmpDir);
      const r = resolveProjectTopology(tmpDir);
      if (d.legacy) {
        sawLegacy = true;
        assert.strictEqual(r.ok, true,
          `legacy:true for a binding the resolver does NOT resolve (${JSON.stringify(content)}) — ` +
          `that is 31.4's Step P2 territory and this detector must never enter it`);
      }
    } finally { cleanup(); }
  }
  assert.ok(sawLegacy, 'the corpus must contain at least one genuinely legacy case, or it proves nothing');
});

test('31.4 agreement — a legacy project after a real install carries a stamp, so 31.4 sees no drift and does not halt', () => {
  // The end-to-end corroboration. 31.4 keys on the resolver FIRST: a legacy file
  // resolves cleanly, so it takes Step P1 → P3, where it needs a stamp that
  // MATCHES. If this story's preservation branch left the config stamped for a
  // different binding, every skill on a legacy project would halt.
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const configContent = fs.readFileSync(configPathOf(box.projectRoot), 'utf-8');
    const stamp = readProjectLayoutStamp(configContent);
    assert.strictEqual(stamp.ok, true,
      `after an install the config must carry a usable stamp, not ${JSON.stringify(stamp)}`);
    assert.notStrictEqual(stamp.reason, STAMP_ABSENT);
    const topology = resolveProjectTopology(box.projectRoot).topology;
    assert.strictEqual(stamp.value, computeProjectLayoutStamp(topology, box.projectRoot),
      'the stamp must match the STILL-LEGACY binding — otherwise 31.4 reports drift on every ' +
      'skill activation of a legacy project, which is the loud/blocking channel this story ' +
      'must keep clear');
  } finally { box.cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — the notice: told once, non-blockingly, with the exact command
// ═══════════════════════════════════════════════════════════════════════════

test('AC2 — the notice prints on a legacy project and returns true', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    let result;
    const out = captureLog(() => { result = showLegacySingleStoreNoticeOnce(tmpDir); });
    assert.strictEqual(result, true);
    assert.ok(out.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_1), 'fact 1 (what this project is) missing');
    assert.ok(out.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_2), 'fact 2 (what that means) missing');
    assert.ok(out.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_3), 'fact 3 (the command) missing');
  } finally { cleanup(); }
});

test('AC2 — the notice names the EXACT command that splits the stores', () => {
  // Bound to the shipped constant AND to a literal, so neither a drifting
  // constant nor a loosened regex can let a wrong command through.
  assert.strictEqual(LEGACY_SINGLE_STORE_SPLIT_COMMAND, 'ma-agents config layout',
    'AC2 requires the EXACT command; this literal is the contract');
  assert.ok(LEGACY_SINGLE_STORE_NOTICE_FACT_3.includes(LEGACY_SINGLE_STORE_SPLIT_COMMAND),
    'the notice must actually contain the command, not merely allude to it');
  // …and that command must be a real dispatch target in cli.js, not a fabrication.
  assert.ok(/args\[1\] === 'layout'/.test(CLI_SOURCE) && /handleConfigLayout/.test(CLI_SOURCE),
    'the named command must resolve to a real `config layout` dispatch in bin/cli.js');
});

test('AC2 — the notice states what the legacy layout MEANS, naming both stores and their contents', () => {
  const text = `${LEGACY_SINGLE_STORE_NOTICE_FACT_1}\n${LEGACY_SINGLE_STORE_NOTICE_FACT_2}`;
  for (const phrase of ['system requirements store', 'software requirements store',
    'product brief', 'PRD', 'architecture', 'epics']) {
    assert.ok(text.includes(phrase),
      `AC2 requires the notice to say what the layout means; "${phrase}" is missing`);
  }
  assert.ok(/same one location/i.test(text) || /SAME one location/.test(text),
    'the notice must say the two stores resolve to the same one location');
});

test('AC2 — the notice reports the ACTUAL resolved location, not a placeholder', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    const out = captureLog(() => showLegacySingleStoreNoticeOnce(tmpDir));
    // Computed from the FIXTURE (tmpDir + the `../kb` it was written with), not
    // read back off the topology — an expectation taken from the same read the
    // notice uses would be tautological. Slashes are normalised because this
    // codebase renders stored paths in portable form.
    const expectedLocation = path.resolve(tmpDir, '../kb').replace(/\\/g, '/');
    assert.ok(out.replace(/\\/g, '/').includes(expectedLocation),
      `the notice must name where the one store actually is (expected ${expectedLocation}):\n${out}`);
    assert.ok(!/undefined/.test(out), `the notice must never render the literal "undefined":\n${out}`);
  } finally { cleanup(); }
});

test('AC2 — the notice does NOT print on a two-store, unbound, or faulted project', () => {
  const cases = [
    ['two-store', (d) => writeTwoStoreLayout(d)],
    ['unbound', () => {}],
    ['invalid', (d) => {
      fs.mkdirSync(path.join(d, '_bmad-output'), { recursive: true });
      fs.writeFileSync(layoutPathOf(d), 'knowledgebase:\n  backend: notion\n  mode: same\n  path: "."\n', 'utf-8');
    }],
  ];
  for (const [label, setup] of cases) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      setup(tmpDir);
      let result;
      const out = captureLog(() => { result = showLegacySingleStoreNoticeOnce(tmpDir); });
      assert.strictEqual(result, false, `${label}: the notice must not claim to have printed`);
      assert.strictEqual(out, '', `${label}: the notice must print NOTHING:\n${out}`);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.ma-agents.json')),
        `${label}: a project that is not legacy must not even get a shown-once flag written`);
    } finally { cleanup(); }
  }
});

test('AC2 — the notice is non-blocking: it never throws, never exits, and writes nothing under _bmad-output/', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = sha256Tree(path.dirname(layoutPathOf(tmpDir)) === tmpDir
      ? tmpDir : (writeLegacyLayout(tmpDir), path.join(tmpDir, '_bmad-output')));
    const outDir = path.join(tmpDir, '_bmad-output');
    const beforeOut = sha256Tree(outDir);
    assert.doesNotThrow(() => captureLog(() => showLegacySingleStoreNoticeOnce(tmpDir)));
    assert.strictEqual(sha256Tree(outDir), beforeOut,
      '_bmad-output/ must be byte-identical after the notice — it is informational, not a migration');
    assert.ok(typeof before === 'string');
  } finally { cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL SEPARATION FROM STORY 31.4's DRIFT ERROR
//
// The story's second technical note, treated as an AC: legacy is informational
// and non-blocking, drift is loud and blocking, and they must not share a
// channel or the user learns to ignore both.
// ═══════════════════════════════════════════════════════════════════════════

// The exact vocabulary Story 31.4's blocking blocks use. Read out of the SHIPPED
// preflight documents below rather than merely asserted, so this list cannot
// quietly stop matching what 31.4 actually says.
const DRIFT_HALT_PHRASES = [
  'ma-agents — stopping:',
  'Nothing has been read or written on your behalf. Stopping rather than guessing.',
];

test('channel — the shipped 31.4 preflight really does use the halt vocabulary this test excludes', () => {
  // Anchors the exclusion below to reality. Without this, DRIFT_HALT_PHRASES
  // could drift into strings 31.4 no longer uses, and the exclusion test would
  // pass while proving nothing.
  const skillDir = path.join(__dirname, '..', 'lib', 'bmad-extension', 'skills');
  const docs = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.md$/.test(e.name)) docs.push(full);
    }
  })(skillDir);
  const withPreflight = docs.filter((f) =>
    fs.readFileSync(f, 'utf-8').includes('project_layout_stamp'));
  assert.ok(withPreflight.length > 0, 'no 31.4 preflight document found — the anchor is broken');
  for (const phrase of DRIFT_HALT_PHRASES) {
    assert.ok(withPreflight.some((f) => fs.readFileSync(f, 'utf-8').includes(phrase)),
      `31.4's preflight no longer contains ${JSON.stringify(phrase)} — update DRIFT_HALT_PHRASES`);
  }
});

test('channel — the legacy notice uses NONE of 31.4\'s halt vocabulary', () => {
  const text = [LEGACY_SINGLE_STORE_NOTICE_FACT_1, LEGACY_SINGLE_STORE_NOTICE_FACT_2,
    LEGACY_SINGLE_STORE_NOTICE_FACT_3].join('\n');
  for (const phrase of DRIFT_HALT_PHRASES) {
    assert.ok(!text.includes(phrase),
      `the informational notice must not speak in the blocking channel's words: ${JSON.stringify(phrase)}`);
  }
  for (const word of ['stopping', 'HALT', 'Refusing', 'cannot be trusted']) {
    assert.ok(!text.includes(word),
      `the notice must not read as a halt; found ${JSON.stringify(word)}`);
  }
});

test('channel — the notice is rendered informationally (cyan/gray), never in the warning or error colour', () => {
  // Asserted at the SOURCE, because chalk strips colour under a piped stdout and
  // a stdout-only test could not tell red from cyan.
  const fn = CLI_SOURCE.slice(CLI_SOURCE.indexOf('function showLegacySingleStoreNoticeOnce'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 3);
  assert.ok(body.includes('chalk.cyan'), 'the notice headline must be informational (cyan)');
  assert.ok(!body.includes('chalk.red'),
    'chalk.red is the blocking channel — a red legacy notice is the conflation this story forbids');
  assert.ok(!body.includes('chalk.yellow'),
    'chalk.yellow is this codebase\'s WARNING colour; a legacy layout is not a warning');
});

test('channel — no skill document mentions the legacy single-store layout, so activation stays silent', () => {
  // AC5's "activations" half, and the surface separation. A legacy project must
  // produce ZERO extra output when a skill activates — the notice belongs to the
  // installer alone.
  const roots = [
    path.join(__dirname, '..', 'lib', 'bmad-extension', 'skills'),
    path.join(__dirname, '..', 'lib', 'bmad-extension-plugin', 'skills'),
  ];
  const offenders = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.md$/.test(e.name)) continue;
        const c = fs.readFileSync(full, 'utf-8');
        if (/legacy single-store/i.test(c) || c.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_1.trim())) {
          offenders.push(full);
        }
      }
    })(root);
  }
  assert.deepStrictEqual(offenders, [],
    'a skill document carrying the legacy notice would put an informational message on the ' +
    'blocking channel, and would nag on every activation');
});

test('channel — the notice is emitted from the installer only, at exactly one call site', () => {
  const callSites = CLI_SOURCE.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => l.includes('showLegacySingleStoreNoticeOnce(')
      && !l.includes('function showLegacySingleStoreNoticeOnce'));
  const invocations = callSites.filter(([, l]) => !/^\s*\/\//.test(l) && !l.includes('showLegacySingleStoreNoticeOnce,'));
  assert.strictEqual(invocations.length, 1,
    `the notice must have exactly ONE production call site (found ${invocations.length}: ` +
    `${JSON.stringify(invocations)}) — a second one is how a "shown once" message becomes two`);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — MIGRATION IS OFFERED, NEVER PERFORMED. Proved by BYTE IDENTITY.
// ═══════════════════════════════════════════════════════════════════════════

test('AC3 — a REAL full `install --yes` leaves the legacy project-layout.yaml BYTE-IDENTICAL', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    const before = fs.readFileSync(layoutPathOf(box.projectRoot));
    const beforeSha = sha256File(layoutPathOf(box.projectRoot));

    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const after = fs.readFileSync(layoutPathOf(box.projectRoot));
    assert.strictEqual(sha256File(layoutPathOf(box.projectRoot)), beforeSha,
      `the committed binding changed across an install nobody asked to migrate.\n` +
      `BEFORE:\n${before.toString('utf-8')}\nAFTER:\n${after.toString('utf-8')}`);
    assert.ok(before.equals(after), 'byte comparison, not just digest equality');
  } finally { box.cleanup(); }
});

test('AC3 — after that install the project is STILL legacy: no schema_version, no per-store records', () => {
  // The complement of the byte check, stated in the file\'s own terms. Byte
  // identity alone would also hold if the installer had written nothing at all
  // because it crashed; this pins WHAT the surviving file is.
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const parsed = yaml.load(fs.readFileSync(layoutPathOf(box.projectRoot), 'utf-8'));
    assert.ok(!('schema_version' in parsed), 'an install must not stamp a schema version on a legacy file');
    assert.ok(!('system_requirements_store' in parsed),
      'an install must not split a legacy layout into two store records');
    assert.ok(!('software_requirements_store' in parsed),
      'an install must not split a legacy layout into two store records');
    assert.ok('knowledgebase' in parsed, 'the single legacy record must survive verbatim');
    assert.strictEqual(detectLegacySingleStore(box.projectRoot).legacy, true,
      'the project must still be classified legacy after an install — AC5 depends on it');
  } finally { box.cleanup(); }
});

test('AC3 — `ma-agents config layout --yes` (non-interactive reconfigure) also leaves it byte-identical', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const beforeSha = sha256File(layoutPathOf(box.projectRoot));
    const env = { ...process.env, HOME: box.homeRoot, USERPROFILE: box.homeRoot };
    const res = spawnSync(process.execPath, [CLI_PATH, 'config', 'layout', '--yes'],
      { cwd: box.projectRoot, env, encoding: 'utf-8', input: '', stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 });
    assert.strictEqual(res.status, 0,
      `config layout --yes exited ${res.status}\n${res.stdout}\n${res.stderr}`);
    assert.strictEqual(sha256File(layoutPathOf(box.projectRoot)), beforeSha,
      'a bind/reconfigure that changes nothing must migrate nothing');
  } finally { box.cleanup(); }
});

test('AC3 — detection itself is a pure read: the whole project tree is unchanged after resolving and detecting', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(tmpDir, '../kb');
    const before = sha256Tree(tmpDir);
    detectLegacySingleStore(tmpDir);
    resolveProjectTopology(tmpDir);
    readExistingLayout();
    assert.strictEqual(sha256Tree(tmpDir), before,
      'reading a legacy binding must not write anything anywhere in the project');
  } finally { cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC4 — accepting the split does split; declining leaves it byte-identical
// ═══════════════════════════════════════════════════════════════════════════

test('AC4 accept — the two-store questions ARE asked on a legacy project, once per store', () => {
  return (async () => {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
      const existing = readExistingLayout();
      const other = path.join(tmpDir, 'sysreq');
      fs.mkdirSync(other, { recursive: true });
      const { questions } = await runWizard([
        { backend: 'file-system' }, { mode: 'local' }, { localPath: other },
        { backend: 'file-system' }, { mode: 'same' },
        { mode: 'same' },
      ], existing);
      const storeQuestions = questions.filter((q) => /requirements store/.test(q.message || ''));
      assert.ok(storeQuestions.some((q) => /system requirements store/.test(q.message)),
        'the SYSTEM requirements store must be asked about (Story 31.5 AC1)');
      assert.ok(storeQuestions.some((q) => /software requirements store/.test(q.message)),
        'the SOFTWARE requirements store must be asked about (Story 31.5 AC1)');
    } finally { cleanup(); }
  })();
});

test('AC4 accept — answering two DIFFERENT locations rewrites the layout through 31.2\'s writer into two stores', () => {
  return (async () => {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      writeLegacyLayout(tmpDir, { mode: 'same', kbPath: '.' });
      const existing = readExistingLayout();
      const sysDir = path.join(tmpDir, 'sysreq');
      fs.mkdirSync(sysDir, { recursive: true });
      const { layout } = await runWizard([
        { backend: 'file-system' }, { mode: 'local' }, { localPath: sysDir },
        { backend: 'file-system' }, { mode: 'same' },
        { mode: 'same' },
      ], existing);
      captureLog(() => writeProjectLayoutYaml(layout));

      const parsed = yaml.load(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'));
      assert.strictEqual(parsed.schema_version, PROJECT_LAYOUT_SCHEMA_VERSION,
        'an accepted split writes the current schema');
      assert.ok(!('knowledgebase' in parsed), 'the collapsed legacy record is replaced, not kept alongside');
      assert.strictEqual(parsed.software_requirements_store.path, '.');
      assert.strictEqual(parsed.system_requirements_store.path, 'sysreq',
        'the system store must land at its OWN answered location');
      assert.strictEqual(detectLegacySingleStore(tmpDir).legacy, false,
        'after an accepted split the project is no longer legacy');
    } finally { cleanup(); }
  })();
});

test('AC4 decline — accepting every default (nothing moves) leaves the legacy file BYTE-IDENTICAL', () => {
  return (async () => {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const original = writeLegacyLayout(tmpDir, { mode: 'same', kbPath: '.' });
      const beforeSha = sha256File(layoutPathOf(tmpDir));
      const existing = readExistingLayout();
      const { layout } = await runWizard(ALL_DEFAULTS, existing);
      captureLog(() => writeProjectLayoutYaml(layout));
      assert.strictEqual(sha256File(layoutPathOf(tmpDir)), beforeSha,
        'a wizard run that moves nothing must leave a legacy layout byte-identical');
      assert.strictEqual(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'), original);
    } finally { cleanup(); }
  })();
});

test('AC4 — the byte-identity is CONDITIONAL on nothing moving, not a blanket refusal to write', () => {
  // The mutant this kills: "always skip the write when the file is legacy".
  // That would also make every AC3/AC4 byte test above pass, while permanently
  // preventing a user from ever splitting or relocating anything.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'same', kbPath: '.' });
    const beforeSha = sha256File(layoutPathOf(tmpDir));
    const moved = path.join(tmpDir, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    captureLog(() => writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'local', path: moved },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    assert.notStrictEqual(sha256File(layoutPathOf(tmpDir)), beforeSha,
      'a genuine split MUST be written — preservation is conditional on nothing moving');
    const parsed = yaml.load(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'));
    assert.strictEqual(parsed.schema_version, PROJECT_LAYOUT_SCHEMA_VERSION);
    assert.strictEqual(parsed.system_requirements_store.path, 'elsewhere');
  } finally { cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC5 — IDEMPOTENT AND NON-NAGGING. Every assertion here is about the SECOND run.
// ═══════════════════════════════════════════════════════════════════════════

test('AC5 — the SECOND call prints nothing and returns false', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir, { mode: 'local', kbPath: '../kb' });
    let first, second;
    const out1 = captureLog(() => { first = showLegacySingleStoreNoticeOnce(tmpDir); });
    const out2 = captureLog(() => { second = showLegacySingleStoreNoticeOnce(tmpDir); });
    assert.strictEqual(first, true, 'run 1 must print');
    assert.ok(out1.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_1));
    // THE ASSERTION THAT MATTERS — about run 2, not run 1.
    assert.strictEqual(second, false, 'run 2 must be a no-op');
    assert.strictEqual(out2, '', `run 2 must print NOTHING, got:\n${out2}`);
  } finally { cleanup(); }
});

test('AC5 — a THIRD and FOURTH call are also silent: no escalation, no re-arming', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir);
    captureLog(() => showLegacySingleStoreNoticeOnce(tmpDir));
    const later = [2, 3, 4].map(() => captureLog(() => showLegacySingleStoreNoticeOnce(tmpDir)));
    assert.deepStrictEqual(later, ['', '', ''],
      'the notice must never come back and must never escalate');
  } finally { cleanup(); }
});

test('AC5 — the shown-once flag is the Story 30.4 mechanism, and does not disturb sibling notices', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLegacyLayout(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.ma-agents.json'),
      JSON.stringify({ profile: 'default', notices: { 'demerzel-deprecation': true } }, null, 2), 'utf-8');
    captureLog(() => showLegacySingleStoreNoticeOnce(tmpDir));
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ma-agents.json'), 'utf-8'));
    assert.strictEqual(manifest.notices[LEGACY_SINGLE_STORE_NOTICE_ID], true,
      'the flag must be recorded under Story 30.4\'s `notices` map');
    assert.strictEqual(manifest.notices['demerzel-deprecation'], true,
      'a sibling notice flag must survive');
    assert.strictEqual(manifest.profile, 'default', 'unrelated manifest fields must survive');
  } finally { cleanup(); }
});

test('AC5 — a SECOND real `install --yes` on the same legacy project does not repeat the notice', () => {
  // The end-to-end form, and the one that actually answers "does it nag?".
  // Asserted on run 2's stdout.
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    const run1 = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run1.status, 0, `install 1 exited ${run1.status}\n${run1.output.slice(-2500)}`);
    assert.ok(run1.output.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_1.trim()),
      `install 1 must show the notice:\n${run1.output.slice(-2500)}`);

    const run2 = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run2.status, 0, `install 2 exited ${run2.status}\n${run2.output.slice(-2500)}`);
    assert.ok(!run2.output.includes(LEGACY_SINGLE_STORE_NOTICE_FACT_1.trim()),
      `install 2 must NOT repeat the notice — this is AC5:\n${run2.output.slice(-2500)}`);
    for (const fact of [LEGACY_SINGLE_STORE_NOTICE_FACT_2, LEGACY_SINGLE_STORE_NOTICE_FACT_3]) {
      assert.ok(!run2.output.includes(fact.split('\n')[0]),
        `install 2 leaked part of the notice:\n${run2.output.slice(-2500)}`);
    }
    // And the project is still legacy on run 2 — otherwise silence would be
    // explained by the project having been migrated, not by the once-flag.
    assert.strictEqual(detectLegacySingleStore(box.projectRoot).legacy, true,
      'run 2 must still be a legacy project, or this test proves nothing about nagging');
  } finally { box.cleanup(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC6 / NFR82 — PROVEN WITH A REAL FULL INSTALL ON A PRE-F26 FIXTURE
// ═══════════════════════════════════════════════════════════════════════════

// AC6(c), as a LITERAL. If cli.js grows a fourth generated field, this fails.
const AC6_PERMITTED_NEW_CONFIG_FIELDS = ['project_layout_stamp',
  'system_requirements_path', 'software_requirements_path'];

test('AC6 — a pre-F26 fixture completes a real full install cleanly', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0,
      `a pre-F26 project must install with no action from its maintainer; exited ${run.status}\n` +
      run.output.slice(-3000));
    assert.strictEqual(run.signal, null, 'the install must not have been killed');
  } finally { box.cleanup(); }
});

test('AC6(a) — ZERO additional prompts: no knowledge-store question reaches stdout on a legacy install', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);
    for (const phrase of ['Which backend holds', 'Where is your', 'requirements store —',
      'Would you like to', 'Split']) {
      assert.ok(!run.output.includes(phrase),
        `the install asked something ("${phrase}") — AC6 requires zero additional prompts:\n` +
        run.output.slice(-2500));
    }
  } finally { box.cleanup(); }
});

test('AC6(a) — the interactive question SEQUENCE on a legacy project is identical to a two-store project\'s', () => {
  return (async () => {
    // Sequence equality, not a count: "zero additional prompts" means the legacy
    // maintainer is asked exactly what anybody else is asked, in the same order.
    const legacy = withTmpDir();
    let legacyQuestions;
    try {
      writeLegacyLayout(legacy.tmpDir, { mode: 'same', kbPath: '.' });
      ({ questions: legacyQuestions } = await runWizard(ALL_DEFAULTS, readExistingLayout()));
    } finally { legacy.cleanup(); }

    const modern = withTmpDir();
    let modernQuestions;
    try {
      writeTwoStoreLayout(modern.tmpDir);
      ({ questions: modernQuestions } = await runWizard(ALL_DEFAULTS, readExistingLayout()));
    } finally { modern.cleanup(); }

    assert.deepStrictEqual(legacyQuestions, modernQuestions,
      'a legacy project must be asked exactly the same questions, in the same order, as a ' +
      'two-store one — anything extra is an "additional prompt"');
  })();
});

test('AC6(b) — resolved artifact paths are IDENTICAL before and after the install', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    const beforeConfig = writeLegacyConfig(box.projectRoot, '../kb');
    const beforeValues = {};
    for (const f of ['knowledgebase_path', 'sprint_management_path', 'planning_artifacts',
      'implementation_artifacts']) {
      beforeValues[f] = configFieldValue(beforeConfig, f);
    }

    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const afterConfig = fs.readFileSync(configPathOf(box.projectRoot), 'utf-8');
    for (const [f, v] of Object.entries(beforeValues)) {
      assert.strictEqual(configFieldValue(afterConfig, f), v,
        `${f} moved across the install (${v} -> ${configFieldValue(afterConfig, f)}) — NFR82 says ` +
        `every artifact path is unchanged`);
    }
  } finally { box.cleanup(); }
});

test('AC6(c) — config.yaml gains EXACTLY the stamp and the two per-store fields, and nothing else', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    const beforeConfig = writeLegacyConfig(box.projectRoot, '../kb');
    const beforeFields = configFieldsAtColumnZero(beforeConfig);

    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const afterConfig = fs.readFileSync(configPathOf(box.projectRoot), 'utf-8');
    const afterFields = configFieldsAtColumnZero(afterConfig);

    const added = [...afterFields].filter((f) => !beforeFields.has(f)).sort();
    const removed = [...beforeFields].filter((f) => !afterFields.has(f)).sort();
    assert.deepStrictEqual(removed, [],
      `the install removed config fields a pre-F26 project depends on: ${removed.join(', ')}`);
    assert.deepStrictEqual(added, [...AC6_PERMITTED_NEW_CONFIG_FIELDS].sort(),
      `AC6 permits exactly the generation stamp and the two per-store fields; got ${added.join(', ')}`);
  } finally { box.cleanup(); }
});

test('AC6(c) — the two new per-store fields BOTH resolve to the one legacy location', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);

    const after = fs.readFileSync(configPathOf(box.projectRoot), 'utf-8');
    const sys = configFieldValue(after, 'system_requirements_path');
    const soft = configFieldValue(after, 'software_requirements_path');
    const legacyValue = configFieldValue(after, 'knowledgebase_path');
    assert.strictEqual(sys, legacyValue,
      'the system store must resolve to the one legacy location');
    assert.strictEqual(soft, legacyValue,
      'the software store must resolve to the one legacy location');
    assert.strictEqual(legacyValue, '"../kb"', 'and that location is the one the project already had');
  } finally { box.cleanup(); }
});

test('AC6 — the foreign upstream-BMAD keys in config.yaml survive the install untouched', () => {
  const box = makeInstallBox();
  try {
    writeLegacyLayout(box.projectRoot, { mode: 'local', kbPath: '../kb' });
    writeLegacyConfig(box.projectRoot, '../kb');
    const run = runRealInstall(box.projectRoot, box.homeRoot);
    assert.strictEqual(run.status, 0, `install exited ${run.status}\n${run.output.slice(-2500)}`);
    const after = fs.readFileSync(configPathOf(box.projectRoot), 'utf-8');
    assert.strictEqual(configFieldValue(after, 'user_name'), '"Legacy Maintainer"');
    assert.strictEqual(configFieldValue(after, 'output_folder'), '"{project-root}/docs"');
  } finally { box.cleanup(); }
});

// ─── Runner ──────────────────────────────────────────────────────────────────

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
      errors.push({ name, error: err.message });
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
  }

  const total = passed + failed;
  summaryPrinted = true;
  if (total !== EXPECTED_TEST_COUNT) {
    console.error(
      `\n  FATAL: ${total} tests ran, but this file defines ${EXPECTED_TEST_COUNT}. Tests that ` +
      `silently stop running must FAIL, not pass — and a surplus is just as wrong as a ` +
      `shortfall. If you added or removed a test, update EXPECTED_TEST_COUNT deliberately.`
    );
    process.exit(1);
  }
  if (failed > 0) process.exit(1);
})();
