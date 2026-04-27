# Story 24.12: Spike — Can persistent_facts Replace ma-agents' Marker-Injection Layer?

Status: backlog

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

- [ ] 1.1 Locate `persistent_facts` in BMAD v6.5.0 source: `node_modules/bmad-method` — search for `persistent_facts` in customize.toml docs or schema files
- [ ] 1.2 Document: what type does it accept (string, array, object)?
- [ ] 1.3 Document: when is it injected — at workflow start? At every agent turn? Only for specific workflow types?
- [ ] 1.4 Document: which tools receive it — Claude Code only? All 5 registered tools? Tool-agnostic?

### Task 2: Compare against marker-injection content (AC: 2)

- [ ] 2.1 Read the current `<!-- MA-AGENTS-START -->` block content from `lib/templates/` or an installed CLAUDE.md
- [ ] 2.2 State the injection requirement: "Every agent session must receive the instruction: read MANIFEST.yaml, load always_load skills, select task skills"
- [ ] 2.3 Can `persistent_facts` express this verbatim? Or only a subset?
- [ ] 2.4 Does `persistent_facts` reach into `.clinerules`, `.roomodes`, `AGENTS.md` as well as CLAUDE.md — or only into Claude Code's context?
- [ ] 2.5 State the answer: YES (full replacement possible), PARTIAL (covers Claude Code only, others still need injection), or NO (different injection surface entirely)

### Task 3: Commit decision record to architecture.md (AC: 3)

- [ ] 3.1 Write a one-paragraph finding under a new "P5-1 Addendum: persistent_facts spike finding" heading in `architecture.md`
- [ ] 3.2 If YES or PARTIAL: note "marker-injection simplification is feasible for [subset] — plan follow-up epic"
- [ ] 3.3 If NO: note "marker-injection layer remains necessary — no follow-up action from Epic 24"

## Dev Notes

### This is a spike — no implementation

The output of this story is a decision record, not code. Do not modify `lib/installer.js`, `lib/bmad.js`, or any template file. If `persistent_facts` can replace marker injection, that work belongs in a dedicated follow-up epic where it can be scoped, tested, and rolled back safely.

### Why this matters

`lib/installer.js`'s marker-injection layer is the highest-maintenance surface in ma-agents. It has caused bugs in Epics 19, 20, 21, and 22 (drift detection, dual-file sync, backup handling). If BMAD now offers a native mechanism to inject persistent agent instructions, eliminating this layer would significantly reduce maintenance burden. But only if the injection surface is equivalent.

### Do not add new injection code

Regardless of what this spike finds, do not add new marker-injection features anywhere in Epic 24. Story 24.7 must also avoid adding injection code (it uses customize.toml only). This story is the gate that determines whether the injection layer has a future or an exit path.

### Input from Story 24.2

Story 24.2 Task 3 contains preliminary findings from reading the `persistent_facts` schema. Use those findings as a starting point — don't duplicate that research.

### Reference Files

- `node_modules/bmad-method` — persistent_facts schema and documentation
- `lib/installer.js` — marker-injection layer (~300 lines: composeInstructionBlock, markdownMarkersMerger, stampExtraInstructionTemplates, handleMarkerBlockDrift)
- `lib/templates/` — instruction block templates
- `architecture.md` — P5-1 addendum target

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-27 | 1.0.0 | (pending) | Story created per adversarial review finding 4 — persistent_facts spike to determine if marker-injection layer can be removed |
