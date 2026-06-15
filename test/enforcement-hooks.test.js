#!/usr/bin/env node
/**
 * Tests for Story 8.5: Per-Agent Enforcement Hooks Research
 *
 * Tests the Claude Code hook deployment/removal in installer.js
 * and the verify-manifest.js hook script.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const { deployClaudeCodeHook, removeClaudeCodeHook } = require('../lib/installer');

// Helper to create a temp directory for each test
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
}

/**
 * Helper: run the hook script with JSON input via a temp file piped to stdin.
 * Works cross-platform (avoids shell quoting issues with echo).
 */
function runHookWithInput(inputObj) {
  const hs = path.join(__dirname, '..', 'lib', 'hooks', 'claude-code', 'verify-manifest.js');
  const tmpInput = path.join(os.tmpdir(), `hook-input-${Date.now()}.json`);
  fs.writeFileSync(tmpInput, typeof inputObj === 'string' ? inputObj : JSON.stringify(inputObj), 'utf-8');
  try {
    return execSync(`node "${hs}" < "${tmpInput}"`, {
      encoding: 'utf-8',
      timeout: 5000
    });
  } finally {
    fs.removeSync(tmpInput);
  }
}

// ─── Task 1: deployClaudeCodeHook() tests ───────────────────────────────────

console.log('\nTask 1 — deployClaudeCodeHook()');

asyncTest('1.1: creates settings.json with hook when file does not exist', async () => {
  const tmpDir = createTempDir();
  try {
    await deployClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    assert.ok(fs.existsSync(settingsPath), 'settings.json should be created');

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.ok(settings.hooks, 'hooks key should exist');
    assert.ok(settings.hooks.SessionStart, 'SessionStart hooks should exist');
    assert.strictEqual(settings.hooks.SessionStart.length, 1);
    assert.strictEqual(settings.hooks.SessionStart[0].matcher, 'startup');
    assert.strictEqual(settings.hooks.SessionStart[0].hooks[0].type, 'command');
    assert.ok(settings.hooks.SessionStart[0].hooks[0].command.includes('verify-manifest.js'));
  } finally {
    fs.removeSync(tmpDir);
  }
}).then(() =>

// Bug 27.8 — the hook command must resolve in a real install. The installer
// copies the dependency-free hook into the target's .claude/hooks/ and points
// the command at $CLAUDE_PROJECT_DIR/.claude/hooks/verify-manifest.js (NOT the
// package's own lib/ which is never copied into the target).
asyncTest('1.1b: copies hook into target .claude/hooks and points command there', async () => {
  const tmpDir = createTempDir();
  try {
    await deployClaudeCodeHook(tmpDir);

    const hookTarget = path.join(tmpDir, '.claude', 'hooks', 'verify-manifest.js');
    assert.ok(fs.existsSync(hookTarget), 'verify-manifest.js should be copied into target .claude/hooks');

    const settings = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf-8'));
    const cmd = settings.hooks.SessionStart[0].hooks[0].command;
    assert.ok(
      cmd.includes('$CLAUDE_PROJECT_DIR/.claude/hooks/verify-manifest.js'),
      `command should point at the copied target, got: ${cmd}`
    );
    assert.ok(!cmd.includes('lib/hooks'), 'command must NOT reference the package lib/hooks path');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

// Bug 27.8 — migrate an install that still carries the dead legacy command.
asyncTest('1.1c: migrates legacy lib/hooks command to the copied-target command', async () => {
  const tmpDir = createTempDir();
  try {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.ensureDir(settingsDir);
    await fs.writeFile(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: 'node "$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js"',
                  _id: 'ma-agents-verify-manifest'
                }
              ]
            }
          ]
        }
      }, null, 2),
      'utf-8'
    );

    await deployClaudeCodeHook(tmpDir);

    const settings = JSON.parse(fs.readFileSync(path.join(settingsDir, 'settings.json'), 'utf-8'));
    assert.strictEqual(settings.hooks.SessionStart.length, 1, 'legacy entry should be migrated in place, not duplicated');
    const cmd = settings.hooks.SessionStart[0].hooks[0].command;
    assert.ok(cmd.includes('.claude/hooks/verify-manifest.js'), 'legacy command should be rewritten to the copied target');
    assert.ok(!cmd.includes('lib/hooks'), 'legacy lib/hooks command should be gone');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

asyncTest('1.2: preserves existing settings when adding hook', async () => {
  const tmpDir = createTempDir();
  try {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.ensureDir(settingsDir);
    const existingSettings = {
      permissions: {
        allow: ['Bash(node:*)']
      },
      someOtherSetting: true
    };
    await fs.writeFile(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(existingSettings, null, 2),
      'utf-8'
    );

    await deployClaudeCodeHook(tmpDir);

    const settings = JSON.parse(fs.readFileSync(path.join(settingsDir, 'settings.json'), 'utf-8'));
    assert.ok(settings.permissions, 'existing permissions should be preserved');
    assert.deepStrictEqual(settings.permissions.allow, ['Bash(node:*)']);
    assert.strictEqual(settings.someOtherSetting, true);
    assert.ok(settings.hooks.SessionStart, 'hook should be added');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

asyncTest('1.3: preserves existing hooks when adding our hook', async () => {
  const tmpDir = createTempDir();
  try {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.ensureDir(settingsDir);
    const existingSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup',
            hooks: [{ type: 'command', command: 'echo "existing hook"' }]
          }
        ],
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo "pre-tool"' }]
          }
        ]
      }
    };
    await fs.writeFile(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(existingSettings, null, 2),
      'utf-8'
    );

    await deployClaudeCodeHook(tmpDir);

    const settings = JSON.parse(fs.readFileSync(path.join(settingsDir, 'settings.json'), 'utf-8'));
    assert.strictEqual(settings.hooks.SessionStart.length, 2, 'should have 2 SessionStart hook groups');
    assert.ok(settings.hooks.PreToolUse, 'PreToolUse hooks should be preserved');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

asyncTest('1.4: is idempotent — does not duplicate hook on second call', async () => {
  const tmpDir = createTempDir();
  try {
    await deployClaudeCodeHook(tmpDir);
    await deployClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.strictEqual(settings.hooks.SessionStart.length, 1, 'should not duplicate hook');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() => {

// ─── Task 2: removeClaudeCodeHook() tests ──────────────────────────────────

console.log('\nTask 2 — removeClaudeCodeHook()');

return asyncTest('2.1: removes our hook while preserving other hooks', async () => {
  const tmpDir = createTempDir();
  try {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.ensureDir(settingsDir);

    // Deploy our hook first
    await deployClaudeCodeHook(tmpDir);

    // Add another hook manually
    const settingsPath = path.join(settingsDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    settings.hooks.SessionStart.unshift({
      matcher: 'startup',
      hooks: [{ type: 'command', command: 'echo "other hook"' }]
    });
    settings.hooks.PreToolUse = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo "bash"' }] }];
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    await removeClaudeCodeHook(tmpDir);

    const updated = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.strictEqual(updated.hooks.SessionStart.length, 1, 'should keep other SessionStart hook');
    assert.ok(updated.hooks.PreToolUse, 'PreToolUse hooks should be preserved');
    assert.ok(!updated.hooks.SessionStart[0].hooks[0].command.includes('verify-manifest'), 'our hook should be removed');
  } finally {
    fs.removeSync(tmpDir);
  }
});

}).then(() =>

asyncTest('2.2: cleans up empty hooks object when last hook removed', async () => {
  const tmpDir = createTempDir();
  try {
    await deployClaudeCodeHook(tmpDir);
    await removeClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.ok(!settings.hooks, 'hooks key should be removed when empty');
    // Bug 27.8 — the copied hook file must be removed on uninstall too.
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'verify-manifest.js')),
      'copied verify-manifest.js should be removed on uninstall'
    );
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

asyncTest('2.3: no-op when settings.json does not exist', async () => {
  const tmpDir = createTempDir();
  try {
    // Should not throw
    await removeClaudeCodeHook(tmpDir);
    assert.ok(!fs.existsSync(path.join(tmpDir, '.claude', 'settings.json')));
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() => {

// ─── Task 3: verify-manifest.js hook script tests ──────────────────────────

console.log('\nTask 3 — verify-manifest.js hook script');

return asyncTest('3.1: outputs reminder when MANIFEST.yaml exists', async () => {
  const tmpDir = createTempDir();
  try {
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    await fs.ensureDir(skillsDir);
    await fs.writeFile(path.join(skillsDir, 'MANIFEST.yaml'), '# test manifest\n', 'utf-8');

    const result = runHookWithInput({ cwd: tmpDir, session_id: 'test', hook_event_name: 'SessionStart' });

    assert.ok(result.includes('SKILL ENFORCEMENT ACTIVE'), 'should output enforcement reminder');
    assert.ok(result.includes('MANIFEST.yaml'), 'should reference MANIFEST.yaml');
  } finally {
    fs.removeSync(tmpDir);
  }
});

}).then(() =>

asyncTest('3.2: silent when no MANIFEST.yaml exists', async () => {
  const tmpDir = createTempDir();
  try {
    const result = runHookWithInput({ cwd: tmpDir, session_id: 'test', hook_event_name: 'SessionStart' });
    assert.strictEqual(result.trim(), '', 'should produce no output when no manifest');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() =>

asyncTest('3.3: exits 0 on malformed JSON input', async () => {
  const tmpDir = createTempDir();
  try {
    // Pipe invalid JSON — should exit 0 (not crash)
    const result = runHookWithInput('not json at all');
    // If we get here, exit code was 0
    assert.ok(true, 'should exit 0 on malformed input');
  } finally {
    fs.removeSync(tmpDir);
  }
})).then(() => {

// ─── Task 4: Technical note document exists ─────────────────────────────────

console.log('\nTask 4 — Technical note document');

test('4.1: enforcement-hooks-research.md exists', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'technical-notes', 'enforcement-hooks-research.md');
  assert.ok(fs.existsSync(docPath), 'technical note should exist');
});

test('4.2: document contains agent summary table', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'technical-notes', 'enforcement-hooks-research.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  assert.ok(content.includes('| Agent |'), 'should contain agent summary table');
  assert.ok(content.includes('Claude Code'), 'should reference Claude Code');
  assert.ok(content.includes('Cursor'), 'should reference Cursor');
  assert.ok(content.includes('GitHub Copilot'), 'should reference GitHub Copilot');
  assert.ok(content.includes('Gemini'), 'should reference Gemini');
  assert.ok(content.includes('Cline'), 'should reference Cline');
  assert.ok(content.includes('Kilocode'), 'should reference Kilocode');
  assert.ok(content.includes('Antigravity'), 'should reference Antigravity');
  assert.ok(content.includes('BMAD'), 'should reference BMAD agents');
});

test('4.3: document contains recommendations section', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'technical-notes', 'enforcement-hooks-research.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  assert.ok(content.includes('## Recommendations'), 'should contain recommendations section');
});

test('4.4: document contains prototype implementation section', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'technical-notes', 'enforcement-hooks-research.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  assert.ok(content.includes('Prototype Implementation'), 'should contain prototype section');
  assert.ok(content.includes('verify-manifest'), 'should reference the hook script');
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  process.exit(1);
}

});
