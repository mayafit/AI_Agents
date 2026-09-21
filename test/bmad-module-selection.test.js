#!/usr/bin/env node
/**
 * Tests for BMad module selection plumbing.
 *
 * Bug fix: ma-agents previously hardcoded `['bmm']` in bin/cli.js's BMad
 * install/update calls, stranding the bundled `tea`, `bmb`, `cis`
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
 * FR123 narrowed the DEFAULT install set from "every non-retired bundled
 * module" to bmm+tea+bmb+cis, and FR75 then removed gds and wds from the
 * bundle entirely — they are neither bundled nor installable, and obtaining
 * either one needs network access. The final section covers both, with the
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

// FR75. Not "wds is absent from a list" — absent by ANY route would pass
// that. The two things that could put it back are a retained cache directory
// (the cache build's AC #7 retention loop re-adds a manifest entry, flagged
// retiredUpstream, for any directory still on disk) and a manifest entry with
// no directory. Both are checked.
test('FR75: gds and wds are not installable, by no route at all', () => {
  const ids = bmad.getInstallableBmadModules().map(m => m.id);
  const cacheRoot = path.join(__dirname, '..', 'lib', 'bmad-cache');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(cacheRoot, 'cache-manifest.json'), 'utf8')
  );
  for (const id of ['gds', 'wds']) {
    assert.ok(!ids.includes(id),
      `${id} must not be installable (FR75); got: ${ids.join(', ')}`);
    assert.ok(!fs.existsSync(path.join(cacheRoot, id)),
      `lib/bmad-cache/${id}/ must not ship — a retained directory re-enters the ` +
      `manifest through the cache build's retention loop, flagged retiredUpstream`);
    assert.ok(!(id in (manifest.modules || {})),
      `${id} must not appear in cache-manifest.json`);
  }
  // Teeth: the enumeration must actually be reporting modules, or every
  // assertion above passes on an empty list.
  assert.ok(ids.length >= 4, `expected the bundled set to enumerate; got: ${ids.join(', ')}`);
});

test('non-retired modules surface tea, bmb, cis when present', () => {
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
  // stray `_bmad/cis` file was enough to make the probe report cis installed —
  // and the persisted record would then carry it forever.
  // `prePopulateBmadCache` checks `stat.isDirectory()` in the analogous place
  // (lib/bmad.js, the cache-source walk); this matches it.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-bmad-test-'));
  try {
    fs.mkdirSync(path.join(tmp, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '_bmad', 'cis'), 'not a module, just a file\n');
    const result = bmad.getInstalledBmadModules(tmp);
    assert.ok(result.includes('bmm'), `expected bmm in: ${result.join(', ')}`);
    assert.ok(!result.includes('cis'),
      `a regular file named _bmad/cis is not an installed module, got: ${result.join(', ')}`);

    // The statSync guard must FAIL CLOSED. `statSync` throws ENOENT for an id
    // with no `_bmad/<id>` entry at all — the common case — so a catch arm that
    // returned true would report every installable module as installed, and
    // branch 3b would then persist that. Flipping `return false` to
    // `return true` in that catch otherwise survived the whole suite.
    for (const absent of ['tea', 'bmb']) {
      assert.ok(!result.includes(absent),
        `${absent} has no _bmad/${absent} entry at all and must be absent — ` +
        `the statSync guard must fail closed; got: ${result.join(', ')}`);
    }
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
    /Unknown BMAD module\(s\): nonsense\. Available: bmm, tea, bmb, cis/
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
  const flags = parseFlags(['--bmad-modules', 'tea, bmb ,cis']);
  const requested = flags.bmadModulesFlag.split(',').map(s => s.trim()).filter(Boolean);
  const result = bmad.resolveBmadModules({
    requested,
    available: FAKE_AVAILABLE,
  });
  assert.deepStrictEqual(result, ['bmm', 'tea', 'bmb', 'cis']);
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
      setBmadModules(tmp, ['bmm', 'tea', 'bmb', 'cis']);
      assert.deepStrictEqual(getBmadModules(tmp), ['bmm', 'tea', 'bmb', 'cis']);
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
      assert.ok(!result.includes('cis'), 'cis was not requested');
      // The selection is now durable.
      const persisted = getBmadModules(tmp);
      assert.ok(persisted.includes('tea') && persisted.includes('bmb') && !persisted.includes('cis'),
        'CSV selection must be persisted to .ma-agents.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('27.13 deselected module stays absent on a second no-flag run', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-27-13-'));
    try {
      // First run: user deselects cis via CSV (omits it).
      const first = await selectBmadModules({ bmadModulesFlag: 'bmm,tea,bmb', projectRoot: tmp });
      assert.ok(!first.includes('cis'), 'cis deselected in first run');

      // Second run: NO flag passed. Without persistence this returned ALL
      // installable modules (cis would return). With 27.13 it honors the
      // persisted set.
      const second = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!second.includes('cis'), 'deselected cis must NOT resurface on a no-flag run');
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

  // FR75 is the oracle for the BUNDLE, as FR123 is for the default INSTALL
  // set. Its two halves are parsed separately, and neither uses BUNDLED_IDS as
  // its token universe: the unbundled codes cannot come from the bundle by
  // definition, so they are read out of the prose directly. A PRD that stops
  // naming them fails the parse rather than silently returning an empty set.

  /** The module codes FR75 says the package bundles. */
  function fr75BundledSet() {
    const fr75 = readFrLine('FR75');
    const span = fr75.match(/bundles pre-cloned BMAD external modules \(([^)]*)\)/);
    assert.ok(span, 'FR75 no longer names the bundled modules in a parseable form');
    const found = span[1].split(',').map(t => t.trim()).filter(Boolean);
    assert.ok(found.length >= 2,
      `FR75's bundled clause named ${found.length} module(s) - parser is not matching`);
    return found;
  }

  /** The module codes FR75 declares NOT bundled. */
  function fr75UnbundledSet() {
    const fr75 = readFrLine('FR75');
    const span = fr75.match(/The two design-studio modules (.*?) are \*\*not bundled\*\*/);
    assert.ok(span, 'FR75 no longer names the unbundled design-studio modules in a parseable form');
    const found = [...span[1].matchAll(/`([a-z][a-z0-9-]{1,15})`/g)].map(m => m[1]);
    assert.strictEqual(found.length, 2,
      `FR75 says "the two design-studio modules" but named ${found.length}: ${found.join(', ')}`);
    return found;
  }

  // The cost of FR75 is that these two modules stop being obtainable offline.
  // That cost is the whole reason the requirement needed a human decision, so
  // it must stay legible to a reader of the PRD - not quietly dropped in a
  // later tidy-up. This asserts the PRD still says it, in both places.
  await testAsync('FR75/FR123 still state the air-gap cost of unbundling, in plain words', async () => {
    const fr75 = readFrLine('FR75');
    assert.match(fr75, /requires network access/,
      'FR75 must still say obtaining gds/wds requires network access');
    assert.match(fr75, /air-gapped/,
      'FR75 must still say what that means on an air-gapped machine');
    const fr123 = readFrLine('FR123');
    assert.match(fr123, /neither bundled nor installed/,
      'FR123 must still state that the design-studio modules are neither bundled nor installed');
    assert.match(fr123, /air-gapped machine neither module is obtainable/,
      'FR123 must still state the air-gap consequence');
  });

  await testAsync('FR75: the shipped bundle is exactly the set FR75 names', async () => {
    const fromPrd = [...fr75BundledSet()].sort();
    const cacheRoot = path.join(__dirname, '..', 'lib', 'bmad-cache');
    const onDisk = fs.readdirSync(cacheRoot, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort();
    assert.deepStrictEqual(onDisk, fromPrd,
      `lib/bmad-cache/ must hold exactly the modules FR75 names (${fromPrd.join(', ')}), ` +
      `got ${onDisk.join(', ')}`);
    // bmm is not in the cache - it ships inside bmad-method - so the
    // installable set is the cache plus bmm and nothing else.
    const installable = bmad.getInstallableBmadModules().map(m => m.id).sort();
    assert.deepStrictEqual(installable, ['bmm', ...fromPrd].sort(),
      `the installable set must be bmm plus FR75's bundled set, got ${installable.join(', ')}`);
  });

  await testAsync('FR75: a user who asks for an unbundled module is told it is unknown', async () => {
    // The user-visible consequence. resolveBmadModules is what branch 1 of
    // selectBmadModules calls on an explicit `--bmad-modules wds`; the CLI
    // prints this message and exits non-zero.
    const installable = bmad.getInstallableBmadModules().filter(m => !m.retired);
    for (const id of fr75UnbundledSet()) {
      assert.throws(
        () => bmad.resolveBmadModules({ requested: [id], available: installable }),
        new RegExp(`Unknown BMAD module\\(s\\): ${id}\\. Available: `),
        `--bmad-modules ${id} must be rejected as unknown, not silently accepted`
      );
    }
    // Teeth: the same call with a bundled id must succeed, or the throw above
    // proves only that the helper throws.
    assert.deepStrictEqual(
      bmad.resolveBmadModules({ requested: ['tea'], available: installable }),
      ['bmm', 'tea']
    );
  });

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
    // FR123 no longer withholds any bundled module, so the counterpart set is
    // empty. Cross-checked against the PRD rather than restated: FR123's own
    // sentence says the bundle and the default set coincide.
    assert.deepStrictEqual([...bmad.NON_DEFAULT_BMAD_MODULE_IDS], []);
    assert.match(readFrLine('FR123'),
      /the bundled set and the default install set currently coincide/,
      'FR123 must still say the two sets coincide, or NON_DEFAULT_BMAD_MODULE_IDS is wrong');
  });

  await testAsync('AC1 every bundled module is classified by FR123', async () => {
    // Closes the gap a one-set check leaves open: a newly bundled module that
    // FR123 classifies neither way would otherwise slip through unnoticed —
    // exactly the silent growth the old "everything in the manifest" default
    // produced. The classified set is FR123's default set plus whatever it
    // withholds (currently nothing), and it must equal the bundle exactly.
    const classified = [...fr123DefaultSet(), ...bmad.NON_DEFAULT_BMAD_MODULE_IDS].sort();
    const installable = bmad.getInstallableBmadModules()
      .filter(m => !m.retired).map(m => m.id).sort();
    assert.deepStrictEqual(classified, installable,
      'a bundled module is not classified by FR123 (or FR123 names one that is not bundled)');
  });

  await testAsync('AC2 nothing in the bundle scaffolds design-artifacts/', async () => {
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

    const bundledIds = bmad.getInstallableBmadModules().map(m => m.id);

    // Teeth. The parser must be reading real `directories:` blocks out of the
    // shipped module.yaml files, or "none of them declares design-artifacts"
    // is just a statement about a broken regex. `tea` declares
    // `{test_artifacts}` and is in the DEFAULT set, which is also the
    // counter-example to "a module with its own directories: block is a
    // problem" — it never was; only the declared FOLDER mattered.
    const withBlocks = bundledIds.filter(id => directoriesBlock(id).trim().length > 0);
    assert.ok(withBlocks.length > 0,
      'no bundled module.yaml yielded a directories: block — the AC2 parser has no teeth');
    assert.match(directoriesBlock('tea'), /test_artifacts/,
      "tea's directories: block must still be readable — the parser's positive control");

    const scaffolders = bundledIds
      .filter(id => /design_artifacts|design-artifacts/.test(directoriesBlock(id)));
    assert.deepStrictEqual(scaffolders, [],
      `${scaffolders.join(', ')} ship in the bundle and declare a design-artifacts ` +
      `directory; FR75 removed the only module that did`);

    // And therefore no install path can resolve one, default or otherwise.
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
  // both were unverified: the initial check state IS the default set, and the
  // offered list is exactly the bundle — no more (offering a module this
  // package cannot install would be a lie) and no less.

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

      // Bug 27.13 — branch 2's answer must be as durable as every other
      // branch's. Without this, dropping `persist()` from the multiselect
      // return survived the whole suite, and the user's explicit choice would
      // quietly revert to the default on the next no-flag run.
      assert.deepStrictEqual([...getBmadModules(tmp)].sort(), [...fr123DefaultSet()].sort(),
        'the multiselect result must be persisted to .ma-agents.json');
    } finally {
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 the multiselect forces bmm back in when the user unchecks it', async () => {
    // The "(required)" tag and the belt-and-suspenders comment beside the
    // branch-2 return both claim this, and nothing tested it: replacing
    // `persist(bmad.resolveBmadModules({ requested: chosenModules, ... }))`
    // with `persist(chosenModules)` survived the whole suite. That mutant
    // removes BOTH the bmm force and the validation of what came back from the
    // prompt — the multiselect is the one branch whose input is not the
    // installer's own, so it is the branch that most needs both.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-nobmm-'));
    try {
      promptAnswer = () => ({ chosenModules: ['tea'] });   // bmm deliberately unchecked
      const result = await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      assert.deepStrictEqual(result, ['bmm', 'tea'],
        'bmm must be force-prepended even when the prompt comes back without it — ' +
        'the BMad core agents live there and downstream skills break without them');
      assert.ok(getBmadModules(tmp).includes('bmm'),
        'and the forced bmm is what gets persisted, not the raw prompt answer');

      // The same force is what makes the prompt's `min: 1` a UX nicety rather
      // than a correctness property: even an EMPTY answer resolves to a usable
      // install. Stated as a test because `min: 1` is enforced inside the
      // `prompts` library's TUI, which a stubbed prompt never executes — so
      // relaxing it is unkillable through this seam, and this is what makes
      // that survivor harmless rather than merely unobserved.
      promptAnswer = () => ({ chosenModules: [] });
      const empty = await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      assert.deepStrictEqual(empty, ['bmm'],
        'an empty multiselect answer must still resolve to the BMad core alone');
    } finally {
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 cancelling the multiselect aborts — it does not install the pre-checked default', async () => {
    // `prompts` returns `{}` when the user cancels (Ctrl-C / Esc), so
    // `chosenModules` reads back as undefined and branch 2 must
    // `process.exit(0)`. Deleting that guard survived the whole suite, and the
    // consequence is the worst possible reading of a cancel: the run would
    // carry on and install whatever the prompt happened to arrive pre-checked
    // with — the default set — as though the user had confirmed it.
    //
    // `process.exit` is stubbed to throw a sentinel so the abort is observable
    // without taking the suite down, and restored in `finally`.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-cancel-'));
    const realExit = process.exit;
    let exitCode;
    try {
      promptAnswer = () => ({});
      process.exit = (code) => { exitCode = code; throw new Error('__stub_process_exit__'); };

      let resolved;
      try {
        resolved = await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      } catch (err) {
        if (err.message !== '__stub_process_exit__') throw err;
      }

      assert.strictEqual(exitCode, 0,
        'a cancelled module prompt must exit(0), not fall through into an install');
      assert.strictEqual(resolved, undefined, 'and must not resolve a module set');
      assert.strictEqual(getBmadModules(tmp), undefined,
        'and must not persist a selection the user never made');
    } finally {
      process.exit = realExit;
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 bmm is pre-checked by the (required) force, not by its membership of the default set', async () => {
    // `selected: isCore || defaultIds.has(m.id)` — the `isCore` half is
    // redundant TODAY only because FR123's default set happens to open with
    // bmm, so dropping it survives. It is the half that carries the
    // "(required)" tag's promise, and it is the half that keeps the prompt
    // honest if the default set is ever amended again. Pinned by removing
    // bmm from what the default-set helper reports, which is the only
    // circumstance under which the two halves differ.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-isCore-'));
    const realGetDefault = bmad.getDefaultBmadModules;
    const asked = [];
    try {
      bmad.getDefaultBmadModules = (available) =>
        realGetDefault(available).filter(id => id !== 'bmm');
      promptAnswer = (question) => {
        asked.push(question);
        return { chosenModules: question.choices.filter(c => c.selected).map(c => c.value) };
      };

      await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      assert.strictEqual(asked.length, 1);

      const bmmChoice = asked[0].choices.find(c => c.value === 'bmm');
      assert.ok(bmmChoice, 'bmm must be offered');
      assert.strictEqual(bmmChoice.selected, true,
        'bmm is pre-checked because it is REQUIRED, not because the default set lists it');
      assert.ok(/\(required\)/.test(bmmChoice.title),
        `and the prompt must say so; got title ${JSON.stringify(bmmChoice.title)}`);
    } finally {
      bmad.getDefaultBmadModules = realGetDefault;
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC4 bare --bmad-modules offers exactly the bundle, and nothing unbundled', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-offer-'));
    const asked = [];
    try {
      promptAnswer = (question) => {
        asked.push(question);
        return { chosenModules: ['bmm'] };
      };

      await selectBmadModules({ bmadModulesPrompt: true, projectRoot: tmp });
      assert.strictEqual(asked.length, 1);

      // The oracle is the PRD's two classifications, not the code's
      // enumeration: FR123 says what is offered and FR75 says what is not.
      const offered = asked[0].choices.map(c => c.value);
      const classified = [...fr123DefaultOrder(), ...bmad.NON_DEFAULT_BMAD_MODULE_IDS];
      assert.deepStrictEqual([...offered].sort(), [...classified].sort(),
        `every module FR123 classifies must be offered by the multiselect; ` +
        `got ${offered.join(', ')}`);

      // The half that moved. An unbundled module must NOT appear here: the
      // prompt is an offer to install, and this package cannot install one.
      for (const id of fr75UnbundledSet()) {
        assert.ok(!offered.includes(id),
          `${id} is not bundled (FR75) and must not be offered — offering it ` +
          `promises an install that would need network access to succeed`);
      }

      // Teeth: the prompt must be offering a real, non-trivial list, or the
      // absence assertions above are satisfied by an empty one.
      assert.ok(offered.length >= 4,
        `the multiselect offered ${offered.length} module(s): ${offered.join(', ')}`);
      assert.ok(offered.includes('bmm') && offered.includes('tea'),
        `the multiselect must offer the bundled modules; got ${offered.join(', ')}`);
    } finally {
      promptAnswer = unexpectedPrompt;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC3 an explicit --bmad-modules naming wds is refused, not quietly dropped', async () => {
    // The flag still PARSES — nothing about the CLI surface rejects the string
    // — and the refusal happens where the module set is resolved. Refused is
    // the right behaviour and silently-ignored is not: a user who asked for wds
    // and got a successful install without it would have no way to notice.
    const flags = parseFlags(['install', '--bmad-modules', 'wds', '--yes']);
    assert.strictEqual(flags.bmadModulesFlag, 'wds');

    const installable = bmad.getInstallableBmadModules().filter(m => !m.retired);
    assert.throws(
      () => bmad.resolveBmadModules({ requested: ['wds'], available: installable }),
      /Unknown BMAD module\(s\): wds\. Available: bmm, tea, bmb, cis/,
      'wds must be refused by name, with the installable set listed'
    );

    // A bundled id down the same path still resolves and still reaches
    // bmad-method as --modules, so the throw above is about wds and not about
    // the path being broken.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr75-wds-'));
    try {
      const ok = await selectBmadModules({ bmadModulesFlag: 'tea', projectRoot: tmp });
      assert.deepStrictEqual(ok, ['bmm', 'tea']);
      const cmd = bmad.buildBmadArgs({ projectRoot: tmp, modules: ok, tools: ['claude-code'] });
      assert.ok(/--modules bmm,tea\b/.test(cmd),
        `the bmad-method command must carry --modules bmm,tea, got: ${cmd}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('FR75/FR76 the offline cache stages the bundle and nothing else', async () => {
    // NOT "the cache directory contains a folder". This runs the installer's
    // real cache-staging step — lib/bmad.prePopulateBmadCache(), the step FR76
    // describes and the one that makes an air-gapped install possible — with
    // HOME redirected at a temp directory. No network is reachable from that
    // function: it is fs copy only. That is exactly why an unbundled module
    // cannot arrive through it, which is FR75's air-gap cost made concrete.
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr75-home-'));
    const realHomedir = os.homedir;
    try {
      os.homedir = () => tmpHome;
      await bmad.prePopulateBmadCache();
      const staged = path.join(tmpHome, '.bmad', 'cache', 'external-modules');

      // The bundled set stages with a usable payload.
      for (const id of bmad.DEFAULT_BMAD_MODULE_IDS.filter(m => m !== 'bmm')) {
        const modDir = path.join(staged, id);
        assert.ok(fs.existsSync(modDir), `${id} must stage for an offline install`);
        const payload = fs.readdirSync(modDir).filter(e => !e.startsWith('.'));
        assert.ok(payload.length > 0, `${id} staged as an empty directory — not installable`);
      }

      // The unbundled ones cannot, because there is nothing to copy. This is
      // the mechanism behind FR75's "on an air-gapped machine neither module
      // can be installed" — bmad-method would fall back to a git clone.
      for (const id of fr75UnbundledSet()) {
        assert.ok(!fs.existsSync(path.join(staged, id)),
          `${id} is not bundled (FR75); nothing can stage it into the offline cache`);
      }
    } finally {
      os.homedir = realHomedir;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  await testAsync('AC6 an existing project keeps its bundled modules, and drops the unbundled ones', async () => {
    // Non-destructive migration, and the one place FR75 costs an existing user
    // something. The narrowed DEFAULT applies to new installs only, so a
    // pre-27.13 project whose `_bmad/` is the only record of its choices keeps
    // every module it has — EXCEPT the ones this package can no longer install.
    // Passing `wds` to `bmad.updateBmad` after unbundling would ask
    // bmad-method to resolve it, and with no cached copy that is a git clone
    // against GitHub: the exact network dependency FR75 accepts and P2-6
    // exists to prevent. Dropping it is the honest outcome, and it must be a
    // DROP FROM THE RESOLVED LIST and not a crash.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr75-existing-'));
    try {
      for (const id of ['bmm', 'tea', 'bmb', 'cis', 'gds', 'wds']) {
        fs.mkdirSync(path.join(tmp, '_bmad', id), { recursive: true });
      }
      assert.strictEqual(getBmadModules(tmp), undefined, 'no persisted selection, by construction');

      const result = await selectBmadModules({ projectRoot: tmp });
      assert.deepStrictEqual([...result].sort(), ['bmb', 'bmm', 'cis', 'tea'],
        `an existing project keeps its bundled modules; got ${result.join(', ')}`);
      for (const id of fr75UnbundledSet()) {
        assert.ok(!result.includes(id),
          `${id} cannot be resolved for an update — it is not bundled (FR75)`);
      }

      // And the run migrates the project onto 27.13's durable record. The
      // directories the user already has are NOT deleted by any of this; only
      // the module list handed to bmad-method narrows.
      assert.deepStrictEqual([...getBmadModules(tmp)].sort(), ['bmb', 'bmm', 'cis', 'tea']);
      for (const id of ['gds', 'wds']) {
        assert.ok(fs.existsSync(path.join(tmp, '_bmad', id)),
          `_bmad/${id}/ must be left on disk untouched — narrowing is not deletion`);
      }
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
      fs.writeFileSync(path.join(tmp, '_bmad', 'cis'), 'not a module, just a file\n');

      const result = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!result.includes('cis'),
        `a regular file named _bmad/cis must not put cis in the resolved set, got ${result.join(', ')}`);
      assert.ok(!getBmadModules(tmp).includes('cis'),
        'and it must not be persisted as if the user had chosen it');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await testAsync('AC6 an explicit deselection still beats the on-disk set', async () => {
    // The disk probe must not become a second install-everything default: a
    // user who explicitly drops cis must have it stay dropped even though
    // `_bmad/cis/` is still on disk from the previous install.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-fr123-deselect-'));
    try {
      for (const id of ['bmm', 'tea', 'cis']) {
        fs.mkdirSync(path.join(tmp, '_bmad', id), { recursive: true });
      }
      const first = await selectBmadModules({ bmadModulesFlag: 'tea', projectRoot: tmp });
      assert.deepStrictEqual(first, ['bmm', 'tea']);

      const second = await selectBmadModules({ projectRoot: tmp });
      assert.ok(!second.includes('cis'),
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
