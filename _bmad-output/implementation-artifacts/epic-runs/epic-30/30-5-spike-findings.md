# Story 30.5 Spike Findings — Subset-Install Under `--yes`, Zero Core Mods

**Story:** 30.5 (SPIKE, long pole) — blocks 30.6 / 30.7
**Date:** 2026-07-12
**Evidence base:** installed `bmad-method@6.9.0` (current pin), packed `bmad-method@6.10.0` (target pin), ma-agents `lib/bmad.js` / `lib/installer.js`, and a runnable PoC (`spike/30-5-enumerate-poc.js`, all assertions PASS).
**Refs:** Architecture P5-8 + NFR17 (`architecture.md:2608`, `:907`); PRD F25 FR239–FR243 / NFR70–NFR72 (`prd.md`).

---

## 1. RECOMMENDED MECHANISM — `enumerate-then-stage-locally`

**Verdict: PROVEN. This is the durable answer. Zero bmad-method core modifications.**

### Why the `--modules` constraint path does NOT work (evidence)

The CLI accepts `--modules`, `--custom-source`, `--yes`, `--tools` together
(`tools/installer/commands/install.js:15,36,37`). But in the non-interactive path,
`ui.js:_resolveCustomSourcesCli` (docstring line 1188: *"Auto-selects all discovered
modules from each source"*) pushes **every** discovered plugin code onto
`selectedModules` with **no `--modules` filtering** (`ui.js:1272-1276`
`allCodes.push(mod.code)` for all resolved). The flow in `promptInstall`
(`ui.js:289-316`) sets `selectedModules` from `--modules` for the *official/known* set,
then **unconditionally appends all custom-source codes** afterward
(`ui.js:313-316`). Therefore:

> `bmad install --custom-source <remote> --modules a,b --yes` installs the **entire**
> marketplace, not the subset `{a,b}`. `--modules` cannot subset a custom source.

This **sharpens the open question** flagged in Architecture P5-8 (`architecture.md:2608`:
*"a subset likely also constrains `--modules`"*): it does not — `--modules` has **no
effect** on which custom-source plugins install. The `--modules` fast-path is only
"opportunistic" in the trivial case where the marketplace already contains exactly the
desired set.

### Why enumerate-then-stage-locally works (evidence + PoC)

`CustomModuleManager` (`tools/installer/modules/custom-module-manager.js`) exposes the
exact primitives ma-agents needs:

- `resolveSource(input, {skipInstall:true, silent:true})` — parses input, clones a URL
  to `~/.bmad/cache/custom-modules` OR reads a local dir directly, reads
  `.claude-plugin/marketplace.json`, returns `{parsed, rootDir, marketplace, mode}`
  (`mode:'discovery'` when marketplace.json exists) (`:322-348`).
- `discoverModules(marketplace, sourceUrl)` — returns the normalized plugin list (`:304-312`).
- `resolvePlugin(...)` — resolves a plugin's skills for staging (`:577-606`).

The subset trick (proven by PoC step [4]): ma-agents enumerates, runs its **own**
multiselect, then **prunes** the marketplace.json to only the selected plugins and stages
that pruned marketplace + its module sources into a **local** directory. Because
`_resolveCustomSourcesCli` "auto-selects all discovered", installing from the pruned local
stage installs **exactly the subset** — under `--yes`, offline, zero core mods.

**This is not a new pattern for ma-agents** — `lib/bmad.js#stagePlugin` already stages
`lib/bmad-extension-plugin/` into `<projectRoot>/.ma-agents-plugin-stage/` and installs it
via `buildBmadArgs` → `bmad install ... --yes --custom-source ./<stage>` (`lib/bmad.js:94-192,
736-777`). The custom-marketplace feature is the same machinery with an enumeration +
subset-prune step in front.

**PoC result (`spike/30-5-enumerate-poc.js`, all PASS):**
```
[1] deep-require CustomModuleManager: parseSource/resolveSource/discoverModules/resolvePlugin = function
[3] LOCAL ENUM: parsed.type=local, mode=discovery, discovered codes = alpha-mod, beta-mod, gamma-mod  -> WORKS
[4] SUBSET-VIA-PRUNE: chose {alpha-mod,gamma-mod} -> staged codes = alpha-mod, gamma-mod             -> WORKS
[5] GIT-URL parseSource: type=url, isValid=true, cloneUrl=https://git.intra.example/team/..., version=v1.2.0 -> WORKS
```

---

## 2. `CustomModuleManager` surface — PINNED-INTERNAL (NFR17)

**Verdict: pinned-internal coupling, NOT a supported public API. Accept + mitigate.**

- `bmad-method` `package.json` has **no `exports` map** — only `main:
  "tools/installer/bmad-cli.js"` and `bin` (confirmed for **both** 6.9.0 and packed
  6.10.0). With no `exports` gate, Node permits deep subpath requires, so
  `require('bmad-method/tools/installer/modules/custom-module-manager')` **is reachable at
  runtime** (PoC step [1] loads it and constructs it).
- BUT the module lives under `tools/installer/modules/` (an installer-internal path) and is
  **not re-exported** from `main` (`bmad-cli.js` is a Commander bootstrap; grep shows no
  `CustomModuleManager` export). It is an installer internal, not a documented API surface.
- **Conclusion: pinned-internal.** Reachable-by-deep-require but unsupported; any bmad
  release could move/rename it without a semver signal. This is exactly the NFR17 risk the
  brief and `architecture.md:2608` call out.

**Surface stability across the pin bump (6.9.0 → 6.10.0):** all consumed methods exist with
identical signatures in the packed 6.10.0 (`parseSource`, `readMarketplaceJsonFromDisk`,
`discoverModules`, `resolveSource`, `cloneRepo`, `resolvePlugin`); `GIT_TERMINAL_PROMPT`
still used (5 occurrences); `_resolveCustomSourcesCli` "auto-selects all" behavior unchanged.

**Mitigation Stories 30.6/30.7 MUST carry (NFR17/NFR72):**
1. Wrap the deep require in **one** thin adapter module (single blast-radius point).
2. Keep the exact `bmad-method` version pin (already the project pattern).
3. Add a **surface drift/smoke test** that asserts `CustomModuleManager` and the four
   consumed methods are present at the pinned version and **fails loud** if the deep path
   or method set changes on a future pin bump.

---

## 3. Ambient-credential enumeration — local path AND Git URL

**local_path_enum: WORKS** (PoC step [3], hard evidence). `resolveSource` on a local dir
enters `discovery` mode, reads marketplace.json directly from disk
(`readMarketplaceJsonFromDisk`), performs **no clone and no network I/O**, and never
prompts — fully offline and non-interactive. Satisfies NFR71 (no public-internet egress).

**git_url_enum: WORKS by construction** (PoC step [5] proves parsing; live intra-perimeter
clone not executed — no reachable repo in the spike env). Evidence:
- `parseSource` yields a valid `url` descriptor for an intra-perimeter HTTPS URL
  (`https://git.intra.example/team/bmad-marketplace.git@v1.2.0` → `cloneUrl`, `version=v1.2.0`,
  `cacheKey`) and for SSH (`git@git.intra.example:team/...` → `type:url, isValid:true`).
- `cloneRepo` shells `git clone/fetch` with
  `env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }` (`custom-module-manager.js:415,424,449,
  474,479`). `GIT_TERMINAL_PROMPT=0` means git **never prompts interactively** (safe under
  `--yes`); `process.env` passthrough means the host's **ambient** credentials are honored —
  SSH agent keys, credential helper, `~/.git-credentials`, tokens in git config. ma-agents
  does zero token handling (satisfies FR241).
- **Fails clean:** on an unreachable/unauthorized remote with no cache, `cloneRepo` throws
  (`:483-487`); ma-agents' enumerate call (`resolveSource`) rethrows and the wizard surfaces
  the error and aborts the custom-source step without touching the base install
  (mirrors `ui.js:1040-1044`).

**Local-path parsing nuance (version-dependent — hand-off note):**
Under the **current 6.9.0 pin**, `parseSource` treats only `/`, `./`, `../`, `~`-prefixed
strings as local — a **bare Windows absolute** (`C:\...`) is **rejected** as
"Not a valid Git URL or local path" (PoC step [3] confirms `bare-abs rejected: yes`). This is
the same gotcha ma-agents already solved in `stagePlugin` by passing a **`./`-relative**
path (`lib/bmad.js:83-88,185-191`). Under the **target 6.10.0 pin**, FR238 / issue #2511 adds
`isLocalSourcePath()` which recognizes `path.win32.isAbsolute()` and `.\`/`..\` (confirmed in
the packed 6.10.0 source, lines 14-22,107). **Hand-off:** pass a **`./`-relative** stage
path — it is safe on both pins and cross-platform. Do not pass a bare `C:\...` absolute.

---

## 4. Explicit FALLBACK (graceful degradation)

If a future bmad release breaks the pinned-internal surface (drift test fails) or the
enumerate/subset mechanism regresses, the feature degrades to:

**Fallback A (primary):** ship the custom-marketplace feature **OFF by default** (NFR70 makes
a no-source install byte-identical to baseline, so "off" is a no-op). The base air-gapped
install of the exactly-five modules is unaffected.

**Fallback B (manual passthrough, no subset):** expose `--bmad-custom-source <url|path>` as a
thin passthrough to bmad-method's native `--custom-source` under `--yes`. This installs the
**entire** marketplace (no subset — per §1) but requires no `CustomModuleManager` reuse and
no ma-agents enumeration; it is pure bmad-method surface. The user curates the marketplace to
contain only what they want. Document the "installs all declared plugins" behavior.

Either fallback keeps Epic 30's safety spine (30.1–30.4) and the base install shippable
independent of the feature chain.

---

## 5. Hand-off design for Stories 30.6 / 30.7

### What the wizard calls (30.6)
1. **Prompt** (FR239): after module selection, `"Install additional BMAD extensions from a
   custom source? (y/N)"`; `--bmad-custom-source <url|path>` provides it non-interactively.
2. **Adapter.enumerate(source)** — thin wrapper over the pinned-internal surface:
   - `mgr = new CustomModuleManager()` (deep require, single call site).
   - `res = await mgr.resolveSource(source, { skipInstall: true, silent: true })` — clones
     (ambient creds) or reads local; `res.mode === 'discovery'` when marketplace.json present,
     else `'direct'` (treat as a single module per FR240).
   - `plugins = await mgr.discoverModules(res.marketplace, res.sourceUrl)`.
   - Surface a one-line NFR71 warning (custom content is outside the sealed-bundle guarantee).
3. **ma-agents' OWN multiselect** over `plugins` (FR126 single-wizard principle; bmad runs
   `--yes`). Returns `selectedCodes`.

### What gets staged + installed (30.6b)
4. **Prune + stage locally:** copy the selected plugins' sources into a project-local stage
   (reuse the `.ma-agents-plugin-stage` policy / a sibling stage dir) and write a
   `.claude-plugin/marketplace.json` containing **only** `selectedCodes`.
5. **Install:** append the stage as an **additional** local `--custom-source` (comma-joined
   with the existing extension stage) in `buildBmadArgs`, using a **`./`-relative** path.
   Because bmad auto-selects all declared codes and the stage declares only the subset,
   exactly the subset installs — offline, `--yes`. Reconcile Cline wrappers via the existing
   FR209/FR210 path (FR242).

### What persists (30.7)
6. `.ma-agents.json`: `{ customMarketplace: { source: "<url|path>", selectedCodes: [...],
   sha: "<resolved SHA for Git URLs>" } }`. `cloneRepo` already records the resolved SHA in
   `.bmad-source.json` (`custom-module-manager.js:491-534`) — read it back for the digest pin.
7. On `update`: re-run `enumerate`, reconcile (report added/removed; newly-appeared extensions
   are NOT auto-selected — NFR72); a missing/unreachable marketplace **fails loud** and never
   silently drops the persisted selection.

### Recommendation: SPLIT 30.6 → 6a / 6b — **YES**
The subset-handoff is nontrivial (prune-and-stage, `./`-relative path handling, the adapter +
NFR17 drift test, Cline-wrapper reconcile). Clean seam:
- **30.6a** — prompt + `--bmad-custom-source` flag + `enumerate` adapter (with the pinned-internal
  drift/smoke test) + ma-agents multiselect UI + NFR71 warning. Independently testable against a
  local fixture marketplace.
- **30.6b** — prune + stage + install-the-subset via `buildBmadArgs` + Cline-wrapper reconcile.
Depends on 30.6a. 30.7 (persist + re-enumerate) then depends on 30.6b.

---

## Unresolved / caveats
- **Live Git-URL clone not executed** — no reachable intra-perimeter repo in the spike env.
  git_url_enum is proven by source + parse evidence, not a live end-to-end clone. 30.6a should
  include one live-clone test against a real intra-perimeter/local-bare Git repo.
- **PoC runs against the installed 6.9.0.** Surface + behavior confirmed identical in the packed
  6.10.0, but the actual 6.10.0 pin bump lands in Story 30.3 — re-run the drift test after that bump.
- `resolvePlugin`/staging fidelity (skill-leaf uniqueness, `_copyResolvedSkills` fail-loud per
  FR238) is exercised only structurally here; 30.6b must verify a real multi-skill plugin stages
  with unique leaf dirs.
