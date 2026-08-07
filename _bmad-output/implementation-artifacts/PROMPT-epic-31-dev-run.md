---
type: agent-prompt
status: IN USE — launched 2026-08-03 with scope A (gate-first)
created: 2026-08-03
subject: Prompt for running bmad-dev-epic against Epic 31 (F26)
---

# Agent prompt — run `bmad-dev-epic` for Epic 31

Copy everything below the line into a fresh agent. It is self-contained: it assumes no
context from the planning conversation.

**Before you run it, read "Decide this first" at the bottom** — one scoping choice changes
what the run does.

---

Run the **`bmad-dev-epic`** skill to develop **Epic 31 — Global Installation & Federated
Knowledge Stores** in the ma-agents project. You are orchestrating an already-planned epic
from stories to a review-ready state. You do not write story code yourself; the skill
decomposes the epic into dependency-ordered waves and spawns per-story subagents.

## Where to work — read this carefully, the layout is unusual

- **Worktree:** `d:\Code\AI_Agents-knowledge-stores`, branch
  `feat/knowledge-stores-and-global-install`. Do **not** work in `d:\Code\AI_Agents` (that
  is `main`).
- **Epic 31's planning artifacts exist ONLY on that branch and are NOT merged to `main`.**
  Any epic branch you create must be based on `feat/knowledge-stores-and-global-install`,
  not on `main`, or the epic, its stories and Decision P5-9 will not exist in your branch.
  This is the single easiest way to break this run.

## Three environment gotchas that will otherwise waste your time

1. **`_bmad/` is gitignored and therefore ABSENT from the worktree.** The skill's activation
   loads `_bmad/bmm/config.yaml` and `_bmad/scripts/resolve_customization.py`. Resolve both
   from the main tree: `d:\Code\AI_Agents\_bmad\...`. Same project — `_bmad/` is per-machine
   install state. (This is itself one of the defects Epic 31 fixes, which is why you are
   hitting it.)
2. **`uv` is not on PATH and `python3` may not resolve.** Plain **`python`** works. The
   skill documents `python3 {project-root}/_bmad/scripts/resolve_customization.py`; run it
   as `python d:\Code\AI_Agents\_bmad\scripts\resolve_customization.py ...`. If it fails,
   the skill's own fallback is to merge `customize.toml` yourself in base → team → user
   order — that fallback is fine to use.
3. **A fresh git worktree has no `node_modules`.** Any worktree you create for story work
   needs one before tests run. Junction the main tree's rather than reinstalling:
   `New-Item -ItemType Junction -Path <worktree>\node_modules -Target d:\Code\AI_Agents\node_modules`.

## What Epic 31 is

PRD capability area **F26**, governed by Architecture **Decision P5-9**. Four threads:

1. **Global install** — install scope already exists as an interactive question; what changes
   is that choosing Global must stop silently dropping BMAD, must do no project-scoped work,
   and must record scope for a later bind.
2. **Two knowledge stores** — system requirements (brief, PRD) and software requirements
   (architecture, UX, epics), asked for separately, **each choosing its own backend
   independently**. Story files follow `sprint_management_path`, neither store.
3. **Confluence backend** — space + root page (blank generates one named for the project),
   MCP-conditional per `mcp-detection-pattern-spec.md`. **Fails loud when the MCP is absent.**
4. **Binding prerequisite** — `_bmad-output/project-layout.yaml` becomes authoritative and
   unconditionally written; `_bmad/bmm/config.yaml` becomes a generated one-way artifact.

Read in this order before intake: `_bmad-output/planning-artifacts/prd.md` (index — the F26
section carries the thesis, glossary, assumptions, non-goals and open items), the two F26
capability shards under `prd/capabilities/`, then
`architecture/decisions/project-knowledge-and-repository-layout.md` (Decision P5-9), then
`epics.md` § Epic 31, then `implementation-artifacts/sprint-status.yaml`.

Also read `planning-artifacts/delta-verification-f26.md` — it records which requirements were
amended late and is the fastest way to avoid acting on a superseded statement.

**Parse markdown fence-aware.** `architecture/decisions/project-knowledge-and-repository-layout.md`
contains fenced ```markdown blocks holding the generated `project-context.md` template. Lines
inside them look like headings (`## AI Agent Mandatory Rules`, `## Technology Stack`,
`## Project-Specific Rules`, `### Repository Layout`) but are template text. A naive
`grep '^## '` will mislead you; this trap has already caused one wrong document split in
this effort.

## Story-level constraints you must respect

These are settled decisions. A story that violates one is wrong, not clever.

- **Story 31.1 is a SPIKE, not a feature.** Its deliverable is a written verdict on what
  bmad-method v6.10.0 supports for user-level installation — target directory, whether
  `--directory` accepts a user-scoped path, module resolution outside a project. It gates
  **only** the global-install thread. Per P5-9.8 a negative verdict shrinks Story 31.12 and
  changes nothing in 31.2–31.10.
- **Story 31.2 is the spine** and gates everything except 31.1. It is `ready-for-dev`; OQ-4
  does **not** block it — the binding schema reserves the root-page record as an object
  carrying both `title` and `id`.
- **There is NO local mirror, cache, or sync for Confluence stores.** FR266 was retired at
  P5-9 before implementation. If you find yourself writing a mirror, sync direction, or
  conflict-resolution story, you have misread the decision. Story 31.14 carries a **negative
  traceability check** that no such code landed — honour it.
- **`config.user.yaml` does not exist.** The per-developer override files are
  `_bmad/config.user.toml` and `_bmad/custom/config.user.toml`. Story 31.3 AC5 tests those;
  a test against `config.user.yaml` would pass vacuously.
- **Generation fires on install and bind only.** Staleness fails loud telling the user to run
  `ma-agents bind`. Skills must never regenerate config as a side effect of being read.
- **`bin/cli.js:606-616` currently DELETES `project-layout.yaml`** in single-repo mode
  (`fs.unlinkSync` at 612). Story 31.2 AC3 handles it; do not let it survive.
- **The default module set is bmm + tea + bmb + cis** (FR123 as amended); `gds` and `wds` are
  bundled but opt-in.

## Verified source citations — use these, they were corrected

- Global BMAD agent filter: **`bin/cli.js:1440-1452`** (1451 closes the inner `if`, 1452 the
  scope `if`).
- Project-only guard: **`bin/cli.js:1455`** — 1454 is the `// Step 3.5` comment. **This is the
  larger of the two guards**: `if (installScope === 'project')` means a global install skips
  the *entire* BMAD-METHOD integration block, not just the agent filter. Material to 31.12.
- Install scope prompt: **`bin/cli.js:1414-1437`** — already exists in full.
- `project-layout.yaml` writer: **`bin/cli.js:605`**.

> **Version caveat:** `node_modules/bmad-method` locally is a stale **6.9.0** with different
> line numbers. `package.json:35` pins **6.10.0**. For upstream citations use the npx cache
> copy, not `node_modules`.

## Testing and packaging rules

- **Do not trust the chained `npm test`.** It halts on pre-existing MIL-498 template CRLF
  drift on Windows and will mask real breakage. Run the affected test files **directly**
  (`node --test test/<file>.test.js`), which is the same caution Story 30.4's DoD records.
- **Baseline before you blame yourself.** Several suites fail on unmodified `main` at
  `ccac270` — the two `custom-marketplace-registry` / `custom-marketplace-surface-drift`
  suites and one `bmad-output-policy` README-ordering case. Before reporting a failure as a
  regression, run the same file against `d:\Code\AI_Agents` and compare.
- **Any change under `lib/bmad-extension/skills/` requires `npm run build:plugin`** and a
  commit of the regenerated `lib/bmad-extension-plugin/` mirror. CI's "Bundle Drift Guard"
  fails otherwise. This has already bitten once in this effort.

## Gates and boundaries

- Honour the skill's **two human gates** — before the beta publish and before opening the
  epic PR. **Do not publish to npm and do not open a PR.** Stop and report at each.
- **Do not push any branch.** Report what would be pushed.
- **CI is broken at the GitHub account level** — every job fails within seconds, zero steps
  executed, no runner assigned, no logs. It is not caused by this work. Do not chase it, and
  do not treat red checks as a signal about your changes.
- **Do not touch bug B3** (root `skills/` directory). It is parked pending a human decision;
  see `HANDOFF-B3-root-skills-dir.md`.
- Do not modify the PRD, Decision P5-9, or Epic 31's story definitions to make an
  implementation problem go away. If a story is wrong, **stop and report it** — the planning
  chain has been through a readiness review and a delta verification, so a contradiction is
  more likely a real finding than an oversight.

## Report back

The Run Ledger location, per-story outcome (done / blocked / failed with reason), the FR250
spike verdict and what it implies for Story 31.12's scope, test results with any failure
baselined against `main`, what is staged for the two gates, and anything you stopped on.

---

## Run scope — DECIDED: **A, gate-first** (2026-08-03)

Append this to the prompt when launching:

> **Run scope: wave 1 ONLY.** Develop Stories 31.1 and 31.2, then **HALT and report** before
> planning or starting any further wave. Do not proceed to waves 2+ even if the skill's
> dependency graph says they are unblocked. Story 31.12's scope is undetermined until 31.1's
> spike reports, so the reassessment is the point of stopping here.

The original options are kept below for the record.

## Options considered — run scope

`bmad-dev-epic` runs unattended through dev and review across all stories in
dependency-ordered waves. Epic 31 has **14 stories**, and Story 31.12's scope is
**undetermined until 31.1's spike reports**. Two sensible options:

**A — Gate-first, then reassess (recommended).** Add to the prompt: *"Run wave 1 only —
Stories 31.1 and 31.2 — then HALT and report before planning further waves."* This is how
Epic 30 was run in this project ("gate-first via bmad-dev-epic: 30.1 gate PASS, parallel
waves"), and it means the 31.1 verdict informs 31.12's scope before any work is spent on it.

**B — Full autonomous run.** Let the skill drive all 14 stories, stopping only at its two
release gates. Faster in wall-clock, but it will plan and possibly implement 31.12 against
an assumed spike verdict, and a 14-story unattended run is a lot of unreviewed change.

Recommendation: **A**. The spike exists precisely because the answer is unknown; spending
subagent effort on 31.12 before knowing it is the one clearly avoidable waste in this epic.
