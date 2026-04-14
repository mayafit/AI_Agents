#!/usr/bin/env node
/**
 * Story 21.9 — End-to-end installer harness (scaffolding; PENDING implementation).
 *
 * When Story 21.9 is picked up, this file becomes the byte-for-byte fixture-diff
 * harness described in ACs #5 and #6 of the story. Today it is a no-op that exits
 * 0 so `npm test` stays green.
 *
 * Scaffolding committed in corrective-plan step 7 (PR #40 approximate).
 * Fixtures live under `test/fixtures/` — see `test/fixtures/README.md`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const STANDARD_BASELINE = path.join(FIXTURES_DIR, 'standard-profile-baseline');
const ONPREM_BASELINE = path.join(FIXTURES_DIR, 'onprem-profile-baseline');

function baselineIsPopulated(dir) {
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir).filter(f => f !== '.gitkeep');
  return entries.length > 0;
}

const standardReady = baselineIsPopulated(STANDARD_BASELINE);
const onPremReady = baselineIsPopulated(ONPREM_BASELINE);

if (!standardReady && !onPremReady) {
  console.log('[onprem-injection.test] PENDING — baseline fixtures not yet captured.');
  console.log('  See test/fixtures/README.md for the Story 21.9 regeneration procedure.');
  console.log('  Exiting 0 (scaffold only).');
  process.exit(0);
}

// Story 21.9 implementation will replace everything below this line with the real harness.
// Until then, refuse to silently pass if only one baseline is populated — that's a red flag.
if (standardReady !== onPremReady) {
  console.error('[onprem-injection.test] FAIL — inconsistent fixture state: one profile baseline is populated and the other is not.');
  console.error('  Either finish regenerating both, or remove the populated one. See test/fixtures/README.md.');
  process.exit(1);
}

// Both populated but the real harness is not yet wired — flag clearly.
console.log('[onprem-injection.test] PENDING — fixtures populated but harness implementation not yet landed (Story 21.9).');
console.log('  Run `grep "Story 21.9" _bmad-output/implementation-artifacts/21-9-tests-validation.md` for scope.');
process.exit(0);
