# Story 17.7: Multi-Criteria Prioritization Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Scrum Master**,
I want a workflow to reprioritize the backlog using multiple criteria,
So that sprint planning is based on business value, severity, and dependencies — not just epic order.

## Acceptance Criteria

1. **Given** the backlog contains stories and bugs,
   **When** the Scrum Master invokes the prioritize-backlog workflow,
   **Then** it presents each item with its current priority and metadata (type, epic, severity for bugs, dependencies),
   **And** the Scrum Master can reorder items using criteria: severity, business value, dependencies, item type, age.

2. **Given** the Scrum Master reorders items,
   **When** the new priority order is confirmed,
   **Then** `backlog.yaml` is updated with new `priority` values (sequential integers starting from 1),
   **And** the reordering is logged with date and reason.

3. **Given** items have dependencies (e.g., Story 15.2 depends on 15.1),
   **When** the Scrum Master tries to prioritize the dependent item above its dependency,
   **Then** the workflow warns about the dependency conflict,
   **And** allows the Scrum Master to override or adjust.

## Tasks / Subtasks

- [ ] Task 1: Create prioritize-backlog SKILL.md (AC: #1, #2, #3)
  - [ ] 1.1: Create skill package at `lib/bmad-extension/skills/prioritize-backlog/SKILL.md` with YAML frontmatter:
    ```yaml
    ---
    name: prioritize-backlog
    description: Reprioritize backlog items using multiple criteria — severity, business value, dependencies, type, age
    type: skill
    triggers:
      - "prioritize backlog"
      - "reorder backlog"
      - "reprioritize"
    ---
    ```
  - [ ] 1.2: Create `lib/bmad-extension/skills/prioritize-backlog/bmad-skill-manifest.yaml`
  - [ ] 1.3: Implement workflow steps:

    **Step 1: Load backlog and infer dependencies**
    - Read `_bmad-output/implementation-artifacts/backlog.yaml`
    - If no backlog file: display "No backlog.yaml found. Run `/generate-backlog` first." and exit
    - If backlog is empty: display "Backlog is empty." and exit
    - Infer dependencies from epic story ordering:
      - Stories within the same epic are sequentially dependent by default (e.g., 17-1 before 17-2 before 17-3)
      - Cross-epic dependencies are inferred from epics.md dependency notes if available
    - Read `_bmad-output/planning-artifacts/epics.md` for explicit dependency information

    **Step 2: Display current backlog with metadata**
    - Show table with columns: #, Priority, ID, Title, Type, Epic, Status, Sprint, Severity, Dependencies
    - For bugs: show severity in its own column
    - For stories: show epic number
    - For items with dependencies: show which items they depend on (e.g., "after 17-1")
    - For sprint-assigned items: show sprint ID
    - Color/marker coding: unassigned items vs sprint-assigned items

    **Step 3: Choose prioritization mode**
    - Prompt: "How would you like to prioritize?"
    - Options:
      1. **Full reprioritization** — present all items, reorder from scratch
      2. **Quick adjust** — move specific items up or down
      3. **Auto-suggest** — AI recommends optimal ordering based on criteria
      4. **Cancel** — exit without changes

    **Step 3a: Full reprioritization (if mode = 1)**
    - Prompt: "Enter item numbers in your desired priority order (comma-separated). Items not listed will be appended at the end in their current order."
    - Validate all numbers are valid item references
    - Check for dependency violations (AC #3)
    - Build new ordering: user-specified items first, remaining items appended

    **Step 3b: Quick adjust (if mode = 2)**
    - Prompt: "Enter item number to move:"
    - Prompt: "Move to position (number) or relative move ([u]p N / [d]own N):"
    - Check for dependency violations at new position
    - Apply move and re-number priorities
    - Show updated backlog; prompt: "[m] Move another / [d] Done"

    **Step 3c: Auto-suggest (if mode = 3)**
    - Analyze all items using weighted criteria:
      - **Blocking dependencies first** (items that unblock others get highest priority)
      - **Critical/High bugs** above medium/low stories (severity weighting)
      - **Business value** (inferred from epic priority and story position)
      - **Sprint-assigned items** grouped together (don't interleave assigned/unassigned unnecessarily)
      - **Effort** (smaller items above larger when other criteria are equal)
    - Present suggested reordering with rationale for each major change
    - Prompt: "[a] Accept suggestion / [m] Modify / [r] Reject and keep current"

    **Step 4: Dependency validation (AC: #3)**
    - For the proposed new ordering, check each item:
      - If item X depends on item Y, verify Y has a lower priority number (higher priority) than X
      - If violation found: display warning:
        ```
        Warning: "{item_X}" depends on "{item_Y}", but {item_X} is prioritized above {item_Y}.
        [o] Override — I know what I'm doing
        [f] Fix — move {item_X} below {item_Y}
        [c] Cancel reordering
        ```

    **Step 5: Confirm and persist (AC: #2)**
    - Display the new ordering side-by-side with old ordering (show what changed)
    - Prompt: "Reason for reprioritization (brief description):"
    - Store reason for audit log
    - Prompt: "[y] Confirm / [n] Cancel / [e] Edit"
    - If confirmed:
      - Update `backlog.yaml` with new `priority` values (sequential 1..N)
      - Append to backlog.yaml header comment: `# Reprioritized: {date} — {reason}`
      - Write updated file
    - Display: "Backlog reprioritized. {count} items reordered."

- [ ] Task 2: Register in module-help.csv (AC: #1)
  - [ ] 2.1: Add row to `lib/bmad-extension/module-help.csv`:
    ```
    ma-skills,4-implementation,Prioritize Backlog,prioritize-backlog,,skill:prioritize-backlog,prioritize-backlog,false,bmm-sm,,"Reprioritize backlog using multiple criteria — severity, value, dependencies.",_bmad-output/implementation-artifacts,"backlog",
    ```

- [ ] Task 3: Update guardrails (AC: #2, #3)
  - [ ] 3.1: Add to `sprint-management-guardrails.md`:
    - Prioritization Rules section: criteria list, dependency validation, audit logging
    - Document that priority values are always sequential 1..N after any reordering
    - Document dependency inference: same-epic stories are sequentially dependent by default

- [ ] Task 4: Verify (AC: #1, #2, #3)
  - [ ] 4.1: Trace SKILL.md — confirm all three modes (full, quick, auto-suggest) produce valid orderings
  - [ ] 4.2: Verify priority re-numbering produces sequential integers 1..N with no gaps
  - [ ] 4.3: Verify dependency violation detection and warning display
  - [ ] 4.4: Verify override capability (Scrum Master can override dependency warnings)
  - [ ] 4.5: Verify audit logging (date + reason appended to backlog.yaml header)
  - [ ] 4.6: Verify sprint-assigned items' `sprint` field is preserved during reordering

## Dev Notes

### Architecture Compliance

- **SKILL.md is the authoritative file:** New skill at `lib/bmad-extension/skills/prioritize-backlog/SKILL.md`
- **Extension module pattern:** Skill lives in `lib/bmad-extension/skills/prioritize-backlog/`
- **Single-file write:** Only writes to `backlog.yaml` — no other files modified
- **Non-destructive:** Reordering only changes `priority` values, never changes `status`, `sprint`, or other fields

### Prioritization Criteria (Weighted)

| Criterion | Weight | Description |
|---|---|---|
| Blocking dependencies | Highest | Items that unblock others get top priority |
| Severity (bugs) | High | Critical > High > Medium > Low |
| Business value | Medium | Inferred from epic priority and story position |
| Item type | Low | Bugs slightly above stories when severity/value equal |
| Age | Lowest | Older items above newer when all else equal |

### Dependency Inference Rules

1. **Same-epic sequential:** Story N depends on Story N-1 within the same epic (e.g., 17-3 depends on 17-2)
2. **Cross-epic explicit:** Dependencies stated in epics.md "Dependencies" sections (e.g., Epic 17 depends on Epic 11)
3. **Override allowed:** Scrum Master can override any dependency warning — the workflow warns but doesn't block

### Impact on Other Epic 17 Stories

- **17.2 (Flat Backlog):** Provides the backlog.yaml this story reads/writes
- **17.4 (Backlog-to-Sprint):** Reads backlog.yaml ordered by priority set by this story
- **17.8 (Sprint Status Display):** Displays backlog items in priority order set by this story

### Critical Guardrails (Story-Specific)

- Do NOT modify any files under `_bmad/bmm/workflows/` or `_bmad/core/`
- Do NOT add npm dependencies
- Do NOT modify `lib/installer.js`, `lib/agents.js`, or `bin/cli.js`
- Do NOT modify `sprint-status.yaml` — priorities are in backlog.yaml only
- Do NOT change any field other than `priority` when reordering
- ALWAYS re-number priorities as sequential integers 1..N (no gaps, no ties)
- ALWAYS preserve `sprint`, `status`, `severity`, and all other fields during reordering
- ALWAYS validate dependencies before confirming (but allow override)
- ALWAYS log the reordering reason and date in backlog.yaml header comment

### Project Structure Notes

- **Files to create:**
  - `lib/bmad-extension/skills/prioritize-backlog/SKILL.md` — new skill (authoritative)
  - `lib/bmad-extension/skills/prioritize-backlog/bmad-skill-manifest.yaml` — skill manifest
- **Files to modify:**
  - `lib/bmad-extension/module-help.csv` — add prioritize-backlog row
  - `_bmad-output/implementation-artifacts/sprint-management-guardrails.md` — document prioritization rules
- **Files modified at runtime:**
  - `_bmad-output/implementation-artifacts/backlog.yaml` — priority values updated
- **Files NOT to touch:**
  - `sprint-status.yaml` (priorities not stored here)
  - Sprint files (priorities not stored here)
  - Any files under `_bmad/` or `lib/installer.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 17, Story 17.7] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR67] — Multi-criteria prioritization beyond epic precedence
- [Source: _bmad-output/planning-artifacts/prd.md#FR65] — Flat backlog with priority independent of epic
- [Source: _bmad-output/implementation-artifacts/17-2-flat-backlog-model.md] — Backlog YAML schema with priority field
- [Source: _bmad-output/implementation-artifacts/17-4-backlog-to-sprint-workflow.md] — Consumes prioritized backlog
- [Source: lib/bmad-extension/skills/add-to-sprint/SKILL.md] — Current multi-criteria analysis (moved to dedicated skill)
- [Source: lib/bmad-extension/module-help.csv] — Workflow registration

### Git Intelligence

Recent commits show Epic 15/16 patterns:
- Conventional commit format: `feat(epic-17): story 17-7 multi-criteria prioritization`
- New skill creation follows: SKILL.md + bmad-skill-manifest.yaml + module-help.csv registration

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
