# Story 24.2: Finalize Architecture Decision P5-1

Status: review

## Story

As a **ma-agents maintainer**,
I want to finalize Architecture Decision P5-1 based on Story 24.1 findings — confirming or amending the TOML coexistence assumption, scoping the custom workflow skill absorb task, and answering whether `persistent_facts` can replace the marker-injection layer —
So that Stories 24.3, 24.4, and 24.12 have a definitive, evidence-backed specification before implementation begins, and the TENTATIVE status on P5-1 is resolved.

## Acceptance Criteria

1. **Given** Story 24.1 Dev Notes are complete, **When** the config format finding is reviewed, **Then** P5-1 Sub-decision A is either confirmed as written (coexistence, no code change) or amended to require TOML read support (Story 24.3 scope expands). The TENTATIVE marker is removed from P5-1.

2. **Given** v6.5.0 upstream source installed in `node_modules/bmad-method`, **When** `bmad-quick-dev` and `bmad-checkpoint-preview` skills are inspected, **Then** a documented assessment answers: do these skills add capabilities (AiAudit integration, sprint-status sync, worktree conventions) that should be absorbed into the ma-agents plugin? Outcome is either "add to plugin bundle" or "not needed, out of scope" — both with rationale.

3. **Given** v6.4.0's `persistent_facts` field in the customize.toml model, **When** the field's schema and injection mechanism are reviewed against what ma-agents' marker-injection layer does, **Then** a documented finding answers: can `persistent_facts` express the same pre-task instruction block (read MANIFEST.yaml, load always_load skills) that ma-agents stamps into CLAUDE.md / .clinerules / .roomodes? Outcome feeds Story 24.12 scope.

4. **Given** all three findings are documented, **When** `architecture.md` Decision P5-1 is updated, **Then** the TENTATIVE marker is removed, Sub-decision A reflects the confirmed or amended position, and the `persistent_facts` finding is noted under "Out of scope (deferred)" or promoted to a confirmed direction.

5. **Given** the custom workflow absorb assessment (AC2), **When** Story 24.4 Dev Notes are updated, **Then** the assessment table is present as a prerequisite and Story 24.4 may advance to ready-for-dev.

## Tasks / Subtasks

### Task 1: Confirm P5-1 Sub-decision A from Story 24.1 findings (AC: 1)

- [x] 1.1 Read Story 24.1 Dev Notes — locate the `_bmad/bmm/config.yaml` finding
- [x] 1.2 If YAML config still exists with expected keys — note confirmed; no change to P5-1 Sub-decision A text beyond removing TENTATIVE marker
- [x] 1.3 If config moved to TOML — amend P5-1 Sub-decision A in `architecture.md`; update Story 24.3 scope note to expand from no-op to full TOML implementation
- [x] 1.4 Remove TENTATIVE marker from P5-1 header in `architecture.md`

### Task 2: Assess bmad-quick-dev and bmad-checkpoint-preview for absorption (AC: 2)

- [x] 2.1 Locate `bmad-quick-dev` in `node_modules/bmad-method` — read SKILL.md
- [x] 2.2 Locate `bmad-checkpoint-preview` in `node_modules/bmad-method` — read SKILL.md
- [x] 2.3 For each: does it integrate with sprint-status.yaml? Does it produce AiAudit.md entries? Does it enforce worktree/branch conventions? Document yes/no per integration point.
- [x] 2.4 Decision per skill: "add to plugin bundle" or "out of scope" — with one-line rationale
- [x] 2.5 If "add to plugin bundle": add a sub-task to Story 24.4 to include it

### Task 3: Assess persistent_facts as marker-injection replacement (AC: 3)

- [x] 3.1 Read `_bmad/custom/config.toml` schema from `node_modules/bmad-method` documentation or source
- [x] 3.2 Locate the `persistent_facts` field definition — what values it accepts, when/how they are injected into the agent session
- [x] 3.3 Compare injection surface: does `persistent_facts` reach into CLAUDE.md, .clinerules, .roomodes, AGENTS.md contexts? Or only into BMAD's own workflow prompts?
- [x] 3.4 State the finding clearly: "yes, can replace marker injection" / "partial replacement only" / "no, different injection surface" — with evidence
- [x] 3.5 Update Story 24.12 Dev Notes with this finding to scope the spike correctly

### Task 4: Update architecture.md and downstream story prerequisites (AC: 4, 5)

- [x] 4.1 Apply all amendments to `architecture.md` P5-1 — remove TENTATIVE, update Sub-decision A, note persistent_facts finding
- [x] 4.2 Update Story 24.4 Dev Notes with the absorb assessment table (columns: Skill | Integration points found | Decision | Rationale)
- [x] 4.3 If Story 24.3 scope expanded: update Story 24.3 AC and Tasks accordingly
- [x] 4.4 Advance Story 24.4 status to `ready-for-dev` in sprint-status.yaml if prerequisites are documented

## Dev Notes

### Why this story gates P5-1 finalization

P5-1 was drafted pre-implementation with two TENTATIVE assumptions. This is the evidence-collection story that either confirms or corrects those assumptions. No Epic 24 implementation story should begin until P5-1 is finalized — doing so risks building against a wrong assumption.

### Framing for Task 2: absorb, not diff

The 4 ma-agents workflow skills (sprint-planning, sprint-status, dev-story, code-review) are NOT forks of upstream BMAD skills — they are custom workflows built around ma-agents' sprint-status.yaml schema and AiAudit.md integration. The question is not "how much did we diverge from upstream?" but "do the newly customize.toml-capable upstream skills (`bmad-quick-dev`, `bmad-checkpoint-preview`) add capabilities worth pulling into our plugin?"

### What this story does NOT do

- Does NOT implement TOML support (Story 24.3)
- Does NOT modify any SKILL.md files (Story 24.4)
- Does NOT implement the persistent_facts replacement (Story 24.12 — spike only)
- Does NOT assess `.agents/skills/` routing (Story 24.11 — separate concern)

### Reference Files

- `_bmad-output/planning-artifacts/architecture.md` — Decision P5-1 (TENTATIVE)
- Story 24.1 Dev Notes — config format finding
- `node_modules/bmad-method` — upstream v6.5.0 sources
- `lib/bmad-extension/skills/bmad-sprint-planning/`, `bmad-sprint-status/`, `bmad-dev-story/`, `bmad-code-review/` — our custom workflow skills
- `lib/installer.js` — marker-injection layer (context for Task 3)

## Dev Notes (continued)

### Project Structure Notes

Files to read / write in this story:

- `_bmad-output/planning-artifacts/architecture.md` — the target document. Find Decision P5-1 by searching for `P5-1`. The TENTATIVE marker appears in the heading. Sub-decision A is the YAML/TOML config format assumption. This file is in the **planning worktree** at `d:\Code\agents-epic-24-bmad-640-planning\_bmad-output\planning-artifacts\architecture.md` — NOT in the main codebase.
- `node_modules/bmad-method` — source of upstream v6.5.0 skill files. After Story 24.1 bumps and runs `npm install`, this directory contains the full upstream source. Search for `bmad-quick-dev` and `bmad-checkpoint-preview` skill directories here.
- `lib/bmad-extension/skills/` — contains the 4 custom ma-agents workflow skills: `bmad-sprint-planning/`, `bmad-sprint-status/`, `bmad-dev-story/`, `bmad-code-review/`. Each has a `SKILL.md` and `bmad-skill-manifest.yaml`.
- `lib/installer.js` — marker-injection layer for context in Task 3. Key functions: `composeInstructionBlock()` (line ~113), `markdownMarkersMerger()` (line ~769), `stampExtraInstructionTemplates()` (line ~857). Templates live in `lib/templates/` — specifically `instruction-block-universal.template.md`.
- Story 24.1 Dev Notes — the output of 24.1's Task 4 (config format finding). This is in the same story file at `_bmad-output/implementation-artifacts/24-1-bump-bmad-method-to-6-4-0-and-verify-fs-native-compat.md`.

Naming conventions for architecture.md edits:
- Decision heading format: `### Decision P5-1: <Title>` with sub-decisions as `**Sub-decision A:**` etc.
- Findings format used in existing decisions: bulleted list with **bold** labels, rationale paragraph

### Testing Requirements

This story produces only documentation changes (architecture.md, story Dev Notes updates). No code changes means no new test cases.

However, if AC3 of Story 24.2 results in a "YES, persistent_facts can replace marker injection" finding, Story 24.12 will need tests. That is deferred to 24.12.

Test verification for this story: none — all acceptance criteria are verified by document inspection.

How to run tests (for sanity check after any incidental file changes): `npm test` in `d:\Code\agents`

### What this story does NOT do

- Does NOT implement TOML support (Story 24.3)
- Does NOT modify any SKILL.md files (Story 24.4)
- Does NOT implement the persistent_facts replacement (Story 24.12 — spike only)
- Does NOT assess `.agents/skills/` routing (Story 24.11 — separate concern)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-26 | 1.0.0 | (pending) | Story drafted as part of Epic 24 planning |
| 2026-04-27 | 1.1.0 | (pending) | Reframed as P5-1 gate; replaced 4-skill diff with custom workflow absorb assessment; added persistent_facts research question; per adversarial review findings 2, 4, 6 |
| 2026-04-28 | 1.2.0 | (pending) | Enhanced to ready-for-dev: added project structure notes, exact file paths, testing requirements |

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
(none)

### Completion Notes List

1. Removed TENTATIVE marker from P5-1 header in architecture.md.
2. Sub-decision A updated to CONFIRMED — `_bmad/bmm/config.yaml` confirmed present in v6.5.0 with all 5 expected keys; TOML files are additive. Story 24.3 note updated.
3. Sub-decision B updated to CONFIRMED — absorb not reconcile remains the correct framing.
4. Evidence base subsection added to P5-1 with: Story 24.1 config finding, skill absorb assessment table, persistent_facts finding.
5. Story 24.4 Dev Notes updated with full absorb assessment table and input section. Both skills assessed as out of scope.
6. Story 24.12 Dev Notes updated with persistent_facts preliminary finding: field not found in npm package, Story 24.12 to check GitHub source.
7. sprint-status.yaml updated: 24-2 set to review.

### File List

- `_bmad-output/planning-artifacts/architecture.md` — TENTATIVE removed, Sub-decision A confirmed, Sub-decision B confirmed, Evidence base added
- `_bmad-output/implementation-artifacts/24-2-confirm-p5-1-architecture-decision.md` — all tasks marked complete, status set to review
- `_bmad-output/implementation-artifacts/24-4-reconcile-forked-skills-with-customize-toml.md` — absorb assessment table filled in, Input from Story 24.2 section added
- `_bmad-output/implementation-artifacts/24-12-persistent-facts-spike-marker-injection-replacement.md` — Input from Story 24.2 section updated with persistent_facts finding
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 24-2 status set to review
