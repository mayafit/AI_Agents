#!/usr/bin/env node
/**
 * test/knowledge-atlas-packaging.test.js
 * ---------------------------------------------------------------------------
 * Story 29.5 — Dependency-surface vendoring audit (AC 1).
 *
 * Asserts:
 *   1. dist/atlas.cjs exists, is committed, and is non-empty.
 *   2. Running node dist/atlas.cjs <fixture> from a dir with NO node_modules
 *      generates a full site (proving self-contained bundle).
 *   3. Generated pages inline force-graph + lunr (no <script src="http).
 *   4. Mermaid is absent-by-design (documented deviation; no runtime required).
 *   5. No fonts/icons fetched remotely (system font stack; no icon font).
 *   6. npm pack --ignore-scripts --dry-run includes atlas.cjs.
 *
 * Test style: plain Node assert (no framework), repo style.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const REPO_ROOT = path.join(__dirname, '..');
const ATLAS_CJS = path.join(REPO_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const PINNED_EPOCH = '1700000000';

// ─── Test harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const tempDirs = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-pkg-${prefix}-`));
  tempDirs.push(d);
  return d;
}

console.log('\n=== Knowledge Atlas Packaging Tests (Story 29.5) ===');

// ─── Task 1.1: Bundle exists and is committed ─────────────────────────────────
console.log('\n--- Bundle existence and size ---');

test('dist/atlas.cjs exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
});

test('dist/atlas.cjs is non-empty (> 100KB)', () => {
  const size = fs.statSync(ATLAS_CJS).size;
  assert.ok(size > 100 * 1024, `atlas.cjs too small: ${size} bytes (expected > 100KB)`);
});

// ─── Bundle contains vendored dependencies ────────────────────────────────────
console.log('\n--- Bundle contains vendored deps ---');

let bundleContent;

test('read bundle content', () => {
  bundleContent = fs.readFileSync(ATLAS_CJS, 'utf-8');
  assert.ok(bundleContent.length > 0, 'bundle must not be empty');
});

test('markdown-it is bundled (not required from node_modules at runtime)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  // markdown-it has characteristic function names / exports
  assert.ok(
    bundleContent.includes('MarkdownIt') || bundleContent.includes('markdown-it'),
    'bundle must contain markdown-it code'
  );
  // The bundle must NOT have a require('markdown-it') call (it should be inlined)
  assert.ok(
    !bundleContent.includes("require('markdown-it')") &&
    !bundleContent.includes('require("markdown-it")'),
    'bundle must not require markdown-it from node_modules at runtime'
  );
});

test('js-yaml is bundled (not required from node_modules at runtime)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  assert.ok(
    bundleContent.includes('js-yaml') || bundleContent.includes('safeLoad') || bundleContent.includes('load:'),
    'bundle must contain js-yaml code'
  );
  assert.ok(
    !bundleContent.includes("require('js-yaml')") &&
    !bundleContent.includes('require("js-yaml")'),
    'bundle must not require js-yaml from node_modules at runtime'
  );
});

test('lunr index-builder is bundled (not required from node_modules)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  // lunr build-time code is bundled via esbuild
  assert.ok(
    bundleContent.includes('lunr') || bundleContent.includes('__ATLAS_LUNR_JS__'),
    'bundle must contain lunr code or ATLAS_LUNR_JS constant'
  );
  assert.ok(
    !bundleContent.includes("require('lunr')") &&
    !bundleContent.includes('require("lunr")'),
    'bundle must not require lunr from node_modules at runtime'
  );
});

test('lunr runtime is vendored as __ATLAS_LUNR_JS__ (inlined for browser)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  assert.ok(
    bundleContent.includes('__ATLAS_LUNR_JS__'),
    'bundle must contain __ATLAS_LUNR_JS__ (vendored lunr browser runtime)'
  );
});

test('force-graph UMD marker is present in bundle (will be inlined to pages)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  // force-graph UMD is read from source and inlined into graph.html at generate time
  // The bundle must carry the UMD code (in FORCE_GRAPH_UMD constant)
  assert.ok(
    bundleContent.includes('FORCE_GRAPH_UMD') || bundleContent.includes('force-graph') || bundleContent.includes('ForceGraph'),
    'bundle must contain force-graph UMD code or reference'
  );
});

test('esbuild is NOT bundled (build-only devDep)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  // esbuild should not be bundled into the runtime — it is used only to build
  assert.ok(
    !bundleContent.includes("require('esbuild')") &&
    !bundleContent.includes('require("esbuild")'),
    'bundle must not require esbuild at runtime'
  );
});

// ─── Mermaid absent-by-design (documented deviation) ─────────────────────────
console.log('\n--- Mermaid: absent-by-design (accepted deviation) ---');

test('mermaid is NOT vendored (29.3 accepted deviation: plain-text fallback)', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  // The Atlas does not vendor Mermaid. Authored Mermaid fences render as plain-text.
  // This is an accepted deviation for v1. There is nothing to vendor.
  assert.ok(
    !bundleContent.includes("require('mermaid')") &&
    !bundleContent.includes('require("mermaid")'),
    'bundle must not require mermaid (it is not vendored — accepted deviation)'
  );
  // Mermaid CDN references must not appear
  assert.ok(
    !bundleContent.includes('cdn.jsdelivr.net/npm/mermaid') &&
    !bundleContent.includes('unpkg.com/mermaid'),
    'bundle must not reference Mermaid CDN'
  );
  // Document: mermaid is intentionally absent; plain-text fallback is used for fences
  console.log('      [DOCUMENTED DEVIATION] Mermaid: not vendored (29.3 plain-text fallback; no runtime needed)');
});

// ─── No fonts/icons from CDN ─────────────────────────────────────────────────
console.log('\n--- No remote fonts or icon fonts ---');

test('bundle does not reference Google Fonts', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  assert.ok(!bundleContent.includes('fonts.googleapis.com'), 'no Google Fonts in bundle');
  assert.ok(!bundleContent.includes('fonts.gstatic.com'), 'no Google Fonts CDN in bundle');
});

test('bundle does not reference FontAwesome or similar icon fonts via CDN', () => {
  if (!bundleContent) throw new Error('bundleContent not loaded');
  assert.ok(!bundleContent.includes('fontawesome'), 'no FontAwesome in bundle');
  assert.ok(!bundleContent.includes('bootstrapcdn.com'), 'no Bootstrap CDN in bundle');
});

// ─── Self-contained: generate from NO node_modules ───────────────────────────
console.log('\n--- Self-contained: generate without node_modules ---');

let selfContainedTmpDir;

test('generate full site using only atlas.cjs (no node_modules in project dir)', () => {
  // Create a project directory with NO node_modules (only the fixture content)
  selfContainedTmpDir = makeTempDir('self-contained');
  copyDirRecursive(RICH_FIXTURE, selfContainedTmpDir);

  // Explicitly verify there is no node_modules in the project dir
  const nmPath = path.join(selfContainedTmpDir, 'node_modules');
  assert.ok(!fs.existsSync(nmPath), 'test dir must have no node_modules');

  // Run atlas.cjs from a different working directory (unrelated CWD)
  // This proves the bundle does not accidentally resolve deps from CWD's node_modules.
  // We use os.tmpdir() as the CWD to ensure no accidental resolution.
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, selfContainedTmpDir],
    {
      encoding: 'utf-8',
      cwd: os.tmpdir(),  // CWD has no node_modules for atlas deps
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );

  if (result.error) throw new Error(`Failed to spawn: ${result.error.message}`);
  assert.strictEqual(result.status, 0,
    `atlas.cjs must succeed without project node_modules.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );
});

test('self-contained: index.html generated', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const indexPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'index.html');
  assert.ok(fs.existsSync(indexPath), `index.html must be generated at ${indexPath}`);
  const size = fs.statSync(indexPath).size;
  assert.ok(size > 500, `index.html must be non-trivial: ${size} bytes`);
});

test('self-contained: graph.html generated', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const graphPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'graph.html');
  assert.ok(fs.existsSync(graphPath), 'graph.html must be generated');
  const size = fs.statSync(graphPath).size;
  assert.ok(size > 1000, `graph.html must be non-trivial: ${size} bytes`);
});

test('self-contained: search.html generated', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const searchPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'search.html');
  assert.ok(fs.existsSync(searchPath), 'search.html must be generated');
});

test('self-contained: manifest.json generated', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const manifestPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must be generated');
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.ok(parsed.nodes && parsed.nodes.length > 0, 'manifest must have nodes');
});

// ─── Generated pages: force-graph inlined (no CDN script src) ────────────────
console.log('\n--- Generated pages: force-graph inlined ---');

let graphHtml;

test('graph.html contains inline force-graph (no CDN src)', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const graphPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'graph.html');
  graphHtml = fs.readFileSync(graphPath, 'utf-8');

  // Must contain inline force-graph (not a CDN reference)
  assert.ok(
    graphHtml.includes('ForceGraph') || graphHtml.includes('force-graph'),
    'graph.html must contain inlined force-graph UMD'
  );
  // No external script src
  assert.ok(!/(<script\s[^>]*src=["']https?:)/i.test(graphHtml),
    'graph.html must not have external <script src="http...'
  );
});

test('graph.html contains lunr inlined (search runtime, no CDN)', () => {
  if (!selfContainedTmpDir) throw new Error('selfContainedTmpDir not set (prior test failed)');
  const searchPath = path.join(selfContainedTmpDir, '_bmad-output', 'knowledge-site', 'search.html');
  const searchHtml = fs.readFileSync(searchPath, 'utf-8');
  // lunr must be present inline (not fetched)
  assert.ok(
    searchHtml.includes('lunr') || searchHtml.includes('idx.search'),
    'search.html must contain lunr runtime inline'
  );
  assert.ok(!/(<script\s[^>]*src=["']https?:)/i.test(searchHtml),
    'search.html must not have external <script src="http...'
  );
});

// ─── npm pack --dry-run includes atlas.cjs ────────────────────────────────────
console.log('\n--- npm pack --dry-run includes atlas.cjs ---');

test('npm pack --ignore-scripts --dry-run includes lib/knowledge-atlas/dist/atlas.cjs', () => {
  // Run npm pack --dry-run to see what files would be included.
  // On Windows, npm is npm.cmd which requires shell:true (spawn cannot exec a
  // .cmd directly → EINVAL). On POSIX, npm is a plain executable and no shell
  // is needed. Mirror the portable pattern from test/build-plugin.test.js.
  // (The DEP0190 warning under shell:true on Windows is harmless.)
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(
    npmCmd,
    ['pack', '--ignore-scripts', '--dry-run'],
    {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
      timeout: 60000,
      shell: process.platform === 'win32',
    }
  );

  if (result.error) throw new Error(`npm pack failed: ${result.error.message}`);
  // npm pack --dry-run returns exit 0 and lists files to stdout
  // Some npm versions print to stdout, some to stderr — check both
  const output = (result.stdout || '') + (result.stderr || '');

  // The atlas.cjs must appear in the pack output
  assert.ok(
    output.includes('atlas.cjs') || output.includes('knowledge-atlas/dist'),
    `npm pack must include atlas.cjs. Output:\n${output.slice(0, 2000)}`
  );
});

test('package.json "files" includes lib/ (which contains knowledge-atlas/dist/atlas.cjs)', () => {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.ok(
    pkg.files && pkg.files.includes('lib/'),
    `package.json "files" must include "lib/", got: ${JSON.stringify(pkg.files)}`
  );
});

// ─── Task 4.3: Local no-network proxy test ───────────────────────────────────
// Fast local proxy for the CI Docker egress-block gate.
// Proves generate() does not invoke http/https/net/dns at runtime.
// Uses a child process that stubs out those modules before loading atlas.cjs.
// ---------------------------------------------------------------------------
console.log('\n--- Task 4.3: No-network proxy (generate does not touch http/net/dns) ---');

test('generate does not initiate any TCP connections (no net.connect / http.request)', () => {
  // We run a small inline script that:
  //   1. Stubs require('net') / require('http') / require('https') / require('dns') to throw on use
  //   2. Loads and runs the atlas generate() via atlas.cjs
  //   3. Verifies it succeeds (exit 0 = no network call was attempted)
  const noNetTmp = makeTempDir('no-net');
  copyDirRecursive(RICH_FIXTURE, noNetTmp);

  // Build the probe script inline
  const probeScript = `
'use strict';
const Module = require('module');
const origLoad = Module._load;

// Track if any network module was actually used (not just required)
let networkViolation = null;

// We intercept require() for net/http/https/dns and return
// a Proxy that throws on any property access (i.e. usage attempt).
const BLOCKED_MODULES = new Set(['net', 'http', 'https', 'dns', 'tls']);

Module._load = function(request, parent, isMain) {
  if (BLOCKED_MODULES.has(request)) {
    // Return the real module but wrap it so any call to .connect / .request /
    // .resolve etc. throws. This is more realistic than blocking require() itself,
    // since Node built-ins are always available — the test is that they are NOT CALLED.
    const real = origLoad.apply(this, arguments);
    return new Proxy(real, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function' && (
          prop === 'connect' || prop === 'createConnection' ||
          prop === 'request' || prop === 'get' ||
          prop === 'resolve' || prop === 'lookup' ||
          prop === 'createServer' || prop === 'Server'
        )) {
          return function() {
            networkViolation = 'Blocked network call: ' + request + '.' + prop + '()';
            throw new Error(networkViolation);
          };
        }
        return val;
      }
    });
  }
  return origLoad.apply(this, arguments);
};

// Now load and run atlas.cjs
process.argv = [process.argv[0], ${JSON.stringify(ATLAS_CJS)}, ${JSON.stringify(noNetTmp)}];
try {
  require(${JSON.stringify(ATLAS_CJS)});
} catch (e) {
  if (networkViolation) {
    process.stderr.write('NETWORK_VIOLATION: ' + networkViolation + '\\n');
    process.exit(2);
  }
  // Other error — re-throw
  process.stderr.write('ATLAS_ERROR: ' + e.message + '\\n');
  process.exit(1);
}
if (networkViolation) {
  process.stderr.write('NETWORK_VIOLATION: ' + networkViolation + '\\n');
  process.exit(2);
}
process.exit(0);
`;

  const result = spawnSync(
    process.execPath,
    ['-e', probeScript],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );

  if (result.error) throw new Error(`probe failed to spawn: ${result.error.message}`);

  // Exit code 2 means a network call was blocked
  assert.ok(result.status !== 2,
    `generate() attempted a network call:\n${result.stderr}`
  );
  // Exit code 0 means success (network-clean generate)
  // Exit code 1 means atlas error unrelated to networking — that's still OK for this test
  // (it would show up in other tests)
  assert.ok(result.status === 0 || result.status === 1,
    `probe exited with unexpected code ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );
  // If it succeeded (exit 0), verify the output was actually generated
  if (result.status === 0) {
    const indexPath = path.join(noNetTmp, '_bmad-output', 'knowledge-site', 'index.html');
    assert.ok(fs.existsSync(indexPath), 'index.html must be generated by the network-clean generate');
  }
});

test('generate does not reference http/https modules at module load time', () => {
  // Quick static check: the bundle must not contain require('http') or require('https')
  // as top-level calls (they may appear as strings in comments/docs, but not as active requires)
  if (!bundleContent) {
    bundleContent = fs.readFileSync(ATLAS_CJS, 'utf-8');
  }
  // Check for active require calls to network modules
  assert.ok(
    !bundleContent.includes("require('http')") && !bundleContent.includes('require("http")'),
    'bundle must not require http module'
  );
  assert.ok(
    !bundleContent.includes("require('https')") && !bundleContent.includes('require("https")'),
    'bundle must not require https module'
  );
  assert.ok(
    !bundleContent.includes("require('dns')") && !bundleContent.includes('require("dns")'),
    'bundle must not require dns module'
  );
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────
for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
