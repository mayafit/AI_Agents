#!/usr/bin/env node
/**
 * Epic-30 Step-05 hardening — FR243: the closed bundle allowlist must NOT leak
 * onto the opt-in custom-marketplace install path.
 *
 * FR235/NFR73 give the AIR-GAPPED BUNDLE a closed allowlist (build-bmad-cache.js
 * bundles ONLY {tea,bmb,cis,gds,wds}; bmad-loop and any other marketplace-plugin
 * module fail closed). FR243 requires the OPPOSITE for the custom marketplace
 * source: a user may deliberately opt IN to exactly such a module (e.g. bmad-loop)
 * via `--bmad-custom-source`. If the allowlist ever leaked onto the custom path,
 * that opt-in escape hatch would be silently broken.
 *
 * This proves non-leakage two ways:
 *   1. STRUCTURAL — lib/custom-marketplace.js never imports/references the
 *      allowlist symbols (KNOWN_BUNDLED_MODULES / DISQUALIFYING_FLAGS /
 *      diffBundleSet) nor requires build-bmad-cache.js. The paths are disjoint
 *      by construction, so no leak is possible.
 *   2. FUNCTIONAL — a `bmad-loop`-shaped plugin (the exact code the bundle path
 *      fails closed on) stages cleanly through stageCustomMarketplaceSubset()
 *      when selected. Network-free local discovery fixture.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  enumerateCustomSource,
  stageCustomMarketplaceSubset,
  CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
} = require('../lib/custom-marketplace');

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

const FIXTURE_ROOT = path.join(process.cwd(), '.tmp-fr243-nonleak-test');

function writeSkill(dir, name, description) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\nBody.\n`);
}

/** Discovery-mode fixture whose marketplace declares a `bmad-loop`-shaped
 *  plugin (the exact code the bundle allowlist fails closed on) alongside a
 *  plain one. */
function makeSourceWithBmadLoop() {
  const dir = path.join(FIXTURE_ROOT, 'source');
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  writeSkill(path.join(dir, 'loop', 'skill-loop'), 'Loop Skill', 'bmad-loop opt-in skill');
  writeSkill(path.join(dir, 'plain', 'skill-plain'), 'Plain Skill', 'plain skill');
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({
      name: 'test-marketplace-with-loop',
      owner: 'ma-agents-test',
      plugins: [
        { name: 'bmad-loop', description: 'The loop orchestrator (marketplace-plugin)', version: '1.0.0', source: './loop', skills: ['./loop/skill-loop'] },
        { name: 'plain-mod', description: 'Plain', version: '1.0.0', source: './plain', skills: ['./plain/skill-plain'] },
      ],
    })
  );
  return dir;
}

(async () => {
  console.log('\nFR243 — custom-marketplace path must not inherit the bundle allowlist');

  await test('STRUCTURAL: lib/custom-marketplace.js does not reference the bundle allowlist', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'custom-marketplace.js'), 'utf8');
    for (const symbol of ['KNOWN_BUNDLED_MODULES', 'DISQUALIFYING_FLAGS', 'diffBundleSet', 'build-bmad-cache']) {
      assert.ok(!src.includes(symbol), `custom-marketplace.js must not reference "${symbol}" — the allowlist must stay disjoint from the custom-source path`);
    }
  });

  await test('FUNCTIONAL: a bmad-loop-shaped plugin stages cleanly when selected (opt-in works)', async () => {
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    try {
      const sourceDir = makeSourceWithBmadLoop();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      assert.strictEqual(enumerated.mode, 'discovery');
      assert.ok(enumerated.plugins.some((p) => p.code === 'bmad-loop' || p.name === 'bmad-loop'), 'bmad-loop must be enumerable from a custom source');

      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const result = await stageCustomMarketplaceSubset({
        source: relSource,
        mode: enumerated.mode,
        rootDir: enumerated.rootDir,
        sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins,
        selectedCodes: ['bmad-loop'],
        projectRoot,
      });

      assert.strictEqual(result.customSourceArg, `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`);
      const stagedMarketplace = JSON.parse(
        fs.readFileSync(path.join(result.stagePath, '.claude-plugin', 'marketplace.json'), 'utf8')
      );
      assert.deepStrictEqual(
        stagedMarketplace.plugins.map((p) => p.name),
        ['bmad-loop'],
        'the opted-in bmad-loop module must survive staging (allowlist must NOT exclude it here)'
      );
      assert.ok(fs.existsSync(path.join(result.stagePath, 'loop', 'skill-loop', 'SKILL.md')), 'bmad-loop content must be staged');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (errors.length > 0) {
    console.error('\nFailures:');
    for (const { name, error } of errors) {
      console.error(`  ${name}: ${error}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
})();
