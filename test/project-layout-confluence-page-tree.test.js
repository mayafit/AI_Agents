/**
 * Story 31.10 — the Confluence page tree (P5-9.7; completes FR255, FR256, FR260).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * HOW THIS SUITE IS BUILT, AND WHY
 * ════════════════════════════════════════════════════════════════════════════
 * Epic 31 has produced six defect shapes. Four of them can reach this story, so
 * the structure below is organised around defeating them by construction rather
 * than by care:
 *
 *   SHAPE 4 — A TAUTOLOGICAL TEST (expectation and code from one source, so both
 *   move together; six instances in this epic, one of which let the architecture
 *   document be reassigned to the wrong store with a green suite).
 *     · AC6's expected ownership comes from TWO authorities OUTSIDE the code:
 *       Story 31.6's routing table (the AC6 deliverable of that story, parsed
 *       here) and the PRD's own FR255/FR256 sentences (parsed here). Flipping a
 *       value in ARTIFACT_KIND_OWNER fails against both.
 *     · AC2's expected tree is computed from the FIXTURE DIRECTORY by a different
 *       mechanism than the one under test — `fs` recursion and `path.dirname`,
 *       against the module's own string splitting — so the two can disagree.
 *
 *   SHAPE 6 — SUCCESS REPORTED OVER A FAILED WRITE (Story 31.13 printed "Bound."
 *   after its authoritative write failed). Section 6 drives `executePlan` through
 *   every shape of unsuccessful response there is and requires a throw each time,
 *   including the ones that LOOK successful (`ok: 'true'`, `{ok:true}` with no id).
 *
 *   SHAPE 1 — A PERMISSIVE DEFAULT. An inconclusive `resolve_page` must not read
 *   as "not found": that answer duplicates a page that already exists and destroys
 *   the history AC5 exists to preserve.
 *
 *   SHAPE 5 — A DENYLIST INSTEAD OF A CLOSED SET. The operation catalogue is
 *   asserted by SET EQUALITY and enforced by membership, never by a list of
 *   forbidden names.
 *
 * SECTION 0 PROVES THE HARNESS BEFORE ANY TEST RELIES ON IT. Story 31.9's
 * air-gap harness set the standard — it probes its own block before trusting it,
 * so a green result cannot mean an inert harness — and Story 31.8's reviewer
 * sharpened it: a self-test that proves the harness is not WHOLLY inert does not
 * prove each of its primitives is armed. So each fs-write primitive is probed
 * individually, and both AC2 oracles are probed against a plan built to violate
 * them.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MOCK-VERIFIED, NOT LIVE — SAY IT PLAINLY.
 * ════════════════════════════════════════════════════════════════════════════
 * The `claude.ai Atlassian Rovo` MCP server is unauthorised and cannot be
 * authorised from a non-interactive session. AC8 sanctions a mocked MCP surface
 * and that is what this is. EVERY claim below about what happens when a
 * Confluence MCP is present is verified against the mock in Section 0, not
 * against a Confluence instance.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const cli = require(path.join(PROJECT_ROOT, 'bin', 'cli.js'));
const tree = require(path.join(PROJECT_ROOT, 'lib', 'confluence-page-tree.js'));

const EXPECTED_TEST_COUNT = 130;

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

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 0 — THE HARNESS, PROVED ARMED BEFORE ANYTHING RELIES ON IT
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 0. The harness proves itself armed ===\n');

/**
 * A recording, rejecting mock of the Confluence MCP surface.
 *
 * It is a `dispatch(operation, args)` function with observable state. It touches
 * no file and opens no socket. `pages` is its whole world: a map from
 * `parentId|title` to a page id, which is exactly the identity model the tree
 * mapping resolves against.
 *
 * `opts.failOn` — `{operation, title}` (or an ordinal `nth`) makes ONE write
 * answer unsuccessfully, so the "a failed write must not report success" claims
 * are measured rather than asserted.
 * `opts.resolveResponse` — replaces the resolve answer entirely, so the
 * permissive-default claims can be attacked.
 */
function mockConfluence(opts) {
  const o = opts || {};
  const pages = new Map();
  const calls = [];
  let seq = 0;
  let writeOrdinal = 0;

  const dispatch = (operation, args) => {
    calls.push({ operation, args });
    if (operation === 'resolve_page') {
      if (o.resolveResponse) return o.resolveResponse(args, calls.length);
      const key = `${args.parentId || '-'}|${args.title}`;
      if (pages.has(key)) {
        // A poison body rides along on every resolve answer. `executePlan`
        // consumes IDENTITY only, so this string must never appear in any
        // subsequent operation's payload — that is what makes "no content is
        // downloaded, so nothing can become a cache" a measurement.
        return { found: true, id: pages.get(key), body: POISON_BODY, version: 7 };
      }
      return { found: false, body: POISON_BODY };
    }
    if (operation === 'create_page' || operation === 'update_page') {
      writeOrdinal++;
      if (o.failOn && shouldFail(o.failOn, operation, args, writeOrdinal)) {
        return o.failOn.response !== undefined
          ? o.failOn.response
          : { ok: false, error: 'insufficient permissions' };
      }
      if (operation === 'create_page') {
        const key = `${args.parentId || '-'}|${args.title}`;
        const id = `page-${++seq}`;
        pages.set(key, { toString: () => id }.toString());
        pages.set(key, id);
        return { ok: true, id };
      }
      return { ok: true, id: args.id };
    }
    throw new Error(`mockConfluence: refusing an operation outside the catalogue: ${operation}`);
  };

  dispatch.calls = calls;
  dispatch.pages = pages;
  dispatch.operationNames = () => calls.map((c) => c.operation);
  dispatch.payloads = () => calls.map((c) => c.args);
  return dispatch;
}

const POISON_BODY = '<<<CONFLUENCE-CONTENT-THAT-MUST-NEVER-BE-CACHED>>>';

function shouldFail(spec, operation, args, ordinal) {
  if (spec.nth !== undefined) return ordinal === spec.nth;
  if (spec.title !== undefined) return args.title === spec.title;
  return spec.operation === operation;
}

test('[harness] the mock RECORDS: every operation it is asked for appears in .calls', () => {
  const mcp = mockConfluence();
  mcp('resolve_page', { space: 'S', title: 'A', parentId: null });
  mcp('create_page', { space: 'S', title: 'A', parentId: null, body: 'x' });
  assert.deepStrictEqual(mcp.operationNames(), ['resolve_page', 'create_page']);
  assert.strictEqual(mcp.calls[1].args.body, 'x',
    'the mock must record the payload, not only the operation name');
});

test('[harness] the mock does NOT record an operation nobody asked for', () => {
  const mcp = mockConfluence();
  mcp('resolve_page', { space: 'S', title: 'A', parentId: null });
  assert.ok(!mcp.operationNames().includes('update_page'),
    'a mock that reports calls nobody made would make every "only these operations ran" ' +
    'assertion below meaningless');
});

test('[harness] the mock REJECTS an operation outside the catalogue', () => {
  const mcp = mockConfluence();
  assert.throws(() => mcp('delete_page', { id: 'x' }), /outside the catalogue/,
    'if the mock answered any operation, the closed-set claim would be untestable');
});

test('[harness] the mock CREATES then FINDS: a second resolve of the same page reports found', () => {
  const mcp = mockConfluence();
  assert.strictEqual(mcp('resolve_page', { space: 'S', title: 'A', parentId: null }).found, false);
  const created = mcp('create_page', { space: 'S', title: 'A', parentId: null, body: '' });
  assert.strictEqual(created.ok, true);
  const again = mcp('resolve_page', { space: 'S', title: 'A', parentId: null });
  assert.strictEqual(again.found, true);
  assert.strictEqual(again.id, created.id,
    'without this the "re-run updates instead of duplicating" test could pass against a ' +
    'mock that forgot every page as soon as it made it');
});

test('[harness] the mock FAILS a write when told to, and the failure is observable', () => {
  const mcp = mockConfluence({ failOn: { operation: 'create_page' } });
  const r = mcp('create_page', { space: 'S', title: 'A', parentId: null, body: '' });
  assert.strictEqual(r.ok, false,
    'a mock whose failOn did nothing would make every AC5 failure test vacuously green');
});

/**
 * A byte-exact snapshot of every file under a root. The AC4 no-local-copy oracle.
 * Both the KEY SET and the per-file digest matter: a file created and another
 * deleted would leave a count unchanged.
 */
function snapshotTree(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(root, p).replace(/\\/g, '/')] =
        crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}

test('[harness] snapshotTree DETECTS a new file, a changed file and a deleted file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-snap-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one');
    const base = snapshotTree(dir);
    fs.writeFileSync(path.join(dir, 'b.txt'), 'two');
    assert.notDeepStrictEqual(snapshotTree(dir), base, 'a NEW file must be detected');
    fs.rmSync(path.join(dir, 'b.txt'));
    assert.deepStrictEqual(snapshotTree(dir), base, 'and undoing it must restore the snapshot');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'ONE');
    assert.notDeepStrictEqual(snapshotTree(dir), base, 'a CHANGED file must be detected');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.txt'), 'three');
    assert.notDeepStrictEqual(snapshotTree(dir), base, 'a NESTED new file must be detected');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The fs write-poison. Every primitive by which this process could write a byte
 * is replaced with a throw, so a publish that tries to write a local copy dies
 * loudly instead of quietly succeeding.
 *
 * EACH primitive is probed individually below. Story 31.8's reviewer left this
 * exact residual open against its offline harness — a self-test that proves the
 * harness is not WHOLLY inert does not prove that each of its primitives is
 * armed — and this is the closure of that residual for this harness.
 */
const FS_WRITE_PRIMITIVES = Object.freeze([
  'writeFileSync', 'appendFileSync', 'mkdirSync', 'createWriteStream',
  'openSync', 'renameSync', 'copyFileSync', 'rmSync', 'unlinkSync',
  'writeSync', 'truncateSync', 'rmdirSync',
]);

function withFsWritesPoisoned(fn) {
  const saved = {};
  for (const name of FS_WRITE_PRIMITIVES) {
    saved[name] = fs[name];
    fs[name] = (...args) => {
      throw new Error(`FS-POISON: fs.${name} was called; nothing may write locally here`);
    };
  }
  const savedPromises = fs.promises && fs.promises.writeFile;
  if (fs.promises) {
    fs.promises.writeFile = async () => {
      throw new Error('FS-POISON: fs.promises.writeFile was called');
    };
  }
  try {
    return fn();
  } finally {
    for (const name of FS_WRITE_PRIMITIVES) fs[name] = saved[name];
    if (fs.promises) fs.promises.writeFile = savedPromises;
  }
}

for (const primitive of FS_WRITE_PRIMITIVES) {
  test(`[harness] the fs poison ARMS fs.${primitive} — probed individually`, () => {
    let threw = false;
    withFsWritesPoisoned(() => {
      try { fs[primitive](); } catch (e) { threw = /FS-POISON/.test(e.message); }
    });
    assert.ok(threw, `fs.${primitive} was not actually poisoned, so any publish that used it ` +
      `would slip through with a green result`);
  });
}

test('[harness] the fs poison RELEASES afterwards, so later tests are not testing a corpse', () => {
  withFsWritesPoisoned(() => {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-unpoison-'));
  fs.writeFileSync(path.join(dir, 'ok.txt'), 'written');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'ok.txt'), 'utf-8'), 'written');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── The AC2 oracles, and their proof of arming ───────────────────────────────

/**
 * AC2's first rejected alternative: a wall of sibling pages. Written from first
 * principles here, NOT derived from `planStorePublication`.
 *
 * Flattened means: every page's parent is the root. So the oracle fails a plan in
 * which no page has a non-root parent, and it also requires that a nested source
 * path produced a nested page.
 */
function assertNotFlattened(pages, artifactDepthByTitle) {
  const nonRootParented = pages.filter((p) => p.parentId !== null && p.key !== '');
  const withGrandparent = pages.filter((p) => {
    const parent = pages.find((q) => q.id === p.parentId);
    return parent && parent.parentId !== null;
  });
  assert.ok(nonRootParented.length > 0, 'FLATTENED: no page has a parent at all');
  assert.ok(withGrandparent.length > 0,
    'FLATTENED: every page is a direct child of the root page — this is the wall of siblings ' +
    'P5-9.7 rejects because it destroys the per-artifact structure');
  for (const [title, depth] of artifactDepthByTitle) {
    if (depth < 2) continue;
    const page = pages.find((p) => p.title === title);
    assert.ok(page, `no page for artifact "${title}"`);
    const parent = pages.find((q) => q.id === page.parentId);
    assert.ok(parent && parent.key !== '',
      `FLATTENED: "${title}" lives ${depth} folders deep in the source but its page hangs ` +
      `directly off the root page`);
  }
}

/**
 * AC2's second rejected alternative: one page per store. Also written from first
 * principles: the plan must contain one page per artifact, not one page total.
 */
function assertNotCollapsed(pages, artifactCount) {
  assert.ok(pages.length > 1, 'COLLAPSED: the whole store became a single page');
  const artifactPages = pages.filter((p) => p.role === tree.ROLE_ARTIFACT);
  assert.strictEqual(artifactPages.length, artifactCount,
    'COLLAPSED: there is not one page per markdown artifact, so per-artifact page history ' +
    'and comments cannot exist');
  const ids = new Set(artifactPages.map((p) => p.id));
  assert.strictEqual(ids.size, artifactCount,
    'COLLAPSED: two artifacts share one page id, so one overwrites the other');
}

test('[harness] assertNotFlattened FIRES on a deliberately flattened plan', () => {
  const flat = [
    { key: '', title: 'ROOT', id: 'r', parentId: null, role: tree.ROLE_ROOT },
    { key: 'a', title: 'a', id: '1', parentId: 'r', role: tree.ROLE_ARTIFACT },
    { key: 'b', title: 'b', id: '2', parentId: 'r', role: tree.ROLE_ARTIFACT },
  ];
  assert.throws(() => assertNotFlattened(flat, new Map([['b', 2]])), /FLATTENED/,
    'an oracle that cannot fail proves nothing about the shipped mapping');
});

test('[harness] assertNotCollapsed FIRES on a deliberately collapsed plan', () => {
  const collapsed = [{ key: '', title: 'ROOT', id: 'r', parentId: null, role: tree.ROLE_ROOT }];
  assert.throws(() => assertNotCollapsed(collapsed, 4), /COLLAPSED/);
  const shared = [
    { key: '', title: 'ROOT', id: 'r', parentId: null, role: tree.ROLE_ROOT },
    { key: 'a', title: 'a', id: 'same', parentId: 'r', role: tree.ROLE_ARTIFACT },
    { key: 'b', title: 'b', id: 'same', parentId: 'r', role: tree.ROLE_ARTIFACT },
  ];
  assert.throws(() => assertNotCollapsed(shared, 2), /COLLAPSED/);
});

test('[harness] both AC2 oracles PASS the shipped mapping — they are not always-throw stubs', () => {
  const artifacts = [
    { path: 'prd.md', body: '#p' },
    { path: 'prd/capabilities/alpha.md', body: '#a' },
  ];
  const plan = tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S',
    rootPage: { title: 'ROOT', id: null }, artifacts,
  });
  const report = tree.executePlan(plan, mockConfluence());
  assertNotFlattened(report.pages, new Map([['alpha', 3]]));
  assertNotCollapsed(report.pages, 2);
});

// ═════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The fixture corpus. Deliberately three levels deep, with a sharded PRD beside
 * its index file, artifacts belonging to BOTH stores, and artifacts belonging to
 * neither — so AC6's selection has something to get wrong.
 */
const FIXTURE_FILES = Object.freeze({
  'product-brief-fixture-2026-01-01.md': '# Brief\n\nbrief body\n',
  'prd.md': '# PRD\n\nindex body\n',
  'prd/vision-and-system-context.md': '# Vision\n',
  'prd/capabilities/alpha-capability.md': '# Alpha\n',
  'prd/capabilities/beta-capability.md': '# Beta\n',
  'architecture.md': '# Architecture\n',
  'architecture/decisions/some-decision.md': '# Decision\n',
  'ux-design.md': '# UX\n',
  'epics.md': '# Epics\n',
  'domain-research-fixture.md': '# Domain research\n',
  'validation-report-prd-fixture.md': '# Not the PRD\n',
  'random-notes.md': '# Not routed\n',
});

/** Artifacts the system requirements store owns, from FIXTURE_FILES. */
const FIXTURE_SYSTEM_PATHS = Object.freeze([
  'prd.md',
  'prd/capabilities/alpha-capability.md',
  'prd/capabilities/beta-capability.md',
  'prd/vision-and-system-context.md',
  'product-brief-fixture-2026-01-01.md',
]);

function withFixtureProject(fn, layoutOverrides) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-ptree-')));
  const origCwd = process.cwd();
  const pa = path.join(tmp, '_bmad-output', 'planning-artifacts');
  for (const [rel, body] of Object.entries(FIXTURE_FILES)) {
    const abs = path.join(pa, rel.replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  process.chdir(tmp);
  try {
    quiet(() => cli.writeProjectLayoutYaml(Object.assign({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'PROD', rootPage: { title: 'FixtureProject', id: null },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }, layoutOverrides || {})));
    return fn(tmp);
  } finally {
    process.chdir(origCwd);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* Windows lock */ }
  }
}

function quiet(fn) {
  const origLog = console.log;
  const origErr = console.error;
  let out = '';
  console.log = (...a) => { out += a.join(' ') + '\n'; };
  console.error = (...a) => { out += a.join(' ') + '\n'; };
  try { return { value: fn(), out }; } finally { console.log = origLog; console.error = origErr; }
}

/**
 * Run `ma-agents confluence-plan` and return everything it printed.
 *
 * DELIBERATELY SYNCHRONOUS. `test()` above is synchronous, so an `async` test body
 * would return a promise that nothing awaits — every assertion inside it would be
 * unobservable and the test would pass no matter what. `handleConfluencePlan` is
 * declared `async` but contains no `await`, so its body runs to completion before
 * it returns; the assertion below fires if that ever stops being true, rather than
 * letting these tests quietly measure an empty buffer.
 */
function runConfluencePlan(args) {
  const { value, out } = quiet(() => cli.handleConfluencePlan(args || []));
  if (value && typeof value.catch === 'function') value.catch(() => {});
  assert.ok(out.length > 0,
    'handleConfluencePlan printed nothing synchronously. If an `await` was added to it, these ' +
    'tests are measuring an empty buffer and must be rewritten to await it properly.');
  return out;
}

/** Build the system store's plan for a fixture project, exactly as the CLI does. */
function systemPlanFor(root) {
  const store = cli.resolveProjectTopology(root).topology.systemRequirementsStore;
  const dir = cli.storeArtifactsDirectory(store, root);
  const candidates = cli.collectStoreArtifactCandidates(dir);
  const selection = tree.artifactsForStore(tree.SYSTEM_REQUIREMENTS, candidates);
  const plan = tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS,
    spaceKey: store.spaceKey,
    rootPage: store.rootPage,
    artifacts: selection.selected,
  });
  return { store, dir, candidates, selection, plan };
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — AC6: ONLY THIS STORE'S ARTIFACTS, BOUND TO OUTSIDE AUTHORITIES
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. AC6 — store-scoped selection, bound to authorities outside the code ===\n');

/**
 * AUTHORITY 1 — Story 31.6's routing table. That story's AC6 deliverable is
 * explicit that the document IS the specification the code is checked against,
 * not documentation of the code. Parsed here, never copied.
 */
const ROUTING_TABLE_PATH = path.join(
  PROJECT_ROOT, '_bmad-output', 'implementation-artifacts', '31-6-artifact-to-store-routing.md');

function routingTableRows() {
  const body = fs.readFileSync(ROUTING_TABLE_PATH, 'utf-8').replace(/\r\n/g, '\n');
  const section = body.split('## 3. THE ROUTING TABLE')[1];
  assert.ok(section, 'Story 31.6 routing table section 3 not found');
  const rows = new Map();
  for (const line of section.split('\n')) {
    const m = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    rows.set(Number(m[1]), { artifact: m[2], destination: m[3], ruleSource: m[4] });
  }
  return rows;
}

/** The table's three destination tokens, translated to this module's store ids. */
const DESTINATION_TO_STORE_ID = Object.freeze({
  'system requirements': tree.SYSTEM_REQUIREMENTS,
  'software requirements': tree.SOFTWARE_REQUIREMENTS,
  'sprint management': tree.SPRINT_MANAGEMENT,
});

/**
 * Which ROW of the routing table each artifact kind is. This mapping lives in the
 * test; the DESTINATION does not — that is read out of the table. So flipping any
 * value in `ARTIFACT_KIND_OWNER` fails here, which is the mutation that killed
 * Story 31.9's wrong-store defect and the one Story 31.6's reviewer used to
 * reassign the architecture document.
 */
const KIND_TO_ROW = Object.freeze({
  'product-brief': 1,
  'prd': 2,
  'sharded-prd-index': 3,
  'sharded-prd-shard': 4,
  'architecture': 5,
  'sharded-architecture': 6,
  'ux-design-specification': 7,
  'epics': 8,
  'domain-research-report': 9,
  'market-research-report': 10,
  'technical-research-report': 11,
  'story-file': 12,
  'sprint-status': 13,
  'bug-file': 14,
  'retrospective': 15,
  'other-implementation-artifact': 16,
});

test('[authority] the routing table parses, and carries exactly 16 rows', () => {
  const rows = routingTableRows();
  assert.strictEqual(rows.size, 16,
    `Story 31.6's routing table has ${rows.size} rows, not 16 — the parse below is measuring ` +
    `something other than the table it was written against`);
});

test('[authority] every artifact kind maps to a distinct routing-table row (a bijection)', () => {
  const kinds = Object.keys(tree.ARTIFACT_KIND_OWNER).sort();
  assert.deepStrictEqual(kinds, Object.keys(KIND_TO_ROW).sort(),
    'a kind added to ARTIFACT_KIND_OWNER with no row is a destination nobody stated');
  const rowNumbers = Object.values(KIND_TO_ROW);
  assert.strictEqual(new Set(rowNumbers).size, rowNumbers.length,
    'two kinds claiming one row would let one of them inherit the other\'s destination');
  assert.deepStrictEqual([...new Set(rowNumbers)].sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i + 1));
});

for (const [kind, row] of Object.entries(KIND_TO_ROW)) {
  test(`[AC6][authority] row ${row} of Story 31.6's routing table assigns "${kind}"`, () => {
    const rows = routingTableRows();
    const entry = rows.get(row);
    assert.ok(entry, `row ${row} is missing from the routing table`);
    const expected = DESTINATION_TO_STORE_ID[entry.destination];
    assert.ok(expected,
      `row ${row}'s destination cell reads ${JSON.stringify(entry.destination)}, which is not ` +
      `one of the three tokens the table permits`);
    assert.strictEqual(tree.ARTIFACT_KIND_OWNER[kind], expected,
      `the code routes ${kind} to ${tree.ARTIFACT_KIND_OWNER[kind]}, but row ${row} ` +
      `(${entry.artifact}) says ${entry.destination} on the authority of ${entry.ruleSource}`);
  });
}

/**
 * AUTHORITY 2 — the PRD's own sentences. Independent of the routing table: FR255
 * and FR256 name their artifacts directly, so a table row and a code value could
 * only agree wrongly if both were changed AND the PRD were changed too.
 */
const PRD_CAPABILITY = path.join(
  PROJECT_ROOT, '_bmad-output', 'planning-artifacts', 'prd', 'capabilities',
  'project-knowledge-and-repository-layout.md');

function prdRequirementLine(id) {
  const body = fs.readFileSync(PRD_CAPABILITY, 'utf-8').replace(/\r\n/g, '\n');
  const line = body.split('\n').find((l) => l.trim().startsWith(`- ${id}:`));
  assert.ok(line, `${id} not found in ${PRD_CAPABILITY}`);
  return line;
}

test('[AC6][authority] FR255 names the product brief and the PRD, and the code agrees', () => {
  const fr255 = prdRequirementLine('FR255');
  assert.ok(/system requirements store/i.test(fr255));
  assert.ok(/product brief/i.test(fr255), 'FR255 no longer names the product brief');
  assert.ok(/\bPRD\b/.test(fr255), 'FR255 no longer names the PRD');
  assert.ok(/shard/i.test(fr255), 'FR255 no longer names the sharded PRD index and shards');
  for (const kind of ['product-brief', 'prd', 'sharded-prd-index', 'sharded-prd-shard']) {
    assert.strictEqual(tree.ARTIFACT_KIND_OWNER[kind], tree.SYSTEM_REQUIREMENTS,
      `FR255 puts ${kind} in the system requirements store`);
  }
});

test('[AC6][authority] FR256 names architecture, UX and epics, and the code agrees', () => {
  const fr256 = prdRequirementLine('FR256');
  assert.ok(/software requirements store/i.test(fr256));
  assert.ok(/architecture/i.test(fr256), 'FR256 no longer names the architecture document');
  assert.ok(/\bUX\b/.test(fr256), 'FR256 no longer names UX designs');
  assert.ok(/epic/i.test(fr256), 'FR256 no longer names epics');
  for (const kind of ['architecture', 'sharded-architecture', 'ux-design-specification', 'epics']) {
    assert.strictEqual(tree.ARTIFACT_KIND_OWNER[kind], tree.SOFTWARE_REQUIREMENTS,
      `FR256 puts ${kind} in the software requirements store`);
  }
});

test('[AC6][authority] FR267 keeps sprint execution state out of BOTH knowledge stores', () => {
  const body = fs.readFileSync(PRD_CAPABILITY, 'utf-8').replace(/\r\n/g, '\n');
  const fr267 = body.split('\n').find((l) => l.trim().startsWith('- FR267:'));
  assert.ok(fr267, 'FR267 not found');
  for (const kind of ['story-file', 'sprint-status', 'bug-file', 'retrospective',
    'other-implementation-artifact']) {
    assert.strictEqual(tree.ARTIFACT_KIND_OWNER[kind], tree.SPRINT_MANAGEMENT, kind);
  }
  assert.ok(!tree.PUBLISHING_STORES.includes(tree.SPRINT_MANAGEMENT),
    'sprint_management is a routing destination but NOT a store, so nothing it owns is ever ' +
    'published to Confluence');
});

test('[AC6] a confluence-backed SYSTEM store publishes the brief and the PRD', () => {
  withFixtureProject((root) => {
    const { selection } = systemPlanFor(root);
    assert.deepStrictEqual(selection.selected.map((s) => s.path), [...FIXTURE_SYSTEM_PATHS]);
  });
});

// AC6's own sentence, one assertion per named negative.
for (const [label, relPath] of [
  ['the architecture document', 'architecture.md'],
  ['a sharded architecture decision record', 'architecture/decisions/some-decision.md'],
  ['the UX design specification', 'ux-design.md'],
  ['epics', 'epics.md'],
]) {
  test(`[AC6] a system store does NOT publish ${label}`, () => {
    withFixtureProject((root) => {
      const { selection } = systemPlanFor(root);
      assert.ok(!selection.selected.some((s) => s.path === relPath),
        `${relPath} was published by the system store`);
      const ex = selection.excluded.find((e) => e.path === relPath);
      assert.ok(ex, `${relPath} was neither published nor reported as excluded — an artifact ` +
        `that simply vanishes is how a store quietly loses a document`);
      assert.strictEqual(ex.reason, tree.EXCLUDED_OTHER_STORE);
      assert.strictEqual(ex.owner, tree.SOFTWARE_REQUIREMENTS,
        'the exclusion must name where the artifact DOES belong');
    });
  });
}

test('[AC6] a system store does NOT publish story files', () => {
  const sel = tree.artifactsForStore(tree.SYSTEM_REQUIREMENTS, [
    { path: '31-10-confluence-page-tree.md', body: 'x' },
    { path: '7-1-test-infrastructure-setup.md', body: 'x' },
  ]);
  assert.strictEqual(sel.selected.length, 0);
  for (const ex of sel.excluded) {
    assert.strictEqual(ex.kind, 'story-file');
    assert.strictEqual(ex.owner, tree.SPRINT_MANAGEMENT);
    assert.strictEqual(ex.reason, tree.EXCLUDED_OTHER_STORE);
  }
});

test('[AC6] a system store does NOT publish sprint-status.yaml — refused on TWO grounds', () => {
  const sel = tree.artifactsForStore(tree.SYSTEM_REQUIREMENTS, [
    { path: 'sprint-status.yaml', body: 'x' },
  ]);
  assert.strictEqual(sel.selected.length, 0);
  assert.strictEqual(sel.excluded[0].kind, 'sprint-status');
  // Ground 1: AC1 is one page per MARKDOWN artifact.
  assert.strictEqual(sel.excluded[0].reason, tree.EXCLUDED_NOT_MARKDOWN);
  // Ground 2: ownership. Asserted separately so removing either rule fails.
  assert.strictEqual(tree.ARTIFACT_KIND_OWNER['sprint-status'], tree.SPRINT_MANAGEMENT);
});

test('[AC6] a SOFTWARE store publishes exactly the mirror-image set', () => {
  withFixtureProject((root) => {
    const store = { backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Eng', id: null } };
    const dir = cli.storeArtifactsDirectory(store, root);
    const sel = tree.artifactsForStore(tree.SOFTWARE_REQUIREMENTS,
      cli.collectStoreArtifactCandidates(dir));
    assert.deepStrictEqual(sel.selected.map((s) => s.path), [
      'architecture.md',
      'architecture/decisions/some-decision.md',
      'domain-research-fixture.md',
      'epics.md',
      'ux-design.md',
    ]);
    // And the two stores partition: nothing is in both.
    const sysSel = systemPlanFor(root).selection.selected.map((s) => s.path);
    for (const p of sel.selected.map((s) => s.path)) {
      assert.ok(!sysSel.includes(p), `${p} is claimed by BOTH stores — Story 31.6 §1 says no ` +
        `artifact belongs to more than one`);
    }
  });
});

test('[AC6] an unrecognised path is EXCLUDED AND REPORTED, never silently dropped', () => {
  withFixtureProject((root) => {
    const { selection } = systemPlanFor(root);
    const reported = selection.excluded.map((e) => e.path);
    for (const p of ['random-notes.md', 'validation-report-prd-fixture.md']) {
      assert.ok(reported.includes(p), `${p} was dropped without a word`);
      assert.strictEqual(selection.excluded.find((e) => e.path === p).reason,
        tree.EXCLUDED_UNCLASSIFIED);
    }
    // Every candidate is accounted for exactly once, in one list or the other.
    const all = [...selection.selected.map((s) => s.path), ...reported].sort();
    assert.deepStrictEqual(all, selection.selected.concat(selection.excluded)
      .map((e) => e.path).sort());
    assert.strictEqual(all.length, Object.keys(FIXTURE_FILES).length,
      'every fixture artifact must appear in exactly one of the two lists');
  });
});

test('[AC6] a derivative document ABOUT the PRD is not treated as the PRD', () => {
  assert.strictEqual(tree.classifyArtifactPath('validation-report-prd-2026-04-07.md'), null,
    'classifying a validation report as the PRD gives the store a second, rival definition ' +
    'site for the requirements');
  assert.strictEqual(tree.classifyArtifactPath('prd.md'), 'prd');
});

test('[AC6] artifactsForStore REFUSES sprint_management as a store rather than defaulting', () => {
  assert.throws(() => tree.artifactsForStore(tree.SPRINT_MANAGEMENT, []),
    /is a routing destination but NOT a store/);
  assert.throws(() => tree.artifactsForStore(undefined, []), /is not a knowledge store/,
    'a default store here would be a value indistinguishable from a real answer');
  assert.throws(() => tree.artifactsForStore('', []), /is not a knowledge store/);
});

test('[AC6] the classifier decides the REAL repository corpus, not only fixtures', () => {
  // An outside corpus: this repository's own planning artifacts. A classifier
  // that only works on files the test wrote is a classifier tested against itself.
  const dir = path.join(PROJECT_ROOT, '_bmad-output', 'planning-artifacts');
  const candidates = cli.collectStoreArtifactCandidates(dir);
  assert.ok(candidates.length > 20, 'the real corpus should be substantial');
  const sys = tree.artifactsForStore(tree.SYSTEM_REQUIREMENTS, candidates);
  const paths = sys.selected.map((s) => s.path);
  assert.ok(paths.includes('prd.md'), 'the real PRD must be a system-store artifact');
  assert.ok(paths.some((p) => p.startsWith('prd/capabilities/')),
    'the real PRD shards must be system-store artifacts');
  assert.ok(paths.some((p) => /^product-brief/.test(p)), 'the real product brief');
  assert.ok(!paths.includes('architecture.md'), 'the real architecture document must NOT be');
  assert.ok(!paths.includes('epics.md'), 'the real epics document must NOT be');
  assert.ok(!paths.some((p) => p.startsWith('architecture/')), 'nor any architecture shard');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — AC1/AC2: THE TREE MIRRORS THE SOURCE FOLDERS
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. AC1/AC2 — the tree mirrors the source folders ===\n');

/**
 * THE INDEPENDENT EXPECTATION. Walks the fixture DIRECTORY with `fs` and derives
 * parent/child relationships with `path.dirname` — a different mechanism from the
 * module's own string splitting, so the two can genuinely disagree.
 *
 * Returns the expected `(parentTitle -> childTitle)` edge set and the expected
 * title set, computed from the file system alone.
 */
function expectedTreeFromDirectory(dir, selectedPaths, rootTitle) {
  const edges = new Set();
  const titles = new Set([rootTitle]);
  const titleOf = (relSegment, isFile) => (isFile ? relSegment.replace(/\.md$/i, '') : relSegment);

  for (const rel of selectedPaths) {
    // Deliberately reconstructed from the ABSOLUTE path on disk, via dirname,
    // rather than by splitting the relative string the module was handed.
    const abs = path.join(dir, rel.replace(/\//g, path.sep));
    assert.ok(fs.existsSync(abs), `${rel} is not on disk — the fixture and the plan disagree`);
    const chain = [];
    let cursor = abs;
    while (path.resolve(cursor) !== path.resolve(dir)) {
      chain.unshift(path.basename(cursor));
      cursor = path.dirname(cursor);
    }
    let parentTitle = rootTitle;
    for (let i = 0; i < chain.length; i++) {
      const t = titleOf(chain[i], i === chain.length - 1);
      titles.add(t);
      edges.add(`${parentTitle} -> ${t}`);
      parentTitle = t;
    }
  }
  return { edges, titles };
}

test('[harness] expectedTreeFromDirectory FIRES when the plan is wrong', () => {
  withFixtureProject((root) => {
    const { dir } = systemPlanFor(root);
    const exp = expectedTreeFromDirectory(dir, ['prd/capabilities/alpha-capability.md'], 'R');
    assert.ok(exp.edges.has('R -> prd'));
    assert.ok(exp.edges.has('prd -> capabilities'));
    assert.ok(exp.edges.has('capabilities -> alpha-capability'));
    assert.ok(!exp.edges.has('R -> alpha-capability'),
      'an oracle that also accepts the flattened edge could never detect flattening');
  });
});

test('[AC1][AC2] the plan\'s edge set EQUALS the edge set derived from the directory', () => {
  withFixtureProject((root) => {
    const { dir, plan, selection } = systemPlanFor(root);
    const exp = expectedTreeFromDirectory(dir, selection.selected.map((s) => s.path), 'FixtureProject');
    const byKey = new Map(plan.nodes.map((n) => [n.key, n]));
    const actual = new Set();
    for (const n of plan.nodes) {
      if (n.parentKey === null) continue;
      actual.add(`${byKey.get(n.parentKey).title} -> ${n.title}`);
    }
    assert.deepStrictEqual([...actual].sort(), [...exp.edges].sort());
  });
});

test('[AC1][AC7] the plan\'s title set EQUALS the directory\'s, with nothing invented', () => {
  withFixtureProject((root) => {
    const { dir, plan, selection } = systemPlanFor(root);
    const exp = expectedTreeFromDirectory(dir, selection.selected.map((s) => s.path), 'FixtureProject');
    assert.deepStrictEqual(plan.nodes.map((n) => n.title).sort(), [...exp.titles].sort(),
      'a page that exists in the plan and not in the source tree is an invented hierarchy ' +
      'level, which AC7 defers');
  });
});

test('[AC1][AC2] every artifact page\'s ancestor titles equal its source path segments', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const byKey = new Map(plan.nodes.map((n) => [n.key, n]));
    let checked = 0;
    for (const node of plan.nodes) {
      if (node.role !== tree.ROLE_ARTIFACT) continue;
      // Expectation: from the SOURCE STRING, by splitting.
      const expected = node.sourcePath.split('/').map((s, i, a) =>
        (i === a.length - 1 ? s.replace(/\.md$/i, '') : s));
      // Actual: from the PLAN, by walking parent links.
      const chain = [];
      let cursor = node;
      while (cursor.parentKey !== null) { chain.unshift(cursor.title); cursor = byKey.get(cursor.parentKey); }
      assert.deepStrictEqual(chain, expected, `${node.sourcePath}`);
      checked++;
    }
    assert.strictEqual(checked, FIXTURE_SYSTEM_PATHS.length,
      'a loop that checked nothing would pass — this pins how many it checked');
  });
});

test('[AC2] the mapping is NOT FLATTENED — measured by the independent oracle', () => {
  withFixtureProject((root) => {
    const { plan, selection } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    const depths = new Map(selection.selected.map((s) => [
      s.path.split('/').pop().replace(/\.md$/i, ''), s.path.split('/').length]));
    assertNotFlattened(report.pages, depths);
  });
});

test('[AC2] the mapping is NOT COLLAPSED into one page per store', () => {
  withFixtureProject((root) => {
    const { plan, selection } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    assertNotCollapsed(report.pages, selection.selected.length);
  });
});

test('[AC2] the page count equals artifacts + source folders + the root, less the index merges', () => {
  withFixtureProject((root) => {
    const { plan, selection } = systemPlanFor(root);
    // Every term computed by the TEST, from the source paths, independently of
    // the module's own tree building.
    const artifactKeys = new Set(selection.selected.map((s) => s.path.replace(/\.md$/i, '')));
    const folders = new Set();
    for (const s of selection.selected) {
      const segs = s.path.split('/');
      for (let i = 0; i < segs.length - 1; i++) folders.add(segs.slice(0, i + 1).join('/'));
    }
    // A folder whose name matches a sibling artifact IS that artifact's page —
    // this is the index rule, and it is the only reason the naive sum is wrong.
    const merged = [...folders].filter((f) => artifactKeys.has(f));
    assert.strictEqual(merged.length, 1, 'the fixture must exercise the index rule exactly once');
    assert.deepStrictEqual(merged, ['prd']);
    assert.strictEqual(plan.nodes.length,
      artifactKeys.size + folders.size + 1 - merged.length,
      'the tree must contain exactly one page per artifact, one per source folder, the root, ' +
      'and nothing else');
    // Restated as inequalities, because the equality above would also hold for a
    // tree with the right COUNT and the wrong shape.
    assert.ok(plan.nodes.length > selection.selected.length,
      'there must be strictly more pages than artifacts, or no folder level exists');
    assert.strictEqual(plan.nodes.filter((n) => n.role === tree.ROLE_ARTIFACT).length,
      selection.selected.length);
  });
});

test('[AC1] a sharded PRD is an INDEX page with its capability shards as child pages', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const byKey = new Map(plan.nodes.map((n) => [n.key, n]));
    const index = byKey.get('prd');
    assert.ok(index, 'no page for prd.md');
    assert.strictEqual(index.role, tree.ROLE_ARTIFACT,
      'the sharded PRD index page must carry the index document itself, not be an empty container');
    assert.strictEqual(index.sourcePath, 'prd.md');
    assert.strictEqual(index.parentKey, '', 'the index hangs off the root page');
    // Every shard is a DESCENDANT of the index page.
    const shards = plan.nodes.filter((n) => n.sourcePath && n.sourcePath.startsWith('prd/'));
    assert.ok(shards.length >= 3, 'the fixture must actually have shards');
    for (const shard of shards) {
      let cursor = shard;
      const chain = [];
      while (cursor.parentKey !== null) { cursor = byKey.get(cursor.parentKey); chain.push(cursor.key); }
      assert.ok(chain.includes('prd'), `${shard.sourcePath} is not under the PRD index page`);
    }
    // And the capability shards specifically sit under the capabilities page.
    const caps = plan.nodes.filter((n) => n.sourcePath &&
      n.sourcePath.startsWith('prd/capabilities/'));
    assert.strictEqual(caps.length, 2);
    for (const c of caps) assert.strictEqual(byKey.get(c.parentKey).title, 'capabilities');
  });
});

test('[AC1] the set-aware classifier calls prd.md the sharded PRD INDEX when shards exist', () => {
  const withShards = tree.classifyArtifactPaths(['prd.md', 'prd/capabilities/a.md']);
  assert.strictEqual(withShards[0].kind, 'sharded-prd-index');
  const alone = tree.classifyArtifactPaths(['prd.md']);
  assert.strictEqual(alone[0].kind, 'prd',
    'an unsharded PRD is row 2, not row 3 — and both are system requirements, so this can ' +
    'never move an artifact between stores');
});

test('[AC1] the tree is deterministic — parents strictly before children, stable order', () => {
  withFixtureProject((root) => {
    const a = systemPlanFor(root).plan;
    const b = systemPlanFor(root).plan;
    assert.deepStrictEqual(a.nodes.map((n) => n.key), b.nodes.map((n) => n.key));
    const seen = new Set();
    for (const n of a.nodes) {
      if (n.parentKey !== null) {
        assert.ok(seen.has(n.parentKey),
          `${n.key} is planned before its parent ${n.parentKey}, so it cannot be nested`);
      }
      seen.add(n.key);
    }
  });
});

test('[AC5-adjacent] two artifacts that would share one page title are REFUSED, both named', () => {
  assert.throws(() => tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
    artifacts: [{ path: 'prd/a/changelog.md', body: 'x' }, { path: 'prd/b/changelog.md', body: 'y' }],
  }), (e) => /changelog/.test(e.message) && /prd\/a\/changelog/.test(e.message) &&
       /prd\/b\/changelog/.test(e.message),
  'Confluence titles are unique within a space; publishing both would interleave two ' +
  'documents into one page\'s history on every run');
});

test('[AC1] planStorePublication REFUSES to invent a root page name', () => {
  assert.throws(() => tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: '', id: null }, artifacts: [],
  }), /refusing to invent a page name/);
  assert.throws(() => tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: '', rootPage: { title: 'R', id: null }, artifacts: [],
  }), /refusing to plan a publication with none/);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — AC3: A BLANK ROOT PAGE IS CREATED HERE, AND REPORTED
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. AC3 — the blank root page is created here, named, and reported ===\n');

test('[AC3] the generated name is {project_name}, computed by the SHIPPED function', () => {
  withFixtureProject((root) => {
    // The name Story 31.8 substitutes when the root-page answer is blank. Read
    // from the shipped function rather than restated, so the announcement, the
    // committed record and this expectation are one value.
    const generated = cli.generatedRootPageTitle(root);
    assert.ok(generated, 'no project name could be derived for the fixture');
    quiet(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'PROD', rootPage: { title: generated, id: null },
      },
    }));
    const { plan } = systemPlanFor(root);
    assert.strictEqual(plan.nodes[0].title, generated);
    assert.strictEqual(plan.nodes[0].role, tree.ROLE_ROOT);
  }, { systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' } });
});

test('[AC3] against an empty space the root page is CREATED, and the report says so', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    assert.strictEqual(report.rootPage.title, 'FixtureProject');
    assert.strictEqual(report.rootPage.created, true);
    assert.ok(report.rootPage.id, 'the created root page must come back with an id');
    assert.ok(report.created.includes('FixtureProject'));
  });
});

test('[AC3] against a space that already has it, the root page is NOT created again', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    const first = tree.executePlan(plan, mcp);
    const second = tree.executePlan(plan, mcp);
    assert.strictEqual(second.rootPage.created, false);
    assert.strictEqual(second.rootPage.id, first.rootPage.id);
    assert.ok(second.updated.includes('FixtureProject'));
  });
});

test('[AC3] `confluence-plan` REPORTS the root page name to the user', () => {
  // Asserted on the command's actual output, not on the report object — AC3's
  // promise is to the user, and Story 31.11 shipped an offer nothing was
  // directed to read.
  withFixtureProject(() => {
    const out = runConfluencePlan([]);
    assert.ok(/FixtureProject/.test(out), `the root page name is absent from:\n${out}`);
    assert.ok(/Root page/.test(out));
    assert.ok(/PROD/.test(out), 'the space must be named too');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — AC4: WRITES GO THROUGH THE MCP, AND NOTHING IS WRITTEN LOCALLY
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. AC4 — through the MCP only, and no local copy ===\n');

test('[AC4] the page-tree module requires NOTHING — it cannot open a file or a socket', () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'confluence-page-tree.js'), 'utf-8');
  // Every `require(` that is not inside a comment. Enumerated, not sampled.
  const codeOnly = src.split('\n')
    .filter((l) => !/^\s*(\*|\/\/)/.test(l))
    .join('\n');
  const found = codeOnly.match(/\brequire\s*\(/g) || [];
  assert.deepStrictEqual(found, [],
    `the module takes ${found.length} dependencies; with no fs and no net there is no path ` +
    `by which it could write a local copy or reach a network, which is what makes AC4's ` +
    `negative structural rather than behavioural`);
});

test('[AC4] loading the module pulls no module into the require cache but itself', () => {
  const target = require.resolve(path.join(PROJECT_ROOT, 'lib', 'confluence-page-tree.js'));
  delete require.cache[target];
  const before = new Set(Object.keys(require.cache));
  require(target);
  const added = Object.keys(require.cache).filter((k) => !before.has(k));
  assert.deepStrictEqual(added, [target]);
});

test('[AC4] a full plan+publish writes NOT ONE BYTE anywhere under the project root', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const before = snapshotTree(root);
    const report = tree.executePlan(plan, mockConfluence());
    assert.strictEqual(report.ok, true, 'the publish must actually have happened');
    const after = snapshotTree(root);
    // Enumeration, not "nothing was requested": every path and every digest.
    assert.deepStrictEqual(Object.keys(after).sort(), Object.keys(before).sort(),
      'the set of files under the project root changed');
    assert.deepStrictEqual(after, before, 'a file under the project root changed');
  });
});

test('[AC4] a publish completes with EVERY fs write primitive poisoned', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    let report;
    withFsWritesPoisoned(() => { report = tree.executePlan(plan, mockConfluence()); });
    assert.strictEqual(report.ok, true);
    assert.ok(report.pages.length > 1);
  });
});

test('[AC4] `confluence-plan` writes nothing either — same enumeration', () => {
  withFixtureProject((root) => {
    const before = snapshotTree(root);
    const out = runConfluencePlan([]);
    assert.ok(/Confluence page tree/.test(out), 'the command must actually have done its work');
    assert.deepStrictEqual(snapshotTree(root), before);
  });
});

test('[AC4] with NO Confluence MCP the publish HALTS, and says the four FR262 things', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    let err = null;
    try { tree.executePlan(plan, null); } catch (e) { err = e; }
    assert.ok(err, 'a missing MCP must HALT, not proceed');
    assert.strictEqual(err.name, 'ConfluencePublishError');
    assert.strictEqual(err.reason, 'no-confluence-mcp');
    assert.strictEqual(err.published, false);
    // FACT 1 — the affected store.
    assert.ok(/system requirements store/.test(err.message));
    // FACT 2 — its configured space.
    assert.ok(/Space: PROD/.test(err.message));
    // FACT 3 — that no Confluence MCP was detected.
    assert.ok(/no Confluence MCP was detected/.test(err.message));
    // FACT 4 — how to configure one.
    assert.ok(/add a Confluence-capable MCP server/.test(err.message));
  });
});

test('[AC4] the no-MCP halt happens BEFORE the first operation, not part-way through', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const before = snapshotTree(root);
    assert.throws(() => tree.executePlan(plan, undefined), /no Confluence MCP was detected/);
    assert.deepStrictEqual(snapshotTree(root), before,
      'and nothing was written locally on the way out');
  });
});

test('[AC4] every write in a publish went through the dispatcher — there is no second path', () => {
  withFixtureProject((root) => {
    const { plan, selection } = systemPlanFor(root);
    const mcp = mockConfluence();
    const report = tree.executePlan(plan, mcp);
    const writes = mcp.calls.filter((c) => c.operation !== 'resolve_page');
    assert.strictEqual(writes.length, report.pages.length,
      'one write per page, all of them observed by the mock');
    assert.strictEqual(report.pages.filter((p) => p.role === tree.ROLE_ARTIFACT).length,
      selection.selected.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — AC5: UPDATE, DO NOT DUPLICATE. AND IT IS NOT A SYNC.
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. AC5 — an idempotent write, which is not a sync ===\n');

test('[AC5] a re-run against a published store CREATES NOTHING and updates everything', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    const first = tree.executePlan(plan, mcp);
    const second = tree.executePlan(plan, mcp);
    assert.ok(first.created.length > 1, 'the first run must actually create pages');
    assert.deepStrictEqual(second.created, [],
      'a second run that creates anything has DUPLICATED a page, and its history and comments ' +
      'are on the page nobody is reading any more');
    assert.strictEqual(second.updated.length, first.created.length);
    // Identity survived: the same page ids, page for page.
    assert.deepStrictEqual(
      second.pages.map((p) => `${p.key}=${p.id}`),
      first.pages.map((p) => `${p.key}=${p.id}`));
  });
});

test('[AC5] a THIRD run is still stable — idempotence, not a one-shot coincidence', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    tree.executePlan(plan, mcp);
    const second = tree.executePlan(plan, mcp);
    const third = tree.executePlan(plan, mcp);
    assert.deepStrictEqual(third.pages, second.pages);
    assert.deepStrictEqual(third.created, []);
  });
});

test('[AC5] the mock would have SHOWN a duplicate — the idempotence claim is falsifiable', () => {
  // Probe: with a resolver that always answers "not found", the same plan run
  // twice creates twice. If this did not fail, the test above could pass against
  // a mock incapable of reporting duplication.
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const blind = mockConfluence({ resolveResponse: () => ({ found: false }) });
    const first = tree.executePlan(plan, blind);
    const second = tree.executePlan(plan, blind);
    assert.ok(second.created.length === first.created.length && second.created.length > 0,
      'the harness cannot detect duplication, so the idempotence result above means nothing');
    assert.notDeepStrictEqual(second.pages.map((p) => p.id), first.pages.map((p) => p.id),
      'duplicated pages must come back with different ids');
  });
});

test('[AC5][shape 6] a FAILED write throws — it does not report a publish', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    let err = null;
    let returned = 'NOT-ASSIGNED';
    try {
      returned = tree.executePlan(plan, mockConfluence({ failOn: { title: 'capabilities' } }));
    } catch (e) { err = e; }
    assert.ok(err, 'a failed write returned normally — this is Story 31.13\'s "Bound." defect');
    assert.strictEqual(returned, 'NOT-ASSIGNED', 'nothing may be returned on a failed publish');
    assert.strictEqual(err.name, 'ConfluencePublishError');
    assert.strictEqual(err.reason, 'write-failed');
    assert.strictEqual(err.published, false);
    assert.ok(/capabilities/.test(err.message), 'the failing page must be named');
    assert.ok(/create_page|update_page/.test(err.message), 'the operation must be named');
    assert.ok(/has NOT been published/.test(err.message));
    assert.ok(/insufficient permissions/.test(err.message), 'the server\'s reason must survive');
  });
});

// Every shape of "not a success", including the ones that look like one.
for (const [label, response] of [
  ['undefined', undefined],
  ['null', null],
  ['an empty object', {}],
  ['ok:false', { ok: false, id: 'p1' }],
  ['ok as the STRING "true"', { ok: 'true', id: 'p1' }],
  ['ok:1', { ok: 1, id: 'p1' }],
  ['ok:true with no id', { ok: true }],
  ['ok:true with an empty id', { ok: true, id: '' }],
  ['ok:true with a whitespace id', { ok: true, id: '   ' }],
  ['a bare string', 'created'],
]) {
  test(`[AC5][shape 6] a write answering ${label} is NOT a success`, () => {
    const plan = tree.planStorePublication({
      storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
      artifacts: [{ path: 'prd.md', body: '#' }],
    });
    assert.throws(
      () => tree.executePlan(plan, mockConfluence({ failOn: { nth: 1, response } })),
      (e) => e.name === 'ConfluencePublishError' && e.published === false,
      `${label} was believed`);
  });
}

// Shape 1 — a permissive default on the IDENTITY half.
for (const [label, response] of [
  ['undefined', {}],
  ['the string "no"', { found: 'no' }],
  ['null', { found: null }],
  ['0', { found: 0 }],
  ['omitted entirely', { id: 'p9' }],
]) {
  test(`[AC5][shape 1] an inconclusive resolve (found = ${label}) HALTS, it does not guess`, () => {
    const plan = tree.planStorePublication({
      storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
      artifacts: [{ path: 'prd.md', body: '#' }],
    });
    assert.throws(
      () => tree.executePlan(plan, mockConfluence({ resolveResponse: () => response })),
      (e) => e.reason === 'resolve-inconclusive',
      'guessing "not found" duplicates a page that exists and destroys its history');
  });
}

test('[AC5] a resolve that says found but returns no id HALTS', () => {
  const plan = tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
    artifacts: [{ path: 'prd.md', body: '#' }],
  });
  assert.throws(
    () => tree.executePlan(plan, mockConfluence({ resolveResponse: () => ({ found: true }) })),
    (e) => e.reason === 'resolve-missing-id');
});

test('[FR266 negative] NO Confluence CONTENT is consumed — nothing can become a cache', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    // Publish once so every subsequent resolve is a `found` answer carrying the
    // poison body and a version number.
    tree.executePlan(plan, mcp);
    const report = tree.executePlan(plan, mcp);
    const serialisedCalls = JSON.stringify(mcp.payloads());
    assert.ok(!serialisedCalls.includes(POISON_BODY),
      'a body returned by Confluence reached a later operation\'s payload — that is a copy of ' +
      'Confluence content, which is the mirror FR266 retired');
    assert.ok(!JSON.stringify(report).includes(POISON_BODY),
      'a body returned by Confluence reached the publish report');
    // And the bodies that WERE sent are the local sources, not anything returned.
    const bodies = mcp.payloads().map((a) => a.body).filter((b) => b);
    assert.ok(bodies.length > 0);
    for (const b of bodies) assert.ok(!b.includes('CONFLUENCE-CONTENT'));
  });
});

test('[FR266 negative] the operation set is a CLOSED SET of three, asserted by equality', () => {
  assert.deepStrictEqual([...tree.CONFLUENCE_PAGE_OPERATIONS],
    ['resolve_page', 'create_page', 'update_page'],
    'the operation set is enumerated the way mcp-detection-pattern-spec.md §3 enumerates the ' +
    'sprint operations catalog; growing it is a deliberate act with a test to update');
  assert.ok(Object.isFrozen(tree.CONFLUENCE_PAGE_OPERATIONS));
  // There is no delete, archive, move, list or body-read. Stated as a consequence
  // of the set equality above, not as a separate denylist — a denylist is walked
  // past by rewording, and this epic has been bitten by that twice.
  assert.strictEqual(tree.CONFLUENCE_PAGE_OPERATIONS.length, 3);
});

test('[FR266 negative] a publish performs ONLY operations from the catalogue', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    const report = tree.executePlan(plan, mcp);
    const observed = new Set(mcp.operationNames());
    for (const op of observed) {
      assert.ok(tree.CONFLUENCE_PAGE_OPERATIONS.includes(op), `${op} is outside the catalogue`);
    }
    assert.deepStrictEqual([...observed].sort(), ['create_page', 'resolve_page'].sort(),
      'a first publish resolves and creates, and does nothing else');
    assert.deepStrictEqual(report.operationsPerformed, mcp.operationNames(),
      'the report\'s operation log must match what the MCP actually saw');
  });
});

test('[FR266 negative] only catalogue members ever reach the dispatcher, over every plan shape', () => {
  // Driven over four different plans — empty, flat, deep, and a re-run — so the
  // claim is not "this one path emits three names" but "no path emits a fourth".
  const shapes = [
    [],
    [{ path: 'prd.md', body: '#' }],
    [{ path: 'prd.md', body: '#' }, { path: 'prd/capabilities/a.md', body: '#' },
      { path: 'prd/capabilities/b.md', body: '#' }],
  ];
  const seen = new Set();
  for (const artifacts of shapes) {
    const plan = tree.planStorePublication({
      storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null }, artifacts,
    });
    const mcp = mockConfluence();
    tree.executePlan(plan, mcp);
    tree.executePlan(plan, mcp);
    for (const op of mcp.operationNames()) seen.add(op);
  }
  for (const op of seen) {
    assert.ok(tree.CONFLUENCE_PAGE_OPERATIONS.includes(op), `${op} is outside the catalogue`);
  }
  assert.deepStrictEqual([...seen].sort(), [...tree.CONFLUENCE_PAGE_OPERATIONS].sort(),
    'and all three catalogue members are actually reachable — an unreachable operation in the ' +
    'catalogue would make the set equality above vacuously safe');
});

test('[AC5] a plan whose parent page never resolved is a HALT, not a page at the space root', () => {
  // The ordering guard. Reparenting a page to the space root because its parent
  // is unknown is how a tree quietly flattens itself at execution time.
  const plan = tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
    artifacts: [{ path: 'prd/capabilities/a.md', body: '#' }],
  });
  plan.nodes = plan.nodes.filter((n) => n.key !== 'prd');
  assert.throws(() => tree.executePlan(plan, mockConfluence()),
    (e) => e.reason === 'parent-unresolved' && e.published === false);
});

test('[FR266 negative] the module\'s public API names no mirror, cache, sync or conflict', () => {
  // The POSITIVE form: the export set is enumerated and asserted by equality, so
  // a `syncStore` export fails here by being unexpected rather than by matching a
  // forbidden word.
  assert.deepStrictEqual(Object.keys(tree).sort(), [
    'ARTIFACT_KIND_OWNER', 'CONFLUENCE_PAGE_OPERATIONS', 'ConfluencePublishError',
    'EXCLUDED_HIDDEN', 'EXCLUDED_NOT_MARKDOWN', 'EXCLUDED_OTHER_STORE', 'EXCLUDED_UNCLASSIFIED',
    'PUBLISHING_STORES', 'ROLE_ARTIFACT', 'ROLE_INDEX', 'ROLE_ROOT',
    'SOFTWARE_REQUIREMENTS', 'SPRINT_MANAGEMENT', 'SYSTEM_REQUIREMENTS',
    'artifactsForStore', 'classifyArtifactPath', 'classifyArtifactPaths', 'executePlan',
    'labelForStore', 'noMcpMessage', 'normalizeRelPath', 'planStorePublication',
  ].sort());
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — AC7: OUT OF SCOPE, AND ENFORCED AS SUCH
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. AC7 — no templates, no hierarchy beyond the tree mapping ===\n');

test('[AC7] an artifact page\'s body is the source markdown, BYTE FOR BYTE', () => {
  withFixtureProject((root) => {
    const { plan, dir } = systemPlanFor(root);
    const mcp = mockConfluence();
    tree.executePlan(plan, mcp);
    let checked = 0;
    for (const call of mcp.calls) {
      if (call.operation !== 'create_page') continue;
      const node = plan.nodes.find((n) => n.title === call.args.title);
      if (!node || node.role !== tree.ROLE_ARTIFACT) continue;
      const source = fs.readFileSync(path.join(dir, node.sourcePath.replace(/\//g, path.sep)), 'utf-8');
      assert.strictEqual(call.args.body, source,
        `${node.sourcePath} was wrapped, prefixed or templated on its way to Confluence`);
      checked++;
    }
    assert.strictEqual(checked, FIXTURE_SYSTEM_PATHS.length);
  });
});

test('[AC7] a container page carries NO content — not a generated one', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const mcp = mockConfluence();
    tree.executePlan(plan, mcp);
    const containers = plan.nodes.filter((n) => n.role === tree.ROLE_INDEX);
    assert.ok(containers.length > 0, 'the fixture must have at least one container page');
    for (const c of containers) {
      const call = mcp.calls.find((k) => k.operation === 'create_page' && k.args.title === c.title);
      assert.ok(call, `${c.title} was never created`);
      assert.strictEqual(call.args.body, '',
        'a generated container body is a per-artifact page template, which P5-9 defers');
    }
  });
});

test('[AC7] no hierarchy level exists that the source tree does not have', () => {
  withFixtureProject((root) => {
    const { plan, selection } = systemPlanFor(root);
    const sourceKeys = new Set(['']);
    for (const s of selection.selected) {
      const segs = s.path.split('/').map((x, i, a) => (i === a.length - 1 ? x.replace(/\.md$/i, '') : x));
      for (let i = 0; i < segs.length; i++) sourceKeys.add(segs.slice(0, i + 1).join('/'));
    }
    assert.deepStrictEqual(plan.nodes.map((n) => n.key).sort(), [...sourceKeys].sort(),
      'a page key with no counterpart in the source tree is an enforced hierarchy, deferred at P5-9');
  });
});

test('[AC7] an artifact page with no body is REFUSED, not published empty', () => {
  const plan = tree.planStorePublication({
    storeId: tree.SYSTEM_REQUIREMENTS, spaceKey: 'S', rootPage: { title: 'R', id: null },
    artifacts: [{ path: 'prd.md' }],
  });
  assert.throws(() => tree.executePlan(plan, mockConfluence()),
    (e) => e.reason === 'artifact-body-missing');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 — OQ-4: THE ID THIS LAYER LEARNS, AND WHEN IT IS DROPPED
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 7. OQ-4 — filling the root page id in, and dropping it on retitle ===\n');

test('[OQ-4] Story 31.8 records a TITLE with id null; this layer fills the id in', () => {
  withFixtureProject((root) => {
    const before = cli.resolveProjectTopology(root).topology.systemRequirementsStore;
    assert.strictEqual(before.rootPage.id, null, 'the precondition OQ-4 settles');
    const { plan } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    const outcome = quiet(() => cli.recordLearnedRootPageId({
      projectRoot: root, storeId: tree.SYSTEM_REQUIREMENTS,
      title: report.rootPage.title, id: report.rootPage.id,
    })).value;
    assert.strictEqual(outcome.outcome, cli.ROOT_ID_RECORDED);
    const after = cli.resolveProjectTopology(root).topology.systemRequirementsStore;
    assert.strictEqual(after.rootPage.id, report.rootPage.id);
    assert.strictEqual(after.rootPage.title, 'FixtureProject');
  });
});

test('[OQ-4] recording the id changes ONLY project-layout.yaml, and only its id line', () => {
  withFixtureProject((root) => {
    const layoutRel = '_bmad-output/project-layout.yaml';
    const before = snapshotTree(root);
    const beforeText = fs.readFileSync(path.join(root, layoutRel), 'utf-8');
    const { plan } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    quiet(() => cli.recordLearnedRootPageId({
      projectRoot: root, storeId: tree.SYSTEM_REQUIREMENTS,
      title: report.rootPage.title, id: report.rootPage.id,
    }));
    const after = snapshotTree(root);
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
    const addedOrRemoved = [
      ...Object.keys(after).filter((k) => !(k in before)),
      ...Object.keys(before).filter((k) => !(k in after)),
    ];
    assert.deepStrictEqual(addedOrRemoved, [], 'no file may be created or removed');
    assert.deepStrictEqual(changed, [layoutRel],
      'the binding record is the ONLY local file this story writes, and it holds page ' +
      'IDENTITY (NFR79), never artifact content');
    // And within that file, only the id.
    const afterText = fs.readFileSync(path.join(root, layoutRel), 'utf-8');
    const diff = beforeText.split(/\r?\n/).map((l, i) => [l, afterText.split(/\r?\n/)[i]])
      .filter(([a, b]) => a !== b);
    assert.strictEqual(diff.length, 1, `more than the id line changed: ${JSON.stringify(diff)}`);
    assert.ok(/^\s*id:/.test(diff[0][0]) && /^\s*id:/.test(diff[0][1]), JSON.stringify(diff[0]));
  });
});

test('[OQ-4] a SECOND recording of the same id is a no-op, distinguishable by name', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    const args = {
      projectRoot: root, storeId: tree.SYSTEM_REQUIREMENTS,
      title: report.rootPage.title, id: report.rootPage.id,
    };
    quiet(() => cli.recordLearnedRootPageId(args));
    const snap = snapshotTree(root);
    const again = quiet(() => cli.recordLearnedRootPageId(args)).value;
    assert.strictEqual(again.outcome, cli.ROOT_ID_UNCHANGED);
    assert.deepStrictEqual(snapshotTree(root), snap, 'a no-op must not rewrite the file');
  });
});

test('[OQ-4] the id is DROPPED on retitle — a learned id is never stamped onto a new title', () => {
  withFixtureProject((root) => {
    const { plan } = systemPlanFor(root);
    const report = tree.executePlan(plan, mockConfluence());
    // The user retitles the root page in the binding between plan and write-back.
    quiet(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'PROD', rootPage: { title: 'A Different Page', id: null },
      },
    }));
    const snap = snapshotTree(root);
    const outcome = quiet(() => cli.recordLearnedRootPageId({
      projectRoot: root, storeId: tree.SYSTEM_REQUIREMENTS,
      title: report.rootPage.title, id: report.rootPage.id,
    })).value;
    assert.strictEqual(outcome.outcome, cli.ROOT_ID_TITLE_MOVED);
    assert.strictEqual(outcome.recordedTitle, 'A Different Page');
    assert.strictEqual(outcome.publishedTitle, 'FixtureProject');
    assert.deepStrictEqual(snapshotTree(root), snap,
      'a {title, id} pair naming two different pages looks resolved and points where the user ' +
      'did not choose — so nothing may be written');
  });
});

test('[OQ-4] a file-system store never gets a page id, and says so by name', () => {
  withFixtureProject((root) => {
    const outcome = quiet(() => cli.recordLearnedRootPageId({
      projectRoot: root, storeId: tree.SOFTWARE_REQUIREMENTS, title: 'X', id: 'p1',
    })).value;
    assert.strictEqual(outcome.outcome, cli.ROOT_ID_NOT_CONFLUENCE);
  });
});

test('[OQ-4] an unbound project is reported as unbound, not written to', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-unbound-')));
  try {
    const outcome = quiet(() => cli.recordLearnedRootPageId({
      projectRoot: tmp, storeId: tree.SYSTEM_REQUIREMENTS, title: 'X', id: 'p1',
    })).value;
    assert.strictEqual(outcome.outcome, cli.ROOT_ID_NO_BINDING);
    assert.strictEqual(outcome.reason, cli.BINDING_UNBOUND);
    assert.deepStrictEqual(fs.readdirSync(tmp), [], 'nothing may be created in an unbound project');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('[OQ-4] the write-back refuses a blank title or a blank id rather than recording one', () => {
  withFixtureProject((root) => {
    for (const bad of [{ title: '', id: 'p1' }, { title: 'X', id: '' },
      { title: 'X', id: null }, { title: null, id: 'p1' }]) {
      assert.throws(() => cli.recordLearnedRootPageId(Object.assign(
        { projectRoot: root, storeId: tree.SYSTEM_REQUIREMENTS }, bad)),
      /both the page title and the learned id are required/, JSON.stringify(bad));
    }
  });
});

test('[shape 6] projectLayoutWriteIsBound takes the RESULT OBJECT, not the outcome string', () => {
  // The bug this story found in its own first draft: `recordLearnedRootPageId`
  // passed the outcome STRING, so every successful write reported as failed.
  // Pinned in BOTH directions so the fix cannot silently invert.
  assert.strictEqual(cli.projectLayoutWriteIsBound({ outcome: cli.LAYOUT_WRITE_WROTE }), true);
  assert.strictEqual(cli.projectLayoutWriteIsBound(cli.LAYOUT_WRITE_WROTE), false,
    'the string form must NOT read as bound, or the guard would accept anything truthy');
  assert.strictEqual(cli.projectLayoutWriteIsBound({ outcome: cli.LAYOUT_WRITE_FAILED_WRITE }), false);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8 — THE DIRECTORY RULE, THE GATE, AND THE COMMAND
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 8. The §2 directory rule, the gateway check, and the command ===\n');

test('[31.6 §2] a confluence store reads from the canonical planning folder', () => {
  withFixtureProject((root) => {
    const store = cli.resolveProjectTopology(root).topology.systemRequirementsStore;
    assert.strictEqual(cli.storeArtifactsDirectory(store, root),
      path.join(root, '_bmad-output', 'planning-artifacts'),
      'a confluence store records no path (NFR82), so it takes the `.` branch of the ONE rule');
  });
});

test('[31.6 §2] a store whose path is NOT "." reads from there instead', () => {
  withFixtureProject((root) => {
    const moved = { backend: 'file-system', mode: 'external', path: path.join(root, 'elsewhere') };
    assert.strictEqual(cli.storeArtifactsDirectory(moved, root), path.join(root, 'elsewhere'));
    assert.strictEqual(cli.storeArtifactsDirectory({ path: '.' }, root),
      path.join(root, '_bmad-output', 'planning-artifacts'));
  });
});

test('[AC4] the enumerator reads .md only, skips hidden paths, and creates nothing', () => {
  withFixtureProject((root) => {
    const dir = path.join(root, '_bmad-output', 'planning-artifacts');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    fs.mkdirSync(path.join(dir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.hidden', 'secret.md'), 'x');
    fs.writeFileSync(path.join(dir, '.memlog.md'), 'x');
    const before = snapshotTree(root);
    const found = cli.collectStoreArtifactCandidates(dir).map((c) => c.path);
    assert.ok(!found.includes('notes.txt'));
    assert.ok(!found.some((p) => p.startsWith('.hidden')));
    assert.ok(!found.includes('.memlog.md'));
    assert.ok(found.includes('prd.md'));
    assert.deepStrictEqual(snapshotTree(root), before, 'enumerating must not write');
  });
});

test('[AC4] a missing artifacts directory yields nothing and is NOT created', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-nodir-')));
  try {
    const dir = path.join(tmp, 'does', 'not', 'exist');
    assert.deepStrictEqual(cli.collectStoreArtifactCandidates(dir), []);
    assert.strictEqual(fs.existsSync(path.join(tmp, 'does')), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('[AC4][gate] `confluence-plan` says nothing at all for an all-file-system project', () => {
  withFixtureProject(() => {
    quiet(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    }));
    const out = runConfluencePlan([]);
    assert.ok(/No knowledge store in this project is Confluence-backed/.test(out), out);
    assert.ok(!/Confluence page tree —/.test(out), 'no tree may be printed for a file-system store');
  });
});

test('[gate] `confluence-plan` prints the enumerated operation set with the tree', () => {
  withFixtureProject(() => {
    const out = runConfluencePlan([]);
    for (const op of tree.CONFLUENCE_PAGE_OPERATIONS) {
      assert.ok(out.includes(op), `${op} is missing from the printed catalogue`);
    }
    assert.ok(/resolve_page FIRST/.test(out), 'the update-not-duplicate protocol must be stated');
    assert.ok(/do not report a publish/.test(out),
      'the agent must be told not to report success over a failed write');
  });
});

test('[gate] `confluence-plan` names both the published and the not-published artifacts', () => {
  withFixtureProject(() => {
    const out = runConfluencePlan([]);
    assert.ok(/prd\.md/.test(out));
    assert.ok(/Not published by this store/.test(out));
    assert.ok(/architecture\.md/.test(out) && /software requirements store/.test(out),
      'an excluded artifact must be named together with where it DOES belong');
  });
});

test('[AC7] CONFLUENCE_STORE_RECORDS names exactly the two publishing stores', () => {
  assert.deepStrictEqual(Object.keys(cli.CONFLUENCE_STORE_RECORDS).sort(),
    [...tree.PUBLISHING_STORES].sort(),
    'a third store here would be a store the page tree has no binding record for');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9 — THE INVARIANTS THIS STORY MUST NOT HAVE MOVED
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 9. Invariants this story must not have moved ===\n');

const GATE_HEADING = '## Knowledge Store Backend Routing';
const GATE_COPIES = Object.freeze([
  'skills/bmad-sprint-planning/SKILL.md',
  'skills/generate-backlog/SKILL.md',
  'skills/prioritize-backlog/SKILL.md',
  'lib/bmad-extension/skills/bmad-sprint-planning/workflow.md',
  'lib/bmad-extension/skills/generate-backlog/SKILL.md',
  'lib/bmad-extension/skills/prioritize-backlog/SKILL.md',
  'lib/bmad-extension-plugin/skills/bmad-sprint-planning/workflow.md',
  'lib/bmad-extension-plugin/skills/generate-backlog/SKILL.md',
  'lib/bmad-extension-plugin/skills/prioritize-backlog/SKILL.md',
]);

function gateBlockOf(rel) {
  const body = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');
  const start = body.indexOf(GATE_HEADING);
  assert.ok(start !== -1, `${rel} has lost the Story 31.9 gate heading`);
  const rest = body.slice(start + GATE_HEADING.length);
  const end = rest.search(/\n## /);
  return (GATE_HEADING + (end === -1 ? rest : rest.slice(0, end))).trimEnd();
}

test('[invariant] Story 31.9\'s gate is still NINE copies under ONE sha256', () => {
  const digests = new Set(GATE_COPIES.map((rel) =>
    crypto.createHash('sha256').update(gateBlockOf(rel)).digest('hex')));
  assert.strictEqual(digests.size, 1,
    `the nine shipped copies of the Story 31.9 gate have diverged (${digests.size} digests). ` +
    `Story 31.10 must not touch that block: its Step B2 message region is a closed set and ` +
    `adding a line to it fails a test, by design.`);
  assert.strictEqual(GATE_COPIES.length, 9);
});

test('[invariant] Story 31.10 added NOTHING to the Story 31.9 gate block', () => {
  // The FR262 message this story's library carries is a SEPARATE surface (a JS
  // error), so the shipped instruction text must be untouched by it. Asserted as
  // an absence of this story's own vocabulary inside the sealed block.
  const block = gateBlockOf(GATE_COPIES[0]);
  for (const word of ['page tree', 'resolve_page', 'create_page', 'update_page',
    'confluence-plan', 'root page']) {
    assert.ok(!block.toLowerCase().includes(word.toLowerCase()),
      `Story 31.10 vocabulary (${word}) has been added to Story 31.9's sealed gate block`);
  }
});

test('[invariant] Story 31.4\'s preflight is still 41 copies under ONE sha256', () => {
  const heading = '## Knowledge Store Binding Preflight';
  const roots = ['skills', path.join('lib', 'bmad-extension', 'skills'),
    path.join('lib', 'bmad-extension-plugin', 'skills')];
  const digests = new Map();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.md$/.test(e.name)) continue;
      const body = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
      const start = body.indexOf(heading);
      if (start === -1) continue;
      const rest = body.slice(start + heading.length);
      const end = rest.search(/\n## /);
      const block = (heading + (end === -1 ? rest : rest.slice(0, end))).trimEnd();
      const d = crypto.createHash('sha256').update(block).digest('hex');
      if (!digests.has(d)) digests.set(d, []);
      digests.get(d).push(path.relative(PROJECT_ROOT, p));
    }
  };
  for (const r of roots) walk(path.join(PROJECT_ROOT, r));
  const total = [...digests.values()].reduce((n, v) => n + v.length, 0);
  assert.strictEqual(digests.size, 1,
    `the preflight has diverged into ${digests.size} variants: ` +
    JSON.stringify([...digests.values()].map((v) => v.length)));
  assert.strictEqual(total, 41, `${total} copies carry the preflight, not 41`);
});

test('[invariant] Story 31.10 shipped no change to any skill document', () => {
  // This story is library + CLI only. Stated as a measurement so a later edit to
  // a skill document under this story's name is caught here, where the 41-copy
  // and 9-copy invariants are, rather than in a suite nobody thought to run.
  const marker = /confluence-plan|resolve_page|page tree/i;
  const offenders = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.md$/.test(e.name)) continue;
      if (marker.test(fs.readFileSync(p, 'utf-8'))) offenders.push(path.relative(PROJECT_ROOT, p));
    }
  };
  for (const r of ['skills', path.join('lib', 'bmad-extension', 'skills'),
    path.join('lib', 'bmad-extension-plugin', 'skills')]) walk(path.join(PROJECT_ROOT, r));
  assert.deepStrictEqual(offenders, [],
    'a skill document now carries Story 31.10 vocabulary; if that is intended, the plugin ' +
    'bundle must be rebuilt and the skill-conversion suites re-run');
});

test('[invariant] the page-tree module cites no unshipped _bmad-output/ path', () => {
  // Story 31.6's guard rule, applied to this story's own new source.
  for (const rel of ['lib/confluence-page-tree.js']) {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
    for (const m of src.match(/_bmad-output\/[A-Za-z0-9._/{}-]*/g) || []) {
      // `_bmad-output/project-layout.yaml` is a path the product WRITES, not a
      // document it ships; it is named in shipped source today (bin/cli.js) for
      // the same reason.
      assert.ok(/project-layout\.yaml/.test(m),
        `${rel} cites ${m}; package.json does not ship _bmad-output/`);
    }
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}

const total = passed + failed;
summaryPrinted = true;
if (total !== EXPECTED_TEST_COUNT) {
  console.error(
    `\n  FATAL: ${total} tests ran, but this file defines ${EXPECTED_TEST_COUNT}. Tests that ` +
    `silently stop running must FAIL, not pass — and a surplus is just as wrong as a ` +
    `shortfall. If you added or removed a test, update EXPECTED_TEST_COUNT deliberately.`
  );
  process.exit(1);
}
if (failed > 0) process.exit(1);
