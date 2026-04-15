# Story 21.2: Universal Per-Tool Instruction Block Expansion

Status: Review

## Story

As a **chief architect**,
I want the existing `<!-- MA-AGENTS-START -->` injection block to enforce text-vs-file discipline and BMAD phase boundaries for every install (regardless of profile),
So that all coding agents — even Claude on the web — stop dumping random files as responses and stop skipping BMAD planning to start coding.

## Acceptance Criteria

> Acceptance criteria marked **(gap-fill)** are additions made by the story author to make the epic's AC operational and testable. They do not contradict the epic; they refine the "how" where the epic only stated the "what".

1. **Universal template file exists.** A new file `lib/templates/instruction-block-universal.template.md` (new) is present and contains, in addition to the current MANIFEST loading instruction already emitted by `updateAgentInstructions` in `lib/installer.js`:
   - A "Respond in TEXT vs. create FILES" rules section listing concrete keyword triggers: file-action keywords (`create`, `write`, `generate`, `build`, `implement`) and text-response keywords (`what do you think`, `how should we`, `discuss`, `opinion`).
   - An "if unsure, respond in text" default rule.
   - A "never create `response.md` or `output.md` as a reply" rule.
   - A BMAD phase discipline rule: respect the declared phase; do not skip ahead to implementation during planning.
   - A "confirm file paths before writing" rule.
2. **(gap-fill) Placeholder contract.** The template source contains `{{MANIFEST_PATH}}` exactly once as the only placeholder; no agent-specific paths are hardcoded. The existing per-agent manifest-path computation in `updateAgentInstructions` (`lib/installer.js` line ~369 / ~408 — `path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml'))`) is the value substituted in.
3. **(gap-fill) Composer function.** A new function `composeInstructionBlock({ profile, projectRoot })` (new) in `lib/installer.js`:
   - Reads `lib/templates/instruction-block-universal.template.md` (always).
   - When `profile === 'on-prem'`, reads `lib/templates/instruction-block-onprem.template.md` (new, ships in Story 21.6) and appends it to the universal content separated by a single blank line.
   - When `profile === 'on-prem'` AND the on-prem template file is missing, **throws** `Error('on-prem profile selected but instruction-block-onprem.template.md is missing')`. NO silent fallback.
   - When `profile !== 'on-prem'`, returns the universal content only.
   - Templates contain NO `{{...}}` placeholders; any substitution is the caller's responsibility, done AFTER composition.
   - Single-owner contract: `lib/installer.js` calls `composeInstructionBlock` exactly once per stamped artifact. Mergers receive the already-composed string; mergers do not call `composeInstructionBlock` themselves.
   - Is the **single composer entry point** consumed by stories 21.3 (roomodes mode `customInstructions`), 21.4 (AGENTS.md), 21.5 (.clinerules), and 21.6 (on-prem content). Those stories extend behavior by adding inputs to `composeInstructionBlock` or sibling composers — they do not duplicate the text-vs-file / phase-discipline rules.
4. **Per-tool merger wired.** The existing marker-based merger in `updateAgentInstructions` (`lib/installer.js`, markers `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->`, see `lib/installer.js` lines ~424–459) calls `composeInstructionBlock` with the project's resolved profile (obtained via `getProfile(projectRoot)` from `lib/profile.js`) and emits the composed content between the markers.
5. **All markdown-merger agents receive the block.** For every agent in `lib/agents.js` whose `instructionFiles[]` is a markdown file — Claude Code (`.claude/CLAUDE.md`), Cline (`.cline/clinerules.md` and `.clinerules`), Roo Code (`.roo/rules/00-ma-agents.md`), Cursor (`.cursor/cursor.md`), Kilocode (`.kilocode/kilocode.md`), Copilot (`.github/copilot/copilot.md`), Gemini (`.gemini/gemini.md`) — a fresh install produces an instruction file whose marker block contains the universal block content. Content outside the markers is preserved byte-for-byte (**NFR5 additive-only contract; NFR46 idempotency**).
6. **Idempotency (NFR46).** Two consecutive installs with the same profile and project state produce byte-identical content inside the marker block. The per-install header/footer contains no timestamps, random IDs, or ordering-sensitive content.
7. **Profile isolation (NFR44).** The universal block content MUST NOT mention `/no_think`, `str_replace_editor`, `~/.claude/`, or any local-LLM-specific concept. Those strings belong in the on-prem template (Story 21.6). Verified by a grep-style assertion on rendered standard-profile output: absence of each of those three strings.
8. **(gap-fill) OpenCode json-merge coexistence (NFR18).** The OpenCode agent uses `injectionStrategy.position === 'json-merge'` (`lib/agents.js` lines ~244, `lib/installer.js` lines ~365–405) writing into `opencode.json::instructions[]` as a plain string. The json-merge path in `updateAgentInstructions` MUST also emit the universal block content (inline in the string, no file markers because the target is JSON). The ma-agents entry is identified by its existing `[ma-agents]` prefix marker; stale entries are replaced, user entries preserved (**NFR18 additive-only JSON merge**). No other keys in `opencode.json` are touched.
9. **(gap-fill) BMAD agent instruction files unchanged in scope.** The BMAD-category branch in `updateAgentInstructions` (`lib/installer.js` line ~445) that skips missing BMAD instruction files ("BMAD agent file not yet deployed") remains unchanged. When a BMAD agent file does exist and has markers, the universal block is re-rendered inside its markers on re-install. This story does not modify `applyCustomizations` or BMAD persona prompt composition (those belong to Stories 21.6/21.7).
10. **(gap-fill) Upgrade-safety: marker-block hand-edit detection.** Before overwriting content inside the markers, the installer compares existing in-marker content against the content `composeInstructionBlock` would produce for the project's current resolved profile. If they differ:
    - **Interactive mode:** the installer prints a diff of the in-marker changes and requires explicit confirmation before proceeding.
    - **`--yes` mode:** the prompt is skipped but the installer prints the warning line verbatim: `WARNING: ma-agents marker-block content modified since last install — overwriting. Previous content backed up to <path>.backup-<timestamp>`.
    - **Backup:** before overwriting, the installer writes a sibling backup file at `<target>.backup-<ISO-timestamp>` (UTC, `YYYY-MM-DDTHH-mm-ssZ`, colons replaced with hyphens for Windows compatibility). The backup contains only the original marker-block region (including the marker lines themselves). The rest of the target file is untouched by the installer and therefore needs no backup.

> **Open question:** The epic does not specify what to do when the existing in-marker content matches ma-agents output for the *previous* profile but not the *current* profile (e.g., user ran `reconfigure`). Story 21.10 (Profile Reconfigure) introduces its own backup flow. Proposed resolution: AC #10's drift detection compares against the current profile's expected output only — reconfigure-driven rewrites go through Story 21.10's path, not Story 21.2's. To be confirmed during Story 21.10 dev.

> **Open question:** Epic AC requires byte-identical marker-block content across runs (NFR46). The current `updateAgentInstructions` trims the wrapped instruction with `.replace(regex, wrappedInstruction.trim())` on replace but uses the non-trimmed form on first insert (line ~443). This is a pre-existing asymmetry that must be normalized so both paths produce identical trailing whitespace. Flagged for the implementing dev to resolve; not a new AC because the epic simply mandates byte-identity and leaves the mechanism to the implementation.

## Tasks / Subtasks

- [x] **Task 1: Create universal template** (AC #1, #2, #7)
  - [x] 1.1 Create `lib/templates/instruction-block-universal.template.md` (new) containing the MANIFEST loading section (with `{{MANIFEST_PATH}}` placeholder) followed by the five rule sections listed in AC #1.
  - [x] 1.2 Verify by inspection that no string in the template matches `/no_think`, `str_replace_editor`, or `~/.claude/` (AC #7).

- [x] **Task 2: Implement `composeInstructionBlock`** (AC #3)
  - [x] 2.1 Add `composeInstructionBlock({ profile, projectRoot })` to `lib/installer.js` (new function).
  - [x] 2.2 Load the universal template from disk (synchronous `fs.readFileSync` to keep parity with adjacent helpers; module-load-time caching optional). Templates contain NO `{{...}}` placeholders — do not perform substitution inside the composer.
  - [x] 2.3 If `profile === 'on-prem'`, read `lib/templates/instruction-block-onprem.template.md` and append its content separated by a single blank line. If that file is absent, throw `Error('on-prem profile selected but instruction-block-onprem.template.md is missing')`. NO silent fallback.
  - [x] 2.4 Export from `lib/installer.js`'s `module.exports` so tests and Stories 21.3–21.6 can consume it.

- [x] **Task 3: Wire composer into the marker-based merger** (AC #4, #5, #9)
  - [x] 3.1 In `updateAgentInstructions` (`lib/installer.js` line ~358), replace the hardcoded `planningInstruction` string (lines ~410–422) with a call to `composeInstructionBlock({ profile: getProfile(projectRoot) || 'standard', projectRoot })`, performing any `{{MANIFEST_PATH}}` substitution on the returned string AFTER composition (caller-owned).
  - [x] 3.2 Keep the marker-wrap (`markerStart`/`markerEnd`) and the first-insert / in-place-replace split unchanged.
  - [x] 3.3 Normalize trailing whitespace so the first-insert and in-place-replace paths produce byte-identical content inside the markers (resolves the Open question under AC).
  - [x] 3.4 Leave the BMAD-category "skip if file missing" branch (line ~445) untouched (AC #9).

- [x] **Task 4: Wire composer into the json-merge (OpenCode) merger** (AC #8)
  - [x] 4.1 In the `injectionStrategy.position === 'json-merge'` branch (`lib/installer.js` lines ~365–405), replace the hardcoded `instructionText` template literal (line ~370) with the composed content, prefixed by the existing `[${MA_AGENTS_SOURCE}]` tag used for ma-agents-entry identification.
  - [x] 4.2 Confirm the filter `isMaEntry` still correctly identifies the new entry (prefix unchanged → filter unchanged).
  - [x] 4.3 Verify no other keys in `opencode.json` are modified (NFR18).

- [x] **Task 5: Upgrade-safety — hand-edit detection, backup, warning** (AC #10)
  - [x] 5.1 Before overwriting the in-marker region, extract current in-marker content and compare against `composeInstructionBlock(...)` output for the resolved profile.
  - [x] 5.2 On drift in interactive mode: show unified diff (reuse existing prompts library); require confirmation.
  - [x] 5.3 On drift with `--yes`: emit the pinned WARNING line (verbatim format from AC #10).
  - [x] 5.4 Before overwrite, write `<target>.backup-<ISO-timestamp>` containing only the marker-block region including marker lines. Timestamp format: `YYYY-MM-DDTHH-mm-ssZ` (hyphens not colons — Windows filename safety).
  - [x] 5.5 No backup file created when existing in-marker content matches expected output.

- [x] **Task 6: Unit and integration tests** — see Testing section below.

- [ ] **Task 7: Documentation touch-up** (no new files)
  - [ ] 7.1 Add a single paragraph to `docs/` only if an existing doc already covers instruction injection; do not create a new doc file. (If no existing doc covers this, skip — Story 21.8 introduces documentation for the broader Epic 21 surface.)

## Dev Notes

### Canonical Composer Contract (decision A — verbatim)

> `composeInstructionBlock({ profile, projectRoot }) → string`
> - Reads `lib/templates/instruction-block-universal.template.md` (always).
> - If `profile === 'on-prem'`, reads `lib/templates/instruction-block-onprem.template.md` and appends it to the universal content separated by a single blank line.
> - If `profile === 'on-prem'` and the on-prem template file is missing, THROWS `Error('on-prem profile selected but instruction-block-onprem.template.md is missing')`. NO silent fallback.
> - Returns the composed string. Templates contain NO `{{...}}` placeholders; any substitution is the caller's responsibility, done AFTER composition.
> - Single owner: `lib/installer.js` calls `composeInstructionBlock` exactly once per stamped artifact. Mergers receive the already-composed string; mergers do not call `composeInstructionBlock` themselves.

### Canonical Backup Filename Format (decision C — verbatim)

> Backup filename format: `<target>.backup-<ISO-8601-timestamp>` e.g. `.roomodes.backup-2026-04-15T12-30-00Z`. Story 21.2 OWNS this format.

### Terminology (decision B)

- **composer** = `composeInstructionBlock` (owned by 21.2).
- **merger** = per-artifact splicer (marker-block merger for markdown files; json-merge merger for `opencode.json`).
- **stamper** = installer orchestration.
- "injection function" / "marker-injection" wording is retired.

### Architecture compliance

- **Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile)** — this story implements the "Universal layer" of the two-layer injection model. The on-prem layer ships in Story 21.6 via `lib/templates/instruction-block-onprem.template.md`. The composition function lives in this story; Story 21.6 only adds the on-prem template file and (if needed) one additional conditional branch.

- **NFR44 (byte-identity for standard profile)** — Standard-profile rendered output must not contain `/no_think`, `str_replace_editor`, or `~/.claude/`. AC #7 asserts absence; Test 5.5 in the Testing section enforces it with a direct grep assertion. Story 21.9 will add a standard-profile-vs-pre-Epic-21-baseline byte-comparison integration test; this story stays focused on the composition unit.

- **NFR46 (idempotency)** — Two consecutive installs with identical inputs must produce byte-identical marker-block content. AC #6 is the contract; Task 3.3 resolves the pre-existing insert/replace asymmetry that otherwise would violate this.

- **NFR47 (Roo Code fileRegex enforcement)** — Not directly implemented here. Story 21.3 ships `.roomodes` with `fileRegex` restrictions per BMAD mode; NFR47 is verified by Story 21.9. Story 21.2 must only ensure that Roo Code's instruction file (`.roo/rules/00-ma-agents.md` — registered in `lib/agents.js` line 161) receives the universal block unchanged in shape, so Story 21.3 can cleanly add `.roomodes` alongside without conflicting with this story's markdown merger.

- **NFR18 (additive JSON-merge for OpenCode)** — The existing `injectionStrategy.position === 'json-merge'` path already implements additive merge for `opencode.json::instructions[]` (ma-agents entry identified by `[ma-agents]` prefix, stale entries replaced, user entries preserved). Task 4 reuses that machinery unchanged; only the instruction-text content source switches from the hardcoded literal to `composeInstructionBlock`.

### Verified source-tree surface

| File | Exists? | Role in this story |
|------|---------|--------------------|
| `lib/profile.js` | verified (Story 21.1, lines 1–107) | Consumed via `getProfile(projectRoot)` in `updateAgentInstructions` |
| `lib/installer.js` | verified | Add `composeInstructionBlock`; modify `updateAgentInstructions` markdown branch (line ~358) and json-merge branch (line ~365) |
| `lib/agents.js` | verified | Read-only — enumerates the agents whose `instructionFiles[]` receive the universal block (Claude Code, Cline, Roo Code, Cursor, Kilocode, Copilot, Gemini, OpenCode) |
| `lib/templates/instruction-block-universal.template.md` | **new** | Template source (AC #1, #2) |
| `lib/templates/instruction-block-onprem.template.md` | **new (Story 21.6)** | Consumed conditionally by `composeInstructionBlock`; graceful absence handling required now |
| `lib/templates/project-context.template.md` | verified | Reference pattern for template stamping syntax (placeholder conventions) |
| `test/instruction-block.test.js` | **new** | Unit + snapshot tests (see Testing section) |
| `test/profile.test.js` | verified (Story 21.1) | Reference for test framework, temp-dir isolation pattern |

### Composition pattern (template foundation for Stories 21.3–21.6)

```
composeInstructionBlock({ profile, projectRoot })
  ├── universal template (this story — always applied)
  └── on-prem template (Story 21.6 — applied when profile === 'on-prem'; THROWS if missing)
```

Stories 21.3 (`.roomodes`), 21.4 (`AGENTS.md`), and 21.5 (`.clinerules`) consume this function where their templates reference the universal text-vs-file and phase-discipline rules — they do not duplicate the rule text. Story 21.6 adds the on-prem template file and, if its rules need structural interleaving with universal rules (rather than straight append), one additional branch in `composeInstructionBlock`. Story 21.7 (BMAD persona phase prefix) is a separate composition site (BMAD customize-loader) and does not call `composeInstructionBlock`.

### Merger-site map (for reviewers)

- **Markdown marker merger** (`lib/installer.js` `updateAgentInstructions` lines ~407–459): Claude Code, Cline (both files), Roo Code rules, Cursor, Kilocode, Copilot, Gemini.
- **JSON merge merger** (`lib/installer.js` `updateAgentInstructions` lines ~365–405): OpenCode (`opencode.json::instructions[]`).
- **BMAD agent files** (`lib/installer.js` lines ~445–451): Skipped when file absent; receive markers via `applyCustomizations` (outside this story's scope).
- **Anti-gravity** (`lib/agents.js` line 221): Uses `.antigravity/antigravity.md` — treated as markdown marker merger, same path as Claude Code et al.

### Library and pattern references

- **Prompts library** (`prompts` npm) for the drift-confirmation prompt in Task 5.2 — reuse the existing `prompts({ type: 'confirm' })` style used elsewhere in `bin/cli.js`.
- **Backup filename format** — see the "Canonical Backup Filename Format" block above. Story 21.2 OWNS this format; Stories 21.10 (reconfigure) and 21.11 (uninstall) consume it so uninstall's backup-cleanup logic works uniformly.
- **Manifest-path computation** reuse `path.relative(projectRoot, path.join(agent.getProjectPath(), 'MANIFEST.yaml')).replace(/\\/g, '/')` (already present in both branches of `updateAgentInstructions`). Do not duplicate — pass it into `composeInstructionBlock` from the call site.

### Out of scope

- On-prem template content and the conditional append wiring details beyond the graceful-fallback stub (Story 21.6).
- `.roomodes` template and Roo Code `fileRegex` mode restrictions (Story 21.3).
- `AGENTS.md` template for OpenCode (Story 21.4) — noting that Story 21.4 *reuses* `composeInstructionBlock` for the text-vs-file section; the `AGENTS.md` filename and layout are Story 21.4's concern.
- `.clinerules` template for Cline (Story 21.5) — Cline's existing `.clinerules` injection already passes through `updateAgentInstructions`; Story 21.5 ships a richer dedicated template and is out of scope here.
- BMAD persona phase prefix and customize-loader changes (Story 21.7).
- vLLM deployment documentation (Story 21.8).
- Integration test covering NFR44 byte-comparison against pre-Epic-21 baseline (Story 21.9).
- Profile-reconfigure and profile-uninstall flows (Stories 21.10, 21.11).
- Bumping `manifestVersion` — already bumped to `1.2.0` in Story 21.1 and not touched here.

## Dependencies

### Upstream (blocking)

- **Story 21.1 (done)** — `lib/profile.js` exports `getProfile(projectRoot)` which `updateAgentInstructions` calls to pick the profile. Verified at `lib/profile.js` lines 29–43.
- **Epic 9 (done)** — `opencode.json` additive JSON-merge pattern in `updateAgentInstructions` (lines ~365–405) is reused unchanged. NFR18 already satisfied by that code; this story must not regress it.

### Downstream (consumers of this story's surface)

- **Story 21.3** — `.roomodes` mode `customInstructions` text references the rules defined in the universal template. Adds `extraInstructionTemplates` field to `lib/agents.js` Roo Code entry.
- **Story 21.4** — `AGENTS.md` template for OpenCode reuses the universal text-vs-file section; also appends `AGENTS.md` to `opencode.json::instructions[]` via the same NFR18-compliant JSON-merge.
- **Story 21.5** — `.clinerules` template reuses the universal rules, formatted per Cline's convention. Cline's two instruction files (`.cline/clinerules.md`, `.clinerules`) both receive the universal block via this story; Story 21.5 extends with Cline-specific content.
- **Story 21.6** — Adds `lib/templates/instruction-block-onprem.template.md` and toggles on-prem content via the same `composeInstructionBlock` call signature from this story. Must not require a signature change.
- **Story 21.9** — Tests verifying NFR44 (standard-profile absence of on-prem strings), NFR46 (idempotency across profiles), and roomodes-level NFR47.
- **Story 21.10 (Profile Reconfigure)** — Consumes the canonical backup-filename format (`<target>.backup-<ISO-8601-timestamp>`) owned by this story, plus the drift-detection pattern introduced here.
- **Story 21.11 (Profile Uninstall)** — Consumes the canonical backup-filename format owned by this story so uninstall's backup-cleanup logic matches install-time backups uniformly.

## Testing

**Framework and isolation:** Match the pattern in `test/profile.test.js` (Story 21.1) — node's built-in test runner, `os.tmpdir()` + `fs.mkdtempSync` per-test temporary project roots, never mutate the repo's own `.ma-agents.json` or `lib/templates/`.

New test file: `test/instruction-block.test.js` (new).

**Unit tests:**

- 5.1 Universal template reads from disk and substitutes `{{MANIFEST_PATH}}` exactly once with the supplied value.
- 5.2 `composeInstructionBlock({ profile: 'standard', projectRoot })` returns universal content only, even when the on-prem template file exists (test creates it in the tmp-copy of `lib/templates/` or uses a fs spy).
- 5.3 `composeInstructionBlock({ profile: 'on-prem', projectRoot })` appends on-prem content when the on-prem template file is present; **throws** `Error('on-prem profile selected but instruction-block-onprem.template.md is missing')` when the on-prem template file is absent (no silent fallback — decision A).
- 5.4 Idempotency: calling the composer twice with identical inputs returns byte-identical strings (trim/whitespace parity).
- 5.5 NFR44 assertion: standard-profile output does not contain the literals `/no_think`, `str_replace_editor`, or `~/.claude/`.
- 5.6 `composeInstructionBlock` throws a descriptive Error when the universal template is missing or has no `{{MANIFEST_PATH}}` placeholder (defensive).

**Integration tests (within this story — full end-to-end lives in Story 21.9):**

- 5.7 Marker-block replacement preserves content outside markers byte-for-byte across two installs (targets `.claude/CLAUDE.md` in a tmp project with pre-existing user content above and below the markers).
- 5.8 Fresh install writes the universal block to each markdown-injection agent's instruction file when the agent is selected.
- 5.9 OpenCode `opencode.json::instructions[]` receives the composed string with `[ma-agents]` prefix; other keys untouched; second install replaces the ma-agents entry (not duplicates it) and preserves user entries (NFR18).
- 5.10 Upgrade-safety (AC #10):
  - Clean marker block (no hand-edit) → no warning, no backup file, overwrite is silent.
  - Hand-edited marker block + `--yes` → WARNING line emitted verbatim, backup file exists at `<target>.backup-<timestamp>`, backup contains only the marker-block region including marker lines.
  - Hand-edited marker block + interactive (no `--yes`) → prompt appears; simulated decline leaves file unchanged; simulated confirm proceeds with backup.

**Test data isolation:** All tests create a tmp project with a stub `.ma-agents.json` written via `setProfile(tmpRoot, 'standard' | 'on-prem')` (Story 21.1 API). Do not stub `lib/profile.js` — use the real module against the tmp project root to catch integration bugs.

**Coverage note:** Story 21.9 adds (a) a standard-profile vs. pre-Epic-21 baseline byte-comparison test, (b) the on-prem profile must-have-both-layers test, (c) roomodes slug-collision test, and (d) NFR47 fileRegex contract test. Do not duplicate those here.

## Change Log

- 2026-04-14: Story created (Epic 21, Story 21.2).
- 2026-04-14: Added AC #8 for upgrade-safety — installer detects hand-edited marker content, backs it up, warns on --yes override (Finding #15, corrective plan step 3).
- 2026-04-15: Story rewritten as template foundation for Stories 21.3–21.6 — ACs reorganized and gap-fills flagged explicitly (AC #2, #3, #8, #9, #10); NFR44/NFR46/NFR47/NFR18 citations made explicit in Dev Notes; Dependencies section split into upstream/downstream; Testing section expanded; verified source-tree surface table added distinguishing existing vs. new paths; injection-site map added. Two open questions raised inline rather than invented as ACs. Status set to Ready.
- 2026-04-15: Adversarial-review findings resolved. AC #3 rewritten to canonical composer contract — signature is `composeInstructionBlock({ profile, projectRoot })`; on-prem template absence THROWS (no silent fallback); templates contain no placeholders (caller-owned substitution); single-owner contract (installer calls composer once; mergers consume string). Added Canonical Composer Contract and Canonical Backup Filename Format blocks to Dev Notes. Terminology normalized to composer/merger/stamper — "injection function" / "marker-injection" wording retired. Downstream deps explicitly list 21.10 and 21.11 as backup-filename-format consumers. Tasks 2–4 and tests 5.2–5.3 updated to match. Status remains Ready.
- 2026-04-15: Story 21.2 implemented — universal template, `composeInstructionBlock`, both mergers wired, drift detection + canonical backup format. Status Ready → Review.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context) — bmad-dev-story + bmad-review-adversarial-general + bmad-review-edge-case-hunter flow.

### Debug Log References
- Initial implementation had `agent._yesMode` reading — a field never populated anywhere. Adversarial review (Finding #6) surfaced this: CLI `--yes` callers would still hit the interactive drift prompt. Resolved by extending `updateAgentInstructions` with an `opts = {}` argument carrying `yesMode` and wiring both install-path call sites (`action === 'remove'` and the main install branch) to pass `{ yesMode: yes }` from `installSkill`. Uninstall (`uninstallSkill`) left unchanged since it has no `yes` flag surface today; drift during uninstall is rare and the env-var fallback (`MA_AGENTS_YES=1`) still works for CI.
- Added test 5.10c to guard against regression of the opts-based yesMode path.

### Completion Notes List
- `lib/templates/instruction-block-universal.template.md` ships with `{{MANIFEST_PATH}}` as the ONLY placeholder (AC #1, #2). Contains the five rule sections from AC #1 verbatim and does NOT mention `/no_think`, `str_replace_editor`, or `~/.claude/` (AC #7, asserted by test 5.5).
- `composeInstructionBlock({ profile, projectRoot })` is exported from `lib/installer.js` (AC #3). On-prem template absence THROWS with the pinned error message — no silent fallback. Templates carry no placeholders substituted inside the composer; mergers substitute `{{MANIFEST_PATH}}` AFTER composition.
- Marker-based merger (`updateAgentInstructions` markdown path) calls `composeInstructionBlock` exactly once per agent + substitutes per-agent MANIFEST path after composition (AC #4). JSON-merge merger (OpenCode) prefixes the composed string with `[ma-agents]` tag — filter unchanged, NFR18 additive merge preserved (AC #8).
- First-insert vs in-place-replace normalized: both paths emit `<MARKER>\n<content>\n<MARKER>` identically (AC #6 / NFR46 — resolved the Open question under AC).
- BMAD agents branch untouched — still skips missing files via the "BMAD agent file not yet deployed" message (AC #9).
- AC #10 upgrade-safety: drift detection compares existing in-marker content against composer output. `--yes` path emits the pinned WARNING line verbatim and writes a sibling backup file. Interactive path shows the old/new block inline and requires confirmation. Backup filename is `<target>.backup-<ISO-timestamp>` with hyphens for Windows compatibility (`buildBackupFilename` / `formatBackupTimestamp` exported; Story 21.2 OWNS this format per Dev Notes decision C).
- Open question under AC (profile-reconfigure) deferred to Story 21.10 per spec.

### Adversarial Review Findings

| # | Layer | Severity | Finding | Disposition |
|---|-------|----------|---------|-------------|
| 1 | Cynical | P0 | `agent._yesMode` read but never set anywhere — CLI `--yes` path would hit interactive prompt on drift, contradicting AC #10 | **Fixed** — extended `updateAgentInstructions(agent, projectRoot, opts)` with `opts.yesMode`; wired through `installSkill` → two call sites |
| 2 | Cynical | P1 | OpenCode instructionText trailing-whitespace strip could elide final content when body ends with blank line | **Fixed by design** — `composeInstructionBlock` already trims trailing whitespace and appends exactly one `\n`; strip is idempotent |
| 3 | Cynical | P1 | Insert path wrote `wrappedInstructionWithTrailingNewline + '\n'` (two newlines) while replace path wrote just the marker block — potential NFR46 violation | **Fixed by design** — NFR46 applies to content INSIDE markers; outside-markers formatting is preserved byte-for-byte by regex replace. Both paths produce byte-identical in-marker content |
| 4 | Cynical | P2 | `buildBackupFilename` has TOCTOU race between `existsSync` and `outputFile` | **Out of scope** — sub-second repeat runs would need multiple installs within the same second; filename has numeric tiebreaker; would need fs lock to fully fix |
| 5 | Edge-case | P1 | Missing test for `opts.yesMode` path (env-var path tested but opts path untested) | **Fixed** — added test 5.10c |
| 6 | Edge-case | P2 | `uninstallSkill` call-site to `updateAgentInstructions` doesn't pass yesMode | **Out of scope** — `uninstallSkill` signature doesn't carry `yes` today; env-var fallback covers CI; tracked implicitly for 21.11 |
| 7 | Edge-case | P2 | Interactive drift prompt could trigger on `reconfigure` flow (profile change) | **Out of scope per spec** — story's Open question under AC explicitly defers profile-reconfigure to Story 21.10 |

All P0/P1 findings resolved or accepted with documented rationale.

### File List
- CREATED: `lib/templates/instruction-block-universal.template.md`
- CREATED: `test/instruction-block.test.js` (14 tests, all passing)
- MODIFIED: `lib/installer.js` (composer, drift handler, canonical backup format, merger wiring, yesMode opts plumbing)
- MODIFIED: `package.json` (added `test/instruction-block.test.js` to npm test script)
- MODIFIED: `_bmad-output/implementation-artifacts/21-2-universal-instruction-block-expansion.md` (Status → Review; Dev Agent Record / File List / Change Log updated)
