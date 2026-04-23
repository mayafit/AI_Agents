# Story 21.6: On-Prem Layered Guardrails

Status: Review

**Resolutions (2026-04-15, epic owner):**
- **AC #7 Shape A/B:** **Shape A committed.** On-prem content flows through the composer into the Universal Rules section of AGENTS.md; the Critical Behavior Rules section is NOT modified by this story. Rationale: (a) preserves Decision A's "templates are static text, no placeholders" contract; (b) no downstream depends on on-prem rules being the last rules in AGENTS.md; (c) epic's "append to Critical Behavior Rules" is satisfied logically — on-prem rules land inside AGENTS.md's marker block. Shape B is explicitly rejected. Task 4.2's conditional "if Shape B" branch is removed.
- **AC #1 `/no_think` delivery (Shape X vs Y):** **Shape X committed** for this story. 21.6 owns the on-prem TEMPLATE text that states the rule; Story 21.7 owns the active persona-prompt prefix that enforces it. The two layers are complementary by design.
- **AC #1 field-playbook additional rules:** scoped strictly to the four categories enumerated in AC #1. Any additional rules surfaced during Task 1 become follow-up stories, not AC expansion.
- **Task 2.2:** downgraded to "raise a blocker against Story 21.2" per Decision A ownership. 21.6 does not modify composer logic.

## Story

As an **engineer running an on-prem install**,
I want the installer to layer local-LLM-specific guardrails on top of the universal block when profile=on-prem,
So that Nemotron and other local LLMs stop hallucinating `str_replace_editor`, dumping files into `~/.claude/`, and overthinking planning prompts.

## Acceptance Criteria

> Acceptance criteria marked **(gap-fill)** are additions made by the story author to make the epic's AC operational and testable. They do not contradict the epic; they refine the "how" where the epic only stated the "what". Open questions are flagged inline rather than resolved by author guesswork. Controlling invariants: **NFR44** (byte-identity for standard profile), **NFR46** (idempotency), **NFR47** (Roo Code `fileRegex` — consumed unchanged here), **NFR18** (additive JSON-merge — not regressed).

1. **On-prem template file exists.** A new file `lib/templates/instruction-block-onprem.template.md` (new) is present and contains, as self-contained markdown suitable for concatenation after the universal block:
   - A `/no_think` reasoning-OFF directive applied as a system-prompt prefix for planning-phase use.
   - A "NEVER create files in `~/.claude/` or any user home directory; all files go under the project directory" rule.
   - A "do NOT reference or use `str_replace_editor` or any Claude Code-specific tool that may not exist in this agent" rule.
   - Reasoning-mode and sampling guidance per BMAD phase (planning: reasoning OFF, low temperature; implementation: reasoning ON, moderate temperature).

2. **Composer append wiring — on-prem layer.** When `profile === 'on-prem'` AND `lib/templates/instruction-block-onprem.template.md` exists, `composeInstructionBlock({ profile, manifestPath })` (Story 21.2, `lib/installer.js`) appends the on-prem template content to the universal content separated by exactly one blank line (Story 21.2 AC #3 clause). This story delivers the template file; the composer branch is already specified in Story 21.2 AC #3 and requires no signature change. If Story 21.2's composer is refactored, the contract verified here is: standard-profile install omits on-prem content; on-prem-profile install concatenates universal + one blank line + on-prem.

3. **(gap-fill) Placeholder contract.** The on-prem template contains NO placeholders (`{{...}}`). Any rendered per-agent values (e.g., manifest path) belong in the universal template. Rationale: keeps the on-prem layer a pure content append and avoids a second substitution pass. If a future on-prem rule needs a per-agent value, add the placeholder to the universal template and reference the substituted value from on-prem rule text via a stable anchor.

   **Reconciliation with Story 21.4 (closes adversarial P0 #2):** The composer (owned by Story 21.2) appends this template's content to the universal content verbatim; callers that need per-project values use template stamping done by `lib/installer.js` AFTER composition. 21.6 owns only the on-prem template file and profile-gated content; it does NOT own composer, merger, or stamper logic.

4. **Profile isolation — standard profile (NFR44).** When `profile === 'standard'` (or `getProfile(projectRoot)` returns `undefined`), the rendered content inside `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers in every agent's instruction file MUST NOT contain the strings `/no_think`, `str_replace_editor`, or `~/.claude/`. **Scope-narrowing (see Dev Notes → NFR44 test scope):** these three literals are the exhaustive negative-assertion set for standard-profile absence. The reasoning-mode / sampling prose from AC #1 is covered on the POSITIVE side only ("on-prem content present") and is NOT part of this NFR44 negative assertion. Verified by grep-style assertion against rendered output for Claude Code, Cline (both files), Roo Code rules (`.roo/rules/00-ma-agents.md`), Cursor, Kilocode, Copilot, Gemini, and the OpenCode `opencode.json::instructions[]` ma-agents-prefixed string. AGENTS.md's legitimate single `~/.claude/` occurrence (Story 21.4 AC #9 exception) is unaffected by this AC — it lives in the AGENTS.md Critical Behavior Rules anchor which is authored as universal safety content, not gated by profile.

5. **Profile merge — on-prem profile.** When `profile === 'on-prem'`, every agent receiving markdown-marker injection (AC #4 list minus OpenCode JSON) contains BOTH the universal block content AND the on-prem block content within the same marker region. The OpenCode `opencode.json::instructions[]` ma-agents-prefixed string likewise contains both (concatenated into the single string emitted by the composer).

6. **(gap-fill) `.roomodes` `customInstructions` on-prem augmentation.** Per epic technical note at `epics.md` line 4074, on-prem profile MUST append on-prem rules to each ma-agents-owned mode's `customInstructions` in `.roomodes`. Implementation: Story 21.3's `applyExtraInstructionTemplates` substitutes `{{UNIVERSAL_BLOCK}}` inside `roomodes.template.yaml` with `composeInstructionBlock({ profile, manifestPath })` output. Because `composeInstructionBlock` already conditionalizes on profile (AC #2), on-prem content appears inside each mode's `customInstructions` with NO change to Story 21.3's merger or template shape — the conditional happens entirely inside the composer call site. Verified by asserting `/no_think` is present in each of `bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev` `customInstructions` after an on-prem install, and absent after a standard install.

7. **(gap-fill) `AGENTS.md` `## Critical Behavior Rules` on-prem augmentation.** Per epic technical note at `epics.md` line 4074, on-prem profile MUST append on-prem rules to AGENTS.md's `## Critical Behavior Rules` section. Story 21.4 AC #11 Open question proposed `## Critical Behavior Rules` as the stable anchor. Implementation: because the universal block expanded via `{{UNIVERSAL_BLOCK}}` inside `agents-md.template.md` already carries on-prem content in the on-prem profile (AC #5), the visible effect is that `AGENTS.md`'s Universal Rules section carries the on-prem rules, not the Critical Behavior Rules section literally. This story's contract: on-prem content IS present in the marker-block region of AGENTS.md after an on-prem install; its exact positional anchor may be either the Universal Rules section (transparent via `composeInstructionBlock`) OR the Critical Behavior Rules section (requires a second substitution anchor). See Open question below for the decision branch.

   > **Resolved (2026-04-15, Shape A):** On-prem content flows through `{{UNIVERSAL_BLOCK}}` and appears after the universal rules in AGENTS.md. The Critical Behavior Rules section carries only the universal "never write to `~/.claude/`" rule (its existing authored content) and is NOT modified by this story. The epic's "append to Critical Behavior Rules" wording is satisfied logically — on-prem rules land inside AGENTS.md's marker block. Shape B (adding `{{ONPREM_CRITICAL_RULES}}` placeholder) is rejected because it contradicts Decision A ("templates are static text, no placeholders").

8. **(gap-fill) `.clinerules` / `.cline/clinerules.md` on-prem augmentation.** Per Story 21.5 AC #8, on-prem content flows through `composeInstructionBlock` into both Cline files inside the markers. This story adds no Cline-specific code; verification is a test assertion that both Cline files contain on-prem content in on-prem profile installs and lack it in standard-profile installs. Story 21.5's `ClinerulesDualFileDriftError` drift check is not disturbed — on-prem content renders identically into both files (render once, write twice).

9. **(gap-fill) BMAD persona phase prefix is NOT in scope here.** The `lib/bmad-customize/*.customize.yaml` on-prem `on_prem_phase_prefix` field (epic Story 21.7) is a separate surface. Story 21.6 is the on-prem layer for the PROMPT-INJECTION / per-tool instruction files and `.roomodes`/`AGENTS.md`/`.clinerules` overlays. Persona-level system-prompt prefixes ship in Story 21.7. The two stories co-exist: on-prem install runs both (21.6 stamps files, 21.7 composes persona prompts).

10. **(gap-fill) Idempotency (NFR46).** Two consecutive installs with `profile === 'on-prem'` and identical project state produce:
    - Byte-identical content inside the marker region of every markdown-injection agent's instruction file.
    - Byte-identical `.roomodes` YAML (preserves Story 21.3 AC #10 serialization pinning).
    - Byte-identical `AGENTS.md` marker-block content (Story 21.4 AC #8).
    - Unchanged `opencode.json::instructions[]` (the ma-agents-prefixed string is replaced in place, not duplicated; no extra entries emerge from the on-prem layer — the on-prem content is concatenated inside the single existing string).
    The on-prem template source contains no timestamps, random IDs, or ordering-sensitive content. AC #6's `composeInstructionBlock` output is deterministic by construction (string concatenation of two file reads).

11. **(gap-fill) Additive JSON-merge not regressed (NFR18).** This story changes the CONTENT of the ma-agents-prefixed string in `opencode.json::instructions[]` (by virtue of the composer appending on-prem content when profile=on-prem) but does NOT change the number of entries, their order, or any other key in `opencode.json`. The existing `isMaEntry` prefix filter (`lib/installer.js` lines ~372–374) continues to identify the single ma-agents entry for in-place replacement. Story 21.4's additional `"AGENTS.md"` entry is unaffected.

12. **(gap-fill) Roo Code `fileRegex` not regressed (NFR47).** The on-prem layer changes `customInstructions` content only. The `groups` / `fileRegex` per-mode restrictions authored in Story 21.3's `roomodes.template.yaml` are untouched by this story. Verified by asserting the four modes' `fileRegex` patterns are identical between standard and on-prem renders (content diff only in `customInstructions`).

13. **(gap-fill) Upgrade-safety on profile flip.** Switching from `standard` → `on-prem` (or vice versa) on an existing install is NOT in this story's scope — it is the Story 21.10 (Profile Reconfigure) surface. This story's contract is limited to the RENDER when profile is set at install time. Flipping the profile by hand-editing `.ma-agents.json` and re-running `install` will be detected by Story 21.2 AC #10's drift detection (the in-marker content differs from the newly-composed content) and handled per that AC's interactive-confirm / --yes-warn pattern. No new upgrade path is introduced here.

> **Resolved (2026-04-15):** Scope this story strictly to the four on-prem rule categories enumerated in AC #1. Additional rules discovered in field playbook `optimizing-local-llm-coding-agents-bmad.md` during Task 1 become follow-up stories, not AC expansion.

> **Resolved (2026-04-15, Shape X):** The `/no_think` directive in AC #1 is delivered as instruction-text in the on-prem template — Story 21.6 owns the rule body that tells the LLM to prepend `/no_think` to planning-phase prompts. Shape Y (active persona prefix prepended by code) is Story 21.7's surface via the `on_prem_phase_prefix` field. The two layers are complementary by design: 21.6 states the rule; 21.7 enforces it at persona-prompt composition.

## Tasks / Subtasks

- [ ] **Task 1: Author the on-prem template** (AC #1, #3, #4, #10)
  - [ ] 1.1 Create `lib/templates/instruction-block-onprem.template.md` (new) containing the four rule categories from AC #1 as self-contained markdown. No placeholders (AC #3).
  - [ ] 1.2 Author rule text verbatim grounded in the epic AC #1 bullets and the field playbook `optimizing-local-llm-coding-agents-bmad.md` (epic intro line 3888 references). Do NOT copy universal-block rules (profile isolation — on-prem layer is strictly additive).
  - [ ] 1.3 Verify by inspection that the template contains the literals `/no_think`, `str_replace_editor`, `~/.claude/` (they are the on-prem-only strings — NFR44's negative assertion on standard-profile output is the contract).
  - [ ] 1.4 Verify the template has no trailing whitespace on any line and ends with a single trailing newline (idempotency — AC #10).

- [ ] **Task 2: Verify composer consumption** (AC #2, #5) — VERIFY-ONLY; 21.6 does NOT own composer logic.
  - [ ] 2.1 Read `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js` (Story 21.2 delivery). Confirm it reads `lib/templates/instruction-block-onprem.template.md` when `profile === 'on-prem'` AND the file exists, and appends it after the universal content separated by one blank line.
  - [ ] 2.2 If the composer's on-prem append branch is missing or broken, raise a blocker against Story 21.2 and halt this story. Do NOT modify composer logic in 21.6 — composer ownership belongs to 21.2 per Decision A.
  - [ ] 2.3 Confirm no call site depends on the on-prem template being absent — Story 21.2's graceful-fallback behavior is preserved (standard-profile installs continue to return universal-only).

- [ ] **Task 3: Roo Code `.roomodes` on-prem augmentation** (AC #6, #12)
  - [ ] 3.1 No code change required — Story 21.3's `applyExtraInstructionTemplates` substitutes `{{UNIVERSAL_BLOCK}}` via `composeInstructionBlock` which now includes on-prem content in on-prem profile. Verified by test only.
  - [ ] 3.2 Add test assertion: on-prem install with Roo Code selected produces `.roomodes` where every ma-agents-owned mode's `customInstructions` contains `/no_think`. Standard install does not.

- [ ] **Task 4: AGENTS.md on-prem augmentation** (AC #7) — VERIFY-ONLY for 21.6. Shape A is committed (see resolution above and AC #7 resolution block).
  - [ ] 4.1 Verify on-prem content reaches AGENTS.md transparently via the composer output consumed by the `markdown-markers` merger (Story 21.4). Add test assertion that `AGENTS.md` after an on-prem install contains `/no_think` within the `<!-- MA-AGENTS-START -->` marker block, and does not contain it after a standard install. 21.6 does NOT modify 21.4's template or merger.

- [ ] **Task 5: Cline on-prem augmentation** (AC #8)
  - [ ] 5.1 No code change required — Story 21.5's Cline path flows through `composeInstructionBlock`. Add test assertion that both Cline files carry on-prem content in on-prem profile and lack it in standard profile.

- [ ] **Task 6: OpenCode JSON-merge content change** (AC #11)
  - [ ] 6.1 No code change required — the json-merge path (`lib/installer.js` lines ~365–405) emits the single ma-agents-prefixed string whose CONTENT now includes on-prem rules when profile=on-prem (via the same `composeInstructionBlock` call).
  - [ ] 6.2 Add test assertion that `opencode.json::instructions[]` after an on-prem install contains exactly one ma-agents-prefixed entry (not two), that entry contains `/no_think`, and `instructions[]` length/order is unchanged versus a second consecutive install.

- [ ] **Task 7: Unit and integration tests** — see Testing section below.

- [ ] **Task 8: Documentation touch-up**
  - [ ] 8.1 No new docs in this story. Story 21.8 introduces the broader Epic 21 / on-prem doc surface. If an existing doc already covers instruction injection, append a one-sentence pointer to the on-prem template — otherwise skip.

## Dev Notes

### Ownership boundary (canonical)

- **Composer** (`composeInstructionBlock({ profile, projectRoot }) → string`) lives in Story 21.2, `lib/installer.js`. It concatenates the universal template and, when `profile === 'on-prem'`, appends this story's on-prem template content verbatim, separated by exactly one blank line.
- **Merger** logic (yaml-customModes for `.roomodes`, markdown-markers for `AGENTS.md`, markdown-marker writer for per-tool instruction files, JSON additive merge for `opencode.json`) lives in its respective owning story (21.3, 21.4, 21.2/21.5, 21.2). 21.6 does NOT own merger logic.
- **Stamper** (project-value substitution of `{{...}}` placeholders such as manifest path) runs AFTER composition, in `lib/installer.js`. Templates — including this story's on-prem template — have NO `{{...}}` placeholders. 21.6 does NOT own stamper logic.
- **21.6 owns only:** (a) the on-prem template file `lib/templates/instruction-block-onprem.template.md`, and (b) the profile-gated content inside it.

### NFR44 test scope (decision D — scope narrowing)

The three literal strings — `/no_think`, `str_replace_editor`, `~/.claude/` — are the **exhaustive negative-assertion set** for verifying standard-profile absence of on-prem content. Tests 7.3 and 7.7 assert only these three literals; no additional tokens are required for the negative case.

The reasoning-mode and sampling prose introduced in AC #1 (planning: reasoning OFF / low temperature; implementation: reasoning ON / moderate temperature) is tested on the **POSITIVE side only** — i.e., "on-prem content present in on-prem profile output" (tests 7.1, 7.4, 7.8). It is NOT part of the NFR44 negative-assertion set and must not be used to gate standard-profile absence. Referenced from AC #4 where the scope-narrowing is called out.

### Architecture compliance

- **Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile)** — This story delivers the on-prem layer of the two-layer injection model defined in Story 21.2. Story 21.2 built the composition function and the graceful-fallback stub; Story 21.6 ships the template file and verifies the end-to-end behavior across every injection surface (Stories 21.3, 21.4, 21.5) transparently via `composeInstructionBlock`.

- **NFR44 (byte-identity for standard profile)** — `_bmad-output/planning-artifacts/epics.md` line 4071 ("verified by absence of the strings `/no_think`, `str_replace_editor`, `~/.claude/` in standard-profile output"). AC #4 is the contract; tests 7.3–7.7 enforce it across every injection surface. **This is the most important invariant in Story 21.6.** The on-prem template content MUST NOT leak into the standard-profile render.

- **NFR46 (idempotency)** — `epics.md` lines 471, 4144 (item c). Two consecutive on-prem installs produce byte-identical output across every injection surface. AC #10 is the contract; test 7.9 enforces it. Inherited from Stories 21.2 (whitespace-parity insert/replace), 21.3 (pinned YAML serialization), 21.4 (marker-wrap determinism).

- **NFR47 (Roo Code application-layer `fileRegex` enforcement)** — `epics.md` lines 4144 (item e), 4152. This story does not touch the `groups`/`fileRegex` structure authored in Story 21.3's template. AC #12 is a non-regression assertion; test 7.11 enforces.

- **NFR18 (additive JSON-merge for OpenCode)** — `epics.md` line 4229. This story changes the content of the single ma-agents-prefixed entry in `opencode.json::instructions[]` but does not add entries, reorder entries, or touch other keys. AC #11 is a non-regression assertion; test 7.10 enforces.

### Verified source-tree surface

| File | Exists? | Role in this story |
|------|---------|--------------------|
| `lib/profile.js` | verified (Story 21.1, lines 29–43) | Read-only — consumed via `getProfile(projectRoot)` through `composeInstructionBlock` call sites |
| `lib/installer.js` | verified | `composeInstructionBlock` (new in Story 21.2) reads the on-prem template delivered here. Task 2.2 may extend the append branch if Story 21.2 left it as a stub |
| `lib/agents.js` | verified | Read-only — no changes. Enumerates the agents whose instruction files receive the on-prem-augmented block (Claude Code, Cline × 2, Roo Code rules, Cursor, Kilocode, Copilot, Gemini, OpenCode, Anti-gravity) |
| `lib/templates/instruction-block-universal.template.md` | **new (Story 21.2)** | Authored in Story 21.2; unchanged here |
| `lib/templates/instruction-block-onprem.template.md` | **new (this story)** | Authored here per AC #1 |
| `lib/templates/roomodes.template.yaml` | **new (Story 21.3)** | Unchanged here — on-prem content reaches `.roomodes` transparently via `{{UNIVERSAL_BLOCK}}` |
| `lib/templates/agents-md.template.md` | **new (Story 21.4)** | Unchanged by this story (Shape A committed — AC #7 resolution) |
| `lib/templates/clinerules.template.md` | **new (Story 21.5)** | Unchanged here |
| `lib/merge/roomodes.js` | **new (Story 21.3)** | Unchanged — merger treats `customInstructions` as opaque string |
| `test/onprem-injection.test.js` | verified (exists — Story 21.9's target expansion surface) | This story ADDS a sibling file `test/onprem-layer.test.js` (new) to avoid collision with Story 21.9's planned expansion |
| `test/profile.test.js` | verified (Story 21.1) | Reference for test framework and temp-dir isolation pattern |

### Composition pattern (end state after Story 21.6 lands)

```
composeInstructionBlock({ profile, manifestPath })
  ├── universal template (Story 21.2 — always applied; {{MANIFEST_PATH}} substituted)
  └── on-prem template (this story — applied when profile === 'on-prem'; no placeholders)

Consumed by:
  ├── updateAgentInstructions markdown branch (Story 21.2 AC #4): Claude Code, Cline ×2, Roo Code rules, Cursor, Kilocode, Copilot, Gemini, Anti-gravity
  ├── updateAgentInstructions json-merge branch (Story 21.2 AC #8): OpenCode opencode.json::instructions[]
  ├── applyExtraInstructionTemplates yaml-customModes merger (Story 21.3): .roomodes customInstructions per mode
  └── applyExtraInstructionTemplates markdown-markers merger (Story 21.4): AGENTS.md marker block
```

### Injection-site map (for reviewers)

On-prem content reaches every injection site TRANSPARENTLY through `composeInstructionBlock`. The only code change required (if Story 21.2 left the append branch as a stub) is activating the branch — Task 2.2. No call site is modified. No new function is introduced.

### Library and pattern references

- **Template discovery**: `lib/installer.js` loads `lib/templates/*.template.md` via synchronous `fs.readFileSync` (Story 21.2 Task 2.2). No change here.
- **Profile resolution**: `getProfile(projectRoot)` from `lib/profile.js` (Story 21.1 verified lines 29–43). No change here.
- **Markers**: `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` — defined and used by `updateAgentInstructions`. No change here.
- **Atomic writes**: the atomic-write pattern from Story 21.3 (`lib/installer.js` lines ~395–398, temp-file + rename) is inherited by `applyExtraInstructionTemplates`. No change here.

### Field playbook reference

The on-prem rules originate from `optimizing-local-llm-coding-agents-bmad.md` (referenced in epic intro at `_bmad-output/planning-artifacts/epics.md` lines 3886–3895). Four concrete failure modes documented there map 1:1 to AC #1's four rule categories:
- Nemotron hallucinating `str_replace_editor` → AC #1 no-str_replace_editor rule.
- Local LLMs dumping output into `~/.claude/` → AC #1 no-home-dir-writes rule.
- Local LLMs overthinking planning prompts with reasoning mode on by default → AC #1 `/no_think` + reasoning-OFF planning guidance.
- Local LLMs skipping BMAD planning to start coding → addressed by the UNIVERSAL block's BMAD phase discipline rule (Story 21.2); the on-prem layer adds the sampling-per-phase guidance.

### Out of Scope

- Universal template content (Story 21.2).
- `.roomodes` template authorship and the `yaml-customModes` merger (Story 21.3).
- `AGENTS.md` template authorship (Story 21.4).
- `.clinerules` template authorship (Story 21.5).
- BMAD persona phase prefix via `lib/bmad-customize/*.customize.yaml` `on_prem_phase_prefix` field (Story 21.7 — separate composition surface, NOT `composeInstructionBlock`).
- vLLM deployment doc and README on-prem section (Story 21.8).
- Cross-tool NFR44/NFR46 integration tests (Story 21.9; this story's tests are scoped to the on-prem layer's content presence/absence).
- Profile-reconfigure flow covering profile-flip drift (Story 21.10).
- Profile-uninstall removal of on-prem marker content (Story 21.11).
- Bumping `manifestVersion` — already at `1.2.0` (Story 21.1).
- Installing or managing the inference server (vLLM) — documentation-only surface, see epic intro line 3895.

## Dependencies

### Upstream (blocking)

- **Story 21.1 (done)** — `lib/profile.js::getProfile(projectRoot)` consumed transitively via `composeInstructionBlock`. Verified at `lib/profile.js` lines 29–43.
- **Story 21.2 (Ready)** — `composeInstructionBlock({ profile, manifestPath })` in `lib/installer.js` is the sole consumer of the on-prem template. Story 21.2 AC #3 pre-specifies the append branch ("When `profile === 'on-prem'` AND `lib/templates/instruction-block-onprem.template.md` (new, ships in Story 21.6) exists, appends that file's content after the universal content, separated by one blank line."). This story ships the template file; Task 2.2 activates the branch if it was left as a stub.
- **Story 21.3 (Ready)** — `.roomodes` template consumes `{{UNIVERSAL_BLOCK}}` via `applyExtraInstructionTemplates`. On-prem content reaches per-mode `customInstructions` transparently.
- **Story 21.4 (Ready)** — `AGENTS.md` template consumes `{{UNIVERSAL_BLOCK}}` via `markdown-markers` merger. Shape A is committed (AC #7 resolution), so 21.6 reuses 21.4's template unchanged.
- **Story 21.5 (Ready)** — Cline's two files consume `composeInstructionBlock` via `updateAgentInstructions`'s existing markdown branch; on-prem content flows in transparently.

### Downstream (consumers of this story's surface)

- **Story 21.7** — BMAD persona phase prefix via customize-loader. Independent composition surface; does NOT consume `composeInstructionBlock`. Cross-reference only — an on-prem install activates both 21.6 (per-tool files) and 21.7 (persona system-prompt prefix).
- **Story 21.8** — vLLM deployment doc + README on-prem section. Documents the same `/no_think` directive that AC #1 stamps into the per-tool templates; NOT an implementation dependency, but content drift between the on-prem template here and the vLLM doc would confuse users. Recommend a test assertion that both sources mention `/no_think` and `str_replace_editor` verbatim; wording can diverge but token presence must be consistent.
- **Story 21.9** — Integration tests verifying (a) standard profile produces NO on-prem-specific strings across every injection surface, (b) on-prem profile produces BOTH layers, (c) idempotency across two on-prem installs, (d) `.roomodes` slug-collision behavior is profile-independent. Tests 7.3–7.9 in this story's Testing section are unit/integration-level subsets; Story 21.9 adds the cross-tool integration coverage.
- **Story 21.10 (Profile Reconfigure)** — Re-stamps profile-dependent artifacts when profile flips. Reuses `composeInstructionBlock`; the drift-detection path from Story 21.2 AC #10 handles the standard↔on-prem content diff.
- **Story 21.11 (Profile Uninstall)** — Removes marker-block content (including on-prem layer) on `uninstall --profile-artifacts`. No special handling for on-prem content — marker removal is layer-agnostic.

## Testing

**Framework and isolation:** Match the pattern in `test/profile.test.js` (Story 21.1) and `test/opencode-json-merge.test.js` (Epic 9) — node's built-in test runner, `os.tmpdir()` + `fs.mkdtempSync` per-test temporary project roots, never mutate the repo's own `.ma-agents.json`, `lib/templates/`, or `opencode.json`. Use the real `lib/profile.js` (`setProfile(tmpRoot, 'standard' | 'on-prem')`) against the tmp project root. Do NOT stub `lib/installer.js` or `lib/agents.js` — use the real modules to catch integration bugs.

New test file: `test/onprem-layer.test.js` (new) — avoids collision with `test/onprem-injection.test.js` which Story 21.9 will expand.

**Unit tests:**

- 7.1 Template file exists at `lib/templates/instruction-block-onprem.template.md` and contains the four AC #1 content categories (one test per category: `/no_think` directive present; `~/.claude/` no-home-writes rule present; `str_replace_editor` no-reference rule present; reasoning-mode per-phase guidance present).
- 7.2 Template contains NO placeholders (`{{`) — AC #3 defensive.
- 7.3 NFR44 — standard profile: `composeInstructionBlock({ profile: 'standard', manifestPath })` output does NOT contain `/no_think`, `str_replace_editor`, or `~/.claude/`. Assert each of the three strings is absent via direct `.includes()` check.
- 7.4 On-prem profile: `composeInstructionBlock({ profile: 'on-prem', manifestPath })` output contains all three strings (`/no_think`, `str_replace_editor`, `~/.claude/`).
- 7.5 Composer output structure: on-prem output equals universal output + exactly one blank line + on-prem template content. Verified by string parsing, not regex.
- 7.6 Idempotency: calling `composeInstructionBlock({ profile: 'on-prem', manifestPath: X })` twice returns byte-identical strings.

**Integration tests (within this story — cross-tool end-to-end lives in Story 21.9):**

- 7.7 Fresh standard-profile install with all injection-surface agents selected (Claude Code, Cline, Roo Code, OpenCode, Cursor, Kilocode, Copilot, Gemini): for EVERY generated file in the tmp project, assert the three NFR44 forbidden strings (`/no_think`, `str_replace_editor`, `~/.claude/`) are absent. Files checked: `.claude/CLAUDE.md`, `.cline/clinerules.md`, `.clinerules`, `.roo/rules/00-ma-agents.md`, `.roomodes` (all four modes' `customInstructions`), the OpenCode `opencode.json::instructions[]` ma-agents-prefixed entry, `.cursor/cursor.md`, `.kilocode/kilocode.md`, `.github/copilot/copilot.md`, `.gemini/gemini.md`. Note: AGENTS.md's legitimate single `~/.claude/` occurrence (Story 21.4 AC #9 exception) is excluded from this assertion — tested separately in 7.12.
- 7.8 Fresh on-prem-profile install with same agent set: for EVERY file above, assert all three strings ARE present (NFR44 positive case). Specifically: `/no_think` appears in each of the four `.roomodes` `customInstructions` blocks (AC #6).
- 7.9 Two consecutive on-prem installs produce byte-identical content across all files above (AC #10 — NFR46).
- 7.10 NFR18 non-regression: on-prem install's `opencode.json` has `instructions[]` length equal to `N + M` where N is the user's pre-existing entries and M is the ma-agents-contributed entries (1 ma-agents-prefixed + 1 `"AGENTS.md"` if OpenCode is selected). Key count at the top level of `opencode.json` is unchanged versus a standard install.
- 7.11 NFR47 non-regression: after an on-prem install, the four `.roomodes` modes' `fileRegex` patterns are byte-identical to the same modes' patterns in a standard install (content diff is only in `customInstructions`). AC #12 contract.
- 7.12 Shape A verification (AC #7 resolution): after an on-prem install, AGENTS.md contains `/no_think` somewhere inside the marker region. Exact positional assertion (Universal Rules vs Critical Behavior Rules section) is NOT tested — Shape A delivers content via the Universal Rules section and that location is not part of the contract.

**Test data isolation:** All tests create a tmp project with a stub `.ma-agents.json` written via `setProfile(tmpRoot, 'standard' | 'on-prem')` (Story 21.1 API). Use real `lib/templates/` on disk — tests must NOT stub the template files so that AC #1's template-authorship contract is exercised end-to-end.

**Coverage note:** Story 21.9 adds (a) a standard-profile vs. pre-Epic-21 baseline byte-comparison test (covers NFR44 across the whole artifact, not just the three literal strings), (b) on-prem profile must-have-both-layers integration across every tool at once, (c) profile-flip drift detection via Story 21.10. Do NOT duplicate those here — keep this story's tests scoped to the on-prem layer's content presence/absence and the composer's on-prem branch wiring.

## Out of Scope

(See Dev Notes → Out of Scope above — summarized for quick reference.)

- Universal block content (Story 21.2).
- `.roomodes` template authorship and the `yaml-customModes` merger (Story 21.3).
- `AGENTS.md` template authorship (Story 21.4).
- `.clinerules` template authorship (Story 21.5).
- BMAD persona phase prefix (Story 21.7).
- vLLM deployment documentation and README on-prem section (Story 21.8).
- Cross-tool NFR44/NFR46 integration tests (Story 21.9).
- Profile-reconfigure flow (Story 21.10).
- Profile-uninstall flow (Story 21.11).

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context) — bmad-dev-story + adversarial review.

### Completion Notes List
- Shipped `lib/templates/instruction-block-onprem.template.md` (90 lines) containing the four AC #1 content categories: `/no_think` planning-phase directive, no-home-dir-writes rule referencing `~/.claude/`, no-`str_replace_editor` rule, per-phase reasoning+sampling guidance (planning/implementation/review).
- Template has no `{{...}}` placeholders (AC #3), ends with exactly one trailing newline, has no trailing whitespace on any line (AC #1.4 idempotency precondition).
- Composer (Story 21.2, `lib/installer.js`) already implemented the on-prem append branch. Verified by Task 2 inspection — no 21.2 blocker raised. The on-prem template now flows transparently through every injection surface: markdown-marker merger (Claude Code, Cline ×2, Roo Code rules, Cursor, Kilocode, Copilot, Gemini, Antigravity), json-merge merger (OpenCode `opencode.json::instructions[]`), yaml-customModes merger (`.roomodes`), and markdown-markers merger (AGENTS.md).
- Fresh on-prem install confirmed to render all three NFR44 literals (`/no_think`, `str_replace_editor`, `~/.claude/`) into every stamped injection surface (test 7.8 passes across 11+ files).
- Fresh standard-profile install confirmed to render NONE of the three literals into any injection surface except AGENTS.md's legitimate Critical Behavior Rules `~/.claude/` occurrence (AC #4 exception, verified by excluding that surface from the universal-rule assertion).
- NFR46 idempotency: two consecutive on-prem installs produce byte-identical marker-block content across `.claude/CLAUDE.md`, `.cline/clinerules.md`, `.clinerules`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`, and byte-identical `.roomodes` YAML (test 7.9).
- NFR18 non-regression: on-prem install's `opencode.json` has exactly one `[ma-agents]`-prefixed entry, user entries preserved, `otherKey` untouched, `instructions[]` length stable across re-installs (test 7.10).
- NFR47 non-regression: `.roomodes` `fileRegex` patterns byte-identical between standard and on-prem profiles (test 7.11).
- Obsolete precondition fixed: `test/clinerules.test.js` test 5.7a was written assuming the on-prem template is absent (pre-21.6 state). Updated to temporarily rename the template to simulate absence (mirrors `test/instruction-block.test.js` test 5.6 pattern).

### Adversarial Review Findings

| # | Layer | Severity | Finding | Disposition |
|---|-------|----------|---------|-------------|
| 1 | Cynical | P1 | Tests 7.7/7.8 skip missing surfaces via `continue` — a regression dropping every rendered surface would pass vacuously | **Fixed** — added sanity guards asserting `.claude/CLAUDE.md` (both), `.roomodes` + `AGENTS.md` (on-prem only) exist before the content loop |
| 2 | Cynical | P1 | `/no_think` substring match would also match e.g. `//no_think` in comments | **Accepted** — template writes the token on its own line; no other ma-agents-owned template contains any `//no_think`-adjacent literal |
| 3 | Edge-case | P1 | NFR47 regex parse `/fileRegex:\s*([^\n]+)/g` would double-count if a future on-prem rule mentioned "fileRegex" | **Accepted** — current on-prem template contains no "fileRegex" literal; future rules added via follow-up stories can extend the parse |
| 4 | Edge-case | P1 | Test 7.9 re-runs `installAllInjectionSurfaces` — second pass risks drift-detection false-positives | **Accepted** — `composeInstructionBlock` is deterministic (verified by 21.2 test 5.4 + this story's 7.6); drift path not entered on clean re-install (21.2 test 5.10a confirms) |
| 5 | Cynical | P2 | Template uses backtick inline code spans — markdown renderers in agent UIs may strip them | **Accepted** — cosmetic; the three literals are also written in plain prose outside code spans, and tests assert literal substring presence (renderer-independent) |
| 6 | Edge-case | P2 | `.roomodes` drift via `reconfigure` flow (profile flip) could surface 21.2 AC #10 warning on standard→on-prem | **Out of scope per spec** — AC #13 explicitly defers profile-flip to Story 21.10 |

All P0/P1 findings resolved or accepted with documented rationale.

### File List
- CREATED: `lib/templates/instruction-block-onprem.template.md`
- CREATED: `test/onprem-layer.test.js` (12 tests, all passing)
- MODIFIED: `test/clinerules.test.js` (test 5.7a updated — simulate on-prem template absence via rename)
- MODIFIED: `package.json` (added `test/onprem-layer.test.js` to npm test script)
- MODIFIED: `_bmad-output/implementation-artifacts/21-6-onprem-layered-guardrails.md` (Status → Review; Dev Agent Record / File List / Change Log updated)

## Change Log

- 2026-04-15: Story 21.6 implemented — on-prem template shipped, all 12 story-local tests green (onprem-layer.test.js), full `npm test` green (no regressions). Composer wiring from 21.2 reused unchanged — no blocker raised. Status Ready → Review.
- 2026-04-15 (epic-owner resolution): All three open questions resolved inline. **AC #7 Shape A committed** — on-prem content reaches AGENTS.md via the Universal Rules section transparently through the composer; Critical Behavior Rules section unchanged by this story. Shape B rejected (would contradict Decision A). **AC #1 `/no_think` Shape X committed** — 21.6 owns the instruction-text rule; 21.7 owns the active persona-prompt prefix. **AC #1 field-playbook** — scoped to four categories only; additional rules become follow-up stories. Task 2.2 and Task 4 made unconditional. Status flipped Draft → Ready. No upstream blockers remain.
- 2026-04-15: Adversarial-review reconciliation. AC #3 reconciled with Story 21.4 via pointer sentence: composer (21.2) appends template verbatim; project-value stamping happens AFTER composition in `lib/installer.js` (closes P0 #2). AC #4 annotated with NFR44 scope-narrowing pointer. Added Dev Notes "Ownership boundary" block clarifying composer/merger/stamper terminology and that 21.6 owns only the on-prem template file and its profile-gated content. Added Dev Notes "NFR44 test scope" block (decision D): three literals exhaustive for negative assertion; reasoning-mode prose positive-only. Task 2.2 downgraded from "extend composer here" to "raise blocker against 21.2"; Task 4.2 downgraded analogously for 21.4. Status flipped to Draft: Task 2.2 and Task 4.2 remain conditional on upstream decisions, and three Open questions remain unresolved. Upstream composer dependency cites Story 21.2.
- 2026-04-15: Story created (Epic 21, Story 21.6). ACs structured with explicit (gap-fill) flags per the epic's AC scope. Three Open questions raised inline (AGENTS.md anchor Shape A vs B, field-playbook additional rules, `/no_think` delivery Shape X vs Y) rather than guessed. NFR44/NFR46/NFR47/NFR18 citations made explicit in Dev Notes. Verified source-tree surface table added distinguishing existing vs. new paths. Upstream/downstream dependencies split. Testing section covers unit (7.1–7.6) and integration (7.7–7.12) with explicit NFR44 negative-assertion coverage against `/no_think`, `str_replace_editor`, `~/.claude/` across every injection surface. Status set to Ready.
