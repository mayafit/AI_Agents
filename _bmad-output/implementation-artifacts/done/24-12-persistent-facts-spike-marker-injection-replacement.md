# Story 24.12: Spike — Can persistent_facts Replace ma-agents' Marker-Injection Layer?

Status: review

## Story

As a **ma-agents maintainer**,
I want to determine whether BMAD v6.4.0's `persistent_facts` field in `customize.toml` can express the same pre-task instruction block that ma-agents currently stamps into CLAUDE.md / .clinerules / .roomodes via marker injection,
So that we can decide whether to plan a follow-up epic to remove the marker-injection layer (300+ lines across `lib/installer.js`) or confirm it must remain.

## Acceptance Criteria

1. **Given** the `persistent_facts` schema in BMAD v6.5.0's customize.toml model, **When** the field is read and its injection mechanism is understood, **Then** a finding documents: what context does `persistent_facts` inject into, when, and for which tools.

2. **Given** ma-agents' current marker-injection content (the `<!-- MA-AGENTS-START -->` block in CLAUDE.md: "Pre-Task: read MANIFEST.yaml, load always_load skills, select task skills"), **When** this content is compared against what `persistent_facts` can express, **Then** a clear yes/no/partial answer is documented — can `persistent_facts` replace it?

3. **Given** the finding in AC2, **When** this story closes, **Then** a one-paragraph decision record is committed to `architecture.md` as a P5-1 addendum: "persistent_facts can replace marker injection — plan follow-up epic" OR "persistent_facts injection surface is different — marker injection layer remains necessary — no action."

4. **Given** this is a spike, **When** it closes, **Then** no source code changes are made to `lib/installer.js` or any marker-injection path. The output is the decision record only.

## Tasks / Subtasks

### Task 1: Read persistent_facts schema (AC: 1)

- [x] 1.1 Locate `persistent_facts` in BMAD v6.5.0 source: `node_modules/bmad-method` — search for `persistent_facts` in customize.toml docs or schema files
- [x] 1.2 Document: what type does it accept (string, array, object)?
- [x] 1.3 Document: when is it injected — at workflow start? At every agent turn? Only for specific workflow types?
- [x] 1.4 Document: which tools receive it — Claude Code only? All 5 registered tools? Tool-agnostic?

### Task 2: Compare against marker-injection content (AC: 2)

- [x] 2.1 Read the current `<!-- MA-AGENTS-START -->` block content from `lib/templates/` or an installed CLAUDE.md
- [x] 2.2 State the injection requirement: "Every agent session must receive the instruction: read MANIFEST.yaml, load always_load skills, select task skills"
- [x] 2.3 Can `persistent_facts` express this verbatim? Or only a subset?
- [x] 2.4 Does `persistent_facts` reach into `.clinerules`, `.roomodes`, `AGENTS.md` as well as CLAUDE.md — or only into Claude Code's context?
- [x] 2.5 State the answer: YES (full replacement possible), PARTIAL (covers Claude Code only, others still need injection), or NO (different injection surface entirely)

### Task 3: Commit decision record to architecture.md (AC: 3)

- [x] 3.1 Write a one-paragraph finding under a new "P5-1 Addendum: persistent_facts spike finding" heading in `_bmad-output/planning-artifacts/architecture.md` in the planning worktree (`d:\Code\agents-epic-24-bmad-640-planning`) — NOT in `d:\Code\agents`
- [x] 3.2 If YES or PARTIAL: note "marker-injection simplification is feasible for [subset] — plan follow-up epic"
- [x] 3.3 If NO: note "marker-injection layer remains necessary — no follow-up action from Epic 24"

## Dev Notes

### This is a spike — no implementation

The output of this story is a decision record, not code. Do not modify `lib/installer.js`, `lib/bmad.js`, or any template file. If `persistent_facts` can replace marker injection, that work belongs in a dedicated follow-up epic where it can be scoped, tested, and rolled back safely.

### Why this matters

`lib/installer.js`'s marker-injection layer is the highest-maintenance surface in ma-agents. It has caused bugs in Epics 19, 20, 21, and 22 (drift detection, dual-file sync, backup handling). If BMAD now offers a native mechanism to inject persistent agent instructions, eliminating this layer would significantly reduce maintenance burden. But only if the injection surface is equivalent.

### Do not add new injection code

Regardless of what this spike finds, do not add new marker-injection features anywhere in Epic 24. Story 24.7 must also avoid adding injection code (it uses customize.toml only). This story is the gate that determines whether the injection layer has a future or an exit path.

### Input from Story 24.2

Story 24.2 Task 3 preliminary finding (2026-04-28, claude-sonnet-4-6): `persistent_facts` field not found in node_modules/bmad-method v6.5.0 npm package — searched .md, .toml, .yaml, and .js files with zero matches. The field is referenced in v6.4.0 release notes and architecture documentation as a TOML-based mechanism for injecting persistent agent instructions, but is not present in the installed npm package source. This may indicate the feature lives in Discord/release-notes documentation only, or is implemented in a layer of the tooling (e.g., the BMAD CLI runtime) that is not shipped as readable source in the npm tarball. Story 24.12 should investigate directly from the GitHub source repository (not node_modules) to determine whether `persistent_facts` is a viable replacement for ma-agents' marker-injection layer. Until the injection surface is confirmed, assessment is PARTIAL at best: even if the field exists, it would need to reach all 6 tool contexts (Claude Code, Copilot, Cline, Roo Code, Kilocode, OpenCode) to replace the current layer. Story 24.12 to check GitHub source.

### Reference Files

- `node_modules/bmad-method` — persistent_facts schema and documentation
- `lib/installer.js` — marker-injection layer (~300 lines: composeInstructionBlock, markdownMarkersMerger, stampExtraInstructionTemplates, handleMarkerBlockDrift)
- `lib/templates/` — instruction block templates
- `architecture.md` — P5-1 addendum target

## Dev Notes (continued)

### Project Structure Notes

Files to READ in this spike (do not modify any of them):

- `node_modules/bmad-method` — locate `persistent_facts` schema:
  ```
  grep -r "persistent_facts" node_modules/bmad-method/ --include="*.yaml" --include="*.toml" --include="*.md" | head -20
  ```
  Also search customize.toml documentation:
  ```
  find node_modules/bmad-method -name "customize.toml" -o -name "*.toml" | head -10
  ```
- `lib/installer.js` — the marker-injection layer to potentially replace. Key functions (read-only reference):
  - `composeInstructionBlock()` at line ~113 — generates the universal instruction block content
  - `markdownMarkersMerger()` at line ~769 — writes the `<!-- MA-AGENTS-START -->` block into CLAUDE.md, .clinerules, AGENTS.md
  - `stampExtraInstructionTemplates()` at line ~857 — dispatches to `markdownMarkersMerger` and `yaml-customModes` merger for .roomodes
  - `handleMarkerBlockDrift()` at line ~710 — handles when the injected block was edited by the user
  - Total injection layer: ~300 lines (lines ~710-1130 approximately)
- `lib/templates/instruction-block-universal.template.md` — the content that gets injected. Read this to understand what `persistent_facts` must replicate.
- `lib/templates/instruction-block-onprem.template.md` — the on-prem variant. `persistent_facts` must handle both profiles.

**Tools that receive marker injection** (from `lib/agents.js`):
- Claude Code → `.claude/CLAUDE.md` (markdown-markers)
- Copilot → `.github/copilot/copilot.md` (markdown-markers)
- Cline → `.cline/clinerules.md` + `.clinerules` (markdown-markers, dual-file)
- Roo Code → `.roo/rules/00-ma-agents.md` + `.roomodes` (markdown-markers + yaml-customModes)
- Kilocode → `.kilocode/kilocode.md` (markdown-markers)
- OpenCode → `opencode.json` (json-merge)

For `persistent_facts` to be a FULL replacement, it must reach ALL 6 tool contexts above. Partial replacement (e.g., Claude Code only) is a valid finding — document the injection surface coverage precisely.

- `_bmad-output/planning-artifacts/architecture.md` — the target for the P5-1 addendum (Task 3). The planning worktree version.

### Testing Requirements

This is a spike — no code changes, therefore no new tests.

If the outcome is YES (persistent_facts can replace marker injection), a follow-up epic will need tests. Document the test strategy as part of the decision record so the follow-up epic can reference it.

How to run tests (sanity check only): `npm test` in `d:\Code\agents`

### What this story does NOT do

- Does NOT modify `lib/installer.js` or any marker-injection path
- Does NOT modify any template files in `lib/templates/`
- Does NOT add new TOML or hook configurations (Story 24.7 is the gate for that)
- Does NOT produce any code output — the sole deliverable is the architecture.md decision record

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-27 | 1.0.0 | (pending) | Story created per adversarial review finding 4 — persistent_facts spike to determine if marker-injection layer can be removed |
| 2026-04-28 | 1.1.0 | (pending) | Enhanced to ready-for-dev: added project structure notes, exact function references with line numbers, injection surface table, search patterns for node_modules investigation |
| 2026-04-28 | 1.2.0 | claude-sonnet-4-6 | Spike implemented — finding: NO. persistent_facts absent from npm package v6.3.0; injection surface incompatible with ma-agents' 6-tool requirement even if field existed. Decision record committed to architecture.md. |

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
(none — spike, no code changes)

### Completion Notes List
- Task 1: `grep -r "persistent_facts" node_modules/bmad-method/` returned zero matches across all file types. The installed package is v6.3.0 (not v6.5.0 as the story assumed). No `.toml` files with `persistent_facts` exist anywhere in the npm tarball.
- Task 2: WebSearch + WebFetch confirmed `persistent_facts` exists in BMAD's online documentation (docs.bmad-method.org) as a v6.4.0 feature — an array-of-strings loaded during BMAD workflow/agent activation as foundational context. However, it is a BMAD CLI runtime concept, not a disk-injection mechanism. It does not write to `.clinerules`, `.roomodes`, `opencode.json`, or any of the 6 tool config files. Coverage is limited to BMAD-activated sessions only; tools used without BMAD workflow activation (Copilot, Cline standalone, Roo Code standalone, Kilocode, OpenCode) would receive nothing.
- Task 3: Decision record appended to `_bmad-output/planning-artifacts/architecture.md` as "P5-1 Addendum: persistent_facts Spike Finding (Story 24.12)". Finding: **NO**. Marker-injection layer remains necessary — no follow-up action from Epic 24.
- Confirmed: `lib/installer.js`, `lib/bmad.js`, and all `lib/templates/` files are UNTOUCHED.

### File List
- `_bmad-output/planning-artifacts/architecture.md` — P5-1 Addendum section appended
- `_bmad-output/implementation-artifacts/24-12-persistent-facts-spike-marker-injection-replacement.md` — checkboxes checked, status → review, Dev Agent Record filled
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 24-12 status → review
