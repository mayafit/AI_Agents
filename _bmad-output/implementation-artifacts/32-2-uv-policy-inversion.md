# Story 32.2 — `uv` Policy Inversion: owned skill guidance calls shared scripts via `uv run`

Status: ready-for-dev (do NOT start before Story 32.1 records PASS — a STOP on 32.1 AC4 changes this story)
Blocked on: 32-1
Wave: 1 (parallel with 32.3)

**FR:** FR277 (inverts FR213; amends NFR74; replaces NFR59(c)). **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap, with `uv` in the loop); NFR74 first clause and NFR59(a)/(b) still hold. **Decision inputs:** P5-10.6 (reverses P5-6(c); "the `test/uv-transition-resilience.test.js` guard is inverted, not deleted").

## Story

As an **ma-agents user on a host whose `python3` is older than 3.11, or on an air-gapped image**,
I want ma-agents-owned skills to call the shared `_bmad/scripts/*.py` through `uv run`, exactly as upstream v6.11+ skills do, and the on-prem prerequisite stated where I will read it,
so that customization resolves correctly instead of silently degrading to the hand-merge fallback, and an air-gapped install fails at install-prep time, not at first skill activation.

## Context

Upstream v6.11 made `uv` + Python ≥ 3.11 the contract for `_bmad/scripts/resolve_customization.py`, `resolve_config.py` and `memlog.py` (`tomllib` is 3.11 stdlib); `bmad-build` / `bmad-build-auto` HALT on activation without `uv`. ma-agents' policy (FR213 / NFR74 / NFR59(c), Decision P5-6(c)) forbade exactly that migration and pins it with two guards in `test/uv-transition-resilience.test.js`: `:194` ("ma-agents control-plane code (lib JS, scripts/, bin/) contains no `uv run`") and `:208` ("no ma-agents-owned skill uses `uv run`", scanning `lib/bmad-extension/skills/**/*.md`). The one owned skill that calls a shared script today is the epic orchestrator: `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md:135` — ``Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow` ``. The impact analysis cited this as `SKILL.md:23`; the file has since grown (verified at :135). The four persona skills (`ma-agent-cyber`, `-devops`, `-sqa`, `-sre`) do **not** call any shared script today — their activation (`ma-agent-sre/SKILL.md:20-28`) reads `_bmad/bmm/config.yaml` directly — so for them this story is a verification and an explicit decision, not a migration. The PRD already marks FR213 as INVERTED (`prd/capabilities/bmad-platform-currency.md:61`) and NFR74 as AMENDED (`:147`); NFR59 at `:152` still carries the old (c) clause without an annotation.

## Acceptance Criteria

1. **Inverted skill guard (FR277).** `test/uv-transition-resilience.test.js` replaces the `:208` test with its inverse, bound to the real files on disk: for every `*.md` under `lib/bmad-extension/skills/**` **and** `skills/**`, every line that invokes `_bmad/scripts/<name>.py` must invoke it as `uv run …`; a line invoking it via `python`, `python3`, `py -3` or a bare path fails the test, and the failure names file:line. The test also asserts the scanned set is non-empty and contains `bmad-dev-epic/SKILL.md` (so a scanner that finds nothing cannot pass).
2. **Control-plane guard kept, narrowed to execution.** The `:194` guard still fails if any `lib/**/*.js`, `scripts/**/*.js` or `bin/**/*.js` *executes* `uv` (a `spawn`/`exec`/`execFile`/`execSync` call whose command or argv contains `uv`) — installer JavaScript stays interpreter-independent (P5-10.6). It no longer fails on user-facing message strings that merely mention `uv run` (e.g. future remediation text in `bin/cli.js` / `lib/confluence-publish-hook.js`). The narrowing is proven by two fixtures in the test: an `execSync('uv run x.py')` string (must fail) and a `console.log('… uv run …')` string (must pass).
3. **`bmad-dev-epic` migrated.** `bmad-dev-epic/SKILL.md` Step 1 reads `uv run {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`. The hand-merge fallback paragraph stays, and gains one sentence naming the cause it now covers: "`uv` unavailable or Python < 3.11". No other wording in the step changes.
4. **Persona skills — explicit decision recorded.** The four `ma-agent-*` skills are either (a) left reading `config.yaml` directly, with the story's Verification record stating that they call no shared script and why that is correct, or (b) given a `uv run … resolve_customization.py --key agent` step matching upstream agent activation as confirmed in 32.1 AC9. Whichever is chosen, AC1's guard covers them and passes.
5. **Removed-premise text deleted.** The header comment of `test/uv-transition-resilience.test.js` (`:27`, `:33`, `:38-44`) no longer states that control-plane Python "is never migrated to `uv run`"; it states the FR277 boundary (skill guidance: `uv run`; installer JS: no `uv` execution) and cites FR277 / P5-10.6.
6. **NFR59(a)/(b) still asserted.** The existing tests at `:123`, `:138`, `:156`, `:167` (install success with `uv` absent; exit-status-only decisioning; classifiers ignore the banner; no stdout grep) remain and pass unchanged.
7. **On-prem prerequisite documented.** README `## On-Prem / Air-Gapped Deployment` (`README.md:364`) gains a "Prerequisites" subsection: `uv` and a Python ≥ 3.11 interpreter must be pre-seeded on the image; the exact seeding commands are copied from `32-1-gate-findings.md` AC4, not re-invented; it states the failure mode if omitted (install succeeds, `bmad-build` halts on activation). `lib/templates/instruction-block-onprem.template.md` is checked; it currently mentions neither `uv` nor Python, and a line is added only if 32.1 shows an agent-facing instruction is needed.
8. **Mutation-checked.** At least these mutants are planted and each turns a named test red, then reverted: (m1) `bmad-dev-epic/SKILL.md:135` reverted to `python3` → AC1 test fails; (m2) AC1 scanner limited to `lib/bmad-extension/skills` only and a `python3 …_bmad/scripts/…` line planted in `skills/` → fails; (m3) an `execSync('uv …')` planted in `lib/` → AC2 fails; (m4) the AC1 non-empty assertion removed and the glob broken → the bmad-dev-epic membership assertion fails.
9. **Plugin bundle regenerated.** `npm run build:plugin` is run; `lib/bmad-extension-plugin/` carries the migrated `bmad-dev-epic/SKILL.md`; the Bundle Drift Guard (`.github/workflows/bundle-drift.yml`) would pass.

## Tasks / Subtasks

- [ ] T1 Rewrite the `:208` test as the AC1 inverse guard over both skill trees (AC1)
- [ ] T2 Narrow the `:194` guard to execution sites; add the two fixtures (AC2)
- [ ] T3 Migrate `bmad-dev-epic/SKILL.md:135` (AC3)
- [ ] T4 Decide and record the persona-skill outcome (AC4)
- [ ] T5 Rewrite the test header comment (AC5); confirm AC6 tests untouched and green
- [ ] T6 README on-prem prerequisites; check the on-prem template (AC7)
- [ ] T7 Mutants m1–m4 (AC8)
- [ ] T8 `npm run build:plugin`; drift check (AC9)
- [ ] T9 Flag to PM (do not edit): NFR59 at `prd/capabilities/bmad-platform-currency.md:152` lacks an "(c) replaced by FR277" annotation

## Dev Notes

- Files: `test/uv-transition-resilience.test.js` (in the `npm test` chain at position 17 of 110), `lib/bmad-extension/skills/bmad-dev-epic/SKILL.md`, `lib/bmad-extension/skills/ma-agent-*/SKILL.md`, `README.md`, `lib/templates/instruction-block-onprem.template.md`, generated `lib/bmad-extension-plugin/**`.
- `walk()` in the test already skips `bmad-cache`, `bmad-extension-plugin`, `node_modules`; keep `lib/bmad-cache` out of scope (the `:224` test documents that boundary — keep it).
- AC2 matters for 32.7: that story will likely change the resolver-behaviour remediation text at `bin/cli.js:1466`, `:1581`, `:1618` and `lib/confluence-publish-hook.js:1007-1009`; if those strings mention `uv run`, the current substring guard would fail spuriously.
- Story 32.5 rewrites `bmad-dev-epic` wholesale; this story changes only Step 1 so 32.5 inherits a green guard. Coordinate on the epic branch: 32.5 must keep the `uv run` form.
- `memlog.py` is named in FR277; no owned skill calls it today (verified by grep) — AC1's regex covers it anyway.
- Windows: run the test directly (`node test/uv-transition-resilience.test.js`) as well as through the chain; the chain's Windows health is recorded in 32.9, not here.

## Out of scope

- Pin bump, cache rebuild (32.3); the full `bmad-dev-epic` rewrite (32.5); TOML validation (32.7).
- Any `uv` execution from installer JavaScript (forbidden by P5-10.6).
- PRD/architecture edits — T9 is a flag only.
- Extension-repo script conventions (Epic 33).

## Verification record

Suite: … ; mutants: m1 … m4 (killed/survived) ; persona decision (a/b) and why: … ; unverified: …
