---
title: 'Antigravity path divergence — one skill tree, and no tree the patcher cannot see'
type: 'bugfix'
created: '2026-09-12'
status: 'in-review'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md'
---

## Intent

**Problem:** ma-agents' registry maps Antigravity to `.antigravity/skills` while upstream
bmad-method maps the same tool to `.agent/skills`. One install therefore writes a skill
tree that ma-agents' post-install patchers do not know about, so the on-prem phase prefix
is present in `.claude/skills`, `.agents/skills` and `.cline/skills` (6 personas each) and
absent from `.agent/skills` (0) in a project whose profile is `on-prem`. Every future
deployed-skill patch inherits the same blind spot.

**Approach:** Two independent changes. (1) `applyOnPremPhasePrefixToDeployedSkills` derives
its target set from the deployed skill trees actually present on disk instead of from the
hard-coded `TOOL_SKILL_DIRS` registry list, so an unknown tree can no longer be missed.
(2) Reconcile the two path tables: align Antigravity's `skillsDir` to upstream's authoritative
`.agent/skills`, declare the three remaining divergences explicitly with reasons, and add a
parity test that enumerates every tool in both tables and fails on any *unrecorded* divergence.

## Boundaries & Constraints

**Always:** Upstream `platform-codes.yaml` is the authority on which directory a tool reads.
Existing installs must migrate non-destructively through the established
`OBSOLETE_TOOL_SKILL_DIRS` mechanism. Discovery must only ever consider dot-prefixed tool
containers, so a source checkout's own `lib/bmad-extension/skills/` can never be patched.

**Ask First:** Any change to a tool's path other than `antigravity`.

**Never:** Do not realign `gemini`, `cursor` or `opencode` — their divergence is real but
benign (upstream writes them to `.agents/skills`, a tree ma-agents already patches and
already reconciles per bug 27.16); realigning them is a behaviour change for three tools on
the strength of one tool's evidence. Do not touch `getGlobalPath` — ma-agents' global paths
are a different convention from upstream's for *every* tool including `claude-code`, so they
are not part of this reconciliation. Do not modify `D:\Code\Workshop`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Unknown tree on disk | `.agent/skills/bmad-agent-pm/SKILL.md` exists, profile `on-prem` | tree discovered and patched | n/a |
| Known tree, no personas | `.claude/skills` exists but empty | not a target; no writes, no dir created | n/a |
| Non-dot container | `lib/bmad-extension/skills/bmad-agent-pm/SKILL.md` | NOT a target (source tree protection) | n/a |
| Nested container | `.github/copilot/skills/bmad-agent-pm/SKILL.md` | discovered (depth-2 scan) | n/a |
| Unreadable project root | `readdir` throws | seed list still used; no crash | caught, empty list |
| Legacy install | `.antigravity/skills` present, `.agent/skills` populated | legacy dir removed by obsolete-dir sweep | preserved + warned if replacement empty |
| Unrecorded divergence | a `skillsDir` differs from `target_dir` with no declaration | parity test fails | n/a |
| Stale declaration | declared divergence whose paths no longer match reality | parity test fails | n/a |

## Code Map

- `lib/agents.js` — the ma-agents path table (`skillsDir`); `antigravity` entry at :240-264.
- `node_modules/bmad-method/tools/installer/ide/platform-codes.yaml` — upstream path table (`target_dir`); `antigravity` at :31-36.
- `lib/bmad.js:1285` — `TOOL_SKILL_DIRS`, the hard-coded patch-target list (the defect).
- `lib/bmad.js:1386-1466` — `applyOnPremPhasePrefixToDeployedSkills`, the patcher.
- `lib/installer.js:2255-2265` — `OBSOLETE_TOOL_SKILL_DIRS`, the established migration registry.
- `lib/installer.js:1803-1905` — bug 27.16 `.agents/skills` reconciliation (closest precedent).
- `test/routing-parity.test.js` — already loads both tables; natural home for the parity test.
- `test/f1a-on-prem-prefix-post-install.test.js` — the patcher's contract tests.

## Tasks & Acceptance

**Execution:**
- [x] `lib/agents.js` -- add `PLATFORM_PATH_DIVERGENCES` (declared, reasoned divergences) and align `antigravity.skillsDir`/`getProjectPath` to `.agent/skills` -- upstream is the authority on tool compatibility; same precedent as the 6.5.0 copilot/roo/kilo realignment.
- [x] `lib/installer.js` -- add `.antigravity/skills` -> `.agent/skills` to `OBSOLETE_TOOL_SKILL_DIRS` -- existing installs migrate non-destructively.
- [x] `lib/bmad.js` -- add `discoverDeployedSkillTrees()` and make the on-prem patcher iterate it instead of `TOOL_SKILL_DIRS` -- removes the blind spot for every current and future tree.
- [x] `test/routing-parity.test.js` -- enumerate both tables for every registered tool; fail on unrecorded or stale divergence.
- [x] `test/f1a-on-prem-prefix-post-install.test.js` -- prove by count + digest that an undeclared tree is patched, and that the source tree is not.

**Acceptance Criteria:**
- Given a project with a deployed skill tree ma-agents' registry does not name, when the on-prem pass runs, then every persona in that tree carries the prefix and its digest equals the digest of the same persona in a known tree.
- Given a tool whose `skillsDir` differs from its upstream `target_dir` with no declared divergence, when the parity test runs, then it fails naming the tool and both paths.
- Given Antigravity is selected, when an install completes, then exactly one skill tree exists for it.
- Given the patch-target derivation is mutated back to the registry list, when the tests run, then they go red.

## Design Notes

Discovery is deliberately narrow: a deployed tool skill tree is `<dot-dir>[/<sub>]/skills`
containing at least one `PERSONA_SKILL_MAP` directory with a `SKILL.md`. Every `target_dir`
in upstream's table is dot-prefixed, so this covers the whole upstream surface while keeping
non-dot source directories (notably this repo's own `lib/bmad-extension/skills/`) out of
reach. `TOOL_SKILL_DIRS` is retained as a seed so a registry entry outside the dot-dir
convention is still honoured.

## Verification

**Commands:**
- `node test/routing-parity.test.js` -- expected: exit 0, new parity tests pass
- `node test/f1a-on-prem-prefix-post-install.test.js` -- expected: exit 0
- `node test/customizations-translation.test.js` -- expected: exit 0 (section 11)
- `node test/obsolete-tool-dirs.test.js` / `agents.test.js` / `installer.test.js` / `bmad.test.js` -- expected: exit 0
- `node test/release-gate-epic-31.test.js` -- expected: 43/0 (pinned invariants unmoved)

## Mutation Record — CORRECTED

The implementation round's own mutation figures were wrong. They are corrected
here against measurement; the wrong figures are shown so the correction is
auditable rather than quietly overwritten.

| mutant | claimed | ACTUAL (reviewed commit `082e6f4`) | ACTUAL (head `d140bd9`) |
|---|---|---|---|
| M1 — on-prem patcher back to `TOOL_SKILL_DIRS` | f1a 18/3 | f1a **19/2** | f1a **19/2** |
| M2 — `antigravity.skillsDir` back to `.antigravity/skills` | routing-parity 11/3 | routing-parity **11/4** | routing-parity **12/4** |
| M3 — `getProjectPath` back to `.antigravity`, `skillsDir` left aligned | routing-parity 14/1 | routing-parity 14/1 (correct as recorded) | — |

`11/3` was not merely wrong, it was arithmetically impossible: the suite had 15
tests and 11+3=14. The head figures differ only because the suite grew from 15 to
16 tests in the fix round; the failure counts are identical.

**Blob hashes.** The claimed post-revert `lib/bmad.js b672648a` matches nothing.
Measured at the reviewed commit: **`d7b3c9b1`** (working tree) / `5894ca4e`
(index). The two differ because this repo's working tree is CRLF and the index is
LF — any blob claim must say which it is. `lib/agents.js 858d4529` was correct.
After the fix round (commit `81e4087`): `lib/bmad.js` working tree `b55801e5` /
index `23968dc0`; `lib/agents.js` `858d4529` in both — unchanged by the fix
round, which touched no path table.

## Review Fix Round (2026-09-13) — findings closed

Verdict on the implementation was APPROVE-WITH-NITS, nothing blocking. Closed:

- **N1 — the discovery half was structurally untestable.** Mutant MX2 deletes the
  `getDeployedSkillsRoots` discovery union and every suite stayed green, because
  the only suite referencing it builds its fixture from `IDE_SKILL_DIRS` — from
  the registry — so it can never contain a tree the registry does not name.
  `test/customizations-translation.test.js` section 11 uses `.futuretool/skills`,
  asserted absent from both path tables. MX2 replanted: 23/0 -> 21/2, exit 1.
- **N7 — the auditor's reason rule was a pure length floor.** Now three
  mechanically checkable properties (length, >=8 distinct word tokens, must name
  one of the two paths it excuses), with what it does NOT claim documented in
  place. MX1 (a shipped reason replaced by 40 literal `x`s) went from SURVIVED to
  routing-parity 14/2.
- **N8 — 5.5 covered three of six branches, not "each".** Adds orphan key,
  no-such-platform, short reason, the MX1 filler, a reason naming neither path,
  and a check that every SHIPPED declaration clears the strengthened rule.
- **N5** — `SKILL.md` as a directory no longer marks a tree as deployed
  (`statSync().isFile()`). **N6** — win32 case collisions (`.Claude` vs
  `.claude`) are deduplicated case-insensitively; the registry spelling wins.
  Both now have tests; MX3 and MX4 each take customizations-translation to 22/1.
- **The unnamed gap** — nothing asserted the dot-prefix invariant the scan's
  confinement rests on, and the audit only compares the 9 tools we register while
  35 upstream platforms are not. New 5.6 asserts it over all 44 upstream
  `target_dir`s (all are exactly `<dot-container>/skills`) and carries its own
  mutation control.
- **N2 — an authored on-prem prefix that reaches nothing** was filed as its own
  bug rather than fixed here: pre-existing, independent of this divergence, and
  choosing between its two readings changes shipped behaviour for a deployed
  persona. See
  `bug-on-prem-phase-prefix-is-authored-for-two-personas-that-are-never-deployed.md`.
  **No injection count moved** — `PERSONA_SKILL_MAP` is unchanged and f1a stays
  21/0. Confirmed: the map has EIGHT entries and SIX ever deploy.

## Recorded, not implemented

- **The fix is broader than advertised, in its favour.** Base `TOOL_SKILL_DIRS`
  held only three entries (`.claude`, `.agents`, `.cline`), so `.gemini/skills`,
  `.cursor/skills` and `.opencode/skills` — ma-agents' OWN trees, written by our
  own standalone loop — were unpatched too. The blind spot was four trees wide in
  the seed dimension, not one. Test 5.4 closes it with set equality. The
  "three remaining divergences are benign" framing is right about their second
  tree (`.agents/skills`, already patched) and silent about their first.
- **Residual risk on the realignment — FOR THE HUMAN TO DECIDE.** If upstream is
  wrong about `.agent/`, this regresses a working user to broken, because
  `migrateObsoleteToolDirs` DELETES the legacy tree rather than moving it: a
  planted `USER-EDIT.md` in `.antigravity/skills` is destroyed. That is
  pre-existing semantics for all four prior `OBSOLETE_TOOL_SKILL_DIRS` entries,
  not new here. Mitigation option on the table: land the realignment now and
  defer the `OBSOLETE_TOOL_SKILL_DIRS` entry one release, leaving a rollback
  window. **Not decided by the fix round.**
- **N9** — `migrateObsoleteToolDirs` runs once per `installSkill()` call, on the
  first path-group iteration (`lib/installer.js:2150`, guarded by
  `projectContextHandled`). If antigravity's group is not first, `.agent/skills`
  may still be empty when the sweep runs, and the preserve-on-empty rule then
  keeps `.antigravity/skills` — so migration can take two install runs. Its
  "has content" test also accepts a stray `.DS_Store`.
- **N10** — two walkers still derive their target set from the REGISTRY, which is
  the blind-spot class this fix converted the on-prem patcher away from:
  `migrateRetiredSkills` (`lib/installer.js:2289`, over `getProjectPath()`) and
  the bug-27.16 `.agents/skills` reconciliation (`lib/installer.js:1824`, keyed
  on the literal `.agents`). Neither can see a tree the registry does not name.
  Not converted here — out of the declared scope, and each needs its own
  evidence.
- **Known limit, already recorded in code:** the level-1 scan uses
  `Dirent.isDirectory()`, false for a symlink, so a SYMLINKED unregistered tool
  container is not discovered. Registered ones still are, via the seed pass.
