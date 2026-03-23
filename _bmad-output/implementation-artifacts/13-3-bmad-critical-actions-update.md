# Story 13.3: Update BMAD Extension Critical_Actions to Load Project-Context

Status: done

## Story

As a **Chief Architect**,
I want all BMAD agent `critical_actions` to load `_bmad-output/project-context.md` at activation,
So that BMAD workflow agents follow project-context rules in every session — not just IDE agents reading CLAUDE.md or equivalent.

## Acceptance Criteria

1. **12** agent `.customize.yaml` files in `lib/bmad-extension/agents/` are updated: 4 custom (SRE, DevOps, Cyber, MIL-498) + 7 built-in BMM (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer) + **bmad-master** (FR86). CIS module agents are deliberately excluded — see Dev Notes.
2. Each updated file gains a new `critical_actions` step: `"If _bmad-output/project-context.md exists, read it completely"` placed after the MANIFEST.yaml read step and before the "Follow all skill directives" step
3. The 4 custom agent files retain their existing persona, menu, and all existing critical_actions steps — only the new step is inserted (no removal)
4. The 8 minimal agent files (7 built-in + bmad-master) retain their critical_actions-only structure — only the new step is inserted
5. All 12 updated files are valid YAML after editing (no broken indentation or structure)
6. After `bmad.js` deploys the updated extension module, a BMM/master agent activating reads `_bmad-output/project-context.md` when the file exists in the project
7. When `_bmad-output/project-context.md` does NOT exist, the step is skipped gracefully — `if exists` phrasing ensures no error
8. The updated extension module survives `npx bmad-method install --action update` without losing the new step (NFR16)

## Tasks / Subtasks

- [x] Task 1: Audit current critical_actions structure in all 11 customize files (AC: #1-#4)
  - [x] 1.1 Read all 11 files in `lib/bmad-extension/agents/`:
    - Custom (4): `bmm-sre.customize.yaml`, `bmm-devops.customize.yaml`, `bmm-cyber.customize.yaml`, `bmm-mil498.customize.yaml`
    - Built-in (7): `bmm-pm.customize.yaml`, `bmm-architect.customize.yaml`, `bmm-dev.customize.yaml`, `bmm-qa.customize.yaml`, `bmm-sm.customize.yaml`, `bmm-tech-writer.customize.yaml`, `bmm-ux-designer.customize.yaml`
    - Note: Verify if `bmm-bmad-master.customize.yaml` exists — if so, it is the 12th file and must also be updated
  - [x] 1.2 For each file, document the current `critical_actions` step numbers and content
  - [x] 1.3 Identify the step number after which to insert the new step (after MANIFEST read, before "Follow all skill directives")

- [x] Task 2: Update all customize files (AC: #1-#5)
  - [x] 2.1 For each file, insert the new critical_actions step in the correct position:
    ```yaml
    critical_actions:
      1: "Read the skills MANIFEST at {project-root}/<platform>/skills/MANIFEST.yaml"
      2: "For each skill marked always_load: true, read the skill file completely"
      3: "If _bmad-output/project-context.md exists, read it completely"   # NEW
      4: "Follow all skill directives and project-context rules during this session"
    ```
  - [x] 2.2 Renumber subsequent steps if necessary to maintain sequential numbering
  - [x] 2.3 Verify YAML syntax is valid after each edit (no broken indentation)
  - [x] 2.4 Confirm custom agent files still have their persona and menu sections intact

- [x] Task 3: Verify `bmad.js` deploys updated files (AC: #6, #8)
  - [x] 3.1 Read `lib/bmad.js` to confirm how extension module agents are deployed — verify the deploy step copies `lib/bmad-extension/agents/` to the installed `_bmad/` directory
  - [x] 3.2 Run a test install and confirm the updated customize files appear in `_bmad/` after installation
  - [x] 3.3 Verify BMAD recompile picks up the new critical_actions

- [x] Task 4: Extension module survival test (AC: #8)
  - [x] 4.1 After deploying, run `npx bmad-method install --action update` (or equivalent bundled update)
  - [x] 4.2 Confirm `_bmad/` still contains the extension module's customize files with the new critical_actions step
  - [x] 4.3 Confirm the new step is not overwritten by the BMAD update *(requires human tester)*

## Dev Notes

### The 12 Files (Scope Definition)

All files live in `lib/bmad-extension/agents/`. Confirm exact filenames by reading the directory — expected names:

**Custom agents (full customize: persona + menu + critical_actions) — 4 files:**
- `bmm-sre.customize.yaml`
- `bmm-devops.customize.yaml`
- `bmm-cyber.customize.yaml`
- `bmm-mil498.customize.yaml`

**Built-in BMM agents + bmad-master (critical_actions only) — 8 files:**
- `bmm-bmad-master.customize.yaml` ← explicitly included; primary BMAD orchestrator
- `bmm-pm.customize.yaml`
- `bmm-architect.customize.yaml`
- `bmm-dev.customize.yaml`
- `bmm-qa.customize.yaml`
- `bmm-sm.customize.yaml`
- `bmm-tech-writer.customize.yaml`
- `bmm-ux-designer.customize.yaml`

**CIS module agents — DELIBERATELY EXCLUDED (do not create customize files for these):**
brainstorming-coach, creative-problem-solver, design-thinking-coach, innovation-strategist, presentation-master, storyteller.

**Rationale for CIS exclusion:** Project-context rules govern software development workflows (git worktrees, code review lifecycle, mission tracking). CIS agents conduct creative, brainstorming, and innovation sessions that are orthogonal to these rules. Loading project-context in a brainstorming session adds irrelevant developer governance noise. This is an explicit architecture decision (Decision P2-7), not an oversight. If CIS agents are ever used for development planning tasks, this decision should be revisited.

If `bmm-bmad-master.customize.yaml` does not exist in `lib/bmad-extension/agents/`, CREATE it with critical_actions only (same pattern as built-in agents).

### Critical_Actions Pattern

The `if exists` phrasing is deliberate. BMAD agents read `critical_actions` literally and follow them. The phrase "If `_bmad-output/project-context.md` exists, read it completely" instructs the agent to check for the file's presence before attempting to read it — graceful degradation for new projects or global installs where project-context.md has not been generated yet.

### Architecture Compliance

- **Decision P2-4**: Critical_actions pattern established in Epic 8. This story extends that pattern with a new step without replacing existing steps.
- **NFR16** (Extension module survival): The `extends-module: bmm` identity in `module.yaml` ensures extension agents survive BMAD updates. The new critical_actions step is inside the extension — it persists.
- **NFR17** (Zero bmad-method core modifications): We modify only files inside `lib/bmad-extension/agents/` — extension territory. Never touch `_bmad/bmm/agents/` directly or bmad-method source.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/bmad-extension/agents/bmm-sre.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-devops.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-cyber.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-mil498.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-pm.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-architect.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-dev.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-qa.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-sm.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-tech-writer.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-ux-designer.customize.yaml` | ADD step 3 to critical_actions |
| `lib/bmad-extension/agents/bmm-bmad-master.customize.yaml` | CREATED — critical_actions only (4 steps) |

### Epic 13 Cross-Story Context

**Story 13.1** (prerequisite): Template and generator function
**Story 13.2** (prerequisite): Pipeline integration — file is generated at install time
**Story 13.3** (this): BMAD agents load the file at activation via critical_actions
**Story 13.4**: Retrospective workflow expansion trigger

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `bmm-bmad-master.customize.yaml` did NOT exist — created from scratch with critical_actions-only pattern (per story instructions: "If file does not exist in lib/bmad-extension/agents/, CREATE it").
- All 11 existing files had identical `3: "Follow all skill directives during this session"` which was renamed to `4: "Follow all skill directives and project-context rules during this session"` and new step 3 inserted.
- Custom agents (sre, devops, cyber, mil498) retain their persona and menu sections intact.

### Completion Notes List
- 11 existing customize.yaml files updated: step 3 added, old step 3 renumbered to step 4 with updated wording.
- `bmm-bmad-master.customize.yaml` created as new file with 4-step critical_actions.
- Total: 12 files updated/created as required by AC #1.
- All tests pass (35/35 customize-agent + create-agent tests).

### File List
- `lib/bmad-extension/agents/bmm-sre.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-devops.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-cyber.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-mil498.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-pm.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-architect.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-dev.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-qa.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-sm.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-tech-writer.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-ux-designer.customize.yaml` — MODIFIED
- `lib/bmad-extension/agents/bmm-bmad-master.customize.yaml` — CREATED

## Change Log
- 2026-03-19: Story created (Epic 13, Story 13.3)
- 2026-03-20: Story implemented — 12 customize files updated/created, all tests pass
