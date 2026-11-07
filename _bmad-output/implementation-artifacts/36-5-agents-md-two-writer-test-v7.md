# Story 36.5 — Instruction-File Coexistence: `ma-agents`, `ma-standards` and `bmad:context` blocks in one file

Status: backlog
Blocked on: 36-1
Wave: 1 (parallel with 36.3, 36.4)

**FR:** FR301 (IDE injection ownership: two marker blocks, two owners, integration test), FR278 (the `AGENTS.md` coexistence case is covered by an integration test). **NFR:** NFR46 (byte-identical in-marker content on re-stamp), NFR49 (user content preserved). **Decisions:** P5-11.10 (installer sequence and ownership).

## Story

As a **user who hand-edits `AGENTS.md` in a project that has ma-agents 4.x, `bmod-ma-standards` and v7 `bmad-project-context`**,
I want each writer to touch only its own block, and v7's adoption flow not to dissolve ours,
so that running any writer, in any order, never deletes another writer's block or my prose, and removing one leaves the others and my text intact.

## Context

Three writers share the instruction files. The installer owns `<!-- ma-agents:start -->` / `<!-- ma-agents:end -->` (lists installed modules and the `bmad` entry point); `ma-standards-apply` owns `<!-- ma-standards:start -->` / `<!-- ma-standards:end -->` in `AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes` and `.github/copilot-instructions.md`; neither touches the other's markers (P5-11.10, FR301). This story delivers the block writer the installer uses (39.2) and the case table both owners must pass (37.2 copies it into `ma-bmad-extensions`).

v7's writer is LLM-driven, not a script. At `e734d3a`, `bmad-project-context` marks its block `<!-- bmad:context -->` / `<!-- /bmad:context -->` (`skills/bmad-project-context/references/template.md:17`, `:52`); it detects intent — `setup`, **`adopt`** (an instruction file with content but no managed block: every instruction in it enters a ledger, `SKILL.md:29`), `refresh`, `record`, `audit`; on approval it splices between its markers and touches nothing outside them (`:72`); and adoption may propose "a `CLAUDE.md` reduced to `@AGENTS.md`" (`:97`). The deterministic splice can be tested by simulation; the adopt ledger — which may propose relocating or deleting our blocks as "existing instructions" — can only be observed by running the skill.

A 3.x project's `AGENTS.md` holds a `<!-- MA-AGENTS-START -->` block written by the 3.x merger (`lib/installer.js:1332`); it is a migration input that the 3.x → 4.x upgrade (39.3) removes, and the 4.x writer must not match it.

## Acceptance Criteria

**Simulation rule:** the simulated upstream write reads its marker strings and block template **at test time from the pinned tree** (`skills/bmad-project-context/references/template.md`, 36.3's `bundle/bmad-method/` or `BMAD_V7_TREE`); no upstream marker or template text is typed into the test. The test asserts the values read are non-empty and the file exists, so a moved upstream file fails the test. Each AC states **Re-run at GA**: `yes` means 36.7 AC6 runs it against the GA snapshot.

1. **Block writer.** (Re-run at GA: no.) A module (name recorded, e.g. `lib/inject/marker-block.js`) splices or removes one named block, matching start and end markers by exact line equality; it preserves every byte outside the block, including line endings; when the file exists it never rewrites it whole; when the block content is unchanged it writes nothing. The marker pair is a parameter, so the same module serves `ma-agents` and the `ma-standards` fixtures.
2. **Order A (ma-agents first), simulated splice.** (Re-run at GA: yes.) Empty project → `ma-agents` block → simulated upstream splice of a `bmad:context` block. Assert: `ma-agents` block byte-identical; upstream block present exactly once.
3. **Order B (upstream first).** (Re-run at GA: yes.) Empty project → simulated upstream block → `ma-agents` block. Assert: upstream block byte-identical; `ma-agents` block present once; nothing outside it changed.
4. **Three owners, every order.** (Re-run at GA: yes.) The six orders of `ma-agents`, `ma-standards` and upstream writes, each writer re-run twice interleaved, on a fixture with user paragraphs before, between and after the blocks. Assert: each block present once and byte-identical to its last write; every user paragraph byte-identical and in place.
5. **Idempotence.** (Re-run at GA: yes.) Re-running any writer with unchanged input leaves the file byte-identical (sha256 before/after, NFR46).
6. **Removal keeps the others.** (Re-run at GA: yes.) Removing the `ma-agents` block (the installer's uninstall path) or the `ma-standards` block (`ma-standards-apply remove`) leaves the other two blocks and user prose; the file is deleted only when nothing but whitespace remains (NFR49).
7. **Marker non-interference.** (Re-run at GA: yes.) Each owner's matcher matches only its own exact markers: the upstream markers read at test time, the other owner's markers, a prefix-extended marker (`<!-- ma-agents:start-x -->`) and the 3.x `<!-- MA-AGENTS-START -->` block are all left untouched.
8. **CRLF.** (Re-run at GA: yes.) AC2–AC4 repeated with a CRLF fixture; no writer converts another's block or the user's prose to LF (byte compare).
9. **Real adopt runs, recorded.** (Re-run at GA: yes — LLM behaviour.) In a scratch project holding an `AGENTS.md` with the `ma-agents` and `ma-standards` blocks and user prose, and a `CLAUDE.md` with both blocks, the real `bmad-project-context` skill from the pinned tree is run in `adopt` intent **twice, in fresh sessions**, with the tool and model recorded. Recorded verbatim per run: the intent detected, every ledger entry touching our blocks or `CLAUDE.md` (decision `retain / rewrite / relocate / automate / delete` and reason), and the file bytes after approval of the default proposal. PASS: both blocks survive byte-identical in both runs. A divergence between the runs is itself a finding. Otherwise the finding goes to the PO as a UX defect with a proposed mitigation (e.g. a `persistent_facts` line on `bmad-project-context` naming our blocks as managed, checked by the 36.4 classifier), and to 37.2 and 39.2 as a design input. The test does not simulate this AC.
10. **Instruction-file set.** (Re-run at GA: yes.) The five files `ma-standards-apply` writes are reviewed against the pinned skill: `CLAUDE.md` is in scope because adoption may rewrite it (`SKILL.md:97`) — AC4 and AC6 are repeated for `CLAUDE.md` with the simulated `@AGENTS.md` reduction; the markdown files are covered by the block writer; `.roomodes` (not markdown) is recorded with the block form 37.2 must use there.
11. **Mutation-checked.** (Re-run at GA: no.) (m1) the writer rewrites the whole file when markers are absent → AC3 red; (m2) the matcher made prefix-based → AC7 red; (m3) the writer normalises line endings → AC8 red; (m4) removal deletes the file unconditionally → AC6 red; (m5) the pinned template path pointed at a nonexistent file → the simulation fails loudly, no fallback literal.

## Tasks / Subtasks

- [ ] T1 Read 36.1 AC14 for the tree path; read upstream markers from `template.md` at test time (all ACs)
- [ ] T2 Block writer module (AC1)
- [ ] T3 `test/instruction-file-coexistence.test.js`; temp-dir fixtures; case table exported for 37.2; add to the chain (AC2–AC5)
- [ ] T4 Removal and matcher cross-check (AC6, AC7); CRLF (AC8)
- [ ] T5 `CLAUDE.md` and `.roomodes` review (AC10)
- [ ] T6 Two real `adopt` runs and record (AC9)
- [ ] T7 Mutants m1–m5 (AC11)

## Dev Notes

- `os.tmpdir()` fixtures only; never the repo root — `npm test` already mutates the tracked `AGENTS.md` (known).
- The upstream block's provenance line carries a date and commit (`template.md:18`); the simulation fills them deterministically so AC5 can compare bytes.
- AC9 is a manual [RUN] in a coding tool with the pinned skill installed by 36.1's recipe; keep the transcript excerpt short and quote the ledger lines exactly.
- The case table is data (inputs, write order, expected bytes), so 37.2 can copy it without importing code across repositories.

## Testing

`test/instruction-file-coexistence.test.js` (new, in the chain) for AC1–AC8, AC10, AC11; AC9 is a recorded [RUN]. Run directly on Windows as well.

## Out of scope

- `ma-standards-apply` itself (37.2) and the installer's injection step (39.2) — both consume this story's writer contract and case table.
- The content inside either block.
- Removing a 3.x block during upgrade (39.3).

## Verification record

Upstream markers + source line: … ; writer module: … ; adopt runs (tool, model, intent, ledger entries for our blocks, PASS/defect, divergence): … ; instruction-file review: … ; mutants m1–m5: … ; unverified: …
