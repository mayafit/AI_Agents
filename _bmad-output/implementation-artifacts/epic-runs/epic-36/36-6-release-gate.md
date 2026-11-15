# Story 36.6 — 4.x gate record: BMAD v7 at `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`

Run date: 2026-11-15. Story: `_bmad-output/implementation-artifacts/36-6-release-gate-v7-line.md`. Spec: `prd/capabilities/ma-agents-v7-line.md` (F29: FR280–FR282, FR298, FR301–FR304, NFR84, NFR87), Decisions P5-11.5, P5-11.6, P5-11.10. ma-agents tree: `main` at `5468e4e` (Stories 36.1–36.5 merged) plus this story's working tree (branch `feat/36-6-release-gate`, not yet committed; CI observed on snapshot commits of that tree, see "CI runs").

## Verdict

**PASS** (2026-11-15, after the PO made the repository public and `Test chain (Linux, uv)` became a required status check on `main`; see "Required status check"). The record of the earlier verdict follows unchanged. Earlier verdict (2026-11-15, morning): **FAIL** — one blocking item: **AC3 merge-blocking is not in place.** The Linux chain job is not a required status check on `main`, and it cannot be made one on this repository as it stands: `gh api repos/mayafit/AI_Agents/branches/main/protection` and `…/rulesets` both return HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature" (the repository is private on the free plan). AC3 states "the gate requires it to be required before PASS".

Every other item holds (table below). When the PO makes `Test chain (Linux, uv)` a required status check on `main` (after upgrading the plan or making the repository public), or re-plans AC3's merge-blocking condition, this record turns to **PASS** with no re-run, and the release owner creates the gate tag (AC7). Until then 37.3–37.6 do not start.

## Commit qualified

| Item | Value | Authority |
|---|---|---|
| `bmadRef.core` | `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (short `e734d3a`) | `package.json`; `bundle/manifest.json` `items[bmad-method].resolvedCommit` (the `git rev-parse HEAD` of the build), CI and local |
| `bmadRef.skillsCli` | `1.7.6` | `bundle/skills-cli/package.json` version; `node bundle/skills-cli/bin/cli.mjs --version` |
| `bmadRef.tea` / `cis` / `extensions` | `v4.0.1` / `""` (omitted, recorded) / `""` (39.1) | `bundle/manifest.json` `modules`, `omitted`, `pending` |
| `engines.node` | `>=22.20.0` = the bundled Skills CLI floor | `bundle/skills-cli/package.json` `engines.node` |

## Inputs

- Story 36.1 — `epic-runs/epic-36/36-1-gate-findings.md` (verdict PASS; AC12 FALLBACK for cis; no STOP) and the Verification record of `36-1-gate-spike-v7-pinned-sha.md`.
- Story 36.2 — Verification record of `36-2-offline-runtime-proof.md`.
- Story 36.3 — Verification record of `36-3-target-pin-plumbing.md`.
- Story 36.4 — Verification record of `36-4-owned-toml-validation-v7.md`.
- Story 36.5 — Verification record of `36-5-agents-md-two-writer-test-v7.md`.

No 36.1 STOP exists, so no PO re-plan is pending from 36.1.

## AC by AC

| AC | Result | Evidence |
|---|---|---|
| 1 Release record | this file | commit named above; inputs linked; unverified items listed below; verdict FAIL with the blocking item |
| 2 Chain health | PASS (no new failure left) | Windows: `npm test` halts at position 22 `test/migration-validation.test.js`; positions 22–116 run one by one: 5 failing files, 4 pre-existing (fail identically at `38ea256`, chain run file by file in a scratch checkout of `38ea256`), 1 **new** (`test/customize-contract-v7.test.js` m2, CRLF regex, Story 36.4) — fixed here, 61/0; final Windows run after the fixes: positions 22–116 (95 files), 4 failing, all pre-existing. Linux: 8 failing files, all identical at `38ea256` (run 43655069772), all allowlisted; 1 **new** in the first run (`test/release-gate-epic-31.test.js`, Epic 36's six new shipped files) — counts re-pinned with the reason, 43/0. Per-file table: dated 2026-11-15 note in `bug-npm-test-windows-suite-health-chain.md` |
| 3 Linux CI job | job PASS; **merge-blocking FAIL** | `.github/workflows/test-linux.yml`: `ubuntu-latest`, `actions/setup-node@v4` Node `22` (log: v22.23.4, floor check ok), `astral-sh/setup-uv@v10.3.3` with uv `0.13.8` + SHA-256, `uv python install 3.11` (log: `Python 3.11.18`), `npm ci --ignore-scripts`, `node bin/cli.js bundle build`, wheelhouse manifest, then 116 files one by one (`.github/scripts/run-test-chain.js`) gated by `test/known-failures-linux.json` (8 entries, each an existing bug record; fails on an unlisted failure and on a stale entry); `customize-contract-v7` 61/0, `instruction-file-coexistence` 46/0, `release-gate-epic-36` 17/0 required to pass, 0 skipped. Positive run 43655910096 (success, "Gate holds"). Negative run 43656256468 (uv steps removed): `uv: not on PATH`; `✗ uv is on PATH: prerequisite: uv not found on PATH (ENOENT); install uv 0.13+` in `customize-contract-v7`; gate problems "NEW failure: test/customize-contract-v7.test.js", "required file … failed". Required status check: not set, cannot be set (HTTP 403, see Verdict) |
| 4 Offline runtime in CI | PASS | `offline-install.yml` job `offline-runtime` (new; the existing job's steps untouched): uv 0.13.8 (SHA-256 checked), CPython 3.11.18 and the linux-x64 wheelhouse fetched on the runner; `docker run --network none` (interfaces `lo` only, 0 IPv4 routes, `getent hosts pypi.org` no answer). 36.2 AC4: (a) `render_skill.py` bmad-build exit 0, bmad-agent-po exit 0; (b) `resolve_config.py` 0; (c) `resolve_customization.py` 0; (d) `tickets.py status` 0 (`"total": 2`); (e) `setup.py --status` 0. 36.2 AC5(a): `UV_FIND_LINKS` unset → exit 1 `No solution found when resolving script dependencies` (render_skill, tickets); wheelhouse removed → exit 2 ``Failed to read `--find-links` directory`` (render_skill, tickets). Run 43655929762, job 132634320658 (success). `OFFLINE_NODE_IMAGE` = `node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb` (Node v22.23.5) in both jobs |
| 5 Invariants test | PASS | `test/release-gate-epic-36.test.js` (17 tests, in the chain): `bmadRef.core` = manifest = build HEAD, tree hash recomputed, bundled template = 36.5's committed fixture blob; `skillsCli` = tarball version = `--version`; `engines.node` ≥ Skills CLI floor, both 4.x CI jobs and every `OFFLINE_NODE_IMAGE` ≥ floor, digest-pinned; 42 snapshot scripts, deps `jinja2, pyyaml, tiktoken` each with a wheel on linux-x64 and win-x64, manifest built from `bmadRef.core`; 36.2–36.5 tests and this file in the chain; Linux job shape; allowlist keys exist. Mutants (each red, restored): core digit, `engines.node >=22.0.0`, `skillsCli 1.7.7`, one README item changed, offline-runtime image Node 20, 36.4 test removed from the chain, `pyyaml` wheels removed, allowlist key without a record |
| 6 Snapshot reproducible | PASS | `bundle/manifest.json` SHA-256 — CI (run 43655910096, Linux): `8515f1d4d0e5b189e48ff8249e1a4353412ddecfed8d6be2daa7e8a61c748cd7`; local (Windows 11, `node bin/cli.js bundle build`, 2026-11-15): `8515f1d4d0e5b189e48ff8249e1a4353412ddecfed8d6be2daa7e8a61c748cd7` — identical (and equal to 36.3's record) |
| 7 Gate tag, `maint/3.x` | not created (verdict FAIL); `maint/3.x` confirmed | `git ls-remote origin maint/3.x refs/tags/v3.18.1^{}` → both `38ea25603f2e0810ea95348dc00263abd75e374d`. Tag name for the owner: **`v4-gate-e734d3a`** (see below) |
| 8 CHANGELOG / README | PASS | `CHANGELOG.md` "## Unreleased (4.x)" (target commit, 3.x supported until 39.5, dist-tag `next` from 39.4, Node ≥ 22.20.0, uv + Python 3.11 + wheelhouse, `docs/on-prem-runtime.md`, 14 known limitations); `README.md` "## 4.x line (BMAD v7) — not yet released" / "### Known limitations of the 4.x line" mirrors the 14 items; parity asserted by `test/release-gate-epic-36.test.js` |
| 9 Retro and verdict | done | `epic-runs/epic-36/epic-36-retro-2026-11-15.md`; 37.3–37.6 may start: **no** (until the required check) |

## CI runs

All on snapshot commits of this story's working tree (pushed to throwaway branches; the probe snapshots add `'ci/36-6-**'` to `test-linux.yml`'s `push` branches so a push starts it, which the committed file does not carry).

| Run | Branch / commit | Result |
|---|---|---|
| https://github.com/mayafit/AI_Agents/actions/runs/43655910096 | `ci/36-6-release-gate-probe` `7e4b1de` | Linux chain, positive: success, 108 passed / 8 allowlisted |
| https://github.com/mayafit/AI_Agents/actions/runs/43654430595 | `ci/36-6-release-gate-probe` `e95bf0a` | first positive attempt: failure (empty allowlist; found `release-gate-epic-31` new failure) |
| https://github.com/mayafit/AI_Agents/actions/runs/43656256468 | `ci/36-6-negative-no-uv` `13f2dd6` | negative (setup-uv, `uv python install` and wheelhouse steps removed): failure as expected, 36.4 prerequisite message |
| https://github.com/mayafit/AI_Agents/actions/runs/43655069772 | `ci/36-6-disposition-38ea256` `967ff14` | `38ea256` chain file by file on Linux (disposition baseline): 102 passed, 8 failed |
| https://github.com/mayafit/AI_Agents/actions/runs/43655929762 | `ci/36-6-release-gate-probe` `7e4b1de` (dispatch) | `offline-runtime` job success (job 132634320658); existing `offline-install` job failure, pre-existing (below) |

Pre-existing, outside AC4: the existing job "Air-gapped install (claude-code)" has failed on all 33 runs since 2026-09-04 (three FR250 global-install notice facts), on the Node 20 image (e.g. run 43646677354) as on the Node 22 image; no bug record names it. Because a pushed `v*` tag starts `offline-install.yml`, the gate tag push will show this red job.

## Required status check (what the PO must set)

- Check name: **`Test chain (Linux, uv)`** (job `test-linux` of workflow "Test Chain (Linux, uv)", `.github/workflows/test-linux.yml`), on branch `main`, "Require status checks to pass before merging", strict (branch up to date) recommended.
- Precondition: branch protection or rulesets must be available — upgrade the account to GitHub Pro (or the organisation plan) or make `mayafit/AI_Agents` public; today both APIs answer HTTP 403.
- **Set 2026-11-15:** the PO chose to make the repository public (`gh repo edit --visibility public`; `gh repo view --json visibility` → `PUBLIC`; the full history was scanned for token and private-key patterns first — the only matches are the pattern list of `skills/js-ts-security-skill/scripts/verify-security.sh`). `PUT repos/mayafit/AI_Agents/branches/main/protection` with `required_status_checks.contexts = ["Test chain (Linux, uv)"]`, `strict = false`, no review requirement, force-pushes and deletions off → the API echoes the context. AC3 merge-blocking: **PASS**.
- Optional, same setting: `Air-gapped v7 runtime (uv + Python 3.11 + wheelhouse)` (AC4 job). Do not require "Air-gapped install (claude-code)" until its FR250 failure is fixed.

## Gate tag (AC7) — for the release owner, on PASS only

- Name: `v4-gate-e734d3a` (`e734d3a` = abbreviated `bmadRef.core`). Target: the ma-agents commit on `main` that merges this story (its `package.json` `bmadRef.core` is `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`).
- Commands: `git tag -a v4-gate-e734d3a <merge-commit> -m "4.x gate: BMAD v7 at e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6 (Story 36.6)"`, `git push origin v4-gate-e734d3a`, then paste `git show --no-patch v4-gate-e734d3a` here.
- `git show --no-patch v4-gate-e734d3a` (created 2026-11-15 on the merge commit of PR #165):

```
tag v4-gate-e734d3a
Tagger: Alon Mayaffit <alon.mayafit@gmail.com>
Date:   Sun Nov 15 14:10:40 2026 +0200

4.x gate: BMAD v7 at e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6 (Story 36.6)

commit 6672d5abf2c5e648827983f1de34d5b221eec797
Author: mayafit <alon.mayafit@gmail.com>
Date:   Sun Nov 15 09:36:44 2026 +0200

    ci(epic-36): release gate record, Linux test-chain job with uv, offline runtime job, invariants test (Story 36.6) (#165)
```
- Version: the PO set the 4.x line to a public beta on the same day; `package.json` is `4.0.0-beta.1` (PR after #165). Still no npm publish.
- No npm publish in this story.

## Unverified items (every item 36.1–36.6 marked unverified)

- 36.1: none.
- 36.2: Windows offline run with the network adapter disabled (used `UV_OFFLINE=1` + a black-hole proxy); global scope (uv user configuration file) not exercised; "no download attempt" for a missing interpreter shown by uv's verbose log, not a syscall trace; full `npm test` chain not run — **closed by this story** (AC2).
- 36.3: full-clone fallback of `bundle build` when a proxy refuses a fetch by commit not implemented; Skills CLI dependency ranges resolve on the build day (CI and local agreed on 2026-11-15, `8515f1d4…`, AC6) — no lockfile pin.
- 36.4: the Linux CI half — **closed by this story** (AC3: 61/0 on Linux); the validator's `--render` path not run offline; `npm test` fails at this test without `bundle/bmad-method/` or `BMAD_V7_TREE` (by design: prerequisite, never a skip).
- 36.5: the adoption runs were fresh agent sessions with scripted user turns, not an interactive human session (36.7 repeats); `bundle/bmad-method/` not wired as the template source — **covered by this story** (the gate test asserts the bundled template equals the committed fixture blob); marker lines inside fenced code blocks match (no fence awareness); Linux not run — **closed by this story**; full chain not run — **closed by this story**.
- 36.6: AC3 merge-blocking (required status check) — not set, cannot be set on the current plan; the gate tag — not created; the CI runs ran on snapshot commits of the working tree, not on the commit the owner will merge (the PR's own `pull_request` runs will be the record of that commit).

These items, the 36.5 AC9 adopt finding and the 36.1 AC12 FALLBACK (cis) are the "Known limitations" of `CHANGELOG.md` and `README.md`.

## Other changes this story made outside its new files

- `test/release-gate-epic-31.test.js`: AC7.5c/AC7.5h counts re-pinned (964 → 965 shipped markdown outside the skills roots, 1,283 → 1,284 total; 2,036 → 2,042 shipped files, 428 → 433 unscanned) for the six shipped files Epic 36 added, with the reason in the test.
- `test/customize-contract-v7.test.js`: m2's regex accepts CRLF (`\r?`), so the suite passes in a Windows `core.autocrlf=true` checkout.
- `.github/workflows/offline-install.yml`: `workflow_dispatch` trigger; the existing job's `OFFLINE_NODE_IMAGE` moved to the Node 22 digest (comment updated); new `offline-runtime` job. The existing job's steps are unchanged (its host `setup-node` stays `'20'`).
- Not changed (follow-up for the PO): `bundle-drift.yml` and `multi-tool-smoke.yml` still set up Node 20 on the host (`engines.node` is `>=22.20.0`; npm only warns); `.gitignore` ignores `.github/` with negations that cannot re-include files under an excluded directory, so new files under `.github/` need `git add -f`.
