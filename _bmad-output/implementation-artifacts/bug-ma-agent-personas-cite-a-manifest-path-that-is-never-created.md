---
type: bug
severity: high
title: The four ma-agent-* persona skills open with "Read the skills MANIFEST at _bmad/skills/MANIFEST.yaml" — that file, and the whole _bmad/skills/ directory, are never created by an install
---

# Bug: the persona skills' first instruction points at a path that does not exist

**Status:** backlog
**Severity:** high (the failing instruction is Critical Action #1 of four shipped personas, in every deployed tree)
**Affected Component:** `lib/agents.js:231`, `:306`, `:320`, `:334` (`skillsDir: '_bmad/skills/{sre,devops,cyber,sqa}'`); `lib/installer.js:795` (`generateSkillsManifest`); the four `ma-agent-*` SKILL.md documents
**Classification:** CODE FIX, or a text fix — see "Two readings" below. The decision is not obvious and should be made deliberately.

## The defect

Each of `ma-agent-cyber`, `ma-agent-devops`, `ma-agent-sqa` and `ma-agent-sre` opens with:

```
## Critical Actions
1. Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml
2. For each skill marked always_load: true, read the skill file completely
```

In `D:\Code\Workshop` (installed 2026-09-10, BMAD 6.10.0, profile `on-prem`):

```
_bmad/skills/MANIFEST.yaml   does not exist
_bmad/skills/               does not exist at all
MANIFEST.yaml               absent from EVERY tree (.agent, .agents, .claude, .cline)
```

So the persona's **first instruction fails**, and step 2 — "for each skill marked `always_load: true`" — can never run. Whatever `always_load` was meant to guarantee is silently not guaranteed.

Those four skills are deployed into all four trees (166 skills each), so this is **16 deployed copies** carrying a dead reference.

## Why the path is plausible but empty

The agent registry really does target `_bmad/skills/` for exactly these four:

```
lib/agents.js:231   skillsDir: '_bmad/skills/sre'
lib/agents.js:306   skillsDir: '_bmad/skills/devops'
lib/agents.js:320   skillsDir: '_bmad/skills/cyber'
lib/agents.js:334   skillsDir: '_bmad/skills/sqa'
```

`generateSkillsManifest(installPath)` (`lib/installer.js:795`) writes `MANIFEST.yaml` into whatever `installPath` it is handed, and is documented as **the only writer of that file** (`lib/installer.js:1806`). In this project it was never called with a path under `_bmad/skills/`, and that directory was never created — yet the four personas were still deployed into the per-tool trees, where the cited path is wrong for a second reason: it is absolute-from-project-root, not relative to the tree they live in.

## Two readings, and they lead to different fixes

1. **The install is incomplete.** `_bmad/skills/` should exist with a `MANIFEST.yaml`, and the personas' instruction is correct. Fix: make the install create it.
2. **The instruction is stale.** `_bmad/skills/` is a retired layout and the personas should cite the manifest in their own tree, or cite nothing. Fix: correct the four SKILL.md documents.

**Do not guess.** Reading 1 is a behaviour change to the installer; reading 2 edits four shipped skill documents, which moves any digest that pins them. Establish which was intended before writing either.

## Related, and probably the same root

`test/project-layout-artifact-routing.test.js`'s `BLOCKING-4` test — *"no shipped skill document cites a file this repository does not ship"* — currently fails on `skills/open-presentation/SKILL.md -> _bmad-output/methodology/BMAD_AI_Development_Training.pptx`. That is the same defect class: **a shipped instruction pointing at a path the consuming project does not have.** The guard exists and is red; it simply does not cover `_bmad/` paths, so these four slipped past it.

## Blast radius

- Four personas, 16 deployed copies, every project installed with this layout.
- **Silent.** Nothing fails, nothing warns; an agent asked to follow Critical Action 1 finds no file and improvises.
- `always_load: true` is the mechanism this instruction exists to honour — whatever depends on it is not happening.

## Acceptance criteria for whichever story adopts this

1. The intended reading is **stated and recorded** before any code or text changes.
2. `BLOCKING-4`'s guard is widened to cover `_bmad/` paths, so a shipped skill citing a non-existent project path fails at build time. It must be shown red against the current text before the fix, or the guard proves nothing.
3. After a fresh install, every path cited in a Critical Actions block resolves in the installed project — asserted over **all** shipped skills, not only these four.
4. If reading 1 is chosen: `_bmad/skills/MANIFEST.yaml` exists after install and lists the `always_load` skills, proven by reading the file rather than by asserting the call site was reached.
5. If reading 2 is chosen: the four documents are corrected and every digest that pins them is updated deliberately, with the move called out.

## Provenance

- Found while investigating a user's question about duplicate skill directories in `D:\Code\Workshop`.
- Measured in that project: `_bmad/skills/` absent, `MANIFEST.yaml` absent from all four trees, four skills citing it, all four deployed into every tree.
- Registry lines and the `generateSkillsManifest` contract were read at source in `lib/agents.js` and `lib/installer.js`.
- **Not caused by Epic 31.** The install predates the 3.18.0-beta.1 publish and no Epic 31 story touches these personas or the manifest generator.
- See also `bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md`, found in the same investigation.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
