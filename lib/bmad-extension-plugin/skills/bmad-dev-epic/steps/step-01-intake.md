# Step 01 — Intake & Guided Configuration

**Goal:** Confirm the epic exists and is ready, then collect the run configuration through guided questions. Nothing is spawned and no branch is created until this step completes.

## 1. Locate and validate the epic (PRECONDITION)

This skill *runs* an epic; it does not invent one. Find the target epic:

1. Read `{sprint_status}` (`{implementation_artifacts}/sprint-status.yaml`) and the epics/stories planning artifacts under `{planning_artifacts}`.
2. If the user named an epic (id or title), select it. Otherwise list candidate epics and **HALT** for the user to choose.
3. Enumerate the epic's stories. For each story capture: id, title, status, and declared dependencies / "depends on" / prerequisite references.

**If the epic has no stories**, or stories are placeholders without acceptance criteria: STOP and tell the user to run `bmad-create-epics-and-stories` (and `bmad-sprint-planning`) first. Do not fabricate stories.

**If some stories are already `done`/`merged`**: by default skip them (treat as satisfied dependencies). Confirm this with the user.

## 2. Ask the guided questions

Ask these as a single grouped set (use the host's structured-question UI if available; otherwise a numbered list). Show the proposed default from `{workflow.defaults}` for each and accept "use defaults".

1. **Model tiers (tier-abstract — critical for disconnected/non-Claude runtimes).**
   First ask: *what models does this runtime actually expose?* Then map:
   - `{review_model}` — deep reasoning tier (create-story, code-review, edge-case-hunter, epic adversarial review). Default: `{workflow.defaults.review_tier_model}`.
   - `{exec_model}` — execution tier (dev-story, fix loops, e2e). Default: `{workflow.defaults.exec_tier_model}`.
   - If only ONE model is available (air-gapped local model, or a single-provider CLI), **collapse both tiers to it** and note that tier separation is disabled.
   - If the runtime is not Claude (e.g. Gemini, Codex, a local model) or does not support per-subagent model selection, record the mapping anyway but note it is **best-effort**: subagents will use whatever model the host assigns. Never block on this.

2. **Parallelism strategy** — default `{workflow.defaults.parallelism_strategy}`:
   - `waves` (recommended): dependency-aware; independent stories run in parallel, dependents wait for their predecessors to merge.
   - `sequential`: one story fully done before the next.
   - `full`: all stories at once (warn: ignores dependencies; high merge-conflict / broken-build risk).

3. **Max parallel stories per wave** — default `{workflow.defaults.max_parallel_stories}`. Cap to what the host can sanely run concurrently.

4. **Fix-loop cap** — default `{workflow.defaults.fix_loop_cap}`. Max review→fix→re-review rounds before a story is escalated as `blocked`.

5. **Release gates** — confirm both default to ON: pause before npm publish (`{workflow.defaults.gate_before_publish}`) and before the epic PR (`{workflow.defaults.gate_before_pr}`). Confirm `{workflow.defaults.npm_dist_tag}` (default `beta`) and the version bump (default `{workflow.defaults.version_bump}`).

6. **Test command** — the project's real test/build gate for the package-integrity check (step-05). Propose `npm run build:plugin` plus the targeted test subset; confirm. (Note: bare `npm test` has a known pre-existing CRLF failure on Windows — see step-05; do not rely on its exit code alone.)

## 3. Record the resolved configuration

Write the resolved config into the Run Ledger header and mirror it to
`{implementation_artifacts}/epic-runs/<epic-id>/run-ledger.md`:

```
Epic:            <id> — <title>
Stories:         <n> ( <ids…> )   skipped(done): <ids…>
review_model:    <model>          exec_model: <model>   (tiers collapsed: yes/no)
strategy:        <waves|sequential|full>   max_parallel: <n>   fix_cap: <n>
gates:           publish=<on/off>  pr=<on/off>   dist-tag=<tag>  bump=<bump>
test_gate:       <command(s)>
```

## 4. Confirm and proceed

Present the resolved config in one compact block and **HALT for a single go/no-go confirmation**. This is the last broad confirmation — after "go", stories run unattended through to the two release gates.

On "go": read fully and follow `./steps/step-02-plan-waves.md`.
