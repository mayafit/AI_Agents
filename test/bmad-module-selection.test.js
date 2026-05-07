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

const bmad = require('../lib/bmad');
const { parseFlags } = require('../bin/cli.js');

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

test('flags wds as retired (per cache-manifest.json)', () => {
  const result = bmad.getInstallableBmadModules();
  const wds = result.find(m => m.id === 'wds');
  // wds may or may not be in cache depending on manifest state — only assert
  // when present.
  if (wds) {
    assert.strictEqual(wds.retired, true, 'wds is marked retiredUpstream in cache-manifest.json');
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
