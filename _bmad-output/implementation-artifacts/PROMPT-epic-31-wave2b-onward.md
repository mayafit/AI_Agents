---
type: agent-prompt
status: ready to use
created: 2026-08-10
subject: Finish Epic 31 (F26) from wave 2B to completion via bmad-dev-epic
supersedes: PROMPT-epic-31-wave2-onward.md (wave 2A complete, 2B in review)
---

# Agent prompt — finish Epic 31, resuming at wave 2B

Copy everything below the line into a fresh agent. Self-contained: assumes no context from the
planning, wave-1 or wave-2A conversations.

---

Drive **Epic 31 — Global Installation & Federated Knowledge Stores** to completion using the
**`bmad-dev-epic`** skill. Wave 1 and prerequisite 2A are merged; **prerequisite 2B is implemented
and awaiting a fix round, and 12 of 14 stories remain**. You are the Epic Orchestrator: you do not
write story code yourself, you plan dependency-ordered waves, spawn per-story subagents, enforce a
Definition of Done, and stop at the two human release gates.

The goal is to **finish the epic properly**, not quickly. Across six independent reviews so far,
**five found genuine blocking defects** — including a credential injection into a committed file, a
24-test suite that exited 0 having reported nothing, and an installer path that silently deletes a
Confluence space key from a committed file. Budget for that: assume every story needs an independent
review and that the review will find something.

## Where to work

- **Worktree:** `d:\Code\AI_Agents-epic-31`, branch **`feature/epic-31`**, head **`6fb6f33`**.
  A `node_modules` junction is already in place.
- **Do not** work in `d:\Code\AI_Agents` (that is `main`, at `9b936ac`).
- **Live prerequisite worktree:** `.worktrees/epic-31-prereq-read-path` on branch
  `feature/epic-31-prereq-read-path`, head **`140190d`**, working tree clean, `node_modules`
  junctioned. **This is wave 2B and it is not merged.** See "Start here".
- `.worktrees/` is gitignored (`.gitignore:31`), so nested story worktrees are safe.
- Earlier worktrees named `AI_Agents-knowledge-stores`, `AI_Agents-fix-stage-leak` and
  `AI_Agents-epic-31/.worktrees/epic-31-prereq-shared-enums` **no longer exist**. Any path
  referencing them is stale.

## Three environment gotchas that will otherwise waste your time

1. **`_bmad/` is gitignored and therefore ABSENT from every worktree.** The skill's activation loads
   `_bmad/bmm/config.yaml` and `_bmad/scripts/resolve_customization.py` — resolve both from the main
   tree, `d:\Code\AI_Agents\_bmad\...`. Same project; `_bmad/` is per-machine install state. (This is
   itself one of the defects F26 fixes.)
2. **`uv` is not on PATH and `python3` may not resolve — use plain `python`.** With that,
   `resolve_customization.py --skill <skill-root> --key workflow` succeeds. There is no team or user
   override TOML for `bmad-dev-epic`, so `customize.toml`'s defaults are in effect.
3. **A fresh git worktree has no `node_modules`.** Every story worktree needs one before tests run:
   `New-Item -ItemType Junction -Path <worktree>\node_modules -Target d:\Code\AI_Agents\node_modules`.

## Read before intake

`_bmad-output/planning-artifacts/prd.md` (index — the F26 section carries the thesis, glossary,
assumptions, non-goals and open items), then the two F26 capability shards under
`prd/capabilities/` (`bmad-integration-and-bundling.md` for FR248–FR253/NFR76–78,
`project-knowledge-and-repository-layout.md` for FR254–FR267/NFR79–83), then
`architecture/decisions/project-knowledge-and-repository-layout.md` (**Decision P5-9**, eight
sub-decisions plus the appended FR250 spike verdict), then `epics.md` § Epic 31 (starts at line
5247), then `implementation-artifacts/sprint-status.yaml`, then
**`implementation-artifacts/epic-runs/31/run-ledger.md`** — which carries the full wave-1 and wave-2
record including every finding, mutation tally and carry-forward. Read the ledger properly; it is
the densest and most useful document in the set.

**Parse markdown fence-aware.** The P5-9 decision file contains fenced ```markdown blocks holding
the generated `project-context.md` template. Lines inside them look like headings
(`## AI Agent Mandatory Rules`, `## Technology Stack`, `## Project-Specific Rules`,
`### Repository Layout`) but are template text. A naive `grep '^## '` misleads — this trap already
caused one wrong document split in this effort.

## START HERE — wave 2B has an open blocking finding and a decided fix

Prerequisite 2B (`feature/epic-31-prereq-read-path`, head `140190d`) is implemented and has been
independently reviewed once: **CHANGES-REQUIRED, one blocking finding.** A fix round was dispatched
and the implementer agent was **stopped before producing any work** — zero commits, zero uncommitted
changes, **0 of 2 fix rounds consumed**. Nothing was lost.

**Do not re-review `140190d` from scratch and do not re-derive what the review already established.**
The ledger's "2B — verified correct by review; do not re-derive" section lists what is settled: the
preservation/guard composition (23 malformed fixtures, 0 bypasses), NFR81 (6 writes → 1 output,
convergent), display totality (23 malformations × 3 entry points, 0 crashes), the 12 legacy
combinations, wave 2A's invariants, and both design disclosures (one-commit and the AC3 limitation)
adjudicated sound.

**The open blocking finding, B-1.** `ma-agents install --yes` still destroys a committed Confluence
store, because `bin/cli.js:2372` is `const existingLayout = isUpdate ? readExistingLayout() : null;`
and `isUpdate` is true **only** for the interactive "Update (add/remove skills)" choice — false for
every `--yes` run and every fresh clone. Reproduced with the real CLI: a non-divergent Confluence
pair loses **both** stores with **zero output in the entire install log**. This leaves the read bug's
AC1 ("survives an **install** and a `config layout` run") textually unmet.

**The fix is already decided — implement it, do not re-litigate it.** Make `bin/cli.js:2372`
unconditional (`readExistingLayout()` always). The reviewer's narrower alternative — preserve only
records whose backend is `confluence` — was **rejected as incomplete**, because two `file-system`
stores in different locations is FR258's *normal* case and would still be collapsed. The four
consequences to work through (virgin-project invariance; the FR265 `config.yaml` fallback becoming
reachable on fresh installs and whether `config-lost-on-update`'s 13 tests pin today's behaviour as
*desired*; Confluence stores reaching `writeRepoLayoutConfig`/`generateRepoLayoutSection`; and the
missing install-path tests) are spelled out in the ledger under "Directed fix". Also fold in the open
non-blocking items N-1, N-2, N-4 and N-6 listed there.

**Do not decide what `knowledgebase_path` means for a Confluence-backed software store.** That is a
genuine Story 31.3/31.6 question. Make the behaviour safe and explicit, pin it with a test, and file
the open question.

Then re-review the changed surface with an independent agent, and merge 2B only on a reviewer verdict.

## What waves 1 and 2A settled — do not re-derive or re-litigate

- **Story 31.1 (FR250 spike): verdict FAIL.** bmad-method 6.10.0 has no user-level install target
  and, decisively, no module-resolution search order that could find one — `findBmadDir` is a single
  `path.join`, `resolve_config.py` hard-fails, ~211 `{project-root}/_bmad/…` literals across 46
  skills, no `BMAD_HOME`. `bmad install --global` errors as an unknown option. `--directory $HOME`
  writes a phantom project nothing reads. **Consequence: Story 31.12 is a messaging-and-gating
  change, not an installer capability.** Keep the filter at `bin/cli.js:1440-1452` and the guard at
  `:1455`; replace only the warning block at `:1446-1450` with FR250's three required facts, framed
  as designed behaviour rather than a warning; add a regression test so the message cannot rot. Watch
  upstream issue **#1728** (OPEN, `priority:high`) as the re-open trigger — its `bmad link` is the
  analogue of `ma-agents bind`, so **31.13 should reconcile with it rather than duplicate it**.
- **Story 31.2 (binding spine) is merged and hardened.** `_bmad-output/project-layout.yaml` is the
  authoritative record; `resolveProjectTopology` returns a **discriminated result**
  `{ok:true,topology}` / `{ok:false,reason:'unbound'|'unreadable'|'invalid'|'too-new',message}` and
  never throws. A non-destruction guard inside `writeProjectLayoutYaml` refuses to overwrite an
  invalid binding. `yamlEscapeValue` is a total escaper that never throws; policy rejection lives at
  the serializer boundary in `assertSingleLineIdentity`. The js-yaml validity gate runs **before** the
  schema gate. All three consumers branch on `reason !== BINDING_UNBOUND`, so new reasons land in the
  refuse bucket automatically (default-deny). **Do not revert any of it** — it survived four review
  rounds, 28+ killed mutations and a 20,000-value property test.
- **Story 31.2 AC2's wording is settled:** "unconditionally on every install" means unconditional
  with respect to **repo layout**, not install scope. The `installScope === 'project'` gate stays —
  FR251 requires that a global install writes no `project-layout.yaml`.
- **FR266 was RETIRED before implementation.** There is **no** local mirror, cache, sync or conflict
  resolution for Confluence stores. If you find yourself planning one, you have misread P5-9.6.
  Story 31.14 carries a **negative traceability check** that no such code landed — honour it.
- **`config.user.yaml` does not exist.** Per-developer overrides are `_bmad/config.user.toml` and
  `_bmad/custom/config.user.toml`. A test against `config.user.yaml` passes vacuously.
- **The install-scope question already exists** at `bin/cli.js:1414-1437`. FR248 was narrowed
  accordingly; 31.11 changes the *consequence* of choosing global, not the prompt.
- **The default module set is bmm + tea + bmb + cis** (FR123 as amended); `gds` and `wds` are bundled
  but opt-in.
- **Wave 2A (merged, `bb35cac`): the shared closed-enum source is done.** Each closed enum —
  `STORE_MODES`, `SPRINT_MODES`, `STORE_BACKENDS` — has exactly one definition, consumed by the
  reader, the writer **and** the wizard prompt. Exported enums are inert copies; `MODE_PROMPT_TITLES`
  and `STORE_BACKEND_VIEWS` are frozen; `describeValue()` is a total value renderer. This closed
  `bug-serialize-sprint-management-passes-store-modes-enum.md`, and that fix turned out
  **load-bearing, not cosmetic** — under a compound mutation (jira early return relocated *and* the
  fix reverted) sprint Jira becomes unwritable. **Do not "fix" `requireKnownMode` to use
  `describeValue`** — its input passes through `scalarString`, so `JSON.stringify` is total there.
  The distinction is the type guard, not the function's provenance; recorded at `bin/cli.js:826-835`.

## Story 31.5's preconditions — status

Story 31.5 was gated on three filed defects. **Two are closed and one remains:**

- `bug-serialize-sprint-management-passes-store-modes-enum.md` — **CLOSED** by wave 2A (`bb35cac`).
- `bug-read-existing-layout-collapses-two-stores-onto-software-store.md` — **fix written
  (`140190d`), NOT merged.** AC1 unmet on the install path. This is B-1 above.
- `bug-show-current-layout-prints-undefined-for-confluence-store.md` — **fix written (`140190d`),
  NOT merged.** Ships with 2B.

**Story 31.5 must not start until 2B is merged.**

## Six carry-forwards Story 31.5 must honour (from 2A's review)

1. **Hoist the `process.on('exit')` backstop** to the top of
   `test/project-layout-enum-single-source.test.js`. It sits at `:862`, below the 22 synchronous
   tests, so a `process.exit(0)` from the synchronous phase still exits 0 with no summary.
   Unreachable today — **31.5 is the story that can make it reachable.**
2. **Bump `EXPECTED_TEST_COUNT`** when adding tests to either project-layout suite. It is a `!==`
   check, so it fails loud on a surplus as well as a shortfall.
3. **Every new wizard question needs an answer in every `runWizard(...)` queue** — the stub throws by
   name rather than defaulting, and also asserts the queue was fully consumed.
4. **Adding an enum member requires a `MODE_PROMPT_TITLES` entry** — enforced by a keys-equal-union test.
5. **`serializeSprintManagement`'s jira early return (`bin/cli.js:1224`) is still position-dependent
   for the jira *fields*.** Only the *mode* is now position-independent.
6. **Do not "fix" `requireKnownMode`** — see above.

## Suggested wave shape — adapt if the dependency graph disagrees

- **Wave 2 (prerequisites):** 2A **done**. **2B — finish B-1, review, merge.**
- **Wave 3:** `31.3` (config.yaml generated from project-layout.yaml — **unblocked**) → `31.4`
  (staleness fail-loud guard). In parallel: `31.11` (scope wizard consequence) → `31.12` (the FR250
  degradation path).
- **Wave 4:** `31.5` (two independent store questions, per-store backend) → `31.6` (artifact-to-store
  routing) ∥ `31.7` (legacy compat, migration offered never forced).
- **Wave 5:** `31.8` (Confluence space + root page) → `31.9` (MCP-conditional routing, **fail loud, no
  fallback**) → `31.10` (page tree mirroring the source tree).
- **Wave 6:** `31.13` (`ma-agents bind` + scope reporting in `ma-agents status`), then `31.14`
  (release gate).

Two carry-forwards recorded on Story 31.3's sprint-status key: the `--yes` legacy-promotion tension
belongs to its AC2, and 31.2's AC2 reading is settled.

## The defect shape this epic keeps producing — put it in every story brief

**Validation, or a default, that degrades to permissive instead of failing loud.** Five instances so
far: the `backend` read/write enum disagreement; the `mode` value channel that landed a credential
into a committed file; an assertion using `split('—')[1] || ''` that degraded to asserting nothing; a
test double that answered `{}` when its queue ran dry, making a 24-test suite exit 0 having reported
nothing; and a wizard default indistinguishable from a real answer, which is B-1. One implementer
named it well: *"a test double's default behaviour is an assertion about what the system under test
may do, and mine asserted nothing."*

## Process rules that waves 1 and 2 proved necessary

1. **The implementer NEVER sets a story to `done`.** The implementer may set `review`; **only you set
   `done`, and only after an independent review signs off.** Both wave-1 stories wrote `done` on
   self-report, and 31.2's review then returned CHANGES-REQUIRED with three blocking defects. This is
   filed as `bug-dev-epic-pipeline-does-not-own-the-story-status-field.md` — a defect in
   `bmad-dev-epic` itself (`references/story-pipeline.md:18` hands the subagent `SPRINT_STATUS`; `:85`
   states the reviewer condition; nothing assigns ownership). **Filed, deliberately not fixed
   in-epic** — it is a different subsystem with its own plugin mirror and drift guard.
2. **Never let the same agent implement and review.** The one wave-1 fix round written by the
   coordinating agent closed its three defects half way and added a new crash.
3. **Mutation-test every new test, and record the mutation list.** Revert the fix, confirm the suite
   goes red. Wave 1 shipped a CRLF test that verified nothing — `trim()` laundered the very channel it
   claimed to test. Wave 2B's unrecorded mutation list is why one of its claims was unverifiable.
4. **Verify claims against source, with file:line citations.** Off-by-N citations have propagated
   repeatedly here — three in one review brief alone. **Reproduce a defect against the parent commit
   before fixing it**; a handed-down PoC may be incomplete.
5. **Report contradictions; do not edit requirements to make them go away.** The planning chain has
   been through a reviewer gate, a readiness review and a delta verification, so an apparent
   contradiction is more likely a real finding.
6. **Watch for tests that pass for the wrong reason.** 2B's headline AC1 test passed because its
   fixture was the one case where the broken path is accidentally harmless.

## Testing and packaging rules

- **Do not trust the chained `npm test`.** It halts on pre-existing MIL-498 template CRLF drift on
  Windows and masks real breakage. Run affected files **directly**: `node test/<file>.test.js`.
  Check exit codes separately from printed counts.
- **Never wrap a suite in `timeout`.** `repo-layout` runs a full install and returns exit **143
  (SIGTERM)** if killed, which looks exactly like a failure and is not.
- **Baseline before blaming yourself.** `bmad-output-policy` has a known pre-existing README
  H2-ordering failure, and two `custom-marketplace-*` suites fail, on unmodified `main` at `9b936ac`.
- **Current green baseline on `feature/epic-31` (`6fb6f33`), all verified:** `binding-spine` **69**,
  `enum-single-source` **25**, `config-storage` 16, `config-lost-on-update` 13, `portable-paths` 20,
  `config-layout` 6, `reconfigure` 12, `repo-layout` 13. On the 2B branch, additionally
  `two-store-round-trip` **38**.
- **Any change under `lib/bmad-extension/skills/` requires `npm run build:plugin`** plus a commit of
  the regenerated `lib/bmad-extension-plugin/` mirror, or CI's Bundle Drift Guard fails.
- **Clean up after test runs.** They regenerate ~521 paths: `.agents/`, `AGENTS.md`,
  `AGENTS.md.backup-*`, `.ma-agents.json`, `_bmad-output/project-context.md` and a root
  `project-layout.yaml`. Restore with `git checkout -- .agents AGENTS.md _bmad-output`, explicit `rm`
  of the root files, and `git clean -fdq .agents _bmad-output` — **no `-x`**, or you delete the
  `node_modules` junction. Every commit must contain only intended files.
- New test file ⇒ register it in `package.json`'s `test` chain (an explicit `&&`-list, not a glob;
  separator is ` && node `). Change nothing else in `package.json`.
- Use **js-yaml** as an oracle where YAML is emitted — a declared direct dependency. Assert output
  parses under a real parser, not only under the hand-rolled `parseLayoutYaml`.

## Boundaries

- **Honour the two human release gates** — before the beta publish and before the epic PR. **Do not
  publish to npm and do not open a PR.** Stop and report at each.
- **Do not push any branch** without being asked. Report what would be pushed.
- **CI is broken at the GitHub account level** — every job dies within seconds, zero steps executed,
  no runner assigned, no logs, across all workflows. Unrelated to your work and unfixable from here.
  Ignore red checks entirely. All verification is local.
- **Do not touch bug B3** (root `skills/` directory) — parked pending a human decision; see
  `HANDOFF-B3-root-skills-dir.md`.
- Three further filed defects are **out of scope** for this epic: the `uninstall-skill` hardcoded
  project scope (a latent global-*update* bug, five sites: 1214, 1246, 1256, 1668, 1680), FR123's
  stale `--custom-content` flag name (capability F3, documentation only), and the `bmad-dev-epic`
  status-ownership defect. Leave all three filed.
- Do not modify the PRD, Decision P5-9 or `epics.md` story definitions to resolve an implementation
  problem. **Note:** `sprint-status.yaml`'s Epic 31 comments carry superseded text that `epics.md`
  already corrected — `31-11` still says a project install must be "BYTE-IDENTICAL to today's"
  (NFR76 was rebaselined to the post-31.2 tree, `epics.md:5526`) and still says the scope question
  needs promoting (amended FR248 removed that); `31-3` and `31-13` still name `config.user.yaml`.
  **`epics.md` is authoritative.** Cut story briefs from it, not from the sprint-status comments.

## Report back

At each halt: the Run Ledger path; per-story outcome with commit SHAs; review verdicts and what each
round found; test results with any failure baselined against `main`; what is staged at each gate;
every defect filed; and anything you stopped on or judged out of scope.

When the epic is complete, also report: FR/NFR traceability across the full live F26 set
(FR248–FR265, FR267, NFR76–NFR83 — **FR266 is retired and must have no implementation**), the
negative traceability result for FR266, and a recommended semver bump with its rationale (31.14 AC8
says MINOR — feature addition, no breaking CLI change, consistent with prior epics).
