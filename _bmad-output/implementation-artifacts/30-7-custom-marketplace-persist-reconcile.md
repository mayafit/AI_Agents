# Story 30.7: Custom Marketplace Source — Persist Selection + Re-enumerate/Reconcile on Update

Status: review

## Story

As a **ma-agents user who has already installed a subset of extensions from a custom BMAD
marketplace source** (Story 30.6a/30.6b),
I want ma-agents to remember which marketplace I used and which extensions I picked, and to
re-check that marketplace for changes whenever I run `update`,
So that I do not have to re-answer the custom-source prompt on every update, I find out about
newly-published extensions without them being installed behind my back, and a temporarily
unreachable marketplace never costs me my existing selection.

**Scope boundary:** consumes Story 30.6b's `installCustomMarketplaceSubset()` (which itself
consumes 30.6a's `promptCustomMarketplace()` selection, extended with `rootDir`/`sourceUrl`).
This story adds ONLY: (a) persistence of the source + selection (+ a SHA pin for Git-URL
sources) into `.ma-agents.json` on a successful custom-marketplace install, and (b) an
update-time re-enumerate + reconcile path that supersedes the plain Y/N prompt when a prior
selection is on file. No new install mechanics, no new staging logic — reuses 30.6a's
`enumerateCustomSource()` and 30.6b's `installCustomMarketplaceSubset()` unchanged.

**Depends on:** Story 30.6b (prune + stage + install-the-subset, merged to `feature/epic-30`).
**Completes:** the custom-marketplace source feature chain (30.6a → 30.6b → 30.7).

**FR:** FR242 (persist marketplace URL/path + selected codes; re-resolve and re-enumerate on
update). **NFR:** NFR17 (reuses the same pinned-internal adapter/single call site — no new
deep-require). **Architecture:** Decision P5-8 (`architecture.md:2592`, `:2608`).

## Acceptance Criteria

1. **Persist on install.** Given a successful `installCustomMarketplaceSubset()` call, when it
   returns, then `.ma-agents.json` records the marketplace **source** (the original user input:
   local path or Git URL), the resolved **sourceUrl** (Git sources) or `null` (local), the
   **mode** (`discovery`/`direct`), the **selected extension codes**, and — for Git-URL
   sources — the resolved commit **SHA** captured by bmad-method's own `cloneRepo()`
   (`.bmad-source.json`, surfaced on each `resolvePlugin()`-resolved module as `cloneSha`).
   Local-path sources persist `sha: null` (no commit concept applies). All other
   `.ma-agents.json` fields (`profile`, `bmadModules`, `notices`, ...) are preserved untouched.
2. **Re-enumerate + reconcile on update.** Given a project with a persisted custom-marketplace
   selection and no explicit `--bmad-custom-source` override on this run, when the installer
   reaches Step 3.5b during an `update` action, then it re-enumerates the **persisted source**
   (not a new prompt) and reconciles the fresh plugin list against the persisted
   `selectedCodes`: it reports which codes are **added** (declared now but not previously
   selected) and which are **removed** (previously selected but no longer declared). This
   REPLACES the plain Y/N prompt for this run only when a persisted selection exists and no
   `--bmad-custom-source` flag was given; an explicit flag always takes precedence (fresh
   engagement via the normal 30.6a prompt path).
3. **Newly-appeared extensions are never auto-selected.** Given the reconcile in AC 2 finds one
   or more added codes, when the subsequent install proceeds, then only the previously-selected
   codes that are STILL declared (`stillPresent`) are passed to `installCustomMarketplaceSubset`
   — added codes are reported to the console only, never included in `selectedCodes`.
4. **Unreachable/missing marketplace fails loud, selection is untouched.** Given the persisted
   source cannot be re-enumerated (network down, path removed, auth revoked, drifted adapter
   surface), when `update` runs, then a clear, visible error is printed (never a raw stack), the
   custom-marketplace step is skipped for this run ONLY, and — critically — no write to
   `.ma-agents.json` occurs: the previously persisted `source`/`selectedCodes`/`sha` are left
   exactly as they were, so the next successful `update` picks up where the user left off. The
   rest of the install/update is unaffected (mirrors the existing 30.6a fail-clean contract).
5. **Extensible v1 schema.** The persisted shape is a single object under a dedicated
   `.ma-agents.json` key (not reusing `bmadModules` or `profile`), scoped so a future
   multi-source design can introduce a sibling array field without a breaking migration of this
   one. v1 supports exactly one marketplace source, per FR242/architecture P5-8.

## Tasks

- [x] `lib/profile.js` — `getCustomMarketplaceSelection(projectRoot)` /
  `setCustomMarketplaceSelection(projectRoot, { source, sourceUrl, mode, selectedCodes, sha })`,
  mirroring the `getBmadModules`/`setBmadModules` field-ownership pattern (bootstrap-on-absence,
  preserve all other fields, validate shape).
- [x] `lib/custom-marketplace.js` — `reconcileCustomMarketplaceSelection({ persistedSelectedCodes,
  enumeratedPlugins })`: pure function (no I/O), returns `{ added, removed, stillPresent }`.
- [x] `lib/bmad.js` — `installCustomMarketplaceSubset()` persists the selection (source,
  sourceUrl, mode, selectedCodes, sha extracted from the staged `resolvedModules[].cloneSha`)
  via an injectable `deps.setCustomMarketplaceSelection` seam, AFTER a successful bmad-method
  invocation + Cline reconcile (same point cleanup already happens). Persistence failure is
  caught and logged as a warning — never turns a successful install into a reported failure.
- [x] `bin/cli.js` — `reconcileCustomMarketplaceOnUpdate({ projectRoot })`: reads the persisted
  selection, re-enumerates, reports added/removed, returns a `promptCustomMarketplace()`-shaped
  selection object (or `null` on fail-loud, or `undefined` when nothing was persisted so the
  caller falls back to the normal prompt). Step 3.5b wiring: when `bmadInstalled` was already
  true before this run (i.e. `bmad.updateBmad()` ran — the FR242 "on update" case) with no
  `--bmad-custom-source` flag, try the reconcile path first; otherwise fall back to the existing
  `promptCustomMarketplace()` call, unchanged. Deliberately gated on `bmadInstalled`, NOT on
  `isUpdate` (which only tracks ma-agents' own "Update (add/remove skills)" wizard choice and
  stays `false` on a `--yes` rerun against an existing install — the exact case FR242 must
  still cover).
- [x] Tests: persistence round-trip; SHA captured for Git-URL sources and `null` for local
  sources; reconcile reports added/removed and does not add new codes to the selection;
  unreachable source on update fails loud AND leaves the persisted manifest byte-for-byte
  unchanged; `--bmad-custom-source` flag overrides the persisted-source reconcile path.

## Dev Notes

- **Where the SHA pin comes from:** bmad-method's `CustomModuleManager#cloneRepo()` writes
  `.bmad-source.json` (`{ cloneUrl, version, sha, ... }`) into its own cache dir after every
  clone/fetch. `resolvePlugin()` reads that file and stamps `cloneSha`/`cloneRef` onto each
  `ResolvedModule` it returns — already threaded through 30.6b's
  `stageCustomMarketplaceSubset()` return value (`resolvedModules[].cloneSha`). 30.7 reads it
  from there rather than re-deriving it, so no new git plumbing is added.
- **Why persistence lives inside `installCustomMarketplaceSubset()` and not in `bin/cli.js`:**
  the SHA is only known after staging (which happens inside that function); duplicating the
  staging call in `bin/cli.js` just to read `resolvedModules` would violate the single-call-site
  NFR17 posture. The function already performs other side effects (Cline reconcile, stage
  cleanup) at the same trust boundary.
- **Why the update path is a NEW function rather than a branch inside `promptCustomMarketplace()`:**
  `promptCustomMarketplace()`'s NFR70 "byte-identical to baseline when off" contract and its
  existing 30.6a test suite assert its exact behavior for the fresh-engagement case (flag, Y/N,
  multiselect). Reusing it for the reconcile case would either dilute that contract or require
  threading persisted-selection state through a function whose job is explicitly "collect a
  NEW selection." A separate `reconcileCustomMarketplaceOnUpdate()` keeps both functions
  single-purpose.
- **Why `stillPresent` (not the full persisted set) is what gets (re)installed:** a code that
  the marketplace no longer declares cannot resolve via `resolvePlugin()` — passing it through
  to `installCustomMarketplaceSubset` would trip 30.6b's own FR238 "resolved to zero installable
  modules" guard for that entry (or simply be silently unmatched, per
  `resolveSelectedPlugins()`'s `selectedSet.has(p.code)` filter). Dropping it from the
  request and reporting it as `removed` is the loud, correct behavior.
- **Fail-loud implementation:** simply never calling `setCustomMarketplaceSelection` (or any
  other manifest write) on the enumerate-failure branch — `.ma-agents.json` is untouched by
  construction, not by an explicit "restore" step. This is verified by a byte-for-byte file
  comparison in the test (not just a field-level assertion).

## Testing

Run directly (all terminate in seconds; no network, no real bmad-method invocation):

```
node test/custom-marketplace-persist-reconcile.test.js
npm run build:plugin
```
