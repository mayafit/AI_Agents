---
type: bug
severity: medium
title: config.yaml's knowledgebase_path has no defined meaning for a Confluence-backed knowledge store — the installer writes "." because that is what the old code fell through to, not because anyone decided it
---

# Open question: what is `knowledgebase_path` for a `confluence`-backed store?

**Status:** OPEN — **question, not a defect report.** Nothing is broken today; the point is that
nothing was ever decided.
**Severity:** medium (no data loss and no crash; a wrong answer later is expensive to unwind because
the value is a path that other tools already resolve against)
**Affected Component:** `bin/cli.js` — `writeRepoLayoutConfig()`; `lib/installer.js` —
`generateRepoLayoutSection()`
**Classification:** DESIGN DECISION required (ma-agents-owned) — belongs to **Story 31.3**
(`project-layout.yaml` → `config.yaml` regeneration) or **Story 31.6**, whichever owns the Confluence
read path.

## Summary

`_bmad/bmm/config.yaml` carries a single `knowledgebase_path` field (FR117). Two things read it:

- `writeRepoLayoutConfig()` derives `planning_artifacts` from it (`kbPath === '.'` ⇒ the canonical
  `{project-root}/_bmad-output/planning-artifacts`, otherwise the path itself);
- the Knowledge Atlas config scan (`lib/knowledge-atlas/src/scan/config.ts`) reads it to find planning
  documents.

Both were written when a knowledge store was **always** a filesystem location. Story 31.2 sealed a
schema in which a store may instead be `backend: confluence`, whose identity is a space key plus a
`{title, id}` root page and which has **no path at all**.

So: for a project whose knowledge store lives in Confluence, what should `knowledgebase_path` say?

Nobody has decided. `toPortablePath(undefined)` returns `'.'`, so the installer wrote `"."` — a value
that arrived by falling through a falsy check, not by a decision. Read literally it asserts "the
knowledgebase is this repository", which is false.

## How this surfaced

Epic 31 prerequisite fix **B-1**: `ma-agents install --yes` read the committed
`_bmad-output/project-layout.yaml` only on the interactive "Update (add/remove skills)" menu choice,
so on every `--yes` run and every fresh clone it passed the bare single-repo default to the write
choke point and destroyed a committed Confluence store. Making the read unconditional fixed that —
and, as a side effect, made a `confluence` store reach `writeRepoLayoutConfig()` and
`generateRepoLayoutSection()` **for the first time** on the install path.

## Current behaviour (as shipped by the B-1 fix — deliberately conservative)

- `writeRepoLayoutConfig()` still writes `knowledgebase_path: "."` and still derives
  `planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"`. **The value is unchanged on
  purpose:** NFR82 requires no change to resolved artifact paths, and this field is what those paths
  are derived from. What changed is that the installer now *says so* — it prints a note naming the
  backend, saying the `"."` is the local artifacts default rather than the store's location, and
  pointing at `project-layout.yaml` as the authoritative identity.
- `generateRepoLayoutSection()` no longer renders `- **Knowledgebase:** .` for such a store. It names
  the backend and states that the value is not a directory, and it suppresses the
  "use the knowledgebase path" instruction, which was actively misleading guidance handed to every
  downstream agent.
- Both behaviours are pinned by `test/project-layout-two-store-round-trip.test.js` so they cannot
  drift silently while the question is open.

## The question to answer

For a `confluence`-backed knowledge store, is `knowledgebase_path`:

1. **The local artifacts directory** — i.e. `.`/`_bmad-output/planning-artifacts` is correct, and the
   field simply means "where planning artifacts land on disk", with the Confluence identity being a
   separate concern. (This is today's de-facto behaviour. If this is the answer, the field should be
   *renamed* or *documented*, because its current name says "where the knowledgebase is".)
2. **Absent** — the field is omitted for a non-filesystem backend, and every consumer must handle its
   absence. This changes `planning_artifacts` derivation and the Knowledge Atlas scan, and risks
   NFR82.
3. **A cache/mirror directory** — where Confluence content is synced to locally, which may be a real
   requirement once the Confluence read path exists at all.
4. **Something schema-level** — `config.yaml` grows a `knowledgebase_backend` field so consumers can
   discriminate instead of inferring from a path.

Note that once **both** stores can be Confluence-backed *and diverge* (FR257/FR258), a single
`knowledgebase_path` cannot describe them anyway. The answer probably has to arrive with whatever
Story 31.3 does about regenerating `config.yaml` from a two-store `project-layout.yaml`.

## Blast Radius

- No data loss and no crash today. `project-layout.yaml` remains the authoritative record and is not
  affected either way (P5-9.1).
- The risk is a **wrong answer chosen by default**: `knowledgebase_path` is already resolved against
  by the Knowledge Atlas scan and by `planning_artifacts`, so any change moves real files.
- Cosmetic-to-behavioural for AI agents: `project-context.md`'s Repository Layout section is
  instruction text. Before the B-1 fix it would have told agents to treat `.` as the knowledgebase
  path for a Confluence project.

## Affected Files

- `bin/cli.js` — `writeRepoLayoutConfig()` (the `knowledgebase_path` / `planning_artifacts` writer)
- `lib/installer.js` — `generateRepoLayoutSection()` (the project-context.md renderer)
- `lib/knowledge-atlas/src/scan/config.ts` — reads `knowledgebase_path`
- `test/project-layout-two-store-round-trip.test.js` — pins the current conservative behaviour
- `test/generate-project-context.test.js` — the file-system rendering this must not regress

## Acceptance Criteria (for whichever story adopts this)

1. A decision is recorded for what `knowledgebase_path` means when the software requirements store is
   not `file-system`, and it is written down in the PRD/architecture rather than only in code.
2. Whatever is decided, resolved artifact paths for a project that never configures a Confluence
   store are unchanged (NFR82).
3. Every consumer of `knowledgebase_path` is enumerated and updated together — a field that means one
   thing to the installer and another to the Atlas scan is the same read/write disagreement Epic 31
   already fixed once for `backend`.
4. The two-store case (FR257/FR258 — system and software stores diverging) is addressed, not deferred
   again: one scalar field cannot describe two stores.
5. The conservative behaviour pinned by the B-1 tests is either kept deliberately or replaced
   deliberately; it is not left to drift.

## Disposition after Story 31.3 (2026-08-15) — PARTIALLY answered; the core question goes to 31.6

Story 31.3 was asked to answer this question *if its AC1 design settled it*, and to say so plainly if
it did not. It settles **one** of the five acceptance criteria above and deliberately leaves the
central one open. Stated precisely, so that 31.6 inherits a smaller question rather than a vaguer one:

**AC4 — ANSWERED.** "The two-store case is addressed, not deferred again: one scalar field cannot
describe two stores." 31.3's AC1 adds `system_requirements_path` and `software_requirements_path` to
the generated `config.yaml`, beside the retained single-valued fields. A consumer that needs to know
where a *particular* store lives no longer has to read a scalar that cannot answer. The retained
`knowledgebase_path` resolves to the **software requirements store** (FR264 as amended 2026-08-02), so
its meaning is now at least unambiguous as to *which store* it describes — which it was not before.

**AC2 and AC5 — HELD DELIBERATELY.** Resolved artifact paths are unchanged for every project that
never configures a Confluence store (NFR82), and the conservative `"."` behaviour is now pinned by
*two* suites rather than one — `test/project-layout-two-store-round-trip.test.js` and
`test/project-layout-config-generation.test.js` (its AC1 Confluence test). The installer's note was
extended to name the two new fields as well as the legacy one, so the "this value is a stand-in"
statement covers everything the generator writes, and agreeing stores produce one note rather than
the same sentence twice.

**AC1 and AC3 — NOT ANSWERED. They belong to Story 31.6.** Reasons, in order of weight:

1. **31.6 owns the Confluence read path; 31.3 does not.** Deciding what a path *means* for a backend
   whose read path does not yet exist is inventing a meaning — precisely what this file was filed to
   prevent. Choosing between option 1 (rename/document the field as "where artifacts land on disk")
   and option 4 (a `knowledgebase_backend` discriminator) turns on what the Confluence reader
   actually needs, which is 31.6's information and not 31.3's.
2. **Option 3 is off the table and should be struck when this file is next edited.** FR266 is
   RETIRED: there is no local mirror, cache, sync or conflict resolution for Confluence stores
   (P5-9.6). A cache/mirror directory is therefore not an available answer.
3. **AC3 requires updating `lib/knowledge-atlas/src/scan/config.ts` in lockstep**, and AC1 requires a
   PRD/architecture amendment. 31.3 changed neither: the Atlas scan reads `knowledgebase_path`, whose
   value and derivation this story leaves byte-identical, so no lockstep change was owed — and
   amending the PRD to resolve an implementation problem is outside this story's remit.

**What 31.6 inherits.** A narrower question: given that per-store path fields now exist and that there
is no mirror, does a Confluence-backed store's `*_path` field mean "the local directory artifacts land
in" (option 1 — today's de-facto behaviour, needing documentation and possibly a rename), or does
`config.yaml` grow a per-store `*_backend` discriminator so consumers stop inferring a backend from a
path (option 4)? Options 2 and 3 are not live: option 2 risks NFR82, option 3 is retired with FR266.

## PRD Amendment Needed

**Possibly.** FR117 defines the single `knowledgebase_path`; F26/FR257–FR265 introduce two stores and
a non-filesystem backend without saying what happens to FR117's field. That gap is the question. No
amendment is proposed here — deciding requirements is not this fix's job.

**Still outstanding after Story 31.3.** 31.3 added the per-store fields but did not define what a path
means for a non-filesystem backend, so the FR117 gap is unchanged. See the disposition above.

## Provenance

- Found while implementing Epic 31 prerequisite unit **2B**, fix round 1, consequence 3 of the B-1
  fix (making `install` read the committed binding unconditionally).
- Not a regression: the value written is unchanged. What changed is that the code path became
  reachable from `install`, which is what made the undecided question visible.
- Filed rather than answered, on instruction: inventing a meaning for `knowledgebase_path` under a
  Confluence backend is a Story 31.3 / 31.6 decision, not an implementation detail of this fix.
- Referenced from code comments at both sites.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
