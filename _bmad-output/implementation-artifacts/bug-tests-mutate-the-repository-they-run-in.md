---
type: bug
severity: medium
title: Two test suites mutate the repository they run in — repo-layout performs a real install into its own worktree, and build-plugin leaves an orphan build directory
---

# Two suites dirty the working tree they are run from

**Status:** OPEN — filed 2026-08-17, found during Epic 31 wave 3/4 review rounds.
**Severity:** medium (no data loss in CI, but it corrupts local review evidence and has already
caused one reviewer to misattribute dirt to a prior session)
**Affected components:** `test/repo-layout.test.js`, `test/build-plugin.test.js`
**Classification:** repo hygiene / test isolation. **Not** an Epic 31 defect — both predate it.

## Summary

Two suites write into the repository they are executing in, rather than into a temporary
directory.

### 1. `test/repo-layout.test.js` performs a real install into its own worktree

Running it rewrites `AGENTS.md` (leaving an `AGENTS.md.backup-<timestamp>`), writes
`.ma-agents.json` and `_bmad-output/project-layout.yaml`, and regenerates the **entire tracked
`.agents/` tree** — on the order of 500 paths, a mix of modified, deleted and untracked.

### 2. `test/build-plugin.test.js` leaves an orphan build directory

It leaves `lib/.bmad-extension-plugin.build-<pid>-<timestamp>/` behind. Note this is the **test**,
not only the `npm run build:plugin` script — both leak, and the test's copy is the one that
surprises people, because running a test is not an action a developer expects to produce build
output.

## How this surfaced

During Epic 31, an independent reviewer of Story 31.4 found ~520 dirty paths in the story worktree
and, seeing timestamps ~113 minutes old, concluded they predated its own session and left them
alone — the correct conservative call. On the following round, having verified the tree was clean
at start, it established that **its own `repo-layout` run had produced them.**

The first review's conclusion was therefore wrong through no fault of its own: the evidence
genuinely looked like pre-existing state. That is the real cost of this defect — it does not break
a build, it **corrupts the provenance of review evidence.**

Separately, an orphan `lib/.bmad-extension-plugin.build-*` directory had to be removed from a story
worktree by the orchestrator before a commit, and a fix-round agent had to be told to delete one
after every rebuild.

## Blast radius

- **Review integrity (the real cost).** A reviewer cannot distinguish "the tree was dirty when I
  arrived" from "I dirtied it", which makes the standard cleanup procedure
  (`git checkout -- .agents AGENTS.md _bmad-output` + `git clean -fdq`) a judgement call rather
  than a reflex.
- **Concurrency.** Epic 31 independently observed that running suites while installs are in flight
  in the same worktree produces **false failures** — `project-layout-two-store-round-trip` returned
  30/16 and `config-storage` 15/1, both perfectly clean (46/0, 16/0) when run quietly. Suites that
  install into their own worktree are the mechanism.
- **Accidental commits.** Any workflow that stages broadly after a test run can commit hundreds of
  regenerated `.agents/` files. Epic 31 avoided this only by auditing `git show --stat` on every
  commit.
- **`git clean -fdx` is unsafe here**, because story worktrees use a `node_modules` junction that
  `-x` would delete — so the cleanup that would most reliably fix the mess is itself off-limits.

## Not a regression

Both behaviours predate Epic 31. `repo-layout` has run a full install since Epic 16, and the
orphan-build-dir class is related to the already-fixed `custom-marketplace` stage leak and the
bug 27.14 work-around pruning. This report exists because Epic 31 is the first effort to run these
suites repeatedly in parallel worktrees under independent review, which is what made the cost
visible.

## Suggested resolution

1. `repo-layout` should install into a temporary directory (the pattern
   `test/global-install-scope.test.js` already uses — it redirects `HOME`/`USERPROFILE` into a
   sandbox and asserts the project root stays empty), not into `process.cwd()`.
2. `build-plugin` should clean up its build directory in a `finally`, and the underlying script
   should do the same.
3. Whatever is decided, a test that asserts the working tree is unchanged after the suite runs
   would keep it fixed. That assertion is the thing actually missing.

## Acceptance criteria for whichever story adopts this

1. Running the full test suite leaves `git status --porcelain` byte-identical to its pre-run state.
2. No suite writes into the repository it is executed from; install-driven suites use a temporary
   directory with a redirected home.
3. A regression test pins condition 1, so this cannot silently return.
4. The fix does not weaken what `repo-layout` actually verifies — it currently exercises a **real**
   install, and that is its value; the goal is to relocate the target, not to stub the install.

## Provenance

- Found during Epic 31 (Global Installation & Federated Knowledge Stores), Story 31.4 review rounds.
- Deliberately **not** fixed in-epic: it is a test-infrastructure change touching suites owned by
  Epic 16 and Epic 30, with no F26 requirement behind it, and folding it into a story would be
  exactly the drive-by this epic has repeatedly declined to make.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
