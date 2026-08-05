---
type: bug
severity: high
title: readExistingLayout collapses two distinct knowledge stores onto the software store — a system_requirements_store with its own backend and space_key is silently lost, then stamped over both records by the unconditional write
---

# Bug: `readExistingLayout` collapses two distinct stores onto the software store

**Status:** OPEN — **blocks Story 31.5**
**Severity:** high (silent data loss, but only reachable once two divergent stores can exist)
**Affected Component:** `bin/cli.js` — `readExistingLayout()` and its interaction with
`writeProjectLayoutYaml()`
**Classification:** CODE FIX (ma-agents-owned). Violates **P5-9.5**.

## Why this is filed rather than fixed in Story 31.2

**It is not a Story 31.2 regression.** The collapse behaviour is **byte-identical at 31.2's parent
commit and at 31.2 HEAD** — verified. Story 31.2 deliberately kept the existing single-knowledgebase
wizard shape intact, because splitting it into two independent store questions is **Story 31.5's**
job, and 31.2's mapping (both stores ← the one answered location) is the correct, non-regressing
behaviour *for as long as only one store can be answered*.

**But it becomes destructive the moment Story 31.5 lands**, because 31.5 is the story that first
*creates* two divergent stores. Filing it as 31.5's precondition rather than fixing it speculatively
inside 31.2 keeps the spine story's scope honest.

**Story 31.5 must not start until this is dispositioned.**

## Summary

`readExistingLayout()` returns the legacy `{knowledgebase, sprintManagement}` shape — the shape every
existing consumer (`collectRepoLayout`, `writeRepoLayoutConfig`, `showCurrentLayout`,
`handleConfigLayout`) expects. To produce it from the new three-record schema it must collapse the two
stores onto one value, and it picks the **software requirements store** (correctly, per FR264, which
makes the legacy single-valued fields resolve to the software store).

The collapse is lossless **only while both stores point at the same place**. Once they diverge:

1. `readExistingLayout()` reads a `project-layout.yaml` carrying a distinct
   `system_requirements_store` — its own `backend`, and for a `confluence` store its own `space_key`
   and `root_page`.
2. It returns only the software store. **The system store's identity is dropped on the floor.**
3. The installer pre-populates its wizard from that collapsed value.
4. `writeProjectLayoutYaml()` — now **unconditional** on every project install (Story 31.2 AC2) —
   writes both records from the single surviving value.
5. **The system requirements store is silently overwritten with the software store's location.**

The unconditional write is what turns a lossy read into destructive round-trip. Neither half is wrong
on its own; together, on divergent stores, they destroy configuration.

## Reproduction Steps (post-31.5; not reachable today)

1. Land Story 31.5 so two stores can be answered independently.
2. Configure `system_requirements_store` as `confluence` (some space key) and
   `software_requirements_store` as `file-system` in the current repo — the exact combination FR257
   names as the motivating case ("system requirements in Confluence for stakeholder visibility while
   software requirements stay in git alongside the code").
3. Re-run `ma-agents install` (or `ma-agents config layout`) and accept every default.
4. **Expected:** both stores unchanged.
5. **Actual (predicted):** `system_requirements_store` is rewritten as a `file-system` store pointing
   at the software store's location. The Confluence space key is gone. No warning.

## Expected Behavior

Either:

- **(a) Preserve on read.** `readExistingLayout()` keeps the full three-record topology alongside the
  collapsed legacy view, and `writeProjectLayoutYaml()` writes back the records it was not asked to
  change. This is the behaviour P5-9.5's "the two stores are independent" implies.
- **(b) Refuse to collapse.** If the two stores diverge and a caller asks for the legacy shape, fail
  loud rather than silently picking one — consistent with the NFR56 / P5-9.3 fail-loud posture.

(a) is almost certainly right for the install path; (b) may be right for genuinely legacy-only
consumers. **Story 31.5 should decide deliberately and record why.**

Note `writeProjectLayoutYaml()` **already supports the non-lossy path**: a caller may pass
`systemRequirementsStore` / `softwareRequirementsStore` directly and they take precedence over
`layout.knowledgebase`. Story 31.2 built that door for exactly this purpose. The gap is on the
**read** side, and in the install path not using it.

## Root Cause

An impedance mismatch held together by an invariant that Story 31.5 removes. The legacy
`{knowledgebase, sprintManagement}` shape is single-valued by construction and is what four existing
consumers read; the new schema is three-valued. Story 31.2 bridged them with a collapse that is exact
while `system == software`, and that invariant holds for every project that exists today. 31.5 is the
change that breaks it.

This is a **planned-obsolescence seam**, not an oversight — but nothing currently *fails* when the
invariant is violated, which is what makes it dangerous rather than merely temporary.

## Blast Radius

- **Zero today.** No project can have divergent stores until 31.5 ships. Verified non-regressing.
- **After 31.5: silent loss of a store's identity on every subsequent install or layout
  reconfiguration** — including the loss of a Confluence space key, i.e. the entire point of FR257.
- Worse than a crash, because the file still looks valid afterwards and is **committed to git**, so
  the corrupted topology propagates to the whole team on the next push (the exact class of harm FR263
  exists to prevent).

## Affected Files

- `bin/cli.js` — `readExistingLayout()` (the collapse), `writeProjectLayoutYaml()` (the unconditional
  write that makes it destructive; note it already accepts explicit per-store arguments),
  `collectRepoLayout()`, `writeRepoLayoutConfig()`, `showCurrentLayout()`, `handleConfigLayout()` —
  the four legacy-shape consumers that constrain any fix
- `_bmad-output/planning-artifacts/architecture/decisions/project-knowledge-and-repository-layout.md`
  — **P5-9.5** ("the two stores are independent"), the rule violated
- `_bmad-output/planning-artifacts/prd/capabilities/project-knowledge-and-repository-layout.md` —
  FR254, FR257 (independent per-store backends), FR264 (legacy fields resolve to the software store —
  the reason software is the correct collapse target)

## Acceptance Criteria

1. A `project-layout.yaml` with two **divergent** stores survives an install and a
   `ma-agents config layout` run **byte-identically** except for `generated` — no store loses its
   backend, `space_key`, or `root_page`.
2. Specifically: `system_requirements_store: confluence` + `software_requirements_store: file-system`
   round-trips intact. This is FR257's motivating combination and must be the headline test.
3. The four legacy-shape consumers keep working unchanged for **non-divergent** projects — no
   regression to today's behaviour (NFR82 / NFR34).
4. The chosen strategy — preserve-on-read (a) or refuse-to-collapse (b) — is **recorded with its
   rationale**, and if (b) is chosen anywhere, the failure names the two divergent locations and is
   actionable.
5. A regression test pins that the unconditional write cannot overwrite a record the caller did not
   supply.
6. Tests run directly with `node --test`; every failure baselined against `main` before being called a
   regression. Do not rely on bare `npm test` (see `bug-npm-test-windows-suite-health-chain.md`).

## PRD Amendment Needed

**No.** P5-9.5 and FR257 already require store independence; this is an implementation gap against an
existing rule, not a missing requirement. FR264's "legacy fields resolve to the software store" is
also already correct and is what makes software the right collapse target when a collapse is
genuinely needed.

## Provenance

- Found by Story 31.2's independent review (Epic 31, wave 1), round 3.
- **Verified byte-identical at 31.2's parent and at 31.2 HEAD** — explicitly not a 31.2 regression.
- Filed as a **precondition on Story 31.5** rather than fixed in 31.2, to keep the spine story's scope
  honest and because 31.5 is the story that makes it reachable.
- A bug REPORT, not a fix. No source was touched.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
