#!/usr/bin/env node
/**
 * Story 36.2 (FR282, Decision P5-11.6) — offline wheelhouse coverage.
 *
 * Every v7 skill script runs offline with `--no-cache`, so the bundled wheelhouse
 * is its only package source. This test reads the PEP 723 `# /// script` headers
 * of every `skills/**\/scripts/**\/*.py` (paths with a `tests` segment excluded:
 * upstream unit tests declare pytest and never run in an activation) and asserts,
 * against the wheelhouse manifest written by `scripts/build-wheelhouse.py`:
 *
 *   - every declared dependency has a wheel for every platform the manifest lists;
 *   - every script that declares a dependency is listed in the manifest with the
 *     same dependency list (the builder's enumeration agrees with this one);
 *   - every pinned package has exactly one wheel per platform, with a SHA-256 and
 *     a platform tag that fits the platform.
 *
 * AC9: (1) runs on a fixture snapshot + fixture manifest (test/fixtures/wheelhouse);
 *      (2) runs on the real snapshot (`bundle/bmad-method/`, Story 36.3) and its
 *          manifest when both are on disk, else is skipped with the reason printed.
 *          `MA_WHEELHOUSE_SNAPSHOT` / `MA_WHEELHOUSE_MANIFEST` point it elsewhere.
 * Pure Node: no Python and no uv needed.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'wheelhouse');

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

function skip(name, reason) {
  console.log(`  - SKIP ${name}: ${reason}`);
  skipped++;
}

// ─── PEP 723 reading (the same rules as scripts/build-wheelhouse.py) ─────────

/** PEP 503 normalised project name. */
function normalize(name) {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}

/** Project name of a PEP 508 requirement string. */
function requirementName(req) {
  const m = /^\s*([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/.exec(req);
  if (!m) throw new Error(`cannot read a project name from requirement ${JSON.stringify(req)}`);
  return normalize(m[1]);
}

/**
 * The PEP 723 `script` block of a source file as { requiresPython, dependencies },
 * or null when the file has none. Reads the two keys the runtime depends on; the
 * dependency array may span lines.
 */
function parsePep723(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^# \/\/\/ script\s*$/.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^# \/\/\/\s*$/.test(l));
  if (end < 0) throw new Error('PEP 723 block has no closing `# ///`');
  const body = lines.slice(start + 1, end).map((l) => (l === '#' ? '' : l.replace(/^# /, ''))).join('\n');
  const rp = /^requires-python\s*=\s*"([^"]*)"/m.exec(body);
  const open = /^dependencies\s*=\s*\[/m.exec(body);
  return { requiresPython: rp ? rp[1] : null, dependencies: open ? readStringArray(body, open.index + open[0].length) : [] };
}

/**
 * The strings of a TOML array whose `[` ends just before `from`: scans to the
 * closing `]` outside any string (a requirement's `[extra]` sits inside quotes),
 * skipping `#` comments.
 */
function readStringArray(text, from) {
  const items = [];
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ']') return items;
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== ch) {
        if (ch === '"' && text[j] === '\\') { value += text[j + 1]; j += 2; } else { value += text[j]; j++; }
      }
      if (j >= text.length) throw new Error('unterminated string in `dependencies`');
      items.push(value);
      i = j + 1;
      continue;
    }
    i++;
  }
  throw new Error('`dependencies` array has no closing `]`');
}

/** `*.py` under `<root>/skills/**\/scripts/`, excluding any path with a `tests` segment. */
function enumerateScripts(root) {
  const skillsRoot = path.join(root, 'skills');
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith('.py')) {
        const rel = path.relative(skillsRoot, abs).split(path.sep);
        const dirs = rel.slice(0, -1);
        if (!dirs.includes('scripts') || dirs.includes('tests')) continue;
        const header = parsePep723(fs.readFileSync(abs, 'utf8'));
        out.push({
          path: `skills/${rel.join('/')}`,
          requiresPython: header ? header.requiresPython : null,
          dependencies: header ? header.dependencies : [],
        });
      }
    }
  };
  walk(skillsRoot);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const PLATFORM_TAG = {
  'linux-x64': /^(any|manylinux(2014|_2_\d+)_x86_64)$/,
  'win-x64': /^(any|win_amd64)$/,
};

/** Problems with the wheelhouse for these scripts; empty when it covers them. */
function coverageProblems(scripts, manifest) {
  const problems = [];
  const platforms = Object.keys(manifest.platforms || {}).sort();
  if (platforms.length === 0) problems.push('manifest lists no platform');
  for (const platform of platforms) {
    const entry = manifest.platforms[platform];
    const wheels = entry.wheels || [];
    const byName = new Map();
    for (const w of wheels) byName.set(normalize(w.name), (byName.get(normalize(w.name)) || 0) + 1);
    for (const s of scripts) {
      for (const dep of s.dependencies) {
        const name = requirementName(dep);
        if (!byName.has(name)) {
          problems.push(`${s.path}: dependency ${name} (${dep}) has no wheel for platform ${platform}`);
        }
      }
    }
    for (const pin of entry.pins || []) {
      const name = requirementName(pin);
      const n = byName.get(name) || 0;
      if (n !== 1) problems.push(`${platform}: pin ${pin} has ${n} wheels (expected 1)`);
    }
    const tagRe = PLATFORM_TAG[platform];
    for (const w of wheels) {
      if (!/^[0-9a-f]{64}$/.test(w.sha256 || '')) problems.push(`${platform}/${w.file}: no sha256`);
      const tags = String(w.platform_tag || '').split('.');
      if (tagRe && !tags.some((t) => tagRe.test(t))) {
        problems.push(`${platform}/${w.file}: platform tag ${w.platform_tag} does not fit ${platform}`);
      }
    }
  }
  return problems;
}

/** Scripts this enumeration finds with dependencies that the manifest does not list identically. */
function listingProblems(scripts, manifest, source = 'snapshot') {
  const listed = new Map(
    (manifest.scripts || []).filter((s) => s.source === source).map((s) => [s.path, s.dependencies || []])
  );
  const problems = [];
  for (const s of scripts.filter((x) => x.dependencies.length > 0)) {
    if (!listed.has(s.path)) problems.push(`${s.path} declares ${s.dependencies.join(', ')} but is not in the manifest`);
    else if (JSON.stringify(listed.get(s.path)) !== JSON.stringify(s.dependencies)) {
      problems.push(`${s.path}: manifest lists ${JSON.stringify(listed.get(s.path))}, header says ${JSON.stringify(s.dependencies)}`);
    }
  }
  return problems;
}

function dependencySet(scripts) {
  return new Set(scripts.flatMap((s) => s.dependencies.map(requirementName)));
}

function readManifest(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ─── PEP 723 parsing ─────────────────────────────────────────────────────────
console.log('\nPEP 723 header parsing');

test('single-line dependency array', () => {
  const h = parsePep723('# /// script\n# requires-python = ">=3.11"\n# dependencies = ["jinja2>=3.1"]\n# ///\n');
  assert.deepStrictEqual(h, { requiresPython: '>=3.11', dependencies: ['jinja2>=3.1'] });
});

test('multi-line array, CRLF, extras and markers; names normalised', () => {
  const src = '# /// script\r\n# dependencies = [\r\n#   "PyYAML[libyaml] >= 6 ; python_version >= \'3.11\'",\r\n#   \'Jinja2\',\r\n# ]\r\n# ///\r\n';
  const h = parsePep723(src);
  assert.strictEqual(h.dependencies.length, 2);
  assert.deepStrictEqual(h.dependencies.map(requirementName), ['pyyaml', 'jinja2']);
});

test('no block → null; block without dependencies → []', () => {
  assert.strictEqual(parsePep723('"""module"""\nimport os\n'), null);
  assert.deepStrictEqual(parsePep723('# /// script\n# requires-python = ">=3.11"\n# ///\n').dependencies, []);
});

// ─── AC9 (1): fixture snapshot + fixture manifest ────────────────────────────
console.log('\nAC9 (1): fixture snapshot and fixture manifest');

const fixtureScripts = enumerateScripts(path.join(FIXTURE, 'snapshot'));
const fixtureManifest = readManifest(path.join(FIXTURE, 'wheelhouse-manifest.json'));

test('enumeration excludes `tests` paths and keeps scripts without a header', () => {
  const paths = fixtureScripts.map((s) => s.path);
  assert.ok(!paths.some((p) => p.split('/').includes('tests')), `tests leaked into ${paths}`);
  assert.ok(paths.includes('skills/bmad/scripts/config_utils.py'));
  assert.strictEqual(paths.length, 5, `expected 5 scripts, got ${paths.join(', ')}`);
});

test('dependency set contains jinja2 and pyyaml (and not the excluded test\'s pytest)', () => {
  const deps = dependencySet(fixtureScripts);
  for (const d of ['jinja2', 'pyyaml']) assert.ok(deps.has(d), `missing ${d} in ${[...deps]}`);
  assert.ok(!deps.has('pytest'));
  assert.deepStrictEqual([...deps].sort(), [...fixtureManifest.dependencies].sort());
});

test('every declared dependency has a wheel for every platform', () => {
  assert.deepStrictEqual(Object.keys(fixtureManifest.platforms).sort(), ['linux-x64', 'win-x64']);
  assert.deepStrictEqual(coverageProblems(fixtureScripts, fixtureManifest), []);
});

test('every script that declares a dependency is listed in the manifest', () => {
  assert.deepStrictEqual(listingProblems(fixtureScripts, fixtureManifest), []);
});

test('checker goes red on an uncovered dependency, naming script, package and platform', () => {
  const extra = [...fixtureScripts, { path: 'skills/x/scripts/fetch.py', dependencies: ['requests>=2'] }];
  const problems = coverageProblems(extra, fixtureManifest);
  assert.strictEqual(problems.length, 2, problems.join('\n'));
  for (const p of ['linux-x64', 'win-x64']) {
    assert.ok(problems.includes(`skills/x/scripts/fetch.py: dependency requests (requests>=2) has no wheel for platform ${p}`),
      problems.join('\n'));
  }
});

test('checker goes red on a script missing from the manifest', () => {
  const trimmed = { ...fixtureManifest, scripts: fixtureManifest.scripts.filter((s) => !s.path.includes('bmad-agent-po')) };
  assert.deepStrictEqual(listingProblems(fixtureScripts, trimmed),
    ['skills/bmad-agent-po/scripts/tickets.py declares pyyaml>=6.0.2,<7 but is not in the manifest']);
});

// ─── AC9 (2): the real snapshot (Story 36.3 `bundle/`) ───────────────────────
console.log('\nAC9 (2): real snapshot');

const realSnapshot = process.env.MA_WHEELHOUSE_SNAPSHOT || path.join(projectRoot, 'bundle', 'bmad-method');
const realManifest = process.env.MA_WHEELHOUSE_MANIFEST
  || path.join(projectRoot, 'bundle', 'runtime', 'wheelhouse', 'wheelhouse-manifest.json');

if (!fs.existsSync(path.join(realSnapshot, 'skills'))) {
  skip('real snapshot coverage', `no snapshot on disk at ${realSnapshot} (built by Story 36.3 \`bundle build\`)`);
} else if (!fs.existsSync(realManifest)) {
  skip('real snapshot coverage', `snapshot present but no wheelhouse manifest at ${realManifest} `
    + '(built by scripts/build-wheelhouse.py; placed in the bundle by Story 39.1)');
} else {
  const scripts = enumerateScripts(realSnapshot);
  const manifest = readManifest(realManifest);
  console.log(`    snapshot ${realSnapshot} (${scripts.length} scripts), manifest commit ${manifest.snapshot && manifest.snapshot.commit}`);
  test('real: the builder\'s dependency set (manifest) contains jinja2 and pyyaml', () => {
    const deps = new Set((manifest.dependencies || []).map(normalize));
    for (const d of ['jinja2', 'pyyaml']) assert.ok(deps.has(d), `manifest dependencies lack ${d}: ${[...deps]}`);
  });
  test('real: the manifest\'s dependency set equals the one read from the headers', () => {
    assert.deepStrictEqual([...new Set((manifest.dependencies || []).map(normalize))].sort(), [...dependencySet(scripts)].sort());
  });
  test('real: every script that declares a dependency is listed in the manifest', () => {
    assert.deepStrictEqual(listingProblems(scripts, manifest), []);
  });
  test('real: every declared dependency has a wheel for every platform', () => {
    assert.deepStrictEqual(coverageProblems(scripts, manifest), []);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
