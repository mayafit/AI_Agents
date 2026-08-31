# Story 31.15: The Publish Trigger — `on_complete` Overrides Make the Five Authoring Skills Publish to a Confluence-Backed Store

Status: ready-for-dev

**Decision inputs:** P5-9.7 (page structure — consumed, not re-derived), P5-9.6 (no mirror, no cache, no sync), P5-9.4 (which override files are the user's).
**FR:** completes **FR255, FR256, FR260** by supplying the trigger Story 31.10 built the protocol for. **Binding authority:** FR264's enumeration sentence. **Related:** FR261/FR262 (Story 31.9's gate), FR257 (store independence), FR267.
**Settled inputs consumed, not re-derived:** OQ-4 (Story 31.8 / 31.10), OQ-5 (Story 31.6 §4), the page-tree protocol and `ma-agents confluence-plan` (Story 31.10).
**Successor to:** Story 31.10 — see §1.

---

## 1. WHY THIS STORY EXISTS — Story 31.10's escalation was wrong, and how

Story 31.10 built the complete page-tree publish protocol and then escalated its own **AC1
(pages are created), AC3 (a blank root page is created here) and AC5 (a re-run updates rather
than duplicates)** as unachievable. Its stated reasoning, recorded verbatim in
`sprint-status.yaml` against `31-10-confluence-page-tree-one-page-per-artifact`:

> None of `bmad-prd`, `bmad-architecture`, `bmad-create-epics-and-stories`, `bmad-ux` or
> `bmad-product-brief` is shipped by this package, and there is no publish command — both
> independently verified.

**Both halves are wrong, and they are wrong in the same way.**

- **"There is no publish command"** is false. `ma-agents confluence-plan` is a shipped command:
  handler `bin/cli.js:5384`, dispatch `bin/cli.js:5702`, help text `bin/cli.js:130`. Its
  companion write-back `ma-agents confluence-record-root-page` is at `bin/cli.js:5546`,
  dispatched at `:5708`. That `executePlan` has no JavaScript caller is **by design and
  documented** at `bin/cli.js:5378-5388` — the Confluence MCP lives in the agent's tool context,
  not in this process, so the command's job is to *state* the plan and the agent's job is to
  *perform* it.
- **"Not shipped by this package"** is true only of *manifest ownership* — `.claude/skills/.ma-agents.json`
  lists 45 skills and none of the five. It is false as a *capability* claim. `bmad-method@6.10.0`
  is a **runtime dependency** (`package.json:35`); the five skills ship inside it at
  `node_modules/bmad-method/src/bmm-skills/2-plan-workflows/` and `.../3-solutioning/`; and they
  land in a user's project because `installBmad()` (`lib/bmad.js:842`) shells out to
  bmad-method's own installer (`lib/bmad.js:375`). ma-agents does not *own* those documents. It
  does control the project they are installed into, and that is all this story needs.

**The scope error, named:** the earlier check looked under `skills/` and
`lib/bmad-extension/skills/`, found nothing, and concluded no trigger *could* exist. It proved a
**location fact** — "these five documents are not in ma-agents' own two skill trees" — and
substituted it for a **capability fact** — "ma-agents cannot cause these five documents to
publish". The first is true; the second does not follow.

**Pages are created today — but only for gated skills.** The Confluence create/update instruction
already ships, byte-identical, in nine copies (Story 31.9's gate, §5). Its Step B2 already reads:

> To write, take the pages in the order it prints and, for each, look its title up in the space:
> **update that page when it is already there and create it when it is not.**
> — `skills/generate-backlog/SKILL.md:142`

Three ma-agents skills carry it (`generate-backlog`, `prioritize-backlog`, `bmad-sprint-planning`).
The five authoring skills carry nothing, so they never reach that instruction. **That is the
entire gap, and it is a trigger gap, not a protocol gap.**

### 1.1 The record this story sets straight

**Story 31.10's AC1, AC3 and AC5 are MET — by this successor story, not "partially met".** The
instruction in `sprint-status.yaml` that *"31.14 MUST record AC1/AC3/AC5 as partially met with
this reason"* was written on the reasoning corrected above and **does not survive it**. Story
31.14's traceability sweep must record AC1/AC3/AC5 as **met by Story 31.15**, and must record the
original escalation as **withdrawn on a scope error** — a location fact proved and substituted for
a capability fact.

Story 31.10's definition in `epics.md` is **not edited** by this story, and neither is its
`sprint-status.yaml` done-record. Completed work stays as history; the correction lives here.

### 1.2 What this also answers

`bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate.md` asks the epic-scope
question directly:

> **How is a knowledge store federated when its only consumers are third-party workflow documents
> the product does not ship?**

It lists four candidate resolutions and chooses none. **This story is a fifth: own the *trigger*
without owning the *document*, through the upstream-sanctioned customization override channel.**
That bug stays OPEN — its FR262 scope question is a PRD decision for a human — but this story
removes its blast radius for the five authoring skills, and Story 31.14's disposition of it must
say so.

---

## 2. THE ENVIRONMENT LIMIT — stated, not papered over

**The `claude.ai Atlassian Rovo` MCP server is unauthorised and cannot be authorised from a
non-interactive session.** Story 31.10 hit the same wall and recorded it in its §1; the same
statement is required here rather than inherited silently.

> **Every claim in this story about what happens when a Confluence MCP is present is
> MOCK-VERIFIED, NOT LIVE.** No page will be created in, updated in, or read from a Confluence
> instance by this story's tests. What is verified live is everything on this side of the
> boundary: that the override files are written, that they resolve through
> `resolve_customization.py` to a non-empty `on_complete`, that their text carries the fail-loud
> and no-mirror obligations, that a user's overrides survive, and that the five shipped invariants
> do not move.

The dev agent MUST restate this limit in its own completion report. Reporting a publish path as
"verified" without this sentence is the defect this epic has repeatedly produced.

---

## 3. Story

As a **team whose system requirements store is Confluence-backed**,
I want the PRD I just finished with `bmad-prd` to actually appear as pages under my store's root
page — created the first time, updated the next time — without my remembering to run anything,
so that the store I configured is the store my artifacts are in, and a Confluence-backed store is
not a setting that quietly does nothing. (Completes FR255, FR256, FR260; consumes FR261/FR262.)

---

## 4. THE MECHANISM — and why this channel

### 4.1 The channel

All five skills carry a **mandatory** customization-resolution step and refuse to begin without it:

- `.claude/skills/bmad-prd/SKILL.md:18` — *"Resolve customization: `uv run {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`."*
- `.claude/skills/bmad-prd/SKILL.md:26` — *"Do not begin the main workflow until all activation steps have been completed."*

The resolver is a three-layer TOML merge (`_bmad/scripts/resolve_customization.py:5-8`):
skill default `customize.toml` → `_bmad/custom/<skill>.toml` (team) → `_bmad/custom/<skill>.user.toml`
(personal). Every one of the five exposes `on_complete`, documented as *"Executed when the workflow
completes"* (`.claude/skills/bmad-prd/customize.toml:36-39`), and every one of the five runs it as
a terminal step:

| Skill | `on_complete` in `customize.toml` | Consumed at |
| --- | --- | --- |
| `bmad-prd` | `:39` | `SKILL.md:92` (Finalize step 8) |
| `bmad-architecture` | `:38` | `SKILL.md:77` (Finalize step 8) |
| `bmad-create-epics-and-stories` | `:41` | `steps/step-04-final-validation.md:141-143` |
| `bmad-ux` | `:22` | `SKILL.md:90` |
| `bmad-product-brief` | `:39` | `SKILL.md:91` (Finalize step 5) |

**No override file exists for any of the five today** — `_bmad/custom/` holds only `.gitignore`,
`config.toml` and `config.user.toml`.

### 4.2 Why `on_complete` and not `external_handoffs`

`external_handoffs` looks like the purpose-built field, and its shipped example is literally this
use case (`.claude/skills/bmad-prd/customize.toml:123`: *"After finalize, upload prd.md and
addendum.md to Confluence via corp:confluence_upload …"*). It is nonetheless the **wrong** channel
here, for two reasons that must be recorded in the story rather than rediscovered:

1. **It does not exist in `bmad-create-epics-and-stories`** (verified: zero occurrences anywhere
   in that skill's tree). Using it would mean two channels for five skills — the "second bespoke
   mechanism" FR261 exists to prevent.
2. **Its documented failure semantics contradict FR262.** `bmad-product-brief/SKILL.md:89`:
   *"If a named tool is unavailable, skip that handoff and flag it; local files always exist
   regardless."* That is skip-and-flag. FR262 requires **fail loud, no degradation**. Writing an
   FR262 obligation into a field whose contract is skip-and-flag is how a publish gets silently
   skipped.

`on_complete` carries no such contract, exists in all five, and is the last thing each workflow
does. **It is the right channel.** Its two real weaknesses are pinned by AC5 and AC7 below and
must not be waved past.

### 4.3 Where the file is written, and by what

`_bmad/custom/<skill>.toml` — the **team** layer. Never `<skill>.user.toml`, which is the personal
layer, is gitignored by `_bmad/custom/.gitignore:1`, and belongs to the user by the same rule that
already protects `config.user.toml` (`bin/cli.js:1006-1008`, `bin/cli.js:4854-4856`, P5-9.4).

The write is a **second output of the existing one-way generation pass**, not a new pipeline.
`generateBmmConfig` (`bin/cli.js:1029`) already derives `_bmad/bmm/config.yaml` from the committed
binding at exactly three sites — install (`bin/cli.js:4252`), `reconfigure-layout`
(`bin/cli.js:4690`) and `bind` (`bin/cli.js:4994`). A sibling generator called at the same three
sites cannot go stale relative to `config.yaml`, which removes an entire drift class **without**
extending Story 31.4's guard scope (and without touching
`bug-oq3-guard-scope-misses-skills-that-write-from-nested-prompt-files.md`).

**Install-time gating, not runtime gating.** The hook is written only for a store whose backend is
`confluence` at generation time, and **removed** when the backend changes away. Runtime
self-gating — writing the hook unconditionally and letting `confluence-plan`'s own gateway check
(`bin/cli.js:5424-5431`) decide — was considered and **rejected**: on a `file-system` store it
would print a message, and Step B1 is explicit that *"a file-system project gets no message from
this section, no prompt, and no offer"* (`skills/generate-backlog/SKILL.md:139`). Recording the
rejected alternative here so it is not re-proposed.

### 4.4 The two hazards this design must survive

**Hazard A — TOML has no duplicate keys, and the resolver swallows a parse failure.** If ma-agents
emits `on_complete` inside its marker block while a user has already written `on_complete`
elsewhere in the same file, the file is invalid TOML. `load_toml` treats a non-required layer's
`TOMLDecodeError` as a **warning**, returns `{}`, and **silently discards the entire team layer**
(`_bmad/scripts/resolve_customization.py:84-89`). Both the user's customization and ma-agents'
publish hook vanish, with nothing on the skill's path to notice. AC4 exists for this.

**Hazard B — a scalar override wins outright.** `deep_merge`'s final line is `return override`
(`_bmad/scripts/resolve_customization.py:168`): array + array appends, but **anything else is
replaced**. ma-agents' own `customize.toml` already states the consequence — *"All keys below are
scalars, so a team/user override TOML replaces them by the normal scalar-override merge rule"*
(`lib/bmad-extension/skills/bmad-dev-epic/customize.toml:24-26`). Therefore the hook MUST be
emitted as a **TOML array**, which the field explicitly supports (*"Accepts either a string scalar
(single instruction) or an array of instructions executed in order"* —
`.claude/skills/bmad-prd/customize.toml:36-38`), so that a user array override **appends** and both
run. The residual — a user who writes a scalar `on_complete` in `.user.toml` still replaces the
hook — is **irreducible in this merge model** and must be disclosed, not hidden (AC7).

### 4.5 What the hook text may NOT be

The hook must **not** restate Story 31.9's gate block. That block is pinned at nine byte-identical
copies with one sha256 (§5); a tenth copy in a TOML value invites drift and is exactly the kind of
unexplained count move this epic treats as a defect. The hook is a **short directive that routes to
the shipped protocol** by naming `ma-agents confluence-plan --store <store>` and carrying the
fail-loud obligation — not a second copy of the protocol.

---

## 5. THE THREE PINNED INVARIANTS — must not move, and must be PROVED not to

This story touches **no skill document**, so all three should hold unchanged. They must be
**proved**, not assumed. An unexplained count move is a defect, not a rebaseline.

| # | Invariant | Where it is enforced | Verified value at story-authoring time |
| --- | --- | --- | --- |
| I1 | Story 31.4's preflight: **41 shipped copies, one sha256** | `test/project-layout-staleness-guard.test.js` — `GUARDED` (`:1141`) holds **27** entries (13 under `skills/`, 14 under `lib/bmad-extension/`); the byte-identical sha256 test is `:1207-1218`; the plugin-mirror test `:1220-1230` adds the **14** `lib/bmad-extension-plugin/` copies. 27 + 14 = **41**. | Confirmed |
| I2 | Story 31.9's gate: **9 shipped copies, one sha256** | `test/project-layout-confluence-routing.test.js` — `GATED` (`:102-109`) holds **6** entries; `:1065-1066` asserts exactly `3` per pipeline; the one-sha256 test is `:1069-1079`; the plugin-mirror test `:1081-1092` adds the **3** `lib/bmad-extension-plugin/` copies. 6 + 3 = **9**. | Confirmed |
| I3 | The Epic 31 release-gate suite | **`test/release-gate-epic-31.test.js` DOES NOT EXIST on `feature/epic-31`.** No file under `test/` matches `release`, `gate` or `epic-31`. It is Story 31.14's deliverable and is presumably in flight in `.worktrees/epic-31-story-31.14`. | **Claim not verifiable here** |

**I3 is a live correction, not a nit.** The dev agent MUST NOT assert a "40 passed / 0 failed"
baseline against a file that does not exist on this branch. Re-derive the real baseline at
implementation time, record the actual command and the actual counts, and if the file has since
landed from Story 31.14, state its pass/fail counts **before and after** this story's change.

---

## 6. Acceptance Criteria

Every AC binds to an authority **outside this story's implementation**. This epic has produced six
tautological tests where the expectation came from the same source as the code; each AC below
therefore names the file the oracle must be **built from**, and every skill list, artifact list and
store assignment used by a test MUST be **parsed at test time from that authority**, never
hard-coded in the test and never imported from the implementation module.

---

**AC1 — The five authoring skills acquire a publish trigger, and the five are derived from the PRD.**
After an install or a `bind` on a project with at least one `confluence`-backed store, running
`uv run _bmad/scripts/resolve_customization.py --skill <skill-root> --key workflow.on_complete`
for each of the five skills returns a **non-empty** value naming `ma-agents confluence-plan`.

> **Authority (outside the code): FR264**, `_bmad-output/planning-artifacts/prd/capabilities/project-knowledge-and-repository-layout.md:60` —
> *"Only the workflows FR119 enumerates as producing store-specific artifacts read the new fields —
> **product brief and PRD resolve to the system store, architecture, UX and epics to the software
> store.**"* This sentence, and not any list in the implementation, is the definition of "the five".
> The test MUST derive the skill set by reading that PRD file. A test that hard-codes five names
> passes when the implementation silently drops one; a test built from FR264 does not.
> **Secondary authority:** the skills' own activation contract — `.claude/skills/<skill>/SKILL.md:18`
> and `:26` — which is what makes an override *reach* the workflow at all.

**AC2 — The user's personal override layer is never touched.**
`_bmad/custom/<skill>.user.toml` is never created, opened for writing, or modified, for any of the
five, on any code path. A `.user.toml` pre-seeded before the run is **byte-identical** after it.

> **Authority: `_bmad/scripts/resolve_customization.py:5-8`**, which defines `.user.toml` as the
> *personal* layer, and **`_bmad/custom/.gitignore:1`** (`*.user.toml`), which is the project's own
> statement that this layer is not shared. **Shipped precedent:** the identical never-touch rule
> already documented and enforced for `config.user.toml` at `bin/cli.js:1006-1008` and
> `bin/cli.js:4854-4856` (P5-9.4). This AC does not invent a rule; it extends one the product
> already keeps.

**AC3 — The write is marker-delimited, idempotent, and preserves everything outside its markers.**
ma-agents owns exactly one delimited region of `_bmad/custom/<skill>.toml`. (a) Two consecutive
generations produce a **byte-identical** file — no accumulated blank lines, no reordering.
(b) Content the user wrote outside the markers survives **byte-identical** across a regeneration,
an ma-agents update, and a backend flip. (c) A malformed half-block (BEGIN without END) is treated
as a fresh insert rather than silently corrupting the file further. (d) When the store's backend
ceases to be `confluence`, the block is **removed** and everything else in the file survives.

> **Authority: the shipped marker-merge discipline** — `lib/bmad.js:1259-1260`
> (`ON_PREM_PREFIX_MARKER_BEGIN` / `_END`) and `injectOnPremPrefixBlock` at `lib/bmad.js:1324-1357`,
> whose comments already specify the trailing-newline swallow (a) and the malformed-half-block rule
> (c). The oracle for this AC is that function's documented behaviour, which exists and is tested
> independently of this story. **This is the story's main hazard: a user's hand-written override
> must survive an ma-agents update.**

**AC4 — TOML validity is proven after every write, and a key collision fails loud instead of voiding the layer.**
(a) After every generation, the resulting `_bmad/custom/<skill>.toml` **parses** under `tomllib`.
(b) If an `on_complete` key already exists in that file **outside** ma-agents' markers, the
generator **writes nothing to that file, reports the file and the key by name, and exits non-zero**
— it never emits a second `on_complete`.

> **Authority: `_bmad/scripts/resolve_customization.py:69-89`** (`load_toml`), which on a
> `TOMLDecodeError` for a non-required layer emits `warning:` to stderr and `return {}` —
> **silently discarding the whole team layer**, ma-agents' hook and the user's customizations
> together. The failure mode is the resolver's, not the writer's, which is why the writer must
> prove validity rather than assume it. A test MUST demonstrate the discard on a deliberately
> duplicated key, so the reason for (b) is evidenced rather than asserted.

**AC5 — A publish is never silently skipped, and the "ready" message is corrected when it halts.**
(a) Every path on which the hook does not publish prints a **named reason** — no silent no-op, no
empty `on_complete` standing in for a decision. (b) The hook text instructs the agent to **STOP and
report no publish** when any write does not report success. (c) Because `on_complete` runs **after**
the workflow has already told the user the artifact is ready, the hook text MUST instruct the agent
to **retract or correct that message** on a halt.

> **Authority: FR262**, `…/project-knowledge-and-repository-layout.md:57` — *"skills **fail loud** —
> they do not silently degrade and do not fall back to any local copy."*
> **Plus the shipped terminal sentence of the gate**, `skills/generate-backlog/SKILL.md:142` —
> *"If any write does not report success, STOP, say which page failed, and report no publish."*
> **Plus the ordering fact, which is why (c) exists and is not boilerplate:**
> `.claude/skills/bmad-prd/SKILL.md:91` (step 7 — *"Share artifact paths"*) runs **before**
> `:92` (step 8 — *"Run `{workflow.on_complete}`"*). The same ordering holds at
> `bmad-architecture/SKILL.md:75-77` and `bmad-product-brief/SKILL.md:90-91`. Without (c) this
> story ships the epic's recurring defect — success reported over a failed write — by construction.

**AC6 — Each skill publishes only its own store's artifacts, and the routing oracle is the PRD.**
`bmad-product-brief` and `bmad-prd` publish to the **system** requirements store;
`bmad-architecture`, `bmad-ux` and `bmad-create-epics-and-stories` publish to the **software**
requirements store. A skill whose store is `file-system`-backed gets **no hook at all** and emits
nothing.

> **Authority: FR255** (`:50`, system store *"holds … the product brief and the PRD (including,
> for a sharded PRD, its index and all shards)"*), **FR256** (`:51`, software store *"holds … the
> architecture document, UX designs, and epics"*), **FR264** (`:60`, the per-skill assignment
> sentence), and **FR257** (`:52`, the two stores' independence). Build the oracle from those PRD
> sentences. Story 31.6's round-1 review failed precisely here — its per-row loops asserted
> `dirs[r.store] === dirs[SYSTEM]` after filtering on `r.store === SYSTEM`, i.e. `X === X`, and the
> architecture row could be reassigned to the system store with a green suite. **Do not repeat that
> shape.** Cross-check: the routing table Story 31.6 shipped may be used as a *second* opinion, never
> as the oracle — it is downstream of the same PRD sentences.

**AC7 — The residual merge hazards are disclosed in the story's completion report, not hidden.**
The hook is emitted as a **TOML array**, so a user array override **appends** and both run. The
implementer MUST demonstrate, with a real resolver invocation, (a) that an array `.user.toml`
override appends, and (b) that a **scalar** `.user.toml` override **replaces** the hook and the
publish therefore does not happen — and must state (b) as a **known, irreducible limitation of the
upstream merge model**, with the remedy (write the override as an array).

> **Authority: `_bmad/scripts/resolve_customization.py:152-168`** — `deep_merge`'s array + array
> branch versus its `return override` fallthrough — and the field's own contract at
> `.claude/skills/bmad-prd/customize.toml:36-38` (*"Accepts either a string scalar … or an array of
> instructions executed in order"*). ma-agents has already written this consequence down once, at
> `lib/bmad-extension/skills/bmad-dev-epic/customize.toml:24-26`; this AC requires it be proved, not
> restated.

**AC8 — FR266 stays retired: the hook text carries no mirror, no cache, no sync, no local copy.**
The generated hook text is submitted to the **same adversarial analysis** Story 31.9's suite applies
to the shipped gate, and passes: no instruction to read a Confluence-sourced artifact back to disk,
no cache, no export, no reconcile, no "bring the two into agreement", no fallback to local copies,
and no operation outside the closed catalogue.

> **Authority: FR266 RETIRED**, `…/project-knowledge-and-repository-layout.md:58` — *"**ID retired,
> never reused.**"* — plus **P5-9.6** and `epics.md`'s Epic 31 **Out of scope** first bullet
> (*"If a story in this epic starts describing sync or conflict resolution, it has misread P5-9.6."*).
> **Method authority:** `test/project-layout-confluence-routing.test.js:1635-1680`, which records
> that **four permissive payloads survived in all nine shipped copies — including FR266's mirror
> restored verbatim** — because a markdown heading fell through both checks. Story 31.14's negative
> check has now been defeated by five independent attacks. Reuse that suite's hardened analysis
> against this story's new text; do not write a fresh, weaker one.

**AC9 — The three pinned invariants are proved unchanged, and I3's baseline is re-derived.**
(a) **I1 = 41 copies, one sha256** and (b) **I2 = 9 copies, one sha256** are re-run and reported
with their actual observed numbers. (c) **No file under `skills/`, `lib/bmad-extension/skills/` or
`lib/bmad-extension-plugin/` is modified by this story** — asserted by a path-scoped check over the
diff, not by inspection. (d) For **I3**, the implementer establishes the *actual* Epic 31
release-gate baseline at implementation time and reports the command and counts; if
`test/release-gate-epic-31.test.js` still does not exist, that is what the report says.

> **Authority: the enforcing suites themselves**, which predate this story —
> `test/project-layout-staleness-guard.test.js:1141` (`GUARDED`), `:1207-1218` (one sha256),
> `:1220-1230` (plugin mirror); `test/project-layout-confluence-routing.test.js:102-109` (`GATED`),
> `:1065-1066` (3 + 3), `:1069-1079` (one sha256), `:1081-1092` (plugin mirror). **This epic treats
> an unexplained count move as a defect** — a moved count must be explained and justified, never
> re-pinned to match the new reality. Story 31.6's review found sixteen of seventeen mutation
> survivors died only once the fingerprints could no longer be re-pinned in the same commit.

**AC10 — Story 31.10's escalation is recorded as withdrawn, in the traceability sweep.**
Story 31.14's FR/NFR traceability records Story 31.10's **AC1, AC3 and AC5 as MET by Story 31.15**,
and records the original escalation as **withdrawn on a scope error** — a location fact proved and
substituted for a capability fact. Story 31.10's `epics.md` definition and its `sprint-status.yaml`
done-record are **byte-unchanged**.

> **Authority: the escalation text itself**, in `sprint-status.yaml` against
> `31-10-confluence-page-tree-one-page-per-artifact`, versus the four source facts that contradict
> it: `package.json:35`, `node_modules/bmad-method/src/bmm-skills/2-plan-workflows/`,
> `bin/cli.js:5384` / `:5546` / `:5702` / `:5708`, and `bin/cli.js:5378-5388`. **Plus the BMAD
> standing rule** that post-implementation corrections get a new story and completed stories stay as
> history — which is why the correction is recorded here and 31.10 is not edited.

**AC11 — Full `npm test` green on Linux/CI and Windows.**
New tests cover AC1–AC9. Per the standing Epic 31 note, run every touched test file **directly** as
well as through `npm test` — the chained script halts on the known MIL-498 CRLF drift at position 13
and can mask downstream breakage (the Story 30.4 / 30.8 precedent).

> **Authority: `epics.md`** Story 31.14 Technical notes, third bullet.

---

## 7. Tasks / Subtasks

### Task 1 — The generator (AC1, AC3, AC4, AC6)
- [ ] 1.1 Add a sibling to `generateBmmConfig` (`bin/cli.js:1029`) that derives, per store, the set of skills that publish to it. Derive the skill→store assignment from a single named constant whose comment cites **FR264 `:60`**; the test builds its oracle from the PRD file itself, so the constant and the test cannot agree by construction.
- [ ] 1.2 Marker-delimited block writer for TOML, mirroring `injectOnPremPrefixBlock` (`lib/bmad.js:1324-1357`) exactly in discipline: fresh insert, in-place replace, trailing-newline swallow, malformed-half-block → fresh insert. Comment markers (`# BEGIN:ma-agents-confluence-publish` / `# END:...`).
- [ ] 1.3 Pre-write collision check: refuse loudly if `on_complete` exists outside the markers (AC4b). Post-write parse check under `tomllib` (AC4a).
- [ ] 1.4 Removal path: backend flips away from `confluence` → block removed, rest of file untouched (AC3d).
- [ ] 1.5 Call it from the same three sites as `generateBmmConfig`: `bin/cli.js:4252`, `:4690`, `:4994`. Do not add a fourth.

### Task 2 — The hook text (AC5, AC8)
- [ ] 2.1 Emit as a **TOML array of one instruction** (AC7). Short: name `ma-agents confluence-plan --store <store>`, obey the printed operations parents-first, update-if-present / create-if-absent, `ma-agents confluence-record-root-page` when the root page was created, STOP and report no publish on any failed write, and **correct the already-emitted "ready" message on a halt** (AC5c).
- [ ] 2.2 **Do not restate Story 31.9's gate block.** Route to the shipped protocol; do not become a tenth copy (§4.5).
- [ ] 2.3 Run the text through the hardened FR266 analysis before committing it (AC8).

### Task 3 — Tests (AC1–AC9)
- [ ] 3.1 Oracle built by **parsing the PRD shard** for FR255/FR256/FR264 — the skill set and the skill→store map both. Assert the oracle is non-empty and names five skills, so a parse failure fails the suite instead of vacuously passing it.
- [ ] 3.2 End-to-end through the **real** `resolve_customization.py` (not a re-implementation of the merge): confluence store → non-empty `on_complete`; file-system store → no hook; array `.user.toml` appends; scalar `.user.toml` replaces (AC7, recorded as a limitation).
- [ ] 3.3 Idempotence, user-content survival, half-block, removal (AC3). Pre-seeded `.user.toml` byte-identical (AC2).
- [ ] 3.4 Duplicate-key collision: refusal (AC4b) **and** a demonstration that without the refusal `load_toml` discards the whole layer (AC4a rationale).
- [ ] 3.5 Invariant proof: re-run I1 and I2, report actual numbers; path-scoped diff check that no skill document changed (AC9c).
- [ ] 3.6 Append new test files to the `package.json` test chain; run each directly **and** via `npm test`, on Windows and Linux.

### Task 4 — Record-keeping (AC10)
- [ ] 4.1 Completion report states the **mock-only** limit verbatim (§2) and the AC7 residual.
- [ ] 4.2 Hand Story 31.14 the AC10 wording. Do **not** edit Story 31.10's `epics.md` definition or its `sprint-status.yaml` done-record.
- [ ] 4.3 Note in `bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate.md`'s disposition that its blast radius is closed for the five authoring skills; leave its FR262-scope question OPEN for a human (§1.2).

---

## 8. Dev Notes

### Verified at source while authoring (do not re-litigate; do re-verify if surprised)
- `bmad-method` is a runtime dependency — `package.json:35` (`"bmad-method": "6.10.0"`).
- The five skills exist upstream at `node_modules/bmad-method/src/bmm-skills/2-plan-workflows/` (`bmad-prd`, `bmad-ux`) and `.../3-solutioning/` (`bmad-architecture`, `bmad-create-epics-and-stories`); `bmad-product-brief` is installed and present at `.claude/skills/bmad-product-brief/`.
- ma-agents causes their installation via `installBmad()` (`lib/bmad.js:842`) → bmad-method's CLI (`lib/bmad.js:375`). It does **not** list them in `.claude/skills/.ma-agents.json` (45 skills, none of the five). Both facts are true; only the second was used by the 31.10 escalation.
- `ma-agents confluence-plan` handler `bin/cli.js:5384`, dispatch `:5702`, help `:130`; `confluence-record-root-page` handler `:5546`, dispatch `:5708`; the no-JS-caller design note `:5378-5388`.
- Step B2's create/update instruction: `skills/generate-backlog/SKILL.md:136` (heading), `:142` (the sentence). Step B1's silence rule: `:139`.
- `_bmad/custom/` exists and holds only `.gitignore`, `config.toml`, `config.user.toml` — **no override file for any of the five**.
- ma-agents already participates in this convention: `lib/bmad-extension/skills/bmad-dev-epic/customize.toml` ships `on_complete = ""` at `:17`.

### Two facts that complicate the design and must not be glossed
- **`_bmad/` is gitignored** (`.gitignore:20`), so `_bmad/custom/<skill>.toml` is **not** committed in this repository, despite the resolver describing that layer as *"team/org, committed"* (`resolve_customization.py:6`). This is not a blocker — the file is **generated from the committed binding** at the same three sites as `config.yaml`, so every developer derives the same hook from the same `project-layout.yaml` (FR263/FR264). It **is** the reason the hook must be generated rather than hand-maintained, and the reason install-time gating (§4.3) is safe.
- **`_bmad/` is regenerated by the installer** and its own header calls it read-only. Confirm at implementation time whether bmad-method's installer clears `_bmad/custom/` — if it does, AC3(b)'s "user content survives an ma-agents update" must be proved against a **real** install, not a simulated one, and any loss is an upstream fact to report, not to paper over.

### Files expected
```
bin/cli.js                                        (generator + its three call sites)
lib/bmad.js                                       (marker helpers, if shared rather than duplicated)
test/…                                            (new suite; oracle parsed from the PRD shard)
package.json                                      (test chain)
_bmad-output/planning-artifacts/epics.md          (Story 31.15 entry — APPEND only)
_bmad-output/implementation-artifacts/sprint-status.yaml   (31-15 entry + last_updated)
```

### Must NOT be touched
```
skills/**                          lib/bmad-extension/skills/**       lib/bmad-extension-plugin/**
_bmad/custom/*.user.toml           _bmad/config.user.toml
epics.md Story 31.10 definition    sprint-status.yaml 31-10 done-record
_bmad-output/planning-artifacts/prd/**   (this story amends no requirement)
Decision P5-9 and its sub-decisions      (consumed, not amended)
.worktrees/**                            (another agent owns Story 31.14)
```

## 9. Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes

### File List
