# Story 28.3: Passthrough Reconciliation — bmad-forge-idea, Architecture Shim, Deferred Platforms

Status: review

## Story

As a **ma-agents user with Cline selected**,
I want, after upgrading to BMAD v6.9.0, my `.clinerules/workflows/` to gain a `bmad-forge-idea` wrapper and tolerate the `bmad-architecture`/`bmad-create-architecture` shim pair without any dangling wrapper, and any ma-agents-owned enumeration of the skill set to surface the new skill without breaking on the shim — all via the existing reconcile-and-prune logic, with no new mechanism,
So that `/`-invocation never offers a workflow whose underlying skill no longer exists nor omits a new one.

**Blocked by:** Story 28.1 (the renamed/new upstream skills are only deployed once the v6.9.0 pin lands). Runs in parallel with Story 28.2.

**FR:** FR214.

## Acceptance Criteria

1. **Given** the v6.9.0 bump, **When** `deployClineWorkflows()` (the existing P5-5 reconcile-and-prune logic in `lib/bmad.js`) runs, **Then** it generates a `.clinerules/workflows/bmad-forge-idea.md` wrapper (the new skill has a backing `.cline/skills/bmad-forge-idea/` directory). **No new reconciliation mechanism is introduced** — the existing reconcile-and-prune already covers additions.

2. **Given** the `bmad-architecture` (new) / `bmad-create-architecture` (forwarding shim retained until BMAD v7) pair, **When** workflows are reconciled, **Then** I have first confirmed (precondition, Task 0) that each deploys as a `.cline/skills/<name>/` directory **containing a `SKILL.md`** — so each gets a wrapper and **neither** produces a dangling wrapper, and the shim does not trigger a stale-wrapper removal of either. If the architecture shim deploys without a `SKILL.md` dir, the story **halts and escalates** rather than emitting a dangling/missing wrapper.

3. **Given** the only **live, computed** skill enumeration ma-agents owns — the Cline wrapper set, which `deployClineWorkflows()` derives by computing `liveSkillNames` from the `.cline/skills/<name>/SKILL.md` directories (`lib/bmad.js` ~1563–1647) — **When** I inspect it after the bump, **Then** it surfaces `bmad-forge-idea` and does not break on the `bmad-architecture`/`bmad-create-architecture` shim pair, neither advertising a non-existent skill nor omitting the new one. (`MANIFEST.yaml` does **not** enumerate BMAD core skills, so there is no separate static list to reconcile — the wrapper set computed live from `.cline/skills/` is the load-bearing enumeration.)

4. **Given** this epic, **When** I inspect `lib/agents.js`, **Then** it is explicitly asserted that **hermes-agent** and **CodeWhale** are **NOT** added to ma-agents' platform registry — no hermes-agent / CodeWhale entry exists — with a one-line note in the code/docs pointing to a future story should demand appear (passthrough already deploys upstream support) (FR214).

5. **Given** the reconciliation, **When** a test runs, **Then** it asserts: (a) the `bmad-forge-idea` wrapper is created; (b) the architecture shim pair leaves no dangling wrapper; (c) `lib/agents.js` contains no hermes-agent / CodeWhale platform entry.

## Tasks / Subtasks

### Task 0 (precondition): Inspect the deployed shim/new-skill dir shape (AC: 1, 2)

- [ ] 0.1 After the v6.9.0 bump, inspect the deployed `.cline/skills/bmad-forge-idea/` and `.cline/skills/bmad-create-architecture/` (and `.cline/skills/bmad-architecture/`); confirm each contains a `SKILL.md` (so wrapper generation + the no-dangling guarantee both hold — the enumeration keys off `<name>/SKILL.md`)
- [ ] 0.2 If the architecture shim deploys **without** a `SKILL.md` dir (e.g. as a bare forwarding pointer), **halt and escalate** — wrapper generation and the no-dangling invariant cannot both hold, and the reconcile logic may need an upstream-shape adjustment

### Task 1: Verify forge-idea wrapper generation (AC: 1)

- [ ] 1.1 After the v6.9.0 bump, confirm `deployClineWorkflows()` generates `.clinerules/workflows/bmad-forge-idea.md` (backing `.cline/skills/bmad-forge-idea/` present)
- [ ] 1.2 Confirm no new reconciliation mechanism is added — the existing P5-5 reconcile-and-prune covers it

### Task 2: Tolerate the architecture shim pair (AC: 2)

- [ ] 2.1 Confirm `bmad-architecture` and `bmad-create-architecture` each have a backing skill dir → each gets a wrapper, neither dangles
- [ ] 2.2 Confirm the shim does not trigger a stale-wrapper removal of either

### Task 3: Live enumeration surfaces the new skill (AC: 3)

- [ ] 3.1 Verify the load-bearing enumeration — the Cline wrapper set `deployClineWorkflows()` computes from `.cline/skills/<name>/SKILL.md` (`lib/bmad.js` ~1563–1647) — surfaces `bmad-forge-idea` and does not break on the shim pair. (Confirm `MANIFEST.yaml` does not enumerate BMAD core skills, so there is no separate static list to update.)

### Task 4: Assert the deferral + test (AC: 4, 5)

- [ ] 4.1 Assert `lib/agents.js` has no hermes-agent / CodeWhale entry; add a one-line deferral note pointing to a future story
- [ ] 4.2 Add a test asserting (a) forge-idea wrapper created, (b) shim pair leaves no dangling wrapper, (c) no hermes-agent/CodeWhale entry in `lib/agents.js`

## Dev Notes

- This is a verification/reconciliation story, not a re-authoring story — the skill bodies, the architecture rewrite, and the shim are upstream passthrough.
- Reuse the existing P5-5 (Story 27.4) `deployClineWorkflows` reconcile-and-prune logic and its scoping discipline: removal scoped strictly to ma-agents-generated wrappers under `.clinerules/workflows/`; user-authored content under `.clinerules/` is never touched. Confirm idempotency holds for the new skill set (install twice ⇒ byte-identical).
- The load-bearing enumeration is the Cline wrapper set: `deployClineWorkflows()` computes `liveSkillNames` from `.cline/skills/<name>/SKILL.md` directories (`lib/bmad.js` ~1563–1647). `MANIFEST.yaml` does not enumerate BMAD core skills, so there is no separate static list to reconcile — concretize AC3 to this live set, not a "MANIFEST.yaml / per-tool pointer / docs" list.
- The forwarding shim is expected to be a normal backing dir containing `SKILL.md`, so it is treated like any other live skill — but this is the precondition Task 0 verifies before relying on it; if the shim deploys without a `SKILL.md` dir, halt and escalate.
- hermes-agent / CodeWhale are deferred-by-decision (P5-6 (d)) — passthrough already deploys upstream support; first-class adoption would pull in the full per-tool routing / instruction-injection / skill-resolution stack for two platforms with no current demand.
