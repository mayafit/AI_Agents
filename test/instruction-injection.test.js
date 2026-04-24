#!/usr/bin/env node
/**
 * Tests for Story 8.1: Move Instruction Injection to TOP Priority Position
 *
 * Tests findInsertionPoint() helper and top-insertion behavior in updateAgentInstructions().
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

async function asyncTest(name, fn) {
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

// Load functions under test
const { findInsertionPoint, _testUpdateAgentInstructions: updateFn } = require('../lib/installer');

// ─── Task 1: findInsertionPoint() unit tests ────────────────────────────────

console.log('\nTask 1 — findInsertionPoint() with skipPatterns');

test('1.1: returns 0 for empty content with no skip patterns', () => {
  assert.strictEqual(findInsertionPoint('', []), 0);
});

test('1.2: returns 0 for content with no skip patterns', () => {
  const content = '# Hello World\nSome content here.\n';
  assert.strictEqual(findInsertionPoint(content, []), 0);
});

test('1.3: skips YAML frontmatter with --- pattern', () => {
  const content = '---\ntitle: Test\ndate: 2026-01-01\n---\n# Hello\nContent here.\n';
  const idx = findInsertionPoint(content, ['---']);
  assert.strictEqual(idx, content.indexOf('# Hello'));
});

test('1.4: skips YAML frontmatter at very start of file', () => {
  const content = '---\nkey: value\n---\nBody text';
  const idx = findInsertionPoint(content, ['---']);
  assert.strictEqual(idx, content.indexOf('Body text'));
});

test('1.5: does not skip --- that is not at the beginning of the file', () => {
  const content = '# Title\nSome text\n---\nMore text\n';
  const idx = findInsertionPoint(content, ['---']);
  assert.strictEqual(idx, 0);
});

test('1.6: handles frontmatter with trailing newline correctly', () => {
  const content = '---\ntitle: Test\n---\n\n# Content\n';
  const idx = findInsertionPoint(content, ['---']);
  const expected = content.indexOf('\n# Content');
  assert.strictEqual(idx, expected);
});

test('1.7: returns 0 for empty content with --- pattern', () => {
  assert.strictEqual(findInsertionPoint('', ['---']), 0);
});

test('1.8: handles file with only frontmatter (no body)', () => {
  const content = '---\ntitle: Only FM\n---\n';
  const idx = findInsertionPoint(content, ['---']);
  assert.strictEqual(idx, content.length);
});

test('1.9: handles multiple --- later in file (horizontal rules) — only skips frontmatter pair', () => {
  const content = '---\ntitle: Test\n---\n# Heading\n\n---\n\nMore content\n';
  const idx = findInsertionPoint(content, ['---']);
  assert.strictEqual(idx, content.indexOf('# Heading'));
});

test('1.10: empty skipPatterns array returns 0', () => {
  const content = '---\ntitle: Test\n---\nContent';
  assert.strictEqual(findInsertionPoint(content, []), 0);
});

test('1.11: undefined skipPatterns defaults to empty and returns 0', () => {
  const content = '---\ntitle: Test\n---\nContent';
  assert.strictEqual(findInsertionPoint(content, undefined), 0);
});

// ─── Task 2 & 3: Integration tests — top-insertion behavior ─────────────────

console.log('\nTask 2 & 3 — updateAgentInstructions() top-insertion');

const MARKER_START = '<!-- MA-AGENTS-START -->';
const MARKER_END = '<!-- MA-AGENTS-END -->';

async function withTempDir(fn) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma-agents-test-'));
  try {
    await fn(tmpDir);
  } finally {
    await fs.remove(tmpDir);
  }
}

function createMockAgent(instructionFiles, opts = {}) {
  return {
    instructionFiles,
    category: opts.category || 'ide',
    getProjectPath: () => '/mock/path',
    ...(opts.injectionStrategy ? { injectionStrategy: opts.injectionStrategy } : {})
  };
}

(async () => {
  await asyncTest('2.1: new file without frontmatter — block starts at position 0, no leading blank line', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.startsWith(MARKER_START),
        `File should start with marker, got: "${content.slice(0, 40)}..."`);
    });
  });

  await asyncTest('2.2: existing file without frontmatter — block inserted at top, no leading blank line', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '# Existing Content\nSome text.\n');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.startsWith(MARKER_START),
        `File should start with marker, got: "${content.slice(0, 40)}..."`);
      const contentIdx = content.indexOf('# Existing Content');
      assert.ok(contentIdx > 0, 'Original content should still exist');
    });
  });

  await asyncTest('2.3: existing file with YAML frontmatter — block after frontmatter, before content', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '---\ntitle: Test\n---\n# Content\nBody text.\n');
      const agent = createMockAgent(['test-instructions.md'], {
        injectionStrategy: { position: 'top', skipPatterns: ['---'] }
      });
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      const fmEnd = content.indexOf('---\n', 4) + 4;
      const blockIdx = content.indexOf(MARKER_START);
      const bodyIdx = content.indexOf('# Content');
      assert.ok(blockIdx >= fmEnd, `Block (${blockIdx}) should be at or after frontmatter end (${fmEnd})`);
      assert.ok(blockIdx < bodyIdx, `Block (${blockIdx}) should be before body content (${bodyIdx})`);
    });
  });

  await asyncTest('2.4: replace-in-place — second run replaces block, no duplicates', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '# Content\nBody.\n');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      const count = (content.match(new RegExp(MARKER_START, 'g')) || []).length;
      assert.strictEqual(count, 1, `Should have exactly 1 marker block, found ${count}`);
    });
  });

  await asyncTest('2.5: exactly one blank line separates block from subsequent content', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '# Content\nBody.\n');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      const endIdx = content.indexOf(MARKER_END) + MARKER_END.length;
      const between = content.slice(endIdx, content.indexOf('# Content'));
      // Exactly two newlines: one closing the marker line, one blank separator
      assert.strictEqual(between, '\n\n',
        `Expected exactly "\\n\\n" between block and content, got: ${JSON.stringify(between)}`);
    });
  });

  // ─── Task 4: Edge case tests ─────────────────────────────────────────────

  console.log('\nTask 4 — Edge cases');

  await asyncTest('4.1: empty file — block is sole content', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.startsWith(MARKER_START), 'Should start with marker block');
      assert.ok(content.includes(MARKER_END), 'Should contain end marker');
    });
  });

  await asyncTest('4.2: file with only YAML frontmatter — block after frontmatter', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '---\ntitle: Only FM\n---\n');
      const agent = createMockAgent(['test-instructions.md'], {
        injectionStrategy: { position: 'top', skipPatterns: ['---'] }
      });
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      const blockIdx = content.indexOf(MARKER_START);
      assert.ok(blockIdx > content.lastIndexOf('---\n', blockIdx - 1),
        'Block should be after frontmatter');
    });
  });

  await asyncTest('4.3: file with no frontmatter — block at position 0', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '# Just a heading\nSome text\n');
      const agent = createMockAgent(['test-instructions.md']);
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.startsWith(MARKER_START),
        `File should start with marker, got: "${content.slice(0, 40)}..."`);
      assert.ok(content.includes('# Just a heading'), 'Original content preserved');
    });
  });

  await asyncTest('4.4: multiple --- (horizontal rules) — only skip frontmatter pair', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'test-instructions.md');
      await fs.writeFile(filePath, '---\ntitle: Test\n---\n# Heading\n\n---\n\nMore content\n');
      const agent = createMockAgent(['test-instructions.md'], {
        injectionStrategy: { position: 'top', skipPatterns: ['---'] }
      });
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      const blockIdx = content.indexOf(MARKER_START);
      const headingIdx = content.indexOf('# Heading');
      assert.ok(blockIdx < headingIdx, 'Block should be between frontmatter and heading, not after horizontal rule');
    });
  });

  await asyncTest('4.5: BMAD agent with existing file — receives top-insert same as IDE agents', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'bmad-agent.md');
      // BMAD file exists (deployed by bmad-method via --custom-source, Story 22.6), so it should get injection
      await fs.writeFile(filePath, '---\nname: SRE Agent\n---\n# Agent Definition\nContent.\n');
      const agent = createMockAgent(['bmad-agent.md'], {
        category: 'bmad',
        injectionStrategy: { position: 'top', skipPatterns: ['---'] }
      });
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.includes(MARKER_START), 'Existing BMAD file should receive injection');
      const blockIdx = content.indexOf(MARKER_START);
      const defIdx = content.indexOf('# Agent Definition');
      assert.ok(blockIdx < defIdx, 'Block should be before agent definition content');
    });
  });

  await asyncTest('4.5b: BMAD agent with non-existent file — skipped (not created)', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'bmad-missing.md');
      const agent = createMockAgent(['bmad-missing.md'], { category: 'bmad' });
      await updateFn(agent, tmpDir);
      const exists = await fs.pathExists(filePath);
      assert.strictEqual(exists, false, 'Non-existent BMAD file should NOT be created');
    });
  });

  await asyncTest('4.6: Cline dual instruction files — both receive top-insertion', async () => {
    await withTempDir(async (tmpDir) => {
      const mdPath = path.join(tmpDir, 'clinerules.md');
      const noExtPath = path.join(tmpDir, 'clinerules');
      await fs.writeFile(mdPath, '# Cline Rules MD\nContent.\n');
      await fs.writeFile(noExtPath, '# Cline Rules NoExt\nContent.\n');
      const agent = createMockAgent(['clinerules.md', 'clinerules']);
      await updateFn(agent, tmpDir);
      const contentMd = await fs.readFile(mdPath, 'utf-8');
      const contentNoExt = await fs.readFile(noExtPath, 'utf-8');
      assert.ok(contentMd.includes(MARKER_START), '.md file should have block');
      assert.ok(contentNoExt.includes(MARKER_START), 'no-ext file should have block');
      assert.ok(contentMd.startsWith(MARKER_START),
        `.md file should start with marker, got: "${contentMd.slice(0, 40)}..."`);
      assert.ok(contentNoExt.startsWith(MARKER_START),
        `no-ext file should start with marker, got: "${contentNoExt.slice(0, 40)}..."`);
    });
  });

  // ─── L1: skipPatterns: ['---'] on file without frontmatter (integration) ──

  console.log('\nExtra coverage — integration edge cases');

  await asyncTest('L1: skipPatterns [---] on file without frontmatter — block at position 0', async () => {
    await withTempDir(async (tmpDir) => {
      const filePath = path.join(tmpDir, 'no-fm.md');
      await fs.writeFile(filePath, '# No Frontmatter\nJust content.\n');
      const agent = createMockAgent(['no-fm.md'], {
        injectionStrategy: { position: 'top', skipPatterns: ['---'] }
      });
      await updateFn(agent, tmpDir);
      const content = await fs.readFile(filePath, 'utf-8');
      assert.ok(content.startsWith(MARKER_START),
        `Should start with marker even with skipPatterns set, got: "${content.slice(0, 40)}..."`);
    });
  });

  // Print summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
