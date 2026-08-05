#!/usr/bin/env node
/**
 * Tests for Story 31.2: project-layout.yaml Becomes the Authoritative,
 * Unconditional Two-Store Binding Record (Spine)
 *
 * Covers the ACs not already exercised by the pre-existing Epic 16 suites
 * (config-storage.test.js, config-lost-on-update.test.js, portable-paths.test.js,
 * config-layout.test.js) after those were updated for the new schema:
 *   AC1 — exactly three location records, no fourth store
 *   AC4 — reading is one-way/one-place; the resolver never touches config.yaml
 *   AC5 — legacy (FR122) project-layout.yaml reads as both stores, no rewrite
 *   AC6 — no credential-shaped field can be written (NFR79)
 *   AC7 — deterministic, byte-identical except `generated` (NFR81)
 *   AC8 — the binding resolver succeeds with `_bmad/` entirely absent (NFR83)
 *   AC9 — _bmad-output/ is not gitignored (FR58) — pinned by the existing
 *         test/bmad-output-policy.test.js `ensureBmadOutputTracked()` suite;
 *         this file adds one direct check that writeProjectLayoutYaml() itself
 *         never touches .gitignore.
 *
 * Plus regression sections R-1 … R-6, from the independent re-review of the
 * first fix round. Every one of those findings had a working proof-of-concept,
 * so each section pins the PoC rather than the prose.
 *
 * ORACLE. Where the subject under test is "what bytes reached the authoritative
 * file", these tests assert with js-yaml — a real YAML parser, and already a
 * DIRECT dependency of this package (package.json `dependencies`) — and not only
 * with the module's own line-based `parseLayoutYaml`. That distinction is the
 * whole of R-1: the first fix round emitted files that `parseLayoutYaml`
 * round-tripped happily and a conforming parser rejected outright, so a suite
 * that only ever consults the hand-rolled reader cannot see the bug. If js-yaml
 * ever stops resolving, the oracle degrades to an explicit escaping assertion
 * rather than silently skipping — see `assertEmittedYamlIsValid`.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Load module ─────────────────────────────────────────────────────────────
let writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
  PROJECT_LAYOUT_SCHEMA_VERSION, showCurrentLayout, writeRepoLayoutConfig,
  yamlEscapeValue, parseLayoutYaml,
  BINDING_UNBOUND, BINDING_UNREADABLE, BINDING_INVALID;
try {
  ({
    writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology,
    PROJECT_LAYOUT_SCHEMA_VERSION, showCurrentLayout, writeRepoLayoutConfig,
    yamlEscapeValue, parseLayoutYaml,
    BINDING_UNBOUND, BINDING_UNREADABLE, BINDING_INVALID,
  } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── js-yaml oracle (a declared direct dependency; never installed by a test) ──
let yamlOracle = null;
try {
  yamlOracle = require('js-yaml');
} catch (e) {
  yamlOracle = null;
}

// Character helpers. Built via fromCharCode so the exact bytes under test are
// unambiguous in the source and survive any editor or encoding round trip.
const C = (n) => String.fromCharCode(n);
const BS = C(92);   // backslash
const Q = C(34);    // double quote

// The set that must never appear RAW inside an emitted double-quoted scalar.
// Built programmatically for the same reason as above.
const RAW_FORBIDDEN = new RegExp(
  '[' + C(0) + '-' + C(0x1f) + C(0x7f) + '-' + C(0x9f) + C(0xa0) + C(0x2028) + C(0x2029) + C(0xfeff) + ']'
);

/**
 * The oracle. Asserts the emitted file is readable by a real YAML parser and
 * returns the parsed document for further assertions.
 *
 * If js-yaml is genuinely unavailable, falls back to asserting the escaping
 * invariant directly — every double-quoted scalar must contain no raw character
 * from the must-escape set, and every backslash must open a legal escape. That
 * is weaker than a real parse, but it is a real assertion, not a skip.
 */
function assertEmittedYamlIsValid(content, what) {
  if (yamlOracle) {
    try {
      return yamlOracle.load(content);
    } catch (e) {
      throw new Error(
        `${what}: the emitted file is NOT parseable by js-yaml, so the ` +
        `authoritative record is unreadable to any real YAML parser: ` +
        `${e.message.split('\n')[0]}`
      );
    }
  }
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*[A-Za-z_][A-Za-z0-9_]*:\s*(".*")\s*$/);
    if (!m) continue;
    const scalar = m[1];
    assert.ok(!RAW_FORBIDDEN.test(scalar),
      `${what}: raw control/line-break character left unescaped in ${JSON.stringify(scalar)}`);
    const body = scalar.slice(1, -1);
    for (let i = 0; i < body.length; i++) {
      if (body[i] !== BS) continue;
      const rest = body.slice(i + 1);
      const short = rest[0] === BS || rest[0] === Q;
      assert.ok(short || /^u[0-9a-fA-F]{4}/.test(rest),
        `${what}: dangling backslash escape in ${JSON.stringify(scalar)}`);
      i += short ? 1 : 4;
    }
  }
  return null;
}

function withTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  return { tmpDir, cleanup() { process.chdir(origCwd); fs.rmSync(tmpDir, { recursive: true, force: true }); } };
}

function layoutPathOf(tmpDir) {
  return path.join(tmpDir, '_bmad-output', 'project-layout.yaml');
}

function writeLayoutFixture(tmpDir, lines, eol) {
  fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
  const body = Array.isArray(lines) ? lines.join(eol || '\n') : lines;
  fs.writeFileSync(layoutPathOf(tmpDir), body, 'utf-8');
  return body;
}

// Captures console.log so the warn-and-continue / refuse-to-overwrite paths can
// be asserted on their user-visible output.
function capture(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return logs.join('\n');
}

// Unwraps an ok result, failing loudly with the reason when it is not ok.
function topologyOf(result) {
  assert.ok(result && typeof result === 'object', 'the resolver must always return a result object');
  assert.ok(result.ok, `expected an ok binding, got ${result.reason}: ${result.message}`);
  return result.topology;
}

// ─── AC1 — exactly three location records ─────────────────────────────────
console.log('\nAC1 — exactly three location records');

test('writes exactly system_requirements_store, software_requirements_store, sprint_management — no fourth', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(path.dirname(tmpDir), 'kb') },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    const topLevelKeys = content
      .split(/\r?\n/)
      .filter(l => /^[A-Za-z_]/.test(l))
      .map(l => l.split(':')[0]);
    const storeKeys = topLevelKeys.filter(k => k.endsWith('_store') || k === 'sprint_management');
    assert.deepStrictEqual(
      storeKeys.sort(),
      ['software_requirements_store', 'sprint_management', 'system_requirements_store'],
      `expected exactly 3 location records, got: ${storeKeys.join(', ')}`
    );
    assert.ok(!content.includes('implementation_artifacts'), 'no implementation_artifacts record (FR267)');
    const doc = assertEmittedYamlIsValid(content, 'AC1');
    if (doc) {
      assert.deepStrictEqual(
        Object.keys(doc).filter(k => k.endsWith('_store') || k === 'sprint_management').sort(),
        ['software_requirements_store', 'sprint_management', 'system_requirements_store'],
        'a real parser must see exactly the same three records'
      );
    }
  } finally {
    cleanup();
  }
});

test('each store carries a backend field (file-system | confluence)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    const backendCount = (content.match(/^\s+backend: file-system/gm) || []).length;
    assert.strictEqual(backendCount, 2, 'both system and software stores should declare backend: file-system');
    const sprintSection = content.split('sprint_management:')[1] || '';
    assert.ok(!sprintSection.includes('backend:'), 'sprint_management has no backend field (P5-9.5)');
  } finally {
    cleanup();
  }
});

test('an unrecognized backend value fails loud instead of silently coercing to file-system', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    assert.throws(
      () => writeProjectLayoutYaml({
        systemRequirementsStore: { backend: 'sharepoint', path: '/wherever' },
        softwareRequirementsStore: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      }),
      /Invalid store backend "sharepoint"/,
      'a typo\'d/unknown backend must throw, not silently write backend: file-system'
    );
  } finally {
    cleanup();
  }
});

// ─── AC4 — the resolver reads project-layout.yaml alone ───────────────────
console.log('\nAC4 — one-way, one-place: resolver never references config.yaml');

test('resolveProjectTopology reports `unbound` when only config.yaml exists (no fallback)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/somewhere/else"\nsprint_management_path: "."\n');
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false,
      'the resolver must not fall back to config.yaml — that is readExistingLayout()\'s install-time convenience only');
    assert.strictEqual(result.reason, BINDING_UNBOUND,
      'no project-layout.yaml is "unbound", not "invalid" — the distinction gates whether a caller may write');
    assert.ok(!('topology' in result), 'an unbound result carries no topology');
  } finally {
    cleanup();
  }
});

test('changing config.yaml does not change what the resolver returns from project-layout.yaml', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(path.dirname(tmpDir), 'kb-fixed') },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const before = resolveProjectTopology(tmpDir);
    assert.ok(before.ok, 'sanity: the written layout resolves');

    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/totally/different/path"\n');

    const after = resolveProjectTopology(tmpDir);
    assert.deepStrictEqual(after, before, 'project-layout.yaml is never derived from / influenced by config.yaml');
  } finally {
    cleanup();
  }
});

// ─── AC5 — legacy (FR122) read: both stores, no error, no rewrite ─────────
console.log('\nAC5 — legacy project-layout.yaml reads as both stores, no rewrite');

test('pre-F26 knowledgebase/sprint_management shape resolves as both stores pointing at that location', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const legacyContent = writeLayoutFixture(tmpDir, [
      '# Generated by ma-agents — do not edit manually',
      'generated: "2026-03-26"',
      'knowledgebase:',
      '  mode: local',
      '  path: "/legacy/kb"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);

    const topology = topologyOf(resolveProjectTopology(tmpDir));
    assert.strictEqual(topology.schemaVersion, 1);
    assert.strictEqual(topology.systemRequirementsStore.path, '/legacy/kb');
    assert.strictEqual(topology.softwareRequirementsStore.path, '/legacy/kb');
    assert.strictEqual(topology.systemRequirementsStore.backend, 'file-system');
    assert.strictEqual(topology.softwareRequirementsStore.backend, 'file-system');
    assert.strictEqual(topology.sprintManagement.path, '.');

    const afterRead = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.strictEqual(afterRead, legacyContent, 'reading must never rewrite the legacy file');
  } finally {
    cleanup();
  }
});

test('legacy single knowledgebase_path (config.yaml only) reads as both stores via readExistingLayout (install-time path)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/legacy/only/kb"\nsprint_management_path: "."\n');

    const result = readExistingLayout();
    assert.ok(result, 'should read legacy config.yaml-only layout');
    assert.strictEqual(result.knowledgebase.path, '/legacy/only/kb');
    assert.strictEqual(result.sprintManagement.path, '.');
  } finally {
    cleanup();
  }
});

// ─── AC6 — no credential-shaped field can be written (NFR79) ──────────────
console.log('\nAC6 — no credential-shaped field can be written (NFR79)');

test('confluence store writes only backend/space_key/root_page{title,id} — credentials never leak', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence',
        spaceKey: 'ENG',
        rootPage: { title: 'My Project', id: 'internal-id-123' },
        // Exactly the shape of fields that must NEVER appear in the committed
        // file — attached here to prove the writer ignores them.
        apiToken: 'sk-super-secret-token-999',
        password: 'hunter2',
        username: 'svc-account',
        authHeader: 'Bearer sk-super-secret-token-999',
      },
      softwareRequirementsStore: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');

    assert.ok(content.includes('backend: confluence'), 'confluence backend recorded');
    assert.ok(content.includes('space_key: "ENG"'), 'space key recorded');
    assert.ok(content.includes('title: "My Project"'), 'root page title recorded');
    assert.ok(content.includes('id: "internal-id-123"'), 'root page id recorded');

    for (const secret of ['sk-super-secret-token-999', 'hunter2', 'svc-account', 'Bearer ']) {
      assert.ok(!content.includes(secret), `credential value "${secret}" must never be written`);
    }
    for (const field of ['apiToken', 'password', 'username', 'authHeader', 'api_token', 'auth_header']) {
      assert.ok(!content.includes(field), `credential-shaped field "${field}" must never be written`);
    }

    const doc = assertEmittedYamlIsValid(content, 'AC6');
    if (doc) {
      assert.deepStrictEqual(
        Object.keys(doc.system_requirements_store).sort(),
        ['backend', 'root_page', 'space_key'],
        'a real parser must see exactly the three permitted store keys'
      );
      assert.deepStrictEqual(Object.keys(doc.system_requirements_store.root_page).sort(), ['id', 'title']);
    }
  } finally {
    cleanup();
  }
});

test('confluence store with no root_page id reserves the field as null (schema stays sealed either way OQ-4 resolves)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence',
        spaceKey: 'ENG',
        rootPage: { title: 'My Project', id: null },
      },
      softwareRequirementsStore: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(/root_page:\s*\n\s*title: "My Project"\s*\n\s*id: null/.test(content),
      `root_page must carry both title and id (id may be null pending OQ-4), got: ${content}`);

    const topology = topologyOf(resolveProjectTopology(tmpDir));
    assert.strictEqual(topology.systemRequirementsStore.rootPage.title, 'My Project');
    assert.strictEqual(topology.systemRequirementsStore.rootPage.id, null);

    const doc = assertEmittedYamlIsValid(content, 'AC6 root_page');
    if (doc) assert.strictEqual(doc.system_requirements_store.root_page.id, null);
  } finally {
    cleanup();
  }
});

// ─── AC7 — deterministic, byte-identical except `generated` (NFR81) ───────
console.log('\nAC7 — deterministic across runs (schema v2)');

test('same answers produce byte-identical files across repeated writes (generated date excluded)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const layout = {
      knowledgebase: { mode: 'local', path: path.join(path.dirname(tmpDir), 'stable-kb') },
      sprintManagement: { mode: 'remote', path: path.join(path.dirname(tmpDir), 'stable-sprint'), gitUrl: 'https://git.example.com/sprint.git' },
    };
    writeProjectLayoutYaml(layout);
    const first = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8').replace(/^generated: .*$/m, 'generated: "REDACTED"');
    writeProjectLayoutYaml(layout);
    const second = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8').replace(/^generated: .*$/m, 'generated: "REDACTED"');
    assert.strictEqual(first, second, 'identical inputs must produce byte-identical output apart from `generated`');
  } finally {
    cleanup();
  }
});

test('schema_version is present and stable', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(content.includes(`schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}`));
  } finally {
    cleanup();
  }
});

// ─── AC8 — resolver succeeds with `_bmad/` entirely absent (NFR83) ────────
console.log('\nAC8 — binding resolver resolves with _bmad/ entirely absent');

test('resolveProjectTopology returns the full topology from a project root with no _bmad/ directory at all', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad')), 'sanity: _bmad/ must not exist for this test');

    writeProjectLayoutYaml({
      knowledgebase: { mode: 'remote', path: path.join(path.dirname(tmpDir), 'global-kb'), gitUrl: 'https://git.example.com/kb.git' },
      sprintManagement: { mode: 'local', path: path.join(path.dirname(tmpDir), 'global-sprint') },
    });

    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad')), '_bmad/ must still not exist — writing the layout creates no per-machine state');

    const topology = topologyOf(resolveProjectTopology(tmpDir));
    assert.strictEqual(topology.systemRequirementsStore.mode, 'remote');
    assert.strictEqual(topology.systemRequirementsStore.gitUrl, 'https://git.example.com/kb.git');
    assert.strictEqual(topology.softwareRequirementsStore.mode, 'remote');
    assert.strictEqual(topology.sprintManagement.mode, 'local');
    assert.strictEqual(topology.schemaVersion, PROJECT_LAYOUT_SCHEMA_VERSION);
  } finally {
    cleanup();
  }
});

// ─── AC9 — _bmad-output/ is not gitignored (FR58) ─────────────────────────
console.log('\nAC9 — _bmad-output/ stays tracked (FR58)');

test('writeProjectLayoutYaml never touches .gitignore', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n_bmad-output/\n');
    const before = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } });
    const after = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    assert.strictEqual(before, after, 'writeProjectLayoutYaml must not modify .gitignore — that is ensureBmadOutputTracked()\'s job (Story 10.1, test/bmad-output-policy.test.js)');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-1 — yamlEscapeValue is a TOTAL, CORRECT escaper. No input may produce a
//       file a real YAML parser rejects, and no error message may name a file
//       the failing call path does not write.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-1 — the escaper always emits a parseable double-quoted scalar');

// The re-review's sweep. Each entry is a value the first fix round either
// emitted unparseably or silently mangled.
const ADVERSARIAL_VALUES = [
  ['trailing backslash', 'Team Docs' + BS],
  ['leading backslash', BS + 'Team Docs'],
  ['double backslash', 'a' + BS + BS + 'b'],
  ['NUL', 'a' + C(0) + 'b'],
  ['SOH 0x01', 'a' + C(1) + 'b'],
  ['VT 0x0b', 'a' + C(11) + 'b'],
  ['FF 0x0c', 'a' + C(12) + 'b'],
  ['DEL 0x7f', 'a' + C(127) + 'b'],
  ['embedded quote', 'a' + Q + 'b'],
  ['quote then backslash', Q + BS],
  ['colon space', 'a: b'],
  ['hash comment start', '# not a comment'],
  ['tab', 'a' + C(9) + 'b'],
  ['NBSP', 'a' + C(0xa0) + 'b'],
  ['BOM', 'a' + C(0xfeff) + 'b'],
  ['trailing space', 'x '],
  ['leading space', ' x'],
  ['yaml flow chars', '{a: [b, c]} &anchor *alias !!tag |> %25 @at `tick'],
];

test('every adversarial value survives writer -> js-yaml -> exact original', () => {
  for (const [name, value] of ADVERSARIAL_VALUES) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      writeProjectLayoutYaml({
        systemRequirementsStore: {
          backend: 'confluence',
          spaceKey: value,
          rootPage: { title: value, id: value },
        },
        softwareRequirementsStore: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      });
      const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
      const doc = assertEmittedYamlIsValid(content, `R-1 [${name}]`);
      if (doc) {
        const store = doc.system_requirements_store;
        assert.strictEqual(store.space_key, value, `R-1 [${name}]: space_key mangled by the round trip`);
        assert.strictEqual(store.root_page.title, value, `R-1 [${name}]: root_page.title mangled`);
        assert.strictEqual(store.root_page.id, value, `R-1 [${name}]: root_page.id mangled`);
      }
      // The module's own reader must agree with the real parser exactly — a
      // reader/writer disagreement is R-4.
      const own = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
      assert.strictEqual(own.spaceKey, value, `R-1 [${name}]: parseLayoutYaml disagrees with js-yaml`);
      assert.strictEqual(own.rootPage.title, value, `R-1 [${name}]: parseLayoutYaml disagrees on title`);
    } finally {
      cleanup();
    }
  }
});

test('a trailing backslash does not produce the unparseable `title: "Team Docs' + BS + '"` of the first fix round', () => {
  // The precise PoC. `'"' + s + '"'` with no backslash escaping emitted
  //   title: "Team Docs\"
  // — the closing quote is escaped, so the scalar never terminates.
  const emitted = yamlEscapeValue('Team Docs' + BS);
  assert.strictEqual(emitted, Q + 'Team Docs' + BS + BS + Q,
    'a trailing backslash must be doubled so the closing quote is not escaped');
  if (yamlOracle) {
    assert.strictEqual(yamlOracle.load('title: ' + emitted).title, 'Team Docs' + BS);
  }
});

test('yamlEscapeValue never throws — rejection is not this layer\'s job', () => {
  // The first round threw here for five line-break characters. That fired from
  // the wrong layer (naming project-layout.yaml while writing config.yaml) AND
  // left the real corruption channels open. Escaping replaces it.
  for (const cp of [13, 10, 0x2028, 0x2029, 0x85]) {
    const v = 'a' + C(cp) + 'b';
    let threw = null;
    try { yamlEscapeValue(v); } catch (e) { threw = e; }
    assert.strictEqual(threw, null,
      `yamlEscapeValue must not throw on U+${cp.toString(16)} — it is shared with writeConfigField, ` +
      `which writes a different file entirely`);
    if (yamlOracle) {
      assert.strictEqual(yamlOracle.load('k: ' + yamlEscapeValue(v)).k, v,
        'the escaped line break must round-trip through a real parser');
    }
  }
});

test('an injection payload is escaped into one scalar, never split into a sibling key', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const payload = 'ENG' + Q + C(10) + '  api_token: ' + Q + 'sk-INJECTED-SECRET';
    // Escaping alone must neutralise this even where no policy guard applies: a
    // path is escaped, never rejected (see R-4).
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: payload },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(!/^\s*api_token:/m.test(content), 'no injected api_token key may reach the file');
    const doc = assertEmittedYamlIsValid(content, 'R-1 injection');
    if (doc) {
      assert.ok(!('api_token' in doc), 'no top-level injected key');
      assert.ok(!('api_token' in doc.system_requirements_store), 'no sibling injected key inside the store');
    }
  } finally {
    cleanup();
  }
});

console.log('\nR-1 (layer) — a config.yaml failure must never name project-layout.yaml');

test('writeRepoLayoutConfig with a line break in a path writes a VALID, non-empty config.yaml', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const output = capture(() => writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: '/ext/kb' + C(10) + 'injected: yes' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const configPath = path.join(tmpDir, '_bmad', 'bmm', 'config.yaml');
    assert.ok(fs.existsSync(configPath), 'config.yaml must exist');
    const body = fs.readFileSync(configPath, 'utf-8');

    // The first fix round left this file at 0 bytes and printed
    //   "Cannot write config.yaml: Refusing to write a value containing a line
    //    break into project-layout.yaml"
    // — naming a file this call path never touches.
    assert.ok(body.length > 0, 'config.yaml must not be left as a 0-byte file');
    assert.ok(!/project-layout\.yaml/.test(output),
      `a config.yaml write must never name project-layout.yaml in its output, got: ${output}`);
    assert.ok(!/^injected:/m.test(body), 'the line break must not inject a new config.yaml key');
    if (yamlOracle) {
      assert.strictEqual(yamlOracle.load(body).knowledgebase_path, '/ext/kb' + C(10) + 'injected: yes',
        'the path round-trips exactly through a real parser');
    }
  } finally {
    cleanup();
  }
});

test('a `$&` in a path is not expanded as a replacement pattern in config.yaml', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const weird = '/ext/a$&b$1c';
    // Twice, so the second call takes the regex-replace branch rather than append.
    capture(() => writeRepoLayoutConfig({ knowledgebase: { mode: 'local', path: weird }, sprintManagement: { mode: 'same', path: '.' } }));
    capture(() => writeRepoLayoutConfig({ knowledgebase: { mode: 'local', path: weird }, sprintManagement: { mode: 'same', path: '.' } }));
    const body = fs.readFileSync(path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    assert.ok(body.includes('knowledgebase_path: "' + weird + '"'),
      `a $-pattern in a path must be written literally, got: ${body}`);
    if (yamlOracle) assert.strictEqual(yamlOracle.load(body).knowledgebase_path, weird);
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-2 — the resolver's two-class contract is a DISCRIMINATED result, honoured
//       by every caller, and an invalid binding is never destroyed.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-2 — discriminated result; an invalid binding is never silently overwritten');

const NOTION_FIXTURE = [
  'schema_version: 2',
  'system_requirements_store:',
  '  backend: notion',
  '  database_id: "abc123"',
  'software_requirements_store:',
  '  backend: file-system',
  '  mode: same',
  '  path: "."',
  'sprint_management:',
  '  mode: same',
  '  path: "."',
];

test('an unrecognised backend yields {ok:false, reason:"invalid"} — never null, never a throw', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, NOTION_FIXTURE);
    let threw = null, result = null;
    try { result = resolveProjectTopology(tmpDir); } catch (e) { threw = e; }
    assert.strictEqual(threw, null, 'the resolver must not throw — consumers cannot be trusted to try/catch');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, BINDING_INVALID,
      'a bound-but-invalid project is `invalid`, NOT `unbound` — conflating them is the defect');
    assert.ok(/notion/.test(result.message), 'the message must name the offending value');
    assert.ok(/file-system|confluence/.test(result.message), 'the message must name the legal options');
  } finally {
    cleanup();
  }
});

test('an invalid binding is NOT reported as "Single-repo layout (default)" by showCurrentLayout', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, NOTION_FIXTURE);
    const output = capture(() => showCurrentLayout());
    assert.ok(!/Single-repo layout \(default\)/.test(output),
      `a bound-but-invalid project must not be reported as unbound, got: ${output}`);
    assert.ok(/invalid/.test(output), `the output must say the binding is invalid, got: ${output}`);
    assert.ok(/notion/.test(output), `the output must name the offending value, got: ${output}`);
  } finally {
    cleanup();
  }
});

test('an invalid binding is left BYTE-IDENTICAL by AC2\'s unconditional write', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = writeLayoutFixture(tmpDir, NOTION_FIXTURE);
    const output = capture(() => writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const after = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.strictEqual(after, before,
      'the notion binding must survive verbatim — the first fix round replaced it with file-system / path "." permanently');
    assert.ok(/Refusing to overwrite/.test(output), `the refusal must be reported, got: ${output}`);
    assert.ok(after.includes('backend: notion'), 'the original backend must still be on disk');
  } finally {
    cleanup();
  }
});

test('readExistingLayout reports an invalid binding rather than silently answering from config.yaml', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, NOTION_FIXTURE);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/from/config"\n');

    let result;
    const output = capture(() => { result = readExistingLayout(); });
    assert.strictEqual(result, null,
      'an invalid binding must not be answered from config.yaml — topology comes from project-layout.yaml alone (P5-9.1)');
    assert.ok(/invalid/.test(output), `the invalidity must be reported, got: ${output}`);
  } finally {
    cleanup();
  }
});

test('a schema_version NEWER than this build is gated as invalid and not overwritten', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = writeLayoutFixture(tmpDir, [
      `schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION + 1}`,
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'some_future_record:',
      '  kept: "yes"',
    ]);
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false, 'a too-new schema must not be read as if it were v2');
    assert.strictEqual(result.reason, BINDING_INVALID);
    assert.ok(new RegExp(`schema_version ${PROJECT_LAYOUT_SCHEMA_VERSION + 1}`).test(result.message),
      `the message must name the declared version, got: ${result.message}`);

    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } }));
    assert.strictEqual(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'), before,
      'a file from a newer ma-agents must not be downgraded — its unknown records would be dropped');
  } finally {
    cleanup();
  }
});

test('a non-numeric schema_version is invalid rather than silently treated as legacy', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: "two"',
      'knowledgebase:',
      '  mode: same',
      '  path: "."',
    ]);
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, BINDING_INVALID);
  } finally {
    cleanup();
  }
});

test('a file with content but no recognisable store record is invalid, not unbound', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const before = writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'something_else:',
      '  mode: same',
    ]);
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, BINDING_INVALID,
      'bytes we cannot interpret must block a write, not invite one');
    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } }));
    assert.strictEqual(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'), before, 'left unchanged');
  } finally {
    cleanup();
  }
});

test('an absent or empty file is `unbound`, and a write IS permitted (AC2 still unconditional)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    assert.strictEqual(resolveProjectTopology(tmpDir).reason, BINDING_UNBOUND, 'absent file');

    // Present but comments-only: nothing of value to preserve.
    writeLayoutFixture(tmpDir, ['# just a comment', '   ', '']);
    assert.strictEqual(resolveProjectTopology(tmpDir).reason, BINDING_UNBOUND,
      'an empty/comments-only file carries no binding');

    capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } }));
    const after = resolveProjectTopology(tmpDir);
    assert.ok(after.ok, 'AC2 must still write unconditionally where there is no binding to protect');
    assert.strictEqual(after.topology.schemaVersion, PROJECT_LAYOUT_SCHEMA_VERSION);
  } finally {
    cleanup();
  }
});

test('an unreadable file (a directory in its place) is `unreadable`, and is not overwritten', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // A real filesystem condition that makes readFileSync fail while the path
    // still exists — no monkey-patching required.
    fs.mkdirSync(layoutPathOf(tmpDir), { recursive: true });
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, BINDING_UNREADABLE,
      'a path that exists but cannot be read is `unreadable`, not `unbound`');
    const output = capture(() => writeProjectLayoutYaml({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } }));
    assert.ok(/Refusing to overwrite/.test(output), `must refuse, got: ${output}`);
    assert.ok(fs.statSync(layoutPathOf(tmpDir)).isDirectory(), 'the blocking entry is left alone');
  } finally {
    cleanup();
  }
});

test('an ABSENT backend still defaults to file-system (pre-F26 legacy block, AC5)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, ['knowledgebase:', '  mode: same', '  path: "."']);
    const topology = topologyOf(resolveProjectTopology(tmpDir));
    assert.strictEqual(topology.systemRequirementsStore.backend, 'file-system');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-3 — empty-scalar coercion in EVERY branch, not only file-system.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-3 — empty scalars coerce in every branch (never "[object Object]")');

test('confluence: empty space_key / title / id resolve to null, not {}', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key:',
      '  root_page:',
      '    title:',
      '    id:',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);
    const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.strictEqual(store.spaceKey, null, 'an empty space_key scalar must be null, not {}');
    assert.strictEqual(store.rootPage.title, null, 'an empty title scalar must be null, not {}');
    assert.strictEqual(store.rootPage.id, null, 'an empty id scalar must be null, not {}');
  } finally {
    cleanup();
  }
});

test('confluence: a round-tripped empty-scalar store never writes "[object Object]"', () => {
  const src = withTmpDir();
  let store, software, sprint;
  try {
    writeLayoutFixture(src.tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key:',
      '  root_page:',
      '    title:',
      '    id:',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const t = topologyOf(resolveProjectTopology(src.tmpDir));
    store = t.systemRequirementsStore;
    software = t.softwareRequirementsStore;
    sprint = t.sprintManagement;
  } finally {
    src.cleanup();
  }

  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({ systemRequirementsStore: store, softwareRequirementsStore: software, sprintManagement: sprint });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(!/\[object Object\]/.test(content),
      `an empty confluence scalar must never be stringified into the authoritative file, got: ${content}`);
    assertEmittedYamlIsValid(content, 'R-3 confluence rewrite');
    const again = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.strictEqual(again.spaceKey, null, 'and the rewrite is idempotent');
    assert.strictEqual(again.rootPage.title, null);
  } finally {
    cleanup();
  }
});

test('sprint_management: an empty jira_url / jira_project_key scalar coerces too', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'sprint_management:',
      '  mode: jira',
      '  jira_url:',
      '  jira_project_key:',
    ]);
    const sprint = topologyOf(resolveProjectTopology(tmpDir)).sprintManagement;
    assert.strictEqual(typeof sprint.jiraUrl, 'string',
      'jiraUrl must be a string, never {} — `{}` is truthy and so survives `raw.jira_url || ""`');
    assert.strictEqual(typeof sprint.jiraProjectKey, 'string');

    const out = withTmpDir();
    try {
      writeProjectLayoutYaml(topologyOf(resolveProjectTopology(tmpDir)));
      const content = fs.readFileSync(layoutPathOf(out.tmpDir), 'utf-8');
      assert.ok(!/\[object Object\]/.test(content), `jira coercion leak, got: ${content}`);
    } finally {
      out.cleanup();
    }
  } finally {
    cleanup();
  }
});

test('gitUrl: an empty gitUrl scalar in remote mode never leaks an object', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: remote',
      '  path: "../kb"',
      '  gitUrl:',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: remote',
      '  path: "../kb"',
      '  gitUrl:',
      'sprint_management:',
      '  mode: remote',
      '  path: "../sprint"',
      '  gitUrl:',
    ]);
    const t = topologyOf(resolveProjectTopology(tmpDir));
    for (const [label, entry] of [
      ['system store', t.systemRequirementsStore],
      ['software store', t.softwareRequirementsStore],
      ['sprint management', t.sprintManagement],
    ]) {
      assert.ok(!('gitUrl' in entry) || typeof entry.gitUrl === 'string',
        `${label}: an empty gitUrl scalar must be dropped, never carried as {}`);
    }
    const out = withTmpDir();
    try {
      writeProjectLayoutYaml(t);
      const content = fs.readFileSync(layoutPathOf(out.tmpDir), 'utf-8');
      assert.ok(!/\[object Object\]/.test(content), `gitUrl coercion leak, got: ${content}`);
      assertEmittedYamlIsValid(content, 'R-3 gitUrl');
    } finally {
      out.cleanup();
    }
  } finally {
    cleanup();
  }
});

test('a real gitUrl is still preserved in remote mode (the coercion must not over-reach)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: remote',
      '  path: "../kb"',
      '  gitUrl: "https://git.example.com/kb.git"',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'sprint_management:',
      '  mode: remote',
      '  path: "../sprint"',
      '  gitUrl: "https://git.example.com/sprint.git"',
    ]);
    const t = topologyOf(resolveProjectTopology(tmpDir));
    assert.strictEqual(t.systemRequirementsStore.gitUrl, 'https://git.example.com/kb.git');
    assert.strictEqual(t.sprintManagement.gitUrl, 'https://git.example.com/sprint.git');
  } finally {
    cleanup();
  }
});

test('an empty-value path/mode scalar does not throw a TypeError out of the resolver', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode:',
      '  path:',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    let threw = null, result = null;
    try { result = resolveProjectTopology(tmpDir); } catch (e) { threw = e; }
    assert.strictEqual(threw, null, 'must not throw at all, TypeError least of all');
    const store = topologyOf(result).systemRequirementsStore;
    assert.strictEqual(typeof store.path, 'string', 'path must resolve to a string');
    assert.strictEqual(store.mode, 'same', 'an empty mode scalar defaults to `same`');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-4 — reader and writer agree on the legal value set. A path character that
//       is legal on disk must not read back fine and then crash the next write.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-4 — reader and writer agree; a legal path never crashes the rewrite');

test('U+2028 / U+2029 / U+0085 in a path: writes, reads back intact, rewrites without throwing', () => {
  for (const [name, cp] of [['U+2028', 0x2028], ['U+2029', 0x2029], ['U+0085', 0x85]]) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      // All three are legal in a directory name on Linux AND Windows, and were
      // writable by a pre-31.2 ma-agents. The first fix round made them read
      // back intact and then throw out of the unconditional rewrite at the
      // install call site, printing a stack trace AFTER the install completed.
      const target = path.join(tmpDir, 'sub' + C(cp) + 'dir');
      writeProjectLayoutYaml({
        knowledgebase: { mode: 'local', path: target },
        sprintManagement: { mode: 'same', path: '.' },
      });
      const first = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
      assertEmittedYamlIsValid(first, `R-4 [${name}] first write`);

      const t = topologyOf(resolveProjectTopology(tmpDir));
      assert.ok(t.systemRequirementsStore.path.indexOf(C(cp)) !== -1,
        `R-4 [${name}]: the character must read back intact`);

      let threw = null;
      try { writeProjectLayoutYaml(t); } catch (e) { threw = e; }
      assert.strictEqual(threw, null,
        `R-4 [${name}]: the rewrite must NOT throw — this is the crash the first fix round introduced` +
        (threw ? `; got: ${threw.message}` : ''));

      const second = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
      assert.strictEqual(second, first,
        `R-4 [${name}]: read-then-write must be idempotent, or the binding drifts on every install`);
    } finally {
      cleanup();
    }
  }
});

test('every escape the writer emits is decoded by the reader (round-trip closure)', () => {
  // Mutation target: remove yamlUnescapeDoubleQuoted's \uXXXX handling and this
  // fails, because the value reads back as literal backslash-u text.
  for (const cp of [0, 1, 9, 10, 11, 12, 13, 27, 0x7f, 0x85, 0xa0, 0x2028, 0x2029, 0xfeff]) {
    const v = 'a' + C(cp) + 'b';
    const encoded = yamlEscapeValue(v);
    const parsed = parseLayoutYaml('k: ' + encoded).k;
    assert.strictEqual(parsed, v,
      `reader/writer disagree on U+${cp.toString(16)}: emitted ${JSON.stringify(encoded)}, read back ${JSON.stringify(parsed)}`);
    if (yamlOracle) {
      assert.strictEqual(yamlOracle.load('k: ' + encoded).k, v, `js-yaml disagrees on U+${cp.toString(16)}`);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-5 — an empty `backend:` scalar coerces, exactly as `path:` does.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-5 — an empty backend scalar coerces rather than throwing "{}"');

test('an empty backend: scalar defaults to file-system, with no throw', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend:',
      '  mode: same',
      '  path: "."',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const result = resolveProjectTopology(tmpDir);
    assert.ok(result.ok,
      `an empty backend scalar is a malformed scalar (coerce, per the contract), not an unknown ` +
      `backend (throw). Got ${result.reason}: ${result.message}`);
    assert.strictEqual(result.topology.systemRequirementsStore.backend, 'file-system');
  } finally {
    cleanup();
  }
});

test('a genuinely unknown backend STRING still fails loud, and no message renders "{}"', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: sharepoint',
      '  site_url: "https://sp.example.com/sites/eng"',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, BINDING_INVALID);
    assert.ok(/sharepoint/.test(result.message), 'the message must name the offending value');
    assert.ok(!/\{\}/.test(result.message), 'no message may render an object as "{}"');
  } finally {
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// R-6 — no fabricated citations.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nR-6 — every planning-document citation in cli.js resolves');

test('cli.js cites no `NB-` identifier (no such identifier exists in _bmad-output/)', () => {
  const cliSource = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
  const hits = cliSource.match(/NB-\d+/g) || [];
  assert.deepStrictEqual(hits, [],
    `cli.js cites ${hits.join(', ')} as authority, but no NB- identifier exists anywhere in _bmad-output/`);
});

test('every `implementation-readiness-f26.md <ID>` citation in cli.js exists in that document', () => {
  const cliSource = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
  const readinessPath = path.join(__dirname, '..', '_bmad-output', 'planning-artifacts', 'implementation-readiness-f26.md');
  const cited = [];
  const re = /implementation-readiness-f26\.md(?:\s+finding)?\s+([A-Z]{1,3}-\d+)/g;
  let m;
  while ((m = re.exec(cliSource)) !== null) cited.push(m[1]);

  if (!fs.existsSync(readinessPath)) {
    // The planning artifact is not present in a published npm tarball; in that
    // case only assert we are not citing the known-fabricated family.
    assert.ok(!cited.some(id => id.startsWith('NB-')), 'no NB- citation');
    return;
  }
  const readiness = fs.readFileSync(readinessPath, 'utf-8');
  for (const id of cited) {
    assert.ok(readiness.includes(id),
      `cli.js cites implementation-readiness-f26.md ${id}, but that identifier does not appear in the document`);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// B-2 policy guard — line breaks in confluence HUMAN IDENTITY fields are
// rejected at the serializer boundary, with a message naming the right file.
// The assertions are UNCONDITIONAL: the first round nested them inside
// `if (fs.existsSync(f))`, so in the passing case they never ran at all.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nB-2 — line breaks in confluence identity fields are rejected, naming the right file');

for (const [label, cp] of [['LF', 10], ['CR', 13], ['U+0085', 0x85], ['U+2028', 0x2028], ['U+2029', 0x2029]]) {
  test(`B-2: a ${label} in spaceKey is rejected, names project-layout.yaml, and injects nothing`, () => {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      let err = null;
      try {
        writeProjectLayoutYaml({
          systemRequirementsStore: {
            backend: 'confluence',
            spaceKey: 'ENG' + Q + C(cp) + '  api_token: ' + Q + 'sk-INJECTED-SECRET',
            rootPage: { title: 'T', id: null },
          },
          softwareRequirementsStore: { mode: 'same', path: '.' },
          sprintManagement: { mode: 'same', path: '.' },
        });
      } catch (e) { err = e; }

      assert.ok(err, `${label} must be rejected`);
      assert.ok(/project-layout\.yaml/.test(err.message),
        `the message must name the file actually being written, got: ${err.message}`);
      assert.ok(/space_key/.test(err.message),
        `the message must name the offending field, got: ${err.message}`);

      // UNCONDITIONAL — existence is read, not branched on.
      const f = layoutPathOf(tmpDir);
      const body = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '';
      assert.ok(!/api_token/.test(body), 'no injected api_token key may reach the file');
      assert.ok(!/INJECTED/.test(body), 'no injected value may reach the file');
      assert.ok(!/^\s*api_token:/m.test(body), 'no injected key at any indentation');
    } finally { cleanup(); }
  });
}

test('B-2: a rootPage.title line break is rejected and names root_page.title', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    let err = null;
    try {
      writeProjectLayoutYaml({
        systemRequirementsStore: {
          backend: 'confluence',
          spaceKey: 'ENG',
          rootPage: { title: 'T' + Q + C(10) + '  password: ' + Q + 'hunter2', id: 'keep-me' },
        },
        softwareRequirementsStore: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      });
    } catch (e) { err = e; }
    assert.ok(err, 'a line break in rootPage.title must be rejected');
    assert.ok(/root_page\.title/.test(err.message), `must name the field, got: ${err.message}`);
    assert.ok(/project-layout\.yaml/.test(err.message), `must name the file, got: ${err.message}`);

    const f = layoutPathOf(tmpDir);
    const body = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '';
    assert.ok(!/password/.test(body), 'no injected password key may reach the file');
    assert.ok(!/hunter2/.test(body), 'no injected value may reach the file');
  } finally { cleanup(); }
});

test('B-2: legitimate values containing spaces are still written normally', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(tmpDir, 'Program Files', 'kb') },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const body = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(/Program Files/.test(body), 'a space-containing path must not trip the guard');
    assertEmittedYamlIsValid(body, 'B-2 spaces');
  } finally { cleanup(); }
});

test('B-2: the guard is scoped to confluence identity — a path line break is escaped, not rejected', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // The R-4 boundary restated from the policy side: rejecting here would
    // reintroduce the post-install crash for a legal directory name.
    let threw = null;
    try {
      writeProjectLayoutYaml({
        knowledgebase: { mode: 'local', path: path.join(tmpDir, 'weird' + C(0x2028) + 'dir') },
        sprintManagement: { mode: 'same', path: '.' },
      });
    } catch (e) { threw = e; }
    assert.strictEqual(threw, null, 'a path is escaped, never rejected');
    assertEmittedYamlIsValid(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'), 'B-2 path scope');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// Warn-and-continue on an unwritable target. AC2 makes this function run on
// EVERY project install, in Step 3.6 — AFTER the BMAD install has completed —
// so an unhandled throw here would abort a substantially-finished install.
// Both branches had ZERO coverage. Both failures below are injected through real
// filesystem conditions that Windows genuinely enforces (verified in this
// environment: mkdirSync over a file gives EEXIST; writeFileSync to a 0444 file
// gives EPERM), so neither test is skipped on any platform.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nwarn-and-continue — an unwritable target leaves the project UNBOUND, never crashes');

test('an unwritable _bmad-output/ warns, says UNBOUND, and does not throw', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // `_bmad-output` exists as a FILE, so mkdirSync(recursive) fails EEXIST.
    fs.writeFileSync(path.join(tmpDir, '_bmad-output'), 'not a directory', 'utf-8');

    let threw = null, output = '';
    try {
      output = capture(() => writeProjectLayoutYaml({
        knowledgebase: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      }));
    } catch (e) { threw = e; }

    assert.strictEqual(threw, null,
      'a throw here reaches main().catch and prints a stack trace after the install has completed');
    assert.ok(/Warning/.test(output), `the failure must be reported, got: ${output}`);
    assert.ok(/UNBOUND/.test(output),
      `the user must be told the project is UNBOUND, got: ${output}`);
    assert.ok(/ma-agents bind/.test(output), `the message must name the recovery command, got: ${output}`);
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, '_bmad-output'), 'utf-8'), 'not a directory',
      'the blocking file must be left untouched');
  } finally {
    cleanup();
  }
});

test('an unwritable project-layout.yaml warns, says UNBOUND, and leaves the old bytes intact', () => {
  const { tmpDir, cleanup } = withTmpDir();
  const f = layoutPathOf(tmpDir);
  try {
    // A VALID existing binding, so the R-2 non-destruction guard permits the
    // write and execution reaches writeFileSync — then made read-only.
    const before = writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: file-system',
      '  mode: local',
      '  path: "../kb"',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: local',
      '  path: "../kb"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ]);
    fs.chmodSync(f, 0o444);

    let threw = null, output = '';
    try {
      output = capture(() => writeProjectLayoutYaml({
        knowledgebase: { mode: 'same', path: '.' },
        sprintManagement: { mode: 'same', path: '.' },
      }));
    } catch (e) { threw = e; }

    assert.strictEqual(threw, null, 'an EPERM/EACCES write must be non-fatal');
    assert.ok(/Warning/.test(output), `the failure must be reported, got: ${output}`);
    assert.ok(/UNBOUND/.test(output), `the user must be told the project is UNBOUND, got: ${output}`);
    assert.strictEqual(fs.readFileSync(f, 'utf-8'), before,
      'a failed write must not truncate or partially overwrite the authoritative record');
  } finally {
    try { fs.chmodSync(f, 0o666); } catch (e) { /* already gone */ }
    cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// Reader fidelity. Replaces the previous CRLF test, which was VACUOUS:
// parseLayoutYaml calls rawLine.trim(), which strips a trailing \r regardless,
// so that test passed identically with the `\r?` removed from the split regex.
// The channels below are ones trim() cannot launder.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nreader fidelity — channels that trim() cannot launder');

test('whitespace INSIDE a quoted value survives the reader exactly', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // trim() runs on the whole line and again on the raw value slice. Only the
    // quote-aware slicing protects interior whitespace, so this pins that
    // slicing rather than the line-ending handling trim() makes unobservable.
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key: "ENG   "',
      '  root_page:',
      '    title: "   Padded Title   "',
      '    id: " 42 "',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.strictEqual(store.spaceKey, 'ENG   ', 'trailing whitespace inside quotes must survive');
    assert.strictEqual(store.rootPage.title, '   Padded Title   ', 'leading AND trailing whitespace must survive');
    assert.strictEqual(store.rootPage.id, ' 42 ');
    if (yamlOracle) {
      const doc = yamlOracle.load(fs.readFileSync(layoutPathOf(tmpDir), 'utf-8'));
      assert.strictEqual(doc.system_requirements_store.space_key, 'ENG   ',
        'a real parser must agree about the interior whitespace');
    }
  } finally {
    cleanup();
  }
});

test('an ENCODED CR in a value is decoded as data, not confused with a line ending', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // The channel trim() cannot launder: a CR that arrives as an escape sequence
    // inside the scalar. A reader that only decodes \" and \\ (the first round's)
    // returns the literal six-character text instead.
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key: ' + Q + 'ENG' + BS + 'u000dX' + Q,
      '  root_page:',
      '    title: ' + Q + 'a' + BS + 'u2028b' + Q,
      '    id: null',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.strictEqual(store.spaceKey, 'ENG' + C(13) + 'X',
      'an escaped CR must decode to a CR character, not to literal backslash-u-000d text');
    assert.strictEqual(store.rootPage.title, 'a' + C(0x2028) + 'b',
      'an escaped U+2028 must decode to the character');
  } finally {
    cleanup();
  }
});

test('a RAW U+2028 inside a quoted value is still recognised as quoted', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // A hand-edited (or real-YAML-emitter-written) file may carry a raw
    // U+2028/U+2029/CR/LF inside a double-quoted scalar. `content.split(/\r?\n/)`
    // does not split on U+2028, so the whole scalar stays on one line — but a
    // quote test written as /^".*"$/ does not match, because `.` excludes the
    // JS line terminators. The value then keeps its surrounding quote
    // characters as DATA, which is how a legitimate directory name came to be
    // read back as '"sub<U+2028>dir"' quotes included.
    writeLayoutFixture(tmpDir, [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key: ' + Q + 'a' + C(0x2028) + 'b' + Q,
      '  root_page:',
      '    title: ' + Q + 'c' + C(0x2029) + 'd' + Q,
      '    id: null',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
    ]);
    const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.strictEqual(store.spaceKey, 'a' + C(0x2028) + 'b',
      'the surrounding quotes must be stripped, not carried into the value');
    assert.strictEqual(store.rootPage.title, 'c' + C(0x2029) + 'd',
      'same for U+2029');
    assert.ok(store.spaceKey.indexOf(Q) === -1, 'no quote character may survive as data');
  } finally {
    cleanup();
  }
});

test('a CRLF-encoded file resolves identically to the LF-encoded same file', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // NOTE on what this can and cannot prove: because parseLayoutYaml calls
    // rawLine.trim(), the `\r?` in its split regex is redundant, and NO
    // assertion reachable through this reader can distinguish the two forms.
    // This test therefore pins the FILE-LEVEL invariant that actually matters on
    // Windows — a CRLF checkout of the committed binding resolves to the same
    // topology, values with escapes included — rather than pretending to pin the
    // split regex. The escape-decoding test above is the real mutation target.
    const body = [
      'schema_version: 2',
      'system_requirements_store:',
      '  backend: confluence',
      '  space_key: "ENG   "',
      '  root_page:',
      '    title: ' + Q + 'a' + BS + 'u000db' + Q,
      '    id: null',
      'software_requirements_store:',
      '  backend: file-system',
      '  mode: same',
      '  path: "."',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ];
    const roots = {};
    for (const [name, eol] of [['lf', '\n'], ['crlf', '\r\n']]) {
      const root = path.join(tmpDir, name);
      fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
      fs.writeFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), body.join(eol), 'utf-8');
      roots[name] = root;
    }
    const lf = topologyOf(resolveProjectTopology(roots.lf));
    const crlf = topologyOf(resolveProjectTopology(roots.crlf));
    assert.deepStrictEqual(crlf, lf,
      'a CRLF checkout must resolve to a topology deep-equal to the LF one — this repo has documented Windows CRLF pain');
    assert.strictEqual(crlf.systemRequirementsStore.spaceKey, 'ENG   ');
    assert.strictEqual(crlf.systemRequirementsStore.rootPage.title, 'a' + C(13) + 'b');
  } finally { cleanup(); }
});

// ══════════════════════════════════════════════════════════════════════════
// Non-ASCII identity must be ACCEPTED. A guard that rejected any non-ASCII
// character would satisfy every injection test above and go completely
// uncaught — Confluence space names and page titles are routinely non-Latin.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nnon-ASCII identity is accepted (an over-broad guard would be caught here)');

test('Hebrew, Arabic, CJK and emoji space keys / page titles are written and read back intact', () => {
  const samples = [
    ['Hebrew', 'הנדסה', 'מסמכי הצוות'],
    ['Arabic', 'الهندسة', 'واجهة المشروع'],
    ['CJK', '工程部', '项目文档'],
    ['emoji + accents', 'ÉNG-Ünïcødé', 'Team Docs 🚀 — v2'],
  ];
  for (const [label, spaceKey, title] of samples) {
    const { tmpDir, cleanup } = withTmpDir();
    try {
      let threw = null;
      try {
        writeProjectLayoutYaml({
          systemRequirementsStore: { backend: 'confluence', spaceKey, rootPage: { title, id: null } },
          softwareRequirementsStore: { mode: 'same', path: '.' },
          sprintManagement: { mode: 'same', path: '.' },
        });
      } catch (e) { threw = e; }
      assert.strictEqual(threw, null,
        `${label}: non-ASCII identity must be ACCEPTED — got: ${threw && threw.message}`);

      const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
      assert.ok(content.includes(spaceKey),
        `${label}: the space key must be written as literal UTF-8, not escaped away`);
      assert.ok(content.includes(title), `${label}: the title must be written as literal UTF-8`);

      const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
      assert.strictEqual(store.spaceKey, spaceKey, `${label}: space key must read back intact`);
      assert.strictEqual(store.rootPage.title, title, `${label}: title must read back intact`);

      const doc = assertEmittedYamlIsValid(content, `non-ASCII [${label}]`);
      if (doc) {
        assert.strictEqual(doc.system_requirements_store.space_key, spaceKey);
        assert.strictEqual(doc.system_requirements_store.root_page.title, title);
      }
    } finally {
      cleanup();
    }
  }
});

test('a non-ASCII PATH is accepted and stays portable', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(tmpDir, 'תיקיית-ידע') },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const content = fs.readFileSync(layoutPathOf(tmpDir), 'utf-8');
    assert.ok(content.includes('תיקיית-ידע'), 'a non-ASCII path must be written literally');
    const store = topologyOf(resolveProjectTopology(tmpDir)).systemRequirementsStore;
    assert.ok(store.path.includes('תיקיית-ידע'), 'and read back intact');
    assertEmittedYamlIsValid(content, 'non-ASCII path');
  } finally {
    cleanup();
  }
});

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (!yamlOracle) {
  console.log('  NOTE: js-yaml did not resolve — oracle assertions degraded to explicit escaping checks.');
}
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}

if (failed > 0) process.exit(1);
