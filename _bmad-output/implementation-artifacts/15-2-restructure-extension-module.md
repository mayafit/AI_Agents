# Story 15.2: Restructure Extension Module for 6.2.0 Conventions

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want the extension module restructured to follow the BMAD 6.2.0 module pattern (verified from CIS module source),
So that `--custom-content` deployment works correctly and the module integrates natively with BMAD's module system.

## Acceptance Criteria

1. `lib/bmad-extension/module.yaml` contains `code: ma-skills`, `name`, `description`, and `extends-module: bmm`
2. `--custom-content lib/bmad-extension/` passes bmad-method 6.2.1's validation (requires `module.yaml` with `code` field)
3. `lib/bmad-extension/skills/` directory is created as the root for all skill folders
4. `lib/bmad-extension/module-help.csv` is updated to register all 42 skills (4 agents + 38 workflows)
5. Old `lib/bmad-extension/agents/` and `lib/bmad-extension/workflows/` directories are removed
6. Content from old directories is migrated into `skills/` in subsequent stories (15.3-15.5) — this story creates the scaffolding only

## Tasks / Subtasks

- [ ] Task 1: Update module.yaml (AC: #1, #2)
  - [ ] 1.1 Update `lib/bmad-extension/module.yaml` to add `code: ma-skills` field
  - [ ] 1.2 Update `name` to `"MA-Agents Skills & Agents"`
  - [ ] 1.3 Update `description` to `"Enterprise methodology enforcement, specialized agents, and operational workflows"`
  - [ ] 1.4 Keep `extends-module: bmm`
  - [ ] 1.5 Add `default_selected: false`
  - [ ] 1.6 Verify `--custom-content lib/bmad-extension/` passes 6.2.1 validation

- [ ] Task 2: Create skills directory structure (AC: #3)
  - [ ] 2.1 Create `lib/bmad-extension/skills/` directory
  - [ ] 2.2 Create placeholder directories for all 42 skill folders per architecture P2-9:
    - Agent skills: `bmad-ma-agent-sre/`, `bmad-ma-agent-devops/`, `bmad-ma-agent-cyber/`, `bmad-ma-agent-mil498/`
    - MIL-498 skills: `mil498-sss/`, `mil498-ssdd/`, `mil498-ocd/`, `mil498-sdp/`, `mil498-srs/`, `mil498-sdd/`, `mil498-std/`, `mil498-str/`, `mil498-idd/`, `mil498-irs/`, `mil498-hrs/`
    - SRE skills: `sre-health-check/`, `sre-fix-deployments/`, `sre-check-deployment-status/`, `sre-check-secrets/`, `sre-check-system-status/`, `sre-day-2-ops/`, `sre-deployment-strategies/`, `sre-gitops-status/`
    - DevOps skills: `devops-configure-infrastructure/`, `devops-disconnected-deployment/`, `devops-docker-compose-setup/`, `devops-manage-helm/`, `devops-sign-docker-image/`
    - Cyber skills: `cyber-generate-certs/`, `cyber-immunity-estimation/`, `cyber-security-audit/`, `cyber-vault-secrets/`, `cyber-verify-docker-users/`, `cyber-verify-image-signature/`, `cyber-vulnerability-scan/`
    - Extension workflows: `create-bug-story/`, `add-sprint/`, `modify-sprint/`, `add-to-sprint/`, `project-context-expansion/`, `sprint-status-view/`

- [ ] Task 3: Update module-help.csv (AC: #4)
  - [ ] 3.1 Read existing `lib/bmad-extension/module-help.csv` to understand current format
  - [ ] 3.2 Rewrite to list all 42 skills with type (agent/skill) and trigger phrases
  - [ ] 3.3 Ensure CSV format matches what bmad-method expects for module capability registration

- [ ] Task 4: Remove old directories (AC: #5)
  - [ ] 4.1 Move content from `lib/bmad-extension/agents/` to a temporary staging area (DO NOT DELETE — needed as source for Story 15.3 and 15.6)
  - [ ] 4.2 Move content from `lib/bmad-extension/workflows/` to a temporary staging area (needed as source for Story 15.5)
  - [ ] 4.3 IMPORTANT: Only remove old directories AFTER content is preserved for conversion stories

## Dev Notes

### Critical: Do NOT Delete Source Material

Stories 15.3-15.6 need the CURRENT content from `agents/` and `workflows/` as source material for conversion. This story creates the NEW structure but must preserve the old files for the conversion stories. Options:
1. **Recommended:** Create `skills/` alongside existing `agents/` and `workflows/`, then remove old dirs only after 15.3-15.6 complete
2. **Alternative:** Git history preserves old content, so conversion stories can reference specific commits

### Current module.yaml (to be replaced)

```yaml
extends-module: bmm
name: ma-agents-skills
description: MA-Agents skill enforcement extension for BMM agents
```

### Target module.yaml (per architecture P2-9)

```yaml
code: ma-skills
name: "MA-Agents Skills & Agents"
description: "Enterprise methodology enforcement, specialized agents, and operational workflows"
extends-module: bmm
default_selected: false
```

### Current Extension Module Structure

```
lib/bmad-extension/
├── module.yaml
├── module-help.csv
├── agents/           ← 12 .customize.yaml files (4 custom + 8 built-in)
└── workflows/        ← 6 workflow.md files
```

### Target Extension Module Structure (after Epic 15 complete)

```
lib/bmad-extension/
├── module.yaml       ← code: ma-skills
├── module-help.csv   ← 42 skills registered
└── skills/           ← 42 skill folders
    ├── bmad-ma-agent-sre/
    ├── bmad-ma-agent-devops/
    ├── bmad-ma-agent-cyber/
    ├── bmad-ma-agent-mil498/
    ├── mil498-sss/ through mil498-hrs/
    ├── sre-*/ (8 skills)
    ├── devops-*/ (5 skills)
    ├── cyber-*/ (7 skills)
    └── extension workflow skills (6 skills)
```

### Skill Count Reconciliation

Architecture says 42 skills (4+11+9+6+8+4). Actual count from codebase:
- 4 custom agents: SRE, DevOps, Cyber, MIL-498
- 7 MIL-498 workflows (only 7 exist in `lib/bmad-workflows/mil498/`: sss, ssdd, ocd, sdp, srs, sdd, std) — epics list 11 (adding str, idd, irs, hrs). **Verify which actually exist before creating placeholders.**
- 7 SRE workflows (from `lib/bmad-workflows/sre/`)
- 5 DevOps workflows (from `lib/bmad-workflows/devops/`) — epics say 6. **Check for optimize-pipelines.**
- 7 Cyber workflows (from `lib/bmad-workflows/cyber/`) — epics say 8. **Check for threat-modeling.**
- 6 extension workflows (from `lib/bmad-extension/workflows/`)

**CRITICAL: Count the ACTUAL files, not what the epics claim. Create skill folders only for workflows that actually exist. Note discrepancies in completion notes.**

### Architecture Compliance

- Module MUST have `code` field for `--custom-content` deployment [P2-9]
- `extends-module: bmm` is retained [P2-9]
- All skills go under `skills/` directory [CIS module pattern]
- `module-help.csv` must register all skills [P2-9]

### Files to Touch

| File | Change |
|------|--------|
| `lib/bmad-extension/module.yaml` | Add `code: ma-skills`, update name/description |
| `lib/bmad-extension/module-help.csv` | Rewrite with 42 skill entries |
| `lib/bmad-extension/skills/` | Create directory + all skill subdirectories |
| `lib/bmad-extension/agents/` | Preserve content, plan for removal |
| `lib/bmad-extension/workflows/` | Preserve content, plan for removal |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, extension module structure]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.2]
- [Source: lib/bmad-extension/module.yaml — current state]
- [Source: lib/bmad-extension/module-help.csv — current format]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
