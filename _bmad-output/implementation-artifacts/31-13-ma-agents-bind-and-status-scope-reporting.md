# Story 31.13 — `ma-agents bind`, plus scope reporting in `ma-agents status`

**Epic:** 31 — Global Installation & Federated Knowledge Stores
**Requirements:** FR252, FR253; NFR78, NFR83; Decision P5-9.3, P5-9.4, P5-9.8
**Acceptance criteria (authoritative):** `_bmad-output/planning-artifacts/epics.md` lines 5564–5587
**Base:** `875213c` · **Branch:** `feature/epic-31-story-31.13`
**Status:** review (implementer does not set `done`)

---

## 1. What shipped

| File | Change |
| --- | --- |
| `lib/bound-projects.js` | **NEW.** The per-machine bound-project registry. Settles **OQ-1**. |
| `bin/cli.js` | `case 'bind':` dispatch; `handleBind`, `offerBind`, `bindOfferDecision`, `detectInstallScopes`, `describeBoundProjects`, `printScopeReport`; scope report wired into `showStatus`; help text. |
| `lib/installer.js` | `ensureManifest` back-fills `scope` on its **migrate** branch (handoff (c)); `GLOBAL_BIND_OFFER_HEADER`'s last two lines corrected — they claimed `ma-agents bind` did not exist yet, which **this story made false**. |
| `test/project-layout-bind.test.js` | **NEW**, 57 tests. |
| `test/project-layout-config-generation.test.js` | Story 31.3's generation-call-site pin widened 2 → 3 sites and **strengthened from a count to an identification** (see §6). |
| `package.json` | New suite registered in the `npm test` chain, additively. |

No skill document, no `lib/bmad-extension/**`, no PRD, no `epics.md`, no Decision P5-9 was touched.

---

## 2. OQ-1 — SETTLED, as a story-level decision

> **Decision: the bound-project record lives at `~/.ma-agents/bound-projects.json`**
> — `path.join(os.homedir(), '.ma-agents', 'bound-projects.json')`.

This is recorded the way Story 31.8 settled OQ-4: **a decision this story makes and owns**, not a
requirement discovered in the PRD. No FR and no part of Decision P5-9 names a location; AC8
*constrains* one without *locating* it. The full rationale lives in the header of
`lib/bound-projects.js` and is pinned by a test that fails if it is removed.

**Why here, and not the three obvious alternatives:**

| Candidate | Rejected because |
| --- | --- |
| the project's `_bmad-output/` | Committed by design (`ensureBmadOutputTracked`). AC8's "not written into any project's committed artifacts" would be violated outright. |
| the project-root `.ma-agents.json` | A *project* file. A per-machine list of *other* projects has no business in it. |
| a global skills directory | These are **per agent** — there are ten. The registry would exist in as many copies as the user has agents, and they would disagree the moment one agent is uninstalled. |
| **`~/.ma-agents/`** ✅ | Per-machine via `os.homedir()`, which is the convention this codebase already uses for non-project state (`~/.bmad/cache/external-modules`, `lib/bmad.js:482`). Unreachable from any project root, so no `.gitignore` rule or `git add -A` can sweep it into a commit. Agent-independent. |

**Structural guarantee for AC8's fourth property.** `lib/bound-projects.js` has **no dependency on
the resolver, and the resolver has no dependency on it**. `require('../lib/bound-projects')` appears
at exactly one site — `bin/cli.js:44` — and its consumers are `handleBind`'s final step and
`printScopeReport`. Delete `~/.ma-agents/` and every bind, every generation and every skill preflight
behaves identically; `status` simply has no list to print. That is a property of the module graph,
not a promise.

---

## 3. AC-by-AC

**AC1 — only the project-scoped answers.** `handleBind` calls `collectRepoLayout` (`bin/cli.js`,
`handleBind` step 3) — Story 31.5's own flow, not a copy. A driven run asks exactly five questions:
the two store backends, the two store locations, and the sprint-management location. Pinned as five
literal strings, and separately pinned as *identical to what `collectRepoLayout` asks on its own*.

**AC2 — installs nothing.** A real `ma-agents bind --yes` in a sandbox produces exactly three files:
`_bmad-output/project-layout.yaml`, `_bmad-output/project-context.md`, `_bmad/bmm/config.yaml`. No
skill directory, no `SKILL.md`, nothing else under `_bmad/`. Bracketed by a planted-decoy control so
the detector's silence is not itself the finding.

**AC3 — the automatic offer.** Two halves, deliberately distinguished. The half that **reaches a
reader** is Story 31.4's preflight, embedded in every shipped skill document: its Step P2 halts on a
missing `project-layout.yaml` and names `ma-agents bind`. **This story's contribution to that half is
that the command now exists.** The **executable** half is `bindOfferDecision` (pure) plus `offerBind`
(prompts, `initial: false`), so "never runs bind without the user's choice" is a property of code.
`--yes` is honoured as a *refusal to offer*, never as acceptance.

**AC4 — idempotent (NFR78).** An already-bound project reports its bindings and, absent an explicit
edit, **does not write the binding at all**. `writeProjectLayoutYaml` refreshes `generated:` on every
write, so a rewrite is byte-identical only while two runs fall on the same calendar day — a
coincidence, not a guarantee. Proved by a sha256-per-file comparison of the whole project tree.

**AC5 — never overwrites `project-context.md`.** Stronger than the installer, which updates an
existing file's manifest paths in place: bind does not touch it at all. Proved against a
hand-written literal, with a control proving bind *does* generate one when absent.

**AC6 — regenerate `config.yaml`; never touch the user TOMLs.** Regeneration fires on **both** paths,
including the no-edit re-run — that is load-bearing, because Story 31.4's staleness HALT tells the
user to run `ma-agents bind` precisely to fix a config that drifted from an *unchanged* binding. It
does not break AC4: `generateBmmConfig` derives every field from the committed binding and carries no
timestamp, so an unchanged binding reproduces the same bytes (NFR81). `_bmad/config.user.toml` and
`_bmad/custom/config.user.toml` are compared byte-for-byte. **`config.user.yaml` does not exist** —
recorded explicitly rather than banked as a free green (§5).

**AC7 — status reports scope and bound projects.** `printScopeReport` runs **before** the
"no skills installed" early return, because a machine with a global install and no project-scope
skills is exactly the machine whose bound-project list the user needs. Each recorded root is joined
against `resolveProjectTopology` — the same resolver everything else uses — so a moved or deleted
project shows as `[missing]`, never as `[bound]`.

**AC8 — see §2.** Four properties, four tests, plus determinism, de-duplication, version,
entry-shape and path-identity invariants.

### The AC3 offer's CLI call site — and why it is `status`

`offerBind` is not a seam left dangling. An exported function nothing calls is the *presence, not
effect* shape this epic keeps producing, and it is exactly what left Story 31.11's AC6 offer with no
reader. The offer is therefore made from `showStatus` when — and only when — the install scope is
global and the current project has no committed binding: the one CLI moment at which the user is
asking about precisely that state. `yes` is derived from `process.stdin.isTTY`, so a piped or CI
`status` states the remedy and stops rather than prompting; it can never bind unasked. Three mutants
(M31/M32/M33) cover the call site, its scope gate, and the TTY derivation.

---

## 4. Handoffs

**(a) Story 31.4's HALT text now names an existing command.** Verified: `case 'bind':` dispatches,
and a test drives the *refusal* path (only `handleBind` can produce it) to prove the command is
reached rather than falling through to the interactive wizard. A second test extracts every
backticked `ma-agents <verb>` from the shipped preflight and asserts each has a `case` in
`bin/cli.js`.

**(b) 31.11's AC6 offer still has no reader — and this story does not claim to have fixed it.** Its
header remains in the global `MANIFEST.yaml` (NFR76 pins its presence), but a live test asserts that
**every** `MANIFEST.yaml` a shipped skill document cites is a `{project-root}` path — never the
global skills directory's manifest. The AC3 offer that reaches a reader is the one in the skill
documents themselves. The two lines of that header that claimed `bind` had not shipped were
corrected; the ordering `install` → `bind` that Story 31.11's suite pins is unchanged, and that suite
is still 26/26.

**(c) `ensureManifest` now back-fills `scope`** on its migrate branch, guarded so a caller supplying
no scope cannot erase a correct one. Three assertions: back-fill when missing, correct when stale, do
not erase.

---

## 5. Contradictions and gaps — reported, not resolved

1. **AC3 vs Story 31.4's pre-F26 branch.** AC3 says the offer fires whenever a globally-installed
   skill activates in a project with no `project-layout.yaml`. Story 31.4's Step P2 third branch
   *deliberately says nothing* for a genuine pre-F26 project (one with a `config.yaml` carrying none
   of the three F26 fields), for NFR76 backward compatibility. A globally-installed skill activating
   in such a project therefore gets **no offer**. Closing this would mean editing 41 byte-identical
   copies of a merged story's block to weaken its own AC. **Not done. Reported.**
2. **FR252's automatic offer is double-assigned** across 31.11 AC6 and 31.13 AC3 with no edge
   between the stories. Already noted by 31.11's reviewer; still unresolved at the planning level.
3. **`config.user.yaml` does not exist.** The sole mention in production source is a comment in
   `bin/cli.js` saying so. Any AC6 test written against it passes vacuously. Recorded in the suite,
   with a pin that fires if the name ever appears outside that comment.
4. **`test/project-layout-binding-spine.test.js`'s "remedy that EXISTS in this release"** asserts the
   `writeProjectLayoutYaml` refusal message does **not** mention `ma-agents bind`. That rationale
   expired with this story. The message was not changed and the test still passes; a future story may
   want to relax it.

---

## 6. Testing

Green baseline re-confirmed at every suite named in the brief; all exit 0.

| Suite | Result |
| --- | --- |
| `project-layout-bind` (NEW) | **57 passed, 0 failed**, exit 0 |
| `project-layout-config-generation` | 32 passed, exit 0 (pin amended, see below) |
| `project-layout-binding-spine` | 69, exit 0 |
| `project-layout-staleness-guard` | 61, exit 0 |
| `project-layout-artifact-routing` | 59, exit 0 |
| `project-layout-two-store-round-trip` | 52, exit 0 |
| `project-layout-legacy-single-store` | 51, exit 0 |
| `project-layout-confluence-configuration` | 38, exit 0 |
| `project-layout-enum-single-source` | 31, exit 0 |
| `project-layout-two-store-wizard` | 19, exit 0 |
| `global-install-scope` | 26, exit 0 |
| `generate-project-context` | 27, exit 0 |
| `bmad-extension` 29 · `plugin-manifests` 29 · `skill-authoring` 25 · `skill-validation` 21 · `skill-mandatory` 12 · `installer` 14 · `cli` 12 · `routing-parity` 9 · `config-layout` 6 | all exit 0 |

**The one existing test amended.** `project-layout-config-generation`'s AC3 pin required
`generateBmmConfig` to be called from *exactly two* production sites. Story 31.3's own AC — and that
test's own section heading — is "generation fires on **install and bind** only", and the file's
wrapper assertion already anticipated Story 31.13 by name. The count moves 2 → 3 and, more
importantly, becomes an **identification**: each call site is attributed to its enclosing function and
the set is compared against the literals `['handleBind', 'handleConfigLayout', 'installWizard']`. A
bare count of 3 would have been satisfied by any three sites, including a fourth added while one of
the expected three was deleted. The FR251 gating analysis is unchanged.

**`build:plugin`:** not required and not run. `git diff --name-only 875213c..HEAD` shows no file
under `lib/bmad-extension/` or `skills/`. The 41-copy / one-sha256 invariant is enforced by
`project-layout-staleness-guard`, which is green at 61/61.

---

## 7. Mutation testing

**33 mutants · 33 killed · 0 survivors.** Round 1 ran 30 mutants and killed 25; the 5 survivors were
closed by new tests and re-killed. A final full run of all 33 (M31-M33 added for the AC3 CLI call
site introduced afterwards) killed every one.

Run in a **byte-for-byte robocopy `/MIR /XJ` mirror** with a uniquely-named harness
(`mut-3113-runner.js` — the scratchpad is shared with a sibling agent). Every anchor was validated up
front against each file's **own** line endings (`bin/cli.js` and `lib/installer.js` are CRLF,
`lib/bound-projects.js` is LF; an LF-only anchor would have matched nothing in 22 of the 30 and
silently skipped them). The sandbox baseline was confirmed green before any mutant ran, and every
revert was sha256-verified against the pristine bytes.

| # | File | Mutation | R1 | R2 |
| --- | --- | --- | --- | --- |
| M1 | `bound-projects` | registry path cached at module load | KILLED | |
| M2 | `bound-projects` | project identity no longer case-folded | KILLED | |
| M3 | `bound-projects` | recording APPENDS instead of replacing | KILLED | |
| M4 | `bound-projects` | a damaged registry reports `absent` | KILLED | |
| M5 | `bound-projects` | registry version check removed | KILLED | |
| M6 | `bound-projects` | recorded list no longer sorted | KILLED | |
| **M7** | `bound-projects` | `normalizeProjectRoot` uses `realpathSync` | **SURVIVED** | KILLED |
| M8 | `bound-projects` | malformed entries no longer dropped | KILLED | |
| M9 | `cli` | an unreadable binding is OFFERED a fresh bind | KILLED | |
| M10 | `cli` | an already-bound project is offered a bind | KILLED | |
| M11 | `cli` | the offer AUTO-ACCEPTS under `--yes` | KILLED | |
| **M12** | `cli` | the offer treats anything not-`false` as acceptance | **SURVIVED** | KILLED |
| M13 | `cli` | bind proceeds over an unreadable binding | KILLED | |
| M14 | `cli` | a non-interactive re-bind re-answers and rewrites | KILLED | |
| **M15** | `cli` | the re-bind edit prompt defaults to YES | **SURVIVED** | KILLED |
| M16 | `cli` | bind OVERWRITES an existing `project-context.md` | KILLED | |
| **M17** | `cli` | bind does not regenerate `config.yaml` on a no-edit re-run | **SURVIVED** | KILLED |
| M18 | `cli` | bind never records the project in the registry | KILLED | |
| M19 | `cli` | bind writes an extra BMAD module tree | KILLED | |
| M20 | `cli` | bind installs a skill directory | KILLED | |
| M21 | `cli` | bind stops asking the sprint-management question | KILLED | |
| M22 | `cli` | install scope always reports `global` | KILLED | |
| M23 | `cli` | a MOVED project is reported as healthy | KILLED | |
| M24 | `cli` | an unreadable binding at a bound root reported healthy | KILLED | |
| M25 | `cli` | the listing is printed for a NON-global install | KILLED | |
| M26 | `cli` | the scope report is suppressed when no skills are listed | KILLED | |
| **M27** | `cli` | a lost registry and a damaged one print the same message | **SURVIVED** | KILLED |
| M28 | `installer` | the `ensureManifest` scope back-fill is removed | KILLED | |
| M29 | `installer` | the back-fill erases a recorded scope | KILLED | |
| M30 | `installer` | the global offer names `bind` before `install` | KILLED | |
| M31 | `cli` | the AC3 offer loses its production caller | KILLED | |
| M32 | `cli` | status offers the bind on a NON-global install | KILLED | |
| M33 | `cli` | the CLI offer prompts with no TTY attached | KILLED | |

**What the five survivors were, and what closed them** — each was a real gap, not a scoring artifact:

- **M7** — the registry recorded a link's *target* rather than the path the user bound. Closed by a
  junction/symlink fixture asserting the recorded root is `path.resolve(bound)`.
- **M12** — a **cancelled** prompt (`undefined`, what `prompts` returns on Ctrl-C) read as
  acceptance. Defect shape (a) exactly. Closed by a test that cancels the offer and proves, by
  byte-identity, that nothing was written.
- **M15** — the re-bind "change any of these answers?" prompt could default to YES and the AC4
  byte-identity test would still pass, because re-collecting and accepting every pre-population
  reproduces the same bytes on the same calendar day. Closed by asserting the prompt's `initial` is
  the literal `false`, *in addition to* byte-identity.
- **M17** — the most important one. Making regeneration conditional on an edit broke Story 31.4's
  HALT remedy in the one case it is written for, and nothing caught it. Closed by a test that damages
  `config.yaml` between two binds and proves the no-edit second run restores it byte-for-byte.
- **M27** — `absent` vs `unreadable` was discriminated in the data and collapsed in the output.
  Closed by comparing the two `status` renderings.

---

## 8. Fix round — the blocking defect, and what else it turned up

**Status stays `review`.** This round was implemented by a different agent from the one that wrote
the story; nothing here is a verdict on it.

### 8.1 The open question, answered FIRST: what Story 31.4's guard does to the half-bound project

**It HALTS.** Verdict `halt:binding-missing`, `silent: false`.

Reproduced against unmodified `47c6b8f`, then run through the **real** `runGuard()` — extracted
verbatim out of `test/project-layout-staleness-guard.test.js` and evaluated, rather than
re-transcribed, so the answer is about the guard that ships and not about a paraphrase of it:

```
markers: ["system_requirements_path","software_requirements_path"]
message: _bmad/bmm/config.yaml carries system_requirements_path, software_requirements_path,
         which only an F26 generation writes — so this project HAS been bound — but
         _bmad-output/project-layout.yaml is not here. Restore it, or run `ma-agents bind`
         to write a fresh one.
```

**So the blast radius is NOT larger than filed: the damage was contained and visible.** Three
findings worth recording anyway, because the containment is thinner than it looks:

1. **The orphaned config carries NO `project_layout_stamp`.** `generateBmmConfig`'s
   unbound-plus-fallback branch deliberately writes no stamp. Detection therefore rests entirely on
   the other two F26 marker fields. Had those not been written either, the config would carry **zero**
   markers, AC5's corroboration would classify it `proceed:pre-f26`, and a skill would have run
   silently against `.`-everywhere defaults.
2. **The halt message says "this project HAS been bound", which is false here** — it was never
   bound. The wording is right for the case it was written for (a deleted binding) and wrong for this
   one. Not changed: it is Story 31.4's text, byte-identical across 27 shipped copies.
3. **Its remedy is `ma-agents bind` — the command that created the state.** Before this round that
   was a loop. It is not any more, because bind now refuses instead of half-succeeding.

The scenario turns out to be independently pinned already, by two tests in 31.4's own suite
(`an UNBOUND project generated from a fallback layout carries NO stamp` and `and the guard HALTS on
it, because the per-store fields betray it`). That corroborates the finding rather than replacing it —
neither test was reached through `bind`.

### 8.2 The blocking fix — the write's outcome is now a VALUE

The root cause was **structural**, and fixing only `handleBind` would have reproduced it one layer
out. `writeProjectLayoutYaml` has five exits and returned `undefined` from every one of them; it
swallowed both I/O failures itself, which is why `handleBind`'s own `try/catch` — written for exactly
this hazard — was **dead code** on those paths.

It now returns one of five **named** outcomes, kept separate for the reason `BINDING_UNBOUND` and
`BINDING_UNREADABLE` are separate:

| Outcome | Exit | Bound? |
| --- | --- | --- |
| `wrote` | the write succeeded | **yes** |
| `unchanged-legacy` | Story 31.7 AC3/AC4 — legacy layout, nothing moved | **yes** |
| `refused` | the non-destruction guard would not overwrite | no |
| `failed-mkdir` | `_bmad-output/` could not be created | no |
| `failed-write` | `writeFileSync` threw | no |

`projectLayoutWriteIsBound` **enumerates the bound set and denies everything else**. The inverse
spelling (`!== failed-mkdir && !== failed-write`) would silently admit a sixth outcome as a success —
the same shape as the defect being removed — so it is written default-deny and mutant M5 proves the
difference is detected.

**"Skipped because legacy" and "failed to write" do not collapse.** They are distinct constants,
`unchanged-legacy` counts as **bound**, and mutant M3 (collapsing one into the other) is killed.

`handleBind` gates Steps 4 (config generation), 5 (`project-context.md`), 6 (registry) and the
`Bound.` line on that outcome, and sets `process.exitCode = 1`.

**The other call sites are untouched by construction:** a caller that ignores the return value sees
no change, and neither the installer's Step 3.6 nor `handleConfigLayout` was edited. Pinned by
`two-store-round-trip` 52/0, `binding-spine` 69/0, `legacy-single-store` 51/0 and
`config-lost-on-update`, all green.

### 8.3 The expired-wording audit — the review named three sites; there were FOUR

`bin/cli.js:2329`, `:2554` and `:4142` all promised `ma-agents bind` as *future work*, one of them to
a user running it right then. All three fixed.

The scan test written to cover them was then **mutated (M12) and survived** — proving the test was
vacuous. Its regex allowed one character between `a future ` and `ma-agents bind`; the source escapes
the command inside a template literal, so there are **two** (a backslash and a backtick). It matched
neither the original nor a reinstated one.

Repairing the regex immediately found the **fourth** site — `bin/cli.js:1062`, inside
`generateBmmConfig`'s no-binding-and-no-fallback branch. Fixed. The scan now reports zero across both
`bin/cli.js` and `lib/installer.js`, and mutants M12 and M14 are killed.

### 8.4 N1-N5 and the TTY pin

| | Disposition |
| --- | --- |
| **N1** | **Fixed.** Both shipped trees are walked (`lib/` ships `lib/bmad-extension/skills`, 114 `.md` / 14 preflight; `skills/` ships in its own right, 88 / 13). The floor is asserted **per root** — a union count would let one tree carry everything. A new test pins the root list against `package.json`'s `files` so a third tree cannot appear unnoticed. Mutants M13 and M18 (stripping the offer from one tree, then the other) are both killed; before the fix, M13 would have survived. |
| **N2** | **Fixed, and there were TWO copies.** `binding-spine:2007` was inverted. The review did not name the second: `staleness-guard:1271` carried the same expired claim, resting on the same false premise. Both rested on "in this release the installer is the only writer of the binding", which stopped being true when `case 'bind':` began dispatching. The shipped refusal now names `ma-agents bind` **and** keeps the installer as the alternative — the remedy is widened, not swapped. The staleness-guard test's real claim (that 31.4's guard did not reach into a different message) is preserved and now asserted directly. |
| **N3** | **Fixed as a CHECK, not as plumbing.** `handleBind`, `writeProjectLayoutYaml`, `readExistingLayout` and `collectRepoLayout` all re-derive `process.cwd()`; passing `projectRoot` into `handleBind` would have fixed one of four and left the write itself pointed at the cwd — worse than the disagreement. `offerBind` now verifies the two agree and refuses otherwise. Pinned behaviourally, with a control proving agreeing roots still bind. Mutant M10 killed. |
| **N4** | **Fixed, and the review's remedy alone was NOT sufficient.** The key now carries `initial` and a sha256 of the choice value/title pairs, and the stub captures `choices`. That was not enough: mutating a prompt's `initial` **still survived**, because parity compares bind's stream against `collectRepoLayout`'s and **both drivers run the same code** — a shared-wizard change moves both streams identically. Parity catches a divergent *copy*; only an **absolute** pin catches the wizard itself drifting. Added, on three independent axes (every prompt pre-selects index 0; that index *resolves* to `file-system`/`same`; each enum is pinned as offered). Mutants L1-L4 killed. |
| **N5** | **Justified, and the amplifying condition removed at the source.** The wholesale replacement of an `unreadable` registry is correct in isolation and the reasoning is sound — it is a rebuildable display cache, and refusing to record would let one damaged byte permanently blind `status`. The danger the review names is the **combination**, and that is gone: `recordBoundProject` is no longer reached at all on a failed bind. Fixing the registry policy instead would have left the real defect (calling it after a failed bind) in place while touching `lib/bound-projects.js`, whose status-only property the review confirmed sound. Pinned by a test asserting a failed bind registers nothing. |
| **TTY polarity** | **Pinned, and the review's prediction was wrong — the mutant is KILLED.** Pinned twice anyway: as text (`yes: !process.stdin.isTTY`, and its inverse must not appear) and as behaviour (`yes: true` asks **zero** questions; `yes: false` asks at least one), so the two polarities are distinguishable rather than merely documented. |

`enclosingFunctionName` (`config-generation:669`) was **left alone** — low priority, and its suite is
green at 32/0. It remains a latent misattribution risk if a `generateBmmConfig` call is ever added
after `handleBind`'s closing brace.
