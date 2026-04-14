# Story 21.4: Expanded `AGENTS.md` Template for OpenCode

Status: backlog

## Story

As an **OpenCode user installing ma-agents**,
I want a comprehensive `AGENTS.md` generated at my project root covering text-vs-file rules, BMAD phase discipline, and the project's BMAD output structure,
So that OpenCode's auto-loading of `AGENTS.md` gives the agent the same guardrails Roo Code gets via `.roomodes`.

## Acceptance Criteria

1. New template `lib/templates/agents-md.template.md` exists containing:
   - The same text-vs-file rules from the universal block (Story 21.2)
   - A "never create files in `~/.claude/` or any user home directory" rule (universal for AGENTS.md regardless of profile — OpenCode + any model should respect it)
   - A BMAD phase declaration section (Discovery/PM, Architecture, Tech Lead/Stories, Implementation) with phase-specific behavior rules
   - The project BMAD output structure with placeholders: `{{PLANNING_DIR}}`, `{{ARCHITECTURE_DIR}}`, `{{STORIES_DIR}}` — stamped to project's actual `_bmad-output/` paths at install time
2. The OpenCode agent entry in `lib/agents.js` gains an `extraInstructionTemplates` entry: `[{ template: 'agents-md.template.md', target: 'AGENTS.md', merger: 'markdown-markers' }]`.
3. The marker-based markdown merger reuses the function used by Story 21.2 — content within `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` is rewritten; outside content preserved (NFR5, NFR46).
4. After Story 21.4 ships, on a fresh OpenCode install:
   - `AGENTS.md` is written at project root with the stamped content
   - `opencode.json::instructions[]` array contains `"AGENTS.md"` if not already present (reuses Epic 9's JSON-merge function unchanged — additive only, NFR18)
5. Re-running install produces byte-identical `AGENTS.md` marker-block content and does not duplicate the `instructions[]` entry (NFR46, NFR18).
6. The phase declaration content is profile-agnostic in this story; on-prem-specific rules (`/no_think`, reasoning mode) come via Story 21.6 by appending to the same marker block.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/templates/agents-md.template.md` per AC #1
- [ ] Task 2: Add `extraInstructionTemplates` to OpenCode entry in `lib/agents.js` (AC #2)
- [ ] Task 3: Verify the existing OpenCode JSON-merge from Epic 9 handles the additive append idempotently (AC #4, #5) — read `lib/installer.js` JSON-merge function to confirm; no changes expected
- [ ] Task 4: Wire `markdown-markers` merger handling for `extraInstructionTemplates` (likely already handled by Story 21.3's `extraInstructionTemplates` processor — extend, do not duplicate)
- [ ] Task 5: Tests in `test/agents-md.test.js`
  - [ ] 5.1 Fresh install: `AGENTS.md` created with universal rules, phase section, stamped paths
  - [ ] 5.2 `opencode.json::instructions[]` contains `AGENTS.md` after install
  - [ ] 5.3 Re-install: `instructions[]` not duplicated (NFR18)
  - [ ] 5.4 Re-install: `AGENTS.md` marker-block content byte-identical (NFR46)
  - [ ] 5.5 Existing `AGENTS.md` user content outside markers preserved
  - [ ] 5.6 Path placeholders correctly stamped from project's `_bmad-output/` layout

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — OpenCode parallel to Roo Code's `.roomodes` for application-layer guidance. OpenCode lacks file-regex enforcement (no `FileRestrictionError`), so reliance on prompt + Plan/Build mode is acceptable; this story does what's possible within OpenCode's capabilities.
- **NFR18** (Epic 9 contract) — JSON-merge into `opencode.json::instructions[]` remains additive-only.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/agents-md.template.md` | CREATE |
| `lib/agents.js` | MODIFY — `extraInstructionTemplates` on OpenCode entry |
| `lib/installer.js` | MAYBE-MODIFY — extend `extraInstructionTemplates` processor (Story 21.3) for `markdown-markers` merger if not already supported |
| `test/agents-md.test.js` | CREATE |

### Dependencies

- Story 21.2 (universal rules content — `AGENTS.md` reuses the same wording sourced from `lib/templates/instruction-block-universal.template.md` to avoid drift; consider reading the universal template and embedding it within the AGENTS.md template at stamp time, OR duplicate the rules text and add a comment marking the source of truth)
- Story 21.3 (`extraInstructionTemplates` processor pattern — extend if needed)
- Epic 9 (OpenCode JSON-merge — reused unchanged)

### Reference

Source playbook: `optimizing-local-llm-coding-agents-bmad.md` Section 5.3 — full `AGENTS.md` example with phase rules.

### Out of Scope

- On-prem-specific additions (Story 21.6)
- BMAD persona phase prefix in customize-loader (Story 21.7)

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
- 2026-04-14: Story created (Epic 21, Story 21.4)
