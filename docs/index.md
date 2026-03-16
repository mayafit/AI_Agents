# Project Documentation Index — ma-agents

## Project Overview

- **Type:** Monolith — CLI Tool with Plugin/Skill System
- **Primary Language:** JavaScript (Node.js >=16)
- **Architecture:** Modular installer pipeline with registry-based agent targeting
- **Version:** 2.19.2

### Quick Reference

- **Framework:** Custom CLI (prompts + chalk)
- **Entry Points:** `bin/cli.js` (CLI), `index.js` (API)
- **Dependencies:** prompts, chalk, fs-extra
- **External:** bmad-method (npx, runtime)
- **Skills:** 27 bundled across 5 domains
- **Agents:** 11 supported (6 IDE + 5 BMAD)

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)

## Existing Documentation

- [README.md](../README.md) — Full project documentation with usage, skills list, and structure
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines for skills, agents, PRs
- [DEVELOPMENT.md](../DEVELOPMENT.md) — Development guide with versioning, testing, and publish checklist
- [QUICK_START.md](../QUICK_START.md) — 2-minute getting started guide
- [SKILLS_STRUCTURE.md](../SKILLS_STRUCTURE.md) — Skill authoring specification and agent output formats
- [LICENSE](../LICENSE) — MIT License

## Getting Started

```bash
# Clone and setup
git clone https://github.com/mayafit/AI_Agents.git
cd AI_Agents
npm install

# Run the CLI
node bin/cli.js

# Quick smoke test
node -e "const m = require('.'); console.log('Skills:', m.listSkills().length, 'Agents:', m.listAgents().length)"
```
