# Story 8.1: Move Instruction Injection to TOP Priority Position

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want the MA-AGENTS-START instruction block injected at the TOP of agent instruction files (after any file headers),
So that skills have highest priority during LLM context processing.

## Acceptance Criteria

1. **Given** installer runs for any markdown-based agent,
   **When** instruction block is injected,
   **Then** block is placed at TOP after file headers (YAML frontmatter),
   **And** skipPatterns from agent's injectionStrategy in agents.js are respected

2. **Given** instruction file already has MA-AGENTS-START block,
   **When** installer runs again,
   **Then** existing block is found and replaced in-place,
   **And** no duplicate blocks created

3. **Given** instruction file has no existing ma-agents block,
   **When** installer injects for first time,
   **Then** block inserted after skipped headers but before all other content

## Tasks / Subtasks

- [x] Task 1: Implement header-skip logic in `updateAgentInstructions()` (AC: #1, #3)
  - [x] 1.1: In `lib/installer.js` at line 110, modify `updateAgentInstructions()` to accept and read `agent.injectionStrategy` (defaults to `{ position: 'top', skipPatterns: [] }` if not present)
  - [x] 1.2: Create a helper function `findInsertionPoint(content, skipPatterns)` that returns the character index after all skipped headers
  - [x] 1.3: For skipPattern `'---'`, implement YAML frontmatter detection: find the opening `---` on line 1 (or after leading whitespace), then find the closing `---`, skip past the entire block including trailing newline
  - [x] 1.4: Return insertion index as the position immediately after all skipped headers

- [x] Task 2: Change non-BMAD branches from append to top-insert (AC: #1, #3)
  - [x] 2.1: Understand the three-branch structure in `updateAgentInstructions()` (lines 138-156):
    - **IF branch** (lines 141-143): File exists AND has existing MA-AGENTS block → regex replace in-place. NO CHANGE needed.
    - **ELSE branch** (line 145): File exists, NO existing block → currently appends. CHANGE to top-insert.
    - **ELSE-IF branch** (lines 147-153): File does NOT exist AND agent is BMAD → skip (guard clause). NO CHANGE needed.
    - **Final ELSE** (lines 154-155): File does NOT exist AND agent is NOT BMAD → creates new file. CHANGE to top-insert.
  - [x] 2.2: At line 145, replace `content += wrappedInstruction` with top-insertion using `findInsertionPoint()`
  - [x] 2.3: Splice `wrappedInstruction` into content: `content = content.slice(0, insertIdx) + wrappedInstruction + content.slice(insertIdx)`
  - [x] 2.4: At lines 154-155, replace `content = wrappedInstruction` with top-insertion (for new files, functionally identical but keeps logic consistent)
  - [x] 2.5: Ensure a blank line separates the injected block from subsequent content in both branches

- [x] Task 3: Preserve existing replace-in-place behavior (AC: #2)
  - [x] 3.1: Verify the existing regex replacement at line 141-143 (`content.replace(regex, wrappedInstruction.trim())`) still works correctly — this handles the update scenario
  - [x] 3.2: No changes needed to the IF branch (lines 141-143). Both the ELSE branch (line 145) and Final ELSE (lines 154-155) change to top-insert
  - [x] 3.3: Add a test scenario: inject once (goes to top), then run again (replaces in-place, stays at top)

- [x] Task 4: Handle edge cases (AC: #1, #3)
  - [x] 4.1: Empty file — insert wrappedInstruction as sole content
  - [x] 4.2: File with only YAML frontmatter — insert after frontmatter
  - [x] 4.3: File with no frontmatter — insert at position 0
  - [x] 4.4: File with multiple `---` (e.g., horizontal rules later in file) — only skip the frontmatter pair at the very beginning, not later `---` lines
  - [x] 4.5: BMAD agent files (.md) — same logic applies; frontmatter skip works the same way
  - [x] 4.6: Cline dual instruction files — Cline has `instructionFiles: ['.cline/clinerules.md', '.clinerules']`. Both files receive injection. The `.clinerules` file (no .md extension) is treated identically — same `findInsertionPoint()` logic applies. Verify both files get correct top-insertion.

- [x] Task 5: Manual verification (AC: #1, #2, #3)
  - [x] 5.1: Create a test `.md` file with YAML frontmatter + existing content, run injection, verify block appears after frontmatter and before content
  - [x] 5.2: Run injection a second time on the same file, verify no duplicates and block stays in position
  - [x] 5.3: Test with a file that has no frontmatter, verify block at position 0
  - [x] 5.4: Test with BMAD agent instruction file (`_bmad/bmm/agents/sre.md`)

## Dev Notes

### Architecture Compliance

- **Single module change:** Only `lib/installer.js` is modified in this story
- **Agent-agnostic:** The installer reads `injectionStrategy` from the agent object but does NOT hardcode agent-specific logic. If `injectionStrategy` is missing, it defaults to `{ position: 'top', skipPatterns: [] }`
- **Dependency on Story 8.2:** Story 8.2 adds the `injectionStrategy` property to agents.js. This story should implement the logic that reads it, with a sensible default so it works even before 8.2 is complete
- **path.join():** Not relevant here (operating on file content, not paths)

### Critical Guardrails

- Do NOT change the IF branch (lines 141-143) that handles replace-in-place — it already works correctly
- Do NOT hardcode agent names or agent-specific logic in installer.js
- Do NOT modify agents.js in this story (that is Story 8.2)
- The `findInsertionPoint()` function must handle the `---` pattern as a YAML frontmatter block delimiter (between opening and closing `---`), NOT as a single-line skip
- Ensure backward compatibility: if `injectionStrategy` is undefined on an agent, default to top insertion with no skip patterns

### Project Structure Notes

- **File to modify:** `lib/installer.js` — specifically the `updateAgentInstructions()` function starting at line 110
- **Lines of interest:**
  - Lines 130-132: marker definitions (`MA-AGENTS-START`, `MA-AGENTS-END`, `wrappedInstruction`)
  - Lines 141-143: existing regex replace (IF branch — keep as-is)
  - Line 145: current append logic (ELSE branch — change to top-insert)
  - Lines 147-153: BMAD guard clause (ELSE-IF — keep as-is, skips BMAD files not yet deployed)
  - Lines 154-155: new non-BMAD file creation (Final ELSE — change to top-insert)
- **New helper:** `findInsertionPoint(content, skipPatterns)` — add as a private function in installer.js

### References

- [Source: lib/installer.js#L110-L161] — `updateAgentInstructions()` function
- [Source: lib/agents.js#L17-L253] — Agent registry (injectionStrategy will be added by Story 8.2)

### Dependencies
- **Must be implemented BEFORE Story 8.2** — This story implements the `findInsertionPoint()` logic that reads `injectionStrategy`. Story 8.2 adds the data. This story uses a sensible default (`{ position: 'top', skipPatterns: [] }`) so it works before 8.2 is complete.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- No debug issues encountered

### Completion Notes List
- Implemented `findInsertionPoint(content, skipPatterns)` helper function in `lib/installer.js` that detects YAML frontmatter (`---` blocks) and returns insertion index after them
- Changed ELSE branch (existing file, no block) from append (`content += wrappedInstruction`) to top-insert using `findInsertionPoint()`
- Changed Final ELSE branch (new non-BMAD file) to use consistent top-insert logic
- IF branch (replace-in-place) left unchanged per guardrails — regex replacement still works correctly
- BMAD guard clause left unchanged — BMAD files still skipped when not yet deployed
- Default `injectionStrategy` is `{ position: 'top', skipPatterns: [] }` when not present on agent, ensuring backward compatibility before Story 8.2
- Exported `findInsertionPoint` and `_testUpdateAgentInstructions` for test access
- Created 24 automated tests covering: findInsertionPoint unit tests (11), integration tests for top-insertion and replace-in-place (5), edge case tests (7), extra integration coverage (1)
- All manual verification scenarios passed: frontmatter skip, no-duplicate on re-run, no-frontmatter top-insert, BMAD skip, Cline dual files
- Code review follow-ups addressed: H1 (dead code removed), H2 (leading blank line fixed), M1 (double newline fixed), M2 (Cline dual-file test added), M3 (BMAD agent tests added), M4 (File List updated), L1 (skipPatterns integration test added), L2 (test 4.3 added)

### File List
- `lib/installer.js` — Added `findInsertionPoint()` helper, changed append to top-insert in ELSE/Final-ELSE branches, exported new functions
- `test/instruction-injection.test.js` — New test file with 24 tests for story 8.1
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Status tracking updates
- `_bmad-output/implementation-artifacts/8-1-move-instruction-injection-to-top.md` — Story file updates

### Change Log
- 2026-03-17: Implemented Story 8.1 — moved instruction injection from append to top-insert position, with YAML frontmatter skip support via `findInsertionPoint()`. All 24 tests pass, no regressions.
- 2026-03-17: Addressed code review findings — 6 items resolved (H1, H2, M1, M2, M3, M4) plus 2 low-priority items (L1, L2). L3 acknowledged as accepted trade-off.
