#!/usr/bin/env node
/**
 * Story 21.3 — Unit + integration tests for .roomodes template and merger.
 *
 * AC coverage (tests → ACs):
 *   5.1  Empty existingYaml → output = four ma-agents-owned modes in canonical order (AC #7, #5, #10)
 *   5.2  Two non-colliding user entries preserved in order, then ma-agents modes (AC #5, #8, #10)
 *   5.3  Colliding slug dropped + exactly one warning naming the slug (AC #6)
 *   5.4  Non-customModes top-level keys preserved (AC #5, FR176)
 *   5.5  NFR44 — standard profile output lacks /no_think, str_replace_editor, ~/.claude/ (AC #11)
 *   5.6  NFR46 — two consecutive merges return byte-identical strings (AC #10)
 *   5.7  NFR47 — each mode's fileRegex accepts/rejects expected file paths (AC #9)
 *   5.8  MA_AGENTS_OWNED_SLUGS exported with canonical order and immutability (AC #5, downstream 21.10/21.11)
 *   5.9  Fresh install via stampExtraInstructionTemplates creates .roomodes with four modes (AC #4, #7)
 *   5.10 Re-install preserves user entry and is byte-identical on second run (AC #8, #10)
 *   5.11 Agent without extraInstructionTemplates is a no-op (AC #13)
 *   5.12 Raw template contains exactly four {{UNIVERSAL_BLOCK}} sentinels and no other placeholders (AC #1, #2)
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

const { mergeRoomodes, MA_AGENTS_OWNED_SLUGS } = require('../lib/merge/roomodes');
const { stampExtraInstructionTemplates, composeInstructionBlock } = require('../lib/installer');
const { setProfile } = require('../lib/profile');
const { getAgent } = require('../lib/agents');

const ROOMODES_TEMPLATE_PATH = path.join(__dirname, '..', 'lib', 'templates', 'roomodes.template.yaml');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-roomodes-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Load the raw template and expand {{UNIVERSAL_BLOCK}} + {{MANIFEST_PATH}}
 * against a project root with a persisted profile — mirrors what the stamper
 * does before calling mergeRoomodes.
 */
function loadComposedTemplate(projectRoot, profile = 'standard') {
  setProfile(projectRoot, profile);
  const raw = fs.readFileSync(ROOMODES_TEMPLATE_PATH, 'utf-8');
  const universal = composeInstructionBlock({ profile, projectRoot })
    .replace(/\{\{MANIFEST_PATH\}\}/g, '.roo/skills/MANIFEST.yaml');
  // Mirror the stamper's indent-preserving substitution so tests stay in sync.
  return raw.replace(
    /^([ \t]*)\{\{UNIVERSAL_BLOCK\}\}/gm,
    (_m, indent) => universal
      .replace(/\s+$/, '')
      .split('\n')
      .map(l => indent + l)
      .join('\n')
  );
}

console.log('\n roomodes merger + stamper tests\n');

async function runAll() {
  // 5.1 — empty existingYaml: four modes in canonical order
  await test('5.1 empty existingYaml → four ma-agents modes in canonical order', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const out = mergeRoomodes('', composed);
      const parsed = yaml.load(out);
      assert.ok(Array.isArray(parsed.customModes), 'customModes must be an array');
      assert.deepStrictEqual(
        parsed.customModes.map(m => m.slug),
        ['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']
      );
    } finally { cleanup(dir); }
  });

  // 5.2 — user entries preserved before ma-agents entries
  await test('5.2 user entries preserved in order, then ma-agents modes', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const existing = yaml.dump({
        customModes: [
          { slug: 'my-custom-mode', name: 'Custom', roleDefinition: 'r', groups: ['read'] },
          { slug: 'another-mode', name: 'Another', roleDefinition: 'r2', groups: ['read'] }
        ]
      });
      const out = mergeRoomodes(existing, composed);
      const parsed = yaml.load(out);
      assert.deepStrictEqual(
        parsed.customModes.map(m => m.slug),
        ['my-custom-mode', 'another-mode', 'bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']
      );
    } finally { cleanup(dir); }
  });

  // 5.3 — collision: user entry dropped, exactly one warning naming the slug
  await test('5.3 colliding slug dropped + exactly one warning naming the slug', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const existing = yaml.dump({
        customModes: [
          { slug: 'keep-me', name: 'Keep', roleDefinition: 'r', groups: ['read'] },
          { slug: 'bmad-architect', name: 'User Architect Override', roleDefinition: 'r2', groups: ['read'] }
        ]
      });
      const warnings = [];
      const out = mergeRoomodes(existing, composed, { warn: (msg) => warnings.push(msg) });
      const parsed = yaml.load(out);
      assert.strictEqual(warnings.length, 1, `expected 1 warning, got ${warnings.length}`);
      assert.ok(
        warnings[0].includes('"bmad-architect"'),
        `warning must cite slug verbatim; got: ${warnings[0]}`
      );
      const slugs = parsed.customModes.map(m => m.slug);
      assert.deepStrictEqual(slugs, ['keep-me', 'bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']);
      // And the bmad-architect entry is the ma-agents version, NOT the user's.
      const arch = parsed.customModes.find(m => m.slug === 'bmad-architect');
      assert.notStrictEqual(arch.name, 'User Architect Override');
    } finally { cleanup(dir); }
  });

  // 5.4 — non-customModes top-level keys preserved (FR176)
  await test('5.4 non-customModes top-level keys preserved (FR176)', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const existing = yaml.dump({
        version: 1,
        settings: { foo: 'bar' },
        customModes: []
      });
      const out = mergeRoomodes(existing, composed);
      const parsed = yaml.load(out);
      assert.strictEqual(parsed.version, 1);
      assert.deepStrictEqual(parsed.settings, { foo: 'bar' });
    } finally { cleanup(dir); }
  });

  // 5.5 — NFR44: standard profile output has no on-prem literals
  await test('5.5 NFR44 — standard-profile output lacks /no_think, str_replace_editor, ~/.claude/', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir, 'standard');
      const out = mergeRoomodes('', composed);
      assert.ok(!out.includes('/no_think'), 'output must not contain /no_think');
      assert.ok(!out.includes('str_replace_editor'), 'output must not contain str_replace_editor');
      assert.ok(!out.includes('~/.claude/'), 'output must not contain ~/.claude/');
    } finally { cleanup(dir); }
  });

  // 5.6 — NFR46: idempotency — two merges byte-identical
  await test('5.6 NFR46 — two consecutive merges byte-identical', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const existing = yaml.dump({
        customModes: [{ slug: 'u1', name: 'U1', roleDefinition: 'r', groups: ['read'] }]
      });
      const out1 = mergeRoomodes(existing, composed);
      const out2 = mergeRoomodes(existing, composed);
      assert.strictEqual(out1, out2, 'mergeRoomodes must be byte-deterministic');
      // Also: merging the previous output against the template produces the same output (fixed point).
      const out3 = mergeRoomodes(out1, composed);
      assert.strictEqual(out1, out3, 'merging the output as input must be a fixed point');
    } finally { cleanup(dir); }
  });

  // 5.7 — NFR47: fileRegex contract per mode
  await test('5.7 NFR47 — each mode fileRegex accepts/rejects expected paths', () => {
    const dir = mktemp();
    try {
      const composed = loadComposedTemplate(dir);
      const out = mergeRoomodes('', composed);
      const parsed = yaml.load(out);
      const byslug = Object.fromEntries(parsed.customModes.map(m => [m.slug, m]));

      function editFileRegex(mode) {
        // groups is: [ "read", [ "edit", { fileRegex, description } ], ... ]
        for (const g of mode.groups) {
          if (Array.isArray(g) && g[0] === 'edit' && g[1] && typeof g[1].fileRegex === 'string') {
            return new RegExp(g[1].fileRegex);
          }
        }
        return null;
      }

      const pm = editFileRegex(byslug['bmad-pm']);
      assert.ok(pm.test('notes.md'), 'bmad-pm must accept .md');
      assert.ok(!pm.test('app.ts'), 'bmad-pm must reject .ts');
      assert.ok(!pm.test('script.py'), 'bmad-pm must reject .py');

      const arch = editFileRegex(byslug['bmad-architect']);
      assert.ok(arch.test('arch.md'));
      assert.ok(arch.test('diagram.drawio'));
      assert.ok(arch.test('model.xml'));
      assert.ok(!arch.test('app.ts'));
      assert.ok(!arch.test('script.py'));

      const tl = editFileRegex(byslug['bmad-techlead']);
      assert.ok(tl.test('config.yaml'));
      assert.ok(tl.test('package.json'));
      assert.ok(tl.test('notes.md'));
      assert.ok(!tl.test('app.ts'));
      assert.ok(!tl.test('script.py'));

      // bmad-dev: no fileRegex on edit → unrestricted
      assert.strictEqual(editFileRegex(byslug['bmad-dev']), null, 'bmad-dev must have no edit-level fileRegex');
      const devGroups = byslug['bmad-dev'].groups;
      assert.ok(devGroups.includes('edit'), 'bmad-dev groups must include bare "edit"');
      assert.ok(devGroups.includes('command'), 'bmad-dev groups must include "command"');
    } finally { cleanup(dir); }
  });

  // 5.8 — MA_AGENTS_OWNED_SLUGS export
  await test('5.8 MA_AGENTS_OWNED_SLUGS exported with canonical order + immutable', () => {
    assert.deepStrictEqual(
      Array.from(MA_AGENTS_OWNED_SLUGS),
      ['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']
    );
    assert.throws(() => { MA_AGENTS_OWNED_SLUGS[0] = 'x'; }, 'MA_AGENTS_OWNED_SLUGS must be frozen');
  });

  // 5.9 — integration: fresh install writes four-mode .roomodes
  await test('5.9 stampExtraInstructionTemplates fresh install writes four-mode .roomodes', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const roo = getAgent('roo-code');
      // Override getProjectPath to point into the tmp root so the MANIFEST.yaml
      // relative-path computation is deterministic and doesn't leak cwd.
      const agent = Object.assign({}, roo, {
        getProjectPath: () => path.join(dir, '.roo', 'skills')
      });
      await stampExtraInstructionTemplates(agent, dir);
      const target = path.join(dir, '.roomodes');
      assert.ok(fs.existsSync(target), '.roomodes must be created');
      const parsed = yaml.load(fs.readFileSync(target, 'utf-8'));
      assert.deepStrictEqual(
        parsed.customModes.map(m => m.slug),
        ['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']
      );
      // {{UNIVERSAL_BLOCK}} must have been expanded (no sentinel remains).
      const raw = fs.readFileSync(target, 'utf-8');
      assert.ok(!raw.includes('{{UNIVERSAL_BLOCK}}'), 'no placeholder may remain after stamp');
      assert.ok(!raw.includes('{{MANIFEST_PATH}}'), 'no manifest placeholder may remain');
    } finally { cleanup(dir); }
  });

  // 5.10 — re-install preserves user entry + byte-identical on second run
  await test('5.10 re-install preserves user entry + byte-identical on second run', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      // Seed with a user entry
      const seed = yaml.dump({
        customModes: [
          { slug: 'my-custom-mode', name: 'Custom', roleDefinition: 'r', groups: ['read'] }
        ]
      });
      fs.writeFileSync(path.join(dir, '.roomodes'), seed, 'utf-8');

      const roo = getAgent('roo-code');
      const agent = Object.assign({}, roo, {
        getProjectPath: () => path.join(dir, '.roo', 'skills')
      });

      await stampExtraInstructionTemplates(agent, dir);
      const after1 = fs.readFileSync(path.join(dir, '.roomodes'), 'utf-8');
      const parsed = yaml.load(after1);
      assert.deepStrictEqual(
        parsed.customModes.map(m => m.slug),
        ['my-custom-mode', 'bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']
      );

      await stampExtraInstructionTemplates(agent, dir);
      const after2 = fs.readFileSync(path.join(dir, '.roomodes'), 'utf-8');
      assert.strictEqual(after1, after2, 'second install must produce byte-identical .roomodes (NFR46)');
    } finally { cleanup(dir); }
  });

  // 5.11 — agent without extraInstructionTemplates is a no-op
  await test('5.11 agent without extraInstructionTemplates is a no-op (AC #13)', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const claude = getAgent('claude-code');
      // claude-code has no extraInstructionTemplates — must not create .roomodes
      await stampExtraInstructionTemplates(claude, dir);
      assert.ok(!fs.existsSync(path.join(dir, '.roomodes')), '.roomodes must NOT be created for agents lacking the field');
    } finally { cleanup(dir); }
  });

  // 5.12 — template shape: four sentinels, no other placeholders
  await test('5.12 template contains {{UNIVERSAL_BLOCK}} × 4 and no other placeholders', () => {
    const raw = fs.readFileSync(ROOMODES_TEMPLATE_PATH, 'utf-8');
    const matches = raw.match(/\{\{UNIVERSAL_BLOCK\}\}/g) || [];
    assert.strictEqual(matches.length, 4, `expected 4 UNIVERSAL_BLOCK sentinels, got ${matches.length}`);
    // No other {{...}} placeholders permitted (per AC #1.2).
    const leftover = raw.replace(/\{\{UNIVERSAL_BLOCK\}\}/g, '').match(/\{\{[^}]+\}\}/g);
    assert.ok(!leftover, `template must contain no other {{...}} placeholders; found: ${leftover}`);
    // NFR44 — raw template must not contain on-prem literals.
    assert.ok(!raw.includes('/no_think'));
    assert.ok(!raw.includes('str_replace_editor'));
    assert.ok(!raw.includes('~/.claude/'));
  });

  // Summary
  console.log('');
  if (failed > 0) {
    console.error(`  ${failed} test(s) failed (${passed} passed)`);
    for (const e of errors) console.error(`    - ${e.name}: ${e.error}`);
    process.exit(1);
  } else {
    console.log(`  All ${passed} tests passed.`);
  }
}

runAll().catch((err) => {
  console.error('Test harness error:', err);
  process.exit(1);
});
