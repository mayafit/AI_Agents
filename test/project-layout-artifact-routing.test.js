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

const EXPECTED_TEST_COUNT = 43;

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
 * Pull Section 3's table out of the shipped markdown. Throws rather than
 * returning empty: a suite that quietly finds zero rows and then reports every
 * "for each row" test as green is the failure mode this epic has already shipped
 * once, in a suite that exited 0 having asserted nothing.
 */
function parseRoutingTable() {
  const abs = path.join(PROJECT_ROOT, TABLE_REL);
  if (!fs.existsSync(abs)) {
    throw new Error(`the routing table AC6 requires does not exist at ${TABLE_REL}`);
  }
  const body = fs.readFileSync(abs, 'utf-8');
  const HEADING = '## 3. THE ROUTING TABLE';
  const start = body.indexOf(HEADING);
  if (start === -1) {
    throw new Error(`${TABLE_REL} no longer contains the "${HEADING}" heading this suite binds to`);
  }
  const rest = body.slice(start);
  const end = rest.indexOf('\n## ', 1);
  const section = end === -1 ? rest : rest.slice(0, end);

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
const TERMS = Object.freeze([
  { key: 'product brief', re: /product brief/i },
  { key: 'PRD', re: /\bPRDs?\b/i },
  { key: 'sharded PRD index', re: /sharded PRD index|its index/i },
  { key: 'sharded PRD shards', re: /shards?\b/i },
  { key: 'architecture', re: /architecture/i },
  { key: 'UX design', re: /UX design/i },
  { key: 'epics', re: /\bepics\b/i },
  { key: 'research', re: /research/i },
  { key: 'story files', re: /story file/i },
  { key: 'sprint-status.yaml', re: /sprint-status\.yaml/i },
  { key: 'bug', re: /\bbug\b/i },
  { key: 'retrospectives', re: /retrospective/i },
  { key: 'implementation artifacts', re: /implementation artifacts|implementation_artifacts/i },
]);

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
 * one is the rule workflows follow, and Section 3 below checks it against the
 * generator's own software derivation so the two cannot disagree.
 */
function directoriesOf(cfg) {
  const canonPlanning = '{project-root}/_bmad-output/planning-artifacts';
  return {
    [SYSTEM]: cfg.system_requirements_path === '.' ? canonPlanning : cfg.system_requirements_path,
    [SOFTWARE]: cfg.planning_artifacts,
    [SPRINT]: cfg.implementation_artifacts,
  };
}

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
  const body = fs.readFileSync(path.join(PROJECT_ROOT, TABLE_REL), 'utf-8');
  assert.ok(/OQ-5/.test(body), 'the table never names the open question it settles');
  assert.ok(/2026-08-12/.test(body), 'the decision date is not recorded');
  assert.ok(/NFR82/.test(body),
    'the recorded rationale rests on NFR82 (legacy fields already resolve to the software ' +
    'store, so no project\'s research paths move); without it the entry is a bare assertion');
  assert.ok(/[Rr]ejected/.test(body),
    'AC4 wants the choice recorded as a story-level decision — the rejected alternatives are ' +
    'part of that record');
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

test('AC1 every system-requirements row resolves to the system store, and to nothing else', () => {
  divergentFixture((cfg) => {
    const dirs = directoriesOf(cfg);
    const rows = rowsFor(SYSTEM);
    assert.ok(rows.length >= 4, `expected brief, PRD, shard index and shards; got ${rows.length}`);
    for (const r of rows) {
      assert.strictEqual(dirs[r.store], dirs[SYSTEM],
        `row ${r.num} ("${r.artifact}") does not resolve to the system store`);
      assert.notStrictEqual(dirs[r.store], dirs[SOFTWARE],
        `row ${r.num} ("${r.artifact}") resolved to the SOFTWARE store`);
      assert.notStrictEqual(dirs[r.store], dirs[SPRINT],
        `row ${r.num} ("${r.artifact}") resolved to sprint management`);
    }
  });
});

test('AC2 every software-requirements row resolves to the software store, and to nothing else', () => {
  divergentFixture((cfg) => {
    const dirs = directoriesOf(cfg);
    const rows = rowsFor(SOFTWARE);
    assert.ok(rows.length >= 6,
      `expected architecture, its shards, UX, epics and three research reports; got ${rows.length}`);
    for (const r of rows) {
      assert.strictEqual(dirs[r.store], dirs[SOFTWARE],
        `row ${r.num} ("${r.artifact}") does not resolve to the software store`);
      assert.notStrictEqual(dirs[r.store], dirs[SYSTEM],
        `row ${r.num} ("${r.artifact}") resolved to the SYSTEM store`);
      assert.notStrictEqual(dirs[r.store], dirs[SPRINT],
        `row ${r.num} ("${r.artifact}") resolved to sprint management`);
    }
  });
});

test('AC3/FR267 every sprint row resolves to sprint management and to NEITHER store', () => {
  divergentFixture((cfg) => {
    const dirs = directoriesOf(cfg);
    const rows = rowsFor(SPRINT);
    assert.ok(rows.length >= 4, `expected stories, sprint-status.yaml, bugs, retrospectives`);
    for (const r of rows) {
      assert.strictEqual(dirs[r.store], dirs[SPRINT],
        `row ${r.num} ("${r.artifact}") does not resolve to sprint management`);
      assert.notStrictEqual(dirs[r.store], dirs[SYSTEM],
        `FR267: row ${r.num} ("${r.artifact}") must belong to NEITHER store; it resolved to the ` +
        `system requirements store`);
      assert.notStrictEqual(dirs[r.store], dirs[SOFTWARE],
        `FR267: row ${r.num} ("${r.artifact}") must belong to NEITHER store; it resolved to the ` +
        `software requirements store`);
    }
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

test('the system-store sentence names the artifacts the table gives that store', () => {
  const section = twoStoreSection().toLowerCase();
  const sysLine = section.split('\n').find((l) => l.includes('system requirements store path'));
  assert.ok(sysLine, `no system-store guidance line was emitted:\n${twoStoreSection()}`);
  for (const t of [/product brief/, /\bprd\b/, /shard/]) {
    assert.ok(t.test(sysLine),
      `the system-store guidance does not name ${t} — the table routes it there:\n${sysLine}`);
  }
});

test('the software-store sentence names the artifacts the table gives that store', () => {
  const section = twoStoreSection().toLowerCase();
  const swLine = section.split('\n').find((l) => l.includes('software requirements store path'));
  assert.ok(swLine, `no software-store guidance line was emitted:\n${twoStoreSection()}`);
  for (const t of [/architecture/, /ux design/, /epic/, /research/]) {
    assert.ok(t.test(swLine),
      `the software-store guidance does not name ${t} — the table routes it there:\n${swLine}`);
  }
});

test('neither guidance sentence claims an artifact the OTHER store owns', () => {
  const lines = twoStoreSection().toLowerCase().split('\n');
  const sysLine = lines.find((l) => l.includes('system requirements store path')) || '';
  const swLine = lines.find((l) => l.includes('software requirements store path')) || '';
  for (const t of [/architecture/, /ux design/, /\bepic/, /research/]) {
    assert.ok(!t.test(sysLine),
      `the SYSTEM store guidance claims ${t}, which the table routes to the software store`);
  }
  for (const t of [/product brief/, /\bprd\b/]) {
    assert.ok(!t.test(swLine),
      `the SOFTWARE store guidance claims ${t}, which the table routes to the system store`);
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
