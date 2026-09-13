---
type: bug
severity: medium
title: two personas author an on_prem_phase_prefix that reaches nothing — PERSONA_SKILL_MAP routes bmm-qa and bmm-sm to upstream skills ma-agents itself retires and deletes
---

# Bug: an authored on-prem prefix with nowhere to land

**Status:** backlog
**Severity:** medium (a deliberately authored behaviour is silently absent on every
on-prem install; no crash, no warning, no test)
**Affected Component:** `lib/bmad.js:1267-1276` (`PERSONA_SKILL_MAP`);
`lib/bmad-customize/bmm-qa.customize.yaml`; `lib/bmad-customize/bmm-sm.customize.yaml`;
`lib/installer.js:2224-2229` (`RETIRED_SKILL_IDS`)
**Classification:** DECISION FIRST, then CODE FIX. Two readings — see below.

## The defect

`PERSONA_SKILL_MAP` has **eight** entries. Two of them name skills that
bmad-method no longer ships and that **ma-agents itself actively deletes**:

| map entry | target skill dir | status |
| --- | --- | --- |
| `bmm-sm` | `bmad-agent-sm` | retired upstream (PR #2179, merged into Amelia); in `RETIRED_SKILL_IDS` |
| `bmm-qa` | `bmad-agent-qa` | retired upstream (PR #2186, merged into Amelia); in `RETIRED_SKILL_IDS` |

`migrateRetiredSkills` (`lib/installer.js:2192-2243`) sweeps both IDs out of every
agent's skill root on every install. So the on-prem phase-prefix pass
(`applyOnPremPhasePrefixToDeployedSkills`) looks for
`<tree>/bmad-agent-qa/SKILL.md`, finds nothing, and silently skips — exactly the
"do not invent files the deployer didn't emit" branch.

Both personas nevertheless **author** an `on_prem_phase_prefix`:

- `lib/bmad-customize/bmm-qa.customize.yaml:3` — and its own menu trigger
  (`:19`) reads `skill:ma-agent-sqa`, its persona is named **Gadi**. This file
  describes the **`ma-agent-sqa`** persona, which ma-agents ships and deploys.
- `lib/bmad-customize/bmm-sm.customize.yaml:3` — a skill-enforcement stub for the
  retired upstream SM agent. There is no `ma-agent-sm`.

So an authored prefix is routed to a directory nothing writes.

The second consumer is dead too. `applyOnPremPhasePrefix` (`lib/bmad.js:1182`)
injects the same prefix into deployed `.customize.yaml` files under
`_bmad/_config/agents/` — but Story 22.6 retired that deployment path, and the
directory does not exist in a current install (verified below). Neither route
reaches the file.

## Measured, read-only, in `D:\Code\Workshop` (profile `on-prem`, BMAD 6.10.0)

```
tree              skills  on-prem markers
.claude/skills      166        6
.agents/skills      166        6
.cline/skills       166        6
.agent/skills       166        0   <- the separate antigravity-path bug

ma-agent-sqa      present in ALL FOUR trees, 0 markers in all four
bmad-agent-qa     absent from all four trees
bmad-agent-sm     absent from all four trees
_bmad/_config/agents/   does not exist (only bmad-help.csv, files-manifest.csv,
                        manifest.yaml, skill-manifest.csv live under _bmad/_config/)
```

The six marked skills are exactly the six map entries that DO deploy:
`bmad-agent-{analyst,architect,dev,pm,tech-writer,ux-designer}`.

**Eight map entries, six that ever deploy.** Confirmed.

## Two readings — decide before coding

1. **The mapping is wrong.** `bmm-qa` should map to **`ma-agent-sqa`**, the
   persona the file actually describes (Gadi, same role, same trigger). Fixing it
   makes the authored prefix land in every deployed tree.
   Consequences: the on-prem planning-phase prefix starts being injected into a
   shipped persona on every on-prem install where it never was before — a real
   behaviour change; injection counts move (f1a asserts them as
   `trees x personas`, so the assertions follow automatically, but the change
   must be deliberate); and the question immediately generalises — `ma-agent-cyber`,
   `ma-agent-devops` and `ma-agent-sre` have no customize source at all, so
   should they get one too? `bmm-sm` has no deployed counterpart under either
   reading and would simply be dropped.

2. **The prefix should not be authored.** Both files are for retired upstream
   agents; delete the `on_prem_phase_prefix` (and the map entries) and the
   product behaviour is unchanged from today's. Honest, zero-risk, and loses
   whatever the author of `bmm-qa.customize.yaml` intended for Gadi.

Reading 1 is the better fit for the evidence (the file plainly describes
`ma-agent-sqa`); reading 2 is the safer fit for a release. **This is a product
decision, not a guess** — the same posture as
`bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created`.

## Acceptance criteria for whichever story adopts this

1. `PERSONA_SKILL_MAP` contains no entry that `RETIRED_SKILL_IDS` deletes — a
   test asserts the two sets are disjoint, so the next retirement surfaces at
   build time rather than as a silent skip.
2. Every persona that authors an `on_prem_phase_prefix` has a deployed target,
   and every deployed target that should carry the prefix does — proven by count
   per tree, not by spot check.
3. If reading 1 is taken: the injection count moves deliberately and the move is
   stated in the commit, with `test/f1a-on-prem-prefix-post-install.test.js`
   re-derived rather than relaxed.

## Provenance

- Found during the independent review of `bug-antigravity-path-divergence`
  (finding N2) and confirmed read-only against `D:\Code\Workshop` by the fix
  round on branch `fix/antigravity-path-divergence`.
- **Pre-existing and independent.** It is not caused by the antigravity path
  divergence, by Epic 31, or by the 3.18.0 beta: the map entry has been wrong
  since the retirements landed, and the divergence fix neither created nor
  touched it. Deliberately NOT folded into that fix — it changes shipped
  behaviour for a persona, which needs its own decision and its own evidence.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
