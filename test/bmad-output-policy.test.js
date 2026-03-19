const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Helper: create a temp project dir with a .gitignore
function makeProject(gitignoreContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-test-'));
  if (gitignoreContent !== null) {
    fs.writeFileSync(path.join(dir, '.gitignore'), gitignoreContent, 'utf-8');
  }
  return dir;
}

const { ensureBmadOutputTracked } = require('../lib/installer');

const BMAD_OUTPUT_PATTERNS = ['_bmad-output', '_bmad-output/', '/_bmad-output', '/_bmad-output/'];

// ─── Story 10.1 — ensureBmadOutputTracked() unit tests ───────────────────────

test('AC1 — removes _bmad-output/ and prints message', () => {
  const dir = makeProject('node_modules/\n_bmad-output/\ndist/\n');
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  ensureBmadOutputTracked(dir);
  console.log = orig;
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(!written.includes('_bmad-output'), 'entry must be removed');
  assert.ok(
    logs.some(l => l.includes('_bmad-output is now tracked as project knowledge (not gitignored)')),
    'must print the tracking message'
  );
});

test('AC2 — no write when .gitignore has no _bmad-output entry', () => {
  const dir = makeProject('node_modules/\ndist/\n');
  const before = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;
  ensureBmadOutputTracked(dir);
  const after = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;
  assert.strictEqual(before, after, 'file must not be written');
});

test('AC3 — no error and no file created when .gitignore absent', () => {
  const dir = makeProject(null);
  assert.doesNotThrow(() => ensureBmadOutputTracked(dir));
  assert.ok(!fs.existsSync(path.join(dir, '.gitignore')), '.gitignore must not be created');
});

test('Windows CRLF — detects and removes _bmad-output/\\r\\n', () => {
  const dir = makeProject('node_modules/\r\n_bmad-output/\r\ndist/\r\n');
  ensureBmadOutputTracked(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(!written.includes('_bmad-output'), 'CRLF entry must be removed');
});

test('Idempotency — second run does not write', () => {
  const dir = makeProject('node_modules/\n_bmad-output/\n');
  ensureBmadOutputTracked(dir);                          // first run — removes it
  const after1 = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;
  ensureBmadOutputTracked(dir);                          // second run — no-op
  const after2 = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;
  assert.strictEqual(after1, after2, 'second run must not write');
});

test('Own .gitignore contains no _bmad-output entry', () => {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf-8');
  const active = gitignore.split(/\r?\n/).filter(l => !l.trim().startsWith('#'));
  assert.ok(
    !active.some(l => BMAD_OUTPUT_PATTERNS.includes(l.trim())),
    'own .gitignore must not contain _bmad-output'
  );
});

// ─── Story 10.2 — README _bmad-output/ policy documentation tests ─────────────

const README_PATH = path.join(__dirname, '..', 'README.md');
const readmeContent = fs.readFileSync(README_PATH, 'utf-8');

test('README contains _bmad-output/ policy section heading', () => {
  assert.ok(
    readmeContent.includes('## Project Knowledge: _bmad-output/'),
    'README must contain heading "## Project Knowledge: _bmad-output/"'
  );
});

test('README contains explicit do-not-gitignore directive', () => {
  assert.ok(
    readmeContent.includes('Do not add `_bmad-output/` to your `.gitignore`'),
    'README must contain the phrase "Do not add `_bmad-output/` to your `.gitignore`"'
  );
});

test('README explains why _bmad-output/ is tracked (team alignment)', () => {
  const mentionsReason =
    readmeContent.includes('team alignment') ||
    readmeContent.includes('AI context') ||
    readmeContent.includes('planning artifacts');
  assert.ok(
    mentionsReason,
    'README must mention at least one reason for tracking (team alignment, AI context, planning artifacts)'
  );
});

test('README mentions installer removes _bmad-output/ from .gitignore', () => {
  assert.ok(
    readmeContent.includes('installer') && readmeContent.includes('.gitignore') && readmeContent.includes('_bmad-output'),
    'README must mention installer behaviour around .gitignore and _bmad-output/'
  );
});

test('_bmad-output/ section appears within first two major sections after Installation', () => {
  const sectionIdx = readmeContent.indexOf('## Project Knowledge: _bmad-output/');
  // Count H2 headings that appear before this section
  const before = readmeContent.slice(0, sectionIdx);
  const h2sBefore = (before.match(/^## /gm) || []).length;
  assert.ok(h2sBefore <= 3, `Section must be within the first few major sections, found ${h2sBefore} H2s before it`);
});
