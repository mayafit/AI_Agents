#!/usr/bin/env node
/**
 * Story 21.5 — Unit + integration tests for the Cline `.clinerules` template
 * extension.
 *
 * AC coverage:
 *   5.1  clinerules.template.md exists with Architect-mode framing (AC #1)
 *   5.2  NFR44 per-file: standard-profile output lacks forbidden strings (AC #7)
 *   5.3  NFR46 per-file: two consecutive installs are byte-identical (AC #5)
 *   5.4  Installer writes .cline/clinerules.md with marker-wrapped content (AC #3)
 *   5.5  Installer does NOT write .clinerules as a file (.clinerules must be a directory)
 *   5.6  User content outside markers in .cline/clinerules.md preserved byte-for-byte (AC #4)
 *   5.7  On-prem profile — graceful fallback when onprem template absent (AC #8)
 *   5.8  MANIFEST path rendering resolves to .cline/skills/MANIFEST.yaml (AC #9)
 *   5.9  Dual-file drift detection: legacy .clinerules file still guarded; directory skips (AC #6)
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
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.stack || err.message}`);
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
  ONPREM_INSTRUCTION_TEMPLATE_PATH,
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
    assert.ok(!body.includes('/no_think'), 'framing must not contain /no_think');
    assert.ok(!body.includes('str_replace_editor'), 'framing must not contain str_replace_editor');
    assert.ok(!body.includes('~/.claude/'), 'framing must not contain ~/.claude/');
  });

  // 5.2 — NFR44: standard-profile output lacks forbidden strings
  await test('5.2 NFR44 — standard profile: .cline/clinerules.md does not contain forbidden strings (AC #7)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const content = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      assert.ok(!content.includes('/no_think'), '.cline/clinerules.md must not contain /no_think');
      assert.ok(!content.includes('str_replace_editor'), '.cline/clinerules.md must not contain str_replace_editor');
      assert.ok(!content.includes('~/.claude/'), '.cline/clinerules.md must not contain ~/.claude/');
    } finally { cleanup(dir); }
  }));

  // 5.3 — NFR46: two consecutive installs byte-identical
  await test('5.3 NFR46 idempotency: two consecutive installs produce byte-identical .cline/clinerules.md (AC #5)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const first = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      await updateAgentInstructions(cline, dir);
      const second = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      assert.strictEqual(first, second, '.cline/clinerules.md byte-identical across installs');
    } finally { cleanup(dir); }
  }));

  // 5.4 — Fresh install writes .cline/clinerules.md with marker-wrapped content
  await test('5.4 Fresh install writes .cline/clinerules.md with marker-wrapped content (AC #3)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const p = path.join(dir, '.cline', 'clinerules.md');
      assert.ok(fs.existsSync(p), '.cline/clinerules.md must be created');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('<!-- MA-AGENTS-START -->'), '.cline/clinerules.md has start marker');
      assert.ok(content.includes('<!-- MA-AGENTS-END -->'), '.cline/clinerules.md has end marker');
      assert.ok(content.includes('# AI Agent Skills - Planning Instruction'), '.cline/clinerules.md has composer content');
      assert.ok(content.includes('Respond in TEXT vs. create FILES'), '.cline/clinerules.md has text-vs-file rules');
      assert.ok(content.includes('# Cline Project Rules'), '.cline/clinerules.md has Cline framing header');
      assert.ok(/Architect mode/i.test(content), '.cline/clinerules.md has Architect-mode guidance');
    } finally { cleanup(dir); }
  }));

  // 5.5 — Installer does NOT write .clinerules as a file
  await test('5.5 Installer does NOT create .clinerules as a file (.clinerules must stay a directory)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const p = path.join(dir, '.clinerules');
      // .clinerules must not exist as a file after install
      if (fs.existsSync(p)) {
        const stat = fs.lstatSync(p);
        assert.ok(stat.isDirectory(), '.clinerules must be a directory if it exists, not a file');
      }
    } finally { cleanup(dir); }
  }));

  // 5.6 — User content outside markers in .cline/clinerules.md preserved
  await test('5.6 User content outside markers in .cline/clinerules.md preserved byte-for-byte (AC #4)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      const before = '# My personal cline rules\n\nUser preamble.\n\n';
      const after = '\n## Trailing user section\n\nMore notes.\n';
      const preMarker = '<!-- MA-AGENTS-START -->\nSTALE\n<!-- MA-AGENTS-END -->';
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'), before + preMarker + after, 'utf-8');
      await updateAgentInstructions(cline, dir);
      await updateAgentInstructions(cline, dir);
      const final = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      assert.ok(final.startsWith(before), '.cline/clinerules.md pre-marker preserved');
      assert.ok(final.endsWith(after), '.cline/clinerules.md post-marker preserved');
      assert.ok(!final.includes('STALE'), 'stale marker content replaced');
    } finally { cleanup(dir); }
  }));

  // 5.7a — On-prem profile with onprem template absent: throws
  await test('5.7a On-prem profile without onprem template: composer throws (Story 21.2 AC #3)', () => {
    const fs = require('fs');
    const bak = ONPREM_INSTRUCTION_TEMPLATE_PATH + '.bak-test-5-7a';
    const had = fs.existsSync(ONPREM_INSTRUCTION_TEMPLATE_PATH);
    if (had) fs.renameSync(ONPREM_INSTRUCTION_TEMPLATE_PATH, bak);
    try {
      assert.throws(
        () => composeInstructionBlock({ profile: 'on-prem', projectRoot: mktemp() }),
        /instruction-block-onprem\.template\.md is missing/
      );
    } finally {
      if (had) fs.renameSync(bak, ONPREM_INSTRUCTION_TEMPLATE_PATH);
    }
  });

  // 5.8 — MANIFEST_PATH resolves to .cline/skills/MANIFEST.yaml
  await test('5.8 MANIFEST_PATH resolves to .cline/skills/MANIFEST.yaml in .cline/clinerules.md (AC #9)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const content = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      assert.ok(content.includes('.cline/skills/MANIFEST.yaml'),
        '.cline/clinerules.md must reference .cline/skills/MANIFEST.yaml (forward-slashed)');
      assert.ok(!content.includes('{{MANIFEST_PATH}}'),
        '.cline/clinerules.md must not contain unreplaced placeholder');
      assert.ok(!content.includes('.cline\\skills\\MANIFEST.yaml'),
        '.cline/clinerules.md must not contain back-slashed path');
    } finally { cleanup(dir); }
  }));

  // 5.9a — Drift detection: identical marker blocks proceed silently
  await test('5.9a Drift detection: both legacy files with identical marker blocks → install proceeds', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      await updateAgentInstructions(cline, dir);
    } finally { cleanup(dir); }
  }));

  // 5.9b — Drift detection: legacy .clinerules file with divergent content throws
  await test('5.9b Drift detection: legacy .clinerules file with divergent marker block throws ClinerulesDualFileDriftError (AC #6)', () => {
    const dir = mktemp();
    try {
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'),
        '<!-- MA-AGENTS-START -->\nAAA\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      // Legacy: .clinerules exists as a file (not yet migrated to directory)
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

  // 5.9c — `--yes` does NOT bypass drift
  await test('5.9c --yes does NOT bypass drift detection for legacy .clinerules file (AC #6 exception)', async () => {
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

  // 5.9d — Drift check skipped when .clinerules is a directory (correct Cline structure)
  await test('5.9d Drift check skipped when .clinerules is a directory (correct Cline structure)', () => {
    const dir = mktemp();
    try {
      fs.mkdirSync(path.join(dir, '.cline'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.cline', 'clinerules.md'),
        '<!-- MA-AGENTS-START -->\nAAA\n<!-- MA-AGENTS-END -->\n', 'utf-8');
      // .clinerules is a directory — drift check must be a no-op even with divergent content
      fs.mkdirSync(path.join(dir, '.clinerules', 'workflows'), { recursive: true });
      assert.doesNotThrow(
        () => checkClinerulesDualFileDrift(dir),
        'drift check must not throw when .clinerules is a directory'
      );
    } finally { cleanup(dir); }
  });

  // 5.10 — Composer output appears exactly once in .cline/clinerules.md
  await test('5.10 Composer output appears exactly once inside .cline/clinerules.md marker block', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const cline = agents.getAgent('cline');
      await updateAgentInstructions(cline, dir);
      const content = fs.readFileSync(path.join(dir, '.cline', 'clinerules.md'), 'utf-8');
      const occurrences = (content.match(/# AI Agent Skills - Planning Instruction/g) || []).length;
      assert.strictEqual(occurrences, 1, '.cline/clinerules.md must contain composer output exactly once');
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
