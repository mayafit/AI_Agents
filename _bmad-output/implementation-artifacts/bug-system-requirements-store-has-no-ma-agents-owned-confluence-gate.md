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

## Provenance

- Raised by Story 31.9's implementer against its own work; confirmed by its independent reviewer as
  "a real AC7-vs-FR262 contradiction, and reporting rather than fixing it is the correct call."
- Both framing corrections above are the reviewer's, verified against source.
- **Must be dispositioned before the Story 31.14 release gate**, which carries the FR/NFR
  traceability sweep for the full live F26 set.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
