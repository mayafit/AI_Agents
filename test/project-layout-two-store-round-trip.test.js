#!/usr/bin/env node
/**
 * Epic 31 — prerequisite fixes for Story 31.5. Two coupled defects:
 *
 *   bug-read-existing-layout-collapses-two-stores-onto-software-store.md (high)
 *     readExistingLayout() returned only the software store, and the now-
 *     unconditional writeProjectLayoutYaml() stamped that single value over BOTH
 *     records — so a divergent `system_requirements_store` (its backend, its
 *     Confluence space key, its root page) was silently destroyed in a COMMITTED
 *     file. Fixed by returning the full topology alongside the collapsed legacy
 *     view, and by preserving unsupplied records at the write choke point.
 *
 *   bug-show-current-layout-prints-undefined-for-confluence-store.md (low)
 *     showCurrentLayout() rendered every record as `Mode:` + `Path:`, so a valid
 *     confluence store printed `Mode: undefined / Path: undefined`. Fixed by
 *     rendering through the per-backend identity view.
 *
 * ORACLE. Every assertion about "what bytes reached the authoritative file" is
 * additionally checked with js-yaml — a real parser and a declared DIRECT
 * dependency — not only with the module's own line-based parseLayoutYaml, for the
 * reason recorded in project-layout-binding-spine.test.js: a hand-rolled reader
 * cannot see a file it alone can read.
 *
 * The test count is pinned in both directions (EXPECTED_TEST_COUNT). This epic
 * has already shipped one suite that exited 0 having reported nothing; a suite
 * that silently stops running tests must fail, not pass.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const EXPECTED_TEST_COUNT = 46;

let passed = 0;
let failed = 0;
const errors = [];

// N-6 — THE BACKSTOP, HOISTED ABOVE THE TESTS ON PURPOSE.
//
// It used to sit in the summary block at the BOTTOM of this file, which meant it
// was only armed after every synchronous test had already run. That is exactly
// backwards: the thing it protects against is the process dying BEFORE the
// summary. `collectRepoLayout`'s interactive branch still contains a bare
// `if (!mode) process.exit(0);`, so a future test driving the wizard with a
// cancelled prompt would exit 0 in the middle of `drainAsyncTests()`, skipping
// BOTH the summary AND the EXPECTED_TEST_COUNT guard — the defect wave 2A
// shipped and had to fix. The install-path tests added below spawn the real CLI,
// which is the closest this suite has come to reaching that branch, so it is
// treated as live rather than theoretical. Registering the listener here arms it
// from the first line of the first test onwards.
//
// Setting `process.exitCode` from an 'exit' listener DOES override an explicit
// `process.exit(0)` — verified in wave 2A, and the reason this works at all.
let summaryPrinted = false;

process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Something aborted the process ` +
    `mid-run — the usual cause is a cli.js code path calling process.exit() from inside an ` +
    `awaited test. Forcing a non-zero exit so this cannot read as a pass.`
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

const asyncTests = [];
function testAsync(name, fn) { asyncTests.push([name, fn]); }
async function drainAsyncTests() {
  for (const [name, fn] of asyncTests) {
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
}

// ─── Load module ─────────────────────────────────────────────────────────────
let writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology, showCurrentLayout,
  handleConfigLayout, storesDiverge, storeIdentityFields, sprintIdentityFields,
  renderIdentityValue, summarizeStoreIdentity, STORE_BACKEND_VIEWS, STORE_BACKENDS,
  DEFAULT_STORE_BACKEND, IDENTITY_NOT_CONFIGURED, backendOfStore, BINDING_UNBOUND,
  writeRepoLayoutConfig;
let generateRepoLayoutSection;
try {
  ({
    writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology, showCurrentLayout,
    handleConfigLayout, storesDiverge, storeIdentityFields, sprintIdentityFields,
    renderIdentityValue, summarizeStoreIdentity, STORE_BACKEND_VIEWS, STORE_BACKENDS,
    DEFAULT_STORE_BACKEND, IDENTITY_NOT_CONFIGURED, backendOfStore, BINDING_UNBOUND,
    writeRepoLayoutConfig,
  } = require('../bin/cli.js'));
  ({ generateRepoLayoutSection } = require('../lib/installer.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

let yamlOracle = null;
try { yamlOracle = require('js-yaml'); } catch (e) { yamlOracle = null; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-2store-'));
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

function writeFixture(tmpDir, lines) {
  fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
  const body = lines.join('\n') + '\n';
  fs.writeFileSync(layoutPathOf(tmpDir), body, 'utf-8');
  return body;
}

function readLayoutFile(tmpDir) {
  return fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
}

// The only line AC1 permits to change across a round trip.
function withoutGeneratedLine(content) {
  return content.split(/\r?\n/).filter((l) => !/^generated:/.test(l)).join('\n');
}

function capture(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { fn(); } finally { console.log = orig; }
  return logs.join('\n');
}

async function captureAsync(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return logs.join('\n');
}

// Asserts the emitted file is readable by a real YAML parser and returns the doc.
// If js-yaml is genuinely unavailable this degrades to a real (if weaker)
// assertion rather than a skip — see the binding-spine suite's note.
function parseWithOracle(content, what) {
  if (!yamlOracle) {
    assert.ok(/^schema_version: \d+$/m.test(content), `${what}: emitted file lacks a schema_version line`);
    return null;
  }
  try {
    return yamlOracle.load(content);
  } catch (e) {
    throw new Error(`${what}: emitted file is NOT parseable by js-yaml: ${e.message.split('\n')[0]}`);
  }
}

// Only the legacy keys — deliberately NOT `topology`. The whole point of putting
// preservation at the write choke point is that it works for a caller that knows
// nothing about the two-store schema, which is every caller before Story 31.5:
// collectRepoLayout's interactive and env-var branches both rebuild a fresh
// `{knowledgebase, sprintManagement}` object and drop anything else.
function legacyOnly(layout) {
  return { knowledgebase: layout.knowledgebase, sprintManagement: layout.sprintManagement };
}

const FS_STORE = (p) => ({ backend: 'file-system', mode: p === '.' ? 'same' : 'local', path: p });
const CONF_STORE = (spaceKey, title, id) => ({
  backend: 'confluence', spaceKey, rootPage: { title, id },
});
const SPRINT_SAME = { mode: 'same', path: '.' };

// Writes a genuine two-store file via the explicit per-store door, so the
// "byte-identical" comparison is against THIS serializer's own output rather than
// against a hand-written fixture that merely resembles it.
function seedDivergent(tmpDir, systemStore, softwareStore, sprint) {
  capture(() => writeProjectLayoutYaml({
    systemRequirementsStore: systemStore,
    softwareRequirementsStore: softwareStore,
    sprintManagement: sprint || SPRINT_SAME,
  }));
  return readLayoutFile(tmpDir);
}

// ─── HEADLINE — FR257: system=confluence + software=file-system round-trips ───
console.log('\nHEADLINE — FR257: system_requirements_store: confluence + software_requirements_store: file-system');

test('a legacy-shape write over a divergent FR257 file is byte-identical except `generated`', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = seedDivergent(tmpDir, CONF_STORE('ENG', 'System Requirements', '459201'), FS_STORE('.'));
    assert.ok(/system_requirements_store:\n\s+backend: confluence/.test(before), `seed failed: ${before}`);

    // The live round trip: readExistingLayout() -> collectRepoLayout(--yes) ->
    // writeProjectLayoutYaml(), with the caller supplying ONLY the single legacy
    // value the pre-31.5 wizard can collect.
    const existing = readExistingLayout();
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);

    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `the divergent binding must survive byte-identically except \`generated\`.\nBEFORE:\n${before}\nAFTER:\n${after}`);

    const doc = parseWithOracle(after, 'headline');
    if (doc) {
      assert.strictEqual(doc.system_requirements_store.backend, 'confluence');
      assert.strictEqual(doc.system_requirements_store.space_key, 'ENG');
      assert.strictEqual(doc.system_requirements_store.root_page.title, 'System Requirements');
      assert.strictEqual(doc.system_requirements_store.root_page.id, '459201');
      assert.strictEqual(doc.software_requirements_store.backend, 'file-system');
    }
  } finally {
    cleanup();
  }
});

test('the FR257 space key and root page survive a hand-written divergent file too', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      '# Generated by ma-agents — do not edit manually',
      'schema_version: 2',
      'generated: "2026-08-01"',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key: "ENG"',
      '  root_page:',
      '    title: "System Requirements"',
      '    id: "459201"',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);
    const existing = readExistingLayout();
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);
    assert.ok(after.includes('space_key: "ENG"'), `space_key lost: ${after}`);
    assert.ok(after.includes('title: "System Requirements"'), `root_page.title lost: ${after}`);
    assert.ok(after.includes('id: "459201"'), `root_page.id lost: ${after}`);
    parseWithOracle(after, 'hand-written FR257');
  } finally {
    cleanup();
  }
});

testAsync('the live `config layout --yes` command preserves a divergent FR257 binding', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  const saved = ['MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL']
    .map((k) => [k, process.env[k]]);
  try {
    for (const [k] of saved) delete process.env[k];
    const before = seedDivergent(tmpDir, CONF_STORE('ENG', 'System Requirements', '459201'), FS_STORE('.'));
    await captureAsync(() => handleConfigLayout(['--yes']));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `\`ma-agents config layout --yes\` destroyed the divergent binding.\nBEFORE:\n${before}\nAFTER:\n${after}`);
  } finally {
    for (const [k, v] of saved) { if (v !== undefined) process.env[k] = v; else delete process.env[k]; }
    cleanup();
  }
});

// ─── Both divergent orderings, and every backend combination ─────────────────
console.log('\nDivergent orderings and the four backend combinations');

test('the other ordering survives too: system=file-system + software=confluence', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = seedDivergent(tmpDir, FS_STORE('.'), CONF_STORE('SWREQ', 'Software Requirements', '77123'));
    const existing = readExistingLayout();
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before), `AFTER:\n${after}`);
    assert.ok(/system_requirements_store:\n\s+backend: file-system/.test(after),
      `the system store must NOT be overwritten with the software store's confluence identity: ${after}`);
  } finally {
    cleanup();
  }
});

test('both stores confluence in DIFFERENT spaces both survive', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = seedDivergent(tmpDir, CONF_STORE('SYS', 'Sys root', '1'), CONF_STORE('SWE', 'Swe root', '2'));
    const existing = readExistingLayout();
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before), `AFTER:\n${after}`);
    assert.ok(after.includes('"SYS"') && after.includes('"SWE"'),
      `both space keys must survive: ${after}`);
    const doc = parseWithOracle(after, 'two confluence spaces');
    if (doc) {
      assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
      assert.strictEqual(doc.software_requirements_store.space_key, 'SWE');
    }
  } finally {
    cleanup();
  }
});

test('two file-system stores at DIFFERENT paths both survive', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const sysPath = path.join(path.dirname(tmpDir), 'sys-kb');
    const swePath = path.join(path.dirname(tmpDir), 'swe-kb');
    const before = seedDivergent(tmpDir, FS_STORE(sysPath), FS_STORE(swePath));
    const existing = readExistingLayout();
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before), `AFTER:\n${after}`);
    assert.ok(after.includes('sys-kb') && after.includes('swe-kb'), `both paths must survive: ${after}`);
  } finally {
    cleanup();
  }
});

test('all four backend combinations round-trip; only the non-divergent ones re-map both stores', () => {
  const combos = [
    ['file-system', 'file-system'],
    ['file-system', 'confluence'],
    ['confluence', 'file-system'],
    ['confluence', 'confluence'],
  ];
  for (const [sysBackend, sweBackend] of combos) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const sys = sysBackend === 'confluence' ? CONF_STORE('SYS', 'Sys', '1') : FS_STORE(path.join(path.dirname(tmpDir), 'sys'));
      const swe = sweBackend === 'confluence' ? CONF_STORE('SWE', 'Swe', '2') : FS_STORE(path.join(path.dirname(tmpDir), 'swe'));
      const before = seedDivergent(tmpDir, sys, swe);
      const existing = readExistingLayout();
      capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
      const after = readLayoutFile(tmpDir);
      assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
        `${sysBackend}/${sweBackend} did not round-trip.\nBEFORE:\n${before}\nAFTER:\n${after}`);
      parseWithOracle(after, `${sysBackend}/${sweBackend}`);
    } finally {
      cleanup();
    }
  }
});

test('root_page with only a title, only an id, and neither all round-trip', () => {
  for (const [title, id] of [['Only Title', null], [null, '999'], [null, null]]) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      const before = seedDivergent(tmpDir, CONF_STORE('SPC', title, id), FS_STORE('.'));
      const existing = readExistingLayout();
      capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
      const after = readLayoutFile(tmpDir);
      assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
        `root_page {title:${title}, id:${id}} did not round-trip.\nBEFORE:\n${before}\nAFTER:\n${after}`);
      assert.ok(!/\[object Object\]/.test(after), `object leak: ${after}`);
      parseWithOracle(after, `root_page ${title}/${id}`);
    } finally {
      cleanup();
    }
  }
});

// ─── AC5 — the unconditional write cannot overwrite an unsupplied record ─────
console.log('\nAC5 — the unconditional write cannot overwrite a record the caller did not supply');

test('writeProjectLayoutYaml({}) preserves all three records verbatim', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = seedDivergent(
      tmpDir,
      CONF_STORE('ENG', 'Sys root', '11'),
      FS_STORE(path.join(path.dirname(tmpDir), 'swe')),
      { mode: 'local', path: path.join(path.dirname(tmpDir), 'sprints') }
    );
    capture(() => writeProjectLayoutYaml({}));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `an empty layout must preserve, not default.\nBEFORE:\n${before}\nAFTER:\n${after}`);
  } finally {
    cleanup();
  }
});

test('supplying only sprintManagement leaves BOTH stores untouched', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, CONF_STORE('ENG', 'Sys root', '11'), FS_STORE('.'));
    capture(() => writeProjectLayoutYaml({ sprintManagement: { mode: 'local', path: path.join(path.dirname(tmpDir), 'sprints') } }));
    const after = readLayoutFile(tmpDir);
    assert.ok(after.includes('space_key: "ENG"'), `system store lost: ${after}`);
    assert.ok(/software_requirements_store:\n\s+backend: file-system/.test(after), `software store lost: ${after}`);
    assert.ok(after.includes('sprints'), `the supplied sprint record must be written: ${after}`);
  } finally {
    cleanup();
  }
});

test('supplying only softwareRequirementsStore leaves the system store untouched', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, CONF_STORE('ENG', 'Sys root', '11'), FS_STORE('.'));
    capture(() => writeProjectLayoutYaml({ softwareRequirementsStore: CONF_STORE('NEWSWE', 'New', '9') }));
    const after = readLayoutFile(tmpDir);
    assert.ok(after.includes('space_key: "ENG"'), `system store lost: ${after}`);
    assert.ok(after.includes('space_key: "NEWSWE"'), `software store not updated: ${after}`);
  } finally {
    cleanup();
  }
});

test('an explicit systemRequirementsStore still takes precedence over preservation', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, CONF_STORE('OLD', 'Old', '1'), FS_STORE('.'));
    capture(() => writeProjectLayoutYaml({
      systemRequirementsStore: CONF_STORE('NEW', 'New', '2'),
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    const after = readLayoutFile(tmpDir);
    assert.ok(after.includes('space_key: "NEW"'), `explicit store must win: ${after}`);
    assert.ok(!after.includes('space_key: "OLD"'), `preservation must not override an explicit store: ${after}`);
  } finally {
    cleanup();
  }
});

test('sprint_management is preserved when unsupplied, and overwritten when supplied', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, CONF_STORE('ENG', 'Sys', '1'), FS_STORE('.'),
      { mode: 'jira', jiraUrl: 'https://jira.example.com', jiraProjectKey: 'PROJ' });
    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' } }));
    let after = readLayoutFile(tmpDir);
    assert.ok(after.includes('mode: jira') && after.includes('PROJ'),
      `an unsupplied sprint record must be preserved, not reset to same/.: ${after}`);

    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: SPRINT_SAME }));
    after = readLayoutFile(tmpDir);
    assert.ok(!after.includes('mode: jira'), `a supplied sprint record must win: ${after}`);
  } finally {
    cleanup();
  }
});

// ─── NFR82 / AC3 — non-divergent projects behave exactly as before ───────────
console.log('\nNFR82 / AC3 — no regression for non-divergent projects');

test('a single legacy value still maps onto BOTH stores when the committed stores agree', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // Non-divergent seed, then a reconfigure that repoints the knowledgebase.
    seedDivergent(tmpDir, FS_STORE('.'), FS_STORE('.'));
    const kb = path.join(path.dirname(tmpDir), 'moved-kb');
    capture(() => writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: kb },
      sprintManagement: SPRINT_SAME,
    }));
    const after = readLayoutFile(tmpDir);
    const topology = resolveProjectTopology(tmpDir).topology;
    assert.strictEqual(topology.systemRequirementsStore.path, topology.softwareRequirementsStore.path,
      `both stores must follow the one answered location on a non-divergent project: ${after}`);
    assert.ok(after.includes('moved-kb'), `the new location must be written: ${after}`);
    assert.strictEqual((after.match(/moved-kb/g) || []).length, 2,
      `both store records must carry the new location: ${after}`);
  } finally {
    cleanup();
  }
});

test('a fresh project (no existing file) still writes the one answer into both stores', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const kb = path.join(path.dirname(tmpDir), 'fresh-kb');
    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'local', path: kb }, sprintManagement: SPRINT_SAME }));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual((after.match(/fresh-kb/g) || []).length, 2, `both stores expected: ${after}`);
    parseWithOracle(after, 'fresh project');
  } finally {
    cleanup();
  }
});

test('all 12 legacy `knowledgebase` x `sprint` mode combinations still resolve ok:true', () => {
  const kbModes = ['same', 'local', 'remote'];
  const sprintModes = ['same', 'local', 'remote', 'jira'];
  let checked = 0;
  for (const kbMode of kbModes) {
    for (const sprintMode of sprintModes) {
      const { tmpDir, cleanup } = withTmpDir();
      try {
        const kbLines = ['knowledgebase:', `  mode: ${kbMode}`,
          `  path: ${kbMode === 'same' ? '"."' : '"../kb"'}`];
        if (kbMode === 'remote') kbLines.push('  gitUrl: "https://git.example.com/kb.git"');
        const spLines = sprintMode === 'jira'
          ? ['sprint_management:', '  mode: jira', '  jira_url: "https://jira.example.com"', '  jira_project_key: "PROJ"']
          : ['sprint_management:', `  mode: ${sprintMode}`, `  path: ${sprintMode === 'same' ? '"."' : '"../sprint"'}`]
            .concat(sprintMode === 'remote' ? ['  gitUrl: "https://git.example.com/sprint.git"'] : []);
        const fixture = writeFixture(tmpDir, [
          '# Generated by ma-agents — do not edit manually',
          'generated: "2026-03-26"',
          ...kbLines,
          ...spLines,
        ]);

        const result = resolveProjectTopology(tmpDir);
        assert.ok(result.ok,
          `legacy kb=${kbMode} sprint=${sprintMode} must resolve ok:true (FR265/NFR82), got ` +
          `${result.reason}: ${result.message}`);
        assert.strictEqual(result.topology.schemaVersion, 1);
        assert.deepStrictEqual(result.topology.systemRequirementsStore, result.topology.softwareRequirementsStore,
          `legacy kb=${kbMode}: both stores must point at the one location`);
        assert.strictEqual(result.topology.sprintManagement.mode, sprintMode);
        assert.strictEqual(readLayoutFile(tmpDir), fixture, 'reading a legacy file must never rewrite it');
        checked++;
      } finally {
        cleanup();
      }
    }
  }
  assert.strictEqual(checked, 12, `expected 12 legacy combinations, checked ${checked}`);
});

test('a legacy single-`knowledgebase` file: the legacy write maps onto both stores, no divergence invented', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'generated: "2026-03-26"',
      'knowledgebase:',
      '  mode: local',
      '  path: "../kb"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);
    const existing = readExistingLayout();
    assert.ok(existing.topology, 'a legacy file still yields a topology');
    assert.strictEqual(storesDiverge(existing.topology.systemRequirementsStore,
      existing.topology.softwareRequirementsStore), false,
      'a legacy single-record file must never read as divergent');
    const out = capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    assert.ok(!/left UNCHANGED/.test(out), `no divergence notice is due for a legacy file, got: ${out}`);
    const after = readLayoutFile(tmpDir);
    assert.strictEqual((after.match(/kb"/g) || []).length, 2, `both stores expected: ${after}`);
    assert.ok(after.includes('schema_version: 2'), 'the write upgrades the schema');
  } finally {
    cleanup();
  }
});

test('a pre-F26 file with no schema_version reads and rewrites without loss', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'knowledgebase:',
      '  mode: remote',
      '  path: "../kb"',
      '  gitUrl: "https://git.example.com/kb.git"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);
    const existing = readExistingLayout();
    assert.strictEqual(existing.topology.schemaVersion, 1);
    capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    const after = readLayoutFile(tmpDir);
    assert.strictEqual((after.match(/git\.example\.com\/kb\.git/g) || []).length, 2,
      `the gitUrl must reach both stores: ${after}`);
    parseWithOracle(after, 'pre-F26');
  } finally {
    cleanup();
  }
});

test('an absent file: readExistingLayout returns null and the write creates a fresh binding', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    assert.strictEqual(resolveProjectTopology(tmpDir).reason, BINDING_UNBOUND);
    assert.strictEqual(readExistingLayout(), null, 'no file and no config.yaml means no layout');
    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: SPRINT_SAME }));
    const after = readLayoutFile(tmpDir);
    assert.ok(after.includes('system_requirements_store:') && after.includes('software_requirements_store:'));
    parseWithOracle(after, 'absent file');
  } finally {
    cleanup();
  }
});

test('the config.yaml fallback still works and reports no topology', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/legacy/only/kb"\nsprint_management_path: "."\n');
    const result = readExistingLayout();
    assert.ok(result, 'the FR265 config.yaml fallback must still answer');
    assert.strictEqual(result.knowledgebase.path, '/legacy/only/kb');
    assert.strictEqual(result.topology, null,
      'the fallback has no committed topology; `null` must be STATED, not left absent');
  } finally {
    cleanup();
  }
});

// ─── The divergence notice ───────────────────────────────────────────────────
console.log('\nThe divergence notice (AC4 — non-destructive, non-blocking, never silent)');

test('a legacy-only write over divergent stores names the preserved system store', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, CONF_STORE('ENG', 'Sys root', '11'), FS_STORE('.'));
    const existing = readExistingLayout();
    const out = capture(() => writeProjectLayoutYaml(legacyOnly(existing)));
    assert.ok(/DIFFERENT/.test(out), `the notice must say the stores differ, got: ${out}`);
    assert.ok(/system_requirements_store/.test(out), `the notice must name the record to edit, got: ${out}`);
    assert.ok(out.includes('ENG'), `the notice must show the preserved identity, got: ${out}`);
    assert.ok(/UNCHANGED/.test(out), `the notice must say what was left alone, got: ${out}`);
  } finally {
    cleanup();
  }
});

test('no notice is emitted for a non-divergent project', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    seedDivergent(tmpDir, FS_STORE('.'), FS_STORE('.'));
    const out = capture(() => writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(path.dirname(tmpDir), 'kb') },
      sprintManagement: SPRINT_SAME,
    }));
    assert.ok(!/UNCHANGED/.test(out), `a non-divergent project must not be warned at, got: ${out}`);
  } finally {
    cleanup();
  }
});

test('preservation does NOT bypass the non-destruction guard: an invalid file is still refused', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = writeFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: notion',
      '  path: "."',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const out = capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: SPRINT_SAME }));
    assert.ok(/Refusing to overwrite/.test(out), `the guard must still refuse, got: ${out}`);
    assert.strictEqual(readLayoutFile(tmpDir), before, 'the invalid file must be left byte-identical');
  } finally {
    cleanup();
  }
});

// ─── Display — never `undefined` ─────────────────────────────────────────────
console.log('\nDisplay — never the literal `undefined`, for any shape the schema accepts');

// Every valid store record shape, as raw fixture lines under a given key.
function storeShapes() {
  return [
    ['file-system same', ['  backend: file-system', '  mode: same', '  path: "."']],
    ['file-system local', ['  backend: file-system', '  mode: local', '  path: "../kb"']],
    ['file-system remote+gitUrl', ['  backend: file-system', '  mode: remote', '  path: "../kb"', '  gitUrl: "https://git.example.com/kb.git"']],
    ['file-system remote no gitUrl', ['  backend: file-system', '  mode: remote', '  path: "../kb"']],
    ['file-system no backend stated', ['  mode: local', '  path: "../kb"']],
    ['file-system empty mode/path', ['  backend: file-system', '  mode:', '  path:']],
    ['confluence full', ['  backend: confluence', '  space_key: "SPC"', '  root_page:', '    title: "T"', '    id: "1"']],
    ['confluence title only', ['  backend: confluence', '  space_key: "SPC"', '  root_page:', '    title: "T"']],
    ['confluence id only', ['  backend: confluence', '  space_key: "SPC"', '  root_page:', '    id: "1"']],
    ['confluence empty root_page', ['  backend: confluence', '  space_key: "SPC"', '  root_page:']],
    ['confluence no root_page', ['  backend: confluence', '  space_key: "SPC"']],
    ['confluence no space_key', ['  backend: confluence', '  root_page:', '    title: "T"']],
    ['confluence empty space_key', ['  backend: confluence', '  space_key:', '  root_page:', '    id: "1"']],
  ];
}

function sprintShapes() {
  return [
    ['sprint same', ['  mode: same', '  path: "."']],
    ['sprint local', ['  mode: local', '  path: "../sprint"']],
    ['sprint remote', ['  mode: remote', '  path: "../sprint"', '  gitUrl: "https://git.example.com/s.git"']],
    ['sprint jira', ['  mode: jira', '  jira_url: "https://jira.example.com"', '  jira_project_key: "PROJ"']],
    ['sprint jira empty fields', ['  mode: jira', '  jira_url:', '  jira_project_key:']],
    ['sprint missing entirely', null],
  ];
}

test('showCurrentLayout emits no `undefined` for any store shape, in either store position', () => {
  const shapes = storeShapes();
  let checked = 0;
  for (const [nameA, linesA] of shapes) {
    for (const [nameB, linesB] of [shapes[0], shapes[6]]) {
      const { tmpDir, cleanup } = withTmpDir();
      try {
        writeFixture(tmpDir, [
          'schema_version: 2',
          'generated: "2026-08-01"',
          'system_requirements_store:', ...linesA,
          'software_requirements_store:', ...linesB,
          'sprint_management:', '  mode: same', '  path: "."',
        ]);
        const out = capture(() => showCurrentLayout());
        assert.ok(!out.includes('undefined'),
          `system=[${nameA}] software=[${nameB}] rendered the literal "undefined":\n${out}`);
        assert.ok(out.includes('Current Repository Layout') || out.includes('binding is'),
          `expected real output for system=[${nameA}], got:\n${out}`);
        checked++;
      } finally {
        cleanup();
      }
    }
  }
  assert.strictEqual(checked, shapes.length * 2, `expected ${shapes.length * 2} renders, did ${checked}`);
});

test('showCurrentLayout emits no `undefined` for any sprint_management shape — including jira', () => {
  let checked = 0;
  for (const [name, lines] of sprintShapes()) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      writeFixture(tmpDir, [
        'schema_version: 2',
        'generated: "2026-08-01"',
        'system_requirements_store:', '  backend: file-system', '  mode: same', '  path: "."',
        'software_requirements_store:', '  backend: file-system', '  mode: same', '  path: "."',
        ...(lines ? ['sprint_management:', ...lines] : []),
      ]);
      const out = capture(() => showCurrentLayout());
      assert.ok(!out.includes('undefined'), `[${name}] rendered the literal "undefined":\n${out}`);
      // Not emitting `undefined` is necessary but not sufficient: the record's
      // real identity must actually be shown. A renderer that asked a jira sprint
      // record for a `path` would now print "not configured" instead of
      // `undefined` — still wrong, just quieter.
      if (name === 'sprint jira') {
        assert.ok(out.includes('https://jira.example.com'), `[${name}] must show the Jira URL:\n${out}`);
        assert.ok(out.includes('PROJ'), `[${name}] must show the Jira project key:\n${out}`);
        assert.ok(!/Path:/.test(out.split('Sprint Management:')[1] || ''),
          `[${name}] a jira sprint record has no path and must not claim one:\n${out}`);
      }
      checked++;
    } finally {
      cleanup();
    }
  }
  assert.strictEqual(checked, 6, `expected 6 sprint shapes, did ${checked}`);
});

test('a confluence store renders its backend, space key and root page', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:', '  backend: confluence', '  space_key: "ENG"',
      '  root_page:', '    title: "System Requirements"', '    id: "459201"',
      'software_requirements_store:', '  backend: confluence', '  space_key: "ENG"',
      '  root_page:', '    title: "System Requirements"', '    id: "459201"',
      'sprint_management:', '  mode: same', '  path: "."',
    ]);
    const out = capture(() => showCurrentLayout());
    assert.ok(out.includes('confluence'), `must name the backend: ${out}`);
    assert.ok(out.includes('ENG'), `must show the space key: ${out}`);
    assert.ok(out.includes('System Requirements'), `must show the root page title: ${out}`);
    assert.ok(out.includes('459201'), `must show the root page id: ${out}`);
  } finally {
    cleanup();
  }
});

test('an absent optional field renders as human words, not a primitive', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:', '  backend: confluence', '  space_key: "SPC"', '  root_page:',
      'software_requirements_store:', '  backend: confluence', '  space_key: "SPC"', '  root_page:',
      'sprint_management:', '  mode: same', '  path: "."',
    ]);
    const out = capture(() => showCurrentLayout());
    assert.ok(out.includes(IDENTITY_NOT_CONFIGURED), `expected "${IDENTITY_NOT_CONFIGURED}", got:\n${out}`);
    assert.ok(!/null/.test(out), `must not leak the literal null either:\n${out}`);
  } finally {
    cleanup();
  }
});

test('a file-system store renders byte-identically to the pre-fix format', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:', '  backend: file-system', '  mode: remote', '  path: "../kb"',
      '  gitUrl: "https://git.example.com/kb.git"',
      'software_requirements_store:', '  backend: file-system', '  mode: remote', '  path: "../kb"',
      '  gitUrl: "https://git.example.com/kb.git"',
      'sprint_management:', '  mode: same', '  path: "."',
    ]);
    const out = capture(() => showCurrentLayout());
    // The exact legacy spelling: `Mode:` and `Path:` padded to column 9,
    // `Git URL:` to the same column, under the single `Knowledgebase:` heading.
    assert.ok(out.includes('  Knowledgebase:'), `the non-divergent heading must be unchanged:\n${out}`);
    assert.ok(out.includes('    Mode:    remote'), `Mode line changed shape:\n${out}`);
    assert.ok(out.includes('    Git URL: https://git.example.com/kb.git'), `Git URL line changed shape:\n${out}`);
    assert.ok(out.includes('  Sprint Management:'), `the sprint heading must be unchanged:\n${out}`);
    assert.ok(!out.includes('System requirements store'),
      `a non-divergent project must NOT be split into two blocks:\n${out}`);
  } finally {
    cleanup();
  }
});

test('two-store output is legible when the stores differ: both blocks, each labelled', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:', '  backend: confluence', '  space_key: "ENG"',
      '  root_page:', '    title: "Sys"', '    id: "1"',
      'software_requirements_store:', '  backend: file-system', '  mode: same', '  path: "."',
      'sprint_management:', '  mode: same', '  path: "."',
    ]);
    const out = capture(() => showCurrentLayout());
    assert.ok(out.includes('System requirements store:'), `must label the system store:\n${out}`);
    assert.ok(out.includes('Software requirements store:'), `must label the software store:\n${out}`);
    assert.ok(out.indexOf('System requirements store:') < out.indexOf('Software requirements store:'),
      'system before software, matching the file order');
    assert.ok(!out.includes('Knowledgebase:'),
      `a divergent project must not hide one store behind the single legacy label:\n${out}`);
    // The FR257 giveaway: the confluence store's identity must be visible, and it
    // is the store the pre-fix renderer dropped entirely.
    assert.ok(out.includes('ENG'), `the confluence identity must be shown:\n${out}`);
  } finally {
    cleanup();
  }
});

// ─── The identity view is single-sourced against STORE_BACKENDS ──────────────
console.log('\nThe per-backend identity view is single-sourced against STORE_BACKENDS');

test('STORE_BACKEND_VIEWS names exactly the members of STORE_BACKENDS', () => {
  assert.deepStrictEqual(
    Object.keys(STORE_BACKEND_VIEWS).sort(),
    [...STORE_BACKENDS].sort(),
    'a backend with no identity view would be discovered when the renderer throws'
  );
});

test('DEFAULT_STORE_BACKEND is itself a member of STORE_BACKENDS', () => {
  assert.ok(STORE_BACKENDS.has(DEFAULT_STORE_BACKEND),
    `the "never stated" default ${DEFAULT_STORE_BACKEND} must be a legal backend`);
});

test('STORE_BACKEND_VIEWS is frozen, entries included', () => {
  assert.ok(Object.isFrozen(STORE_BACKEND_VIEWS));
  for (const [name, view] of Object.entries(STORE_BACKEND_VIEWS)) {
    assert.ok(Object.isFrozen(view), `${name}'s view must be frozen`);
  }
});

test('storeIdentityFields FAILS LOUD for a backend with no view — it does not degrade to the file-system shape', () => {
  let threw = null;
  try { storeIdentityFields({ backend: 'notion', path: '/somewhere' }); } catch (e) { threw = e; }
  assert.ok(threw, 'an unknown backend must throw, not silently render Mode/Path');
  assert.ok(/notion/.test(threw.message), `the message must name the offending backend: ${threw.message}`);
  assert.ok(/file-system/.test(threw.message) && /confluence/.test(threw.message),
    `the message must enumerate the legal backends: ${threw.message}`);
});

test('an absent or empty backend resolves to the stated default', () => {
  assert.strictEqual(backendOfStore({ mode: 'same', path: '.' }), DEFAULT_STORE_BACKEND);
  assert.strictEqual(backendOfStore({ backend: '', mode: 'same', path: '.' }), DEFAULT_STORE_BACKEND);
  assert.strictEqual(backendOfStore(null), DEFAULT_STORE_BACKEND);
  assert.strictEqual(backendOfStore({ backend: 'confluence' }), 'confluence');
});

test('renderIdentityValue is total and never yields the literal `undefined`', () => {
  const inputs = [undefined, null, '', 'x', 0, 1, false, true, {}, [], () => {}, Symbol('s'), 10n];
  for (const v of inputs) {
    let out;
    assert.doesNotThrow(() => { out = renderIdentityValue(v); }, `threw on ${String(typeof v)}`);
    assert.strictEqual(typeof out, 'string', `must return a string for ${String(typeof v)}`);
    assert.notStrictEqual(out, 'undefined', `rendered the literal "undefined" for ${String(typeof v)}`);
  }
  assert.strictEqual(renderIdentityValue(undefined), IDENTITY_NOT_CONFIGURED);
  assert.strictEqual(renderIdentityValue(null), IDENTITY_NOT_CONFIGURED);
  assert.strictEqual(renderIdentityValue(''), IDENTITY_NOT_CONFIGURED);
});

test('storesDiverge is field-exact for both backends', () => {
  // Same backend, same identity → not divergent.
  assert.strictEqual(storesDiverge(FS_STORE('.'), FS_STORE('.')), false);
  assert.strictEqual(storesDiverge(CONF_STORE('A', 'T', '1'), CONF_STORE('A', 'T', '1')), false);
  // Different backend → divergent.
  assert.strictEqual(storesDiverge(FS_STORE('.'), CONF_STORE('A', 'T', '1')), true);
  // One field apart → divergent, for every field.
  assert.strictEqual(storesDiverge(FS_STORE('/a'), FS_STORE('/b')), true);
  assert.strictEqual(storesDiverge({ backend: 'file-system', mode: 'same', path: '.' },
    { backend: 'file-system', mode: 'local', path: '.' }), true);
  assert.strictEqual(storesDiverge(
    { backend: 'file-system', mode: 'remote', path: '/a', gitUrl: 'https://x/1.git' },
    { backend: 'file-system', mode: 'remote', path: '/a', gitUrl: 'https://x/2.git' }), true,
    'a differing gitUrl is a divergence — it decides what gets cloned');
  assert.strictEqual(storesDiverge(CONF_STORE('A', 'T', '1'), CONF_STORE('B', 'T', '1')), true);
  assert.strictEqual(storesDiverge(CONF_STORE('A', 'T', '1'), CONF_STORE('A', 'U', '1')), true);
  assert.strictEqual(storesDiverge(CONF_STORE('A', 'T', '1'), CONF_STORE('A', 'T', '2')), true);
  // Absent and empty are the same "never configured" value.
  assert.strictEqual(storesDiverge(CONF_STORE('A', null, null), { backend: 'confluence', spaceKey: 'A', rootPage: {} }), false);
  assert.strictEqual(storesDiverge({ mode: 'same', path: '.' }, { backend: 'file-system', mode: 'same', path: '.' }), false,
    'an unstated backend is the default backend, not a divergence');
});

test('summarizeStoreIdentity describes a store by its OWN backend fields', () => {
  const conf = summarizeStoreIdentity(CONF_STORE('ENG', 'Root', '9'));
  assert.ok(conf.includes('confluence') && conf.includes('ENG') && conf.includes('Root') && conf.includes('9'), conf);
  assert.ok(!/Mode|Path/.test(conf), `a confluence store must not be described by Mode/Path: ${conf}`);
  const fsSummary = summarizeStoreIdentity(FS_STORE('/kb'));
  assert.ok(fsSummary.includes('Mode') && fsSummary.includes('/kb'), fsSummary);
  assert.ok(!/Git URL/.test(fsSummary), `an absent gitUrl must be omitted, not shown empty: ${fsSummary}`);
});

test('sprintIdentityFields discriminates jira from a path-backed sprint record', () => {
  const jira = sprintIdentityFields({ mode: 'jira', jiraUrl: 'https://j', jiraProjectKey: 'P' });
  assert.deepStrictEqual(jira.map((f) => f.label), ['Mode', 'Jira URL', 'Jira project key']);
  assert.ok(!jira.some((f) => f.label === 'Path'),
    'a jira sprint record has no path — asking for one is what printed `Path: undefined`');
  const fsSprint = sprintIdentityFields({ mode: 'local', path: '/s' });
  assert.deepStrictEqual(fsSprint.map((f) => f.label), ['Mode', 'Path', 'Git URL']);
});

// ─── B-1 — THE INSTALL PATH ITSELF ──────────────────────────────────────────
//
// Everything above drives `handleConfigLayout` or calls `writeProjectLayoutYaml`
// with a layout the TEST supplies. Nothing asserted that `install` passes one at
// all — and it did not: `bin/cli.js` read the committed binding only when
// `isUpdate` was true, i.e. only for the interactive "Update (add/remove skills)"
// menu choice, never for `--yes` and never on a fresh clone. So `ma-agents
// install --yes` over a committed Confluence binding replaced the software store
// with `file-system / same / "."`, and over a NON-divergent Confluence pair
// destroyed both stores with nothing printed at all.
//
// These four tests spawn the REAL CLI. That is deliberate and it is why they are
// slow (~50s each): the defect lived in one line of the install command's own
// body, so nothing short of running the install command can see it. In-process
// calls to `collectRepoLayout(flags, existing)` cannot — that is precisely the
// shape of the coverage that already existed and still missed this.
console.log('\nB-1 — the install path reads the committed binding (real `ma-agents install --yes`)');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const LAYOUT_ENV_KEYS = [
  'MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH', 'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL',
];

// Runs `node bin/cli.js install --yes` in `cwd` with the layout env vars cleared,
// so what reaches collectRepoLayout is the committed binding and nothing else.
//
// A timeout is a FAILURE here, not a skip. `spawnSync`'s own `timeout` option is
// used rather than a shell `timeout`, which would report SIGTERM/143 and read as
// a crash. A skip-on-timeout would make this assert nothing on exactly the runs
// where the install misbehaves.
function installYes(cwd) {
  const env = { ...process.env };
  for (const k of LAYOUT_ENV_KEYS) delete env[k];
  const res = spawnSync(process.execPath, [CLI_PATH, 'install', '--yes'], {
    cwd, env, encoding: 'utf-8', input: '', stdio: ['pipe', 'pipe', 'pipe'], timeout: 900000,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  assert.notStrictEqual(res.status, null,
    `\`install --yes\` did not exit within the timeout (signal ${res.signal}).\n${out.slice(-2000)}`);
  assert.strictEqual(res.status, 0, `\`install --yes\` exited ${res.status}.\n${out.slice(-2000)}`);
  return out;
}

testAsync('(a) `install --yes` preserves a DIVERGENT confluence pair byte-identically', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = seedDivergent(
      tmpDir,
      CONF_STORE('SYS', 'System Requirements', '1001'),
      CONF_STORE('SWE', 'Software Requirements', '2002')
    );
    installYes(tmpDir);
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `\`install --yes\` changed the committed binding.\nBEFORE:\n${before}\nAFTER:\n${after}`);
    const doc = parseWithOracle(after, 'install divergent');
    if (doc) {
      assert.strictEqual(doc.system_requirements_store.space_key, 'SYS');
      assert.strictEqual(doc.software_requirements_store.space_key, 'SWE',
        'the SOFTWARE store is the one the bare default used to overwrite');
      assert.strictEqual(doc.software_requirements_store.backend, 'confluence');
    }
  } finally {
    cleanup();
  }
});

testAsync('(b) `install --yes` preserves a NON-divergent confluence pair byte-identically', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // The silent case: the stores AGREE, so the divergence notice never fires and
    // grepping the whole install log for `confluence` / `space_key` returned
    // nothing — both stores were destroyed without a word.
    const before = seedDivergent(
      tmpDir, CONF_STORE('ENG', 'Requirements', '3003'), CONF_STORE('ENG', 'Requirements', '3003'));
    installYes(tmpDir);
    const after = readLayoutFile(tmpDir);
    assert.strictEqual(withoutGeneratedLine(after), withoutGeneratedLine(before),
      `\`install --yes\` destroyed a non-divergent confluence pair.\nBEFORE:\n${before}\nAFTER:\n${after}`);
    const doc = parseWithOracle(after, 'install non-divergent');
    if (doc) {
      assert.strictEqual(doc.system_requirements_store.space_key, 'ENG');
      assert.strictEqual(doc.software_requirements_store.space_key, 'ENG');
      assert.strictEqual(doc.system_requirements_store.backend, 'confluence');
      assert.strictEqual(doc.software_requirements_store.backend, 'confluence');
    }
  } finally {
    cleanup();
  }
});

testAsync('(c) `install --yes` keeps a LEGACY single-store project on its config.yaml path', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // FR265: a project with only the FR117 single `knowledgebase_path` and NO
    // project-layout.yaml is read as BOTH stores pointing at that one location.
    // Before B-1 this fallback was unreachable from `install`, so a `--yes`
    // reinstall reset the project to `same / "."` — moving where planning
    // artifacts resolve, which is the NFR82 breakage, not the NFR82 compliance.
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'),
      'project_name: legacy\nknowledgebase_path: "../legacy-kb"\nsprint_management_path: "."\n',
      'utf-8'
    );
    installYes(tmpDir);
    const after = readLayoutFile(tmpDir);
    const doc = parseWithOracle(after, 'install legacy single store');
    if (doc) {
      assert.strictEqual(doc.system_requirements_store.path, '../legacy-kb',
        `the legacy knowledgebase_path was reset instead of carried:\n${after}`);
      assert.strictEqual(doc.software_requirements_store.path, '../legacy-kb',
        `FR265 maps the one legacy location onto BOTH stores:\n${after}`);
      assert.strictEqual(doc.sprint_management.path, '.');
    }
    assert.ok(!/software_requirements_store:\n\s+backend: file-system\n\s+mode: same/.test(after),
      `the software store fell back to the bare single-repo default:\n${after}`);
    // NFR82: config.yaml keeps resolving artifacts where the project already
    // resolved them, rather than being reset to the local default.
    const cfg = fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    assert.ok(/knowledgebase_path:\s*"\.\.\/legacy-kb"/.test(cfg),
      `config.yaml's knowledgebase_path was reset:\n${cfg}`);
  } finally {
    cleanup();
  }
});

testAsync('(d) `install --yes` on a VIRGIN project still writes exactly the single-repo default', async () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // The other direction of the same change: reading unconditionally must not
    // invent a binding where there is none. readExistingLayout() returns null in
    // an empty directory, so collectRepoLayout still takes its default branch.
    assert.strictEqual(readExistingLayout(), null,
      'a virgin project must have NO existing layout — otherwise the default branch is unreachable');
    installYes(tmpDir);
    const after = readLayoutFile(tmpDir);
    const doc = parseWithOracle(after, 'install virgin');
    if (doc) {
      for (const key of ['system_requirements_store', 'software_requirements_store']) {
        assert.strictEqual(doc[key].backend, 'file-system', `${key} backend:\n${after}`);
        assert.strictEqual(doc[key].mode, 'same', `${key} mode:\n${after}`);
        assert.strictEqual(doc[key].path, '.', `${key} path:\n${after}`);
      }
      assert.strictEqual(doc.sprint_management.mode, 'same');
      assert.strictEqual(doc.sprint_management.path, '.');
    }
    assert.ok(!/confluence|space_key/.test(after), `a virgin project must not gain store fields:\n${after}`);
  } finally {
    cleanup();
  }
});

// ─── B-1 consequence 3 — the two consumers that now see a confluence store ───
//
// `writeRepoLayoutConfig` and `generateRepoLayoutSection` both read `.mode` /
// `.path`, which a confluence store has neither of. Before B-1 they never saw
// one on the install path (the store had already been collapsed to `{same, "."}`
// upstream). Neither crashed and neither emitted the literal `undefined` — both
// silently produced `.`, which is worse than a crash for the project-context
// section, because "- **Knowledgebase:** ." is a MISLEADING statement handed to
// every downstream agent.
//
// What `knowledgebase_path` SHOULD mean for a confluence-backed store is NOT
// decided here — it is filed as
// `_bmad-output/implementation-artifacts/
//  bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store.md`
// (Story 31.3 / 31.6). These tests pin the SAFE, EXPLICIT behaviour that stands
// until that question is answered, so it cannot drift silently.
console.log('\nB-1 consequence 3 — writeRepoLayoutConfig / generateRepoLayoutSection with a confluence store');

test('writeRepoLayoutConfig on a confluence store: no crash, no `undefined`, path unchanged, said out loud', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const out = capture(() => writeRepoLayoutConfig({
      knowledgebase: CONF_STORE('ENG', 'Requirements', '3003'),
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const cfg = fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    assert.ok(!/undefined/.test(cfg), `config.yaml must never contain the literal "undefined":\n${cfg}`);
    // NFR82: the VALUE is deliberately unchanged. knowledgebase_path is what
    // planning_artifacts is derived from and what the Knowledge Atlas config scan
    // reads, so moving it would move resolved artifact paths.
    assert.ok(/^knowledgebase_path: "\."$/m.test(cfg), `knowledgebase_path must stay ".":\n${cfg}`);
    assert.ok(/^planning_artifacts: "\{project-root\}\/_bmad-output\/planning-artifacts"$/m.test(cfg),
      `planning_artifacts must resolve exactly where it does today:\n${cfg}`);
    // Explicit, not accidental: the "." is a stand-in, and the user is told so.
    assert.ok(/confluence/.test(out), `the confluence backend must be named out loud:\n${out}`);
    assert.ok(/knowledgebase_path/.test(out), `the note must name the field it is talking about:\n${out}`);
    assert.ok(/project-layout\.yaml/.test(out),
      `the note must point at where the authoritative identity actually lives:\n${out}`);
  } finally {
    cleanup();
  }
});

test('writeRepoLayoutConfig on a file-system store is byte-for-byte unchanged and says nothing new', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const out = capture(() => writeRepoLayoutConfig({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const cfg = fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    assert.strictEqual(cfg, [
      '',
      'knowledgebase_path: "."',
      'sprint_backend: "file-system"',
      'sprint_management_path: "."',
      'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
      'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"',
      '',
    ].join('\n'), `the file-system config output changed:\n${JSON.stringify(cfg)}`);
    assert.ok(!/confluence|has no filesystem path/.test(out),
      `the non-file-system note must not fire for a file-system store:\n${out}`);
  } finally {
    cleanup();
  }
});

test('generateRepoLayoutSection names a confluence backend instead of rendering a bare "."', () => {
  const section = generateRepoLayoutSection({
    knowledgebase: CONF_STORE('ENG', 'Requirements', '3003'),
    sprintManagement: { mode: 'same', path: '.' },
  });
  assert.ok(section.includes('confluence'), `must name the backend: ${JSON.stringify(section)}`);
  assert.ok(!/undefined/.test(section), `must never emit the literal "undefined": ${JSON.stringify(section)}`);
  assert.ok(!section.includes('- **Knowledgebase:** .\n') && !/\*\*Knowledgebase:\*\* \.$/m.test(section),
    `a confluence store must not be described as the directory ".": ${JSON.stringify(section)}`);
  assert.ok(!section.includes('use the knowledgebase path'),
    `must not instruct agents to use a path this store does not have: ${JSON.stringify(section)}`);
  assert.ok(section.includes('project-layout.yaml'),
    `must point at where the authoritative identity lives: ${JSON.stringify(section)}`);
});

test('generateRepoLayoutSection is byte-for-byte unchanged for file-system layouts', () => {
  // Regression pin for the ternary the confluence branch was threaded through.
  // `test/generate-project-context.test.js` covers these shapes too; repeated
  // here because the branch that could break them was added in THIS change.
  assert.strictEqual(generateRepoLayoutSection({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  }), '', 'single-repo must still return the empty string');
  assert.strictEqual(generateRepoLayoutSection({
    knowledgebase: { mode: 'local', path: 'd:\\ext\\kb' },
    sprintManagement: { mode: 'same', path: '.' },
  }), [
    '<!-- ma-agents:repo-layout-start -->',
    '### Repository Layout',
    '- **Knowledgebase:** d:/ext/kb',
    '- **Sprint Management:** current repository (default)',
    '- When creating or reading planning artifacts, use the knowledgebase path',
    '<!-- ma-agents:repo-layout-end -->',
  ].join('\n'));
  // An explicit `backend: file-system` must behave exactly like an absent one.
  assert.strictEqual(
    generateRepoLayoutSection({
      knowledgebase: { backend: 'file-system', mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' },
    }),
    generateRepoLayoutSection({
      knowledgebase: { mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' },
    }),
    'stating the default backend must not change the rendering');
});

// ─── Summary ────────────────────────────────────────────────────────────────
//
// Two independent guards. The hard total below catches anything that stops tests
// running; the process-level backstop registered at the TOP of this file catches
// anything that stops the summary running. `process.exitCode` is set rather than
// `process.exit()` so the backstop's own listener still gets to run.
function printSummary() {
  const total = passed + failed;
  console.log(`\n${passed} passed, ${failed} failed`);
  summaryPrinted = true;
  if (!yamlOracle) {
    console.log('  NOTE: js-yaml did not resolve — oracle assertions degraded.');
  }
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
  }
  // Fail loud in BOTH directions. A suite that stops running tests must not
  // report success — this epic has already produced one that did.
  if (total !== EXPECTED_TEST_COUNT) {
    console.error(`\n  FATAL: ran ${total} tests, expected exactly ${EXPECTED_TEST_COUNT}. ` +
      `If you added or removed a test, update EXPECTED_TEST_COUNT.`);
    process.exitCode = 1;
  }
  if (failed > 0) process.exitCode = 1;
}

drainAsyncTests().then(printSummary, (err) => {
  // A rejection here means drainAsyncTests itself broke, not a test — its own
  // try/catch already converts per-test throws into recorded failures.
  console.error(`\n  FATAL: the async drain itself threw: ${(err && err.stack) || err}`);
  summaryPrinted = true;
  process.exitCode = 1;
});
