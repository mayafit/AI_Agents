# Sprint Change Proposal — Epic 7: Test Suite Foundation Corrections

**Date:** 2026-03-13
**Triggered by:** Adversarial review of Epic 7 (13 findings)
**Scope:** Minor — epic description and story acceptance criteria rewrites
**Status:** Approved and applied
**Approved by:** Alon

## Section 1: Issue Summary

An adversarial review of Epic 7 (Test Suite Foundation) identified 13 findings exposing systemic issues across all 4 stories. The findings fall into 5 categories:

1. **Hardcoded values** — Agent count (11 vs 12), command lists, stage counts that will break as the codebase evolves
2. **Pre-empted decisions** — Story 7.1 assumes Node.js built-in test runner despite the architecture marking this as "Needs decision"
3. **Zero PRD traceability** — Epic 7 mapped to no functional requirements
4. **Untestable acceptance criteria** — Stories 7.3 and 7.4 contained hand-waves disguised as testable criteria ("correct order", "failure prevents subsequent stages")
5. **Missing cross-cutting concerns** — No test isolation strategy, no coverage targets, no template resolution edge cases, incomplete CLI command coverage

No implementation has started — all 4 stories are in `ready-for-dev` status, making this a low-risk editorial correction.

**Evidence sources:** Architecture document (testing framework "Needs decision" at Phase 2 Decisions table; 12 agents including OpenCode per Decision P2-2; template resolution priority chain as cross-cutting concern). PRD (no FR for automated testing; Gap Analysis line 794 acknowledges Epic 7 maps to architecture requirements only).

## Section 2: Impact Analysis

### Epic Impact

- **Epic 7** — Complete rewrite of epic description, all 4 story acceptance criteria, and addition of epic-level metadata (dependencies, isolation strategy, coverage targets, audience declaration)
- **No other epics structurally impacted** — Epic 9 (OpenCode) affects agent count, addressed by making Story 7.1 assertions dynamic

### Artifact Changes

| Artifact | Changes |
|----------|---------|
| PRD (`prd.md`) | Add FR73 (Developer Infrastructure — automated regression tests for 4 core modules) |
| Epics (`epics.md`) | Rewrite Epic 7 description (both summary and detail locations), rewrite all 4 stories |
| Sprint status (`sprint-status.yaml`) | No changes — story IDs unchanged, all remain `ready-for-dev` |

### Story-Level Change Summary

| Story | Key Changes |
|-------|------------|
| 7.1 | Remove hardcoded "11 agents" → dynamic registry assertion. Remove assumed "Node.js built-in test runner" → "chosen test framework" with prerequisite. Add `injectionStrategy` verification. Add isolation note. |
| 7.2 | Expand template resolution from 1 bullet to 5 dedicated Given/When/Then scenarios (agent-specific, generic, SKILL.md, missing template, all fallbacks fail). Replace vague NFR5 bullet with concrete file-level additive-only verification. Add manifest atomicity failure simulation. |
| 7.3 | Replace vague "correct order" with call-order recorder instrumentation approach. Replace "failure prevents subsequent stages" with 3 specific failure injection scenarios at boundary points (pre-recompile, recompile, post-recompile). Add isolation note (stub recompile). |
| 7.4 | Replace hardcoded command list with dynamic registry assertion. Add BMAD-specific command routing verification. Add interactive/non-interactive boundary tests (TTY + `--yes` flag). Add isolation note (stub handlers). |

### Technical Impact

None. All changes are documentation-level refinements to story acceptance criteria. No code, infrastructure, or deployment changes.

## Section 3: Recommended Approach

**Selected: Direct Adjustment** — Revise Epic 7 description and all 4 stories in place.

- **Effort:** Medium (editorial rewrite of ~120 lines across epic description and 4 stories)
- **Risk:** Low (no implementation exists — all stories are `ready-for-dev`)
- **Timeline impact:** None — stories remain ready-for-dev with significantly improved clarity and testability

**Rationale:** This is purely a documentation quality correction. No structural changes to the epic plan, no story additions or removals, no epic reordering. The fixes address real defects that would have caused implementation problems (wrong agent counts, assumed framework, untestable criteria).

**Alternatives considered:**
- *Rollback:* N/A — no implementation to roll back
- *MVP Review:* N/A — Epic 7 is internal infrastructure, not MVP scope

## Section 4: Detailed Change Proposals

### 4.1 PRD Amendment — Add FR73

**File:** `_bmad-output/planning-artifacts/prd.md`
**Section:** New section after "Sprint Management (Phase 2)"

Add:
```
### Developer Infrastructure (Phase 2)

- FR73: The 4 core modules (cli.js, installer.js, agents.js, bmad.js) have automated regression tests that verify architectural contracts (pipeline ordering, additive-only operations, template resolution, command routing)
```

### 4.2 Epic 7 Description — Summary Location

**File:** `_bmad-output/planning-artifacts/epics.md`
**Lines:** 206-209

Replace epic summary with:
- Contributor-facing framing (not user-facing)
- FR73 traceability
- NFR8 added to NFRs verified
- Dependencies declaration (testing framework decision)
- Test isolation strategy
- Coverage targets

### 4.3 Epic 7 Description — Detail Location

**File:** `_bmad-output/planning-artifacts/epics.md`
**Lines:** 570-572

Replace with expanded description including:
- FR73 reference
- Explicit dependency on testing framework decision and Epic 9
- Cross-story test isolation strategy
- Coverage targets with template resolution edge cases
- Audience declaration

### 4.4 Story 7.1 Rewrite

**Key changes:** Dynamic agent count assertion, framework-agnostic prerequisites, injectionStrategy verification, OpenCode awareness, isolation note.

### 4.5 Story 7.2 Rewrite

**Key changes:** 5 dedicated template resolution scenarios, concrete NFR5 file-level test, manifest atomicity failure simulation, explicit isolation approach.

### 4.6 Story 7.3 Rewrite

**Key changes:** Call-order recorder instrumentation, 3 boundary failure injection scenarios, explicit recompile stub isolation.

### 4.7 Story 7.4 Rewrite

**Key changes:** Dynamic command registry assertion, BMAD command routing, interactive/non-interactive boundary tests, handler stub isolation.

## Section 5: Implementation Handoff

**Change scope: Minor** — Direct implementation by development team. No backlog reorganization or strategic replan needed.

**Handoff recipients:**
- **Development team:** Implement stories per updated acceptance criteria
- **No PO/SM action required:** Story IDs unchanged, sprint status unchanged

**Success criteria:**
- All 6 approved change proposals applied to `prd.md` and `epics.md`
- Stories implemented per updated acceptance criteria
- Test suite passes `npm test` with coverage across all 4 modules
- No hardcoded counts, no assumed framework, all tests isolated

**Next steps:**
1. Apply approved changes to `prd.md` and `epics.md`
2. Finalize testing framework architectural decision (prerequisite for Story 7.1)
3. Proceed with story implementation in order (7.1 → 7.2 → 7.3 → 7.4)
