---
type: bug
status: ready-for-dev
severity: high
bug_type: regression
version_found: 3.5.3
title: BMAD recompile failed on disconnected (air-gapped) network install
---

# Bug: BMAD recompile failed on disconnected (air-gapped) network install

**Severity:** high
**Affected Component:** installer pipeline — `lib/bmad.js` recompile stage (wraps `bmad-method/tools/bmad-npx-wrapper.js`)

## Reproduction Steps

1. Provision a host with **no outbound internet access** (air-gapped / on-prem lab) but with `node_modules/bmad-method` already vendored (i.e. install performed from an offline `npm ci` or bundled tarball).
2. Run `npx ma-agents install` (v3.5.3) targeting a fresh project directory.
3. Pipeline reaches the "Running: node …/bmad-npx-wrapper.js install …" stage.
4. Upstream `bmad-method` (6.2.2) installer invokes `git fetch origin --depth 1` / `git clone --depth 1 <url>` to refresh external modules (bmb, gds, tea, wds, cis) — see `node_modules/bmad-method/tools/cli/installers/lib/modules/manager.js` around lines 284–332 — and also shells out to `npm install --omit=dev` for those modules' deps (line 346).
5. All three network operations fail (no DNS / no route / git prompts disabled by `GIT_TERMINAL_PROMPT=0`). `execSync` throws.
6. `lib/bmad.js:366` catches and prints `BMAD recompile failed: <error.message>`. The install continues past this point (the try/catch swallows) and the user is left with a partially configured BMAD tree with a scary red error.

## Expected Behavior

On an air-gapped host where the ma-agents bundled cache has been pre-populated into `~/.bmad/cache/external-modules/`, the recompile step should:

1. Detect offline mode (either explicitly via a flag/env, or implicitly when upstream fetch fails but a valid cache is present).
2. Skip network fetches and proceed with the cached modules.
3. Either succeed silently, or, if it must fail, emit a **clear, actionable** error explaining (a) that the network is unreachable, (b) which cached modules are present, and (c) what the operator should do next (retry with `--offline`, populate the cache, etc.).

## Actual Behavior

- Upstream `bmad-method` unconditionally attempts `git fetch`/`git clone`/`npm install` even when the cache directory already has valid, fully-populated modules.
- `lib/bmad.js` catches the resulting error and prints a one-line red banner: `BMAD recompile failed: Command failed: node "…/bmad-npx-wrapper.js" install …` — which surfaces in `bmad-npx-wrapper.js` because that is the entry point.
- The error gives no indication that (a) the problem is network-related, (b) the bundled cache *is* present and could be reused, or (c) how the operator should recover.
- Because the try/catch swallows the error, later stages (EXTENSION, WORKFLOWS, templates, MIL registries) run against a partially-compiled `_bmad/` tree and can produce additional confusing failures downstream.

## Root Cause Hypothesis

Two contributing causes:

1. **Upstream coupling** — `bmad-method@6.2.2` (`installers/lib/modules/manager.js`) has no `--offline` switch and always runs `git fetch` on existing cache dirs. We cannot fix this in-place, but we *can* detect the failure mode and stop bleeding into later stages.
2. **ma-agents lossy error handling** — `lib/bmad.js:363-367` catches *any* recompile failure (network, config, assertion, etc.) and continues silently. No offline-specific diagnosis, no cache-presence check, no actionable remediation.

## Affected Files

- `lib/bmad.js` (lines 28–37 `getBmadCommand`, 347–367 recompile try/catch, 629–683 `prePopulateBmadCache`)
- `test/` — new regression test required (`test/offline-recompile.test.js`)

## Suggested Fix

Add an offline-safe code path in `lib/bmad.js`:

1. Expose `isOfflineMode()` helper — true when `MA_AGENTS_OFFLINE=1` or when upstream recompile fails AND the vendored cache has been successfully pre-populated (`~/.bmad/cache/external-modules/<module>` exists for every module in `lib/bmad-cache/cache-manifest.json`).
2. At the recompile catch site, classify the failure:
   - If offline mode is active **and** cache is intact → downgrade to a `warn`-level diagnostic ("network unavailable — proceeded with vendored cache") and continue.
   - If offline mode is active **but** cache is incomplete → emit an actionable error listing the missing modules and the remediation command (`npm run build:bmad-cache`).
   - Otherwise → re-throw so the operator sees a loud failure instead of a swallowed one.
3. Add a regression test that mocks `execSync` to throw an ENOTFOUND-style error and asserts (a) we do not crash, (b) we emit the offline-mode diagnostic, (c) we do not re-throw when the cache is intact.

## Notes

- Created via `create-bug-story` workflow (non-interactive — bug B pipeline).
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- Related skill: `devops-disconnected-deployment` — same target-environment assumptions.
- Related epic: 21 (On-Prem / Local-LLM Tuning) — on-prem is a documented supported deployment target.

## Dev Agent Record

**Branch:** `worktree-agent-ab0035d4`
**Status:** in-progress → review (after CR)

### Fix summary

- `lib/bmad.js` — added four exported helpers: `isOfflineModeDeclared()`, `looksLikeOfflineFailure(error)`, `inspectBmadCache(cacheRoot?)`, `classifyRecompileFailure(error, { cacheInspector? })`.
- `lib/bmad.js` — at the `applyCustomizations()` recompile catch site (~line 366), replaced the single red-banner `BMAD recompile failed` with a 3-way classified diagnosis:
  - `warn`  → yellow diagnostic, install continues (offline + cache intact)
  - `error` → actionable red message listing missing cache modules and the `npm run build:bmad-cache` remediation (offline + cache incomplete)
  - `rethrow` → prints red as before (non-network failures — no behaviour change)
- `test/offline-recompile.test.js` — new 13-test regression suite; mocks `process.env.MA_AGENTS_OFFLINE` and injects a fake cache inspector so the test runs deterministically without spawning subprocesses.
- `package.json` — appended new test to the `test` script.

### Offline simulation approach

Rather than spawning a real air-gapped subprocess (not tractable in a Windows worktree), the test:

1. Constructs synthetic `Error` objects with realistic messages (`ENOTFOUND`, `fatal: unable to access...`, `ECONNREFUSED`) — matching what `execSync` emits when `git fetch`/`git clone`/`npm install` hit DNS failures on an air-gapped host.
2. Mocks the cache-inspector via dependency injection (`classifyRecompileFailure(err, { cacheInspector: () => ({ ... }) })`) to test both intact-cache and missing-module cases.
3. Toggles `process.env.MA_AGENTS_OFFLINE` to exercise explicit vs inferred offline detection.

### Limitations

- We do not patch bmad-method 6.2.2 itself; it still attempts `git fetch`/`git clone`/`npm install` unconditionally (its `cloneExternalModule` has no `--offline` switch). Our fix is post-hoc: we classify the resulting failure and give the operator clear recovery guidance. The pre-existing `restoreGitDir()` helper (lib/bmad.js:1305) already rewrites the `origin` URL to `file://` so `git fetch` becomes a local no-op for already-cached modules — this is the primary defence; our change is the safety net when that defence is defeated (e.g. a newly-added module not yet in the vendored cache).
- An upstream fix (or a wrapper shim under `lib/bmad-extension/`) that intercepts `cloneExternalModule` to short-circuit on cache-hit would be a cleaner long-term solution. Out of scope here — recommend filing a follow-up story under Epic 21.

### Test verification

```
$ node test/offline-recompile.test.js
  ... 13 passed, 0 failed
```

Other related tests (`build-bmad-args.test.js`, `migration.test.js`) still pass. One unrelated pre-existing failure in `bmad-version-bump.test.js` is caused by the worktree lacking a populated `node_modules/bmad-method` — not introduced by this change.

### Code review (adversarial)

- **F1 (Low)** — `action: 'rethrow'` is advisory; the `applyCustomizations()` caller still prints-and-continues (historical behaviour preserved to avoid breaking mid-pipeline failure recovery). Clarified in JSDoc.
- **F2 (Low, fixed)** — removed `'proxy'`/`'ssl'`/`'certificate'` heuristics that risked false-positives on benign YAML errors referencing cert-generation skills. Final needle list targets DNS/git/connection errors only.
- **F5 (Low)** — cache "intact" check is directory-presence only; acceptable because `prePopulateBmadCache()` runs first and performs structural repair. Documented.
- **AC coverage** — "detect air-gapped condition": done. "Skip network ops when vendored": partial — upstream still attempts the calls; we recover gracefully. "Surface clearer actionable error": done. "Unit test simulating offline mode": done.
- Verdict: **APPROVED** — no High findings, Med/Low findings resolved or documented.
