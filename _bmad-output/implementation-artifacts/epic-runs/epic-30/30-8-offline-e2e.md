# Story 30.8 — Offline E2E Verification (Epic 30 release gate)

Scope: the strongest offline verification available inside this sandbox
(no Docker daemon reachable from this agent's shell), plus a runbook for the
one proof that genuinely needs a clean-Windows `docker --network none` box.
All commands below were run directly in the worktree
(`.worktrees/epic-30-story-30-8`, branch `feature/epic-30-story-30-8`) against
`node_modules/bmad-method@6.10.0` (installed via `npm install --ignore-scripts`
at the start of this story — a fresh worktree ships no `node_modules/`).

## Part A — executed in this sandbox (all green)

### A1. Bundle resolves to exactly {tea,bmb,cis,gds,wds}, bmad-loop absent (reuses the 30.3 approach)

Command: `node test/bmad-version-bump.test.js` — reads the LIVE installed
`node_modules/bmad-method/bmad-modules.yaml` (no fixture), asserts `bmad-loop`
carries `type: bmad-org` + `marketplace-plugin: true` at 6.10.0, then runs the
real `normalizeModules(parseModulesYaml(rawText))` reader against that live
YAML.

```
Task 1: package.json dependency
  ✓ package.json pins bmad-method at 6.10.0 (exact, no caret/tilde)
  ✓ installed bmad-method is version 6.10.0
  ✓ AC (P5-8 gate): live-installed bmad-modules.yaml is at the package root, schema unchanged, bmad-loop present-but-excluded
  ✓ require.resolve finds bmad-cli.js (6.10.0 entry point)
  ...
  ✓ cache-manifest.json contains EXACTLY the five allowlisted modules — bmad-loop absent
36 passed, 0 failed
```

Command: `node test/bundle-filter-set-equality.test.js` — the closed-allowlist
filter + two-sided `diffBundleSet` set-equality guard, including a
real, no-network, end-to-end script spawn that aborts the build (no manifest
written) when an allowlisted module's shape flips.

```
✓ exactly the five allowlisted modules survive the live 6.10.0 registry
✓ bmad-loop (type: bmad-org + marketplace-plugin: true) is EXCLUDED — the exact 30.1 break
✓ bmad-automator (deprecated experimental) is EXCLUDED
✓ a plain NEW type: bmad-org module carrying NEITHER flag FAILS CLOSED (excluded)
...
✓ an allowlisted module carrying marketplace-plugin: true aborts the build, no manifest
✓ a deficient set still aborts (thin-cache regression) with no manifest
19 passed, 0 failed
```

**Conclusion:** at the live-installed `bmad-method@6.10.0`, the resolved
bundle set is exactly `{tea, bmb, cis, gds, wds}`. `bmad-loop` is present in
the upstream registry but is excluded by the closed-allowlist filter and never
appears in `lib/bmad-cache/cache-manifest.json`.

### A2. `build:plugin` is drift-clean

```
$ git status --short          # clean before rebuild
$ node scripts/build-plugin.js
[build-plugin] source : lib\bmad-extension
[build-plugin] output : lib\bmad-extension-plugin
[build-plugin] bundle assembled
$ git diff --exit-code -- lib/bmad-extension-plugin/
DRIFT-CLEAN   (exit 0, no diff)
```

The plugin bundle (`lib/bmad-extension-plugin/`) regenerates byte-identical
to what is committed — no drift from a fresh rebuild against the live
6.10.0 install.

### A3. Regression-verify the two NEW 6.10.0 staging behaviors (ma-agents' own `--custom-source` path)

Command: `node test/staging-6-10-0-regression.test.js`

```
Group A: isLocalSourcePath (upstream #2511) via parseSource()
  ✓ ma-agents' actual --custom-source arg (./PLUGIN_STAGE_DIR_NAME) resolves to type 'local'
  ✓ 6.10.0 NEW: recognizes a .\-prefixed Windows-relative path
  ✓ 6.10.0 NEW: recognizes a ..\-prefixed Windows-relative path
  ✓ 6.10.0 NEW: recognizes a Windows-absolute path via path.win32.isAbsolute
  ✓ regression: POSIX local-path forms recognized at 6.9.0 remain recognized at 6.10.0
  ✓ regression: a genuine remote Git URL is NOT misclassified as local
Group B: _copyResolvedSkills fail-loud (NEW at 6.10.0) against the real staged plugin
  ✓ PluginResolver resolves the real ma-skills plugin to a NON-EMPTY skill set
  ✓ resolved skill directories have UNIQUE leaf (basename) names
  ✓ OfficialModules._copyResolvedSkills completes end-to-end (no throw)
  ✓ _copyResolvedSkills THROWS on a duplicate skill leaf name (regression)
  ✓ PluginResolver.resolve() returns [] for a plugin declaring no skills
15 passed, 0 failed
```

### A4. Demerzel deprecation — non-destructive + notice mechanics

```
$ node test/demerzel-deprecation-notice.test.js    -> 10 passed, 0 failed
$ node test/demerzel-ml-removal-drift.test.js       -> 15 passed, 0 failed
```

Confirms: no `ma-agent-ml`/`ml-*` directory survives in either the source or
generated skill tree; `module-help.csv` and `marketplace.json.template` carry
no stale rows/entries; the post-removal plugin resolves non-empty with unique
skill leaf names (satisfying 6.10.0's fail-loud `_copyResolvedSkills` guard);
`lib/agents.js`/`lib/skill-authoring.js` carry no `bmm-demerzel` registration;
the one-time deprecation notice is idempotent and coexists with other
`.ma-agents.json` fields without disturbing them.

### A5. Custom marketplace persist/reconcile (Story 30.7)

```
$ node test/custom-marketplace-persist-reconcile.test.js   -> 19 passed, 0 failed
```

Confirms: successful subset install persists `source`/`sourceUrl`/`mode`/
`selectedCodes`/`sha`; a persistence failure is logged but does not turn a
successful `bmad-method` install into a reported failure; re-enumeration on
update reports added/removed codes and never silently folds a newly-declared
plugin into the existing selection; an unreachable persisted source leaves
`.ma-agents.json` byte-for-byte unchanged (fail-loud, retried on next update).

### A6. Working tree stayed clean throughout

`git status --short` was empty both before and after `npm install
--ignore-scripts`, the full test run, and the `build:plugin` rebuild — no
`.agents/**`, `AGENTS.md`, or `atlas.cjs` churn to discard.

## Part B — runbook: clean-Windows `docker --network none` E2E (NOT executed here)

This sandbox has no reachable Docker daemon, so the full container-isolated
E2E was not run as part of this story. The repo already ships a CI-grade
version of exactly this gate — `.github/workflows/offline-install.yml` +
`.github/scripts/offline-install-verify.sh` — which a human/CI runner should
execute on a clean Windows machine (with Docker Desktop, WSL2 backend) before
cutting the 3.17.0 release:

1. **Prerequisites:** Docker Desktop for Windows (WSL2 backend) installed and
   running; a clean checkout of `feature/epic-30` (or the release branch)
   with no prior `node_modules/`.
2. **Install deps on the host (online, one time):**
   ```powershell
   npm ci --no-audit --no-fund
   ```
   This also triggers `prepare` -> `build:plugin` + `build:atlas`, staging
   `lib/bmad-extension-plugin/` and `lib/knowledge-atlas/dist/atlas.cjs` for
   the tarball.
3. **Pre-pull the offline image while the host still has network:**
   ```powershell
   docker pull node:20.18.1-bookworm@sha256:968ca0550acc7589a8b1324401ec6e39ace53b2c82d2aed3a278e9ff491c2b1c
   ```
   (Use the `bookworm` — not `-slim` — variant; `bmad.js` shells out to `git`
   during the offline-install path and `--network none` blocks any runtime
   `apt-get install`.)
4. **Build the tarball:**
   ```powershell
   npm pack
   ```
5. **Run the offline gate exactly as CI does**, mounting the repo read-only
   and setting `TARBALL` to the packed filename:
   ```powershell
   docker run --rm --network none `
     -v "${PWD}:/workspace:ro" `
     -e TARBALL="ma-agents-3.17.0.tgz" `
     node:20.18.1-bookworm@sha256:968ca0550acc7589a8b1324401ec6e39ace53b2c82d2aed3a278e9ff491c2b1c `
     bash /workspace/.github/scripts/offline-install-verify.sh
   ```
   The script (unmodified, reused from CI): verifies egress really is
   blocked (curl to `registry.npmjs.org` must FAIL), unpacks the tarball,
   symlinks the host's `node_modules` in (no `npm install` under
   `--network none`), runs `node bin/cli.js install --yes --force --agent
   claude-code` against a fresh scratch project, asserts the post-install
   invariants (`_bmad/` tree present, no legacy `_bmad/_config/custom/agents`,
   `.claude/skills/ma-agent-cyber` present, plugin stage dir cleaned up,
   exactly-one `.gitignore` entry for the stage dir, no per-skill-dir stray
   `.gitignore`), then generates a minimal Atlas site fully offline and
   re-checks the egress block still holds afterward.
6. **For this story specifically**, additionally re-run the two Epic-30
   assertions inside the same container (or immediately after, on the host,
   since they only need the local install — no network either way):
   ```powershell
   node test/bmad-version-bump.test.js
   node test/bundle-filter-set-equality.test.js
   ```
   confirming the packed tarball's `bmad-method` dependency is the live
   6.10.0 install and the bundled cache excludes `bmad-loop`.
7. **Pass/fail:** the workflow's own summary block reports tarball size and
   install duration; a non-zero exit from `offline-install-verify.sh` (exit
   codes 10/20/30 for egress-not-blocked / extraction failure / invariant
   violation respectively) fails the gate.

**CRLF position-13 caveat.** Do **not** run bare `npm test` as a substitute
verification step on Windows — it halts partway through the suite at a
pre-existing MIL-498 template CRLF drift (fails at byte/position 13 in a
line-ending-sensitive fixture comparison), unrelated to Epic 30. It also
regenerates `.agents/` as a side effect, which must then be discarded before
committing. This is a long-standing Windows-only baseline issue (reproduces
identically on `main`), not a regression from this epic. Always use the
targeted per-file `node test/<file>.test.js` invocations shown above (or the
package-integrity gate's own targeted list in `package.json`'s `test`
script) instead.

## Summary

| Check | Method | Result |
|---|---|---|
| Bundle resolves to exactly `{tea,bmb,cis,gds,wds}`, `bmad-loop` absent | Real reader vs. live-installed 6.10.0 registry (`test/bmad-version-bump.test.js`, `test/bundle-filter-set-equality.test.js`) | PASS (55 assertions, 0 failed) |
| `build:plugin` drift-clean | `node scripts/build-plugin.js` + `git diff --exit-code` | PASS (no diff) |
| Staging regressions (#2511, fail-loud `_copyResolvedSkills`) | `test/staging-6-10-0-regression.test.js` | PASS (15/15) |
| Demerzel deprecation non-destructive + notice | `test/demerzel-deprecation-notice.test.js`, `test/demerzel-ml-removal-drift.test.js` | PASS (25/25) |
| Custom marketplace persist/reconcile | `test/custom-marketplace-persist-reconcile.test.js` | PASS (19/19) |
| Full clean-Windows `docker --network none` E2E | Runbook (Part B) — reuses existing `.github/workflows/offline-install.yml` | **NOT EXECUTED in this sandbox** — documented for a human/CI runner |
| Working tree clean throughout | `git status --short` before/after | Clean |
