#!/usr/bin/env node
/**
 * Tests for Story 9.4: JSON Injection — Handle Invalid opencode.json Gracefully
 *
 * Validates that updateAgentInstructions() recovers non-fatally when
 * opencode.json contains invalid JSON: logs an error, leaves the file
 * byte-identical, and continues processing subsequent agents.
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
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma-agents-json-error-test-'));
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

// Helper: build a generic markdown agent (simulates "someOtherAgent")
function createMarkdownAgent(projectRoot, fileName) {
  return {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'ide',
    instructionFiles: [fileName],
    injectionStrategy: { position: 'top', skipPatterns: [] },
    getProjectPath: () => path.join(projectRoot, '.claude', 'skills'),
    getGlobalPath: () => path.join(os.homedir(), '.claude', 'skills')
  };
}

// The corrupt JSON fixture content
const CORRUPT_JSON = 'not valid json {{{';

// ─── Fixture A: corrupt opencode.json ─────────────────────────────────────────

console.log('\nStory 9.4 — JSON error handling: corrupt opencode.json');

(async () => {
  await asyncTest('9.4.1: file is byte-identical after run with corrupt JSON (not modified)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');

      // Write the corrupt fixture
      await fs.writeFile(filePath, CORRUPT_JSON, 'utf-8');
      const beforeBytes = fs.readFileSync(filePath);

      await updateFn(agent, tmpDir);

      const afterBytes = fs.readFileSync(filePath);
      assert.ok(
        beforeBytes.equals(afterBytes),
        `File content changed after corrupt-JSON run.\nBefore: ${beforeBytes.toString()}\nAfter:  ${afterBytes.toString()}`
      );
    });
  });

  await asyncTest('9.4.2: console.error is called with the file path on parse failure', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await fs.writeFile(filePath, CORRUPT_JSON, 'utf-8');

      const errorMessages = [];
      const origError = console.error;
      console.error = (...args) => errorMessages.push(args.join(' '));
      try {
        await updateFn(agent, tmpDir);
      } finally {
        console.error = origError;
      }

      assert.ok(errorMessages.length > 0, 'console.error should have been called');
      const combined = errorMessages.join('\n');
      assert.ok(
        combined.includes(filePath),
        `Error message should contain the file path "${filePath}".\nActual messages: ${combined}`
      );
    });
  });

  await asyncTest('9.4.3: console.error message describes the parse failure', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await fs.writeFile(filePath, CORRUPT_JSON, 'utf-8');

      const errorMessages = [];
      const origError = console.error;
      console.error = (...args) => errorMessages.push(args.join(' '));
      try {
        await updateFn(agent, tmpDir);
      } finally {
        console.error = origError;
      }

      const combined = errorMessages.join('\n');
      // The message must mention that file was not modified
      assert.ok(
        combined.toLowerCase().includes('not modified') || combined.toLowerCase().includes('file not modified'),
        `Error message should state the file was not modified.\nActual messages: ${combined}`
      );
      // The message must include a parse/error description (err.message from JSON.parse)
      assert.ok(
        combined.toLowerCase().includes('parse') ||
        combined.toLowerCase().includes('token') ||
        combined.toLowerCase().includes('json') ||
        combined.toLowerCase().includes('unexpected'),
        `Error message should describe the parse failure.\nActual messages: ${combined}`
      );
    });
  });

  await asyncTest('9.4.4: no .tmp file is left on disk after parse failure', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await fs.writeFile(filePath, CORRUPT_JSON, 'utf-8');

      const origError = console.error;
      console.error = () => {};
      try {
        await updateFn(agent, tmpDir);
      } finally {
        console.error = origError;
      }

      const tmpPath = filePath + '.tmp';
      assert.strictEqual(
        fs.existsSync(tmpPath),
        false,
        '.tmp file should not exist after a parse-failure run'
      );
    });
  });

  // ─── Fixture B: continuation test (CRITICAL) ────────────────────────────────

  console.log('\nStory 9.4 — JSON error handling: continuation after error (Fixture B)');

  await asyncTest('9.4.5: subsequent agent instruction file IS updated after OpenCode parse failure', async () => {
    await withTempDir(async (tmpDir) => {
      // 1. Set up OpenCode with corrupt JSON
      const opencodeAgent = createOpenCodeAgent(tmpDir);
      const opencodeFilePath = path.join(tmpDir, 'opencode.json');
      await fs.writeFile(opencodeFilePath, CORRUPT_JSON, 'utf-8');

      // 2. Set up a second markdown agent whose file does not yet exist
      const otherFileName = '.claude/CLAUDE.md';
      const otherAgent = createMarkdownAgent(tmpDir, otherFileName);
      const otherFilePath = path.join(tmpDir, otherFileName);

      // Suppress console.error during this test
      const origError = console.error;
      console.error = () => {};
      try {
        // 3. Run both agents in sequence — simulating what the install loop does
        await updateFn(opencodeAgent, tmpDir);
        await updateFn(otherAgent, tmpDir);
      } finally {
        console.error = origError;
      }

      // 4. OpenCode file must be unchanged (still corrupt)
      const opencodeBytes = fs.readFileSync(opencodeFilePath, 'utf-8');
      assert.strictEqual(
        opencodeBytes,
        CORRUPT_JSON,
        'opencode.json should remain byte-identical (corrupt) after error'
      );

      // 5. The other agent's instruction file MUST have been created/updated
      assert.ok(
        fs.existsSync(otherFilePath),
        `Second agent's instruction file "${otherFileName}" should have been created after OpenCode error`
      );
      const otherContent = fs.readFileSync(otherFilePath, 'utf-8');
      assert.ok(
        otherContent.includes('MA-AGENTS-START') || otherContent.includes('MANIFEST.yaml'),
        `Second agent's instruction file should contain injected content.\nActual: ${otherContent}`
      );
    });
  });

  await asyncTest('9.4.6: updateAgentInstructions does not throw on corrupt JSON (non-fatal)', async () => {
    await withTempDir(async (tmpDir) => {
      const agent = createOpenCodeAgent(tmpDir);
      const filePath = path.join(tmpDir, 'opencode.json');
      await fs.writeFile(filePath, CORRUPT_JSON, 'utf-8');

      const origError = console.error;
      console.error = () => {};
      let threw = false;
      try {
        await updateFn(agent, tmpDir);
      } catch (err) {
        threw = true;
      } finally {
        console.error = origError;
      }

      assert.strictEqual(
        threw,
        false,
        'updateAgentInstructions() must NOT throw when JSON.parse fails — error must be non-fatal'
      );
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
