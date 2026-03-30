#!/usr/bin/env node
/**
 * Tests for generateProjectContext() and updateProjectContextManifestPaths() — Stories 13.1, 13.2
 *
 * generateProjectContext AC coverage:
 *   3.1  single platform → one MANIFEST path in output        (AC #14)
 *   3.2  multiple platforms → correct count, correct order    (AC #15)
 *   3.3  all relative paths — no absolute path segments        (AC #9)
 *   3.4  {{MANIFEST_PATHS_LIST}} fully replaced               (AC #10)
 *   3.5  empty agents array → fallback message, no error      (AC #12)
 *   3.6  missing template → Error with path in message        (AC #13)
 *   3.7  template version comment present in output           (AC #4, NFR25)
 *   3.8  function does NOT call fs.writeFile / fs.pathExists  (AC #11)
 *   3.9  agent without skillsDir is skipped (no undefined/MANIFEST.yaml)
 *   3.10 all agents lack skillsDir → fallback message
 *
 * updateProjectContextManifestPaths AC coverage:
 *   4.1  markers present + new agent → file updated, returns true
 *   4.2  already up to date → returns false, no write
 *   4.3  no markers (old-format) → returns false, backward compatible
 *   4.4  agents without skillsDir excluded from update
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
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Module imports ─────────────────────────────────────────────────────────
// Template path derived directly — not imported from module (avoids leaking internals)
const _TEMPLATE_PATH = path.join(__dirname, '..', 'lib', 'templates', 'project-context.template.md');

let generateProjectContext, updateProjectContextManifestPaths, generateRepoLayoutSection, updateProjectContextRepoLayout;
try {
  ({ generateProjectContext, _updateProjectContextManifestPaths: updateProjectContextManifestPaths, generateRepoLayoutSection, updateProjectContextRepoLayout } = require('../lib/installer'));
} catch (e) {
  console.error('\n  FATAL: Cannot load installer module');
  console.error(' ', e.message);
  process.exit(1);
}

// Helper: agent stub with skillsDir property
function agent(skillsDir) {
  return { skillsDir };
}

// Helper: count backtick-wrapped MANIFEST.yaml path entries in content
function countManifestPaths(content) {
  const matches = content.match(/`[^`]+\/MANIFEST\.yaml`/g) || [];
  return matches.length;
}

console.log('\n generate-project-context unit tests\n');

async function runAll() {
  // 3.7 Template version comment present
  await test('3.7 template contains version comment <!-- ma-agents-template-version: 1.0 -->', async () => {
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')]);
    assert.ok(
      content.includes('<!-- ma-agents-template-version: 1.0 -->'),
      'version comment not found in output'
    );
  });

  // 3.1 Single platform → exactly one MANIFEST path
  await test('3.1 single platform → exactly one MANIFEST path entry', async () => {
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')]);
    const count = countManifestPaths(content);
    assert.strictEqual(count, 1, `expected 1 MANIFEST.yaml path entry, got ${count}`);
    assert.ok(content.includes('  - `.claude/skills/MANIFEST.yaml`'), 'expected .claude/skills path');
  });

  // 3.2 Multiple platforms → correct count and order
  await test('3.2 multiple platforms → correct count and manifest order', async () => {
    const agents = [
      agent('.claude/skills'),
      agent('.cursor/skills'),
      agent('.gemini/skills')
    ];
    const content = await generateProjectContext('/some/root', agents);
    const count = countManifestPaths(content);
    assert.strictEqual(count, 3, `expected 3 MANIFEST.yaml path entries, got ${count}`);
    const claudeIdx = content.indexOf('.claude/skills/MANIFEST.yaml');
    const cursorIdx = content.indexOf('.cursor/skills/MANIFEST.yaml');
    const geminiIdx = content.indexOf('.gemini/skills/MANIFEST.yaml');
    assert.ok(claudeIdx < cursorIdx, 'claude should appear before cursor');
    assert.ok(cursorIdx < geminiIdx, 'cursor should appear before gemini');
  });

  // 3.3 All relative paths — no absolute path segments
  await test('3.3 all paths are relative — no absolute path segments in output', async () => {
    const agents = [
      agent('.claude/skills'),
      agent('.cursor/skills')
    ];
    const content = await generateProjectContext('/some/root', agents);
    // Absolute paths start with / (unix) or X:\ (windows) inside backticks
    const hasAbsolute = /`\/[^`]+MANIFEST\.yaml`/.test(content) ||
                        /`[A-Za-z]:\\[^`]+MANIFEST\.yaml`/.test(content);
    assert.ok(!hasAbsolute, 'output contains absolute path segments');
  });

  // 3.4 {{MANIFEST_PATHS_LIST}} placeholder fully replaced
  await test('3.4 {{MANIFEST_PATHS_LIST}} placeholder fully replaced', async () => {
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')]);
    assert.ok(
      !content.includes('{{MANIFEST_PATHS_LIST}}'),
      'placeholder {{MANIFEST_PATHS_LIST}} still present in output'
    );
  });

  // 3.5 Empty agents array → fallback message, no error
  await test('3.5 empty agents array → fallback message, no error thrown', async () => {
    let content;
    try {
      content = await generateProjectContext('/some/root', []);
    } catch (err) {
      assert.fail(`should not throw with empty agents, got: ${err.message}`);
    }
    assert.ok(
      content.includes('no agents installed — run ma-agents to install skills'),
      'fallback message not found in output'
    );
    assert.ok(!content.includes('{{MANIFEST_PATHS_LIST}}'), 'placeholder not replaced in fallback case');
  });

  // 3.5b null installedAgents → fallback message
  await test('3.5b null installedAgents → fallback message, no error thrown', async () => {
    let content;
    try {
      content = await generateProjectContext('/some/root', null);
    } catch (err) {
      assert.fail(`should not throw with null agents, got: ${err.message}`);
    }
    assert.ok(
      content.includes('no agents installed — run ma-agents to install skills'),
      'fallback message not found in output'
    );
  });

  // 3.6 Missing template → Error thrown with path in message (runs after others to avoid race)
  await test('3.6 missing template file → Error thrown with template path in message', async () => {
    const backupPath = _TEMPLATE_PATH + '.bak';
    const templateExists = fs.existsSync(_TEMPLATE_PATH);
    if (templateExists) {
      fs.renameSync(_TEMPLATE_PATH, backupPath);
    }
    try {
      try {
        await generateProjectContext('/some/root', [agent('.claude/skills')]);
        assert.fail('Expected an Error to be thrown for missing template');
      } catch (err) {
        assert.ok(err instanceof Error, 'thrown value should be an Error instance');
        assert.ok(
          err.message.includes(_TEMPLATE_PATH),
          `error message should include template path. Got: ${err.message}`
        );
      }
    } finally {
      if (templateExists) {
        fs.renameSync(backupPath, _TEMPLATE_PATH);
      }
    }
  });

  // 3.8 Function returns string content — does NOT write any file
  await test('3.8 function returns content string and does not write files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-test-'));
    const beforeFiles = fs.readdirSync(tmpDir);

    const result = await generateProjectContext(tmpDir, [agent('.claude/skills')]);

    const afterFiles = fs.readdirSync(tmpDir);
    assert.strictEqual(typeof result, 'string', 'function should return a string');
    assert.ok(result.length > 0, 'returned string should not be empty');
    assert.deepStrictEqual(beforeFiles, afterFiles, 'function should not write any files to disk');

    fs.rmdirSync(tmpDir);
  });

  // 3.9 Agent without skillsDir is silently skipped (finding #4 guard)
  await test('3.9 agent with undefined skillsDir is skipped — no undefined/MANIFEST.yaml in output', async () => {
    const agents = [
      agent('.claude/skills'),
      { id: 'legacy-agent' }, // no skillsDir
      agent('.cursor/skills')
    ];
    const content = await generateProjectContext('/some/root', agents);
    assert.ok(!content.includes('undefined/MANIFEST.yaml'), 'output must not contain undefined/MANIFEST.yaml');
    const count = countManifestPaths(content);
    assert.strictEqual(count, 2, `expected 2 valid paths (legacy agent skipped), got ${count}`);
  });

  // 3.10 All agents without skillsDir → fallback message (no valid agents)
  await test('3.10 all agents lack skillsDir → fallback message rather than empty list', async () => {
    const content = await generateProjectContext('/some/root', [{ id: 'a' }, { id: 'b' }]);
    assert.ok(
      content.includes('no agents installed — run ma-agents to install skills'),
      'fallback message should appear when no valid agents have skillsDir'
    );
    assert.ok(!content.includes('undefined/MANIFEST.yaml'), 'output must not contain undefined path');
  });

  // ─── updateProjectContextManifestPaths tests (finding #5, pipeline coverage) ───

  // 4.1 Markers present + new agent → file updated, returns true
  await test('4.1 updateProjectContextManifestPaths: markers present, new agent added → returns true and updates file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-update-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');

    // Write a file that simulates a generated project-context.md with one agent
    const initial = [
      '# Project Context',
      '<!-- ma-agents:manifest-paths-start -->',
      '  - `.claude/skills/MANIFEST.yaml`',
      '<!-- ma-agents:manifest-paths-end -->',
      '## Project-Specific Rules',
      '<!-- user rules here -->'
    ].join('\n');
    fs.writeFileSync(outputPath, initial, 'utf8');

    const result = await updateProjectContextManifestPaths(outputPath, [
      agent('.claude/skills'),
      agent('.gemini/skills')
    ]);

    assert.strictEqual(result, true, 'should return true when file was updated');
    const updated = fs.readFileSync(outputPath, 'utf8');
    assert.ok(updated.includes('  - `.claude/skills/MANIFEST.yaml`'), 'claude path should be present');
    assert.ok(updated.includes('  - `.gemini/skills/MANIFEST.yaml`'), 'gemini path should be added');
    assert.ok(updated.includes('<!-- user rules here -->'), 'user-written content must be preserved');

    fs.rmSync(tmpDir, { recursive: true });
  });

  // 4.2 Markers present, no change needed → returns false, no write
  await test('4.2 updateProjectContextManifestPaths: already up to date → returns false without writing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-update-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');

    const initial = [
      '# Project Context',
      '<!-- ma-agents:manifest-paths-start -->',
      '  - `.claude/skills/MANIFEST.yaml`',
      '<!-- ma-agents:manifest-paths-end -->'
    ].join('\n');
    fs.writeFileSync(outputPath, initial, 'utf8');
    const mtime1 = fs.statSync(outputPath).mtimeMs;

    // Small delay to ensure mtime would differ if file were written
    await new Promise(r => setTimeout(r, 50));
    const result = await updateProjectContextManifestPaths(outputPath, [agent('.claude/skills')]);

    assert.strictEqual(result, false, 'should return false when no change needed');
    const mtime2 = fs.statSync(outputPath).mtimeMs;
    assert.strictEqual(mtime1, mtime2, 'file should not have been written when content unchanged');

    fs.rmSync(tmpDir, { recursive: true });
  });

  // 4.3 No markers (old-format file) → returns false, backward compatible
  await test('4.3 updateProjectContextManifestPaths: no markers in file → returns false (backward compatible)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-update-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');

    // Old-format file without markers
    const oldFormat = [
      '# Project Context',
      '1. Read the MANIFEST.yaml for your platform:',
      '  - `.claude/skills/MANIFEST.yaml`',
      '2. Load ALL skills...'
    ].join('\n');
    fs.writeFileSync(outputPath, oldFormat, 'utf8');

    const result = await updateProjectContextManifestPaths(outputPath, [
      agent('.claude/skills'),
      agent('.gemini/skills')
    ]);

    assert.strictEqual(result, false, 'should return false for old-format files without markers');
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.strictEqual(content, oldFormat, 'old-format file must not be modified');

    fs.rmSync(tmpDir, { recursive: true });
  });

  // 4.4 Markers present, agent with undefined skillsDir is excluded from update
  await test('4.4 updateProjectContextManifestPaths: agents without skillsDir are excluded', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-update-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');

    const initial = [
      '# Project Context',
      '<!-- ma-agents:manifest-paths-start -->',
      '  - `.claude/skills/MANIFEST.yaml`',
      '<!-- ma-agents:manifest-paths-end -->'
    ].join('\n');
    fs.writeFileSync(outputPath, initial, 'utf8');

    const result = await updateProjectContextManifestPaths(outputPath, [
      agent('.claude/skills'),
      { id: 'legacy' } // no skillsDir
    ]);

    assert.strictEqual(result, false, 'should return false — only valid agent already present');
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.ok(!content.includes('undefined'), 'must not introduce undefined paths');

    fs.rmSync(tmpDir, { recursive: true });
  });

  // ─── Story 16.3: generateRepoLayoutSection tests ─────────────────────────

  // 5.1 null layout → empty string
  await test('5.1 generateRepoLayoutSection: null layout returns empty string', async () => {
    assert.strictEqual(generateRepoLayoutSection(null), '');
  });

  // 5.2 single-repo (both same) → empty string
  await test('5.2 generateRepoLayoutSection: both same mode returns empty string', async () => {
    const result = generateRepoLayoutSection({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.strictEqual(result, '');
  });

  // 5.3 multi-repo returns section with markers
  await test('5.3 generateRepoLayoutSection: multi-repo returns section with markers', async () => {
    const result = generateRepoLayoutSection({
      knowledgebase: { mode: 'local', path: '/path/to/kb' },
      sprintManagement: { mode: 'local', path: '/path/to/sprint' }
    });
    assert.ok(result.includes('<!-- ma-agents:repo-layout-start -->'), 'should have start marker');
    assert.ok(result.includes('<!-- ma-agents:repo-layout-end -->'), 'should have end marker');
    assert.ok(result.includes('### Repository Layout'), 'should have section header');
    assert.ok(result.includes('/path/to/kb'), 'should include kb path');
    assert.ok(result.includes('/path/to/sprint'), 'should include sprint path');
  });

  // 5.4 mixed config: one external + one same
  await test('5.4 generateRepoLayoutSection: mixed config shows "current repository" for same', async () => {
    const result = generateRepoLayoutSection({
      knowledgebase: { mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.ok(result.includes('/ext/kb'), 'should include external kb path');
    assert.ok(result.includes('current repository (default)'), 'should show default for same mode');
    assert.ok(result.includes('planning artifacts'), 'should have kb usage instruction');
    assert.ok(!result.includes('sprint/story artifacts'), 'should NOT have sprint instruction when sprint is same');
  });

  // 5.5 path normalization
  await test('5.5 generateRepoLayoutSection: normalizes backslashes', async () => {
    const result = generateRepoLayoutSection({
      knowledgebase: { mode: 'local', path: 'C:\\Users\\dev\\kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.ok(result.includes('C:/Users/dev/kb'), 'should normalize backslashes');
    assert.ok(!result.includes('\\'), 'should not contain backslashes');
  });

  // 5.6 backward compat: generateProjectContext without layout still works
  await test('5.6 generateProjectContext: no layout param → no crash, no placeholder in output', async () => {
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')]);
    assert.ok(!content.includes('{{REPO_LAYOUT_SECTION}}'), 'placeholder should be removed');
    assert.ok(!content.includes('repo-layout-start'), 'should not have layout markers without layout');
  });

  // 5.7 generateProjectContext with multi-repo layout inserts section
  await test('5.7 generateProjectContext: multi-repo layout inserts Repository Layout section', async () => {
    const layout = {
      knowledgebase: { mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' }
    };
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')], layout);
    assert.ok(content.includes('### Repository Layout'), 'should include Repository Layout section');
    assert.ok(content.includes('/ext/kb'), 'should include kb path');
    assert.ok(content.includes('<!-- ma-agents:repo-layout-start -->'), 'should have start marker');
  });

  // 5.8 no double blank lines when section is empty
  await test('5.8 generateProjectContext: single-repo layout → no double blank lines', async () => {
    const layout = {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    };
    const content = await generateProjectContext('/some/root', [agent('.claude/skills')], layout);
    assert.ok(!content.includes('\n\n\n'), 'should not have triple newlines (double blank lines)');
    assert.ok(!content.includes('repo-layout'), 'should not have any layout markers');
  });

  // ─── updateProjectContextRepoLayout tests ──────────────────────────────────

  // 5.9 markers present → update content
  await test('5.9 updateProjectContextRepoLayout: existing markers → updates content', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');
    const initial = [
      '# Project Context',
      '<!-- ma-agents:repo-layout-start -->',
      '### Repository Layout',
      '- old content',
      '<!-- ma-agents:repo-layout-end -->',
      '## Technology Stack'
    ].join('\n');
    fs.writeFileSync(outputPath, initial, 'utf8');

    const result = await updateProjectContextRepoLayout(outputPath, {
      knowledgebase: { mode: 'local', path: '/new/kb' },
      sprintManagement: { mode: 'local', path: '/new/sprint' }
    });
    assert.strictEqual(result, true, 'should return true');
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.ok(content.includes('/new/kb'), 'should have new kb path');
    assert.ok(!content.includes('old content'), 'old content should be replaced');
    fs.rmSync(tmpDir, { recursive: true });
  });

  // 5.10 no markers + multi-repo → inserts before Technology Stack
  await test('5.10 updateProjectContextRepoLayout: no markers → inserts before Technology Stack', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');
    const initial = '# Project Context\nSome content\n\n## Technology Stack\nmore content';
    fs.writeFileSync(outputPath, initial, 'utf8');

    const result = await updateProjectContextRepoLayout(outputPath, {
      knowledgebase: { mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.strictEqual(result, true, 'should return true');
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.ok(content.includes('### Repository Layout'), 'should insert section');
    assert.ok(content.indexOf('Repository Layout') < content.indexOf('## Technology Stack'), 'section before Tech Stack');
    fs.rmSync(tmpDir, { recursive: true });
  });

  // 5.11 single-repo + no markers → returns false (nothing to do)
  await test('5.11 updateProjectContextRepoLayout: single-repo + no markers → returns false', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
    const outputPath = path.join(tmpDir, 'project-context.md');
    fs.writeFileSync(outputPath, '# Project Context\n## Technology Stack\n', 'utf8');

    const result = await updateProjectContextRepoLayout(outputPath, {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.strictEqual(result, false, 'should return false for single-repo with no markers');
    fs.rmSync(tmpDir, { recursive: true });
  });

  // 5.12 missing layout fields → no crash
  await test('5.12 generateRepoLayoutSection: missing layout fields returns empty string', async () => {
    assert.strictEqual(generateRepoLayoutSection({}), '');
    assert.strictEqual(generateRepoLayoutSection({ knowledgebase: null }), '');
  });

  // ─── Report ────────────────────────────────────────────────────────────────
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

runAll();
