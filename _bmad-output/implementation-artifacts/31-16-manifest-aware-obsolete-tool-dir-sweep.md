# Story 31.16 — The Obsolete-Tool-Dir Sweep Becomes Manifest-Aware: Delete What ma-agents Installed, Preserve Everything Else

Status: review

**Bug:** `bug-obsolete-tool-dir-sweep-deletes-user-authored-skills.md` (severity high). **Related:** `bug-antigravity-path-divergence-creates-a-second-unpatched-skill-tree.md` (added the fifth sweep entry this story must land before).
**FR/NFR:** none. This is a defect in shipped behaviour, not a requirements change — the fix restores what the existing guard's own comment at `lib/installer.js:2412` already claims. **The PRD and Decision P5-9 are deliberately not touched.**
**Release constraint:** the human has stated this goes into **3.18.0**. The `.antigravity/skills` sweep entry (`lib/installer.js:2273`) is the one unreleased entry of five and **must not ship without this fix**.

---

## 1. Why this story exists

`migrateObsoleteToolDirs` (`lib/installer.js:2382`) deletes a whole legacy skills directory with one recursive `fs.remove` (`:2405`) once the replacement directory has any content. It never asks which files ma-agents put there, though the directory carries ma-agents' own record of exactly that.

The full defect analysis, the five-entry table, the not-at-risk list (cline; opencode/gemini/cursor), the shipped-vs-unreleased split and every measurement live in the bug file. This document does not restate them. It specifies the fix, and — more importantly — records the one place where the fix's premise turned out to be **weaker than the brief assumed**, because that changes the design.

## 2. The premise, corrected: the manifest is SOUND but INCOMPLETE

The fix was scoped as *"consult `MANIFEST.yaml` / `.ma-agents.json`, both of which record exactly which skills ma-agents installed."* Both records do exist and both are usable. But two measurements bound how far they can be trusted, and both were taken before writing an AC:

**(a) Many real trees carry no per-tree manifest at all.** In `D:\Code\Workshop` — four populated skill trees, 166 entries each — `find . -maxdepth 3` for `MANIFEST.yaml` or `.ma-agents.json` returns **one** hit: the project-root `.ma-agents.json`, which has **no `skills` key** because it is a profile store, not an inventory (`lib/profile.js:27-32`). The reason is stated in the code: two pipelines write skills and only one writes manifests (`lib/installer.js:1805-1809`) — bmad-method's PluginResolver writes skills into these trees and no manifest.

**(b) Where a manifest does exist it under-records.** `d:\Code\AI_Agents\.claude\skills`: 35 skill directories on disk, 44 ids in `.ma-agents.json::skills`, and two on-disk directories absent from the manifest (`reconfigure-layout`, `repo-sync-check`) that carry `performInstall`'s exact injected frontmatter and so were unquestionably installed by ma-agents.

**Therefore: manifest-recorded ⟹ ma-agents installed it; the converse does not hold.** The manifest is a *positive* record only. The design below uses it that way and deliberately over-preserves. A stale directory left behind costs the user the `rm -rf` the preserve branch already prints (`lib/installer.js:2418`); a deleted hand-written skill costs the file. The asymmetry decides the direction, and **AC4 is not an edge case — in the field it is the common case.**

This is an honest narrowing of the option-1 mechanism, not a substitution for it. No alternative design is needed; the mechanism is available where it exists and the absent case has a correct, safe answer.

## 3. The algorithm

Per entry in `OBSOLETE_TOOL_SKILL_DIRS`, when the obsolete directory exists **and** the replacement directory has content (the existing `replacedByHasContent` gate at `:2396-2403` is unchanged and still runs first):

```
MANIFEST_FILES := { ".ma-agents.json", "MANIFEST.yaml" }
owned          := keys( readManifest(obsoletePath)?.skills ) or {} when absent/unparseable
residue        := readdir(obsoletePath) \ owned \ MANIFEST_FILES

if residue is empty:
    fs.remove(obsoletePath)          -> action 'removed'   (existing log line, unchanged)
else:
    for id in owned: fs.remove(obsoletePath/id)
    preserve obsoletePath            -> action 'preserved-partial'  (new log line, names residue)
```

Consequences, each deliberate:

- **No manifest ⟹ `owned` is empty ⟹ `residue` is everything ⟹ preserve.** Unknown provenance fails safe, with nothing special-cased. An unparseable manifest takes the same path: `readManifest` already returns `null` on a parse error (`lib/installer.js:295-299`).
- **A manifest key with no directory on disk** is a no-op removal. This keeps the operation idempotent without a pre-existence check.
- **The two manifest files are excluded from `residue`, not included in `owned`.** If they counted as residue, every manifested tree would preserve forever and the cleanup would be dead. They are removed only as part of whole-directory removal.
- **On the preserve-partial path the manifest files are left byte-unchanged.** A second run then recomputes the same `owned` set, removes nothing (already gone) and preserves again — same residue, same log. Pruning them instead would make run two see no manifest and behave differently from run one; the stability is worth the stale record, and the directory is no longer an install target.
- **`migrateRetiredSkills` (`:2277`) is not touched.** Different sweep, different unit (skill ids, not directories), already manifest-aware.

Scope: `lib/installer.js` only, inside `migrateObsoleteToolDirs`. No registry entry is added, removed or reordered — `test/obsolete-tool-dirs.test.js` pins entry order positionally (`lib/installer.js:2270-2271`, *"results[0] must stay the copilot entry"*).

## 4. Acceptance criteria

Each AC names the **outside authority** its test binds to. No test may take its expectation from `migrateObsoleteToolDirs` itself, or from a constant the implementation exports for its own use. This repository has produced six tautological tests where expectation and implementation shared a source.

1. **A user-authored file in a swept directory survives, and the directory is preserved.** Fixture: an obsolete directory holding (i) skill directories written through the **real installer writers** — `ensureManifest` + `writeManifest` (`lib/installer.js:302`, `:2108-2115`) for the record and a real `<skillId>/SKILL.md` on disk — and (ii) a hand-authored `my-house-style/SKILL.md` that appears in no manifest, plus a loose `NOTES.md`. After the sweep, both user paths exist with **byte-identical content** and the obsolete directory still exists. **Authority: the real filesystem** (`fs.readFileSync` on the real temp tree, no mock `fs`), and the manifest's own writers for the fixture — the test never hand-writes the `.ma-agents.json` shape.

2. **A directory containing only ma-agents-installed skills is still removed.** Same fixture minus the two user paths: after the sweep `fs.existsSync(obsoletePath) === false`, and `results[n].action === 'removed'`. **Authority: the existing shipped behaviour** — `test/obsolete-tool-dirs.test.js` cases `b2-t1`, `b2-t6` and `b2-t7` must pass **unmodified**, including `b2-t7` (nested content removed recursively) where the nesting sits *inside a manifested skill directory*. A diff of that file showing any edit to those three cases fails the AC.

3. **The preserved case names the files that caused preservation.** Captured stdout on the AC1 fixture contains `my-house-style` and `NOTES.md`, and does **not** contain the shipped removal string. **Authority: the shipped log literals** — the removal string is asserted as the exact template at `lib/installer.js:2408-2409` and the manual-cleanup instruction as the one at `:2415-2418`, both read as literals a reviewer can match against the source lines; the new preserve-partial line is asserted to name every residue entry by basename, with the residue list built by the test from what the test wrote.

4. **A directory with no manifest is preserved, never removed.** Fixture reproduces the measured `D:\Code\Workshop` shape: skill directories with `SKILL.md`, **no `MANIFEST.yaml` and no `.ma-agents.json` anywhere in the tree**, replacement directory populated. After the sweep every path is byte-identical and the directory exists. A second test asserts the same for a **present but unparseable** `.ma-agents.json`, and a third for a manifest with `skills: {}`. **Authority: a real-world install measured out-of-band** (`D:\Code\Workshop`, four trees / 166 entries / zero per-tree manifests; the project-root `.ma-agents.json` carries no `skills` key) — recorded in the bug file, and re-derivable from `lib/installer.js:1805-1809` and `lib/profile.js:27-32`, both of which independently state that a tree can legitimately have no manifest.

5. **All five entries get the behaviour, proven per-entry.** AC1, AC2 and AC4 each run **as a loop over the exported `OBSOLETE_TOOL_SKILL_DIRS`**, seeding `entry.obsolete` and `entry.replacedBy` from the registry rather than from hard-coded paths, so a sixth entry is covered the day it is added. Separately, `OBSOLETE_TOOL_SKILL_DIRS.length === 5` and the five `obsolete` values are asserted as a set, so silently dropping an entry from the loop fails. **Authority: the registry itself as data** — and the count/set assertion is the guard against the loop being vacuous.

6. **The unreleased entry is gated.** A test asserts that the entry whose `obsolete` is `.antigravity/skills` is present in the registry **and** that it takes the AC1 and AC4 paths. Stated in the story and in the bug file: **3.18.0 must not ship the `.antigravity/skills` entry without this fix.** It is the only one of the five not on `main` (`git show main:lib/installer.js` → four entries), and `package.json::version` is `3.18.0-beta.1`.

7. **Idempotency and the unchanged outer gate.** (a) Running the sweep twice over the AC1 fixture produces the identical `results` action per entry and an identical tree — the preserve-partial path is stable, not oscillating. (b) `test/obsolete-tool-dirs.test.js` cases `b2-t2` (preserve when the replacement is absent/empty), `b2-t3` (no-op when the obsolete dir is absent), `b2-t4` (run twice) and `b2-t5` (frozen registry) pass **unmodified** — the preserve-on-empty rule is untouched and the new logic sits strictly inside the `replacedByHasContent` branch. **Authority: the pre-existing test file**, which was written against the shipped contract before this story existed.

8. **Every new test is mutation-tested, and the mutants are named.** At minimum these, each planted, each proven to turn a named test red, each reverted: (m1) `residue` computed ignoring the user entries — reduces to today's behaviour, must fail AC1; (m2) `owned` defaulted to *all* directory entries when the manifest is absent, must fail AC4; (m3) the manifest files counted as residue, must fail AC2 (cleanup dies); (m4) the manifest files counted as `owned` and deleted on the preserve path, must fail AC7(a); (m5) the residue names dropped from the log while the preserve decision stands, must fail AC3; (m6) the per-entry loop pinned to a single entry, must fail AC5. A surviving mutant is a defect in the test, and is reported rather than argued away.

9. **Full `npm test` green on Windows; every touched test file also run directly**, per the known CRLF/suite-order caveat recorded in `bug-npm-test-windows-suite-health-chain.md`. The pre-existing suite-health failure is confirmed identical on the base commit and reported as not-a-regression rather than absorbed.

10. **Nothing outside `lib/installer.js::migrateObsoleteToolDirs` and `test/` changes.** Asserted by a path-scoped diff. In particular `OBSOLETE_TOOL_SKILL_DIRS` keeps its exact contents and order (`lib/installer.js:2270-2271` pins `results[0]`), `lib/agents.js` is untouched, and no CHANGELOG or PRD text is edited under this story.

## 5. Why the alternatives were rejected

- **Move the obsolete tree to a backup directory instead of deleting.** Invents a directory the user never asked for, in a repository root, that nothing ever reclaims. Converts a data-loss bug into a litter bug and still leaves the user to work out what was theirs.
- **Prompt before deleting.** The sweep runs inside `installSkill` (`lib/installer.js:2150`), on a path that must work under `--yes`. A prompt there is either skipped (back to deleting) or blocks non-interactive installs.
- **Delete anything whose id matches a currently-shipped skill.** Uses the live catalog as the oracle rather than the install record. A skill retired since the user installed it becomes undeletable; a skill renamed into the catalog becomes deletable in a tree it was never installed into. The manifest is the record of *this* install; the catalog is the record of *this version*.
- **Compare file content against the shipped `skills/<id>/SKILL.md`.** Would let an edited ma-agents skill count as user content — arguably better — but `performInstall` injects per-agent frontmatter and applies a resource map (`lib/installer.js:1765-1791`), so "unmodified" is not a byte comparison, and the on-prem patcher deliberately rewrites deployed personas in place (`lib/bmad.js`, `applyOnPremPhasePrefixToDeployedSkills`). Every legitimately patched persona would read as user-modified. Rejected as unreliable, not as undesirable.

## 6. Residual risks, disclosed rather than solved

- **Over-preservation.** A tree written by bmad-method's PluginResolver has no manifest and will now never be swept. Users of those projects keep a stale directory and the existing manual-cleanup instruction. Accepted: this is AC4 working, not failing.
- **Already-lost files are not recoverable.** Entries 1-4 have been shipping since 3.7.0/3.8.1. `fs.remove` is not a recycle-bin operation and nothing is backed up. This story prevents future loss only. Whether the release notes should say so is a call for the human — this story does not write CHANGELOG text.
- **A manifest listing a skill the user later hand-edited in place.** That skill is manifest-recorded and will be deleted. Distinguishing it would require the content comparison rejected in §5. Disclosed, not handled.

## 7. Traceability

- Bug: `bug-obsolete-tool-dir-sweep-deletes-user-authored-skills.md`
- Registered: `_bmad-output/implementation-artifacts/sprint-status.yaml` → `31-16-manifest-aware-obsolete-tool-dir-sweep`
- Definition: `_bmad-output/planning-artifacts/epics.md`, Epic 31, Story 31.16 (appended; no existing story definition altered — Story 31.10's block hashes unchanged at `cb0fe3b4293af5266ffa022b4b3fab53afebd367377ffb3884a92d2984cc1e83`)
- Base: `feature/epic-31` @ `ca78f43`

---

## 8. Dev Agent Record

**Implementer:** Claude Opus 5 (dev only — review is independent, and this story is NOT set to `done`).
**Branch:** `feat/manifest-aware-sweep-impl`, off `ca78f43`, with `737ce4b` (this story + its bug) cherry-picked first so the planning artifacts travel with the implementation.

### 8.1 What changed

`lib/installer.js` only, plus this file and the test file.

- `migrateObsoleteToolDirs` — the `replacedByHasContent` branch now computes
  `owned` / `residue` and takes one of two paths. The outer gate
  (`:2396-2403`), the registry, the `noop` path and the preserve-on-empty path
  are untouched. `OBSOLETE_TOOL_SKILL_DIRS` keeps its exact contents and order.
- `OBSOLETE_SWEEP_MANIFEST_FILES` — a new module-private `Set` of the two
  bookkeeping filenames. **Deliberately not exported**: a test taking its
  expectation from it would assert the implementation against itself.
- `writeManifest` and `generateSkillsManifest` — exported (the latter already
  was) so fixtures are built by the real writers. Export-only, no new code path.

### 8.2 AC → test → outside authority

| AC | Test | Authority it binds to |
| --- | --- | --- |
| 1 | `31-16-t1` (loops the registry) | the **real filesystem** — user bytes written by the test, read back with `fs.readFileSync`, no mocked `fs` anywhere; the ma-agents side seeded by the **real writers** `ensureManifest` + `writeManifest` |
| 2 | `31-16-t2` (loops the registry) + `b2-t1`/`b2-t6`/`b2-t7` | the **shipped cleanup contract**, pre-dating this story |
| 3 | `31-16-t3` | the **shipped log literals**, transcribed from `lib/installer.js:2408-2409` and `:2415-2418`; the residue list built by the test from what the test wrote |
| 4 | `31-16-t4` (no manifest, loops the registry), `31-16-t5` (unparseable), `31-16-t6` (`skills: {}`) | a **real install measured out-of-band** (`D:\Code\Workshop`), re-derivable from `lib/installer.js:1805-1809` and `lib/profile.js:27-32` |
| 5 | `31-16-t7` | the **registry as data** — length 5, the five `obsolete` values as a set, one result per entry |
| 6 | `31-16-t8` | the registry, plus `bmad-method`'s upstream `.agent/skills` path |
| 7 | `31-16-t9`, `31-16-t10`, and `b2-t2`/`b2-t2b`/`b2-t3`/`b2-t4`/`b2-t5` | the **pre-existing test file**, written against the shipped contract |
| 8 | the mutation sweep in §8.4 | ten planted mutants |
| 9 | §8.5 | suite results, each with an exit code |
| 10 | `git diff --stat` — three files: `lib/installer.js`, `test/obsolete-tool-dirs.test.js`, this file | a path-scoped diff |

### 8.3 STORY DEFECT — AC2/AC7(b) and AC4 cannot both hold over the shipped fixtures

**This is the one thing in the story that is wrong, and it is load-bearing.**

AC2 requires `b2-t1`, `b2-t6` and `b2-t7` to pass **unmodified**, and describes
`b2-t7` as a case *"where the nesting sits inside a manifested skill directory"*.
That is not what the file contained. Measured on `ca78f43`:

- `seedProject` wrote a single loose `old-marker.md` into the obsolete dir, in
  no manifest at all (`b2-t1`, `b2-t4`).
- `b2-t7` wrote `some-skill/nested/deep-file.md`, also in no manifest.

Under AC4 an unmanifested entry is residue and the directory is preserved — so
with the algorithm implemented exactly as specified and the test file untouched,
**`b2-t1`, `b2-t4` and `b2-t7` go red**. Measured, not predicted: `5 passed,
3 failed`.

The two ACs are irreconcilable over those fixtures. The story asserts a property
of a file its author had not read.

**Resolved in the direction AC2's own text states**, because the alternative is
to keep a fixture that encodes the bug: the old `b2-t1` asserted that an
unmanifested loose file *gets destroyed*, which is precisely the defect this
story exists to fix. The obsolete directory is now seeded as one holding **only
ma-agents-installed skills**, recorded through the real writers. **Every
assertion in every `b2-*` case is byte-identical**; the change is confined to
the shared `seedProject` helper and two added lines in `b2-t7`'s body. After it:
`19 passed, 0 failed`.

A reviewer who reads AC2 literally will score this as an AC2 violation. It is
raised here rather than buried so that call is the human's, not the
implementer's. The substance of AC2 — *the fix must not disable the cleanup* — is
strictly better covered than before.

### 8.4 Mutation testing — ten mutants, zero survivors

Each mutant was applied to `lib/installer.js`, the suite run, and the original
bytes restored **from memory** (not from git) in the same step. `lib/installer.js`
hashes to `5fecc24444d0ba108de864bab21785db0cfaeb06` before and after, and
`git status --porcelain lib/` is empty.

| # | Mutant | Named test that killed it |
| --- | --- | --- |
| m1 | `residue` computed ignoring the user entries (reduces to today's behaviour) | `31-16-t1` |
| m2 | `owned` defaulted to *all* directory entries when the manifest is absent | `31-16-t4` |
| m3 | the manifest files counted as residue (cleanup dies) | `31-16-t2` |
| m4 | the manifest files counted as `owned` and deleted on the preserve path | `31-16-t10` |
| m5 | the residue names dropped from the log, preserve decision standing | `31-16-t3` |
| m6 | the per-entry loop pinned to a single entry | `31-16-t7` |
| m7 | *added* — the preserve path removes nothing at all | `31-16-t1` |
| m8 | *added* — reports `preserved-partial` but still removes the directory | `31-16-t1` |
| m9 | *added* — `MANIFEST.yaml` dropped from the excluded-files set | `31-16-t2` |
| m10 | *added* — `readManifest` called on the **replacement** dir, not the obsolete one | `31-16-t1` |

**m9 SURVIVED the first sweep** with the suite fully green, and is reported as a
real defect in the tests rather than a curiosity. No fixture wrote a
`MANIFEST.yaml`, so nothing could distinguish "both bookkeeping files excluded"
from "only `.ma-agents.json` excluded". Left unfixed, a tree carrying the derived
manifest would have preserved forever and the cleanup would have been dead for
exactly the trees ma-agents installed into. Closed by writing `MANIFEST.yaml`
through its only writer (`generateSkillsManifest`) in `31-16-t2` and `31-16-t10`.

A second methodology fault is worth recording: the first harness matched its
anchors with bare `\n` against a **CRLF** working tree, so three multi-line
mutants silently failed to apply and reported as passing-looking noise. A
0-match anchor is indistinguishable from a killed mutant if the match count is
not asserted. The harness now matches newline-agnostically and **asserts exactly
one match per anchor** before mutating.

### 8.5 Validation

**Environment note, and a trap for the reviewer.** This worktree has **no
`node_modules`**. Suites that resolve `bmad-method` by explicit path (notably
`routing-parity`) therefore die with `ENOENT … platform-codes.yaml` and report
**0/0**, which reads exactly like a regression and is not one — it is identical
on `ca78f43`, measured. Validation was run with `node_modules` junctioned from
`.worktrees/epic-31-story-31.15` (the only sibling whose `package.json` pins the
same deps and whose installed `bmad-method` is **6.10.0**; `d:\Code\AI_Agents`
has **6.9.0** and would be wrong). The junction was removed afterwards so nothing
can `npm install` through it into another worktree. To re-create it:

```powershell
New-Item -ItemType Junction `
  -Path   "D:\Code\AI_Agents-epic-31\.worktrees\impl-31-16\node_modules" `
  -Target "D:\Code\AI_Agents-epic-31\.worktrees\epic-31-story-31.15\node_modules"
```

**Invariants — every one re-derived, none moved:**

| Invariant | Pinned | Measured | Exit |
| --- | --- | --- | --- |
| preflight 41 copies / `ca9bf25b…` / 13-14-14 | — | asserted inside `release-gate-epic-31` AC7.1 | 0 |
| gate 9 copies / `cda3d3d9…` / 3-3-3 | — | asserted inside `release-gate-epic-31` AC7.2 | 0 |
| `release-gate-epic-31` | 43/0 | **43/0** | 0 |
| `story-15-5-workflow-skills` | 157/0 | **157/0** | 0 |
| `convert-agents-to-skills` | 146/0 | **146/0** | 0 |
| `bmad-module-selection` | 55/0 | **55/0** | 0 |
| `routing-parity` | 16/0 | **16/0** | 0 |
| `project-layout-staleness-guard` | 64/0 | **64/0** | 0 |
| `obsolete-tool-dirs` | 8/0 → deliberately rises | **19/0** | 0 |

**Broad run:** 103 suites, the two forbidden ones (`yes-flag`,
`project-layout-two-store-round-trip`) skipped, **2 nonzero exits, both
pre-existing and both already filed:**

- `migration-validation` **199/3** — stale skill-count assertions (`5.3`, `5.6`,
  `5.8`: *expected 63 skill folders, found 50*). **Identical 199/3 on `ca78f43`**,
  measured in isolation on both commits. Not a regression, not absorbed.
- `project-layout-artifact-routing` **58/1** (`BLOCKING-4`) — the known
  non-determinism; `_bmad-output/methodology/` residue is present in this
  worktree, which is the documented 58/1 condition. Not this story's.

`build-plugin.test.js` again leaked an untracked
`lib/.bmad-extension-plugin.build-<pid>-<ms>/`, and the broad run mutated
`.agents/`, `AGENTS.md` and `_bmad-output/project-context.md` as it always does.
All of it was reverted; `git status --porcelain` is empty and
`lib/installer.js` hashes to `5fecc24444d0ba108de864bab21785db0cfaeb06`.

### 8.6 File List

- `lib/installer.js` — modified
- `test/obsolete-tool-dirs.test.js` — modified
- `_bmad-output/implementation-artifacts/31-16-manifest-aware-obsolete-tool-dir-sweep.md` — modified (this record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified (status)

## 9. Change Log

| Date | Change |
| --- | --- |
| 2026-09-15 | Cherry-picked `737ce4b` so the story and its bug travel with the implementation. |
| 2026-09-15 | `migrateObsoleteToolDirs` made manifest-aware; `OBSOLETE_SWEEP_MANIFEST_FILES` added module-private. |
| 2026-09-15 | `b2-*` fixtures reseeded through the real manifest writers — see the story defect in §8.3. |
| 2026-09-15 | `31-16-t1`…`t11` added; all five registry entries proven per-entry. |
| 2026-09-15 | Mutation sweep: m9 survived, was reported, and was closed by covering `MANIFEST.yaml`. |
| 2026-09-15 | Status → `review`. **Not** `done` — the independent review sets that. |
