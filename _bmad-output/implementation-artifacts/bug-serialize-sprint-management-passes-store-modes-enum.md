---
type: bug
severity: low
title: serializeSprintManagement validates against STORE_MODES where SPRINT_MODES belongs (bin/cli.js:1153) — dead-code-equivalent today because a jira early-return shadows it, but the write-side error message already omits jira from the legal set it prints while the read side accepts it
---

# Bug: `serializeSprintManagement` passes `STORE_MODES` where it should pass `SPRINT_MODES`

**Status:** OPEN — **blocks Story 31.5** (as a cleanup, not as a live defect)
**Severity:** low (no behavioural difference today; latent + already user-visible in one error string)
**Affected Component:** `bin/cli.js:1153` — `serializeSprintManagement()`
**Classification:** CODE FIX (ma-agents-owned) — latent correctness, plus one real message inconsistency

## Summary

Sprint management and knowledge stores have **different legal mode sets**. A store is
`same` / `local` / `remote`; sprint management is additionally allowed to be `jira`.
`serializeSprintManagement()` validates its `mode` against **`STORE_MODES`** instead of
**`SPRINT_MODES`**.

**There is no behavioural difference today**, because `sprint.mode === 'jira'` hits an early return
*above* the validation, so the only values that ever reach the check are the three both enums share.
The reviewer **proved the equivalence by swapping `STORE_MODES` for `SPRINT_MODES` and observing no
test change** — so this is genuinely dead-code-equivalent, not a latent crash waiting on an unusual
input.

Two reasons it is still worth fixing rather than ignoring:

1. **It is load-bearing on a code-structure accident.** The equivalence holds *only* because the `jira`
   early return sits above the validation. Any future refactor that moves, inlines or reorders that
   early return makes **sprint `jira` unwritable** — the exact mode the sprint concern exists to
   support, and one that Epic 14 / Story 17.22's Jira backend depends on.
2. **One inconsistency is already user-visible.** The write-side error message enumerates the legal set
   from `STORE_MODES`, so it **omits `jira`** — while the read side accepts `jira` perfectly well. A
   user who mistypes a sprint mode is told the legal values are `same`, `local`, `remote`, which is
   wrong for that field. That is a real (if small) defect today, independent of the dead-code question.

## Reproduction Steps

**The latent crash — not reproducible today** without moving the early return. Confirm by inspection:
`bin/cli.js:1153`, with the `sprint.mode === 'jira'` early return immediately above.

**The message inconsistency — reproducible now:**

1. Hand-write a `project-layout.yaml` whose `sprint_management` has an invalid `mode` (e.g. `mode: nope`).
2. Trigger the write path (`ma-agents config layout`).
3. **Expected:** the error lists the legal sprint modes, including `jira`.
4. **Actual:** the error lists the *store* modes and omits `jira`.

## Expected Behavior

`serializeSprintManagement()` validates against `SPRINT_MODES`, and its error message enumerates the
sprint concern's legal set — including `jira` — so the write side and read side agree on what a sprint
mode may be.

## Root Cause

Two enums with a three-value overlap, and a call site that picks the wrong one where the overlap makes
the mistake invisible. The `jira` early return means the non-overlapping value never reaches the check,
so no test could distinguish the two enums — the defect is undetectable by behaviour and visible only
by reading the code or the error string.

This is the third instance in Epic 31 of the same class: **write-side and read-side validation
disagreeing about a closed enum.** Story 31.2's review found the backend enum enforced on write but
not on read (fixed in 31.2), and the reviewer noted the implementer had hardened one side of that same
round trip while leaving the other open. Worth a moment's thought in 31.5 about whether these enums
should be defined once and shared by both directions, rather than fixing the third instance
individually.

## Blast Radius

- **Today:** one wrong error message on an invalid hand-edited sprint mode. Nothing else.
- **After any refactor that relocates the `jira` early return:** sprint management with the Jira
  backend becomes unwritable. That would be a loud failure rather than silent corruption, but it would
  break the Jira sprint backend outright.
- Fix is a one-line change plus a message correction and a test.

## Affected Files

- `bin/cli.js:1153` — `serializeSprintManagement()`, the wrong enum
- `bin/cli.js` — the `SPRINT_MODES` / `STORE_MODES` definitions, and the `sprint.mode === 'jira'` early
  return whose position the current correctness depends on
- `bin/cli.js` — `parseLayoutYaml` / `sprintFromRaw`, the read side that already accepts `jira`
- `test/project-layout-binding-spine.test.js` — where the enum-validation tests live

## Acceptance Criteria

1. `serializeSprintManagement()` validates against `SPRINT_MODES`.
2. Its error message enumerates the sprint concern's legal set **including `jira`**, and a test pins the
   message content — this is the part that is user-visible today.
3. A test proves sprint `mode: jira` is writable **without relying on the early return's position** —
   i.e. the test would still pass if the early return were removed. This is the test whose absence made
   the defect undetectable.
4. Read side and write side are proven to agree on the legal sprint-mode set (round-trip test over
   every legal value, `jira` included).
5. Consider defining each enum once and sharing it across both directions, so a fourth instance of this
   class cannot arise. If rejected, record why.
6. Tests run directly with `node --test`; failures baselined against `main` first.

## PRD Amendment Needed

**No.** FR112 already establishes sprint management as a separate concern with its own options, and
FR267 confirms it stays separate from both knowledge stores. The legal sprint-mode set including `jira`
follows from the existing Jira backend (Epic 14 / Story 17.22). This is purely an implementation
inconsistency.

## Provenance

- Found by Story 31.2's independent review (Epic 31, wave 1), which **proved the equivalence** by
  swapping the enum and observing no test change — so the "dead-code-equivalent today" claim is
  verified, not assumed.
- Not a 31.2 regression in behaviour; 31.2 is where the enums were introduced, and the wrong one was
  wired at one call site.
- Filed as a **Story 31.5 cleanup**, alongside
  `bug-read-existing-layout-collapses-two-stores-onto-software-store.md` and
  `bug-show-current-layout-prints-undefined-for-confluence-store.md`. Of the three, this is the only one
  that is not a live functional defect — it is filed to stop a structural accident becoming a Jira
  outage later.
- A bug REPORT, not a fix. No source was touched.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
