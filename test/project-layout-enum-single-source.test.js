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

// ─── Load module ─────────────────────────────────────────────────────────────
let writeProjectLayoutYaml, resolveProjectTopology, BINDING_INVALID,
  STORE_MODES, SPRINT_MODES, STORE_BACKENDS, MODE_PROMPT_TITLES, modeChoicesFor;
try {
  ({
    writeProjectLayoutYaml, resolveProjectTopology, BINDING_INVALID,
    STORE_MODES, SPRINT_MODES, STORE_BACKENDS, MODE_PROMPT_TITLES, modeChoicesFor,
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
  assert.ok(!/\bjira\b/.test(err.message.split('—')[1] || ''),
    `the store-mode legal set printed must not include jira, got: ${err.message}`);

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

  // The point of the single source: the two messages enumerate the SAME set.
  // Hand-written lists are exactly how a fourth backend would end up named by
  // one direction and not the other.
  for (const backend of STORE_BACKENDS) {
    assert.ok(err.message.includes(backend),
      `the WRITE message omits the legal backend ${JSON.stringify(backend)}: ${err.message}`);
    assert.ok(result.message.includes(backend),
      `the READ message omits the legal backend ${JSON.stringify(backend)}: ${result.message}`);
  }
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
  for (const mode of SPRINT_MODES) {
    assert.ok(err.message.includes(mode),
      `the sprint-mode error omits the legal mode ${JSON.stringify(mode)} — the write half was ` +
      `validating against STORE_MODES, so a user who mistyped a sprint mode was told jira was ` +
      `illegal while the read half accepts it. Got: ${err.message}`);
  }
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
  for (const mode of SPRINT_MODES) {
    assert.ok(err.message.includes(mode) && readResult.message.includes(mode),
      `write and read must agree that ${JSON.stringify(mode)} is legal.\n  write: ${err.message}\n  read:  ${readResult.message}`);
  }
});

test('sprint mode jira is written and read back as jira — independent of the early return', () => {
  const { content, result } = roundTrip({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'MA' },
  });
  assert.ok(result.ok, `a jira sprint binding must read back, got ${result.reason}: ${result.message}`);
  assert.strictEqual(result.topology.sprintManagement.mode, 'jira');
  assert.strictEqual(result.topology.sprintManagement.jiraProjectKey, 'MA');
  if (yamlOracle) {
    const doc = yamlOracle.load(content);
    assert.strictEqual(doc.sprint_management.mode, 'jira',
      'a real YAML parser must see mode: jira in the authoritative file');
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const { name, error } of errors) console.error(`  - ${name}: ${error}`);
  process.exit(1);
}
