---
type: agent-prompt
status: ready to use
created: 2026-08-09
subject: Drive Epic 31 (F26) from wave 2 to completion via bmad-dev-epic
supersedes: PROMPT-epic-31-dev-run.md (wave 1, complete)
---

# Agent prompt — finish Epic 31

Copy everything below the line into a fresh agent. Self-contained: assumes no context from
the planning or wave-1 conversations.

---

Drive **Epic 31 — Global Installation & Federated Knowledge Stores** to completion using the
**`bmad-dev-epic`** skill. Wave 1 is done; **12 of 14 stories remain**. You are the Epic
Orchestrator: you do not write story code yourself, you plan dependency-ordered waves, spawn
per-story subagents, enforce a Definition of Done, and stop at the two human release gates.

The goal is to **finish the epic properly**, not quickly. Three of the four review rounds in
wave 1 found genuine blocking defects, including a credential injection into a committed file.
Budget for that: assume every story needs an independent review and that the review will find
something.

## Where to work

- **Worktree:** `d:\Code\AI_Agents-epic-31`, branch **`feature/epic-31`** at `01de99f`.
  A `node_modules` junction is already in place here.
- **Do not** work in `d:\Code\AI_Agents` (that is `main`, at `9b936ac`).
- Earlier worktrees named `AI_Agents-knowledge-stores` and `AI_Agents-fix-stage-leak` **no
  longer exist** — they were merged and removed. Any path referencing them is stale.
- `feature/epic-31` already contains `main`, so the planning artifacts and the F26 requirements
  are present in your branch. Story branches cut from it inherit them.

## Three environment gotchas that will otherwise waste your time

1. **`_bmad/` is gitignored and therefore ABSENT from every worktree.** The skill's activation
   loads `_bmad/bmm/config.yaml` and `_bmad/scripts/resolve_customization.py` — resolve both
   from the main tree, `d:\Code\AI_Agents\_bmad\...`. Same project; `_bmad/` is per-machine
   install state. (This is itself one of the defects F26 fixes.)
2. **`uv` is not on PATH and `python3` may not resolve — use plain `python`.** If
   `resolve_customization.py` still fails, the skill's own documented fallback (merge
   `customize.toml` yourself in base → team → user order) is fine.
3. **A fresh git worktree has no `node_modules`.** Every story worktree needs one before tests
   run: `New-Item -ItemType Junction -Path <worktree>\node_modules -Target d:\Code\AI_Agents\node_modules`.

## Read before intake

`_bmad-output/planning-artifacts/prd.md` (index — the F26 section carries the thesis, glossary,
assumptions, non-goals and open items), then the two F26 capability shards under
`prd/capabilities/`, then `architecture/decisions/project-knowledge-and-repository-layout.md`
(**Decision P5-9**, eight sub-decisions), then `epics.md` § Epic 31, then
`implementation-artifacts/sprint-status.yaml`, then
`implementation-artifacts/epic-runs/31/run-ledger.md` for what wave 1 established.

**Parse markdown fence-aware.** The P5-9 decision file contains fenced ```markdown blocks
holding the generated `project-context.md` template. Lines inside them look like headings
(`## AI Agent Mandatory Rules`, `## Technology Stack`, `## Project-Specific Rules`,
`### Repository Layout`) but are template text. A naive `grep '^## '` misleads — this trap
already caused one wrong document split in this effort.

## What wave 1 settled — do not re-derive or re-litigate

- **Story 31.1 (FR250 spike): verdict FAIL.** bmad-method 6.10.0 has no user-level install
  target and, decisively, no module-resolution search order that could find one — `findBmadDir`
  is a single `path.join`, `resolve_config.py` hard-fails, ~211 `{project-root}/_bmad/…`
  literals across 46 skills, no `BMAD_HOME`. `bmad install --global` errors as an unknown
  option. `--directory $HOME` writes a phantom project nothing reads.
  **Consequence: Story 31.12 is a messaging-and-gating change, not an installer capability.**
  Keep the filter at `bin/cli.js:1440-1452` and the guard at `:1455`; replace only the warning
  block at `:1446-1450` with FR250's three required facts, framed as designed behaviour rather
  than a warning; add a regression test so the message cannot rot. Watch upstream issue
  **#1728** (OPEN, `priority:high`) as the re-open trigger — its `bmad link` is the analogue of
  `ma-agents bind`, so **31.13 should reconcile with it rather than duplicate it**.
- **Story 31.2 (binding spine) is merged and hardened.** `_bmad-output/project-layout.yaml` is
  the authoritative record; `resolveProjectTopology` returns a **discriminated result**
  `{ok:true, topology}` / `{ok:false, reason:'unbound'|'unreadable'|'invalid'|'too-new', message}`
  and never throws. A non-destruction guard inside `writeProjectLayoutYaml` refuses to overwrite
  an invalid binding. `yamlEscapeValue` is a total, correct escaper — it never throws; policy
  rejection lives at the serializer boundary in `assertSingleLineIdentity`. **Do not revert any
  of that**; it survived four review rounds, 28+ killed mutations and a 20,000-value property test.
- **Story 31.2 AC2's wording is settled:** "unconditionally on every install" means
  unconditional with respect to **repo layout**, not install scope. The
  `installScope === 'project'` gate stays — FR251 requires that a global install writes no
  `project-layout.yaml`. Do not remove that gate to satisfy AC2 literally.
- **FR266 was RETIRED before implementation.** There is **no** local mirror, cache, sync or
  conflict resolution for Confluence stores. If you find yourself planning one, you have misread
  P5-9.6. Story 31.14 carries a **negative traceability check** that no such code landed —
  honour it.
- **`config.user.yaml` does not exist.** Per-developer overrides are `_bmad/config.user.toml`
  and `_bmad/custom/config.user.toml`. A test against `config.user.yaml` passes vacuously.
- **The install-scope question already exists** at `bin/cli.js:1414-1437`. FR248 was narrowed
  accordingly; 31.11 changes the *consequence* of choosing global, not the prompt.
- **The default module set is bmm + tea + bmb + cis** (FR123 as amended); `gds` and `wds` are
  bundled but opt-in.

## Do this FIRST, before any story: the shared-enum refactor

Three separate reviews found **write-side and read-side validation disagreeing about a closed
enum** — `backend` (found as B-1), `mode` (found as N-1, which allowed a credential-shaped key
into a committed file), and `SPRINT_MODES` vs `STORE_MODES` (filed as a bug). Fixing instances
individually is losing to the pattern, and **Story 31.5 introduces per-store `backend` and
`mode` answers, doubling the surface**.

Define each enum **once** and share it across both directions — reader, writer, and any wizard
prompt that produces a value. Then the three filed defects below become mechanical.

This is prerequisite engineering, not a story. Treat it as such: its own branch, its own review,
merged before 31.5 planning starts.

## Story 31.5 is BLOCKED on three filed defects

All three are in `_bmad-output/implementation-artifacts/`. Fix them before 31.5, because 31.5 is
the story that first *creates* the states they corrupt:

1. **`bug-read-existing-layout-collapses-two-stores-onto-software-store.md`** — the serious one.
   `readExistingLayout` collapses two distinct stores onto the software store, and the
   unconditional write then stamps that over **both** records. Not a 31.2 regression (byte-identical
   at parent and HEAD) but it destroys 31.5's own output on the next install, violating P5-9.5
   ("the two stores are independent").
2. **`bug-show-current-layout-prints-undefined-for-confluence-store.md`** — compounds the first:
   a user shown `Mode: undefined / Path: undefined` may re-run the wizard and overwrite the
   store for real.
3. **`bug-serialize-sprint-management-passes-store-modes-enum.md`** — dead-code-equivalent today
   because `sprint.mode === 'jira'` early-returns above it, but latent, and subsumed by the enum
   refactor above.

## Suggested wave shape — adapt if the dependency graph disagrees

Let the skill plan waves, but this is the shape the dependencies imply:

- **Wave 2 (prerequisites):** shared-enum refactor, then the three 31.5-gating defects.
- **Wave 3:** `31.3` (config.yaml generated from project-layout.yaml — **unblocked now**) →
  `31.4` (staleness fail-loud guard). In parallel: `31.11` (scope wizard consequence) → `31.12`
  (the FR250 degradation path).
- **Wave 4:** `31.5` (two independent store questions, per-store backend) → `31.6` (artifact-to-store
  routing) ∥ `31.7` (legacy compat, migration offered never forced).
- **Wave 5:** `31.8` (Confluence space + root page) → `31.9` (MCP-conditional routing, **fail
  loud, no fallback**) → `31.10` (page tree mirroring the source tree).
- **Wave 6:** `31.13` (`ma-agents bind` + scope reporting in `ma-agents status`), then `31.14`
  (release gate).

Two carry-forwards recorded on Story 31.3's sprint-status key: the `--yes` legacy-promotion
tension belongs to its AC2, and 31.2's AC2 reading is settled.

## Process rules that wave 1 proved necessary

These are not bureaucracy — each one exists because its absence cost a rework cycle.

1. **The implementer NEVER sets a story to `done`.** The implementer may set `review`; **only you
   set `done`, and only after an independent review signs off.** Both wave-1 stories wrote `done`
   on self-report, and 31.2's review then returned CHANGES-REQUIRED with three blocking defects —
   so downstream stories could have unblocked off a spine with a falsified security AC. Root cause:
   `references/story-pipeline.md` requires "no blocking findings remain" in its DoD but never says
   who owns the status field. **File a story against `bmad-dev-epic` itself for this** — it will
   invert the gate on every future epic otherwise.
2. **Never let the same agent implement and review.** The one wave-1 fix round written by the
   coordinating agent rather than a separate implementer was the weakest of three: it closed all
   three defects only half way and introduced a new crash. Independent review caught it; nothing
   else would have.
3. **Mutation-test your own tests.** For each new test, revert its fix and confirm the suite goes
   red. Wave 1 shipped a CRLF test that verified nothing — `trim()` laundered the very channel it
   claimed to test — and only mutation testing exposed it.
4. **Verify claims against source, with file:line citations.** Several citations in these documents
   were off by one and propagated across three files. Also: a handed-down PoC may be incomplete —
   wave 1 received two fixtures that did not reproduce until completed. **Reproduce a defect against
   the parent commit before fixing it.**
5. **Report contradictions; do not edit requirements to make them go away.** The planning chain has
   been through a reviewer gate, a readiness review and a delta verification, so an apparent
   contradiction is more likely a real finding. If a story is wrong, stop and say so.

## Testing and packaging rules

- **Do not trust the chained `npm test`.** It halts on pre-existing MIL-498 template CRLF drift on
  Windows and masks real breakage. Run affected files **directly**: `node test/<file>.test.js`.
- **Never wrap a suite in `timeout`.** `repo-layout` runs a full install and returns exit **143
  (SIGTERM)** if killed, which looks exactly like a failure and is not.
- **Baseline before blaming yourself.** `bmad-output-policy` has a known pre-existing README
  H2-ordering failure, and two `custom-marketplace-*` suites fail, on unmodified `main` at
  `9b936ac`. Run the same file against `d:\Code\AI_Agents` and compare before reporting a regression.
- Current green baseline on `feature/epic-31`: binding-spine **69**, config-storage 16,
  config-lost-on-update 13, portable-paths 20, config-layout 6, reconfigure 12, repo-layout 13.
- **Any change under `lib/bmad-extension/skills/` requires `npm run build:plugin`** plus a commit
  of the regenerated `lib/bmad-extension-plugin/` mirror, or CI's Bundle Drift Guard fails.
- **Clean up after test runs.** They regenerate `.agents/`, `AGENTS.md`, `.ma-agents.json`,
  `_bmad-output/project-context.md` and a root `project-layout.yaml`. Every commit must contain
  only intended files.
- Use **js-yaml** as an oracle where YAML is emitted — it is a declared direct dependency. Assert
  the output parses under a real parser, not only under the hand-rolled `parseLayoutYaml`.

## Boundaries

- **Honour the two human release gates** — before the beta publish and before the epic PR. **Do
  not publish to npm and do not open a PR.** Stop and report at each.
- **Do not push any branch** without being asked. Report what would be pushed.
- **CI is broken at the GitHub account level** — every job dies within seconds, zero steps
  executed, no runner assigned, no logs, across all workflows. It is unrelated to your work and
  cannot be fixed from here. Ignore red checks entirely; they carry no signal. All verification is
  local.
- **Do not touch bug B3** (root `skills/` directory) — parked pending a human decision; see
  `HANDOFF-B3-root-skills-dir.md`.
- Two further filed defects are **out of scope** for this epic: the `uninstall-skill` hardcoded
  project scope (a latent global-*update* bug, five sites: 1214, 1246, 1256, 1668, 1680) and
  FR123's stale `--custom-content` flag name (capability F3, documentation only). Leave both filed.
- Do not modify the PRD, Decision P5-9 or `epics.md` story definitions to resolve an implementation
  problem.

## Report back

At each halt: the Run Ledger path; per-story outcome with commit SHAs; review verdicts and what
each round found; test results with any failure baselined against `main`; what is staged at each
gate; every defect filed; and anything you stopped on or judged out of scope.

When the epic is complete, also report: FR/NFR traceability across the full live F26 set
(FR248–FR265, FR267, NFR76–NFR83 — **FR266 is retired and must have no implementation**), the
negative traceability result for FR266, and a recommended semver bump with its rationale.
