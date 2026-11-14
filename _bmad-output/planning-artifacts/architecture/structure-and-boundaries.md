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

### Target Structure — ma-agents 4.x

The tree above is the ma-agents 3.x line. ma-agents 4.x is two deliverables: the `ma-bmad-extensions` repository of BMAD v7 modules and the `ma-agents` npm installer with its offline bundle (Decision P5-11).

**Extension repository**

```
ma-bmad-extensions/                         — public GitHub repository github:mayafit/ma-bmad-extensions; one version line;
│                                             tag per release; validate_manifests.py in CI
├── skills/                                 — flat; every folder below sits directly in skills/
│   ├── bmod-ma-ops/                        — record folder, code ma-ops
│   │   ├── bmod.toml                       — [bmod] code, version, update_source, skills (40), required_skills = bmad core,
│   │   │                                     recommended_skills = bmad-build, bmad-agent-po, git-workflow-skill + code-review (with source);
│   │   │                                     no config questions
│   │   ├── SKILL.md                        — stub: redirects to `bmad setup ma-ops`
│   │   ├── help/help.md
│   │   ├── roster.toml                     — Alex, Yael, Amit, Gadi; group "ops"
│   │   ├── retired.toml                    — renamed bmad-dev-epic → ma-ops-dev-epic
│   │   └── migration-1.toml                — 3.x backlog: → {output_folder}/backlog/; sprints: → archive-v6/sprints.yaml; report
│   ├── bmod-ma-standards/                  — record folder, code ma-standards
│   │   ├── bmod.toml                       — skills (29), required_skills = bmad core; no config questions
│   │   ├── SKILL.md  help/help.md
│   │   └── retired.toml                    — empty
│   ├── bmod-ma-knowledge/                  — record folder, code ma-knowledge
│   │   ├── bmod.toml                       — skills (1); config question atlas_output
│   │   ├── SKILL.md  help/help.md
│   │   └── retired.toml                    — renamed bmad-knowledge → ma-knowledge-atlas
│   ├── bmod-ma-atlassian/                  — record folder, code ma-atlassian
│   │   ├── bmod.toml                       — skills (3); nine config questions (P5-11.9)
│   │   ├── SKILL.md  help/help.md
│   │   ├── retired.toml                    — empty
│   │   └── migration-1.toml                — 3.x project-layout.yaml + 3.x override markers → answers + bind; report
│   │
│   │   ── ma-ops members (each: SKILL.md, bmod.toml [skill] bmod = "bmod-ma-ops", source = …) ──
│   ├── ma-agent-sre/  ma-agent-cyber/  ma-agent-devops/  ma-agent-sqa/
│   ├── sre-check-deployment-status/  sre-check-secrets/  sre-check-system-status/  sre-day-2-ops/
│   ├── sre-deployment-strategies/  sre-fix-deployments/  sre-gitops-status/
│   ├── cyber-generate-certs/  cyber-immunity-estimation/  cyber-security-audit/  cyber-vault-secrets/
│   ├── cyber-verify-docker-users/  cyber-verify-image-signature/  cyber-vulnerability-scan/
│   ├── devops-configure-infrastructure/  devops-disconnected-deployment/  devops-docker-compose-setup/
│   ├── devops-manage-helm/  devops-sign-docker-image/
│   ├── sqa-audit/  sqa-ieee12207/  sqa-requirements-quality/
│   ├── mil498-ocd/  mil498-requirement-quality/  mil498-sdd/  mil498-sdp/  mil498-srs/  mil498-ssdd/
│   ├── mil498-sss/  mil498-std/                      — DID templates under each skill's assets/
│   ├── create-hardened-docker-skill/  docker-hardening-verification/  docker-image-signing/
│   ├── verify-hardened-docker-skill/  self-signed-cert/
│   ├── ma-ops-dev-epic/                    — tickets.py discovery; bmad-build / -auto / code-review / review / walkthrough
│   │   └── scripts/migrate_v6_backlog.py   — [skill] scripts; the ma-ops migration-1 script
│   │
│   │   ── ma-standards members ──
│   ├── cpp-best-practices/  cpp-concurrency-safety/  cpp-const-correctness/  cpp-memory-handling/
│   ├── cpp-modern-composition/  cpp-robust-interfaces/  csharp-best-practices/
│   ├── python-best-practices/  python-dependency-mgmt/  python-security-skill/
│   ├── js-ts-dependency-mgmt/  js-ts-security-skill/  vercel-react-best-practices/  cmake-best-practices/
│   ├── logging-best-practices/  opentelemetry-best-practices/  code-documentation/  code-review/
│   ├── test-generator/  test-accompanied-development/  git-workflow-skill/  commit-message/
│   ├── auto-bug-detection/  ai-audit-trail/  document-revision-history/  skill-creator/
│   ├── project-context-expansion/
│   ├── open-presentation/                  — assets/: the training deck
│   ├── ma-standards-apply/                 — ma-standards marker block in AGENTS.md, CLAUDE.md, .clinerules,
│   │                                         .roomodes, .github/copilot-instructions.md; `remove` sub-command
│   │
│   │   ── ma-knowledge member ──
│   ├── ma-knowledge-atlas/
│   │   └── assets/atlas.cjs                — Knowledge Atlas engine, run with node
│   │
│   │   ── ma-atlassian members ──
│   ├── ma-atlassian-bind/                  — bind / unbind / status
│   │   ├── bmod.toml                       — [skill] scripts = the four scripts below
│   │   ├── config/jira-onprem-ticketing.toml   — Sofia store starter (Jira Server/Data Center)
│   │   ├── references/bind-targets.toml    — the P5-11.4 target table
│   │   └── scripts/                        — publish engine, page tree, override generator, collision check, migrate_binding.js (JavaScript)
│   ├── ma-atlassian-confluence-plan/
│   └── ma-atlassian-confluence-record-root-page/
└── test/                                   — module assignment; no owned bmad-* name (FR287); validate_manifests.py; contract validator (FR303); per module: npx skills add <local> and
                                              <repo>#<tag> into a v7 project with method, setup.py --module-answers, setup.py --status, offline activation
```

**Installer package**

```
ma-agents/                                  — npm package, semver 4.x, engines.node >=22.20.0 (the Skills CLI floor)
├── package.json                            — bmadRef { core, skillsCli, tea, cis, extensions }
├── bin/cli.js                              — install, update, status, uninstall, bundle build; wizard and flags
├── lib/installer.js                        — install sequence (P5-11.10); writes .ma-agents/install.json
├── lib/runtime/uv.js                       — the only uv execution site (uv run --no-cache)
├── lib/agents.js                           — coding tool → Skills CLI --agent; ma-agents marker block
├── lib/uninstall.js                        — removal per .ma-agents/install.json; 3.x parts on an upgrade
├── lib/bundle.js                           — bundle build: snapshot, wheelhouse enumeration, manifest
├── bundle/                                 — built by `bundle build`, shipped in the tarball
│   ├── manifest.json                       — every item with SHA-256; bmadRef; extension tag; omissions
│   ├── bmad-method/                        — BMAD-METHOD skills/ at bmadRef.core (core-tools, method, toolsmith, founder)
│   ├── tea/  cis/                          — at bmadRef.tea / bmadRef.cis (absent when no tag carries a bmod record)
│   ├── ma-bmad-extensions/                 — skills/ at bmadRef.extensions, files unchanged (github: sources)
│   ├── skills-cli/                         — npm `skills` at bmadRef.skillsCli with its runtime dependencies
│   │                                         (npm install --omit=dev --ignore-scripts tree), copied by the installer
│   ├── runtime/linux-x64/  runtime/win-x64/ — uv binary + python-build-standalone 3.11
│   └── wheelhouse/linux-x64/  wheelhouse/win-x64/ — every PEP 723 dependency of the bundled scripts
│                                             (initial bmadRef.core: jinja2, markupsafe, pyyaml)
└── test/                                   — install sequence, bundle determinism, injection ownership, upgrade fixture (3.18.x)
```

**Boundaries**

| Component | Owns | Never touches |
|---|---|---|
| `ma-agents` installer | bundle verification; `.ma-agents/runtime/`, `.ma-agents/uv.toml`, `.ma-agents/skills-cli/`, `.ma-agents/install.json`; Skills CLI and `setup.py` invocation; the temporary answers file; the `ma-agents` marker block; the backup folder before an upgrade | skill content; `_bmad/custom/`; the `ma-standards` and `bmad:context` blocks; the initiative store; migrations |
| `bmod-ma-ops` | its agents and workflows; `migration-1.toml` and `migrate_v6_backlog.py` | sprint or tracking files outside its migration; story status (set through `bmad-agent-po` board requests and `bmad-build`'s plan file) |
| `bmod-ma-standards` | its skills; the `ma-standards` marker block (`ma-standards-apply`) | the `ma-agents` block; other modules' files |
| `bmod-ma-knowledge` | `ma-knowledge-atlas` and its output folder (`atlas_output`) | the initiative store (read only) |
| `bmod-ma-atlassian` | its bracketed keys in `_bmad/custom/<skill>.toml` and `ticketing-store-config.toml`; Confluence pages under the two root pages; `migration-1.toml` and `migrate_binding.js` | upstream skill files; user-authored keys; any line outside its markers |
| Upstream BMAD (`bmad`, Sofia, `bmad-build`) | `_bmad/config.toml`, setup, migrations (`bmad migrate`), the initiative store, plan files | — |

**Data flow**

| Flow | Path |
|---|---|
| Install | `ma-agents install` → verify `manifest.json` → copy runtime, write `.ma-agents/uv.toml` → copy Skills CLI → `node <skills-cli> add <bundle>/bmad-method --skill <each record and member>` → the same per module source → `setup.py --list-config-questions` → pending answers as `[modules."<code>"]` → `setup.py --module-answers` → `_bmad/config.toml`, `_bmad/custom/config.user.toml` → `install.json` → `ma-agents` block → `ma-agents status` |
| Bind | `ma-atlassian-bind bind` → `resolve_config.py` (`modules.ma-atlassian.*`) → bind-target table × installed skills → bracketed keys in `_bmad/custom/<skill>.toml` + `ticketing-store-config.toml` → report (bound, collision, not installed, missing slot, missing answer) |
| Publish | upstream skill finishes (`external_handoffs` / `on_complete`) or Sofia changes the board or store (`board_after` / `store_after`) → `node _bmad/ma-atlassian/scripts/<engine>` → Confluence page under the planning or tickets root page |
| Migrate | `ma-agents install` on a 3.x project → `.ma-agents-backup-<datetime>/` → uninstall 3.x parts (3.x `bmad-*` skill folders and `_bmad/ma-skills/` included) → install 4.x → prints "ask `bmad` to run `bmad migrate`" → `method` migration → `bmod-ma-ops/migration-1.toml` (`migrate_v6_backlog.py`) → `bmod-ma-atlassian/migration-1.toml` (`migrate_binding.js`) → reports under `{output_folder}/migration-v6-v7/` |

**Requirements to structure**

| Requirement | Component | Location |
|---|---|---|
| FR280, FR281 | installer | `package.json` `bmadRef`; CI qualification gate |
| FR282 | installer | `bundle/runtime/`, `bundle/wheelhouse/`, `lib/installer.js` |
| FR283, FR284 | installer | `lib/installer.js` |
| FR285, FR295 | extension repository | `skills/bmod-*/bmod.toml`, member `bmod.toml`, `test/` |
| FR286 | `bmod-ma-ops` | `roster.toml`, `help/help.md` (every record) |
| FR287 | every module | `retired.toml` |
| FR288 | every skill | `resolve_config.py` / `resolve_customization.py` calls |
| FR289 | `bmod-ma-atlassian` | `ma-atlassian-bind/config/jira-onprem-ticketing.toml`, `ticketing-store-config.toml` |
| FR303 | extension repository | `test/` contract validator over every owned `customize.toml` and bind output |
| FR304 | installer | `lib/runtime/uv.js`, `test/` execution guard |
| FR305 | `bmod-ma-knowledge` | `ma-knowledge-atlas/`, CI fixture initiative |
| FR290, FR291 | `bmod-ma-atlassian` | `ma-atlassian-bind/references/bind-targets.toml`, `scripts/` |
| FR292 | `bmod-ma-ops` | `ma-ops-dev-epic/` |
| FR293, FR300 | `bmod-ma-atlassian` | `bmod.toml` config questions, `ma-atlassian-confluence-*` |
| FR294 | `bmod-ma-ops`, `bmod-ma-atlassian` | `migration-1.toml`, `migrate_v6_backlog.py`, `migrate_binding.js` |
| FR296 | `bmod-ma-ops` | `migration-1.toml`; no sprint-file skill in the repository |
| FR297, FR298 | installer | `bin/cli.js` (`--source`, wizard, flags) |
| FR299 | installer | `lib/bundle.js`, `bundle/manifest.json` |
| FR301 | installer, `bmod-ma-standards` | `lib/agents.js`, `ma-standards-apply/` |
| FR302 | installer, every module | `bmadRef`, `required_skills`, `ma-agents status` |
| NFR84 | extension repository | `test/`, CI |
| NFR86 | extension repository | one `version` across `bmod-*/bmod.toml` |
| NFR87 | installer | `test/` upgrade fixture |

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
