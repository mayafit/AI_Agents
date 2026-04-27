# Story 24.11: Assess .agents/skills/ Cross-Tool Standard Impact on ma-agents Routing

Status: backlog

## Story

As a **ma-agents maintainer**,
I want to evaluate whether BMAD v6.5.0's `.agents/skills/` cross-tool standard can replace or supplement ma-agents' per-tool routing entries in `lib/agents.js`,
So that ma-agents automatically covers future platforms without per-tool registry maintenance, and we eliminate the risk of skill duplication or broken routing for platforms that have migrated to the standard.

## Acceptance Criteria

1. **Given** BMAD v6.5.0's `.agents/skills/` standard (#2313), **When** I identify which of the 42 supported platforms now use this standard directory, **Then** I can list which overlap with ma-agents' currently registered tools (Claude Code, Copilot, Cline, Roo Code, Kilocode) — and for each overlap, confirm whether the platform reads BOTH the old per-tool path AND `.agents/skills/`, or exclusively the new standard.

2. **Given** the overlap analysis in AC1, **When** any registered tool has migrated exclusively to `.agents/skills/`, **Then** the corresponding entry in `lib/agents.js` `skillsDir` is updated to `.agents/skills/`, or a dual-path strategy is implemented and documented.

3. **Given** the overlap analysis in AC1, **When** `.agents/skills/` is confirmed as a safe single install target for the majority of supported tools, **Then** a proposal is documented: can ma-agents simplify to one primary install path (`.agents/skills/`) plus explicit overrides only for platforms that don't support the standard?

4. **Given** Bug B1 (`--agent` flag not scoping installs) is fixed before this story runs, **When** I test per-tool install isolation with `--agent <tool>`, **Then** the routing changes from this story can be validated in isolation.

5. **Given** any `lib/agents.js` changes that replace or remove a `skillsDir` path, **When** those changes are made, **Then** the old path is registered in the `OBSOLETE_TOOL_SKILL_DIRS` registry (established in Bug B2) so upgrade installs clean up stale skill directories. No routing change ships without a corresponding stale-dir cleanup entry.

6. **Given** any `lib/agents.js` changes, **When** `npm test` runs, **Then** exit code 0.

7. **Given** this story's findings, **When** it closes, **Then** a recommendation is committed to `architecture.md` as an addendum to Decision P5-1 — either "adopt `.agents/skills/` as primary path in follow-up epic" or "per-tool routing remains correct; standard path is additive only."

## Tasks / Subtasks

### Task 1: Map platform overlap (AC: 1) — prerequisite: Bug B1 fixed

- [ ] 1.1 Read BMAD v6.5.0 platform list from `node_modules/bmad-method` or release notes — identify all 42 platforms and their skill directory paths
- [ ] 1.2 For each of ma-agents' 5 registered tools, check: does its BMAD installer entry now route to `.agents/skills/` instead of (or in addition to) its previous per-tool directory?
- [ ] 1.3 Produce a table: Tool | Old skillsDir | New skillsDir (if changed) | Reads both? | Exclusive to new?

### Task 2: Fix routing for exclusively-migrated tools (AC: 2)

- [ ] 2.1 For any tool that now reads exclusively from `.agents/skills/`: update `lib/agents.js` entry `skillsDir` to `.agents/skills/`
- [ ] 2.2 For any tool that reads BOTH: add a second install step or document that dual-path install is needed; update `lib/installer.js` if needed
- [ ] 2.3 Run a scratch install per affected tool; verify skills land in correct location

### Task 3: Evaluate single-path simplification (AC: 3)

- [ ] 3.1 Count: how many of the 5 registered tools now support `.agents/skills/`?
- [ ] 3.2 If ≥3: document the simplification proposal — "replace per-tool routing with `.agents/skills/` as default + explicit overrides for non-standard tools" — as an architecture recommendation for a follow-up epic
- [ ] 3.3 If <3: document that per-tool routing remains the correct approach for now; `.agents/skills/` is tracked for future adoption

### Task 4: Validate with B1-fixed tool scoping (AC: 4)

- [ ] 4.1 For each modified tool entry, run `npx ma-agents install --agent <tool> --yes --force` against a scratch project
- [ ] 4.2 Assert ONLY the expected skill directory is populated
- [ ] 4.3 Assert `.agents/skills/` is populated if the tool uses the standard

### Task 5: Register stale dirs in OBSOLETE_TOOL_SKILL_DIRS (AC: 5)

- [ ] 5.1 For each `skillsDir` path that was changed or removed in Task 2, locate the `OBSOLETE_TOOL_SKILL_DIRS` registry in `lib/installer.js` (or wherever B2 placed it)
- [ ] 5.2 Add an entry per tool: `{ tool: '<tool-name>', dir: '<old-skillsDir-path>' }`
- [ ] 5.3 Verify upgrade logic iterates `OBSOLETE_TOOL_SKILL_DIRS` and removes stale directories during install

### Task 6: Update architecture.md with recommendation (AC: 7)

- [ ] 6.1 Append a P5-1 addendum to `architecture.md`: routing findings and recommendation
- [ ] 6.2 If simplification is warranted: note it as a follow-up epic candidate

### Task 7: Run test suite (AC: 6)

- [ ] 7.1 `npm test` — exit 0

## Dev Notes

### Prerequisite: Bug B1 must be fixed first

Bug B1 (`--agent` flag not scoping the install) is a prerequisite for validating any per-tool routing change. Without a working `--agent` scope, it's impossible to verify that a routing change produces the correct isolated result. Schedule B1 fix before this story is activated.

### Prerequisite: Bug B2 must be merged before activating Task 5

Bug B2 (`OBSOLETE_TOOL_SKILL_DIRS` registry pattern) must be merged before this story's Task 5 is written, because this story extends B2's pattern. If B2 is not yet merged when this story is activated, Task 5 must establish the registry itself (treat it as the B2 implementation).

### Risk: skill duplication

If any of ma-agents' 5 registered tools now reads BOTH the old per-tool path AND `.agents/skills/`, and ma-agents installs to the old path only, the platform may show duplicate skills (once from ma-agents' install, once from BMAD's standard install). This is the highest-priority thing to detect in Task 1.

### Risk: broken routing

If a platform migrated exclusively to `.agents/skills/` and ma-agents still installs to the old per-tool path, that platform's users get zero ma-agents skills without error. Silent failure.

### What this story does NOT do

- Does NOT migrate the full routing architecture to `.agents/skills/` (that's a follow-up epic if Task 3 recommends it)
- Does NOT add new platforms — only evaluates the 5 already registered
- Does NOT touch the plugin bundle structure

### Reference Files

- `lib/agents.js` — per-tool routing registry
- `node_modules/bmad-method` — platform list and skill directory mappings for v6.5.0
- `lib/installer.js` — install loop that iterates agents
- `architecture.md` — P5-1 addendum target

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-27 | 1.0.0 | (pending) | Story created per adversarial review finding 3 — .agents/skills/ cross-tool standard must be assessed before Epic 24 ships |
| 2026-04-28 | 1.1.0 | (pending) | Added AC5 and Task 5 — every routing change must register old skillsDir in OBSOLETE_TOOL_SKILL_DIRS to prevent stale-dir debt. Per second adversarial review Finding 4. |
