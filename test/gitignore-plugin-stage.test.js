// Story 22.8 — ensurePluginStageIgnored() behaviour tests
// F2a — fixed call site: project-root only (NOT per-agent skills directory).
//
// Verifies that the installer appends `.ma-agents-plugin-stage/` to the target
// project's `.gitignore` idempotently, preserves all pre-existing entries
// verbatim, and creates the file when absent. The pre-F2a buggy behavior
// (per-skill-dir `.gitignore` files) is asserted-against in the regression
// suite at the bottom of this file.

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { ensurePluginStageIgnored, ensureBmadDirIgnored, ensureKnowledgeSiteIgnored } = require('../lib/installer');
const { PLUGIN_STAGE_DIR_NAME, ensurePluginStageGitignoredForProject } = require('../lib/bmad');

const CANONICAL_ENTRY = `${PLUGIN_STAGE_DIR_NAME}/`;
const BMAD_CANONICAL_ENTRY = '_bmad/';
const KNOWLEDGE_SITE_CANONICAL_ENTRY = '_bmad-output/knowledge-site/';

function makeProject(gitignoreContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-22-8-'));
  if (gitignoreContent !== null) {
    fs.writeFileSync(path.join(dir, '.gitignore'), gitignoreContent, 'utf-8');
  }
  return dir;
}

// ─── AC 1: entry appended to existing .gitignore ─────────────────────────────
test('AC1 — appends .ma-agents-plugin-stage/ when .gitignore exists without it', () => {
  const dir = makeProject('node_modules/\ndist/\n');
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(written.includes(CANONICAL_ENTRY), 'entry must be appended');
  assert.ok(written.includes('node_modules/'), 'existing node_modules/ preserved');
  assert.ok(written.includes('dist/'), 'existing dist/ preserved');
});

// ─── AC 2: file created when absent ──────────────────────────────────────────
test('AC2 — creates .gitignore with single entry when absent', () => {
  const dir = makeProject(null);
  assert.ok(!fs.existsSync(path.join(dir, '.gitignore')), 'precondition: no .gitignore');
  ensurePluginStageIgnored(dir);
  assert.ok(fs.existsSync(path.join(dir, '.gitignore')), '.gitignore must be created');
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.strictEqual(
    written.trim().split(/\r?\n/).filter(Boolean).length,
    1,
    'newly-created .gitignore must have exactly one non-blank line'
  );
  assert.ok(written.includes(CANONICAL_ENTRY), 'entry must be the canonical form');
  assert.ok(written.endsWith('\n'), 'file must end with trailing newline');
});

// ─── AC 3: append-only — pre-existing lines preserved verbatim ───────────────
test('AC3 — pre-existing lines preserved verbatim (byte-identical prefix)', () => {
  const original = 'node_modules/\n.env\n# a comment\nbuild/\n';
  const dir = makeProject(original);
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(
    written.startsWith(original),
    'all original lines (including comments) must remain as a verbatim prefix'
  );
});

// ─── AC 4: idempotent — re-run produces no duplicate ─────────────────────────
test('AC4 — re-running the installer does not duplicate the entry', () => {
  const dir = makeProject('node_modules/\n');
  ensurePluginStageIgnored(dir);                                     // append
  const after1 = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const mtime1 = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;

  ensurePluginStageIgnored(dir);                                     // no-op
  const after2 = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const mtime2 = fs.statSync(path.join(dir, '.gitignore')).mtimeMs;

  assert.strictEqual(after1, after2, 'second run must leave file content unchanged');
  assert.strictEqual(mtime1, mtime2, 'second run must not rewrite the file');

  // Count occurrences across all pattern variants.
  const count = after2
    .split(/\r?\n/)
    .filter(l => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      return [
        PLUGIN_STAGE_DIR_NAME,
        `${PLUGIN_STAGE_DIR_NAME}/`,
        `/${PLUGIN_STAGE_DIR_NAME}`,
        `/${PLUGIN_STAGE_DIR_NAME}/`,
      ].includes(trimmed);
    }).length;
  assert.strictEqual(count, 1, 'entry must appear exactly once after re-run');
});

// ─── AC 5: ma-agents own .gitignore lists the entry ──────────────────────────
test('AC5 — ma-agents repo own .gitignore contains .ma-agents-plugin-stage/', () => {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf-8');
  const active = gitignore.split(/\r?\n/).filter(l => !l.trim().startsWith('#'));
  assert.ok(
    active.some(l => l.trim() === CANONICAL_ENTRY || l.trim() === PLUGIN_STAGE_DIR_NAME),
    'own .gitignore must list the plugin-stage directory'
  );
});

// ─── Edge case: pre-existing bare entry (no trailing /) → no duplicate ───────
test('edge — pre-existing bare .ma-agents-plugin-stage is treated as equivalent', () => {
  const dir = makeProject(`node_modules/\n${PLUGIN_STAGE_DIR_NAME}\n`);
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  // Must NOT have added the canonical form on top of the bare form.
  const canonicalCount = (written.match(new RegExp(`^${CANONICAL_ENTRY.replace('.', '\\.')}$`, 'gm')) || []).length;
  assert.strictEqual(canonicalCount, 0, 'must not add canonical form when bare form already present');
});

// ─── Edge case: leading-slash variant already present → no duplicate ─────────
test('edge — leading-slash variant /.ma-agents-plugin-stage/ is recognized', () => {
  const dir = makeProject(`node_modules/\n/${PLUGIN_STAGE_DIR_NAME}/\n`);
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const canonicalCount = (written.match(new RegExp(`^${CANONICAL_ENTRY.replace('.', '\\.')}$`, 'gm')) || []).length;
  assert.strictEqual(canonicalCount, 0, 'must not duplicate when leading-slash form present');
});

// ─── Edge case: file lacks trailing newline → append lands on its own line ──
test('edge — file without trailing newline gets a newline before the append', () => {
  const dir = makeProject('node_modules/'); // no trailing \n
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(
    written.includes(`node_modules/\n${CANONICAL_ENTRY}`),
    'append must not concatenate to the previous line'
  );
});

// ─── Edge case: commented-out entry does not satisfy the policy ──────────────
test('edge — commented-out entry is ignored; active entry is appended', () => {
  const dir = makeProject(`# ${CANONICAL_ENTRY}\nnode_modules/\n`);
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).filter(l => l.trim() === CANONICAL_ENTRY);
  assert.strictEqual(active.length, 1, 'exactly one active entry must be present');
  assert.ok(written.includes(`# ${CANONICAL_ENTRY}`), 'original commented line must be preserved');
});

// ─── Edge case: CRLF line endings preserved on append ────────────────────────
test('edge — CRLF file retains CRLF endings after append', () => {
  const dir = makeProject('node_modules/\r\ndist/\r\n');
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(written.includes('\r\n'), 'CRLF file must keep CRLF endings');
  assert.ok(written.includes(`${CANONICAL_ENTRY}\r\n`), 'appended entry must use CRLF');
  assert.ok(written.startsWith('node_modules/\r\ndist/\r\n'), 'existing CRLF lines preserved');
});

// ─── Smoke scenario matching story AC 5 ──────────────────────────────────────
test('smoke — scratch project retains originals and gains exactly one new line', () => {
  const dir = makeProject('node_modules/\n.env\n');
  ensurePluginStageIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const lines = written.split(/\r?\n/).filter(Boolean);
  assert.ok(lines.includes('node_modules/'), 'node_modules/ preserved');
  assert.ok(lines.includes('.env'), '.env preserved');
  assert.ok(lines.includes(CANONICAL_ENTRY), 'canonical entry appended');
  assert.strictEqual(lines.length, 3, 'exactly three non-blank lines');

  // Re-run — no duplicate
  ensurePluginStageIgnored(dir);
  const rerun = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const rerunCanonical = rerun.split(/\r?\n/).filter(l => l === CANONICAL_ENTRY).length;
  assert.strictEqual(rerunCanonical, 1, 'exactly one canonical entry after re-run');
});

// ─── F2a — defensive guard: undefined/null projectRoot is a no-op ───────────
test('F2a — undefined projectRoot is a no-op (does not write to cwd)', () => {
  const before = fs.readdirSync(process.cwd());
  // Intentionally pass an invalid argument — pre-F2a this would have produced
  // `path.join(undefined, '.gitignore')` (throw) or written into cwd.
  ensurePluginStageIgnored(undefined);
  ensurePluginStageIgnored(null);
  ensurePluginStageIgnored('');
  const after = fs.readdirSync(process.cwd());
  assert.deepStrictEqual(after.sort(), before.sort(),
    'cwd contents must not change when projectRoot is invalid');
});

// ─── F2a — wrapper helper guards same way ───────────────────────────────────
test('F2a — ensurePluginStageGitignoredForProject is a no-op for invalid input', () => {
  // Should not throw and should not write anywhere.
  ensurePluginStageGitignoredForProject(undefined);
  ensurePluginStageGitignoredForProject(null);
  ensurePluginStageGitignoredForProject('');
});

// ─── F2a regression — verifier-level invariant ──────────────────────────────
//
// The Story 22.9 offline-install CI verifier asserts that, after install, the
// project-root `.gitignore` lists `.ma-agents-plugin-stage` and NO per-skill
// dirs contain a `.gitignore` produced by the stage-dir policy. This test
// mirrors that invariant in unit form: invoking the policy at project-root
// must (a) write to the project root, (b) leave per-agent skills dirs
// untouched.
test('F2a regression — project-root only, no per-skill-dir .gitignore created', () => {
  const dir = makeProject('node_modules/\n.env\n');

  // Pre-create the agent-skill directory tree that the buggy 22.8 placement
  // would have written into. The fix MUST NOT touch any of these dirs.
  const perAgentSkillDirs = [
    path.join(dir, '.claude', 'skills'),
    path.join(dir, '.cline', 'skills'),
    path.join(dir, '.github', 'copilot', 'skills'),
    path.join(dir, '.roo', 'skills'),
    path.join(dir, '.kilocode', 'skills'),
  ];
  for (const d of perAgentSkillDirs) fs.mkdirSync(d, { recursive: true });

  // Invoke through the canonical wrapper used by the bmad orchestrators.
  ensurePluginStageGitignoredForProject(dir);

  // (a) Project-root .gitignore has the entry exactly once.
  const rootContent = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const rootMatches = rootContent
    .split(/\r?\n/)
    .filter(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return false;
      return [
        PLUGIN_STAGE_DIR_NAME,
        `${PLUGIN_STAGE_DIR_NAME}/`,
        `/${PLUGIN_STAGE_DIR_NAME}`,
        `/${PLUGIN_STAGE_DIR_NAME}/`,
      ].includes(t);
    }).length;
  assert.strictEqual(rootMatches, 1,
    'project-root .gitignore must contain exactly one stage-dir entry');

  // (b) NO .gitignore exists in any per-agent skill directory.
  for (const d of perAgentSkillDirs) {
    const stray = path.join(d, '.gitignore');
    assert.ok(!fs.existsSync(stray),
      `pre-F2a buggy file must not appear: ${stray}`);
  }
});

// ─── F2a regression — re-run idempotency at project root ────────────────────
test('F2a regression — re-running orchestrator wrapper does not duplicate the entry', () => {
  const dir = makeProject('node_modules/\n');
  // Three invocations to mirror the install/migrate/update orchestrators each
  // calling the wrapper independently in the same install pipeline.
  ensurePluginStageGitignoredForProject(dir);
  ensurePluginStageGitignoredForProject(dir);
  ensurePluginStageGitignoredForProject(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const matches = written
    .split(/\r?\n/)
    .filter(l => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return false;
      return [
        PLUGIN_STAGE_DIR_NAME,
        `${PLUGIN_STAGE_DIR_NAME}/`,
        `/${PLUGIN_STAGE_DIR_NAME}`,
        `/${PLUGIN_STAGE_DIR_NAME}/`,
      ].includes(t);
    }).length;
  assert.strictEqual(matches, 1,
    'three orchestrator-wrapper calls must produce exactly one entry');
});

// ─── Bug 27.11 — ensureBmadDirIgnored() behaviour ────────────────────────────

test('27.11 — appends _bmad/ when .gitignore exists without it', () => {
  const dir = makeProject('node_modules/\n');
  ensureBmadDirIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(written.includes(BMAD_CANONICAL_ENTRY), '_bmad/ must be appended');
  assert.ok(written.includes('node_modules/'), 'existing entry preserved');
});

test('27.11 — creates .gitignore with _bmad/ when absent', () => {
  const dir = makeProject(null);
  ensureBmadDirIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(written.includes(BMAD_CANONICAL_ENTRY));
  assert.ok(written.endsWith('\n'));
});

test('27.11 — idempotent: re-run does not duplicate _bmad/', () => {
  const dir = makeProject('node_modules/\n');
  ensureBmadDirIgnored(dir);
  ensureBmadDirIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const count = written.split(/\r?\n/).filter(l => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return false;
    return ['_bmad', '_bmad/', '/_bmad', '/_bmad/'].includes(t);
  }).length;
  assert.strictEqual(count, 1, '_bmad/ must appear exactly once after re-run');
});

test('27.11 — ignores _bmad/ but NOT _bmad-output/ (distinct entries)', () => {
  // Critical: _bmad-output is tracked project knowledge and must never be matched
  // by the _bmad/ policy.
  const dir = makeProject('node_modules/\n');
  ensureBmadDirIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  assert.ok(active.includes('_bmad/'), '_bmad/ must be ignored');
  assert.ok(!active.some(l => l.startsWith('_bmad-output')), '_bmad-output must NOT be added to .gitignore');
});

test('27.11 — does not re-add _bmad/ when _bmad-output/ already present (no false match)', () => {
  // A project that tracks _bmad-output (not gitignored) but the test sets up a
  // pre-existing unrelated _bmad-output line; ensure we still add _bmad/ since
  // _bmad-output is a different entry and must not satisfy the _bmad/ check.
  const dir = makeProject('node_modules/\n_bmad-output/build/\n');
  ensureBmadDirIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  assert.ok(active.includes('_bmad/'), '_bmad/ must be added even when an unrelated _bmad-output line exists');
});

test('27.11 — wrapper ensurePluginStageGitignoredForProject adds both entries', () => {
  const dir = makeProject('node_modules/\n');
  ensurePluginStageGitignoredForProject(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  assert.ok(active.includes(CANONICAL_ENTRY), 'plugin-stage entry present');
  assert.ok(active.includes(BMAD_CANONICAL_ENTRY), '_bmad/ entry present');
  // Story 29.1 — the wrapper must also add the Knowledge Atlas site entry.
  assert.ok(active.includes(KNOWLEDGE_SITE_CANONICAL_ENTRY), 'knowledge-site entry present');
  // _bmad-output/ itself (tracked project knowledge) must never be ignored.
  // Story 29.1: _bmad-output/knowledge-site/ is added as a specific subdir
  // gitignore entry — that is intentional and does NOT gitignore _bmad-output/.
  const BARE_BMAD_OUTPUT_PATTERNS = ['_bmad-output', '_bmad-output/', '/_bmad-output', '/_bmad-output/'];
  assert.ok(
    !active.some(l => BARE_BMAD_OUTPUT_PATTERNS.includes(l)),
    '_bmad-output/ root must remain tracked (only specific subdirs like knowledge-site/ are ignored)'
  );
});

test('27.11 — invalid projectRoot is a no-op', () => {
  assert.doesNotThrow(() => {
    ensureBmadDirIgnored(undefined);
    ensureBmadDirIgnored(null);
    ensureBmadDirIgnored('');
  });
});

// ─── Story 29.1 — ensureKnowledgeSiteIgnored() behaviour ─────────────────────
test('29.1 — appends _bmad-output/knowledge-site/ when .gitignore exists without it', () => {
  const dir = makeProject('node_modules/\ndist/\n');
  ensureKnowledgeSiteIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(written.includes(KNOWLEDGE_SITE_CANONICAL_ENTRY), 'knowledge-site entry must be appended');
  assert.ok(written.includes('node_modules/'), 'existing node_modules/ preserved');
});

test('29.1 — creates .gitignore with the knowledge-site entry when absent', () => {
  const dir = makeProject(null); // no .gitignore
  ensureKnowledgeSiteIgnored(dir);
  const giPath = path.join(dir, '.gitignore');
  assert.ok(fs.existsSync(giPath), '.gitignore must be created');
  const written = fs.readFileSync(giPath, 'utf-8');
  assert.ok(written.includes(KNOWLEDGE_SITE_CANONICAL_ENTRY), 'knowledge-site entry must be present');
});

test('29.1 — idempotent: re-run does not duplicate the knowledge-site entry', () => {
  const dir = makeProject('node_modules/\n');
  ensureKnowledgeSiteIgnored(dir);
  ensureKnowledgeSiteIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const count = written.split(/\r?\n/).map(l => l.trim()).filter(l => l === KNOWLEDGE_SITE_CANONICAL_ENTRY).length;
  assert.strictEqual(count, 1, 'knowledge-site entry must appear exactly once after two runs');
});

test('29.1 — broader _bmad-output/ entry already present → no redundant append', () => {
  // If the project already gitignores the whole _bmad-output tree, knowledge-site
  // is implicitly covered; we must NOT append a redundant nested entry.
  const dir = makeProject('node_modules/\n_bmad-output/\n');
  ensureKnowledgeSiteIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  assert.ok(
    !active.includes(KNOWLEDGE_SITE_CANONICAL_ENTRY),
    'must not append knowledge-site/ when the parent _bmad-output/ is already ignored'
  );
});

test('29.1 — unrelated _bmad-output-archive entry does NOT block the append (no false parent match)', () => {
  const dir = makeProject('node_modules/\n_bmad-output-archive/\n');
  ensureKnowledgeSiteIgnored(dir);
  const written = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  const active = written.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  assert.ok(
    active.includes(KNOWLEDGE_SITE_CANONICAL_ENTRY),
    'an unrelated _bmad-output-archive entry must not be mistaken for the _bmad-output parent'
  );
});

test('29.1 — invalid projectRoot is a no-op (does not throw)', () => {
  assert.doesNotThrow(() => {
    ensureKnowledgeSiteIgnored(undefined);
    ensureKnowledgeSiteIgnored(null);
    ensureKnowledgeSiteIgnored('');
  });
});

// ─── F2a regression — wrapper survives non-fatal write failures ─────────────
//
// Edge case from review: project-root `.gitignore` may be read-only (e.g.,
// CI cache symlink, locked by editor on Windows). The wrapper must log and
// continue rather than abort the install pipeline.
test('F2a regression — read-only .gitignore yields a warning, not a throw', () => {
  const dir = makeProject('node_modules/\n');
  const gi = path.join(dir, '.gitignore');
  // Drop write permission. On Windows, fs.chmodSync(0o444) only sets read-only
  // on the file's archive bit; the underlying NTFS ACL still allows writes for
  // the owner, so this guard mostly exercises the POSIX path. The assertion
  // is that the call DOES NOT THROW — write success on Windows is acceptable.
  fs.chmodSync(gi, 0o444);
  try {
    assert.doesNotThrow(
      () => ensurePluginStageGitignoredForProject(dir),
      'wrapper must not propagate EACCES from read-only .gitignore'
    );
  } finally {
    fs.chmodSync(gi, 0o644); // restore for test cleanup
  }
});
