---
type: bug
severity: low
title: An empty docs/ directory is created at the project root on every install — bmm declares project_knowledge as a directory to materialise, nothing writes to it, and nothing reads it
---

# Bug: An empty `docs/` directory is created at the project root on every install

**Status:** backlog
**Severity:** low
**Affected Component:** upstream `bmad-method` `bmm-skills/module.yaml` (`project_knowledge` + its `directories:` entry) materialised by `createModuleDirectories()`; ma-agents has no post-install prune for it
**Classification:** CODE FIX (ma-agents-side prune) — becomes a REQUIREMENTS CHANGE only if the team chooses to relocate `project_knowledge` instead

## Summary

A clean Project-scope install (GitHub Copilot + Cline only) creates an empty
`docs/` directory at the project root. The user's position is that it should not be
created by default.

`_bmad/bmm/config.yaml` setting `project_knowledge: "{project-root}/docs"` was the
starting lead, but **configuring a path is not what creates the directory**. The
creator is a declarative `directories:` block in the module definition, materialised
by upstream's installer. Because the declaring module is **bmm** — which is
force-included in every install path — `docs/` is created on **every** install,
regardless of module selection.

Two things were checked specifically and both came back negative:

- **Nothing writes into it during install.** `d:\Code\Prophesys\docs\` is completely
  empty. `d:\Code\Workshop\docs\` contains only `band-profiles/` and `songbook/`,
  both from the **suno** module installed via the opt-in custom marketplace — not
  from the base install. `d:\Code\EltEye\docs\` contains three hand-written `.md`
  files (user content).
- **Nothing reads `project_knowledge`.** In particular the Knowledge Atlas does
  **not** consume it — see the correction below.

## Reproduction Steps

1. `npx ma-agents install` into a clean project, **Project** scope, GitHub Copilot
   and Cline only.
2. Accept the BMAD-METHOD install prompt.
3. Observe the installer's config summary print `project knowledge: docs`
   (`d:\Code\Workshop\install_2026-07-13_19-23-02-272.log:284`).
4. Observe an empty `docs/` at the project root, and
   `project_knowledge: "{project-root}/docs"` in `_bmad/bmm/config.yaml`
   (`d:\Code\Workshop\_bmad\bmm\config.yaml:9`).

## Expected Behavior

A base install should not create a top-level directory it never writes to and never
reads. `project_knowledge` may remain **configured** — the value is a legitimate
answer to "where should long-term project knowledge live" — but the directory should
appear when something first writes to it, not at install time.

## Actual Behavior — the creator

All citations against **bmad-method 6.10.0** (pinned at `package.json:35`).

1. **The declaration.** Upstream `src/bmm-skills/module.yaml:38-41`:
   ```yaml
   project_knowledge: # Artifacts from research, document-project output, other long lived accurate knowledge
     prompt: "Where should long-term project knowledge be stored? (docs, research, references)"
     default: "docs"
     result: "{project-root}/{value}"
   ```
2. **The materialisation instruction.** The very next block,
   `src/bmm-skills/module.yaml:43-47`:
   ```yaml
   # Directories to create during installation (declarative, no code execution)
   directories:
     - "{planning_artifacts}"
     - "{implementation_artifacts}"
     - "{project_knowledge}"
   ```
3. **The mkdir.** `createModuleDirectories()`
   (`tools/installer/modules/official-modules.js:595`) walks that list, resolves each
   `{var}` against the module's collected config, strips the `{project-root}/`
   prefix, and calls **`await fs.ensureDir(fullPath)` at
   `official-modules.js:738`**. That is the exact call that creates
   `<projectRoot>/docs`.
4. **It is unavoidable today.** bmm is force-included in every module-selection path
   (`bin/cli.js:884-887` and `bmad.resolveBmadModules`), and bmm is where the
   declaration lives. Two bundled modules declare `{project_knowledge}` as well —
   `lib/bmad-cache/gds/src/module.yaml:68-71` and
   `lib/bmad-cache/wds/src/module.yaml:126-128` — so **narrowing the default module
   set (the sibling wds bug) does NOT stop `docs/` from being created.** These are
   two independent defects that happen to share a mechanism.

## What depends on `project_knowledge` resolving to an existing directory? — NOTHING in ma-agents

- **ma-agents-owned code: zero consumers.** A grep across `bin/`, `lib/`, `skills/`
  and `scripts/` (excluding the vendored `lib/bmad-cache/`) finds exactly one
  occurrence of `project_knowledge`, and it is a comment: `lib/bmad.js:2052`, listing
  it among the keys the 27.14 output-folder normalization **deliberately excludes**.
- **CORRECTION to the reported premise.** The report stated that
  "`knowledgebase_path: "."` and `project_knowledge` are both consumed by the Atlas
  engine's config-aware source discovery (Story 29.7)". **That is true only of
  `knowledgebase_path`.** `resolveKnowledgeSources()`
  (`lib/knowledge-atlas/src/scan/config.ts:150-215`) reads exactly four keys —
  `output_folder` (`:159`), `planning_artifacts` (`:160`), `implementation_artifacts`
  (`:162`), `knowledgebase_path` (`:164`). `project_knowledge` is never read anywhere
  in `lib/knowledge-atlas/src/`.
- **And the Atlas tolerates a missing directory anyway.** `readBmmConfig`
  (`scan/config.ts:108-121`) returns `null` on a missing/unreadable/malformed config
  and never throws; each configured source is added only `if (v && fs.existsSync(v))`
  (`scan/config.ts:178`), so a non-existent path is silently skipped rather than
  erroring.
- The only real consumers are **BMAD workflow skills** (research output,
  `bmad-document-project`, etc.), which write there on demand and would create the
  directory themselves at first write.

## Root Cause

Upstream's `directories:` mechanism is **eager**: every configured artifact path is
materialised at install time whether or not the corresponding workflow ever runs. For
`{planning_artifacts}` / `{implementation_artifacts}` that is harmless (they live
under `_bmad-output`, which is tracked project knowledge by design, FR58). For
`{project_knowledge}` it plants a top-level `docs/` in every project.

ma-agents already owns a precedent for cleaning up eagerly-created directories it did
not want — `pruneOrphanedArtifactDirs` (`lib/bmad.js:2245-2294`), added by commit
`9dc2d5f` for exactly this class of problem — but `project_knowledge` is explicitly
outside its key set (`lib/bmad.js:2049-2059`).

## Fix Shape: "don't create" (prune), not "don't configure"

Assessed against the three options in the report:

- **"Don't configure"** — rejected. The config value is meaningful and harmless, BMAD
  workflows resolve their output location from it, and blanking it would break
  `bmad-document-project` and the research workflows. It is also an upstream default
  ma-agents does not own.
- **"Configure but create lazily on first write"** — the correct behaviour, but it
  lives in upstream's `createModuleDirectories()` and in each workflow. Worth filing
  upstream; not actionable inside ma-agents today.
- **"Don't create" (post-install prune)** — the ma-agents-owned fix. Sweep an
  **empty** `<projectRoot>/<project_knowledge>` after the bmad-method invocation,
  reusing `dirIsFileless` (`lib/bmad.js:2213-2225`) and the existing safety rails
  (fileless subtree only, never escape the project root, never the canonical output
  folder). This is the same shape as the bug-27.14 prune and should be built on the
  same helper.

Two hard requirements on that prune:
1. It must be **fileless-only**, so a project that already keeps real documentation in
   `docs/` (like `d:\Code\EltEye`) is never touched.
2. It must run on **both** the install and update paths — note that
   `normalizeModuleOutputFolders` today is called only from `installBmad`
   (`lib/bmad.js:886`) and `runMigration` (`:995`), **not** from `updateBmad`
   (`:1027-1118`). Fixing that gap is shared with the root-`skills/` bug and should
   be done once.

## Blast Radius

- **Every install, every scope, every module selection** — bmm is always installed.
- Effect is cosmetic: one empty, untracked, un-gitignored directory at the project
  root of every ma-agents project. It is commit-eligible and, being named `docs/`,
  is easily mistaken for real project documentation.
- Risk of a careless fix is higher than the bug: `docs/` is a conventional directory
  name, so any prune that is not strictly fileless could delete a user's real
  documentation. The acceptance criteria below are deliberately weighted toward that.

## Affected Files

- upstream `bmad-method@6.10.0 src/bmm-skills/module.yaml` — `project_knowledge`
  (`:38-41`), `directories:` (`:43-47`)
- upstream `bmad-method@6.10.0 tools/installer/modules/official-modules.js` —
  `createModuleDirectories` (`:595`), `fs.ensureDir` (`:738`)
- `lib/bmad-cache/gds/src/module.yaml:68-71` and
  `lib/bmad-cache/wds/src/module.yaml:126-128` — the two bundled modules that also
  declare `{project_knowledge}`
- `lib/bmad.js` — `OUTPUT_FOLDER_ARTIFACT_KEYS` and its exclusion comment
  (`:2049-2059`); `dirIsFileless` (`:2213-2225`) and `pruneOrphanedArtifactDirs`
  (`:2245-2294`) to reuse; `normalizeModuleOutputFolders` call sites (`:886`, `:995`)
  and the missing `updateBmad` call (`:1027-1118`)
- `lib/knowledge-atlas/src/scan/config.ts` — `readBmmConfig` (`:108-121`),
  `resolveKnowledgeSources` (`:150-215`), the four keys read (`:159`, `:160`, `:162`,
  `:164`), existence gate (`:178`) — **cited as evidence of NO dependency**
- `bin/cli.js:884-887` — bmm force-inclusion rationale

## Acceptance Criteria

1. A fresh Project-scope install into a clean project leaves **no** empty `docs/` at
   the project root.
2. `_bmad/bmm/config.yaml` still contains `project_knowledge: "{project-root}/docs"`
   — the configuration is unchanged; only the eager directory is removed.
3. A project that already has `docs/` containing **any file at any depth** is left
   completely untouched (pinned by test, including a file nested several levels
   down and a `docs/.gitkeep`-only case).
4. A project whose `project_knowledge` was answered to a **custom** path gets the
   same treatment at that path, and never at a hardcoded `docs`.
5. The prune never removes the canonical output folder, never removes a directory
   outside the project root, and never follows a symlink out of it.
6. The prune runs on the update path as well as the install path, and is idempotent
   across consecutive runs.
7. A BMAD workflow that writes project knowledge (e.g. `bmad-document-project`) still
   works with `docs/` absent — it creates the directory on first write.
8. Knowledge Atlas generation is unaffected with `docs/` absent (regression test over
   `resolveKnowledgeSources`), confirming the no-dependency finding.

## PRD Amendment Needed

**No — for the recommended fix.** No FR or NFR requires `docs/` to exist. FR58 covers
`_bmad-output/` being tracked project knowledge, which is a different path.
`project_knowledge` appears in no live FR text, and the Knowledge Atlas requirements
(FR215-FR234, Story 29.7) are satisfied by `knowledgebase_path` /
`planning_artifacts` / `implementation_artifacts`, none of which change.

**Yes — only if the team instead chooses to relocate `project_knowledge`** (e.g.
under `_bmad-output/`). That would change where BMAD workflows write research and
document-project output, would interact with FR119 (artifact paths resolve from
config) and with the Epic 31 / F26 two-store split (FR255-FR257, FR264 — which
already re-opens the config field set), and must go to the PM rather than be decided
in an implementation story. **The PRD has deliberately not been amended here.**

## Provenance

- Reported 2026-08-02 from a clean Project-scope install (GitHub Copilot + Cline).
- Evidence installs: `d:\Code\Prophesys` (`docs/` empty), `d:\Code\Workshop`
  (`docs/` holds only opt-in suno output), `d:\Code\EltEye` (`docs/` holds real user
  documentation — the case the prune must not touch).
- Shares its creation mechanism with the root-`skills/` bug
  (`bug-root-skills-dir-orphaned-artifact-dirs-on-install.md`) and with the wds
  `design-artifacts/` bug — all three go through upstream's `directories:` block and
  `official-modules.js:738`. They are three distinct defects, but a single prune
  helper and a single `updateBmad` call-site fix serve all three.
- Corrected premise recorded above so it is not re-propagated: the Knowledge Atlas
  does **not** consume `project_knowledge`.
- Severity rationale: **Low**. Cosmetic, no data loss, no broken install, nothing
  depends on it. Kept as a real bug because it happens on 100% of installs and the
  directory name invites confusion.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/` source and the PRD are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
