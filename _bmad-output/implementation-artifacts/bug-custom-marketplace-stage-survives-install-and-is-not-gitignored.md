---
type: bug
severity: low
title: .ma-agents-custom-marketplace-stage can survive a reported-successful install, and is never added to the TARGET project's .gitignore
---

# Bug: `.ma-agents-custom-marketplace-stage` can survive a reported-successful install, and is never added to the TARGET project's `.gitignore`

**Status:** backlog
**Severity:** low
**Affected Component:** `lib/custom-marketplace.js` (`prepareCleanStageDir`, `stageCustomMarketplaceSubset`, `stageRegistrySubset`); `lib/bmad.js#installCustomMarketplaceSubset`; `lib/installer.js` gitignore policy family

## Summary

A user reported `.ma-agents-custom-marketplace-stage` sitting at the project root
after an install they experienced as successful.

**The originally-suspected cause — "the stage is only removed on the error path,
so it persists forever" — is WRONG and was disproved against source and against a
real install log.** `lib/bmad.js:1781` calls `cleanupStageFn(stagePath)` on the
success path, and the real install at `d:\Code\Workshop` proves it fires:

```
795:  Removed plugin stage directory: D:\Code\Workshop\.ma-agents-custom-marketplace-stage
797:  Custom marketplace subset installed successfully!
```
(`d:\Code\Workshop\install_2026-07-13_19-23-02-272.log`)

Two genuine defects remain, and together they explain the report:

1. **Un-gitignored in the target project.** `.ma-agents-custom-marketplace-stage/`
   is listed only in **ma-agents' own** repo `.gitignore:57`. Nothing ever writes
   it into the **installed project's** `.gitignore`, so any leftover stage is a
   git-visible, commit-eligible directory in the user's repo.
2. **Leak windows that leave an unreclaimable stage while the overall install
   still reports success.** Several throw sites sit outside the guarded regions,
   and one of them loses the `stagePath` handle entirely.

## Reproduction Steps

Path A — the gitignore asymmetry (deterministic):

1. Install ma-agents at Project scope into a clean git repo, engaging the custom
   marketplace source (Y at `bin/cli.js:1021-1027`, or `--bmad-custom-source <ref>`)
   and selecting at least one extension.
2. Inspect the project's `.gitignore` after the install.
3. Observe it contains `.ma-agents-plugin-stage/`, `_bmad/`, and
   `_bmad-output/knowledge-site/` — but **not**
   `.ma-agents-custom-marketplace-stage/`. Confirmed on two real installs:
   `d:\Code\Workshop\.gitignore` and `d:\Code\Prophesys\.gitignore`.

Path B — a surviving stage under a "successful" install:

1. Engage the custom marketplace source and select ≥1 extension.
2. Cause the staged `bmad-method` invocation or the Cline reconcile to fail (e.g.
   a stale registry `approved_tag`, an unreachable repo, a locked file during the
   `marketplace.json` write).
3. Observe: the stage directory is left on disk (deliberately, for Path B step 2's
   post-invoke failures), the failure is printed mid-flow, and the wizard then
   proceeds to its normal success summary (`bin/cli.js:1622-1627`). The user reads
   the install as successful and is left with an unexplained root-level directory
   that no later run will clean unless they opt into a custom source again.

## Expected Behavior

- If a transient stage directory can ever be left in the target project, the
  installer must add `.ma-agents-custom-marketplace-stage/` to that project's
  `.gitignore` — exactly the sister policy already applied to
  `.ma-agents-plugin-stage/`, `_bmad/`, and `_bmad-output/knowledge-site/`.
- A stage created and then abandoned by a **staging** failure must be removed; a
  stage deliberately retained for diagnostics must be reported in the final
  summary, not only in a mid-flow line.
- The overall install must not print an unqualified success summary when the
  custom-marketplace step failed.

## Actual Behavior

**Defect 1 — gitignore asymmetry.** `lib/installer.js` carries the whole policy
family: `ensurePluginStageIgnored` (`lib/installer.js:375`), `ensureBmadDirIgnored`
(`:453`), `ensureKnowledgeSiteIgnored` (`:530`). There is **no** equivalent for the
custom-marketplace stage. `lib/bmad.js#installCustomMarketplaceSubset`
(`lib/bmad.js:1694-1847`) calls no gitignore helper at all, in contrast to
`installBmad` (`lib/bmad.js:856`), `runMigration` (`:959`) and `updateBmad`
(`:1058`), which each call `ensurePluginStageGitignoredForProject(projectRoot)`.
The only declaration anywhere is ma-agents' own repo `.gitignore:57`.

**Defect 2 — leak windows.** `prepareCleanStageDir`
(`lib/custom-marketplace.js:704-722`) creates the directory at `:720`. After that:

- `stageCustomMarketplaceSubset`: the copy loop is guarded and cleans up on throw
  (`lib/custom-marketplace.js:743-752`), but the pruned-`marketplace.json` write at
  **`:754-763`** (`fs.mkdirpSync` + `fs.writeFileSync`) is **outside** that guard.
- `stageRegistrySubset`: same shape — guarded copy loop at
  `lib/custom-marketplace.js:998-1028`, unguarded `marketplace.json` write at
  **`:1030-1035`**.
- A throw at either unguarded site propagates to
  `lib/bmad.js:1751-1755`. Because the destructuring assignment
  (`({ stagePath, customSourceArg, ... } = await stageFn(...))`, `lib/bmad.js:1734`
  / `:1741`) never completed, **`stagePath` is still `undefined`** — the catch
  block has no handle to clean with. The directory is orphaned with no code path
  able to reclaim it. The function returns `false`; `bin/cli.js:1575-1611` logs and
  continues to the success summary.
- `buildBmadArgs(...)` at **`lib/bmad.js:1762`** sits between staging and the
  guarded `try` at `:1773`. A throw there escapes `installCustomMarketplaceSubset`
  entirely and is caught at `bin/cli.js:1604`, leaving the stage.
- The **intentional** leave-in-place path (`lib/bmad.js:1842-1846`, policy
  documented at `:1778-1780` and mirrored from `cleanupStage`'s docblock at
  `lib/bmad.js:196-200`) is correct behaviour, but the retained stage is reclaimed
  by nothing: the only other remover is `prepareCleanStageDir`'s stale-stage wipe
  (`lib/custom-marketplace.js:706-719`), which runs only if the user opts into a
  custom source **again**.

## Root Cause

Two independent omissions, not one:

1. The Story 22.8 gitignore policy was extended to `_bmad/` (bug 27.11) and to the
   Knowledge Atlas site output (Story 29.1) but was **never extended to the Story
   30.6b custom-marketplace stage**. The entry was added to ma-agents' own
   `.gitignore` (`:53-57`, where `:53` is the plugin stage and `:57` the
   marketplace stage) and the target-project write site was overlooked.
2. Cleanup in the two stagers is attached to the **copy loop** rather than to the
   whole "create stage → populate stage" transaction, and
   `installCustomMarketplaceSubset` derives `stagePath` from the stager's *return
   value* rather than computing it up front — so a mid-staging throw both skips
   cleanup and destroys the handle.

## Does Story 30.7 depend on the stage surviving? — NO

Checked explicitly, because the persist/re-enumerate feature was the one plausible
reason to keep a staged subset after install. It does not use the stage:

- `reconcileCustomMarketplaceSelection` (`lib/custom-marketplace.js:1065-1075`) is a
  pure function over `persistedSelectedCodes` and a freshly-enumerated plugin list.
  No I/O, no stage reference.
- `reconcileCustomMarketplaceOnUpdate` (`bin/cli.js:1140-1180`) reads the persisted
  selection via `getCustomMarketplaceSelection(projectRoot)` (`bin/cli.js:1141`) and
  **re-enumerates from the recorded SOURCE**, not from the stage.
- The persisted record itself (`lib/bmad.js:1811-1836`) stores
  `source`/`sourceUrl`/`mode`/`selectedCodes`/`sha` in `.ma-agents.json` — nothing
  that points at the stage.

Deleting the stage on success is therefore safe, and is already the shipped
behaviour. **The fix is not "add a `finally`"** — an unconditional `finally` would
destroy the Story 30.6b AC 8 diagnostic contract (leave the stage after a *post-invoke*
failure so an operator can re-run BMAD directly with `--custom-source <stage>`).

## Blast Radius

- Every install that engages the custom marketplace source (opt-in: the Y/N prompt
  at `bin/cli.js:1021-1027`, or `--bmad-custom-source`). The feature is off by
  default (`bin/cli.js:1013-1020` returns `null` under `--yes` with no flag), so
  base installs are unaffected.
- Consequence is cosmetic-plus-hygiene: an unexplained, **untracked-but-not-ignored**
  directory in the user's repo that can be accidentally committed, holding a full
  copy of every staged skill directory.
- Aggravating factor: the install reads as successful, so the user has no signal
  that anything failed or that the directory is diagnostic residue.

## Affected Files

- `lib/custom-marketplace.js` — `CUSTOM_MARKETPLACE_STAGE_DIR_NAME` (`:440`);
  `prepareCleanStageDir` (`:704-722`, creation at `:720`, stale wipe at `:706-719`);
  `stageCustomMarketplaceSubset` guarded copy (`:743-752`) vs unguarded
  `marketplace.json` write (`:754-763`); `stageRegistrySubset` guarded copy
  (`:998-1028`) vs unguarded write (`:1030-1035`);
  `reconcileCustomMarketplaceSelection` (`:1065-1075`, confirms no stage dependency)
- `lib/bmad.js` — `cleanupStage` (`:205-236`, docblock `:194-204`);
  `installCustomMarketplaceSubset` (`:1694-1847`): staging catch that cannot clean
  (`:1751-1755`), unguarded `buildBmadArgs` (`:1762`), success cleanup (`:1781`),
  deliberate leave-in-place (`:1842-1846`); the three
  `ensurePluginStageGitignoredForProject` call sites that have no marketplace-stage
  counterpart (`:856`, `:959`, `:1058`)
- `lib/installer.js` — `ensurePluginStageIgnored` (`:375`), `ensureBmadDirIgnored`
  (`:453`), `ensureKnowledgeSiteIgnored` (`:530`) — the family the new helper joins
- `.gitignore:57` — the ma-agents-repo-only declaration
- `bin/cli.js` — opt-in prompt (`:1013-1039`), install call site (`:1575-1611`),
  success summary printed regardless (`:1622-1627`)

## Suggested Fix

1. Add `ensureCustomMarketplaceStageIgnored(projectRoot)` to `lib/installer.js`,
   mirroring `ensurePluginStageIgnored` byte-for-byte in contract (append-only,
   idempotent, EOL-preserving, never fatal), and call it from
   `installCustomMarketplaceSubset` immediately after staging succeeds.
2. Compute `stagePath` in `installCustomMarketplaceSubset` **before** invoking the
   stager (`path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)`) so the
   staging catch at `lib/bmad.js:1751` always has a handle to clean with.
3. Extend the existing cleanup guard in both stagers to cover the
   `marketplace.json` write (`lib/custom-marketplace.js:754-763` and `:1030-1035`)
   — a **staging** failure must never leave a stage.
4. Move `buildBmadArgs` (`lib/bmad.js:1762`) inside the guarded region.
5. Preserve the leave-in-place policy for post-invoke failures, but surface it in
   the wizard's final summary (and reflect the custom-marketplace step's failure
   there) so a retained stage is explained rather than mysterious.

## Acceptance Criteria

1. After a successful custom-marketplace install into a clean git repo, the target
   project's `.gitignore` contains `.ma-agents-custom-marketplace-stage/` exactly
   once; a re-run does not duplicate it (idempotency test, same shape as the
   plugin-stage gitignore tests).
2. If `.gitignore` is absent, it is created with the entry; if it is unwritable,
   the install still succeeds with a warning (matching `ensurePluginStageIgnored`).
3. A forced failure of the `marketplace.json` write in `stageCustomMarketplaceSubset`
   leaves **no** `.ma-agents-custom-marketplace-stage` on disk.
4. The same holds for `stageRegistrySubset`.
5. A forced `buildBmadArgs` failure leaves no stage on disk.
6. A forced **post-invoke** failure (bmad-method child process non-zero, or Cline
   reconcile throw) DOES leave the stage — the Story 30.6b AC 8 diagnostic contract
   is preserved and pinned by test.
7. In case 6, the wizard's final summary names the retained stage path and states
   that the custom-marketplace step did not complete.
8. Unchanged: a successful install still removes the stage
   (`lib/bmad.js:1781`), and Story 30.7 persist/re-enumerate still works with the
   stage absent (regression test over `reconcileCustomMarketplaceOnUpdate`).
9. A no-custom-source install remains byte-identical to baseline (NFR70).

## PRD Amendment Needed

**No.** This is a pure code fix. FR239-FR243 and NFR70-NFR72 already describe the
intended behaviour; the gitignore policy is an existing implementation convention
(Story 22.8, extended by bug 27.11 and Story 29.1) that this stage was never
enrolled in. No FR/NFR text changes.

## Provenance

- Reported 2026-08-02 from a clean Project-scope install (GitHub Copilot + Cline).
- Feature origin: Story 30.6b (prune + stage + install-the-subset), Story 30.7
  (persist + reconcile), shipped v3.17.0.
- Disproved hypothesis recorded above so it is not re-investigated: the success
  path DOES clean up (`lib/bmad.js:1781`, proven by the Workshop install log).
- Severity rationale: **Low**. Opt-in feature only; no data loss; consequence is an
  un-ignored residual directory plus a misleading success report.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/` and `bin/` source are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
