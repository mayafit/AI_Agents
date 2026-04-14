# Story 21.5: Expanded `.clinerules` Template

Status: backlog

## Story

As a **Cline user**,
I want `.clinerules` to include BMAD phase discipline and text-vs-file rules,
So that Cline (which already supports `.clinerules` natively) gets the same universal guardrails.

## Acceptance Criteria

1. New template `lib/templates/clinerules.template.md` exists containing the universal text-vs-file rules and BMAD phase rules formatted for the Cline `.clinerules` convention (one rule per line or short paragraph blocks — Cline's documented format).
2. Both `.cline/clinerules.md` and `.clinerules` (Cline writes both per `lib/agents.js`) receive the expanded content via the existing marker-based injection.
3. Existing user content outside `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers is preserved (NFR5).
4. Re-running install produces byte-identical marker-block content in both files (NFR46).
5. Mention Cline-specific concept: "Use Cline's Architect mode for BMAD planning phases (PM, Architect, Tech Lead). Switch to Code mode only for the implementation phase." This is universal guidance, not on-prem-specific.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/templates/clinerules.template.md` per AC #1, #5
- [ ] Task 2: Verify Cline's `extraInstructionTemplates` (or equivalent existing injection path) writes both `.cline/clinerules.md` and `.clinerules` consistently (AC #2)
- [ ] Task 3: Confirm the universal block from Story 21.2 already covers most of the content; this story may simply add Cline-specific framing (Architect mode mention) and rely on `composeInstructionBlock` for the rest. Decide between two implementations:
  - **Option A**: Cline-only template that wraps `composeInstructionBlock` output with Cline-specific intro/outro
  - **Option B**: Inline Cline-specific rules directly into `lib/templates/clinerules.template.md` and skip `composeInstructionBlock` for Cline
  - Pick Option A — single source of truth for the universal rules
- [ ] Task 4: Tests in `test/clinerules.test.js`
  - [ ] 4.1 Both `.clinerules` and `.cline/clinerules.md` contain universal rules + Architect-mode guidance
  - [ ] 4.2 User content outside markers preserved
  - [ ] 4.3 Idempotent re-install (NFR46)
  - [ ] 4.4 Both files have identical marker-block content

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — Cline parallel to Roo Code/OpenCode. Cline's Architect mode is the application-layer enforcement we leverage via prompt guidance.
- **NFR46** — idempotent stamping for both Cline output files.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/clinerules.template.md` | CREATE |
| `lib/installer.js` | MAYBE-MODIFY — verify Cline extraInstructionTemplates behavior |
| `test/clinerules.test.js` | CREATE |

### Dependencies

- Story 21.2 (universal block — composed via `composeInstructionBlock` for the shared rules)

### Reference

Source playbook: `optimizing-local-llm-coding-agents-bmad.md` Section 3.3 — `.clinerules` example.

### Out of Scope

- Cline-to-Roo migration (Epic 18 Story 18.4)
- On-prem-specific additions (Story 21.6 — appended to the same marker block when profile=on-prem)

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled)_

### Completion Notes List
_(to be filled)_

### File List
_(to be filled)_

## Change Log
- 2026-04-14: Story created (Epic 21, Story 21.5)
