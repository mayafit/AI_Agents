# Agent Activity Dashboard

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capability F13.

---

## Functional Requirements

### Agent Activity Dashboard

- FR87: Project managers can invoke a real-time dashboard displaying the current activity of all active AI agents in the project via `npx ma-agents dashboard`
- FR88: The dashboard displays per-agent details: agent type, assigned story identifier, active git worktree path, current branch, and current status (implementing / reviewing / awaiting-review / idle)
- FR89: Dashboard data refreshes automatically at a configurable interval (default: 30 seconds) without requiring manual reload — elapsed time since last refresh is visible
- FR90: Project managers can filter the dashboard by agent type, story identifier, branch, or status category
- FR91: The dashboard distinguishes active agents (in-progress work), agents awaiting human review (PR open, no merge), and idle agents (no current worktree assignment)
- FR92: Project managers can view completed session history per agent: agent type, story identifier, branch, duration, and outcome (merged / abandoned / pending)
- FR93: Dashboard data is derived exclusively from existing project file structures (`_bmad-output/` activity logs, git worktree state, story status files) — no additional persistent data store is required

## Quality Attributes (Non-Functional Requirements)

### Agent Activity Dashboard

- NFR26: The dashboard shall reflect agent state changes within 60 seconds of the triggering file system event — measured from file write completion to next dashboard render cycle
- NFR27: The dashboard shall render status for up to 20 concurrently active agents in under 2 seconds — measured by wall-clock time from refresh trigger to complete output display
- NFR28: Dashboard data collection shall be read-only against existing project file structures — no writes to `_bmad-output/` or git state during dashboard operation, verified by absence of new file system writes during a dashboard session
