#!/usr/bin/env node
/**
 * Tests for Story 9.2: JSON Injection — Create opencode.json When Absent
 *
 * Validates that updateAgentInstructions() creates a valid opencode.json
 * from scratch when the file does not yet exist, using the json-merge strategy.
 *
 * Updated: instructions entries are now plain strings (OpenCode schema compliance).
 * ma-agents entries are identified by a [ma-agents] prefix in the string.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
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

// Load functions under test
const {
  _testUpdateAgentInstructions: updateFn,
  _MA_AGENTS_SOURCE: MA_AGENTS_SOURCE
} = require('../lib/installer');

// Helper: create a temporary directory, run fn, then clean up
async function withTempDir(fn) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma-agents-json-test-'));
  try {
    await fn(tmpDir);
  } finally {
    await fs.remove(tmpDir);
  }
}

// Helper: build a mock OpenCode agent pointing to a given projectRoot
function createOpenCodeAgent(projectRoot) {
  return {
    id: 'opencode',
    name: 'OpenCode',
    category: 'ide',
    instructionFiles: ['opencode.json'],
    injectionStrategy: { position: 'json-merge', targetKey: 'instructions' },
    getProjectPath: () => path.join(projectRoot, '.opencode', 'skills'),
    getGlobalPath: () => path.join(os.homedir(), '.opencode', 'skills')
  };
}

// Helper: check if an entry is an ma-agents entry (string with prefix)
function isMaEntry(entry) {
  return (typeof entry === 'string' && entry.startsWith(`[${MA_AGENTS_SOURCE}]`)) ||
    (typeof entry === 'object' && entry != null && entry._source === MA_AGENTS_SOURCE);
}

// ─── Creation path tests (file absent) ───────────────────────────────────────

console.log('\nStory 9.2 — JSON injection: file-absent creation path');

(async () => {
  await asyncTest('9.2.1: creates opencode.json when file does not exist', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      assert.strictEqual(fs.existsSync(filePath), false, 'Precondition: file must not exist');
      await updateFn(agent, tmpDir);
      assert.ok(fs.existsSync(filePath), 'opencode.json should have been created');
    });
  });

  await asyncTest('9.2.2: created file is valid JSON', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const raw = fs.readFileSync(filePath, 'utf-8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error(`File content is not valid JSON: ${e.message}\nContent: ${raw}`);
      }
      assert.ok(parsed !== null && typeof parsed === 'object', 'Parsed result should be an object');
    });
  });

  await asyncTest('9.2.3: created file contains an "instructions" array', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.ok(Array.isArray(parsed.instructions),
        `Expected "instructions" to be an array, got: ${typeof parsed.instructions}`);
    });
  });

  await asyncTest('9.2.4: instructions array is non-empty', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.ok(parsed.instructions.length > 0,
        'instructions array should have at least one entry');
    });
  });

  await asyncTest('9.2.5: every entry is a plain string (OpenCode schema compliance)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const entry of parsed.instructions) {
        assert.strictEqual(typeof entry, 'string',
          `Entry should be a plain string, got ${typeof entry}: ${JSON.stringify(entry)}`);
      }
    });
  });

  await asyncTest('9.2.6: every entry starts with [ma-agents] prefix', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const entry of parsed.instructions) {
        assert.ok(entry.startsWith(`[${MA_AGENTS_SOURCE}]`),
          `Entry should start with [${MA_AGENTS_SOURCE}], got: "${entry.substring(0, 30)}..."`);
      }
    });
  });

  await asyncTest('9.2.7: no extra top-level keys in the written JSON', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const keys = Object.keys(parsed);
      assert.deepStrictEqual(keys, ['instructions'],
        `Expected only ["instructions"] as top-level keys, got: ${JSON.stringify(keys)}`);
    });
  });

  await asyncTest('9.2.8: file uses 2-space indentation', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const raw = fs.readFileSync(filePath, 'utf-8');
      // JSON.stringify(data, null, 2) produces lines starting with "  " (2 spaces) for first level
      assert.ok(raw.includes('  "instructions"'),
        'File should use 2-space indentation (line should start with "  \\"instructions\\"")\nActual content:\n' + raw);
    });
  });

  await asyncTest('9.2.9: instruction text contains skill manifest reference', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      await updateFn(agent, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const allText = parsed.instructions.join('\n');
      assert.ok(allText.includes('MANIFEST.yaml'),
        'Instruction text should reference MANIFEST.yaml');
    });
  });

  await asyncTest('9.2.10: MA_AGENTS_SOURCE constant is "ma-agents"', () => {
    assert.strictEqual(MA_AGENTS_SOURCE, 'ma-agents',
      `MA_AGENTS_SOURCE should equal "ma-agents", got: "${MA_AGENTS_SOURCE}"`);
  });

  await asyncTest('9.2.11: non-json-merge agents are not affected (falls through to markdown logic)', async () => {
    await withTempDir(async (tmpDir) => {
      // A regular markdown agent — should not produce a JSON file
      const markdownAgent = {
        id: 'claude-code',
        name: 'Claude Code',
        category: 'ide',
        instructionFiles: ['.claude/CLAUDE.md'],
        injectionStrategy: { position: 'top', skipPatterns: [] },
        getProjectPath: () => path.join(tmpDir, '.claude', 'skills'),
        getGlobalPath: () => path.join(os.homedir(), '.claude', 'skills')
      };
      await updateFn(markdownAgent, tmpDir);
      // Should NOT create opencode.json
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'opencode.json')), false,
        'Should not create opencode.json for non-json-merge agents');
      // Should create the markdown file instead
      assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.md')),
        'Markdown agent file should be created');
    });
  });

  await asyncTest('9.2.12: file present — user entries preserved, fresh ma-agents string appended', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      // Pre-create a file with a single user entry (plain string, no _source)
      const existingContent = { instructions: ['user instruction'] };
      await fs.writeFile(filePath, JSON.stringify(existingContent, null, 2), 'utf-8');

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const userEntries = parsed.instructions.filter(e => !isMaEntry(e));
      const maEntries = parsed.instructions.filter(e => isMaEntry(e));
      assert.strictEqual(userEntries.length, 1,
        'Existing user entry should be preserved');
      assert.strictEqual(userEntries[0], 'user instruction',
        'User entry value should remain unchanged');
      assert.ok(maEntries.length > 0,
        'Fresh ma-agents entries should be appended');
      assert.strictEqual(typeof maEntries[0], 'string',
        'Fresh ma-agents entry should be a plain string');
    });
  });

  // Print summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
