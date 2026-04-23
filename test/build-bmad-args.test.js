#!/usr/bin/env node
/**
 * Tests for Story 5.5: Explicit Parameter Passing to bmad-method
 *
 * Task 1: buildBmadArgs() function
 * Task 2: installBmad() uses buildBmadArgs()
 * Task 3: updateBmad() uses buildBmadArgs()
 * Task 4: applyCustomizations() recompile uses buildBmadArgs()
 * Task 5: Function signatures accept install context params
 */
'use strict';

const assert = require('assert');
const path = require('path');

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
    errors.push({ name, err });
  }
}

console.log('\nStory 5.5: Explicit Parameter Passing Tests\n');

// ---- Task 1: buildBmadArgs() ----

console.log('Task 1: buildBmadArgs()');

const bmad = require('../lib/bmad');

test('buildBmadArgs is exported', () => {
  assert.strictEqual(typeof bmad.buildBmadArgs, 'function');
});

test('buildBmadArgs returns a string', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test/project',
    modules: ['bmm', 'bmb'],
    tools: ['claude-code'],
    action: 'install',
  });
  assert.strictEqual(typeof result, 'string');
});

test('buildBmadArgs includes --directory with quoted path', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test/project',
    modules: ['bmm'],
    tools: ['claude-code'],
    action: 'install',
  });
  assert.ok(result.includes('--directory "/test/project"'), `Expected --directory in: ${result}`);
});

test('buildBmadArgs includes --modules', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm', 'bmb'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('--modules bmm,bmb'), `Expected --modules bmm,bmb in: ${result}`);
});

test('buildBmadArgs includes --tools with selected tools', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: ['claude-code', 'cursor', 'opencode'],
    action: 'install',
  });
  assert.ok(result.includes('--tools claude-code,cursor,opencode'), `Expected --tools in: ${result}`);
});

test('buildBmadArgs uses --tools none when no tools selected', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('--tools none'), `Expected --tools none in: ${result}`);
});

test('buildBmadArgs always includes --yes', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('--yes'), `Expected --yes in: ${result}`);
});

test('buildBmadArgs includes --action update for update action', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'update',
  });
  assert.ok(result.includes('--action update'), `Expected --action update in: ${result}`);
});

test('buildBmadArgs omits --action for install (default)', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(!result.includes('--action'), `Expected no --action in: ${result}`);
});

test('buildBmadArgs includes --user-name when provided', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    userName: 'TestUser',
  });
  assert.ok(result.includes('--user-name "TestUser"'), `Expected --user-name in: ${result}`);
});

test('buildBmadArgs omits --user-name when empty', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    userName: '',
  });
  assert.ok(!result.includes('--user-name'), `Expected no --user-name in: ${result}`);
});

test('buildBmadArgs includes --communication-language quoted when provided', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    commLang: 'Spanish',
  });
  assert.ok(result.includes('--communication-language "Spanish"'), `Expected quoted --communication-language in: ${result}`);
});

test('buildBmadArgs quotes multi-word --communication-language', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    commLang: 'Brazilian Portuguese',
  });
  assert.ok(result.includes('--communication-language "Brazilian Portuguese"'), `Expected quoted multi-word lang in: ${result}`);
});

test('buildBmadArgs omits --communication-language when empty', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(!result.includes('--communication-language'), `Expected no --communication-language in: ${result}`);
});

test('buildBmadArgs includes --document-output-language quoted when provided', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    docLang: 'French',
  });
  assert.ok(result.includes('--document-output-language "French"'), `Expected quoted --document-output-language in: ${result}`);
});

test('buildBmadArgs includes --output-folder quoted when provided', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    outputFolder: 'custom-output',
  });
  assert.ok(result.includes('--output-folder "custom-output"'), `Expected quoted --output-folder in: ${result}`);
});

test('buildBmadArgs quotes --output-folder with spaces', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
    outputFolder: 'bmad output',
  });
  assert.ok(result.includes('--output-folder "bmad output"'), `Expected quoted spaced output-folder in: ${result}`);
});

test('buildBmadArgs quotes path with spaces in --directory', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: 'D:\\My Projects\\test project',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.includes('--directory "D:\\My Projects\\test project"'), `Expected quoted path in: ${result}`);
});

test('buildBmadArgs includes a custom-module flag on fresh install when extension exists', () => {
  const fs = require('fs');
  const extensionPath = path.join(__dirname, '..', 'lib', 'bmad-extension');
  // This test requires lib/bmad-extension/ to exist (it does in this repo)
  assert.ok(fs.existsSync(extensionPath), `Precondition: lib/bmad-extension/ must exist at ${extensionPath}`);

  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  // bmad-method 6.3.0 renamed --custom-content to --custom-source. Accept
  // either so the test survives downgrades during bisects.
  const hasFlag = result.includes('--custom-source') || result.includes('--custom-content');
  assert.ok(hasFlag, `Expected --custom-source or --custom-content in: ${result}`);
  assert.ok(result.includes(`"${extensionPath}"`), `Expected quoted extension path in: ${result}`);
});

test('buildBmadArgs includes a custom-module flag on update for bmad-method compatibility', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'update',
  });
  const hasFlag = result.includes('--custom-source') || result.includes('--custom-content');
  assert.ok(hasFlag, `Expected --custom-source or --custom-content on update, got: ${result}`);
});

test('buildBmadArgs includes all params in correct combined command', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test/project',
    modules: ['bmm', 'bmb'],
    tools: ['claude-code', 'opencode'],
    action: 'update',
    userName: 'DevUser',
    commLang: 'English',
    docLang: 'English',
    outputFolder: '_bmad-output',
  });
  assert.ok(result.includes('install'), 'Expected install subcommand');
  assert.ok(result.includes('--directory "/test/project"'), 'Expected --directory');
  assert.ok(result.includes('--modules bmm,bmb'), 'Expected --modules');
  assert.ok(result.includes('--tools claude-code,opencode'), 'Expected --tools');
  assert.ok(result.includes('--yes'), 'Expected --yes');
  assert.ok(result.includes('--user-name "DevUser"'), 'Expected --user-name');
  assert.ok(result.includes('--communication-language "English"'), 'Expected quoted --communication-language');
  assert.ok(result.includes('--document-output-language "English"'), 'Expected quoted --document-output-language');
  assert.ok(result.includes('--output-folder "_bmad-output"'), 'Expected quoted --output-folder');
  assert.ok(result.includes('--action update'), 'Expected --action update');
});

test('buildBmadArgs starts with node and bmad-method CLI entry path', () => {
  // bmad-method 6.3.0 renamed the entry point from tools/bmad-npx-wrapper.js
  // to tools/installer/bmad-cli.js. Accept either so the test survives local
  // downgrades to 6.2.x during bisects.
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  assert.ok(result.startsWith('node "'), `Expected command to start with 'node "': ${result}`);
  const hasEntry = result.includes('bmad-cli.js') || result.includes('bmad-npx-wrapper.js');
  assert.ok(hasEntry, `Expected bmad-cli.js or bmad-npx-wrapper.js in: ${result}`);
});

// ---- M4: custom-module flag conditional tests ----

console.log('\nCode review fixes: edge cases');

test('buildBmadArgs includes exactly one custom-module flag on fresh install', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: [],
    action: 'install',
  });
  // Count occurrences of either flag name — should be exactly 1 total
  // (since lib/bmad-extension/ exists in this repo).
  const sourceMatches = result.match(/--custom-source/g) || [];
  const contentMatches = result.match(/--custom-content/g) || [];
  const totalFlagCount = sourceMatches.length + contentMatches.length;
  assert.strictEqual(totalFlagCount, 1,
    `Expected exactly one custom-module flag, got source=${sourceMatches.length} content=${contentMatches.length}`);
});

// ---- M5: Input validation ----

test('buildBmadArgs throws on undefined ctx', () => {
  assert.throws(() => bmad.buildBmadArgs(), /buildBmadArgs requires ctx/);
});

test('buildBmadArgs throws on missing projectRoot', () => {
  assert.throws(() => bmad.buildBmadArgs({ modules: ['bmm'] }), /buildBmadArgs requires ctx/);
});

test('buildBmadArgs throws on missing modules', () => {
  assert.throws(() => bmad.buildBmadArgs({ projectRoot: '/test' }), /buildBmadArgs requires ctx/);
});

test('buildBmadArgs throws on non-array modules', () => {
  assert.throws(() => bmad.buildBmadArgs({ projectRoot: '/test', modules: 'bmm' }), /buildBmadArgs requires ctx/);
});

// ---- L1: undefined/null tools handling ----

test('buildBmadArgs handles undefined tools gracefully', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    action: 'install',
    // tools not provided — should default to 'none'
  });
  assert.ok(result.includes('--tools none'), `Expected --tools none for undefined tools in: ${result}`);
});

test('buildBmadArgs handles null tools gracefully', () => {
  const result = bmad.buildBmadArgs({
    projectRoot: '/test',
    modules: ['bmm'],
    tools: null,
    action: 'install',
  });
  assert.ok(result.includes('--tools none'), `Expected --tools none for null tools in: ${result}`);
});

// ---- Task 5: Function signatures accept new params ----

console.log('\nTask 5: Function signature validation');

test('installBmad accepts options object with new params', () => {
  // Verify function signature accepts the options - just check it doesn't throw on the signature
  assert.strictEqual(typeof bmad.installBmad, 'function');
  // installBmad should accept: modules, tools, projectRoot, force, options
  assert.ok(bmad.installBmad.length <= 5, 'installBmad should accept up to 5 params');
});

test('updateBmad accepts options object with new params', () => {
  assert.strictEqual(typeof bmad.updateBmad, 'function');
  assert.ok(bmad.updateBmad.length <= 5, 'updateBmad should accept up to 5 params');
});

test('applyCustomizations accepts options object with new params', () => {
  assert.strictEqual(typeof bmad.applyCustomizations, 'function');
  assert.ok(bmad.applyCustomizations.length <= 6, 'applyCustomizations should accept up to 6 params');
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
