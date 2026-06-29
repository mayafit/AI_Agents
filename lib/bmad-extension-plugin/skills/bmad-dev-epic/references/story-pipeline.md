# Per-Story Pipeline Contract

This is the self-contained instruction set handed to each story subagent. The
orchestrator fills the `<…>` placeholders before spawning. The subagent owns
exactly one story, in exactly one worktree, and never touches the epic branch.

---

## Inputs (filled by the orchestrator)

```
STORY_ID        = <id>
STORY_TITLE     = <title>
EPIC_ID         = <epic-id>
EPIC_BRANCH     = feature/epic-<epic-id>
STORY_BRANCH    = feature/epic-<epic-id>-story-<id>
WORKTREE        = .worktrees/epic-<epic-id>-story-<id>
SPRINT_STATUS   = <path to sprint-status.yaml>
EXEC_MODEL      = <execution-tier model | "host-default">
REVIEW_MODEL    = <review-tier model | "host-default">
FIX_LOOP_CAP    = <n>
TEST_CMD        = <project test/build gate>
```

## Setup

All git follows `git-workflow-skill`; the only override is the base branch
(the story branch is cut from `<EPIC_BRANCH>`, not `dev`).

1. Create the worktree off the epic branch, per `git-workflow-skill` (manual
   form shown, base overridden to the epic branch):
   ```bash
   git worktree add <WORKTREE> -b <STORY_BRANCH> <EPIC_BRANCH>
   ```
2. Work **only** inside `<WORKTREE>`. Use the Conventional Commit format the
   skill enforces (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`),
   scoped to the story. Honor the skill's git hooks.

## Pipeline

### 1. Create story spec — `bmad-create-story` [REVIEW_MODEL]
Produce the context-filled spec for `<STORY_ID>`. If the spec already exists and
is complete, validate it instead of regenerating. The spec's acceptance criteria
(ACs) are the contract for the Definition of Done.

**INVEST & size gate (before implementing).** Once the spec is fleshed out,
re-check it against INVEST and the sizing/focus heuristics (same criteria as
step-02): one focused goal, small enough to reach Definition of Done in this
single pass, testable ACs. A spec often only reveals its true size here. **If
the story is too large or pursues more than one goal, do NOT implement it** —
return immediately with `status: needs-split` and a `split_proposal` (the
smallest set of INVEST-compliant sub-stories, each with a focused goal, derived
ids, and refined dependencies). The orchestrator owns the split because it
affects the epic-wide wave plan (see step-04). Only proceed to step 2 when the
story passes the gate.

### 2. Implement — `bmad-dev-story` [EXEC_MODEL]
Implement strictly against the spec. Follow the repo's always-load skills
(language best-practices, logging, test-accompanied-development, etc.). Commit.

### 3. Adversarial + edge-case review (PARALLEL) [REVIEW_MODEL]
Run both, ideally as parallel sub-subagents, each seeing the story diff:
- `bmad-code-review` — full adversarial review against spec + context.
- `bmad-review-edge-case-hunter` — exhaustive boundary/branch analysis.
Collect both findings sets.

### 4. Triage & fix loop [EXEC_MODEL]
Classify findings as **blocking** (correctness, security, AC miss, broken build)
vs **non-blocking** (style, nits). For blocking findings:
- Run `bmad-dev-story` to fix them. Commit.
- Re-review **only the changed surface**.
- Repeat until no blocking findings remain OR `FIX_LOOP_CAP` rounds are used.
- If the cap is hit with blocking findings remaining → return `status: blocked`
  with the unresolved findings. Do not merge, do not paper over.
Record non-blocking findings in the return notes (not fixed, by design).

### 5. E2E tests — `bmad-qa-generate-e2e-tests` [EXEC_MODEL]
Generate e2e/automated tests for the story's behavior and **run them**. Also run
`<TEST_CMD>` to confirm the story didn't break the package build. If e2e cannot
be made green within the fix budget, return `status: blocked` with details.

### 6. Definition of Done (gate before returning ready)
ALL must hold, or the story is `blocked`:
- [ ] All spec acceptance criteria implemented.
- [ ] No blocking findings remain from either reviewer.
- [ ] E2E tests written and passing.
- [ ] `<TEST_CMD>` passes on the story branch (modulo known pre-existing failures).
- [ ] All work committed with Conventional Commit messages.

## Return value (structured)

```
{
  "story_id":            "<STORY_ID>",
  "status":              "merged-ready" | "blocked" | "needs-split",
  "branch":              "<STORY_BRANCH>",
  "worktree":            "<WORKTREE>",
  "commits":             [ "<sha> <subject>", … ],
  "e2e_status":          "passing" | "failing" | "not-created",
  "unresolved_findings": [ "<blocking finding>", … ],
  "split_proposal":      [ { "id": "<S3a>", "goal": "<focused goal>", "acs": [ … ], "depends_on": [ … ] }, … ],
  "fix_rounds_used":     <n>,
  "notes":               "<non-blocking findings, decisions, caveats>"
}
```

`split_proposal` is populated only when `status: needs-split` (empty/omitted
otherwise). On `needs-split` the subagent has done **no** implementation — it
returns the proposal and stops.

**Do NOT** merge into `<EPIC_BRANCH>`. The orchestrator serializes all
integration into the epic branch (step-04) to avoid parallel-merge races.
