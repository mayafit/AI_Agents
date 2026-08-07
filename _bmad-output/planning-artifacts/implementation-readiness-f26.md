# Implementation Readiness Review — F26 / Epic 31

**Scope:** the whole F26 planning chain — `prd.md` index + the two capability shards, Decision
P5-9 (P5-9.1 … P5-9.8 + Deferred), `addendum.md`, `epics.md` Epic 31 (stories 31.1–31.14), and
`implementation-artifacts/sprint-status.yaml`.
**Live requirement set:** FR248–FR265, FR267 (19 FRs) and NFR76–NFR83 (8 NFRs).
FR266 retired at P5-9 before implementation. FR111 → FR254, FR117 → FR263 superseded.
**Reviewed:** 2026-08-02, on branch `feat/knowledge-stores-and-global-install`.
**Method:** mechanical two-direction traceability, sub-decision cross-check, and source
verification of every `bin/cli.js` / `.gitignore` claim the requirements rest on.

---

## Verdict

> ## READY WITH CONDITIONS

The plan is coherent, the coverage is complete in both directions, and the discipline around the
retired FR266 is genuinely airtight. Nothing found here questions the architecture. What was found
is a cluster of **six conditions that must be discharged before the stories they affect start** —
three of them before or during Wave 0/1, and one of them (C-8) before the spine story 31.2, which
the epic currently declares unblocked.

**Conditions, in the order they bite:**

| # | Condition | Must be settled before |
|---|---|---|
| C-8 | State that per-artifact Confluence page identity is **not** stored in `project-layout.yaml` | **31.2 (Wave 0)** |
| C-2 | Specify the two-store → single-valued-config-field mapping | **31.3 (Wave 1)** |
| C-3 | Name which component 31.2 AC8's "resolver" is | **31.2 (Wave 0)** |
| C-6 | Amend P5-9.3's "newer than" to match the content-stamp design | **31.3 (Wave 1)** |
| C-1 | Rebaseline NFR76 / 31.14 AC2 "byte-identical" against a 31.2-landed baseline | **31.11 / 31.14** |
| C-10 | Raise OQ-5 (research-report store ownership) to the PM | **31.6 (Wave 2)** |

None of these is expensive. C-8 and C-3 are one sentence each. **31.1 can start today, unchanged.**

### Counts at a glance

| Measure | Result |
|---|---|
| Live F26 FRs traced to ≥1 story AC | **19 / 19** |
| Live F26 NFRs traced to ≥1 story AC | **8 / 8** |
| Orphaned requirements | **0** |
| FR266 stories / mirror-cache-sync ACs | **0 / 0** — negative confirmed |
| FR111 / FR117 implemented as written | **No** — both correctly superseded |
| P5-9 sub-decisions reflected in ≥1 story | **8 / 8** |
| P5-9 sub-decisions contradicted by a story | **1** (P5-9.3, documentation-only — see F-6) |
| P5-9 Deferred items silently implemented | **0 / 4** |
| Stories carrying an invented requirement | **3** (31.3, 31.5, 31.13) — all disclosed, none covert |
| Unbounded-language instances in ACs | **2** (31.5 AC5, 31.12 AC6) |
| Source claims verified | **9 checked, 7 exact, 2 off-by-one** (see F-11) |
| Open questions blocking implementation start | **1 of 6** (OQ-4, conditionally — see F-8) |

---

## Findings

Ordered by severity. Every finding cites file and line.

### HIGH

#### F-1 — NFR76's "byte-identical install" is unachievable once 31.2 lands, and two ACs assert it anyway

**Evidence.** `bin/cli.js:604-616` — today a default single-repo install writes **no**
`_bmad-output/project-layout.yaml`, and actively deletes any existing one:

```
604: function writeProjectLayoutYaml(layout) {
605:   const layoutPath = path.join(process.cwd(), '_bmad-output', 'project-layout.yaml');
607:   const bothSame = layout.knowledgebase.mode === 'same' && layout.sprintManagement.mode === 'same';
609:   if (bothSame) {
611:     if (fs.existsSync(layoutPath)) {
612:       fs.unlinkSync(layoutPath);
613:       console.log(chalk.blue('  Removed stale project-layout.yaml (now in single-repo mode)'));
615:     return;
616:   }
```

Story 31.2 AC2 makes the file written **unconditionally**. Therefore every default project install
after 31.2 produces one extra tracked file versus the pre-epic baseline.

**Conflict.** Story 31.11 AC4: *"A test compares the full install output tree before and after."*
Story 31.14 AC2: *"install to a byte-identical result versus the pre-epic baseline (modulo the
generation stamp)."* Both fail on `project-layout.yaml`, and the 31.14 AC2 exemption list does not
cover it.

**Why it matters.** 31.11 AC4 is self-described as *"the acceptance criterion most likely to catch
a regression"*. If it is written literally it will fail for a legitimate reason, and the reflex fix
is to weaken it to "equivalent behaviour" — which destroys the only strong backward-compatibility
gate in the epic.

**Condition (C-1).** Restate the baseline, do not weaken the comparison. NFR76's contract is *the
scope question changes nothing* — measure 31.11 AC4 against a **31.2-landed** baseline, not a
pre-epic one. Extend 31.14 AC2's exemption to read *"modulo the generation stamp and the
newly-unconditional `project-layout.yaml`"*. Keep byte-identical everywhere else.

#### F-2 — Story 31.3 does not define how two stores collapse onto the single-valued legacy config fields

**Evidence.** Story 31.3 AC1 requires the generated `config.yaml` to expose *"the same resolved
fields skills read today — `knowledgebase_path`, `sprint_management_path`, `planning_artifacts`,
`implementation_artifacts` — **plus whatever the two-store split resolves them to**"*, and then
asserts *"no `{output_folder}` derivation changes"*.

The mapping is undefined in the PRD (FR264 states the contract only), undefined in P5-9.2, and
literally deferred by AC1's own wording. But the model is now two-valued: `knowledgebase_path` has
no coherent single value when the system-requirements store is a Confluence space and the
software-requirements store is `.`.

**Why it matters.** FR264's and P5-9.2's entire justification is *"39 existing references — 7 skills
read `{project-root}/_bmad/bmm/config.yaml` explicitly and 32 use `{output_folder}` derived from
it"* (`addendum.md`, "Mechanism — generating `config.yaml`"). That claim survives only under a
mapping nobody has written. The two candidate resolutions have opposite consequences:

- **(a)** `knowledgebase_path` is retained pointing at one designated store — then the *other*
  store is invisible to the 32 `{output_folder}` consumers and Story 31.6 AC1/AC2 cannot route.
- **(b)** New per-store fields are added — then workflows **do** change, which is fine (FR264 only
  promises no new config *location*), but 31.3 AC1's "no `{output_folder}` derivation changes"
  becomes false and 31.6's routing-table edit surface grows.

31.3 is a Wave-1 story that blocks 31.4, 31.6 and 31.13. It cannot start on an undefined contract.

**Condition (C-2).** Before 31.3 starts, publish an explicit mapping table — layout record →
generated `config.yaml` field — and record which of (a)/(b) is chosen. This is very likely a P5-9
amendment, not a story-level note, because it determines whether the "39 references unchanged"
claim holds.

#### F-3 — Story 31.2 AC8 and Story 31.6 AC5 directly contradict each other on who may read `project-layout.yaml`

**Evidence.**

- Story 31.2 AC8 (NFR83): *"a resolver given only a project root returns the full topology from the
  committed file with no reference to per-machine install state. **A test proves resolution
  succeeds with `_bmad/` absent entirely.**"*
- Story 31.6 AC5: *"Resolution reads the generated `config.yaml` as it does today (FR264) — **no
  workflow reads `project-layout.yaml` directly**."*
- `.gitignore:20` = `_bmad/` (verified). `config.yaml` lives at `_bmad/bmm/config.yaml`.

With `_bmad/` absent there is no `config.yaml`; and per 31.6 AC5 no workflow may fall back to the
committed file. Both ACs cannot be true of the same component.

**Why it matters.** NFR83 is the requirement that makes global installation coherent at all — the
epic's Value paragraph calls it *"the precondition that makes global installation coherent"*. A dev
who writes 31.2 AC8's test against the wrong surface will either build a workflow-level
`project-layout.yaml` reader (violating P5-9.2's one-way rule in spirit and 31.6 AC5 in letter), or
will write a test that proves nothing.

**Resolution the plan actually intends** (reconstructed, but never stated): 31.2 AC8's "resolver"
is a **ma-agents-internal function** consumed by `ma-agents bind` and `ma-agents status`. A
globally-installed *skill* satisfies NFR83 indirectly — it detects the missing binding and offers
bind (31.11 AC6 → 31.13 AC3), and bind then generates the `config.yaml` the skill reads.

**Condition (C-3).** Say that in 31.2 AC8. One sentence naming the component and stating that
NFR83 is discharged for skills via the bind offer, not via a direct read.

### MEDIUM

#### F-4 — Story 31.5 AC2 is not satisfiable within Story 31.5

**Evidence.** 31.5 AC2: *"A test proves all four backend combinations are reachable."* The four
combinations include `confluence`. But 31.5 AC5 says that until 31.8 lands, selecting `confluence`
is *"either not offered or is offered and records the backend with a … 'configuration pending'
state"* — and 31.8 is **blocked on 31.5** (`epics.md`, Story 31.8 header; `sprint-status.yaml:404`).

The dependency is not circular in delivery, but the AC is unmeetable in the story that owns it.

**Condition (C-4).** Scope 31.5 AC2 to *"the schema and the question flow admit all four
combinations"* (provable against the 31.2 schema and the wizard state machine), and move the live
four-way reachability test into 31.8 as a new AC. Do not delete the check — the independence of the
two stores (FR257, P5-9.5) is exactly the property most likely to be lost in implementation.

#### F-5 — "Configuration pending" (31.5 AC5) is an invented state that conflicts with the 31.2 schema

**Evidence.** Story 31.2 AC1 gives each store record a `backend` of `file-system | confluence`.
Story 31.5 AC3: *"No other backend value is offered."* Story 31.5 AC5 then introduces a
*"configuration pending"* store state that no FR, no P5-9 sub-decision and no schema field defines.

**Assessment.** This is an invented requirement in the sense the review was asked to flag, though a
mild one — it is disclosed in the AC rather than smuggled in, and it exists only to sequence 31.5
ahead of 31.8. It nonetheless would put a third value into a two-value field in a **committed,
team-shared** file, and 31.2 AC6's "no credential-shaped field can be written" test says nothing
about unexpected `backend` values.

**Condition (C-5).** Take AC5's first branch — `confluence` is **not offered** until 31.8 lands —
and delete the second. It costs nothing: both stories ship inside Epic 31 behind the 31.14 gate, so
no released version ever exposes the gap.

#### F-6 — P5-9.3's staleness rule and Stories 31.3 / 31.4 disagree, and the decision was never amended

**Evidence.**

- P5-9.3: *"when a skill activates and `project-layout.yaml` is **newer than** the generated
  `config.yaml`, the skill fails loud"* — an mtime formulation.
- Story 31.3 AC7 writes a *"content-based generation stamp"*; Story 31.4 AC6: *"The drift comparison
  is **content-based, not mtime-based**."*
- OQ-2 records why: *"filesystem mtime ordering is not guaranteed after a `git pull`, a fresh clone,
  or a checkout."*

**Assessment.** The **stories are right and the decision is stale.** OQ-2's reasoning is correct —
a `git pull` can legitimately land the committed file with an older mtime than the generated one,
which would make the mtime rule silently miss real drift (the exact failure P5-9.3 exists to
prevent). This is a documentation defect, not a design one, but it is a documentation defect in the
authoritative architecture record.

**Condition (C-6).** Amend P5-9.3 with a one-line note before 31.3 starts, exactly the way P5-9.8
is pre-written to receive a spike-outcome note. Leaving the decision text saying "newer than" while
the code compares stamps is how a future reader re-litigates a settled question.

*Note also:* the epic says OQ-2 must be settled *"before Story 31.4"*. That is one story too late —
**31.3 AC7 is what writes the stamp.** Settle it before 31.3.

#### F-7 — Story 31.13 is missing a dependency edge on 31.11, and its AC3 duplicates 31.11 AC6

**Evidence.**

- Story 31.11 AC6: *"When a globally-installed skill activates in a project with no
  `_bmad-output/project-layout.yaml`, the bind step is **offered** (the offer is here; the command
  is Story 31.13)."*
- Story 31.13 AC3: *"Bind is also **offered automatically** when a globally-installed skill
  activates in a project that has no `_bmad-output/project-layout.yaml` (FR252)."*
- Story 31.13 is blocked on 31.3, 31.5, 31.8 — **not** on 31.11 (`epics.md` Story 31.13 header;
  `sprint-status.yaml:409`).

Two stories own the same behaviour, and no ordering exists between them. Whichever lands first
leaves a dangling half: an offer with no command, or a command nothing offers.

Story 31.13 AC7 (*"`ma-agents status` reports the active install scope"*) is separately weaker — it
is deliverable without 31.11 because `installScope` already exists in `bin/cli.js` — so the edge is
needed for AC3, not AC7.

**Condition (C-7).** Either (a) rewrite 31.13 AC3 as *"the offer implemented in 31.11 AC6 invokes
this command"* and add 31.11 → 31.13 to the wave graph, or (b) move AC3 wholly into 31.11 and drop
it from 31.13. Option (b) is cleaner and leaves the graph untouched.

*Caveat to record either way:* option (a) pulls 31.13 behind the 31.1 spike in **time** (31.11 is
gated on 31.1), though not in **shape** — 31.11's own technical note establishes it is correct
under either verdict. The epic's "thread D is the only one the spike touches" claim should
acknowledge that.

#### F-8 — OQ-4 conditionally blocks the spine story 31.2, contradicting the epic's own claim

**Evidence.** Epic 31 Open Questions preamble: *"None blocks the gate stories (31.1, 31.2)."*

But OQ-4 itself says a stored page id would be *"a growing per-artifact record **the layout file was
not designed to carry**"* — and Story 31.2 is precisely the story that seals the layout file's
versioned schema (AC1) and pins what a Confluence store may record (AC6: *"the space key and
root-page identity and nothing else"*).

If OQ-4 later resolves to opaque page ids, one of three bad things happens: 31.2's sealed schema
absorbs a per-artifact map it was not designed for; a second undeclared file appears with no FR
behind it; or NFR79's "only the space key and root page identity" is quietly widened.

**Assessment.** This is the one open question that reaches back into Wave 0. It is also the
cheapest to neutralise.

**Condition (C-8).** Before 31.2 starts, state the boundary explicitly: **per-artifact Confluence
page identity is not stored in `project-layout.yaml`.** That single sentence keeps 31.2's schema
sealed and leaves OQ-4 genuinely free to be settled before 31.10 (title vs page id, in whatever
per-store side record 31.10 chooses). With it, OQ-4 stops blocking 31.2 and the epic's claim
becomes true.

#### F-9 — `config.user.yaml` may not exist in this project's config convention; the P5-9.4 protection and its test could both pass vacuously

**Evidence (verified against the reference install `d:\Code\AI_Agents\_bmad\`):**

```
_bmad/config.toml
_bmad/config.user.toml          ← the actual per-developer override surface (TOML, _bmad root)
_bmad/bmm/config.yaml           ← what ma-agents writes and skills read
_bmad/core/config.yaml
_bmad/ma-skills/config.yaml
```

`find _bmad -name "config*.yaml"` returns exactly those three `config.yaml` files. **There is no
`config.user.yaml` anywhere in the tree.** BMAD's own BMB documentation
(`lib/bmad-cache/bmb/docs/explanation/module-configuration.md:59`) describes
`config.user.yaml` at the `_bmad/` **root**, i.e. a different path from `_bmad/bmm/` and, in this
install, superseded by a `.toml` variant.

**Why it matters.** P5-9.4's rule — *"`config.user.yaml` is **never** touched by generation … or
developers lose their only override surface"* — and Story 31.3 AC5 — *"A test writes a
`config.user.yaml`, runs generation, and asserts it is byte-identical afterwards"* — would both
operate on a file this toolchain never writes and no skill reads. The test would pass while
protecting nothing, and the real override file (`_bmad/config.user.toml`) would be unprotected.
Epic 27 Story 27.15 (`27-15-unify-config-path-convention-yaml-vs-toml`, done) exists because this
exact yaml/toml split has already bitten this project once.

**Condition (C-9).** Story 31.3 must first establish which file is genuinely the per-developer
override surface for a current install, and pin **that** file in AC5 — on the evidence above,
`_bmad/config.user.toml`. If both can exist, pin both.

#### F-10 — OQ-5 asks Story 31.6 to make a requirements-level decision

**Evidence.** Story 31.6 AC4 requires the routing table to have *"no unassigned artifact type"* and
says *"where the PRD is silent, the choice is recorded as a story-level decision rather than
invented as a requirement."* OQ-5 records the gap honestly: FR255 assigns brief + PRD, FR256 assigns
architecture + UX + epics, and neither assigns the research outputs (domain, market, technical) that
FR119 nonetheless requires to resolve from configuration.

**Why it matters.** Which store owns research reports decides whether they are published to a
**stakeholder-visible Confluence space** (P5-9.7, Story 31.10 AC6). That is an externally-visible
product decision with an information-disclosure dimension, not an implementation detail. The epic is
right that no FR should be invented; it is wrong to let the implementing story settle it silently.

**Condition (C-10).** Raise OQ-5 to the PM before 31.6 — either as a new FR or as an explicitly
PM-signed story-level decision recorded in the routing table. OQ-5 already offers this path
(*"or raise it to the PM for an FR"*); take it.

### LOW

#### F-11 — Two line citations are off by one, repeated in three documents

Verified in `d:\Code\AI_Agents-knowledge-stores\bin\cli.js`:

| Cited | Cited as | Actual | Status |
|---|---|---|---|
| Step 3.4 comment | 1440 | `1440` — `// Step 3.4: Filter out BMAD agents for global scope…` | ✅ exact |
| Global filter guard | 1441 | `1441` — `if (installScope === 'global') {` | ✅ exact |
| Filter **block span** | `1440-1451` | **`1440-1452`** — 1451 closes the inner `if`, 1452 closes the scope `if` | ⚠️ off by one |
| BMAD-integration guard | `1454` | **`1455`** — 1454 is the comment `// Step 3.5: BMAD-METHOD Integration`; the guard `if (installScope === 'project') {` is 1455 | ⚠️ off by one |

Repeated in `epics.md` Story 31.1 AC4, Story 31.12 AC1, the Epic 31 header note, and
`sprint-status.yaml:397` / `:408`. Not load-bearing — but Story 31.1 AC4 asks the spike to *confirm
these are the only two change sites*, so the spike should record the corrected spans as part of its
evidence rather than copying the citation forward.

#### F-12 — Unbounded language: only two instances, both in ACs

The epic is unusually disciplined here. Every fail-loud AC enumerates exactly what the message must
name — 31.4 AC1 (which store moved, from where to where, run `ma-agents bind`), 31.9 AC3 (four named
items), 31.14 AC5 (store, space, cause, remedy). That is the correct pattern and it is used
consistently. Two exceptions:

1. **Story 31.5 AC5** — *"a **clearly-stated** 'configuration pending' state"*. Subsumed by F-5;
   removing the branch removes the phrase.
2. **Story 31.12 AC6** — *"The message is a **clear, non-alarming** statement of a supported
   configuration — not a warning and not an error."* Untestable as written. **Bindable fix:** assert
   the message contains the three FR250 facts, and assert it is not rendered through
   `chalk.yellow`/`chalk.red` and contains neither the word "warning" nor "error". That is
   mechanically checkable and captures the actual intent.

Two further instances (*"distinguish clearly"* in 31.7's technical notes, *"degrades gracefully"* in
31.12's, quoting the Story 30.5 precedent) are in **Technical notes, not ACs** — acceptable, no
action.

#### F-13 — Story 31.13 is really two stories

`ma-agents bind` (AC1–AC6, FR252) and `ma-agents status` scope + bound-project reporting (AC7–AC8,
FR253) are separate commands, separate FRs, and AC7/AC8 carry the whole of OQ-1. Splitting into
31.13a / 31.13b would let bind ship on the Wave-3 critical path while status reporting waits for
OQ-1 to settle. Sized "Medium" today; realistically Large. Precedent for the split exists in this
epic file (Story 30.6 → 30.6a / 30.6b, `sprint-status.yaml:332`).

The memlog records the deliberate reasoning for folding them (*"status can only list bound projects
if bind writes the machine-level record, so they are one deliverable"*) — that argues for ordering,
not for one story. All other stories are sized sanely; 31.10 is Large and genuinely one thing.

#### F-14 — Documentation drift elsewhere in the chain (non-blocking, listed for the PM)

- `prd.md` Open item **4** — *"`[NOTE FOR PM]` Confluence page structure — which artifact becomes
  which child page under the root page. Deferred to P5-9"* — is now **settled** by P5-9.7 but is
  still listed as open. Open items now read 4 raised / 3 closed, not 4 / 2.
- `addendum.md` ("Mechanism — MCP-conditional Confluence routing") says *"Story 14.2 should be
  reframed against FR254–**FR266**"*. FR266 is retired; `epics.md` Cross-Epic Notes correctly says
  FR254–FR262.
- Epic 20 (SQA Agent) exists in `epics.md:3756` but was never registered in `sprint-status.yaml`.
  Pre-existing, unrelated to F26 — **fixed in this pass**, see "Sprint-status corrections" below.

---

## Confirmations (checks that passed)

These were verified mechanically and are recorded so a later reader does not re-do them.

### The FR266 negative — confirmed clean

Every occurrence of `mirror`, `cache`, `sync` or `conflict resolution` in the Epic 31 range
(`epics.md:5247-5627`) was inspected. There are **12**, and **all 12 are negative or unrelated**:

- Negative/prohibitive (7): the Goal paragraph's *"no mirror, no cache and no sync"*; the FR Coverage
  note; the Out-of-scope bullet; Story 31.9 AC4 (*"There is no mirror, no cache, and therefore no
  sync … A test asserts no local artifact is produced"*); Story 31.9's technical note (*"that is
  FR266, and it is retired"*); Story 31.14 AC7 (the explicit negative traceability check); Story
  31.14's technical note.
- Unrelated (5): *"bundled BMAD cache"* / *"cache-manifest.json"* (31.1 AC7, 31.11 AC5, 31.12 AC2,
  31.12 AC3) and *"Mirroring the source tree"* / *"Mirror the shape of Stories 27.1 and 30.1"* /
  *"Mirrors the Epic 27/29/30 release-gate stories"* — page-tree shape and story-shape precedent.

**No story requires a mirror, cache, sync direction, sync trigger, authority call or conflict
resolution.** FR266 has no story. Story 31.14 AC7 carries a standing negative check on the diff.
This is the single best-executed part of the plan.

### Superseded requirements — correctly handled

- **FR111 → FR254.** Story 31.5 AC1: *"in place of FR111's single knowledgebase question … **FR111
  is superseded, not extended**."* No story implements a single knowledgebase question.
- **FR117 → FR263.** Story 31.2 makes `project-layout.yaml` authoritative and Story 31.3 makes
  `config.yaml` a generated projection. No story writes bindings directly into `config.yaml` from
  install answers. Both supersessions are marked in the PRD shard
  (`prd/capabilities/project-knowledge-and-repository-layout.md:34, :40`).

### P5-9 Deferred list — nothing silently implemented

| Deferred item | Where excluded |
|---|---|
| Per-artifact Confluence page templates; hierarchy beyond P5-9.7's tree mapping | Story 31.10 AC7, explicitly |
| More than two stores | Story 31.2 AC1 — *"exactly three location records … no fourth store"* |
| A store spanning multiple Confluence spaces | Not implemented. Story 31.8 AC6's *"both `confluence` in different spaces"* is **two stores each in one space** — not a violation |
| Any backend beyond `file-system` / `confluence` | Story 31.5 AC3 — *"No other backend value is offered"* |
| Automatic migration of legacy projects | Story 31.7 AC3 — *"offered, never performed unprompted"* |

### No story regenerates config on skill activation (P5-9.3)

Checked specifically, since it is the contradiction the review was asked to hunt. Story 31.3 AC3
fires generation *"on install and `ma-agents bind` only"* and requires *"A test asserts no read path
writes"*. Story 31.4 AC2: *"The skill **does not** regenerate `config.yaml` itself. Read paths never
write."* Story 31.13 AC6 regenerates on bind, which is a sanctioned trigger. **No story regenerates
on activation, lazily, or as a read side-effect.**

### Story 31.2 AC3 — the `fs.unlinkSync` finding is correctly captured

The task asked this be verified against source. It is accurate and the AC handles it fully.

`bin/cli.js:606-616` does not merely *skip* writing `project-layout.yaml` in single-repo mode — it
**deletes an existing one** (`fs.unlinkSync(layoutPath)` at line **612**, logging *"Removed stale
project-layout.yaml (now in single-repo mode)"* at 613). Under FR263 the file is authoritative and
committed, so an installer run by any developer whose answers resolve to same-repo would delete the
team's shared topology record from version control.

Story 31.2 AC3 names the behaviour, names the log line, requires the branch removed, and requires a
regression test to pin it:

> *"**The existing delete-on-single-repo behaviour is removed.** … Under FR263 the file is
> authoritative, so an installer run must never delete it. A regression test pins this."*

**Confirmed correctly captured.** The span cited (606-616) is exact.

### Other source claims — verified

| Claim | Where asserted | Result |
|---|---|---|
| `bin/cli.js:604` is `function writeProjectLayoutYaml(layout) {` | 31.2 tech note | ✅ exact |
| `bin/cli.js:605` is the `project-layout.yaml` path join | P5-9.1, addendum, 31.2 | ✅ exact |
| `bin/cli.js:1441` is `if (installScope === 'global') {`, filtering `category === 'bmad'` and telling the user to re-run without `--global` | FR249, 31.1 tech note, P5-9.8 | ✅ exact — warning text at 1447-1449 |
| `bin/cli.js:2081` routes `case 'status':`; no `bind` command exists | 31.13 tech note | ✅ exact — no `case 'bind':` anywhere |
| `.gitignore:20` is `_bmad/` | P5-9 Context, 31.3 tech note | ✅ exact |
| A partial scope prompt already exists "around line 1420" | 31.11 tech note | ✅ accurate — `Installation scope:` prompt at 1416-1425, choices `Project level / Global / Custom path...` at 1421-1423, guarded at 1415 |
| `collectRepoLayout()`, `readExistingLayout()`, `writeConfigField()`, `toPortablePath()` exist and are extendable | 31.2 / 31.3 / 31.5 tech notes | ✅ — `toPortablePath` at 509, `writeConfigField` at 531, both already used for `knowledgebase_path` (565) and `sprint_management_path` (590) |
| Filter block span / BMAD-integration guard line | 31.1 AC4, 31.12 AC1 | ⚠️ off by one — see F-11 |

### Sequencing — the wave graph is sound

Each of the 14 stories' stated blockers was checked against its ACs.

- **Gate scoping is correct.** 31.1 blocks **only** 31.11 and 31.12. Nothing in 31.2–31.10, 31.13 or
  the non-thread-D half of 31.14 depends on the spike verdict. Story 31.1 AC6 pins this in the spike
  itself (*"A FAIL verdict must not be read as blocking 31.2–31.10"*), and Story 31.12 AC7 pins it on
  the other side. This is the structural claim the review was asked to test hardest, and it holds.
- **The spine is correctly scoped.** Everything that touches the binding record, the generated
  config, the store questions or the routing is behind 31.2. Nothing that needs the spine is missing
  the edge.
- **31.14's blocker list** (31.4, 31.6, 31.7, 31.10, 31.12, 31.13) transitively covers all 13 other
  stories: 31.10 → 31.9 → 31.8 → 31.5 → 31.2; 31.4 → 31.3; 31.12 → 31.11 → 31.1. Correct.
- **Two real defects only:** F-4 (31.5 AC2 needs 31.8) and F-7 (31.13 AC3 needs 31.11). Neither
  breaks the wave structure; both are AC-scoping fixes.

---

## E. Open questions — does each block implementation start?

Explicit verdict per the review brief. "Start" = Wave 0, stories 31.1 and 31.2.

| OQ | Subject | Blocks start? | Verdict |
|---|---|---|---|
| **OQ-1** | Where the bound-projects record lives (FR253) | **No** | Resolve during the epic, in 31.13. Constrained enough already — 31.13 AC8 fixes it as per-machine, outside any project, never authoritative for resolution. Nothing in Wave 0/1 depends on it. |
| **OQ-2** | How `config.yaml` staleness is computed | **No** — but settle **before 31.3**, not before 31.4 | The epic says "confirm before Story 31.4". That is one story too late: **31.3 AC7 is what writes the stamp.** Carries the P5-9.3 amendment, F-6 / C-6. |
| **OQ-3** | Which skills carry the staleness guard (all 39 vs the 7 explicit readers) | **No** | Resolve during the epic, in 31.4. Genuinely a resolution-chain investigation, correctly deferred to the story that does the work. |
| **OQ-4** | How a Confluence page's identity is recorded | **Conditionally YES — blocks 31.2** | The only one that reaches Wave 0. See F-8 / C-8. Unblocked by one sentence: *per-artifact page identity is not stored in `project-layout.yaml`*. Once stated, reverts to "resolve before 31.10". |
| **OQ-5** | Which store owns research reports (domain/market/technical) | **No** — but must not be settled by the story | Blocks 31.6. Needs PM sign-off, not a story-level decision, because it determines stakeholder-visible Confluence publication. See F-10 / C-10. |
| **OQ-6** | Two remote-git stores mean two clones; partial-failure UX | **No** | Genuinely minor. Resolve in 31.5, or accept the sequential single-clone behaviour applied twice, as the OQ itself allows. |

**Net: one of six (OQ-4) blocks a gate story as things stand, and only conditionally.** The epic's
claim that *"None blocks the gate stories (31.1, 31.2)"* is true for 31.1 and false for 31.2 —
correctable with one sentence.

---

## Matrix 1 — Requirement → Story traceability

All 27 live F26 requirements. **Orphans: none.**

| Req | Summary | Stories | Anchor ACs |
|---|---|---|---|
| FR248 | Install scope is a wizard question; `--global` retained | 31.11 | AC1, AC2 |
| FR249 | Global scope installs BMAD modules + agents | 31.12 | AC1 (PASS branch) |
| FR250 | Global install is spike-gated; degradation path | **31.1**, 31.12 | 31.1 AC1–AC7; 31.12 AC5 |
| FR251 | Global install does no project-scoped work | 31.11 | AC3 |
| FR252 | `ma-agents bind` project-bind step | 31.13, 31.11 | 31.13 AC1–AC3; 31.11 AC6 (offer) |
| FR253 | `ma-agents status` reports scope + bound projects | 31.13 | AC7, AC8 |
| FR254 | Two independent store questions (supersedes FR111) | 31.5, 31.13 | 31.5 AC1; 31.13 AC1 |
| FR255 | System requirements store = brief + PRD | 31.5, 31.6, 31.10 | 31.5 AC7; 31.6 AC1; 31.10 AC6 |
| FR256 | Software requirements store = architecture + UX + epics | 31.5, 31.6, 31.10 | 31.5 AC7; 31.6 AC2; 31.10 AC6 |
| FR257 | Per-store backend (`file-system` \| `confluence`) | 31.5, 31.8 | 31.5 AC2, AC3; 31.8 AC6 |
| FR258 | `file-system` backend reuses FR113–FR116 per store | 31.5 | AC4 |
| FR259 | Confluence space question | 31.8 | AC1 |
| FR260 | Confluence root page; blank ⇒ generated, user told | 31.8, 31.10 | 31.8 AC2, AC3; 31.10 AC3 |
| FR261 | Confluence is MCP-conditional per the canonical spec | 31.9 | AC1, AC2 |
| FR262 | Fail loud when Confluence MCP absent | 31.9, 31.14 | 31.9 AC3; 31.14 AC5 |
| FR263 | `project-layout.yaml` authoritative + unconditional | **31.2** | AC1–AC4, AC9 |
| FR264 | `config.yaml` generated from the layout | 31.3, 31.6 | 31.3 AC1–AC4; 31.6 AC5 |
| FR265 | Legacy single-store read + offered migration | 31.2, 31.7 | 31.2 AC5 (read half); 31.7 AC1–AC4 (offer half) |
| FR267 | Story files follow sprint management, not either store | 31.2, 31.6 | 31.2 AC1; 31.6 AC3 |
| **FR266** | ~~Confluence local mirror~~ **RETIRED** | **none — correct** | negative check at 31.14 AC7 |
| NFR76 | Scope question changes nothing for project installs | 31.11, 31.14 | 31.11 AC4; 31.14 AC2 — ⚠️ see F-1 |
| NFR77 | Global install fully air-gapped | 31.1, 31.11, 31.12, 31.14 | 31.1 AC7; 31.11 AC5; 31.12 AC3; 31.14 AC1 |
| NFR78 | Bind is idempotent and non-destructive | 31.13 | AC4, AC5 |
| NFR79 | No Confluence credentials on disk | 31.2, 31.8, 31.14 | 31.2 AC6; 31.8 AC4, AC5; 31.14 AC4 |
| NFR80 | Air-gap posture correctly stated | 31.8, 31.9, 31.14 | 31.8 AC7; 31.9 AC6; 31.14 AC1 |
| NFR81 | `project-layout.yaml` deterministic | 31.2, 31.14 | 31.2 AC7; 31.14 AC3 |
| NFR82 | Two-store split is backward compatible | 31.3, 31.5, 31.6, 31.7, 31.14 | 31.3 AC8; 31.5 AC8; 31.6 AC7; 31.7 AC6; 31.14 AC2 |
| NFR83 | Bindings resolvable by a globally-installed skill | 31.2, 31.12, 31.13, 31.14 | 31.2 AC8 ⚠️ F-3; 31.12 AC7; 31.13 AC8; 31.14 AC6 |

### Reverse direction — story ACs with no requirement behind them

Every AC across all 14 stories was traced back. Three carry content not derivable from an FR, an
NFR or a P5-9 rule. **All three are disclosed in the document rather than smuggled in**, which is
the difference between a recorded mechanism choice and an invented requirement. None is covert.

| Story / AC | Invented element | Assessment |
|---|---|---|
| 31.3 AC7 (+ 31.4 AC6) | Content-based **generation stamp** | Justified mechanism, recorded as OQ-2. Departs from P5-9.3's literal "newer than" — see F-6. The stories are right; the decision needs amending. |
| 31.5 AC5 | **"Configuration pending"** store state | A third value in a two-value schema field, defined nowhere. See F-5. Remove it. |
| 31.13 AC8 (+ AC7) | A per-machine **bound-projects record** | A new persistent artifact with no FR and no P5-9 sub-decision. Reasonable inference from FR253 + NFR83, and correctly fenced (never authoritative, losing it degrades `status` only). Should be recorded as a P5-9 addendum rather than left as a story invention. Tracked as OQ-1. |

Two further items are process artifacts, not requirements, and are fine: Story 31.6 AC6's routing
table (an explicit reviewability device) and the `npm test` green ACs carried by every story.

Separately, Story 31.6 AC4 does not *invent* a requirement but **requires the story to make one** —
see F-10.

---

## Matrix 2 — P5-9 sub-decision → Story alignment

**8 / 8 reflected. 0 contradicted in design. 1 contradicted in documentation (P5-9.3, F-6).**

| Sub-decision | Rule | Reflected in | Contradicted by | Notes |
|---|---|---|---|---|
| **P5-9.1** | `project-layout.yaml` is the single authoritative record; topology read from it and nowhere else | 31.2 AC1, AC2, AC4 | — (but see F-3) | 31.6 AC5's *"no workflow reads `project-layout.yaml` directly"* is reconcilable via P5-9.2's projection model, but the two ACs read as contradictory side by side. Wording, not design. |
| **P5-9.2** | `config.yaml` is generated, one way only | 31.3 AC1, AC2 | — | 31.3 AC2 requires a test that the reverse write does not exist. Good. |
| **P5-9.3** | Generation on install/bind **only**; staleness fails loud; no lazy regeneration | 31.3 AC3; 31.4 AC1–AC3, AC7; 31.13 AC6 | ⚠️ **documentation only** | The "generation on install/bind only" half is honoured exactly — **no story regenerates on activation**. The staleness half: stories use a content stamp where the decision says "newer than". Stories are right, decision is stale. **F-6 / C-6.** |
| **P5-9.4** | `config.yaml` overwritten with notice; `config.user.yaml` **never** touched | 31.3 AC4, AC5; 31.13 AC6 | — | Honoured in intent. ⚠️ The protected filename may not exist in this install — **F-9 / C-9.** |
| **P5-9.5** | Exactly two independent stores; sprint management third; legacy resolves to both; migration offered never forced | 31.2 AC1, AC5; 31.5 AC1, AC2; 31.7 AC3 | — | 31.5 AC2 requires all four combinations reachable — correct intent, unmeetable in 31.5 (**F-4**). |
| **P5-9.6** | Confluence MCP-conditional; fails loud; **no mirror, cache or sync**; no credentials on disk | 31.9 AC1–AC6; 31.8 AC5; 31.10 AC4 | — | **Cleanest sub-decision in the epic.** 31.9 AC4 asserts no local artifact is produced; 31.14 AC7 carries a standing negative diff check; 31.9's technical note pre-rejects the "just this once" fallback by name. |
| **P5-9.7** | One page per artifact, mirroring the source tree | 31.10 AC1, AC2, AC3 | — | AC2 explicitly rejects both alternatives P5-9.7 rejects (flat siblings, single page per store), on the same stated grounds. |
| **P5-9.8** | Spike gates scope, not architecture; a FAIL shrinks only 31.12 | 31.1 AC6; 31.11 tech note; 31.12 AC7 | — | **Verified structurally, not just asserted.** 31.12 is written for both verdicts (ACs 1-4 PASS, ACs 5-6 FAIL, ACs 7-8 either). 31.1 AC6 forbids reading a FAIL as blocking 31.2–31.10. 31.11's technical note establishes it is correct under either verdict. No story outside 31.11/31.12 references the verdict. Correct. |
| **Deferred** (4 items) | — | — | **none** | See "P5-9 Deferred list" above — all four excluded explicitly by an AC or a schema constraint. |

---

## Sprint-status corrections applied (Task 1)

Reconciled `_bmad-output/implementation-artifacts/sprint-status.yaml` against `epics.md`.

**Epic 31 — no drift found.** All 14 story keys present, all statuses match their `epics.md`
headers, all blocked-on lists match the wave graph, `epic-31: backlog` and
`epic-31-retrospective: optional` present. The two-gate structure is represented correctly:
`31-1` and `31-2` both `ready-for-dev`, everything else `backlog`, and the comment block states
that 31.1 gates the global-install thread only while 31.2 is the spine. No sprint assignment was
made — this file has no `sprints` section and prior epics were never sprint-assigned, so the
convention was matched.

**Three corrections made:**

1. **`last_updated` was six weeks stale.** Its value still described the 2026-06-20 Epic 7 closure,
   predating both the Epic 30 closure (2026-07-14) and the Epic 31 registration (2026-08-02) that
   are recorded in the header comments above it. Refreshed.
2. **Epic 20 (SQA Agent — Gadi) was never registered.** Present at `epics.md:3756` with 4 stories,
   absent from `sprint-status.yaml`, and not in either archived-epics list. **Root cause:** its
   story headers use `### Story 20.1 — Title` (em dash) where every other epic uses
   `### Story 20.1: Title` (colon) — the sprint-planning parse pattern keys on the colon.
   Registered as `done`, on this evidence: `lib/bmad-extension/skills/` contains `ma-agent-sqa/`
   (20.1), `sqa-audit/` (20.2) and `sqa-ieee12207/` (20.3); `lib/agents.js:334` registers the
   `_bmad/skills/sqa` skillsDir; and 8 test files reference `sqa` (20.4). Consistent with the
   already-`done` standalone story `rename-sqa-persona-gad-to-gadi`.
3. **Added a pointer comment** under the `epic-31` block referencing this report, so a dev picking
   up 31.1 or 31.2 sees the conditions before starting.

**Reported, not corrected** (both would require editing `epics.md`, which is out of scope):

- The off-by-one citations at `sprint-status.yaml:397` and `:408` match `epics.md` exactly, so they
  are not drift *between* the two files — they are a shared factual error against source. Correcting
  only the yaml would manufacture drift. See F-11.
- Epic 30 is registered in `sprint-status.yaml` but absent from `epics.md` — pre-existing drift the
  Epic 31 author explicitly declined to fix, and unrelated to F26.

---

## Recommended order of operations

1. **Now, before any dev starts:** discharge **C-8** and **C-3** (one sentence each, both in Story
   31.2). Story 31.1 needs nothing and can start immediately in parallel.
2. **Before 31.3 opens:** discharge **C-2** (the config field mapping — likely a P5-9 amendment),
   **C-6** (amend P5-9.3), and **C-9** (identify the real per-developer override file).
3. **Before 31.5 opens:** apply **C-4** and **C-5** (scope AC2, drop the "configuration pending"
   branch).
4. **Before 31.6 opens:** discharge **C-10** (OQ-5 to the PM).
5. **Before 31.11 / 31.14:** apply **C-1** (rebaseline the byte-identical assertions) and **C-7**
   (the 31.11 ↔ 31.13 offer/command edge).
6. **Optional, recommended:** split 31.13 into 31.13a (bind) / 31.13b (status), per **F-13**.
