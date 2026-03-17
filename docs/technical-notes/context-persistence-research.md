# Context Persistence Research — Technical Note

**Story:** 8.6 — Research Context Persistence Strategies
**Date:** 2026-03-17
**Status:** Complete

## Executive Summary

This technical note researches how LLM context compression affects skill directive retention, evaluates the BMAD sidecar memory system as a persistence mechanism, and analyzes re-injection strategies to ensure skills survive long sessions.

**Key Finding:** Context loss is a real but manageable risk. The current multi-layer enforcement architecture (Stories 8.1-8.5) already provides strong resilience. The most practical persistence mechanism is the **SessionStart hook re-injection** pattern (already prototyped in Story 8.5), which fires on context compaction events. BMAD sidecar memory is not designed for skill state persistence and should not be repurposed for it.

**Recommendation:** **Defer** implementation of additional persistence mechanisms. The existing three-layer enforcement (instruction injection + critical_actions + SessionStart hook) is sufficient. Revisit when agents expose explicit context-loss callbacks or when measurable skill-drift is reported in production.

---

## 1. Problem Statement

When users have long sessions with AI coding agents, the conversation context grows beyond the model's context window. Agents handle this through various compression strategies — summarizing earlier conversation, dropping older messages, or compacting the transcript. During compression, injected skill directives (the MA-AGENTS planning instruction block) risk being lost or weakened, potentially causing the agent to stop loading skills mid-session.

### What Must Persist

The critical content that must survive compression:

1. **Planning Instruction block** — The `<!-- MA-AGENTS-START -->` ... `<!-- MA-AGENTS-END -->` block injected at the top of agent instruction files (e.g., `.claude/CLAUDE.md`). Contains:
   - Instruction to read `MANIFEST.yaml`
   - Instruction to load `always_load: true` skills
   - Instruction to select relevant skills per task
2. **BMAD critical_actions** — The 3-step skill loading sequence in `.customize.yaml` for all 11 BMAD agents
3. **Loaded skill content** — The actual skill file contents read into context during the session

### Risk Profile

| Content | Risk Level | Rationale |
|---------|-----------|-----------|
| System prompt / instruction files | **Low** | Re-read on every turn by most agents; survives compression |
| CLAUDE.md / instruction file content | **Low** | Treated as system-level by Claude Code; re-loaded on compaction |
| Planning Instruction block (in instruction file) | **Low** | Lives in instruction file, re-read with it |
| Skill file contents (read into conversation) | **High** | Conversation-level content; first to be compressed/dropped |
| BMAD critical_actions | **Low** | Part of agent activation; re-executed on agent load |

---

## 2. Context Compression Behavior by Agent

### 2.1 Claude Code (Anthropic)

**Compression mechanism:** Automatic context compaction when conversation approaches context window limits.

**How it works:**
- The system prompt (including `CLAUDE.md` content) is **always retained** — it is re-loaded on every turn, not stored in the conversation transcript
- `CLAUDE.md` and other instruction files listed in project settings are read fresh on each interaction and placed in `<system-reminder>` tags
- When context is compacted, **earlier conversation messages** are summarized or dropped — but the system prompt persists in full
- The `SessionStart` hook fires on `compact` events (matcher: `"compact"`), providing a re-injection opportunity at compaction time
- Tools and their outputs in the conversation history are compressed, but the system prompt injections remain

**Key insight:** The MA-AGENTS planning instruction block lives in `CLAUDE.md`, which is a **system-level instruction file**. It is NOT part of the conversation history. Therefore, **it survives context compression automatically**. The risk is only to skill content that was read into the conversation via `Read` tool calls.

**Evidence:** Claude Code's `SessionStart` hook supports three matchers: `startup`, `resume`, and `compact`. The `compact` event specifically fires during context compaction, confirming that Anthropic designed the hook system with context-loss scenarios in mind.

### 2.2 Cursor (Anysphere)

**Compression mechanism:** Automatic context management with configurable long-context mode.

**How it works:**
- `.cursor/cursor.md` (and `.cursorrules`) are loaded as system-level context on every interaction
- Cursor v1.7+ supports "Long Context Mode" which extends the effective window before compression kicks in
- When the context window fills, Cursor summarizes earlier conversation turns
- System-level instruction files survive compression — they are re-read, not stored in conversation
- Cursor hooks (beta) can fire on agent execution stages but do not currently have a `compact` event

**Key insight:** Similar to Claude Code, the instruction file is system-level. Skill content read during conversation is at risk, but the planning instruction block persists.

### 2.3 GitHub Copilot (GitHub/Microsoft)

**Compression mechanism:** Reference-based retrieval with context window management.

**How it works:**
- `.github/copilot/copilot.md` is loaded as system context
- Copilot uses a retrieval-based approach — relevant code/docs are pulled in per-turn rather than accumulating in conversation
- For long conversations in agent mode, earlier turns are summarized
- Instruction files are treated as project-level directives that persist across turns
- `sessionStart` hook available (preview) for re-injection

**Key insight:** Copilot's retrieval-based model naturally handles context limits better than accumulative approaches. The planning instruction persists as a project-level directive.

### 2.4 Gemini CLI / Gemini Code Assist (Google)

**Compression mechanism:** Context window management with `PreCompress` hook event.

**How it works:**
- `.gemini/gemini.md` is loaded as system context
- Gemini CLI v0.26.0+ exposes a `PreCompress` hook event — this fires BEFORE context compression occurs
- This is the most explicit context-loss API of any agent: you can run logic just before compression happens
- System-level instruction files survive compression

**Key insight:** Gemini CLI's `PreCompress` hook is architecturally ideal for re-injection. It fires at exactly the right moment. However, the `gemini` agent in our registry targets the IDE extension (Gemini Code Assist), not the CLI, so this hook may not be available to our primary use case.

### 2.5 Cline (Saoud Rizwan)

**Compression mechanism:** Context truncation with `.clinerules` persistence.

**How it works:**
- `.clinerules` and `.cline/clinerules.md` are injected into the system prompt on every turn
- Cline manages context by truncating older conversation turns when approaching limits
- No explicit compaction event or hook exists
- MCP servers provide a channel for persistent tool state, but this requires server-side infrastructure

**Key insight:** Instruction files persist. No compaction hook exists for re-injection.

### 2.6 Kilocode (Kilo AI)

**Compression mechanism:** Context management via Mode system.

**How it works:**
- `.kilocode/kilocode.md` loaded as workspace instructions
- Kilocode's Mode system can reset context per-task (similar to starting a new conversation)
- No context compaction hooks or events documented
- AGENTS.md files are treated as persistent workspace instructions

**Key insight:** Instruction files persist. The Mode system may actually help by providing natural context boundaries.

### 2.7 Antigravity (Google DeepMind)

**Research status:** Limited — ToS restricts third-party agent integration (see Story 8.5). No public documentation on context compression behavior.

### 2.8 Summary: System vs. Conversation Content

| Content Type | Behavior During Compression | Risk |
|-------------|---------------------------|------|
| **System prompt** (instruction files) | **Re-read every turn** — survives compression | None |
| **Early conversation messages** | Summarized or dropped | High |
| **Tool call results** (file reads) | Summarized or dropped | High |
| **Recent conversation messages** | Retained (recency bias) | Low |
| **Hook-injected context** | Injected fresh on compaction | None (if hook fires) |

---

## 3. BMAD Sidecar Memory Analysis

### 3.1 How Sidecar Memory Works

BMAD's sidecar memory system is a **file-based persistence mechanism** for agents that need state across sessions.

**Configuration:**
- `hasSidecar: true` in agent `.agent.yaml` metadata declares an agent uses sidecar memory
- Memory files are stored at `{project-root}/_bmad/_memory/{skillName}-sidecar/`
- Agents load sidecar files via `critical_actions` at activation time

**File structure:**
```
_bmad/_memory/{skillName}-sidecar/
  index.md              # Primary context — loaded on every activation
  access-boundaries.md  # Read/write permissions — loaded on every activation
  patterns.md           # Learned preferences — loaded on demand
  chronology.md         # Timeline/history — loaded on demand
  autonomous-log.md     # Headless execution log
```

**Current usage:** Only one agent currently uses sidecar memory — Sophia (Storyteller) in the CIS module. She stores:
- `story-preferences.md` — User's storytelling style preferences
- `stories-told.md` — History of stories created

**Loading mechanism:**
```yaml
critical_actions:
  - "Load COMPLETE file {project-root}/_bmad/_memory/storyteller-sidecar/story-preferences.md..."
  - "Load COMPLETE file {project-root}/_bmad/_memory/storyteller-sidecar/stories-told.md..."
```

### 3.2 Can Sidecar Memory Store Skill State?

**Technical feasibility:** Yes, but it would be a misuse of the system.

**Analysis:**
- Sidecar memory is designed for **agent-specific persistent knowledge** (user preferences, history, learned patterns)
- Storing "skills loaded in this session" is **transient session state**, not persistent knowledge
- The memory system has no concept of "session" vs "persistent" — everything written persists until pruned
- Writing skill state to sidecar would create stale data across sessions (a skill loaded in session 1 may not be relevant in session 2)
- Each write to sidecar memory consumes tokens for both the write and subsequent reads

**Verdict:** Sidecar memory is architecturally wrong for skill state. It solves a different problem (cross-session knowledge) than what we need (within-session persistence).

### 3.3 Can Sidecar Memory Trigger Skill Re-Reads?

**Analysis:**
- Sidecar files are loaded at agent **activation** time (session start), not during context compression
- There is no mechanism for sidecar files to be re-read when context is compressed
- BMAD does not have a "context compaction" event or hook in its lifecycle
- Critical actions fire once at activation — they don't re-fire mid-session

**Verdict:** No. Sidecar memory cannot trigger mid-session re-reads. It operates at session boundaries, not context compression boundaries.

### 3.4 Sidecar Memory Limitations

| Limitation | Impact on Skill Persistence |
|-----------|---------------------------|
| Fires only at activation, not on compression | Cannot re-inject skills mid-session |
| Designed for cross-session state, not transient | Wrong abstraction level |
| Only available to BMAD agents | IDE agents (Claude Code, Cursor, etc.) have no sidecar |
| Adds token overhead per activation | Wasted if storing skills-loaded state |
| No TTL or session-scoping | Stale state accumulates |

---

## 4. Re-Injection Strategies

### 4.1 MANIFEST Re-Read Pattern

**Concept:** Instruct agents to periodically re-read MANIFEST.yaml during long sessions.

**Feasibility:** Partially feasible via self-reinforcing directives.

**How it would work:**
- The planning instruction block in `CLAUDE.md` already says "Before starting any task, read the skill manifest"
- Since `CLAUDE.md` is re-read on every turn (system-level), this instruction persists
- The instruction itself is the re-read trigger — every new user task should cause the agent to re-consult the manifest

**Effectiveness:**
- Works well for **task boundaries** (user starts a new task = re-reads manifest)
- Does NOT help for **long single tasks** where skills are read once and then context is compressed mid-task
- Relies on agent compliance with the "before starting any task" instruction

**Verdict:** Already implemented by design. The planning instruction IS the re-read trigger. No additional work needed.

### 4.2 Hook-Based Re-Injection

**Concept:** Use agent hooks (Story 8.5) to re-inject skill awareness when context is compressed.

**Feasibility:** High — already prototyped for Claude Code.

**Current state:**
- Claude Code `SessionStart` hook (`lib/hooks/claude-code/verify-manifest.js`) fires on `startup`, `resume`, and `compact` events
- On `compact` (context compression), the hook injects: "SKILL ENFORCEMENT ACTIVE: This project uses ma-agents skills. Read the skill manifest..."
- This gives Claude a fresh reminder to re-read MANIFEST.yaml after every context compaction

**Agent coverage:**

| Agent | Hook Event for Compression | Feasibility |
|-------|---------------------------|-------------|
| Claude Code | `SessionStart` with `compact` matcher | **Implemented** (prototype) |
| Gemini CLI | `PreCompress` | High — fires before compression |
| GitHub Copilot | `sessionStart` | Moderate — unclear if fires on compaction |
| Cursor | Agent execution hooks (beta) | Low — no explicit compaction event |
| Cline | None | Not feasible |
| Kilocode | None | Not feasible |

**Verdict:** Most effective strategy for Claude Code (already done). Gemini CLI's `PreCompress` is architecturally superior but targets CLI, not IDE. Other agents lack compaction-specific hooks.

### 4.3 Self-Reinforcing Directives (always_load Skills)

**Concept:** Skills with `always_load: true` could include self-reinforcing text like "If you notice you've forgotten these rules, re-read this file."

**Feasibility:** Low effectiveness.

**Analysis:**
- Self-reinforcing directives are a form of **prompt engineering** — they rely on the LLM noticing it has forgotten something
- LLMs do not have reliable self-awareness of context loss — by definition, if content was compressed away, the model doesn't know it existed
- The directive itself would be in the compressed content, creating a chicken-and-egg problem
- Some models may respond to "check if you remember X" patterns, but this is unreliable and model-dependent

**Verdict:** Not recommended as a primary strategy. Self-reinforcing directives in skills may provide marginal benefit but cannot be relied upon.

### 4.4 Critical_Actions Reinforcement (BMAD Agents)

**Concept:** Research whether BMAD agents re-evaluate critical_actions during context compression.

**Finding:** No. Critical_actions fire once during agent activation. BMAD's runtime does not have context compression awareness.

**Analysis:**
- Critical_actions are defined in `.customize.yaml` and processed during the agent `<activation>` sequence
- The activation sequence runs when a user invokes a BMAD agent (e.g., `/bmad-agent-bmm-dev`)
- There is no BMAD lifecycle event for "context was compressed" — BMAD is not context-aware
- However, BMAD agents run inside IDE agents (primarily Claude Code), so the **IDE agent's compression handling** applies
- When Claude Code compacts context during a BMAD agent session, the `SessionStart` hook fires, providing the re-injection

**Verdict:** BMAD's own critical_actions don't re-fire, but this is acceptable because the IDE agent's hooks handle re-injection at the hosting layer.

### 4.5 Session Bookmarks

**Concept:** Some agents may support "bookmarking" key instructions to survive compression.

**Research findings:**
- **No agent currently supports explicit bookmarks.** This is a hypothetical feature.
- Claude Code's system prompt mechanism is the closest equivalent — instruction files are effectively "bookmarked" by being re-read every turn
- Gemini CLI's `PreCompress` hook allows injecting content just before compression — the closest to a "save before compress" pattern
- OpenAI's GPT-4 Turbo introduced "persistent memories" (user-level, not project-level), but this is not applicable to coding agents
- No standard emerged for per-project "pinned context" across agents

**Verdict:** Not available. The system-prompt mechanism (instruction files re-read every turn) is the de facto bookmark system.

---

## 5. Comparison Matrix

| Strategy | Feasibility | Complexity | Agent Coverage | Reliability | Status |
|----------|------------|------------|----------------|-------------|--------|
| **Instruction file persistence** (system-level, re-read every turn) | High | None (existing) | All 7 IDE agents | Very High | **Already working** (Stories 8.1-8.2) |
| **BMAD critical_actions** (activation-time enforcement) | High | None (existing) | All 11 BMAD agents | High | **Already working** (Story 8.3) |
| **SessionStart hook re-injection** (fires on compact) | High | Low (implemented) | Claude Code only | High | **Prototype exists** (Story 8.5) |
| **Gemini PreCompress hook** | High | Low | Gemini CLI only | High | Deferred (CLI vs IDE) |
| **GitHub Copilot sessionStart** | Moderate | Low | Copilot only | Unknown | Deferred (preview) |
| **MANIFEST re-read instruction** (self-triggering) | High | None (existing) | All IDE agents | Moderate | **Already working** (by design) |
| **Self-reinforcing skill directives** | Low | Low | All agents | Low | Not recommended |
| **BMAD sidecar memory** | Technically feasible | Medium | BMAD agents only | Low | **Not recommended** (wrong abstraction) |
| **Session bookmarks** | N/A | N/A | None | N/A | Not available |

### Architecture Impact Assessment

| Strategy | Requires Code Changes | Requires MANIFEST.yaml Schema Changes | Requires Skill File Format Changes |
|----------|----------------------|--------------------------------------|-----------------------------------|
| Instruction file persistence | No | No | No |
| BMAD critical_actions | No | No | No |
| SessionStart hook | No (already implemented) | No | No |
| Gemini PreCompress hook | Yes (new hook script) | No | No |
| Copilot sessionStart hook | Yes (new hook script) | No | No |
| Self-reinforcing directives | No | No | Yes (add directives to skill files) |
| Sidecar memory for skills | Yes (new sidecar logic) | No | No |

---

## 6. Recommendation

### Decision: **DEFER** Additional Persistence Mechanisms

**Rationale:**

The current three-layer enforcement architecture already provides strong resilience against context loss:

```
Layer 1: Instruction Injection (Stories 8.1-8.2)
  - MA-AGENTS block at TOP of instruction files
  - System-level content — re-read EVERY TURN
  - Survives all context compression automatically
  - Coverage: All 7 IDE agents

Layer 2: BMAD Critical Actions (Story 8.3)
  - critical_actions in .customize.yaml
  - Fires at agent activation
  - Coverage: All 11 BMAD agents

Layer 3: SessionStart Hook (Story 8.5)
  - Fires on startup, resume, AND compact events
  - Re-injects skill awareness after context compression
  - Coverage: Claude Code (prototype implemented)
```

**Why defer:**

1. **The highest-risk content (planning instruction) is already safe.** It lives in system-level instruction files that are re-read every turn. Context compression cannot touch it.

2. **The SessionStart hook already handles the compact event.** The one scenario where a reminder is needed after compression is already covered for Claude Code.

3. **Skill file content loss is acceptable.** If a skill's actual content is compressed away mid-session, the planning instruction persists and will trigger the agent to re-read the MANIFEST on the next task. The skill content will be re-loaded from disk.

4. **No production reports of skill drift.** There are no reported incidents of skills being forgotten during sessions. Implementing additional persistence would be premature optimization.

5. **BMAD sidecar is the wrong tool.** Repurposing cross-session memory for within-session state would add complexity without reliability.

### Conditions That Would Trigger Revisiting

Revisit this decision if any of the following occur:

1. **User reports of skill drift** — Documented cases where agents stop following skill directives mid-session
2. **Agent-exposed context-loss callbacks** — When agents (beyond Claude Code) provide explicit events for context compaction
3. **New agent with no system-prompt persistence** — If a future agent doesn't re-read instruction files every turn
4. **Quantitative context-loss metrics** — If agents expose APIs to measure how much context was dropped during compaction
5. **Multi-agent orchestration** — If skills need to persist across agent handoffs within a session (not currently a use case)

### If Implementation Were Needed

If the decision were to implement now, the recommended approach would be:

1. **Extend `SessionStart` hook** to support additional agents as they release compaction events (Gemini `PreCompress`, Copilot `sessionStart`)
2. **Scope:** One new story per agent hook (similar to Story 8.5's Claude Code hook)
3. **Do NOT use BMAD sidecar** — it solves a different problem
4. **Do NOT modify skill file format** — self-reinforcing directives are unreliable

---

## Appendix A: How the MA-AGENTS Block Survives Compression

Tracing the lifecycle of the planning instruction through a Claude Code session:

```
1. Install: npx ma-agents install <skill>
   └── installer.js injects MA-AGENTS block into .claude/CLAUDE.md (top position)

2. Session Start: Claude Code launches
   ├── .claude/CLAUDE.md loaded as system-level instruction (re-read every turn)
   ├── SessionStart hook fires → injects "SKILL ENFORCEMENT ACTIVE" reminder
   └── Agent reads MANIFEST.yaml per planning instruction

3. Mid-Session: User works, conversation grows
   ├── CLAUDE.md remains in system prompt (always present)
   ├── Skill content loaded via Read tool calls → enters conversation history
   └── Skills active and enforced

4. Context Compression: Window limit reached
   ├── Earlier conversation messages summarized/dropped
   ├── Skill content from Read calls may be summarized/lost
   ├── CLAUDE.md PERSISTS (system-level, re-read fresh)
   ├── SessionStart hook fires with "compact" matcher
   │   └── Injects fresh "Read the skill manifest" reminder
   └── Planning instruction survives → triggers re-read of MANIFEST on next task

5. Post-Compression: Session continues
   ├── CLAUDE.md still present with MA-AGENTS block
   ├── Agent re-reads MANIFEST.yaml per planning instruction
   ├── Skills re-loaded from disk (not from compressed context)
   └── Full skill enforcement restored
```

## Appendix B: BMAD Agent Context During Compression

BMAD agents (pm, architect, dev, qa, etc.) always run hosted inside an IDE agent (typically Claude Code). The compression behavior is determined by the host:

```
Claude Code (host)
  ├── System prompt: CLAUDE.md with MA-AGENTS block (persists)
  ├── SessionStart hook: verify-manifest.js (fires on compact)
  └── Conversation: BMAD agent activation, persona, workflow
      ├── critical_actions: skill loading (in early conversation — at risk)
      ├── Agent persona and menu (in early conversation — at risk)
      └── Workflow execution (recent — likely retained)
```

When compression occurs during a BMAD agent session:
- The agent's **persona and activation** may be summarized, but the agent is already running — its behavior is established
- The **critical_actions** fired at activation — skills were already loaded
- The **CLAUDE.md planning instruction** persists (system-level) and will trigger re-reads on the next task
- The **SessionStart hook** fires and injects a fresh reminder

**Net effect:** BMAD agent sessions are resilient to compression because the enforcement layers operate at different points in the lifecycle (system prompt > activation > hook re-injection).
