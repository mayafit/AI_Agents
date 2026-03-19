# Story 8.5: Research Per-Agent Enforcement Hooks

Status: done

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

- [x] Task 1: Research Claude Code hooks (AC: #1)
  - [x] 1.1: Document Claude Code hook system: Hooks are configured in settings files (`.claude/settings.json` for project-level, `~/.claude/settings.json` for user-level) as JSON objects with event matchers and command arrays — NOT shell scripts in a hooks/ directory.
  - [x] 1.2: Document available hook types: `pre-tool-use`, `post-tool-use`, and any others
  - [x] 1.3: Research how hooks are triggered — are they shell scripts? What arguments do they receive?
  - [x] 1.4: Determine if a hook can detect whether MANIFEST.yaml has been read in the current session
  - [x] 1.5: Evaluate feasibility: Can a hook script check if skills were loaded? What state is available to hooks?
  - [x] 1.6: Document limitations: hooks may run per-tool-call (performance concern), may not have access to conversation state

- [x] Task 2: Prototype Claude Code enforcement hook (AC: #1)
  - [x] 2.1: If feasible, design a hook script that verifies MANIFEST.yaml was read
  - [x] 2.2: Determine hook deployment: should the installer add hook entries to `.claude/settings.json` (project-level)? Or `~/.claude/settings.json` (user-level)? Note: modifying settings.json requires JSON merge logic similar to Story 9.2.
  - [x] 2.3: Implement the hook as a shell script (cross-platform: bash for Linux/macOS, consider Windows compatibility)
  - [x] 2.4: If NOT feasible, document why and recommend deferral with specific blockers

- [x] Task 3: Research other agent enforcement mechanisms (AC: #2)
  - [x] 3.1: **Cursor**: Research if Cursor supports any hook, plugin, or extension mechanism for enforcing instruction compliance
  - [x] 3.2: **GitHub Copilot**: Research Copilot's extension model — can custom checks be added to agent mode?
  - [x] 3.3: **Cline**: Research Cline's custom instruction enforcement — does it support hooks or verification beyond `.clinerules`?
  - [x] 3.4: **Kilocode**: Research Kilocode's configuration system for enforcement capabilities
  - [x] 3.5: **Gemini Code Assist**: Research Google's Gemini agent enforcement model
  - [x] 3.6: **Antigravity**: Research Deepmind's Antigravity agent hook/enforcement model
  - [x] 3.7: **BMAD agents**: Document that critical_actions (Story 8.3) serves as the enforcement mechanism for all 11 BMAD agents

- [x] Task 4: Write technical note document (AC: #1, #2)
  - [x] 4.1: Create `docs/technical-notes/enforcement-hooks-research.md` with findings
  - [x] 4.2: Structure the document with sections per agent
  - [x] 4.3: Include a summary table: Agent | Hook Support | Mechanism | Status (implemented/deferred/not-available)
  - [x] 4.4: Include recommendations section with prioritized next steps
  - [x] 4.5: If a Claude Code hook was implemented, document its installation and configuration

- [x] Task 5: Update installer if hook is implemented (AC: #1)
  - [x] 5.1: If a Claude Code hook is implemented, add deployment logic to `lib/installer.js` or a new module
  - [x] 5.2: The hook should be installed when skills are installed for Claude Code
  - [x] 5.3: The hook should be removed when all skills are uninstalled from Claude Code

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
Claude Opus 4.6 (1M context)

### Debug Log References
- All 14 tests pass (enforcement-hooks.test.js)
- All existing tests pass: instruction-injection (24/24), agent-injection-strategy (8/8), bmad-extension (23/23)

### Completion Notes List
- Researched Claude Code hook system: 21 event types, 4 hook types (command, http, prompt, agent), JSON stdin/stdout protocol
- Researched 6 external agents: Cursor (full hooks, beta), GitHub Copilot (full hooks, preview), Gemini CLI (full hooks, GA), Cline (partial), Kilocode (partial), Antigravity (not available — ToS restricts third-party agents)
- Documented BMAD agents' existing critical_actions enforcement (Story 8.3)
- Implemented SessionStart hook prototype (`lib/hooks/claude-code/verify-manifest.js`) — standalone Node.js script, no dependencies, cross-platform
- Decision: SessionStart context injection chosen over PreToolUse transcript parsing due to zero per-tool-call overhead and simpler cross-platform support
- Deployment: project-level `.claude/settings.json` (not user-level) because skills are project-specific
- Added `deployClaudeCodeHook()` and `removeClaudeCodeHook()` to installer.js with JSON merge logic
- Hook auto-deploys when skills installed for claude-code, auto-removes when all skills uninstalled
- Created comprehensive technical note at `docs/technical-notes/enforcement-hooks-research.md`

### Change Log
- 2026-03-17: Completed Story 8.5 — enforcement hooks research, Claude Code hook prototype, installer integration

### File List
- `docs/technical-notes/enforcement-hooks-research.md` (NEW) — research findings document with per-agent analysis
- `lib/hooks/claude-code/verify-manifest.js` (NEW) — SessionStart hook script for MANIFEST.yaml enforcement
- `lib/installer.js` (MODIFIED) — added deployClaudeCodeHook(), removeClaudeCodeHook(), includesClaudeCode() functions; integrated hook deploy/remove into installSkill() and uninstallSkill()
- `test/enforcement-hooks.test.js` (NEW) — 14 tests covering hook deployment, removal, and script behavior
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED) — story status: ready-for-dev → in-progress → review
- `_bmad-output/implementation-artifacts/8-5-per-agent-enforcement-hooks-research.md` (MODIFIED) — story file updates
