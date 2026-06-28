# Step 07 — Final Report & Cleanup

**Goal:** Leave the user with a complete, honest picture of the run and a clean working tree.

## 1. Present the run summary

From the Run Ledger, present (in `{communication_language}`):

```
Epic <id> — <title>   |   <merged>/<total> stories merged

Stories
  ✓ S1  merged    e2e: pass   fixes: 1
  ✓ S2  merged    e2e: pass   fixes: 0
  ⚠ S3  BLOCKED   <one-line reason + unresolved findings>
  ⏭ S4  skipped (already done)

Epic adversarial review : <pass | findings cleared: n>
Package-integrity gate  : build ✓  drift ✓  tests: <new-failures: 0 vs baseline>
Beta publish            : <version + install line | skipped/declined>
Epic PR                 : <url | not opened>
```

## 2. Surface anything that needs the human

- List every `blocked` story and exactly what is unresolved — these are the user's follow-ups.
- Note any place the run HALTED and why.
- If the beta publish or PR was declined/skipped, state the exact commands to do it manually.

## 3. Cleanup

- Remove any remaining story worktrees: `git worktree remove .worktrees/epic-<epic-id>-story-<sid>` (and `git worktree prune`).
- Leave the **epic worktree and branch in place** until the user merges the PR — they may want to push fixes. After merge, the epic worktree can be removed with `git worktree remove .worktrees/epic-<epic-id>`.
- Persist the final Run Ledger to `{implementation_artifacts}/epic-runs/<epic-id>/run-ledger.md`.

## 4. Suggest next steps

Recommend `bmad-retrospective` for the epic once the PR merges, and (if any stories were blocked) `bmad-correct-course` to re-plan them.

This completes the workflow.
