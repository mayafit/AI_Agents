#!/usr/bin/env node
/**
 * Story 21.5 — Unit + integration tests for the Cline `.clinerules` template
 * extension.
 *
 * AC coverage:
 *   5.1  clinerules.template.md exists with Architect-mode framing (AC #1)
 *   5.2  NFR44 per-file: standard-profile output lacks forbidden strings (AC #7)
 *   5.3  NFR46 per-file: two consecutive installs are byte-identical (AC #5)
 *   5.4  Cross-file identity by construction (AC #2, #6)
 *   5.5  Fresh install writes both Cline files with marker-wrapped content (AC #3, #4)
 *   5.6  User content outside markers preserved byte-for-byte (AC #4)
 *   5.7  On-prem profile — graceful fallback when onprem template absent (AC #8)
 *   5.8  MANIFEST path rendering resolves to .cline/skills/MANIFEST.yaml (AC #9)
 *   5.9  Dual-file drift detection (AC #6)
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

const installerModule = require('../lib/installer');
const {
  composeInstructionBlock,
  ClinerulesDualFileDriftError,
  checkClinerulesDualFileDrift,
  CLINERULES_TEMPLATE_PATH,
  _testUpdateAgentInstructions: updateAgentInstructions
} = installerModule;
const { setProfile } = require('../lib/profile');
const agents = require('../lib/agents');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-clinerules-test-'));
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

function withSilencedLogs(fn) {
  return async (...args) => {
    const origLog = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = origLog; }
  };
}

function extractMarkerInner(text) {
  const m = text.match(/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/);
  return m ? m[1] : null;
}

console.log('\n clinerules template tests (Story 21.5)\n');

async function runAll() {
  // 5.1 — Template existence + framing
  await test('5.1 clinerules.template.md exists with Architect-mode framing (AC #1)', () => {
    assert.ok(fs.existsSync(CLINERULES_TEMPLATE_PATH), 'template file must exist');
    const body = fs.readFileSync(CLINERULES_TEMPLATE_PATH, 'utf-8');
    assert.ok(/# Cline Project Rules/.test(body), 'header "# Cline Project Rules" required');
    assert.ok(/Architect mode/i.test(body), 'Architect-mode framing line required');
    assert.ok(/<!-- MA-AGENTS-START -->/.test(body), 'MA-AGENTS-START marker required');
    assert.ok(/<!-- MA-AGENTS-END -->/.test(body), 'MA-AGENTS-END marker required');
    // AC #7 — framing itself must not contain forbidden local-LLM strings.
    assert.ok(!body.includes('/no_think'), 'framing must not contain /no_think');
    assert.ok(!body.includes('str_replace_editor'), 'framing must not contain str_replace_editor');
    assert.ok(!body.includes('~/.claude/'), 'framing must not contain ~/.claude/');
  });

  // 5.2 — NFR44 per-file: standard-profile output lacks forbidden strings
  await test('5.2 NFR44 — standard profile: neither Cline file contains /no_think, str_replace_editor, ~/.claude/ (AC #7)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      for (const rel of ['.cline/clinerules.md', '.clinerules']) {
        const content = fs.readFileSync(path.join(dir, rel), 'utf-8');
        assert.ok(!content.includes('/no_think'), `${rel} must not contain /no_think`);
        assert.ok(!content.includes('str_replace_editor'), `${rel} must not contain str_replace_editor`);
        assert.ok(!content.includes('~/.claude/'), `${rel} must not contain ~/.claude/`);
      }
    } finally { cleanup(dir); }
  }));

  // 5.3 — NFR46 per-file: two consecutive installs byte-identical
  await test('5.3 NFR46 idempotency: two consecutive installs produce byte-identical files (AC #5)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const firstA = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      const firstB = fs.readFileSync(path.join(dir, '.clinerules'), 'utf-8');
      await updateAgentInstructions(cline, dir);
      const secondA = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      const secondB = fs.readFileSync(path.join(dir, '.clinerules'), 'utf-8');
      assert.strictEqual(firstA, secondA, '.cline/clinerules.md byte-identical across installs');
      assert.strictEqual(firstB, secondB, '.clinerules byte-identical across installs');
    } finally { cleanup(dir); }
  }));

  // 5.4 — Cross-file identity by construction (AC #2, #6)
  await test('5.4 Cross-file identity: marker-block content is byte-identical between .cline/clinerules.md and .clinerules (AC #2)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const innerA = extractMarkerInner(fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8'));
      const innerB = extractMarkerInner(fs.readFileSync(path.join(dir, '.clinerules'), 'utf-8'));
      assert.ok(innerA != null && innerB != null, 'both files contain marker blocks');
      assert.strictEqual(innerA, innerB, 'cross-file marker-block byte-identity (AC #2)');
    } finally { cleanup(dir); }
  }));

  // 5.5 — Fresh install writes both Cline files
  await test('5.5 Fresh install writes both .cline/clinerules.md and .clinerules with marker-wrapped content (AC #3, #4)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      for (const rel of ['.cline/clinerules.md', '.clinerules']) {
        const p = path.join(dir, rel);
        assert.ok(fs.existsSync(p), `${rel} must be created`);
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('<!-- MA-AGENTS-START -->'), `${rel} has start marker`);
        assert.ok(content.includes('<!-- MA-AGENTS-END -->'), `${rel} has end marker`);
        // Composed content present
        assert.ok(content.includes('# AI Agent Skills - Planning Instruction'), `${rel} has composer content`);
        assert.ok(content.includes('Respond in TEXT vs. create FILES'), `${rel} has text-vs-file rules`);
        // Cline framing on fresh install
        assert.ok(content.includes('# Cline Project Rules'), `${rel} has Cline framing header`);
        assert.ok(/Architect mode/i.test(content), `${rel} has Architect-mode guidance`);
      }
    } finally { cleanup(dir); }
  }));

  // 5.6 — User content outside markers preserved
  await test('5.6 User content outside markers preserved byte-for-byte across two installs (AC #4)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      const before = '# My personal cline rules\n\nUser preamble.\n\n';
      const after = '\n## Trailing user section\n\nMore notes.\n';
      const preMarker = '<!-- MA-AGENTS-START -->\nSTALE\n<!-- MA-AGENTS-END -->';
      // Seed both files with identical marker-block content (so drift check passes)
      // but different surrounding user content.
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'), before + preMarker + after, 'utf-8');
      const beforeB = '# .clinerules preamble\n\nB preamble.\n\n';
      const afterB = '\n## B trailing\n\nB notes.\n';
      fs.writeFileSync(path.join(dir, '.clinerules'), beforeB + preMarker + afterB, 'utf-8');
      await updateAgentInstructions(cline, dir);
      await updateAgentInstructions(cline, dir);
      const finalA = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      const finalB = fs.readFileSync(path.join(dir, '.clinerules'), 'utf-8');
      assert.ok(finalA.startsWith(before), '.cline/clinerules.md pre-marker preserved');
      assert.ok(finalA.endsWith(after), '.cline/clinerules.md post-marker preserved');
      assert.ok(finalB.startsWith(beforeB), '.clinerules pre-marker preserved');
      assert.ok(finalB.endsWith(afterB), '.clinerules post-marker preserved');
      assert.ok(!finalA.includes('STALE'), 'stale marker content replaced in A');
      assert.ok(!finalB.includes('STALE'), 'stale marker content replaced in B');
    } finally { cleanup(dir); }
  }));

  // 5.7a — On-prem profile with onprem template absent: throws (composer contract)
  await test('5.7a On-prem profile without onprem template: composer throws (Story 21.2 AC #3)', () => {
    assert.throws(
      () => composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() }),
      /instruction-block-onprem\.template\.md is missing/
    );
  });

  // 5.8 — MANIFEST_PATH resolves to .cline/skills/MANIFEST.yaml (forward-slashed)
  await test('5.8 MANIFEST_PATH resolves to .cline/skills/MANIFEST.yaml in both Cline files (AC #9)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      for (const rel of ['.cline/clinerules.md', '.clinerules']) {
        const content = fs.readFileSync(path.join(dir, rel), 'utf-8');
        assert.ok(content.includes('.cline/skills/MANIFEST.yaml'),
          `${rel} must reference .cline/skills/MANIFEST.yaml (forward-slashed)`);
        assert.ok(!content.includes('{{MANIFEST_PATH}}'),
          `${rel} must not contain unreplaced placeholder`);
        // Windows path separator must not leak.
        assert.ok(!content.includes('.cline\\skills\\MANIFEST.yaml'),
          `${rel} must not contain back-slashed path`);
      }
    } finally { cleanup(dir); }
  }));

  // 5.9a — Drift detection: identical marker blocks proceed silently
  await test('5.9a Drift detection: both files with identical marker blocks → install proceeds', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      // Re-install should not throw: both files are identical by construction.
      await updateAgentInstructions(cline, dir);
    } finally { cleanup(dir); }
  }));

  // 5.9b — Drift detection: divergent marker blocks → throws
  await test('5.9b Drift detection: divergent marker blocks throw ClinerulesDualFileDriftError (AC #6)', () => {
    const dir = mktemp();
    try {
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'),
        '<!-- MA-AGENTS-START -->\nAAA\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      fs.writeFileSync(path.join(dir, '.clinerules'),
        '<!-- MA-AGENTS-START -->\nBBB\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      assert.throws(
        () => checkClinerulesDualFileDrift(dir),
        (err) => {
          assert.ok(err instanceof ClinerulesDualFileDriftError, 'must be ClinerulesDualFileDriftError');
          assert.ok(err.message.includes('.cline/clinerules.md'));
          assert.ok(err.message.includes('.clinerules'));
          assert.ok(err.message.includes('AAA') || err.diff.includes('AAA'), 'diff includes divergent content A');
          assert.ok(err.message.includes('BBB') || err.diff.includes('BBB'), 'diff includes divergent content B');
          return true;
        }
      );
    } finally { cleanup(dir); }
  });

  // 5.9c — `--yes` does NOT bypass drift (AC #6 explicit exception)
  await test('5.9c --yes does NOT bypass drift detection (AC #6 exception)', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'),
        '<!-- MA-AGENTS-START -->\nAAA\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      fs.writeFileSync(path.join(dir, '.clinerules'),
        '<!-- MA-AGENTS-START -->\nBBB\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      const cline = agents.getAgent('cline');
      const origYes = process.env.MA_AGENTS_YES;
      process.env.MA_AGENTS_YES = '1';
      try {
        let threw = false;
        try {
          const origLog = console.log;
          console.log = () => {};
          try { await updateAgentInstructions(cline, dir, { yesMode: true }); }
          finally { console.log = origLog; }
        } catch (err) {
          threw = true;
          assert.ok(err instanceof ClinerulesDualFileDriftError,
            `expected ClinerulesDualFileDriftError, got ${err.name}`);
        }
        assert.ok(threw, '--yes must not bypass drift check');
      } finally {
        if (origYes === undefined) delete process.env.MA_AGENTS_YES;
        else process.env.MA_AGENTS_YES = origYes;
      }
    } finally { cleanup(dir); }
  });

  // 5.9d — Only one of the two files exists → drift detection skipped
  await test('5.9d Drift detection skipped when only one Cline file exists; install writes both', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      // Seed only .clinerules with a hand-edit; .cline/clinerules.md absent.
      fs.writeFileSync(path.join(dir, '.clinerules'),
        '<!-- MA-AGENTS-START -->\nEXISTING\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      const cline = agents.getAgent('cline');
      // Should NOT throw — only one file present means drift check is skipped.
      // It will, however, trigger the marker-block drift handler for .clinerules
      // (Story 21.2 AC #10). That needs yesMode to not hang.
      await updateAgentInstructions(cline, dir, { yesMode: true });
      assert.ok(fs.existsSync(path.join(dir, '.cline', 'clinerules.md')),
        '.cline/clinerules.md created');
      assert.ok(fs.existsSync(path.join(dir, '.clinerules')),
        '.clinerules still present');
    } finally { cleanup(dir); }
  }));

  // Extra — confirm the composer output is embedded exactly once in each file
  await test('5.10 Composer output appears exactly once inside each Cline file marker block', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      for (const rel of ['.cline/clinerules.md', '.clinerules']) {
        const content = fs.readFileSync(path.join(dir, rel), 'utf-8');
        const occurrences = (content.match(/# AI Agent Skills - Planning Instruction/g) || []).length;
        assert.strictEqual(occurrences, 1,
          `${rel} must contain composer output exactly once`);
      }
    } finally { cleanup(dir); }
  }));

  console.log(`\n ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`   ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
