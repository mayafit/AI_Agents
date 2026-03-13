# Story 8.5: Research Per-Agent Enforcement Hooks

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want per-agent enforcement mechanisms researched and implemented where agents support them,
So that skill compliance is enforced at multiple layers.

## Acceptance Criteria

1. **Given** Claude Code supports hooks (pre-tool-use, post-tool-use),
   **When** enforcement hooks are researched,
   **Then** a technical note documents: hook types, how they can verify manifest was read, implementation approach,
   **And** if feasible, a Claude Code hook is implemented

2. **Given** other agents may have enforcement,
   **When** research is conducted,
   **Then** findings document which agents support hooks/verification and which don't,
   **And** recommendations for future implementation

## Tasks / Subtasks

- [ ] Task 1: Research Claude Code hooks (AC: #1)
  - [ ] 1.1: Document Claude Code hook system: Hooks are configured in settings files (`.claude/settings.json` for project-level, `~/.claude/settings.json` for user-level) as JSON objects with event matchers and command arrays — NOT shell scripts in a hooks/ directory.
  - [ ] 1.2: Document available hook types: `pre-tool-use`, `post-tool-use`, and any others
  - [ ] 1.3: Research how hooks are triggered — are they shell scripts? What arguments do they receive?
  - [ ] 1.4: Determine if a hook can detect whether MANIFEST.yaml has been read in the current session
  - [ ] 1.5: Evaluate feasibility: Can a hook script check if skills were loaded? What state is available to hooks?
  - [ ] 1.6: Document limitations: hooks may run per-tool-call (performance concern), may not have access to conversation state

- [ ] Task 2: Prototype Claude Code enforcement hook (AC: #1)
  - [ ] 2.1: If feasible, design a hook script that verifies MANIFEST.yaml was read
  - [ ] 2.2: Determine hook deployment: should the installer add hook entries to `.claude/settings.json` (project-level)? Or `~/.claude/settings.json` (user-level)? Note: modifying settings.json requires JSON merge logic similar to Story 9.2.
  - [ ] 2.3: Implement the hook as a shell script (cross-platform: bash for Linux/macOS, consider Windows compatibility)
  - [ ] 2.4: If NOT feasible, document why and recommend deferral with specific blockers

- [ ] Task 3: Research other agent enforcement mechanisms (AC: #2)
  - [ ] 3.1: **Cursor**: Research if Cursor supports any hook, plugin, or extension mechanism for enforcing instruction compliance
  - [ ] 3.2: **GitHub Copilot**: Research Copilot's extension model — can custom checks be added to agent mode?
  - [ ] 3.3: **Cline**: Research Cline's custom instruction enforcement — does it support hooks or verification beyond `.clinerules`?
  - [ ] 3.4: **Kilocode**: Research Kilocode's configuration system for enforcement capabilities
  - [ ] 3.5: **Gemini Code Assist**: Research Google's Gemini agent enforcement model
  - [ ] 3.6: **Antigravity**: Research Deepmind's Antigravity agent hook/enforcement model
  - [ ] 3.7: **BMAD agents**: Document that critical_actions (Story 8.3) serves as the enforcement mechanism for all 11 BMAD agents

- [ ] Task 4: Write technical note document (AC: #1, #2)
  - [ ] 4.1: Create `docs/technical-notes/enforcement-hooks-research.md` with findings
  - [ ] 4.2: Structure the document with sections per agent
  - [ ] 4.3: Include a summary table: Agent | Hook Support | Mechanism | Status (implemented/deferred/not-available)
  - [ ] 4.4: Include recommendations section with prioritized next steps
  - [ ] 4.5: If a Claude Code hook was implemented, document its installation and configuration

- [ ] Task 5: Update installer if hook is implemented (AC: #1)
  - [ ] 5.1: If a Claude Code hook is implemented, add deployment logic to `lib/installer.js` or a new module
  - [ ] 5.2: The hook should be installed when skills are installed for Claude Code
  - [ ] 5.3: The hook should be removed when all skills are uninstalled from Claude Code

## Dev Notes

### Architecture Compliance

- **Research-first story:** Primary output is a technical note document. Code changes only if Claude Code hooks are feasible and implementable
- **No core modifications to existing agents:** Any hook implementation adds files, does not modify existing agent configurations
- **Cross-platform:** Any implemented hook must work on Linux, macOS, and Windows (or document platform limitations)

### Critical Guardrails

- Do NOT modify any agent's instruction files or injection logic — that is Stories 8.1 and 8.2
- Do NOT add npm dependencies for hook implementation — use shell scripts or Node.js scripts that run standalone
- Do NOT implement hooks for agents that don't support them — document the gap and recommend deferral
- Research must be based on current (2026) agent documentation, not assumptions
- If Claude Code hook API is uncertain, prototype cautiously and document assumptions

### Project Structure Notes

- **New file (required):** `docs/technical-notes/enforcement-hooks-research.md` — research findings document
- **New file (conditional):** `skills/hooks/verify-manifest.sh` or similar — only if Claude Code hook is implemented
- **File to modify (conditional):** `lib/installer.js` — only if hook deployment is added
- **No changes to:** `lib/agents.js`, `lib/bmad.js`, `lib/bmad-customizations/`

### References

- [Source: lib/agents.js#L17-L38] — Claude Code agent entry (hook directory conventions)
- [Source: lib/installer.js#L110-L161] — Instruction injection (context for what hooks would supplement)
- Claude Code documentation: hooks configured in `.claude/settings.json` or `~/.claude/settings.json`

### Dependencies
- **Recommended order:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6

### Scope Note
- This is a research spike. If hooks are NOT feasible, the deliverable is the technical note only. This is acceptable — research is a valid phase of architecture work.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
