---
type: bug
severity: high
title: "Test 11.1 AC9(c) encoded a Story 31.15 scope constraint as a permanent branch-relative git diff — vacuous on the branch it protected, red on every other branch"
---

# Bug: `11.1 AC9(c)` was a story-scoped claim made in a suite that runs forever

**Status:** review (implemented on `fix/ac9c-branch-scoped-tripwire`; NO verdict claimed)
**Severity:** high — it blocked three live fix branches and would have blocked every future
branch that edits a skill document, while providing zero protection on the branch it was
written for.
**Affected Component:** `test/project-layout-confluence-publish-hook.test.js` §11
(test `11.1`, and the `changedFiles()` helper it shared with `11.4`).
**Classification:** TEST FIX. No production code is touched by this change.

## The defect

Story 31.15's AC9(c) is a true and useful claim *about Story 31.15*: that story used the
upstream `on_complete` customization channel and therefore edited **no** skill document, so
the 41-copy preflight and the 9-copy gate could not have moved. Test `11.1` encoded that
claim as a **branch-relative git diff**:

```js
function changedFiles() {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'feature/epic-31'], …).trim();
  return execFileSync('git', ['diff', '--name-only', `${base}..HEAD`], …)…;
}

test('11.1 AC9(c) this story modifies NO file under skills/, lib/bmad-extension/skills/ or the plugin mirror', () => {
  const guarded = ['skills/', 'lib/bmad-extension/skills/', 'lib/bmad-extension-plugin/'];
  assert.deepStrictEqual(changedFiles().filter((f) => guarded.some((g) => f.startsWith(g))), []);
});
```

A `git diff` against a **moving base** is not a property of the product. It is a property of
whoever happens to be running the suite. That failed in both directions at once.

### Half one — VACUOUS where it mattered (the worse half)

On `feature/epic-31` itself, `merge-base(HEAD, feature/epic-31) === HEAD`. Reproduced at
`cf96366`:

```
HEAD=cf96366827391959e3c8c3ed946d0b8cc28736b5
mergebase=cf96366827391959e3c8c3ed946d0b8cc28736b5
diff count: 0
```

The diff is empty, `offenders` is `[]`, and the test passes **by construction, not by
evidence**. On the one branch the assertion was written to protect it could never have
caught anything. The baseline run confirms the green tick that means nothing:

```
=== 11. AC9 — the pinned invariants, re-derived here ===
  ✓ 11.1 AC9(c) this story modifies NO file under skills/, …
```

### Half two — FALSE-POSITIVE everywhere else

On any branch off the epic that legitimately edits a skill document, `11.1` fires and lists
exactly the files the change is *supposed* to change. Measured on
`fix/persona-manifest-path`: **111 passed, 1 failed**, the failure naming the eight
`ma-agent-*` SKILL.md files (four in `lib/bmad-extension/skills/`, four in
`lib/bmad-extension-plugin/skills/`) that are the entire point of that fix.

Three active fix branches were caught in it at the time of filing:
`fix/persona-manifest-path`, `fix/antigravity-path-divergence`, `fix/wds-default-module-set`.

## THE GENERALISABLE LESSON — record this, not just the fix

> **A story-scoped claim must never be asserted in a suite that runs on every branch
> forever.** "This story does not do X" is a fact about one commit range. A permanently
> executing test can only assert facts about the tree in front of it. When the two are
> confused, the test drifts to the worst possible pair of behaviours: it becomes *vacuous on
> the branch it describes* (whose diff against itself is empty) and *hostile to every branch
> it does not describe*.

The tell is in the test's own name and comment: the words **"this story"**. The suite is
otherwise the strongest in Epic 31 — its `§12` header explicitly warns that a source-text
grep is the wrong instrument for an effect claim, and `§14` spawns the real shipped commands
rather than trusting greps. The same discipline was simply not applied to `§11`: the right
question is not *"did this branch touch the guarded trees?"* but *"do the guarded trees still
hold their pinned invariants?"* — and only the second is answerable on every branch.

**The rule going forward:** if a test's name or comment contains *this story*, *this branch*,
*this change*, or *this PR*, it is asserting over a commit range and does not belong in a
permanent suite. Either pin it to a fixed sha range, or re-express it as a property of the
tree.

## The fix, and why this option

Three options were considered.

| # | Option | Verdict |
|---|---|---|
| 1 | Pin to Story 31.15's recorded sha range | Rejected. It keeps a **historical** claim green forever at the cost of a permanently executing subprocess pair, and protects nothing going forward — the invariant it guards can still be broken by the next commit. |
| 2 | Replace the diff with a direct invariant assertion | **CHOSEN**, with a strengthening. See below. |
| 3 | Retire `11.1` outright as redundant with `11.2`/`11.3` | Rejected on evidence — `11.1` *did* cover two invariant breaks that `11.2`/`11.3` cannot see. Retiring it would have been a real, if small, loss of coverage. |

### Did `11.1` catch anything `11.2`/`11.3` miss? Yes — two things.

`11.2` and `11.3` assert only **count** and **byte-uniformity**:

```js
assert.strictEqual(copies.length, 41);
assert.strictEqual(new Set(copies.map(sha256)).size, 1);
```

Neither pins **which bytes**, and neither pins **where the copies live**. So two genuine
invariant breaks pass `11.2`/`11.3` green:

1. **A coordinated edit to all 41 (or all 9) copies.** `length` stays 41 and `digests.size`
   stays 1. The blocks have changed and nothing in this suite notices.
2. **A copy relocated between shipped trees.** Moving one preflight copy from `skills/` to
   the plugin mirror keeps the total at 41 and the digest set at 1, while breaking the
   invariant that *both deploy pipelines carry the block*.

The retired diff would have caught both — but only incidentally, and only on a branch that
happened not to be the epic branch. The correct instrument for exactly those two gaps is the
**digest pin** and the **distribution pin**.

### What replaced it

`11.1` now asserts, over the tree as it stands on whatever branch is checked out, that both
pinned blocks are at their pinned digest **and** their pinned per-tree distribution:

| block | copies | sha256 | distribution (`skills/` · `lib/bmad-extension/skills/` · `lib/bmad-extension-plugin/`) |
|---|---|---|---|
| `## Knowledge Store Binding Preflight` (Story 31.4) | 41 | `ca9bf25b…67051f` | 13 · 14 · 14 |
| `## Knowledge Store Backend Routing` (Story 31.9) | 9 | `cda3d3d9…b09cfb` | 3 · 3 · 3 |

These are the same literals `test/release-gate-epic-31.test.js` AC7.1/AC7.2 pin. They are
**restated rather than imported**, because `§11`'s job is to re-derive the invariants inside
the suite that could break them.

The test also asserts that **every** collected copy classified into a known bucket. That is
not decoration: `collectHeadingBlocks` returns `path.relative` output, which is
backslash-separated on Windows, so a prefix match against `'skills/'` would silently score
every bucket zero. Without the `unclassified` assertion this replacement would have had a
vacuous-pass failure mode of its own — the exact defect shape it was written to remove.

`EXPECTED_TEST_COUNT` is unchanged at **112**: one test was replaced, not added or removed.
No other test in the suite was weakened, reordered, or deleted.

### The three required behaviours, demonstrated

1. **Passes on `feature/epic-31` for a real reason.** The assertions read 41 files, hash
   them, and compare against literals that are not derived from the tree. Nothing is empty
   and nothing is skipped.
2. **Passes on a branch that legitimately edits a skill document.** Verified directly against
   the `fix/persona-manifest-path` worktree (read-only; that branch was not modified): its
   tree yields `41 / ca9bf25b… / 13-14-14` and `9 / cda3d3d9… / 3-3-3`, and none of its eight
   changed `ma-agent-*` SKILL.md files carries either block.
3. **Fails red when a skill-document change actually breaks an invariant.** Proved by
   planting, and reverting, the breaks recorded in the evidence section of this file.

## Residual — NOT fixed here, deliberately

**`11.4 AC10` has the same shape and was left alone**, because the fix was scoped to one
test. `11.4` calls the same `changedFiles()` helper and the same `merge-base` against
`feature/epic-31`, and its name likewise says *"BY THIS STORY"*:

```js
test('11.4 AC10 Story 31.10\'s epics.md definition is BYTE-UNCHANGED by this story', () => {
  const changed = changedFiles();
  if (!changed.includes('_bmad-output/planning-artifacts/epics.md')) return; // untouched entirely
```

It is **less harmful** than `11.1` was — the early return makes it inert rather than red on a
branch that does not touch `epics.md` — but it carries the identical defect: it is vacuous on
the epic branch (empty diff → early return) and it will fire on any future branch that
legitimately edits Story 31.10's section of `epics.md`. It should get the same treatment: pin
the section's sha, or drop it. **Filed here rather than fixed, so it is not lost.**

`changedFiles()` is retained solely because `11.4` still calls it.

## Evidence

All runs in worktree `D:\Code\AI_Agents-epic-31\.worktrees\fix-ac9c-tripwire`, branch
`fix/ac9c-branch-scoped-tripwire`, off `cf96366`. The worktree lacked `node_modules`; a
directory junction to `d:\Code\AI_Agents\node_modules` was created, as the sibling fix
worktrees use.

### E1 — the defect, both halves

```
HEAD=cf96366827391959e3c8c3ed946d0b8cc28736b5
mergebase=cf96366827391959e3c8c3ed946d0b8cc28736b5
diff count: 0
```

Baseline suite run at `cf96366` with the ORIGINAL `11.1`: **112 passed, 0 failed, exit 0** —
`✓ 11.1 AC9(c) this story modifies NO file under skills/, …`, green over an empty diff.

`fix/persona-manifest-path` vs its merge base lists eight skill documents
(`lib/bmad-extension/skills/ma-agent-{cyber,devops,sqa,sre}/SKILL.md` and the four plugin
mirrors), each of which the original `11.1` reported as an offender.

### E2 — the suite after the fix

**112 passed, 0 failed, exit 0**, with:

```
✓ 11.1 AC9(c) a skill-document change cannot move the pinned blocks: both are at their PINNED DIGEST and PINNED DISTRIBUTION
```

`EXPECTED_TEST_COUNT` unchanged at 112, so the suite's own count guard is satisfied without
being touched.

### E3 — the planted invariant breaks, shown RED

Two breaks were planted into the shipped trees and reverted in the same step. Both were
chosen to be **invisible to `11.2`/`11.3`**, which is the point.

**Plant A — a coordinated edit to all 41 preflight carriers.** Count stays 41, `digests.size`
stays 1, the digest moves.

```
planted a coordinated edit into 41 carriers
✗ 11.1 … Story 31.4's preflight is no longer the pinned block. Expected all 41 shipped
  copies at ca9bf25b…67051f; got ["520db7c142a91a4c8fb39c5ee2f034bcb3d474ffdc72157637a493e19a38a59b"]
✓ 11.2 …  ✓ 11.3 …  ✓ 11.4 …
111 passed, 1 failed          EXIT=1
```

**Plant B — one preflight copy relocated from `skills/` to the plugin mirror.** Total stays
41, `digests.size` stays 1, the split moves.

```
relocated the block out of skills/add-sprint/SKILL.md into lib/bmad-extension-plugin/skills/_planted_relocated_copy.md
✗ 11.1 … Story 31.4's preflight has moved between the shipped trees:
  {"lib/bmad-extension-plugin/":15,"lib/bmad-extension/skills/":14,"skills/":12}
✓ 11.2 …  ✓ 11.3 …  ✓ 11.4 …
```

**In both plants `11.2` and `11.3` stayed GREEN.** That is the direct evidence that retiring
`11.1` would have lost real coverage, and the reason option 3 was rejected.

**Revert proved, not asserted.** After each plant the three shipped trees were restored with
`git checkout -- <trees>` + `git clean -fd -- <trees>` — verified beforehand to contain no
untracked and no ignored files, so the clean could remove nothing of value.

A note on the instrument, because getting this wrong is the same class of error as the bug
being fixed. The proof script's fingerprint helper used `git ls-files -s`, which reads the
**index**, not the working tree — it would have printed identical hashes whether or not the
revert worked, and it did. It proves nothing and is recorded here as a flawed probe rather
than quietly dropped. The authoritative check is `git diff HEAD` / `git status --porcelain`,
which compare **working-tree content** against `HEAD`, and both are empty over all three
trees after the reverts:

```
$ git diff --stat HEAD -- skills lib/bmad-extension/skills lib/bmad-extension-plugin
[empty]
$ git status --porcelain --untracked-files=all -- skills lib/bmad-extension/skills lib/bmad-extension-plugin
[empty]
```

and the invariants re-derived from the restored working tree are back at
`41 / ca9bf25b… / 13-14-14` and `9 / cda3d3d9… / 3-3-3`. **`git archive` was not used at any
point.**

### E4 — the three blocked fix branches, checked read-only

Reconstructed from each branch's **committed git objects** — no working tree was read or
written, no index was locked, and none of those branches was modified:

| branch | preflight | gate |
|---|---|---|
| `feature/epic-31` | 41 / `ca9bf25b…` / 13-14-14 | 9 / `cda3d3d9…` / 3-3-3 |
| `fix/persona-manifest-path` | 41 / `ca9bf25b…` / 13-14-14 | 9 / `cda3d3d9…` / 3-3-3 |
| `fix/antigravity-path-divergence` | 41 / `ca9bf25b…` / 13-14-14 | 9 / `cda3d3d9…` / 3-3-3 |
| `fix/wds-default-module-set` | 41 / `ca9bf25b…` / 13-14-14 | 9 / `cda3d3d9…` / 3-3-3 |

`unclassified` was empty in every case. None of the eight `ma-agent-*` SKILL.md files that
`fix/persona-manifest-path` changes carries either pinned block.

The new `11.1` reads **only the tree** — no `git` subprocess at all — so these four rows are
its complete input. Since every other test in the suite already passed on
`fix/persona-manifest-path` (its measured result was 111/1 with `11.1` the sole failure),
that branch goes to **112/0** under the fixed suite. The same holds for the other two.
