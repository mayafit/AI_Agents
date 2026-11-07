# Story 36.7 — GA Re-Gate: re-run the v7 gate on the BMAD v7 GA tag

Status: backlog
Blocked on: v7 GA (BMAD v7 GA tag published upstream — external)
Wave: 3 (after GA and after 36.6 PASS; its GO is the precondition for Story 39.5 — FR281)

**FR:** FR281 (GA qualification gate), FR280 (pin moved deliberately to the GA commit; verdict per SHA), FR282 (offline runtime re-proved). **NFR:** NFR2, NFR50, NFR57, NFR58. **Decision inputs:** P5-11.5 (pinned SHA, GA gate), P5-11.10 ("GA re-gate before 39 ships"); `sprint-change-proposal-2026-11-07.md` §3 risk ("re-run the Epic 36 gate on the GA tag before Epic 39 ships").

## Story

As the **ma-agents release owner**,
I want the Epic 36 gate re-run on the v7 GA tag, with every difference from the preview pin listed and its effect on Epics 37–39 named,
so that the first on-prem release of the v7 line (39.5) ships against a qualified GA, and nothing that moved between the preview and GA reaches an air-gapped user untested.

## Context

Epic 36 qualified `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`, a preview-alpha commit (`docs/start/install-bmad.md` @`e734d3a`: "v7 … is in preview alpha … release ETA is mid-November 2026"). Several 36.1 answers rest on upstream internals that GA may change: `setup.py --module-answers` (internal contract), Sofia store hooks ("hooks are not integrated yet"), the `customize.toml` key set per skill, `bmad-project-context`'s adopt flow, and `render_skill.py`'s dependency set. Until this story records GO, FR281 holds: no offline-bundle release of the v7 line, and 3.18.x stays the supported on-prem release. The pin is moved with 36.3's plumbing (`package.json` `bmadRef`, `BMAD_TARGET_REF`, snapshot rebuild), never by hand-editing the snapshot.

## Acceptance Criteria

1. **GA identified.** The GA tag name, its commit SHA and the `skills/bmod-method/bmod.toml` version at that tag are recorded; the tag is confirmed as GA by upstream's release notes or `docs/start/install-bmad.md` at the tag no longer saying "preview alpha" (quoted).
2. **Preview → GA delta.** A diff of `e734d3a..<GA SHA>` restricted to `skills/bmad/scripts/`, `skills/bmad/references/`, every `skills/bmod-*/` record, every `customize.toml`, every `retired.toml`, `skills/bmad-agent-po/config/` and `scripts/`, `skills/bmad-project-context/`, and `docs/reference/module-files.md` is summarised per path in `epic-runs/epic-36/36-7-ga-regate.md`, each change tagged with the 36.1 AC, 36.2 AC or Epic 37–39 story it touches (or "none").
3. **Pin moved deliberately.** `package.json` `bmadRef.sha` becomes the GA SHA (and `modules` tags re-picked per 36.1 AC12 at GA) through 36.3's builder; `test/bmad-v7-snapshot.test.js` and `test/release-gate-epic-36.test.js` pass on the new snapshot.
4. **36.1 re-run on GA.** Every AC of Story 36.1 tagged **[v7-carries]** (AC2, AC3, AC4, AC6, AC7, AC9, AC10, AC11, AC13) and every **[pre-release-only]** AC whose subject still exists (AC5 `--module-answers`, AC8 Sofia store, AC12 tea/cis tags) is re-run against the GA tag with the same commands; each result is recorded beside its preview result with **same / changed / broken**. A broken answer on AC2, AC5 (without FALLBACK), AC7 or AC11 is a STOP.
5. **36.2 re-run on GA.** `scripts/build-wheelhouse.py` is re-run on the GA snapshot (dependency set diff recorded), and 36.2 AC4 (five scripts, `uv run --no-cache`, `--network none`) and AC5 controls are re-run in the CI job from 36.6 AC4 and on Windows (36.2 AC7). `docs/on-prem-runtime.md` is updated if any command changed.
6. **36.4 / 36.5 re-run on GA.** `test/owned-toml-v7-contract.test.js` and `test/agents-md-two-writer-v7.test.js` pass against the GA snapshot (an assertion that turns red on a GA change is fixed or the change is recorded as a finding — never weakened to pass); 36.5 AC8's real `adopt` run is repeated with the GA skill.
7. **FR281 verdict — the GO that unblocks 39.5.** `36-7-ga-regate.md` ends in **GO-39.5** (the offline v7 bundle may be released) or **STOP** with the blocking items; a GO also lists the Epic 37–38 stories that must absorb a GA delta before 39.5 starts (from AC2). A STOP is routed to `bmad-correct-course`. The verdict is handed to the Scrum Master for the tracker; until GO, the CHANGELOG / README "not for on-prem" statement from 36.6 AC8 stays.
8. **No silent rebase.** The GA re-gate does not edit the 36.1–36.6 story files or their findings; it appends its own record and cites them (BMAD: completed stories stay as history).

## Tasks / Subtasks

- [ ] T1 Identify GA tag + SHA (AC1); delta report (AC2)
- [ ] T2 Pin bump via 36.3 plumbing; snapshot + gate tests green (AC3)
- [ ] T3 Re-run 36.1 ACs on GA (AC4)
- [ ] T4 Re-run 36.2 build + offline proof (AC5)
- [ ] T5 Re-run 36.4 / 36.5 tests and the adopt run (AC6)
- [ ] T6 Verdict file with GO-39.5 / STOP (AC7); hand-off

## Dev Notes

- Run the same scratch recipes 36.1 and 36.2 recorded; any command that must change is itself a finding.
- If GA lands while Epic 37 or 38 is in flight, run this story first and feed AC2's delta into the in-flight stories before their release gates.
- A GA that renames `--module-answers` is not a STOP if FR284's documented fallback (print the exact `bmad setup <code>` instruction) is in place by then; record which.

## Testing

Re-runs of `test/bmad-v7-snapshot.test.js`, `test/release-gate-epic-36.test.js`, `test/owned-toml-v7-contract.test.js`, `test/agents-md-two-writer-v7.test.js`, `test/wheelhouse-coverage.test.js`, and the 36.6 CI jobs, all on the GA snapshot.

## Out of scope

- The on-prem release itself (39.5).
- Re-planning Epics 37–39 beyond listing the GA deltas they must absorb (a large delta goes to correct-course).

## Verification record

GA tag + SHA: … ; delta summary: … ; 36.1 re-run (same/changed/broken per AC): … ; 36.2 re-run: … ; 36.4/36.5: … ; verdict (GO-39.5 / STOP): … ; unverified: …
