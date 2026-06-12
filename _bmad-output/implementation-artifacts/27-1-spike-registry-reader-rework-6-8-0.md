# Story 27.1: Spike — Confirm the Module-Registry Reader Path Update for v6.8.0

Status: ready-for-dev

## Story

As the **ma-agents maintainer**,
I want to confirm (against a live v6.8.0 install) the relocated module-registry path and the `type`-based filter mapping, and record it as Architecture Decision P5-5,
So that Story 27.2 implements a known small reader change rather than discovering the registry shape mid-build.

**Gate:** This is a hard gate for Epic 27. No implementation story (27.2+) begins until the path/filter is confirmed and P5-5 is finalized. This is a CONFIRMATION spike, not open design — the approach is already known (relocated YAML + type filter); the spike de-risks it against the live package.

## Acceptance Criteria

1. **Given** a scratch install of `bmad-method@6.8.0`, **When** the maintainer inspects the package, **Then** the external-module list is confirmed to live in **`bmad-modules.yaml` at the package root** — a `modules:` map with `code`/`url`/`name`/`type` fields (the same shape the current parser reads) — and NOT in `tools/installer/modules/official-modules.js` (which is unchanged loader code that reads this YAML). The in-package `registry-fallback.yaml` / `external-official-modules.yaml` paths are confirmed absent at v6.8.0.

2. **Given** the confirmed source, **When** the reader change is scoped, **Then** it is confirmed minimal: add the package-root `bmad-modules.yaml` path to `REGISTRY_CANDIDATES`, keep/adapt `parseModulesYaml()`, and swap the `built_in` filter for a `type` filter. (Rejected alternatives recorded in P5-5: `require()`-ing `official-modules.js` — it does not contain the list; shipping a static ma-agents copy — would diverge from upstream.)

3. **Given** the confirmation, **When** the decision is written, **Then** P5-5 is confirmed/adjusted against the findings and the stale `external-official-modules.yaml` / `official-modules.js`-as-source references in `_bmad-output/planning-artifacts/architecture.md` and `docs/architecture.md` are confirmed corrected.

4. **Given** the confirmed classification, **When** the decision is finalized, **Then** it states the **`type`-based filter**: include `type: bmad-org` (tea, bmb, cis, gds, **wds — INCLUDED**), exclude `type: experimental` (**automator — EXCLUDED**); `bmm`/`core` are built-in (absent from the registry) and never cloned. It records that `wds` is an active module at v6.8.0 (retired at 6.3.0, returned at 6.8.0) — NOT retired.

5. **Given** the confirmed source, **When** the decision is finalized, **Then** it names the fail-loud contract Story 27.2 must implement (feeds NFR56): the **thin-cache** guard — resolved `type: bmad-org` set smaller than the known set (tea/bmb/cis/gds/wds), or no source at all, ⇒ non-zero exit, no partial manifest.

## Tasks / Subtasks

### Task 1: Confirm the v6.8.0 module source (AC: 1)

- [ ] 1.1 In a scratch dir, `npm install bmad-method@6.8.0`
- [ ] 1.2 Confirm `bmad-modules.yaml` exists at the package root; read its `modules:` map and field names (`code`/`url`/`name`/`type`)
- [ ] 1.3 Confirm `official-modules.js` is loader code that reads the YAML, not the data source
- [ ] 1.4 Confirm `registry-fallback.yaml` / `external-official-modules.yaml` are absent at v6.8.0

### Task 2: Confirm the filter mapping (AC: 2, 4)

- [ ] 2.1 Confirm the six registry entries and their `type` values: tea/bmb/cis/gds/wds = `bmad-org`; automator = `experimental`
- [ ] 2.2 Confirm bmm/core are NOT in the registry (built-in via local module.yaml)
- [ ] 2.3 Record the include/exclude rule and the wds-is-active correction

### Task 3: Finalize the decision (AC: 3, 5)

- [ ] 3.1 Confirm/adjust Architecture Decision P5-5 against the findings
- [ ] 3.2 Confirm both architecture docs no longer claim a JS data source or wds retirement
- [ ] 3.3 State the thin-cache fail-loud contract for 27.2

## Dev Notes

- Reader to change: `loadModuleDefinitions()` / `locateRegistry()` / `normalizeModules()` in `scripts/build-bmad-cache.js` (~lines 21-175). `REGISTRY_CANDIDATES` and the `normalizeModules()` filter change; `parseModulesYaml()` is reused/adapted, not replaced.
- The new YAML omits a `branch` field — default to `main` as the current `normalizeModules()` already does.
- Do not rely on release notes — confirm against the installed package.
