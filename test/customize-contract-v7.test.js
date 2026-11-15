#!/usr/bin/env node
/**
 * Story 36.4 — customize.toml contract validator for BMAD v7 (FR303, FR290, FR291;
 * Decisions P5-11.3, P5-11.4).
 *
 * Node wrapper around scripts/validate_customize.py. Both the validator and the pinned
 * upstream scripts (resolve_customization.py, render_skill.py) are spawned through uv
 * with `run --no-cache` and an argv array — never a shell string.
 *
 * Prerequisites (missing → the test FAILS with a prerequisite message; it never skips):
 *   - uv on PATH;
 *   - the pinned BMAD v7 tree: $BMAD_V7_TREE, else bundle/bmad-method/ (Story 36.3).
 *     Until 36.3 lands, point BMAD_V7_TREE at a checkout of bmadRef.core (e734d3a).
 * render_skill.py declares jinja2: uv resolves it from the index online, or from the
 * wheelhouse (UV_FIND_LINKS / UV_OFFLINE) offline.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'validate_customize.py');
const FIX = path.join(ROOT, 'test', 'fixtures', 'customize-v7');
const MEMBERS = path.join(FIX, 'skills');
const PROJECTS = path.join(FIX, 'projects');
const TREE = path.resolve(process.env.BMAD_V7_TREE || path.join(ROOT, 'bundle', 'bmad-method'));
const UV = 'uv';

let passed = 0;
let failed = 0;
const errors = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'customize-v7-test-'));

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

function finish() {
  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, err }) => console.log(`  ${name}:\n    ${err.message}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

/** Spawn a Python script through uv: argv array, no shell, nothing quoted by hand. */
function uvScript(script, args, options = {}) {
  return spawnSync(UV, ['run', '--no-cache', ...(options.uvArgs || []), script, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function validate(args, options) {
  const r = uvScript(VALIDATOR, ['--tree', TREE, '--json', ...args], options);
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (_) {
    /* asserted by callers */
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function codes(json) {
  return json.findings.map((f) => f.code);
}

function findingsText(json) {
  return json ? json.findings.map((f) => `${path.basename(f.file)}:${f.line} [${f.code}] ${f.message}`).join('\n') : '';
}

function copyTree(from, name) {
  const to = path.join(scratch, name);
  fs.cpSync(from, to, { recursive: true });
  return to;
}

function upstream(...parts) {
  return path.join(TREE, 'skills', ...parts);
}

console.log('\nStory 36.4: customize.toml contract validator (BMAD v7)\n');

// ─────────────────────────────────────────────────────────────── prerequisites
console.log('Prerequisites (fail, never skip)');
const uvProbe = spawnSync(UV, ['--version'], { encoding: 'utf8' });
const uvOk = !uvProbe.error && uvProbe.status === 0;
const treeOk = fs.existsSync(upstream('bmad', 'scripts', 'resolve_customization.py'));
test('uv is on PATH', () => {
  assert.ok(uvOk, `prerequisite: uv not found on PATH (${uvProbe.error ? uvProbe.error.code : uvProbe.stderr}); install uv 0.13+`);
});
test('the pinned BMAD v7 tree is present', () => {
  assert.ok(treeOk,
    `prerequisite: no BMAD v7 tree at ${TREE} (skills/bmad/scripts/resolve_customization.py missing); ` +
    'set BMAD_V7_TREE to a checkout of bmadRef.core, or build bundle/bmad-method/ (Story 36.3)');
});
if (!uvOk || !treeOk) finish();

// ───────────────────────────────────────────────────────────────────────── AC1
console.log('\nAC1: the real v7 resolver, through uv run --no-cache');
const validatorSrc = fs.readFileSync(VALIDATOR, 'utf8');

test('validator has a PEP 723 header, requires-python >=3.11, no dependencies', () => {
  const header = validatorSrc.match(/# \/\/\/ script\r?\n([\s\S]*?)# \/\/\/\r?\n/);
  assert.ok(header, 'no PEP 723 block');
  assert.match(header[1], /^# requires-python = ">=3\.11"\r?$/m);
  assert.doesNotMatch(header[1], /dependencies/, 'the validator must stay standard-library only');
});

test('validator imports only the standard library (--self-check)', () => {
  const r = uvScript(VALIDATOR, ['--self-check']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout).third_party_imports, []);
});

test('validator spawns upstream scripts as an argv array [uv, run, --no-cache, script, ...]', () => {
  assert.match(validatorSrc, /argv = \[find_uv\(\), "run", "--no-cache", str\(script\), \*args\]/);
  assert.match(validatorSrc, /subprocess\.run\(argv,/);
  assert.doesNotMatch(validatorSrc, /shell=True/);
});

test('validator locates resolve_customization.py in the tree and extracts the placeholder set', () => {
  const r = uvScript(VALIDATOR, ['--tree', TREE, '--print-placeholders']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('m4: a tree path that does not exist fails loudly (exit 2, prerequisite message)', () => {
  const missing = path.join(scratch, 'no-such-tree');
  const r = uvScript(VALIDATOR, ['--tree', missing, '--skills-root', MEMBERS]);
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /^prerequisite: BMAD v7 tree not found at .*no-such-tree/m);
});

test('no uv on PATH inside the validator fails loudly (exit 2, prerequisite message)', () => {
  const py = spawnSync(UV, ['python', 'find', '>=3.11'], { encoding: 'utf8' });
  assert.strictEqual(py.status, 0, py.stderr);
  const nodeDir = path.dirname(process.execPath);
  const env = { ...process.env, PATH: nodeDir, Path: nodeDir };
  const uvAbs = spawnSync(process.platform === 'win32' ? 'where' : 'which', [UV], { encoding: 'utf8' }).stdout.split(/\r?\n/)[0].trim();
  const r = spawnSync(uvAbs, ['run', '--no-cache', '--python', py.stdout.trim(), VALIDATOR, '--tree', TREE, '--classify', 'a', 'b', 'c'],
    { encoding: 'utf8', env });
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /prerequisite: uv not found on PATH/);
});

// ─────────────────────────────────────────────────────────────────── AC2 / AC3
console.log('\nAC2/AC3: member table shape, resolution, explicit persistent_facts (--skills-root)');
const members = validate(['--skills-root', MEMBERS, '--render']);

test('the four member kinds pass, each resolved through the pinned resolver', () => {
  assert.ok(members.json, members.stdout + members.stderr);
  assert.strictEqual(members.status, 0, findingsText(members.json));
  assert.strictEqual(members.json.ok, true);
  assert.strictEqual(members.json.members.length, 4, 'one member per kind the four modules ship');
  const kinds = Object.fromEntries(members.json.members.map((m) => [m.skill, m.kind]));
  assert.deepStrictEqual(kinds, {
    'ma-agent-sre': 'agent',
    'ma-atlassian-bind': 'workflow',
    'ma-knowledge-atlas': 'workflow',
    'ma-ops-dev-epic': 'workflow',
  });
  assert.strictEqual(members.json.resolver_calls, 4);
  const sre = members.json.members.find((m) => m.skill === 'ma-agent-sre');
  assert.deepStrictEqual(sre.resolved_keys, ['agent', 'workflow']);
});

function mutateMember(name, skill, edit) {
  const root = copyTree(MEMBERS, name);
  const file = path.join(root, skill, 'customize.toml');
  fs.writeFileSync(file, edit(fs.readFileSync(file, 'utf8')));
  return validate(['--skills-root', root]);
}

test('m1: a duplicate key in a member customize.toml fails AC2, naming the file', () => {
  const r = mutateMember('m1', 'ma-ops-dev-epic', (t) => t.replace('on_epic_complete = ""', 'on_epic_complete = ""\non_epic_complete = "again"'));
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const parse = r.json.findings.find((f) => f.code === 'parse');
  assert.ok(parse, findingsText(r.json));
  assert.match(parse.file, /ma-ops-dev-epic\/customize\.toml$/);
});

test('m2: persistent_facts moved from [agent] to [workflow] in the agent fails AC2/AC3', () => {
  const r = mutateMember('m2', 'ma-agent-sre', (t) => {
    // `\r?`: a Windows checkout (core.autocrlf=true) holds the fixture with CRLF (Story 36.6 chain run).
    const facts = t.match(/persistent_facts = \[[\s\S]*?\r?\n\]\r?\n/)[0];
    return t.replace(facts, '') + facts;
  });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const c = codes(r.json);
  assert.ok(c.includes('facts-missing') && c.includes('wrong-table'), findingsText(r.json));
  const wrong = r.json.findings.find((f) => f.code === 'wrong-table');
  assert.match(wrong.file, /ma-agent-sre\/customize\.toml$/);
  assert.deepStrictEqual([wrong.table, wrong.key], ['workflow', 'persistent_facts']);
});

test('an empty persistent_facts fails AC3', () => {
  const r = mutateMember('facts-empty', 'ma-knowledge-atlas', (t) => t.replace(/persistent_facts = \[[\s\S]*?\n\]/, 'persistent_facts = []'));
  assert.strictEqual(r.status, 1);
  assert.ok(codes(r.json).includes('facts-empty'), findingsText(r.json));
});

// ───────────────────────────────────────────────────────────────────────── AC4
console.log('\nAC4: slot classifier reads the tree at run time');

function classify(skill, table, key) {
  const r = uvScript(VALIDATOR, ['--tree', TREE, '--classify', skill, table, key]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).classification;
}

for (const [skill, table, key, expected] of [
  ['bmad-agent-po', 'agent', 'persistent_facts', 'defined'],
  ['bmad-agent-po', 'workflow', 'board_after', 'defined'],
  ['bmad-agent-po', 'workflow', 'activation_steps_prepend', 'undefined'], // m5
  ['bmad-agent-po', 'workflow', 'board_afterr', 'undefined'],
  ['bmad-sprint-planning', 'workflow', 'on_complete', 'retired'],
  ['bmad-sprint-planning', 'agent', 'anything_at_all', 'retired'],
]) {
  test(`classify(${skill}, ${table}, ${key}) → ${expected}`, () => {
    assert.strictEqual(classify(skill, table, key), expected);
  });
}

test('the validator types no slot name as a literal', () => {
  for (const slot of ['external_sources', 'external_handoffs', 'on_complete', 'board_after', 'store_after']) {
    assert.ok(!validatorSrc.includes(slot), `validator source names the slot ${slot}`);
  }
});

// ───────────────────────────────────────────────────────────────────────── AC5
console.log('\nAC5: the bind target table holds at the pinned tree');
// Expected values: Story 36.1 AC10 key matrix (FR290 / P5-11.4). The classifier reads the
// tree; this table only checks it.
const BIND_TABLE = [
  ...['bmad-prd', 'bmad-architecture', 'bmad-facilitate'].flatMap((s) => [
    [s, 'workflow', 'external_sources'],
    [s, 'workflow', 'external_handoffs'],
  ]),
  ...['bmad-ux', 'bmad-product-brief', 'bmad-prfaq'].map((s) => [s, 'workflow', 'on_complete']),
  ...['bmad-build', 'bmad-build-auto', 'bmad-code-review', 'bmad-retrospective'].map((s) => [s, 'workflow', 'activation_steps_prepend']),
  ['bmad-agent-po', 'agent', 'persistent_facts'],
  ['bmad-agent-po', 'workflow', 'board_after'],
  ['bmad-agent-po', 'workflow', 'store_after'],
];
const bindRows = validate(['--custom-dir', path.join(PROJECTS, 'bind-rows', '_bmad', 'custom')]);

test('every bind-rows fixture parses, brackets its keys and resolves (validator exit 0)', () => {
  assert.ok(bindRows.json, bindRows.stdout + bindRows.stderr);
  assert.strictEqual(bindRows.status, 0, findingsText(bindRows.json));
  assert.strictEqual(bindRows.json.overrides.length, 11);
});

test('the fixtures own exactly the rows of the bind target table', () => {
  const owned = bindRows.json.overrides.flatMap((o) => o.owned.map((e) => `${o.skill} ${e.table}.${e.key}`)).sort();
  assert.deepStrictEqual(owned, BIND_TABLE.map(([s, t, k]) => `${s} ${t}.${k}`).sort());
});

for (const [skill, table, key] of BIND_TABLE) {
  test(`${skill} [${table}] ${key}: defined at the tree, and the resolver returns ours`, () => {
    const state = classify(skill, table, key);
    assert.strictEqual(state, 'defined', `bind target ${skill} [${table}] ${key} is ${state} at ${TREE}`);
    const o = bindRows.json.overrides.find((x) => x.skill === skill);
    const e = o.owned.find((x) => x.table === table && x.key === key);
    assert.strictEqual(e.classification, 'defined');
    assert.strictEqual(o.resolved[`${table}.${key}`], true, `resolver did not return our ${table}.${key} for ${skill}`);
    const text = fs.readFileSync(o.file, 'utf8');
    assert.match(text, new RegExp(`^# ma-atlassian:start ${table}\\.${key}\\r?$`, 'm'));
  });
}

// ───────────────────────────────────────────────────────────────────────── AC6
console.log('\nAC6: override output mode (--custom-dir)');

function project(name) {
  return validate(['--custom-dir', path.join(PROJECTS, name, '_bmad', 'custom')]);
}

test('a valid file with several owned keys (and the Sofia store file) passes', () => {
  const r = project('valid-multi');
  assert.strictEqual(r.status, 0, findingsText(r.json));
  const po = r.json.overrides.find((o) => o.skill === 'bmad-agent-po');
  assert.strictEqual(po.owned.length, 3);
  assert.ok(Object.values(po.resolved).every(Boolean), JSON.stringify(po.resolved));
  const store = r.json.overrides.find((o) => o.file.endsWith('ticketing-store-config.toml'));
  assert.strictEqual(store.owned.length, 4);
});

test('a user [workflow] table with an owned key inserted into it passes; the resolver returns both keys', () => {
  const r = project('user-workflow');
  assert.strictEqual(r.status, 0, findingsText(r.json));
  const o = r.json.overrides[0];
  assert.deepStrictEqual(o.resolved, { 'workflow.on_complete': true, 'workflow.activation_steps_prepend': true });
  const text = fs.readFileSync(o.file, 'utf8');
  assert.strictEqual((text.match(/^\[workflow\]\r?$/gm) || []).length, 1, 'no second [workflow] header');
});

for (const [name, code, file, line] of [
  ['neg-unbalanced', 'marker-unbalanced', 'bmad-build.toml', 3],
  ['neg-nested', 'marker-nested', 'bmad-agent-po.toml', 5],
  ['neg-two-keys', 'marker-pair-keys', 'bmad-agent-po.toml', 3],
  ['neg-key-two-pairs', 'marker-duplicate-key', 'bmad-agent-po.toml', 6],
  ['neg-board-afterr', 'slot-undefined', 'bmad-agent-po.toml', 4],
  ['neg-po-prepend', 'slot-undefined', 'bmad-agent-po.toml', 4], // m5
  ['neg-retired', 'slot-retired', 'bmad-sprint-planning.toml', 4],
]) {
  test(`${name} fails with [${code}] at ${file}:${line}`, () => {
    const r = project(name);
    assert.strictEqual(r.status, 1, r.stdout + r.stderr);
    const hit = r.json.findings.find((f) => f.code === code);
    assert.ok(hit, findingsText(r.json));
    assert.strictEqual(path.basename(hit.file), file);
    assert.strictEqual(hit.line, line);
  });
}

// ───────────────────────────────────────────────────────────────────────── AC7
console.log('\nAC7: no undefined variables');
const placeholders = JSON.parse(uvScript(VALIDATOR, ['--tree', TREE, '--print-placeholders']).stdout);

test('the placeholder set is extracted from render_skill.py / resolve_config.py', () => {
  for (const name of ['workflow', 'agent', 'config', 'rendered']) assert.ok(placeholders.jinja.includes(name), name);
  for (const name of ['project-root', 'skill-root']) assert.ok(placeholders.single.includes(name), name);
  for (const name of placeholders.single) {
    assert.ok(!validatorSrc.includes(`{${name}}`), `validator types the placeholder {${name}}`);
  }
});

test('render_skill.py hard-exits on an undefined variable, and the validator reports it', () => {
  const r = validate(['--skills-root', path.join(FIX, 'negative', 'undefined-placeholder', 'skills'), '--render']);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const where = r.json.findings.filter((f) => f.code === 'placeholder-undefined').map((f) => `${path.basename(f.file)}:${f.line}`);
  assert.deepStrictEqual(where.sort(), ['customize.toml:6', 'workflow.md:9']);
  const halt = r.json.findings.find((f) => f.code === 'render-halt');
  assert.ok(halt, findingsText(r.json));
  assert.match(halt.message, /HALT: workflow\.md:9: 'ticket_url' is undefined/);
});

test('every member fixture renders with the pinned render_skill.py (exit 0)', () => {
  assert.deepStrictEqual(members.json.rendered.map((x) => [x.skill, x.exit]),
    [['ma-agent-sre', 0], ['ma-atlassian-bind', 0], ['ma-knowledge-atlas', 0], ['ma-ops-dev-epic', 0]]);
});

test('v7 renders persistent_facts with {project-root} left for the agent to bind', () => {
  const sre = members.json.rendered.find((x) => x.skill === 'ma-agent-sre');
  assert.match(sre.output, /^- file:\{project-root\}\/\*\*\/project-context\.md\r?$/m);
  assert.match(sre.output, /read `file:` globs under `\{project-root\}`/);
});

test('shell scripts under skills/**/scripts/ are excluded by path', () => {
  const sh = fs.readFileSync(path.join(MEMBERS, 'ma-ops-dev-epic', 'scripts', 'container-status.sh'), 'utf8');
  assert.ok(sh.includes('{{.Names}}'), 'the fixture carries a Docker --format string');
  assert.strictEqual(members.json.ok, true);
});

// ───────────────────────────────────────────────────────────────────────── AC8
console.log('\nAC8: {diff_file} only');

test('a planted {diff_output} in a member customize.toml fails (positive control)', () => {
  const r = validate(['--skills-root', path.join(FIX, 'negative', 'diff-output', 'skills')]);
  assert.strictEqual(r.status, 1);
  const hit = r.json.findings.find((f) => f.code === 'diff-output');
  assert.ok(hit, findingsText(r.json));
  assert.deepStrictEqual([path.basename(hit.file), hit.line], ['customize.toml', 10]);
});

test('a {diff_output} in an override fails', () => {
  const r = project('neg-diff-output');
  assert.strictEqual(r.status, 1);
  const hit = r.json.findings.find((f) => f.code === 'diff-output');
  assert.deepStrictEqual([path.basename(hit.file), hit.line], ['bmad-code-review.toml', 4]);
});

test('m3: {diff_output} planted into a passing member makes it fail', () => {
  const root = copyTree(MEMBERS, 'm3');
  const md = path.join(root, 'ma-knowledge-atlas', 'workflow.md');
  fs.appendFileSync(md, '\nRead the diff at {diff_output}.\n');
  const r = validate(['--skills-root', root]);
  assert.strictEqual(r.status, 1);
  assert.ok(r.json.findings.some((f) => f.code === 'diff-output' && f.file.endsWith('ma-knowledge-atlas/workflow.md')), findingsText(r.json));
});

// ───────────────────────────────────────────────────────────────────────── AC9
console.log('\nAC9: undeclared keys fail; parse failure recorded');

test('the validator fails on [workflow] ma_unknown_key, naming file, table and key', () => {
  const r = project('neg-undeclared');
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const hit = r.json.findings.find((f) => f.code === 'undeclared-key');
  assert.ok(hit, findingsText(r.json));
  assert.deepStrictEqual([path.basename(hit.file), hit.line, hit.table, hit.key], ['bmad-build.toml', 3, 'workflow', 'ma_unknown_key']);
});

const undeclared = copyTree(path.join(PROJECTS, 'neg-undeclared'), 'neg-undeclared');
test('upstream at the tree: resolve_customization.py exits 0 and returns the undeclared key', () => {
  const r = uvScript(upstream('bmad', 'scripts', 'resolve_customization.py'),
    ['--skill', upstream('bmad-build'), '--project-root', undeclared, '--key', 'workflow.ma_unknown_key']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout), { 'workflow.ma_unknown_key': 'MA-UNKNOWN-KEY-SENTINEL' });
});

test('upstream at the tree: render_skill.py exits 1 with the HALT line (render_skill.py:121-128)', () => {
  const r = uvScript(upstream('bmad', 'scripts', 'render_skill.py'), ['--project-root', undeclared, '--skill', upstream('bmad-build')]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^HALT: .*bmad-build\.toml sets keys bmad-build does not declare: workflow\.ma_unknown_key\r?$/m);
});

test('m6 guard: the undeclared-key fixture fails only through the undeclared-key check', () => {
  const r = project('neg-undeclared');
  assert.deepStrictEqual(codes(r.json), ['undeclared-key']);
});

const malformed = copyTree(path.join(PROJECTS, 'neg-malformed-prd'), 'neg-malformed-prd');
test('a malformed _bmad/custom/bmad-prd.toml fails the validator with file and line', () => {
  const r = project('neg-malformed-prd');
  assert.strictEqual(r.status, 1);
  const hit = r.json.findings.find((f) => f.code === 'parse');
  assert.deepStrictEqual([path.basename(hit.file), hit.line], ['bmad-prd.toml', 3]);
});

test('upstream at the tree: resolve_customization.py exits 1 on the malformed bmad-prd.toml', () => {
  const r = uvScript(upstream('bmad', 'scripts', 'resolve_customization.py'),
    ['--skill', upstream('bmad-prd'), '--project-root', malformed, '--key', 'workflow.external_sources']);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.strictEqual(r.stdout, '');
  assert.match(r.stderr, /^error: failed to parse .*bmad-prd\.toml: .*\(at line 3, column \d+\)\r?$/m);
});

test('upstream at the tree: render_skill.py exits 1 for bmad-prd before reading the override (no workflow.md)', () => {
  const r = uvScript(upstream('bmad', 'scripts', 'render_skill.py'), ['--project-root', malformed, '--skill', upstream('bmad-prd')]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^HALT: render entry is missing: .*bmad-prd[\\/]workflow\.md\r?$/m);
});

finish();
