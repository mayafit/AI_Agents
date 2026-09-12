---
type: bug
severity: high
title: ma-agents and bmad-method disagree on Antigravity's skills directory, so a project gets TWO skill trees — and the one ma-agents does not know about silently misses the on-prem phase prefix
---

# Bug: two Antigravity skill trees, and the second one is not patched

**Status:** review
**Severity:** high (a shipped behaviour — the on-prem phase prefix — is silently absent from a tree agents actually read)
**Affected Component:** `lib/agents.js:245` (`skillsDir: '.antigravity/skills'`); upstream `node_modules/bmad-method/tools/installer/ide/platform-codes.yaml:35` (`target_dir: .agent/skills`); `lib/bmad.js:1386-1466` (`applyOnPremPhasePrefixToDeployedSkills`)
**Classification:** CODE FIX. Same shape as bug 27.16, one directory over.

## The defect

ma-agents and bmad-method map **the same tool** to **two different directories**:

| source | tool | directory |
| --- | --- | --- |
| `lib/agents.js:245` | Antigravity | `.antigravity/skills` |
| `platform-codes.yaml:31-36` | Google Antigravity | `.agent/skills` |

Because ma-agents delegates part of the install to bmad-method's installer, a single run writes **both** conventions. Reproduced in `D:\Code\Workshop` (installed 2026-09-10, BMAD 6.10.0, `manifestVersion 1.2.0`, profile `on-prem`):

```
.agent/skills    166 skills   created 05:21:39
.agents/skills   166 skills   created 05:21:29
.antigravity/    ABSENT
```

Ten seconds apart, same run. **`.antigravity/` — the directory ma-agents' own registry names — does not exist**, so ma-agents never installed Antigravity at all; BMAD wrote `.agent/skills` on its own path convention.

## Why this is more than duplication

`applyOnPremPhasePrefixToDeployedSkills()` (`lib/bmad.js:1451`) injects a marker-delimited on-prem block into the persona skills after deployment. It walks the directories **ma-agents knows about**. `.agent/skills` is not one of them.

Measured across the 166 skills in each tree:

```
identical : 160
differing :   6

on-prem phase prefix present:
  .agents/skills   6 files
  .agent/skills    0 files
```

The six are exactly `PERSONA_SKILL_MAP`: `bmad-agent-analyst`, `bmad-agent-architect`, `bmad-agent-dev`, `bmad-agent-pm`, `bmad-agent-tech-writer`, `bmad-agent-ux-designer`. The whole diff is the missing block:

```
> <!-- BEGIN:ma-on-prem-phase-prefix -->
> ## On-Prem Phase Prefix
>
> /no_think You are in a planning phase — respond in text for questions; create files only when explicitly asked.
> <!-- END:ma-on-prem-phase-prefix -->
```

**This project's profile is `on-prem`.** An agent reading `.agent/skills/bmad-agent-pm/SKILL.md` gets different instructions from one reading `.agents/skills/bmad-agent-pm/SKILL.md` — the on-prem planning-phase constraint is simply absent. The divergence is invisible: both trees look complete, both have 166 skills, and nothing reports the difference.

## Blast radius

- **Any project installed with a tool whose upstream `target_dir` differs from our registry** — Antigravity is the confirmed case; the two lists should be diffed in full.
- **It grows.** Every future patch ma-agents applies to deployed skills (this epic's Story 31.4 preflight and Story 31.9 routing gate are the same shape) lands on the directories ma-agents enumerates and misses the rest.
- **Neither directory is gitignored** in the Workshop project, so both are committable and a reviewer sees two trees with no explanation.

## Suggested resolution

Not a rename — deciding which path "wins" is a compatibility question, and Antigravity may genuinely read `.agent/skills`. Two parts:

1. **Derive the patch target set from what is on disk, not from our registry.** `applyOnPremPhasePrefixToDeployedSkills` should patch every deployed skill tree it finds, or ma-agents should reconcile `.agent/skills` the way bug 27.16 reconciles `.agents/skills`.
2. **Reconcile the two path tables.** Diff `lib/agents.js`'s `skillsDir` values against `platform-codes.yaml`'s `target_dir` values for every tool, and either align them or record each divergence deliberately with its reason.

## Acceptance criteria for whichever story adopts this

1. A test enumerates every tool in both tables and fails on an unrecorded path divergence — so the next one surfaces at build time, not in a user's project.
2. After an install with profile `on-prem`, **every** deployed persona skill carries the phase prefix, in every tree that was created, proven by count and by digest rather than by spot check.
3. A project installed with Antigravity selected has exactly one skill tree for that tool, or two that are proven byte-identical.
4. Mutate the patch-target derivation and show the test go red — the current defect is precisely that a tree can be missed with nothing failing.

## Provenance

- Found by a user inspecting `D:\Code\Workshop` and asking why two similar directories existed.
- Every figure above was measured in that project: the 166/166 counts, the 160/6 split, the 6/0 prefix counts, and the creation timestamps.
- The upstream path was read at `node_modules/bmad-method/tools/installer/ide/platform-codes.yaml:35`; ours at `lib/agents.js:245`.
- **Not caused by Epic 31** — the install predates the 3.18.0-beta.1 publish and none of Epic 31's stories touch the agent registry or the on-prem patcher.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
