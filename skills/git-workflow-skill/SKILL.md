---
name: git-workflow
description: Mandatory feature branch workflow for Git operations. Use this skill BEFORE making ANY change to files in a Git repository that are not ignored by .gitignore. This includes creating, editing, or deleting any tracked files. Enforces branch creation from dev, conventional commits, and PR-based merging. Must be followed before writing code, modifying configs, updating documentation, or any other repository change.
---

# Git Workflow

## Bundled Tools

### Scripts (scripts/)
| Script | Purpose |
|--------|---------|
| `start-feature.sh <type> <desc>` | Create feature branch from dev |
| `finish-feature.sh` | Rebase, validate, push branch |
| `validate-workflow.sh` | Check workflow compliance |
| `install-hooks.sh` | Install git hooks to repo |

### Git Hooks (hooks/)
| Hook | Purpose |
|------|---------|
| `pre-commit` | Blocks commits on dev/main |
| `commit-msg` | Validates conventional commit format |
| `prepare-commit-msg` | Adds commit message template |

**Install hooks:** Run `scripts/install-hooks.sh` in target repository.

### Requirements
- Git
- GitHub CLI (`gh`) - Required for automatic PR creation
  ```bash
  # Install gh
  # macOS
  brew install gh

  # Linux
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install gh

  # Windows
  winget install --id GitHub.cli

  # Authenticate
  gh auth login
  ```

---

## Mandatory Pre-Change Check

Before making ANY change to repository files (that are not in .gitignore):

1. Check if files to be changed are tracked:
   ```bash
   git check-ignore -v <file-path>
   ```
   If file is ignored → proceed without this workflow
   If file is tracked → continue with steps below

2. Verify `dev` branch exists:
   ```bash
   git fetch origin
   git branch -a | grep -E '(^|\/)dev$'
   ```
3. If `dev` does not exist → **STOP and ask user** to create it or specify base branch

## Development Flow

```
Remote: dev ──────────────────────────────────────────────────► dev (updated)
              │                                                   ▲
              │ 1. create feature branch                          │ 5. PR merge
              ▼                                                   │
Remote: feature/xyz ◄───────────────────────────────────────────┤
              │                                                   │
              │ 2. clone/pull                    3. push + PR    │
              ▼                                                   │
Local:  feature/xyz ──► develop ──► commit ──► finish-feature ──┘
              │                                        │
              │ ◄──────────────────────────────────────┘
              ▼                                 4. auto-switch to dev
        dev (local)
```

### Starting Work

**Using script (recommended):**
```bash
./scripts/start-feature.sh feature my-feature-name
```

**Manual:**
```bash
git checkout dev
git pull origin dev
git checkout -b <branch-type>/<short-description>
```

### Branch Naming

| Type | Use Case |
|------|----------|
| `feature/<desc>` | New functionality |
| `bugfix/<desc>` | Bug fixes |
| `hotfix/<desc>` | Urgent production fixes |
| `chore/<desc>` | Maintenance tasks |

### Completing Work

**Using script (recommended):**
```bash
./scripts/finish-feature.sh
```

This script will:
1. Validate you're on a feature branch
2. Validate commit messages (conventional commits)
3. Rebase on latest `dev` branch
4. Push the feature branch
5. **Automatically create a PR to `dev`** (requires `gh` CLI)
6. **Switch back to `dev` branch**

**Note:** If `gh` CLI is not installed or not authenticated, the script will skip PR creation and you'll need to create it manually. The branch will still be pushed successfully.

**Manual:**
1. Pull and rebase on `dev`:
   ```bash
   git fetch origin dev
   git rebase origin/dev
   ```
2. Commit using conventional format (see below)
3. Push feature branch:
   ```bash
   git push -u origin <branch-name>
   ```
4. Create Pull Request:
   ```bash
   gh pr create --base dev --head <branch-name>
   ```
5. Switch back to dev:
   ```bash
   git checkout dev
   git pull origin dev
   ```

### Validation

Run anytime to check workflow compliance:
```bash
./scripts/validate-workflow.sh
```

## Commit Format (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

**Examples:**
- `feat(auth): add OAuth2 flow support`
- `fix(api): handle null response from endpoint`
- `chore(deps): update Helm chart dependencies`
- `docs(readme): add deployment instructions`

## Critical Rules

- **NEVER** modify tracked files without being on a feature branch
- **NEVER** commit directly to `dev` or `main`
- **ALWAYS** check if file is gitignored before applying this workflow
- **ALWAYS** create feature branch before any tracked file changes
- **ALWAYS** rebase on `dev` before pushing
- **ALWAYS** use conventional commit format
