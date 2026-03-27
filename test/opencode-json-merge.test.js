#!/usr/bin/env node
/**
 * Tests for Story 9.3: JSON Injection — Merge Into Existing opencode.json
 *
 * Validates that updateAgentInstructions() merges skill instructions into an
 * existing opencode.json without destroying user configuration.
 *
 * Updated: instructions entries are now plain strings (OpenCode schema compliance).
 * Legacy object-format entries ({ _source, text }) are cleaned up during merge.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

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

// Load functions under test
const {
  _testUpdateAgentInstructions: updateFn,
  _MA_AGENTS_SOURCE: MA_AGENTS_SOURCE
} = require('../lib/installer');

// Helper: create a temporary directory, run fn, then clean up
async function withTempDir(fn) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma-agents-json-merge-test-'));
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

// Helper: check if an entry is an ma-agents entry (new string or legacy object format)
function isMaEntry(entry) {
  return (typeof entry === 'string' && entry.startsWith(`[${MA_AGENTS_SOURCE}]`)) ||
    (typeof entry === 'object' && entry != null && entry._source === MA_AGENTS_SOURCE);
}

// Helper: create a fixture opencode.json with mixed entries and extra top-level key
// Includes a legacy object-format ma-agents entry to test backward compat cleanup
async function writeFixture(filePath) {
  const fixture = {
    theme: 'dark',
    instructions: [
      'user instruction',
      'another user instruction',
      { _source: MA_AGENTS_SOURCE, text: 'old instruction' }
    ]
  };
  await fs.writeFile(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
}

// ─── Merge path tests (file present) ─────────────────────────────────────────

console.log('\nStory 9.3 — JSON injection: file-present merge path');

(async () => {
  await asyncTest('9.3.1: user entries are preserved (count = 2)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const userEntries = parsed.instructions.filter(e => !isMaEntry(e));
      assert.strictEqual(userEntries.length, 2,
        `Expected 2 user entries, got ${userEntries.length}`);
    });
  });

  await asyncTest('9.3.2: original user entry values are intact', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const userEntries = parsed.instructions.filter(e => !isMaEntry(e));
      assert.strictEqual(userEntries[0], 'user instruction',
        `First user entry should be "user instruction", got: ${JSON.stringify(userEntries[0])}`);
      assert.strictEqual(userEntries[1], 'another user instruction',
        `Second user entry should be "another user instruction", got: ${JSON.stringify(userEntries[1])}`);
    });
  });

  await asyncTest('9.3.3: legacy object-format ma-agents entry is removed', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const legacyEntry = parsed.instructions.find(
        e => typeof e === 'object' && e != null && e._source === MA_AGENTS_SOURCE
      );
      assert.strictEqual(legacyEntry, undefined,
        'Legacy object-format ma-agents entry should have been removed');
    });
  });

  await asyncTest('9.3.4: fresh ma-agents entry is a plain string', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const freshEntries = parsed.instructions.filter(e => isMaEntry(e));
      assert.ok(freshEntries.length > 0,
        'At least one fresh ma-agents entry should be present');
      for (const entry of freshEntries) {
        assert.strictEqual(typeof entry, 'string',
          `Fresh entry should be a plain string, got ${typeof entry}: ${JSON.stringify(entry)}`);
        assert.ok(entry.startsWith(`[${MA_AGENTS_SOURCE}]`),
          `Fresh entry should start with [${MA_AGENTS_SOURCE}]`);
      }
    });
  });

  await asyncTest('9.3.5: fresh ma-agents entries are at the end', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const instructions = parsed.instructions;
      let lastUserIdx = -1;
      let firstMaIdx = -1;
      for (let i = 0; i < instructions.length; i++) {
        if (isMaEntry(instructions[i])) {
          if (firstMaIdx === -1) firstMaIdx = i;
        } else {
          lastUserIdx = i;
        }
      }
      assert.ok(firstMaIdx > lastUserIdx,
        `Fresh ma-agents entries (first at index ${firstMaIdx}) should appear after all user entries (last at index ${lastUserIdx})`);
    });
  });

  await asyncTest('9.3.6: theme key is preserved with value "dark"', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.strictEqual(parsed.theme, 'dark',
        `Expected theme to be "dark", got: ${JSON.stringify(parsed.theme)}`);
    });
  });

  await asyncTest('9.3.7: output is valid JSON', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

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

  await asyncTest('9.3.8: no .tmp file left on disk after successful write', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const tmpPath = filePath + '.tmp';
      assert.strictEqual(fs.existsSync(tmpPath), false,
        '.tmp file should not exist after successful write');
    });
  });

  await asyncTest('9.3.9: file with no instructions key gets key initialized before merge', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      // Write a valid JSON with no instructions key
      await fs.writeFile(filePath, JSON.stringify({ theme: 'light' }, null, 2), 'utf-8');

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.ok(Array.isArray(parsed.instructions),
        'instructions key should be initialized as an array');
      assert.ok(parsed.instructions.length > 0,
        'instructions array should have fresh ma-agents entries');
      assert.strictEqual(parsed.theme, 'light',
        'Other keys should be preserved unchanged');
    });
  });

  await asyncTest('9.3.10: re-running installer replaces old ma-agents entries, not accumulates', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      // Run twice
      await updateFn(agent, tmpDir);
      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const maEntries = parsed.instructions.filter(e => isMaEntry(e));
      // Should have same count as after first run (no accumulation)
      await withTempDir(async (tmpDir2) => {
        const agent2 = createOpenCodeAgent(tmpDir2);
        const filePath2 = path.join(tmpDir2, 'opencode.json');
        await writeFixture(filePath2);
        await updateFn(agent2, tmpDir2);
        const parsed2 = JSON.parse(fs.readFileSync(filePath2, 'utf-8'));
        const maEntries2 = parsed2.instructions.filter(e => isMaEntry(e));
        assert.strictEqual(maEntries.length, maEntries2.length,
          `Running installer twice should not accumulate ma-agents entries. Got ${maEntries.length} after 2 runs, ${maEntries2.length} after 1 run`);
      });
    });
  });

  await asyncTest('9.3.11: null entries in instructions array are filtered out safely (null-guard)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      // Hand-edited file with null entry, a valid user entry, and a legacy ma-agents object
      const fixture = { instructions: [null, 'user entry', { _source: MA_AGENTS_SOURCE, text: 'old ma-entry' }] };
      await fs.writeFile(filePath, JSON.stringify(fixture, null, 2), 'utf-8');

      await updateFn(agent, tmpDir);

      const result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // null should be filtered out — only user entry + fresh ma-agents string remain
      assert.ok(!result.instructions.includes(null), 'null entry should be removed from instructions array');
      const userEntries = result.instructions.filter(e => e != null && !isMaEntry(e));
      assert.strictEqual(userEntries.length, 1, 'valid user entry should be preserved');
      const maEntries = result.instructions.filter(e => isMaEntry(e));
      assert.ok(maEntries.length > 0, 'fresh ma-agents entry should be present');
      assert.strictEqual(typeof maEntries[0], 'string', 'fresh ma-agents entry should be a plain string');
    });
  });

  await asyncTest('9.3.12: all entries in output are plain strings (OpenCode schema compliance)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await writeFixture(filePath);

      await updateFn(agent, tmpDir);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const entry of parsed.instructions) {
        assert.strictEqual(typeof entry, 'string',
          `All entries should be plain strings for OpenCode compatibility, got ${typeof entry}: ${JSON.stringify(entry)}`);
      }
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
