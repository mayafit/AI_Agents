# Enforcement Hooks Research — Technical Note

**Story:** 8.5 — Per-Agent Enforcement Hooks Research
**Date:** 2026-03-17
**Status:** Complete

## Executive Summary

This technical note documents research into per-agent enforcement hooks across all supported AI coding agents. The goal is to determine which agents support runtime enforcement beyond instruction injection (Stories 8.1–8.2) and BMAD critical_actions (Story 8.3).

**Key Finding:** Claude Code, Cursor, GitHub Copilot, and Gemini CLI all support hook-based enforcement. A Claude Code prototype hook has been implemented. Cline and Kilocode have partial support. Antigravity's enforcement model is currently unavailable for integration.

## Agent Enforcement Summary

| Agent | Hook Support | Mechanism | Enforcement Level | Status |
|-------|-------------|-----------|-------------------|--------|
| **Claude Code** | Full | `.claude/settings.json` hooks — 21 event types | Runtime verify/block | **Prototype implemented** |
| **Cursor** | Full (beta) | `.cursor/hooks/` — pre/post agent execution | Runtime observe/block | Deferred (beta API) |
| **GitHub Copilot** | Full | `.github/hooks/hooks.json` — preToolUse, postToolUse | Runtime verify/block | Deferred (preview) |
| **Gemini CLI** | Full | `~/.gemini/hooks/` — BeforeTool, SessionStart | Runtime verify/block | Deferred (CLI-only) |
| **Cline** | Partial | `.clinerules/hooks/` directory — workspace monitoring | Limited automation | Deferred (limited docs) |
| **Kilocode** | Partial | Agent hooks via AGENTS.md — file-save triggers | Follow-up automation | Deferred (limited scope) |
| **Antigravity** | None documented | No public hook API; ToS restricts third-party agent integration | N/A | **Not available** |
| **BMAD Agents (11)** | N/A | `critical_actions` in `.customize.yaml` — instruction-level | Instruction enforcement | **Implemented (Story 8.3)** |

## Detailed Agent Research

### 1. Claude Code (Anthropic)

#### Hook System Overview

Claude Code provides the most comprehensive hook system of all researched agents, with **21 distinct hook events** configurable via JSON settings files.

**Configuration Locations:**

| Location | Scope | Shared |
|----------|-------|--------|
| `~/.claude/settings.json` | User (all projects) | No |
| `.claude/settings.json` | Project | Yes (committed to git) |
| `.claude/settings.local.json` | Project (local only) | No (gitignored) |

**Configuration Format:**
```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "regex_pattern",
        "hooks": [
          {
            "type": "command",
            "command": "path/to/script.sh"
          }
        ]
      }
    ]
  }
}
```

#### Available Hook Events (relevant subset)

| Event | Fires When | Can Block | Matcher Field |
|-------|-----------|----------|---------------|
| `SessionStart` | Session begins/resumes/compacts | No | `startup`, `resume`, `compact` |
| `PreToolUse` | Before any tool executes | Yes | Tool name (regex) |
| `PostToolUse` | After tool succeeds | No | Tool name (regex) |
| `UserPromptSubmit` | User submits prompt | Yes | None |
| `Stop` | Claude finishes responding | Yes | None |

#### Hook Types

1. **Command** (`type: "command"`) — Executes shell script, receives JSON on stdin, returns exit code + stdout
2. **HTTP** (`type: "http"`) — POSTs event JSON to endpoint, receives JSON response
3. **Prompt** (`type: "prompt"`) — Single-turn LLM call (Haiku) for judgment-based decisions
4. **Agent** (`type: "agent"`) — Spawns subagent with tool access for multi-step verification

#### Hook Input/Output Protocol

**Input** (JSON on stdin):
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/root",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": { "file_path": "..." }
}
```

**Output** (exit codes):
- Exit 0: Allow action; stdout text injected into context (SessionStart only)
- Exit 2: Block action; stderr becomes Claude's feedback
- Other: Allow; stderr logged in verbose mode

**Structured output** (JSON on stdout):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "MANIFEST.yaml has not been read yet"
  }
}
```

#### MANIFEST Verification Feasibility

**Can a hook verify MANIFEST.yaml was read?** Yes, via two approaches:

1. **Transcript parsing:** Hook reads `transcript_path` (.jsonl), searches for `Read` tool call with `MANIFEST.yaml` in path. Feasible but has performance implications (parsing grows with transcript size).

2. **Marker file approach:** A `PostToolUse` hook on `Read` writes a marker file when MANIFEST.yaml is detected. A `PreToolUse` hook on `Edit|Write|Bash` checks for the marker. More performant but requires filesystem coordination.

**Recommendation:** Use a `SessionStart` hook for context injection (lightweight, reliable) as the primary mechanism. Transcript-based verification is feasible for higher-security environments but adds latency per tool call.

#### Limitations

- Hooks run per-tool-call (performance consideration for `PreToolUse`)
- Cannot directly access conversation memory/state (must parse transcript)
- `PostToolUse` hooks cannot undo actions (tool already executed)
- Windows requires Git Bash/WSL or PowerShell for shell scripts
- Default timeout: 10 minutes per hook (configurable)

#### Prototype Implementation

A prototype hook has been implemented at `lib/hooks/claude-code/verify-manifest.js`. See [Prototype Implementation](#prototype-implementation) section below.

---

### 2. Cursor (Anysphere)

#### Hook System

Cursor introduced hooks in v1.7 (late 2025) as a **beta feature** for organizations to observe, control, and extend the agent loop.

**Configuration:** Scripts in `.cursor/hooks/` directory.

**Capabilities:**
- Run custom logic before/after agent execution stages
- Inspect context and return allow/warn/deny decisions
- Enforce guardrails before MCP tool execution
- Connect to security tooling, observability platforms, compliance systems

**Enforcement Model:**
- Pre-execution hooks can inspect and block agent actions
- Policy-based: hooks return allow/warn/deny based on custom logic
- Integrates with organization security infrastructure

**Current Status:** Beta feature. Documentation is limited but improving. Community patterns are emerging.

**Recommendation:** Defer implementation until hooks exit beta. The instruction injection mechanism (Story 8.2, `.cursor/cursor.md`) provides adequate enforcement for now.

---

### 3. GitHub Copilot (GitHub/Microsoft)

#### Hook System

GitHub Copilot's coding agent supports hooks via `.github/hooks/hooks.json`, announced in public preview (March 2026).

**Configuration:**
```json
// .github/hooks/hooks.json
{
  "hooks": [
    {
      "event": "preToolUse",
      "tool": "shell",
      "command": "check-manifest.sh"
    }
  ]
}
```

**Available Events:**
- `sessionStart` — Initialize environments, logging
- `sessionEnd` — Cleanup, notifications
- `userPromptSubmitted` — Audit user prompts
- `preToolUse` — Approve or deny tool executions (most powerful)
- `postToolUse` — Post-execution checks
- `errorOccurred` — Error handling

**Advanced Extension System:**
Beyond hooks, Copilot CLI supports `.github/extensions/` with full Node.js processes communicating over JSON-RPC for lifecycle-level control.

**Enforcement Distinction:** The key insight from GitHub's documentation is that hooks shift from "instruction" (please don't) to "enforcement" (deny in preToolUse) — fundamentally different in certainty.

**Recommendation:** Implement when hooks exit public preview. The `.github/copilot/copilot.md` instruction injection (Story 8.2) is the current enforcement layer.

---

### 4. Gemini CLI (Google)

#### Hook System

Gemini CLI introduced hooks in v0.26.0+ (January 2026), documented as "middleware for your AI assistant."

**Configuration:** `~/.gemini/hooks/` directory with script files.

**Available Events:**
- `SessionStart` / `SessionEnd`
- `BeforeModel` / `AfterModel`
- `BeforeTool` / `BeforeToolSelection`
- `PreCompress`
- `Notification`

**Enforcement Capabilities:**
- `BeforeTool` hooks can prevent actions (e.g., blocking sensitive data writes)
- Hooks run synchronously — Gemini CLI waits for completion before proceeding
- Policy enforcement for security and compliance requirements
- Enabled by default in v0.26.0+

**Important Note:** This applies to **Gemini CLI** specifically. The VS Code Gemini Code Assist extension may have different capabilities. The `gemini` agent in our registry targets the `.gemini/gemini.md` instruction file, which aligns with the IDE extension, not CLI.

**Recommendation:** Defer until the `gemini` agent registration clarifies CLI vs IDE targeting. Current instruction injection via `.gemini/gemini.md` (Story 8.2) covers the IDE use case.

---

### 5. Cline (Saoud Rizwan)

#### Enforcement Model

Cline's enforcement relies primarily on **instruction files** with a limited hooks mechanism.

**Instruction Enforcement:**
- `.clinerules` file in project root — global rules
- `.clinerules/` directory with path-based conditional rules
- Rules use glob patterns to activate based on file context
- Rules are injected into the system prompt automatically

**Hooks System:**
- `.clinerules/hooks/` directory — workspace monitoring hooks
- Hook discovery cache for performance optimization
- Limited documentation on hook capabilities
- Primarily used for workspace event reactions, not tool-call enforcement

**MCP Integration:**
- Cline supports MCP servers for external tool integration
- Custom MCP tools can enforce behaviors indirectly

**Recommendation:** No hook-based enforcement feasible at this time. The `.clinerules` and `.cline/clinerules.md` instruction injection (Story 8.2) is the primary enforcement mechanism. Monitor for improved hook documentation.

---

### 6. Kilocode (Kilo AI)

#### Enforcement Model

Kilocode uses a declarative configuration system rather than hooks.

**Instruction Enforcement:**
- `AGENTS.md` files in workspace — project-specific agent instructions
- Rules integrate with the Mode system
- Automatically incorporated into system prompts
- Organization-level model restrictions enforced

**Agent Hooks:**
- Follow-up action automation (e.g., run tests on file save)
- Limited to workspace events, not tool-call interception
- No pre-execution blocking capability documented

**Recommendation:** No hook-based enforcement available. The `.kilocode/kilocode.md` instruction injection (Story 8.2) is the only enforcement layer. Kilocode's AGENTS.md is complementary but not hook-based.

---

### 7. Antigravity (Google DeepMind)

#### Current Status: NOT AVAILABLE FOR INTEGRATION

**Critical Issue:** In February 2026, Google imposed an "Antigravity Restriction" affecting third-party agent integrations. Key facts:

- Google's ToS now explicitly lists **Claude Code** and **OpenCode** as disallowed when paired with Antigravity subscription OAuth
- Users routing tokens through third-party platforms were suspended
- Appeal process requires unlinking third-party agents
- The restriction was triggered by 10x usage spikes from unauthorized integration patterns

**Hook/Enforcement System:**
- No public hook API documented
- Agent-first IDE with opinionated workflows
- No documented extension mechanism for custom enforcement

**Recommendation:** **Do not implement** any enforcement hooks for Antigravity. The `.antigravity/antigravity.md` instruction injection (Story 8.2) remains as a passive layer, but active hook enforcement is not possible and may violate Google's ToS.

---

### 8. BMAD Agents (11 agents)

#### Enforcement: Already Implemented (Story 8.3)

All 11 BMAD agents have enforcement via `critical_actions` in `.customize.yaml` files deployed through the BMAD extension module.

**Mechanism:**
```yaml
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
```

**Deployment:** Extension module at `_bmad/extensions/ma-agents-skills/` deployed during BMAD customization pipeline (Stage 3 in `bmad.js`).

**Coverage:**
- 4 custom agents (SRE, DevOps, Cyber, MIL-498): Full persona + menu + critical_actions
- 7 built-in agents (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer): critical_actions only

---

## Prototype Implementation

### Claude Code SessionStart Hook

**File:** `lib/hooks/claude-code/verify-manifest.js`

**Purpose:** Injects a context reminder at session start to reinforce MANIFEST.yaml skill loading. This is the most reliable enforcement approach — it works at session initialization with zero per-tool-call overhead.

**How it works:**
1. Runs on `SessionStart` event
2. Detects the project's skills MANIFEST.yaml path via `$CLAUDE_PROJECT_DIR`
3. If MANIFEST exists, outputs a context reminder that gets injected into Claude's session
4. If MANIFEST doesn't exist, exits silently (no-op for non-skill projects)

**Configuration for `.claude/settings.json`:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/lib/hooks/claude-code/verify-manifest.js\""
          }
        ]
      }
    ]
  }
}
```

**Deployment Decision:** Project-level (`.claude/settings.json`) is recommended over user-level, because:
- Skills are project-specific
- Hook references project files
- Avoids polluting global settings
- Installer already manages `.claude/CLAUDE.md`

### Why NOT a PreToolUse Verification Hook

A `PreToolUse` hook that parses the transcript to verify MANIFEST.yaml was read is **technically feasible** but **not recommended** as a default due to:

1. **Performance:** Transcript parsing on every `Edit`/`Write`/`Bash` call adds latency that grows with conversation length
2. **Complexity:** JSONL parsing in cross-platform scripts is fragile
3. **User experience:** Blocking tool calls with "read MANIFEST first" errors disrupts workflow
4. **Diminishing returns:** The SessionStart injection + instruction injection (Story 8.1) already provide two enforcement layers

**If higher-security enforcement is needed** in the future, the PreToolUse approach can be implemented using the marker file pattern:
1. `PostToolUse` hook on `Read` — writes a `.manifest-verified` marker when MANIFEST.yaml is read
2. `PreToolUse` hook on `Edit|Write` — checks for marker, denies if absent
3. `SessionStart` hook — cleans up stale markers

---

## Multi-Layer Enforcement Architecture

The current and proposed enforcement layers form a defense-in-depth approach:

```
Layer 1: Instruction Injection (Stories 8.1-8.2)
  ├── MA-AGENTS block at TOP of agent instruction files
  ├── All 7 IDE agents covered
  └── Tells agent to read MANIFEST.yaml and load skills

Layer 2: BMAD Critical Actions (Story 8.3)
  ├── critical_actions in .customize.yaml extension module
  ├── All 11 BMAD agents covered
  └── Mandatory steps injected into agent activation

Layer 3: Runtime Hooks (This Story — 8.5)
  ├── Claude Code: SessionStart context injection (IMPLEMENTED)
  ├── Cursor: Deferred (beta API)
  ├── GitHub Copilot: Deferred (public preview)
  ├── Gemini CLI: Deferred (CLI vs IDE clarification needed)
  ├── Cline: Not feasible (limited hooks)
  ├── Kilocode: Not feasible (no tool-call hooks)
  └── Antigravity: Not available (ToS restriction)
```

---

## Recommendations

### Immediate (This Sprint)

1. **Deploy Claude Code SessionStart hook** via installer when skills are installed for Claude Code
2. **Document hook removal** when all skills are uninstalled

### Near-Term (Next Sprint)

3. **Monitor Cursor hooks** for GA release — implement when stable
4. **Monitor GitHub Copilot hooks** for GA release — implement when stable
5. **Clarify Gemini agent** CLI vs IDE targeting before implementing hooks

### Future Considerations

6. **PreToolUse enforcement hook** for high-security environments (marker file pattern)
7. **HTTP hook endpoint** for centralized enforcement logging/auditing
8. **Agent hook** (LLM-based) for intelligent compliance verification

### Not Recommended

- Antigravity hook integration (ToS prohibits third-party agent coupling)
- Cline hook enforcement (insufficient API surface)
- Kilocode hook enforcement (no tool-call interception)
