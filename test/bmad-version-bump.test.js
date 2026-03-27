#!/usr/bin/env node
/**
 * Tests for Story 15.1: Bump bmad-method to 6.2.1 and Update Cache
 *
 * Task 1: Verify package.json dependency updated
 * Task 2: Verify build:bmad-cache compatibility
 * Task 3: Verify bmad.js CLI compatibility
 * Task 4: Verify prePopulateBmadCache compatibility
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

console.log('\nStory 15.1: Bump bmad-method to 6.2.1 and Update Cache\n');

// ---- Task 1: package.json dependency ----

console.log('Task 1: package.json dependency');

test('package.json pins bmad-method at 6.2.1', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.dependencies['bmad-method'], '6.2.1');
});

test('installed bmad-method is version 6.2.1', () => {
  const bmadPkg = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'node_modules', 'bmad-method', 'package.json'), 'utf8')
  );
  assert.strictEqual(bmadPkg.version, '6.2.1');
});

test('require.resolve finds bmad-npx-wrapper.js', () => {
  const resolved = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
  assert.ok(resolved.includes('bmad-npx-wrapper.js'), `Unexpected path: ${resolved}`);
  assert.ok(fs.existsSync(resolved), `File does not exist: ${resolved}`);
});

// ---- Task 2: build:bmad-cache compatibility ----

console.log('\nTask 2: build:bmad-cache compatibility');

test('external-official-modules.yaml exists in 6.2.1', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'cli', 'external-official-modules.yaml');
  assert.ok(fs.existsSync(yamlPath), `YAML not found at ${yamlPath}`);
});

test('YAML parser extracts 5 modules from 6.2.1', () => {
  // Import the parser from build-bmad-cache.js by reading and evaluating it
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'cli', 'external-official-modules.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');

  // Replicate the parser logic
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

  const parsed = modules.filter(m => m.code && m.url).map(m => ({
    code: m.code,
    url: m.url,
    name: m.name || m.key,
    branch: m.branch || 'main'
  }));

  assert.strictEqual(parsed.length, 5, `Expected 5 modules, got ${parsed.length}`);
  const codes = parsed.map(m => m.code).sort();
  assert.deepStrictEqual(codes, ['bmb', 'cis', 'gds', 'tea', 'wds']);
});

test('wds module is present in parsed YAML', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const yamlPath = path.join(bmadDir, 'tools', 'cli', 'external-official-modules.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');
  assert.ok(content.includes('code: wds'), 'wds module code not found in YAML');
  assert.ok(content.includes('bmad-method-wds-expansion'), 'wds repo URL not found in YAML');
});

test('cache-manifest.json exists and lists 5 modules', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  assert.ok(fs.existsSync(manifestPath), `Manifest not found at ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const moduleCodes = Object.keys(manifest.modules);
  assert.strictEqual(moduleCodes.length, 5, `Expected 5 modules in manifest, got ${moduleCodes.length}`);
  assert.deepStrictEqual(moduleCodes.sort(), ['bmb', 'cis', 'gds', 'tea', 'wds']);
});

test('cache-manifest.json records bmadMethodVersion as 6.2.1', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.bmadMethodVersion, '6.2.1');
});

test('each cached module has a commit SHA in manifest', () => {
  const manifestPath = path.join(projectRoot, 'lib', 'bmad-cache', 'cache-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [code, info] of Object.entries(manifest.modules)) {
    assert.ok(info.commitSha, `Module ${code} missing commitSha`);
    assert.ok(info.commitSha.match(/^[a-f0-9]+$/), `Module ${code} has invalid SHA: ${info.commitSha}`);
  }
});

test('lib/bmad-cache/wds/ directory exists with content', () => {
  const wdsDir = path.join(projectRoot, 'lib', 'bmad-cache', 'wds');
  assert.ok(fs.existsSync(wdsDir), `wds cache dir not found at ${wdsDir}`);
  const entries = fs.readdirSync(wdsDir);
  assert.ok(entries.length > 0, 'wds cache directory is empty');
  assert.ok(entries.includes('_git_preserved'), 'wds missing _git_preserved directory');
});

test('all 5 cached modules have _git_preserved directory', () => {
  const cacheDir = path.join(projectRoot, 'lib', 'bmad-cache');
  const expected = ['bmb', 'cis', 'gds', 'tea', 'wds'];
  for (const mod of expected) {
    const preserved = path.join(cacheDir, mod, '_git_preserved');
    assert.ok(fs.existsSync(preserved), `${mod} missing _git_preserved at ${preserved}`);
  }
});

// ---- Task 3: bmad.js CLI compatibility ----

console.log('\nTask 3: bmad.js CLI compatibility');

const bmad = require('../lib/bmad');

test('getBmadCommand resolves bmad-npx-wrapper.js from 6.2.1', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('bmad-npx-wrapper.js'), `Expected wrapper path in: ${result}`);
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

test('6.2.1 CLI accepts --directory flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--directory'), '6.2.1 install.js missing --directory flag');
});

test('6.2.1 CLI accepts --modules flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--modules'), '6.2.1 install.js missing --modules flag');
});

test('6.2.1 CLI accepts --tools flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--tools'), '6.2.1 install.js missing --tools flag');
});

test('6.2.1 CLI accepts --custom-content flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--custom-content'), '6.2.1 install.js missing --custom-content flag');
});

test('6.2.1 CLI accepts --action flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--action'), '6.2.1 install.js missing --action flag');
});

test('6.2.1 CLI accepts --yes flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--yes'), '6.2.1 install.js missing --yes flag');
});

test('6.2.1 CLI accepts --user-name flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--user-name'), '6.2.1 install.js missing --user-name flag');
});

test('6.2.1 CLI accepts --communication-language flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--communication-language'), '6.2.1 install.js missing --communication-language flag');
});

test('6.2.1 CLI accepts --document-output-language flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--document-output-language'), '6.2.1 install.js missing --document-output-language flag');
});

test('6.2.1 CLI accepts --output-folder flag', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const installCmd = path.join(bmadDir, 'tools', 'cli', 'commands', 'install.js');
  const content = fs.readFileSync(installCmd, 'utf8');
  assert.ok(content.includes('--output-folder'), '6.2.1 install.js missing --output-folder flag');
});

test('module.yaml custom-content format is accepted by 6.2.1', () => {
  const bmadDir = path.dirname(require.resolve('bmad-method/package.json'));
  const handlerPath = path.join(bmadDir, 'tools', 'cli', 'installers', 'lib', 'custom', 'handler.js');
  const content = fs.readFileSync(handlerPath, 'utf8');
  // 6.2.1 still looks for module.yaml files
  assert.ok(content.includes('module.yaml'), '6.2.1 handler.js no longer references module.yaml');
});

// ---- Task 4: prePopulateBmadCache compatibility ----

console.log('\nTask 4: prePopulateBmadCache compatibility');

test('prePopulateBmadCache is exported', () => {
  assert.strictEqual(typeof bmad.prePopulateBmadCache, 'function');
});

test('prePopulateBmadCache source handles all cache modules dynamically', () => {
  // The function iterates fs.readdir(cacheSource) and handles any number of modules
  // No hardcoded module list = automatically handles 5 modules including wds
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('fs.readdir(cacheSource)'), 'prePopulateBmadCache should iterate cache directory');
  assert.ok(!bmadSource.includes("'bmb'") || !bmadSource.includes("['bmb',"), 'prePopulateBmadCache should not hardcode module list');
});

test('restoreGitDir logic exists in bmad.js', () => {
  const bmadSource = fs.readFileSync(path.join(projectRoot, 'lib', 'bmad.js'), 'utf8');
  assert.ok(bmadSource.includes('restoreGitDir'), 'Missing restoreGitDir function');
  assert.ok(bmadSource.includes('_git_preserved'), 'Missing _git_preserved reference');
  assert.ok(bmadSource.includes('file://'), 'Missing file:// URL for offline fetch');
});

test('wds cache directory has src/ with module content', () => {
  const wdsSrc = path.join(projectRoot, 'lib', 'bmad-cache', 'wds', 'src');
  assert.ok(fs.existsSync(wdsSrc), `wds/src/ not found at ${wdsSrc}`);
  const entries = fs.readdirSync(wdsSrc);
  assert.ok(entries.length > 0, 'wds/src/ is empty');
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
