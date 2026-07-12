#!/usr/bin/env node
/**
 * Story 30.6a — Git-URL clone enumerate coverage (30.5 spike gap closure),
 * network-free by design.
 *
 * The 30.5 spike proved the Git-URL path only by source/parse inspection and
 * flagged (§ "Unresolved / caveats") that no reachable repo existed to run an
 * ACTUAL clone. This test closes that gap WITHOUT any network dependency and
 * with a hard timeout on every spawned git command, so it can never block on
 * a network round-trip or a credential prompt:
 *
 *   1. LIVE clone, from a local bare repo (no network). We create a real bare
 *      git repo on disk (`git init --bare`), seed it with a
 *      `.claude-plugin/marketplace.json` + a couple of skill dirs, and perform
 *      an actual `git clone <localBareRepoPath> <dest>` — a genuine clone that
 *      materializes a working tree from git objects (not a directory copy) —
 *      then point `enumerateCustomSource()` at that freshly-cloned working
 *      tree. This exercises the real clone→read-marketplace→enumerate pipeline
 *      end to end, offline, in milliseconds.
 *
 *   2. Git-URL descriptor + ambient-credential posture. We assert
 *      bmad-method's pinned `parseSource()` classifies an intra-perimeter
 *      HTTPS/SSH URL as `type: 'url'` with the expected `cloneUrl`. bmad-
 *      method's own `cloneRepo()` (which ma-agents does NOT reimplement) then
 *      shells `git clone` with `env.GIT_TERMINAL_PROMPT = '0'` + a spread of
 *      `process.env` — i.e. ambient SSH/helper credentials, zero token
 *      handling (FR241). This is verified by source inspection, matching the
 *      spike's evidence.
 *
 * WHY the URL branch is not driven live here: bmad-method's `resolveSource()`
 * only runs its `cloneRepo()` (the `git clone <httpOrSshUrl>` path) when
 * `parseSource()` returns `type: 'url'`. `parseSource()` accepts only
 * `https?://` and `git@host:owner/repo` URLs as remote — a `file://` URL is
 * rejected outright, and a bare local path is classified `type: 'local'`
 * (read directly, no clone). Driving the URL branch therefore requires a live
 * HTTP/SSH endpoint, which is out of this test harness by design (it must not
 * hit the network). The local-bare-repo clone in (1) exercises the same
 * clone→enumerate mechanics without a server; the URL-specific wiring is
 * covered by the parse + ambient-cred assertions in (2).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

const { enumerateCustomSource, CUSTOM_MODULE_MANAGER_PATH } = require('../lib/custom-marketplace');

// Scratch dir inside the repo (NOT os.tmpdir()) so a ./-relative path stays on
// the same drive/cwd as the process — bmad-method's parseSource() only accepts
// ./, ../, /, ~ as local, and a Windows C:\ absolute is rejected (spike §3).
const WORK_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-live-clone-test');

// Every git invocation is bounded and non-interactive: a hard timeout kills a
// hung child, and GIT_TERMINAL_PROMPT=0 guarantees git never blocks on a
// credential prompt. No git call in this test touches the network.
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' };
function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', timeout: 15000, env: GIT_ENV });
}

function toRelative(absDir) {
  return './' + path.relative(process.cwd(), absDir).split(path.sep).join('/');
}

/** Create a seeded bare git repo at WORK_ROOT/bare.git; return its path. */
function buildBareRepoFixture(plugins) {
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  const bareDir = path.join(WORK_ROOT, 'bare.git');
  const seedDir = path.join(WORK_ROOT, 'seed');
  fs.mkdirSync(bareDir, { recursive: true });
  fs.mkdirSync(seedDir, { recursive: true });

  git(['init', '--bare', '-q'], bareDir);
  git(['init', '-q'], seedDir);
  git(['config', 'user.email', 'test@ma-agents.local'], seedDir);
  git(['config', 'user.name', 'ma-agents test'], seedDir);
  git(['config', 'commit.gpgsign', 'false'], seedDir);

  fs.mkdirSync(path.join(seedDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(seedDir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name: 'live-clone-fixture', owner: 'ma-agents-test', plugins })
  );
  // A couple of skill dirs so the fixture resembles a real marketplace repo.
  for (const p of plugins) {
    const skillDir = path.join(seedDir, p.name, 'skills', `${p.name}-skill`);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${p.name}\n`);
  }

  git(['add', '-A'], seedDir);
  git(['commit', '-q', '-m', 'seed marketplace'], seedDir);
  git(['branch', '-M', 'main'], seedDir);
  git(['remote', 'add', 'origin', bareDir], seedDir);
  git(['push', '-q', 'origin', 'main'], seedDir);
  git(['symbolic-ref', 'HEAD', 'refs/heads/main'], bareDir);

  return bareDir;
}

(async () => {
  console.log('\nGit-URL clone enumerate — network-free (30.5 spike gap closure)');

  try {
    await test('builds a seeded bare git repo fixture', () => {
      const bareDir = buildBareRepoFixture([
        { name: 'alpha-mod', description: 'Alpha', source: './alpha-mod', skills: [] },
        { name: 'beta-mod', description: 'Beta', source: './beta-mod', skills: [] },
      ]);
      assert.ok(fs.existsSync(path.join(bareDir, 'HEAD')), 'expected a bare repo at bare.git');
    });

    await test('a REAL `git clone` of the local bare repo materializes marketplace.json', () => {
      const dest = path.join(WORK_ROOT, 'clone-dest');
      // Genuine clone from git objects (bounded, offline) — not a dir copy.
      git(['clone', '--quiet', path.join(WORK_ROOT, 'bare.git'), dest]);
      assert.ok(
        fs.existsSync(path.join(dest, '.claude-plugin', 'marketplace.json')),
        'clone should reconstruct the committed marketplace.json in a working tree'
      );
      assert.ok(fs.existsSync(path.join(dest, 'alpha-mod', 'skills', 'alpha-mod-skill', 'SKILL.md')));
    });

    await test('enumerateCustomSource() reads the cloned working tree → discovery mode with correct codes', async () => {
      const dest = path.join(WORK_ROOT, 'clone-dest');
      const result = await enumerateCustomSource(toRelative(dest));
      assert.strictEqual(result.mode, 'discovery');
      const codes = result.plugins.map((p) => p.code).sort();
      assert.deepStrictEqual(codes, ['alpha-mod', 'beta-mod']);
    });

    console.log('\nGit-URL descriptor + ambient-credential posture (FR241, source-verified)');

    await test('pinned parseSource() classifies an intra-perimeter HTTPS URL as a remote Git URL', () => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const { CustomModuleManager } = require(CUSTOM_MODULE_MANAGER_PATH);
      const mgr = new CustomModuleManager();
      const d = mgr.parseSource('https://git.intra.example/team/bmad-marketplace.git@v1.2.0');
      assert.strictEqual(d.type, 'url');
      assert.strictEqual(d.isValid, true);
      assert.strictEqual(d.cloneUrl, 'https://git.intra.example/team/bmad-marketplace');
      assert.strictEqual(d.version, 'v1.2.0');
    });

    await test('pinned parseSource() classifies an SSH URL as a remote Git URL', () => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const { CustomModuleManager } = require(CUSTOM_MODULE_MANAGER_PATH);
      const mgr = new CustomModuleManager();
      const d = mgr.parseSource('git@git.intra.example:team/bmad-marketplace.git');
      assert.strictEqual(d.type, 'url');
      assert.strictEqual(d.isValid, true);
    });

    await test('bmad-method cloneRepo() uses GIT_TERMINAL_PROMPT=0 + process.env (ambient creds, zero token handling)', () => {
      // eslint-disable-next-line global-require
      const src = fs.readFileSync(require.resolve(CUSTOM_MODULE_MANAGER_PATH), 'utf8');
      assert.ok(src.includes("GIT_TERMINAL_PROMPT: '0'"), 'cloneRepo must disable interactive git prompting');
      assert.ok(src.includes('...process.env'), 'cloneRepo must pass ambient env (host git credentials)');
    });
  } finally {
    fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  }

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
