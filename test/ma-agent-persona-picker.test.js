#!/usr/bin/env node
/**
 * Regression test — ma-agent personas must surface in the IDE agent picker.
 *
 * Bug: the four ma-agent personas (DevOps/Amit, Cyber/Yael, SQA/Gadi, SRE/Alex)
 * installed correctly as skills but never appeared in the GitHub Copilot
 * agent-picker dropdown in VS Code, while the core BMAD personas (Mary, John,
 * Winston, Amelia, ...) did.
 *
 * Root cause: BMAD's installer emits agent-picker entries
 * (`.github/agents/<id>.agent.md`) only for skills its `agents-only` filter
 * classifies as personas. That filter — `isAgentSkill()` in
 * bmad-method/tools/installer/ide/_config-driven.js — keys SOLELY off the
 * presence of an `[agent]` section in the skill's `customize.toml`. It does NOT
 * read the `type: agent` field in bmad-skill-manifest.yaml. The four ma-agent
 * skills declared `type: agent` but shipped no `customize.toml`, so the filter
 * skipped them and no picker entry was ever written.
 *
 * Fix: ship a `customize.toml` carrying an `[agent]` section for each of the
 * four personas. This test pins that contract in BOTH the hand-edited source
 * tree and the generated plugin bundle, using the exact predicate the installer
 * applies, so the personas can never silently fall out of the picker again.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const SOURCE_SKILLS = path.join(PROJECT_ROOT, 'lib', 'bmad-extension', 'skills');
const BUNDLE_SKILLS = path.join(PROJECT_ROOT, 'lib', 'bmad-extension-plugin', 'skills');

// The four personas the bug report named, with the human name each must carry.
const MA_AGENTS = [
  { id: 'ma-agent-devops', name: 'Amit' },
  { id: 'ma-agent-cyber', name: 'Yael' },
  { id: 'ma-agent-sqa', name: 'Gadi' },
  { id: 'ma-agent-sre', name: 'Alex' },
];

// The EXACT predicate bmad-method's isAgentSkill() applies (an [agent] section
// header anywhere in the file). Kept literal here so this test fails loudly if
// the persona-detection contract we depend on ever changes.
const AGENT_SECTION_RE = /^\[agent\]/m;

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

console.log('\n ma-agent persona picker-visibility regression tests\n');

for (const { id, name } of MA_AGENTS) {
  const sourceToml = path.join(SOURCE_SKILLS, id, 'customize.toml');
  const bundleToml = path.join(BUNDLE_SKILLS, id, 'customize.toml');

  test(`${id}: source customize.toml exists with an [agent] section`, () => {
    assert.ok(fs.existsSync(sourceToml),
      `missing ${path.relative(PROJECT_ROOT, sourceToml)} — persona will be filtered out of the agent picker`);
    const content = fs.readFileSync(sourceToml, 'utf-8');
    assert.ok(AGENT_SECTION_RE.test(content),
      `${id} customize.toml has no [agent] section; bmad-method's agents-only filter will skip it`);
    assert.ok(content.includes(`name = "${name}"`),
      `${id} customize.toml must declare name = "${name}" for a readable picker identity`);
    assert.ok(/^title\s*=/m.test(content),
      `${id} customize.toml must declare a title`);
  });

  test(`${id}: generated bundle carries the same [agent] customize.toml`, () => {
    assert.ok(fs.existsSync(bundleToml),
      `missing ${path.relative(PROJECT_ROOT, bundleToml)} — run \`npm run build:plugin\` to regenerate the bundle`);
    const bundleContent = fs.readFileSync(bundleToml, 'utf-8');
    assert.ok(AGENT_SECTION_RE.test(bundleContent),
      `${id} bundle customize.toml lost its [agent] section`);
    // The build is a byte-preserving copy — source and bundle must match.
    const sourceContent = fs.readFileSync(sourceToml, 'utf-8');
    assert.strictEqual(bundleContent, sourceContent,
      `${id} bundle customize.toml drifted from source; rebuild with \`npm run build:plugin\``);
  });
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach((e) => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
