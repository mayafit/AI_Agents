# Story 15.8: Validate Migrated Agents and Workflows

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want to verify that all migrated agents and workflows function identically to their pre-migration behavior,
So that functional equivalence (NFR30) and output equivalence (NFR32) are confirmed.

## Acceptance Criteria

1. All 4 custom agents display the same persona, greeting, and menu items as before conversion
2. Every agent menu item routes to the correct workflow skill
3. All MIL-498 DID workflows produce the same document structure with same template sections
4. MIL-498 progressive disclosure step files execute in the same order as original instructions
5. All SRE/DevOps/Cyber workflows produce the same output as pre-conversion `.md` versions
6. BMAD Builder lint gate scripts (`scan-path-standards.py`, `scan-scripts.py`) pass without critical violations (NFR31)

## Tasks / Subtasks

- [ ] Task 1: Validate custom agent personas (AC: #1)
  - [ ] 1.1 For each of 4 agents (SRE/Alex, DevOps/Amit, Cyber/Yael, MIL-498/Joseph):
    - Compare SKILL.md persona section against original `.customize.yaml` + `.md` sources
    - Verify: role, identity, communication style, principles match exactly
    - Verify: greeting/activation sequence is preserved

- [ ] Task 2: Validate agent menu routing (AC: #2)
  - [ ] 2.1 Create a checklist: each agent × each menu item → expected skill name → verify skill folder exists
  - [ ] 2.2 SRE agent: verify all menu items reference existing `sre-*` skill folders
  - [ ] 2.3 DevOps agent: verify all menu items reference existing `devops-*` skill folders
  - [ ] 2.4 Cyber agent: verify all menu items reference existing `cyber-*` skill folders
  - [ ] 2.5 MIL-498 agent: verify all menu items reference existing `mil498-*` skill folders

- [ ] Task 3: Validate MIL-498 DID workflow conversion (AC: #3, #4)
  - [ ] 3.1 For each of 7 converted DID workflows:
    - Compare `template.md` against original — must be byte-identical
    - Count step files in `prompts/` — must match original instruction step count
    - Verify step order matches original `instructions.md` sequence
    - Verify user confirmation gates exist at template-output boundaries

- [ ] Task 4: Validate SRE/DevOps/Cyber workflow conversion (AC: #5)
  - [ ] 4.1 For each of 19 converted playbooks (7 SRE + 5 DevOps + 7 Cyber):
    - Compare SKILL.md content against original `.md` file
    - Verify playbook content is preserved verbatim (only frontmatter added)
  - [ ] 4.2 For 6 extension workflows:
    - Compare SKILL.md content against original `workflow.md`

- [ ] Task 5: Validate module structure (AC: #6)
  - [ ] 5.1 Verify `lib/bmad-extension/module.yaml` has `code: ma-skills`
  - [ ] 5.2 Verify `lib/bmad-extension/skills/` contains all expected skill folders
  - [ ] 5.3 Verify every skill folder has both `SKILL.md` and `bmad-skill-manifest.yaml`
  - [ ] 5.4 Verify `module-help.csv` lists all skills
  - [ ] 5.5 If BMAD Builder lint scripts are available, run them against the module

- [ ] Task 6: Validate deployment pipeline (AC: #1-#5)
  - [ ] 6.1 Run `npx ma-agents install` on a clean test project
  - [ ] 6.2 Verify all 4 custom agents are deployed as skills
  - [ ] 6.3 Verify all workflow skills are accessible
  - [ ] 6.4 Verify 8 built-in agent `.customize.yaml` files are deployed to `_bmad/_config/agents/`
  - [ ] 6.5 Run a sample BMAD workflow to confirm end-to-end functionality

- [ ] Task 7: Create validation report (AC: all)
  - [ ] 7.1 Create checklist document at `_bmad-output/implementation-artifacts/15-8-validation-report.md`
  - [ ] 7.2 Document: each agent menu item → expected behavior → actual behavior
  - [ ] 7.3 Document: each workflow → pre-conversion behavior → post-conversion behavior
  - [ ] 7.4 Document any discrepancies found and their resolution

## Dev Notes

### This Is a Validation/Testing Story

No new production code is written. This story verifies the output of Stories 15.1-15.7.

### Validation Approach

1. **Static analysis:** File comparison, structure verification, content diff
2. **Dynamic testing:** Run install, activate agents, invoke workflows
3. **Lint gate:** Run BMAD Builder scripts if available

### NFR Checklist

| NFR | Requirement | How to Verify |
|-----|------------|---------------|
| NFR29 | Atomic migration | Test: simulate failure during migration → verify rollback restores old state |
| NFR30 | Functional equivalence | Compare: agent persona, menu, workflow routing before/after |
| NFR31 | Lint gate compliance | Run: `scan-path-standards.py`, `scan-scripts.py` against `lib/bmad-extension/skills/` |
| NFR32 | Output equivalence | Diff: MIL-498 templates before/after; compare playbook content before/after |
| NFR33 | No dual-layer execution | Verify: no references to old workflow engine remain; all execution through SKILL.md |

### Expected Skill Folder Count

After Stories 15.2-15.6 complete:
- 4 agent skill folders
- 7 MIL-498 skill folders (not 11 — only 7 exist in source)
- 7 SRE skill folders (not 9 — only 7 exist in source)
- 5 DevOps skill folders (not 6 — only 5 exist in source)
- 7 Cyber skill folders (not 8 — only 7 exist in source)
- 6 extension workflow skill folders
= **36 total skill folders** (not 42 as originally estimated — 6 workflows don't exist in source)

**This discrepancy should be documented and reconciled in the validation report.**

### File Structure After Migration

```
lib/bmad-extension/
├── module.yaml                  ← code: ma-skills
├── module-help.csv              ← 36 skills (actual count)
└── skills/
    ├── bmad-ma-agent-sre/       ← Agent skills (4)
    ├── bmad-ma-agent-devops/
    ├── bmad-ma-agent-cyber/
    ├── bmad-ma-agent-mil498/
    ├── mil498-sss/              ← MIL-498 skills (7)
    ├── mil498-ssdd/
    ├── mil498-ocd/
    ├── mil498-sdp/
    ├── mil498-srs/
    ├── mil498-sdd/
    ├── mil498-std/
    ├── sre-*/                   ← SRE skills (7)
    ├── devops-*/                ← DevOps skills (5)
    ├── cyber-*/                 ← Cyber skills (7)
    ├── add-sprint/              ← Extension workflows (6)
    ├── add-to-sprint/
    ├── create-bug-story/
    ├── modify-sprint/
    ├── project-context-expansion/
    └── sprint-status-view/

lib/bmad-customize/              ← Built-in agent customizations (8)
├── bmm-pm.customize.yaml
├── bmm-architect.customize.yaml
├── bmm-dev.customize.yaml
├── bmm-qa.customize.yaml
├── bmm-sm.customize.yaml
├── bmm-tech-writer.customize.yaml
├── bmm-ux-designer.customize.yaml
└── bmm-bmad-master.customize.yaml
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, NFR29-NFR33]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.8]
- [Source: All Stories 15.1-15.7 — prerequisite deliverables]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
