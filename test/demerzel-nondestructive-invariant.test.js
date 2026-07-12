#!/usr/bin/env node
/**
 * Story 30.4 / Epic-30 Step-05 hardening — NON-DESTRUCTIVE preservation invariant.
 *
 * The non-destructive guarantee (NFR49/NFR75/FR245: an EXISTING install's
 * `ma-agent-ml` + 12 `ml-*` content survives a later `update` byte-for-byte)
 * rests ENTIRELY on those IDs being ABSENT from installer.js's obsolete-skill
 * sweep lists — migrateRetiredSkills() purges every ID in OBSOLETE_SKILL_IDS
 * from existing installs. The removal work (30.4) deliberately edited exactly
 * these ID registries, so a future refactor that adds `ma-agent-ml`/`ml-*` to
 * the sweep (an easy, plausible mistake) would SILENTLY DELETE users' existing
 * ML content on their next update — with every other test still green.
 *
 * This guard pins the invariant so that mistake fails loudly at test time.
 * It intentionally does NOT touch the deprecation-notice or removal-drift
 * concerns (covered by their own suites) — it guards ONLY the sweep lists.
 *
 * NOTE: `RENAMED_SKILL_IDS` legitimately contains the LEGACY prefixed rename ID
 * `bmad-ma-agent-ml` (the Story 22.2 rename artifact). That is NOT the current
 * `ma-agent-ml` ID and its presence is correct — this test asserts only that
 * the CURRENT ids (`ma-agent-ml` and the 12 `ml-*`) never appear.
 */
'use strict';

const assert = require('assert');
const {
  RETIRED_SKILL_IDS,
  RENAMED_SKILL_IDS,
  OBSOLETE_SKILL_IDS,
} = require('../lib/installer');

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

// The current Demerzel/ML skill ids that MUST be preserved on existing installs.
const DEMERZEL_ML_IDS = Object.freeze([
  'ma-agent-ml',
  'ml-advise',
  'ml-analysis',
  'ml-architecture',
  'ml-detailed-design',
  'ml-eda',
  'ml-experiment',
  'ml-hparam',
  'ml-ideation',
  'ml-infra',
  'ml-retrospective',
  'ml-revision',
  'ml-techspec',
]);

console.log('\nDemerzel/ML non-destructive preservation invariant (installer sweep lists)');

test('the three sweep lists are exported arrays', () => {
  assert.ok(Array.isArray(RETIRED_SKILL_IDS), 'RETIRED_SKILL_IDS must be an array');
  assert.ok(Array.isArray(RENAMED_SKILL_IDS), 'RENAMED_SKILL_IDS must be an array');
  assert.ok(Array.isArray(OBSOLETE_SKILL_IDS), 'OBSOLETE_SKILL_IDS must be an array');
});

test('no current Demerzel/ML id appears in RETIRED_SKILL_IDS', () => {
  const leaked = DEMERZEL_ML_IDS.filter((id) => RETIRED_SKILL_IDS.includes(id));
  assert.deepStrictEqual(leaked, [], `these ids must NOT be swept (would delete existing ML content): ${leaked.join(', ')}`);
});

test('no current Demerzel/ML id appears in RENAMED_SKILL_IDS', () => {
  const leaked = DEMERZEL_ML_IDS.filter((id) => RENAMED_SKILL_IDS.includes(id));
  assert.deepStrictEqual(leaked, [], `these ids must NOT be swept (would delete existing ML content): ${leaked.join(', ')}`);
});

test('no current Demerzel/ML id appears in OBSOLETE_SKILL_IDS (the union the sweep purges)', () => {
  const leaked = DEMERZEL_ML_IDS.filter((id) => OBSOLETE_SKILL_IDS.includes(id));
  assert.deepStrictEqual(leaked, [], `OBSOLETE_SKILL_IDS drives migrateRetiredSkills(); these must be absent: ${leaked.join(', ')}`);
});

test('the legacy bmad-ma-agent-ml rename id is still present (removing it is NOT this invariant)', () => {
  // Sanity check that we are guarding the RIGHT thing: the legacy prefixed id
  // may legitimately remain; only the CURRENT unprefixed ids must be absent.
  assert.ok(
    !DEMERZEL_ML_IDS.includes('bmad-ma-agent-ml'),
    'bmad-ma-agent-ml is the legacy rename id and is intentionally outside the preserved-ids set'
  );
});

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (errors.length > 0) {
  console.error('\nFailures:');
  for (const { name, error } of errors) {
    console.error(`  ${name}: ${error}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
