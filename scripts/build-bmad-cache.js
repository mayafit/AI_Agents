#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '..', 'lib', 'bmad-cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'cache-manifest.json');
const force = process.argv.includes('--force');

// bmad-method 6.3.0 replaced `tools/cli/external-official-modules.yaml` with
// `tools/installer/modules/registry-fallback.yaml` (the bundled fallback that
// mirrors the upstream marketplace `registry/official.yaml`). We read the
// fallback because (a) it is deterministic across offline builds and (b) it
// matches what bmad-method itself loads when the network registry is
// unreachable. The new schema uses map keys with properties — crucially, it
// no longer carries a `branch` field, and non-external `built_in: true`
// modules (like `core` and `bmm`) are shipped inside bmad-method itself and
// must not be cached as separate git clones.
const REGISTRY_CANDIDATES = [
  // v6.3.0+
  ['tools', 'installer', 'modules', 'registry-fallback.yaml'],
  // legacy v6.2.x fallback (kept so a partial downgrade doesn't explode)
  ['tools', 'cli', 'external-official-modules.yaml'],
];

/**
 * Locate the bmad-method package on disk. Abort cleanly if missing so the
 * caller gets an actionable "run npm install" message instead of a MODULE_NOT_FOUND
 * stack trace from deep inside require.resolve.
 */
function locateBmadMethodDir() {
  try {
    return path.dirname(require.resolve('bmad-method/package.json'));
  } catch {
    console.error('Error: bmad-method package not found. Run "npm install" first.');
    process.exit(1);
  }
}

/**
 * Locate the first registry YAML that exists on disk.
 * Returns { yamlPath, schema } where schema is 'v63' (new map format) or
 * 'legacy' (the pre-6.3 top-level map with `url`/`branch` fields).
 */
function locateRegistry(bmadMethodDir) {
  for (let i = 0; i < REGISTRY_CANDIDATES.length; i++) {
    const parts = REGISTRY_CANDIDATES[i];
    const candidate = path.join(bmadMethodDir, ...parts);
    if (fs.existsSync(candidate)) {
      return { yamlPath: candidate, schema: i === 0 ? 'v63' : 'legacy' };
    }
  }
  console.error('Error: no module registry YAML found in bmad-method.');
  console.error(`  Searched: ${REGISTRY_CANDIDATES.map(p => p.join('/')).join(', ')}`);
  process.exit(1);
}

/**
 * Parse the bundled module registry YAML.
 *
 * Both the v6.3.0 (`registry-fallback.yaml`) and legacy
 * (`external-official-modules.yaml`) schemas use the same shape:
 *
 *     modules:
 *       <module-key>:
 *         url: "..."
 *         code: "..."
 *         name: "..."
 *         [branch: "..."]            # legacy only
 *         [built_in: true]           # v6.3.0 only — filter these out
 *         [module-definition: "..."] # v6.3.0 only — informational
 *
 * We keep a minimal line-by-line parser (no js-yaml dep) since the file is
 * flat and well-formed.
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

    // Detect a new module key (1-4 spaces of indent, no value — just "key:")
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

  return modules;
}

/**
 * Normalize parsed module entries into a uniform cache-ready shape:
 *   { code, url, name, branch }
 *
 * - Requires both `code` and `url`.
 * - Drops entries flagged `built_in: true` / `built_in: "true"` — those are
 *   first-party bmad-method modules (e.g. `core`, `bmm`) that live inside the
 *   npm package itself and must not be cached as external git clones. The
 *   test `'built_in' filter` under "Task 2" in bmad-version-bump.test.js pins
 *   this invariant.
 * - Defaults `branch` to `main` when absent (v6.3.0 schema omits it).
 * - Strips the `.git` suffix from URLs for ls-remote consistency — git
 *   accepts it, but some mirrors normalize it away and we want stable
 *   manifest-level identifiers.
 */
function normalizeModules(raw) {
  return raw
    .filter(m => m.code && m.url)
    .filter(m => {
      const builtIn = String(m.built_in || '').toLowerCase();
      return builtIn !== 'true';
    })
    .map(m => ({
      code: m.code,
      url: m.url,
      name: m.name || m.key,
      branch: m.branch || 'main',
    }));
}

function loadModuleDefinitions() {
  const bmadMethodDir = locateBmadMethodDir();
  const { yamlPath, schema } = locateRegistry(bmadMethodDir);
  console.log(`  Registry: ${path.relative(bmadMethodDir, yamlPath)} (${schema})`);
  const content = fs.readFileSync(yamlPath, 'utf8');
  return { modules: normalizeModules(parseModulesYaml(content)), schema };
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
 * Clone, capture SHA, install deps, preserve .git for a single module.
 */
function processModule(mod, manifest) {
  const moduleDir = path.join(CACHE_DIR, mod.code);

  // Incremental update check
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

  // Clone
  console.log(`  📥 ${mod.code}: cloning from ${mod.url} (branch: ${mod.branch})`);
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', mod.branch, mod.url, moduleDir], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
    });
  } catch (err) {
    console.error(`  ❌ ${mod.code}: clone failed - ${err.message}`);
    return null;
  }

  // Capture commit SHA BEFORE renaming .git (order matters — rev-parse needs .git in place)
  let commitSha = '';
  try {
    commitSha = execFileSync('git', ['-C', moduleDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    console.warn(`  ⚠  ${mod.code}: could not capture commit SHA`);
  }

  // Install production dependencies
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
          shell: process.platform === 'win32',
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
    clonedAt: new Date().toISOString(),
  };
}

/**
 * Main build function.
 */
function main() {
  console.log('🔨 BMAD Cache Build Script');
  console.log('='.repeat(40));

  const { modules, schema } = loadModuleDefinitions();
  if (modules.length === 0) {
    console.error('Error: No modules found in registry YAML');
    process.exit(1);
  }
  console.log(`Found ${modules.length} modules: ${modules.map(m => m.code).join(', ')}`);

  // Handle --force flag
  if (force && fs.existsSync(CACHE_DIR)) {
    console.log('🔄 --force: removing existing cache directory');
    fs.removeSync(CACHE_DIR);
  }

  // Ensure cache directory exists
  fs.ensureDirSync(CACHE_DIR);

  // Load existing manifest for incremental updates
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

  // Process each module from the registry
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
      // Preserve existing manifest entry for failed modules so a transient
      // clone failure does not corrupt the manifest on re-run.
      if (existingManifest && existingManifest.modules && existingManifest.modules[mod.code]) {
        manifestModules[mod.code] = existingManifest.modules[mod.code];
      }
      failCount++;
    }
  }

  // AC #7 gate: preserve existing cached modules that are no longer in the
  // upstream registry (e.g. v6.3.0 retired `wds`). We keep the directory and
  // the manifest entry verbatim so downstream consumers keep working until a
  // maintainer explicitly confirms deletion. The retirement is documented in
  // the story's Dev Notes.
  let retainedCount = 0;
  if (existingManifest && existingManifest.modules) {
    const currentCodes = new Set(modules.map(m => m.code));
    for (const oldCode of Object.keys(existingManifest.modules)) {
      if (!currentCodes.has(oldCode) && !manifestModules[oldCode]) {
        const oldDir = path.join(CACHE_DIR, oldCode);
        if (fs.existsSync(oldDir)) {
          manifestModules[oldCode] = {
            ...existingManifest.modules[oldCode],
            retiredUpstream: true,
          };
          console.log(`  📌 ${oldCode}: retired upstream but retained (see AC #7 — remove only after maintainer confirmation)`);
          retainedCount++;
        }
      }
    }
  }

  // Write cache-manifest.json
  const manifest = {
    generated: new Date().toISOString(),
    bmadMethodVersion,
    registrySchema: schema,
    modules: manifestModules,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  // Summary
  console.log('\n' + '='.repeat(40));
  console.log('✅ BMAD Cache Build Complete');
  console.log(`   Cloned: ${successCount}, Skipped: ${skipCount}, Retained: ${retainedCount}, Failed: ${failCount}`);
  console.log(`   Cache: ${CACHE_DIR}`);
  console.log(`   Manifest: ${MANIFEST_PATH}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
