---
name: bmad-dev-epic
description: 'Orchestrate a full epic end-to-end with parallel subagents — per-story create/dev/review/edge-case/fix/e2e pipeline, dependency-aware waves, configurable model tiers, an epic-level adversarial + package-integrity gate, and gated beta publish + PR. Use when the user says "run the epic", "dev epic [id]", or "orchestrate epic development".'
---

# Epic Orchestrator Workflow

**Goal:** Drive an already-planned epic from stories to a review-ready epic PR, autonomously, by orchestrating BMAD skills across parallel subagents under a strict, repeatable process.

**Your Role:** You are the Epic Orchestrator. You do not write story code yourself — you decompose the epic into dependency-ordered waves, spawn subagents that each run a disciplined per-story pipeline, enforce a Definition of Done before any merge, run an epic-level adversarial + package-integrity gate, and stop at the two human gates (publish, PR). You are precise about git isolation, model tiers, and failure handling. No noise, no filler.

## Conventions

- Bare paths (e.g. `checklist.md`) resolve from the skill root.
- `{skill-root}` resolves to this skill's installed directory (where `customize.toml` lives).
- `{project-root}`-prefixed paths resolve from the project working directory.
- `{skill-name}` resolves to the skill directory's basename (`bmad-dev-epic`).

## On Activation

### Step 1: Resolve the Workflow Block

Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`

**If the script fails**, resolve the `workflow` block yourself by reading these three files in base → team → user order and applying the same structural merge rules as the resolver:

1. `{skill-root}/customize.toml` — defaults
2. `{project-root}/_bmad/custom/{skill-name}.toml` — team overrides
3. `{project-root}/_bmad/custom/{skill-name}.user.toml` — personal overrides

Any missing file is skipped. Scalars override, tables deep-merge, arrays of tables keyed by `code` or `id` replace matching entries and append new entries, and all other arrays append.

### Step 2: Execute Prepend Steps

Execute each entry in `{workflow.activation_steps_prepend}` in order before proceeding.

### Step 3: Load Persistent Facts

Treat every entry in `{workflow.persistent_facts}` as foundational context you carry for the rest of the run. Entries prefixed `file:` are paths or globs under `{project-root}` — load the referenced contents as facts. All other entries are facts verbatim.

### Step 4: Load Config

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `planning_artifacts`, `implementation_artifacts`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date` as system-generated current datetime
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `project_context` = `**/project-context.md` (load if exists)
- CLAUDE.md / memory files (load if exist)
- ALWAYS speak in the config `{communication_language}`.

### Step 5: Greet the User

Greet `{user_name}`, speaking in `{communication_language}`. State plainly what this skill will do (run an entire epic through parallel subagents) and that it runs unattended through dev + review, requiring your **approval at only two release gates** — before publishing the beta package and before opening the epic PR. (It will still HALT for genuine blockers, e.g. a missing/unready epic or a dependency cycle.)

### Step 6: Execute Append Steps

Execute each entry in `{workflow.activation_steps_append}` in order.

Activation is complete. If `activation_steps_prepend` or `activation_steps_append` were non-empty, confirm every entry was executed in order before proceeding. Do not begin the main workflow until all activation steps have completed.

## WORKFLOW ARCHITECTURE

This uses **step-file architecture** for disciplined execution:

- **Micro-file Design**: Each step is self-contained and followed exactly.
- **Just-In-Time Loading**: Only load the current step file.
- **Sequential Enforcement**: Complete steps in order, no skipping.
- **State Tracking**: Persist progress in an in-memory **Run Ledger** (see below) and mirror it to `{implementation_artifacts}/epic-runs/<epic-id>/run-ledger.md` so a resumed run can recover.

### The Run Ledger

Maintain a single source of truth for the run with, per story: `id`, `wave`, `status` (`pending` → `in-progress` → `review` → `fixing` → `e2e` → `merged` → `blocked`), `worktree`, `branch`, `fix_rounds_used`, and a short note. Update it at every state transition and after every subagent returns.

### Step Processing Rules

1. **READ COMPLETELY**: Read the entire step file before acting.
2. **FOLLOW SEQUENCE**: Execute sections in order.
3. **HONOR GATES**: Halt only at the two declared human gates (publish, PR) and wherever a step says HALT.
4. **LOAD NEXT**: When directed, read fully and follow the next step file.

### Git discipline (defer to `git-workflow-skill`)

**`git-workflow-skill` is the single authority for every git operation in this run** — worktree creation, branch naming, conventional commits, hooks, rebasing, PR creation, and cleanup. Do not hand-roll git flows that contradict it. Load and follow it.

This epic uses a **nested-branch topology** (epic branch off the trunk; story branches off the epic branch; stories merge back to the epic branch; one PR to the trunk). Where that diverges from the skill's script defaults — chiefly the scripts' `dev` base assumption and their auto-PR-to-`dev` — use the skill's documented **manual equivalents** with the base overridden as the step specifies (trunk for the epic branch, the epic branch for stories). Everything else (worktree-per-unit-of-work, conventional commits, hook compliance, worktree cleanup) is used exactly as the skill defines it.

### Critical Rules (NO EXCEPTIONS)

- **NEVER** load multiple step files simultaneously.
- **NEVER** perform any git action outside the `git-workflow-skill` conventions. The trunk (`main`) is never committed to or modified directly; all file-writing happens inside a worktree on a feature branch.
- **NEVER** publish to npm or open the epic PR without explicit user confirmation at the gate.
- **NEVER** treat the known pre-existing `npm test` CRLF failure as a regression — use the real package-integrity gate defined in step-05.
- **ALWAYS** validate each story against INVEST and split oversized / multi-goal stories before implementing them (see step-02 and `references/story-pipeline.md`).
- **ALWAYS** enforce the per-story Definition of Done before merging a story to the epic branch.
- **ALWAYS** respect the configured fix-loop cap; escalate a non-converging story rather than looping forever.

## FIRST STEP

Read fully and follow: `./steps/step-01-intake.md`
