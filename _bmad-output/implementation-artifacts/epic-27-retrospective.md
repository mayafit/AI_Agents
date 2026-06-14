# Epic 27 Retrospective — BMAD-METHOD v6.8.0 Integration (Phase 5)

**Date:** 2026-06-13
**Worktree / branch:** `agent-a92551b41c3ae4ab3` / `chore/27-7-release-gate-6-8-0`
**Status:** Complete — all 7 stories delivered; release v3.13.0 cut; offline guarantee re-proven.

---

## 1. Epic Goal & Outcome

**Goal.** Upgrade `bmad-method` v6.6.0 → v6.8.0 without breaking the air-gapped install.
BMAD 6.7.0 retired the in-package module-registry YAML
(`tools/installer/modules/registry-fallback.yaml`) and 6.8.0 RELOCATED the external-module
list to the package root (`bmad-modules.yaml`) — still YAML with the same `modules:` map
shape, but the old `built_in` flag was replaced by a `type` field. `build-bmad-cache.js`'s
`REGISTRY_CANDIDATES` no longer found the file, which silently broke the bundled-module
build for offline installs (NFR2/NFR50/NFR54).

**Why it mattered.** The offline/air-gapped install is the single most consequential
guarantee in this repo. A relocated registry that resolves *zero* (or a *thin*) module set
would have shipped a cache that "looks" populated but is actually broken — and the failure
would only surface on a disconnected customer machine, the worst place to discover it.

**Outcome.** Goal met. The reader now resolves the v6.8.0 package-root registry, keys the
bundle decision off `type: bmad-org`, defaults the (now-absent) `branch` to `main`, and —
critically — **fails loud** if it ever resolves fewer than the known bundled set
(`tea, bmb, cis, gds, wds`) or hits duplicate codes, aborting before any manifest is
written (NFR56). The pin moved to 6.8.0, cache + plugin bundle were rebuilt, the suite is
green on Windows, and the air-gapped install was re-proven end-to-end under
`--network none` with all five modules pre-populated and zero network calls (NFR57/NFR50).

---

## 2. What Shipped (per story)

- **27.1 — Registry-reader rework spike (gate).** Confirmed against the live v6.8.0 source
  and a real install: the registry is package-root YAML (not JavaScript), and `wds` is
  ACTIVE (`type: bmad-org`), not retired. Corrected an initial planning misstatement that
  had assumed a JS module and a retired `wds`. P5-5 path/type-filter design confirmed.
- **27.2 — Point `build-bmad-cache` at the relocated registry (FR207).** Added the
  package-root candidate (tried first), swapped the `built_in` exclusion for a
  `type: bmad-org` inclusion filter (case-insensitive + trimmed), defaulted `branch` to
  `main`, and kept the two older paths as *diagnostic-only* candidates so a downgrade
  reports a precise version-mismatch rather than a bare "nothing found".
- **27.3 — Registry schema tests + fail-loud (FR208/NFR56).** Pinned the relocated-YAML
  contract with fixtures, added the thin-cache and duplicate-code guards, and inverted the
  former `wds`-retired assertions to assert `wds` is an active clone.
- **27.4 — Cline workflow-wrapper reconciliation (FR209).** `deployClineWorkflows` now
  deletes stale `.clinerules/workflows/*.md` wrappers whose backing skill dir is gone,
  scoped strictly to the generated-wrapper fingerprint; idempotent; user files untouched.
- **27.5 — Bump to 6.8.0, rebuild cache/plugin, green the suite.** Pin bumped;
  `BMAD_TARGET_VERSION` → 6.8.0; cache + plugin regenerated; the Windows suite-health /
  CRLF confounder resolved (not waived).
- **27.6 — PluginResolver + skill-enumeration passthrough verification.** Confirmed the
  resolver compat and that ma-agents owns no upstream skill bodies (passthrough via
  `extends-module: bmm`); renamed/new skills get wrappers, retired ones do not.
- **27.7 — Release gate (this story).** Adversarial + edge-case review of the cumulative
  diff, the egress-blocked offline gate, the cross-platform suite, the v3.13.0 semver cut +
  CHANGELOG, and this retrospective.

---

## 3. What Went Well

- **Fail-loud was the right design call.** The epic correctly identified that, post-6.8.0,
  the real risk is no longer "zero modules" but the path moving *again* and the reader
  resolving FEWER than expected. The thin-cache + duplicate-code guards turn every future
  registry relocation into a loud build failure instead of a silent broken cache. The
  release-gate adversarial review tried hard to slip a thin set past the guard and could
  not — every degradation path (type-filter drift, inline-comment capture, missing fields)
  funnels into the guard's `process.exit(1)` before the manifest write.
- **The offline gate is genuinely strong evidence.** Because Docker was available locally,
  27.7 ran the *actual* CI harness (`offline-install-verify.sh`) under `--network none`,
  not a simulation. The run proved egress was blocked (curl to the registry failed at
  step 1), then installed all five bundled modules from cache with zero network calls and
  bmad-method reporting v6.8.0 — the headline guarantee, demonstrated rather than asserted.
- **Tight, surgical source diff.** The net product change was small and well-isolated:
  `scripts/build-bmad-cache.js` (reader + guards) and `lib/bmad.js` (Cline reconciliation +
  the version bump constant). The bulk of the diff is the regenerated vendored cache and
  test coverage — exactly the right ratio for an integration epic.
- **Self-correcting planning.** The 27.1 spike caught the "JS registry / retired wds"
  misstatement before any code was written against the wrong assumption, and the
  sprint-status log recorded the correction transparently.

---

## 4. What Was Hard / Surprises

1. **Two stale `wds`-retired references survived into the release gate.** Despite 27.1/27.3
   correcting the `wds`-is-active understanding in the build script and tests, the
   user-facing `BMAD_MODULE_DESCRIPTIONS.wds` string in `lib/bmad.js` still read
   "Web Dev Studio — retired upstream", and a docblock still cited `(e.g. wds)` as a
   retired example. Caught and fixed in the 27.7 adversarial review. Lesson: when a fact
   (a module's status/name) is corrected, grep the *whole* repo for every restatement of
   it — correctness fixes in code/tests don't automatically reach human-readable strings.
2. **The Windows worktree regen churn is a sharp trap.** Running `npm install` (and
   `npm pack`) in the worktree fires the `prepare`/`version` → `build-plugin` hooks, which
   regenerate hundreds of tracked `.agents/skills/**` files plus root `AGENTS.md`,
   `_bmad-output/project-context.md`, `skills/git-workflow-skill/skill.json`, and temp
   `lib/.bmad-extension-plugin.build-*` dirs. None of it should be committed. It is easy to
   `git add -A` this by reflex and pollute the release PR. Required a deliberate
   `git restore` + `git clean` pass to isolate the two intentional edits.
3. **CRLF bit the offline gate harness, not just the test suite.** The committed-LF
   `offline-install-verify.sh` checks out as CRLF on Windows; running it inside the Linux
   container failed at `set -euo pipefail` (`$'\r': command not found`). Worked around by
   piping a CR-stripped copy via stdin — but this is the same EOL confounder that has now
   surfaced in three different places across Epics 26-27 (migration.test.js, the suite
   chain, and now the shell harness).
4. **The `file://` offline-origin URL was RFC-malformed but accidentally worked.** The
   pre-existing `restoreGitDir` built `file://C:/...` (two slashes); a real `git fetch`
   reproduction showed current git tolerates it on Windows, but it breaks on paths with
   spaces and is not a URL git is contractually required to accept. Hardened to
   `pathToFileURL()` in the gate since this code is now load-bearing for the full bundled
   set on every offline install (pre-Epic-27 only `bmm` was requested, masking it).

---

## 5. Process Metrics

- **Stories:** 7 (27.1 spike/gate, 27.2 reader, 27.3 schema tests, 27.4 Cline reconcile,
  27.5 pin bump, 27.6 resolver verify, 27.7 release gate). Execution order
  27.1 → 27.2 → 27.3 → 27.5 → 27.6 → 27.7 with 27.4 parallel — respected.
- **Release:** v3.12.3 → **v3.13.0** (MINOR — inherits upstream v6.8.0 features + reworks
  the cache reader with no breaking change to the ma-agents public CLI surface). Consistent
  with prior integration epics (24 → minor, 25 → minor).
- **Release-gate review:** two parallel review passes (cynical-adversarial + edge-case
  hunter) over the cumulative diff. Findings triaged must-fix / nice / wontfix. Two
  must-fix items folded in (the `file://` URL hardening + `execFileSync`; the `wds`
  description/docblock correction); the remainder were either gated by the fail-loud guard
  (degrade to a loud abort, never a silent thin cache) or out-of-scope/pre-existing and
  deferred to the recommendations below.
- **Offline gate:** real `--network none` Docker run of the CI harness — PASSED, 5/5
  modules from cache, zero network calls.

---

## 6. Recommendations / Follow-ups

1. **Pin shell-script EOL in `.gitattributes`.** Add `*.sh text eol=lf` (or specifically
   `.github/scripts/*.sh text eol=lf`) so the offline-gate harness and any other shell
   script run identically from a Windows checkout. This is the third EOL-confounder
   sighting; the Epic 26 retro already recommended pinning the MIL-498 template pairs —
   widen that fix to shell scripts so neither the suite nor the offline harness trips CRLF
   on Windows worktrees.
2. **Harden the parser against inline comments on consumed fields (low priority).** The
   line-by-line registry parser captures an inline `# comment` into an *unquoted* value
   verbatim. Today no consumed field (`code`/`url`/`name`/`type`) carries one, and any
   future drift would trip the fail-loud guard rather than ship silently — but stripping a
   trailing ` # …` from unquoted values would convert a confusing abort into a clean parse.
   Track as a nice-to-have; do not expand a release scope for it.
3. **Consider escalating the EBUSY classifier when the cache is also incomplete.** In
   `classifyRecompileFailure`, an EBUSY-tagged error short-circuits to `warn` before the
   offline/cache-incomplete branch. On Windows it is conceivable for a failed offline
   `git fetch` cleanup to surface as EBUSY while the vendored cache is genuinely
   incomplete, in which case the user gets "re-run if personas look incomplete" instead of
   the actionable missing-modules remediation. Pre-existing (from the air-gapped-recompile
   bug fix), out of Epic 27 scope — but worth a guarded fix: when offline indicators are
   *also* present, let `cache.intact === false` win.
4. **Add a "growth" note or assertion for `KNOWN_BUNDLED_MODULES`.** The thin-cache guard
   only catches a *shrinking* bundle. If upstream promotes a new `bmad-org` module (e.g.
   `automator` graduating from experimental), the build silently starts shipping it
   air-gapped without a code change. That is arguably desirable, but make the intent
   explicit so a maintainer reviews bundle-set growth.
5. **Grep the whole repo when a domain fact is corrected.** The `wds`-retired strings that
   survived 27.1/27.3 are a reminder: a status/name correction must sweep code, tests, AND
   human-readable description strings/docblocks in one pass.
