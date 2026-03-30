# Sprint Management — Shared Guardrails

All stories in Epics 11, 12, and 17 inherit the following guardrails. Individual story specs reference this file rather than repeating these rules verbatim.

## Universal Constraints

- Do NOT add any new npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/` — extensions go in `lib/bmad-extension/`
- Do NOT place extension workflows anywhere other than `lib/bmad-extension/workflows/`

## Data Authority Rules

| Concern | Authoritative Source | Read By |
|---|---|---|
| Sprint entity (membership, capacity, dates, status) | `sprints/sprint-{id}.yaml` | 17.4, 17.5, 17.6, 17.8 |
| Sprint membership (old format, **deprecated**) | `sprint-plan-{n}.yaml` | 12.2, 12.3, 12.4 *(to be reworked in Epic 17)* |
| User story execution status (not-started/in-progress/done) | `sprint-status.yaml` | 12.2, 12.4, 17.8 |
| Bug story metadata (type, severity, title) | `bug-{slug}.md` YAML frontmatter | 12.2, 12.4, 17.3 |

**Never write sprint assignments to sprint-status.yaml.** These are separate concerns.

**Concurrency note:** Glob-then-write is not atomic; concurrent sprint modification is unsupported. Only one agent/user should modify a sprint file at a time.

## Sprint Artifact Naming

- Sprint artifacts: `_bmad-output/implementation-artifacts/sprints/sprint-{id}.yaml`
- Sprint discovery glob: `sprints/sprint-*.yaml`
- Sprint artifacts include `created_date` and `last_modified` ISO timestamp fields
- `last_modified` is updated on every write (concurrency guard)
- `created_date` is set once at creation and never updated

## Sprint Status Transitions

| From | To | Condition |
|---|---|---|
| `planning` | `active` | No other sprint is `active` |
| `active` | `closed` | Always allowed |
| `closed` | `active` | **INVALID** — no reopening closed sprints |
| `closed` | `planning` | **INVALID** |
| `active` | `planning` | **INVALID** — must close first |
| (creation) | `active` | **INVALID** — always start as `planning` |
| (creation) | `closed` | **INVALID** — always start as `planning` |

**Rules:**
- Only one sprint can be `active` at a time
- New sprints always start in `planning` status
- Closed sprints cannot be reopened — create a new sprint instead
- Sprints cannot be deactivated without closing

## Item ID Format Contract

Item IDs stored in sprint `items` arrays follow these formats:

- **Story IDs:** `{epic}-{story}-{slug}` (e.g., `5-5-explicit-parameter-passing`) — matches sprint-status.yaml key format
- **Bug IDs:** `BUG-{slug}` (e.g., `BUG-path-spaces`) — matches bug story file naming `bug-{slug}.md` but with uppercase `BUG-` prefix

This contract is consumed by Stories 17.4 (writes items), 17.5 (removes items), 17.6 (cleanup), and 17.8 (display).

## Bug Story File Contract (Epic 11 → Epic 12/17 integration)

Bug stories created by `create-bug-story` (11.2) are discovered by sprint workflows via:

1. Glob: `_bmad-output/implementation-artifacts/bug-*.md`
2. YAML frontmatter parsing — required fields: `type: bug`, `severity`, `title`

Bug stories are **not** tracked in sprint-status.yaml. They are peers to user stories in the flat backlog (FR65).

## Extension Module Scaffolding Ownership

Story **11.2** is the sole owner of:
- `lib/bmad-extension/module.yaml`
- `lib/bmad-extension/module-help.csv`

Stories 12.1–12.4 depend on Story 11.2 having been completed. They verify scaffolding exists; they do not re-create it.

## Story Implementation Order

```
Epic 11:  11.1 → 11.2 → 11.3 (blocked until 11.1 + 11.2 done)
                   ↓
Epic 12: 12.1 (depends on 11.2 scaffolding)
                   ↓
                 12.2 → 12.3 → 12.4

Epic 17: 17.1 → 17.2 → 17.3 → 17.4 → 17.5 → 17.6 → 17.7 → 17.8
         (depends on Epic 11 bug entity, reworks Epic 12 workflow shells)
```
