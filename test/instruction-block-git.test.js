#!/usr/bin/env node
/**
 * Story 26.2 — Integration test: the composed git workflow block is stamped
 * into ALL FOUR per-tool marker-block injection targets for BOTH profiles.
 *
 * Targets asserted (architectural boundary — the four primary marker-block
 * targets; Cursor/Kilocode/Copilot/Gemini reuse the same composed content):
 *   - claude-code → .claude/CLAUDE.md
 *   - cline       → .cline/clinerules.md
 *   - roo-code    → .roo/rules/00-ma-agents.md
 *   - opencode    → AGENTS.md   (via extraInstructionTemplates / markdown-markers)
 *
 * AC coverage:
 *   1  standard profile — all four targets contain the six required git-block
 *      content elements inside the MA-AGENTS markers
 *   2  idempotency — second install produces byte-identical marker-block content
 *      in every target; text written OUTSIDE the markers is preserved byte-for-byte
 *   3  on-prem profile — every target contains the git block AND the on-prem block,
 *      with the git block appearing BEFORE the on-prem block (composition order FR206)
 *   4  air-gapped — the test performs no network calls and does not depend on a
 *      real `gh` binary or a GitHub remote (NFR44/NFR45). Assertions are purely on
 *      the stamped instruction-file CONTENT.
 *
 * Reuses the harness pattern from test/onprem-injection.test.js: it calls the
 * installer's internal stamping entry points (updateAgentInstructions +
 * stampExtraInstructionTemplates) against a TEMP fixture project — NOT the
 * `npx ma-agents install` CLI, no network, no real `gh`.
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

// ── Imports (same entry points the existing harness uses) ──────────────────────
const {
  _testUpdateAgentInstructions: updateAgentInstructions,
  stampExtraInstructionTemplates,
} = require('../lib/installer');
const { setProfile } = require('../lib/profile');
const agents = require('../lib/agents');

// ── Helpers ───────────────────────────────────────────────────────────────────
function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-26-2-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/** Silence installer log chatter (BMAD output dir resolution, mergers, etc.). */
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

/** Extract the MA-AGENTS-START…MA-AGENTS-END block (inclusive) from text. */
function extractMarkerBlock(text) {
  const start = text.indexOf('<!-- MA-AGENTS-START -->');
  const end = text.indexOf('<!-- MA-AGENTS-END -->');
  if (start < 0 || end < 0) return null;
  return text.slice(start, end + '<!-- MA-AGENTS-END -->'.length);
}

// The four primary marker-block targets and their on-disk file paths
// (relative to projectRoot). Note: the claude-code agent writes .claude/CLAUDE.md.
const TARGETS = [
  { id: 'claude-code', file: path.join('.claude', 'CLAUDE.md') },
  { id: 'cline', file: path.join('.cline', 'clinerules.md') },
  { id: 'roo-code', file: path.join('.roo', 'rules', '00-ma-agents.md') },
  { id: 'opencode', file: 'AGENTS.md' },
];

/**
 * Install all four primary marker-block targets into projectRoot by calling the
 * installer's internal stamping functions directly. cwd is temporarily set to
 * projectRoot so the relative-path resolution inside installer helpers matches a
 * real CLI invocation. No network access, no real `gh` invocation.
 */
async function installAllTargets(projectRoot, opts = {}) {
  const cwdOriginal = process.cwd();
  process.chdir(projectRoot);
  try {
    for (const { id } of TARGETS) {
      const agent = agents.getAgent(id);
      assert.ok(agent, `agent ${id} must exist in registry`);
      await updateAgentInstructions(agent, projectRoot, opts);
      if (Array.isArray(agent.extraInstructionTemplates) && agent.extraInstructionTemplates.length > 0) {
        await stampExtraInstructionTemplates(agent, projectRoot, opts);
      }
    }
  } finally {
    process.chdir(cwdOriginal);
  }
}

function readTarget(projectRoot, file) {
  const full = path.join(projectRoot, file);
  assert.ok(fs.existsSync(full), `target file must exist: ${file}`);
  return fs.readFileSync(full, 'utf-8');
}

/**
 * Assert the six required git-block content elements are present in the marker
 * block of `block` (the MA-AGENTS marker region) for target `label`.
 */
function assertGitBlockContent(block, label) {
  assert.ok(block !== null, `${label}: marker block must be present`);

  // 1) the heading
  assert.ok(
    block.includes('## Git Workflow (ALL file-changing tasks)'),
    `${label}: must contain the "## Git Workflow (ALL file-changing tasks)" heading`
  );

  // 2) git worktree add reference
  assert.ok(
    block.includes('git worktree add'),
    `${label}: must reference "git worktree add"`
  );

  // 3) Conventional Commits OR the 7-prefix list
  const hasConventional = block.includes('Conventional Commits');
  const sevenPrefixes = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'ci'];
  const hasAllPrefixes = sevenPrefixes.every((p) => block.includes('`' + p + '`'));
  assert.ok(
    hasConventional || hasAllPrefixes,
    `${label}: must reference "Conventional Commits" or the 7-prefix list (feat, fix, chore, docs, refactor, test, ci)`
  );

  // 4) gh pr create OR "open a PR"
  assert.ok(
    block.includes('gh pr create') || /open(?:ing)? a (?:pull request|PR)/i.test(block),
    `${label}: must reference "gh pr create" or "open a PR"`
  );

  // 5) reference to the procedural skill
  assert.ok(
    block.includes('skills/git-workflow-skill/SKILL.md'),
    `${label}: must reference "skills/git-workflow-skill/SKILL.md"`
  );

  // 6) explicit never-commit-directly-to-main/dev/master rule
  const mentionsTrunk =
    block.includes('`main`') && block.includes('`dev`') && block.includes('`master`');
  const mentionsNeverCommit = /never commit directly/i.test(block) || /do not commit to/i.test(block);
  assert.ok(
    mentionsTrunk && mentionsNeverCommit,
    `${label}: must contain an explicit "never commit directly to main/dev/master" rule`
  );
}

// ── Test cases ────────────────────────────────────────────────────────────────

console.log('\n story 26.2 — git block stamped into all four per-tool targets\n');

async function runAll() {
  // ── AC #1 — standard profile: git block in all four targets ───────────────
  await test('AC#1 standard profile: git block lands in all four primary targets', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      await installAllTargets(dir, { yesMode: true });

      for (const { file } of TARGETS) {
        const content = readTarget(dir, file);
        const block = extractMarkerBlock(content);
        assertGitBlockContent(block, `standard:${file}`);
      }
    } finally { cleanup(dir); }
  }));

  // ── AC #2 — idempotency + out-of-marker preservation ──────────────────────
  await test('AC#2 idempotency: second install → byte-identical marker block; out-of-marker text preserved', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      await installAllTargets(dir, { yesMode: true });

      // Capture first-run marker blocks, then write user text OUTSIDE the markers
      // (appended after MA-AGENTS-END) into every target.
      const SENTINEL = '\n\n## User-owned section (must survive re-install)\n\nHand-written note 26.2.\n';
      const firstBlocks = {};
      for (const { file } of TARGETS) {
        const full = path.join(dir, file);
        const content = readTarget(dir, file);
        firstBlocks[file] = extractMarkerBlock(content);
        assert.ok(firstBlocks[file] !== null, `${file}: marker block present after first install`);
        // Append user content after the END marker (guaranteed outside the block).
        fs.writeFileSync(full, content + SENTINEL, 'utf-8');
      }

      // Second install with the same flags.
      await installAllTargets(dir, { yesMode: true });

      for (const { file } of TARGETS) {
        const content = readTarget(dir, file);
        const secondBlock = extractMarkerBlock(content);
        assert.strictEqual(
          secondBlock,
          firstBlocks[file],
          `${file}: marker-block content must be byte-identical across two installs (idempotency)`
        );
        // Out-of-marker user text must be preserved byte-for-byte.
        assert.ok(
          content.includes(SENTINEL),
          `${file}: text written outside the markers must be preserved byte-for-byte`
        );
        // And still exactly one marker block (no duplication).
        const startCount = (content.match(/<!-- MA-AGENTS-START -->/g) || []).length;
        assert.strictEqual(startCount, 1, `${file}: must contain exactly one marker block after re-install`);
      }
    } finally { cleanup(dir); }
  }));

  // ── AC #3 — on-prem profile: git block AND on-prem block, git BEFORE on-prem ──
  await test('AC#3 on-prem profile: every target has git block AND on-prem block, git before on-prem (FR206)', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'on-prem');
      await installAllTargets(dir, { yesMode: true });

      for (const { file } of TARGETS) {
        const content = readTarget(dir, file);
        const block = extractMarkerBlock(content);
        assert.ok(block !== null, `on-prem:${file}: marker block must be present`);

        // Git block present (full six-element check).
        assertGitBlockContent(block, `on-prem:${file}`);

        // On-prem block present — assert a canonical on-prem-only guardrail string.
        assert.ok(
          block.includes('/no_think'),
          `on-prem:${file}: marker block must contain the on-prem guardrail (/no_think)`
        );

        // Composition order (FR206): git block heading must appear BEFORE the
        // on-prem content within the marker.
        const gitIdx = block.indexOf('## Git Workflow (ALL file-changing tasks)');
        const onpremIdx = block.indexOf('/no_think');
        assert.ok(gitIdx >= 0, `on-prem:${file}: git heading index must be found`);
        assert.ok(onpremIdx >= 0, `on-prem:${file}: on-prem marker index must be found`);
        assert.ok(
          gitIdx < onpremIdx,
          `on-prem:${file}: git block must appear BEFORE the on-prem block inside the marker (FR206)`
        );
      }
    } finally { cleanup(dir); }
  }));

  // ── AC #4 — air-gapped sanity: no network/gh dependency, content-only ──────
  await test('AC#4 air-gapped: assertions are content-only (no network, no real gh dependency)', withSilencedLogs(async () => {
    // This test (and the entire file) never spawns a process, opens a socket, or
    // shells out to `gh`/`git`. The guarantee is structural: the only side effects
    // are local fs reads/writes under a temp dir. We assert that the stamped
    // content references PR/worktree tooling textually without requiring it to run.
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');
      await installAllTargets(dir, { yesMode: true });
      const content = readTarget(dir, TARGETS[0].file);
      const block = extractMarkerBlock(content);
      assert.ok(block.includes('git worktree add'), 'git worktree add referenced as text');
      assert.ok(block.includes('gh pr create'), 'gh pr create referenced as text');
    } finally { cleanup(dir); }
  }));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled error in test harness:', err);
  process.exit(1);
});
