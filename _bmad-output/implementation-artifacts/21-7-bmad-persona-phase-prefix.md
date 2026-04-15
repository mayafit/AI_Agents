# Story 21.7: BMAD Persona Phase-Aware Prompt Prefix (On-Prem Only)

Status: Ready

## Story

As an **engineer running an on-prem install with the BMAD module**,
I want each BMAD agent persona to receive a phase-aware system-prompt prefix steering its reasoning mode appropriately,
So that planning agents (PM, Architect, SM) stop overthinking and producing files for discussion prompts, and implementation agents (Dev) keep their reasoning mode for careful coding.

## Acceptance Criteria

> ACs flagged **(gap-fill)** are refinements added by the story author to make the epic's AC operational and testable. They refine the "how" without contradicting the epic's "what". Where the epic is genuinely ambiguous, an **Open question** callout is raised for the implementing dev to resolve rather than silently guessed. Controlling invariants: **NFR44** (standard profile byte-identity), **NFR46** (idempotency), **NFR47** (Roo Code `fileRegex` not disturbed — consumed unchanged here), **NFR18** (additive JSON-merge not disturbed — this story does not touch `opencode.json`).

1. **Planning-persona prefix content.** When `profile === 'on-prem'` is active at install time, each of the following planning personas has a phase-aware system-prompt prefix prepended to its composed `critical_actions` / system-prompt content:
   - `bmm-pm` (John)
   - `bmm-architect` (Winston)
   - `bmm-sm` (Bob)
   - `bmm-analyst` (Mary) — see Open question below on source file presence
   - `bmm-tech-writer` (Paige)
   - `bmm-ux-designer` (Sally)
   - `bmm-qa` (Gad)

   The prefix text consists of a `/no_think` reasoning-OFF directive and a "respond in text for questions; create files only when explicitly asked" sentence, authored verbatim in each persona's `on_prem_phase_prefix` YAML field (AC #4).

2. **Implementation-persona prefix content.** When `profile === 'on-prem'` is active, each of the following implementation personas receives a different phase-aware prefix:
   - `bmm-dev` (Amelia)
   - `bmm-quick-flow-solo-dev` (Barry) — see Open question below on source file presence

   The prefix is a "think carefully before writing code; reference the story you are implementing" directive — reasoning ON retained, unlike planning personas.

3. **Standard-profile isolation (NFR44).** When `profile === 'standard'` or `getProfile(projectRoot)` returns `undefined`, NO `on_prem_phase_prefix` content is prepended to any persona's composed system prompt. The customize output for every persona is byte-identical to the pre-Epic-21 baseline. Verified by comparing the on-disk content of `_bmad/_config/agents/*.customize.yaml` deployed by the installer in a standard-profile install against a snapshot captured before Epic 21 changes were staged.

4. **(gap-fill) YAML schema additions.** Each `lib/bmad-customize/<persona>.customize.yaml` file gains two new optional top-level fields:
   - `phase: planning | implementation` — phase classification, stateless (keeps the consumer stateless per epic technical note, `epics.md` line 4102).
   - `on_prem_phase_prefix: <string>` — the literal prefix text to prepend when `profile === 'on-prem'`.

   Both fields are OPTIONAL. Files missing them behave as pre-Epic-21 (no prefix applied in any profile). The existing `critical_actions` array and any other fields are preserved byte-for-byte.

5. **(gap-fill) `phase` field values enumerated.** The permissible values for `phase` are `planning` and `implementation`. Any other value is ignored with a console warning during deployment (non-fatal). See Open question below on whether a `mixed` value is in scope.

   > **Open question (phase: mixed enumeration).** The epic cross-epic note at `_bmad-output/planning-artifacts/epics.md:4231` describes a "phase: mixed enum extension (added in corrective-plan step 3)". This story does NOT introduce `phase: mixed` in AC #5 because no epic AC enumerates it and no persona file has requested it. If the implementing dev finds a persona where both planning and implementation prefixes should co-apply (e.g., `bmm-bmad-master`), raise it as a follow-up story. Proposed resolution: scope strictly to `planning` and `implementation` for Story 21.7; `mixed` is a follow-up.

6. **Loader integration contract — customize-loader lives upstream.** Per the Epic 21 cross-epic note at `_bmad-output/planning-artifacts/epics.md:4231`, the customize-loader that composes persona system prompts lives in **upstream BMAD**, not in ma-agents. `lib/bmad-customize/` (verified at `D:\Code\agents\lib\bmad-customize\`) contains only the 8 `*.customize.yaml` artifacts; there is no ma-agents loader JS to modify. Per the project's durable policy ("BMAD built-in override policy" — never upstream PRs; override via extension), this story's implementation MUST NOT submit changes to `bmad-method`. All on-prem prefix behavior is introduced via the ma-agents extension path.

   > **Open question (two-branch decision — upstream loader behavior).** Per `epics.md:4231` the implementing dev MUST first probe upstream BMAD's customize-loader against a YAML file that contains the new `phase:` and `on_prem_phase_prefix:` keys. Two valid branches follow:
   >
   > - **Branch A — upstream accepts unknown keys (lenient schema).** The loader reads `critical_actions` and ignores the new keys. In this case, the prefix logic runs in a ma-agents-owned post-deploy step that rewrites the prepended content into the deployed `_bmad/_config/agents/<persona>.customize.yaml` (or equivalent compiled output) at install time, gated by `getProfile(projectRoot) === 'on-prem'`. The single source YAML in `lib/bmad-customize/` carries both keys and is consumed by BOTH profiles — the post-deploy step is the ONLY on-prem branch.
   >
   > - **Branch B — upstream rejects unknown keys (strict schema).** The epic mandates a dual-variant output: the extension emits two files per persona during install — `<persona>.customize.yaml` (standard, strips the new keys) and `<persona>.customize.on-prem.yaml` (on-prem, inlines the `on_prem_phase_prefix` into the prepended `critical_actions`). The installer chooses which variant to deploy to `_bmad/_config/agents/` based on `getProfile(projectRoot)`. `lib/bmad-customize/<persona>.customize.yaml` remains the single-source authoring file; the dual-variant expansion happens at deploy time in a ma-agents helper.
   >
   > Proposed resolution: Task 1 runs the probe with a throwaway YAML. Implementing dev picks the branch, records the decision in this file's Change Log, and implements exactly one branch. Both branches satisfy NFR44 (standard profile produces no on-prem content) — they differ only in WHERE the conditional lives.

7. **(gap-fill) Prefix composition rule.** Whichever branch (A or B) is chosen, the on-prem prefix text is prepended to the EXISTING `critical_actions` list — it does not replace the existing items. Shape depends on branch:
   - **Branch A shape:** post-deploy rewrite inserts the prefix as a new `critical_actions[0]` entry (quoted string) ahead of the existing entries.
   - **Branch B shape:** the on-prem variant file is emitted with `critical_actions[0] = <prefix text>` already inlined; the standard variant omits it.

   All pre-existing `critical_actions` entries are preserved in their original order in both shapes.

8. **(gap-fill) Idempotency (NFR46).** Two consecutive on-prem installs produce byte-identical deployed `_bmad/_config/agents/*.customize.yaml` content for every persona touched by this story. Verified by hashing the deployed files after two back-to-back installs. The on-prem prefix strings contain no timestamps, random IDs, or environment-dependent content.

9. **(gap-fill) Standard profile byte-identity to pre-Epic-21 baseline.** When `profile === 'standard'`, the deployed `_bmad/_config/agents/<persona>.customize.yaml` content is byte-identical to what the same installer would have produced before Epic 21 staged the schema additions from AC #4. If Branch A is chosen, this requires either (a) the post-deploy step being a no-op under standard profile, or (b) the post-deploy step explicitly stripping the new `phase` / `on_prem_phase_prefix` keys before writing. If Branch B is chosen, the standard-variant file emitted at deploy time strips the new keys. Either way, a standard-profile install MUST NOT leak the `phase:` or `on_prem_phase_prefix:` keys into the deployed artifact.

10. **(gap-fill) Authoring file back-compat.** `lib/bmad-customize/<persona>.customize.yaml` files that are NOT touched by this story (or any persona whose `phase` field is unset) MUST continue to deploy identically to pre-Epic-21 behavior — this story only modifies the files for the 9 personas enumerated in AC #1 + AC #2. Other personas (e.g., `bmm-bmad-master`, `bmm-demerzel`, the IDE-agent customizations in `lib/bmad-customizations/*.customize.yaml`) are OUT OF SCOPE.

11. **(gap-fill) NFR47 non-regression.** This story does not touch `.roomodes`, `fileRegex`, Roo Code modes, or any application-layer file restriction surface. Verified by asserting the generated `.roomodes` after a Story 21.7 install has the same `groups` / `fileRegex` patterns as a Story 21.6 install (content diff only in persona customize files under `_bmad/_config/agents/`).

12. **(gap-fill) NFR18 non-regression.** This story does not touch `opencode.json` or any JSON-merge surface. Verified by asserting `opencode.json::instructions[]` length and content are identical between a Story 21.6 and Story 21.7 install (this story's deliverable is orthogonal to the OpenCode injection path).

> **Resolved (persona source files — `bmm-analyst` and `bmm-quick-flow-solo-dev`).** The epic lists `bmm-analyst` (Mary) in AC #1 and `bmm-quick-flow-solo-dev` (Barry) in AC #2, but `ls lib/bmad-customize/` (verified 2026-04-15) shows neither file. Existing files are: `bmm-architect`, `bmm-bmad-master`, `bmm-dev`, `bmm-pm`, `bmm-qa`, `bmm-sm`, `bmm-tech-writer`, `bmm-ux-designer`.
>
> **Decision:** Create both missing authoring files as part of this story (Tasks 2.8 and 2.9, unconditional). The authoring shape is trivial (~5 lines matching `bmm-pm.customize.yaml` / `bmm-dev.customize.yaml`) and the epic explicitly enumerates these personas in AC #1 and AC #2, so deferring to a follow-up would leave the epic's AC operationally incomplete. New files: `lib/bmad-customize/bmm-analyst.customize.yaml` (planning) and `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` (implementation), each carrying the standard `critical_actions` block plus `phase` + `on_prem_phase_prefix`.

## Tasks / Subtasks

- [ ] **Task 1: Upstream loader probe + branch decision** (AC #6)
  - [ ] 1.1 Read the `bmad-method` upstream customize-loader source (node_modules path under `bmad-method/...`) — locate the YAML-parse call and inspect whether unknown top-level keys throw or are silently dropped.
  - [ ] 1.2 Author a throwaway YAML with `phase: planning` and `on_prem_phase_prefix: "test"` and run the recompile step (`lib/bmad.js` STAGE:CUSTOMIZE path) in a sandbox tmp project. Observe outcome.
  - [ ] 1.3 Record decision (Branch A — lenient, or Branch B — strict) in this file's Change Log with a one-line justification. Do NOT check the probe into committed code.
  - [ ] 1.4 If Branch B: design the dual-variant emission helper (see Task 3B). If Branch A: design the post-deploy rewrite helper (see Task 3A).

- [ ] **Task 2: Author persona customize.yaml updates** (AC #1, #2, #4, #10)
  - [ ] 2.1 Modify `lib/bmad-customize/bmm-pm.customize.yaml` — add `phase: planning` and `on_prem_phase_prefix: "<planning prefix text>"` top-level fields. Leave `critical_actions` untouched.
  - [ ] 2.2 Modify `lib/bmad-customize/bmm-architect.customize.yaml` — same shape, planning.
  - [ ] 2.3 Modify `lib/bmad-customize/bmm-sm.customize.yaml` — same shape, planning.
  - [ ] 2.4 Modify `lib/bmad-customize/bmm-tech-writer.customize.yaml` — same shape, planning.
  - [ ] 2.5 Modify `lib/bmad-customize/bmm-ux-designer.customize.yaml` — same shape, planning.
  - [ ] 2.6 Modify `lib/bmad-customize/bmm-qa.customize.yaml` — same shape, planning.
  - [ ] 2.7 Modify `lib/bmad-customize/bmm-dev.customize.yaml` — add `phase: implementation` and `on_prem_phase_prefix: "<implementation prefix text>"`.
  - [ ] 2.8 Create `lib/bmad-customize/bmm-analyst.customize.yaml` (new) with the standard `critical_actions` block mirroring `bmm-pm.customize.yaml`, plus `phase: planning` and `on_prem_phase_prefix: "<planning prefix text>"`.
  - [ ] 2.9 Create `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` (new) with the standard `critical_actions` block mirroring `bmm-dev.customize.yaml`, plus `phase: implementation` and `on_prem_phase_prefix: "<implementation prefix text>"`.
  - [ ] 2.10 Ensure every edited file ends with a single trailing newline and has no trailing whitespace (idempotency — AC #8).

- [ ] **Task 3A: Branch A implementation — post-deploy rewrite helper** (AC #6, #7, #9, #10)
  - [ ] 3A.1 Add a helper function to `lib/bmad.js` (new function, name TBD by implementing dev, e.g., `applyOnPremPhasePrefix(configTargetDir, projectRoot)`), invoked AFTER the STAGE:CUSTOMIZE file copy (currently `lib/bmad.js` line ~414) and ONLY when `require('./profile').getProfile(projectRoot) === 'on-prem'`.
  - [ ] 3A.2 The helper iterates `configTargetDir/*.customize.yaml`, parses each, and for files with a non-empty `on_prem_phase_prefix`, prepends the prefix as the first `critical_actions` entry. It then strips the `phase` and `on_prem_phase_prefix` top-level keys from the deployed file (keeping the authoring source unchanged).
  - [ ] 3A.3 For standard-profile installs, the helper is not called — but the STAGE:CUSTOMIZE copy must still strip the `phase` and `on_prem_phase_prefix` keys from the deployed files to satisfy AC #9's byte-identity guarantee against the pre-Epic-21 baseline. Implement this as a profile-agnostic sibling step (strip-only) that runs before the on-prem helper.

- [ ] **Task 3B: Branch B implementation — dual-variant emission helper** (AC #6, #7, #9, #10)
  - [ ] 3B.1 Add a helper function to `lib/bmad.js` (name TBD, e.g., `emitProfiledCustomizeVariants(customizeSource, configTargetDir, profile)`), invoked during STAGE:CUSTOMIZE (`lib/bmad.js` line ~410-418) REPLACING the current `fs.copy` loop for files that contain the new keys.
  - [ ] 3B.2 For each `<persona>.customize.yaml` in `lib/bmad-customize/`: parse, and emit ONE file to `configTargetDir/<persona>.customize.yaml`. The emitted file content depends on the `profile` argument: on-prem variant has the prefix inlined into `critical_actions[0]`; standard variant omits it. Both variants strip the `phase` and `on_prem_phase_prefix` keys.
  - [ ] 3B.3 Files that do NOT contain the new keys are copied unchanged by the existing loop (back-compat with AC #10).

- [ ] **Task 4: Deploy-path profile wiring** (AC #3, #6)
  - [ ] 4.1 In `lib/bmad.js`, at the point just before STAGE:CUSTOMIZE, resolve `const profile = require('./profile').getProfile(projectRoot) ?? 'standard';` and pass it to the Task 3A or 3B helper.
  - [ ] 4.2 Confirm the `projectRoot` value is the same one used elsewhere in `lib/bmad.js` (existing param, no new arg threading beyond the helper call).

- [ ] **Task 5: Tests** — see Testing section below.

- [ ] **Task 6: Documentation touch-up**
  - [ ] 6.1 No new docs in this story (Story 21.8 owns the on-prem README section). If an existing `lib/bmad-customize/README.md` (none verified) or equivalent documents the customize.yaml schema, append a paragraph describing the two new optional fields.

## Dev Notes

### Architecture compliance

- **Decision P3-3 (Local-LLM / On-Prem Agent Tuning Profile)** — Story 21.7 delivers the persona-level system-prompt-prefix surface. This is a SEPARATE composition surface from the per-tool instruction injection (Stories 21.2–21.6, which flow through `composeInstructionBlock`). Per Story 21.6 Dev Notes Out-of-Scope list, persona prefixes ship here in 21.7 exclusively.

- **NFR44 (profile isolation / standard-profile byte-identity)** — Epic cross-reference at `_bmad-output/planning-artifacts/epics.md:4095` reads: "profile=standard → NO phase prefix is prepended (NFR44 — standard profile is byte-identical to pre-Epic-21 baseline for customize output)". AC #3 and AC #9 are the contracts; Testing section 7.4 and 7.6 enforce.

- **NFR46 (idempotency)** — `epics.md:263` and `epics.md:4144` item (c). AC #8 is the contract; Testing 7.8 enforces. Branch choice (A or B) does not affect idempotency: both branches are deterministic (no timestamps, no env-dependent content).

- **NFR47 (Roo Code application-layer `fileRegex` enforcement)** — Not touched by this story. AC #11 is a non-regression guard. Story 21.9 owns the comprehensive cross-tool assertion; this story adds a minimal unit assertion via Testing 7.10.

- **NFR18 (additive JSON-merge for OpenCode)** — Not touched. AC #12 is a non-regression guard. Testing 7.11 is a thin guard; Story 21.9 owns cross-tool coverage.

### BMAD built-in override policy — MANDATORY

Per user's durable memory (`BMAD built-in override policy — Override via extension, never upstream PRs to bmad-method`), this story's implementation MUST NOT submit changes to the `bmad-method` repository. The customize-loader is upstream. All on-prem-specific behavior introduced here lives in **ma-agents** code (`lib/bmad.js` helpers, `lib/bmad-customize/*.customize.yaml` artifacts). The Task 1 probe is READ-ONLY against upstream; do not touch upstream sources.

Source locations to edit (per user's durable memory `Skill source locations — Never edit .claude/skills/; edit lib/bmad-extension/skills/ or skills/ instead`):
- YAML authoring: `lib/bmad-customize/<persona>.customize.yaml` (existing ma-agents-owned — edit here).
- Helper code: `lib/bmad.js` STAGE:CUSTOMIZE region (line ~406-418).
- DO NOT edit `.claude/skills/` (derived output).
- DO NOT edit anything under `bmad-method` / upstream.

### Notes on Customize-Loader Discovery (Two-Branch Decision)

Per the Epic 21 cross-epic note at `_bmad-output/planning-artifacts/epics.md:4231`:

> **Customize-loader (Epic 15) prerequisite — STATUS: clarified.** Story 21.7 was originally scoped as if ma-agents owned a customize-loader. On audit (2026-04-14), `lib/bmad-customize/` contains only `*.customize.yaml` artifacts — the loader itself lives upstream in BMAD. Per the project's durable policy of overriding BMAD built-ins via extension rather than upstream PRs, Story 21.7's `phase: mixed` enum extension (added in corrective-plan step 3) will be implemented via the extension pattern: the `*.customize.yaml` files gain the `phase` field and, if BMAD's upstream loader rejects unknown values, the ma-agents extension intercepts the YAML at install time and produces two variants (`*.customize.yaml` and `*.customize.on-prem.yaml`) with the installer choosing based on the persisted profile. See Story 21.7 Dev Notes "Notes on Customize-Loader Discovery" for the decision branches the implementing dev will resolve during Task 1.

**Decision branches (to be resolved in Task 1 by the implementing dev — DO NOT pre-commit to either branch):**

- **Branch A — upstream accepts unknown `phase:` / `on_prem_phase_prefix:` keys.** The extension path is a post-deploy rewrite step inside `lib/bmad.js` STAGE:CUSTOMIZE. `lib/bmad-customize/<persona>.customize.yaml` carries the new keys as-is; they travel into `_bmad/_config/agents/` via the existing copy; the post-deploy helper then rewrites on-prem-profile files in place to inline the prefix and strip the extra keys.

- **Branch B — upstream rejects unknown keys (strict schema, raises on load).** The extension path is a dual-variant expansion step that REPLACES the current `fs.copy` loop. `lib/bmad-customize/<persona>.customize.yaml` remains the single authoring file in ma-agents; at deploy time, the helper parses it, decides based on `getProfile(projectRoot)` whether to inline the on-prem prefix, and writes ONE `.customize.yaml` to `_bmad/_config/agents/` with the new keys STRIPPED. The "two variants" framing in epics.md:4231 refers to the two possible OUTPUTS of this helper, not two on-disk source files — there is still exactly one authoring file per persona.

The implementing dev MUST probe upstream (Task 1.1–1.2), pick a branch, record the decision in the Change Log, and implement ONE path. Both branches must produce byte-identical deployed output in standard-profile installs (AC #9). The choice affects WHERE the conditional lives, not WHAT ends up on disk.

### Verified source-tree surface

| File | Exists? | Role in this story |
|------|---------|--------------------|
| `lib/profile.js` | verified (Story 21.1 — `D:\Code\agents\lib\profile.js` lines 29-43) | Read-only — `getProfile(projectRoot)` consumed by the Task 3 helper |
| `lib/bmad.js` | verified (`D:\Code\agents\lib\bmad.js`) | MODIFY — add Task 3 helper; wire it in STAGE:CUSTOMIZE (line ~406-418) |
| `lib/bmad-customize/bmm-pm.customize.yaml` | verified | MODIFY — add `phase: planning` + `on_prem_phase_prefix` |
| `lib/bmad-customize/bmm-architect.customize.yaml` | verified | MODIFY — same |
| `lib/bmad-customize/bmm-sm.customize.yaml` | verified | MODIFY — same |
| `lib/bmad-customize/bmm-tech-writer.customize.yaml` | verified | MODIFY — same |
| `lib/bmad-customize/bmm-ux-designer.customize.yaml` | verified | MODIFY — same |
| `lib/bmad-customize/bmm-qa.customize.yaml` | verified | MODIFY — same |
| `lib/bmad-customize/bmm-dev.customize.yaml` | verified | MODIFY — `phase: implementation` |
| `lib/bmad-customize/bmm-analyst.customize.yaml` | (new) — does NOT exist today | CREATE (Task 2.8 / 2.9 — unconditional per Change Log 2026-04-15 resolution) |
| `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` | (new) — does NOT exist today | CREATE (Task 2.8 / 2.9 — unconditional per Change Log 2026-04-15 resolution) |
| `lib/bmad-customize/bmm-bmad-master.customize.yaml` | verified | UNCHANGED — out of scope (AC #10) |
| `lib/bmad-customizations/*.customize.yaml` | verified (IDE-agent customizations) | UNCHANGED — out of scope (AC #10) |
| `lib/installer.js` | verified | UNCHANGED — this story does not touch the per-tool injection path |
| `lib/agents.js` | verified | UNCHANGED — read-only reference for persona enumeration if needed |
| `test/bmad-persona-phase-prefix.test.js` | (new) | CREATE — unit + integration coverage per Testing section |
| `docs/` | (no doc change required in this story) | Story 21.8 owns the on-prem README/docs surface |

### Library and pattern references

- **Profile resolution:** `require('./profile').getProfile(projectRoot)` — exact same call as Stories 21.2–21.6 use via `composeInstructionBlock`. See `D:\Code\agents\lib\profile.js:29-43`.
- **YAML parsing in `lib/bmad.js`:** `lib/bmad.js` at line ~885 already has `parseCustomizeYaml` referenced and a backup/restore flow in lines ~802-865 that parses customize.yaml files — the Task 3 helper should REUSE that existing parser rather than introduce a second YAML dependency.
- **STAGE:CUSTOMIZE invocation point:** `lib/bmad.js:406-418` is the canonical place to hook the Task 3 helper. Preserve the existing console.log output for unmodified personas.
- **Test framework:** node's built-in test runner + `os.tmpdir()` + `fs.mkdtempSync` per-test (mirror `test/profile.test.js` — Story 21.1 pattern).

### NFR citations (explicit)

- **NFR44** — epics.md:261 ("On-prem profile guardrails must not regress standard profile — when profile=standard, no on-prem-specific instructions appear in any generated file"). Story 21.7 contract: AC #3, AC #9.
- **NFR46** — epics.md:263 ("Per-tool template stamping is idempotent — re-running install with the same profile produces byte-identical content within marker blocks"). Extended to customize output under AC #8.
- **NFR47** — epics.md:264 ("BMAD planning-mode file restrictions in `.roomodes` enforced at the application layer (Roo Code `FileRestrictionError`)"). Non-regression only: AC #11.
- **NFR18** — epics.md:223 ("OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — additive-only"). Non-regression only: AC #12.

### Persona prefix text — authoring guidance (not prescriptive)

The epic intentionally leaves the exact wording to the implementing dev. Seeds from the epic (AC #1 / AC #2 wording):

- Planning: `"/no_think  You are in a planning phase — respond in text for questions; create files only when explicitly asked."` (adjust wording; `/no_think` token MUST appear verbatim per the on-prem-only signal used for NFR44 assertions in Story 21.6).
- Implementation: `"Think carefully before writing code. Always reference the story you are implementing before making edits."` (no `/no_think`; reasoning ON is the implementation default per epic AC #2 and the vLLM guidance in Story 21.8).

## Dependencies

### Upstream (blocking)

- **Story 21.1 (done)** — `lib/profile.js::getProfile(projectRoot)` is the input. Verified at `lib/profile.js:29-43`. No API change requested.

### Upstream (recommended sequencing — not strictly blocking)

- **Story 21.6 (Ready)** — Persona prefix content references the same `/no_think` token that Story 21.6 stamps into the per-tool templates. Shipping 21.7 BEFORE 21.6 is safe; shipping them adjacent is preferred so on-prem installs get a consistent `/no_think` signal in both the per-tool rules and the persona system prompts. Per epic execution order (`sprint-status.yaml:113`: `21.1 → 21.2 → (21.3 + 21.4 + 21.5 in parallel) → 21.6 → 21.10 → 21.7 → 21.8 → 21.9 → 21.11`), Story 21.7 is scheduled AFTER 21.6 and 21.10.

### Downstream (consumers of this story's surface)

- **Story 21.8** — vLLM deployment doc + README on-prem section. Documents the `/no_think` per-phase sampling guidance that maps 1:1 to this story's persona prefix dichotomy. Recommend a content-consistency test: the prefix text authored here should align with the per-phase sampling table in `docs/deployment/vllm-nemotron.md` (new, Story 21.8).
- **Story 21.9** — Integration tests covering (a) standard profile produces NO on-prem-specific strings across every surface INCLUDING `_bmad/_config/agents/*.customize.yaml`, (b) on-prem produces the prefix in every planning persona. Testing section 7.3–7.5 of this story are unit-level subsets; Story 21.9 adds cross-surface integration.
- **Story 21.10 (Profile Reconfigure)** — Re-stamps profile-dependent artifacts on profile flip. The Task 3 helper (Branch A or B) MUST be re-invokable cleanly on reconfigure. Idempotency AC #8 covers this implicitly.
- **Story 21.11 (Profile Uninstall)** — On `uninstall --profile-artifacts`, the on-prem prefix content in `_bmad/_config/agents/*.customize.yaml` must be removable. If Branch A is chosen, uninstall re-runs the STAGE:CUSTOMIZE copy (restoring the standard variant). If Branch B is chosen, same — uninstall emits the standard variant. Covered by Story 21.11's scope, not this story.

## Testing

**Framework and isolation:** Match `test/profile.test.js` (Story 21.1) — node's built-in test runner, `os.tmpdir()` + `fs.mkdtempSync` per-test tmp project root, never mutate the repo's own `lib/bmad-customize/` files. Use `setProfile(tmpRoot, 'standard' | 'on-prem')` from the real `lib/profile.js`. Do NOT stub `lib/bmad.js`; exercise the real STAGE:CUSTOMIZE path against a tmp project.

New test file: `test/bmad-persona-phase-prefix.test.js` (new).

**Unit tests:**

- 7.1 `lib/bmad-customize/bmm-pm.customize.yaml` contains `phase: planning` and a non-empty `on_prem_phase_prefix` string. Repeat for each persona in AC #1 (7 tests) + AC #2 (2 tests, conditional on Open-question resolution).
- 7.2 Each planning persona's `on_prem_phase_prefix` contains the literal `/no_think` token (AC #1).
- 7.3 Each implementation persona's `on_prem_phase_prefix` does NOT contain `/no_think` (AC #2 — reasoning ON).
- 7.4 Task 3 helper (Branch A or B — whichever is chosen): given `profile === 'standard'`, the deployed file contains NO `/no_think`, NO `phase:` key, NO `on_prem_phase_prefix:` key (AC #3, AC #9).
- 7.5 Task 3 helper: given `profile === 'on-prem'`, the deployed file's `critical_actions[0]` contains the authored prefix text, `phase:` / `on_prem_phase_prefix:` keys are stripped, and all pre-existing `critical_actions` entries are preserved in order (AC #7).

**Integration tests (within this story — cross-surface lives in 21.9):**

- 7.6 End-to-end standard-profile install against a tmp project (via the public `lib/bmad.js` install entry point): deployed `_bmad/_config/agents/bmm-pm.customize.yaml` is byte-identical to the same file deployed without Epic 21 (use a snapshot golden file captured from pre-Epic-21 HEAD). Repeat for each persona in AC #1 (7 assertions).
- 7.7 End-to-end on-prem install: deployed `_bmad/_config/agents/bmm-pm.customize.yaml` has the on-prem prefix as the first entry in `critical_actions`. Repeat for each persona.
- 7.8 Idempotency (AC #8 / NFR46): two consecutive on-prem installs produce byte-identical deployed files for every persona.
- 7.9 Profile-switch is OUT OF SCOPE here — do not test standard→on-prem flip (Story 21.10).
- 7.10 NFR47 non-regression (AC #11): after an on-prem install, `.roomodes` byte-identity with a Story 21.6-only install (diff current install's `.roomodes` against a snapshot captured before Task 3 runs). Thin assertion — Story 21.9 owns the comprehensive version.
- 7.11 NFR18 non-regression (AC #12): `opencode.json::instructions[]` is untouched by an on-prem-with-21.7 install versus a baseline 21.6 install.

**Test data isolation:** Every test uses `fs.mkdtempSync(path.join(os.tmpdir(), 'ma-21-7-'))` for the project root. Use real `lib/bmad-customize/` on disk (do NOT stub YAML parsing). Clean up tmp dirs in a `t.after`. Capture pre-Epic-21 golden files via `git show <pre-Epic-21-sha>:lib/bmad-customize/<file>` into `test/fixtures/21-7/` (new fixtures dir).

**Coverage note:** Story 21.9 adds the cross-tool integration (standard-profile NFR44 absence of `/no_think` across EVERY generated surface including `_bmad/_config/agents/`). Do not duplicate that here. This story's tests are scoped to the persona-customize surface.

## Out of Scope

- Universal per-tool instruction block (Story 21.2 — `composeInstructionBlock`).
- Per-tool on-prem layered guardrails (Story 21.6 — `instruction-block-onprem.template.md`, `.roomodes` / `AGENTS.md` / `.clinerules` injection).
- `.roomodes` authorship and `fileRegex` restrictions (Story 21.3 — not touched here).
- `AGENTS.md` authorship (Story 21.4 — not touched here).
- `.clinerules` authorship (Story 21.5 — not touched here).
- vLLM deployment documentation and README on-prem section (Story 21.8).
- Cross-tool NFR44/NFR46 integration tests (Story 21.9 — this story's tests scope to persona customize surface only).
- Profile-reconfigure flow (Story 21.10 — re-stamping on profile flip).
- Profile-uninstall flow (Story 21.11 — removing on-prem prefixes on uninstall).
- `phase: mixed` enum value (see Open question under AC #5 — follow-up story).
- Other persona files in `lib/bmad-customize/` not enumerated in AC #1 / AC #2 (e.g., `bmm-bmad-master`) and ALL IDE-agent customizations in `lib/bmad-customizations/*.customize.yaml` (AC #10).
- Any modification to upstream `bmad-method` source — prohibited by BMAD built-in override policy.
- `.claude/skills/` edits — prohibited per user's durable memory.
- Manifest version bump — already at 1.2.0 (Story 21.1).

## Change Log

- 2026-04-15: Story created (Epic 21, Story 21.7). ACs refined with explicit (gap-fill) flags where the epic required operationalization. Three Open questions raised inline rather than pre-resolved: (a) `phase: mixed` enum extension, (b) upstream loader two-branch decision (lenient Branch A vs strict Branch B — per epics.md:4231 the implementing dev probes upstream in Task 1), (c) missing `bmm-analyst` and `bmm-quick-flow-solo-dev` authoring files. NFR44/NFR46/NFR47/NFR18 citations explicit in Dev Notes. Verified source-tree surface table distinguishes existing vs (new) paths. Dependencies split upstream/downstream. Testing section covers unit (7.1–7.5) and integration (7.6–7.11). Status set to Ready.
- 2026-04-15 (adversarial-review resolution): Closed P1 #6 — Tasks 2.8/2.9 conditional phrasing removed. Decision: create `lib/bmad-customize/bmm-analyst.customize.yaml` and `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` unconditionally within this story (option a). Rationale: verified `ls lib/bmad-customize/` — neither file exists, but authoring shape is trivial (mirrors `bmm-pm` / `bmm-dev`) so creation is not blocked. Open question block for persona source files converted to a Resolved block referencing the decision. Epic 15 customize-loader two-branch Open Question (AC #6) retained as-is — genuine upstream probe per epics.md:4231. Canonical terminology (composer/merger/stamper) audited — no "injection function" / "marker-injection" occurrences present in this file, so no terminology replacements required. All Tasks now unconditional; Status remains Ready.
