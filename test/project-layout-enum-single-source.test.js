#!/usr/bin/env node
/**
 * Anti-drift suite for the closed enums of the project-layout subsystem
 * (`mode` and `backend`).
 *
 * WHY THIS FILE EXISTS. Epic 31 found the SAME defect three separate times:
 * write-side and read-side validation disagreeing about a closed enum
 * (`backend` enforced on write but not on read; `mode` raw-interpolated on
 * write but merely coerced on read; `SPRINT_MODES` vs `STORE_MODES` at one
 * call site). Each was fixed individually. Fixing instances loses to the
 * pattern, so `bin/cli.js` now defines each enum ONCE — `STORE_MODES`,
 * `SPRINT_MODES`, `STORE_BACKENDS` — and every direction that touches it
 * (reader, writer, and the wizard prompt that PRODUCES the value) is derived
 * from that one definition.
 *
 * These tests pin the property, not the instances:
 *
 *   1. Every member of every enum survives a write -> read round trip.
 *   2. A NON-member is rejected by BOTH directions, asserted separately. This
 *      is the test that would have caught all three historical instances: each
 *      one was a value one half accepted and the other did not.
 *   3. The two `backend` error messages name the SAME legal set — they are
 *      rendered from the enum, not hand-written, so a fourth member cannot
 *      appear in one message and not the other.
 *   4. The wizard's prompt-title table's keys are EXACTLY the union of the
 *      enums, so adding a member without giving it a title fails here rather
 *      than silently producing a mode the wizard can never offer.
 *   5. `collectRepoLayout` — the wizard CALL SITE — is driven with a stubbed
 *      `prompts` and the choices it actually offers are asserted per concern.
 *      Testing only the pure `modeChoicesFor` left two call-site mutations
 *      alive against every suite in the repo: passing a constant concern
 *      (sprint management silently stops offering Jira) and reverting to a
 *      hardcoded list. `repo-layout.test.js` only exercises `--yes`.
 *   6. The rendered legal set is pinned verbatim (a changed separator is
 *      user-visible), the exported enums are copies so a consumer cannot
 *      widen what all three directions accept, and the error-message value
 *      renderer is total — `JSON.stringify` throws on BigInt and on circular
 *      objects, which on an error path escapes as a bare TypeError naming
 *      neither the field nor the legal set.
 *
 * Plus the one user-visible consequence of `bin/cli.js`'s
 * `serializeSprintManagement` passing `STORE_MODES` where `SPRINT_MODES`
 * belongs. That call site is dead-code-EQUIVALENT for control flow (the
 * `mode === 'jira'` early return above it shadows the only member the two sets
 * differ on, and a reviewer proved the equivalence by swapping the enum with no
 * test change), so a test that merely writes a jira sprint record and passes is
 * VACUOUS. The genuine difference is the ERROR MESSAGE: reached with an illegal
 * sprint mode, the old code told the user the legal values were
 * `same, local, remote` — omitting `jira`, which the read half accepts and the
 * Jira sprint backend depends on. That is reachable, observable, and is what is
 * asserted below.
 *
 * The bug report's AC3 additionally asks for a test proving sprint `mode: jira`
 * is WRITABLE "without relying on the early return's position — i.e. the test
 * would still pass if the early return were removed". That is a MODE-only
 * claim, and it holds: with the early return forced false the serializer falls
 * through to `assertWritableMode`, which under `SPRINT_MODES` accepts `jira` and
 * emits `mode: jira` (under the pre-fix `STORE_MODES` it would throw). The
 * jira-specific FIELDS are a different matter — only the early return emits
 * `jira_url` / `jira_project_key` — so they are asserted by a separate test
 * whose name says outright that it depends on the early return. Two tests, two
 * honest names, rather than one name overclaiming for both.
 *
 * ORACLE. Wherever the subject is "what bytes reached the authoritative file",
 * these tests parse with js-yaml — a real parser and a declared DIRECT
 * dependency — as well as through the module's own reader, for the reason set
 * out at the top of project-layout-binding-spine.test.js.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    errors.push({ name, error: err.message });
  }
}

// `collectRepoLayout` is async, so the wizard call-site tests are queued and
// drained before the summary rather than restructuring the synchronous ones.
const asyncTests = [];
function testAsync(name, fn) { asyncTests.push([name, fn]); }
async function drainAsyncTests() {
  if (asyncTests.length) {
    console.log('\n5 — the wizard call site actually offers the derived choices');
  }
  for (const [name, fn] of asyncTests) {
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
}

// The N-1 / MW-class tests have to observe what the WIZARD actually offers, not
// only what the pure `modeChoicesFor` returns — otherwise the call site itself
// (`bin/cli.js`'s `collectRepoLayout`) is untested and a mutation there survives
// every suite in the repo. `prompts` is stubbed in the require cache BEFORE
// cli.js is loaded, so cli.js's own `const prompts = require('prompts')` binds
// to the stub. `prompts.inject()` is not usable here: it satisfies the question
// without rendering it, so the choices never become observable.
const promptsModulePath = require.resolve('prompts');
require('prompts'); // populate the cache entry so .exports can be replaced
const promptLog = [];

// The stub NEVER answers a question it was not given an answer for. Returning
// `{}` instead is not a soft default, it is a suite-killer: cli.js reads the
// missing field as undefined and reaches `if (!mode) process.exit(0)`, which
// from inside an awaited test aborts the process mid-drain — the summary and
// its process.exit(1) never run, and the whole file exits 0 having printed
// nothing, taking any genuine failure from the 21 synchronous tests with it.
// A retry-on-invalid prompt loop against the same soft default spins forever
// and OOMs (exit 134) instead. Throwing turns both into an ordinary, named
// test failure. Story 31.5 adds per-store questions to collectRepoLayout, so
// this WILL be hit; repo-layout.test.js is --yes-only and will not catch it.
function unexpectedPrompt(question) {
  const name = (question && question.name) || '(unnamed)';
  const message = (question && question.message) || '';
  throw new Error(
    `the wizard asked more questions than the test answered — unanswered prompt ` +
    `${JSON.stringify(name)} (${JSON.stringify(message)}). Add an answer to the ` +
    `runWizard() queue rather than letting the stub default it.`
  );
}
let promptAnswer = unexpectedPrompt;
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  promptLog.push(question);
  return promptAnswer(question);
};

// ─── Load module ─────────────────────────────────────────────────────────────
let writeProjectLayoutYaml, resolveProjectTopology, BINDING_INVALID,
  STORE_MODES, SPRINT_MODES, STORE_BACKENDS, MODE_PROMPT_TITLES, modeChoicesFor,
  collectRepoLayout, legalBackendsForMessage;
try {
  ({
    writeProjectLayoutYaml, resolveProjectTopology, BINDING_INVALID,
    STORE_MODES, SPRINT_MODES, STORE_BACKENDS, MODE_PROMPT_TITLES, modeChoicesFor,
    collectRepoLayout, legalBackendsForMessage,
  } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

for (const [name, value] of Object.entries({ STORE_MODES, SPRINT_MODES, STORE_BACKENDS })) {
  if (!(value instanceof Set) || value.size === 0) {
    console.error(`\n  FATAL: ${name} is not a non-empty Set — the single source of truth is missing`);
    process.exit(1);
  }
}

let yamlOracle = null;
try {
  yamlOracle = require('js-yaml');
} catch (e) {
  yamlOracle = null;
}

function withTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-enum-'));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  return {
    tmpDir,
    cleanup() { process.chdir(origCwd); fs.rmSync(tmpDir, { recursive: true, force: true }); },
  };
}

function layoutPathOf(tmpDir) {
  return path.join(tmpDir, '_bmad-output', 'project-layout.yaml');
}

function writeLayoutFixture(tmpDir, lines) {
  fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
  fs.writeFileSync(layoutPathOf(tmpDir), lines.join('\n'), 'utf-8');
}

// Silences the writer's progress chatter; the tests here assert on returned
// values and file bytes, not on console output.
function quiet(fn) {
  const orig = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = orig;
  }
}

/** Runs `layout` through the real writer, then the real reader. */
function roundTrip(layout) {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    quiet(() => writeProjectLayoutYaml(layout));
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    if (yamlOracle) {
      try {
        yamlOracle.load(content);
      } catch (e) {
        throw new Error(
          `the emitted file is not parseable by a real YAML parser: ${e.message.split('\n')[0]}`
        );
      }
    }
    const result = resolveProjectTopology(process.cwd());
    return { content, result };
  } finally {
    cleanup();
  }
}

/** Captures the throw (if any) from a write of `layout`. */
function writeError(layout) {
  const { cleanup } = withTmpDir();
  try {
    let err = null;
    try {
      quiet(() => writeProjectLayoutYaml(layout));
    } catch (e) {
      err = e;
    }
    return err;
  } finally {
    cleanup();
  }
}

/** Reads a hand-written fixture through the real reader. */
function readFixture(lines) {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, lines);
    return resolveProjectTopology(process.cwd());
  } finally {
    cleanup();
  }
}

const OK_STORE = ['  backend: file-system', '  mode: same', '  path: "."'];

/**
 * Isolates the LEGAL-SET clause of an error message and returns its members.
 *
 * A bare `message.includes(member)` is non-vacuous today but fails OPEN
 * tomorrow: a future enum member spelled `yaml` or `write` would match the
 * surrounding prose (`_bmad-output/project-layout.yaml`, `Refusing to write`)
 * and the assertion would silently stop asserting. This finds the clause, and
 * FAILS LOUD if the marker it depends on is not there — so a reworded message
 * breaks the test rather than emptying it.
 */
function legalMembersAfter(message, marker, terminator) {
  assert.ok(typeof message === 'string' && message !== '',
    `expected an error message to parse, got ${describeForTest(message)}`);
  const idx = message.indexOf(marker);
  assert.ok(idx >= 0,
    `the message no longer contains ${JSON.stringify(marker)}, so its legal set cannot be ` +
    `isolated and this assertion would silently pass on anything. Got: ${message}`);
  let clause = message.slice(idx + marker.length);
  if (terminator) {
    const end = clause.indexOf(terminator);
    assert.ok(end >= 0,
      `the message no longer terminates its legal set with ${JSON.stringify(terminator)}. ` +
      `Got: ${message}`);
    clause = clause.slice(0, end);
  }
  clause = clause.trim();
  assert.notStrictEqual(clause, '', `the legal-set clause is empty in: ${message}`);
  return clause.split(/,\s*|\s+or\s+/).map(s => s.trim()).filter(Boolean);
}

function describeForTest(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

/** The unquoted legal-set clause `assertWritableMode` prints on the write half. */
function writtenLegalModes(message) {
  return legalMembersAfter(message, 'must be one of ');
}

/** The JSON-quoted legal-set clause `requireKnownMode` prints on the read half. */
function readLegalModes(message) {
  return legalMembersAfter(message, 'Expected one of ', '. Refusing to guess')
    .map(s => JSON.parse(s));
}

// ══════════════════════════════════════════════════════════════════════════
// 1 — the enums are single-sourced and the wizard is derived from them
// ══════════════════════════════════════════════════════════════════════════
console.log('\n1 — one definition per enum, and the wizard derives from it');

test('MODE_PROMPT_TITLES keys are EXACTLY the union of STORE_MODES and SPRINT_MODES', () => {
  const union = [...new Set([...STORE_MODES, ...SPRINT_MODES])].sort();
  const titled = Object.keys(MODE_PROMPT_TITLES).sort();
  assert.deepStrictEqual(titled, union,
    `every enum member needs a prompt title (or the wizard can never offer it), and a title ` +
    `with no enum member is a mode the writer would reject. Enums: ${union.join(', ')}; ` +
    `titles: ${titled.join(', ')}`);
  for (const [member, title] of Object.entries(MODE_PROMPT_TITLES)) {
    assert.ok(typeof title === 'string' && title.trim() !== '',
      `mode ${JSON.stringify(member)} has an empty prompt title`);
  }
});

test('the wizard offers exactly the legal set for each concern — no more, no less', () => {
  const kbValues = modeChoicesFor('knowledgebase').map(c => c.value);
  const spValues = modeChoicesFor('sprintManagement').map(c => c.value);
  assert.deepStrictEqual(kbValues, [...STORE_MODES],
    'the knowledgebase prompt must offer exactly STORE_MODES, in the enum order');
  assert.deepStrictEqual(spValues, [...SPRINT_MODES],
    'the sprint-management prompt must offer exactly SPRINT_MODES, in the enum order');
  assert.ok(!kbValues.includes('jira'),
    'a knowledge store has no jira mode — offering it would produce a value the writer rejects');
});

test('the wizard prompt keeps its pre-refactor titles and order verbatim', () => {
  assert.deepStrictEqual(modeChoicesFor('knowledgebase'), [
    { title: 'Current repository (default)', value: 'same' },
    { title: 'Local path', value: 'local' },
    { title: 'Remote git repository', value: 'remote' },
  ]);
  assert.deepStrictEqual(modeChoicesFor('sprintManagement'), [
    { title: 'Current repository (default)', value: 'same' },
    { title: 'Local path', value: 'local' },
    { title: 'Remote git repository', value: 'remote' },
    { title: 'Jira', value: 'jira' },
  ]);
});

test('every mode the wizard can produce is findIndex-locatable, so `initial` pre-selection holds', () => {
  // collectRepoLayout pre-selects with modeChoices.findIndex(c => c.value === existingMode).
  // Any enum member missing from the offered list would silently reset the
  // pre-selection to index 0 rather than to the mode already configured.
  for (const mode of STORE_MODES) {
    assert.ok(modeChoicesFor('knowledgebase').findIndex(c => c.value === mode) >= 0,
      `an existing knowledge-store mode ${JSON.stringify(mode)} is not offered, so it cannot be pre-selected`);
  }
  for (const mode of SPRINT_MODES) {
    assert.ok(modeChoicesFor('sprintManagement').findIndex(c => c.value === mode) >= 0,
      `an existing sprint mode ${JSON.stringify(mode)} is not offered, so it cannot be pre-selected`);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// 2 — every member round-trips: write -> read, no throw, same value back
// ══════════════════════════════════════════════════════════════════════════
console.log('\n2 — every enum member survives a write -> read round trip');

test('every STORE_MODES member round-trips through both knowledge stores', () => {
  for (const mode of STORE_MODES) {
    const store = { backend: 'file-system', mode, path: '.' };
    if (mode === 'remote') store.gitUrl = 'https://example.com/kb.git';
    const { result } = roundTrip({
      systemRequirementsStore: { ...store },
      softwareRequirementsStore: { ...store },
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(result.ok,
      `store mode ${JSON.stringify(mode)} is a legal member but did not read back: ` +
      `${result.reason} — ${result.message}`);
    assert.strictEqual(result.topology.systemRequirementsStore.mode, mode);
    assert.strictEqual(result.topology.softwareRequirementsStore.mode, mode);
  }
});

test('every SPRINT_MODES member round-trips through sprint_management — jira included', () => {
  for (const mode of SPRINT_MODES) {
    const sprint = mode === 'jira'
      ? { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'MA' }
      : { mode, path: '.' };
    if (mode === 'remote') sprint.gitUrl = 'https://example.com/sprint.git';
    const { result } = roundTrip({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: sprint,
    });
    assert.ok(result.ok,
      `sprint mode ${JSON.stringify(mode)} is a legal member but did not read back: ` +
      `${result.reason} — ${result.message}`);
    assert.strictEqual(result.topology.sprintManagement.mode, mode);
  }
});

test('every STORE_BACKENDS member round-trips through both knowledge stores', () => {
  const sampleFor = (backend) => backend === 'confluence'
    ? { backend, spaceKey: 'ENG', rootPage: { title: 'Requirements', id: '12345' } }
    : { backend, mode: 'same', path: '.' };
  for (const backend of STORE_BACKENDS) {
    const { result } = roundTrip({
      systemRequirementsStore: sampleFor(backend),
      softwareRequirementsStore: sampleFor(backend),
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(result.ok,
      `backend ${JSON.stringify(backend)} is a legal member but did not read back: ` +
      `${result.reason} — ${result.message}`);
    assert.strictEqual(result.topology.systemRequirementsStore.backend, backend);
    assert.strictEqual(result.topology.softwareRequirementsStore.backend, backend);
  }
});

test('an ABSENT backend is still writable — the legacy {mode, path} shape must keep working', () => {
  const { result } = roundTrip({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.ok(result.ok, `the legacy shape must write and read back, got ${result.reason}: ${result.message}`);
  assert.strictEqual(result.topology.systemRequirementsStore.backend, 'file-system',
    'an unstated backend serializes as file-system, exactly as the read half defaults it');
});

// ══════════════════════════════════════════════════════════════════════════
// 3 — a NON-member is rejected by BOTH directions. Asserted separately: the
//     three historical defects were each a value one half accepted and the
//     other did not, so a test that only checks one half cannot see them.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n3 — a non-member is rejected by the reader AND the writer, separately');

test('an illegal knowledge-store mode is rejected on WRITE', () => {
  const err = writeError({
    systemRequirementsStore: { backend: 'file-system', mode: 'bogus', path: '.' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.ok(err, 'the writer must refuse a mode outside STORE_MODES');
  assert.ok(/bogus/.test(err.message), `the message must name the offending value, got: ${err.message}`);
});

test('the same illegal knowledge-store mode is rejected on READ', () => {
  const result = readFixture([
    'schema_version: 2',
    'system_requirements_store:',
    '  backend: file-system',
    '  mode: bogus',
    '  path: "."',
    'software_requirements_store:',
    ...OK_STORE,
  ]);
  assert.strictEqual(result.ok, false, 'the reader must refuse a mode outside STORE_MODES');
  assert.strictEqual(result.reason, BINDING_INVALID);
  assert.ok(/bogus/.test(result.message), `the message must name the offending value, got: ${result.message}`);
});

test('`jira` is a SPRINT mode only — a knowledge store rejects it in BOTH directions', () => {
  // The sharpest form of the pattern: a value that is a legal member of one
  // enum and not the other. If the two halves ever consult different sets,
  // this is where it shows.
  assert.ok(SPRINT_MODES.has('jira') && !STORE_MODES.has('jira'),
    'precondition: jira is a sprint mode and not a store mode');

  const err = writeError({
    systemRequirementsStore: { backend: 'file-system', mode: 'jira', path: '.' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.ok(err, 'the writer must refuse `jira` as a knowledge-store mode');
  // Parsed out of the message, not substring-matched against the whole of it:
  // the previous `split('—')[1] || ''` degraded to asserting nothing at all if
  // the em-dash ever left the message.
  assert.deepStrictEqual(writtenLegalModes(err.message), [...STORE_MODES],
    `the store-mode legal set printed must be exactly STORE_MODES, got: ${err.message}`);

  const result = readFixture([
    'schema_version: 2',
    'system_requirements_store:',
    '  backend: file-system',
    '  mode: jira',
    '  path: "."',
    'software_requirements_store:',
    ...OK_STORE,
  ]);
  assert.strictEqual(result.ok, false, 'the reader must refuse `jira` as a knowledge-store mode');
  assert.strictEqual(result.reason, BINDING_INVALID);
});

test('an illegal sprint mode is rejected on WRITE and on READ', () => {
  const err = writeError({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'bogus', path: '.' },
  });
  assert.ok(err, 'the writer must refuse a mode outside SPRINT_MODES');
  assert.ok(/bogus/.test(err.message), `the message must name the offending value, got: ${err.message}`);

  const result = readFixture([
    'schema_version: 2',
    'system_requirements_store:',
    ...OK_STORE,
    'software_requirements_store:',
    ...OK_STORE,
    'sprint_management:',
    '  mode: bogus',
    '  path: "."',
  ]);
  assert.strictEqual(result.ok, false, 'the reader must refuse a mode outside SPRINT_MODES');
  assert.strictEqual(result.reason, BINDING_INVALID);
  assert.ok(/bogus/.test(result.message), `the message must name the offending value, got: ${result.message}`);
});

test('an illegal backend is rejected on WRITE and on READ, and both messages name the SAME legal set', () => {
  const err = writeError({
    systemRequirementsStore: { backend: 'sharepoint', path: '/wherever' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.ok(err, 'the writer must refuse a backend outside STORE_BACKENDS');
  assert.ok(/sharepoint/.test(err.message), `the write message must name the offending value, got: ${err.message}`);

  const result = readFixture([
    'schema_version: 2',
    'system_requirements_store:',
    '  backend: sharepoint',
    '  site_url: "https://sp.example.com"',
    'software_requirements_store:',
    ...OK_STORE,
  ]);
  assert.strictEqual(result.ok, false, 'the reader must refuse a backend outside STORE_BACKENDS');
  assert.strictEqual(result.reason, BINDING_INVALID);
  assert.ok(/sharepoint/.test(result.message), `the read message must name the offending value, got: ${result.message}`);

  // The point of the single source: the two messages enumerate the SAME set,
  // in the SAME rendering. Hand-written lists are exactly how a fourth backend
  // would end up named by one direction and not the other. Asserted as the
  // whole rendered clause, not member-by-member, so a changed separator or a
  // dropped member both fail here.
  const clause = legalBackendsForMessage();
  assert.ok(err.message.endsWith(`must be ${clause}`),
    `the WRITE message must end with the rendered legal set ${JSON.stringify(clause)}: ${err.message}`);
  assert.ok(result.message.includes(`Expected ${clause}.`),
    `the READ message must carry the same rendered legal set ${JSON.stringify(clause)}: ${result.message}`);
});

// ══════════════════════════════════════════════════════════════════════════
// 4 — the wrong-enum bug at serializeSprintManagement, tested where it is
//     actually observable: the legal set the error message enumerates.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n4 — serializeSprintManagement enumerates the SPRINT legal set, jira included');

test('an invalid sprint mode is told the legal set INCLUDING jira — not the store set', () => {
  const err = writeError({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'bogus', path: '.' },
  });
  assert.ok(err, 'an invalid sprint mode must throw before any bytes are written');
  assert.ok(/sprint_management/.test(err.message),
    `the message must name the offending field, got: ${err.message}`);
  // Parsed out of the legal-set clause, not substring-matched against the whole
  // message: a future member spelled `write` or `yaml` would match the prose
  // ("Refusing to write", "project-layout.yaml") and this would stop asserting.
  assert.deepStrictEqual(writtenLegalModes(err.message), [...SPRINT_MODES],
    `the sprint-mode error must enumerate exactly SPRINT_MODES — the write half was validating ` +
    `against STORE_MODES, so a user who mistyped a sprint mode was told jira was illegal while ` +
    `the read half accepts it. Got: ${err.message}`);
});

test('the sprint error\'s legal set matches the set the READER accepts, member for member', () => {
  const err = writeError({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'bogus', path: '.' },
  });
  const readResult = readFixture([
    'schema_version: 2',
    'system_requirements_store:',
    ...OK_STORE,
    'software_requirements_store:',
    ...OK_STORE,
    'sprint_management:',
    '  mode: bogus',
    '  path: "."',
  ]);
  // Both sides parsed out of their own clause and compared as SETS. The two
  // renderings differ (the writer prints `same, local, remote, jira`; the reader
  // prints `"same", "local", "remote", "jira"`), so each is decoded by its own
  // parser and only the membership is compared.
  assert.deepStrictEqual(writtenLegalModes(err.message).sort(), [...SPRINT_MODES].sort(),
    `the WRITE half's legal set is not SPRINT_MODES: ${err.message}`);
  assert.deepStrictEqual(readLegalModes(readResult.message).sort(), [...SPRINT_MODES].sort(),
    `the READ half's legal set is not SPRINT_MODES: ${readResult.message}`);
});

// AC3 of the bug report: "a test proves sprint `mode: jira` is WRITABLE without
// relying on the early return's position — i.e. the test would still pass if the
// early return were removed." That is exactly what this asserts, and no more:
// with `if (sprint && sprint.mode === 'jira')` forced false, the writer falls
// through to assertWritableMode, which under SPRINT_MODES accepts `jira` and
// emits `mode: jira` — so the mode still survives the round trip. Under the
// pre-fix STORE_MODES it would throw instead. The jira-specific FIELDS do not
// survive that mutation (only the early return emits them), so they are
// asserted separately below, under a name that admits the dependency.
test('sprint mode jira is WRITABLE and reads back as jira — holds with the early return removed', () => {
  const { content, result } = roundTrip({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'MA' },
  });
  assert.ok(result.ok, `a jira sprint binding must be writable, got ${result.reason}: ${result.message}`);
  assert.strictEqual(result.topology.sprintManagement.mode, 'jira',
    'the sprint mode must survive the round trip as jira whatever path the serializer took');
  if (yamlOracle) {
    const doc = yamlOracle.load(content);
    assert.strictEqual(doc.sprint_management.mode, 'jira',
      'a real YAML parser must see mode: jira in the authoritative file');
  }
});

test('the jira sprint FIELDS round-trip — this one DOES depend on the early return emitting them', () => {
  const { content, result } = roundTrip({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'MA' },
  });
  assert.ok(result.ok, `got ${result.reason}: ${result.message}`);
  assert.strictEqual(result.topology.sprintManagement.jiraUrl, 'https://jira.example.com');
  assert.strictEqual(result.topology.sprintManagement.jiraProjectKey, 'MA');
  assert.ok(!/^\s+path:/m.test(content.split('sprint_management:')[1] || ''),
    'a jira sprint record carries no path — it is not on disk');
});

// ══════════════════════════════════════════════════════════════════════════
// 5 — the WIZARD call site. `modeChoicesFor` being correct proves nothing
//     about collectRepoLayout calling it, or calling it per concern. Without
//     this section two mutations at bin/cli.js's call site survive every
//     suite in the repo: passing a constant concern (Jira silently stops
//     being offered for sprint management) and reverting to a hardcoded list.
//     repo-layout.test.js only ever exercises --yes, so nothing else here
//     inspects prompt choices.
//
//     These are async, so they run in drainAsyncTests() at the bottom; the
//     section header is printed there to keep the output in reading order.
// ══════════════════════════════════════════════════════════════════════════

/** Drives the interactive wizard with a stub `prompts`, capturing every question. */
async function runWizard(answers, existingLayout = null) {
  promptLog.length = 0;
  const queue = [...answers];
  promptAnswer = (question) => (queue.length ? queue.shift() : unexpectedPrompt(question));
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
    `${queue.length} prepared answer(s) went unused — the wizard asked fewer questions than ` +
    `expected, which is as much a change in behaviour as asking more`);
  const modeQuestions = promptLog.filter(q => q && q.name === 'mode');
  return { layout, modeQuestions };
}

testAsync('collectRepoLayout offers STORE_MODES for the knowledgebase and SPRINT_MODES for sprint management', async () => {
  const { modeQuestions } = await runWizard([{ mode: 'same' }, { mode: 'same' }]);
  assert.strictEqual(modeQuestions.length, 2,
    `the wizard asks one mode question per concern; got ${modeQuestions.length}`);

  const [kb, sprint] = modeQuestions;
  assert.deepStrictEqual(kb.choices.map(c => c.value), [...STORE_MODES],
    'the knowledgebase question must offer exactly STORE_MODES, in enum order');
  assert.deepStrictEqual(sprint.choices.map(c => c.value), [...SPRINT_MODES],
    'the sprint-management question must offer exactly SPRINT_MODES, in enum order');
  assert.ok(sprint.choices.some(c => c.value === 'jira'),
    'sprint management must still offer Jira — a call site that passes a constant concern ' +
    'silently drops it, and every other suite stays green');
  assert.ok(!kb.choices.some(c => c.value === 'jira'),
    'the knowledgebase question must not offer jira — the writer would reject it');
});

testAsync('the wizard offers the titles from MODE_PROMPT_TITLES, not a hardcoded list', async () => {
  const { modeQuestions } = await runWizard([{ mode: 'same' }, { mode: 'same' }]);
  for (const q of modeQuestions) {
    for (const choice of q.choices) {
      assert.strictEqual(choice.title, MODE_PROMPT_TITLES[choice.value],
        `the wizard offered ${JSON.stringify(choice.value)} with title ` +
        `${JSON.stringify(choice.title)}, which is not the table's title for it`);
    }
  }
});

testAsync('the wizard pre-selects the existing mode — `initial` still indexes the offered list', async () => {
  const { modeQuestions } = await runWizard(
    [{ mode: 'same' }, { mode: 'same' }],
    { knowledgebase: { mode: 'remote', path: '.' }, sprintManagement: { mode: 'jira' } }
  );
  const [kb, sprint] = modeQuestions;
  assert.strictEqual(kb.choices[kb.initial].value, 'remote',
    `an existing knowledgebase mode of remote must be pre-selected; initial=${kb.initial}`);
  assert.strictEqual(sprint.choices[sprint.initial].value, 'jira',
    `an existing sprint mode of jira must be pre-selected; initial=${sprint.initial}`);
});

// ══════════════════════════════════════════════════════════════════════════
// 6 — the rendered legal set, and the hardening around the single sources.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n6 — the rendering is pinned, the exports are inert, the renderer is total');

test('legalBackendsForMessage renders the enum exactly — separator included', () => {
  assert.strictEqual(legalBackendsForMessage(), '"file-system" or "confluence"',
    'the rendered legal set is user-visible in both backend messages; pin it');
  // ...and it is genuinely DERIVED, not a coincidentally-matching literal.
  assert.deepStrictEqual(
    legalBackendsForMessage().split(/,\s*|\s+or\s+/).map(s => JSON.parse(s)),
    [...STORE_BACKENDS],
    'the rendering must decode back to exactly the members of STORE_BACKENDS, in order');
});

test('the exported enums are COPIES — poisoning one cannot widen what cli.js accepts', () => {
  // All THREE exported enums, not two: exporting a live STORE_MODES while the
  // other two were copies survived the previous version of this test at 24/0.
  STORE_BACKENDS.add('notion');
  SPRINT_MODES.add('smartsheet');
  STORE_MODES.add('sharepoint');
  try {
    const result = readFixture([
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: notion',
      '  database_id: "abc"',
      'software_requirements_store:',
      ...OK_STORE,
    ]);
    assert.strictEqual(result.ok, false,
      'adding a member to the EXPORTED set must not teach the reader a new backend');
    const err = writeError({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'smartsheet', path: '.' },
    });
    assert.ok(err, 'adding a member to the EXPORTED set must not teach the writer a new mode');

    // STORE_MODES, the third enum — asserted on BOTH halves, since it is the
    // one consumed by the reader, the writer and the wizard alike.
    const storeWriteErr = writeError({
      systemRequirementsStore: { backend: 'file-system', mode: 'sharepoint', path: '.' },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(storeWriteErr,
      'adding a member to the EXPORTED STORE_MODES must not teach the writer a new store mode');
    const storeRead = readFixture([
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: sharepoint',
      '  path: "."',
      'software_requirements_store:',
      ...OK_STORE,
    ]);
    assert.strictEqual(storeRead.ok, false,
      'adding a member to the EXPORTED STORE_MODES must not teach the reader a new store mode');
    assert.deepStrictEqual(modeChoicesFor('knowledgebase').map(c => c.value), ['same', 'local', 'remote'],
      'nor may it widen what the wizard offers');
  } finally {
    STORE_BACKENDS.delete('notion');
    SPRINT_MODES.delete('smartsheet');
    STORE_MODES.delete('sharepoint');
  }
});

test('MODE_PROMPT_TITLES is frozen — a consumer cannot rewrite what the wizard offers', () => {
  assert.ok(Object.isFrozen(MODE_PROMPT_TITLES), 'the prompt-title table must be frozen');
  assert.throws(() => { MODE_PROMPT_TITLES.same = 'Poisoned'; }, TypeError,
    'assigning a title must throw under strict mode rather than silently succeed');
  assert.strictEqual(MODE_PROMPT_TITLES.same, 'Current repository (default)');
});

test('an unprintable backend still yields the real message, not a bare TypeError', () => {
  // JSON.stringify throws on a BigInt and on a circular object. On an error path
  // that would escape as a TypeError naming neither the field nor the legal set.
  const circular = { backend: 'x' };
  circular.self = circular;
  const cases = [
    ['BigInt', 10n],
    ['a circular object', circular],
    ['a symbol', Symbol('nope')],
    ['a number', 42],
  ];
  for (const [label, value] of cases) {
    const err = writeError({
      systemRequirementsStore: { backend: value, path: '.' },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(err, `${label}: an illegal backend must throw`);
    assert.ok(/^Invalid store backend /.test(err.message),
      `${label}: expected the serializer's own message, got: ${err.name}: ${err.message}`);
    assert.ok(err.message.endsWith(`must be ${legalBackendsForMessage()}`),
      `${label}: the message must still name the legal set, got: ${err.message}`);
  }
});

test('an unprintable MODE also yields the real message — both writers render values the same way', () => {
  // The write half's other value renderer. `assertWritableMode` takes
  // `store.mode` / `sprint.mode` straight off a caller-supplied object with no
  // type guard, and `writeProjectLayoutYaml` is exported — so this is reachable,
  // not theoretical. Its read-side twin `requireKnownMode` deliberately keeps
  // plain JSON.stringify: everything reaching it has passed through
  // `scalarString()` and is a string by construction.
  const circular = { mode: 'x' };
  circular.self = circular;
  const cases = [['BigInt', 1n], ['a circular object', circular], ['a symbol', Symbol('nope')]];
  for (const [label, value] of cases) {
    const sprintErr = writeError({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: value, path: '.' },
    });
    assert.ok(sprintErr, `${label}: an illegal sprint mode must throw`);
    assert.ok(/invalid sprint_management mode /.test(sprintErr.message),
      `${label}: expected assertWritableMode's own message, got: ${sprintErr.name}: ${sprintErr.message}`);
    assert.deepStrictEqual(writtenLegalModes(sprintErr.message), [...SPRINT_MODES],
      `${label}: the message must still enumerate SPRINT_MODES, got: ${sprintErr.message}`);

    const storeErr = writeError({
      systemRequirementsStore: { backend: 'file-system', mode: value, path: '.' },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    assert.ok(storeErr, `${label}: an illegal store mode must throw`);
    assert.ok(/invalid knowledge-store mode /.test(storeErr.message),
      `${label}: expected assertWritableMode's own message, got: ${storeErr.name}: ${storeErr.message}`);
  }

  // And the change is inert for every value that actually occurs: a string.
  const stringErr = writeError({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'bogus', path: '.' },
  });
  assert.ok(stringErr.message.includes('"bogus"'),
    `a string mode must still render JSON-quoted exactly as before, got: ${stringErr.message}`);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
//
// Two independent guards, because a suite that can exit 0 without reporting is
// worse than a suite with a gap in it: the gap loses one assertion, a skipped
// summary loses all of them, including real failures already recorded by the
// synchronous tests. An `&&`-chained runner keys on the exit code alone.
//
//   1. A hard total. Anything that stops tests running — an early `process.exit`
//      inside an awaited call, a rejected drain, a `return` that skips a block —
//      changes this number, and the count is checked before the exit code is.
//   2. A process-level backstop, so the summary cannot be skipped by ANY
//      mechanism rather than only the ones anticipated here. Setting
//      `process.exitCode` from an 'exit' listener does override an explicit
//      `process.exit(0)` (verified), which is precisely the case that bit.
const EXPECTED_TEST_COUNT = 25;
let summaryPrinted = false;

process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Something aborted the process ` +
    `mid-run — the usual cause is a cli.js code path calling process.exit() from inside an ` +
    `awaited test. Forcing a non-zero exit so this cannot read as a pass.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

function printSummary() {
  const total = passed + failed;
  console.log(`\n${passed} passed, ${failed} failed`);
  summaryPrinted = true;
  if (total !== EXPECTED_TEST_COUNT) {
    console.error(
      `\n  FATAL: ${total} tests ran, but this file defines ${EXPECTED_TEST_COUNT}. Tests that ` +
      `never ran cannot fail, so a shortfall is a silent green — treat it as a failure. If you ` +
      `added or removed a test, update EXPECTED_TEST_COUNT deliberately.`
    );
    process.exitCode = 1;
  }
  if (failed > 0) {
    console.error('\nFailures:');
    for (const { name, error } of errors) console.error(`  - ${name}: ${error}`);
    process.exitCode = 1;
  }
}

drainAsyncTests().then(printSummary, (err) => {
  // A rejection here means drainAsyncTests itself broke, not a test — its own
  // try/catch already converts per-test throws into recorded failures.
  console.error(`\n  FATAL: the async drain itself threw: ${(err && err.stack) || err}`);
  summaryPrinted = true;
  process.exitCode = 1;
});
