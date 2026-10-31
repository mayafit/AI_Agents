# Implementation Readiness Review — F27 / Epic 32 (P5-10 hard gate)

**Scope:** Epic 32 only (stories 32.1–32.9), the gate that opens the P5-10 decomposition. Requirements
reviewed: F27 FR275–FR278 (`prd/capabilities/bmad-platform-currency.md`), FR271 (latest-only; it sits
under the **F28** heading in `prd/capabilities/bmad-integration-and-bundling.md:58` but is the policy
Epic 32 executes), and the F28 items Epic 32 touches (NFR84's unique-leaf clause). FR236 superseded;
FR213 inverted; NFR74 and NFR59(c) amended. A short look-ahead covers Epics 33–35, which are not yet
broken into stories.
**Inputs:** `sprint-change-proposal-2026-10-31.md`; the PRD shards and `prd.md` registers; Decision
P5-10 (`architecture/decisions/bmad-integration-and-bundling.md`), the P2-11 amendment,
`implementation-patterns.md` Phase 5, `structure-and-boundaries.md` target tree, `architecture.md`
register; `epics.md` Epics 32–35 and the Cross-Epic Notes (`:5842-5930`); the nine
`implementation-artifacts/32-*.md`; `sprint-status.yaml:508-520`; the upstream delta
`bmad-6.11-6.12-impact-analysis.md` (branch `docs/bmad-6-11-6-12-impact-analysis`).
**Reviewed:** 2026-10-31, worktree `D:\Code\AI_Agents-extension-split`, branch
`docs/sprint-change-proposal-extension-split` at `9a47df6`.
**Method:** two-direction traceability at AC level; Blocked-on vs wave list vs sprint-status;
P5-10 sub-decision cross-check; spot-checks against the repo tree (CI workflows, `git grep`).

---

## Verdict

> ## READY WITH CONDITIONS
>
> **Update 2026-10-31:** C-1…C-8 and C-10 are DISCHARGED by planning edits (see
> [Conditions discharged 2026-10-31](#conditions-discharged-2026-10-31)). **Only C-9 remains open**
> (PO semver decision at the 32.9 cut). 32.1 may start.

The epic is well built. All five requirements trace to testable ACs. Every story names an
outside authority for its tests, carries mutants, and lists what is out of scope. Not one story
does Epic 33–35 work. **32.1 can start once two short additions are made to its own AC text
(C-1, C-2).** No other condition blocks the spike.

The two findings that matter most are ones the stories cannot see from inside the epic. First,
the spike's PASS rule does not depend on the `sprint_plan.py` schema verdict, and 32.4 deletes
our sprint planning skill on the strength of exactly that premise (F-1). Second, Epic 34 as
written never restores the preflight for `bmad-sprint-planning`, which is the gap 32.4 records
as temporary (F-3).

| # | Condition | Discharged by | Must be settled before |
|---|---|---|---|
| C-1 | Make the 32.1 AC8 schema verdict decide whether 32.4 may start. `divergent` or `subset` → 32.4 halts until the PO accepts the dropped keys. Add a 32.4 AC: a `sprint_plan.py generate` round-trip keeps `backlog` / `sprints` intact | 32.1 (AC10) + 32.4 (new AC) | **32.1 starts** |
| C-2 | Extend 32.1 AC9 with: (g) the invocation contract of `bmad-build` / `bmad-build-auto` (input, artefacts produced, `sprint-status.yaml` writes); (h) proof that the **npm tarball** ships `src/**/v6-shims/` and `src/**/scripts/*.py`; (i) the set of names present at 6.10.0 and gone at 6.12.4 that are *not* shims | 32.1 | **32.1 starts** |
| C-3 | Delete or align the Cross-Epic Note that lets 33.2/33.3 overlap with 32's Waves 3–4 (`epics.md:5926`). It contradicts P5-10.8 | PM (+ Architect) | **Wave 3** |
| C-4 | Decide whether Epic 34 restores preflight and the 31.9 gate for `bmad-sprint-planning` / `bmad-build*`, since FR273's Confluence targets omit them. Fix the story reference in 32.4 AC8. Define its "Epic-34 marker" as something visible in *this* repo | PM → FR273/Epic 34; then 32.4 | **32.4 starts** |
| C-5 | Add `32-4` and `32-5` to 32.6's Blocked-on (or split AC1/AC8 into a follow-up). Run the `.agents/skills/` regeneration after 32.4 merges | SM, 32.6 | **Wave 2 starts** |
| C-6 | No GitHub workflow runs `npm test`, and none installs `uv`. Make 32.9 AC3 ("Linux CI") achievable, either by adding a Linux test job with `uv` + Python 3.11 or by restating AC3 as a recorded Linux container run | 32.9 (T3); note in 32.7 | **32.7 starts** |
| C-7 | Fix 32.2's "so that … fails at install-prep time": it contradicts NFR74 clause 1 and 32.9 AC7(b). Drop the stale NFR59 claim and T9 (the annotation already exists at `bmad-platform-currency.md:152`) | 32.2 story text | **32.2 starts** |
| C-8 | Give the `engines.node >=20.12.0` change a requirement. It is user-visible and it is the main MAJOR argument, yet it rests only on the proposal's Technical-impact table | PM → FR275 or FR277 | **32.3 starts** |
| C-9 | PO decides MINOR vs MAJOR. Fix the sprint-status `32-9` comment ("MINOR argued"), which pre-decides it. If MAJOR, renumber Epic 35.6 and the `epic-35` comment (4.0.0 → 5.0.0) | PO via 32.9 AC6; PM | **32.9 cuts** |
| C-10 | If upstream's `AGENTS.md` block is LLM-driven, 32.8's simulation must read its markers and template from the vendored 6.12.4 tree at test time, never type them into the test | 32.8 | **32.8 starts** |

### Counts at a glance

| Measure | Result |
|---|---|
| Epic 32 FRs traced to ≥1 story AC (FR271, FR275–FR278) | **5 / 5** |
| Amended / re-asserted NFRs traced (NFR2, 46, 49, 50, 52, 57, 58, 59a/b, 73, 74-cl.1) | **11 / 11** |
| NFR59(c) / NFR74-cl.2 inversion carried by a test | **Yes** — 32.2 AC1, AC2 |
| Orphan requirements (req → no AC) | **0** (FR276 has a soft gap, see F-6) |
| Orphan ACs (AC → no FR/decision) | **1** — 32.3 AC2 engines (C-8) |
| Stories / ACs | **9 / 87** |
| ACs bound to an outside authority | **all test-bearing ACs**; weakest are 32.4 AC6 (count re-pin) and 32.8 (simulation risk) |
| P5-10 sub-decisions honoured / contradicted | **4 / 4 in scope (.5 .6 .7 .8) honoured by stories; .8 contradicted by `epics.md` note (C-3)** |
| Stories doing Epic 33–35 work | **0** |
| Blocked-on vs `sprint-status.yaml` comments | **match exactly**; vs wave list: 1 hidden edge (C-5) |

---

## Findings

### HIGH

#### F-1 — The spike's PASS rule ignores the premise 32.4 deletes code on

P5-10.5 says we delete our skill "(upstream's `sprint_plan.py` core preserves our schema keys)".
32.1 AC8 measures exactly that: preserved, dropped, rewritten or rejected per key, with a verdict
of **superset / subset / divergent**. But under 32.1 AC10, PASS needs only AC4 (uv air-gap) and AC3
(no shims). So a `divergent` AC8 still yields PASS. 32.4 (`Blocked on: 32-3`) has no AC that
depends on AC8. It deletes our `bmad-sprint-planning` and makes upstream's the only writer of
`sprint-status.yaml`, the file that carries our `epics` / `backlog` / `sprints` sections.
**Risk:** if upstream's `generate` drops or rewrites `backlog` or `sprints`, the first sprint
planning run after 32.4 corrupts the project's tracker. **→ C-1.**

#### F-2 — The Cross-Epic Note contradicts the hard gate

`epics.md:5926`: *"33.2/33.3 may overlap with 32's Waves 3–4 only if 32.1's gate verdict is PASS."*
That contradicts P5-10.8 ("no carve-out starts before its release gate passes"), the Epic 33
dependency line ("Epic 32 release gate PASSED (hard gate)"), the 32.9 header and
`sprint-status.yaml:518` ("Needs epic-32 release gate PASS"). Waves 3–4 hold 32.7, 32.8 and 32.9,
so the clause would let `ma-standards` and `ma-knowledge` be carved before the TOML contract,
`AGENTS.md` coexistence and air-gap gates are proven. That is the double-port P5-10.8 exists to
prevent. **→ C-3** (delete the sentence, or amend P5-10.8 deliberately).

#### F-3 — Epic 34 never closes the gap 32.4 records as temporary

32.4 AC8 records that until Epic 34, upstream `bmad-sprint-planning` has no Jira routing, no
knowledge-store preflight and no 31.9 gate. It says this is "tracked as Epic 34 Story 34.1/34.3".

- **Jira:** closed by FR273 (`bmad-sprint-planning` is a Jira target) in what will be **34.4**,
  not 34.1/34.3.
- **Preflight and 31.9 gate:** **not closed.** The FR273 Confluence target list (`prd/…/bmad-integration-and-bundling.md:60`)
  is prd, architecture, create-epics-and-stories, ux, product-brief, prfaq, spec, project-context,
  deep-recon, review. It contains no `bmad-sprint-planning`, and no `bmad-build` / `bmad-build-auto`
  (the successors of `bmad-dev-story`, which today carries preflight copies). Today 8 of the 41
  preflight copies live in the three skills 32.4 deletes. Unless P5-10.4's `confluence-read` role is
  applied to them, the "interim" limitation is permanent.
- **The marker:** the guard test "fails if that CHANGELOG entry is removed before an Epic-34
  marker exists". Epic 34 lands in `ma-bmad-extensions`, not in this repo. The first Epic 34
  artefact visible here is `lib/extensions/ma-atlassian/…/targets.yaml`, which arrives in Epic 35.1.
  The marker must be defined in those terms, or the test's lifetime is undefined.

**→ C-4.**

### MEDIUM

#### F-4 — 32.6 has an undeclared dependency on 32.4 and 32.5

32.6 is `Blocked on: 32-3` and sits in Wave 2, parallel with 32.4 and 32.5. But its own Dev Notes
say AC1's zero-hit test "legitimately fails" until 32.4 and 32.5 land. Its AC8 also regenerates the
whole tracked `.agents/skills/` tree (~600 files), and 32.4 AC1/AC2 delete entries from that same
tree and from `MANIFEST.yaml` at the same time. The story cannot reach `done` before its siblings,
and the parallel branches will conflict on `.agents/skills/MANIFEST.yaml`. The sprint-status
comment (`:514`) repeats the incomplete edge. **→ C-5.**

#### F-5 — CI cannot run what 32.7 and 32.9 require

`.github/workflows/` holds only `bundle-drift.yml`, `multi-tool-smoke.yml` and `offline-install.yml`.
**None runs `npm test` and none sets up `uv` or Python** (grep: zero hits). 32.9 AC3 requires the
chain "on Windows and on Linux CI". 32.7 AC1 deliberately makes its test **fail** when `uv` is
absent (the right call under FR277). The moment `npm test` does run in CI, that test fails unless
the job installs `uv`. No story owns creating that job. **→ C-6.**

#### F-6 — FR276's retired-name sweep is partly a hand-written list

FR276 names replacements beyond its explicit retired list: `bmad-document-project` →
`bmad-project-context`, `bmad-quick-dev` / `bmad-dev-auto` → `bmad-build*`,
`bmad-checkpoint-preview` → `bmad-walkthrough`, and the review/editorial family → `bmad-review`.
32.6 AC1 guards (a) its hand list and (b) whatever is under `v6-shims/` at test time. A name that
upstream **deleted outright** rather than shimmed escapes both. Exposure today is small: `git grep`
outside history finds 0 hits for `bmad-document-project` and `bmad-editorial-review-*`, and the
`bmad-review-*` and `bmad-qa-generate-e2e-tests` hits are all in `bmad-dev-epic` (owned by 32.5).
Still, the guard should be derived, not typed: catalog(6.10.0) − non-shim catalog(6.12.4).
**→ C-2(i)**, which 32.6 AC1 then consumes.

#### F-7 — Four Wave 2–3 stories rest on `node_modules/bmad-method/src/` without checking it ships

The outside authority for 32.4 AC3, 32.5 AC1, 32.6 AC1/AC2 and 32.7 AC1/AC6 is the **vendored npm
package's `src/` tree**, including `src/bmm-skills/v6-shims/`. The proposal and the impact analysis
verified the **git tree at the tag**. Nothing confirms that the npm tarball carries `src/**` and
`v6-shims/` in that layout (the worktree has no `node_modules` today). If it does not, four test
designs need another authority. **→ C-2(h)**, a one-line `ls` in 32.1.

#### F-8 — 32.5 cannot fix its mapping without the `bmad-build-auto` contract

32.5 AC3 maps "spec + implementation of one story" to `bmad-build-auto`, with the fix loop
re-invoking it. 32.1 AC9 records skill directories, lens names, `customize.toml` keys and markers.
It does **not** record how `bmad-build-auto` takes a story (story key? spec path? `sprint-status.yaml`
lookup?), what it writes, or whether it mutates `sprint-status.yaml`. That mutation is the same
schema risk as F-1, reached by a second writer. **→ C-2(g).**

#### F-9 — 32.2's user-story benefit contradicts the requirements

32.2 *"so that … an air-gapped install fails at install-prep time, not at first skill activation"*
(`32-2…md:13`). NFR74 clause 1 still holds ("a uv-missing install must still succeed"). 32.9
AC7(b) states the opposite outcome: "without it the install succeeds and `bmad-build` halts at
activation". No 32.2 AC makes install-prep fail. Separately, 32.2's Context and T9 say NFR59 "still
carries the old (c) clause without an annotation". Commit `9a47df6` already annotated it
(`bmad-platform-currency.md:152`). **→ C-7.**

### LOW

- **F-10 — Engines bump has no FR (C-8).** 32.3 AC2 moves `engines.node` from `>=16.0.0` to
  `>=20.12.0`. The only source is proposal §2 Technical impact ("Node ≥ 20.12 (upstream engines)").
  FR275/FR277 state `uv` + Python, not Node. 32.9 AC6 uses this as the first MAJOR argument, so it
  should be a requirement, not a story detail.
- **F-11 — Semver pre-decided in one place (C-9).** `sprint-status.yaml:517` says "semver (MINOR
  argued, PO decides)", but 32.9 AC6 is deliberately neutral. `sprint-status.yaml:520` and
  `epics.md` Epic 35 Wave 3 hard-code 4.0.0, which becomes 5.0.0 if 32.9 picks MAJOR.
- **F-12 — 32.4 AC6 re-pins counts from the walk.** "The walk wins" is the shape behind this repo's
  tautology history (`31-16…md:57`: six tautological tests). It is mitigated, because the expected
  arithmetic (41→33, 9→6, 46→38, 30→25) is stated in advance and any discrepancy must be explained.
  Better: assert `old − removed_by_this_story = new`, with `removed` counted from the deleted dirs
  in git, not re-typed.
- **F-13 — 32.4 ownership heuristic.** The Dev Notes suggest deleting a tool-dir copy "only if it
  is ma-agents'" by `.ma-agents.json` or `skill.json`. The 31-16 finding (`sprint-status.yaml:501`)
  is that manifests **under-record**: manifest-listed ⇒ ours, but not the converse. 32.4 AC4 should
  cite that rule so the upgrade path errs toward preserving.
- **F-14 — 32.8 simulation (C-10).** AC preamble allows simulating upstream's writer if it is
  LLM-driven. That is the one route to a tautological test in the epic: an imitation written by
  the same author who writes the assertions.
- **F-15 — 32.1 STOP has no route.** A STOP "records the strategy change needed" but names no owner.
  Precedent (31.1) routed via the PM. Add one line: STOP → `bmad-correct-course` (PM + Architect).
- **F-16 — Impact-analysis M6 (`llms.txt`).** No story covers it, and none needs to: `git grep llms`
  over `lib/`, `skills/`, `bin/` and `README.md` returns 0 hits. Recorded as confirmed no-op.
- **F-17 — Interim duplicate-leaf state.** If 32.1 AC7 shows an abort on duplicate leaf names,
  32.3 (pin bump) cannot install green until 32.4 lands, yet 32.4 is blocked on 32.3. 32.3 AC10
  already allows "blocked-on-32.4" and 32.4's Dev Notes re-run it, so this is owned. 32.1 AC10's
  change set should still say explicitly that 32.3 + 32.4 then merge to the epic branch together.

### Consistency nits (housekeeping, non-blocking, PM/Architect)

1. **`prd.md` Totals are stale.** `prd.md:38-45` still says 266 FR lines / high-water FR267 /
   83 NFRs / 26 capability areas, dated 2026-08-03. `prd.md:56` says high-water is now FR278 /
   NFR85. Recomputed: **277 FR definition lines, 276 distinct, 275 live + 1 retired (FR266); 85
   NFRs; 28 capability areas**. The register rows are correct (bundling 29 = 5+3+3+5+6+7; currency
   56 = 10+4+17+8+13+4). `vision-and-system-context` "all 25 capability areas" is also stale.
2. **Proposal ID ranges.** The line-9 note correctly says the final IDs are FR268–FR274 + FR275–FR278.
   But §4.3's register draft and §5's PM row still say "FR268–FR273", and §4.2 places FR271 in the
   currency shard (it was applied to the bundling shard, F28). §6's last line says sprint-status
   registration "follows approval, not this PR", which contradicts line 9 ("Applied … `sprint-status.yaml`
   registration").
3. **`sprint-status.yaml`.** `last_updated` (`:37`) still says "no stories authored yet", while
   `:508` says they were authored. `14-2-confluence-mcp-integration` (`:202`) is still `backlog #
   DEFERRED`, while `epics.md:1784` says **CLOSED 2026-10-31**. Set it to `cancelled` with a
   superseded-by comment. `32-2` / `32-3` are `ready-for-dev` while blocked on `32-1`. That is
   tolerable because the story headers say "do NOT start", but `backlog` until the verdict would
   stop `my-next-issue` from offering them.
4. **Architecture.** The register (`architecture.md`: 24 decisions, next free P5-11; the P5-10 row
   covers FR268–FR278, NFR84–NFR85) is correct. `architecture/decisions/bmad-platform-currency.md:7`
   still reads "P5-8 (v6.10.0, current)", and P5-6 (`:48`) carries no "(c) reversed by P5-10.6"
   pointer. Readers of the currency decision file never reach P5-10.
5. **FR274** says "FR239–FR243 retired", yet FR239–FR243 (`bmad-platform-currency.md:44-48`) carry
   no annotation. Annotate them "to be retired by Epic 35 (FR274)".
6. **Epic 32 Wave 1 text** has 32.2 "supersede FR213/NFR74/NFR59c". Those PRD edits were applied
   by the planning PR, and 32.2 rightly puts PRD edits out of scope. Reword it as "implement".

---

## Confirmations (checks that passed)

- **Latest-only / no shims (P5-10.5) is enforced from three sides:** 32.1 AC3 (installed set ∩
  `v6-shims/` = ∅ on a real install), 32.3 AC7 (`--shims` absent from every `buildBmadArgs`
  combination and from the `lib/` and `bin/` source), 32.9 AC1(e) (no shim skill present in any
  installed tool dir, offline). 32.1's Out-of-scope forbids re-arguing it.
- **`uv` prerequisite (P5-10.6) is tested, not just documented:** 32.2 AC1 inverts the guard,
  bound to real files, with non-empty plus membership assertions; AC2 keeps installer JS free of
  `uv` *execution* with paired fixtures; 32.9 AC1(d)/(f) adds a positive and a **negative**
  pre-seed run. The `uv-transition-resilience` guard is inverted, not deleted, as P5-10.6 requires.
- **`bmad-dev-epic` retained (P5-10.7):** 32.5 AC5 lists every retained capability. Out-of-scope
  excludes `bmad-loop` (FR235).
- **No Epic 33–35 work leaks in.** Every story's Out-of-scope names the later epic it defers to
  (32.4: no overlay or adapter; 32.6: no six-package doc rewrite; 32.8: no `ma-standards-setup`;
  32.9: no extension repo).
- **32.3 fixes the builder.** The impact analysis's tag-pinning risk is owned by 32.3 AC3: clone
  the registry pin tag, take the latest **stable tag** for unpinned `bmb`, and check through an
  independent `js-yaml` read. AC4 then verifies the cloned module's own on-disk version.
- **The upstream delta is fully absorbed:** B1 (already fixed in 3.18.1, re-checked by 32.1 AC2);
  B2 → 32.1 AC4, 32.2; B3 → 32.4, 32.5; B4 → 32.1 AC3, 32.3 AC7; M1 → 32.8; M2 → 32.7 Dev Notes
  (`persistent_facts`) and 32.8 Out-of-scope; M4 → 32.1 AC5; M5 → 32.7; M6a → 32.7 AC5; M6b
  → no-op (F-16); §9 Q4 → 32.1 AC8; Q5 → 32.1 AC6; Q6 → 32.6 (Paige retired, no replacement).
- **Dependency graph:** every Blocked-on line matches its `sprint-status.yaml` comment word for
  word, and matches the `epics.md` wave list, except the C-5 edge.

---

## Matrix 1 — Requirement → Story traceability

| Req | Summary | Stories | Anchor ACs |
|---|---|---|---|
| FR271 (F28) | One qualified bmad-method version; never `v6-shims/`; shadows removed | 32.1, 32.3, 32.4, 32.9 | 32.1 AC3; 32.3 AC7; 32.4 AC1–AC3; 32.9 AC1(e), AC2 |
| FR275 | Pin 6.12.4 in one hop; cache at tea v1.27.2 / cis v0.3.2 / bmb; offline re-verified; confirmation gate | 32.1, 32.3, 32.9 | 32.1 AC1–AC6; 32.3 AC1, AC3–AC6, AC8, AC10; 32.9 AC1 |
| FR276 | Adopt the 6.12 catalog; delete 3 shadows; rewrite dev-epic; sweep retired names (incl. training) | 32.4, 32.5, 32.6 | 32.4 AC1–AC5; 32.5 AC1–AC4; 32.6 AC1–AC4, AC6–AC8 — ⚠️ F-6 |
| FR277 | `uv` + Py ≥ 3.11 prerequisite; owned guidance `uv run`; installer JS interpreter-free | 32.1, 32.2, 32.5, 32.9 | 32.1 AC4; 32.2 AC1–AC3, AC5, AC7; 32.5 AC7; 32.9 AC1(d)(f) |
| FR278 | Owned TOML parses, no undefined vars, explicit `persistent_facts`, `{diff_file}`; `AGENTS.md` two-writer test | 32.7, 32.8, 32.5 | 32.7 AC1–AC7; 32.8 AC1–AC8; 32.5 AC6 |
| FR236 / FR213 | Superseded / inverted (already applied in the PRD) | 32.3 / 32.2 | 32.3 AC1; 32.2 AC1, AC5 |
| NFR59(a)(b), NFR74 cl.1 | uv-missing install still succeeds; exit-status-only decisioning | 32.2 | AC6 |
| NFR2/50/57/58 | Air-gap self-containment, with `uv` in the loop | 32.1, 32.3, 32.9 | 32.1 AC4; 32.3 AC10; 32.9 AC1 |
| NFR52 | Five-tool parity | 32.9 | AC2 |
| NFR73 | Two-sided bundle set equality | 32.3 | AC5 |
| NFR46 / NFR49 | Idempotent marker content; user content preserved | 32.8, 32.4, 32.6 | 32.8 AC3–AC5; 32.4 AC4; 32.6 AC5 |
| NFR84 (unique-leaf clause only) | No duplicate leaf names | 32.1, 32.4 | 32.1 AC7; 32.4 AC3 |

### Reverse direction — ACs without a requirement behind them

| Story / AC | Element | Assessment |
|---|---|---|
| 32.3 AC2 | `engines.node >=20.12.0` | **Orphan.** It is user-visible and breaking, and needs an FR → C-8 |
| 32.6 AC6 (README:45 bundle line) | DS.1 carry-forward N1 | Decision-traced (DS.1); fine |
| 32.8 AC8 | Extends the two-writer check to other injection files | Reasonable widening of FR278; fine |
| 32.7 AC7 | Corrects resolver-behaviour message text | Traced to impact analysis M5; fine |
| 32.9 AC8 / AC9 | Beta publish; retrospective | Process (repo practice); fine |
| 32.1 AC8 | `sprint_plan.py` schema | Traced to the P5-10.5 premise, but not bound to the verdict → F-1 |

---

## Matrix 2 — P5-10 sub-decision → Story alignment

| Sub-decision | Reflected in | Contradicted by | Notes |
|---|---|---|---|
| P5-10.5 latest-only, no shims, shadows deleted | 32.1 AC3; 32.3 AC7; 32.4; 32.5; 32.6 | — | The deletion's premise is unverified at the gate → F-1 / C-1 |
| P5-10.6 `uv` + Py 3.11 prerequisite; guard inverted | 32.2; 32.7 AC1; 32.9 AC1 | 32.2 "so that" wording (F-9) | No CI provisions `uv` → F-5 |
| P5-10.7 `bmad-dev-epic` retained | 32.5 AC5, Out-of-scope | — | Clean |
| P5-10.8 Epic 32 hard gate | 32.1 header; 32.9 header, AC9, AC10 | **`epics.md:5926`** | → F-2 / C-3 |
| P5-10.1–.4 (packages, monorepo, no deps, overlay) | not in Epic 32 scope | — | Correctly absent; 32.7 validates the `_bmad/custom` channel P5-10.4 relies on |

---

## Look-ahead — are Epics 33–35 adequate scope contracts?

Each epic has a goal, waves, FR coverage, dependencies and an out-of-scope list. All three are
**adequate to be broken into stories after the 32.9 gate**, subject to these items. None blocks Epic 32.

- **Epic 33.** (a) **The coexistence period is undefined.** The npm monolith keeps shipping the
  same skill leaf names while 33.5 tags the extensions, and bmad-method ≥ 6.10 aborts on duplicate
  leaves. The epic should say whether installing both is unsupported and tested, or prevented.
  (b) Proposal §5 assigns an SQA audit (no `bin/cli.js` reference, no shim name, no duplicate
  leaf) before each first tag, but 33.5 does not include it. (c) Initial `module_version` values
  (NFR85) are not stated. (d) C-3.
- **Epic 34.** (a) C-4: the Confluence-read role is missing for `bmad-sprint-planning` and
  `bmad-build*`. (b) Release-2 stories 34.8 (code-review → Jira transition) and 34.9
  (correct-course → Confluence write) are "new capability" (P5-10.8), but **no FR defines their
  behaviour**: FR273 lists the targets, not the transitions or pages. Write FRs before storying
  release 2. (c) FR273's target list is keyed to 6.12.4. Under FR271, an upstream bump before Epic
  34 starts means re-qualifying first; the epic should say so.
- **Epic 35.** Adequate. 35.4's "byte-identical `_bmad/<module>/` trees vs an online
  `--custom-source` install" is a strong outside authority. It depends on C-9 (version number)
  and nit 5 (FR239–FR243 annotation).
- **Process note.** 32.6 retires `bmad-check-implementation-readiness`, the workflow behind this
  report. Per FR276 it is absorbed by upstream `bmad-sprint-planning`. 32.1 AC9 should confirm
  that capability exists so the 33–35 readiness checks have a home.

---

## Recommended order of operations

1. **Now:** discharge **C-1** and **C-2** by editing 32.1 AC8–AC10 and adding one AC to 32.4.
   32.1 can then start. In parallel, the PM takes **C-3**, **C-4** (FR273 decision) and **C-8**.
2. **Before Wave 1:** **C-7** (32.2 text). Fold 32.1's change set into 32.2 and 32.3.
3. **Before Wave 2:** **C-5** (32.6 edges), and 32.4 updated per **C-4**.
4. **Before Wave 3:** **C-6** (CI job with `uv`) and **C-10** (32.8 simulation rule). C-3 must be
   closed by now at the latest.
5. **Before the 32.9 cut:** **C-9** (PO semver decision; Epic 35 renumbered if MAJOR). Then the
   housekeeping nits 1–6.

---

## Conditions discharged 2026-10-31

Planning edits only; no code, test or workflow file changed. Line numbers cited above this section
are as of `9a47df6`; adding FR279 shifted `prd/capabilities/bmad-platform-currency.md` by one line
(NFR59 is now `:153`, FR213 `:62`, NFR74 `:148`).

| # | Status | Where |
|---|---|---|
| C-1 | **DISCHARGED** | `32-1-…md` AC10 records a separate **32.4 GO / HOLD** line from the AC8 schema verdict (`subset`/`divergent` → HOLD until the PO accepts the dropped keys); `32-4-…md` Blocked-on cites the GO line and new **AC11** (`sprint_plan.py generate` round-trip keeps `backlog` / `sprints` and every top-level key) + T8 + mutant; `sprint-status.yaml` `32-4` comment; `epics.md` Wave 0 |
| C-2 | **DISCHARGED** | `32-1-…md` AC9 (g) `bmad-build`/`bmad-build-auto` invocation contract and `sprint-status.yaml` writes, (h) npm-tarball `ls` of `src/**/v6-shims/` + `src/**/scripts/*.py`, (i) catalog(6.10.0) − non-shim catalog(6.12.4); plus the readiness-capability home check. `32-6-…md` AC1 consumes (i) (F-6) |
| C-3 | **DISCHARGED** | `epics.md` "Epics 32–35 — Cross-Epic Notes": overlap clause removed; the 32.9 release gate is the hard gate, no Epic 33 story overlaps any Epic 32 wave (amendment noted in place) |
| C-4 | **DISCHARGED** | FR273 amended (`prd/capabilities/bmad-integration-and-bundling.md:60`, `[AMENDED 2026-10-31 (readiness C-4)]`): `bmad-sprint-planning`, `bmad-build`, `bmad-build-auto` added as Confluence-read targets. `32-4-…md` AC8 cites Epic 34 Stories 34.2/34.3/34.4 and replaces the "Epic-34 marker" with a repo-visible closure condition (entry stays until a release vendors `lib/extensions/ma-atlassian/**/targets.yaml` listing `bmad-sprint-planning` — Epic 35.1). `prd/changelog.md` 2026-10-31 entry extended. *PM to confirm when storying Epic 34 that 34.4's generator binds the three new targets.* |
| C-5 | **DISCHARGED** | Option chosen: **32.6 moves to Wave 3**, `Blocked on: 32-3, 32-4, 32-5`, new T0 + T6 ordering note (`32-6-…md`); `sprint-status.yaml` `32-6` comment; `epics.md` Epic 32 wave list; 32.4/32.5 Wave lines updated to match |
| C-6 | **DISCHARGED** | Option chosen: **CI job owned by 32.9** — new AC11 + T10 (`ubuntu-latest`, pinned `uv`, `uv python install 3.11`, `npm test`; positive + negative runs); AC3 points at it; `32-7-…md` AC1 states its CI half is satisfied by that job and forbids adding `npm test` to a workflow without `uv` |
| C-7 | **DISCHARGED** | `32-2-…md`: "so that" reworded (install still succeeds without `uv`; NFR74 cl.1 / NFR59(a) / 32.9 AC7(b)); Context cites the existing annotations at `bmad-platform-currency.md:62/:148/:153`; T9 deleted; Out-of-scope states install-prep failure is not a goal |
| C-8 | **DISCHARGED** | **FR279** added to F27 (`prd/capabilities/bmad-platform-currency.md:32`); `32-3-…md` FR line + AC2 cite FR279; `prd.md` high-water FR279, F27 span FR275–FR279, currency count 56→57 (register + ID table); `epics.md` Epic 32 FR coverage; 32.9 FR line; `prd/changelog.md` 2026-10-31 entry extended |
| C-9 | **OPEN — owner: Product Owner** (at the 32.9 cut; PM renumbers Epic 35.6 / `epic-35` comment to 5.0.0 if MAJOR) | Pre-decision removed: `sprint-status.yaml` `32-9` comment now reads "semver: MINOR vs MAJOR — PO decides at the cut; Node engines bump (FR279) is the MAJOR argument"; `32-9-…md` AC6 presents both options with equal weight |
| C-10 | **DISCHARGED** | `32-8-…md` AC preamble: any simulated upstream write reads markers and template from the vendored 6.12.4 tree at test time, asserts the source exists and is non-empty; mutant m5 added |

**LOW findings also applied:** F-12 (32.4 AC6 `old − removed = new` from git deletions), F-13 (32.4 AC4 cites the 31-16 under-recording rule), F-15 (32.1 STOP → `bmad-correct-course`), F-17 (32.1 AC10 change set: 32.3 + 32.4 merge together on a duplicate-leaf abort).

**Consistency nits:**

| Nit | Status |
|---|---|
| 1 `prd.md` totals | **Applied** — recomputed 2026-10-31 (fence-aware script): 278 FR lines / 277 distinct / 276 live + FR266 retired; high-water FR279; 85 NFRs; 28 capability areas. **Open (PM):** `vision-and-system-context.md` System Overview lists 26 areas and has no F27/F28 entries — needs authored text; `prd.md` now says so |
| 2 Proposal ID ranges / §6 wording | **Not applied (PM)** — `sprint-change-proposal-2026-10-31.md` is the approved record; correcting it is the PM's call |
| 3 `sprint-status.yaml` | **Applied:** `last_updated` no longer says "no stories authored yet"; `14-2-confluence-mcp-integration` → `cancelled` ("closed as superseded 2026-10-31"). **Not applied (SM):** `32-2`/`32-3` left `ready-for-dev` (report calls it tolerable); `epic-14` left `backlog` although 14.1/14.3/14.4 are done and 14.2 is cancelled |
| 4 Architecture pointers | **Applied** — `architecture/decisions/bmad-platform-currency.md` header no longer calls P5-8 current and points to P5-10.5/.6; P5-6 carries a "(c) reversed by P5-10.6" note |
| 5 FR239–FR243 | **Applied** — each annotated `[TO BE RETIRED by Epic 35 (FR274)]` |
| 6 Epic 32 Wave 1 "supersede" | **Applied** — reworded to "implement the already-applied … supersession" |

Look-ahead items for Epics 33–35 (coexistence period, SQA audit in 33.5, initial `module_version`,
FRs for 34.8/34.9, re-qualification rule) are unchanged and remain with the PM for story authoring.
