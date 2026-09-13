---
status: in-progress
type: bug-fix
source_bug: _bmad-output/implementation-artifacts/bug-wds-installed-by-default-creates-design-artifacts.md
authority: _bmad-output/planning-artifacts/prd/capabilities/bmad-integration-and-bundling.md (FR123, amended 2026-08-02)
branch: fix/wds-default-module-set
---

# Spec — narrow the default BMAD `--modules` set to bmm + tea + bmb + cis

## Authority

FR123 (amended 2026-08-02), `prd/capabilities/bmad-integration-and-bundling.md:30`:

> For the `--modules` value, the default install set is **bmm plus the non-design bundled
> modules** — `tea`, `bmb`, `cis` — from the bundled cache manifest
> (`lib/bmad-cache/cache-manifest.json`). The two design-studio modules `gds` (Game Design
> Studio) and `wds` (Whiteport Design Studio) are **bundled but not installed by default**:
> they remain fully available offline through the `--bmad-modules` multiselect, so the
> air-gap guarantee is unchanged, but they no longer arrive uninvited.

The PRD is NOT edited by this spec. It is already amended; it is the oracle.

## Goal (single, shippable)

The no-flag / `--yes` default install resolves to `bmm,tea,bmb,cis`; `gds` and `wds` stay
bundled, stay selectable, and stay installable; existing installs are not stripped.

## Tasks

1. `lib/bmad.js` — add `DEFAULT_BMAD_MODULE_IDS`, `NON_DEFAULT_BMAD_MODULE_IDS`, and
   `getDefaultBmadModules(available)` (intersected with what is actually installable, so a
   missing cache degrades to `bmm` rather than crashing). Export all three.
2. `bin/cli.js#selectBmadModules` branch 3 — replace `installable.map(m => m.id)` with the
   FR123 default set, resolved through `resolveBmadModules`.
3. `bin/cli.js#selectBmadModules` branch 3 — before the default, honour modules already
   present on disk (`bmad.getInstalledBmadModules`) so a pre-27.13 install that already has
   `wds` is not narrowed out from under the user.
4. `bin/cli.js#selectBmadModules` branch 2 — multiselect initial check state becomes the
   default set (bmm forced), not "everything", so Enter still equals the no-flag default.
   `gds`/`wds` remain offered.
5. Doc/help text: `bin/cli.js:159-163` (`--help`), `:347-352` (flag parse comment),
   `:3670-3686` (function contract), `:4411-4414` (call-site comment).
6. `test/bmad-module-selection.test.js` — replace the "installs everything" back-compat
   assertion with a PRD-parsed oracle; add multiselect/explicit-selection/`--yes`/existing-install
   coverage.

## Acceptance Criteria (Given/When/Then)

- **AC1** Given a clean project with no `.ma-agents.json` and no `_bmad/`, When
  `selectBmadModules({})` runs with no flag, Then the result equals the set parsed out of
  FR123's amended sentence in the PRD shard — not a literal in the test.
- **AC2** Given AC1's result, Then it contains no module whose `module.yaml` declares a
  `directories:` block scaffolding `design-artifacts` — i.e. no `gds`, no `wds`.
- **AC3** Given `--bmad-modules wds`, Then the result is `['bmm','wds']`, the cache carries
  a complete `wds` clone, and `prePopulateBmadCache` stages it — an install that selects it
  can proceed offline.
- **AC4** Given `--yes` with no `--bmad-modules`, Then the resolved set is AC1's set
  (`--yes` never reaches a prompt: branch 3 is prompt-free by construction).
- **AC5** Mutating `DEFAULT_BMAD_MODULE_IDS` in either direction (add `wds`, remove `cis`)
  turns the suite red.
- **AC6** Given a project whose `_bmad/` already contains `wds`, When a no-flag run resolves
  modules, Then `wds` is still in the resolved set.

## Out of scope (explicitly)

- PRD/epics/Decision P5-9 edits — FR123 is already amended.
- `KNOWN_BUNDLED_MODULES`, the NFR73 two-sided guard, any cache rebuild.
- Bug AC5 ("interactive installs get the module question without a CLI flag", Part B) — that
  is a new wizard question, a separate shippable deliverable, and is not required by FR123's
  amended text. Deferred.
