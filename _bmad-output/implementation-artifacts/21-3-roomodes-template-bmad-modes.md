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
9. **Slug-stomp protection.** On install, for each of the four ma-agents-owned slugs (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`) that already exist in the user's `.roomodes`, the installer diffs the existing slug body (`roleDefinition` + `customInstructions` + `groups`) against the current template output for the user's profile. If a non-whitespace-only diff exists, the installer ABORTS with a named error (e.g., `RoomodesSlugDivergenceError`) listing the diverged slugs and instructs the user to either (a) rename the slug (accept it as user-owned, dropping our version) or (b) rerun with `--force-roomodes-overwrite` to accept the stomp. Without `--force-roomodes-overwrite`, no overwrite happens. This supersedes the "console warning only" behavior described in AC #5's bullet about colliding slugs for the four ma-agents-owned slugs; collisions on other slugs are impossible (ma-agents only owns these four). `--yes` does NOT imply `--force-roomodes-overwrite` — silent stomps on user-edited BMAD modes would be a data-loss regression.
10. **Overwrite audit log.** When a ma-agents-owned slug IS written or overwritten (first install, clean match of existing content, or user passed `--force-roomodes-overwrite`), the installer appends an entry to a top-level field `roomodesOverwriteLog` in `.ma-agents.json` with shape `{ slug, date: <ISO-timestamp>, previousContentHash: <sha256-of-previous-body-or-null-if-new>, profile: <value> }`. The array grows append-only and is capped at 50 entries (oldest dropped on insert beyond cap) to prevent unbounded growth of `.ma-agents.json`. Rationale: gives operators a forensic trail for "when did the BMAD mode definitions last change on this project?"

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
- [ ] Task 7: Slug-stomp protection (AC #9)
  - [ ] 7.1 For each of the 4 ma-agents-owned slugs, compute diff of existing `roleDefinition`+`customInstructions`+`groups` against current template render
  - [ ] 7.2 On any non-whitespace diff without `--force-roomodes-overwrite`, abort with `RoomodesSlugDivergenceError` listing diverged slugs and remediation
  - [ ] 7.3 Add `--force-roomodes-overwrite` flag to `bin/cli.js` install command; document in help text that `--yes` does not imply it
- [ ] Task 8: Overwrite audit log (AC #10)
  - [ ] 8.1 On write of a ma-agents-owned slug, append `{ slug, date, previousContentHash, profile }` to `.ma-agents.json::roomodesOverwriteLog`
  - [ ] 8.2 `previousContentHash` is sha256 of the previous slug body (concat of `roleDefinition`+`customInstructions`+JSON.stringify(`groups`)) or `null` on first install of that slug
  - [ ] 8.3 Cap array at 50 entries — oldest dropped on insert beyond cap
  - [ ] 8.4 Test: install → log has 4 entries with null hashes; re-install with hand-edit + `--force-roomodes-overwrite` → log has 5 entries, 5th has non-null previous hash

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
- 2026-04-14: Added ACs #9 and #10 for slug-stomp protection and overwrite audit log (Findings #9 and #20, corrective plan step 3). New CLI flag: `--force-roomodes-overwrite`. New `.ma-agents.json` field: `roomodesOverwriteLog` (append-only, capped at 50). AC #5's "colliding slug overwrite with console warning" is superseded for the four ma-agents-owned slugs by AC #9's abort-and-require-force behavior; AC #5 still governs behavior for user-owned slugs (preserved untouched).
