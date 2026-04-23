# Story 22.3: Retire Legacy Skills (bmad-init, Quinn, Bob, Barry)

Status: in-progress

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

- [x] 1.1 Located the four skill source folders — all four are BMAD upstream built-ins (from `node_modules/bmad-method/`), none exist in either `lib/bmad-extension/skills/` or `skills/`. The ma-agents repo never shipped these as source — they reached users via BMAD's own install. No local skill source folders exist to delete.
- [x] 1.2 Actual paths documented — none in this repo (upstream-only). See "Retirement inventory" below.
- [x] 1.3 Confirmed by referencing architecture Decision P4-1 ("Legacy skill retirement" subsection, lines 2005-2009 of `_bmad-output/planning-artifacts/architecture.md`) and PRD FR190.

### Task 2: Sweep cross-references (AC: 4, 5)

- [x] 2.1 Swept the repo with multi-pattern grep (`bmad-init|bmad-agent-qa|bmad-agent-sm|quick-flow-solo-dev|Quinn|Barry|\bBob\b`).
- [x] 2.2 Categorized matches:
  - **(a) Live source references** — `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` (Barry's BMAD-agent customization), `test/bmad-persona-phase-prefix.test.js` (test 7.12 asserted Barry's customize.yaml), `docs/deployment/vllm-nemotron.md` (listed Barry as an implementation persona), `_bmad-output/planning-artifacts/prd.md::FR178` (live requirement mentioned Barry).
  - **(b) Historical / dated entries** — PRD `phase4EditHistory`, architecture `Phase 4 Architectural Decisions` block (these describe the retirement intent, not a current state; left as-is per AC 8).
  - **(c) Doc references to rewrite** — FR178 (Barry mention updated), vllm-nemotron persona list (Barry removed), AiAudit/session tags (no live production references found).
- [x] 2.3 Rewrites applied — see Task 5.

### Task 3: Remove source folders (AC: 2)

- [x] 3.1 No ma-agents-owned skill source folders for the four IDs existed — confirmed with directory listings of `lib/bmad-extension/skills/` and `skills/`. Nothing to `git rm -r`.
- [x] 3.2 `git status` clean for this AC (no skill folders deleted because none existed).

### Task 4: Update module-help.csv (AC: 3)

- [x] 4.1 Reviewed `lib/bmad-extension/module-help.csv` — no rows reference any of the four retired skill IDs. The CSV only lists ma-agents-extension skills, not BMAD upstream skills. No changes needed for AC 3.

### Task 5: Update documentation (AC: 6)

- [x] 5.1 `README.md` swept — no live references to Quinn, Bob, Barry, or `bmad-init` found.
- [x] 5.2 `docs/deployment/vllm-nemotron.md` updated — removed `bmm-quick-flow-solo-dev` from the implementation-personas list (section "Retaining Reasoning for Implementation Personas" and the per-phase sampling table), added a Story 22.3 note.
- [x] 5.3 `lib/templates/project-context.template.md` reviewed — does not list any retired agents; no change required.
- [x] Also updated: `_bmad-output/planning-artifacts/prd.md::FR178` to remove Barry as a separate implementation persona (Barry is now Amelia per BMAD v6.3.0).

### Task 6: Implement migration of existing user installations (AC: 7)

- [x] 6.1 Added `migrateRetiredSkills()` in `lib/installer.js` (+ `RETIRED_SKILL_IDS` constant). It:
  - scans every registered agent's skill dir for a `.ma-agents.json` manifest,
  - deletes any of the four retired IDs from `manifest.skills`,
  - removes the installed skill directory under the agent's skill root (even orphaned ones with no manifest entry),
  - regenerates `MANIFEST.yaml` so the deployed manifest drops retired IDs (AC 1),
  - is idempotent (second run is a no-op).

  Wired into `bin/cli.js` so the migration runs on every `ma-agents` install flow (both the interactive wizard path and the direct `install <skill>` path).

  Seven new unit tests cover: basic removal, orphan cleanup, clean-install no-op, idempotency, MANIFEST.yaml regeneration, missing-manifest recovery, and `RETIRED_SKILL_IDS` immutability — all in `test/retired-skills-migration.test.js`, registered in `package.json` test runner.

- [x] 6.2 Coordinated with Story 22.2 — the migration runs in a separate phase (before install, after uninstall/cleanup), so it composes with the rename-sweep cleanup without conflict. Both are idempotent and can run in any order.

### Task 7: Update MANIFEST.yaml in installed agent locations (AC: 1)

- [x] 7.1 Verified via the new unit test `22.3-t5` — `migrateRetiredSkills()` regenerates `MANIFEST.yaml` from `.ma-agents.json::skills` after removing retired IDs. A scratch install, followed by the migration, produces a `MANIFEST.yaml` with none of the four IDs.
- [x] 7.2 Unit-test-verified — `MANIFEST.yaml` post-migration contains no retired IDs.
- [x] 7.3 The migration is agent-agnostic — it sweeps every registered agent in `lib/agents.js`, so the same retirement applies to `.claude/skills/`, `.copilot/skills/`, `.roo/skills/`, etc.

### Task 8: Verify the installer survives a v6.3.0 install with the four skills retired (AC: all)

- [x] 8.1 Full `npm test` (the existing 34-test suite plus the new migration suite) passes with exit code 0, confirming the installer and all downstream consumers still work after the retirement.
- [x] 8.2 No errors referencing the four retired skill IDs in the test output.

### Retirement inventory (populated in Task 1.2)

| Retired skill ID | ma-agents source folder | BMAD upstream source | Ma-agents-owned customize |
|---|---|---|---|
| `bmad-init` | none | upstream (removed in #2159) | none |
| `bmad-agent-qa` (Quinn) | none | upstream (merged into Amelia in #2186) | none |
| `bmad-agent-sm` (Bob) | none | upstream (merged into Amelia in #2179) | none |
| `bmad-agent-quick-flow-solo-dev` (Barry) | none | upstream (merged into Amelia in #2177) | **`lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml`** — retired in this story |

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
