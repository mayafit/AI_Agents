#!/usr/bin/env node
/**
 * Story 7.4 — Unit + subprocess tests for bin/cli.js
 *
 * Two layers, both safe (no real installs, no interactive prompts):
 *
 *   Unit (in-process):
 *     parseFlags() is exported from bin/cli.js and main() is guarded by
 *     `require.main === module`, so requiring the module does NOT execute the
 *     CLI. We assert against the REAL returned shape:
 *       { globalFlag, forceFlag, yesFlag, agentFlag, customPath,
 *         bmadModulesFlag, bmadModulesPrompt, scope, positional }
 *
 *   Subprocess (command routing):
 *     execFileSync(process.execPath, ['bin/cli.js', ...]) for NON-mutating,
 *     non-interactive commands only: --help, --version, list, agents,
 *     list --mandatory. Unknown commands fall through to the interactive
 *     wizard (would block on stdin) and are therefore NOT exercised here.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

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

// Safe to require: main() is gated behind `require.main === module`.
const { parseFlags } = require('../bin/cli');
const PKG = require('../package.json');
const VERSION = PKG.version;
const NAME = PKG.name;

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'cli.js');

// Run the CLI as a child process. Returns { code, stdout, stderr }.
// stdin is ignored so a stray interactive prompt can never block the run.
function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    // execFileSync throws on non-zero exit; surface status + captured output.
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : ''
    };
  }
}

console.log('\n cli flag-parsing + routing tests\n');

async function runAll() {
  // ─── Unit: parseFlags ───

  // 7.4.1 — --yes sets yesFlag (NOT a `{yes:true}` shape)
  await test('7.4.1 parseFlags(["--yes"]) sets yesFlag true, others default', () => {
    const r = parseFlags(['--yes']);
    assert.strictEqual(r.yesFlag, true);
    assert.strictEqual(r.forceFlag, false);
    assert.strictEqual(r.globalFlag, false);
    assert.strictEqual(r.agentFlag, '');
    assert.strictEqual(r.scope, 'project');
    assert.deepStrictEqual(r.positional, []);
  });

  // 7.4.2 — --force sets forceFlag
  await test('7.4.2 parseFlags(["--force"]) sets forceFlag true', () => {
    const r = parseFlags(['--force']);
    assert.strictEqual(r.forceFlag, true);
    assert.strictEqual(r.yesFlag, false);
    assert.deepStrictEqual(r.positional, []);
  });

  // 7.4.3 — --agent <name> captures agentFlag and consumes both tokens
  await test('7.4.3 parseFlags(["--agent","claude-code"]) sets agentFlag and removes it from positional', () => {
    const r = parseFlags(['--agent', 'claude-code']);
    assert.strictEqual(r.agentFlag, 'claude-code');
    assert.deepStrictEqual(r.positional, [], '--agent and its value must not leak into positional');
  });

  // 7.4.4 — empty args → all defaults; scope project
  await test('7.4.4 parseFlags([]) returns all-default shape with scope "project"', () => {
    const r = parseFlags([]);
    assert.strictEqual(r.globalFlag, false);
    assert.strictEqual(r.forceFlag, false);
    assert.strictEqual(r.yesFlag, false);
    assert.strictEqual(r.agentFlag, '');
    assert.strictEqual(r.customPath, '');
    assert.strictEqual(r.bmadModulesFlag, '');
    assert.strictEqual(r.bmadModulesPrompt, false);
    assert.strictEqual(r.scope, 'project');
    assert.deepStrictEqual(r.positional, []);
  });

  // 7.4.5 — --global flips scope to "global"
  await test('7.4.5 parseFlags(["--global"]) sets globalFlag true and scope "global"', () => {
    const r = parseFlags(['--global']);
    assert.strictEqual(r.globalFlag, true);
    assert.strictEqual(r.scope, 'global');
  });

  // 7.4.6 — positionals survive; flags are stripped from positional
  await test('7.4.6 parseFlags(["code-review","claude-code","--yes"]) keeps positionals, strips flags', () => {
    const r = parseFlags(['code-review', 'claude-code', '--yes']);
    assert.strictEqual(r.yesFlag, true);
    assert.deepStrictEqual(r.positional, ['code-review', 'claude-code']);
  });

  // 7.4.7 — exported return shape has the exact documented keys
  await test('7.4.7 parseFlags returns the exact documented key set', () => {
    const r = parseFlags([]);
    assert.deepStrictEqual(
      Object.keys(r).sort(),
      ['agentFlag', 'bmadModulesFlag', 'bmadModulesPrompt', 'customPath',
       'forceFlag', 'globalFlag', 'positional', 'scope', 'yesFlag'].sort()
    );
  });

  // ─── Subprocess: command routing (non-mutating, non-interactive) ───

  // 7.4.8 — --version → exit 0, prints package.json version
  await test('7.4.8 "--version" exits 0 and prints the package.json version', () => {
    const r = runCli(['--version']);
    assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
    assert.ok(r.stdout.includes(VERSION), `output should contain version ${VERSION}; got: ${r.stdout}`);
    assert.ok(r.stdout.includes(NAME), `output should contain name ${NAME}; got: ${r.stdout}`);
  });

  // 7.4.9 — --help → exit 0, lists the documented command names
  await test('7.4.9 "--help" exits 0 and lists install/uninstall/status/list commands', () => {
    const r = runCli(['--help']);
    assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
    for (const cmd of ['install', 'uninstall', 'status', 'list']) {
      assert.ok(r.stdout.includes(cmd), `help should mention "${cmd}"; got: ${r.stdout}`);
    }
  });

  // 7.4.10 — list → exit 0, prints the skills listing header
  await test('7.4.10 "list" exits 0 and renders the skills listing (header + a real skill row)', () => {
    const r = runCli(['list']);
    assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
    assert.ok(/Available Skills/i.test(r.stdout), `expected skills listing; got: ${r.stdout}`);
    // Assert an actual skill ROW renders, not just the header — guards against a
    // regression that empties the skills listing yet still prints the header + exit 0.
    assert.ok(/\bcode-review\b/.test(r.stdout), `expected a known skill (code-review) in listing; got: ${r.stdout}`);
  });

  // 7.4.11 — list --mandatory → exit 0, prints the mandatory-skills header.
  // NOTE: the story guessed "list --skills"; the REAL filter subflag is
  // "--mandatory". Skills listing is the `list` command itself.
  await test('7.4.11 "list --mandatory" exits 0 and prints the mandatory-skills header', () => {
    const r = runCli(['list', '--mandatory']);
    assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
    assert.ok(/Mandatory Skills/i.test(r.stdout), `expected mandatory listing; got: ${r.stdout}`);
  });

  // 7.4.12 — agents → exit 0, prints the supported-agents listing.
  // NOTE: the story guessed "list --agents"; the REAL command is `agents`
  // (alias `list-agents`). It lists agents without network or install.
  await test('7.4.12 "agents" exits 0 and renders the agents listing (header + a real agent row)', () => {
    const r = runCli(['agents']);
    assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
    assert.ok(/Supported Agents/i.test(r.stdout), `expected agents listing; got: ${r.stdout}`);
    // Assert an actual agent ROW renders, not just the header — guards against a
    // regression that empties the agent registry yet still prints the header + exit 0.
    assert.ok(/\bclaude-code\b/.test(r.stdout), `expected a known agent (claude-code) in listing; got: ${r.stdout}`);
  });

  // ─── Report ───
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll();
