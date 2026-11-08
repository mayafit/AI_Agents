# Story 36.3 — `bmadRef` and `bundle build` Snapshot: one version record, deterministic snapshot, Node engines, uv runner

Status: backlog
Blocked on: 36-1 (needs GO-36.3/36.4/36.5, AC1's Skills CLI version and engines floor, and AC12's tea/cis tags)
Wave: 1 (parallel with 36.4, 36.5)

**FR:** FR280 (target commit), FR302 (version and compatibility record), FR299 (bundle contents and manifest — the upstream half; 39.1 adds the extensions and the runtime), FR283 (Skills CLI at a pinned version), FR298 (`engines.node`), FR304 (uv execution: one runner module, `run --no-cache`), FR282 (offline runtime). **NFR:** NFR2, NFR58 (the snapshot is self-contained for the offline bundle). **Decisions:** P5-11.2 (repository and versioning), P5-11.5 (target commit), P5-11.6 (offline Python runtime), P5-11.10 (installer sequence).

## Story

As the **ma-agents maintainer**,
I want the BMAD target, the Skills CLI version and the tea/cis tags recorded in one `package.json` field, and a `ma-agents bundle build` command that snapshots exactly those into `bundle/` with a SHA-256 manifest,
so that every later story binds to one record, a target move is one deliberate edit followed by one rebuild, and two builds from the same record produce the same bytes.

## Context

The 4.x installer installs from a local bundle (P5-11.10): it unpacks `bundle/skills-cli/skills-<skillsCli>.tgz` into `<scope>/.ma-agents/skills-cli/` and runs `node <that>/<bin entry> add <bundle>/bmad-method --skill … -y --agent <tool>`, then each selected module source. This story creates the record and the upstream half of that bundle. `package.json` has no `bmadRef`; `engines.node` is `>=16.0.0` (`package.json:57-58`). `bin/cli.js` is the command entry point.

The uv guard `test/uv-transition-resilience.test.js:194` fails if any `lib/`, `scripts/`, `bin/` `.js` file contains the substring `uv run`; its header (`:24-27`) states that control-plane Python is never run through uv. The 4.x install sequence runs `uv run --no-cache <bmad>/scripts/setup.py` from the installer, so the guard is a rule about where uv is executed: only through one runner module, always with `run --no-cache` (FR304). The NFR59(a)/(b) tests in the same file (`:123`, `:138`, `:156`, `:167`) are unaffected.

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 AC3 re-asserts it after moving `bmadRef.core` to the GA commit.

1. **`bmadRef` is the single source.** (Re-run at GA: yes.) `package.json` gains `"bmadRef": { "core": "e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6", "skillsCli": "<36.1 AC1 version>", "tea": "<tag or empty>", "cis": "<tag or empty>", "extensions": "v1.0.0" }`; `tea` / `cis` are empty when 36.1 AC12 recorded FALLBACK; `extensions` is the `ma-bmad-extensions` tag (initial `v1.0.0`, P5-11.2), which 39.1 adds to the bundle. The upstream repositories (`bmad-code-org/BMAD-METHOD`, `bmad-code-org/bmad-method-test-architecture-enterprise`, `bmad-code-org/bmad-module-creative-intelligence-suite`) are constants of the builder, listed in the manifest. A test asserts: `core` is a full 40-hex commit (a branch or tag name fails); `skillsCli` is an exact SemVer version (a range fails); `tea` / `cis` are tags or empty; `extensions` is a tag.
2. **`ma-agents bundle build` fetches exactly the record.** (Re-run at GA: yes.) A maintainer command `bundle build [--out <dir>]` (default `bundle/`; implementation module name recorded) fetches BMAD-METHOD at exactly `bmadRef.core` (`git init` + `git fetch --depth 1 origin <sha>` + `git checkout FETCH_HEAD`), asserts `git rev-parse HEAD` equals the record, and copies the repository's `skills/` tree into `<out>/bmad-method/skills/`. tea and cis are fetched at their tags into `<out>/tea/` and `<out>/cis/`, and `git describe --tags --exact-match HEAD` must equal the tag; an empty tag skips the module and the manifest records it as omitted. The Skills CLI is packed with `npm pack skills@<skillsCli>` into `<out>/skills-cli/skills-<skillsCli>.tgz`, and the manifest records the package's bin entry. No branch head is ever fetched.
3. **Manifest.** (Re-run at GA: yes.) `<out>/manifest.json` records, per item: name, source repository, requested ref, resolved commit, file count, a tree hash, and the SHA-256 of every file; plus the `skills/bmod-method/bmod.toml` version and the Skills CLI tarball's SHA-256 and `engines.node`. A module whose tag is empty is absent from the manifest's module list, and the 39.2 wizard offers `tea` / `cis` only when the manifest lists them. `bundle/` is git-ignored; 39.4 adds it to the npm `files` list.
4. **Deterministic.** (Re-run at GA: yes.) Two `bundle build` runs from the same `bmadRef` into different directories produce byte-identical `manifest.json` files (entries sorted, no timestamps, no absolute paths) — FR299.
5. **Snapshot verified by an outside authority.** (Re-run at GA: yes.) `test/bundle-snapshot.test.js` asserts against a fixture manifest and tree on every run, and against the real `bundle/` when present (skipped with a printed reason otherwise; the 36.6 CI job builds it first, so CI never skips): manifest `core` commit equals `package.json` `bmadRef.core`; `skills/bmad/scripts/{render_skill,resolve_config,resolve_customization,setup,validate_manifests,migrate_v6}.py` and `skills/bmad-agent-po/scripts/tickets.py` exist under `bmad-method/`; the tree hash and per-file SHA-256 recomputed from disk equal the manifest's. A snapshot built from a different commit fails the test.
6. **Node engines (FR298).** (Re-run at GA: yes.) `package.json` `engines.node` becomes `>=20.12.0`, or the higher floor the Skills CLI declares (36.1 AC1). A test asserts the range is not looser than the floor read from the bundled Skills CLI tarball's `package.json` (or its recorded value in the manifest) — never from a literal in the test.
7. **uv runner and execution guard (FR304).** (Re-run at GA: no.) A single runner module (name recorded, e.g. `lib/runtime/uv.js`) is the only place installer JavaScript spawns uv; it always passes `run --no-cache` and an argv array. The `:194` test fails on any `spawn` / `exec` / `execFile` / `execSync` call whose command or argv contains `uv` outside that module, and on any call through the module without `--no-cache`; message strings that mention `uv run` pass. In-test fixtures prove it: `execSync('uv run x.py')` in another file fails, `console.log('… uv run …')` passes. The header (`:24-27`) states the FR304 rule and cites FR304 / P5-11.6. The NFR59(a)/(b) tests at `:123`, `:138`, `:156`, `:167` pass unchanged.
8. **Mutation-checked.** (Re-run at GA: no.) (m1) `bmadRef.core` changed by one hex digit without rebuilding → AC5 red; (m2) the builder fetches the default branch, not the commit → AC2 HEAD assertion red; (m3) a timestamp written into the manifest → AC4 red; (m4) an `execSync('uv …')` planted in `lib/` outside the runner → AC7 red; (m5) `engines.node` set to `>=18` → AC6 red; (m6) `skillsCli` set to `^1.7.6` → AC1 red.

## Tasks / Subtasks

- [ ] T1 `bmadRef` in `package.json` + record test (AC1)
- [ ] T2 `bundle build` command: core, tea, cis, Skills CLI tarball (AC2)
- [ ] T3 Manifest + determinism (AC3, AC4)
- [ ] T4 `test/bundle-snapshot.test.js`; add to the chain (AC5)
- [ ] T5 Engines + test (AC6)
- [ ] T6 uv runner + guard rewrite (AC7)
- [ ] T7 Mutants m1–m6 (AC8)

## Dev Notes

- `git fetch --depth 1 origin <sha>` works on GitHub for any reachable commit; if a proxy blocks it, fall back to a full clone + `git checkout <sha>` and record it. Never fetch `main`.
- The tree hash is computed over sorted relative paths with `/` separators and file SHA-256s, so Windows and Linux builds agree; test that on both.
- `scripts/build-wheelhouse.py` (36.2) reads `bundle/bmad-method/` as its `--snapshot`; 39.1 calls it from `bundle build`.
- Windows: the builder deletes fetched trees; on EBUSY close editors/AV and re-run; the builder retries deletes with backoff.
- Snapshot size is recorded in the manifest so 39.1 can set a bundle size budget.

## Testing

`test/bundle-snapshot.test.js` (new), the `bmadRef` record test, the engines test and the rewritten `test/uv-transition-resilience.test.js`; all in the chain. Run each directly on Windows too.

## Out of scope

- `ma-bmad-extensions`, uv, Python and the wheelhouse in the bundle (39.1); the install flow (39.2).
- The `customize.toml` contract (36.4); instruction files (36.5).

## Verification record

`bmadRef`: … ; bundle path + manifest SHA-256: … ; determinism (two builds): … ; tea/cis tags or omitted: … ; engines floor + source: … ; uv runner module: … ; suite: … ; mutants m1–m6: … ; unverified: …
