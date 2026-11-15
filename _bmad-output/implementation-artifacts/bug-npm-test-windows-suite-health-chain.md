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

## 2026-11-15 — chain health at `5468e4e` + Story 36.6 (Windows and Linux), dispositions against `38ea256`

Recorded by Story 36.6 (AC2). Chain: 116 files (`package.json` `scripts.test`, incl. the new
`test/release-gate-epic-36.test.js`). Runner: `.github/scripts/run-test-chain.js` (reads the chain from
`package.json`, runs every file with `node test/<file>`, prints a per-file table). Baseline for every
disposition: `38ea256` (`v3.18.1`, `maint/3.x`), run the same way — Windows in a scratch checkout of
`38ea256`, Linux in GitHub Actions (run https://github.com/mayafit/AI_Agents/actions/runs/43655069772,
the 110-file chain of `38ea256` with the same runner on Node 22 + uv 0.13.8 + Python 3.11).

**Windows** (Windows 11, Node v24.15.0, npm 11.12.1, worktree with `core.autocrlf=true`):

- `npm test` halts at **position 22, `test/migration-validation.test.js`** (`Story 15.8 Validation:
  199 passed, 3 failed`; positions 1-21 pass). The halt moved from position 13 (PR #104) and 32
  (`reconfigure.test.js`, the original report) — `reconfigure.test.js` (position 59) now passes (12 passed, 0 failed).
- Every file from position 22 to 116 run individually: 5 failing files in the first run; after Story 36.6's
  `customize-contract-v7` fix, the final run (`npm test` again halts at 22; positions 22-116 = 95 files)
  has 4 failing files, all pre-existing.

| # | File | Failing assertions | On `38ea256` | Disposition |
|---|---|---|---|---|
| 22 | `test/migration-validation.test.js` | 5.3 / 5.6 / 5.8: expects 63 skill folders and 63 `module-help.csv` rows and 5 agent folders; finds 51, 51, 4 (stale counts) | same 3 assertions | pre-existing |
| 36 | `test/project-layout-staleness-guard.test.js` | OQ-3: `skills/my-next-issue/SKILL.md` and `lib/bmad-extension/skills/my-next-issue/SKILL.md` resolve a binding-derived field without the preflight (skill added by PR #148) | same | pre-existing |
| 39 | `test/project-layout-artifact-routing.test.js` | BLOCKING-4: shipped skills cite `_bmad-output/project-layout.yaml` / `_bmad-output/methodology/…pptx`, files the earlier suites create in the working copy (`bug-tests-mutate-the-repository-they-run-in`); passes when run alone on a clean tree | same (in-chain) | pre-existing (`bug-blocking-4-citation-guard-is-blind-in-ci`) |
| 41 | `test/project-layout-confluence-publish-hook.test.js` | 11.4 AC10: `git merge-base HEAD feature/epic-31` (no such ref) | same | pre-existing (`bug-ac9c-tripwire-encodes-a-story-scope-constraint-as-a-permanent-branch-relative-assertion`) |
| 114 | `test/customize-contract-v7.test.js` | m2: `Cannot read properties of null (reading '0')` — the mutant's regex assumed LF; the fixture is CRLF in an autocrlf checkout | file does not exist at `38ea256` | **new** (Story 36.4) — fixed in Story 36.6 (`\r?` in the regex); now 61 passed, 0 failed |

**Linux** (GitHub Actions `ubuntu-latest`, Node 22.23.4, uv 0.13.8, Python 3.11.18; job
`.github/workflows/test-linux.yml`): 116 files run individually, 8 failing files, all in
`test/known-failures-linux.json`; run https://github.com/mayafit/AI_Agents/actions/runs/43655910096
(gate holds). The first run (https://github.com/mayafit/AI_Agents/actions/runs/43654430595) also failed
`test/release-gate-epic-31.test.js` (AC7.5c 965 vs 964 shipped markdown, AC7.5h 2042 vs 2036 shipped
files): **new** — it passes at `38ea256`; Epic 36 added six shipped files (`docs/on-prem-runtime.md`,
`lib/bundle.js`, `lib/runtime/uv.js`, `lib/inject/marker-block.js`, `scripts/build-wheelhouse.py`,
`scripts/validate_customize.py`). Story 36.6 re-pinned the counts with the reason in the test.

| # | File | Failing assertions (Linux) | On `38ea256` (Linux) | Disposition / allowlist key |
|---|---|---|---|---|
| 22 | `test/migration-validation.test.js` | 5.3 / 5.6 / 5.8 (as Windows) | same | pre-existing / this bug |
| 25 | `test/config-storage.test.js` | "updates existing fields in place": `/new/kb` written as `../../new/kb` | same | pre-existing / this bug |
| 26 | `test/cross-repo-validation.test.js` | "mixed mode: kb external, sprint same": `/ext/kb` written as `../../ext/kb` | same | pre-existing / this bug |
| 31 | `test/project-layout-binding-spine.test.js` | line-break path and `$&` path: `/ext/…` written as `../../ext/…` | same | pre-existing / this bug |
| 33 | `test/project-layout-config-generation.test.js` | 7 assertions (AC1, AC1/FR264, AC2 ×2, AC5, AC8 ×2): `/ext/…` resolved as `../../ext/…` | same | pre-existing / this bug |
| 36 | `test/project-layout-staleness-guard.test.js` | OQ-3 `my-next-issue` (as Windows) | same | pre-existing / this bug |
| 39 | `test/project-layout-artifact-routing.test.js` | BLOCKING-4 (in-chain working-copy state, as Windows) | same | pre-existing / `bug-blocking-4-citation-guard-is-blind-in-ci` |
| 41 | `test/project-layout-confluence-publish-hook.test.js` | 11.4 AC10 `git merge-base HEAD feature/epic-31` | same | pre-existing / `bug-ac9c-tripwire-encodes-a-story-scope-constraint-as-a-permanent-branch-relative-assertion` |

Linux-only cause of rows 25, 26, 31, 33 (observed, not fixed): the fixtures pass POSIX absolute paths
(`/new/kb`, `/ext/kb`); on Linux the config writer relativises them against the temporary project
(`../../ext/kb`), while on Windows `/ext/kb` resolves to another drive than `%TEMP%` and stays
absolute, so the expectations were only ever met on Windows. Rows 22, 25, 26, 31, 33 and 36 carry this
bug's key in the Linux allowlist because no dedicated bug record names them; the PO may split them out
(one record for the POSIX path expectations, one for the `my-next-issue` preflight, one for the stale
skill counts) and re-key the allowlist.

Not a test-chain item, recorded because the same probe ran it: the existing `offline-install.yml` job
"Air-gapped install (claude-code)" has failed on all 33 workflow runs since its last success (2026-09-04). The two runs inspected
(https://github.com/mayafit/AI_Agents/actions/runs/43646677354 on the Node 20 image, and
https://github.com/mayafit/AI_Agents/actions/runs/43655929762 on the Node 22 image) fail on three FR250
global-install notice facts ("BMAD-METHOD is installed per project rather than globally", "To set BMAD
up in a project, run", "Your knowledge-store configuration is unaffected"); no bug record names it.
