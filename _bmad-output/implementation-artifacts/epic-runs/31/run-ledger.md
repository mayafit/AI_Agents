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

### Findings from the RUN 2 continuation intake (2026-08-11)

Session resumed after the 2B fix round was dispatched and stopped before producing work (0 of 2 fix
rounds consumed). Full F26 requirement set re-read: FR248–FR253 / NFR76–NFR78 from
`prd/capabilities/bmad-integration-and-bundling.md`, FR254–FR265 / FR267 / NFR79–NFR83 from
`prd/capabilities/project-knowledge-and-repository-layout.md`, Decision P5-9.1–P5-9.8 plus the
appended FR250 spike verdict, and all 14 story definitions from `epics.md:5247-5629`.

**Parsing note honoured.** P5-9's headings were extracted with a fence-toggling `awk` filter
(`/^```/{f=!f; next} !f && /^#{2,4} /`), which yields exactly the 8 sub-decisions plus `## Decisions`,
`### Decision P2-7/P2-10/P5-9` and `#### Deferred` — no `## AI Agent Mandatory Rules` /
`## Technology Stack` / `### Repository Layout` template text leaks in. A naive `grep '^## '` does
mislead here, exactly as warned.

3. **C-6 IS STILL OPEN — a live contradiction between P5-9.3 and the story ACs it governs.** The
   readiness review filed "C-6 BEFORE 31.3 — amend P5-9.3", and the amendment was never made.
   P5-9.3's second rule still reads *"when a skill activates and `project-layout.yaml` is **newer
   than** the generated `config.yaml`, the skill fails loud"* — an **mtime** comparison. Story 31.3
   AC7 requires a **content-based generation stamp** ("so Story 31.4 can detect drift without
   depending on filesystem mtimes"), and Story 31.4 AC6 requires the comparison be "content-based,
   not mtime-based … mtime ordering is not guaranteed after a `git pull` or fresh clone" (OQ-2).
   **The stories are right and P5-9.3's wording is the drifted copy** — mtime genuinely does not
   survive a fresh clone, which is the exact scenario NFR83 and the whole binding thesis exist for.
   **Disposition:** implement per `epics.md` (authoritative — content stamp), do **not** edit P5-9 to
   resolve an implementation problem, and report the wording drift for a planning pass. Note the
   sprint-status comment is more precise than `epics.md` on one point: **OQ-2 settles before 31.3,
   not before 31.4**, because 31.3 is the story that *writes* the stamp. 31.3's brief carries this.

4. **OQ-5 is a genuine product decision that gates 31.6, and no FR settles it.** Which store owns
   **research reports** (domain / market / technical research)? FR255 scopes the system store to
   brief + PRD; FR256 scopes the software store to architecture + UX + epics. Research is in
   neither list, yet FR119 names research among the workflows that resolve output through the
   knowledgebase path. The readiness review raised it as "C-10 BEFORE 31.6 — raise OQ-5 to the PM",
   noting 31.6 AC4 currently forces the story to settle it and that it decides whether research
   becomes stakeholder-visible in a Confluence space. **Escalated to the human at wave-3 time rather
   than at wave 4, so it cannot block.** Working assumption if unanswered: **software requirements
   store**, because FR264's legacy fields already resolve there, so no existing project's research
   paths move (NFR82). To be filed as an explicit open question, never buried in an AC.

### OQ-5 — DECIDED BY THE HUMAN, 2026-08-12: research reports belong to the SOFTWARE requirements store

Escalated at wave-3 time (rather than at wave 4, so it could not block) and **answered by the user**:
**research reports — domain, market and technical — resolve to the software requirements store.**

Rationale carried with the decision: FR264's legacy single-valued fields already resolve to the
software store, so **no existing project's research paths move** and NFR82 is preserved with no
exemption to argue. Research stays in git next to the code by default. The accepted trade-off is
that research is **not** stakeholder-visible when the system store is the Confluence-backed one —
that is a deliberate choice, not an oversight.

Rejected alternatives, recorded so they are not re-litigated: the **system store** (semantically
defensible — research is "what/why" input to requirements — but it changes the resolved path for
legacy projects and would need an explicit NFR82 exemption); and a **split by research type**
(domain/market → system, technical → software), which is the most semantically accurate but adds a
third routing rule to FR119 and would make the three bmad research skills route differently from
each other — more surface for exactly the read/write disagreements this epic keeps producing.

**Consequence for Story 31.6:** its AC4 no longer has to settle this. The decision is an input.
31.6 must still record it in the artifact-to-store routing table and pin it with a test. **This is a
product decision made by the user, not an implementation inference — do not let a story quietly
re-derive or reverse it.**

5. **Two further open questions are already owned and need no action yet.** OQ-1 (where the
   bound-projects record FR253 needs actually lives — no FR or decision names one) belongs to 31.13;
   OQ-3 (whether the 31.4 staleness guard goes in all 39 config-referencing skills or only the 7
   explicit `config.yaml` readers) belongs to 31.4 and is an evidence question the story resolves
   against the resolution chain, not a human decision.

6. **Install-flow ordering interaction to hand to 31.11.** Repo layout is collected at
   `bin/cli.js:2372-2373` — **before** the Installation Scope question at `:2376`. Story 31.11 AC3
   requires that a global install "does not prompt for knowledge-store locations", so 31.11 must
   move or gate that ordering, and it must compose with 2B's now-unconditional `readExistingLayout()`
   at `:2372`. `readExistingLayout()` itself is a pure read and does not violate FR251; the
   FR251-relevant surface is `collectRepoLayout`'s interactive prompting, not the read.

7. **`sprint-status.yaml` state confirmed at intake:** `31-1` done, `31-2` done (approved `cd37255`,
   merged `a375386`), `31-3` **ready-for-dev**, `31-11` still marked "blocked on 31.1" though 31.1 is
   done — so 31.11 is unblockable and its status line is stale. All others `backlog`. `epic-31`
   itself is `backlog`. No story is in `review` or `in-progress`, so nothing was left half-claimed by
   the stopped agent.

8. **Observation, out of scope, not a defect to fix here.** FR105 (capability **F4**, BMAD Extension
   Architecture) still names `config.user.yaml` as a file the module setup skill writes. P5-9.4
   established against a live install that no `config.user.yaml` exists in this convention. FR105 is
   not an F26 requirement and no Epic 31 story touches it — recorded so the next planning pass sees
   that the `config.user.yaml` drift extends one requirement beyond the three already corrected.

## Story states (RUN 2)

| id | wave | status | worktree | branch | fix_rounds | note |
|---|---|---|---|---|---|---|
| 2A | 2 | **merged** | *(worktree removed)* | `feature/epic-31-prereq-shared-enums` | 2 | shared closed-enum source — merged `bb35cac`, APPROVE-WITH-NITS |
| 2B | 2 | **merged** | *(worktree retired)* | `feature/epic-31-prereq-read-path` | 1 | preserve-on-read + backend-aware display. `140190d` → CHANGES-REQUIRED (B-1) → `4ec4b1a` → APPROVE-WITH-NITS → merged **`3f21b1a`**. Closes 31.5's last two gating defects. |
| 31.3 | 3 | **ready** | — | — | 0 | ready-for-dev, now unblocked (2B merged). Carries C-6/OQ-2 (content stamp, not mtime), the `--yes` legacy-promotion tension at AC2, and 2B nits 1 and 4. |
| 31.4 | 3 | pending | — | — | 0 | OQ-3 (39 vs 7 skills) is an evidence question the story resolves |
| 31.11 | 3 | pending | — | — | 0 | sprint-status still says "blocked on 31.1"; 31.1 is done, so it is unblockable. Carries the `:2372` vs `:2376` ordering interaction. |
| 31.12 | 3 | pending | — | — | 0 | FAIL branch — messaging + gating only |
| 31.5 | 4 | **unblocked** | — | — | 0 | **All three gating defects now CLOSED** (enum bug by 2A `bb35cac`; read-collapse + display bugs by 2B `3f21b1a`). Carries 2A's six carry-forwards and 2B nits 2 and 3. |
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

### 2B — FINAL OUTCOME: **MERGED** as `3f21b1a` (2026-08-12)

**Fix round 1 committed `4ec4b1a`; reviewed independently → APPROVE-WITH-NITS; merged on the
reviewer's verdict.** Fix rounds used: **1 of 2.** Implementer and reviewer were separate agents.
Closes both `bug-read-existing-layout-collapses-two-stores-onto-software-store.md` and
`bug-show-current-layout-prints-undefined-for-confluence-store.md` — **Story 31.5's last two
preconditions.** With 2A (`bb35cac`) already merged, **all three of 31.5's gating defects are now
closed and 31.5 is unblocked.**

**B-1 reproduced by the reviewer with its own fixtures at `140190d`, by live install, and confirmed
closed at `4ec4b1a`:** divergent pair (`SYS`/`SWE`) → software store became `file-system/same/"."`,
space key and root page destroyed, and the divergence notice named only the *surviving* system
store; non-divergent pair (`ENG`/`ENG`) → **both** stores destroyed with **nothing in the entire
install log**. At `4ec4b1a` both cases are byte-identical except `generated`, exit 0.

**Consequence 2 CONFIRMED, not merely asserted.** All 13 `config-lost-on-update` tests were read;
**none** pins a `--yes` install resetting to `same/.` as *desired*. Two point the other way (`:176`
pins the config.yaml fallback returning `/ext/kb`; `:285` pins the bare default only for a literal
`null` `existingLayout`, i.e. `collectRepoLayout`'s default branch, not the install path's decision
of *when* to read). No contradiction to report.

**Independent mutation evidence — N-2 now DISCHARGED.** 13 mutants in isolated worktrees,
**12 killed, 1 survivor by design** (forcing `yamlOracle` null). Both hazard mutants are among the
killed. **N-2's specific point verified and restated correctly:** the AC3 test (`test:721`) survives
reverting `renderIdentityValue`'s coercion **and** survives the file-system-view mutation
*individually*, dying only under the conjunction — a genuinely **disjunctive** property, not a
coverage hole, since backend-awareness is separately pinned by 8 other tests. Not run (budget):
M9, M10, M11, M14, M16, and the MA∧MB conjunction.

**Nine suites green at expected counts, all exit 0:** two-store-round-trip **46** ·
enum-single-source 25 · binding-spine 69 · config-storage 16 · config-lost-on-update 13 ·
portable-paths 20 · config-layout 6 · reconfigure 12 · repo-layout 13.

#### PROCESS INCIDENT — two live mutants were nearly merged

The implementing agent was killed **twice** by a 600s stream watchdog while blocked on a mutation
run, and **each time left a live mutant in the working tree**:

1. `topology: binding.topology` → `topology: null` in `readExistingLayout()`'s ok-branch — guts the
   non-lossy read that is 2B's entire purpose. Killed by 3 tests (legacy file still yields a
   topology; pre-F26 file crashed with `Cannot read properties of null (reading 'schemaVersion')`;
   two-store output must label the system store). Verified 43 passed / 3 failed, exit 1.
2. `collectRepoLayout({yes}, existingLayout)` → `collectRepoLayout({yes}, null)` — **restores B-1 in
   full while the unconditional read on the line above still reads as a correct fix.** This is the
   dangerous one: any review checking only "was the read made unconditional?" sees a clean fix.

Both were caught and reverted by the orchestrator before the commit, all three changed files were
audited line by line, and the reviewer then independently re-audited all 555/13 diff lines with
`numstat` accounting and found **no further mutant**. It also proved the fix **live** rather than
present — `repoLayout` is `const` with exactly four references and no reassignment, so mutant 2's
shape cannot hide.

**Root cause and standing rule.** `test/project-layout-two-store-round-trip.test.js` now drives real
`ma-agents install --yes` runs, so one execution exceeds the watchdog. **Every remaining brief must
require long suites to be run redirected to a log file in the background, never blocked on in the
foreground, and mutation matrices to be run in small reported batches.** A foreground run also
produced a misleading exit **143** once — the `timeout`/SIGTERM trap, hit by the orchestrator itself.
**Every commit from here gets a line-by-line diff audit, not just a green test run.**

#### Seven non-blocking findings carried forward from 2B's review

1. **→ 31.3. `lib/installer.js:818` hardcodes `'file-system'`** as a second, independent definition
   of the default backend, while `bin/cli.js:775` owns `DEFAULT_STORE_BACKEND` and `:767` owns
   `STORE_BACKENDS`. The comment justifies it (installer.js must not require cli.js, and there is no
   shared `lib/` enum module today) but **nothing pins the two in agreement** — every test asserts
   against cli.js's copy. This is the same read/write enum disagreement the epic already fixed once,
   and the new bug doc's own AC3 warns against it. **Shared-module candidate when 31.3 lands.**
2. **→ 31.5. Install-path test gap for a divergent *file-system* pair.** The commit rejects the
   confluence-only alternative precisely because `system: local /a` + `software: local /b` is
   FR258's normal case, yet none of the four new install tests covers it. It *is* pinned in-process
   (`test:334`), so the guarantee holds — but the install path, where B-1 lived, is not what pins it.
3. **→ 31.5. `parseWithOracle` degradation.** `js-yaml` is a declared *production* dependency, so
   `yamlOracle === null` needs a broken install. If it fired, install test (d) would lose all its
   positive assertions and keep only a negative match plus a `schema_version` check — it would pass
   on a wrong virgin layout. Reported as a printed NOTE and still exit 0: visible, not loud. The
   epic's own recurring shape, in the test harness.
4. **→ 31.3. Residual, pre-existing, narrowed by this fix.** With an `invalid` binding,
   `writeProjectLayoutYaml` correctly refuses, but `writeRepoLayoutConfig` still runs with the bare
   default and writes `knowledgebase_path: "."` into the derived `config.yaml`, and the warning never
   mentions config.yaml. **The authoritative file is protected; the derived one is not.** Not
   introduced here — `4ec4b1a` shrinks it from "all installs" to "invalid bindings only". Squarely
   31.3's surface.
5. **Record correction.** `4ec4b1a`'s message claims **N-4** (`padEnd(8)` alignment) was folded in.
   It was **already present at `140190d`** (`bin/cli.js:3034`) and appears nowhere in the
   `140190d..4ec4b1a` diff. The code is correct; the attribution was wrong. **N-1**
   (`bin/cli.js:926`, "nine-character") and **N-6** (backstop hoisted, empirically proven by mutant
   M12 printing `FATAL … WITHOUT printing its summary` and forcing exit 1) are correctly folded in.
6. **Cosmetic.** The Confluence note (`cli.js:686-691`) prints before `fs.writeFileSync` inside the
   same `try`, so a failed write leaves the user told about a file that was not updated.
7. **Consequence-3 judgement upheld.** Leaving `knowledgebase_path` at `"."` preserves NFR82 (it is
   what `planning_artifacts` and the Knowledge Atlas scan derive from), the behaviour is explicit at
   both sites rather than falling out of a falsy check, **no meaning is invented**, and the real
   question is filed with a genuine option set. Pinning is effective: M4/M5/M6 kill the
   `writeRepoLayoutConfig` half, M7/M8 the renderer half, with M7 reproducing the pre-fix misleading
   `- **Knowledgebase:** .` verbatim.

**New open question filed, deliberately unanswered:**
`bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store.md` — what
`knowledgebase_path` means for a Confluence-backed store. Four options laid out against NFR82; notes
that once both stores can be Confluence-backed *and diverge* (FR257/FR258) one scalar field cannot
describe them anyway. Surfaces a consumer the epic had not tracked:
`lib/knowledge-atlas/src/scan/config.ts`. **Owned by Story 31.3 / 31.6.** No `build:atlas` rebuild is
implicated — the file is only referenced, not modified.

---

### 2B — history: the round-1 review that produced B-1 (superseded by the outcome above)

**Branch:** `feature/epic-31-prereq-read-path` · **Worktree:** `.worktrees/epic-31-prereq-read-path`
**HEAD:** `140190d` (one commit off `bb35cac`) · **Working tree clean; nothing uncommitted.**
**Status:** implemented, reviewed once → **CHANGES-REQUIRED**. Fix round 1 was dispatched and the
implementer agent was **stopped before producing any work** (session ended). Zero commits, zero
uncommitted changes — nothing was lost, and **no fix-round budget has been consumed**. Fix rounds
used: **0 of 2**.

**Update 2026-08-11 — fix round 1 re-dispatched.** B-1 was first re-verified against source rather
than taken from the prior review: `bin/cli.js:2372` is confirmed `const existingLayout = isUpdate ?
readExistingLayout() : null`, and `bin/cli.js:1779-1786` confirms the mechanism end to end — a
non-null `existingLayout` with no env vars returns **verbatim**, a null one falls through to the bare
`{knowledgebase:{same,"."}, sprintManagement:{same,"."}}` default that reaches the write choke point
indistinguishable from a real answer. Consequence 3 was likewise confirmed concrete rather than
theoretical: `writeRepoLayoutConfig` calls `toPortablePath(layout.knowledgebase.path, projectRoot)`
at `bin/cli.js:660`, and a `confluence` store carries no `.path`. The implementer was briefed with
the **decided** fix (unconditional read), all four consequences, N-1/N-2/N-4/N-6, a mandatory
mutation list, and an explicit prohibition on inventing `knowledgebase_path` semantics for a
Confluence-backed software store. Implementer and reviewer are separate agents, per process rule 2.

**What `140190d` does.** `readExistingLayout()` is now non-lossy (returns the collapsed legacy view
*plus* the full three-record `topology`); `writeProjectLayoutYaml()` preserves any record the caller
did not supply, off the *same* `resolveProjectTopology` call the non-destruction guard already makes;
`showCurrentLayout()` renders from the topology, backend-aware, via a new frozen `STORE_BACKEND_VIEWS`
keyed by `STORE_BACKENDS` exactly as `MODE_PROMPT_TITLES` is keyed by the mode enums. New suite
`test/project-layout-two-store-round-trip.test.js`, **38 tests**, with a both-directions
`EXPECTED_TEST_COUNT` guard. AC4 strategy chosen: **preserve-on-read (option a)**, recorded in
`readExistingLayout`'s docblock — adjudicated SOUND by review.

**It also found and fixed an extra instance the bug reports do not mention:** `sprint_management`
with `mode: jira` printed `Path: undefined` — same renderer, same defect, a shape the sealed schema
accepts. And in the FR257 ordering the old renderer printed `Mode: same / Path: .` and **never showed
the Confluence system store at all** — silently invisible rather than `undefined`.

#### B-1 (BLOCKING, open) — `ma-agents install` still destroys a committed Confluence store

Preservation engages only for a record the caller **did not supply**, and on the install path the
caller always supplies one: **`bin/cli.js:2372`** is `const existingLayout = isUpdate ? readExistingLayout() : null;`.
`isUpdate` is true **only** for the interactive "Update (add/remove skills)" choice — **false for
every `--yes` run and false on a fresh clone**. So `existingLayout` is `null`, `collectRepoLayout`
falls to the bare default at `bin/cli.js:1783-1786`, and that default reaches the choke point
**indistinguishable from a real answer**.

Reproduced with the real CLI (`node bin/cli.js install --yes`, exit 0):

- **Divergent Confluence pair** (system `SYS`, software `SWE`) → software store emerges as
  `backend: file-system / mode: same / path: "."`. Space key and root page **gone**. The divergence
  notice fires but names only the *system* store — it never says a Confluence space key was deleted.
- **Non-divergent Confluence pair** (both `ENG` — the ordinary post-31.8 project) → **both** stores
  destroyed, and `grep -c "UNCHANGED|DIFFERENT|space_key|confluence"` over the **entire install log
  = 0**. Completely silent. Exactly the FR263 harm the bug report's Blast Radius section describes.

**This leaves the read bug's AC1 textually unmet** ("survives an **install** and a `ma-agents config
layout` run byte-identically except for `generated`"). The headline test drives
`handleConfigLayout(['--yes'])` only, and the FR257 fixture is the one case where install is
*accidentally* harmless because its software store already is `{file-system, same, "."}`.

**Not a regression** — at `bb35cac` all five fixtures lost **both** stores, so `140190d` is a strict
improvement. But it does not clear the precondition it exists to clear.

It also falsifies the commit's own design argument: preservation was placed at the write choke point
because *"a preservation step each caller has to remember is one that will be forgotten"* — and an
**existing** caller already forgets, at `:2372`.

#### Directed fix (decided; supersedes the reviewer's narrower option)

**Make `bin/cli.js:2372` unconditional — `readExistingLayout()` always.** The reviewer's alternative
(preserve only records whose existing backend is `confluence`) was **rejected as incomplete**: two
`file-system` stores in different locations is FR258's *normal* case, so a Confluence-only rule would
still collapse `system: local /a` + `software: local /b` on every `install --yes`. Unconditional read
composes with what is already built — `collectRepoLayout` with a non-null `existingLayout` and no env
vars returns it verbatim (`bin/cli.js:1779-1781`), so the legacy value *is* the existing software
store — and it matches `handleConfigLayout`, which already reads unconditionally at `:2980`.

Four consequences to work through:

1. **Virgin project must stay byte-identical** — `readExistingLayout()` returns `null` there. Prove it.
2. **The FR265 `config.yaml`-only fallback becomes reachable on a fresh install**, where today it is
   not. A `--yes` reinstall on a project with a legacy `knowledgebase_path` but no
   `project-layout.yaml` today writes `same/.`; after the change it writes the config.yaml-derived
   path. That is believed **FR265/NFR82-correct** (NFR82 requires no change to resolved artifact
   paths), but it is a real behaviour change and `test/config-lost-on-update.test.js` is the suite
   about this defect class. **Verify all 13 tests, decide deliberately, record it.** If any pins
   today's reset-to-default as *desired*, stop and report the contradiction.
3. **`writeRepoLayoutConfig` (`bin/cli.js:660`) and `generateRepoLayoutSection`
   (`lib/installer.js:795-802`) now receive a `confluence` store on the install path** — filed by
   review as N-5. Both read `.mode`/`.path`, which a Confluence store lacks; neither crashes and
   neither emits `undefined` today (both silently produce `.`), but the change makes it reachable
   from `install`. Must not crash, must not write a misleading value. **What `knowledgebase_path`
   means for a Confluence-backed software store is a genuine Story 31.3/31.6 question — do not invent
   an answer.** Make it safe and explicit, pin it, and file the open question.
4. **Add the missing install-path tests.** `test/config-lost-on-update.test.js:251/:274/:317` only
   ever call `collectRepoLayout({yes:true}, existing)` with an explicitly-passed layout; nothing
   asserts the *install path* passes one, in either direction. Cover `install --yes` over: a divergent
   pair, a non-divergent Confluence pair, a legacy single-store project, and a virgin project.

#### Open non-blocking findings on 2B

- **N-1** `bin/cli.js:892` says "**seven**-character string `"undefined"`" — it is **nine**. (The
  review brief propagated a third wrong count; this has already drifted twice.)
- **N-2** The claim *"all 38 tests killed by at least one of 23 mutations"* is doubtful for
  `test/…:687` (AC3 "no `undefined` in either store position"): it survives restoring the display
  defect **and** reverting `renderIdentityValue`'s coercion *individually*, dying only under the
  conjunction. The property is genuinely disjunctive, so this is a precision problem, not a hole
  (backend-awareness is pinned by `:747` and `:810`). **Restate the claim accurately and record the
  mutation list** — it appears nowhere, which is why the claim was unverifiable.
- **N-6 (latent, this epic's recurring shape)** `bin/cli.js:1808` has `if (!mode) process.exit(0)`
  in `collectRepoLayout`'s interactive branch. Unreachable from the current 38 `--yes` tests, but a
  future test driving the interactive wizard with a cancelled prompt would exit **0** before
  `drainAsyncTests().then(...)`, skipping both the summary and the `EXPECTED_TEST_COUNT` guard —
  precisely what 2A shipped and had to fix. **Hoist `summaryPrinted` and the `process.on('exit')`
  backstop above the tests.** Consequence 4's install-path tests may make this reachable now.
- **N-4** `bin/cli.js:2963` `padEnd(8)` reproduces the legacy file-system column byte-for-byte, so a
  Confluence block renders unaligned beside an aligned file-system one. No AC requires alignment.
- **N-5** see consequence 3 — file it for 31.3/31.6.

#### 2B — verified correct by review; do not re-derive

- All four `bb35cac` reproductions confirmed with the reviewer's own fixtures, including the extra
  "silently invisible store" case.
- **Preservation × non-destruction guard structurally sound.** `resolveProjectTopology` called once
  (`:1486`); the guard returns at `:1497` **before** any preservation code, so bypass is impossible.
  **23 malformed fixtures** — every non-`unbound` reason refused the write and left the file
  byte-identical.
- **NFR81 not violated.** 6 consecutive writes → 1 distinct output, convergent, no oscillation.
  First-vs-second install differs only when the existing file is already divergent, which cannot
  happen before 31.5. NFR81's wording concerns platform and CRLF/LF, not prior-file independence.
- **Display path total.** 23 malformations × 3 entry points → **0 crashes**. `storeIdentityFields`'s
  deliberate throw is unreachable and fenced by the keys≡`STORE_BACKENDS` test. No Story-31.2 B-3
  analogue.
- **Legacy path intact, independently re-derived.** All **12** combinations `ok:true`, byte-identical
  after reading, `storesDiverge` false for each. Pre-F26 file fine. FR265 fallback still unreachable
  from `resolveProjectTopology` (P5-9.1 upheld).
- **No over-reach.** Interactive reconfigure on a non-divergent pair sends the one answer to **both**
  records; on a divergent pair it preserves the system store and prints the notice.
- **Wave 2A invariants held.** `STORE_BACKEND_VIEWS` frozen including entries; keys exactly
  `STORE_BACKENDS`; exported enum a real copy; `identity()` returns a fresh array per call; no
  private backend list. `serializeConfluenceStore`'s field enumeration held — a fixture carrying
  `api_token: "sk-LEAK"` round-tripped with the token **dropped**.
- **Nine suite counts confirmed:** two-store-round-trip **38** · enum-single-source 25 ·
  binding-spine 69 · config-storage 16 · config-lost-on-update 13 · portable-paths 20 ·
  config-layout 6 · reconfigure 12 · repo-layout 13. The `EXPECTED_TEST_COUNT` guard fires in both
  directions; this suite does **not** have 2A's silent-green defect.
- **Both disclosures adjudicated SOUND:** one commit rather than two (the dependency is *mutually*
  circular — display AC5 needs the read fix's `topology`, and the divergence notice needs the display
  fix's identity table, so either split ships a half-fix); and the AC3 `"undefined"` limitation is
  **forced**, not merely tolerated, because quoting values would satisfy AC3 but is excluded by
  display AC2's byte-for-byte pin.

**Corrected citations for 2B** (the review brief carried three off-by-N): `DEFAULT_STORE_BACKEND`'s
substitution site is **`bin/cli.js:1098`**; the new exports are **`:3176-3184`**; the non-destruction
guard starts at **`:1486`** (`:1498` is its closing brace).

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

---

# WAVES 3–6 — the record from 31.3 through 31.13 (2026-08-12 → 2026-08-22)

## Story states — current

| id | status | merge | rounds | note |
|---|---|---|---|---|
| 31.1 | **done** | `b637ab4` | 0 | FR250 spike, verdict FAIL |
| 31.2 | **done** | `a375386` | 3 | binding spine |
| 2A | **done** | `bb35cac` | 2 | shared closed-enum source |
| 2B | **done** | `3f21b1a` | 1 | non-lossy read + backend-aware display |
| 31.3 | **done** | `a4b8489` | 1 | config.yaml generated one-way |
| 31.4 | **done** | `38c7f8c` | 1 | staleness fail-loud guard |
| 31.5 | **done** | `536634b` | 1 | two-store wizard |
| 31.6 | **done** | `a000167` | 1 | artifact-to-store routing |
| 31.7 | **done** | `91604f0` | 1 | legacy compat + offered migration |
| 31.8 | **done** | `bf91a2a` | **0** | Confluence space + root page |
| 31.11 | **done** | `a717620` | 0 | install scope consequence |
| 31.12 | **done** | `ee3bd91` | 1 | FR250 degradation path |
| 31.13 | **done** | `07ef352` | 1 | `ma-agents bind` + scope reporting |
| **31.9** | **review** | — | 2 (cap spent) | MCP-conditional routing — fix round 2 at `0e5b72b`, re-review in flight |
| **31.10** | **not started** | — | — | blocked on 31.9. Largest new surface; OQ-4 settled by 31.8 |
| **31.14** | **not started** | — | — | release gate; blocked on everything |

## The one number that characterises this epic

**Not one implementer's self-reported mutation score survived independent attack, except Story 31.8's.**

| story | implementer claimed | independent reviewer found |
|---|---|---|
| 2A | — | 4 survivors, all killed |
| 31.3 | 23/23 killed | **4 survivors** |
| 31.4 | 29/29 killed | **15 survivors** |
| 31.5 | 25/25 killed | **5 survivors** |
| 31.6 | 39/39 killed | **17 survivors** |
| 31.8 | 35/35 killed | 3 survivors, all *missing tests* not defects |
| 31.9 | 35/35 killed | **9 survivors — three the literal FR262 degradation** |
| 31.13 | 33/33 killed | reviewer ran 0 mutants (session limit); found the blocking defect by **direct execution** instead |

**Nine of thirteen units required a fix round; three required two.** The review is not ceremony here — it is the mechanism that found every blocking defect in this epic.

## The recurring defect, and its six variants

Named in wave 1 as *"validation, or a default, that degrades to permissive instead of failing loud."* Waves 3–6 showed it has a family:

1. **Permissive default** — the wizard default indistinguishable from a real answer (2B / B-1).
2. **Test proves presence, not effect** — Story 31.11's bind offer, shipped where **0 of 45 `SKILL.md` files** direct an agent to read it.
3. **Test validates a transcription, not the artifact** — Story 31.4's entire P4 derivation table deletable from all 41 shipped copies with a green suite, because the tests validated `runGuard()`, a hand-written copy.
4. **Tautological test** — expectation and code drawn from the same source, so both move together. **Six instances**, including one where two identically-worded wizard questions would have shipped green (31.5 M20), and one where `X === X` let the *architecture document* be reassigned to the wrong store (31.6 BLOCKING-1).
5. **Denylist instead of a closed set** — Story 31.12's tone check walked past by `re-run without` ≠ `run again without`; Story 31.9's B2 message walked past by wording chosen to miss all seven banned phrases.
6. **Success reported over a failed write** — Story 31.13's bind printed both "left UNBOUND" and "Bound.", exited 0, and registered the project, because `writeProjectLayoutYaml` swallowed the failure and returned void, making the caller's own `try/catch` **dead code**.

The countermeasure that worked repeatedly: **bind the assertion to an outside authority**. Story 31.6's routing coverage is parsed from the PRD shard; Story 31.9's store binding is derived from Story 31.6's routing table *and* the PRD; Story 31.4's P4 table is measured against the real generator. Where an outside authority was impossible, a **closed set** beat a denylist every time.

## Defects filed, not fixed in-epic — 31.14 must disposition all of these

1. **`bug-31-4-preflight-block-breaks-story-15-5-verbatim-invariant.md`** — a merged story broke a suite (`story-15-5-workflow-skills` 157/0 on `main`, **153/4** here), bisected to `38c7f8c`. **Four review rounds never ran that suite.** A genuine contradiction: Story 15.5 requires verbatim content, Story 31.4 requires an embedded gateway block. Three candidate resolutions, none chosen.
2. **`bug-tests-mutate-the-repository-they-run-in.md`** — `repo-layout` performs a real install into its own worktree (~521 paths); `build-plugin`'s *test* leaks an orphan build dir. This is the mechanism behind the false failures seen all epic (`two-store-round-trip` 30/16, `config-storage` 15/1 under concurrency, both clean when quiet).
3. **`bug-store-from-raw-open-codes-the-default-backend.md`** — a fourth spelling of a closed enum.
4. **`bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store.md`** — filed by 2B, narrowed by 31.3, handed to 31.6.
5. **`bug-bmad-knowledge-atlas-renders-a-confluence-backed-store-from-stale-local-files.md`** — **not** an FR262 violation (FR262 is conditioned on MCP-absence; this is unconditional) but the same user harm. **Story 31.9's deferral target was falsified** — 31.10's eight ACs do not cover it, and it needs a code gate in compiled Atlas engine code plus a `build:atlas` rebuild, unlike every other gate in the epic.
6. **`bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate.md`** — a real AC7-vs-FR262 contradiction. No shipped ma-agents skill resolves a system-requirements artifact; those consumers are upstream BMM workflows the product does not ship. **Lifting AC7 would not fix it.** Four candidate resolutions, none chosen.
7. **`bug-31-2-ac5-no-rewrite-half-was-never-implemented.md`** — **closed by 31.7.** 31.2 AC5 (`epics.md:5316`) required a pre-F26 layout be read "with no error and no rewrite"; only the read half shipped, and two of 31.2's own tests **pinned the defect**.

## Open questions — final disposition

- **OQ-1** — settled by 31.13: `~/.ma-agents/bound-projects.json`, per-machine, status-only, verified structurally (no resolver dependency, one import site, two display-only consumers).
- **OQ-2** — settled by 31.3: content-based `sha256:` stamp over a canonical re-serialization of the three location records. **C-6 remains OPEN** — P5-9.3 still specifies mtime; reported, deliberately not resolved, needs a planning pass.
- **OQ-3** — settled by 31.4 **by falsifying the question's premise**: the 32 `{output_folder}` consumers do **not** inherit from the 7 readers (7 MIL-498 workflows, four personas and `sqa-audit` read `config.yaml` directly). Answer: **27 entry docs / 15 skills**, on the criterion "resolves a field `generateBmmConfig` derives from the binding". `epics.md:5626`'s "39 = 7 + 32" arithmetic no longer matches the tree.
- **OQ-4** — settled by 31.8: human-readable **title** at configuration time, `id: null`, **forced by AC7** (resolving a title to a page id requires asking Confluence). A learned id is carried forward only while the title is unchanged. **31.10 must honour this.**
- **OQ-5** — **decided by the user, 2026-08-12: the software requirements store.** Recorded with rationale and rejected alternatives; 31.6 pins it against a real generated config.
- **OQ-6** — two remote-git stores: sequential single-clone behaviour applied twice, accepted.

## Environment facts for whoever picks this up

- **The Atlassian Rovo MCP is unauthorized and cannot be authorized non-interactively.** Story 31.9's MCP-**absent** path is genuinely tested (it is the default state); the MCP-**present** branch is **mock-verified only**. 31.10 inherits this limit. 31.14 must record it rather than paper over it.
- **Known pre-existing baseline failures, all verified on `main` @ `9b936ac`:** `bmad-output-policy`; two `custom-marketplace-*`; `migration-validation` (199/3); `build-plugin` (35/1); `bmad-version-bump`, `staging-6-10-0-regression`, `v68-pluginresolver` (bmad-method 6.9.0 vs 6.10.0 in the shared `node_modules`); `knowledge-atlas-smoke`/`-render` (missing `esbuild`/`lunr`).
- **A defect class now HANGS `npm test` rather than failing it** (31.13's L1/L2/L3): the prompt stub returns `''` forever and the wizard retries empty-path validation unbounded, and the suite has no timeout of its own. Directly relevant to 31.14 AC9.
- **Agent-infrastructure losses this run:** 6 watchdog kills, 3 API errors, 2 session limits, plus several process exits. **Three agents left live mutants in working trees**; all were caught before commit by a line-by-line diff audit. Standing rules that fixed it: mutate only in a byte-for-byte lab copy (**never `git archive`** — line-ending normalisation produced false survivors three times), validate anchors against each file's own EOL, and commit after every small step.
- **Two orchestrator sequencing errors, both mine:** I dispatched a fix round while a reviewer was still live on the same worktree, and removed a worktree from under a running agent. No work was lost either time, but the rule now is: confirm every agent on a worktree has terminated before merging or removing it.

## Invariants to preserve

- **Story 31.4's preflight: 41 copies / 1 sha256** (13 `skills/` + 14 `lib/bmad-extension/` + 14 `lib/bmad-extension-plugin/`). Its P4 table is bound three ways to the real generator.
- **Story 31.9's gate: 9 copies / 1 sha256**, anchored on the exact `## Knowledge Store Backend Routing` heading — a loose `Backend Routing` probe also catches Story 17.22's sprint block.
- **FR266 has no implementation.** No mirror, cache, sync direction, sync trigger, authority call or conflict resolution. **31.14 AC7's negative check is the last line of defence**, and P5-9.6 names an accidental mirror as the single most likely way this epic reacquires the subsystem it removed.

## Story 31.14 — three fix rounds, five bypasses, and the honest state of the FR266 negative

Story 31.14 is the release-gate record. It went through **three fix rounds** — one above the cap I set, dispatched because independent verification proved the record contained a **false statement**. Branch `feature/epic-31-story-31.14`, HEAD **`7d35970`**. Suite `test/release-gate-epic-31.test.js` at **40 passed / 0 failed**.

**Five independent attacks were mounted against the FR266 negative check. Every one found a live bypass in the check as it stood at the start of that round. None was exotic.**

| # | Attack | Result when mounted | Closed by |
|---|---|---|---|
| 1–3 | Round-1 mirrors (noun-based) | passed green | round 1 |
| 4a | Plain-English mirror, zero architecture nouns — *"download every Confluence page… save it under `_bmad-output/pages/`… upload your edits back"* | **37/0, exit 0** | verb family (round 2) |
| 4b | Five-line split (the window is four lines) | evades | **still open — item 15** |
| 5 | *"copy each page you read into … and re-read it from there"*, and the `write` form | **38/0, exit 0** | `AC7.5f` (round 3) |

**Attack 5 matters most**: it used two of the five verbs **the product's own shipped prohibition names out loud** — *"do NOT write, copy, cache, export or reconcile a local copy of anything Confluence returns"* — and the detector enforcing that sentence could not see either. The fix is not a third list extension: **`AC7.5f` parses the prohibited-verb list out of the shipped bytes** across all 9 copies and fails if the product ever forbids a verb the detector cannot see. It closes the vocabulary against the product's own enumeration **and nothing wider**.

**The controls written to close these gaps were themselves defective, twice:**
- `AC7.5e` (round 2's flagship) asserted over regex **source text** (`why.join(' ')`) — satisfiable by a vocabulary in which two of its three claimed verbs could never match.
- `AC7.5g` (round 3's own new test) asserted about every plant it was **given** and nothing about how many — deleting an attack from its set left the suite at **40/0**. Caught by mutation, not by reading.

This is the epic's recurring **"proves presence, not effect"** shape, appearing inside the control written to close the previous instance of it.

**Adjudicated passages: 17** (7 `README.md`, 3 `docs/architecture.md`, 7 `lib/bmad-cache/**`), re-derived from `ADJUDICATED_MIRROR_PASSAGES`. **Seven are vendored upstream text** regenerated by `scripts/build-bmad-cache.js`, so they churn on an upstream bump. Digest-pinning was chosen over a path exclusion deliberately — a path rule reopens the scope hole across 666 shipped files.

**A count in this record has been stale at every single review round without exception.** Two dedicated count sweeps each left a stale figure behind, including a flatly false *"Zero hits in all 666 `lib/bmad-cache/**` files"* that survived a sweep editing the same paragraph. **Re-derive every figure from the code; do not trust the prose.**

### The honest verdict, and it is not "closed"

**Safe as a record. Not safe as a gate.** It supports *"no FR266 implementation was found by a check with named, live holes."* It does **not** support *"FR266 is proven absent"* — and if anyone quotes it as the latter, the quote is wrong regardless of what the suite returns. §9 now carries 29 items, every forward reference resolving.

### The sixth attack is already identified, and it is not linguistic

**The non-markdown scope hole (item 16).** `AC7.5f` binds the *vocabulary*; it does nothing about *scope*. Put a mirror instruction in a shipped `.toml`, `.yaml` or `MANIFEST.yaml` and no verb, window or subject filter is ever consulted. **The vehicle already exists in the tree:** `lib/bmad-cache/…/gds-create-game-brief/SKILL.md:99` instructs an agent to *execute each entry in `{workflow.external_handoffs}`*, and `customize.toml:114` — shipped, unscanned — is exactly where such an entry is authored, already containing *"upload brief.md and addendum.md to Confluence via corp:confluence_upload"*. A handoff there with a read-back direction would be a live, executed mirror in a file nothing scans. **This is a scope decision for the human at the gate, not an implementer's call.**

Ranked behind it: a verb outside the product's five (`persist`, `stash`, `snapshot`, `vendor`); the five-line split (item 15); and splitting subject from verb beyond the four-line window by naming the store by pronoun.

<!-- updated at every state transition -->
