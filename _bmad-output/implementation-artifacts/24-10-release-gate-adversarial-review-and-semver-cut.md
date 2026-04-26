# Story 24.10: Release Gate — Adversarial Code Review and Semver Cut

Status: backlog

## Story

As a **ma-agents maintainer**,
I want a final adversarial code review pass on all Epic 24 changes, updated version references, and a properly cut semver release,
So that the v6.4.0 integration ships with a clean quality gate and users know what changed.

## Acceptance Criteria

1. **Given** all Epic 24 stories (24.1-24.9) are merged to the feature branch, **When** `bmad-code-review` adversarial review is run on the combined diff, **Then** all critical and major findings are triaged and resolved before the release PR is opened; minor and info findings are documented.

2. **Given** the review is complete, **When** I inspect `README.md` and `AGENTS.md`, **Then** they reference bmad-method 6.4.0, document Kimi Code as a supported tool, and mention TOML customization support.

3. **Given** Epic 24 adds a new tool target (Kimi Code) and a new customization layer (TOML), **When** I inspect `package.json`, **Then** the version is bumped by a minor increment from the previous release (e.g., 3.7.x → 3.8.0).

4. **Given** the version bump, **When** I inspect the CHANGELOG or release notes, **Then** a section covering Epic 24 changes is present, including: bmad-method 6.4.0 upgrade, Kimi Code support, TOML customization adoption, on_complete hooks pilot, and plugin resolver verification.

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

- [ ] 2.1 Open `README.md` — locate BMAD version reference (currently 6.3.0)
- [ ] 2.2 Update to 6.4.0
- [ ] 2.3 Add `kimi-code` to the supported tools list/table if it is present elsewhere in the README
- [ ] 2.4 Add a brief mention of TOML customization support (link to bmad-customize skill or upstream docs)

### Task 3: Update AGENTS.md (AC: 2)

- [ ] 3.1 Open `AGENTS.md` — locate the tool list or supported agents section
- [ ] 3.2 Add Kimi Code entry if missing
- [ ] 3.3 Confirm BMAD version reference is updated to 6.4.0

### Task 4: Bump package.json version (AC: 3)

- [ ] 4.1 Open `package.json` — check current version
- [ ] 4.2 Bump the minor version (x.Y.0 format) — e.g., if current is 3.7.x, new version is 3.8.0
- [ ] 4.3 Confirm no other files hardcode the package version (search for the old version string)

### Task 5: Draft release notes (AC: 4)

- [ ] 5.1 Open `CHANGELOG.md` (or create a release notes section if the project uses a different format)
- [ ] 5.2 Add an entry for the new version with the following sections:
  - **BMAD v6.4.0 upgrade** — dependency bump, fs-native compatibility
  - **Kimi Code support** — new `--tools kimi-code` option, `.kimi/skills/` deployment
  - **TOML customization** — customize.toml overlays for forked skills, bmad-customize skill
  - **on_complete hooks** — pilot integration with AiAudit.md for bmad-dev-story
  - **Plugin resolver** — verified compatibility with v6.4.0 precedence fix
  - **CI** — Kimi Code added to multi-tool smoke matrix

### Task 6: Open release PR (AC: 5)

- [ ] 6.1 Push the feature branch
- [ ] 6.2 Open a PR against main with the Epic 24 release title
- [ ] 6.3 Confirm CI passes on all jobs (multi-tool smoke including kimi-code, offline gate, bundle-drift)
- [ ] 6.4 Request human review — do NOT merge without explicit approval
- [ ] 6.5 After human approval, merge

## Dev Notes

### Prerequisites

This story must not begin until ALL of 24.1-24.9 are merged to the feature branch. Running the adversarial review on a partial diff risks missing interactions between story changes.

### What this story does NOT do

- Does NOT implement any new features — this is a quality gate and release story only
- Does NOT retroactively plan or document architecture decisions (Winston handles architecture.md)

### Semver rationale

Adding Kimi Code (new user-facing feature) and adopting TOML customization (new behavior mechanism) both warrant a minor version bump. A patch bump would be insufficient; a major bump would require a breaking change that Epic 24 does not introduce.

### Adversarial review scope

The adversarial review should focus on:
- Security: does the TOML parsing introduce any injection risk?
- Correctness: are the customize.toml overlays semantically correct for v6.4.0?
- Completeness: are any Kimi Code edge cases (e.g., space in path, Windows vs. Unix path separator) missed?
- Regression: does anything in the Epic 24 diff inadvertently alter behavior for existing tools?

### Reference Files

- All files changed in the Epic 24 feature branch diff
- `README.md`
- `AGENTS.md`
- `package.json`
- `CHANGELOG.md`
- `.github/workflows/` — CI suite

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
