---
type: bug
severity: medium
title: ma-agents installs only bmm; bundled tea/bmb/cis/gds modules stranded in cache
---

# Bug: ma-agents installs only bmm; bundled tea/bmb/cis/gds modules stranded in cache

**Severity:** medium
**Affected Component:** ma-agents CLI wizard / BMad install pipeline (bin/cli.js)

## Reproduction Steps

1. Run `npx ma-agents` (interactive) or `npx ma-agents install --yes` in a fresh project.
2. Select an IDE agent (e.g., `claude-code`) so the BMad install path runs.
3. Wait for the wizard to print `BMAD-METHOD installed successfully!`.
4. Inspect `_bmad/` in the project — only the `bmm/` module directory exists.
5. Inspect `~/.bmad/cache/external-modules/` — `tea/`, `bmb/`, `cis/`, `gds/` are present (pre-populated from `lib/bmad-cache/`) but were never installed into the project.

## Expected Behavior

Every BMAD module bundled in the cache should be installed by default — that's the originally-intended behavior the hardcoded `['bmm']` literal had been suppressing. Power users get two opt-in flag forms:

| Form | Behavior |
|------|----------|
| (no flag) | Install all non-retired modules from `lib/bmad-cache/cache-manifest.json` (currently `bmm`, `tea`, `bmb`, `cis`, `gds`) |
| `--bmad-modules` (bare) | Open a multiselect prompt; user picks. `bmm` is required and pre-checked. Hitting Enter without changes installs everything (matches the no-flag default). |
| `--bmad-modules tea,bmb` | Install exactly those modules; `bmm` is force-prepended; unknown ids exit with a clear error |

Retired modules (currently only `wds`) are filtered out unconditionally.

## Actual Behavior

`bin/cli.js` lines 1062, 1076, 1085, 1099 hardcode `['bmm']` as the modules array in all four call sites (fresh-install `--yes`, fresh-install interactive, update `--yes`, update interactive). No prompt is shown, no flag is honored, and the bundled cache modules (`tea`, `bmb`, `cis`, `gds`) sit in `~/.bmad/cache/external-modules/` unused. The more permissive default in `lib/bmad.js:687` (`['bmm', 'bmb']`) is overridden by the caller and never reached.

## Root Cause Hypothesis

The CLI wizard never grew a module-selection step. The `installBmad`/`updateBmad` functions already accept a `modules` parameter and forward it via `--modules` to the bundled `bmad-method` installer (see `buildBmadArgs` in `lib/bmad.js:608`), but the wizard layer never collects that input from the user. Likely an oversight from when the cache was expanded from 2 modules (`bmm`, `bmb`) to 5 (`bmm`, `bmb`, `cis`, `gds`, `tea`) without a corresponding wizard update.

## Affected Files

- bin/cli.js
- lib/bmad-cache/cache-manifest.json
- test/build-bmad-args.test.js
- test/bmad-empty-tools-guard.test.js

## Suggested Fix

1. Read `lib/bmad-cache/cache-manifest.json`; filter out modules where `retiredUpstream === true` (drops `wds`).
2. Replace the four hardcoded `['bmm']` literals in `bin/cli.js` with a `selectBmadModules()` helper that resolves the install set:
   - **No `--bmad-modules` flag**: install every non-retired module (the originally-intended behavior).
   - **`--bmad-modules` bare**: multiselect prompt, all non-retired modules pre-checked; `bmm` tagged `(required)`; user can uncheck the optional ones.
   - **`--bmad-modules <csv>`**: validate the CSV against the cache manifest; reject unknown ids; force-prepend `bmm`.
3. `parseFlags()` must accept `--bmad-modules` as an optional-value flag — capture a CSV when the next arg is non-flag, or set a `bmadModulesPrompt` flag when the next arg is another flag or end-of-args.
4. Centralize `bmm`-force and unknown-id rejection in a pure `resolveBmadModules()` helper (in `lib/bmad.js`) so both flag and prompt paths share validation and error messages.
5. Pass the resulting array to `bmad.installBmad(modules, bmadTools)` / `bmad.updateBmad(modules, bmadTools)` in place of the current `['bmm']` literal.
6. Add a dedicated test file (`test/bmad-module-selection.test.js`) covering the helpers, flag parsing (CSV + bare), and validation. Extend `test/build-bmad-args.test.js` and `test/bmad-empty-tools-guard.test.js` only if the existing assertions need new cases.

## Status

review

## Implementation Notes

Implementation followed the Suggested Fix steps. Key decisions and clarifications discovered during implementation:

- **Default = install everything.** The originally-intended behavior was "install all bundled modules"; the hardcoded `['bmm']` literal had been suppressing it. Restoring the default is the actual fix; the `--bmad-modules` flag is a power-user opt-out, not the primary entry point.
- **`bmm` is not in the cache manifest.** The bundled cache (`lib/bmad-cache/cache-manifest.json`) only enumerates external modules — `bmm` ships inside the `bmad-method` npm dependency itself. `getInstallableBmadModules()` therefore prepends a synthetic `bmm` entry to the cache list rather than relying on the manifest to expose it.
- **Module descriptions** are kept in a hardcoded `BMAD_MODULE_DESCRIPTIONS` map in `lib/bmad.js`. A future improvement could read each module's `module-help.csv` `_meta` row dynamically, but the cache layout is inconsistent (bmb stores it under `skills/`, tea/cis/gds under `src/`) so a static map is simpler and matches current ma-agents conventions.
- **`bmm` enforcement is centralized.** `resolveBmadModules({ requested, available })` is the single source of truth for forcing `bmm` and rejecting unknown ids. Both the `--bmad-modules <csv>` flag path and the bare-flag multiselect funnel through it, so user-facing visual hints (the `(required)` tag) and CLI error messages cannot drift apart.
- **Optional-value flag parsing.** `parseFlags()` distinguishes bare `--bmad-modules` (sets `bmadModulesPrompt = true`) from `--bmad-modules <csv>` (sets `bmadModulesFlag = "<csv>"`) by inspecting whether the next arg is another flag or the end of args.
- **Wizard prompt** uses `prompts`'s `multiselect`. All non-retired modules default-checked so a no-op confirmation matches the no-flag "install all" default; the `(required)` tag is a visual cue only — the belt-and-suspenders enforcement is in `resolveBmadModules`.

## Acceptance Criteria Status

- [x] AC1 — No flag installs every non-retired module (originally-intended default restored).
- [x] AC2 — Retired `wds` is filtered out unconditionally.
- [x] AC3 — `--bmad-modules` (bare) opens a multiselect prompt; `bmm` is required and pre-checked.
- [x] AC4 — `--bmad-modules <csv>` validates against the cache manifest; unknown ids exit with a clear error.
- [x] AC5 — `bmm` cannot be deselected (force-prepended in `resolveBmadModules`).
- [x] AC6 — Tests cover the helpers, flag parsing (bare + CSV), and validation.

## File List

- `bin/cli.js` — added `--bmad-modules` optional-value flag parsing (CSV or bare), new `selectBmadModules()` helper with three branches (CSV / prompt / install-all default), replaced four hardcoded `['bmm']` literals, plumbed `bmadModulesFlag` and `bmadModulesPrompt` through `installWizard`/`handleInstall`, updated `--help` and examples
- `lib/bmad.js` — added `BMAD_MODULE_DESCRIPTIONS`, `getInstallableBmadModules()`, `getInstalledBmadModules()`, `resolveBmadModules()`; exported all four
- `test/bmad-module-selection.test.js` — new test file covering the helpers, flag parsing, and validation
- `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/architecture.md` — updated to reflect that "install all bundled modules" is the originally-intended default (if the doc references this surface)

## Change Log

- 2026-05-05 (3.12.1): Restored originally-intended BMAD module install behavior. No `--bmad-modules` flag → install every non-retired module from the cache. `--bmad-modules` bare opens a multiselect prompt; `--bmad-modules <csv>` installs exactly those (with `bmm` force-prepended). Retired `wds` is filtered out. The previous hardcoded `['bmm']` was suppressing the bundled `tea`, `bmb`, `cis`, `gds` modules.

## Dev Agent Record

### Test Results

- New tests in `test/bmad-module-selection.test.js` cover the helpers, both flag forms, and validation
- 9/9 pass in `test/yes-flag.test.js` (existing parseFlags coverage)
- 34/34 pass in `test/build-bmad-args.test.js` (modules array forwarding)
- 4/4 pass in `test/bmad-empty-tools-guard.test.js` (no-IDE skip path)
- Pre-existing failure unrelated to this change: `test/migration-validation.test.js` reports 7 mil498 byte-identical-template failures caused by CRLF/LF line-ending normalization in the Windows checkout. Reproduced on the clean tree before any edits in this change.

### Backwards Compatibility

- **Default install set is now larger.** Previously every install (interactive, `--yes`, direct) only got `bmm`. Now they get all five non-retired modules. This is the bug fix — the originally-intended behavior the hardcoded `['bmm']` literal had been suppressing.
- **CI/CD operators wanting the lean install** can pin it explicitly: `npx ma-agents install --yes --bmad-modules bmm`.
- `installWizard` gained two trailing optional parameters (`bmadModulesFlag`, `bmadModulesPrompt`), both with safe defaults (`''` / `false`), so external callers continue to work.

## Notes

- Created via `create-bug-story` workflow
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
