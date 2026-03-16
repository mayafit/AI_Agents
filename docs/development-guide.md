# Development Guide — ma-agents

**Generated:** 2026-03-04 | **Version:** 2.19.2

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: Bundled with Node.js
- **Git**: Required for version control and git-related skills
- **Bash**: Required for most skill scripts

## Setup

```bash
git clone https://github.com/mayafit/AI_Agents.git
cd AI_Agents
npm install
node bin/cli.js help
```

## Project Structure

```
bin/cli.js              # CLI entry point (wizard, commands, flags)
lib/
├── agents.js           # Agent registry (paths, versions, resource maps)
├── installer.js        # Core logic (install, uninstall, manifest, status)
├── bmad.js             # BMAD-METHOD integration
├── bmad-customizations/# BMAD persona templates and YAML configs
├── bmad-workflows/     # Specialized BMAD playbooks
└── mil498-templates/   # MIL-STD-498 DID library
skills/                 # 27 bundled skills (one directory per skill)
index.js                # Programmatic API exports
```

## Common Development Tasks

### Run CLI Locally

```bash
node bin/cli.js                    # Interactive wizard
node bin/cli.js list               # List skills
node bin/cli.js agents             # List agents
node bin/cli.js status             # Show installed
node bin/cli.js help               # Help text
```

### Test Install/Uninstall

```bash
node bin/cli.js install code-review claude-code --force
node bin/cli.js status
node bin/cli.js uninstall code-review claude-code
```

### Quick Smoke Test (Programmatic)

```bash
node -e "const m = require('.'); console.log('Skills:', m.listSkills().length, 'Agents:', m.listAgents().length)"
```

### Add a New Skill

1. `mkdir -p skills/my-skill`
2. Create `skill.json` with `name`, `description`, `version`
3. Create `SKILL.md` — pure Markdown, no YAML frontmatter
4. (Optional) Add `scripts/`, `references/`, `examples/`, `hooks/`, `assets/`
5. (Optional) Create agent-specific templates: `claude-code.md`, `cline.md`, `generic.md`
6. Verify: `node bin/cli.js list`
7. Test install: `node bin/cli.js install my-skill claude-code`

### Add a New Agent

1. Edit `lib/agents.js`
2. Add entry to `agents` array with all required fields
3. Verify: `node bin/cli.js agents`
4. Test install: `node bin/cli.js install code-review my-agent`

## Versioning

Three independent semver tracks:

| Scope | File | Bump When |
|-------|------|-----------|
| Package | `package.json` | CLI or API changes |
| Skill | `skills/<name>/skill.json` | Skill content changes |
| Agent | `lib/agents.js` | Agent config changes |

## Commit Conventions

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new skill for API testing
fix: correct Cline resource mapping
chore: bump code-review to v1.0.1
docs: update SKILLS_STRUCTURE.md
refactor: extract manifest logic
```

Scopes: `cli`, `installer`, `agents`, `skills`, `docs`

## Pre-Publish Checklist

- [ ] Package version bumped in `package.json`
- [ ] Skill versions bumped for changed skills
- [ ] Agent versions bumped for changed configs
- [ ] `node bin/cli.js list` — all skills appear
- [ ] `node bin/cli.js agents` — all agents appear
- [ ] Fresh install test with `--force`
- [ ] Upgrade detection test (run install again without `--force`)
- [ ] Uninstall test
- [ ] Status test
- [ ] Help text up to date
- [ ] Conventional commit message

## Code Style

- 2 spaces indentation
- Follow existing patterns
- Comments for complex logic only
- Functions kept focused and small
