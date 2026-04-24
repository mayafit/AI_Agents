# Contributing to AI Agent Skills

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Ways to Contribute

1. **Add New Skills** - Create useful skills for AI agents
2. **Add Agent Support** - Add support for new AI coding agents
3. **Improve Documentation** - Enhance README and guides
4. **Fix Bugs** - Report and fix issues
5. **Suggest Features** - Propose new features

## Getting Started

### Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd ai-agent-skills

# Install dependencies
npm install

# Test the CLI
node bin/cli.js
```

## Adding a New Skill

1. Create a directory in `skills/` with your skill name (kebab-case)
2. Add `skill.json` with metadata
3. Create at least `generic.md` template
4. Optionally create agent-specific templates
5. Test your skill with multiple agents

See [README.md](README.md#how-to-add-a-new-skill) for detailed instructions.

## Adding a New Agent

1. Edit `lib/agents.js`
2. Add your agent configuration to the `agents` array
3. Test installation with existing skills

See [README.md](README.md#how-to-add-a-new-agent) for detailed instructions.

## Code Style

- Use 2 spaces for indentation
- Follow existing code structure
- Add comments for complex logic
- Keep functions focused and small

## Testing

Before submitting:

1. Test the CLI works: `node bin/cli.js`
2. Test skill installation for multiple agents
3. Verify all paths work on your OS
4. Check that new skills appear in the list

## Reproducing the offline install locally

The `Offline Install Gate` CI workflow
(`.github/workflows/offline-install.yml`) verifies that `ma-agents` can
install into an air-gapped project with all outbound network egress
blocked — this protects the NFR50/NFR54 guarantee that no customer's
air-gapped install ever phones home.

To reproduce the gate locally (Linux/macOS with Docker installed):

```bash
# 1. From the repo root, install deps and build the tarball
npm ci
npm pack

# 2. Capture the tarball filename (it contains the current version)
TARBALL=$(ls -t ma-agents-*.tgz | head -1)

# 3. Run the install inside a container with NO network
docker run --rm \
  --network none \
  -v "$PWD:/workspace:ro" \
  -e TARBALL="$TARBALL" \
  node:20.18.1-bookworm-slim \
  bash /workspace/.github/scripts/offline-install-verify.sh
```

A zero exit code means the air-gapped guarantee still holds. Any
outbound connection attempt — telemetry, `check-for-updates`, a peer
dependency install fetching from the registry — will fail inside the
`--network none` namespace and cause the verifier to exit non-zero.

If the verifier fails, read its step-by-step output (numbered `[1/5]` …
`[5/5]`) to localise the regression: egress block misconfigured,
tarball extraction, offline dep resolution, install invocation, or a
post-install invariant (`_bmad/` present, `.ma-agents-plugin-stage`
cleaned up, `.gitignore` contains the stage entry, etc.).

### A lighter-weight sanity check (no Docker required)

If Docker is unavailable, you can at least confirm the CLI command
sequence works end-to-end — but this does NOT verify the air-gap:

```bash
npm pack
TARBALL=$(ls -t ma-agents-*.tgz | head -1)
mkdir -p /tmp/ma-agents-offline-smoke
cd /tmp/ma-agents-offline-smoke
git init -q
npm install --no-save "$OLDPWD/$TARBALL"
npx ma-agents install --yes --force
ls _bmad/                                            # should exist
test ! -d _bmad/_config/custom/agents && echo "OK"   # no legacy dir
grep -E '^/?\.ma-agents-plugin-stage/?' .gitignore   # ignore entry
```

For actual air-gap verification, use the Docker recipe above.

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit with clear messages: `git commit -m "feat: add new skill"`
5. Push to your fork: `git push origin feature/my-feature`
6. Open a Pull Request

## Pull Request Guidelines

- Provide clear description of changes
- Reference any related issues
- Include testing steps
- Update documentation if needed

## Skill Quality Guidelines

When contributing skills:

- **Clear Instructions**: Provide step-by-step guidance for the AI
- **Good Examples**: Include example interactions
- **Appropriate Scope**: Skill should have a focused purpose
- **Well-Documented**: Include usage instructions
- **Tested**: Verify it works with at least one agent

## Questions?

Feel free to open an issue for:
- Questions about contributing
- Clarification on guidelines
- Feature discussions

Thank you for contributing!
