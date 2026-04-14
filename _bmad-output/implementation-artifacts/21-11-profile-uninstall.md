# Story 21.11: Profile Uninstall

Status: ready-for-dev

## Story

As an **engineer migrating a project away from ma-agents or switching from on-prem to a different deployment model**,
I want a `ma-agents uninstall --profile-artifacts` subcommand that removes all ma-agents-owned profile-dependent content while preserving user content,
So that I can cleanly reverse the install without hand-editing every generated file or leaving dead guardrails that no longer reflect the project's actual deployment.

## Acceptance Criteria

1. The existing `ma-agents uninstall` subcommand (if already present) gains a new flag `--profile-artifacts`. If no `uninstall` subcommand exists yet, this story creates it with the `--profile-artifacts` flag as the first supported mode. CLI help text documents the flag. The command accepts optional `--yes` to bypass the confirmation prompt in CI (unlike `reconfigure`, uninstall IS a legitimate CI use case — e.g., a migration script that decommissions a project's ma-agents integration).
2. On invocation, `ma-agents uninstall --profile-artifacts` lists every file and region it will modify and asks a yes/no confirmation: `The following ma-agents-owned content will be removed: [list]. User content outside markers will be preserved. Continue?`. With `--yes`, the prompt is skipped and the operation proceeds (documented clearly — `--yes` HERE is a deliberate CI affordance, different from its rejection in `reconfigure`).
3. For each instruction-injection file with `<!-- MA-AGENTS-START -->` / `<!-- MA-AGENTS-END -->` markers (`CLAUDE.md`, `.clinerules`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`), the command removes the marker block AND the markers themselves, leaving only the user content outside. If the file becomes empty (or contains only whitespace) after removal, the file is deleted.
4. For `.roomodes`, the command removes ONLY the four ma-agents-owned `customModes` slugs (`bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev`). Any user-defined `customModes` are preserved untouched. If after removal the file contains an empty `customModes` array and no other top-level content, the file is deleted.
5. For each removed file or region, the command writes a backup to `<target>.backup-<ISO-timestamp>` before removal — same backup convention as Story 21.2 AC #8 and Story 21.10 AC #8. This provides a recovery path if the user changes their mind within the shell session.
6. The `profile` field in `.ma-agents.json` is cleared (set to undefined / deleted, not written as empty string). `profileHistory` (from Story 21.10) is PRESERVED — it is an audit trail and must survive uninstall. A new history entry is appended: `{ date: <ISO>, from: <previous>, to: null, source: "uninstall" }`.
7. The `roomodesOverwriteLog` field (from Story 21.3 AC #10) is PRESERVED — also audit trail. No entries removed.
8. The `manifestVersion` is NOT downgraded (stays at `1.2.0`). Rationale: `manifestVersion` tracks schema capability, not content presence. Other ma-agents-owned fields (e.g., `skills`, `agents`) are untouched by `--profile-artifacts` — this flag scopes to profile-related artifacts only, not the whole ma-agents install. A user wanting complete removal runs `ma-agents uninstall` without `--profile-artifacts` (scope of that mode is defined by existing uninstall behavior, if any, and is out of scope for this story).
9. If slug-stomp protection (Story 21.3 AC #9) is armed — i.e., user-edited ma-agents-owned `.roomodes` slug bodies have diverged from the template — `uninstall --profile-artifacts` warns the user but PROCEEDS with removal (after the AC #2 confirmation). Rationale: the user is explicitly asking to remove the slugs; divergence is not a blocker here because the user is accepting the loss. The divergent bodies are captured in the backup file per AC #5. A one-line warning is emitted: `WARNING: removing hand-edited ma-agents-owned slugs [list]. Previous bodies backed up to .roomodes.backup-<ISO>.`
10. Uninstall is idempotent — running `ma-agents uninstall --profile-artifacts` twice in a row on the same project produces no errors and no additional changes the second time. The second run exits 0 with the message `No ma-agents-owned profile artifacts found. Nothing to do.`

## Tasks / Subtasks

- [ ] Task 1: CLI registration in `bin/cli.js` (AC: #1, #2)
  - [ ] 1.1 If `uninstall` subcommand does not exist yet, register it; otherwise add the `--profile-artifacts` flag to the existing dispatch
  - [ ] 1.2 Accept `--yes` (documented CI affordance, differs from `reconfigure`)
  - [ ] 1.3 Document the flag in CLI help text, including the `--yes` asymmetry vs `reconfigure`
  - [ ] 1.4 Route to the new `lib/uninstall.js::uninstallProfileArtifacts` handler

- [ ] Task 2: Orchestrator module `lib/uninstall.js` (AC: #2, #3, #4, #6, #7, #10)
  - [ ] 2.1 Export `uninstallProfileArtifacts(projectRoot, { yes })`
  - [ ] 2.2 Detect every target file/region; if none present, print the idempotent no-op message and exit 0 (AC #10)
  - [ ] 2.3 Print the target list and ask the `Continue?` confirmation unless `--yes` was passed (AC #2)
  - [ ] 2.4 Orchestrate: backup → marker-block removal → `.roomodes` slug removal → `.ma-agents.json` mutation → history append

- [ ] Task 3: Marker-block removal loop (AC: #3)
  - [ ] 3.1 Import marker-convention constants from the installer module (do NOT hardcode `<!-- MA-AGENTS-START -->`) — symmetry with install
  - [ ] 3.2 For each of the 5 injection files, strip the marker block (including markers), preserve surrounding user content byte-for-byte
  - [ ] 3.3 If the resulting file is empty or whitespace-only, delete it

- [ ] Task 4: `.roomodes` slug removal (AC: #4, #9)
  - [ ] 4.1 Reuse/centralize the slug list constant `['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']`
  - [ ] 4.2 Parse `.roomodes`, drop only ma-agents-owned slugs, preserve user-defined entries untouched
  - [ ] 4.3 Emit the slug-divergence warning per AC #9 when hand-edited bodies are detected
  - [ ] 4.4 If the post-removal `customModes` array is empty and no other top-level content remains, delete the file

- [ ] Task 5: Backup step (AC: #5)
  - [ ] 5.1 Reuse the Story 21.2 / 21.10 backup helper if present (same `<target>.backup-<ISO-timestamp>` convention)
  - [ ] 5.2 Use UTC ISO format for the timestamp (stable across locales)
  - [ ] 5.3 Capture content BEFORE any modification for each file/region

- [ ] Task 6: `.ma-agents.json` field mutation + audit-trail preservation (AC: #6, #7, #8)
  - [ ] 6.1 Add `clearProfile(projectRoot)` as a 4th export in `lib/profile.js` — see Dev Notes decision below
  - [ ] 6.2 Append `{ date, from, to: null, source: "uninstall" }` to `profileHistory` (create the field if absent; same 20-entry cap as Story 21.10)
  - [ ] 6.3 PRESERVE `profileHistory` and `roomodesOverwriteLog` — never truncate or delete
  - [ ] 6.4 Do NOT downgrade `manifestVersion` — stays at `1.2.0`

- [ ] Task 7: Tests in `test/uninstall.test.js` (covers all ACs)
  - [ ] 7.1 Fresh project with full profile stamping → `uninstall --profile-artifacts` removes all marker blocks, all 4 slugs, clears `profile` (AC #3, #4, #6)
  - [ ] 7.2 User content outside markers preserved byte-for-byte — per-file diff (AC #3, supports NFR49)
  - [ ] 7.3 User-defined `.roomodes` slugs preserved untouched (AC #4)
  - [ ] 7.4 Backup files created at `<target>.backup-<ISO-timestamp>` before each removal (AC #5)
  - [ ] 7.5 `profileHistory` and `roomodesOverwriteLog` preserved; new `{ from, to: null, source: "uninstall" }` entry appended (AC #6, #7)
  - [ ] 7.6 `manifestVersion` unchanged at `1.2.0` after uninstall (AC #8)
  - [ ] 7.7 Slug divergence path — warning emitted, removal proceeds, divergent bodies captured in backup (AC #9)
  - [ ] 7.8 Idempotency — second run exits 0 with `Nothing to do.` message and makes zero additional changes (AC #10)
  - [ ] 7.9 `--yes` bypasses the confirmation prompt and proceeds (AC #2, #1)

## Dev Notes

### Architecture Compliance

- **Decision P3-3** (Local-LLM / On-Prem Agent Tuning Profile) — uninstall is the symmetric counterpart to install's stamping. It MUST reuse the same marker-convention constants the installer defines (do not hardcode `<!-- MA-AGENTS-START -->` inline) to guarantee symmetry — drift between install and uninstall marker strings would leak orphaned blocks.
- **NFR5** (user content preservation) — uninstall must never touch content outside ma-agents-owned markers or outside ma-agents-owned `.roomodes` slugs. Per-file diff test in Task 7.2 enforces.
- **NFR44** (profile isolation) — after `uninstall --profile-artifacts`, the project's generated content must be free of ma-agents-owned profile artifacts. Verified by grep for `MA-AGENTS-START`, `bmad-pm`, `bmad-architect`, `bmad-techlead`, `bmad-dev` in the post-uninstall tree yielding no matches within files the installer owns.
- **NFR49** (uninstall preservation contract — new in this story, added alongside FR181) — audit trail and user content survive uninstall; verified by Task 7.2, 7.5, 7.6.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `bin/cli.js` | MODIFY — register `uninstall --profile-artifacts` flag (or register `uninstall` subcommand if it does not yet exist); route to new handler |
| `lib/uninstall.js` | CREATE (or MODIFY if already present for another mode) — export `uninstallProfileArtifacts(projectRoot, { yes })` |
| `lib/profile.js` | MODIFY — add `clearProfile(projectRoot)` as a 4th export. This expands the Story 21.1 AC #1 three-export contract. See "Decision: expanding `lib/profile.js` public API" below — flag this explicitly when picking up the story |
| `lib/installer.js` | READ-ONLY import of marker-convention constants and the ma-agents-owned slug list; no mutation |
| `test/uninstall.test.js` | CREATE |

### Library and Pattern References

- Prompts library: **`prompts`** (npm) — same as everywhere else.
- Backup naming convention: `<target>.backup-<ISO-timestamp>` per Story 21.2 AC #8 and Story 21.10 AC #8. Reuse the same helper if already extracted.
- ma-agents-owned `.roomodes` slug list: `['bmad-pm', 'bmad-architect', 'bmad-techlead', 'bmad-dev']` — centralize as a shared constant if not already done (current Story 21.3 references it inline; refactor opportunity).
- `profileHistory` shape and 20-entry cap: per Story 21.10 AC #11. This story appends with `source: "uninstall"` and `to: null`.
- Error class names must match upstream exactly where referenced (e.g., `RoomodesSlugDivergenceError` from Story 21.3 AC #9). This story does NOT introduce a new error class — divergence is a warning, not an abort (AC #9 rationale).

### `--yes` Asymmetry Between `reconfigure` and `uninstall`

Story 21.10 AC #6 REJECTS `--yes` for `reconfigure` (Finding #5: CI must not silently flip profiles). This story ACCEPTS `--yes` for `uninstall --profile-artifacts`. The two commands have different risk profiles:

- `reconfigure` under `--yes` would let CI silently rewrite guardrail content to a different profile's rules — an unintended content swap that may go unnoticed by the team. Blocking `--yes` forces the change to be deliberate.
- `uninstall --profile-artifacts` under `--yes` serves legitimate decommissioning scripts (e.g., migration automation that removes ma-agents before switching to a different toolchain). The intent is visible in the script being run; the operation is REMOVAL, not replacement, so there is no hidden content swap risk.

Both AC #1/#2 in this story and the parent `epics.md` Story 21.11 summary must keep this asymmetry explicit so a future reviewer doesn't "fix" the inconsistency.

### Out of Scope

- Removing `skills/`, `agents`, or other non-profile ma-agents content — that's a separate `uninstall` mode outside this flag's scope.
- Undoing BMAD module installation — not a profile artifact; separate concern.
- Cleaning up `docs/deployment/vllm-nemotron.md` — the vLLM doc ships in the repo as reference documentation (FR179); it is not project-generated and is not removed by uninstall.
- Restoring a previous on-prem/standard install state — the forward path to change profile is `reconfigure` (Story 21.10), not uninstall+reinstall.

### Testing Standards

Match `test/reconfigure.test.js` pattern once that lands. Until then, mirror `test/profile.test.js`. Use `fs.mkdtempSync(os.tmpdir() + ...)` per test to isolate state — never mutate the repo's own `.ma-agents.json` or instruction files. Mock `prompts` for deterministic runs (reuse the pattern already used in installer/profile tests).

### Decision: expanding `lib/profile.js` public API

Story 21.1 AC #1 pinned `lib/profile.js` to exactly three exports: `getProfile`, `setProfile`, `resolveProfile`. This story requires clearing the `profile` field symmetrically, and there are two options:

1. **Add `clearProfile(projectRoot)` to `lib/profile.js`** (4th export) — cleanest long-term, keeps all profile-field mutations in one place, preserves the "profile field is only ever touched via `lib/profile.js`" invariant that NFR44 leans on.
2. **Implement profile clearing inline in `lib/uninstall.js`** via direct JSON manipulation — avoids touching Story 21.1's pinned contract but duplicates IO logic and breaks the single-point-of-mutation invariant.

**Recommendation: option 1.** When picking up this story, the dev should:
- Add `clearProfile` to `lib/profile.js`
- Submit a small follow-up docs edit to Story 21.1 AC #1 (change "exactly three functions" to "exactly four functions") — paired with the code change, not in a retroactive docs-only PR
- This Dev Notes section exists to make sure option 2 is not picked silently as the path of least resistance

### Epic 21 Cross-Story Context

**Story 21.11 (this):** Uninstall subcommand — rollback path for profile-dependent content. Depends on Stories 21.1 (profile API — extends it), 21.2 (marker injection + backup convention), 21.3 (slug list + audit log), 21.6 (on-prem layer composition — reverses it), 21.10 (`profileHistory` field — preserves + appends). Runs LAST in the Epic 21 execution order (after 21.9) because the 21.9 end-to-end test harness needs uninstall as part of round-trip coverage, and uninstall must not land before all upstream stamping work is committable.

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled by dev agent)_

### Completion Notes List
_(to be filled by dev agent)_

### File List
_(to be filled by dev agent)_

## Change Log
- 2026-04-14: Story created (Epic 21, Story 21.11). Closes adversarial-review Finding #17 (no uninstall / rollback path).
