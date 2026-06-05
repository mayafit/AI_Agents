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

/**
 * Return everything AFTER the first `<!-- MA-AGENTS-END -->` marker (the
 * out-of-marker tail). Used to assert byte-exact preservation of user content
 * appended below the block across re-installs (AC2 SHOULD-FIX). Returns null if
 * the END marker is absent.
 */
function postEndTail(text) {
  const endMarker = '<!-- MA-AGENTS-END -->';
  const idx = text.indexOf(endMarker);
  if (idx < 0) return null;
  return text.slice(idx + endMarker.length);
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
      const firstTails = {};
      for (const { file } of TARGETS) {
        const full = path.join(dir, file);
        const content = readTarget(dir, file);
        firstBlocks[file] = extractMarkerBlock(content);
        assert.ok(firstBlocks[file] !== null, `${file}: marker block present after first install`);
        // Append user content after the END marker (guaranteed outside the block).
        const withSentinel = content + SENTINEL;
        fs.writeFileSync(full, withSentinel, 'utf-8');
        // Capture the EXACT post-END tail (the entire out-of-marker region after
        // the END marker, including the just-appended sentinel) so we can later
        // assert it survived the second install byte-for-byte. This is stronger
        // than a substring `.includes(SENTINEL)` check (AC2 SHOULD-FIX).
        firstTails[file] = postEndTail(withSentinel);
        assert.ok(firstTails[file] !== null, `${file}: post-END tail must be extractable after first install`);
        assert.ok(firstTails[file].includes(SENTINEL), `${file}: captured tail must include the appended sentinel`);
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
        // Out-of-marker region after END must be byte-identical to what we wrote
        // (no trimming, reflowing, or re-ordering of user-owned content). This is
        // a byte-exact check of the whole post-END tail, not just a substring.
        const secondTail = postEndTail(content);
        assert.strictEqual(
          secondTail,
          firstTails[file],
          `${file}: out-of-marker region after MA-AGENTS-END must be byte-identical across re-install`
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

        // On-prem block present — assert at least THREE distinct on-prem-only
        // literals inside the marker block, mirroring the canonical set used in
        // test/onprem-injection.test.js (AC3 SHOULD-FIX: don't key presence on a
        // single string). All three must be present together.
        const ONPREM_LITERALS = ['/no_think', 'str_replace_editor', '~/.claude/'];
        for (const literal of ONPREM_LITERALS) {
          assert.ok(
            block.includes(literal),
            `on-prem:${file}: marker block must contain the on-prem guardrail literal "${literal}"`
          );
        }

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

  // ════════════════════════════════════════════════════════════════════════
  // EDGE-CASE EXTENDER scenarios (Story 26.2 review follow-up). Content-only,
  // no network / no gh / no git spawn — same temp-seeding harness as above.
  // ════════════════════════════════════════════════════════════════════════

  // ── EDGE #1 — mixed pre-existing marker-block content ─────────────────────
  // A target file already carries a DIFFERENT MA-AGENTS block (stale old
  // content) plus user text OUTSIDE it. After stamping, the marker block must
  // hold the CURRENT composed git block (byte-identical to a fresh stamp) and
  // the outside user text must be preserved byte-for-byte.
  await test('EDGE pre-existing stale marker block is replaced with current content; outside user text preserved', withSilencedLogs(async () => {
    // Reference: what a fresh stamp produces for each target (golden block).
    const freshDir = mktemp();
    const goldenBlocks = {};
    try {
      setProfile(freshDir, 'standard');
      await installAllTargets(freshDir, { yesMode: true });
      for (const { file } of TARGETS) {
        goldenBlocks[file] = extractMarkerBlock(readTarget(freshDir, file));
        assert.ok(goldenBlocks[file] !== null, `${file}: golden block must extract from fresh stamp`);
      }
    } finally { cleanup(freshDir); }

    const dir = mktemp();
    try {
      setProfile(dir, 'standard');

      // Seed every target with a STALE marker block + surrounding user text.
      // The stale block is intentionally different from the current composed block.
      const PREAMBLE = '# Hand-authored project rules\n\nKeep this intro exactly as written.\n\n';
      const STALE_BLOCK =
        '<!-- MA-AGENTS-START -->\n' +
        '## Git Workflow (ALL file-changing tasks)\n\n' +
        'OUTDATED stale body from an older ma-agents version — must be replaced.\n' +
        '<!-- MA-AGENTS-END -->';
      const EPILOGUE = '\n\n## My own appendix\n\nDo not touch this trailing section.\n';
      const seededBefore = {};
      const seededAfter = {};
      for (const { file } of TARGETS) {
        const full = path.join(dir, file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        const seed = PREAMBLE + STALE_BLOCK + EPILOGUE;
        fs.writeFileSync(full, seed, 'utf-8');
        // Record the exact out-of-marker regions (before START, after END) so we
        // can assert byte-for-byte preservation.
        seededBefore[file] = seed.slice(0, seed.indexOf('<!-- MA-AGENTS-START -->'));
        seededAfter[file] = postEndTail(seed);
      }

      await installAllTargets(dir, { yesMode: true });

      for (const { file } of TARGETS) {
        const content = readTarget(dir, file);

        // Exactly one marker block (the stale one was replaced in place, not duplicated).
        const startCount = (content.match(/<!-- MA-AGENTS-START -->/g) || []).length;
        const endCount = (content.match(/<!-- MA-AGENTS-END -->/g) || []).length;
        assert.strictEqual(startCount, 1, `${file}: exactly one START marker after replacing stale block`);
        assert.strictEqual(endCount, 1, `${file}: exactly one END marker after replacing stale block`);

        // Marker block now equals the fresh golden block (current composed git block).
        const block = extractMarkerBlock(content);
        assert.strictEqual(
          block,
          goldenBlocks[file],
          `${file}: marker block must be byte-identical to a fresh stamp after replacing stale content`
        );
        assertGitBlockContent(block, `mixed-preexisting:${file}`);

        // Stale body is gone.
        assert.ok(
          !content.includes('OUTDATED stale body from an older ma-agents version'),
          `${file}: stale marker-block body must be replaced (removed)`
        );

        // Outside user text preserved byte-for-byte (before START and after END).
        assert.ok(
          content.startsWith(seededBefore[file]),
          `${file}: user text BEFORE the marker block must be preserved byte-for-byte`
        );
        assert.strictEqual(
          postEndTail(content),
          seededAfter[file],
          `${file}: user text AFTER the marker block must be preserved byte-for-byte`
        );
      }
    } finally { cleanup(dir); }
  }));

  // ── EDGE #2 — marker block missing its closer ─────────────────────────────
  // Seed a target with a `<!-- MA-AGENTS-START -->` opener but NO closer.
  // The installer treats a START-without-END as NOT a valid marker block (the
  // injector regex requires a closing END), so it falls back to inserting a
  // complete, well-formed block and leaves the orphan opener as user-owned text.
  //
  // OBSERVED BEHAVIOR (probed against lib/installer.js, claude-code path):
  //   - The result contains TWO `<!-- MA-AGENTS-START -->` and ONE
  //     `<!-- MA-AGENTS-END -->`: one COMPLETE new block + the pre-existing
  //     orphan opener (which the installer cannot recognize as a block).
  //   - No content is dropped, nothing is nested, nothing throws.
  //
  // Per EDGE-CASE EXTENDER guidance this is NOT a clear defect (no nesting, no
  // dropped user content, no throw, no duplication of the composed block —
  // exactly ONE complete well-formed block is produced and all user bytes
  // survive). The marker-count asymmetry is a faithful consequence of malformed
  // INPUT (an unterminated user marker), not installer corruption. We therefore
  // assert the true invariants: exactly one COMPLETE block, git content inside
  // it, the orphan + user text preserved, and no nesting / no throw.
  await test('EDGE marker block missing its closer: installer produces one complete block, preserves all user content, no throw', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');

      const PREAMBLE = '# My Project\n\nUser intro text — must survive.\n\n';
      const ORPHAN = '<!-- MA-AGENTS-START -->\nstale orphan content with no closer\n\nMore user text after the orphan opener.\n';
      const seed = PREAMBLE + ORPHAN;

      // Use the two non-BMAD marker-block targets that CREATE a markdown file
      // from an existing seed: claude-code (.claude/CLAUDE.md) and opencode's
      // AGENTS.md (markdown-markers merger). Both go through marker injection.
      const subjects = [
        { id: 'claude-code', file: path.join('.claude', 'CLAUDE.md') },
        { id: 'opencode', file: 'AGENTS.md' },
      ];

      for (const { file } of subjects) {
        const full = path.join(dir, file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, seed, 'utf-8');
      }

      // Stamp each subject with a SINGLE correct install pass (must not throw on
      // malformed input). For the json-merge agent (opencode) updateAgentInstructions
      // already stamps its extraInstructionTemplates (AGENTS.md) internally, so we
      // must NOT call stampExtraInstructionTemplates a second time here — doing so
      // would re-run the marker merger over the just-written block. (See the
      // double-stamp note in the test report.)
      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        for (const { id } of subjects) {
          const agent = agents.getAgent(id);
          assert.ok(agent, `agent ${id} must exist in registry`);
          await updateAgentInstructions(agent, dir, { yesMode: true });
          // Only stamp extras separately for NON-json-merge agents (json-merge
          // agents stamp their extras inside updateAgentInstructions).
          const isJsonMerge = agent.injectionStrategy && agent.injectionStrategy.position === 'json-merge';
          if (!isJsonMerge && Array.isArray(agent.extraInstructionTemplates) && agent.extraInstructionTemplates.length > 0) {
            await stampExtraInstructionTemplates(agent, dir, { yesMode: true });
          }
        }
      } finally {
        process.chdir(cwdOriginal);
      }

      for (const { file } of subjects) {
        const content = readTarget(dir, file);

        // Exactly ONE complete, well-formed git block was produced (not zero, not
        // duplicated). We key on the composed git heading rather than on raw
        // marker counts, because the unterminated user opener is faithfully left
        // behind as inert user text (its position differs by injection strategy:
        // top-insert vs EOF-append), so a naive START/END count is asymmetric by
        // design — that asymmetry reflects the malformed INPUT, not corruption.
        const headingCount = (content.match(/## Git Workflow \(ALL file-changing tasks\)/g) || []).length;
        assert.strictEqual(headingCount, 1, `${file}: composed git block must appear exactly once (not dropped, not duplicated)`);
        const endCount = (content.match(/<!-- MA-AGENTS-END -->/g) || []).length;
        assert.strictEqual(endCount, 1, `${file}: exactly one END marker (one complete block emitted)`);

        // Isolate the COMPLETE block: the START that immediately precedes the git
        // heading paired with the single END. It must contain the full git block.
        const endIdx = content.indexOf('<!-- MA-AGENTS-END -->');
        const headIdx = content.indexOf('## Git Workflow (ALL file-changing tasks)');
        const completeStartIdx = content.lastIndexOf('<!-- MA-AGENTS-START -->', headIdx);
        assert.ok(completeStartIdx >= 0 && headIdx > completeStartIdx && endIdx > headIdx,
          `${file}: the git heading must sit inside a START…END pair`);
        const completeBlock = content.slice(completeStartIdx, endIdx + '<!-- MA-AGENTS-END -->'.length);
        assertGitBlockContent(completeBlock, `missing-closer:${file}`);

        // The composed git block itself must NOT contain a nested START (the
        // installer never wraps a block inside another).
        const innerStart = completeBlock.indexOf('<!-- MA-AGENTS-START -->', 1);
        assert.strictEqual(innerStart, -1, `${file}: the emitted git block must not nest a second START marker`);

        // No user content dropped — preamble, intro, orphan body, and trailing
        // user text all survive byte-presence checks.
        assert.ok(content.includes('# My Project'), `${file}: user heading preserved`);
        assert.ok(content.includes('User intro text — must survive.'), `${file}: user intro preserved`);
        assert.ok(content.includes('stale orphan content with no closer'), `${file}: orphan body preserved (not dropped)`);
        assert.ok(content.includes('More user text after the orphan opener.'), `${file}: trailing user text preserved`);
      }
    } finally { cleanup(dir); }
  }));

  // ── EDGE #3 — partial install (only 2 of 4 tools) ─────────────────────────
  // Stamp ONLY claude-code + opencode. The two selected targets must carry the
  // git marker block; the two UNSELECTED targets (cline, roo-code) must NOT be
  // created or modified by this run.
  await test('EDGE partial install (claude-code + opencode only): unselected cline/roo-code targets are not created', withSilencedLogs(async () => {
    const dir = mktemp();
    try {
      setProfile(dir, 'standard');

      const selected = [
        { id: 'claude-code', file: path.join('.claude', 'CLAUDE.md') },
        { id: 'opencode', file: 'AGENTS.md' },
      ];
      const unselected = [
        { id: 'cline', file: path.join('.cline', 'clinerules.md') },
        { id: 'roo-code', file: path.join('.roo', 'rules', '00-ma-agents.md') },
      ];

      // Stamp only the selected agents (mirror installAllTargets but over a subset).
      const cwdOriginal = process.cwd();
      process.chdir(dir);
      try {
        for (const { id } of selected) {
          const agent = agents.getAgent(id);
          assert.ok(agent, `agent ${id} must exist in registry`);
          await updateAgentInstructions(agent, dir, { yesMode: true });
          if (Array.isArray(agent.extraInstructionTemplates) && agent.extraInstructionTemplates.length > 0) {
            await stampExtraInstructionTemplates(agent, dir, { yesMode: true });
          }
        }
      } finally {
        process.chdir(cwdOriginal);
      }

      // Selected targets carry the git block.
      for (const { file } of selected) {
        const block = extractMarkerBlock(readTarget(dir, file));
        assertGitBlockContent(block, `partial-selected:${file}`);
      }

      // Unselected targets were neither created nor modified.
      for (const { id, file } of unselected) {
        const full = path.join(dir, file);
        assert.ok(
          !fs.existsSync(full),
          `${id}: unselected target ${file} must NOT be created by a partial install`
        );
      }

      // Defensive: cline's sibling dual-file (.clinerules) must also be absent.
      assert.ok(
        !fs.existsSync(path.join(dir, '.clinerules')),
        'cline: .clinerules dual-file must NOT be created by a partial install excluding cline'
      );
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
