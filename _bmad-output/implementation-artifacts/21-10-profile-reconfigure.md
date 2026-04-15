# Story 21.10: Profile Reconfigure

Status: Review

## Story

As an **engineer who needs to change a previously-persisted profile**,
I want a `ma-agents reconfigure` subcommand that re-runs the profile prompt and re-stamps all profile-dependent artifacts,
So that a CI-default `standard` profile or a mistaken interactive answer can be corrected without hand-editing `.ma-agents.json`.

## Acceptance Criteria

1. A new CLI subcommand `npx ma-agents reconfigure` exists. It accepts no positional arguments and the usual flags where relevant (`--yes`, scope flags if present — see AC #6 for `--yes` handling). Running it in a project without `.ma-agents.json` exits with a named error and a hint to run `install` first — it does NOT silently bootstrap a manifest, because reconfigure presumes a prior install.
2. `reconfigure` shows the same profile-selection prompt Story 21.1's wizard shows, but with the currently-persisted value as the default highlighted option. The prompt text references the current value: `Current profile: <value>. Change to?`.
3. After the user picks a value (or confirms the existing one), `reconfigure` writes the resolved value via `setProfile` (reusing `lib/profile.js` unchanged). Logging follows the canonical log-string formats pinned in architecture.md P3-3 — the source of the write is `wizard` for this command (matching the `(from wizard)` suffix used by the install wizard).
4. If the newly-resolved profile equals the previously-persisted value, `reconfigure` reports `Profile unchanged: <value>. No re-stamp needed.` and exits 0 without touching any files.
5. If the profile CHANGED, `reconfigure` re-stamps ALL profile-dependent artifacts:
   - The instruction-block-injection files (`CLAUDE.md`, `.clinerules`, `.cline/clinerules.md`, `.roo/rules/00-ma-agents.md`, `AGENTS.md`)
   - The `.roomodes` file (per-mode `customInstructions`)
   - The BMAD customize-loader output (if Story 21.7 has landed — if it has not, this bullet is a no-op and the Task 3 subitems are skipped)
   Implementation strategy: reuse the exact injection functions the installer uses; do NOT fork logic.
6. `reconfigure` with `--yes` is explicitly rejected: the command exits nonzero with the message `--yes is not valid for reconfigure — this command is interactive by design to prevent accidental CI-triggered profile changes.` Rationale: Finding #5 is that CI quietly persists `standard`; we must not allow CI to silently flip profiles in either direction.
7. Before re-stamping, `reconfigure` prints the list of files that will be modified and asks for a single yes/no confirmation: `The following files will be updated to match profile=<new>: [list]. Continue?`. This is in addition to the profile-selection prompt in AC #2 — two-step confirmation for destructive scope.
8. `reconfigure` backs up each to-be-overwritten marker-block region to `<target>.backup-<ISO-timestamp>` before re-stamping. Same backup convention as Story 21.2 AC #8 — reuse if already implemented.
9. `reconfigure` respects Story 21.3 AC #9 slug-stomp protection: if user-edited ma-agents-owned `.roomodes` slugs are detected, the command aborts with the same `RoomodesSlugDivergenceError` and instructs the user to either rename the slug or pass `--force-roomodes-overwrite`. `--force-roomodes-overwrite` IS honored by `reconfigure` (unlike `--yes`) because it is a deliberate, user-supplied override.
10. `reconfigure` respects Story 21.5 AC #6 `.clinerules` dual-file drift detection: if the two Cline rule files (`.clinerules` and `.cline/clinerules.md`) have divergent marker-block content, the command aborts with `ClinerulesDualFileDriftError`. The user reconciles manually before retrying. No override flag is provided for this case.
11. A new log event is appended to `.ma-agents.json::profileHistory` (new field, append-only, capped at 20 entries — oldest entries dropped first when the cap is reached): `{ date: <ISO>, from: <previous>, to: <new>, source: "reconfigure" }`. The field is created on first reconfigure; a missing field on read means no prior reconfigure event. Gives operators a forensic trail for "when did this project's profile last change, and from what?"

## Tasks / Subtasks

- [ ] Task 1: Register `reconfigure` subcommand in `bin/cli.js` (AC: #1, #6)
  - [ ] 1.1 Add `reconfigure` case to the top-level command dispatcher
  - [ ] 1.2 Reject `--yes` with the pinned error message per AC #6 (exit nonzero)
  - [ ] 1.3 When `.ma-agents.json` is absent, exit with a named error and a hint to run `install` first (AC #1)
  - [ ] 1.4 Route to the new `lib/reconfigure.js` orchestrator

- [ ] Task 2: Create `lib/reconfigure.js` orchestrator (AC: #2, #3, #4, #7)
  - [ ] 2.1 Load persisted profile via `getProfile()`; abort if absent (AC #1)
  - [ ] 2.2 Show profile-selection prompt with persisted value as default (AC #2)
  - [ ] 2.3 If resolved value equals persisted value, log `Profile unchanged: <value>. No re-stamp needed.` and exit 0 (AC #4)
  - [ ] 2.4 Otherwise, compute the list of files that will be touched; print the list and ask the `Continue?` confirmation (AC #7)
  - [ ] 2.5 Call `setProfile(projectRoot, newValue)` and log via the canonical `Using profile: <value> (from wizard)` format (AC #3)

- [ ] Task 3: Re-stamp orchestration (AC: #5)
  - [ ] 3.1 Reuse the injection helpers from `lib/installer.js` for the 5 instruction-block-injection files
  - [ ] 3.2 Reuse the `.roomodes` merger from `lib/merge/roomodes.js` (Story 21.3) for `customInstructions`
  - [ ] 3.3 If Story 21.7 has landed, invoke the BMAD customize-loader re-stamp; otherwise skip (documented as conditional)
  - [ ] 3.4 Ensure zero duplication with installer stamping logic — do NOT fork

- [ ] Task 4: Backup step (AC: #8)
  - [ ] 4.1 Before each overwrite, capture the current marker-block region and write to `<target>.backup-<ISO-timestamp>`
  - [ ] 4.2 Use UTC ISO format for the timestamp (stable across locales)
  - [ ] 4.3 Reuse Story 21.2 backup helper if present; otherwise implement inline and note the refactor opportunity

- [ ] Task 5: Slug-stomp protection integration (AC: #9)
  - [ ] 5.1 Before touching `.roomodes`, run the Story 21.3 AC #9 slug-divergence check
  - [ ] 5.2 On divergence, throw `RoomodesSlugDivergenceError` with a message instructing rename or `--force-roomodes-overwrite`
  - [ ] 5.3 Honor `--force-roomodes-overwrite` when supplied — user-supplied override is allowed

- [ ] Task 6: Clinerules dual-file drift detection (AC: #10)
  - [ ] 6.1 Before touching Cline rule files, compare the marker-block content of `.clinerules` and `.cline/clinerules.md`
  - [ ] 6.2 On divergence, throw `ClinerulesDualFileDriftError` with a message pointing the user at both files; no override flag

- [ ] Task 7: `profileHistory` append (AC: #11)
  - [ ] 7.1 After a successful re-stamp, append `{ date, from, to, source: "reconfigure" }` to `.ma-agents.json::profileHistory`
  - [ ] 7.2 Create the field on first use; cap at 20 entries (drop oldest first)
  - [ ] 7.3 Ensure the write goes through `setProfile` or an equivalent atomic write path (no parallel JSON-IO)

- [ ] Task 8: Tests in `test/reconfigure.test.js` (covers all ACs)
  - [ ] 8.1 `--yes` is rejected with pinned message and nonzero exit (AC #6)
  - [ ] 8.2 Missing `.ma-agents.json` exits with named error (AC #1)
  - [ ] 8.3 Same-value confirmation exits with `Profile unchanged:` and no file writes (AC #4)
  - [ ] 8.4 Profile change from `standard` to `on-prem` re-stamps all injection files + `.roomodes` (AC #5)
  - [ ] 8.5 Two-step confirmation — selecting "no" at the `Continue?` prompt aborts with zero file changes (AC #7)
  - [ ] 8.6 Backup files created at `<target>.backup-<ISO-timestamp>` before each overwrite (AC #8)
  - [ ] 8.7 Slug divergence raises `RoomodesSlugDivergenceError`; `--force-roomodes-overwrite` bypasses (AC #9)
  - [ ] 8.8 Dual-file drift raises `ClinerulesDualFileDriftError`; no override flag (AC #10)
  - [ ] 8.9 `profileHistory` append — first reconfigure creates the field; subsequent reconfigures append; cap at 20 drops oldest (AC #11)

## Dev Notes

### Architecture Compliance

- **Decision P3-3** (Local-LLM / On-Prem Agent Tuning Profile) — `reconfigure` extends the profile API established in Story 21.1 without changing `lib/profile.js`'s public contract. The three exports stay exactly as defined in Story 21.1 AC #1: `getProfile`, `setProfile`, `resolveProfile`. `reconfigure` is a new consumer, not a new API.
- **NFR44** (profile isolation) — standard-profile output must remain free of on-prem strings after a `reconfigure` that lands on `standard`. Reuse of the installer's injection helpers (AC #5) is what guarantees this — forked re-stamp logic would risk drift.
- **NFR45** (CI/CD compatibility) — `reconfigure` is *deliberately* incompatible with CI (`--yes` blocked per AC #6). This is not a regression of NFR45; NFR45 covers `install`, not `reconfigure`. CI never needs to call `reconfigure`; profile changes are a human, interactive act.
- **NFR46** (idempotency) — after `reconfigure`, running `install` with the same profile must produce byte-identical output. Verified in Task 8 by running `install` after `reconfigure` and diffing marker-block regions.

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `bin/cli.js` | MODIFY — register `reconfigure` subcommand; route to new handler |
| `lib/reconfigure.js` | CREATE — orchestrates prompt → confirmation → backup → re-stamp → history append |
| `lib/installer.js` | MINOR — export injection functions currently internal if `reconfigure` needs to call them directly (avoid duplication) |
| `lib/profile.js` | UNCHANGED — `setProfile` already does the right thing post-Step 2 of the corrective plan |
| `test/reconfigure.test.js` | CREATE |

### Library and Pattern References

- Prompts library: **`prompts`** (npm) — same as the Story 21.1 wizard. Reuse the exact prompt shape; override only the `initial` index (to highlight the currently-persisted value) and the message text (`Current profile: <value>. Change to?`).
- Injection helpers: reuse from `lib/installer.js` for the 5 instruction-block-injection files; reuse from `lib/merge/roomodes.js` (Story 21.3) for `.roomodes`.
- `setProfile` from `lib/profile.js` — unchanged public contract.
- Backup naming convention: `<target>.backup-<ISO-timestamp>` per Story 21.2 AC #8.
- Error class names must match upstream exactly: `RoomodesSlugDivergenceError` (Story 21.3 AC #9), `ClinerulesDualFileDriftError` (Story 21.5 AC #6).

### Out of Scope

- Profile migration / data migration — none required. `.ma-agents.json` schema already has the `profile` field (Story 21.1 AC #12). Only the new optional `profileHistory` field is added; its absence is valid.
- Programmatic re-stamp without a human — explicitly forbidden by AC #6. `--yes` is blocked.
- Changing `lib/profile.js`'s public API — Story 21.1 AC #1 pinned three exports; `reconfigure` is a consumer, not a modifier.
- Auto-rollback on failed re-stamp — out of scope for this story; failures surface as errors and leave the backup files available for manual recovery. A future story may add transactional re-stamp.

### Testing Standards

Match the existing test layout (node:test or mocha-style — verify by reading one existing test file first). Place `test/reconfigure.test.js` next to `test/profile.test.js`. All tests must run as part of `npm test`. Use `fs.mkdtempSync(os.tmpdir() + ...)` per test to isolate `.ma-agents.json` reads/writes — never mutate the repo's own `.ma-agents.json` or instruction files. Mock `prompts` for deterministic test runs (the installer tests already do this — reuse the pattern).

### Epic 21 Cross-Story Context

**Story 21.10 (this):** Reconfigure subcommand — escape hatch for a previously-persisted profile. Depends on Stories 21.1 (profile API), 21.2 (marker injection + backup convention), 21.3 (slug-stomp protection), 21.4 (`AGENTS.md` template + `markdown-markers` merger — re-stamped on profile flip), 21.5 (dual-file drift detection), 21.6 (on-prem layer composition — the actual content being re-stamped), 21.7 (BMAD persona `on_prem_phase_prefix` — re-composed when profile flips, per Task 3.3). Runs after 21.6 in the execution order; must exist before 21.9's end-to-end tests so the round-trip test (21.9 AC #1 (f)) can exercise the real command instead of manual `.ma-agents.json` edits.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context) — bmad-dev-story flow.

### Debug Log References
- `.roomodes` slug-divergence comparison deliberately strips `customInstructions` because installed files already carry the profile-composed universal block; a profile flip legitimately rewrites that field. `whenToUse`, `roleDefinition`, `groups`, `name` are the user-editable surfaces the check catches. Documented inline in `lib/reconfigure.js::checkRoomodesSlugDivergence`.
- `updateAgentInstructions` is invoked with `yesMode: true` from the reconfigure loop so per-file drift prompts do not re-ask after the global `Continue?` confirmation (AC #7). The installer's `handleMarkerBlockDrift` still emits the pinned WARNING line and writes the canonical `<target>.backup-<ISO>` sibling (AC #8).
- `appendProfileHistory` does a fresh read-modify-write of `.ma-agents.json` so it composes with `setProfile`'s write — no parallel JSON-IO path. Cap enforcement is `shift()`-based (oldest-first eviction).

### Completion Notes List
- New `lib/reconfigure.js` orchestrator exports `reconfigure({ projectRoot, argv, promptsLib, now })` plus three named error classes (`RoomodesSlugDivergenceError`, `ManifestNotFoundError`, `ReconfigureYesRejectedError`) and the `PROFILE_HISTORY_CAP` constant (20).
- `bin/cli.js` registers the `reconfigure` verb and routes to `handleReconfigure`, which maps each error class to a user-facing exit(1) message. `--yes` on reconfigure exits nonzero with the pinned message verbatim (AC #6).
- Re-stamp reuses the canonical `updateAgentInstructions` path from `lib/installer.js`; zero forked logic. Backups are produced by the installer's existing drift handler using the canonical `buildBackupFilename` helper owned by Story 21.2.
- `checkRoomodesSlugDivergence` throws `RoomodesSlugDivergenceError` when any ma-agents-owned slug present in the existing `.roomodes` differs from the shipped template on non-customInstructions fields; `--force-roomodes-overwrite` bypasses the check (AC #9). `.clinerules` dual-file drift is delegated to Story 21.5's `checkClinerulesDualFileDrift` (no override, AC #10).
- `profileHistory` append uses a fresh read-modify-write that composes with `setProfile`'s write — capped at 20, oldest-first eviction (AC #11). Missing-field start is handled (first reconfigure creates the array).
- Prompt shape mirrors Story 21.1's wizard prompt (same two choices) but with `initial` set to the persisted value's row and the message `Current profile: <value>. Change to?` per AC #2.

### Adversarial Review Findings

| # | Layer | Severity | Finding | Disposition |
|---|-------|----------|---------|-------------|
| 1 | Cynical | P1 | setProfile runs BEFORE re-stamp loop; mid-flight re-stamp failure leaves profile+artifacts out of sync | Accepted — story explicitly lists "Auto-rollback" as out of scope; `profileHistory` append is gated on full loop success so forensic log does not falsely record a partial reconfigure |
| 2 | Cynical | P2 | `--yes` detection is string-includes on argv; benign for reconfigure (no positional args) | Accepted — same pattern as installer; reconfigure AC #1 forbids positional args |
| 3 | Edge-case | P1 | Slug-divergence check drops `customInstructions` from the compare | Correct by design — installer-stamped `customInstructions` carries the composed block which legitimately changes per profile; other fields remain user-edit detectors. Test 8.7 exercises `whenToUse` drift |
| 4 | Cynical | P2 | `appendProfileHistory` is read-modify-write, not atomic rename | Accepted — matches `setProfile`'s write pattern; reconfigure is interactive-only so concurrency isn't a realistic vector |
| 5 | Edge-case | P2 | Same-value short-circuit when `persistedProfile === undefined` requires user to pick a value; cannot short-circuit to undefined | Accepted — prompt choices are `on-prem` | `standard` only; chosenProfile is always a concrete value |
| 6 | Edge-case | P2 | No help-text doc for `--force-roomodes-overwrite` | **Fixed** — added Reconfigure options block in `showHelp()` |

### File List
- CREATED: `lib/reconfigure.js`
- CREATED: `test/reconfigure.test.js` (12 tests, all passing)
- MODIFIED: `bin/cli.js` (new `reconfigure` case + `handleReconfigure` + help text)
- MODIFIED: `package.json` (added `test/reconfigure.test.js` to npm test script)
- MODIFIED: `_bmad-output/implementation-artifacts/21-10-profile-reconfigure.md` (Dev Agent Record / File List / Change Log)

## Change Log
- 2026-04-15: Story 21.10 implemented — reconfigure CLI verb + orchestrator + slug/dual-file guards + profileHistory append. Status ready-for-dev → review.
- 2026-04-15: Upstream dependency list completed per adversarial-review finding — added Stories 21.4 (`AGENTS.md` re-stamping surface), 21.7 (BMAD persona phase prefix re-composition). Restores Dependencies bidirectionality with those stories' downstream lists.
- 2026-04-14: Story created (Epic 21, Story 21.10). Closes adversarial-review Findings #5 and #7 (no escape hatch for persisted profile; CI-default silent-downgrade trap).
