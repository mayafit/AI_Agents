# Story 27.7: Release Gate — Adversarial Review, Offline-Install Verification, Semver Cut, Retrospective

Status: backlog

## Story

As the **ma-agents maintainer**,
I want an adversarial review of the upgrade, a proven air-gapped install on v6.8.0, and a clean semver cut before publishing,
So that the release cannot ship a silently-broken offline build.

**Blocked by:** Stories 27.4, 27.5, 27.6.

**FR/NFR:** NFR57, re-verifies NFR50.

## Acceptance Criteria

1. **Given** the Epic 27 diff, **When** release prep runs, **Then** the `code-review` skill plus an adversarial pass is run over the diff and findings are triaged and addressed.

2. **Given** a network-blocked environment (container/VM or CI with network disabled), **When** `npx ma-agents install` runs, **Then** it completes successfully with the full bundled module set built from v6.8.0 and makes zero network calls on the install path (NFR57/NFR50).

3. **Given** the delivery target, **When** the full test suite runs, **Then** it is green on **both** Linux/CI and Windows (the CRLF confounder is resolved, not waived).

4. **Given** a green gate, **When** the release is cut, **Then** a new ma-agents semver version is published per the project's versioning strategy and `CHANGELOG.md` is updated.

5. **Given** the epic is complete, **When** the retrospective convention is followed, **Then** an Epic 27 retrospective is captured (optional status permitted).

## Tasks / Subtasks

### Task 1: Review (AC: 1)

- [ ] 1.1 Run the `code-review` skill over the full Epic 27 diff
- [ ] 1.2 Run an adversarial pass focused on the offline path and the fail-loud guard
- [ ] 1.3 Triage and address findings

### Task 2: Offline-install gate (AC: 2)

- [ ] 2.1 Run `npx ma-agents install` with all egress blocked; confirm success + full module set from v6.8.0
- [ ] 2.2 Confirm zero network calls on the install path (reuse the Epic 22 / NFR50 offline CI gate)

### Task 3: Cross-platform suite (AC: 3)

- [ ] 3.1 `npm test` green on Linux/CI
- [ ] 3.2 `npm test` green on Windows (CRLF resolved)

### Task 4: Release + retro (AC: 4, 5)

- [ ] 4.1 Cut the new semver; update `CHANGELOG.md`
- [ ] 4.2 Capture the Epic 27 retrospective

## Dev Notes

- The offline gate (AC 2) is the single most important acceptance check in this epic — it is the requirement the registry removal threatened.
- Reuse the offline CI gate established in Epic 22 (NFR50).
