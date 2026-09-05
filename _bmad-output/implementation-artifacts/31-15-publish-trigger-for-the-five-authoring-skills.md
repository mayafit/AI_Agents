# Story 31.15: The Publish Trigger — `on_complete` Overrides Make the Five Authoring Skills Publish to a Confluence-Backed Store

Status: review

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

### 4.4 The two MERGE-MODEL hazards this design must survive
(The writer-count hazard is separate and lives in §4.6 R5.)


**Hazard A — TOML has no duplicate keys, and the resolver swallows a parse failure.** If ma-agents
emits `on_complete` inside its marker block while a user has already written `on_complete`
elsewhere in the same file, the file is invalid TOML. `load_toml` treats a non-required layer's
`TOMLDecodeError` as a **warning**, returns `{}`, and **silently discards the entire team layer**
(`_bmad/scripts/resolve_customization.py:84-89`). Both the user's customization and ma-agents'
publish hook vanish, with nothing on the skill's path to notice. AC4 exists for this.
**A third writer reaches this exact end state without ever calling ma-agents' generator, so AC4's
write-side refusal cannot be the whole defence — see §4.6 R5 and AC12.**

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

**Hazard C — the third writer is ACTIVELY INSTRUCTED to produce Hazard B's exact form.**
*(Added in fix round 1 at an independent review's direction. RECORDED, NOT FIXED — it is upstream
text this story may not edit, and no defence in this story's control changes it.)*

AC12(d)'s owner comment tells a customizer to write an **array** so both instructions run. The
upstream skill that customizer is running tells it the opposite, in its own merge-rule table:

> **Scalars** (`icon`, `role`, `*_template`, `on_complete`) — override wins.
> — `node_modules/bmad-method/src/core-skills/bmad-customize/SKILL.md:67`

and again where it names the surgical edits it prefers:

> …or a named scalar already exposed (`*_template`, `on_complete`). Surgical, reliable.
> — the same file, `:55`

So the mitigation in §4.6 R5(d) argues against an instruction the agent has *just been given by its
own skill*, and the form upstream calls "surgical, reliable" is precisely the form that replaces the
publish and stops it happening, at exit 0, with no warning anywhere. This is not a defect in the
block comment and not something a stronger comment fixes: it is a **conflict of instructions between
two packages**, and the only party who can resolve it is upstream.

What this story does about it, since it cannot remove it:

- the residual is **disclosed** (AC7), and demonstrated through the real resolver at test 8.2;
- as of fix round 1 the resulting state is **detected and named on `ma-agents status`**
  (`detectUserLayerScalarOverrides` / `printUserLayerScalarOverrideReport`; tests 10.12–10.14 and
  14.4), so the window between a `bmad-customize` run and someone noticing is no longer silent;
- nothing writes to, and nothing refuses over, the personal layer to achieve that — a refusal would
  be a false rejection blocking an install over a choice the user is entitled to make.

**Open, and owned by a human rather than by this story:** whether to ask upstream to exempt
`on_complete` from its scalar-override guidance, or to expose an append-only field for terminal
instructions.

### 4.5 What the hook text may NOT be

The hook must **not** restate Story 31.9's gate block. That block is pinned at nine byte-identical
copies with one sha256 (§5); a tenth copy in a TOML value invites drift and is exactly the kind of
unexplained count move this epic treats as a defect. The hook is a **short directive that routes to
the shipped protocol** by naming `ma-agents confluence-plan --store <store>` and carrying the
fail-loud obligation — not a second copy of the protocol.

### 4.6 FIVE FACTS ABOUT THE WRITE SURFACE — named here, not discovered in review

Each was verified at source after the story was first written. None of them blocks the design; all
five change what the implementer and the reviewer must check.

**R1 — This story opens ma-agents' FIRST write path into `_bmad/custom/`, directly against an
established never-touch discipline.**
**Every** current ma-agents reference to that directory is a read, a comment, or a **delete**.
`cleanupLegacyArtifacts()` *removes* legacy `.xml` from `_bmad/custom/agents/`
(`lib/bmad.js:3340-3351`; `BMAD_DIR = '_bmad'` at `lib/bmad.js:31`) — and that `path.join(projectRoot,
BMAD_DIR, 'custom', ...)` at `:3341` is the **only** such join in `lib/` or `bin/`. The two other
mentions, `bin/cli.js:1006` and `bin/cli.js:4855`, are comments asserting the **opposite of a
write** — that `_bmad/config.user.toml` and `_bmad/custom/config.user.toml` are never touched
(AC5 / P5-9.4). No `writeFileSync`, `ensureDir` or `outputFile` in either tree targets that
directory.

**So this story does not extend existing behaviour. It opens a new write surface into a directory
this product has only ever read from or cleaned.** The precedent it sits against is real and
narrower than it looks: P5-9.4 is a **sibling-file** rule about `config.user.toml`, not a blanket
"ma-agents does not write under `_bmad/custom/`". This story respects it exactly — it writes
`<skill>.toml` only, never `<skill>.user.toml` (AC2), and never `config.toml` or `config.user.toml`
at all. That distinction is written down here because the blanket reading is the reasonable
default, and a reviewer arriving at the diff from `bin/cli.js:1006` will make it.

**R2 — ma-agents would be writing into a directory whose lifecycle ANOTHER PACKAGE owns.**
`_bmad/custom/` is created by the **vendored bmad-method installer**, not by ma-agents:
`node_modules/bmad-method/tools/installer/core/install-paths.js:24`
(`const customDir = path.join(bmadDir, 'custom')`), with `:31`/`:33` putting it through
`ensureWritableDir` as one of five directories. Its `.gitignore` (`*.user.toml`) is seeded by the
same package (`node_modules/bmad-method/tools/installer/core/installer.js:680-683`), and the
existing `_bmad/custom/config.toml` is a **bmad-method-authored stub**, not an ma-agents artifact.
ma-agents contributes **no path segment and no content** today; it only causes the installer to run
(`installBmad()`, `lib/bmad.js:842` → `lib/bmad.js:375`).

**Consequence to carry:** an upstream change to that installer can move, reinitialise or repopulate
the directory, and ma-agents finds out at the next `bmad-method` pin bump, not at review. The
generator MUST therefore create the directory if absent rather than assume it, and MUST never treat
any file it did not delimit as its own. **Pin-bump discipline:** whoever moves `bmad-method` past
`6.10.0` (`package.json:35`) re-reads `install-paths.js` and `_installSharedScripts` before
accepting the bump.

**R3 — the upstream update path treats the generated hook as USER content, and that cuts both ways.**
On a bmad-method **update** (an existing `_bmad/` is present) the installer diffs the tree against
`files-manifest.csv`; a file with no manifest entry is classified `customFiles`, backed up to
`_bmad-custom-backup-temp/`, and **restored verbatim after the install**
(`node_modules/bmad-method/tools/installer/core/installer.js:588`, `:624-636`, `:509-546`,
`:918-923`). `_bmad/custom/<skill>.toml` has no manifest entry. **AC3(b)'s "user content survives an
ma-agents update" is therefore upheld by upstream — and so, verbatim, is ma-agents' own block.**

That second half is the hazard. `config.yaml` is **explicitly exempted** from this restore
(`installer.js:915-917` — *"Skip config.yaml files - these are regenerated on each install/update"*);
`_bmad/custom/<skill>.toml` is **not**. A stale hook is restored, not regenerated, by the upstream
installer acting alone. Two orderings, and only one of them is ours:

- **Inside `ma-agents install` this is safe.** `installBmad()` runs at `bin/cli.js:4089`/`:4104`;
  the generation pass runs at `bin/cli.js:4252` — **after** the restore, so generation overwrites
  the restored block. The sibling generator must be called from that same site (Task 1.5) and MUST
  NOT be moved ahead of `installBmad`. A reviewer should treat a reordering here as a defect.
- **Outside it, it is not.** A user who runs bmad-method's own installer directly gets the old block
  back with no regeneration. Accepted residual, **disclosed not fixed**; the remedy is
  `ma-agents bind`, already one of the three generation sites.

AC3(b) must be proved against a **real** install — a fresh one **and** an update over an existing
`_bmad/` — not a simulated one.

**R4 — the gitignore/staleness reasoning was re-checked and HOLDS. Recorded so it is not re-opened.**
`_bmad/` is ignored at `.gitignore:20` (`git check-ignore -v _bmad/custom` → `.gitignore:20:_bmad/`;
`git ls-files _bmad` → **0**), and ma-agents writes that same rule into target projects via
`installer.ensureBmadDirIgnored` (`lib/bmad.js:295-308`, patterns `lib/installer.js:436-441`). The
file is untracked and can vanish on a re-install. **It vanishing changes nothing, because it cannot
vanish alone.** `_bmad/custom/<skill>.toml` is untracked in exactly the way `_bmad/bmm/config.yaml`
is untracked, sits under the same ignored root, and is generated at the same three sites from the
same committed binding. A fresh clone has **no `_bmad/` at all** — no config, no `resolve_customization.py`,
and none of the five skills installed to trigger — so there is no window in which a skill runs with a
missing hook that is not equally a window in which it runs with a missing `config.yaml`, which Story
31.4's preflight already fails loud on. `_bmad/` is regenerated **only** when the bmad-method
installer actually runs: not by `npm test`, and not by `npm install` — `package.json`'s `prepare` is
`build-plugin` + `build-atlas`, neither of which mentions `_bmad`. **The hook is never staler than
`config.yaml`; the "generate alongside `config.yaml`" reasoning survives the untracked-file objection.**
The one case this does **not** cover is R3's out-of-band restore — a staleness path `config.yaml` is
exempt from and this file is not. That is why R3 is a separate risk and not a footnote here.

**R5 — there are THREE writers to `_bmad/custom/<skill>.toml`, not two.**
The story's idempotency design assumes ma-agents and a **human**. There is a third: the
`bmad-customize` **skill** instructs an agent to author TOML into exactly this path at runtime —
*"Write. Create `{project-root}/_bmad/custom/` if needed"* (`.claude/skills/bmad-customize/SKILL.md:87`),
scope stated at `:8`, team/user routing at `:77-79`, sparse-override rule at `:71`. **That skill is
not shipped by ma-agents** — no source under `skills/`, `lib/bmad-extension/`,
`lib/bmad-extension-plugin/` or `lib/bmad-cache/`, and absent from `.claude/skills/.ma-agents.json`;
it ships from `node_modules/bmad-method/src/core-skills/bmad-customize/`, i.e. from the same package
as R2's installer. It writes TOML **programmatically and will not know ma-agents' markers**.
Combined with Hazard A this is materially worse than the human case, and it is **AC12**.

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
New tests cover AC1–AC9 and AC12. Per the standing Epic 31 note, run every touched test file
**directly** as well as through `npm test` — the chained script halts on the known MIL-498 CRLF drift
at position 13 and can mask downstream breakage (the Story 30.4 / 30.8 precedent).

> **Authority: `epics.md`** Story 31.14 Technical notes, third bullet.

**AC12 — The three-writer collision is DEMONSTRATED and defended against, not asserted as handled.**
After this story there are **three** writers to `_bmad/custom/<skill>.toml`: (i) the ma-agents
generator this story adds, (ii) a human hand-editing the team layer, (iii) an **agent running the
`bmad-customize` skill**, which authors TOML into exactly this path at runtime and knows nothing of
ma-agents' markers (§4.6 R5). AC3 and AC4 cover (i) and (ii). This AC covers (iii):

(a) A test **reproduces the end state a `bmad-customize` run can leave** — an `on_complete` key
written **outside** ma-agents' markers alongside ma-agents' block — and demonstrates, through the
**real** `resolve_customization.py`, that the duplicate key makes the file invalid TOML, that
`load_toml` emits `warning:` and returns `{}`, and that **the entire team layer — the customizer's
change and the publish hook together — is discarded while the resolver exits ZERO**. The publish
silently disappears and nothing on the skill's path notices. This must be shown, not stated.
(b) The AC4(b) refusal must hold against that end state as an **input**, not only as a state the
generator declined to create: on the next generation over such a file the generator writes nothing,
names the file and the key, and exits non-zero — so the collision surfaces at install/`bind` time.
(c) **A detection path independent of the generator.** A collision introduced by an agent *between*
two generations must be discoverable without re-running the generator: an already-shipped surface
(`ma-agents status` or `ma-agents diag`) reports a `_bmad/custom/<skill>.toml` that does not parse
under `tomllib`, or that carries an `on_complete` outside ma-agents' markers. Without (c) the window
between a `bmad-customize` run and the next install is a window in which the publish is dead and
silent.
(d) The generated block carries an **in-file comment** naming ma-agents as the owner of the
delimited region and directing a customizer to write their own `on_complete` as a **TOML array in
`<skill>.user.toml`** — the one form that appends rather than replaces (AC7). `bmad-customize` shows
its author a diff before writing (*"If the file exists, show a diff. Never silently overwrite … Wait
for explicit yes"*, `.claude/skills/bmad-customize/SKILL.md:85-86`); that comment is the **only**
channel this story has into that human decision, and it is a mitigation, never a guarantee — the
gate is a human's yes, and (a)–(c) must stand without it.

> **Authority: the third writer's own instruction**, `.claude/skills/bmad-customize/SKILL.md:87` —
> *"Write. Create `{project-root}/_bmad/custom/` if needed"* — with its scope at `:8`, its team/user
> routing at `:77-79`, and its sparse-override rule at `:71` (*"only the fields being changed"*),
> which is precisely what produces a bare `on_complete` next to ma-agents' block. **That skill is not
> ma-agents'**: no source under `skills/`, `lib/bmad-extension/`, `lib/bmad-extension-plugin/` or
> `lib/bmad-cache/`, absent from `.claude/skills/.ma-agents.json`, shipped from
> `node_modules/bmad-method/src/core-skills/bmad-customize/`. **Plus the discard mechanism**,
> `_bmad/scripts/resolve_customization.py:84-89`. This AC exists because **AC4's refusal is a
> write-side guard against a read-side failure**, and a writer that never calls ma-agents' generator
> can produce the read-side failure without ever tripping the write-side guard. The result is **this
> epic's signature defect — success reported over a failed write — reached by a route no earlier
> story named**, and it is the one failure mode of this design that is invisible from inside
> ma-agents. Treat an implementation that satisfies (a), (b) and (d) but not (c) as incomplete.

---

## 7. Tasks / Subtasks

### Task 1 — The generator (AC1, AC3, AC4, AC6)
- [x] 1.1 Add a sibling to `generateBmmConfig` (`bin/cli.js:1029`) that derives, per store, the set of skills that publish to it. Derive the skill→store assignment from a single named constant whose comment cites **FR264 `:60`**; the test builds its oracle from the PRD file itself, so the constant and the test cannot agree by construction.
- [x] 1.2 Marker-delimited block writer for TOML, mirroring `injectOnPremPrefixBlock` (`lib/bmad.js:1324-1357`) exactly in discipline: fresh insert, in-place replace, trailing-newline swallow, malformed-half-block → fresh insert. Comment markers (`# BEGIN:ma-agents-confluence-publish` / `# END:...`).
- [x] 1.3 Pre-write collision check: refuse loudly if `on_complete` exists outside the markers (AC4b). Post-write parse check under `tomllib` (AC4a).
- [x] 1.4 Removal path: backend flips away from `confluence` → block removed, rest of file untouched (AC3d).
- [x] 1.5 Call it from the same three sites as `generateBmmConfig`: `bin/cli.js:4252`, `:4690`, `:4994`. Do not add a fourth. **Ordering is load-bearing (§4.6 R3):** `:4252` runs *after* `installBmad()` (`:4089`/`:4104`), which is what lets generation overwrite a block the bmad-method installer restored from its pre-update backup. Do not move it earlier.
- [x] 1.6 Create `_bmad/custom/` if absent rather than assuming it — another package owns that directory's lifecycle (§4.6 R2).
- [x] 1.7 Detection surface for AC12(c): `ma-agents status` / `diag` reports a `_bmad/custom/<skill>.toml` that fails to parse or carries an `on_complete` outside ma-agents' markers. This is the only guard that fires between two generations.

### Task 2 — The hook text (AC5, AC8)
- [x] 2.0 Emit the block with an owner comment naming ma-agents and directing a customizer to write their own `on_complete` as an **array in `<skill>.user.toml`** (AC12d).
- [x] 2.1 Emit as a **TOML array of one instruction** (AC7). Short: name `ma-agents confluence-plan --store <store>`, obey the printed operations parents-first, update-if-present / create-if-absent, `ma-agents confluence-record-root-page` when the root page was created, STOP and report no publish on any failed write, and **correct the already-emitted "ready" message on a halt** (AC5c).
- [x] 2.2 **Do not restate Story 31.9's gate block.** Route to the shipped protocol; do not become a tenth copy (§4.5).
- [x] 2.3 Run the text through the hardened FR266 analysis before committing it (AC8).

### Task 3 — Tests (AC1–AC9)
- [x] 3.1 Oracle built by **parsing the PRD shard** for FR255/FR256/FR264 — the skill set and the skill→store map both. Assert the oracle is non-empty and names five skills, so a parse failure fails the suite instead of vacuously passing it.
- [x] 3.2 End-to-end through the **real** `resolve_customization.py` (not a re-implementation of the merge): confluence store → non-empty `on_complete`; file-system store → no hook; array `.user.toml` appends; scalar `.user.toml` replaces (AC7, recorded as a limitation).
- [x] 3.3 Idempotence, user-content survival, half-block, removal (AC3). Pre-seeded `.user.toml` byte-identical (AC2).
- [x] 3.4 Duplicate-key collision: refusal (AC4b) **and** a demonstration that without the refusal `load_toml` discards the whole layer (AC4a rationale).
- [x] 3.5 Invariant proof: re-run I1 and I2, report actual numbers; path-scoped diff check that no skill document changed (AC9c).
- [x] 3.6 Append new test files to the `package.json` test chain; run each directly **and** via `npm test`, on Windows and Linux.
- [x] 3.7 **Three-writer collision (AC12).** Reproduce the `bmad-customize` end state — a bare `on_complete` outside ma-agents' markers — and prove through the real resolver that the whole team layer is discarded **at exit status 0** (a); prove the generator refuses over that file as an *input* (b); prove the independent detection surface fires on it (c). Do not simulate the resolver.
- [x] 3.8 **Real-install proof for AC3(b) / §4.6 R3.** Both a fresh install and an update over an existing `_bmad/`. Confirm the restore-then-generate ordering actually leaves the freshly generated block, not the restored one.

### Task 4 — Record-keeping (AC10)
- [x] 4.1 Completion report states the **mock-only** limit verbatim (§2) and the AC7 residual.
- [x] 4.2 Hand Story 31.14 the AC10 wording. Do **not** edit Story 31.10's `epics.md` definition or its `sprint-status.yaml` done-record.
- [x] 4.3 Note in `bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate.md`'s disposition that its blast radius is closed for the five authoring skills; leave its FR262-scope question OPEN for a human (§1.2).

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
- **`_bmad/` is regenerated by the installer** and its own header calls it read-only. **This has now been answered — see §4.6 R3.** bmad-method's installer does **not** clear `_bmad/custom/`: on an update it classifies any file absent from `files-manifest.csv` as a `customFile`, backs it up, and restores it verbatim after the install (`node_modules/bmad-method/tools/installer/core/installer.js:588`, `:624-636`, `:509-546`, `:918-923`). The survival claim is upheld upstream. The *new* finding is the inverse hazard: `config.yaml` is exempted from that restore (`installer.js:915-917`) and `_bmad/custom/<skill>.toml` is not, so a **stale** block is restored rather than regenerated by the upstream installer acting alone. Safe inside `ma-agents install` only because generation runs after `installBmad()`. AC3(b) still requires a **real** install, both fresh and update.

### Verified at source during refinement (2026-08-31) — four claims, all four confirmed
- **This story opens ma-agents' first write path into `_bmad/custom/`.** Only join in `lib/`+`bin/`: `lib/bmad.js:3341`/`:3347`, and it is a *delete*. Only other mentions: the never-touch comments `bin/cli.js:1006`, `:4855`. §4.6 R1.
- **The directory is bmad-method's, not ma-agents'.** `node_modules/bmad-method/tools/installer/core/install-paths.js:24`, `:31`, `:33`; the `.gitignore` stub at `installer.js:680-683`; `_bmad/custom/config.toml` is a bmad-method-authored stub. §4.6 R2.
- **A third writer exists:** `.claude/skills/bmad-customize/SKILL.md:87`, not shipped by ma-agents, from `node_modules/bmad-method/src/core-skills/bmad-customize/`. §4.6 R5, AC12.
- **The gitignore/staleness reasoning holds.** `.gitignore:20`; `git ls-files _bmad` → 0; `prepare` = `build-plugin` + `build-atlas`, no `_bmad`. §4.6 R4.

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

Claude Opus 5 (1M context) — `claude-opus-5[1m]`. Implementation only; an independent review follows.
Status set to `review`, never to `done`.

### Debug Log References

Worktree `.worktrees/epic-31-story-31.15`, branch `feature/epic-31-story-31.15`, off `8b86771`.
Four commits: `8b2e640` (generator), `a8f1652` (suite), `712b784` (real-install proof), `c9bfbf3`
(end-to-end AC12c). Not pushed, no PR, nothing published.

### Completion Notes

#### THE ENVIRONMENT LIMIT — stated verbatim, as §2 requires

> **Every claim in this story about what happens when a Confluence MCP is present is
> MOCK-VERIFIED, NOT LIVE.** No page will be created in, updated in, or read from a Confluence
> instance by this story's tests. What is verified live is everything on this side of the
> boundary: that the override files are written, that they resolve through
> `resolve_customization.py` to a non-empty `on_complete`, that their text carries the fail-loud
> and no-mirror obligations, that a user's overrides survive, and that the five shipped invariants
> do not move.

The `claude.ai Atlassian Rovo` MCP server is unauthorised and **cannot be authorised from a
non-interactive session**. Nothing in this story compensates for that and nothing pretends to.

#### AC7's residual, disclosed rather than hidden

The hook is emitted as a **TOML array**, so a user's **array** override in `<skill>.user.toml`
APPENDS and both instructions run — demonstrated through the real resolver (test 8.1: two
elements, the publish first).

**The residual: a user who writes a SCALAR `on_complete` in `<skill>.user.toml` replaces the
publish hook outright, and the publish then does not happen, silently, at exit 0.** Demonstrated
through the real resolver (test 8.2). It is **irreducible in the upstream merge model**:
`deep_merge`'s fallthrough is `return override`, so anything that is not array + array replaces.
That script ships from `bmad-method` and is re-copied on every install, so ma-agents cannot change
it. **The remedy is to write the override as an array**, and the generated block's own comment says
so in the file the customizer is looking at.

#### AC10 — the wording Story 31.14's traceability sweep must record

> Story 31.10's **AC1 (pages are created)**, **AC3 (a blank root page is created)** and **AC5 (a
> re-run updates rather than duplicates)** are **MET BY STORY 31.15**, not "partially met". The
> original escalation is **WITHDRAWN ON A SCOPE ERROR**: it proved a *location* fact — that those
> five documents are not under `skills/` or `lib/bmad-extension/skills/` — and substituted it for a
> *capability* fact — that ma-agents cannot cause them to publish. `ma-agents confluence-plan` is a
> shipped command (`bin/cli.js:5384` / `:5702` / `:130`, with `:5546` and the by-design no-JS-caller
> note at `:5378-5388`), and `bmad-method` is a runtime dependency (`package.json:35`) whose five
> authoring skills reach a project through `installBmad()` (`lib/bmad.js:842` → `:375`).

Story 31.10's `epics.md` definition and its `sprint-status.yaml` done-record are **byte-unchanged**
(asserted by test 11.4).

#### Three things in the story that are wrong

1. **§4.1 / AC1's secondary authority over-states the activation contract.** The story says all five
   skills "carry a **mandatory** customization-resolution step **and refuse to begin without it**".
   Four do. **`bmad-architecture` carries no such sentence** — its `SKILL.md` has an `## On
   Activation` section that resolves customization at step 1, but no "Do not begin the main workflow
   until all activation steps have been completed". It is not a blocker: the load-bearing facts are
   that the skill resolves customization at activation and runs `{workflow.on_complete}` at `:77`,
   and it does both. Test 1.10 pins the exception as a named set so a second skill joining it fails.
2. **The `on_complete` consumption shape is not uniform.** `bmad-create-epics-and-stories` does not
   interpolate `{workflow.on_complete}` at all; it resolves the key **by name** in
   `steps/step-04-final-validation.md:141-143`. A search for the braced form, or a search restricted
   to `SKILL.md`, finds four of five. §4.1's table is right about the location; a reviewer checking
   it with a substring search will get the wrong answer.
3. **§5 / I3's "the release gate does not exist" is out of date.** `test/release-gate-epic-31.test.js`
   **does** exist on this branch and its baseline is **43 passed / 0 failed** (not the "40 passed"
   the story warns against, and not absent either). Re-derived, as §5 instructs.

#### The one pinned number this story moved, and why

`test/release-gate-epic-31.test.js` AC7.5h: the shipped tracked population `3249 → 3250` and the
unscanned remainder `535 → 536`. **Exactly one file was added under a `package.json` `files` root**
(`lib/confluence-publish-hook.js`), verifiable with
`git diff --name-only <merge-base>..HEAD --diff-filter=A`. **The two SCANNED populations do not move
at all** — markdown stays 2,332 and structured stays 382 — which is what says the FR266 scan was not
narrowed. The suite still defines and runs **43** tests; `EXPECTED_TEST_COUNT` is untouched. The
reason is written into the file beside the assertion, not only here.

**What that costs, stated:** the new file is `.js`, so it lands in the release gate's *unscanned*
remainder, and that file is where the hook's shipped instruction text is authored. The FR266
negative for that text is carried instead by the new suite's §9, which **extracts**
`MIRROR_VOCABULARY` from the release gate rather than restating it and asserts the hook text and the
whole emitted block match **zero** entries. That is a mitigation in a second suite, not coverage in
the gate; widening the gate's scan to `.js` would subsume it and is worth a reviewer's consideration.

#### FIX ROUND 1 — closing an independent review's REJECT

No verdict is claimed here and the status stays `review`. The review planted eleven mutants against
the 81-test suite and **seven survived**. What changed, and the mutant that now dies for each:

**BLOCKING-1 — the whole feature could be inert and the suite stayed green.** `if (false) ` on all
three `generateConfluencePublishHooks(...)` call sites passed 81/0: no hook written by `install`, by
`config layout` or by `bind`, and nothing failed. Tests 12.1/12.2/12.3 are **source-text greps** and
an `if (false) ` prefix satisfies every one — the `M30` shape the implementation claimed to have
eliminated, moved from the detection path to the generation path. New **§14** spawns the shipped
commands: 14.1 runs a REAL `ma-agents install --yes` (~90s, offline, no package manager,
`HOME`/`USERPROFILE` sandboxed) in a confluence-bound temp project and requires all five override
files **on disk** and resolving through **the project's own `resolve_customization.py`** — the one
the install deployed; 14.2 does the same for `bind`, 14.3 for `config layout`, 14.4 for `status`.
Replanted: all three sites → 14.1/14.2/14.3 red (97/3); install site alone → only 14.1 red (99/1).
Proved to be more than an existence check: writing a well-formed block under a one-character-off key
takes 14.1/14.2/14.3 red on the resolver assertion.

**BLOCKING-2 — success reported over a failed write.** `HOOK_WRITE_FAILED` was declared, listed and
formatted, and unreachable by every test on **all three** branches; 6.5 tested the constant. New
6.9–6.12 drive all three with real OS faults where one is deterministic — `_bmad/custom` as a FILE
(mkdirSync cannot run), the override path as a DIRECTORY (readFileSync raises EISDIR), a read-only
file for the removal path (fixture **armed**: a control write must throw, and named fs injection is
the fallback when the OS does not enforce it) — plus one injected read fault on a file whose write
would have succeeded, because that is the branch's real hazard: swallow it and the generator writes
over content it never saw. 6.12 pins the operator surface: exit 1, the failure named, the
consequence stated, and **no** "trigger written" line beside it. Replanted: write catch → 6.9+6.12
red; removal catch → 6.11 red; read catch → 6.10 red.

**BLOCKING-3 — AC5(c) proved present, not effective.** Moving the correction clause onto the
**success** path — an instruction to retract a correct message on success and stay silent about a
stale one on failure — matched all three of 6.3's unordered regexes. New 6.13 is structural: exactly
one sentence carries `STOP`, it must be conditional on a failure, it must contain the correction
clause, it must be the **only** sentence that does, `STOP` must precede it, and the routing sentence
must not carry it. Replanted: 6.13 red while **6.3 stays green**.

**A live false refusal, fixed (filed non-blocking; treated as required).** `scanForCollisions`
flagged any key whose **last dotted segment** was `on_complete`, so `agent.on_complete` was treated
as a duplicate of `workflow.on_complete`. Measured: five `refused-collision` outcomes,
`process.exitCode = 1`, a remedy that did not apply, no hook for any skill, and `ma-agents install`
exiting non-zero on a healthy project — failing closed on every subsequent install and `bind`. The
predicate now compares **resolved key paths** (`PUBLISH_HOOK_KEY_PATH`). New 5.8 measures the
predicate against `tomllib`'s verdict on the **combined** file over 22 shapes (15 valid, 7 invalid),
in both directions — 0 disagreements; 5.9 is the end-to-end regression; 5.10 covers the read side,
which shared the same false alarm. Replanting the old predicate: 5.8/5.9/5.10 red.

**Named survivors.** M1b closed — 3.3 rebuilt around `FS_MUTATING_VERBS`, which derives
`verb`/`verbSync`/`fs.promises.verb` for 30 base verbs (`cpSync`, `mkdirSync`, `rmdirSync`,
`utimesSync`, `linkSync`, `symlinkSync`, `writevSync`, `ftruncateSync`, `chmodSync` included),
handles `Buffer`/`URL` path arguments and second-position paths, and is proved **armed** against the
exact `fs.cpSync` shape M1b used; old 3.3 is now 3.4, and the M1b mutant takes it red while 3.1/3.2
stay green. M15 closed — 7.6/7.7 fail closed on an unrecognised backend, an absent record,
`undefined`/`null`/`''` and a case-folded `CONFLUENCE`. R10 closed — see Hazard C above. §9 extended
to the operator surface (9.8) with one adjudicated vocabulary entry, named as adjudicated. **No
widening of the FR266 gate scan**, and the gate's corpus is unchanged.

**M6 — DECLINED, with the reason.** Deleting AC4(a)'s post-write `tomlProblems(next)` guard still
survives, and this fix round does not close it. The guard is an assertion about **this module's own
output**, not about any input: every input-driven invalidity is caught earlier by
`scanForCollisions`, which 5.8 now shows covers exactly the set `tomllib` rejects on the combined
file. No input reaches the guard, so no input-driven test can kill that mutant, and the only way to
make one reachable would be to weaken the bundled reader (so a control character in a store label
became a rejection rather than an escape) — a change that trades a real property for a mutation
score. The guard is kept as a defence against a defect in `buildPublishHookBlock`; that it is
unreachable from outside is the correct state, and is recorded here rather than dressed up.

> **SUPERSEDED BY FIX ROUND 2 — the disposition stands, the reason above does not.** The second
> independent review accepted the declination as fact and rejected its reasoning, and it was right
> to: "`scanForCollisions` … covers exactly the set `tomllib` rejects on the combined file" was
> **false when it was written**, and B1 is the counterexample. See **M6, RE-ARGUED** in the fix
> round 2 section below for the reason that actually holds.

**Suites and invariants re-derived at fix-round HEAD.** Story suite 100/0 exit 0. `release-gate-epic-31`
43/0, `story-15-5-workflow-skills` 157/0, `project-layout-confluence-routing` 97/0,
`project-layout-confluence-page-tree` 157/0, `project-layout-artifact-routing` 59/0 (with
`_bmad-output/methodology/` absent), `project-layout-staleness-guard` 64/0 — all exit 0. I1 preflight
41 copies, split 13-14-14, one sha256; I2 gate 9 copies, split 3-3-3, one sha256. Nothing under
`skills/`, `lib/bmad-extension/skills/` or `lib/bmad-extension-plugin/` changed.

#### FIX ROUND 2 — closing a second, independent REJECT

No verdict is claimed here and the status stays `review`. This round did not write the story, the
implementation or fix round 1. The second review re-verified fix round 1's three blockers as
genuinely closed, and then filed **two new blockers and four non-blocking findings**. B1 was a
**live defect in shipped code at HEAD `793b9bd`**, not a test weakness.

**B1 (BLOCKING) — ma-agents wrote a file that killed the whole team layer, reported success, and
exited 0.** `readTomlStructure` records `workflow = { … }` as a key at path `['workflow']`, and
nothing compared a key path against a **strict prefix** of `PUBLISH_HOOK_KEY_PATH`. Measured on
pristine HEAD, no mutation, with `_bmad/custom/<skill>.toml` containing
`workflow = { prd_template = "assets/house-prd.md" }`:

| surface | shipped behaviour |
| --- | --- |
| `scanForCollisions` | `[]` — no refusal |
| `tomlProblems(next)` (the AC4(a) post-write guard) | `[]` — never fires |
| `generatePublishHooks` | five `wrote`, `refused: false` |
| the operator surface | *"Confluence publish trigger written … for 5 authoring skills"*, **exit 0** |
| real `tomllib`, on the file ma-agents had just written | `Cannot overwrite a value (at line 29, column 52)` |
| real `resolve_customization.py` | `warning:` to stderr, `{"workflow.on_complete": ""}`, **exit 0** — and the user's own `workflow.prd_template` **gone** |
| `detectPublishHookCollisions` (the `status` surface) | `[]` — silent |

That is **AC12(a)'s end state verbatim** — the entire team layer discarded at exit 0, publish and
customization together — except ma-agents' own write created it, and every surface this story built
to catch it said nothing.

**B2 (BLOCKING) — the same blind spot in the R10 detector.** `<skill>.user.toml` containing
`workflow = { on_complete = "MINE" }`: the resolver returns `"MINE"`, the publish is dead, exit 0,
and `detectUserLayerScalarOverrides` returned `[]`. The `[workflow]` header and dotted spellings of
the identical thing *were* detected; this one legal spelling was not — so the single state R10
exists to name went unnamed.

**THE FIX — a relation, not a longer list.** TOML has one namespace per file, so
`workflow.on_complete = [ … ]` fixes **two** facts: `workflow` is a TABLE and `on_complete` is a
VALUE. There are three ways to contradict them and the predicate covered one. `keyPathRelation(p)`
now classifies a resolved path as `same` / strict-`prefix` / `under`, and both the key loop and the
table loop branch on it. Two new kinds, so the remedy can be specific: `COLLISION_TABLE_IS_VALUE`
(`workflow = <value>`) and `COLLISION_KEY_USED_AS_TABLE` (`[workflow.on_complete]`,
`[[workflow.on_complete]]`, `workflow.on_complete.x`). R10 resolves its key path **through
inline-table values** (`valueAtKeyPath` / `inlineTableEntries`), so array-vs-scalar is judged where
the value actually is.

**A third counterexample, found by the same differential and fixed.** A byte-order mark in **bare**
position is `Invalid statement` to `tomllib` anywhere in the file, and `injectPublishHookBlock`
**prepends** ma-agents' region — so a team file a Windows editor or a PowerShell `Out-File` wrote
with a BOM has that BOM moved **into the middle** of the file, and the whole layer is discarded at
exit 0. The reader accepted it. Now reported, and only where `tomllib` reports it: a BOM inside a
basic or literal string, inside a quoted key, or inside a comment stays valid (measured; four such
cases are in the corpus).

**THE DIFFERENTIAL, RE-RUN RATHER THAN TRUSTED.** The review reported a 30-shape differential with
zero false refusals. Re-run here over **46 shapes** — array-of-tables, nested tables,
quoted/literal/spaced headers, `workflow."on_complete"`, `"workflow".on_complete`,
`workflow . on_complete`, `[workflow.sub]`, `[[workflow.sub]]`, the whole-quoted
`"workflow.on_complete"`, inline tables of five value kinds, multi-line basic and literal strings,
comments, CRLF, BOM, tab indent, no trailing newline, `[]`:

```
before the fix:  0 false refusals, 17 false ACCEPTANCES
after  the fix:  0 false refusals,  0 false acceptances
```

So a prefix relation aligns with `tomllib` in **both** directions and introduces no regression —
confirmed here, not taken on the review's word. Twelve of the seventeen false acceptances were the
`workflow = <value>` family the review named; the other five (`[workflow.on_complete]`,
`[[workflow.on_complete]]`, `[workflow.on_complete.deep]`, `workflow.on_complete.x`, and the BOM)
are the same blind spot in the opposite direction and were named by neither review.

**N1 — 6.13 was defeated by a structurally-conforming semantic inversion.** The review changed only
the halt sentence's polarity and got 100/0:

> …operation it does not list. **If no Confluence MCP server is reachable, or any operation does not
> report success, that is expected and you should proceed as normal; only once every operation
> succeeds, STOP:** name what failed, state that NO publish happened, and go back and correct the
> artifact-ready message you already gave the user — …

That tells the agent to continue silently on failure — the AC5(a)/(b) violation this story exists to
prevent — and to retract a **correct** message on success. It satisfied 6.13 because 6.13 measured
**shape**: one `STOP` sentence, a failure-condition regex present, the correction clause inside it
and nowhere else, `STOP` first, the routing sentence clean. 9.4's denylist does not match "proceed
as normal".

Fixed by pinning **polarity with a closed set**, not by extending a denylist — that is the
denylist-where-a-closed-set-was-needed shape this epic has been bitten by repeatedly.
`haltPolarityProblems()` measures two things no denylist can:

* **the governing gap** — between the last failure condition named in the halt sentence and the
  halt token there may be **nothing but an optional comma and whitespace** (`/^,?\s*$/`). That is a
  closed set of two characters; any clause inserted there fails, whatever words it is made of;
* **the sentence partition** — every sentence of the instruction fills exactly one **named** role
  (directive / routing / halt / prohibition) and every role is filled exactly once. A smuggled
  "you may proceed as normal" sentence has no role and fails, again with no wording guessed in
  advance.

The review's inversion is kept **in the suite** as the arming fixture: 6.13 asserts the polarity
check rejects it *and* that it still satisfies every shape check it originally defeated — the
fixture is only evidence while it still passes those. Replanted into `publishHookInstruction`
verbatim: **6.13 red, 101/1**, with 6.3, 6.4 and 9.4 all still green — which is exactly why it got
through.

**N2 — a remedy that did not apply.** `bin/cli.js` printed one fixed string for **every** collision
kind: *"Move your override into `<skill>.user.toml` as a TOML array"*. For a
`COLLISION_DUPLICATE_TABLE` holding `prd_template`, or for `COLLISION_UNPARSEABLE`, that is not
merely unhelpful — following it leaves the user exactly where they started. 6.7 exercised only the
one case for which it happened to be right; this is the "remedy that did not apply" shape fix
round 1 closed once already on the false-refusal path. `remediesFor(collisions, skill)` is now a
**map from kind**, shared by the install/bind reporter and the `status` reporter, with a named
fallback so a kind added without a remedy says so instead of getting a wrong sentence. New **6.14**
enumerates the kinds **from the module's own exports** (a new kind fails there), drives each through
the **generator** with a real file, asserts the printed remedies are pairwise **distinct**, and
asserts each is about its own kind — dotted keys for the table and value cases, "fix the TOML" for
the unparseable case, "not under our key" for the nesting case, re-anchoring for
`BLOCK_NOT_AT_ROOT`, marker removal for `HALF_BLOCK` (the last two proved on the `status` surface,
since generation heals them and they never reach the refusal).

**N3 — the `fs` interception's CLAIM corrected, not the code.** The interception is **property
patching** on `fs` / `fs.promises`, so a module that captured a function at load time
(`const { cpSync } = require('fs')`) escapes it, and a directory-level operation
(`fs.rmSync(dirname)`, `fs.renameSync(dir, dir2)`) names no `.user.toml` path. Behaviour is right
either way — 3.1 proves the personal file byte-identical after a full run and 3.2 proves none is
created, and both fail on either escape. The comment now says what 3.4 covers (`fs`-property call
sites) and what carries the guarantee (3.1/3.2), instead of claiming "every mutating fs entry
point".

**N4 — two absolutes reworded, because both were false.** 5.1 and 5.8 are **corpus-bounded** and the
record stated their agreement with `tomllib` as unconditional. B1 is a counterexample to 5.8 and the
BOM is a counterexample to 5.1 — the claims were wrong, not merely over-stated. Both test headers
now say what the test does and does not say, name the counterexample that proved it, and name the
corpus as the whole warrant. `PREDICATE_CORPUS` grows 22 → **48** shapes and `CORPUS`'s hand-built
set 26 → **33** (seven BOM cases, four of them VALID), so the reworded claim is also a wider one.

**§14.2 / §14.3 — closed.** Both asserted `existsSync` for all five and then resolved **one** skill,
so a `bind` or `config layout` regression that mis-routed four of five would pass both. Both now
resolve **all five** against the `ORACLE`, require each to route to **its own** store, and require a
clean resolver stderr. The review is right that this is redundancy rather than new coverage given
14.1 — but §14 is the load-bearing test in this story and the redundancy is cheap: it runs against
the project 14.1 already leaves behind. Measured value: mutant **M-l** (every skill routed to the
system store) is caught by 14.3 either way, and by 14.2 **only** because of this change — 14.2's old
single resolve used `bmad-prd`, whose correct store is `system`.

**M6, RE-ARGUED — still DECLINED, on a reason that does not generalise.** The review accepted the
declination as fact and rejected its reasoning, and it was right to. Fix round 1 said the guard is
dead because `scanForCollisions` "covers exactly the set `tomllib` rejects on the combined file".
**That was false when it was written**, and B1 is the proof. The reason that actually holds is a
code-path one:

* `tomlProblems(next)` is `readTomlStructure(next).problems`;
* `scanForCollisions(existing)` has already run **the same reader** over the same text with only
  ma-agents' own marker region blanked, and turns **every** problem it finds into a **blocking**
  `COLLISION_UNPARSEABLE`. A syntactic defect in the user's own bytes therefore never reaches the
  guard — the generator refuses first and returns;
* what is left is text `buildPublishHookBlock` produced. Its only inputs are `skillName`,
  `storeCliName` and `storeLabel`, and all three are ma-agents' own constants (`AUTHORING_SKILLS`,
  and `CONFLUENCE_STORE_RECORDS[…].cliName` / `.label`, `bin/cli.js:1393-1396`). No path carries
  user text into them, so no INPUT can make the block malformed and no input-driven test can kill
  the mutant.

Note what this argument does **not** claim: it says nothing about whether `scanForCollisions` is
complete. That is the point. An incomplete predicate makes the guard **less** reachable, not more —
the failure it produces is a file written and broken, which is what B1 measured, not a guard that
fires. So B1 does not change M6's disposition. The guard is kept as the one defence against a defect
in `buildPublishHookBlock`, the only thing upstream of it that this module owns.

**MUTATION — RUN, NOT CLAIMED, AND ONE SURVIVOR TAUGHT SOMETHING.** Twenty-one mutants, each applied
to a single file, run against the whole suite, and reverted in the same step; `git status
--porcelain` and blob hashes checked after every batch (`lib` and `bin` end byte-identical to their
committed blobs). The battery deliberately attacks the NEW prefix check from **both** sides —
reverting it, over-widening it, and spelling it as a string prefix rather than a segment prefix.

| mutant | verdict | killed by |
| --- | --- | --- |
| M-a `keyPathRelation`: drop the STRICT-PREFIX branch (B1's fix reverted) | KILLED | 96/6 — 5.3, 5.5, 5.8, 5.11, 6.14, 10.3 |
| M-b drop the UNDER branch | KILLED | 5.8 → after hardening, 5.8 + 6.14 (M-b2) |
| M-c relate EVERYTHING (segment comparison removed) | KILLED | 90/12 — 4.3, 4.5, 4.6, 4.7, 5.3, 5.8, 5.9, 5.10, 6.11, 7.6, 10.7, 13.2 |
| M-d STRING prefix instead of SEGMENT prefix | KILLED | 5.8 |
| M-e table loop back to the old `length === 1` check | **SURVIVED**, then KILLED (M-e2: 5.8 + 6.14) | see below |
| M-f key loop back to EQUALITY only | KILLED | 98/4 — 5.3, 5.8, 5.11, 6.14 |
| M-g exempt INLINE TABLE values from the prefix check | KILLED | 98/4 — 5.3, 5.8, 5.11, 6.14 |
| M-h delete the BOM check | KILLED | 5.1, 5.8 |
| M-i R10: no inline-table descent (B2's fix reverted) | KILLED | 10.12, 10.14 |
| M-j R10: `inlineTableEntries` always returns null | KILLED | 10.12, 10.14 |
| M-n R10: report an ARRAY inside an inline table as a scalar (over-report) | KILLED | 10.13 |
| M-o flag any SIBLING under our table (over-refusal) | KILLED | 99/3 — 5.8, 5.9, 6.14 |
| M-k3 ONE fixed remedy for every collision kind (N2 reverted) | KILLED | 6.14 |
| M-q remedy map keyed by kind, every value identical | KILLED | 6.14 |
| M-l every skill routed to the SYSTEM store (the §14 mis-route) | KILLED | 14.1, **14.2**, 14.3 |
| the review's own N1 inversion, replanted verbatim | KILLED | 6.13 (101/1), with 6.3, 6.4 and 9.4 still green |
| M-p relax 6.13's governing gap to "anything without a period" | KILLED | 6.13's arming assertion |
| M-m delete 6.13's positive polarity assertion | SURVIVED — see below | — |

**M-e SURVIVED, reported rather than tidied away.** Restoring the table loop's old
`t.path.length === 1 && t.path[0] === 'workflow'` check passed **102/0**. The reason:
`[workflow.on_complete]` followed by `x = 1` *also* produces a KEY at
`['workflow','on_complete','x']`, which the key loop catches as `under` — so every header shape in
the corpus was still refused through the other branch. The table branch is load-bearing only for a
header with **nothing under it**. `tomllib` rejects all three of those beside our block
("Cannot declare … twice" / "Cannot mutate immutable namespace"), and the corpus contained none of
them. Three entries added, 6.14 given the header spellings explicitly, and M-e replanted: **red on
5.8 and 6.14**.

**M-m is a null result, and is labelled one.** Deleting a test's own assertion cannot be caught by
the suite that contains it; no test asserts another test's assertions. It is listed for
completeness, not as an open gap. What *can* be measured is whether the assertion is doing work,
and M-p answers that: relaxing the closed set to "anything without a period" — a plausible
loosening — is killed by 6.13's arming fixture.

**Two other mutants were only caught because of corpus work done in this round**, which is a thin
margin and is named as one. **M-d** (a `joined.startsWith()` relation) dies only because
`workflow.on_complete_extra`, `[workflow.on_complete_extra]` and `workflowX` were added as VALID
entries — a segment-boundary relation and a string-prefix relation are indistinguishable without
them. **M-b** died to 5.8 alone until 6.14's nesting fixture was changed from a header to a key
(`workflow.on_complete.mine = 1`), because a header also produces a nested key.

**Suites and invariants re-derived at fix-round-2 HEAD.** Story suite **102/0** exit 0
(`EXPECTED_TEST_COUNT` 100 → 102, deliberately: 5.11 and 6.14 are new; nothing was weakened or
deleted). `release-gate-epic-31` 43/0, `story-15-5-workflow-skills` 157/0,
`project-layout-confluence-routing` 97/0, `project-layout-confluence-page-tree` 157/0,
`project-layout-artifact-routing` 59/0 (with `_bmad-output/methodology/` absent),
`project-layout-staleness-guard` 64/0 — all exit 0. I1 preflight **41 copies, split 13-14-14, one
sha256 `ca9bf25b…`**; I2 gate **9 copies, split 3-3-3, one sha256 `cda3d3d9…`** — both re-derived
independently of the suite as well as by tests 11.2/11.3. No pinned number moved in this round.
Nothing under `skills/`, `lib/bmad-extension/skills/` or `lib/bmad-extension-plugin/` changed.

**Still open after this round.** (1) M-m, above — inherent, not a gap. (2) The `fs` interception's
two escapes (N3) are documented rather than closed; 3.1/3.2 carry the guarantee. (3) Hazard C is
unchanged: upstream `bmad-customize` still instructs the third writer to use the exact scalar form
that replaces the publish, and only upstream can resolve that. (4) Everything about a live
Confluence remains MOCK-VERIFIED — the Atlassian Rovo MCP is still unauthorised and cannot be
authorised non-interactively. (5) Linux was never run; `npm test` was not run end to end (its chain
position 1 and 20 are the two hazardous suites).

#### Not done, deliberately

No push, no PR, no publish. No skill document touched. `epics.md` untouched (the Story 31.15 entry
was already registered and needed no append; its `**Status:**` line is left as-is because epics.md
statuses are stale across this epic — Story 31.14 still reads `backlog` there while `sprint-status.yaml`
reads `review` — and `sprint-status.yaml` is the status authority). PRD, Decision P5-9 and every
existing story definition unedited.

### File List

```
lib/confluence-publish-hook.js                             NEW  the generator, markers, TOML reader, detection
                                                           FIX1 resolved-key-path collision predicate
                                                                (PUBLISH_HOOK_KEY_PATH / samePath);
                                                                readTomlStructure carries each key's raw value;
                                                                detectUserLayerScalarOverrides (R10, read-only)
                                                           FIX2 keyPathRelation (same / strict-prefix / under) and
                                                                both scanForCollisions loops branching on it;
                                                                COLLISION_TABLE_IS_VALUE (B1) and
                                                                COLLISION_KEY_USED_AS_TABLE; valueAtKeyPath /
                                                                inlineTableEntries so R10 resolves through an
                                                                inline table (B2); a bare-position U+FEFF is a
                                                                reader problem, as tomllib has it
bin/cli.js                                                 MOD  generateConfluencePublishHooks + its 3 call sites,
                                                                the operator report, the status detection surface,
                                                                the require and the exports
                                                           FIX1 printUserLayerScalarOverrideReport, called from
                                                                printPublishHookCollisionReport and exported
                                                           FIX2 remediesFor() — a remedy per collision KIND,
                                                                shared by the install/bind reporter and the
                                                                status reporter, with a named fallback (N2)
test/project-layout-confluence-publish-hook.test.js        NEW  81 tests -> FIX1 100 -> FIX2 102 tests
                                                           FIX2 new 5.11 (B1 end to end) and 6.14 (per-kind
                                                                remedies); 5.3 carries the B1 shape and states
                                                                its claim per outcome; 6.13 gains a closed-set
                                                                polarity check armed against the review's own
                                                                inversion; 10.12/10.13/10.14 cover all three
                                                                spellings of the personal override; 14.2/14.3
                                                                resolve all five to their own stores;
                                                                PREDICATE_CORPUS 22->48, CORPUS 26->33;
                                                                the 3.4 and 5.1/5.8 claims corrected (N3/N4)
test/release-gate-epic-31.test.js                          MOD  AC7.5h population 3249->3250, remainder 535->536
package.json                                               MOD  new suite at chain position 37
.gitattributes                                             MOD  LF pin for the two new files
_bmad-output/implementation-artifacts/31-15-*.md           MOD  this record
_bmad-output/implementation-artifacts/sprint-status.yaml   MOD  31-15 entry + last_updated
_bmad-output/implementation-artifacts/bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate.md
                                                           MOD  disposition note only; status stays OPEN
```
