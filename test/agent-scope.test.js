#!/usr/bin/env node
/**
 * Bug B1 regression test — --agent flag scopes install to a single tool only.
 *
 * Calls installSkill() with agentIds: ['claude-code'] against a scratch temp
 * directory and asserts:
 *   1. .claude/skills/ is populated
 *   2. .cline/skills/, .roo/skills/, .kilocode/skills/, .github/skills/ are NOT created
 *   3. .ma-agents.json `agents` array contains only 'claude-code'
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { installSkill, listSkills } = require('../lib/installer');

let passed = 0;
let failed = 0;
const errors = [];

async function asyncTest(name, fn) {
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

// Pick a skill that is guaranteed to exist.
function firstSkillId() {
  const skills = listSkills();
  if (skills.length === 0) throw new Error('No skills found in skills/');
  return skills[0].id;
}

/**
 * Install a single skill for claude-code only into a fresh scratch dir.
 * Returns the scratch dir path; the caller is responsible for cleanup.
 */
async function installClaudeCodeOnly() {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-scope-'));
  const origCwd = process.cwd();
  process.chdir(scratchDir);
  try {
    const skillId = firstSkillId();
    await installSkill(skillId, ['claude-code'], '', 'project', {
      force: true,
      yes: true,
      batchState: {}
    });
  } finally {
    process.chdir(origCwd);
  }
  return scratchDir;
}

console.log('\nBug B1 — agent-scope regression tests');

(async () => {
  // Run a single install and reuse the scratch dir for all assertions.
  let scratchDir;
  try {
    scratchDir = await installClaudeCodeOnly();
  } catch (err) {
    console.error(`  FATAL: could not run install: ${err.message}`);
    process.exit(1);
  }

  try {
    await asyncTest('.claude/skills/ is created (target tool populated)', async () => {
      const skillsDir = path.join(scratchDir, '.claude', 'skills');
      assert.ok(fs.existsSync(skillsDir), `.claude/skills/ should exist after claude-code install`);
    });

    await asyncTest('.cline/skills/ is NOT created (scoping enforced)', async () => {
      const dir = path.join(scratchDir, '.cline', 'skills');
      assert.ok(!fs.existsSync(dir), `.cline/skills/ must NOT exist when only claude-code is targeted`);
    });

    await asyncTest('.roo/skills/ is NOT created (scoping enforced)', async () => {
      const dir = path.join(scratchDir, '.roo', 'skills');
      assert.ok(!fs.existsSync(dir), `.roo/skills/ must NOT exist when only claude-code is targeted`);
    });

    await asyncTest('.kilocode/skills/ is NOT created (scoping enforced)', async () => {
      const dir = path.join(scratchDir, '.kilocode', 'skills');
      assert.ok(!fs.existsSync(dir), `.kilocode/skills/ must NOT exist when only claude-code is targeted`);
    });

    await asyncTest('.github/skills/ is NOT created (scoping enforced)', async () => {
      const dir = path.join(scratchDir, '.github', 'skills');
      assert.ok(!fs.existsSync(dir), `.github/skills/ must NOT exist when only claude-code is targeted`);
    });

    await asyncTest('.claude/skills/.ma-agents.json agents contains only claude-code', async () => {
      // The manifest (.ma-agents.json) lives inside the installPath — for
      // claude-code project scope that is <cwd>/.claude/skills/.ma-agents.json
      const manifestPath = path.join(scratchDir, '.claude', 'skills', '.ma-agents.json');
      assert.ok(fs.existsSync(manifestPath), `.claude/skills/.ma-agents.json must exist after install`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // The `agents` array contains string IDs.
      const agentIds = Array.isArray(manifest.agents) ? manifest.agents : [];
      const unexpectedAgents = agentIds.filter(id => id !== 'claude-code');
      assert.ok(
        unexpectedAgents.length === 0,
        `agents must contain only 'claude-code', but also found: ${unexpectedAgents.join(', ')}`
      );
    });
  } finally {
    fs.removeSync(scratchDir);
  }

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
