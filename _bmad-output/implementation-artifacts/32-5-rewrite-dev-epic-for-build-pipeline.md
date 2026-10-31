# Story 32.5 — Rewrite `bmad-dev-epic` Against the v6.12 Build Pipeline

Status: backlog
Blocked on: 32-2, 32-3
Wave: 2 (parallel with 32.4; 32.6 follows in Wave 3)

**FR:** FR276 ("`bmad-dev-epic` is rewritten to orchestrate `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-review` and `bmad-walkthrough`"), FR271, FR277 (`uv run`). **NFR:** NFR57/NFR58 (the skill works on disconnected runtimes — model tiers stay abstract). **Decision inputs:** P5-10.5, P5-10.7 (`bmad-dev-epic` retained — agentic orchestration; `bmad-loop` is not a replacement; FR235 stands).

## Story

As a **team lead running an epic with `bmad-dev-epic`**,
I want its per-story pipeline to call the v6.12 skills that actually exist on a no-shims install,
so that every pipeline step resolves, while I keep what upstream has no equivalent for: dependency-aware waves, model tiers, the adversarial + package-integrity gate, and the gated beta publish + PR.

## Context

`bmad-dev-epic` (`lib/bmad-extension/skills/bmad-dev-epic/`: `SKILL.md` 213 lines, `checklist.md`, `customize.toml`, `references/story-pipeline.md`, `steps/step-01…07`) was written against the v6.10 Phase-4 loop. On a 6.12.4 install without `--shims`, five of the skills it names do not exist: `bmad-create-story` (`references/story-pipeline.md:41`, `steps/step-02-plan-waves.md:24`, `steps/step-04-run-waves.md:18`), `bmad-dev-story` (`story-pipeline.md:57`, `:70`; `step-04-run-waves.md:19`, `:21`), `bmad-review-edge-case-hunter` (`story-pipeline.md:64`; `step-04-run-waves.md:20`), and `bmad-review-adversarial-general` (`steps/step-05-epic-adversarial.md:5`). Role vocabulary repeats the old names in `SKILL.md:3` (description), `checklist.md:22-23`, `customize.toml:32-34`, `steps/step-01-intake.md:23-24`, `steps/step-04-run-waves.md:10`, and the `module-help.csv:37` description. Upstream v6.12 replaced that loop with `bmad-build` / `bmad-build-auto` (render through `render_skill.py`, HALT without `uv`), merged the review family into `bmad-review` with lenses, and replaced `bmad-checkpoint-preview` with `bmad-walkthrough`. Step 1 of activation was already moved to `uv run` by 32.2 (`SKILL.md:135` at the worktree base).

## Acceptance Criteria

1. **Every named skill exists (outside authority: the vendored upstream tree).** A new test `test/bmad-dev-epic-6-12-pipeline.test.js` extracts every backticked `bmad-*` / `ma-*` skill name from all files under `lib/bmad-extension/skills/bmad-dev-epic/` and asserts each one is either (a) a directory under `node_modules/bmad-method/src/` that is **not** under `v6-shims/`, or (b) a directory under `lib/bmad-extension/skills/` / `skills/`. The test asserts the extracted set is non-empty and includes `bmad-build-auto`, so an extractor that matches nothing cannot pass.
2. **Negative — retired names gone.** No file under `lib/bmad-extension/skills/bmad-dev-epic/` (nor its plugin mirror) contains `bmad-create-story`, `bmad-dev-story`, `bmad-quick-dev`, `bmad-dev-auto`, `bmad-checkpoint-preview`, `bmad-review-edge-case-hunter`, `bmad-review-adversarial-general`, or the role words `create-story` / `dev-story` / `edge-case-hunter`. (32.6 lands after this story and its repo-wide test will also cover this directory; the assertion here must exist regardless.)
3. **Pipeline mapping, confirmed against 32.1 AC9.** `references/story-pipeline.md` is rewritten so: spec + implementation of one story = `bmad-build-auto` (unattended, exec tier; spec-producing phase at review tier if the skill exposes the split, otherwise noted as collapsed); fix loop = `bmad-build-auto` re-invoked on the blocking findings; review = `bmad-code-review` **and** `bmad-review` with the edge-case lens, in parallel (review tier); epic-level alignment review (`step-05`) = `bmad-review` with the adversarial lens; the human checkpoint before publish = `bmad-walkthrough` on the epic diff. Interactive `bmad-build` is named only for the user-escalation path (a story returned `blocked`). Lens names and invocation syntax are copied from `32-1-gate-findings.md`, never guessed.
4. **E2E step resolved.** If 32.1 AC9(a) shows `bmad-qa-generate-e2e-tests` exists outside `v6-shims/`, step 5 keeps it; otherwise step 5 calls the 6.12 successor 32.1 named, or (if none) runs `<TEST_CMD>` plus the story's own tests and says so. AC1 enforces whichever is chosen.
5. **Retained capabilities intact.** The following still exist and are unchanged in behaviour (diff-reviewed, and listed in the Verification record): wave planning + INVEST/needs-split handling (`step-02`, `step-04`); `review_tier_model` / `exec_tier_model` abstraction and collapse rules (`customize.toml` `[workflow.defaults]`, `step-01`, `step-04:10`); `max_parallel_stories`, `fix_loop_cap`, `parallelism_strategy`; the epic adversarial + package-integrity gate (`step-05`); `gate_before_publish` / `gate_before_pr`, `npm publish --tag {workflow.defaults.npm_dist_tag} --ignore-scripts` (`step-06-release.md:28`) and `gh pr create` (`step-06-release.md:43`); the structured return value `{story_id, status: merged-ready|blocked|needs-split, …}`.
6. **Customization contract (feeds 32.7).** `customize.toml` keeps an explicit, non-empty `persistent_facts` (it is `["file:{project-root}/**/project-context.md"]` today), and any review-related template text uses `{diff_file}`, never `{diff_output}`. The role comments at `customize.toml:32-34` name the new skills.
7. **Shared scripts via `uv run`.** Any call this skill makes to `_bmad/scripts/*.py` uses `uv run` (32.2's AC1 guard passes on the rewritten files).
8. **Knowledge-store preflight untouched.** The `## Knowledge Store Binding Preflight` block in `SKILL.md` (if present) is byte-identical to the other copies; `test/project-layout-staleness-guard.test.js` (which references `bmad-dev-epic`) passes unchanged.
9. **Enumerations.** `module-help.csv:37` and `SKILL.md:3` descriptions describe the build/review/walkthrough pipeline; `npm run build:plugin` regenerates the mirror; drift guard clean.
10. **Dry run.** The rewritten skill is executed once against a 2-story toy epic in a scratch repo with a real 6.12.4 install (no shims) up to — not past — the publish gate; the run log shows each pipeline step resolving to an installed skill. Recorded honestly if a step could not be exercised (e.g. single-model runtime ⇒ tiers collapsed).

## Tasks / Subtasks

- [ ] T1 Read `32-1-gate-findings.md` AC9; fix the mapping table (AC3, AC4)
- [ ] T2 Rewrite `references/story-pipeline.md` (AC3, AC4, AC5)
- [ ] T3 Rewrite `steps/step-01`, `step-02`, `step-04`, `step-05`, `step-06` call sites (AC3, AC5)
- [ ] T4 `SKILL.md` summary + description, `checklist.md`, `customize.toml` comments (AC5, AC6, AC9)
- [ ] T5 New test `test/bmad-dev-epic-6-12-pipeline.test.js`, add to the `npm test` chain (AC1, AC2)
- [ ] T6 Mutants: (m1) re-insert `bmad-dev-story` in step-04 → AC1 red; (m2) name a `v6-shims/` skill (`bmad-quick-dev`) → AC1 red; (m3) extractor regex broken → non-empty assertion red
- [ ] T7 `npm run build:plugin`; dry run (AC9, AC10)

## Dev Notes

- `SKILL.md` is the illustrative summary; `references/story-pipeline.md` is the authoritative contract ("if they diverge, the reference file wins") — rewrite the reference first, then make the summary match it.
- AC1's upstream root: `node_modules/bmad-method/src/` after 32.3 installs 6.12.4. Layout is `src/core-skills/` and `src/bmm-skills/{agents,plan,ship,v6-shims}/`; walk it, do not hard-code sub-paths. ma-agents-owned names (`git-workflow-skill`, `code-review` repo skill) are referenced without the `bmad-` prefix — AC1's extractor targets `bmad-*` / `ma-*` names only; repo skills referenced by policy (`code-review`, `git-workflow-skill`) are covered by (b).
- `bmad-build` / `bmad-build-auto` render through `render_skill.py` and HALT without `uv`: the intake step should check `uv --version` once and stop the epic early with a clear message, instead of letting each story subagent halt.
- The dev-epic orchestrator itself is the thing that will run Epics 33–35; keep its git-worktree, Conventional-Commit and serialized-merge behaviour exactly as is.
- Do not touch the `npm test` chain ordering beyond appending the new test file.

## Out of scope

- Moving `bmad-dev-epic` into `ma-ops-agents` (Epic 33.4).
- Adding Jira transitions to the pipeline (Epic 34.8).
- Bundling or wrapping `bmad-loop` (FR235).
- Changing model-tier defaults or publish policy.

## Verification record

Suite: … ; mutants: m1 … m3 ; mapping table (old → new, with 32.1 citation): … ; dry-run log: … ; unverified: …
