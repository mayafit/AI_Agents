# Story 30.2: Closed-by-default Bundle Filter + Two-sided Set-EQUALITY Thin-cache Guard

Status: review

## Story

As a **ma-agents maintainer preparing the BMAD v6.10.0 integration**,
I want `scripts/build-bmad-cache.js` to bundle offline modules from a **closed
allowlist** (include only `{tea, bmb, cis, gds, wds}`) and to fail the build loud
whenever the resolved bundle set does not **exactly equal** that allowlist —
whether it is SMALLER (thin cache) or LARGER (a silent upstream addition),
So that `bmad-loop` (and any future `type: bmad-org` module) can **never** be
force-bundled and installed-by-default onto an air-gapped machine, and a shape/
status flip on a module we DO bundle halts the build instead of shipping silently.

**Depends on Story 30.1** (the v6.10.0 confirmation gate — PASS). This story is
the safety spine and is independently shippable at the current `bmad-method@6.9.0`
pin; it does **not** bump the pin (that is Story 30.3).

**FR:** FR235. **NFR:** NFR73 (two-sided set-EQUALITY; strengthens/supersedes
NFR56 for this cache), re-asserting NFR2/NFR54/NFR57 (air-gapped self-containment).

## Context (from the 30.1 GATE — do not re-investigate)

The gate (`epic-runs/epic-30/30-1-gate-findings.md`) verified live against
`bmad-method@6.10.0`:

- Registry `type: bmad-org` set = `{bmad-loop, tea, bmb, cis, gds, wds}`.
- `bmad-loop` = `type: bmad-org` **+ `marketplace-plugin: true`** (air-gap-hostile
  Python/tmux/hooks orchestrator).
- `bmad-automator` = `type: experimental` **+ `deprecated: true`**.
- Registry PATH/SCHEMA unchanged vs 6.9.0 (new fields additive/optional) → the
  P5-5 reader/parser carry forward **verbatim**; only the filter predicate + the
  guard change.

**The reproduced break:** the old `normalizeModules()` kept *every* `type:
bmad-org` entry (open-by-default), so it emitted 6 modules including `bmad-loop`.
The old thin-cache guard only failed on a set SMALLER than the allowlist → it saw
`MISSING=(none)` and **ignored the EXTRA `bmad-loop`**, which would then be cloned
into the cache and force-installed (ma-agents' default `--modules` = every bundled
cache module). That is the bug this story closes.

## Acceptance Criteria

1. **Given** the parsed registry, **When** `normalizeModules()` runs, **Then** it
   includes **only** codes in `KNOWN_BUNDLED_MODULES` (`{tea, bmb, cis, gds, wds}`)
   — a **closed allowlist**. Every non-allowlisted entry is dropped regardless of
   its `type` (so `bmad-loop`, `bmad-automator`, `experimental`, and any future
   plain `bmad-org` module all fail closed).

2. **Given** an entry that IS on the allowlist, **When** it carries
   `marketplace-plugin: true` **or** `deprecated: true` (a shape/status flip on a
   module we bundle), **Then** the build **HALTS** (throws) with an actionable
   message rather than silently shipping it.

3. **Given** the resolved (filtered) bundle set, **When** `main()`'s fail-loud
   guard runs, **Then** it enforces **two-sided set-EQUALITY**: it aborts (exit
   non-zero, **no** manifest written) if the set is MISSING any allowlisted code
   (thin cache) **or** contains any EXTRA code (silent upstream addition).

4. **Given** the guard, **When** it computes equality, **Then** it does so on the
   **RESOLVED registry set** (the codes `normalizeModules()` kept), **NOT** the
   final manifest keys — the incremental-retention path in `main()` deliberately
   augments the manifest with non-allowlist retired-upstream modules (AC #7 of the
   27.x retention design), which must not be mistaken for EXTRA.

5. **Given** unit tests, **When** they drive `normalizeModules()` over a live-6.10.0
   -shaped fixture, **Then** they prove: exactly the five survive; `bmad-loop`
   (bmad-org + marketplace-plugin) is excluded; `bmad-automator` (deprecated) is
   excluded; and a **plain NEW `type: bmad-org` module carrying NEITHER flag** also
   fails closed (excluded).

6. **Given** a test for the exact bug, **When** an EXTRA module is present in a
   resolved set, **Then** the guard reports it (`diffBundleSet` returns a non-empty
   `extra`) — proving the two-sided half the old subset-only NFR56 guard missed.

7. **Given** the pin scope boundary, **When** this story lands, **Then**
   `package.json`'s `bmad-method` dependency is **unchanged at 6.9.0** (the bump is
   Story 30.3), the committed 6.9.0 cache manifest is unaffected (the filter still
   resolves the same five for 6.9.0), and `npm run build:plugin` passes with no
   bundle drift.

## Tasks / Subtasks

### Task 1: Close the filter to an allowlist + shape-flip halt (AC: 1, 2)

- [x] 1.1 Replace the `type: bmad-org` include predicate in `normalizeModules()`
      with a closed allowlist filter (`KNOWN_BUNDLED_MODULES.includes(code)`).
- [x] 1.2 Add `isFlagTrue()` and `DISQUALIFYING_FLAGS = ['marketplace-plugin',
      'deprecated']`; throw from `normalizeModules()` when an allowlisted entry
      trips a flag.
- [x] 1.3 Refresh the `KNOWN_BUNDLED_MODULES` / `BUNDLED_MODULE_TYPE` docblocks to
      state the closed-by-default posture and the shape-flip contract.

### Task 2: Two-sided set-EQUALITY guard (AC: 3, 4)

- [x] 2.1 Add pure exported `diffBundleSet(resolvedCodes, allowlist?)` → `{ missing,
      extra }` (both sorted; empty+empty = equal).
- [x] 2.2 Rewrite the `main()` guard to abort on `missing.length || extra.length`,
      computed on `resolvedCodes` (the resolved set), with an actionable message
      that still contains a `Missing:` token so the 27.x regression regexes hold.

### Task 3: Exports + tests (AC: 5, 6, 7)

- [x] 3.1 Export `diffBundleSet`, `isFlagTrue`, `DISQUALIFYING_FLAGS`.
- [x] 3.2 Add `test/bundle-filter-set-equality.test.js` (19 cases: allowlist
      survives, bmad-loop/automator/new-bmad-org excluded, shape-flip throws,
      two-sided diff incl. EXTRA, `isFlagTrue`, exported constants, and two
      offline end-to-end fail-loud spawns).
- [x] 3.3 Register the test in `package.json`'s `test` script (before
      `bmad-version-bump.test.js`).
- [x] 3.4 Confirm no pin bump; `npm run build:plugin` clean (no drift).

## Dev Notes

- **Why closed-by-default and NOT deny-list.** A deny-list ("keep every
  `type: bmad-org`, subtract `marketplace-plugin`/`deprecated`") would correctly
  drop today's `bmad-loop`/`bmad-automator` but would still auto-bundle a *future*
  plain `type: bmad-org` module the moment it appeared upstream — the exact
  silent-addition class this story exists to close. An allowlist fails closed on
  the unknown.
- **The guard's EXTRA branch is deliberate defense-in-depth.** Under the closed
  allowlist, `normalizeModules()` can never emit a code outside the allowlist, so
  in `main()` `extra` is normally empty. The two-sided guard is a tripwire that
  halts the build if the filter is ever loosened/regressed — so it is unit-tested
  directly via `diffBundleSet` (an EXTRA cannot be produced through the full script
  while the filter stays closed). This matches NFR73 ("fails loud on a set that is
  either SMALLER OR LARGER") and the 30.1 gate recommendation.
- **Resolved set, not manifest keys (AC 4).** `main()` computes the guard on
  `resolvedCodes = new Set(modules.map(m => m.code))` — the output of
  `normalizeModules()`. The manifest built later includes retained
  `retiredUpstream` modules (27.x AC #7) that are intentionally NOT on the
  allowlist; guarding on manifest keys would false-positive on them.
- **Shape-flip throw vs process.exit.** The flag assertion throws from the pure
  `normalizeModules()` (clean `assert.throws` unit coverage). In the real build the
  throw is uncaught in `loadModuleDefinitions()` at the very top of `main()` — it
  aborts node with exit 1 before any clone or manifest write (verified by an
  offline end-to-end spawn). The thin/extra guard keeps the existing
  `console.error` + `process.exit(1)` style.
- **Existing 27.2/27.3 reader tests stay green unchanged.** Their fixtures'
  `type: bmad-org` set already equals the allowlist `{tea,bmb,cis,gds,wds}`, so the
  allowlist filter produces the same output as the old type filter for those
  inputs; the deficient-set e2e regexes match on the `Missing:` token the new
  message preserves.
- **Scope boundary.** Pin stays `bmad-method@6.9.0`. The 30.1 gate proved the
  6.10.0 schema is additive, so this allowlist/guard is correct for both versions;
  it was validated against the installed 6.9.0 reader and a 6.10.0-shaped fixture.
  The pin bump + live cache/plugin rebuild + offline install verify is Story 30.3.

## Change Log

| Date | Change |
|------|--------|
| 2026-07-12 | Story created and implemented in worktree `feature/epic-30-story-30-2`. |
