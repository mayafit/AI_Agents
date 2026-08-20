---
type: bug
severity: high
title: bmad-knowledge renders a Confluence-backed store's section from stale local files, silently and unconditionally — and no story in Epic 31 owns fixing it
---

# The Atlas quietly renders a Confluence-backed store from local leftovers

**Status:** OPEN — filed 2026-08-20 during Story 31.9's independent review.
**Severity:** high (silent incompleteness in a stakeholder-facing artifact; no error, no warning)
**Affected:** `skills/bmad-knowledge/SKILL.md`, `lib/knowledge-atlas/src/scan/config.ts`,
`lib/knowledge-atlas/dist/atlas.cjs`
**Classification:** unimplemented corner of **FR255/FR256** (artifact-to-store routing).
**Explicitly NOT** an FR262 violation — see the adjudication below.

## The defect

`bmad-knowledge` hands `projectRoot` to the Atlas engine (`skills/bmad-knowledge/SKILL.md:138`),
which scans `planning_artifacts` / `knowledgebase_path` **as directories**. When a knowledge store
is `confluence`-backed those fields resolve to a local folder that **is not the store** — Story 31.3
deliberately leaves `knowledgebase_path` at `"."` for a Confluence store (NFR82: resolved artifact
paths must not move), and the authoritative identity lives in `project-layout.yaml` as a space key
and root page.

So the Atlas renders that store's section from whatever stale local files happen to remain, with no
warning, and produces a **quietly incomplete site**.

## Adjudication — why this is NOT FR262, and why it still matters

Story 31.9's implementer raised this against itself and called it "arguably an FR262-class silent
degradation". Its independent reviewer disagreed on the classification and **was right**:

> FR262's normative text (`prd/capabilities/project-knowledge-and-repository-layout.md:57`) is
> conditioned on *"no Confluence MCP is available at runtime."* `bmad-knowledge`'s incompleteness is
> **unconditional** — it happens with the MCP present or absent, because the scan treats the field as
> a directory. This is an unimplemented corner of FR255/FR256, not a fail-loud failure.

But the user-visible harm is precisely the one Story 31.9's user story names:

> *"my team's stakeholder-visible PRD goes quietly out of date"*

An Atlas that renders a Confluence-backed store's section from stale local leftovers, with no
warning, is that harm arriving through a different skill.

## Why no existing story owns it — the deferral target was wrong

Story 31.9 deferred this to **Story 31.10**. The reviewer read all eight of 31.10's ACs
(`epics.md:5499-5509`) and established that **none covers it**:

- AC4 is *"writes go exclusively through the Confluence MCP detected in Story 31.9"* — writes, not the
  Atlas read path.
- AC1/AC2/AC5 are page-tree creation, tree shape, and update-not-duplicate.
- AC6 is which artifacts a store **publishes**.

Nothing there says `bmad-knowledge` gates on a backend. **Filed to 31.10, this falls off the plan.**

There is a second, structural reason it cannot go there: **it cannot be fixed the way Thread C fixes
things.** Every gate in Epic 31 is embedded instruction text in a skill document. The Atlas scan is
**compiled code** — `lib/knowledge-atlas/src/scan/config.ts`, shipped as the committed
`lib/knowledge-atlas/dist/atlas.cjs` bundle. Fixing it means a code gate in the engine **plus a
`npm run build:atlas` rebuild and a committed bundle**, which is a different kind of work from
anything else in the thread.

## Blast radius

- **Silent.** No error, no warning, no exit code. The site renders and looks complete.
- **Stakeholder-facing.** The Atlas is the artifact non-engineers read; a Confluence-backed store is
  chosen precisely *for* stakeholder visibility, so the two intents collide.
- **Unconditional.** Independent of MCP availability, so Story 31.9's gate cannot catch it.
- Not reachable before Epic 31: `confluence` only became selectable in Story 31.8.

## Suggested resolution

Either a **fail-loud gate** in the Atlas scan (refuse to render a store whose backend is not
`file-system`, naming the store and its space — consistent with FR262's posture even though FR262
does not compel it), or **genuine Confluence read support** via the MCP surface Story 31.10 builds.
The first is small and honest; the second is the complete answer and is much larger.

**Do not** resolve it by rendering the local folder with a caveat in the page — a stakeholder-facing
site that is wrong-but-annotated is the degradation this epic has rejected five times.

## Acceptance criteria for whichever story adopts this

1. A `confluence`-backed store never renders from a local directory scan without an explicit,
   loud statement of what happened — or renders from Confluence itself.
2. The behaviour is identical whether or not a Confluence MCP is present, since the defect is
   unconditional.
3. A `file-system`-backed project's Atlas output is **byte-identical** to today's (NFR82).
4. If the fix touches `lib/knowledge-atlas/src/`, `npm run build:atlas` is run and the regenerated
   `dist/atlas.cjs` committed, or the drift guard fails.
5. The story records whether this is FR255/FR256 completion or a new requirement, rather than
   inheriting the ambiguity that produced this report.

## Provenance

- Raised by Story 31.9's implementer against its own work — the correct instinct, filed to the wrong
  owner.
- Classification corrected and the deferral target falsified by Story 31.9's independent reviewer,
  which read 31.10's ACs rather than assuming they covered it.
- **Not caused by Story 31.9**, whose eight ACs are all about the gate.
- Must be dispositioned before the Story 31.14 release gate, and belongs in **31.14 AC5's fail-loud
  sweep** whether or not it is fixed first.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
