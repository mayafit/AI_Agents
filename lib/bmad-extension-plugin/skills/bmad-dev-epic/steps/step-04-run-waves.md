# Step 04 — Run the Waves (Parallel Per-Story Pipelines)

**Goal:** Execute each wave by spawning one subagent per story, each running the full per-story pipeline in its own worktree, then integrating passing stories back into the epic branch. This is the core of the orchestration.

## How subagents are used

- Spawn **one subagent per story** using the host's Agent/Task tool. Put all spawns for a wave (up to `max_parallel_stories`) in a **single response** so they run concurrently.
- Each subagent is **stateless w.r.t. this conversation** — it receives a self-contained prompt (the story-pipeline contract below) plus the paths it needs. It must not assume access to the orchestrator's context.
- Assign each subagent the model implied by the step it is running (`{review_model}` vs `{exec_model}`). Because a single subagent runs multiple BMAD skills across both tiers, prefer this split:
  - If the host supports per-skill model switching inside one subagent, instruct it to use `{review_model}` for create-story/code-review/edge-case-hunter and `{exec_model}` for dev-story/fixes/e2e.
  - If not, run the story as **two chained subagents**: an `{exec_model}` "builder" and a `{review_model}` "reviewer", handing the worktree between them.
  - If model selection is unavailable (non-Claude / single-model runtime), run one subagent and note tiers are collapsed.

## Per-story pipeline (the contract every story subagent runs)

Give each story subagent the full contract in `references/story-pipeline.md` (skill-root–relative). The inline summary below is **illustrative only** — `references/story-pipeline.md` is the authoritative contract; if they diverge, the reference file wins. In summary, in the story's own worktree branched from the epic branch:

1. `bmad-create-story` → produce the context-filled story spec.            [review tier]
2. `bmad-dev-story` → implement against the spec.                          [exec tier]
3. Parallel review: `bmad-code-review` **and** `bmad-review-edge-case-hunter`. [review tier]
4. Triage findings → if any are blocking, `bmad-dev-story` fix loop (cap `fix_loop_cap`), then re-review only the changed surface. [exec tier]
5. `bmad-qa-generate-e2e-tests` → generate e2e tests and run them.          [exec tier]
6. Enforce the **Definition of Done** (review clean + e2e green + spec ACs met). Commit with Conventional Commits.

The subagent returns a structured result: `{story_id, status: merged-ready|blocked, branch, worktree, commits, unresolved_findings[], e2e_status, notes}`. It must **not** merge to the epic branch itself — the orchestrator integrates (step below) to keep merges serialized.

## Wave loop

For each wave in order:

1. **Spawn** the wave's story subagents in parallel (respect `max_parallel_stories`; batch if larger). Mark each story `in-progress` in the Run Ledger.
2. **Collect** results as subagents return. Update the Ledger per story.
3. **Integrate** each `merged-ready` story into the epic branch, **one at a time** (serialized), from the epic worktree (use the epic worktree path recorded in the Run Ledger, not a re-derived guess):
   ```bash
   git -C <epic-worktree> merge --no-ff feature/epic-<epic-id>-story-<sid>
   ```
   - On a **merge conflict**: do not guess. Spawn an `{exec_model}` subagent scoped to resolve only that conflict against both stories' intent, or HALT and report if it cannot. Re-run that story's e2e after resolution.
   - After a successful merge, run the project build/test gate (the step-01 `test_gate`) on the epic branch to catch cross-story breakage early. If it breaks, treat as a blocking finding against the just-merged story.
4. **Blocked stories**: a story that exhausts `fix_loop_cap` without converging, or whose e2e cannot pass, is marked `blocked` with its `unresolved_findings`. Do **not** silently drop it. Continue the epic with the rest, but record it for the step-05 report and the PR description. If a *downstream* story depends on a blocked story, mark the dependents `blocked (upstream)` and skip their wave entry.
5. Clean up each story worktree after its merge: `git worktree remove .worktrees/epic-<epic-id>-story-<sid>`.

**Persist the Run Ledger to disk** (`{implementation_artifacts}/epic-runs/<epic-id>/run-ledger.md`) after integrating each story and again at the end of each wave, so a crashed run can be resumed without redoing merged stories.

Proceed to the next wave only when the current wave's stories are all `merged` or `blocked`.

## After all waves

Record the final tally in the Run Ledger (merged / blocked / skipped) and persist it to disk. Then read fully and follow `./steps/step-05-epic-adversarial.md`.
