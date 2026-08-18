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

// 16 from Story 31.11, +6 from Story 31.12 (AC5 x3, AC6 x2, AC7/NFR83 x1),
// +4 from the 31.12 fix round: the notice is a CLOSED SET (behavioural +
// source), the installed global agent set excludes BMAD, and the
// zero-BMAD-agent case.
const EXPECTED_TEST_COUNT = 26;

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const INSTALLER_PATH = path.join(__dirname, '..', 'lib', 'installer.js');
const AGENTS_PATH = path.join(__dirname, '..', 'lib', 'agents.js');
// Newline-normalised: the working tree is CRLF on Windows and LF on CI, and a
// source-level anchor that only matches one of them is a test that silently
// stops asserting on the other platform — this epic's signature defect.
const CLI_SOURCE = fs.readFileSync(CLI_PATH, 'utf-8').replace(/\r\n/g, '\n');
const INSTALLER_SOURCE = fs.readFileSync(INSTALLER_PATH, 'utf-8').replace(/\r\n/g, '\n');
const { parseFlags } = require('../bin/cli.js');
const { GLOBAL_BIND_OFFER_HEADER } = require('../lib/installer.js');
const { getAllAgents } = require('../lib/agents.js');
// Story 31.12 (FR250). Bound to the SHIPPED strings, not to copies of them: a
// copy in the test would let the shipped text drift while the test stayed green.
const {
  GLOBAL_BMAD_SCOPE_NOTICE_FACT_1: FACT_1,
  GLOBAL_BMAD_SCOPE_NOTICE_FACT_2: FACT_2,
  GLOBAL_BMAD_SCOPE_NOTICE_FACT_3: FACT_3,
} = require('../bin/cli.js');

// The registry split AC5 is about. `--yes` preselects
// `[...agents.filter(a => a.category !== 'bmad'), ...agents.filter(a => a.category === 'bmad')]`
// (bin/cli.js Step 2), so these two lists ARE the selection a `--yes` run starts
// from — derived from the shipped registry, never hardcoded, so a newly
// registered agent joins the assertion automatically instead of slipping past it.
const ALL_AGENTS = getAllAgents();
const BMAD_AGENTS = ALL_AGENTS.filter(a => a.category === 'bmad');
const NON_BMAD_AGENTS = ALL_AGENTS.filter(a => a.category !== 'bmad');
const BMAD_AGENT_IDS = BMAD_AGENTS.map(a => a.id);
const NON_BMAD_AGENT_IDS = NON_BMAD_AGENTS.map(a => a.id);

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

// ─── output readers used by the Story 31.12 closed-set assertions ───────────

// chalk disables colour on a piped stdout, but stripping is free and a stray
// escape would otherwise make a line "non-blank" and silently move a boundary.
const ANSI = /\x1B\[[0-9;]*m/g;
function outputLines(output) {
  return output.replace(ANSI, '').replace(/\r\n/g, '\n').split('\n');
}

/**
 * Extracts the FR250 notice as the BLANK-LINE-DELIMITED PARAGRAPH it is emitted
 * as, rather than as "the lines we expected to find".
 *
 * This is what makes the AC5 "exactly three things" assertion a CLOSED SET
 * instead of a presence check. The notice is printed by four `console.log`s, the
 * first prefixed `\n`; for a GLOBAL install every `console.log` between it and
 * the `console.log('')` that opens the Summary sits inside an
 * `if (installScope === 'project')` block, so the notice occupies a paragraph of
 * its own. Reading the whole paragraph and comparing it as a list means a fourth
 * statement appended to the notice is not "extra text we did not look for" — it
 * is a paragraph line that has no counterpart in the expected list, and the
 * comparison fails.
 *
 * Returns null when the notice was never printed (the zero-BMAD-agent case).
 */
function noticeParagraph(output) {
  const lines = outputLines(output);
  const anchor = FACT_1.split('\n')[0].trim();
  const start = lines.findIndex(l => l.trim() === anchor);
  if (start === -1) return null;
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].trim() !== '') end++;
  return {
    lines: lines.slice(start, end + 1),
    precededByBlank: start === 0 || lines[start - 1].trim() === '',
  };
}

/**
 * The FR250 notice block AS SHIPPED, sliced out of bin/cli.js. Asserted-on
 * rather than assumed: if the anchors ever stop matching, the caller fails loud
 * instead of quietly measuring an empty string.
 */
function noticeBlockSource() {
  const start = CLI_SOURCE.indexOf("  if (installScope === 'global') {");
  const end = CLI_SOURCE.indexOf('  // Step 3.5: BMAD-METHOD Integration');
  assert.ok(start !== -1 && end !== -1 && end > start,
    'could not locate the global BMAD-agent filter block in bin/cli.js — this test is not ' +
    'measuring what it claims to measure');
  const block = CLI_SOURCE.slice(start, end);
  assert.ok(block.includes('bmadAgentIds') && block.includes('GLOBAL_BMAD_SCOPE_NOTICE_FACT_1'),
    `the located block is not the FR250 notice block:\n${block}`);
  return block;
}

/**
 * The agent ids the install actually proceeded with, read from the Summary
 * block the wizard prints AFTER the global BMAD filter has run
 * (`console.log(chalk.cyan('  Agents:  ') + selectedAgentIds.join(', '))`).
 * This is the post-filter set — the one AC5's "BMAD remains project-scoped"
 * half is a statement about.
 */
const SUMMARY_AGENTS_PREFIX = '  Agents:  ';
function summaryAgentIds(output) {
  const rows = outputLines(output).filter(l => l.startsWith(SUMMARY_AGENTS_PREFIX));
  assert.strictEqual(rows.length, 1,
    `expected exactly one "${SUMMARY_AGENTS_PREFIX.trim()}" summary row, found ${rows.length}. ` +
    `That row is the anchor for the installed-agent-set assertions; if the wizard stopped ` +
    `printing it, or printed it twice, those assertions are not measuring what they claim.`);
  return rows[0].slice(SUMMARY_AGENTS_PREFIX.length).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Resolves every agent's GLOBAL install directory as the installer resolved it
 * — i.e. with HOME/USERPROFILE pointed at the sandbox, in a child process, so
 * `os.homedir()` inside lib/agents.js returns the sandbox and not this
 * developer's real home. Used to check the sandbox for the artifacts each agent
 * should (or must not) have.
 */
function resolveGlobalPaths(homeRoot) {
  const probe = path.join(homeRoot, '..', 'agent-paths-probe.js');
  fs.writeFileSync(probe, [
    "const { getAllAgents } = require(process.argv[2]);",
    "process.stdout.write(JSON.stringify(getAllAgents().map(a => ",
    "  ({ id: a.id, category: a.category, globalPath: a.getGlobalPath() }))));",
  ].join('\n'));
  const env = { ...process.env };
  for (const k of LAYOUT_ENV_KEYS) delete env[k];
  env.HOME = homeRoot;
  env.USERPROFILE = homeRoot;
  const res = spawnSync(process.execPath, [probe, AGENTS_PATH], {
    env, encoding: 'utf-8', timeout: 120000,
  });
  assert.strictEqual(res.status, 0,
    `the agent-path probe exited ${res.status}\n${res.stdout}\n${res.stderr}`);
  return JSON.parse(res.stdout);
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

// ─── Story 31.12 AC5 / AC6 — the FR250 degradation-path notice ──────────────
//
// CAREFUL: "AC5" elsewhere in this file means Story 31.11's AC5. Everything in
// this section is STORY 31.12's AC5/AC6 and is labelled as such.
//
// Story 31.1's spike returned FAIL, so 31.12 is a messaging change: the BMAD
// filter stays (BMAD genuinely cannot install globally) and only the text
// changes. These assertions run against `globalRun.output` — the stdout of a
// REAL `install --yes --global` — not merely against a constant, because the
// defect this epic keeps producing is text that exists somewhere nothing reads.
// Under `--yes` the wizard preselects every IDE *and* BMAD agent (bin/cli.js:
// `selectedAgentIds = [...ideAgents.map(a => a.id), ...bmadAgents.map(a => a.id)]`),
// so the `bmadAgentIds.length > 0` branch is genuinely entered by this run.

console.log('\nStory 31.12 AC5/AC6 — the FR250 notice in a real global install');

test('31.12 AC5 — the notice actually REACHES the user (anti-vacuity gate)', () => {
  // If the branch is never entered, every content assertion below would be
  // asserting about a string that was never printed. Prove it printed first.
  assert.ok(globalRun.output.includes('BMAD-METHOD is installed per project'),
    `the global install never emitted the FR250 notice at all, so nothing below is measuring ` +
    `the shipped output. Either the --yes preselection stopped including BMAD agents or the ` +
    `branch was removed.\n${globalRun.output.slice(-3000)}`);
});

test('31.12 AC5 — all three FR250 facts appear in the global install output', () => {
  const facts = {
    '(i) BMAD remains project-scoped': FACT_1,
    '(ii) the command that installs BMAD into a project': FACT_2,
    '(iii) the knowledge-store configuration is unaffected': FACT_3,
  };
  for (const [label, text] of Object.entries(facts)) {
    assert.ok(typeof text === 'string' && text.trim().length > 0,
      `FR250 fact ${label} is not exported from bin/cli.js as a non-empty string`);
    // Line by line: the constants are multi-line and the console adds indent.
    for (const line of text.split('\n')) {
      assert.ok(globalRun.output.includes(line.trim()),
        `FR250 fact ${label} is not in the global install output. Missing line:\n  ${line.trim()}`);
    }
  }
});

test('31.12 AC5 — fact (ii) names the command WITHOUT promising an install', () => {
  // `cd <project> && ma-agents install` reaches the BMAD install only when BOTH
  // an IDE-category agent is selected (bin/cli.js: `bmadToolsFilter` is built
  // from `category === 'ide'` and gated by `if (bmadTools.length > 0)`) AND the
  // user accepts the confirm `BMAD-METHOD not detected. Would you like to
  // install it?`. Declining leaves BMAD uninstalled. So the text must name the
  // command and the IDE-agent condition, and must not assert an outcome.
  assert.ok(/`ma-agents install`/.test(FACT_2),
    `fact (ii) does not name the command at all:\n${FACT_2}`);
  assert.ok(/IDE\s+agent selected/.test(FACT_2.replace(/\s+/g, ' ')),
    `fact (ii) omits the IDE-agent condition, so it implies any invocation installs BMAD:\n${FACT_2}`);
  assert.ok(/\boffers\b/.test(FACT_2),
    `fact (ii) must say the installer OFFERS — the "BMAD-METHOD not detected" confirm can be ` +
    `declined, so a promise that it installs would be false:\n${FACT_2}`);
  // Guard the source-level premise this wording depends on. If either condition
  // disappears from bin/cli.js the wording is silently wrong; fail loud instead.
  assert.ok(CLI_SOURCE.includes('if (bmadTools.length > 0) {'),
    'the IDE-agent condition fact (ii) is worded around is gone from bin/cli.js');
  assert.ok(CLI_SOURCE.includes("message: 'BMAD-METHOD not detected. Would you like to install it?',"),
    'the confirm prompt fact (ii) is worded around is gone from bin/cli.js');
});

test('31.12 AC6 — the notice is not framed as a warning or an error', () => {
  // AC6 is a real acceptance criterion, not a style note: a global install with
  // project-scoped BMAD is a SUPPORTED configuration. The superseded text said
  // "Warning:", "skipped" and "Run again without --global" — it told the user to
  // undo a working mode. A facts-only test would let all of that survive
  // alongside the three facts, so the framing is pinned separately, and against
  // the real output as well as the constants.
  //
  // A DENYLIST CANNOT BE THE ONLY DEFENCE — it enumerates what must be absent,
  // so alarming wording it does not happen to name walks straight through it
  // (review finding F-1: `Caution: this is a degraded fallback. Re-run without
  // --global to avoid it.` matched none of the original five terms). The closed-
  // set assertions above and below are the actual guarantee; this list survives
  // because it names the specific regressions and gives a far better failure
  // message than a diff of two six-line arrays. It is applied to the EMITTED
  // PARAGRAPH, not merely to the constants, so wording printed into the notice
  // from anywhere is in scope.
  const para = noticeParagraph(globalRun.output);
  assert.ok(para, 'the FR250 notice was not printed, so this test measures nothing');
  const notice = para.lines.join('\n');
  for (const banned of [
    'warning', 'error', 'skipped', 'run again without', 'unsupported',
    // Added by the fix round, from the surviving mutant's own vocabulary.
    'degraded', 'fallback', 'caution', 're-run without', 'avoid', 'limitation',
  ]) {
    assert.ok(!notice.toLowerCase().includes(banned),
      `the FR250 notice contains "${banned}", which frames a supported configuration as a ` +
      `fault. AC6: not a warning and not an error.\n${notice}`);
  }
  // The superseded sentences must be gone from the shipped binary's output too,
  // not merely absent from the new constants while still printed alongside them.
  for (const gone of [
    'BMAD agents require project-level installation',
    'Run again without --global',
  ]) {
    assert.ok(!globalRun.output.includes(gone),
      `the superseded FR250 text "${gone}" is still printed by a global install`);
  }
});

test('31.12 AC6 — the notice is not rendered through the warning colour', () => {
  // `chalk.yellow` is this codebase's warning colour (see the neighbouring
  // "Warning: Agent '...' is not supported for BMAD customizations" call) and
  // `chalk.red` its error colour. Pinned at SOURCE level because colour is
  // invisible to a captured, non-TTY stdout — the behavioural assertions above
  // genuinely cannot see it, so this is not a redundant duplicate of them.
  const block = noticeBlockSource();
  assert.ok(!/chalk\.yellow|chalk\.red/.test(block),
    `the FR250 notice is still printed through chalk.yellow/chalk.red. AC6 forbids warning ` +
    `framing, and colour is part of that framing.\n${block}`);
});

// ─── 31.12 AC5/AC6, fix round — the notice is a CLOSED SET ─────────────────
//
// Review finding F-1: the tests above prove the three facts are PRESENT and that
// seven specific strings are ABSENT. Neither shape can see a FOURTH statement
// that happens to use vocabulary the denylist does not name. The reviewer's
// mutant appended
//
//     console.log(chalk.gray('  Caution: this is a degraded fallback. ' +
//                            'Re-run without --global to avoid it.'));
//
// to the block: alarming, tells the user to undo a supported configuration,
// calls it degraded — and the suite stayed 22/0. AC5 says the installer reports
// EXACTLY THREE THINGS, so the enforceable form of that is equality, not
// membership. The two tests below close it from both ends: behaviourally (the
// emitted paragraph must EQUAL the three facts plus the agent list) and
// structurally (the block must contain exactly those four prints — which also
// catches an appended statement that opens with its own `\n` and would
// therefore start a new paragraph the behavioural test could not see).

test('31.12 AC5/AC6 — the EMITTED notice is a closed set: three facts, one agent list, nothing else', () => {
  const para = noticeParagraph(globalRun.output);
  assert.ok(para,
    `the FR250 notice was not printed by the real global install at all, so this closed-set ` +
    `assertion would be vacuous.\n${globalRun.output.slice(-3000)}`);

  const expected = [
    ...FACT_1.split('\n'),
    `    ${BMAD_AGENT_IDS.join(', ')}`,
    ...FACT_2.split('\n'),
    ...FACT_3.split('\n'),
  ];
  assert.deepStrictEqual(para.lines, expected,
    `the notice a real global install prints is no longer EXACTLY the three FR250 facts plus ` +
    `the list of BMAD agent ids. AC5 says the installer reports exactly three things: an extra ` +
    `line here is a fourth statement the user was never meant to be told, and a missing or ` +
    `reordered line is a fact that moved. Compare emitted (left) with expected (right).`);
  assert.ok(para.precededByBlank,
    'the notice no longer opens its own paragraph — something is printed on the line ' +
    'immediately above it, inside the block a user reads as one message');

  // The expected list above is BUILT FROM the constants, so a fourth statement
  // appended INSIDE one of them would grow both sides together and the equality
  // would still hold. Pin each fact's shape independently so it cannot.
  assert.strictEqual(FACT_1.split('\n').length, 1,
    `FR250 fact (i) is no longer a single line — AC5's "exactly three things" is pinned by ` +
    `line shape as well as by the equality above:\n${FACT_1}`);
  assert.strictEqual(FACT_2.split('\n').length, 2,
    `FR250 fact (ii) is no longer exactly two lines:\n${FACT_2}`);
  assert.strictEqual(FACT_3.split('\n').length, 2,
    `FR250 fact (iii) is no longer exactly two lines:\n${FACT_3}`);
  assert.strictEqual(para.lines.length, 6,
    `the notice is ${para.lines.length} lines, expected 6 (1 + agent list + 2 + 2)`);

  // Line counts alone still let a fourth statement be appended to a fact ON AN
  // EXISTING LINE — verified: a mutant appending ` This arrangement is temporary
  // and will be revisited.` to fact (iii) survived every assertion above, the
  // source-side closed set, and the tone denylist. AC5's unit is a STATEMENT, so
  // the sentence count is pinned too: one statement per fact means three facts
  // are three things. Rewording inside a sentence stays green; adding a sentence
  // does not. Fact (i) ends in the colon that introduces the agent list, so it
  // carries no terminator of its own.
  const sentences = t => (t.replace(/\s+/g, ' ').match(/[.!?](?=\s|$)/g) || []).length;
  assert.strictEqual(sentences(FACT_1), 0,
    `FR250 fact (i) now ends a sentence of its own; it is the lead-in to the agent list and ` +
    `ends with a colon. AC5 caps the notice at three statements.\n${FACT_1}`);
  assert.strictEqual(sentences(FACT_2), 1,
    `FR250 fact (ii) is ${sentences(FACT_2)} sentences, expected exactly 1 — a statement was ` +
    `added to or removed from the notice.\n${FACT_2}`);
  assert.strictEqual(sentences(FACT_3), 1,
    `FR250 fact (iii) is ${sentences(FACT_3)} sentences, expected exactly 1 — a statement was ` +
    `added to or removed from the notice.\n${FACT_3}`);
});

test('31.12 AC5/AC6 — the notice block prints exactly four things, and they are the three facts', () => {
  const block = noticeBlockSource();
  const prints = block.split('\n').map(l => l.trim()).filter(l =>
    /^console\.(log|info|warn|error)\(/.test(l) || /process\.stdout\.write|process\.stderr\.write/.test(l));
  assert.deepStrictEqual(prints, [
    'console.log(chalk.cyan(`\\n${GLOBAL_BMAD_SCOPE_NOTICE_FACT_1}`));',
    "console.log(chalk.cyan(`    ${bmadAgentIds.join(', ')}`));",
    'console.log(chalk.gray(GLOBAL_BMAD_SCOPE_NOTICE_FACT_2));',
    'console.log(chalk.gray(GLOBAL_BMAD_SCOPE_NOTICE_FACT_3));',
  ],
    `the FR250 notice block no longer emits exactly the four expected prints over the three ` +
    `exported facts. AC5 caps what the installer reports at three things; an added print is a ` +
    `fourth, wherever it lands and whatever it says — including one that starts with its own ` +
    `newline and so would form a paragraph the emitted-output test cannot reach. An inlined ` +
    `literal in place of a constant is caught here too, because it would leave the constant ` +
    `unprinted and the shipped text unbound from the test.\n\nblock was:\n${block}`);
});

// ─── 31.12 AC5, fix round — the BEHAVIOURAL half: BMAD stays project-scoped ──
//
// Review finding F-2: AC5 is "ma-agents skills install globally AND BMAD remains
// project-scoped". Nothing in this suite asserted the second half, so deleting
//
//     selectedAgentIds = selectedAgentIds.filter(id => !bmadAgentIds.includes(id));
//
// left the suite 22/0 while a global install actually carried the BMAD agents —
// the notice telling the user they "are not part of a global install" while they
// were. The assertion below reads the post-filter agent set out of the Summary
// block the wizard prints AFTER that filter runs, and requires equality with the
// non-BMAD registry entries: it therefore cannot pass by installing nothing, and
// cannot pass by installing only a subset.

test('31.12 AC5 — a global install carries EVERY non-BMAD agent and NOT ONE BMAD agent', () => {
  assert.ok(BMAD_AGENT_IDS.length >= 1,
    'the registry declares no category:"bmad" agent, so this test has nothing to exclude and ' +
    'would pass vacuously');
  assert.ok(NON_BMAD_AGENT_IDS.length >= 2,
    'the registry declares fewer than two non-BMAD agents — the positive half is too thin');

  const installed = summaryAgentIds(globalRun.output);
  // POSITIVE half first and as an EQUALITY: "excludes BMAD" is satisfied by an
  // install that carried nothing at all, so the set is pinned in both directions.
  assert.deepStrictEqual([...installed].sort(), [...NON_BMAD_AGENT_IDS].sort(),
    `a global install proceeded with agent set [${installed.join(', ')}], expected exactly the ` +
    `non-BMAD registry entries [${NON_BMAD_AGENT_IDS.join(', ')}]. If BMAD ids are present the ` +
    `global BMAD filter in bin/cli.js is gone and the FR250 notice now contradicts what the ` +
    `installer actually did; if non-BMAD ids are missing, the global install stopped carrying ` +
    `the skills AC5's first half is about.`);
  for (const id of BMAD_AGENT_IDS) {
    assert.ok(!installed.includes(id),
      `the global install proceeded with BMAD agent '${id}'. AC5: BMAD remains project-scoped, ` +
      `and the notice printed above tells the user in so many words that it is not part of a ` +
      `global install.`);
  }

  // The installer's own refusal path. Every category:'bmad' agent resolves
  // getGlobalPath() to null, so an UNFILTERED id does not silently vanish — it
  // reaches installSkill and is turned away there with a yellow warning. Its
  // absence is independent evidence that no BMAD id was ever handed over.
  assert.ok(INSTALLER_SOURCE.includes("does not support ${scope} installation, skipping"),
    'the installer refusal line this assertion keys on is gone from lib/installer.js — the ' +
    'anchor is stale and the check below proves nothing');
  for (const agent of BMAD_AGENTS) {
    assert.ok(!globalRun.output.includes(
      `Warning: Agent '${agent.name}' does not support global installation, skipping`),
      `the global install handed BMAD agent '${agent.id}' to the installer, which refused it. ` +
      `AC5 requires it never be selected for a global install in the first place.`);
  }

  // And "carried" must mean "installed", not merely "listed in a summary". Check
  // the sandbox at the paths the installer itself resolved, with HOME redirected.
  const resolved = resolveGlobalPaths(globalBox.homeRoot);
  const byId = new Map(resolved.map(r => [r.id, r]));
  const sandbox = path.resolve(globalBox.homeRoot).toLowerCase();
  let dirsWithSkills = 0;
  for (const id of NON_BMAD_AGENT_IDS) {
    const gp = byId.get(id) && byId.get(id).globalPath;
    if (!gp) continue;
    assert.ok(path.resolve(gp).toLowerCase().startsWith(sandbox),
      `agent '${id}' resolved its global path to ${gp}, outside the sandbox ${globalBox.homeRoot} ` +
      `— HOME/USERPROFILE redirection is not taking effect and this check is looking at the ` +
      `wrong machine state`);
    if (walk(gp).some(f => path.basename(f) === 'SKILL.md')) dirsWithSkills++;
  }
  assert.ok(dirsWithSkills >= 3,
    `only ${dirsWithSkills} non-BMAD agents have real SKILL.md files under their resolved ` +
    `global directory. The agent-set equality above must be backed by an install that actually ` +
    `happened, or "excludes BMAD" would be satisfiable by installing nothing.`);
  for (const agent of BMAD_AGENTS) {
    assert.strictEqual(byId.get(agent.id).globalPath, null,
      `agent '${agent.id}' now declares a global install path (${byId.get(agent.id).globalPath}). ` +
      `The premise of this whole story is that BMAD is project-scoped; if that changed, FR250's ` +
      `notice is stale and the filter it describes is no longer correct behaviour.`);
  }
});

// ─── 31.12, fix round — the zero-BMAD-agent case ────────────────────────────
//
// `bin/cli.js` guards the notice on `bmadAgentIds.length > 0`, so a global
// install that selects no BMAD agent prints no notice at all. That is the
// CORRECT behaviour and it is pinned here rather than left to inference: the
// notice exists to name the specific agents that were dropped and explain their
// absence ("...so these BMAD agents are not part of a global install: <ids>").
// With none selected there is nothing to name — the message would be a
// non-sequitur about agents the user never asked for, and AC6's "not alarming"
// bar is best met by not raising a subject that does not apply. AC5 requires the
// installer to report the degradation, and no BMAD agent selected is not a
// degradation. This run is also the control for the closed-set test above: it
// proves the notice is CONDITIONAL, so "the notice appeared" in the --yes run is
// a fact about that run and not something the binary prints unconditionally.

console.log('\nStory 31.12 fix round — a global install that selects NO BMAD agent');

const noBmadBox = makeSandbox('nobmad');
const noBmadRun = runInstall({
  ...noBmadBox, extraArgs: ['--global', '--agent', 'claude-code'],
});

test('31.12 AC5 — selecting no BMAD agent installs globally and prints no FR250 notice', () => {
  assert.notStrictEqual(noBmadRun.status, null,
    `the --agent claude-code global install did not exit within the timeout ` +
    `(signal ${noBmadRun.signal})`);
  assert.strictEqual(noBmadRun.status, 0,
    `\`install --yes --global --agent claude-code\` exited ${noBmadRun.status}. Every absence ` +
    `assertion below would pass trivially on a failed install.\n${noBmadRun.output.slice(-3000)}`);

  // Anti-vacuity: it really installed, and it really selected one non-BMAD agent.
  assert.deepStrictEqual(summaryAgentIds(noBmadRun.output), ['claude-code'],
    'the --agent preselection did not survive to the Summary, so this run is not the ' +
    'zero-BMAD-agent case it claims to be');
  assert.ok(walk(noBmadBox.homeRoot).filter(f => path.basename(f) === 'SKILL.md').length >= 20,
    `this run installed nothing globally, so "printed no notice" is not evidence about the ` +
    `notice.\n${noBmadRun.output.slice(-2000)}`);

  assert.strictEqual(noticeParagraph(noBmadRun.output), null,
    `a global install that selected no BMAD agent still printed the FR250 notice, which names ` +
    `"these BMAD agents" and then has none to name.\n${noBmadRun.output.slice(-3000)}`);
  assert.ok(!noBmadRun.output.includes('BMAD-METHOD is installed per project'),
    'the FR250 notice leaked into a run with no BMAD agent selected');

  // The guard that makes it conditional, pinned so the behaviour above is read
  // as deliberate rather than as an accident of this particular invocation.
  assert.ok(noticeBlockSource().includes('if (bmadAgentIds.length > 0) {'),
    'the notice is no longer guarded on there being BMAD agents to name');

  // FR251 still holds on this path: no project was in scope.
  assert.deepStrictEqual(walk(noBmadBox.projectRoot), [],
    'the --agent form of a global install wrote into the project root');
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

// ─── Story 31.12 AC7 / NFR83 — resolution from the project root ALONE ───────
//
// NFR83: a globally-installed skill must resolve a bound project's topology from
// the project root alone, with no per-machine install state. `resolveProjectTopology`
// is the binding resolver.
//
// Three things make this non-vacuous, because "a function returned something" is
// not evidence:
//
//   1. The binding under test is a REAL `_bmad-output/project-layout.yaml`
//      produced by the control project install above — not a fixture written by
//      this test to a shape the resolver happens to like.
//   2. It is resolved from a PRISTINE directory containing that one file and
//      nothing else: no `_bmad/`, no `.ma-agents.json`, no `.agents/`, no
//      MANIFEST — and in a child process whose HOME/USERPROFILE point at an
//      empty directory, so no per-machine install state is reachable even in
//      principle. That is the actual NFR83 claim.
//   3. A CONTROL resolves an empty sibling directory through the identical
//      child process and must come back `ok:false, reason:'unbound'`. Without
//      it, a resolver that returned `ok:true` for anything at all would pass.
//      This epic's signature defect is validation that degrades to permissive,
//      so the negative case is the half that carries the weight.

console.log('\nStory 31.12 AC7 / NFR83 — topology resolves from the project root alone');

test('31.12 AC7 / NFR83 — a bound project resolves with no install state, and an unbound one does not', () => {
  const sourceLayout = path.join(projectBox.projectRoot, '_bmad-output', 'project-layout.yaml');
  assert.ok(fs.existsSync(sourceLayout),
    'the control project install produced no project-layout.yaml, so there is no real binding ' +
    'to resolve and this test would be asserting about a fixture of its own making');
  const layoutBytes = fs.readFileSync(sourceLayout, 'utf-8');
  assert.ok(/\S/.test(layoutBytes.replace(/^\s*#.*$/gm, '')),
    'the committed binding is empty or comment-only — resolving it would prove nothing');

  const box = makeSandbox('nfr83');
  const boundRoot = path.join(box.root, 'bound');
  const unboundRoot = path.join(box.root, 'unbound');
  const emptyHome = path.join(box.root, 'empty-home');
  fs.mkdirSync(path.join(boundRoot, '_bmad-output'), { recursive: true });
  fs.mkdirSync(unboundRoot, { recursive: true });
  fs.mkdirSync(emptyHome, { recursive: true });
  fs.writeFileSync(path.join(boundRoot, '_bmad-output', 'project-layout.yaml'), layoutBytes);

  // The pristine root carries the binding and NOTHING else.
  assert.deepStrictEqual(
    walk(boundRoot).map(f => path.relative(boundRoot, f).replace(/\\/g, '/')).sort(),
    ['_bmad-output', '_bmad-output/project-layout.yaml'],
    'the NFR83 sandbox is not pristine — resolution could be leaning on some other artifact'
  );
  for (const rel of ['_bmad', '.ma-agents.json', '.agents', 'AGENTS.md', 'MANIFEST.yaml']) {
    assert.ok(!fs.existsSync(path.join(boundRoot, rel)),
      `the NFR83 sandbox contains ${rel}; NFR83 is about resolving WITHOUT it`);
  }

  // Resolve out-of-process with HOME/USERPROFILE redirected at an empty dir, so
  // this machine's real global install cannot contribute anything.
  const probe = path.join(box.root, 'probe.js');
  fs.writeFileSync(probe, [
    "const { resolveProjectTopology } = require(process.argv[2]);",
    "process.stdout.write(JSON.stringify(resolveProjectTopology(process.argv[3])));",
  ].join('\n'));

  const resolveIn = (root) => {
    const env = { ...process.env };
    for (const k of LAYOUT_ENV_KEYS) delete env[k];
    env.HOME = emptyHome;
    env.USERPROFILE = emptyHome;
    const res = spawnSync(process.execPath, [probe, CLI_PATH, root], {
      cwd: root, env, encoding: 'utf-8', timeout: 120000,
    });
    assert.strictEqual(res.status, 0,
      `the NFR83 probe exited ${res.status} for ${root} — resolveProjectTopology must never ` +
      `throw.\n${res.stdout}\n${res.stderr}`);
    return JSON.parse(res.stdout);
  };

  const bound = resolveIn(boundRoot);
  assert.strictEqual(bound.ok, true,
    `a committed binding did not resolve from the project root alone: ` +
    `${JSON.stringify(bound)}\nlayout was:\n${layoutBytes}`);
  assert.ok(bound.topology && typeof bound.topology === 'object', 'resolved without a topology');
  assert.ok(Number.isInteger(bound.topology.schemaVersion) && bound.topology.schemaVersion >= 1,
    `resolved topology has no usable schemaVersion: ${JSON.stringify(bound.topology)}`);
  // The stores are the payload NFR83 exists for; an `ok:true` carrying nothing
  // usable would satisfy the flag and fail the requirement.
  for (const key of ['systemRequirementsStore', 'softwareRequirementsStore']) {
    const store = bound.topology[key];
    assert.ok(store && typeof store === 'object' && Object.keys(store).length > 0,
      `resolved topology carries no ${key}, so nothing was actually resolved: ` +
      JSON.stringify(bound.topology));
  }

  // THE CONTROL. Same probe, same empty HOME, no committed binding.
  const unbound = resolveIn(unboundRoot);
  assert.strictEqual(unbound.ok, false,
    `an EMPTY directory resolved successfully (${JSON.stringify(unbound)}). The resolver is ` +
    `permissive, so the positive case above proves nothing.`);
  assert.strictEqual(unbound.reason, 'unbound',
    `an unbound project reported reason ${JSON.stringify(unbound.reason)}, expected 'unbound'`);
  assert.ok(typeof unbound.message === 'string' && unbound.message.length > 0,
    'the unbound result carries no message for a caller to report');
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
