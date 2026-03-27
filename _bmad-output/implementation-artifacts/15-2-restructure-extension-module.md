# Story 15.2: Restructure Extension Module for 6.2.0 Conventions

Status: review

## Story

As a **Chief Architect**,
I want the extension module restructured to follow the BMAD 6.2.0 module pattern (verified from CIS module source),
So that `--custom-content` deployment works correctly and the module integrates natively with BMAD's module system.

## Acceptance Criteria

1. `lib/bmad-extension/module.yaml` contains `code: ma-skills`, `name`, `description`, and `extends-module: bmm`
2. `--custom-content lib/bmad-extension/` passes bmad-method 6.2.1's validation (requires `module.yaml` with `code` field)
3. `lib/bmad-extension/skills/` directory is created as the root for all skill folders
4. `lib/bmad-extension/module-help.csv` is updated to register all 36 skills (4 agents + 32 workflows)
5. Old `lib/bmad-extension/agents/` and `lib/bmad-extension/workflows/` directories are NOT removed yet (Stories 15.3-15.6 need them)
6. Content from old directories is migrated into `skills/` in subsequent stories (15.3-15.5) — this story creates the scaffolding only

## Tasks / Subtasks

- [x] Task 1: Update module.yaml (AC: #1, #2)
  - [x] 1.1 Update `lib/bmad-extension/module.yaml` to add `code: ma-skills` field
  - [x] 1.2 Update `name` to `"MA-Agents Skills & Agents"`
  - [x] 1.3 Update `description` to `"Enterprise methodology enforcement, specialized agents, and operational workflows"`
  - [x] 1.4 Keep `extends-module: bmm`
  - [x] 1.5 Add `default_selected: false`
  - [x] 1.6 Verify `--custom-content lib/bmad-extension/` passes 6.2.1 validation (verified: `code` field present, matching CIS module pattern from bmad-cache)

- [x] Task 2: Create skills directory structure (AC: #3)
  - [x] 2.1 Create `lib/bmad-extension/skills/` directory
  - [x] 2.2 Create placeholder directories for all 36 actual skill folders (not 42 as architecture claimed):
    - Agent skills (4): `bmad-ma-agent-sre/`, `bmad-ma-agent-devops/`, `bmad-ma-agent-cyber/`, `bmad-ma-agent-mil498/`
    - MIL-498 skills (7): `mil498-sss/`, `mil498-ssdd/`, `mil498-ocd/`, `mil498-sdp/`, `mil498-srs/`, `mil498-sdd/`, `mil498-std/`
    - SRE skills (7): `sre-check-deployment-status/`, `sre-check-secrets/`, `sre-check-system-status/`, `sre-day-2-ops/`, `sre-deployment-strategies/`, `sre-fix-deployments/`, `sre-gitops-status/`
    - DevOps skills (5): `devops-configure-infrastructure/`, `devops-disconnected-deployment/`, `devops-docker-compose-setup/`, `devops-manage-helm/`, `devops-sign-docker-image/`
    - Cyber skills (7): `cyber-generate-certs/`, `cyber-immunity-estimation/`, `cyber-security-audit/`, `cyber-vault-secrets/`, `cyber-verify-docker-users/`, `cyber-verify-image-signature/`, `cyber-vulnerability-scan/`
    - Extension workflows (6): `create-bug-story/`, `add-sprint/`, `modify-sprint/`, `add-to-sprint/`, `project-context-expansion/`, `sprint-status-view/`

- [x] Task 3: Update module-help.csv (AC: #4)
  - [x] 3.1 Read existing `lib/bmad-extension/module-help.csv` to understand current format
  - [x] 3.2 Rewrite to list all 36 actual skills with type, trigger, and descriptions
  - [x] 3.3 Ensure CSV format matches bmad-method module-help.csv convention (verified against CIS and BMB modules in bmad-cache)

- [x] Task 4: Preserve old directories (AC: #5, #6)
  - [x] 4.1 Verified `lib/bmad-extension/agents/` preserved in place (12 customize.yaml files)
  - [x] 4.2 Verified `lib/bmad-extension/workflows/` preserved in place (6 workflow subdirs)
  - [x] 4.3 Old directories NOT removed — required as source material for Stories 15.3-15.6

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
├── agents/           <- 12 .customize.yaml files (4 custom + 8 built-in)
└── workflows/        <- 6 workflow.md files
```

### Target Extension Module Structure (after Epic 15 complete)

```
lib/bmad-extension/
├── module.yaml       <- code: ma-skills
├── module-help.csv   <- 36 skills registered
└── skills/           <- 36 skill folders
    ├── bmad-ma-agent-sre/
    ├── bmad-ma-agent-devops/
    ├── bmad-ma-agent-cyber/
    ├── bmad-ma-agent-mil498/
    ├── mil498-sss/ through mil498-std/ (7 skills)
    ├── sre-*/ (7 skills)
    ├── devops-*/ (5 skills)
    ├── cyber-*/ (7 skills)
    └── extension workflow skills (6 skills)
```

### Skill Count Reconciliation

Architecture says 42 skills (4+11+9+6+8+4). Actual count from codebase:
- 4 custom agents: SRE, DevOps, Cyber, MIL-498
- 7 MIL-498 workflows (only 7 exist in `lib/bmad-workflows/mil498/`: sss, ssdd, ocd, sdp, srs, sdd, std) -- epics list 11 (adding str, idd, irs, hrs). **Verify which actually exist before creating placeholders.**
- 7 SRE workflows (from `lib/bmad-workflows/sre/`) -- epics say 9 but only 7 exist (no health-check or performance-opt workflow files, though agent menu references them)
- 5 DevOps workflows (from `lib/bmad-workflows/devops/`) -- epics say 6. **No optimize-pipelines file exists** (though agent menu references it)
- 7 Cyber workflows (from `lib/bmad-workflows/cyber/`) -- epics say 8. **No threat-modeling file exists** (though agent menu references it)
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
| `lib/bmad-extension/module-help.csv` | Rewrite with 36 skill entries |
| `lib/bmad-extension/skills/` | Create directory + all skill subdirectories |
| `lib/bmad-extension/agents/` | Preserve content, plan for removal |
| `lib/bmad-extension/workflows/` | Preserve content, plan for removal |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- P2-9, extension module structure]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 15.2]
- [Source: lib/bmad-extension/module.yaml -- current state]
- [Source: lib/bmad-extension/module-help.csv -- current format]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None required -- all tests pass on first run.

### Completion Notes List
1. **Skill count discrepancy:** Architecture/epics claimed 42 skills, actual codebase has 36. Missing from codebase:
   - MIL-498: str, idd, irs, hrs (4 planned but not yet created)
   - SRE: health-check, performance-opt (referenced in agent menu but no workflow files exist)
   - DevOps: optimize-pipelines (referenced in agent menu but no workflow file exists)
   - Cyber: threat-modeling (referenced in agent menu but no workflow file exists)
   Total missing: 6 skills = 42 planned - 36 actual
2. **Old directories preserved:** `agents/` and `workflows/` directories left intact for Stories 15.3-15.6 to use as source material during conversion.
3. **CSV format:** Aligned with CIS/BMB module-help.csv conventions from bmad-cache (module,phase,name,code,sequence,workflow-file,command,required,agent,options,description,output-location,outputs).
4. **module.yaml validated:** Structure matches CIS module pattern from bmad-cache (`code`, `name`, `description`, `default_selected` fields confirmed).
5. **Test coverage:** 31 tests in `test/extension-module-restructure.test.js` covering all 4 tasks and acceptance criteria.

### File List
| File | Action |
|------|--------|
| `lib/bmad-extension/module.yaml` | Modified -- added code, updated name/description, added default_selected |
| `lib/bmad-extension/module-help.csv` | Modified -- rewritten with 36 skill entries in BMAD module format |
| `lib/bmad-extension/skills/` | Created -- 36 subdirectories with .gitkeep files |
| `test/extension-module-restructure.test.js` | Created -- 31 tests for module restructure validation |
| `package.json` | Modified -- added extension-module-restructure test to test script |
| `_bmad-output/implementation-artifacts/15-2-restructure-extension-module.md` | Modified -- updated status, tasks, dev agent record |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-27 | Initial implementation: module.yaml updated, skills/ scaffolding created (36 dirs), module-help.csv rewritten, 31 tests added | Claude Opus 4.6 |
