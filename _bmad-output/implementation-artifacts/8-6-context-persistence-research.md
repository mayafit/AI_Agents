# Story 8.6: Research Context Persistence Strategies

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want context persistence strategies researched to ensure skills survive LLM context compression,
So that long sessions don't lose skill directives.

## Acceptance Criteria

1. **Given** BMAD supports sidecar memory (hasSidecar/sidecar-folder),
   **When** context persistence is researched,
   **Then** a technical note documents: how sidecar memory works, whether it can store skill state, restoration patterns,
   **And** recommendations

2. **Given** research is complete,
   **When** findings are documented,
   **Then** clear recommendation exists for whether to implement persistence now or defer

## Tasks / Subtasks

- [ ] Task 1: Research LLM context compression behavior (AC: #1)
  - [ ] 1.1: Document how major LLM agents handle context window limits — what gets dropped first?
  - [ ] 1.2: Research Claude Code's context management: does it compress/summarize earlier conversation? Does system prompt persist? Do instruction files get re-read?
  - [ ] 1.3: Research Cursor/Copilot/Cline context handling — how do long sessions affect instruction retention?
  - [ ] 1.4: Identify which parts of the injected MA-AGENTS block are most at risk of being lost during compression
  - [ ] 1.5: Document the difference between system-level instructions (always retained) vs. conversation-level context (compressed)

- [ ] Task 2: Research BMAD sidecar memory system (AC: #1)
  - [ ] 2.1: Document the BMAD `hasSidecar` and `sidecar-folder` configuration options
  - [ ] 2.2: Research how BMAD agents use sidecar memory files — what format, when read, when written
  - [ ] 2.3: Evaluate whether sidecar memory can store "skills loaded" state (e.g., a list of skills that were read in the current session)
  - [ ] 2.4: Evaluate whether sidecar memory can trigger skill re-reads when context is compressed
  - [ ] 2.5: Document any limitations: does sidecar memory persist across sessions? Across agent switches?

- [ ] Task 3: Research re-injection strategies (AC: #1, #2)
  - [ ] 3.1: **MANIFEST re-read pattern:** Can agents be instructed to re-read MANIFEST.yaml periodically? What triggers would cause this?
  - [ ] 3.2: **Hook-based re-injection:** Can pre-tool-use hooks (Story 8.5) serve as a re-injection point? E.g., hook checks if skills are loaded, re-injects if not
  - [ ] 3.3: **always_load reinforcement:** Research whether `always_load: true` skills can include self-reinforcing directives (e.g., "Re-read this file if you notice you've forgotten these rules")
  - [ ] 3.4: **Critical_actions reinforcement:** For BMAD agents, research whether critical_actions are re-evaluated on context compression or only on initial activation
  - [ ] 3.5: **Session bookmarks:** Research whether any agent supports "bookmarking" key instructions to survive compression

- [ ] Task 4: Evaluate persistence approaches (AC: #2)
  - [ ] 4.1: Create a comparison matrix of approaches: BMAD sidecar, hook re-injection, self-reinforcing directives, periodic re-reads
  - [ ] 4.2: Evaluate each approach on: feasibility, complexity, agent coverage (which agents support it), reliability
  - [ ] 4.3: Identify which approach works across the most agents (IDE + BMAD)
  - [ ] 4.4: Determine if any approach requires changes to the skill file format or MANIFEST.yaml schema

- [ ] Task 5: Write technical note with recommendation (AC: #1, #2)
  - [ ] 5.1: Create `docs/technical-notes/context-persistence-research.md`
  - [ ] 5.2: Structure with sections: Problem Statement, Context Compression Behavior, BMAD Sidecar Analysis, Re-Injection Strategies, Comparison Matrix, Recommendation
  - [ ] 5.3: The Recommendation section must include a clear **implement now** vs **defer** decision with rationale
  - [ ] 5.4: If recommending implementation, include a proposed approach with estimated scope (new story? new epic?)
  - [ ] 5.5: If recommending deferral, document what conditions would trigger revisiting (e.g., "revisit when agents expose context-loss callbacks")

## Dev Notes

### Architecture Compliance

- **Research-only story:** No code changes expected. Output is a technical note document
- **Informs future architecture:** Findings will shape whether Epic 9+ includes context persistence features
- **Cross-agent scope:** Research covers both IDE agents (Claude Code, Cursor, Copilot, Cline, Kilocode, Gemini, Antigravity) and BMAD agents

### Critical Guardrails

- Do NOT implement any persistence mechanism in this story — research and recommend only
- Do NOT modify any existing files (installer.js, agents.js, bmad.js)
- Do NOT create new code modules — only documentation
- Research should be grounded in actual agent behavior, not theoretical capabilities
- If testing is needed to validate assumptions, document the test methodology and results

### Project Structure Notes

- **New file (required):** `docs/technical-notes/context-persistence-research.md` — research findings and recommendation
- **No code changes**
- **No modifications to existing files**

### References

- [Source: lib/bmad.js#L59-L164] — `applyCustomizations()` pipeline (context for how BMAD agents are configured)
- [Source: lib/installer.js#L116-L128] — Planning instruction content (the text that must persist in context)
- [Source: lib/agents.js] — Agent registry (for understanding which agents need persistence)
- Story 8.3 (critical_actions for BMAD agents) — related enforcement mechanism
- Story 8.5 (enforcement hooks) — related hook-based re-injection possibility

### Dependencies
- **Recommended order:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
