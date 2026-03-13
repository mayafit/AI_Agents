# Story 8.4: Epic 8 Integration Verification

Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to verify that Stories 8.1, 8.2, and 8.3 work together end-to-end,
So that the skill enforcement architecture is validated as a complete pipeline before research stories proceed.

## Acceptance Criteria

1. **Given** Stories 8.1, 8.2, and 8.3 are all implemented,
   **When** `npx ma-agents install` runs for Claude Code,
   **Then** the MA-AGENTS block is injected at TOP of `.claude/CLAUDE.md` (after frontmatter),
   **And** `injectionStrategy` from agents.js was read and used

2. **Given** install runs with BMAD,
   **When** BMAD pipeline completes,
   **Then** extension module is deployed to `_bmad/extensions/ma-agents-skills/`,
   **And** critical_actions reference correct per-agent MANIFEST paths,
   **And** MA-AGENTS block is injected at TOP of BMAD agent .md files

3. **Given** a second install runs (update scenario),
   **When** injection runs on files that already have MA-AGENTS blocks,
   **Then** blocks are replaced in-place (no duplicates),
   **And** extension module survives or is re-deployed

## Tasks / Subtasks

- [ ] Task 1: End-to-end IDE agent test (AC: #1, #3)
  - [ ] 1.1: Run `npx ma-agents install` targeting Claude Code
  - [ ] 1.2: Verify `.claude/CLAUDE.md` has MA-AGENTS block at top (after any frontmatter)
  - [ ] 1.3: Run install again, verify no duplicate blocks
  - [ ] 1.4: Run `npx ma-agents install` targeting Cline — verify BOTH instruction files (`.cline/clinerules.md` and `.clinerules`) get correct top-injection

- [ ] Task 2: End-to-end BMAD agent test (AC: #2, #3)
  - [ ] 2.1: Run `npx ma-agents install` with BMAD enabled
  - [ ] 2.2: Verify `_bmad/extensions/ma-agents-skills/` exists with module.yaml + 11 .customize.yaml files
  - [ ] 2.3: Verify bmm-sre.customize.yaml has critical_actions pointing to `_bmad/skills/sre/MANIFEST.yaml`
  - [ ] 2.4: Verify bmm-sre agent .md file has MA-AGENTS block at top after frontmatter
  - [ ] 2.5: Run `npx bmad-method install --action update`, verify extension survives or is re-deployed

- [ ] Task 3: Cross-story integration check (AC: #1, #2)
  - [ ] 3.1: Verify agents.js has `injectionStrategy` on all 11 agents (Story 8.2 output)
  - [ ] 3.2: Verify installer.js reads `injectionStrategy` with defaults (Story 8.1 output)
  - [ ] 3.3: Verify bmad.js deploys extension module (Story 8.3 output)
  - [ ] 3.4: Document any issues found — create bug stories if needed

## Dev Notes

### Architecture Compliance

- **Verification-only story:** No new features — testing and validation only
- **Cross-story scope:** This story validates the integration between Stories 8.1, 8.2, and 8.3

### Critical Guardrails

- Do NOT implement new features in this story — only test existing implementations
- If issues are found, create separate bug-fix stories rather than fixing inline
- Test in a clean project directory to avoid false positives from prior runs

### Dependencies
- **Depends on:** Stories 8.1, 8.2, and 8.3 (all must be done)
- **Execution order:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6

### References

- [Source: lib/installer.js#L110-L161] — `updateAgentInstructions()` (Story 8.1)
- [Source: lib/agents.js#L17-L253] — Agent registry with injectionStrategy (Story 8.2)
- [Source: lib/bmad.js#L59-L164] — `applyCustomizations()` with extension deployment (Story 8.3)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
