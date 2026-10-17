#!/usr/bin/env node
/**
 * Bug: bmad-method's skill-dir cleanup fails on transient Windows locks.
 *
 * After copying skills into the IDE directories, bmad-method deletes the
 * `_bmad/<module>/<skill>` copies with fs-extra `remove` → `fs.rm`, which
 * does not retry by default. A momentary lock (Defender, indexer, editor
 * watcher) aborted the whole install with
 * "EBUSY: resource busy or locked, rmdir '...\_bmad\ma-skills\ma-agent-sqa'".
 *
 * ma-agents now preloads lib/fs-retry-preload.js into the bmad-method child
 * (NODE_OPTIONS --require), giving recursive rm calls a retry budget. The
 * end-to-end case holds a real lock: on Windows a directory that is another
 * process's cwd cannot be removed until that process exits.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const bmad = require('../lib/bmad');
const { withRetries, MAX_RETRIES } = require('../lib/fs-retry-preload');

const PRELOAD = path.join(__dirname, '..', 'lib', 'fs-retry-preload.js').replace(/\\/g, '/');

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

/**
 * Create a directory, hold it locked as the cwd of a sleeping process, and
 * have a child Node process (env = `env`) remove it with fs-extra `remove`
 * while the lock is held. The lock is released after `holdMs`.
 *
 * @returns {{ status: number, output: string, existsAfter: boolean }}
 */
async function removeWhileLocked(env, holdMs = 700) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-ebusy-'));
  fs.mkdirSync(path.join(dir, 'skill'));
  fs.writeFileSync(path.join(dir, 'skill', 'SKILL.md'), 'x');
  const holder = spawn(process.execPath, ['-e', `setTimeout(() => {}, ${holdMs})`], { cwd: dir, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 150));
  const script = `require(process.argv[1]).remove(process.argv[2]).then(() => console.log('removed'), e => { console.log(e.code); process.exit(1); })`;
  const res = spawnSync(process.execPath, ['-e', script, require.resolve('fs-extra'), dir], { env, encoding: 'utf8' });
  holder.kill();
  const existsAfter = fs.existsSync(dir);
  await new Promise(r => setTimeout(r, 200));
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20 });
  return { status: res.status, output: `${res.stdout}${res.stderr}`.trim(), existsAfter };
}

(async () => {
  console.log('\nbmad-method child retries recursive deletes on transient locks\n');

  await test('withRetries adds a retry budget to a recursive rm', () => {
    const out = withRetries({ recursive: true, force: true });
    assert.strictEqual(out.maxRetries, MAX_RETRIES);
    assert.ok(out.retryDelay > 0);
    assert.strictEqual(out.force, true);
  });

  await test('withRetries leaves non-recursive and explicit-policy calls alone', () => {
    const plain = { force: true };
    assert.strictEqual(withRetries(plain), plain);
    const own = { recursive: true, maxRetries: 2 };
    assert.strictEqual(withRetries(own), own);
    assert.strictEqual(withRetries(undefined), undefined);
  });

  await test('buildChildSpawnEnv preloads the retry shim and keeps user NODE_OPTIONS', () => {
    const env = bmad.buildChildSpawnEnv({ NODE_OPTIONS: '--max-old-space-size=4096' });
    assert.ok(env.NODE_OPTIONS.includes('--max-old-space-size=4096'), env.NODE_OPTIONS);
    assert.ok(env.NODE_OPTIONS.includes(`--require "${PRELOAD}"`), env.NODE_OPTIONS);
    assert.ok(!PRELOAD.includes('\\'), 'preload path must use forward slashes inside quoted NODE_OPTIONS');
  });

  await test('withFsRetryPreload is idempotent', () => {
    const once = bmad.withFsRetryPreload('');
    assert.strictEqual(bmad.withFsRetryPreload(once), once);
  });

  await test('the preloaded child removes a directory held by a transient lock', async () => {
    const res = await removeWhileLocked(bmad.buildChildSpawnEnv());
    assert.strictEqual(res.status, 0, `child failed: ${res.output}`);
    assert.strictEqual(res.output, 'removed');
    assert.strictEqual(res.existsAfter, false);
  });

  if (process.platform === 'win32') {
    await test('control: without the preload the same delete fails with EBUSY (Windows)', async () => {
      const env = { ...process.env, NODE_OPTIONS: '' };
      const res = await removeWhileLocked(env);
      assert.notStrictEqual(res.status, 0, 'expected the unpatched delete to fail — the lock is not being reproduced');
      assert.ok(/EBUSY|EPERM/.test(res.output), res.output);
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
