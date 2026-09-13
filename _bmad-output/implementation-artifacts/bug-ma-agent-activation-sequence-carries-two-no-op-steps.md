---
type: bug
severity: low
title: ma-agent-{sre,devops,cyber} still carry the two Activation Sequence no-ops that were correctly removed from ma-agent-sqa
---

# Bug: three personas carry two no-op Activation Sequence steps

**Status:** backlog
**Severity:** low (no functional failure; two wasted instructions at the top of every activation,
and a four-way inconsistency between personas that are otherwise identical)
**Affected Component:** `lib/bmad-extension/skills/ma-agent-{sre,devops,cyber}/SKILL.md`
(`## Activation Sequence`), their `lib/bmad-extension-plugin/` mirrors, and the committed
`.agents/skills/` deployed copies
**Classification:** TEXT FIX — the same class as
`bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md`

## The finding

`bffe2bd` removed two steps from `ma-agent-sqa`'s Activation Sequence. It never made the same
removal in the other three. The result, as shipped today:

| persona | Activation Sequence steps | carries the no-ops |
| --- | --- | --- |
| `ma-agent-sqa` | **6** | no |
| `ma-agent-sre` | 8 | **yes** |
| `ma-agent-devops` | 8 | **yes** |
| `ma-agent-cyber` | 8 | **yes** |

The two steps, verbatim from the three that still carry them:

```
1. Load persona from this agent skill (already in context)
...
3. Remember: user's name is {user_name}
```

## Both steps are genuine no-ops

This was checked against the text, not inferred from the commit message (see the caution below).

- **Step 1 is self-cancelling.** It instructs the agent to load the persona *from the very
  document it is reading*, and then says so itself: *"(already in context)"*. An instruction whose
  own parenthetical states it has already happened directs no action.
- **Step 3 is redundant with step 2.** The preceding step already says *"store ALL fields as
  session variables: `{user_name}`, `{communication_language}`, `{output_folder}`"*. Step 3
  re-states one of the three variables step 2 just stored. It adds emphasis, not behaviour.

## The resolution runs the other way

The obvious-looking reading — *`bffe2bd` also produced the MANIFEST-path regression, therefore
its other change should be reverted too* — is **wrong**. Restoring the two steps to `ma-agent-sqa`
would propagate dead text into a fourth persona. The correct direction is to **drop them from
`sre`, `devops` and `cyber`**, bringing all four to six steps.

Deliberately **out of scope** for `fix/persona-manifest-path`, which is a text fix to Critical
Action 1 and 2 only. Recorded here so the decision is not re-litigated from scratch.

## Acceptance criteria

1. All four `ma-agent-*` personas have an identical Activation Sequence of six steps, in all
   three trees that ship a copy (`lib/bmad-extension/skills/`,
   `lib/bmad-extension-plugin/skills/`, `.agents/skills/`).
2. The removal is shown not to change any digest, or the moved digests are named — the same
   check `fix/persona-manifest-path` performed for Critical Actions.
3. A test pins the four Activation Sequences as equal to one another, so the next edit to one
   cannot silently skip the other three. This is the gap that let the inconsistency stand for
   eighteen months; asserting on one persona's text would not close it.
4. `npm run build:plugin` regenerates the mirrors and `marketplace.json` is unchanged.

## Provenance

- Found by an independent review of `fix/persona-manifest-path` (2026-09-13), which asked
  whether `bffe2bd`'s *other* change should be reverted alongside the one that branch reverts.
- Step counts and text read at source in
  `lib/bmad-extension/skills/ma-agent-{sqa,sre,devops,cyber}/SKILL.md`.
- **The caution that generalises from `bffe2bd`** is recorded in
  `bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md` under
  "Lesson for the next reviewer" — `bffe2bd` made two changes and described *both* as fixes; one
  was correct (this no-op removal), one was a regression. The commit message asserting intent is
  not evidence of correctness either way.
- See also `bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md` and
  `bug-workshop-standalone-installskill-loop-never-ran.md`.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
