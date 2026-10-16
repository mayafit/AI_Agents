#!/usr/bin/env node
/**
 * Bug: external BMAD modules float to upstream's latest release.
 *
 * ma-agents pins bmad-method exactly, but bmad-method resolves each external
 * module (tea, bmb, cis) to that module's latest stable tag at install time.
 * TEA v2.0.x dropped src/module.yaml, which bmad-method 6.10.0 requires, so
 * every install selecting tea broke without any ma-agents change.
 *
 * The fix pins every bundled module to the release the bundled cache holds
 * (cache-manifest.json `pinTag` → `--pin <id>=<tag>`) and stamps the cache so
 * the pinned fetch resolves offline. These tests guard each link.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const bmad = require('../lib/bmad');

const MANIFEST_PATH = path.join(__dirname, '..', 'lib', 'bmad-cache', 'cache-manifest.json');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readMarker(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.bmad-channel.json'), 'utf8'));
}

(async () => {
  console.log('\nBundled external modules are pinned to the bundled release\n');

  await test('every bundled module in cache-manifest.json carries a release pinTag', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const ids = Object.keys(manifest.modules || {});
    assert.ok(ids.length > 0, 'manifest lists no modules');
    for (const id of ids) {
      const tag = manifest.modules[id].pinTag;
      assert.ok(/^v\d+\.\d+\.\d+$/.test(tag || ''),
        `${id} has no release pinTag (got ${JSON.stringify(tag)}) — an unpinned module floats to upstream's latest release`);
    }
  });

  await test('getBundledModulePins maps every manifest module to its pinTag', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const pins = bmad.getBundledModulePins();
    for (const [id, meta] of Object.entries(manifest.modules)) {
      assert.strictEqual(pins[id], meta.pinTag, `pin for ${id}`);
    }
  });

  await test('getBundledModulePins returns {} for a missing manifest', () => {
    assert.deepStrictEqual(bmad.getBundledModulePins(path.join(os.tmpdir(), 'no-such-manifest.json')), {});
  });

  await test('getBundledModulePins drops a pinTag carrying shell metacharacters', () => {
    const dir = tmpDir('ma-agents-pin-manifest-');
    try {
      const p = path.join(dir, 'cache-manifest.json');
      fs.writeFileSync(p, JSON.stringify({ modules: {
        tea: { pinTag: 'v1.0.0; rm -rf ~' }, bmb: { pinTag: 'v2.1.0' }, cis: { pinTag: '' },
      } }));
      assert.deepStrictEqual(bmad.getBundledModulePins(p), { bmb: 'v2.1.0' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('buildBmadArgs pins each selected bundled module', () => {
    const pins = bmad.getBundledModulePins();
    const cmd = bmad.buildBmadArgs({ projectRoot: '/p', modules: ['bmm', 'tea', 'bmb', 'cis'], tools: ['claude-code'] });
    for (const id of ['tea', 'bmb', 'cis']) {
      assert.ok(cmd.includes(`--pin ${id}=${pins[id]}`), `missing --pin ${id}=${pins[id]} in: ${cmd}`);
    }
  });

  await test('buildBmadArgs pins only selected modules, never bmm', () => {
    const cmd = bmad.buildBmadArgs({ projectRoot: '/p', modules: ['bmm', 'cis'], tools: ['claude-code'] });
    assert.ok(/--pin cis=/.test(cmd), `cis not pinned: ${cmd}`);
    assert.ok(!/--pin (tea|bmb|bmm)=/.test(cmd), `pinned an unselected module or bmm: ${cmd}`);
  });

  await test('buildBmadArgs honours an explicit ctx.pins', () => {
    const cmd = bmad.buildBmadArgs({ projectRoot: '/p', modules: ['bmm', 'tea'], tools: ['claude-code'], pins: { tea: 'v9.9.9' } });
    assert.ok(cmd.includes('--pin tea=v9.9.9'), cmd);
    const none = bmad.buildBmadArgs({ projectRoot: '/p', modules: ['bmm', 'tea'], tools: ['claude-code'], pins: {} });
    assert.ok(!none.includes('--pin'), none);
  });

  await test('ensureCacheMarker writes a pinned marker when the entry has a pinTag', async () => {
    const dir = tmpDir('ma-agents-pin-marker-');
    try {
      const wrote = await bmad.ensureCacheMarker(dir, { branch: 'main', commitSha: 'abc', pinTag: 'v1.19.0' });
      assert.strictEqual(wrote, true);
      const marker = readMarker(dir);
      assert.strictEqual(marker.channel, 'pinned');
      assert.strictEqual(marker.version, 'v1.19.0');
      assert.strictEqual(marker.sha, 'abc');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('cacheDiffersFromPin flags a cache resolved to another release', async () => {
    const dir = tmpDir('ma-agents-pin-differs-');
    try {
      const entry = { commitSha: 'abc', pinTag: 'v1.19.0' };
      assert.strictEqual(await bmad.cacheDiffersFromPin(dir, entry), true, 'no marker');
      fs.writeFileSync(path.join(dir, '.bmad-channel.json'), JSON.stringify({ channel: 'stable', version: 'v2.0.2' }));
      assert.strictEqual(await bmad.cacheDiffersFromPin(dir, entry), true, 'stable v2.0.2');
      fs.writeFileSync(path.join(dir, '.bmad-channel.json'), JSON.stringify({ channel: 'pinned', version: 'v1.19.0' }));
      assert.strictEqual(await bmad.cacheDiffersFromPin(dir, entry), false, 'pinned at the tag');
      assert.strictEqual(await bmad.cacheDiffersFromPin(dir, { commitSha: 'abc' }), false, 'entry without pinTag');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('prePopulateBmadCache replaces an off-pin cache and keeps a pinned one', async () => {
    const home = tmpDir('ma-agents-pin-home-');
    const realHomedir = os.homedir;
    try {
      const cache = path.join(home, '.bmad', 'cache', 'external-modules');
      const pins = bmad.getBundledModulePins();
      // tea: what a pre-fix online install left behind — upstream's latest.
      fs.mkdirSync(path.join(cache, 'tea'), { recursive: true });
      fs.writeFileSync(path.join(cache, 'tea', 'STALE'), '');
      fs.writeFileSync(path.join(cache, 'tea', '.bmad-channel.json'), JSON.stringify({ channel: 'stable', version: 'v2.0.2' }));
      // cis: already at the pin — must be left alone.
      fs.mkdirSync(path.join(cache, 'cis'), { recursive: true });
      fs.writeFileSync(path.join(cache, 'cis', 'KEEP'), '');
      fs.writeFileSync(path.join(cache, 'cis', '.bmad-channel.json'), JSON.stringify({ channel: 'pinned', version: pins.cis }));

      os.homedir = () => home;
      await bmad.prePopulateBmadCache();

      assert.ok(!fs.existsSync(path.join(cache, 'tea', 'STALE')), 'off-pin tea cache was not replaced');
      assert.deepStrictEqual(
        [readMarker(path.join(cache, 'tea')).channel, readMarker(path.join(cache, 'tea')).version],
        ['pinned', pins.tea]);
      assert.ok(fs.existsSync(path.join(cache, 'cis', 'KEEP')), 'pinned cis cache was needlessly replaced');
      assert.strictEqual(readMarker(path.join(cache, 'bmb')).version, pins.bmb, 'fresh bmb copy not stamped');
    } finally {
      os.homedir = realHomedir;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
