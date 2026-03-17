#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '..', 'lib', 'bmad-cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'cache-manifest.json');
const force = process.argv.includes('--force');

/**
 * Locate and parse external-official-modules.yaml from bmad-method.
 * Uses a simple line-by-line parser to avoid adding js-yaml dependency.
 */
function loadModuleDefinitions() {
  // Locate bmad-method package
  let bmadMethodDir;
  try {
    bmadMethodDir = path.dirname(require.resolve('bmad-method/package.json'));
  } catch {
    console.error('Error: bmad-method package not found. Run "npm install" first.');
    process.exit(1);
  }

  const yamlPath = path.join(bmadMethodDir, 'tools', 'cli', 'external-official-modules.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error(`Error: external-official-modules.yaml not found at ${yamlPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(yamlPath, 'utf8');
  return parseModulesYaml(content);
}

/**
 * Simple YAML parser for the external-official-modules.yaml structure.
 * Parses top-level module keys under "modules:" and their properties.
 */
function parseModulesYaml(content) {
  const modules = [];
  const lines = content.split('\n');
  let inModules = false;
  let currentModule = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Skip comments and empty lines
    if (trimmed === '' || trimmed.match(/^\s*#/)) continue;

    // Detect the "modules:" top-level key
    if (trimmed === 'modules:') {
      inModules = true;
      continue;
    }

    if (!inModules) continue;

    // Detect a new module key (indented, no value — just "key:")
    const moduleKeyMatch = trimmed.match(/^\s{1,4}([a-zA-Z0-9_-]+):\s*$/);
    if (moduleKeyMatch) {
      if (currentModule) modules.push(currentModule);
      currentModule = { key: moduleKeyMatch[1] };
      continue;
    }

    // Detect a property of the current module (deeper indent, has a value)
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

  // Validate we got the required fields
  return modules.filter(m => m.code && m.url).map(m => ({
    code: m.code,
    url: m.url,
    name: m.name || m.key,
    branch: m.branch || 'main'
  }));
}

/**
 * Load existing cache manifest if present.
 */
function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Get the remote HEAD SHA for a given repo URL and branch.
 */
function getRemoteHead(url, branch) {
  try {
    const output = execFileSync('git', ['ls-remote', url, branch], { encoding: 'utf8', timeout: 30000 });
    const match = output.match(/^([a-f0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Clone, capture SHA, install deps, remove .git for a single module.
 */
function processModule(mod, manifest) {
  const moduleDir = path.join(CACHE_DIR, mod.code);

  // Incremental update check (AC #6)
  if (!force && fs.existsSync(moduleDir) && manifest) {
    const cachedInfo = manifest.modules && manifest.modules[mod.code];
    if (cachedInfo && cachedInfo.commitSha) {
      const remoteHead = getRemoteHead(mod.url, mod.branch);
      if (remoteHead && remoteHead === cachedInfo.commitSha) {
        console.log(`  ⏭  ${mod.code}: up-to-date (${cachedInfo.commitSha.substring(0, 7)}), skipping`);
        return { ...cachedInfo, skipped: true };
      }
      if (remoteHead) {
        console.log(`  🔄 ${mod.code}: outdated (cached: ${cachedInfo.commitSha.substring(0, 7)}, remote: ${remoteHead.substring(0, 7)}), rebuilding`);
      }
    }
  }

  // Remove existing module dir if present (force or outdated)
  if (fs.existsSync(moduleDir)) {
    fs.removeSync(moduleDir);
  }

  // Clone (AC #1)
  console.log(`  📥 ${mod.code}: cloning from ${mod.url} (branch: ${mod.branch})`);
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', mod.branch, mod.url, moduleDir], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000
    });
  } catch (err) {
    console.error(`  ❌ ${mod.code}: clone failed - ${err.message}`);
    return null;
  }

  // Capture commit SHA BEFORE removing .git (AC #4 - order matters)
  let commitSha = '';
  try {
    commitSha = execFileSync('git', ['-C', moduleDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    console.warn(`  ⚠  ${mod.code}: could not capture commit SHA`);
  }

  // Install production dependencies (AC #2)
  const pkgJsonPath = path.join(moduleDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        console.log(`  📦 ${mod.code}: installing production dependencies`);
        execFileSync('npm', ['install', '--omit=dev'], {
          cwd: moduleDir,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 120000,
          shell: process.platform === 'win32'
        });
      } else {
        console.log(`  📦 ${mod.code}: no production dependencies, skipping npm install`);
      }
    } catch (err) {
      console.warn(`  ⚠  ${mod.code}: npm install failed - ${err.message}`);
    }
  } else {
    console.log(`  📦 ${mod.code}: no package.json, skipping npm install`);
  }

  // Rename .git → _git_preserved so it survives npm pack (npm always strips .git/).
  // prePopulateBmadCache() restores it and sets origin to a local file:// URL so that
  // bmad-method's "git fetch origin" succeeds without network access.
  const gitDir = path.join(moduleDir, '.git');
  const preservedDir = path.join(moduleDir, '_git_preserved');
  if (fs.existsSync(gitDir)) {
    fs.renameSync(gitDir, preservedDir);
    console.log(`  📦 ${mod.code}: preserved .git as _git_preserved`);
  }

  return {
    url: mod.url,
    branch: mod.branch,
    commitSha,
    clonedAt: new Date().toISOString()
  };
}

/**
 * Main build function.
 */
function main() {
  console.log('🔨 BMAD Cache Build Script');
  console.log('='.repeat(40));

  // Load module definitions (Task 2)
  const modules = loadModuleDefinitions();
  if (modules.length === 0) {
    console.error('Error: No modules found in external-official-modules.yaml');
    process.exit(1);
  }
  console.log(`Found ${modules.length} modules: ${modules.map(m => m.code).join(', ')}`);

  // Handle --force flag (AC #5 / Task 6)
  if (force && fs.existsSync(CACHE_DIR)) {
    console.log('🔄 --force: removing existing cache directory');
    fs.removeSync(CACHE_DIR);
  }

  // Ensure cache directory exists
  fs.ensureDirSync(CACHE_DIR);

  // Load existing manifest for incremental updates (Task 7)
  const existingManifest = loadManifest();

  // Get bmad-method version
  let bmadMethodVersion = 'unknown';
  try {
    const bmadMethodDir = path.dirname(require.resolve('bmad-method/package.json'));
    const bmadPkg = JSON.parse(fs.readFileSync(path.join(bmadMethodDir, 'package.json'), 'utf8'));
    bmadMethodVersion = bmadPkg.version || 'unknown';
  } catch {
    // continue with unknown version
  }

  // Process each module (Tasks 3, 4, 5)
  console.log('\nProcessing modules:');
  const manifestModules = {};
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const mod of modules) {
    const result = processModule(mod, existingManifest);
    if (result) {
      const { skipped, ...moduleInfo } = result;
      manifestModules[mod.code] = moduleInfo;
      if (skipped) {
        skipCount++;
      } else {
        successCount++;
      }
    } else {
      // Preserve existing manifest entry for failed modules (M2 fix)
      if (existingManifest && existingManifest.modules && existingManifest.modules[mod.code]) {
        manifestModules[mod.code] = existingManifest.modules[mod.code];
      }
      failCount++;
    }
  }

  // Write cache-manifest.json (AC #4 / Task 5)
  const manifest = {
    generated: new Date().toISOString(),
    bmadMethodVersion,
    modules: manifestModules
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  // Summary
  console.log('\n' + '='.repeat(40));
  console.log('✅ BMAD Cache Build Complete');
  console.log(`   Cloned: ${successCount}, Skipped: ${skipCount}, Failed: ${failCount}`);
  console.log(`   Cache: ${CACHE_DIR}`);
  console.log(`   Manifest: ${MANIFEST_PATH}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
