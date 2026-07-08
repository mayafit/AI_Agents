#!/usr/bin/env node
/**
 * Batch reinstall UX regression test.
 *
 * Verifies the "apply to all" reinstall path added to installSkill():
 *   - A preset batchState.globalAction === 'reinstall' is honored WITHOUT
 *     prompting, and actually performs a clean reinstall (remove + re-copy)
 *     even when the skill is already recorded in the manifest.
 *   - A preset batchState.globalAction === 'skip' leaves the current install
 *     untouched (no re-copy), proving the two batch actions are distinct.
 *
 * Setup mirrors agent-scope.test.js: install one real skill into a scratch
 * project for claude-code only, then re-run installSkill with a preset global
 * action. Deleting the installed SKILL.md before the second run lets us observe
 * whether a re-copy happened (reinstall) or not (skip).
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

function firstSkillId() {
  const skills = listSkills();
  if (skills.length === 0) throw new Error('No skills found in skills/');
  return skills[0].id;
}

const SKILL_ID = firstSkillId();

/** Run installSkill for claude-code only inside the given scratch dir. */
async function runInstall(scratchDir, options) {
  const origCwd = process.cwd();
  process.chdir(scratchDir);
  try {
    await installSkill(SKILL_ID, ['claude-code'], '', 'project', options);
  } finally {
    process.chdir(origCwd);
  }
}

function skillFilePath(scratchDir) {
  return path.join(scratchDir, '.claude', 'skills', SKILL_ID, 'SKILL.md');
}

console.log('\nBatch reinstall UX — regression tests');

(async () => {
  // ── Case 1: globalAction 'reinstall' re-copies an already-installed skill ──
  await asyncTest("globalAction='reinstall' performs a clean reinstall without prompting", async () => {
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-reinstall-'));
    try {
      // First install (non-interactive).
      await runInstall(scratchDir, { yes: true, batchState: {} });
      const skillFile = skillFilePath(scratchDir);
      assert.ok(fs.existsSync(skillFile), 'SKILL.md should exist after first install');

      // Delete the copied SKILL.md but keep the manifest entry — the skill is
      // still "installed" per the manifest, so a plain skip would leave the
      // file missing; a reinstall must re-copy it.
      fs.removeSync(skillFile);
      assert.ok(!fs.existsSync(skillFile), 'SKILL.md should be gone before reinstall');

      // Re-run with yes=false but a preset global reinstall action. This must
      // NOT prompt (globalAction short-circuits the menu) and must re-copy.
      await runInstall(scratchDir, { yes: false, batchState: { globalAction: 'reinstall' } });
      assert.ok(fs.existsSync(skillFile), 'SKILL.md should be re-copied by reinstall');
    } finally {
      fs.removeSync(scratchDir);
    }
  });

  // ── Case 2: globalAction 'skip' leaves the current install untouched ──
  await asyncTest("globalAction='skip' does not re-copy an already-installed skill", async () => {
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-skip-'));
    try {
      await runInstall(scratchDir, { yes: true, batchState: {} });
      const skillFile = skillFilePath(scratchDir);
      assert.ok(fs.existsSync(skillFile), 'SKILL.md should exist after first install');

      fs.removeSync(skillFile);
      await runInstall(scratchDir, { yes: false, batchState: { globalAction: 'skip' } });
      assert.ok(!fs.existsSync(skillFile), 'SKILL.md should stay absent when the batch action is skip');
    } finally {
      fs.removeSync(scratchDir);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
