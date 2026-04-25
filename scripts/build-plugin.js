#!/usr/bin/env node
/**
 * scripts/build-plugin.js
 * ---------------------------------------------------------------------------
 * Story 22.4 — Build script for plugin assembly.
 *
 * Purpose:
 *   Assemble a reproducible, diff-able BMAD plugin bundle from hand-edited
 *   source under `lib/bmad-extension/` into the generated output directory
 *   `lib/bmad-extension-plugin/`.
 *
 * Contract:
 *   Input directory  : lib/bmad-extension/
 *   Output directory : lib/bmad-extension-plugin/  (wiped & rebuilt each run)
 *
 * Required source files (fail-fast list — missing any of these aborts the
 * build with a non-zero exit code and a clear error message):
 *   - lib/bmad-extension/.claude-plugin/marketplace.json.template
 *   - lib/bmad-extension/skills/                 (non-empty directory)
 *   - lib/bmad-extension/skills/module.yaml
 *   - lib/bmad-extension/skills/module-help.csv
 *
 * Side effects:
 *   - Writes ONLY inside `lib/bmad-extension-plugin/`.
 *   - Never modifies any file under `lib/bmad-extension/` or anywhere else.
 *   - Clears `lib/bmad-extension-plugin/` before each build (no stale content
 *     is ever merged with fresh content — Epic 22 Story 22.2 renamed skills,
 *     so leaving a stale directory in place would leak retired skill IDs).
 *
 * Determinism (AC 3 / NFR51):
 *   - `fs.readdirSync` results are sorted before iterating.
 *   - File bytes are preserved via `fs.copyFileSync`; no read-then-write
 *     transforms on skill payloads.
 *   - Generated JSON is emitted with LF line endings and a trailing newline.
 *   - File mode bits are forced to a stable value (0o644 for files, 0o755 for
 *     directories) so POSIX `ls -l` output matches on every run regardless of
 *     the host umask. Symlinks are NOT followed — they are copied as regular
 *     files (reading the target content once). This preserves byte content
 *     but discards the symlink itself; the bundled plugin is flat by design.
 *
 * Token substitution (Story 22.5 hand-off contract):
 *   - Tokens of the form `${key}` inside the marketplace.json.template are
 *     replaced with values from `package.json`. Currently only `${version}`
 *     is supported; unknown tokens abort the build.
 *   - `source: "./"` is passed through literally — it is resolved at install
 *     time by BMAD's PluginResolver relative to the plugin output root.
 *   - `bmad_min_version` is passed through untouched.
 *
 * Usage:
 *   node scripts/build-plugin.js              # assemble bundle
 *   node scripts/build-plugin.js --verify     # assemble + print SHA-256 digest
 *
 * Exit codes:
 *   0 — success
 *   1 — any error (missing source, unknown token, I/O failure, etc.)
 *
 * Dependencies: Node.js built-ins only (fs, path, crypto, os). No third-party
 * modules are imported so the script runs inside air-gapped environments
 * before `npm install` has fetched any optional dependency.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────────────────
// Paths — always anchored to the repo root, NOT process.cwd(), so the script
// behaves identically no matter where the user runs it from.
// ──────────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'lib', 'bmad-extension');
const OUT_DIR = path.join(REPO_ROOT, 'lib', 'bmad-extension-plugin');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

const TEMPLATE_REL = path.join('.claude-plugin', 'marketplace.json.template');
const MODULE_YAML_REL = path.join('skills', 'module.yaml');
const MODULE_CSV_REL = path.join('skills', 'module-help.csv');
const SKILLS_SUBDIR = 'skills';

// Stable mode bits — decouple output from the host umask so two runs on two
// machines produce byte-identical file metadata (AC 3 / NFR51).
const FILE_MODE = 0o644;
const DIR_MODE = 0o755;

// ──────────────────────────────────────────────────────────────────────────
// Logging helpers — kept intentionally minimal. No timestamps, no colors, no
// hostnames — any of those would break determinism of captured CI logs.
// ──────────────────────────────────────────────────────────────────────────
// Progress messages go to stderr so this script can be safely invoked from
// other tools that parse stdout (e.g. `npm pack --json` via the `prepare`
// hook captures stdout into its JSON output). Keeping stdout silent during
// successful runs means tools see exactly what they expect.
function info(msg) {
  process.stderr.write(`[build-plugin] ${msg}\n`);
}

function fail(msg, detail) {
  process.stderr.write(`[build-plugin] ERROR: ${msg}\n`);
  if (detail) process.stderr.write(`[build-plugin]        ${detail}\n`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Fail-fast required-source check (AC 4).
// ──────────────────────────────────────────────────────────────────────────
function assertRequiredSources() {
  const required = [
    path.join(SRC_DIR, TEMPLATE_REL),
    path.join(SRC_DIR, MODULE_YAML_REL),
    path.join(SRC_DIR, MODULE_CSV_REL),
  ];
  for (const p of required) {
    if (!fs.existsSync(p)) {
      fail('missing required source file', p);
    }
  }
  const skillsDir = path.join(SRC_DIR, SKILLS_SUBDIR);
  if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
    fail('missing required source directory', skillsDir);
  }
  // The skills directory must contain at least one skill — an empty bundle is
  // never a valid release. The skills/ directory also hosts module.yaml /
  // module-help.csv, which we must exclude when counting skill subdirectories.
  const nonSkillFiles = new Set(['module.yaml', 'module-help.csv']);
  const skillEntries = readDirSorted(skillsDir).filter((entry) => {
    if (nonSkillFiles.has(entry.name)) return false;
    return entry.isDirectory();
  });
  if (skillEntries.length === 0) {
    fail('no skill subdirectories found under', skillsDir);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Deterministic directory iteration.
// Sorted by name; no locale-sensitive comparator. `readdirSync` already
// returns raw names, but sort order differs across Node versions / platforms
// (macOS HFS+ returns case-folded, POSIX returns raw). `.sort()` with the
// default string comparator is stable and platform-independent.
// ──────────────────────────────────────────────────────────────────────────
function readDirSorted(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries;
}

// ──────────────────────────────────────────────────────────────────────────
// Safe output-directory wipe. We explicitly refuse to operate outside of
// `lib/bmad-extension-plugin/` — a defensive guard against a future bug where
// `OUT_DIR` gets assigned the wrong value.
// ──────────────────────────────────────────────────────────────────────────
function ensureOutputRootSafety() {
  const normalized = path.normalize(OUT_DIR);
  const expectedSuffix = path.join('lib', 'bmad-extension-plugin');
  if (!normalized.endsWith(expectedSuffix)) {
    fail('refusing to operate on unexpected output path', normalized);
  }
  // Must be inside the repo root — never outside.
  const rel = path.relative(REPO_ROOT, normalized);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail('output path escapes repo root', normalized);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Atomic assembly:
//   1. Build into a sibling temp dir (same parent, same filesystem so rename
//      is atomic on POSIX/NTFS).
//   2. Only swap into the final OUT_DIR on success.
// This prevents a killed-mid-run process from leaving a half-populated
// `lib/bmad-extension-plugin/` that an unsuspecting subsequent `npm pack`
// could ship.
// ──────────────────────────────────────────────────────────────────────────
function withStagingDir(fn) {
  const parent = path.dirname(OUT_DIR);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true, mode: DIR_MODE });
  const stagingName = `.bmad-extension-plugin.build-${process.pid}-${Date.now()}`;
  const stagingDir = path.join(parent, stagingName);
  // Guard against a stray stale staging dir from a prior crashed run.
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true, mode: DIR_MODE });
  try {
    fn(stagingDir);
    // Swap: remove the final dir, rename staging into its place.
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    fs.renameSync(stagingDir, OUT_DIR);
  } catch (err) {
    // Best-effort cleanup on failure so a killed process doesn't leave the
    // sibling staging dir on disk.
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {
      /* swallow — we're already in a failure path */
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// File copy. We deliberately DO NOT re-encode text files — byte-preserving
// copy is the determinism contract. The one exception is the
// marketplace.json.template → marketplace.json token substitution, which is
// handled separately.
//
// Hidden/OS-junk files (`.DS_Store`, `Thumbs.db`) are excluded — they are
// machine-specific and would break cross-platform determinism.
// ──────────────────────────────────────────────────────────────────────────
const SKIP_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function shouldSkipEntry(name) {
  return SKIP_FILE_NAMES.has(name);
}

function copyFileDeterministic(srcPath, destPath) {
  // Use copyFileSync for byte-identity. Then force a stable mode — otherwise
  // the host umask (or a sticky +x bit on POSIX) leaks into the output.
  fs.copyFileSync(srcPath, destPath);
  try {
    fs.chmodSync(destPath, FILE_MODE);
  } catch {
    // chmod is a no-op on Windows for most cases; swallow silently.
  }
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true, mode: DIR_MODE });
  for (const entry of readDirSorted(srcDir)) {
    if (shouldSkipEntry(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isSymbolicLink()) {
      // Symlinks: resolve and copy the target's bytes as a regular file.
      // Preserving the symlink itself would tie the bundle to the build
      // machine's filesystem layout — the whole point of this build step is
      // to produce a flat, portable bundle.
      //
      // Safety: refuse to follow symlinks whose target escapes the source
      // tree. A stray link to /etc/shadow or C:\Users\x\.ssh would silently
      // inject external content into the published npm tarball.
      const real = fs.realpathSync(srcPath);
      const srcRoot = fs.realpathSync(SRC_DIR);
      const relFromSrc = path.relative(srcRoot, real);
      if (relFromSrc.startsWith('..') || path.isAbsolute(relFromSrc)) {
        fail('symlink target escapes source tree', `${srcPath} → ${real}`);
      }
      if (fs.statSync(real).isDirectory()) {
        copyDirRecursive(real, destPath);
      } else {
        copyFileDeterministic(real, destPath);
      }
    } else if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileDeterministic(srcPath, destPath);
    }
    // Other types (sockets, FIFOs) are ignored intentionally.
  }
}

// ──────────────────────────────────────────────────────────────────────────
// marketplace.json resolution (Story 22.5 hand-off).
// ──────────────────────────────────────────────────────────────────────────
function loadPackageJson() {
  if (!fs.existsSync(PACKAGE_JSON)) {
    fail('package.json not found', PACKAGE_JSON);
  }
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  } catch (err) {
    fail('package.json is not valid JSON', err.message);
  }
  return null; // unreachable
}

/**
 * Substitute ${token} placeholders in a string with values from a map. If a
 * placeholder has no matching entry, the build fails — silent passthrough
 * would produce a manifest that still contains the literal "${version}" and
 * downstream consumers would get confusing errors.
 */
function substituteTokens(source, tokens) {
  const re = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  const unknown = new Set();
  const replaced = source.replace(re, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      return String(tokens[key]);
    }
    unknown.add(key);
    return match;
  });
  if (unknown.size > 0) {
    fail(
      'unknown template token(s) in marketplace.json.template',
      `unresolved: ${[...unknown].sort().join(', ')} — add to substitution map or remove from template`,
    );
  }
  return replaced;
}

/**
 * Recursively strip `_comment` fields from a parsed JSON object. Comments in
 * the template document the schema for human maintainers but are NOT part of
 * the installer contract — keeping them in the resolved manifest would also
 * mean any prose mentioning `${example}` (as hand-off documentation) would
 * force us to register every mentioned token in the substitution map, which
 * doesn't scale.
 */
function stripComments(node) {
  if (Array.isArray(node)) return node.map(stripComments);
  if (node && typeof node === 'object') {
    const out = {};
    for (const key of Object.keys(node)) {
      if (key === '_comment') continue;
      out[key] = stripComments(node[key]);
    }
    return out;
  }
  return node;
}

/**
 * Read the template, substitute tokens, validate the result parses as JSON,
 * and emit it to `<stagingDir>/.claude-plugin/marketplace.json` with LF line
 * endings and a trailing newline for deterministic output.
 */
function writeResolvedMarketplaceJson(stagingDir, pkg) {
  const templatePath = path.join(SRC_DIR, TEMPLATE_REL);
  const rawTemplate = fs.readFileSync(templatePath, 'utf8');
  // Parse first so we can strip `_comment` fields BEFORE token substitution.
  // Comments are maintainer documentation and often contain `${example}`
  // prose that must not be fed into the substitution engine.
  let templateObj;
  try {
    templateObj = JSON.parse(rawTemplate);
  } catch (err) {
    fail('marketplace.json.template is not valid JSON', err.message);
  }
  const stripped = stripComments(templateObj);
  // Re-serialize and run token substitution on the now-comment-free text.
  const strippedJson = JSON.stringify(stripped);
  const tokens = {
    version: pkg.version,
  };
  const resolved = substituteTokens(strippedJson, tokens);
  // Validate the result parses — any typo that produces invalid JSON should
  // surface at build time, not install time.
  let parsed;
  try {
    parsed = JSON.parse(resolved);
  } catch (err) {
    fail('resolved marketplace.json is not valid JSON', err.message);
  }
  // Story 22.5 hand-off: do NOT rewrite source, bmad_min_version, or any
  // other pass-through field. Only confirm the substitution happened.
  if (!parsed || !Array.isArray(parsed.plugins) || parsed.plugins.length === 0) {
    fail('resolved marketplace.json is missing plugins[]');
  }
  if (parsed.plugins[0].version === '${version}') {
    fail('marketplace.json version placeholder was not substituted');
  }
  // Sanity-check: source "./" must pass through unchanged (Story 22.5 contract).
  if (parsed.plugins[0].source !== './') {
    fail(
      `plugins[0].source was altered: expected "./", got "${parsed.plugins[0].source}"`,
      'Story 22.5 contract: "./" is passed through literally; it resolves at install time relative to the plugin output root.',
    );
  }
  // Re-stringify with stable formatting (2-space indent, LF, trailing \n) so
  // file contents are byte-identical across runs even if the template's
  // whitespace changes.
  const normalized = JSON.stringify(parsed, null, 2) + '\n';
  const outPluginDir = path.join(stagingDir, '.claude-plugin');
  fs.mkdirSync(outPluginDir, { recursive: true, mode: DIR_MODE });
  const outPath = path.join(outPluginDir, 'marketplace.json');
  fs.writeFileSync(outPath, normalized, { encoding: 'utf8', mode: FILE_MODE });
  try {
    fs.chmodSync(outPath, FILE_MODE);
  } catch {
    /* Windows — ignore */
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Skills tree copy.
//
// Source `lib/bmad-extension/skills/` contains:
//   - module.yaml         (BMAD v6.3.0 canonical location)
//   - module-help.csv     (PluginResolver Strategy 1 companion)
//   - <skill-name>/       (one directory per skill)
//       ├── SKILL.md
//       ├── bmad-skill-manifest.yaml
//       └── resources/ | prompts/ | templates/ | scripts/ | assets/
//
// Each skill dir that lacks a SKILL.md is flagged — the test suite already
// enforces this for template-listed skills, but a stray unlisted directory
// could still slip through. We warn loudly and exclude the skill from the
// bundle rather than shipping a broken payload.
// ──────────────────────────────────────────────────────────────────────────
function copySkillsTree(stagingDir) {
  const srcSkillsDir = path.join(SRC_DIR, SKILLS_SUBDIR);
  const destSkillsDir = path.join(stagingDir, SKILLS_SUBDIR);
  fs.mkdirSync(destSkillsDir, { recursive: true, mode: DIR_MODE });

  // Copy module.yaml and module-help.csv first.
  copyFileDeterministic(
    path.join(srcSkillsDir, 'module.yaml'),
    path.join(destSkillsDir, 'module.yaml'),
  );
  copyFileDeterministic(
    path.join(srcSkillsDir, 'module-help.csv'),
    path.join(destSkillsDir, 'module-help.csv'),
  );

  // Then copy each skill subdirectory.
  for (const entry of readDirSorted(srcSkillsDir)) {
    if (shouldSkipEntry(entry.name)) continue;
    if (!entry.isDirectory()) continue; // module.yaml / module-help.csv already handled
    const skillSrc = path.join(srcSkillsDir, entry.name);
    const skillDest = path.join(destSkillsDir, entry.name);
    const skillMd = path.join(skillSrc, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      // A skill directory without SKILL.md is likely-broken. We refuse to
      // silently ship it — the test suite (plugin-manifests) asserts every
      // template-listed skill has SKILL.md, so this keeps the build in sync
      // with that guarantee.
      fail(`skill directory missing SKILL.md: ${entry.name}`, skillMd);
    }
    copyDirRecursive(skillSrc, skillDest);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Optional verification pass (AC 3 / Task 3.4).
// Walks the output tree and emits a SHA-256 digest over each entry. The
// digest covers:
//   - relative path (POSIX-normalized so Windows and Linux agree)
//   - entry kind ('f' for file, 'd' for directory) so an empty directory
//     cannot be silently dropped from the reproducibility claim
//   - file mode (low 9 bits — POSIX permission set, masked so Windows's
//     synthesized "0o666" mode does not collide with POSIX's true 0o644)
//   - file byte length and content sha256 (files only)
//
// F3 Section 5 — NFR51 stricter: digest now covers modes + empty dirs.
// Previously only (path, size, content-sha) was covered, which meant:
//   - An empty directory added to source was invisible to the digest.
//   - A mode change (e.g. accidental +x on a .md file) produced an
//     identical digest, masking a real reproducibility regression.
//
// Mode portability: Windows reports modes as 0o666 / 0o777 (the fs layer
// has no real POSIX permission concept). Masking with 0o777 keeps the
// low 9 bits — the same bits the build forces to 0o644 / 0o755 — so a
// Linux runner and a Windows runner produce the same digest as long as
// the build script's chmod step ran consistently.
//
// The digest is stable across runs given byte-identical input. Used by
// CI / manual smoke-tests to confirm NFR51.
// ──────────────────────────────────────────────────────────────────────────
function computeTreeDigest(rootDir) {
  const hash = crypto.createHash('sha256');
  const walk = (dir) => {
    for (const entry of readDirSorted(dir)) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootDir, full).split(path.sep).join('/');
      const stat = fs.lstatSync(full);
      // Mask to the POSIX permission bits (low 9 bits). Higher bits (file-type
      // bits, setuid/setgid/sticky) are excluded — they would cause divergence
      // between platforms that report file types differently.
      const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
      if (entry.isDirectory()) {
        // Record the directory itself BEFORE descending so empty directories
        // contribute exactly one digest line. This makes the addition of an
        // empty directory to source produce a digest delta — the previous
        // implementation silently dropped empty dirs.
        hash.update(`d\u0000${rel}\u0000${mode}\n`);
        walk(full);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(full);
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');
        hash.update(`f\u0000${rel}\u0000${mode}\u0000${content.length}\u0000${fileHash}\n`);
      }
      // Symlinks and other special entries are intentionally NOT digested —
      // the build script copies symlink targets as regular files, so the
      // bundle should never contain a real symlink. If it did, it would be a
      // build-script bug worth surfacing separately.
    }
  };
  walk(rootDir);
  return hash.digest('hex');
}

// ──────────────────────────────────────────────────────────────────────────
// Entry point.
// ──────────────────────────────────────────────────────────────────────────
function main() {
  const verify = process.argv.includes('--verify');

  info(`source : ${path.relative(REPO_ROOT, SRC_DIR) || '.'}`);
  info(`output : ${path.relative(REPO_ROOT, OUT_DIR) || '.'}`);

  assertRequiredSources();
  ensureOutputRootSafety();

  const pkg = loadPackageJson();

  withStagingDir((stagingDir) => {
    writeResolvedMarketplaceJson(stagingDir, pkg);
    copySkillsTree(stagingDir);
  });

  info('bundle assembled');

  if (verify) {
    const digest = computeTreeDigest(OUT_DIR);
    info(`sha256 : ${digest}`);
  }
}

// Only run when invoked as a script. Required for the Story 22.4 unit test,
// which exercises the internals (token substitution, deterministic walk).
if (require.main === module) {
  try {
    main();
  } catch (err) {
    fail('unhandled exception', err && err.stack ? err.stack : String(err));
  }
}

module.exports = {
  REPO_ROOT,
  SRC_DIR,
  OUT_DIR,
  readDirSorted,
  substituteTokens,
  computeTreeDigest,
  shouldSkipEntry,
  // Exposed for tests; not part of the public CLI contract.
  _internal: {
    assertRequiredSources,
    writeResolvedMarketplaceJson,
    copySkillsTree,
  },
};
