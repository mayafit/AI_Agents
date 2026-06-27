# Story 28.2: uv-Transition Resilience and Python-Scoping Guardrails

Status: review

## Story

As the **ma-agents maintainer**,
I want the test suite to pin that v6.9.0's `uv`-environment-check installer change cannot break the ma-agents install path and that ma-agents-owned Python is never accidentally migrated to `uv`,
So that the warn-don't-block upstream change and the python-not-uv scoping boundary are protected by gates rather than discovered by a regression.

**Blocked by:** Story 28.1 (the v6.9.0 tree must be on disk before the uv-transition behavior can be exercised against the real installer). Runs in parallel with Story 28.3.

**FR/NFR:** FR212, FR213, NFR59.

## Acceptance Criteria

1. **Given** an install/update flow where `uv` is absent from PATH, **When** it runs against v6.9.0, **Then** a regression test asserts ma-agents returns its **success** path — the v6.9.0 missing-`uv` warning is non-fatal, the BMAD installer's exit code is unchanged, and ma-agents' success/failure decision is unaffected (NFR59a, FR212). The test exercises the test at the **real decision site** — the `runCommand(...)` try/catch in `installBmad`/`updateBmad`, where success/failure is determined by whether `execSync` **throws** on a non-zero exit, not by parsing stdout — using a uv-missing condition (e.g. `uv` removed from PATH, or a stubbed installer that emits the warn-only banner with exit 0) and asserts ma-agents reports success. It must **not** target the dead classifiers, which are off the live path.

2. **Given** the ma-agents install path, **When** I run a **repo-wide grep** over `lib/`, **Then** a guard asserts no `lib/` code path greps installer stdout for the retired `python3`/version-banner strings or for `uv` (NFR59b, FR212). The live install/update path keys its success/failure decision off the **thrown error's exit status** (`execSync` throwing on a non-zero exit), never on installer stdout — so a uv-missing banner (exit 0) cannot influence it. Note the offline/EBUSY classifiers (`looksLikeOfflineFailure`/`looksLikeEbusyFailure`/`classifyRecompileFailure` in `lib/bmad.js`) are currently **unreferenced on the live path** — their sole caller, `applyCustomizations()`, was removed in Story 22.6, making them **test-only** — so the v6.9.0 uv banner is doubly harmless: even the dead classifiers reference neither `python3` nor `uv`, and nothing live consults stdout at all. This is a regression **guard** proving the standing negative — **not** a code fix to `bmad.js`.

3. **Given** ma-agents **control-plane / tooling** Python — the ma-agents-authored agent-skill activation steps that invoke `python3 {project-root}/_bmad/scripts/resolve_customization.py` (there is no checked-in `scripts/resolve_customization.py`; it is invoked at runtime against the installed `_bmad/scripts/` path), plus `scripts/build-bmad-cache.js`'s Python peers — **When** I inspect those invocation sites, **Then** a guard asserts they invoke `python`/`python3` and **not** `uv run` (NFR59c, FR213). The guard is **scoped to control-plane sites** and explicitly **excludes** (a) vendored `node_modules/bmad-method` / `lib/bmad-cache/` passthrough content which ma-agents neither owns nor modifies, and (b) the ma-agents-owned `ml-experiment`/`ml-infra`/`ml-eda` skills, whose `uv run python scripts/<...>.py` guidance is **intentional** — it runs the user's ML-project scripts in the user's uv env, not ma-agents tooling — so the guard must not fire on them.

4. **Given** a future contributor, **When** they look at the `resolve_customization.py` activation-invocation site and/or the relevant contributor/architecture doc, **Then** the python-not-uv scoping boundary (BMAD's `uv` standardization governs BMAD-installed skill scripts, NOT ma-agents control-plane Python; the `ml-*` skills' `uv run python` is a deliberate exception) is documented there, referencing P5-6 / FR213.

5. **Given** all changes, **When** I run `npm test`, **Then** it is green on Linux/CI (and Windows), and the new guards run without network access.

## Tasks / Subtasks

### Task 1: uv-missing install-success regression test at the real decision site (AC: 1)

- [ ] 1.1 Add a test at the real decision site (the `runCommand` try/catch in `installBmad`/`updateBmad`) that exercises a uv-missing condition (stubbed/injected installer emitting the warn-only banner with exit 0, or `uv` removed from PATH) and asserts ma-agents returns success — do NOT target the dead classifiers
- [ ] 1.2 Assert the exit code / thrown-vs-not-thrown decision is unchanged by the missing-`uv` warning (warn-don't-block)

### Task 2: Repo-wide grep guard proving the standing negative (AC: 2)

- [ ] 2.1 Add a guard running a **repo-wide grep** over `lib/` asserting no live code path greps installer stdout for the retired `python3`/version-banner strings or for `uv`
- [ ] 2.2 Document in the test that the offline/EBUSY classifiers (`looksLikeOfflineFailure`/`looksLikeEbusyFailure`/`classifyRecompileFailure`) are test-only/unreferenced on the live path since Story 22.6 removed `applyCustomizations()` — no code change to `bmad.js`

### Task 3: Control-plane Python-scoping guard (AC: 3)

- [ ] 3.1 Add a guard asserting ma-agents **control-plane** Python (the activation steps invoking `python3 {project-root}/_bmad/scripts/resolve_customization.py`, plus `build-bmad-cache.js`'s Python peers) is invoked via `python`/`python3`, never `uv run`
- [ ] 3.2 Scope the guard to control-plane sites; exclude (a) vendored `node_modules/bmad-method` and `lib/bmad-cache/` passthrough content, and (b) the `ml-experiment`/`ml-infra`/`ml-eda` skills' intentional `uv run python` ML-project guidance

### Task 4: Document the scoping boundary + verify (AC: 4, 5)

- [ ] 4.1 Add a note at the `resolve_customization.py` activation-invocation site and/or contributor/architecture doc (reference P5-6 / FR213) stating ma-agents control-plane Python stays on `python`, not `uv`, and that the `ml-*` skills' `uv run python` is a deliberate exception
- [ ] 4.2 `npm test` green on Linux/CI and Windows; guards run offline

## Dev Notes

- This story adds **regression guards only** — there is no behavior change to ship. FR212 is confirm-the-negative: ma-agents already decisions off the **thrown exit status**, so the uv-transition is an invariant to pin, not a bug to fix.
- The live install/update/migration paths (`installBmad`/`updateBmad`/`runMigration`) wrap `runCommand(...)` in a try/catch; success/failure rides on whether `execSync` **throws** on a non-zero exit, never on installer stdout text. That is the real decision site AC1/NFR59a must target.
- The offline/EBUSY classifiers (`looksLikeOfflineFailure`/`looksLikeEbusyFailure`/`classifyRecompileFailure`, defined and exported in `lib/bmad.js`) are **test-only / unreferenced on the live path** — their sole caller `applyCustomizations()` was removed in Story 22.6. Do **not** describe them as the live guard against the uv banner, and do not point the AC1 test at them. NFR59b's guard is therefore a **repo-wide grep** proving no `lib/` path consults stdout — not an assertion about "those two functions".
- Do **not** add stdout parsing for the new `uv` banner — that is the exact fragility FR212 forbids (it is why the `python3` probe text it replaced was a problem). Exit-code-only decisioning is the durable contract, and the uv banner is doubly harmless: the live path ignores stdout and the dead classifiers reference neither `python3` nor `uv`.
- For AC1, prefer a stubbed/injected installer over mutating the real PATH where the test framework allows, to keep the test deterministic and offline.
- NFR59c is **control-plane-scoped**: the `ml-experiment`/`ml-infra`/`ml-eda` skills legitimately use `uv run python` (running the user's ML-project scripts in the user's uv env), so the guard must exclude them or it will false-positive.
