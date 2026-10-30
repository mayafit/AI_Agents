# Story 32.9 — Release Gate: bmad-method 6.12.4, air-gapped with `uv` in the loop

Status: backlog
Blocked on: 32-1, 32-2, 32-3, 32-4, 32-5, 32-6, 32-7, 32-8
Wave: 4 (closes Epic 32; its PASS is the hard gate for Epic 33 — P5-10.8)

**FR:** FR275 (offline install re-verified under `--network none`), FR271, FR276, FR277, FR278. **NFR:** NFR2, NFR50, NFR57, NFR58 (air-gap, with `uv` in the loop), NFR52 (multi-tool parity). **Decision inputs:** P5-10.6 ("the offline gate runs with `uv` in the loop under `--network none`"), P5-10.8 (no carve-out starts before this gate passes).

## Story

As the **ma-agents release owner**,
I want one evidence-backed gate that proves the 6.12.4 build installs air-gapped with `uv` pre-seeded, installs identically across the five flagship tools, and states honestly what the test chain and the release do not cover,
so that the product owner can cut the release — and open Epic 33 — on facts rather than on a green badge.

## Context

The air-gap proof lives in `.github/scripts/offline-install-verify.sh`, run by `.github/workflows/offline-install.yml` inside a container with `--network none` on `node:20.18.1-bookworm` pinned by digest (Node 20.18.1 satisfies 6.12.4's `>=20.12.0`). The script mentions `uv` nowhere today (verified: zero matches), so its current PASS says nothing about `bmad-build`, which HALTs at activation without `uv`. Multi-tool parity runs from `.github/workflows/multi-tool-smoke.yml` (matrix `claude-code` → `.claude/skills`, `copilot` / `roo-code` / `kilocode` → `.agents/skills`, `cline` → `.cline/skills`) via `.github/scripts/multi-tool-smoke-verify.sh`; three of the five tools share `.agents/skills`, the tree 32.1 AC5 checked for an AGY collision. The `npm test` script chains 110 test files with `&&` (120 files exist under `test/`); on Windows it has known pre-existing failures tracked as `bug-npm-test-windows-suite-health-chain` (backlog) — among them `build-plugin` (`npm pack --dry-run` exits 1 on Windows) and `migration-validation` (bug B3, root `skills/`). Epic 31's gate is the precedent for the shape of this story (`test/release-gate-epic-31.test.js`, `31-14-release-gate.md`). `CHANGELOG.md` does not ship on npm (not in `package.json` `files`); the 3.18.0 release therefore mirrored its known limitations into `README.md` ("Known limitations of v3.18.0"), and this release must do the same.

## Acceptance Criteria

1. **Offline install, `uv` in the loop.** `offline-install-verify.sh` is extended so that, inside the `--network none` container with `uv` + Python ≥ 3.11 pre-seeded using exactly the commands recorded in `32-1-gate-findings.md` AC4: (a) the network-unreachable self-check still passes first; (b) `npm install` of the packed tarball (`npm pack --ignore-scripts`) and `ma-agents install --yes` with modules `bmm,tea,cis,bmb` exit 0; (c) `_bmad/_config/manifest.yaml` reports bmad-method 6.12.4 and tea `v1.27.2`, cis `v0.3.2`, bmb at the 32.3 tag; (d) `uv run _bmad/scripts/resolve_customization.py --skill <installed bmad-build dir> --key workflow` and the same for `bmad-dev-epic` exit 0; (e) no `v6-shims/` skill is present in any installed tool dir; (f) a negative run with the `uv` pre-seed removed shows (d) failing with the expected message — proving the check is not vacuous. CI run URL recorded.
2. **Multi-tool smoke (NFR52).** All five matrix cells pass on the release commit; per tool, the installed skill set contains upstream `bmad-sprint-planning` and `bmad-build` and none of `bmad-dev-story`, `bmad-sprint-status`, `bmad-create-story`. For the three `.agents/skills` tools, `.agents/skills/.ma-agents.json` and `MANIFEST.yaml` are intact after install. CI run URLs recorded.
3. **`npm test` chain health, recorded honestly.** The chain is run on Windows and on Linux CI. The Verification record lists, by file name, every failing test file and, for each: pre-existing (fails identically on `main` at `38ea256` — shown by running it there) or new. Any **new** failure blocks the gate. On Windows the chain's halt position is recorded and every file after it is run individually (as the repo has done since PR #148), so no file is reported green that never ran. "Known Windows failures" are listed by name, never summarised as "flaky".
4. **Epic 32 assertions in one place.** `test/release-gate-epic-32.test.js` asserts the cross-story invariants against outside authorities: pin sites = installed `bmad-method/package.json` version (32.3); engines not looser than bmad-method's (32.3); no `--shims` in `buildBmadArgs` output or `lib/`/`bin/` source (32.3); the three shadow skills absent from all trees (32.4); zero retired names (delegates to 32.6's test); every skill name in `bmad-dev-epic` resolves in the vendored tree (delegates to 32.5's test). It is added to the chain.
5. **Bundle drift clean.** `npm run build:plugin` and (if touched) `npm run build:atlas` / `npm run build:bmad-cache` produce no diff on the release commit; the Bundle Drift Guard passes; `marketplace.json` version equals `package.json` version.
6. **Semver — argued, PO decides.** The Verification record contains a short decision note presenting both sides, and the product owner's choice is recorded before the version is cut:
   - *MINOR (3.19.0):* this repo's stated contract is the public CLI ("No breaking change to the public CLI surface → MINOR", CHANGELOG 3.14.0); every prior upstream bump shipped MINOR (3.14.0 v6.9.0, 3.17.0 v6.10.0 — which also deprecated the Demerzel persona); the CLI's commands and flags are unchanged; `bmad-sprint-planning` keeps its name (now upstream's).
   - *MAJOR (4.0.0):* `engines.node` moves from `>=16.0.0` to `>=20.12.0`, so Node 16/18 users can no longer install; `uv` + Python ≥ 3.11 become install prerequisites (FR277); `bmad-dev-story` and `bmad-sprint-status` stop being invocable with no shim; Paige is removed. Under semver, a narrowed runtime requirement and removed user-invocable commands are breaking. Note: Epic 35 already plans 4.0.0 for the thin installer; taking 4.0.0 here would move Epic 35 to 5.0.0.
   The story does not pre-decide. Whichever is chosen, `package.json`, `marketplace.json` (via `build:plugin`) and the CHANGELOG heading agree.
7. **CHANGELOG + README.** The release section lists Changed (pin 6.12.4; cache pins; engines; `uv` prerequisite), Removed (`bmad-dev-story`, `bmad-sprint-planning` (ours → upstream's), `bmad-sprint-status`, Paige customization), and **Known limitations**, including at least: (a) the 32.4 interim gap — upstream `bmad-sprint-planning` has no Jira routing, no knowledge-store preflight and no Story 31.9 gate until Epic 34; (b) air-gapped images must pre-seed `uv` + Python ≥ 3.11 — without it the install succeeds and `bmad-build` halts at activation; (c) the Confluence-MCP-present paths remain mock-verified (carried from 3.18.0); (d) anything 32.1–32.8 recorded as unverified. The same Known limitations are mirrored into `README.md` (the CHANGELOG does not ship on npm); a test asserts the two lists name the same items.
8. **Beta first.** A `-beta.N` prerelease is published with `--tag beta` (`npm publish --ignore-scripts`, per the repo's publish practice) and installed from the registry into a scratch project on a clean machine before the final version is cut; result recorded.
9. **Retro.** `bmad-retrospective` (exists at 6.12.4) is run for Epic 32; its output is saved under `_bmad-output/implementation-artifacts/epic-runs/epic-32/` and names at least: what 32.1 got wrong or could not answer, any count that had to be re-pinned and why, and whether the gate is safe to open Epic 33 (explicit yes/no).
10. **Gate verdict.** `sprint-status.yaml` `epic-32` moves to `done` only when AC1–AC9 are recorded; the verdict line states PASS (Epic 33 may start) or FAIL with the blocking item.

## Tasks / Subtasks

- [ ] T1 Extend `offline-install-verify.sh` + workflow for `uv` pre-seed, (d) and (f) (AC1)
- [ ] T2 Extend multi-tool smoke assertions (AC2)
- [ ] T3 Chain health on Windows + Linux; per-file disposition vs `main@38ea256` (AC3)
- [ ] T4 `test/release-gate-epic-32.test.js` (AC4)
- [ ] T5 Rebuild bundles; drift check (AC5)
- [ ] T6 Semver note; obtain PO decision (AC6)
- [ ] T7 CHANGELOG + README Known limitations + parity test (AC7)
- [ ] T8 Beta publish + clean-machine install (AC8)
- [ ] T9 Retrospective; gate verdict; sprint-status update (AC9, AC10)

## Dev Notes

- Seeding `uv` in CI: bake it in the pre-pull step while the runner still has network (the workflow already pre-pulls the offline image), then start the `--network none` container from that image. Do not let the container download `uv` or Python — that would make AC1 meaningless.
- Publish: use `npm pack --ignore-scripts` / `npm publish --ignore-scripts` (Windows `prepare` tarball leak; see memory "ma-agents npm publish" for credentials handling — never print the token). If `gh`/git keyring auth fails, follow memory "GitHub push credentials location", masked.
- Bundle Drift Guard: `marketplace.json` goes stale on every version bump — run `npm run build:plugin` after `npm version` and commit both (memory "plugin bundle drift").
- Stacked PRs: branch the release PR off `main` after the Epic 32 PR merges, not off the epic branch (memory "stacked-PR squash-merge orphan").
- `npm test` mutates `.agents/`, `AGENTS.md` and `project-context.md` in the working tree; restore them before committing.
- Do not mark the Windows chain "green" by skipping files; AC3 exists because the `&&` chain has masked failures before.

## Out of scope

- Fixing the pre-existing Windows chain failures (`bug-npm-test-windows-suite-health-chain`) — list them, do not fix them here.
- Any Epic 33–35 work: no extension repository, no overlay, no installer slimming.
- Adding new tools to the smoke matrix (P5-6(d)).

## Verification record

Offline CI run: … ; smoke runs (5): … ; chain (Windows): halted at …, failures by file (pre-existing/new): … ; chain (Linux): … ; semver decision + who decided: … ; beta version + clean install: … ; retro file: … ; gate verdict: … ; unverified: …
