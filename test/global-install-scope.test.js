#!/usr/bin/env node
/**
 * Story 31.11 — Install scope is a wizard question; a global install does no
 * project-scoped work.
 *
 * ─── WHY THIS SUITE DRIVES REAL INSTALLS ────────────────────────────────────
 *
 * AC3 is "a global install writes nothing under any project root". That is an
 * ABSENCE assertion, and an absence assertion is the single easiest thing in
 * this codebase to make pass vacuously: it passes if the install crashed, if it
 * did nothing at all, or if the assertion is pointed at the wrong directory.
 * This epic has already produced that defect shape six times (a test double
 * answering `{}` when its queue ran dry, so a 24-test suite exited 0 having
 * reported nothing; an assertion using `split('—')[1] || ''` that degraded to
 * asserting nothing; and so on).
 *
 * So every absence here is bracketed by presence:
 *
 *   1. the global install must EXIT 0 (not merely "not crash");
 *   2. it must have genuinely INSTALLED — real skill directories with SKILL.md
 *      files and a generated MANIFEST.yaml under the sandbox home;
 *   3. only then is the project root asserted empty;
 *   4. and a PROJECT-scope install is run through the IDENTICAL harness and
 *      must produce the very artifacts the global run must not. That is the
 *      control: it proves the harness can see writes to that directory at all,
 *      so an empty project root means "nothing was written", not "we were
 *      looking somewhere else".
 *
 * Both installs redirect HOME and USERPROFILE into a throwaway sandbox, so a
 * global install never touches the developer's real ~/.claude, ~/.codex, etc.
 * (`os.homedir()` reads USERPROFILE on win32 and HOME elsewhere.)
 *
 * NEVER wrap these in a shell `timeout`: a SIGTERM'd install exits 143, which
 * reads as a failure and is not one. `spawnSync`'s own `timeout` option is used
 * instead, and a timeout is reported as a FAILURE, never skipped.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const EXPECTED_TEST_COUNT = 16;

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
// Newline-normalised: the working tree is CRLF on Windows and LF on CI, and a
// source-level anchor that only matches one of them is a test that silently
// stops asserting on the other platform — this epic's signature defect.
const CLI_SOURCE = fs.readFileSync(CLI_PATH, 'utf-8').replace(/\r\n/g, '\n');
const { parseFlags } = require('../bin/cli.js');
const { GLOBAL_BIND_OFFER_HEADER } = require('../lib/installer.js');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ─── harness ────────────────────────────────────────────────────────────────

const LAYOUT_ENV_KEYS = [
  'MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL',
];

const tmpRoots = [];
function makeSandbox(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ma-31-11-${label}-`));
  tmpRoots.push(root);
  const projectRoot = path.join(root, 'project');
  const homeRoot = path.join(root, 'home');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(homeRoot, { recursive: true });
  return { root, projectRoot, homeRoot };
}

/**
 * Runs the REAL CLI. `extraArgs` is ['--global'] or []. Returns
 * { status, output }. A null status (timeout / signal) is a failure, reported
 * as such by the caller — never silently tolerated.
 */
function runInstall({ projectRoot, homeRoot, extraArgs }) {
  const env = { ...process.env };
  for (const k of LAYOUT_ENV_KEYS) delete env[k];
  env.HOME = homeRoot;
  env.USERPROFILE = homeRoot;
  const res = spawnSync(process.execPath, [CLI_PATH, 'install', '--yes', ...extraArgs], {
    cwd: projectRoot, env, encoding: 'utf-8', input: '',
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 900000,
  });
  return {
    status: res.status,
    signal: res.signal,
    output: `${res.stdout || ''}\n${res.stderr || ''}`,
  };
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    acc.push(full);
    if (e.isDirectory()) walk(full, acc);
  }
  return acc;
}

// ─── AC1 — the Installation Scope question is retained AS-IS ────────────────
//
// Pinned at source level because AC1 is a statement about the SHIPPED QUESTION,
// not about a behaviour: it must not be rebuilt, reworded, or moved earlier in
// the flow. A behavioural test cannot see a rewording, and the question is only
// reachable from the bare interactive menu (see the reachability test below),
// which a spawned `--yes` run deliberately never enters.

const SCOPE_QUESTION_BLOCK = [
  "  if (!isUpdate && !installPath && !yesFlag && !cliScope) {",
  "    const { pathChoice } = await prompts({",
  "      type: 'select',",
  "      name: 'pathChoice',",
  "      message: 'Installation scope:',",
  "      choices: [",
  "        { title: 'Project level (current directory)', value: 'project' },",
  "        { title: 'Global (user-level settings)', value: 'global' },",
  "        { title: 'Custom path...', value: 'custom' }",
  "      ]",
  "    });",
].join('\n');

console.log('\nAC1 — the existing Installation Scope question is retained as-is');

test('the question ships verbatim: same guard, same three choices, same wording', () => {
  assert.ok(
    CLI_SOURCE.includes(SCOPE_QUESTION_BLOCK),
    'the Installation Scope prompt is no longer byte-identical. AC1 forbids rebuilding or ' +
    'rewording it — if a choice title, its value, the message, or the skip guard changed, that ' +
    'is the change AC1 exists to catch.'
  );
  // The custom-path follow-up is part of the retained question, not a separate one.
  assert.ok(
    CLI_SOURCE.includes("        message: 'Enter installation directory:',"),
    "the `Custom path...` follow-up prompt was reworded or removed"
  );
});

test('the question is NOT moved earlier: it still runs after platform/agent selection', () => {
  const agentSelection = CLI_SOURCE.indexOf("message: 'Select BMAD Method Agents:',");
  const scopeQuestion = CLI_SOURCE.indexOf(SCOPE_QUESTION_BLOCK);
  assert.notStrictEqual(agentSelection, -1, 'agent-selection prompt not found — anchor is stale');
  assert.notStrictEqual(scopeQuestion, -1, 'scope question not found — anchor is stale');
  assert.ok(
    agentSelection < scopeQuestion,
    'the Installation Scope question was moved ahead of agent selection. The ORIGINAL FR248 ' +
    'wanted exactly that; the 2026-08-02 amendment dropped it, and AC1 now forbids it.'
  );
});

test('the scope-gated repo-layout collection runs BELOW the question, not above it', () => {
  const scopeQuestion = CLI_SOURCE.indexOf(SCOPE_QUESTION_BLOCK);
  const collection = CLI_SOURCE.indexOf(
    "    repoLayout = await collectRepoLayout({ yes: yesFlag }, existingLayout);"
  );
  assert.notStrictEqual(collection, -1,
    'the gated collectRepoLayout call is gone — if it was un-gated, AC3 regresses: a global ' +
    'install prompts for knowledge-store locations again');
  assert.ok(scopeQuestion < collection,
    'collectRepoLayout runs BEFORE the scope question again — that is the FR251 ordering defect');
  // readExistingLayout stays UNCONDITIONAL (prerequisite 2B, 3f21b1a). It is a
  // pure read; gating it would restore the defect where `install --yes`
  // silently destroyed a committed Confluence store.
  assert.ok(
    CLI_SOURCE.includes('\n  const existingLayout = readExistingLayout();\n  let repoLayout = null;'),
    'readExistingLayout() is no longer called unconditionally at top level in the wizard — ' +
    'prerequisite 2B made it unconditional deliberately and this story must not weaken it'
  );
});

// ─── AC2 — `--global` is retained as the non-interactive equivalent ─────────

console.log('\nAC2 — the --global flag is retained for --yes and CI runs');

test('--global still resolves to global scope, and its absence to project scope', () => {
  assert.strictEqual(parseFlags(['--global']).scope, 'global');
  assert.strictEqual(parseFlags(['--global']).globalFlag, true);
  assert.strictEqual(parseFlags(['--yes', '--global']).scope, 'global',
    '--yes + --global is the CI form the AC names explicitly');
  assert.strictEqual(parseFlags([]).scope, 'project');
  assert.strictEqual(parseFlags(['--yes']).scope, 'project',
    '--yes alone must stay project-scoped — the default path is unchanged (NFR76)');
});

test('the interactive question is reachable only from the bare menu, and that is unchanged', () => {
  // `handleInstall` always passes a truthy cliScope ('project' when --global is
  // absent), so the skip guard `!cliScope` means `ma-agents install` never
  // reaches the prompt; only `installWizard()` with no arguments does. This is
  // PRE-EXISTING behaviour. It is pinned because a reader who assumes
  // `ma-agents install` asks the question will misread every other test here.
  assert.ok(
    CLI_SOURCE.includes("    scope: globalFlag ? 'global' : 'project',"),
    'parseFlags no longer always returns a scope — the reachability note in bin/cli.js is stale'
  );
  assert.ok(
    CLI_SOURCE.includes('    await installWizard();'),
    'the bare-menu entry point that DOES reach the scope question is gone'
  );
});

// ─── AC3 / AC6 — the real installs ──────────────────────────────────────────

console.log('\nAC3 — running a REAL global install (this takes a while)');

const globalBox = makeSandbox('global');
const globalRun = runInstall({ ...globalBox, extraArgs: ['--global'] });
const globalHomeFiles = walk(globalBox.homeRoot);
const globalProjectFiles = walk(globalBox.projectRoot);
const globalManifestYamls = globalHomeFiles.filter(f => path.basename(f) === 'MANIFEST.yaml');

test('the global install SUCCEEDED — exit 0, not a timeout (anti-vacuity gate 1)', () => {
  assert.notStrictEqual(globalRun.status, null,
    `the global install did not exit within the timeout (signal ${globalRun.signal}). ` +
    `A timeout is a FAILURE here, never a skip.\n${globalRun.output.slice(-2000)}`);
  assert.strictEqual(globalRun.status, 0,
    `\`install --yes --global\` exited ${globalRun.status}. Every absence assertion below ` +
    `would pass trivially on a failed install, so this gate comes first.\n` +
    globalRun.output.slice(-3000));
});

test('the global install actually INSTALLED skills globally (anti-vacuity gate 2)', () => {
  const skillFiles = globalHomeFiles.filter(f => path.basename(f) === 'SKILL.md');
  assert.ok(skillFiles.length >= 20,
    `only ${skillFiles.length} SKILL.md files were installed under the sandbox home. ` +
    `"wrote nothing under the project root" proves nothing if the install wrote nothing ` +
    `anywhere.\n${globalRun.output.slice(-2000)}`);
  assert.ok(globalManifestYamls.length >= 1,
    'no MANIFEST.yaml was generated in any global skills directory');
});

test('AC3 — the project root is left COMPLETELY empty by a global install', () => {
  assert.deepStrictEqual(
    globalProjectFiles.map(f => path.relative(globalBox.projectRoot, f)).sort(),
    [],
    'a global install wrote into the project root. FR251: no project is in scope at that ' +
    'moment, so no project-scoped work may happen. (Before this story the offender was ' +
    '`.ma-agents.json`, written by setProfile() and the Demerzel notice.)'
  );
});

test('AC3 — the three artifacts FR251 names by name are absent', () => {
  for (const rel of [
    path.join('_bmad-output', 'project-layout.yaml'),
    path.join('_bmad-output', 'project-context.md'),
    '.ma-agents.json',
    '_bmad',
    '.agents',
    'AGENTS.md',
  ]) {
    assert.ok(!fs.existsSync(path.join(globalBox.projectRoot, rel)),
      `a global install created ${rel} in the project root`);
  }
});

test('AC3 — a global install never prompts for knowledge-store locations', () => {
  for (const phrase of [
    'Where is your knowledgebase managed?',
    'Where is your sprint management managed?',
    'Enter path to',
  ]) {
    assert.ok(!globalRun.output.includes(phrase),
      `the global install emitted the knowledge-store prompt "${phrase}". Under --yes these ` +
      `prompts do not fire anyway, so this is a guard for the interactive path's ordering, ` +
      `not the whole proof — the ordering itself is pinned by the AC1 collection test above.`);
  }
});

console.log('\nAC6 / scope recording — the global install surfaces the bind offer');

test('AC6 — every global MANIFEST.yaml carries the bind offer in its header', () => {
  assert.ok(globalManifestYamls.length >= 1, 'no global MANIFEST.yaml to inspect');
  for (const f of globalManifestYamls) {
    const content = fs.readFileSync(f, 'utf-8');
    assert.ok(content.includes(GLOBAL_BIND_OFFER_HEADER),
      `${f} does not carry the AC6 bind offer. A globally-installed skill activating in an ` +
      `unbound project has no other surface that tells it to offer binding.`);
    assert.ok(content.includes('_bmad-output/project-layout.yaml'),
      `${f} does not name the file whose absence triggers the offer`);
    assert.ok(content.indexOf('# INSTALL SCOPE: global') < content.indexOf('\nskills:'),
      'the offer must precede the skills list, not be buried after it');
  }
});

test('AC6 — the offer leads with a remedy that EXISTS in this release', () => {
  // Mirrors the pin in test/project-layout-binding-spine.test.js: `ma-agents
  // bind` ships in Story 31.13 and must not be the instruction a user of THIS
  // release is given.
  assert.ok(/OFFER to create one by running\n# `ma-agents install` in the project root/
    .test(GLOBAL_BIND_OFFER_HEADER),
    `the offer must name the command that works today, got:\n${GLOBAL_BIND_OFFER_HEADER}`);
  const bindIdx = GLOBAL_BIND_OFFER_HEADER.indexOf('ma-agents bind');
  const installIdx = GLOBAL_BIND_OFFER_HEADER.indexOf('ma-agents install');
  assert.notStrictEqual(installIdx, -1, 'the shipping remedy is not named at all');
  assert.ok(bindIdx === -1 || installIdx < bindIdx,
    '`ma-agents bind` is named before the remedy that exists in this release');
});

test('the chosen scope is RECORDED so a later `ma-agents bind` knows it was global', () => {
  const rootManifests = globalHomeFiles.filter(f => path.basename(f) === '.ma-agents.json');
  assert.ok(rootManifests.length >= 1,
    'no .ma-agents.json was written into any global skills directory');
  for (const f of rootManifests) {
    const m = JSON.parse(fs.readFileSync(f, 'utf-8'));
    assert.strictEqual(m.scope, 'global',
      `${f} records scope ${JSON.stringify(m.scope)} — the recorded scope is what Story 31.13's ` +
      `bind step reads to know the install was global`);
  }
});

// ─── The control: a PROJECT-scope install through the same harness ─────────
//
// This is what stops the six assertions above from being vacuous. Same harness,
// same sandbox shape, same spawn — and it MUST produce, in the project root,
// the artifacts the global run must not. If this fails, the empty-project-root
// assertion above is not measuring what it claims to measure.

console.log('\nAnti-vacuity control + NFR76 — a REAL project-scope install (this takes a while)');

const projectBox = makeSandbox('project');
const projectRun = runInstall({ ...projectBox, extraArgs: [] });

test('the control project install succeeds and DOES write the project-scoped artifacts', () => {
  assert.notStrictEqual(projectRun.status, null,
    `the project install did not exit within the timeout (signal ${projectRun.signal})`);
  assert.strictEqual(projectRun.status, 0,
    `\`install --yes\` exited ${projectRun.status}.\n${projectRun.output.slice(-3000)}`);

  // NFR76 rebaselined to the POST-31.2 tree: `_bmad-output/project-layout.yaml`
  // is now written unconditionally (Story 31.2 / FR263). Its presence is part
  // of the baseline this story must not disturb, not a change this story makes.
  const layout = path.join(projectBox.projectRoot, '_bmad-output', 'project-layout.yaml');
  assert.ok(fs.existsSync(layout),
    'the post-31.2 baseline writes _bmad-output/project-layout.yaml on every project install — ' +
    'its absence means either NFR76 regressed or this control is not measuring the project root');
  assert.ok(fs.existsSync(path.join(projectBox.projectRoot, '.ma-agents.json')),
    'a project install must still persist the profile manifest (Story 21.1 AC #9) — gating ' +
    'setProfile on scope must not have taken it away from the project path too');

  const written = walk(projectBox.projectRoot);
  assert.ok(written.length > 10,
    `the control install produced only ${written.length} paths under the project root; the ` +
    `global run's "0 paths" assertion is only meaningful against a control that produces many`);
});

test('NFR76 — the project-scope MANIFEST.yaml gains no global-install header', () => {
  const manifests = walk(projectBox.projectRoot).filter(f => path.basename(f) === 'MANIFEST.yaml');
  assert.ok(manifests.length >= 1, 'no MANIFEST.yaml was generated for the project install');
  for (const f of manifests) {
    const content = fs.readFileSync(f, 'utf-8');
    assert.ok(!content.includes('# INSTALL SCOPE: global'),
      `${f} carries the global-scope bind offer. AC6's header is global-only; leaking it into a ` +
      `project install would change the default path's bytes, which is exactly what NFR76 forbids.`);
    assert.ok(content.startsWith('# MANIFEST.yaml\n\nskills:\n'),
      `${f} no longer opens with the pre-31.11 header bytes — NFR76 requires the project path ` +
      `to be byte-identical to the post-31.2 baseline`);
  }
});

// ─── AC5 / NFR77 — the global path reaches the network for nothing ─────────
//
// This is the ONE behaviour that makes the `installScope === 'project'` gate on
// `collectRepoLayout` load-bearing under `--yes`, and it is the only NFR77
// evidence this suite can produce without an actual egress block.
//
// `collectRepoLayout({yes:true})` with MA_KNOWLEDGEBASE_GIT_URL set calls
// `ciCloneIfNeeded`, which shells out to `git clone` and, on failure, throws a
// fail-loud error that aborts the install. So on an UNGATED build, a global
// install with these env vars set either clones (network access at install
// time, violating NFR77) or dies trying. With the gate, the collection never
// runs: the install completes, nothing is cloned, and the project root stays
// empty. The URL below is deliberately unroutable so that a regression cannot
// pass by silently succeeding.

console.log('\nAC5 / NFR77 — a global install does not clone, even with MA_*_GIT_URL set');

const cloneBox = makeSandbox('clone');
const cloneDest = path.join(cloneBox.root, 'would-be-clone');
const cloneRun = (() => {
  const env = { ...process.env };
  env.HOME = cloneBox.homeRoot;
  env.USERPROFILE = cloneBox.homeRoot;
  env.MA_KNOWLEDGEBASE_PATH = cloneDest;
  env.MA_KNOWLEDGEBASE_GIT_URL = 'https://ma-agents-31-11.invalid/no-such-repo.git';
  const res = spawnSync(process.execPath, [CLI_PATH, 'install', '--yes', '--global'], {
    cwd: cloneBox.projectRoot, env, encoding: 'utf-8', input: '',
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 900000,
  });
  return { status: res.status, signal: res.signal, output: `${res.stdout || ''}\n${res.stderr || ''}` };
})();

test('NFR77 — MA_KNOWLEDGEBASE_GIT_URL is not acted on by a global install', () => {
  assert.notStrictEqual(cloneRun.status, null,
    `the install did not exit within the timeout (signal ${cloneRun.signal})`);
  assert.strictEqual(cloneRun.status, 0,
    `the global install failed with the layout env vars set. An UNGATED build reaches ` +
    `ciCloneIfNeeded here and aborts on the unroutable URL — which is precisely the ` +
    `install-time network access NFR77 forbids.\n${cloneRun.output.slice(-3000)}`);
  assert.ok(!fs.existsSync(cloneDest),
    `a global install created the clone destination ${cloneDest}`);
  assert.ok(!/Cloning/.test(cloneRun.output),
    `the global install announced a clone:\n${cloneRun.output.slice(-2000)}`);
  assert.deepStrictEqual(walk(cloneBox.projectRoot), [],
    'the global install wrote into the project root even with layout env vars set');
  // Anti-vacuity: prove this run installed, so "did not clone" is not "did nothing".
  assert.ok(walk(cloneBox.homeRoot).filter(f => path.basename(f) === 'SKILL.md').length >= 20,
    'this run did not actually install anything, so it proves nothing about cloning');
});

// ─── cleanup + summary ──────────────────────────────────────────────────────

for (const root of tmpRoots) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n${passed} passed, ${failed} failed`);

const total = passed + failed;
if (total !== EXPECTED_TEST_COUNT) {
  console.error(`\n  FATAL: ran ${total} tests, expected exactly ${EXPECTED_TEST_COUNT}. ` +
    `If you added or removed a test, update EXPECTED_TEST_COUNT.`);
  process.exit(1);
}

if (failed > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  process.exit(1);
}
