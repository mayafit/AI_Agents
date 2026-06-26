#!/usr/bin/env node
/**
 * Story 7.2 — Unit tests for lib/installer.js core operations.
 *
 * lib/installer.js previously had NO dedicated test file. This covers the
 * pure/listing helpers and the manifest read/write/ensure lifecycle, plus the
 * skills-manifest generator — all grounded in the actual exported signatures.
 *
 * Coverage:
 *   7.2.1  listSkills returns a non-empty array of well-formed entries
 *   7.2.2  listAgents matches getAllAgents() (same set + length)
 *   7.2.3  compareSemver convention (returns 1 / -1 / 0)
 *   7.2.4  readManifest returns null for a non-existent manifest
 *   7.2.5  readManifest parses a written .ma-agents.json (round-trip)
 *   7.2.6  ensureManifest create-branch (in-memory shape; no file written)
 *   7.2.7  ensureManifest migrate-branch adds a new agent to existing manifest
 *   7.2.8  getManifestAgents reads agents/agent/null per real signature
 *   7.2.9  getInstalledSkillInfo returns null for a non-installed skill
 *   7.2.10 getInstalledSkillInfo returns the skill record when present
 *   7.2.11 generateSkillsManifest writes MANIFEST.yaml with skill metadata
 *   7.2.12 generateSkillsManifest is a no-op when manifest has no skills
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const installer = require('../lib/installer');
const {
  listSkills,
  listAgents,
  readManifest,
  ensureManifest,
  getManifestAgents,
  getInstalledSkillInfo,
  generateSkillsManifest,
  compareSemver,
} = installer;
const { getAllAgents } = require('../lib/agents');

const MANIFEST_FILE = '.ma-agents.json';

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-installer-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// writeManifest is intentionally NOT exported by lib/installer.js, so tests
// seed the on-disk manifest directly. readManifest just JSON.parses
// <dir>/.ma-agents.json, so a plain file write is a faithful fixture.
function seedManifest(dir, manifest) {
  fs.writeFileSync(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

console.log('\n installer unit tests\n');

async function runAll() {
  // 7.2.1 — listSkills returns a non-empty array; every entry has the fields
  // the real code produces (id from dir name + name/version/description from
  // skill.json — all three of those are universal across the skills tree).
  await test('7.2.1 listSkills returns a non-empty array of well-formed skill entries', () => {
    const skills = listSkills();
    assert.ok(Array.isArray(skills), 'listSkills must return an array');
    assert.ok(skills.length > 0, 'listSkills must return a non-empty array');
    for (const s of skills) {
      assert.ok(s && typeof s === 'object', 'each entry is an object');
      assert.strictEqual(typeof s.id, 'string', `entry must have a string id (got ${JSON.stringify(s)})`);
      assert.ok(s.id.length > 0, 'id must be non-empty');
      assert.strictEqual(typeof s.name, 'string', `entry ${s.id} must have a string name`);
      assert.strictEqual(typeof s.version, 'string', `entry ${s.id} must have a string version`);
      assert.strictEqual(typeof s.description, 'string', `entry ${s.id} must have a string description`);
    }
  });

  // 7.2.2 — listAgents is a passthrough of getAllAgents(): same set + length.
  await test('7.2.2 listAgents matches getAllAgents() (same set and length)', () => {
    const viaInstaller = listAgents();
    const viaAgents = getAllAgents();
    assert.ok(Array.isArray(viaInstaller), 'listAgents must return an array');
    assert.strictEqual(viaInstaller.length, viaAgents.length, 'same length as getAllAgents()');
    const idsA = viaInstaller.map(a => a.id).sort();
    const idsB = viaAgents.map(a => a.id).sort();
    assert.deepStrictEqual(idsA, idsB, 'same set of agent ids as getAllAgents()');
  });

  // 7.2.3 — compareSemver convention: equal→0, a<b→-1, a>b→1.
  await test('7.2.3 compareSemver returns 0 / -1 / 1 per standard ordering', () => {
    assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0, 'equal versions → 0');
    assert.strictEqual(compareSemver('1.0.0', '2.0.0'), -1, 'a < b → -1');
    assert.strictEqual(compareSemver('2.0.0', '1.0.0'), 1, 'a > b → 1');
    assert.strictEqual(compareSemver('1.0.1', '1.0.0'), 1, 'patch greater → 1');
    assert.strictEqual(compareSemver('1.1.0', '1.0.9'), 1, 'minor outranks patch → 1');
    // Missing operands default to '0.0.0'.
    assert.strictEqual(compareSemver(undefined, undefined), 0, 'both missing → 0');
    assert.strictEqual(compareSemver('1.0.0', undefined), 1, 'b missing defaults to 0.0.0 → 1');
  });

  // 7.2.3b — CHARACTERIZATION of compareSemver's handling of non-canonical input.
  // These pin the CURRENT (intentionally simple) behavior so any future change is
  // visible in the diff. compareSemver only parses 3 numeric segments and ignores
  // prerelease tags — it is NOT a full semver comparator. A short version ('1.0')
  // has a NaN patch segment, and NaN comparisons fall through to 0 (treated equal),
  // and prerelease suffixes are stripped to their numeric major.minor.patch.
  await test('7.2.3b compareSemver characterization: short/prerelease inputs (current behavior)', () => {
    assert.strictEqual(compareSemver('1.0', '1.0.0'), 0, "short '1.0' compares equal to '1.0.0' (NaN patch → falls through to 0)");
    assert.strictEqual(compareSemver('1.0.0-rc', '1.0.0'), 0, "prerelease tag is ignored ('1.0.0-rc' == '1.0.0')");
  });

  // 7.2.4 — readManifest returns null (NOT an empty/default object) when the
  // manifest file does not exist.
  await test('7.2.4 readManifest returns null for a non-existent manifest', () => {
    const dir = mktemp();
    try {
      assert.strictEqual(readManifest(dir), null);
    } finally { cleanup(dir); }
  });

  // 7.2.5 — readManifest faithfully parses a written .ma-agents.json.
  // (writeManifest is not part of the public surface; the manifest is seeded
  // on disk and read back via the exported readManifest.)
  await test('7.2.5 readManifest parses a written .ma-agents.json (round-trip)', () => {
    const dir = mktemp();
    try {
      const original = {
        manifestVersion: '1.2.0',
        agent: 'claude-code',
        agents: ['claude-code', 'roo-code'],
        scope: 'project',
        skills: { 'add-sprint': { version: '1.0.0', installedAt: '2026-01-01T00:00:00Z' } },
      };
      seedManifest(dir, original);
      const back = readManifest(dir);
      assert.ok(back, 'readManifest must return the parsed manifest');
      assert.deepStrictEqual(back, original, 'round-trip preserves the full manifest');
      // Corrupt JSON is swallowed and surfaces as null (real catch behavior).
      fs.writeFileSync(path.join(dir, MANIFEST_FILE), '{ not valid json', 'utf-8');
      assert.strictEqual(readManifest(dir), null, 'malformed manifest → null');
    } finally { cleanup(dir); }
  });

  // 7.2.6 — ensureManifest create-branch builds an in-memory manifest and does
  // NOT write a file (the caller persists via writeManifest).
  await test('7.2.6 ensureManifest create-branch returns in-memory shape and writes no file', () => {
    const dir = mktemp();
    try {
      const m = ensureManifest(dir, 'claude-code', 'project');
      assert.strictEqual(m.agent, 'claude-code');
      assert.deepStrictEqual(m.agents, ['claude-code']);
      assert.strictEqual(m.scope, 'project');
      assert.deepStrictEqual(m.skills, {});
      assert.strictEqual(typeof m.manifestVersion, 'string');
      assert.ok(!fs.existsSync(path.join(dir, MANIFEST_FILE)), 'ensureManifest must not write a file');
      // null agentId yields an empty agents array (bug 27.9 guard).
      const dir2 = mktemp();
      try {
        const m2 = ensureManifest(dir2, null, 'project');
        assert.deepStrictEqual(m2.agents, []);
        assert.strictEqual(m2.agent, null);
      } finally { cleanup(dir2); }
    } finally { cleanup(dir); }
  });

  // 7.2.7 — ensureManifest migrate-branch: an existing manifest gains a new
  // agent without losing the prior one; agent stays the first entry.
  await test('7.2.7 ensureManifest migrate-branch appends a new agent to an existing manifest', () => {
    const dir = mktemp();
    try {
      seedManifest(dir, {
        manifestVersion: '1.2.0',
        agent: 'claude-code',
        agents: ['claude-code'],
        scope: 'project',
        skills: {},
      });
      const m = ensureManifest(dir, 'roo-code', 'project');
      assert.deepStrictEqual(m.agents, ['claude-code', 'roo-code'], 'new agent appended');
      assert.strictEqual(m.agent, 'claude-code', 'agent stays first entry');
      // Idempotent: re-ensuring an already-present agent does not duplicate.
      const m2 = ensureManifest(dir, 'claude-code', 'project');
      assert.deepStrictEqual(m2.agents, ['claude-code'], 'no duplicate for already-present agent');
    } finally { cleanup(dir); }
  });

  // 7.2.8 — getManifestAgents per real signature: agents array wins; falls back
  // to [agent]; null/empty → [].
  await test('7.2.8 getManifestAgents returns agents/agent/[] per real signature', () => {
    assert.deepStrictEqual(getManifestAgents(null), [], 'null manifest → []');
    assert.deepStrictEqual(
      getManifestAgents({ agents: ['a', 'b'] }), ['a', 'b'], 'agents array is returned as-is');
    assert.deepStrictEqual(
      getManifestAgents({ agent: 'solo' }), ['solo'], 'falls back to [agent] when no agents array');
    assert.deepStrictEqual(getManifestAgents({}), [], 'empty manifest → []');
  });

  // 7.2.9 — getInstalledSkillInfo returns null for a non-installed skill
  // (both when no manifest exists and when the manifest lacks the skill).
  await test('7.2.9 getInstalledSkillInfo returns null for a non-installed skill', () => {
    const dir = mktemp();
    try {
      // No manifest at all.
      assert.strictEqual(getInstalledSkillInfo(dir, 'add-sprint'), null);
      // Manifest exists but does not list the skill.
      seedManifest(dir, {
        manifestVersion: '1.2.0',
        agent: 'claude-code',
        agents: ['claude-code'],
        scope: 'project',
        skills: { 'other-skill': { version: '1.0.0' } },
      });
      assert.strictEqual(getInstalledSkillInfo(dir, 'add-sprint'), null);
    } finally { cleanup(dir); }
  });

  // 7.2.10 — getInstalledSkillInfo returns the recorded skill object when present.
  await test('7.2.10 getInstalledSkillInfo returns the skill record when installed', () => {
    const dir = mktemp();
    try {
      const record = { version: '1.0.0', installedAt: '2026-01-01T00:00:00Z' };
      seedManifest(dir, {
        manifestVersion: '1.2.0',
        agent: 'claude-code',
        agents: ['claude-code'],
        scope: 'project',
        skills: { 'add-sprint': record },
      });
      assert.deepStrictEqual(getInstalledSkillInfo(dir, 'add-sprint'), record);
    } finally { cleanup(dir); }
  });

  // 7.2.11 — generateSkillsManifest writes MANIFEST.yaml whose content includes
  // metadata for the skills listed in the manifest. It pulls metadata from
  // listSkills() and only emits entries whose id appears in manifest.skills.
  await test('7.2.11 generateSkillsManifest writes MANIFEST.yaml with skill metadata', async () => {
    const dir = mktemp();
    try {
      // Pick a real skill id so listSkills() has metadata to emit.
      const realSkill = listSkills()[0];
      assert.ok(realSkill && realSkill.id, 'need at least one real skill for the fixture');
      seedManifest(dir, {
        manifestVersion: '1.2.0',
        agent: 'claude-code',
        agents: ['claude-code'],
        scope: 'project',
        skills: { [realSkill.id]: { version: realSkill.version } },
      });
      await generateSkillsManifest(dir);
      const yamlPath = path.join(dir, 'MANIFEST.yaml');
      assert.ok(fs.existsSync(yamlPath), 'generateSkillsManifest must write MANIFEST.yaml');
      const content = fs.readFileSync(yamlPath, 'utf-8');
      assert.ok(content.includes('skills:'), 'YAML has a skills section');
      assert.ok(content.includes(`- id: ${realSkill.id}`), 'YAML lists the installed skill id');
      assert.ok(content.includes(`${realSkill.id}/SKILL.md`), 'YAML references the skill SKILL.md path');
      assert.ok(content.includes(realSkill.description), 'YAML includes the skill description');
    } finally { cleanup(dir); }
  });

  // 7.2.12 — generateSkillsManifest is a no-op when the manifest has no skills
  // map (returns early without writing MANIFEST.yaml).
  await test('7.2.12 generateSkillsManifest writes nothing when manifest has no skills', async () => {
    const dir = mktemp();
    try {
      // No manifest at all → early return, no file.
      await generateSkillsManifest(dir);
      assert.ok(!fs.existsSync(path.join(dir, 'MANIFEST.yaml')), 'no manifest → no MANIFEST.yaml');
    } finally { cleanup(dir); }
  });

  // 7.2.13 — performInstall injects a SPEC-COMPLIANT frontmatter `name:` that
  // matches the skill's directory id (kebab-case), NOT the human-readable
  // display name from skill.json. Strict validators (e.g. cline) reject a
  // SKILL.md whose frontmatter name differs from its folder, so the injected
  // name must equal skillId. Regression guard for the "Git Workflow" vs
  // "git-workflow-skill" mismatch bug.
  await test('7.2.13 performInstall injects frontmatter name matching the skill folder id', async () => {
    const { performInstall } = installer;
    assert.strictEqual(typeof performInstall, 'function', 'performInstall must be exported');

    // Pick a real skill whose display name differs from its id so the test
    // would catch a regression to "inject display name".
    const skill = listSkills().find(s => s.name !== s.id);
    assert.ok(skill, 'expected at least one skill whose display name differs from its id');

    const agent = getAllAgents()[0];
    const dir = mktemp();
    try {
      const ok = await performInstall(skill.id, skill, agent, dir);
      assert.strictEqual(ok, true, 'performInstall should succeed for a real skill');

      const content = fs.readFileSync(path.join(dir, skill.id, 'SKILL.md'), 'utf-8');
      const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
      assert.ok(m, 'installed SKILL.md must have a YAML frontmatter block');
      const nameLine = m[1].split('\n').find(l => l.startsWith('name:'));
      assert.ok(nameLine, 'frontmatter must contain a name field');
      const injected = nameLine.slice('name:'.length).trim();
      assert.strictEqual(injected, skill.id,
        `injected frontmatter name must equal the folder id '${skill.id}', got '${injected}'`);
    } finally { cleanup(dir); }
  });

  // ─── Report ───
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll();
