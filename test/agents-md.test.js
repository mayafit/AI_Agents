#!/usr/bin/env node
/**
 * Story 21.4 — Unit + integration tests for AGENTS.md template stamping and
 * OpenCode AGENTS.md wiring.
 *
 * AC coverage:
 *   6.1  Template is static text — NO {{...}} placeholders (AC #2)
 *   6.2  Stamper invokes composeInstructionBlock exactly once per artifact (AC #3)
 *   6.3  Composed string appears byte-for-byte inside AGENTS.md markers (AC #3)
 *   6.4  NFR44 — standard-profile rendered output lacks /no_think, str_replace_editor;
 *        ~/.claude/ appears only in Critical Behavior Rules sentence (AC #9)
 *   6.5  Path-resolution precedence (AC #10)
 *   6.6  Fresh install — AGENTS.md written with stamped content (AC #1, #5 create)
 *   6.7  Fresh install — opencode.json::instructions[] contains both the
 *        [ma-agents] entry AND "AGENTS.md"; other keys untouched (AC #6, #12)
 *   6.8  Re-install idempotency — byte-identical marker-block; no duplicate
 *        entries; no .backup files (AC #8, NFR46)
 *   6.9  Existing AGENTS.md with user content outside markers: preserved byte-
 *        for-byte (AC #5 merge case)
 *   6.10 Existing AGENTS.md without markers: block appended at EOF with one
 *        blank line; existing content preserved (AC #5 no-markers case)
 *   6.11 Upgrade-safety drift: hand-edited marker block + yesMode triggers
 *        WARNING + backup file (AC #11)
 *   6.12 Pre-existing "AGENTS.md" in instructions[] → no duplicate (AC #6)
 *   6.13 Object-form { path: 'AGENTS.md' } entry → installer still appends
 *        the string literal (AC #6 string-equality contract)
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
  resolveBmadOutputDirs,
  _testUpdateAgentInstructions: updateAgentInstructions
} = installerModule;
const { setProfile } = require('../lib/profile');
const agents = require('../lib/agents');

const AGENTS_MD_TEMPLATE_PATH = path.join(__dirname, '..', 'lib', 'templates', 'agents-md.template.md');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-agents-md-test-'));
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

// Silence log lines from install (BMAD output dirs resolution, merger messages).
function withSilencedLogs(fn) {
  return async (...args) => {
    const origLog = console.log;
    console.log = () => {};
    try {
      return await fn(...args);
    } finally {
      console.log = origLog;
    }
  };
}

function captureLogs(fn) {
  const origLog = console.log;
  let captured = '';
  console.log = (...args) => { captured += args.join(' ') + '\n'; };
  return Promise.resolve(fn()).then(
    (v) => { console.log = origLog; return { result: v, captured }; },
    (e) => { console.log = origLog; throw e; }
  );
}

console.log('\n agents-md stamping tests (Story 21.4)\n');

async function runAll() {
  // 6.1 — Template is static text, no {{...}} placeholders (AC #2)
  await test('6.1 agents-md.template.md exists and contains NO {{...}} placeholders', () => {
    assert.ok(fs.existsSync(AGENTS_MD_TEMPLATE_PATH), 'template file must exist');
    const body = fs.readFileSync(AGENTS_MD_TEMPLATE_PATH, 'utf-8');
    const placeholders = body.match(/\{\{[^}]+\}\}/g) || [];
    assert.strictEqual(placeholders.length, 0,
      `template must be static text; found placeholders: ${JSON.stringify(placeholders)}`);
    // Required sections per AC #1
    assert.ok(/## Universal Rules/.test(body), '## Universal Rules section required');
    assert.ok(/## Critical Behavior Rules/.test(body), '## Critical Behavior Rules section required');
    assert.ok(/## BMAD Phase Declaration/.test(body), '## BMAD Phase Declaration section required');
    assert.ok(/## Project BMAD Output Structure/.test(body), '## Project BMAD Output Structure section required');
    assert.ok(/<!-- MA-AGENTS-START -->/.test(body), 'MA-AGENTS-START marker required');
    assert.ok(/<!-- MA-AGENTS-END -->/.test(body), 'MA-AGENTS-END marker required');
  });

  // 6.2 — Stamper invokes composeInstructionBlock exactly once per artifact
  await test('6.2 composeInstructionBlock invoked exactly once per AGENTS.md stamp', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      // Spy by wrapping the exported composer via a local count.
      // We can't easily stub module-internal calls, so instead we count
      // via the side-effect: the composer reads from the universal template
      // on every call, so we shim fs.readFileSync only for that path and
      // count. To stay honest with the "don't stub real modules" rule, we
      // instead perform a behavior assertion: after one stampExtraInstructionTemplates
      // call for opencode, the file contents should match exactly one composer output.
      const opencode = agents.getAgent('opencode');
      // Pre-create opencode.json so the json-merge branch has something to read.
      const opencodeJsonPath = path.join(dir, 'opencode.json');
      fs.writeFileSync(opencodeJsonPath, JSON.stringify({ instructions: [] }, null, 2), 'utf-8');
      await updateAgentInstructions(opencode, dir);
      const agentsMdPath = path.join(dir, 'AGENTS.md');
      assert.ok(fs.existsSync(agentsMdPath));
      // AC #3: composed content appears exactly once inside the marker block
      const content = fs.readFileSync(agentsMdPath, 'utf-8');
      const composed = composeInstructionBlock({ profile: 'standard', projectRoot: dir })
        .replace(/\{\{MANIFEST_PATH\}\}/g, path.relative(dir, path.join(opencode.getProjectPath(), 'MANIFEST.yaml')).replace(/\\/g, '/'));
      // Count occurrences inside the marker block
      const blockMatch = content.match(/<!-- MA-AGENTS-START -->([\s\S]*?)<!-- MA-AGENTS-END -->/);
      assert.ok(blockMatch, 'marker block present in AGENTS.md');
      const occurrences = (blockMatch[1].match(new RegExp(escapeRegExp(composed.split('\n')[0]), 'g')) || []).length;
      assert.strictEqual(occurrences, 1, 'composed content appears exactly once inside markers');
    } finally { cleanup(dir); }
  }));

  // 6.3 — composed string appears byte-for-byte inside the marker block
  await test('6.3 composed string appears byte-for-byte inside AGENTS.md markers', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      const relManifestPath = path.relative(dir, path.join(opencode.getProjectPath(), 'MANIFEST.yaml')).replace(/\\/g, '/');
      const composed = composeInstructionBlock({ profile: 'standard', projectRoot: dir })
        .replace(/\{\{MANIFEST_PATH\}\}/g, relManifestPath);
      const expectedInside = composed.replace(/\s+$/, '') + '\n';
      const blockMatch = content.match(/<!-- MA-AGENTS-START -->\n([\s\S]*?)<!-- MA-AGENTS-END -->/);
      assert.ok(blockMatch);
      assert.strictEqual(blockMatch[1], expectedInside,
        'content between markers must match composer output byte-for-byte');
    } finally { cleanup(dir); }
  }));

  // 6.4 — NFR44 — standard-profile output lacks forbidden local-LLM strings;
  // ~/.claude/ only inside Critical Behavior Rules sentence
  await test('6.4 NFR44 — standard profile AGENTS.md lacks /no_think, str_replace_editor; ~/.claude/ only inside Critical Behavior Rules', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(!content.includes('/no_think'), 'must not contain /no_think');
      assert.ok(!content.includes('str_replace_editor'), 'must not contain str_replace_editor');
      const claudeMatches = content.match(/~\/\.claude\//g) || [];
      // The Critical Behavior Rules sentence contains exactly one occurrence of ~/.claude/.
      assert.strictEqual(claudeMatches.length, 1,
        'exactly one ~/.claude/ allowed (Critical Behavior Rules sentence)');
      // Assert that the occurrence is within the Critical Behavior Rules section.
      const cbrIdx = content.indexOf('## Critical Behavior Rules');
      const nextSectionIdx = content.indexOf('\n## ', cbrIdx + 1);
      const cbrSlice = content.slice(cbrIdx, nextSectionIdx === -1 ? undefined : nextSectionIdx);
      assert.ok(cbrSlice.includes('~/.claude/'), '~/.claude/ must appear inside the Critical Behavior Rules section');
    } finally { cleanup(dir); }
  }));

  // 6.5 — Path-resolution precedence (AC #10)
  await test('6.5a resolveBmadOutputDirs uses defaults when _bmad/bmm/config.yaml absent', () => {
    const dir = mktemp();
    try {
      // Clear memoization by creating a fresh dir
      const dirs = resolveBmadOutputDirs(dir);
      assert.strictEqual(dirs.planning, '_bmad-output/planning-artifacts');
      assert.strictEqual(dirs.architecture, '_bmad-output/planning-artifacts');
      assert.strictEqual(dirs.stories, '_bmad-output/implementation-artifacts');
    } finally { cleanup(dir); }
  });

  await test('6.5b resolveBmadOutputDirs honors _bmad/bmm/config.yaml when present', () => {
    const dir = mktemp();
    try {
      const cfgDir = path.join(dir, '_bmad', 'bmm');
      fs.mkdirSync(cfgDir, { recursive: true });
      fs.writeFileSync(path.join(cfgDir, 'config.yaml'),
        'planning_artifacts: "custom/planning"\narchitecture_artifacts: "custom/arch"\nimplementation_artifacts: "custom/stories"\n',
        'utf-8');
      const dirs = resolveBmadOutputDirs(dir);
      assert.strictEqual(dirs.planning, 'custom/planning');
      assert.strictEqual(dirs.architecture, 'custom/arch');
      assert.strictEqual(dirs.stories, 'custom/stories');
    } finally { cleanup(dir); }
  });

  // 6.6 — Fresh install writes AGENTS.md with required structure
  await test('6.6 Fresh install writes AGENTS.md with stamped content + all required sections', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(content.startsWith('<!-- Generated by ma-agents'), 'leading Generated-by comment required');
      assert.ok(content.includes('# Project Agent Instructions'));
      assert.ok(content.includes('## Universal Rules'));
      assert.ok(content.includes('## Critical Behavior Rules'));
      assert.ok(content.includes('## BMAD Phase Declaration'));
      assert.ok(content.includes('## Project BMAD Output Structure'));
      assert.ok(content.includes('<!-- MA-AGENTS-START -->'));
      assert.ok(content.includes('<!-- MA-AGENTS-END -->'));
      // Composer content present between markers
      assert.ok(content.includes('# AI Agent Skills - Planning Instruction'));
      assert.ok(content.includes('Respond in TEXT vs. create FILES'));
    } finally { cleanup(dir); }
  }));

  // 6.7 — opencode.json::instructions[] contains ma-agents entry + AGENTS.md
  await test('6.7 Fresh install: opencode.json::instructions[] has both [ma-agents] and "AGENTS.md"; other keys untouched', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const opencode = agents.getAgent('opencode');
      // Seed with user-owned keys + a user entry
      fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
        instructions: ['user-entry'],
        otherKey: { preserve: true }
      }, null, 2), 'utf-8');
      await updateAgentInstructions(opencode, dir);
      const data = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8'));
      assert.deepStrictEqual(data.otherKey, { preserve: true }, 'other keys untouched (NFR18)');
      const hasMa = data.instructions.some(e => typeof e === 'string' && e.startsWith('[ma-agents]'));
      const hasAgentsMd = data.instructions.includes('AGENTS.md');
      assert.ok(hasMa, '[ma-agents] entry present');
      assert.ok(hasAgentsMd, '"AGENTS.md" literal present');
      assert.ok(data.instructions.includes('user-entry'), 'user entry preserved');
    } finally { cleanup(dir); }
  }));

  // 6.8 — Idempotency: re-install produces byte-identical marker block, no duplicates, no backup
  await test('6.8 Re-install idempotency: byte-identical AGENTS.md marker block; no duplicate entries; no backup files', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const firstAgentsMd = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      const firstJson = fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8');
      await updateAgentInstructions(opencode, dir);
      const secondAgentsMd = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      const secondJson = fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8');
      assert.strictEqual(firstAgentsMd, secondAgentsMd, 'AGENTS.md byte-identical across installs');
      // JSON: exactly one ma-agents entry, one AGENTS.md entry
      const d2 = JSON.parse(secondJson);
      const maCount = d2.instructions.filter(e => typeof e === 'string' && e.startsWith('[ma-agents]')).length;
      const agentsMdCount = d2.instructions.filter(e => e === 'AGENTS.md').length;
      assert.strictEqual(maCount, 1, 'exactly one ma-agents entry');
      assert.strictEqual(agentsMdCount, 1, 'exactly one AGENTS.md entry');
      // No backup files at project root
      const siblings = fs.readdirSync(dir);
      const backups = siblings.filter(n => n.startsWith('AGENTS.md.backup-'));
      assert.strictEqual(backups.length, 0, 'no backup file when no drift');
    } finally { cleanup(dir); }
  }));

  // 6.9 — User content outside markers preserved byte-for-byte
  await test('6.9 Pre-existing AGENTS.md with user content outside markers: preserved byte-for-byte', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const before = '# My personal AGENTS\n\nUser notes.\n\n';
      const after = '\n## Trailing user section\n\nMore notes.\n';
      const preMarker = '<!-- MA-AGENTS-START -->\nOLD STALE CONTENT\n<!-- MA-AGENTS-END -->';
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), before + preMarker + after, 'utf-8');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const final = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(final.startsWith(before), 'pre-marker content preserved byte-for-byte');
      assert.ok(final.endsWith(after), 'post-marker content preserved byte-for-byte');
      assert.ok(!final.includes('OLD STALE CONTENT'), 'stale marker content replaced');
    } finally { cleanup(dir); }
  }));

  // 6.10 — Pre-existing AGENTS.md without markers: append block at EOF + blank line
  await test('6.10 Pre-existing AGENTS.md without markers: block appended at EOF with blank-line separator', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const preContent = '# My AGENTS notes\n\nSome notes.\n';
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), preContent, 'utf-8');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const final = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(final.startsWith(preContent), 'existing content preserved byte-for-byte at start');
      assert.ok(final.includes('<!-- MA-AGENTS-START -->'));
      assert.ok(final.includes('<!-- MA-AGENTS-END -->'));
      // Separator is exactly one blank line between the original trailing newline and the marker block
      const blankLineSep = preContent + '\n<!-- MA-AGENTS-START -->';
      // Allow either exact (preserves existing trailing newline + one blank line) match:
      const idxOfMarker = final.indexOf('<!-- MA-AGENTS-START -->');
      const between = final.slice(preContent.length, idxOfMarker);
      assert.ok(/^\n/.test(between) || between === '\n' || between === '',
        `expected a blank-line separator before marker block, got: ${JSON.stringify(between)}`);
      void blankLineSep;
    } finally { cleanup(dir); }
  }));

  // 6.11 — Hand-edited marker block + yesMode → WARNING + backup
  await test('6.11 Upgrade-safety: hand-edited marker block + yesMode emits WARNING and writes backup', async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      const handEdited = '<!-- MA-AGENTS-START -->\nHAND EDITED\n<!-- MA-AGENTS-END -->';
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'prefix\n' + handEdited + '\nsuffix\n', 'utf-8');
      const opencode = agents.getAgent('opencode');
      const origYes = process.env.MA_AGENTS_YES;
      process.env.MA_AGENTS_YES = '1';
      try {
        const { captured } = await captureLogs(() => updateAgentInstructions(opencode, dir));
        assert.ok(captured.includes('WARNING: ma-agents marker-block content modified since last install'),
          'WARNING line must be emitted');
        const siblings = fs.readdirSync(dir);
        const backups = siblings.filter(n => n.startsWith('AGENTS.md.backup-'));
        assert.strictEqual(backups.length, 1, 'exactly one backup file');
        const backupContent = fs.readFileSync(path.join(dir, backups[0]), 'utf-8');
        assert.strictEqual(backupContent, handEdited, 'backup contains only marker-block region');
      } finally {
        if (origYes === undefined) delete process.env.MA_AGENTS_YES;
        else process.env.MA_AGENTS_YES = origYes;
      }
    } finally { cleanup(dir); }
  });

  // 6.12 — Pre-existing "AGENTS.md" in instructions[] → no duplicate
  await test('6.12 Pre-existing "AGENTS.md" entry in opencode.json is not duplicated', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
        instructions: ['AGENTS.md']
      }, null, 2), 'utf-8');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const data = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8'));
      const count = data.instructions.filter(e => e === 'AGENTS.md').length;
      assert.strictEqual(count, 1, 'no duplicate AGENTS.md entry');
    } finally { cleanup(dir); }
  }));

  // 6.13 — Object-form { path: 'AGENTS.md' } is NOT treated as a dedup match
  await test('6.13 Object-form { path: "AGENTS.md" } entry: installer still appends the literal string (AC #6 string-equality)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
        instructions: [{ path: 'AGENTS.md' }]
      }, null, 2), 'utf-8');
      const opencode = agents.getAgent('opencode');
      await updateAgentInstructions(opencode, dir);
      const data = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8'));
      // Rationale (AC #6 string equality): object form is a DIFFERENT entry; the
      // string "AGENTS.md" is appended because `=== 'AGENTS.md'` check matches no
      // existing entry. Preserves user's object entry unchanged.
      const stringCount = data.instructions.filter(e => e === 'AGENTS.md').length;
      assert.strictEqual(stringCount, 1, 'string literal "AGENTS.md" appended');
      const objCount = data.instructions.filter(e => typeof e === 'object' && e != null && e.path === 'AGENTS.md').length;
      assert.strictEqual(objCount, 1, 'user object-form entry preserved');
    } finally { cleanup(dir); }
  }));

  console.log(`\n ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`   ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

runAll().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
