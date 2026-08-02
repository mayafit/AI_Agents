---
type: bug
severity: medium
title: A Project-level install still leaves a root skills/ directory holding empty planning-artifacts, implementation-artifacts and test-artifacts — bug 27.14's prune is unreleased and never runs on the update path
---

# Bug: A Project-level install still leaves a root `skills/` directory holding empty artifact dirs — bug 27.14's prune is unreleased and never runs on the update path

**Status:** backlog
**Severity:** medium
**Affected Component:** `lib/bmad.js` (`normalizeModuleOutputFolders` / `pruneOrphanedArtifactDirs` call-site coverage); `lib/bmad-cache/bmb/skills/module.yaml` (the contaminating value); upstream `bmad-method` `resolveConfigValue` suffix match
**Classification:** CODE FIX + a release. Continuation of bug **27.14**, whose work-around is incomplete.

## Summary

A user installing at Project scope — **not** "Custom path" — got a `skills/`
directory at the project root. It is **not** the custom-path prompt, **not** the
ma-agents extension plugin, and **not** a `ma-skills` module. It is the **bug 27.14
output-folder contamination**, still reproducing.

bmb's own output folder is legitimately `{project-root}/skills`. Upstream's
`{output_folder}` token resolution falls back to a **suffix match** over all
collected answers, and bmb's answer key `bmb_bmad_builder_output_folder` ends with
`_output_folder` — so **other** modules' `{output_folder}` resolves to `skills`.
Those modules then declaratively create their artifact directories, producing
`<root>/skills/planning-artifacts`, `<root>/skills/implementation-artifacts` and
(via tea) `<root>/skills/test-artifacts`.

Bug 27.14's work-around repaired the **config**; PR #143 / commit `9dc2d5f` added a
**directory prune**. Neither is sufficient today, for four separate reasons
enumerated below — the most important being that **the prune is unreleased** and
**`updateBmad` never calls the normalization pass at all**.

## Reproduction Steps

1. `npx ma-agents install` (v3.17.1 or earlier) into a clean project; choose
   **Project** scope; select GitHub Copilot and Cline; do **not** choose "Custom
   path"; do **not** pass `--bmad-modules`.
2. Accept the BMAD-METHOD install prompt. The default module set is
   `bmm,tea,bmb,cis,gds,wds` (see the sibling bug on FR123).
3. Watch the installer's config summary — it prints two different artifact roots:
   ```
   282:│    planning artifacts: _bmad-output/planning-artifacts
   283:│    implementation artifacts: _bmad-output/implementation-artifacts
   ...
   286:│    planning artifacts: skills/planning-artifacts
   287:│    implementation artifacts: skills/implementation-artifacts
   ```
   (`d:\Code\Workshop\install_2026-07-13_19-23-02-272.log:282-287`)
4. Observe `<root>/skills/` containing `planning-artifacts/` and
   `implementation-artifacts/`, both empty.
5. Re-run the installer on the same project (now an **update**) and observe the
   directories are still there.

Confirmed on three real installs: `d:\Code\Workshop\skills\` and
`d:\Code\EltEye\skills\` (planning-artifacts, implementation-artifacts);
`d:\Code\Prophesys\skills\` (those two plus `test-artifacts`).
`find <root>/skills -type f` returns **zero files** in all three.

## Expected Behavior

A Project-scope install writes planning and implementation artifacts under the
canonical `_bmad-output/` output folder only. No `skills/` directory appears at the
project root unless the user explicitly asked for one (custom output path, or a
deliberate bmb build).

## Actual Behavior — the full chain

All citations verified against **bmad-method 6.10.0** (the version pinned at
`package.json:35`). *Note: `d:\Code\AI_Agents\node_modules\bmad-method` on disk is a
stale **6.9.0** copy whose line numbers differ — do not cite it.*

1. **The contaminating value.** `lib/bmad-cache/bmb/skills/module.yaml:12-15`
   declares `bmad_builder_output_folder` with `default: "{project-root}/skills"`
   (and `:17-20` `bmad_builder_reports` → `{project-root}/skills/reports`). This is
   bmb's *intended* own folder and is not itself a bug.
2. **The suffix-match bleed.** `official-modules.js:1812` `resolveConfigValue()`;
   when no exact value is found it iterates every collected answer and accepts the
   first key that ends with `_<configKey>`:
   ```js
   1818:        if (answerKey.endsWith(`_${configKey}`)) {
   ```
   (loop at `:1816-1822`). Resolving `{output_folder}` therefore matches
   `bmb_bmad_builder_output_folder` → `skills`. Two more copies of the identical
   loop exist at `official-modules.js:1437` and `:1682`. Modules resolve
   alphabetically, so bmb precedes gds; bmm escapes only because it resolves first.
3. **The consumers.** `lib/bmad-cache/gds/src/module.yaml:35` and `:40` default
   `planning_artifacts` / `implementation_artifacts` to `"{output_folder}/…"`; tea
   does the same for `test_artifacts`.
4. **The physical creation.** Each module declares a `directories:` block that the
   installer materialises:
   - `lib/bmad-cache/gds/src/module.yaml:68-71` — `{planning_artifacts}`,
     `{implementation_artifacts}`, `{project_knowledge}`
   - `lib/bmad-cache/tea/src/module.yaml:306-307` — `{test_artifacts}`
   - upstream `bmm-skills/module.yaml:44-47` — the same three bmm keys

   `createModuleDirectories()` (`official-modules.js:595`) reads that list and calls
   **`await fs.ensureDir(fullPath)` at `official-modules.js:738`**. That is the exact
   call that creates `<projectRoot>/skills/planning-artifacts`.

   bmb itself has **no** `directories:` key — it never creates `skills/` directly. It
   only poisons the token the other modules expand.

## Why the existing 27.14 work-around does not stop it

`lib/bmad.js` in this branch DOES carry the fix — `dirIsFileless` (`:2213-2225`),
`pruneOrphanedArtifactDirs` (`:2245-2294`), `normalizeModuleOutputFolders`
(`:2311-2385`, prune invoked at `:2374`). Four gaps keep the symptom alive:

**Gap 1 — the prune is UNRELEASED.** Commit `9dc2d5f` ("fix(installer): prune
orphaned artifact dirs left by bug 27.14 work-around", PR #143) landed on `main`
**2026-07-18**. The newest CHANGELOG entry is `## [3.17.1] - 2026-07-16`, and
`git tag --contains 9dc2d5f` is empty (latest tags `v3.17.0`, `v3.16.0`). **Every
npm user is on 3.17.1 or earlier and has the config rewrite but not the prune.**

**Gap 2 — `updateBmad` never normalizes.** `normalizeModuleOutputFolders` is called
from exactly two places: `lib/bmad.js:886` (inside `installBmad`, `:822-…`) and
`lib/bmad.js:995` (inside `runMigration`, `:924-1026`). **`updateBmad`
(`lib/bmad.js:1027-1118`) does not call it.** `bin/cli.js:1520` and `:1535` route
every re-run on a project that already has `_bmad/` to `updateBmad`, so neither
normalization nor prune ever runs again after the first install.

**Gap 3 — the prune is non-retroactive.** The `orphans` set is populated *only*
inside the "this value was rewritten" branches — `lib/bmad.js:2145` (TOML) and
`:2183` (YAML). On a project whose config is already canonical (because a prior run
repaired it, as in Workshop / Prophesys / EltEye today) `changed === 0`, the set is
empty, and `pruneOrphanedArtifactDirs` iterates nothing. **Existing litter is never
cleaned, only newly-created litter would be.**

**Gap 4 — the custom-marketplace pass re-runs config generation unguarded.**
`installCustomMarketplaceSubset` invokes bmad-method a second time with
`--action update` (`lib/bmad.js:1774`) and has no normalization or prune afterwards.

Secondary, and by design rather than a defect: `OUTPUT_FOLDER_ARTIFACT_KEYS`
(`lib/bmad.js:2054-2059`) covers `planning_artifacts`, `architecture_artifacts`,
`implementation_artifacts`, `test_artifacts`, and the comment at `:2049-2053`
deliberately excludes bmb's own keys, `design_artifacts` and `project_knowledge`.
That exclusion is correct — but it means the `skills/` **parent** survives whenever
an uncovered sibling remains, since the ancestor loop (`lib/bmad.js:2271-2289`)
only removes a parent whose `fs.readdirSync` is empty. Likewise `dirIsFileless`
(`:2213-2225`) returns false on any non-directory entry, so a single `.gitkeep`
defeats it.

## Load-bearing or litter? — LITTER (with one caveat)

- The three subdirectories are **file-free on every real install checked** and
  duplicate the canonical `_bmad-output/` tree.
- Nothing in `bin/` or `lib/` reads `<projectRoot>/skills` on the install or runtime
  path. The only writer is `lib/skill-authoring.js` (`:57`, `:189`, `:325` —
  `skillsDir || path.join(process.cwd(), 'skills')`), reachable only from the
  explicit create-skill / create-agent commands wired at `bin/cli.js:44`.
- **Caveat:** the `skills/` **parent** is a live bmb config value
  (`d:\Code\Prophesys\_bmad\bmb\config.yaml:6-7`,
  `d:\Code\Prophesys\_bmad\config.toml:40-41`). Running `bmad-agent-builder` /
  `bmad-workflow-builder` would write real output there. So the parent may be
  removed **only while empty** — which is exactly what
  `pruneOrphanedArtifactDirs` already guards.
- Ruled out with evidence, so it is not re-investigated:
  - *plugin materialisation* — `installFromResolution()`
    (`official-modules.js:381`) targets `const targetPath = path.join(bmadDir, resolved.code)`
    (`:382`), i.e. `_bmad/ma-skills/`, never the project root. (It is also the caller
    of `createModuleDirectories`, at `:392`.) Confirmed: `d:\Code\Prophesys\_bmad\ma-skills\`
    exists and holds the plugin content; `d:\Code\Prophesys\skills\` holds none of it.
  - *a `ma-skills` module* — `lib/bmad-extension-plugin/skills/module.yaml` has no
    `directories:` key and no output-folder keys.
  - *an ma-agents copy step* — there is no `path.join(projectRoot, 'skills')`
    anywhere in `bin/`, `lib/` or `scripts/`; `lib/installer.js:1364` and `:1396`
    join `__dirname, '..', 'skills'` (the npm package's own skill catalog).
  - *the custom-path prompt* (`bin/cli.js:1434`) and *`lib/bmad.js:118`* — already
    ruled out in the report; re-confirmed.
  - Root `skills/` in **`d:\Code\AI_Agents`** is the git-tracked ma-agents source
    catalog (`git ls-files skills` → 150 files), **not** install litter. Do not use
    the ma-agents repo as evidence for this bug.

## Blast Radius

- Every Project-scope install whose module set includes **bmb together with any of
  bmm/gds/tea** — which today is *every default install*, because FR123 installs all
  five bundled modules.
- Effect is litter, not breakage: empty directories at the project root that shadow
  the canonical `_bmad-output/` layout and mislead anyone reading the tree.
- Not gitignored, so commit-eligible.
- Aggravating: because of Gap 2 the litter is **permanent** — no subsequent
  installer run will ever clean it.

## Affected Files

- `lib/bmad.js` — `installBmad` normalize call (`:886`); `runMigration` normalize
  call (`:995`); `updateBmad` with **no** call (`:1027-1118`);
  `installCustomMarketplaceSubset`'s second bmad invocation (`:1774`);
  `OUTPUT_FOLDER_ARTIFACT_KEYS` + its exclusion comment (`:2049-2059`);
  `orphans.add` sites (`:2145` TOML, `:2183` YAML); `dirIsFileless` (`:2213-2225`);
  `pruneOrphanedArtifactDirs` (`:2245-2294`, ancestor loop `:2271-2289`);
  `normalizeModuleOutputFolders` (`:2311-2385`, prune at `:2374`); the upstream
  follow-up note (`:2044-2047`)
- `bin/cli.js` — install vs update routing (`:1490-1545`, update branches at `:1520`
  and `:1535`)
- `lib/bmad-cache/bmb/skills/module.yaml:12-15`, `:17-20` — the contaminating values
- `lib/bmad-cache/gds/src/module.yaml:35`, `:40`, `:68-71`
- `lib/bmad-cache/tea/src/module.yaml:306-307`
- upstream `bmad-method@6.10.0 tools/installer/modules/official-modules.js` —
  `resolveConfigValue` (`:1812`), suffix match (`:1816-1822`, predicate at `:1818`;
  duplicates at `:1437`, `:1682`), `createModuleDirectories` (`:595`),
  `fs.ensureDir` (`:738`)
- `test/output-folder-normalization.test.js` — existing coverage to extend
- `_bmad-output/implementation-artifacts/27-14-output-folder-propagation-normalize-module-paths.md`
  — the parent bug

## Suggested Fix

1. **Release the prune.** Cut a patch release carrying `9dc2d5f`. Nothing else in
   this list helps a user on npm until that ships.
2. **Close the update-path gap.** Call `normalizeModuleOutputFolders(projectRoot)`
   from `updateBmad` at the same point `installBmad` does (immediately after the
   bmad-method `runCommand` succeeds, before `deployMethodology` /
   `deployClineWorkflows`), and again after the custom-marketplace
   `--action update` invocation at `lib/bmad.js:1774`.
3. **Make the prune retroactive.** Decouple pruning from "a value was rewritten this
   run": derive the candidate orphan locations from the *contaminating* values still
   present in config (e.g. bmb's `bmad_builder_output_folder`) crossed with
   `OUTPUT_FOLDER_ARTIFACT_KEYS`, so an already-normalized project still gets its
   stale directories swept. Keep every existing safety rail — fileless-subtree only,
   never the canonical output folder, never bmb's own folder when non-empty, never
   escaping the project root.
4. **Consider eliminating the cause rather than the symptom.** Story 27.14's own
   "Proposed Direction 1 (preferred)" — do not co-install bmb by default — would
   remove the contamination for the default install entirely. That overlaps the
   FR123 default-set change (see `bug-wds-installed-by-default-creates-design-artifacts.md`);
   the two should be sequenced together.
5. **Upstream follow-up** (already noted at `lib/bmad.js:2044-2047`): file a
   bmad-method issue/PR to require an exact `output_folder` / `core_output_folder`
   key instead of the `endsWith` suffix match, in all three copies of the loop.

## Acceptance Criteria

1. A fresh Project install with the default module set produces **no**
   `<root>/skills/` directory; `_bmad-output/planning-artifacts` and
   `_bmad-output/implementation-artifacts` exist as today.
2. Re-running the installer on a project that already has
   `skills/planning-artifacts`, `skills/implementation-artifacts` and
   `skills/test-artifacts` (all empty) removes all three **and** the now-empty
   `skills/` parent — i.e. the prune is retroactive and reaches the update path.
3. A project whose `skills/` contains real bmb output (any file anywhere in the
   subtree) is left completely untouched — pinned by test.
4. `skills/planning-artifacts/.gitkeep` (a single non-directory entry) blocks removal
   of that directory; document the behaviour and assert it.
5. The canonical output folder is never removed, and no removal escapes the project
   root (existing guards re-asserted by test).
6. Running the installer twice in a row is idempotent — the second run reports zero
   normalizations and zero prunes.
7. A custom `--output-folder` install with bmb + gds + tea co-installed resolves all
   module artifact paths to the custom folder and creates no `skills/` litter
   (extends the 27.14 test).
8. The fix ships in a tagged release, and CHANGELOG names it.

## PRD Amendment Needed

**No.** This is a code fix plus a release. The requirement it serves is already
stated in Story 27.14 ("when the user selects a custom output folder at install
time, every module's artifact paths must use it"). If the team instead adopts
Suggested Fix 4 (drop bmb from the default set), *that* part is a requirements
change and belongs to the FR123 amendment tracked in
`bug-wds-installed-by-default-creates-design-artifacts.md` — not to this story.

## Provenance

- Reported 2026-08-02 from a clean Project-scope install (GitHub Copilot + Cline).
- Parent bug: **27.14** (`27-14-output-folder-propagation-normalize-module-paths.md`,
  severity high, ARCHITECTURE + UPSTREAM), work-around option 2 shipped in v3.13.1
  (PRs #116/#117).
- Directory prune added by commit `9dc2d5f` (PR #143, 2026-07-18) — **unreleased**.
- Evidence installs: `d:\Code\Workshop` (2026-07-13, with install log),
  `d:\Code\EltEye` (2026-07-03), `d:\Code\Prophesys` (2026-05-08).
- Severity rationale: **Medium**. No data loss and no failed install, but it is a
  visible, permanent, misleading artifact at the root of every default install, the
  shipped mitigation does not reach it, and the fix that would is sitting unreleased
  on `main`.

## Notes

- Created via `create-bug-story` workflow
- This is a bug REPORT, not a fix — `lib/` and `bin/` source are intentionally untouched
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
