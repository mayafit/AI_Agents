# Story 32.1 — Gate Spike: bmad-method v6.12.4, latest-only, no shims

Status: ready-for-dev
Blocked on: none
Wave: 0 (HARD GATE — 32.2 … 32.9 do not start before this story's verdict is recorded)

**FR:** FR271, FR275 (confirmation gate), FR276, FR277 (air-gap half), FR278 (input). **NFR:** NFR2, NFR50, NFR57, NFR58 (re-asserted with `uv` in the loop). **Decision inputs:** P5-10.5 (latest-only, no shims), P5-10.6 (`uv` + Python 3.11 prerequisite), P5-10.8 (Epic 32 is the hard gate).

## Story

As the **ma-agents maintainer**,
I want every assumption Epic 32 rests on confirmed against a live, scratch `npm install bmad-method@6.12.4`, and above all an answer to whether `uv run` works under `--network none` with a pre-seeded cache,
so that Waves 1–4 implement a known target, and a NO on the air-gap question changes the strategy before any code moves.

## Context

This is a CONFIRMATION spike in the 27.1 / 30.1 / 31.1 tradition: the target is already decided (FR271: v6.12.4, no `--shims`), so the spike does not reopen that choice. Its job is to turn the [NOTE]-tagged claims in `bmad-6.11-6.12-impact-analysis.md` (branch `docs/bmad-6-11-6-12-impact-analysis`, written at 3.17.1 against v6.12.0) into [RUN]/[READ] evidence at **v6.12.4**. The product owner declined that analysis's §7 `--shims` recommendation; this spike instead proves that *omitting* the flag under `--yes` yields no `v6-shims/` skills. Two of the analysis's blockers are already gone at 3.18.1: `scripts/build-bmad-cache.js:60` is `KNOWN_BUNDLED_MODULES = ['tea', 'bmb', 'cis']` (gds/wds no longer bundled, B1 resolved), and the `module-help.csv` header is on the canonical schema. The ma-agents side the findings land on: `package.json:35` (`"bmad-method": "6.10.0"`), `lib/bmad.js:2830` (`BMAD_TARGET_VERSION = '6.10.0'`), `lib/bmad.js:896` (`buildBmadArgs`) and the bundled pin mechanism `lib/bmad.js:667` (`getBundledModulePins`).

The single most important output is the air-gap answer (impact analysis §3 B2, §9 Q1): upstream `tools/installer/core/uv-check.js` says `bmad-build` / `bmad-build-auto` render through `render_skill.py` and HALT on activation if `uv` is unavailable, and the uv check never blocks the install — so an air-gap regression would install green and fail later, at skill activation.

## Acceptance Criteria

Each AC is answered with **[RUN]** (executed against the scratch 6.12.4 install) or **[READ]** (read from the 6.12.4 package source, cited `path:line`) evidence. The repo's own `node_modules/bmad-method` is NOT an evidence source.

1. **Live install recorded.** Scratch dir outside every git worktree; `npm install bmad-method@6.12.4`; the installed `package.json` reports `version: "6.12.4"`. The exact `engines.node` string is recorded verbatim (expected `>=20.12.0`) along with the Node version the spike ran under.
2. **Registry path and schema.** `bmad-modules.yaml` is still at the package root; its `modules:` shape and the `code`/`url`/`name`/`type` fields are intact; every new key is listed. The resolved values for `tea`, `cis`, `bmb`, `gds`, `wds` are recorded verbatim, including whatever field carries the `tea v1.27.2` / `cis v0.3.2` pins (field name recorded — Story 32.3's builder must read it) and whether `bmb` is pinned. `wds` absence and `gds` presence are confirmed. The 3.18.1 builder (`node scripts/build-bmad-cache.js`) is run against this registry **in a scratch copy of the repo** and its exit code and first error (if any) recorded.
3. **No-shims semantics under `--yes`.** A non-interactive `install --modules bmm --tools claude-code --yes` WITHOUT `--shims` on a fresh directory installs **zero** skills whose source is `src/bmm-skills/v6-shims/`: the installed `.claude/skills/` listing is diffed against the 6.12.4 `v6-shims/` directory listing and the intersection is empty. `--shims` is confirmed to exist (`install --help` output) and its type (boolean / list) recorded — evidence only; ma-agents will not pass it.
4. **`uv run` air-gapped (THE gate question).** In a Docker container with `--network none`, on a Node ≥ 20.12 image with `uv` and a Python ≥ 3.11 interpreter **pre-seeded** (exact seeding commands recorded: `UV_PYTHON_INSTALL_DIR`/`UV_CACHE_DIR`, `uv python install 3.11` done online, then the network cut), `uv run {project-root}/_bmad/scripts/resolve_customization.py --skill <bmad-build skill dir> --key workflow` exits 0 and returns the workflow table, and `uv run …/resolve_config.py --project-root <p> --key core` exits 0. Also recorded: the same commands with the pre-seed deliberately absent (expected: non-zero, and the exact error), and whether any of the shared scripts declares third-party dependencies (PEP 723 header) that `uv` would try to fetch. **If either seeded command needs the network, the verdict is STOP** and the story records the strategy change needed (not a workaround).
5. **AGY `.agents/skills` collision.** Install with the AGY/Antigravity tool code selected into a directory that already holds an ma-agents `.agents/skills/.ma-agents.json` + `MANIFEST.yaml` (copy a fixture from this repo's tracked `.agents/skills/`). Recorded: whether upstream writes to `.agents/skills`, whether it deletes or rewrites `.ma-agents.json`, `MANIFEST.yaml` or ma-agents-owned skill dirs, and its conflict output.
6. **`removals.txt` on update.** Install 6.10.0 into a scratch project, then update the same project to 6.12.4 (`--action update --yes`). Recorded: the location and content of `removals.txt`; that `bmad-index-docs`, `bmad-shard-doc`, `bmad-agent-tech-writer`, `bmad-check-implementation-readiness` are removed from the IDE skill dirs; and — critically — whether the update touches any directory whose `bmad-skill-manifest.yaml` names module `ma-skills` (seed one by hand). Whether pre-existing 6.10.0 skills that are now `v6-shims/` survive an update without `--shims` is recorded explicitly.
7. **Duplicate leaf name across modules.** With a `--custom-source` plugin (a minimal fixture module) that ships a skill dir named `bmad-sprint-planning`, a 6.12.4 install `--modules bmm` is run. Recorded: abort / last-writer-wins / skip, with the exact message. (Story 32.3 bumps the pin while Story 32.4 has not yet deleted our shadow — this tells 32.3 whether the interim tree installs at all.)
8. **`sprint_plan.py` schema vs ours.** Run upstream `bmad-sprint-planning/scripts/sprint_plan.py` (`generate`, `status`, `validate`) via `uv run` against a copy of this repo's `_bmad-output/implementation-artifacts/sprint-status.yaml` (unified three-section schema: `epics` / `backlog` / `sprints`, plus `project_key`, `tracking_system`, `story_location`). Recorded per key: preserved / dropped / rewritten / rejected. Verdict: **superset**, **subset**, or **divergent**, with the exact keys that differ. `validate` exit code on our file is recorded.
9. **Catalog facts the later stories bind to.** From the 6.12.4 tree, record (a) the directory of every skill `bmad-dev-epic` will orchestrate — `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-review`, `bmad-walkthrough` — plus whether `bmad-qa-generate-e2e-tests` still exists outside `v6-shims/`; (b) the exact lens names `bmad-review` accepts and how a caller selects one (the replacements for `bmad-review-adversarial-general` and `bmad-review-edge-case-hunter`); (c) that `bmad-generate-project-context` still exists as a real skill (`src/bmm-skills/plan/bmad-generate-project-context/`); (d) the `customize.toml` keys `bmad-build` exposes (`persistent_facts` empty, `{diff_file}` in review templates); (e) the marker strings `bmad-project-context` uses for its `AGENTS.md` block (input to 32.8); (f) whether a `_bmad/custom/<skill>.toml` that fails to parse now exits 1 (input to 32.7 — the current ma-agents text at `lib/confluence-publish-hook.js:1007-1009` says it "exits 0"); (g) the invocation contract of `bmad-build` and `bmad-build-auto` — what input selects the story (story key, spec path, or a `sprint-status.yaml` lookup), which artefacts each produces and where, and whether/which keys each writes to `sprint-status.yaml` (input to 32.5; a write is the same schema risk as AC8, reached by a second writer); (h) **[RUN]** proof that the **npm tarball** (the scratch `node_modules/bmad-method/`, not the git tag) ships `src/**/v6-shims/` and `src/**/scripts/*.py` in the layout 32.4 AC3, 32.5 AC1, 32.6 AC1/AC2 and 32.7 AC1/AC6 bind to — a recorded `ls`; if the layout differs, the change set names the substitute authority for each of those ACs; (i) the set of skill names present in the 6.10.0 catalog and absent from the 6.12.4 catalog that are **not** under `v6-shims/` (i.e. deleted outright), computed as catalog(6.10.0) − non-shim catalog(6.12.4) and recorded as a list — input to 32.6 AC1's retired-name guard. Also recorded: whether upstream `bmad-sprint-planning` absorbs the implementation-readiness capability FR276 assigns to it (the 33–35 readiness checks need a home).
10. **Verdict.** `_bmad-output/implementation-artifacts/epic-runs/epic-32/32-1-gate-findings.md` carries an explicit **PASS** or **STOP**, one finding section per AC, and a "change set handed to" section naming what each of 32.2–32.9 must do differently from its story text (or "none"). PASS requires AC4 seeded = exit 0 with no network and AC3 intersection empty. Anything else is STOP with a stated reason; a STOP is routed to `bmad-correct-course` (PM + Architect), as 31.1 was. **32.4 start gate (readiness C-1):** the verdict also records a separate **32.4 GO / HOLD** line driven by AC8 — `superset` → 32.4 GO; `subset` or `divergent` → 32.4 HOLD until the product owner explicitly accepts the dropped / rewritten keys (named in the findings file) or a mitigation is planned. A HOLD does not change PASS/STOP for the other stories. If AC7 shows an abort on duplicate leaf names, the change set states that 32.3 and 32.4 merge to the epic branch together.
11. **No repo change.** The spike modifies no file outside `_bmad-output/implementation-artifacts/epic-runs/epic-32/` and this story file. `git status` in the worktree after the spike shows only those paths.

## Tasks / Subtasks

- [ ] T1 Scratch setup outside every worktree; `npm install bmad-method@6.12.4`; record version + engines (AC1)
- [ ] T2 Registry read + scratch run of `build-bmad-cache.js` against it (AC2)
- [ ] T3 Fresh install without `--shims`; diff installed skills vs `v6-shims/` (AC3)
- [ ] T4 Docker `--network none` uv experiment, seeded and unseeded (AC4) — do this FIRST after T1; a STOP here ends the spike
- [ ] T5 AGY collision run against a copied `.agents/skills` fixture (AC5)
- [ ] T6 6.10.0 → 6.12.4 update run; `removals.txt`; ma-skills-owned dir survival (AC6)
- [ ] T7 Duplicate-leaf fixture run (AC7)
- [ ] T8 `sprint_plan.py` against our `sprint-status.yaml` copy (AC8)
- [ ] T9 Catalog facts (AC9)
- [ ] T10 Write `32-1-gate-findings.md` with verdict + change set (AC10); verify AC11; delete scratch dirs

## Dev Notes

- Evidence tags: **[RUN]** for anything executed, **[READ]** with `path:line` into the 6.12.4 package. A release note is never evidence (the Epic 27 lesson recorded in the impact analysis §"How to read this").
- Docker on Windows: run the container from Git Bash with `MSYS_NO_PATHCONV=1`; mount the scratch dir, not the repo. Use a Node ≥ 20.12 image — the repo's offline CI pins `node:20.18.1-bookworm` by digest (`.github/workflows/offline-install.yml`), reuse that digest so 32.9 runs on the same base.
- Pre-seeding `uv`: copy the `uv` binary into the image, run `uv python install 3.11` and one `uv run` of each script online, then `docker network disconnect` (or re-run with `--network none` on the committed image). Record `UV_CACHE_DIR`, `UV_PYTHON_INSTALL_DIR`, `UV_OFFLINE` / `--offline` usage exactly — 32.9 and the README on-prem section (32.2) copy them.
- The upstream skill tree is `src/core-skills/` and `src/bmm-skills/{agents,plan,ship,v6-shims}/`. `removals.txt` is expected to list `bmad-index-docs`, `bmad-shard-doc`, `bmad-agent-tech-writer`, `bmad-check-implementation-readiness` — confirm, don't assume.
- AC6 matters for Story 32.4: `migrateRetiredSkills` (`lib/installer.js:2306`, called at `bin/cli.js:4742` *after* the BMAD install at `bin/cli.js:4481-4508`) deletes by skill ID. If upstream's update already removes our shadow dirs, 32.4 needs less; if upstream re-installs `bmad-sprint-planning` under the same leaf, 32.4 must NOT add that ID to `RETIRED_SKILL_IDS` (it would delete upstream's fresh copy).
- Keep the spike's scratch dir and Docker image tags in the findings file so the [RUN] claims are reproducible, then remove them.

## Out of scope

- Any code, test, PRD or architecture edit (findings are handed forward, not applied).
- Re-arguing `--shims` (FR271 / P5-10.5 are decided).
- Adding Polytoken / Grok / ZCode / AGY as ma-agents targets (P5-6(d) stands) — AC5 only measures the collision.
- Anything about the extension repository or overlay (Epics 33–34).

## Verification record

Verdict: … ; Findings file: … ; Scratch dirs removed: … ; unverified (with reason): …
