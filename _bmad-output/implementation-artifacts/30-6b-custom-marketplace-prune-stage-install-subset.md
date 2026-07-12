# Story 30.6b: Custom Marketplace Source — Prune, Stage, and Install the Selected Subset

Status: review

## Story

As a **ma-agents user who selected a subset of extensions from a custom BMAD marketplace
source** (Story 30.6a's wizard),
I want ma-agents to prune the enumerated marketplace down to exactly my selection, stage that
pruned subset locally, and install it via bmad-method's own `--custom-source` under `--yes`,
So that I get exactly the extensions I chose — no more, no less — installed offline, without
any hand-rolled git flow and without bmad-method's "auto-select all discovered" behavior
silently installing the entire marketplace.

**Scope boundary:** consumes Story 30.6a's `promptCustomMarketplace()` selection
(`{ source, mode, selectedCodes, plugins }`, extended here with `rootDir`/`sourceUrl` — see Dev
Notes). Delivers prune + stage + install-the-subset + fail-loud verification (FR238) + Cline
wrapper reconcile ONLY. Persistence (`.ma-agents.json`) and re-enumeration on update is
**Story 30.7**, out of scope here.

**Depends on:** Story 30.6a (adapter + wizard, merged to `feature/epic-30`). **Blocks:**
Story 30.7 (persist + re-enumerate on update).

**FR:** FR240 (subset install), FR242 (Cline reconcile), FR238 (fail-loud resolution guard).
**NFR:** NFR17 (pinned-internal coupling — reuses the SAME adapter/single call site as 30.6a,
adds `resolvePlugin` which 30.6a already guards in `REQUIRED_METHODS`).
**Architecture:** Decision P5-8 (`architecture.md:2592`, `:2608`).

## Acceptance Criteria

1. **Prune.** Given a 30.6a selection with `mode: 'discovery'` and `selectedCodes`, when 30.6b
   stages it, then the marketplace.json written into the local stage contains ONLY the raw
   plugin entries whose `name` is in `selectedCodes` — no other declared plugin's metadata is
   present in the stage.
2. **Stage locally.** The pruned subset's actual skill/module content (resolved via
   bmad-method's own `CustomModuleManager#resolvePlugin`, reusing the 30.6a adapter's guarded
   surface) is copied into a project-local stage directory
   (`.ma-agents-custom-marketplace-stage/`), preserving each file's path relative to the
   source's `rootDir` so bmad-method's own re-resolution against the stage reproduces the same
   result.
3. **Install via `./`-relative `--custom-source` under `--yes`.** The stage is installed by
   invoking bmad-method through the EXISTING `lib/bmad.js` machinery
   (`buildBmadArgs({ action: 'update', customSource: './<stage-dir>', ... })` +
   `runCommand`/`buildChildSpawnEnv`) — no new child-process/git logic is hand-rolled.
4. **Fail-loud verification (FR238), before staging.** Given the selected subset resolves to
   zero installable modules, OR any resolved module has zero skill directories, OR any single
   resolved module has two skill directories sharing the same leaf (basename), THEN
   `stageCustomMarketplaceSubset` throws a `CustomMarketplaceError` with a clear message BEFORE
   any file is copied or bmad-method is invoked — mirroring (pre-empting, with a friendlier
   message) bmad-method 6.10.0's `_copyResolvedSkills` fail-loud guards.
5. **Cline reconcile.** After a successful custom-subset install, `deployClineWorkflows` is
   re-run for the current `tools` list so any newly-installed custom module's Cline workflow
   wrappers are generated/reconciled the same way official-module installs already do.
6. **Base-install gate.** If the preceding base BMAD install/update step (Step 3.5) did not
   leave a usable BMAD installation (declined, or attempted and reported failure), the
   custom-source install is skipped with a clear message — it never attempts to layer
   `--custom-source` onto a project with no (or a broken) `_bmad/` tree.
7. **Direct mode.** A direct-mode selection (no `marketplace.json` at the source root) is
   staged too: since bmad-method's own `PluginResolver.resolve()` returns `[]` for a plugin
   object with an empty `skills` array (which is what 30.6a's synthetic direct-mode plugin
   carries), 30.6b re-scans the source root for immediate subdirectories containing `SKILL.md`
   (mirroring bmad-method's own `_resolveCustomSourcesCli` direct-mode branch) before calling
   `resolvePlugin`, and synthesizes a marketplace.json for the stage (there is no original to
   prune).
8. **Stage cleanup.** On a successful install, the stage directory is removed (mirrors
   `lib/bmad.js#cleanupStage`'s existing policy). On failure, it is left in place for operator
   diagnosis.

## Tasks

- [x] `lib/custom-marketplace.js` — `CUSTOM_MARKETPLACE_STAGE_DIR_NAME`,
  `scanDirectModeSkillDirs()`, `resolveSelectedPlugins()`,
  `assertResolutionNonEmptyAndUniqueLeaves()`, `stageCustomMarketplaceSubset()`.
- [x] `lib/bmad.js` — `installCustomMarketplaceSubset()` (lazy-requires
  `./custom-marketplace`, stages, builds args via `buildBmadArgs`, runs via
  `runCommand`/`buildChildSpawnEnv`, reconciles Cline wrappers, cleans up stage on success).
- [x] `bin/cli.js` — `promptCustomMarketplace()` return shape extended with `rootDir` +
  `sourceUrl` (additive; existing 30.6a tests only assert individual fields, not full-object
  equality). Step 3.5 tracks `baseBmadOk`; Step 3.5b replaces the "captured but not staged" log
  with an `installCustomMarketplaceSubset` call gated on `baseBmadOk`.
- [x] Tests: prune correctness, non-empty+unique-leaf fail-loud (run against bmad-method
  6.10.0, `--no-save`), install-args shape, base-install-failed short-circuit, Cline-wrapper
  reconcile, direct-mode staging.

## Dev Notes

- **Why extend 30.6a's return shape rather than re-enumerate:** re-running
  `enumerateCustomSource` a second time would re-clone Git sources and could observe a
  different marketplace state than what the user actually selected against. Carrying
  `rootDir`/`sourceUrl` forward from the ONE enumeration in `promptCustomMarketplace` (30.6a)
  keeps "what the user saw" and "what gets staged" consistent.
- **Why per-module (not global) leaf-uniqueness:** `bmad-method@6.10.0`'s
  `_copyResolvedSkills` (`tools/installer/modules/official-modules.js`) throws on a duplicate
  skill leaf **within one `ResolvedModule`** (skills flatten into the SAME module's target
  dir); a leaf name reused ACROSS two different modules is fine (each module installs to its
  own `bmadDir/<code>/`). 30.6b's guard mirrors that exact scope.
- **Why `_copyResolvedSkills`'s "empty resolution throws" does not literally fire for custom
  modules:** that specific throw path (`official-modules.js` `install()`, `~line 292`) is
  scoped to OFFICIAL marketplace-plugin-registry modules; the CUSTOM-module path
  (`installFromResolution`) has no equivalent guard — an empty resolution there would silently
  install a no-op empty module directory. 30.6b's own pre-flight check is therefore a
  deliberate ma-agents-level hardening (FR238's intent), not a literal trigger of the upstream
  guard.
- **`./`-relative staging (spike §3):** identical rationale to `lib/bmad.js#stagePlugin` — a
  bare Windows absolute path is rejected by `parseSource()`; `./<dir>` resolves correctly
  because bmad-method's cwd is always `projectRoot`.
- **Re-run the 6.10.0 verification** after Story 30.3 bumps the pin (currently 6.9.0). The
  drift/smoke coverage from 30.6a already re-verifies the adapter surface on every pin.

## Testing

Run each file directly (all terminate in seconds; the 6.10.0-specific test installs that
version with `--no-save` and does not touch the committed pin):

```
node test/custom-marketplace-stage-install.test.js
npm run build:plugin
```
