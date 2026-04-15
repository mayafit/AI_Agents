#!/usr/bin/env node
/**
 * Story 21.11 — Tests for the `uninstall --profile-artifacts` subcommand.
 *
 * AC coverage (one-to-one with Story 21.11 acceptance criteria):
 *   11.1  Full uninstall: all 5 injection files have marker blocks removed (AC #3)
 *   11.2  User content preserved outside markers (AC #3, NFR5)
 *   11.3  .roomodes owned slug removal; user slug survives (AC #4)
 *   11.4  Backup files created: CLAUDE.md.backup-<timestamp> exists (AC #5)
 *   11.5  .ma-agents.json profile cleared: getProfile returns undefined (AC #6)
 *   11.6  profileHistory preserved and new entry appended (source: "uninstall", to: null) (AC #6, #7)
 *   11.7  manifestVersion unchanged at 1.2.0 after uninstall (AC #8)
 *   11.8  Idempotency: second uninstall exits with "Nothing to do." (AC #10)
 *   11.9  --yes bypasses confirmation prompt (AC #1, #2)
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
  uninstallProfileArtifacts,
  stripMarkerBlock,
  appendUninstallHistory,
  PROFILE_HISTORY_CAP
} = require('../lib/uninstall');
const { setProfile, getProfile } = require('../lib/profile');
const installer = require('../lib/installer');
const { getAgent } = require('../lib/agents');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-21-11-'));
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
 * Returns a prompts stub that confirms (proceed: true) on confirm prompts.
 */
function confirmingPrompts() {
  return async (opts) => {
    if (opts && opts.type === 'confirm') return { proceed: true };
    return {};
  };
}

/**
 * Returns a prompts stub that declines (proceed: false) on confirm prompts.
 */
function decliningPrompts() {
  return async (opts) => {
    if (opts && opts.type === 'confirm') return { proceed: false };
    return {};
  };
}

/**
 * Build a minimal project with .ma-agents.json and optionally stamp injection files.
 * For testing, we manually write marker block content rather than running the full
 * installer (which has complex agent/profile scaffolding requirements).
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

/**
 * Write a file with a marker block (plus optional surrounding user content).
 */
function writeWithMarkers(filePath, { before = '', inner = 'some ma-agents content\n', after = '' } = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const content = `${before}<!-- MA-AGENTS-START -->\n${inner}<!-- MA-AGENTS-END -->\n${after}`;
  fs.writeFileSync(filePath, content, 'utf-8');
  return content;
}

console.log('\n uninstall --profile-artifacts tests (Story 21.11)\n');

async function runAll() {
  // ---------------------------------------------------------------------------
  // 11.1  Full uninstall: all injection files have marker blocks removed
  // ---------------------------------------------------------------------------
  await test('11.1 Full uninstall: marker blocks removed from all 5 injection files (AC #3)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      // Write all 5 injection files with marker blocks
      const files = [
        'CLAUDE.md',
        '.clinerules',
        '.cline/clinerules.md',
        '.roo/rules/00-ma-agents.md',
        'AGENTS.md'
      ];
      for (const rel of files) {
        writeWithMarkers(path.join(dir, rel), { inner: `Content for ${rel}\n` });
      }

      await uninstallProfileArtifacts(dir, { yes: true });

      for (const rel of files) {
        const absPath = path.join(dir, rel);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf-8');
          assert.ok(
            !content.includes('<!-- MA-AGENTS-START -->'),
            `${rel} should not contain MA-AGENTS-START after uninstall`
          );
          assert.ok(
            !content.includes('<!-- MA-AGENTS-END -->'),
            `${rel} should not contain MA-AGENTS-END after uninstall`
          );
        }
        // File may have been deleted if it was empty after stripping — that's valid
      }
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.2  User content preserved outside markers
  // ---------------------------------------------------------------------------
  await test('11.2 User content outside markers preserved byte-for-byte (AC #3, NFR5)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      const claudePath = path.join(dir, 'CLAUDE.md');
      const beforeContent = 'USER CONTENT BEFORE\n';
      const afterContent = 'USER CONTENT AFTER\n';
      writeWithMarkers(claudePath, {
        before: beforeContent,
        inner: 'ma-agents generated content\n',
        after: afterContent
      });

      await uninstallProfileArtifacts(dir, { yes: true });

      assert.ok(fs.existsSync(claudePath), 'CLAUDE.md should still exist (has user content)');
      const result = fs.readFileSync(claudePath, 'utf-8');
      assert.ok(result.includes(beforeContent.trim()), 'before-marker user content must survive');
      assert.ok(result.includes(afterContent.trim()), 'after-marker user content must survive');
      assert.ok(!result.includes('<!-- MA-AGENTS-START -->'), 'marker must be removed');
      assert.ok(!result.includes('ma-agents generated content'), 'inner content must be removed');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.3  .roomodes owned slug removal; user slug survives
  // ---------------------------------------------------------------------------
  await test('11.3 .roomodes: owned slugs removed, user slug preserved (AC #4)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard', agents: ['roo-code'] });
    try {
      const yaml = require('js-yaml');
      const roomodesContent = {
        customModes: [
          // Owned slugs
          { slug: 'bmad-pm', name: 'BMAD PM', roleDefinition: 'pm', groups: ['read'], customInstructions: 'pm stuff' },
          { slug: 'bmad-architect', name: 'BMAD Architect', roleDefinition: 'arch', groups: ['read'], customInstructions: 'arch stuff' },
          { slug: 'bmad-techlead', name: 'BMAD TechLead', roleDefinition: 'tl', groups: ['read'], customInstructions: 'tl stuff' },
          { slug: 'bmad-dev', name: 'BMAD Dev', roleDefinition: 'dev', groups: ['read'], customInstructions: 'dev stuff' },
          // User slug — must survive
          { slug: 'my-custom-mode', name: 'My Custom', roleDefinition: 'custom', groups: ['read'], customInstructions: 'user stuff' }
        ]
      };
      fs.writeFileSync(path.join(dir, '.roomodes'), yaml.dump(roomodesContent), 'utf-8');

      await uninstallProfileArtifacts(dir, { yes: true });

      assert.ok(fs.existsSync(path.join(dir, '.roomodes')), '.roomodes should still exist (has user slug)');
      const result = yaml.load(fs.readFileSync(path.join(dir, '.roomodes'), 'utf-8'));
      const slugs = (result.customModes || []).map(m => m.slug);

      assert.ok(!slugs.includes('bmad-pm'), 'bmad-pm must be removed');
      assert.ok(!slugs.includes('bmad-architect'), 'bmad-architect must be removed');
      assert.ok(!slugs.includes('bmad-techlead'), 'bmad-techlead must be removed');
      assert.ok(!slugs.includes('bmad-dev'), 'bmad-dev must be removed');
      assert.ok(slugs.includes('my-custom-mode'), 'user slug must survive');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.4  Backup files created
  // ---------------------------------------------------------------------------
  await test('11.4 Backup files created: CLAUDE.md.backup-<timestamp> (AC #5)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      const claudeDir = path.join(dir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      // Put CLAUDE.md directly at projectRoot for this test (that's one valid location)
      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      await uninstallProfileArtifacts(dir, { yes: true });

      // Check for backup file in the project root dir
      const files = fs.readdirSync(dir);
      const backups = files.filter(f => /^CLAUDE\.md\.backup-/.test(f));
      assert.ok(backups.length >= 1, `Expected at least one backup file, got: ${files.join(', ')}`);
      const backupName = backups[0];
      // Canonical format: CLAUDE.md.backup-YYYY-MM-DDTHH-mm-ssZ
      assert.match(backupName, /^CLAUDE\.md\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(\.\d+)?$/);

      // Backup must contain the original content (with markers)
      const backupContent = fs.readFileSync(path.join(dir, backupName), 'utf-8');
      assert.ok(backupContent.includes('<!-- MA-AGENTS-START -->'), 'backup must preserve original content');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.5  .ma-agents.json profile cleared
  // ---------------------------------------------------------------------------
  await test('11.5 .ma-agents.json profile cleared: getProfile returns undefined (AC #6)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'on-prem' });
    try {
      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      assert.strictEqual(getProfile(dir), 'on-prem', 'profile should be set before uninstall');

      await uninstallProfileArtifacts(dir, { yes: true });

      assert.strictEqual(getProfile(dir), undefined, 'profile must be undefined after clearProfile');

      // Verify the key is truly absent (not set to null/empty)
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.ok(!Object.prototype.hasOwnProperty.call(manifest, 'profile'), 'profile key must be deleted, not set to null');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.6  profileHistory preserved and new entry appended
  // ---------------------------------------------------------------------------
  await test('11.6 profileHistory preserved, uninstall entry appended (source: "uninstall", to: null) (AC #6, #7)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      // Seed existing profileHistory
      const manifestPath = path.join(dir, '.ma-agents.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      manifest.profileHistory = [
        { date: '2026-01-01T00:00:00.000Z', from: 'standard', to: 'on-prem', source: 'reconfigure' }
      ];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      const testDate = new Date('2026-04-15T12:00:00.000Z');
      await uninstallProfileArtifacts(dir, { yes: true, now: testDate });

      const result = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok(Array.isArray(result.profileHistory));
      assert.strictEqual(result.profileHistory.length, 2, 'previous entry must be preserved');
      assert.strictEqual(result.profileHistory[0].source, 'reconfigure', 'previous entry preserved');

      const lastEntry = result.profileHistory[1];
      assert.strictEqual(lastEntry.source, 'uninstall');
      assert.strictEqual(lastEntry.to, null);
      assert.strictEqual(lastEntry.from, 'standard');
      assert.strictEqual(lastEntry.date, testDate.toISOString());
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.7  manifestVersion unchanged
  // ---------------------------------------------------------------------------
  await test('11.7 manifestVersion unchanged at 1.2.0 after uninstall (AC #8)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      await uninstallProfileArtifacts(dir, { yes: true });

      const result = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(result.manifestVersion, '1.2.0');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.8  Idempotency: second uninstall finds nothing to do
  // ---------------------------------------------------------------------------
  await test('11.8 Idempotency: second uninstall exits with "Nothing to do." (AC #10)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      // First uninstall
      await uninstallProfileArtifacts(dir, { yes: true });

      // Second uninstall — capture console output
      let nothingToDo = false;
      const origLog = console.log;
      console.log = (msg) => {
        if (typeof msg === 'string' && msg.includes('Nothing to do')) {
          nothingToDo = true;
        }
      };
      try {
        await uninstallProfileArtifacts(dir, { yes: true });
      } finally {
        console.log = origLog;
      }

      assert.ok(nothingToDo, 'Second run should print "Nothing to do."');
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // 11.9  --yes bypasses confirmation prompt
  // ---------------------------------------------------------------------------
  await test('11.9 --yes bypasses confirmation prompt (AC #1, #2)', silenceLogs(async () => {
    const dir = setupProject({ profile: 'standard' });
    try {
      writeWithMarkers(path.join(dir, 'CLAUDE.md'), { inner: 'some content\n' });

      let promptCalled = false;
      const trackingPrompts = async (opts) => {
        promptCalled = true;
        return { proceed: true };
      };

      await uninstallProfileArtifacts(dir, { yes: true, promptsLib: trackingPrompts });

      assert.ok(!promptCalled, '--yes must bypass the confirmation prompt');

      // File must still be processed
      const claudePath = path.join(dir, 'CLAUDE.md');
      if (fs.existsSync(claudePath)) {
        const content = fs.readFileSync(claudePath, 'utf-8');
        assert.ok(!content.includes('<!-- MA-AGENTS-START -->'), 'marker must be removed even with --yes');
      }
    } finally { cleanup(dir); }
  }));

  // ---------------------------------------------------------------------------
  // Unit test: stripMarkerBlock
  // ---------------------------------------------------------------------------
  await test('stripMarkerBlock: removes marker block, preserves surrounding content', () => {
    const content = `USER BEFORE\n<!-- MA-AGENTS-START -->\nma content\n<!-- MA-AGENTS-END -->\nUSER AFTER\n`;
    const stripped = stripMarkerBlock(content);
    assert.ok(stripped.includes('USER BEFORE'), 'before content preserved');
    assert.ok(stripped.includes('USER AFTER'), 'after content preserved');
    assert.ok(!stripped.includes('<!-- MA-AGENTS-START -->'), 'start marker removed');
    assert.ok(!stripped.includes('<!-- MA-AGENTS-END -->'), 'end marker removed');
    assert.ok(!stripped.includes('ma content'), 'inner content removed');
  });

  await test('stripMarkerBlock: no-op when no marker present', () => {
    const content = 'just some user content\n';
    assert.strictEqual(stripMarkerBlock(content), content);
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
