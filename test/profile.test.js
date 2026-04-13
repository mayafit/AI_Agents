#!/usr/bin/env node
/**
 * Story 21.1 — Unit tests for lib/profile.js
 *
 * AC coverage:
 *   6.1  getProfile undefined when file absent           (AC #2)
 *   6.2  getProfile undefined when field absent          (AC #2, #14 back-compat)
 *   6.3  getProfile returns persisted value              (AC #2)
 *   6.4  setProfile creates file with standard schema    (AC #3)
 *   6.5  setProfile preserves existing fields            (AC #3)
 *   6.6  setProfile throws on invalid value              (AC #4)
 *   6.7  resolveProfile: flag > persisted                (AC #5)
 *   6.8  resolveProfile: persisted > yes-default         (AC #5)
 *   6.9  resolveProfile: yes-default only when no flag/persisted (AC #5)
 *   6.10 resolveProfile: null when nothing set, yesMode=false (AC #5)
 *   6.11 resolveProfile does no I/O                      (AC #5)
 *   6.12 round-trip setProfile -> getProfile             (AC #2/#3)
 *   6.13 setProfile idempotent (profile field stable)    (AC #3)
 *   6.14 setProfile('on-prem') bumps manifestVersion     (AC #14 — new files at 1.2.0)
 *   6.15 ma-agents-template 1.1.0 file w/o profile reads as undefined (AC #14 back-compat)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

const { getProfile, setProfile, resolveProfile } = require('../lib/profile');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-profile-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('\n profile unit tests\n');

async function runAll() {
  // 6.1 — getProfile returns undefined when file absent
  await test('6.1 getProfile returns undefined when .ma-agents.json does not exist', () => {
    const dir = mktemp();
    try {
      assert.strictEqual(getProfile(dir), undefined);
    } finally { cleanup(dir); }
  });

  // 6.2 — getProfile returns undefined when field absent (1.1.0 back-compat)
  await test('6.2 getProfile returns undefined when profile field absent (1.1.0 back-compat)', () => {
    const dir = mktemp();
    try {
      fs.writeFileSync(
        path.join(dir, '.ma-agents.json'),
        JSON.stringify({ manifestVersion: '1.1.0', agent: 'claude-code', agents: ['claude-code'], scope: 'project', skills: {} }, null, 2),
        'utf-8'
      );
      assert.strictEqual(getProfile(dir), undefined);
    } finally { cleanup(dir); }
  });

  // 6.3 — getProfile returns persisted value
  await test('6.3 getProfile returns persisted value when present', () => {
    const dir = mktemp();
    try {
      fs.writeFileSync(
        path.join(dir, '.ma-agents.json'),
        JSON.stringify({ manifestVersion: '1.2.0', profile: 'on-prem', skills: {} }, null, 2),
        'utf-8'
      );
      assert.strictEqual(getProfile(dir), 'on-prem');
    } finally { cleanup(dir); }
  });

  // 6.4 — setProfile creates file with standard schema when absent
  await test('6.4 setProfile creates .ma-agents.json with standard schema when absent', () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const manifestPath = path.join(dir, '.ma-agents.json');
      assert.ok(fs.existsSync(manifestPath), 'manifest file should exist');
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(parsed.profile, 'standard');
      assert.strictEqual(parsed.manifestVersion, '1.2.0', 'new file should be bumped to 1.2.0');
      assert.ok('agents' in parsed, 'agents array should be initialized');
      assert.ok('skills' in parsed, 'skills object should be initialized');
      assert.strictEqual(parsed.scope, 'project');
    } finally { cleanup(dir); }
  });

  // 6.5 — setProfile preserves existing fields
  await test('6.5 setProfile preserves existing fields (manifestVersion, agent, agents, scope, skills)', () => {
    const dir = mktemp();
    try {
      const original = {
        manifestVersion: '1.1.0',
        agent: 'claude-code',
        agents: ['claude-code', 'roo-code'],
        scope: 'project',
        skills: { foo: { version: '1.0.0', installedAt: '2026-01-01T00:00:00Z' } },
        customField: 'preserved'
      };
      fs.writeFileSync(path.join(dir, '.ma-agents.json'), JSON.stringify(original, null, 2), 'utf-8');
      setProfile(dir, 'on-prem');
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(parsed.profile, 'on-prem');
      assert.strictEqual(parsed.agent, 'claude-code');
      assert.deepStrictEqual(parsed.agents, ['claude-code', 'roo-code']);
      assert.strictEqual(parsed.scope, 'project');
      assert.deepStrictEqual(parsed.skills, original.skills);
      assert.strictEqual(parsed.customField, 'preserved', 'unknown fields must also be preserved');
      // Per AC #14: reads do NOT migrate version. Only setProfile itself does not rewrite
      // the version — the file was already at 1.1.0 and stays that way.
      assert.strictEqual(parsed.manifestVersion, '1.1.0', 'setProfile must not mutate manifestVersion on existing files');
    } finally { cleanup(dir); }
  });

  // 6.6 — setProfile throws on invalid value; error names the bad value
  await test('6.6 setProfile throws on invalid value and error message names the bad value', () => {
    const dir = mktemp();
    try {
      assert.throws(
        () => setProfile(dir, 'hybrid'),
        (err) => err instanceof Error && err.message.includes('hybrid'),
        'should throw naming the bad value'
      );
      assert.throws(() => setProfile(dir, ''), /Invalid profile value/);
      assert.throws(() => setProfile(dir, null), /Invalid profile value/);
      assert.throws(() => setProfile(dir, undefined), /Invalid profile value/);
    } finally { cleanup(dir); }
  });

  // 6.7 — resolveProfile: flag wins over persisted
  await test('6.7 resolveProfile: flag wins over persisted', () => {
    assert.strictEqual(
      resolveProfile({ flag: 'on-prem', persisted: 'standard', yesMode: true }),
      'on-prem'
    );
  });

  // 6.8 — resolveProfile: persisted wins over yes-default
  await test('6.8 resolveProfile: persisted wins over --yes default', () => {
    assert.strictEqual(
      resolveProfile({ flag: null, persisted: 'on-prem', yesMode: true }),
      'on-prem'
    );
  });

  // 6.9 — resolveProfile: yes-default returns standard only when no flag/persisted
  await test('6.9 resolveProfile: yesMode=true with no flag and no persisted returns "standard"', () => {
    assert.strictEqual(
      resolveProfile({ flag: null, persisted: undefined, yesMode: true }),
      'standard'
    );
  });

  // 6.10 — resolveProfile: null when nothing set and yesMode is false
  await test('6.10 resolveProfile: returns null when nothing set and yesMode=false', () => {
    assert.strictEqual(
      resolveProfile({ flag: null, persisted: undefined, yesMode: false }),
      null
    );
    assert.strictEqual(resolveProfile({}), null, 'empty options → null');
  });

  // 6.11 — resolveProfile performs no I/O
  await test('6.11 resolveProfile does not perform I/O (fs spies not triggered)', () => {
    const calls = [];
    const originals = {};
    for (const name of ['readFileSync', 'writeFileSync', 'existsSync', 'readdirSync', 'statSync']) {
      originals[name] = fs[name];
      fs[name] = function spy(...args) {
        calls.push({ name, args });
        return originals[name].apply(fs, args);
      };
    }
    try {
      resolveProfile({ flag: 'on-prem', persisted: null, yesMode: false });
      resolveProfile({ flag: null, persisted: 'standard', yesMode: true });
      resolveProfile({ flag: null, persisted: null, yesMode: true });
      resolveProfile({ flag: null, persisted: null, yesMode: false });
      assert.strictEqual(calls.length, 0, `resolveProfile triggered fs calls: ${calls.map(c => c.name).join(',')}`);
    } finally {
      for (const name of Object.keys(originals)) fs[name] = originals[name];
    }
  });

  // 6.12 — Round-trip: setProfile then getProfile
  await test('6.12 round-trip: setProfile("on-prem") then getProfile() returns "on-prem"', () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      assert.strictEqual(getProfile(dir), 'on-prem');
      setProfile(dir, 'standard');
      assert.strictEqual(getProfile(dir), 'standard');
    } finally { cleanup(dir); }
  });

  // 6.13 — Idempotence: re-running setProfile with same value keeps the profile field stable
  await test('6.13 setProfile is idempotent — profile field remains stable on re-apply', () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      const first = fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8');
      setProfile(dir, 'on-prem');
      const second = fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8');
      const p1 = JSON.parse(first);
      const p2 = JSON.parse(second);
      assert.strictEqual(p1.profile, p2.profile, 'profile field must be stable');
      assert.strictEqual(p1.profile, 'on-prem');
    } finally { cleanup(dir); }
  });

  // 6.14 — Fresh setProfile writes manifestVersion 1.2.0
  await test('6.14 setProfile on fresh project bootstraps manifestVersion 1.2.0', () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(parsed.manifestVersion, '1.2.0');
    } finally { cleanup(dir); }
  });

  // 6.15 — 1.1.0 back-compat: file without profile reads cleanly
  await test('6.15 1.1.0 manifest without profile field reads without error (AC #14)', () => {
    const dir = mktemp();
    try {
      fs.writeFileSync(
        path.join(dir, '.ma-agents.json'),
        JSON.stringify({ manifestVersion: '1.1.0', skills: {} }, null, 2),
        'utf-8'
      );
      assert.strictEqual(getProfile(dir), undefined);
      // And setProfile on top preserves existing version (does not force migrate on read path)
      setProfile(dir, 'on-prem');
      const after = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(after.profile, 'on-prem');
      assert.strictEqual(after.manifestVersion, '1.1.0', 'existing manifestVersion must be preserved');
    } finally { cleanup(dir); }
  });

  // ─── Report ───
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll();
