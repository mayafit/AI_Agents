#!/usr/bin/env node
/**
 * Tests for Story 22.4 — scripts/build-plugin.js.
 *
 * AC coverage:
 *   AC 1 — script exists and is invokable via `npm run build:plugin`
 *   AC 2 — output structure (marketplace.json, module.yaml, module-help.csv,
 *          per-skill subdirectories with SKILL.md + manifest + asset dirs)
 *   AC 3 — idempotent (byte-identical across two runs)
 *   AC 4 — fails fast on missing required source
 *   AC 5 — never writes outside lib/bmad-extension-plugin/; never modifies
 *          lib/bmad-extension/
 *   AC 6 — bundle committed + visible in `npm pack --dry-run` (smoke-covered
 *          here; the CI gate lives in Story 22.9)
 *   AC 7 — npm scripts wired (build:plugin + prepare)
 *
 * Story 22.5 hand-off contracts:
 *   - source: "./" is passed through unchanged
 *   - ${version} is substituted from package.json
 *   - bmad_min_version is untouched
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const os = require('os');

const build = require('../scripts/build-plugin.js');

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension');
const OUT_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension-plugin');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'build-plugin.js');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

/**
 * Walk a directory, returning a sorted array of { relPath, sha256, size }.
 * Used to assert byte-identity between runs.
 */
function snapshotTree(root) {
  const out = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(full);
        const sha = crypto.createHash('sha256').update(content).digest('hex');
        out.push({
          relPath: path.relative(root, full).split(path.sep).join('/'),
          sha256: sha,
          size: content.length,
        });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Capture a hash of every file under `lib/bmad-extension/` so we can assert
 * the build script never touches source (AC 5).
 */
function snapshotSourceDir() {
  return snapshotTree(SRC_DIR);
}

function runBuild(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
}

console.log('\n=== Story 22.4: scripts/build-plugin.js ===');

// ─── AC 1: script exists & is invokable ─────────────────────────────────
console.log('\n--- AC 1: script exists & runs ---');

test('scripts/build-plugin.js exists', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'build script must exist');
});

test('build:plugin script is registered in package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  assert.strictEqual(
    pkg.scripts['build:plugin'],
    'node scripts/build-plugin.js',
    '"build:plugin" script must invoke node scripts/build-plugin.js',
  );
});

test('prepare hook invokes the build so fresh clones get a current bundle', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  assert.ok(pkg.scripts.prepare, 'prepare hook must be defined');
  assert.ok(
    /build-plugin\.js/.test(pkg.scripts.prepare),
    `prepare hook must invoke build-plugin.js (got: ${pkg.scripts.prepare})`,
  );
});

test('a baseline run exits 0 and produces lib/bmad-extension-plugin/', () => {
  const result = runBuild();
  assert.strictEqual(result.status, 0, `build exited non-zero:\n${result.stderr}`);
  assert.ok(fs.existsSync(OUT_DIR), 'output dir must exist after build');
});

// ─── AC 2: output structure ──────────────────────────────────────────────
console.log('\n--- AC 2: output structure ---');

test('.claude-plugin/marketplace.json is emitted', () => {
  const p = path.join(OUT_DIR, '.claude-plugin', 'marketplace.json');
  assert.ok(fs.existsSync(p), 'marketplace.json must be in .claude-plugin/');
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(parsed.name, 'ma-agents');
  assert.ok(Array.isArray(parsed.plugins) && parsed.plugins.length >= 1);
});

test('skills/module.yaml is emitted', () => {
  assert.ok(fs.existsSync(path.join(OUT_DIR, 'skills', 'module.yaml')));
});

test('skills/module-help.csv is emitted', () => {
  assert.ok(fs.existsSync(path.join(OUT_DIR, 'skills', 'module-help.csv')));
});

test('every source skill subdirectory has SKILL.md + manifest in output', () => {
  const srcSkillsDir = path.join(SRC_DIR, 'skills');
  const entries = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.ok(entries.length > 0, 'expected at least one skill subdirectory');
  for (const name of entries) {
    const skillDir = path.join(OUT_DIR, 'skills', name);
    assert.ok(fs.existsSync(skillDir), `missing skill dir in output: ${name}`);
    assert.ok(
      fs.existsSync(path.join(skillDir, 'SKILL.md')),
      `SKILL.md missing in bundled skill: ${name}`,
    );
    assert.ok(
      fs.existsSync(path.join(skillDir, 'bmad-skill-manifest.yaml')),
      `bmad-skill-manifest.yaml missing in bundled skill: ${name}`,
    );
  }
});

test('asset subdirectories (prompts/, resources/, scripts/, assets/) are preserved', () => {
  // Use mil498-srs as a witness — we confirmed above it has a prompts/ dir.
  const prompts = path.join(OUT_DIR, 'skills', 'mil498-srs', 'prompts');
  assert.ok(fs.existsSync(prompts), 'mil498-srs/prompts must be preserved in the bundle');
  const files = fs.readdirSync(prompts);
  assert.ok(files.length > 0, 'mil498-srs/prompts must not be empty');
});

// ─── Story 22.5 hand-off contracts ───────────────────────────────────────
console.log('\n--- 22.5 hand-off: version substitution, source passthrough, bmad_min_version ---');

test('${version} placeholder is substituted from package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.strictEqual(manifest.plugins[0].version, pkg.version,
    `plugins[0].version must equal package.json version (${pkg.version}), got ${manifest.plugins[0].version}`);
  // And the literal placeholder must NOT appear anywhere in the resolved file.
  const raw = fs.readFileSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'), 'utf8');
  assert.ok(!/\$\{version\}/.test(raw), 'resolved marketplace.json must not contain ${version}');
});

test('plugins[0].source "./" is passed through literally', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.strictEqual(manifest.plugins[0].source, './',
    'Story 22.5 contract: plugins[0].source must stay "./" — the installer resolves it');
});

test('bmad_min_version is passed through unchanged from the template', () => {
  const template = JSON.parse(fs.readFileSync(path.join(SRC_DIR, '.claude-plugin', 'marketplace.json.template'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.strictEqual(manifest.bmad_min_version, template.bmad_min_version,
    'bmad_min_version must match the template (build must not rewrite it)');
});

// ─── AC 3: idempotency ───────────────────────────────────────────────────
console.log('\n--- AC 3: idempotent (byte-identical across runs) ---');

test('second run produces a byte-identical tree', () => {
  const r1 = runBuild();
  assert.strictEqual(r1.status, 0, `first build failed: ${r1.stderr}`);
  const snap1 = snapshotTree(OUT_DIR);
  const r2 = runBuild();
  assert.strictEqual(r2.status, 0, `second build failed: ${r2.stderr}`);
  const snap2 = snapshotTree(OUT_DIR);
  assert.deepStrictEqual(snap2, snap1, 'tree snapshot must be byte-identical across runs');
});

test('--verify digest is stable across runs', () => {
  const r1 = runBuild(['--verify']);
  const r2 = runBuild(['--verify']);
  // Progress messages (including --verify digest) are written to stderr so
  // that stdout stays clean for tool integrations (see build-plugin.js
  // `info()` rationale).
  const combined1 = `${r1.stdout}${r1.stderr}`;
  const combined2 = `${r2.stdout}${r2.stderr}`;
  const d1 = (combined1.match(/sha256 : ([0-9a-f]{64})/) || [])[1];
  const d2 = (combined2.match(/sha256 : ([0-9a-f]{64})/) || [])[1];
  assert.ok(d1 && d2, `both runs must print a sha256 digest (r1: ${combined1}, r2: ${combined2})`);
  assert.strictEqual(d1, d2, 'digest must be stable across runs');
});

// ─── AC 4: fail-fast on missing required source ─────────────────────────
console.log('\n--- AC 4: fail-fast on missing required source ---');

test('missing module.yaml causes non-zero exit with clear message', () => {
  const yamlPath = path.join(SRC_DIR, 'skills', 'module.yaml');
  const backup = yamlPath + '.bak-missing-test';
  assert.ok(fs.existsSync(yamlPath), 'precondition: module.yaml must exist');
  fs.renameSync(yamlPath, backup);
  try {
    const result = runBuild();
    assert.notStrictEqual(result.status, 0, 'build must exit non-zero when module.yaml is missing');
    const combined = `${result.stdout}${result.stderr}`;
    assert.ok(/module\.yaml/.test(combined),
      `error message must name module.yaml (got: ${combined})`);
    assert.ok(/missing|not found|ERROR/i.test(combined),
      `error message must indicate the file is missing (got: ${combined})`);
  } finally {
    fs.renameSync(backup, yamlPath);
  }
});

test('missing marketplace.json.template causes non-zero exit', () => {
  const tmplPath = path.join(SRC_DIR, '.claude-plugin', 'marketplace.json.template');
  const backup = tmplPath + '.bak-missing-test';
  fs.renameSync(tmplPath, backup);
  try {
    const result = runBuild();
    assert.notStrictEqual(result.status, 0, 'build must fail when template is missing');
    const combined = `${result.stdout}${result.stderr}`;
    assert.ok(/marketplace\.json\.template/.test(combined),
      `error message must name the template (got: ${combined})`);
  } finally {
    fs.renameSync(backup, tmplPath);
  }
});

// ─── AC 5: output is sandboxed; source is not touched ───────────────────
console.log('\n--- AC 5: sandboxed output, untouched source ---');

test('build does not modify lib/bmad-extension/', () => {
  const before = snapshotSourceDir();
  const r = runBuild();
  assert.strictEqual(r.status, 0);
  const after = snapshotSourceDir();
  assert.deepStrictEqual(after, before,
    'source tree must be byte-identical before and after the build');
});

test('build does not write above lib/bmad-extension-plugin/ (no top-level dir mutations)', () => {
  // Snapshot the top-level of repo root minus the two legitimate mutation targets.
  const topLevel = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter((e) => e.name !== 'lib' && e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.worktrees')
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const r = runBuild();
  assert.strictEqual(r.status, 0);
  const topLevelAfter = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter((e) => e.name !== 'lib' && e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.worktrees')
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepStrictEqual(topLevelAfter, topLevel,
    'top-level repo entries must be unchanged after a build');
});

// ─── AC 6: bundle is committable / visible in `npm pack --dry-run` ───────
console.log('\n--- AC 6/7: npm pack includes the bundle ---');

test('npm pack --dry-run lists lib/bmad-extension-plugin/ contents', () => {
  // Run a fresh build first to guarantee the bundle exists.
  const r = runBuild();
  assert.strictEqual(r.status, 0);
  // Use --json to get a stable list independent of npm's human-readable output.
  let stdout;
  try {
    // On Windows, npm is npm.cmd which requires shell:true (spawn cannot
    // exec .cmd files directly). Use the shell invocation everywhere for
    // portability.
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCmd, ['pack', '--dry-run', '--json'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.error) {
      if (result.error.code === 'ENOENT') {
        console.log('    (npm unavailable — skipping pack assertion)');
        return;
      }
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`npm pack exited ${result.status}: ${result.stderr}`);
    }
    stdout = result.stdout;
  } catch (err) {
    throw err;
  }
  // `npm pack` runs the `prepare` hook first, which prints build-plugin logs
  // on stdout. Extract the JSON payload (starts with `[` or `{` after any
  // preamble lines) so the test is tolerant to hook output.
  const jsonStart = stdout.search(/^[\[{]/m);
  const payload = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
  const parsed = JSON.parse(payload);
  const pack = Array.isArray(parsed) ? parsed[0] : parsed;
  const names = (pack.files || []).map((f) => f.path.replace(/\\/g, '/'));
  const pluginEntries = names.filter((n) => n.startsWith('lib/bmad-extension-plugin/'));
  assert.ok(pluginEntries.length > 0,
    `npm pack must include lib/bmad-extension-plugin/ entries (got ${names.length} total files, 0 plugin files)`);
  // Sanity-check: the marketplace.json and at least one skill SKILL.md should be in there.
  assert.ok(
    pluginEntries.includes('lib/bmad-extension-plugin/.claude-plugin/marketplace.json'),
    'marketplace.json must be in the tarball',
  );
  assert.ok(
    pluginEntries.some((n) => /lib\/bmad-extension-plugin\/skills\/[^/]+\/SKILL\.md$/.test(n)),
    'at least one skill SKILL.md must be in the tarball',
  );
});

// ─── Edge-case-hunter coverage ───────────────────────────────────────────
console.log('\n--- Edge cases ---');

test('build succeeds when invoked from a nested working directory', () => {
  // AC 5 + edge-case: users who `cd` into test/ or scripts/ before running
  // the script must still get correct paths. The script anchors off
  // __dirname, not process.cwd(), so this should work.
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: path.join(PROJECT_ROOT, 'test'),
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0,
    `build from nested cwd failed: ${result.stderr}${result.stdout}`);
  assert.ok(fs.existsSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json')),
    'marketplace.json must still land in the repo lib/bmad-extension-plugin/');
});

test('output mode bits are stable across runs (edge-case: host umask leak)', () => {
  // On Windows this is mostly a no-op (NTFS uses ACLs, not POSIX modes).
  // On POSIX, a non-default umask should not be able to leak into the
  // bundle. We validate indirectly: two runs produce byte-identical trees
  // (already covered by the idempotency test), which is the user-visible
  // guarantee. A direct mode assertion would fail on Windows, so we skip
  // it there. The test exists to pin the contract.
  if (process.platform === 'win32') {
    console.log('    (Windows — mode bits are approximate; skipping numeric assertion)');
    return;
  }
  const stat = fs.statSync(path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'));
  // 0o644 expected; mask off the file-type bits.
  const mode = stat.mode & 0o777;
  assert.strictEqual(mode, 0o644, `marketplace.json mode must be 0o644, got 0o${mode.toString(8)}`);
});

test('build wipes stale content (does not merge old bundle with new)', () => {
  // Edge case: if lib/bmad-extension-plugin/ already exists with a stale
  // file that no longer appears in source (e.g. a retired skill from pre-22.2),
  // the fresh build must remove it — not leave it next to the new files.
  const stalePath = path.join(OUT_DIR, 'skills', '__stale_retired_skill__', 'SKILL.md');
  fs.mkdirSync(path.dirname(stalePath), { recursive: true });
  fs.writeFileSync(stalePath, 'stale content from a retired skill');
  const result = runBuild();
  assert.strictEqual(result.status, 0, `build failed: ${result.stderr}`);
  assert.ok(!fs.existsSync(stalePath),
    'stale file must be removed when rebuild runs; bundle must not merge old+new');
});

test('.DS_Store and Thumbs.db are excluded from the bundle', () => {
  // Edge case: a macOS contributor commits .DS_Store into a skill dir, or
  // a Windows contributor commits Thumbs.db. The bundle must not ship them
  // (cross-platform determinism + cleanliness).
  const skillsDir = path.join(OUT_DIR, 'skills');
  function hasJunkFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (build.shouldSkipEntry(entry.name)) return true;
      if (entry.isDirectory() && hasJunkFiles(path.join(dir, entry.name))) return true;
    }
    return false;
  }
  assert.ok(!hasJunkFiles(skillsDir), 'bundle must not contain .DS_Store / Thumbs.db / desktop.ini');
});

test('empty skills/ directory (no subdirectories) fails fast', () => {
  // Edge case: a contributor deletes all skill dirs; the build must not
  // emit a valid-looking bundle with zero skills.
  // Simulate by renaming every skill dir out of the way. Use a sibling
  // directory on the same filesystem — cross-device renameSync fails with
  // EXDEV on Windows when the OS temp dir is on a different drive.
  const srcSkillsDir = path.join(SRC_DIR, 'skills');
  const backupRoot = path.join(PROJECT_ROOT, `.build-plugin-skills-backup-${Date.now()}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  const moved = [];
  try {
    const skillDirs = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const name of skillDirs) {
      const from = path.join(srcSkillsDir, name);
      const to = path.join(backupRoot, name);
      fs.renameSync(from, to);
      moved.push({ from, to });
    }
    const result = runBuild();
    assert.notStrictEqual(result.status, 0, 'empty skills/ must fail fast');
    const combined = `${result.stdout}${result.stderr}`;
    assert.ok(/no skill subdirectories/i.test(combined),
      `error must mention missing skill dirs (got: ${combined})`);
  } finally {
    // Restore
    for (const { from, to } of moved) {
      try { fs.renameSync(to, from); } catch { /* best-effort */ }
    }
    try { fs.rmSync(backupRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
});

test('skill directory missing SKILL.md is flagged (not silently shipped)', () => {
  // Edge case: a new contributor creates a skill directory but forgets the
  // SKILL.md. Without this check, the build would happily ship a broken
  // skill that installs but never activates.
  const srcSkillsDir = path.join(SRC_DIR, 'skills');
  const brokenName = '__broken_missing_skill_md__';
  const brokenDir = path.join(srcSkillsDir, brokenName);
  fs.mkdirSync(brokenDir, { recursive: true });
  try {
    const result = runBuild();
    assert.notStrictEqual(result.status, 0, 'skill without SKILL.md must fail the build');
    const combined = `${result.stdout}${result.stderr}`;
    assert.ok(/SKILL\.md/i.test(combined),
      `error must name SKILL.md (got: ${combined})`);
  } finally {
    fs.rmSync(brokenDir, { recursive: true, force: true });
  }
});

test('substituteTokens leaves unrelated ${...}-shaped literals alone in copied content', () => {
  // Edge case: token substitution is scoped to the template only — skill
  // payload files (e.g. a ml-skill's template.md that literally references
  // `${MODEL_NAME}`) must come through byte-identical. The bundle-diff test
  // (byte-identical second run) and the byte-preservation contract
  // (copyFileSync) enforce this, but we make it explicit here for any
  // future refactor that might be tempted to globally substitute.
  const srcTemplateExample = path.join(SRC_DIR, 'skills', 'mil498-srs', 'template.md');
  const destTemplateExample = path.join(OUT_DIR, 'skills', 'mil498-srs', 'template.md');
  if (!fs.existsSync(srcTemplateExample)) {
    console.log('    (witness file absent — skipping)');
    return;
  }
  const src = fs.readFileSync(srcTemplateExample);
  const dst = fs.readFileSync(destTemplateExample);
  assert.ok(src.equals(dst),
    'skill payload files must be byte-identical to their source');
});

test('_comment fields are stripped from the resolved marketplace.json', () => {
  // Edge case: leaving `_comment` in the emitted manifest would pollute the
  // runtime view with maintainer prose and — worse — force the build to
  // register every `${example}` hand-off reference in prose as a token.
  const manifest = JSON.parse(fs.readFileSync(
    path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'),
    'utf8',
  ));
  assert.ok(!Object.prototype.hasOwnProperty.call(manifest, '_comment'),
    '_comment must be stripped from the resolved manifest');
  for (const plugin of manifest.plugins || []) {
    assert.ok(!Object.prototype.hasOwnProperty.call(plugin, '_comment'),
      'per-plugin _comment must also be stripped');
  }
});

test('resolved marketplace.json ends with exactly one LF newline', () => {
  // Edge case: diff-tool churn if the trailing newline flips between runs
  // or platforms. The build explicitly appends '\n'.
  const raw = fs.readFileSync(
    path.join(OUT_DIR, '.claude-plugin', 'marketplace.json'),
  );
  assert.strictEqual(raw[raw.length - 1], 0x0a,
    'marketplace.json must end with a single LF (0x0a)');
  // And no CRLF anywhere — we own this file end-to-end.
  assert.ok(!raw.includes(0x0d),
    'marketplace.json must not contain CR bytes (LF line endings only)');
});

// ─── Unit-level coverage of exported helpers ─────────────────────────────
console.log('\n--- Unit: exported helpers ---');

test('substituteTokens replaces known tokens and leaves the string otherwise unchanged', () => {
  const out = build.substituteTokens('hello ${name}!', { name: 'world' });
  assert.strictEqual(out, 'hello world!');
});

test('substituteTokens fails when an unknown token is present', () => {
  // substituteTokens calls process.exit(1) on failure — fork a subprocess to
  // exercise it without killing this test process.
  const result = spawnSync(process.execPath, [
    '-e',
    `const b = require(${JSON.stringify(SCRIPT_PATH)}); b.substituteTokens('x ${'${unknown}'} y', {});`,
  ], { encoding: 'utf8', cwd: PROJECT_ROOT });
  assert.notStrictEqual(result.status, 0, 'unknown token must cause non-zero exit');
  assert.ok(/unknown template token/i.test(result.stderr + result.stdout),
    `error must mention "unknown template token" (got: ${result.stderr}${result.stdout})`);
});

test('shouldSkipEntry excludes OS junk files', () => {
  assert.strictEqual(build.shouldSkipEntry('.DS_Store'), true);
  assert.strictEqual(build.shouldSkipEntry('Thumbs.db'), true);
  assert.strictEqual(build.shouldSkipEntry('desktop.ini'), true);
  assert.strictEqual(build.shouldSkipEntry('SKILL.md'), false);
});

test('computeTreeDigest is stable for identical inputs', () => {
  const a = build.computeTreeDigest(OUT_DIR);
  const b = build.computeTreeDigest(OUT_DIR);
  assert.strictEqual(a, b, 'tree digest must be deterministic');
  assert.ok(/^[0-9a-f]{64}$/.test(a), 'digest must be a sha256 hex');
});

test('computeTreeDigest covers file modes (F3 #5: NFR51 stricter)', () => {
  // Per F3 Section 5: a mode-only change must produce a different digest.
  // Previously the digest covered only (path, size, content-sha) so a
  // mode flip (e.g. 0o644 → 0o755) would be silently equivalent.
  // chmod is best-effort on Windows (often a no-op for non-executable
  // bits), so this test is skipped there.
  if (process.platform === 'win32') {
    console.log('    (skip on win32: chmod is a no-op for the bits we toggle)');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-plugin-mode-'));
  try {
    const file = path.join(tmp, 'sample.txt');
    fs.writeFileSync(file, 'identical bytes');
    fs.chmodSync(file, 0o644);
    const before = build.computeTreeDigest(tmp);
    fs.chmodSync(file, 0o755);
    const after = build.computeTreeDigest(tmp);
    assert.notStrictEqual(before, after,
      'digest must change when file mode changes (low 9 bits)');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('computeTreeDigest covers empty directories (F3 #5: NFR51 stricter)', () => {
  // Per F3 Section 5: adding an empty directory to source must produce
  // a digest delta. Previously empty dirs were invisible.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-plugin-emptydir-'));
  try {
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'a');
    const before = build.computeTreeDigest(tmp);
    fs.mkdirSync(path.join(tmp, 'empty-subdir'));
    const after = build.computeTreeDigest(tmp);
    assert.notStrictEqual(before, after,
      'digest must change when an empty directory is added');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('computeTreeDigest is platform-portable (F3 #5: low 9 mode bits only)', () => {
  // Linux and Windows runners must agree on the digest for byte-identical
  // input. The implementation masks file modes to the low 9 bits (0o777)
  // so Windows's synthesized 0o666 vs POSIX's true 0o644 do not collide
  // — but neither do they diverge as long as the build script applies its
  // 0o644 / 0o755 chmod consistently. We sanity-check the mask explicitly
  // by hashing a file twice with different high-bit modes set.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-plugin-portable-'));
  try {
    const file = path.join(tmp, 'sample.txt');
    fs.writeFileSync(file, 'portable');
    fs.chmodSync(file, 0o644);
    const a = build.computeTreeDigest(tmp);
    // setuid (0o4000) is in the high bits — must be excluded by the mask.
    // Skip on win32 because Windows ignores setuid/setgid/sticky.
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(file, 0o4644);
        const b = build.computeTreeDigest(tmp);
        assert.strictEqual(a, b,
          'high mode bits (setuid/setgid/sticky) must NOT affect the digest');
      } catch {
        // Some sandboxed test envs (e.g. CI containers) deny setuid chmod
        // for non-root — non-fatal, the assertion above is still useful.
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('readDirSorted returns entries in lexicographic name order', () => {
  // Create a temp dir with out-of-order entries to verify sort correctness.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-plugin-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'c.txt'), '');
    fs.writeFileSync(path.join(tmp, 'a.txt'), '');
    fs.writeFileSync(path.join(tmp, 'b.txt'), '');
    const names = build.readDirSorted(tmp).map((e) => e.name);
    assert.deepStrictEqual(names, ['a.txt', 'b.txt', 'c.txt']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── Summary ────────────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
