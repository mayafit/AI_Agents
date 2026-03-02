# AI Audit Trail

Track AI agent session activity in a project-level `AiAudit.md` file. This provides accountability and visibility into AI agent work — what was done, when, and the resources consumed.

## Policy

### 1. Always Maintain the Audit Log

At the **end of every significant agent session** (document generation, multi-step workflow, code changes), the agent MUST append an entry to `AiAudit.md` in the project root.

A "significant session" is any task that:
- Generates or substantially modifies a document
- Executes a multi-step workflow
- Makes changes across multiple files
- Takes more than a trivial amount of interaction

Single-question answers or trivial lookups do NOT require an audit entry.

### 2. File Location

The audit log is always at:
```
{project_root}/AiAudit.md
```

If the file does not exist, create it with the header (see format below).

### 3. File Format

```markdown
# AI Audit Trail

This file tracks AI agent sessions, time spent, and resources consumed.

---

## Session: {session_title}

| Field | Value |
|-------|-------|
| **Date** | {YYYY-MM-DD} |
| **Agent** | {agent_name} ({model_name}) |
| **Task** | {brief_task_description} |
| **Duration** | {estimated_duration} |
| **Tokens (est.)** | Input: ~{input_tokens} / Output: ~{output_tokens} |
| **Files Modified** | {count} files |
| **Documents Generated** | {list_or_count} |
| **Status** | {Completed / Partial / Failed} |

### Summary
{2-3 sentence summary of what was accomplished}

### Files Touched
- `path/to/file1.md` — {action: created/updated/deleted}
- `path/to/file2.md` — {action}

---
```

### 4. Field Definitions

| Field | Description | How to Determine |
|-------|-------------|-----------------|
| **Date** | Session date | Current date in `YYYY-MM-DD` format |
| **Agent** | Agent identity | The agent name and model (e.g., `Joseph (Claude Opus 4.6)`, `Claude Code (Claude Sonnet 4.6)`) |
| **Task** | What was requested | Brief description of the user's request |
| **Duration** | Estimated wall-clock time | Estimate from session start to end. Use ranges if uncertain (e.g., `~15-20 minutes`) |
| **Tokens (est.)** | Estimated token consumption | Provide best estimate of input/output tokens. Use `~` prefix to indicate approximation. If unknown, write `Not available` |
| **Files Modified** | Number of files changed | Count of files created, updated, or deleted |
| **Documents Generated** | Documents produced | List document names or count |
| **Status** | Outcome | `Completed` if all tasks done, `Partial` if some remain, `Failed` if blocked |

### 5. Rules

1. **Append only** — Never delete or modify previous session entries. The audit log is an append-only record.
2. **One entry per session** — Do not create multiple entries for the same continuous work session. If a session spans multiple tasks, combine them into one entry.
3. **Estimate honestly** — Token estimates are approximations. Round to the nearest thousand. If you cannot estimate, say so explicitly.
4. **Session title** — Use a descriptive, unique title (e.g., `Generate SSDD v1.0`, `Fix SRS interface requirements`, `MIL-498 workflow audit`).
5. **End of session** — Write the audit entry as the **last action** before presenting final results to the user.
6. **Chronological order** — New entries go at the **bottom** of the file, maintaining chronological order.

### 6. Duration Estimation

Since AI agents don't have built-in timers, use these guidelines:
- Note the time when you start the task (from system context or user message timestamps)
- Note the time when you finish
- If timestamps aren't available, estimate based on the complexity: quick task (~5 min), medium task (~15-30 min), large task (~1-2 hours)
- Always prefix with `~` to indicate it's an estimate

### 7. Token Estimation

Provide your best estimate:
- **Input tokens**: Roughly proportional to the amount of context you consumed (files read, conversation history)
- **Output tokens**: Roughly proportional to the amount of text you generated (documents, code, messages)
- If precise counts are available from the environment, use them
- If not, estimate and note `(estimated)` next to the values

## Example

```markdown
# AI Audit Trail

This file tracks AI agent sessions, time spent, and resources consumed.

---

## Session: Generate SSDD v1.0

| Field | Value |
|-------|-------|
| **Date** | 2026-03-01 |
| **Agent** | Joseph (Claude Opus 4.6) |
| **Task** | Generate MIL-STD-498 SSDD document from project artifacts |
| **Duration** | ~25 minutes |
| **Tokens (est.)** | Input: ~45,000 / Output: ~12,000 |
| **Files Modified** | 1 file |
| **Documents Generated** | SSDD.md |
| **Status** | Completed |

### Summary
Generated the System/Subsystem Design Description from PRD, architecture, and product brief artifacts. Conducted CSCI discovery interview identifying 5 CSCIs. All 6 DID sections populated with full requirements traceability.

### Files Touched
- `_bmad-output/planning-artifacts/SSDD.md` — created

---

## Session: Update SRS per user feedback

| Field | Value |
|-------|-------|
| **Date** | 2026-03-02 |
| **Agent** | Joseph (Claude Opus 4.6) |
| **Task** | Update SRS interface requirements based on user review feedback |
| **Duration** | ~10 minutes |
| **Tokens (est.)** | Input: ~20,000 / Output: ~5,000 |
| **Files Modified** | 1 file |
| **Documents Generated** | SRS.md (updated) |
| **Status** | Completed |

### Summary
Updated Section 3.3 interface requirements to add 4 new external interfaces identified during user review. Updated traceability matrix in Section 5.

### Files Touched
- `_bmad-output/planning-artifacts/SRS.md` — updated

---
```
