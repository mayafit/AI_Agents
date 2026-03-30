# Story 16.6: Repository Sync Check Skill

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer using multi-repo layout**,
I want a skill or workflow that checks whether my external repos are in sync and properly scaffolded,
So that I catch stale clones and missing directory structures before agents fail at runtime.

## Problem Context

Epic 16 stories 16.1-16.4 let users point to external repos for knowledgebase and sprint management, but:
- **No scaffolding:** The external repo is never checked for the expected `_bmad-output/planning-artifacts/` and `_bmad-output/implementation-artifacts/` directory structure. A freshly created empty repo will cause every workflow to fail.
- **No sync:** Remote repos are cloned once during installation. After that, there is no pull, fetch, or freshness check. Local clones go stale silently.

This skill provides a pre-flight check that agents or users can run to validate external repo readiness.

## Acceptance Criteria

1. **Given** a multi-repo layout is configured, **When** the user runs the repo-sync-check skill (or an agent runs it as pre-flight), **Then** it reads `_bmad/bmm/config.yaml` to discover the `knowledgebase_path` and `sprint_management_path`
2. **Given** an external knowledgebase path, **When** the path does not exist on disk, **Then** the skill reports an error: "Knowledgebase path does not exist: {path}" and advises the user to re-run the installer or create the directory
3. **Given** an external path that exists, **When** `_bmad-output/planning-artifacts/` is missing inside it, **Then** the skill reports a warning: "Missing directory structure — run scaffolding" and offers to create the expected directories
4. **Given** an external path that is a git repo, **When** the local branch is behind the remote tracking branch, **Then** the skill reports: "Local clone is {N} commits behind remote — consider running git pull" with the specific count
5. **Given** an external path that is a git repo, **When** there are uncommitted local changes, **Then** the skill reports: "Local clone has uncommitted changes — commit or stash before pulling"
6. **Given** an external path that is a git repo with no remote configured, **Then** the skill reports info: "No remote tracking branch — sync check skipped (local-only repo)"
7. **Given** a single-repo layout (both paths are `.`), **When** the skill runs, **Then** it reports: "Single-repo layout — no external repos to check" and exits cleanly
8. **Given** the skill detects missing scaffolding, **When** the user confirms, **Then** the skill creates the missing directories: `_bmad-output/planning-artifacts/` and/or `_bmad-output/implementation-artifacts/` with a `.gitkeep` file in each

## Tasks / Subtasks

- [x] Task 1: Create the skill definition file
  - [x] 1.1 Create `.claude/skills/repo-sync-check/SKILL.md` (following existing skill pattern)
  - [x] 1.2 Define skill metadata: name, description, trigger conditions
  - [x] 1.3 The skill should be invocable via `/repo-sync-check` command

- [x] Task 2: Implement config reading
  - [x] 2.1 Read `_bmad/bmm/config.yaml` for `knowledgebase_path` and `sprint_management_path`
  - [x] 2.2 If both are `.` (same), report single-repo and exit
  - [x] 2.3 Also read `_bmad-output/project-layout.yaml` for gitUrl information (needed for remote checks)

- [x] Task 3: Implement path existence and scaffolding checks
  - [x] 3.1 For each external path: verify the directory exists
  - [x] 3.2 Check for `_bmad-output/planning-artifacts/` inside knowledgebase path
  - [x] 3.3 Check for `_bmad-output/implementation-artifacts/` inside sprint management path
  - [x] 3.4 Offer to create missing directories with `.gitkeep` files

- [x] Task 4: Implement git sync checks
  - [x] 4.1 For each external path that contains `.git`: run `git fetch` (non-destructive) to update remote refs
  - [x] 4.2 Compare local HEAD with remote tracking branch using `git rev-list --count HEAD..@{u}`
  - [x] 4.3 Check for uncommitted changes via `git status --porcelain`
  - [x] 4.4 Handle repos with no remote gracefully

- [x] Task 5: Produce advisory report
  - [x] 5.1 Output a structured markdown report with: status per concern (OK / WARNING / ERROR), specific advice for each issue found
  - [x] 5.2 Exit cleanly — this is advisory, not blocking

- [x] Task 6: Register skill in MANIFEST
  - [x] 6.1 Add entry to `.claude/skills/MANIFEST.yaml`
  - [x] 6.2 Set `applies_when` to multi-repo layout scenarios
  - [x] 6.3 Not `always_load` — only relevant when multi-repo is configured

## Dev Notes

### Skill vs Workflow Decision

This should be a **skill** (not a workflow) because:
- It's a short, self-contained check — no multi-step workflow needed
- It should be easy to invoke manually (`/repo-sync-check`) or as a pre-flight step
- It reads config and runs git commands — matches skill pattern

### Git Commands (Safe, Read-Only)

All git operations are read-only except `git fetch` which only updates remote refs:
```bash
git fetch                           # update remote refs (safe)
git rev-list --count HEAD..@{u}     # commits behind remote
git status --porcelain              # uncommitted changes
git remote -v                       # check if remote exists
```

### Config Reading Pattern

Match the existing LLM-instruction pattern: the skill tells Claude to read config.yaml and extract paths. No need for a JS parser — this is an agent skill, not installer code.

### References

- [Source: Adversarial Review Findings #3 (no scaffolding) and #4 (no sync)]
- [Source: bin/cli.js — writeRepoLayoutConfig() for config format]
- [Source: bin/cli.js — writeProjectLayoutYaml() for layout file format]

## Dev Agent Record

### Implementation Plan
- Created SKILL.md as an LLM-instruction skill (not installer code) — agents read config and run git commands
- Skill provides step-by-step procedure: read config, check paths, check scaffolding, check git sync, produce report
- Registered in MANIFEST.yaml with `applies_when` triggers for multi-repo scenarios

### Completion Notes
- Skill created at `.claude/skills/repo-sync-check/SKILL.md` with YAML frontmatter
- Registered in MANIFEST.yaml — not `always_load` (only relevant for multi-repo)
- No unit tests needed — this is an agent-instruction skill (markdown), not executable code
- Skill covers all 8 ACs: config reading, path existence, scaffolding, git sync (fetch/rev-list/status), no-remote handling, single-repo exit, scaffolding creation

## File List

- `.claude/skills/repo-sync-check/SKILL.md` — New: repo sync check skill definition
- `.claude/skills/MANIFEST.yaml` — Added repo-sync-check entry
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 16-6 status
- `_bmad-output/implementation-artifacts/16-6-repo-sync-check-skill.md` — Story file updated

## Change Log

- 2026-03-28: Created repo-sync-check skill for multi-repo layout validation — path checks, scaffolding, git sync.
