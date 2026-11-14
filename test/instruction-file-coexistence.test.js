#!/usr/bin/env node
/**
 * Story 36.5 — instruction-file coexistence: the `ma-agents`, `ma-standards`
 * and upstream `bmad-project-context` blocks in one file (FR301, NFR46, NFR49;
 * Decision P5-11.10).
 *
 * Writers under test:
 *   - ma-agents     lib/inject/marker-block.js with MA_AGENTS_MARKERS (39.2 adopts it)
 *   - ma-standards  test/helpers/ma-standards-apply.js (37.2 adopts it)
 *   - upstream      simulateUpstreamSplice() below: models the agent's splice
 *                   (bmad-project-context SKILL.md:72 at e734d3a) — replaces only
 *                   the lines between its two markers, or appends the marked
 *                   block, and touches nothing outside them. Its markers and block
 *                   template are READ AT TEST TIME from the pinned
 *                   skills/bmad-project-context/references/template.md: by default
 *                   the committed verbatim copy
 *                   test/fixtures/instruction-file-coexistence/bmad-project-context-template.md
 *                   (git blob f83ed82b…, BMAD-METHOD e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6,
 *                   MIT), or <BMAD_V7_TREE>/skills/bmad-project-context/references/template.md
 *                   when BMAD_V7_TREE is set (36.7 points it at the GA tree). A missing
 *                   file fails the run; there is no fallback text. No upstream marker or
 *                   template text appears in this file (self-checked below).
 *   - reduction     simulateReduction(): the adopt proposal "CLAUDE.md reduced to
 *                   @AGENTS.md" (SKILL.md:97) as both recorded real runs applied it:
 *                   the whole file becomes the import line.
 *
 * AC coverage: AC1 writer contract; AC2 order A; AC3 order B; AC4 six orders x
 * two re-runs with user paragraphs; AC5 idempotence (sha256, no write); AC6
 * removal; AC7 marker non-interference; AC8 CRLF + mixed EOL; AC10 CLAUDE.md with
 * the reduction, .roomodes block form. AC9 is a recorded [RUN] in the story file.
 * AC11 mutants are run by hand (recorded in the story).
 *
 * The case table test/fixtures/instruction-file-coexistence/case-table.json is
 * DATA (inputs, write order, expected bytes as segments) so 37.2 can copy it. It
 * is generated from the reference model in this file (a segment model, not the
 * line-based writer):
 *   node test/instruction-file-coexistence.test.js --write-case-table
 * and every run asserts the committed table equals the model's output.
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const mb = require('../lib/inject/marker-block');
const maStandards = require('./helpers/ma-standards-apply');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'instruction-file-coexistence');
const COMMITTED_TEMPLATE = path.join(FIXTURE_DIR, 'bmad-project-context-template.md');
const CASE_TABLE = path.join(FIXTURE_DIR, 'case-table.json');
const PINNED_BLOB = 'f83ed82bf732d7933506921dbd1dd977d8974404';
const UPSTREAM_REL = path.join('skills', 'bmad-project-context', 'references', 'template.md');

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
  const ok = () => { console.log(`  ✓ ${name}`); passed++; };
  const bad = (err) => { console.error(`  ✗ ${name}: ${err.stack || err.message}`); failed++; };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pending.push(r.then(ok, bad));
    else ok();
  } catch (err) {
    bad(err);
  }
}

const tmpRoots = [];
function mktemp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-coexist-'));
  tmpRoots.push(d);
  return d;
}
function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function u8(s) {
  return Buffer.from(s, 'utf8');
}

// ---------------------------------------------------------------------------
// Upstream: markers and block template read from the pinned tree at test time
// ---------------------------------------------------------------------------

function upstreamTemplatePath() {
  if (process.env.BMAD_V7_TREE) return path.join(process.env.BMAD_V7_TREE, UPSTREAM_REL);
  return COMMITTED_TEMPLATE;
}

function loadUpstream(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`pinned upstream template not found: ${file} (no fallback)`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const open = lines.findIndex((l) => /^(`{3,}|~{3,})\S*\s*$/.test(l) && /\S/.test(l.replace(/^[`~]+/, '')));
  assert.ok(open >= 0, `${file}: no fenced worked example`);
  const fence = lines[open].match(/^([`~]+)/)[1];
  const close = lines.findIndex((l, i) => i > open && l === fence);
  assert.ok(close > open, `${file}: fenced example not closed`);
  let s = open + 1;
  while (s < close && lines[s].trim() === '') s++;
  let e = close - 1;
  while (e > s && lines[e].trim() === '') e--;
  const start = lines[s];
  const end = lines[e];
  for (const m of [start, end]) {
    assert.ok(m && m.length > 0, `${file}: empty marker`);
    assert.ok(/^<!--.*-->$/.test(m), `${file}: marker is not one HTML comment line: ${m}`);
  }
  assert.notStrictEqual(start, end, `${file}: start and end markers equal`);
  const body = lines.slice(s + 1, e);
  assert.ok(body.length > 0, `${file}: empty block template`);
  const prov = body[0];
  assert.ok(/^<!--.*-->$/.test(prov), `${file}: first block line is not the provenance comment`);
  assert.ok(/\d{4}-\d{2}-\d{2}/.test(prov), `${file}: provenance line carries no date`);
  assert.ok(/\b[0-9a-f]{7,40}\b/.test(prov), `${file}: provenance line carries no commit`);
  for (const l of body) {
    assert.ok(l !== start && l !== end, `${file}: marker repeated inside the block`);
  }
  const normalized = lines.join('\n');
  const blob = crypto.createHash('sha1')
    .update(`blob ${Buffer.byteLength(normalized)}\0`).update(normalized).digest('hex');
  return { file, markers: { start, end }, startLine: s + 1, endLine: e + 1, fenceLine: open + 1, body, blob };
}

let UP;
try {
  UP = loadUpstream(upstreamTemplatePath());
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}

// Deterministic provenance per revision (Dev Notes: template.md:18 carries a date and commit).
const UPSTREAM_PROVENANCE = [
  null,
  { date: '2026-11-01', commit: '1111111' },
  { date: '2026-11-02', commit: '2222222' },
  { date: '2026-11-03', commit: '3333333' }
];
function upstreamBody(rev) {
  const p = UPSTREAM_PROVENANCE[rev];
  const prov = UP.body[0]
    .replace(/\d{4}-\d{2}-\d{2}/, p.date)
    .replace(/\b[0-9a-f]{7,40}\b/, p.commit);
  assert.ok(prov.includes(p.date) && prov.includes(p.commit), 'provenance substitution failed');
  return [prov, ...UP.body.slice(1)].join('\n');
}

// ---------------------------------------------------------------------------
// Our writers' bodies per revision (content inside blocks is out of scope)
// ---------------------------------------------------------------------------

function maAgentsBody(rev) {
  return [
    '## ma-agents',
    '',
    `Installed by ma-agents 4.0.${rev}. Modules: core-tools, method, ma-standards, ma-ops.`,
    '- Entry point: invoke the `bmad` skill for every BMAD workflow.',
    '- Skill activations read `UV_CONFIG_FILE=.ma-agents/uv.toml` and `UV_PYTHON_INSTALL_DIR=.ma-agents/runtime/python`.'
  ].join('\n');
}
function maStandardsBody(rev) {
  return [
    `## Engineering standards (ma-standards r${rev})`,
    '',
    '- Work on a feature branch in a git worktree — never commit to the trunk.',
    '- Commit messages use Conventional Commits.'
  ].join('\n');
}
const OWNERS = ['ma-agents', 'ma-standards', 'upstream'];
function markersOf(owner) {
  if (owner === 'ma-agents') return mb.MA_AGENTS_MARKERS;
  if (owner === 'ma-standards') return mb.MA_STANDARDS_MARKERS;
  return UP.markers;
}
function bodyOf(owner, rev) {
  if (owner === 'ma-agents') return maAgentsBody(rev);
  if (owner === 'ma-standards') return maStandardsBody(rev);
  return upstreamBody(rev);
}
function renderBlockText(owner, rev, eol) {
  const m = markersOf(owner);
  return [m.start, ...bodyOf(owner, rev).split('\n'), m.end].join(eol);
}

// ---------------------------------------------------------------------------
// Reference model (segments) -> case table
// ---------------------------------------------------------------------------

function mergeTexts(segs) {
  const out = [];
  for (const s of segs) {
    if (s.text !== undefined && s.text === '') continue;
    const last = out[out.length - 1];
    if (s.text !== undefined && last && last.text !== undefined) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function modelApply(state, step) {
  if (state === null && step.op !== 'write') {
    if (step.op === 'remove') return null;
  }
  let segs = state === null ? null : state.map((s) => ({ ...s }));
  switch (step.op) {
    case 'write': {
      if (segs === null) return [{ block: step.owner, rev: step.rev }, { text: '\n' }];
      const i = segs.findIndex((s) => s.block === step.owner);
      if (i >= 0) { segs[i].rev = step.rev; return segs; }
      const isEmpty = segs.length === 0 || (segs.length === 1 && segs[0].text === '');
      if (isEmpty) return [{ block: step.owner, rev: step.rev }, { text: '\n' }];
      const last = segs[segs.length - 1];
      assert.ok(last.text !== undefined && last.text.endsWith('\n'), 'model: fixture must end with a newline');
      segs.push({ text: '\n' }, { block: step.owner, rev: step.rev }, { text: '\n' });
      return mergeTexts(segs);
    }
    case 'remove': {
      const i = segs.findIndex((s) => s.block === step.owner);
      if (i < 0) return segs;
      const before = i > 0 && segs[i - 1].text !== undefined ? segs[i - 1].text : null;
      const after = segs[i + 1] && segs[i + 1].text !== undefined ? segs[i + 1].text : null;
      assert.ok(after !== null && after.startsWith('\n'), 'model: block must end with a line ending');
      let a = after.slice(1);
      let b = before === null ? '' : before;
      // line before block blank: b is '\n' alone or ends with '\n\n'
      const prevBlank = b === '\n' || b.endsWith('\n\n');
      const nextBlankOrAbsent = (a === '' && !segs[i + 2]) || a.startsWith('\n');
      if (prevBlank && nextBlankOrAbsent) b = b.slice(0, -1);
      const out = mergeTexts([...segs.slice(0, before === null ? i : i - 1), { text: b }, { text: a }, ...segs.slice(i + 2)]);
      const onlyWs = out.every((s) => s.text !== undefined && /^\s*$/.test(s.text));
      return onlyWs ? null : out;
    }
    case 'reduce':
      return [{ text: '@AGENTS.md\n' }];
    case 'edit': {
      const i = segs.findIndex((s) => s.block === step.after);
      assert.ok(i >= 0 && segs[i + 1] && segs[i + 1].text.startsWith('\n'), 'model: edit target');
      segs[i + 1].text = '\n' + step.text + segs[i + 1].text.slice(1);
      return segs;
    }
    default:
      throw new Error(`model: unknown op ${step.op}`);
  }
}

function permutations(xs) {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

const PARA = {
  before: 'User paragraph before the blocks: money is integer cents.\n',
  between1: 'User paragraph between the first and second block.\n',
  between2: 'User paragraph between the second and third block — keep me.\n',
  after: 'User paragraph after the blocks.\n'
};

function buildCases() {
  const cases = [];
  const pass = (order, rev) => order.map((owner) => (owner === 'reduce' ? { op: 'reduce' } : { op: 'write', owner, rev }));
  for (const eol of ['lf', 'crlf']) {
    const init = eol === 'lf' ? null : [{ text: '# AGENTS.md\n' }];
    cases.push({ id: `ac2-order-a-${eol}`, ac: eol === 'lf' ? 'AC2' : 'AC8', file: 'AGENTS.md', eol, initial: init,
      steps: [{ op: 'write', owner: 'ma-agents', rev: 1 }, { op: 'write', owner: 'upstream', rev: 1 }] });
    cases.push({ id: `ac3-order-b-${eol}`, ac: eol === 'lf' ? 'AC3' : 'AC8', file: 'AGENTS.md', eol, initial: init,
      steps: [{ op: 'write', owner: 'upstream', rev: 1 }, { op: 'write', owner: 'ma-agents', rev: 1 }] });
  }
  for (const eol of ['lf', 'crlf']) {
    for (const order of permutations(OWNERS)) {
      cases.push({
        id: `ac4-${order.join('>')}-${eol}`, ac: eol === 'lf' ? 'AC4' : 'AC8', file: 'AGENTS.md', eol,
        order, initial: [{ text: '# AGENTS.md\n\n' + PARA.before }],
        steps: [
          ...pass(order, 1),
          { op: 'edit', after: order[0], text: '\n' + PARA.between1 },
          { op: 'edit', after: order[1], text: '\n' + PARA.between2 },
          { op: 'edit', after: order[2], text: '\n' + PARA.after },
          ...pass(order, 2),
          ...pass(order, 3)
        ]
      });
    }
  }
  // AC6 removal: from the AC4 end state of the first order.
  const full = [
    { text: '# AGENTS.md\n\n' + PARA.before + '\n' }, { block: 'ma-agents', rev: 3 },
    { text: '\n\n' + PARA.between1 + '\n' }, { block: 'ma-standards', rev: 3 },
    { text: '\n\n' + PARA.between2 + '\n' }, { block: 'upstream', rev: 3 },
    { text: '\n\n' + PARA.after }
  ];
  for (const eol of ['lf', 'crlf']) {
    cases.push({ id: `ac6-remove-ma-agents-${eol}`, ac: 'AC6', file: 'AGENTS.md', eol, initial: full,
      steps: [{ op: 'remove', owner: 'ma-agents' }] });
    cases.push({ id: `ac6-remove-ma-standards-${eol}`, ac: 'AC6', file: 'AGENTS.md', eol, initial: full,
      steps: [{ op: 'remove', owner: 'ma-standards' }] });
    cases.push({ id: `ac6-remove-both-${eol}`, ac: 'AC6', file: 'AGENTS.md', eol, initial: full,
      steps: [{ op: 'remove', owner: 'ma-agents' }, { op: 'remove', owner: 'ma-standards' }, { op: 'remove', owner: 'ma-agents' }] });
  }
  cases.push({ id: 'ac6-only-ours-deleted', ac: 'AC6', file: 'AGENTS.md', eol: 'lf', initial: null,
    steps: [{ op: 'write', owner: 'ma-agents', rev: 1 }, { op: 'write', owner: 'ma-standards', rev: 1 },
      { op: 'remove', owner: 'ma-standards' }, { op: 'remove', owner: 'ma-agents' }] });
  cases.push({ id: 'ac6-upstream-kept-alone', ac: 'AC6', file: 'AGENTS.md', eol: 'lf', initial: null,
    steps: [{ op: 'write', owner: 'upstream', rev: 1 }, { op: 'write', owner: 'ma-agents', rev: 1 },
      { op: 'write', owner: 'ma-standards', rev: 1 }, { op: 'remove', owner: 'ma-agents' }, { op: 'remove', owner: 'ma-standards' }] });
  // AC7: foreign and look-alike markers stay untouched.
  cases.push({
    id: 'ac7-non-interference', ac: 'AC7', file: 'AGENTS.md', eol: 'lf',
    initial: [
      { text: '# AGENTS.md\n\nDo not edit inside `<!-- ma-agents:start -->` by hand.\n\n' +
        '<!-- MA-AGENTS-START -->\n3.x block body.\n<!-- MA-AGENTS-END -->\n\n' +
        '<!-- ma-agents:start-x -->\nlook-alike body\n<!-- ma-agents:end-x -->\n\n' +
        '  <!-- ma-agents:start -->\nindented look-alike\n  <!-- ma-agents:end -->\n\n' },
      { block: 'upstream', rev: 1 }, { text: '\n\n' }, { block: 'ma-standards', rev: 1 }, { text: '\n' }
    ],
    steps: [{ op: 'write', owner: 'ma-agents', rev: 1 }, { op: 'write', owner: 'ma-agents', rev: 2 },
      { op: 'remove', owner: 'ma-agents' }, { op: 'write', owner: 'ma-agents', rev: 3 }]
  });
  // AC10: CLAUDE.md with the adopt reduction to @AGENTS.md, six orders x re-runs,
  // then the next install/apply run of both owners.
  for (const order of permutations(['ma-agents', 'ma-standards', 'reduce'])) {
    cases.push({
      id: `ac10-claude-${order.join('>')}`, ac: 'AC10', file: 'CLAUDE.md', eol: 'lf', order,
      initial: [{ text: '# CLAUDE.md\n\nUser paragraph in CLAUDE.md.\n' }],
      steps: [...pass(order, 1), ...pass(order, 2), ...pass(order, 3),
        { op: 'write', owner: 'ma-agents', rev: 3 }, { op: 'write', owner: 'ma-standards', rev: 3 }]
    });
  }
  cases.push({ id: 'ac10-claude-remove-after-reduction', ac: 'AC10', file: 'CLAUDE.md', eol: 'lf',
    initial: [{ text: '@AGENTS.md\n' }],
    steps: [{ op: 'write', owner: 'ma-agents', rev: 1 }, { op: 'write', owner: 'ma-standards', rev: 1 },
      { op: 'remove', owner: 'ma-agents' }, { op: 'remove', owner: 'ma-standards' }] });

  for (const c of cases) {
    let st = c.initial === null ? null : c.initial.map((s) => ({ ...s }));
    for (const step of c.steps) st = modelApply(st, step);
    c.expected = st === null ? { deleted: true } : st;
  }
  return {
    story: '36.5',
    note: 'Generated by `node test/instruction-file-coexistence.test.js --write-case-table` from the reference model. ' +
      'Segments: {text} uses "\\n" and is rendered with the case eol; {block, rev} renders as start marker, ' +
      'body lines, end marker joined by the eol, with no trailing line ending. Upstream markers and body are ' +
      'read from the pinned skills/bmad-project-context/references/template.md at run time (body[0] is the ' +
      'provenance line, filled per rev from upstreamProvenance). initial null = file absent; expected ' +
      '{deleted:true} = file absent. Ops: write, remove, edit (insert text after the block\'s end-marker line ' +
      'ending), reduce (whole file becomes the "@AGENTS.md" import line).',
    markers: {
      'ma-agents': mb.MA_AGENTS_MARKERS,
      'ma-standards': mb.MA_STANDARDS_MARKERS,
      upstream: 'read at run time from skills/bmad-project-context/references/template.md (lines 17 and 52 at e734d3a)'
    },
    bodies: {
      'ma-agents': [null, maAgentsBody(1), maAgentsBody(2), maAgentsBody(3)],
      'ma-standards': [null, maStandardsBody(1), maStandardsBody(2), maStandardsBody(3)]
    },
    upstreamProvenance: UPSTREAM_PROVENANCE,
    cases
  };
}

if (process.argv.includes('--write-case-table')) {
  fs.writeFileSync(CASE_TABLE, JSON.stringify(buildCases(), null, 2) + '\n');
  console.log(`wrote ${CASE_TABLE}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Real writers on disk
// ---------------------------------------------------------------------------

function detectEolOf(text, startMarker) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const s = lines.find((l) => l.replace(/\r?\n$/, '') === startMarker);
  if (s) return s.endsWith('\r\n') ? '\r\n' : '\n';
  const first = lines.find((l) => l.endsWith('\n'));
  return first && first.endsWith('\r\n') ? '\r\n' : '\n';
}

/** Model of the upstream agent's splice: independent of lib/inject/marker-block.js. */
function simulateUpstreamSplice(file, body) {
  const { start, end } = UP.markers;
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'latin1') : null;
  const bodyL = Buffer.from(body, 'utf8').toString('latin1');
  if (old === null) {
    fs.writeFileSync(file, [start, ...bodyL.split('\n'), end].join('\n') + '\n', 'latin1');
    return;
  }
  const eol = detectEolOf(old, start);
  const block = [start, ...bodyL.split('\n'), end].join(eol);
  const lines = old.match(/[^\n]*\n|[^\n]+$/g) || [];
  const strip = (l) => l.replace(/\r?\n$/, '');
  const s = lines.findIndex((l) => strip(l) === start);
  const e = lines.findIndex((l) => strip(l) === end);
  let out;
  if (s >= 0 && e > s) {
    const term = lines[e].slice(strip(lines[e]).length);
    out = lines.slice(0, s).join('') + block + term + lines.slice(e + 1).join('');
  } else if (s < 0 && e < 0) {
    out = old + (old === '' ? '' : (old.endsWith('\n') ? '' : eol) + eol) + block + eol;
  } else {
    throw new Error('simulated upstream splice: unbalanced markers');
  }
  if (out !== old) fs.writeFileSync(file, out, 'latin1');
}

function simulateReduction(file) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'latin1') : '';
  const eol = detectEolOf(old, '\u0000');
  fs.writeFileSync(file, '@AGENTS.md' + eol, 'latin1');
}

function render(segs, eol) {
  const E = eol === 'crlf' ? '\r\n' : '\n';
  let out = '';
  for (const s of segs) {
    if (s.text !== undefined) out += s.text.replace(/\n/g, E);
    else out += renderBlockText(s.block, s.rev, E);
  }
  return out;
}

function runStep(root, file, eol, step) {
  const p = path.join(root, file);
  switch (step.op) {
    case 'write':
      if (step.owner === 'ma-agents') return mb.spliceFile(p, mb.MA_AGENTS_MARKERS, maAgentsBody(step.rev));
      if (step.owner === 'ma-standards') return maStandards.apply(root, maStandardsBody(step.rev), { files: [file] })[file];
      return simulateUpstreamSplice(p, upstreamBody(step.rev));
    case 'remove':
      if (step.owner === 'ma-agents') return mb.removeFile(p, mb.MA_AGENTS_MARKERS);
      if (step.owner === 'ma-standards') return maStandards.remove(root, { files: [file] })[file];
      throw new Error('upstream removal is not modelled');
    case 'reduce':
      return simulateReduction(p);
    case 'edit': {
      const E = eol === 'crlf' ? '\r\n' : '\n';
      const text = fs.readFileSync(p, 'latin1');
      const endMarker = markersOf(step.after).end;
      const idx = text.indexOf(endMarker + E);
      assert.ok(idx >= 0, `edit: end marker of ${step.after} not found`);
      const at = idx + endMarker.length + E.length;
      const ins = Buffer.from(step.text.replace(/\n/g, E), 'utf8').toString('latin1');
      fs.writeFileSync(p, text.slice(0, at) + ins + text.slice(at), 'latin1');
      return 'edited';
    }
    default:
      throw new Error(`unknown op ${step.op}`);
  }
}

function countLine(text, line) {
  return text.split(/\r?\n/).filter((l) => l === line).length;
}

/** Run a case; returns { root, file, bytes|null, lastRev }. */
function runCase(c) {
  const root = mktemp();
  const p = path.join(root, c.file);
  if (c.initial !== null) fs.writeFileSync(p, u8(render(c.initial, c.eol)));
  for (const step of c.steps) runStep(root, c.file, c.eol, step);
  return { root, p, bytes: fs.existsSync(p) ? fs.readFileSync(p) : null };
}

function assertCaseExpected(c, r) {
  if (c.expected.deleted) {
    assert.strictEqual(r.bytes, null, `${c.id}: file should be deleted`);
    return;
  }
  assert.ok(r.bytes, `${c.id}: file missing`);
  const want = u8(render(c.expected, c.eol));
  assert.ok(r.bytes.equals(want), `${c.id}: bytes differ\n--- want\n${want.toString('utf8')}\n--- got\n${r.bytes.toString('utf8')}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n instruction-file coexistence (Story 36.5, FR301)\n');
console.log(`  upstream template: ${UP.file}`);
console.log(`  upstream markers at lines ${UP.startLine} / ${UP.endLine} (fence opens at ${UP.fenceLine}); blob ${UP.blob}\n`);

const TABLE = JSON.parse(fs.readFileSync(CASE_TABLE, 'utf8'));
const CASES = TABLE.cases;
const byId = (id) => {
  const c = CASES.find((x) => x.id === id);
  assert.ok(c, `case ${id} missing from the case table`);
  return c;
};

test('pinned template: read at run time, non-empty markers, verbatim copy cited at :17/:52', () => {
  assert.ok(fs.existsSync(UP.file));
  assert.ok(UP.markers.start.length > 0 && UP.markers.end.length > 0);
  if (!process.env.BMAD_V7_TREE) {
    assert.strictEqual(UP.blob, PINNED_BLOB, 'committed fixture is not the verbatim pinned template.md');
    assert.strictEqual(UP.startLine, 17);
    assert.strictEqual(UP.endLine, 52);
    assert.strictEqual(UP.fenceLine, 16);
  }
});

test('no upstream marker or template text is typed into the test, helper, writer or case table', () => {
  const sources = [__filename, require.resolve('./helpers/ma-standards-apply'), require.resolve('../lib/inject/marker-block'), CASE_TABLE];
  const needles = [UP.markers.start, UP.markers.end, ...UP.body.filter((l) => l.trim().length > 12)];
  for (const f of sources) {
    const src = fs.readFileSync(f, 'utf8');
    for (const n of needles) assert.ok(!src.includes(n), `${path.basename(f)} contains upstream text: ${n}`);
  }
});

test('case table equals the reference model output', () => {
  const fresh = JSON.parse(JSON.stringify(buildCases()));
  assert.deepStrictEqual(TABLE, fresh, 'case-table.json is stale: run with --write-case-table');
});

// AC1 ----------------------------------------------------------------------
test('AC1 exact line equality: indented, trailing-space, inline and prefix-extended markers do not match', () => {
  const M = mb.MA_AGENTS_MARKERS;
  for (const t of [
    `  ${M.start}\nx\n  ${M.end}\n`,
    `${M.start} \nx\n${M.end} \n`,
    `see \`${M.start}\` and \`${M.end}\`\n`,
    '<!-- ma-agents:start-x -->\nx\n<!-- ma-agents:end-x -->\n',
    '<!-- MA-AGENTS-START -->\nx\n<!-- MA-AGENTS-END -->\n'
  ]) {
    assert.strictEqual(mb.findBlock(t, M), null, JSON.stringify(t));
  }
  assert.ok(mb.findBlock(`a\n${M.start}\nx\n${M.end}\n`, M));
});

test('AC1 preserves every byte outside the block (BOM, mixed EOL, invalid UTF-8, no final newline)', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  const M = mb.MA_AGENTS_MARKERS;
  const pre = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), u8('# T\r\nlf line\n'), Buffer.from([0xff, 0xfe, 0x0a])]);
  const post = Buffer.concat([u8('\r\ntail\r\nno-final-newline'), Buffer.from([0x80])]);
  fs.writeFileSync(p, Buffer.concat([pre, u8(`${M.start}\r\nold\r\n${M.end}`), post]));
  assert.strictEqual(mb.spliceFile(p, M, 'new é\nline 2'), 'replaced');
  const got = fs.readFileSync(p);
  assert.ok(got.subarray(0, pre.length).equals(pre), 'prefix bytes changed');
  assert.ok(got.subarray(got.length - post.length).equals(post), 'suffix bytes changed');
  const mid = got.subarray(pre.length, got.length - post.length);
  assert.ok(mid.equals(u8(`${M.start}\r\nnew é\r\nline 2\r\n${M.end}`)), `block bytes: ${JSON.stringify(mid.toString('latin1'))}`);
});

test('AC1 block absent: existing bytes are a prefix of the result (append, never a whole rewrite)', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  for (const orig of [u8('# A\r\n\r\nprose\r\n'), u8('no newline at end'), Buffer.concat([u8('x\n'), Buffer.from([0xff])])]) {
    fs.writeFileSync(p, orig);
    assert.strictEqual(mb.spliceFile(p, mb.MA_AGENTS_MARKERS, 'b'), 'appended');
    const got = fs.readFileSync(p);
    assert.ok(got.subarray(0, orig.length).equals(orig));
    assert.strictEqual(countLine(got.toString('latin1'), mb.MA_AGENTS_MARKERS.start), 1);
  }
});

test('AC1 unchanged content writes nothing (mtime untouched); marker pair is a parameter', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  fs.writeFileSync(p, 'prose\n');
  for (const M of [mb.MA_AGENTS_MARKERS, mb.MA_STANDARDS_MARKERS]) mb.spliceFile(p, M, 'body');
  const old = new Date('2001-01-01T00:00:00Z');
  fs.utimesSync(p, old, old);
  for (const M of [mb.MA_AGENTS_MARKERS, mb.MA_STANDARDS_MARKERS]) assert.strictEqual(mb.spliceFile(p, M, 'body'), 'unchanged');
  assert.strictEqual(fs.statSync(p).mtime.getTime(), old.getTime());
  assert.ok(mb.findBlock(fs.readFileSync(p, 'utf8'), mb.MA_STANDARDS_MARKERS));
});

test('AC1 ambiguous markers and marker lines in the body are refused; nothing written', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  const M = mb.MA_AGENTS_MARKERS;
  for (const t of [`${M.start}\n${M.end}\n${M.start}\n${M.end}\n`, `${M.end}\nx\n${M.start}\n`, `${M.start}\nx\n`, `x\n${M.end}\n`]) {
    fs.writeFileSync(p, t);
    assert.throws(() => mb.spliceFile(p, M, 'b'), mb.MarkerBlockError);
    assert.throws(() => mb.removeFile(p, M), mb.MarkerBlockError);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), t);
  }
  fs.writeFileSync(p, 'x\n');
  assert.throws(() => mb.spliceFile(p, M, `a\n${M.end}\nb`), mb.MarkerBlockError);
  assert.strictEqual(fs.readFileSync(p, 'utf8'), 'x\n');
});

// AC2 / AC3 / AC8 (two-writer orders) -----------------------------------------
for (const id of ['ac2-order-a-lf', 'ac3-order-b-lf', 'ac2-order-a-crlf', 'ac3-order-b-crlf']) {
  test(`${id.startsWith('ac2') ? 'AC2' : 'AC3'}${id.endsWith('crlf') ? '/AC8' : ''} ${id}`, () => {
    const c = byId(id);
    const r = runCase(c);
    assertCaseExpected(c, r);
    const E = c.eol === 'crlf' ? '\r\n' : '\n';
    const text = r.bytes.toString('latin1');
    const first = c.steps[0].owner;
    const second = c.steps[1].owner;
    const firstBlock = Buffer.from(renderBlockText(first, 1, E), 'utf8').toString('latin1');
    assert.strictEqual(text.split(firstBlock).length - 1, 1, `${first} block not byte-identical`);
    assert.strictEqual(countLine(text, markersOf(second).start), 1, `${second} block not present once`);
    if (c.initial) {
      const init = u8(render(c.initial, c.eol));
      assert.ok(r.bytes.subarray(0, init.length).equals(init), 'prose changed');
    }
    if (c.eol === 'crlf') assert.ok(!/[^\r]\n/.test(text), 'a line ending was converted to LF');
  });
}

// AC4 / AC5 / AC8 -----------------------------------------------------------
for (const c of CASES.filter((x) => x.id.startsWith('ac4-'))) {
  test(`${c.ac === 'AC8' ? 'AC4/AC8' : 'AC4'} ${c.id} (three passes) + AC5 idempotence`, () => {
    const r = runCase(c);
    assertCaseExpected(c, r);
    const E = c.eol === 'crlf' ? '\r\n' : '\n';
    const text = r.bytes.toString('utf8');
    for (const o of OWNERS) {
      assert.strictEqual(countLine(text, markersOf(o).start), 1, `${o} start marker count`);
      assert.strictEqual(text.split(renderBlockText(o, 3, E)).length - 1, 1, `${o} not byte-identical to its last write`);
    }
    const paras = [PARA.before, PARA.between1, PARA.between2, PARA.after].map((s) => s.replace(/\n/g, E));
    let at = 0;
    for (const s of paras) {
      assert.strictEqual(text.split(s).length - 1, 1, `paragraph not present once: ${s}`);
      const i = text.indexOf(s);
      assert.ok(i > at, 'paragraph out of place');
      at = i;
    }
    if (c.eol === 'crlf') assert.ok(!/[^\r]\n/.test(text), 'a line ending was converted to LF');
    // AC5: re-run each writer with unchanged input -> byte-identical file, no write for ours.
    const before = sha(fs.readFileSync(r.p));
    const old = new Date('2001-01-01T00:00:00Z');
    fs.utimesSync(r.p, old, old);
    assert.strictEqual(runStep(r.root, c.file, c.eol, { op: 'write', owner: 'ma-agents', rev: 3 }), 'unchanged');
    assert.strictEqual(runStep(r.root, c.file, c.eol, { op: 'write', owner: 'ma-standards', rev: 3 }), 'unchanged');
    assert.strictEqual(fs.statSync(r.p).mtime.getTime(), old.getTime(), 'an unchanged re-run wrote the file');
    runStep(r.root, c.file, c.eol, { op: 'write', owner: 'upstream', rev: 3 });
    assert.strictEqual(sha(fs.readFileSync(r.p)), before, 'NFR46: re-run changed bytes');
  });
}

// AC6 ------------------------------------------------------------------------
for (const c of CASES.filter((x) => x.ac === 'AC6')) {
  test(`AC6 ${c.id}`, () => {
    const r = runCase(c);
    assertCaseExpected(c, r);
    if (r.bytes) {
      const text = r.bytes.toString('utf8');
      const removed = new Set(c.steps.filter((s) => s.op === 'remove').map((s) => s.owner));
      for (const o of OWNERS) {
        const n = countLine(text, markersOf(o).start);
        if (removed.has(o)) assert.strictEqual(n, 0, `${o} still present`);
      }
      if (c.initial && c.initial.length > 1) {
        const E = c.eol === 'crlf' ? '\r\n' : '\n';
        for (const s of Object.values(PARA)) assert.ok(text.includes(s.replace(/\n/g, E)), 'user prose lost');
        assert.ok(text.includes(renderBlockText('upstream', 3, E)), 'upstream block lost');
      }
    }
  });
}

test('AC6 removal is idempotent and a removed-then-rewritten block is restored once', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  fs.writeFileSync(p, 'prose\n');
  mb.spliceFile(p, mb.MA_AGENTS_MARKERS, 'b');
  assert.strictEqual(mb.removeFile(p, mb.MA_AGENTS_MARKERS), 'removed');
  assert.strictEqual(fs.readFileSync(p, 'utf8'), 'prose\n', 'append-then-remove did not restore the file');
  assert.strictEqual(mb.removeFile(p, mb.MA_AGENTS_MARKERS), 'absent');
  assert.strictEqual(mb.removeFile(path.join(root, 'nope.md'), mb.MA_AGENTS_MARKERS), 'absent');
  fs.writeFileSync(p, ` \n\t\n${mb.MA_AGENTS_MARKERS.start}\nx\n${mb.MA_AGENTS_MARKERS.end}\n\n`);
  assert.strictEqual(mb.removeFile(p, mb.MA_AGENTS_MARKERS), 'deleted');
  assert.ok(!fs.existsSync(p));
});

// AC7 ------------------------------------------------------------------------
test('AC7 ac7-non-interference (table case)', () => {
  const c = byId('ac7-non-interference');
  const r = runCase(c);
  assertCaseExpected(c, r);
  const text = r.bytes.toString('utf8');
  assert.ok(text.includes(renderBlockText('upstream', 1, '\n')));
  assert.ok(text.includes(renderBlockText('ma-standards', 1, '\n')));
  assert.ok(text.includes('<!-- MA-AGENTS-START -->\n3.x block body.\n<!-- MA-AGENTS-END -->'));
  assert.ok(text.includes('<!-- ma-agents:start-x -->\nlook-alike body\n<!-- ma-agents:end-x -->'));
});

test('AC7 each matcher sees only its own markers (upstream markers read at test time)', () => {
  const blocks = {};
  for (const o of OWNERS) blocks[o] = renderBlockText(o, 1, '\n');
  const text = 'p\n\n' + OWNERS.map((o) => blocks[o]).join('\n\n') + '\n';
  for (const M of [mb.MA_AGENTS_MARKERS, mb.MA_STANDARDS_MARKERS]) {
    const own = OWNERS.find((o) => markersOf(o) === M);
    assert.strictEqual(mb.findBlock(text, M).text, blocks[own]);
    for (const o of OWNERS.filter((x) => x !== own)) {
      assert.strictEqual(mb.findBlock(blocks[o] + '\n', M), null, `${own} matcher matched ${o}`);
    }
  }
  assert.strictEqual(mb.findBlock(text, UP.markers).text, blocks.upstream);
});

test('AC7 a real 3.x AGENTS.md (written by lib/installer.js markdownMarkersMerger) is left untouched', () => {
  const root = mktemp();
  const p = path.join(root, 'AGENTS.md');
  const { markdownMarkersMerger } = require('../lib/installer');
  const tpl = fs.readFileSync(path.join(__dirname, '..', 'lib', 'templates', 'agents-md.template.md'), 'utf8');
  let res;
  return markdownMarkersMerger(p, tpl, '3.x composed block\n', { yesMode: true }).then((x) => { res = x; }).then(() => {
    assert.strictEqual(res, 'created');
    const orig = fs.readFileSync(p);
    assert.ok(orig.toString('utf8').includes('<!-- MA-AGENTS-START -->'));
    assert.strictEqual(mb.findBlock(orig.toString('utf8'), mb.MA_AGENTS_MARKERS), null);
    mb.spliceFile(p, mb.MA_AGENTS_MARKERS, maAgentsBody(1));
    maStandards.apply(root, maStandardsBody(1), { files: ['AGENTS.md'] });
    simulateUpstreamSplice(p, upstreamBody(1));
    mb.removeFile(p, mb.MA_AGENTS_MARKERS);
    maStandards.remove(root, { files: ['AGENTS.md'] });
    const got = fs.readFileSync(p);
    assert.ok(got.subarray(0, orig.length).equals(orig), '3.x file content changed');
  });
});

// AC8 mixed line endings -------------------------------------------------------
test('AC8 mixed EOL: a CRLF upstream block in an LF file and an LF block in a CRLF file stay as written', () => {
  for (const [fileE, upE] of [['\n', '\r\n'], ['\r\n', '\n']]) {
    const root = mktemp();
    const p = path.join(root, 'AGENTS.md');
    const up = renderBlockText('upstream', 1, upE);
    const content = `# A${fileE}${fileE}prose${fileE}${fileE}${up}${fileE}${fileE}tail${fileE}`;
    fs.writeFileSync(p, u8(content));
    for (const rev of [1, 2, 3]) {
      mb.spliceFile(p, mb.MA_AGENTS_MARKERS, maAgentsBody(rev));
      maStandards.apply(root, maStandardsBody(rev), { files: ['AGENTS.md'] });
    }
    let got = fs.readFileSync(p).toString('utf8');
    assert.ok(got.startsWith(content), 'prose or upstream block bytes changed');
    assert.ok(got.includes(fileE + renderBlockText('ma-agents', 3, fileE) + fileE));
    mb.removeFile(p, mb.MA_AGENTS_MARKERS);
    maStandards.remove(root, { files: ['AGENTS.md'] });
    got = fs.readFileSync(p).toString('utf8');
    assert.strictEqual(got, content, 'removal did not restore the mixed-EOL file');
  }
});

// AC10 -----------------------------------------------------------------------
for (const c of CASES.filter((x) => x.ac === 'AC10')) {
  test(`AC10 ${c.id}`, () => {
    const r = runCase(c);
    assertCaseExpected(c, r);
    const text = r.bytes.toString('utf8');
    assert.strictEqual(countLine(text, '@AGENTS.md'), 1, 'import line not present once');
    if (c.order) {
      assert.ok(text.startsWith('@AGENTS.md\n'), 'import line is not first');
      for (const o of ['ma-agents', 'ma-standards']) {
        assert.strictEqual(countLine(text, markersOf(o).start), 1);
        assert.strictEqual(text.split(renderBlockText(o, 3, '\n')).length - 1, 1);
      }
      assert.ok(!text.includes('User paragraph in CLAUDE.md.'), 'reduction model: prose moved to AGENTS.md');
    }
  });
}

test('AC10 a reduction after our writes drops both blocks; the next writer run restores each once', () => {
  const root = mktemp();
  const p = path.join(root, 'CLAUDE.md');
  fs.writeFileSync(p, '# CLAUDE.md\n\nprose\n');
  mb.spliceFile(p, mb.MA_AGENTS_MARKERS, maAgentsBody(1));
  maStandards.apply(root, maStandardsBody(1), { files: ['CLAUDE.md'] });
  simulateReduction(p);
  assert.strictEqual(fs.readFileSync(p, 'utf8'), '@AGENTS.md\n');
  assert.strictEqual(mb.spliceFile(p, mb.MA_AGENTS_MARKERS, maAgentsBody(1)), 'appended');
  assert.strictEqual(maStandards.apply(root, maStandardsBody(1), { files: ['CLAUDE.md'] })['CLAUDE.md'], 'appended');
  const text = fs.readFileSync(p, 'utf8');
  assert.strictEqual(text, '@AGENTS.md\n\n' + renderBlockText('ma-agents', 1, '\n') + '\n\n' + renderBlockText('ma-standards', 1, '\n') + '\n');
});

test('AC10 instruction-file set: markdown files via the writer; .roomodes needs a structural block form', () => {
  assert.deepStrictEqual([...maStandards.INSTRUCTION_FILES].sort(),
    ['.clinerules', '.github/copilot-instructions.md', '.roomodes', 'AGENTS.md', 'CLAUDE.md'].sort());
  const root = mktemp();
  const res = maStandards.apply(root, maStandardsBody(1));
  assert.deepStrictEqual(Object.keys(res).sort(), [...maStandards.MARKDOWN_FILES].sort());
  for (const f of maStandards.MARKDOWN_FILES) {
    assert.strictEqual(res[f], 'created');
    assert.ok(mb.findBlock(fs.readFileSync(path.join(root, f), 'utf8'), mb.MA_STANDARDS_MARKERS));
  }
  assert.deepStrictEqual(maStandards.apply(root, maStandardsBody(1)), Object.fromEntries(maStandards.MARKDOWN_FILES.map((f) => [f, 'unchanged'])));
  assert.throws(() => maStandards.apply(root, 'x', { files: ['.roomodes'] }), /not a markdown instruction file/);
  // A YAML comment-marker pair does not survive the 3.x .roomodes writer (parse + dump).
  const { mergeRoomodes } = require('../lib/merge/roomodes');
  const existing = 'customModes:\n  # ma-standards:start\n  - slug: user-mode\n    name: User\n    roleDefinition: r\n    groups: [read]\n  # ma-standards:end\n';
  const tpl = 'customModes:\n  - slug: bmad-dev\n    name: Dev\n    roleDefinition: d\n    groups: [read]\n';
  const merged = mergeRoomodes(existing, tpl);
  assert.ok(!merged.includes('ma-standards:start'), 'expected the YAML merger to drop comment markers');
  assert.ok(merged.includes('user-mode'));
  assert.deepStrictEqual(maStandards.remove(root), Object.fromEntries(maStandards.MARKDOWN_FILES.map((f) => [f, 'deleted'])));
});

// ---------------------------------------------------------------------------

function finish() {
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

Promise.all(pending).then(finish);
