# Story 24.10: Release Gate — Adversarial Code Review and Semver Cut

Status: ready-for-dev

## Story

As a **ma-agents maintainer**,
I want a final adversarial code review pass on all Epic 24 changes, updated version references, and a properly cut semver release,
So that the v6.4.0 integration ships with a clean quality gate and users know what changed.

## Acceptance Criteria

1. **Given** all Epic 24 stories (24.1-24.9) are merged to the feature branch, **When** `bmad-code-review` adversarial review is run on the combined diff, **Then** all critical and major findings are triaged and resolved before the release PR is opened; minor and info findings are documented.

2. **Given** the review is complete, **When** I inspect `README.md` and `AGENTS.md`, **Then** they reference bmad-method 6.5.0 and mention TOML customization support if Story 24.7's Task 0 confirmed the pipeline works.

3. **Given** Epic 24's changes, **When** I inspect `package.json`, **Then** the version is bumped appropriately: minor increment (e.g., 3.7.x → 3.8.0) if no user-facing routing paths changed; major increment (e.g., 3.7.x → 4.0.0) if Story 24.11 changed one or more `skillsDir` values for tools that existing users have already installed (routing changes break existing installations without a re-install).

4. **Given** the version bump, **When** I inspect the CHANGELOG or release notes, **Then** a section covering Epic 24 changes is present, including: bmad-method 6.5.0 upgrade, fs-native compatibility, TOML customization adoption (conditional on 24.7 Task 0 result), on_complete hooks pilot (conditional), plugin resolver verification, and `.agents/skills/` routing assessment findings.

5. **Given** the release PR is opened, **When** CI runs, **Then** all CI jobs pass and the PR is human-reviewed before merge — no auto-merge.

## Tasks / Subtasks

### Task 1: Run bmad-code-review adversarial pass (AC: 1)

- [ ] 1.1 Confirm Stories 24.1-24.9 are all merged to the Epic 24 feature branch
- [ ] 1.2 Run `/bmad-code-review` on all files changed in the Epic 24 diff (compare feature branch vs. main or the Epic 22 merge base)
- [ ] 1.3 Triage each finding by severity: critical / major / minor / info
- [ ] 1.4 Fix all critical findings immediately
- [ ] 1.5 Fix all major findings unless a specific deferral reason is documented with a follow-up story reference
- [ ] 1.6 Document minor and info findings in Dev Notes or as future-story candidates

### Task 2: Update README.md (AC: 2)

- [ ] 2.1 Open `README.md` — locate BMAD version reference
- [ ] 2.2 Update to 6.5.0
- [ ] 2.3 If Story 24.7 Task 0 confirmed customize.toml delivery: add a brief mention of TOML customization support (link to bmad-customize skill or upstream docs)
- [ ] 2.4 If Story 24.11 changed any routing paths: add an upgrade note explaining that re-install may be needed

### Task 3: Update AGENTS.md (AC: 2)

- [ ] 3.1 Open `AGENTS.md` — locate the tool list or supported agents section
- [ ] 3.2 Confirm BMAD version reference is updated to 6.5.0
- [ ] 3.3 If Story 24.11 changed routing for any registered tool: update that tool's entry

### Task 4: Bump package.json version (AC: 3)

- [ ] 4.1 Open `package.json` — check current version
- [ ] 4.2 Determine bump level: if Story 24.11 changed any `skillsDir` → **major bump** (x.Y.0 → (x+1).0.0); otherwise → minor bump (x.Y.0 → x.(Y+1).0)
- [ ] 4.3 Apply the bump
- [ ] 4.4 Confirm no other files hardcode the package version (search for the old version string)

### Task 5: Draft release notes (AC: 4)

- [ ] 5.1 Open `CHANGELOG.md` (or create a release notes section if the project uses a different format)
- [ ] 5.2 Add an entry for the new version with the following sections:
  - **BMAD v6.5.0 upgrade** — dependency bump, fs-native compatibility, 42-platform baseline
  - **TOML customization** (conditional) — customize.toml delivery confirmed; bmad-customize skill; on_complete hooks pilot
  - **Routing assessment** — findings from Story 24.11: `.agents/skills/` standard impact; any skillsDir changes
  - **Plugin resolver** — verified compatibility with v6.5.0 precedence order
  - **persistent_facts spike** — decision record from Story 24.12 (marker-injection future or exit)

### Task 6: Open release PR (AC: 5)

- [ ] 6.1 Push the feature branch
- [ ] 6.2 Open a PR against main with the Epic 24 release title
- [ ] 6.3 Confirm CI passes on all jobs (multi-tool smoke, offline gate, bundle-drift)
- [ ] 6.4 Request human review — do NOT merge without explicit approval
- [ ] 6.5 After human approval, merge

## Dev Notes

### Prerequisites

This story must not begin until ALL of 24.1-24.9 are merged to the feature branch. Running the adversarial review on a partial diff risks missing interactions between story changes.

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
(to be filled by implementing agent)

### Debug Log References
(none)

### Completion Notes List
(none — story not yet implemented)

### File List
(to be filled by implementing agent)
