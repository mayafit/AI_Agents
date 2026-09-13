---
type: bug
severity: medium
title: The default --modules set installs every bundled module, so wds installs for everyone and scaffolds design-artifacts/ in projects that never asked for UX tooling
---

# Bug: The default `--modules` set installs every bundled module, so `wds` installs for everyone and scaffolds `design-artifacts/` in projects that never asked for UX tooling

**Status:** review (implemented 2026-09-12 on `fix/wds-default-module-set`; **fix round 1 landed 2026-09-13** closing an independent review's REJECT — see the fix-round record below. No verdict claimed; the reviewer owns the verdict)
**Severity:** medium
**Affected Component:** `bin/cli.js#selectBmadModules` (the no-flag default branch); `lib/bmad.js#getInstallableBmadModules`; requirement **FR123** (and **FR249**, which reuses FR123's set)
**Classification:** REQUIREMENTS CHANGE (needs a PRD amendment) + a follow-on code change

## Disposition — PRD amendment landed, bug is now actionable (2026-08-02)

This was classified as blocked on a requirements change. **FR123 has been amended**, so the
blocker is gone.

New default install set: **bmm + tea + bmb + cis**. `gds` and `wds` remain **bundled but not
installed by default** — still fully available offline via the `--bmad-modules` multiselect, so
the air-gap guarantee (NFR2/NFR50/NFR57) is untouched.

Two points settled during the amendment and load-bearing for implementation:

1. **This moves ma-agents towards upstream, not away from it.** Upstream declares
   `default_selected: false` on all five bundled modules and `true` only on `bmm`; ma-agents
   reads that field nowhere and force-installs everything. Honouring the narrower default is
   closer to BMAD's own stated intent — which is why this survived the "don't change BMAD" rule
   that closed the sibling `docs/` bug.
2. **NFR73's set-equality guard is not affected.** It governs the offline *bundle* on the
   resolved registry set at cache-build time, not the runtime install set. No allowlist edit and
   no cache rebuild are required.

Note this does **not** fix the sibling `docs/` directory: `bmm` is force-included regardless of
selection, and `bmm` is what declares `{project_knowledge}`. That bug is closed won't-fix.

## Summary

A user installing at Project scope with **GitHub Copilot and Cline only** got a
root-level `design-artifacts/` directory containing five empty phase folders
(`A-Product-Brief`, `B-Trigger-Map`, `C-UX-Scenarios`, `D-Design-System`,
`E-Development`). They never selected a UX module and do not want one.

`design-artifacts/` comes from **wds** (Whiteport Design Studio), which installs
because **FR123 makes the default `--modules` set *every non-retired bundled
module***. The user's position — wds should not be in the default installation —
is a change to a shipped requirement, not a code defect in isolation.

Reproduced on three real installs: `d:\Code\Workshop`, `d:\Code\Prophesys`,
`d:\Code\EltEye` all carry the same empty five-folder `design-artifacts/` tree.
It is also present, untracked, in the ma-agents repo itself
(`d:\Code\AI_Agents\design-artifacts\` — `git ls-files design-artifacts` returns
nothing).

## Reproduction Steps

1. `npx ma-agents install` into a clean project, choose **Project** scope, select
   only GitHub Copilot and Cline, and do **not** pass `--bmad-modules`.
2. Accept the BMAD-METHOD install prompt.
3. Observe the resolved module list in the installer output:
   `--modules bmm,tea,bmb,cis,gds,wds` (verbatim from
   `d:\Code\Workshop\install_2026-07-13_19-23-02-272.log:98`).
4. Observe `design-artifacts/A-Product-Brief` … `E-Development` at the project root,
   all empty.

## Expected Behavior

A project that selected two IDE integrations and no design/UX tooling should not
acquire a UX methodology module, its agents (Freya, Saga, Mimir), its skills, or
its output scaffold. The default install set should be either (a) the modules
upstream itself marks as default, or (b) an explicitly-curated ma-agents set —
with the full bundled set reachable through an explicit choice.

## Actual Behavior

Every non-retired bundled module installs, wds included, and wds declaratively
creates its output scaffold at install time.

**Why all five install:**

- `bin/cli.js:889-961` `selectBmadModules()` has three branches. The interactive
  wizard hits **branch 3** (no flag) and, with nothing persisted, ends at
  `bin/cli.js:960`: `return persist(installable.map(m => m.id));` — every entry.
- `installable` is `bmad.getInstallableBmadModules().filter(m => !m.retired)`
  (`bin/cli.js:890`). `getInstallableBmadModules` (`lib/bmad.js:526-545`) returns
  `bmm` plus every key of `lib/bmad-cache/cache-manifest.json`, with
  `retired` driven solely by `meta.retiredUpstream` (`lib/bmad.js:541`). At
  v6.10.0 **none** of tea/bmb/cis/gds/wds carries that marker (`lib/bmad.js:516-519`
  says so explicitly), so nothing is filtered.
- The module multiselect exists but is unreachable by default: it is branch 2,
  gated on a **bare `--bmad-modules` flag** (`bin/cli.js:916-943`, flag parsed at
  `bin/cli.js:278`). The default interactive wizard never shows the module list at
  all — FR123's "opt into a specific subset" requires knowing a CLI flag exists.

**Why wds then creates `design-artifacts/`:**

- `lib/bmad-cache/wds/src/module.yaml:39-41` — `design_artifacts` config question,
  `default: "design-artifacts"`.
- `lib/bmad-cache/wds/src/module.yaml:126-128` — a declarative
  `directories:` block listing `"{design_artifacts}"` and `"{project_knowledge}"`.
- `lib/bmad-cache/wds/src/module.yaml:158-164` — `wds_folders:` listing the five
  phase folders.
- Upstream materialises all of it: `createModuleDirectories()` at
  `node_modules/bmad-method/tools/installer/modules/official-modules.js:595`,
  with `await fs.ensureDir(fullPath)` at **`:738`** and the wds subfolder loop at
  **`:742-746`** (`if (configKey === 'design_artifacts' && wdsFolders.length > 0)`).
  Citations are against **bmad-method 6.10.0**, the version pinned at
  `package.json:35`.
- Resulting config on a real install (`d:\Code\Workshop\_bmad\wds\config.yaml:8`):
  `design_artifacts: "{project-root}/design-artifacts"`.

## Root Cause

**FR123** (`_bmad-output/planning-artifacts/prd/capabilities/bmad-integration-and-bundling.md`,
`:29` when this was filed, **`:30` today** — quoted below as it read *before* the
2026-08-02 amendment):

> "For the `--modules` value, the default install set is **every non-retired module**
> from the bundled cache manifest (`lib/bmad-cache/cache-manifest.json`) … all stable
> `type: bmad-org` modules — including `wds` — are included"

That requirement is faithfully implemented at `bin/cli.js:960`. The behaviour is
therefore **correct against the current spec** — the spec is what the user is
disputing.

### FR123 contradicts upstream's own declared defaults

Every bundled optional module declares itself **not** default-selected, and only
the core module opts in:

| module | file:line | value |
|---|---|---|
| tea | `lib/bmad-cache/tea/src/module.yaml:6` | `default_selected: false` |
| bmb | `lib/bmad-cache/bmb/skills/module.yaml:5` | `default_selected: false` |
| cis | `lib/bmad-cache/cis/src/module.yaml:6` | `default_selected: false` |
| gds | `lib/bmad-cache/gds/src/module.yaml:5` | `default_selected: false` |
| wds | `lib/bmad-cache/wds/src/module.yaml:6` | `default_selected: false` |
| bmm | `bmad-method@6.10.0 src/bmm-skills/module.yaml:4` | `default_selected: true` |

ma-agents currently ignores this field entirely — no `default_selected` reference
exists anywhere in `bin/`, `lib/`, or `scripts/`. FR123 was written (changelog entry
for the 27.x correction, `prd/changelog.md:22`) to *restore* modules that a hardcoded
`['bmm']` literal had been suppressing; the pendulum went from "only bmm" to "all
five" without a middle position.

## How expensive is changing the default? — CHEAPER THAN IT LOOKS

This was checked specifically, because Story 30.2 / NFR73's two-sided set-equality
guard looked like a blocker. **It is not:**

- `KNOWN_BUNDLED_MODULES` (`scripts/build-bmad-cache.js:60` =
  `['tea','bmb','cis','gds','wds']`) and the NFR73 guard govern **what is BUNDLED
  into the offline cache at build time**, on the *resolved registry set* — NFR73
  states this explicitly: *"compute the equality on the resolved/filtered registry
  set, NOT on the final manifest keys"*
  (`prd/capabilities/bmad-platform-currency.md:137`).
- The **default install set** is a separate, downstream decision made at runtime in
  `bin/cli.js:889-961`.
- Therefore: narrowing the default install set requires **no** change to
  `KNOWN_BUNDLED_MODULES`, **no** change to NFR56/NFR73, **no** cache rebuild, and
  **no** loss of air-gap coverage. All five modules stay bundled and stay
  installable offline — they just stop installing unasked. The two-sided guard
  keeps doing exactly its job (catching silent upstream additions such as
  `bmad-loop`).

The only real cost is the requirements change itself plus its regression tests.

## Which modules should be in the default set?

Recorded as analysis, not as a decision — the PM owns this:

- **bmm** — must stay. Force-included in every path (`bin/cli.js:884-887`,
  `bmad.resolveBmadModules`) because the BMad core agents live there; it is also
  the only module upstream marks `default_selected: true`.
- **tea** (Test Architect), **bmb** (BMad Builder), **cis** (Creative Intelligence
  Suite), **gds** (Game Dev Studio), **wds** (Whiteport Design Studio) — all five
  are domain-specific. `gds` is game development; `wds` is a UX methodology; `cis`
  is creative/strategy. None is plausibly wanted by *every* project.
- Note **bmb specifically also causes bug B3**: its `bmad_builder_output_folder`
  default of `{project-root}/skills` (`lib/bmad-cache/bmb/skills/module.yaml:12-15`)
  is what upstream's suffix-match bleeds into other modules' artifact paths. Dropping
  bmb from the default set would incidentally eliminate that contamination for the
  default install — see `bug-root-skills-dir-orphaned-artifact-dirs-on-install.md`
  and Story 27.14, whose "Proposed Direction 1 (preferred): don't co-install bmb + gds"
  says the same thing.

## Recommended Direction (two parts)

**Part A — narrow the default (requirements change).** Amend FR123 so the default
`--modules` set honours each module's own `default_selected` flag, i.e. **bmm only**;
or, if a richer out-of-the-box experience is wanted, name an explicitly-curated
default set in the FR rather than deriving it from "everything bundled". Either way
the FR must say *which* set and *why*, so the next bundled module does not silently
join it.

**Part B — make the choice visible (code change, follows from A).** Promote the
module multiselect from a hidden `--bmad-modules`-bare branch
(`bin/cli.js:916-943`) to a first-class question in the interactive wizard, with
each module's real description and `default_selected` as the initial check state.
This is the answer to "narrower default vs install-time multiselect": **both** — a
narrow default for `--yes`/CI, and an explicit multiselect for interactive installs.
Bug 27.13's persistence (`bin/cli.js:945-959`) already makes the resulting choice
stick across re-runs.

Not recommended: leaving the default as-is and only pruning the empty
`design-artifacts/` afterwards. That hides the symptom while the user still gets
wds's three agents, its skills, its Cline workflow wrappers, and its config.

## Blast Radius

- **Every default Project-scope install**, and — per FR249
  (`prd/capabilities/bmad-integration-and-bundling.md:39`, "the same default set
  FR123 defines for project installs") — every future global install too.
- Users receive five modules' worth of agents, skills, and generated Cline/Copilot
  wrappers they did not ask for. On the Workshop install this is a large share of
  the 166 deployed skills.
- `design-artifacts/` is *untracked* but not gitignored, so it is commit-eligible.
- Changing the default is **behaviour-visible** to existing users: a re-run of a
  project that already has tea/bmb/cis/gds/wds must NOT silently uninstall them.
  The persisted-selection branch (`bin/cli.js:950-959`) plus bug 27.13's durable
  exclude give a safe migration path, but the story must pin it with a test
  (existing installs unchanged; only NEW installs get the narrower default) — the
  same non-destructive posture NFR49 and Story 30.4 established for the Demerzel
  deprecation.

## Affected Files

- `bin/cli.js` — `selectBmadModules` (`:889-961`): `installable` (`:890`),
  multiselect branch (`:916-943`), persisted branch (`:945-959`), install-all
  default (`:960`); flag parsing (`:278`, `:135`); call site (`:1479-1483`)
- `lib/bmad.js` — `getInstallableBmadModules` (`:526-545`), `retired` derivation
  (`:541`), module descriptions (`:500-508`)
- `lib/bmad-cache/wds/src/module.yaml` — `default_selected` (`:6`), `design_artifacts`
  (`:39-41`), `directories:` (`:126-128`), `wds_folders:` (`:158-164`)
- `lib/bmad-cache/{tea,bmb,cis,gds}/…/module.yaml` — `default_selected: false` (see table)
- `scripts/build-bmad-cache.js` — `KNOWN_BUNDLED_MODULES` (`:60`), `diffBundleSet`
  (`:291`) — **cited to show they are NOT affected**
- upstream `bmad-method@6.10.0 tools/installer/modules/official-modules.js` —
  `createModuleDirectories` (`:595`), `fs.ensureDir` (`:738`), wds subfolders (`:742-746`)
- `_bmad-output/planning-artifacts/prd/capabilities/bmad-integration-and-bundling.md`
  — FR123 (`:30`), FR249 (`:39`) — **the text that must be amended, NOT edited here**
  (both were `:29`/`:38` when this report was filed; the amendment itself shifted them)

## Acceptance Criteria

*(Conditional on the PRD amendment landing first — this story must not start before FR123 is amended.)*

1. A default interactive Project install with no `--bmad-modules` flag installs only
   the amended default set; the installer output's `--modules` value matches it exactly.
2. `design-artifacts/` is not created by a default install.
3. `--bmad-modules tea,wds` still installs exactly those (plus force-included `bmm`).
4. Bare `--bmad-modules` still opens the multiselect; every bundled module is
   offered, initial check state derives from `default_selected`.
5. Interactive installs get the module question without needing a CLI flag (Part B).
6. `--yes` with no flag uses the amended default and prompts for nothing.
7. **Non-destructive:** re-running the installer on a project that already has
   tea/bmb/cis/gds/wds does not remove them — the persisted selection
   (`bin/cli.js:950-959`) wins over the new default. Pinned by test.
8. The offline bundle is unchanged: `cache-manifest.json` still contains all five
   modules, `KNOWN_BUNDLED_MODULES` is untouched, and the NFR73 two-sided
   set-equality guard still passes with no edit.
9. An air-gapped `--bmad-modules wds` install still succeeds from the cache with
   zero network calls (NFR57).
10. `.ma-agents.json` records the resolved set as it does today (bug 27.13).

## PRD Amendment Needed

**YES — this is the defining characteristic of this bug.**

- **FR123** (`prd/capabilities/bmad-integration-and-bundling.md:29` when filed, `:30`
  after the amendment) must be amended: the "default install set is every non-retired
  module from the bundled cache manifest" clause is precisely the behaviour being rejected.
- **FR249** (`:38` when filed, `:39` today) inherits FR123's set by reference for global installs and must be
  re-read after the amendment (it may need no text change, but it must not be left
  pointing at a definition that has silently shifted meaning).
- Not affected, confirmed: **FR235** (bundle allowlist), **NFR56** and **NFR73**
  (thin-cache / two-sided set-equality guards) — all operate on the *bundle*, not the
  *default install set*.

**The PRD has deliberately NOT been amended by this report.** Route to the PM
(`bmad-prd` update intent) before any implementation story is written.

## Provenance

- Reported 2026-08-02 from a clean Project-scope install (GitHub Copilot + Cline).
- FR123's current wording dates to the bug-fix clarification recorded at
  `prd/changelog.md:22` (restoring the tea/bmb/cis/gds modules a hardcoded `['bmm']`
  literal had suppressed) and was corrected in the Epic 27 entry (`prd/changelog.md:20`)
  to stop treating wds as retired.
- Related: Story 27.13 (persist BMAD module selection / durable exclude), Story 27.14
  (bmb's `skills` output folder bleeding into other modules — same bmb-in-default root),
  Story 30.2 / NFR73 (bundle set-equality guard, confirmed NOT a blocker here).
- Severity rationale: **Medium**. No data loss and no broken install, but it installs
  substantial unwanted surface area into every project by default, leaves untracked
  litter at the repo root, and can only be corrected by a requirements change.

## Implementation record — 2026-09-12, branch `fix/wds-default-module-set`

Implemented; **no verdict claimed**, an independent review follows. Spec:
`spec-bug-wds-default-module-set.md`.

**Changed**

- `lib/bmad.js:530-591` — `DEFAULT_BMAD_MODULE_IDS = ['bmm','tea','bmb','cis']`,
  `NON_DEFAULT_BMAD_MODULE_IDS = ['gds','wds']`, `getDefaultBmadModules(available)`
  (intersected with the installable set, so a missing cache manifest degrades to `[bmm]`
  instead of throwing out of `resolveBmadModules`). All three exported.
- `bin/cli.js#selectBmadModules` branch 3 — resolution order is now: persisted selection
  (27.13) → modules already present under `_bmad/` → FR123's default set.
- `bin/cli.js#selectBmadModules` branch 2 — the multiselect still offers **every** bundled
  module; only its initial check state narrowed to the default set, so Enter equals the
  no-flag default instead of silently reinstating install-everything.
- `--help`, the flag-parse comment, the function contract and the call-site comment.
- `test/bmad-module-selection.test.js` — 37 → 46 tests; the expectation is parsed from
  FR123 in the PRD shard at runtime, not restated in the test.

**Disposition of the ACs in this file**

- AC1, AC2, AC3, AC6, AC7, AC8, AC10 — covered.
- **AC4 partially**: bare `--bmad-modules` still opens the multiselect and still offers
  every bundled module, but the initial check state derives from FR123's default set, **not**
  from each module's `default_selected` field. Honouring `default_selected` literally would
  pre-check `bmm` alone and contradict FR123's amended default. `default_selected` is still
  read nowhere in `bin/`, `lib/` or `scripts/`.
- **AC5 NOT DONE — deferred.** "Interactive installs get the module question without needing
  a CLI flag" (Recommended Direction Part B) is a new wizard question: a separate,
  independently shippable deliverable, not required by FR123's amended text, and out of
  scope for this fix. The multiselect remains reachable only via bare `--bmad-modules`.
- **AC9 partially**: an air-gapped `--bmad-modules wds` install is covered as far as the
  bundled-cache staging step (`prePopulateBmadCache` run for real against a redirected HOME,
  an fs-only path). A full `--network none` container install was not re-run.

**Two defects found in this file and in FR123 while implementing** — see the review report;
neither changes the decision:

1. FR123's rationale says gds and wds "are the only bundled modules that scaffold
   directories at the project root (`design-artifacts/` via **their** `directories:`
   blocks)". Only `wds` declares `{design_artifacts}`
   (`lib/bmad-cache/wds/src/module.yaml:126-128`). `gds`'s block
   (`lib/bmad-cache/gds/src/module.yaml`) lists `{planning_artifacts}`,
   `{implementation_artifacts}` and `{project_knowledge}` — all of which `bmm` declares too,
   so `gds` adds no root directory that a default install does not already get. Excluding
   `gds` is still sound (it is a domain-specific game-dev module), but the stated reason is
   wrong for it.
2. This file's "Affected Files" section cites `bin/cli.js:889-961` and
   `lib/bmad.js:526-545`. Those line numbers date from the branch the bug was filed
   against. **Corrected in the fix round below** — the mapping given here was itself
   stale.

## Fix round — 2026-09-13 (closing an independent review's REJECT)

The production code was found **correct**: the reviewer could not make the default set
wrong in a way the FR123 oracle missed. The REJECT was a **test-coverage** rejection, on
the one surface where the change's own thesis ("pin it with a test, not an assertion")
had not been applied. No verdict is claimed here either.

### Closed — one blocking, three non-blocking

| id | what survived | closed by |
|---|---|---|
| **M-E** (blocking) | `bin/cli.js` branch 2, `selected: isCore \|\| defaultIds.has(m.id)` → `selected: true` — **literally the pre-change value** — survived 46/0. Branch 2 had *zero* behavioural coverage: `bmadModulesPrompt` was asserted only in the `parseFlags` tests and every call passed it `false`. | Two tests driving `selectBmadModules({ bmadModulesPrompt: true })` with `prompts` stubbed in the require cache. Both halves of FR123's claim pinned: the initial check state **is** the default set (bmm forced), and **every module FR123 classifies is still OFFERED** — the half the air-gap argument rests on — with teeth requiring the offer set to be strictly larger than the check set. Replanted: **46 passed, 2 failed**. |
| **M-D** | The branch-3c intersection was tested only as a UNIT. Replacing `bmad.getDefaultBmadModules(installable)` with `[...bmad.DEFAULT_BMAD_MODULE_IDS]` at the call site left the helper's own test green — 46/0 — while restoring the documented crash `Unknown BMAD module(s): tea, bmb, cis. Available: bmm`. | A degraded-bundle test through `selectBmadModules`, inducing the degradation at its documented source. Replanted (call-site form): **49 passed, 1 failed**, with that message verbatim. |
| **M-C** | Order was unpinned. Every AC1/AC4 assertion sorts, so reordering `DEFAULT_BMAD_MODULE_IDS` to `['cis','bmb','tea','bmm']` was caught only *incidentally*. The installer would have emitted `--modules cis,bmb,tea,bmm`; the NFR21 determinism claim in the `getDefaultBmadModules` docblock was pinned by nothing that names it. | The emitted `--modules` string asserted for the **default** path, as it already was for the explicit path, with the expected ORDER parsed out of FR123's own sentence (`fr123DefaultOrder`, a prose-ordered parser — the existing `idsIn` filters BUNDLED_IDS and so takes its order from the code). Replanted: **48 passed, 2 failed**. |
| **probe P4** | `lib/bmad.js#getInstalledBmadModules` used `fs.existsSync`, not a directory check, so a stray **file** named `_bmad/wds` made the probe report `bmm,wds`. Branch 3b **persists** what it finds, so the misreading became a durable "explicit user selection". | `fs.statSync(...).isDirectory()` in a try/catch, matching `prePopulateBmadCache`'s check in the analogous place. Tests at both layers were **red before the fix (50/2)** and green after. |

`test/bmad-module-selection.test.js` 46 → **52 tests, 52/0**.

### Stale citations corrected

- FR123 is at `prd/capabilities/bmad-integration-and-bundling.md:30` and FR249 at `:39`.
  This file cited `:29` and `:38` throughout — the pre-amendment positions; the amendment
  itself shifted them by one. Corrected at every occurrence.
- The FR249 / global-scope code the analysis points at: the `if (installScope === 'global')`
  BMAD-agent filter is **`bin/cli.js:4429-4441`** and the Step 3.5 project guard is
  **`:4444`** (the `// Step 3.5: BMAD-METHOD Integration` comment is `:4443`). Before this
  change they were `:4376-4388` and `:4391`; the 53 lines this change inserts into
  `selectBmadModules` are the whole difference. **Note:** the strings `4376`, `4388` and
  `4391` appear in **no committed file in this repository** (verified by a full-tree search) —
  they exist only in the review report, so there was nothing to correct in place. The
  current numbers are recorded here instead so the record carries them going forward.
- On this branch `selectBmadModules` is **`bin/cli.js:3703-3812`**, `getInstallableBmadModules`
  is **`lib/bmad.js:609-628`**, and `getInstalledBmadModules` is **`lib/bmad.js:649-661`**.
  Defect 2 above claimed `bin/cli.js:3687-3757` / `lib/bmad.js:546-565`; that correction was
  itself computed against the pre-change tree and is superseded by these.

### Recorded, deliberately NOT implemented in this round

**V3 — branch 3b freezes an old bug.** A pre-27.13 project holding only `bmm` under `_bmad/`
keeps only `bmm`, and because the probe result is **persisted**, that becomes an
indistinguishable "explicit user selection". It will never acquire `tea`/`bmb`/`cis` — not
now and not after any future default change. The *only* way to be in that cohort is the era
when `bin/cli.js` hardcoded `['bmm']`, i.e. the very bug this line of work exists to fix, so
branch 3b freezes it permanently. The reviewer's suggestion — resolve 3b as the **union** of
the on-disk set with the FR123 default set — would be non-destructive *and* convergent, and
would not disturb 3a (an explicit persisted deselection still wins). **This is a product
decision, not a defect**, and is left as an open question for the PM. Behaviour unchanged in
this round.

**C3 — FR123's rationale is wrong twice, not once.** Defect 1 above named the `gds` half.
The second half was never named: FR123 says `gds` and `wds` "are the only bundled modules
that scaffold directories at the project root", but `lib/bmad-cache/tea/src/module.yaml:306-307`
declares `directories: - "{test_artifacts}"` — a root directory `bmm` does **not** declare
(`bmm`'s block is `{planning_artifacts}`, `{implementation_artifacts}`, `{project_knowledge}`),
from a module that **is** in the default set. So the sentence is wrong about `gds` *and* false
as a general claim: a default install still scaffolds a root directory from a non-`bmm`
module. The narrowing decision is unaffected — `design-artifacts/` is the tree the user
objected to and only `wds` declares it. **The PRD is the PM's; not edited here.**

**C4 — an architecture decision still states the old default.**
`_bmad-output/planning-artifacts/architecture/decisions/bmad-integration-and-bundling.md:109`
(the FR123 parameter-mapping table) still reads *"Default: every bundled module from the cache
manifest (bmm,tea,bmb,cis,gds,wds at v6.8.0 …)"*. That now contradicts both FR123 as amended
and the shipped code. Recorded, **not edited** — a propagation gap the 2026-08-03
delta-verification pass did not catch.

**C2 — filed as its own bug, not this change's defect.** `BLOCKING-4`'s verdict in
`test/project-layout-artifact-routing.test.js` depends on an untracked, gitignored file:
`:1836` skips any citation whose target is absent, and `.gitignore:28` ignores
`_bmad-output/methodology/`. Clean worktree 59/0, dirty parent 58/1. The guard therefore
treats "absent" as legitimate — which is precisely the **CI** state — giving it a permanent
blind spot for exactly the class of citation it exists to catch. See
`bug-blocking-4-citation-guard-is-blind-in-ci.md`.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/`, `bin/` and the PRD are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
