# Story 13.5: Document Project-Context Generation in README and Installation Guidance

Status: ready-for-dev

## Story

As a **DevOps Engineer**,
I want project-context generation documented in the README and QUICK_START guide,
So that users understand what the generated file is, why it appeared, and how to expand it over time.

## Acceptance Criteria

1. README.md contains a "Project Context" section explaining:
   - What `_bmad-output/project-context.md` is (constitutional document for AI agents)
   - When it is generated (project-level install only, not global installs)
   - That it is intentionally preserved on reinstall — never overwritten (idempotent by design)
   - How to expand it over time: `/bmad-generate-project-context` (after architecture), `/bmad-retrospective` (after sprints), manual additions
   - That it is version-controlled as part of `_bmad-output/` project knowledge (consistent with Epic 10 policy)
2. QUICK_START.md references project-context.md as an expected post-install artifact with a pointer to the README for details
3. The expansion instructions in the README match the inline comments in the generated template — no contradictions between the two
4. The documentation does not include platform-specific paths (e.g., no hardcoded `.claude/skills/MANIFEST.yaml`) — consistent with NFR22
5. The README section clearly states that the file is safe to edit and commit — users should not be alarmed by its presence or confused about whether to gitignore it

## Tasks / Subtasks

- [ ] Task 1: Locate the correct section in README.md for insertion (AC: #1)
  - [ ] 1.1 Read README.md to identify where skill installation and `_bmad-output/` are documented
  - [ ] 1.2 Identify the most logical placement for a "Project Context" section (after the `_bmad-output/` policy section, if one exists from Epic 10)
  - [ ] 1.3 Confirm the section header style used in the existing README

- [ ] Task 2: Write and insert the "Project Context" README section (AC: #1, #3, #4, #5)
  - [ ] 2.1 Draft the section content following the README's voice and structure
  - [ ] 2.2 Insert the section in the identified location
  - [ ] 2.3 Verify expansion instructions match the template inline comments from Story 13.1 exactly

- [ ] Task 3: Update QUICK_START.md (AC: #2)
  - [ ] 3.1 Read QUICK_START.md to identify where post-install outputs are listed
  - [ ] 3.2 Add a bullet or note: `_bmad-output/project-context.md` is generated automatically — see README for details
  - [ ] 3.3 Verify the pointer to README is specific enough to be useful (section link if markdown supports it)

## Dev Notes

### README Section Draft

The section should read approximately:

```markdown
## Project Context

When you run `npx ma-agents install` at the project level, ma-agents automatically generates
`_bmad-output/project-context.md` — a constitutional document that governs how AI agents
behave in this project.

**What it contains:**
- Mandatory pre-task rules: which MANIFEST.yaml files to read, which skills to load
- Git workflow mandate: fresh worktrees per mission (not just branches)
- Agent mission lifecycle: 8-step sequence from pre-flight to post-mission cleanup

**It is never overwritten on reinstall.** If the file already exists, the installer leaves it
untouched. Edit it freely — it belongs to your project.

**Expand it over time:**
- After architecture phase: run `/bmad-generate-project-context` to auto-detect your stack
- After each sprint: run `/bmad-retrospective` — includes a project-context update step
- Manually: add conventions you notice agents getting wrong

The file is version-controlled as part of `_bmad-output/` project knowledge. Commit it.
```

Adjust the exact wording to match the README's existing style and voice.

### Architecture Compliance

- **FR85** (expansion comments): The README expansion instructions must exactly match the inline comments in `lib/templates/project-context.template.md`. If Story 13.1 changed the template comments, update the README accordingly.
- **NFR22**: No hardcoded platform paths in documentation — say "your MANIFEST.yaml" or "the platform's MANIFEST.yaml", not `.claude/skills/MANIFEST.yaml` specifically.
- **Epic 10** (project knowledge policy): The README section should reinforce that `_bmad-output/project-context.md` is version-controlled project knowledge, never gitignored — consistent with the existing `_bmad-output/` policy.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `README.md` | ADD "Project Context" section |
| `QUICK_START.md` | ADD reference to project-context.md as post-install artifact |

### Dependency

Story 13.1 must be complete before this story can verify that expansion instructions match the template. The story can be drafted in parallel but must be verified against the final template content.

### Epic 13 Cross-Story Context

**Story 13.1**: Template and generator — defines inline expansion comments to match
**Story 13.2**: Pipeline integration — defines the "project-level only" install behavior to document
**Story 13.3**: BMAD critical_actions update
**Story 13.4**: Retrospective expansion trigger (backlog — pending investigation)
**Story 13.5** (this): External documentation — closes the discoverability gap

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
- 2026-03-19: Story created (Epic 13, Story 13.5) — added to address adversarial review finding #5 (missing documentation story analogous to Epic 10 Story 10.2)
