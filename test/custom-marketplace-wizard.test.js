#!/usr/bin/env node
/**
 * Story 30.6a — wizard plumbing tests: `--bmad-custom-source` flag parsing
 * and `promptCustomMarketplace()` (the Y/N prompt + enumerate + NFR71
 * warning + ma-agents' OWN multiselect, FR239-FR241).
 *
 * Scope reminder: `promptCustomMarketplace()` only returns a selection
 * (`{ source, mode, selectedCodes, plugins }`) — it never stages or installs
 * anything. Story 30.6b consumes the return value.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const prompts = require('prompts');

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

const { parseFlags, promptCustomMarketplace } = require('../bin/cli.js');

const FIXTURE_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-wizard-test');

function makeDiscoveryFixture(name, plugins) {
  const dir = path.join(FIXTURE_ROOT, name);
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name, owner: 'ma-agents-test', plugins })
  );
  return './' + path.relative(process.cwd(), dir).split(path.sep).join('/');
}

(async () => {
  console.log('\nbin/cli.parseFlags(--bmad-custom-source ...)');

  await test('captures --bmad-custom-source value and strips it from positional', () => {
    const result = parseFlags(['--bmad-custom-source', './org-marketplace', 'skill-id']);
    assert.strictEqual(result.bmadCustomSourceFlag, './org-marketplace');
    assert.deepStrictEqual(result.positional, ['skill-id']);
  });

  await test('captures a Git URL value verbatim', () => {
    const result = parseFlags(['--bmad-custom-source', 'git@git.intra.example:team/bmad-marketplace.git']);
    assert.strictEqual(result.bmadCustomSourceFlag, 'git@git.intra.example:team/bmad-marketplace.git');
  });

  await test('defaults to empty string when omitted', () => {
    const result = parseFlags(['--yes']);
    assert.strictEqual(result.bmadCustomSourceFlag, '');
  });

  await test('coexists with --bmad-modules and --yes', () => {
    const result = parseFlags(['--yes', '--bmad-modules', 'tea,bmb', '--bmad-custom-source', './src']);
    assert.strictEqual(result.yesFlag, true);
    assert.strictEqual(result.bmadModulesFlag, 'tea,bmb');
    assert.strictEqual(result.bmadCustomSourceFlag, './src');
    assert.deepStrictEqual(result.positional, []);
  });

  console.log('\nbin/cli.promptCustomMarketplace() — NFR70 "off by default"');

  await test('--yes with no flag: returns null without any prompt (byte-identical-to-baseline path)', async () => {
    const result = await promptCustomMarketplace({ bmadCustomSourceFlag: '', yesFlag: true });
    assert.strictEqual(result, null);
  });

  await test('interactive, user answers "N": returns null without asking for a source', async () => {
    prompts.inject([false]);
    const result = await promptCustomMarketplace({ bmadCustomSourceFlag: '', yesFlag: false });
    assert.strictEqual(result, null);
  });

  await test('interactive, user answers "Y" but enters a blank source: returns null', async () => {
    prompts.inject([true, '   ']);
    const result = await promptCustomMarketplace({ bmadCustomSourceFlag: '', yesFlag: false });
    assert.strictEqual(result, null);
  });

  console.log('\nbin/cli.promptCustomMarketplace() — enumerate + ma-agents\' own multiselect (FR240)');

  await test('--bmad-custom-source + --yes: auto-selects every declared plugin', async () => {
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    try {
      const source = makeDiscoveryFixture('yes-fixture', [
        { name: 'alpha-mod', description: 'Alpha', source: './alpha', skills: [] },
        { name: 'beta-mod', description: 'Beta', source: './beta', skills: [] },
      ]);
      const result = await promptCustomMarketplace({ bmadCustomSourceFlag: source, yesFlag: true });
      assert.ok(result, 'expected a selection object');
      assert.strictEqual(result.source, source);
      assert.deepStrictEqual([...result.selectedCodes].sort(), ['alpha-mod', 'beta-mod']);
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('interactive: Y + source text + multiselect subset → returns exactly the chosen subset', async () => {
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    try {
      const source = makeDiscoveryFixture('multiselect-fixture', [
        { name: 'alpha-mod', description: 'Alpha', source: './alpha', skills: [] },
        { name: 'beta-mod', description: 'Beta', source: './beta', skills: [] },
        { name: 'gamma-mod', description: 'Gamma', source: './gamma', skills: [] },
      ]);
      // Answers, in prompt order: confirm(Y) -> text(source) -> multiselect([alpha,gamma])
      prompts.inject([true, source, ['alpha-mod', 'gamma-mod']]);
      const result = await promptCustomMarketplace({ bmadCustomSourceFlag: '', yesFlag: false });
      assert.ok(result);
      assert.strictEqual(result.mode, 'discovery');
      assert.deepStrictEqual([...result.selectedCodes].sort(), ['alpha-mod', 'gamma-mod']);
      assert.strictEqual(result.plugins.length, 3, 'full enumerated list is still returned for 30.6b context');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('interactive: user cancels the multiselect (Escape) → returns null', async () => {
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    try {
      const source = makeDiscoveryFixture('cancel-fixture', [
        { name: 'alpha-mod', description: 'Alpha', source: './alpha', skills: [] },
      ]);
      prompts.inject([true, source, undefined]);
      const result = await promptCustomMarketplace({ bmadCustomSourceFlag: '', yesFlag: false });
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nbin/cli.promptCustomMarketplace() — fail clean on an unreachable source (never throws to the caller)');

  await test('--bmad-custom-source pointing at an unreachable source: resolves to null, does not throw', async () => {
    // Network-free: a nonexistent local path drives the same fail-clean path
    // an unreachable Git remote would (enumerateCustomSource rejects; the
    // wizard swallows it and returns null so the base install is unaffected).
    const result = await promptCustomMarketplace({
      bmadCustomSourceFlag: './.tmp-does-not-exist-30-6a-wizard/marketplace',
      yesFlag: true,
    });
    assert.strictEqual(result, null, 'an unreachable custom source must not abort the rest of the install');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => {
      console.log(`  ${name}:`);
      console.log(`    ${error}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
})();
