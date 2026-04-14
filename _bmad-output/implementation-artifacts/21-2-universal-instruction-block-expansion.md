# Story 21.2: Universal Per-Tool Instruction Block Expansion

Status: backlog

## Story

As a **chief architect**,
I want the existing `<!-- MA-AGENTS-START -->` injection block to enforce text-vs-file discipline and BMAD phase boundaries for every install (regardless of profile),
So that all coding agents — even Claude on the web — stop dumping random files as responses and stop skipping BMAD planning to start coding.

## Acceptance Criteria

1. New template file `lib/templates/instruction-block-universal.template.md` exists and contains, in addition to the current MANIFEST loading instruction:
   - A "Respond in TEXT vs. create FILES" rules section with concrete keyword triggers — file-action keywords (`create`, `write`, `generate`, `build`, `implement`) and text-response keywords (`what do you think`, `how should we`, `discuss`, `opinion`)
   - An "if unsure, respond in text" default rule
   - A "never create `response.md` or `output.md` as a reply" rule
   - A BMAD phase discipline rule: respect the declared phase; do not skip ahead to implementation during planning
   - A "confirm file paths before writing" rule
2. The template contains `{{MANIFEST_PATH}}` exactly once as a placeholder; no agent-specific paths are hardcoded in the template source.
3. A new function `composeInstructionBlock({ profile, manifestPath })` in `lib/installer.js` reads the universal template, stamps `{{MANIFEST_PATH}}`, and returns the content. When `profile === 'on-prem'`, it appends the on-prem template content (Story 21.6 wires that file; this story stubs the call site with a graceful fallback if the on-prem template is absent).
4. The injection function in `lib/installer.js` that writes per-tool instruction files (the existing marker-based path) calls `composeInstructionBlock` and emits the content within `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers.
5. For every existing markdown-injection agent (Claude Code, Cline, Roo Code rules, Cursor, Kilocode, Copilot, Gemini), a fresh install produces an instruction file containing the universal block. Existing user content outside the markers is preserved byte-for-byte (NFR5, NFR46).
6. Two consecutive installs with the same profile and project state produce byte-identical content within the marker block (NFR46).
7. The block must NOT mention `/no_think`, `str_replace_editor`, `~/.claude/`, or any local-LLM-specific concept — those belong in the on-prem template (Story 21.6). Verified by grep on the rendered standard-profile output.
8. **Upgrade-safety (marker-block hand-edit detection).** When `npx ma-agents install` runs against an already-installed project, before overwriting the content inside `<!-- MA-AGENTS-START -->`/`<!-- MA-AGENTS-END -->` markers the installer compares the existing marker-block content against the ma-agents-generated content for the project's previously recorded profile+version. If the existing content differs from what ma-agents would have produced (i.e., the user hand-edited inside the markers):
   - **Interactive mode:** the installer surfaces a diff of the in-marker changes and requires explicit confirmation before proceeding to overwrite.
   - **`--yes` mode:** the prompt is skipped but the installer emits a visible migration warning line that CI will capture, in the exact format `WARNING: ma-agents marker-block content modified since last install — overwriting. Previous content backed up to <path>.backup-<timestamp>`.
   - **Backup:** before overwriting, the installer writes a backup sibling file alongside the target — same directory, same basename, suffix `.backup-<ISO-timestamp>` (example: `CLAUDE.md.backup-2026-04-14T12-34-56Z`). Only the portion between (and including) the markers is written to the backup; the rest of the target file is untouched by the installer and therefore needs no backup. Rationale: hand-edits inside markers represent work the user expects to keep; silent overwrite is a data-loss regression.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/templates/instruction-block-universal.template.md` (AC #1, #2, #7)
- [ ] Task 2: Implement `composeInstructionBlock({ profile, manifestPath })` in `lib/installer.js` (AC #3)
  - [ ] 2.1 Read universal template via existing `fs.readFile` pattern
  - [ ] 2.2 Stamp `{{MANIFEST_PATH}}`
  - [ ] 2.3 If `profile === 'on-prem'` and `lib/templates/instruction-block-onprem.template.md` exists, append its content; otherwise return universal only (Story 21.6 ships the on-prem template)
- [ ] Task 3: Wire `composeInstructionBlock` into the existing per-tool injection function so the marker block is rewritten with composed content (AC #4, #5)
- [ ] Task 4: Verify additive behavior — content outside markers preserved across runs (AC #5, #6)
- [ ] Task 5: Tests in `test/instruction-block.test.js`
  - [ ] 5.1 Universal template stamps manifest path correctly
  - [ ] 5.2 `composeInstructionBlock({ profile: 'standard' })` excludes on-prem content even when on-prem template file exists
  - [ ] 5.3 `composeInstructionBlock({ profile: 'on-prem' })` includes on-prem content when present, falls back gracefully when absent (this story may stub absence — Story 21.6 will ship the file)
  - [ ] 5.4 Idempotency: two installs produce byte-identical marker-block content
  - [ ] 5.5 No on-prem-specific strings (`/no_think`, `str_replace_editor`, `~/.claude/`) appear in standard-profile output
  - [ ] 5.6 User content outside markers preserved across runs
- [ ] Task 6 (upgrade-safety): Marker-block hand-edit detection, backup, and warning (AC #8)
  - [ ] 6.1 Before overwrite, compare existing in-marker content against expected ma-agents-generated content for the persisted profile+version
  - [ ] 6.2 On drift: interactive prompt shows a diff and requires confirmation; `--yes` bypasses the prompt and emits the pinned WARNING line so CI captures it
  - [ ] 6.3 Write `<target>.backup-<ISO-timestamp>` alongside the target, containing only the original marker-block region (including the marker lines themselves)
  - [ ] 6.4 Test: clean marker block → no warning, no backup file; hand-edited marker block + `--yes` → WARNING emitted and backup file exists with original content

## Dev Notes

### Architecture Compliance

- **Decision P3-3**: This story implements the "Universal layer" half of the two-layer model. The on-prem layer ships in Story 21.6.
- **NFR44**: Standard profile must produce no on-prem-specific output. AC #7 + Test 5.5 enforce this.
- **NFR46**: Marker-block content is deterministic given profile + project state.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/instruction-block-universal.template.md` | CREATE |
| `lib/installer.js` | MODIFY — add `composeInstructionBlock`; wire into existing marker-based injection |
| `test/instruction-block.test.js` | CREATE |

### Dependencies

- Story 21.1 must be merged first — `composeInstructionBlock` reads `profile` from the resolved value passed in; injection call sites obtain it via `getProfile(projectRoot)` from `lib/profile.js`.

### Out of Scope

- On-prem template content (Story 21.6 ships `lib/templates/instruction-block-onprem.template.md`)
- `.roomodes`, `AGENTS.md`, `.clinerules` per-tool templates (Stories 21.3–21.5)
- BMAD persona phase prefix (Story 21.7)

### Testing Standards

Match `test/profile.test.js` (created in Story 21.1) for framework and isolation patterns.

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
- 2026-04-14: Story created (Epic 21, Story 21.2)
- 2026-04-14: Added AC #8 for upgrade-safety — installer detects hand-edited marker content, backs it up, warns on --yes override (Finding #15, corrective plan step 3).
