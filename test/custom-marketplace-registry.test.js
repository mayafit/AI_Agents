#!/usr/bin/env node
/**
 * Custom marketplace source — registry-index format (follow-on to Epic 30).
 *
 * Covers the new third source shape (`registry`), alongside the existing
 * `discovery` / `direct` modes:
 *   1. enumerateCustomSource() detects a `registry/` layout and parses
 *      official.yaml + community-index.yaml into normalized plugin choices
 *      carrying repository / moduleDefinition / approvedSha / trustTier.
 *   2. Detection precedence: a source with BOTH .claude-plugin/marketplace.json
 *      AND registry/ resolves to `discovery` (discovery always wins).
 *   3. Two-level stage: a registry entry whose `repository` is a real git
 *      clone (from a LOCAL bare repo — network-free) with a module.yaml at
 *      `module_definition` stages the pointed module under a code/ namespace;
 *      the FR238 non-empty + unique-leaf guard holds.
 *   4. Fail-clean: malformed index YAML, an unreachable entry repository, and a
 *      zero-module resolve each throw a clean CustomMarketplaceError and stage
 *      nothing.
 *   5. Persistence: a registry install records the registry source + selected
 *      names + each entry's approved_sha (AC5) in .ma-agents.json.
 *   6. AC7: the direct-mode zero-module abort names the likely cause and points
 *      at the now-supported registry format.
 *
 * Network-free by design: the only git used is a LOCAL `git init --bare` +
 * `git clone <localBareRepo>` in the fixture builder, every git call bounded by
 * a hard timeout with GIT_TERMINAL_PROMPT=0. No real bmad-method CLI is spawned
 * (runCommand is stubbed). All temp dirs are removed in `finally`.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

const {
  enumerateCustomSource,
  CustomMarketplaceError,
  assertResolutionNonEmptyAndUniqueLeaves,
  stageRegistrySubset,
  registryTrustLabel,
  CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
} = require('../lib/custom-marketplace');
const bmad = require('../lib/bmad');
const { getCustomMarketplaceSelection, setCustomMarketplaceSelection } = require('../lib/profile');

const WORK_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-registry-test');

function freshWorkRoot() {
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  fs.mkdirSync(WORK_ROOT, { recursive: true });
}

function toRelative(absDir) {
  return './' + path.relative(process.cwd(), absDir).split(path.sep).join('/');
}

const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' };
function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', timeout: 15000, env: GIT_ENV });
}

function writeSkill(dir, name, description) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nBody.\n`
  );
}

/** Write a registry source dir with official.yaml + community-index.yaml. */
function makeRegistrySource(dir, { official = [], community = [], schemaOnly = false } = {}) {
  const regDir = path.join(dir, 'registry');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(path.join(regDir, 'registry-schema.yaml'), 'version: 1\n');
  if (schemaOnly) return dir;

  const dump = (entries) =>
    'modules:\n' +
    entries
      .map((e) =>
        Object.entries(e)
          .map(([k, v], i) => `${i === 0 ? '  - ' : '    '}${k}: ${JSON.stringify(v)}`)
          .join('\n')
      )
      .join('\n') +
    '\n';

  if (official.length) fs.writeFileSync(path.join(regDir, 'official.yaml'), dump(official));
  if (community.length) fs.writeFileSync(path.join(regDir, 'community-index.yaml'), dump(community));
  return dir;
}

/**
 * Build a real (network-free) git clone of a module repo whose working tree has
 * a module.yaml + module-help.csv at `moduleDir` and two skill subdirs. Returns
 * the absolute path to the cloned working tree (usable as an entry.repository)
 * and the resolved HEAD sha.
 */
function makeModuleRepoClone(name, moduleDir) {
  const bareDir = path.join(WORK_ROOT, `${name}-bare.git`);
  const seedDir = path.join(WORK_ROOT, `${name}-seed`);
  const cloneDir = path.join(WORK_ROOT, `${name}-clone`);
  fs.mkdirSync(bareDir, { recursive: true });
  fs.mkdirSync(seedDir, { recursive: true });

  git(['init', '--bare', '-q'], bareDir);
  git(['init', '-q'], seedDir);
  git(['config', 'user.email', 'test@ma-agents.local'], seedDir);
  git(['config', 'user.name', 'ma-agents test'], seedDir);
  git(['config', 'commit.gpgsign', 'false'], seedDir);

  const modAbs = path.join(seedDir, ...moduleDir.split('/'));
  fs.mkdirSync(modAbs, { recursive: true });
  fs.writeFileSync(path.join(modAbs, 'module.yaml'), `code: ${name}\nname: ${name}\ndescription: ${name} module\nmodule_version: "1.0.0"\n`);
  fs.writeFileSync(path.join(modAbs, 'module-help.csv'), 'module,skill,display_name\n');
  writeSkill(path.join(modAbs, 'skill-one'), 'Skill One', 'one');
  writeSkill(path.join(modAbs, 'skill-two'), 'Skill Two', 'two');

  git(['add', '-A'], seedDir);
  git(['commit', '-q', '-m', 'seed module'], seedDir);
  git(['branch', '-M', 'main'], seedDir);
  git(['remote', 'add', 'origin', bareDir], seedDir);
  git(['push', '-q', 'origin', 'main'], seedDir);
  git(['symbolic-ref', 'HEAD', 'refs/heads/main'], bareDir);

  git(['clone', '--quiet', bareDir, cloneDir]);
  const sha = git(['rev-parse', 'HEAD'], cloneDir).toString().trim();
  return { cloneDir, sha };
}

(async () => {
  console.log('\nenumerateCustomSource() — registry-index detection + parsing');

  await test('parses official + community indexes into registry-mode plugin choices', async () => {
    freshWorkRoot();
    try {
      const dir = path.join(WORK_ROOT, 'registry-src');
      makeRegistrySource(dir, {
        official: [
          { name: 'bmm-core', display_name: 'BMM Core', description: 'core', repository: 'https://github.com/bmad-code-org/bmm', module_definition: 'src/module.yaml', type: 'bmad-org', built_in: true, trust_tier: 'bmad-certified', category: 'core' },
        ],
        community: [
          { name: 'cool-ext', display_name: 'Cool Extension', description: 'ext', repository: 'https://github.com/someone/cool-ext', module_definition: 'src/skills/cool/module.yaml', type: 'community', version: '2.1.0', approved_tag: 'v2.1.0', approved_sha: 'abc123def456', trust_tier: 'unverified', category: 'utils', subcategory: 'text' },
        ],
      });
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.mode, 'registry');
      assert.strictEqual(result.plugins.length, 2);

      const byCode = Object.fromEntries(result.plugins.map((p) => [p.code, p]));
      assert.strictEqual(byCode['bmm-core'].trustTier, 'bmad-certified');
      assert.strictEqual(byCode['bmm-core'].displayName, 'BMM Core');
      assert.strictEqual(byCode['bmm-core'].repository, 'https://github.com/bmad-code-org/bmm');
      assert.strictEqual(byCode['bmm-core'].moduleDefinition, 'src/module.yaml');

      assert.strictEqual(byCode['cool-ext'].trustTier, 'unverified');
      assert.strictEqual(byCode['cool-ext'].approvedSha, 'abc123def456');
      assert.strictEqual(byCode['cool-ext'].approvedTag, 'v2.1.0');
      assert.strictEqual(byCode['cool-ext'].version, '2.1.0');
      assert.strictEqual(byCode['cool-ext'].category, 'utils');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('registryTrustLabel makes the unverified/community tier explicit', () => {
    assert.strictEqual(registryTrustLabel({ trustTier: 'bmad-certified' }), 'bmad-certified');
    assert.match(registryTrustLabel({ trustTier: 'unverified' }), /unverified\/community/);
    assert.match(registryTrustLabel({}), /unverified\/community/);
  });

  await test('official entry wins the de-dupe over a same-named community entry', async () => {
    freshWorkRoot();
    try {
      const dir = path.join(WORK_ROOT, 'registry-dup');
      makeRegistrySource(dir, {
        official: [{ name: 'dup', display_name: 'Official Dup', description: 'o', repository: 'https://github.com/org/dup', trust_tier: 'bmad-certified' }],
        community: [{ name: 'dup', display_name: 'Community Dup', description: 'c', repository: 'https://github.com/other/dup', trust_tier: 'unverified' }],
      });
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.plugins.length, 1);
      assert.strictEqual(result.plugins[0].trustTier, 'bmad-certified');
      assert.strictEqual(result.plugins[0].displayName, 'Official Dup');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('a registry/ dir with only registry-schema.yaml is still detected as registry (zero entries)', async () => {
    freshWorkRoot();
    try {
      const dir = path.join(WORK_ROOT, 'schema-only');
      makeRegistrySource(dir, { schemaOnly: true });
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.mode, 'registry');
      assert.strictEqual(result.plugins.length, 0);
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nDetection precedence — discovery wins over registry');

  await test('a source with BOTH marketplace.json AND registry/ resolves to discovery mode', async () => {
    freshWorkRoot();
    try {
      const dir = path.join(WORK_ROOT, 'both');
      makeRegistrySource(dir, {
        official: [{ name: 'reg-mod', display_name: 'Reg', description: 'r', repository: 'https://github.com/org/reg' }],
      });
      fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
      writeSkill(path.join(dir, 'alpha', 'skill-a'), 'A', 'a');
      fs.writeFileSync(
        path.join(dir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({ name: 'mp', plugins: [{ name: 'alpha-mod', description: 'Alpha', source: './alpha', skills: ['./alpha/skill-a'] }] })
      );
      const result = await enumerateCustomSource(toRelative(dir));
      assert.strictEqual(result.mode, 'discovery', 'discovery (.claude-plugin/marketplace.json) must win over registry/');
      assert.deepStrictEqual(result.plugins.map((p) => p.code), ['alpha-mod']);
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nTwo-level stage — clone entry repository + resolve module_definition');

  await test('stages a registry entry pointing at a real git clone; FR238 holds; content namespaced under code/', async () => {
    freshWorkRoot();
    try {
      const { cloneDir, sha } = makeModuleRepoClone('foo', 'modules/foo');
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const plugins = [
        {
          code: 'foo-mod',
          name: 'foo-mod',
          displayName: 'Foo',
          description: 'Foo module',
          repository: cloneDir,
          moduleDefinition: 'modules/foo/module.yaml',
          approvedSha: sha,
          approvedTag: null,
          version: '1.0.0',
          trustTier: 'unverified',
        },
      ];

      const result = await stageRegistrySubset({
        source: 'test-registry',
        plugins,
        selectedCodes: ['foo-mod'],
        projectRoot,
      });

      assert.strictEqual(result.customSourceArg, `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`);
      assert.strictEqual(result.resolvedModules.length, 1);
      assert.strictEqual(result.resolvedModules[0].strategy, 1, 'module.yaml + module-help.csv at the skills common parent => strategy 1');

      // Content copied under the entry's code/ namespace.
      assert.ok(fs.existsSync(path.join(result.stagePath, 'foo-mod', 'modules', 'foo', 'module.yaml')));
      assert.ok(fs.existsSync(path.join(result.stagePath, 'foo-mod', 'modules', 'foo', 'module-help.csv')));
      assert.ok(fs.existsSync(path.join(result.stagePath, 'foo-mod', 'modules', 'foo', 'skill-one', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(result.stagePath, 'foo-mod', 'modules', 'foo', 'skill-two', 'SKILL.md')));

      const staged = JSON.parse(fs.readFileSync(path.join(result.stagePath, '.claude-plugin', 'marketplace.json'), 'utf8'));
      assert.strictEqual(staged.plugins.length, 1);
      assert.strictEqual(staged.plugins[0].name, 'foo-mod');
      assert.deepStrictEqual(
        [...staged.plugins[0].skills].sort(),
        ['foo-mod/modules/foo/skill-one', 'foo-mod/modules/foo/skill-two']
      );
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('a Git-URL entry pins the clone via the @<tag> SOURCE SUFFIX (bmad-method has no pinOverride option)', async () => {
    // Regression guard: bmad-method's resolveSource() takes the ref ONLY as an
    // `@<tag>` suffix on the input string — it ignores any pinOverride option.
    // Passing the tag as an option (the original bug) silently floats the clone
    // to HEAD. Assert the ref actually rides on the source string.
    freshWorkRoot();
    try {
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const captured = [];
      const plugins = [
        { code: 'tagged', name: 'tagged', description: '', repository: 'https://github.com/someone/tagged-ext', moduleDefinition: null, approvedSha: 'deadbeef', approvedTag: 'v2.1.0' },
        { code: 'untagged', name: 'untagged', description: '', repository: 'https://github.com/someone/untagged-ext', moduleDefinition: null, approvedSha: null, approvedTag: null },
      ];

      for (const p of plugins) {
        await assert.rejects(
          () => stageRegistrySubset({
            source: 'test-registry',
            plugins: [p],
            selectedCodes: [p.code],
            projectRoot,
            deps: {
              // Capture the exact input string, then stop — we only assert the ref threading.
              resolveSource: async (input) => { captured.push(input); throw new Error('stop-after-capture'); },
            },
          }),
          (err) => err instanceof CustomMarketplaceError
        );
      }

      assert.strictEqual(captured[0], 'https://github.com/someone/tagged-ext@v2.1.0', 'approved_tag must be threaded as an @<tag> suffix on the source string');
      assert.strictEqual(captured[1], 'https://github.com/someone/untagged-ext', 'no approved_tag => clone the default branch, no @suffix');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nFail-clean — malformed index / unreachable repo / zero modules');

  await test('malformed index YAML throws a clean CustomMarketplaceError', async () => {
    freshWorkRoot();
    try {
      const dir = path.join(WORK_ROOT, 'malformed');
      const regDir = path.join(dir, 'registry');
      fs.mkdirSync(regDir, { recursive: true });
      fs.writeFileSync(path.join(regDir, 'official.yaml'), 'modules:\n  - name: broken\n   bad-indent: [unclosed\n');
      await assert.rejects(
        () => enumerateCustomSource(toRelative(dir)),
        (err) => err instanceof CustomMarketplaceError && /not valid YAML/.test(err.message)
      );
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('an unreachable entry repository fails clean and stages nothing', async () => {
    freshWorkRoot();
    try {
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      const plugins = [{ code: 'ghost', name: 'ghost', description: '', repository: path.join(WORK_ROOT, 'does-not-exist'), moduleDefinition: null, approvedSha: null, approvedTag: null }];
      await assert.rejects(
        () => stageRegistrySubset({ source: 'r', plugins, selectedCodes: ['ghost'], projectRoot }),
        (err) => err instanceof CustomMarketplaceError && /Could not clone registry entry 'ghost'/.test(err.message)
      );
      assert.ok(!fs.existsSync(path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)), 'nothing staged on an unreachable entry');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('a clone that resolves to zero modules aborts via the FR238 guard, staging nothing', async () => {
    freshWorkRoot();
    try {
      // A repo clone whose pointed module dir has NO skill subdirs -> zero modules.
      const emptyDir = path.join(WORK_ROOT, 'empty-clone', 'modules', 'bar');
      fs.mkdirSync(emptyDir, { recursive: true });
      fs.writeFileSync(path.join(emptyDir, 'module.yaml'), 'code: bar\nname: bar\n');
      const cloneDir = path.join(WORK_ROOT, 'empty-clone');
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const plugins = [{ code: 'bar-mod', name: 'bar-mod', description: '', repository: cloneDir, moduleDefinition: 'modules/bar/module.yaml', approvedSha: null, approvedTag: null }];
      await assert.rejects(
        () => stageRegistrySubset({ source: 'r', plugins, selectedCodes: ['bar-mod'], projectRoot }),
        (err) => err instanceof CustomMarketplaceError && /zero installable modules/.test(err.message)
      );
      assert.ok(!fs.existsSync(path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)), 'nothing staged on a zero-module resolve');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('a stale module_definition pointer fails clean', async () => {
    freshWorkRoot();
    try {
      const { cloneDir } = makeModuleRepoClone('baz', 'modules/baz');
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      const plugins = [{ code: 'baz-mod', name: 'baz-mod', description: '', repository: cloneDir, moduleDefinition: 'modules/WRONG/module.yaml', approvedSha: null, approvedTag: null }];
      await assert.rejects(
        () => stageRegistrySubset({ source: 'r', plugins, selectedCodes: ['baz-mod'], projectRoot }),
        (err) => err instanceof CustomMarketplaceError && /module_definition .* was not found/.test(err.message)
      );
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nAC7 — direct-mode zero-module abort names the likely cause + registry hint');

  await test('direct mode zero-module message points at the now-supported registry format', () => {
    assert.throws(
      () => assertResolutionNonEmptyAndUniqueLeaves([], { source: 's', mode: 'direct' }),
      (err) => err instanceof CustomMarketplaceError && /registry.*now supported/i.test(err.message) && /module\.yaml/.test(err.message)
    );
  });

  await test('non-direct mode keeps the plain zero-module message (no registry hint)', () => {
    assert.throws(
      () => assertResolutionNonEmptyAndUniqueLeaves([], { source: 's', mode: 'discovery' }),
      (err) => err instanceof CustomMarketplaceError && /zero installable modules/.test(err.message) && !/now supported/.test(err.message)
    );
  });

  console.log('\nPersistence — registry install records source + names + approved_sha (AC5)');

  await test('profile round-trip persists mode=registry with per-entry approvedSha/approvedTag', () => {
    freshWorkRoot();
    try {
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      setCustomMarketplaceSelection(projectRoot, {
        source: 'https://github.com/bmad-code-org/bmad-plugins-marketplace',
        sourceUrl: 'https://github.com/bmad-code-org/bmad-plugins-marketplace',
        mode: 'registry',
        selectedCodes: ['cool-ext'],
        sha: 'abc123def456',
        entries: [{ code: 'cool-ext', approvedSha: 'abc123def456', approvedTag: 'v2.1.0' }],
      });
      const entry = getCustomMarketplaceSelection(projectRoot);
      assert.strictEqual(entry.mode, 'registry');
      assert.deepStrictEqual(entry.selectedCodes, ['cool-ext']);
      assert.strictEqual(entry.sha, 'abc123def456');
      assert.deepStrictEqual(entry.entries, [{ code: 'cool-ext', approvedSha: 'abc123def456', approvedTag: 'v2.1.0' }]);
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  await test('installCustomMarketplaceSubset (registry mode) records approved_sha per entry on success', async () => {
    freshWorkRoot();
    try {
      const projectRoot = path.join(WORK_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: 'https://github.com/bmad-code-org/bmad-plugins-marketplace',
        sourceUrl: 'https://github.com/bmad-code-org/bmad-plugins-marketplace',
        mode: 'registry',
        selectedCodes: ['cool-ext'],
        plugins: [
          { code: 'cool-ext', name: 'cool-ext', approvedSha: 'deadbeefcafe', approvedTag: 'v2.1.0' },
          { code: 'not-selected', name: 'not-selected', approvedSha: 'ffff0000', approvedTag: null },
        ],
        rootDir: '/fake/root',
      };

      let registryStageCalls = 0;
      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection,
        deps: {
          stageRegistrySubset: async () => {
            registryStageCalls++;
            return {
              stagePath: path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME),
              customSourceArg: `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`,
              resolvedModules: [{ code: 'cool-ext', cloneSha: null }],
            };
          },
          runCommand: () => {},
        },
      });

      assert.strictEqual(success, true);
      assert.strictEqual(registryStageCalls, 1, 'registry mode must route to stageRegistrySubset');
      const persisted = getCustomMarketplaceSelection(projectRoot);
      assert.strictEqual(persisted.mode, 'registry');
      assert.deepStrictEqual(persisted.selectedCodes, ['cool-ext']);
      assert.strictEqual(persisted.sha, 'deadbeefcafe', 'top-level sha mirrors the first selected approved_sha');
      assert.deepStrictEqual(persisted.entries, [{ code: 'cool-ext', approvedSha: 'deadbeefcafe', approvedTag: 'v2.1.0' }], 'only the SELECTED entry is persisted, with its approved_sha');
    } finally {
      fs.rmSync(WORK_ROOT, { recursive: true, force: true });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => {
      console.log(`  ${name}:`);
      console.log(`    ${error}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
})();
