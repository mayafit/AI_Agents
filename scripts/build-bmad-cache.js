#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '..', 'lib', 'bmad-cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'cache-manifest.json');
const force = process.argv.includes('--force');

// The bundled module registry has stayed YAML throughout bmad-method's
// history, but its PATH has moved across versions (see Decision P5-5 in
// architecture.md):
//
//   ≤6.2.x   tools/cli/external-official-modules.yaml
//   6.3.0    tools/installer/modules/registry-fallback.yaml  (retired in 6.7.0)
//   6.8.0    bmad-modules.yaml  (package root)
//
// We read the bundled registry because (a) it is deterministic across offline
// builds and (b) it matches what bmad-method itself loads when the network
// registry is unreachable. The 6.8.0 file is a `modules:` map whose entries
// carry `code`/`url`/`name`/`type` — the same shape the parser already reads.
// Crucially the new schema carries no `branch` field (default to `main`) and
// it expresses the bundle decision via a `type` field rather than the old
// `built_in` flag. The bundle itself is governed by the closed allowlist
// below (KNOWN_BUNDLED_MODULES = tea, bmb, cis), not by `type`; `bmm`/`core` are
// built into the npm package itself and are absent from the registry entirely.
//
// Candidates are tried in order; the first that exists on disk wins. The
// package-root path is listed first because it is the live 6.8.0+ location.
//
// The two older paths are retained only as diagnostics: they carry the
// pre-6.8.0 `built_in` schema, which the `type: bmad-org` filter below does
// NOT understand, so they resolve zero bundled modules. If one of them is the
// only file present (i.e. someone downgraded bmad-method below 6.8.0), the
// thin-cache guard in main() aborts with an actionable message rather than
// silently shipping an empty cache. They are kept so `locateRegistry` reports
// "found <old path>" instead of a bare "nothing found", which points the
// maintainer at the version mismatch.
const REGISTRY_CANDIDATES = [
  // v6.8.0+ — relocated to the package root (the supported, filterable schema)
  { parts: ['bmad-modules.yaml'], schema: 'package-root-v68' },
  // v6.3.0–6.6.x bundled fallback (diagnostic only — pre-`type` schema)
  { parts: ['tools', 'installer', 'modules', 'registry-fallback.yaml'], schema: 'registry-fallback' },
  // legacy v6.2.x fallback (diagnostic only — pre-`type` schema)
  { parts: ['tools', 'cli', 'external-official-modules.yaml'], schema: 'legacy' },
];

// The set of modules ma-agents bundles for offline installs — the CLOSED
// ALLOWLIST. `normalizeModules()` includes ONLY these codes; every other
// registry entry is dropped, regardless of its `type`. This is the load-bearing
// safety posture (P5-8 / FR235): at v6.10.0 the registry gained `bmad-loop`
// (`type: bmad-org`, `marketplace-plugin: true`, air-gap-hostile) and marked
// `bmad-automator` `deprecated: true`. An open-by-default "keep every
// `type: bmad-org`" filter would silently force-bundle `bmad-loop` (and any
// FUTURE plain `bmad-org` module) onto air-gapped machines. Closing to this
// allowlist means new/renamed/re-flagged upstream modules FAIL CLOSED (excluded)
// rather than fail open.
const KNOWN_BUNDLED_MODULES = ['tea', 'bmb', 'cis'];

// The registry `type` first-party expansions carry. Retained for diagnostics
// and for the shape-flip assertion below (an allowlisted module is expected to
// stay a plain `bmad-org` module). It is NO LONGER the include criterion — the
// allowlist above is. `experimental` (automator) and `marketplace-plugin`
// modules (bmad-loop) are excluded simply by not being on the allowlist.
const BUNDLED_MODULE_TYPE = 'bmad-org';

// Registry traits that DISQUALIFY a module from the offline bundle. If a module
// that IS on the allowlist ever starts carrying one of these (an upstream
// shape/status flip on a module we bundle), the build HALTS rather than silently
// shipping it — see the assertion in normalizeModules(). `bmad-loop` carries
// `marketplace-plugin: true`; deprecated modules carry `deprecated: true`.
const DISQUALIFYING_FLAGS = ['marketplace-plugin', 'deprecated'];

/**
 * True when a parsed registry flag reads as boolean-true. The line parser
 * stores YAML scalars as strings (`'true'`), but unit callers may pass a real
 * boolean, so accept both. Anything else (absent, `'false'`, other) is false.
 *
 * @param {*} value Raw flag value off a parsed module entry.
 * @returns {boolean}
 */
function isFlagTrue(value) {
  return value === true || String(value).trim().toLowerCase() === 'true';
}

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
 *
 * @param {string} bmadMethodDir Absolute path to the bmad-method package dir.
 * @returns {{ yamlPath: string, schema: string }} The resolved registry path
 *   and its schema tag (`package-root-v68` for the relocated 6.8.0 YAML,
 *   `registry-fallback` for 6.3.0–6.6.x, or `legacy` for ≤6.2.x).
 *
 * Resolution is fail-loud: if no candidate exists, prints an actionable error
 * and exits non-zero (NFR56) rather than returning a falsy result that a
 * caller might silently treat as "zero modules".
 */
function locateRegistry(bmadMethodDir) {
  for (const candidate of REGISTRY_CANDIDATES) {
    const candidatePath = path.join(bmadMethodDir, ...candidate.parts);
    if (fs.existsSync(candidatePath)) {
      return { yamlPath: candidatePath, schema: candidate.schema };
    }
  }
  console.error('Error: no module registry YAML found in bmad-method.');
  console.error(`  Searched: ${REGISTRY_CANDIDATES.map(c => c.parts.join('/')).join(', ')}`);
  console.error('  Expected the relocated package-root "bmad-modules.yaml" at bmad-method >= 6.8.0.');
  process.exit(1);
}

/**
 * Parse the bundled module registry YAML.
 *
 * Every registry version (legacy `external-official-modules.yaml`, the
 * `registry-fallback.yaml`, and the relocated package-root `bmad-modules.yaml`
 * at 6.8.0) uses the same `modules:` map shape, so a single parser serves all:
 *
 *     modules:
 *       <module-key>:
 *         url: "..."
 *         code: "..."
 *         name: "..."
 *         type: "..."                # v6.8.0 — drives the bundle filter
 *         [branch: "..."]            # legacy only (absent at 6.8.0 → main)
 *         [built_in: true]           # 6.3.0–6.6.x only (superseded by `type`)
 *         [module-definition: "..."] # informational, ignored
 *
 * The parser already captures arbitrary scalar properties (including `type`),
 * so the 6.8.0 relocation needed no parser change — only the docblock and the
 * downstream filter were updated.
 *
 * @param {string} content Raw UTF-8 YAML text.
 * @returns {Array<Object>} One object per module entry; keys mirror the YAML
 *   property names plus a synthetic `key` (the map key). No filtering is done
 *   here — that is normalizeModules()'s job.
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

    // Detect a new module key (1-6 spaces of indent, no value — just "key:").
    // Widened from {1,4} to tolerate minor upstream reformatting without
    // silently dropping entries.
    const moduleKeyMatch = trimmed.match(/^\s{1,6}([a-zA-Z0-9_-]+):\s*$/);
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
 * CLOSED-BY-DEFAULT (FR235). The filter is an ALLOWLIST: an entry survives ONLY
 * if its `code` is in KNOWN_BUNDLED_MODULES (tea, bmb, cis). Every
 * other registry entry is dropped no matter its `type` — so a NEW upstream
 * module (even a plain `type: bmad-org` one carrying neither disqualifying
 * flag), `bmad-loop` (`marketplace-plugin: true`), the deprecated
 * `bmad-automator`, `experimental` modules, and the built-in `bmm`/`core` are
 * ALL excluded by default. This replaces the prior open-by-default posture
 * ("keep every `type: bmad-org`, subtract known-bad"), which would silently
 * bundle any future first-party module the moment it appeared upstream.
 *
 * SHAPE-FLIP HALT. For each entry that IS on the allowlist, assert it carries
 * NONE of DISQUALIFYING_FLAGS (`marketplace-plugin: true` / `deprecated: true`).
 * If a bundled module ever flips shape/status upstream, THROW — a bundled
 * module turning into a marketplace-plugin or getting deprecated must be
 * re-reviewed by a maintainer, never shipped silently.
 *
 * - Requires both `code` and `url`.
 * - Defaults `branch` to `main` when absent (the 6.8.0+ schema omits it).
 * - Passes the URL through verbatim (git accepts both `repo` and `repo.git`).
 *
 * @param {Array<Object>} raw Entries from parseModulesYaml().
 * @returns {Array<{code: string, url: string, name: string, branch: string}>}
 * @throws {Error} if an allowlisted entry carries a disqualifying flag.
 */
// Module `code` values are used as directory names under lib/bmad-cache.
// Reject anything that could escape the cache dir or inject shell characters;
// registry data is trusted today, but this is cheap defense-in-depth.
const MODULE_CODE_PATTERN = /^[a-zA-Z0-9_-]+$/;

function normalizeModules(raw) {
  const allowlist = new Set(KNOWN_BUNDLED_MODULES);
  return raw
    .filter(m => m.code && m.url)
    // CLOSED allowlist: include ONLY the known bundled codes. Anything not on
    // the allowlist fails closed (excluded) — the safety-critical inversion.
    .filter(m => allowlist.has(m.code))
    .filter(m => {
      if (MODULE_CODE_PATTERN.test(m.code)) return true;
      console.warn(`  ⚠  Skipping module with invalid code "${m.code}" (must match [a-zA-Z0-9_-]+)`);
      return false;
    })
    .map(m => {
      // Shape-flip halt: a module we DO bundle must not have turned into a
      // marketplace-plugin or been deprecated upstream. Fail loud, don't ship.
      const tripped = DISQUALIFYING_FLAGS.filter(flag => isFlagTrue(m[flag]));
      if (tripped.length > 0) {
        throw new Error(
          `Allowlisted bundled module "${m.code}" now carries disqualifying flag(s): ` +
          `${tripped.map(f => `${f}: true`).join(', ')}. A bundled module changing shape/status ` +
          `upstream must be re-reviewed before shipping (FR235) — refusing to build. ` +
          `Remove it from KNOWN_BUNDLED_MODULES in scripts/build-bmad-cache.js, or coordinate ` +
          `the upstream change, then rebuild.`
        );
      }
      return {
        code: m.code,
        url: m.url,
        name: m.name || m.key,
        branch: m.branch || 'main',
      };
    });
}

/**
 * Compare a RESOLVED bundle set (the codes normalizeModules() kept) against the
 * closed allowlist and report both directions of drift (NFR73 two-sided
 * set-EQUALITY). The resolved set must EQUAL the allowlist exactly.
 *
 * - `missing`: allowlisted codes the registry did NOT resolve — the thin-cache
 *   case (a bundled module vanished / the registry relocated / a downgrade).
 * - `extra`: resolved codes NOT on the allowlist — a silent upstream addition
 *   (e.g. `bmad-loop`) that must never be force-bundled. Under the closed
 *   allowlist filter this is normally empty; the check is defense-in-depth so a
 *   future loosening of the filter can never ship an over-broad cache silently.
 *
 * Computed on the resolved/filtered set — NOT the final manifest keys, which
 * the incremental-retention path deliberately augments with retired-upstream
 * modules that are not on the allowlist (see AC #7 retention in main()).
 *
 * @param {Iterable<string>|Set<string>} resolvedCodes Codes kept by normalize.
 * @param {Array<string>} [allowlist=KNOWN_BUNDLED_MODULES]
 * @returns {{ missing: string[], extra: string[] }} Sorted; both empty = equal.
 */
function diffBundleSet(resolvedCodes, allowlist = KNOWN_BUNDLED_MODULES) {
  const allow = new Set(allowlist);
  const resolved = resolvedCodes instanceof Set ? resolvedCodes : new Set(resolvedCodes);
  const missing = [...allow].filter(code => !resolved.has(code)).sort();
  const extra = [...resolved].filter(code => !allow.has(code)).sort();
  return { missing, extra };
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

  // If the clone produced an empty repository (no commits yet), fail the
  // module explicitly rather than storing a blank SHA in the manifest —
  // blank SHAs would permanently defeat the incremental-update check on
  // every subsequent run.
  if (!commitSha) {
    console.error(`  ❌ ${mod.code}: cloned repo has no HEAD SHA — skipping`);
    return null;
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
  //
  // Windows Defender / Explorer may briefly lock newly-created directories
  // (EBUSY). Treat rename failures as non-fatal — the module still has its
  // source files and the incremental-update check will re-clone next run.
  const gitDir = path.join(moduleDir, '.git');
  const preservedDir = path.join(moduleDir, '_git_preserved');
  if (fs.existsSync(gitDir)) {
    try {
      fs.renameSync(gitDir, preservedDir);
      console.log(`  📦 ${mod.code}: preserved .git as _git_preserved`);
    } catch (err) {
      console.warn(`  ⚠  ${mod.code}: could not preserve .git — ${err.message} (offline-mode fetches may fail until next rebuild)`);
    }
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

  // Two-sided set-EQUALITY fail-loud guard (NFR73, strengthening NFR56). The
  // resolved bundle set must EQUAL the known allowlist — abort on a set that is
  // either SMALLER (thin cache: a bundled module vanished / the registry moved /
  // a downgrade below 6.8.0) OR LARGER (a silent upstream addition such as
  // bmad-loop that must never be force-bundled). Abort BEFORE writing any
  // manifest — a partial or over-broad cache-manifest.json would otherwise ship
  // a broken/air-gap-hostile offline bundle that "looks" successful. Computed on
  // the RESOLVED set (not the final manifest keys — the retention path below
  // augments the manifest with non-allowlist retired modules by design).
  const resolvedCodes = new Set(modules.map(m => m.code));

  // Duplicate-code guard. Two registry entries sharing a `code` would clone
  // into the same cache directory and silently overwrite each other's manifest
  // entry (last-write-wins), and the Set above would mask the collision from
  // the thin-cache check below. Fail loud instead.
  if (modules.length !== resolvedCodes.size) {
    const seen = new Set();
    const dupes = new Set();
    for (const m of modules) {
      if (seen.has(m.code)) dupes.add(m.code);
      seen.add(m.code);
    }
    console.error('Error: registry contains duplicate module codes — refusing to build an ambiguous cache.');
    console.error(`  Duplicated: ${[...dupes].join(', ')}`);
    process.exit(1);
  }

  const { missing, extra } = diffBundleSet(resolvedCodes);
  if (missing.length > 0 || extra.length > 0) {
    console.error('Error: resolved bundle set does not EQUAL the known allowlist — refusing to build a');
    console.error('  partial or over-broad cache (thin module set / silent upstream addition).');
    console.error(`  Allowlist (KNOWN_BUNDLED_MODULES): ${KNOWN_BUNDLED_MODULES.join(', ')}`);
    console.error(`  Resolved: ${[...resolvedCodes].sort().join(', ') || '(none)'}`);
    console.error(`  Missing: ${missing.join(', ') || '(none)'}   (thin cache — a bundled module vanished/relocated)`);
    console.error(`  Extra:   ${extra.join(', ') || '(none)'}   (silent upstream addition — must not be force-bundled)`);
    console.error('  Likely cause: bmad-method was downgraded below 6.8.0, the registry layout moved');
    console.error('  again, or a bundled module was added/renamed/retired upstream. Update');
    console.error('  REGISTRY_CANDIDATES or KNOWN_BUNDLED_MODULES in scripts/build-bmad-cache.js to match —');
    console.error('  and, for an EXTRA module, confirm it is safe to bundle offline before allowlisting it.');
    process.exit(1);
  }
  console.log(`Found ${modules.length} modules: ${modules.map(m => m.code).join(', ')}`);

  // Load the existing manifest FIRST so retention data survives a --force
  // wipe. We identify retired-upstream modules up-front and stash their
  // directory contents so AC #7 (no silent deletion of retired modules) is
  // honored even under --force.
  const existingManifest = loadManifest();
  const currentCodes = new Set(modules.map(m => m.code));
  const retentionStash = {};
  if (existingManifest && existingManifest.modules) {
    for (const oldCode of Object.keys(existingManifest.modules)) {
      if (currentCodes.has(oldCode)) continue;
      const oldDir = path.join(CACHE_DIR, oldCode);
      let isRealDir = false;
      try {
        isRealDir = fs.existsSync(oldDir) && fs.statSync(oldDir).isDirectory();
      } catch {
        isRealDir = false;
      }
      if (isRealDir) {
        retentionStash[oldCode] = {
          dir: oldDir,
          manifestEntry: existingManifest.modules[oldCode],
        };
      }
    }
  }

  // Handle --force flag. When --force is set, move retained directories to
  // a temp location so the wipe does not remove them — then restore after
  // the cache dir is recreated. Treat stash-move failures as non-fatal
  // (worst case: retention is skipped for that module, and the manifest
  // entry is not re-added — identical to pre-AC-#7 behavior).
  if (force && fs.existsSync(CACHE_DIR)) {
    const tempStashDir = path.join(path.dirname(CACHE_DIR), `.bmad-cache-stash-${Date.now()}`);
    const stashedDirs = {};
    if (Object.keys(retentionStash).length > 0) {
      try {
        fs.ensureDirSync(tempStashDir);
        for (const [code, info] of Object.entries(retentionStash)) {
          const stashedPath = path.join(tempStashDir, code);
          try {
            fs.moveSync(info.dir, stashedPath);
            stashedDirs[code] = stashedPath;
          } catch (err) {
            console.warn(`  ⚠  Could not stash ${code} before --force wipe: ${err.message} (retention will be skipped for this module)`);
          }
        }
      } catch (err) {
        console.warn(`  ⚠  Could not create retention stash dir: ${err.message} (retention will be skipped)`);
      }
    }

    console.log('🔄 --force: removing existing cache directory');
    fs.removeSync(CACHE_DIR);
    fs.ensureDirSync(CACHE_DIR);

    // Restore stashed retained directories
    for (const [code, stashedPath] of Object.entries(stashedDirs)) {
      try {
        fs.moveSync(stashedPath, path.join(CACHE_DIR, code));
      } catch (err) {
        console.warn(`  ⚠  Could not restore stashed ${code}: ${err.message}`);
        // Remove from retentionStash so the retention loop below does not
        // register a manifest entry for a directory that no longer exists.
        delete retentionStash[code];
      }
    }
    try {
      fs.removeSync(tempStashDir);
    } catch {
      // Non-fatal cleanup
    }
  }

  // Ensure cache directory exists
  fs.ensureDirSync(CACHE_DIR);

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

  // AC #7 gate: preserve existing cached modules that the resolved set no
  // longer contains. We keep the directory and the manifest entry verbatim so
  // downstream consumers keep working until a maintainer explicitly confirms
  // deletion.
  //
  // THE GATE IS DIRECTORY-TRIGGERED, AND THAT MATTERS FOR A DELIBERATE
  // UNBUNDLING. "Resolved set no longer contains it" covers two different
  // causes: retired upstream, and removed from KNOWN_BUNDLED_MODULES on
  // purpose (`gds`/`wds` per FR75). This loop cannot tell them apart — it only
  // asks whether `lib/bmad-cache/<code>/` is still on disk. So removing a code
  // from the allowlist WITHOUT deleting its directory re-adds it to the
  // manifest flagged `retiredUpstream: true`, and it is back in
  // `getInstallableBmadModules()`. Deleting the directory is therefore part of
  // unbundling a module, not a separate tidy-up.
  //
  // `retentionStash` was built up-front (before any --force wipe) so the
  // retention decision does not depend on whether the module directory
  // survives the wipe. After --force restores the stashed directory, or when
  // --force isn't set and the directory is still on disk, we re-verify
  // existence as a final guard against restore failures.
  let retainedCount = 0;
  for (const [oldCode, info] of Object.entries(retentionStash)) {
    if (manifestModules[oldCode]) continue; // already emitted (shouldn't happen)
    const oldDir = path.join(CACHE_DIR, oldCode);
    let isRealDir = false;
    try {
      isRealDir = fs.existsSync(oldDir) && fs.statSync(oldDir).isDirectory();
    } catch {
      isRealDir = false;
    }
    if (isRealDir) {
      manifestModules[oldCode] = {
        ...info.manifestEntry,
        retiredUpstream: true,
      };
      console.log(`  📌 ${oldCode}: retired upstream but retained (see AC #7 — remove only after maintainer confirmation)`);
      retainedCount++;
    }
  }

  // Write cache-manifest.json atomically — write to a sibling temp file
  // then rename. A Ctrl-C or process crash mid-write leaves the previous
  // manifest intact rather than a truncated JSON file that breaks
  // subsequent incremental builds.
  const manifest = {
    generated: new Date().toISOString(),
    bmadMethodVersion,
    registrySchema: schema,
    modules: manifestModules,
  };
  const manifestTmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(manifestTmp, MANIFEST_PATH);

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

// Run the build only when executed directly (`node scripts/build-bmad-cache.js`).
// When required as a module (by unit tests), export the pure reader functions
// instead so they can be exercised against fixtures without cloning anything.
if (require.main === module) {
  main();
} else {
  module.exports = {
    parseModulesYaml,
    normalizeModules,
    diffBundleSet,
    isFlagTrue,
    locateRegistry,
    KNOWN_BUNDLED_MODULES,
    BUNDLED_MODULE_TYPE,
    DISQUALIFYING_FLAGS,
    REGISTRY_CANDIDATES,
  };
}
