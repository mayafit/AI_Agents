# Story 15.5: Convert SRE/DevOps/Cyber Workflows to SKILL.md Packages

Status: ready-for-dev

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

- [ ] Task 1: Convert 7 SRE playbooks (AC: #1)
  - [ ] 1.1 Read and convert `lib/bmad-workflows/sre/check-deployment-status.md` → `sre-check-deployment-status/SKILL.md`
  - [ ] 1.2 Convert `check-secrets.md` → `sre-check-secrets/SKILL.md`
  - [ ] 1.3 Convert `check-system-status.md` → `sre-check-system-status/SKILL.md`
  - [ ] 1.4 Convert `day-2-ops.md` → `sre-day-2-ops/SKILL.md`
  - [ ] 1.5 Convert `deployment-strategies.md` → `sre-deployment-strategies/SKILL.md`
  - [ ] 1.6 Convert `fix-deployments.md` → `sre-fix-deployments/SKILL.md`
  - [ ] 1.7 Convert `gitops-status.md` → `sre-gitops-status/SKILL.md`
  - [ ] 1.8 Create `bmad-skill-manifest.yaml` for each (type: skill, module: ma-skills)

- [ ] Task 2: Convert 5 DevOps playbooks (AC: #2)
  - [ ] 2.1 Convert `lib/bmad-workflows/devops/configure-infrastructure.md` → `devops-configure-infrastructure/SKILL.md`
  - [ ] 2.2 Convert `disconnected-deployment.md` → `devops-disconnected-deployment/SKILL.md`
  - [ ] 2.3 Convert `docker-compose-setup.md` → `devops-docker-compose-setup/SKILL.md`
  - [ ] 2.4 Convert `manage-helm.md` → `devops-manage-helm/SKILL.md`
  - [ ] 2.5 Convert `sign-docker-image.md` → `devops-sign-docker-image/SKILL.md`
  - [ ] 2.6 Create `bmad-skill-manifest.yaml` for each

- [ ] Task 3: Convert 7 Cyber playbooks (AC: #3)
  - [ ] 3.1 Convert `lib/bmad-workflows/cyber/generate-certs.md` → `cyber-generate-certs/SKILL.md`
  - [ ] 3.2 Convert `immunity-estimation.md` → `cyber-immunity-estimation/SKILL.md`
  - [ ] 3.3 Convert `security-audit.md` → `cyber-security-audit/SKILL.md`
  - [ ] 3.4 Convert `vault-secrets.md` → `cyber-vault-secrets/SKILL.md`
  - [ ] 3.5 Convert `verify-docker-users.md` → `cyber-verify-docker-users/SKILL.md`
  - [ ] 3.6 Convert `verify-image-signature.md` → `cyber-verify-image-signature/SKILL.md`
  - [ ] 3.7 Convert `vulnerability-scan.md` → `cyber-vulnerability-scan/SKILL.md`
  - [ ] 3.8 Create `bmad-skill-manifest.yaml` for each

- [ ] Task 4: Convert 6 extension workflows (AC: #4)
  - [ ] 4.1 Convert `lib/bmad-extension/workflows/add-sprint/workflow.md` → `skills/add-sprint/SKILL.md`
  - [ ] 4.2 Convert `add-to-sprint/workflow.md` → `skills/add-to-sprint/SKILL.md`
  - [ ] 4.3 Convert `create-bug-story/workflow.md` → `skills/create-bug-story/SKILL.md`
  - [ ] 4.4 Convert `modify-sprint/workflow.md` → `skills/modify-sprint/SKILL.md`
  - [ ] 4.5 Convert `project-context-expansion/workflow.md` → `skills/project-context-expansion/SKILL.md`
  - [ ] 4.6 Convert `sprint-status-view/workflow.md` → `skills/sprint-status-view/SKILL.md`
  - [ ] 4.7 Create `bmad-skill-manifest.yaml` for each

- [ ] Task 5: Assess complex vs simple workflow classification (AC: #5)
  - [ ] 5.1 Read each source workflow and classify as simple (single-pass, wrap in SKILL.md) or complex (multi-step, needs prompts/)
  - [ ] 5.2 For complex workflows: split into prompts/ step files
  - [ ] 5.3 Document classification decisions

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

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
