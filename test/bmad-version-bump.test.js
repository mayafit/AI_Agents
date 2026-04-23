#!/usr/bin/env node
/**
 * Tests for Story 22.1: Bump bmad-method to 6.3.0 and Rebuild Cache
 *
 * Task 1: Verify package.json dependency updated to 6.3.0
 * Task 2: Verify build:bmad-cache reads the new v6.3.0 registry layout
 * Task 3: Verify bmad.js CLI compatibility with bmad-cli.js entry point
 * Task 4: Verify prePopulateBmadCache compatibility
 *
 * Originally authored for Story 15.1 (6.2.2). Rewritten for Story 22.1
 * because bmad-method 6.3.0 moved:
 *   - `tools/bmad-npx-wrapper.js` → `tools/installer/bmad-cli.js`
 *   - `tools/cli/external-official-modules.yaml` → `tools/installer/modules/registry-fallback.yaml`
 *   - CLI command files: `tools/cli/commands/install.js` → `tools/installer/commands/install.js`
 * and retired the `wds` module from the upstream registry.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

const projectRoot = path.resolve(__dirname, '..');

console.log('\nStory 22.1: Bump bmad-method to 6.3.0 and Rebuild Cache\n');

// ---- Task 1: package.json dependency ----

console.log('Task 1: package.json dependency');

test('package.json pins bmad-method at 6.3.0 (exact, no caret/tilde)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.dependencies['bmad-method'], '6.3.0');
});

test('installed bmad-method is version 6.3.0', () => {
  const bmadPkg = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'node_modules', 'bmad-method', 'package.json'), 'utf8')
  );
  assert.strictEqual(bmadPkg.version, '6.3.0');
});

test('require.resolve finds bmad-cli.js (6.3.0 entry point)', () => {
  const resolved = require.resolve('bmad-method/tools/installer/bmad-cli.js');
  assert.ok(resolved.includes('bmad-cli.js'), `Unexpected path: ${resolved}`);
  assert.ok(fs.existsSync(resolved), `File does not exist: ${resolved}`);
});

// ---- Task 2: build:bmad-cache compatibility ----

console.log('\nTask 2: build:bmad-cache compatibility');

test('registry-fallback.yaml exists in 6.3.0', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'installer', 'modules', 'registry-fallback.yaml');
  assert.ok(fs.existsSync(yamlPath), `YAML not found at ${yamlPath}`);
});

test('legacy external-official-modules.yaml is absent in 6.3.0', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const legacyPath = path.join(bmadDir, 'tools', 'cli', 'external-official-modules.yaml');
  assert.ok(!fs.existsSync(legacyPath), `Legacy YAML unexpectedly found at ${legacyPath}`);
});

test('registry parser extracts 4 external modules from 6.3.0 (bmb, cis, gds, tea)', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'installer', 'modules', 'registry-fallback.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');

  // Replicate the parser logic from scripts/build-bmad-cache.js
  const modules = [];
  const lines = content.split('\n');
  let inModules = false;
  let currentModule = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === '' || trimmed.match(/^\s*#/)) continue;
    if (trimmed === 'modules:') { inModules = true; continue; }
    if (!inModules) continue;

    const moduleKeyMatch = trimmed.match(/^\s{1,4}([a-zA-Z0-9_-]+):\s*$/);
    if (moduleKeyMatch) {
      if (currentModule) modules.push(currentModule);
      currentModule = { key: moduleKeyMatch[1] };
      continue;
    }

    if (currentModule) {
      const propMatch = trimmed.match(/^\s{2,8}([a-zA-Z0-9_-]+):\s+"([^"]*)"$/);
      if (propMatch) {
        currentModule[propMatch[1]] = propMatch[2];
      } else {
        const unquotedMatch = trimmed.match(/^\s{2,8}([a-zA-Z0-9_-]+):\s+(.+)$/);
        if (unquotedMatch) {
          currentModule[unquotedMatch[1]] = unquotedMatch[2].trim();
        }
      }
    }
  }
  if (currentModule) modules.push(currentModule);

  const parsed = modules
    .filter(m => m.code && m.url)
    .filter(m => String(m.built_in || '').toLowerCase() !== 'true')
    .map(m => ({ code: m.code, url: m.url, name: m.name || m.key, branch: m.branch || 'main' }));

  const codes = parsed.map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'gds', 'tea'],
    `Unexpected module list: ${codes.join(', ')}`);
});

test('wds module is NOT in the v6.3.0 upstream registry (retired)', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'installer', 'modules', 'registry-fallback.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');
  assert.ok(!content.includes('code: wds'), 'wds code unexpectedly found in 6.3.0 registry');
  assert.ok(!content.includes('bmad-method-wds-expansion'), 'wds repo URL unexpectedly found in 6.3.0 registry');
});

test('built_in filter excludes core/bmm from external module list', () => {
  // Simulated parse of a v6.3.0-style entry to confirm the normalize rule.
  const raw = [
    { key: 'bmad-core', code: 'core', url: 'https://example.com/core', built_in: 'true' },
    { key: 'bmad-method', code: 'bmm', url: 'https://example.com/bmm', built_in: 'true' },
    { key: 'bmad-builder', code: 'bmb', url: 'https://example.com/bmb' },
  ];
  const filtered = raw
    .filter(m => m.code && m.url)
    .filter(m => String(m.built_in || '').toLowerCase() !== 'true');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].code, 'bmb');
});

test('cache-manifest.json exists and records bmadMethodVersion 6.3.0', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(fs.existsSync(manifestPath), `Manifest not found at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.bmadMethodVersion, '6.3.0');
});

test('cache-manifest.json contains at least the v6.3.0 official modules (bmb, cis, gds, tea)', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const codes = Object.keys(manifest.modules);
  for (const required of ['bmb', 'cis', 'gds', 'tea']) {
    assert.ok(codes.includes(required), `Manifest missing required module ${required}. Got: ${codes.join(', ')}`);
  }
});

test('each cached module has a commit SHA in manifest', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [code, info] of Object.entries(manifest.modules)) {
    assert.ok(info.commitSha, `Module ${code} missing commitSha`);
    assert.ok(info.commitSha.match(/^[a-f0-9]+$/), `Module ${code} has invalid SHA: ${info.commitSha}`);
  }
});

test('all non-retired cached modules have _git_preserved directory', () => {
  // Read module codes from the manifest rather than hardcoding so the test
  // adapts automatically when upstream adds or renames modules. Exclude
  // entries flagged retiredUpstream — those are preserved as-is and may lag
  // behind a current rebuild.
  const cacheDir = path.join(projectRoot, 'lib', 'bmad-cache');
  const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, 'cache-manifest.json'), 'utf8'));
  const liveModules = Object.entries(manifest.modules || {})
    .filter(([, info]) => !info.retiredUpstream)
    .map(([code]) => code);
  assert.ok(liveModules.length > 0, 'Manifest has no non-retired modules — did the cache build fail?');
  for (const mod of liveModules) {
    const preserved = path.join(cacheDir, mod, '_git_preserved');
    assert.ok(fs.existsSync(preserved), `${mod} missing _git_preserved at ${preserved}`);
  }
});

test('retired upstream modules (e.g. wds) are flagged in manifest when retained', () => {
  // AC #7: retired modules must be preserved in the manifest with an explicit
  // flag until a maintainer confirms deletion. If the wds directory is still
  // on disk, the manifest entry MUST carry retiredUpstream: true. If the
  // directory has been removed, the manifest must not list wds at all.
  const cacheDir = path.join(projectRoot, 'lib', 'bmad-cache');
  const manifestPath = path.join(cacheDir, 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const wdsDirExists = fs.existsSync(path.join(cacheDir, 'wds'));
  const wdsManifest = manifest.modules.wds;

  if (wdsDirExists) {
    assert.ok(wdsManifest, 'wds is on disk but not in manifest');
    assert.strictEqual(wdsManifest.retiredUpstream, true,
      'wds directory exists but manifest does not flag it as retiredUpstream');
  } else {
    // Either wds was never cached or was removed after maintainer confirmation.
    // Both states are acceptable — just ensure the manifest does not carry a
    // dangling entry.
    assert.ok(!wdsManifest || wdsManifest.retiredUpstream === true,
      'wds in manifest but directory is missing (dangling entry)');
  }
});

// ---- Task 3: bmad.js CLI compatibility ----

console.log('\nTask 3: bmad.js CLI compatibility');

const bmad = require('../lib/bmad');

test('getBmadCommand resolves bmad-cli.js from 6.3.0', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('bmad-cli.js'), `Expected bmad-cli.js path in: ${result}`);
  assert.ok(result.startsWith('node "'), `Expected node command prefix: ${result}`);
});

test('buildBmadArgs generates valid --action update flag', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm', 'bmb'],
    tools: ['claude-code'],
    action: 'update',
  });
  assert.ok(result.includes('--action update'), `Expected --action update in: ${result}`);
});

// Helper: locate the CLI install command across both the legacy and v6.3.0
// layouts so the flag-existence checks below survive minor reorganizations
// within bmad-method itself.
function readInstallCommand() {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const candidates = [
    path.join(bmadDir, 'tools', 'installer', 'commands', 'install.js'),
    path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, content: fs.readFileSync(candidate, 'utf8') };
    }
  }
  throw new Error(`install.js not found in any known location: ${candidates.join(', ')}`);
}

test('6.3.0 CLI accepts --directory flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--directory'), '6.3.0 install.js missing --directory flag');
});

test('6.3.0 CLI accepts --modules flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--modules'), '6.3.0 install.js missing --modules flag');
});

test('6.3.0 CLI accepts --tools flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--tools'), '6.3.0 install.js missing --tools flag');
});

test('6.3.0 CLI accepts the current custom-module flag', () => {
  // bmad-method 6.3.0 renamed --custom-content to --custom-source.
  // Accept either so the test survives both versions during bisects and
  // documents the rename.
  const { content } = readInstallCommand();
  const hasFlag = content.includes('--custom-source') || content.includes('--custom-content');
  assert.ok(hasFlag, '6.3.0 install.js missing both --custom-source and --custom-content flags');
});

test('buildBmadArgs uses --custom-source on v6.3.0 (was --custom-content on v6.2.x)', () => {
  // Verify the dynamic flag resolver picks the right name for the installed
  // bmad-method. On v6.3.0 it must be --custom-source; on v6.2.x it stays
  // --custom-content. This is what makes AC #6 (scratch install) work.
  const flag = bmad.resolveCustomContentFlag();
  assert.ok(['--custom-source', '--custom-content'].includes(flag),
    `Unexpected flag returned: ${flag}`);
  // Since we pin 6.3.0 in this repo, assert the specific value:
  assert.strictEqual(flag, '--custom-source',
    `Expected --custom-source for bmad-method 6.3.0, got ${flag}`);
});

test('6.3.0 CLI accepts --action flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--action'), '6.3.0 install.js missing --action flag');
});

test('6.3.0 CLI accepts --yes flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--yes'), '6.3.0 install.js missing --yes flag');
});

test('6.3.0 CLI accepts --user-name flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--user-name'), '6.3.0 install.js missing --user-name flag');
});

test('6.3.0 CLI accepts --communication-language flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--communication-language'), '6.3.0 install.js missing --communication-language flag');
});

test('6.3.0 CLI accepts --document-output-language flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--document-output-language'), '6.3.0 install.js missing --document-output-language flag');
});

test('6.3.0 CLI accepts --output-folder flag', () => {
  const { content } = readInstallCommand();
  assert.ok(content.includes('--output-folder'), '6.3.0 install.js missing --output-folder flag');
});

test('module.yaml custom-content format is still referenced by 6.3.0 installer', () => {
  // 6.3.0 consolidated the custom-module flow into
  // tools/installer/modules/custom-module-manager.js (the legacy
  // tools/cli/installers/lib/custom/handler.js was removed). Verify the
  // new entry point still references module.yaml so the extension ma-agents
  // ships (lib/bmad-extension/module.yaml) is still a valid custom module
  // payload.
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const candidates = [
    path.join(bmadDir, 'tools', 'installer', 'modules', 'custom-module-manager.js'),
    path.join(bmadDir, 'tools', 'installer', 'installers', 'lib', 'custom', 'handler.js'),
    path.join(bmadDir, 'tools', 'cli', 'installers', 'lib', 'custom', 'handler.js'),
  ];
  let found = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      if (content.includes('module.yaml')) {
        found = candidate;
        break;
      }
    }
  }
  assert.ok(found, `No known custom-module entry references module.yaml. Checked: ${candidates.join(', ')}`);
});

// ---- Task 4: prePopulateBmadCache compatibility ----

console.log('\nTask 4: prePopulateBmadCache compatibility');

test('prePopulateBmadCache is exported', () => {
  assert.strictEqual(typeof bmad.prePopulateBmadCache, 'function');
});

test('prePopulateBmadCache source handles all cache modules dynamically', () => {
  // The function iterates fs.readdir(cacheSource) and handles any number of
  // modules, so it automatically absorbs v6.3.0 changes (fewer or renamed
  // modules) without code changes.
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('fs.readdir(cacheSource)'), 'prePopulateBmadCache should iterate cache directory');
  assert.ok(!bmadSource.includes("['bmb',"), 'prePopulateBmadCache should not hardcode module list');
});

test('restoreGitDir logic exists in bmad.js', () => {
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('restoreGitDir'), 'Missing restoreGitDir function');
  assert.ok(bmadSource.includes('_git_preserved'), 'Missing _git_preserved reference');
  assert.ok(bmadSource.includes('file://'), 'Missing file:// URL for offline fetch');
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
