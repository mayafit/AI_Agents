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
