---
type: bug
severity: medium
title: npm test cannot pass on Windows — reconfigure.test.js test 8.8 fails (scriptedPrompts exhausted after 1 calls), plus a chain of pre-existing failures masked by the && test script
---

# Bug: `npm test` cannot pass on Windows — `reconfigure.test.js` test 8.8 fails (`scriptedPrompts exhausted after 1 calls`), plus a chain of pre-existing failures masked by the `&&` test script

**Status:** backlog
**Severity:** medium
**Affected Component:** Test suite health — `test/reconfigure.test.js` (test 8.8) and the long `&&`-chained `test` script in `package.json`

## Summary

`npm test` cannot run fully green on Windows. The `test` script in `package.json`
is one long `&&`-chained sequence of ~52 standalone test files. Because `&&`
short-circuits on the first non-zero exit, each pre-existing failure masks every
test that comes after it.

Position 13, `migration-validation.test.js` (7 MIL-498 byte-identity failures),
was just fixed in PR #104 via a `.gitattributes` `eol=lf` normalization. That fix
unmasked the **next** failure in the chain: `test/reconfigure.test.js`
(~position 32 in the chain), whose test **8.8** now fails. Test 8.8 fails
**standalone** — not merely in-suite — so it is a genuinely broken or
environment-dependent test, independent of test ordering.

Because the chain has never run past position 32 on a clean Windows checkout,
there may be **additional masked failures in positions 33–52** that have never
been reached. The full extent of the suite-health debt is unknown until the chain
is run continue-on-failure or position-by-position.

## Reproduction Steps

1. Clean checkout on Windows (CRLF default), dependencies installed.
2. Run the primary reproducible failure standalone:
   ```
   node test/reconfigure.test.js
   ```
   It throws `Error: scriptedPrompts exhausted after 1 calls`. The failing
   assertion is test **8.8 "ClinerulesDualFileDriftError raised; no --force
   override (AC #10)"**, reported as "The validation function is expected to
   return 'true'. Received false".
3. Run the whole suite:
   ```
   npm test
   ```
   It exits non-zero. With PR #104's `.gitattributes eol=lf` fix in place, the
   chain now advances past position 13 (`migration-validation.test.js`) and halts
   at `reconfigure.test.js` (~position 32). Without that fix, the chain halts
   earlier at position 13 and `reconfigure.test.js` is never reached.

## Expected Behavior

- `node test/reconfigure.test.js` passes standalone, including test 8.8.
- `npm test` runs to completion and is fully green on Windows, giving developers
  reliable local verification.

## Actual Behavior

- `node test/reconfigure.test.js` throws `Error: scriptedPrompts exhausted after
  1 calls`. Test 8.8 scripts exactly one prompt response
  (`scriptedPrompts([{ chosenProfile: 'on-prem' }])`, see line 302) but the
  reconfigure flow under test calls `prompts()` at least twice, so the stub's
  guard at lines 85–86 throws on the second call before the expected
  `ClinerulesDualFileDriftError` is raised. The `assert.rejects` validator at
  line 304 (`err && err.name === 'ClinerulesDualFileDriftError'`) therefore
  receives the wrong error and returns `false`.
- `npm test` exits non-zero and short-circuits at the first failing position, so
  any later failures (positions 33–52) are never surfaced.

## Root Cause Hypothesis

The reconfigure code path exercised by test 8.8 calls `prompts()` **more times
than the test scripts** (test provides 1 response; the code path requests ≥2),
exhausting the `scriptedPrompts` array. Likely one of:

1. The test's scripted prompt sequence is **stale** relative to the current
   reconfigure flow (FR180) — the flow now asks an additional prompt (e.g. a
   confirmation or an extra branch) before reaching the
   `ClinerulesDualFileDriftError` drift check, so a single scripted response is
   no longer sufficient; and/or
2. A **Windows path / EOL (CRLF) difference** triggers an extra prompt branch —
   e.g. the ClinerulesDualFileDrift `--force` override path — that does not fire
   on Linux. The drift is induced by mutating one of the two Cline marker files
   (`.cline/clinerules.md`) inside the `MA-AGENTS-START … MA-AGENTS-END` markers
   (test lines 289–296); a CRLF-vs-LF mismatch in marker content comparison could
   change which branch the flow takes.

Investigation is needed to confirm whether the defect is in the **test** (stale
script / not robust to Windows line endings) or in the **product** (reconfigure
flow prompting more than intended). This is a bug REPORT only — no fix is applied
here.

Separately, the structural masking is caused by the `&&`-chained `test` script:
`&&` short-circuits on first failure, so the suite cannot enumerate all failures
in a single run.

## Affected Files

- `test/reconfigure.test.js` — `scriptedPrompts` stub (lines 82–93, error thrown at 85–86); failing test **8.8** "ClinerulesDualFileDriftError raised; no --force override (AC #10)" (lines 282–307), which scripts only one prompt response (line 302) and asserts on `ClinerulesDualFileDriftError` (line 304)
- `package.json` — the `scripts.test` `&&`-chained command (line 11): ~52 standalone test files joined by `&&`; `migration-validation.test.js` at position 13, `reconfigure.test.js` at ~position 32, chain ends at `bmad-empty-tools-guard.test.js` (position 52)
- `lib/` reconfigure flow (the product code path that issues the extra `prompts()` call and the Cline dual-file drift check) — to be confirmed during investigation; NOT modified by this report

## Suggested Fix

1. Fix or re-script `test/reconfigure.test.js` test 8.8 to match the **current**
   reconfigure prompt flow (FR180) — provide the correct number of scripted
   prompt responses, and make the dual-file-drift seed robust to Windows line
   endings (normalize EOL before the marker comparison) so the
   `ClinerulesDualFileDriftError` path is reached deterministically.
2. Perform a **suite-health audit**: run test chain positions 14–52 individually
   (continue-on-failure) to enumerate ALL remaining pre-existing failures
   currently hidden behind the `&&` short-circuit — do not assume 8.8 is the last
   one.
3. Consider replacing the `&&`-chained `test` script with a **continue-on-failure
   test runner** (or a simple driver that runs every file and aggregates
   non-zero exits) so the whole failure set is surfaced in one run instead of one
   failure at a time.
4. Quarantine / normalize any genuinely environment-dependent (Windows / CRLF)
   tests so the suite is deterministic across platforms.

## Impact

`npm test` cannot be fully green on Windows, undermining local verification and
developer confidence. NOTE: the actual CI PR gates are the **Linux workflows**
(air-gapped install, Bundle Drift Guard), **not** the full `npm test`, so product
shipping is unaffected. This is test / developer-experience health, not a
product-runtime defect — hence **Medium** severity.

## Provenance

- Discovered **2026-06-06** during Epic 26 retrospective follow-ups (PR #104
  verification).
- Related: the now-fixed **MIL-498 CRLF byte-identity** issue in
  `migration-validation.test.js` (PR #104, `.gitattributes eol=lf`), which
  unmasked this failure; and the broader Windows `npm test` CRLF / regeneration
  gotchas.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/` and `test/` source are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
