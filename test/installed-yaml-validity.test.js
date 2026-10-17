#!/usr/bin/env node
/**
 * Bug: installed SKILL.md frontmatter and MANIFEST.yaml were not valid YAML.
 *
 * lib/installer.js interpolated skill.json descriptions (and applies_when
 * conditions) into YAML as raw text. my-next-issue's description contains
 * "(Jira: assignee = currentUser())", and an unquoted ": " inside a plain
 * scalar is a YAML syntax error — so the installed
 * .claude/skills/my-next-issue/SKILL.md AND the whole .claude/skills/
 * MANIFEST.yaml (the file CLAUDE.md tells the agent to read first) failed to
 * parse. Values are now serialised through the yaml library.
 *
 * Both checks run against EVERY shipped skill, so the next description that
 * needs quoting is covered without a new test.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('yaml');

const { listSkills, installSkill, generateSkillsManifest } = require('../lib/installer');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

/** Run fn with console.log silenced (installSkill is chatty). */
async function quietly(fn) {
  const log = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
}

(async () => {
  console.log('\nInstalled SKILL.md frontmatter and MANIFEST.yaml are valid YAML\n');

  const skills = listSkills();

  await test('the shipped skill set includes a description that needs quoting', () => {
    // Guards the guard: without such a value the checks below prove nothing.
    assert.ok(skills.some(s => yaml.stringify(s.description, { lineWidth: 0 }).trimEnd() !== s.description),
      'no skill description needs YAML quoting any more — pick a new fixture');
  });

  await test('MANIFEST.yaml for every shipped skill parses and round-trips descriptions', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-manifest-yaml-'));
    try {
      const entries = Object.fromEntries(skills.map(s => [s.id, { version: s.version }]));
      fs.writeFileSync(path.join(dir, '.ma-agents.json'), JSON.stringify({
        manifestVersion: '1.2.0', agent: 'claude-code', agents: ['claude-code'], scope: 'project', skills: entries,
      }));
      await generateSkillsManifest(dir);
      const parsed = yaml.parse(fs.readFileSync(path.join(dir, 'MANIFEST.yaml'), 'utf8'));
      assert.strictEqual(parsed.skills.length, skills.length);
      for (const entry of parsed.skills) {
        const src = skills.find(s => s.id === entry.id);
        assert.strictEqual(entry.description, src.description, `${entry.id}: description changed in transit`);
        if (src.applies_when) assert.deepStrictEqual(entry.applies_when, src.applies_when, `${entry.id}: applies_when`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('installed SKILL.md frontmatter parses for every shipped skill', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-frontmatter-'));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      for (const s of skills) {
        await quietly(() => installSkill(s.id, ['claude-code'], '', 'project', { force: true, yes: true, batchState: {} }));
      }
      for (const s of skills) {
        const text = fs.readFileSync(path.join(dir, '.claude', 'skills', s.id, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
        const fm = text.match(/^---\n([\s\S]*?)\n---/);
        assert.ok(fm, `${s.id}: no frontmatter`);
        let meta;
        assert.doesNotThrow(() => { meta = yaml.parse(fm[1]); }, `${s.id}: frontmatter is not valid YAML`);
        assert.strictEqual(meta.name, s.id);
        assert.strictEqual(meta.description, s.description, `${s.id}: description changed in transit`);
      }
    } finally {
      process.chdir(cwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
