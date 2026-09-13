#!/usr/bin/env node
/**
 * Tests for BMad module selection plumbing.
 *
 * Bug fix: ma-agents previously hardcoded `['bmm']` in bin/cli.js's BMad
 * install/update calls, stranding the bundled `tea`, `bmb`, `cis`, `gds`
 * modules in the cache. These tests cover the helpers and flag parsing
 * that replace those literals with a wizard prompt + `--bmad-modules` CLI
 * flag.
 *
 * Coverage:
 *   - lib/bmad.getInstallableBmadModules() — manifest read, retired flag
 *   - lib/bmad.getInstalledBmadModules() — _bmad/<id>/ presence detection
 *   - lib/bmad.resolveBmadModules() — bmm-force, dedupe, validation
 *   - bin/cli.parseFlags(--bmad-modules ...) — CSV capture, default empty
 *
 * FR123 (amended 2026-08-02) then narrowed the DEFAULT install set from "every
 * non-retired bundled module" to bmm+tea+bmb+cis, leaving gds and wds bundled
 * but not installed unless asked for. The final section covers that, with the
 * expectation parsed out of the PRD shard rather than restated here — see the
 * long note above it for why a restated expectation is worth nothing.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];

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

async function testAsync(name, fn) {
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

// ─── The prompts stub ────────────────────────────────────────────────────────
//
// Installed in the require cache BEFORE cli.js is loaded, so cli.js's own
// `require('prompts')` (bin/cli.js:31) binds to it. Branch 2 of
// selectBmadModules — the bare `--bmad-modules` multiselect — is the ONLY
// branch that prompts, and without this seam it is unreachable from a test:
// every other case in this file passes `bmadModulesPrompt: false` and the
// branch is never executed.
//
// The default answer THROWS rather than returning `{}`. Returning `{}` would
// read back as `chosenModules === undefined` and drive cli.js into
// `process.exit(0)`, taking the whole suite down mid-run having reported
// nothing. Throwing turns an unexpected prompt into an ordinary named failure
// — and doubles as the assertion that the no-flag and `--yes` branches never
// prompt at all.
const promptsModulePath = require.resolve('prompts');
require('prompts');

function unexpectedPrompt(question) {
  const name = (question && question.name) || '(unnamed)';
  const message = (question && question.message) || '';
  throw new Error(
    `selectBmadModules asked a question this test did not expect — prompt ` +
    `${JSON.stringify(name)} (${JSON.stringify(message)}). Only the bare ` +
    `--bmad-modules branch may prompt.`
  );
}

let promptAnswer = unexpectedPrompt;
require.cache[promptsModulePath].exports = async function stubPrompts(question) {
  return promptAnswer(question);
};

const bmad = require('../lib/bmad');
const { parseFlags, selectBmadModules } = require('../bin/cli.js');
const { getBmadModules, setBmadModules } = require('../lib/profile');

// ─── getInstallableBmadModules ────────────────────────────────────────────────
console.log('\nlib/bmad.getInstallableBmadModules()');

test('returns a non-empty array', () => {
  const result = bmad.getInstallableBmadModules();
  assert.ok(Array.isArray(result), 'expected an array');
  assert.ok(result.length > 0, 'expected at least one module');
});

test('every entry has id, retired, and description', () => {
  const result = bmad.getInstallableBmadModules();
  for (const m of result) {
    assert.strictEqual(typeof m.id, 'string', `id should be string, got ${typeof m.id}`);
    assert.strictEqual(typeof m.retired, 'boolean', `retired should be boolean, got ${typeof m.retired}`);
    assert.strictEqual(typeof m.description, 'string', `description should be string, got ${typeof m.description}`);
  }
});

test('includes bmm (the BMad core)', () => {
  const result = bmad.getInstallableBmadModules();
  const ids = result.map(m => m.id);
  assert.ok(ids.includes('bmm'), `bmm must be present, got: ${ids.join(', ')}`);
});

test('wds surfaces as an ACTIVE (non-retired) bundled module', () => {
  // wds is one of the five KNOWN_BUNDLED_MODULES (tea/bmb/cis/gds/wds) and has
  // been ACTIVE since Epic 27 — it is NOT retiredUpstream. The cache-manifest
  // wds entry carries no retiredUpstream marker, so when wds is present it must
  // report non-retired. (Corrected from a stale assertion that wrongly expected
  // wds.retired === true; the old assertion failed identically on main.)
  const result = bmad.getInstallableBmadModules();
  const wds = result.find(m => m.id === 'wds');
  // wds may or may not be in cache depending on manifest state — only assert
  // when present.
  if (wds) {
    assert.notStrictEqual(wds.retired, true, 'wds is an active bundled module, not retiredUpstream');
  }
});

test('non-retired modules surface tea, bmb, cis, gds when present', () => {
  const result = bmad.getInstallableBmadModules();
  const nonRetiredIds = result.filter(m => !m.retired).map(m => m.id);
  // bmm is always non-retired
  assert.ok(nonRetiredIds.includes('bmm'), 'bmm must be in non-retired list');
});

// ─── getInstalledBmadModules ──────────────────────────────────────────────────
console.log('\nlib/bmad.getInstalledBmadModules()');

test('returns empty array when projectRoot has no _bmad/ directory', () => {
  // Use a temp dir that definitely has no _bmad/
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-bmad-test-'));
  try {
    const result = bmad.getInstalledBmadModules(tmp);
    assert.deepStrictEqual(result, [], `expected empty array, got: ${JSON.stringify(result)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('returns empty array for falsy projectRoot', () => {
  assert.deepStrictEqual(bmad.getInstalledBmadModules(''), []);
  assert.deepStrictEqual(bmad.getInstalledBmadModules(null), []);
  assert.deepStrictEqual(bmad.getInstalledBmadModules(undefined), []);
});

test('detects installed modules from _bmad/<id>/ directories', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-bmad-test-'));
  try {
    fs.mkdirSync(path.join(tmp, '_bmad', 'bmm'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '_bmad', 'tea'), { recursive: true });
    const result = bmad.getInstalledBmadModules(tmp);
    assert.ok(result.includes('bmm'), `expected bmm in: ${result.join(', ')}`);
    assert.ok(result.includes('tea'), `expected tea in: ${result.join(', ')}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a stray FILE named _bmad/<id> does not count as an installed module', () => {
  // Reviewer probe P4. The probe is documented as detecting
  // "`_bmad/<id>/` DIRECTORIES" and its result feeds branch 3b of
  // selectBmadModules, where it is treated as the user's own module selection
  // and then PERSISTED. `fs.existsSync` answers yes for a regular file, so a
  // stray `_bmad/wds` file was enough to make the probe report wds installed —
  // and the persisted record would then carry it forever.
  // `prePopulateBmadCache` checks `stat.isDirectory()` in the analogous place
  // (lib/bmad.js, the cache-source walk); this matches it.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-bmad-test-'));
  try {
    fs.mkdirSync(path.join(tmp, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '_bmad', 'wds'), 'not a module, just a file\n');
    const result = bmad.getInstalledBmadModules(tmp);
    assert.ok(result.includes('bmm'), `expected bmm in: ${result.join(', ')}`);
    assert.ok(!result.includes('wds'),
      `a regular file named _bmad/wds is not an installed module, got: ${result.join(', ')}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ignores _bmad/<id>/ entries that are not in the cache manifest', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-bmad-test-'));
  try {
    fs.mkdirSync(path.join(tmp, '_bmad', 'bmm'), { recursive: true });
    // _bmad/notamodule/ should not show up — only manifest-listed ids
    fs.mkdirSync(path.join(tmp, '_bmad', 'notamodule'), { recursive: true });
    const result = bmad.getInstalledBmadModules(tmp);
    assert.ok(result.includes('bmm'));
    assert.ok(!result.includes('notamodule'), `unexpected notamodule in: ${result.join(', ')}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── resolveBmadModules ───────────────────────────────────────────────────────
console.log('\nlib/bmad.resolveBmadModules()');

const FAKE_AVAILABLE = [
  { id: 'bmm' },
  { id: 'tea' },
  { id: 'bmb' },
  { id: 'cis' },
  { id: 'gds' },
];

test('forces bmm when not in requested list', () => {
  const result = bmad.resolveBmadModules({
    requested: ['tea', 'bmb'],
    available: FAKE_AVAILABLE,
  });
  assert.ok(result.includes('bmm'), `bmm must be force-added, got: ${result.join(', ')}`);
  assert.ok(result.includes('tea'));
  assert.ok(result.includes('bmb'));
});

test('preserves bmm in original position when explicitly requested', () => {
  const result = bmad.resolveBmadModules({
    requested: ['bmm', 'tea'],
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea']);
});

test('prepends bmm when requested list omits it', () => {
  const result = bmad.resolveBmadModules({
    requested: ['tea'],
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea']);
});

test('returns just [bmm] for empty requested list', () => {
  const result = bmad.resolveBmadModules({
    requested: [],
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm']);
});

test('dedupes repeated module ids', () => {
  const result = bmad.resolveBmadModules({
    requested: ['bmm', 'tea', 'tea', 'bmm', 'bmb'],
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea', 'bmb']);
});

test('trims whitespace in requested ids', () => {
  const result = bmad.resolveBmadModules({
    requested: [' tea ', '  bmb'],
    available: FAKE_AVAILABLE,
  });
  assert.ok(result.includes('tea'));
  assert.ok(result.includes('bmb'));
});

test('throws on unknown module id with helpful message', () => {
  assert.throws(
    () => bmad.resolveBmadModules({
      requested: ['nonsense'],
      available: FAKE_AVAILABLE,
    }),
    /Unknown BMAD module\(s\): nonsense\. Available: bmm, tea, bmb, cis, gds/
  );
});

test('throws on missing ctx', () => {
  assert.throws(() => bmad.resolveBmadModules(), /resolveBmadModules requires ctx/);
});

test('throws on non-array requested', () => {
  assert.throws(
    () => bmad.resolveBmadModules({ requested: 'tea', available: FAKE_AVAILABLE }),
    /resolveBmadModules requires ctx/
  );
});

test('throws on non-array available', () => {
  assert.throws(
    () => bmad.resolveBmadModules({ requested: ['tea'], available: null }),
    /resolveBmadModules requires ctx/
  );
});

// ─── parseFlags(--bmad-modules) ───────────────────────────────────────────────
console.log('\nbin/cli.parseFlags(--bmad-modules ...)');

test('captures --bmad-modules CSV value', () => {
  const result = parseFlags(['--bmad-modules', 'bmm,tea,bmb']);
  assert.strictEqual(result.bmadModulesFlag, 'bmm,tea,bmb');
  assert.strictEqual(result.bmadModulesPrompt, false);
  assert.deepStrictEqual(result.positional, []);
});

test('captures --bmad-modules even with --yes and --agent present', () => {
  const result = parseFlags(['--yes', '--agent', 'claude-code', '--bmad-modules', 'tea,bmb']);
  assert.strictEqual(result.yesFlag, true);
  assert.strictEqual(result.agentFlag, 'claude-code');
  assert.strictEqual(result.bmadModulesFlag, 'tea,bmb');
  assert.strictEqual(result.bmadModulesPrompt, false);
  assert.deepStrictEqual(result.positional, []);
});

test('defaults bmadModulesFlag and bmadModulesPrompt when omitted', () => {
  const result = parseFlags(['--yes']);
  assert.strictEqual(result.bmadModulesFlag, '');
  assert.strictEqual(result.bmadModulesPrompt, false);
});

test('does not consume non-flag positional args', () => {
  const result = parseFlags(['skill-id', '--bmad-modules', 'tea', 'claude-code']);
  assert.strictEqual(result.bmadModulesFlag, 'tea');
  assert.deepStrictEqual(result.positional, ['skill-id', 'claude-code']);
});

test('bare --bmad-modules (end of args) → bmadModulesPrompt=true, no CSV', () => {
  const result = parseFlags(['--yes', '--bmad-modules']);
  assert.strictEqual(result.bmadModulesPrompt, true);
  assert.strictEqual(result.bmadModulesFlag, '');
  assert.deepStrictEqual(result.positional, []);
});

test('bare --bmad-modules followed by another flag → bmadModulesPrompt=true', () => {
  const result = parseFlags(['--bmad-modules', '--yes']);
  assert.strictEqual(result.bmadModulesPrompt, true);
  assert.strictEqual(result.bmadModulesFlag, '');
  assert.strictEqual(result.yesFlag, true);
  assert.deepStrictEqual(result.positional, []);
});

test('bare --bmad-modules at end with --agent before is still a prompt', () => {
  const result = parseFlags(['--agent', 'claude-code', '--bmad-modules']);
  assert.strictEqual(result.agentFlag, 'claude-code');
  assert.strictEqual(result.bmadModulesPrompt, true);
  assert.strictEqual(result.bmadModulesFlag, '');
});

// ─── Integration: --bmad-modules → resolveBmadModules pipeline ────────────────
console.log('\nIntegration: --bmad-modules → resolveBmadModules');

test('CSV from --bmad-modules survives into resolveBmadModules', () => {
  const flags = parseFlags(['--bmad-modules', 'tea,bmb']);
  const requested = flags.bmadModulesFlag.split(',').map(s => s.trim()).filter(Boolean);
  const result = bmad.resolveBmadModules({
    requested,
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea', 'bmb']);
});

test('CSV with whitespace from --bmad-modules normalises correctly', () => {
  const flags = parseFlags(['--bmad-modules', 'tea, bmb ,gds']);
  const requested = flags.bmadModulesFlag.split(',').map(s => s.trim()).filter(Boolean);
  const result = bmad.resolveBmadModules({
    requested,
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea', 'bmb', 'gds']);
});

// ─── lib/bmad.ensureCacheMarker (3.12.2 offline fallback) ─────────────────────

(async () => {
  console.log('\nlib/bmad.ensureCacheMarker()');

  await testAsync('writes .bmad-channel.json with stable channel + branch + sha', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-marker-test-'));
    try {
      const wrote = await bmad.ensureCacheMarker(tmp, {
        branch: 'main',
        commitSha: 'abc123def456',
      });
      assert.strictEqual(wrote, true, 'should report it wrote the marker');
      const markerPath = path.join(tmp, '.bmad-channel.json');
      assert.ok(fs.existsSync(markerPath), 'marker file should exist on disk');
      const parsed = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      assert.strictEqual(parsed.channel, 'stable', 'channel must be stable');
      assert.strictEqual(parsed.version, 'main', 'version mirrors manifest branch');
      assert.strictEqual(parsed.sha, 'abc123def456', 'sha mirrors manifest commitSha');
      assert.ok(parsed.writtenAt, 'writtenAt timestamp present');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('does NOT overwrite an existing marker', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-marker-test-'));
    try {
      const markerPath = path.join(tmp, '.bmad-channel.json');
      const original = { channel: 'next', version: 'v9.9.9', sha: 'preserved-sha' };
      fs.writeFileSync(markerPath, JSON.stringify(original));
      const wrote = await bmad.ensureCacheMarker(tmp, {
        branch: 'main',
        commitSha: 'should-not-clobber',
      });
      assert.strictEqual(wrote, false, 'should report it did NOT write');
      const after = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      assert.deepStrictEqual(after, original, 'existing marker is preserved verbatim');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('returns false when manifest entry is missing', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-marker-test-'));
    try {
      const wrote = await bmad.ensureCacheMarker(tmp, null);
      assert.strictEqual(wrote, false);
      assert.strictEqual(fs.existsSync(path.join(tmp, '.bmad-channel.json')), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('returns false when manifest entry has no commitSha', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-marker-test-'));
    try {
      const wrote = await bmad.ensureCacheMarker(tmp, { branch: 'main' });
      assert.strictEqual(wrote, false);
      assert.strictEqual(fs.existsSync(path.join(tmp, '.bmad-channel.json')), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('falls back to "main" version when manifest has no branch', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-marker-test-'));
    try {
      const wrote = await bmad.ensureCacheMarker(tmp, { commitSha: 'sha-only' });
      assert.strictEqual(wrote, true);
      const parsed = JSON.parse(fs.readFileSync(path.join(tmp, '.bmad-channel.json'), 'utf8'));
      assert.strictEqual(parsed.version, 'main');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ─── Bug 27.13 — durable BMAD module selection ──────────────────────────────

  await testAsync('27.13 setBmadModules/getBmadModules round-trip', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-27-13-'));
    try {
      assert.strictEqual(getBmadModules(tmp), undefined, 'undefined before any persist');
      setBmadModules(tmp, ['bmm', 'tea', 'bmb', 'cis', 'wds']);
      assert.deepStrictEqual(getBmadModules(tmp), ['bmm', 'tea', 'bmb', 'cis', 'wds']);
      // Persisting preserves an existing profile field.
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, '.ma-agents.json'), 'utf8'));
      assert.ok('bmadModules' in manifest);
      // Bug 27.12 — root manifest is a profile/settings store; it must NOT carry
      // a skills map. The scope discriminator marks its role.
      assert.ok(!('skills' in manifest), 'root manifest must not carry a skills map');
      assert.strictEqual(manifest.scope, 'project-root');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('27.13 selectBmadModules persists explicit CSV selection', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-27-13-'));
    try {
      const result = await selectBmadModules({ bmadModulesFlag: 'tea,bmb', projectRoot: tmp });
      assert.ok(result.includes('bmm'), 'bmm force-included');
      assert.ok(result.includes('tea') && result.includes('bmb'));
      assert.ok(!result.includes('gds'), 'gds was not requested');
      // The selection is now durable.
      const persisted = getBmadModules(tmp);
      assert.ok(persisted.includes('tea') && persisted.includes('bmb') && !persisted.includes('gds'),
        'CSV selection must be persisted to .ma-agents.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('27.13 deselected module stays absent on a second no-flag run', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-27-13-'));
    try {
      // First run: user deselects gds via CSV (omits it).
      const first = await selectBmadModules({ bmadModulesFlag: 'bmm,tea,bmb,cis,wds', projectRoot: tmp });
      assert.ok(!first.includes('gds'), 'gds deselected in first run');

      // Second run: NO flag passed. Without persistence this returned ALL
      // installable modules (gds would return). With 27.13 it honors the
      // persisted set.
      const second = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!second.includes('gds'), 'deselected gds must NOT resurface on a no-flag run');
      assert.ok(second.includes('bmm'), 'bmm still present');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ─── FR123 (amended 2026-08-02) — the DEFAULT INSTALL SET ───────────────────
  //
  // WHY THE ORACLE IS PARSED OUT OF THE PRD AND NOT WRITTEN DOWN HERE.
  //
  // The assertion this section replaces was, in effect,
  // `deepStrictEqual(selectBmadModules(), getInstallableBmadModules())` — the
  // test asked the code what the answer was and then checked the code against
  // its own answer. It passed for every possible default set, which is why
  // `wds` reached a Copilot+Cline user's project root as a five-folder
  // `design-artifacts/` tree with a green suite standing behind it.
  //
  // The oracle below is the requirement itself, read from the PRD shard at
  // runtime. The PRD is authored by the PM, lives outside `lib/` and `bin/`,
  // and nothing in the product reads it — so it cannot be edited by a change to
  // the implementation, and the expectation cannot drift into agreement with a
  // wrong default. Change `DEFAULT_BMAD_MODULE_IDS` without changing FR123 and
  // these tests go red; that is the whole point of the arrangement.
  //
  // The parser takes MEMBERSHIP from the PRD prose. The CANDIDATE UNIVERSE (the
  // ids it is willing to recognise) comes from the bundle, because prose has no
  // other way to be tokenised — but a module the PRD does not name is never
  // admitted, so the direction that matters is not derived from the code.

  const PRD_SHARD = path.join(
    __dirname, '..', '_bmad-output', 'planning-artifacts', 'prd',
    'capabilities', 'bmad-integration-and-bundling.md'
  );

  function readFrLine(id) {
    const text = fs.readFileSync(PRD_SHARD, 'utf8');
    const line = text.split(/\r?\n/).find(l => l.trim().startsWith(`- ${id}:`));
    assert.ok(line, `${id} not found in ${PRD_SHARD} — the oracle for this suite is missing`);
    return line;
  }

  // Every module id this bundle knows about — the tokens the parser may find.
  const BUNDLED_IDS = bmad.getInstallableBmadModules().map(m => m.id);

  function idsIn(span) {
    return BUNDLED_IDS.filter(id => new RegExp(`\\b${id}\\b`).test(span));
  }

  // Same membership, but in the order the PRD PROSE names them rather than the
  // order the bundle happens to enumerate. `idsIn` above filters BUNDLED_IDS,
  // so its order comes from the cache manifest — i.e. from the code — and can
  // never contradict a reordered DEFAULT_BMAD_MODULE_IDS. This one can: the
  // sequence is read out of FR123's sentence.
  function idsInOrder(span) {
    const re = new RegExp(`\\b(${BUNDLED_IDS.join('|')})\\b`, 'g');
    const found = [];
    let m;
    while ((m = re.exec(span)) !== null) {
      if (!found.includes(m[1])) found.push(m[1]);
    }
    return found;
  }

  /** The set FR123 names as the default INSTALL set. */
  function fr123DefaultSet() {
    const fr123 = readFrLine('FR123');

    // Guard against a stale PRD: if the pre-amendment wording is still there,
    // the oracle is not the one this suite exists to enforce and every
    // assertion below would be meaningless.
    assert.ok(
      !/default install set is \*\*every non-retired module\*\*/.test(fr123),
      'FR123 still carries the pre-amendment "every non-retired module" default — ' +
      'the PRD amendment this suite depends on has been reverted'
    );

    const span = fr123.match(
      /the default install set is (.*?) from the bundled cache manifest/
    );
    assert.ok(span, 'FR123 no longer states the default install set in a parseable form');
    const found = idsIn(span[1]);
    assert.ok(found.length >= 2,
      `FR123's default-set clause named ${found.length} known module(s) — parser is not matching`);
    return found;
  }

  /**
   * The same set, in FR123's own written order — the oracle for the ORDER of
   * the emitted `--modules` value (NFR21 determinism), which every other
   * assertion in this file sorts away.
   */
  function fr123DefaultOrder() {
    const fr123 = readFrLine('FR123');
    const span = fr123.match(
      /the default install set is (.*?) from the bundled cache manifest/
    );
    assert.ok(span, 'FR123 no longer states the default install set in a parseable form');
    const found = idsInOrder(span[1]);
    assert.deepStrictEqual([...found].sort(), [...fr123DefaultSet()].sort(),
      'the ordered and unordered parsers disagree about FR123 membership');
    return found;
  }

  /** The modules FR123 names as bundled-but-not-default. */
  function fr123NonDefaultSet() {
    const fr123 = readFrLine('FR123');
    const span = fr123.match(
      /The two design-studio modules (.*?) are \*\*bundled but not installed by default\*\*/
    );
    assert.ok(span, 'FR123 no longer states the bundled-but-not-default modules in a parseable form');
    const found = idsIn(span[1]);
    assert.strictEqual(found.length, 2,
      `FR123 says "the two design-studio modules" but named ${found.length}: ${found.join(', ')}`);
    return found;
  }

  await testAsync('AC1 a fresh no-flag install resolves exactly the set FR123 names', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-'));
    try {
      const expected = fr123DefaultSet();
      const result = await selectBmadModules({ projectRoot: tmp });
      assert.deepStrictEqual([...result].sort(), [...expected].sort(),
        `a fresh default install must resolve exactly FR123's default set ` +
        `(${expected.join(', ')}), got ${result.join(', ')}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync("AC1 the shipped DEFAULT_BMAD_MODULE_IDS constant is FR123's set", async () => {
    // Same oracle, applied one layer lower: catches a divergence between the
    // constant and what selectBmadModules actually hands to bmad-method.
    assert.deepStrictEqual(
      [...bmad.DEFAULT_BMAD_MODULE_IDS].sort(),
      [...fr123DefaultSet()].sort()
    );
    assert.deepStrictEqual(
      [...bmad.NON_DEFAULT_BMAD_MODULE_IDS].sort(),
      [...fr123NonDefaultSet()].sort()
    );
  });

  await testAsync('AC1 every bundled module is either default or explicitly non-default', async () => {
    // Closes the gap a two-set check leaves open: a newly bundled module that
    // FR123 classifies neither way would otherwise slip through unnoticed —
    // exactly the silent growth the old "everything in the manifest" default
    // produced.
    const classified = [...fr123DefaultSet(), ...fr123NonDefaultSet()].sort();
    const installable = bmad.getInstallableBmadModules()
      .filter(m => !m.retired).map(m => m.id).sort();
    assert.deepStrictEqual(classified, installable,
      'a bundled module is not classified by FR123 (or FR123 names one that is not bundled)');
  });

  await testAsync('AC2 no module in the default set scaffolds design-artifacts/', async () => {
    // The `design-artifacts/` tree is materialised by upstream's
    // createModuleDirectories() from a module.yaml `directories:` block. Check
    // the declaration, which is the actual cause, rather than the module name.
    const cacheRoot = path.join(__dirname, '..', 'lib', 'bmad-cache');

    function directoriesBlock(id) {
      for (const rel of [path.join(id, 'src', 'module.yaml'), path.join(id, 'skills', 'module.yaml')]) {
        const p = path.join(cacheRoot, rel);
        if (fs.existsSync(p)) {
          const m = fs.readFileSync(p, 'utf8').match(/^directories:\r?\n((?:[ \t]+-[ \t]+.*\r?\n)+)/m);
          return m ? m[1] : '';
        }
      }
      return ''; // bmm ships inside bmad-method, not in the bundled cache
    }

    const scaffolders = bmad.getInstallableBmadModules()
      .map(m => m.id)
      .filter(id => /design_artifacts|design-artifacts/.test(directoriesBlock(id)));

    // Teeth: if nothing in the bundle declares it, the filter above proves
    // nothing and the assertion below would pass vacuously.
    assert.ok(scaffolders.length > 0,
      'no bundled module declares a design-artifacts directory — the AC2 check has no teeth');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-'));
    try {
      const resolved = await selectBmadModules({ projectRoot: tmp });
      const offenders = resolved.filter(id => scaffolders.includes(id));
      assert.deepStrictEqual(offenders, [],
        `a default install resolves ${offenders.join(', ')}, which scaffold design-artifacts/`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 --yes with no --bmad-modules lands on the default set, prompt-free', async () => {
    // Drives the real flag parser with the real non-interactive argv, then
    // feeds exactly what the installer feeds selectBmadModules (bin/cli.js
    // Step 3.5). Targeted on purpose: test/yes-flag.test.js drives a full
    // install and dirties hundreds of paths.
    const flags = parseFlags(['install', '--yes', '--force']);
    assert.strictEqual(flags.yesFlag, true);
    assert.strictEqual(flags.bmadModulesFlag, '', '--yes must not synthesise a module CSV');
    assert.strictEqual(flags.bmadModulesPrompt, false,
      '--yes must not reach the multiselect branch — that branch is the only one that prompts');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-yes-'));
    try {
      const result = await selectBmadModules({
        bmadModulesFlag: flags.bmadModulesFlag,
        bmadModulesPrompt: flags.bmadModulesPrompt,
        projectRoot: tmp,
      });
      assert.deepStrictEqual([...result].sort(), [...fr123DefaultSet()].sort(),
        "--yes must resolve FR123's default set");
      assert.deepStrictEqual([...getBmadModules(tmp)].sort(), [...fr123DefaultSet()].sort(),
        'the --yes resolution is persisted like any other');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ─── Branch 2 — the bare `--bmad-modules` multiselect ───────────────────────
  //
  // WHY THIS SECTION EXISTS. Branch 2 had no behavioural coverage at all:
  // `bmadModulesPrompt` was asserted only inside the parseFlags tests, and every
  // call into selectBmadModules passed it `false`. Changing the initial check
  // state at bin/cli.js from `selected: isCore || defaultIds.has(m.id)` back to
  // `selected: true` left this suite at 46 passed / 0 failed — and
  // `selected: true` is LITERALLY the pre-change value, so a careless revert or
  // a bad merge silently restores "installs everything", the regression this
  // whole change exists to remove.
  //
  // Both halves of FR123's claim about this prompt are pinned here, because
  // both were unverified: the initial check state IS the default set, and every
  // bundled module is STILL OFFERED — the second is what FR123's air-gap
  // argument rests on ("they remain fully available offline through the
  // `--bmad-modules` multiselect").

  await testAsync('AC4 bare --bmad-modules pre-checks exactly FR123 default set, bmm forced', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-multi-'));
    const asked = [];
    try {
      // Answer by confirming whatever the prompt arrived pre-checked with —
      // i.e. the user pressing Enter and touching nothing, which is the case
      // FR123 says must land on the same modules as the no-flag branch.
      promptAnswer = (question) => {
        asked.push(question);
        return { chosenModules: question.choices.filter(c => c.selected).map(c => c.value) };
      };

      const flags = parseFlags(['install', '--bmad-modules']);
      assert.strictEqual(flags.bmadModulesPrompt, true, 'bare flag must reach branch 2');
      assert.strictEqual(flags.bmadModulesFlag, '');

      const result = await selectBmadModules({
        bmadModulesFlag: flags.bmadModulesFlag,
        bmadModulesPrompt: flags.bmadModulesPrompt,
        projectRoot: tmp,
      });

      assert.strictEqual(asked.length, 1, 'branch 2 must ask exactly one question');
      const question = asked[0];
      assert.strictEqual(question.type, 'multiselect');

      const expectedChecked = [...new Set(['bmm', ...fr123DefaultOrder()])];
      const preChecked = question.choices.filter(c => c.selected).map(c => c.value);
      assert.deepStrictEqual([...preChecked].sort(), [...expectedChecked].sort(),
        `the multiselect must arrive pre-checked with FR123's default set ` +
        `(${expectedChecked.join(', ')}), got ${preChecked.join(', ')} — ` +
        `pre-checking everything is the pre-change "installs everything" default`);

      // Pressing Enter changes nothing, so branch 2 and branch 3 agree.
      assert.deepStrictEqual([...result].sort(), [...fr123DefaultSet()].sort(),
        'a no-op confirmation must resolve exactly what the no-flag branch resolves');
    } finally {
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 bare --bmad-modules still OFFERS every bundled module (the air-gap half)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-offer-'));
    const asked = [];
    try {
      promptAnswer = (question) => {
        asked.push(question);
        return { chosenModules: ['bmm'] };
      };

      await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      assert.strictEqual(asked.length, 1);

      // The oracle is FR123's two classifications, not the bundle: a module the
      // PRD names must be offered, whatever the code enumerates.
      const classified = [...fr123DefaultOrder(), ...fr123NonDefaultSet()];
      const offered = asked[0].choices.map(c => c.value);
      assert.deepStrictEqual([...offered].sort(), [...classified].sort(),
        `every module FR123 classifies — default and non-default alike — must be ` +
        `offered by the multiselect; got ${offered.join(', ')}`);

      // Teeth: the offer set must be STRICTLY LARGER than the check set, or
      // "still offered" says nothing. This is what keeps gds/wds reachable
      // offline once the default no longer installs them.
      const preChecked = asked[0].choices.filter(c => c.selected).map(c => c.value);
      assert.ok(offered.length > preChecked.length,
        `the multiselect offers ${offered.length} module(s) and pre-checks ` +
        `${preChecked.length} — nothing is reachable that the default does not already install`);

      for (const id of fr123NonDefaultSet()) {
        assert.ok(offered.includes(id),
          `${id} is bundled-but-not-default: it must still be OFFERED`);
        assert.ok(!preChecked.includes(id),
          `${id} is bundled-but-not-default: it must NOT be pre-checked`);
      }
    } finally {
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC3 an explicit --bmad-modules selection naming wds still wins', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-wds-'));
    try {
      const flags = parseFlags(['install', '--bmad-modules', 'wds', '--yes']);
      assert.strictEqual(flags.bmadModulesFlag, 'wds');
      const result = await selectBmadModules({
        bmadModulesFlag: flags.bmadModulesFlag,
        bmadModulesPrompt: flags.bmadModulesPrompt,
        projectRoot: tmp,
      });
      assert.deepStrictEqual(result, ['bmm', 'wds'],
        'an explicit selection overrides the default, bmm force-included');

      // The literal argv the installer hands to bmad-method.
      const cmd = bmad.buildBmadArgs({
        projectRoot: tmp,
        modules: result,
        tools: ['claude-code'],
      });
      assert.ok(/--modules bmm,wds\b/.test(cmd),
        `the bmad-method command must carry --modules bmm,wds, got: ${cmd}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC3 selecting a non-default module still installs it from the bundle, offline', async () => {
    // NOT "the cache directory contains a wds folder". This runs the installer's
    // real cache-staging step — lib/bmad.prePopulateBmadCache(), the step that
    // makes an air-gapped install possible — with HOME redirected at a temp
    // directory, and then asserts the selected module arrived with a usable
    // payload. No network is reachable from that function: it is fs copy only.
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-home-'));
    const realHomedir = os.homedir;
    try {
      os.homedir = () => tmpHome;
      await bmad.prePopulateBmadCache();
      const staged = path.join(tmpHome, '.bmad', 'cache', 'external-modules');

      for (const id of bmad.NON_DEFAULT_BMAD_MODULE_IDS) {
        const modDir = path.join(staged, id);
        assert.ok(fs.existsSync(modDir),
          `${id} is bundled-but-not-default; it must still stage for an offline install`);
        const payload = fs.readdirSync(modDir).filter(e => !e.startsWith('.'));
        assert.ok(payload.length > 0, `${id} staged as an empty directory — not installable`);
      }

      // And the same step stages the default set, so this is not an assertion
      // that everything trivially lands.
      for (const id of bmad.DEFAULT_BMAD_MODULE_IDS.filter(m => m !== 'bmm')) {
        assert.ok(fs.existsSync(path.join(staged, id)), `${id} must stage too`);
      }
    } finally {
      os.homedir = realHomedir;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  await testAsync('AC6 a project that already has wds keeps it on a no-flag re-run', async () => {
    // Non-destructive migration. The narrowed default applies to NEW installs;
    // an update run over an existing project passes this same resolved list to
    // bmad.updateBmad, so dropping wds here is how an existing user would lose
    // it. This project predates bug 27.13's persistence — `_bmad/` on disk is
    // the only record of what was chosen.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-existing-'));
    try {
      for (const id of ['bmm', 'tea', 'bmb', 'cis', 'gds', 'wds']) {
        fs.mkdirSync(path.join(tmp, '_bmad', id), { recursive: true });
      }
      assert.strictEqual(getBmadModules(tmp), undefined, 'no persisted selection, by construction');

      const result = await selectBmadModules({ projectRoot: tmp });
      assert.ok(result.includes('wds'),
        'an existing wds install must not be narrowed away by the new default');
      assert.ok(result.includes('gds'), 'nor an existing gds install');
      assert.deepStrictEqual([...result].sort(), ['bmb', 'bmm', 'cis', 'gds', 'tea', 'wds']);

      // And the run migrates the project onto 27.13's durable record.
      assert.ok(getBmadModules(tmp).includes('wds'), 'the on-disk set is now persisted');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC6 a stray FILE on disk does not migrate a project onto a module it never installed', async () => {
    // The same defect one layer up, where it actually bites. Branch 3b treats
    // the on-disk probe as the pre-27.13 project's own module selection and
    // PERSISTS the result, so a stray file promotes itself into a durable
    // "explicit user selection" that no future default change can undo.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-strayfile-'));
    try {
      for (const id of ['bmm', 'tea']) {
        fs.mkdirSync(path.join(tmp, '_bmad', id), { recursive: true });
      }
      fs.writeFileSync(path.join(tmp, '_bmad', 'wds'), 'not a module, just a file\n');

      const result = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!result.includes('wds'),
        `a regular file named _bmad/wds must not put wds in the resolved set, got ${result.join(', ')}`);
      assert.ok(!getBmadModules(tmp).includes('wds'),
        'and it must not be persisted as if the user had chosen it');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC6 an explicit deselection still beats the on-disk set', async () => {
    // The disk probe must not become a second install-everything default: a
    // user who explicitly drops wds must have it stay dropped even though
    // `_bmad/wds/` is still on disk from the previous install.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-deselect-'));
    try {
      for (const id of ['bmm', 'tea', 'wds']) {
        fs.mkdirSync(path.join(tmp, '_bmad', id), { recursive: true });
      }
      const first = await selectBmadModules({ bmadModulesFlag: 'tea', projectRoot: tmp });
      assert.deepStrictEqual(first, ['bmm', 'tea']);

      const second = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!second.includes('wds'),
        'persisted deselection must win over the on-disk probe');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC1 a degraded bundle falls back to bmm rather than throwing', async () => {
    // getInstallableBmadModules() returns [bmm] alone when the cache manifest
    // is unreadable. A default set naming tea/bmb/cis would then be rejected by
    // resolveBmadModules as unknown ids and take the installer down in the
    // module-selection step.
    assert.deepStrictEqual(bmad.getDefaultBmadModules([{ id: 'bmm' }]), ['bmm']);
    assert.deepStrictEqual(bmad.getDefaultBmadModules(['bmm', 'tea']), ['bmm', 'tea']);
  });

  await testAsync('AC1 a degraded bundle degrades THROUGH selectBmadModules, not only in the helper', async () => {
    // The test above exercises the intersection as a UNIT. Mutant M-D — deleting
    // the intersection so `getDefaultBmadModules` returns `[...DEFAULT_BMAD_MODULE_IDS]`
    // verbatim — survived that at 46/0, because nothing drove the CALL SITE that
    // consumes it. With the intersection gone, branch 3c hands `tea, bmb, cis` to
    // `resolveBmadModules` against an available set of `[bmm]` alone and the
    // documented crash returns:
    //
    //   Unknown BMAD module(s): tea, bmb, cis. Available: bmm
    //
    // — thrown out of the installer's module-selection step, which is exactly the
    // failure the intersection exists to prevent. Branch 3c has no try/catch.
    //
    // The degradation is induced at its documented source: `getInstallableBmadModules()`
    // returns `[bmm]` alone when `lib/bmad-cache/cache-manifest.json` is missing or
    // unreadable. Patching the export (bin/cli.js:48 holds the same module object and
    // calls it as `bmad.getInstallableBmadModules()`) reproduces that without moving
    // the shipped cache out from under a parallel suite.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-degraded-'));
    const realGetInstallable = bmad.getInstallableBmadModules;
    try {
      bmad.getInstallableBmadModules = () => [
        { id: 'bmm', retired: false, description: 'BMad Method core' },
      ];

      let result;
      try {
        result = await selectBmadModules({ projectRoot: tmp });
      } catch (err) {
        assert.fail(
          `a degraded bundle must degrade to a minimal install, not take the ` +
          `module-selection step down: ${err.message}`
        );
      }
      assert.deepStrictEqual(result, ['bmm'],
        'a bundle that can only install bmm must resolve exactly [bmm]');
      assert.deepStrictEqual(getBmadModules(tmp), ['bmm'],
        'and the degraded resolution is persisted like any other');
    } finally {
      bmad.getInstallableBmadModules = realGetInstallable;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('NFR21 the default path emits --modules in the order FR123 writes it', async () => {
    // Mutant M-C — reordering DEFAULT_BMAD_MODULE_IDS to ['cis','bmb','tea','bmm'] —
    // survived at 46/0. Every AC1/AC4 assertion sorts before comparing, so order was
    // caught only incidentally by a 2-element deepStrictEqual in the degraded-bundle
    // test. The installer would have emitted `--modules cis,bmb,tea,bmm`, and the
    // NFR21 determinism claim in the `getDefaultBmadModules` docblock ("the resolved
    // --modules value is deterministic regardless of manifest key order") was pinned
    // by nothing that names it.
    //
    // The explicit path already asserts its literal `--modules` string (AC3, below);
    // this is the same assertion for the DEFAULT path, with the expected order read
    // out of FR123's own sentence rather than restated here.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-order-'));
    try {
      const expected = fr123DefaultOrder();
      const result = await selectBmadModules({ projectRoot: tmp });
      assert.deepStrictEqual(result, expected,
        `the default set must resolve in FR123's written order (${expected.join(', ')}), ` +
        `got ${result.join(', ')} — membership alone is not determinism`);

      // The literal argv the installer hands to bmad-method.
      const cmd = bmad.buildBmadArgs({
        projectRoot: tmp,
        modules: result,
        tools: ['claude-code'],
      });
      assert.ok(new RegExp(`--modules ${expected.join(',')}(\\s|$)`).test(cmd),
        `the bmad-method command must carry --modules ${expected.join(',')}, got: ${cmd}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => {
      console.log(`  ${name}:`);
      console.log(`    ${error}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
})();
