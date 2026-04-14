# Story 21.6: On-Prem Layered Guardrails

Status: backlog

## Story

As an **engineer running an on-prem install**,
I want the installer to layer local-LLM-specific guardrails on top of the universal block when profile=on-prem,
So that Nemotron and other local LLMs stop hallucinating `str_replace_editor`, dumping files into `~/.claude/`, and overthinking planning prompts.

## Acceptance Criteria

1. New template `lib/templates/instruction-block-onprem.template.md` exists containing:
   - A `/no_think` reasoning-OFF directive (as a literal line at the top of the on-prem block) intended for planning-phase use
   - A "NEVER create files in `~/.claude/` or any user home directory; all files go under the project directory" rule
   - A "do NOT reference or use `str_replace_editor` or any Claude Code-specific tool that may not exist in this agent" rule
   - Reasoning-mode and sampling guidance per BMAD phase (planning: reasoning OFF, low temperature; implementation: reasoning ON, moderate temperature) — guidance text only, not enforced
2. `composeInstructionBlock({ profile: 'on-prem', manifestPath })` (Story 21.2) appends this template's content within the same `<!-- MA-AGENTS-START -->` markers, after the universal content.
3. `composeInstructionBlock({ profile: 'standard', manifestPath })` does NOT include any on-prem content. Verified by absence of the strings `/no_think`, `str_replace_editor`, `~/.claude/` in the standard-profile output (NFR44).
4. The `.roomodes` template (Story 21.3) gains profile-conditional `customInstructions` content per mode:
   - When profile=on-prem, each BMAD mode's `customInstructions` block gets appended with the on-prem rules (no-home-dir-writes, no `str_replace_editor`)
   - When profile=standard, no on-prem content appears in `customInstructions`
5. The `AGENTS.md` template (Story 21.4) gains the same profile-conditional treatment within its marker block.
6. The `.clinerules` template (Story 21.5) gains the same profile-conditional treatment within its marker block.
7. Re-running install with profile=on-prem produces byte-identical content in all three files (`.roomodes`, `AGENTS.md`, `.clinerules`/`.cline/clinerules.md`) for ma-agents-owned sections (NFR46).
8. Switching profile from standard to on-prem (via the Story 21.10 `reconfigure` command — no CLI flag) updates all marker-block content and `.roomodes` `customInstructions` to include the on-prem rules; switching back to standard removes them. User content outside markers/owned slugs is preserved. NOTE: Story 21.10 (Profile Reconfigure) is a separately-tracked new story in the corrective plan; until it lands, profile switching is done by hand-editing `.ma-agents.json`.
9. **Home-dir rule narrowed to forbid ad-hoc writes only (resolves scope-vs-rule contradiction).** The generated on-prem template content (per AC #1) must NOT contain a blanket prohibition against writes to `~/.claude/`. Instead, the rendered text must contain the narrowed phrasing (or semantic equivalent): `"Never create ad-hoc response or output files in the user home directory (~/.claude/, ~/Documents, etc.). The installer's own scoped writes to ~/.claude/ during --scope global are authorized and not covered by this rule."` Verified by grep on rendered on-prem output: presence of `Never create ad-hoc` and `installer's own scoped writes` substrings; absence of the older blanket `"NEVER create files in ~/.claude/"` phrasing. Rationale: `npx ma-agents install --scope global` legitimately writes ma-agents config under `~/.claude/`, and the previous rule phrasing contradicted a supported install mode.
10. **Informational log for on-prem + `--scope global` combination.** When profile=on-prem AND `--scope global` is selected at install time, the installer emits exactly the following informational log line (pinned verbatim for test assertion): `Note: on-prem profile with --scope global writes ma-agents config to ~/.claude/. This is authorized. The on-prem guardrail forbids ad-hoc files there, not the installer's scoped writes.` This line is emitted after profile resolution and before the first write under `~/.claude/`. Tests may `grep`/match on it.
11. **No numerical sampling guidance in prompt template (delegated to Story 21.8).** The rendered on-prem instruction block must NOT contain any numerical temperature/top_p values (e.g., no `temperature 0.0`, `top_p 1.0`, `temperature 0.6`, `top_p 0.95` — or any other numeric tuple) in the rendered on-prem output. Per-phase sampling numbers are a server-side concern and belong in the vLLM reference doc (Story 21.8), not in the agent prompt. The prompt may retain (a) the `/no_think` directive, which IS prompt-level and effective, and (b) qualitative textual guidance such as "use careful reasoning for implementation; skip deep reasoning for discussion." Verified by regex on rendered on-prem output: `/temperature\s*[0-9]|top[_-]?p\s*[0-9]/i` must not match. AC #1's bullet "Reasoning-mode and sampling guidance per BMAD phase (planning: reasoning OFF, low temperature; implementation: reasoning ON, moderate temperature) — guidance text only, not enforced" is narrowed by this AC: qualitative text is allowed ("low"/"moderate"); specific numbers are not.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/templates/instruction-block-onprem.template.md` per AC #1
- [ ] Task 2: Verify `composeInstructionBlock` (Story 21.2) loads on-prem content when present (AC #2, #3)
- [ ] Task 3: Extend `lib/templates/roomodes.template.yaml` (Story 21.3) with profile-conditional `customInstructions` per mode (AC #4)
  - [ ] 3.1 Decide implementation: separate template for on-prem `customInstructions` blocks, OR templating placeholders within the existing template that get conditionally stamped
  - [ ] 3.2 Update `mergeRoomodes` to compose conditional content based on profile
- [ ] Task 4: Extend `AGENTS.md` template stamping (Story 21.4) to append on-prem rules when profile=on-prem (AC #5)
- [ ] Task 5: Extend `.clinerules` template stamping (Story 21.5) to append on-prem rules when profile=on-prem (AC #6)
- [ ] Task 6: Profile switching (AC #8)
  - [ ] 6.1 Verify profile-switch to on-prem (via reconfigure path or manual `.ma-agents.json` edit) updates all three files correctly
  - [ ] 6.2 Verify profile-switch to standard (via reconfigure path or manual `.ma-agents.json` edit) removes on-prem content cleanly
- [ ] Task 7: Tests in `test/onprem-guardrails.test.js`
  - [ ] 7.1 Standard profile: no on-prem strings in any output (AC #3 — NFR44)
  - [ ] 7.2 On-prem profile: `/no_think`, no-home-dir, no-str_replace_editor present in all three files
  - [ ] 7.3 Idempotency: same profile, two installs → byte-identical output (AC #7 — NFR46)
  - [ ] 7.4 Profile switch standard→on-prem→standard restores original standard content
  - [ ] 7.5 User content outside markers preserved across switches
- [ ] Task 8: Narrow home-dir rule phrasing in `instruction-block-onprem.template.md` (AC #9)
  - [ ] 8.1 Replace any blanket `"NEVER create files in ~/.claude/"` phrasing with the narrowed "ad-hoc" phrasing from AC #9
  - [ ] 8.2 Test: grep rendered on-prem output for `Never create ad-hoc` present and blanket phrasing absent
- [ ] Task 9: Informational log for on-prem + `--scope global` (AC #10)
  - [ ] 9.1 After profile resolution, before first `~/.claude/` write, emit the pinned log line verbatim
  - [ ] 9.2 Test: install with `--profile on-prem-equivalent-persisted` + `--scope global` captures stdout and asserts the pinned line
- [ ] Task 10: Strip numerical sampling from on-prem template (AC #11, Finding #12-a)
  - [ ] 10.1 Review `instruction-block-onprem.template.md` for any `temperature <num>` / `top_p <num>` text; replace with qualitative phrasing only ("low"/"moderate") and keep `/no_think`
  - [ ] 10.2 Test: regex `/temperature\s*[0-9]|top[_-]?p\s*[0-9]/i` against rendered on-prem output returns no match

## Dev Notes

### Architecture Compliance

- **Decision P3-3** — On-prem layer ships here. Universal layer (Story 21.2) + on-prem layer (this story) compose to the full on-prem experience.
- **NFR44** — Standard profile must remain free of on-prem-specific output. Test 7.1 enforces.
- **NFR46** — Deterministic stamping for both profiles.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/templates/instruction-block-onprem.template.md` | CREATE |
| `lib/templates/roomodes.template.yaml` | MODIFY — add on-prem content (conditional or via parallel template) |
| `lib/installer.js` | MODIFY — profile-conditional stamping for `.roomodes`, `AGENTS.md`, `.clinerules` per-tool extensions |
| `lib/merge/roomodes.js` | MODIFY — accept profile arg, compose `customInstructions` accordingly |
| `test/onprem-guardrails.test.js` | CREATE |

### Dependencies

- Stories 21.1 through 21.5 (foundation + per-tool templates) all merged

### Reference

Source playbook:
- `/no_think` directive: Section 6.1, 6.8
- `str_replace_editor` warning: Section 2.5, 6.4
- No-home-dir rule: Section 1, 5.3
- Per-phase reasoning/sampling: Section 6.1, 8 (Sampling Parameters by Phase table)

### Out of Scope

- BMAD persona phase prefix in customize-loader (Story 21.7 — separate concern, edits `.customize.yaml` files)
- vLLM serving doc (Story 21.8)

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
- 2026-04-14: Story created (Epic 21, Story 21.6)
- 2026-04-14: Removed prescriptive `--profile=` flag references from AC #8 and Task 6 subitems (flag retired; profile switch is via Story 21.10 reconfigure command once delivered, or manual `.ma-agents.json` edit until then). Aligned with P0 spec-alignment PR #34.
- 2026-04-14: Added ACs #9 and #10 reconciling on-prem home-dir rule with `--scope global` (Finding #8, corrective plan step 3). Rule narrowed to forbid ad-hoc writes only; installer's scoped writes authorized. Informational log pinned verbatim for test assertion.
- 2026-04-14: Added AC #11 forbidding numerical temperature/top_p values in the on-prem instruction block (Finding #12-a, corrective plan step 3). Narrows AC #1's "sampling guidance" bullet — qualitative text allowed, specific numbers delegated to Story 21.8's vLLM reference doc. `/no_think` (prompt-effective) is retained.
