#!/usr/bin/env node
/**
 * Story 31.5 — TWO INDEPENDENT KNOWLEDGE-STORE QUESTIONS, EACH WITH ITS OWN
 * BACKEND AND ITS OWN LOCATION.
 *
 * WHAT THIS FILE IS FOR. `project-layout-two-store-round-trip.test.js` proves the
 * SCHEMA can hold two divergent stores and that nothing destroys one of them.
 * `project-layout-enum-single-source.test.js` proves the wizard offers values
 * derived from the closed enums. Neither proves the property Story 31.5 exists
 * for: that the two stores are asked SEPARATELY and that neither answer
 * constrains the other, in backend or in location (AC2, FR257, P5-9.5).
 *
 * AC2 AS AMENDED. The AC's own wording asks for "a test proves all four backend
 * combinations are reachable". That is unmeetable inside this story: `confluence`
 * has no wizard flow until Story 31.8, which is itself blocked on this one, so
 * two of the four combinations cannot be REACHED THROUGH THE WIZARD by
 * construction. The implementation-readiness review moved the four-combination
 * live test to 31.8. What is proved here instead, and what 31.8 inherits:
 *
 *   - INDEPENDENCE over the backends actually reachable in this story — the
 *     backend question for the software store offers the same set whatever the
 *     system store answered, and vice versa (`independence` section below);
 *   - INDEPENDENCE over LOCATION, exhaustively: all nine (system mode) x
 *     (software mode) combinations over STORE_MODES, each asserted to have
 *     landed its own answer in its own record;
 *   - the SCHEMA-level proof that a `confluence` store round-trips through
 *     Story 31.2's writer and reader, so 31.8 has only to add a `collect` flow
 *     to `STORE_BACKEND_WIZARD` — restated here rather than assumed, because it
 *     is the half of AC2 that survives the amendment.
 *
 * THE FAILURE SHAPE THIS EPIC KEEPS PRODUCING is a default or a validation that
 * degrades to permissive, and its sibling, a test that proves PRESENCE rather
 * than the absence of anything else. Two consequences for this file:
 *
 *   - the NFR82 claim ("behaves exactly as a single-knowledgebase project does
 *     today") is asserted by BYTE COMPARISON against a real baseline — the
 *     layout object the pre-31.5 wizard returned for the all-defaults answer,
 *     put through the same writer — not by spot-checking a few fields;
 *   - "no additional prompts on subsequent runs" is asserted as SEQUENCE
 *     EQUALITY of the questions across two runs, not as a count.
 *
 * ORACLE. js-yaml, a declared direct dependency, wherever the subject is what
 * bytes reached the authoritative file. Its absence is a HARD FAILURE here
 * rather than a degraded assertion: this suite's YAML claims are per-record and
 * a `schema_version` smoke test would leave them asserting essentially nothing.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

let passed = 0;
let failed = 0;
const errors = [];

// The process-level backstop, registered BEFORE the first test — the wizard's
// interactive branch calls `process.exit(0)` on a cancelled prompt, and this
// file drives that branch. Without this, such an exit would end the run at 0
// with no summary and the `&&`-chained runner would read it as a pass.
let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. The usual cause is a cli.js ` +
    `path calling process.exit() from inside a test. Forcing a non-zero exit.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ─── The prompts stub ────────────────────────────────────────────────────────
//
// Installed in the require cache BEFORE cli.js is loaded, so cli.js's own
// `require('prompts')` binds to it. It NEVER answers a question it was not given
// an answer for: returning `{}` would make cli.js read the field as undefined and
// reach `if (!mode) process.exit(0)`, aborting the process mid-run — a whole
// suite exiting 0 having reported nothing. Throwing turns that into an ordinary
// named failure.
const promptsModulePath = require.resolve('prompts');
require('prompts');
const promptLog = [];

function unexpectedPrompt(question) {
  const name = (question && question.name) || '(unnamed)';
  const message = (question && question.message) || '';
  throw new Error(
    `the wizard asked more questions than the test answered — unanswered prompt ` +
    `${JSON.stringify(name)} (${JSON.stringify(message)}). Add an answer to the queue ` +
    `rather than letting the stub default it.`
  );
}
let promptAnswer = unexpectedPrompt;
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  promptLog.push(question);
  return promptAnswer(question);
};

// ─── Load module ─────────────────────────────────────────────────────────────
let collectRepoLayout, writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
  generateBmmConfig, STORE_MODES, STORE_BACKENDS, offerableStoreBackends,
  REPO_LAYOUT_CONCERNS, storesDiverge;
try {
  ({
    collectRepoLayout, writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
    generateBmmConfig, STORE_MODES, STORE_BACKENDS, offerableStoreBackends,
    REPO_LAYOUT_CONCERNS, storesDiverge,
  } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// A hard dependency, not a soft one. See the ORACLE note in the header: a
// degraded fallback here would leave the per-record assertions asserting nothing,
// which is the "test that proves presence" shape this suite exists to avoid.
let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('\n  FATAL: js-yaml is unavailable, and this suite\'s YAML oracle is not optional.');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTmpDir() {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-2sw-')));
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

function readLayoutFile(tmpDir) {
  return fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
}

// The only line that may differ between two otherwise-identical writes.
function withoutGeneratedLine(content) {
  return content.split(/\r?\n/).filter((l) => !/^generated:/.test(l)).join('\n');
}

function silence(fn) {
  const orig = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = orig; }
}

async function silenceAsync(fn) {
  const orig = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return lines.join('\n');
}

function parseLayout(content, what) {
  try {
    return yaml.load(content);
  } catch (e) {
    throw new Error(`${what}: emitted file is NOT parseable by js-yaml: ${e.message.split('\n')[0]}`);
  }
}

/**
 * Drives the interactive wizard with a prepared answer queue, capturing every
 * question. Asserts the queue was fully consumed in BOTH directions: leftover
 * answers mean the wizard asked fewer questions than expected, which is as much
 * a change in behaviour as asking more.
 */
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
    `${queue.length} prepared answer(s) went unused — the wizard asked fewer questions than expected`);
  return { layout, questions: promptLog.map(summarizeQuestion) };
}

// What a question IS, for comparison purposes: everything the user sees.
function summarizeQuestion(q) {
  return {
    name: q.name,
    message: q.message,
    choices: (q.choices || []).map((c) => c.value),
    initial: q.initial,
  };
}

// The answer queue for "accept every default": file-system, current repository,
// for each store, and current repository for sprint management.
const ALL_DEFAULTS = [
  { backend: 'file-system' }, { mode: 'same' },
  { backend: 'file-system' }, { mode: 'same' },
  { mode: 'same' },
];

// Per-mode answer builders. `remote` deliberately points at an EXISTING
// directory: `collectRemotePath` then takes its confirm-and-use branch and never
// shells out to git, so the nine-combination matrix below stays hermetic while
// still exercising the real FR115/FR116 flow.
function answersForMode(mode, dir) {
  if (mode === 'same') return [{ mode: 'same' }];
  if (mode === 'local') return [{ mode: 'local' }, { localPath: dir }];
  if (mode === 'remote') {
    return [{ mode: 'remote' }, { url: `https://example.invalid/${path.basename(dir)}.git` },
      { dest: dir }, { confirmed: true }];
  }
  throw new Error(`no answer builder for mode ${mode}`);
}

function expectedRecordForMode(mode, dir) {
  if (mode === 'same') return { backend: 'file-system', mode: 'same', path: '.' };
  if (mode === 'local') return { backend: 'file-system', mode: 'local', path: dir };
  return {
    backend: 'file-system', mode: 'remote', path: dir,
    gitUrl: `https://example.invalid/${path.basename(dir)}.git`,
  };
}

const LEGACY_SPRINT = { mode: 'same', path: '.' };

// ══════════════════════════════════════════════════════════════════════════
// AC2 — INDEPENDENCE. The headline property of the story.
// ══════════════════════════════════════════════════════════════════════════

test('AC2/FR258 — all nine (system mode) x (software mode) combinations land in their OWN record', async () => {
  // The exhaustive location-independence proof. FR258's normal case is two
  // file-system stores in DIFFERENT places, and the pre-31.5 code had exactly one
  // question, so a loop that asked twice but wrote one answer into both records
  // would satisfy every count-based test. Each combination is checked for both
  // "the right value landed here" AND "the other store's value did not".
  const modes = [...STORE_MODES];
  assert.deepStrictEqual(modes, ['same', 'local', 'remote'],
    'the matrix is over the whole of STORE_MODES; if a mode was added, extend the builders');

  for (const systemMode of modes) {
    for (const softwareMode of modes) {
      const { tmpDir, cleanup } = withTmpDir();
      try {
        const sysDir = path.join(tmpDir, 'sys-store');
        const sweDir = path.join(tmpDir, 'swe-store');
        fs.mkdirSync(sysDir, { recursive: true });
        fs.mkdirSync(sweDir, { recursive: true });

        const { layout } = await runWizard([
          { backend: 'file-system' }, ...answersForMode(systemMode, sysDir),
          { backend: 'file-system' }, ...answersForMode(softwareMode, sweDir),
          { mode: 'same' },
        ]);

        const label = `${systemMode}/${softwareMode}`;
        assert.deepStrictEqual(layout.systemRequirementsStore,
          expectedRecordForMode(systemMode, sysDir),
          `${label}: the system store did not receive its own answer`);
        assert.deepStrictEqual(layout.softwareRequirementsStore,
          expectedRecordForMode(softwareMode, sweDir),
          `${label}: the software store did not receive its own answer`);
        assert.deepStrictEqual(layout.sprintManagement, LEGACY_SPRINT,
          `${label}: sprint management must be untouched by either store`);

        // And it survives to the committed file, per record.
        silence(() => writeProjectLayoutYaml(layout));
        const doc = parseLayout(readLayoutFile(tmpDir), label);
        assert.strictEqual(doc.system_requirements_store.mode, systemMode, `${label}: system mode on disk`);
        assert.strictEqual(doc.software_requirements_store.mode, softwareMode, `${label}: software mode on disk`);
        if (systemMode !== softwareMode || systemMode !== 'same') {
          const sysPath = doc.system_requirements_store.path;
          const swePath = doc.software_requirements_store.path;
          if (systemMode !== 'same' && softwareMode !== 'same') {
            assert.notStrictEqual(sysPath, swePath,
              `${label}: two independently-answered locations collapsed onto one path`);
          }
        }
      } finally {
        cleanup();
      }
    }
  }
});

test('AC2 — the software store is offered the SAME choices whatever the system store answered', async () => {
  // Independence in the QUESTION, not only in the answer. A wizard that narrowed
  // the second store's options based on the first (e.g. "you chose local, so the
  // other store must be local too") would still pass the matrix above if the
  // test only ever supplied legal answers.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const dir = path.join(tmpDir, 'sys-store');
    fs.mkdirSync(dir, { recursive: true });

    const asked = {};
    for (const systemMode of [...STORE_MODES]) {
      const { questions } = await runWizard([
        { backend: 'file-system' }, ...answersForMode(systemMode, dir),
        { backend: 'file-system' }, { mode: 'same' },
        { mode: 'same' },
      ]);
      // The software store's two questions are the second `backend` and the
      // second `mode`, whatever the system store's flow asked in between.
      const backends = questions.filter((q) => q.name === 'backend');
      const modes = questions.filter((q) => q.name === 'mode');
      asked[systemMode] = {
        backend: backends[1].choices,
        mode: modes[1].choices,
        backendMessage: backends[1].message,
        modeMessage: modes[1].message,
      };
    }

    const reference = asked.same;
    for (const systemMode of [...STORE_MODES]) {
      assert.deepStrictEqual(asked[systemMode], reference,
        `answering the system store with ${systemMode} changed what the software store was offered`);
    }
    assert.deepStrictEqual(reference.backend, offerableStoreBackends(),
      'the software store must be offered the full offerable backend set regardless');
    assert.deepStrictEqual(reference.mode, [...STORE_MODES],
      'the software store must be offered the whole of STORE_MODES regardless');
  } finally {
    cleanup();
  }
});

test('AC2 — the SYSTEM store is offered the same choices whatever an existing software store says', async () => {
  // The other direction. The system store is asked FIRST, so the only way an
  // answer about software could reach it is through pre-population — which is
  // exactly what `existingRecordForConcern` does. A committed pair whose stores
  // diverge must pre-populate each question from its OWN record.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const sysDir = path.join(tmpDir, 'a');
    const sweDir = path.join(tmpDir, 'b');
    fs.mkdirSync(sysDir, { recursive: true });
    fs.mkdirSync(sweDir, { recursive: true });
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: sweDir },
      sprintManagement: LEGACY_SPRINT,
    }));

    const existing = silence(() => readExistingLayout());
    assert.ok(existing && existing.topology, 'the committed pair must be readable');
    const { questions } = await runWizard(ALL_DEFAULTS, existing);
    const modes = questions.filter((q) => q.name === 'mode');

    assert.strictEqual(modes[0].choices[modes[0].initial], 'same',
      'the SYSTEM question must pre-select the SYSTEM store\'s committed mode, not the software store\'s');
    assert.strictEqual(modes[1].choices[modes[1].initial], 'local',
      'the SOFTWARE question must pre-select the SOFTWARE store\'s committed mode');
    assert.deepStrictEqual(modes[0].choices, [...STORE_MODES],
      'a divergent committed pair must not narrow what either question offers');
  } finally {
    cleanup();
  }
});

test('AC2 handoff to 31.8 — a confluence store still round-trips through the 31.2 schema', async () => {
  // The half of AC2 that survives the amendment. The wizard cannot produce a
  // confluence store in this story, so what 31.8 inherits is the guarantee that
  // once `STORE_BACKEND_WIZARD.confluence.collect` exists, the record it returns
  // is writable and readable with no schema change. Asserted here rather than
  // assumed, on the mixed pair FR257 names.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const mixed = {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '1001' },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: LEGACY_SPRINT,
    };
    silence(() => writeProjectLayoutYaml(mixed));
    const doc = parseLayout(readLayoutFile(tmpDir), 'mixed pair');
    assert.strictEqual(doc.system_requirements_store.backend, 'confluence');
    assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
    assert.strictEqual(doc.software_requirements_store.backend, 'file-system');

    const binding = resolveProjectTopology(tmpDir);
    assert.ok(binding.ok, `the mixed pair must read back: ${binding.reason} ${binding.message}`);
    assert.strictEqual(binding.topology.systemRequirementsStore.spaceKey, 'SYS');
    assert.ok(storesDiverge(binding.topology.systemRequirementsStore,
      binding.topology.softwareRequirementsStore),
      'a confluence/file-system pair must compare as divergent');
    assert.ok(STORE_BACKENDS.has('confluence'),
      'the enum member 31.8 needs must still exist');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC1 / AC7 — what the user is actually asked.
// ══════════════════════════════════════════════════════════════════════════

test('AC1 — two store questions replace FR111\'s one, and FR112\'s sprint question is unchanged', async () => {
  const { questions } = await runWizard(ALL_DEFAULTS);
  const messages = questions.map((q) => q.message);

  // FR111 is SUPERSEDED, not extended: the single "knowledgebase" question is
  // gone. Asserted on the whole question list, so a third store question or a
  // surviving knowledgebase question both fail.
  assert.ok(!messages.some((m) => /knowledgebase/i.test(m)),
    `FR111's single knowledgebase question must be gone, got:\n  ${messages.join('\n  ')}`);
  assert.strictEqual(questions.length, 5,
    `two stores x (backend + location) + one sprint question = 5; got ${questions.length}`);
  assert.strictEqual(
    messages.filter((m) => m === 'Where is your sprint management managed?').length, 1,
    'FR112 remains exactly one separate question, asked as it is today');

  // ...and it is asked LAST, after both stores, so sprint management is visibly
  // a third concern rather than part of either store (FR112/FR267).
  assert.strictEqual(messages[messages.length - 1], 'Where is your sprint management managed?');
});

test('AC1 — FR112\'s sprint question still reaches the Jira flow, and Jira is offered to NEITHER store', async () => {
  // "Unchanged" has to include the branch that is easiest to lose when a loop is
  // rewritten. Nothing else in the repo drives sprint `jira` THROUGH THE WIZARD —
  // the enum suite pre-selects it but answers `same` — so deleting the jira
  // branch from the sprint collector would have survived every suite.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout, questions } = await runWizard([
      { backend: 'file-system' }, { mode: 'same' },
      { backend: 'file-system' }, { mode: 'same' },
      { mode: 'jira' }, { url: 'https://jira.example.com' }, { key: 'MA' },
    ]);
    assert.deepStrictEqual(layout.sprintManagement,
      { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'MA' },
      'the sprint question must still reach collectJiraConfig and return its record');

    // The stores must not have been offered jira in the first place — the writer
    // rejects it for a knowledge store, so offering it would be a dead end.
    const storeModeQuestions = questions.filter((q) => q.name === 'mode').slice(0, 2);
    for (const q of storeModeQuestions) {
      assert.ok(!q.choices.includes('jira'), `a knowledge store must not be offered jira: ${q.message}`);
    }

    // ...and both stores are untouched by a Jira sprint backend.
    assert.deepStrictEqual(layout.systemRequirementsStore, { backend: 'file-system', mode: 'same', path: '.' });
    assert.deepStrictEqual(layout.softwareRequirementsStore, { backend: 'file-system', mode: 'same', path: '.' });

    silence(() => writeProjectLayoutYaml(layout));
    const doc = parseLayout(readLayoutFile(tmpDir), 'jira sprint + two stores');
    assert.strictEqual(doc.sprint_management.mode, 'jira');
    assert.strictEqual(doc.sprint_management.jira_url, 'https://jira.example.com');
    assert.strictEqual(doc.sprint_management.jira_project_key, 'MA');
    assert.strictEqual(doc.system_requirements_store.mode, 'same');
  } finally {
    cleanup();
  }
});

test('AC7 — each store question states that store\'s contents, and not the other\'s', async () => {
  const { questions } = await runWizard(ALL_DEFAULTS);
  const [systemQ, softwareQ] = questions.filter((q) => q.name === 'backend').map((q) => q.message);

  // FR255: system requirements = product brief and PRD, sharded PRD included.
  for (const needle of ['product brief', 'PRD', 'sharded', 'shards']) {
    assert.ok(systemQ.includes(needle),
      `the system-requirements question must name ${JSON.stringify(needle)}: ${systemQ}`);
  }
  // FR256: software requirements = architecture document, UX designs, epics.
  for (const needle of ['architecture', 'UX', 'epics']) {
    assert.ok(softwareQ.includes(needle),
      `the software-requirements question must name ${JSON.stringify(needle)}: ${softwareQ}`);
  }

  // Disjointness is the point of AC7 — the two questions must not be confusable.
  // A statement of contents that named both stores' artifacts would satisfy every
  // "contains" assertion above and leave the questions exactly as ambiguous.
  for (const needle of ['architecture', 'epics']) {
    assert.ok(!systemQ.includes(needle),
      `the system-requirements question must NOT claim ${JSON.stringify(needle)}: ${systemQ}`);
  }
  for (const needle of ['product brief', 'PRD']) {
    assert.ok(!softwareQ.includes(needle),
      `the software-requirements question must NOT claim ${JSON.stringify(needle)}: ${softwareQ}`);
  }

  // And the contents come from the concern table, not from a literal in the loop.
  for (const concern of REPO_LAYOUT_CONCERNS.filter((c) => c.kind === 'store')) {
    assert.ok(questions.some((q) => q.name === 'backend' && q.message.includes(concern.contents)),
      `no backend question carried ${concern.key}'s declared contents`);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC6 — persistence through the 31.2 schema, unconditionally.
// ══════════════════════════════════════════════════════════════════════════

test('AC6 — project-layout.yaml is written even when BOTH stores answer "current repository"', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard(ALL_DEFAULTS);
    silence(() => writeProjectLayoutYaml(layout));
    assert.ok(fs.existsSync(layoutPathOf(tmpDir)),
      'the all-defaults answer must still commit a binding — the pre-31.2 "skip when same" branch is gone');
    const doc = parseLayout(readLayoutFile(tmpDir), 'all defaults');
    for (const key of ['system_requirements_store', 'software_requirements_store']) {
      assert.strictEqual(doc[key].backend, 'file-system');
      assert.strictEqual(doc[key].mode, 'same');
      assert.strictEqual(doc[key].path, '.');
    }
    assert.strictEqual(doc.sprint_management.mode, 'same');
    assert.strictEqual(doc.sprint_management.path, '.');
  } finally {
    cleanup();
  }
});

test('AC6 — a divergent pair is persisted as answered, and generates per-store config fields', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const sysDir = path.join(tmpDir, 'sys');
    const sweDir = path.join(tmpDir, 'swe');
    fs.mkdirSync(sysDir, { recursive: true });
    fs.mkdirSync(sweDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'project_name: divergent\n', 'utf-8');

    const { layout } = await runWizard([
      { backend: 'file-system' }, { mode: 'local' }, { localPath: sysDir },
      { backend: 'file-system' }, { mode: 'local' }, { localPath: sweDir },
      { mode: 'same' },
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    silence(() => generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: layout }));

    const doc = parseLayout(readLayoutFile(tmpDir), 'divergent pair');
    assert.notStrictEqual(doc.system_requirements_store.path, doc.software_requirements_store.path,
      'two divergent answers must reach the file as two different paths');

    // Story 31.3's generator is downstream of this story's two stores. The
    // per-store fields must follow their OWN store, and the legacy single-valued
    // field must follow the SOFTWARE store (FR264).
    const cfg = yaml.load(fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8'));
    assert.strictEqual(cfg.system_requirements_path, doc.system_requirements_store.path,
      'system_requirements_path must follow the SYSTEM store');
    assert.strictEqual(cfg.software_requirements_path, doc.software_requirements_store.path,
      'software_requirements_path must follow the SOFTWARE store');
    assert.strictEqual(cfg.knowledgebase_path, doc.software_requirements_store.path,
      'FR264: the legacy single-valued field resolves to the SOFTWARE store');
    assert.notStrictEqual(cfg.system_requirements_path, cfg.software_requirements_path,
      'a divergent pair must not generate two identical config paths');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC8 / NFR82 — a defaults project behaves exactly as today.
// ══════════════════════════════════════════════════════════════════════════

test('NFR82 — accepting both defaults writes the BYTE-IDENTICAL project-layout.yaml a pre-31.5 project wrote', async () => {
  // THE BASELINE. `{knowledgebase: {mode:'same', path:'.'}, sprintManagement:
  // {mode:'same', path:'.'}}` is precisely the object the pre-31.5
  // `collectRepoLayout` returned when the user accepted the single
  // knowledgebase question's default (bin/cli.js at ff09a6f — the same object
  // its `--yes` branch still returns today, which is why that branch is left
  // untouched by this story and is a live baseline rather than a remembered one).
  // Put through the SAME writer, byte-for-byte, with only the date line excluded.
  const legacy = withTmpDir();
  let baseline;
  try {
    silence(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: LEGACY_SPRINT }));
    baseline = readLayoutFile(legacy.tmpDir);
  } finally {
    legacy.cleanup();
  }

  const current = withTmpDir();
  try {
    const { layout } = await runWizard(ALL_DEFAULTS);
    silence(() => writeProjectLayoutYaml(layout));
    const produced = readLayoutFile(current.tmpDir);
    assert.strictEqual(withoutGeneratedLine(produced), withoutGeneratedLine(baseline),
      `the two-store wizard's all-defaults output differs from the single-question baseline.\n` +
      `BASELINE:\n${baseline}\nPRODUCED:\n${produced}`);
  } finally {
    current.cleanup();
  }
});

test('NFR82 — ...and the GENERATED config.yaml is byte-identical too, stamp included', async () => {
  // The file the 39 skill references actually read. A layout that serialises the
  // same but generates a different config would move every resolved artifact
  // path, which is the substance of NFR82's "same resolved artifact paths".
  function configFor(seed) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'),
        'project_name: nfr82\nuser_name: someone\noutput_folder: _bmad-output\n', 'utf-8');
      silence(() => writeProjectLayoutYaml(seed));
      silence(() => generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: seed }));
      return fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    } finally {
      cleanup();
    }
  }

  const baseline = configFor({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: LEGACY_SPRINT });
  const { layout } = await runWizard(ALL_DEFAULTS);
  const produced = configFor(layout);
  assert.strictEqual(produced, baseline,
    `the generated config.yaml differs from the single-knowledgebase baseline.\n` +
    `BASELINE:\n${baseline}\nPRODUCED:\n${produced}`);
  // Not a vacuous comparison of two empty strings.
  const cfg = yaml.load(produced);
  assert.strictEqual(cfg.knowledgebase_path, '.');
  assert.strictEqual(cfg.system_requirements_path, '.');
  assert.strictEqual(cfg.software_requirements_path, '.');
  assert.strictEqual(cfg.planning_artifacts, '{project-root}/_bmad-output/planning-artifacts');
});

test('AC8 — a second run asks EXACTLY the same questions: no additional prompts on subsequent runs', async () => {
  // Sequence equality, not a count. A wizard that asked the same NUMBER of
  // questions but pre-selected a different default, or renamed one, would pass a
  // count-based test while changing what the user has to do on every reinstall.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const first = await runWizard(ALL_DEFAULTS);
    silence(() => writeProjectLayoutYaml(first.layout));

    const existing = silence(() => readExistingLayout());
    assert.ok(existing && existing.topology,
      'the first run must leave a readable committed binding, or run two is not a "subsequent run"');

    const second = await runWizard(ALL_DEFAULTS, existing);
    assert.deepStrictEqual(second.questions, first.questions,
      'the second run must ask an identical question sequence — same names, messages, choices and defaults');
    assert.deepStrictEqual(second.layout, first.layout,
      'and produce an identical layout');

    // And the binding is idempotent across the two runs.
    const before = readLayoutFile(tmpDir);
    silence(() => writeProjectLayoutYaml(second.layout));
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      'a defaults reinstall must not change the committed binding');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC9 — `--yes` prompts for nothing.
// ══════════════════════════════════════════════════════════════════════════

test('AC9 — `--yes` asks ZERO questions and defaults both stores to file-system / current repository', async () => {
  const LAYOUT_ENV_KEYS = ['MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL'];
  const saved = {};
  for (const k of LAYOUT_ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  const { tmpDir, cleanup } = withTmpDir();
  try {
    promptLog.length = 0;
    // The stub throws on ANY question, so this asserts absence rather than a
    // count that a soft default could satisfy.
    promptAnswer = unexpectedPrompt;
    const layout = await collectRepoLayout({ yes: true });
    assert.strictEqual(promptLog.length, 0,
      `--yes must not prompt; it asked: ${promptLog.map((q) => q.message).join(' | ')}`);

    silence(() => writeProjectLayoutYaml(layout));
    const doc = parseLayout(readLayoutFile(tmpDir), '--yes virgin');
    for (const key of ['system_requirements_store', 'software_requirements_store']) {
      assert.strictEqual(doc[key].backend, 'file-system', `${key} backend under --yes`);
      assert.strictEqual(doc[key].mode, 'same', `${key} mode under --yes`);
      assert.strictEqual(doc[key].path, '.', `${key} path under --yes`);
    }
  } finally {
    cleanup();
    for (const k of LAYOUT_ENV_KEYS) { if (saved[k] !== undefined) process.env[k] = saved[k]; }
  }
});

test('AC9 — `--yes` over a DIVERGENT committed pair still asks nothing, and destroys neither store', async () => {
  const LAYOUT_ENV_KEYS = ['MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL'];
  const saved = {};
  for (const k of LAYOUT_ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  const { tmpDir, cleanup } = withTmpDir();
  try {
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'local', path: path.join(tmpDir, 'a') },
      softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: path.join(tmpDir, 'b') },
      sprintManagement: LEGACY_SPRINT,
    }));
    const before = readLayoutFile(tmpDir);

    promptLog.length = 0;
    promptAnswer = unexpectedPrompt;
    const existing = silence(() => readExistingLayout());
    const layout = await collectRepoLayout({ yes: true }, existing);
    assert.strictEqual(promptLog.length, 0, '--yes must not prompt even with a divergent binding present');
    silence(() => writeProjectLayoutYaml(layout));
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      'a --yes run over a divergent file-system pair must leave the binding unchanged');
  } finally {
    cleanup();
    for (const k of LAYOUT_ENV_KEYS) { if (saved[k] !== undefined) process.env[k] = saved[k]; }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC5 — a backend the wizard cannot offer is never silently replaced.
// ══════════════════════════════════════════════════════════════════════════

test('AC5 — the interactive wizard does NOT ask about a committed confluence store, and preserves it', async () => {
  // The destructive default this epic already met once, in its other direction:
  // a wizard that offers only `file-system` would turn the very first Enter into
  // "replace my Confluence store with the current repository". The store is
  // preserved verbatim and the user is told, in the same run.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const conf = {
      backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '1001' },
    };
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: conf,
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: LEGACY_SPRINT,
    }));
    const before = readLayoutFile(tmpDir);
    const existing = silence(() => readExistingLayout());

    // Only THREE answers: the confluence store is skipped entirely, so a queue
    // sized for it would be left over and runWizard would fail.
    promptLog.length = 0;
    const queue = [{ backend: 'file-system' }, { mode: 'same' }, { mode: 'same' }];
    promptAnswer = (q) => (queue.length ? queue.shift() : unexpectedPrompt(q));
    let layout;
    const log = await silenceAsync(async () => { layout = await collectRepoLayout({}, existing); });
    promptAnswer = unexpectedPrompt;
    assert.strictEqual(queue.length, 0, 'the remaining two questions must still be asked');

    assert.strictEqual(promptLog.filter((q) => q.name === 'backend').length, 1,
      'only the software store may be asked for a backend — the confluence store has no flow yet');
    assert.ok(!promptLog.some((q) => /system requirements/.test(q.message)),
      `the confluence-backed system store must not be asked about: ` +
      `${promptLog.map((q) => q.message).join(' | ')}`);

    // NEVER SILENT. The one thing worse than asking is not asking and saying
    // nothing — the user would have no way to know the store was skipped.
    assert.ok(/confluence/i.test(log) && /UNCHANGED/.test(log),
      `the skip must be announced and name the backend, got:\n${log}`);
    assert.ok(/SYS/.test(log), `the notice must identify the store that was left alone:\n${log}`);

    assert.deepStrictEqual(layout.systemRequirementsStore, conf,
      'the committed confluence record must be carried through verbatim');
    silence(() => writeProjectLayoutYaml(layout));
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      'an all-defaults interactive run must not change a committed confluence store');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// THE INSTALL PATH — a divergent FILE-SYSTEM pair, end to end.
// ══════════════════════════════════════════════════════════════════════════
//
// Wave 2B's review left this gap named: every install-path test covered a
// divergent CONFLUENCE pair, and none covered `system: local /a` +
// `software: local /b` — FR258's NORMAL case, and the case Story 31.5 is the
// first story that can create. It was pinned in-process only, and the install
// path is where the destructive defect actually lived.
//
// Slow (~1 min) because it runs the real CLI. That is the point: in-process
// calls to `collectRepoLayout` are precisely the coverage that already existed
// and still missed the defect.

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function installYes(cwd) {
  const env = { ...process.env };
  for (const k of ['MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL']) {
    delete env[k];
  }
  const res = spawnSync(process.execPath, [CLI_PATH, 'install', '--yes'], {
    cwd, env, encoding: 'utf-8', input: '', stdio: ['pipe', 'pipe', 'pipe'], timeout: 900000,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  // A timeout is a FAILURE, not a skip: skipping would assert nothing on exactly
  // the runs where the install misbehaves.
  assert.notStrictEqual(res.status, null,
    `\`install --yes\` did not exit within the timeout (signal ${res.signal}).\n${out.slice(-2000)}`);
  assert.strictEqual(res.status, 0, `\`install --yes\` exited ${res.status}.\n${out.slice(-2000)}`);
  return out;
}

test('INSTALL PATH — a divergent FILE-SYSTEM pair survives a real `install --yes`, and config.yaml follows both stores', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const sysDir = path.join(tmpDir, 'sys-requirements');
    const sweDir = path.join(tmpDir, 'swe-requirements');
    fs.mkdirSync(sysDir, { recursive: true });
    fs.mkdirSync(sweDir, { recursive: true });

    // Seeded through the writer itself, so the byte comparison is against this
    // serializer's own output rather than a hand-written look-alike.
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'local', path: sysDir },
      softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: sweDir },
      sprintManagement: LEGACY_SPRINT,
    }));
    const before = readLayoutFile(tmpDir);
    const beforeDoc = parseLayout(before, 'seeded divergent file-system pair');
    assert.notStrictEqual(beforeDoc.system_requirements_store.path,
      beforeDoc.software_requirements_store.path,
      'the fixture itself must be divergent, or this test proves nothing');

    installYes(tmpDir);

    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `\`install --yes\` changed a divergent file-system pair.\nBEFORE:\n${before}\nAFTER:\n${after}`);
    const doc = parseLayout(after, 'divergent file-system pair after install');
    assert.strictEqual(doc.system_requirements_store.path, beforeDoc.system_requirements_store.path);
    assert.strictEqual(doc.software_requirements_store.path, beforeDoc.software_requirements_store.path);
    assert.notStrictEqual(doc.system_requirements_store.path, doc.software_requirements_store.path,
      'the two stores were collapsed onto one path by the install');

    // The derived file the skills read must have followed BOTH stores.
    const cfg = yaml.load(fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8'));
    assert.strictEqual(cfg.system_requirements_path, doc.system_requirements_store.path,
      `config.yaml's system_requirements_path did not follow the system store`);
    assert.strictEqual(cfg.software_requirements_path, doc.software_requirements_store.path,
      `config.yaml's software_requirements_path did not follow the software store`);
    assert.strictEqual(cfg.knowledgebase_path, doc.software_requirements_store.path,
      `FR264: the legacy field must follow the SOFTWARE store`);
  } finally {
    cleanup();
  }
});

// ─── Runner and summary ──────────────────────────────────────────────────────
//
// The count is pinned in BOTH directions: a shortfall means tests that never ran
// (and tests that never ran cannot fail), a surplus means the pin was not
// updated deliberately.
const EXPECTED_TEST_COUNT = 16;

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

  const total = passed + failed;
  console.log(`\n${total} tests, ${passed} passed, ${failed} failed`);
  summaryPrinted = true;
  if (total !== EXPECTED_TEST_COUNT) {
    console.error(
      `\n  FATAL: ${total} tests ran, but this file defines ${EXPECTED_TEST_COUNT}. ` +
      `If you added or removed a test, update EXPECTED_TEST_COUNT deliberately.`
    );
    process.exitCode = 1;
  }
  if (failed > 0) {
    console.error('\nFailures:');
    for (const { name, error } of errors) console.error(`  - ${name}: ${error}`);
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error(`\n  FATAL: the runner itself threw: ${(err && err.stack) || err}`);
  summaryPrinted = true;
  process.exitCode = 1;
});
