# Story 21.1: Install-Time Profile Prompt and Persistence

Status: review

## Story

As an **engineer running `npx ma-agents install`**,
I want the installer to ask whether this is an on-prem / air-gapped install once and remember my answer,
So that on-prem-specific guardrails activate without me having to remember a CLI flag, and I am not re-prompted on subsequent installs.

## Acceptance Criteria

1. A new module `lib/profile.js` exists exposing exactly three functions: `getProfile(projectRoot)`, `setProfile(projectRoot, value)`, `resolveProfile({ flag, persisted, yesMode })`. No other public API.
2. `getProfile(projectRoot)` reads `.ma-agents.json` at project root and returns the value of the top-level `"profile"` field, or `undefined` if the file or field is absent. It does not throw on missing file.
3. `setProfile(projectRoot, value)` writes `"profile": <value>` to the top-level of `.ma-agents.json`, preserving all existing fields (`manifestVersion`, `agent`, `agents`, `scope`, `skills`). When the file does not exist, it is created via the existing `ensureManifest` path so the standard schema is initialized.
4. `setProfile` accepts only the values `"on-prem"` and `"standard"`. Any other value throws an `Error` naming the bad value.
5. `resolveProfile({ flag, persisted, yesMode })` returns the effective profile per this precedence: (a) `flag` if set; (b) `persisted` if set; (c) `"standard"` if `yesMode === true`; (d) `null` (caller must prompt). It does not perform any I/O.
6. CLI flag `--profile=on-prem` and `--profile=standard` are recognized in `bin/cli.js`. Any other value (`--profile=foo`, `--profile=` empty) prints a clear error and exits non-zero before any install work begins.
7. The interactive wizard in `bin/cli.js` shows a single `prompts({ type: 'select' })` question after agent selection (Step 2) and before repository-layout selection (Step 2.5), with message `Is this an on-prem / air-gapped install using a local LLM (e.g. Nemotron)?` and choices `Yes — apply local-LLM guardrails (recommended for non-Claude models)` (value `on-prem`) and `No  — standard install (Claude on web, Anthropic API, etc.)` (value `standard`). Default initial selection is the `No` (standard) row.
8. The wizard prompt is shown only when `resolveProfile()` returns `null`. When the flag is passed or a value is already persisted, no prompt appears and the resolved value is logged once: `Using profile: <value> (from <source>)` where source is one of `--profile flag`, `.ma-agents.json`, or `--yes default`.
9. After the wizard prompt is answered (or after CLI flag resolution), `setProfile` is called with the resolved value before any agent installation runs — guaranteeing the profile is persisted even if a later install step fails.
10. Direct install command (`npx ma-agents install <skill> --agent <agent>`) accepts `--profile=` and `--yes` with the same semantics: `--profile=` sets and persists; `--yes` without `--profile=` defaults to `standard` and persists; absence of both with no persisted value triggers the same prompt as the wizard (interactive direct install) or fails with a clear error if stdin is not a TTY.
11. CI/CD path: `npx ma-agents install --yes` with no persisted profile and no `--profile=` writes `"profile": "standard"` to `.ma-agents.json` and proceeds without prompting (NFR45).
12. Re-running install with a persisted profile and no `--profile=` flag does NOT re-prompt and does NOT change the persisted value (NFR45).
13. Re-running install with `--profile=on-prem` against a project with `"profile": "standard"` persisted overwrites the persisted value to `"on-prem"` and logs the source as `--profile flag`.
14. The existing `manifestVersion` value is bumped from `1.1.0` to `1.2.0` in `ensureManifest` to reflect the new `"profile"` field. Manifests at `1.1.0` (no `profile`) are read without error — the `"profile"` field is treated as optional and absent equals `undefined`.

## Tasks / Subtasks

- [x] Task 1: Create `lib/profile.js` (AC: #1–#5)
  - [x] 1.1 Create `lib/profile.js` with `'use strict'` and the three exports
  - [x] 1.2 Implement `getProfile` reading via existing `readManifest`-style path; return `undefined` if file or field missing
  - [x] 1.3 Implement `setProfile` with value validation; reuse `ensureManifest` to bootstrap the file when absent; preserve all other fields on write
  - [x] 1.4 Implement `resolveProfile` as a pure function (no I/O) per the precedence in AC #5

- [x] Task 2: Wire `--profile=` into `bin/cli.js` (AC: #6, #10, #13)
  - [x] 2.1 In `parseFlags` (cli.js:170), extract `--profile=<value>`; reject any value other than `on-prem`/`standard` with non-zero exit and a clear error
  - [x] 2.2 Pass the parsed `profileFlag` through `handleInstall()` → `installWizard()` and `installSkill()` signatures alongside `forceFlag` and `yesFlag`

- [x] Task 3: Add wizard prompt (AC: #7, #8, #9)
  - [x] 3.1 In the wizard flow (cli.js:655–900), after Step 2 (agent selection, ~line 829) and before Step 2.5 (repository layout), call `resolveProfile({ flag: profileFlag, persisted: getProfile(projectRoot), yesMode: yesFlag })`
  - [x] 3.2 If the result is `null`, run the `prompts({ type: 'select' })` question per AC #7 (initial index = 1 for the "No" row)
  - [x] 3.3 Log `Using profile: <value> (from <source>)` exactly once
  - [x] 3.4 Call `setProfile(projectRoot, resolvedValue)` BEFORE any agent install step (AC #9)

- [x] Task 4: Direct install path parity (AC: #10, #11)
  - [x] 4.1 In `installSkill()` options destructuring (cli.js:577-578), accept `profile` alongside `force`, `yes`
  - [x] 4.2 Apply the same `resolveProfile` + prompt fallback logic; on non-TTY stdin with no resolved value, fail fast with `Cannot determine install profile in non-interactive mode — pass --profile=on-prem|standard or --yes` and exit non-zero

- [x] Task 5: Manifest version bump + back-compat (AC: #14)
  - [x] 5.1 In `ensureManifest` (installer.js:64-70), change `manifestVersion: '1.1.0'` to `'1.2.0'`
  - [x] 5.2 Existing files at `1.1.0` continue to load — do NOT migrate or rewrite the version on read; only writes through `setProfile` / `ensureManifest` produce `1.2.0`. A `1.1.0` file with no `profile` field is valid; `getProfile` returns `undefined`

- [x] Task 6: Unit tests in `test/profile.test.js` (covers all ACs)
  - [x] 6.1 `getProfile` returns `undefined` when `.ma-agents.json` does not exist (AC #2)
  - [x] 6.2 `getProfile` returns `undefined` when file exists but `profile` field is absent (AC #2, #14 back-compat)
  - [x] 6.3 `getProfile` returns the persisted value when present (AC #2)
  - [x] 6.4 `setProfile` creates the file with the standard schema when absent (AC #3)
  - [x] 6.5 `setProfile` preserves existing fields (`manifestVersion`, `agent`, `agents`, `scope`, `skills`) when updating (AC #3)
  - [x] 6.6 `setProfile` throws on invalid value with the bad value in the error message (AC #4)
  - [x] 6.7 `resolveProfile` precedence — flag wins over persisted (AC #5)
  - [x] 6.8 `resolveProfile` precedence — persisted wins over yes-default (AC #5)
  - [x] 6.9 `resolveProfile` precedence — yes-default returns `standard` only when no flag and no persisted (AC #5)
  - [x] 6.10 `resolveProfile` returns `null` when nothing is set and `yesMode === false` (AC #5)
  - [x] 6.11 `resolveProfile` does not perform I/O (AC #5 — verified by spying on `fs`)
  - [x] 6.12 Round-trip: `setProfile('on-prem')` then `getProfile()` returns `'on-prem'` (AC #2/#3)
  - [x] 6.13 Re-running `setProfile` with same value is idempotent (file content byte-identical except potentially `installedAt` if other fields update — but profile field stable)

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
Claude Opus 4.6 (1M context) — bmad-dev-story + bmad-code-review flow.

### Debug Log References
- Initial `npm test` run hit a pre-existing `bmad-version-bump` failure in the worktree due to missing `node_modules/bmad-method/package.json`. Resolved by running `npm install` in the worktree; not related to this story's changes.
- Self-review finding (Cynical Review layer): initial implementation used `installPath` (the custom skills install target) as the project root for `.ma-agents.json` in the wizard path, which is wrong — `.ma-agents.json` lives at `process.cwd()`, not the skills install dir. Corrected before opening the PR.

### Completion Notes List
- `lib/profile.js` exposes exactly the three required functions (`getProfile`, `setProfile`, `resolveProfile`). `resolveProfile` is pure — verified by fs-spy test (6.11).
- `lib/installer.js`: bumped `MANIFEST_VERSION` from `1.1.0` → `1.2.0`; added `ensureManifest` to `module.exports` so `setProfile` can bootstrap fresh manifests without duplicating JSON-IO logic.
- `bin/cli.js`: `parseFlags` now accepts `--profile=on-prem|standard` (equals-form only per AC #6) with fail-fast validation. `profileFlag` is threaded through `handleInstall` → `installWizard` and the direct-install path. Both paths call `setProfile` BEFORE any agent install step (AC #9) and log `Using profile: <value> (from <source>)` exactly once.
- Wizard insertion point is "Step 2.4" — after agent selection, before repo-layout (matches story spec). Direct-install path includes a non-TTY fail-fast branch per AC #10.
- Manifest back-compat: reads never migrate the version. A 1.1.0 file without `profile` reads as `undefined`; writing `setProfile` onto an existing 1.1.0 manifest adds the `profile` field while preserving the original `manifestVersion`. Fresh manifests created through `ensureManifest` are initialized at 1.2.0.
- Task 7 (integration test) intentionally left unchecked — explicitly deferred to Story 21.9 per spec.

### File List
- CREATED: `lib/profile.js`
- CREATED: `test/profile.test.js` (15 unit tests, all passing)
- MODIFIED: `lib/installer.js` (manifest version bump; export `ensureManifest`; accept `profile` option in `installSkill` signature for parity)
- MODIFIED: `bin/cli.js` (`--profile=` flag parsing/validation; wizard Step 2.4 profile prompt; direct-install profile resolution + non-TTY fail-fast; plumbing through `installWizard`)
- MODIFIED: `package.json` (added `test/profile.test.js` to npm test script)

## Change Log
- 2026-04-14: Story created (Epic 21, Story 21.1)
- 2026-04-14: Story 21.1 implemented — `lib/profile.js` + install-time prompt + manifest 1.2.0 bump; status moved ready-for-dev → review.
