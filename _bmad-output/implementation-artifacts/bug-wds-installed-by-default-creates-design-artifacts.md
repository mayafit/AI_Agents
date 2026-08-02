---
type: bug
severity: medium
title: The default --modules set installs every bundled module, so wds installs for everyone and scaffolds design-artifacts/ in projects that never asked for UX tooling
---

# Bug: The default `--modules` set installs every bundled module, so `wds` installs for everyone and scaffolds `design-artifacts/` in projects that never asked for UX tooling

**Status:** backlog
**Severity:** medium
**Affected Component:** `bin/cli.js#selectBmadModules` (the no-flag default branch); `lib/bmad.js#getInstallableBmadModules`; requirement **FR123** (and **FR249**, which reuses FR123's set)
**Classification:** REQUIREMENTS CHANGE (needs a PRD amendment) + a follow-on code change

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

**FR123** (`_bmad-output/planning-artifacts/prd/capabilities/bmad-integration-and-bundling.md:29`):

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
  (`prd/capabilities/bmad-integration-and-bundling.md:38`, "the same default set
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
  — FR123 (`:29`), FR249 (`:38`) — **the text that must be amended, NOT edited here**

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

- **FR123** (`prd/capabilities/bmad-integration-and-bundling.md:29`) must be amended:
  the "default install set is every non-retired module from the bundled cache
  manifest" clause is precisely the behaviour being rejected.
- **FR249** (`:38`) inherits FR123's set by reference for global installs and must be
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

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/`, `bin/` and the PRD are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
