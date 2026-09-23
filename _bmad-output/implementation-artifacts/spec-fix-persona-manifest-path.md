---
title: 'Restore the sqa/ segment and the "if it exists" guard in ma-agent-* Critical Action 1'
type: 'bugfix'
created: '2026-09-12'
status: 'in-review' # draft | ready-for-dev | in-progress | in-review | done
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ma-agent-sqa`'s Critical Action 1 cites `_bmad/skills/MANIFEST.yaml`, missing the `sqa/`
segment its three siblings carry and that `lib/agents.js:334` (`skillsDir: '_bmad/skills/sqa'`) requires.
All four also lost the original author's ` if it exists` guard, so in an install where the `bmm-*` agent
host was never selected the block instructs the agent to read a file that is legitimately absent.

**Approach:** Text-only fix to the four shipped persona documents (restore `sqa/`, restore the guard,
make step 2 conditional on it), regenerate the plugin mirrors, correct the three factual errors in the
existing bug file as struck-through history, and file the larger Workshop dual-pipeline regression as a
new high-severity bug.

## Boundaries & Constraints

**Always:** Keep the literal substrings `Read the skills MANIFEST at {project-root}`,
`always_load: true` and `project-context.md` intact — `lib/bmad.js:2642` substring-matches the first and
`test/convert-agents-to-skills.test.js:234-242` asserts on all three. Regenerate plugin mirrors with
`npm run build:plugin` or `bundle-drift.yml` fails. Commit after every small step.

**Ask First:** Any change that would move a sha256 digest; any change to `lib/agents.js`, the installer,
or `generateSkillsManifest`.

**Never:** Do not touch `lib/agents.js`, `lib/installer.js`, or `generateSkillsManifest` — the installer
is not the defect. Do not modify anything under `D:\Code\Workshop` (read-only). Do not push, open a PR,
or publish. Do not set any status to `done`. Do not run
`test/project-layout-two-store-round-trip.test.js` or `test/yes-flag.test.js`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent host installed | `_bmad/skills/<slug>/MANIFEST.yaml` present | Agent reads manifest, then loads every `always_load: true` skill | N/A |
| Agent host absent | `_bmad/skills/<slug>/` absent | Guard short-circuits; step 2 skipped; no failed read, no improvisation | Guard is the handling |
| sqa persona | `skillsDir: '_bmad/skills/sqa'` | Cited path matches registry exactly | N/A |

</frozen-after-approval>

## Code Map

- `lib/bmad-extension/skills/ma-agent-{sre,devops,cyber,sqa}/SKILL.md` -- source personas; Critical Actions block
- `lib/bmad-extension-plugin/skills/ma-agent-*/SKILL.md` -- generated mirrors; must be rebuilt
- `lib/agents.js:231,306,320,334` -- registry `skillsDir` values; READ ONLY, the source of truth for the paths
- `lib/bmad.js:2477` -- `STANDARD_CRITICAL_ACTIONS`; `:2642` matches via `trimmed.includes(std)` (prefix-safe)
- `test/convert-agents-to-skills.test.js:234-242` -- asserts the three Critical Actions substrings
- `docs/technical-notes/enforcement-hooks-research.md:297` -- origin of the bare path (illustrative snippet)
- `_bmad-output/implementation-artifacts/bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md` -- to correct in place
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- register the new bug

## Tasks & Acceptance

**Execution:**
- [ ] `lib/bmad-extension/skills/ma-agent-sqa/SKILL.md` -- restore `sqa/` in Critical Action 1 -- aligns with `lib/agents.js:334`
- [ ] `lib/bmad-extension/skills/ma-agent-{sre,devops,cyber,sqa}/SKILL.md` -- restore ` if it exists` guard; make step 2 conditional -- correct in installs without a `bmm-*` host
- [ ] `docs/technical-notes/enforcement-hooks-research.md:297` -- correct the illustrative bare path -- remove the contaminant
- [ ] `npm run build:plugin` -- regenerate + commit mirrors -- `bundle-drift.yml` gate
- [ ] `bug-ma-agent-personas-...md` -- correct 3 factual errors as struck-through history -- repo convention
- [ ] `bug-workshop-standalone-installskill-loop-never-ran.md` -- file new high-severity bug -- larger defect
- [ ] `sprint-status.yaml` -- register the new bug; re-validate with `js-yaml`

**Nit round (2026-09-13, independent review — APPROVE-WITH-NITS, nothing blocking):**
- [x] `test/convert-agents-to-skills.test.js` -- pin the full Critical Action 1 line per persona, path **derived** from `lib/agents.js` `getAgentsByCategory('bmad')`, across all three trees; companion pin of Critical Action 2 against `STANDARD_CRITICAL_ACTIONS[1]` read out of `lib/bmad.js` -- the fix shipped with no test able to detect its own regression
- [x] `.agents/skills/ma-agent-{sre,devops,cyber,sqa}/SKILL.md` -- sync the two Critical Action lines with source, CRLF preserved -- the drift was **introduced** by this change (lockstep with source at `0f03e4f`), not inherited
- [x] `bug-workshop-standalone-installskill-loop-never-ran.md` -- correct RF-1's stated reason with the commit evidence; add RF-4 (`lib/installer.js:772`'s false absolute)
- [x] `lib/bmad-extension/skills/ma-agent-*/SKILL.md` -- reword step 2 to keep the capital `For`; `lib/bmad.js:2642` matches case-sensitively, so step 2 was classifying CUSTOM in all four personas
- [x] `bug-ma-agent-personas-...md` -- header said "three" while the body carries five corrections; close AC 3; record the `bffe2bd` caution
- [x] `bug-ma-agent-activation-sequence-carries-two-no-op-steps.md` -- new backlog bug; the Activation Sequence resolution runs the **other** way (drop from the other three, do not restore to `sqa`)

**Acceptance Criteria:**
- Given the four persona SKILL.md files, when Critical Action 1 is read, then each cites
  `{project-root}/_bmad/skills/<slug>/MANIFEST.yaml if it exists` with `<slug>` matching its `lib/agents.js` `skillsDir`.
- Given an install with no `_bmad/skills/<slug>/`, when the agent follows Critical Actions, then the
  guard short-circuits and step 2 is explicitly skipped rather than failing.
- Given the source personas changed, when `npm run build:plugin` runs, then
  `git status --porcelain` is clean after committing the regenerated mirrors.
- Given the changes, when the named suites run, then every invariant in the brief re-derives unchanged.

## Spec Change Log

- **2026-09-13 — nit round.** An independent review returned APPROVE-WITH-NITS (nothing
  blocking) on four items, all closed on this branch. Two corrections to what the original
  execution recorded:
  - The **`Always` constraint was necessary but not sufficient.** It required only that
    `content.includes('always_load: true')` keep passing. Step 2's new conditional prefix
    satisfied that while lowercasing the leading `For`, which is what `lib/bmad.js:2642`
    substring-matches — so every persona's step 2 silently reclassified as CUSTOM. The Design
    Notes reasoned correctly about the **suffix** on `STANDARD_CRITICAL_ACTIONS[0]` and did not
    apply the same reasoning to the **prefix** on `[1]`.
  - The **Code Map's tree list was incomplete.** It named the source bundle and the generated
    plugin mirror. A third tree ships a copy — the committed, tracked, non-gitignored
    `.agents/skills/` — and it had moved in lockstep with source (`0f03e4f`) up to this branch.
    Scoping the change to "source bundles and their generated mirrors" therefore *created* the
    drift rather than leaving pre-existing drift alone.

  Both were caught by **executing** the shipped code, not by reading it. The new tests in
  `test/convert-agents-to-skills.test.js` exist so neither can recur silently.

## Design Notes

The guard is a suffix on `STANDARD_CRITICAL_ACTIONS[0]` (`'Read the skills MANIFEST at {project-root}'`),
which `lib/bmad.js:2642` matches with `trimmed.includes(std)` — the standard entry is the *needle*, so any
suffix is safe. Verified at source, not assumed.

Step 2 keeps the literal `always_load: true` so the convert test's substring assertion still passes:

```
1. Read the skills MANIFEST at {project-root}/_bmad/skills/sqa/MANIFEST.yaml if it exists
2. If that MANIFEST was read, then for each skill marked always_load: true, read the skill file completely
```

## Verification

**Commands:**
- `npm run build:plugin` -- expected: mirrors regenerate, exit 0
- `node test/convert-agents-to-skills.test.js` -- expected: 0 failed
- `node test/project-layout-artifact-routing.test.js` -- expected: 58/1, pre-existing `open-presentation` only
- `node -e "require('js-yaml').load(...)"` on `sprint-status.yaml` -- expected: parses
- `git status --porcelain` -- expected: empty after each commit

**Manual checks:**
- All four Critical Action 1 lines cite a slug matching their `lib/agents.js` `skillsDir`.
