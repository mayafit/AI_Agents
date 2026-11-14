'use strict';
/**
 * `ma-agents bundle build` — the upstream half of the 4.x offline bundle (Story 36.3).
 *
 * FR280 / FR302: `package.json` `bmadRef` is the one record of what the bundle holds
 *   (`core` commit, `skillsCli` version, `tea` / `cis` tags, `extensions` tag).
 * FR299: the bundle and `manifest.json` are a pure function of that record — entries
 *   sorted, no timestamps, no absolute paths, line endings as committed upstream.
 * FR283: the Skills CLI ships with its runtime dependencies (the tree that
 *   `npm install --omit=dev --ignore-scripts` produces from the packed tarball).
 * Decisions P5-11.2 / .5 / .10.
 *
 * Layout written to `<out>/`:
 *   bmad-method/skills/   BMAD-METHOD `skills/` at exactly `bmadRef.core`
 *   tea/skills/           tea `skills/` at `bmadRef.tea` (omitted when the tag is empty)
 *   cis/skills/           cis `skills/` at `bmadRef.cis` (omitted when the tag is empty)
 *   skills-cli/           the `skills` package at `bmadRef.skillsCli` + node_modules
 *   manifest.json         per item: source, requested ref, resolved ref, file count,
 *                         size, tree hash and the SHA-256 of every file
 *
 * Story 39.1 adds `ma-bmad-extensions`, the Python runtime (uv, interpreter) and the wheelhouse.
 * Fetches are by exact commit or exact tag only; no branch head is ever fetched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const BUILDER_MODULE = 'lib/bundle.js';
const MANIFEST_NAME = 'manifest.json';
const MANIFEST_SCHEMA = 1;

/** The upstream repositories: constants of the builder, listed in the manifest. */
const UPSTREAM = Object.freeze({
  core: Object.freeze({ item: 'bmad-method', repository: 'https://github.com/bmad-code-org/BMAD-METHOD' }),
  tea: Object.freeze({ item: 'tea', repository: 'https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise' }),
  cis: Object.freeze({ item: 'cis', repository: 'https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite' }),
});
const SKILLS_CLI_PACKAGE = 'skills';
const SKILLS_CLI_ITEM = 'skills-cli';
const BMAD_REF_KEYS = Object.freeze(['core', 'skillsCli', 'tea', 'cis', 'extensions']);

const OMISSION_REASON = Object.freeze({
  tea: 'bmadRef.tea is empty: no tea tag carries a bmod record',
  cis: 'bmadRef.cis is empty: no cis tag carries a bmod record (Story 36.1 AC12)',
});

const SHA_RE = /^[0-9a-f]{40}$/;
const SEMVER_EXACT_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** A release tag: `v` + an exact SemVer version. A branch name never has this shape. */
const TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

// ─── bmadRef (AC1) ───────────────────────────────────────────────────────────

/**
 * Problems with a `bmadRef` record; empty when it is valid.
 * `core` is a full commit, `skillsCli` an exact version, `tea` / `cis` tags or
 * empty, `extensions` a tag (empty until Story 39.1 bundles it).
 */
function validateBmadRef(ref) {
  const problems = [];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return ['bmadRef is missing or not an object'];
  const keys = Object.keys(ref);
  for (const k of BMAD_REF_KEYS) if (!keys.includes(k)) problems.push(`bmadRef.${k} is missing`);
  for (const k of keys) if (!BMAD_REF_KEYS.includes(k)) problems.push(`bmadRef.${k} is not a known key`);
  for (const k of BMAD_REF_KEYS) {
    if (k in ref && typeof ref[k] !== 'string') problems.push(`bmadRef.${k} is not a string`);
  }
  if (problems.length) return problems;
  if (!SHA_RE.test(ref.core)) problems.push(`bmadRef.core ${JSON.stringify(ref.core)} is not a full 40-hex commit`);
  if (!SEMVER_EXACT_RE.test(ref.skillsCli)) problems.push(`bmadRef.skillsCli ${JSON.stringify(ref.skillsCli)} is not an exact SemVer version`);
  for (const k of ['tea', 'cis', 'extensions']) {
    if (ref[k] !== '' && !TAG_RE.test(ref[k])) problems.push(`bmadRef.${k} ${JSON.stringify(ref[k])} is not a release tag (v<semver>) or empty`);
  }
  return problems;
}

function readPackageJson(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

// ─── file system helpers ─────────────────────────────────────────────────────

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function makeWritable(target) {
  let st;
  try { st = fs.lstatSync(target); } catch { return; }
  try { fs.chmodSync(target, st.mode | 0o200); } catch { /* best effort */ }
  if (st.isDirectory()) for (const e of fs.readdirSync(target)) makeWritable(path.join(target, e));
}

const RETRYABLE_RM = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY', 'EACCES']);

/**
 * Delete a tree; on Windows a fetched `.git` (read-only packs) or a file held by
 * an editor / antivirus fails with EBUSY / EPERM, so retry with backoff.
 */
function removeTree(target, { attempts = 6, delayMs = 250 } = {}) {
  for (let i = 1; ; i++) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (err) {
      if (!RETRYABLE_RM.has(err.code) || i >= attempts) {
        if (RETRYABLE_RM.has(err.code)) {
          err.message += ` (could not delete ${target} after ${i} attempts; close editors or antivirus scans holding it and re-run)`;
        }
        throw err;
      }
      makeWritable(target);
      sleepMs(delayMs * 2 ** (i - 1));
    }
  }
}

/** Relative `/`-separated paths of every file under `root`, sorted. Symlinks are refused. */
function listFiles(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) throw new Error(`symbolic link in bundle tree: ${r}`);
      if (e.isDirectory()) walk(abs, r);
      else if (e.isFile()) out.push(r);
      else throw new Error(`unsupported file type in bundle tree: ${r}`);
    }
  };
  walk(root, '');
  return out.sort(compareStrings);
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash a tree: SHA-256 of every file, and a tree hash over the sorted lines
 * `<sha256>  <relative path>\n` (paths with `/`, so Windows and Linux agree).
 */
function hashTree(root) {
  const files = listFiles(root).map((rel) => {
    const buf = fs.readFileSync(path.join(root, ...rel.split('/')));
    return { path: rel, sha256: sha256(buf), size: buf.length };
  });
  return {
    fileCount: files.length,
    size: files.reduce((n, f) => n + f.size, 0),
    treeSha256: sha256(files.map((f) => `${f.sha256}  ${f.path}\n`).join('')),
    files,
  };
}

function copyTree(src, dest) {
  for (const rel of listFiles(src)) {
    const to = path.join(dest, ...rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, ...rel.split('/')), to);
  }
}

// ─── git (AC2) ───────────────────────────────────────────────────────────────

/** Run git with line-ending conversion off, so the files are the committed bytes. */
function git(args, cwd) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', '-c', 'core.longpaths=true', ...args], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (exit ${r.status}): ${(r.stderr || r.stdout || '').trim()}`);
  }
  return (r.stdout || '').trim();
}

/** A fresh repository whose checkout is limited to `skills/` (the only folder the bundle takes). */
function initSparse(dir, repository) {
  fs.mkdirSync(dir, { recursive: true });
  git(['init', '-q'], dir);
  git(['remote', 'add', 'origin', fetchUrl(repository)], dir);
  git(['config', 'core.sparseCheckout', 'true'], dir);
  fs.writeFileSync(path.join(dir, '.git', 'info', 'sparse-checkout'), '/skills/\n');
}

function fetchUrl(repository) {
  return /^https:\/\/github\.com\//.test(repository) ? `${repository}.git` : repository;
}

/**
 * Fetch exactly `sha` (never a branch) and assert HEAD is that commit.
 * Returns the resolved commit.
 */
function fetchCommit(repository, sha, dir) {
  if (!SHA_RE.test(sha)) throw new Error(`refusing to fetch ${JSON.stringify(sha)}: not a full commit`);
  initSparse(dir, repository);
  git(['fetch', '-q', '--depth', '1', 'origin', sha], dir);
  git(['checkout', '-q', 'FETCH_HEAD'], dir);
  const head = git(['rev-parse', 'HEAD'], dir);
  if (head !== sha) throw new Error(`HEAD of ${repository} is ${head}, expected bmadRef commit ${sha}`);
  return head;
}

/**
 * Fetch exactly the tag `tag` and assert `git describe --tags --exact-match HEAD`
 * names it. Returns the resolved commit.
 */
function fetchTag(repository, tag, dir) {
  if (!TAG_RE.test(tag)) throw new Error(`refusing to fetch ${JSON.stringify(tag)}: not a release tag`);
  initSparse(dir, repository);
  git(['fetch', '-q', '--depth', '1', 'origin', `refs/tags/${tag}:refs/tags/${tag}`], dir);
  git(['checkout', '-q', `refs/tags/${tag}`], dir);
  const described = git(['describe', '--tags', '--exact-match', 'HEAD'], dir);
  if (described !== tag) throw new Error(`HEAD of ${repository} describes as ${described}, expected tag ${tag}`);
  return git(['rev-parse', 'HEAD'], dir);
}

// ─── Skills CLI (AC2) ────────────────────────────────────────────────────────

/**
 * Run npm. Every token is a constant or a validated version, and paths travel as
 * `cwd`, so the command line is safe to hand to the shell (needed for npm.cmd on
 * Windows).
 */
function npm(args, cwd) {
  for (const a of args) {
    if (!/^[A-Za-z0-9@._=\/-]+$/.test(a)) throw new Error(`unsafe npm argument ${JSON.stringify(a)}`);
  }
  const r = spawnSync(`npm ${args.join(' ')}`, {
    cwd, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false' },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`npm ${args.join(' ')} failed (exit ${r.status}): ${(r.stderr || '').trim()}`);
  return r.stdout || '';
}

/** Extract a `.tgz` written by `npm pack`, dropping its leading `package/` segment. */
function extractNpmTarball(tgzPath, dest) {
  const data = zlib.gunzipSync(fs.readFileSync(tgzPath));
  const root = path.resolve(dest);
  let off = 0;
  let paxPath = null;
  const field = (o, n) => data.toString('utf8', o, o + n).replace(/\0.*$/s, '');
  while (off + 512 <= data.length) {
    const header = data.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const size = parseInt(field(off + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = field(off + 345, 155);
    let name = paxPath || (prefix ? `${prefix}/${field(off, 100)}` : field(off, 100));
    paxPath = null;
    const body = data.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const m = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      if (m) paxPath = m[1];
      continue;
    }
    if (type === 'g') continue;
    const parts = name.split('/').filter(Boolean);
    parts.shift(); // `package/`
    if (parts.length === 0) continue;
    if (parts.some((p) => p === '..' || p.includes('\\') || p.includes(':'))) throw new Error(`unsafe path in tarball: ${name}`);
    const target = path.join(root, ...parts);
    if (type === '5') fs.mkdirSync(target, { recursive: true });
    else if (type === '0' || type === '\0' || type === '7') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    } else {
      throw new Error(`unsupported tar entry type ${JSON.stringify(type)} for ${name}`);
    }
  }
}

/** The package's bin entry (the one named after the package), relative, `/`-separated. */
function skillsCliBinEntry(pkg) {
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin[pkg.name];
  if (!bin) throw new Error(`package ${pkg.name} has no bin entry named ${pkg.name}`);
  return bin.replace(/^\.\//, '');
}

/** `node <dir>/<bin> --version` must exit 0 and print exactly `version`. */
function verifySkillsCli(dir, version) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const bin = skillsCliBinEntry(pkg);
  const r = spawnSync(process.execPath, [path.join(dir, ...bin.split('/')), '--version'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' },
  });
  const out = (r.stdout || '').trim();
  if (r.status !== 0 || out !== version) {
    throw new Error(`node ${SKILLS_CLI_ITEM}/${bin} --version: exit ${r.status}, printed ${JSON.stringify(out)}, `
      + `expected ${JSON.stringify(version)}${r.stderr ? `; stderr: ${r.stderr.trim().split('\n').slice(0, 3).join(' | ')}` : ''}`);
  }
  return bin;
}

/** Installed packages of a Skills CLI tree as sorted `name@version`. */
function installedPackages(dir) {
  const out = [];
  const visit = (nm) => {
    if (!fs.existsSync(nm)) return;
    for (const e of fs.readdirSync(nm, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      if (e.name.startsWith('@')) {
        for (const s of fs.readdirSync(path.join(nm, e.name), { withFileTypes: true })) {
          if (s.isDirectory()) record(path.join(nm, e.name, s.name));
        }
      } else record(path.join(nm, e.name));
    }
  };
  const record = (pkgDir) => {
    const pj = path.join(pkgDir, 'package.json');
    if (fs.existsSync(pj)) {
      const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
      out.push(`${p.name}@${p.version}`);
    }
    visit(path.join(pkgDir, 'node_modules'));
  };
  visit(path.join(dir, 'node_modules'));
  return [...new Set(out)].sort(compareStrings);
}

/**
 * `npm pack skills@<version>`, extract into `dest`, then complete it with its
 * runtime dependencies: the `node_modules` that
 * `npm install --omit=dev --ignore-scripts` produces for the package's
 * `dependencies`. The install runs in a sibling folder whose package.json holds
 * only those `dependencies` — the same production tree, but npm never resolves
 * the package's devDependencies (npm 10 crashes on their peer set even with
 * `--omit=dev`), and the package's own files stay exactly as packed.
 * `--no-bin-links` keeps platform-specific `.bin` shims out of the tree, and the
 * hidden lockfile (which names the maintainer's registry) is dropped, so Windows
 * and Linux builds hash the same.
 */
function packSkillsCli(version, workDir, dest) {
  if (!SEMVER_EXACT_RE.test(version)) throw new Error(`bmadRef.skillsCli ${JSON.stringify(version)} is not an exact version`);
  fs.mkdirSync(workDir, { recursive: true });
  const packed = JSON.parse(npm(['pack', `${SKILLS_CLI_PACKAGE}@${version}`, '--json', '--pack-destination', '.'], workDir));
  const { filename, integrity } = packed[0];
  fs.mkdirSync(dest, { recursive: true });
  extractNpmTarball(path.join(workDir, filename), dest);
  const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
  const depsDir = path.join(workDir, 'deps');
  fs.mkdirSync(depsDir, { recursive: true });
  fs.writeFileSync(path.join(depsDir, 'package.json'),
    `${JSON.stringify({ name: `${pkg.name}-runtime-dependencies`, private: true, dependencies: pkg.dependencies || {} }, null, 2)}\n`);
  npm(['install', '--omit=dev', '--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund'], depsDir);
  const nm = path.join(depsDir, 'node_modules');
  if (fs.existsSync(nm)) {
    fs.rmSync(path.join(nm, '.package-lock.json'), { force: true });
    copyTree(nm, path.join(dest, 'node_modules'));
  }
  return { integrity };
}

// ─── snapshot facts read from the tree (AC3) ─────────────────────────────────

/** Folders named `name` under `root` that contain `marker`, as relative `/` paths. */
function findFolders(root, name, marker) {
  return listFiles(root)
    .filter((rel) => rel.endsWith(`/${name}/${marker}`) || rel === `${name}/${marker}`)
    .map((rel) => rel.slice(0, -(`/${marker}`.length)))
    .sort(compareStrings);
}

function githubSource(repository) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/.exec(repository);
  if (!m) throw new Error(`not a GitHub repository URL: ${repository}`);
  return `github:${m[1]}`;
}

/**
 * The `bmad` required_skills source: the folder of the snapshot that holds
 * `bmad/SKILL.md`, as `github:<owner>/<repo>/<folder>` (read, never a literal).
 */
function bmadRequiredSkillsSource(coreDir, repository) {
  const found = findFolders(coreDir, 'bmad', 'SKILL.md');
  if (found.length !== 1) throw new Error(`expected exactly one bmad/SKILL.md in the snapshot, found ${found.length}: ${found.join(', ')}`);
  const folder = path.posix.dirname(found[0]);
  if (folder === '.') throw new Error('bmad/ sits at the snapshot root; expected it under skills/');
  return { source: `${githubSource(repository)}/${folder}`, skillPath: `${found[0]}/SKILL.md` };
}

/** `[bmod] version` of `bmod-method/bmod.toml` in the snapshot. */
function bmodMethodVersion(coreDir) {
  const found = findFolders(coreDir, 'bmod-method', 'bmod.toml');
  if (found.length !== 1) throw new Error(`expected exactly one bmod-method/bmod.toml in the snapshot, found ${found.length}`);
  const text = fs.readFileSync(path.join(coreDir, ...found[0].split('/'), 'bmod.toml'), 'utf8');
  const table = /^\[bmod\][ \t]*\r?\n([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text);
  const v = table && /^version\s*=\s*"([^"]*)"/m.exec(table[1]);
  if (!v) throw new Error(`${found[0]}/bmod.toml has no [bmod] version`);
  return { path: `${found[0]}/bmod.toml`, version: v[1] };
}

// ─── manifest (AC3, AC4) ─────────────────────────────────────────────────────

/**
 * Write `<out>/manifest.json` from the tree on disk and the resolved refs.
 * Deterministic: everything is sorted and nothing depends on time or the
 * output location. Returns { text, sha256 }.
 */
function writeManifest(out, { bmadRef, repositories, resolved }) {
  const items = [];
  const modules = [];
  const omitted = [];
  for (const key of ['core', 'tea', 'cis']) {
    const { item } = UPSTREAM[key];
    const repository = repositories[key];
    const requestedRef = bmadRef[key];
    if (key !== 'core' && requestedRef === '') {
      omitted.push({ name: item, repository, requestedRef, reason: OMISSION_REASON[key] });
      continue;
    }
    const tree = hashTree(path.join(out, item));
    items.push({ name: item, path: item, repository, requestedRef, resolvedCommit: resolved[key], ...tree });
    modules.push(item);
  }
  const cliDir = path.join(out, SKILLS_CLI_ITEM);
  const cliPkg = JSON.parse(fs.readFileSync(path.join(cliDir, 'package.json'), 'utf8'));
  const cliTree = hashTree(cliDir);
  const dependencies = installedPackages(cliDir);
  items.push({
    name: SKILLS_CLI_ITEM,
    path: SKILLS_CLI_ITEM,
    repository: `npm:${SKILLS_CLI_PACKAGE}`,
    requestedRef: bmadRef.skillsCli,
    resolvedIntegrity: resolved.skillsCli,
    ...cliTree,
  });
  const coreDir = path.join(out, UPSTREAM.core.item);
  const bmad = bmadRequiredSkillsSource(coreDir, repositories.core);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    builder: BUILDER_MODULE,
    bmadRef: Object.fromEntries(BMAD_REF_KEYS.map((k) => [k, bmadRef[k]])),
    repositories: { core: repositories.core, tea: repositories.tea, cis: repositories.cis },
    modules,
    omitted,
    pending: [
      { name: 'ma-bmad-extensions', requestedRef: bmadRef.extensions, story: '39.1' },
      { name: 'runtime', story: '39.1' },
    ],
    bmodMethod: bmodMethodVersion(coreDir),
    bmadRequiredSkillsSource: bmad.source,
    bmadSkill: `${UPSTREAM.core.item}/${bmad.skillPath}`,
    skillsCli: {
      package: cliPkg.name,
      version: cliPkg.version,
      bin: skillsCliBinEntry(cliPkg),
      enginesNode: (cliPkg.engines && cliPkg.engines.node) || '',
      treeSha256: cliTree.treeSha256,
      dependencyCount: dependencies.length,
      dependencies,
    },
    size: items.reduce((n, i) => n + i.size, 0),
    items,
  };
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(out, MANIFEST_NAME), text);
  return { text, sha256: sha256(text), manifest };
}

// ─── build (AC2) ─────────────────────────────────────────────────────────────

function prepareOut(out) {
  if (fs.existsSync(out)) {
    const entries = fs.readdirSync(out);
    if (entries.length && !entries.includes(MANIFEST_NAME)) {
      throw new Error(`refusing to replace ${out}: it is not empty and holds no ${MANIFEST_NAME} from an earlier build`);
    }
    removeTree(out);
  }
  fs.mkdirSync(out, { recursive: true });
}

/**
 * Build the bundle into `out` from `bmadRef`. `repositories` overrides the
 * upstream URLs (tests point it at local repositories).
 */
function buildBundle({ out, bmadRef, repositories = {}, log = () => {} }) {
  const problems = validateBmadRef(bmadRef);
  if (problems.length) throw new Error(`invalid bmadRef:\n  ${problems.join('\n  ')}`);
  const repos = {
    core: repositories.core || UPSTREAM.core.repository,
    tea: repositories.tea || UPSTREAM.tea.repository,
    cis: repositories.cis || UPSTREAM.cis.repository,
  };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-bundle-'));
  const resolved = {};
  try {
    prepareOut(out);
    log(`core: ${repos.core} @ ${bmadRef.core}`);
    resolved.core = fetchCommit(repos.core, bmadRef.core, path.join(work, 'core'));
    copyTree(path.join(work, 'core', 'skills'), path.join(out, UPSTREAM.core.item, 'skills'));
    for (const key of ['tea', 'cis']) {
      if (bmadRef[key] === '') { log(`${key}: omitted (${OMISSION_REASON[key]})`); continue; }
      log(`${key}: ${repos[key]} @ ${bmadRef[key]}`);
      resolved[key] = fetchTag(repos[key], bmadRef[key], path.join(work, key));
      copyTree(path.join(work, key, 'skills'), path.join(out, UPSTREAM[key].item, 'skills'));
    }
    log(`skills-cli: npm ${SKILLS_CLI_PACKAGE}@${bmadRef.skillsCli}`);
    const cliDir = path.join(out, SKILLS_CLI_ITEM);
    resolved.skillsCli = packSkillsCli(bmadRef.skillsCli, path.join(work, 'pack'), cliDir).integrity;
    verifySkillsCli(cliDir, bmadRef.skillsCli);
    return writeManifest(out, { bmadRef, repositories: repos, resolved });
  } finally {
    removeTree(work);
  }
}

/** `ma-agents bundle build [--out <dir>]`. */
function runBundleBuild(args, { packageRoot = path.resolve(__dirname, '..'), stdout = console.log, stderr = console.error } = {}) {
  let out = path.join(packageRoot, 'bundle');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) out = path.resolve(args[++i]);
    else if (args[i].startsWith('--out=')) out = path.resolve(args[i].slice('--out='.length));
    else { stderr(`Unknown argument: ${args[i]}\n  Usage: ma-agents bundle build [--out <dir>]`); return 2; }
  }
  const bmadRef = readPackageJson(packageRoot).bmadRef;
  try {
    const { sha256: digest, manifest } = buildBundle({ out, bmadRef, log: (m) => stdout(`  ${m}`) });
    stdout(`bundle: ${out}`);
    stdout(`manifest.json sha256 ${digest}`);
    stdout(`modules: ${manifest.modules.join(', ')}${manifest.omitted.length ? `; omitted: ${manifest.omitted.map((o) => o.name).join(', ')}` : ''}`);
    stdout(`skills-cli ${manifest.skillsCli.version} (${manifest.skillsCli.dependencyCount} dependencies), engines.node ${manifest.skillsCli.enginesNode}`);
    return 0;
  } catch (err) {
    stderr(`bundle build failed: ${err.message}`);
    return 1;
  }
}

module.exports = {
  BUILDER_MODULE, MANIFEST_NAME, UPSTREAM, BMAD_REF_KEYS, SKILLS_CLI_ITEM,
  SHA_RE, SEMVER_EXACT_RE, TAG_RE,
  validateBmadRef, readPackageJson,
  removeTree, listFiles, hashTree,
  fetchCommit, fetchTag,
  extractNpmTarball, verifySkillsCli, skillsCliBinEntry, installedPackages,
  bmadRequiredSkillsSource, bmodMethodVersion,
  writeManifest, buildBundle, runBundleBuild,
};
