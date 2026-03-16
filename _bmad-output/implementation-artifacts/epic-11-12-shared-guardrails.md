# Epic 11 & Epic 12 — Shared Guardrails

All stories in Epic 11 and Epic 12 inherit the following guardrails. Individual story specs reference this file rather than repeating these rules verbatim.

## Universal Constraints

- Do NOT add any new npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/` — extensions go in `lib/bmad-extension/`
- Do NOT place extension workflows anywhere other than `lib/bmad-extension/workflows/`

## Data Authority Rules (Epic 12)

| Concern | Authoritative Source | Read By |
|---|---|---|
| Sprint membership (which items are in which sprint) | `sprint-plan-{n}.yaml` | 12.2, 12.3, 12.4 |
| User story execution status (not-started/in-progress/done) | `sprint-status.yaml` | 12.2, 12.4 |
| Bug story metadata (type, severity, title) | `bug-{slug}.md` YAML frontmatter | 12.2, 12.4 |

**Never write sprint assignments to sprint-status.yaml.** These are separate concerns.

## Sprint Artifact Naming (Epic 12)

- Sprint artifacts: `_bmad-output/implementation-artifacts/sprint-plan-{number}.yaml`
- Sprint discovery glob: `sprint-plan-*.yaml` (never `sprint-*.yaml` — that pattern matches sprint-status.yaml)
- Sprint artifacts include a `last_modified` ISO timestamp field, updated on every write

## Bug Story File Contract (Epic 11 → Epic 12 integration)

Bug stories created by `create-bug-story` (11.2) are discovered by sprint workflows (12.2, 12.4) via:

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
11.1 → 11.2 → 11.3 (blocked until 11.1 + 11.2 done)
             ↓
           12.1 (depends on 11.2 scaffolding)
             ↓
           12.2 → 12.3 → 12.4
```
