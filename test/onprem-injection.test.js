#!/usr/bin/env node
/**
 * Story 21.9 — End-to-end NFR44/NFR46/NFR47 integration tests.
 *
 * AC coverage:
 *   (a)  NFR44  — standard profile: no /no_think, str_replace_editor, ~/.claude/ anywhere
 *   (b)  NFR44  — on-prem profile: the three literals ARE present in instruction files
 *   (c)  NFR46  — two consecutive on-prem installs → byte-identical marker-block content
 *   (d)  slug-collision — bmad-dev overwritten; my-custom-mode preserved
 *   (e)  NFR47  — .roomodes fileRegex patterns enforce BMAD mode file restrictions
 *   (f)  AC #6  — profile round-trip: standard → on-prem → standard CLAUDE.md identical
 *   (g)  persona — on-prem: bmm-pm critical_actions[0] contains /no_think (applyPersonaPhasePrefix)
 *   (h)  docs   — vllm deployment doc NOT stamped into target projects
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.stack || err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ── Imports ──────────────────────────────────────────────────────────────────
const {
  _testUpdateAgentInstructions: updateAgentInstructions,
  stampExtraInstructionTemplates,
  composeInstructionBlock,
} = require('../lib/installer');
const { setProfile, getProfile } = require('../lib/profile');
const { applyPersonaPhasePrefix } = require('../lib/bmad');
const agents = require('../lib/agents');

// ── Helpers ───────────────────────────────────────────────────────────────────
function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-21-9-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/** Extract the MA-AGENTS-START…MA-AGENTS-END block (inclusive) from text. */
function extractMarkerBlock(text) {
  const start = text.indexOf('<!-- MA-AGENTS-START -->');
  const end = text.indexOf('<!-- MA-AGENTS-END -->');
  if (start < 0 || end < 0) return null;
  return text.slice(start, end + '<!-- MA-AGENTS-END -->'.length);
}

/**
 * Run a minimal install: inject claude-code instruction block + roo-code
 * (which has extraInstructionTemplates that produce .roomodes).
 * cwd is temporarily changed to projectRoot so relative-path resolution inside
 * installer helpers stays consistent with the real CLI invocation.
 */
async function runMinimalInstall(projectRoot, opts = {}) {
  const cwdOriginal = process.cwd();
  process.chdir(projectRoot);
  try {
    const claudeAgent = agents.getAgent('claude-code');
    if (claudeAgent) {
      await updateAgentInstructions(claudeAgent, projectRoot, opts);
    }
    const rooAgent = agents.getAgent('roo-code');
    if (rooAgent) {
      await updateAgentInstructions(rooAgent, projectRoot, opts);
      if (Array.isArray(rooAgent.extraInstructionTemplates) && rooAgent.extraInstructionTemplates.length > 0) {
        await stampExtraInstructionTemplates(rooAgent, projectRoot, opts);
      }
    }
  } finally {
    process.chdir(cwdOriginal);
  }
}

// ── Test cases ────────────────────────────────────────────────────────────────

console.log('\n story 21.9 — end-to-end NFR44/NFR46/NFR47 integration tests\n');

async function runAll() {
  // ── (a) Standard profile: no on-prem strings ─────────────────────────────

  await test('standard profile: generated files contain no /no_think, str_replace_editor, or ~/.claude/', async () => {
    const dir = mktemp();
    try {
      // Standard is the default — no setProfile call needed (--yes resolves to standard)
      setProfile(dir, 'standard');
      await runMinimalInstall(dir, { yesMode: true });

      const claudeMd = path.join(dir, '.claude', 'CLAUDE.md');
      assert.ok(fs.existsSync(claudeMd), 'CLAUDE.md must be created by standard install');
      const content = fs.readFileSync(claudeMd, 'utf-8');

      assert.ok(!content.includes('/no_think'), 'CLAUDE.md must not contain /no_think in standard profile (NFR44)');
      assert.ok(!content.includes('str_replace_editor'), 'CLAUDE.md must not contain str_replace_editor in standard profile (NFR44)');
      assert.ok(!content.includes('~/.claude/'), 'CLAUDE.md must not contain ~/.claude/ in standard profile (NFR44)');

      // Also check .roomodes if it was created
      const roomodes = path.join(dir, '.roomodes');
      if (fs.existsSync(roomodes)) {
        const rm = fs.readFileSync(roomodes, 'utf-8');
        assert.ok(!rm.includes('/no_think'), '.roomodes must not contain /no_think in standard profile (NFR44)');
        assert.ok(!rm.includes('str_replace_editor'), '.roomodes must not contain str_replace_editor in standard profile (NFR44)');
        assert.ok(!rm.includes('~/.claude/'), '.roomodes must not contain ~/.claude/ in standard profile (NFR44)');
      }
    } finally { cleanup(dir); }
  });

  // ── (b) On-prem profile: expected on-prem strings present ─────────────────

  await test('on-prem profile: instruction files contain on-prem guardrail strings', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      await runMinimalInstall(dir, { yesMode: true });

      const claudeMd = path.join(dir, '.claude', 'CLAUDE.md');
      assert.ok(fs.existsSync(claudeMd), 'CLAUDE.md must be created by on-prem install');
      const content = fs.readFileSync(claudeMd, 'utf-8');

      assert.ok(content.includes('/no_think'), 'CLAUDE.md must contain /no_think in on-prem profile');
      assert.ok(content.includes('str_replace_editor'), 'CLAUDE.md must contain str_replace_editor in on-prem profile');
      assert.ok(content.includes('~/.claude/'), 'CLAUDE.md must contain ~/.claude/ prohibition in on-prem profile');
    } finally { cleanup(dir); }
  });

  // ── (c) NFR46: Idempotency — two consecutive installs produce byte-identical marker blocks ──

  await test('NFR46: two consecutive installs with same profile produce byte-identical marker-block content', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      await runMinimalInstall(dir, { yesMode: true });

      const claudeMd = path.join(dir, '.claude', 'CLAUDE.md');
      assert.ok(fs.existsSync(claudeMd), 'CLAUDE.md created on first install');
      const content1 = fs.readFileSync(claudeMd, 'utf-8');
      const block1 = extractMarkerBlock(content1);
      assert.ok(block1 !== null, 'marker block must be present after first install');

      // Second install
      await runMinimalInstall(dir, { yesMode: true });
      const content2 = fs.readFileSync(claudeMd, 'utf-8');
      const block2 = extractMarkerBlock(content2);
      assert.ok(block2 !== null, 'marker block must be present after second install');

      assert.strictEqual(block2, block1, 'marker-block content must be byte-identical across two consecutive installs (NFR46)');

      // Also verify .roomodes if present
      const roomodes = path.join(dir, '.roomodes');
      if (fs.existsSync(roomodes)) {
        const rm1 = fs.readFileSync(roomodes, 'utf-8');
        await runMinimalInstall(dir, { yesMode: true });
        const rm2 = fs.readFileSync(roomodes, 'utf-8');
        assert.strictEqual(rm2, rm1, '.roomodes must be byte-identical across consecutive installs (NFR46)');
      }
    } finally { cleanup(dir); }
  });

  // ── (d) .roomodes slug-collision: ma-agents slugs overwrite; user slugs preserved ──

  await test('slug-collision: ma-agents slugs overwrite; user slugs preserved', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');

      // Seed a .roomodes with one colliding slug and one non-colliding slug
      const existingRoomodes = yaml.dump({
        customModes: [
          {
            slug: 'bmad-dev',
            name: 'User Custom Dev (should be overwritten)',
            roleDefinition: 'user-defined role for dev',
            groups: ['read']
          },
          {
            slug: 'my-custom-mode',
            name: 'My Custom Mode',
            roleDefinition: 'a project-specific mode',
            groups: ['read', 'edit']
          }
        ]
      });
      fs.writeFileSync(path.join(dir, '.roomodes'), existingRoomodes, 'utf-8');

      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        const rooAgent = agents.getAgent('roo-code');
        if (rooAgent && Array.isArray(rooAgent.extraInstructionTemplates) && rooAgent.extraInstructionTemplates.length > 0) {
          await stampExtraInstructionTemplates(rooAgent, dir);
        }
      } finally {
        process.chdir(cwdOriginal);
      }

      const merged = yaml.load(fs.readFileSync(path.join(dir, '.roomodes'), 'utf-8'));
      assert.ok(Array.isArray(merged.customModes), 'customModes must be an array');

      const devMode = merged.customModes.find(m => m.slug === 'bmad-dev');
      assert.ok(devMode, 'bmad-dev slug must be present');
      assert.notStrictEqual(
        devMode.name,
        'User Custom Dev (should be overwritten)',
        'bmad-dev must be overwritten with the ma-agents version'
      );

      const customMode = merged.customModes.find(m => m.slug === 'my-custom-mode');
      assert.ok(customMode, 'my-custom-mode slug must be preserved');
      assert.strictEqual(customMode.name, 'My Custom Mode', 'user slug name must be preserved byte-for-byte');
      assert.strictEqual(customMode.roleDefinition, 'a project-specific mode', 'user slug roleDefinition must be preserved');
    } finally { cleanup(dir); }
  });

  // ── (e) NFR47: .roomodes fileRegex matrix ─────────────────────────────────

  await test('NFR47: .roomodes fileRegex patterns enforce BMAD mode file restrictions', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');

      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        const rooAgent = agents.getAgent('roo-code');
        if (rooAgent) {
          await updateAgentInstructions(rooAgent, dir);
          if (Array.isArray(rooAgent.extraInstructionTemplates) && rooAgent.extraInstructionTemplates.length > 0) {
            await stampExtraInstructionTemplates(rooAgent, dir);
          }
        }
      } finally {
        process.chdir(cwdOriginal);
      }

      const roomodesPath = path.join(dir, '.roomodes');
      assert.ok(fs.existsSync(roomodesPath), '.roomodes must be created by roo-code install');
      const parsed = yaml.load(fs.readFileSync(roomodesPath, 'utf-8'));
      assert.ok(Array.isArray(parsed.customModes), 'customModes must be an array');

      const bySlug = Object.fromEntries(parsed.customModes.map(m => [m.slug, m]));

      /**
       * Extract the fileRegex from the 'edit' group entry if it has a config object.
       * Returns a RegExp if found, null if bare 'edit' string (unrestricted).
       */
      function getEditFileRegex(mode) {
        if (!mode || !Array.isArray(mode.groups)) return null;
        for (const g of mode.groups) {
          if (Array.isArray(g) && g[0] === 'edit' && g[1] && typeof g[1].fileRegex === 'string') {
            return new RegExp(g[1].fileRegex);
          }
        }
        return null;
      }

      // bmad-pm: accepts .md, rejects .ts / .py / .js
      const pmRegex = getEditFileRegex(bySlug['bmad-pm']);
      assert.ok(pmRegex !== null, 'bmad-pm must have a fileRegex on edit group (NFR47)');
      assert.ok(pmRegex.test('plan.md'), 'bmad-pm fileRegex must accept .md');
      assert.ok(!pmRegex.test('app.ts'), 'bmad-pm fileRegex must reject .ts');
      assert.ok(!pmRegex.test('script.py'), 'bmad-pm fileRegex must reject .py');
      assert.ok(!pmRegex.test('index.js'), 'bmad-pm fileRegex must reject .js');

      // bmad-architect: accepts .md / .xml / .drawio, rejects .ts / .py / .js
      const archRegex = getEditFileRegex(bySlug['bmad-architect']);
      assert.ok(archRegex !== null, 'bmad-architect must have a fileRegex on edit group (NFR47)');
      assert.ok(archRegex.test('arch.md'), 'bmad-architect fileRegex must accept .md');
      assert.ok(archRegex.test('diagram.drawio'), 'bmad-architect fileRegex must accept .drawio');
      assert.ok(archRegex.test('model.xml'), 'bmad-architect fileRegex must accept .xml');
      assert.ok(!archRegex.test('app.ts'), 'bmad-architect fileRegex must reject .ts');
      assert.ok(!archRegex.test('script.py'), 'bmad-architect fileRegex must reject .py');

      // bmad-techlead: accepts .md / .json / .yaml, rejects .ts / .py
      const tlRegex = getEditFileRegex(bySlug['bmad-techlead']);
      assert.ok(tlRegex !== null, 'bmad-techlead must have a fileRegex on edit group (NFR47)');
      assert.ok(tlRegex.test('notes.md'), 'bmad-techlead fileRegex must accept .md');
      assert.ok(tlRegex.test('package.json'), 'bmad-techlead fileRegex must accept .json');
      assert.ok(tlRegex.test('config.yaml'), 'bmad-techlead fileRegex must accept .yaml');
      assert.ok(!tlRegex.test('app.ts'), 'bmad-techlead fileRegex must reject .ts');
      assert.ok(!tlRegex.test('script.py'), 'bmad-techlead fileRegex must reject .py');

      // bmad-dev: no fileRegex restriction (full access — bare "edit" string in groups)
      const devRegex = getEditFileRegex(bySlug['bmad-dev']);
      assert.strictEqual(devRegex, null, 'bmad-dev must have NO fileRegex restriction (full edit access)');
      const devGroups = bySlug['bmad-dev'].groups;
      assert.ok(devGroups.includes('edit'), 'bmad-dev must have bare "edit" in groups');
    } finally { cleanup(dir); }
  });

  // ── (f) AC #6: Profile switch round-trip ─────────────────────────────────

  await test('AC #6 profile round-trip: standard → on-prem → standard produces byte-identical first and last CLAUDE.md', async () => {
    const dir = mktemp();
    try {
      // Install 1: standard profile
      setProfile(dir, 'standard');
      await runMinimalInstall(dir, { yesMode: true });
      const claudeMd = path.join(dir, '.claude', 'CLAUDE.md');
      assert.ok(fs.existsSync(claudeMd), 'CLAUDE.md must exist after first install');
      const content1 = fs.readFileSync(claudeMd, 'utf-8');

      // Install 2: switch to on-prem
      setProfile(dir, 'on-prem');
      assert.strictEqual(getProfile(dir), 'on-prem', 'profile must be persisted as on-prem');
      await runMinimalInstall(dir, { yesMode: true });
      const content2 = fs.readFileSync(claudeMd, 'utf-8');
      assert.ok(content2.includes('/no_think'), 'on-prem install must stamp /no_think into CLAUDE.md');

      // Install 3: switch back to standard
      setProfile(dir, 'standard');
      assert.strictEqual(getProfile(dir), 'standard', 'profile must be restored to standard');
      await runMinimalInstall(dir, { yesMode: true });
      const content3 = fs.readFileSync(claudeMd, 'utf-8');

      // Install 1 and Install 3 must be byte-identical
      assert.strictEqual(
        content3,
        content1,
        'standard reinstall after on-prem must produce byte-identical CLAUDE.md to original standard install'
      );

      // Install 2 must have contained on-prem content
      assert.ok(!content3.includes('/no_think'), 'final standard install must not contain /no_think');
    } finally { cleanup(dir); }
  });

  // ── (g) On-prem persona: planning persona has /no_think prefix in critical_actions ──

  await test('on-prem install: planning persona has /no_think prefix in critical_actions[0]', async () => {
    const dir = mktemp();
    try {
      const CUSTOMIZE_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-customize');
      const jsYaml = require('js-yaml');

      // Copy all customize yaml files into a temp "deployed" dir, simulating post-BMAD deploy
      const deployedDir = path.join(dir, '_config');
      fs.mkdirSync(deployedDir, { recursive: true });
      const files = fs.readdirSync(CUSTOMIZE_SOURCE).filter(f => f.endsWith('.customize.yaml'));
      assert.ok(files.length > 0, 'bmad-customize directory must contain at least one .customize.yaml file');
      for (const file of files) {
        fs.copyFileSync(path.join(CUSTOMIZE_SOURCE, file), path.join(deployedDir, file));
      }

      // Apply the on-prem phase prefix
      await applyPersonaPhasePrefix(CUSTOMIZE_SOURCE, deployedDir, 'on-prem');

      // Verify bmm-pm: planning persona — critical_actions[0] must contain /no_think
      const pmPath = path.join(deployedDir, 'bmm-pm.customize.yaml');
      assert.ok(fs.existsSync(pmPath), 'bmm-pm.customize.yaml must exist in deployed dir');
      const pmDoc = jsYaml.load(fs.readFileSync(pmPath, 'utf-8'));
      assert.ok(Array.isArray(pmDoc.critical_actions) && pmDoc.critical_actions.length > 0,
        'bmm-pm critical_actions must be non-empty after on-prem deploy');
      assert.ok(
        pmDoc.critical_actions[0].includes('/no_think'),
        `bmm-pm critical_actions[0] must contain /no_think in on-prem profile; got: ${pmDoc.critical_actions[0]}`
      );

      // On-prem deployment must strip the phase: and on_prem_phase_prefix: keys
      assert.ok(!Object.prototype.hasOwnProperty.call(pmDoc, 'phase'),
        'deployed bmm-pm must not contain phase: key (AC #8 Story 21.7)');
      assert.ok(!Object.prototype.hasOwnProperty.call(pmDoc, 'on_prem_phase_prefix'),
        'deployed bmm-pm must not contain on_prem_phase_prefix: key (AC #8 Story 21.7)');
    } finally { cleanup(dir); }
  });

  // ── (h) Installer non-regression: vllm deployment doc not stamped ─────────

  await test('vllm deployment doc is not stamped into target projects', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      await runMinimalInstall(dir, { yesMode: true });

      // Walk the entire temp dir and look for vllm artefacts
      function walkDir(dirPath) {
        const entries = [];
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const full = path.join(dirPath, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            entries.push(...walkDir(full));
          } else {
            entries.push(full);
          }
        }
        return entries;
      }

      const allFiles = walkDir(dir);

      // No file matching *vllm-nemotron* should exist anywhere in the project
      const vllmFiles = allFiles.filter(f => path.basename(f).includes('vllm-nemotron'));
      assert.strictEqual(vllmFiles.length, 0,
        `vllm-nemotron docs must not be stamped into target projects; found: ${vllmFiles.join(', ')}`);

      // No file should contain 'vllm serve' content
      for (const filePath of allFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          assert.ok(
            !content.includes('vllm serve'),
            `File ${path.relative(dir, filePath)} must not contain "vllm serve" command`
          );
        } catch {
          // binary files — skip
        }
      }
    } finally { cleanup(dir); }
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  \u2717 ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled error in test harness:', err);
  process.exit(1);
});
