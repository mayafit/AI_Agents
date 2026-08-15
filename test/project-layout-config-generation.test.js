#!/usr/bin/env node
/**
 * Story 31.3 — `_bmad/bmm/config.yaml` is GENERATED from `_bmad-output/project-layout.yaml`,
 * one way, on install and bind only.
 *
 * WHAT THIS SUITE IS FOR. Story 31.3 turns `config.yaml` from a file written
 * directly out of install answers into a file DERIVED from the committed binding
 * spine Story 31.2 established. Nothing about the file's LOCATION changes — all
 * 39 existing config references keep reading exactly the path they read today —
 * but three things become true that were not:
 *
 *   1. its contents are a function of `project-layout.yaml`, not of the wizard;
 *   2. it grows two per-store fields (`system_requirements_path`,
 *      `software_requirements_path`) alongside the retained single-valued legacy
 *      fields, which per FR264's 2026-08-02 amendment resolve to the SOFTWARE
 *      requirements store;
 *   3. it carries a content-based GENERATION STAMP naming the binding state it
 *      was generated from, which Story 31.4 consumes to detect drift.
 *
 * ORACLE. Every assertion about "what bytes reached config.yaml" is additionally
 * checked with js-yaml — a real parser and a declared DIRECT dependency — not only
 * with a regex or with this module's own hand-rolled reader, for the reason
 * recorded at the top of project-layout-binding-spine.test.js: a hand-rolled
 * reader cannot see a file it alone can read.
 *
 * THE TEST COUNT IS PINNED IN BOTH DIRECTIONS (EXPECTED_TEST_COUNT). This epic has
 * already shipped one suite that exited 0 having reported nothing; a suite that
 * silently stops running tests must fail, not pass.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Bumped deliberately as sections are added. A `!==` check, so a SURPLUS fails
// just as loudly as a shortfall.
const EXPECTED_TEST_COUNT = 6;

let passed = 0;
let failed = 0;
const errors = [];

// THE BACKSTOP, ARMED BEFORE THE FIRST TEST RUNS — copied deliberately from
// project-layout-two-store-round-trip.test.js. Its whole job is to catch the
// process dying BEFORE the summary block, so registering it at the bottom (where
// the summary lives) would arm it only after everything it protects has already
// happened. `collectRepoLayout`'s interactive branch still contains a bare
// `if (!mode) process.exit(0);`, and this suite calls into cli.js code paths, so
// this is treated as live rather than theoretical.
//
// Setting `process.exitCode` from an 'exit' listener DOES override an explicit
// `process.exit(0)` — verified in wave 2A, and the reason this works at all.
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

// ─── Load modules ────────────────────────────────────────────────────────────
let cli, installerMod, sharedBackends;
try {
  cli = require('../bin/cli.js');
  installerMod = require('../lib/installer.js');
  sharedBackends = require('../lib/store-backends.js');
} catch (e) {
  console.error('\n  FATAL: cannot load the modules under test');
  console.error(' ', e.stack || e.message);
  process.exit(1);
}

let yamlOracle = null;
try { yamlOracle = require('js-yaml'); } catch (e) { yamlOracle = null; }

/**
 * Strip comments before making any SOURCE-level assertion.
 *
 * Not cosmetic: without it, this suite's own first run went red because
 * `bin/cli.js` explains in a COMMENT that `const DEFAULT_STORE_BACKEND = '...'`
 * must appear nowhere in the file — and the naive regex matched the sentence
 * describing the prohibition rather than a violation of it. A source assertion
 * that fires on prose is worse than no source assertion: it trains the next
 * implementer to delete the comment.
 *
 * Deliberately crude (block comments, then line comments). It can only ever
 * REMOVE text, so it cannot manufacture a false positive; the worst it can do is
 * hide a declaration that begins after a `//` on the same line, which is not
 * syntactically possible.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const CLI_SOURCE = stripComments(
  fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8'));
const INSTALLER_SOURCE = stripComments(
  fs.readFileSync(path.join(__dirname, '..', 'lib', 'installer.js'), 'utf-8'));

// ═══════════════════════════════════════════════════════════════════════════
// 2B NIT 1 — THE DEFAULT BACKEND HAS EXACTLY ONE DEFINITION, AND BOTH
//            CONSUMERS ARE PINNED TO IT.
//
// The nit was NOT "the literal is duplicated". It was that nothing went red if
// the two spellings disagreed: `bin/cli.js:775` owned `DEFAULT_STORE_BACKEND`,
// `lib/installer.js:818` open-coded `'file-system'` independently, and every
// existing test asserted against cli.js's copy only. That is the same read/write
// enum disagreement this epic already fixed once for `backend`, one layer out.
//
// A shared module that no test asserts is CONSUMED BY BOTH SITES merely
// relocates the problem, so these tests pin behaviour and identity, not
// existence:
//
//   - identity: the value cli.js holds, the value installer.js holds, and the
//     value the leaf module defines are the SAME string;
//   - behaviour: `generateRepoLayoutSection` (installer.js's renderer) is driven
//     with EVERY member of the enum and its output is asserted per member, so a
//     drifted literal in installer.js changes what a user reads and goes red;
//   - source: neither consumer may reintroduce its own definition.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2B nit 1 — one definition of the default store backend, pinned at both consumers');

test('the default backend is the IDENTICAL value in the leaf module, bin/cli.js and lib/installer.js', () => {
  assert.strictEqual(typeof sharedBackends.DEFAULT_STORE_BACKEND, 'string',
    'the leaf module must define a string default');
  assert.strictEqual(cli.DEFAULT_STORE_BACKEND, sharedBackends.DEFAULT_STORE_BACKEND,
    'bin/cli.js must expose the shared default, not a second literal');
  assert.strictEqual(installerMod.DEFAULT_STORE_BACKEND, sharedBackends.DEFAULT_STORE_BACKEND,
    'lib/installer.js must expose the shared default, not a second literal');
  // The default must be a MEMBER of the enum. A default outside the enum makes
  // every "is this store non-default?" predicate answer yes for an ordinary
  // store — the permissive-degradation shape this epic keeps producing.
  assert.ok(sharedBackends.STORE_BACKEND_LIST.includes(sharedBackends.DEFAULT_STORE_BACKEND),
    'the default backend must be a member of the enum');
});

test('bin/cli.js STORE_BACKENDS is exactly the shared list, in the shared order', () => {
  const fromCli = [...cli.STORE_BACKENDS];
  assert.deepStrictEqual(fromCli, [...sharedBackends.STORE_BACKEND_LIST],
    'cli.js must build its Set from the shared list — order included, because ' +
    'legalBackendsForMessage() renders the user-facing legal set by iterating it');
});

test('the shared enum list is frozen, and cli.js still hands out an inert COPY of the Set', () => {
  // Wave 2A's invariant: a consumer must not be able to widen what all three
  // directions (reader, writer, wizard) accept. Relocating the definition must
  // not have relaxed that.
  assert.ok(Object.isFrozen(sharedBackends.STORE_BACKEND_LIST), 'STORE_BACKEND_LIST must be frozen');

  // `require` is CACHED, so re-requiring cli.js hands back the SAME exports
  // object and therefore the same Set — comparing those two proves nothing (this
  // suite's first run asserted exactly that and went red for the right reason).
  // What must be pinned is that the exported Set is not the LIVE one the module's
  // own reader/writer/wizard consult. `legalBackendsForMessage()` is derived from
  // the live enum by iteration, so it is the observable that answers the question.
  const INJECTED = 'notion-injected-by-a-consumer';
  const before = cli.legalBackendsForMessage();
  cli.STORE_BACKENDS.add(INJECTED);
  try {
    assert.strictEqual(cli.legalBackendsForMessage(), before,
      'mutating the exported Set must not widen the live enum the module consults');
    assert.ok(!sharedBackends.STORE_BACKEND_LIST.includes(INJECTED),
      'mutating the exported Set must not reach the shared list either');
  } finally {
    // Undo the mutation. The exports object is process-wide and every later test
    // in this file reads it; leaving it widened would make THIS test change the
    // subject of the others.
    cli.STORE_BACKENDS.delete(INJECTED);
  }
  assert.ok(!cli.STORE_BACKENDS.has(INJECTED), 'the injected member must be cleaned up');
});

test('lib/installer.js RENDERS every enum member per the shared default — the behavioural pin', () => {
  // THE TEST THE NIT ACTUALLY ASKED FOR. Drives installer.js's own renderer with
  // each member of the enum. If installer.js's notion of "the default backend"
  // ever drifts from the shared one, exactly one of these two branches renders
  // the wrong way and this goes red.
  const DEFAULT = sharedBackends.DEFAULT_STORE_BACKEND;
  let sawDefault = 0;
  let sawNonDefault = 0;

  for (const backend of sharedBackends.STORE_BACKEND_LIST) {
    const section = installerMod.generateRepoLayoutSection({
      // `mode: 'local'` + a real path so the section is non-empty for BOTH
      // members: generateRepoLayoutSection returns '' when everything is
      // same-repo, which would make this loop assert nothing.
      knowledgebase: { backend, mode: 'local', path: '/ext/kb', spaceKey: 'ENG' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(!/undefined/.test(section),
      `backend ${JSON.stringify(backend)}: must never render the literal "undefined": ${section}`);

    if (backend === DEFAULT) {
      sawDefault++;
      // The default backend must render as TODAY'S path-based output. If
      // installer.js's literal drifted, this store would be treated as
      // non-file-system and rendered as "…-backed", which is a user-visible
      // change and is what this assertion catches.
      assert.ok(section.includes('**Knowledgebase:** /ext/kb'),
        `the default backend must render as a plain path, got: ${section}`);
      assert.ok(!section.includes('not a filesystem path'),
        `the default backend must NOT be described as pathless, got: ${section}`);
      assert.ok(section.includes('use the knowledgebase path'),
        `the default backend must keep today's guidance line, got: ${section}`);
    } else {
      sawNonDefault++;
      // Every NON-default member must be named explicitly and must NOT be
      // described as a directory. If installer.js's literal drifted so that this
      // member compared EQUAL to its notion of the default, the store would
      // silently render as the path "/ext/kb" and this goes red.
      assert.ok(section.includes(`**Knowledgebase:** ${backend} (not a filesystem path`),
        `backend ${JSON.stringify(backend)} must be named explicitly, got: ${section}`);
      assert.ok(!section.includes('use the knowledgebase path'),
        `backend ${JSON.stringify(backend)} must not be given path guidance, got: ${section}`);
    }
  }

  // The loop is only meaningful if it exercised BOTH branches. Without this, an
  // enum reduced to a single member would leave the whole test vacuous while
  // still passing — the "asserted nothing" failure mode this epic has already
  // shipped once.
  assert.strictEqual(sawDefault, 1, 'exactly one member must be the default backend');
  assert.ok(sawNonDefault >= 1, 'the enum must contain at least one non-default member to pin');
});

test('neither consumer redefines the enum or the default in its own source', () => {
  // Belt to the behavioural braces above: a REINTRODUCED literal is the exact
  // regression this nit is about, and a source assertion is the only thing that
  // notices a fourth definition appearing next to (rather than instead of) the
  // shared one.
  assert.ok(!/const\s+DEFAULT_STORE_BACKEND\s*=\s*['"]/.test(CLI_SOURCE),
    'bin/cli.js must not declare its own DEFAULT_STORE_BACKEND literal');
  assert.ok(!/const\s+DEFAULT_STORE_BACKEND\s*=\s*['"]/.test(INSTALLER_SOURCE),
    'lib/installer.js must not declare its own DEFAULT_STORE_BACKEND literal');
  assert.ok(/require\(['"]\.\.\/lib\/store-backends['"]\)/.test(CLI_SOURCE),
    'bin/cli.js must consume the shared module');
  assert.ok(/require\(['"]\.\/store-backends['"]\)/.test(INSTALLER_SOURCE),
    'lib/installer.js must consume the shared module');
  // installer.js has no legitimate reason to spell any enum member: it holds no
  // serializer and no reader for the binding file. cli.js DOES (it emits
  // `backend: file-system` into project-layout.yaml and `sprint_backend:
  // "file-system"` into config.yaml), so the same blanket assertion cannot be
  // made there and is deliberately not attempted.
  for (const member of sharedBackends.STORE_BACKEND_LIST) {
    assert.ok(!INSTALLER_SOURCE.includes(`'${member}'`) && !INSTALLER_SOURCE.includes(`"${member}"`),
      `lib/installer.js must not spell the enum member ${JSON.stringify(member)} as a literal`);
  }
});

test('the leaf module is a true LEAF — it requires nothing, so neither consumer can cycle', () => {
  // The reason the open-coded literal existed at all was that `lib/installer.js`
  // must not require `bin/cli.js` (cli.js requires installer.js). A shared module
  // that itself reached back into either would reinstate the cycle it exists to
  // avoid, and would fail at load rather than in a test — but only for whichever
  // consumer happened to be loaded second.
  const leafSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'store-backends.js'), 'utf-8');
  assert.ok(!/\brequire\s*\(/.test(leafSource),
    `lib/store-backends.js must not require anything, got:\n${leafSource}`);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
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
