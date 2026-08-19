#!/usr/bin/env node
/**
 * Story 31.6 — ARTIFACT-TO-STORE ROUTING.
 *
 * WHAT THIS SUITE IS FOR. Story 31.6 says which of a project's three knowledge
 * destinations each planning artifact belongs to: brief and PRD to the system
 * requirements store (FR255), architecture / UX / epics to the software
 * requirements store (FR256), story files and everything else under
 * `implementation_artifacts` to sprint management and to NEITHER store (FR267).
 * Its reviewable deliverable is the routing table shipped at
 * `_bmad-output/implementation-artifacts/31-6-artifact-to-store-routing.md`.
 *
 * THE TAUTOLOGY THIS SUITE IS BUILT TO AVOID. A routing table invites exactly the
 * defect shape this epic keeps producing: a test asserting "the table has a row
 * for the PRD" proves nothing whatsoever about where a PRD actually lands, and
 * both halves move together on any edit. So NOTHING here is checked against a
 * transcription of the table:
 *
 *   - COVERAGE is checked against the PRD's own requirement lines
 *     (`prd/capabilities/project-knowledge-and-repository-layout.md`) — a source
 *     this story may not edit. Delete a row from the table and the requirement
 *     line still names the artifact, so the check fails.
 *   - RESOLUTION is checked against a REAL `_bmad/bmm/config.yaml` produced by
 *     the REAL `generateBmmConfig` from a REAL `project-layout.yaml` fixture. No
 *     expectation in Section 3 or 4 is read from the table; the table supplies
 *     only the question ("which destination does row N claim?"), never the answer.
 *   - The three destinations are proven MUTUALLY DISTINCT in the two-store
 *     fixture before any row is checked against one, so "row X resolves to the
 *     software store" cannot be vacuously true because all three happen to be
 *     the same directory.
 *
 * THE TEST COUNT IS PINNED IN BOTH DIRECTIONS (EXPECTED_TEST_COUNT): a surplus
 * fails as loudly as a shortfall, and a suite that exits before printing its
 * summary is forced non-zero.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const EXPECTED_TEST_COUNT = 54;

let passed = 0;
let failed = 0;
const errors = [];

let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Forcing a non-zero exit so ` +
    `this cannot read as a pass.`
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

let cli, installerMod;
try {
  cli = require('../bin/cli.js');
  installerMod = require('../lib/installer.js');
} catch (e) {
  console.error('\n  FATAL: cannot load the modules under test');
  console.error(' ', e.stack || e.message);
  process.exit(1);
}

let yamlOracle = null;
try { yamlOracle = require('js-yaml'); } catch (e) { yamlOracle = null; }
if (!yamlOracle) {
  console.error('\n  FATAL: js-yaml (a declared direct dependency) could not be loaded; the ' +
    'generated config.yaml cannot be read with a real parser.');
  process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TABLE_REL = '_bmad-output/implementation-artifacts/31-6-artifact-to-store-routing.md';
const PRD_REL = '_bmad-output/planning-artifacts/prd/capabilities/' +
  'project-knowledge-and-repository-layout.md';
const CONFIG_REL = path.join('_bmad', 'bmm', 'config.yaml');
const LAYOUT_REL = path.join('_bmad-output', 'project-layout.yaml');

// The three destination tokens. Exactly these; the parser rejects anything else
// rather than skipping the row, so a typo or a fourth invented destination is a
// failure and not a silently-unchecked entry.
const SYSTEM = 'system requirements';
const SOFTWARE = 'software requirements';
const SPRINT = 'sprint management';
const DESTINATIONS = Object.freeze([SYSTEM, SOFTWARE, SPRINT]);

// ═════════════════════════════════════════════════════════════════════════════
// The shipped table, PARSED — never transcribed.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ONE numbered section of the shipped table document, delimited by its heading
 * and the next `## `. Sections are read individually rather than the file being
 * grepped as a whole: a claim about what Section 4 records must be false when
 * Section 4 is deleted, even though the words survive elsewhere in the file.
 * Throws on an absent or empty section rather than returning ''.
 */
function tableSection(headingPrefix) {
  const abs = path.join(PROJECT_ROOT, TABLE_REL);
  if (!fs.existsSync(abs)) {
    throw new Error(`the routing table AC6 requires does not exist at ${TABLE_REL}`);
  }
  const body = fs.readFileSync(abs, 'utf-8');
  const start = body.indexOf(`\n${headingPrefix}`);
  if (start === -1) {
    throw new Error(`${TABLE_REL} has no section starting "${headingPrefix}" — this suite binds ` +
      `to that heading, and a renamed or deleted section must fail rather than be skipped`);
  }
  const rest = body.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  const section = end === -1 ? rest : rest.slice(0, end);
  if (section.trim().split(/\r?\n/).length < 2) {
    throw new Error(`section "${headingPrefix}" of ${TABLE_REL} is empty`);
  }
  return section;
}

/**
 * Pull Section 3's table out of the shipped markdown. Throws rather than
 * returning empty: a suite that quietly finds zero rows and then reports every
 * "for each row" test as green is the failure mode this epic has already shipped
 * once, in a suite that exited 0 having asserted nothing.
 */
function parseRoutingTable() {
  const section = tableSection('## 3. THE ROUTING TABLE');

  const rows = [];
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) continue;
    if (/^-+$/.test(cells[0]) || cells[0] === '#') continue;   // separator / header
    const [num, artifact, store, source] = cells;
    if (!/^\d+$/.test(num)) {
      throw new Error(`routing table row has a non-numeric index cell: ${JSON.stringify(line)}`);
    }
    if (!artifact) throw new Error(`routing table row ${num} has an empty Artifact cell`);
    if (!DESTINATIONS.includes(store)) {
      throw new Error(
        `routing table row ${num} ("${artifact}") declares owning store ${JSON.stringify(store)}, ` +
        `which is not one of ${JSON.stringify(DESTINATIONS)}. An unassigned or misspelt ` +
        `destination is what AC4 forbids, so it fails here rather than being skipped.`);
    }
    if (!source) throw new Error(`routing table row ${num} ("${artifact}") cites no rule source`);
    rows.push({ num: Number(num), artifact, store, source });
  }
  if (rows.length === 0) {
    throw new Error(`parsed ZERO rows out of ${TABLE_REL}'s routing table — the format this ` +
      `suite binds to has changed, and every per-row test below would have passed vacuously`);
  }
  return rows;
}

let ROWS;
try {
  ROWS = parseRoutingTable();
} catch (e) {
  console.error('\n  FATAL: ' + e.message);
  process.exit(1);
}

const rowsFor = (store) => ROWS.filter((r) => r.store === store);
const artifactText = (store) => rowsFor(store).map((r) => r.artifact).join(' ; ').toLowerCase();

// ═════════════════════════════════════════════════════════════════════════════
// The PRD's own requirement lines — the external coverage oracle.
// ═════════════════════════════════════════════════════════════════════════════

function requirementLine(id) {
  const abs = path.join(PROJECT_ROOT, PRD_REL);
  const body = fs.readFileSync(abs, 'utf-8');
  const line = body.split(/\r?\n/).find((l) => l.trim().startsWith(`- ${id}:`));
  if (!line) {
    throw new Error(`${PRD_REL} no longer states ${id} — this suite's coverage oracle is gone`);
  }
  return line;
}

/** Every requirement id the PRD capability document actually states. */
function prdRequirementIds() {
  const body = fs.readFileSync(path.join(PROJECT_ROOT, PRD_REL), 'utf-8');
  return new Set((body.match(/^- (N?FR\d+):/gm) || []).map((s) => s.slice(2, -1)));
}

/**
 * Which destination a requirement line assigns, read out of the line's OWN
 * words. Not a lookup table kept here: FR255 and FR256 each name their store in
 * bold, and FR267 says "belong to **neither** knowledge store — they follow
 * `sprint_management_path`".
 */
function destinationOf(line) {
  const found = [];
  if (/\*\*system requirements store\*\*/i.test(line)) found.push(SYSTEM);
  if (/\*\*software requirements store\*\*/i.test(line)) found.push(SOFTWARE);
  if (/\*\*neither\*\* knowledge store/i.test(line) && /sprint_management_path/.test(line)) {
    found.push(SPRINT);
  }
  if (found.length !== 1) {
    throw new Error(`cannot read exactly one destination out of the requirement line ` +
      `(found ${JSON.stringify(found)}): ${line.slice(0, 160)}`);
  }
  return found[0];
}

// Artifact terms this suite knows how to look for, each with the regex that
// recognises it in a requirement line AND in a table Artifact cell. A term is
// only REQUIRED of the table when the requirement line actually names it — so
// the requirement text drives coverage, not this list.
//
// `guidance` is the (lower-cased) regex that recognises the same artifact in a
// project-context.md store-guidance SENTENCE, which is prose rather than a table
// cell and so spells things differently ("every shard", not "capability
// shards"). `null` means "this artifact is named in NEITHER store sentence" —
// which is itself checked, because the sprint artifacts must not appear there.
const TERMS = Object.freeze([
  { key: 'product brief', re: /product brief/i, guidance: /product brief/ },
  { key: 'PRD', re: /\bPRDs?\b/i, guidance: /\bprd\b/ },
  { key: 'sharded PRD index', re: /sharded PRD index|its index/i, guidance: /shard/ },
  { key: 'sharded PRD shards', re: /shards?\b/i, guidance: /shard/ },
  { key: 'architecture', re: /architecture/i, guidance: /architecture/ },
  { key: 'UX design', re: /UX design/i, guidance: /ux design/ },
  { key: 'epics', re: /\bepics\b/i, guidance: /\bepic/ },
  { key: 'research', re: /research/i, guidance: /research/ },
  { key: 'story files', re: /story file/i, guidance: null },
  { key: 'sprint-status.yaml', re: /sprint-status\.yaml/i, guidance: null },
  { key: 'bug', re: /\bbug\b/i, guidance: null },
  { key: 'retrospectives', re: /retrospective/i, guidance: null },
  { key: 'implementation artifacts', re: /implementation artifacts|implementation_artifacts/i,
    guidance: null },
]);

// ═════════════════════════════════════════════════════════════════════════════
// WHICH DESTINATION EACH ARTIFACT BELONGS TO — an oracle built ENTIRELY from
// sources outside the shipped table.
//
// FIX-ROUND, BLOCKING-1. Section 3's per-row loops used to read
// `dirs[r.store]` and compare it to `dirs[<the group they were selected by>]`.
// `rowsFor(store)` filters on `r.store === store`, so that comparison was
// literally `X === X` and the destination column was unchecked: a reviewer's
// mutation run changed FOUR rows' destinations — including the architecture
// document, FR256's flagship artifact — with the suite fully green. The only
// surviving check on the column was Section 2's coverage oracle, which asks
// merely that a term appear SOMEWHERE under the right destination, so any row
// whose term was still covered by a sibling row moved freely.
//
// So a row's expected destination is now resolved FROM THE ARTIFACT IT NAMES,
// through the PRD's own requirement lines and the recorded OQ-5 decision. The
// table supplies the question; it never supplies the answer.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The requirement lines that ASSIGN a destination, and how each one's assignment
 * is read. FR119 is deliberately absent: it predates the split and names no
 * store, which is exactly why AC4 exists. FR120 states its destination as a
 * `{sprint_management_path}` resolution rather than in the "**… store**" wording
 * `destinationOf` reads, so it is the one entry whose destination is supplied
 * here — and it is EARNED, not asserted: the line must still resolve through
 * that field and must still name neither store, or this throws.
 */
const DESTINATION_ORACLES = Object.freeze([
  { id: 'FR255' },
  { id: 'FR256' },
  { id: 'FR267' },
  {
    id: 'FR120',
    destination: SPRINT,
    earnedBy: /\{sprint_management_path\}/,
    forbids: /\*\*(?:system|software) requirements store\*\*/i,
  },
]);

/** The OQ-5 decision, READ OUT OF the decision record rather than restated. */
function oq5DecisionSentence() {
  const section = tableSection('## 4.').replace(/\s+/g, ' ');
  const m = section.match(
    /\*\*Decision \((\w+), (\d{4}-\d{2}-\d{2})\): (the three research reports belong to the (SOFTWARE|SYSTEM) requirements store)\.\*\*/i);
  if (!m) {
    throw new Error('Section 4 no longer states the OQ-5 decision in the form this suite reads ' +
      '("**Decision (<who>, <date>): the three research reports belong to the <STORE> ' +
      'requirements store.**"). AC4 asks for a recorded story-level decision; an unreadable one ' +
      'cannot be the oracle for rows 9-11.');
  }
  return { who: m[1], date: m[2], sentence: m[3], store: m[4].toLowerCase() + ' requirements' };
}

/**
 * `term key -> { dest, source }`, built once. Throws on a conflict (two
 * requirements assigning the same artifact to different stores) and on a term
 * no source assigns, so a TERM cannot be added without an authority for it.
 */
function buildArtifactOracle() {
  const byTerm = new Map();
  const claim = (termList, dest, source) => {
    for (const t of termList) {
      const prev = byTerm.get(t.key);
      if (prev && prev.dest !== dest) {
        throw new Error(`"${t.key}" is assigned to ${JSON.stringify(prev.dest)} by ${prev.source} ` +
          `and to ${JSON.stringify(dest)} by ${source}. The requirements contradict each other; ` +
          `this suite refuses to pick a winner.`);
      }
      if (!prev) byTerm.set(t.key, { dest, source });
    }
  };

  for (const o of DESTINATION_ORACLES) {
    const line = requirementLine(o.id);
    let dest;
    if (o.destination) {
      assert.ok(o.earnedBy.test(line),
        `${o.id} is taken to assign ${o.destination} because it resolves through ` +
        `${o.earnedBy}, and its line no longer does:\n${line}`);
      assert.ok(!o.forbids.test(line),
        `${o.id} now names a knowledge store in the wording ${o.forbids}; its destination can no ` +
        `longer be supplied here:\n${line}`);
      dest = o.destination;
    } else {
      dest = destinationOf(line);
    }
    claim(TERMS.filter((t) => t.re.test(line)), dest, o.id);
  }

  // OQ-5 — a story-level DECISION, not a requirement (AC4 says so explicitly).
  // Its destination is read out of the recorded sentence, and applied to exactly
  // the terms that sentence names.
  const oq5 = oq5DecisionSentence();
  claim(TERMS.filter((t) => t.re.test(oq5.sentence)), oq5.store, `OQ-5 (${oq5.date})`);

  const orphans = TERMS.filter((t) => !byTerm.has(t.key)).map((t) => t.key);
  if (orphans.length) {
    throw new Error(`no requirement or recorded decision assigns a destination to ` +
      `${JSON.stringify(orphans)}. Every artifact term must have an authority outside the ` +
      `routing table, or the table's own cell becomes its own oracle.`);
  }
  return byTerm;
}

let ARTIFACT_ORACLE;
try {
  ARTIFACT_ORACLE = buildArtifactOracle();
} catch (e) {
  console.error('\n  FATAL: the per-artifact destination oracle could not be built: ' + e.message);
  process.exit(1);
}

/**
 * The destination a row's ARTIFACT requires — computed with no reference
 * whatsoever to that row's own `store` cell.
 */
function requiredDestinationOf(r) {
  const matched = TERMS.filter((t) => t.re.test(r.artifact));
  if (matched.length === 0) {
    throw new Error(`routing table row ${r.num} ("${r.artifact}") names no artifact this suite ` +
      `has an outside authority for, so nothing at all checks its destination cell — it could ` +
      `say anything. Either add the artifact to TERMS together with the requirement that assigns ` +
      `it a store, or do not ship the row.`);
  }
  const dests = [...new Set(matched.map((t) => ARTIFACT_ORACLE.get(t.key).dest))];
  if (dests.length !== 1) {
    throw new Error(`routing table row ${r.num} ("${r.artifact}") names artifacts belonging to ` +
      `different destinations (${JSON.stringify(dests)}); one row cannot route to two stores`);
  }
  return { dest: dests[0], terms: matched };
}

// ═════════════════════════════════════════════════════════════════════════════
// Real fixtures — a real binding, the real generator, the real config.yaml.
// ═════════════════════════════════════════════════════════════════════════════

function withTmpProject(fn) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-route6-')));
  const root = path.join(base, 'project');
  fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
  const origCwd = process.cwd();
  try {
    process.chdir(root);
    return fn({ base, root });
  } finally {
    process.chdir(origCwd);
    try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) { /* Windows lock */ }
  }
}

function quiet(fn) {
  const origLog = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = origLog; }
}

function writeBinding(root, body) {
  fs.writeFileSync(path.join(root, LAYOUT_REL), body, 'utf-8');
}

function generate(root) {
  const wrote = quiet(() => cli.generateBmmConfig({ projectRoot: root }));
  assert.strictEqual(wrote, true, 'the generator refused to write config.yaml for this fixture');
  return yamlOracle.load(fs.readFileSync(path.join(root, CONFIG_REL), 'utf-8'));
}

function fsStore(p) {
  return ['  backend: file-system', '  mode: local', `  path: ${JSON.stringify(p)}`];
}

function schema2Binding(systemPath, softwarePath, sprintPath) {
  return [
    'schema_version: 2',
    'generated: "2026-08-15T00:00:00.000Z"',
    'system_requirements_store:', ...fsStore(systemPath),
    'software_requirements_store:', ...fsStore(softwarePath),
    'sprint_management:', ...fsStore(sprintPath),
    '',
  ].join('\n');
}

// The pre-F26 shape: no schema_version, ONE `knowledgebase` record standing for
// both stores. This is what a legacy project actually has on disk.
function schema1Binding() {
  return [
    'knowledgebase:',
    '  mode: same',
    '  path: "."',
    'sprint_management:',
    '  mode: same',
    '  path: "."',
    '',
  ].join('\n');
}

function schema2DefaultsBinding() {
  return [
    'schema_version: 2',
    'generated: "2026-08-15T00:00:00.000Z"',
    'system_requirements_store:', '  backend: file-system', '  mode: same', '  path: "."',
    'software_requirements_store:', '  backend: file-system', '  mode: same', '  path: "."',
    'sprint_management:', '  mode: same', '  path: "."',
    '',
  ].join('\n');
}

/**
 * The three artifact DIRECTORIES a config.yaml resolves to, per Section 2 of the
 * shipped table. Two of the three are fields the generator writes; the system
 * one is the rule workflows follow.
 *
 * FIX-ROUND, BLOCKING-3. This function used to be an INDEPENDENT
 * re-implementation of the system rule, and Section 2 of the shipped document
 * was checked against nothing at all — rewriting its system row to "always
 * `implementation_artifacts`, regardless of `system_requirements_path`" survived
 * the whole suite. The rule is now PARSED from the document and EVALUATED
 * against `generateBmmConfig`'s own output by
 * `Section 2's THREE derivations are the real generator's`, which additionally
 * requires this function to agree with the generator. It is kept as a helper for
 * readability, not as an authority.
 */
function directoriesOf(cfg) {
  const canonPlanning = '{project-root}/_bmad-output/planning-artifacts';
  return {
    [SYSTEM]: cfg.system_requirements_path === '.' ? canonPlanning : cfg.system_requirements_path,
    [SOFTWARE]: cfg.planning_artifacts,
    [SPRINT]: cfg.implementation_artifacts,
  };
}

/**
 * Section 2's three derivation rules, PARSED out of the shipped document.
 *
 * All three cells are required to be in ONE shape — `` `field` when it is not
 * `.`; otherwise `literal` `` — so that each can be EVALUATED against a real
 * generated config rather than read as prose. A cell in any other shape throws:
 * an unevaluatable rule is an unchecked one, which is how the system row came to
 * be freely rewritable.
 */
function parseDerivationTable() {
  const section = tableSection('## 2. Directory derivation');
  const rules = {};
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 3) continue;
    if (/^-+$/.test(cells[0]) || cells[0] === 'Destination') continue;
    const [dest, rule, writtenInto] = cells;
    if (!DESTINATIONS.includes(dest)) {
      throw new Error(`section 2 states a derivation for ${JSON.stringify(dest)}, which is not ` +
        `one of ${JSON.stringify(DESTINATIONS)}`);
    }
    const m = rule.match(/^`([a-z_]+)` when it is not `\.`; otherwise `([^`]+)`$/);
    if (!m) {
      throw new Error(`section 2's derivation for "${dest}" is not in the single shape all three ` +
        `are stated in (\`<field>\` when it is not \`.\`; otherwise \`<literal>\`), so it cannot ` +
        `be evaluated against the generator and nothing would check it: ${JSON.stringify(rule)}`);
    }
    const wi = writtenInto.match(/^`([a-z_]+)`$/);
    rules[dest] = { field: m[1], fallback: m[2], writtenInto: wi ? wi[1] : null };
  }
  for (const d of DESTINATIONS) {
    if (!rules[d]) throw new Error(`section 2 states no directory derivation for "${d}"`);
  }
  return rules;
}

/** A parsed Section-2 rule, applied to a real generated config. */
const applyRule = (rule, cfg) => (cfg[rule.field] === '.' ? rule.fallback : cfg[rule.field]);

// Three locations that are genuinely different places, so "resolves to X" can
// never be vacuously true.
const SYS_LOC = 'sysreq-store';
const SW_LOC = 'swreq-store';
const SP_LOC = 'sprint-store';

function divergentFixture(fn) {
  return withTmpProject(({ base, root }) => {
    for (const d of [SYS_LOC, SW_LOC, SP_LOC]) fs.mkdirSync(path.join(base, d), { recursive: true });
    writeBinding(root, schema2Binding(
      path.join(base, SYS_LOC), path.join(base, SW_LOC), path.join(base, SP_LOC)));
    const cfg = generate(root);
    return fn(cfg, { base, root });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. the shipped routing table parses, and assigns every row ===\n');
// ═════════════════════════════════════════════════════════════════════════════

test('AC6 the routing table exists in the epic\'s implementation artifacts', () => {
  assert.ok(fs.existsSync(path.join(PROJECT_ROOT, TABLE_REL)), `missing: ${TABLE_REL}`);
  assert.ok(ROWS.length >= 12,
    `a routing table covering FR119, FR256 and FR120/FR267 cannot have ${ROWS.length} rows`);
});

test('AC4 every row declares one of exactly three destinations — none unassigned', () => {
  // `parseRoutingTable` throws on an unknown token, so reaching here already
  // proves it. Asserted again as a value check so the guarantee is visible at
  // the point a reader looks for it, and so deleting the parser check alone
  // does not leave AC4 unenforced.
  for (const r of ROWS) {
    assert.ok(DESTINATIONS.includes(r.store),
      `row ${r.num} ("${r.artifact}") has destination ${JSON.stringify(r.store)}`);
    assert.ok(!/\bTBD\b|\bopen\b|\bunassigned\b|\?\?/i.test(r.store + ' ' + r.artifact),
      `row ${r.num} reads as undecided: ${JSON.stringify(r)}`);
  }
});

test('AC4 all three destinations are actually used — the table is not one-sided', () => {
  for (const d of DESTINATIONS) {
    assert.ok(rowsFor(d).length > 0, `no row routes anything to "${d}"`);
  }
});

test('row indices are unique and contiguous from 1', () => {
  const nums = ROWS.map((r) => r.num);
  assert.deepStrictEqual(nums, nums.slice().sort((a, b) => a - b), 'rows are not in index order');
  assert.deepStrictEqual(new Set(nums).size, nums.length, 'duplicate row index');
  assert.strictEqual(nums[0], 1, 'the table does not start at row 1');
  assert.strictEqual(nums[nums.length - 1], nums.length,
    'row indices are not contiguous — a row was deleted without renumbering, which is how a ' +
    'reviewer counting coverage gets a wrong count');
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX-ROUND, BLOCKING-2 and BLOCKING-3. The claims this suite makes about the
// table were pinned; the table's SHAPE was not. A reviewer's mutation run
// deleted row 14 and renumbered 15→14, 16→15 (the contiguity check above is
// satisfied by renumbering, and `rowsFor(SPRINT).length` still cleared its
// `>= 4` floor); ADDED a seventeenth row; and deleted sections 1, 2, 5 and 7
// outright — all with the suite green.
//
// A deliverable whose sections and rows can vanish is not a specification. So
// the shape is fingerprinted. This is deliberately a CHANGE DETECTOR and not a
// semantic claim: it does not know what the table should say, only that saying
// something different is a deliberate act. Every failure prints the current
// shape, so updating it is one paste — and updating it lands in the same commit
// as the edit, where a reviewer sees both.
// ─────────────────────────────────────────────────────────────────────────────
const SHIPPED_TABLE_FINGERPRINT = Object.freeze({
  sections: 'd3690a1f691ecb0d05085ee23895861f8f03a9facf4b3fa32d0e67016447974b',
  rows: 'd5b7ceb738e9390c326d63b6346ca0aef339c178cf8edd41d760c8ebb5fc84c9',
});

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf-8').digest('hex');

/** Every `## ` heading of the shipped document, in order. */
function sectionHeadings() {
  const body = fs.readFileSync(path.join(PROJECT_ROOT, TABLE_REL), 'utf-8').replace(/\r\n/g, '\n');
  return body.split('\n').filter((l) => /^## /.test(l)).map((l) => l.trim());
}

/** Every row of Section 3, rendered canonically. */
function rowFingerprintText() {
  return ROWS.map((r) => `${r.num}|${r.artifact}|${r.store}|${r.source}`).join('\n');
}

test('AC6 the shipped table\'s SECTION SET is pinned — no section can be deleted silently', () => {
  const headings = sectionHeadings();
  assert.ok(headings.length >= 7,
    `the deliverable should carry at least its seven numbered sections; found ${headings.length}`);
  // Every heading must also delimit a NON-EMPTY section — `tableSection` throws
  // otherwise — so a section cannot be hollowed out and leave its heading behind.
  for (const h of headings) tableSection(h);
  assert.strictEqual(sha256(headings.join('\n')), SHIPPED_TABLE_FINGERPRINT.sections,
    `the shipped routing table's section set changed. If that was intended, update\n` +
    `SHIPPED_TABLE_FINGERPRINT.sections in this file, in the same commit. Current sections:\n` +
    headings.map((h) => '  ' + h).join('\n') + `\n  sha256 = ${sha256(headings.join('\n'))}`);
});

test('AC6 the shipped table\'s ROW SET is pinned — no row can be added, deleted or renumbered', () => {
  const text = rowFingerprintText();
  assert.strictEqual(sha256(text), SHIPPED_TABLE_FINGERPRINT.rows,
    `the shipped routing table's rows changed. Deleting a row and renumbering the rest passes ` +
    `every other check in this suite, which is why this one exists. If the change was intended, ` +
    `update SHIPPED_TABLE_FINGERPRINT.rows in the same commit. Current rows:\n` +
    text.split('\n').map((l) => '  ' + l).join('\n') + `\n  sha256 = ${sha256(text)}`);
});

test('no artifact is claimed by two different destinations', () => {
  const seen = new Map();
  for (const r of ROWS) {
    const key = r.artifact.toLowerCase();
    if (seen.has(key)) {
      assert.strictEqual(seen.get(key), r.store,
        `"${r.artifact}" appears twice with different owning stores`);
    }
    seen.set(key, r.store);
  }
});

test('NB-6 every rule-source cell cites something that actually exists', () => {
  // FIX-ROUND, NB-6. `parseRoutingTable` checked only `if (!source)`, so the
  // Rule-source column accepted anything non-empty: `FR999` survived, and so did
  // replacing every `FR255` citation with the word `whatever`. A routing table
  // whose authority column is unvalidated invites exactly the fabricated-citation
  // defect Story 31.2's R-6 already caught once in `bin/cli.js`.
  const stated = prdRequirementIds();
  assert.ok(stated.size >= 10,
    `${PRD_REL} states only ${stated.size} requirements — the citation oracle has gone stale`);
  const decisionSection = tableSection('## 4.');
  for (const r of ROWS) {
    const ids = r.source.match(/\bN?FR\d+\b/g) || [];
    const questions = r.source.match(/\bOQ-\d+\b/g) || [];
    assert.ok(ids.length + questions.length > 0,
      `row ${r.num} ("${r.artifact}") cites ${JSON.stringify(r.source)}, which names no ` +
      `requirement (FR/NFR) and no recorded open question (OQ-n). A row's authority is what ` +
      `makes its destination reviewable; free text is not an authority.`);
    for (const id of ids) {
      assert.ok(stated.has(id),
        `row ${r.num} ("${r.artifact}") cites ${id} as its rule source, but ${PRD_REL} states no ` +
        `such requirement. Stated ids: ${JSON.stringify([...stated].sort())}`);
    }
    for (const q of questions) {
      assert.ok(decisionSection.includes(q),
        `row ${r.num} ("${r.artifact}") cites ${q}, which Section 4 does not record a decision ` +
        `for. AC4 requires the choice to be recorded, not merely cited.`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. coverage, checked against the PRD and not against a copy of the table ===\n');
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Every artifact term the requirement line NAMES must appear in the table, in
 * the destination the requirement (or, for FR119, the store requirements)
 * assigns. `expectedStore` is passed only where the line itself does not carry
 * one.
 */
function assertCoverage(id, expectedStore) {
  const line = requirementLine(id);
  const dest = expectedStore || destinationOf(line);
  const named = TERMS.filter((t) => t.re.test(line));
  assert.ok(named.length > 0,
    `${id}'s line names none of the artifact terms this suite knows — the coverage oracle has ` +
    `gone stale against the PRD:\n${line}`);
  const haystack = artifactText(dest);
  const missing = named.filter((t) => !t.re.test(haystack)).map((t) => t.key);
  assert.deepStrictEqual(missing, [],
    `${id} names ${JSON.stringify(missing)}, but the routing table has no "${dest}" row for ` +
    `them. Rows present for that destination: ${JSON.stringify(rowsFor(dest).map((r) => r.artifact))}`);
}

test('AC1/FR255 every artifact FR255 names has a system-requirements row', () => {
  assertCoverage('FR255');
});

test('AC2/FR256 every artifact FR256 names has a software-requirements row', () => {
  assertCoverage('FR256');
});

test('AC3/FR267 story files and implementation artifacts have sprint-management rows', () => {
  assertCoverage('FR267');
});

test('AC4/FR119 every artifact type FR119 enumerates appears somewhere in the table', () => {
  // FR119 names no store — it predates the split — so coverage here is over the
  // WHOLE table. This is the AC4 check: "every artifact type FR119 names has a
  // declared owning store".
  const line = requirementLine('FR119');
  const named = TERMS.filter((t) => t.re.test(line));
  assert.ok(named.length >= 5,
    `FR119 should name at least brief, PRD, architecture, UX design and research; matched ` +
    `${JSON.stringify(named.map((t) => t.key))}`);
  const all = ROWS.map((r) => r.artifact).join(' ; ').toLowerCase();
  const missing = named.filter((t) => !t.re.test(all)).map((t) => t.key);
  assert.deepStrictEqual(missing, [],
    `FR119 names ${JSON.stringify(missing)} and the routing table assigns them to nothing`);
});

test('AC4/OQ-5 all three research reports are routed, and to the SOFTWARE store', () => {
  const research = ROWS.filter((r) => /research/i.test(r.artifact));
  assert.strictEqual(research.length, 3,
    `expected domain, market and technical research to be three separate rows; got ` +
    `${JSON.stringify(research.map((r) => r.artifact))}`);
  for (const kind of ['domain', 'market', 'technical']) {
    const row = research.find((r) => new RegExp(kind, 'i').test(r.artifact));
    assert.ok(row, `no routing row for the ${kind} research report`);
    assert.strictEqual(row.store, SOFTWARE,
      `OQ-5 was DECIDED on 2026-08-12: research reports belong to the software requirements ` +
      `store. Row ${row.num} says ${JSON.stringify(row.store)}.`);
  }
});

test('AC4/OQ-5 the decision is RECORDED with its rationale, not just applied', () => {
  // MUTATION FINDING (survivors M24b/M24c). This test originally grepped the
  // WHOLE file. Deleting the entire OQ-5 decision record survived, because
  // "OQ-5", "2026-08-12" and "NFR82" all still occurred elsewhere — in the
  // table's own Rule-source cells and in the directory-derivation section. That
  // is proof of presence rather than proof of the record, the exact shape this
  // epic keeps producing. The record is now located and read on its own.
  const section = tableSection('## 4.');
  assert.ok(/OQ-5/.test(section), 'the decision section never names the open question it settles');
  assert.ok(/2026-08-12/.test(section), 'the decision date is not recorded in the decision itself');
  assert.ok(/\bDecision\b/.test(section) && /software requirements\s*\n?store|SOFTWARE requirements/i.test(section),
    'the section does not state the decision it is the record of');
  // MUTATION FINDING (survivor M24c). A whole-section `NFR82` check also
  // survived deleting the rationale, because the REJECTED-alternative bullet
  // mentions NFR82 too ("would need an explicit NFR82 exemption"). So the
  // rationale is located as its own bullet and read there.
  const rationale = section.split(/\n(?=- \*\*)/).find((b) => /^- \*\*Rationale/.test(b.trim()));
  assert.ok(rationale,
    'the decision section records no **Rationale** — AC4 asks for the choice to be recorded as a ' +
    'story-level decision, and a decision with no stated reason is a bare assertion');
  assert.ok(/NFR82/.test(rationale),
    `the recorded rationale must rest on NFR82 (FR264's legacy fields already resolve to the ` +
    `software store, so no project's research paths move); it says instead:\n${rationale.trim()}`);
  const rejected = (section.match(/\*\*Rejected/g) || []).length;
  assert.ok(rejected >= 2,
    `AC4 wants the choice recorded as a story-level DECISION; a decision record names what was ` +
    `rejected and why. Found ${rejected} rejected alternatives in the section (expected the two ` +
    `on record: the system store, and a split by research type).`);
});

test('AC4/OQ-5 the decision is attributed to the USER who made it', () => {
  // FIX-ROUND, NB-5. The previous round pinned the decision's DATE but not its
  // attribution, so `**Decision (user, 2026-08-12)` → `**Decision (implementer,
  // …)` survived. The attribution is the whole point of the record: AC4 requires
  // the choice to be recorded as a story-level decision "rather than invented as
  // a requirement", and OQ-5 was a product decision the user made. An
  // implementer-attributed OQ-5 IS the invention AC4 forbids.
  const d = oq5DecisionSentence();
  assert.strictEqual(d.who, 'user',
    `Section 4 attributes the OQ-5 decision to "${d.who}". OQ-5 was a product choice made by the ` +
    `user on ${d.date}; recording it as anyone else's makes it an implementer invention, which ` +
    `is exactly what AC4 says it must not be.`);
  assert.strictEqual(d.date, '2026-08-12');
  assert.strictEqual(d.store, SOFTWARE);
});

test('AC4/OQ-5 the recorded RATIONALE is a checkable claim, and it holds', () => {
  // FIX-ROUND, NB-5. `/NFR82/.test(rationale)` is proof of presence: replacing
  // the whole rationale with "we picked the software store by coin flip. NFR82
  // is preserved." survived it. The rationale's actual claim is that FR264's
  // legacy config fields ALREADY resolve to the software store, so no existing
  // project's research paths move — and that is measurable. The config fields
  // the rationale names are read out of it and checked against a real generated
  // config, so a rationale that names none, or names the wrong ones, fails.
  const section = tableSection('## 4.');
  const rationale = section.split(/\n(?=- \*\*)/).find((b) => /^- \*\*Rationale/.test(b.trim()));
  assert.ok(rationale, 'the decision section records no **Rationale**');
  const fields = [...new Set((rationale.match(/`([a-z_]+)`/g) || []).map((s) => s.slice(1, -1)))];
  assert.ok(fields.length >= 2,
    `the recorded rationale names ${JSON.stringify(fields)} — fewer than the two legacy config ` +
    `fields its claim rests on. A rationale that names nothing measurable is a bare assertion ` +
    `dressed as a reason:\n${rationale.trim()}`);
  divergentFixture((cfg) => {
    for (const f of fields) {
      assert.ok(Object.prototype.hasOwnProperty.call(cfg, f),
        `the rationale rests on config field \`${f}\`, which generateBmmConfig does not write`);
      assert.ok(String(cfg[f]).includes(SW_LOC),
        `the rationale claims \`${f}\` already resolves to the SOFTWARE store, so routing ` +
        `research there moves nothing. In a real generated config with the two stores apart, ` +
        `\`${f}\` is ${JSON.stringify(cfg[f])}, which is not the software store.`);
    }
  });
});

test('the PRD assigns FR255 to the system store and FR256 to the software store', () => {
  // Guards the coverage oracle itself: if `destinationOf` ever silently read the
  // wrong store out of a line, every coverage test above would check the wrong
  // column and still pass.
  assert.strictEqual(destinationOf(requirementLine('FR255')), SYSTEM);
  assert.strictEqual(destinationOf(requirementLine('FR256')), SOFTWARE);
  assert.strictEqual(destinationOf(requirementLine('FR267')), SPRINT);
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. resolution against a REAL generated config.yaml (AC1, AC2, AC3, AC5) ===\n');
// ═════════════════════════════════════════════════════════════════════════════

test('the fixture really does put the three destinations in three different places', () => {
  // Asserted FIRST and on its own. Every "row X resolves to destination D" test
  // below is vacuous if two destinations collapse, and a fixture that quietly
  // collapsed would make this whole section green while proving nothing.
  divergentFixture((cfg) => {
    const dirs = directoriesOf(cfg);
    const values = DESTINATIONS.map((d) => dirs[d]);
    for (const v of values) {
      assert.ok(v && typeof v === 'string', `a destination resolved to ${JSON.stringify(v)}`);
    }
    assert.strictEqual(new Set(values).size, 3,
      `the three destinations must resolve to three distinct directories; got ` +
      `${JSON.stringify(dirs)}`);
  });
});

test('AC5 the generated config.yaml carries every field routing resolves from', () => {
  divergentFixture((cfg) => {
    for (const f of ['system_requirements_path', 'software_requirements_path',
      'knowledgebase_path', 'planning_artifacts', 'sprint_management_path',
      'implementation_artifacts']) {
      assert.ok(Object.prototype.hasOwnProperty.call(cfg, f),
        `generated config.yaml has no ${f} — workflows cannot resolve without it`);
    }
  });
});

test('AC5 the software derivation this table states IS the generator\'s own', () => {
  // Binds Section 2 of the shipped table to `generateBmmConfig` rather than to a
  // restatement of it: the rule "the artifacts directory is the store path,
  // except that `.` gives the canonical planning folder" is applied here to the
  // generator's `software_requirements_path` and required to equal the
  // generator's `planning_artifacts`.
  divergentFixture((cfg) => {
    const derived = cfg.software_requirements_path === '.'
      ? '{project-root}/_bmad-output/planning-artifacts'
      : cfg.software_requirements_path;
    assert.strictEqual(cfg.planning_artifacts, derived,
      'the derivation the routing table publishes disagrees with what the generator writes');
  });
  withTmpProject(({ root }) => {
    writeBinding(root, schema2DefaultsBinding());
    const cfg = generate(root);
    assert.strictEqual(cfg.software_requirements_path, '.');
    assert.strictEqual(cfg.planning_artifacts, '{project-root}/_bmad-output/planning-artifacts',
      'the `.` branch of the published derivation is wrong');
  });
});

/**
 * The ONE per-row check, shared by the three group tests below.
 *
 * FIX-ROUND, BLOCKING-1. `expected` is resolved from the row's ARTIFACT through
 * `requiredDestinationOf` — the PRD's own requirement lines and the recorded
 * OQ-5 decision. It is never read from `r.store`, which is what made the
 * previous `assert.strictEqual(dirs[r.store], dirs[GROUP])` a tautology. The
 * row's own cell is the thing UNDER TEST here, not the source of the answer.
 */
function assertRowRoutes(cfg, r, group) {
  const dirs = directoriesOf(cfg);
  const { dest: expected, terms } = requiredDestinationOf(r);
  const why = terms.map((t) => `${t.key} (per ${ARTIFACT_ORACLE.get(t.key).source})`).join(', ');

  assert.strictEqual(r.store, expected,
    `row ${r.num} ("${r.artifact}") declares owning store ${JSON.stringify(r.store)}, but the ` +
    `artifact it names belongs to ${JSON.stringify(expected)} — ${why}. The routing table is the ` +
    `specification, so a cell that disagrees with the requirement is the defect, not the oracle.`);
  assert.strictEqual(expected, group,
    `row ${r.num} ("${r.artifact}") was selected into the "${group}" group but its artifact ` +
    `belongs to ${JSON.stringify(expected)} — ${why}`);

  // ...and the destination its artifact requires really does resolve to a
  // different directory from the other two, in a real generated config.
  for (const other of DESTINATIONS) {
    if (other === expected) continue;
    assert.notStrictEqual(dirs[expected], dirs[other],
      `row ${r.num} ("${r.artifact}") belongs to ${expected} but that resolves to the same ` +
      `directory as ${other} (${JSON.stringify(dirs[expected])}), so the claim is vacuous`);
  }
  assert.strictEqual(dirs[r.store], dirs[expected],
    `row ${r.num} ("${r.artifact}") resolves to ${JSON.stringify(dirs[r.store])}, but its ` +
    `artifact requires ${JSON.stringify(dirs[expected])}`);
}

test('AC1 every system-requirements row resolves to the system store, and to nothing else', () => {
  divergentFixture((cfg) => {
    const rows = rowsFor(SYSTEM);
    assert.ok(rows.length >= 4, `expected brief, PRD, shard index and shards; got ${rows.length}`);
    for (const r of rows) assertRowRoutes(cfg, r, SYSTEM);
  });
});

test('AC2 every software-requirements row resolves to the software store, and to nothing else', () => {
  divergentFixture((cfg) => {
    const rows = rowsFor(SOFTWARE);
    assert.ok(rows.length >= 6,
      `expected architecture, its shards, UX, epics and three research reports; got ${rows.length}`);
    for (const r of rows) assertRowRoutes(cfg, r, SOFTWARE);
  });
});

test('AC3/FR267 every sprint row resolves to sprint management and to NEITHER store', () => {
  divergentFixture((cfg) => {
    const rows = rowsFor(SPRINT);
    assert.ok(rows.length >= 4, `expected stories, sprint-status.yaml, bugs, retrospectives`);
    for (const r of rows) assertRowRoutes(cfg, r, SPRINT);
  });
});

test('AC1/AC2/AC3 EVERY row, checked against the artifact it names — group-independent', () => {
  // The three tests above iterate groups, so a row that vanished from every
  // group (because its artifact cell changed) would be checked by none of them.
  // This one walks the table itself.
  divergentFixture((cfg) => {
    assert.strictEqual(
      rowsFor(SYSTEM).length + rowsFor(SOFTWARE).length + rowsFor(SPRINT).length, ROWS.length,
      'a row belongs to no destination group, so the three group tests skip it entirely');
    for (const r of ROWS) assertRowRoutes(cfg, r, requiredDestinationOf(r).dest);
  });
});

test('the per-artifact oracle really is independent of the table it checks', () => {
  // Guards the oracle. If `ARTIFACT_ORACLE` ever came to be derived from the
  // table, every check above would be a tautology again — the exact defect this
  // fix round is closing — and would still be green. So: the oracle must assign
  // every artifact term, must cite a source outside this document for each, and
  // must use all three destinations.
  assert.strictEqual(ARTIFACT_ORACLE.size, TERMS.length,
    'the oracle does not cover every artifact term');
  const usedDests = new Set([...ARTIFACT_ORACLE.values()].map((v) => v.dest));
  assert.deepStrictEqual([...usedDests].sort(), [...DESTINATIONS].sort(),
    `the oracle only ever assigns ${JSON.stringify([...usedDests])} — it cannot distinguish rows`);
  for (const [key, v] of ARTIFACT_ORACLE) {
    assert.ok(/^(?:N?FR\d+|OQ-\d+ \(\d{4}-\d{2}-\d{2}\))$/.test(v.source),
      `"${key}" is assigned by ${JSON.stringify(v.source)}, which is not a PRD requirement or a ` +
      `dated recorded decision`);
  }
  // And the destinations FR255/FR256/FR267 assign are read from their own words,
  // so a swapped oracle would be caught here rather than silently invert AC1/AC2.
  assert.strictEqual(ARTIFACT_ORACLE.get('product brief').dest, SYSTEM);
  assert.strictEqual(ARTIFACT_ORACLE.get('architecture').dest, SOFTWARE);
  assert.strictEqual(ARTIFACT_ORACLE.get('story files').dest, SPRINT);
});

test('AC5 Section 2\'s THREE derivations are the real generator\'s, evaluated — not prose', () => {
  // FIX-ROUND, BLOCKING-3. Section 2 published a rule per destination and only
  // the SOFTWARE one was bound to `generateBmmConfig`; the system rule was
  // re-implemented inside this file's `directoriesOf`, so the document's own
  // sentence was read by nobody and could say anything.
  //
  // Now each rule is PARSED and EVALUATED, and the answer it must reproduce is
  // computed BY THE GENERATOR: `generatorDirFor(p)` puts the software store at
  // `p` in this same project and reads the `planning_artifacts` the generator
  // writes. Same project root throughout, so the portable-path relativisation
  // base is identical and nothing is re-derived here.
  const rules = parseDerivationTable();
  withTmpProject(({ base, root }) => {
    for (const d of [SYS_LOC, SW_LOC, SP_LOC]) fs.mkdirSync(path.join(base, d), { recursive: true });
    const sys = path.join(base, SYS_LOC);
    const sw = path.join(base, SW_LOC);
    const sp = path.join(base, SP_LOC);

    const generatorDirFor = (p) => {
      writeBinding(root, schema2Binding(p, p, sp));
      return generate(root).planning_artifacts;
    };
    const dirAtSys = generatorDirFor(sys);
    const dirAtSw = generatorDirFor(sw);
    const dirAtDot = generatorDirFor('.');
    writeBinding(root, schema2Binding(sys, sw, '.'));
    const dotSprint = generate(root).implementation_artifacts;

    writeBinding(root, schema2Binding(sys, sw, sp));
    const cfg = generate(root);

    // (a) the NON-`.` branch of every published rule reproduces the generator.
    assert.strictEqual(applyRule(rules[SYSTEM], cfg), dirAtSys,
      `Section 2's system derivation (${JSON.stringify(rules[SYSTEM])}) does not produce the ` +
      `directory generateBmmConfig derives for a store at the system store's location`);
    assert.strictEqual(applyRule(rules[SOFTWARE], cfg), dirAtSw,
      `Section 2's software derivation does not produce the generator's own answer`);
    assert.strictEqual(applyRule(rules[SOFTWARE], cfg), cfg.planning_artifacts);
    assert.strictEqual(applyRule(rules[SPRINT], cfg), cfg.implementation_artifacts,
      `Section 2's sprint derivation disagrees with the generator's implementation_artifacts`);

    // (b) the `.` branch — each fallback literal is the generator's own answer
    // for a store at `.`, never a string this test knows.
    assert.strictEqual(rules[SYSTEM].fallback, dirAtDot,
      `Section 2 says a system store at "." resolves to ${JSON.stringify(rules[SYSTEM].fallback)}; ` +
      `the generator derives ${JSON.stringify(dirAtDot)}`);
    assert.strictEqual(rules[SOFTWARE].fallback, dirAtDot);
    assert.strictEqual(rules[SPRINT].fallback, dotSprint);

    // (c) THE MIXED CASE, which is the only one that distinguishes the system
    // rule from the software rule: system store left here, software store moved.
    // Section 2 used to say "otherwise `planning_artifacts`", which in this case
    // is the SOFTWARE store's directory — routing the PRD into the wrong store.
    writeBinding(root, schema2Binding('.', sw, sp));
    const mixed = generate(root);
    assert.strictEqual(mixed.system_requirements_path, '.', 'precondition: system store stayed here');
    assert.notStrictEqual(mixed.planning_artifacts, dirAtDot,
      'precondition: the software store must actually have moved away from the local folder');
    assert.strictEqual(applyRule(rules[SYSTEM], mixed), dirAtDot,
      `with only the software store moved, the system store still resolves to the local planning ` +
      `folder; Section 2's rule instead produced ${JSON.stringify(applyRule(rules[SYSTEM], mixed))}`);
    assert.notStrictEqual(applyRule(rules[SYSTEM], mixed), mixed.planning_artifacts,
      'Section 1 says no artifact belongs to more than one destination, yet Section 2 routes the ' +
      'system store into the software store\'s directory');

    // (d) this suite's own `directoriesOf` TAKES the generator's derivation
    // rather than being a second, drifting implementation of it.
    assert.strictEqual(directoriesOf(cfg)[SYSTEM], dirAtSys,
      'directoriesOf() re-implements the system derivation and disagrees with the generator');
    assert.strictEqual(directoriesOf(cfg)[SOFTWARE], cfg.planning_artifacts);
    assert.strictEqual(directoriesOf(cfg)[SPRINT], cfg.implementation_artifacts);
    assert.strictEqual(directoriesOf(mixed)[SYSTEM], dirAtDot);

    // (e) the "config field the generator writes it into" column, earned.
    assert.strictEqual(rules[SOFTWARE].writtenInto, 'planning_artifacts');
    assert.strictEqual(rules[SPRINT].writtenInto, 'implementation_artifacts');
    assert.strictEqual(rules[SYSTEM].writtenInto, null,
      'Section 2 claims the generator writes the system artifacts directory into a config field');
    const holders = Object.entries(mixed).filter(([, v]) => v === dirAtDot).map(([k]) => k);
    assert.deepStrictEqual(holders, [],
      `Section 2 says no config field carries the system artifacts directory, but ` +
      `${JSON.stringify(holders)} does — workflows should read it instead of deriving it`);
  });
});

test('AC3/FR267 the STORY-FILE row specifically follows sprint management', () => {
  // Named on its own because it is the one FR267 exists for, and because a
  // for-each loop that lost the story row would still be green.
  const story = ROWS.find((r) => /story file/i.test(r.artifact));
  assert.ok(story, 'the routing table has no row for story files at all');
  assert.strictEqual(story.store, SPRINT,
    `story files follow sprint_management_path (FR267); the table says ${story.store}`);
  divergentFixture((cfg) => {
    const dirs = directoriesOf(cfg);
    assert.strictEqual(dirs[SPRINT], cfg.implementation_artifacts);
    assert.strictEqual(cfg.implementation_artifacts, cfg.sprint_management_path,
      'with a non-`.` sprint path, implementation_artifacts IS the sprint path');
    assert.notStrictEqual(cfg.implementation_artifacts, cfg.system_requirements_path);
    assert.notStrictEqual(cfg.implementation_artifacts, cfg.software_requirements_path);
  });
});

test('AC3/FR267 MOVING BOTH STORES does not move the stories', () => {
  // The requirement in its own words: "a project that moves its knowledge stores
  // does not move its stories". Measured as a before/after on the real generator
  // rather than asserted about a table cell.
  withTmpProject(({ base, root }) => {
    for (const d of ['a', 'b', 'c', 'd', 'sp']) fs.mkdirSync(path.join(base, d), { recursive: true });
    const sprint = path.join(base, 'sp');
    writeBinding(root, schema2Binding(path.join(base, 'a'), path.join(base, 'b'), sprint));
    const before = generate(root);

    writeBinding(root, schema2Binding(path.join(base, 'c'), path.join(base, 'd'), sprint));
    const after = generate(root);

    assert.notStrictEqual(after.system_requirements_path, before.system_requirements_path,
      'precondition: the system store must actually have moved');
    assert.notStrictEqual(after.software_requirements_path, before.software_requirements_path,
      'precondition: the software store must actually have moved');
    assert.strictEqual(after.sprint_management_path, before.sprint_management_path,
      'moving the knowledge stores moved sprint management');
    assert.strictEqual(after.implementation_artifacts, before.implementation_artifacts,
      'FR267 violated: moving the knowledge stores moved where story files live');
  });
});

test('AC3 moving SPRINT MANAGEMENT does not move either store — the converse pin', () => {
  withTmpProject(({ base, root }) => {
    for (const d of ['sys', 'sw', 'sp1', 'sp2']) fs.mkdirSync(path.join(base, d), { recursive: true });
    const sys = path.join(base, 'sys');
    const sw = path.join(base, 'sw');
    writeBinding(root, schema2Binding(sys, sw, path.join(base, 'sp1')));
    const before = generate(root);
    writeBinding(root, schema2Binding(sys, sw, path.join(base, 'sp2')));
    const after = generate(root);

    assert.notStrictEqual(after.implementation_artifacts, before.implementation_artifacts,
      'precondition: sprint management must actually have moved');
    assert.strictEqual(after.system_requirements_path, before.system_requirements_path);
    assert.strictEqual(after.software_requirements_path, before.software_requirements_path);
    assert.strictEqual(after.planning_artifacts, before.planning_artifacts);
  });
});

test('AC1 the SYSTEM store is not silently collapsed onto the software store', () => {
  // The single mutation that would make AC1 meaningless while every "row
  // resolves to its declared store" test above still passed, if the fixture
  // check were ever weakened: `system_requirements_path` derived from the
  // software record.
  divergentFixture((cfg, { base }) => {
    assert.ok(cfg.system_requirements_path.includes(SYS_LOC),
      `system_requirements_path is ${JSON.stringify(cfg.system_requirements_path)}, which does ` +
      `not point at the system store's location`);
    assert.ok(!cfg.system_requirements_path.includes(SW_LOC),
      'system_requirements_path points at the SOFTWARE store');
    assert.ok(cfg.software_requirements_path.includes(SW_LOC));
    assert.ok(cfg.knowledgebase_path.includes(SW_LOC),
      'FR264: the legacy field resolves to the software store');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. AC7 / NFR82 — single-store and legacy projects, MEASURED ===\n');
// ═════════════════════════════════════════════════════════════════════════════

test('AC7 a single-store project resolves every row to the one location', () => {
  withTmpProject(({ root }) => {
    writeBinding(root, schema2DefaultsBinding());
    const cfg = generate(root);
    const dirs = directoriesOf(cfg);
    assert.strictEqual(dirs[SYSTEM], dirs[SOFTWARE],
      'with both stores at `.` the two store destinations must be the same directory');
    for (const r of ROWS.filter((x) => x.store !== SPRINT)) {
      assert.strictEqual(dirs[r.store], '{project-root}/_bmad-output/planning-artifacts',
        `row ${r.num} ("${r.artifact}") does not land where it lands today`);
    }
    for (const r of rowsFor(SPRINT)) {
      assert.strictEqual(dirs[r.store], '{project-root}/_bmad-output/implementation-artifacts',
        `row ${r.num} ("${r.artifact}") does not land where it lands today`);
    }
  });
});

test('AC7/NFR82 a pre-F26 binding and a schema-2 default binding resolve IDENTICALLY', () => {
  // The proof, as a comparison of two real generated configs rather than as an
  // assertion about one. `schema1Binding()` is the actual pre-F26 file shape.
  const gen = (body) => withTmpProject(({ root }) => {
    writeBinding(root, body);
    const cfg = generate(root);
    delete cfg.project_layout_stamp; // the one field AC6 of Story 31.3 says may differ
    return cfg;
  });
  const legacy = gen(schema1Binding());
  const modern = gen(schema2DefaultsBinding());

  for (const f of ['knowledgebase_path', 'planning_artifacts', 'implementation_artifacts',
    'sprint_management_path', 'sprint_backend', 'system_requirements_path',
    'software_requirements_path']) {
    assert.strictEqual(modern[f], legacy[f],
      `${f} differs between a legacy project and a two-store project that took the defaults: ` +
      `${JSON.stringify(legacy[f])} vs ${JSON.stringify(modern[f])}`);
  }
  // ...and the resolved artifact directories, which is what NFR82 is actually about.
  assert.deepStrictEqual(directoriesOf(modern), directoriesOf(legacy));
});

test('AC7/NFR82 a legacy project\'s resolved paths are exactly the pre-F26 values', () => {
  // The comparison above would also pass if BOTH sides had drifted together.
  // These are the literal values a pre-F26 ma-agents wrote.
  withTmpProject(({ root }) => {
    writeBinding(root, schema1Binding());
    const cfg = generate(root);
    assert.strictEqual(cfg.knowledgebase_path, '.');
    assert.strictEqual(cfg.sprint_management_path, '.');
    assert.strictEqual(cfg.sprint_backend, 'file-system');
    assert.strictEqual(cfg.planning_artifacts, '{project-root}/_bmad-output/planning-artifacts');
    assert.strictEqual(cfg.implementation_artifacts,
      '{project-root}/_bmad-output/implementation-artifacts');
    assert.strictEqual(cfg.system_requirements_path, '.',
      'FR265: a legacy project reads as BOTH stores pointing at the one location');
    assert.strictEqual(cfg.software_requirements_path, '.');
  });
});

test('AC7 the repository-layout section is still OMITTED for a single-store project', () => {
  // P2-10 / NFR34: single-repo mode omits the section entirely. Story 31.6's
  // wording change must not have made the section reachable for a project that
  // has not moved anything.
  assert.strictEqual(installerMod.generateRepoLayoutSection({
    systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    knowledgebase: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  }), '');
  assert.strictEqual(installerMod.generateRepoLayoutSection({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  }), '');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. the project-context.md guidance agrees with the table ===\n');
// ═════════════════════════════════════════════════════════════════════════════

function twoStoreSection() {
  return installerMod.generateRepoLayoutSection({
    systemRequirementsStore: { backend: 'file-system', mode: 'local', path: '/sys' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: '/sw' },
    knowledgebase: { backend: 'file-system', mode: 'local', path: '/sw' },
    sprintManagement: { mode: 'same', path: '.' },
  });
}

// FIX-ROUND, BLOCKING-2. These three tests used HARDCODED regex literals, not
// `ROWS`. `lib/installer.js` claimed in a block comment that "a row added to the
// table without a matching edit here fails rather than diverging silently"; it
// did not — a seventeenth row sailed through. They now derive from the table's
// own rows, through each row's artifact TERM (`guidance`), so the guarantee the
// comment states is the guarantee the code has.
function guidanceLines() {
  const lines = twoStoreSection().toLowerCase().split('\n');
  return {
    section: twoStoreSection(),
    [SYSTEM]: lines.find((l) => l.includes('system requirements store path')) || '',
    [SOFTWARE]: lines.find((l) => l.includes('software requirements store path')) || '',
  };
}

/** The distinct `guidance` regexes the table's rows for `store` require. */
function guidanceTermsFor(store) {
  const seen = new Map();
  for (const r of rowsFor(store)) {
    for (const t of requiredDestinationOf(r).terms) seen.set(t.key, t);
  }
  return [...seen.values()];
}

test('the system-store sentence names the artifacts the table gives that store', () => {
  const g = guidanceLines();
  assert.ok(g[SYSTEM], `no system-store guidance line was emitted:\n${g.section}`);
  const terms = guidanceTermsFor(SYSTEM);
  assert.ok(terms.length >= 3, `only ${terms.length} artifact terms on the system side of the table`);
  for (const t of terms) {
    assert.ok(t.guidance, `the table routes "${t.key}" to the system store, but this suite records ` +
      `it as an artifact no store-guidance sentence names`);
    assert.ok(t.guidance.test(g[SYSTEM]),
      `row(s) for "${t.key}" route it to the system store, and the guidance sentence ` +
      `project-context.md renders does not name it:\n${g[SYSTEM]}`);
  }
});

test('the software-store sentence names the artifacts the table gives that store', () => {
  const g = guidanceLines();
  assert.ok(g[SOFTWARE], `no software-store guidance line was emitted:\n${g.section}`);
  const terms = guidanceTermsFor(SOFTWARE);
  assert.ok(terms.length >= 4, `only ${terms.length} artifact terms on the software side`);
  for (const t of terms) {
    assert.ok(t.guidance, `the table routes "${t.key}" to the software store, but this suite ` +
      `records it as an artifact no store-guidance sentence names`);
    assert.ok(t.guidance.test(g[SOFTWARE]),
      `row(s) for "${t.key}" route it to the software store, and the guidance sentence ` +
      `project-context.md renders does not name it:\n${g[SOFTWARE]}`);
  }
});

test('neither guidance sentence claims an artifact the OTHER store owns', () => {
  const g = guidanceLines();
  for (const [mine, theirs] of [[SYSTEM, SOFTWARE], [SOFTWARE, SYSTEM]]) {
    for (const t of guidanceTermsFor(mine)) {
      assert.ok(!t.guidance.test(g[theirs]),
        `the ${theirs} guidance claims "${t.key}", which the table routes to ${mine}:\n${g[theirs]}`);
    }
  }
});

test('AC3/FR267 sprint artifacts appear in NEITHER store guidance sentence', () => {
  // FR267 in its own words: story files and everything else under
  // `implementation_artifacts` belong to neither knowledge store. Derived from
  // the table's sprint rows rather than from a list kept here.
  const g = guidanceLines();
  const sprintRows = rowsFor(SPRINT);
  assert.ok(sprintRows.length >= 4, `only ${sprintRows.length} sprint rows to check`);
  for (const r of sprintRows) {
    for (const t of requiredDestinationOf(r).terms) {
      assert.strictEqual(t.guidance, null,
        `"${t.key}" routes to sprint management, so no store-guidance sentence may name it, yet ` +
        `this suite records a guidance spelling for it`);
      // Checked against the sentences too, using the table-cell regex, so the
      // `null` above is not the only thing standing between a sprint artifact
      // and a store sentence.
      assert.ok(!t.re.test(g[SYSTEM]),
        `the SYSTEM store guidance names "${t.key}", a sprint artifact (FR267):\n${g[SYSTEM]}`);
      assert.ok(!t.re.test(g[SOFTWARE]),
        `the SOFTWARE store guidance names "${t.key}", a sprint artifact (FR267):\n${g[SOFTWARE]}`);
    }
  }
});

test('the contradiction Story 31.5 shipped cannot return', () => {
  // "planning artifacts" spans BOTH stores, so a two-store rendering that uses
  // the term routes the PRD to two places at once. Pinned as an absence.
  assert.ok(!/planning artifacts/i.test(twoStoreSection()),
    `the two-store rendering uses a term that spans both stores:\n${twoStoreSection()}`);
});

test('NFR82 the single-store sentence is unchanged, verbatim', () => {
  const legacy = installerMod.generateRepoLayoutSection({
    knowledgebase: { mode: 'local', path: '/ext/kb' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.strictEqual(legacy, [
    '<!-- ma-agents:repo-layout-start -->',
    '### Repository Layout',
    '- **Knowledgebase:** /ext/kb',
    '- **Sprint Management:** current repository (default)',
    '- When creating or reading planning artifacts, use the knowledgebase path',
    '<!-- ma-agents:repo-layout-end -->',
  ].join('\n'));
});

test('sprint/story guidance is unchanged and still points at sprint management (AC3)', () => {
  const section = installerMod.generateRepoLayoutSection({
    systemRequirementsStore: { backend: 'file-system', mode: 'local', path: '/sys' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: '/sw' },
    knowledgebase: { backend: 'file-system', mode: 'local', path: '/sw' },
    sprintManagement: { mode: 'local', path: '/sp' },
  });
  assert.ok(section.includes(
    '- When creating or reading sprint/story artifacts, use the sprint management path'),
  `the sprint guidance line changed; AC3 requires it unchanged:\n${section}`);
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. AC5 — what the skills may and may not do ===\n');
// ═════════════════════════════════════════════════════════════════════════════

const GUARD_HEADING = '## Knowledge Store Binding Preflight';

function skillEntryDocs() {
  const roots = ['skills', path.join('lib', 'bmad-extension', 'skills')];
  const out = [];
  for (const root of roots) {
    const abs = path.join(PROJECT_ROOT, root);
    if (!fs.existsSync(abs)) continue;
    for (const dir of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      for (const name of ['SKILL.md', 'workflow.md']) {
        const p = path.join(abs, dir.name, name);
        if (fs.existsSync(p)) out.push(path.relative(PROJECT_ROOT, p).split(path.sep).join('/'));
      }
    }
  }
  return out;
}

/** A document's text with Story 31.4's read-only preflight block removed. */
function withoutPreflight(rel) {
  const body = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
  const start = body.indexOf(GUARD_HEADING);
  if (start === -1) return body;
  const rest = body.slice(start);
  const end = rest.indexOf('\n## ', 1);
  return body.slice(0, start) + (end === -1 ? '' : rest.slice(end));
}

// The entry documents this story edited to resolve epics — a SOFTWARE
// requirements artifact — through config.yaml.
const EPICS_CONSUMERS = Object.freeze([
  'skills/bmad-sprint-planning/SKILL.md',
  'skills/generate-backlog/SKILL.md',
  'skills/prioritize-backlog/SKILL.md',
  'lib/bmad-extension/skills/bmad-sprint-planning/workflow.md',
  'lib/bmad-extension/skills/generate-backlog/SKILL.md',
  'lib/bmad-extension/skills/prioritize-backlog/SKILL.md',
]);

// The three audit skills that read the PRD, architecture and epics through
// `{output_folder}` — upstream BMAD's own field, which `generateBmmConfig` never
// writes and no binding change can make stale. Story 31.4's OQ-3 answer PINS
// sqa-audit by name as an `{output_folder}`-only consumer that must resolve no
// binding-derived field; making these three store-aware would move all three
// into the guarded set and break that pin. Deferred and recorded in Section 6 of
// the routing table — not silently skipped. The exclusion is EARNED below, by
// requiring each of them to still be `{output_folder}`-only.
const DEFERRED_OUTPUT_FOLDER_CONSUMERS = Object.freeze([
  'lib/bmad-extension/skills/sqa-audit/SKILL.md',
  'lib/bmad-extension/skills/sqa-ieee12207/SKILL.md',
  'lib/bmad-extension/skills/sqa-requirements-quality/SKILL.md',
]);

test('the deferred audit consumers are still `{output_folder}`-only, so the exclusion holds', () => {
  // Without this, the exclusion list below would be a blanket permission: any of
  // the three could start resolving a store field and simply not be checked.
  const BINDING_FIELDS = ['knowledgebase_path', 'system_requirements_path',
    'software_requirements_path', 'sprint_management_path', 'planning_artifacts',
    'implementation_artifacts'];
  for (const rel of DEFERRED_OUTPUT_FOLDER_CONSUMERS) {
    const body = withoutPreflight(rel);
    assert.ok(/\{output_folder\}/.test(body),
      `${rel} is excluded on the grounds that it is {output_folder}-only, and it no longer uses ` +
      `{output_folder}`);
    for (const f of BINDING_FIELDS) {
      assert.ok(!body.includes(f),
        `${rel} now resolves ${f}, a binding-derived field. It can no longer be excluded from ` +
        `routing on {output_folder} grounds, and Story 31.4's OQ-3 scope rule also puts it in ` +
        `the guarded set.`);
    }
  }
});

test('the deferred set is recorded in the routing table, not silently dropped', () => {
  const body = fs.readFileSync(path.join(PROJECT_ROOT, TABLE_REL), 'utf-8');
  for (const rel of DEFERRED_OUTPUT_FOLDER_CONSUMERS) {
    const skill = rel.split('/').slice(-2)[0];
    assert.ok(body.includes(skill),
      `${skill} is excluded from routing but the table never says so — AC4 wants decisions ` +
      `recorded, and an undocumented exclusion reads as an oversight`);
  }
  assert.ok(/Deliberately NOT routed/i.test(body),
    'the table has no section recording what this story deliberately left unrouted');
});

test('the epics-consuming set is complete — no other entry document reads epics.md', () => {
  // Completeness, so a document that starts reading epics without being routed
  // fails here instead of being missed. Documents that merely mention the word
  // "epics" are not the subject; reading the FILE is.
  const readers = skillEntryDocs().filter((rel) => {
    const body = withoutPreflight(rel);
    return /epics\.md|\*epic\*\.md|epics\/index\.md/.test(body);
  });
  const unexpected = readers
    .filter((r) => !EPICS_CONSUMERS.includes(r) && !DEFERRED_OUTPUT_FOLDER_CONSUMERS.includes(r))
    .sort();
  assert.deepStrictEqual(unexpected, [],
    `these entry documents read the epics file but are not in this story's routed set, so ` +
    `nothing checks how they resolve it: ${JSON.stringify(unexpected)}`);
  const missing = EPICS_CONSUMERS.filter((r) => !readers.includes(r)).sort();
  assert.deepStrictEqual(missing, [],
    `these are listed as epics consumers but no longer read the epics file: ` +
    `${JSON.stringify(missing)}`);
});

test('AC2/AC5 no epics consumer hardcodes the planning-artifacts directory', () => {
  // A RELATIVE `_bmad-output/planning-artifacts` is the NFR37 violation: it
  // assumes the software store is a folder of this repository. The one spelling
  // that is allowed is the fully-qualified `{project-root}/_bmad-output/
  // planning-artifacts`, which is the literal value `generateBmmConfig` writes
  // into `planning_artifacts` for a single-store project, and which the next
  // test confines to the pre-F26 branch it belongs to.
  for (const rel of EPICS_CONSUMERS) {
    const body = withoutPreflight(rel);
    const bare = body.split(/\r?\n/)
      .filter((l) => /(?<!\{project-root\}\/)_bmad-output\/planning-artifacts/.test(l));
    assert.deepStrictEqual(bare, [],
      `${rel} still assumes the software store lives at a RELATIVE ` +
      `_bmad-output/planning-artifacts. AC5 (NFR37) forbids it; the path must come from ` +
      `config.yaml.`);
  }
});

test('AC5 the pre-F26 fallback is confined to the pre-F26 case, not a general default', () => {
  // The permissive-degradation shape this epic keeps producing: a fallback that
  // reads as "use this when the field is missing" silently becomes the answer
  // for every project whose config the reader failed to parse. Every occurrence
  // of the canonical literal must sit in a sentence that names the ONE branch it
  // is legal in.
  // Scanned over a CHARACTER window rather than per line: these documents are
  // hard-wrapped prose, so a line-scoped check would pass or fail on where the
  // wrap happened to fall rather than on what the sentence says.
  const WINDOW = 320;
  const needle = /\{project-root\}\/_bmad-output\/planning-artifacts/g;
  for (const rel of EPICS_CONSUMERS) {
    const body = withoutPreflight(rel).replace(/\r?\n/g, ' ');
    let m;
    let seen = 0;
    needle.lastIndex = 0;
    while ((m = needle.exec(body)) !== null) {
      seen++;
      const around = body.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW);
      assert.ok(/pre-F26/.test(around),
        `${rel} states the canonical planning-artifacts path without naming the pre-F26 case ` +
        `it is the fallback for, so it reads as a general default:\n  ...${around.trim()}...`);
    }
    // A consumer that names no fallback at all is fine; one that names several
    // is not, because the more places it is restated the more likely one of them
    // is unqualified.
    assert.ok(seen <= 1,
      `${rel} states the canonical planning-artifacts fallback ${seen} times; state it once`);
  }
});

test('AC2/AC5 every epics consumer resolves the directory from config.yaml', () => {
  for (const rel of EPICS_CONSUMERS) {
    const body = withoutPreflight(rel);
    assert.ok(/planning_artifacts/.test(body),
      `${rel} reads the epics file without ever naming the config field it comes from`);
    assert.ok(/_bmad\/bmm\/config\.yaml/.test(body),
      `${rel} does not name the generated config.yaml as the source of its paths (AC5/FR264)`);
  }
});

test('AC2/AC3 no consumer derives the EPICS path from sprint_management_path', () => {
  // The concrete defect this story fixed: generate-backlog built
  // `{sprint_management_path}/_bmad-output/planning-artifacts/epics.md`, so a
  // project whose sprint management and software store diverge read its epics
  // out of the wrong repository.
  for (const rel of EPICS_CONSUMERS) {
    const body = withoutPreflight(rel);
    // Matched as a PATH CONSTRUCTION — `{sprint_management_path}/` immediately
    // followed by path characters leading to the planning folder or the epics
    // file — not as prose co-occurrence, so a sentence explaining that the two
    // fields are separate does not read as the defect it warns about.
    assert.ok(!/\{sprint_management_path\}\/[^\s`)]*planning-artifacts/.test(body),
      `${rel} builds a planning-artifacts path out of sprint_management_path — FR267 puts ` +
      `stories there precisely BECAUSE epics are not there`);
    assert.ok(!/\{sprint_management_path\}\/[^\s`)]*epic/i.test(body),
      `${rel} resolves epics through sprint management`);
  }
});

test('AC5 no skill entry document reads project-layout.yaml outside the preflight', () => {
  // P5-9.1 keeps the binding a one-way source: workflows resolve from the
  // GENERATED config.yaml. Story 31.4's preflight is a read-only staleness
  // check that resolves nothing, so it is excluded — precisely, by removing the
  // block, not by allowing the filename anywhere.
  const offenders = skillEntryDocs()
    .filter((rel) => /project-layout\.yaml/.test(withoutPreflight(rel)))
    .sort();
  assert.deepStrictEqual(offenders, [],
    `these entry documents name project-layout.yaml outside the read-only preflight: ` +
    `${JSON.stringify(offenders)}`);
});

test('AC5 the preflight exclusion is real — the block IS present in these documents', () => {
  // Without this, the test above would pass trivially if `withoutPreflight`
  // ever returned the empty string, and the two would move together.
  const guarded = skillEntryDocs().filter((rel) =>
    fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8').includes(GUARD_HEADING));
  assert.ok(guarded.length >= 27,
    `expected at least Story 31.4's 27 guarded entry documents; found ${guarded.length}`);
  for (const rel of guarded) {
    const full = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
    const stripped = withoutPreflight(rel);
    assert.ok(stripped.length > 0, `${rel}: stripping the preflight left nothing`);
    assert.ok(stripped.length < full.length, `${rel}: stripping the preflight removed nothing`);
    assert.ok(!stripped.includes(GUARD_HEADING), `${rel}: the preflight survived stripping`);
  }
});

test('AC3 the sprint skills\' own paths were NOT changed by this story', () => {
  // AC3 says sprint artifacts resolve "unchanged". The edits above are scoped to
  // epics; if a future edit sweeps `_bmad-output/implementation-artifacts` out of
  // the sprint skills under this story's banner, that is a different story's
  // change and this fails.
  const stillLiteral = EPICS_CONSUMERS.filter((rel) =>
    /_bmad-output\/implementation-artifacts|\{implementation_artifacts\}/.test(withoutPreflight(rel)));
  assert.ok(stillLiteral.length >= 4,
    `the sprint-side paths in these documents should be untouched by Story 31.6; only ` +
    `${stillLiteral.length} of them still resolve implementation artifacts as before`);
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX-ROUND, BLOCKING-4 — SHIPPED SKILL DOCUMENTS MAY NOT CITE THIS
// REPOSITORY'S OWN WORKING DOCUMENTS.
//
// The first round ended seven shipped skill documents with "See
// `_bmad-output/implementation-artifacts/31-6-artifact-to-store-routing.md`."
// `package.json`'s `files` ships `bin/ lib/ scripts/ skills/ docs/ examples/
// mil498/` — NOT `_bmad-output/`. In a consuming project that directory exists
// (BMAD workflows write into it) but that file never will, so the citation is an
// identifier resolving against nothing: Story 31.2's R-6 class, whose guard is
// scoped to `bin/cli.js` and therefore never looked here.
//
// The rule is objective: a path that resolves to a file IN THIS REPOSITORY but
// is not shipped is, by construction, a file the user will not have. The
// allowlist below is the honest part — it names the runtime artifacts a BMAD
// project genuinely creates for itself (which exist here only because this repo
// dogfoods BMAD), and the one pre-existing debt this story did not introduce.
// ─────────────────────────────────────────────────────────────────────────────
const SHIPPED_SKILL_ROOTS = Object.freeze([
  'skills',
  'lib/bmad-extension/skills',
  'lib/bmad-extension-plugin/skills',
]);

const CITABLE_RUNTIME_ARTIFACTS = Object.freeze({
  // Written by bmad-generate-project-context into every project it runs in.
  '_bmad-output/project-context.md': 'generated per project by bmad-generate-project-context',
  // Written by bmad-sprint-planning / the sprint skills into every project.
  '_bmad-output/implementation-artifacts/sprint-status.yaml':
    'created per project by bmad-sprint-planning (FR120)',
  // PRE-EXISTING DEBT, NOT THIS STORY'S. `close-sprint` has cited this since
  // Story 17.9 (commit d263e7b), long before this epic's base. It is the SAME
  // defect class: committed here, shipped by nothing, created by nothing. It is
  // recorded rather than swept, because fixing another story's shipped wording
  // under this story's banner is the retroactive edit BMAD phase discipline
  // forbids. Reported to the epic; a follow-up story owns it.
  '_bmad-output/planning-artifacts/sprint-status-schema.md':
    'PRE-EXISTING (Story 17.9, cited by close-sprint) — same defect class, reported not fixed here',
});

test('BLOCKING-4 no shipped skill document cites a file this repository does not ship', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  // The premise, checked rather than assumed: if `_bmad-output/` ever became a
  // shipped directory this whole guard would be moot, and silently so.
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, 'package.json declares no files list');
  assert.ok(!pkg.files.some((f) => /^_bmad-output/.test(f)),
    'package.json now ships _bmad-output/; this guard\'s premise no longer holds and the ' +
    'allowlist below has become meaningless');

  const offenders = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) { walk(p, r); continue; }
      if (!/\.md$/.test(e.name)) continue;
      const body = fs.readFileSync(p, 'utf-8');
      for (const m of body.match(/_bmad-output\/[A-Za-z0-9._/{}-]*/g) || []) {
        const token = m.replace(/[.,)`]+$/, '');
        if (!/\.[a-z0-9]+$/i.test(token)) continue;                 // a directory, not a file
        if (/[{}]/.test(token)) continue;                            // a template, filled at runtime
        if (CITABLE_RUNTIME_ARTIFACTS[token]) continue;
        if (!fs.existsSync(path.join(PROJECT_ROOT, token))) continue; // not a repo document
        offenders.push(`${r} -> ${token}`);
      }
    }
  };
  for (const root of SHIPPED_SKILL_ROOTS) {
    const abs = path.join(PROJECT_ROOT, root);
    if (fs.existsSync(abs)) walk(abs, root);
  }

  assert.deepStrictEqual([...new Set(offenders)].sort(), [],
    `these SHIPPED skill documents cite a document that exists only in the ma-agents repository. ` +
    `package.json ships ${JSON.stringify(pkg.files)} — not _bmad-output/ — so in a consuming ` +
    `project the path resolves to nothing and the instruction is dead. Cite something the user ` +
    `has (a config field, a generated document), or state the rule inline:\n  ` +
    [...new Set(offenders)].sort().join('\n  '));
});

test('BLOCKING-4 the guard has real reach — it inspects every shipped skill tree', () => {
  // Without this, the guard above would pass trivially if a root were renamed or
  // the walk returned nothing, and the two would move together.
  for (const root of SHIPPED_SKILL_ROOTS) {
    const abs = path.join(PROJECT_ROOT, root);
    assert.ok(fs.existsSync(abs), `${root} does not exist — the guard scans nothing there`);
  }
  const scanned = skillEntryDocs();
  assert.ok(scanned.length >= 60,
    `only ${scanned.length} shipped entry documents found; the guard's reach has collapsed`);
  // And the allowlist must stay EARNED: every entry must still be cited by
  // something, so a stale exemption cannot quietly become a blanket permission.
  const all = SHIPPED_SKILL_ROOTS
    .map((r) => path.join(PROJECT_ROOT, r))
    .filter((a) => fs.existsSync(a));
  const corpus = [];
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (/\.md$/.test(e.name)) corpus.push(fs.readFileSync(p, 'utf-8'));
    }
  };
  for (const a of all) collect(a);
  const joined = corpus.join('\n');
  for (const token of Object.keys(CITABLE_RUNTIME_ARTIFACTS)) {
    assert.ok(joined.includes(token),
      `${token} is allowlisted as a citable runtime artifact but no shipped skill cites it any ` +
      `more — remove the exemption rather than leaving it as a standing permission`);
  }
});

test('Story 31.4\'s preflight block is still byte-identical across all its copies', () => {
  // Not this story's invariant, but this story edits documents that carry it,
  // and a stray edit inside the block is the single most likely silent breakage.
  const roots = ['skills', 'lib/bmad-extension/skills', 'lib/bmad-extension-plugin'];
  const blocks = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/^(SKILL|workflow)\.md$/.test(e.name)) continue;
      const body = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
      const start = body.indexOf(GUARD_HEADING);
      if (start === -1) continue;
      const rest = body.slice(start);
      const end = rest.indexOf('\n## ', 1);
      const block = end === -1 ? rest : rest.slice(0, end);
      if (!blocks.has(block)) blocks.set(block, []);
      blocks.get(block).push(path.relative(PROJECT_ROOT, p).split(path.sep).join('/'));
    }
  };
  for (const r of roots) {
    const abs = path.join(PROJECT_ROOT, r);
    if (fs.existsSync(abs)) walk(abs);
  }
  const total = [...blocks.values()].reduce((a, v) => a + v.length, 0);
  assert.strictEqual(total, 41, `expected 41 copies of the preflight block; found ${total}`);
  assert.strictEqual(blocks.size, 1,
    `the preflight block has ${blocks.size} distinct variants: ` +
    JSON.stringify([...blocks.values()].map((v) => v.length)));
});

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${passed} passed, ${failed} failed\n`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e.name}\n    ${e.error}`);
}
summaryPrinted = true;
if (total !== EXPECTED_TEST_COUNT) {
  console.error(`\n  FATAL: ran ${total} tests, expected exactly ${EXPECTED_TEST_COUNT}. ` +
    `If you added or removed a test, update EXPECTED_TEST_COUNT.`);
  process.exit(1);
}
process.exit(failed === 0 ? 0 : 1);
