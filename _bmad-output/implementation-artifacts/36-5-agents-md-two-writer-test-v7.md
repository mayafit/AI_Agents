# Story 36.5 — Instruction-File Coexistence: `ma-agents`, `ma-standards` and `bmad:context` blocks in one file

Status: review
Blocked on: 36-1
Wave: 1 (parallel with 36.3, 36.4)

**FR:** FR301 (IDE injection ownership: the `ma-agents` and `ma-standards` blocks, one owner each, beside the upstream `bmad-project-context` block; an integration test runs the three writers in all six orders, re-runs each, and asserts that every block and the user prose stay byte-identical). **NFR:** NFR46 (byte-identical in-marker content on re-stamp), NFR49 (user content preserved). **Decisions:** P5-11.10 (installer sequence and ownership).

## Story

As a **user who hand-edits `AGENTS.md` in a project that has ma-agents 4.x, `bmod-ma-standards` and v7 `bmad-project-context`**,
I want each writer to touch only its own block, and v7's adoption flow not to dissolve ours,
so that running any writer, in any order, never deletes another writer's block or my prose, and removing one leaves the others and my text intact.

## Context

Three writers share the instruction files. The installer owns `<!-- ma-agents:start -->` / `<!-- ma-agents:end -->` (lists installed modules, the `bmad` entry point and the `UV_CONFIG_FILE` and `UV_PYTHON_INSTALL_DIR` settings); `ma-standards-apply` owns `<!-- ma-standards:start -->` / `<!-- ma-standards:end -->` in `AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.roomodes` and `.github/copilot-instructions.md`; neither touches the other's markers (P5-11.10, FR301). This story delivers the block writer the installer uses (39.2) and the case table both owners must pass (37.2 copies it into `ma-bmad-extensions`).

v7's writer is an agent, not a script: no upstream script writes the block. At `e734d3a`, `bmad-project-context` marks its block `<!-- bmad:context -->` / `<!-- /bmad:context -->` (`skills/bmad-project-context/references/template.md:17`, `:52` at `bmadRef.core`, 36.1 AC14); both marker lines sit inside the fenced "Worked example" that opens at `:16`, so the test reads them from inside that fence; it detects intent — `setup`, **`adopt`** (an instruction file with content but no managed block: every instruction in it enters a ledger, `SKILL.md:29`), `refresh`, `record`, `audit`; on approval it splices between its markers and touches nothing outside them (`:72`); and adoption may propose "a `CLAUDE.md` reduced to `@AGENTS.md`" (`:97`). The deterministic splice can be tested by simulation; the adopt ledger — which may propose relocating or deleting our blocks as "existing instructions" — can only be observed by running the skill.

A 3.x project's `AGENTS.md` holds a `<!-- MA-AGENTS-START -->` block written by the 3.x merger (`lib/installer.js:1332`); it is a migration input that the 3.x → 4.x upgrade (39.3) removes, and the 4.x writer must not match it.

## Acceptance Criteria

**Simulation rule:** the simulated upstream write reads its marker strings and block template **at test time from the pinned tree** (`skills/bmad-project-context/references/template.md`, 36.3's `bundle/bmad-method/` or `BMAD_V7_TREE`); no upstream marker or template text is typed into the test. The test asserts the values read are non-empty and the file exists, so a moved upstream file fails the test. The simulated upstream write models the agent's splice (`SKILL.md:72`): it replaces only the lines between the two markers, or appends the marked block when absent, and touches nothing outside them. Each AC states **Re-run at GA**: `yes` means 36.7 AC6 runs it against the GA snapshot.

1. **Block writer.** (Re-run at GA: no.) A module (name recorded, e.g. `lib/inject/marker-block.js`) splices or removes one named block, matching start and end markers by exact line equality; it preserves every byte outside the block, including line endings; when the file exists it never rewrites it whole; when the block content is unchanged it writes nothing. The marker pair is a parameter, so the same module serves `ma-agents` and the `ma-standards` fixtures.
2. **Order A (ma-agents first), simulated splice.** (Re-run at GA: yes.) Empty project → `ma-agents` block → simulated upstream splice of a `bmad:context` block. Assert: `ma-agents` block byte-identical; upstream block present exactly once.
3. **Order B (upstream first).** (Re-run at GA: yes.) Empty project → simulated upstream block → `ma-agents` block. Assert: upstream block byte-identical; `ma-agents` block present once; nothing outside it changed.
4. **Three owners, every order.** (Re-run at GA: yes.) The six orders of `ma-agents`, `ma-standards` and upstream writes, each writer re-run twice interleaved, on a fixture with user paragraphs before, between and after the blocks. Assert: each block present once and byte-identical to its last write; every user paragraph byte-identical and in place.
5. **Idempotence.** (Re-run at GA: yes.) Re-running any writer with unchanged input leaves the file byte-identical (sha256 before/after, NFR46).
6. **Removal keeps the others.** (Re-run at GA: yes.) Removing the `ma-agents` block (the installer's uninstall path) or the `ma-standards` block (`ma-standards-apply remove`) leaves the other two blocks and user prose; the file is deleted only when nothing but whitespace remains (NFR49).
7. **Marker non-interference.** (Re-run at GA: yes.) Each owner's matcher matches only its own exact markers: the upstream markers read at test time, the other owner's markers, a prefix-extended marker (`<!-- ma-agents:start-x -->`) and the 3.x `<!-- MA-AGENTS-START -->` block are all left untouched.
8. **CRLF.** (Re-run at GA: yes.) AC2–AC4 repeated with a CRLF fixture; no writer converts another's block or the user's prose to LF (byte compare).
9. **Real adopt runs, recorded.** (Re-run at GA: yes — LLM behaviour.) In a scratch project holding an `AGENTS.md` with the `ma-agents` and `ma-standards` blocks and user prose, and a `CLAUDE.md` with both blocks, the real `bmad-project-context` skill from the pinned tree is run in `adopt` intent **twice, in fresh sessions**, with the tool and model recorded. Recorded verbatim per run: the intent detected, every ledger entry touching our blocks or `CLAUDE.md` (decision `retain / rewrite / relocate / automate / delete` and reason), every proposal to de-duplicate or move instructions held in our blocks (`SKILL.md:37`, `:74`, `:97`), and the file bytes after approval of the default proposal. PASS: both blocks survive byte-identical in both runs. A divergence between the runs is itself a finding. Otherwise the finding goes to the PO as a UX defect with a proposed mitigation (e.g. a `persistent_facts` line on `bmad-project-context` naming our blocks as managed, checked by the 36.4 classifier), and to 37.2 and 39.2 as a design input. The test does not simulate this AC.
10. **Instruction-file set.** (Re-run at GA: yes.) The five files `ma-standards-apply` writes are reviewed against the pinned skill: `CLAUDE.md` is in scope because adoption may rewrite it (`SKILL.md:97`) — AC4 and AC6 are repeated for `CLAUDE.md` with the simulated `@AGENTS.md` reduction; the markdown files are covered by the block writer; `.roomodes` (not markdown) is recorded with the block form 37.2 must use there.
11. **Mutation-checked.** (Re-run at GA: no.) (m1) the writer rewrites the whole file when markers are absent → AC3 red; (m2) the matcher made prefix-based → AC7 red; (m3) the writer normalises line endings → AC8 red; (m4) removal deletes the file unconditionally → AC6 red; (m5) the pinned template path pointed at a nonexistent file → the simulation fails loudly, no fallback literal.

## Tasks / Subtasks

- [x] T1 Read 36.1 AC1 for the tree path and AC14 for the upstream markers and their file; read upstream markers from `template.md` at test time (all ACs)
- [x] T2 Block writer module (AC1)
- [x] T3 `test/instruction-file-coexistence.test.js`; temp-dir fixtures; case table exported for 37.2; add to the chain (AC2–AC5)
- [x] T4 Removal and matcher cross-check (AC6, AC7); CRLF (AC8)
- [x] T5 `CLAUDE.md` and `.roomodes` review (AC10)
- [x] T6 Two real `adopt` runs and record (AC9)
- [x] T7 Mutants m1–m5 (AC11)

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

Run 2026-11-15, Windows 11, Node v24.15.0, Git Bash. Worktree `feat/36-5-agents-md-three-writer` at `124b594`.

**Upstream markers + source line** — [RUN] `git init; git fetch --depth 1 origin e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6; git checkout FETCH_HEAD` of `bmad-code-org/BMAD-METHOD` in a scratch dir (removed after the run) → HEAD `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`. Start marker at `skills/bmad-project-context/references/template.md:17`, end marker at `:52`, both inside the four-backtick `markdown` fence that opens at `:16` and closes at `:53`; provenance line `:18`; file blob `f83ed82bf732d7933506921dbd1dd977d8974404`. The splice rule is `SKILL.md:72`; the proposals that can touch our blocks are `SKILL.md:37`, `:74`, `:97`. Committed fixture `test/fixtures/instruction-file-coexistence/bmad-project-context-template.md` is a verbatim copy of that file (upstream MIT); every run recomputes its git blob hash and asserts `f83ed82b…` and lines 17/52/16, so the fixture cannot drift from the pin. The test reads the markers and block template from it at run time (no upstream text in the test, helper, writer or case table — self-checked by a test); `BMAD_V7_TREE=<tree>` reads `<tree>/skills/bmad-project-context/references/template.md` instead ([RUN] against the pinned clone: 46 passed, same lines and blob). A missing file exits 1 with `pinned upstream template not found … (no fallback)`.

**Writer module** — `lib/inject/marker-block.js`: `spliceFile` / `removeFile` (and pure `spliceText` / `removeText` / `findBlock`), `MA_AGENTS_MARKERS`, `MA_STANDARDS_MARKERS`, `MarkerBlockError`. Exact line equality; byte-exact I/O (`latin1`); append via `fs.appendFileSync` when the block is absent; no write when unchanged; removal deletes the file only when only whitespace remains; duplicate/unbalanced markers refused. `ma-standards` writer model: `test/helpers/ma-standards-apply.js` (`apply`, `remove` over `AGENTS.md`, `CLAUDE.md`, `.clinerules`, `.github/copilot-instructions.md`; `.roomodes` refused, see AC10) — 37.2 adopts it. Case table: `test/fixtures/instruction-file-coexistence/case-table.json` (32 cases: inputs, write order, expected bytes as segments; generated by `node test/instruction-file-coexistence.test.js --write-case-table` from a segment reference model, asserted equal to the model on every run). Test `test/instruction-file-coexistence.test.js` appended to the `npm test` chain after `test/wheelhouse-coverage.test.js`.

[RUN] `node test/instruction-file-coexistence.test.js` → `46 passed, 0 failed`. [RUN] `node test/uv-transition-resilience.test.js` → `7 passed, 0 failed` (no `uv run` in `lib/`). Full `npm test` chain not run (instructed).

| AC | Result | Evidence |
|---|---|---|
| AC1 | PASS | 5 unit tests: exact line equality (indented, trailing-space, inline, `-x`-extended and 3.x markers not matched); BOM, mixed EOL, invalid UTF-8 and no-final-newline bytes outside the block preserved; append keeps the old bytes as a prefix; unchanged re-run leaves mtime untouched; ambiguous markers / marker lines in the body refused with nothing written; same module with both marker pairs |
| AC2 | PASS | `ac2-order-a-lf`: empty project → `ma-agents` → simulated upstream; `ma-agents` block byte-identical, upstream once |
| AC3 | PASS | `ac3-order-b-lf`: upstream block byte-identical, `ma-agents` once, prefix unchanged |
| AC4 | PASS | 6 orders × 3 passes (2 re-runs, new content each pass) with user paragraphs before/between/after: each block once and equal to its last write, every paragraph once and in order; full-file bytes equal the case table |
| AC5 | PASS | after every AC4 case: re-running all three writers with unchanged input → same sha256; our writers return `unchanged` and do not touch mtime |
| AC6 | PASS | 8 cases: removing `ma-agents`, `ma-standards`, or both keeps the upstream block and all prose (LF and CRLF); a file holding only our blocks is deleted; upstream-only remainder kept; append-then-remove restores the original bytes; removal idempotent |
| AC7 | PASS | table case with an inline mention, the 3.x block, `<!-- ma-agents:start-x -->` pair, indented look-alikes, the upstream block and the `ma-standards` block: all byte-identical through write/rewrite/remove/write; matcher cross-check (each owner's matcher finds only its block; upstream markers read at test time); a real 3.x `AGENTS.md` produced by `markdownMarkersMerger` (`lib/installer.js:1332`) stays a byte prefix through all three writers and both removals |
| AC8 | PASS | AC2, AC3 and the six AC4 orders repeated on CRLF fixtures (no bare LF in the result, bytes equal the table); mixed files (CRLF upstream block in an LF file and the reverse) keep the foreign block's line endings and are restored byte-for-byte by removal |
| AC9 | DEFECT (CLAUDE.md) / PASS (AGENTS.md) | two real runs below; finding to PO, 37.2 and 39.2 |
| AC10 | PASS (review recorded) | below |
| AC11 | PASS | mutants below, all red |

**Adopt runs (AC9)** — [RUN] ×2. Tool: Claude Code (VS Code session); each run a fresh `general-purpose` subagent (new context, nothing shared) that read and executed the pinned `SKILL.md` from `<project>/.claude/skills/bmad-project-context/` (folder copied from the pinned clone; the same real-folder layout the Skills CLI `--agent claude-code` install produces, 36.1 AC2). Model: Opus 5.5 (`claude-opus-5-5`), both runs. The user turns were scripted, because no `claude` CLI is on PATH for an interactive session: decline the BMad setup offer (no `_bmad/`, so `customize.toml` defaults); "Nothing beyond what is already in the repo."; "I have nothing to add."; approve the default proposal in full (block, every ledger decision, every itemized line, every fix to other files). Scratch project: 7-file Node repo, commit `c6f36ad`, trunk `master`; `AGENTS.md` = title, prose, `ma-agents` block, `## Team notes`, `ma-standards` block, trailing line (sha256 `f5d85454…`); `CLAUDE.md` = title, both blocks, one line (sha256 `e6dcfd8a…`).

- Run 1 — intent: "**adopt** — `AGENTS.md` carries meaningful instructions … and has no `<!-- bmad:context -->` managed block; the `ma-agents`/`ma-standards` marker pairs belong to another tool, not this skill." Ledger entries on our blocks: "A3 | ma-agents block: "Installed by ma-agents 4.0.0. Modules: …" | retain | Owned by the ma-agents installer (its markers); edits inside would be overwritten on its next run"; "A4 | … Entry point … | retain — flagged unverifiable"; "A5 | … `UV_CONFIG_FILE` … | retain — flagged stale | Path check fails: `.ma-agents/` does not exist. Ground 1 would apply, but the line sits inside the installer's markers and would be re-written on its next run"; "A9/A10 | ma-standards … | retain"; "A11 | … `code-review` skill … | retain — flagged unverifiable". `CLAUDE.md`: "C1 | `# CLAUDE.md` title | delete — held for line-item approval (ground 4)"; "C2 | ma-agents block (all three lines, verbatim duplicate of A3–A5) | relocate (de-duplicate) | Same text is loaded twice in Claude Code — paid for twice. Kept once in `AGENTS.md`; Claude Code loads it through the `@AGENTS.md` import"; "C3 | ma-standards block … | relocate (de-duplicate) | As C2"; "C4 | "Prefer small pull requests." | relocate | block → Policy". Proposal: "**CLAUDE.md:** reduce to the single line `@AGENTS.md`. … Risk: the ma-agents installer may re-insert its blocks into `CLAUDE.md` on its next run; if it does, point it at `AGENTS.md` only, or re-run this skill to de-duplicate again."
- Run 2 — intent: "**adopt** — `AGENTS.md` (and `CLAUDE.md`) carry meaningful instructions but no `<!-- bmad:context -->` managed block exists". Ledger: "A3 | `<!-- ma-agents:start -->` block as a whole | retain, in place | Managed by the ma-agents installer (its own markers); editing inside would be overwritten on reinstall"; A3a–A3c retain (flagged unverifiable); "A5 | `<!-- ma-standards:start -->` block as a whole | retain, in place | Installer-managed markers"; "A5a | "Work on a feature branch in a git worktree; never commit to `main`." | retain + reconciling line in block | Repo contradicts it: trunk is `master` …"; `CLAUDE.md`: "C2 | ma-agents block copy (all three lines) | delete as duplicate | Verbatim duplicate of A3; kept once — survivor is the AGENTS.md copy inside its own ma-agents markers (not moved into the bmad block, because the installer owns and regenerates it)"; "C3 | ma-standards block copy | delete as duplicate"; "C1 | title | delete (ride with C-reduction)"; "C4 | relocate | block › Policy". Proposals: "**CLAUDE.md reduction:** CLAUDE.md is reduced to the single line `@AGENTS.md`"; the new upstream block's Policy gains "Never commit to `master`, this repo's trunk; the ma-standards rule below names `main`, which does not exist here."; "**Risk stated:** if the ma-agents installer re-writes its blocks into CLAUDE.md on the next install/update, they will be loaded twice …".
- Bytes after approval ([RUN], extracted marker-to-marker and hashed): `AGENTS.md` `ma-agents` block sha256 `ebacfdff…` and `ma-standards` block `267f1b1c…` — identical to the baseline in both runs (the user prose that surrounded them moved into the new upstream block, so both blocks now sit after it); `CLAUDE.md` = `@AGENTS.md\n` (11 bytes, sha256 `336cc4fb…`) in both runs — both of our blocks deleted. Both runs also edited `README.md` (an `npm test` contradiction fix). Nothing committed.
- Verdict: `AGENTS.md` PASS in both runs; `CLAUDE.md` FAIL in both runs — the default adopt proposal removes our `CLAUDE.md` blocks as duplicates of the `AGENTS.md` copies. Divergence: C2/C3 decided `relocate` (run 1) vs `delete as duplicate` (run 2), same bytes; run 2 wrote an upstream-block line that overrides a `ma-standards` rule (triggered by the scratch repo's `master` trunk), run 1 did not; run 1 held heading deletions for line-item approval, run 2 did not.
- Finding → PO (UX defect), 37.2 and 39.2 (design input): with both of our writers targeting `CLAUDE.md`, v7 adoption deletes our `CLAUDE.md` blocks and reduces the file to `@AGENTS.md`; the next `ma-agents install`/`update` or `ma-standards-apply` re-appends them (test AC10: restored once after the import line), and the next `refresh` will flag them as duplicates again — a loop, and the skill itself says so. Proposed mitigation: (a) 37.2/39.2 do not write a block into `CLAUDE.md` when it contains an `@AGENTS.md` import line and `AGENTS.md` holds the same block (or write `CLAUDE.md` only as that import); (b) a `persistent_facts` line on `bmad-project-context` naming the `ma-agents` and `ma-standards` blocks as tool-managed (retain in place; never de-duplicate, relocate or override them), checked by the 36.4 classifier.

**Instruction-file review (AC10)** — the five files `ma-standards-apply` writes, against the pinned skill: `AGENTS.md`, `.clinerules`, `.github/copilot-instructions.md` are markdown and covered by the block writer (test creates, re-runs `unchanged`, removes → deleted, all four markdown files). `CLAUDE.md` is in scope because adoption rewrites it (`SKILL.md:97`; both AC9 runs did): AC4 repeated as six orders of `ma-agents`, `ma-standards` and the simulated reduction (whole file → `@AGENTS.md`, as observed) × 3 passes plus the next install run — import line first and once, each block once and equal to its last write; AC6 repeated (`ac10-claude-remove-after-reduction`: removing both blocks leaves `@AGENTS.md`, file kept). `.roomodes` is YAML: an HTML-comment pair is invalid there, and a YAML comment pair (`# ma-standards:start/end`) is dropped by the existing parse/dump writer `lib/merge/roomodes.js` `mergeRoomodes` ([RUN] in the test). Block form 37.2 must use in `.roomodes`: a `customModes` entry with an `ma-standards`-owned slug, merged and removed structurally by slug (the `MA_AGENTS_OWNED_SLUGS` pattern); the helper refuses `.roomodes`.

**Mutants m1–m5 (AC11)** — [RUN] each applied to the working copy, `node test/instruction-file-coexistence.test.js` run, file restored (verified with `cmp`):

- m1 — append branch writes only the block (`writeFileSync` of the block, dropping existing content): exit 1, 30 failing, including `AC3 ac3-order-b-lf` and the CRLF AC2/AC3 cases.
- m2 — matcher made prefix-based (`line.text.startsWith(marker without " -->")`): exit 1, 2 failing (`AC7 ac7-non-interference`, AC1 exact line equality).
- m3 — writer normalises CRLF to LF and rewrites: exit 1, 13 failing (every CRLF AC2/AC3/AC4 case, `AC8 mixed EOL`, two AC1 tests).
- m4 — removal deletes the file unconditionally: exit 1, 12 failing (all AC6 cases with a remainder, AC7, AC8, AC10 removal).
- m5 — template path pointed at a nonexistent file: (a) fixture path renamed in the test → exit 1, `FATAL: pinned upstream template not found: …bmad-project-context-template.missing.md (no fallback)`; (b) `BMAD_V7_TREE=/nonexistent` → exit 1, same message. No fallback literal exists (self-check test).

**Unverified** — (1) AC9 was not run through an installed skill invoked from an interactive coding-tool session with a human: no `claude` CLI is on PATH here, so each run was a fresh subagent executing the pinned `SKILL.md` with scripted user turns; 36.7 repeats it at GA in a real session. (2) 36.3's `bundle/bmad-method/` is not wired as a source (it does not exist yet); `BMAD_V7_TREE` covers the pinned/GA tree. (3) Marker lines quoted inside a fenced code block in user prose are matched by exact line equality (no fence awareness); not required by AC1, recorded as a residual. (4) Linux not run; full `npm test` chain not run.

### File List

- `lib/inject/marker-block.js` (new)
- `test/helpers/ma-standards-apply.js` (new)
- `test/instruction-file-coexistence.test.js` (new)
- `test/fixtures/instruction-file-coexistence/bmad-project-context-template.md` (new; verbatim upstream copy)
- `test/fixtures/instruction-file-coexistence/case-table.json` (new)
- `package.json` (test chain)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (row `36-5-agents-md-two-writer-test-v7: review`)
