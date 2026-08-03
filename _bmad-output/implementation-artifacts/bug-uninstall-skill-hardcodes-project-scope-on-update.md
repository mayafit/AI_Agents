---
type: bug
severity: medium
title: The update path hardcodes 'project' scope when uninstalling deselected skills — a global install's update removes skills from the project-scoped location instead of the global one, orphaning the global copies
---

# Bug: `uninstallSkill` hardcodes `'project'` scope on the update path

**Status:** OPEN — needs triage
**Severity:** medium
**Affected Component:** `bin/cli.js` update path (`uninstallSkill` call sites at `:1668` and `:1680`)
**Classification:** CODE FIX (ma-agents-owned; no requirements change)

## Provenance

Found by the **Story 31.1** FR250 spike (Epic 31) while sweeping `bin/cli.js` for every encoding of
the project-scope assumption, and confirmed independently by that story's adversarial review, which
widened the finding from two sites to five. Filed here rather than fixed because it is **outside
Epic 31's scope** — it is a pre-existing global-*update* defect with no F26 requirement behind it,
and Epic 31 stories 31.1/31.2 are a spike and a binding-schema change respectively.

**Do not fold this into Story 31.11 or 31.12 silently.** Story 31.11 owns "a global install does no
project-scoped work" and should be *handed* this finding, but fixing a latent update-path bug is a
separable concern with its own regression risk.

## Summary

`bin/cli.js` resolves install scope into a variable `installScope` (declared `:1202`, assigned in
the wizard at `:1428`) and threads it correctly through most consumers. Two call sites on the
**update path** ignore it and pass the string literal `'project'` instead:

```js
// bin/cli.js:1668 — skills deselected from the skill list
await uninstallSkill(skillId, originalAgents, installPath, 'project');

// bin/cli.js:1680 — skills belonging to deselected agents
await uninstallSkill(skillId, agentsToRemoveFrom, installPath, 'project');
```

`uninstallSkill`'s signature is
`async function uninstallSkill(skillId, agentIds, customPath = '', scope = 'project')`
(`lib/installer.js:2088`) — the fourth parameter is a real behavioural switch selecting where the
skill is removed from, so passing a literal defeats it.

**Consequence:** when a user who installed globally re-runs the installer and deselects a skill or an
agent, the uninstall is attempted against the **project-scoped** location. The global copy is never
removed, and the deselection silently does nothing to the installation that actually exists.

## Reproduction Steps

Not yet reproduced end-to-end — filed from source analysis. The reproduction shape is:

1. Install ma-agents at **Global (user-level settings)** scope with two or more skills selected.
2. Re-run the installer (the update path — `isUpdate` true) at the same global scope.
3. Deselect one skill, or deselect an agent that owns skills.
4. **Expected:** the deselected skill is removed from the global install location.
5. **Actual (predicted):** the removal targets the project-scoped location; the global copy survives
   and remains active.

**Confirming this reproduction is the first task of any fix** — see AC1 below. It is possible the
practical impact is masked (e.g. if the update path is unreachable under global scope for another
reason), in which case this downgrades to a latent-correctness cleanup. That question is exactly what
triage needs to answer.

## Expected Behavior

Both call sites pass the live `installScope`, so an update removes skills from the same location the
install put them:

```js
await uninstallSkill(skillId, originalAgents, installPath, installScope);
```

## Actual Behavior

The literal `'project'` is passed regardless of the scope the user chose, at both sites.

## The wider finding — ten sites encode the project-scope assumption

Recorded so a fix is scoped deliberately rather than by grep. Story 31.1's spike plus its review
swept `bin/cli.js` exhaustively.

**Five `installScope` behaviour gates — all correct, and confirmed complete (no sixth gate):**

| Line | Site | Assessment |
|---|---|---|
| 1441 | Global BMAD agent filter | correct |
| 1455 | `if (installScope === 'project')` — the whole BMAD-METHOD integration block | correct |
| 1616 | `writeRepoLayoutConfig` + `writeProjectLayoutYaml` | correct — this gate **implements FR251** and must be kept |
| 1759 | `reconcileAgentsSharedSkills` | correct |
| 1768 | `project-context.md` repo-layout update | correct |

**Five hardcoded `'project'` literals:**

| Line | Site | Assessment |
|---|---|---|
| 1214 | Step-0 pre-wizard `getStatus([], '', 'project')` | **defensible** — runs before scope is chosen |
| 1246 | Step-0 pre-wizard cleanup `uninstallSkill(…, 'project')` | **defensible** — same |
| 1256 | Step-0 pre-wizard cleanup `uninstallSkill(…, 'project')` | **defensible** — same |
| **1668** | update path, deselected skills | **THIS BUG** — runs after scope is known |
| **1680** | update path, deselected agents | **THIS BUG** — same |

The three Step-0 sites are a separate, weaker question: they run *before* the scope question is
asked, so `'project'` is a defensible default there. They are worth a deliberate decision (a global
user re-running the installer arguably wants Step-0 detection to look at the global location too) but
they are **not** this bug and should not be changed as a drive-by.

## Root Cause

Scope was introduced as a threaded parameter rather than as ambient state, and the update path was
written (or last touched) when only project scope existed in practice — global scope having always
dropped BMAD and been a partial mode. Nothing enforces that a `scope`-typed parameter receives the
live value: the default `= 'project'` on `uninstallSkill` makes an omitted or hardcoded argument
indistinguishable from a correct one at the call site.

## Blast Radius

- **Global-scope users only, and only on the update path with a deselection.** A fresh global install
  is unaffected; a project-scope install is unaffected.
- No data loss and no crash — the failure is a **silent no-op**: the user deselects a skill, the
  installer reports success, and the skill is still there.
- Small, local fix. The risk is almost entirely in *proving* the behaviour change, not in making it.

## Affected Files

- `bin/cli.js:1668`, `bin/cli.js:1680` — the two hardcoded literals (the bug)
- `bin/cli.js:1202` (`let installScope = cliScope || 'project'`), `:1428` (wizard assignment) — the
  value that should be passed
- `lib/installer.js:2088` — `uninstallSkill(skillId, agentIds, customPath = '', scope = 'project')`,
  the signature whose default masks the defect
- `bin/cli.js:1214`, `:1246`, `:1256` — the three defensible Step-0 literals, **in scope for a
  decision, not for a change**

## Acceptance Criteria

1. The global-scope update-with-deselection path is **reproduced first** and the actual behaviour
   recorded, before any fix — confirming this is a live defect rather than an unreachable one.
2. `bin/cli.js:1668` and `:1680` pass the live `installScope`.
3. A regression test proves a **global** install + update + deselection removes the skill from the
   global location.
4. A regression test proves the **project**-scope path is unchanged (the current behaviour is correct
   there and must not regress — this is the whole reason the bug went unnoticed).
5. The three Step-0 literals (`:1214`, `:1246`, `:1256`) are either changed deliberately with their
   own tests, or **explicitly documented as intentionally project-scoped** with a code comment saying
   why. Silence is not an acceptable outcome for them.
6. Consider making the defect class unrepresentable — e.g. dropping the `= 'project'` default on
   `uninstallSkill` so an omitted scope is a hard error rather than a silent project-scope
   assumption. Weigh against the churn at every existing call site.
7. Targeted test files run directly with `node --test`; any failure baselined against `main` before
   being called a regression. (Bare `npm test` is unreliable on Windows — see
   `bug-npm-test-windows-suite-health-chain.md`.)

## PRD Amendment Needed

**No.** No FR or NFR specifies update-path uninstall scoping. FR251 governs what a global *install*
must not do (project-scoped work) and is already correctly implemented by the `:1616` gate; this bug
is about the *update* path removing from the wrong place, which no requirement addresses. NFR78
covers bind idempotency, not skill uninstallation.

If triage finds the Step-0 question (should pre-wizard detection be scope-aware?) has a user-visible
answer, **that** part may warrant a requirement — it changes what the installer reports it found.
That call goes to the PM, not into an implementation story.

## Notes

- Filed from the Story 31.1 spike (Epic 31, wave 1) — a bug REPORT, not a fix. No source was touched.
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
