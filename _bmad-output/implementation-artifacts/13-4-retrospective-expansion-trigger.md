# Story 13.4: Add Project-Context Expansion Trigger to Retrospective Workflow

Status: backlog

> **⚠ PREREQUISITE INVESTIGATION REQUIRED before this story can be started.**
> Task 1.1–1.4 below must be completed first to determine the implementation path.
> Until the retrospective workflow location is confirmed and the implementation approach is decided, this story cannot be developed. Do not begin implementation tasks (Task 2 onwards) until Task 1 is complete and the approach is documented in Completion Notes.

## Story

As a **Scrum Master**,
I want the BMAD retrospective workflow to include a project-context update step,
So that conventions and patterns discovered during a sprint are captured in the living document systematically.

## Acceptance Criteria

1. The retrospective workflow includes a final expansion step that prompts the agent to review `_bmad-output/project-context.md` and propose additions to `## Project-Specific Rules` based on patterns observed during the sprint (FR85)
2. The expansion step presents the current content of `## Project-Specific Rules` section to the user before proposing additions
3. The expansion step waits for human confirmation before writing any changes to `project-context.md` — the agent proposes, the human decides
4. When `_bmad-output/project-context.md` does not exist, the expansion step is skipped gracefully with a note: *"No project-context.md found — consider running install or /bmad-generate-project-context first"*
5. The expansion step does not modify the `## Technology Stack`, `## AI Agent Mandatory Rules`, or any sections other than `## Project-Specific Rules`
6. The workflow change does NOT modify any bmad-method core files — only extension workflow files (NFR17)
7. The updated retrospective workflow is invokable via `/bmad-retrospective` and via the BMAD agent menu (NFR19)

## Tasks / Subtasks

- [ ] Task 1: Locate the retrospective workflow (AC: #6)
  - [ ] 1.1 Check `lib/bmad-extension/workflows/` for a `retrospective` or `bmad-retrospective` directory — if it exists, this is an extension workflow and can be modified directly
  - [ ] 1.2 If NOT in extension: check `_bmad/bmm/workflows/` for the built-in BMAD retrospective workflow — read its structure to understand steps and format
  - [ ] 1.3 If the workflow is built-in (not in extension): create a NEW extension workflow in `lib/bmad-extension/workflows/project-context-expansion/` that is triggered as a post-retrospective companion, OR add it as a step override via the extension mechanism. Do NOT modify `_bmad/bmm/workflows/` directly (NFR17)
  - [ ] 1.4 Document the decision made in Completion Notes

- [ ] Task 2: Add expansion step to the retrospective workflow (AC: #1-#5)
  - [ ] 2.1 Add the project-context expansion step as the final step of the retrospective workflow (or as a companion workflow invoked at retrospective end)
  - [ ] 2.2 The step content should follow this pattern:
    ```
    ## Step N: Project Context Update

    Review `_bmad-output/project-context.md`:
    1. Check if `_bmad-output/project-context.md` exists
       - If NOT: inform user "No project-context.md found — consider running install or /bmad-generate-project-context"
       - If YES: continue
    2. Read the current `## Project-Specific Rules` section
    3. Present it to the user
    4. Based on patterns, failures, and conventions from this sprint's retrospective, propose specific additions
    5. Show proposed additions to user for review
    6. If user confirms: append approved additions to `## Project-Specific Rules` section ONLY
    7. If user declines: skip without modification
    ```
  - [ ] 2.3 Ensure the step does not modify any other section of project-context.md (AC: #5)

- [ ] Task 3: Register in module-help.csv if creating a new companion workflow (AC: #7)
  - [ ] 3.1 If a new companion workflow was created in Step 1.3: add it to `lib/bmad-extension/module-help.csv` for phase discovery
  - [ ] 3.2 Verify the workflow is invokable via slash command

- [ ] Task 4: Integration test (AC: #1-#7)
  - [ ] 4.1 Run `/bmad-retrospective` on a project WITH `_bmad-output/project-context.md`
  - [ ] 4.2 Confirm the expansion step appears at the end of the retrospective
  - [ ] 4.3 Confirm the agent presents current `## Project-Specific Rules` content
  - [ ] 4.4 Confirm the agent proposes additions and waits for confirmation before writing
  - [ ] 4.5 Run `/bmad-retrospective` on a project WITHOUT `_bmad-output/project-context.md`
  - [ ] 4.6 Confirm graceful skip with the "No project-context.md found" message

## Dev Notes

### Critical Investigation: Extension vs Built-in Workflow

This story's implementation path depends entirely on whether `bmad-retrospective` is a built-in BMAD workflow or an existing extension workflow. Read the actual files before writing any code.

**If it's already in `lib/bmad-extension/workflows/`:** Edit the workflow file directly.

**If it's a built-in BMAD workflow in `_bmad/bmm/workflows/`:** Do NOT touch it. Create a post-retrospective companion workflow in `lib/bmad-extension/workflows/project-context-expansion/` and document how to invoke it. Consider adding the companion to the retrospective's final instructions via an extension overlay if BMAD supports that mechanism.

**Guiding principle:** Zero modifications to bmad-method core (NFR17). Zero modifications to `_bmad/bmm/` files. Extension territory only.

### Human Review Gate Pattern

The expansion step follows the same human-confirmation pattern used in `add-to-sprint` and other BMAD workflows: the agent proposes, displays the proposal, then explicitly pauses and asks for user confirmation. It does NOT auto-append.

This pattern is important because project-context.md is a constitutional document — incorrect additions propagate into every future agent session. Human review at the proposal stage is a hard requirement (AC: #3).

### Scope Boundary

The expansion step writes ONLY to `## Project-Specific Rules`. It must not:
- Modify `## AI Agent Mandatory Rules` (those are set at install time, not retrospectively)
- Modify `## Technology Stack` (that is the domain of `bmad-generate-project-context`)
- Delete or reorganize existing rules
- Write to any section other than `## Project-Specific Rules`

### Architecture Compliance

- **Decision P2-5** (Pre-built Extension Workflows): New BMAD extension workflows are authored directly as static content in `lib/bmad-extension/workflows/`. If this story creates a new companion workflow, it follows the same pattern as `create-bug-story`, `add-sprint`, etc.
- **NFR17** (Zero bmad-method core modifications): The retrospective itself may be a built-in workflow. Do not modify it directly. Use extension mechanisms only.
- **NFR19** (Menu + slash command): Any new companion workflow must be registered in `module-help.csv` to appear in the BMAD agent menu.

### Source Tree Components to Touch

| File | Change | Conditional |
|------|--------|-------------|
| `lib/bmad-extension/workflows/<retrospective>/workflow.md` | ADD final expansion step | If retrospective is already an extension workflow |
| `lib/bmad-extension/workflows/project-context-expansion/workflow.md` | CREATE companion workflow | If retrospective is built-in |
| `lib/bmad-extension/module-help.csv` | ADD companion workflow entry | If companion workflow created |

Determine actual files after reading current workflow locations.

### Epic 13 Cross-Story Context

**Story 13.1** (prerequisite): Template and generator function
**Story 13.2** (prerequisite): Pipeline integration
**Story 13.3** (prerequisite): BMAD critical_actions updated to load project-context.md
**Story 13.4** (this): Retrospective workflow triggers expansion — closing the living document lifecycle loop

## Dev Agent Record

### Agent Model Used
_To be filled by dev agent_

### Debug Log References
_To be filled by dev agent_

### Completion Notes List
_To be filled by dev agent_

### File List
_To be filled by dev agent_

## Change Log
- 2026-03-19: Story created (Epic 13, Story 13.4)
