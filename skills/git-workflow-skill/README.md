# Git Workflow Skill

Mandatory feature branch workflow for Git operations with automatic PR creation.

## Quick Start

```bash
# Start a new feature
./scripts/start-feature.sh feature my-feature-name

# Make your changes...

# Finish and create PR (auto-switches to dev)
./scripts/finish-feature.sh
```

## What It Does

✅ **Enforces feature branch workflow**
- Creates branches from `dev`
- Prevents commits to `dev`/`main`
- Validates branch naming

✅ **Validates commits**
- Conventional commit format
- Git hooks for automation

✅ **Automatic PR creation**
- Uses GitHub CLI (`gh`)
- Creates PR to `dev` branch
- Switches back to `dev` after push

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
```

Creates branch `feature/oauth-login` from latest `dev`.

### 2. Make Changes
```bash
# Edit files...
git add .
git commit -m "feat(auth): add OAuth login flow"
```

### 3. Finish Feature
```bash
./scripts/finish-feature.sh
```

This will:
1. ✅ Validate you're on a feature branch
2. ✅ Check for uncommitted changes
3. ✅ Validate conventional commit messages
4. ✅ Rebase on latest `dev`
5. ✅ Push feature branch
6. ✅ **Create PR to `dev`** (auto)
7. ✅ **Switch back to `dev`** (auto)

### 4. Review & Merge
- Request code review on the PR
- Merge after approval

## Commit Format

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

**Examples:**
- `feat(auth): add OAuth2 flow support`
- `fix(api): handle null response from endpoint`
- `chore(deps): update dependencies`

## Requirements

- Git
- **GitHub CLI (`gh`)** - For automatic PR creation
  ```bash
  # Install
  brew install gh          # macOS
  winget install GitHub.cli # Windows
  apt install gh           # Linux

  # Authenticate
  gh auth login
  ```

**Note:** If `gh` is not installed, the script will skip PR creation but still push the branch successfully. You can create the PR manually.

## Validation

Validate workflow compliance anytime:
```bash
./scripts/validate-workflow.sh
```

## Critical Rules

- **NEVER** commit directly to `dev` or `main`
- **ALWAYS** create feature branch before changes
- **ALWAYS** use conventional commit format
- **ALWAYS** rebase on `dev` before pushing

## Git Hooks

Install hooks to enforce workflow:
```bash
./scripts/install-hooks.sh
```

Hooks:
- `pre-commit` - Blocks commits on dev/main
- `commit-msg` - Validates conventional commit format
- `prepare-commit-msg` - Adds commit message template

## See Also

- [SKILL.md](SKILL.md) - Full documentation
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI](https://cli.github.com/)
