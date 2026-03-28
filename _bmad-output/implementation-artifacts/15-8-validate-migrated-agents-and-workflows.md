# Story 15.8: Validate Migrated Agents and Workflows

Status: done

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

- [x] Task 1: Validate custom agent personas (AC: #1)
  - [x] 1.1 For each of 4 agents (SRE/Alex, DevOps/Amit, Cyber/Yael, MIL-498/Joseph):
    - Compared SKILL.md persona section against original `.customize.yaml` + `.md` sources
    - Verified: role, identity, communication style, principles match exactly
    - Verified: greeting/activation sequence is preserved (8-step activation preserved)

- [x] Task 2: Validate agent menu routing (AC: #2)
  - [x] 2.1 Created automated checklist: each agent x each menu item -> expected skill name -> verified skill folder exists
  - [x] 2.2 SRE agent: all menu items reference correct skills (2 pre-existing gaps: health-check, performance-opt never implemented)
  - [x] 2.3 DevOps agent: all menu items reference correct skills (1 pre-existing gap: optimize-pipelines never implemented)
  - [x] 2.4 Cyber agent: all menu items reference correct skills (1 pre-existing gap: threat-modeling never implemented)
  - [x] 2.5 MIL-498 agent: all 7 menu items reference existing `mil498-*` skill folders

- [x] Task 3: Validate MIL-498 DID workflow conversion (AC: #3, #4)
  - [x] 3.1 For each of 7 converted DID workflows:
    - Compared `template.md` against original -- all 7 byte-identical
    - Counted step files in `prompts/` -- all match original instruction step count (6 each, SSDD has 7)
    - Verified step order matches original `instructions.md` sequence
    - Verified step files are sequentially numbered (01-06 or 01-07 for SSDD)

- [x] Task 4: Validate SRE/DevOps/Cyber workflow conversion (AC: #5)
  - [x] 4.1 For each of 19 converted playbooks (7 SRE + 5 DevOps + 7 Cyber):
    - Compared SKILL.md content against original `.md` file -- all verbatim (line-ending normalized)
    - Verified playbook content is preserved verbatim (only YAML frontmatter added)
  - [x] 4.2 For 6 extension workflows:
    - Verified SKILL.md and bmad-skill-manifest.yaml exist in each skill folder

- [x] Task 5: Validate module structure (AC: #6)
  - [x] 5.1 Verified `lib/bmad-extension/module.yaml` has `code: ma-skills`
  - [x] 5.2 Verified `lib/bmad-extension/skills/` contains all 36 expected skill folders
  - [x] 5.3 Verified every skill folder has both `SKILL.md` and `bmad-skill-manifest.yaml` (36/36)
  - [x] 5.4 Verified `module-help.csv` lists all 36 skills with module code `ma-skills`
  - [x] 5.5 Ran BMAD Builder lint scripts: scan-path-standards.py (0 critical, 11 high), scan-scripts.py (0 findings)

- [x] Task 6: Validate deployment pipeline (AC: #1-#5)
  - [x] 6.1 Verified bmad.js deployment sequence (RECOMPILE -> EXTENSION -> WORKFLOWS)
  - [x] 6.2 Verified all 4 custom agents exist as skill folders in extension module
  - [x] 6.3 Verified all workflow skills are present and have manifests
  - [x] 6.4 Verified 8 built-in agent `.customize.yaml` files exist in `lib/bmad-customize/`
  - [x] 6.5 Verified migration detection functions exported and functional

- [x] Task 7: Create validation report (AC: all)
  - [x] 7.1 Created checklist at `_bmad-output/implementation-artifacts/15-8-validation-report.md`
  - [x] 7.2 Documented: each agent menu item -> expected behavior -> actual behavior
  - [x] 7.3 Documented: each workflow -> pre-conversion behavior -> post-conversion behavior
  - [x] 7.4 Documented 4 discrepancies (all pre-existing, none introduced by migration)

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

Claude Opus 4.6 (1M context)

### Debug Log References

N/A (validation story -- no production code changes)

### Completion Notes List

- 194 automated tests created in `test/migration-validation.test.js` -- all pass
- BMAD Builder lint scripts ran: 0 critical findings (NFR31 satisfied)
- 4 pre-existing discrepancies documented (menu references to unimplemented workflows)
- 3 stale test assertions documented from earlier stories (bmad-extension.test.js, extension-module-restructure.test.js)
- All MIL-498 templates byte-identical to originals
- All SRE/DevOps/Cyber playbook content preserved verbatim

### File List

- `test/migration-validation.test.js` -- NEW: 194-assertion comprehensive validation test suite
- `_bmad-output/implementation-artifacts/15-8-validation-report.md` -- NEW: validation report
- `_bmad-output/implementation-artifacts/15-8-validate-migrated-agents-and-workflows.md` -- UPDATED: story status
