# Project Structure & Architectural Boundaries

> **Shard** of the [Architecture index](../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
ma-agents/
├── package.json                    — npm package config, version, bin entry
├── index.js                        — programmatic API exports
├── README.md                       — user-facing documentation
├── QUICK_START.md                  — getting started guide
├── DEVELOPMENT.md                  — contributor development guide
├── CONTRIBUTING.md                 — contribution guidelines
├── SKILLS_STRUCTURE.md             — skill authoring reference
├── LICENSE                         — project license
├── .gitignore                      — excludes node_modules, _bmad/, .claude/ (NOT _bmad-output — tracked as project knowledge per F3)
│
├── bin/
│   └── cli.js                      — CLI entry point, command routing, interactive wizard
│
├── lib/
│   ├── installer.js                — core install engine, manifest management, MANIFEST.yaml gen
│   ├── agents.js                   — agent registry (12 agents incl. OpenCode), platform paths, resource maps
│   ├── bmad.js                     — BMAD lifecycle: install, update, customize, recompile, bundled cache pre-population
│   ├── bmad-cache/                 — pre-cloned BMAD external modules (committed, built via build:bmad-cache)
│   │   ├── bmb/                    — bmad-builder (with pre-installed node_modules, no .git/)
│   │   ├── cis/                    — bmad-creative-intelligence-suite
│   │   ├── tea/                    — bmad-method-test-architecture-enterprise
│   │   └── gds/                    — bmad-game-dev-studio
│   ├── bmad-extension/             — BMAD extension module (deployed via --custom-content)
│   │   ├── module.yaml             — code: ma-skills, extends-module: bmm
│   │   ├── module-help.csv         — capability registry for agents + workflows
│   │   └── skills/                 — all agents and workflows as BMAD 6.2.0 skills
│   │       ├── bmad-ma-agent-sre/           — agent skill: Alex (SRE)
│   │       │   ├── SKILL.md                 — full agent definition
│   │       │   └── bmad-skill-manifest.yaml — type: agent
│   │       ├── bmad-ma-agent-devops/        — agent skill: Amit (DevOps)
│   │       ├── bmad-ma-agent-cyber/         — agent skill: Yael (Cyber)
│   │       ├── bmad-ma-agent-mil498/        — agent skill: Joseph (MIL-498)
│   │       ├── mil498-sss/                  — MIL-498 DID workflow (Complex Workflow)
│   │       │   ├── SKILL.md
│   │       │   ├── bmad-skill-manifest.yaml — type: skill
│   │       │   ├── template.md
│   │       │   └── prompts/                 — step files
│   │       ├── mil498-ssdd/ ... mil498-hrs/ — (11 MIL-498 DID workflows total)
│   │       ├── sre-health-check/ ... sre-gitops-status/ — (9 SRE playbooks)
│   │       ├── devops-configure-infrastructure/ ... devops-sign-docker-image/ — (6 DevOps playbooks)
│   │       ├── cyber-vulnerability-scan/ ... cyber-verify-image-signature/ — (8 Cyber playbooks)
│   │       ├── create-bug-story/            — bug story from report (FR61)
│   │       ├── add-sprint/                  — new sprint entry in unified sprint-status.yaml (FR68)
│   │       ├── modify-sprint/               — update sprint metadata/items in unified file (FR70)
│   │       ├── add-to-sprint/               — move items from backlog to sprint in unified file (FR69)
│   │       ├── close-sprint/               — sprint close lifecycle: archive done, disposition remaining (P2-11)
│   │       ├── remove-from-sprint/         — move items from sprint back to backlog
│   │       └── open-graph/                 — generate knowledge-graph.html and open it (P3-1)
│   └── bmad-customize/             — .customize.yaml for built-in BMM agents (deployed to _bmad/_config/agents/)
│       ├── bmm-pm.customize.yaml            — critical_actions only
│       ├── bmm-architect.customize.yaml
│       ├── bmm-dev.customize.yaml
│       ├── bmm-qa.customize.yaml
│       ├── bmm-sm.customize.yaml
│       ├── bmm-tech-writer.customize.yaml
│       ├── bmm-ux-designer.customize.yaml
│       └── core-bmad-master.customize.yaml  — bmad-master critical_actions
│
├── skills/                         — skill library (28 skills incl. auto-bug-detection, self-contained directories)
│   ├── <skill-name>/
│   │   ├── skill.json              — metadata SSoT
│   │   ├── SKILL.md                — canonical content
│   │   ├── templates/              — agent-specific templates (optional)
│   │   │   ├── claude-code.md
│   │   │   ├── cline.md
│   │   │   └── generic.md
│   │   ├── references/             — supporting docs (optional)
│   │   └── assets/                 — templates/configs (optional)
│   └── MANIFEST.yaml               — generated skill index for agent consumption
│
├── _bmad/                          — BMAD-METHOD installation (git-ignored, installed at runtime)
│   ├── core/                       — BMAD core workflows, tasks, agents
│   ├── bmm/                        — BMM module (workflows, config, templates)
│   │   ├── config.yaml             — project-specific BMM configuration
│   │   └── workflows/              — BMAD workflow library
│   └── _config/                    — BMAD configuration and catalog
│
├── _bmad-output/                   — BMAD workflow outputs (version-controlled as project knowledge, NOT git-ignored per F3)
│   ├── planning-artifacts/         — PRD, architecture, epics
│   ├── implementation-artifacts/   — stories, specs
│   │   ├── done/                   — archived done/canceled story files (P2-11 close-sprint)
│   │   └── sprint-status.yaml      — unified sprint/backlog tracking (P2-11 — single source of truth)
│   ├── knowledge-graph.json        — NEW: knowledge graph data (P3-1, version-controlled)
│   └── knowledge-graph.html        — NEW: self-contained renderer (P3-1, generated by open-graph skill)
│
├── docs/                           — generated project documentation
│   ├── index.md                    — documentation master index
│   ├── project-overview.md         — executive summary
│   ├── architecture.md             — existing architecture reference
│   ├── source-tree-analysis.md     — annotated directory tree
│   └── development-guide.md        — setup and common tasks
│
└── tests/                          — test directory (Phase 2 — currently empty)
    ├── installer.test.js           — installer engine tests
    ├── agents.test.js              — agent registry tests
    ├── bmad.test.js                — BMAD integration tests
    └── cli.test.js                 — CLI command tests
```

### Target Structure after P5-10 (2026-10-31 — Epics 33–35)

The tree above is the **current** single-package layout and remains accurate until Epic 33 lands. The target is two repositories:

```
ma-bmad-extensions/                       — NEW repository: the five BMAD extensions
├── .claude-plugin/marketplace.json       — one plugin per module (discovery mode → installer picker)
├── shared/                               — canonical text rendered into consuming skills at build
│   ├── tracker-routing.md                — (was pasted in 13 sprint skills)
│   └── knowledge-store-preflight.md      — (was pasted in 17 skills)
├── modules/
│   ├── ma-ops-agents/                    — module.yaml (code, module_version) + module-help.csv
│   │   ├── ma-agent-{sre,devops,cyber,sqa}/
│   │   ├── sre-*/ devops-*/ cyber-*/ sqa-*/
│   │   ├── mil498-*/                     — templates moved into each skill's assets/
│   │   ├── create-hardened-docker-skill/ verify-hardened-docker-skill/ docker-*/ self-signed-cert/
│   │   └── bmad-dev-epic/                — orchestrates bmad-build / build-auto / code-review / review / walkthrough
│   ├── ma-sprint/
│   │   ├── add-sprint/ … sprint-status-view/ create-bug-story/ story-status-lookup/
│   │   └── (each: customize.toml with [workflow] tracker = "file-system" + activation_steps_prepend)
│   ├── ma-atlassian/
│   │   ├── module.yaml                   — config questions: jira_url, jira_project_key, confluence_space, confluence_root_page
│   │   ├── ma-atlassian-setup/           — generates _bmad/custom/<skill>.toml overrides from the version-keyed target table
│   │   │   ├── references/jira-tracker.md
│   │   │   ├── references/confluence-store.md
│   │   │   ├── references/targets.yaml   — {bmad-method version → skill → roles}
│   │   │   └── scripts/                  — binding stamp, page tree, publish-hook generator (from lib/confluence-*.js + bin/cli.js)
│   │   ├── my-next-issue/ bind/ confluence-plan/ confluence-record-root-page/
│   ├── ma-knowledge/
│   │   └── bmad-knowledge/scripts/atlas.cjs
│   └── ma-standards/
│       ├── cpp-*/ csharp-*/ python-*/ js-ts-*/ cmake-*/ logging-*/ opentelemetry-*/ vercel-react-*/
│       ├── code-documentation/ git-workflow-skill/ code-review/ commit-message/ ai-audit-trail/ test-*/ …
│       └── ma-standards-setup/           — injects the always-load rule block into per-tool instruction files
├── scripts/build.js                      — renders shared/, validates every SKILL.md, emits per-module digests
└── test/                                 — per-module: manifest enumeration, drift gate, offline PluginResolver passthrough

ma-agents/                                — THIS repository after Epic 35: the thin offline installer
├── bin/cli.js                            — wizard (scope, profile, tools, modules), stage-and-invoke, IDE injection only
├── lib/{installer,agents,bmad,profile,reconfigure,uninstall}.js
├── lib/bmad-cache/                       — bmm built-in; tea / bmb / cis at the v6.12.4 registry pins
├── lib/extensions/                       — pinned copies of modules/* from one ma-bmad-extensions tag (staged as N --custom-source paths)
├── lib/templates/                        — instruction-block templates
└── test/                                 — installer, injection, offline gate (uv in the loop)
```

Removed from `ma-agents` by Epic 35: `lib/bmad-extension/`, `lib/bmad-extension-plugin/`, `skills/`, `lib/knowledge-atlas/`, `lib/confluence-*.js`, `lib/custom-marketplace.js`, `lib/bmad-workflows/`, `lib/mil498-templates/`, `mil498/`, and the `bind` / `confluence-*` CLI commands.

### Architectural Boundaries

**Module Boundaries (4 modules, strict separation):**

| Module | Responsibility | Talks To | Never Touches |
|--------|---------------|----------|---------------|
| `cli.js` | Command parsing, user interaction, wizard flow | installer.js, agents.js, bmad.js | File system directly (delegates to installer) |
| `installer.js` | Skill install/uninstall, manifest CRUD, MANIFEST.yaml generation | agents.js (for paths/config) | BMAD lifecycle (delegates to bmad.js) |
| `agents.js` | Agent registry, platform path resolution, resource maps | Nothing (pure data + path functions) | Install logic, BMAD logic |
| `bmad.js` | BMAD install/update/customize/recompile pipeline | File system (fs operations) | Agent registry, skill install logic |

**Data Flow Boundaries:**
```
User Input → cli.js → installer.js → agents.js (path lookup) → file system
                    → bmad.js (if BMAD requested) → file system
                    → installer.js (manifest update) → .ma-agents.json
```

### Requirements to Structure Mapping

| FR Category | Primary Module | Directory |
|-------------|---------------|-----------|
| Skill Management (FR1-7) | `installer.js` | `skills/`, target agent directories |
| BMAD Integration (FR8-12) | `bmad.js` | `_bmad/` |
| MIL-STD-498 Generation (FR13-23) | BMAD workflows | `_bmad/bmm/workflows/` |
| SDLC Workflow Execution (FR24-33) | BMAD workflows | `_bmad/bmm/workflows/`, `_bmad/core/` |
| Agent Targeting (FR34-38) | `agents.js` + `installer.js` | `lib/agents.js`, `skills/*/templates/` |
| Skill Authoring (FR39-43) | `installer.js` (MANIFEST.yaml gen) | `skills/` |
| Environment & Deployment (FR44-47) | `agents.js` (paths) + `installer.js` (manifest) | Platform-specific agent directories |
| Audit & Traceability (FR48-50) | BMAD workflows | `_bmad/bmm/workflows/` |
| Skill Enforcement (FR51-55) | `installer.js` + `agents.js` + `bmad.js` | `lib/bmad-extension/agents/` |
| OpenCode Support (FR56-58) | `agents.js` + `installer.js` | `.opencode/`, `opencode.json` |
| Project Knowledge (FR59-60) | `installer.js` | `.gitignore` modification |
| Bug Management (FR61-65) | BMAD extension workflows + skill | `lib/bmad-extension/skills/`, `skills/auto-bug-detection/` |
| Sprint Management (FR66-71) | BMAD extension workflows + unified `sprint-status.yaml` (P2-11) | `lib/bmad-extension/skills/`, `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Bundled BMAD (FR74-FR76) | `bmad.js` + `lib/bmad-cache/` + `package.json` | `lib/bmad-cache/`, `bmad.js` |

### Integration Points

**Internal Communication:**
- `cli.js` calls `installer.js` functions directly (same process, no IPC)
- `installer.js` calls `agents.js` for path resolution and agent config lookup
- `cli.js` calls `bmad.js` directly for BMAD lifecycle operations
- No event bus, no message queue — synchronous function calls within one process

**External Integrations:**
- npm registry (distribution only — `npx` handles this, not our code)
- File system (the only external system the tool interacts with at runtime)
- No network calls, no APIs, no databases
