#!/bin/bash
# validate-workflow.sh - Check if current state follows git workflow rules
# Usage: validate-workflow.sh [--fix]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

error() { echo -e "${RED}✗ ERROR: $1${NC}"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}⚠ WARNING: $1${NC}"; WARNINGS=$((WARNINGS + 1)); }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "  $1"; }

echo "Git Workflow Validation"
echo "======================="
echo ""

# Check we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Check 1: Not on protected branch
echo "Checking branch..."
if [[ "$CURRENT_BRANCH" == "dev" || "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    error "On protected branch '$CURRENT_BRANCH'. Create a feature branch for changes."
else
    ok "Not on protected branch"
fi

# Check 2: Branch naming convention
if echo "$CURRENT_BRANCH" | grep -qE '^(feature|bugfix|hotfix|chore)/[a-z0-9-]+$'; then
    ok "Branch name follows convention"
else
    warn "Branch name '$CURRENT_BRANCH' doesn't follow convention: <type>/<description>"
    info "Expected: feature|bugfix|hotfix|chore followed by lowercase alphanumeric with dashes"
fi

# Check 3: dev branch exists
echo ""
echo "Checking repository setup..."
git fetch origin 2>/dev/null || warn "Could not fetch from origin"

if git branch -a | grep -qE '(^|\s)origin/dev$'; then
    ok "Remote 'dev' branch exists"
else
    error "Remote 'dev' branch not found. Create it before using this workflow."
fi

# Check 4: Up to date with dev
echo ""
echo "Checking sync status..."
if git branch -a | grep -qE '(^|\s)origin/dev$'; then
    BEHIND=$(git rev-list --count HEAD..origin/dev 2>/dev/null || echo "0")
    if [[ "$BEHIND" == "0" ]]; then
        ok "Branch is up to date with dev"
    else
        warn "Branch is $BEHIND commit(s) behind dev. Consider rebasing."
        info "Run: git fetch origin dev && git rebase origin/dev"
    fi
fi

# Check 5: Uncommitted changes
echo ""
echo "Checking working directory..."
if git diff-index --quiet HEAD -- 2>/dev/null; then
    ok "No uncommitted changes"
else
    warn "Uncommitted changes detected"
    info "Run: git status"
fi

# Check 6: Untracked files (that aren't ignored)
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l)
if [[ "$UNTRACKED" -gt 0 ]]; then
    warn "$UNTRACKED untracked file(s) found"
    info "Run: git status"
else
    ok "No untracked files"
fi

# Check 7: Validate recent commit messages
echo ""
echo "Checking commit messages..."
if [[ "$CURRENT_BRANCH" != "dev" && "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    COMMITS=$(git rev-list --count origin/dev..HEAD 2>/dev/null || echo "0")
    if [[ "$COMMITS" -gt 0 ]]; then
        INVALID=0
        while IFS= read -r msg; do
            if ! echo "$msg" | grep -qE '^(feat|fix|chore|docs|refactor|test)(\([^)]+\))?: .+'; then
                INVALID=$((INVALID + 1))
            fi
        done < <(git log origin/dev..HEAD --pretty=format:"%s" 2>/dev/null)
        
        if [[ "$INVALID" -eq 0 ]]; then
            ok "All $COMMITS commit(s) follow conventional format"
        else
            warn "$INVALID of $COMMITS commit(s) don't follow conventional format"
            info "Format: <type>(<scope>): <description>"
            info "Types: feat, fix, chore, docs, refactor, test"
        fi
    else
        info "No commits ahead of dev yet"
    fi
fi

# Check 8: Git hooks installed
echo ""
echo "Checking git hooks..."
GIT_DIR=$(git rev-parse --git-dir)
HOOKS_INSTALLED=0

if [[ -f "$GIT_DIR/hooks/pre-commit" && -x "$GIT_DIR/hooks/pre-commit" ]]; then
    ok "pre-commit hook installed"
    HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
else
    warn "pre-commit hook not installed"
    info "Copy from skill hooks/ directory to .git/hooks/"
fi

if [[ -f "$GIT_DIR/hooks/commit-msg" && -x "$GIT_DIR/hooks/commit-msg" ]]; then
    ok "commit-msg hook installed"
    HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
else
    warn "commit-msg hook not installed"
    info "Copy from skill hooks/ directory to .git/hooks/"
fi

# Summary
echo ""
echo "======================="
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Validation failed: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Validation passed with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${GREEN}Validation passed: All checks OK${NC}"
    exit 0
fi
