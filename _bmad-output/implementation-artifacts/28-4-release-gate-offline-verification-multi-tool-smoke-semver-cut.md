# Story 28.4: Release Gate — Offline-Install Verification, Multi-Tool Smoke, Semver Cut

Status: review

## Story

As the **ma-agents maintainer**,
I want a proven air-gapped install on v6.9.0, a multi-tool smoke across the flagship platforms, a fully green suite, and a clean semver cut before publishing,
So that the release cannot ship a silently-broken offline build.

**Blocked by:** Stories 28.1, 28.2, 28.3.

**FR/NFR:** NFR58, FR211; re-asserts NFR2/NFR54/NFR57/NFR56.

## Acceptance Criteria

1. **Given** a network-blocked environment (container/VM or CI with network disabled), **When** `npx ma-agents install` runs, **Then** it completes successfully with the full bundled module set (**tea, bmb, cis, gds, wds**) built from v6.9.0 and makes zero network calls on the install path; and the NFR56 thin-cache fail-loud guard is confirmed still holding for the v6.9.0 cache build (NFR58, re-asserts NFR2/NFR54/NFR57).

2. **Given** the flagship five tools — **claude-code, copilot, cline, roo-code, kilocode** — **When** an install smoke is run, **Then** each installs cleanly against the v6.9.0 cache + the ma-agents extension plugin (no PluginResolver error, no orphaned-skill reference, `bmad-forge-idea` present).

3. **Given** the delivery target, **When** the full test suite runs, **Then** `npm test` is green on **both** Linux/CI and Windows (the CRLF confounder remains resolved from Epic 27, not waived).

4. **Given** a green gate, **When** the release is cut, **Then** a new ma-agents semver version is published per the project's versioning strategy and `CHANGELOG.md` is updated (a v6.9.0 feature-inheriting integration with no breaking change to the ma-agents public CLI surface — consistent with prior integration epics' MINOR cut).

## Tasks / Subtasks

### Task 1: Offline-install gate (AC: 1)

- [ ] 1.1 Run `npx ma-agents install` with all egress blocked (container/VM or CI network disabled); confirm success + full module set (tea/bmb/cis/gds/wds) from v6.9.0
- [ ] 1.2 Confirm zero network calls on the install path (reuse the Epic 22 / NFR50 / `offline-install.yml` gate — egress-blocked run, not simulated)
- [ ] 1.3 Confirm the NFR56 thin-cache fail-loud guard still holds for the v6.9.0 build
- [ ] 1.4 On the air-gapped image, re-confirm the new core Python (`_bmad/scripts/memlog.py` and any new `_bmad/scripts/*.py`) is `python3`/stdlib-runnable without `uv` (verified in Story 28.1 AC9; this is the release-gate re-assertion against the egress-blocked image — NFR58 surface)

### Task 2: Multi-tool smoke (AC: 2)

- [ ] 2.1 Run an install smoke for claude-code, copilot, cline, roo-code, kilocode
- [ ] 2.2 Confirm each installs cleanly (no PluginResolver error, no orphaned-skill reference, `bmad-forge-idea` present)

### Task 3: Cross-platform suite (AC: 3)

- [ ] 3.1 `npm test` green on Linux/CI
- [ ] 3.2 `npm test` green on Windows (CRLF resolved, not waived)

### Task 4: Release (AC: 4)

- [ ] 4.1 Cut the new semver per the versioning strategy; bump `package.json` + `package-lock.json`; rebuild the plugin bundle
- [ ] 4.2 Update `CHANGELOG.md` (Keep-a-Changelog format)

## Dev Notes

- Mirrors Story 27.7. The offline gate (AC 1) is the single most important acceptance check in this epic — it is the air-gapped guarantee the bump must not regress.
- Reuse the repo's actual offline CI harness (the Epic 22 / NFR50 / `offline-install.yml` gate) — egress-blocked run, not simulated.
- Reuse the existing multi-tool smoke pattern from the Epic 22/24/27 verification stories.
- Versioning: consistent with prior integration epics (Epic 27 cut a MINOR, v3.13.0), a v6.9.0 feature-inheriting integration with no breaking ma-agents CLI change warrants a MINOR.
