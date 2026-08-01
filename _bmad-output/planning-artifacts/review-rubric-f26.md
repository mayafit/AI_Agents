# PRD Quality Review — F26 (Global Install & Federated Knowledge Stores)

Reviewer: rubric walker against `assets/prd-validation-checklist.md`
Scope: the F26 delta only (FR248–FR265, NFR76–NFR83) plus the index reconciliation.
Date: 2026-08-01

## Overall verdict

**Adequate, with one blocker.** The delta is decision-ready and unusually well-grounded in
existing code and prior requirements. It is let down on scope honesty — zero `[ASSUMPTION]`
tags, no non-goals, no open-items index — and it contains one dangling dependency where a
requirement leans on a concept no requirement establishes.

## Decision-readiness — strong

Decisions are stated as decisions, not considerations. Two supersessions are marked in place on
the requirements they retire (FR111, FR117) rather than left for a reader to infer. FR250
states its own failure mode, which is the honest way to write a spike-gated requirement.

Trade-off surfaced well: FR264 explicitly chooses "keep `config.yaml` as a generated artifact"
over "teach skills a new config location", and names the reason (39 existing references).

## Substance over theater — strong

No persona, innovation, or vision theater — this is a capability delta on an internal developer
tool and reads like one. NFR theater specifically checked: NFR76–NFR83 all carry
product-specific content (air-gap parity, determinism, credential handling), none is a copied
"must be scalable/secure" line. NFR79 in particular states a concrete constraint (no
credentials stored; only space key and root page identity recorded).

## Strategic coherence — adequate

There is a real thesis — *where a project's knowledge lives is a property of the project, not of
the machine or of the install scope* — and all four threads follow from it. But the thesis is
**implicit**; it is never stated in one place. A reader has to assemble it from FR263, FR264 and
NFR83.

**Finding (medium):** state the thesis explicitly in the F26 capability-area description.

## Done-ness clarity — thin (the weak dimension)

Five of 26 new requirements use unbounded language:

| ID | Term | Assessment |
|---|---|---|
| FR250 | "reporting clearly" | **Real.** No bound on what the report must contain. |
| FR252 | "fast and safe to re-run" | **Real but duplicative** — "safe to re-run" is NFR78's job; the adjectives add nothing testable. |
| FR253 | "at a glance" | Rationale, not requirement. The testable part ("reports scope, lists bound projects") is sound; the phrase should go. |
| FR262 | "actionable guidance" | **Real.** No bound on the message content. |
| NFR79 | "safe to commit" | Acceptable — it is a conclusion drawn from two testable claims that precede it, but the testable part should lead. |

**BLOCKER — FR262 has a dangling dependency.** It specifies fallback to "the store's
file-system mirror", but **no requirement establishes that a Confluence-backed store has a
file-system mirror.** FR258 covers locations for the `file-system` backend only; FR259/FR260
cover space and root page. As written, FR262 cannot be implemented or tested — an engineer
would have to invent the mirror.

This also undermines NFR80: the air-gap claim depends on file-system-backed workflows
completing offline, but if a store is Confluence-backed with no mirror, its artifacts are simply
unavailable air-gapped — which contradicts the project's air-gap posture (NFR2/NFR50/NFR57).

Resolution options: (a) add a requirement establishing a local mirror for Confluence-backed
stores, or (b) narrow FR262 to read-only degradation with no mirror and accept that
Confluence-backed stores are unusable offline. (a) is the coherent choice given this product's
air-gap commitments; sync semantics belong to P5-9, not the PRD.

## Scope honesty — broken

The most serious gap after the FR262 blocker.

- **Zero `[ASSUMPTION]` tags** despite several inferences the user did not directly confirm —
  most notably that the sprint-management question (FR112) stays a separate third question, and
  that `implementation_artifacts` (story files) is not a third store.
- **No non-goals for F26.** Multi-space Confluence, bidirectional sync, and per-artifact page
  templating are all plausibly-assumed-in and nowhere excluded.
- **No open-items index.** Four genuinely open items exist and none is recorded:
  1. FR250's spike outcome — gates the scope of FR249.
  2. Confluence page structure: which artifact becomes which child page under the root.
  3. Mirror sync semantics (per the blocker above).
  4. **Where `implementation_artifacts` (stories) sit.** The user's split named brief+PRD and
     architecture+UX+epics. Stories are neither. `implementation_artifacts` is a distinct
     config field today, separate from `sprint_management_path` — so it is unclear whether it
     follows the software-requirements store, stays with sprint management, or becomes a third
     store. This will surface as a blocking question during epic creation if left unresolved.

Open-items density is currently zero on a chain-top PRD feeding architecture — which reads as
false confidence, not cleanliness.

## Downstream usability — adequate

IDs contiguous and unique (verified mechanically: 264 FR definitions, 263 distinct — FR35 the
only duplicate and pre-existing; 83 NFRs, all distinct). 117 internal links resolve; the 8 that
do not pre-date this change. Cross-references between F26 requirements resolve.

**Finding (medium):** F26 introduces five domain nouns used consistently but never defined —
*system requirements store*, *software requirements store*, *backend*, *project-bind step*,
*binding*. The PRD has no glossary. For a chain-top PRD feeding architecture and story
creation, these need definitions; "store" and "backend" especially are overloaded words.

**Finding (low):** F26 spans two capability files. Justified (install scope and knowledge
location are genuinely different capabilities) but it means no single file describes F26 whole.
The index paragraph mitigates this adequately.

## Shape fit — strong

Brownfield chain-top PRD for internal developer tooling, written as a capability spec with no
UJ padding — correct shape. Existing-code references were checked and are accurate:
`bin/cli.js:1441` (global BMAD skip), `bin/cli.js:605` (project-layout.yaml), `.gitignore:20`
(`_bmad/` ignored), FR122/Story 16.2 attribution. Brownfield requirements correctly distinguish
new behaviour from superseded behaviour.

## Mechanical notes

- FR265 says migration is "offered, never forced" but does not say what the offer looks like or
  where it appears. Thin, though acceptable for a PRD.
- FR252 bundles two triggers (explicit `ma-agents bind`; automatic on activation in an unbound
  project). These are separable and may want to be two requirements at story time.
- The capability-area entry for F26 in `vision-and-system-context.md` is long relative to its 25
  siblings — it carries four threads, so this is defensible, but it is the longest entry in the
  list.
