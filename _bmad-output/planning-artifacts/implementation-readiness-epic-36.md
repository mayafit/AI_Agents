# Implementation Readiness Review — F27 / Epic 36 (P5-11 hard gate)

**Scope:** Epic 36 only (stories 36.1–36.7), the gate that opens the P5-11 decomposition (Epics 37–39).
Requirements reviewed: FR271 am. (in `prd/capabilities/bmad-integration-and-bundling.md:65`), FR277–FR284
(`prd/capabilities/bmad-platform-currency.md:38-54`), NFR74 am. (`bmad-platform-currency.md:170`), plus the F28
items the stories cite as premises (FR269 am., FR285–FR294, NFR84 am., NFR86). Epics 37–39 are scope contracts
only; they are checked for forward dependencies, not for readiness.
**Inputs:** `sprint-change-proposal-2026-11-07.md` (incl. Errata); PRD shards above; Decision P5-11
(`architecture/decisions/bmad-integration-and-bundling.md:200-243`); `implementation-patterns.md` "Phase 5 v7
Module Patterns" (`:224-243`); `structure-and-boundaries.md` "Target Structure after P5-11" (`:113-158`);
`epics.md` Epics 36–39 + Cross-Epic Notes (`:5945-6039`) and the SUPERSEDED annotations on 32–35
(`:5846`, `:5871`, `:5893`, `:5916`, `:5936`); `implementation-artifacts/36-1…36-7`; `sprint-status.yaml:504-536`;
`adversarial-review-extension-split-2026-10-31.md`; `adversarial-review-v7-alignment-2026-11-07.md`; upstream
BMAD-METHOD at `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (local evidence pack + `gh api` fetches of
`render_skill.py`, `migrate_v6.py`, `tickets.py`, `validate_manifests.py`, `tests/test_validate_manifests.py`,
`bmad-project-context/{SKILL.md,references/template.md}`, `README.md` and four `customize.toml` files).
**Reviewed:** 2026-11-07, worktree `D:\Code\AI_Agents-extension-split`, branch
`docs/sprint-change-proposal-extension-split` at `aa0e06b`.
**Method:** two-direction traceability at AC level; gate-question coverage against SCP §4.4 and the Errata;
disposition of every finding in both adversarial reviews that touches Epic 36; Blocked-on vs wave list vs
`sprint-status.yaml`; `6.12.4` grep; 70 `path:line` citations checked (41 in the sample table below).

---

## Verdict

> ## READY WITH CONDITIONS
>
> **36.1 and 36.2 can start once C-1 and C-2 are applied to 36.1's AC text** (two short edits; 36.2 needs
> nothing). C-3 must be settled before 36.6 starts; C-4 before this planning PR merges.

The epic is well built. Every claimed requirement traces to a measurable AC, every AC records its result in a
named file, and no story depends on Epic 37–39 content: every cross-epic link is a hand-off (36.1 AC9 → 37.3/38.5,
36.4 AC4 → 38.3, 36.5 AC8 → 37.2), never an input. The `[v7-carries]` / `[pre-release-only]` tagging directly
answers v7-review finding 18, and 36.7 gives FR281 a concrete GO line. Of 70 citations checked, 68 are exact,
one is imprecise and one is wrong (C-2).

The two findings that matter most are about evidence the gate would record without being able to decide it.
First, FR283 says "no network access is attempted", and 36.1 AC2 records network attempts but still passes on
exit 0 (C-1). Second, 36.6 AC9 asks for a v7 runtime proof from a registry install of a package that, by
36.3 AC5 and 36.6 AC8, still installs bmad-method 6.10.0 (C-3).

| # | Condition | Discharged by | Must be settled before |
|---|---|---|---|
| C-1 | Make 36.1 AC2's offline PASS decide FR283's "no network access is attempted", and not only exit 0 | 36.1 AC2 text | **36.1 starts** |
| C-2 | Fix 36.1 AC9's wrong citation (`migration-1.toml:155`) and add the Errata's story-ID collision question as an explicit, recorded check | 36.1 AC9 text | **36.1 starts** |
| C-3 | 36.6 AC9 cannot be executed as written. Restate it, or move the publish out of Epic 36 | PO decision → 36.6 AC9 (+ AC7) | **36.6 starts** |
| C-4 | P5-11.4 still names the slots that FR290 and the Errata removed. Align it with FR290 | Architect → P5-11.4 | **planning PR merges** |

### Exact edits that discharge each condition

**C-1. Edit 36.1 AC2.** Replace "PASS: exit 0 online and offline, no prompt. STOP: the local add needs the network or a TTY (FR283 has no basis)." with:

> PASS: exit 0 online and offline, no prompt, **and zero attempted outbound connections in the `--network none` run with every recorded opt-out env var set** (telemetry included; the capture method, e.g. `strace -f -e trace=connect` or a DNS sink, is recorded). FALLBACK: the add succeeds but makes an attempt that no env var disables. Each such attempt is listed in the change set for 39.2 and for the PM (FR283 wording). STOP: the local add needs the network or a TTY (FR283 has no basis).

Also add to the AC14 GO-39 line: "(AC2 offline PASS, or FALLBACK accepted by the PO)".

**C-2. Edit 36.1 AC9(b).** Replace "(`36-1`, `bug-*`; the dash-removal rule `migration-1.toml:155`)" with:

> (`36-1`, `bug-*`; the story-entry rule `migration-1.toml:129` (`id = M` per epic) and the story-file rule `:133` (`<N>-<M>-<slug>.md`)); **and list every pair of v6 keys or story files that map to the same (epic, id) or the same plan stem, two-digit epics included (`32-1-…` vs `3-21-…`). Expected none. Any collision is reported to the PO and handed to 37.3's `migration-1.toml`.**

Line `:155` is the `spec-<slug>/` + `stories.yaml` rule. No dash-removal rule exists in the file. A check on today's
74 `<N>-<M>-*` story files finds no collision, so the expected result is "none". The Errata still requires the
question to be asked.

**C-3. PO decision, then edit 36.6 AC9 (and AC7).** Under 36.3 AC5 and 36.6 AC8, `ma-agents install` on this line
still drives the v6 bmad-method 6.10.0 installer. 36.3's Dev Notes exclude the v7 snapshot from the npm package.
So a registry install produces no `_bmad/scripts/render_skill.py`, and "the 36.2 AC4(a) command against that
project's snapshot" has nothing to run against. Choose one:

> (a) AC9 becomes: "The pre-release is published (`npm publish --ignore-scripts --tag <dist-tag>`) and installed from the registry into a scratch project. `ma-agents --version`, `npm view ma-agents dist-tags` and the installed `package.json` `bmadRef` are recorded. The v7 runtime proof for this cut is AC4 (CI), not the registry install."
>
> (b) Delete AC7's publish clause and AC9. The first registry publish of the v7 line moves to 39.5. Epic 36 ends with a tagged commit, not a package.

With (a), the CHANGELOG known-limitations list must also say that this package installs bmad-method 6.10.0.

**C-4. Edit P5-11.4.** In the Confluence sentence (`architecture/decisions/bmad-integration-and-bundling.md:225`), replace
"set `external_handoffs` / `on_complete` on `bmad-prd`, `bmad-architecture`, `bmad-ux`, `bmad-product-brief`, `bmad-prfaq`, `bmad-facilitate`, and `external_sources` on `bmad-facilitate`, `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` (FR290)" with:

> set `on_complete` on `bmad-prd`, `bmad-architecture`, `bmad-ux`, `bmad-product-brief`, `bmad-prfaq`, `bmad-facilitate`, plus `external_handoffs` / `external_sources` where the target declares them (at the pinned commit: `bmad-prd`, `bmad-architecture`, `bmad-facilitate`). Targets without a read slot (`bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective`) carry the Confluence-read role in `activation_steps_prepend`. The bind table records the slot per target (36.1 AC10) (FR290)

Verified at `e734d3a`. `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective` and `bmad-prfaq`
declare only `activation_steps_prepend`, `on_complete` and `persistent_facts`. `bmad-prd`, `bmad-architecture` and
`bmad-facilitate` also declare `external_handoffs` and `external_sources`. The Errata says FR290 was corrected,
and it was. P5-11.4 was not, so the architecture now contradicts the PRD on the exact table Epic 38 will build.

### Counts at a glance

| Measure | Result |
|---|---|
| Claimed requirements traced to ≥1 story AC (FR271 am., FR277–FR284, NFR74 am.) | **10 / 10** (FR283, FR284 as premises only, delivered by 39.2; see Matrix 1) |
| Orphan requirements | **0** |
| Orphan ACs (no FR, decision or gate question behind them) | **0 strict**. Two soft cases: tea/cis pins (F-5), activation timing 36.2 AC6 (P5-11.6 UX risk, fine) |
| Stories / ACs | **7 / 73** (15 + 10 + 10 + 10 + 10 + 10 + 8) |
| ACs with a measurable pass criterion and a named record | **73 / 73**. Weakest: 36.1 AC2 (C-1), 36.1 AC3 (F-1), 36.6 AC9 (C-3), 36.5 AC8 (F-10) |
| Gate questions (SCP §4.4 + Errata) asked by an AC | **14 / 14** asked; **2** asked without a deciding criterion (C-1, C-2) |
| v7-review findings touching Epic 36 | **11 / 11** addressed or explicitly deferred (Matrix 3) |
| 10-31-review findings still live for Epic 36 | **9 / 10** addressed or moot; **1** neither (F-9: uv-missing detection) |
| Stories depending on Epic 37–39 content | **0** |
| Status: story headers vs `sprint-status.yaml` | **match** (36-1, 36-2 `ready-for-dev`; 36-3…36-7 `backlog`; `epic-36` `backlog`) |
| Blocked-on vs `epics.md` wave list | **match**, except one omitted edge (36.7 needs 36.6, F-7) |
| FR numbers cited vs the PRD | **all exist**. One NFR is mis-cited (nit 3) |
| "3.x runs 6.12.4" claims remaining | **0** in stories, P5-11, FR271, Epic 36–39 text, sprint-status. Stale 6.12.4 *rationale* remains in FR279 (F-8) and the F27 shard header (nit 1) |
| Citations checked | **70**: 68 exact, 1 imprecise, 1 wrong |

---

## Findings

### MEDIUM

#### F-1. 36.1 AC3's `pinned` PASS is unreachable with the fallback fixture

`bmad status` reports `pinned` only when the lock entry's `ref` is a SemVer tag (`setup.py:1882`, `SEMVER` at
`:43`) **and** the lock entry's source is the same repository as the record's `update_source` (`:1879`), and only
once a newer version exists. AC3 allows "a scratch fork or a local git remote with a tag". A local remote has a
lock source that is a path, while `update_source` is `github:…`, so `pinned_ref` returns `None`. The AC also never
says to publish a second, newer version. **Fix:** AC3 uses a scratch GitHub repository with `update_source =
"github:<owner>/<repo>/skills"`, tags `v0.1.0`, installs `#v0.1.0`, then pushes a record at `0.2.0` on `main`. AC3
should state that `pinned` is `github:`-only (input to AC7 and §4.6 decision 4). Without this, the spike can
record a false negative.

#### F-2. `bmad setup` runs `npx skills update` itself, and only a Dev Note covers it offline

`references/setup.md:37`: on update, setup runs `npx skills update -p -y`. 36.1's Dev Note asks for the offline
behaviour to be recorded "during AC7(b)", but no AC states it or gives it a pass criterion. FR282 and 39.2 (offline
setup through the bundle) depend on it. **Fix:** add to AC7(b): "[RUN] `setup.py` update path under `--network
none`: exit code, whether `npx skills update` is attempted, and wall time (a hang over 60 s is a finding)".

#### F-3. FR283 attributes the Skills CLI version to the pinned commit, which does not pin it

FR283 ("1.7.6 at the pinned commit"), P5-11.6 and SCP §1 treat `skills` 1.7.6 as part of the target. The tree at
`e734d3a` pins no Skills CLI version: `setup.py` emits bare `npx skills add|update` (`:1066`, `:1077`), and neither
`package.json` nor `pyproject.toml` names it. 1.7.6 is the npm version observed on 2026-11-07. 36.1 AC1 correctly
records it as observed ("expected 1.7.6"). **Fix:** reword FR283 as "pinned by ma-agents in `bmadRef` (1.7.6
observed 2026-11-07; recorded by 36.1 AC1)", and have 36.3 AC1 add `bmadRef.skillsCli`. This also makes C-1 more
pressing: an unpinned `npx skills` from upstream's own setup flow will try the registry.

#### F-4. 36.4 AC2 fails on day one if read literally

"Agents carry `activation_steps_*` and `persistent_facts` under `[agent]`". The four
`lib/bmad-extension/skills/ma-agent-*/customize.toml` files declare `[agent]` (`:12`) and `persistent_facts`
(`:18`) but **no** `activation_steps_*`. Only `bmad-dev-epic` (a workflow) has them (`:10-11`). **Fix:** "…carry
`persistent_facts` under `[agent]`, and `activation_steps_*` there **where present**. No such key appears under
the other table." m2 still kills the mutation.

### LOW

- **F-5. tea/cis pins have no requirement.** 36.1 AC12, 36.3 AC1/AC3 and 36.7 AC3 pin `bmadRef.modules`
  tea/cis tags. The source is SCP §4.1 and `structure-and-boundaries.md:151`, but FR280/FR282 name only the
  BMAD-METHOD commit. This is the same shape as Epic 32's C-8 (engines). **Fix:** add to FR280: "…plus the tea
  and cis module repositories at the tags recorded in `bmadRef.modules` (or none, if 36.1 AC12 records
  FALLBACK)".
- **F-6. 36.6 AC7's maintenance branch has no owner.** "If none exists, the gate is FAIL", but no story creates a
  `3.18.x` branch from `v3.18.1`, and T6 only "confirms" it. **Fix:** T6 creates it if it is absent, with PO
  approval, and records the name. Alternatively, name the owner (release owner) in the Epic 36 dependencies.
- **F-7. GA re-gate scope and edge.** P5-11.10, `epics.md:5959` and the `sprint-status.yaml:533` comment say
  36.7 re-runs "36.1 + 36.2". Story 36.7 also re-runs 36.4, 36.5 and the 36.5 AC8 adopt run (AC6), which is
  better. Its `Blocked on:` lists only "v7 GA", while its Wave line, AC3 (36.3 plumbing) and AC5 (36.6 AC4 CI job)
  need 36.6. **Fix:** `Blocked on: v7 GA, 36-6`, and widen the three summaries to "36.1, 36.2, 36.4, 36.5".
- **F-8. FR279's rationale still cites 6.12.4.** FR279 says "matching bmad-method v6.12.4" (`bmad-platform-currency.md:54`).
  The requirement stands, but 36.3 AC6 derives the floor from the v7 snapshot or the Skills CLI. **Fix:** a
  dated note: "floor = the higher of 20.12.0 and the Skills CLI / v7 floor recorded by 36.1 AC1".
- **F-9. Missing-uv detection for the v7 line is neither covered nor deferred** (10-31 review finding 28). FR277
  makes uv a prerequisite. 36.2 documents it, but no AC detects a missing uv at install or activation, and the
  Epic 39 wave text does not mention it. **Fix:** add "post-install uv/Python check (warn, exit code unchanged)"
  to 39.2's wave line, so the deferral is explicit.
- **F-10. 36.5 AC8 is a single LLM run.** One `adopt` run with "the default proposal" may pass by chance.
  **Fix:** two runs in fresh sessions, with the tool and model recorded. A divergence between them is itself a
  finding for the PO.
- **F-11. Process note.** This review runs `bmad-check-implementation-readiness`, which is retired in v7
  (`skills/bmod-method/retired.toml`). Once `bmad migrate method` moves this project to the ticket tree, the
  readiness checks for Epics 37–39 need a home (Sofia `validate` is the candidate). 36.1 AC9's report should
  say whether the `validate` slot covers the PASS / CONCERNS / FAIL gate this repository relies on.

### Consistency nits (housekeeping, non-blocking)

1. `prd/capabilities/bmad-platform-currency.md:7-8` ("only the FIRST block below describes the version actually
   installed") and `:16` ("F27 (v6.12.4, current)") are stale. The first block is now the v7 *target*, and 3.x
   installs 6.10.0.
2. `prd.md:48` heads a paragraph "F27 — BMAD v6.12.4 Integration (latest-only)". The amendment follows at
   `:59`. Add "(superseded, see below)" to the heading.
3. 36.4 cites **NFR56** for "fail loud", but NFR56 is the thin-cache guard of `build-bmad-cache.js`. Cite the
   AC1 prerequisite rule instead, or drop the NFR.
4. 36.1 Dev Notes, 36.2 AC4 and 36.6 Dev Notes cite `.github/workflows/offline-install.yml:44-53` for the pinned
   digest. Those lines are the explanatory comment; the pin itself is at `:68` (`OFFLINE_NODE_IMAGE`).
5. The snapshot path is `lib/bmad-v7-cache/` in 36.3 AC3 but `bundle/bmad-method-skills/` in
   `structure-and-boundaries.md:151`. The tree is labelled indicative; 36.3 should record which name 39.1 inherits.
6. The local evidence pack's `bmad-v7-evidence/validate_manifests.py` is byte-identical to upstream
   `skills/bmad/scripts/tests/test_validate_manifests.py`, not the validator. The stories cite the correct
   upstream paths. Only the scratch copy is mislabelled.
7. The `epic-36` FR coverage (`epics.md:5961`, `sprint-status.yaml:526`) lists FR283/FR284 without saying they are
   proven as premises here and delivered in 39.2. Add "(premise)".

---

## Confirmations (checks that passed)

- **The 6.10.0 correction is applied everywhere it must be.** `grep 6.12.4` over the seven stories finds only
  36.3's correct note (`:17`) and 36.5's "6.12's writer" contrast. P5-11.5 (`:227`), FR271 am. (`:65`), the
  `bmad-platform-currency.md` amendment (`:26-28`) and the Epics 36–39 Cross-Epic Notes (`:6036`) all say 3.18.1
  pins 6.10.0. This matches `package.json:35` and `lib/bmad.js:2830`. `sprint-status.yaml:522-536` carries no
  6.12 claim.
- **Supersession is annotation-only.** The `epics.md` diff for `aa0e06b` is 109 insertions and 1 deletion (the
  `lastEdited` front matter). Epics 32–35 carry a SUPERSEDED line and are otherwise byte-identical, with no
  line-ending churn (10-31 finding 38 not repeated). `sprint-status.yaml` 32-x and epic-32…35 are `cancelled`
  with reasons.
- **Statuses are honest.** Only 36.1 and 36.2 are `ready-for-dev`. 36.3–36.6 are `backlog` with
  `Blocked on: 36-1` (36.6 on all five). This closes 10-31 finding 37's pattern.
- **Upstream mechanics are cited to scripts, not docs.** 36.1's four "most likely to fail" premises
  (`references/setup.md:47`, `setup.py:1060-1066`, `module-files.md:65`, `bmad-build/SKILL.md:12` +
  `render_skill.py:4`) all check out at `e734d3a`. So do the validator's negative controls: `vm.py:70` (missing
  `bmod.toml`), `:211` (folder not named after code), `:222` (one version line), and no prefix rule.
- **The air-gap proof is non-vacuous.** 36.2 AC5 has three controls, including the warm-cache control that proves
  `--no-cache` ignores the cache. 36.1 AC11 repeats it on its own. 36.6 AC4 puts it in CI.
- **The CI job will not be permanently red** (10-31 finding 31). 36.6 AC3 adds a per-file runner, a bug-keyed
  allowlist that also fails on stale entries, and a required-check decision recorded before PASS.
- **3.x is protected.** 36.3 AC5 leaves the v6 builder untouched. 36.4 AC8 leaves the 6.10 resolver strings
  untouched. 36.6 AC5 asserts the 41/9/46 preflight counts unchanged. 36.6 AC7 cuts no 3.x version.
- **No forward dependency.** Every Epic 37–39 mention in the stories is a hand-off, and every Out-of-scope list
  names the later epic.

---

## Matrix 1 — Requirement → Story traceability

| Req | Summary | Stories | Anchor ACs |
|---|---|---|---|
| FR271 am. | One line: v7 at a pinned commit, `bmadRef` + `BMAD_TARGET_REF`; 3.x on 6.10.0 for fixes | 36.3, 36.6 | 36.3 AC1, AC2; 36.6 AC5, AC7, AC8 |
| FR277 | uv + Python ≥ 3.11 prerequisite; owned guidance `uv run` | 36.2, 36.3, 36.4 | 36.2 AC3–AC5, AC8; 36.3 AC7–AC9; 36.4 AC1 (gap: F-9) |
| FR278 | Owned TOML validated; `persistent_facts`; `{diff_file}`; `AGENTS.md` two-writer | 36.4, 36.5 | 36.4 AC1–AC8; 36.5 AC1–AC9 |
| FR279 | Node engines ≥ 20.12 | 36.3, 36.6 | 36.3 AC6; 36.6 AC5, AC8 (rationale: F-8) |
| FR280 | Pinned SHA only; verdict per SHA | 36.1, 36.3, 36.6, 36.7 | 36.1 AC1, AC14; 36.3 AC1–AC4; 36.6 AC1, AC5; 36.7 AC3 |
| FR281 | GA qualification gate; pre-release until then | 36.6, 36.7 | 36.6 AC7, AC8 (stated); 36.7 AC1–AC7 |
| FR282 | uv + Python + wheelhouse; five scripts `--no-cache` offline | 36.1, 36.2, 36.6, 36.7 | 36.1 AC11; 36.2 AC1–AC10; 36.6 AC4; 36.7 AC5 |
| FR283 | Vendored Skills CLI; local `npx skills add`; no network | 36.1 (premise) | 36.1 AC1, AC2 (C-1), AC3, AC4, AC13 |
| FR284 | Headless setup via `--module-answers`; printed fallback | 36.1 (premise) | 36.1 AC5 (FALLBACK path defined) |
| NFR74 am. | Shipped skill scripts via `uv run`; installer CLI stays Node | 36.2, 36.3 | 36.2 Dev Notes + AC9 (pure-Node test); 36.3 AC7, AC8 |
| Premises for 37–39 | FR269 am., FR285–FR287, FR289–FR292, FR294, NFR84 am., NFR86 | 36.1 | AC2–AC10, AC12, AC13 |

**Reverse direction:** every AC traces to one of the above, to a gate question (Matrix 2), or to a decision
(P5-11.5/.6/.10). The two soft cases are 36.3 AC1's `modules` (F-5) and 36.2 AC6's timing (P5-11.6 UX risk). Both
are acceptable.

## Matrix 2 — Gate questions → 36.1 / 36.2 AC

| Source | Question | AC | Deciding criterion? |
|---|---|---|---|
| §4.4 | `npx skills add` local folder / tag | 36.1 AC2, AC3 | yes; AC2 offline: **C-1**; AC3 fixture: F-1 |
| §4.4 | `bmad setup` via `--module-answers` | 36.1 AC5 | yes (PASS / FALLBACK) |
| §4.4 | `validate_manifests.py` on `bmod-ma-ops` fixture | 36.1 AC6 | yes, with negative controls |
| §4.4 | prefix handling | 36.1 AC6 (`bmad-foo` passes) | yes |
| §4.4 | `https://` update source (on-prem Git) | 36.1 AC7(a) | yes |
| §4.4 | `file:` channel on `bmad status` | 36.1 AC7(b) | yes (setup's own `npx skills update`: F-2) |
| §4.4 | Sofia custom store | 36.1 AC8 | yes |
| §4.4 | `migrate_v6.py` on a real 3.18.1 copy | 36.1 AC9 | yes (report) |
| §4.4 | five scripts offline; recipe; enumerator | 36.2 AC1–AC8 | yes |
| Errata | tea/cis tags with v7 records | 36.1 AC12 | yes (PASS / FALLBACK) |
| Errata | `.agents/skills` + `skills-lock.json` vs `.ma-agents.json` | 36.1 AC13 | yes |
| Errata | Skills CLI network calls on a local install | 36.1 AC2 | **recorded, not decided → C-1** |
| Errata | `source` fixed at publish time | 36.1 AC7(c) | yes |
| Errata | `--module-answers` rejects re-sent answers | 36.1 AC5 (`setup.py:2202-2211`) | yes |
| Errata | story-ID collision, two-digit epics | 36.1 AC9 | **not asked; wrong cite → C-2** |

## Matrix 3 — Adversarial-review findings touching Epic 36

| Review finding | Disposition |
|---|---|
| v7 #1 plan never mentions v7 | Addressed: FR271 am., FR280–FR284, Epic 36 |
| v7 #3 thin installer has nothing to stage | Premises in 36.1 AC2/AC5/AC12; build deferred to 39.1 |
| v7 #4 `--no-cache` defeats warm cache | Addressed: 36.1 AC11, 36.2 AC4/AC5, 36.6 AC4 |
| v7 #5 `ma-sprint` on a file v7 drops | Deferred (P5-11.8, FR292); migration input 36.1 AC9 |
| v7 #7 per-target slots | Addressed: 36.1 AC10 matrix, 36.4 AC4 validator (P5-11.4 text: **C-4**) |
| v7 #8 Jira as a Sofia store | Addressed: 36.1 AC8; built in 38.2 |
| v7 #9 binding spine writes a deleted file | 36.1 AC9(a) records `LEGACY_LEFTOVERS`; built in 38.5 (FR293) |
| v7 #10 `bmad-facilitate` slots | Addressed: 36.1 AC10 includes it |
| v7 #14/#15/#16 naming, one version, roster | Addressed: 36.1 AC6 fixture + controls |
| v7 #18 v6-only gate ACs | Addressed: `[v7-carries]` / `[pre-release-only]` tags on every AC |
| v7 #11/#12/#13/#17/#19 | Deferred to 37.3/37.5 or settled in SCP §3/§4.1; no Epic 36 AC needed |
| 10-31 #24 three writers to `AGENTS.md` | 36.5 AC9 (INJECTION_FILES) + AC8 → 37.2 |
| 10-31 #25/#26 vanilla offline; single-module `-y` | 36.1 AC2 offline, AC4 |
| 10-31 #27 wrong scripts in air-gap spike | 36.2 AC4 (five scripts) |
| 10-31 #28 uv prerequisite never detected | **Not covered, not deferred → F-9** |
| 10-31 #30 non-reproducible `bmb` tag | Moot (bmb gone); tea/cis pinned in `bmadRef.modules` |
| 10-31 #31 permanently red CI | 36.6 AC3 allowlist + required-check record |
| 10-31 #37 blocked stories marked startable | Fixed (36.3–36.6 `backlog`) |
| 10-31 #38 CRLF churn in `epics.md` | Not repeated (109+/1−) |
| 10-31 #23 3.x migration | 36.1 AC9, AC13 → 39.3 |

---

## Citation sample (41 of 70 checked)

Upstream rows were checked against `e734d3a` (evidence pack, plus `gh api` fetches into scratchpad `ir36-upstream/`).
Repository rows were checked with `sed -n` in the worktree at `aa0e06b`.

| # | Cited in | Citation | Claim | Result |
|---|---|---|---|---|
| 1 | 36.1 AC7 | `setup.py:31` | `file:` accepted as update source | ✓ `UPDATE_SOURCE_PREFIXES` |
| 2 | 36.1 AC5 | `setup.py:177` | `--module-answers` flag | ✓ |
| 3 | 36.1 AC2 | `setup.py:639-645` | reads `skills-lock.json` | ✓ |
| 4 | 36.1 Context, AC7 | `setup.py:1051-1066` | `file:` → `local`; install cmd only for `github:` | ✓ |
| 5 | 36.1 AC3 | `setup.py:1869-1882` | `pinned` state | ✓ (SemVer + same-repo conditions: F-1) |
| 6 | 36.1 AC7 | `setup.py:1916-1939` | `/<folder>/bmod.toml` appended; relative `file:` vs root | ✓ |
| 7 | 36.1 AC7, 36.2 | `setup.py:1945-1958` | 10 s timeout fetch | ✓ |
| 8 | 36.1 AC5 | `setup.py:2202-2211` | "not a pending question" / missing answer | ✓ |
| 9 | 36.1 Dev Notes | `references/setup.md:37` | setup runs `npx skills update -p -y` | ✓ |
| 10 | 36.1 AC5 | `references/setup.md:41-47` | answers-file shape | ✓ |
| 11 | 36.1 Context, AC7 | `docs/reference/module-files.md:65` | member `source` = record `update_source` | ✓ |
| 12 | 36.1 AC3 | `docs/customize/add-modules.md:43` | `pinned` from a tag | ✓ |
| 13 | 36.1, 36.2, 36.3 | `skills/bmad-build/SKILL.md:12` | `uv run --no-cache … render_skill.py` | ✓ |
| 14 | 36.1, 36.2 | `skills/bmad/scripts/render_skill.py:4` | `jinja2>=3.1` | ✓ |
| 15 | 36.2 Context | `skills/bmad-agent-po/scripts/tickets.py:4` | `pyyaml>=6.0.2,<7` | ✓ |
| 16 | 36.1 AC6 | `tests/test_validate_manifests.py:251` | different-versions negative | ✓ |
| 17 | 36.1 AC8 | `read_store.py:47-58` | project file used whole when no starter | ✓ |
| 18 | 36.1 AC8 | `references/store-setup.md:9` | "bring their own config file or url" | ✓ |
| 19 | 36.1 AC9 | `migrate_v6.py:62`, `:76` | `LEGACY_LEFTOVERS`, `V6_KEYS` | ✓ |
| 20 | 36.4 Context | `migrate_v6.py:89`, `:106` | `RETIRED_CUSTOM_KEYS`, `MOVED_CUSTOM_KEYS` | ✓ |
| 21 | 36.1 AC9 | `migrate_v6.py:1025` | `--clean` is the only writer flag | ✓ |
| 22 | 36.1 AC9 | `migration-1.toml:151` | `sprint-status.yaml` archived unchanged | ✓ |
| 23 | 36.1 AC9 | `migration-1.toml:155` | "dash-removal rule" | **✗ WRONG**: spec-folder rule; id rule is `:129`/`:133` (C-2) |
| 24 | 36.2 Context | `migration-1.toml:191` | `_bmad/method/scripts/tickets.py` | ✓ |
| 25 | 36.1 AC9 | `migration-1.toml:209` | `tickets.py status` exits 0 check | ✓ |
| 26 | 36.1, 36.4 | `bmad-agent-po/customize.toml:7`, `:15-21`, `:72-103` | `[agent]` hooks; 14 named `[workflow]` slots | ✓ |
| 27 | 36.4 Context | `bmad-build/customize.toml:13`, `:27`, `:49`, `:102-103` | `[workflow]`, empty facts, `on_complete`, `{diff_file}` | ✓ |
| 28 | 36.5 | `bmad-project-context/references/template.md:17`, `:18`, `:52` | markers, provenance line | ✓ |
| 29 | 36.5 | `bmad-project-context/SKILL.md:29`, `:72`, `:97` | adopt / splice / `CLAUDE.md` → `@AGENTS.md` | ✓ |
| 30 | 36.7 Context | `docs/start/install-bmad.md` | "preview alpha … ETA mid-November 2026" | ✓ (`:9`) |
| 31 | 36.3 | `package.json:35`, `:57-58` | `6.10.0`; `>=16.0.0` | ✓ |
| 32 | 36.3 | `lib/bmad.js:2830`, `:1000`, `:1193` | constant and its only two uses | ✓ (grep: 3 hits total) |
| 33 | 36.3 | `test/bmad-version-bump.test.js:540-543` | lockstep test | ✓ |
| 34 | 36.3 | `scripts/build-bmad-cache.js:60`, `:95`, `:266`, `:363`, `:398` | allowlist, resolve, branch default, clone, describe | ✓ |
| 35 | 36.3 | `test/uv-transition-resilience.test.js:24-27`, `:194`, `:208`, `:123/138/156/167` | header; two guards; NFR59 tests | ✓ |
| 36 | 36.3 AC9 | `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md:135` | `python3 … resolve_customization.py` (the only such site) | ✓ |
| 37 | 36.5 | `lib/agents.js:313`; `lib/installer.js:1332`, `:1335`, `:1345` | registry; merger; yes mode; leading comment | ✓ |
| 38 | 36.5 | `lib/uninstall.js:45-51`, `:58-62`, `:220-224` | INJECTION_FILES; non-greedy regex; delete-if-blank | ✓ |
| 39 | 36.4 | `lib/confluence-publish-hook.js:139-145`, `:173`, `:985`, `:1007-1009`, `:1526`; `bin/cli.js:1466`, `:1581`, `:1618` | five stores, key, builder, 6.10 parse note, entry | ✓ |
| 40 | 36.6 Context | `test/release-gate-epic-31.test.js:1153/1178/1917/2360/2363`; `routing:1929`; `page-tree:2291/2428`; `publish-hook:4027/4040`; `publish-hook:145` | pinned 41/9/46 counts; interpreter list | ✓ (all 11) |
| 41 | 36.1, 36.2, 36.6 | `.github/workflows/offline-install.yml:44-53` | pinned `node:20.18.1-bookworm` digest | **~ imprecise**: comment block; pin at `:68` (nit 4) |

Also checked and correct, not tabled: `package.json:3`, `:11` (110 chained files) and `README.md:364`; the five
owned `customize.toml` files; `lib/bmad-cache/cache-manifest.json:3-4`; the `.github/workflows/` set (3 files, no
uv); and `bug-npm-test-windows-suite-health-chain.md`.

---

## Scope realism: can 36.1 and 36.2 start today with only these files?

**Yes, after C-1 and C-2.** 36.1 needs Docker, Node 20, git, uv, `gh` and network. Every command, flag and
upstream line it names exists at `e734d3a`, and its fixtures are specified down to file names. The one fixture
gap (F-1) would show up during the run, not block it. 36.2 is self-contained: it falls back to a scratch checkout
until 36.3's snapshot exists, its Docker base is already pinned in this repo, and its only cross-story touchpoint
(the snapshot path) is flagged in both stories' Dev Notes. Neither story needs Epic 37–39 content.

## Recommended order of operations

1. **Now:** apply **C-1** and **C-2** to 36.1 (AC2, AC9, AC14). 36.1 and 36.2 start. Fold **F-1** and **F-2** into
   36.1 at the same time (each is a sentence).
2. **Before this planning PR merges:** **C-4** (P5-11.4), plus F-3, F-5 and F-8 (PRD wording) and nits 1–2.
3. **Before Wave 1 (36.3–36.5):** F-4 (36.4 AC2 wording). 36.3 records the snapshot-path name (nit 5).
4. **Before 36.6:** the **C-3** PO decision, plus F-6 (maintenance-branch owner).
5. **Before 36.7:** F-7 (`Blocked on: v7 GA, 36-6`) and F-10 (two adopt runs). Before Epic 39 is storied: F-9.

## Conditions discharged 2026-11-07

| Condition | Applied |
|---|---|
| C-1 | 36.1 AC2 PASS now requires zero attempted outbound connections under `--network none` with opt-outs set; FALLBACK path added; AC14 GO-39 line amended. |
| C-2 | 36.1 AC9(b) cites `migration-1.toml:129` / `:133` and adds the recorded two-digit-epic collision check (expected none). |
| C-3 | Option (a) applied to 36.6 AC9: registry install records version, dist-tags and `bmadRef`; the v7 runtime proof is AC4 (CI); CHANGELOG states the pre-release installs bmad-method 6.10.0. **PO may still choose option (b)** (no publish before 39.5); AC7 unchanged. |
| C-4 | P5-11.4 Confluence sentence aligned with FR290 (slots per target at the pinned commit; `activation_steps_prepend` fallback). |

Findings F-1…F-11 and the nits remain open for the story owners; none blocks 36.1 or 36.2.
