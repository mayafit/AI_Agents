# Source Tree Analysis — ma-agents

**Generated:** 2026-03-04 | **Scan Level:** Deep

## Annotated Directory Tree

```
ma-agents/
├── bin/
│   └── cli.js                          # CLI entry point — wizard, command routing, flag parsing
├── lib/
│   ├── agents.js                       # Agent registry — 11 agent configs (paths, versions, resource maps)
│   ├── installer.js                    # Core engine — install, uninstall, manifest, upgrade detection, MANIFEST.yaml generation
│   ├── bmad.js                         # BMAD-METHOD integration — install/update/customize via node <require.resolve'd path>
│   ├── bmad-customizations/            # BMAD persona templates and YAML customization configs
│   │   ├── *.customize.yaml            # Per-agent YAML customizations (claude-code, cline, cursor, gemini, antigravity, bmm-*)
│   │   ├── sre.md                      # SRE Agent (Alex) full persona definition
│   │   ├── devops.md                   # DevOps Agent (Amit) full persona definition
│   │   ├── cyber.md                    # Cyber Analyst (Yael) full persona definition
│   │   └── mil498.md                   # MIL-STD-498 Expert (Joseph) full persona definition
│   ├── bmad-workflows/                 # Specialized BMAD playbooks deployed post-recompile
│   │   ├── cyber/                      # Cyber security operational workflows
│   │   ├── devops/                     # DevOps deployment/infra workflows
│   │   ├── mil498/                     # MIL-STD-498 document generation workflows (SRS, SDD, SDP, OCD, SSS, STD, SSDD)
│   │   └── sre/                        # SRE operational workflows
│   └── mil498-templates/               # MIL-STD-498 DID templates (SRS, SDD, SDP, OCD, SSS, STD, SSDD)
├── skills/                             # 27 bundled skills (one directory per skill)
│   ├── ai-audit-trail/                 # AI session activity tracking
│   ├── cmake-best-practices/           # CMake build patterns
│   ├── code-documentation/             # Documentation standards enforcement
│   ├── code-review/                    # Comprehensive code review
│   ├── commit-message/                 # Conventional commit generation
│   ├── cpp-concurrency-safety/         # C++ RAII locking and parallelism
│   ├── cpp-const-correctness/          # C++ immutability patterns
│   ├── cpp-memory-handling/            # C++ smart pointers and RAII
│   ├── cpp-modern-composition/         # C++ STL and Ranges patterns
│   ├── cpp-robust-interfaces/          # C++ contract-based design
│   ├── create-hardened-docker-skill/   # Docker hardening (CIS/NIST)
│   ├── docker-hardening-verification/  # Docker security audit
│   ├── docker-image-signing/           # Docker image cryptographic signing
│   ├── document-revision-history/      # Revision history management
│   ├── git-workflow-skill/             # Worktree-based git workflow
│   ├── js-ts-dependency-mgmt/          # JS/TS dependency best practices
│   ├── js-ts-security-skill/          # JS/TS OWASP security verification
│   ├── logging-best-practices/         # Structured JSON logging
│   ├── opentelemetry-best-practices/   # Distributed tracing
│   ├── python-dependency-mgmt/         # Python dependency management
│   ├── python-security-skill/          # Python OWASP security
│   ├── self-signed-cert/               # Root CA and certificate generation
│   ├── skill-creator/                  # Meta: guide for creating new skills
│   ├── test-accompanied-development/   # Test-alongside enforcement
│   ├── test-generator/                 # Unit/integration test generation
│   ├── vercel-react-best-practices/    # React/Next.js performance rules
│   └── verify-hardened-docker-skill/   # Docker config verification
├── mil498/                             # Published MIL-STD-498 DID templates (user-facing copies)
├── examples/
│   └── programmatic-usage.js           # Programmatic API usage example
├── index.js                            # Programmatic API entry point (exports core functions)
├── package.json                        # NPM package config (ma-agents v2.19.2)
├── README.md                           # Full project documentation
├── CONTRIBUTING.md                     # Contribution guidelines
├── DEVELOPMENT.md                      # Development guide with versioning and testing
├── QUICK_START.md                      # 2-minute getting started guide
├── SKILLS_STRUCTURE.md                 # Skill authoring specification
└── LICENSE                             # MIT License
```

## Critical Folders

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `bin/` | CLI entry point | `cli.js` — command routing, interactive wizard, install/uninstall handlers |
| `lib/` | Core business logic | `installer.js` (install engine), `agents.js` (agent registry), `bmad.js` (BMAD integration) |
| `lib/bmad-customizations/` | BMAD agent personas and configs | `.customize.yaml` files + `.md` agent definitions |
| `lib/bmad-workflows/` | BMAD operational playbooks | Subdirs per domain: cyber, devops, mil498, sre |
| `lib/mil498-templates/` | MIL-STD-498 DID templates | 7 document templates (SRS, SDD, SDP, OCD, SSS, STD, SSDD) |
| `skills/` | Bundled skill library | 27 skills across 5 domains (General, Security, Dependencies, C++, Architecture) |

## Entry Points

| Entry Point | Usage | Purpose |
|-------------|-------|---------|
| `bin/cli.js` | `npx ma-agents` | CLI — interactive wizard and direct commands |
| `index.js` | `require('ma-agents')` | Programmatic API — `installSkill`, `listSkills`, `listAgents`, etc. |
