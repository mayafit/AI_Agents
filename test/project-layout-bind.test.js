#!/usr/bin/env node
/**
 * Story 31.13 — `ma-agents bind` (FR252), and install-scope / bound-project
 * reporting in `ma-agents status` (FR253). NFR78, NFR83.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT THIS SUITE CAN AND CANNOT ESTABLISH — READ BEFORE TRUSTING IT
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Four of this story's ACs are NEGATIVES ("installs nothing", "changes nothing",
 * "never overwrites", "never affects resolution"), and this epic has already
 * shipped six tests that proved a negative vacuously. Every negative below is
 * therefore held to two rules:
 *
 *   (1) IT IS PROVED BY BYTE-IDENTITY, NEVER BY "a function was not called".
 *       AC4 and AC5 compare a sha256 of every file under the project root,
 *       before and after. A test that asserted `writeProjectLayoutYaml` was not
 *       invoked would pass just as well if bind had written the file through
 *       some other path, or had crashed before reaching it.
 *
 *   (2) IT IS BRACKETED BY A PRESENCE CONTROL. An absence assertion passes if
 *       the command did nothing at all, or if the assertion was pointed at the
 *       wrong directory. So every "nothing was written" is paired with a run
 *       through the SAME harness that MUST write — a first bind for AC4, a
 *       context-less project for AC5, a planted decoy for AC2's skill-directory
 *       detector. If the control does not fire, the absence claim is void.
 *
 * TEST NAMES ARE PREFIXED:
 *   [behaviour] — exercises real code (a spawned `ma-agents bind`, or an exported
 *                 function driven directly) against real on-disk fixtures.
 *   [text]      — a claim about SHIPPED PROSE. The AC3 offer that reaches a
 *                 globally-installed skill is TEXT A MODEL IS ASKED TO OBEY;
 *                 no test here proves a model obeys it. What these tests DO
 *                 establish is which SURFACE the text is on — and this epic's
 *                 signature defect is text on a surface nothing reads.
 *
 * EVERY EXPECTATION IS A LITERAL WRITTEN HERE, not a value re-derived from the
 * code under test. Six tautological tests have shipped on this epic already.
 *
 * NEVER wrap this suite in a shell `timeout`: a SIGTERM'd run exits 143, which
 * reads as a failure and is not one. `spawnSync`'s own `timeout` option is used,
 * and a timeout is reported as a FAILURE, never skipped.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// A `!==` check — a SURPLUS fails as loudly as a shortfall. This epic has already
// shipped one suite that exited 0 having reported nothing.
const EXPECTED_TEST_COUNT = 73;

const REPO_ROOT = path.join(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'bin', 'cli.js');
const INSTALLER_PATH = path.join(REPO_ROOT, 'lib', 'installer.js');
const BOUND_PROJECTS_PATH = path.join(REPO_ROOT, 'lib', 'bound-projects.js');

// Newline-normalised: the working tree is CRLF on Windows and LF on CI, and a
// source-level anchor that matches only one of them is a test that silently stops
// asserting on the other platform — this epic's signature defect.
const CLI_SOURCE = fs.readFileSync(CLI_PATH, 'utf-8').replace(/\r\n/g, '\n');
const INSTALLER_SOURCE = fs.readFileSync(INSTALLER_PATH, 'utf-8').replace(/\r\n/g, '\n');

// ─── The prompts stub ────────────────────────────────────────────────────────
//
// Installed in the require cache BEFORE cli.js is loaded, so cli.js's own
// `require('prompts')` binds to it. Every question is LOGGED and answered by
// "pressing Enter" — taking the answer from the prompt's own pre-selection. That
// matters for the AC1 parity test: a hardcoded answer sheet would have to be
// written twice, once per driver, and two answer sheets that drifted apart would
// make the parity claim meaningless.
const promptsModulePath = require.resolve('prompts');
require('prompts');
let promptLog = [];
// `false` | `true` | `undefined` (a CANCELLED prompt — what `prompts` returns when
// the user hits Ctrl-C) | PRESS_ENTER (answer with whatever the prompt itself
// pre-selected, which is how a default is exercised rather than restated).
const PRESS_ENTER = Symbol('press Enter on a confirm prompt');
let confirmAnswer = false;
// Per-prompt answer overrides, keyed by prompt NAME, consulted before the
// press-Enter default. Used only where a test must inject a value the wizard
// cannot pre-select for itself — a confluence backend, and an identity carrying
// a line break — so that a serializer throw originates inside the write that
// handleBind called, which is the branch under test.
let answerOverrides = {};
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  promptLog.push({
    name: (question && question.name) || '(unnamed)',
    type: question && question.type,
    message: (question && question.message) || '',
    initial: question && question.initial,
    // N4. `choices` was never captured, so the anti-drift comparison below could
    // not see a divergent backend enum even in principle. Captured verbatim; the
    // comparison digests it.
    choices: (question && question.choices) || null,
  });
  const name = (question && question.name) || '(unnamed)';
  if (Object.prototype.hasOwnProperty.call(answerOverrides, name)) {
    return { [name]: answerOverrides[name] };
  }
  if (question && question.type === 'select') {
    const idx = typeof question.initial === 'number' ? question.initial : 0;
    const choice = (question.choices || [])[idx];
    if (!choice) {
      throw new Error(
        `prompt ${JSON.stringify(name)} pre-selected index ${question.initial}, which is not one ` +
        `of its ${(question.choices || []).length} choice(s) — pressing Enter would select nothing`
      );
    }
    return { [name]: choice.value };
  }
  if (question && question.type === 'confirm') {
    if (confirmAnswer === PRESS_ENTER) return { [name]: question.initial };
    return { [name]: confirmAnswer };
  }
  return { [name]: question && question.initial === undefined ? '' : question.initial };
};

// ─── Load the module under test ──────────────────────────────────────────────
let cli, installer, boundProjects;
try {
  cli = require('../bin/cli.js');
  installer = require('../lib/installer.js');
  boundProjects = require('../lib/bound-projects.js');
} catch (e) {
  console.error('\n  FATAL: cannot load the modules under test');
  console.error(' ', (e && e.stack) || e);
  process.exit(1);
}

for (const name of [
  'handleBind', 'offerBind', 'bindOfferDecision', 'detectInstallScopes',
  'describeBoundProjects', 'resolveProjectTopology', 'collectRepoLayout',
]) {
  if (typeof cli[name] !== 'function') {
    console.error(`\n  FATAL: bin/cli.js does not export ${name}() — every test below would be vacuous.`);
    process.exit(1);
  }
}

// ─── Harness ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];
const asyncTests = [];

// Armed BEFORE the first test, so it catches the process dying before the summary
// block rather than after everything it protects has already happened.
let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Forcing a non-zero exit so this ` +
    `cannot read as a pass.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

// Async tests are DEFERRED AND DRAINED ONE AT A TIME, never started eagerly.
// Several of them `process.chdir()` into their own fixture, and a process has one
// working directory: two overlapping async tests race for it and the loser fails
// with an ENOENT that has nothing to do with the property under test. They also
// share the prompt log, which concurrent runs interleave.
function test(name, fn) {
  const isAsync = fn.constructor && fn.constructor.name === 'AsyncFunction';
  if (isAsync) {
    asyncTests.push({ name, fn });
    return;
  }
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
    errors.push({ name, error: e.message });
  }
}

async function drainAsyncTests() {
  for (const { name, fn } of asyncTests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`);
      failed++;
      errors.push({ name, error: e.message });
    }
  }
}

/** A throwaway sandbox: an isolated HOME (so `~/.ma-agents` is never the real one) and a project root. */
function withSandbox(fn) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-3113-')));
  const home = path.join(base, 'home');
  const project = path.join(base, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  try {
    return fn({ base, home, project });
  } finally {
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Run the REAL CLI, with HOME/USERPROFILE redirected into the sandbox. */
function runCli(args, { home, cwd }) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 120000,
    env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  if (r.error && r.error.code === 'ETIMEDOUT') {
    throw new Error(`\`ma-agents ${args.join(' ')}\` TIMED OUT — reported as a failure, never skipped`);
  }
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** sha256 of every file under `root`, keyed by relative path. The AC4/AC5 oracle. */
function fingerprint(root) {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        out[path.relative(root, full).split(path.sep).join('/')] =
          crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

/**
 * N4 — THE ANTI-DRIFT COMPARISON KEY, WIDENED.
 *
 * The key used to be `${type}:${name}:${message}`. The stub RECORDED `initial`
 * and then excluded it from the key, and never captured `choices` at all. So a
 * drifted copy of the wizard asking the same type/name/message with a FLIPPED
 * `initial`, or with a DIVERGENT backend enum in `choices`, produced a
 * byte-identical question stream and stayed green.
 *
 * That is not hypothetical: this story's own M15 mutant was a flipped `initial`,
 * and it was killed only by a separate hand-written assertion covering the ONE
 * re-bind confirm prompt. The five collection prompts had no such pin at all.
 *
 * `choices` is folded in as a short sha256 of its value/title pairs rather than
 * verbatim, so the key stays legible in a failure message while still breaking on
 * any change to the enum a prompt offers.
 */
function promptSignature(q) {
  const choicesKey = Array.isArray(q.choices)
    ? crypto.createHash('sha256')
      .update(JSON.stringify(q.choices.map((c) => [c && c.value, c && c.title])))
      .digest('hex').slice(0, 12)
    : 'none';
  return `${q.type}:${q.name}:${q.message}:initial=${JSON.stringify(q.initial)}:choices=${choicesKey}`;
}

/** Every file path under `root`, relative and slash-normalised. */
function fileList(root) {
  return Object.keys(fingerprint(root)).sort();
}

function capture(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console.log = orig; }
  // eslint-disable-next-line no-control-regex
  return lines.join('\n').replace(/\[[0-9;]*m/g, '');
}

// A well-formed schema-2 binding, written by hand so nothing below derives its
// expectation from the writer it is checking.
function writeLayout(projectRoot, body) {
  fs.mkdirSync(path.join(projectRoot, '_bmad-output'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '_bmad-output', 'project-layout.yaml'), body, 'utf-8');
}
const VALID_LAYOUT = [
  'schema_version: 2',
  'generated: "2026-01-01"',
  'system_requirements_store:',
  '  backend: file-system',
  '  mode: same',
  '  path: "."',
  'software_requirements_store:',
  '  backend: file-system',
  '  mode: same',
  '  path: "."',
  'sprint_management:',
  '  mode: same',
  '  path: "."',
  '',
].join('\n');

// ═══════════════════════════════════════════════════════════════════════════
// ANTI-VACUITY GATES — everything below depends on a bind run that really ran.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAnti-vacuity gates — the bind run genuinely ran and genuinely wrote');

const firstRun = withSandbox(({ home, project }) => {
  const r = runCli(['bind', '--yes'], { home, cwd: project });
  return {
    code: r.code,
    out: r.out,
    files: fileList(project),
    homeFiles: fileList(home),
    layout: fs.existsSync(path.join(project, '_bmad-output', 'project-layout.yaml'))
      ? fs.readFileSync(path.join(project, '_bmad-output', 'project-layout.yaml'), 'utf-8')
      : null,
    config: fs.existsSync(path.join(project, '_bmad', 'bmm', 'config.yaml'))
      ? fs.readFileSync(path.join(project, '_bmad', 'bmm', 'config.yaml'), 'utf-8')
      : null,
  };
});

test('[behaviour] gate 1 — `ma-agents bind --yes` EXITS 0 (not merely "did not crash")', () => {
  assert.strictEqual(firstRun.code, 0,
    `bind exited ${firstRun.code}. Every absence assertion below would otherwise pass because ` +
    `nothing happened at all. Output:\n${firstRun.out}`);
});

test('[behaviour] gate 2 — bind genuinely WROTE the committed binding', () => {
  assert.ok(firstRun.layout,
    '_bmad-output/project-layout.yaml was not written, so "bind wrote only these files" is vacuous');
  assert.ok(/^schema_version: 2$/m.test(firstRun.layout),
    `the written binding is not a schema-2 layout:\n${firstRun.layout}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — bind collects ONLY the project-scoped answers, and writes the two files
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC1 — only the project-scoped answers; project-layout.yaml + project-context.md');

test('[behaviour] AC1 — bind writes the binding AND project-context.md, and nothing else outside _bmad/', () => {
  // The expected set is a LITERAL. AC1 names two files; AC2 permits exactly one
  // more, the generated config.
  assert.deepStrictEqual(firstRun.files, [
    '_bmad-output/project-context.md',
    '_bmad-output/project-layout.yaml',
    '_bmad/bmm/config.yaml',
  ].sort(),
    `a bind run must produce exactly the two AC1 artifacts plus the AC2-permitted generated ` +
    `config. Found:\n${JSON.stringify(firstRun.files, null, 2)}\nOutput:\n${firstRun.out}`);
});

test('[behaviour] AC1 — the binding carries exactly the three project-scoped records', () => {
  const topLevel = firstRun.layout
    .split('\n')
    .filter((l) => /^[a-z_]+:/.test(l))
    .map((l) => l.split(':')[0]);
  assert.deepStrictEqual(topLevel.sort(), [
    'generated', 'schema_version', 'software_requirements_store', 'sprint_management',
    'system_requirements_store',
  ], `the written binding's top-level keys are not the three location records plus the two ` +
     `header fields:\n${firstRun.layout}`);
});

test('[behaviour] AC1 — bind asks EXACTLY the five questions, in these words and no others', async () => {
  // The expectation is five LITERAL strings written here. They are the two
  // knowledge-store bindings (a backend and a location each, Story 31.5/31.8) and
  // the sprint-management location (FR112). Anything bind additionally asked —
  // an install-scope question, an agent selection, a BMAD module question —
  // appears here as a surplus and fails.
  const EXPECTED_QUESTIONS = [
    'Which backend holds your system requirements store — product brief and PRD (for a sharded PRD, its index and all shards)?',
    'Where is your system requirements store managed?',
    'Which backend holds your software requirements store — architecture document, UX designs, epics?',
    'Where is your software requirements store managed?',
    'Where is your sprint management managed?',
  ];
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-q-')));
  const origCwd = process.cwd();
  try {
    process.chdir(dir);
    promptLog = [];
    await cli.handleBind([]);
    const asked = promptLog.map((q) => q.message);
    assert.ok(asked.length > 0, 'bind asked NOTHING — the parity claim below would be vacuous');
    assert.deepStrictEqual(asked, EXPECTED_QUESTIONS,
      `bind asked a different set of questions:\n${JSON.stringify(asked, null, 2)}`);
  } finally {
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC1/reuse — bind asks the SAME questions, in the same order, as Story 31.5\'s own collection flow', async () => {
  // THE ANTI-DRIFT TEST. The technical note calls a second, drifting copy of the
  // store questions inside bind "the most likely defect this story can
  // introduce". This runs BOTH drivers over the same fresh fixture, with the same
  // press-Enter stub, and compares the question streams. A copy inside bind stays
  // green only while it is byte-identical to `collectRepoLayout`'s — the moment
  // Story 31.5's or 31.8's wording, order or prompt names change on one side
  // only, this fails.
  const dirA = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-pa-')));
  const dirB = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-pb-')));
  const origCwd = process.cwd();
  try {
    process.chdir(dirA);
    promptLog = [];
    await cli.collectRepoLayout({ yes: false }, null);
    const viaCollect = promptLog.map(promptSignature);

    process.chdir(dirB);
    promptLog = [];
    await cli.handleBind([]);
    const viaBind = promptLog.map(promptSignature);

    assert.ok(viaCollect.length >= 5,
      `collectRepoLayout asked ${viaCollect.length} question(s) — too few for this comparison to mean anything`);
    assert.deepStrictEqual(viaBind, viaCollect,
      `bind's question stream diverges from Story 31.5's collection flow, which means bind is no ` +
      `longer reusing it.\n  via collectRepoLayout: ${JSON.stringify(viaCollect, null, 2)}\n` +
      `  via bind:              ${JSON.stringify(viaBind, null, 2)}`);
  } finally {
    process.chdir(origCwd);
    process.exitCode = 0;
    for (const d of [dirA, dirB]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
});

test('[behaviour] N4 — on a FRESH project every collection prompt pre-selects the SAFE default, and its enum is pinned', async () => {
  // WHY THE PARITY TEST ABOVE IS NOT ENOUGH, established by mutation rather than
  // by argument. Parity compares bind's question stream against
  // `collectRepoLayout`'s — but both drivers run the SAME code, so a change to the
  // shared wizard moves BOTH streams identically and parity stays green. Mutating
  // a `mode` prompt's `initial` from 0 to 1 SURVIVED the parity test even after the
  // comparison key was widened to carry `initial` and a `choices` digest.
  //
  // Parity catches a DIVERGENT COPY living inside bind. Only an ABSOLUTE pin
  // catches the shared wizard itself drifting, and that is the half this story's
  // own M15 mutant (a flipped `initial`) exposed: it was killed only by a
  // hand-written assertion covering the ONE re-bind confirm prompt, and the five
  // collection prompts had no such pin at all.
  //
  // The property being pinned is NOT "these exact bytes". It is that on an UNBOUND
  // project, pressing Enter through the whole wizard yields the SAFE SINGLE-REPO
  // DEFAULT — `file-system` and `same` — and never `confluence` or `local` or
  // `jira`. A flipped pre-selection silently binds a project to a store nobody
  // chose, from the same keystrokes.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-n4-')));
  const origCwd = process.cwd();
  try {
    process.chdir(dir);
    promptLog = [];
    await cli.handleBind([]);

    const selects = promptLog.filter((q) => q.type === 'select');
    assert.strictEqual(selects.length, 5,
      `bind asked ${selects.length} select question(s) on a fresh project, expected 5 — the ` +
      `wizard's shape changed, so every pin below is about a different flow: ` +
      `${JSON.stringify(promptLog.map((q) => q.name))}`);

    // 1. THE PRE-SELECTION. Every one of them, by index.
    const initials = selects.map((q) => q.initial);
    assert.deepStrictEqual(initials, [0, 0, 0, 0, 0],
      `a collection prompt on an UNBOUND project no longer pre-selects its first choice: ` +
      `${JSON.stringify(selects.map((q) => ({ name: q.name, message: q.message, initial: q.initial })))}. ` +
      `Pressing Enter would now bind the project to something the user did not choose.`);

    // 2. …AND WHAT THAT INDEX RESOLVES TO. An index alone is meaningless if the
    //    choice list is reordered underneath it, so the resolved VALUE is pinned
    //    too — this is what makes the two assertions independent rather than one
    //    assertion written twice.
    const resolved = selects.map((q) => (q.choices || [])[q.initial] && (q.choices || [])[q.initial].value);
    assert.deepStrictEqual(resolved, ['file-system', 'same', 'file-system', 'same', 'same'],
      `pressing Enter through the wizard on a fresh project no longer yields the safe ` +
      `single-repo default: ${JSON.stringify(resolved)}`);

    // 3. THE ENUMS THEMSELVES. A backend or mode silently added to, removed from,
    //    or reordered within a shipped choice list changes what the wizard can
    //    produce, and `project-layout-enum-single-source` pins the enum CONSTANTS
    //    rather than what these five prompts actually offer.
    const enums = selects.map((q) => (q.choices || []).map((c) => c.value));
    assert.deepStrictEqual(enums, [
      ['file-system', 'confluence'],
      ['same', 'local', 'remote'],
      ['file-system', 'confluence'],
      ['same', 'local', 'remote'],
      ['same', 'local', 'remote', 'jira'],
    ], `a collection prompt's choice list changed: ${JSON.stringify(enums)}`);
  } finally {
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[text] AC1/reuse — bind\'s source contains no store-question text of its own', () => {
  // The parity test above catches drift between two live flows. This catches the
  // step BEFORE that: a second copy of the questions being written into
  // `handleBind` at all. Anchored on the wizard's own vocabulary.
  const m = /\nasync function handleBind\([\s\S]*?\n\}\n/.exec(CLI_SOURCE);
  assert.ok(m, 'handleBind() was not found in bin/cli.js — a rename makes every check here vacuous');
  const body = m[0];
  assert.ok(/collectRepoLayout\(/.test(body),
    'handleBind does not call collectRepoLayout — it is not reusing Story 31.5\'s flow');
  for (const forbidden of [
    'Which backend holds your',
    'Where is your',
    'STORE_BACKEND_WIZARD',
    'REPO_LAYOUT_CONCERNS',
    'collectFileSystemStoreLocation',
    'collectConfluenceStoreLocation',
    'collectSprintManagementLocation',
  ]) {
    assert.ok(!body.includes(forbidden),
      `handleBind contains ${JSON.stringify(forbidden)} — a second copy of the collection flow. ` +
      `The questions must come from collectRepoLayout and from nowhere else.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — bind installs NO skills and NO BMAD modules
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC2 — installs nothing: no skill directories, no _bmad module tree');

test('[behaviour] AC2 — the skill-directory detector CAN see a skill directory (control for the absence below)', () => {
  // Without this, "no skill directories were found" is satisfied just as well by
  // a detector that finds nothing anywhere.
  withSandbox(({ project }) => {
    fs.mkdirSync(path.join(project, '.claude', 'skills', 'decoy'), { recursive: true });
    fs.writeFileSync(path.join(project, '.claude', 'skills', 'decoy', 'SKILL.md'), '# decoy\n', 'utf-8');
    const found = fileList(project).filter((f) => /(^|\/)skills\//.test(f) && f.endsWith('SKILL.md'));
    assert.deepStrictEqual(found, ['.claude/skills/decoy/SKILL.md'],
      'the detector cannot see a planted skill directory, so its silence proves nothing');
  });
});

test('[behaviour] AC2 — a bind run produces NO skill directory and NO SKILL.md anywhere', () => {
  const skillish = firstRun.files.filter((f) => f.endsWith('SKILL.md') || /(^|\/)skills\//.test(f));
  assert.deepStrictEqual(skillish, [],
    `bind installed skills. Files under the project root:\n${JSON.stringify(firstRun.files, null, 2)}`);
});

test('[behaviour] AC2 — the only thing written under _bmad/ is the generated config.yaml', () => {
  const underBmad = firstRun.files.filter((f) => f.startsWith('_bmad/'));
  assert.deepStrictEqual(underBmad, ['_bmad/bmm/config.yaml'],
    `bind wrote a BMAD module tree. P5-9.3 permits the generated config and nothing else. ` +
    `Found:\n${JSON.stringify(underBmad, null, 2)}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — the automatic offer, and the surface it is on
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC3 — the offer: it fires on an unbound project, and never runs bind by itself');

test('[behaviour] AC3 — an UNBOUND project is offered the bind', () => {
  withSandbox(({ project }) => {
    const d = cli.bindOfferDecision(project);
    assert.strictEqual(d.offer, true, `an unbound project must be offered the bind, got ${JSON.stringify(d)}`);
    assert.strictEqual(d.reason, 'unbound', `the reason must name the binding state, got ${JSON.stringify(d.reason)}`);
  });
});

test('[behaviour] AC3 — an ALREADY-BOUND project is not offered anything', () => {
  withSandbox(({ project }) => {
    writeLayout(project, VALID_LAYOUT);
    const d = cli.bindOfferDecision(project);
    assert.strictEqual(d.offer, false, 'a bound project must not be offered a bind');
    assert.strictEqual(d.reason, 'already-bound', `got ${JSON.stringify(d.reason)}`);
  });
});

test('[behaviour] AC3 — an UNREADABLE binding is NOT offered, and is not conflated with "unbound"', () => {
  // Story 31.3's rule: `absent` and `malformed` are not interchangeable. Offering
  // to write a fresh binding over one this build cannot read is the destructive
  // overwrite Story 31.2's guard exists to refuse.
  const cases = [
    ['<<<<<<< HEAD\nschema_version: 2\n=======\n>>>>>>> other\n', 'merge conflict'],
    ['schema_version: 99\n', 'a schema from the future'],
    ['schema_version: not-a-number\n', 'a non-numeric schema version'],
  ];
  for (const [body, label] of cases) {
    withSandbox(({ project }) => {
      writeLayout(project, body);
      const d = cli.bindOfferDecision(project);
      assert.strictEqual(d.offer, false, `${label}: must NOT be offered a fresh bind`);
      assert.notStrictEqual(d.reason, 'unbound',
        `${label}: reported as \`unbound\` — an unreadable binding and an absent one are different facts`);
      assert.notStrictEqual(d.reason, 'already-bound', `${label}: reported as cleanly bound`);
    });
  }
});

test('[behaviour] AC3 — DECLINING the offer runs nothing and writes nothing', async () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-dec-')));
  const origCwd = process.cwd();
  try {
    process.chdir(base);
    const before = fingerprint(base);
    confirmAnswer = false;
    promptLog = [];
    const r = await cli.offerBind({ projectRoot: base, yes: false });
    assert.strictEqual(r.ran, false, 'bind ran despite the offer being declined');
    assert.ok(promptLog.length >= 1, 'no question was asked at all — the decline was never exercised');
    assert.deepStrictEqual(fingerprint(base), before,
      'declining the offer changed a file. Proved by byte-identity, not by "the writer was not called".');
  } finally {
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC3 — ACCEPTING the offer DOES run bind (control: the decline above is not vacuous)', async () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-acc-')));
  const origCwd = process.cwd();
  try {
    process.chdir(base);
    confirmAnswer = true;
    promptLog = [];
    const r = await cli.offerBind({ projectRoot: base, yes: false });
    assert.strictEqual(r.ran, true, 'accepting the offer did NOT run bind — so the decline test proves nothing');
    assert.ok(fs.existsSync(path.join(base, '_bmad-output', 'project-layout.yaml')),
      'accepting the offer did not write a binding');
  } finally {
    confirmAnswer = false;
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC3 — a NON-INTERACTIVE offer does not auto-accept itself', async () => {
  // `--yes` means "take the defaults", not "answer yes to an offer". There is no
  // user present to choose, and AC3 says the offer never runs bind without one.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-yes-')));
  const origCwd = process.cwd();
  try {
    process.chdir(base);
    const before = fingerprint(base);
    promptLog = [];
    const r = await cli.offerBind({ projectRoot: base, yes: true });
    assert.strictEqual(r.ran, false, '`--yes` auto-accepted the offer and bound the project unasked');
    assert.strictEqual(promptLog.length, 0, 'a non-interactive run must not prompt at all');
    assert.deepStrictEqual(fingerprint(base), before, 'the non-interactive offer wrote a file');
  } finally {
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC3 — a CANCELLED offer prompt is a refusal, not an acceptance', async () => {
  // The permissive-degrade shape this epic keeps producing. `prompts` returns an
  // object with NO key when the user hits Ctrl-C, so the answer reads back as
  // `undefined`. A guard written as `if (answer === false)` treats that as a yes
  // and binds a project the user just walked away from. Only an explicit `true`
  // may run bind.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-cxl-')));
  const origCwd = process.cwd();
  try {
    process.chdir(base);
    const before = fingerprint(base);
    confirmAnswer = undefined;
    promptLog = [];
    const r = await cli.offerBind({ projectRoot: base, yes: false });
    assert.ok(promptLog.length >= 1, 'no question was asked, so the cancellation was never exercised');
    assert.strictEqual(r.ran, false, 'a cancelled prompt ran bind — only an explicit yes may');
    assert.deepStrictEqual(fingerprint(base), before, 'a cancelled offer wrote a file');
  } finally {
    confirmAnswer = false;
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC3 — the offer HAS a production caller: `status` on a global install in an unbound project makes it', () => {
  // An exported `offerBind` that nothing calls would be the "presence, not
  // effect" shape this epic keeps producing — and it is exactly what left Story
  // 31.11's AC6 offer with no reader. This proves the CLI reaches it.
  withSandbox(({ home, project }) => {
    plantGlobalInstall(home);
    const unbound = runCli(['status'], { home, cwd: project });
    assert.strictEqual(unbound.code, 0, `status exited ${unbound.code}:\n${unbound.out}`);
    assert.ok(/no _bmad-output\/project-layout\.yaml/.test(unbound.out),
      `status in an unbound project made no offer:\n${unbound.out}`);
    assert.ok(/Run `ma-agents bind` in this project to create one\. Not doing it for you\./.test(unbound.out),
      `the offer did not state the remedy and stop:\n${unbound.out}`);
    // …and, being non-interactive (spawnSync attaches no TTY), it must NOT have bound.
    assert.deepStrictEqual(fileList(project), [],
      `\`status\` wrote to the project root — the offer bound it without being asked: ` +
      `${JSON.stringify(fileList(project))}`);

    // CONTROL: once the project IS bound, the same command makes no offer. Without
    // this, the assertion above would pass for a status that offers unconditionally.
    const bound = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(bound.code, 0, `bind exited ${bound.code}:\n${bound.out}`);
    const after = runCli(['status'], { home, cwd: project });
    assert.strictEqual(after.code, 0, `status exited ${after.code}:\n${after.out}`);
    assert.ok(!/Run `ma-agents bind` in this project to create one/.test(after.out),
      `status still offers to bind an already-bound project:\n${after.out}`);
  });
});

test('[behaviour] AC3 — `status` on a NON-global install makes no offer (FR252 is the global case)', () => {
  withSandbox(({ home, project }) => {
    const r = runCli(['status'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `status exited ${r.code}:\n${r.out}`);
    assert.ok(!/Run `ma-agents bind` in this project to create one/.test(r.out),
      `a non-global install was offered the bind:\n${r.out}`);
  });
});

// ─── The SHIPPED skill trees ─────────────────────────────────────────────────
//
// N1. TWO trees ship, and `package.json`'s `files` list is the proof: `lib/`
// carries `lib/bmad-extension/skills` (the plugin-bundle mirror) and `skills/` is
// listed in its own right (the source tree, installed directly). Every walk in
// this suite was rooted at the FIRST one only, so the second was never inspected —
// which is precisely the gap that let Story 31.4's derivation table and Story
// 31.11's offer through review. The roots are enumerated ONCE, here, and every
// walk takes this list, so a tree cannot be silently omitted from one check.
const SHIPPED_SKILL_ROOTS = [
  path.join(REPO_ROOT, 'lib', 'bmad-extension', 'skills'),
  path.join(REPO_ROOT, 'skills'),
];

function markdownDocsUnder(root) {
  const docs = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith('.md')) docs.push(full);
    }
  };
  walk(root);
  return docs;
}

test('[text] N1 — the shipped-skill root list covers everything package.json actually ships', () => {
  // The guard on the guard. If a THIRD skill tree is added to `files` later, the
  // walks below would quietly keep inspecting two of three; this fails instead.
  const files = require(path.join(REPO_ROOT, 'package.json')).files || [];
  assert.ok(files.includes('skills/'),
    'package.json no longer ships skills/ — the walks below must be re-argued, not narrowed');
  assert.ok(files.includes('lib/'),
    'package.json no longer ships lib/ — lib/bmad-extension/skills is no longer a shipped tree');
  for (const root of SHIPPED_SKILL_ROOTS) {
    assert.ok(fs.existsSync(root), `shipped skill root does not exist: ${root}`);
  }
  // …and each root must actually contain documents, so an empty tree cannot make
  // every per-root assertion below vacuously true.
  for (const root of SHIPPED_SKILL_ROOTS) {
    assert.ok(markdownDocsUnder(root).length >= 50,
      `${path.relative(REPO_ROOT, root)} holds only ${markdownDocsUnder(root).length} .md file(s) — ` +
      `too few for the per-root assertions to mean anything`);
  }
});

test('[text] AC3 — the offer sits in the documents a skill ACTUALLY LOADS, and names a command that dispatches', () => {
  // THE SURFACE QUESTION. Story 31.11 AC6 put its offer in the global
  // `MANIFEST.yaml`; its reviewer established that nothing directs an agent to
  // read that file at activation time. The surface that IS read when a skill
  // activates is the skill document itself. This asserts the offer is there —
  // in every document carrying Story 31.4's preflight — rather than only in a
  // manifest header.
  // N1. Walked PER ROOT, and the floor is asserted per root: a union count would
  // let one tree carry all the preflights while the other carried none.
  const missing = [];
  for (const root of SHIPPED_SKILL_ROOTS) {
    const withPreflight = markdownDocsUnder(root).filter((f) =>
      fs.readFileSync(f, 'utf-8').includes('Knowledge Store Binding Preflight'));
    assert.ok(withPreflight.length >= 10,
      `only ${withPreflight.length} document(s) under ${path.relative(REPO_ROOT, root)} carry the ` +
      `Story 31.4 preflight — too few for this claim to mean anything for that tree`);
    for (const f of withPreflight) {
      if (!fs.readFileSync(f, 'utf-8').includes('ma-agents bind')) {
        missing.push(path.relative(REPO_ROOT, f));
      }
    }
  }
  assert.deepStrictEqual(missing, [],
    `these shipped skill documents carry the preflight but never name \`ma-agents bind\`, so a ` +
    `skill activating in an unbound project has no offer on the surface it reads`);
});

test('[text] AC3 — the offer text HALTS and instructs; it never tells an agent to run bind itself', () => {
  // "The offer never runs bind without the user's choice", on the text surface:
  // the preflight's own contract is that it is READ-ONLY and stops rather than
  // repairing. Anchored on the two sentences that carry that property.
  const doc = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'bmad-extension', 'skills', 'add-sprint', 'SKILL.md'), 'utf-8');
  assert.ok(doc.includes('**This preflight is read-only.**'),
    'the preflight no longer declares itself read-only');
  assert.ok(doc.includes('Regenerating the config belongs to the installer and to `ma-agents bind`, never to a skill.'),
    'the preflight no longer forbids a skill from running the regeneration itself');
  assert.ok(doc.includes('Nothing has been read or written on your behalf. Stopping rather than guessing.'),
    'the HALT no longer states that nothing was done on the user\'s behalf');
});

test('[text] AC3 — no shipped skill document points an agent at the GLOBAL MANIFEST.yaml', () => {
  // Reproduces Story 31.11's reviewer finding as a LIVE assertion, so a future
  // attempt to move the offer back onto that surface fails here. Every
  // MANIFEST.yaml a shipped skill document cites is a `{project-root}` path — the
  // per-project skills manifest — never the global skills directory's manifest
  // that GLOBAL_BIND_OFFER_HEADER is written into.
  // N1. Both shipped trees. `skills/` cites MANIFEST.yaml zero times today, so
  // this is the lower-risk half of the widening — but "zero today" is exactly the
  // state an unasserted check is worst at protecting.
  const offenders = [];
  for (const root of SHIPPED_SKILL_ROOTS) {
    for (const full of markdownDocsUnder(root)) {
      for (const line of fs.readFileSync(full, 'utf-8').split(/\r?\n/)) {
        if (line.includes('MANIFEST.yaml') && !line.includes('{project-root}')) {
          offenders.push(`${path.relative(REPO_ROOT, full)}: ${line.trim()}`);
        }
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    `a shipped skill document now cites a MANIFEST.yaml outside {project-root}. If the AC3 offer ` +
    `has been moved onto that surface, this suite's "the offer reaches a reader" claim must be ` +
    `re-argued, not silently widened:\n${offenders.join('\n')}`);
  // …and the global header is still emitted for a global install, so nothing was
  // silently deleted from Story 31.11 either.
  assert.ok(typeof installer.GLOBAL_BIND_OFFER_HEADER === 'string'
    && installer.GLOBAL_BIND_OFFER_HEADER.includes('_bmad-output/project-layout.yaml'),
    'Story 31.11\'s global MANIFEST.yaml header was removed rather than left in place');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC4 — idempotent and non-destructive (NFR78), proved by byte-identity
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC4 — a second bind leaves every file byte-identical');

const secondRun = withSandbox(({ home, project }) => {
  const first = runCli(['bind', '--yes'], { home, cwd: project });
  const beforeProject = fingerprint(project);
  const beforeHome = fingerprint(home);
  const second = runCli(['bind', '--yes'], { home, cwd: project });
  return {
    first, second,
    beforeProject, afterProject: fingerprint(project),
    beforeHome, afterHome: fingerprint(home),
  };
});

test('[behaviour] AC4 — both runs exited 0 (gate: a crashed second run would "change nothing" too)', () => {
  assert.strictEqual(secondRun.first.code, 0, `the first bind exited ${secondRun.first.code}:\n${secondRun.first.out}`);
  assert.strictEqual(secondRun.second.code, 0, `the second bind exited ${secondRun.second.code}:\n${secondRun.second.out}`);
});

test('[behaviour] AC4 — the first run wrote something (gate: comparing two empty trees proves nothing)', () => {
  assert.ok(Object.keys(secondRun.beforeProject).length >= 3,
    `the first bind left only ${Object.keys(secondRun.beforeProject).length} file(s); the ` +
    `byte-identity comparison below would be near-empty`);
});

test('[behaviour] AC4 — the second run leaves EVERY file under the project root byte-identical', () => {
  assert.deepStrictEqual(secondRun.afterProject, secondRun.beforeProject,
    'a second bind changed a file. This is a sha256-per-file comparison, so any change in ' +
    'content — including a refreshed `generated:` date — fails here.');
});

test('[behaviour] AC4 — the second run REPORTED the existing bindings rather than silently doing nothing', () => {
  const out = secondRun.second.out;
  assert.ok(/already bound/i.test(out),
    `the second run did not report that the project is already bound:\n${out}`);
  assert.ok(/Current Repository Layout/.test(out),
    `the second run did not print the existing bindings — AC4 requires it to REPORT them:\n${out}`);
  assert.ok(/left unchanged/i.test(out),
    `the second run did not state that nothing was changed:\n${out}`);
});

test('[behaviour] AC4 — the re-bind "change any of these answers?" prompt DEFAULTS TO NO', async () => {
  // Defect shape (a): a default degrading to permissive. Pressing Enter on a
  // re-bind must not re-answer the wizard, because AC4's "changes nothing unless
  // the user EXPLICITLY edits an answer" is what makes bind safe to run on a
  // whim — and Story 31.4's HALT text tells users to do exactly that.
  //
  // The expectation is the literal `false`, checked against the prompt the code
  // actually issued. Asserting byte-identity alone would not catch this: a
  // re-collection that accepts every pre-population reproduces the same bytes on
  // the same calendar day, so the wrong default would pass unnoticed.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-def-')));
  const origCwd = process.cwd();
  try {
    process.chdir(base);
    confirmAnswer = PRESS_ENTER;
    promptLog = [];
    await cli.handleBind([]);                    // first bind: writes the binding
    const afterFirst = fingerprint(base);
    assert.ok(Object.keys(afterFirst).length >= 3, 'the first bind wrote nothing to compare against');

    promptLog = [];
    await cli.handleBind([]);                    // second bind: interactive, Enter
    const edit = promptLog.filter((q) => q.type === 'confirm');
    assert.strictEqual(edit.length, 1,
      `a re-bind must ask exactly one confirm question, asked ${edit.length}: ${JSON.stringify(promptLog)}`);
    assert.strictEqual(edit[0].initial, false,
      `the re-bind edit prompt pre-selects ${JSON.stringify(edit[0].initial)} — pressing Enter would ` +
      `re-answer the whole wizard`);
    assert.deepStrictEqual(fingerprint(base), afterFirst,
      'pressing Enter on the re-bind prompt changed a file');
  } finally {
    confirmAnswer = false;
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC5 — bind never overwrites an existing project-context.md
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC5 — an existing project-context.md is left untouched, and the skip is announced');

const contextRun = withSandbox(({ home, project }) => {
  const ctxPath = path.join(project, '_bmad-output', 'project-context.md');
  fs.mkdirSync(path.dirname(ctxPath), { recursive: true });
  // Deliberately NOT what the generator would produce — hand-written content
  // whose survival is unambiguous.
  const HAND_WRITTEN = '# my own project context\n\nhand written, do not touch\n';
  fs.writeFileSync(ctxPath, HAND_WRITTEN, 'utf-8');
  const r = runCli(['bind', '--yes'], { home, cwd: project });
  return { r, HAND_WRITTEN, after: fs.readFileSync(ctxPath, 'utf-8') };
});

test('[behaviour] AC5 — the bind run that met an existing context EXITED 0 (gate)', () => {
  assert.strictEqual(contextRun.r.code, 0,
    `bind exited ${contextRun.r.code}; "the file survived" would be true of a crash too:\n${contextRun.r.out}`);
});

test('[behaviour] AC5 — the existing project-context.md is byte-identical afterwards', () => {
  assert.strictEqual(contextRun.after, contextRun.HAND_WRITTEN,
    'bind modified an existing project-context.md. Compared against a literal written in this ' +
    'test, so a generator that happened to produce the same file could not mask it.');
});

test('[behaviour] AC5 — and the skip is stated, not silent', () => {
  assert.ok(/project-context\.md already exists/i.test(contextRun.r.out),
    `bind did not announce that generation was skipped:\n${contextRun.r.out}`);
});

test('[behaviour] AC5 — control: with NO project-context.md, bind DOES generate one', () => {
  // Without this, "the file was not overwritten" is satisfied by a bind that
  // never writes project-context.md under any circumstances.
  assert.ok(firstRun.files.includes('_bmad-output/project-context.md'),
    'bind never generates project-context.md at all, so AC5\'s non-overwrite claim is vacuous');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC6 — config.yaml regenerated; the config.user.toml files untouched
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC6 — config.yaml is regenerated from the binding; config.user.toml is never touched');

test('[behaviour] AC6 — config.yaml is generated from the layout and carries the binding stamp', () => {
  assert.ok(firstRun.config, '_bmad/bmm/config.yaml was not generated by bind');
  assert.ok(/^project_layout_stamp: *"?sha256:[0-9a-f]{64}"?$/m.test(firstRun.config),
    `the generated config carries no well-formed project_layout_stamp:\n${firstRun.config}`);
  assert.ok(/^knowledgebase_path:/m.test(firstRun.config),
    `the generated config carries no knowledgebase_path:\n${firstRun.config}`);
});

test('[behaviour] AC6 — neither _bmad/config.user.toml nor _bmad/custom/config.user.toml is touched', () => {
  withSandbox(({ home, project }) => {
    const a = path.join(project, '_bmad', 'config.user.toml');
    const b = path.join(project, '_bmad', 'custom', 'config.user.toml');
    fs.mkdirSync(path.dirname(b), { recursive: true });
    const A = '# user overrides A\nfoo = "bar"\n';
    const B = '# user overrides B\nbaz = "qux"\n';
    fs.writeFileSync(a, A, 'utf-8');
    fs.writeFileSync(b, B, 'utf-8');

    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `bind exited ${r.code}; the survival claim below would be a crash artifact:\n${r.out}`);
    // The presence control: bind DID do its work in this same tree.
    assert.ok(fs.existsSync(path.join(project, '_bmad', 'bmm', 'config.yaml')),
      'bind wrote no config.yaml here, so "it left the user TOMLs alone" proves nothing');

    assert.strictEqual(fs.readFileSync(a, 'utf-8'), A, '_bmad/config.user.toml was modified (P5-9.4)');
    assert.strictEqual(fs.readFileSync(b, 'utf-8'), B, '_bmad/custom/config.user.toml was modified (P5-9.4)');
  });
});

test('[behaviour] AC6 — a re-bind that edits NOTHING still regenerates a STALE config.yaml', () => {
  // THE STORY 31.4 REMEDY, END TO END. Its staleness HALT says: "Run `ma-agents
  // bind` to regenerate `_bmad/bmm/config.yaml` from the committed binding."
  // The user reaching that message has changed NOTHING — the binding moved under
  // them, or the config was damaged — so a bind that skipped generation whenever
  // no answer was edited would leave that instruction false in the one situation
  // it is ever given in. This is also why AC4's byte-identity is proved by
  // determinism rather than by "nothing ran".
  withSandbox(({ home, project }) => {
    const first = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(first.code, 0, `the first bind exited ${first.code}:\n${first.out}`);
    const cfgPath = path.join(project, '_bmad', 'bmm', 'config.yaml');
    const good = fs.readFileSync(cfgPath, 'utf-8');
    assert.ok(/^knowledgebase_path: *"\."$/m.test(good),
      `the generated config does not carry the expected knowledgebase_path:\n${good}`);

    // Damage it the way a bad merge or a hand-edit would.
    fs.writeFileSync(cfgPath, good.replace(/^knowledgebase_path: *".*"$/m,
      'knowledgebase_path: "/somewhere/the/stores/used/to/be"'), 'utf-8');
    assert.ok(/used\/to\/be/.test(fs.readFileSync(cfgPath, 'utf-8')), 'the damage was not applied');

    const second = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(second.code, 0, `the second bind exited ${second.code}:\n${second.out}`);
    assert.ok(/left unchanged/i.test(second.out),
      `the second run took the EDIT path, so this does not test the no-edit branch:\n${second.out}`);
    assert.strictEqual(fs.readFileSync(cfgPath, 'utf-8'), good,
      'a no-edit re-bind did not regenerate a stale config.yaml, so Story 31.4\'s HALT remedy does ' +
      'not work for the case it is written for');
  });
});

test('[text] AC6 — `config.user.yaml` DOES NOT EXIST; the vacuity is recorded rather than hidden', () => {
  // `sprint-status.yaml`'s comment for this story names `config.user.yaml`. THE
  // FILE DOES NOT EXIST. `bin/cli.js` mentions the name exactly once, and only to
  // say so ("root and user configs are TOML — `config.user.yaml` does not
  // exist."). A test "asserting bind does not touch config.user.yaml" would
  // therefore pass without exercising anything, and this suite says that OUT LOUD
  // instead of banking a free green. The real, non-vacuous assertion is the
  // `config.user.toml` byte-identity test above.
  //
  // What IS checkable is pinned: every mention of the name in production source
  // must remain a mention that it does not exist. The moment one appears in a
  // path join, a read or a write, this fails and AC6 needs a real assertion.
  const mentions = [];
  for (const [label, src] of [['bin/cli.js', CLI_SOURCE], ['lib/installer.js', INSTALLER_SOURCE]]) {
    for (const line of src.split('\n')) {
      if (line.includes('config.user.yaml')) mentions.push({ label, line: line.trim() });
    }
  }
  assert.strictEqual(mentions.length, 1,
    `expected exactly one mention of config.user.yaml — the comment recording its non-existence. ` +
    `Found ${mentions.length}: ${JSON.stringify(mentions, null, 2)}`);
  assert.ok(/does not exist/.test(mentions[0].line),
    `the sole mention of config.user.yaml is no longer a statement that it does not exist: ` +
    `${JSON.stringify(mentions[0])}`);
  assert.ok(/^\s*\*/.test(mentions[0].line) || /^\s*\/\//.test(mentions[0].line),
    `the sole mention of config.user.yaml is no longer inside a comment: ${JSON.stringify(mentions[0])}`);
  // And the two files that DO exist are named in the AC6 test above, by literal.
  assert.ok(CLI_SOURCE.includes('config.user.toml'),
    'the P5-9.4 rationale no longer names config.user.toml anywhere in bin/cli.js');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC7 — `ma-agents status` reports scope and the bound-project list
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC7 — status reports the active scope and each bound project\'s health');

/** Plant a global-scope skills manifest so `getStatus` sees a global install. */
function plantGlobalInstall(home) {
  const dirs = [
    path.join(home, 'AppData', 'Roaming', 'Claude', 'skills'),
    path.join(home, '.config', 'claude', 'skills'),
    path.join(home, 'Library', 'Application Support', 'Claude', 'skills'),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, '.ma-agents.json'), JSON.stringify({
      manifestVersion: '1.1.0', agent: 'claude-code', agents: ['claude-code'], scope: 'global',
      skills: { 'code-review': { version: '1.0.0', installedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } },
    }), 'utf-8');
  }
}

const statusRun = withSandbox(({ base, home, project }) => {
  const bind = runCli(['bind', '--yes'], { home, cwd: project });
  plantGlobalInstall(home);
  const healthy = runCli(['status'], { home, cwd: base });
  // Now MOVE the project, exactly the AC7 case: bound, then relocated.
  fs.renameSync(project, path.join(base, 'project-moved'));
  const moved = runCli(['status'], { home, cwd: base });
  return { bind, healthy, moved, project };
});

test('[behaviour] AC7 — status reports the active install scope', () => {
  assert.strictEqual(statusRun.healthy.code, 0, `status exited ${statusRun.healthy.code}:\n${statusRun.healthy.out}`);
  assert.ok(/Install scope: global/.test(statusRun.healthy.out),
    `status did not report the active install scope:\n${statusRun.healthy.out}`);
});

test('[behaviour] AC7 — for a global install, status lists the projects bound on this machine', () => {
  assert.ok(/Bound projects on this machine:/.test(statusRun.healthy.out),
    `status did not list bound projects:\n${statusRun.healthy.out}`);
  assert.ok(statusRun.healthy.out.includes(statusRun.project),
    `the bound project root is not in the listing:\n${statusRun.healthy.out}`);
  assert.ok(/\[bound\]/.test(statusRun.healthy.out),
    `the healthy project is not marked as bound:\n${statusRun.healthy.out}`);
});

test('[behaviour] AC7 — a bound-then-MOVED project is shown as missing, not silently listed as healthy', () => {
  assert.strictEqual(statusRun.moved.code, 0, `status exited ${statusRun.moved.code}:\n${statusRun.moved.out}`);
  assert.ok(statusRun.moved.out.includes(statusRun.project),
    `the moved project is no longer listed at all — AC7 requires it to be VISIBLE as moved:\n${statusRun.moved.out}`);
  assert.ok(/\[missing\]/.test(statusRun.moved.out),
    `the moved project is not marked as missing:\n${statusRun.moved.out}`);
  assert.ok(!/\[bound\]/.test(statusRun.moved.out),
    `the moved project is still reported as healthy:\n${statusRun.moved.out}`);
});

test('[behaviour] AC7 — with no global install, status reports a non-global scope and lists no projects', () => {
  withSandbox(({ base, home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    const r = runCli(['status'], { home, cwd: base });
    assert.strictEqual(r.code, 0, `status exited ${r.code}:\n${r.out}`);
    assert.ok(/Install scope: (none detected|project)/.test(r.out),
      `status reported a global scope where none is installed:\n${r.out}`);
    assert.ok(!/Bound projects on this machine:/.test(r.out),
      `the bound-project listing is a GLOBAL-install report (FR253) and must not appear here:\n${r.out}`);
  });
});

test('[behaviour] AC7 — describeBoundProjects distinguishes bound, missing and unreadable', () => {
  // Driven directly so each state is checked as data rather than scraped prose.
  const realHome = os.homedir();
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-desc-')));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = base;
    process.env.USERPROFILE = base;
    assert.notStrictEqual(os.homedir(), realHome,
      'HOME redirection did not take effect — this test would write into the developer\'s real home');

    const good = path.join(base, 'good');
    const bad = path.join(base, 'bad');
    const gone = path.join(base, 'gone');
    for (const d of [good, bad]) fs.mkdirSync(d, { recursive: true });
    writeLayout(good, VALID_LAYOUT);
    writeLayout(bad, '<<<<<<< HEAD\nschema_version: 2\n=======\n>>>>>>> x\n');
    boundProjects.recordBoundProject(good);
    boundProjects.recordBoundProject(bad);
    boundProjects.recordBoundProject(gone);

    const byRoot = new Map(cli.describeBoundProjects().map((e) => [path.resolve(e.root), e]));
    assert.strictEqual(byRoot.size, 3, `expected 3 recorded projects, got ${byRoot.size}`);
    assert.strictEqual(byRoot.get(path.resolve(good)).state, 'bound');
    assert.strictEqual(byRoot.get(path.resolve(good)).ok, true);
    assert.strictEqual(byRoot.get(path.resolve(gone)).state, 'missing');
    assert.strictEqual(byRoot.get(path.resolve(gone)).ok, false);
    const badState = byRoot.get(path.resolve(bad)).state;
    assert.ok(['unreadable', 'invalid', 'too-new'].includes(badState),
      `a damaged binding must report its own reason, got ${JSON.stringify(badState)}`);
    assert.strictEqual(byRoot.get(path.resolve(bad)).ok, false,
      'a project whose binding cannot be read must not be listed as healthy');
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origProfile;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC8 / OQ-1 — the four properties of the bound-project record
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nAC8 / OQ-1 — per-machine, outside any project, uncommitted, and status-only');

test('[behaviour] AC8 P1 — the record is PER-MACHINE: it lives under os.homedir(), and follows it', () => {
  const realHome = os.homedir();
  assert.strictEqual(boundProjects.boundProjectsPath(),
    path.join(realHome, '.ma-agents', 'bound-projects.json'),
    'the OQ-1 location is not ~/.ma-agents/bound-projects.json');
  // …and it is genuinely re-derived per call, not frozen at require time — which
  // is what makes it per-machine rather than per-process.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-home-')));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = base;
    process.env.USERPROFILE = base;
    assert.strictEqual(boundProjects.boundProjectsPath(),
      path.join(base, '.ma-agents', 'bound-projects.json'),
      'the registry path is cached at module load, so it is not per-machine at all');
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origProfile;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] AC8 P2 — the record is OUTSIDE any project: it landed in the sandbox HOME, not the project', () => {
  const registryInHome = firstRun.homeFiles.filter((f) => f.endsWith('bound-projects.json'));
  assert.deepStrictEqual(registryInHome, ['.ma-agents/bound-projects.json'],
    `the bound-project record was not written to ~/.ma-agents/. Files under the sandbox HOME:\n` +
    `${JSON.stringify(firstRun.homeFiles, null, 2)}`);
  const registryInProject = firstRun.files.filter((f) => /bound-projects|\.ma-agents/.test(f));
  assert.deepStrictEqual(registryInProject, [],
    `the bound-project record leaked into the project root:\n${JSON.stringify(registryInProject, null, 2)}`);
});

test('[behaviour] AC8 P3 — it is not written into any committed artifact: nothing under _bmad-output/ names it', () => {
  withSandbox(({ home, project }) => {
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `bind exited ${r.code}:\n${r.out}`);
    const outDir = path.join(project, '_bmad-output');
    assert.ok(fs.existsSync(outDir), 'no _bmad-output/ was produced, so this scan asserts nothing');
    const scanned = [];
    for (const f of fileList(outDir)) {
      scanned.push(f);
      const body = fs.readFileSync(path.join(outDir, f), 'utf-8');
      assert.ok(!body.includes('bound-projects'),
        `${f} — a committed artifact — names the per-machine bound-project record`);
      assert.ok(!body.includes('.ma-agents/bound-projects'),
        `${f} — a committed artifact — carries the registry path`);
    }
    assert.ok(scanned.length >= 2, `only ${scanned.length} committed artifact(s) were scanned`);
  });
});

test('[behaviour] AC8 P4 — LOSING the record does not change resolution at all', () => {
  withSandbox(({ home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    const withRecord = cli.resolveProjectTopology(project);
    assert.ok(withRecord.ok, 'the fixture must resolve, or this comparison means nothing');
    fs.rmSync(path.join(home, '.ma-agents'), { recursive: true, force: true });
    const withoutRecord = cli.resolveProjectTopology(project);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(withoutRecord)),
      JSON.parse(JSON.stringify(withRecord)),
      'deleting the per-machine record changed what resolveProjectTopology returns. NFR83 requires ' +
      'resolution to depend on the project root alone.');
  });
});

test('[behaviour] AC8 P4 — LOSING the record degrades `status` OUTPUT only, and status still exits 0', () => {
  withSandbox(({ base, home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    plantGlobalInstall(home);
    const before = runCli(['status'], { home, cwd: base });
    assert.ok(/Bound projects on this machine:/.test(before.out),
      `the listing was never produced, so its loss cannot be observed:\n${before.out}`);

    fs.rmSync(path.join(home, '.ma-agents'), { recursive: true, force: true });
    const after = runCli(['status'], { home, cwd: base });
    assert.strictEqual(after.code, 0, `status exited ${after.code} after the record was lost:\n${after.out}`);
    assert.ok(/Install scope: global/.test(after.out),
      `status stopped reporting the install scope after the record was lost:\n${after.out}`);
    assert.ok(/No projects recorded as bound on this machine/.test(after.out),
      `status did not say the record is empty:\n${after.out}`);
    assert.ok(!/Bound projects on this machine:/.test(after.out),
      `status still claims to list bound projects with no record to list from:\n${after.out}`);
  });
});

test('[behaviour] AC8 — losing the record does not break BIND either, and bind rebuilds it', () => {
  withSandbox(({ home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    fs.rmSync(path.join(home, '.ma-agents'), { recursive: true, force: true });
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `bind exited ${r.code} with no per-machine record present:\n${r.out}`);
    assert.ok(fs.existsSync(path.join(home, '.ma-agents', 'bound-projects.json')),
      'bind did not re-create the per-machine record');
  });
});

test('[behaviour] AC8 — an UNREADABLE record is not conflated with an absent one, and neither fails bind', () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-reg-')));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = base;
    process.env.USERPROFILE = base;
    assert.strictEqual(boundProjects.readBoundProjects().reason, 'absent',
      'a machine with no registry must read as `absent`');
    fs.mkdirSync(path.join(base, '.ma-agents'), { recursive: true });
    fs.writeFileSync(path.join(base, '.ma-agents', 'bound-projects.json'), '{ not json', 'utf-8');
    const damaged = boundProjects.readBoundProjects();
    assert.strictEqual(damaged.ok, false);
    assert.strictEqual(damaged.reason, 'unreadable',
      `a damaged registry must read as \`unreadable\`, not as \`absent\` — got ${JSON.stringify(damaged.reason)}`);
    // …and recording over it still succeeds: the registry is a rebuildable
    // display cache, never authoritative state.
    const rec = boundProjects.recordBoundProject(base);
    assert.strictEqual(rec.ok, true, `recording over a damaged registry failed: ${rec.message}`);
    assert.strictEqual(boundProjects.readBoundProjects().ok, true, 'the registry was not repaired by the write');
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origProfile;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

/** Run `fn` with HOME/USERPROFILE redirected into a throwaway directory. */
function withSandboxHome(fn) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-hm-')));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = base;
    process.env.USERPROFILE = base;
    assert.ok(boundProjectsPathIsUnder(base), 'HOME redirection did not take effect');
    return fn(base);
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origProfile;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
function boundProjectsPathIsUnder(base) {
  return path.resolve(boundProjects.boundProjectsPath()).startsWith(path.resolve(base) + path.sep);
}

test('[behaviour] AC8 — the record is DETERMINISTIC: the same set of projects gives the same bytes', () => {
  // NFR81's determinism rule, applied to the registry. Written in two different
  // orders; the file must not depend on which project happened to be bound first,
  // or the record becomes a source of spurious diffs and of "did it change?"
  // ambiguity in `status`.
  // The sandbox home differs between the two runs, so it is masked out of the
  // BYTES before comparison — in its JSON-ESCAPED form, which is how it actually
  // appears in the file (`C:\\Users\\…`). Masking the un-escaped form matches
  // nothing on Windows, and the comparison then fails for a reason that has
  // nothing to do with ordering. The mask asserts it actually fired.
  const at = new Date('2026-01-01T00:00:00.000Z');
  const readMasked = (base) => {
    const raw = fs.readFileSync(boundProjects.boundProjectsPath(), 'utf-8');
    const escaped = JSON.stringify(base).slice(1, -1);
    const masked = raw.split(escaped).join('<HOME>');
    assert.ok(masked.includes('<HOME>'),
      `the sandbox home was not found in the registry bytes, so the mask did nothing:\n${raw}`);
    return masked;
  };
  const forward = withSandboxHome((base) => {
    boundProjects.recordBoundProject(path.join(base, 'alpha'), at);
    boundProjects.recordBoundProject(path.join(base, 'beta'), at);
    boundProjects.recordBoundProject(path.join(base, 'gamma'), at);
    return readMasked(base);
  });
  const backward = withSandboxHome((base) => {
    boundProjects.recordBoundProject(path.join(base, 'gamma'), at);
    boundProjects.recordBoundProject(path.join(base, 'beta'), at);
    boundProjects.recordBoundProject(path.join(base, 'alpha'), at);
    return readMasked(base);
  });
  assert.ok(forward.includes('alpha') && forward.includes('gamma'),
    'the fixture did not record three projects, so this comparison is vacuous');
  assert.strictEqual(backward, forward,
    'the registry bytes depend on the ORDER projects were bound in, not on the set of them');
});

test('[behaviour] AC8 — re-binding the same project does not append a second entry', () => {
  withSandboxHome((base) => {
    const p = path.join(base, 'proj');
    boundProjects.recordBoundProject(p);
    boundProjects.recordBoundProject(p);
    boundProjects.recordBoundProject(p);
    const r = boundProjects.readBoundProjects();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.projects.length, 1,
      `three binds of one project produced ${r.projects.length} entries — \`status\` would list it repeatedly`);
  });
  // …and on a case-insensitive filesystem, a differently-cased root is the SAME
  // project. Only asserted where the platform actually is case-insensitive;
  // stated as a skip rather than passing silently elsewhere.
  if (process.platform === 'win32' || process.platform === 'darwin') {
    withSandboxHome((base) => {
      boundProjects.recordBoundProject(path.join(base, 'Proj'));
      boundProjects.recordBoundProject(path.join(base, 'proj'));
      assert.strictEqual(boundProjects.readBoundProjects().projects.length, 1,
        'a differently-cased project root produced a second entry on a case-insensitive filesystem');
    });
  }
});

test('[behaviour] AC8 — a registry from a different shape version is `unreadable`, not silently accepted', () => {
  withSandboxHome((base) => {
    fs.mkdirSync(path.join(base, '.ma-agents'), { recursive: true });
    fs.writeFileSync(path.join(base, '.ma-agents', 'bound-projects.json'),
      JSON.stringify({ version: 999, projects: [{ root: 'C:\\somewhere' }] }), 'utf-8');
    const r = boundProjects.readBoundProjects();
    assert.strictEqual(r.ok, false,
      'a registry declaring an unknown version was read as if this build wrote it');
    assert.strictEqual(r.reason, 'unreadable', `got ${JSON.stringify(r.reason)}`);
  });
});

test('[behaviour] AC8 — a damaged ENTRY is dropped; it never surfaces as an unnamed project', () => {
  withSandboxHome((base) => {
    const good = path.join(base, 'good');
    fs.mkdirSync(path.join(base, '.ma-agents'), { recursive: true });
    fs.writeFileSync(path.join(base, '.ma-agents', 'bound-projects.json'), JSON.stringify({
      version: 1,
      projects: [{ root: good, boundAt: '2026-01-01T00:00:00.000Z' }, { boundAt: 'x' }, null, { root: '' }, 'nonsense'],
    }), 'utf-8');
    const r = boundProjects.readBoundProjects();
    assert.strictEqual(r.ok, true, 'one damaged entry made the whole registry unreadable, hiding every other project');
    assert.deepStrictEqual(r.projects.map((p) => p.root), [good],
      `damaged entries leaked into the listing: ${JSON.stringify(r.projects)}`);
    for (const p of r.projects) {
      assert.strictEqual(typeof p.root, 'string');
      assert.notStrictEqual(p.root, '');
    }
  });
});

test('[behaviour] AC8 — the record names the root the user BOUND, not one resolved through a link', () => {
  // `path.resolve`, never `fs.realpathSync`. A bound project that has since been
  // DELETED is exactly the case AC7 exists to surface, and `realpathSync` throws
  // on a path that no longer exists; resolving through a link would also make
  // `status` list a path the user never typed.
  withSandboxHome((base) => {
    const real = path.join(base, 'real-project');
    const link = path.join(base, 'linked-project');
    fs.mkdirSync(real, { recursive: true });
    try {
      fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (e) {
      throw new Error(`could not create a link fixture (${e.message}) — this test must not silently skip`);
    }
    assert.ok(fs.existsSync(link), 'the link fixture was not created');
    assert.notStrictEqual(fs.realpathSync(link), path.resolve(link),
      'the link resolves to itself on this filesystem, so the distinction cannot be observed');

    boundProjects.recordBoundProject(link);
    const r = boundProjects.readBoundProjects();
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.projects.map((p) => p.root), [path.resolve(link)],
      `the registry recorded ${JSON.stringify(r.projects.map((p) => p.root))} rather than the path ` +
      `that was bound (${path.resolve(link)})`);
  });
});

test('[behaviour] AC8 — status says WHICH failure it found: an absent record reads differently from a damaged one', () => {
  // The `absent` / `unreadable` distinction has to survive all the way to the
  // output, or the discriminated result is doing no work for the user. "Nothing
  // has been bound on this machine" and "there is a record here I cannot read"
  // call for different actions.
  const absentMsg = withSandbox(({ base, home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    plantGlobalInstall(home);
    fs.rmSync(path.join(home, '.ma-agents'), { recursive: true, force: true });
    return runCli(['status'], { home, cwd: base }).out;
  });
  const damagedMsg = withSandbox(({ base, home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    plantGlobalInstall(home);
    fs.writeFileSync(path.join(home, '.ma-agents', 'bound-projects.json'), '{ not json', 'utf-8');
    return runCli(['status'], { home, cwd: base }).out;
  });
  assert.ok(/No projects recorded as bound on this machine/.test(absentMsg),
    `the absent case does not say the record is empty:\n${absentMsg}`);
  assert.ok(/could not be read/.test(damagedMsg),
    `the damaged case does not say the record could not be read:\n${damagedMsg}`);
  assert.ok(!/No projects recorded as bound on this machine/.test(damagedMsg),
    `a DAMAGED record is reported as "nothing has been bound" — the two facts are conflated, and the ` +
    `user is told their projects are gone rather than that the file is broken:\n${damagedMsg}`);
});

test('[text] AC8/OQ-1 — the decision is RECORDED in the source, as a story-level decision', () => {
  const src = fs.readFileSync(BOUND_PROJECTS_PATH, 'utf-8').replace(/\r\n/g, '\n');
  assert.ok(/OQ-1 IS SETTLED HERE/.test(src),
    'lib/bound-projects.js does not record that it settles OQ-1');
  assert.ok(/No FR and no part of Decision P5-9 says where this record lives/.test(src),
    'the source does not state that this is a decision rather than an inherited requirement');
  assert.ok(src.includes("path.join(os.homedir(), '.ma-agents', 'bound-projects.json')"),
    'the chosen location is not stated explicitly in the decision record');
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDOFFS — the 31.4 HALT text, and the 31.11 manifest-scope back-fill
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nHandoffs — the Story 31.4 HALT text, and the ensureManifest scope back-fill');

test('[behaviour] the command Story 31.4\'s HALT text names now DISPATCHES', () => {
  // Before this story, `ma-agents bind` fell through to `default:` and opened the
  // interactive wizard. The discriminator is the refusal path, which only
  // `handleBind` can produce: a project with an unreadable binding.
  withSandbox(({ home, project }) => {
    writeLayout(project, '<<<<<<< HEAD\nschema_version: 2\n=======\n>>>>>>> x\n');
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.ok(/Refusing to bind/.test(r.out),
      `\`ma-agents bind\` did not reach handleBind — it fell through to another command:\n${r.out}`);
    assert.notStrictEqual(r.code, 0, 'a refused bind must not exit 0');
  });
});

test('[text] every `ma-agents <verb>` the preflight instructs a user to run is a verb the CLI dispatches', () => {
  // The whole point of handoff (a): the HALT text must name commands that exist.
  const doc = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'bmad-extension', 'skills', 'add-sprint', 'SKILL.md'), 'utf-8');
  const preflight = doc.slice(doc.indexOf('## Knowledge Store Binding Preflight'), doc.indexOf('## Backend Routing'));
  assert.ok(preflight.length > 500, 'the preflight section could not be isolated');
  // BACKTICKED forms only. The preflight's prose also contains phrases like
  // "ma-agents is" and "ma-agents wrote"; an unanchored match reads those as
  // command names and the test then fails for a reason that has nothing to do
  // with the property. A command a user is told to RUN is always in code ticks.
  const verbs = new Set();
  for (const m of preflight.matchAll(/`(?:npx )?ma-agents ([a-z][a-z-]*)[^`]*`/g)) verbs.add(m[1]);
  assert.ok(verbs.size >= 2, `only ${verbs.size} command(s) found in the preflight text: ${[...verbs]}`);
  for (const verb of verbs) {
    assert.ok(new RegExp(`case '${verb}':`).test(CLI_SOURCE),
      `the preflight tells the user to run \`ma-agents ${verb}\`, which bin/cli.js does not dispatch`);
  }
  assert.ok(verbs.has('bind'), 'the preflight no longer names `bind`, so this check stopped covering it');
});

test('[behaviour] ensureManifest BACK-FILLS scope on its migrate branch', () => {
  // Handoff (c). Previously `scope` was stamped only when a manifest was created,
  // so a migrated manifest kept a missing or stale value — and Story 31.11's
  // global bind-offer header, which is gated on `manifest.scope === 'global'`,
  // was silently suppressed for it.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-mani-')));
  try {
    // A pre-existing manifest with NO scope field at all.
    fs.writeFileSync(path.join(base, '.ma-agents.json'), JSON.stringify({
      manifestVersion: '1.0.0', agent: 'claude-code', skills: {},
    }), 'utf-8');
    const migrated = installer.ensureManifest(base, 'claude-code', 'global');
    assert.strictEqual(migrated.scope, 'global',
      'ensureManifest did not back-fill `scope` on the migrate branch');

    // A pre-existing manifest with a STALE scope.
    fs.writeFileSync(path.join(base, '.ma-agents.json'), JSON.stringify({
      manifestVersion: '1.1.0', agent: 'claude-code', agents: ['claude-code'], scope: 'project', skills: {},
    }), 'utf-8');
    assert.strictEqual(installer.ensureManifest(base, 'claude-code', 'global').scope, 'global',
      'ensureManifest did not correct a stale `scope` on the migrate branch');

    // …and a caller that supplies no scope cannot ERASE a correct one.
    fs.writeFileSync(path.join(base, '.ma-agents.json'), JSON.stringify({
      manifestVersion: '1.1.0', agent: 'claude-code', agents: ['claude-code'], scope: 'global', skills: {},
    }), 'utf-8');
    assert.strictEqual(installer.ensureManifest(base, 'claude-code', undefined).scope, 'global',
      'ensureManifest erased a recorded scope when the caller supplied none');
  } finally {
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// FIX ROUND — A BIND WHOSE AUTHORITATIVE WRITE FAILED MUST NOT REPORT SUCCESS
//
// The defect, verbatim from the review: a bind run in a project where
// `_bmad-output` is a FILE printed `Bound.`, exited 0, generated
// `_bmad/bmm/config.yaml` from a binding that does not exist, and recorded the
// project in the per-machine registry.
//
// The root cause was STRUCTURAL. `writeProjectLayoutYaml` swallowed the failure
// and returned void from all five of its exits, so `handleBind`'s own try/catch —
// written for exactly this hazard — was DEAD CODE on that path, and `handleBind`
// had no way to learn the write had failed. Testing the four symptoms alone would
// leave that blindness in place for the next caller, so the OUTCOME CONTRACT is
// tested first and the symptoms second.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nFIX ROUND — the authoritative write reports its outcome, and bind gates on it');

// `capture` above returns the LOG TEXT and drops the return value, which is what
// most of this suite needs. These tests need the value, so they use this instead.
function silently(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try { return { value: fn(), out: lines.join('\n') }; } finally { console.log = orig; }
}

// The legacy `{knowledgebase, sprintManagement}` shape every caller of
// writeProjectLayoutYaml still passes. Single-repo, so nothing below depends on a
// particular path resolving.
const FIX_LAYOUT = Object.freeze({
  knowledgebase: { mode: 'same', path: '.' },
  sprintManagement: { mode: 'same', path: '.' },
});

/** A throwaway cwd, entered and left. */
function inTmp(prefix, fn) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const origCwd = process.cwd();
  try { process.chdir(dir); return fn(dir); } finally {
    process.chdir(origCwd);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** A project root whose `_bmad-output` cannot be created, because a FILE is there. */
function withUnwritableOutputDir(fn) {
  return withSandbox((sb) => {
    fs.writeFileSync(path.join(sb.project, '_bmad-output'), 'not a directory', 'utf-8');
    return fn(sb);
  });
}

test('[behaviour] the write reports a NAMED outcome from each of its four reachable exits', () => {
  // Not "it returns something truthy". Each exit is IDENTIFIED, because two of the
  // five mean the binding on disk is good and three mean it is not, and the whole
  // fix rests on the caller being able to tell them apart.
  const seen = {};
  const at = (label, setup) => inTmp('ma-bind-out-', () => {
    if (setup) setup();
    let r;
    try { r = silently(() => cli.writeProjectLayoutYaml(FIX_LAYOUT)).value; }
    catch (e) { r = { outcome: 'THREW: ' + e.message }; }
    seen[label] = r && r.outcome;
  });

  at('wrote', null);
  at('failed-mkdir', () => fs.writeFileSync('_bmad-output', 'not a directory', 'utf-8'));
  at('refused', () => {
    fs.mkdirSync('_bmad-output', { recursive: true });
    fs.writeFileSync(path.join('_bmad-output', 'project-layout.yaml'), 'schema_version: 99999\n', 'utf-8');
  });
  at('unchanged-legacy', () => {
    fs.mkdirSync('_bmad-output', { recursive: true });
    fs.writeFileSync(path.join('_bmad-output', 'project-layout.yaml'),
      'schema_version: 1\ngenerated: "2026-01-01"\nknowledgebase:\n  mode: same\n  path: "."\n' +
      'sprint_management:\n  mode: same\n  path: "."\n', 'utf-8');
  });

  assert.deepStrictEqual(seen, {
    wrote: cli.LAYOUT_WRITE_WROTE,
    'failed-mkdir': cli.LAYOUT_WRITE_FAILED_MKDIR,
    refused: cli.LAYOUT_WRITE_REFUSED,
    'unchanged-legacy': cli.LAYOUT_WRITE_UNCHANGED_LEGACY,
  }, 'writeProjectLayoutYaml no longer reports which of its exits it took');
});

test('[behaviour] the fifth exit — a failing writeFileSync — is `failed-write`, and a DIRECTORY is not', () => {
  // Reached by injection, deliberately. A DIRECTORY at the layout path does NOT
  // reach it: such a file is unreadable-as-a-file, so the non-destruction guard
  // refuses first. Both facts are pinned, so the distinction is a recorded decision
  // rather than something a later reader has to rediscover.
  const realWrite = fs.writeFileSync;
  try {
    inTmp('ma-bind-out5-', () => {
      fs.mkdirSync('_bmad-output', { recursive: true });
      fs.writeFileSync = function (p, ...rest) {
        if (String(p).endsWith('project-layout.yaml')) {
          const e = new Error('EROFS: read-only file system'); e.code = 'EROFS'; throw e;
        }
        return realWrite.call(fs, p, ...rest);
      };
      const r = silently(() => cli.writeProjectLayoutYaml(FIX_LAYOUT)).value;
      fs.writeFileSync = realWrite;
      assert.strictEqual(r && r.outcome, cli.LAYOUT_WRITE_FAILED_WRITE,
        `an I/O failure in the write itself reported ${JSON.stringify(r)}`);
      assert.ok(!fs.existsSync(path.join('_bmad-output', 'project-layout.yaml')),
        'a failed write left a file behind — a truncated binding is worse than none');
    });
    inTmp('ma-bind-outd-', () => {
      fs.mkdirSync(path.join('_bmad-output', 'project-layout.yaml'), { recursive: true });
      const dirCase = silently(() => cli.writeProjectLayoutYaml(FIX_LAYOUT)).value;
      assert.strictEqual(dirCase && dirCase.outcome, cli.LAYOUT_WRITE_REFUSED,
        'a DIRECTORY at the layout path must be REFUSED by the non-destruction guard, not ' +
        'reported as a write failure — the two are different facts and must not collapse');
    });
  } finally {
    fs.writeFileSync = realWrite;
  }
});

test('[behaviour] the bound/unbound partition is DEFAULT-DENY, so a sixth outcome fails closed', () => {
  // Story 31.7's legacy skip is the one that must not read as a failure: nothing
  // was written because NOTHING MOVED, and the project IS bound — by the file that
  // was already there. "Skipped because legacy" and "failed to write" must never
  // collapse, in either direction.
  assert.strictEqual(cli.projectLayoutWriteIsBound({ outcome: cli.LAYOUT_WRITE_WROTE }), true,
    'a successful write was classified as unbound');
  assert.strictEqual(cli.projectLayoutWriteIsBound({ outcome: cli.LAYOUT_WRITE_UNCHANGED_LEGACY }), true,
    'the Story 31.7 legacy skip was classified as a FAILURE — a legacy project that binds ' +
    'successfully would then be told it is unbound, and Story 31.7 AC4 would report an error');
  for (const bad of [cli.LAYOUT_WRITE_REFUSED, cli.LAYOUT_WRITE_FAILED_MKDIR,
    cli.LAYOUT_WRITE_FAILED_WRITE, 'an-outcome-added-later']) {
    assert.strictEqual(cli.projectLayoutWriteIsBound({ outcome: bad }), false,
      `${bad} was classified as BOUND`);
  }
  for (const bad of [undefined, null, {}, 'wrote', 0]) {
    assert.strictEqual(cli.projectLayoutWriteIsBound(bad), false,
      `${JSON.stringify(bad)} was classified as BOUND — the void return this fix replaced must ` +
      `never again be readable as a success`);
  }
});

test('[behaviour] BLOCKING — a bind whose write FAILED does not say `Bound.` and exits NON-ZERO', () => {
  withUnwritableOutputDir(({ home, project }) => {
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.ok(/could not create _bmad-output/.test(r.out),
      `the failure fixture did not fire, so this test proves nothing:\n${r.out}`);
    assert.ok(!/Bound\./.test(r.out),
      `bind reported \`Bound.\` after a write that FAILED:\n${r.out}`);
    assert.notStrictEqual(r.code, 0,
      `bind exited 0 after a write that FAILED — a CI step trusting the exit code is told a ` +
      `project is bound when it is not:\n${r.out}`);
    assert.ok(/NOT BOUND/.test(r.out),
      `the failure was not stated in terms the user can act on:\n${r.out}`);
  });
});

test('[behaviour] BLOCKING — and it generates NO config.yaml and writes NO project files', () => {
  withUnwritableOutputDir(({ home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    // The orphaned `_bmad/bmm/config.yaml` is the damaging half: a config with no
    // `project-layout.yaml` behind it is exactly the drifted state Story 31.4's
    // guard exists to catch (that guard HALTS on it, `halt:binding-missing`) — and
    // it was being manufactured while this command reported success.
    assert.ok(!fs.existsSync(path.join(project, '_bmad', 'bmm', 'config.yaml')),
      'a failed bind generated _bmad/bmm/config.yaml from a binding that does not exist');
    assert.deepStrictEqual(fileList(project), ['_bmad-output'],
      `a failed bind wrote project files: ${JSON.stringify(fileList(project))}`);
  });
});

test('[behaviour] BLOCKING — and it does NOT record the project in the per-machine registry', () => {
  withUnwritableOutputDir(({ home, project }) => {
    runCli(['bind', '--yes'], { home, cwd: project });
    const reg = path.join(home, '.ma-agents', 'bound-projects.json');
    const recorded = fs.existsSync(reg)
      ? (JSON.parse(fs.readFileSync(reg, 'utf-8')).projects || [])
      : [];
    assert.deepStrictEqual(recorded, [],
      `a bind that bound NOTHING registered the project: ${JSON.stringify(recorded)}. This also ` +
      `bounds N5: recordBoundProject replaces an unreadable registry WHOLESALE, so a bind that ` +
      `bound nothing could otherwise destroy the records of projects that ARE bound.`);
  });
});

test('[behaviour] CONTROL — a bind that CAN write still says `Bound.`, exits 0, and records', () => {
  // Without this, every assertion above would pass equally well for a bind that
  // refused unconditionally.
  withSandbox(({ home, project }) => {
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `a clean bind exited ${r.code}:\n${r.out}`);
    assert.ok(/Bound\./.test(r.out), `a clean bind did not report success:\n${r.out}`);
    assert.ok(fs.existsSync(path.join(project, '_bmad-output', 'project-layout.yaml')),
      'a clean bind wrote no binding');
    assert.ok(fs.existsSync(path.join(project, '_bmad', 'bmm', 'config.yaml')),
      'a clean bind generated no config.yaml — AC6 regressed');
    assert.ok(fs.existsSync(path.join(home, '.ma-agents', 'bound-projects.json')),
      'a clean bind recorded nothing — AC8 regressed');
  });
});

test('[behaviour] CONTROL — the no-edit re-bind still regenerates config.yaml (Story 31.4\'s remedy)', () => {
  // The gate must apply ONLY to the path that attempted a write. Story 31.4's
  // staleness HALT tells the user to run `ma-agents bind` to REGENERATE a drifted
  // config from an UNCHANGED binding; a gate that skipped Step 4 whenever no write
  // happened would make that instruction false in the one case it is ever given in.
  withSandbox(({ home, project }) => {
    assert.strictEqual(runCli(['bind', '--yes'], { home, cwd: project }).code, 0, 'the first bind failed');
    const cfg = path.join(project, '_bmad', 'bmm', 'config.yaml');
    fs.writeFileSync(cfg, '# clobbered\n', 'utf-8');
    const r = runCli(['bind', '--yes'], { home, cwd: project });
    assert.strictEqual(r.code, 0, `the no-edit re-bind exited ${r.code}:\n${r.out}`);
    assert.ok(/Bound\./.test(r.out), `the no-edit re-bind did not report success:\n${r.out}`);
    assert.ok(fs.readFileSync(cfg, 'utf-8').includes('knowledgebase_path'),
      'the no-edit re-bind did not regenerate config.yaml — Story 31.4\'s HALT remedy is now false');
  });
});

test('[behaviour] a serializer THROW out of the write is treated as NOT BOUND, not as a bound project', async () => {
  // THE `catch` IN handleBind's STEP 3, which the outcome contract does NOT
  // cover. `writeProjectLayoutYaml` still throws DELIBERATELY on values it
  // refuses to write — the closed backend enum, and the confluence identity guard
  // (`assertSingleLineIdentity`). Those never reach the outcome return at all, so
  // remapping the caught error to a BOUND outcome would restore the whole defect
  // through a door the five-exit contract leaves open. Mutant M9 survived the
  // first mutation round for exactly that reason: nothing exercised this path.
  //
  // The line break is injected through the prompt answer rather than by editing a
  // fixture file, because the throw has to originate INSIDE the write that
  // handleBind called — a hand-written bad file would be classified by the
  // resolver and refused at Step 1 instead, which is a different branch.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-thr-')));
  const origCwd = process.cwd();
  try {
    process.chdir(dir);
    answerOverrides = { backend: 'confluence', spaceKey: 'ENG\nINEERING' };
    promptLog = [];
    const out = capture(() => {});
    let result;
    const orig = console.log;
    const lines = [];
    console.log = (...a) => lines.push(a.join(' '));
    try { result = await cli.handleBind([]); } finally { console.log = orig; }
    const said = lines.join('\n').replace(/\[[0-9;]*m/g, '');

    assert.ok(/line break/.test(said),
      `the confluence identity guard did not fire, so this test exercised the wrong path:\n${said}`);
    assert.strictEqual(result.bound, false,
      `a bind whose write THREW reported bound:${result.bound} — the throw was swallowed into a ` +
      `success:\n${said}`);
    assert.ok(!/Bound\./.test(said), `bind said \`Bound.\` after the write threw:\n${said}`);
    assert.ok(/NOT BOUND/.test(said), `the failure was not reported to the user:\n${said}`);
    assert.strictEqual(process.exitCode, 1,
      `bind exited 0 after the write threw (exitCode=${process.exitCode})`);

    // …and none of the four gated steps ran.
    assert.ok(!fs.existsSync(path.join(dir, '_bmad-output', 'project-layout.yaml')),
      'the throw still left a binding on disk');
    assert.ok(!fs.existsSync(path.join(dir, '_bmad', 'bmm', 'config.yaml')),
      'config.yaml was generated from a binding whose write threw');
    void out;
  } finally {
    answerOverrides = {};
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[text] every step after the authoritative write is GATED on its outcome', () => {
  // The anti-regression that matters most, and the one no behavioural test gives:
  // the ORDER. All four things that used to run unconditionally must sit AFTER the
  // gate inside handleBind's own body.
  const m = /\nasync function handleBind\([\s\S]*?\n\}\n/.exec(CLI_SOURCE);
  assert.ok(m, 'handleBind() was not found — a rename makes every check here vacuous');
  const body = m[0];
  // Anchored on the CALL, not on a mention: the identifier also appears in this
  // function's explanatory comments, and an anchor a comment can satisfy is not an
  // anchor at all.
  const gate = body.indexOf('if (!projectLayoutWriteIsBound(');
  assert.ok(gate > 0, 'handleBind no longer consults the write outcome at all');
  assert.ok(body.indexOf('writeProjectLayoutYaml') < gate,
    'the gate does not follow the write it is supposed to be gating');
  for (const [label, needle] of [
    ['config.yaml generation', 'generateBmmConfig('],
    ['the per-machine registry', 'recordBoundProject('],
    // Anchored on the CALL, not on the word: the word appears in this function's
    // own explanatory comments, and an anchor that a comment can satisfy is not an
    // anchor.
    ['the `Bound.` success line', 'chalk.bold.green('],
  ]) {
    const at = body.indexOf(needle);
    assert.ok(at > gate,
      `${label} is not gated on the write outcome (found at ${at}, gate at ${gate}) — this is the ` +
      `exact shape of the defect this fix round exists to close`);
  }
  const after = body.slice(gate, gate + 1800);
  assert.ok(/return \{ bound: false/.test(after),
    'the gate does not RETURN — a warning that falls through IS the original defect');
  assert.ok(/process\.exitCode = 1/.test(after),
    'the gate does not set a non-zero exit code, so a CI step is still told the bind succeeded');
});

test('[text] TTY POLARITY — the status offer is gated on `!process.stdin.isTTY`, never its inverse', () => {
  // Nothing pinned this. Flipping it to `process.stdin.isTTY` makes `status`
  // AUTO-PROMPT in CI — the offer prompting where there is no user to answer, which
  // is the one thing AC3 forbids. `yes` is honoured as a REFUSAL to offer, so the
  // negation is load-bearing rather than cosmetic. Pinned as text here and as
  // behaviour below.
  assert.ok(/yes: !process\.stdin\.isTTY/.test(CLI_SOURCE),
    '`status`\'s offerBind gate is no longer `yes: !process.stdin.isTTY`');
  assert.ok(!/yes: process\.stdin\.isTTY/.test(CLI_SOURCE),
    'the gate has been INVERTED — `status` now prompts when there is no user to answer');
});

test('[behaviour] TTY POLARITY — `yes: true` states the remedy and asks NOTHING; `yes: false` asks', async () => {
  // The behavioural half of the pin. Under the correct polarity a piped or CI
  // `status` reaches offerBind with `yes: true`, which must produce the
  // state-and-stop line and ZERO prompts. Under the flip it would reach the prompt
  // instead — and these two assertions are what separate the two.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-tty-')));
  const origCwd = process.cwd();
  try {
    process.chdir(dir);
    promptLog = [];
    const nonInteractive = silently(() => cli.offerBind({ projectRoot: dir, yes: true }));
    const res = await nonInteractive.value;
    assert.strictEqual(promptLog.length, 0,
      `\`yes: true\` asked ${promptLog.length} question(s) — a non-interactive run has no user to ` +
      `answer them: ${JSON.stringify(promptLog)}`);
    assert.strictEqual(res.ran, false, '`yes: true` ran bind');
    assert.strictEqual(res.reason, 'declined-non-interactive',
      `expected declined-non-interactive, got ${res.reason}`);
    assert.deepStrictEqual(fileList(dir), [], '`yes: true` wrote to the project');

    confirmAnswer = false;
    promptLog = [];
    const res2 = await silently(() => cli.offerBind({ projectRoot: dir, yes: false })).value;
    assert.ok(promptLog.length >= 1,
      '`yes: false` asked nothing — the two polarities are then indistinguishable, so the gate ' +
      'could be flipped without any test noticing');
    assert.strictEqual(res2.ran, false, 'a declined offer ran bind');
  } finally {
    confirmAnswer = false;
    process.chdir(origCwd);
    process.exitCode = 0;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

test('[behaviour] N3 — the root the offer DECIDED on must be the root that gets bound', async () => {
  // `offerBind` decides on `projectRoot`; `handleBind`, `writeProjectLayoutYaml`,
  // `readExistingLayout` and `collectRepoLayout` all re-derive `process.cwd()`.
  // Unreachable from today's only caller, and the failure mode is binding the WRONG
  // PROJECT silently having decided against a different one — which, before the fix
  // above, would ALSO have reported `Bound.` and exited 0 while doing it. A latent
  // trap with a failing-if-touched test is a decision; without one it is a trap.
  const decided = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-n3a-')));
  const actual = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bind-n3b-')));
  const origCwd = process.cwd();
  try {
    process.chdir(actual);          // …while the offer is decided for `decided`
    confirmAnswer = true;           // an explicit YES: only the mismatch may stop it
    promptLog = [];
    const res = await silently(() => cli.offerBind({ projectRoot: decided, yes: false })).value;
    assert.strictEqual(res.ran, false, 'the offer bound a project it had not decided on');
    assert.strictEqual(res.reason, 'project-root-mismatch',
      `expected project-root-mismatch, got ${res.reason}`);
    assert.deepStrictEqual(fileList(actual), [],
      `the WRONG project was written to: ${JSON.stringify(fileList(actual))}`);
    assert.deepStrictEqual(fileList(decided), [],
      `the decided-on project was written to despite the refusal: ${JSON.stringify(fileList(decided))}`);

    // CONTROL: with the two in AGREEMENT and the same explicit yes, it DOES bind —
    // so the refusal above is the mismatch and not a blanket refusal.
    promptLog = [];
    const ok = await silently(() => cli.offerBind({ projectRoot: actual, yes: false })).value;
    assert.strictEqual(ok.ran, true, `agreeing roots did not bind: ${JSON.stringify(ok)}`);
    assert.ok(fs.existsSync(path.join(actual, '_bmad-output', 'project-layout.yaml')),
      'the control run reported ran:true but wrote no binding');
  } finally {
    confirmAnswer = false;
    process.chdir(origCwd);
    process.exitCode = 0;
    for (const d of [decided, actual]) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
});

test('[text] the expired "a future `ma-agents bind`" promise is gone from every site', () => {
  // Three sites printed "(a future `ma-agents bind` will do this without a full
  // re-install)" — one of them TO A USER RUNNING `ma-agents bind` right then. This
  // story amended GLOBAL_BIND_OFFER_HEADER for exactly that staleness and missed
  // these. Scanned rather than asserted per-site, so a fourth cannot appear.
  // The source escapes the command name inside a template literal, so between
  // "a future " and "ma-agents bind" there is a BACKSLASH AND A BACKTICK, not one
  // character. An earlier `.?` here matched neither the original text nor a
  // reinstated one, which made this whole test vacuous — caught by mutant M12,
  // not by reading it.
  const STALE_PROMISE = /a future[^A-Za-z\n]{0,4}ma-agents bind/;
  const stale = [];
  CLI_SOURCE.split('\n').forEach((line, i) => {
    if (STALE_PROMISE.test(line)) stale.push(`bin/cli.js:${i + 1}: ${line.trim()}`);
  });
  INSTALLER_SOURCE.split('\n').forEach((line, i) => {
    if (STALE_PROMISE.test(line)) stale.push(`lib/installer.js:${i + 1}: ${line.trim()}`);
  });
  assert.deepStrictEqual(stale, [],
    `\`ma-agents bind\` ships in this release, so nothing may describe it as future work:\n` +
    `${stale.join('\n')}`);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
drainAsyncTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
  }

  const total = passed + failed;
  if (total !== EXPECTED_TEST_COUNT) {
    console.error(
      `\n  FATAL: this suite reported ${total} test(s) but is pinned at ${EXPECTED_TEST_COUNT}. ` +
      `A SURPLUS fails as loudly as a shortfall: either a test was added without updating the ` +
      `pin, or one silently stopped running.`
    );
    summaryPrinted = true;
    process.exit(1);
  }

  summaryPrinted = true;
  process.exit(failed > 0 ? 1 : 0);
});
