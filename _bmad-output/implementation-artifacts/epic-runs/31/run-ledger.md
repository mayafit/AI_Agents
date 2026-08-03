# Run Ledger — Epic 31 (Global Installation & Federated Knowledge Stores)

**Run started:** 2026-08-03
**Skill:** `bmad-dev-epic` (orchestrator)
**Run scope:** **WAVE 1 ONLY** (decided 2026-08-03, option A "gate-first"). Stories 31.1 and
31.2 only. HALT and report after wave 1 — do not plan or start waves 2+ even if the dependency
graph reports them unblocked. Story 31.12's scope is undetermined until 31.1's spike reports.

## Resolved configuration

```
Epic:            31 — Global Installation & Federated Knowledge Stores (Phase 5)
Stories (epic):  14 (31.1 … 31.14)   in this run: 2 (31.1, 31.2)   skipped(done): none
                 Out of run scope by decision: 31.3–31.14 (waves 2+)
review_model:    claude-opus     exec_model: claude-sonnet     (tiers collapsed: no)
strategy:        waves           max_parallel: 3    fix_cap: 2
gates:           publish=on  pr=on   dist-tag=beta  bump=prerelease
                 ADDITIONAL RUN BOUNDARY: no npm publish, no PR, no branch push. Report only.
test_gate:       npm run build:plugin  +  targeted `node --test test/<file>.test.js`
                 (bare `npm test` is NOT trusted — halts on pre-existing MIL-498 CRLF drift on
                 Windows; baseline any failure against d:\Code\AI_Agents @ ccac270)
```

### Environment facts carried for the whole run

- **Trunk for this epic is `feat/knowledge-stores-and-global-install`, NOT `main`.** Epic 31,
  Decision P5-9 and every F26 requirement exist only on that unmerged branch. `main` is at
  `ccac270` and does not contain the epic.
- `_bmad/` is gitignored and absent from every worktree. Config and the customization resolver
  were read from `d:\Code\AI_Agents\_bmad\...` (same project; `_bmad/` is per-machine state).
- `uv` absent, `python3` unreliable → `python` used for `resolve_customization.py` (succeeded).
- Fresh worktrees have no `node_modules`; junctioned to `d:\Code\AI_Agents\node_modules`.
- `node_modules/bmad-method` is a stale **6.9.0**; `package.json:35` pins **6.10.0**. Upstream
  citations must not come from `node_modules`.
- npm registry is reachable; `bmad-method@6.10.0` resolves. The live-install spike is feasible.
- CI is broken at the GitHub account level (all jobs fail in seconds, no runner, no logs) —
  unrelated to this work, not a signal.

### Activation record

- `resolve_customization.py --skill … --key workflow` → succeeded via `python`. No team/user
  override TOML for `bmad-dev-epic`; defaults in effect.
- `persistent_facts`: `_bmad-output/project-context.md` loaded.
- Config: `_bmad/bmm/config.yaml` (main tree) — project `AI_Agents`, user `995472`, language
  English, `planning_artifacts` / `implementation_artifacts` under `_bmad-output/`.
- Readiness conditions gating the spine story were confirmed already discharged in the
  planning chain: **C-8** (per-artifact Confluence page identity NOT stored in
  `project-layout.yaml`) is in Story 31.2 AC6; **C-3** (name the component behind AC8's
  "resolver") is in Story 31.2 AC8 as "the binding resolver — the library function
  `ma-agents bind` and `ma-agents status` call". No planning artifact needed amendment.

## Story sizing (INVEST pre-pass, wave-1 stories only)

| Story | Verdict | Note |
|---|---|---|
| 31.1 | **PASS — no split** | Small; single goal (a written PASS/FAIL verdict with evidence). It is a SPIKE: no feature code. 7 ACs, all facets of one investigation. |
| 31.2 | **PASS — no split** | Medium; single goal (make `project-layout.yaml` the authoritative two-store binding record). 10 ACs but all one schema + one writer/reader pair in `bin/cli.js`; splitting would strand a half-written schema. |

## Dependency graph / waves (full epic, for reference)

```
Wave 1: 31.1 (spike — gates thread D only)  ∥  31.2 (binding spine — gates A/B/C)   ← THIS RUN
Wave 2: 31.3 (←31.2) ∥ 31.5 (←31.2) ∥ 31.11 (←31.1)                                  ← NOT RUN
Wave 3: 31.4 (←31.3) ∥ 31.6 (←31.3,31.5) ∥ 31.7 (←31.5) ∥ 31.8 (←31.5) ∥ 31.12 (←31.11)
Wave 4: 31.9 (←31.8) ∥ 31.13 (←31.3,31.5,31.8)
Wave 5: 31.10 (←31.9)
Wave 6: 31.14 (release gate ← all)
```
No cycles. Topological sort clean.

## Branch topology

```
feat/knowledge-stores-and-global-install          (epic trunk — NOT main)
  └── feature/epic-31                             (epic integration branch)
        ├── feature/epic-31-story-31.1
        └── feature/epic-31-story-31.2
```

Worktrees:
- epic: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31`
- 31.1: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31-story-31.1`
- 31.2: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31-story-31.2`

## Story states

| id | wave | status | worktree | branch | fix_rounds | note |
|---|---|---|---|---|---|---|
| 31.1 | 1 | **merged** | `.worktrees/epic-31-story-31.1` | `feature/epic-31-story-31.1` | 0 | **VERDICT: FAIL.** Reviewed (SUPPORTED, no blocking findings, 7/7 ACs met), 6 non-blocking items folded in, merged to `feature/epic-31` as `b637ab4`. |
| 31.2 | 1 | in-progress | `.worktrees/epic-31-story-31.2` | `feature/epic-31-story-31.2` | 0 | binding spine; AC2 interpretation correction relayed mid-flight and honoured (see below) |

### Story 31.1 review outcome (review tier, opus)

**Verdict assessment: SUPPORTED. No blocking findings.** The append-only hard constraint on Decision
P5-9 passes (`git diff --numstat` = **61 additions / 0 deletions** against the base after the
fold-in). 17 of 18 citations byte-exact. The reviewer independently re-derived both load-bearing
facts against a *fresh* 6.10.0 install — including **running** `bmad install --global` →
`error: unknown option '--global'`. All seven ACs met; the `done` status is justified.

Six non-blocking items were folded in before integration (commit `e1cfca7`):

1. **Status contradiction resolved** — the deliverable's front matter said `review` while
   `sprint-status.yaml` said `done`. The reviewer called this the closest thing to a real defect in
   the diff. Now `done`, the review having passed.
2. **Upstream issue #1728 cited** in both the spike's re-open condition and the P5-9.8 note.
   `bmad-code-org/BMAD-METHOD` **#1728 "feat: global install + bmad-link/unlink for multi-project
   workflows"** is **OPEN**, `priority:high`, created 2026-02-21, and proposes exactly `--global` →
   `~/.bmad/` plus `bmad link`/`unlink`. **Not in 6.10.0** (verified by running the flag), so it
   **confirms the FAIL rather than flipping it** — but it converts an abstract re-open condition into
   a concrete, watchable trigger. Its `bmad link` is the upstream analogue of `ma-agents bind`
   (FR252); if both come to exist, **Story 31.13 should reconcile rather than duplicate**.
3. **Hardcoded-`'project'` count corrected from two to five** — `bin/cli.js:1214, 1246, 1256, 1668,
   1680`. The first three are pre-wizard Step-0 cleanup, where a `'project'` assumption is
   defensible; only **1668/1680** are the genuine latent global-*update* defect. **Story 31.11 is
   handed all ten sites** (five gates + five literals) rather than re-deriving them. The five
   behaviour-gating `installScope` sites are confirmed **complete — no sixth gate exists.**
4. **Misattributed citation fixed** — eager output-directory materialisation is
   `modules/official-modules.js:738`, not `core/installer.js:1659-1660` (which is
   `_readOutputFolder`'s `{project-root}/` strip). Two precision fixes alongside: "17 options" → **19**
   (`--channel`/`--all-stable`/`--all-next` had been counted as one), and AC7's no-network claim now
   cites **`lib/installer.js`** (zero network calls, confirmed) instead of BMAD's `--tools` handling,
   which was the wrong subsystem — the global ma-agents-skills path does not go through BMAD at all.
5. **AC5 fact (ii) qualified before 31.12 consumes it** — `cd <project> && ma-agents install` reaches
   the BMAD install only when **both** an IDE-category agent is selected (`bin/cli.js:1474`) **and**
   the user confirms the "BMAD-METHOD not detected" prompt (`:1500-1505`). 31.12's message must not
   imply one invocation guarantees a BMAD install.
6. **Free evidence upgrade** — added the `bmad install --global` → `error: unknown option '--global'`
   [RUN] proof for AC1(a) (which had leaned on source-reading where execution was two seconds away),
   plus `ConfigDrivenIdeSetup.findAncestorConflict` (`ide/_config-driven.js:944-968`): upstream treats
   an ancestor install sharing `target_dir` as a **conflict** because "IDEs like Claude Code inherit
   commands from parent directories", so a `--directory ~` install would trip upstream's own conflict
   detection for every project under `$HOME`. Upstream's code argues for FAIL.

**Reviewer finding #11** — that the spike prescribing the AC2/FR251 resolution was mild overreach and
would "silently rot if nobody actions it before 31.2 starts" — was valid and is **discharged**: the
reconciliation was relayed to 31.2's implementer before it had written any code, and is recorded
below. Confirmation that 31.2 honoured it is a review checkpoint for that story.

**Left unfixed by design:** FR123's `--custom-content` is stale (6.10.0 renamed it `--custom-source`).
That is capability **F3, not F26** — it belongs in a separate defect, not this epic. ma-agents already
probes and downgrades (`lib/bmad.js:679-711`), so nothing is broken.

## Story 31.1 — FR250 spike verdict: **FAIL**

bmad-method@6.10.0 has **no user-level install target**, and — decisively — **no module-resolution
search order that could find a user-level `_bmad/` from inside a project.** Evidence:

- `findBmadDir` is a single `path.join` with **no upward walk**.
- `resolve_config.py` hard-fails when the project-local `_bmad/` is absent.
- **~211 `{project-root}/_bmad/...` literals** across the 46 installed skills.
- There is **no `BMAD_HOME`** or equivalent environment escape hatch.
- `--directory $HOME` "works" in the sense that it writes files, but it manufactures a **phantom
  project that nothing reads**. That is not a global install.

### What this implies for Story 31.12 — the single most important output of wave 1

Story 31.12 becomes the **FR250 degradation path**, not an installer capability. It is a
**messaging-and-gating change**: ma-agents skills install globally, BMAD stays project-scoped, and
the installer reports the three facts FR250 requires (BMAD remains project-scoped; the command that
installs BMAD into a project; that the F26 knowledge-store requirements are unaffected). This is
**smaller than the PASS branch** would have been. Per P5-9.8 and Story 31.1 AC6, **no part of
P5-9.1–P5-9.7 changes and Stories 31.2–31.10 are unaffected** — a FAIL is explicitly not a blocker
on them. This is exactly why the run was scoped gate-first: no effort was spent on 31.12 against an
assumed verdict.

### Finding — the `installScope` call-site map is larger than the planning anticipated

Story 31.1 AC4 asserts the global filter (`bin/cli.js:1440-1452`) and the project-only guard
(`bin/cli.js:1455`) are **"the only two places the project-scope assumption is encoded."** The spike
found **five**:

| line | site | anticipated? |
|---|---|---|
| 1441 | global BMAD agent filter | yes |
| 1455 | `if (installScope === 'project')` — whole BMAD-METHOD integration block | yes |
| 1616 | `writeRepoLayoutConfig` + `writeProjectLayoutYaml` | **no** |
| 1759 | `reconcileAgentsSharedSkills` | **no** |
| 1768 | `project-context.md` repo-layout update | **no** |

Favourably, the three unanticipated sites are exactly the project-scoped work FR251 forbids under
global scope, and they are **already correctly gated** — so this is less work than feared, not more.
AC4's "only two" claim is nonetheless **factually wrong**. It is moot for the verdict (AC4 is the
PASS branch; this spike returned FAIL) but it is a real defect in the planning chain and is reported
rather than silently corrected. **`epics.md` was not edited.**

Also found and **deliberately not fixed**: two hardcoded `'project'` literals at `bin/cli.js:1668`
and `:1680` (`uninstallSkill` on the update path) ignore `installScope` entirely — a latent
global-*update* bug, independent of this epic and out of scope for both wave-1 stories. Needs
filing as a defect.

## Mid-flight correction issued to Story 31.2 — AC2 vs FR251

The spike surfaced a genuine conflict in Story 31.2 AC2 while 31.2 was still in flight (its branch
had no commits yet, so the correction reached the implementer in time).

**The conflict.** AC2 requires `project-layout.yaml` be written "**unconditionally** on every
install". But `bin/cli.js:1616` gates `writeRepoLayoutConfig` + `writeProjectLayoutYaml` on
`installScope === 'project'`, and **FR251 requires that a global install does not write it** — a
global install performs no project-scoped work. Read literally, AC2 contradicts FR251.

**Reconciliation (not a planning error).** P5-9.1 says "every install and every bind", meaning
*within a project-scoped install or bind*. AC2's phrasing dropped that qualifier. The intended
reading is therefore:

- **KEEP** the `installScope === 'project'` gate at `bin/cli.js:1616`. Removing it would violate
  FR251 and make a global install scaffold project files into a directory with no project.
- **REMOVE** only the `bothSame` early-return and the `fs.unlinkSync` at `bin/cli.js:612` — the
  AC2 + AC3 work, unchanged.
- "Unconditional" in AC2 means **unconditional with respect to repo layout** (single-repo vs
  multi-repo vs Jira), **not** with respect to install scope.

Per the run's boundaries the PRD, Decision P5-9 and `epics.md` were **not edited** to resolve this.
The interpretation is recorded here and in Story 31.2's completion notes so the reviewer sees the
reasoning rather than an apparent AC miss. **A future planning pass should tighten AC2's wording.**

<!-- updated at every state transition -->
