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
4. **Add a matrix entry to `.github/workflows/multi-tool-smoke.yml`** — see
   [Multi-Tool Smoke Verification](#multi-tool-smoke-verification) below.
   Without this, regressions in the new tool's install routing go
   undetected until end-user reports.

See [README.md](README.md#how-to-add-a-new-agent) for detailed instructions.

## Multi-Tool Smoke Verification

`.github/workflows/multi-tool-smoke.yml` (Story 22.10) is a CI safety net
that catches per-tool routing regressions in the plugin install flow.
Each matrix cell runs `ma-agents install --yes --force --agent <tool>`
against a scratch project and asserts the tool's expected skills
directory is populated correctly.

### Supported targets and expected skills paths

`lib/agents.js` is the canonical source of truth for tool registration.
The current matrix covers:

| Tool `--agent` id | Expected skills path          | Template   |
|-------------------|-------------------------------|------------|
| `claude-code`     | `.claude/skills/`             | claude-code|
| `copilot`         | `.github/copilot/skills/`     | generic    |
| `cline`           | `.cline/skills/`              | cline      |
| `roo-code`        | `.roo/skills/`                | generic    |
| `kilocode`        | `.kilocode/skills/`           | generic    |

### Per-tool invariants asserted

For every matrix cell:

1. **Install exit code** is 0 (`node bin/cli.js install --yes --force --agent <tool>`).
2. **Skills directory exists** at the path listed above.
3. **Skills directory is non-empty** (`find ... -mindepth 1 -maxdepth 1 -type d` returns `>= 1`).
4. **MANIFEST.yaml lists a canonical ma-agents skill id** — if the tool's
   template emits a `MANIFEST.yaml`, the verifier greps it for one of
   `ma-agent-cyber`, `ma-agent-devops`, `ma-agent-sre`, `ma-agent-sqa`,
   `ma-agent-ml`, `code-review`, `commit-message`, `git-workflow-skill`,
   or `skill-creator`. Tools without a MANIFEST skip this invariant.
5. **At least one ma-agent-* persona skill is present** — the primary
   regression signal. If none of `ma-agent-cyber/SKILL.md`,
   `ma-agent-devops/SKILL.md`, `ma-agent-sre/SKILL.md`,
   `ma-agent-sqa/SKILL.md`, or `ma-agent-ml/SKILL.md` exists under the
   skills directory, the plugin routing to that tool has regressed.

   **Known gap (at 22.10 baseline):** `copilot` does not currently
   receive the ma-agent-* persona skills. Local simulation during Story
   22.10 confirmed the gap is specific to copilot's template; the other
   four tools all deliver the personas correctly. Until the underlying
   routing bug is fixed, the persona check for `copilot` is downgraded
   from a hard failure to a workflow warning (visible in every CI run,
   but not build-blocking). Fixing this gap is a follow-up item; when
   resolved, the special-case in
   `.github/scripts/multi-tool-smoke-verify.sh` should be removed so
   copilot enforces strict parity with the other targets.

### Triggers

The workflow runs on:

- PRs that modify any of:
  - `lib/bmad.js`
  - `lib/agents.js`
  - `lib/bmad-extension/**`
  - `lib/bmad-extension-plugin/**`
  - `scripts/build-plugin.js`
  - `bin/cli.js`
  - `lib/installer.js`
  - The workflow or its verifier script itself
- Any tag matching `v*` (release gate).
- Manual `workflow_dispatch` for maintainer debugging.

### Relation to Story 22.9 (Offline Install Gate)

The air-gap workflow (`.github/workflows/offline-install.yml`) and this
multi-tool workflow are deliberately kept as **sibling workflows**, not a
combined `offline × tool` matrix. The two dimensions are orthogonal:
offline-install is a single-tool egress-block check, multi-tool-smoke is
a multi-tool routing check. Keeping them separate gives clearer
regression attribution when CI goes red — you can tell at a glance
whether an egress leak or a per-tool routing regression broke the
build.

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
  node:20.18.1-bookworm \
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
