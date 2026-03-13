# Sprint Change Proposal — Epic 8 Adversarial Review Corrections

**Date:** 2026-03-13
**Trigger:** Adversarial review of Epic 8 Stories (8.1–8.5)
**Scope:** Direct Adjustment — fix story specs, renumber for execution order, add Story 8.4
**Approved by:** Alon
**Risk:** Low (no code written yet, all stories at ready-for-dev)

---

## Section 1: Issue Summary

An adversarial review of Epic 8's 5 implementation stories identified 13 findings. After validation against actual source code (`installer.js`, `agents.js`, `bmad.js`), 11 findings are confirmed valid, 1 partially valid, and 1 dismissed. The stories contain line number errors, missed code branches, a circular dependency, ambiguous architecture decisions left to developers, incorrect Claude Code hook documentation, and a missing integration verification story.

No code has been implemented yet — all stories are at `ready-for-dev` status, so corrections are low-cost and low-risk.

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 8 scope unchanged** — still 5 FRs (FR51–FR55), same NFRs
- **Stories renumbered** to match execution order (old 8.2↔8.3 swapped, old 8.4→8.5, old 8.5→8.6)
- **One story added:** Story 8.4 (Integration Verification) — small, focused, closes the e2e gap
- **Story 8.5 corrected:** Fixed hook mechanism info (was old 8.4)
- **No other epics affected**

### Artifact Conflicts
- **PRD:** No changes needed
- **Architecture:** No changes needed
- **Epics doc:** Epic 8 section updated — renumbered stories, added Story 8.4
- **Sprint status:** Updated — renumbered entries, added `8-4-integration-verification`

---

## Section 3: Recommended Approach

**Direct Adjustment** — Renumber all stories to match execution order. Modify stories 8.1, 8.2, 8.3, 8.5 in-place. Add Story 8.4 (integration). Leave 8.6 as-is (research-only, low risk).

### Design Decisions Made (resolving ambiguities)

1. **Old customization pipeline (8.3 Task 5.2):** Keep existing `.customize.yaml` files in `lib/bmad-customizations/` during this epic. Do NOT remove them. Reason: safer migration, avoids breaking backward compat mid-epic.

2. **Extensions survival (8.3):** Verify FIRST whether `_bmad/extensions/` survives recompile. If not, deploy AFTER recompile (same pattern as workflows at bmad.js lines 128-133). This is the fallback — not a blocker.

3. **Cline dual files (8.1):** Both files get injected. The `.clinerules` file (no extension) is treated as markdown — same skip logic applies.

4. **BMAD agent MANIFEST path (8.3):** Fix `critical_actions` to use agent-specific skill paths. BMAD agents use `_bmad/skills/sre/`, `_bmad/skills/devops/`, etc.

5. **Story execution order:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 (numbering now matches order)

### Renumbering Map

| Old # | New # | Story Name |
|-------|-------|------------|
| 8.1 | 8.1 | Move Instruction Injection to TOP (unchanged) |
| 8.3 | 8.2 | Agent-Aware Injection Strategy |
| 8.2 | 8.3 | Create BMAD Extension Module |
| NEW | 8.4 | Integration Verification |
| 8.4 | 8.5 | Per-Agent Enforcement Hooks Research |
| 8.5 | 8.6 | Context Persistence Research |

---

## Section 4: Detailed Change Proposals

### Story 8.1: Move Instruction Injection to TOP Priority Position

#### Change 1: Fix branch description — three branches, not two

**OLD (Task 2):**
```
- [ ] Task 2: Change ELSE branch from append to top-insert (AC: #1, #3)
  - [ ] 2.1: At line 145 in `lib/installer.js`, replace `content += wrappedInstruction` with top-insertion logic
  - [ ] 2.2: Use `findInsertionPoint()` to determine where to insert
  - [ ] 2.3: Splice `wrappedInstruction` into content at the insertion point: `content = content.slice(0, insertIdx) + wrappedInstruction + content.slice(insertIdx)`
  - [ ] 2.4: Ensure a blank line separates the injected block from subsequent content
```

**NEW (Task 2 — covers both non-BMAD branches):**
```
- [ ] Task 2: Change non-BMAD branches from append to top-insert (AC: #1, #3)
  - [ ] 2.1: Understand the three-branch structure in `updateAgentInstructions()` (lines 138-156):
    - **IF branch** (lines 141-143): File exists AND has existing MA-AGENTS block → regex replace in-place. NO CHANGE needed.
    - **ELSE branch** (line 145): File exists, NO existing block → currently appends. CHANGE to top-insert.
    - **ELSE-IF branch** (lines 147-153): File does NOT exist AND agent is BMAD → skip (guard clause). NO CHANGE needed.
    - **Final ELSE** (lines 154-155): File does NOT exist AND agent is NOT BMAD → creates new file. CHANGE to top-insert.
  - [ ] 2.2: At line 145, replace `content += wrappedInstruction` with top-insertion using `findInsertionPoint()`
  - [ ] 2.3: Splice `wrappedInstruction` into content: `content = content.slice(0, insertIdx) + wrappedInstruction + content.slice(insertIdx)`
  - [ ] 2.4: At lines 154-155, replace `content = wrappedInstruction` with top-insertion (for new files, functionally identical but keeps logic consistent)
  - [ ] 2.5: Ensure a blank line separates the injected block from subsequent content in both branches
```

**Rationale:** The BMAD guard clause at lines 147-153 creates a third code path. The final ELSE at line 154 also needs top-insert treatment for consistency.

#### Change 2: Add dependency declaration

**ADD to Dev Notes section:**
```
### Dependencies
- **Must be implemented BEFORE Story 8.2** — This story implements the `findInsertionPoint()` logic that reads `injectionStrategy`. Story 8.2 adds the `injectionStrategy` data. This story uses a sensible default (`{ position: 'top', skipPatterns: [] }`) so it works before 8.2 is complete.
```

#### Change 3: Add Cline dual-file edge case to Task 4

**ADD after Task 4.5:**
```
  - [ ] 4.6: Cline dual instruction files — Cline has `instructionFiles: ['.cline/clinerules.md', '.clinerules']`. Both files receive injection. The `.clinerules` file (no .md extension) is treated identically — same `findInsertionPoint()` logic applies. Verify both files get correct top-insertion.
```

#### Change 4: Fix line references in Project Structure Notes

**OLD:**
```
- **Lines of interest:**
  - Line 130-132: marker definitions (`MA-AGENTS-START`, `MA-AGENTS-END`, `wrappedInstruction`)
  - Line 141-143: existing regex replace (IF branch — keep as-is)
  - Line 145: current append logic (ELSE branch — change to top-insert)
```

**NEW:**
```
- **Lines of interest:**
  - Lines 130-132: marker definitions (`MA-AGENTS-START`, `MA-AGENTS-END`, `wrappedInstruction`)
  - Lines 141-143: existing regex replace (IF branch — keep as-is)
  - Line 145: current append logic (ELSE branch — change to top-insert)
  - Lines 147-153: BMAD guard clause (ELSE-IF — keep as-is, skips BMAD files not yet deployed)
  - Lines 154-155: new non-BMAD file creation (Final ELSE — change to top-insert)
```

---

### Story 8.3: Create BMAD Extension Module Structure

#### Change 1: Resolve old pipeline ambiguity (Task 5.2 and 5.3)

**OLD:**
```
  - [ ] 5.2: The existing `.customize.yaml` files in `lib/bmad-customizations/` (for the 4 custom agents) should remain for backward compatibility during the transition, OR be removed if the extension module fully replaces them
  - [ ] 5.3: Evaluate whether `applyCustomizations()` stage 1 (lines 76-91) needs to change — if extension module handles customizations, the old copy-to-`_config/agents/` may be redundant for the 4 custom agents
```

**NEW:**
```
  - [ ] 5.2: KEEP the existing `.customize.yaml` files in `lib/bmad-customizations/` for the 4 custom agents. Do NOT remove them in this story — they provide backward compatibility during the transition. Removal deferred to a future cleanup story.
  - [ ] 5.3: Do NOT change `applyCustomizations()` stage 1 (lines 76-91) in this story. Both paths coexist: old path deploys persona/menu to `_config/agents/`, extension module adds `critical_actions`. They are complementary, not duplicative.
```

#### Change 2: Move recompile survival verification upfront

**ADD as new Task 0 (before Task 1):**
```
- [ ] Task 0: Verify extension directory survives BMAD recompile (AC: #4) — DO FIRST
  - [ ] 0.1: Create a test directory at `_bmad/extensions/test-probe/` with a dummy file
  - [ ] 0.2: Run `npx bmad-method install --yes --modules bmm --tools none`
  - [ ] 0.3: Check if `_bmad/extensions/test-probe/` still exists after recompile
  - [ ] 0.4: If YES → proceed with extension module architecture as designed
  - [ ] 0.5: If NO → deploy extension AFTER recompile in `applyCustomizations()` (same pattern as workflows at bmad.js lines 128-133). Update Task 4.6 placement accordingly.
  - [ ] 0.6: Document result in Dev Agent Record
```

**REMOVE old Task 6** (verification now upfront in Task 0; deployment in Task 4 handles post-recompile placement if needed).

#### Change 3: Fix critical_actions MANIFEST path for BMAD agents

**OLD (Task 2.5 — same block for all agents):**
```
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
```

**NEW (Task 2.5 — per-agent paths for 4 custom agents):**
```
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/_bmad/skills/<agent-slug>/MANIFEST.yaml"
```
Where `<agent-slug>` is `sre`, `devops`, `cyber`, or `mil498` respectively per file.

**NEW (Task 3.8 — for 7 built-in agents):**
```
    critical_actions:
      1: "Read the skills MANIFEST at skills/MANIFEST.yaml (relative to project root)"
```
Note: Built-in BMM agents don't have per-agent skill directories in the registry. They use the project-level skills directory.

#### Change 4: Add dependency and dismiss `{project-root}` concern

**ADD to Dev Notes:**
```
### Dependencies
- **Depends on:** Story 8.1 (injection logic) and Story 8.2 (registry metadata)
- **Recommended order:** 8.1 → 8.2 → 8.3

### Verified Assumptions
- The `{project-root}` token IS a BMAD convention — used extensively in workflow.yaml files and agent .md templates. BMAD resolves it at runtime. Verified against codebase.
```

---

### Story 8.2: Add Agent-Aware Injection Strategy to Registry

#### Change 1: Fix agent count

**OLD (Task 4.1):**
```
  - [ ] 4.1: Count all agents in the registry — should be 11 (7 IDE + 4 BMAD) plus antigravity = 12 total
```

**NEW:**
```
  - [ ] 4.1: Count all agents in the registry — should be 11 total (7 IDE + 4 BMAD). IDE agents: claude-code, gemini, copilot, kilocode, cline, cursor, antigravity. BMAD agents: bmm-sre, bmm-devops, bmm-cyber, bmm-mil498.
```

#### Change 2: Fix line number references in Tasks 1-2

**OLD:**
```
  - [ ] 2.1: Add to `bmm-sre` agent (line 150)
  - [ ] 2.2: Add to `bmm-devops` agent (line 192)
  - [ ] 2.3: Add to `bmm-cyber` agent (line 215)
  - [ ] 2.4: Add to `bmm-mil498` agent (line 234)
```

**NEW:**
```
  - [ ] 2.1: Add to `bmm-sre` agent (id at line 150)
  - [ ] 2.2: Add to `bmm-devops` agent (id at line 192)
  - [ ] 2.3: Add to `bmm-cyber` agent (id at line 213)
  - [ ] 2.4: Add to `bmm-mil498` agent (id at line 234)
```

#### Change 3: Fix agent count in Dev Notes

**OLD:**
```
- **Uniform strategy:** All 12 agents currently use markdown instruction files
```

**NEW:**
```
- **Uniform strategy:** All 11 agents currently use markdown instruction files
```

#### Change 4: Fix Project Structure Notes line ranges

**OLD:**
```
  - Lines 149-169: bmm-sre agent
  - Lines 170-190: antigravity agent
  - Lines 191-211: bmm-devops agent
  - Lines 212-232: bmm-cyber agent
  - Lines 233-253: bmm-mil498 agent
```

**NEW:**
```
  - Lines 149-168: bmm-sre agent (id at line 150)
  - Lines 170-189: antigravity agent (id at line 171)
  - Lines 191-210: bmm-devops agent (id at line 192)
  - Lines 212-231: bmm-cyber agent (id at line 213)
  - Lines 233-253: bmm-mil498 agent (id at line 234)
```

#### Change 5: Add dependency declaration

**ADD to Dev Notes:**
```
### Dependencies
- **Depends on:** Story 8.1 (Task 3 validates that 8.1's code reads `injectionStrategy`)
- **Recommended order:** 8.1 → 8.2
```

---

### Story 8.5: Research Per-Agent Enforcement Hooks

#### Change 1: Fix Claude Code hooks mechanism

**OLD (Task 1.1):**
```
  - [ ] 1.1: Document Claude Code hook system: `~/.claude/hooks/` directory structure
```

**NEW:**
```
  - [ ] 1.1: Document Claude Code hook system: Hooks are configured in settings files (`.claude/settings.json` for project-level, `~/.claude/settings.json` for user-level) as JSON objects with event matchers and command arrays — NOT shell scripts in a hooks/ directory.
```

**OLD (Task 2.2):**
```
  - [ ] 2.2: Determine hook placement: should it live in `skills/hooks/` and be symlinked/copied to `~/.claude/hooks/`? Or deployed per-project?
```

**NEW:**
```
  - [ ] 2.2: Determine hook deployment: should the installer add hook entries to `.claude/settings.json` (project-level)? Or `~/.claude/settings.json` (user-level)? Note: modifying settings.json requires JSON merge logic similar to Story 9.2.
```

**OLD (References):**
```
- Claude Code documentation: `~/.claude/hooks/` for hook installation
```

**NEW:**
```
- Claude Code documentation: hooks configured in `.claude/settings.json` or `~/.claude/settings.json`
```

#### Change 2: Add scope note

**ADD to Dev Notes → Architecture Compliance:**
```
- **Scope note:** This is a research spike. If hooks are NOT feasible, the deliverable is the technical note only. This is acceptable — research is a valid phase of architecture work.
```

---

### Story 8.6: No changes

Research-only story, well-scoped. Finding acknowledged but no corrections needed.

---

### NEW Story 8.4: Integration Verification

**New file:** `8-4-integration-verification.md`

Small, focused verification story. Depends on 8.1 + 8.2 + 8.3 completion. Verifies the end-to-end pipeline: install → inject at top → deploy extension → verify skills load paths. No new features — testing only.

---

## Section 5: Implementation Handoff

### Change Scope: Minor

### Execution Order
```
8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6
```
Numbering now matches execution order — no special sequencing needed.

### Action Items (all completed)
1. ~~Apply edits to stories 8.1, 8.2, 8.3, 8.5~~ DONE
2. ~~Renumber all stories to match execution order~~ DONE
3. ~~Create story 8.4 file~~ DONE
4. ~~Update epics.md~~ DONE
5. ~~Update sprint-status.yaml~~ DONE

### Success Criteria
- All story files reflect corrected line numbers, branch descriptions, and dependencies
- No ambiguous "OR" decisions remain in any story
- Developer can pick up Story 8.1 and implement without code-structure surprises
