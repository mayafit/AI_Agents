#!/usr/bin/env node
/**
 * Story 21.6 — On-prem layered guardrails tests (composer + per-surface injection).
 *
 * Scope (story-local): verify the on-prem TEMPLATE contract and that on-prem
 * content flows TRANSPARENTLY through every injection surface owned by
 * Stories 21.2–21.5 when profile=on-prem, while remaining absent under
 * profile=standard (NFR44).
 *
 * Cross-tool integration (every-agent-at-once, idempotency across all
 * artifacts simultaneously) is Story 21.9's scope — not duplicated here.
 *
 * AC coverage:
 *   7.1  Template exists + four AC #1 content categories present
 *   7.2  Template contains NO {{...}} placeholders
 *   7.3  NFR44 standard — composer output lacks the three literals
 *   7.4  On-prem profile — composer output contains the three literals
 *   7.5  Composer structure — universal + exactly one blank line + on-prem
 *   7.6  Idempotency of composer for on-prem profile
 *   7.7  Fresh standard-profile install: three literals absent from every
 *        rendered injection surface (excluding AGENTS.md's legitimate
 *        ~/.claude/ Critical Behavior Rules exception — AC #4)
 *   7.8  Fresh on-prem-profile install: three literals present in every
 *        rendered injection surface (including .roomodes customInstructions
 *        for each of the four ma-agents-owned modes)
 *   7.9  Two consecutive on-prem installs produce byte-identical content
 *        inside the marker region (NFR46)
 *   7.10 NFR18 — opencode.json has exactly one [ma-agents] entry after
 *        on-prem install; other keys untouched; instructions[] length stable
 *   7.11 NFR47 — .roomodes fileRegex patterns byte-identical between
 *        standard and on-prem renders (content diff only in customInstructions)
 *   7.12 Shape A (AC #7 resolution) — AGENTS.md on-prem render carries
 *        /no_think inside the marker block
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

const installerModule = require('../lib/installer');
const {
  composeInstructionBlock,
  ONPREM_INSTRUCTION_TEMPLATE_PATH,
  _testUpdateAgentInstructions: updateAgentInstructions,
  stampExtraInstructionTemplates
} = installerModule;
const { setProfile } = require('../lib/profile');
const agents = require('../lib/agents');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-onprem-layer-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// Extract content between the MA-AGENTS markers (inclusive of markers).
function extractMarkerBlock(text) {
  const start = text.indexOf('<!-- MA-AGENTS-START -->');
  const end = text.indexOf('<!-- MA-AGENTS-END -->');
  if (start < 0 || end < 0) return null;
  return text.slice(start, end + '<!-- MA-AGENTS-END -->'.length);
}

async function installAllInjectionSurfaces(projectRoot, opts = {}) {
  // Install every agent that receives an injection (markdown-marker + json-merge
  // + extraInstructionTemplates). BMAD-category agents are skipped — their
  // instruction files do not exist in a fresh install and 21.2 AC #9 preserves
  // the "BMAD agent file not yet deployed" skip.
  const ids = ['claude-code', 'gemini', 'copilot', 'kilocode', 'cline', 'roo-code', 'cursor', 'antigravity', 'opencode'];
  const cwdOriginal = process.cwd();
  process.chdir(projectRoot);
  try {
    for (const id of ids) {
      const agent = agents.getAgent(id);
      if (!agent) continue;
      await updateAgentInstructions(agent, projectRoot, opts);
      if (Array.isArray(agent.extraInstructionTemplates) && agent.extraInstructionTemplates.length > 0) {
        await stampExtraInstructionTemplates(agent, projectRoot, opts);
      }
    }
  } finally {
    process.chdir(cwdOriginal);
  }
}

console.log('\n onprem-layer unit + integration tests (Story 21.6)\n');

async function runAll() {
  // 7.1 — Template exists + four AC #1 content categories
  await test('7.1 on-prem template file exists and contains the four AC #1 categories', () => {
    assert.ok(fs.existsSync(ONPREM_INSTRUCTION_TEMPLATE_PATH), 'template file must exist');
    const t = fs.readFileSync(ONPREM_INSTRUCTION_TEMPLATE_PATH, 'utf-8');
    assert.ok(t.includes('/no_think'), 'category 1: /no_think directive');
    assert.ok(t.includes('~/.claude/'), 'category 2: no-home-dir-writes rule references ~/.claude/');
    assert.ok(t.includes('str_replace_editor'), 'category 3: no-str_replace_editor rule');
    // Category 4 — per-phase reasoning+sampling guidance
    assert.ok(/planning/i.test(t) && /reasoning/i.test(t), 'category 4: per-phase reasoning guidance');
    assert.ok(/temperature/i.test(t), 'category 4: sampling (temperature) guidance');
    assert.ok(/implementation/i.test(t), 'category 4: implementation-phase guidance');
  });

  // 7.2 — No placeholders
  await test('7.2 on-prem template contains no {{...}} placeholders', () => {
    const t = fs.readFileSync(ONPREM_INSTRUCTION_TEMPLATE_PATH, 'utf-8');
    assert.ok(!t.includes('{{'), 'no {{...}} placeholders allowed in on-prem template (AC #3)');
  });

  // 7.3 — NFR44: composer standard-profile output lacks the three literals
  await test('7.3 NFR44 — composer standard-profile output lacks /no_think, str_replace_editor, ~/.claude/', () => {
    const out = composeInstructionBlock({ profile: 'standard', projectRoot: mktemp() });
    assert.ok(!out.includes('/no_think'));
    assert.ok(!out.includes('str_replace_editor'));
    assert.ok(!out.includes('~/.claude/'));
  });

  // 7.4 — On-prem: composer output contains the three literals
  await test('7.4 on-prem composer output contains /no_think, str_replace_editor, ~/.claude/', () => {
    const out = composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() });
    assert.ok(out.includes('/no_think'), 'missing /no_think');
    assert.ok(out.includes('str_replace_editor'), 'missing str_replace_editor');
    assert.ok(out.includes('~/.claude/'), 'missing ~/.claude/');
  });

  // 7.5 — Composer structure: universal + exactly one blank line + on-prem
  await test('7.5 on-prem composer output = universal + one blank line + on-prem template', () => {
    const onprem = composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() });
    const standard = composeInstructionBlock({ profile: 'standard', projectRoot: mktemp() });
    // standard content is universal-only (normalized to end with exactly one \n).
    // on-prem content must START with the same universal body, then "\n\n", then on-prem template.
    const universalTrimmed = standard.replace(/\s+$/, '');
    assert.ok(onprem.startsWith(universalTrimmed), 'on-prem output must begin with universal content');
    const remainder = onprem.slice(universalTrimmed.length);
    assert.ok(remainder.startsWith('\n\n'), 'exactly one blank line separator between universal and on-prem');
    // Exactly one blank line means: \n\n followed by non-\n
    assert.ok(!remainder.startsWith('\n\n\n'), 'more than one blank line between layers is forbidden');
  });

  // 7.6 — Idempotency
  await test('7.6 composer is byte-identical across calls for on-prem profile', () => {
    const a = composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() });
    const b = composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() });
    assert.strictEqual(a, b);
  });

  // 7.7 — Fresh standard-profile install: three literals absent from every injection surface
  await test('7.7 NFR44 integration — standard profile install: three literals absent from every rendered file', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      await installAllInjectionSurfaces(dir);

      const surfaces = [
        '.claude/CLAUDE.md',
        '.cline/clinerules.md',
        '.clinerules',
        '.roo/rules/00-ma-agents.md',
        '.cursor/cursor.md',
        '.kilocode/kilocode.md',
        '.github/copilot/copilot.md',
        '.gemini/gemini.md',
        '.antigravity/antigravity.md',
        '.roomodes'
      ];
      // Sanity guard: the standard-profile install MUST actually render at least
      // the canonical Claude Code instruction file. Otherwise the loop below
      // would pass vacuously on a regression that drops every injection surface.
      assert.ok(fs.existsSync(path.join(dir, '.claude/CLAUDE.md')),
        'sanity: standard-profile install must render at least .claude/CLAUDE.md');

      for (const rel of surfaces) {
        const p = path.join(dir, rel);
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(!content.includes('/no_think'), `${rel} contains forbidden /no_think in standard profile`);
        assert.ok(!content.includes('str_replace_editor'), `${rel} contains forbidden str_replace_editor in standard profile`);
        assert.ok(!content.includes('~/.claude/'), `${rel} contains forbidden ~/.claude/ in standard profile`);
      }

      // AGENTS.md has one legitimate ~/.claude/ occurrence (Critical Behavior Rules — AC #4 exception).
      // But /no_think and str_replace_editor must still be absent.
      const agentsMd = path.join(dir, 'AGENTS.md');
      if (fs.existsSync(agentsMd)) {
        const content = fs.readFileSync(agentsMd, 'utf-8');
        assert.ok(!content.includes('/no_think'), 'AGENTS.md contains forbidden /no_think in standard profile');
        assert.ok(!content.includes('str_replace_editor'), 'AGENTS.md contains forbidden str_replace_editor in standard profile');
      }

      // OpenCode opencode.json::instructions[] ma-agents-prefixed entry
      const opencodeJson = path.join(dir, 'opencode.json');
      if (fs.existsSync(opencodeJson)) {
        const data = JSON.parse(fs.readFileSync(opencodeJson, 'utf-8'));
        const maEntry = (data.instructions || []).find(e => typeof e === 'string' && e.startsWith('[ma-agents]'));
        if (maEntry) {
          assert.ok(!maEntry.includes('/no_think'));
          assert.ok(!maEntry.includes('str_replace_editor'));
          assert.ok(!maEntry.includes('~/.claude/'));
        }
      }
    } finally { cleanup(dir); }
  });

  // 7.8 — Fresh on-prem install: three literals present in every rendered injection surface
  await test('7.8 on-prem integration — on-prem profile install: three literals present in every rendered file', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      await installAllInjectionSurfaces(dir);

      const surfaces = [
        '.claude/CLAUDE.md',
        '.cline/clinerules.md',
        '.clinerules',
        '.roo/rules/00-ma-agents.md',
        '.cursor/cursor.md',
        '.kilocode/kilocode.md',
        '.github/copilot/copilot.md',
        '.gemini/gemini.md',
        '.antigravity/antigravity.md',
        'AGENTS.md',
        '.roomodes'
      ];
      // Sanity guard — the on-prem install MUST render the marker-bearing surfaces.
      // Without this, a regression that drops every surface would pass the loop vacuously.
      assert.ok(fs.existsSync(path.join(dir, '.claude/CLAUDE.md')),
        'sanity: on-prem install must render .claude/CLAUDE.md');
      assert.ok(fs.existsSync(path.join(dir, '.roomodes')),
        'sanity: on-prem install must render .roomodes');
      assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')),
        'sanity: on-prem install must render AGENTS.md');

      for (const rel of surfaces) {
        const p = path.join(dir, rel);
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('/no_think'), `${rel} missing /no_think in on-prem profile`);
        assert.ok(content.includes('str_replace_editor'), `${rel} missing str_replace_editor in on-prem profile`);
        assert.ok(content.includes('~/.claude/'), `${rel} missing ~/.claude/ in on-prem profile`);
      }

      // OpenCode ma-agents entry must contain the three literals in its single ma-agents-prefixed string
      const opencodeJson = path.join(dir, 'opencode.json');
      if (fs.existsSync(opencodeJson)) {
        const data = JSON.parse(fs.readFileSync(opencodeJson, 'utf-8'));
        const maEntries = (data.instructions || []).filter(e => typeof e === 'string' && e.startsWith('[ma-agents]'));
        assert.strictEqual(maEntries.length, 1, 'exactly one [ma-agents] entry');
        assert.ok(maEntries[0].includes('/no_think'));
        assert.ok(maEntries[0].includes('str_replace_editor'));
        assert.ok(maEntries[0].includes('~/.claude/'));
      }

      // .roomodes AC #6: /no_think present inside EACH of the four ma-agents mode customInstructions
      const roomodesPath = path.join(dir, '.roomodes');
      if (fs.existsSync(roomodesPath)) {
        const yaml = fs.readFileSync(roomodesPath, 'utf-8');
        const modes = ['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev'];
        for (const slug of modes) {
          const idx = yaml.indexOf(`slug: ${slug}`);
          assert.ok(idx >= 0, `mode ${slug} present`);
          // Find the extent of this mode (until the next "- slug:" or EOF)
          const nextIdx = yaml.indexOf('- slug:', idx + 1);
          const modeText = nextIdx > 0 ? yaml.slice(idx, nextIdx) : yaml.slice(idx);
          assert.ok(modeText.includes('/no_think'), `.roomodes mode ${slug} customInstructions missing /no_think in on-prem profile`);
        }
      }
    } finally { cleanup(dir); }
  });

  // 7.9 — Two consecutive on-prem installs produce byte-identical marker block content
  await test('7.9 NFR46 — two consecutive on-prem installs: byte-identical marker-block content', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      await installAllInjectionSurfaces(dir);
      const snap1 = {};
      const files = ['.claude/CLAUDE.md', '.clinerules', '.cline/clinerules.md', '.roo/rules/00-ma-agents.md', 'AGENTS.md', '.roomodes'];
      for (const f of files) {
        const p = path.join(dir, f);
        if (fs.existsSync(p)) snap1[f] = fs.readFileSync(p, 'utf-8');
      }
      await installAllInjectionSurfaces(dir);
      for (const f of Object.keys(snap1)) {
        const p = path.join(dir, f);
        const after = fs.readFileSync(p, 'utf-8');
        // For marker-bearing files compare the marker block region for byte-identity.
        // .roomodes (YAML) compares full file.
        if (f === '.roomodes') {
          assert.strictEqual(after, snap1[f], `${f}: re-install not byte-identical`);
        } else {
          const b1 = extractMarkerBlock(snap1[f]);
          const b2 = extractMarkerBlock(after);
          assert.ok(b1 !== null && b2 !== null, `${f}: marker block present`);
          assert.strictEqual(b2, b1, `${f}: marker block not byte-identical across installs`);
        }
      }
    } finally { cleanup(dir); }
  });

  // 7.10 — NFR18: opencode.json additive JSON-merge not regressed
  await test('7.10 NFR18 — on-prem install leaves opencode.json additive-merged (single ma-agents entry, user entries preserved)', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      const opencode = agents.getAgent('opencode');
      assert.ok(opencode);
      const filePath = path.join(dir, opencode.instructionFiles[0]);
      fs.mkdirSync(path.dirname(filePath) || dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({
        instructions: ['user-kept-entry'],
        otherKey: { keep: true, n: 42 }
      }, null, 2), 'utf-8');

      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        await updateAgentInstructions(opencode, dir);
        if (Array.isArray(opencode.extraInstructionTemplates)) {
          await stampExtraInstructionTemplates(opencode, dir);
        }
      } finally { process.chdir(cwdOriginal); }

      let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.deepStrictEqual(data.otherKey, { keep: true, n: 42 }, 'unrelated keys untouched');
      assert.ok(data.instructions.includes('user-kept-entry'), 'user entry preserved');
      const maEntries = data.instructions.filter(e => typeof e === 'string' && e.startsWith('[ma-agents]'));
      assert.strictEqual(maEntries.length, 1, 'exactly one ma-agents entry');
      const lenAfter1 = data.instructions.length;

      // Second install — instructions[] length stable
      process.chdir(dir);
      try {
        await updateAgentInstructions(opencode, dir);
        if (Array.isArray(opencode.extraInstructionTemplates)) {
          await stampExtraInstructionTemplates(opencode, dir);
        }
      } finally { process.chdir(cwdOriginal); }
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const maEntries2 = data.instructions.filter(e => typeof e === 'string' && e.startsWith('[ma-agents]'));
      assert.strictEqual(maEntries2.length, 1, 'still exactly one ma-agents entry after re-install');
      assert.strictEqual(data.instructions.length, lenAfter1, 'instructions[] length stable across re-install');
    } finally { cleanup(dir); }
  });

  // 7.11 — NFR47: .roomodes fileRegex patterns byte-identical standard vs on-prem
  await test('7.11 NFR47 — .roomodes fileRegex identical between standard and on-prem renders', async () => {
    const dirS = mktemp();
    const dirO = mktemp();
    try {
      setProfile(dirS, 'standard');
      setProfile(dirO, 'on-prem');
      const roo = agents.getAgent('roo-code');
      assert.ok(roo);
      for (const dir of [dirS, dirO]) {
        const cwdOriginal = process.cwd();
        process.chdir(dir);
        try {
          await updateAgentInstructions(roo, dir);
          await stampExtraInstructionTemplates(roo, dir);
        } finally { process.chdir(cwdOriginal); }
      }
      const yS = fs.readFileSync(path.join(dirS, '.roomodes'), 'utf-8');
      const yO = fs.readFileSync(path.join(dirO, '.roomodes'), 'utf-8');
      const re = /fileRegex:\s*([^\n]+)/g;
      const mS = [...yS.matchAll(re)].map(m => m[1].trim());
      const mO = [...yO.matchAll(re)].map(m => m[1].trim());
      assert.ok(mS.length >= 3, 'at least 3 fileRegex patterns expected');
      assert.deepStrictEqual(mO, mS, 'fileRegex sequence must be byte-identical across profiles');
    } finally { cleanup(dirS); cleanup(dirO); }
  });

  // 7.12 — Shape A: AGENTS.md on-prem carries /no_think inside the marker block
  await test('7.12 Shape A — AGENTS.md on-prem marker block contains /no_think (location via Universal Rules)', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      const opencode = agents.getAgent('opencode');
      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        await updateAgentInstructions(opencode, dir);
        await stampExtraInstructionTemplates(opencode, dir);
      } finally { process.chdir(cwdOriginal); }
      const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      const block = extractMarkerBlock(content);
      assert.ok(block, 'marker block present');
      assert.ok(block.includes('/no_think'), 'on-prem /no_think inside marker block (Shape A)');
    } finally { cleanup(dir); }
  });

  console.log(`\n ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`   ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
