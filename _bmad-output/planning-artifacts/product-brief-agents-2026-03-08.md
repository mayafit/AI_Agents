---
stepsCompleted: [1, 2, 3, 4, 5, 6]
status: complete
inputDocuments:
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture.md
  - docs/development-guide.md
  - docs/source-tree-analysis.md
  - README.md
date: 2026-03-08
author: Alon
---

# Product Brief: ma-agents

## Executive Summary

**ma-agents** is a universal NPX tool that installs AI coding agent skills across 11 supported agents (6 IDE + 5 BMAD). While the installation pipeline is mature and reliable, a critical gap has been identified: **installed skills are not reliably enforced during agent operation**. Agents install skills but then ignore them — the planning instruction loses priority in context, BMAD workflows operate in isolation from the skill system, skills don't survive context compression, and no enforcement mechanism exists.

This product brief defines a set of architectural enhancements to ma-agents that solve skill enforcement from the ground up, add OpenCode as the 12th supported agent, and establish `_bmad-output` as tracked project knowledge. The approach leverages BMAD's official extension module architecture (`critical_actions`, `extends-module`, `module-help.csv`) to inject skill awareness without modifying BMAD core — ensuring compatibility with future BMAD updates.

---

## Core Vision

### Problem Statement

AI coding agents that have skills installed via ma-agents routinely fail to use those skills. A real-world diagnostic session revealed that Claude Code — despite having `always_load: true` skills installed and a planning instruction in CLAUDE.md — did not read the MANIFEST.yaml, did not load mandatory skills, and did not follow skill directives (e.g., creating a feature branch before writing files). This is not an edge case; it is the default behavior.

### Problem Impact

- **Wasted investment**: Users install skills expecting behavior change, but get none
- **Silent failure**: There's no error or warning when skills are ignored — users only discover it through unexpected outcomes
- **Trust erosion**: The value proposition of "write once, install everywhere" breaks down if "install" doesn't mean "enforce"
- **BMAD workflow blindness**: When BMAD workflows take over agent attention, the entire skill system disappears — development skills like git-workflow, code-review, and audit-trail are exactly the skills that should be active during BMAD-driven development
- **BMAD agent gap**: The 4 BMAD agents shipped by ma-agents (SRE/Alex, DevOps/Amit, Cyber/Yael, MIL-498/Joseph) have zero skill awareness — no `critical_actions` defined, so skills installed to `_bmad/skills/` are never loaded

### Why Existing Solutions Fall Short

The current architecture has four structural root causes:

1. **Placement**: The `<!-- MA-AGENTS-START -->` planning instruction is injected at the bottom of instruction files, where it receives lowest priority during LLM context processing
2. **Isolation**: BMAD workflows and the skill system are parallel systems with no cross-referencing — when a BMAD workflow activates, skills vanish from the agent's attention
3. **Volatility**: Skills don't survive context compression or session restoration — the skill system has no mechanism to persist across LLM context boundaries
4. **Advisory-only**: The system is purely advisory with no enforcement hooks, validation steps, or feedback when skills are not loaded

### Proposed Solution

A three-pillar architectural enhancement:

**Pillar 1: Skill Enforcement Architecture**
- Move planning instruction injection to the TOP of agent instruction files (highest priority position)
- Ship a BMAD extension module (`extends-module: bmm`) that injects skill loading into agent `critical_actions` — executed before any menu or workflow
- Update the 4 ma-agents BMAD agent customizations (SRE, DevOps, Cyber, MIL-498) to include skill-loading `critical_actions` in their `.customize.yaml` files
- Research and implement per-agent enforcement mechanisms (Claude Code hooks, other agent equivalents)
- Investigate BMAD sidecar memory folders for skill state persistence across sessions
- Research context persistence strategies to ensure skills survive LLM context compression

**Pillar 2: OpenCode Agent Support**
- Add OpenCode as the 12th supported agent (7th IDE agent)
- Skills path: `.opencode/skills/`
- Instruction injection: JSON-based (`opencode.json` instructions array) instead of markdown comment blocks
- Template: `generic` (assess if agent-specific template is needed)
- Config merging: OpenCode configs merge (not replace), so injection is safe

**Pillar 3: `_bmad-output` as Project Knowledge**
- Establish clear policy: `_bmad-output` is version-controlled project knowledge, never gitignored
- This folder holds planning artifacts, implementation artifacts, and system knowledge critical to project continuity
- Document this policy in README and installation guidance

### Key Differentiators

- **"Install AND Enforce"**: The only cross-agent skill system that doesn't just install skills but ensures agents actually use them
- **BMAD-native integration**: Uses official BMAD extension points (`critical_actions`, `extends-module`, `module-help.csv`) — no core modifications, survives updates
- **12-agent universal coverage**: Widest cross-agent skill system (7 IDE + 5 BMAD)
- **Root-cause fix**: Addresses the 4 structural causes identified through real-world diagnosis, not surface symptoms

---

## Target Users

### Primary Users

**The Development Team Member** — Any person participating in the software development lifecycle who uses AI coding agents as part of their workflow. This includes developers, architects, QA engineers, SRE, DevOps, cyber analysts, and documentation specialists. They don't choose or install ma-agents — they simply benefit from skills being enforced consistently in whatever agent they use (IDE or BMAD). All team members receive the same skills — enforcement is uniform across roles.

*Persona: "Dana, Full-Stack Developer"*
- Uses Claude Code and sometimes Cursor for daily development
- Works within a BMAD-driven project where workflows guide her through sprints
- Expects that when she starts coding, the agent follows the team's git workflow, runs code review, and generates proper commit messages — without her having to remind it
- Currently frustrated: she installed skills weeks ago but Claude ignores them, creates commits directly on main, and skips the audit trail

*Persona: "Amit, DevOps Engineer"*
- Uses the BMAD DevOps agent for infrastructure workflows and Claude Code for scripting
- Needs docker-hardening and git-workflow skills enforced during both BMAD workflow sessions and direct coding
- Currently: skills sit in `_bmad/skills/` unused because the DevOps agent has no `critical_actions`

### Secondary Users

**The Product Manager (Adoption Decision Maker)** — The PM evaluates and decides whether the project adopts ma-agents as part of the development methodology. They run `npx ma-agents` to set up the project, select which skills to install, and choose which agents to support. After setup, they're not a daily user — the value flows through the team.

*Persona: "Alon, Technical PM"*
- Evaluates development tools and methodologies for the team
- Wants confidence that when he installs skills, every team member's agent will actually follow them
- Sees ma-agents as organizational infrastructure, not individual developer tooling
- Needs the installation to be project-level (committed to repo) so the whole team gets consistent behavior

### User Journey

1. **Decision**: PM evaluates ma-agents, decides it fits the team's methodology
2. **Setup**: PM runs `npx ma-agents`, selects skills and agents, installs at project level
3. **Commit**: Skills, manifests, and instruction files are committed to the repo
4. **Daily use**: Every team member's agent (IDE or BMAD) loads the manifest and enforces skills automatically
5. **Success moment**: Developer realizes the agent is following git-workflow, running code-review, and tracking audit trails — without being told
6. **Long-term**: Skills become invisible infrastructure — the team trusts that agents behave consistently

---

## Success Metrics

### User Success Metrics

- **Skill compliance rate**: When a skill is installed with `always_load: true`, >90% of agent sessions must load and follow it (current baseline: ~0%)
- **Zero-reminder workflow**: Users should never need to manually instruct the agent to read the manifest or follow installed skills
- **Cross-agent consistency**: The same skill produces identical behavioral enforcement across Claude Code, Cursor, Cline, OpenCode, and all BMAD agents

### Business Objectives

- **All enhancements in a single release**: Skill enforcement, OpenCode support, `_bmad-output` policy, bug management, and sprint management ship together
- **Agent coverage**: 12 agents supported (up from 11), with enforcement working across all
- **BMAD integration completeness**: All 4 BMAD agents have `critical_actions` for skill loading
- **BMAD update resilience**: Extension module survives BMAD core updates without breaking

### Key Performance Indicators

- **Adoption**: NPM download growth, GitHub stars, number of projects using ma-agents
- **Skill library growth**: Community contributions of new skills
- **Enforcement validation**: Automated or manual verification that skills are being followed post-install

---

## Release Scope

### Core Features

**F1: Skill Enforcement Architecture**
- Move `<!-- MA-AGENTS-START -->` instruction injection to the TOP of agent instruction files (highest priority position)
- Ship a BMAD extension module (`extends-module: bmm`) deployed by the ma-agents installer that injects skill-loading into agent `critical_actions` — executed before any menu or workflow
- Update all 4 BMAD agent `.customize.yaml` files (SRE, DevOps, Cyber, MIL-498) with skill-loading `critical_actions`
- Research and implement per-agent enforcement mechanisms (Claude Code hooks, other agent equivalents)
- Research and implement context persistence strategies (BMAD sidecar memory via `hasSidecar`/`sidecar-folder`, skill state restoration)

**F2: OpenCode Agent Support**
- Add OpenCode as the 12th supported agent (7th IDE agent) in `lib/agents.js`
- Skills path: `.opencode/skills/`
- Instruction injection: JSON-based (`opencode.json` instructions array)
- Template: `generic` (assess if agent-specific template is needed)

**F3: `_bmad-output` as Project Knowledge**
- Establish and document policy: `_bmad-output` is version-controlled, never gitignored
- Update installer to not add `_bmad-output` to `.gitignore`
- Document in README and installation guidance

**F4: Bug Management System**
- Define bug entity structure: problem description, reproduction steps, bug type, version found, environment constraints, severity, status
- New BMAD extension workflow (created via `bmad-bmb-create-workflow`, deployed as extension with `extends-module: bmm`): generate a bug story from a bug report
- New ma-agents skill: `auto-bug-detection` — instructs coding agents that when they find a problem in already-delivered code (story done, code merged, released version), they propose creating a bug issue to the user for confirmation
- During BMAD code-review workflows, agents suggest generating bug issues when relevant problems are found
- Bugs exist in the backlog as standalone items — never part of an epic

**F5: Realistic Sprint Management**
- All sprint workflows created via `bmad-bmb-create-workflow` and deployed as BMAD extension via ma-agents installer (no bmad-method changes)
- Backlog: flat list containing both stories and bugs, not grouped by epic
- Sprint capacity: defined by number of stories/bugs, configured by Scrum Master during sprint planning
- Prioritization: multiple criteria beyond epic precedence
- Sprint composition: dev stories + bugs; not every story must belong to an epic
- New BMAD extension workflows:
  - Add a sprint (define capacity, iteration identifier)
  - Add stories/bugs to a sprint (from backlog)
  - Change/modify a sprint (reorder, swap items, adjust capacity)
- Updated sprint status: shows real sprint definitions with assigned items, not just epic lists

### Architectural Constraint

**All features are implemented exclusively through:**
- **ma-agents installer code** (`lib/`, `bin/`, `skills/`)
- **BMAD extension module** shipped by ma-agents (`module.yaml` with `extends-module: bmm`, `module-help.csv` targeting BMM phases)
- **BMAD customization files** deployed by the installer (`.customize.yaml` with `critical_actions`, custom agent definitions via `bmad-bmb-create-agent`)
- **BMAD extension workflows** created using `bmad-bmb-create-workflow` and registered in `module-help.csv`

**No modifications to the bmad-method package.** All BMAD-facing changes use official BMAD Builder extension and customization APIs to ensure forward compatibility with BMAD updates. Extensions survive `npx bmad-method install --action update`.

### Out of Scope

- Changes to the bmad-method core package
- Paid/commercial features or licensing changes
- Per-role skill filtering (all team members get the same skills)
- Skill governance workflows (e.g., security team mandating specific skills)

### Release Success Criteria

- All 5 features ship in a single release
- Skill compliance rate measurably improves from ~0% baseline
- OpenCode agent installs and enforces skills identically to existing agents
- Bug and sprint workflows function as BMAD extensions without requiring bmad-method updates
- Extension module survives a `npx bmad-method install --action update` without breaking

### Future Vision

- Per-role skill assignment (different skills for different team roles)
- Skill governance (security team can mandate skills across all projects)
- Skill marketplace / community registry
- Analytics dashboard for skill compliance across projects
- Additional agent support as new AI coding assistants emerge
