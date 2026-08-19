#!/usr/bin/env node
/**
 * Story 31.8 — CONFLUENCE BACKEND CONFIGURATION: SPACE AND ROOT PAGE.
 * FR259, FR260; NFR79, NFR80. Plus the three things this story inherits from
 * Story 31.5, which are the parts most likely to break something that already
 * works.
 *
 * WHAT THIS FILE IS FOR.
 *   - `project-layout-two-store-round-trip.test.js` proves the 31.2 SCHEMA can
 *     hold a confluence store and that nothing destroys one.
 *   - `project-layout-enum-single-source.test.js` proves the wizard's choices are
 *     DERIVED from the closed enums, confluence's offerability included.
 *   - `project-layout-two-store-wizard.test.js` proves the two stores are asked
 *     INDEPENDENTLY, and (since 31.8) that pressing Enter over a committed
 *     confluence store preserves it byte-for-byte.
 * None of those proves what Story 31.8 exists for: that a user can CONFIGURE a
 * Confluence store, offline, without ever being asked for a credential, and that
 * what lands on disk is identity and nothing else.
 *
 * THE TWO NEGATIVES ARE THE POINT. AC4 ("...and nothing else") and AC5 ("no
 * credentials anywhere on disk") are absence claims, and this epic's recurring
 * failure is a test that proves PRESENCE — a field list that says the right
 * fields are there while saying nothing about what else might be. So:
 *
 *   - AC4 is asserted as EXHAUSTIVE KEY-SET EQUALITY over every node of the
 *     committed record, under a real YAML parser, not as "space_key is present";
 *   - AC5 is asserted by ATTACKING the write path with credential-shaped values
 *     through all three channels a credential could plausibly arrive on — the
 *     answers the user types (VALUE channel: Story 31.2's own review landed a
 *     secret into a committed file exactly this way), stray properties on the
 *     in-memory record (OBJECT channel), and the environment (ENV channel) — and
 *     then asserting the planted sentinels appear in NO file the run wrote.
 *
 * ORACLE. js-yaml, a declared direct dependency, for everything that reaches the
 * authoritative file. Its absence is a HARD failure: this suite's central claim
 * is about the KEY SET of an emitted document, and the hand-rolled
 * `parseLayoutYaml` shares its assumptions with the writer, so it cannot see an
 * injected key that the writer's own escaping was supposed to prevent.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT TEST, because it is not this story's:
 *   - MCP detection and routing when a confluence store is READ or WRITTEN
 *     (Story 31.9, fail-loud, no fallback);
 *   - creating the root page against a live Confluence (Story 31.10);
 *   - any local mirror, cache, sync direction, sync trigger or conflict
 *     resolution — FR266 is RETIRED at P5-9.6 and no such code exists to test.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const dns = require('dns');
const tls = require('tls');
const http = require('http');
const https = require('https');

let passed = 0;
let failed = 0;
const errors = [];

// The process-level backstop, registered BEFORE the first test. The wizard's
// interactive branch calls `process.exit(0)` on a cancelled prompt, and this file
// drives that branch; without this, such an exit would end the run at 0 with no
// summary and the `&&`-chained runner would read it as a pass.
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
// an answer for, and never answers a DIFFERENT question than the queue expected:
// a `{mode:...}` handed to the `spaceKey` question reads back as `undefined`,
// which cli.js treats as a cancelled prompt and turns into `process.exit(0)` —
// a whole suite aborting having reported nothing. Both are turned into ordinary
// named failures instead.
const promptsModulePath = require.resolve('prompts');
require('prompts');
const promptLog = [];

function unexpectedPrompt(question) {
  throw new Error(
    `the wizard asked more questions than the test answered — unanswered prompt ` +
    `${JSON.stringify((question && question.name) || '(unnamed)')} ` +
    `(${JSON.stringify((question && question.message) || '')}). Add an answer to the queue ` +
    `rather than letting the stub default it.`
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

// Answering with EXACTLY what the prompt pre-selected or pre-filled — i.e.
// pressing Enter. Used wherever the claim is "accepting the defaults preserves
// what is committed": taking the answers from the wizard's own pre-population
// means a wizard that pre-populated the WRONG value preserves the wrong thing and
// the comparison fails, which a hardcoded answer could never show.
const ACCEPT_DEFAULT = Symbol('press Enter: answer with whatever the prompt pre-populated');

function answerByPressingEnter(q) {
  const name = (q && q.name) || '(unnamed)';
  if (q && q.type === 'select') {
    const idx = typeof q.initial === 'number' ? q.initial : 0;
    const choice = (q.choices || [])[idx];
    if (!choice) {
      throw new Error(
        `prompt ${JSON.stringify(name)} pre-selected index ${q.initial}, which is not one of its ` +
        `${(q.choices || []).length} choice(s) — pressing Enter would select nothing`);
    }
    return { [name]: choice.value };
  }
  return { [name]: (q && q.initial === undefined) ? '' : q.initial };
}

let promptAnswer = unexpectedPrompt;
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  promptLog.push(question);
  return promptAnswer(question);
};

// ─── Load module ─────────────────────────────────────────────────────────────
let collectRepoLayout, writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
  generateBmmConfig, handleConfigLayout, STORE_BACKENDS, offerableStoreBackends,
  backendChoicesForStore, STORE_BACKEND_WIZARD, STORE_MODES, REPO_LAYOUT_CONCERNS,
  collectConfluenceStoreLocation, generatedRootPageTitle, validateConfluenceIdentity;
try {
  ({
    collectRepoLayout, writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
    generateBmmConfig, handleConfigLayout, STORE_BACKENDS, offerableStoreBackends,
    backendChoicesForStore, STORE_BACKEND_WIZARD, STORE_MODES, REPO_LAYOUT_CONCERNS,
    collectConfluenceStoreLocation, generatedRootPageTitle, validateConfluenceIdentity,
  } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', (e && e.stack) || e);
  process.exit(1);
}

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('\n  FATAL: js-yaml is unavailable, and this suite\'s YAML oracle is not optional.');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTmpDir(name) {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name || 'ma-conf-')));
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
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try { await fn(); } finally { console.log = orig; }
  return lines.join('\n');
}

function parseLayout(tmpDir) {
  const content = readLayoutFile(tmpDir);
  let doc;
  try {
    doc = yaml.load(content);
  } catch (e) {
    throw new Error(`the emitted project-layout.yaml is NOT parseable by js-yaml: ${e.message.split('\n')[0]}`);
  }
  return { content, doc };
}

/**
 * Drives the interactive wizard with a prepared answer queue. Asserts the queue
 * was consumed EXACTLY: leftovers mean the wizard asked fewer questions than
 * expected, which is as much a change in behaviour as asking more.
 */
async function runWizard(answers, existingLayout = null) {
  promptLog.length = 0;
  const queue = [...answers];
  promptAnswer = (q) => {
    if (!queue.length) return unexpectedPrompt(q);
    const queued = queue.shift();
    return queued === ACCEPT_DEFAULT ? answerByPressingEnter(q) : requireMatchingAnswer(q, queued);
  };
  let layout;
  let log;
  try {
    log = await silenceAsync(async () => { layout = await collectRepoLayout({}, existingLayout); });
  } finally {
    promptAnswer = unexpectedPrompt;
  }
  assert.strictEqual(queue.length, 0,
    `${queue.length} prepared answer(s) went unused — the wizard asked fewer questions than expected`);
  return { layout, log, questions: promptLog.slice() };
}

// Answer builders. The confluence flow is THREE questions (backend, space, root
// page); the file-system flow is TWO (backend, mode) when the mode is `same`.
function confluenceAnswers(spaceKey, rootPageTitle) {
  return [{ backend: 'confluence' }, { spaceKey }, { rootPageTitle }];
}
const FILE_SYSTEM_SAME = [{ backend: 'file-system' }, { mode: 'same' }];
const SPRINT_SAME = [{ mode: 'same' }];

// ─── The credential model AC5 is asserted against ────────────────────────────
//
// Deliberately NOT the field-name allowlist the serializer already enumerates —
// that would be the tautology this epic keeps producing, expectation and code
// derived from the same list. This is an independent statement of what a secret
// looks like, applied to the KEYS of whatever was actually emitted.
//
// `user`/`user_name` is excluded on purpose: `_bmad/bmm/config.yaml` has carried
// a legitimate `user_name` (the developer's display name) since long before F26,
// and matching it would make this a test of BMAD's config format rather than of
// what Story 31.8 writes. AC5's "no username" is about a CONFLUENCE login, and
// that is covered exactly by the exhaustive key-set equality in the AC4 section
// (a Confluence username has nowhere to go in a three-key record) and by the
// sentinel scan below.
const CREDENTIAL_KEY_RE = /(pass(word|phrase)?|passwd|token|secret|credential|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|bearer|session|cookie|oauth|\bpat\b|signin|sign_in|login)/i;

// Every key appearing anywhere in a parsed YAML document, at any depth.
function allKeys(node, out = []) {
  if (Array.isArray(node)) { for (const v of node) allKeys(v, out); return out; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { out.push(k); allKeys(v, out); }
  }
  return out;
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// AC1 / FR259 and AC2 / FR260 — the two questions, in order, per store.
// ══════════════════════════════════════════════════════════════════════════

test('AC1/FR259 — choosing confluence asks which SPACE the store lives in, naming that store', async () => {
  const { cleanup } = withTmpDir();
  try {
    const { questions } = await runWizard([
      ...confluenceAnswers('ENG', 'Requirements'),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);
    const space = questions.find((q) => q.name === 'spaceKey');
    assert.ok(space, `no space question was asked; got ${questions.map((q) => q.name).join(', ')}`);
    assert.ok(/confluence space/i.test(space.message),
      `the question must ask about a Confluence SPACE, got: ${space.message}`);
    // It must name the store it configures. The system store is asked first, so
    // this is the system store's question.
    assert.ok(/system requirements store/.test(space.message),
      `the space question must name the store it configures, got: ${space.message}`);
    assert.strictEqual(space.type, 'text',
      'a space key is free text — a select would imply ma-agents had enumerated the spaces, ' +
      'which it cannot do offline');
  } finally { cleanup(); }
});

test('AC2/FR260 — and THEN which root page the artifacts are created under', async () => {
  const { cleanup } = withTmpDir();
  try {
    const { questions } = await runWizard([
      ...confluenceAnswers('ENG', 'Requirements'),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);
    // ORDER, on the interleaved log — AC2 is "the installer THEN asks", so a
    // flow that asked the page before the space would satisfy a presence check.
    assert.deepStrictEqual(
      questions.map((q) => q.name),
      ['backend', 'spaceKey', 'rootPageTitle', 'backend', 'mode', 'mode'],
      'backend, then space, then root page — and the second store keeps its own flow');
    const root = questions.find((q) => q.name === 'rootPageTitle');
    assert.ok(/page/i.test(root.message) && /created under/i.test(root.message),
      `the question must say the artifacts are created UNDER this page, got: ${root.message}`);
    assert.ok(/system requirements store/.test(root.message),
      `the root-page question must name the store it configures, got: ${root.message}`);
  } finally { cleanup(); }
});

test('a confluence store is asked NO mode question — it has no `mode` to answer', async () => {
  // A confluence store's identity is a space plus a root page. Offering
  // same/local/remote for it would be the file-system shape leaking into a
  // backend that has none — the same assumption that once rendered a confluence
  // store as `Mode: undefined / Path: undefined`.
  const { cleanup } = withTmpDir();
  try {
    const { questions, layout } = await runWizard([
      ...confluenceAnswers('SYS', 'A'),
      ...confluenceAnswers('SWE', 'B'),
      ...SPRINT_SAME,
    ]);
    const storeModeQuestions = questions.filter(
      (q) => q.name === 'mode' && /requirements store/.test(q.message));
    assert.deepStrictEqual(storeModeQuestions, [],
      `no confluence store may be asked for a mode; got: ${storeModeQuestions.map((q) => q.message).join(' | ')}`);
    for (const key of ['systemRequirementsStore', 'softwareRequirementsStore']) {
      assert.ok(!('mode' in layout[key]), `${key}: a confluence record must carry no mode`);
      assert.ok(!('path' in layout[key]), `${key}: a confluence record must carry no path`);
    }
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// AC3 — blank root page ⇒ generated, and the user is TOLD the name.
// ══════════════════════════════════════════════════════════════════════════

test('AC3 — a blank root page resolves to {project_name}, and the ANNOUNCED name is the RECORDED name', async () => {
  // The two halves must be the SAME string. Asserting only that something was
  // printed, or only that something was recorded, would let the announcement and
  // the committed file drift apart — and "the user is never left guessing where
  // the artifacts went" is precisely a claim about them agreeing.
  const { tmpDir, cleanup } = withTmpDir('ma-conf-blankroot-');
  try {
    const expected = generatedRootPageTitle(tmpDir);
    assert.ok(expected, 'the fixture project must have a derivable name');

    const { layout, log } = await runWizard([
      ...confluenceAnswers('ENG', ''),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);

    const recorded = layout.systemRequirementsStore.rootPage.title;
    assert.strictEqual(recorded, expected,
      `a blank answer must record the generated {project_name}; got ${JSON.stringify(recorded)}`);
    assert.strictEqual(recorded, path.basename(tmpDir),
      'and {project_name} for a project with no committed config.yaml is the project directory');
    assert.ok(log.includes(recorded),
      `the user must be TOLD the page name that will be used; the run printed:\n${log}`);
    // ...and told it as a NAME, not merely as a substring of some path. The
    // announcement must also identify the store and the space, or the user still
    // has to guess which of the two stores it referred to.
    assert.ok(/system requirements store/.test(log),
      `the announcement must name the store it is about:\n${log}`);
    assert.ok(/ENG/.test(log), `the announcement must name the space the page goes in:\n${log}`);
    // It must NOT claim the page already exists — creating it is Story 31.10's
    // MCP write, and this story runs offline.
    assert.ok(!/\bwas created\b/i.test(log) && !/\bhas been created\b/i.test(log),
      `nothing was created here — 31.8 is offline configuration, 31.10 does the write:\n${log}`);

    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);
    assert.strictEqual(doc.system_requirements_store.root_page.title, expected,
      'and the committed file carries the same name the user was told');
  } finally { cleanup(); }
});

test('AC3 — the generated name is offered IN the question, before the user answers', async () => {
  // "Leave it blank and something will be generated" is the shape that leaves a
  // user guessing. The name is stated at the point of asking as well as after.
  const { tmpDir, cleanup } = withTmpDir('ma-conf-hint-');
  try {
    const expected = generatedRootPageTitle(tmpDir);
    const { questions } = await runWizard([
      ...confluenceAnswers('ENG', ''),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);
    const root = questions.find((q) => q.name === 'rootPageTitle');
    assert.ok(/blank/i.test(root.message),
      `the question must say what a blank answer does, got: ${root.message}`);
    assert.ok(root.message.includes(expected),
      `...and must name the page it would use, got: ${root.message}`);
  } finally { cleanup(); }
});

test('AC3 — {project_name} is the committed BMAD value when the project has one', async () => {
  const { tmpDir, cleanup } = withTmpDir('ma-conf-named-');
  try {
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'),
      'project_name: Apollo Ground Segment\nuser_name: someone\n', 'utf-8');

    assert.strictEqual(generatedRootPageTitle(tmpDir), 'Apollo Ground Segment',
      'the committed project_name is what {project_name} means');
    assert.notStrictEqual(generatedRootPageTitle(tmpDir), path.basename(tmpDir),
      'and it must WIN over the directory name, or the two sources are not ordered at all');

    const { layout, log } = await runWizard([
      ...confluenceAnswers('ENG', ''),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);
    assert.strictEqual(layout.systemRequirementsStore.rootPage.title, 'Apollo Ground Segment');
    assert.ok(log.includes('Apollo Ground Segment'), `and the user is told that name:\n${log}`);
  } finally { cleanup(); }
});

test('AC3 — with no config.yaml, {project_name} is the directory name — the rule BMAD itself uses', async () => {
  // NOT an arbitrary fallback. The wizard runs at install Step 3.3, ABOVE the
  // BMAD install at Step 3.5, so on a fresh project `project_name` does not exist
  // yet. bmad-method seeds it with `path.basename(directory)`
  // (node_modules/bmad-method/tools/installer/ui.js), so the two sources agree by
  // construction — asserted against the VENDORED source, not against a copy of
  // the rule, so that an upstream change to it shows up here rather than as a
  // silently different page name.
  const { tmpDir, cleanup } = withTmpDir('ma-conf-basename-');
  try {
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml')),
      'the fixture must have no committed project_name');
    assert.strictEqual(generatedRootPageTitle(tmpDir), path.basename(tmpDir));

    const uiPath = path.join(__dirname, '..', 'node_modules', 'bmad-method',
      'tools', 'installer', 'ui.js');
    if (fs.existsSync(uiPath)) {
      const ui = fs.readFileSync(uiPath, 'utf-8');
      assert.ok(/project_name:\s*path\.basename\(/.test(ui),
        'bmad-method no longer seeds project_name from the directory basename — the fallback ' +
        'in generatedRootPageTitle is no longer the same rule and must be revisited');
    }
  } finally { cleanup(); }
});

test('AC3 — a project with no derivable name REQUIRES an explicit page rather than generating a nameless one', async () => {
  // The fail-loud edge. `path.basename` of a filesystem root is '', and a page
  // named '' is exactly the "user is left guessing where the artifacts went"
  // outcome AC3 forbids. Two halves: the derivation returns null (never '' and
  // never a fabricated placeholder), and the prompt then makes the answer
  // REQUIRED instead of quietly generating from nothing.
  const fsRoot = path.parse(process.cwd()).root;
  assert.strictEqual(generatedRootPageTitle(fsRoot), null,
    `a project root with no basename must yield null, not a placeholder; got ` +
    `${JSON.stringify(generatedRootPageTitle(fsRoot))}`);

  const required = validateConfluenceIdentity('', 'root_page.title', { required: true });
  assert.strictEqual(typeof required, 'string',
    'with no name to generate from, a blank root page must be refused');
  assert.ok(/required/i.test(required), `and the refusal must say so, got: ${required}`);
  assert.strictEqual(validateConfluenceIdentity('', 'root_page.title', { required: false }), true,
    'while a project that CAN generate a name still accepts blank — that is AC3');
});

// ══════════════════════════════════════════════════════════════════════════
// AC4 / NFR79 — the space key and root-page identity persist, AND NOTHING ELSE.
// ══════════════════════════════════════════════════════════════════════════

// The whole of what a confluence store may commit. Written out LITERALLY here,
// not imported from the serializer, so that widening the serializer moves the
// code away from this expectation instead of moving both together.
const CONFLUENCE_RECORD_KEYS = ['backend', 'space_key', 'root_page'];
const ROOT_PAGE_KEYS = ['title', 'id'];

test('AC4/NFR79 — a committed confluence record\'s keys are EXACTLY {backend, space_key, root_page{title,id}}', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard([
      ...confluenceAnswers('SYS', 'System Requirements'),
      ...confluenceAnswers('SWE', 'Architecture'),
      ...SPRINT_SAME,
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);

    for (const key of ['system_requirements_store', 'software_requirements_store']) {
      const record = doc[key];
      assert.deepStrictEqual(Object.keys(record).sort(), [...CONFLUENCE_RECORD_KEYS].sort(),
        `${key}: a confluence store may commit these keys and no others`);
      assert.deepStrictEqual(Object.keys(record.root_page).sort(), [...ROOT_PAGE_KEYS].sort(),
        `${key}.root_page: the reserved 31.2 object is {title, id} and nothing else`);
      assert.strictEqual(record.backend, 'confluence');
    }
    assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
    assert.strictEqual(doc.software_requirements_store.space_key, 'SWE');
  } finally { cleanup(); }
});

test('AC4 — no credential-shaped KEY appears anywhere in the committed document', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard([
      ...confluenceAnswers('SYS', 'System Requirements'),
      ...confluenceAnswers('SWE', 'Architecture'),
      ...SPRINT_SAME,
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);
    const offenders = allKeys(doc).filter((k) => CREDENTIAL_KEY_RE.test(k));
    assert.deepStrictEqual(offenders, [],
      `project-layout.yaml must carry no credential-shaped key; found ${offenders.join(', ')}`);
  } finally { cleanup(); }
});

test('AC4 — VALUE-CHANNEL attack: an answer engineered to inject a key cannot introduce one', async () => {
  // Story 31.2's own review landed a credential into a committed file through the
  // VALUE channel of a free-text identity field, and `space_key` and
  // `root_page.title` are exactly those fields. The payloads below are chosen to
  // break OUT of the value and become syntax: a closing quote plus a new mapping
  // entry, a comment introducer, an anchor, a tag, a flow mapping, and a merge
  // key. None contains a line break, so none is caught by the line-break policy —
  // they must be defeated by ESCAPING, and the proof is the parsed key set.
  const payloads = [
    'ENG" api_token: "sk-INJECTED',
    'ENG # password: hunter2',
    '&anchor password',
    '!!str token',
    '{token: sk-INJECTED}',
    '<<: *creds',
    'ENG\\" api_token: sk-INJECTED',
    '- token: sk-INJECTED',
    '? token',
    "ENG' token: sk-INJECTED",
    'ENG\ttoken: sk-INJECTED',
    '"] , "token": "sk-INJECTED',
  ];
  for (const payload of payloads) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const { layout } = await runWizard([
        ...confluenceAnswers(payload, payload),
        ...FILE_SYSTEM_SAME,
        ...SPRINT_SAME,
      ]);
      silence(() => writeProjectLayoutYaml(layout));
      const { doc } = parseLayout(tmpDir);

      const record = doc.system_requirements_store;
      assert.deepStrictEqual(Object.keys(record).sort(), [...CONFLUENCE_RECORD_KEYS].sort(),
        `payload ${JSON.stringify(payload)} introduced a key into the record`);
      assert.deepStrictEqual(Object.keys(record.root_page).sort(), [...ROOT_PAGE_KEYS].sort(),
        `payload ${JSON.stringify(payload)} introduced a key into root_page`);
      assert.deepStrictEqual(allKeys(doc).filter((k) => CREDENTIAL_KEY_RE.test(k)), [],
        `payload ${JSON.stringify(payload)} introduced a credential-shaped key`);
      // ...and the value survived as a VALUE, byte for byte. An escaper that
      // "defeated" the payload by mangling it would corrupt legitimate identity.
      assert.strictEqual(record.space_key, payload,
        `payload ${JSON.stringify(payload)} did not round-trip as a scalar value`);
      assert.strictEqual(record.root_page.title, payload,
        `payload ${JSON.stringify(payload)} did not round-trip as a root-page title`);
    } finally { cleanup(); }
  }
});

test('AC4 — OBJECT-CHANNEL attack: credential properties on the record are never read', async () => {
  // The other half of "nothing else". `serializeConfluenceStore` enumerates the
  // three fields and reads nothing else off the input object; replacing it with a
  // spread, or adding a "pass through anything the caller set" line, would leak
  // whatever an upstream layer happened to attach. The payload values are
  // distinctive so their absence is checkable in the raw bytes, not just in the
  // parsed key set.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence',
        spaceKey: 'ENG',
        rootPage: { title: 'Requirements', id: '77' },
        // None of these is part of the schema. All are plausible things an
        // upstream layer could attach to a store object.
        token: 'sk-OBJECT-CHANNEL-1',
        password: 'sk-OBJECT-CHANNEL-2',
        apiToken: 'sk-OBJECT-CHANNEL-3',
        sessionCookie: 'sk-OBJECT-CHANNEL-4',
        username: 'sk-OBJECT-CHANNEL-5',
        baseUrl: 'https://admin:sk-OBJECT-CHANNEL-6@confluence.invalid/wiki',
        auth: { bearer: 'sk-OBJECT-CHANNEL-7' },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const { content, doc } = parseLayout(tmpDir);

    assert.deepStrictEqual(Object.keys(doc.system_requirements_store).sort(),
      [...CONFLUENCE_RECORD_KEYS].sort(),
      'the serializer must read exactly the three identity fields off the record');
    for (let i = 1; i <= 7; i++) {
      assert.ok(!content.includes(`sk-OBJECT-CHANNEL-${i}`),
        `payload ${i} reached the committed file:\n${content}`);
    }
    assert.ok(!/confluence\.invalid/.test(content),
      'a base URL is not identity, and a URL is how a credential travels');
  } finally { cleanup(); }
});

test('AC4 — what was answered is what the binding resolver returns: the record round-trips', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard([
      ...confluenceAnswers('SYS', 'System Requirements'),
      ...confluenceAnswers('SWE', 'Architecture'),
      ...SPRINT_SAME,
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    const binding = resolveProjectTopology(tmpDir);
    assert.strictEqual(binding.ok, true,
      `the committed confluence pair must resolve: ${binding.reason} ${binding.message || ''}`);
    assert.deepStrictEqual(binding.topology.systemRequirementsStore, {
      backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: null },
    });
    assert.deepStrictEqual(binding.topology.softwareRequirementsStore, {
      backend: 'confluence', spaceKey: 'SWE', rootPage: { title: 'Architecture', id: null },
    });
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// AC5 — ma-agents stores NO Confluence credentials anywhere on disk.
// Authentication is entirely the MCP server's responsibility (NFR79, P5-9.6).
// ══════════════════════════════════════════════════════════════════════════

test('AC5 — configuring a confluence store asks NO credential question, of any kind', async () => {
  // Asserted over EVERY question the run asked — name, message, prompt type and
  // every offered choice — rather than over the two questions this story added.
  // A credential question introduced anywhere in the layout wizard would be just
  // as much a violation, and a check scoped to the confluence flow would not see
  // it.
  const { cleanup } = withTmpDir();
  try {
    const { questions } = await runWizard([
      ...confluenceAnswers('SYS', 'System Requirements'),
      ...confluenceAnswers('SWE', 'Architecture'),
      ...SPRINT_SAME,
    ]);
    assert.ok(questions.length >= 7, 'the confluence flows must actually have run');
    for (const q of questions) {
      const surface = [q.name, q.message, ...(q.choices || []).map((c) => `${c.title} ${c.value}`)]
        .map(String).join(' ');
      assert.ok(!CREDENTIAL_KEY_RE.test(surface),
        `a credential-shaped question was asked: ${JSON.stringify(q.message)}`);
      assert.ok(q.type !== 'password' && q.type !== 'invisible',
        `prompt ${JSON.stringify(q.name)} hides its input, which only a secret needs`);
    }
    // ...and the count is pinned, so a credential question cannot be added under
    // an innocuous name and slip past the regex.
    assert.deepStrictEqual(questions.map((q) => q.name),
      ['backend', 'spaceKey', 'rootPageTitle', 'backend', 'spaceKey', 'rootPageTitle', 'mode'],
      'two confluence stores plus sprint management is SEVEN questions and no others');
  } finally { cleanup(); }
});

test('AC5 — no credential-shaped sentinel reaches ANY file the run writes, from any channel', async () => {
  // THE PURE NEGATIVE. Credentials are planted on all three channels a secret
  // could plausibly arrive on, a full configure-and-write is run, and then EVERY
  // file under the project root is read and searched. Not a field list: a search
  // for values that must not exist, over files that were not enumerated in
  // advance.
  const { tmpDir, cleanup } = withTmpDir();
  const ENV_KEYS = ['CONFLUENCE_API_TOKEN', 'CONFLUENCE_PASSWORD', 'CONFLUENCE_USERNAME',
    'ATLASSIAN_API_TOKEN', 'MA_CONFLUENCE_TOKEN'];
  const savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  try {
    // ENV channel.
    process.env.CONFLUENCE_API_TOKEN = 'sk-ENV-CHANNEL-1';
    process.env.CONFLUENCE_PASSWORD = 'sk-ENV-CHANNEL-2';
    process.env.CONFLUENCE_USERNAME = 'sk-ENV-CHANNEL-3';
    process.env.ATLASSIAN_API_TOKEN = 'sk-ENV-CHANNEL-4';
    process.env.MA_CONFLUENCE_TOKEN = 'sk-ENV-CHANNEL-5';

    // OBJECT channel — an existing layout carrying credential properties, as a
    // sloppier upstream (or a hand-edited file read by a future reader) might.
    const poisoned = {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
      topology: {
        systemRequirementsStore: {
          backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '9' },
          token: 'sk-OBJ-CHANNEL-1', password: 'sk-OBJ-CHANNEL-2',
        },
        softwareRequirementsStore: {
          backend: 'confluence', spaceKey: 'SWE', rootPage: { title: 'Architecture', id: '10' },
          apiToken: 'sk-OBJ-CHANNEL-3',
        },
        sprintManagement: { mode: 'same', path: '.' },
      },
    };

    // The user accepts every pre-population — the path most likely to carry a
    // stray property forward, because nothing is retyped.
    const { layout } = await runWizard(
      [ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT,
        ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT,
        ACCEPT_DEFAULT], poisoned);

    silence(() => writeProjectLayoutYaml(layout));
    silence(() => generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: layout }));

    const files = walkFiles(tmpDir);
    assert.ok(files.length >= 2,
      `the run must have written something to search; found ${files.length} file(s)`);
    const sentinels = [
      ...Array.from({ length: 5 }, (_, i) => `sk-ENV-CHANNEL-${i + 1}`),
      ...Array.from({ length: 3 }, (_, i) => `sk-OBJ-CHANNEL-${i + 1}`),
    ];
    for (const file of files) {
      const body = fs.readFileSync(file, 'utf-8');
      for (const sentinel of sentinels) {
        assert.ok(!body.includes(sentinel),
          `${path.relative(tmpDir, file)} contains ${sentinel} — a credential reached disk`);
      }
      const rel = path.relative(tmpDir, file);
      if (/\.ya?ml$/.test(rel)) {
        let doc = null;
        try { doc = yaml.load(body); } catch (e) { doc = null; }
        const offenders = allKeys(doc).filter((k) => CREDENTIAL_KEY_RE.test(k));
        assert.deepStrictEqual(offenders, [],
          `${rel} carries credential-shaped key(s): ${offenders.join(', ')}`);
      }
    }
    // And the identity that WAS answered is still there — a test that passed by
    // writing nothing at all would prove nothing.
    const { doc } = parseLayout(tmpDir);
    assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
    assert.strictEqual(doc.software_requirements_store.space_key, 'SWE');
  } finally {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
    cleanup();
  }
});

test('AC5 — ma-agents writes no credential FILE: the run creates only the artifacts it declares', async () => {
  // "No credential file" is checkable directly: enumerate what the run created
  // and assert the set. A dotfile cache or a `.confluence-auth` dropped beside the
  // binding would show up as an unexpected member.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard([
      ...confluenceAnswers('SYS', 'System Requirements'),
      ...confluenceAnswers('SWE', 'Architecture'),
      ...SPRINT_SAME,
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    silence(() => generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: layout }));

    const created = walkFiles(tmpDir)
      .map((f) => path.relative(tmpDir, f).split(path.sep).join('/'))
      .sort();
    assert.deepStrictEqual(created,
      ['_bmad-output/project-layout.yaml', '_bmad/bmm/config.yaml'].sort(),
      'configuring two confluence stores writes the binding and the derived config — nothing else');
  } finally { cleanup(); }
});

test('AC5 — the prompt refuses a multi-line identity using the SERIALIZER\'S OWN message', async () => {
  // One policy, not two. If the prompt carried its own idea of a legal identity,
  // the two could drift and a value the user was allowed to type would crash the
  // write — or worse, a value the prompt rejected would be writable by another
  // path. The proof that they are the same rule is that the prompt's refusal IS
  // the writer's message.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    for (const [label, ch] of [
      ["LF", String.fromCharCode(10)], ["CR", String.fromCharCode(13)],
      ['U+0085', String.fromCharCode(0x85)],
      ['U+2028', String.fromCharCode(0x2028)],
      ['U+2029', String.fromCharCode(0x2029)],
    ]) {
      const payload = `ENG${ch}  api_token: sk-LINEBREAK`;
      const refusal = validateConfluenceIdentity(payload, 'space_key', { required: true });
      assert.strictEqual(typeof refusal, 'string', `${label}: must be refused at the prompt`);
      assert.ok(/project-layout\.yaml/.test(refusal),
        `${label}: the refusal must name the file, got: ${refusal}`);
      assert.ok(/space_key/.test(refusal),
        `${label}: the refusal must name the field, got: ${refusal}`);

      // ...and the writer refuses the same value, with the same message.
      let writeErr = null;
      try {
        silence(() => writeProjectLayoutYaml({
          systemRequirementsStore: {
            backend: 'confluence', spaceKey: payload, rootPage: { title: 'T', id: null },
          },
          softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
          sprintManagement: { mode: 'same', path: '.' },
        }));
      } catch (e) { writeErr = e; }
      assert.ok(writeErr, `${label}: the writer must refuse it too`);
      assert.strictEqual(writeErr.message, refusal,
        `${label}: prompt and writer must give the SAME message, or they are two policies`);
      const f = layoutPathOf(tmpDir);
      const body = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '';
      assert.ok(!/api_token/.test(body) && !/sk-LINEBREAK/.test(body),
        `${label}: nothing from the payload may reach the file`);
    }
    // The prompt-level guard is actually WIRED to the questions, not merely
    // exported: both identity questions must carry it.
    const { questions } = await runWizard([
      ...confluenceAnswers('ENG', 'Requirements'), ...FILE_SYSTEM_SAME, ...SPRINT_SAME]);
    for (const name of ['spaceKey', 'rootPageTitle']) {
      const q = questions.find((x) => x.name === name);
      assert.strictEqual(typeof q.validate, 'function',
        `the ${name} question must validate what the user types`);
      assert.strictEqual(typeof q.validate('a\nb'), 'string',
        `the ${name} question's validator must refuse a line break`);
    }

    // ...and each is wired with the REQUIREDNESS its own AC calls for, asserted
    // on the live question rather than on a direct call to the validator. The
    // two differ, and the difference is the whole of AC3: a blank space key is
    // a store that resolves nowhere, while a blank root page is the documented
    // way to ask for a generated one. Testing the exported validator alone
    // leaves the `required:` argument at each call site unpinned in both
    // directions — either could be flipped with no test noticing.
    const spaceQ = questions.find((x) => x.name === 'spaceKey');
    assert.strictEqual(typeof spaceQ.validate(''), 'string',
      'the space question must REFUSE a blank answer — there is no default space');
    assert.strictEqual(typeof spaceQ.validate('   '), 'string',
      '...whitespace included');
    const rootQ = questions.find((x) => x.name === 'rootPageTitle');
    assert.strictEqual(rootQ.validate(''), true,
      'the root-page question must ACCEPT a blank answer when a name can be generated (AC3)');
    assert.strictEqual(rootQ.validate('   '), true,
      '...and whitespace is blank, which is still an acceptable "generate one" answer');
  } finally { cleanup(); }
});

test('AC5 — an EMPTY space key is refused rather than recorded as a store that resolves nowhere', async () => {
  const blank = validateConfluenceIdentity('', 'space_key', { required: true });
  assert.strictEqual(typeof blank, 'string', 'a blank space key must be refused');
  assert.ok(/required/i.test(blank), `and told why, got: ${blank}`);
  assert.strictEqual(typeof validateConfluenceIdentity('   ', 'space_key', { required: true }), 'string',
    'whitespace is blank — trimming must happen before the emptiness test, not after');

  // The flow ALSO refuses it, so no caller path can record one. Fail loud rather
  // than "record it anyway, empty", which is the permissive degradation this epic
  // keeps producing.
  await assert.rejects(
    () => collectConfluenceStoreLocationWithAnswers(
      { key: 'systemRequirementsStore', label: 'system requirements store' },
      null, 'confluence', [{ spaceKey: '   ' }]),
    /No Confluence space was given/,
    'the flow must refuse to build a record with no space key');
});

// Drives `collectConfluenceStoreLocation` directly with a fixed answer queue, so
// the flow's own guards can be reached without going through the whole wizard.
async function collectConfluenceStoreLocationWithAnswers(concern, existingRecord, backend, answers) {
  const queue = [...answers];
  promptLog.length = 0;
  promptAnswer = (q) => {
    if (!queue.length) return unexpectedPrompt(q);
    const queued = queue.shift();
    return queued === ACCEPT_DEFAULT ? answerByPressingEnter(q) : requireMatchingAnswer(q, queued);
  };
  let record;
  try {
    await silenceAsync(async () => {
      record = await collectConfluenceStoreLocation(concern, existingRecord, backend);
    });
  } finally {
    promptAnswer = unexpectedPrompt;
  }
  return record;
}

// ══════════════════════════════════════════════════════════════════════════
// AC6 / FR257 — the two stores configure INDEPENDENTLY. This is Story 31.5's
// deferred AC2: all FOUR backend combinations reachable through the wizard.
// ══════════════════════════════════════════════════════════════════════════

test('AC6/FR257 — all FOUR backend combinations are reachable through the wizard', async () => {
  // Story 31.5 could not meet this: `confluence` had no flow, so two of the four
  // could not be REACHED. It can now, so the matrix is driven for real and each
  // cell is checked in BOTH directions — the right record landed here, and the
  // other store's answer did not.
  const combos = [
    ['file-system', 'file-system'],
    ['file-system', 'confluence'],
    ['confluence', 'file-system'],
    ['confluence', 'confluence'],
  ];
  assert.strictEqual(combos.length, [...STORE_BACKENDS].length ** 2,
    'the matrix must cover the whole of STORE_BACKENDS squared; a new backend needs new cells');

  for (const [systemBackend, softwareBackend] of combos) {
    const label = `${systemBackend}/${softwareBackend}`;
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const answersFor = (backend, which) => (backend === 'confluence'
        ? confluenceAnswers(which === 'system' ? 'SYS' : 'SWE',
          which === 'system' ? 'System Requirements' : 'Architecture')
        : [{ backend: 'file-system' }, { mode: 'local' },
          { localPath: mkdir(tmpDir, which === 'system' ? 'sys-store' : 'swe-store') }]);

      const { layout } = await runWizard([
        ...answersFor(systemBackend, 'system'),
        ...answersFor(softwareBackend, 'software'),
        ...SPRINT_SAME,
      ]);
      silence(() => writeProjectLayoutYaml(layout));
      const { doc } = parseLayout(tmpDir);

      assert.strictEqual(doc.system_requirements_store.backend, systemBackend,
        `${label}: the system store's committed backend`);
      assert.strictEqual(doc.software_requirements_store.backend, softwareBackend,
        `${label}: the software store's committed backend`);

      // Each store's IDENTITY is its own — the check that catches a loop that
      // asks twice and writes one answer into both records.
      for (const [key, backend, space, title, dir] of [
        ['system_requirements_store', systemBackend, 'SYS', 'System Requirements', 'sys-store'],
        ['software_requirements_store', softwareBackend, 'SWE', 'Architecture', 'swe-store'],
      ]) {
        const record = doc[key];
        if (backend === 'confluence') {
          assert.strictEqual(record.space_key, space, `${label}: ${key} space`);
          assert.strictEqual(record.root_page.title, title, `${label}: ${key} root page`);
          assert.ok(!('path' in record), `${label}: ${key} must carry no path`);
        } else {
          assert.strictEqual(record.mode, 'local', `${label}: ${key} mode`);
          assert.ok(record.path.endsWith(dir),
            `${label}: ${key} must carry its OWN path, got ${record.path}`);
          assert.ok(!('space_key' in record), `${label}: ${key} must carry no space key`);
        }
      }
      // And the binding resolves — a combination that writes but cannot be read
      // back is not reachable in any useful sense.
      const binding = resolveProjectTopology(tmpDir);
      assert.strictEqual(binding.ok, true,
        `${label}: the committed pair must resolve, got ${binding.reason} ${binding.message || ''}`);
    } finally { cleanup(); }
  }
});

function mkdir(root, name) {
  const p = path.join(root, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

test('AC6/FR257 — both stores confluence in DIFFERENT spaces, and neither space reaches the other', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout, questions } = await runWizard([
      ...confluenceAnswers('SYSTEMS', 'Requirements Home'),
      ...confluenceAnswers('PLATFORM', 'Architecture Home'),
      ...SPRINT_SAME,
    ]);
    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);
    const sys = doc.system_requirements_store;
    const swe = doc.software_requirements_store;

    assert.strictEqual(sys.space_key, 'SYSTEMS');
    assert.strictEqual(swe.space_key, 'PLATFORM');
    assert.notStrictEqual(sys.space_key, swe.space_key,
      'two confluence stores must be able to live in different spaces (FR257)');
    assert.strictEqual(sys.root_page.title, 'Requirements Home');
    assert.strictEqual(swe.root_page.title, 'Architecture Home');

    // And each store's FOUR questions named THAT store. A flow handed a constant
    // concern would ask the right questions the right number of times, in the
    // right order, and land the right answers in the right records — while
    // telling the user it was configuring the system store twice. Only the
    // wording catches it, so the wording is asserted per store.
    const storeConcerns = REPO_LAYOUT_CONCERNS.filter((c) => c.kind === 'store');
    const identityQuestions = questions.filter(
      (q) => q.name === 'spaceKey' || q.name === 'rootPageTitle');
    assert.strictEqual(identityQuestions.length, 4, 'two stores, two identity questions each');
    for (let i = 0; i < 4; i++) {
      const own = storeConcerns[Math.floor(i / 2)];
      const other = storeConcerns[1 - Math.floor(i / 2)];
      assert.ok(identityQuestions[i].message.includes(own.label),
        `question ${i} must name ${own.label}, got: ${identityQuestions[i].message}`);
      assert.ok(!identityQuestions[i].message.includes(other.label),
        `question ${i} must NOT name ${other.label}, got: ${identityQuestions[i].message}`);
    }
    // The collapse check, stated as an absence: neither store's answer may appear
    // anywhere in the other's record.
    assert.ok(!JSON.stringify(sys).includes('PLATFORM') && !JSON.stringify(sys).includes('Architecture'),
      `the system record absorbed the software answer: ${JSON.stringify(sys)}`);
    assert.ok(!JSON.stringify(swe).includes('SYSTEMS') && !JSON.stringify(swe).includes('Requirements Home'),
      `the software record absorbed the system answer: ${JSON.stringify(swe)}`);
  } finally { cleanup(); }
});

test('AC6 — the backend question offers the SAME set whatever the other store answered', async () => {
  // Independence of the OFFER, not only of the answer. If the software store's
  // choices narrowed after the system store picked confluence, "both confluence"
  // would be reachable only in one order.
  const offered = {};
  for (const systemBackend of [...STORE_BACKENDS]) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const first = systemBackend === 'confluence'
        ? confluenceAnswers('SYS', 'A')
        : [{ backend: 'file-system' }, { mode: 'same' }];
      const { questions } = await runWizard([...first, ...FILE_SYSTEM_SAME, ...SPRINT_SAME]);
      const backends = questions.filter((q) => q.name === 'backend');
      assert.strictEqual(backends.length, 2, 'both stores are asked for a backend');
      offered[systemBackend] = backends[1].choices.map((c) => c.value);
      void tmpDir;
    } finally { cleanup(); }
  }
  const reference = offered['file-system'];
  assert.deepStrictEqual(reference, offerableStoreBackends(),
    'the software store must be offered exactly the offerable set');
  for (const systemBackend of [...STORE_BACKENDS]) {
    assert.deepStrictEqual(offered[systemBackend], reference,
      `answering the system store with ${systemBackend} changed what the software store was offered`);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// AC7 / NFR80 — configuration succeeds WITHOUT contacting Confluence.
// ══════════════════════════════════════════════════════════════════════════

/**
 * Runs `fn` with every outbound-network primitive in the process poisoned, so a
 * reachability check anywhere in the flow fails loudly instead of quietly
 * succeeding on a machine that happens to be online.
 *
 * `net.Socket.prototype.connect` is the choke point: http, https and tls all
 * build their transport on it, so poisoning it covers them whatever library they
 * are reached through. `dns` is poisoned as well, because a name lookup is itself
 * network access and happens BEFORE the connect. The higher-level entry points
 * are poisoned too so that a failure names the API that was actually used.
 */
async function withNetworkPoisoned(fn) {
  const calls = [];
  const poison = (label) => (...args) => {
    calls.push(label);
    throw new Error(`NETWORK ACCESS during offline configuration: ${label}(${args.length} args)`);
  };
  const saved = {
    connect: net.Socket.prototype.connect,
    netConnect: net.connect,
    netCreate: net.createConnection,
    lookup: dns.lookup,
    resolve: dns.resolve,
    promisesLookup: dns.promises && dns.promises.lookup,
    tlsConnect: tls.connect,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
    fetch: globalThis.fetch,
  };
  net.Socket.prototype.connect = poison('net.Socket#connect');
  net.connect = poison('net.connect');
  net.createConnection = poison('net.createConnection');
  dns.lookup = poison('dns.lookup');
  dns.resolve = poison('dns.resolve');
  if (dns.promises) dns.promises.lookup = poison('dns.promises.lookup');
  tls.connect = poison('tls.connect');
  http.request = poison('http.request');
  http.get = poison('http.get');
  https.request = poison('https.request');
  https.get = poison('https.get');
  globalThis.fetch = poison('fetch');
  try {
    return { result: await fn(), calls };
  } finally {
    net.Socket.prototype.connect = saved.connect;
    net.connect = saved.netConnect;
    net.createConnection = saved.netCreate;
    dns.lookup = saved.lookup;
    dns.resolve = saved.resolve;
    if (dns.promises && saved.promisesLookup) dns.promises.lookup = saved.promisesLookup;
    tls.connect = saved.tlsConnect;
    http.request = saved.httpRequest;
    http.get = saved.httpGet;
    https.request = saved.httpsRequest;
    https.get = saved.httpsGet;
    if (saved.fetch === undefined) delete globalThis.fetch; else globalThis.fetch = saved.fetch;
  }
}

test('AC7/NFR80 — the poison harness really would catch a connection (the harness is tested first)', async () => {
  // Without this, "the run made no network call" could equally mean "the harness
  // does not intercept anything" — the shape where a green test proves nothing.
  let caught = null;
  const { calls } = await withNetworkPoisoned(async () => {
    try { net.connect(80, 'confluence.invalid'); } catch (e) { caught = e; }
    try { await dns.promises.lookup('confluence.invalid'); } catch (e) { caught = caught || e; }
  });
  assert.ok(caught, 'the poisoned primitives must throw');
  assert.ok(/NETWORK ACCESS/.test(caught.message), `got: ${caught.message}`);
  assert.ok(calls.length >= 1, 'and the harness must record what was reached');
});

test('AC7/NFR80 — configuring BOTH stores for confluence and committing them touches no network', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { result, calls } = await withNetworkPoisoned(async () => {
      const { layout } = await runWizard([
        ...confluenceAnswers('SYS', 'System Requirements'),
        ...confluenceAnswers('SWE', 'Architecture'),
        ...SPRINT_SAME,
      ]);
      silence(() => writeProjectLayoutYaml(layout));
      silence(() => generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: layout }));
      return resolveProjectTopology(tmpDir);
    });
    assert.deepStrictEqual(calls, [],
      `offline configuration reached the network via: ${calls.join(', ')}`);
    assert.strictEqual(result.ok, true, 'and it must have SUCCEEDED, not merely not connected');
    const { doc } = parseLayout(tmpDir);
    assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
    assert.strictEqual(doc.software_requirements_store.space_key, 'SWE');
  } finally { cleanup(); }
});

test('AC7 — a space or page answered as a URL is still not fetched, and is not treated as one', async () => {
  // The most tempting place to sneak in a reachability check: the answer looks
  // like a host, so "let us just verify it". It is recorded as the opaque
  // identity it is. Whether it resolves to anything is Story 31.9's runtime
  // question, and Story 31.10's for the page.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { calls } = await withNetworkPoisoned(async () => {
      const { layout } = await runWizard([
        ...confluenceAnswers('https://confluence.invalid/wiki/spaces/ENG',
          'https://confluence.invalid/wiki/spaces/ENG/pages/12345/Home'),
        ...FILE_SYSTEM_SAME,
        ...SPRINT_SAME,
      ]);
      silence(() => writeProjectLayoutYaml(layout));
    });
    assert.deepStrictEqual(calls, [], `a URL-shaped answer was fetched: ${calls.join(', ')}`);
    const { doc } = parseLayout(tmpDir);
    assert.strictEqual(doc.system_requirements_store.space_key,
      'https://confluence.invalid/wiki/spaces/ENG',
      'the answer is recorded verbatim — it is identity, not a request');
    assert.strictEqual(doc.system_requirements_store.root_page.id, null,
      'and no page id is scraped out of it: resolving identity is Story 31.10\'s, over MCP');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// AC8 — under `--yes`, confluence is NEVER selected implicitly.
// ══════════════════════════════════════════════════════════════════════════

test('AC8 — `--yes` on a fresh project asks nothing and defaults BOTH stores to file-system', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    promptLog.length = 0;
    promptAnswer = unexpectedPrompt;
    const layout = await collectRepoLayout({ yes: true }, null);
    assert.deepStrictEqual(promptLog, [], 'a non-interactive install asks nothing');
    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);
    for (const key of ['system_requirements_store', 'software_requirements_store']) {
      assert.strictEqual(doc[key].backend, 'file-system',
        `${key}: --yes must never land on confluence`);
      assert.ok(!('space_key' in doc[key]), `${key}: and must carry no confluence identity`);
    }
  } finally { cleanup(); }
});

test('AC8 — no environment variable can make `--yes` select confluence', async () => {
  // The non-interactive branch reads env vars, so "confluence is never selected
  // implicitly" is a claim about what those can produce. Confluence-shaped names
  // are tried alongside the real ones; none may change the backend.
  const { tmpDir, cleanup } = withTmpDir();
  const ENV = {
    MA_KNOWLEDGEBASE_BACKEND: 'confluence',
    MA_STORE_BACKEND: 'confluence',
    MA_CONFLUENCE_SPACE: 'ENG',
    MA_CONFLUENCE_ROOT_PAGE: 'Home',
    CONFLUENCE_SPACE_KEY: 'ENG',
  };
  const saved = {};
  for (const k of Object.keys(ENV)) { saved[k] = process.env[k]; process.env[k] = ENV[k]; }
  try {
    promptLog.length = 0;
    promptAnswer = unexpectedPrompt;
    const layout = await collectRepoLayout({ yes: true }, null);
    assert.deepStrictEqual(promptLog, [], 'still no questions');
    silence(() => writeProjectLayoutYaml(layout));
    const { content, doc } = parseLayout(tmpDir);
    for (const key of ['system_requirements_store', 'software_requirements_store']) {
      assert.strictEqual(doc[key].backend, 'file-system',
        `${key}: a confluence-shaped env var must not select confluence`);
    }
    assert.ok(!/confluence/.test(content),
      `no confluence identity may appear in the committed file:\n${content}`);
  } finally {
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
    cleanup();
  }
});

test('AC8 — `--yes` over a COMMITTED confluence pair preserves it: preservation is not implicit selection', async () => {
  // The distinction the AC turns on. `--yes` may never CHOOSE confluence, but it
  // must not destroy a store the user already chose — that was B-1. Both halves
  // are asserted in one run so neither can be satisfied by breaking the other.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '5' },
      },
      softwareRequirementsStore: {
        backend: 'confluence', spaceKey: 'SWE', rootPage: { title: 'Architecture', id: '6' },
      },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const before = readLayoutFile(tmpDir);
    const existing = silence(() => readExistingLayout());

    promptLog.length = 0;
    promptAnswer = unexpectedPrompt;
    const layout = await collectRepoLayout({ yes: true }, existing);
    assert.deepStrictEqual(promptLog, [], '`--yes` still asks nothing');
    silence(() => writeProjectLayoutYaml(layout));
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      '`--yes` must leave a committed confluence pair byte-identical');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// M22 — the backend question's pre-selection. EQUIVALENT under Story 31.5
// (one offerable backend); a one-Enter repoint of a committed Confluence store
// from the moment Story 31.8 makes confluence offerable.
// ══════════════════════════════════════════════════════════════════════════

test('M22 — the mutant `initial: 0` is now OBSERVABLE: index 0 is not the confluence choice', async () => {
  // The premise, stated first and independently. If `file-system` were ever
  // reordered to sit second, the pre-selection tests below could pass with the
  // mutant in place, and this suite would be asserting nothing. Two offerable
  // backends, and index 0 is not confluence — so a literal `0` is a REPOINT.
  const choices = backendChoicesForStore().map((c) => c.value);
  assert.strictEqual(choices.length, 2,
    `M22 is equivalent again if there is only one offerable backend; got ${choices.join(', ')}`);
  assert.notStrictEqual(choices[0], 'confluence',
    'index 0 must not be confluence, or `initial: 0` would preserve a confluence store by luck');
  assert.ok(choices.includes('confluence'), 'and confluence must be offerable at all');
});

test('M22 — an existing CONFLUENCE store pre-selects the confluence choice, BY VALUE', async () => {
  // Asserted through `choices[initial]`, never as `initial === 1`: an index
  // comparison would keep passing if the enum were reordered, which is the
  // silently-wrong-store outcome, not a passing test.
  const { cleanup } = withTmpDir();
  try {
    const existing = {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
      topology: {
        systemRequirementsStore: {
          backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '1' },
        },
        softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      },
    };
    const { questions } = await runWizard([
      ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT,
    ], existing);

    const backends = questions.filter((q) => q.name === 'backend');
    assert.strictEqual(backends[0].choices[backends[0].initial].value, 'confluence',
      `the confluence-backed system store must pre-select confluence; ` +
      `initial=${backends[0].initial} over ${backends[0].choices.map((c) => c.value).join(', ')}`);
    // ...and the OTHER store, which is file-system, must pre-select ITS backend —
    // a pre-selection that simply followed the previous store would also pass the
    // assertion above.
    assert.strictEqual(backends[1].choices[backends[1].initial].value, 'file-system',
      'the file-system-backed software store must pre-select file-system');
  } finally { cleanup(); }
});

test('M22 — pressing Enter through a committed confluence store does NOT repoint it', async () => {
  // The defect in its user-visible form: B-1 was "one Enter replaced a valid
  // Confluence store with file-system / same / .". Every answer here is the
  // wizard's own pre-population, so this is exactly that keystroke sequence.
  const { tmpDir, cleanup } = withTmpDir();
  try {
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '1001' },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const before = readLayoutFile(tmpDir);
    const existing = silence(() => readExistingLayout());

    const { layout } = await runWizard([
      ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT,
    ], existing);

    assert.strictEqual(layout.systemRequirementsStore.backend, 'confluence',
      'one Enter must not repoint a committed Confluence store to file-system');
    assert.strictEqual(layout.systemRequirementsStore.spaceKey, 'SYS');
    silence(() => writeProjectLayoutYaml(layout));
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      'and the committed file is byte-identical');
  } finally { cleanup(); }
});

test('M22 — with NO existing store the pre-selection is the first offerable backend, not confluence', async () => {
  // The other direction, and the reason `initial: 0` was equivalent before: a
  // fresh project must still default to file-system. A "fix" that pre-selected
  // confluence whenever it could would be the mirror defect.
  const { cleanup } = withTmpDir();
  try {
    const { questions, layout } = await runWizard([
      ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT, ACCEPT_DEFAULT,
      ACCEPT_DEFAULT,
    ], null);
    const backends = questions.filter((q) => q.name === 'backend');
    for (const q of backends) {
      assert.strictEqual(q.initial, 0, 'with nothing committed, the first choice is pre-selected');
      assert.strictEqual(q.choices[q.initial].value, 'file-system',
        'and that first choice is file-system');
    }
    assert.strictEqual(layout.systemRequirementsStore.backend, 'file-system');
    assert.strictEqual(layout.softwareRequirementsStore.backend, 'file-system');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// M21 — `modeChoicesFor(concern.key)` in the file-system flow.
//
// HONEST STATUS. `modeChoicesFor` partitions its argument exactly once —
// `'sprintManagement'` versus everything else — and Story 31.8 deliberately gave
// confluence NO mode set, so substituting either STORE concern's key REMAINS
// EQUIVALENT and no test can distinguish it. That is a property of the partition,
// not a coverage gap. The one substitution that is NOT equivalent —
// `'sprintManagement'`, which would silently offer `jira` as a place to keep a
// knowledge store — is covered below, on BOTH store concerns.
// ══════════════════════════════════════════════════════════════════════════

test('M21 — neither store\'s mode question offers `jira`, and both offer exactly STORE_MODES', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const sysDir = mkdir(tmpDir, 'sys');
    const sweDir = mkdir(tmpDir, 'swe');
    const { questions } = await runWizard([
      { backend: 'file-system' }, { mode: 'local' }, { localPath: sysDir },
      { backend: 'file-system' }, { mode: 'local' }, { localPath: sweDir },
      { mode: 'same' },
    ]);
    const modeQuestions = questions.filter((q) => q.name === 'mode');
    assert.strictEqual(modeQuestions.length, 3, 'two stores and sprint management');

    const storeConcerns = REPO_LAYOUT_CONCERNS.filter((c) => c.kind === 'store');
    assert.strictEqual(storeConcerns.length, 2, 'the story has exactly two knowledge stores');
    for (let i = 0; i < 2; i++) {
      const q = modeQuestions[i];
      assert.ok(q.message.includes(storeConcerns[i].label),
        `store mode question ${i} must name ${storeConcerns[i].label}, got: ${q.message}`);
      assert.deepStrictEqual(q.choices.map((c) => c.value), [...STORE_MODES],
        `store mode question ${i} must offer exactly STORE_MODES`);
      assert.ok(!q.choices.some((c) => c.value === 'jira'),
        `a knowledge store may never be offered jira — that is sprint management's mode`);
    }
    // ...while sprint management still is offered it, so the assertion above is
    // about the store concerns and not about `jira` having been removed outright.
    assert.ok(modeQuestions[2].choices.some((c) => c.value === 'jira'),
      'sprint management must still be offered jira (FR112, unchanged)');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// THE ANSWERED BACKEND IS WHAT IS THREADED AND RECORDED.
//
// `bin/cli.js` passes the answered `backend` into `entry.collect(concern,
// existingRecord, backend)`. With one offerable backend nothing could prove that
// the ANSWERED value was passed rather than a re-derived one; with two, it can.
// ══════════════════════════════════════════════════════════════════════════

test('the record names the ANSWERED backend when it DIFFERS from the committed one — both directions', async () => {
  // file-system committed, confluence answered.
  {
    const { cleanup } = withTmpDir();
    try {
      const existing = {
        knowledgebase: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
        topology: {
          systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
          softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
          sprintManagement: { mode: 'same', path: '.' },
        },
      };
      const { layout } = await runWizard([
        ...confluenceAnswers('ENG', 'Requirements'),
        ...FILE_SYSTEM_SAME,
        ...SPRINT_SAME,
      ], existing);
      assert.strictEqual(layout.systemRequirementsStore.backend, 'confluence',
        'the record must name the backend the user ANSWERED, not the committed one');
      assert.strictEqual(layout.systemRequirementsStore.spaceKey, 'ENG');
    } finally { cleanup(); }
  }
  // confluence committed, file-system answered.
  {
    const { cleanup } = withTmpDir();
    try {
      const existing = {
        knowledgebase: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
        topology: {
          systemRequirementsStore: {
            backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'T', id: '1' },
          },
          softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
          sprintManagement: { mode: 'same', path: '.' },
        },
      };
      const { layout } = await runWizard([
        { backend: 'file-system' }, { mode: 'same' },
        ...FILE_SYSTEM_SAME,
        ...SPRINT_SAME,
      ], existing);
      assert.deepStrictEqual(layout.systemRequirementsStore,
        { backend: 'file-system', mode: 'same', path: '.' },
        'switching AWAY from confluence must record the answered file-system store, ' +
        'with no confluence identity left clinging to it');
    } finally { cleanup(); }
  }
});

test('switching a store TO confluence starts from blank identity, not from the old record\'s leftovers', async () => {
  // The confluence flow pre-populates ONLY from a record that is itself a
  // confluence store. Reading identity off whatever record happens to be
  // committed looks harmless while a file-system record has no space key — and
  // stops being harmless the moment one carries a stray field, which a
  // hand-edited `project-layout.yaml`, a partially-migrated legacy record or a
  // future third backend can all produce. The user is CHANGING backend here;
  // nothing from the backend they are leaving may be offered back to them as
  // this store's identity.
  const { cleanup } = withTmpDir();
  try {
    const existing = {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
      topology: {
        systemRequirementsStore: {
          backend: 'file-system', mode: 'same', path: '.',
          // Not part of the file-system shape. Present exactly as a leftover.
          spaceKey: 'STALE-SPACE',
          rootPage: { title: 'Stale Page', id: 'stale-id' },
        },
        softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      },
    };
    const { questions, layout } = await runWizard([
      ...confluenceAnswers('FRESH', 'Fresh Page'),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ], existing);

    const space = questions.find((q) => q.name === 'spaceKey');
    const root = questions.find((q) => q.name === 'rootPageTitle');
    assert.strictEqual(space.initial, '',
      `the space question must start blank, not at ${JSON.stringify(space.initial)}`);
    assert.strictEqual(root.initial, '',
      `the root-page question must start blank, not at ${JSON.stringify(root.initial)}`);
    assert.deepStrictEqual(layout.systemRequirementsStore, {
      backend: 'confluence', spaceKey: 'FRESH', rootPage: { title: 'Fresh Page', id: null },
    }, 'and no leftover id may be carried into the newly-chosen backend');
  } finally { cleanup(); }
});

test('the confluence flow REFUSES to substitute a backend when it was handed none', async () => {
  // Same fail-loud contract the file-system flow already carries. A flow that
  // defaulted here would record a backend the user never answered — correct only
  // by coincidence of which table key happens to point at it.
  await assert.rejects(
    async () => collectConfluenceStoreLocation(
      { key: 'systemRequirementsStore', label: 'system requirements store' }, null, undefined),
    /must record the backend it was chosen FOR/,
    'a location flow called with no answered backend must throw, not guess');
  await assert.rejects(
    async () => collectConfluenceStoreLocation(
      { key: 'systemRequirementsStore', label: 'system requirements store' }, null, ''),
    /must record the backend it was chosen FOR/,
    'an empty backend is "never answered" too');
});

// ══════════════════════════════════════════════════════════════════════════
// OQ-4 — root-page identity: human-readable TITLE at configuration time,
// `id` reserved and left null. Forced by AC7: resolving a title to an opaque
// page id requires asking Confluence, and this story must not.
// ══════════════════════════════════════════════════════════════════════════

test('OQ-4 — configuration records the TITLE and leaves `id` null; no page id is invented', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const { layout } = await runWizard([
      ...confluenceAnswers('ENG', 'Requirements Home'),
      ...FILE_SYSTEM_SAME,
      ...SPRINT_SAME,
    ]);
    assert.deepStrictEqual(layout.systemRequirementsStore.rootPage,
      { title: 'Requirements Home', id: null },
      'the reserved {title, id} object is populated by title only at configuration time');
    silence(() => writeProjectLayoutYaml(layout));
    const { doc } = parseLayout(tmpDir);
    assert.strictEqual(doc.system_requirements_store.root_page.title, 'Requirements Home');
    assert.strictEqual(doc.system_requirements_store.root_page.id, null,
      'a fabricated id would be a record that looks resolved and points nowhere');
    // The field is PRESENT and null, not omitted — Story 31.2 reserved it, and an
    // omitted key is a schema change.
    assert.ok('id' in doc.system_requirements_store.root_page,
      'the reserved id field must be emitted, as null');
  } finally { cleanup(); }
});

test('OQ-4 — a learned id survives an UNCHANGED title and is DROPPED when the title changes', async () => {
  // The consequence of recording a title. Story 31.10 may learn the page id; on
  // the next reconfiguration that id still identifies the page only while the
  // title is the same. Carrying it across a rename would commit a {title, id}
  // pair naming two different pages — worse than a pair with one field, because
  // it looks resolved.
  const existingFor = (title, id) => ({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
    topology: {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'ENG', rootPage: { title, id },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    },
  });

  // Unchanged — Enter through, id survives.
  {
    const { cleanup } = withTmpDir();
    try {
      const { layout } = await runWizard(
        [ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT, ACCEPT_DEFAULT],
        existingFor('Requirements Home', '12345'));
      assert.deepStrictEqual(layout.systemRequirementsStore.rootPage,
        { title: 'Requirements Home', id: '12345' },
        'an unchanged title keeps the id a previous run learned');
    } finally { cleanup(); }
  }
  // Changed — id dropped.
  {
    const { cleanup } = withTmpDir();
    try {
      const { layout } = await runWizard([
        { backend: 'confluence' }, { spaceKey: 'ENG' }, { rootPageTitle: 'Somewhere Else' },
        ...FILE_SYSTEM_SAME, ...SPRINT_SAME,
      ], existingFor('Requirements Home', '12345'));
      assert.deepStrictEqual(layout.systemRequirementsStore.rootPage,
        { title: 'Somewhere Else', id: null },
        'a retitled root page must not keep the old page\'s id');
    } finally { cleanup(); }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// RECONFIGURATION AGENCY — the reviewer suggestion handed forward from 31.5,
// judged and DECLINED, with the property it was reaching for proved instead.
//
// The suggestion was a pre-selected "keep my current Confluence store
// (unchanged)" choice on the backend question. Declined: that question's choices
// ARE the closed `backend` enum, shared by reader, writer and prompt, and adding
// a value that is not a member is the closed-enum defect class this epic has
// already fixed three times — the same reason the readiness review rejected a
// third "configuration-pending" value. The agency it wanted comes from
// PRE-POPULATION instead, and unlike an extra choice that is checkable: pressing
// Enter through `ma-agents config layout` must leave the committed binding
// byte-identical.
// ══════════════════════════════════════════════════════════════════════════

test('`ma-agents config layout` over a confluence project ASKS, and Enter leaves the binding byte-identical', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    silence(() => writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'System Requirements', id: '900' },
      },
      softwareRequirementsStore: {
        backend: 'confluence', spaceKey: 'SWE', rootPage: { title: 'Architecture', id: '901' },
      },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const before = readLayoutFile(tmpDir);

    promptLog.length = 0;
    // Exactly seven Enters and no more: an eighth question exhausts the queue and
    // the stub names it, rather than having it silently defaulted.
    const queue = Array(7).fill(ACCEPT_DEFAULT);
    promptAnswer = (q) => {
      if (!queue.length) return unexpectedPrompt(q);
      queue.shift();
      return answerByPressingEnter(q);
    };
    let log;
    try {
      log = await silenceAsync(async () => { await handleConfigLayout([]); });
    } finally { promptAnswer = unexpectedPrompt; }
    assert.strictEqual(queue.length, 0, 'every prepared Enter must have been used');

    // It ASKS — the pre-31.8 behaviour was to decline, printing "UNCHANGED".
    assert.deepStrictEqual(promptLog.map((q) => q.name),
      ['backend', 'spaceKey', 'rootPageTitle', 'backend', 'spaceKey', 'rootPageTitle', 'mode'],
      'a confluence store is reconfigurable now — the wizard must ask about both stores');
    assert.ok(!/UNCHANGED/.test(log),
      `nothing may be declined for want of a wizard flow:\n${log}`);
    // ...and accepting every pre-population changes nothing, which is the
    // "keep my current Confluence store" outcome without an unasked question.
    assert.strictEqual(withoutGeneratedLine(readLayoutFile(tmpDir)), withoutGeneratedLine(before),
      'accepting every default must leave the committed binding byte-identical');
  } finally { cleanup(); }
});

// ─── Runner and summary ──────────────────────────────────────────────────────
//
// The count is pinned in BOTH directions: a shortfall means tests that never ran
// (and tests that never ran cannot fail), a surplus means the pin was not
// updated deliberately.
const EXPECTED_TEST_COUNT = 38;

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
