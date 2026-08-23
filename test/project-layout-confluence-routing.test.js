#!/usr/bin/env node
/**
 * Story 31.9 (FR261, FR262; NFR80, P5-9.6) — MCP-CONDITIONAL CONFLUENCE ROUTING:
 * FAIL LOUD, NO FALLBACK.
 *
 * WHAT IS BEING TESTED, AND WHAT THAT CAN AND CANNOT ESTABLISH
 * ────────────────────────────────────────────────────────────
 * The deliverable is in two halves and this suite keeps them apart on purpose,
 * using the `[behaviour]` / `[text]` prefixes Story 31.4's suite established:
 *
 *   [behaviour] — measured against code that RUNS. Two things run here: the real
 *                 `generateBmmConfig`, which is what puts the backend into the
 *                 resolved configuration at all; and `runBackendGate` below,
 *                 which is this suite's EXECUTABLE ORACLE for the decision
 *                 procedure the shipped block describes.
 *
 *   [text]      — measured against the shipped markdown. A skill is an
 *                 instruction document; the gate is a paragraph an agent is asked
 *                 to obey. These tests prove the text says every branch, in every
 *                 shipped copy, in the gateway position.
 *
 * BE PRECISE ABOUT THE LIMIT. The oracle proves the decision procedure is
 * well-formed, total, and fail-loud; the correspondence tests prove the shipped
 * text names every branch the oracle can take, in both directions, so neither
 * half can grow a branch the other lacks. What NOTHING here proves is that a
 * language model actually obeys the paragraph at runtime. That is the honest
 * boundary of a markdown-embedded pattern, and it is the same boundary Story
 * 17.22's routing block and Story 31.4's preflight have. It is stated here rather
 * than left for a reviewer to discover.
 *
 * THE MCP-PRESENT BRANCH IS MOCK-VERIFIED, NOT LIVE. No Confluence MCP server is
 * reachable from this test environment (the `claude.ai Atlassian Rovo` connector
 * is unauthorised in the session this was written in, and a unit test must not
 * depend on a live host regardless). `mockConfluence()` below is a recording
 * stub. Every claim about the MCP-present path is a claim about that stub.
 *
 * NOT TAUTOLOGICAL. Every asserted message fact is a LITERAL written in this
 * file. Nothing here imports a message constant from the code that prints it, and
 * the shipped block's own wording is never used to derive an expectation — the
 * expectations are written out, and the shipped text is searched for them.
 *
 * THE TEST COUNT IS PINNED IN BOTH DIRECTIONS. A suite that silently stops
 * running tests must fail, not pass.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const cli = require(path.join(PROJECT_ROOT, 'bin', 'cli.js'));

const EXPECTED_TEST_COUNT = 93;

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
// THE SHIPPED SURFACE
// ═════════════════════════════════════════════════════════════════════════════

const GATE_HEADING = '## Knowledge Store Backend Routing';
const GUARD_HEADING = '## Knowledge Store Binding Preflight';

/**
 * The six documents that carry the gate: every ma-agents-owned skill entry
 * document that resolves an artifact belonging to a knowledge store. Story 31.6
 * Section 5.2 establishes that this set is exactly the epics consumers — epics
 * are the ONLY knowledge-store artifact any ma-agents skill resolves; everything
 * else in `skills/` resolves sprint execution state, which FR267 puts in neither
 * store. Written out as a LITERAL rather than derived, so a document silently
 * losing the gate is a failure rather than a smaller derived set.
 */
const GATED = Object.freeze([
  'skills/bmad-sprint-planning/SKILL.md',
  'skills/generate-backlog/SKILL.md',
  'skills/prioritize-backlog/SKILL.md',
  'lib/bmad-extension/skills/bmad-sprint-planning/workflow.md',
  'lib/bmad-extension/skills/generate-backlog/SKILL.md',
  'lib/bmad-extension/skills/prioritize-backlog/SKILL.md',
]);

function readDoc(rel) {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');
}

/** The gate block: its heading through the next `## ` heading, exclusive. */
function extractGate(body) {
  const i = body.indexOf(GATE_HEADING);
  if (i === -1) return null;
  const rest = body.slice(i);
  const j = rest.indexOf('\n## ', 1);
  return (j === -1 ? rest : rest.slice(0, j)).trimEnd();
}

/** A document with the gate block removed — used for the AC5 "unchanged" checks. */
function withoutGate(rel) {
  const body = readDoc(rel);
  const gate = extractGate(body);
  if (gate === null) return body;
  return body.replace(gate, '');
}

/**
 * A document with BOTH Story 31.4's read-only preflight and this story's gate
 * removed — i.e. the skill's own instructions, and nothing else.
 *
 * The preflight is excluded for the same reason Story 31.6's guard excludes it:
 * it is a read-only staleness check that resolves nothing, and it legitimately
 * names `planning_artifacts` and a store's `backend:` inside its comparison
 * table. Removing it PRECISELY — by extracting the block, not by allowing those
 * words anywhere — is what keeps the AC5 checks below honest.
 */
function skillBodyOnly(rel) {
  const body = withoutGate(rel);
  const i = body.indexOf(GUARD_HEADING);
  if (i === -1) return body;
  const rest = body.slice(i);
  const j = rest.indexOf('\n## ', 1);
  return body.slice(0, i) + (j === -1 ? '' : rest.slice(j));
}

const SHIPPED_GATE = (() => {
  const g = extractGate(readDoc(GATED[0]));
  if (!g) throw new Error(`${GATED[0]} carries no ${GATE_HEADING} block — nothing to test`);
  return g;
})();

// ═════════════════════════════════════════════════════════════════════════════
// WHICH STORE THIS GATE IS ABOUT — resolved from authorities OUTSIDE the gate
// ═════════════════════════════════════════════════════════════════════════════
/**
 * FIX-ROUND, BLOCKING-2. Nothing bound the gate to the store it must gate.
 * Rewriting the two field bullets from `software_requirements_*` to
 * `system_requirements_*` across all nine shipped copies left this suite green
 * AND left `project-layout-artifact-routing.test.js` — which owns FR256 routing
 * — green, because the oracle below silently defaults to `software_requirements`
 * and nothing cross-checked that default against the shipped text.
 *
 * The field consequence is not cosmetic. A project with the SOFTWARE store on
 * Confluence and the SYSTEM store on the file system — FR257's independence
 * case, and this suite's own `SOFTWARE_CONFLUENCE` fixture — would read
 * `file-system`, take Step B1, and resolve its epics from local files in
 * silence. That is FR262's exact failure with the gate fully "present".
 *
 * So the store is RESOLVED, never transcribed, through two documents neither of
 * which is the gate and neither of which this story wrote:
 *
 *   1. Story 31.6's routing table, §5.2 — WHICH ARTIFACT an ma-agents-owned
 *      skill resolves, and the exact set of entry documents that resolve it.
 *   2. The PRD capability document — WHICH STORE owns that artifact, read out
 *      of the requirement lines' own bold words, by the same rule
 *      `project-layout-artifact-routing.test.js`'s `destinationOf` uses.
 *
 * The `config.yaml` field prefix is then derived from the store's name. Every
 * store name and field name this file asserts against the shipped block comes
 * from here, so a shipped block that names the other store fails even though
 * nothing in this file ever spells that store out.
 */
const ROUTING_TABLE_REL =
  '_bmad-output/implementation-artifacts/31-6-artifact-to-store-routing.md';
const PRD_REL = '_bmad-output/planning-artifacts/prd/capabilities/' +
  'project-knowledge-and-repository-layout.md';

function readAuthority(rel) {
  const abs = path.join(PROJECT_ROOT, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`${rel} is missing — this suite's store oracle is an OUTSIDE authority, ` +
      `and without it the only thing left to check the gate against is the gate`);
  }
  return fs.readFileSync(abs, 'utf-8').replace(/\r\n/g, '\n');
}

const AUTHORITY = (() => {
  // ── 1. The artifact, and the documents that resolve it (Story 31.6 §5.2).
  const table = readAuthority(ROUTING_TABLE_REL);
  const flat = table.replace(/\s+/g, ' ');
  const m = flat.match(
    /Only \*\*([A-Za-z][A-Za-z ]*?)\*\* \(row (\d+)\) is resolved by an ma-agents-owned skill/);
  if (!m) {
    throw new Error(`${ROUTING_TABLE_REL} §5.2 no longer states which artifact an ` +
      `ma-agents-owned skill resolves, in the form "Only **<artifact>** (row <n>) is resolved ` +
      `by an ma-agents-owned skill". That sentence is this suite's only non-circular source ` +
      `for what the gate is gating.`);
  }
  const artifact = m[1].trim();
  const row = m[2];

  const at = table.indexOf('### 5.2');
  const section = table.slice(at, (() => {
    const j = table.indexOf('\n## ', at);
    return j === -1 ? table.length : j;
  })());
  const docs = [...section.matchAll(/^\| `([^`]+)` \| (\d+) \|/gm)]
    .filter((r) => r[2] === row).map((r) => r[1]).sort();

  // ── 2. The store that owns it (the PRD's own words).
  const prd = readAuthority(PRD_REL);
  const reqLines = prd.split('\n').filter((l) => /^- N?FR\d+:/.test(l.trim()));
  const storesIn = (line) => [...new Set(
    (line.match(/\*\*(?:system|software) requirements store\*\*/gi) || [])
      .map((s) => s.replace(/\*/g, '').toLowerCase()))];
  const artifactRe = new RegExp(`\\b${artifact}\\b`, 'i');

  const assigning = [];
  for (const line of reqLines) {
    if (!artifactRe.test(line)) continue;
    const stores = storesIn(line);
    if (stores.length !== 1) continue;
    assigning.push({ id: line.trim().match(/^- (N?FR\d+):/)[1], store: stores[0], line });
  }
  if (assigning.length === 0) {
    throw new Error(`${PRD_REL} states no requirement that both names ` +
      `${JSON.stringify(artifact)} and assigns exactly one knowledge store — the store ` +
      `oracle has no source`);
  }
  const distinct = [...new Set(assigning.map((a) => a.store))];
  if (distinct.length !== 1) {
    throw new Error(`the PRD assigns ${JSON.stringify(artifact)} to more than one store ` +
      `(${JSON.stringify(distinct)}); the gate cannot be bound to an ambiguous authority`);
  }
  const store = distinct[0];

  // The PRIMARY assigning requirement: the one whose line's subject IS the store
  // ("- FRnnn: The **<store>** holds …"). Picked by that rule rather than by id,
  // so the id the shipped block cites is checked against the PRD and not against
  // a number written here.
  const primary = assigning.filter((a) =>
    new RegExp(`^- ${a.id}: The \\*\\*${a.store}\\*\\* holds`, 'i').test(a.line.trim()));
  if (primary.length !== 1) {
    throw new Error(`exactly one PRD requirement must define ${JSON.stringify(store)} by ` +
      `holding its artifacts; found ${JSON.stringify(primary.map((p) => p.id))}`);
  }

  // The complement, so "the OTHER store" is derived too rather than spelled out.
  const bothStores = [...new Set(
    (prd.match(/\*\*(?:system|software) requirements store\*\*/gi) || [])
      .map((s) => s.replace(/\*/g, '').toLowerCase()))].sort();
  if (bothStores.length !== 2) {
    throw new Error(`the PRD names ${bothStores.length} knowledge stores; F26 has two`);
  }
  const otherStore = bothStores.find((s) => s !== store);

  const nounOf = (s) => s.replace(/ store$/, '');
  const prefixOf = (s) => nounOf(s).replace(/ /g, '_');

  return Object.freeze({
    artifact,                       // e.g. "epics"
    row,
    docs,                           // the entry documents §5.2 says resolve it
    requirement: primary[0].id,     // e.g. "FR256"
    store,                          // e.g. "software requirements store"
    noun: nounOf(store),            // e.g. "software requirements"
    prefix: prefixOf(store),        // e.g. "software_requirements"
    otherStore,
    otherNoun: nounOf(otherStore),
    otherPrefix: prefixOf(otherStore),
  });
})();

/** The closed backend enum, single-sourced — the gate may name these and no others. */
const { STORE_BACKEND_LIST, DEFAULT_STORE_BACKEND } =
  require(path.join(PROJECT_ROOT, 'lib', 'store-backends.js'));
const NON_DEFAULT_BACKEND = STORE_BACKEND_LIST.find((b) => b !== DEFAULT_STORE_BACKEND);

// ═════════════════════════════════════════════════════════════════════════════
// THE EXECUTABLE ORACLE — the decision procedure the shipped block describes
// ═════════════════════════════════════════════════════════════════════════════

/** Every verdict the gate can reach. Default-deny: unknown input HALTs. */
const V = Object.freeze({
  PROCEED_FILE_SYSTEM: 'proceed:file-system',
  ROUTE_MCP: 'route:confluence-mcp',
  HALT_NO_MCP: 'halt:no-confluence-mcp',
  HALT_UNKNOWN_BACKEND: 'halt:unknown-backend',
});

/** Read one column-0 scalar out of a generated config.yaml, quotes stripped. */
function configField(content, field) {
  const m = content.match(new RegExp(`^${field}:[ \\t]*(.*)$`, 'm'));
  if (!m) return { present: false, value: null };
  let v = m[1].trim();
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
  return { present: true, value: v };
}

/**
 * The gate, executed. Deliberately shaped as the shipped block's three steps so
 * the correspondence tests below can bind step-for-step.
 *
 * ITS DEFAULT STORE IS A LITERAL ON PURPOSE. `software_requirements` is written
 * here rather than derived from `AUTHORITY`, so that the two are independent
 * statements: the test
 * "[behaviour] BLOCKING-2 the oracle's default store is the store the PRD
 * assigns the gated artifact to" measures them against each other. Deriving it
 * would make that check tautological, which is exactly how the shipped block
 * came to be able to name the wrong store with this suite green.
 *
 * @param {string} configContent  a REAL generated `_bmad/bmm/config.yaml`
 * @param {object} env
 * @param {object|null} env.confluence  the mock MCP surface, or null when absent
 * @param {string} env.storeField       which store's fields to read
 */
function runBackendGate(configContent, env) {
  const opts = env || {};
  const prefix = opts.storeField || 'software_requirements';
  const label = prefix === 'system_requirements'
    ? 'the system requirements store' : 'the software requirements store';

  const backend = configField(configContent, `${prefix}_backend`);
  const space = configField(configContent, `${prefix}_space_key`);

  // ── Step B1. §2.7 — absent or empty is `file-system`, and nothing else is.
  if (!backend.present || backend.value === '' || backend.value === 'file-system') {
    return { verdict: V.PROCEED_FILE_SYSTEM, silent: true, message: null };
  }

  // ── Step B2. `confluence`.
  if (backend.value === 'confluence') {
    const spaceText = (space.present && space.value !== '') ? space.value : 'not recorded';
    if (!opts.confluence) {
      return {
        verdict: V.HALT_NO_MCP,
        silent: false,
        store: label,
        space: spaceText,
        // AC3's four facts, in the order the shipped block states them. Written
        // out here as a literal; the shipped text is searched for the same facts
        // separately, so neither is derived from the other.
        message:
          `ma-agents — stopping: this knowledge store is Confluence-backed and no ` +
          `Confluence MCP was detected.\n` +
          `Store: ${label}. Space: ${spaceText}.\n` +
          `No Confluence MCP server is available in this agent's tool context, so that ` +
          `store cannot be read or written.\n` +
          `To configure one, add a Confluence-capable MCP server to your agent's MCP ` +
          `configuration, pointed at the Confluence instance that hosts that space, and ` +
          `authorise it; then run this skill again.`,
      };
    }
    const result = opts.confluence.read({ space: spaceText });
    return { verdict: V.ROUTE_MCP, silent: true, space: spaceText, result, message: null };
  }

  // ── Step B3. Default-deny. NOT a fallback to file-system.
  return {
    verdict: V.HALT_UNKNOWN_BACKEND,
    silent: false,
    store: label,
    backend: backend.value,
    message:
      `ma-agents — stopping: unrecognised knowledge-store backend.\n` +
      `Store: ${label}. Backend: ${backend.value}. The backends this build understands ` +
      `are file-system and confluence.`,
  };
}

/** A recording stub for a Confluence MCP surface. Never touches the filesystem. */
function mockConfluence() {
  const calls = [];
  return {
    calls,
    read(args) { calls.push(args); return { pages: ['epics'], source: 'confluence' }; },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FIXTURES — real bindings, real generated configs
// ═════════════════════════════════════════════════════════════════════════════

function withTmpDir(fn) {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-conf-route-')));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    return fn(tmpDir);
  } finally {
    process.chdir(origCwd);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* Windows lock */ }
  }
}

function quiet(fn) {
  const orig = console.log;
  let out = '';
  console.log = (...a) => { out += a.join(' ') + '\n'; };
  try { return { value: fn(), out }; } finally { console.log = orig; }
}

const CONFIG_REL = path.join('_bmad', 'bmm', 'config.yaml');

/** Write a binding and generate the config from it, exactly as an install does. */
function boundConfig(tmpDir, layout) {
  quiet(() => cli.writeProjectLayoutYaml(layout));
  quiet(() => cli.generateBmmConfig({ projectRoot: tmpDir }));
  return fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
}

const ALL_FILE_SYSTEM = Object.freeze({
  systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
  softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
  sprintManagement: { mode: 'same', path: '.' },
});

const SOFTWARE_CONFLUENCE = Object.freeze({
  systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
  softwareRequirementsStore: {
    backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Engineering', id: null },
  },
  sprintManagement: { mode: 'same', path: '.' },
});

const SYSTEM_CONFLUENCE = Object.freeze({
  systemRequirementsStore: {
    backend: 'confluence', spaceKey: 'PRODUCT', rootPage: { title: 'Product', id: null },
  },
  softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
  sprintManagement: { mode: 'same', path: '.' },
});

/** Byte-exact snapshot of every file under a root — the AC4 no-artifact oracle. */
function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(root, p)] = crypto.createHash('sha256')
        .update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — [behaviour] AC2: the backend reaches the RESOLVED configuration
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. [behaviour] AC2 — the backend in the resolved configuration ===\n');

test('[behaviour] AC2 a confluence-bound software store publishes its backend and space', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    assert.strictEqual(configField(cfg, 'software_requirements_backend').value, 'confluence');
    assert.strictEqual(configField(cfg, 'software_requirements_space_key').value, 'ENG');
    // And the OTHER store is untouched by it — FR257's independence, in the
    // generated file rather than only in the binding.
    assert.strictEqual(configField(cfg, 'system_requirements_backend').value, 'file-system');
    assert.strictEqual(configField(cfg, 'system_requirements_space_key').value, '');
  });
});

test('[behaviour] AC2 a confluence-bound SYSTEM store publishes its own, independently', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SYSTEM_CONFLUENCE);
    assert.strictEqual(configField(cfg, 'system_requirements_backend').value, 'confluence');
    assert.strictEqual(configField(cfg, 'system_requirements_space_key').value, 'PRODUCT');
    assert.strictEqual(configField(cfg, 'software_requirements_backend').value, 'file-system');
    assert.strictEqual(configField(cfg, 'software_requirements_space_key').value, '');
  });
});

test('[behaviour] AC2 an all-file-system project publishes file-system and an EMPTY space', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, ALL_FILE_SYSTEM);
    for (const p of ['system_requirements', 'software_requirements']) {
      assert.strictEqual(configField(cfg, `${p}_backend`).value, 'file-system');
      assert.strictEqual(configField(cfg, `${p}_space_key`).present, true,
        `${p}_space_key must be WRITTEN, not omitted — an omitted field would make ` +
        `"absent" mean both "pre-F26" and "file-system"`);
      assert.strictEqual(configField(cfg, `${p}_space_key`).value, '');
    }
  });
});

test('[behaviour] AC2 re-binding AWAY from confluence clears the space key, not just the backend', () => {
  // `writeConfigField` updates-or-appends and never deletes. A space key written
  // once and then only conditionally rewritten would survive the re-bind, and the
  // halt message would name a space that is no longer configured.
  withTmpDir((tmpDir) => {
    const first = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    assert.strictEqual(configField(first, 'software_requirements_space_key').value, 'ENG');
    fs.rmSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), { force: true });
    const second = boundConfig(tmpDir, ALL_FILE_SYSTEM);
    assert.strictEqual(configField(second, 'software_requirements_backend').value, 'file-system');
    assert.strictEqual(configField(second, 'software_requirements_space_key').value, '',
      'the old space key survived a re-bind to file-system');
  });
});

test('[behaviour] AC2 the BACKEND decides whether a space key is published, not the field\'s presence', () => {
  // Found by this story's own mutation run: `confluenceSpaceKeyOf` could be
  // rewritten to publish `store.spaceKey` unconditionally and every test stayed
  // green, because no reachable binding produces a file-system store carrying a
  // stray `spaceKey`. That is exactly the "no test measured the guard" shape, so
  // the guard is measured here — through the unbound/fallback path, which passes
  // the caller's store objects straight into the generator.
  withTmpDir((tmpDir) => {
    quiet(() => cli.generateBmmConfig({
      projectRoot: tmpDir,
      fallbackLayout: {
        systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
        softwareRequirementsStore: {
          backend: 'file-system', mode: 'same', path: '.', spaceKey: 'LEAKED',
        },
        sprintManagement: { mode: 'same', path: '.' },
      },
    }));
    const cfg = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    assert.strictEqual(configField(cfg, 'software_requirements_backend').value, 'file-system');
    assert.strictEqual(configField(cfg, 'software_requirements_space_key').value, '',
      `a file-system store published a space key:\n${cfg}`);
    assert.ok(!cfg.includes('LEAKED'), `the stray space key reached config.yaml:\n${cfg}`);
  });
});

test('[behaviour] NFR79 nothing but the space key crosses into the generated config', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    // The binding records `{backend, space_key, root_page:{title,id}}` and nothing
    // else (Story 31.8). The generated config must carry LESS than that, not more.
    for (const forbidden of ['token', 'password', 'username', 'api_key', 'root_page',
      'confluence_url', 'Engineering']) {
      assert.ok(!cfg.includes(forbidden),
        `the generated config leaks ${JSON.stringify(forbidden)}:\n${cfg}`);
    }
    assert.ok(!/https?:\/\//.test(cfg.split('\n').filter((l) => /requirements/.test(l)).join('\n')),
      `no store field may carry a URL:\n${cfg}`);
  });
});

test('[behaviour] AC2 the resolved backend is what the gate reads — end to end, no hand-written config', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const r = runBackendGate(cfg, { confluence: null });
    assert.strictEqual(r.verdict, V.HALT_NO_MCP,
      'the gate must reach its verdict from a REAL generated config, not a fixture string');
    assert.strictEqual(r.space, 'ENG');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — [behaviour] AC3: fail loud, and the four facts
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. [behaviour] AC3 — MCP absent halts, and says four things ===\n');

// AC3's four required facts, as LITERALS. Nothing below reads these out of the
// code or out of the shipped block.
const AC3_FACTS = Object.freeze({
  affectedStore: /the software requirements store/,
  configuredSpace: /Space: ENG\b/,
  noMcpDetected: /no Confluence MCP was detected|No Confluence MCP server is available/,
  howToConfigure: /add a Confluence-capable MCP server to your agent/,
});

test('[behaviour] AC3 confluence + no MCP HALTS — it does not proceed', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const r = runBackendGate(cfg, { confluence: null });
    assert.strictEqual(r.verdict, V.HALT_NO_MCP);
    assert.notStrictEqual(r.verdict, V.PROCEED_FILE_SYSTEM,
      'FR262: it must not degrade to the file system');
    assert.strictEqual(r.silent, false, 'a halt is loud by definition');
  });
});

for (const [fact, needle] of Object.entries(AC3_FACTS)) {
  test(`[behaviour] AC3 the halt message names: ${fact}`, () => {
    withTmpDir((tmpDir) => {
      const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
      const r = runBackendGate(cfg, { confluence: null });
      assert.ok(needle.test(r.message),
        `the halt message is missing ${fact}:\n${r.message}`);
    });
  });
}

test('[behaviour] AC3 the message names the CONFIGURED space, not a guessed one', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SYSTEM_CONFLUENCE);
    const r = runBackendGate(cfg, { confluence: null, storeField: 'system_requirements' });
    assert.ok(/Space: PRODUCT\b/.test(r.message),
      `a different store's space must produce a different message:\n${r.message}`);
    assert.ok(/the system requirements store/.test(r.message),
      `and must name THAT store:\n${r.message}`);
    assert.ok(!/ENG/.test(r.message), `it must not name the other store's space:\n${r.message}`);
  });
});

test('[behaviour] AC3 a confluence store with NO recorded space says so, rather than printing nothing', () => {
  // Reachable by hand-editing the generated config — which is exactly when a
  // message that silently renders an empty space is least useful.
  const cfg = 'software_requirements_backend: "confluence"\nsoftware_requirements_space_key: ""\n';
  const r = runBackendGate(cfg, { confluence: null });
  assert.strictEqual(r.verdict, V.HALT_NO_MCP);
  assert.ok(/Space: not recorded\b/.test(r.message),
    `an unrecorded space must be stated, not elided:\n${r.message}`);
});

test('[behaviour] NFR79 the halt message cannot leak anything beyond the space key', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const r = runBackendGate(cfg, { confluence: null });
    // The binding also carries a root-page title. It must not appear.
    assert.ok(!/Engineering/.test(r.message),
      `the root-page title leaked into the error message:\n${r.message}`);
    for (const forbidden of ['token', 'password', 'username', 'http://', 'https://']) {
      assert.ok(!r.message.includes(forbidden),
        `the message leaks ${JSON.stringify(forbidden)}:\n${r.message}`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — [behaviour] the permissive-default hole is closed
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. [behaviour] AC2/§2.7 — the default cannot swallow a malformed value ===\n');

test('[behaviour] §2.7 an ABSENT backend field proceeds as file-system, silently', () => {
  const r = runBackendGate('knowledgebase_path: "."\n', {});
  assert.strictEqual(r.verdict, V.PROCEED_FILE_SYSTEM);
  assert.strictEqual(r.silent, true, 'a default project must get no message at all');
});

test('[behaviour] §2.7 an EMPTY backend field proceeds as file-system, silently', () => {
  const r = runBackendGate('software_requirements_backend: ""\n', {});
  assert.strictEqual(r.verdict, V.PROCEED_FILE_SYSTEM);
  assert.strictEqual(r.silent, true);
});

// The defect shape this epic keeps producing: a permissive default absorbing a
// value that IS stated and is NOT understood. Every one of these must HALT.
//
// THESE RUN AGAINST THE ORACLE, so they are only about the SHIPPED text for as
// long as the shipped Step B1 states the same condition the oracle's B1
// implements. That link is what
// "[text] BLOCKING-1 the gate declares EXACTLY three steps, matched whole-line"
// holds: before the fix round, the B1 heading was matched with `includes()`, so
// widening it to "…or any value not listed below" made Step B3 dead code and
// silently degraded all eighteen of these values while every case below stayed
// green. If that heading test is ever loosened, this table stops meaning
// anything about the shipped block.
const MALFORMED_BACKENDS = Object.freeze([
  'Confluence',      // right word, wrong case — the enum is case-sensitive
  'CONFLUENCE',
  'confluence ',     // trailing space survives an unquoted hand edit
  ' confluence',
  'conflunce',       // typo
  'file_system',     // underscore instead of hyphen
  'filesystem',
  'File-System',
  'jira',            // a real backend — of a DIFFERENT enum (sprint tracking)
  'linear',          // spec 8.1's example future backend, not implemented here
  'confluence-cloud',
  'null',
  'undefined',
  '[object Object]', // the exact shape a previous coercion defect in this epic emitted
  'true',
  '.',
  '../../etc/passwd',
  'file-system,confluence',
]);

for (const bad of MALFORMED_BACKENDS) {
  test(`[behaviour] AC2 a malformed backend HALTS, never defaults: ${JSON.stringify(bad)}`, () => {
    const cfg = `software_requirements_backend: ${JSON.stringify(bad)}\n`;
    const r = runBackendGate(cfg, {});
    assert.strictEqual(r.verdict, V.HALT_UNKNOWN_BACKEND,
      `${JSON.stringify(bad)} was absorbed by a branch instead of halting`);
    assert.notStrictEqual(r.verdict, V.PROCEED_FILE_SYSTEM,
      `${JSON.stringify(bad)} degraded to the file system — the exact FR262 defect`);
    assert.notStrictEqual(r.verdict, V.ROUTE_MCP,
      `${JSON.stringify(bad)} was treated as confluence`);
    assert.ok(r.message.includes(bad), `the halt must NAME the value it rejected:\n${r.message}`);
  });
}

test('[behaviour] AC2 a malformed backend halts even when a Confluence MCP IS available', () => {
  // Availability must not rescue an unreadable configuration: the build still
  // does not know which store this is.
  const cfg = 'software_requirements_backend: "Confluence"\n';
  const r = runBackendGate(cfg, { confluence: mockConfluence() });
  assert.strictEqual(r.verdict, V.HALT_UNKNOWN_BACKEND);
});

test('[behaviour] the gate is TOTAL — every input reaches a named verdict', () => {
  const named = new Set(Object.values(V));
  const inputs = ['', 'software_requirements_backend: "file-system"\n',
    'software_requirements_backend: "confluence"\n', 'software_requirements_backend:\n']
    .concat(MALFORMED_BACKENDS.map((b) => `software_requirements_backend: ${JSON.stringify(b)}\n`));
  for (const cfg of inputs) {
    const r = runBackendGate(cfg, {});
    assert.ok(named.has(r.verdict), `${JSON.stringify(cfg)} produced ${r.verdict}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — [behaviour] AC5/AC4: the MCP-present branch, MOCKED
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. [behaviour] AC5/AC4 — MCP present (MOCK, not a live server) ===\n');

test('[behaviour] AC5 MCP present routes to the MCP, in the configured space', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const mcp = mockConfluence();
    const r = runBackendGate(cfg, { confluence: mcp });
    assert.strictEqual(r.verdict, V.ROUTE_MCP);
    assert.strictEqual(mcp.calls.length, 1, 'the MCP must actually be called');
    assert.deepStrictEqual(mcp.calls[0], { space: 'ENG' },
      'the call must carry the CONFIGURED space, not a default');
    assert.strictEqual(r.result.source, 'confluence',
      'AC5: Confluence is the source of truth for that store');
  });
});

// FIX-ROUND, NB-5. The two snapshot proofs below were near-vacuous as written:
// they snapshot a tree, call a test-local function that provably performs no
// I/O, and snapshot again. What actually carried the claim was the reviewer's
// manual observation that `runBackendGate` contains no write. That observation
// is now a machine check, so the snapshots are corroboration of a pinned fact
// rather than the whole of it — and the snapshots' own messages below now state
// what they do and do not establish.
test('[behaviour] AC4 the oracle is a PURE decision function — pinned, not observed', () => {
  const src = fs.readFileSync(__filename, 'utf-8');
  const start = src.indexOf('function runBackendGate(');
  assert.notStrictEqual(start, -1, 'the oracle is gone — every AC4 claim below rests on it');
  const end = src.indexOf('\n}\n', start);
  assert.notStrictEqual(end, -1, 'could not delimit the oracle body');
  const body = src.slice(start, end);
  assert.ok(body.length > 800,
    `the located oracle body is ${body.length} chars — too short to be the real function, so ` +
    `this test would be checking nothing`);
  for (const primitive of ['fs.', 'require(', 'child_process', 'execFile', 'writeFile',
    'mkdir', 'rmSync', 'process.env', 'process.cwd']) {
    assert.ok(!body.includes(primitive),
      `the oracle reaches ${JSON.stringify(primitive)}. It is the decision procedure ONLY: ` +
      `the AC4 "no local artifact" proofs are snapshot comparisons around it, and they are ` +
      `only meaningful while it cannot touch the filesystem in the first place.`);
  }
});

test('[behaviour] AC4 the MCP-present path writes NO local artifact — byte-exact tree comparison', () => {
  withTmpDir((tmpDir) => {
    boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const cfg = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    const before = snapshot(tmpDir);
    const mcp = mockConfluence();
    const r = runBackendGate(cfg, { confluence: mcp });
    assert.strictEqual(r.verdict, V.ROUTE_MCP, 'precondition: the MCP branch was taken');
    const after = snapshot(tmpDir);
    assert.deepStrictEqual(after, before,
      'P5-9.6: routing to Confluence must produce no mirror, no cache and no local copy — ' +
      'the project tree must be byte-identical afterwards. WHAT THIS ESTABLISHES: the ' +
      'decision procedure, plus the real binding writer and config generator that ran before ' +
      'it, left the tree untouched. It does NOT establish that a language model obeying the ' +
      'shipped block writes nothing — no test here can. The absence-of-machinery proof below ' +
      'and the shipped block\'s explicit prohibition are the other two legs.');
  });
});

test('[behaviour] AC4 the HALT path writes NO local artifact either', () => {
  withTmpDir((tmpDir) => {
    boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const cfg = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    const before = snapshot(tmpDir);
    const r = runBackendGate(cfg, { confluence: null });
    assert.strictEqual(r.verdict, V.HALT_NO_MCP, 'precondition: the halt branch was taken');
    assert.deepStrictEqual(snapshot(tmpDir), before,
      'a halt must not leave a partial file, a stub, or a "local copy for now" behind. Same ' +
      'limit as the test above: this is the oracle and the real generator, not an agent.');
  });
});

test('[behaviour] AC4 the confluence-bound install itself creates NO artifacts directory', () => {
  // The negative stated as an absence rather than as "none was requested": after
  // binding a store to Confluence and generating the config, the ONLY files that
  // exist are the binding and the generated config. Nothing has been mirrored.
  withTmpDir((tmpDir) => {
    boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    const files = Object.keys(snapshot(tmpDir)).map((f) => f.split(path.sep).join('/')).sort();
    assert.deepStrictEqual(files,
      ['_bmad-output/project-layout.yaml', '_bmad/bmm/config.yaml'],
      `binding a store to Confluence produced files beyond the binding and the generated ` +
      `config: ${JSON.stringify(files)}`);
  });
});

test('[behaviour] AC4/P5-9.6 no mirror, cache or sync machinery exists in the shipped code', () => {
  // The absence half, over the source rather than over one run: if a later story
  // adds a Confluence cache this fails, which is the point. Scoped to the files
  // this epic owns.
  const suspects = ['lib/confluence-mirror.js', 'lib/confluence-cache.js',
    'lib/confluence-sync.js', 'lib/knowledge-mirror.js', 'lib/store-sync.js'];
  for (const s of suspects) {
    assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, s)),
      `${s} exists — P5-9.6 says there is no mirror, no cache and therefore no sync`);
  }
  const cliSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'bin', 'cli.js'), 'utf-8');
  for (const bad of ['confluenceCache', 'confluenceMirror', 'syncConfluence', 'mirrorStore']) {
    assert.ok(!cliSrc.includes(bad), `bin/cli.js grew ${bad}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — [behaviour] AC5: the file-system branch is untouched
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. [behaviour] AC5 — the file-system branch is completely unchanged ===\n');

test('[behaviour] AC5 a file-system store proceeds, silently, and touches nothing', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, ALL_FILE_SYSTEM);
    const before = snapshot(tmpDir);
    const r = runBackendGate(cfg, { confluence: null });
    assert.strictEqual(r.verdict, V.PROCEED_FILE_SYSTEM);
    assert.strictEqual(r.silent, true, 'a file-system project must get no message');
    assert.strictEqual(r.message, null);
    assert.deepStrictEqual(snapshot(tmpDir), before, 'the gate itself must write nothing');
  });
});

test('[behaviour] AC5 an available Confluence MCP does NOT divert a file-system store', () => {
  withTmpDir((tmpDir) => {
    const cfg = boundConfig(tmpDir, ALL_FILE_SYSTEM);
    const mcp = mockConfluence();
    const r = runBackendGate(cfg, { confluence: mcp });
    assert.strictEqual(r.verdict, V.PROCEED_FILE_SYSTEM,
      'the BACKEND decides, not the availability of a tool');
    assert.strictEqual(mcp.calls.length, 0, 'the MCP must not be consulted at all');
  });
});

test('[behaviour] NFR82 the resolved artifact paths are identical with and without the gate', () => {
  // The gate is additive: binding one store to Confluence must not move the
  // OTHER store's resolved artifacts, nor the sprint artifacts (FR267).
  withTmpDir((tmpDir) => {
    const fsCfg = boundConfig(tmpDir, ALL_FILE_SYSTEM);
    fs.rmSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), { force: true });
    const confCfg = boundConfig(tmpDir, SOFTWARE_CONFLUENCE);
    for (const f of ['system_requirements_path', 'planning_artifacts', 'implementation_artifacts',
      'sprint_management_path', 'sprint_backend']) {
      assert.strictEqual(configField(confCfg, f).value, configField(fsCfg, f).value,
        `${f} moved when a store was bound to Confluence`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — [behaviour] AC6: air gap, proven with egress BLOCKED
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. [behaviour] AC6 — the fully-file-system flow completes with egress blocked ===\n');

// A child process whose networking primitives are poisoned before anything is
// required, so ANY attempt to open a socket, resolve a name or issue a request
// throws. The flow then runs the real binding writer, the real config generator
// and the gate. If any of them reached the network, the child would fail rather
// than quietly succeed against a host that happens to be reachable.
const AIRGAP_SCRIPT = String.raw`
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const PROJECT_ROOT = process.argv[2];

const BLOCKED = [];
function poison(mod, names) {
  const m = require(mod);
  for (const n of names) {
    if (typeof m[n] !== 'function') continue;
    m[n] = function () { BLOCKED.push(mod + '.' + n); throw new Error('EGRESS BLOCKED: ' + mod + '.' + n); };
  }
}
poison('dns', ['lookup', 'resolve', 'resolve4', 'resolve6', 'lookupService']);
poison('dns/promises', ['lookup', 'resolve', 'resolve4', 'resolve6']);
poison('http', ['request', 'get']);
poison('https', ['request', 'get']);
poison('tls', ['connect']);
const net = require('net');
net.connect = net.createConnection = function () {
  BLOCKED.push('net.connect'); throw new Error('EGRESS BLOCKED: net.connect');
};
net.Socket.prototype.connect = function () {
  BLOCKED.push('net.Socket.connect'); throw new Error('EGRESS BLOCKED: net.Socket.connect');
};
if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = function () {
    BLOCKED.push('fetch'); throw new Error('EGRESS BLOCKED: fetch');
  };
}

// Prove the block is REAL before relying on it: an ordinary outbound call must
// throw. A test that trusts an unproven sandbox proves nothing.
let armed = false;
try { require('https').get('https://example.invalid/'); } catch (e) {
  armed = /EGRESS BLOCKED/.test(e.message);
}
if (!armed) { console.log(JSON.stringify({ ok: false, why: 'egress block did not arm' })); process.exit(0); }

// FIX-ROUND, NB-6. The probe's own entry used to be removed on the PARENT side,
// by filtering 'https.get' out of the recorder — which discarded a genuine
// https.get by the flow along with it, i.e. the exact call the recorder exists to
// catch. The probe's entry is CLEARED here instead, and what it recorded is
// reported separately so the recorder itself is proven to work. After this line
// the list contains only what the FLOW attempted, and the parent filters nothing.
const PROBE = BLOCKED.splice(0, BLOCKED.length);

const cli = require(path.join(PROJECT_ROOT, 'bin', 'cli.js'));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-airgap-')));
const cwd = process.cwd();
process.chdir(tmp);
const orig = console.log; console.log = function () {};
let result;
try {
  cli.writeProjectLayoutYaml({
    systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  });
  cli.generateBmmConfig({ projectRoot: tmp });
  const cfg = fs.readFileSync(path.join(tmp, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
  const backend = (cfg.match(/^software_requirements_backend:[ \t]*(.*)$/m) || [])[1];
  const topo = cli.resolveProjectTopology(tmp);
  result = { ok: true, armed: true, probe: PROBE, blocked: BLOCKED,
    backend: (backend || '').trim(),
    bindingOk: !!topo.ok, hasConfig: fs.existsSync(path.join(tmp, '_bmad', 'bmm', 'config.yaml')) };
} catch (e) {
  result = { ok: false, why: e.message, probe: PROBE, blocked: BLOCKED };
} finally {
  console.log = orig;
  process.chdir(cwd);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log(JSON.stringify(result));
`;

function runAirgapped() {
  const scriptPath = path.join(os.tmpdir(), `ma-airgap-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(scriptPath, AIRGAP_SCRIPT, 'utf-8');
  try {
    const out = execFileSync(process.execPath, [scriptPath, PROJECT_ROOT],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    const line = out.trim().split('\n').filter((l) => l.trim().startsWith('{')).pop();
    return JSON.parse(line);
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (e) { /* best effort */ }
  }
}

const AIRGAP = (() => { try { return runAirgapped(); } catch (e) { return { ok: false, why: e.message }; } })();

test('[behaviour] AC6 the egress block actually arms — the sandbox is proven, not assumed', () => {
  assert.strictEqual(AIRGAP.ok, true, `the air-gapped child failed: ${AIRGAP.why}`);
  assert.strictEqual(AIRGAP.armed, true, 'the network poison did not take effect');
});

test('[behaviour] AC6 the fully-file-system flow COMPLETES with all egress blocked', () => {
  assert.strictEqual(AIRGAP.ok, true, `the air-gapped child failed: ${AIRGAP.why}`);
  assert.strictEqual(AIRGAP.bindingOk, true, 'the binding did not resolve with egress blocked');
  assert.strictEqual(AIRGAP.hasConfig, true, 'config.yaml was not generated with egress blocked');
  assert.strictEqual(AIRGAP.backend, '"file-system"',
    'the generated backend must be file-system with no network involved');
});

test('[behaviour] AC6 and it never even ATTEMPTED egress', () => {
  // Stronger than "it completed": the recorder proves no primitive was reached.
  // FIX-ROUND, NB-6: the arming probe's entry is CLEARED in the child before the
  // flow starts and reported separately, so nothing is filtered here. Filtering
  // 'https.get' — as this test used to — would have discarded a genuine
  // `https.get` by the flow, which is precisely the call being watched for.
  assert.strictEqual(AIRGAP.ok, true, `the air-gapped child failed: ${AIRGAP.why}`);
  assert.deepStrictEqual(AIRGAP.probe, ['https.get'],
    `the recorder must have caught the arming probe, or an empty flow list proves nothing ` +
    `about the recorder: ${JSON.stringify(AIRGAP.probe)}`);
  assert.deepStrictEqual(AIRGAP.blocked, [],
    `the file-system flow reached for the network: ${JSON.stringify(AIRGAP.blocked)}`);
});

test('[text] AC6 the air-gap posture is STATED, and stated correctly, where it is documented', () => {
  // "Preserved and correctly stated" is half an AC about a document. Before this
  // story, docs/architecture.md said only that installs run "fully offline in
  // air-gapped environments" — true, and now incomplete, because a project can
  // bind a store to Confluence. Each of the four facts is checked separately, so
  // dropping one is a failure rather than a shorter paragraph.
  const doc = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'architecture.md'), 'utf-8');
  const at = doc.indexOf('Air-gap posture with a Confluence-backed knowledge store');
  assert.notStrictEqual(at, -1, 'the NFR80 posture section is gone from docs/architecture.md');
  const section = doc.slice(at, doc.indexOf('\n## ', at));
  const REQUIRED = {
    'install and skill loading need no network':
      /Installation and skill loading require no network at all/,
    'every file-system workflow needs no network':
      /Every `file-system`-backed workflow requires no network at all/,
    'a confluence store needs its host reachable, which intra-perimeter satisfies':
      /intra-perimeter Confluence Server or Data Center on an air-gapped network satisfies it/,
    'a no-network-whatsoever project keeps both stores file-system':
      /no network whatsoever keeps both stores `file-system`-backed/,
  };
  for (const [fact, needle] of Object.entries(REQUIRED)) {
    assert.ok(needle.test(section), `the posture no longer states: ${fact}`);
  }
  // And it must not overclaim in the other direction either.
  assert.ok(!/works offline in every configuration|no network is ever required/i.test(section),
    'the posture must not claim a Confluence store needs no host at all');
});

test('[behaviour] AC6 a confluence store is the ONLY thing that needs a reachable host', () => {
  // The correct statement of NFR80, measured: nothing in the gate's file-system
  // branch consults the MCP, and only the confluence branch does.
  const mcp = mockConfluence();
  runBackendGate('software_requirements_backend: "file-system"\n', { confluence: mcp });
  runBackendGate('software_requirements_backend: ""\n', { confluence: mcp });
  runBackendGate('knowledgebase_path: "."\n', { confluence: mcp });
  assert.strictEqual(mcp.calls.length, 0,
    'a file-system-backed project must not consult a Confluence tool even when one exists');
  runBackendGate('software_requirements_backend: "confluence"\n', { confluence: mcp });
  assert.strictEqual(mcp.calls.length, 1, 'and the confluence branch must consult it');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 — [text] the shipped block: presence, position, both pipelines
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 7. [text] AC7 — embedded per skill, deployed unchanged through both pipelines ===\n');

test('[text] AC7 every gated document carries the block, in BOTH pipelines', () => {
  const missing = GATED.filter((rel) => !readDoc(rel).includes(GATE_HEADING));
  assert.deepStrictEqual(missing, [], `these documents are missing the gate: ${missing}`);
  const p1 = GATED.filter((r) => r.startsWith('skills/')).length;
  const p2 = GATED.filter((r) => r.startsWith('lib/bmad-extension/')).length;
  assert.strictEqual(p1, 3, `expected 3 IDE-pipeline copies, got ${p1}`);
  assert.strictEqual(p2, 3, `expected 3 BMAD-extension copies, got ${p2}`);
});

test('[text] AC7 the block is byte-identical in every copy — one text, not six variants', () => {
  const seen = new Map();
  for (const rel of GATED) {
    const h = crypto.createHash('sha256').update(extractGate(readDoc(rel))).digest('hex');
    if (!seen.has(h)) seen.set(h, []);
    seen.get(h).push(rel);
  }
  assert.strictEqual(seen.size, 1,
    `"deployed unchanged" means ONE text: got ${seen.size} variants ` +
    `${JSON.stringify([...seen.values()].map((v) => v[0]))}`);
});

test('[text] AC7 the plugin mirror carries the same block, byte-identical', () => {
  const ext = GATED.filter((r) => r.startsWith('lib/bmad-extension/'));
  for (const rel of ext) {
    const mirrored = rel.replace('lib/bmad-extension/', 'lib/bmad-extension-plugin/');
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, mirrored)),
      `the plugin mirror is missing ${mirrored} — run npm run build:plugin`);
    assert.strictEqual(extractGate(readDoc(mirrored)), SHIPPED_GATE,
      `${mirrored} drifted from its source — run npm run build:plugin and commit the result`);
  }
});

test('[text] AC7 no shared importable module was created — the pattern lives in the text', () => {
  // Spec 7.1: the adapter is not a code artifact. A module would also not survive
  // either deployment pipeline.
  for (const s of ['lib/confluence-routing.js', 'lib/backend-routing.js',
    'lib/knowledge-backend.js', 'lib/mcp-detection.js']) {
    assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, s)),
      `${s} exists — the routing block must be embedded instruction text`);
  }
});

test('[text] AC7 lib/installer.js and lib/bmad.js are untouched by this pattern', () => {
  // Spec 7.2/7.3 and AC7: the pipelines deploy skills verbatim; the pattern is in
  // the content. Asserted as an absence in the two files the AC names.
  for (const f of ['lib/installer.js', 'lib/bmad.js']) {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8');
    assert.ok(!src.includes('Knowledge Store Backend Routing'),
      `${f} knows about the routing block — AC7 forbids a deployment-mechanism change`);
    assert.ok(!/_backend['"`]?\s*[:=]/.test(src.replace(/sprint_backend/g, '')),
      `${f} appears to have grown backend-routing logic`);
  }
});

test('[text] AC2/§2.6 the gate is the SECOND section, after the preflight and before all else', () => {
  for (const rel of GATED) {
    const headings = readDoc(rel).split('\n').filter((l) => /^## /.test(l));
    assert.strictEqual(headings[0], GUARD_HEADING,
      `${rel}: Story 31.4's preflight must remain first`);
    assert.strictEqual(headings[1], GATE_HEADING,
      `${rel}: the backend gate must be the next section — §2.6 says no skill logic runs ` +
      `before the backend is confirmed. Got ${JSON.stringify(headings[1])}`);
  }
});

test('[text] §2.6 the gate precedes the first instruction that resolves an artifact path', () => {
  // Heading order is necessary but not sufficient — a skill can carry an
  // instruction in prose above its next heading. Measured against the actual
  // resolving instruction instead: wherever the SKILL's own text first names
  // `planning_artifacts`, the gate is above it. Both blocks are blanked to their
  // own length first (rather than deleted) so the surviving offsets are still
  // comparable with the gate's position in the real document.
  let exercised = 0;
  for (const rel of GATED) {
    const body = readDoc(rel);
    const gateAt = body.indexOf(GATE_HEADING);
    const blank = (s, block) => {
      const i = s.indexOf(block);
      return i === -1 ? s : s.slice(0, i) + ' '.repeat(block.length) + s.slice(i + block.length);
    };
    const guard = (() => {
      const i = body.indexOf(GUARD_HEADING);
      const rest = body.slice(i);
      const j = rest.indexOf('\n## ', 1);
      return j === -1 ? rest : rest.slice(0, j);
    })();
    const stripped = blank(blank(body, extractGate(body)), guard);
    const at = stripped.indexOf('planning_artifacts');
    assert.notStrictEqual(at, -1, `${rel} no longer resolves planning_artifacts at all`);
    exercised++;
    assert.ok(gateAt < at,
      `${rel}: planning_artifacts is resolved at ${at}, before the gate at ${gateAt}`);
  }
  assert.strictEqual(exercised, GATED.length, 'every gated document must be exercised');
});

// FIX-ROUND, NB-3. AC2's whole §2.6 obligation rode on ONE sentence — "run this
// immediately after the preflight above, and before anything else" — and that
// sentence was pinned zero ways: replacing it with "Optional check — run this at
// whatever point is convenient, including after the skill has resolved and read
// its artifacts" left every suite green. Its wording is now inside the closed
// prose set above; its MEANING is measured here, the way Story 31.4's preflight
// measures its own (`project-layout-staleness-guard.test.js`, ordering against
// ACTION_MARKERS). Position asserted on instructions, not on headings, because a
// skill can carry an instruction in prose above its next heading.
const ACTION_MARKERS = Object.freeze([
  '<action>', '<step', 'Load config', 'Read `', 'Locate `', 'Resolve project root',
  'Load and read', 'Attempt to read',
]);

test('[text] AC2/§2.6/NB-3 the gate precedes the FIRST actionable instruction in each skill', () => {
  let exercised = 0;
  for (const rel of GATED) {
    const body = readDoc(rel);
    const gateAt = body.indexOf(GATE_HEADING);
    // Both blocks are blanked to their own length rather than deleted, so the
    // gate's own "Read these two fields" and the preflight's own "Read
    // `_bmad-output/project-layout.yaml`" are not mistaken for the SKILL's first
    // instruction, and the surviving offsets stay comparable with the real ones.
    const blank = (s, block) => {
      const i = s.indexOf(block);
      return i === -1 ? s : s.slice(0, i) + ' '.repeat(block.length) + s.slice(i + block.length);
    };
    const guard = (() => {
      const i = body.indexOf(GUARD_HEADING);
      const rest = body.slice(i);
      const j = rest.indexOf('\n## ', 1);
      return j === -1 ? rest : rest.slice(0, j);
    })();
    const stripped = blank(blank(body, extractGate(body)), guard);
    for (const m of ACTION_MARKERS) {
      const at = stripped.indexOf(m);
      if (at === -1) continue;
      exercised++;
      assert.ok(gateAt < at,
        `${rel}: ${JSON.stringify(m)} appears at offset ${at}, before the gate at ${gateAt}. ` +
        `§2.6 makes this a gateway check: no step of the skill executes until the backend is ` +
        `confirmed, so an instruction cannot sit above it.`);
    }
  }
  assert.ok(exercised >= GATED.length,
    `this test must actually find instructions to order against; it matched only ` +
    `${exercised} across ${GATED.length} documents, which means the marker list has gone stale`);
});

test('[text] §2.6 the gate precedes Story 17.22\'s sprint Backend Routing block', () => {
  const withSprint = GATED.filter((rel) => readDoc(rel).includes('\n## Backend Routing'));
  assert.ok(withSprint.length >= 3,
    `expected the sprint routing block in most gated documents; found ${withSprint.length}`);
  for (const rel of withSprint) {
    const body = readDoc(rel);
    assert.ok(body.indexOf(GATE_HEADING) < body.indexOf('\n## Backend Routing'),
      `${rel}: the knowledge-store gate must run before the sprint-tracking one`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8 — [text] the block ↔ the oracle: neither may grow a branch alone
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 8. [text] correspondence — every verdict is a named branch of the shipped text ===\n');

// One sentence of the SHIPPED block per verdict the oracle can return. If a
// branch is added to one side and not the other, one of these two tests fails.
const BRANCH_MARKERS = Object.freeze({
  [V.PROCEED_FILE_SYSTEM]: '### Step B1 — `file-system`, or the field is absent, or its value is empty',
  [V.ROUTE_MCP]: 'A Confluence-capable tool IS available',
  [V.HALT_NO_MCP]: 'stopping: this knowledge store is Confluence-backed and no Confluence MCP was detected',
  [V.HALT_UNKNOWN_BACKEND]: 'stopping: unrecognised knowledge-store backend',
});

test('[text] every verdict the oracle can return is a named branch of the shipped block', () => {
  // FIX-ROUND, BLOCKING-1. A heading marker is now matched as a WHOLE LINE.
  // `includes()` tolerated any suffix, so widening Step B1's heading to
  // "…or any value not listed below" — which makes Step B3 dead code and every
  // unrecognised backend degrade silently — left this green, and also detached
  // the 18-case MALFORMED_BACKENDS table from the text it is about.
  const lines = SHIPPED_GATE.split('\n');
  for (const verdict of Object.values(V)) {
    const marker = BRANCH_MARKERS[verdict];
    assert.ok(marker, `verdict ${verdict} has no marker — the map has gone stale`);
    if (marker.startsWith('### ')) {
      assert.ok(lines.includes(marker),
        `the shipped block has no line EXACTLY equal to the ${verdict} heading. A heading ` +
        `matched by substring can be widened without moving this test, which is how a ` +
        `default branch grows a catch-all. Looked for ${JSON.stringify(marker)}`);
    } else {
      assert.ok(SHIPPED_GATE.includes(marker),
        `the shipped block does not state the ${verdict} branch (looked for ` +
        `${JSON.stringify(marker)})`);
    }
  }
});

/** Every `### Step Bn` heading LINE of the shipped gate, in document order. */
function gateStepHeadings() {
  return SHIPPED_GATE.split('\n').filter((l) => /^### Step B\d+ /.test(l));
}

/** The step numbers the shipped gate actually declares. */
function gateStepNumbers() {
  return gateStepHeadings().map((l) => Number(l.match(/^### Step B(\d+) /)[1]));
}

/** One `### Step Bn` of the shipped gate, up to the next `### ` heading. */
function gateStep(n) {
  const start = SHIPPED_GATE.indexOf(`### Step B${n} `);
  assert.notStrictEqual(start, -1, `the shipped block has no Step B${n}`);
  const rest = SHIPPED_GATE.slice(start);
  const end = rest.indexOf('\n### ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The OUTCOMES one shipped step states, at BULLET granularity.
 *
 * FIX-ROUND, BLOCKING-1. Direction 2 used to count `### Step B\d+ ` HEADINGS and
 * assert three. Step B2 branches on BULLETS, not on headings, so the block could
 * gain, lose or invert a Confluence branch without that count moving — and it
 * did: a fourth B2 bullet ("a Confluence tool is available but returns an error
 * → use the local copies and carry on") and an FR266-style "ask the user whether
 * to carry on locally" bullet both survived. A step with no `- **…** →` bullets
 * states exactly one outcome itself (B1 proceeds, B3 halts).
 */
function stepOutcomes(n) {
  const s = gateStep(n);
  const bullets = [...s.matchAll(/^- \*\*(.+?)\*\* → *(.*)$/gm)]
    .map((b) => ({ condition: b[1], rest: b[2] }));
  return bullets.length > 0 ? bullets : [{ condition: null, rest: s }];
}

test('[text] every branch the shipped block states is a verdict the oracle can return', () => {
  // The other direction: a marker in the map that no verdict claims would mean
  // the block describes behaviour nothing exercises.
  const claimed = new Set(Object.keys(BRANCH_MARKERS));
  assert.deepStrictEqual([...claimed].sort(), Object.values(V).sort(),
    'the marker map and the verdict set must be the same set');
  const outcomes = gateStepNumbers().reduce((a, n) => a.concat(stepOutcomes(n)), []);
  assert.strictEqual(outcomes.length, Object.values(V).length,
    `the shipped block states ${outcomes.length} decision outcomes and the oracle implements ` +
    `${Object.values(V).length}. Counted at BULLET granularity, not heading granularity, ` +
    `because Step B2 branches on bullets: ` +
    `${JSON.stringify(outcomes.map((o) => o.condition || '(the step itself)'))}`);
});

test('[text] BLOCKING-1 the gate declares EXACTLY three steps, matched whole-line', () => {
  // A closed set, and its two backend values come from the single-sourced enum
  // rather than from literals here — so widening a heading, renaming a value, or
  // adding a fourth step all fail, and none of them can be absorbed.
  assert.deepStrictEqual(gateStepHeadings(), [
    `### Step B1 — \`${DEFAULT_STORE_BACKEND}\`, or the field is absent, or its value is empty`,
    `### Step B2 — \`${NON_DEFAULT_BACKEND}\``,
    '### Step B3 — any other value',
  ], 'the shipped step headings are the block\'s branch structure. Step B1\'s heading in ' +
     'particular is the condition the 18-case MALFORMED_BACKENDS table is about: if it can ' +
     'grow "or any value not listed below", every one of those 18 values degrades silently ' +
     'while the table — which runs against the ORACLE — stays green.');
});

test('[text] BLOCKING-1 Step B2 states EXACTLY the two sanctioned outcomes', () => {
  // Positive/closed-set form, deliberately: a third outcome fails whatever it
  // says, so a reworded permission cannot walk past it the way it walks past a
  // phrase denylist.
  const outcomes = stepOutcomes(2);
  assert.deepStrictEqual(outcomes.map((o) => o.condition), [
    'A Confluence-capable tool IS available',
    'No Confluence-capable tool is available',
  ], 'Step B2 is a two-way branch on tool availability. Any third outcome — an error path ' +
     'that falls back to local copies, or a prompt asking the user whether to carry on — is ' +
     'FR262 degradation reintroduced as an extra bullet.');
  assert.ok(/^route this store's reads and writes to it/.test(outcomes[0].rest),
    `Step B2's available branch must route to the tool, not merely mention it: ` +
    `${JSON.stringify(outcomes[0].rest.slice(0, 120))}`);
  assert.strictEqual(outcomes[1].rest, '**HALT** and report:',
    `Step B2's unavailable branch must HALT and report, with no alternative offered: ` +
    `${JSON.stringify(outcomes[1].rest)}`);
});

// ─── The gate's prose, as a CLOSED SET ───────────────────────────────────────
//
// FIX-ROUND, BLOCKING-1. Every disposition check in this suite used to be a
// `regexp.test()` for a phrase the author had already written, so a sentence
// ADDED alongside them was invisible: `!/\*\*PROCEED\*\*/` catches the bold word
// and not "carry on"; the FR262 forbid-list asserts four "Do NOT" sentences are
// PRESENT, and a contradicting permission placed next to them leaves all four
// intact. Five separate permissive insertions survived that shape.
//
// A denylist of permissive phrases is the same weak shape one level out — a
// reworded permission walks past it, exactly as Story 31.12's tone denylist was
// walked past. So the primary check is POSITIVE and CLOSED: the gate's prose is
// exactly these lines and no others. An inserted sentence fails whatever it
// says, and so does a deleted one.
//
// The store names and field names below are HOLES, filled from `AUTHORITY` —
// Story 31.6's routing table and the PRD's own requirement lines. So: THE
// DECISION PROSE CONTAINS NO TRANSCRIBED STORE CHOICE.
//
// FIX-ROUND-2 correction. An earlier revision of this comment made the wider
// claim that the strings never appear anywhere in this file. That was FALSE:
// `AC3_FACTS.affectedStore` and the `REQUIRED` map in the AC3 message test both
// spell the store out. Those two literals are deliberate and they stay. The same
// fact is checked a second time DERIVED from `A.store` (see "both shipped halt
// messages name that same store"), so if `AUTHORITY` ever resolved to the other
// store the derived form and the literal form would disagree and this suite
// would go red. That is defence in depth, and it fails loud rather than silently
// — which is the opposite of the property the wider claim was reaching for.

/** The prose of one region: no headings, no blockquote lines, no blanks. */
function proseLines(region) {
  return region.split('\n').map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('>'));
}

/**
 * The MESSAGE of one region: its blockquote lines, verbatim.
 *
 * FIX-ROUND-2, BLOCKING N01. Message blockquotes used to be CARVED OUT of the
 * closed set above, on the reasoning that the AC3/FR262 tests check their
 * contents fact-by-fact, which is the right granularity for a user-facing
 * message. The reasoning had a hole: every one of those tests is a PRESENCE
 * check — the exact shape this closed set exists to eliminate — so a sentence
 * ADDED to a halt message was invisible to all of them. Inserting
 *
 *     > If configuring an MCP is not possible right now, you may work from the
 *     > local files instead and re-sync later.
 *
 * into Step B2's halt message passed thirteen suites: `proseLines` drops every
 * `>` line so the closed set never saw it; the phrase denylist was defeated by
 * wording ("you may work … instead" is not `/you may instead/`, "local files" is
 * not `/local cop(y|ies)/`); no `- **…** →` bullet was added so the outcome count
 * did not move; all four AC3 facts were still present. DELETING the "Nothing has
 * been read or written on your behalf" assurance line survived the same way.
 *
 * The blockquote is not commentary. It is the text the agent reproduces to the
 * user AT THE MOMENT IT HALTS, so a halt that ends by offering local files IS the
 * FR262 degradation, delivered inside the message FR262 exists to specify. It
 * gets the same closed-set treatment, as a PARALLEL region set — parallel rather
 * than merged because the two surfaces answer to different questions: the prose
 * is the DECISION, the blockquote is what the user is told about it.
 *
 * NORMALISATION, stated rather than left to be discovered. Trailing whitespace
 * is stripped and CONTENT-FREE quoted lines (a bare `>`, or `>` followed only by
 * whitespace) are dropped, so re-flowing a message does not fail this set. That
 * is the one blockquote mutation this set lets through, and it carries no words
 * for an agent to act on. Leading INDENTATION is NOT normalised: the two spaces
 * nest Step B2's message inside its `- **No Confluence-capable tool…**` bullet,
 * and dedenting it detaches the message from the branch it belongs to.
 */
function messageLines(region) {
  return region.split('\n')
    .filter((l) => /^\s*>/.test(l))
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => !/^\s*>\s*$/.test(l));
}

/** Everything between the gate's own `## ` heading and its first step. */
function gatePreamble() {
  const at = SHIPPED_GATE.search(/^### Step B\d+ /m);
  assert.notStrictEqual(at, -1, 'the shipped block declares no steps at all');
  return SHIPPED_GATE.slice(0, at);
}

const A = AUTHORITY;

const SANCTIONED_PROSE = Object.freeze({
  preamble: [
    '**Gateway check — run this immediately after the preflight above, and before anything ' +
    'else.** Before any read, any write, any user prompt, and before the sprint-tracking ' +
    '`## Backend Routing` check below. No step of this skill executes until this check ' +
    'returns PROCEED.',

    'This is the SAME routing pattern the sprint skills use for Jira, applied to a knowledge ' +
    'store instead of to sprint tracking. It is not a second mechanism: read the backend from ' +
    'the resolved configuration, branch on its value, and where it cannot be honoured say ' +
    'exactly what is wrong and stop. `mcp-detection-pattern-spec.md` defines the shape — ' +
    '§2.6 (this is a gateway check, not an afterthought), §2.7 (absent or empty means ' +
    `\`${DEFAULT_STORE_BACKEND}\`), §6.6 (a backend is added by adding a branch, and the ` +
    `\`${DEFAULT_STORE_BACKEND}\` branch is untouched).`,

    `**Which store gates this skill.** This skill resolves ${A.artifact}, and ${A.artifact} ` +
    `are a *${A.noun}* artifact (${A.requirement}), so the store that gates it is the ` +
    `**${A.store}**. Read these two fields from \`_bmad/bmm/config.yaml\`, each only from a ` +
    'line at column 0, stripping one balanced pair of surrounding quotes from the value:',

    `- \`${A.prefix}_backend:\` — the backend of the store this skill reads its ` +
    `${A.artifact} from.`,

    `- \`${A.prefix}_space_key:\` — that store's Confluence space, when it has one.`,

    `A skill that resolves a *${A.otherNoun}* artifact reads \`${A.otherPrefix}_backend:\` ` +
    `and \`${A.otherPrefix}_space_key:\` instead and takes exactly these branches; nothing ` +
    'else about the check changes. Sprint execution state — story files, ' +
    '`sprint-status.yaml`, bugs, retrospectives — belongs to NEITHER knowledge store ' +
    '(FR267), so nothing this skill does with those artifacts is affected by any branch below.',

    'Take the first branch that matches, and stop there.',
  ],

  B1: [
    '**PROCEED** with the rest of this skill exactly as written below, unchanged. Say NOTHING ' +
    `about the backend: a ${DEFAULT_STORE_BACKEND} project gets no message from this ` +
    'section, no prompt, and no offer. This is the default (§2.7), and it is what every ' +
    'project that has not configured a Confluence store gets — including every project ' +
    'generated before the field existed. Nothing in this section reads, writes, resolves or ' +
    'reports anything on this path.',
  ],

  B2: [
    'That store\'s artifacts live in Confluence, and Confluence is the source of truth for ' +
    'them. Before resolving, reading or writing ANY artifact belonging to that store, ' +
    'determine whether a Confluence-capable tool is available to you in your current tool ' +
    'context — an MCP server, plugin or native integration connected to the Confluence ' +
    'instance that hosts the space named above. Do not assume one is present because the ' +
    `backend says \`${NON_DEFAULT_BACKEND}\`: the backend is a statement of configuration, ` +
    'and availability is a fact about this run.',

    '- **A Confluence-capable tool IS available** → route this store\'s reads and writes to ' +
    'it, in the space named by the space-key field, and treat what it returns as the source ' +
    'of truth for that store. Do NOT read that store\'s artifacts from a local directory ' +
    'instead, and do NOT write, copy, cache, export or reconcile a local copy of anything ' +
    'Confluence returns. There is no mirror and no cache, so there is nothing to synchronise ' +
    'and nothing to fall out of date.',

    '- **No Confluence-capable tool is available** → **HALT** and report:',

    'Then STOP. Do NOT fall back to the file system. Do NOT read, create or offer to create a ' +
    'local copy of that store\'s artifacts. Do NOT continue with a partial or empty result as ' +
    'though the store were empty. Do NOT change the configured backend on the user\'s behalf. ' +
    'A Confluence-backed store with no Confluence MCP has no degraded mode — halting IS the ' +
    'behaviour, not a failure to find one.',
  ],

  B3: [
    '**HALT** and report:',

    '**Default-deny, deliberately.** This is the one place this block departs from ' +
    '`mcp-detection-pattern-spec.md`, which for an unrecognised *sprint tracking* value ' +
    'prints a message and falls back to the file system (§2.5). A knowledge store does not ' +
    'get that treatment: falling back would resolve a store this build cannot identify to ' +
    'local files, which is exactly the silent degradation FR262 forbids. Step B1\'s default ' +
    'is for a field that was never stated. It is not a catch-all, and it must never absorb a ' +
    'value that IS stated and is not understood.',
  ],
});

/**
 * The FIFTH REGION SET: what each region says TO THE USER, closed the same way.
 *
 * `preamble` and `B1` are declared EMPTY on purpose. Neither addresses the user
 * at all — B1's whole disposition is "say NOTHING about the backend" — so a
 * blockquote grafted onto either is a failure whatever it says, and declaring
 * them empty is what makes that true rather than merely unlikely.
 *
 * The store name is a HOLE, filled from `AUTHORITY`, and so are the two backend
 * values, filled from the single-sourced enum. The independent LITERAL statement
 * of the same facts lives in the AC3 tests below; see the note above the prose
 * set for why both exist.
 */
const SANCTIONED_MESSAGES = Object.freeze({
  preamble: [],

  B1: [],

  B2: [
    '  > **ma-agents — stopping: this knowledge store is Confluence-backed and no Confluence ' +
    'MCP was detected.**',

    `  > Store: the ${A.store}. Space: {the value of the space-key field, or \`not recorded\` ` +
    'when that field is absent or empty}.',

    '  > No Confluence MCP server is available in this agent\'s tool context, so that store ' +
    'cannot be read or written.',

    '  > To configure one, add a Confluence-capable MCP server to your agent\'s MCP ' +
    'configuration, pointed at the Confluence instance that hosts that space, and authorise ' +
    'it; then run this skill again. Alternatively, re-run the installer (or `ma-agents bind`) ' +
    'to bind that store to the file system instead.',

    '  > Nothing has been read or written on your behalf, and nothing has been written ' +
    'locally. Stopping rather than guessing.',
  ],

  B3: [
    '  > **ma-agents — stopping: unrecognised knowledge-store backend.**',

    `  > Store: the ${A.store}. Backend: \`{the value you read}\`. The backends this build ` +
    `understands are \`${DEFAULT_STORE_BACKEND}\` and \`${NON_DEFAULT_BACKEND}\`.`,

    '  > `_bmad/bmm/config.yaml` is generated, so a value outside that set means it was ' +
    'hand-edited or written by a different build — and every artifact this skill would ' +
    'resolve for that store depends on which of the two it actually is.',

    '  > Run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml`, or re-run the installer.',

    '  > Nothing has been read or written on your behalf. Stopping rather than guessing.',
  ],
});

for (const region of ['preamble', 'B1', 'B2', 'B3']) {
  test(`[text] N01 the shipped gate's ${region}.message is EXACTLY the sanctioned lines`, () => {
    const text = region === 'preamble' ? gatePreamble() : gateStep(Number(region.slice(1)));
    assert.deepStrictEqual(messageLines(text), SANCTIONED_MESSAGES[region],
      `${region}'s message to the user has changed. This is a CLOSED set for the same reason ` +
      `the prose above is: the AC3/FR262 checks below assert these facts are PRESENT, and a ` +
      `sentence ADDED beside them leaves every one of them intact. A halt message that ends ` +
      `by offering to work from local files is the FR262 degradation itself, stated in the ` +
      `message FR262 exists to specify — and it also contradicts the assurance line that ` +
      `nothing has been written locally. ${SANCTIONED_MESSAGES[region].length === 0
        ? `${region} must address the user not at all: it has no halt to explain, and B1's ` +
          `own disposition is to say NOTHING about the backend.`
        : `If the change is deliberate, update SANCTIONED_MESSAGES — and note that the store ` +
          `name and the backend values in it are FILLED FROM the PRD, Story 31.6's routing ` +
          `table and lib/store-backends.js, so those belong upstream first.`}`);
  });
}

for (const region of ['preamble', 'B1', 'B2', 'B3']) {
  test(`[text] BLOCKING-1 the shipped gate's ${region} prose is EXACTLY the sanctioned lines`, () => {
    const text = region === 'preamble' ? gatePreamble() : gateStep(Number(region.slice(1)));
    assert.deepStrictEqual(proseLines(text), SANCTIONED_PROSE[region],
      `${region}'s decision prose has changed. This is a CLOSED set, not a presence check: a ` +
      `sentence added beside the prohibitions is as much a failure as a sentence removed, ` +
      `because that is how every permissive-degradation mutant this block survived was ` +
      `shaped. If the change is deliberate, update SANCTIONED_PROSE — and note that the ` +
      `store names and \`config.yaml\` field names in it are FILLED FROM the PRD and Story ` +
      `31.6's routing table, so a store change belongs in those documents first.`);
  });
}

test('[text] BLOCKING-1 second line: no permissive phrasing anywhere in Step B1 or Step B2', () => {
  // Deliberately SECONDARY. The closed set above is what actually holds the
  // line; a denylist is the shape this epic keeps watching walk past it. This
  // one earns its place only by naming the defect when it fires.
  const PERMISSIVE = [
    [/carry on/i, 'offers to carry on'],
    [/continue against/i, 'offers to continue against something local'],
    [/local cop(y|ies)/i, 'offers a local copy as an alternative to halting'],
    [/for this run/i, 'makes the disposition conditional on convenience'],
    [/ask the user whether/i, 'reintroduces FR266 as a user prompt'],
    [/if the user (chooses|prefers|says)/i, 'makes degradation a user choice'],
    [/you may instead/i, 'grants an alternative to the stated disposition'],
  ];
  for (const step of [1, 2]) {
    // The prohibitions legitimately say "do NOT … create a local copy"; the
    // denylist is applied to the text with those four sentences removed, so it
    // fires on a PERMISSION and not on a PROHIBITION.
    const text = gateStep(step)
      .replace(/Do NOT [^.]*\./g, '')
      .replace(/do NOT [^.]*\./g, '');
    for (const [re, why] of PERMISSIVE) {
      assert.ok(!re.test(text),
        `Step B${step} ${why} (${re}). FR262 says a Confluence-backed store with no ` +
        `Confluence MCP has no degraded mode; a sentence that supplies one is the defect ` +
        `even when every "Do NOT" around it survives intact.`);
    }
  }
});

// ─── BLOCKING-2 — the gate is bound to the store it must gate ────────────────

test('[text] BLOCKING-2 §5.2\'s epics-consumer set is exactly the set of gated documents', () => {
  // The first half of the derivation: the documents this suite gates are the
  // documents Story 31.6 says resolve the artifact. If they diverge, everything
  // below is checking the gate against the wrong artifact's store.
  assert.deepStrictEqual(A.docs, [...GATED].sort(),
    `Story 31.6 §5.2 says row ${A.row} (${A.artifact}) is resolved by ${JSON.stringify(A.docs)}, ` +
    `and this suite gates ${JSON.stringify([...GATED].sort())}. The two must be the same set, ` +
    `or the store this gate is bound to is derived from documents it does not gate.`);
});

test('[text] BLOCKING-2 the shipped gate reads the store the PRD assigns its artifact to', () => {
  // The defect: rewriting the two field bullets to the OTHER store's fields
  // survived every suite, including the one that owns FR256 routing. A project
  // with this store on Confluence and the other on the file system then reads
  // `file-system`, takes Step B1, and resolves its artifacts locally in silence.
  const preamble = gatePreamble();
  assert.ok(preamble.includes(`(${A.requirement})`),
    `the gate must cite the requirement that assigns ${A.artifact} to a store; the PRD's is ` +
    `${A.requirement}`);
  assert.ok(preamble.includes(`**${A.store}**`),
    `the gate must name the ${A.store} — that is the store the PRD assigns ${A.artifact} to`);

  const readFields = [...preamble.matchAll(/^- `([a-z_]+):`/gm)].map((x) => x[1]);
  assert.deepStrictEqual(readFields, [`${A.prefix}_backend`, `${A.prefix}_space_key`],
    `the gate reads ${JSON.stringify(readFields)}. ${PRD_REL} assigns ${A.artifact} to the ` +
    `${A.store} (${A.requirement}), so the fields it must read are ` +
    `${JSON.stringify([`${A.prefix}_backend`, `${A.prefix}_space_key`])}. Reading the other ` +
    `store's fields is FR262 silent degradation for every project whose two stores differ.`);

  assert.ok(!new RegExp(`^- \`${A.otherPrefix}_`, 'm').test(preamble),
    `the gate reads a ${A.otherStore} field as one of its own — that store does not hold ` +
    `${A.artifact}`);
});

test('[behaviour] BLOCKING-2 the ORACLE\'s default store is the same store, measured', () => {
  // The oracle's default is a literal (see its doc comment). This is where the
  // two independent statements are compared: a config that states ONLY the
  // gating store's backend must reach the confluence branch, and one that states
  // only the other store's must not.
  const gating = runBackendGate(`${A.prefix}_backend: "${NON_DEFAULT_BACKEND}"\n`, {});
  assert.strictEqual(gating.verdict, V.HALT_NO_MCP,
    `the oracle's default store does not read \`${A.prefix}_backend\`, which is the field ` +
    `${PRD_REL} (${A.requirement}) makes authoritative for ${A.artifact}`);
  const other = runBackendGate(`${A.otherPrefix}_backend: "${NON_DEFAULT_BACKEND}"\n`, {});
  assert.strictEqual(other.verdict, V.PROCEED_FILE_SYSTEM,
    `the oracle's default store reads \`${A.otherPrefix}_backend\` too, so this suite could ` +
    `not tell the two stores apart`);
  assert.strictEqual(gating.store, `the ${A.store}`,
    `the oracle labels its default store ${JSON.stringify(gating.store)}; the PRD says ` +
    `${A.artifact} belong to the ${A.store}`);
});

test('[text] BLOCKING-2 both shipped halt messages name that same store', () => {
  for (const step of [2, 3]) {
    assert.ok(gateStep(step).includes(`Store: the ${A.store}.`),
      `Step B${step}'s halt message must name the ${A.store} — the store the PRD assigns ` +
      `${A.artifact} to. A halt that names the wrong store sends the user to fix the wrong ` +
      `binding.`);
  }
});

test('[text] AC3 the shipped block states all four required facts, checked against literals', () => {
  // The facts are written out HERE. Nothing is derived from the block, and
  // nothing is derived from the oracle's message either.
  //
  // KEPT DELIBERATELY alongside the `B2.message` closed set added in fix-round 2.
  // The two are complementary, not redundant, and in both directions: this test
  // names WHICH fact went missing where a line-set gives only a diff, and it says
  // the facts must be PRESENT, which a closed set does not express — while the
  // closed set says nothing may be ADDED, which no presence check expresses. The
  // literals here are also the independent second statement of the store name;
  // see the note above SANCTIONED_PROSE.
  //
  // SCOPED TO STEP B2, found by this story's mutation run (M17): asserted over
  // the whole block, deleting "Store: the software requirements store" from the
  // MCP-absent message left the suite green, because Step B3's unrelated message
  // names the store too. A fact has to be present in the message that must carry
  // it, not merely somewhere in the document.
  const b2 = gateStep(2);
  const REQUIRED = {
    'the affected store': /Store: the software requirements store/,
    'its configured space': /Space: \{the value of the space-key field/,
    'that no Confluence MCP was detected': /no Confluence MCP was detected/,
    'how to configure one': /add a Confluence-capable MCP server to your agent's MCP configuration/,
  };
  for (const [fact, needle] of Object.entries(REQUIRED)) {
    assert.ok(needle.test(b2),
      `Step B2's halt message does not name ${fact}`);
  }
});

test('[text] AC3/FR262 each shipped step states its OWN disposition — B1 proceeds, B2 and B3 halt', () => {
  // Found by this story's mutation run (M18): rewriting Step B3's disposition
  // from "**HALT** and report" to "output the message, then **PROCEED**" left
  // every test green, because nothing measured the DISPOSITION — only that the
  // message text still existed. That is the "proves presence, not behaviour"
  // shape, applied to the block's most important word.
  const b1 = gateStep(1);
  const b2 = gateStep(2);
  const b3 = gateStep(3);

  assert.ok(/\*\*PROCEED\*\*/.test(b1), 'Step B1 must say PROCEED');
  assert.ok(!/\*\*HALT\*\*/.test(b1), 'Step B1 must not halt — file-system is unchanged');

  assert.ok(/\*\*HALT\*\*/.test(b2), 'Step B2\'s no-tool branch must say HALT');
  assert.ok(!/\*\*PROCEED\*\*/.test(b2),
    'Step B2 must never offer to proceed — that is the FR262 degradation');

  assert.ok(/\*\*HALT\*\*/.test(b3),
    'Step B3 must HALT on an unrecognised backend. Falling back to the file system is ' +
    'mcp-detection-pattern-spec.md §2.5\'s behaviour for SPRINT TRACKING, and the block ' +
    'departs from it deliberately — a value that IS stated and is NOT understood must ' +
    'never be absorbed by Step B1\'s never-stated default.');
  assert.ok(!/\*\*PROCEED\*\*/.test(b3), 'Step B3 must not proceed');
  assert.ok(!/File-System branch|fall back to the file system/i.test(b3),
    'Step B3 must not route to the file-system branch');
});

test('[text] FR262 the block forbids every form of degradation, by name', () => {
  const REQUIRED = [
    /Do NOT fall back to the file system/,
    /Do NOT read, create or offer to create a local copy/,
    /Do NOT continue with a partial or empty result/,
    /Do NOT change the configured backend on the user's behalf/,
    /halting IS the behaviour/,
  ];
  for (const needle of REQUIRED) {
    assert.ok(needle.test(SHIPPED_GATE),
      `the block does not forbid: ${needle}`);
  }
});

test('[text] P5-9.6 the block forbids a mirror, a cache and a sync, in the MCP-PRESENT branch', () => {
  // The dangerous branch is the one that succeeds: that is where a helpful agent
  // would write "a local copy, just for speed".
  const present = SHIPPED_GATE.slice(SHIPPED_GATE.indexOf('A Confluence-capable tool IS available'));
  const stop = present.indexOf('- **No Confluence-capable tool');
  const branch = stop === -1 ? present : present.slice(0, stop);
  assert.ok(/do NOT write, copy, cache, export or reconcile a local copy/.test(branch),
    `the MCP-present branch must forbid a local copy explicitly:\n${branch}`);
  assert.ok(/no mirror and no cache/.test(branch) && /nothing to synchronise/.test(branch),
    `the block must state WHY there is no sync, or the rule reads as arbitrary:\n${branch}`);
});

test('[text] AC1/FR261 the block cites the canonical spec, by section', () => {
  assert.ok(/mcp-detection-pattern-spec\.md/.test(SHIPPED_GATE),
    'FR261 names the spec — the block must cite it rather than describe a mechanism');
  for (const section of ['§2.6', '§2.7', '§6.6']) {
    assert.ok(SHIPPED_GATE.includes(section),
      `the block does not cite ${section}, which an AC names`);
  }
  assert.ok(/SAME routing pattern the sprint skills use for Jira/.test(SHIPPED_GATE),
    'the block must say it is the same pattern, so a reviewer who knows the Jira path ' +
    'recognises this one');
});

test('[text] NB-7 the spec\'s own §2.5 scopes its fallback rule to sprint tracking', () => {
  // Disclosing the departure only in the skill text left `mcp-detection-pattern-
  // spec.md` §2.5 reading as universal, while `skills/generate-backlog/SKILL.md`
  // carried TWO backend switches with OPPOSITE dispositions for an unrecognised
  // value — this story's, which halts, and Story 17.22's sprint routing, which
  // falls back. A reader of the spec alone would have found only one of them.
  const spec = readAuthority('_bmad-output/planning-artifacts/mcp-detection-pattern-spec.md');
  const at = spec.indexOf('### 2.5');
  assert.notStrictEqual(at, -1, 'the spec no longer has a §2.5');
  const next = spec.indexOf('\n### ', at + 1);
  const section = spec.slice(at, next === -1 ? spec.length : next);

  assert.ok(/tracking_system/.test(section) && /falls back to file-system/.test(section),
    'the sprint-tracking rule §2.5 states must survive — this story does not change it');
  assert.ok(/sprint tracking only/i.test(section),
    '§2.5 must scope its fallback, or it reads as the rule for every backend switch');
  assert.ok(/knowledge store/i.test(section) && /HALT/.test(section),
    '§2.5 must say what a knowledge store does instead of falling back');
  assert.ok(/FR262/.test(section),
    '§2.5 must give the requirement that makes a knowledge store default-deny');
});

test('[text] NFR17 the one departure from the spec is STATED, not silent', () => {
  // §2.5 falls back to file-system on an unrecognised value. This block halts.
  // A deviation a reader has to discover is how a second convention starts.
  assert.ok(/departs from `mcp-detection-pattern-spec\.md`/.test(SHIPPED_GATE),
    'the block must name its own departure from the spec');
  assert.ok(/§2\.5/.test(SHIPPED_GATE), 'and cite the section it departs from');
  assert.ok(/FR262/.test(SHIPPED_GATE), 'and give the requirement that justifies it');
});

test('[text] NFR17 no second backend vocabulary was invented', () => {
  // The closed enum, single-sourced in lib/store-backends.js. The block may name
  // those two values and no others.
  const { STORE_BACKEND_LIST } = require(path.join(PROJECT_ROOT, 'lib', 'store-backends.js'));
  for (const b of STORE_BACKEND_LIST) {
    assert.ok(SHIPPED_GATE.includes(`\`${b}\``), `the block does not name the legal value ${b}`);
  }
  for (const invented of ['confluence-cloud', 'confluence-server', 'confluence-dc',
    'mcp', 'rovo', 'atlassian']) {
    assert.ok(!new RegExp(`\`${invented}\``, 'i').test(SHIPPED_GATE),
      `the block names ${invented} as if it were a backend value — the enum has two members`);
  }
});

test('[text] the block names no specific MCP server, tool or endpoint (spec §1.3)', () => {
  for (const named of ['Rovo', 'atlassian-mcp', 'mcp__', 'https://', 'rest/api/content',
    'claude mcp add']) {
    assert.ok(!SHIPPED_GATE.includes(named),
      `the block hard-codes ${JSON.stringify(named)}; spec §1.3 requires tool-agnostic wording`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9 — [text] AC5: nothing outside the block changed
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 9. [text] AC5 — the file-system branch is completely unchanged ===\n');

test('[text] AC5 outside the block, no gated document mentions Confluence or an MCP at all', () => {
  // The additive-backend rule (§6.6) made concrete: the new branch is contained.
  // If any Confluence concept had leaked into the existing instructions, the
  // file-system path would no longer be "completely unchanged".
  for (const rel of GATED) {
    const rest = skillBodyOnly(rel);
    for (const needle of [/confluence/i, /Confluence[- ]?(MCP|capable)/i, /space[_ ]key/i,
      /_requirements_backend/, /knowledge[- ]store backend/i]) {
      assert.ok(!needle.test(rest),
        `${rel}: ${needle} appears OUTSIDE the routing block — the additive-backend rule ` +
        `says the file-system branch is untouched`);
    }
  }
});

test('[text] AC5 Story 17.22\'s Jira routing block is untouched — the OTHER backend switch', () => {
  // §6.6's additive rule cuts both ways: adding the knowledge-store gate must not
  // have edited the sprint-tracking one. Its own MCP sentence is the marker, and
  // it must still be there, outside this story's block, in the documents that
  // carried it before.
  const withSprint = GATED.filter((rel) => readDoc(rel).includes('\n## Backend Routing'));
  assert.ok(withSprint.length >= 3, `expected the sprint routing block; found ${withSprint.length}`);
  for (const rel of withSprint) {
    const rest = skillBodyOnly(rel);
    assert.ok(/an MCP server, plugin, or native integration connected to the Jira/.test(rest),
      `${rel}: Story 17.22's Jira wording is no longer intact outside this story's block`);
    assert.ok(/tracking_system/.test(rest),
      `${rel}: the sprint-tracking switch no longer reads tracking_system`);
  }
});

test('[text] AC5 the block is a self-contained section — removing it leaves no residue', () => {
  for (const rel of GATED) {
    const body = readDoc(rel);
    const parts = body.split(SHIPPED_GATE);
    assert.strictEqual(parts.length, 2,
      `${rel}: the block does not appear exactly once as a contiguous run of text`);
    assert.ok(!parts.join('').includes(GATE_HEADING),
      `${rel}: the gate heading survives the block's removal`);
  }
});

test('[text] AC5 the pre-existing epics resolution is still the same instruction', () => {
  // The concrete thing AC5 protects: these documents still resolve epics from
  // config.yaml's planning_artifacts, exactly as Story 31.6 left them.
  for (const rel of GATED) {
    const rest = withoutGate(rel);
    assert.ok(/planning_artifacts/.test(rest),
      `${rel}: the epics resolution left the document with the block`);
    assert.ok(/_bmad\/bmm\/config\.yaml/.test(rest),
      `${rel}: the config.yaml source is no longer named outside the block`);
  }
});

test('[text] Story 31.6 AC5 the block does not open a second source of truth', () => {
  // A workflow must resolve from the GENERATED config, never from the committed
  // binding. The gate obeys the same rule the rest of the document does.
  assert.ok(!/project-layout\.yaml/.test(SHIPPED_GATE),
    'the routing block names the committed binding — workflows resolve from config.yaml');
  assert.ok(/_bmad\/bmm\/config\.yaml/.test(SHIPPED_GATE),
    'the block must name the generated config it reads its fields from');
});

test('[text] FR267 the block states that sprint artifacts belong to neither store', () => {
  assert.ok(/FR267/.test(SHIPPED_GATE) && /neither knowledge store/i.test(SHIPPED_GATE),
    'without this, an agent could read the gate as covering story files too, and a ' +
    'Confluence-backed store would halt sprint work that has nothing to do with it');
});

test('[text] the block does not cite a document this repository does not ship', () => {
  // The Story 31.6 BLOCKING-4 rule, restated for this block specifically.
  for (const m of SHIPPED_GATE.match(/_bmad-output\/[A-Za-z0-9._/{}-]*/g) || []) {
    assert.fail(`the block cites ${m}; package.json does not ship _bmad-output/`);
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
