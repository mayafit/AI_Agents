# Story 30.1 — GATE Findings: Live-Registry Confirmation for bmad-method@6.10.0

**GATE VERDICT: PASS** — All P5-8 assumptions hold against a live install of `bmad-method@6.10.0`. The predicted bundle-filter break is reproducible with the current reader. Stories 30.2 and 30.3 are UNBLOCKED (Waves 2–4 valid).

- **Method:** `npm install bmad-method@6.10.0` into a scratch dir outside the repo (`<scratchpad>/bmad-6-10-0`), `--ignore-scripts`. Version string in the installed `package.json` = `6.10.0` (LIVE_INSTALL: confirmed). A parallel scratch install of `bmad-method@6.9.0` was used to confirm the deltas below. The repo tree and any repo `node_modules` were not modified.
- **Registry file:** `bmad-modules.yaml` at the **package root** of the installed `bmad-method@6.10.0`. The old paths `tools/installer/modules/registry-fallback.yaml` and `tools/cli/external-official-modules.yaml` are **ABSENT** (relocation from P5-5 still holds; no re-relocation at 6.10.0).

## 1. Enumerated module table (package-root `bmad-modules.yaml` @ 6.10.0)

| registry key | code | type | marketplace-plugin | deprecated | bundled by ma-agents? |
|---|---|---|---|---|---|
| bmad-loop | `bmad-loop` | `bmad-org` | **true** | (absent → false) | **NO** — opt-in only (new module) |
| bmad-method-test-architecture-enterprise | `tea` | `bmad-org` | — | — | YES |
| bmad-builder | `bmb` | `bmad-org` | — | — | YES |
| bmad-automator | `automator` | `experimental` | — | **true** | NO (already excluded — `experimental`) |
| bmad-creative-intelligence-suite | `cis` | `bmad-org` | — | — | YES |
| bmad-game-dev-studio | `gds` | `bmad-org` | — | — | YES |
| bmad-method-wds-expansion | `wds` | `bmad-org` | — | — | YES |

- `bmm`/`core` are NOT in the registry (built-in, loaded from local `module.yaml`) — unchanged.
- `bmad-loop` also carries `aliases: [bauto]` (pre-rename code `bmad-auto`/`bauto`), `defaultSelected: false`, and a `post-install-message` (bmad-loop-setup follow-up). `wds` carries `plugin_name: bmad-wds`. None of these affect the ma-agents filter.

## 2. P5-8 assumption checks (3a–3d)

- **3a — bmad-loop = `type: bmad-org` + `marketplace-plugin: true`: YES.** `bmad-modules.yaml` lines 37–60: `code: bmad-loop`, `type: bmad-org`, `marketplace-plugin: true`. Comment in the entry confirms its skills resolve from `.claude-plugin/marketplace.json` via the plugin resolver.
- **3b — bmad-automator = `deprecated: true`: YES.** Lines 84–95: `code: automator`, `type: experimental`, `deprecated: true`, `deprecation-message: "...replaced by BMad Loop (bmad-loop)..."`.
- **3c — Registry PATH + SCHEMA unchanged vs 6.9.0 (additive-only): YES.** Same package-root `bmad-modules.yaml`, same `modules:` map with `code/url/name/type`. New keys are all optional/additive: `marketplace-plugin`, `deprecated`, `deprecation-message`, `post-install-message`, `aliases`. **Proof:** the ma-agents reader (`parseModulesYaml` → `normalizeModules` from `scripts/build-bmad-cache.js`, exported verbatim) parsed the live 6.10.0 YAML with no change — 7 entries parsed, all fields captured. P5-5 reader/parser carry forward verbatim; this is NOT a repeat of the 6.8.0 relocation.
- **3d — Non-deprecated, non-`marketplace-plugin` `type: bmad-org` set == `{tea, bmb, cis, gds, wds}`: YES.** `type: bmad-org` entries = `{bmad-loop, tea, bmb, cis, gds, wds}`; drop `marketplace-plugin: true` → removes `bmad-loop`; no bmad-org entry is `deprecated` (`automator` is `experimental`, already out). Remainder = exactly `{tea, bmb, cis, gds, wds}`.

## 3. Reproduced break (why 30.2 is required)

Running the CURRENT `normalizeModules()` (keeps every `type: bmad-org`) against the live 6.10.0 registry:

```
CURRENT normalizeModules() output: bmad-loop, tea, bmb, cis, gds, wds   (6 modules)
KNOWN_BUNDLED_MODULES:             tea, bmb, cis, gds, wds
Thin-cache guard MISSING (caught): (none)      → guard PASSES
EXTRA beyond allowlist (ignored):  bmad-loop   → guard does NOT catch
```

Confirmed: a naive 6.9.0→6.10.0 pin bump would clone `bmad-loop` into `lib/bmad-cache/` and, because ma-agents' default `--modules` is "every bundled cache module," would force-install the air-gap-hostile bmad-loop by default. The existing NFR56 guard only fails on a set SMALLER than the allowlist, so this addition passes silently — exactly the P5-8 premise. This is the concrete justification for Story 30.2 (closed-by-default allowlist + two-sided set-EQUALITY guard).

## 4. Call-sites for the two regression-verified upstream changes

### (a) #2511 — custom-source local-path detection (`isLocalSourcePath`)

**Installed bmad-method@6.10.0** — `tools/installer/modules/custom-module-manager.js`:
- `isLocalSourcePath()` defined at **lines 14–24**; used at **line 98** (version-suffix guard) and **line 107** (local-path branch in `parseSource`).
- The 6.10.0 function adds `input.startsWith('.\\')`, `input.startsWith('..\\')`, and `path.win32.isAbsolute(input)`.

**Delta vs 6.9.0 (this is genuinely NEW, not a rename):** 6.9.0 had NO `isLocalSourcePath` function. Local-path detection was **inline** at `custom-module-manager.js:101`: `if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('~'))` — POSIX-only, no Windows-absolute and no `.\`/`..\` backslash handling. #2511 extracted it and added Windows support.

**ma-agents repo (the staging path #2511 touches — regression-verify, do NOT re-implement):** `lib/bmad.js`:
- `stagePlugin(projectRoot)` at **line 94**; `PLUGIN_STAGE_DIR_NAME = '.ma-agents-plugin-stage'` at **line 58**; the custom-source arg is built as `./${PLUGIN_STAGE_DIR_NAME}` at **line 189** → returned to `installBmad`/`updateBmad`/`runMigration` (call-sites ~lines 848, 947, 1050).
- The flag itself is appended in `buildBmadArgs(ctx)` at **line 736** (`ctx.customSource` → `parts.push(flag, ...)` around **line 767**); the flag name is chosen by `resolveCustomContentFlag()` at **line 688** (`--custom-source` vs legacy `--custom-content`).
- **Impact:** ma-agents passes a POSIX-relative `./.ma-agents-plugin-stage`, which BOTH 6.9.0 (inline `startsWith('./')`) and 6.10.0 (`isLocalSourcePath`) recognize. So #2511 is **neutral-to-beneficial** for the current staging arg (no regression; it also now tolerates a Windows-absolute or `.\`-prefixed stage path if ma-agents ever changes it). 30.3's job is to regression-verify this, not change it.

### (b) Official-modules fail-loud (`_copyResolvedSkills` + marketplace-plugin unresolved)

**Installed bmad-method@6.10.0** — `tools/installer/modules/official-modules.js`:
- `_copyResolvedSkills()` defined at **line 339**; called at **line 299** (marketplace-plugin registry install path) and **line 388** (`installFromResolution` — the custom-source path).
- Fail-loud #1 (marketplace-plugin unresolved) — **lines 292–298**: throws if a `marketplace-plugin` module's `pluginResolution.skillPaths` is missing/empty ("Aborting to avoid a partial install with no skills").
- Fail-loud #2 (duplicate skill leaf names) — **lines 348–354** inside `_copyResolvedSkills`: throws if two skill dirs flatten to the same leaf name.

**Delta vs 6.9.0 (genuinely NEW):** 6.9.0's `official-modules.js` has **0** occurrences of either fail-loud string ("Aborting to avoid a partial install" / "share the leaf name"). Both guards are introduced at 6.10.0.

**ma-agents repo (regression-verify):** ma-agents' staged plugin rides in via `--custom-source` → BMAD resolves it through `installFromResolution` → `_copyResolvedSkills` (the SHARED path). So the staged `.ma-agents-plugin-stage` plugin MUST resolve **non-empty with unique skill-leaf names**, or the 6.10.0 install fails loud. Relevant ma-agents staging producers: `lib/bmad.js` `stagePlugin()` (line 94) and the generated `lib/bmad-extension-plugin/` / `.claude-plugin/marketplace.json` (built by `build-plugin.js`). 30.3 regression-verifies a non-empty, unique-leaf resolution.

## 5. Surprises / cross-story impacts

- **30.2 (bundle filter):** Confirmed the fix must be a closed-by-default ALLOWLIST + two-sided set-EQUALITY (fail on EXTRA too), computed on the RESOLVED registry set (not manifest keys — the retention path keeps non-allowlist modules in the manifest). The current deny-list framing would still bundle a *future* plain `bmad-org` module. Also assert allowlisted entries carry neither `marketplace-plugin` nor `deprecated` (shape-flip halts the build). No reader/parser change needed (schema additive).
- **30.3 (pin bump):** The two upstream changes are BOTH new at 6.10.0 (not present at 6.9.0). Regression-verify only: (a) staged `./`-relative path still recognized by `isLocalSourcePath`; (b) staged plugin resolves non-empty with unique leaf names through `_copyResolvedSkills`. Pin is currently `bmad-method: "6.9.0"` in `package.json` (line 35).
- **30.4 (Demerzel removal) — HEIGHTENED RISK from fail-loud #1/#2:** Because `_copyResolvedSkills` now fails loud on empty/duplicate resolution on the custom-source path ma-agents uses, a botched removal of `ma-agent-ml`/`ml-*` from `marketplace.json.template` (stale/missing/duplicate skill entry) would turn a previously-silent partial install into a HARD install failure at 6.10.0. 30.4's marketplace.json.template edit must keep the staged resolution non-empty and unique. (Reinforces the existing P5-8 note that a missed template edit trips 6.10.0's fail-loud install.)
- **30.5/30.6 (custom marketplace source):** `CustomModuleManager.parseSource`/`isLocalSourcePath` (custom-module-manager.js) is the surface ma-agents' `--bmad-custom-source` reuse leans on; confirmed it lives at `tools/installer/modules/custom-module-manager.js` and is an installer INTERNAL (not the enumerated official-extension API) — consistent with the NFR17 pinned-internal-coupling caveat the 30.5 spike must ratify. `bmad-loop`'s `marketplace-plugin: true` + `post-install-message` behavior is the reference for how a marketplace-plugin module installs (via `_copyResolvedSkills`), relevant to 30.6's subset-install mechanism.

## Evidence appendix

- Registry: `<scratch>/bmad-6-10-0/node_modules/bmad-method/bmad-modules.yaml` (version 6.10.0), lines 36–130.
- Reader proof: ran exported `parseModulesYaml`/`normalizeModules` from `scripts/build-bmad-cache.js` against the live YAML → 7 raw entries; normalized output `bmad-loop, tea, bmb, cis, gds, wds`; guard MISSING=(none), EXTRA=bmad-loop.
- #2511: `tools/installer/modules/custom-module-manager.js:14-24,98,107` (6.10.0) vs `:88,101` inline (6.9.0).
- Fail-loud: `tools/installer/modules/official-modules.js:292-298,339,348-354,388` (6.10.0); 0 occurrences at 6.9.0.
- ma-agents staging: `lib/bmad.js:58,94,189,688,736,767` and call-sites ~848/947/1050.
