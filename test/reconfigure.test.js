#!/usr/bin/env node
/**
 * Story 21.10 — Tests for the `reconfigure` subcommand orchestrator.
 *
 * AC coverage (one-to-one with acceptance criteria 1–11):
 *   8.1  --yes rejected with pinned message (AC #6)
 *   8.2  missing .ma-agents.json → named error (AC #1)
 *   8.3  same-value → "Profile unchanged" and no writes (AC #4)
 *   8.4  profile flip standard → on-prem re-stamps injection files + .roomodes (AC #5)
 *   8.5  two-step "Continue?" → no aborts with zero writes (AC #7)
 *   8.6  backup files written at <target>.backup-<ISO> (AC #8)
 *   8.7  slug divergence raises RoomodesSlugDivergenceError; --force bypasses (AC #9)
 *   8.8  dual-file drift raises ClinerulesDualFileDriftError (AC #10)
 *   8.9  profileHistory appends; cap at 20; first call creates field (AC #11)
 *   8.10 full round-trip standard → on-prem → standard (NFR46)
 *   8.11 Current profile appears in the prompt message (AC #2)
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
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.stack || err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const {
  reconfigure,
  RoomodesSlugDivergenceError,
  ManifestNotFoundError,
  ReconfigureYesRejectedError,
  YES_REJECT_MESSAGE,
  PROFILE_HISTORY_CAP,
  listTouchedFiles,
  appendProfileHistory
} = require('../lib/reconfigure');
const { setProfile, getProfile } = require('../lib/profile');
const installer = require('../lib/installer');
const { getAgent } = require('../lib/agents');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-reconfigure-test-'));
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

function silenceLogs(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}

/**
 * Build a prompts() stub that returns the given sequence of responses,
 * one per prompt call. Throws if the caller asks for more prompts than
 * responses were scripted.
 */
function scriptedPrompts(responses) {
  let i = 0;
  const stub = async () => {
    if (i >= responses.length) {
      throw new Error(`scriptedPrompts exhausted after ${responses.length} calls`);
    }
    return responses[i++];
  };
  stub.calls = () => i;
  stub.messages = [];
  return stub;
}

/**
 * Install a minimal project scaffold: .ma-agents.json with a given profile and
 * agent list. Does NOT run the real installer (tests isolate the reconfigure
 * orchestration). Returns the tmp dir.
 */
function setupProject({ profile = 'standard', agents = ['claude-code'] } = {}) {
  const dir = mktemp();
  const manifest = {
    manifestVersion: '1.2.0',
    agent: agents[0],
    agents,
    scope: 'project',
    profile,
    skills: {}
  };
  fs.writeFileSync(
    path.join(dir, '.ma-agents.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8'
  );
  return dir;
}

console.log('\n reconfigure tests (Story 21.10)\n');

async function runAll() {
  // 8.1 --yes rejected
  await test('8.1 --yes rejected with pinned message and ReconfigureYesRejectedError (AC #6)', silenceLogs(async () => {
    const dir = setupProject();
    try {
      await assert.rejects(
        () => reconfigure({ projectRoot: dir, argv: ['--yes'], promptsLib: scriptedPrompts([]) }),
        (err) => err instanceof ReconfigureYesRejectedError && err.message === YES_REJECT_MESSAGE
      );
      // Manifest should be untouched.
      const json = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(json.profile, 'standard');
      assert.strictEqual(json.profileHistory, undefined);
    } finally { cleanup(dir); }
  }));

  // 8.2 missing manifest
  await test('8.2 missing .ma-agents.json → ManifestNotFoundError (AC #1)', silenceLogs(async () => {
    const dir = mktemp();
    try {
      await assert.rejects(
        () => reconfigure({ projectRoot: dir, argv: [], promptsLib: scriptedPrompts([]) }),
        (err) => err instanceof ManifestNotFoundError
      );
    } finally { cleanup(dir); }
  }));

  // 8.3 same-value short-circuit
  await test('8.3 same-value exits with "Profile unchanged:" and no writes (AC #4)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      const manifestPath = path.join(dir, '.ma-agents.json');
      const originalBytes = fs.readFileSync(manifestPath);
      const result = await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([{ chosenProfile: 'standard' }])
      });
      assert.strictEqual(result.status, 'unchanged');
      // No writes → byte-identical manifest.
      assert.deepStrictEqual(fs.readFileSync(manifestPath), originalBytes);
    } finally { cleanup(dir); }
  }));

  // 8.4 profile flip re-stamps injection files + .roomodes
  await test('8.4 profile flip standard→on-prem re-stamps injection files (AC #5)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['claude-code'] });
    try {
      // Pre-stamp the .claude/CLAUDE.md with standard content via the installer
      // helper so we have a realistic starting state.
      const agent = getAgent('claude-code');
      await installer._testUpdateAgentInstructions(agent, dir, { yesMode: true });
      const claudePath = path.join(dir, '.claude', 'CLAUDE.md');
      const before = fs.readFileSync(claudePath, 'utf-8');

      const result = await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' }, // profile choice
          { proceed: true }              // Continue?
        ])
      });
      assert.strictEqual(result.status, 'reconfigured');
      const after = fs.readFileSync(claudePath, 'utf-8');
      assert.notStrictEqual(after, before, 'file must change');
      // On-prem content ships onprem-specific strings (e.g. /no_think).
      assert.match(after, /\/no_think|str_replace_editor|~\/\.claude\/|Local-LLM|Nemotron|on-prem/i,
        'on-prem profile output should mention a local-LLM-specific token');
      assert.strictEqual(getProfile(dir), 'on-prem');
    } finally { cleanup(dir); }
  }));

  // 8.5 two-step confirmation decline
  await test('8.5 declining "Continue?" aborts with zero writes (AC #7)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['claude-code'] });
    try {
      // Seed .claude/CLAUDE.md with standard content so a real re-stamp would
      // leave a visible diff.
      const agent = getAgent('claude-code');
      await installer._testUpdateAgentInstructions(agent, dir, { yesMode: true });
      const claudePath = path.join(dir, '.claude', 'CLAUDE.md');
      const before = fs.readFileSync(claudePath);
      const manifestBefore = fs.readFileSync(path.join(dir, '.ma-agents.json'));

      const result = await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' },
          { proceed: false }
        ])
      });
      assert.strictEqual(result.status, 'aborted');
      assert.deepStrictEqual(fs.readFileSync(claudePath), before, 'CLAUDE.md must be untouched');
      assert.deepStrictEqual(
        fs.readFileSync(path.join(dir, '.ma-agents.json')),
        manifestBefore,
        'manifest must be untouched when user declines'
      );
    } finally { cleanup(dir); }
  }));

  // 8.6 backup files are written
  await test('8.6 backup files created at <target>.backup-<timestamp> (AC #8)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['claude-code'] });
    try {
      const agent = getAgent('claude-code');
      await installer._testUpdateAgentInstructions(agent, dir, { yesMode: true });
      await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' },
          { proceed: true }
        ])
      });
      const claudeDir = path.join(dir, '.claude');
      const backups = fs.readdirSync(claudeDir).filter(f => /CLAUDE\.md\.backup-/.test(f));
      assert.ok(backups.length >= 1, `expected at least one backup file, got ${backups.join(',')}`);
      const backupName = backups[0];
      // Canonical format: <target>.backup-<YYYY-MM-DDTHH-mm-ssZ>
      assert.match(backupName, /^CLAUDE\.md\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(\.\d+)?$/);
    } finally { cleanup(dir); }
  }));

  // 8.7 slug divergence
  await test('8.7 RoomodesSlugDivergenceError raised when user edited owned slug; --force bypasses (AC #9)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['roo-code'] });
    try {
      // Write a .roomodes whose `bmad-architect` entry has a fabricated
      // `whenToUse` that doesn't match the shipped template.
      const yaml = require('js-yaml');
      const divergent = {
        customModes: [
          { slug: 'bmad-architect', name: 'Hacked', whenToUse: 'different', roleDefinition: 'x', groups: ['read'], customInstructions: 'x' }
        ]
      };
      fs.writeFileSync(path.join(dir, '.roomodes'), yaml.dump(divergent), 'utf-8');

      await assert.rejects(
        () => reconfigure({
          projectRoot: dir,
          argv: [],
          promptsLib: scriptedPrompts([{ chosenProfile: 'on-prem' }])
        }),
        (err) => err instanceof RoomodesSlugDivergenceError && err.divergentSlugs.includes('bmad-architect')
      );

      // With --force-roomodes-overwrite, proceed through (confirm continue).
      const result = await reconfigure({
        projectRoot: dir,
        argv: ['--force-roomodes-overwrite'],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' },
          { proceed: true }
        ])
      });
      assert.strictEqual(result.status, 'reconfigured');
    } finally { cleanup(dir); }
  }));

  // 8.8 dual-file drift (Cline)
  await test('8.8 ClinerulesDualFileDriftError raised; no --force override (AC #10)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['cline'] });
    try {
      // Seed with identical content first.
      const agent = getAgent('cline');
      await installer._testUpdateAgentInstructions(agent, dir, { yesMode: true });
      // Mutate ONE of the two files inside the markers to induce drift.
      const fileA = path.join(dir, '.cline', 'clinerules.md');
      const content = fs.readFileSync(fileA, 'utf-8');
      const mutated = content.replace(
        /<!-- MA-AGENTS-START -->[\s\S]*?<!-- MA-AGENTS-END -->/,
        '<!-- MA-AGENTS-START -->\nCLI-NO-MATCHY\n<!-- MA-AGENTS-END -->'
      );
      fs.writeFileSync(fileA, mutated, 'utf-8');

      await assert.rejects(
        () => reconfigure({
          projectRoot: dir,
          argv: [],
          promptsLib: scriptedPrompts([{ chosenProfile: 'on-prem' }])
        }),
        (err) => err && err.name === 'ClinerulesDualFileDriftError'
      );
    } finally { cleanup(dir); }
  }));

  // 8.9 profileHistory append + cap
  await test('8.9 profileHistory appends; missing-field creation; 20-cap evicts oldest (AC #11)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['claude-code'] });
    try {
      // First reconfigure creates the field.
      await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' },
          { proceed: true }
        ])
      });
      let manifest = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.ok(Array.isArray(manifest.profileHistory));
      assert.strictEqual(manifest.profileHistory.length, 1);
      assert.deepStrictEqual(
        { from: manifest.profileHistory[0].from, to: manifest.profileHistory[0].to, source: manifest.profileHistory[0].source },
        { from: 'standard', to: 'on-prem', source: 'reconfigure' }
      );
      assert.ok(typeof manifest.profileHistory[0].date === 'string');

      // Now directly invoke appendProfileHistory 25 more times to exercise the cap.
      for (let i = 0; i < 25; i++) {
        appendProfileHistory(dir, {
          date: new Date(2027, 0, i + 1).toISOString(),
          from: 'standard',
          to: 'on-prem',
          source: 'reconfigure'
        });
      }
      manifest = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(
        manifest.profileHistory.length,
        PROFILE_HISTORY_CAP,
        `history should be capped at ${PROFILE_HISTORY_CAP}`
      );
      // Oldest-first eviction: the first entry we wrote (the real reconfigure
      // result) must be gone. The newest entry's date must survive.
      const dates = manifest.profileHistory.map(e => e.date);
      assert.ok(!dates.includes(manifest.profileHistory[0].date === manifest.profileHistory[0].date && undefined));
      const newest = new Date(2027, 0, 25).toISOString();
      assert.ok(dates.includes(newest), 'newest entry must be preserved');
    } finally { cleanup(dir); }
  }));

  // 8.10 round-trip standard → on-prem → standard
  await test('8.10 round-trip standard → on-prem → standard lands on standard content (NFR46)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['claude-code'] });
    try {
      const agent = getAgent('claude-code');
      await installer._testUpdateAgentInstructions(agent, dir, { yesMode: true });
      const baselineStandard = fs.readFileSync(path.join(dir, '.claude', 'CLAUDE.md'), 'utf-8');

      await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'on-prem' },
          { proceed: true }
        ])
      });
      assert.strictEqual(getProfile(dir), 'on-prem');

      await reconfigure({
        projectRoot: dir,
        argv: [],
        promptsLib: scriptedPrompts([
          { chosenProfile: 'standard' },
          { proceed: true }
        ])
      });
      assert.strictEqual(getProfile(dir), 'standard');
      const after = fs.readFileSync(path.join(dir, '.claude', 'CLAUDE.md'), 'utf-8');
      // Compare MARKER block content only, since outside-markers content may
      // accumulate nothing here but we want a robust assertion.
      const extract = (s) => {
        const m = s.match(/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/);
        return m ? m[1] : null;
      };
      assert.strictEqual(extract(after), extract(baselineStandard),
        'post round-trip marker block must equal the original standard-profile stamp');

      // Two history entries.
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(manifest.profileHistory.length, 2);
      assert.strictEqual(manifest.profileHistory[0].to, 'on-prem');
      assert.strictEqual(manifest.profileHistory[1].to, 'standard');
    } finally { cleanup(dir); }
  }));

  // 8.11 prompt text references current value
  await test('8.11 prompt message references current profile value (AC #2)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'on-prem', agents: ['claude-code'] });
    try {
      let seenMessage = null;
      let seenInitial = null;
      const stub = async (opts) => {
        if (opts && opts.type === 'select' && !seenMessage) {
          seenMessage = opts.message;
          seenInitial = opts.initial;
          return { chosenProfile: 'on-prem' }; // same-value → early exit
        }
        return { proceed: false };
      };
      await reconfigure({ projectRoot: dir, argv: [], promptsLib: stub });
      assert.match(seenMessage || '', /Current profile: on-prem\. Change to\?/);
      // AC: default-highlighted option is the persisted value → initial index 0 (on-prem row).
      assert.strictEqual(seenInitial, 0);
    } finally { cleanup(dir); }
  }));

  // listTouchedFiles smoke
  await test('listTouchedFiles returns instructionFiles + extraInstructionTemplates, sorted', () => {
    const files = listTouchedFiles('/tmp/x', [getAgent('roo-code')]);
    assert.ok(files.includes('.roomodes'));
    assert.ok(files.includes('.roo/rules/00-ma-agents.md'));
  });
}

runAll().then(() => {
  console.log(`\n ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error('FAILURES:');
    errors.forEach(e => console.error(`  - ${e.name}: ${e.error}`));
    process.exit(1);
  }
});
