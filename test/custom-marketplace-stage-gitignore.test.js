// Bug B1 — ensureCustomMarketplaceStageIgnored() behaviour tests.
//
// Symptom that prompted this: a clean Project-scope install (Copilot + Cline)
// left `.ma-agents-custom-marketplace-stage/` visible as untracked noise in the
// target project. ma-agents' OWN repo ignores it, but nothing ever wrote the
// entry into a target project — installer.js had ensurePluginStageIgnored,
// ensureBmadDirIgnored and ensureKnowledgeSiteIgnored but no sibling for this
// directory, and installCustomMarketplaceSubset called no gitignore helper.
//
// Note the stage dir IS removed on the success path. It legitimately survives in
// two cases, which is exactly why it must be ignored rather than merely deleted:
//   - Story 30.6b AC 8 deliberately preserves it when the POST-invoke step fails.
//   - A later run wipes and recreates it rather than reusing it.

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  ensureCustomMarketplaceStageIgnored,
  CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
} = require('../lib/installer');
const { ensurePluginStageGitignoredForProject } = require('../lib/bmad');

const CANONICAL_ENTRY = `${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}/`;

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-cms-gitignore-'));
}
function readIgnore(root) {
  return fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
}

// ─── Drift guard ────────────────────────────────────────────────────────────
// installer.js duplicates the directory name rather than requiring it from
// custom-marketplace.js, because importing would close a require cycle
// (installer -> custom-marketplace -> bmad -> installer). That duplication is
// only safe if drift fails loud, which is this test's whole job.
test('drift guard: installer and custom-marketplace agree on the stage dir name', () => {
  const fromCustomMarketplace = require('../lib/custom-marketplace')
    .CUSTOM_MARKETPLACE_STAGE_DIR_NAME;
  assert.strictEqual(
    typeof fromCustomMarketplace,
    'string',
    'custom-marketplace.js must export CUSTOM_MARKETPLACE_STAGE_DIR_NAME'
  );
  assert.strictEqual(
    CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
    fromCustomMarketplace,
    'installer.js duplicates this name to avoid a require cycle — the two definitions have drifted apart'
  );
  assert.strictEqual(CUSTOM_MARKETPLACE_STAGE_DIR_NAME, '.ma-agents-custom-marketplace-stage');
});

// ─── Append behaviour ───────────────────────────────────────────────────────
test('creates .gitignore with the canonical entry when the file is absent', () => {
  const root = tmpProject();
  ensureCustomMarketplaceStageIgnored(root);
  assert.strictEqual(readIgnore(root), `${CANONICAL_ENTRY}\n`);
});

test('appends to an existing .gitignore and preserves prior entries verbatim', () => {
  const root = tmpProject();
  const prior = 'node_modules/\n_bmad/\n.ma-agents-plugin-stage/\n';
  fs.writeFileSync(path.join(root, '.gitignore'), prior, 'utf-8');

  ensureCustomMarketplaceStageIgnored(root);

  const after = readIgnore(root);
  assert.ok(after.startsWith(prior), 'pre-existing entries must survive byte-for-byte');
  assert.ok(after.includes(CANONICAL_ENTRY), 'canonical entry must be appended');
});

test('appends on its own line when the file lacks a trailing newline', () => {
  const root = tmpProject();
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/', 'utf-8');
  ensureCustomMarketplaceStageIgnored(root);
  assert.strictEqual(readIgnore(root), `node_modules/\n${CANONICAL_ENTRY}\n`);
});

test('preserves CRLF line endings', () => {
  const root = tmpProject();
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\r\n_bmad/\r\n', 'utf-8');
  ensureCustomMarketplaceStageIgnored(root);
  const after = readIgnore(root);
  assert.ok(after.endsWith(`${CANONICAL_ENTRY}\r\n`), 'must append using the file\'s CRLF style');
  assert.ok(!/[^\r]\n/.test(after), 'must not introduce a bare LF into a CRLF file');
});

// ─── Idempotency across every canonical variant ─────────────────────────────
for (const variant of [
  CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
  `${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}/`,
  `/${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`,
  `/${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}/`,
]) {
  test(`idempotent no-op when already ignored as "${variant}"`, () => {
    const root = tmpProject();
    const prior = `node_modules/\n${variant}\n`;
    fs.writeFileSync(path.join(root, '.gitignore'), prior, 'utf-8');

    ensureCustomMarketplaceStageIgnored(root);
    ensureCustomMarketplaceStageIgnored(root); // twice — must still not duplicate

    assert.strictEqual(readIgnore(root), prior, 'must not append a duplicate entry');
  });
}

test('a commented-out entry does NOT count as ignored', () => {
  const root = tmpProject();
  fs.writeFileSync(path.join(root, '.gitignore'), `# ${CANONICAL_ENTRY}\n`, 'utf-8');
  ensureCustomMarketplaceStageIgnored(root);
  const lines = readIgnore(root).split('\n').filter(Boolean);
  assert.ok(lines.includes(CANONICAL_ENTRY), 'an active entry must be added alongside the comment');
});

// ─── Defensive contract ─────────────────────────────────────────────────────
for (const bad of [undefined, null, '', 0, {}, []]) {
  test(`no-op on invalid projectRoot (${JSON.stringify(bad)})`, () => {
    assert.doesNotThrow(() => ensureCustomMarketplaceStageIgnored(bad));
  });
}

// ─── Aggregator wiring ──────────────────────────────────────────────────────
// The helper is reached through lib/bmad.js#ensurePluginStageGitignoredForProject,
// which installBmad / runMigration / updateBmad already call. Wiring it there —
// rather than only at the custom-marketplace call site — means a project gets the
// entry even before it opts into a custom source, so a later opt-in produces no
// untracked noise.
test('the bmad.js aggregator writes the custom-marketplace stage entry', () => {
  const root = tmpProject();
  ensurePluginStageGitignoredForProject(root);

  const after = readIgnore(root);
  assert.ok(
    after.includes(CANONICAL_ENTRY),
    'ensurePluginStageGitignoredForProject must cover the custom-marketplace stage'
  );
  // Regression: it must not have stopped covering its three prior siblings.
  assert.ok(after.includes('.ma-agents-plugin-stage/'), 'plugin-stage entry regressed');
  assert.ok(after.includes('_bmad/'), '_bmad/ entry regressed');
  assert.ok(after.includes('_bmad-output/knowledge-site/'), 'knowledge-site entry regressed');
});

test('the aggregator is idempotent — a second pass adds nothing', () => {
  const root = tmpProject();
  ensurePluginStageGitignoredForProject(root);
  const first = readIgnore(root);
  ensurePluginStageGitignoredForProject(root);
  assert.strictEqual(readIgnore(root), first, 'a repeat install must not duplicate any entry');
});
