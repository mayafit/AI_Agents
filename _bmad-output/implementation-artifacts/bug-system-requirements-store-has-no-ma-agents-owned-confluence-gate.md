---
type: bug
severity: medium
title: A Confluence-backed system requirements store has no ma-agents-owned MCP gate — its only consumers are upstream BMM workflows ma-agents does not ship
---

# Reported contradiction: FR262 wants a gate where Story 31.9 AC7 forbids one

**Status:** OPEN — filed 2026-08-20, reported not fixed, per the standing rule that contradictions
are reported rather than resolved by editing a requirement.
**Severity:** medium (a real coverage gap, but partially mitigated today — see below)
**Affected:** `lib/installer.js` (`generateRepoLayoutSection`, `describeStoreForContext`), upstream
`bmm` workflow documents that ma-agents neither owns nor ships.
**Classification:** epic-scope question. **Not** a defect in any single story.

## The contradiction

**FR262** requires that a store configured for `confluence` fail loud when no Confluence MCP is
available. **Story 31.9** implements that as an instruction block embedded per skill — and its
**AC7** forbids changing `lib/installer.js` or `lib/bmad.js`.

But **no shipped ma-agents skill resolves a system-requirements artifact.** Story 31.9's reviewer
checked every `system_requirements_path` occurrence under `skills/` and found each one inside Story
31.4's read-only preflight comparison table — never a resolution instruction. Story 31.6 §5.2 reached
the same conclusion independently: epics are the only knowledge-store artifact any ma-agents skill
resolves.

The brief, PRD and their shards are resolved by **upstream BMM workflows**, which learn the layout
from `project-context.md` — whose Repository Layout section is written by `generateRepoLayoutSection`
in `lib/installer.js`, the file Story 31.9 AC7 forbids it to touch.

So a Confluence-backed **system requirements** store has no ma-agents-owned gate, and Story 31.9
could not have given it one without violating its own AC7.

## Two corrections to how this was first framed

Story 31.9's report both overstated and understated the gap. Its reviewer corrected both, and the
corrections matter:

**It overstates the gap** by not crediting what already ships. `lib/installer.js:994-996` already
emits, via `describeStoreForContext` (`:869`):

> The system requirements store is `confluence`-backed; do not treat the value above as a directory

That is a **warning, not a gate** — no MCP detection, no halt, no naming of the space — but it is not
nothing, and it means an agent reading `project-context.md` is told the value is not a path.

**It understates the gap** by implying AC7 is the obstacle. **Lifting AC7 would not fix this.** The
consumers are upstream BMM workflow documents ma-agents does not own or ship. Even a perfect
Confluence gate written into `project-context.md` would be advisory text those workflows read at
their discretion — the same "text exists where nothing is directed to read it" shape this epic has
now hit three times (Story 31.11's bind offer, Story 31.4's instruction table, and this).

## The real question

This is not "should Story 31.9 have had a bigger scope." It is:

> **How is a knowledge store federated when its only consumers are third-party workflow documents
> the product does not ship?**

Epic 31's whole mechanism — embed an instruction block per skill, deploy it verbatim through both
pipelines — presumes ma-agents owns the consuming document. For the system requirements store, it
does not. P2-10's division of labour ("ma-agents collects, persists, generates and stamps into
`project-context.md`; the workflows consume") holds for *paths*, where a wrong value merely resolves
elsewhere. It does not obviously extend to *fail-loud gating*, where the whole point is to stop.

## Blast radius

- A project with a Confluence-backed **system** store and no Confluence MCP gets no halt from
  ma-agents when an upstream workflow writes the brief or PRD. What it gets is the advisory line
  above, and whatever the upstream workflow decides to do with it.
- The **software** requirements store is properly gated (Story 31.9, six documents), because epics
  are ma-agents-resolved. **The two stores are therefore protected asymmetrically** — which FR257's
  independence guarantee does not lead a user to expect.
- Not reachable before this epic: `confluence` became selectable only in Story 31.8.

## Candidate resolutions — none chosen

1. **Accept and document.** State in `project-context.md` and the release notes that fail-loud gating
   covers ma-agents-resolved artifacts only, and that a Confluence-backed system store relies on the
   MCP being present. Cheapest; honest; leaves FR262 partially unmet by design.
2. **Strengthen the advisory into a gate in `project-context.md`.** Requires relaxing 31.9 AC7 (or
   assigning it elsewhere) and still depends on upstream workflows obeying instruction text.
3. **Narrow FR262's scope explicitly** to stores whose artifacts ma-agents resolves — a PRD amendment,
   and the only option that makes the requirement true as implemented.
4. **Own the resolution.** Have ma-agents resolve system-requirements artifacts rather than delegating
   to upstream workflows. Largest, and contrary to P2-10.

**Option 3 is the one that makes the record honest**; option 1 is the one that ships fastest. Both
are decisions for a human, not for a story.

## Acceptance criteria for whichever unit adopts this

1. The asymmetry between the two stores' gating is either removed or **explicitly documented** as
   intended, in the PRD rather than only in code comments.
2. If FR262's scope is narrowed, the amendment says which artifacts are covered and why, and Story
   31.14's traceability reflects it.
3. Story 31.9's existing gate is not weakened in the process.

## Disposition note — Story 31.15 (2026-09-04). STATUS STAYS **OPEN**.

Story 31.15 is a **fifth candidate resolution**, not one of the four above: **own the *trigger*
without owning the *document*.** ma-agents does not edit the five upstream BMM authoring workflows —
it generates `_bmad/custom/<skill>.toml`, the **team** layer of the three-layer customization merge
all five resolve at activation, setting `on_complete` to run
`ma-agents confluence-plan --store <store>` when that skill's store is Confluence-backed. The
channel is upstream-sanctioned and the documents stay untouched.

**What that closes.** The blast radius named above is closed **for the five authoring skills**
(`bmad-product-brief`, `bmad-prd` → system store; `bmad-architecture`, `bmad-ux`,
`bmad-create-epics-and-stories` → software store). A Confluence-backed system requirements store is
no longer a setting that quietly does nothing: the workflows that produce its artifacts now carry a
fail-loud publish directive, delivered through a file ma-agents owns rather than through a document
it does not.

**What that does NOT close, and must not be read as closing.**

1. **The FR262-scope question stays OPEN and is a decision for a human**, exactly as this file says.
   Options 1–3 above are still live; nothing here amends the PRD.
2. The trigger is a **directive to an agent**, not an enforced gate. It carries FR262's fail-loud
   obligation in its text — including an instruction to correct the "artifact is ready" message the
   workflow has *already* emitted — but the guarantee is an agent obeying an instruction, which is
   weaker than Story 31.9's embedded gate. Story 31.15 §2's mock-verification limit applies: no live
   Confluence MCP was reachable, so that obedience is unproven.
3. It covers only the **five** artifacts FR264 enumerates. Any other consumer of a Confluence-backed
   store is unaffected.
4. It introduces a **new** consequence of its own: the three-writer collision on
   `_bmad/custom/<skill>.toml` (Story 31.15 AC12). An agent running the upstream `bmad-customize`
   skill can leave that file with a duplicate declaration, at which point `resolve_customization.py`
   discards the **entire team layer** — the customizer's change and the publish hook together — with
   a stderr warning and **exit 0**. Mitigated by a write-side refusal at install/`bind`, a
   `ma-agents status` detection path, and an in-file owner comment; the silent discard itself is
   upstream and cannot be fixed here.

Story 31.14's disposition of this bug should record the above and leave the status **OPEN**.

## Provenance

- Raised by Story 31.9's implementer against its own work; confirmed by its independent reviewer as
  "a real AC7-vs-FR262 contradiction, and reporting rather than fixing it is the correct call."
- Both framing corrections above are the reviewer's, verified against source.
- **Must be dispositioned before the Story 31.14 release gate**, which carries the FR/NFR
  traceability sweep for the full live F26 set.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
