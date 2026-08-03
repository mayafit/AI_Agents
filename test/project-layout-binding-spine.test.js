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
let writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology, PROJECT_LAYOUT_SCHEMA_VERSION;
try {
  ({ writeProjectLayoutYaml, readExistingLayout, resolveProjectTopology, PROJECT_LAYOUT_SCHEMA_VERSION } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
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
    // sprint_management is NOT one of the two backend-typed stores (P5-9.5)
    const sprintSection = content.split('sprint_management:')[1] || '';
    assert.ok(!sprintSection.includes('backend:'), 'sprint_management has no backend field');
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

test('resolveProjectTopology returns null when only config.yaml exists (no fallback)', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), 'knowledgebase_path: "/somewhere/else"\nsprint_management_path: "."\n');
    const result = resolveProjectTopology(tmpDir);
    assert.strictEqual(result, null, 'resolver must not fall back to config.yaml — that is readExistingLayout()\'s install-time convenience only');
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
    const legacyContent = [
      '# Generated by ma-agents — do not edit manually',
      'generated: "2026-03-26"',
      'knowledgebase:',
      '  mode: local',
      '  path: "/legacy/kb"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ].join('\n');
    fs.mkdirSync(path.join(tmpDir, '_bmad-output'), { recursive: true });
    fs.writeFileSync(layoutPathOf(tmpDir), legacyContent, 'utf-8');

    const topology = resolveProjectTopology(tmpDir);
    assert.ok(topology, 'legacy file must resolve without error');
    assert.strictEqual(topology.schemaVersion, 1);
    assert.strictEqual(topology.systemRequirementsStore.path, '/legacy/kb');
    assert.strictEqual(topology.softwareRequirementsStore.path, '/legacy/kb');
    assert.strictEqual(topology.systemRequirementsStore.backend, 'file-system');
    assert.strictEqual(topology.softwareRequirementsStore.backend, 'file-system');
    assert.strictEqual(topology.sprintManagement.path, '.');

    // No rewrite: the file on disk is untouched by a read.
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
        // The following are exactly the shape of fields that must NEVER appear
        // in the committed file — attached here to prove the writer ignores them.
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

    const topology = resolveProjectTopology(tmpDir);
    assert.strictEqual(topology.systemRequirementsStore.rootPage.title, 'My Project');
    assert.strictEqual(topology.systemRequirementsStore.rootPage.id, null);
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
    // Simulate a globally-installed skill's view: only the committed
    // _bmad-output/project-layout.yaml exists. No _bmad/ directory anywhere —
    // not even created — proving no per-machine install state is consulted.
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad')), 'sanity: _bmad/ must not exist for this test');

    writeProjectLayoutYaml({
      knowledgebase: { mode: 'remote', path: path.join(path.dirname(tmpDir), 'global-kb'), gitUrl: 'https://git.example.com/kb.git' },
      sprintManagement: { mode: 'local', path: path.join(path.dirname(tmpDir), 'global-sprint') },
    });

    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad')), '_bmad/ must still not exist — writing the layout creates no per-machine state');

    const topology = resolveProjectTopology(tmpDir);
    assert.ok(topology, 'resolver must succeed with _bmad/ absent');
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

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
