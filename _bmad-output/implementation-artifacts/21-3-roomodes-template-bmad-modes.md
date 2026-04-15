# Story 21.3: `.roomodes` Template with BMAD Mode File-Regex Restrictions

Status: Ready

## Story

As a **chief architect**,
I want a `.roomodes` file generated for Roo Code installs defining 4 BMAD modes with `fileRegex` restrictions per phase,
So that Roo Code's application-layer enforcement (`FileRestrictionError`) prevents agents from editing code files during planning phases — independent of whether the LLM follows the prompt.

## Acceptance Criteria

> Acceptance criteria marked **(gap-fill)** are additions made by the story author to make the epic's AC operational and testable. They do not contradict the epic; they refine the "how" where the epic only stated the "what". Open questions are flagged inline rather than resolved by author guesswork.

1. **Template file exists.** A new file at the pinned path `lib/templates/roomodes.template.yaml` (new; path pinned per `_bmad-output/planning-artifacts/epics.md:3994`) is present and defines exactly four `customModes` entries:
   - `bmad-pm` — read + edit restricted to `\.md$`
   - `bmad-architect` — read + edit restricted to `\.(md|xml|drawio)$`
   - `bmad-techlead` — read + edit restricted to `\.(md|json|yaml|yml)$`
   - `bmad-dev` — read + edit + command (full access; no `fileRegex` group restriction on edit)
   Each mode includes a `roleDefinition`, `whenToUse`, and `customInstructions` block whose text aligns with the BMAD phase descriptions in the source playbook (`optimizing-local-llm-coding-agents-bmad.md`, referenced by the epic intro at `_bmad-output/planning-artifacts/epics.md` lines 3886–3895).
2. **(gap-fill) `customInstructions` reuses universal composer output.** The `customInstructions` content for each of the four modes incorporates the universal text-vs-file and BMAD phase-discipline rules. Per canonical decision A, the template itself contains NO placeholders and the merger (`mergeRoomodes`) does NOT call `composeInstructionBlock`. Instead, `lib/installer.js` (the stamper) is the sole owner of invoking `composeInstructionBlock({ profile, projectRoot })` (21.2-owned) exactly once per artifact; the installer performs `{{UNIVERSAL_BLOCK}}` substitution on the loaded template text AFTER composition and passes the already-composed template string into `mergeRoomodes` as input. Modes do NOT duplicate rule text. The Roo Code `MANIFEST.yaml` path used by `composeInstructionBlock` is the same `path.relative(projectRoot, path.join(agent.getProjectPath(), 'MANIFEST.yaml')).replace(/\\/g, '/')` already computed in `updateAgentInstructions` (`lib/installer.js` line ~408) for the `roo-code` agent entry (`lib/agents.js` lines 140–163; `getProjectPath()` returns `<projectRoot>/.roo/skills`).
3. **Roo Code agent gains `extraInstructionTemplates`.** The `roo-code` entry in `lib/agents.js` (lines 140–163) gains a new optional field:
   ```js
   extraInstructionTemplates: [
     { template: 'roomodes.template.yaml', target: '.roomodes', merger: 'yaml-customModes' }
   ]
   ```
   No other agent entry is modified. The field is read only by the new `extraInstructionTemplates` processing path described in AC #4; absence on other agents is a no-op.
4. **(gap-fill) Installer (stamper) wires the extra template.** A new processing pass in `lib/installer.js` (sibling to `updateAgentInstructions`, named `applyExtraInstructionTemplates(agent, projectRoot)` — new; the stamper per decision B) iterates `agent.extraInstructionTemplates` and, for each entry: (a) loads the raw template from `lib/templates/<template>`; (b) calls the composer `composeInstructionBlock({ profile: getProfile(projectRoot) || 'standard', projectRoot })` ONCE and substitutes `{{UNIVERSAL_BLOCK}}` in the template string (caller-side substitution per decision A); (c) dispatches on `merger`. For `'yaml-customModes'`, the stamper invokes the merger `mergeRoomodes(existingYaml, composedTemplateYaml)` (new) — passing the already-composed string as input — and writes the result to `<projectRoot>/<target>` atomically (temp-file + rename, mirroring the json-merge pattern at `lib/installer.js` lines ~395–398). If an existing target file is overwritten, the stamper creates a backup named `<target>.backup-<ISO-8601-timestamp>` (21.2-owned format; see Dependencies → Upstream).
5. **YAML merger contract — `mergeRoomodes(existingYaml, templateYaml)`** (new — located in `lib/merge/roomodes.js` (new file). The epic technical note allows `lib/installer.js` placement "or a new `lib/merge/roomodes.js` if size warrants"; author resolution: separate file, because it owns YAML parse/serialize plus slug-collision logic and is large enough to warrant isolation). Per decision A, the merger is a pure splicer: it receives the already-composed template string as `templateYaml` and MUST NOT call `composeInstructionBlock`. Contract:
   - Input: two strings (existing file content, already-composed template content). `existingYaml` may be empty/undefined when the file does not exist. `templateYaml` is the composer output from the stamper — no further substitution is performed here.
   - Parse both as YAML using `js-yaml` (design decision; see Dev Notes → Library and pattern references).
   - Output: a serialized YAML string whose `customModes` array contains every entry from `existingYaml.customModes` whose `slug` is NOT in the ma-agents-owned set (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`), followed by all four entries from `templateYaml.customModes`.
   - All other top-level YAML keys from `existingYaml` are preserved unchanged (FR176 — "preserves user content outside ma-agents-owned slugs").
   - Pure function — no I/O.
6. **Slug-collision warning.** When `mergeRoomodes` discovers an existing entry whose slug matches one of the four ma-agents-owned slugs, it emits a single console warning per colliding slug naming the slug verbatim (e.g., `WARNING: .roomodes slug "bmad-architect" overwritten by ma-agents template`). The user entry is replaced; the ma-agents version wins (per epic AC — "colliding slugs are overwritten with the ma-agents version (with a console warning naming the slug)" at `epics.md` line 3987).
7. **Fresh install creates `.roomodes`.** Given the Roo Code agent is selected in `npx ma-agents install`, when the installer runs and `<projectRoot>/.roomodes` does not exist, the file is written at the project root containing exactly the four ma-agents BMAD `customModes` entries (no user entries to preserve).
8. **Re-install preserves user `customModes`.** Given `<projectRoot>/.roomodes` already exists with user-defined `customModes` whose slugs do NOT collide with the four ma-agents slugs, when the installer runs, those entries are preserved in their original order and the four ma-agents entries are present (FR176). YAML key ordering for preserved user entries is best-effort — comment preservation is NOT required (see Open question on `js-yaml` round-trip behavior).
9. **NFR47 application-layer enforcement contract.** Given a user is in `bmad-architect` mode in Roo Code after install, when the agent attempts to edit a `.ts` or `.py` file, Roo Code rejects the edit with `FileRestrictionError`. **Verification scope for this story:** unit/integration tests assert that the generated `.roomodes` `fileRegex` patterns for `bmad-architect` (and the other three modes) reject `.ts`/`.py` paths via direct regex match — the actual `FileRestrictionError` is raised by Roo Code at runtime. The end-to-end Roo Code launch is out of scope (epic technical note at `epics.md` line 4152 explicitly limits NFR47 to the regex-contract level).
10. **(gap-fill) NFR46 idempotency.** Two consecutive installs in the same project state produce byte-identical `.roomodes` content, including stable ordering of `customModes` entries (preserved-user entries first in their original order, then the four ma-agents entries in the canonical order `bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`). YAML serialization options (indent width, quote style, line width) are pinned in the merger so re-runs do not produce whitespace drift.
11. **(gap-fill) NFR44 profile isolation — standard profile.** When `getProfile(projectRoot) === 'standard'` (or undefined), the rendered `.roomodes` `customInstructions` strings MUST NOT contain the literals `/no_think`, `str_replace_editor`, or `~/.claude/`. Verified by direct grep assertion in tests. On-prem-specific augmentation of `customInstructions` is deferred to Story 21.6 (epic technical note at line 4074 — "the `customInstructions` block per Roo Code mode … gets the on-prem rules appended when profile=on-prem").
12. **(gap-fill) NFR18 additive JSON-merge — not regressed.** This story does NOT touch the OpenCode `opencode.json::instructions[]` json-merge path in `updateAgentInstructions` (`lib/installer.js` lines ~365–405). The `extraInstructionTemplates` pipeline is sibling and orthogonal. Existing OpenCode tests must continue to pass.
13. **(gap-fill) Roo Code is not installed → no `.roomodes` write.** When the Roo Code agent is not selected in the wizard / direct-install, `applyExtraInstructionTemplates` is not invoked for it and `<projectRoot>/.roomodes` is not created or modified by ma-agents.
14. **(gap-fill) Markdown rules instruction file unchanged in shape.** Roo Code's existing markdown injection target `.roo/rules/00-ma-agents.md` (registered at `lib/agents.js` line 161) continues to receive the universal block via Story 21.2's `updateAgentInstructions` path. This story adds `.roomodes` alongside; it does not relocate or remove the markdown rules file.

> **Design decision (was Open question):** YAML library is **`js-yaml`**. Verified via `npm ls js-yaml` in `D:\Code\agents` on 2026-04-15: `js-yaml@4.1.1` is present transitively via `bmad-method@6.2.2`. Because transitive availability is not a stable contract, 21.3 adds `js-yaml` as a **direct installer dependency** (promote to `dependencies` in `package.json`, pinning `^4.1.1` to match the transitive version already in the tree). Comment-preserving libraries (`yaml` from eemeli) are heavier and unnecessary — comments inside ma-agents-owned slugs are overwritten by definition; comments on user entries are best-effort lost on rewrite (called out in AC #8).

> **Design decision (was Open question):** Installer call site is **`lib/installer.js`** — the single stamper owner per canonical decision A. The install loop invokes `applyExtraInstructionTemplates(agent, projectRoot)` immediately after `updateAgentInstructions(agent, projectRoot)` for each selected agent. Both wizard and direct-install paths flow through this single loop (no separate branch in `bin/cli.js` invokes the extra-templates pipeline independently).

> **Design decision (was Open question):** Roo Code `.roomodes` schema shape is the **authoritative shape cited in the `roo-code` entry in `lib/agents.js` (lines 140–163)** — that entry (registered by Story 18.1) is the source of truth for ma-agents' Roo Code integration. The template comment header links back to `lib/agents.js` rather than to a moving upstream URL. Schema fields used: `slug`, `name`, `roleDefinition`, `whenToUse`, `customInstructions`, `groups` (with `["edit", { fileRegex, description }]` tuple form).

## Tasks / Subtasks

- [ ] **Task 1: Create the YAML template** (AC #1, #11)
  - [ ] 1.1 Create `lib/templates/roomodes.template.yaml` (new; pinned path per `epics.md:3994`) with four `customModes` entries: `bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`. Each mode's `groups` array MUST encode the `fileRegex` per AC #1 (`bmad-pm`: `\.md$`; `bmad-architect`: `\.(md|xml|drawio)$`; `bmad-techlead`: `\.(md|json|yaml|yml)$`; `bmad-dev`: full access).
  - [ ] 1.2 Each mode's `customInstructions` field contains a `{{UNIVERSAL_BLOCK}}` sentinel and inline phase-specific text (e.g., "PM mode — discovery and PRD only") wrapping the sentinel. The template contains NO other placeholders. Per decision A, substitution happens in the stamper (`lib/installer.js`) AFTER `composeInstructionBlock` runs; the merger never touches the sentinel and never calls the composer.
  - [ ] 1.3 Verify by inspection (and by the Task 5 NFR44 test) that the static template text contains none of `/no_think`, `str_replace_editor`, or `~/.claude/`. Those strings are only legal in the on-prem layer (Story 21.6).

- [ ] **Task 2: Implement `mergeRoomodes` (merger) and wire it into the stamper** (AC #4, #5, #6, #10)
  - [ ] 2.1 Create `lib/merge/roomodes.js` (new) exporting `mergeRoomodes(existingYaml, templateYaml, options)` — a pure splicer. Use `js-yaml`. Pin `js-yaml`'s `dump` options (`indent: 2`, `lineWidth: -1`, `noRefs: true`, `quotingType: '"'`) so output is deterministic across runs (NFR46). The merger MUST NOT import or call `composeInstructionBlock`; it treats `templateYaml` as opaque pre-composed input (decision A).
  - [ ] 2.2 Slug-collision logic: build the ma-agents-owned set `['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']`; filter user entries by `slug not in set`; for each filtered-out user entry, emit one warning line via `console.warn` naming the slug.
  - [ ] 2.3 Add `applyExtraInstructionTemplates(agent, projectRoot)` to `lib/installer.js` (new stamper function). Iterate `agent.extraInstructionTemplates || []`. For each entry: (i) load raw template from `lib/templates/<template>`; (ii) call composer ONCE: `composed = rawTemplate.replace('{{UNIVERSAL_BLOCK}}', composeInstructionBlock({ profile: getProfile(projectRoot) || 'standard', projectRoot }))`; (iii) dispatch on `merger`. For `'yaml-customModes'`: read `<projectRoot>/<target>` if present, call `mergeRoomodes(existingYaml, composed)`, write atomically (temp + rename — pattern at `lib/installer.js` lines ~395–398). When overwriting an existing target, write a backup to `<target>.backup-<ISO-8601-timestamp>` (format owned by 21.2).
  - [ ] 2.4 Export `mergeRoomodes` from `lib/merge/roomodes.js` and `applyExtraInstructionTemplates` from `lib/installer.js` so Story 21.9 tests can consume them directly.
  - [ ] 2.5 Promote `js-yaml` to a direct `dependencies` entry in `package.json` pinned to `^4.1.1` (matches version already present transitively via `bmad-method@6.2.2`).

- [ ] **Task 3: Wire into the install loop** (AC #4, #7, #13)
  - [ ] 3.1 In the install loop in `lib/installer.js` where each selected agent has `updateAgentInstructions(agent, projectRoot)` invoked, add a follow-on `await applyExtraInstructionTemplates(agent, projectRoot)` call. Both wizard and direct-install paths flow through this single loop (per decision A; no separate branch in `bin/cli.js`).
  - [ ] 3.2 Confirm that absence of `extraInstructionTemplates` on every other agent is a no-op (loop early-exits when the array is empty/undefined).

- [ ] **Task 4: Register `extraInstructionTemplates` on Roo Code** (AC #3)
  - [ ] 4.1 In `lib/agents.js` lines 140–163, add the `extraInstructionTemplates` array per AC #3 to the `roo-code` entry only.
  - [ ] 4.2 Do not modify any other agent entry.

- [ ] **Task 5: Unit and integration tests** — see Testing section below.

- [ ] **Task 6: Documentation touch-up** (no new files)
  - [ ] 6.1 If an existing doc covers per-tool injection, append a one-paragraph note pointing to `.roomodes`. If no existing doc covers this surface, skip — Story 21.8 introduces broader Epic 21 documentation.

## Dev Notes

### Architecture compliance

- **Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile)** — `_bmad-output/planning-artifacts/architecture.md` lines 1888–1919. The "rejected" alternative explicitly cited at line 1919 — "Generate per-tool config purely via prompt instruction (no `.roomodes`)" — was rejected precisely because Roo Code's `fileRegex` is application-layer enforcement that the prompt cannot replicate. This story is the implementation of the accepted alternative.

- **NFR44 (byte-identity for standard profile)** — `_bmad-output/planning-artifacts/epics.md` lines 264, 471. Standard-profile rendered `.roomodes` `customInstructions` MUST NOT contain `/no_think`, `str_replace_editor`, or `~/.claude/`. AC #11 is the contract; Test 5.5 enforces it. On-prem `customInstructions` augmentation is Story 21.6's surface.

- **NFR46 (idempotency)** — `epics.md` lines 471, 4144 (item c). Two consecutive installs produce byte-identical `.roomodes`. AC #10 is the contract; Test 5.6 enforces it. The merger pins YAML `dump` options to eliminate whitespace drift.

- **NFR47 (Roo Code application-layer fileRegex enforcement)** — `_bmad-output/planning-artifacts/prd.md` line 809; `epics.md` lines 264, 4144 (item e), 4152. Verified at the regex-contract level only; full Roo Code launch is out of scope (epic explicit). Test 5.7 asserts each mode's `fileRegex` against representative file paths.

- **NFR18 (additive JSON-merge for OpenCode)** — Not in scope here. AC #12 is a non-regression contract; this story's pipeline is sibling to the json-merge path and does not touch it.

- **FR176 (additive `.roomodes` slug isolation)** — `epics.md` line 254; `prd.md` line 706. AC #5, #8 implement; Test 5.8 verifies.

### Verified source-tree surface

| File | Exists? | Role in this story |
|------|---------|--------------------|
| `lib/profile.js` | verified (Story 21.1, lines 29–43) | Consumed via `getProfile(projectRoot)` inside `applyExtraInstructionTemplates` |
| `lib/installer.js` | verified | Add `applyExtraInstructionTemplates`; consume `composeInstructionBlock` (Story 21.2, AC #3); reuse atomic-write pattern from lines ~395–398 |
| `lib/agents.js` | verified | Add `extraInstructionTemplates` field to the `roo-code` entry only (lines 140–163). The Roo Code entry's `instructionFiles` (`['.roo/rules/00-ma-agents.md']`) is unchanged (AC #14) |
| `lib/templates/roomodes.template.yaml` | **new** | Template source (AC #1) |
| `lib/merge/roomodes.js` | **new** | YAML merger (AC #5) |
| `lib/templates/instruction-block-universal.template.md` | **new (Story 21.2)** | Source for `{{UNIVERSAL_BLOCK}}` expansion via `composeInstructionBlock` |
| `lib/templates/instruction-block-onprem.template.md` | **new (Story 21.6)** | Append-only on-prem layer; consumed transitively when profile=on-prem; this story must not break when missing |
| `test/roomodes.test.js` | **new** | Unit + integration tests (see Testing section) |
| `test/profile.test.js` | verified (Story 21.1) | Reference for test framework, temp-dir isolation pattern |
| `_bmad-output/implementation-artifacts/21-2-universal-instruction-block-expansion.md` | verified | Upstream story — `composeInstructionBlock` signature pinned there |

### Composition pattern reuse (composer / merger / stamper roles — decision B)

- **Composer** = `composeInstructionBlock({ profile, projectRoot })` — 21.2-owned, the single source of truth for text-vs-file and BMAD phase-discipline content. Called exactly once per artifact by the stamper.
- **Merger** = `mergeRoomodes(existingYaml, templateYaml)` — 21.3-owned. Pure splicer: YAML parse, slug filter, splice, serialize. Receives the already-composed template string as input. MUST NOT call the composer.
- **Stamper** = `lib/installer.js` (`applyExtraInstructionTemplates` for this story; `updateAgentInstructions` for the markdown/JSON paths) — the single orchestrator that loads templates, calls the composer, performs `{{UNIVERSAL_BLOCK}}` substitution, and invokes per-artifact mergers.

Story 21.6 will extend the composer's on-prem layer transparently — this story's code path requires no signature change when 21.6 lands.

### Library and pattern references

- **YAML library** — `js-yaml` (verified present at `4.1.1` transitively via `bmad-method@6.2.2`; promoted to direct dependency by this story — Task 2.5).
- **Atomic write pattern** — `lib/installer.js` lines ~395–398 (`fs.outputFile(tmpPath, ...)` then `fs.rename(tmpPath, filePath)`).
- **Roo Code agent entry** — `lib/agents.js` lines 140–163 (the only entry receiving `extraInstructionTemplates`).
- **Roo Code instruction file (markdown rules)** — `.roo/rules/00-ma-agents.md`, `lib/agents.js` line 161; left untouched by this story (AC #14).
- **Manifest-path computation** — reuse the `path.relative(projectRoot, path.join(agentProjectPath, 'MANIFEST.yaml')).replace(/\\/g, '/')` formula (`lib/installer.js` line 408) for cross-platform path consistency.

## Dependencies

### Upstream (blocking)

- **Story 21.1 (done)** — `lib/profile.js::getProfile(projectRoot)` is consumed by `applyExtraInstructionTemplates` to pick the profile passed into `composeInstructionBlock`. Verified at `lib/profile.js` lines 29–43.
- **Story 21.2 (Ready)** — owns **(a)** `composeInstructionBlock({ profile, projectRoot })` exported from `lib/installer.js` (the composer; single source of truth for universal text-vs-file / BMAD phase-discipline content embedded in each mode's `customInstructions`), and **(b)** the **backup filename format** `<target>.backup-<ISO-8601-timestamp>` used by the stamper whenever an existing artifact is overwritten. This story MUST land after 21.2 to avoid duplicating rule text and to reuse the backup-filename contract.
- **Epic 18 Story 18.1 (done at code level)** — `roo-code` agent entry in `lib/agents.js` (lines 140–163). Verified present per epic cross-cutting note at `epics.md` line 4230.

### Downstream (consumers of this story's surface)

- **Story 21.4 (`AGENTS.md` for OpenCode)** — consumes the `extraInstructionTemplates` field convention and the per-agent stamper `applyExtraInstructionTemplates` delivered by this story. Story 21.4 adds a new entry `{ template: 'agents-md.template.md', target: 'AGENTS.md', merger: 'markdown-markers' }` to the OpenCode agent and reuses this story's stamper unchanged; if the `markdown-markers` merger was not registered by 21.3, 21.4 extends the dispatcher.
- **Story 21.6 (On-Prem Layered Guardrails)** — appends on-prem rules to each mode's `customInstructions` via the same `composeInstructionBlock` call signature (no signature change). Also potentially adds on-prem-only mode-level notes per epic technical note at line 4074. This story's `applyExtraInstructionTemplates` design must accommodate Story 21.6 by re-running the merger when the on-prem template appears (no special branch required if `composeInstructionBlock` already conditionalizes internally — verified via Story 21.2 AC #3).
- **Story 21.9 (Tests and Validation)** — adds the cross-cutting `.roomodes` slug-collision integration test and the NFR47 enforcement contract test as listed in `epics.md` line 4144 (items d and e). This story's tests are the unit-level subset; Story 21.9 adds the integration-level coverage.
- **Story 21.10 (Profile Reconfigure)** — re-stamps `.roomodes` when profile flips. Reuses `applyExtraInstructionTemplates` and `mergeRoomodes`. Story 21.10 also relies on AC #6's slug-collision warning to detect the `RoomodesSlugDivergenceError` referenced at `epics.md` line 4180.
- **Story 21.11 (Profile Uninstall)** — removes the four ma-agents-owned slugs while preserving user entries — reuses the slug-set constant from `lib/merge/roomodes.js` (export it as `MA_AGENTS_OWNED_SLUGS`).

## Testing

**Framework and isolation:** Match the pattern in `test/profile.test.js` (Story 21.1) — node's built-in test runner, `os.tmpdir()` + `fs.mkdtempSync` per-test temporary project roots, never mutate the repo's own `.ma-agents.json` or `lib/templates/`. Use the real `lib/profile.js` (`setProfile(tmpRoot, 'standard' | 'on-prem')`) against the tmp project root.

New test file: `test/roomodes.test.js` (new).

**Unit tests for `mergeRoomodes`:**

- 5.1 Empty/undefined `existingYaml` → output contains exactly the four ma-agents-owned `customModes` in canonical order.
- 5.2 `existingYaml` with two non-colliding user entries → output contains both user entries (preserving original order) followed by the four ma-agents entries.
- 5.3 `existingYaml` with one colliding `bmad-architect` entry → user's entry dropped, replaced by ma-agents version, exactly one warning emitted naming the slug `bmad-architect`.
- 5.4 `existingYaml` with non-`customModes` top-level keys → those keys preserved in output (FR176).
- 5.5 NFR44 grep assertion: `mergeRoomodes` output for profile=standard contains none of `/no_think`, `str_replace_editor`, `~/.claude/`.
- 5.6 NFR46 idempotency: calling `mergeRoomodes` twice with identical inputs returns byte-identical strings (same YAML serialization options, same ordering).
- 5.7 NFR47 regex contract: for each mode's `fileRegex`, assert via `new RegExp(fileRegex).test(...)`:
  - `bmad-pm` accepts `notes.md`, rejects `app.ts`, rejects `script.py`.
  - `bmad-architect` accepts `arch.md`, `diagram.drawio`, `model.xml`; rejects `app.ts`, `script.py`.
  - `bmad-techlead` accepts `config.yaml`, `package.json`, `notes.md`; rejects `app.ts`, `script.py`.
  - `bmad-dev` accepts everything (no group-level `fileRegex` restriction on edit).
- 5.8 Slug-set export: `lib/merge/roomodes.js` exports the canonical `MA_AGENTS_OWNED_SLUGS` constant for downstream consumption (Stories 21.10, 21.11).

**Integration tests for `applyExtraInstructionTemplates`:**

- 5.9 Fresh install in tmp project with profile=standard, Roo Code selected: `<tmpRoot>/.roomodes` is created with the four ma-agents entries; no `/no_think` or other on-prem strings present.
- 5.10 Re-install in tmp project where `<tmpRoot>/.roomodes` already contains a user entry `slug: my-custom-mode`: that entry is preserved alongside the four ma-agents entries; second consecutive install produces byte-identical file content (NFR46).
- 5.11 Roo Code NOT selected: `<tmpRoot>/.roomodes` is not created or modified by ma-agents (AC #13).
- 5.12 OpenCode-only selection: `opencode.json::instructions[]` json-merge path still functions unchanged (NFR18 non-regression — AC #12).

**Test data isolation:** Stub the absence of `lib/templates/instruction-block-onprem.template.md` — Story 21.6 has not landed yet, so the on-prem layer must gracefully fall back to universal-only per Story 21.2 AC #3. Tests must NOT depend on Story 21.6 being delivered.

**Coverage note:** Story 21.9 adds (a) the cross-tool standard-profile-vs-baseline byte test, (b) the on-prem profile must-have-both-layers test, (c) the cross-cutting slug-collision integration test, and (d) the NFR47 enforcement contract end-to-end. Do not duplicate (c) and (d) here — keep this story's tests at the unit/per-merger level.

## Out of Scope

- On-prem layer additions to `customInstructions` per mode (Story 21.6, epic technical note at line 4074).
- `AGENTS.md` template for OpenCode (Story 21.4).
- `.clinerules` template extension for Cline (Story 21.5).
- BMAD persona phase prefix in customize-loader (Story 21.7).
- vLLM deployment doc and README on-prem section (Story 21.8).
- End-to-end Roo Code launch verifying `FileRestrictionError` at the IDE layer (`epics.md` line 4152 explicitly limits NFR47 to regex-contract testing).
- Profile-reconfigure backup / `RoomodesSlugDivergenceError` flow (Story 21.10).
- Profile-uninstall slug removal flow (Story 21.11).
- Bumping `manifestVersion` — already at `1.2.0` from Story 21.1; not touched here.
- Modifying the OpenCode json-merge path or any other agent's instruction injection.

## Change Log

- 2026-04-15: Story created (Epic 21, Story 21.3). ACs structured with explicit (gap-fill) flags per the epic's AC scope. Three Open questions raised inline (YAML library choice, install-loop call site, Roo Code `customModes` schema version) rather than guessed. NFR44/NFR46/NFR47/NFR18 and FR176 citations made explicit. Verified source-tree surface table distinguishes existing vs. new paths. Status set to Ready.
- 2026-04-15 (adversarial-review resolution): Applied canonical decisions A/B/C. (P1 #9) AC #1 pins template path `lib/templates/roomodes.template.yaml` per `epics.md:3994`. (P1 #3) Three Open questions resolved inline as design decisions: YAML library = `js-yaml` (verified `js-yaml@4.1.1` via `npm ls js-yaml` — transitively present through `bmad-method@6.2.2`; promoted to direct dependency, Task 2.5); installer call site = `lib/installer.js` (single stamper owner); Roo Code schema = authoritative shape cited in `lib/agents.js` roo-code entry. (P1 #4) Merger (`mergeRoomodes`) no longer calls `composeInstructionBlock`; it receives the composed string as input — stamper owns composer invocation and substitution. (P1 #10) Terminology normalized to composer/merger/stamper throughout. (Decision C) Backup filename `<target>.backup-<ISO-8601-timestamp>` cited as 21.2-owned in Upstream dependencies. All Tasks are unconditional; Status remains Ready.
