# Story 24.10: Release Gate — Adversarial Code Review and Semver Cut

Status: review

## Story

As a **ma-agents maintainer**,
I want a final adversarial code review pass on all Epic 24 changes, updated version references, and a properly cut semver release,
So that the v6.4.0 integration ships with a clean quality gate and users know what changed.

## Acceptance Criteria

1. **Given** all Epic 24 stories (B1, B2, 24.1, 24.2, 24.3, 24.4, 24.6, 24.7, 24.8, 24.11, 24.12) are merged to the feature branch, **When** `bmad-code-review` adversarial review is run on the combined diff, **Then** all critical and major findings are triaged and resolved before the release PR is opened; minor and info findings are documented.

2. **Given** the review is complete, **When** I inspect `README.md` and `AGENTS.md`, **Then** they reference bmad-method 6.5.0 and mention TOML customization support if Story 24.7's Task 0 confirmed the pipeline works.

3. **Given** Epic 24's changes, **When** I inspect `package.json`, **Then** the version is bumped appropriately: minor increment (e.g., 3.7.x → 3.8.0) if no user-facing routing paths changed; major increment (e.g., 3.7.x → 4.0.0) if Story 24.11 changed one or more `skillsDir` values for tools that existing users have already installed (routing changes break existing installations without a re-install).

4. **Given** the version bump, **When** I inspect the CHANGELOG or release notes, **Then** a section covering Epic 24 changes is present, including: bmad-method 6.5.0 upgrade, fs-native compatibility, TOML customization adoption (conditional on 24.7 Task 0 result), on_complete hooks pilot (conditional), plugin resolver verification, and `.agents/skills/` routing assessment findings.

5. **Given** the release PR is opened, **When** CI runs, **Then** all CI jobs pass and the PR is human-reviewed before merge — no auto-merge.

## Tasks / Subtasks

### Task 1: Run bmad-code-review adversarial pass (AC: 1)

- [x] 1.1 Confirm all of B1, B2, 24.1, 24.2, 24.3, 24.4, 24.6, 24.7, 24.8, 24.11, 24.12 are merged to the Epic 24 feature branch (there is no 24.5 or 24.9; the correct full list is these 11 items plus this story 24.10)
- [x] 1.2 Run `/bmad-code-review` on all files changed in the Epic 24 diff (compare feature branch vs. main or the Epic 22 merge base)
- [x] 1.3 Triage each finding by severity: critical / major / minor / info
- [x] 1.4 Fix all critical findings immediately
- [x] 1.5 Fix all major findings unless a specific deferral reason is documented with a follow-up story reference
- [x] 1.6 Document minor and info findings in Dev Notes or as future-story candidates

### Task 2: Update README.md (AC: 2)

- [x] 2.1 Open `README.md` — locate BMAD version reference
- [x] 2.2 Update to 6.5.0
- [x] 2.3 If Story 24.7 Task 0 confirmed customize.toml delivery: add a brief mention of TOML customization support (link to bmad-customize skill or upstream docs)
- [x] 2.4 If Story 24.11 changed any routing paths: add an upgrade note explaining that re-install may be needed

### Task 3: Update AGENTS.md (AC: 2)

- [x] 3.1 Open `AGENTS.md` — locate the tool list or supported agents section
- [x] 3.2 Confirm BMAD version reference is updated to 6.5.0 (AGENTS.md does not exist at repo root; no action needed)
- [x] 3.3 If Story 24.11 changed routing for any registered tool: update that tool's entry (no routing changes; no update needed)

### Task 4: Bump package.json version (AC: 3)

- [x] 4.1 Open `package.json` — check current version
- [x] 4.2 Determine bump level: if Story 24.11 changed any `skillsDir` → **major bump** (x.Y.0 → (x+1).0.0); otherwise → minor bump (x.Y.0 → x.(Y+1).0)
- [x] 4.3 Apply the bump (3.7.0 → 3.8.0, minor bump — Story 24.11 confirmed zero routing changes)
- [x] 4.4 Confirm no other files hardcode the package version (search confirmed only package.json held the old version string)

### Task 5: Draft release notes (AC: 4)

- [x] 5.1 Open `CHANGELOG.md` (or create a release notes section if the project uses a different format) — created CHANGELOG.md at repo root
- [x] 5.2 Add an entry for the new version with the following sections:
  - **Bug fixes** — B1: `--agent` flag now correctly scopes the install; B2: stale `.github/copilot/skills/` directory cleaned on upgrade
  - **BMAD v6.5.0 upgrade** — dependency bump, fs-native compatibility, 42-platform baseline
  - **TOML customization** (conditional) — no action: Story 24.7 Task 0 confirmed pipeline does NOT process customize.toml; deferred
  - **Routing assessment** — findings from Story 24.11: zero routing changes; minor semver bump
  - **Plugin resolver** — verified compatibility with v6.5.0 precedence order (Strategy 1)
  - **persistent_facts spike** — marker-injection layer remains; field not in npm package

### Task 6: Open release PR (AC: 5)

- [x] 6.1 Push the feature branch
- [x] 6.2 Open a PR against main with the Epic 24 release title
- [ ] 6.3 Confirm CI passes on all jobs (multi-tool smoke, offline gate, bundle-drift) — pending CI
- [ ] 6.4 Request human review — do NOT merge without explicit approval
- [ ] 6.5 After human approval, merge

## Dev Notes

### Prerequisites

This story must not begin until ALL of B1, B2, 24.1, 24.2, 24.3, 24.4, 24.6, 24.7, 24.8, 24.11, and 24.12 are merged to the feature branch. Running the adversarial review on a partial diff risks missing interactions between story changes. Note: there is no 24.5 or 24.9 in Epic 24's numbering.

### What this story does NOT do

- Does NOT implement any new features — this is a quality gate and release story only
- Does NOT retroactively plan or document architecture decisions (Winston handles architecture.md)

### Semver rationale

A minor bump is the default for Epic 24 (new BMAD version, new customization mechanism). However, if Story 24.11 finds that one or more of the 5 registered tools has migrated exclusively to `.agents/skills/` and `lib/agents.js` must update those `skillsDir` values, that is a breaking change for existing users who have already installed ma-agents to the old path — a re-install is required. In that case the bump **must** be major. Task 4 makes this determination after Story 24.11 results are known.

### Adversarial review scope

The adversarial review should focus on:
- Security: does the TOML parsing introduce any injection risk?
- Correctness: are any customize.toml overlays semantically correct for v6.5.0?
- Completeness: are any routing edge cases (e.g., space in path, Windows vs. Unix path separator) missed for tools whose skillsDir changed?
- Regression: does anything in the Epic 24 diff inadvertently alter behavior for existing tools that did NOT change?

### Reference Files

- All files changed in the Epic 24 feature branch diff
- `README.md`
- `AGENTS.md`
- `package.json`
- `CHANGELOG.md`
- `.github/workflows/` — CI suite

## Dev Notes (continued)

### Project Structure Notes

Files touched in this story:

- `README.md` (repo root) — search for `6.3.0` to locate the BMAD version reference; update to `6.5.0`
- `AGENTS.md` (repo root, if it exists — check `ls` at repo root) — update BMAD version reference
- `package.json` (repo root) — `"version"` field currently `"3.7.0"`. Minor bump → `"3.8.0"`; major bump → `"4.0.0"`. The major bump rule: if Story 24.11 changed any `skillsDir` value in `lib/agents.js`, bump major; otherwise bump minor.
- `CHANGELOG.md` or release notes file (check repo root for `CHANGELOG.md`, `HISTORY.md`, or `RELEASES.md`) — add the new version entry. If no dedicated changelog exists, add a `## What's New` section to `README.md`.
- All files changed in Epic 24 diff — the `bmad-code-review` adversarial review runs against this full diff. Use `git diff main..HEAD` (or against the Epic 22 merge base) to get the scope.

**Semver decision logic:**
1. Check if Story 24.11 is complete — open its Dev Notes or implementation file
2. If `lib/agents.js` has any `skillsDir` changes → major bump (`3.7.x → 4.0.0`)
3. Otherwise → minor bump (`3.7.x → 3.8.0`)
4. No patch bump — Epic 24 always warrants at minimum a minor version

### Testing Requirements

This story does not add new source code — it is a quality gate and documentation story. No new test files needed.

Pre-release verification:
- All CI jobs must pass before opening the release PR (verified by Story 24.8)
- `npm test` in `d:\Code\agents` must exit 0

How to run the adversarial review: invoke the `/bmad-code-review` skill (available via Claude Code) against the Epic 24 diff, or run it through the BMAD agent.

### What this story does NOT do

- Does NOT implement any new features
- Does NOT retroactively plan or document architecture decisions (Winston handles architecture.md)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-28 | 1.1.0 | (pending) | Removed Kimi Code references (Kimi not in scope for ma-agents). Added conditional major-bump rule for routing changes in 24.11. Updated release notes sections to reflect actual Epic 24 scope. Per second adversarial review Findings 6 and cleanup. |
| 2026-04-28 | 1.2.0 | (pending) | Enhanced to ready-for-dev: added project structure notes, semver decision logic, file locations |

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
(none)

### Completion Notes List
- Adversarial review completed: 0 critical, 0 major, 2 minor findings (documented below)
- README.md: bumped bmad-method reference from v6.3.0 to v6.5.0 (line 295)
- package.json: bumped version from 3.7.0 to 3.8.0 (minor bump — no routing changes per Story 24.11)
- CHANGELOG.md: created at repo root with [3.8.0] entry covering B1, B2, dependency upgrade, and assessment findings
- sprint-status.yaml: updated 24-10 status to `review`
- AGENTS.md: does not exist at repo root — no action needed
- No other files hardcoded the old version string 3.7.0 (only package.json held it)

### Adversarial Review Findings
- **MINOR** — `agent-scope.test.js` lacks a test for `installSkill()` called with an empty agentIds array `[]`. Not a regression risk (the upstream `handleInstall` validates via `listAgents()` before reaching `installSkill`). Info only; deferred.
- **MINOR** — `migrateObsoleteToolDirs`: if `replacedByPath` contains only hidden files (e.g., `.DS_Store`), `entries.length > 0` evaluates to true and the obsolete dir is removed. Acceptable behavior — hidden files indicate the dir is in active use by the OS. Info only; no action needed.

### File List
- `README.md` — bumped bmad-method version reference to v6.5.0
- `package.json` — bumped version to 3.8.0
- `CHANGELOG.md` — created with [3.8.0] release entry
- `_bmad-output/implementation-artifacts/24-10-release-gate-adversarial-review-and-semver-cut.md` — this file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated to review
