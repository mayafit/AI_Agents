# Sprint Change Proposal — Epic 5 & Epic 6 Story Corrections

**Date:** 2026-03-13
**Triggered by:** Adversarial review of Epic 5 & Epic 6 stories
**Scope:** Minor — story/requirement refinements only
**Approved by:** Alon

## Section 1: Issue Summary

An adversarial review of Epic 5 (Self-Contained Installer) and Epic 6 (Methodology Onboarding Package) stories identified 12 findings across scope mismatches, missing acceptance criteria, stale data, missing cross-references, and traceability gaps. No architectural changes or epic reordering required — all findings resolved via direct story and requirement amendments.

## Section 2: Impact Analysis

### Epic Impact

- **Epic 5** — Stories refined with scope clarification, failure criteria, dynamic agent counts, binary size limits, CI/CD scoping, Phase 2 cross-references, and research validity notes
- **Epic 6** — Stories refined with content review process, --force flag clarification, update path AC, Phase 2 cross-references, and Story 6.2 deferral documentation. FR72 added to PRD for traceability.
- **No other epics impacted**

### Artifact Changes

| Artifact | Changes |
|----------|---------|
| PRD (`prd.md`) | Added FR72 (Methodology Onboarding) |
| Epics (`epics.md`) | Updated Epic 5 & 6 headers with Phase 2 dependencies, FR72 reference, Story 6.2 deferral note, FR Coverage Map entry |
| Story 5.1 | Added scope clarification, AC #4 (failure scenario), research validity note |
| Story 5.2 | Fixed agent count (dynamic language), added AC #6 (size limit), CI/CD scoping note, Phase 2 cross-refs, updated references |
| Story 6.1 | Added content review tasks, --force semantics clarification, AC #5 (update path), Phase 2 cross-refs |

### Technical Impact

None. All changes are documentation-level refinements to story acceptance criteria and dev notes.

## Section 3: Recommended Approach

**Selected: Direct Adjustment** — All 12 findings resolved by modifying existing stories and adding one FR to the PRD.

- Effort: Low
- Risk: Low
- Timeline impact: None — stories remain ready-for-dev with improved clarity

## Section 4: Detailed Change Log

### Finding 1: Phase scope mismatch (Epic 5 / FR44-FR45)
**Resolution:** Added scope clarification to Story 5.1 explaining existing Phase 1 air-gap capability vs. the new npm-free gap.

### Finding 2: No failure criteria (Story 5.1)
**Resolution:** Added AC #4 with exit criteria if all three packaging tools fail, including alternative approaches to evaluate.

### Finding 3: Agent count stale — 11 vs 12 (Story 5.2)
**Resolution:** Changed AC #4 from hardcoded "11 agents" to dynamic "all registered agents (currently 12, including OpenCode per FR56)".

### Finding 4: No binary size limit (Story 5.2)
**Resolution:** Added AC #6 with 100MB per-platform limit and warning/approval gate.

### Finding 5: No CI/CD integration story (Story 5.2)
**Resolution:** Added "CI/CD & Distribution (Out of Scope)" dev note explicitly deferring to future Story 5.3.

### Finding 6: Content/engineering conflation (Story 6.1)
**Resolution:** Added Task 1.2a (content source: compile from existing docs) and Task 1.2b (content review: Alon approves before merge).

### Finding 7: --force flag semantics conflict (Story 6.1)
**Resolution:** Added clarifying note to AC #2 confirming --force semantics are consistent (--yes skips prompts, --force forces overwrites).

### Finding 8: No update path for methodology (Epic 6)
**Resolution:** Added AC #5 to Story 6.1 confirming update/upgrade uses same version-check code path.

### Finding 9: Missing Story 6.2 implementation artifact
**Resolution:** Added deferral note to Story 6.2 in epics file documenting that it's not in sprint, no artifact exists, and can be added later.

### Finding 10: No Phase 2 cross-references
**Resolution:** Added Phase 2 dependency notes to Story 5.2 dev notes, Story 6.1 dev notes, Epic 5 header, and Epic 6 header.

### Finding 11: Research staleness risk (Story 5.1)
**Resolution:** Added research validity note — re-validate if not acted on within 3 months.

### Finding 12: No FR for Epic 6
**Resolution:** Added FR72 to PRD. Updated Epic 6 to reference FR72. Added FR72 to FR Coverage Map.

## Section 5: Implementation Handoff

**Change scope: Minor** — Direct implementation by dev team. No backlog reorganization or strategic replan needed.

**Handoff:** Development team can proceed with stories as-is. All stories remain in `ready-for-dev` status with improved acceptance criteria and context.

**Success criteria:** Stories implemented per updated acceptance criteria. No sprint status changes required.
