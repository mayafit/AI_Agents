# Story 30.6a: Custom Marketplace Source — Y/N Prompt + `--bmad-custom-source` Flag + Enumerate Adapter + Multiselect UI (NO subset install yet)

Status: review

## Story

As a **ma-agents user installing into an air-gapped / intra-perimeter environment**,
I want the installer to offer ONE custom BMAD marketplace source (a local path or a Git URL
containing `.claude-plugin/marketplace.json`), enumerate the extensions it declares, and let
me pick which ones in ma-agents' own wizard — using only my host's ambient git credentials,
So that my organization's curated extension marketplace can feed the ma-agents install without
any token handling, without leaving the perimeter, and without breaking the single-wizard
principle (bmad-method still runs non-interactively).

**Scope boundary (CRITICAL):** this story delivers **prompt + flag + enumerate + adapter +
drift/smoke test + multiselect UI ONLY**. It produces the user's *selection* and stops there.
Pruning the marketplace, staging the subset, and invoking `bmad-method` to install it is
**Story 30.6b**, which consumes this story's selection object. Nothing is installed from a
custom source by this story.

**Depends on:** Story 30.5 (spike — proved the enumerate-then-stage-locally mechanism and
handed off this adapter design). **Blocks:** Story 30.6b (subset stage + install), which in
turn blocks Story 30.7 (persist + re-enumerate on update).

**FR:** FR239, FR240, FR241 (zero token handling). **NFR:** NFR17 (pinned-internal coupling
to a bmad-method installer internal), NFR70 ("off" is byte-identical to baseline), NFR71
(custom content is outside the sealed-bundle guarantee — one-line warning).
**Architecture:** Decision P5-8 (`architecture.md:2592`, `:2608`).

## Acceptance Criteria

1. **Y/N prompt + flag.** **Given** an interactive project install past module selection,
   **When** the wizard reaches the custom-source step, **Then** it asks once —
   *"Install additional BMAD extensions from a custom source? (y/N)"* (default N) — and on
   "yes" collects a single source (local path OR Git URL). A `--bmad-custom-source <ref>`
   flag supplies the same input non-interactively; a missing value for the flag is a clean
   error (exit 1), not a silent no-op. (FR239)

2. **Thin, pinned-internal adapter.** **Given** bmad-method has no `exports` map, **When**
   ma-agents enumerates, **Then** it does so through ONE adapter module
   (`lib/custom-marketplace.js`) that deep-requires
   `bmad-method/tools/installer/modules/custom-module-manager.js` at a single call site and
   uses only `resolveSource` + `discoverModules` (+ `parseSource` transitively). The coupling
   is treated as an accepted, exact-version-pinned internal (NFR17), not a supported API.

3. **Surface drift/smoke test.** **Given** the pinned-internal surface, **When**
   `test/custom-marketplace-surface-drift.test.js` runs, **Then** it fails loud if: the deep
   require path is unreachable; `CustomModuleManager` is no longer an exported class; any of
   the four guarded methods (`parseSource`, `resolveSource`, `discoverModules`,
   `resolvePlugin` — the last reserved for 30.6b) is missing; or the installed bmad-method
   version does not equal the exact pin in `package.json` (must be re-run after the 30.3 pin
   bump). It also exercises local discovery mode, direct mode (FR240), and the fail-clean
   contract.

4. **Live Git-URL clone test (spike gap closure), network-free.** **Given** the 30.5 spike
   flagged that no live clone was exercised, **When**
   `test/custom-marketplace-live-clone.test.js` runs, **Then** it creates a local **bare** git
   repo fixture (`git init --bare`, seeded with a `marketplace.json` + skill dirs, pushed),
   performs a REAL `git clone` of it into a working tree, and enumerates that tree — proving
   the clone→read→enumerate mechanics end-to-end. Every spawned git command is bounded
   (`timeout: 15000`) and non-interactive (`GIT_TERMINAL_PROMPT=0`); no git call touches the
   network. The URL-specific wiring (parse → `type:'url'` → ambient-cred posture) is covered by
   source-verified assertions. (Documented limitation: driving bmad-method's HTTP/SSH clone
   branch fully live requires a real endpoint and is out of the test harness by design.)

5. **ma-agents' own multiselect.** **Given** a successful enumerate, **When** the user is
   interactive, **Then** ma-agents presents its OWN multiselect over the enumerated plugin
   codes (default all-checked) and returns exactly the chosen subset. Under `--yes` +
   `--bmad-custom-source`, every declared plugin is auto-selected (matching the "select all"
   `--yes` convention elsewhere). (FR240, FR126 single-wizard principle)

6. **Ambient credentials only; fail clean.** **Given** a Git-URL source, **When** cloning,
   **Then** authentication rides entirely on bmad-method's own `cloneRepo()`
   (`GIT_TERMINAL_PROMPT=0` + `process.env` passthrough). ma-agents does zero token handling,
   stores no secret, logs no credential. **When** the source is unreachable/unauthorized/
   invalid, **Then** enumeration throws a `CustomMarketplaceError` with a short human-readable
   message (never a raw stack dump), the wizard surfaces it and **skips** the custom-source
   step, and the rest of the install is unaffected. (FR241)

7. **NFR71 warning.** **Given** a source that enumerated ≥1 plugin, **When** the user is about
   to be offered the multiselect (or, under `--yes`, before auto-select), **Then** a one-line
   warning is shown that custom-source content is outside ma-agents' sealed-bundle guarantee —
   i.e. before anything could be selected/installed. (NFR71)

8. **Off by default (NFR70).** **Given** no `--bmad-custom-source` flag and either a `--yes`
   run or the user answering "N", **When** the wizard runs, **Then** `promptCustomMarketplace`
   returns `null` and no enumerate/clone occurs — the install path is byte-identical to
   baseline.

9. **Hand-off shape for 30.6b.** `promptCustomMarketplace()` returns
   `{ source, mode: 'discovery'|'direct', selectedCodes: string[], plugins: Object[] }` (or
   `null` when the feature is off/cancelled). 30.6b consumes `selectedCodes` (the user's
   pick) + `source`/`plugins` (for prune-and-stage). No staging/install is performed here.

## Tasks

- [x] `lib/custom-marketplace.js` — adapter: `CUSTOM_MODULE_MANAGER_PATH`, `REQUIRED_METHODS`,
  `NFR71_WARNING`, `CustomMarketplaceError`, `assertCustomModuleManagerSurface()`,
  `enumerateCustomSource(source)`.
- [x] `bin/cli.js` — `parseFlags` gains `bmadCustomSourceFlag`; `promptCustomMarketplace()`
  (Y/N prompt + text/flag source + NFR71 warning + multiselect + fail-clean); wired into
  `installWizard` Step 3.5b (after BMAD install, inside the `bmadTools.length > 0` block);
  help text + examples; export `promptCustomMarketplace`.
- [x] `test/custom-marketplace-surface-drift.test.js` — NFR17 drift/smoke + local enum + fail-clean.
- [x] `test/custom-marketplace-live-clone.test.js` — network-free real-clone-from-bare-repo + URL parse/ambient-cred.
- [x] `test/custom-marketplace-wizard.test.js` — flag parse + `promptCustomMarketplace` behavior (mocked prompts).
- [x] `test/cli.test.js` — extend the documented `parseFlags` key-set assertion with `bmadCustomSourceFlag`.
- [x] `.gitignore` — guard `.tmp-custom-marketplace-*/` test scratch dirs.

## Dev Notes

- **Why local paths must be `./`-relative (spike §3):** bmad-method 6.9.0's `parseSource()`
  treats only `/`, `./`, `../`, `~`-prefixed strings as local; a bare Windows `C:\…` absolute
  is rejected. Tests place fixtures under a repo-relative `.tmp-…/` dir and pass a
  `./`-relative path. (6.10.0's `isLocalSourcePath()` / #2511 relaxes this, but `./`-relative
  is safe on both pins.)
- **Direct mode (FR240):** a source with no `marketplace.json` at its root is surfaced as a
  single synthetic module (code = basename) so the multiselect still has one well-described
  choice. How a direct-mode selection stages is a 30.6b concern.
- **NFR17 mitigation carried:** single deep-require call site; exact version pin asserted by
  the drift test; the four consumed methods guarded (incl. `resolvePlugin`, reserved for 30.6b,
  guarded now so the drift test catches a regression before 30.6b lands). Re-run the drift test
  after the 30.3 pin bump to 6.10.0.
- **Known non-blocking follow-ups for 30.6b:** the custom-source prompt currently fires even if
  the preceding BMAD install/update reported failure (harmless here since 6a installs nothing;
  30.6b should decide whether to gate staging on BMAD-install success).

## Testing

Run each file directly (all terminate in seconds; none touches the network):

```
node test/custom-marketplace-surface-drift.test.js   # 9 passed
node test/custom-marketplace-live-clone.test.js      # 6 passed
node test/custom-marketplace-wizard.test.js          # 11 passed
node test/cli.test.js                                # 12 passed
npm run build:plugin                                  # bundle assembled, no drift
```
