# Story 8.1: Move Instruction Injection to TOP Priority Position

Status: ready-for-dev

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

- [ ] Task 1: Implement header-skip logic in `updateAgentInstructions()` (AC: #1, #3)
  - [ ] 1.1: In `lib/installer.js` at line 110, modify `updateAgentInstructions()` to accept and read `agent.injectionStrategy` (defaults to `{ position: 'top', skipPatterns: [] }` if not present)
  - [ ] 1.2: Create a helper function `findInsertionPoint(content, skipPatterns)` that returns the character index after all skipped headers
  - [ ] 1.3: For skipPattern `'---'`, implement YAML frontmatter detection: find the opening `---` on line 1 (or after leading whitespace), then find the closing `---`, skip past the entire block including trailing newline
  - [ ] 1.4: Return insertion index as the position immediately after all skipped headers

- [ ] Task 2: Change non-BMAD branches from append to top-insert (AC: #1, #3)
  - [ ] 2.1: Understand the three-branch structure in `updateAgentInstructions()` (lines 138-156):
    - **IF branch** (lines 141-143): File exists AND has existing MA-AGENTS block → regex replace in-place. NO CHANGE needed.
    - **ELSE branch** (line 145): File exists, NO existing block → currently appends. CHANGE to top-insert.
    - **ELSE-IF branch** (lines 147-153): File does NOT exist AND agent is BMAD → skip (guard clause). NO CHANGE needed.
    - **Final ELSE** (lines 154-155): File does NOT exist AND agent is NOT BMAD → creates new file. CHANGE to top-insert.
  - [ ] 2.2: At line 145, replace `content += wrappedInstruction` with top-insertion using `findInsertionPoint()`
  - [ ] 2.3: Splice `wrappedInstruction` into content: `content = content.slice(0, insertIdx) + wrappedInstruction + content.slice(insertIdx)`
  - [ ] 2.4: At lines 154-155, replace `content = wrappedInstruction` with top-insertion (for new files, functionally identical but keeps logic consistent)
  - [ ] 2.5: Ensure a blank line separates the injected block from subsequent content in both branches

- [ ] Task 3: Preserve existing replace-in-place behavior (AC: #2)
  - [ ] 3.1: Verify the existing regex replacement at line 141-143 (`content.replace(regex, wrappedInstruction.trim())`) still works correctly — this handles the update scenario
  - [ ] 3.2: No changes needed to the IF branch (lines 141-143). Both the ELSE branch (line 145) and Final ELSE (lines 154-155) change to top-insert
  - [ ] 3.3: Add a test scenario: inject once (goes to top), then run again (replaces in-place, stays at top)

- [ ] Task 4: Handle edge cases (AC: #1, #3)
  - [ ] 4.1: Empty file — insert wrappedInstruction as sole content
  - [ ] 4.2: File with only YAML frontmatter — insert after frontmatter
  - [ ] 4.3: File with no frontmatter — insert at position 0
  - [ ] 4.4: File with multiple `---` (e.g., horizontal rules later in file) — only skip the frontmatter pair at the very beginning, not later `---` lines
  - [ ] 4.5: BMAD agent files (.md) — same logic applies; frontmatter skip works the same way
  - [ ] 4.6: Cline dual instruction files — Cline has `instructionFiles: ['.cline/clinerules.md', '.clinerules']`. Both files receive injection. The `.clinerules` file (no .md extension) is treated identically — same `findInsertionPoint()` logic applies. Verify both files get correct top-insertion.

- [ ] Task 5: Manual verification (AC: #1, #2, #3)
  - [ ] 5.1: Create a test `.md` file with YAML frontmatter + existing content, run injection, verify block appears after frontmatter and before content
  - [ ] 5.2: Run injection a second time on the same file, verify no duplicates and block stays in position
  - [ ] 5.3: Test with a file that has no frontmatter, verify block at position 0
  - [ ] 5.4: Test with BMAD agent instruction file (`_bmad/bmm/agents/sre.md`)

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

### Debug Log References

### Completion Notes List

### File List
