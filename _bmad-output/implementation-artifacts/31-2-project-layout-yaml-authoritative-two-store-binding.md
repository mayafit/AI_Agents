# Story 31.2: `project-layout.yaml` Becomes the Authoritative, Unconditional Two-Store Binding Record (Spine)

Status: review

## Story

As a **developer joining a project that someone else installed**,
I want the project's knowledge topology committed in `_bmad-output/project-layout.yaml` at the project root — two independently-located stores plus a sprint-management location —
So that my machine resolves planning artifacts to exactly the same places as everyone else's, and so that a skill installed globally can discover the topology from the project root alone.

**Priority:** Critical — spine/gate for threads A/B/C. Blocks 31.3, 31.5 and everything downstream.

**FR:** FR263, FR267, FR265 (read half). **NFR:** NFR79, NFR81, NFR83.

## Context

Epic 31 (Global Installation & Federated Knowledge Stores, PRD capability F26) splits one
knowledgebase into two independently-backed stores and adds Confluence as a backend. That only
works if the *binding* — where a project's knowledge lives — stops living in the per-machine,
gitignored `_bmad/bmm/config.yaml` (FR117) and becomes a committed, team-shared record. This story
is that binding spine: it does not build the two-store wizard (31.5), the config.yaml generator
(31.3), the staleness guard (31.4) or Confluence (31.8-31.10) — it defines and lands the schema,
writer and reader those stories build on.

Architecture: Decision P5-9 (`project-knowledge-and-repository-layout.md`), sub-decisions P5-9.1
(binding authority), P5-9.2 (one-way generation), P5-9.5 (store model), P5-9.6 (no mirror). Rejected
alternative: `.ma-agents.json` (addendum.md) — it is the skills-manifest/install-state file; mixing
project topology into it conflates two unrelated lifecycles.

## Acceptance Criteria

1. `_bmad-output/project-layout.yaml` carries a versioned schema with **exactly three** location
   records: `system_requirements_store`, `software_requirements_store`, `sprint_management`. Each
   store carries a `backend` (`file-system` | `confluence`) and its backend-specific fields. No
   fourth store, no `implementation_artifacts` record (FR267).
2. The file is written **unconditionally** on every project-scoped install/bind — not only in
   multi-repo or Jira mode. The "both concerns are same-repo => do not write" branch is removed.
3. The delete-on-single-repo behaviour is removed. An installer run never deletes an existing,
   authoritative `project-layout.yaml`. Regression test pins this.
4. Reading is one-way and one-place: the **binding resolver** reads topology from
   `project-layout.yaml` alone, never from `config.yaml`. `project-layout.yaml` is never derived
   from `config.yaml`.
5. **Legacy read (FR265 read half):** a pre-F26 `project-layout.yaml` (FR122 `knowledgebase`/
   `sprint_management` shape) or a legacy single `knowledgebase_path` is read as both stores
   pointing at that one location — no error, no rewrite.
6. **No credentials (NFR79):** a `confluence` store records only the space key and a
   `{title, id}` root-page identity — nothing else. Test proves no credential-shaped field can be
   written.
7. **Deterministic (NFR81):** the same answers produce a byte-identical file across runs; `generated`
   is the only varying field; `toPortablePath` preserved for both stores.
8. **Globally-installed resolution (NFR83):** the binding resolver, given only a project root,
   returns the full topology with no reference to per-machine install state. Test proves it
   succeeds with `_bmad/` absent entirely.
9. `_bmad-output/` remains tracked (FR58) — the installer does not add it to `.gitignore`.
10. Tests green (targeted files; see Test Evidence — the chained `npm test` is not the gate here).

## Tasks / Subtasks

### Task 1: Schema, writer, reader, resolver (AC: 1, 2, 3, 4, 5, 6, 7, 8) — `bin/cli.js`
- [x] 1.1 Add `schema_version: 2` and the three-record schema (`system_requirements_store`,
      `software_requirements_store`, `sprint_management`), each store enumerating only its own
      known fields (`backend`, `mode`/`path`/`gitUrl` for file-system; `space_key`,
      `root_page: {title, id}` for confluence).
- [x] 1.2 Rewrite `writeProjectLayoutYaml()`: remove the `bothSame` skip and the `fs.unlinkSync`
      delete branch; write unconditionally; map the still-single-question wizard's
      `{knowledgebase, sprintManagement}` onto both new stores.
- [x] 1.3 Add `resolveProjectTopology(projectRoot)` — the AC8/NFR83 binding resolver: reads
      `project-layout.yaml` only, no `_bmad/` reference, handles both schema v2 and legacy v1
      shapes, returns `null` on absence/corruption.
- [x] 1.4 Rewrite `readExistingLayout()` on top of `resolveProjectTopology()`, collapsing the two
      stores onto the legacy `{knowledgebase, sprintManagement}` shape every existing consumer
      expects; keep its own `config.yaml` fallback (FR265's config-only legacy path) — scoped to
      this function only, not the resolver.
- [x] 1.5 Add a minimal indentation-aware `parseLayoutYaml()` reader (replaces the old
      scan-to-end-of-file regex approach, which could bleed a later section's field into an
      earlier one with no boundary).
- [x] 1.6 Export `resolveProjectTopology`, `parseLayoutYaml`, `PROJECT_LAYOUT_SCHEMA_VERSION`.

### Task 2: Tests (AC: 1, 3, 4, 5, 6, 7, 8, 9)
- [x] 2.1 Update `test/config-storage.test.js`: the two tests that asserted the now-removed
      skip/delete behaviour are rewritten to assert the opposite (AC2/AC3); the structure
      assertion is updated for the new section names.
- [x] 2.2 Add `test/project-layout-binding-spine.test.js` (12 new tests) covering AC1, AC4, AC5,
      AC6, AC7, AC8, AC9 directly.
- [x] 2.3 Register the new test file in `package.json`'s `test` script.
- [x] 2.4 Verify `test/config-lost-on-update.test.js`, `test/portable-paths.test.js`,
      `test/config-layout.test.js`, `test/cicd-remote-mode.test.js` still pass unmodified (they do
      — see Test Evidence).

## Dev Notes

### Decision — the `readExistingLayout()` `config.yaml` fallback is kept, but scoped away from the resolver

P5-9.1 says topology is read "from `project-layout.yaml` ... and nowhere else." FR265, in the same
story, says a project "which has only the FR117 single `knowledgebase_path`" (a `config.yaml`
field) is read as both stores. Taken literally these conflict. Resolution used: **two different
consumers**, mirroring the F-3 pattern the implementation-readiness review already established for
AC8-vs-31.6-AC5:

- `resolveProjectTopology(projectRoot)` — the AC8/NFR83 **binding resolver** used by `ma-agents
  bind`/`ma-agents status` (31.13) — depends on `project-layout.yaml` alone, full stop. It never
  reads `config.yaml`. Verified by test (`resolveProjectTopology returns null when only config.yaml
  exists`).
- `readExistingLayout()` — an **install-time/reconfigure-wizard helper**, never called by any
  runtime skill — keeps its pre-existing `config.yaml` fallback so a project that predates
  `project-layout.yaml`'s unconditional-write behaviour still pre-populates the wizard correctly
  (FR265's "has only the FR117 single `knowledgebase_path`" case). This is not the "nowhere else"
  surface P5-9.1 is protecting.

This is a resolution, not a left-alone contradiction — recorded here per the task's instruction to
document the judgment call explicitly.

### Decision — collapse target for the legacy `{knowledgebase}` shape is the software requirements store

`readExistingLayout()` must return the old `{knowledgebase, sprintManagement}` shape for its
existing callers (`collectRepoLayout`, `writeRepoLayoutConfig`, `showCurrentLayout`,
`handleConfigLayout`). When collapsing the two-store topology back onto that single field, the
**software requirements store** is used, matching FR264/P5-9.2's own choice of the software store as
the legacy-field target for `config.yaml`'s `knowledgebase_path`. Until Story 31.5 ships two
independent questions, both stores are always identical (see next decision), so nothing is lost.

### Decision — single wizard answer maps onto both stores until 31.5

`writeProjectLayoutYaml({knowledgebase, sprintManagement})` keeps its existing parameter shape
(Story 31.5, not 31.2, splits the wizard into two independent questions) and writes
`layout.knowledgebase` into **both** `system_requirements_store` and `software_requirements_store`.
A future caller that already has two independently-resolved stores may pass
`systemRequirementsStore`/`softwareRequirementsStore` directly — they take precedence over
`knowledgebase` — so 31.5/31.13 can adopt the new shape without another writer rewrite.

### Decision — install-scope gate at the call site is untouched

An orchestrator message during this work flagged a potential AC2-vs-FR251 conflict: AC2 says
"unconditional... on every install", but a global install must do **no project-scoped work**
(FR251) — no project is even in scope. This is not a real conflict: AC2's "unconditional" describes
removing the **repo-layout** conditional (`bothSame`), not the **install-scope** conditional. The
existing `if (installScope === 'project')` guard around the `writeRepoLayoutConfig` +
`writeProjectLayoutYaml` call site (`bin/cli.js`, was line ~1616, now ~1798 after this story's
insertions) is **left exactly as-is** — global-install scope is thread D (Stories 31.1, 31.11-31.13),
not this story. Verified independently before the message arrived, and confirmed again against the
current file: the same guard also correctly wraps `reconcileAgentsSharedSkills` and the
project-context.md repo-layout update (~1941/1950) — no change needed there either.

### The sealed schema (landed)

```yaml
# Generated by ma-agents — do not edit manually
# The authoritative, committed record of where this project's knowledge
# lives (P5-9.1). Read by the binding resolver (ma-agents bind / status)
# and regenerated into _bmad/bmm/config.yaml on install and bind (31.3).
schema_version: 2
generated: "2026-08-03"
system_requirements_store:
  backend: file-system
  mode: same
  path: "."
software_requirements_store:
  backend: file-system
  mode: same
  path: "."
sprint_management:
  mode: same
  path: "."
```

A `confluence`-backed store (schema reserved for Story 31.8 — not producible by today's wizard):

```yaml
system_requirements_store:
  backend: confluence
  space_key: "ENG"
  root_page:
    title: "My Project"
    id: null   # populated whichever way OQ-4 resolves — the field always exists
```

`sprint_management` keeps its pre-existing `mode`/`path`/`gitUrl`/`jira_url`/`jira_project_key`
shape unchanged — it has no `backend` field; it is not one of the two backend-typed stores
(P5-9.5).

### The AC8/NFR83 resolver

`resolveProjectTopology(projectRoot)` in `bin/cli.js` (exported). Pure: reads
`<projectRoot>/_bmad-output/project-layout.yaml`, nothing else; returns `null` if absent/corrupt;
returns
`{ schemaVersion, generated, systemRequirementsStore, softwareRequirementsStore, sprintManagement }`
otherwise, with each store already `resolveStoredPath`-resolved to an absolute path. This is the
library function `ma-agents bind` and `ma-agents status` (Story 31.13 — not built here) are meant
to call. A globally-installed **BMAD skill** does not call it directly; per Story 31.6 AC5 skills
keep reading the generated `config.yaml`, satisfying NFR83 indirectly via the bind offer (31.11 AC6
-> 31.13 AC3). See `implementation-readiness-f26.md` finding F-3 — two different consumers, not a
contradiction.

### Parser rewrite

The old `readExistingLayout()` parsed one section at a time by slicing "everything after the
section header to end-of-file" and regexing for the first indented `mode:`/`path:` — which could
silently pick up a *later* section's field if the current section lacked it. With three top-level
records instead of two, and a nested `root_page` object, that risk grows. Replaced with
`parseLayoutYaml()`, a small indentation-aware parser scoped to exactly the subset of YAML this
module itself writes (flat scalars + one level of nesting) — not a general YAML library, matching
this codebase's existing hand-rolled-parser convention for this file. All existing round-trip
behaviour (portable paths, absolute-path passthrough, gitUrl, jira fields) is preserved and tested.

## Test Evidence

Targeted files run directly (`node test/<file>.test.js`), per the task's testing rules (the chained
`npm test` halts on pre-existing MIL-498 CRLF drift on Windows and is not used as the gate).

| Test file | Result (this worktree) | Result on `main` (`d:\Code\AI_Agents` @ `ccac270`) |
|---|---|---|
| `test/config-storage.test.js` | 16/16 pass (2 tests rewritten for AC2/AC3, 1 updated for new section names) | 16/16 pass (old behaviour — expected, code unchanged there) |
| `test/config-lost-on-update.test.js` | 13/13 pass, **unmodified** | 13/13 pass |
| `test/portable-paths.test.js` | 20/20 pass, **unmodified** | 20/20 pass |
| `test/config-layout.test.js` | 6/6 pass, **unmodified** | 6/6 pass |
| `test/cicd-remote-mode.test.js` | 9/9 pass, **unmodified** (doesn't touch this surface) | 9/9 pass |
| `test/project-layout-binding-spine.test.js` (new) | 13/13 pass | N/A (new file) |
| `test/generate-project-context.test.js` | 27/27 pass (unaffected — operates on layout objects, not the file) | not re-run (no code touched) |
| `test/cross-repo-validation.test.js` | 7/7 pass (unaffected — exercises `writeRepoLayoutConfig`/config.yaml, not this file) | not re-run |
| `test/repo-layout.test.js` | 13/13 pass | not re-run |
| `test/reconfigure.test.js` | 12/12 pass | not re-run |
| `test/installer.test.js` | 14/14 pass | not re-run |
| `test/cli.test.js` | 12/12 pass | not re-run |
| `test/bmad-output-policy.test.js` | 10/11 pass — 1 failure | **Same 1 failure reproduced on `main` @ `ccac270`**, identical assertion/message (`Section must be within the first few major sections, found 8 H2s before it`, `bmad-output-policy.test.js:118`) — **pre-existing, not a regression**, exactly the case flagged in the task brief. AC9 is otherwise covered by this suite's other 10 cases (`ensureBmadOutputTracked()`, Story 10.1) plus a new direct check in `project-layout-binding-spine.test.js` that `writeProjectLayoutYaml()` itself never touches `.gitignore`. |

Total: 162 passing, 1 pre-existing (baseline-confirmed) failure, 0 regressions.

### Self-review (`code-review` skill)

Ran the `code-review` skill against this diff before finalizing, per the project's git-workflow
discipline. One real finding, fixed: `serializeStore()` originally treated any `store.backend` value
other than exactly `'confluence'` as file-system — an unrecognized/typo'd backend (e.g.
`'sharepoint'`) would silently be written as `backend: file-system` with no signal. Fixed by
validating the backend against the closed AC1 enum (`file-system` | `confluence` | undefined) and
throwing an actionable error otherwise; pinned by a new regression test
(`an unrecognized backend value fails loud instead of silently coercing to file-system`). Everything
else reviewed clean: the indentation-aware `parseLayoutYaml()` parser was traced by hand against
nested `root_page` blocks and section-boundary transitions (confirmed it correctly pops nested
scopes on dedent, unlike the pre-31.2 scan-to-EOF regex it replaces); the two serialize* functions
enumerate an explicit field allowlist (never a generic property spread), which is what makes AC6's
"no credential-shaped field can be written" true by construction rather than by convention.

`bin/cli.js` loads cleanly (`node -e "require('./bin/cli.js')"`).

No skill files under `lib/bmad-extension/skills/` were touched, so `npm run build:plugin` /
Bundle Drift Guard are not implicated.

**Side-effect note:** running several of the CLI-integration test files (e.g. `reconfigure.test.js`,
`generate-project-context.test.js`) from the worktree root regenerated `.agents/`, `AGENTS.md`, a
timestamped `AGENTS.md.backup-*`, `.ma-agents.json`, and a stray `_bmad-output/project-layout.yaml`
at the worktree root — the known "`npm test` / running the suite regenerates `.agents/`" hazard.
All of these were reverted/cleaned (`git checkout` on tracked files, `git clean` on the untracked
`.agents/` additions) before committing; none of it is part of this story's diff.

## Decisions Made (summary)

1. `resolveProjectTopology()`'s `config.yaml` isolation vs. `readExistingLayout()`'s retained
   fallback — two consumers, not a contradiction (see Dev Notes).
2. Legacy-collapse target = software requirements store, matching FR264's own choice.
3. `writeProjectLayoutYaml()` keeps its existing `{knowledgebase, sprintManagement}` input shape;
   both new stores are populated from it until 31.5.
4. Install-scope gate (`installScope === 'project'`) at the `writeProjectLayoutYaml` call site is
   untouched — out of scope (thread D, Story 31.11/31.12).

## Out-of-Scope Confirmation

- No local mirror/cache/sync of any Confluence-backed store — not built, not needed for this story.
- No `_bmad/bmm/config.yaml` generation, generation stamp, or new config fields
  (`system_requirements_path`/`software_requirements_path`) — that is Story 31.3; `config.yaml`
  writing (`writeRepoLayoutConfig`) is untouched.
- No staleness fail-loud guard — Story 31.4.
- No two-question wizard / per-store backend selection UI — Story 31.5. The single-question wizard
  (`collectRepoLayout`) is untouched; only the writer/reader/schema changed underneath it.
- No Confluence backend prompts (space/root-page collection) — Story 31.8. The schema is reserved
  and the writer/reader support the shape, but nothing in this story's code path can produce a
  `confluence` store.
- Bug B3 (root `skills/` directory) — not touched, per the parked handoff.

## Unresolved Findings

None that block this story. One latent, pre-existing, genuinely out-of-scope bug noted for future
filing (not fixed here, per instruction not to chase unrelated defects): `uninstallSkill()` is
called with the string literal `'project'` (not `installScope`) at several sites in the update path
(`bin/cli.js`, originally cited as 1668/1680; now several call sites including ~1396/1428/1438/
1850/1862 after this story's insertions) — a global-scope *update* would still uninstall against
`'project'` semantics. Independent of Epic 31 and this story; flagged for a separate bug ticket.

## Definition of Done

- [x] AC1 — exactly three records, no fourth store, no `implementation_artifacts` — test pins it.
- [x] AC2 — unconditional write (repo-layout dimension); `bothSame` skip removed.
- [x] AC3 — delete branch removed; `fs.unlinkSync` spy test + persistence test both pin it.
- [x] AC4 — resolver reads `project-layout.yaml` only; test proves `config.yaml` changes don't
      affect it; `project-layout.yaml` is never derived from `config.yaml` (no such code path exists).
- [x] AC5 — legacy FR122 shape and legacy `knowledgebase_path`-only config both resolve as both
      stores, no error, no rewrite — tested both ways.
- [x] AC6 — confluence store test proves credential-shaped fields/values never reach the file.
- [x] AC7 — determinism test (schema v2) extends the existing idempotency coverage.
- [x] AC8 — `resolveProjectTopology` succeeds with `_bmad/` completely absent — tested.
- [x] AC9 — covered by the existing `ensureBmadOutputTracked()` suite (Story 10.1) plus a new
      direct check that the writer never touches `.gitignore`.
- [x] AC10 — all targeted test files green except one pre-existing, baseline-confirmed failure
      unrelated to this change.
- [x] Self-review complete — ran the `code-review` skill against the diff, found and fixed one
      real issue (unvalidated backend value silently coerced to file-system; see Test Evidence),
      pinned with a new regression test. No PR opened, no push, no merge — orchestrator serializes
      integration per the task's hard boundaries.
- [x] `sprint-status.yaml` updated (status only, comment preserved).
- [ ] Independent human/reviewer sign-off before this story is folded into `feature/epic-31` — this
      agent's self-review is not a substitute for that gate.

## File List

- `bin/cli.js` — schema/writer/reader/resolver rewrite (`writeProjectLayoutYaml`,
  `readExistingLayout`, new `resolveProjectTopology`, `parseLayoutYaml`, `storeFromRaw`,
  `sprintFromRaw`, `serializeFileSystemStore`, `serializeConfluenceStore`, `serializeStore`,
  `serializeSprintManagement`, `PROJECT_LAYOUT_SCHEMA_VERSION`); exports extended.
- `test/config-storage.test.js` — 2 tests rewritten (AC2/AC3), 1 updated (new section names).
- `test/project-layout-binding-spine.test.js` (new) — 12 tests, AC1/AC4/AC5/AC6/AC7/AC8/AC9.
- `package.json` — registered the new test file in the `test` script.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated.

## Change Log

| Date | Change |
|------|--------|
| 2026-08-03 | Story implemented in worktree `feature/epic-31-story-31.2`. |
