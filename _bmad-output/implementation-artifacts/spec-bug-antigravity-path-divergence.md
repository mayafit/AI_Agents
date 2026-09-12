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
- `node test/obsolete-tool-dirs.test.js` / `agents.test.js` / `installer.test.js` / `bmad.test.js` -- expected: exit 0
- `node test/release-gate-epic-31.test.js` -- expected: 43/0 (pinned invariants unmoved)
