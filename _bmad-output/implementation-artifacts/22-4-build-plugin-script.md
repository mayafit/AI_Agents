# Story 22.4: Build Script for Plugin Assembly (`scripts/build-plugin.js`)

Status: backlog

## Story

As a **ma-agents maintainer**,
I want a deterministic build script that assembles `lib/bmad-extension-plugin/` from `lib/bmad-extension/` source,
So that the bundled plugin is reproducible, diff-able, and ready to be staged at install time without per-install assembly logic.

## Acceptance Criteria

1. **Given** the script `scripts/build-plugin.js` exists, **When** I run `npm run build:plugin`, **Then** the script executes via Node and exits with code 0.

2. **Given** a clean `lib/bmad-extension/` source tree, **When** the build script runs, **Then** `lib/bmad-extension-plugin/` is produced containing:
   - `.claude-plugin/marketplace.json` (resolved from the source template — Story 22.5 defines the schema; this story emits a placeholder JSON if the template is not yet present)
   - `skills/module.yaml` (canonical BMAD Builder location, copied or symlinked from source)
   - `skills/module-help.csv` (copied from `lib/bmad-extension/module-help.csv`)
   - One subdirectory per skill folder under `lib/bmad-extension/skills/`, with `SKILL.md`, `bmad-skill-manifest.yaml`, and any `resources/`, `prompts/`, `templates/`, or `scripts/` content preserved byte-for-byte

3. **Given** the build script has been run once, **When** it runs a second time against the same source, **Then** the output `lib/bmad-extension-plugin/` is byte-identical to the first run. Verified by SHA-256 hash of a recursive tree listing before and after a second run.

4. **Given** a missing required source file (e.g., `lib/bmad-extension/module.yaml` absent or `skills/` directory empty), **When** the build script runs, **Then** the script exits non-zero with a clear error message naming the missing file.

5. **Given** the build script is running, **When** it writes any file, **Then** the file path is inside `lib/bmad-extension-plugin/` — the script does NOT modify any source file under `lib/bmad-extension/` or anywhere else.

6. **Given** `lib/bmad-extension-plugin/` is committed to the repo, **When** I run `npm pack --dry-run` (or `npm publish --dry-run`), **Then** the file list shows `lib/bmad-extension-plugin/` and its contents included in the published tarball.

7. **Given** `package.json`, **When** I read its `scripts` section, **Then** `"build:plugin": "node scripts/build-plugin.js"` is defined and `"prepare"` (or another prepublish hook) invokes `build:plugin` so a fresh clone produces an up-to-date bundle.

8. **Given** the script uses only Node.js built-in modules (`fs`, `path`, `crypto`), **When** I read its `require` / `import` statements, **Then** no third-party dependencies are introduced.

## Tasks / Subtasks

### Task 1: Define the build contract (AC: 2, 4, 5)

- [ ] 1.1 In a top-of-file comment in `scripts/build-plugin.js`, document:
  - Input directory: `lib/bmad-extension/`
  - Output directory: `lib/bmad-extension-plugin/`
  - Required source files (fail-fast list)
  - Side effects: only writes inside output dir; does not modify source

### Task 2: Implement the script (AC: 1, 2, 5, 8)

- [ ] 2.1 Create `scripts/build-plugin.js` with a single entry point and a `main()` function
- [ ] 2.2 Implement: clear the output directory (or create it), then walk the source tree and copy files into the plugin layout
  - Source `lib/bmad-extension/skills/<skill-name>/` → output `lib/bmad-extension-plugin/skills/<skill-name>/`
  - Source `lib/bmad-extension/module-help.csv` → output `lib/bmad-extension-plugin/skills/module-help.csv`
  - Source `lib/bmad-extension/module.yaml` (if it's still in source after Story 22.5's move) → output `lib/bmad-extension-plugin/skills/module.yaml`
  - Source `lib/bmad-extension/.claude-plugin/marketplace.json.template` (per Story 22.5) → resolved → output `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`
- [ ] 2.3 If Story 22.5 hasn't merged yet, emit a placeholder `marketplace.json` with a comment marking it as a stub — Story 22.5 will overwrite this with the real content
- [ ] 2.4 Use only Node.js built-ins — no `fs-extra`, no `glob`, no third-party copy helpers

### Task 3: Implement determinism (AC: 3)

- [ ] 3.1 Sort directory entries before iterating — `fs.readdirSync(dir).sort()` — so output ordering is stable across platforms
- [ ] 3.2 Preserve file contents byte-for-byte — use `fs.copyFileSync` (which preserves bytes) rather than read-then-write transforms
- [ ] 3.3 Do not embed timestamps, hostnames, or other non-deterministic data in any output file
- [ ] 3.4 Add a verification step at the end of the script (gated by `--verify` flag): walk the output directory and emit a SHA-256 hash of the concatenated file list — the hash should be stable across runs

### Task 4: Implement fail-fast on missing required files (AC: 4)

- [ ] 4.1 At the start of `main()`, check each required source file exists; if any is missing, log the missing path and `process.exit(1)`
- [ ] 4.2 Required source files (initial list — refine as Story 22.5 lands):
  - `lib/bmad-extension/skills/` (must be a directory containing at least one skill)
  - `lib/bmad-extension/module-help.csv`
  - `lib/bmad-extension/module.yaml` OR `lib/bmad-extension/skills/module.yaml` (Story 22.5 moves it)

### Task 5: Wire up package.json scripts (AC: 1, 7)

- [ ] 5.1 Add `"build:plugin": "node scripts/build-plugin.js"` to `package.json` `scripts`
- [ ] 5.2 Add `"prepare": "<existing prepare command if any> && npm run build:plugin"` (or extend whatever prepare hook is present) so a fresh `npm install` from a checkout produces an up-to-date bundle
- [ ] 5.3 Verify a fresh `git clone` + `npm install` produces a populated `lib/bmad-extension-plugin/`

### Task 6: Commit the generated bundle (AC: 6)

- [ ] 6.1 Run `npm run build:plugin` to produce the initial `lib/bmad-extension-plugin/`
- [ ] 6.2 `git add lib/bmad-extension-plugin/` and commit
- [ ] 6.3 Verify `git log` shows the bundle as committed
- [ ] 6.4 Run `npm pack --dry-run` and confirm the bundle is in the file list

### Task 7: Test (AC: 1, 3, 4, 5)

- [ ] 7.1 Manual test: delete `lib/bmad-extension-plugin/`, run `npm run build:plugin`, verify the bundle is reproduced
- [ ] 7.2 Manual test: rename `lib/bmad-extension/module-help.csv` to provoke a missing-file error, run `npm run build:plugin`, verify exit code 1 and a clear error message; restore the file
- [ ] 7.3 Manual test: run `npm run build:plugin` twice, capture the SHA-256 verification output, confirm both runs produce the same hash
- [ ] 7.4 Add a unit test (e.g., `test/build-plugin.test.js`) that exercises Task 7.1 and Task 7.3 programmatically — fails CI if the build is non-deterministic or non-idempotent

## Dev Notes

### Source-of-truth split

Hand-edited content lives in `lib/bmad-extension/`. The plugin directory is generated. PRs that touch source must regenerate and commit the plugin — Story 22.9's CI gate will catch drift if a contributor forgets.

### Why commit the generated bundle

Three reasons:
1. The bundle ships in the npm tarball (publish-time generation would be fine, but committing makes it diff-able)
2. Reviewers can see exactly what changes in the plugin when source changes — no "trust me, I ran the build" PRs
3. CI can detect drift by re-running the build and comparing — if the committed bundle doesn't match what the build script produces, the PR fails

### Why no third-party dependencies

Keep the build step lightweight and offline-safe. The script runs at `npm install` time inside potentially-restricted environments. Adding dependencies risks the script failing in air-gapped settings before it can do anything useful.

### Determinism is load-bearing

NFR51 requires deterministic staging — the same source must produce a byte-identical bundle. Sorted directory iteration and byte-preserving file copies are the two main risk areas; if Node's behavior changes across versions, the verification step catches it.

### Reference Files

- `lib/bmad-extension/` — input
- `lib/bmad-extension-plugin/` — output (created by this story)
- `package.json` — scripts section
- `test/build-plugin.test.js` — unit test (created by this story)
- Architecture: Decision P4-1, "Plugin assembly at build time" subsection

### PRD Traceability

- **FR184:** The bundled plugin is assembled at build time into `lib/bmad-extension-plugin/` by a build script
- **NFR51:** Pre-install plugin staging step must be deterministic — byte-identical output for byte-identical input

## Change Log

| Date | Version | Author | Description |
|------|---------|--------|-------------|
| 2026-04-13 | 1.0.0 | (pending) | Story drafted as part of Epic 22 |
