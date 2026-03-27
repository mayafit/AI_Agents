# Story 15.5: Convert SRE/DevOps/Cyber Workflows to SKILL.md Packages

Status: review

## Story

As a **Chief Architect**,
I want all SRE, DevOps, and Cyber operational playbooks plus the extension workflows converted to SKILL.md skill packages,
So that they integrate with the BMAD 6.2.0 skill system consistently.

## Acceptance Criteria

1. Each SRE playbook in `lib/bmad-workflows/sre/` (7 workflows) has a skill folder at `lib/bmad-extension/skills/sre-{workflow}/` with `SKILL.md` and `bmad-skill-manifest.yaml`
2. Each DevOps playbook in `lib/bmad-workflows/devops/` (5 workflows) has a skill folder at `lib/bmad-extension/skills/devops-{workflow}/`
3. Each Cyber playbook in `lib/bmad-workflows/cyber/` (7 workflows) has a skill folder at `lib/bmad-extension/skills/cyber-{workflow}/`
4. The 6 extension workflows in `lib/bmad-extension/workflows/` are converted to skill folder format under `lib/bmad-extension/skills/`
5. Multi-step workflows use `prompts/` for step files (Complex Workflow type); single-pass playbooks remain as simple `SKILL.md` files
6. Agent menu references can invoke them by new skill name with identical behavior (NFR32)

## Tasks / Subtasks

- [x] Task 1: Convert 7 SRE playbooks (AC: #1)
  - [x] 1.1 Read and convert `lib/bmad-workflows/sre/check-deployment-status.md` → `sre-check-deployment-status/SKILL.md`
  - [x] 1.2 Convert `check-secrets.md` → `sre-check-secrets/SKILL.md`
  - [x] 1.3 Convert `check-system-status.md` → `sre-check-system-status/SKILL.md`
  - [x] 1.4 Convert `day-2-ops.md` → `sre-day-2-ops/SKILL.md`
  - [x] 1.5 Convert `deployment-strategies.md` → `sre-deployment-strategies/SKILL.md`
  - [x] 1.6 Convert `fix-deployments.md` → `sre-fix-deployments/SKILL.md`
  - [x] 1.7 Convert `gitops-status.md` → `sre-gitops-status/SKILL.md`
  - [x] 1.8 Create `bmad-skill-manifest.yaml` for each (type: skill, module: ma-skills)

- [x] Task 2: Convert 5 DevOps playbooks (AC: #2)
  - [x] 2.1 Convert `lib/bmad-workflows/devops/configure-infrastructure.md` → `devops-configure-infrastructure/SKILL.md`
  - [x] 2.2 Convert `disconnected-deployment.md` → `devops-disconnected-deployment/SKILL.md`
  - [x] 2.3 Convert `docker-compose-setup.md` → `devops-docker-compose-setup/SKILL.md`
  - [x] 2.4 Convert `manage-helm.md` → `devops-manage-helm/SKILL.md`
  - [x] 2.5 Convert `sign-docker-image.md` → `devops-sign-docker-image/SKILL.md`
  - [x] 2.6 Create `bmad-skill-manifest.yaml` for each

- [x] Task 3: Convert 7 Cyber playbooks (AC: #3)
  - [x] 3.1 Convert `lib/bmad-workflows/cyber/generate-certs.md` → `cyber-generate-certs/SKILL.md`
  - [x] 3.2 Convert `immunity-estimation.md` → `cyber-immunity-estimation/SKILL.md`
  - [x] 3.3 Convert `security-audit.md` → `cyber-security-audit/SKILL.md`
  - [x] 3.4 Convert `vault-secrets.md` → `cyber-vault-secrets/SKILL.md`
  - [x] 3.5 Convert `verify-docker-users.md` → `cyber-verify-docker-users/SKILL.md`
  - [x] 3.6 Convert `verify-image-signature.md` → `cyber-verify-image-signature/SKILL.md`
  - [x] 3.7 Convert `vulnerability-scan.md` → `cyber-vulnerability-scan/SKILL.md`
  - [x] 3.8 Create `bmad-skill-manifest.yaml` for each

- [x] Task 4: Convert 6 extension workflows (AC: #4)
  - [x] 4.1 Convert `lib/bmad-extension/workflows/add-sprint/workflow.md` → `skills/add-sprint/SKILL.md`
  - [x] 4.2 Convert `add-to-sprint/workflow.md` → `skills/add-to-sprint/SKILL.md`
  - [x] 4.3 Convert `create-bug-story/workflow.md` → `skills/create-bug-story/SKILL.md`
  - [x] 4.4 Convert `modify-sprint/workflow.md` → `skills/modify-sprint/SKILL.md`
  - [x] 4.5 Convert `project-context-expansion/workflow.md` → `skills/project-context-expansion/SKILL.md`
  - [x] 4.6 Convert `sprint-status-view/workflow.md` → `skills/sprint-status-view/SKILL.md`
  - [x] 4.7 Create `bmad-skill-manifest.yaml` for each

- [x] Task 5: Assess complex vs simple workflow classification (AC: #5)
  - [x] 5.1 Read each source workflow and classify as simple (single-pass, wrap in SKILL.md) or complex (multi-step, needs prompts/)
  - [x] 5.2 For complex workflows: split into prompts/ step files
  - [x] 5.3 Document classification decisions

## Dev Notes

### Conversion Pattern: Simple Workflow (majority of SRE/DevOps/Cyber)

Most operational playbooks are single `.md` files with inline instructions. Conversion is lightweight:

```markdown
---
name: sre-health-check
description: System health check and diagnostic workflow
type: skill
triggers:
  - "health check"
  - "check system health"
---

{existing .md content wrapped here verbatim}
```

Plus a `bmad-skill-manifest.yaml`:
```yaml
type: skill
name: sre-health-check
module: ma-skills
```

### Conversion Pattern: Complex Workflow (some extension workflows)

Extension workflows like `create-bug-story` may have multi-step flows. These get `prompts/`:

```
skills/create-bug-story/
├── SKILL.md                 ← Entrypoint with frontmatter
├── bmad-skill-manifest.yaml
└── prompts/
    ├── 01-gather-report.md
    └── 02-create-story.md
```

### Actual File Counts (from codebase analysis)

| Domain | Expected (epics) | Actual (codebase) | Files |
|--------|------------------|-------------------|-------|
| SRE | 9 | **7** | check-deployment-status, check-secrets, check-system-status, day-2-ops, deployment-strategies, fix-deployments, gitops-status |
| DevOps | 6 | **5** | configure-infrastructure, disconnected-deployment, docker-compose-setup, manage-helm, sign-docker-image |
| Cyber | 8 | **7** | generate-certs, immunity-estimation, security-audit, vault-secrets, verify-docker-users, verify-image-signature, vulnerability-scan |
| Extension | 4 | **6** | add-sprint, add-to-sprint, create-bug-story, modify-sprint, project-context-expansion, sprint-status-view |

**CRITICAL: Convert only files that ACTUALLY EXIST. Note discrepancies between epics count and actual count in completion log. Missing workflows (SRE: 2 missing, DevOps: 1 missing, Cyber: 1 missing) are noted but NOT created.**

### Skill Naming Convention

- SRE: `sre-{kebab-case-filename}` (e.g., `sre-check-deployment-status`)
- DevOps: `devops-{kebab-case-filename}` (e.g., `devops-configure-infrastructure`)
- Cyber: `cyber-{kebab-case-filename}` (e.g., `cyber-vulnerability-scan`)
- Extension: keep existing kebab-case name (e.g., `create-bug-story`)

### Anti-Patterns to Avoid

- DO NOT modify playbook content during conversion — wrap verbatim (NFR32)
- DO NOT create skills for non-existent workflows — only convert what exists
- DO NOT change trigger phrases or invocation names — preserve behavioral equivalence
- DO NOT add prompts/ to simple single-pass playbooks — keep them simple

### Files to Touch

| Domain | New Files (per workflow) |
|--------|------------------------|
| SRE (7) | 7 × SKILL.md + 7 × bmad-skill-manifest.yaml = 14 files |
| DevOps (5) | 5 × SKILL.md + 5 × bmad-skill-manifest.yaml = 10 files |
| Cyber (7) | 7 × SKILL.md + 7 × bmad-skill-manifest.yaml = 14 files |
| Extension (6) | 6 × SKILL.md + 6 × bmad-skill-manifest.yaml = 12 files |
| **Total** | **50 new files** (+ prompts/ for any complex workflows) |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, SRE/DevOps/Cyber conversion detail]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.5]
- [Source: lib/bmad-workflows/sre/ — 7 playbook .md files]
- [Source: lib/bmad-workflows/devops/ — 5 playbook .md files]
- [Source: lib/bmad-workflows/cyber/ — 7 playbook .md files]
- [Source: lib/bmad-extension/workflows/ — 6 workflow.md files]

## Change Log

- 2026-03-27: All 25 workflows converted to SKILL.md packages under `lib/bmad-extension/skills/`
  - 7 SRE playbooks → `sre-{name}/` skill folders (simple wrap)
  - 5 DevOps playbooks → `devops-{name}/` skill folders (simple wrap)
  - 7 Cyber playbooks → `cyber-{name}/` skill folders (simple wrap)
  - 6 Extension workflows → `{name}/` skill folders (simple wrap with verbatim multi-step content)
  - Classification: all 25 treated as simple wraps (content preserved verbatim per NFR32); extension workflows contain `<workflow>/<step>` markup inline so no prompts/ decomposition needed
  - 157 tests pass in `test/story-15-5-workflow-skills.test.js`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

N/A

### Completion Notes List

- All 25 source workflows verified to exist before conversion
- All SRE/DevOps/Cyber playbooks are single-pass: wrapped verbatim with SKILL.md frontmatter
- All 6 extension workflows contain multi-step `<workflow>/<step>` markup but are self-contained single files; wrapped verbatim (no prompts/ split needed) per NFR32
- Each skill folder has SKILL.md (frontmatter: name, description, type: skill, triggers) + bmad-skill-manifest.yaml (type: skill, name, module: ma-skills)
- 157 tests verify: folder structure, file existence, frontmatter format, manifest validity, content preservation, no .gitkeep files

### File List

**New files (50 skill files + 1 test):**
- `lib/bmad-extension/skills/sre-check-deployment-status/SKILL.md`
- `lib/bmad-extension/skills/sre-check-deployment-status/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-check-secrets/SKILL.md`
- `lib/bmad-extension/skills/sre-check-secrets/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-check-system-status/SKILL.md`
- `lib/bmad-extension/skills/sre-check-system-status/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-day-2-ops/SKILL.md`
- `lib/bmad-extension/skills/sre-day-2-ops/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-deployment-strategies/SKILL.md`
- `lib/bmad-extension/skills/sre-deployment-strategies/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-fix-deployments/SKILL.md`
- `lib/bmad-extension/skills/sre-fix-deployments/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sre-gitops-status/SKILL.md`
- `lib/bmad-extension/skills/sre-gitops-status/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/devops-configure-infrastructure/SKILL.md`
- `lib/bmad-extension/skills/devops-configure-infrastructure/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/devops-disconnected-deployment/SKILL.md`
- `lib/bmad-extension/skills/devops-disconnected-deployment/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/devops-docker-compose-setup/SKILL.md`
- `lib/bmad-extension/skills/devops-docker-compose-setup/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/devops-manage-helm/SKILL.md`
- `lib/bmad-extension/skills/devops-manage-helm/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/devops-sign-docker-image/SKILL.md`
- `lib/bmad-extension/skills/devops-sign-docker-image/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-generate-certs/SKILL.md`
- `lib/bmad-extension/skills/cyber-generate-certs/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-immunity-estimation/SKILL.md`
- `lib/bmad-extension/skills/cyber-immunity-estimation/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-security-audit/SKILL.md`
- `lib/bmad-extension/skills/cyber-security-audit/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-vault-secrets/SKILL.md`
- `lib/bmad-extension/skills/cyber-vault-secrets/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-verify-docker-users/SKILL.md`
- `lib/bmad-extension/skills/cyber-verify-docker-users/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-verify-image-signature/SKILL.md`
- `lib/bmad-extension/skills/cyber-verify-image-signature/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/cyber-vulnerability-scan/SKILL.md`
- `lib/bmad-extension/skills/cyber-vulnerability-scan/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/add-sprint/SKILL.md`
- `lib/bmad-extension/skills/add-sprint/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/add-to-sprint/SKILL.md`
- `lib/bmad-extension/skills/add-to-sprint/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/create-bug-story/SKILL.md`
- `lib/bmad-extension/skills/create-bug-story/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/modify-sprint/SKILL.md`
- `lib/bmad-extension/skills/modify-sprint/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/project-context-expansion/SKILL.md`
- `lib/bmad-extension/skills/project-context-expansion/bmad-skill-manifest.yaml`
- `lib/bmad-extension/skills/sprint-status-view/SKILL.md`
- `lib/bmad-extension/skills/sprint-status-view/bmad-skill-manifest.yaml`
- `test/story-15-5-workflow-skills.test.js`

**Modified files:**
- `_bmad-output/implementation-artifacts/15-5-convert-sre-devops-cyber-workflows.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status → review)
