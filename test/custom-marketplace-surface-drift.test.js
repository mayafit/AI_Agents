#!/usr/bin/env node
/**
 * Story 30.6a — surface-drift/smoke test + local enumerate coverage for
 * lib/custom-marketplace.js (the thin adapter over bmad-method's
 * pinned-internal CustomModuleManager, NFR17).
 *
 * Per the 30.5 spike findings (§2 mitigation list), this test:
 *   1. Asserts the deep-require path is reachable and the class + the four
 *      consumed methods (parseSource, resolveSource, discoverModules,
 *      resolvePlugin) are present — fails loud if a future bmad-method pin
 *      bump moves/renames/removes any of them.
 *   2. Asserts the installed bmad-method version matches this repo's exact
 *      pin in package.json (NFR17 mitigation #2 — no semver ranges).
 *   3. Exercises the adapter's own enumerate logic against local fixtures
 *      (discovery mode with a marketplace.json, and direct mode without one
 *      — FR240).
 *   4. Exercises the "fail clean" contract against an unreachable source —
 *      a human-readable message, never a raw upstream stack.
 *
 * The LIVE Git-URL clone path is covered separately in
 * test/custom-marketplace-live-clone.test.js (needs a spawned local git
 * server and is slower).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
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

const {
  CUSTOM_MODULE_MANAGER_PATH,
  REQUIRED_METHODS,
  NFR71_WARNING,
  CustomMarketplaceError,
  assertCustomModuleManagerSurface,
  enumerateCustomSource,
} = require('../lib/custom-marketplace');
const pkg = require('../package.json');

// Fixtures live inside the repo (not os.tmpdir()) because bmad-method's
// parseSource() only recognizes /, ./, ../, ~ as local paths, and a
// ./-relative path only resolves correctly when it shares a drive/cwd with
// the process (spike finding — Windows C:\ absolutes are rejected outright).
const FIXTURE_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-drift-test');

function freshFixtureRoot() {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
}

function toRelative(absDir) {
  return './' + path.relative(process.cwd(), absDir).split(path.sep).join('/');
}

(async () => {
  console.log('\nlib/custom-marketplace.js — NFR17 surface drift / smoke test');

  await test('CUSTOM_MODULE_MANAGER_PATH deep path is reachable via require.resolve', () => {
    const resolved = require.resolve(CUSTOM_MODULE_MANAGER_PATH);
    assert.ok(fs.existsSync(resolved), `expected deep path to resolve to an existing file: ${resolved}`);
  });

  await test('assertCustomModuleManagerSurface() succeeds and returns a constructed manager', () => {
    const { mgr, version } = assertCustomModuleManagerSurface();
    assert.ok(mgr, 'expected a constructed CustomModuleManager instance');
    assert.strictEqual(typeof version, 'string', 'expected the installed bmad-method version to be a string');
  });

  await test('all REQUIRED_METHODS are present as functions on the instance', () => {
    const { mgr } = assertCustomModuleManagerSurface();
    for (const m of REQUIRED_METHODS) {
      assert.strictEqual(typeof mgr[m], 'function', `expected mgr.${m} to be a function, got ${typeof mgr[m]}`);
    }
    assert.deepStrictEqual(
      [...REQUIRED_METHODS].sort(),
      ['discoverModules', 'parseSource', 'resolvePlugin', 'resolveSource'].sort(),
      'REQUIRED_METHODS must match exactly what the adapter documents it consumes'
    );
  });

  await test('installed bmad-method version matches the exact pin in package.json (NFR17 #2)', () => {
    const { version } = assertCustomModuleManagerSurface();
    const pin = pkg.dependencies['bmad-method'];
    assert.strictEqual(pin.match(/^\d+\.\d+\.\d+$/) !== null, true, `expected an exact pin (no semver range), got "${pin}"`);
    assert.strictEqual(version, pin, `installed bmad-method (${version}) must match the exact pin (${pin})`);
  });

  console.log('\nenumerateCustomSource() — local discovery mode (FR240)');

  await test('discovery mode: enumerates every plugin declared in marketplace.json', async () => {
    freshFixtureRoot();
    try {
      const dir = path.join(FIXTURE_ROOT, 'discovery-fixture');
      fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: 'fixture-marketplace',
          owner: 'ma-agents-test',
          plugins: [
            { name: 'alpha-mod', description: 'Alpha extension', source: './alpha', skills: [] },
            { name: 'beta-mod', description: 'Beta extension', source: './beta', skills: [] },
            { name: 'gamma-mod', description: 'Gamma extension', source: './gamma', skills: [] },
          ],
        })
      );
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.mode, 'discovery');
      const codes = result.plugins.map((p) => p.code).sort();
      assert.deepStrictEqual(codes, ['alpha-mod', 'beta-mod', 'gamma-mod']);
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('direct mode: a source with no marketplace.json is treated as a single module (FR240)', async () => {
    freshFixtureRoot();
    try {
      const dir = path.join(FIXTURE_ROOT, 'direct-fixture');
      fs.mkdirSync(dir, { recursive: true });
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.mode, 'direct');
      assert.strictEqual(result.plugins.length, 1, 'direct mode must surface exactly one synthetic module');
      assert.strictEqual(result.plugins[0].code, 'direct-fixture');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('rejects empty/blank source input with a clean error (no throw of a raw TypeError)', async () => {
    await assert.rejects(
      () => enumerateCustomSource(''),
      (err) => {
        assert.ok(err instanceof CustomMarketplaceError, 'expected a CustomMarketplaceError');
        assert.match(err.message, /required/i);
        return true;
      }
    );
  });

  console.log('\nenumerateCustomSource() — unreachable source fails clean (spike §3 contract)');

  await test('unreachable source: throws a human-readable CustomMarketplaceError, not a raw stack dump', async () => {
    // Network-free by design: a nonexistent LOCAL path drives the SAME
    // fail-clean wrapper an unreachable Git remote would (resolveSource throws;
    // enumerateCustomSource rethrows a CustomMarketplaceError). Using a local
    // path keeps this test off the network and instantaneous — no git spawn,
    // no DNS, no connection timeout.
    const bogus = './.tmp-does-not-exist-30-6a/marketplace';
    await assert.rejects(
      () => enumerateCustomSource(bogus),
      (err) => {
        assert.ok(err instanceof CustomMarketplaceError, `expected CustomMarketplaceError, got ${err.name}`);
        assert.match(err.message, /Could not reach custom marketplace source/);
        // "Fail clean" — the message itself must be a short, readable
        // sentence, not a dump of a raw V8 stack trace (no "\n    at " frames).
        assert.ok(!/\n\s+at /.test(err.message), 'error message must not embed a raw stack trace');
        return true;
      }
    );
  });

  console.log('\nNFR71 warning text');

  await test('NFR71_WARNING is a non-empty, single-line, user-facing string', () => {
    assert.strictEqual(typeof NFR71_WARNING, 'string');
    assert.ok(NFR71_WARNING.length > 0);
    assert.ok(!NFR71_WARNING.includes('\n'), 'expected a single-line warning suitable for one console.log call');
  });

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
