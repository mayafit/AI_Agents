# Story 15.3: Convert 4 Custom Agents to Skill Folders

Status: review

## Story

As a **Chief Architect**,
I want the 4 custom agents (SRE, DevOps, Cyber, MIL-498) converted from `.customize.yaml` files to BMAD 6.2.0 agent skill folders,
So that they are delivered as native module agents following the verified CIS pattern.

## Acceptance Criteria

1. Each custom agent has a skill folder at `lib/bmad-extension/skills/bmad-ma-agent-{role}/` containing `SKILL.md` and `bmad-skill-manifest.yaml`
2. Each `SKILL.md` contains the complete agent definition: persona, menu items with trigger phrases, activation sequence, and critical_actions
3. Each `bmad-skill-manifest.yaml` has `type: agent`, `name`, `displayName`, `role`, `identity`, `communicationStyle`, `principles`, `module: ma-skills`
4. SRE agent (Alex) SKILL.md contains all 9 menu items referencing SRE workflow skills by new skill names (e.g., `sre-health-check`)
5. Same complete conversion for DevOps (Amit), Cyber (Yael), and MIL-498 (Joseph)
6. Deployed agents behave identically to pre-conversion: same persona, same menu, same workflows (NFR30)

## Tasks / Subtasks

- [x] Task 1: Consolidate SRE agent source material (AC: #1, #2, #4)
  - [x] 1.1 Read `lib/bmad-customizations/bmm-sre.customize.yaml` (base config)
  - [x] 1.2 Read `lib/bmad-extension/agents/bmm-sre.customize.yaml` (extended config with critical_actions)
  - [x] 1.3 Read `lib/bmad-customizations/sre.md` (full agent persona/menu XML definition)
  - [x] 1.4 Merge all three sources into unified agent definition
  - [x] 1.5 Create `lib/bmad-extension/skills/bmad-ma-agent-sre/SKILL.md` with complete definition
  - [x] 1.6 Create `lib/bmad-extension/skills/bmad-ma-agent-sre/bmad-skill-manifest.yaml`
  - [x] 1.7 Update menu item references from old workflow paths to new skill names (e.g., `sre-health-check`, `sre-fix-deployments`, etc.)

- [x] Task 2: Consolidate DevOps agent (AC: #1, #2, #5)
  - [x] 2.1 Read `lib/bmad-customizations/bmm-devops.customize.yaml`
  - [x] 2.2 Read `lib/bmad-extension/agents/bmm-devops.customize.yaml`
  - [x] 2.3 Read `lib/bmad-customizations/devops.md`
  - [x] 2.4 Create `lib/bmad-extension/skills/bmad-ma-agent-devops/SKILL.md`
  - [x] 2.5 Create `lib/bmad-extension/skills/bmad-ma-agent-devops/bmad-skill-manifest.yaml`

- [x] Task 3: Consolidate Cyber agent (AC: #1, #2, #5)
  - [x] 3.1 Read `lib/bmad-customizations/bmm-cyber.customize.yaml`
  - [x] 3.2 Read `lib/bmad-extension/agents/bmm-cyber.customize.yaml`
  - [x] 3.3 Read `lib/bmad-customizations/cyber.md`
  - [x] 3.4 Create `lib/bmad-extension/skills/bmad-ma-agent-cyber/SKILL.md`
  - [x] 3.5 Create `lib/bmad-extension/skills/bmad-ma-agent-cyber/bmad-skill-manifest.yaml`

- [x] Task 4: Consolidate MIL-498 agent (AC: #1, #2, #5)
  - [x] 4.1 Read `lib/bmad-customizations/bmm-mil498.customize.yaml`
  - [x] 4.2 Read `lib/bmad-extension/agents/bmm-mil498.customize.yaml`
  - [x] 4.3 Read `lib/bmad-customizations/mil498.md`
  - [x] 4.4 Create `lib/bmad-extension/skills/bmad-ma-agent-mil498/SKILL.md`
  - [x] 4.5 Create `lib/bmad-extension/skills/bmad-ma-agent-mil498/bmad-skill-manifest.yaml`

- [x] Task 5: Verify behavioral equivalence (AC: #6)
  - [x] 5.1 Compare each SKILL.md against its source files — ensure NO persona, menu item, or critical_action is lost
  - [x] 5.2 Verify all workflow references in menus use the new skill names

## Dev Notes

### Three-Source Consolidation Pattern

Each custom agent has THREE source files that must be merged into ONE SKILL.md:

| Source | Location | Contains |
|--------|----------|----------|
| Base customize | `lib/bmad-customizations/bmm-{agent}.customize.yaml` | Basic persona fields, menu items |
| Extension customize | `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` | critical_actions, additional overrides |
| Agent definition | `lib/bmad-customizations/{agent}.md` | Full XML agent definition (persona, detailed menu, activation) |

**Merge priority:** The `.md` file is the authoritative source for persona and menu. The extension `.customize.yaml` is authoritative for `critical_actions`. The base `.customize.yaml` provides fallback fields.

### SKILL.md Format (from CIS module pattern)

```markdown
# Agent: {DisplayName} — {Title}

## Persona
- **Role:** {role}
- **Identity:** {identity}
- **Communication Style:** {style}
- **Principles:** {principles}

## Activation Sequence
1. Greet the user as {DisplayName}
2. Load skills from MANIFEST.yaml (always_load: true)
3. Present menu

## Menu
| # | Action | Trigger | Skill |
|---|--------|---------|-------|
| 1 | Health Check | "check health", "system status" | sre-health-check |
| 2 | Fix Deployments | "fix deploy", "deployment issue" | sre-fix-deployments |
...

## Critical Actions
- Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml
- For each skill marked always_load: true, read the skill file completely
- If _bmad-output/project-context.md exists, read it completely
```

### bmad-skill-manifest.yaml Pattern (Agent Type)

```yaml
type: agent
name: bmad-ma-agent-sre
displayName: Alex
title: Site Reliability Engineer
icon: "wrench-emoji"
capabilities: "system availability, Kubernetes ops, SLO/SLA management"
role: "Site Reliability Engineer"
identity: "Experienced SRE focused on system reliability"
communicationStyle: "Direct, data-driven, alert to risks"
principles: "Reliability first. Automate everything. Measure what matters."
module: ma-skills
```

### Menu Item -> Skill Name Mapping

Map old workflow references to new skill names:
- SRE agent menus -> `sre-*` skill names
- DevOps agent menus -> `devops-*` skill names
- Cyber agent menus -> `cyber-*` skill names
- MIL-498 agent menus -> `mil498-*` skill names

### Anti-Patterns to Avoid

- DO NOT invent new persona details — copy exactly from source files
- DO NOT change menu item order or trigger phrases — functional equivalence (NFR30)
- DO NOT add new critical_actions beyond what exists — preserve behavior exactly
- DO NOT reference old file paths in menu items — update ALL to new skill names

### Files to Touch

| File | Change |
|------|--------|
| `lib/bmad-extension/skills/bmad-ma-agent-sre/SKILL.md` | NEW — consolidated SRE agent |
| `lib/bmad-extension/skills/bmad-ma-agent-sre/bmad-skill-manifest.yaml` | NEW |
| `lib/bmad-extension/skills/bmad-ma-agent-devops/SKILL.md` | NEW — consolidated DevOps agent |
| `lib/bmad-extension/skills/bmad-ma-agent-devops/bmad-skill-manifest.yaml` | NEW |
| `lib/bmad-extension/skills/bmad-ma-agent-cyber/SKILL.md` | NEW — consolidated Cyber agent |
| `lib/bmad-extension/skills/bmad-ma-agent-cyber/bmad-skill-manifest.yaml` | NEW |
| `lib/bmad-extension/skills/bmad-ma-agent-mil498/SKILL.md` | NEW — consolidated MIL-498 agent |
| `lib/bmad-extension/skills/bmad-ma-agent-mil498/bmad-skill-manifest.yaml` | NEW |

### Source Files to Read (DO NOT MODIFY — these are input only)

- `lib/bmad-customizations/bmm-sre.customize.yaml`, `bmm-devops.customize.yaml`, `bmm-cyber.customize.yaml`, `bmm-mil498.customize.yaml`
- `lib/bmad-customizations/sre.md`, `devops.md`, `cyber.md`, `mil498.md`
- `lib/bmad-extension/agents/bmm-sre.customize.yaml`, `bmm-devops.customize.yaml`, `bmm-cyber.customize.yaml`, `bmm-mil498.customize.yaml`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, agent SKILL.md content, bmad-skill-manifest.yaml patterns]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.3]
- [Source: lib/bmad-customizations/ — 4 base configs + 4 persona .md files]
- [Source: lib/bmad-extension/agents/ — 4 extension customize files]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
N/A

### Completion Notes List
- Consolidated all 4 agents (SRE/Alex, DevOps/Amit, Cyber/Yael, MIL-498/Joseph) from 3 source files each into BMAD 6.2.0 skill folders
- Each agent has SKILL.md (persona, activation sequence, menu, critical actions) and bmad-skill-manifest.yaml (type: agent, all required fields, module: ma-skills)
- All menu items reference new skill names (sre-*, devops-*, cyber-*, mil498-*) — no old workflow paths remain
- Persona text copied verbatim from authoritative .md source files; critical_actions copied from extension .customize.yaml files
- Test file (test/convert-agents-to-skills.test.js) validates all 136 assertions across file existence, content sections, manifest fields, skill name references, and no-old-path regression
- Test added to package.json test script

### File List
- `lib/bmad-extension/skills/bmad-ma-agent-sre/SKILL.md` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-sre/bmad-skill-manifest.yaml` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-devops/SKILL.md` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-devops/bmad-skill-manifest.yaml` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-cyber/SKILL.md` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-cyber/bmad-skill-manifest.yaml` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-mil498/SKILL.md` — NEW
- `lib/bmad-extension/skills/bmad-ma-agent-mil498/bmad-skill-manifest.yaml` — NEW
- `test/convert-agents-to-skills.test.js` — NEW
- `package.json` — MODIFIED (added test to test script)
- `_bmad-output/implementation-artifacts/15-3-convert-custom-agents-to-skill-folders.md` — MODIFIED (status: review, all tasks checked)
