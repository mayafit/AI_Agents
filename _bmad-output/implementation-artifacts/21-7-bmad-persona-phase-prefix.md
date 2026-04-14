# Story 21.7: BMAD Persona Phase-Aware Prompt Prefix (On-Prem Only)

Status: backlog

## Story

As an **engineer running an on-prem install with the BMAD module**,
I want each BMAD agent persona to receive a phase-aware system-prompt prefix steering its reasoning mode appropriately,
So that planning agents (PM, Architect, SM) stop overthinking and producing files for discussion prompts, and implementation agents (Dev) keep their reasoning mode for careful coding.

## Acceptance Criteria

1. Each `lib/bmad-customize/*.customize.yaml` file gains an optional `phase: planning|implementation` field. Initial classification:
   - **Planning** (reasoning-OFF prefix): `bmm-pm` (John), `bmm-architect` (Winston), `bmm-sm` (Bob), `bmm-analyst` (Mary), `bmm-tech-writer` (Paige), `bmm-ux-designer` (Sally), `bmm-qa` (Gad)
   - **Implementation** (reasoning-ON prefix): `bmm-dev` (Amelia), `bmm-quick-flow-solo-dev` (Barry)
2. Each `*.customize.yaml` file gains an optional `on_prem_phase_prefix:` field containing the prefix text. The values are populated for every agent listed in AC #1; the field is absent for any agent that does not need a prefix.
3. The BMAD customize-loader (location to be determined during Task 1 exploration — likely `lib/bmad.js` or a dedicated customize module) reads `getProfile(projectRoot)` from `lib/profile.js` and:
   - When profile=on-prem AND `on_prem_phase_prefix` is set, prepends the prefix to the persona's existing `critical_actions` / system-prompt content
   - When profile=standard OR `on_prem_phase_prefix` is absent, does NOT prepend anything (output identical to pre-Story-21.7 behavior)
4. NFR44 verification: with profile=standard, the rendered `.customize.yaml` consumption produces output byte-identical to the pre-Story-21.7 baseline for every agent. Captured by snapshot tests.
5. The phase prefix content for planning agents includes:
   - A `/no_think` directive at the top
   - "When the user asks a question or for an opinion, respond in TEXT in the chat. Do NOT create files."
   - "You are a planning-phase agent. Do NOT skip ahead to implementation."
6. The phase prefix content for implementation agents includes:
   - "Think carefully about the implementation before writing code."
   - "Reference the story or spec you are implementing before starting."
   - "When asked a question, respond in text. Do not start coding unless asked."
7. The customize-loader's prefix composition is idempotent — running the loader twice produces the same composed content (NFR46).
8. **Phase enum extended to `{planning | implementation | mixed}` with persona reassignment (supersedes AC #1).** The `phase` field in each `*.customize.yaml` now accepts the value `mixed` in addition to `planning` and `implementation`. Final per-persona assignment is:
   - **`phase: planning`** — `bmm-pm` (John), `bmm-architect` (Winston), `bmm-ux-designer` (Sally), `bmm-tech-writer` (Paige)
   - **`phase: implementation`** — `bmm-dev` (Amelia), `bmm-quick-flow-solo-dev` (Barry)
   - **`phase: mixed`** — `bmm-sm` (Bob), `bmm-qa` (Gad), `bmm-analyst` (Mary)
   This supersedes AC #1's binary classification (which listed Bob, Gad, and Mary under `planning` and Paige under `planning`). The reason: Bob and Gad straddle planning conversations and story-file edits; Mary moves between research discussion and brief edits. A binary classification mislabels them and forces the wrong phase prefix. Each `*.customize.yaml` file must encode the `phase` value per this list.
9. **Composite prefix for `phase: mixed`.** Personas with `phase: mixed` receive the following composite preamble as their `on_prem_phase_prefix` value (in addition to any persona-specific content): `"This persona handles both discussion and editing. Default to text responses when asked questions; only create or edit files when explicitly asked (verbs: create, write, generate, update, edit). When editing code, reason carefully; when discussing, keep responses concise without deep reasoning chains."` The customize-loader composes this prefix when profile=on-prem AND `phase: mixed`, parallel to the planning/implementation branches in AC #5/#6.
10. **Customize-loader validator must accept `mixed`.** The Epic 15 customize-loader schema validation (wherever it lives — see Dev Notes) must recognize `mixed` as a valid `phase` value. If the current loader validator only accepts `{planning, implementation}`, a prerequisite sub-task is to extend the validator enum. This AC is satisfied when: (a) the validator accepts all three values without error, and (b) a `*.customize.yaml` file with `phase: mixed` is loaded successfully in a unit test.

## Tasks / Subtasks

- [ ] Task 1: Locate the customize-loader code path (`lib/bmad.js`, `lib/bmad-customize/`, or a dedicated module). Document file:line in Dev Agent Record. Confirm where `critical_actions` are composed for each persona.
- [ ] Task 2: Add `phase` and `on_prem_phase_prefix` fields to the 9 affected `*.customize.yaml` files (AC #1, #2, #5, #6)
  - Planning-phase content: shared text block defined once (e.g., in a comment-marked region) and pasted into each planning persona's YAML
  - Implementation-phase content: same approach, pasted into the 2 implementation personas
- [ ] Task 3: Extend the customize-loader to compose the prefix when `getProfile(projectRoot) === 'on-prem'` and the YAML has `on_prem_phase_prefix` (AC #3, #7)
- [ ] Task 4: Snapshot-test baseline parity (AC #4)
  - [ ] 4.1 Capture pre-Story-21.7 customize-loader output for all 11 BMAD agents (run before changes; commit snapshots to `test/snapshots/customize/`)
  - [ ] 4.2 With profile=standard after Story 21.7 changes, customize-loader output matches snapshots byte-for-byte
- [ ] Task 5: Tests in `test/bmad-persona-phase-prefix.test.js`
  - [ ] 5.1 Profile=on-prem: planning agents get `/no_think` + text-response prefix prepended
  - [ ] 5.2 Profile=on-prem: implementation agents get careful-implementation prefix prepended
  - [ ] 5.3 Profile=standard: no prefix prepended for any agent (snapshot match — AC #4)
  - [ ] 5.4 Profile=on-prem with agent missing `on_prem_phase_prefix`: no prefix, no error
  - [ ] 5.5 Idempotency: two loader runs produce identical composed content (NFR46)
- [ ] Task 6: Phase enum extension and persona reassignment (AC #8, #9, #10)
  - [ ] 6.1 Reassign `phase` values per AC #8: Bob, Gad, Mary → `mixed`; Paige stays `planning`; others unchanged
  - [ ] 6.2 Populate `on_prem_phase_prefix` for the three `mixed` personas with the composite preamble in AC #9 (plus any persona-specific tail)
  - [ ] 6.3 PREREQUISITE: audit the Epic 15 customize-loader schema validator — if it enforces enum `{planning, implementation}`, extend it to `{planning, implementation, mixed}`. If the validator lives outside this story's scope, raise an Epic 15 issue/story and document the blocker in Dev Agent Record before proceeding
  - [ ] 6.4 Tests: (a) profile=on-prem + `phase: mixed` → composite prefix prepended; (b) validator accepts all three enum values

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — BMAD persona phase prefix is the on-prem-only layer that complements per-tool guardrails. Inactive on standard profile.
- **NFR44** — Standard profile customize output unchanged. Snapshot tests are the contract.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/bmad-customize/bmm-pm.customize.yaml` | MODIFY — add `phase: planning`, `on_prem_phase_prefix:` |
| `lib/bmad-customize/bmm-architect.customize.yaml` | MODIFY — same |
| `lib/bmad-customize/bmm-sm.customize.yaml` | MODIFY — same |
| `lib/bmad-customize/bmm-analyst.customize.yaml` | MODIFY — same |
| `lib/bmad-customize/bmm-tech-writer.customize.yaml` | MODIFY — same |
| `lib/bmad-customize/bmm-ux-designer.customize.yaml` | MODIFY — same |
| `lib/bmad-customize/bmm-qa.customize.yaml` | MODIFY — same (Gad — verify file name from Epic 20 SQA work) |
| `lib/bmad-customize/bmm-dev.customize.yaml` | MODIFY — `phase: implementation`, prefix |
| `lib/bmad-customize/bmm-quick-flow-solo-dev.customize.yaml` | MODIFY — same |
| `lib/bmad.js` (or customize-loader location) | MODIFY — profile-conditional prefix composition |
| `test/bmad-persona-phase-prefix.test.js` | CREATE |
| `test/snapshots/customize/*.snapshot` | CREATE — pre-change baselines for NFR44 verification |

### Dependencies

- Story 21.1 (`getProfile` API)
- Epic 15 (BMAD 6.2.1 module restructure — customize-loader infrastructure may have changed)

### Out of Scope

- Per-tool template content (Stories 21.2–21.6)
- vLLM serving doc (Story 21.8)
- Customize-loader refactoring beyond what's needed for prefix composition

### Notes on Phase Enum Extension (Epic 15 Prerequisite)

AC #10 requires the Epic 15 customize-loader schema validator to accept `mixed` as a valid `phase` value. During Task 1's loader-discovery pass, verify whether a validator is in place and what enum it enforces. Three outcomes:

1. **No validator present** — `phase` is a free-form string today; AC #10 is trivially satisfied. Document this in Dev Agent Record.
2. **Validator present and accepts `mixed` already** — no change needed; satisfy AC #10 with a regression test.
3. **Validator present and rejects `mixed`** — extend the enum to `{planning, implementation, mixed}`. If the validator is owned by Epic 15 code outside this story's change scope, raise an Epic 15 issue/story as a prerequisite and block Task 6 until it lands. Document explicitly rather than letting the dev hit this at implementation time.

### Notes on Customize-Loader Discovery

If the loader is implicit (BMAD itself reads `*.customize.yaml` directly with no ma-agents intermediation), this story's design may need adjustment. In that case, the prefix must be embedded directly into the YAML's existing `critical_actions` block under a profile-aware key, OR ma-agents must intercept the file at install time and produce two variants (`*.customize.yaml` for standard, `*.customize.on-prem.yaml` for on-prem) with the installer choosing which to deploy. Decide during Task 1 and document the chosen approach.

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
- 2026-04-14: Story created (Epic 21, Story 21.7)
- 2026-04-14: Extended phase enum to `{planning, implementation, mixed}` via new ACs #8, #9, #10 (Finding #11, corrective plan step 3). Reassigned SM Bob, SQA Gad, Analyst Mary to `mixed`. AC #1's binary classification is SUPERSEDED by AC #8 but left in place to preserve the historical decision trail. Added Epic 15 validator-extension prerequisite note to Dev Notes.
