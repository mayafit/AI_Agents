# Story 21.3: `.roomodes` Template with BMAD Mode File-Regex Restrictions

Status: backlog

## Story

As a **chief architect**,
I want a `.roomodes` file generated for Roo Code installs defining 4 BMAD modes with `fileRegex` restrictions per phase,
So that Roo Code's application-layer enforcement (`FileRestrictionError`) prevents agents from editing code files during planning phases — independent of whether the LLM follows the prompt.

## Acceptance Criteria

1. New template `lib/templates/roomodes.template.yaml` exists defining four `customModes`:
   - `bmad-pm` — `groups: [read, [edit, { fileRegex: "\\.md$", description: "Markdown only" }]]`
   - `bmad-architect` — `groups: [read, [edit, { fileRegex: "\\.(md|xml|drawio)$", description: "Markdown and diagram files only" }]]`
   - `bmad-techlead` — `groups: [read, [edit, { fileRegex: "\\.(md|json|yaml|yml)$", description: "Markdown, JSON, YAML only" }]]`
   - `bmad-dev` — `groups: [read, edit, command]` (full access)
2. Each mode includes `slug`, `name`, `roleDefinition`, `whenToUse`, and `customInstructions` fields with content matching the BMAD phase descriptions in the source playbook (`optimizing-local-llm-coding-agents-bmad.md` Section 4.3).
3. The Roo Code agent entry in `lib/agents.js` gains an optional `extraInstructionTemplates` array. For Roo Code: `[{ template: 'roomodes.template.yaml', target: '.roomodes', merger: 'yaml-customModes' }]`.
4. The installer reads `extraInstructionTemplates` per agent and stamps each entry. For Roo Code, `.roomodes` is written at the project root.
5. New module `lib/merge/roomodes.js` exports `mergeRoomodes(existingYaml, templateYaml)` returning the merged YAML string. Behavior:
   - If `.roomodes` does not exist, return the template content.
   - If it exists, parse both, merge the `customModes` arrays such that the four ma-agents-owned slugs (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) overwrite any colliding entries (with a console warning naming each colliding slug); all other user-defined `customModes` entries are preserved untouched and emitted before the ma-agents entries.
   - YAML output preserves comments and field order in user-owned entries where the YAML library supports it.
6. Re-running install produces byte-identical `.roomodes` content for the four ma-agents slugs (NFR46), with user-owned entries preserved.
7. NFR47 contract: a unit test verifies the rendered `bmad-architect` `fileRegex` rejects paths ending in `.ts`, `.py`, `.js`, `.go`; accepts `.md`, `.xml`, `.drawio`. Verified by `RegExp(fileRegex).test(path)` — no Roo Code runtime needed.
8. The Roo Code agent must already be registered in `lib/agents.js` (Epic 18 Story 18.1). If Epic 18 is not yet merged when this story starts, this story includes the minimal Roo Code agent registration as a prerequisite sub-task.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/templates/roomodes.template.yaml` per AC #1, #2
- [ ] Task 2: Add `extraInstructionTemplates` field to Roo Code entry in `lib/agents.js` (AC #3)
- [ ] Task 3: Implement `lib/merge/roomodes.js::mergeRoomodes` (AC #5)
  - [ ] 3.1 Use `js-yaml` (already a dependency, verify) for parse/dump
  - [ ] 3.2 Slug-collision detection + console warning
  - [ ] 3.3 Preserve user entries in original order, ma-agents entries appended
- [ ] Task 4: Wire `extraInstructionTemplates` processing into `lib/installer.js` per-agent install loop (AC #4)
- [ ] Task 5: Tests in `test/roomodes-merge.test.js`
  - [ ] 5.1 Empty `.roomodes` → 4 BMAD modes present
  - [ ] 5.2 Existing user mode preserved when slug does not collide
  - [ ] 5.3 Colliding slug overwritten with console warning
  - [ ] 5.4 Idempotency: two merges produce byte-identical output (NFR46)
  - [ ] 5.5 NFR47 contract — `bmad-architect` fileRegex matrix (AC #7)
  - [ ] 5.6 Same matrix for `bmad-pm` (`.md` only) and `bmad-techlead` (`.md|.json|.yaml|.yml` only)
- [ ] Task 6: If Epic 18 not merged, add Roo Code agent registration as prerequisite (AC #8) — coordinate with epic execution order before starting

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — `.roomodes` is the highest-leverage application-layer guardrail in the design. NFR47 makes the enforcement contract testable.
- **NFR46** — Idempotent stamping. The merger is responsible for deterministic output for the ma-agents-owned slugs.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/roomodes.template.yaml` | CREATE |
| `lib/merge/roomodes.js` | CREATE |
| `lib/agents.js` | MODIFY — add `extraInstructionTemplates` to Roo Code entry |
| `lib/installer.js` | MODIFY — process `extraInstructionTemplates` per agent during install |
| `test/roomodes-merge.test.js` | CREATE |

### Dependencies

- Story 21.1 (profile API — `.roomodes` content branches on profile in Story 21.6, but stamping is unconditional)
- Story 21.2 (composition pattern — but `.roomodes` uses YAML merger, not marker-based markdown injection)
- Epic 18 Story 18.1 (Roo Code agent registration) — see AC #8

### Reference

Source playbook: `optimizing-local-llm-coding-agents-bmad.md` Section 4.3 — full `.roomodes` example with 4 BMAD modes. Use that exactly for the template content.

### Out of Scope

- On-prem-specific `customInstructions` additions (Story 21.6 will append on-prem rules to each mode's `customInstructions` when profile=on-prem)
- Cline-to-Roo migration (Epic 18 Story 18.4)

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
- 2026-04-14: Story created (Epic 21, Story 21.3)
