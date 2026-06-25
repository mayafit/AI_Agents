#!/usr/bin/env node
/**
 * Regression test — GitHub Copilot instruction-file path.
 *
 * Bug: ma-agents stamped Copilot's skill-bootstrap instructions into
 * `.github/copilot/copilot.md`, which GitHub Copilot does NOT read. Copilot
 * reads repository custom instructions from `.github/copilot-instructions.md`
 * (per the project PRD). As a result Copilot never learned to read
 * `.agents/skills/MANIFEST.yaml`, so installed skills were invisible to it even
 * though they were physically present under `.agents/skills/`.
 *
 * These tests pin the corrected behavior:
 *   - the copilot agent's instructionFiles[0] is `.github/copilot-instructions.md`
 *   - a Copilot install renders that file with the MANIFEST pointer + markers
 *   - the old `.github/copilot/copilot.md` is NOT produced
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

const agents = require('../lib/agents');
const installer = require('../lib/installer');
const updateAgentInstructions = installer._testUpdateAgentInstructions;

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-copilot-test-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('\n copilot instruction-path regression tests\n');

async function runAll() {
  await test('copilot agent instructionFiles targets .github/copilot-instructions.md', () => {
    const copilot = agents.getAgent('copilot');
    assert.ok(copilot, 'copilot agent must be registered');
    assert.deepStrictEqual(copilot.instructionFiles, ['.github/copilot-instructions.md'],
      `copilot must write to the file GitHub Copilot actually reads; got ${JSON.stringify(copilot.instructionFiles)}`);
  });

  await test('copilot install renders .github/copilot-instructions.md with the manifest pointer', async () => {
    const dir = mktemp();
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const copilot = agents.getAgent('copilot');
      await updateAgentInstructions(copilot, dir, { yesMode: true });

      const correct = path.join(dir, '.github', 'copilot-instructions.md');
      const legacy = path.join(dir, '.github', 'copilot', 'copilot.md');

      assert.ok(fs.existsSync(correct), 'install must create .github/copilot-instructions.md');
      assert.ok(!fs.existsSync(legacy), 'install must NOT create the legacy .github/copilot/copilot.md');

      const content = fs.readFileSync(correct, 'utf-8');
      assert.ok(content.includes('.agents/skills/MANIFEST.yaml'),
        'instruction block must point Copilot at the .agents/skills manifest');
      assert.ok(content.includes('MA-AGENTS-START'),
        'instruction block must be wrapped in ma-agents markers');
    } finally {
      process.chdir(cwd);
      cleanup(dir);
    }
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll();
