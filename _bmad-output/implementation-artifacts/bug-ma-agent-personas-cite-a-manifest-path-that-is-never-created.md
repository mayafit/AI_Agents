---
type: bug
severity: high
title: ma-agent-sqa's Critical Action 1 cites _bmad/skills/MANIFEST.yaml, missing the sqa/ segment its three siblings carry; all four lack the "if it exists" guard
---

> ## CORRECTION NOTICE — 2026-09-12
>
> This report was filed from a `D:\Code\Workshop` install and **three of its central
> claims were wrong**. They are struck through in place below rather than deleted, per this
> repository's convention. Read the corrections before acting on anything here.
>
> | # | Original claim | Status |
> |---|---|---|
> | 1 | All four personas carry the bare path; "16 deployed copies carrying a dead reference" | **WRONG** — only `ma-agent-sqa` carries the bare path. 4 copies have a wrong path; 16 have an unguarded one. |
> | 2 | "`_bmad/skills/` does not exist at all" | **WRONG as written** — true of `D:\Code\Workshop`, false of this repository. |
> | 3 | "the cited path is wrong for a second reason: it is absolute-from-project-root" | **NOT A DEFECT** — this is Story 8.3's deliberate design. Demoted to an open design question. |
>
> **The investigation that produced these corrections also settled the "Two readings"
> question: the instruction was stale, not the installer.** Fixed on branch
> `fix/persona-manifest-path`. `lib/agents.js`, the installer and `generateSkillsManifest`
> were **not** changed — the installer was never the defect.
>
> The Workshop symptoms that prompted this report have a far larger root cause, filed
> separately as
> `bug-workshop-standalone-installskill-loop-never-ran.md`.

# Bug: the persona skills' first instruction points at a path that does not exist

**Status:** backlog
**Severity:** high (the failing instruction is Critical Action #1 of four shipped personas, in every deployed tree)
**Affected Component:** ~~`lib/agents.js:231`, `:306`, `:320`, `:334` (`skillsDir: '_bmad/skills/{sre,devops,cyber,sqa}'`); `lib/installer.js:795` (`generateSkillsManifest`); the four `ma-agent-*` SKILL.md documents~~ **CORRECTED:** the four `ma-agent-*` SKILL.md documents **only**. The `lib/agents.js` registry lines are *correct* and are the source of truth the text failed to match; `generateSkillsManifest` is not implicated.
**Classification:** ~~CODE FIX, or a text fix — see "Two readings" below. The decision is not obvious and should be made deliberately.~~ **RESOLVED: TEXT FIX.** See the Correction Notice.

## The defect

~~Each of `ma-agent-cyber`, `ma-agent-devops`, `ma-agent-sqa` and `ma-agent-sre` opens with:~~

~~```~~
~~## Critical Actions~~
~~1. Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml~~
~~2. For each skill marked always_load: true, read the skill file completely~~
~~```~~

**CORRECTION 1 — the headline quote was wrong for three of the four personas.**
Only `ma-agent-sqa` carried the bare path. The other three always cited their own slug,
and each matched its `lib/agents.js` `skillsDir` exactly:

| persona | Critical Action 1 as shipped | `lib/agents.js` | verdict |
| --- | --- | --- | --- |
| `ma-agent-sre` | `_bmad/skills/sre/MANIFEST.yaml` | `:231` | correct |
| `ma-agent-devops` | `_bmad/skills/devops/MANIFEST.yaml` | `:306` | correct |
| `ma-agent-cyber` | `_bmad/skills/cyber/MANIFEST.yaml` | `:320` | correct |
| **`ma-agent-sqa`** | **`_bmad/skills/MANIFEST.yaml`** | `:334` → `_bmad/skills/sqa` | **WRONG — missing `sqa/`** |

So the count is **not** "16 deployed copies carrying a dead reference". It is:

- **4 copies with a wrong path** — `ma-agent-sqa` in four trees.
- **16 copies with an *unguarded* path** — all four personas lost the original author's
  ` if it exists` guard, which is the defect that actually bites in an install where the
  `bmm-*` agent host was never selected.

**Provenance of the missing segment**, established from history:

- `1458029` (2026-04-08 02:06) — the original author wrote
  `_bmad/skills/sqa/MANIFEST.yaml **if it exists**`.
- `bffe2bd` (2026-04-08 12:55) — an adversarial review stripped the `sqa/` segment
  (*"Fix phantom MANIFEST path in Critical Actions (sqa/ → skills/)"*) **and** dropped the guard.
- `d9d795e` (2026-04-09 18:57) — the next day, registered `bmm-qa` with
  `skillsDir: '_bmad/skills/sqa'`, making `sqa/` correct again, and edited that same
  Critical Actions block **without restoring the segment.**

A layout migration that missed the text, by the same author, one day apart.

~~In `D:\Code\Workshop` (installed 2026-09-10, BMAD 6.10.0, profile `on-prem`):~~

~~```~~
~~_bmad/skills/MANIFEST.yaml   does not exist~~
~~_bmad/skills/               does not exist at all~~
~~MANIFEST.yaml               absent from EVERY tree (.agent, .agents, .claude, .cline)~~
~~```~~

**CORRECTION 2 — "`_bmad/skills/` does not exist at all" is false as written.**
It is true of `D:\Code\Workshop` and false of this repository. All four
`_bmad/skills/{cyber,devops,sqa,sre}/MANIFEST.yaml` **do exist** in the Epic 31 working tree
(`D:\Code\AI_Agents-epic-31`). The directory is gitignored (`.gitignore:20`, `_bmad/`), which
is why the original report did not see it — not because it is never created.

Precise scope of the claim, verified:

| tree | `_bmad/skills/<slug>/MANIFEST.yaml` |
| --- | --- |
| `D:\Code\AI_Agents-epic-31` | **present** — all four slugs |
| `D:\Code\AI_Agents` (main) | absent |
| `D:\Code\Workshop` | absent — and so is everything else the standalone installer writes |

So the persona's first instruction **does** resolve in a normal install where the `bmm-*`
agent host was selected. It fails only where that host was not installed — which is exactly
what the restored ` if it exists` guard is for. Whatever `always_load` guarantees is therefore
not "silently not guaranteed" in general; see Correction 4.

## Why the path is plausible but empty

The agent registry really does target `_bmad/skills/` for exactly these four:

```
lib/agents.js:231   skillsDir: '_bmad/skills/sre'
lib/agents.js:306   skillsDir: '_bmad/skills/devops'
lib/agents.js:320   skillsDir: '_bmad/skills/cyber'
lib/agents.js:334   skillsDir: '_bmad/skills/sqa'
```

`generateSkillsManifest(installPath)` (`lib/installer.js:795`) writes `MANIFEST.yaml` into whatever `installPath` it is handed, and is documented as **the only writer of that file** (`lib/installer.js:1806`). In `D:\Code\Workshop` it was never called with a path under `_bmad/skills/`, and that directory was never created — yet the four personas were still deployed into the per-tool trees, ~~where the cited path is wrong for a second reason: it is absolute-from-project-root, not relative to the tree they live in.~~

**CORRECTION 3 — the "second reason" is not a defect. It is the design.**
Per `3bfefc1` (Story 8.3), custom BMAD agents deliberately cite their **agent-host** manifest
at `{project-root}/_bmad/skills/<agent-slug>/`, while built-in BMM agents cite a tree-relative
one. Story 8.3's own task 2.5 spells it out verbatim:

```yaml
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/<agent-slug>/MANIFEST.yaml"
```

> "Where `<agent-slug>` is `sre`, `devops`, `cyber`, or `mil498` respectively per file.
> **These match the `getProjectPath()` in agents.js.**"

The project-root-absolute form is therefore intentional: the four personas are deployed into
every tool tree, but there is only **one** agent-host manifest per slug, and it does not live
inside any tool tree. A tree-relative path would be wrong.

**This claim is withdrawn as a defect and recorded as an open design question instead:**

> **ODQ-1.** Should a custom persona cite a single project-root agent-host manifest, or the
> manifest of the tree it was deployed into? The current answer (project-root, per Story 8.3)
> means the persona reads the same manifest regardless of which tool loaded it — which is
> probably right, but it was decided in 2026-04 for a layout that has since changed twice, and
> it has never been re-examined. Worth re-examining; **not** a bug, and not in scope for the
> text fix.

## ~~Two readings, and they lead to different fixes~~ — SETTLED: reading 2

**The instruction was stale.** Proven by the commit sequence in Correction 1: `bffe2bd`
stripped the segment, `d9d795e` made it correct again the next day and did not restore it.
The installer was never the defect; `lib/agents.js`, `lib/installer.js` and
`generateSkillsManifest` were **not** changed.

<details><summary>Original "Two readings" text, retained as history</summary>


1. **The install is incomplete.** `_bmad/skills/` should exist with a `MANIFEST.yaml`, and the personas' instruction is correct. Fix: make the install create it.
2. **The instruction is stale.** `_bmad/skills/` is a retired layout and the personas should cite the manifest in their own tree, or cite nothing. Fix: correct the four SKILL.md documents.

**Do not guess.** Reading 1 is a behaviour change to the installer; reading 2 edits four shipped skill documents, which moves any digest that pins them. Establish which was intended before writing either.

</details>

**Note on digests:** none of the four persona files contains either pinned block (Story 31.4's
preflight or Story 31.9's gate), so **no sha256 digest moved.** Confirmed after the fix:
`npm run build:plugin` changed only the four SKILL.md mirrors; `marketplace.json` was untouched.

## Related, and probably the same root

`test/project-layout-artifact-routing.test.js`'s `BLOCKING-4` test — *"no shipped skill document cites a file this repository does not ship"* — ~~currently fails on~~ **fails in some working trees on** `skills/open-presentation/SKILL.md -> _bmad-output/methodology/BMAD_AI_Development_Training.pptx`. That is the same defect class: **a shipped instruction pointing at a path the consuming project does not have.** The guard exists; it simply does not cover `_bmad/` paths, so these four slipped past it.

**CORRECTION 5 — `BLOCKING-4`'s redness is worktree-dependent, which is its own defect.**
The guard skips any citation whose target does **not** exist in the working tree
(`test/project-layout-artifact-routing.test.js:1836`):

```js
if (!fs.existsSync(path.join(PROJECT_ROOT, token))) continue; // not a repo document
```

`_bmad-output/` is gitignored, so whether the `.pptx` is present is an accident of which tree
you run in. Measured:

| tree | `_bmad-output/methodology/…pptx` | `project-layout-artifact-routing` |
| --- | --- | --- |
| `D:\Code\AI_Agents` (main) | present | **58/1 — red** |
| `D:\Code\AI_Agents-epic-31` | present | **58/1 — red** |
| this worktree | absent | **59/0 — green** |

So the suite is **green here and red there for the same source**, and
`CITABLE_RUNTIME_ARTIFACTS` (`:1798`) still records only the one pre-existing
`sprint-status-schema.md` offender, **not** the `open-presentation` `.pptx` — `BLOCKING-4` is
red on an unrecorded item wherever the file happens to exist. Recorded in
`bug-workshop-standalone-installskill-loop-never-ran.md`; **not** fixed here.

## Blast radius

- ~~Four personas, 16 deployed copies, every project installed with this layout.~~
  **CORRECTED:** four copies with a wrong path (`ma-agent-sqa` × 4 trees); sixteen with an
  unguarded one.
- **Silent.** Nothing fails, nothing warns; an agent asked to follow Critical Action 1 finds no file and improvises. *(This part stands.)*
- ~~`always_load: true` is the mechanism this instruction exists to honour — whatever depends on it is not happening.~~

**CORRECTION 4 — "whatever depends on `always_load` is not happening" overstates it.**
The mechanism is **fully wired** and works in a normal install. The chain, verified end to end:

```
skill.json (always_load)
  → bin/cli.js:206
  → lib/installer.js:826
  → MANIFEST.yaml
  → lib/hooks/claude-code/verify-manifest.js:43
  → _bmad-output/project-context.md
```

Nothing in that chain is broken or unimplemented. It is not happening **in `D:\Code\Workshop`**
— along with everything else the standalone installer writes, because in that project the
standalone `installSkill()` loop never ran at all. That is a much larger defect than these four
personas and is filed separately as
`bug-workshop-standalone-installskill-loop-never-ran.md`.

## Acceptance criteria for whichever story adopts this

1. ~~The intended reading is **stated and recorded** before any code or text changes.~~ **DONE** — reading 2, recorded above with the commit evidence.
2. `BLOCKING-4`'s guard is widened to cover `_bmad/` paths, so a shipped skill citing a non-existent project path fails at build time. It must be shown red against the current text before the fix, or the guard proves nothing. **STILL OPEN** — and see Correction 5: the guard must also stop depending on whether a gitignored file happens to exist in the working tree.
3. After a fresh install, every path cited in a Critical Actions block resolves in the installed project — asserted over **all** shipped skills, not only these four. **CLOSED for these four; the generalisation moves to AC 2.**

   The fix originally shipped with **no test that could detect its own regression.**
   `test/convert-agents-to-skills.test.js`'s existing assertion is path-agnostic —
   `content.includes('Read the skills MANIFEST')` — so restoring the pre-fix bare unguarded
   path leaves the suite fully green. That is precisely how `bffe2bd` stripped the `sqa/`
   segment in the first place without anything noticing.

   Now pinned. `test/convert-agents-to-skills.test.js` asserts the **full** Critical Action 1
   line for each `ma-agent-*` persona, with the expected path **derived from the `lib/agents.js`
   registry** (`getAgentsByCategory('bmad')` → `skillsDir`), never restated — so the text and
   the registry cannot disagree again even if a `skillsDir` moves. Coverage is all three trees
   that ship a copy: `lib/bmad-extension/skills/`, `lib/bmad-extension-plugin/skills/` and the
   committed `.agents/skills/` deployed tree. A companion assertion pins Critical Action 2
   against `STANDARD_CRITICAL_ACTIONS[1]`, read out of `lib/bmad.js` rather than restated.

   **Shown red before it was trusted.** Replanting the pre-fix bare path
   (`_bmad/skills/MANIFEST.yaml`) in `ma-agent-sqa` across all three trees takes the suite from
   **146/0 to 143/3** — and the three pre-existing path-agnostic assertions still pass, which is
   the demonstration that they never could have caught this. Replanting the lowercased-`for`
   step 2 takes it to **145/1**. Both probes reverted; blob hashes identical before and after.

   **Residual:** "asserted over **all** shipped skills, after a fresh install" is *not* closed by
   this pin, which covers the four `ma-agent-*` personas in the repository trees only. That
   generalisation belongs to AC 2 (`BLOCKING-4`'s guard, widened to `_bmad/` paths and made
   independent of gitignored working-tree accidents) and remains **STILL OPEN** there.
4. ~~If reading 1 is chosen: `_bmad/skills/MANIFEST.yaml` exists after install and lists the `always_load` skills, proven by reading the file rather than by asserting the call site was reached.~~ **N/A — reading 1 was not chosen.**
5. ~~If reading 2 is chosen:~~ **DONE** — the four documents are corrected on `fix/persona-manifest-path`; no digest moved (none of the four carries a pinned block), and the plugin mirrors were regenerated with `npm run build:plugin`.

## Provenance

- Found while investigating a user's question about duplicate skill directories in `D:\Code\Workshop`.
- ~~Measured in that project: `_bmad/skills/` absent, `MANIFEST.yaml` absent from all four trees, four skills citing it, all four deployed into every tree.~~ **CORRECTED:** those measurements are accurate **for `D:\Code\Workshop`** but were wrongly generalised to the product. See Corrections 1 and 2.
- Registry lines and the `generateSkillsManifest` contract were read at source in `lib/agents.js` and `lib/installer.js`.
- **Not caused by Epic 31.** The install predates the 3.18.0-beta.1 publish and no Epic 31 story touches these personas or the manifest generator.
- **Corrected 2026-09-12** on `fix/persona-manifest-path` after a history investigation
  (`1458029` → `bffe2bd` → `d9d795e`) and a read-only re-audit of `D:\Code\Workshop`.
  Three central claims were wrong; see the Correction Notice at the top.
- See also `bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md`, found in the same investigation.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
