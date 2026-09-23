---
type: bug
severity: high
title: bmad-dev-epic's per-story pipeline hands the subagent sprint-status.yaml but never says who owns the status field — so story subagents write `done` on self-report and invert the review gate for every downstream story
---

# Bug: `bmad-dev-epic` never assigns ownership of the `sprint-status.yaml` status field

**Status:** OPEN
**Severity:** high (process defect — falsifies the gate that unblocks downstream work)
**Affected Component:** `lib/bmad-extension/skills/bmad-dev-epic/` — `references/story-pipeline.md`,
`steps/step-04-run-waves.md`
**Classification:** SKILL FIX (ma-agents-owned). Affects **every future epic run**, not just Epic 31.

## Summary

`bmad-dev-epic` decomposes an epic into per-story subagents. Each subagent is handed
`SPRINT_STATUS = <path to sprint-status.yaml>` as a pipeline input
(`references/story-pipeline.md:18`) and is given a Definition of Done that requires
*"No blocking findings remain from either reviewer"* (`references/story-pipeline.md:85`).

**Nowhere does the skill say who is allowed to write the status field.**

The subagent therefore reasonably infers it should record its own outcome, and writes `done` to
`sprint-status.yaml` when it believes it has finished — which is **before the independent review
has returned**. `done` in `sprint-status.yaml` is precisely what unblocks downstream stories, so a
story that marks itself `done` before its gate returns has inverted the gate.

The DoD *implies* the correct ordering. It does not *assign* it. That gap is the whole defect.

## Evidence — two occurrences out of two stories, so systemic, not a slip

Observed in Epic 31, wave 1 (`_bmad-output/implementation-artifacts/epic-runs/31/run-ledger.md`):

| Story | What happened |
|---|---|
| **31.1** | Deliverable front matter said `Status: review` while `sprint-status.yaml` said `done`. The independent reviewer called the contradiction "the closest thing to a real defect in the diff". |
| **31.2** | Marked itself `done` on self-report. Its gating review then returned **CHANGES-REQUIRED with three blocking defects** — including **B-2**, a working PoC that landed `api_token: "sk-INJECTED-SECRET"` and `password: "hunter2"` into a **committed** file, falsifying the story's own security acceptance criterion (AC6 / NFR79). It took three fix rounds and four reviews to reach APPROVE. |

**The consequence that makes this high and not cosmetic:** Stories 31.3 and 31.5 both depend on
31.2. Had the premature `done` not been caught and reverted by hand (commit `2cdb2f3`), **both
would have unblocked off a binding spine carrying three blocking read-path defects, one of which
falsified its own security AC.** Two occurrences out of two attempts is a systemic property of the
instructions, not implementer error.

## Root Cause

An ownership gap, not a wrong instruction. Three things combine:

1. `references/story-pipeline.md:18` hands the subagent the `sprint-status.yaml` **path**, which
   reads as write access.
2. `references/story-pipeline.md:82-88` states the DoD as a checklist the **subagent** evaluates,
   including the reviewer condition — so the subagent believes it is the party that determines
   whether the gate passed.
3. The structured return value (`references/story-pipeline.md:92-105`) has a `status` field whose
   vocabulary (`merged-ready` / `blocked` / `needs-split`) is **disjoint** from
   `sprint-status.yaml`'s vocabulary (`ready-for-dev` / `review` / `done` / …). Nothing states that
   the return value is the *only* channel the subagent uses to report status, so writing the file
   too looks like helpful redundancy rather than a boundary violation.

`steps/step-04-run-waves.md` mentions `sprint-status.yaml` exactly once (line 33), and only for
applying a split — reinforcing by omission that routine status writes are unowned.

## Expected Behavior

The status field is **orchestrator-owned**:

- The story subagent **may** set `review`. It **must not** write `done` under any circumstance.
- Only the orchestrator writes `done`, and only after an independent reviewer has returned
  `APPROVE` or `APPROVE-WITH-NITS`.
- The subagent reports its outcome through its **structured return value**, which is the single
  channel the orchestrator reads.

## Acceptance Criteria

1. `references/story-pipeline.md` states explicitly that `sprint-status.yaml`'s status field is
   orchestrator-owned, that the subagent may set `review` but never `done`, and that the structured
   return value is the subagent's reporting channel.
2. The Definition of Done section says who evaluates it — the orchestrator, against the reviewer's
   verdict — rather than presenting it as a subagent self-check.
3. `SPRINT_STATUS` as a pipeline input is either removed, or annotated read-only with the reason.
   If a subagent has no need to read it at all, removing it is cleaner than documenting a
   restriction.
4. `steps/step-04-run-waves.md` states that the orchestrator writes `done` at integration time,
   after review sign-off, as part of the merge step.
5. `SKILL.md`'s "Critical Rules (NO EXCEPTIONS)" list gains the rule, since that is where the
   skill's other non-negotiables live and where an implementer is most likely to see it.
6. The rule is stated once as a rule and cross-referenced, not restated in four places where the
   copies can drift.

## Affected Files

- `lib/bmad-extension/skills/bmad-dev-epic/references/story-pipeline.md` — lines 18, 82-88, 92-105
- `lib/bmad-extension/skills/bmad-dev-epic/steps/step-04-run-waves.md` — line 33 and the
  integration step
- `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md` — the Critical Rules list
- `lib/bmad-extension-plugin/skills/bmad-dev-epic/**` — **the regenerated mirror.** Any change
  under `lib/bmad-extension/skills/` requires `npm run build:plugin` and a commit of the
  regenerated mirror, or CI's Bundle Drift Guard fails.

## Blast Radius

- **Every future `bmad-dev-epic` run on any epic.** This is orchestration tooling, not F26 code.
- The failure is silent by construction: a premature `done` looks exactly like a legitimate one,
  and the damage lands on *downstream* stories rather than the story that caused it.
- Detection currently depends on a human noticing a status/deliverable contradiction, which is what
  happened in Epic 31 — twice, by luck of an attentive reviewer.

## PRD Amendment Needed

**No.** This is a defect in ma-agents' own orchestration skill content. No F26 requirement, and no
Epic 31 acceptance criterion, is affected.

## Out of Scope for Epic 31

Deliberately **not** fixed inside Epic 31. The epic is F26 (global install + federated knowledge
stores); this is a change to the `bmad-dev-epic` skill, a different subsystem with its own bundle
mirror and drift guard. Folding it in as a drive-by would put an unrelated skill-content change and
a plugin-mirror rebuild inside the F26 diff and complicate Story 31.14's traceability gate. Epic 31
enforces the rule **procedurally** for its own remaining stories (recorded in the run ledger's
process rules); this report is what makes the fix durable beyond that.

## Provenance

- Found by the Epic 31 orchestrator during wave 1, after the failure occurred **twice out of two
  stories** and an independent review caught real blocking defects both times it mattered.
- Recommended in the wave-1 run ledger as *"worth a story against `bmad-dev-epic` rather than a
  silent local fix"*; filed here so it survives the run that found it.
- A bug REPORT, not a fix. No skill source was touched.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
