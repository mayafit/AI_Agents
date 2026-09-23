---
type: bug
severity: high
title: In a real install the ma-agents standalone installSkill() loop never ran — only BMAD's pipeline placed skills, so MANIFEST.yaml, the per-tree .ma-agents.json, CLAUDE.md/AGENTS.md, project-context.md and the SessionStart hook are ALL absent
---

# Bug: the standalone installer wrote nothing — every instruction the product stamps to make skills load is missing

**Status:** backlog
**Severity:** high (every enforcement artifact the product ships is absent from a real install; silent)
**Affected Component:** `lib/installer.js:1915` (`installSkill`), `:795` (`generateSkillsManifest`), `:2561` (SessionStart hook deployment), `:1838` (the Bug 27.16 `.agents/skills` reconciler); `lib/bmad.js` custom-marketplace / `--custom-source` path
**Classification:** CODE FIX. Same class as Bug 27.16, which fixed this for `.agents/` only.

## The defect

`lib/installer.js:1803-1815` already names the shape:

> Two pipelines write skills: ma-agents' own standalone loop (`installSkill` →
> `performInstall` + `generateSkillsManifest` — **the ONLY writer of `MANIFEST.yaml`**), and
> bmad-method's `PluginResolver` (via `--custom-source`) […] leaving a dir that looks installed
> but is silently partial AND missing the `MANIFEST.yaml` the stamped instruction block points
> agents at.

Bug 27.16 fixed that **for `.agents/skills` only**, by backfilling that one directory
(`lib/installer.js:1838`, `:1879`). `D:\Code\Workshop` shows the same regression at **full
scope**: the standalone loop appears not to have run for **any** tree.

**Every artifact whose sole writer is the standalone loop is absent.** The skills are present —
BMAD's pipeline placed them — so the install *looks* complete. Nothing that makes an agent
actually *load* them is there.

## Verified in `D:\Code\Workshop` (read-only audit, 2026-09-12)

Install markers: BMAD **6.10.0**, `installDate 2026-09-10T02:21:23.517Z`, module `ma-skills`
**3.7.0** (`source: custom`, `npmPackage: null`, `localPath: …\.ma-agents-plugin-stage`),
root `.ma-agents.json` `manifestVersion 1.2.0`, `profile: on-prem`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Four skill trees, 166 skills each | **VERIFIED** | `.claude\skills`, `.agents\skills`, `.cline\skills`, `.agent\skills` — 166 each, name-sets byte-identical |
| 2 | 166 = 50 `bmad-extension` + 116 BMAD-native | **VERIFIED exactly** | `_bmad\_config\skill-manifest.csv`: 169 rows; `ma-skills` 50, BMAD-native 119 − 3 dupes (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, each once under `bmm` and once under `ma-skills`) = 116 |
| 3 | **No `MANIFEST.yaml` anywhere** | **VERIFIED** | Zero hits outside `node_modules`. The only manifest is BMAD's own lowercase `_bmad\_config\manifest.yaml` |
| 4 | **No per-tree `.ma-agents.json`** | **VERIFIED** | Exactly one exists, at the project **root** — none in any of the four trees |
| 5 | **No `CLAUDE.md`, no `AGENTS.md`** | **VERIFIED** | 0 hits each (also no `GEMINI.md`) |
| 6 | **No `_bmad-output/project-context.md`** | **VERIFIED** | `_bmad-output\` holds only three empty dirs + `methodology\` |
| 7 | **No SessionStart hook** | **VERIFIED (stronger)** | No `.claude\settings.json` or `settings.local.json` exists **at all**; 0 hits for `SessionStart` project-wide. `.claude\` contains only `skills\` |

### Correction to the original claim about the 45-skill catalog

The claim *"0 of the 45 standalone catalog skills are present"* is **substantively right but
numerically wrong**, and the precise version matters for the fix:

- **33 of 45 are definitively absent** — no name collision, no counterpart: `ai-audit-trail`,
  `auto-bug-detection`, the six `cpp-*`, `code-review`, `commit-message`, `git-workflow-skill`,
  `open-presentation`, `python-*`, `skill-creator`, `story-status-lookup`, `test-generator`, etc.
- **12 of 45 are present by name** — `add-sprint`, `add-to-sprint`, `bmad-knowledge`,
  `bmad-sprint-planning`, `bmad-sprint-status`, `cleanup-done`, `close-sprint`,
  `generate-backlog`, `modify-sprint`, `prioritize-backlog`, `remove-from-sprint`,
  `sprint-status-view` — but `skill-manifest.csv` attributes every one to `module=ma-skills`
  (the bmad-extension set), and their content differs from the catalog copies. **They arrived
  via BMAD's pipeline, not the standalone loop.**

So: **zero skills attributable to the standalone loop**, which is the claim that matters.

### Two further findings from the same audit

1. **All 50 `ma-skills` source paths are dangling.** `_bmad\ma-skills\` contains only
   `config.yaml` and `module-help.csv` — **zero skill subdirectories** — yet
   `skill-manifest.csv` declares all 50 at `_bmad/ma-skills/<id>/SKILL.md`. The skills exist
   only in the four projected IDE trees.
2. **The `ides` list and the trees on disk disagree, in both directions.**
   `manifest.yaml` records `ides: [claude-code, github-copilot, cline, antigravity]`, but no
   `.antigravity\` directory exists, while `.agent\` **was** written and is not in the list.
   This is the same divergence filed as
   `bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md`.

## Blast radius

- **Every instruction the product stamps to make skills load is missing from this install.**
  The MANIFEST the personas' Critical Action 1 points at; the `always_load` enforcement the
  SessionStart hook performs; the `CLAUDE.md`/`AGENTS.md` instruction stamps; `project-context.md`.
- **Silent.** 166 skills per tree are present, so the install reads as successful. The install
  log reports success.
- **Grows with every tree.** 27.16 backfilled `.agents/` specifically. `.agent/`, `.cline/` and
  `.claude/` have no equivalent, and a new tool tree inherits the gap on the day it is added.

## Acceptance criteria

1. Reproduce first: an install that selects only BMAD-pipeline-routed tools must be shown to
   produce zero `MANIFEST.yaml`, before any fix. A fix landed without the red repro proves nothing.
2. After install, **every** skill tree that received skills has a `MANIFEST.yaml`, a per-tree
   `.ma-agents.json`, and the full standalone catalog — asserted by reading the files, not by
   asserting a call site was reached.
3. The backfill is **derived from the trees present on disk**, not from the registry's list of
   trees it expects — otherwise the next unknown tree (`.agent/`) repeats this exactly.
4. `CLAUDE.md` / `AGENTS.md`, `_bmad-output/project-context.md` and the SessionStart hook are
   written whenever skills were placed, regardless of which pipeline placed them.
5. A test fails when a tree contains skills but no `MANIFEST.yaml` — the invariant 27.16 should
   have generalised.

## Related findings recorded here

### RF-1 — `.agents/skills/ma-agent-ml/` is an orphaned deployed tree (this repository)

`5b11f2b` (Story 30.4, 2026-07-12, *"remove ma-agent-ml + 12 ml-* skills and bmm-demerzel
registration"*) deleted `ma-agent-ml` from all three source bundles. **Verified absent** from
`skills/`, `lib/bmad-extension/skills/` and `lib/bmad-extension-plugin/skills/`. It is still
**tracked in git** at `.agents/skills/ma-agent-ml/` (`SKILL.md`, `.gitkeep`,
`bmad-skill-manifest.yaml`), and its Critical Action 1 cites
`{project-root}/_bmad/skills/demerzel/MANIFEST.yaml` — an agent host `lib/agents.js` no longer
registers. The deployed tree was never reconciled with the source bundles.

**Related — and the original justification here was wrong.** An earlier revision of this
finding said the same `.agents/` tree's four `ma-agent-*` personas were pre-existing drift,
"deliberately **not** updated on `fix/persona-manifest-path`, which is scoped to the source
bundles and their generated mirrors." **That reasoning does not hold for those four files**,
and leaving them would have made this change the *author* of the drift rather than its
inheritor. Two measurements settle it:

| file | last commit before `fix/persona-manifest-path` |
| --- | --- |
| `.agents/skills/ma-agent-{sre,devops,cyber,sqa}/SKILL.md` | `0f03e4f` |
| `lib/bmad-extension/skills/ma-agent-{sre,devops,cyber,sqa}/SKILL.md` | `0f03e4f` |
| `.agents/skills/ma-agent-ml/SKILL.md` | `98cb888` |

The four personas moved in **lockstep with source** — same commit, and byte-identical to their
source counterparts modulo CRLF line endings (verified by CR-normalised `diff`: zero differing
lines before this branch). Nothing regenerates `.agents/`: `npm run build:plugin`
(`scripts/build-plugin.js`) writes only `lib/bmad-extension-plugin/`, and the tree is **tracked
and not gitignored** (`git check-ignore` reports no match). It is a committed deployed copy that
has always been hand-maintained alongside source.

**Therefore the four were updated on `fix/persona-manifest-path`** — the same two Critical Action
lines, nothing else (8 insertions, 8 deletions across four files), CRLF preserved.

`ma-agent-ml` is the genuinely stale one and remains RF-1's actual subject: last touched by
`98cb888`, three commits of source history behind, and deleted from all three source bundles by
`5b11f2b` without ever being reconciled here. It is **not** touched by this branch — removing an
orphaned deployed tree is a separate decision from keeping a live one in sync.

The finding that survives: **nothing notices when `.agents/` drifts from source.** There is no
build step and no test that compares them. That gap is what let `ma-agent-ml` rot, and it is why
the four personas had to be caught by review rather than by CI.

### RF-2 — `CITABLE_RUNTIME_ARTIFACTS` does not record the `open-presentation` offender

`test/project-layout-artifact-routing.test.js:1798` records exactly one pre-existing offender
(`_bmad-output/planning-artifacts/sprint-status-schema.md`, Story 17.9) plus two generated
artifacts. It does **not** record
`skills/open-presentation/SKILL.md -> _bmad-output/methodology/BMAD_AI_Development_Training.pptx`,
so `BLOCKING-4` is red on an unrecorded item.

**And its redness is worktree-dependent**, which is the deeper defect. The guard skips any
citation whose target does not exist in the working tree (`:1836`):

```js
if (!fs.existsSync(path.join(PROJECT_ROOT, token))) continue; // not a repo document
```

`_bmad-output/` is gitignored, so the suite's result depends on which checkout you run in:

| tree | `…methodology\…pptx` | `project-layout-artifact-routing` |
| --- | --- | --- |
| `D:\Code\AI_Agents` (main) | present | 58/1 — red |
| `D:\Code\AI_Agents-epic-31` | present | 58/1 — red |
| `…\.worktrees\fix-persona-manifest-path` | absent | **59/0 — green** |

A guard that is green or red for the same source depending on a gitignored file is not a guard.
Fix both: record the offender, and make the check independent of working-tree accidents.

**A second, independent way the same guard goes red — test-order coupling.** Measured
2026-09-13 in the `fix/persona-manifest-path` worktree. Running `test/build-plugin.test.js`
leaves an untracked staging tree behind at `lib/.bmad-extension-plugin.build-<pid>-<ms>/`, which
contains `skills/`. `BLOCKING-4`'s companion assertion — *"the guard has real reach: it inspects
every shipped skill tree"* — enumerates skill trees **from disk**, finds four where three are
pinned, and fails:

```
the guard scans ["skills","lib/bmad-extension/skills","lib/bmad-extension-plugin/skills"]
but this repository ships skill trees at ["lib/.bmad-extension-plugin.build-18780-1789298891730/skills", ...]
```

Same tree, same commit: **58/1 with the leftover present, 59/0 once it is removed.** The leftover
is not gitignored, so `git status` does show it — but a reviewer who runs the suites in
`npm test` order and reads only the pass/fail counts sees a failure that has nothing to do with
the code under review. Two defects, both pre-existing and both cheap: the builder should clean up
its staging tree (this is the same Windows `prepare` leak that puts a temp build dir in the
published tarball), and the reach assertion should exclude dot-prefixed build staging trees.

### RF-3 — `11.1 AC9(c)` in `project-layout-confluence-publish-hook.test.js` is mis-scoped

`changedFiles()` (`:3908-3914`) computes
`git diff --name-only $(git merge-base HEAD feature/epic-31)..HEAD` and test `11.1` asserts the
result touches nothing under `skills/`, `lib/bmad-extension/skills/` or
`lib/bmad-extension-plugin/`. That is a **Story 31.15 scope assertion**, but it is evaluated
against *whatever branch happens to be checked out*. Any sibling branch cut from
`feature/epic-31` that legitimately edits a skill document trips it — as
`fix/persona-manifest-path` does, taking the suite from **112/0 to 111/1** with no behavioural
regression whatsoever. `fix/antigravity-path-divergence` and `fix/wds-default-modules` sit in
the same position.

The assertion should be pinned to Story 31.15's own commit range (or moved into that story's
review record), not re-evaluated on every branch that shares its merge base.

### RF-4 — `lib/installer.js:772` asserts something that is false, and was false when written

The docblock above `GLOBAL_BIND_OFFER_HEADER` states, in capitals, what the header does *not* do:

```
 * WHAT THIS HEADER DOES NOT DO, stated plainly because Story 31.11's reviewer
 * established it and Story 31.13 did not fix it: NOTHING DIRECTS AN AGENT TO READ
 * MANIFEST.yaml AT SKILL-ACTIVATION TIME. Zero of the shipped SKILL.md files
 * mention this file.
```

**"Zero of the shipped SKILL.md files mention this file" is false.** All four `ma-agent-*`
personas name `MANIFEST.yaml` as **Critical Action 1** — the literal first instruction in the
document an agent loads at activation. Measured in this repository: eight shipped `SKILL.md`
files match `MANIFEST.yaml` (four personas × the source bundle and the plugin mirror), plus the
four committed `.agents/` copies.

**Pre-existing and unrelated to `fix/persona-manifest-path`.** It was false before that branch
and is false after it — the branch changed the path *inside* those citations, never whether they
exist. The broader sentence it supports ("nothing directs an agent to read MANIFEST.yaml at
skill-activation time") is *also* wrong for these four personas, though it may hold for the
`bmad-agent-*` and tool-skill documents the Story 31.11 reviewer was looking at.

The likely mechanism is a scope slip: a claim measured over one family of skill documents,
written down as a claim over *all* of them. The four `ma-agent-*` personas are the counter-example
that was not enumerated.

**Fix is documentary, not behavioural** — no code depends on the sentence. Either scope it to the
family it was measured over, or delete it. Whichever, do not leave a capitalised absolute
standing next to a counter-example that ships in the same package.

## Provenance

- Found while investigating the four `ma-agent-*` personas' Critical Action 1; the Workshop
  symptoms in that report turned out to have this much larger root cause.
- `D:\Code\Workshop` audited **read-only** on 2026-09-12; nothing in that project was modified.
- Counts taken from `_bmad\_config\skill-manifest.csv` and `manifest.yaml` in that install, and
  from directory enumeration of all four trees.
- The dual-pipeline mechanism is quoted from `lib/installer.js:1803-1815` in this repository.
- **Not caused by Epic 31.** The install (2026-09-10) predates the 3.18.0-beta.1 publish, and no
  Epic 31 story touches `installSkill`, `generateSkillsManifest` or the hook deployment.
- See also `bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created.md` (corrected) and
  `bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md`.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
