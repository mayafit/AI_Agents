---
type: bug
severity: high
title: The obsolete-tool-dir sweep recursively deletes a whole legacy skills directory without ever asking which files ma-agents put there — so a user's hand-authored skill is destroyed under a green "Removed legacy tool skills directory" log line
---

# Bug: the obsolete-tool-dir sweep has the provenance record it needs and does not read it

**Status:** backlog
**Severity:** high — silent, unrecoverable destruction of user-authored content on a routine upgrade
**Affected Component:** `lib/installer.js:2382` (`migrateObsoleteToolDirs`), `lib/installer.js:2405` (`await fs.remove(obsoletePath)`), `lib/installer.js:2256` (`OBSOLETE_TOOL_SKILL_DIRS`), call site `lib/installer.js:2150` (inside `installSkill`)
**Classification:** CODE FIX. No requirements change — the fix restores what the existing guard's own comment already claims to do.

## The defect

`migrateObsoleteToolDirs` (`lib/installer.js:2382`) iterates `OBSOLETE_TOOL_SKILL_DIRS` and, for each entry whose obsolete directory exists, does exactly one test — *does the replacement directory have any content?* (`:2396-2400`) — and then:

```js
// lib/installer.js:2403-2405
if (replacedByHasContent) {
  // Safe to remove — skills have been migrated to the new location.
  await fs.remove(obsoletePath);
```

`fs.remove` is recursive and unconditional. **The entire directory goes**, whatever is in it. There is no per-skill check, no read of the directory's own `.ma-agents.json`, no read of its `MANIFEST.yaml` — and both of those files are the record of exactly which skills ma-agents installed into that tree.

The user is then told, in green:

```
  - Removed legacy tool skills directory .roo/skills (moved to .agents/skills in v3.8.1)
```

`lib/installer.js:2407-2410`. Nothing names what was deleted. Nothing is backed up. `fs.remove` does not use the recycle bin.

### The existing guard answers the wrong question

The `else` branch at `:2411-2419` carries the comment:

```js
// Replacement is absent or empty — do not silently destroy user content.
```

So the author understood the hazard. But the predicate is `replacedByHasContent` — **"did the migration happen?"** It is never **"is there anything in this directory that ma-agents did not put here?"** The two questions coincide only in the case where the user wrote nothing of their own, and that is the case the sweep was designed against.

The comment on the destructive branch — *"Safe to remove — skills have been migrated to the new location"* — is true of ma-agents' skills and false of the user's. Nothing copies a hand-authored skill from `.roo/skills/my-house-style/` to `.agents/skills/`. It is not migrated; it is deleted, and the log calls that a migration.

### The information is right there and is not read

Two records exist, both written by ma-agents into the skills directory itself:

| record | written by | shape | authority |
| --- | --- | --- | --- |
| `<skillsDir>/.ma-agents.json` | `writeManifest` (`lib/installer.js:302`), populated at `:2108-2115` | `skills: { <skillId>: {version, installedAt, updatedAt, installerVersion, agentVersion} }` | the installer's own per-install record |
| `<skillsDir>/MANIFEST.yaml` | `generateSkillsManifest` (`lib/installer.js:795`) — documented as *"the ONLY writer of MANIFEST.yaml"* at `:1806` | `- id: <skillId>` / `file: <skillId>/SKILL.md` | derived from `.ma-agents.json::skills` (`:2338-2339`) |

A skill installs to `path.join(installPath, skillId)` (`performInstall`, `lib/installer.js:1754`), so a manifest key **is** the on-disk directory basename. Measured in this repository's own `.claude/skills`: the only non-directory entries are `.ma-agents.json` and `MANIFEST.yaml`, and `skills` holds 44 ids of which 33 match a directory on disk.

**The sweep imports neither.** `migrateObsoleteToolDirs` (`:2382-2434`) calls `fs.existsSync`, `fs.readdirSync` and `fs.remove` and nothing else. It is the only function in the retirement/migration block that does not consult a manifest — its sibling `migrateRetiredSkills` (`:2277`) reads `.ma-agents.json`, prunes `manifest.skills` and regenerates `MANIFEST.yaml` (`:2311-2344`).

## The five affected entries

Verified against `lib/installer.js:2256-2274` on `feature/epic-31` @ `ca78f43`:

| # | obsolete | replacedBy | sinceVersion | shipped? |
| --- | --- | --- | --- | --- |
| 1 | `.github/copilot/skills` | `.github/skills` | 3.7.0 | **yes** |
| 2 | `.github/skills` | `.agents/skills` | 3.8.1 | **yes** |
| 3 | `.roo/skills` | `.agents/skills` | 3.8.1 | **yes** |
| 4 | `.kilocode/skills` | `.agents/skills` | 3.8.1 | **yes** |
| 5 | `.antigravity/skills` | `.agent/skills` | 3.18.0 | **NO — unreleased** |

Entries 1-4 are present on `main` (`git show main:lib/installer.js`, lines 2009-2014) and have therefore been running in users' projects for releases. **Anyone who hand-authored a Roo or Kilocode skill under those paths has already lost it, and there is nothing a future release can do to give it back.** Entry 5 exists only on `feature/epic-31`; `package.json::version` is `3.18.0-beta.1` and no `CHANGELOG.md` line mentions antigravity.

**That asymmetry is the whole reason this is actionable rather than only regrettable.** This is an inherited pattern being *extended* to a fifth directory, not a new mistake — and the fifth has not shipped yet.

> **The `.antigravity/skills` sweep entry must not ship without this fix.** Shipping 3.18.0 with entry 5 as written extends silent data loss to a directory that has never had it.

## Explicitly NOT at risk — so nobody "fixes" them

- **Cline.** `.cline/skills` in this registry (`lib/agents.js:134`) and `target_dir: .cline/skills` upstream (`node_modules/bmad-method/tools/installer/ide/platform-codes.yaml:63`). No divergence, no sweep entry, nothing deleted. **Untouched.**
- **opencode, gemini, cursor.** These *do* diverge from upstream (`.opencode/skills`, `.gemini/skills`, `.cursor/skills` vs upstream's `.agents/skills`) and the divergence is deliberately recorded in `PLATFORM_PATH_DIVERGENCES` (`lib/agents.js:401-430`) — but **none of the three has an `OBSOLETE_TOOL_SKILL_DIRS` entry**, so the sweep never touches them. They get two trees, and since `bug-antigravity-path-divergence` the on-prem patcher derives its targets from disk and patches both. Nothing to fix here.

## The correction that matters to the fix: the manifest is a sound but INCOMPLETE record

This was measured, not assumed, and it changes the design.

**(a) Many real trees carry no per-tree manifest at all.** `D:\Code\Workshop` (BMAD 6.10.0, profile `on-prem`, the project that produced `bug-antigravity-path-divergence`) has four populated skill trees — `.agents/skills`, `.agent/skills`, `.claude/skills`, `.cline/skills`, 166 entries each — and **`find . -maxdepth 3 -name MANIFEST.yaml -o -name .ma-agents.json` returns exactly one hit: the project-root `.ma-agents.json`.** That root file's keys are `manifestVersion, scope, profile, bmadModules` — it has **no `skills` key**, by design: it is a profile/settings store, not a skill inventory (`lib/profile.js:27-32`). Not one of the four trees carries a manifest.

Why: two pipelines write skills, and only one writes manifests — stated in the code at `lib/installer.js:1805-1809`: *"ma-agents' own standalone loop (`installSkill` → `performInstall` + `generateSkillsManifest` — the ONLY writer of MANIFEST.yaml), and bmad-method's PluginResolver (via `--custom-source`) which routes copilot/roo/kilo to the shared `.agents/skills/` dir."* The PluginResolver path writes skills and no manifest. Workshop's trees came that way — their `SKILL.md` frontmatter carries `type: skill` and `triggers:`, which `performInstall`'s injected frontmatter (`lib/installer.js:1765-1771`, only `name` + `description`) never emits.

**(b) Even where a manifest exists, it under-records.** In this repository's own `.claude/skills`: 35 skill directories on disk, 44 ids in `.ma-agents.json::skills`, and **two on-disk directories are absent from the manifest** — `reconfigure-layout` and `repo-sync-check` — both carrying `performInstall`'s exact injected frontmatter (`name: reconfigure-layout`), i.e. both unquestionably installed by ma-agents.

**So: manifest-recorded ⟹ ma-agents installed it. The converse does not hold.** The fix must therefore treat the manifest as a *positive* record only, and treat everything unrecorded as content of unknown provenance to be preserved. It over-preserves. That is the correct direction: an un-deleted stale directory costs a user one `rm -rf` they are already told to run (`lib/installer.js:2418`); a deleted hand-written skill costs them the file.

## Blast radius

- Every project that has ever had `.github/copilot/skills`, `.github/skills`, `.roo/skills` or `.kilocode/skills`, on every `ma-agents install`/update that installs at least one skill — the sweep runs once per `installSkill()` call (`lib/installer.js:2144-2152`), guarded only against running twice in the same call.
- It grows with the registry: `OBSOLETE_TOOL_SKILL_DIRS`' own comment invites new entries (`:2251-2253`, *"Story 24.11 (AC5) will add additional entries"*), and each one inherits the behaviour by construction.
- The failure is invisible at the time and invisible afterwards. The user sees a success line; `git status` shows a deletion only if the tree was tracked.

## Suggested resolution

**Make the sweep manifest-aware** — Story 31.16. Per entry:

1. Read the **obsolete** directory's own `.ma-agents.json`. Its `skills` keys are the directory basenames ma-agents installed there.
2. Remove only those child directories, plus the two manifest files ma-agents itself wrote.
3. If anything else remains, **preserve the directory** and log the surviving entries **by name**.
4. If the obsolete directory has **no manifest**, remove nothing and preserve — unknown provenance fails safe. (This is the common case in the field; see the Workshop measurement above.)
5. Keep the existing preserve-on-empty-replacement behaviour unchanged.

Alternatives considered and rejected in the story: move-to-backup (invents a new directory the user did not ask for and never reclaims it), prompt (the sweep runs inside a non-interactive install path), and delete-only-what-matches-a-shipped-skill-id (uses the current catalog as the oracle, which makes a skill retired since install undeletable and a renamed one deletable in the wrong tree).

## Acceptance criteria for whichever story adopts this

See Story 31.16 in `_bmad-output/planning-artifacts/epics.md` for the binding set. The four the reporter required, restated:

1. A user-authored file in a swept directory survives, and the directory is preserved.
2. A directory containing only ma-agents-installed skills is still removed — the fix must not disable the cleanup.
3. The preserved case names the files that caused preservation.
4. A directory with no manifest is preserved, never removed.
5. All five entries get the behaviour, proven per-entry.

Plus: each new test is mutation-tested, and each test's expectation is derived from an authority outside `migrateObsoleteToolDirs` — the manifest writers, the shipped log strings, or the real filesystem. This repository has produced six tautological tests where the expectation came from the same source as the implementation; a seventh here would assert that the deleter deletes what the deleter decided to delete.

## Provenance

- Reported by the human maintainer while reviewing the fifth `OBSOLETE_TOOL_SKILL_DIRS` entry added on `feature/epic-31` for `bug-antigravity-path-divergence`.
- Every line above re-verified at source on `feature/epic-31` @ `ca78f43`: the registry at `lib/installer.js:2256-2274`, the function at `:2382-2434`, the unconditional remove at `:2405`, the two comments at `:2404` and `:2412`, the log strings at `:2408-2409` and `:2415-2418`, the call site at `:2150`, the manifest writers at `:302`/`:795`/`:2108`, the sole-writer note at `:1806`, the two-pipeline note at `:1805-1809`, `performInstall`'s install path and frontmatter at `:1754`/`:1765-1771`, `PLATFORM_PATH_DIVERGENCES` at `lib/agents.js:401`, cline at `lib/agents.js:134` and `platform-codes.yaml:63`, antigravity's realigned `skillsDir: '.agent/skills'` at `lib/agents.js:264` against `platform-codes.yaml:35`.
- Shipped-vs-unreleased split confirmed by `git show main:lib/installer.js` (four entries, lines 2009-2014) against the branch (five) and `package.json::version` = `3.18.0-beta.1`.
- Manifest-absence measured in `D:\Code\Workshop` (read-only inspection, nothing modified); manifest under-recording measured in `d:\Code\AI_Agents\.claude\skills`.
- **Not caused by Epic 31.** Epic 31 adds the fifth entry; the mechanism is from Bug B2 and predates the epic by four releases.
- Discoverable via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
