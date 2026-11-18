// Offline Install Gate ↔ FR250 notice contract.
//
// WHY THIS EXISTS
//
// The Offline Install Gate's global-install block asserts that the FR250 BMAD
// scope notice appears in the install log. bin/cli.js only emits that notice
// when the selection contained at least one `category: 'bmad'` agent for the
// global filter to drop:
//
//     if (bmadAgentIds.length > 0) { ...print the three facts... }
//
// The gate invoked the install with `--agent claude-code`. `--agent` takes
// exactly ONE id (`preselectedAgents = agentFlag ? [agentFlag] : null`) and
// claude-code is an `ide` agent, so the selection was all-IDE, the filter
// dropped nothing, the notice never printed, and the three FR250 greps could
// never pass. The gate was asserting something its own command made impossible.
//
// It therefore failed on arrival with Epic 31 (PR #150, 2026-09-23) and stayed
// red for ~8 weeks across every PR — the last green run was 2026-09-04. Nothing
// caught it, because the only check of the gate's correctness WAS the gate, and
// a job that is always red stops being read. test/global-install-scope.test.js
// did not catch it either: it runs `install --yes --global` with no `--agent`,
// so it exercises a different selection than the gate did.
//
// These assertions are static — they read the two files and compare them, with
// no install — so they run in milliseconds inside the normal `npm test` chain,
// which is watched and green. If the gate and the CLI drift apart again, this
// fails on the PR that causes it rather than two months later.

'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const GATE = path.join(PROJECT_ROOT, '.github', 'scripts', 'offline-install-verify.sh');
const CLI = path.join(PROJECT_ROOT, 'bin', 'cli.js');

const gateText = () => fs.readFileSync(GATE, 'utf8');
const cliText = () => fs.readFileSync(CLI, 'utf8');

/** The gate's global-install invocation: the `--global` line plus what follows it. */
function globalInstallInvocation(text) {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /cli\.js['"]?\s+install\b/.test(l) && /--global\b/.test(l));
  assert.notStrictEqual(
    idx,
    -1,
    'could not find the gate\'s global install invocation (a `cli.js install ... --global` line) — ' +
      'if it was restructured, update this guard rather than deleting it'
  );
  return lines[idx];
}

test('the gate exists and still runs a global install', () => {
  assert.ok(fs.existsSync(GATE), `missing gate script: ${path.relative(PROJECT_ROOT, GATE)}`);
  const line = globalInstallInvocation(gateText());
  assert.ok(/--yes\b/.test(line), 'the global install must stay non-interactive (--yes)');
});

test('the gate global install does NOT pin a single --agent', () => {
  const line = globalInstallInvocation(gateText());
  assert.ok(
    !/--agent\b/.test(line),
    'The global install must not pass `--agent`. It takes exactly one id, so any single ' +
      'agent breaks one of the gate\'s own checks: an `ide` agent (e.g. claude-code) means ' +
      'no bmad agent is filtered, so the FR250 notice never prints and its three assertions ' +
      'fail; a `bmad` agent is itself filtered out, leaving zero agents and failing the ' +
      'PRESENCE check. Omit it and take the default --yes selection.\n' +
      `  offending line: ${line.trim()}`
  );
});

test('the gate still asserts the FR250 facts, and the CLI still ships them', () => {
  const gate = gateText();
  const cli = cliText();

  // The substrings the gate greps for. Kept here so a reworded notice that
  // updates only one of the two files fails loudly instead of silently
  // un-testing FR250.
  const facts = [
    'BMAD-METHOD is installed per project rather than globally',
    'To set BMAD up in a project, run',
    'Your knowledge-store configuration is unaffected',
  ];

  for (const fact of facts) {
    assert.ok(
      gate.includes(fact),
      `the gate no longer asserts the FR250 fact "${fact}" — if the notice was reworded, ` +
        'update the gate, the CLI constant and this list together'
    );
    assert.ok(
      cli.includes(fact),
      `bin/cli.js no longer ships the FR250 fact "${fact}" that the gate greps for — ` +
        'the gate will fail on the next run'
    );
  }
});

test('the FR250 notice is still emitted only when a bmad agent is filtered', () => {
  // This is the precondition the gate's invocation has to satisfy. If the guard
  // is ever lifted (the notice printed unconditionally on a global install),
  // the `--agent` assertion above becomes unnecessary — this test says so
  // explicitly rather than leaving a stale rule in place.
  const cli = cliText();
  assert.ok(
    /if\s*\(\s*bmadAgentIds\.length\s*>\s*0\s*\)/.test(cli),
    'the FR250 notice no longer appears to be guarded by `bmadAgentIds.length > 0`. ' +
      'If the notice is now unconditional on a global install, the gate may pass --agent ' +
      'again — relax the assertion above and update this test together with that change.'
  );
});
