# Git Workflow Skill (Worktree-Based)

Multi-agent parallel development using git worktrees. Each agent gets an isolated working directory — no branch switching, no conflicts.

## Quick Start

```bash
# Start a new feature (creates isolated worktree)
./scripts/start-feature.sh feature my-feature-name
cd .worktrees/my-feature-name/

# Make your changes and commit...
git add .
git commit -m "feat(auth): add OAuth login flow"

# Finish: rebase, push, create PR, clean up worktree
./scripts/finish-feature.sh
```

## Why Worktrees?

Traditional `git checkout` means only one branch at a time. With worktrees:
- Multiple agents work on different features **simultaneously**
- No branch switching — each agent has its own directory
- Shared git history — no duplicated repos
- Automatic cleanup after PR creation

## How It Works

```
project/                              ← main repo (stays on dev)
├── .worktrees/auth-system/           ← Agent 1 works here
├── .worktrees/api-refactor/          ← Agent 2 works here
└── .worktrees/update-docs/           ← Agent 3 works here
```

## Branch Naming

| Type | Use Case |
|------|----------|
| `feature/<desc>` | New functionality |
| `bugfix/<desc>` | Bug fixes |
| `hotfix/<desc>` | Urgent production fixes |
| `chore/<desc>` | Maintenance tasks |

## Workflow Steps

### 1. Start Feature
```bash
./scripts/start-feature.sh feature oauth-login
cd .worktrees/oauth-login/
```
Creates branch `feature/oauth-login` in isolated worktree.

### 2. Make Changes
```bash
git add .
git commit -m "feat(auth): add OAuth login flow"
```

### 3. Finish Feature
```bash
./scripts/finish-feature.sh
```
1. Validates feature branch and commit messages
2. Rebases on latest `dev`
3. Pushes branch
4. Creates PR to `dev` (auto)
5. Removes worktree (auto-cleanup)

### 4. Review & Merge
- Request code review on the PR
- Merge after approval

## Manage Worktrees

```bash
# List active worktrees
git worktree list

# Validate workflow
./scripts/validate-workflow.sh

# Remove a worktree manually
git worktree remove .worktrees/<desc>

# Clean up stale references
git worktree prune
```

## Commit Format

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

## Requirements

- Git 2.15+ (worktree support)
- **GitHub CLI (`gh`)** - For automatic PR creation
  ```bash
  brew install gh          # macOS
  winget install GitHub.cli # Windows
  apt install gh           # Linux
  gh auth login
  ```

## Git Hooks

Install hooks to enforce workflow:
```bash
./scripts/install-hooks.sh
```

- `pre-commit` - Blocks commits on dev/main
- `commit-msg` - Validates conventional commit format
- `prepare-commit-msg` - Adds commit message template

Hooks are shared across all worktrees automatically.

## Critical Rules

- **NEVER** commit directly to `dev` or `main`
- **ALWAYS** create a worktree for changes
- **ALWAYS** use conventional commit format
- **ALWAYS** add `.worktrees/` to `.gitignore`

## See Also

- [SKILL.md](SKILL.md) - Full documentation
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Worktrees](https://git-scm.com/docs/git-worktree)
- [GitHub CLI](https://cli.github.com/)
