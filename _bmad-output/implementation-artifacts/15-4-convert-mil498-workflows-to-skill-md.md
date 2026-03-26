# Story 15.4: Convert MIL-498 Workflows to SKILL.md Packages

Status: ready-for-dev

## Story

As a **MIL-STD-498 expert**,
I want all MIL-498 DID workflows converted from legacy YAML format to BMAD 6.2.0 SKILL.md packages,
So that they function without the removed legacy workflow engine.

## Acceptance Criteria

1. Each MIL-498 workflow has a skill folder at `lib/bmad-extension/skills/mil498-{did}/` containing `SKILL.md`, `bmad-skill-manifest.yaml`, `template.md`, and `prompts/` directory
2. Each step in the original `instructions.md` becomes a separate file in `prompts/` (Layer 4 progressive disclosure)
3. Step files preserve the exact same sequence and content as the original instructions
4. Template output checkpoints (previously `<template-output>` XML tags) become explicit user confirmation gates in step files
5. All converted DID workflows produce the same document output as before conversion (NFR32)
6. The pause-and-confirm behavior for document section approval is preserved

## Tasks / Subtasks

- [ ] Task 1: Convert SSS workflow (AC: #1-#4)
  - [ ] 1.1 Read `lib/bmad-workflows/mil498/sss/workflow.yaml` — extract metadata and variables
  - [ ] 1.2 Read `lib/bmad-workflows/mil498/sss/instructions.md` — map all steps
  - [ ] 1.3 Create `lib/bmad-extension/skills/mil498-sss/SKILL.md` — workflow entrypoint with routing logic
  - [ ] 1.4 Create `lib/bmad-extension/skills/mil498-sss/bmad-skill-manifest.yaml` — `type: skill, name: mil498-sss, module: ma-skills`
  - [ ] 1.5 Copy template to `lib/bmad-extension/skills/mil498-sss/template.md`
  - [ ] 1.6 Split instructions into `prompts/01-*.md`, `02-*.md`, etc. — one file per logical step
  - [ ] 1.7 Add user confirmation gates at each `<template-output>` boundary

- [ ] Task 2: Convert SSDD workflow (AC: #1-#4)
  - [ ] 2.1-2.7 Same pattern as Task 1 for `lib/bmad-workflows/mil498/ssdd/`

- [ ] Task 3: Convert OCD workflow (AC: #1-#4)
  - [ ] 3.1-3.7 Same pattern for `lib/bmad-workflows/mil498/ocd/`

- [ ] Task 4: Convert SDP workflow (AC: #1-#4)
  - [ ] 4.1-4.7 Same pattern for `lib/bmad-workflows/mil498/sdp/`

- [ ] Task 5: Convert SRS workflow (AC: #1-#4)
  - [ ] 5.1-5.7 Same pattern for `lib/bmad-workflows/mil498/srs/`

- [ ] Task 6: Convert SDD workflow (AC: #1-#4)
  - [ ] 6.1-6.7 Same pattern for `lib/bmad-workflows/mil498/sdd/`

- [ ] Task 7: Convert STD workflow (AC: #1-#4)
  - [ ] 7.1-7.7 Same pattern for `lib/bmad-workflows/mil498/std/`

- [ ] Task 8: Verify missing DID workflows (AC: #5)
  - [ ] 8.1 Check if STR, IDD, IRS, HRS exist in `lib/bmad-workflows/mil498/` — the epics reference 11 DIDs but only 7 directories were found in codebase
  - [ ] 8.2 If they don't exist, document which are missing and note in completion log
  - [ ] 8.3 Create empty placeholder skill folders for any missing DIDs that should be implemented later

- [ ] Task 9: Verify output equivalence (AC: #5, #6)
  - [ ] 9.1 For each converted workflow, compare template content — must be byte-identical to original
  - [ ] 9.2 Verify step count and order matches original instructions
  - [ ] 9.3 Verify user confirmation gates exist at all template-output boundaries

## Dev Notes

### Existing MIL-498 Workflow Structure (Source)

```
lib/bmad-workflows/mil498/
├── ocd/
│   ├── instructions.md    ← Sequential steps with <template-output> checkpoints
│   └── workflow.yaml      ← Metadata, variables, config references
├── sdd/
│   ├── instructions.md
│   └── workflow.yaml
├── sdp/
│   ├── instructions.md
│   └── workflow.yaml
├── srs/
│   ├── instructions.md
│   └── workflow.yaml
├── ssdd/
│   ├── instructions.md
│   └── workflow.yaml
├── sss/
│   ├── instructions.md
│   └── workflow.yaml
└── std/
    ├── instructions.md
    └── workflow.yaml
```

**Only 7 DIDs exist, not 11.** Missing: STR, IDD, IRS, HRS.

### Target Skill Folder Structure (per architecture P2-9)

```
lib/bmad-extension/skills/mil498-sss/
├── SKILL.md                    ← Workflow entrypoint with frontmatter
├── bmad-skill-manifest.yaml    ← type: skill, name: mil498-sss, module: ma-skills
├── template.md                 ← DID output template (copied verbatim)
└── prompts/
    ├── 01-discovery.md         ← First step
    ├── 02-requirements.md      ← Second step
    └── ...                     ← One file per logical step
```

### Conversion Rules

1. **workflow.yaml** → Extract metadata into `SKILL.md` frontmatter and `bmad-skill-manifest.yaml`
2. **instructions.md** → Split at step boundaries into `prompts/NN-name.md` files
3. **template** → Copy verbatim to `template.md` (if exists in workflow.yaml template field)
4. **`<template-output>` tags** → Convert to explicit user confirmation prompts at end of each step file
5. **Step file naming:** `01-discovery.md`, `02-requirements.md`, etc. (zero-padded, kebab-case)
6. **Preserve EXACT step sequence** — compliance-critical for MIL-STD-498

### SKILL.md Entrypoint Pattern

```markdown
---
name: mil498-sss
description: Generate MIL-STD-498 System/Subsystem Specification (SSS)
type: complex-workflow
triggers:
  - "generate SSS"
  - "create system specification"
---

# MIL-498: System/Subsystem Specification (SSS)

## Workflow
This workflow generates a MIL-STD-498 SSS document through progressive steps.

### Steps
1. [Discovery](prompts/01-discovery.md)
2. [Requirements](prompts/02-requirements.md)
...

### Template
Output template: [template.md](template.md)
```

### Anti-Patterns to Avoid

- DO NOT modify template content — verbatim copy only (NFR32)
- DO NOT reorder steps — MIL-STD-498 compliance requires exact sequence
- DO NOT merge steps — each `<template-output>` boundary = separate file
- DO NOT skip user confirmation gates — they exist for compliance approval
- DO NOT create DID workflows that don't exist in source (STR, IDD, IRS, HRS) unless explicitly instructed

### Files to Touch

| File | Change |
|------|--------|
| `lib/bmad-extension/skills/mil498-{did}/SKILL.md` | NEW — 7 workflow entrypoints |
| `lib/bmad-extension/skills/mil498-{did}/bmad-skill-manifest.yaml` | NEW — 7 manifests |
| `lib/bmad-extension/skills/mil498-{did}/template.md` | NEW — 7 template copies |
| `lib/bmad-extension/skills/mil498-{did}/prompts/*.md` | NEW — step files per workflow |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, MIL-498 conversion detail]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.4]
- [Source: lib/bmad-workflows/mil498/ — 7 existing DID workflow directories]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
