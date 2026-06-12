# Story 27.4: Cline Workflow-Wrapper Reconciliation for Renamed/Retired Upstream Skills

Status: ready-for-dev

## Story

As a **ma-agents user with Cline selected**,
I want `.clinerules/workflows/` to contain wrappers for the current BMAD skills (including renamed/new ones like `bmad-ux`, `bmad-spec`, `bmad-investigate`, `bmad-prd`) and **no** dangling wrappers for skills BMAD renamed away or retired (e.g. `bmad-create-ux-design`, `bmad-distillator`),
So that `/`-invocation in Cline never offers a workflow whose underlying skill no longer exists.

**FR:** FR209 (extends F22 / P5-3). Independent of the cache rework; verified end-to-end after Story 27.5.

## Acceptance Criteria

1. **Given** `deployClineWorkflows()` runs on install/update with Cline selected, **When** it reconciles, **Then** any wrapper `.md` in `.clinerules/workflows/` whose corresponding `.cline/skills/<name>/` directory is absent is removed.

2. **Given** an update that deploys renamed/new upstream skills, **When** `deployClineWorkflows()` runs, **Then** wrappers are (re)generated for all current skills so the new ones appear without manual intervention.

3. **Given** reconciliation, **When** wrappers are removed, **Then** removal is scoped strictly to ma-agents-generated wrapper files under `.clinerules/workflows/` — user-authored files elsewhere under `.clinerules/` are never touched.

4. **Given** the same project and skill set, **When** install runs twice in a row, **Then** `.clinerules/workflows/` is byte-identical between runs (idempotent).

5. **Given** a test fixture, **When** the new test runs, **Then** it asserts: (a) a stale wrapper with no backing skill dir is removed; (b) a wrapper for a renamed/new skill is created; (c) a user file under `.clinerules/` is preserved.

## Tasks / Subtasks

### Task 1: Add reconciliation to deployClineWorkflows (AC: 1, 2, 3, 4)

- [ ] 1.1 Compute the live skill-name set from `.cline/skills/` subdirectories that contain `SKILL.md`
- [ ] 1.2 After (re)generating wrappers for all current skills, enumerate `.clinerules/workflows/*.md`
- [ ] 1.3 Delete any `<name>.md` whose `<name>` is not in the live skill-name set
- [ ] 1.4 Scope deletion strictly to the `workflows/` subdir wrapper files; never touch other `.clinerules/` content
- [ ] 1.5 Confirm idempotency (no spurious rewrites/deletions on a second run)

### Task 2: Test (AC: 5)

- [ ] 2.1 Fixture with `.cline/skills/{bmad-ux, ...}` present and a stale `.clinerules/workflows/bmad-create-ux-design.md`
- [ ] 2.2 Assert stale removed, new created, user file preserved
- [ ] 2.3 Assert a second run is byte-identical

## Dev Notes

- Current `deployClineWorkflows()` (`lib/bmad.js` ~1481-1553) only ever writes/overwrites via `fs.ensureDir` + `fs.writeFile` — it never deletes. The reconciliation (delete-stale) is the new behavior.
- Same stale-artifact class as the already-fixed `bug-stale-copilot-skills-dir-not-cleaned-on-upgrade` — reuse that cleanup's scoping discipline (delete only ma-agents-owned generated files).
- This story can be implemented and unit-tested before 27.5; full end-to-end validation (real renamed/retired skills present) requires the v6.8.0 deploy from 27.5.
