---
type: bug
severity: medium
title: BLOCKING-4's dead-citation guard treats "the cited file is absent" as legitimate — which is the CI state — so it is permanently blind to the exact class of citation it exists to catch, and only a dirty working copy ever catches one
---

# Bug: the dead-citation guard passes in CI precisely because the citation is dead

**Status:** backlog
**Severity:** medium (no wrong bytes are written; a guard that exists, is green, and proves nothing about the thing it names)
**Affected Component:** `test/project-layout-artifact-routing.test.js:1836` (the existence filter inside `BLOCKING-4`); `.gitignore:28`
**Classification:** TEST/GUARD DEFECT. Code fix; no PRD amendment.
**Found by:** the independent review of `fix/wds-default-module-set`, recorded there as C2 and explicitly **not** that change's defect.

## The defect

`BLOCKING-4` — *"no shipped skill document cites a file this repository does not ship"*
(`test/project-layout-artifact-routing.test.js:1814`) — walks every shipped skill document,
extracts each `_bmad-output/...` token that looks like a file path, and reports it as an
offender. Its last filter before the report is:

```js
if (!fs.existsSync(path.join(PROJECT_ROOT, token))) continue; // not a repo document
```
<sub>`test/project-layout-artifact-routing.test.js:1836`</sub>

The rule the guard is built on is stated in its own header (`:1786-1790`):

> *"a path that resolves to a file IN THIS REPOSITORY but is not shipped is, by
> construction, a file the user will not have."*

That rule needs the file to be **present** in the repo in order to fire. So the guard's
verdict is decided by whether the cited file happens to exist **on the machine running the
test** — not by anything in the commit.

## Why that is backwards

The guard's subject is *citations that resolve to nothing in a consuming project*. The
filter's effect is to **exempt every citation that already resolves to nothing here**. A
citation is skipped for being dead in exactly the case where it is most dead.

And the case is not hypothetical, because the one real offender is **gitignored**:

```
.gitignore:28:  _bmad-output/methodology/
```

`skills/open-presentation/SKILL.md` cites
`_bmad-output/methodology/BMAD_AI_Development_Training.pptx` at `:4`, `:13`, `:16`, `:17`
and `:18`. That path can never be present in a fresh checkout. **Absent is the CI state.**
Therefore:

- **CI is permanently green on this offender**, and silently reclassifies it as a legitimate
  runtime artifact.
- The guard catches an offender **only** when a developer's working copy happens to be dirty
  with the very file whose absence is the problem.

A guard whose only true-positive path requires local pollution is not a guard; it is a
coincidence. The failure mode is the worst available one — green, with a named test claiming
the property holds.

## Reproduction — the verdict flips on an untracked, gitignored file

Run on `fix/wds-default-module-set` at `55a03d6`, in a **clean worktree**. The source under
test is byte-identical in both runs; `git status --porcelain` reports **nothing** in both,
because the file is gitignored.

```
$ node test/project-layout-artifact-routing.test.js
59 passed, 0 failed                       # exit 0

$ mkdir -p _bmad-output/methodology
$ printf 'not a real pptx\n' > _bmad-output/methodology/BMAD_AI_Development_Training.pptx
$ git status --porcelain                  # (no output — gitignored)
$ node test/project-layout-artifact-routing.test.js
  ✗ BLOCKING-4 no shipped skill document cites a file this repository does not ship
  skills/open-presentation/SKILL.md -> _bmad-output/methodology/BMAD_AI_Development_Training.pptx
58 passed, 1 failed                       # exit 1

$ rm -rf _bmad-output/methodology
$ node test/project-layout-artifact-routing.test.js
59 passed, 0 failed                       # exit 0
```

This is the same 59/0-vs-58/1 split Story 31.14 recorded (`31-14-release-gate.md`), where it
was attributed to *"a `_bmad-output/methodology/` an EARLIER SUITE materialised"*. That
attribution is correct about the mechanism and **understates the consequence**: the
attribution treats the 58/1 as the anomaly, when 58/1 is the only run that tells the truth.
The 59/0 is the anomaly.

## Blast radius

- One known offender today (`skills/open-presentation/SKILL.md`).
- The blind spot is **general**, not specific to that file: any future shipped skill that
  cites a path under a gitignored directory — or any path simply not created in this repo —
  is exempt from the guard forever, with no signal.
- Two sibling reports depend on this guard being trustworthy and should be re-read once it
  is fixed: `bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md` (which
  observes that the guard "exists and is red" — on a dirty tree; in CI it is green) and the
  `_bmad/` coverage gap the same report names.
- It is worth checking whether the sibling `_bmad/` widening proposed in that report would
  inherit the same filter, and therefore the same blindness, on day one.

## Root cause

The existence check conflates two different questions:

1. *"Is this token a real file path, or incidental prose / a directory / a template?"* —
   a **parser** question, which the three filters at `:1833-1835` already answer
   (`.ext` required, `{…}` excluded, allowlist).
2. *"Does the consuming project have this file?"* — the **subject** of the test, which
   `:1836` then answers with the wrong oracle: this machine's disk.

`package.json`'s `files` list is already read at `:1815` and is the correct oracle for (2).
A cited path is dead in a consuming project iff it is not covered by `files` — a property of
the commit, identical in CI and on every developer's machine. Disk presence adds nothing to
that determination and subtracts the only case that matters.

## Proposed direction (not a decision)

Replace the disk-existence filter with a **shipped-ness** filter: a citation is an offender
when its path is not covered by `package.json`'s `files`, whether or not the file exists
locally. Concretely, `:1836` becomes a "is this token under a shipped root?" test, and
`CITABLE_RUNTIME_ARTIFACTS` (`:1798-1812`) keeps doing its present job — it already is the
honest, explicit list of paths a BMAD project genuinely creates for itself, and it is where
a deliberate exemption belongs.

Consequences to accept deliberately before coding:

- `skills/open-presentation/SKILL.md` goes **red immediately**. That is the point, but it
  means the fix must land together with a decision about that skill (fix the citation, or
  add a justified `CITABLE_RUNTIME_ARTIFACTS` entry saying who creates the file). Adding it
  to the allowlist with no such story would reproduce this bug by hand.
- The `_bmad-output/planning-artifacts/sprint-status-schema.md` entry already in the
  allowlist (`:1804-1811`, "PRE-EXISTING DEBT") is unaffected — allowlisting is checked at
  `:1835`, before the existence filter.
- Whatever replaces `:1836` must be **shown red against the current tree before the fix**,
  in a clean checkout with no `_bmad-output/methodology/`. A guard rewritten without that
  demonstration has not been shown to guard anything — which is the whole subject of this
  report.

## Acceptance Criteria

1. In a **clean checkout** with `_bmad-output/methodology/` absent (the CI state),
   `BLOCKING-4` reports `skills/open-presentation/SKILL.md` as an offender — i.e. the guard
   fails for the right reason where it currently passes.
2. The guard's verdict is **identical** with and without an untracked
   `_bmad-output/methodology/BMAD_AI_Development_Training.pptx` on disk. Pinned by a test, or
   by a filter that reads no disk state for that decision.
3. A synthetic shipped-skill citation of a not-shipped path is caught whether or not the
   target exists locally (both directions exercised).
4. `CITABLE_RUNTIME_ARTIFACTS` still exempts the entries it names, and each entry still
   states who creates the file.
5. `test/project-layout-artifact-routing.test.js` passes as a whole once the open-presentation
   citation is dispositioned; the disposition is recorded, not silently allowlisted.

## Out of scope

- Widening the guard to `_bmad/` paths — that is
  `bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md`'s item 2. Fixing
  this first means that widening does not inherit the blindness.
- Any change to `.gitignore:28`. The gitignore entry is correct; it is the guard's dependence
  on disk state that is wrong.
- The `fix/wds-default-module-set` change, from whose review this was extracted. That change
  neither introduced nor touched this guard.

## Provenance

- Extracted 2026-09-13 from the independent review of `fix/wds-default-module-set`, recorded
  there as **C2** and filed separately at the reviewer's direction: *"It is not this change's
  defect."*
- Mechanism previously observed, and correctly diagnosed as an inter-suite interaction, in
  `31-14-release-gate.md` (`project-layout-artifact-routing` 59/0 clean vs 58/1 dirty). What
  is new here is the **consequence**: the clean-tree pass is not a pass.
- Reproduction above run in the clean worktree
  `d:\Code\AI_Agents-epic-31\.worktrees\fix-wds-default-modules` at `55a03d6`.

## Notes

- Filed by hand following the `create-bug-story` file convention
- This is a bug REPORT, not a fix — `test/`, `skills/` and `.gitignore` are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
