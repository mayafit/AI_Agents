#!/bin/bash
# start-feature.sh - Create a new feature branch from dev
# Usage: start-feature.sh <branch-type> <description>
# Example: start-feature.sh feature add-oauth-support

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() { echo -e "${RED}ERROR: $1${NC}" >&2; exit 1; }
warn() { echo -e "${YELLOW}WARNING: $1${NC}" >&2; }
success() { echo -e "${GREEN}$1${NC}"; }

# Validate arguments
BRANCH_TYPE="$1"
DESCRIPTION="$2"

if [[ -z "$BRANCH_TYPE" || -z "$DESCRIPTION" ]]; then
    echo "Usage: $0 <branch-type> <description>"
    echo "Branch types: feature, bugfix, hotfix, chore"
    echo "Example: $0 feature add-oauth-support"
    exit 1
fi

# Validate branch type
case "$BRANCH_TYPE" in
    feature|bugfix|hotfix|chore) ;;
    *) error "Invalid branch type '$BRANCH_TYPE'. Use: feature, bugfix, hotfix, chore" ;;
esac

# Sanitize description (replace spaces with dashes, lowercase)
DESCRIPTION=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
BRANCH_NAME="${BRANCH_TYPE}/${DESCRIPTION}"

# Check we're in a git repo
git rev-parse --git-dir > /dev/null 2>&1 || error "Not in a git repository"

# Fetch latest from remote
echo "Fetching from remote..."
git fetch origin

# Verify dev branch exists
if ! git branch -a | grep -qE '(^|\/)dev$'; then
    error "Branch 'dev' does not exist. Please create it first or specify a different base branch."
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    error "You have uncommitted changes. Please commit or stash them first."
fi

# Check if branch already exists
if git branch -a | grep -q "${BRANCH_NAME}"; then
    error "Branch '${BRANCH_NAME}' already exists"
fi

# Checkout dev and pull latest
echo "Switching to dev and pulling latest..."
git checkout dev
git pull origin dev

# Create and checkout new branch
echo "Creating branch '${BRANCH_NAME}'..."
git checkout -b "$BRANCH_NAME"

success "✓ Created and switched to branch: ${BRANCH_NAME}"
echo ""
echo "Next steps:"
echo "  1. Make your changes"
echo "  2. Commit using conventional format: git commit -m 'type(scope): description'"
echo "  3. Run 'finish-feature.sh' when ready to push"
