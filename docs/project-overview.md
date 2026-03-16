# Project Overview — ma-agents

**Generated:** 2026-03-04 | **Version:** 2.19.2

## Executive Summary

**ma-agents** is a universal NPX CLI tool that installs AI coding agent skills across multiple AI assistants. It provides a "write once, install everywhere" approach — skills are authored in a unified generic format and the installer translates them into each agent's native structure (frontmatter injection, directory mapping, manifest generation).

The tool supports 11 target agents (6 IDE-based coding assistants + 5 BMAD-METHOD specialized agents) and ships with 27 bundled skills across 5 domains: General, Security, Dependencies, Modern C++, and Architecture.

## Key Value Proposition

- **Universal Skill Format**: Single skill definition works across Claude Code, Gemini, Copilot, Cursor, Cline, and Kilocode
- **Automated Discovery**: Generates `MANIFEST.yaml` and injects planning instructions into agent config files
- **BMAD-METHOD Integration**: First-class support for BMAD's multi-agent orchestration system with specialized personas (SRE, DevOps, Cyber, MIL-STD-498)
- **Upgrade Detection**: Semver-based version tracking with upgrade/downgrade/skip workflows

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | >=16.0.0 |
| Language | JavaScript (CommonJS) | ES2017+ |
| CLI Interaction | prompts | ^2.4.2 |
| Terminal Styling | chalk | ^4.1.2 |
| File System | fs-extra | ^11.1.1 |
| Distribution | npm (npx) | N/A |
| External Integration | bmad-method (npx) | N/A |

## Architecture Classification

- **Repository Type**: Monolith
- **Project Type**: CLI Tool with Plugin/Skill System
- **Architecture Pattern**: Modular installer pipeline with registry-based agent targeting
- **Entry Points**: `bin/cli.js` (CLI), `index.js` (programmatic API)

## Repository Structure

```
ma-agents/
├── bin/cli.js              # CLI entry point
├── lib/                    # Core logic (installer, agents, BMAD integration)
├── skills/                 # 27 bundled skills
├── mil498/                 # MIL-STD-498 DID templates
├── examples/               # Programmatic usage examples
├── index.js                # Programmatic API
└── package.json
```

See [Source Tree Analysis](./source-tree-analysis.md) for full annotated directory tree.

## Links

- [Architecture](./architecture.md)
- [Development Guide](./development-guide.md)
- [Source Tree Analysis](./source-tree-analysis.md)
