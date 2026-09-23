---
type: bug
severity: high
title: Story 31.2 AC5's "no rewrite" half was never implemented — every pre-F26 project-layout.yaml was silently upgraded to schema 2 by the first `ma-agents install`, and two of 31.2's own tests pinned that behaviour as correct
---

# Story 31.2 AC5 — the read half shipped, the "no rewrite" half did not

**Status:** CLOSED by Story 31.7 (the fix is in `writeProjectLayoutYaml`'s LEGACY PRESERVATION
branch, `bin/cli.js`). Filed for the record, because the defect shipped, was reviewed four times
without being seen, and was actively *pinned* by two tests written to prove the opposite.
**Severity:** high (silent, unprompted, one-way change to a **committed** file, on every user's
first upgrade — no prompt, no undo, and it defeated an acceptance criterion of the same story)
**Affected Component:** `bin/cli.js` — `writeProjectLayoutYaml()`
**Introduced by:** Story 31.2 (commit series for
`_bmad-output/implementation-artifacts/31-2-project-layout-yaml-authoritative-two-store-binding.md`)
**Closed by:** Story 31.7 (FR265, NFR82)

## The acceptance criterion

`_bmad-output/planning-artifacts/epics.md`, Story 31.2 **AC5** (emphasis added):

> **Legacy read (FR265 read half):** a `project-layout.yaml` that predates F26 — carrying the FR122
> `knowledgebase` / `sprint_management` shape, or a legacy single `knowledgebase_path` — is read as
> **both stores pointing at that one location**, with no error **and no rewrite**. Everything keeps
> working. (The user-facing migration offer is Story 31.7.)

AC5 is one criterion with two obligations: **read it as both stores**, and **do not rewrite it**.

## What actually shipped

Only the first obligation. `resolveProjectTopology()` reads a legacy file correctly and reports
`schemaVersion: 1` — that half is right and remains untouched.

The second obligation had no implementation at all. `writeProjectLayoutYaml()` emits
`schema_version: ${PROJECT_LAYOUT_SCHEMA_VERSION}` unconditionally, and **31.2 AC2** made that
function run on **every** install and every bind (it removed the "both concerns are same-repo ⇒ do
not write" branch on purpose). The composition of AC2 and the unconditional writer is that the
**first `ma-agents install` over any pre-F26 project rewrote its committed `project-layout.yaml`**,
converting the single `knowledgebase:` record into `system_requirements_store:` +
`software_requirements_store:` and stamping `schema_version: 2`.

No prompt. No notice. No way back other than `git revert` on a file the user did not know had
changed.

## This is not a conflict between 31.2 and 31.7 — it is 31.2 failing its own AC

It is tempting to read the situation as 31.2 AC2 ("write unconditionally") colliding with 31.7
AC3/AC4 ("nothing is migrated unless asked" / "declining leaves the project byte-identical"), and to
present 31.7's preservation branch as adjudicating that collision. **That framing is wrong and was
corrected in the source comment.** AC2 removes the *conditional-scope* branch; AC5 carves out the
*legacy* case. They are complementary halves of the same story and were written together. There was
never a requirements conflict to resolve — there was an unimplemented clause.

31.7 AC3/AC4/AC5 are independently satisfied by the same branch, which is why the defect surfaced
during 31.7. But 31.7 is where it was *found*, not where it was *introduced*.

## Two of 31.2's own tests pinned the defect

Worse than an omission: the behaviour AC5 forbade was written down as expected.
`test/project-layout-two-store-round-trip.test.js` carried two round-trip tests over legacy fixtures
whose whole point was "a legacy file survives a write". Both handed the writer back exactly the
records they had just read — a write that moves nothing — and then asserted on the file's **new**
contents:

- *"a legacy single-`knowledgebase` file: the legacy write maps onto both stores, no divergence
  invented"* asserted `after.includes('schema_version: 2')` with the message **"the write upgrades
  the schema"**. That is the unprompted upgrade, stated in as many words as an expectation.
- *"a pre-F26 file with no schema_version reads and rewrites without loss"* asserted the `gitUrl`
  appeared **twice** in the file after that same no-op write. The legacy fixture carries it once, so
  the assertion could only pass if the file had been rewritten into two store records.

Both would have failed had AC5 been honoured. Story 31.7 amended them: the first now asserts
`assert.strictEqual(readLayoutFile(tmpDir), fixture)` — byte identity, strictly stronger than the
schema-line check it replaced, since byte identity implies the schema line is unchanged *and* that
every record, comment, key order and line ending is too. The second now asserts the no-op write
announces that it left the file alone. Each test's own original property (one legacy record maps
onto **both** stores; no divergence is invented; the `gitUrl` reaches both) is still asserted, now
against a real write forced by moving the one record that is not a knowledge store — sprint
management.

## Why four review rounds did not catch it

Recorded because the *pattern* is the reusable lesson, not this instance.

1. **The test pinned the wrong direction, so the suite was green and stayed green.** Every review
   round after the first inherited a green suite over the defect. A reviewer looking for "is AC5
   tested?" found a legacy round-trip test and moved on.
2. **31.2's own completion notes claim the criterion is met.** The implementation artifact's AC
   checklist reads *"AC5 — legacy FR122 shape and legacy `knowledgebase_path`-only config both
   resolve as both stores, no error, no rewrite — tested both ways."* The words "no rewrite" appear
   in the completion record for a behaviour that was never implemented. The checklist tracked the
   **read** path and transcribed the whole AC text beside it.
3. **The three fix rounds were driven by adversarial review of the code that existed** (escaping,
   the closed enum, the non-destruction guard, the `too-new` classification). None of those lenses
   asks "which clause of the AC has no code at all" — an *absent* implementation has no code to
   review, so a code-first review cannot find it.
4. **The read and write halves live ~500 lines apart** in `bin/cli.js` and were reviewed as separate
   concerns. AC5 spans both.

## Blast radius (as shipped, before 31.7)

- Any project whose `_bmad-output/project-layout.yaml` predates F26 and that ran a 31.2-or-later
  `ma-agents install` or `ma-agents bind` had that committed file rewritten in place.
- The rewrite is **semantically faithful** — both emitted stores point at the same location the
  single `knowledgebase:` record named, so **no resolved artifact path moved** and nothing broke at
  runtime. That is why it went unnoticed. The harm is that a committed, human-readable, reviewed
  file changed shape without consent, and that the project silently left the layout its maintainer
  had chosen.
- It also made **31.7 AC5 unsatisfiable in principle**: AC5 requires the legacy notice not to nag
  across "repeated installs on an un-split legacy project", which presupposes a project can still be
  legacy after an install. Under the shipped behaviour it never could be.

## Fix (Story 31.7)

`writeProjectLayoutYaml()` gained a narrow preservation branch: when the existing topology is
already legacy (`schemaVersion < PROJECT_LAYOUT_SCHEMA_VERSION`) **and** nothing would move — decided
by `canonicalBindingBytes`, Story 31.3's existing canonicalisation of exactly the three location
records, not by a hand-rolled compare — the write is skipped and one gray line is printed in place of
the `Wrote …` line. The branch sits **after** 31.2's non-destruction guard, so it can only ever skip
a write, never perform one; and a schema v2 file is untouched by it, so no 31.2/31.3/31.5 behaviour
changes.

## Acceptance Criteria (already met — recorded so the closure is checkable)

1. A legacy `project-layout.yaml` survives a real `ma-agents install --yes` **byte-identically**.
   Pinned in `test/project-layout-legacy-single-store.test.js` (AC3/AC4 sections).
2. A legacy file survives a real `ma-agents config layout --yes` decline byte-identically. Same
   suite.
3. The two round-trip tests that pinned the defect now assert preservation instead of the upgrade,
   and still assert their own original property against a real write. Pinned in
   `test/project-layout-two-store-round-trip.test.js`.
4. A schema v2 file keeps today's write behaviour, including its refreshed `generated:` date.
5. The preservation branch is scoped in both directions by test (it fires for legacy-and-unchanged,
   and does **not** fire for legacy-and-changed or for v2).

## PRD Amendment Needed

**No.** FR265 and 31.2 AC5 already say the right thing. This was an implementation gap against a
correctly-written requirement, not a requirements defect. No epic or story text is edited: per the
project's no-retroactive-edit rule, completed stories stay as history and the closure is recorded
here.

## Provenance

- Found during the Story 31.7 fix round, while correcting an in-source rationale comment that
  mis-stated the situation as a requirements conflict between 31.2 AC2 and 31.7 AC3/AC5. Correcting
  the comment is what surfaced that 31.2 AC5 had already forbidden the rewrite.
- Referenced from the code comment at the LEGACY PRESERVATION branch in `writeProjectLayoutYaml`
  (`bin/cli.js`).
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
