# Story 21.1: Install-Time Profile Prompt and Persistence

Status: ready-for-dev

## Story

As an **engineer running `npx ma-agents install`**,
I want the installer to ask whether this is an on-prem / air-gapped install once and remember my answer,
So that on-prem-specific guardrails activate without me having to remember a CLI flag, and I am not re-prompted on subsequent installs.

## Acceptance Criteria

1. A new module `lib/profile.js` exists exposing exactly three functions: `getProfile(projectRoot)`, `setProfile(projectRoot, value)`, `resolveProfile({ persisted, yesMode })`. No other public API.
2. `getProfile(projectRoot)` reads `.ma-agents.json` at project root and returns the value of the top-level `"profile"` field, or `undefined` if the file or field is absent. It does not throw on missing file.
3. `setProfile(projectRoot, value)` writes `"profile": <value>` to the top-level of `.ma-agents.json`, preserving all existing fields (`manifestVersion`, `agent`, `agents`, `scope`, `skills`). When the file does not exist, it is created via the existing `ensureManifest` path so the standard schema is initialized.
4. `setProfile` accepts only the values `"on-prem"` and `"standard"`. Any other value throws an `Error` naming the bad value.
5. `resolveProfile({ persisted, yesMode })` returns the effective profile per this precedence: (a) `persisted` if set; (b) `"standard"` if `yesMode === true`; (c) `null` (caller must prompt). It does not perform any I/O. No CLI-flag parameter is accepted — profile is not a per-invocation flag.
6. _(removed — no `--profile=` CLI flag is exposed; the profile choice is user-facing via the wizard prompt, or team-facing via a committed `.ma-agents.json`)_
7. The interactive wizard in `bin/cli.js` shows a single `prompts({ type: 'select' })` question after agent selection (Step 2) and before repository-layout selection (Step 2.5), with message `Is this an on-prem / air-gapped install using a local LLM (e.g. Nemotron)?` and choices `Yes — apply local-LLM guardrails (recommended for non-Claude models)` (value `on-prem`) and `No  — standard install (Claude on web, Anthropic API, etc.)` (value `standard`). Default initial selection is the `No` (standard) row.
8. The wizard prompt is shown only when `resolveProfile()` returns `null`. When a value is already persisted or `--yes` is passed, no prompt appears and the resolved value is logged once: `Using profile: <value> (from <source>)` where source is one of `.ma-agents.json` or `--yes default`.
9. After the wizard prompt is answered, `setProfile` is called with the resolved value before any agent installation runs — guaranteeing the profile is persisted even if a later install step fails.
10. Direct install command (`npx ma-agents install <skill> --agent <agent>`) honors the same resolution: persisted value wins; `--yes` without persisted value defaults to `standard` and persists; absent both, the same prompt is shown (interactive direct install) or — when stdin is not a TTY — defaults to `standard` and persists (same as `--yes`). No per-invocation flag is accepted.
11. CI/CD path: `npx ma-agents install --yes` with no persisted profile writes `"profile": "standard"` to `.ma-agents.json` and proceeds without prompting (NFR45).
12. Re-running install with a persisted profile does NOT re-prompt and does NOT change the persisted value (NFR45).
13. _(removed — no CLI flag exists to override a persisted value. A team that needs to change profile edits the committed `.ma-agents.json` or runs the installer interactively and re-answers the prompt — but changing the persisted value via a new interactive run is out of scope for Story 21.1 and would require a separate "reconfigure" path if ever needed.)_
14. The existing `manifestVersion` value is bumped from `1.1.0` to `1.2.0` in `ensureManifest` to reflect the new `"profile"` field. Manifests at `1.1.0` (no `profile`) are read without error — the `"profile"` field is treated as optional and absent equals `undefined`. Writing to an existing `1.1.0` manifest via `setProfile` preserves the original `manifestVersion` (no silent migration); only `ensureManifest`-bootstrapped fresh manifests start at `1.2.0`.

## Tasks / Subtasks

- [ ] Task 1: Create `lib/profile.js` (AC: #1–#5)
  - [ ] 1.1 Create `lib/profile.js` with `'use strict'` and the three exports
  - [ ] 1.2 Implement `getProfile` reading via existing `readManifest`-style path; return `undefined` if file or field missing
  - [ ] 1.3 Implement `setProfile` with value validation; reuse `ensureManifest` to bootstrap the file when absent; preserve all other fields on write
  - [ ] 1.4 Implement `resolveProfile` as a pure function (no I/O) per the precedence in AC #5

- [ ] Task 2: _(removed — no CLI flag is added. `parseFlags` and install signatures are untouched for profile.)_

- [ ] Task 3: Add wizard prompt (AC: #7, #8, #9)
  - [ ] 3.1 In the wizard flow (cli.js:655–900), after Step 2 (agent selection, ~line 829) and before Step 2.5 (repository layout), call `resolveProfile({ persisted: getProfile(projectRoot), yesMode: yesFlag })`
  - [ ] 3.2 If the result is `null`, run the `prompts({ type: 'select' })` question per AC #7 (initial index = 1 for the "No" row)
  - [ ] 3.3 Log `Using profile: <value> (from <source>)` exactly once
  - [ ] 3.4 Call `setProfile(projectRoot, resolvedValue)` BEFORE any agent install step (AC #9)

- [ ] Task 4: Direct install path parity (AC: #10, #11)
  - [ ] 4.1 Apply the same `resolveProfile` + prompt fallback logic in the direct-install path
  - [ ] 4.2 On non-TTY stdin with no resolved value, default to `standard` and persist (same as `--yes`) — do NOT abort

- [ ] Task 5: Manifest version bump + back-compat (AC: #14)
  - [ ] 5.1 In `ensureManifest` (installer.js:64-70), change `manifestVersion: '1.1.0'` to `'1.2.0'`
  - [ ] 5.2 Existing files at `1.1.0` continue to load — do NOT migrate or rewrite the version on read; only writes through `setProfile` / `ensureManifest` produce `1.2.0`. A `1.1.0` file with no `profile` field is valid; `getProfile` returns `undefined`

- [ ] Task 6: Unit tests in `test/profile.test.js` (covers all ACs)
  - [ ] 6.1 `getProfile` returns `undefined` when `.ma-agents.json` does not exist (AC #2)
  - [ ] 6.2 `getProfile` returns `undefined` when file exists but `profile` field is absent (AC #2, #14 back-compat)
  - [ ] 6.3 `getProfile` returns the persisted value when present (AC #2)
  - [ ] 6.4 `setProfile` creates the file with the standard schema when absent (AC #3)
  - [ ] 6.5 `setProfile` preserves existing fields (`manifestVersion`, `agent`, `agents`, `scope`, `skills`) when updating (AC #3)
  - [ ] 6.6 `setProfile` throws on invalid value with the bad value in the error message (AC #4)
  - [ ] 6.7 _(removed — no flag to test)_
  - [ ] 6.8 `resolveProfile` precedence — persisted wins over yes-default (AC #5)
  - [ ] 6.9 `resolveProfile` precedence — yes-default returns `standard` only when no persisted value (AC #5)
  - [ ] 6.10 `resolveProfile` returns `null` when nothing is set and `yesMode === false` (AC #5)
  - [ ] 6.11 `resolveProfile` does not perform I/O (AC #5 — verified by spying on `fs`)
  - [ ] 6.12 Round-trip: `setProfile('on-prem')` then `getProfile()` returns `'on-prem'` (AC #2/#3)
  - [ ] 6.13 Re-running `setProfile` with same value is idempotent (file content byte-identical except potentially `installedAt` if other fields update — but profile field stable)

- [ ] Task 7: Integration test in `test/onprem-injection.test.js` (deferred to Story 21.9 — list as TODO here, do not implement)

## Dev Notes

### Architecture Compliance

- **Decision P3-3** (Local-LLM / On-Prem Agent Tuning Profile) — this story implements the `lib/profile.js` module and the install-time prompt. Stories 21.2–21.7 consume `getProfile()` to gate content. Stories 21.8 (docs) and 21.9 (tests) close the epic.
- **NFR45** (CI/CD compatibility) — `--yes` defaults to `standard`; `--profile=` overrides; persisted answer is not re-prompted.
- **NFR44** (profile isolation) — `setProfile` is the only mutator; no other code path writes the `profile` field. Standard profile installs must produce no on-prem-specific output (verified in Story 21.9).

### Source Tree Components to Touch

| File | Change |
|------|--------|
| `lib/profile.js` | CREATE — `getProfile`, `setProfile`, `resolveProfile` |
| `lib/installer.js` | MODIFY — `manifestVersion` bump 1.1.0 → 1.2.0 in `ensureManifest` (line ~64-70) |
| `bin/cli.js` | MODIFY — `parseFlags` accepts `--profile=` (line ~170-176); wizard prompt insertion after Step 2 (line ~829); signature plumbing for `installWizard`/`installSkill` (lines ~655, 1070, 1083) |
| `test/profile.test.js` | CREATE — unit tests per Task 6 |

### Library and Pattern References

- Prompts library: **`prompts`** (npm) — same as everywhere else in the wizard. Existing example to mirror: `lib/installer.js:625-631` (the repo-layout `select` prompt).
- Manifest read/write: reuse `readManifest` / `writeManifest` / `ensureManifest` in `lib/installer.js:23-70`. Do not create a parallel JSON-IO path. `setProfile` may import these or, if circular-import risk exists, replicate the minimal write pattern (`fs.writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf-8')`).
- Flag parsing site: `bin/cli.js:170-176`. Add `const profileFlag = (args.find(a => a.startsWith('--profile=')) || '').split('=')[1] || null;` — then validate against the two allowed values.

### Wizard Insertion Point

Per the explore report, wizard step order is:
- Step 0: Existing installation check (~668)
- Step 1: Skill selection (~737)
- Step 2: Agent selection (IDE + BMAD multiselects, ~776–804)
- **Step 2.4 (NEW): Profile prompt** ← insert here
- Step 2.5: Repository layout (~829)
- Step 3: Installation scope (~832)

Place the call so that the profile is resolved and persisted BEFORE repo-layout because future stories may want to gate layout-related guidance on profile (out of scope for this story, but the order is correct).

### `.ma-agents.json` Example After This Story

Standard profile, fresh install:

```json
{
  "manifestVersion": "1.2.0",
  "agent": "claude-code",
  "agents": ["claude-code"],
  "scope": "project",
  "profile": "standard",
  "skills": {}
}
```

On-prem profile after install:

```json
{
  "manifestVersion": "1.2.0",
  "agent": "claude-code",
  "agents": ["claude-code", "roo-code"],
  "scope": "project",
  "profile": "on-prem",
  "skills": { "...": "..." }
}
```

### Out of Scope for This Story

- Per-tool template content (Stories 21.2–21.5)
- On-prem layered guardrail content (Story 21.6)
- BMAD persona phase prefix (Story 21.7)
- vLLM deployment doc (Story 21.8)
- Integration test asserting standard vs on-prem produces correct injection content (Story 21.9)

This story is foundation only: prompt + persistence + read API. Downstream stories consume `getProfile(projectRoot)` and branch on its value.

### Testing Standards

Match the existing test layout in `test/` (mocha-style or node:test — verify by reading one existing test file first). Place `test/profile.test.js` next to `test/generate-project-context.test.js`. All tests must run as part of `npm test`. Use a temporary directory per test (e.g., `os.tmpdir()` + `fs.mkdtempSync`) to isolate `.ma-agents.json` reads/writes — never mutate the repo's own `.ma-agents.json`.

### Epic 21 Cross-Story Context

**Story 21.1 (this):** Profile prompt + `lib/profile.js` API + persistence. No template content yet.
**Story 21.2:** Universal instruction-block expansion (consumes `getProfile` indirectly via installer composition function).
**Stories 21.3–21.5:** Per-tool templates (`.roomodes`, `AGENTS.md`, `.clinerules`).
**Story 21.6:** On-prem layered guardrails — first story that branches behavior on `profile === 'on-prem'`.
**Story 21.7:** BMAD persona phase prefix in customize-loader.
**Story 21.8:** vLLM reference doc + README on-prem section.
**Story 21.9:** Tests covering NFR44, NFR46, NFR47 (integration-level).

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
- 2026-04-14: Story created (Epic 21, Story 21.1)
- 2026-04-14: Spec correction — removed `--profile=` CLI flag from scope (ACs #6, #13 retired; AC #5 `resolveProfile` signature reduced to `{ persisted, yesMode }`; AC #10 non-TTY path changed from fail-fast to default-`standard`; Task 2 removed; tests 6.7 removed). Profile remains user-facing via prompt or team-facing via committed `.ma-agents.json`.
