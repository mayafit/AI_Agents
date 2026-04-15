# Story 21.5: Expanded `.clinerules` Template

Status: Ready

## Story

As a **Cline user**,
I want `.clinerules` to include BMAD phase discipline and text-vs-file rules,
So that Cline (which already supports `.clinerules` natively) gets the same universal guardrails.

## Acceptance Criteria

> Acceptance criteria marked **(gap-fill)** are additions made by the story author to make the epic's AC operational and testable. They do not contradict the epic; they refine the "how" where the epic only stated the "what". Controlling invariants: NFR44 (byte-identity for standard profile), NFR46 (idempotency), NFR18 (additive JSON-merge — not applicable here, see Dev Notes), NFR47 (Roo Code fileRegex — not applicable here, see Dev Notes).

1. **Cline template file exists.** A new file pinned at the exact path `lib/templates/clinerules.template.md` (new) is present and is formatted per Cline's `.clinerules` convention (flat markdown rule list, no front-matter). The rendered marker-block content includes:
   - The universal text-vs-file rules (file-action keywords `create`, `write`, `generate`, `build`, `implement` → file; text-response keywords `what do you think`, `how should we`, `discuss`, `opinion` → text; "if unsure respond in text" default; "never create `response.md` or `output.md` as a reply"; "confirm file paths before writing").
   - The BMAD phase discipline rules (respect declared phase; do not skip ahead to implementation during planning).
   - A Cline-specific framing line: "Use Cline's Architect mode for BMAD planning phases (PM, Architect, Tech Lead). Switch to Code mode only for the implementation phase." This is universal guidance, not on-prem-specific.

2. **(gap-fill) Universal rule text is not hand-duplicated; byte-identity by construction across both Cline files.** The five universal rule sections originate from Story 21.2's `lib/templates/instruction-block-universal.template.md` and are rendered via the 21.2-owned composer `composeInstructionBlock({ profile, projectRoot }) → string` (single-owner in `lib/installer.js`). The composer's output is written into BOTH `.clinerules` AND `.cline/clinerules.md` in a SINGLE stamper pass — the composed string is produced once and the stamper writes it into both targets, making the two files cross-file byte-identical by construction (no second render, no reconciliation). `clinerules.template.md` supplies ONLY the Cline-specific framing (header paragraph + Architect-mode line from AC #1). Any divergence between Cline's rule text and the canonical universal block is a bug under NFR46.

   > **Resolution (Option B, canonical):** `composeInstructionBlock` is extended so the same 21.2-owned composer serves ALL FIVE agents uniformly (Claude Code, Cursor, Kilocode, Copilot, Gemini-style file-based agents, Cline, Roo Code). The composer is the single owner of composition; mergers and stampers receive the already-composed string as input. No per-agent composer variant, no Cline-specific composition branch.

3. **Both Cline instruction files written via marker-based additive stamper.** Cline registers two instruction files in `lib/agents.js` (verified at line 137): `.cline/clinerules.md` and `.clinerules`. When Cline is selected in `npx ma-agents install`, both files are written/updated at the project root using the existing marker-based additive stamper path in `updateAgentInstructions` (`lib/installer.js` ~lines 407–459, markers `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->`). The `for (const fileName of agent.instructionFiles)` loop at line 428 is the single iteration point; no special-case code per file.

4. **User content outside markers preserved.** Content outside `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` in either Cline file is preserved byte-for-byte across installs (NFR5 additive-only contract; this is the existing marker-stamper contract inherited from Story 21.2).

5. **(gap-fill) Idempotency per file (NFR46).** Two consecutive installs with the same profile and project state produce byte-identical content inside the marker block of each Cline file. This is a direct consequence of Story 21.2's NFR46 contract applied to Cline's two-entry `instructionFiles[]` list; this story adds no new idempotency-breaking inputs.

6. **Dual-file drift detection between `.cline/clinerules.md` and `.clinerules`.** Before the stamper writes the marker block to either file, the installer reads both existing files (when both are present) and compares their in-marker contents. If the two marker blocks diverge (non-whitespace diff), the installer ABORTS with a named error `ClinerulesDualFileDriftError` naming both file paths and emitting the diff, instructing the user to reconcile manually before retrying. `--yes` does NOT bypass this check — reconciliation between the two Cline rule files is user work, and silently picking a "winner" could discard intentional edits. This is an explicit, documented exception to the usual `--yes` bypass convention. Note: per AC #2, cross-file byte-identity is guaranteed by construction on fresh write; this check catches post-install external edits only.

7. **(gap-fill) Profile isolation (NFR44).** In a standard-profile Cline install, neither `.cline/clinerules.md` nor `.clinerules` contains any of the strings `/no_think`, `str_replace_editor`, or `~/.claude/`. Verified by grep-style assertion on rendered standard-profile output for both files.

8. **(gap-fill) On-prem profile appends on-prem content.** When `profile === 'on-prem'` and Story 21.6's `lib/templates/instruction-block-onprem.template.md` exists, the on-prem rules composed by `composeInstructionBlock` appear within the same `<!-- MA-AGENTS-START -->` markers in both Cline files. This AC asserts wiring only — on-prem content ships in Story 21.6. Graceful fallback to universal-only when the on-prem template file is absent (per Story 21.2 AC #3).

9. **(gap-fill) MANIFEST path rendering.** The `{{MANIFEST_PATH}}` placeholder inherited via `composeInstructionBlock` resolves to `.cline/skills/MANIFEST.yaml` (relative to project root, forward-slashed on Windows). This is the pre-Epic-21 Cline MANIFEST path — unchanged — and is verified by an explicit test assertion.

> **Open question:** Cline v3+ introduced a `.clinerules/` directory of numbered rule files as an alternative to a single `.clinerules` file. The epic treats `.clinerules` as a single file, matching current `lib/agents.js` registration. Proposed resolution: out of scope. A follow-up story can add directory support if field feedback demands it.

> **Resolved (see AC #2):** Cross-file byte-identity is a hard invariant enforced by construction — the 21.2-owned composer produces the string once and the stamper performs a single pass that writes it into both targets. Drift therefore arises only from external user edits, which AC #6 catches.

## Tasks / Subtasks

- [ ] **Task 1: Create Cline template** (AC #1, #2, #7)
  - [ ] 1.1 Create `lib/templates/clinerules.template.md` (new) containing a Cline-flavored framing (header `# Cline Project Rules`, short intro paragraph, the Architect-mode guidance line from AC #1). Per canonical Option B (AC #2), this framing is consumed by the 21.2-owned composer `composeInstructionBlock({ profile, projectRoot })`; the universal rule body is NOT hand-copied — it is composed at install time.
  - [ ] 1.2 Verify by inspection that no string in the template file matches `/no_think`, `str_replace_editor`, or `~/.claude/` (AC #7).

- [ ] **Task 2: Consume the 21.2-owned composer uniformly** (AC #2, #3, #4, #8)
  - [ ] 2.1 Verify `updateAgentInstructions` in `lib/installer.js` (line ~358) iterates both Cline files via the existing `for (const fileName of agent.instructionFiles)` loop (line 428). No iteration change required — Story 21.2 already generalized the path.
  - [ ] 2.2 Verify (via test, not code change) that `composeInstructionBlock({ profile: getProfile(projectRoot) || 'standard', projectRoot })` is invoked ONCE per install and the resulting string is handed to the stamper, which writes it into both `.clinerules` and `.cline/clinerules.md` in a single pass — cross-file byte-identical by construction.
  - [ ] 2.3 Story 21.2 extends `composeInstructionBlock` so the same composer serves Cline (Option B, canonical). This story does not add a Cline-specific composition branch, a first-insert-wrapper branch, or any per-agent composer variant. If the 21.2 extension is not yet merged, this story is BLOCKED on 21.2 (see Dependencies).

- [ ] **Task 3: Dual-file drift detection** (AC #6)
  - [ ] 3.1 Before the stamper writes the marker block to either Cline file, extract in-marker content from both `.cline/clinerules.md` and `.clinerules` (when both exist).
  - [ ] 3.2 If the two in-marker contents differ (non-whitespace diff), throw `ClinerulesDualFileDriftError` naming both files and including the unified diff.
  - [ ] 3.3 `--yes` does NOT bypass this error. Add a one-line mention in `bin/cli.js` `--help` text under the `install` section: "Note: divergent `.cline/clinerules.md` vs. `.clinerules` marker blocks require manual reconciliation — `--yes` does not bypass this check."
  - [ ] 3.4 When only one of the two Cline files exists (fresh install or partial uninstall), drift detection is skipped and both files are written from the same render per AC #6's "render once, write twice" invariant.

- [ ] **Task 4: (removed — Option B canonical)** Option B makes per-agent `extraInstructionTemplates` wiring unnecessary for Cline; the 21.2-owned composer reads `clinerules.template.md` directly via its framing input. Left as an anchor for traceability; no action required in this story.

- [ ] **Task 5: Unit and integration tests** — see Testing section below.

- [ ] **Task 6: Documentation touch-up**
  - [ ] 6.1 No documentation changes in this story. Story 21.8 introduces the broader Epic 21 doc surface. The `--help` line in Task 3.3 is the only user-facing text addition.

## Dev Notes

### Architecture compliance

- **Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile)** — This story implements the Cline slice of the universal layer. Cline's Architect mode is the application-layer enforcement we leverage via prompt guidance (AC #1 framing line). Unlike Roo Code (Story 21.3, NFR47 `fileRegex`), Cline has no fileRegex-equivalent enforcement — `.clinerules` is prompt-only.

- **NFR44 (byte-identity for standard profile)** — AC #7 asserts absence of `/no_think`, `str_replace_editor`, `~/.claude/` from standard-profile Cline output across both files. Enforced transitively by Story 21.2's `composeInstructionBlock` contract; this story adds the Cline-specific per-file assertion.

- **NFR46 (idempotency)** — AC #5 requires byte-identical marker-block content across consecutive installs per-file. Story 21.2's Task 3.3 (insert/replace whitespace parity) is the prerequisite. AC #2's single-composer + single-stamper-pass invariant additionally gives cross-file byte-identity by construction.

- **NFR47 (Roo Code fileRegex)** — Not applicable. Cline has no application-layer file-restriction mechanism; phase discipline in `.clinerules` is prompt-only. Users needing fileRegex-equivalent enforcement should use Roo Code (Story 21.3). This story does not attempt to emulate NFR47 in Cline.

- **NFR18 (additive JSON-merge)** — Not applicable to Cline. NFR18 governs OpenCode's `opencode.json::instructions[]` merge (Story 21.4). Cline uses a plain markdown stamper; no JSON merge involved. Cited here only to confirm Cline path does not regress JSON behavior.

### Verified source-tree surface

| File | Exists? | Role in this story |
|------|---------|--------------------|
| `lib/profile.js` | verified (Story 21.1, lines 1–107) | Read-only — `getProfile(projectRoot)` consumed by `updateAgentInstructions` |
| `lib/installer.js` | verified — `updateAgentInstructions` at line ~358, iteration loop at line 428 | Task 3 adds drift-detection branch inside the Cline-file path. Task 2.3 may add first-insert wrapper branch |
| `lib/agents.js` | verified — Cline entry lines 113–139, `instructionFiles: ['.cline/clinerules.md', '.clinerules']` at line 137 | Read-only unless Task 4.1 required |
| `bin/cli.js` | verified | Task 3.3 — one-line addition to `--help` text for `install` |
| `lib/templates/clinerules.template.md` | **new** | Cline-flavored wrapper (AC #1) |
| `lib/templates/instruction-block-universal.template.md` | **new (Story 21.2)** | Source of universal rule text consumed by `composeInstructionBlock` |
| `lib/templates/instruction-block-onprem.template.md` | **new (Story 21.6)** | On-prem content appended by `composeInstructionBlock` when profile=on-prem |
| `lib/templates/project-context.template.md` | verified | Reference for `{{PLACEHOLDER}}` template-stamping syntax |
| `test/clinerules.test.js` | **new** | Unit + integration tests (see Testing section) |
| `test/profile.test.js` | verified (Story 21.1) | Reference for test framework and temp-dir isolation pattern |

### Composition pattern reuse

This story introduces no new composition pattern. It consumes the 21.2-owned `composeInstructionBlock({ profile, projectRoot }) → string` (Story 21.2 AC #3), extended under Option B to serve all five agents uniformly. The Cline-specific inputs are the two-entry `instructionFiles[]` list and the Architect-mode framing line (AC #1). The composed rule body is identical to what Claude Code, Cursor, Kilocode, Copilot, Gemini, and the Roo Code rules file receive.

### Stamper site map (Cline-specific)

- **Markdown marker stamper** (`lib/installer.js` `updateAgentInstructions` ~lines 407–459, loop at line 428): writes `.cline/clinerules.md` and `.clinerules` with marker-wrapped composed content produced by the 21.2-owned composer.
- **Skills dir** (`lib/agents.js` line 118, `.cline/skills`): unaffected.
- **MANIFEST.yaml path** computed via `path.relative(projectRoot, path.join(agent.getProjectPath(), 'MANIFEST.yaml')).replace(/\\/g, '/')`. For Cline, `getProjectPath()` returns `path.join(process.cwd(), '.cline', 'skills')`, so the rendered manifest path is `.cline/skills/MANIFEST.yaml` — unchanged from pre-Epic-21 (AC #9).

### Library and pattern references

- **Template placeholder syntax:** `{{PLACEHOLDER}}` — see `lib/templates/project-context.template.md`. This story uses exactly one placeholder (`{{MANIFEST_PATH}}`) inherited via `composeInstructionBlock`.
- **Marker constants:** `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` — defined in `lib/installer.js` (Story 21.2 touches these; this story does not).
- **Backup filename format:** `<target>.backup-<ISO-8601-timestamp>` — 21.2-owned convention applied when the stamper rewrites either Cline file. Cite Story 21.2 (upstream) as the sole owner of this format; do not redefine here.
- **Error convention:** `ClinerulesDualFileDriftError` (new) — thrown by the drift-detection branch. Follows the error-class naming pattern introduced by Story 21.10's `RoomodesSlugDivergenceError` (Story 21.3 AC #9 / Story 21.10 AC #5). Both are install-time abort errors that require user action.

### Cline-specific considerations

- **Architect / Code mode.** Cline exposes an Architect vs. Code mode toggle. AC #1 framing line steers users to use Architect mode during BMAD planning phases and Code mode only for implementation. This is prompt-level guidance — no application-layer enforcement exists. If Cline introduces application-layer mode gating in a future version, a follow-up story can integrate it.
- **`.clinerules/` directory (v3+).** Out of scope per open question. This story assumes single-file `.clinerules`.

### Out of Scope

- Universal template content (Story 21.2).
- On-prem template content and on-prem conditional wiring details beyond the signature-compatible call (Story 21.6).
- `.roomodes` template and Roo Code `fileRegex` (Story 21.3).
- `AGENTS.md` for OpenCode (Story 21.4).
- BMAD persona phase prefix in customize-loader (Story 21.7).
- vLLM deployment doc and README on-prem section (Story 21.8).
- Cross-agent NFR44/NFR46 byte-comparison tests (Story 21.9).
- Cline `.clinerules/` directory support (Cline v3+).
- Cline Plan/Act-mode integration beyond the AC #1 framing line.
- Profile reconfigure and uninstall flows (Stories 21.10, 21.11).
- Cline-to-Roo migration (Epic 18 Story 18.7).

## Dependencies

### Upstream (blocking)

- **Story 21.1 (done)** — `lib/profile.js::getProfile(projectRoot)` consumed via `updateAgentInstructions`. Verified at `lib/profile.js` lines 29–43.
- **Story 21.2 (Ready)** — The 21.2-owned composer `composeInstructionBlock({ profile, projectRoot }) → string` in `lib/installer.js` is the single-owner composition entry point, serving all five agents uniformly per Option B (AC #2). 21.2 also owns the backup filename format `<target>.backup-<ISO-8601-timestamp>`. Without 21.2, Story 21.5 has no universal rule-body source and no backup convention. `.cline/clinerules.md` and `.clinerules` are already iterated in `updateAgentInstructions`'s loop (line 428) so 21.2 covers the Cline stamper by default; 21.5's value-add is the Cline-flavored framing template (AC #1), the dual-file drift check (AC #6), and Cline-specific tests.

### Downstream (consumers of this story's surface)

- **Story 21.6** — Adds on-prem template content; Cline files pick up on-prem content via the same `composeInstructionBlock` path (AC #8). No Story 21.5 signature change required.
- **Story 21.9** — Integration tests asserting Cline-specific NFR44 absence across both Cline files and NFR46 idempotency across consecutive installs of a Cline-only selection.
- **Stories 21.10 / 21.11** — Profile reconfigure and uninstall must cover both `.cline/clinerules.md` and `.clinerules` marker blocks in their re-stamp and cleanup passes. The Cline `instructionFiles[]` list from `lib/agents.js` is the authoritative enumeration. `ClinerulesDualFileDriftError` from AC #6 may also surface in `reconfigure`; 21.10 inherits the same abort semantics.

## Testing

**Framework and isolation:** Match the pattern in `test/profile.test.js` (Story 21.1) — node's built-in test runner, `os.tmpdir()` + `fs.mkdtempSync` per-test temporary project roots, never mutate the repo's own `.ma-agents.json` or `lib/templates/`.

New test file: `test/clinerules.test.js` (new).

**Unit tests:**

- 5.1 Cline template file exists at `lib/templates/clinerules.template.md` and contains the AC #1 Architect-mode framing line (existence + shape check; rule-body text lives in the universal template per AC #2).
- 5.2 NFR44 per-file: after a standard-profile install of a Cline-only selection, neither `.cline/clinerules.md` nor `.clinerules` contains the literals `/no_think`, `str_replace_editor`, or `~/.claude/` (AC #7).
- 5.3 NFR46 per-file: two consecutive installs produce byte-identical marker-block content in each Cline file (AC #5).
- 5.4 Cross-file identity by construction: after a single install, `.cline/clinerules.md` and `.clinerules` have byte-identical marker-block content (AC #6 "render once, write twice" invariant).

**Integration tests (within this story — full end-to-end lives in Story 21.9):**

- 5.5 Fresh install of a Cline-only selection writes both `.cline/clinerules.md` and `.clinerules` at the project root; both contain marker-wrapped composed content (AC #3, #4).
- 5.6 User content outside markers is preserved byte-for-byte across two installs (AC #4) — verified by seeding a user preamble above the markers and a user postamble below them in each Cline file, running install twice, and asserting preamble/postamble bytes are untouched.
- 5.7 On-prem profile (when Story 21.6's template file is present): both Cline files contain on-prem content inside the markers (AC #8). When Story 21.6's template is absent, on-prem profile install still succeeds and emits universal-only content — no error (graceful fallback, Story 21.2 AC #3).
- 5.8 MANIFEST path rendering: `{{MANIFEST_PATH}}` resolves to `.cline/skills/MANIFEST.yaml` (relative to project root, forward-slashed on Windows) in both Cline files (AC #9).
- 5.9 Dual-file drift detection (AC #6):
  - Both files exist with identical marker-block content → install proceeds silently.
  - Both files exist with divergent marker-block content (simulated by hand-editing one file) + interactive install → throws `ClinerulesDualFileDriftError` naming both files and emitting the diff.
  - Same as above + `--yes` → still throws `ClinerulesDualFileDriftError` (AC #6: `--yes` does NOT bypass).
  - Only one of the two files exists → drift detection skipped; install writes both files from the same render.

**Test data isolation:** All tests create a tmp project with a stub `.ma-agents.json` written via `setProfile(tmpRoot, 'standard' | 'on-prem')` (Story 21.1 API). Do not stub `lib/profile.js` or `composeInstructionBlock` — use the real modules against the tmp project root to catch integration bugs.

**Coverage note:** Story 21.9 adds a cross-agent NFR44 byte-comparison test and cross-agent NFR46 idempotency test. Do not duplicate those here — keep 21.5 tests scoped to Cline's two files.

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled)_

### Completion Notes List
_(to be filled)_

### File List
_(to be filled)_

## Change Log

- 2026-04-14: Story created (Epic 21, Story 21.5)
- 2026-04-14: Added AC #6 for `.cline/clinerules.md` vs `.clinerules` drift detection (Finding #10, corrective plan step 3). `--yes` does NOT bypass this check — reconciliation is user work.
- 2026-04-15: Story expanded as Cline slice of the universal layer atop Story 21.2. Gap-fill ACs flagged (AC #2, #5, #7, #8, #9). NFR44/NFR46/NFR47/NFR18 citations made explicit. Verified source-tree surface table added. Upstream/downstream dependencies split. Testing section expanded (9 tests). Three open questions raised inline rather than invented as ACs. Status set to Ready.
- 2026-04-15: Applied adversarial-review canonical decisions. AC #1 pins `lib/templates/clinerules.template.md` (closes P1 #9). AC #2 resolves Option A vs B inline — Option B chosen (extend the 21.2-owned `composeInstructionBlock({profile, projectRoot}) → string` to serve all five agents uniformly; closes P1 #3) and folds the cross-file byte-identity invariant into AC #2 (single composer + single stamper pass → both Cline files byte-identical by construction; eliminates the second open question). Terminology normalized to composer / merger / stamper (closes P1 #10); "injection function" and "marker-injection" deleted. Story 21.2 cited as sole upstream owner of the composer and the `<target>.backup-<ISO-8601-timestamp>` backup filename format. Task 2.3's conditional branching removed; Task 4 retired (Option B obviates per-agent `extraInstructionTemplates`). All tasks unconditional — Status remains Ready.
