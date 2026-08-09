# Run Ledger — Epic 31 (Global Installation & Federated Knowledge Stores)

**Run started:** 2026-08-03
**Skill:** `bmad-dev-epic` (orchestrator)
**Run scope (RUN 1, closed):** **WAVE 1 ONLY** (decided 2026-08-03, option A "gate-first"). Stories 31.1 and
31.2 only. HALT and report after wave 1 — do not plan or start waves 2+ even if the dependency
graph reports them unblocked. Story 31.12's scope is undetermined until 31.1's spike reports.

---

# RUN 2 — waves 2 → 6, epic to completion (started 2026-08-09)

## Resolved configuration (RUN 2)

```
Epic:            31 — Global Installation & Federated Knowledge Stores (Phase 5)
Stories (epic):  14   merged (run 1): 2 (31.1, 31.2)   in this run: 12 (31.3 … 31.14)
Prerequisites:   2 non-story units, merged BEFORE 31.5 planning (see Wave 2)
review_model:    claude-opus     exec_model: claude-sonnet     (tiers collapsed: no)
strategy:        waves           max_parallel: 3    fix_cap: 2
gates:           publish=on  pr=on   dist-tag=beta  bump=MINOR (31.14 AC8)
                 RUN BOUNDARY: no npm publish, no PR, no branch push. HALT and report at each gate.
test_gate:       node test/<file>.test.js run DIRECTLY (never wrapped in `timeout`)
                 + `npm run build:plugin` for any lib/bmad-extension/skills/ change
                 bare `npm test` NOT trusted (MIL-498 CRLF drift halts the chain on Windows)
                 baseline every failure against d:\Code\AI_Agents @ 9b936ac before calling it a regression
```

### Environment facts corrected for RUN 2

- **Trunk is now `main`.** Run 1's ledger says the epic trunk is
  `feat/knowledge-stores-and-global-install`; that branch merged to `main` as PR #147 (`9b936ac`),
  and `feature/epic-31` merged `main` back in at `01de99f`. The F26 planning artifacts and
  Decision P5-9 are on `main`. Epic branch head at run start: **`9c0f41c`**
  (= `01de99f` + the run-2 prompt doc). The prompt's stated `01de99f` is one commit behind; no
  code differs.
- Epic worktree: **`d:\Code\AI_Agents-epic-31`** (branch `feature/epic-31`). The run-1 worktrees
  `AI_Agents-knowledge-stores` and `AI_Agents-fix-stage-leak` no longer exist — every path in the
  run-1 record above that references them is stale.
- `.worktrees/` is gitignored (`.gitignore:31`), so nested story worktrees are safe.
- `_bmad/` absent from worktrees (gitignored, per-machine): config + resolver read from
  `d:\Code\AI_Agents\_bmad\...`. `resolve_customization.py --key workflow` succeeded via plain
  `python`; no team/user override TOML for `bmad-dev-epic`, defaults in effect.
- Fresh worktrees need `New-Item -ItemType Junction node_modules -> d:\Code\AI_Agents\node_modules`.
- CI is broken at the GitHub account level — red checks carry no signal. All verification local.

### Green baseline carried into RUN 2 (`feature/epic-31`)

`project-layout-binding-spine` 69 · `config-storage` 16 · `config-lost-on-update` 13 ·
`portable-paths` 20 · `config-layout` 6 · `reconfigure` 12 · `repo-layout` 13.
Known pre-existing failures on unmodified `main`: `bmad-output-policy` (README H2 ordering) and
two `custom-marketplace-*` suites.

## Wave plan (RUN 2)

Dependency graph re-derived from `epics.md` § Epic 31 "Execution order" plus the two
run-1 dispositions (31.3 unblocked; 31.5 gated on three filed defects). No cycles.

```
Wave 2  PREREQUISITES (not stories — merged before 31.5 planning starts)
        2A  shared-enum refactor: define each closed enum ONCE, shared read+write+prompt.
            Subsumes bug-serialize-sprint-management-passes-store-modes-enum.
        2B  bug-read-existing-layout-collapses-two-stores-onto-software-store
            + bug-show-current-layout-prints-undefined-for-confluence-store
            (coupled — the display fix needs the richer topology the preserve-on-read fix returns)
Wave 3  31.3 (←31.2, unblocked)  →  31.4 (←31.3)
        31.11 (←31.1)            →  31.12 (←31.1, 31.11)          [threads A and D, parallel]
Wave 4  31.5 (←31.2 + wave 2)    →  31.6 (←31.3, 31.5) ∥ 31.7 (←31.5)
Wave 5  31.8 (←31.5)  →  31.9 (←31.8)  →  31.10 (←31.9)
Wave 6  31.13 (←31.3, 31.5, 31.8)  →  31.14 (release gate ← 31.4, 31.6, 31.7, 31.10, 31.12, 31.13)
```

**Why 2A and 2B are sequential, not parallel:** both edit `bin/cli.js`, and 2A touches
`storeFromRaw` / `serializeStore` / `serializeSprintManagement` while 2B touches
`readExistingLayout` / `showCurrentLayout`. Same file, adjacent regions, one reviewer each —
step-02 §2.3's shared-file heuristic says sequence them.

### Findings from the RUN 2 intake pass

1. **The `mode` enums are already single-sourced.** `STORE_MODES` / `SPRINT_MODES`
   (`bin/cli.js:734-735`) are already shared between the read half (`requireKnownMode`) and the
   write half (`assertWritableMode`) — that was 31.2's N-1 fix. The pattern defect that remains is
   **`backend`**: its legal set is spelled as inline literals twice, independently — on read at
   `bin/cli.js:852-860` (`storeFromRaw`) and on write at `bin/cli.js:1136-1143`
   (`serializeStore`). That is the surface Story 31.5 doubles, so 2A's real content is a single
   `STORE_BACKENDS` source consumed by both, plus the wrong-enum call at `bin/cli.js:1153`.
2. **`sprint-status.yaml`'s Epic 31 comments carry superseded text that `epics.md` already
   corrected.** `31-11`'s comment still says a project-level install must be "BYTE-IDENTICAL to
   today's" (NFR76 was rebaselined to the post-31.2 tree — `epics.md:5526` carries the
   correction); `31-3`'s and `31-13`'s comments still name `config.user.yaml`, which does not
   exist (P5-9.4 was amended to `_bmad/config.user.toml` / `_bmad/custom/config.user.toml`);
   `31-11`'s comment also still says the scope question needs "promoting to a first-class
   question", which amended FR248 removed. **`epics.md` is authoritative and is already correct in
   all three places.** Story briefs are cut from `epics.md`, not from the sprint-status comments.
   Reported, not edited — correcting sprint-status prose is a planning-pass action, not an
   implementation one.

## Story states (RUN 2)

| id | wave | status | worktree | branch | fix_rounds | note |
|---|---|---|---|---|---|---|
| 2A | 2 | pending | `.worktrees/epic-31-prereq-shared-enums` | `feature/epic-31-prereq-shared-enums` | 0 | shared closed-enum source |
| 2B | 2 | pending | `.worktrees/epic-31-prereq-read-path` | `feature/epic-31-prereq-read-path` | 0 | preserve-on-read + backend-aware display |
| 31.3 | 3 | pending | — | — | 0 | |
| 31.4 | 3 | pending | — | — | 0 | |
| 31.11 | 3 | pending | — | — | 0 | |
| 31.12 | 3 | pending | — | — | 0 | FAIL branch — messaging + gating only |
| 31.5 | 4 | pending | — | — | 0 | gated on wave 2 |
| 31.6 | 4 | pending | — | — | 0 | |
| 31.7 | 4 | pending | — | — | 0 | |
| 31.8 | 5 | pending | — | — | 0 | |
| 31.9 | 5 | pending | — | — | 0 | |
| 31.10 | 5 | pending | — | — | 0 | |
| 31.13 | 6 | pending | — | — | 0 | |
| 31.14 | 6 | pending | — | — | 0 | release gate |

## Process rules in force for RUN 2 (each one earned in wave 1)

1. **Status field is orchestrator-owned.** The implementer may set `review`; only the orchestrator
   sets `done`, and only after an independent review signs off. Both wave-1 stories self-reported
   `done` before their gating review returned, and 31.2's review then found three blocking defects.
2. **Never the same agent for implement and review.** The one wave-1 fix round written by the
   coordinating agent closed its three defects half way and added a new crash.
3. **Mutation-test every new test.** Revert the fix, confirm the suite goes red. Wave 1 shipped a
   CRLF test that `trim()` laundered into a no-op.
4. **Reproduce a defect against the parent commit before fixing it.** Handed-down PoCs may be
   incomplete; two wave-1 fixtures did not reproduce until completed.
5. **Report contradictions; never edit a requirement to make one go away.**

## Wave 2 — in progress

### 2A — shared closed-enum source: **MERGED** as `bb35cac`

**Branch:** `feature/epic-31-prereq-shared-enums` · **Commits:** `5bcf8f1` → `7116093` → `e201b0c`
**Verdict:** APPROVE-WITH-NITS after **two fix rounds / three reviews** (fix cap 2, fully spent).
Implementer and reviewer were separate agents throughout; the merge was made on the reviewer's
verdict, never on self-report.

**What it does.** Each closed enum in the project-layout subsystem — `STORE_MODES`, `SPRINT_MODES`,
`STORE_BACKENDS` — now has exactly one definition, consumed by the reader, the writer **and** the
wizard prompt that produces the value. Both `backend` error messages are rendered from the enum
rather than hand-written. The exported enums are inert copies and `MODE_PROMPT_TITLES` is frozen.
The write half's two value renderers are both total via a new `describeValue`. New suite
`test/project-layout-enum-single-source.test.js` (**25 tests**) pins the *property* rather than the
instances, registered in the `npm test` chain.

**Behavioural change surface: one error message.** The sprint-mode write error now enumerates
`same, local, remote, jira` instead of omitting `jira`. Everything else was verified byte-identical
rather than asserted — both backend messages diffed byte-for-byte against the parent blob, and **74
string renderings** compared against `JSON.stringify` for the `assertWritableMode` change (0
mismatches, covering lone surrogates, U+2028/2029, NUL, BOM, ZWJ, a 5,000-char string and
`__proto__`).

**The `1153` fix is load-bearing, not cosmetic — the report's own assessment was wrong.** It was
filed as dead-code-equivalent because `sprint.mode === 'jira'` early-returns above the validation.
Under the **compound** mutation (early return relocated **and** the fix reverted) sprint Jira becomes
unwritable: `invalid sprint_management mode "jira" — must be one of same, local, remote`. That is the
latent outage the report predicted, both agents reproduced it independently, and the suite now
detects it. Closes `bug-serialize-sprint-management-passes-store-modes-enum.md`.

**Findings: 8 raised, 8 closed. Two were blocking, and both were the same defect class.**

| # | Round | Finding | Closed by |
|---|---|---|---|
| **B1** | 1 | A test named `…independent of the early return` **was not** — removing the early return failed it. That name is the bug report's **AC3 verbatim**, so an unmet AC was papered over by a test title. | `7116093` — split into two honestly-named tests; AC3 now genuinely met |
| **B2** | 2 | The wizard harness added to fix N1 answered `{}` when its queue ran dry, reaching `process.exit(0)` mid-drain — so the summary and the failing exit code **never ran**. The suite exited **0** having reported nothing; a second path OOMed at exit **134**. | `e201b0c` — exhaustion throws by name; two independent summary guards |
| N1 | 1 | Wizard call site untested — swapping it to a constant concern silently stopped offering Jira and **all 92 suites stayed green** | `7116093` |
| N2 | 1 | Legal-set rendering unpinned | `7116093` |
| N3 | 1 | Mutable enum exports (live `Set` references) | `7116093` + `e201b0c` |
| N4 | 1 | `JSON.stringify` threw on the error path (BigInt, circular) | `7116093` |
| N5 | 1 | Assertions failing **open** — `split('—')[1] \|\| ''` degraded to asserting nothing | `7116093` |
| N6 | 1 | `&&node` separator in the test chain | `7116093` |
| N7 | 2 | `assertWritableMode` retained the N4 hazard, demonstrably live (`{mode:1n}` → bare `TypeError`) | `e201b0c` |
| N9 | 2 | Export-copy test covered 2 of 3 enums; live `STORE_MODES` survived | `e201b0c` |

**Mutation tally (reviewer's, independent of the implementer's):** 41 runs over 25 distinct mutants.
Four survivors found — MW1, MW2 (wizard call site), MB1 (separator), MF3 (live `STORE_MODES`
export). **All four killed. Zero survivors remain.** B1 and B2 were found by analysis, not mutation.

**Post-merge verification on `feature/epic-31`,** all eight suites run directly, never wrapped in
`timeout`, all exit 0: enum-single-source **25** · binding-spine **69** · config-storage **16** ·
config-lost-on-update **13** · portable-paths **20** · config-layout **6** · reconfigure **12** ·
repo-layout **13**. The 521 test-regenerated paths (`.agents/`, `AGENTS.md`, `.ma-agents.json`,
`project-context.md`, a root `project-layout.yaml`) were restored/removed before the merge commit,
which contains exactly 3 files.

**Adjudication made during the run (N7).** The implementer declined to apply `describeValue` to
`assertWritableMode` on scope-discipline grounds. Overridden, because the hazard is *live* at that
call site (`writeProjectLayoutYaml` is exported and `store.mode` arrives with no type guard) and the
change is provably behaviour-preserving (`describeValue(s) === JSON.stringify(s)` for every string).
**`requireKnownMode` was deliberately left alone** — its input passes through `scalarString`, so
`JSON.stringify` is total there and changing it would be churn. **The distinction is the type guard,
not the function's provenance**, and it is now recorded in the docblock at `bin/cli.js:826-835` so it
is not relitigated in either direction.

**Corrected citations** (the round-3 brief carried pre-commit line numbers — the same off-by-N
propagation this effort has hit before): `describeValue(mode)` is at **`bin/cli.js:840`**; the
read-side backend message at **`:934`**; the wizard concern loop at **`:1529`**; the new docblock at
**`:826-835`**; `serializeSprintManagement`'s jira early return at **`:1224`**.

**Carry-forward for Story 31.5 — six items, recorded because 31.5 is what this prerequisite protects:**

1. **Hoist the `process.on('exit')` backstop** to the top of `test/project-layout-enum-single-source.test.js`
   (filed as N11, **not** blocking). It is registered at `:862`, below the 22 synchronous tests, so a
   `process.exit(0)` from the synchronous phase still exits 0 with no summary. Unreachable today —
   the reviewer enumerated every `process.exit` in `bin/cli.js` and none is reachable from the
   synchronous tests — but **31.5 is the story that can make it reachable.**
2. **Bump `EXPECTED_TEST_COUNT`** (`test/…:861`) when adding tests. It is a `!==` check, so it fails
   loud on a surplus as well as a shortfall; a forgotten bump is caught, not silent (N12).
3. **Every new wizard question needs an answer in every `runWizard(...)` queue** — the stub now
   throws by name instead of defaulting, and also asserts the queue was fully consumed.
4. **Adding an enum member requires a `MODE_PROMPT_TITLES` entry** — enforced by a keys-equal-union test.
5. **`serializeSprintManagement`'s jira early return is still position-dependent for the jira
   *fields*.** Only the *mode* is now position-independent. Relocating it stops `jira_url` /
   `jira_project_key` being emitted; the FIELDS test catches that, by design and by name.
6. **Do not "fix" `requireKnownMode` to use `describeValue`** — see the adjudication above.

**Process note.** The recurring defect shape in this epic is now named: **validation that degrades
to permissive instead of failing loud.** Three instances so far — the enum read/write disagreements,
N5's `|| ''` fallback, and B2's answer-on-exhaustion stub. The implementer named it itself: *"a test
double's default behaviour is an assertion about what the system under test may do, and mine
asserted nothing."* Worth carrying into every remaining story brief.

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
| 31.2 | 1 | **merged** | `.worktrees/epic-31-story-31.2` | `feature/epic-31-story-31.2` | **3** | binding spine. **APPROVED** at `cd37255` after 3 fix rounds / 4 reviews; merged as `a375386`. AC2 correction honoured. |

## WAVE 1 COMPLETE — final tally

**merged: 2 (31.1, 31.2) · blocked: 0 · skipped: 0.** Both wave-1 gate stories closed.
**HALTING HERE** per the decided gate-first run scope. Waves 2+ not planned and not started.

Epic branch `feature/epic-31` head: `a375386`. **Nothing pushed. No PR opened. No npm publish.**

### Story 31.2 — four-round review history

| Round | Outcome | What it found |
|---|---|---|
| 1 | **CHANGES-REQUIRED** | 3 blocking, **all on the read path** (the write path had been hardened, the read path had not): **B-2** `yamlEscapeValue` escaped `\` and `"` but not newlines, and 31.2 newly routed free-text identity fields (`spaceKey`, `rootPage.title`) through it — PoC landed `api_token` and `password` into a **committed** file, falsifying AC6/NFR79; **B-1** the backend enum was enforced on write but not on read, so `backend: sharepoint` silently resolved the store to the project root (the same defect class the implementer had already hardened on the write side — one side of the round trip only); **B-3** the resolver threw a `TypeError` where its own docstring promised `null`, because the raw mappers sat outside the `try/catch` — would crash `ma-agents bind`/`status`, i.e. Story 31.13's entire surface. |
| 2 | **CHANGES-REQUIRED** | 6 re-review findings. Corrected escaper + a discriminated binding result. |
| 3 | **CHANGES-REQUIRED** | 2 findings — closed `mode` as a value channel, and gated the guard on a real parser rather than a regex. |
| 4 | **APPROVE** | Round-3 PoCs reproduced at the parent and confirmed closed at HEAD. **14/14 mutations killed.** |

**The two highest-consequence risks were cleared explicitly**, which is what made approval safe:

- **No upgrade-path break.** All **12** legacy `knowledgebase` × `sprint` `mode` combinations a
  published ma-agents (≤ 3.17.1) could emit resolve `ok:true` at HEAD. This is the risk that mattered
  most: failing loud on an unknown `mode` must not turn a working project into a permanently-refused
  one.
- **No self-lockout.** **224** files emitted through `writeProjectLayoutYaml` across all modes, `jira`,
  `confluence` and **41** adversarial values (U+2028/2029/0085, NBSP, BOM, astral, lone surrogates,
  NUL, C0/C1, tabs, YAML sigils) → **0 js-yaml gate rejections, 0 round-trip failures.** Our own
  escaped output never fails our own gate.

Three further design points confirmed rather than assumed: the fourth `reason` value breaks nothing
because all three consumers branch on `reason !== BINDING_UNBOUND` (**default-deny** — new reasons land
in the refuse bucket automatically); the **js-yaml gate runs before the schema gate**, so corrupt bytes
can never be mislabelled `too-new`; and the doc compression removed only superseded archaeology while
the reason contract got *stronger* (now universally quantified over all non-`unbound` reasons). The
three reworded `UNBOUND` warnings are **kept deliberately** — in this release the installer is the only
thing that writes the binding, so "re-run the installer" is the only followable advice, and round 3
added a positive test that the refuse-to-overwrite message does **not** say `ma-agents bind`.

### Post-merge verification on the epic branch

All seven suites run **directly** (never wrapped in `timeout` — `repo-layout` runs a full install and
returns exit 143 if killed), all matching their expected counts exactly:

| Suite | Expected | Got |
|---|---|---|
| `project-layout-binding-spine` | 69 | **69** ✅ |
| `config-storage` | 16 | **16** ✅ |
| `config-lost-on-update` | 13 | **13** ✅ |
| `portable-paths` | 20 | **20** ✅ |
| `config-layout` | 6 | **6** ✅ |
| `reconfigure` | 12 | **12** ✅ |
| `repo-layout` | 13 | **13** ✅ |

All exit 0. **No regressions.** The merge conflict in `sprint-status.yaml` (both stories edited
`last_updated`, and 31.2 branched before 31.1 landed so neither contained the other) was resolved by
hand, preserving both entries in reverse-chronological order and re-validating that the YAML parses.
The `.agents/` regeneration, `AGENTS.md`, `AGENTS.md.backup-*`, `.ma-agents.json` and a stray
root-level `_bmad-output/project-layout.yaml` that the test run produced were all reverted or removed
**before** committing — the merge commit contains exactly the 6 intended files.

### Downstream split disposition

- **Story 31.3 — UNBLOCKED** (`backlog` → `ready-for-dev`). Its dependency was the binding-resolver
  contract, now mutation-proven and approved. Two carry-forwards noted on its key: the `--yes`
  legacy-promotion tension is flagged for **31.3 AC2** specifically, and 31.2's AC2 reading
  ("unconditional" = w.r.t. repo layout, not install scope) is settled and must not be re-litigated.
- **Story 31.5 — REMAINS BLOCKED.** It does *not* unblock alongside 31.3. Three defects must be
  dispositioned first, all now filed:

| Filed as | What | Live today? |
|---|---|---|
| `bug-read-existing-layout-collapses-two-stores-onto-software-store.md` | `readExistingLayout` collapses two **distinct** stores onto the software store, so a `system_requirements_store` with its own `space_key` is silently lost — then stamped over **both** records by 31.2's unconditional write. Violates **P5-9.5**. | **No** — byte-identical at 31.2's parent and HEAD, so not a 31.2 regression. But **31.5 is the story that first creates two divergent stores**, so it destroys 31.5's own output on the next install. |
| `bug-show-current-layout-prints-undefined-for-confluence-store.md` | `showCurrentLayout` prints `Mode: undefined / Path: undefined` for a **valid** `confluence` store. | Display-only. **Compounds with the above**: a user who sees `undefined` may "fix" it by re-running the wizard, which then overwrites the store for real. |
| `bug-serialize-sprint-management-passes-store-modes-enum.md` | `bin/cli.js:1153` passes `STORE_MODES` where `SPRINT_MODES` belongs. | **Not a defect today** — dead-code-equivalent, since `sprint.mode === 'jira'` early-returns above it (the reviewer *proved* equivalence by swapping the enum with no test change). Latent: if that early return ever moves, sprint `jira` becomes unwritable. One inconsistency **is** already user-visible — the write-side error message omits `jira` from the legal set it prints while the read side accepts it. |

Note the third is the **third instance in this epic of write-side and read-side validation disagreeing
about a closed enum** (B-1 was the first, fixed in 31.2). Its report recommends defining each enum once
and sharing it across both directions rather than fixing instances individually.

## RUN-LEVEL PROCESS DEFECT — the DoD gate is inverted (2 occurrences, systemic)

**Both wave-1 stories marked themselves `done` in `sprint-status.yaml` on the implementer's own
self-report, before the gating independent review had returned.** Story 31.1's deliverable said
`Status: review` while sprint-status said `done`; Story 31.2 did the same, and its review then returned
**CHANGES-REQUIRED with three blocking defects**.

**Why this is not cosmetic.** `done` in `sprint-status.yaml` is what unblocks downstream stories. Left
uncorrected, **Stories 31.3 and 31.5 could have unblocked off a spine story carrying three blocking
read-path defects** — including one that falsifies its own security AC. The review is the gate; a
story that marks itself `done` before the gate returns has inverted it.

Two occurrences out of two stories, so this is **systemic, not a slip**. Both consequences addressed:

- **(a) Corrected now.** 31.2 reverted to `review` in `2cdb2f3`, with the three defects recorded on the
  key itself and an explicit `DO NOT unblock 31.3 or 31.5` marker. YAML re-validated after the edit.
- **(b) Pipeline rule for every remaining story.** A story reaches `done` **only after independent
  review sign-off**, never on the implementer's self-report. The implementer may set `review`; only the
  orchestrator sets `done`, and only after the reviewer returns APPROVE or APPROVE-WITH-NITS. The
  per-story pipeline contract in `references/story-pipeline.md` already implies this (its DoD requires
  "no blocking findings remain from either reviewer" before returning `merged-ready`) but **it does not
  say who owns the status field**, which is the gap both stories fell through.

**Recommendation for the skill itself** (outside this run's scope to change): `references/story-pipeline.md`
should state that the story subagent must not write `done` to `sprint-status.yaml` — that the status
field is orchestrator-owned. Worth a story against `bmad-dev-epic` rather than a silent local fix,
since this run has now demonstrated the failure twice with an independent reviewer catching real
blocking defects both times it mattered.

## Story 31.2 — independent review: CHANGES-REQUIRED

What passed: **AC2's `installScope === 'project'` gate is correct** (I verified this directly at its
new line `bin/cli.js:1805` before the review, along with `bothSame` and `fs.unlinkSync` both being
gone). **Scope discipline clean** — no 31.3-31.8 work leaked in. The **parser rewrite was judged
justified** and held under **39 probes**. `package.json`'s test-chain addition verified correct.

Three blocking defects, **all on the read path** — the write path was hardened, the read path was not:

| # | Defect | Why blocking |
|---|---|---|
| **B-2** | **`yamlEscapeValue` (`bin/cli.js:500-507`) escapes `\` and `"` but NOT newlines.** Pre-31.2 it only ever saw paths and git URLs; **31.2 newly routes free-text identity fields** (`spaceKey`, `rootPage.title`) through it, so a newline injects arbitrary YAML keys into a **committed** file. | **Falsifies AC6 / NFR79 with a working PoC** — the reviewer landed `api_token: "sk-INJECTED-SECRET"` and `password: "hunter2"`, and via `title` corrupted the schema so `root_page` loses its `id`. AC6 promises "a test asserts no credential-shaped field can be written"; the reviewer wrote two that do. The field-name allowlist is solid — **the hole is the value channel.** |
| **B-1** | **The backend enum is enforced on write but not on read.** `storeFromRaw` does `raw.backend \|\| 'file-system'` and returns `file-system` for anything not `confluence`, so `backend: sharepoint` **silently resolves the store to the project root**. | Silent misresolution of a store location. Notably **the exact defect class the implementer caught and hardened on the write side** — fixed on one side of the round trip only. Reachable because `schema_version: 99` is forward-accepted (NB-4). Must fail loud per the P5-9.3 / NFR56 posture. |
| **B-3** | **The resolver throws where its own docstring promises `null`.** The `try/catch` wraps only `existsSync`/`readFileSync`/`parseLayoutYaml`; `storeFromRaw`/`sprintFromRaw` run outside it. A `path:` key with an empty value parses to `{}` and reaches `path.isAbsolute({})` → `TypeError`. | `readExistingLayout` happens to catch it, but **`ma-agents bind` and `ma-agents status` — the documented AC8 consumers and Story 31.13's entire surface — would crash.** Also fixes NB-2 (`mode: {}`). |

Folded into the same fix round (cheap, same code):

- **NB-7 — not deferred.** `writeProjectLayoutYaml` has no `try/catch` around `mkdirSync`/`writeFileSync`,
  unlike `writeRepoLayoutConfig:555` which does. Pre-31.2 it ran only in multi-repo/Jira mode; **AC2
  makes it run on every project install**, so an unwritable `_bmad-output/` now throws an unhandled
  exception out of Step 3.6 — *after* BMAD install has completed, leaving a half-finished install.
  Making the write universal is what made this reachable, so it is squarely 31.2's.
- **A CRLF test on the new parser** — the highest-value missing test. The reviewer verified CRLF works
  but **nothing pins it**, and this repo has documented Windows CRLF pain.
- **NB-6** inline-comment stripping (`mode: local  # x` → `"local  # x"`, a mild regression versus the
  old regex), and NB-3/NB-5 diagnostics if one-liners.

Confirmed correctly **out of scope** and handed forward rather than fixed: **NB-8** (a `confluence`
store breaking legacy `{knowledgebase}` consumers — unreachable until 31.5/31.8), **NB-9** (FR265
forward gap → 31.7/31.13), **NB-12** (AC10 unachievable on Windows for two documented pre-existing
reasons, **neither a 31.2 regression**), and the `--yes` legacy-promotion tension (→ 31.3 AC2).

**Halt point moved:** the wave-1 halt now falls *after* 31.2's fix-and-re-review, not before it.

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

**Left unfixed by design, and now FILED as durable bug reports** (so wave-2 planning picks them up
rather than relying on this ledger):

| Filed as | What | Why not fixed here |
|---|---|---|
| `bug-fr123-custom-content-flag-name-stale-upstream-renamed-custom-source.md` | FR123 names `--custom-content`; upstream renamed it `--custom-source` at 6.3.0 | Capability **F3, not F26**. Documentation-only — `resolveCustomContentFlag()` (`lib/bmad.js:679-711`) already probes for both names, so nothing is broken. The *fix is a PRD amendment*, which this run is forbidden to make. |
| `bug-uninstall-skill-hardcodes-project-scope-on-update.md` | `bin/cli.js:1668` and `:1680` pass a literal `'project'` to `uninstallSkill` instead of the live `installScope` | Pre-existing latent **global-update** defect, no F26 requirement behind it. Verified against source: `uninstallSkill(skillId, agentIds, customPath = '', scope = 'project')` (`lib/installer.js:2088`) — the fourth parameter is a real behavioural switch, so the literal defeats it and a global-scope deselection silently no-ops. |

Both reports carry the full ten-site map (five correct `installScope` gates + five hardcoded literals)
so a fix is scoped deliberately rather than by grep, and both explicitly warn against folding the
change into Story 31.11/31.12 as a drive-by. The three Step-0 literals (`:1214`, `:1246`, `:1256`) are
recorded as **defensible but undecided** — they run before scope is chosen — with an AC requiring an
explicit decision rather than silence.

### Story 31.2 — `package.json` modification: checked and cleared

Flagged during the in-flight check because it is not obviously required by any of 31.2's ten ACs.
**Resolved: justified and correct.** The only change is one addition to the `test` script chain —
`node test/project-layout-binding-spine.test.js`, i.e. the story registering its own new test file.
Verified mechanically: nothing removed from the chain (the added entry is the sole difference), and
**no dependency change of any kind** — no `dependencies` / `devDependencies` edit, no version bump.
Scripts only.

This is *required* rather than optional in this repo: `test` is an explicit `&&`-chained list of test
files, not a glob, so a new test file absent from that chain never runs in the suite. A story adding a
test file and **not** touching `package.json` would be the defect. Two residual checks remain for
review: that the registered filename matches the file actually written, and that the entry sits
sensibly in the chain order.

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
