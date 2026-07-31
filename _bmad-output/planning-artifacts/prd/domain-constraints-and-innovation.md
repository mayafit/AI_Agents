# Domain Constraints, Innovation Patterns & Developer-Tool Requirements

> **Shard** of the [PRD index](../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.

---

## Domain-Specific Requirements

### Compliance & Standards

- **MIL-STD-498** — Primary documentation standard for defense software deliverables. ma-agents must generate compliant DIDs (SSS, SSDD, OCD, SDP, SRS, SDD, STD, STR, IDD, IRS, HRS) that pass organizational review gates
- **Enterprise SDLC governance** — The methodology must align with organizational software development policies, including phase-gate reviews, traceability requirements, and configuration management
- **Audit trail** — AI agent activities should be trackable (ai-audit-trail skill) to demonstrate that methodology was followed during development

### Technical Constraints

- **Air-gapped / disconnected environments** — Skills and BMAD workflows must install and function fully offline. No runtime dependency on external registries or cloud services
- **On-prem AI agents** — Must support AI tools deployed internally (Cline, Cursor running against local models) alongside public cloud agents (Claude Code, Copilot, Gemini)
- **No data exfiltration** — Skills must not transmit project data externally. Skill content is static instructions, not data-collection mechanisms
- **Cross-platform** — Must work on Windows, macOS, and Linux (already supported via Node.js + platform-aware paths)

### Integration Requirements

- **Git-based workflows** — All development artifacts (skills, BMAD workflows, project docs, `_bmad-output`) must be version-controlled and work within existing git branching strategies
- **`_bmad-output` as project knowledge** — The `_bmad-output` folder (planning artifacts, implementation artifacts) is version-controlled project knowledge, never gitignored. This folder holds system knowledge critical to project continuity
- **CI/CD pipeline compatibility** — `npx ma-agents install` must be scriptable for automated setup in CI/CD pipelines without interactive prompts (`--yes`, `--force` flags)
- **BMAD-METHOD ecosystem** — First-class integration with BMAD's install, update, recompile, and customize pipeline. Changes to BMAD must not break ma-agents and vice versa
- **BMAD Builder extension architecture** — All BMAD-facing enhancements (skill enforcement, bug workflows, sprint workflows, custom agents) must use official BMAD Builder extension points. With 6.2.0: module identity via `module.yaml` (`code`, `description`, `module_version`), capability registration via `module-help.csv`, config management via setup skill writing to `config.yaml`/`config.user.yaml`. Agents built via BMAD Agent Builder (produces skill folders). Workflows built via BMAD Workflow Builder (produces SKILL.md packages). Zero bmad-method core modifications

### Risk Mitigations

- **Methodology drift** — Risk: teams customize skills locally and diverge from the enterprise standard. Mitigation: `always_load: true` for mandatory skills, manifest-based version tracking, centralized skill distribution
- **Agent compatibility breakage** — Risk: AI agent vendors change their configuration format. Mitigation: agent-specific template system with resource mapping allows format changes without rewriting skills
- **BMAD version conflicts** — Risk: BMAD updates overwrite ma-agents customizations. Mitigation: BMAD 6.2.0 module with independent `code` identity in `module.yaml` survives updates; anti-zombie config pattern ensures setup re-runs are safe; module setup skill cleans stale entries before writing new values
- **BMAD 6.0.4→6.2.0 migration** — Risk: legacy agent patterns (`.customize.yaml`, XML definitions, YAML workflows) break when BMAD removes the legacy workflow engine. Mitigation: installer performs atomic in-place migration preserving customizations; NFR29 guarantees all-or-nothing migration; rollback on failure. Fresh installations deploy directly in 6.2.0 format
- **Skill enforcement failure** — Risk: agents install skills but ignore them during operation. Mitigation: multi-layered enforcement — top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks (Claude Code), and context persistence research

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Methodology-as-Code paradigm** — Engineering standards and SDLC practices are codified as portable skill packages rather than wiki pages, training decks, or tribal knowledge. Skills are versioned, installable, and enforceable — treating methodology like software
- **Install AND Enforce paradigm** — The first cross-agent skill system that doesn't just install skills but ensures agents actually use them. Multi-layered enforcement: top-priority instruction injection, BMAD `critical_actions` on agent activation, per-agent hooks, and context persistence. Moves from advisory ("please read the manifest") to enforced ("skills loaded before any workflow executes")
- **Agent-agnostic governance layer** — No existing tool provides a standards enforcement layer across multiple AI coding agents. ma-agents creates a new product category: the methodology middleware between organizations and their AI tools
- **BMAD-native extension architecture** — Uses official BMAD Builder extension points to inject enforcement, workflows, and agent behaviors without modifying the BMAD core. With 6.2.0, the extension module adopts native module identity (`module.yaml` with `code` field), setup skill for config management, and agents/workflows as standard skill folders. Demonstrates that complex cross-cutting concerns (skill enforcement, bug management, sprint workflows, specialized agents) can be delivered as extension modules that survive upstream updates via the anti-zombie config pattern
- **Bug-as-first-class-entity in AI development** — Agents autonomously detect defects in delivered code and propose structured bug reports to users. This closes the loop between code review and issue tracking within the AI agent workflow
- **Structured skill format as implicit DSL** — The skill.json + SKILL.md + agent template system with frontmatter injection and resource mapping constitutes a domain-specific authoring format for packaging engineering practices into agent-consumable instructions
- **Non-hierarchical SDLC knowledge graph** — Unlike traceability matrices that assume a strict parent-child hierarchy, this graph supports any-to-any relationships. A story's acceptance criterion can simultaneously reference the epic that scoped it, the architecture decision that constrained it, and the UX design that specified it — without any of these being "the" canonical source. A central files table maps short file IDs to arbitrary file pointers (relative paths, absolute paths, Confluence URLs, any document reference), so the graph is not bound to files in the repository. Relationships are first-class typed directed edges with full provenance (creator, AI agent, date). Built automatically by skills as they generate artifacts — no human cross-referencing required. The result is a living, queryable, visual map where influence flows in any direction: jumping from a node in the graph to the exact heading in any referenced document

### Validation Approach

- Skills produce functionally equivalent agent behavior across all 12 targets — same methodology input, same engineering output regardless of agent
- Skill compliance rate measurably improves from ~0% to >90% for `always_load: true` skills
- Organizations can add/remove AI agents without rewriting methodology — portability is provable by installing on a new agent type (e.g., OpenCode)
- Skill authoring is accessible to engineering leads, not just toolsmiths — the format is markdown-based, not code-heavy
- BMAD extension module survives upstream updates — testable by running `npx bmad-method install --action update`

### Risk Mitigation

- **Paradigm adoption risk** — New categories require education. Mitigation: the tool works immediately via `npx` without requiring buy-in to the full paradigm; teams can start with one skill and expand
- **Format lock-in risk** — If the skill format becomes a bottleneck. Mitigation: format is deliberately simple (JSON metadata + markdown content), making migration or evolution straightforward
- **Competitive moat risk** — AI agent vendors may build their own methodology features. Mitigation: agent-agnostic positioning means ma-agents benefits from more agents, not fewer; vendor features would need to be cross-agent to compete

## Developer Tool Specific Requirements

### Project-Type Overview

ma-agents is a Node.js CLI tool that distributes language-aware engineering methodology packages across AI coding agents. The tool runtime is JavaScript/Node.js; the skill content spans language-neutral practices and language-specific standards for C++, C#, Node.js, JavaScript, and Python, with more languages expected as the organization's needs grow.

### Language Matrix

| Layer | Languages / Formats |
|-------|-------------------|
| Tool runtime | Node.js (JavaScript) |
| Skill content — language-neutral | Architecture, security, documentation, workflow, testing methodology |
| Skill content — language-specific | C++, C#, Node.js, JavaScript, Python (current and planned) |
| Skill authoring format | JSON (metadata) + Markdown (content) + YAML (manifests) |
| Agent configuration targets | Agent-native formats (markdown instructions, YAML config, JSON rules) |

### Installation Methods

| Method | Status | Notes |
|--------|--------|-------|
| `npx ma-agents` | Current — primary | Zero-install via npm registry, interactive wizard + direct CLI modes. Bundles all BMAD components |
| `npx ma-agents install --yes --force` | Current — CI/CD | Non-interactive scriptable mode for pipeline automation |

### IDE / Agent Integration Model

ma-agents does not integrate as an IDE extension. Instead, it injects skill content into each agent's native configuration directory:

| Agent | Integration Point |
|-------|------------------|
| Claude Code | `.claude/` directory, `CLAUDE.md` instruction injection (top-priority placement) |
| Cursor | `.cursor/rules/` directory |
| Cline | `.cline/` directory with resource mapping (references→docs, assets→templates); instruction injection into `.cline/clinerules.md` (single source of truth); `.clinerules/` directory (Cline reads all `.md`/`.txt` files inside it); `.clinerules/workflows/` subdirectory for auto-generated skill invocation wrappers |
| Copilot | `.github/copilot-instructions.md` |
| Gemini | `.gemini/` directory |
| Kilocode | `.kilocode/rules/` directory |
| OpenCode | `.opencode/skills/` directory, `opencode.json` instructions array (JSON-based injection, configs merge not replace) |
| Antigravity | `_bmad/skills/` directory |
| Visual Studio | **Gap — solution needed.** No current integration path for Visual Studio's AI assistant (GitHub Copilot in VS). Requires investigation into VS-specific agent configuration |

### Documentation & Methodology Resources

| Resource | Status |
|----------|--------|
| README, QUICK_START, DEVELOPMENT, CONTRIBUTING | Current — developer-facing |
| SKILLS_STRUCTURE | Current — skill authoring reference |
| Methodology presentation | In development — will be bundled with installation to onboard teams on the enterprise methodology |
| PRD (this document) | In progress |

### Implementation Considerations

- **Cline workflow generation** — BMAD installs skills to `.cline/skills/` using Claude Code-style YAML frontmatter that Cline does not natively interpret. Per Cline's documentation, `.clinerules/` is a **directory** that Cline reads recursively (all `.md` and `.txt` files inside it); `.clinerules/workflows/` is a subdirectory within it for slash-command workflows, resolved as `/workflow-name`. Instruction injection into Cline uses `.cline/clinerules.md` as the **single source of truth** — the installer writes the ma-agents instruction block exclusively to this file; no instruction content is written to `.clinerules` or its subdirectories. After every BMAD install, update, or migration where Cline is a selected tool, the installer ensures `.clinerules` exists as a directory (removing any legacy flat-file at that path first if present), then scans `.cline/skills/` and generates a `.clinerules/workflows/<skill-name>.md` wrapper for each skill subdirectory. Wrappers are two-variant: skills with a `workflow.md` receive a delegation wrapper; skills with only SKILL.md receive a read wrapper with a frontmatter-ignore instruction. Without these wrappers, BMAD skills are present on disk but unreachable via Cline's slash-command invocation system
- **OpenCode integration** uses JSON-based instruction injection (`opencode.json` instructions array) rather than markdown comment blocks. The installer must handle JSON config merging (OpenCode configs merge, not replace) and skill path resolution for `.opencode/skills/`
- **Visual Studio integration** is an identified gap. The team needs to investigate how Visual Studio exposes AI agent configuration (Copilot Chat extensions, `.editorconfig`-adjacent patterns, or VS-specific instruction files) and determine the appropriate injection mechanism
- **Bundled BMAD installation** bundles bmad-method and external modules inside the npm package, pre-populating bmad-method's cache. Node.js and npm are always available in target environments
- **Language-specific skill growth** — the skill format must accommodate language-specific content (coding standards, patterns, linting rules) without requiring changes to the core installer when new languages are added
