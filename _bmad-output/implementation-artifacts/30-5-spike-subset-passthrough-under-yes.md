# Story 30.5: Spike — Prove a Subset-Install Mechanism Under `--yes` With Zero Core Modifications

Status: review

## Story

As the **ma-agents maintainer**,
I want to prove — against the live `bmad-method` package — a working mechanism that installs a *user-selected subset* of a custom marketplace's extensions under `--yes` with **zero bmad-method core modifications**, and to classify the `CustomModuleManager` coupling,
So that Stories 30.6 and 30.7 build the custom-marketplace feature on a de-risked, evidence-based mechanism instead of discovering the subset-handoff shape mid-build.

**Gate (long pole):** This is a hard gate for the Epic 30 feature chain. Stories 30.6 and 30.7 do not begin until the mechanism is proven (or an explicit fallback is recorded). This is a spike — findings + design, **not** production wiring. No changes to `ma-agents` core (`lib/`, `bin/`, `scripts/`).

## Acceptance Criteria

1. **Given** the installed `bmad-method` package, **When** the `--modules` constraint path is tried for subsetting a custom source, **Then** it is confirmed whether `--modules` can constrain the set of plugins installed from a `--custom-source` — with the CLI code path (`ui.js:_resolveCustomSourcesCli`) as the evidence.

2. **Given** the `--modules` result, **When** the durable mechanism is designed, **Then** **enumerate-then-stage-locally** is proven as the recommended answer: ma-agents enumerates the marketplace (`CustomModuleManager.resolveSource` → `discoverModules`), lets ma-agents pick a subset, stages that subset locally (a pruned `.claude-plugin/marketplace.json`), and installs it offline via a local `--custom-source` under `--yes` — demonstrated by a runnable PoC.

3. **Given** the enumeration mechanism, **When** ambient-credential enumeration is exercised, **Then** it is confirmed to work for BOTH a **local filesystem path** AND an intra-perimeter **Git URL** marketplace source, non-interactively (no credential prompt under `--yes`), with a clean failure when the source is unreachable/unauthorized.

4. **Given** the possibility of a negative result, **When** the spike concludes, **Then** an explicit **fallback** is recorded so the feature degrades gracefully (ships OFF by default / manual path) rather than shipping broken.

5. **Given** the reuse of `CustomModuleManager`, **When** the coupling is classified, **Then** the spike records whether `CustomModuleManager` is a **supported/public** API surface or a **pinned-internal** coupling (NFR17 risk), with the mitigation Stories 30.6/30.7 must carry.

6. **Given** the confirmed mechanism, **When** the hand-off is written, **Then** a concrete design for 30.6/30.7 is produced (what the wizard calls, what persists in `.ma-agents.json`) plus a clear recommendation on whether **30.6 should split into 6a/6b**.

## Tasks / Subtasks

### Task 1: `--modules` constraint path (AC: 1)
- [x] 1.1 Read `install.js` options — confirm `--modules`, `--custom-source`, `--yes`, `--tools` exist
- [x] 1.2 Trace `ui.js:promptInstall` — how `--modules` + `--custom-source` + `--yes` combine
- [x] 1.3 Read `_resolveCustomSourcesCli` — confirm it auto-selects ALL discovered codes (no `--modules` filter)

### Task 2: Prove enumerate-then-stage-locally (AC: 2)
- [x] 2.1 Read `custom-module-manager.js` — `resolveSource` / `discoverModules` / `resolvePlugin`
- [x] 2.2 Confirm ma-agents already stages locally + `--custom-source ./<dir>` + `--yes` (`lib/bmad.js#stagePlugin`, `buildBmadArgs`)
- [x] 2.3 Write + run a PoC: enumerate a local marketplace, pick a subset, prune marketplace.json, re-enumerate the stage → exactly the subset

### Task 3: Ambient-credential enumeration, local + Git URL (AC: 3)
- [x] 3.1 Local path: PoC proves `resolveSource` → discovery mode, offline, non-interactive
- [x] 3.2 Git URL: confirm `parseSource` yields a valid `url` descriptor (HTTPS + SSH, intra-perimeter host, `@version`)
- [x] 3.3 Confirm clone uses `GIT_TERMINAL_PROMPT=0` + `process.env` passthrough (ambient creds, never prompts; fails clean when unreachable)

### Task 4: Fallback + NFR17 classification (AC: 4, 5)
- [x] 4.1 Record explicit fallback (feature OFF / manual `--bmad-custom-source` passthrough)
- [x] 4.2 Confirm no `exports` map in `bmad-method` package.json → deep require reachable but unsupported → **pinned-internal**
- [x] 4.3 Confirm surface stability across the 6.9.0→6.10.0 pin bump

### Task 5: Hand-off design (AC: 6)
- [x] 5.1 Write the 30.6/30.7 hand-off (wizard calls, `.ma-agents.json` shape)
- [x] 5.2 Recommend on the 30.6 → 6a/6b split

## Dev Notes

- PoC: `spike/30-5-enumerate-poc.js` (run `node spike/30-5-enumerate-poc.js`). It deep-requires the installed `bmad-method` `CustomModuleManager`, builds a local marketplace fixture, enumerates it, subsets + prunes + re-enumerates the stage, and parses a Git URL / SSH descriptor. Fixtures are throwaway (created under `spike/_tmp/`, removed on exit).
- Findings report: `_bmad-output/implementation-artifacts/epic-runs/epic-30/30-5-spike-findings.md`.
- No `ma-agents` core file was modified. E2E is n/a for a spike.

## Spike Findings (Dev Agent Record)

See `epic-runs/epic-30/30-5-spike-findings.md` for the full evidence-graded report. Summary:

- **RECOMMENDED MECHANISM: enumerate-then-stage-locally** (proven by PoC, zero core mods). The `--modules` path CANNOT subset a custom source — `_resolveCustomSourcesCli` auto-selects every declared code and ignores `--modules` for custom sources. Subset is achieved by pruning the enumerated `marketplace.json` to the selected plugins, staging locally, and installing via a local `--custom-source` under `--yes`.
- **NFR17: pinned-internal.** No `exports` map in `bmad-method` package.json (6.9.0 AND 6.10.0), so `require('bmad-method/tools/installer/modules/custom-module-manager')` is reachable — but the module lives under `tools/installer/modules/` and is not re-exported from `main`; it is an installer internal, not a supported public API. Mitigation: single thin adapter + exact version pin + a surface drift/smoke test.
- **local_path_enum: WORKS** (PoC, offline, non-interactive). **git_url_enum: WORKS by construction** — `parseSource` yields a valid `url` descriptor; clone runs with `GIT_TERMINAL_PROMPT=0` + `process.env` (ambient creds, never prompts); fails clean when unreachable. Live intra-perimeter clone not executed in the spike env (no reachable repo).
- **Split 30.6 → 6a/6b: RECOMMENDED.** 6a = prompt + enumerate + multiselect UI + adapter; 6b = prune + stage + install-subset + Cline-wrapper reconcile. The prune-and-stage step is nontrivial enough to isolate.
