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
| `test/project-layout-bind.test.js` | **NEW**, 50 tests. |
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

**AC8 — see §2.** Four properties, four tests, plus determinism, de-duplication, version and
entry-shape invariants.

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
| `project-layout-bind` (NEW) | **50 passed, 0 failed**, exit 0 |
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

30 mutants, run in a **byte-for-byte robocopy `/MIR /XJ` mirror** with a uniquely-named harness
(`mut-3113-runner.js`), with every anchor validated up front against each file's **own** line endings
(`bin/cli.js` and `lib/installer.js` are CRLF, `lib/bound-projects.js` is LF — an LF-only anchor
would have silently skipped 22 of the 30), the sandbox baseline confirmed green before any mutant,
and every revert sha256-verified. Results are recorded in §8 of the run report.
