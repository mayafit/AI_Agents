#!/usr/bin/env node
/**
 * Tests for Story 30.4 — idempotent one-time Demerzel deprecation notice
 * (FR245, FR246, NFR49).
 *
 * `lib/profile.js` exports `showDemerzelDeprecationNoticeOnce(projectRoot)`,
 * a generic `hasShownNotice`/`markNoticeShown` pair, mirroring the existing
 * `profile`/`bmadModules` field-ownership pattern for the project-root
 * `.ma-agents.json`. Contract under test:
 *   - first call for a given project root prints the notice and returns true
 *   - every subsequent call is a silent no-op (returns false, prints nothing)
 *   - the `shown` flag is persisted under `.ma-agents.json::notices`, and
 *     coexists with (does not clobber) `profile` / `bmadModules` / any other
 *     pre-existing field
 *   - a missing `.ma-agents.json` is bootstrapped correctly (mirrors
 *     setProfile's bootstrap-on-absence behavior)
 *   - a malformed `.ma-agents.json` does not throw
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  hasShownNotice,
  markNoticeShown,
  showDemerzelDeprecationNoticeOnce,
  setProfile,
  getProfile,
  setBmadModules,
  getBmadModules,
} = require('../lib/profile');

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

function mkScratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'demerzel-notice-'));
}

function captureConsoleLog(fn) {
  const orig = console.log;
  let captured = '';
  console.log = (...args) => { captured += args.join(' ') + '\n'; };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return captured;
}

console.log('\n=== Story 30.4: idempotent one-time Demerzel deprecation notice ===');

test('hasShownNotice returns false when .ma-agents.json does not exist', () => {
  const root = mkScratchRoot();
  try {
    assert.strictEqual(hasShownNotice(root, 'demerzel-deprecation'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('showDemerzelDeprecationNoticeOnce: first call prints and persists; returns true', () => {
  const root = mkScratchRoot();
  try {
    let out;
    const result = (() => {
      let r;
      out = captureConsoleLog(() => { r = showDemerzelDeprecationNoticeOnce(root); });
      return r;
    })();
    assert.strictEqual(result, true, 'first call must return true');
    assert.ok(/Demerzel/.test(out), 'first call must print a Demerzel notice');
    assert.ok(/deprecated/i.test(out), 'notice must say deprecated');

    const manifestPath = path.join(root, '.ma-agents.json');
    assert.ok(fs.existsSync(manifestPath), '.ma-agents.json must be created');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.strictEqual(manifest.notices && manifest.notices['demerzel-deprecation'], true,
      'notices.demerzel-deprecation must be persisted as true');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('showDemerzelDeprecationNoticeOnce: second call is a silent no-op; returns false', () => {
  const root = mkScratchRoot();
  try {
    captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    const out2 = captureConsoleLog(() => {
      const r = showDemerzelDeprecationNoticeOnce(root);
      assert.strictEqual(r, false, 'second call must return false');
    });
    assert.strictEqual(out2, '', 'second call must print nothing');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hasShownNotice reflects markNoticeShown for arbitrary notice ids (generic API)', () => {
  const root = mkScratchRoot();
  try {
    assert.strictEqual(hasShownNotice(root, 'some-other-notice'), false);
    markNoticeShown(root, 'some-other-notice');
    assert.strictEqual(hasShownNotice(root, 'some-other-notice'), true);
    // A different id must remain unaffected.
    assert.strictEqual(hasShownNotice(root, 'demerzel-deprecation'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the notice flag coexists with a pre-existing profile field without disturbing it', () => {
  const root = mkScratchRoot();
  try {
    setProfile(root, 'on-prem');
    captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    assert.strictEqual(getProfile(root), 'on-prem',
      'profile field must survive the notice write untouched');
    assert.strictEqual(hasShownNotice(root, 'demerzel-deprecation'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the notice flag coexists with a pre-existing bmadModules field without disturbing it', () => {
  const root = mkScratchRoot();
  try {
    setBmadModules(root, ['bmm', 'tea']);
    captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    assert.deepStrictEqual(getBmadModules(root), ['bmm', 'tea'],
      'bmadModules field must survive the notice write untouched');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('setting the profile AFTER the notice has fired does not reset the shown flag', () => {
  const root = mkScratchRoot();
  try {
    captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    setProfile(root, 'standard');
    assert.strictEqual(hasShownNotice(root, 'demerzel-deprecation'), true,
      'notice flag must survive an unrelated later write via setProfile');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a malformed .ma-agents.json does not throw and is treated as not-yet-shown', () => {
  const root = mkScratchRoot();
  try {
    fs.writeFileSync(path.join(root, '.ma-agents.json'), '{ not valid json ', 'utf-8');
    assert.strictEqual(hasShownNotice(root, 'demerzel-deprecation'), false);
    let threw = false;
    try {
      captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'showDemerzelDeprecationNoticeOnce must not throw on malformed JSON');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('names no specific replacement target (FR246 — no in-tool migration)', () => {
  const root = mkScratchRoot();
  try {
    const out = captureConsoleLog(() => showDemerzelDeprecationNoticeOnce(root));
    assert.ok(!/memory-agent/i.test(out),
      'notice must not name a specific replacement/migration target');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (errors.length > 0) {
  console.error('\nFailures:');
  for (const { name, error } of errors) {
    console.error(`  ${name}: ${error}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
