# Story 36.7 — GA Re-Gate: re-run the v7 gate on the BMAD v7 GA tag

Status: backlog
Blocked on: v7 GA (BMAD v7 GA tag published upstream — external), 36-6
Wave: 3 (after GA and after 36.6 PASS; its GO is the precondition for Story 39.5 — FR281)

**FR:** FR281 (GA qualification gate), FR280 (target moved deliberately to the GA commit; verdict per commit), FR282 (offline runtime re-proved), FR302 (`bmadRef` updated). **NFR:** NFR2, NFR50, NFR57, NFR58; NFR87 (36.1 AC9's 3.x upgrade run repeated on the GA tag). **Decisions:** P5-11.5 (target commit and GA gate), P5-11.6 (offline Python runtime).

## Story

As the **ma-agents release owner**,
I want the Epic 36 gate re-run on the BMAD v7 GA tag, with every difference from the preview commit listed and its effect on Epics 37–39 named,
so that the first on-prem release of the 4.x line (39.5) ships against a qualified GA, and nothing that moved between the preview and GA reaches an air-gapped user untested.

## Context

Epic 36 qualifies `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`, a preview-alpha commit (`docs/start/install-bmad.md:9` at `e734d3a`: "v7 of BMad, which is in preview alpha"). Several 36.1 answers rest on upstream internals that GA may change: `setup.py --module-answers` (internal contract), Sofia store hooks, the `customize.toml` key set per skill, `bmad-project-context`'s adopt flow, and `render_skill.py`'s dependency set. FR281: until 39.5, the 3.x line is the supported on-prem release, and 4.x packages from 39.4 are pre-releases on dist-tag `next`. This story's GO-39.5 opens 39.5, the on-prem release `4.0.0` on dist-tag `latest`. The target moves through 36.3's record and builder (`package.json` `bmadRef`, `ma-agents bundle build`), never by hand-editing the snapshot.

## Acceptance Criteria

1. **GA identified.** The GA tag name, its commit and the `skills/bmod-method/bmod.toml` version at that tag are recorded; the tag is confirmed as GA by upstream's release notes or by `docs/start/install-bmad.md` at the tag no longer saying "preview alpha" (quoted).
2. **Preview → GA delta.** A diff of `e734d3a..<GA commit>` restricted to `skills/bmad/scripts/`, `skills/bmad/references/`, every `skills/bmod-*/` record, every `customize.toml`, every `retired.toml`, `skills/bmad-agent-po/config/` and `scripts/`, `skills/bmad-project-context/`, and `docs/reference/module-files.md` is summarised per path in `epic-runs/epic-36/36-7-ga-regate.md`, each change tagged with the 36.1 AC, 36.2 AC or Epic 37–39 story it touches (or "none").
3. **Target moved deliberately.** `package.json` `bmadRef.core` becomes the GA commit, and `skillsCli`, `tea` and `cis` are re-picked per 36.1 AC1 and AC12 at GA; `ma-agents bundle build` rebuilds the snapshot; every 36.3 AC marked "Re-run at GA: yes" holds, and `test/bundle-snapshot.test.js` and `test/release-gate-epic-36.test.js` pass on the new snapshot.
4. **36.1 re-run on GA.** Every AC of Story 36.1 marked **Re-run at GA: yes** (AC2–AC14) is re-run against the GA tag with the same commands; each result is recorded beside its preview result as **same / changed / broken**. A broken answer on AC2, AC5 (without FALLBACK), AC7 or AC11 is a STOP.
5. **36.2 re-run on GA.** `scripts/build-wheelhouse.py` is re-run on the GA snapshot (dependency set diff recorded), and every 36.2 AC marked "Re-run at GA: yes" is repeated — the five scripts and controls in the CI job from 36.6 AC4 and on Windows (36.2 AC7). `docs/on-prem-runtime.md` is updated if any command changed.
6. **36.4 / 36.5 re-run on GA.** `test/customize-contract-v7.test.js` and `test/instruction-file-coexistence.test.js` pass against the GA snapshot (an assertion that turns red on a GA change is fixed or the change is recorded as a finding — never weakened to pass); 36.5 AC9's two real `adopt` runs are repeated with the GA skill, tool and model recorded.
7. **FR281 verdict — the GO that unblocks 39.5.** `36-7-ga-regate.md` ends in **GO-39.5** (39.5 may start) or **STOP** with the blocking items; a GO also lists the Epic 37–38 stories that must absorb a GA delta before 39.5 starts (from AC2). A STOP is routed to the PO for a re-plan. The PO updates the tracker. Until 39.5, the CHANGELOG / README statement from 36.6 AC8 that the 3.x line is the supported on-prem release stays.
8. **No silent rebase.** The GA re-gate does not edit the 36.1–36.6 story files or their findings; it writes its own record and cites them.

## Tasks / Subtasks

- [ ] T1 Identify GA tag + commit (AC1); delta report (AC2)
- [ ] T2 `bmadRef` update + `bundle build`; snapshot and gate tests green (AC3)
- [ ] T3 Re-run 36.1 AC2–AC13 on GA (AC4)
- [ ] T4 Re-run 36.2 build + offline proof (AC5)
- [ ] T5 Re-run 36.4 / 36.5 tests and the two adopt runs (AC6)
- [ ] T6 Verdict file with GO-39.5 / STOP (AC7); hand-off

## Dev Notes

- Run the same scratch recipes 36.1 and 36.2 recorded; any command that must change is itself a finding.
- If GA lands while Epic 37 or 38 is in flight, run this story first and feed AC2's delta into the in-flight stories before their release gates.
- A GA that renames `--module-answers` is not a STOP if FR284's fallback (print "ask `bmad` to run `bmad setup <code>`" and the equivalent `uv run --no-cache <bmad>/scripts/setup.py --project-root . --skill <bmad> --module <code>`) is in place; record which.

## Testing

Re-runs of `test/bundle-snapshot.test.js`, `test/release-gate-epic-36.test.js`, `test/customize-contract-v7.test.js`, `test/instruction-file-coexistence.test.js`, `test/wheelhouse-coverage.test.js`, and the 36.6 CI jobs, all on the GA snapshot.

## Out of scope

- The on-prem release itself (39.5).
- Re-planning Epics 37–39 beyond listing the GA deltas they must absorb (a large delta is routed to the PO for a re-plan).

## Verification record

GA tag + commit: … ; delta summary: … ; 36.1 re-run (same/changed/broken per AC): … ; 36.2 re-run: … ; 36.4/36.5: … ; verdict (GO-39.5 / STOP): … ; unverified: …
