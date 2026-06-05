## Git Workflow (ALL file-changing tasks)

These rules apply to EVERY task that modifies a tracked file. There is no
"small fix exemption" — a one-line edit follows the same workflow as a feature.

- **Worktree first.** Before changing any file, create a fresh isolated worktree
  on a new feature branch: `git worktree add ../<project>-<branch> -b <branch>`.
  The scripted form is `skills/git-workflow-skill/scripts/start-feature.sh`. All
  file-writing happens inside that worktree — never in the main working tree.
- **Never commit directly to the trunk.** Do NOT commit to `main`, `dev`,
  `master`, or whatever the trunk branch is. Commits land only on your feature
  branch inside the worktree.
- **Conventional Commits.** Every commit message uses a Conventional Commits
  prefix. The allowed prefixes are: `feat`, `fix`, `chore`, `docs`, `refactor`,
  `test`, `ci`.
- **PR is the only path into the trunk.** Integrate exclusively by opening a pull
  request with `gh pr create`. Never merge directly and never auto-merge a PR
  without explicit human approval.
- **Self-review before opening the PR.** Run the `code-review` skill on your own
  changes and address its findings before you open the PR.
- **Clean up after merge.** Once the PR is merged, remove the worktree with
  `git worktree remove` and delete the feature branch.

Full procedure: see `skills/git-workflow-skill/SKILL.md`, and the helper scripts
`scripts/start-feature.sh` / `scripts/finish-feature.sh`.
