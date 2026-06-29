# Step 03 — Create the Epic Feature Branch

**Goal:** Establish the integration branch for the whole epic, off the trunk, before any story work begins. This is the branch the final PR targets `main` from, and the branch every story branch merges back into.

## Branch topology (the contract)

```
main
  └── feature/epic-<epic-id>                 ← epic integration branch (this step)
        ├── feature/epic-<epic-id>-story-<s1>   ← per-story branch (step-04, own worktree)
        ├── feature/epic-<epic-id>-story-<s2>
        └── …                                    each merges back into feature/epic-<epic-id>
```

- The **epic branch** is cut from `main` (this repo's trunk; confirm the trunk name — `main` here).
- Each **story branch** is cut from the **epic branch**, developed in its own worktree, and merged back into the epic branch when it passes its Definition of Done (step-04). Stories integrate with `--no-ff` so each story is one reviewable merge commit. No PR per story (the user approves only the epic PR).
- The single **epic PR** (step-06) is `feature/epic-<epic-id>` → `main`.

## Procedure

All git here follows `git-workflow-skill`. The only epic-specific override is the **base branch**: the epic branch is cut from the **trunk** (`main`), not from `dev`.

1. Follow `git-workflow-skill` to create the epic worktree + feature branch, with the base overridden to the trunk. Use its `start-feature.sh` if it accepts a base argument; otherwise use the skill's documented **manual** equivalent:
   ```bash
   git fetch origin
   # git-workflow-skill manual form, base overridden to the trunk:
   git worktree add .worktrees/epic-<epic-id> -b feature/epic-<epic-id> main
   ```
   (`.worktrees/` is gitignored in this repo. Confirm the trunk name first — `main` here. Ensure the skill's git hooks are installed so commit-message/branch protections apply.)
2. Record the epic worktree path and branch in the Run Ledger.
3. Story worktrees are created later, one per story, branched from `feature/epic-<epic-id>` — see step-04.

**Do not** write any non-git file outside a worktree from here on. All story output lands in story worktrees; all integration lands on the epic branch.

Then read fully and follow `./steps/step-04-run-waves.md`.
