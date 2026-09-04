# Bug: Jira operations have no user-identity context — "assigned to me" is unresolvable

Status: ready-for-dev

## Summary

Reported 2026-09-03 from live use. The user asked a Jira-backed agent to
"Get the most important issue to work on" and expected the highest-priority issue
**assigned to them**. The agent returned project-wide results instead. When told
explicitly to scope the query to the user, the agent could not — it had no way to
determine the user's identity.

Two distinct defects underlie this. Both must be fixed; the first alone does not
serve the reported request.

### Defect A — no concept of "the current user" anywhere in the Jira integration

The install wizard (`collectJiraConfig`, `bin/cli.js:456-493`) collects exactly two
Jira fields: `jiraUrl` and `jiraProjectKey`. Nothing identifies *who the operator is*.
Those two values are the only Jira keys written to `_bmad/bmm/config.yaml`
(`bin/cli.js:577-579`) and to `project-layout.yaml` (`bin/cli.js:643-645`), and the
only two read back (`bin/cli.js:688-696`).

Correspondingly, a search across all 13 sprint-management skills for `assignee`,
`currentUser`, `accountId`, `jira_user` and `myself` returns **zero matches** in every
copy of the pipeline (`skills/`, `.agents/skills/`, `lib/bmad-extension/`,
`lib/bmad-extension-plugin/`). The Jira routing block instructs the agent to operate
on "project `{jira_project_key}` at `{jira_url}`" and never mentions the operator.

The agent therefore behaved exactly as specified. This is a missing requirement, not a
lookup failure.

### Defect B — no skill implements a user-scoped "what should I work on" operation

The three closest skills are all project-wide and none accepts an assignee filter:

- `prioritize-backlog/SKILL.md:16` — reorders the **entire** backlog by composite score;
  no assignee dimension exists in the scoring model (severity, business value,
  dependencies, type, age).
- `sprint-status-view` — renders the whole board.
- `bmad-dev-story` (`workflow.md:50`) — "Find the Jira issue matching the item ID",
  i.e. the caller must already know the issue key.

So even with identity available, no skill would have answered the question asked.

## Root Cause

The Jira backend was designed as a **board-level** projection of the file-system
schema (Sprint → `sprints[]`, Backlog → `backlog[]`, Epic → `epics[]`). The
file-system backend is inherently single-operator — whoever owns the working tree owns
the file — so no assignee dimension was ever needed, and none was carried across when
the Jira adapter was introduced (Story 17.22, Epic 14). Jira is multi-user; the
projection dropped the one field that distinguishes users.

## Fix

### Identity resolution — `currentUser()`, not stored config

Resolve identity through **JQL `assignee = currentUser()`**. Jira evaluates
`currentUser()` against the identity already bound to the authenticated
tool (MCP server, connector, or plugin credential), so the correct operator is
resolved with no configuration, no install prompt, and no staleness when an account
changes.

Two rejected alternatives, recorded so they are not revisited:

- **OS login name** — rejected. The local account (e.g. a numeric Windows user id)
  has no defined relationship to an Atlassian `accountId` or account email. On Jira
  Cloud it resolves to nothing; on Server/DC it can silently resolve to a *different*
  person whose directory username happens to collide. A wrong-user match is worse than
  no match, because it fails silently.
- **Install-time config field as the primary mechanism** — rejected as primary. It
  goes stale on account changes, is wrong for any repo shared between operators, and
  duplicates an identity the authenticated tool already holds.

If a Jira tool has no bound identity (for example a shared service-account token),
`currentUser()` resolves empty. The skills must **fail loud** in that case — state that
the Jira tool is authenticated as a shared account and that user-scoped queries are
unavailable — rather than silently widening the query back to project scope. Silent
widening is precisely the reported symptom.

### Scope of change

1. **Jira routing block, all 13 skills** — add an identity clause making
   `assignee = currentUser()` available to assignee-aware operations, plus the
   fail-loud rule for an unresolvable identity.
2. **New user-scoped operation** — a skill that answers "the most important issue
   assigned to me", filtering on `assignee = currentUser()` and ranking by the
   existing composite-priority criteria. Must work on both backends: under
   `file-system` there is a single implicit operator, so the filter is a no-op and the
   skill degrades to "highest-priority ready item".

## Files Changed

- `bin/cli.js` — no new Jira config key (identity is not stored); wizard unchanged
- `skills/*/SKILL.md` — Jira routing block, 12 IDE skill files
- `skills/<new>/SKILL.md` — new user-scoped "my next issue" skill
- `lib/bmad-extension/skills/*/SKILL.md` (or `workflow.md`) — extension copies
- `lib/bmad-extension-plugin/` — plugin bundle rebuild (`npm run build:plugin`)
- `.agents/skills/` — regenerated
- `skills/MANIFEST.yaml` — register the new skill
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — bug registered

## Notes

- **Not a retroactive epic edit.** Per project convention this is a standalone bug
  story; Epic 14 and Story 17.22 stay closed at their delivered scope.
- **Unrelated defect observed while tracing this one, not fixed here:**
  `skills/git-workflow-skill/scripts/start-feature.sh` hard-errors on this repo. It
  requires `origin/dev` (`"Branch 'dev' does not exist on remote"`) and bases new
  worktrees on `origin/dev`, but this repo's trunk is `main` and no `dev` branch
  exists. The worktree for this fix had to be created manually. Worth its own bug.
- **Third unrelated defect observed, gitignore mitigated here but root cause NOT
  fixed:** `scripts/build-plugin.js:179` creates a staging dir
  `lib/.bmad-extension-plugin.build-<pid>-<timestamp>/` and **leaks it** — one
  `npm run build:plugin` plus `node test/build-plugin.test.js` left two of them behind
  in this worktree, and the main working tree carries an older orphan
  (`lib/.bmad-extension-plugin.build-22196-1786847380521/`, untracked at the time this
  bug was filed). The directory was also **never gitignored**, unlike its two siblings
  `.ma-agents-plugin-stage/` (Story 22.8) and `.ma-agents-custom-marketplace-stage/`
  (Story 30.6b), so a leaked stage lands silently in any `git add -A` — it did exactly
  that in this fix's first commit and had to be removed. A `lib/.bmad-extension-plugin.build-*/`
  rule was added to `.gitignore` here to stop the bleeding, but **the leak is not
  fixed**: build-plugin.js should remove its staging dir on both the success and the
  throw path. Worth its own bug.

- **Local-install staleness observed, not a repo defect:** `create-bug-story` ships
  correctly — it is present in `lib/bmad-extension/skills/create-bug-story/`, listed in
  `marketplace.json.template`, and installed into `.agents/skills/`. It was
  nonetheless not invocable while this bug was filed, because this repo's own
  untracked `.claude/skills/` install is stale and partial (36 skills, containing none
  of the 12 sprint-management skills). This bug file was therefore written directly, as
  the previous six bug files were. Re-running the installer against this repo should
  repopulate `.claude/skills/`; no code change is implied.

## Change Log
