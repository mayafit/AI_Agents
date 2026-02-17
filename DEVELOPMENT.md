# Development Guide

Guidelines for contributing to ma-agents — for both AI agents and human developers.

## Setup

```bash
git clone https://github.com/mayafit/AI_Agents.git
cd AI_Agents
npm install
node bin/cli.js help
```

## Project Architecture

```
ma-agents/
├── bin/cli.js              CLI entry point (wizard, commands, flag parsing)
├── lib/
│   ├── agents.js           Agent configurations (paths, versions, resource maps)
│   └── installer.js        Core logic (install, uninstall, manifest, status)
├── skills/                 Bundled skills (one directory per skill)
├── index.js                Programmatic API exports
├── SKILLS_STRUCTURE.md     Skill authoring reference
├── DEVELOPMENT.md          This file
└── package.json
```

## Versioning (Semver)

This project tracks three independent version numbers. All follow [Semantic Versioning](https://semver.org/).

### Package Version (`package.json`)

The npm package version. Bump on every publish.

| Change | Bump | Example |
|--------|------|---------|
| Bug fix, typo in CLI | PATCH | 1.4.0 → 1.4.1 |
| New command, new feature | MINOR | 1.4.0 → 1.5.0 |
| Breaking API change | MAJOR | 1.4.0 → 2.0.0 |

### Skill Version (`skills/<name>/skill.json`)

Each skill has its own version. Bump when skill content changes.

| Change | Bump | Example |
|--------|------|---------|
| Typo fix, minor wording | PATCH | 1.0.0 → 1.0.1 |
| New instructions, new resources added | MINOR | 1.0.0 → 1.1.0 |
| Breaking changes to skill behavior or structure | MAJOR | 1.0.0 → 2.0.0 |

When you bump a skill version, the installer will detect the change and offer users an upgrade.

### Agent Version (`lib/agents.js`)

Each agent configuration has a version. Bump when the agent config changes.

| Change | Bump | Example |
|--------|------|---------|
| Description update, path correction | PATCH | 1.0.0 → 1.0.1 |
| New field added (e.g., resourceMap) | MINOR | 1.0.0 → 1.1.0 |
| Path structure change that breaks existing installs | MAJOR | 1.0.0 → 2.0.0 |

## Adding a New Skill

1. Create the directory: `mkdir -p skills/my-skill`
2. Create `skill.json` with `name`, `description`, `version` (start at `1.0.0`)
3. Create `SKILL.md` — pure Markdown, no YAML frontmatter
4. (Optional) Add `scripts/`, `references/`, `examples/`, `hooks/`, `assets/`
5. (Optional) Create agent-specific templates: `claude-code.md`, `cline.md`, `generic.md`
6. Verify: `node bin/cli.js list` — your skill should appear
7. Test install: `node bin/cli.js install my-skill claude-code`
8. Check the installed output in `.claude/skills/my-skill/SKILL.md`

See [SKILLS_STRUCTURE.md](SKILLS_STRUCTURE.md) for full documentation.

## Adding a New Agent

1. Edit `lib/agents.js`
2. Add a new entry to the `agents` array with all required fields:
   - `id` — unique kebab-case identifier
   - `name` — display name
   - `version` — start at `1.0.0`
   - `description` — brief description
   - `getProjectPath()` — returns project-level skills path
   - `getGlobalPath()` — returns global path (handle win32, darwin, linux)
   - `fileExtension` — usually `.md`
   - `template` — template ID (`generic`, `claude-code`, `cline`, or new)
   - `resourceMap` — (optional) rename directories for this agent
3. Test: `node bin/cli.js agents` — your agent should appear
4. Test install: `node bin/cli.js install code-review my-agent`

## Manifest System

The installer writes `.ma-agents.json` into each agent's install directory to track what's installed. This enables upgrade detection, version comparison, and clean uninstalls.

```json
{
  "manifestVersion": "1.0.0",
  "agent": "claude-code",
  "scope": "project",
  "skills": {
    "code-review": {
      "version": "1.0.0",
      "installedAt": "2026-02-17T12:34:56Z",
      "updatedAt": "2026-02-17T12:34:56Z",
      "installerVersion": "1.4.0",
      "agentVersion": "1.0.0"
    }
  }
}
```

Do not edit manifests manually. Use `npx ma-agents status` to view and `npx ma-agents uninstall` to remove.

## Pre-Publish Checklist

Before running `npm publish`:

- [ ] Package version bumped in `package.json`
- [ ] Skill versions bumped for any changed skills
- [ ] Agent versions bumped for any changed agent configs
- [ ] `node bin/cli.js list` — all skills appear
- [ ] `node bin/cli.js agents` — all agents appear
- [ ] Test fresh install: `node bin/cli.js install code-review claude-code --force`
- [ ] Test upgrade detection: run install again without `--force`
- [ ] Test uninstall: `node bin/cli.js uninstall code-review claude-code`
- [ ] Test status: `node bin/cli.js status`
- [ ] `node bin/cli.js help` — help text is up to date
- [ ] Commit with conventional commit message

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new skill for API testing
fix: correct Cline resource mapping for docs/
chore: bump code-review skill to v1.0.1
docs: update SKILLS_STRUCTURE.md with hooks directory
refactor: extract manifest logic into separate module
```

**Scopes** (optional): `cli`, `installer`, `agents`, `skills`, `docs`

```
feat(cli): add status command
fix(installer): handle missing manifest gracefully
feat(skills): add vercel-react-best-practices skill
```

## Testing Locally

```bash
# Run CLI directly
node bin/cli.js

# Test specific commands
node bin/cli.js list
node bin/cli.js agents
node bin/cli.js status
node bin/cli.js help

# Test install flow
node bin/cli.js install code-review claude-code --force
node bin/cli.js status
node bin/cli.js uninstall code-review claude-code
node bin/cli.js status

# Quick smoke test (programmatic)
node -e "const m = require('.'); console.log('Skills:', m.listSkills().length, 'Agents:', m.listAgents().length)"
```
