---
type: bug
severity: high
title: Story 31.4's staleness preflight block breaks Story 15.5's "preserves original content verbatim" invariant for four converted workflow skills
---

# A merged story broke a suite that four review rounds never ran

**Status:** OPEN — found 2026-08-19 during Story 31.8's independent review.
**Severity:** high (a red suite on the epic branch; blocks the Story 31.14 release gate)
**Affected:** `test/story-15-5-workflow-skills.test.js`; `lib/bmad-extension/skills/{add-sprint,
add-to-sprint,modify-sprint,sprint-status-view}/SKILL.md`
**Classification:** in-epic regression, requires an adjudication before it can be fixed.

## The finding

`test/story-15-5-workflow-skills.test.js` **passes on `main` @ `9b936ac` (157 passed, 0 failed,
exit 0)** and **fails on `feature/epic-31` (153 passed, 4 failed, exit 1)**.

Bisected by running the suite at each epic-branch merge commit:

| Commit | Merge | Result |
|---|---|---|
| `a4b8489` | Story 31.3 | **exit 0** — 157 passed, 0 failed |
| `38c7f8c` | **Story 31.4** | **exit 1** — 153 passed, **4 failed** |
| `536634b` | Story 31.5 | exit 1 — same 4 |

**Story 31.4's merge is the cause.** The four failures are all
`<skill> preserves original content verbatim`, with a body ~12,500 characters longer than the
source — the size of 31.4's ~107-line staleness preflight block. The affected skills are
`add-sprint`, `add-to-sprint`, `modify-sprint` and `sprint-status-view`.

## The genuine contradiction — this needs adjudicating, not silently patching

Two delivered requirements disagree:

- **Story 15.5's invariant:** a converted workflow skill's `SKILL.md` must contain the original
  workflow content **verbatim** after frontmatter stripping. `verifyContentPreserved`
  (`test/story-15-5-workflow-skills.test.js:222-223`) exists to prove the conversion is lossless
  and additive-free.
- **Story 31.4 AC4:** the staleness guard is *embedded as an instruction block in the affected
  skills*, deployed unchanged through both pipelines, **and must be the first `##` section** so no
  skill logic executes before the check (AC3's gateway position).

Both cannot hold for the same file. **Do not resolve this by weakening either test.** The
resolution is a decision about which invariant governs a converted workflow skill, and it belongs
to a human or to Story 31.14's release gate — not to a drive-by edit.

Three candidate resolutions, none yet chosen:

1. **Amend Story 15.5's invariant** to "the original content appears verbatim *in addition to* any
   preflight block the installer embeds", i.e. containment rather than equality. Preserves 31.4's
   gateway position. Weakens a lossless-conversion guarantee that has held since Epic 15.
2. **Exclude converted workflow skills from 31.4's guard.** But all four resolve
   `sprint_management_path`, so under 31.4's own OQ-3 criterion ("resolves a field
   `generateBmmConfig` derives from the binding") they genuinely need the guard — and 31.4 ships a
   completeness test that fails if a skill resolving such a field lacks it. Excluding them would
   trade a real staleness hole for a green suite.
3. **Move the guard out of the `SKILL.md` body** into a location the verbatim check does not scan,
   while keeping it ahead of skill logic. Needs checking against AC3's gateway requirement and
   against how `lib/bmad.js` deploys these files.

Resolution 2 is the weakest — it reintroduces exactly the drift the guard exists to catch.

## Why four review rounds missed it

Story 31.4 went through an implementer, an independent reviewer, a third-agent fix round and a
re-review. **None of them ran this suite.** Every one ran a curated list of layout-adjacent suites,
because `npm test` is not trusted in this repo (it halts on pre-existing drift) and the curated
lists were assembled from the suites each story touched.

`story-15-5-workflow-skills` was in nobody's list because Story 31.4 was understood as editing
*skill markdown*, and this suite's name gives no hint that it guards skill markdown.

It surfaced only because Story 31.8's implementer ran **all 98 chain suites individually** and
reported the failure, and then its reviewer **spot-checked the claim against `main`** instead of
accepting "environmental". The diagnosis on record at that point — "MIL-498 template drift,
pre-existing" — was **wrong**, and the reviewer said so.

**The process lesson:** a curated suite list is a hypothesis about blast radius, and a story that
edits 41 files across two deploy pipelines has a blast radius nobody curated for. Stories touching
`skills/` or `lib/bmad-extension/skills/` must run the skill-conversion and skill-authoring suites,
not only the layout suites.

## Blast radius

- **The epic branch has a red suite that `main` does not.** Story 31.14 AC-level release gating
  would catch it, but only at the very end.
- **No user-facing defect is known.** The block's *presence* is intended; the failing assertion is
  about a conversion invariant, not about runtime behaviour. The guard itself was verified working
  by 31.4's review (its P4 table is bound three ways to the real generator).
- **Story 31.6 also edits these skills**, so whichever resolution is chosen must compose with it.

## Acceptance criteria for whichever unit adopts this

1. The contradiction is **adjudicated explicitly and recorded** — which invariant governs, and why.
2. `test/story-15-5-workflow-skills.test.js` passes on the epic branch, without weakening either
   Story 15.5's lossless-conversion guarantee or Story 31.4's gateway-position requirement beyond
   what the adjudication deliberately concedes.
3. If Story 15.5's invariant is amended, the amended test still fails when a conversion genuinely
   loses content — prove it with a mutation that deletes source content.
4. 31.4's 41-copy / one-sha256 block invariant still holds, and its completeness test still fails
   if a binding-resolving skill lacks the guard.
5. A regression test or CI note ensures a story editing skill markdown runs the skill-conversion
   suites.

## Provenance

- Found by Story 31.8's independent reviewer while spot-checking six unverified "baseline failures"
  against `main`; five were genuinely environmental, this one was not.
- Bisected to `38c7f8c` by the orchestrator, by running the suite at each epic-branch merge commit.
- **Not caused by Story 31.8**, which modifies zero files under `lib/`.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
