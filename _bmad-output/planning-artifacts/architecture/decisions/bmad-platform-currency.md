# BMAD Platform Currency — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/bmad-platform-currency.md. Ordered NEWEST FIRST:
> P5-8 (v6.10.0, current) → P5-6 → P5-5 → P5-2 → P5-1 → P4-1 → P2-9.
> P5-8 retains the P5-5 registry reader; the two P5-1 addenda travel with P5-1.

---

## Decisions

### Decision P5-8: BMAD v6.10.0 Integration — Bundle-Filter Change + Custom Marketplace Source + Demerzel Deprecation (FR235–FR247, NFR70–NFR75) (2026-07-09)

**Context.** The v6.9.0 bump (P5-6) was reader-neutral. v6.10.0 is not. It ships three things that reach ma-agents:

1. **`bmad-loop`** — a new `type: bmad-org` module (the unattended-dev orchestrator succeeding the now-`deprecated` `bmad-automator`). It carries two registry traits ma-agents has never seen: `marketplace-plugin: true` (its skills resolve from `.claude-plugin/marketplace.json` via the plugin resolver, not from a single `module-definition` dir) and — on `bmad-automator` — `deprecated: true`.
2. A cluster of upstream skill changes (`bmad-investigate` retired; `bmad-dev-auto`/`bmad-loop-setup`; party-mode; edge-case-hunter; elicitation; `bmad-help`).
3. Two installer/resolver changes on the code path ma-agents' own extension staging uses.

**Live-registry verification (the gate).** A read of `bmad-modules.yaml` at `v6.9.0` and `v6.10.0` confirms the registry **PATH is unchanged** (package root) and the **parse SCHEMA is additive-only** — the new keys (`marketplace-plugin`, `deprecated`, `deprecation-message`, `post-install-message`, `aliases`) are optional and the `modules:` map shape is intact. So the **P5-5 reader and `parseModulesYaml` are retained verbatim**; this is *not* a repeat of the 6.8.0 relocation.

**The one real break — the bundle filter, not the reader.** `build-bmad-cache.js` `normalizeModules()` keeps **every** `type: bmad-org` entry, and the NFR56 thin-cache guard only fails when the resolved set is *smaller* than `KNOWN_BUNDLED_MODULES = {tea, bmb, cis, gds, wds}`. A new `bmad-org` module is therefore an **addition the guard does not catch** — a naive pin bump would clone `bmad-loop` into `lib/bmad-cache/` and, because ma-agents' default `--modules` is "every bundled cache module," would pass `--modules …,bmad-loop` and **install it by default**. `bmad-loop` is a Python/tmux/hooks orchestrator requiring a separate `bmad-loop-setup` step plus vendor-API sessions — air-gap-hostile as a default — and it functionally overlaps ma-agents' own `bmad-dev-epic`.

**Decision.**
- **Filter change (FR235) — closed-by-default:** rewrite `normalizeModules()` to include ONLY the allowlist (`KNOWN_BUNDLED_MODULES` = `{tea, bmb, cis, gds, wds}`); for each allowlisted entry, ASSERT it carries neither `marketplace-plugin: true` nor `deprecated: true` (a shape/status flip on an allowlisted module HALTS the build). This is deliberately stronger than the deny-list framing (just "exclude the two flags") an earlier draft used — a deny-list still bundles a *future* plain `type: bmad-org` module, which is the silent-addition class we are closing. Pair it with a **two-sided set-EQUALITY guard** (NFR73): the resolved set must EQUAL the allowlist — fail loud on SMALLER (thin cache) OR LARGER (silent addition). **Implementation note:** compute the equality on the *resolved/filtered registry set*, NOT the final manifest keys — `build-bmad-cache.js`'s incremental-retention path deliberately keeps prior modules in the manifest that are not in the allowlist. `bmad-loop` is **opt-in only**, never force-bundled; `bmad-dev-epic` remains the default epic orchestrator.
- **Pin + passthrough (FR236–FR238):** bump 6.9.0→6.10.0 (supersedes P5-6/FR211), rebuild cache + plugin, offline-install verify, Story-30.1 live-registry confirmation gate. Upstream skill changes inherited via the existing P5-3 Cline-wrapper reconciliation. Regression-verify (confirmed by a v6.9.0…v6.10.0 diff, not re-implemented) the two changes on ma-agents' `--custom-source` staging path (P4-1): (a) #2511's new `isLocalSourcePath()` in `custom-module-manager.js` (now recognizes Windows-absolute paths + `.\`/`..\`) — beneficial to Windows staging; (b) `official-modules.js` fails loud on an unresolved `marketplace-plugin` module, and the shared `_copyResolvedSkills()` (used by the custom-source `installFromResolution` path) now fails loud on empty-resolution or duplicate skill-leaf names — regression check that ma-agents' staged plugin resolves non-empty with unique leaf names. `uv-check.js` is a stdout-only reword; its `{ status }` return/exit contract is unchanged (re-confirms FR212/NFR74).

**Custom marketplace source (FR239–FR243, NFR70–NFR72).** After module selection, the installer offers a single **marketplace repository** (local path or intra-perimeter Git URL such as on-prem GitLab — a repo with `.claude-plugin/marketplace.json`). ma-agents **reuses BMAD's own `CustomModuleManager`** (`resolveSource` → clone/local + `discoverModules`) to enumerate the declared extensions, presents them in **ma-agents' own wizard multiselect**, and installs the user-selected subset — the FR126 single-wizard principle is preserved (bmad-method runs `--yes`). Authentication is the host's **ambient git config** (SSH keys / credential helper) — ma-agents does zero token handling. The marketplace URL + selected codes persist in `.ma-agents.json` and re-enumerate on update. **Open spike (Story 30.5):** how a *subset* of a marketplace's plugins is passed to BMAD under `--yes` — BMAD's CLI path (`ui.js:_resolveCustomSourcesCli`) resolves *all* declared codes, so a subset likely also constrains `--modules`. On-prem posture: no public-internet egress required; intra-perimeter Git permitted; custom-source content is **pass-through and outside the sealed-bundle guarantee** (NFR71, one-line user warning). This supersedes the earlier GitLab-group-enumeration / submodule-expansion idea — a single curated `marketplace.json` is the org's entry point. **NFR17 note:** `CustomModuleManager`/`resolveSource`/`discoverModules` are BMAD *installer internals*, not part of the enumerated official-extension API surface — the 30.5 spike must confirm this surface is stable/public or record it as an accepted, version-pinned internal coupling (re-verified on each pin bump), so the reuse does not silently break NFR17/NFR72.

**Demerzel deprecation (FR244–FR247, NFR75).** Remove the Demerzel footprint for **new installs** (verified on disk: **12** `ml-*` skills, **13** `bmm-demerzel` `module-help.csv` rows): the `ma-agent-ml` agent skill + 12 `ml-*` skills from `lib/bmad-extension/skills/` and the generated `lib/bmad-extension-plugin/skills/`; the 13 `bmm-demerzel`-keyed `module-help.csv` rows; the `ma-agent-ml` + 12 `ml-*` entries in the hand-maintained `lib/bmad-extension/.claude-plugin/marketplace.json.template` `skills[]` (NOT regenerated by `build-plugin.js` — a missed edit trips v6.10.0's fail-loud install); the **`bmm-demerzel` agent registration** in `lib/agents.js`, `lib/skill-authoring.js`, `bin/cli.js`; and the `MANIFEST.yaml` entries. Six existing test files hardcode the ml/demerzel counts/sets and must be reconciled in the same story (see Affects). **Existing installs are left untouched** (non-destructive, per NFR49) with a one-time deprecation notice; no auto-removal, no prompt. **No in-tool migration** — the replacement is published in the org's local marketplace, reachable via the custom marketplace source above. This **supersedes FR193** (the P4-1 deferred Demerzel → Memory-agent conversion is cancelled; the P4-1 project-tree entry and deferred-follow-up notes are annotated in place and retained as history — Gadi remains the only Memory-agent-conversion candidate). The P5-6/FR213/NFR59 `ml-*` `uv run python` exemption simplifies once the `ml-*` skills are gone (NFR74).

**Affects:**
- `package.json` (bmad-method 6.9.0 → 6.10.0)
- `scripts/build-bmad-cache.js` (`normalizeModules` filter predicate; regression test for `marketplace-plugin`/`deprecated` exclusion)
- `bin/cli.js` / `lib/bmad.js` (custom-marketplace prompt + `--bmad-custom-source`, `CustomModuleManager` enumeration, multiselect, subset install, `.ma-agents.json` persistence)
- `lib/bmad-extension/skills/` + generated `lib/bmad-extension-plugin/skills/` (remove `ma-agent-ml` + 12 `ml-*`), `module-help.csv` (remove 13 rows), `lib/bmad-extension/.claude-plugin/marketplace.json.template` (`skills[]` entries)
- `lib/agents.js` + `lib/skill-authoring.js` + `bin/cli.js` (remove the `bmm-demerzel` agent registration)
- `MANIFEST.yaml` (drop `ma-agent-ml` + `ml-*`), Cline-wrapper reconciliation (retire `ml-*` + `bmad-investigate` wrappers)
- Test reconciliation (deletion turns these RED otherwise): `test/extension-module-restructure.test.js` (skill/csv counts, 12-ml-dir list), `test/plugin-manifests.test.js` (template skill set: five → four `ma-agent-*`), `test/routing-parity.test.js`, `test/agent-injection-strategy.test.js` (`bmm-demerzel`), `test/convert-agents-to-skills.test.js`, `test/uv-transition-resilience.test.js` (drop the `ml-*` exemption per NFR74)
- `lib/bmad-cache/` (rebuilt against 6.10.0), `lib/bmad-extension-plugin/` (rebuilt)
- Regression tests (bundle-filter exclusion, uv-missing success, custom-source isolation, non-destructive deprecation)

**FR Coverage:** FR235–FR247, NFR70–NFR75. Supersedes P5-6/FR211 (pin) and FR193 (Demerzel conversion). Retains the P5-5 reader/parser and the NFR56 thin-cache guard; re-asserts the air-gap guarantee (NFR2/NFR54/NFR57).

**[ASSUMPTION]** Epic/story split — whether custom-marketplace-source and Demerzel-deprecation ship as story clusters within Epic 30 or as adjacent epics — to be ratified in epics/story planning; the subset-passing spike (Story 30.5) gates the custom-source stories.
### Decision P5-6: BMAD v6.9.0 Integration — Pin Bump (No Reader Change) + Installer-Output Resilience (FR211–FR214, NFR58–NFR59) (2026-06-27)

**Context:** P5-5 reworked `scripts/build-bmad-cache.js` to read BMAD's external-module list from the relocated package-root `bmad-modules.yaml` (v6.8.0), because the registry **path** had moved (and moved twice before that). The v6.9.0 bump is the opposite situation, and the contrast is the whole point of this decision. A source comparison of the v6.8.0…v6.9.0 tags — performed out-of-tree via a shallow clone of the v6.9.0 tag plus a `gh api compare v6.8.0...v6.9.0` tag-to-tag diff (not against an npm-installed `bmad-method@6.9.0`, which is not yet on disk in this repo; Story 28.1 is the hard re-verification gate against the live install) — confirms the module registry `bmad-modules.yaml` is **UNCHANGED**: both **path** and **schema** (the `modules:` map with `code`/`url`/`name`/`type`) are identical to v6.8.0. The v6.8.0 registry-relocation break (FR207 / P5-5) therefore **does not recur**, and `build-bmad-cache.js` requires **no reader change** for this bump — the candidate-path list, the `parseModulesYaml()` shape, and the `type: bmad-org`/`type: experimental` filter from P5-5 all still resolve. The `marketplace.json` manifest shape is likewise UNCHANGED (upstream changes are additive only — new skill paths and renames already absorbed at 6.8.0 per P5-5). The only **behavioral** upstream change that touches ma-agents' code path is in the installer: v6.9.0 replaces the legacy `python3`-presence probe with a `uv` environment check. That change is **warn-don't-block** — same CLI flags, same exit codes, but new stdout text plus a "uv recommended" banner, and the install proceeds when `uv` is absent (new upstream files: `tools/installer/core/uv-check.js`, `tools/installer/core/wsl-node-check.js`). All other v6.9.0 additions (`bmad-forge-idea` core skill; the `bmad-architecture` lean-spine rewrite with `bmad-create-architecture` kept as a forwarding shim, slated for removal in BMAD v7; `src/scripts/memlog.py`; party-mode/brainstorming enhancements; the Astro 6 security upgrade; the WSL-runs-Windows-Node installer guard; empty-skill-group cleanup; new installer platform targets hermes-agent + CodeWhale) are passthrough for ma-agents.

**Decision:** Treat v6.9.0 as a **lean pin bump**. Bump `package.json` `bmad-method` 6.8.0 → 6.9.0, re-run `npm run build:bmad-cache`, and regenerate the bundled cache + plugin from v6.9.0 — but make **no reader change** to `build-bmad-cache.js` (registry path and schema unchanged; the contrast with P5-5 is explicit). The bump must still **re-verify** the registry path/schema on the bump (a confirmation gate, mirroring P5-5's Story 27.1 spike), so a future silent relocation is caught rather than assumed-away. Four scoping decisions accompany the bump:

**(a) Pin bump, no cache-reader change (FR211 — the key contrast with 6.8.0/P5-5).** The relocated-YAML reader, `type`-based filter, and thin-cache fail-loud guard delivered by P5-5 are carried forward verbatim. The v6.9.0 cache build resolves the same `type: bmad-org` bundled set (tea, bmb, cis, gds, wds; `bmm`/`core` built-in and never cloned; `automator` excluded as `type: experimental`). Supersedes FR208's v6.8.0 pin.

**(b) Installer-output resilience boundary (FR212).** ma-agents must continue to treat a `uv`-missing warning as **non-fatal** — the missing-`uv` banner never changes the BMAD installer's exit code, so the ma-agents install success path is unaffected. The resilience comes from **exit-code-based decisioning**: the live install/update/migration paths (`installBmad`/`updateBmad`/`runMigration`) wrap `runCommand(...)` in a try/catch and key success/failure off whether `execSync` **throws** on a non-zero exit — never on the installer's stdout text. So the new uv banner is harmless on the live path by construction. Note the `looksLikeOfflineFailure`/`looksLikeEbusyFailure`/`classifyRecompileFailure` classifiers in `lib/bmad.js` are **test-only / not wired into the install path** — their sole caller, `applyCustomizations()`, was removed in Story 22.6, so they are unreferenced on any live code path and are **not** the live guard against the uv banner. ma-agents must **not** depend on (parse or grep for) the retired `python3`-probe stdout strings. This is an invariant to preserve and pin with a regression test (NFR59), not new parsing logic to add. The `uv-check.js` / `wsl-node-check.js` additions are upstream-internal — ma-agents stages and invokes the installer unchanged.

**(c) ma-agents control-plane / tooling Python stays on `python` — explicitly NOT migrated to `uv` (FR213).** BMAD's `uv` standardization governs **BMAD-installed skills' scripts**, which ma-agents neither owns nor modifies. ma-agents **control-plane / tooling** Python remains invoked via the `python`/`python3` interpreter — this covers `scripts/build-bmad-cache.js`'s Python peers and the ma-agents-authored agent-skill activation steps that invoke `python3 {project-root}/_bmad/scripts/resolve_customization.py` (there is no checked-in `scripts/resolve_customization.py`; it is invoked at runtime from ma-agents-authored agent SKILL.md activation steps against the installed `_bmad/scripts/` path). **Explicitly exempt:** the ma-agents-owned `ml-experiment`/`ml-infra`/`ml-eda` skills intentionally instruct `uv run python scripts/<...>.py` — that guidance runs the **user's** ML-project scripts in the user's uv environment, not ma-agents control-plane tooling, and is correct as authored. This scoping boundary is recorded as an explicit owner decision so a future contributor does not mistakenly convert ma-agents control-plane Python to `uv run` on the assumption that the upstream installer change applies to it. A regression guard, scoped to control-plane invocation sites (so it does not fire on the ML skills), pins it (NFR59c).

**(d) Passthrough treatment of v6.9.0 content; hermes/CodeWhale deferred (FR214).** `bmad-forge-idea`, the `bmad-architecture` rewrite + `bmad-create-architecture` forwarding shim, and `memlog.py` are upstream-internal and reach ma-agents users via passthrough deployment — ma-agents owns none of those skill bodies and makes no per-skill source change. The only ma-agents-side propagation is the **existing** generated-artifact / enumeration reconciliation from P5-5 (FR209/FR210): `deployClineWorkflows()` regenerates a `bmad-forge-idea` wrapper, tolerates the `bmad-architecture`/`bmad-create-architecture` shim pair without producing a dangling wrapper, and any ma-agents-owned enumeration of the skill set surfaces `bmad-forge-idea` without breaking on the shim. No new reconciliation mechanism is introduced — the P5-5 reconcile-and-prune logic already covers renames/additions/retirements. The new installer platform targets **hermes-agent** and **CodeWhale** are explicitly **NOT** added to ma-agents' own platform registry (`lib/agents.js`) in this epic; adoption is deferred to a future story if demand appears.

**Air-gapped self-containment (NFR58):** the v6.9.0 cache rebuild must yield the full bundled set (tea, bmb, cis, gds, wds) and the P5-5 NFR56 thin-cache fail-loud guard must still hold for the v6.9.0 build (a resolved `type: bmad-org` set smaller than the known set, or no locatable source, exits non-zero with no partial manifest). No install-path code may require an external host after the tarball is on disk. The new core Python that v6.9.0 ships — `src/scripts/memlog.py` (installs to `_bmad/scripts/memlog.py`) and any other new `_bmad/scripts/*.py` — must be confirmed (verified-not-assumed) to be `python3`/stdlib-runnable and to **not** require `uv` on the air-gapped image, since the python/uv guard excludes `_bmad/` and nothing otherwise verifies it. Re-asserts NFR2/NFR54/NFR57; verified by the offline-install gate on the release candidate.

**Regression tests (NFR59):** automated tests must assert (a) the install flow returns its success path when `uv` is absent from PATH — exercised at the real decision site (the `runCommand` try/catch in `installBmad`/`updateBmad`, which keys off the thrown exit status, not stdout); a missing-`uv` warning is non-fatal and never changes the exit code (FR212); (b) a **repo-wide grep** over `lib/` finds no code path that greps installer stdout for the retired `python3`/version-banner strings or for `uv` (the offline/EBUSY classifiers are test-only/unreferenced on the live path since Story 22.6, so this is proving a standing negative, not fixing parsing); (c) ma-agents **control-plane** Python is still invoked via `python`/`python3` and not `uv run` — a guard against accidental migration, scoped to control-plane sites so it does not fire on the `ml-experiment`/`ml-infra`/`ml-eda` skills' intentional `uv run python` guidance (FR213).

**Alternatives considered:**
- *Re-audit / rewrite the cache-reader "to be safe":* Rejected — the source diff confirms the registry path and schema are unchanged at v6.9.0; touching the P5-5 reader would be churn with no upstream driver. The bump's re-verification gate (a read-only confirmation) is the right-sized safeguard against a future silent relocation.
- *Migrate ma-agents control-plane Python to `uv run` to "align" with the upstream installer change:* Rejected — the upstream change is an installer-environment probe and governs BMAD-installed skill scripts, not ma-agents' own control-plane scripts. Migrating would add a `uv` runtime dependency to the air-gapped install surface (NFR58) for no benefit. (The `ml-experiment`/`ml-infra`/`ml-eda` skills' `uv run python` guidance is a separate, intentional case — it targets the user's ML-project env, not ma-agents tooling, and is left untouched.) Recorded explicitly (FR213) to prevent well-meaning future migration of control-plane Python.
- *Add hermes-agent / CodeWhale to `lib/agents.js` now:* Deferred — passthrough already deploys upstream support; adding them to ma-agents' own registry pulls in per-tool routing, instruction-injection surfaces, and skill-resolution mappings (the full P2-1/P5-3/P5-4 cross-tool stack) for two platforms with no current demand. Kept out of scope to keep the integration slice small, consistent with P5-5's deferral of first-class routing for the new upstream skills.
- *Parse the new `uv` banner to surface a richer ma-agents-side message:* Rejected — stdout-string parsing is exactly the fragility FR212 forbids (the `python3` probe text it replaced is why). Exit-code-only decisioning is the durable contract.

**Files affected:**
- `package.json` (`bmad-method` pin 6.8.0 → 6.9.0)
- `lib/bmad-cache/cache-manifest.json` + `lib/bmad-extension-plugin/` (regenerated artifacts from v6.9.0)
- `scripts/build-bmad-cache.js` (**NO reader change** — re-verify registry path/schema only; carries P5-5's relocated-YAML reader, `type` filter, and thin-cache guard forward verbatim)
- `lib/bmad.js` (`deployClineWorkflows` — no new mechanism; the P5-5 reconcile-and-prune logic generates the `bmad-forge-idea` wrapper and tolerates the architecture shim pair)
- `lib/agents.js` (**no change** — hermes-agent / CodeWhale explicitly NOT added this epic)
- `test/bmad-version-bump.test.js` (modify — pin v6.9.0; assert registry path/schema unchanged vs v6.8.0; bundled set still tea/bmb/cis/gds/wds)
- new tests (NFR59): uv-missing install returns success / exit code unchanged at the real decision site (`runCommand` try/catch in `installBmad`/`updateBmad`); repo-wide grep confirms no `lib/` path greps the retired `python3`/banner strings (offline/EBUSY classifiers are test-only since Story 22.6); ma-agents control-plane Python invoked via `python`/`python3` not `uv run` (scoped to exclude the ML skills' intentional `uv run python`)
- Architecture: this document (P5-6)

**FR Coverage:** FR211, FR212, FR213, FR214, NFR58, NFR59. Supersedes the v6.8.0 pin in P5-5 / FR208. Key contrast with P5-5: registry path AND schema unchanged ⇒ no cache-reader change.

### Decision P5-5: Module-Registry Reader Rework for BMAD v6.8.0 Integration (FR207–FR210, NFR56–NFR57) (2026-06-08)

**Context:** ma-agents' offline self-containment (P2-6; NFR2/NFR50/NFR54) depends on `scripts/build-bmad-cache.js` pre-cloning the external BMAD modules into `lib/bmad-cache/`. To know *which* modules to clone, the builder reads BMAD's bundled module registry. That registry's **path** has moved across versions, but it has stayed **YAML** throughout: `tools/cli/external-official-modules.yaml` (≤6.2.x) → `tools/installer/modules/registry-fallback.yaml` (6.3.0–6.6.x) → **package-root `bmad-modules.yaml` (6.8.0; the in-package `registry-fallback.yaml` was retired in 6.7.0)**. The 6.8.0 file is a `modules:` map with `code`/`url`/`name`/`type` fields — the *same shape* the existing parser reads. (`tools/installer/modules/official-modules.js` is unchanged loader code that delegates to `external-manager.js` → this YAML; it does **not** contain the module list.) The break is purely that both YAML paths in the builder's `REGISTRY_CANDIDATES` list now 404 at v6.8.0, so `locateRegistry()` calls `process.exit(1)` and the bundled cache is never built — breaking the air-gapped install of the full module set.

**Decision:** Make a **small** reader change in `build-bmad-cache.js`: add the new package-root `bmad-modules.yaml` path to `REGISTRY_CANDIDATES` (keeping/adapting the existing `parseModulesYaml()` — *not* replacing it), and swap the module filter from the now-removed `built_in` flag to the `type` field. The bundle rule becomes **include every `type: bmad-org` module (tea, bmb, cis, gds, wds); exclude `type: experimental` (currently `automator`)**; `bmm`/`core` are built-in (loaded from bmad-method's local `module.yaml`, absent from the registry) and are never cloned. The **Story 27.1 spike** is a *confirmation* gate — confirm the path/shape against a live v6.8.0 install and confirm the type-filter mapping — not an open design question. Invariants preserved: the normalized `{ code, url, name, branch }` shape (no `branch` in the new YAML — default to `main` as today), and the bmm/core exclusion. **`wds` is an active `type: bmad-org` module at v6.8.0 and is bundled** (it had been retired upstream at 6.3.0, which is why the builder still carries AC #7 retention logic; that logic no longer applies to `wds` now that it is a normal registry clone).

**Fail-loud contract (NFR56):** the guard targets the **thin-cache** risk, not just a missing source. If the resolved `type: bmad-org` set is smaller than the known bundled set (tea, bmb, cis, gds, wds) — or no module source can be located/parsed at all — the build exits non-zero with an actionable message and writes **no** partial/empty `cache-manifest.json`. (The zero-source path already exits today; the new risk is the registry path moving again and the reader silently resolving fewer modules.) A regression test pins this guard — the registry path has now moved twice, so silent degradation is a real, recurring risk.

**Passthrough boundary (FR210):** the upstream skill renames/retirements/PRD-unification (`bmad-create-ux-design`→`bmad-ux`, `bmad-distillator`→`bmad-spec`, addition of `bmad-prd`/`bmad-investigate`) are internal to bmad-method and reach ma-agents users via passthrough deployment — ma-agents owns none of those skill bodies and makes no per-skill source change. The only ma-agents-side propagation is to *generated* artifacts and *ma-agents-owned enumerations*.

**Cline reconciliation (extends P5-3, FR209):** `deployClineWorkflows()` currently only ever writes/overwrites `.clinerules/workflows/<skill>.md`; it never deletes. After the v6.8.0 renames, a stale wrapper for a renamed-away/retired skill (e.g. `bmad-create-ux-design.md`) would persist as a dangling `/`-invocable workflow pointing at a deleted `.cline/skills/` dir. The function is extended to reconcile: regenerate wrappers for all current skills and remove any wrapper whose backing `.cline/skills/<name>/` directory no longer exists, scoped strictly to ma-agents-generated files and idempotent — the same stale-artifact discipline as the Bug B2 stale-tool-dir cleanup.

**Alternatives considered:**
- *Ship our own static copy of the module list (pin the set in ma-agents):* Rejected — it would freeze the module set at a snapshot and silently diverge from upstream's actual module list on every future bump, defeating the "stay aligned with BMAD" goal. Reading the relocated upstream `bmad-modules.yaml` keeps us tracking upstream.
- *Rip out the YAML parser and `require()` `official-modules.js`:* Rejected — based on the false premise that the list "became JavaScript." `official-modules.js` is loader code (unchanged since 6.6.0) that itself reads the YAML; requiring it would add side-effect risk for no benefit. The data is still YAML; only the path moved.
- *Adopt the new upstream skills (`bmad-spec`/`bmad-ux`/`bmad-investigate`) as first-class ma-agents MANIFEST entries in this epic:* Deferred — passthrough already deploys them; first-class routing is a possible fast-follow, kept out of scope to keep the integration slice small.

**Files affected:**
- `scripts/build-bmad-cache.js` (modify — add the package-root `bmad-modules.yaml` path to `REGISTRY_CANDIDATES`, keep/adapt `parseModulesYaml()`, swap `built_in`→`type` filter; add the thin-cache fail-loud guard)
- `lib/bmad.js` (modify `deployClineWorkflows` — add stale-wrapper reconciliation)
- `test/bmad-version-bump.test.js` (modify — replace the `registry-fallback` schema invariants and the `built_in`/`wds-retired` assertions with the relocated-YAML source tag, the `type`-based filter, and `wds`-present-and-bundled)
- new tests: offline-cache resolution + fail-loud guard; Cline reconciliation (stale-removal / new-generation / user-file-preservation)
- `package.json` (`bmad-method` pin 6.6.0 → 6.8.0)
- `lib/bmad-cache/cache-manifest.json` + `lib/bmad-extension-plugin/` (regenerated artifacts)

**FR Coverage:** FR207, FR208, FR209, FR210, NFR56, NFR57. Supersedes the v6.6.0 pin in P5-2 / FR197.

---

### Decision P5-2: BMAD v6.6.0 Integration (FR196–FR198, NFR55)

**Context.** bmad-method v6.6.0 introduces a breaking change: `--tools none` is rejected for fresh `--yes` installs. ma-agents' `buildBmadArgs()` currently emits `--tools none` when `ctx.tools` is empty (line 609 of `lib/bmad.js`). This occurs when no IDE-category agents are selected, producing an empty `bmadTools` array in `bin/cli.js` (line 1059).

**Decision.** Guard at the call site: when `bmadTools.length === 0` on a fresh install path, skip BMAD invocation entirely. The BMAD integration layer (`lib/bmad.js`) is only invoked when at least one IDE tool target is present. This preserves the invariant: "BMAD is installed iff at least one IDE agent is configured."

**Options Considered.**
- *Pass a default tool:* Rejected. Silently installing for a tool the user didn't select violates the least-surprise principle.
- *Error out:* Rejected. Zero IDE tools is a valid configuration for pure skill-only installs. A hard error would break those users.
- *Skip silently (chosen):* Zero IDE tools → BMAD install step is a no-op. Consistent with the existing behavior for other optional install steps.

**Secondary changes:**
- `project_name` config field migration (`[modules.bmm]` → `[core]`) is handled transparently by bmad-method on the next install/update run. No code change needed in ma-agents.
- `--custom-source` URL parsing fixes (Azure DevOps multi-segment paths, HTTP URLs, `_git` prefixes) and PluginResolver nested `module.yaml` support improve reliability of the plugin staging flow. No architectural change needed — these are upstream fixes consumed automatically.
- New `--set`/`--list-options` flags (FR198) are pass-through additions; their exposure in the ma-agents CLI is deferred to a future story.

**Technology stack:** bmad-method bumped from v6.5.0 → v6.6.0.

**FR Coverage:** FR196 (buildBmadArgs guard), FR197 (version pin), FR198 (--set/--list-options), NFR55 (automated test coverage).

### Decision P5-1: BMAD v6.5.0 Integration (FR199–FR210, NFR55–NFR58)

**Context.** BMAD-METHOD v6.4.0 and v6.5.0 ship two breaking changes and several features that touch ma-agents directly:

Breaking (v6.4.0):
1. TOML-based customization (#2284, #2283) — `_bmad/custom/*.toml` replaces the briefly-introduced YAML-based customization. Flat schema with structural merge rules (scalars, tables, code-keyed arrays, append arrays). `persistent_facts` unified into the same model.
2. Four-file config architecture (#2285) — project-level config surface now consists of `_bmad/config.toml`, `config.user.toml`, `custom/config.toml`, and `custom/config.user.toml`.

Features with direct ma-agents impact (v6.4.0):
- `customize.toml` support added to 6 dev-execution workflows: `bmad-dev-story`, `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-quick-dev`, `bmad-checkpoint-preview` (#2308). ma-agents maintains custom workflow skills for the first four (these are not upstream forks — see Sub-decision B).
- `bmad-customize` skill — guided authoring of TOML overrides in `_bmad/custom/` (#2289).
- `on_complete` hooks wired into 23 workflow terminal steps (#2290) — AiAudit.md integration via a `customize.toml` entry in the plugin bundle (Story 24.7).
- `persistent_facts` field in customize.toml — agent-level persistent facts injected via TOML; potential replacement for ma-agents' marker-injection layer (spike in Story 24.12).
- GitHub API primary + raw CDN fallback in installer registry client (#2248).
- `fs-extra` removed from BMAD internals, replaced with native `node:fs` (#2253) — ma-agents has 46 direct `fs-extra` call sites that must be audited (Story 24.1).
- Shared resolver now prefers `package.json > module.yaml > marketplace.json` (#2298).

New (v6.5.0):
- 18 additional platforms, total 42 supported (#2313).
- Cross-tool `.agents/skills/` standard — all platforms that support it now use it (#2313). Impact on ma-agents' per-tool routing assessed in Story 24.11.

Non-breaking improvements inherited for free: PRD scope-reduction guardrail (#1927), `bmad-create-story` UPDATE-file awareness (#2274), sprint-status sync from quick-dev (#2234), model parity enforcement for code-review subagents (#2236).

**Decision.** Two sub-decisions:

**Sub-decision A — TOML config format: COEXISTENCE (CONFIRMED).** The new `_bmad/config.toml` is BMAD's project-level config. `_bmad/bmm/config.yaml` is the module-level config read by `bmad-init.py` and the ma-agents workflow skills. These serve different purposes: project-level config stores agent roster and install answers; module-level config stores bmad-init state. `_bmad/bmm/config.yaml` confirmed present in v6.5.0 scratch install with keys: `planning_artifacts`, `user_name`, `communication_language`, `document_output_language`, `implementation_artifacts`. Four new TOML files also written alongside YAML (`_bmad/config.toml`, `_bmad/config.user.toml`, `_bmad/custom/config.toml`, `_bmad/custom/config.user.toml`) — TOML is additive. Story 24.3 scope: TOML coexistence is confirmed. Story 24.3 may assess whether ma-agents should READ the new TOML files, but the YAML config path is not broken.

**Sub-decision B — Custom workflow skills: ABSORB, not reconcile (CONFIRMED).** The 4 ma-agents workflow skills (`bmad-sprint-planning`, `bmad-sprint-status`, `bmad-dev-story`, `bmad-code-review`) are NOT upstream forks — they are entirely custom workflows built around ma-agents' sprint-status.yaml schema and AiAudit.md integration. "Migrate to customize.toml" does not apply to these skills. Story 24.4's scope is: evaluate whether v6.4.0's newly customize.toml-capable workflows (`bmad-quick-dev`, `bmad-checkpoint-preview`) add capabilities that should be absorbed into the ma-agents custom skill set, and if so, add them to the plugin bundle.

**Evidence base (Story 24.2 findings).**

- **Story 24.1 config finding:** Scratch install of v6.5.0 confirmed `_bmad/bmm/config.yaml` is written with all 5 expected keys. Four new TOML files written alongside (additive). Sub-decision A confirmed with no code changes required.
- **bmad-quick-dev / bmad-checkpoint-preview absorb assessment (Story 24.4 input):**

  | Skill | sprint-status? | AiAudit? | Decision | Rationale |
  |-------|---------------|----------|----------|-----------|
  | bmad-quick-dev | no | no | out of scope | Upstream skill is a general-purpose dev workflow with no sprint-status.yaml or AiAudit.md integration; not additive to ma-agents plugin |
  | bmad-checkpoint-preview | partial (reads sprint-status for review-status stories) | no | out of scope | Only passively reads sprint-status to list review-blocked stories; no write integration, no AiAudit.md; not additive enough to warrant absorption |

- **persistent_facts preliminary finding (Story 24.12 input):** `persistent_facts` field not found in node_modules/bmad-method v6.5.0 npm package (no matches in .md, .toml, .yaml, or .js files). May be Discord/release-notes only, not shipped in npm package. Story 24.12 spike should check GitHub source directly. Assessment: PARTIAL at best — even if present, the field would need to reach all 6 tool contexts (Claude Code, Copilot, Cline, Roo Code, Kilocode, OpenCode) to replace ma-agents' marker-injection layer; npm package evidence is insufficient to determine injection surface.

**New flow / component changes.**

The install flow is unchanged from P4-1 (local plugin staging via PluginResolver). v6.4.0 changes affect what goes *into* the plugin bundle, not how it is staged:
- `lib/bmad-extension-plugin/` rebuild: bump version, include `bmad-customize/` skill, remove 0–4 forked skill directories (per Story 24.4 outcome).
- `scripts/build-bmad-cache.js`: verify registry schema unchanged after #2248 (GitHub API primary + CDN fallback); adapt if needed.
- `lib/bmad.js`: verify no fs-extra dependency on BMAD internals after #2253.
- Resolver preference order (`package.json > module.yaml > marketplace.json`, #2298): verify plugin staging still resolves; no code change expected since we ship `module.yaml`.

**TOML customization layer.**

BMAD v6.4.0 introduces a new customization layer that sits *above* the plugin bundle in the configuration hierarchy:

```
_bmad/custom/config.toml          — project team overrides (committed)
_bmad/custom/config.user.toml     — individual developer overrides (gitignored)
_bmad/config.toml                 — project-level base config (BMAD-owned)
_bmad/config.user.toml            — per-user base config (BMAD-owned, gitignored)
lib/bmad-extension-plugin/        — ma-agents plugin bundle (installed by PluginResolver)
```

For skills where Story 24.4 chooses migration: ma-agents ships a `_bmad/custom/` TOML file as part of the plugin bundle (or as a post-install-stamped file). For skills where Story 24.4 retains forks: the fork in `lib/bmad-extension/skills/<skill>/` continues to ship as the authoritative SKILL.md.

**Code paths affected.**

| File | Change |
|------|--------|
| `package.json` | Bump `bmad-method: 6.3.0 → 6.4.0` |
| `lib/bmad.js` | Verify no fs-extra dependency; update `BMAD_TARGET_VERSION` constant |
| `scripts/build-bmad-cache.js` | Verify registry schema; adapt for #2248 if needed |
| `lib/bmad-extension/skills/` | Delete 0–4 forked SKILL.md files per Story 24.4; add `bmad-customize/` |
| `lib/bmad-extension-plugin/` | Rebuild against v6.4.0 |
| `MANIFEST.yaml` | Reflect skill additions/removals |

Potentially changed (Story 24.4 decides):
- `lib/bmad-extension/skills/bmad-sprint-planning/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-sprint-status/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-dev-story/` — migrate to customize.toml or keep fork
- `lib/bmad-extension/skills/bmad-code-review/` — migrate to customize.toml or keep fork

**Alternatives considered.**

Sub-decision A:
- *Migrate bmad-init.py to TOML immediately:* Rejected — the new `_bmad/config.toml` is a different file serving a different purpose. Migrating bmad-init.py without confirmed module-config movement is speculative churn.
- *Block v6.5.0 upgrade until full TOML migration is scoped:* Rejected — the resolver fix and bmad-customize skill are valuable; coexistence is low risk and keeps the upgrade unblocked.

Sub-decision B:
- *Migrate all 4 forks to customize.toml unconditionally:* Rejected — TOML overlays may not express all of our changes (e.g., structural reordering or conditional logic). Blanket migration could silently lose behavior. Per-skill evaluation in Story 24.4 is safer.
- *Retain all 4 forks unconditionally:* Rejected — this is the status quo cost that customize.toml was designed to eliminate. Where migration is safe, forks add ongoing maintenance burden and upgrade friction.

**Rationale.**
- Coexistence (Sub-A) is zero-risk pending Story 24.2 confirmation; if module config moved, Story 24.3 handles migration.
- Correctly scoping Sub-B (absorb not reconcile) avoids a category error: the 4 custom workflow skills have no upstream equivalent to overlay against.
- Verifying fs-extra removal and resolver preference change against ma-agents code is a spike task (Story 24.1), not a design assumption — findings update this decision if needed.

**Affects:**
- `package.json` (bmad-method 6.3.0 → 6.4.0)
- `lib/bmad.js` (BMAD_TARGET_VERSION constant; fs-extra verification)
- `scripts/build-bmad-cache.js` (registry schema verification / #2248 adaptation)
- `lib/bmad-extension/skills/` (0–4 fork deletions + bmad-customize addition)
- `lib/bmad-extension-plugin/` (rebuild)
- `MANIFEST.yaml` (skill additions/removals per 24.4 outcome)
- Architecture: this document (P5-1)

**Out of scope (deferred):**
- Channel-based install (`--channel` / `--pin` flags) — evaluate in follow-up epic
- Full `persistent_facts` replacement of marker-injection layer — spike in Story 24.12; implementation deferred to follow-up epic
- Advanced TOML authoring patterns beyond what `bmad-customize` skill guides

---

#### P5-1 Addendum: persistent_facts Spike Finding (Story 24.12)

**Finding: NO — `persistent_facts` cannot replace the marker-injection layer. Marker-injection layer remains necessary.**

`persistent_facts` does not exist in the installed `bmad-method` npm package. A full search across all file types (`.yaml`, `.toml`, `.md`, `.js`) in `node_modules/bmad-method` (v6.3.0 — the version actually shipped by ma-agents) returned zero matches. The BMAD online documentation at `docs.bmad-method.org` describes `persistent_facts` as a TOML-based, array-of-strings field introduced in v6.4.0 that pins foundational context for the duration of a BMAD workflow run — but this feature is absent from the npm tarball used by ma-agents. Even if a future npm bump delivers the field, its injection surface is fundamentally incompatible with ma-agents' requirements: `persistent_facts` is a BMAD CLI runtime concept loaded during agent/workflow activation within BMAD's own orchestration layer. It does not write to `.clinerules/`, `.roomodes`, `opencode.json`, or any of the 6 tool-specific config files that ma-agents' marker-injection layer targets (Claude Code → `.claude/CLAUDE.md`, Copilot → `.github/copilot/copilot.md`, Cline → `.cline/clinerules.md` [single instruction file; `.clinerules/` is a directory managed by `deployClineWorkflows`, not by the marker-injection layer], Roo Code → `.roo/rules/00-ma-agents.md` + `.roomodes`, Kilocode → `.kilocode/kilocode.md`, OpenCode → `opencode.json`). For a user to receive the "read MANIFEST.yaml, load always_load skills, select task skills" instruction, that instruction must be present in whichever config file the AI tool reads at session start — regardless of whether the user invokes a BMAD workflow. `persistent_facts` reaches only BMAD-activated workflow contexts; the other 5 tool surfaces are orthogonal to it.

**Recommended action:** Marker-injection layer remains necessary — no follow-up action from Epic 24. If a future BMAD version ships `persistent_facts` in its npm package and extends its injection surface to cover non-BMAD-workflow sessions across all 6 tools, this decision should be revisited. Until that is confirmed, the ~300-line injection layer in `lib/installer.js` (`composeInstructionBlock`, `markdownMarkersMerger`, `stampExtraInstructionTemplates`, `handleMarkerBlockDrift`) is the only reliable cross-tool mechanism available.
- `bmad-init.py` TOML migration — conditional on Story 24.2 confirming module-config movement; Story 24.3 handles if triggered

---

#### P5-1 Addendum: .agents/skills/ Cross-Tool Standard Assessment (Story 24.11)

**Finding: NO routing changes required. Per-tool routing remains correct for all 5 registered tools.**

##### Platform Routing Table — BMAD v6.5.0 vs ma-agents

| Tool | ma-agents skillsDir | BMAD v6.5.0 target_dir | Changed? | Exclusive to .agents/skills/? |
|------|---------------------|------------------------|----------|-------------------------------|
| claude-code | `.claude/skills` | `.claude/skills` | No | No |
| copilot | `.github/skills` | `.github/skills` | No | No |
| cline | `.cline/skills` | `.cline/skills` | No | No |
| roo-code | `.roo/skills` | `.roo/skills` | No | No |
| kilocode | `.kilocode/skills` | `.kilocode/skills` | No | No |

**Source:** `node_modules/bmad-method/tools/installer/ide/platform-codes.yaml` (v6.5.0, the version shipped with ma-agents 3.7.0).

##### .agents/skills/ Standard Adoption in v6.5.0

BMAD v6.5.0 introduced `.agents/skills/` as a cross-tool standard directory (#2313). In the current platform-codes.yaml it is used exclusively by two platforms not registered in ma-agents:

- `codex` (OpenAI Codex) → `.agents/skills/`
- `junie` (JetBrains Junie) → `.agents/skills/`

All 5 ma-agents flagship tools (`claude-code`, `github-copilot`, `cline`, `roo`, `kilo`) retain their pre-existing per-tool `target_dir` entries. None migrated exclusively to `.agents/skills/`.

##### Risk Assessment

- **Skill duplication risk:** None. No flagship tool reads both a per-tool path AND `.agents/skills/`.
- **Silent failure risk (broken routing):** None. All 5 tools still route to the same directories ma-agents writes to.
- **OBSOLETE_TOOL_SKILL_DIRS impact:** No new entries required — no `skillsDir` paths changed.

##### Recommendation

**Per-tool routing remains correct; `.agents/skills/` standard is additive only — no follow-up from Epic 24.**

The `.agents/skills/` path is currently used only by platforms outside ma-agents' registered set. Adopting it as the primary install path would require all 5 flagship tools to migrate their BMAD platform entries simultaneously, which has not happened. If ≥3 of the 5 flagship tools migrate to `.agents/skills/` in a future BMAD release, a follow-up epic should be opened to simplify ma-agents routing to a single primary path plus per-tool overrides. Until that threshold is reached, the current per-tool registry in `lib/agents.js` is the correct and safe design.

**No changes to `lib/agents.js`, `lib/installer.js`, or `OBSOLETE_TOOL_SKILL_DIRS` are required by this story.**

---

### Decision P4-1: BMAD v6.3.0 Plugin Migration (FR182–FR195, NFR50–NFR54)

**Context.** BMAD-METHOD v6.3.0 ships four breaking changes and a new authoring model:
1. Custom-content install removed (#2227) — replaced by marketplace/plugin installation via PluginResolver
2. `bmad-init` skill removed (#2159) — agents read `_bmad/bmm/config.yaml` directly
3. `spec-wip.md` singleton removed (#2214) — replaced by `spec-{slug}.md` with status field
4. Persona consolidation (#2177/#2179/#2186) — Barry, Quinn, Bob merged into unified Amelia

BMAD Builder adds a plugin packaging model: `.claude-plugin/marketplace.json` is a shared convention (documented as "works for any skills-capable platform, not just Claude"). PluginResolver supports five resolution strategies, including local file paths — which is the load-bearing fact for our air-gapped requirement.

**Decision.** Invert the current installer architecture from *post-install manifest surgery* to *pre-install local plugin staging*.

**Current flow (to be replaced, `lib/bmad.js:205-346`):**
1. Invoke `bmad-method install` with flags
2. Read `_bmad/_config/manifest.yaml` and `files-manifest.csv`
3. Filter manifest entries by hardcoded module-name whitelist (`["custom", "bmb"]`)
4. Parse CSV by column index, rewrite entries, remove stale ones
5. Inject custom agent YAML into `_bmad/_config/custom/agents/`
6. Stage workflow YAMLs

**New flow:**
1. Build time: assemble `lib/bmad-extension-plugin/` from `lib/bmad-extension/` sources via a build script — output contains `.claude-plugin/marketplace.json`, `skills/module.yaml`, `module-help.csv`, and all skill folders
2. Package publish: both `lib/bmad-cache/` and `lib/bmad-extension-plugin/` ship inside the ma-agents npm tarball (no network access at install time)
3. Install time: `bin/cli.js` → new staging helper copies `lib/bmad-extension-plugin/` → `<project>/.ma-agents-plugin-stage/`
4. Invoke `npx bmad-method install --custom-source <stage-path> --tools <selected> --modules <selected> --yes`
5. BMAD's own PluginResolver (local-file strategy) places content into the target tool's skill directory
6. On success, remove the stage directory; on failure, leave it for diagnostic inspection

**Module structure (new):**

```
lib/bmad-extension-plugin/                        — BUILD OUTPUT (generated)
├── .claude-plugin/
│   └── marketplace.json                          — plugin manifest (format-convention only)
├── skills/
│   ├── module.yaml                               — module identity (code, description, module_version)
│   ├── module-help.csv                           — capability registry
│   ├── ma-agent-cyber/                           — Yael (renamed from bmad-ma-agent-cyber)
│   │   ├── SKILL.md
│   │   ├── bmad-skill-manifest.yaml
│   │   └── resources/
│   ├── ma-agent-devops/                          — Amit
│   ├── ma-agent-sre/                             — Alex
│   ├── ma-agent-ml/                              — Demerzel [DEPRECATED v6.10 / P5-8 — removed from shipped bundle for new installs; memory-agent conversion cancelled]
│   ├── ma-agent-sqa/                             — Gadi (stateless in v6.3; memory-agent in follow-up)
│   └── ...workflow skills (mil498-*, sre-*, cyber-*, devops-*, ml-*)...
```

**Source of truth.** Hand-edited source remains at `lib/bmad-extension/`. The plugin directory is generated — a new script `scripts/build-plugin.js` produces `lib/bmad-extension-plugin/` from source. Both the source and generated directories are committed to the repo (the generated dir ships in the tarball; committing it makes the build reproducible and diffable).

**Code paths deleted (`lib/bmad.js`):**
- Lines ~205-283 — manifest.yaml / files-manifest.csv hand-parsing and filtering (the `["custom", "bmb"]` whitelist, `fields[2]` CSV indexing)
- Lines ~296-346 — custom agent YAML staging into `_bmad/_config/custom/agents/`

Net deletion: ~140 lines. Replacement: ~30 lines for stage-and-invoke.

**Config read path.** Any code that currently reads `_bmad/_config/*` for BMAD-canonical values is redirected to `_bmad/bmm/config.yaml`. ma-agents-owned config (`.ma-agents.json`, `project-context.md`) is unaffected.

**Skill namespace rename.** All skills currently prefixed `bmad-ma-agent-*` are renamed to `ma-agent-*` to vacate the reserved `bmad-*` prefix. Sweep required in: `MANIFEST.yaml`, `lib/bmad-extension/skills/*/SKILL.md` trigger phrases, `module-help.csv`, `.ma-agents.json`, and all doc references.

**Legacy skill retirement.** Drop from MANIFEST.yaml and source tree:
- `bmad-init` — upstream removed
- `bmad-agent-qa` (Quinn) — merged into Amelia
- `bmad-agent-sm` (Bob) — merged into Amelia
- `bmad-agent-quick-flow-solo-dev` (Barry) — merged into Amelia

**Multi-tool routing.** No change to `lib/agents.js` registry. BMAD's own installer routes plugin content to the right skills directory based on `--tools` (`.github/copilot/skills/`, `.cline/skills/`, `.roo/skills/`, `.kilocode/skills/`, `.claude/skills/`). The `.claude-plugin/marketplace.json` name is a BMAD Builder convention, not a Claude-only binding (per BMAD Builder docs).

**Offline verification gate.** Add a CI job that runs `npm pack`, extracts the tarball into a clean container with egress blocked, and runs the installer end-to-end. Smoke-assert: plugin stages, bmad-method install completes, no outbound connections attempted. Gate every release candidate (NFR50).

**Deferred follow-up (not in this epic).** Convert Demerzel and Gadi to Memory-agent format at `_bmad/memory/<agent>/` after 6.3.0 lands. Stateless format is valid for v6.3 — conversion is an authoring improvement, not a compat requirement. **[UPDATE — P5-8 (2026-07-09): the Demerzel half of this follow-up is CANCELLED. Demerzel is deprecated and removed from the shipped bundle for new installs; only Gadi remains a Memory-agent-conversion candidate.]**

**Rationale.**
- Deletes ~140 lines of fragile manifest-surgery code whose underlying mechanism no longer exists upstream
- Uses BMAD's own installer for placement — removes the ma-agents/BMAD coupling on manifest internals
- PluginResolver's local-file strategy is purpose-built for disconnected deployments — the air-gapped guarantee is preserved, not weakened
- Skill rename aligns with the reserved-prefix convention, avoiding future upstream collisions
- Legacy skill retirement tracks upstream consolidation — our catalog stops drifting from BMAD's canonical persona set

**Affects:**
- `package.json` (bmad-method 6.2.2 → 6.3.0)
- `lib/bmad.js` (~140 lines deleted, ~30 lines added)
- `lib/bmad-extension/` (source rename sweep)
- `lib/bmad-extension-plugin/` (new generated directory)
- `scripts/build-plugin.js` (new)
- `scripts/build-bmad-cache.js` (retarget to 6.3.0 module registry location)
- `lib/bmad-cache/` (rebuilt against 6.3.0)
- `MANIFEST.yaml` (4 skill removals, mass rename)
- `bin/cli.js` (stage-and-cleanup around bmad-method invocation)
- `.gitignore` (add `.ma-agents-plugin-stage/`)
- CI workflow (new offline install job)

**Out of scope (deferred):**
- Memory-agent conversion for Demerzel and Gadi (FR193, FR194 — follow-up epic) — **Demerzel portion cancelled by P5-8 (deprecated, FR247); Gadi only**
- Restructure of stateless agent SKILL.md bodies into BMAD Builder "Stateless Agent" conventions if it changes anything beyond frontmatter

---

### Decision P2-9: BMAD 6.2.0 Agent Architecture Migration (FR94-FR110, NFR29-NFR33)

**Decision:** Restructure the extension module to follow BMAD 6.2.0 module conventions — agents as skill folders, workflows as skill folders, `module.yaml` with `code` field, deployed via `--custom-content`

**Problem:** The 4 custom agents (SRE, DevOps, Cyber, MIL-498) are currently delivered via `.customize.yaml` files. BMAD 6.2.0 modules deliver agents as skills (`SKILL.md` + `bmad-skill-manifest.yaml` with `type: agent`). `.customize.yaml` is for END-USER customization of other modules' agents, not for delivering module-owned agents. Additionally, MIL-498 workflows use the legacy YAML/XML workflow engine which is removed in 6.2.0.

**Verified pattern (from CIS module source):**
- Agents in modules: `skills/<agent-name>/SKILL.md` + `bmad-skill-manifest.yaml` (type: agent)
- Workflows in modules: `skills/<workflow-name>/SKILL.md` + `bmad-skill-manifest.yaml` (type: skill)
- Module identity: `module.yaml` with `code` field
- Deployment: `--custom-content <module-path>`

**Revised extension module structure:**

```
lib/bmad-extension/
├── module.yaml                              — code: ma-skills, name, description
├── module-help.csv                          — capability registry for all agents + workflows
└── skills/
    │
    │ ── Agent Skills (type: agent) ──
    ├── bmad-ma-agent-sre/
    │   ├── SKILL.md                         — Alex: full agent instructions (persona, menu, activation, critical_actions)
    │   └── bmad-skill-manifest.yaml         — type: agent, displayName: Alex, role: SRE, module: ma-skills
    ├── bmad-ma-agent-devops/
    │   ├── SKILL.md                         — Amit: DevOps agent
    │   └── bmad-skill-manifest.yaml
    ├── bmad-ma-agent-cyber/
    │   ├── SKILL.md                         — Yael: Cyber Security Analyst
    │   └── bmad-skill-manifest.yaml
    ├── bmad-ma-agent-mil498/
    │   ├── SKILL.md                         — Joseph: MIL-STD-498 Expert
    │   └── bmad-skill-manifest.yaml
    │
    │ ── MIL-498 DID Workflows (type: skill, Complex Workflow) ──
    ├── mil498-sss/
    │   ├── SKILL.md                         — SSS generation entrypoint
    │   ├── bmad-skill-manifest.yaml         — type: skill
    │   ├── template.md                      — SSS DID template
    │   └── prompts/                         — step files (progressive disclosure)
    │       ├── 01-discovery.md
    │       ├── 02-requirements.md
    │       └── ...
    ├── mil498-ssdd/                          — SSDD generation
    ├── mil498-ocd/                           — OCD generation
    ├── mil498-sdp/                           — SDP generation
    ├── mil498-srs/                           — SRS generation
    ├── mil498-sdd/                           — SDD generation
    ├── mil498-std/                           — STD generation
    ├── mil498-str/                           — STR generation
    ├── mil498-idd/                           — IDD generation
    ├── mil498-irs/                           — IRS generation
    ├── mil498-hrs/                           — HRS generation
    │
    │ ── SRE Playbooks (type: skill) ──
    ├── sre-health-check/
    │   ├── SKILL.md                         — health check workflow
    │   └── bmad-skill-manifest.yaml
    ├── sre-fix-deployments/
    ├── sre-performance-opt/
    ├── sre-check-deployment-status/
    ├── sre-check-secrets/
    ├── sre-day-2-ops/
    ├── sre-deployment-strategies/
    ├── sre-gitops-status/
    │   └── (1 more — 9 SRE workflows total)
    │
    │ ── DevOps Playbooks (type: skill) ──
    ├── devops-configure-infrastructure/
    ├── devops-optimize-pipelines/
    ├── devops-manage-helm/
    ├── devops-disconnected-deployment/
    ├── devops-docker-compose-setup/
    ├── devops-sign-docker-image/
    │   └── (6 DevOps workflows total)
    │
    │ ── Cyber Playbooks (type: skill) ──
    ├── cyber-vulnerability-scan/
    ├── cyber-security-audit/
    ├── cyber-threat-modeling/
    ├── cyber-generate-certs/
    ├── cyber-immunity-estimation/
    ├── cyber-vault-secrets/
    ├── cyber-verify-docker-users/
    ├── cyber-verify-image-signature/
    │   └── (8 Cyber workflows total)
    │
    │ ── BMAD Extension Workflows (type: skill) ──
    ├── create-bug-story/                    — bug story from report (FR61)
    │   ├── SKILL.md
    │   └── bmad-skill-manifest.yaml
    ├── add-sprint/                          — new sprint entry in unified sprint-status.yaml (FR68)
    ├── modify-sprint/                       — update sprint metadata/items in unified file (FR70)
    ├── add-to-sprint/                       — move items from backlog to sprint in unified file (FR69)
    ├── close-sprint/                        — sprint close lifecycle: archive done, disposition remaining (P2-11)
    │   ├── SKILL.md
    │   └── bmad-skill-manifest.yaml
    └── remove-from-sprint/                  — move items from sprint back to backlog
        ├── SKILL.md
        └── bmad-skill-manifest.yaml
```

**Total skills in module:** 4 agents + 11 MIL-498 + 9 SRE + 6 DevOps + 8 Cyber + 6 extension workflows + 1 open-graph = **45 skills**

**`bmad-skill-manifest.yaml` patterns:**

Agent skill manifest:
```yaml
type: agent
name: bmad-ma-agent-sre
displayName: Alex
title: Site Reliability Engineer
icon: "🔧"
capabilities: "system availability, Kubernetes ops, SLO/SLA management, deployment strategies"
role: "Site Reliability Engineer"
identity: "Experienced SRE focused on system reliability and operational excellence"
communicationStyle: "Direct, data-driven, alert to risks"
principles: "Reliability first. Automate everything. Measure what matters."
module: ma-skills
```

Workflow skill manifest:
```yaml
type: skill
name: mil498-srs
module: ma-skills
```

**`module.yaml` update:**
```yaml
code: ma-skills
name: "MA-Agents Skills & Agents"
description: "Enterprise methodology enforcement, specialized agents, and operational workflows"
extends-module: bmm
default_selected: false
```

The `code` field is required for `--custom-content` deployment. `extends-module: bmm` is retained to indicate this module builds on BMM.

**Agent SKILL.md content:** Each agent's `SKILL.md` contains the full agent definition that was previously split across `.customize.yaml` + XML `<agent>` definition:
- Persona (role, identity, communication style, principles)
- Menu items with trigger phrases
- Activation sequence (including skill-loading critical_actions)
- References to the agent's workflow skills (e.g., SRE agent's menu references `sre-health-check`, `sre-fix-deployments`, etc.)

**Built-in BMM agent customization (7 agents + bmad-master):**
The 8 built-in BMM agents that ma-agents does NOT own still use `.customize.yaml` files — these are deployed by `bmad.js` to `_bmad/_config/agents/` AFTER `--custom-content` installs the module. These files add `critical_actions` for skill loading only (no persona/menu override):

```yaml
# MA-AGENTS: skill enforcement for bmm-pm
critical_actions:
  - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  - "For each skill marked always_load: true, read the skill file completely"
  - "If _bmad-output/project-context.md exists, read it completely"
  - "Follow all skill directives and project-context rules during this session"
```

**Note:** In 6.2.0, `critical_actions` in `.customize.yaml` uses array syntax (list of strings), not numbered map syntax. Updated to match current BMAD documentation.

**Deployment sequence in `bmad.js`:**
1. Pre-populate `~/.bmad/cache/external-modules/` from `lib/bmad-cache/`
2. Invoke bmad-method with `--custom-content "lib/bmad-extension/"` — installs the module including 4 agents and all workflow skills
3. Deploy `.customize.yaml` files for 8 built-in BMM agents to `_bmad/_config/agents/`
4. Run `--action quick-update` to apply customizations

**MIL-498 workflow conversion detail (FR98-FR100):**
Each DID workflow converts from `workflow.yaml` + `instructions.md` (legacy engine) to:
- `SKILL.md` — workflow entrypoint with frontmatter triggers and routing logic
- `prompts/` — step files for progressive disclosure (Layer 4), preserving strict sequential execution
- `template.md` — DID output template (same content, new location)
- The legacy `<template-output>` checkpoints become explicit user confirmation gates in step files

**SRE/DevOps/Cyber workflow conversion detail (FR101-FR103):**
These workflows are already `.md` files. Conversion is lighter:
- Wrap existing `.md` content in `SKILL.md` with proper frontmatter
- Add `bmad-skill-manifest.yaml` with `type: skill`
- Multi-step workflows get `prompts/` for progressive disclosure
- Single-pass playbooks remain as simple `SKILL.md` files

**Migration detection and upgrade path (FR107-FR110):**

```javascript
// In bmad.js — detect BMAD version and migration need
function detectMigrationNeed(projectRoot) {
  const configPath = path.join(projectRoot, '_bmad', 'core', 'config.yaml');
  if (!fs.existsSync(configPath)) return { action: 'install', migrate: false };

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const version = config?.version || '0.0.0';

  if (semver.lt(version, '6.2.0')) {
    return { action: 'update', migrate: true, fromVersion: version };
  }
  return { action: 'update', migrate: false };
}
```

**Migration steps (when upgrading from 6.0.4):**
1. Detect old version from `_bmad/core/config.yaml`
2. Back up existing `_bmad/_config/agents/*.customize.yaml` (user customizations to preserve)
3. Invoke bmad-method with `--action update` + `--custom-content` — bmad-method handles the core upgrade
4. Deploy new `.customize.yaml` files for built-in agents
5. Merge user customizations back: if user had added custom `memories` or extra `critical_actions` to any of the 4 custom agents, carry those forward into the new agent SKILL.md
6. Clean up legacy artifacts: old `.customize.yaml` files for custom agents (now replaced by module agent skills), XML agent definitions in `_bmad/custom/agents/`, YAML workflow files in `lib/bmad-workflows/mil498/`

**Rollback (NFR29):** If bmad-method update fails, `bmad.js` restores the backed-up `.customize.yaml` files and logs the error. The project remains on the old version. Full atomicity is achieved by backing up before and restoring on failure.

**Affects:** `lib/bmad-extension/` (complete restructure), `bmad.js` (migration detection, `--custom-content` deployment, `.customize.yaml` deployment for built-ins), `lib/bmad-workflows/` (migrated into extension module skills), `lib/bmad-customizations/` (eliminated — content moved to extension module)
