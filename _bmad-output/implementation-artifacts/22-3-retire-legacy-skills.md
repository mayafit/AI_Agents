# Story 22.3: Retire Legacy Skills (bmad-init, Quinn, Bob, Barry)

Status: backlog

## Story

As a **ma-agents maintainer**,
I want the four upstream-removed/consolidated persona skills retired from the ma-agents catalog,
So that the MANIFEST stops advertising skills that no longer exist in BMAD v6.3.0 and our agent set tracks the upstream Amelia consolidation.

## Acceptance Criteria

1. **Given** the four retirement targets (`bmad-init`, `bmad-agent-qa`, `bmad-agent-sm`, `bmad-agent-quick-flow-solo-dev`), **When** I read `.claude/skills/MANIFEST.yaml` after a fresh install, **Then** none of the four IDs appear in the skills list.

2. **Given** the source tree, **When** I look for the four skills' source folders, **Then** they no longer exist in either `lib/bmad-extension/skills/` or `skills/` (whichever pipeline they previously lived in).

3. **Given** `lib/bmad-extension/module-help.csv`, **When** I read it, **Then** no row references any of the four retired skills.

4. **Given** any other ma-agents skill that previously referenced one of the four (e.g., a workflow that says "invoke bmad-agent-qa for review"), **When** I read it, **Then** the reference is either rewritten to invoke the BMAD Amelia Developer skill or removed entirely if no longer applicable.

5. **Given** any ma-agents skill that previously assumed `bmad-init` had loaded BMAD config, **When** I read it, **Then** it now reads `_bmad/bmm/config.yaml` directly at the start of its workflow (this overlaps with Story 22.7's broader migration; keep changes here scoped to skills that explicitly invoked `bmad-init`).

6. **Given** documentation files (`README.md`, `docs/*.md`, `_bmad-output/planning-artifacts/project-context.md`), **When** I read them, **Then** references to Quinn (QA), Bob (SM), and Barry (quick-flow-solo-dev) are either rewritten to reference Amelia or removed.

7. **Given** an existing user installation that has the four retired skills installed, **When** the user runs `npx ma-agents install` with this story's code, **Then** the installer detects the retired IDs in `.ma-agents.json` and removes both the manifest entries and the installed skill files from every agent's skills directory.

8. **Given** dated historical entries in PRD/architecture/epics edit-history sections, **When** I read them, **Then** they are NOT modified — historical records of past states remain accurate as-of their date.

## Tasks / Subtasks

### Task 1: Inventory and confirm (AC: 2)

- [ ] 1.1 Locate the four skill source folders. Likely paths:
  - `lib/bmad-extension/skills/bmad-init/`
  - `lib/bmad-extension/skills/bmad-agent-qa/`
  - `lib/bmad-extension/skills/bmad-agent-sm/`
  - `lib/bmad-extension/skills/bmad-agent-quick-flow-solo-dev/`
  - (Some may live in `skills/` instead — check both)
- [ ] 1.2 Document the actual paths in the story's Dev Notes
- [ ] 1.3 Confirm with the maintainer that all four are intended for removal (not just hide-from-MANIFEST)

### Task 2: Sweep cross-references (AC: 4, 5)

- [ ] 2.1 Run `grep -rn "bmad-init\|bmad-agent-qa\|bmad-agent-sm\|bmad-agent-quick-flow-solo-dev" --include="*.md" --include="*.yaml" --include="*.csv" --include="*.json" --include="*.js" .`
- [ ] 2.2 Categorize matches: (a) source files using the skill, (b) historical/dated entries to leave alone, (c) doc references to rewrite
- [ ] 2.3 For category (a), update each file:
  - Workflows that invoke `bmad-agent-qa` for QA work → invoke the BMAD Amelia Developer agent (or the appropriate built-in QA workflow if one is available in 6.3.0)
  - Skills that depend on `bmad-init` → read `_bmad/bmm/config.yaml` directly
  - Workflows referencing Bob or Barry → rewrite to reference Amelia or remove if no longer applicable

### Task 3: Remove source folders (AC: 2)

- [ ] 3.1 `git rm -r` each of the four skill source folders identified in Task 1
- [ ] 3.2 Verify with `git status` that the deletes are clean

### Task 4: Update module-help.csv (AC: 3)

- [ ] 4.1 Edit `lib/bmad-extension/module-help.csv` — remove any rows referencing the four retired skill IDs

### Task 5: Update documentation (AC: 6)

- [ ] 5.1 Sweep `README.md` for Quinn, Bob, Barry, and `bmad-init` references — rewrite to Amelia or remove
- [ ] 5.2 Sweep `docs/*.md` similarly
- [ ] 5.3 Update `project-context.md` template (`lib/templates/project-context.template.md`) if it lists the retired agents in its agent roster section

### Task 6: Implement migration of existing user installations (AC: 7)

- [ ] 6.1 In `lib/installer.js`, extend the existing manifest-cleanup logic (or add a new step) to:
  - On install, check `.ma-agents.json` for any of the four retired skill IDs
  - For each found, remove the manifest entry AND delete the installed skill files from every agent's skills directory
  - Make the migration idempotent
- [ ] 6.2 If Story 22.2's migration helper is also present, coordinate so both run cleanly in a single install

### Task 7: Update MANIFEST.yaml in installed agent locations (AC: 1)

- [ ] 7.1 Run `npx ma-agents install --yes --force` against a scratch project
- [ ] 7.2 Verify the resulting `.claude/skills/MANIFEST.yaml` does NOT list any of the four retired IDs
- [ ] 7.3 Repeat for at least one non-Claude target (e.g., `--tools copilot`) to confirm the retirement applies across tools

### Task 8: Verify the installer survives a v6.3.0 install with the four skills retired (AC: all)

- [ ] 8.1 With v6.3.0 installed (per Story 22.1) and the four skills removed, run a full install end-to-end against a scratch project
- [ ] 8.2 Confirm exit code 0 and no errors mentioning any of the four retired skill IDs

## Dev Notes

### Why these four

- **`bmad-init`** — Removed upstream in BMAD 6.3.0 PR #2159. Agents now read `_bmad/bmm/config.yaml` directly with no init-skill ceremony.
- **`bmad-agent-qa` (Quinn)** — Merged into Amelia in PR #2186.
- **`bmad-agent-sm` (Bob)** — Merged into Amelia in PR #2179.
- **`bmad-agent-quick-flow-solo-dev` (Barry)** — Merged into Amelia in PR #2177.

The upstream BMAD project consolidated three persona agents (Quinn QA, Bob SM, Barry solo-dev) into a single Amelia Developer agent in v6.3.0. Our retirement aligns the ma-agents catalog with that decision and stops advertising skills that no longer exist upstream.

### Coordination with Story 22.7

Story 22.7 broadens the `_bmad/_config/*` → `_bmad/bmm/config.yaml` migration across all ma-agents code. Story 22.3 makes the same change for skills that explicitly invoked `bmad-init` — these two stories overlap by design. If 22.7 lands first, this task is a no-op for the bmad-init callers. If 22.3 lands first, 22.7 picks up the rest.

### Historical references

PRD/architecture/epics edit-history entries document past states accurately. They reference Quinn, Bob, Barry, and `bmad-init` because those skills existed at the time of writing. Do NOT rewrite history — only update live source and current-state docs.

### Reference Files

- `lib/bmad-extension/skills/` — source tree to clean
- `lib/bmad-extension/module-help.csv` — registry rows to remove
- `lib/installer.js` — migration helper
- `lib/templates/project-context.template.md` — agent roster mention
- `README.md`, `docs/` — doc references

### PRD Traceability

- **FR190:** Retire `bmad-init`, `bmad-agent-qa`, `bmad-agent-sm`, `bmad-agent-quick-flow-solo-dev` from the ma-agents MANIFEST
- **FR191:** Documentation references updated to reflect the unified Amelia Developer persona

### Architecture Reference

- Decision P4-1, "Legacy skill retirement" subsection
- Upstream PR references: #2159 (bmad-init removal), #2177/#2179/#2186 (persona consolidation)

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
