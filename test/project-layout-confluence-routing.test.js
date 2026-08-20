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

const EXPECTED_TEST_COUNT = 73;

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
 * @param {string} configContent  a REAL generated `_bmad/bmm/config.yaml`
 * @param {object} env
 * @param {object|null} env.confluence  the mock MCP surface, or null when absent
 * @param {string} env.storeField       which store's fields to read
 * @param {object} env.localReads       recorder: any local artifact read
 * @param {object} env.localWrites      recorder: any local artifact write
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
      'the project tree must be byte-identical afterwards');
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
      'a halt must not leave a partial file, a stub, or a "local copy for now" behind');
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
  result = { ok: true, armed: true, blocked: BLOCKED, backend: (backend || '').trim(),
    bindingOk: !!topo.ok, hasConfig: fs.existsSync(path.join(tmp, '_bmad', 'bmm', 'config.yaml')) };
} catch (e) {
  result = { ok: false, why: e.message, blocked: BLOCKED };
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
  // The arming probe runs before this list is read, so it is reset by
  // construction — the child records only what the FLOW attempted.
  assert.strictEqual(AIRGAP.ok, true, `the air-gapped child failed: ${AIRGAP.why}`);
  const duringFlow = (AIRGAP.blocked || []).filter((b) => b !== 'https.get');
  assert.deepStrictEqual(duringFlow, [],
    `the file-system flow reached for the network: ${JSON.stringify(duringFlow)}`);
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
  for (const verdict of Object.values(V)) {
    const marker = BRANCH_MARKERS[verdict];
    assert.ok(marker, `verdict ${verdict} has no marker — the map has gone stale`);
    assert.ok(SHIPPED_GATE.includes(marker),
      `the shipped block does not state the ${verdict} branch (looked for ` +
      `${JSON.stringify(marker)})`);
  }
});

test('[text] every branch the shipped block states is a verdict the oracle can return', () => {
  // The other direction: a marker in the map that no verdict claims would mean
  // the block describes behaviour nothing exercises.
  const claimed = new Set(Object.keys(BRANCH_MARKERS));
  assert.deepStrictEqual([...claimed].sort(), Object.values(V).sort(),
    'the marker map and the verdict set must be the same set');
  const steps = (SHIPPED_GATE.match(/^### Step B\d+ /gm) || []).length;
  assert.strictEqual(steps, 3,
    `the shipped block states ${steps} steps; the oracle implements three (B1/B2/B3). ` +
    `A fourth step nothing exercises is the shape this test exists to catch.`);
});

test('[text] AC3 the shipped block states all four required facts, checked against literals', () => {
  // The facts are written out HERE. Nothing is derived from the block, and
  // nothing is derived from the oracle's message either.
  const REQUIRED = {
    'the affected store': /Store: the software requirements store/,
    'its configured space': /Space: \{the value of the space-key field/,
    'that no Confluence MCP was detected': /no Confluence MCP was detected/,
    'how to configure one': /add a Confluence-capable MCP server to your agent's MCP configuration/,
  };
  for (const [fact, needle] of Object.entries(REQUIRED)) {
    assert.ok(needle.test(SHIPPED_GATE),
      `the shipped halt message does not name ${fact}`);
  }
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
