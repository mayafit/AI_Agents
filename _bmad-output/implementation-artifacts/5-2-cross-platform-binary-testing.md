# Story 5.2: Build Self-Contained Binary Pipeline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dependency: Story 5-1 must be completed first (packaging approach selection determines implementation) -->

## Story

As a **DevOps engineer**,
I want a build script that produces standalone binaries for Windows, macOS, and Linux,
So that I can distribute ma-agents without npm dependency for air-gapped environments.

## Acceptance Criteria

1. **Given** the chosen packaging approach from Story 5-1
   **When** `npm run build:standalone` is executed
   **Then** standalone binaries are produced for Windows (.exe), macOS, and Linux
   **And** each binary includes the full skill library (28 skills) and BMAD content

2. **Given** a standalone binary is executed on a machine without Node.js
   **When** the user runs `./ma-agents install`
   **Then** the installation works identically to `npx ma-agents install`
   **And** all skills, agents, and BMAD features function correctly

3. **Given** the binary is transferred to an air-gapped machine
   **When** executed without internet access
   **Then** skill installation completes successfully
   **And** no network calls are attempted

4. **Given** the binary is built
   **When** `./ma-agents list` is run
   **Then** all skills in the `skills/` directory are discovered and listed (currently 28)
   **And** all registered agents are listed with correct names and categories (currently 12, including OpenCode per FR56)

5. **Given** the binary is built
   **When** `./ma-agents install --yes` is run targeting multiple agents
   **Then** skills are installed to correct directories per agent configuration
   **And** manifest `.ma-agents.json` is created/updated correctly
   **And** `MANIFEST.yaml` is generated in the skills directory

## Tasks / Subtasks

- [ ] Task 1: Implement build script (AC: #1)
  - [ ] 1.1: Create `scripts/build-standalone.js` (or `.sh`) implementing the approach from Story 5-1 research
  - [ ] 1.2: Add `build:standalone` script to `package.json` scripts
  - [ ] 1.3: Configure asset bundling to include:
    - `skills/` directory (all 28 skill directories with skill.json, SKILL.md, templates/)
    - `lib/bmad-customizations/` (BMAD agent customizations)
    - `lib/bmad-workflows/` (BMAD workflow definitions)
    - `lib/mil498-templates/` (MIL-STD-498 templates)
  - [ ] 1.4: Handle the `bin/cli.js` entry point as the main executable
  - [ ] 1.5: Ensure all 3 dependencies (`prompts`, `chalk@4`, `fs-extra`) are bundled
  - [ ] 1.6: Build for current platform as initial test
- [ ] Task 2: Handle dynamic fs resolution (AC: #2, #4)
  - [ ] 2.1: Based on chosen approach, implement fs interception or asset extraction for:
    - Skill discovery (`fs.readdirSync` on skills directory)
    - Skill file reading (`fs.readFileSync` for skill.json, SKILL.md, templates)
    - BMAD content reading (`fs.readFileSync` for customizations, workflows, templates)
  - [ ] 2.2: If Node SEA: implement `sea.getAsset()` shim or startup extraction to temp dir
  - [ ] 2.3: If pkg: configure `pkg.assets` in package.json and verify `/snapshot/` fs interception
  - [ ] 2.4: Verify `process.cwd()` and `os.homedir()` resolve correctly (output paths, not embedded)
- [ ] Task 3: Cross-platform builds (AC: #1)
  - [ ] 3.1: If approach supports cross-compilation (pkg): build all 3 platforms from one machine
  - [ ] 3.2: If approach requires per-platform builds (Node SEA): document build matrix for CI
  - [ ] 3.3: Configure output directory (e.g., `dist/`) for built binaries
  - [ ] 3.4: Add `dist/` to `.gitignore`
- [ ] Task 4: Functional testing (AC: #2, #3, #4, #5)
  - [ ] 4.1: Test `./ma-agents list` — verify all 28 skills discovered, all 11 agents listed
  - [ ] 4.2: Test `./ma-agents install --yes` — verify skill installation to correct directories
  - [ ] 4.3: Test manifest creation/update (.ma-agents.json and MANIFEST.yaml)
  - [ ] 4.4: Test BMAD installation (`./ma-agents install` with BMAD option)
  - [ ] 4.5: Test on machine without Node.js installed (or rename/hide Node.js temporarily)
  - [ ] 4.6: Test in offline/air-gapped mode (disconnect network, verify no network errors)
  - [ ] 4.7: Test interactive mode (prompts work in binary)
  - [ ] 4.8: Test non-interactive mode (`--yes` flag)

6. **Given** the binary is built for any platform
   **When** the binary size is measured
   **Then** it does not exceed 100MB per platform
   **And** if the binary exceeds 100MB, the build script emits a warning and the story requires explicit approval to proceed

## Dev Notes

### Architecture Compliance

- **Additional distribution channel:** The standalone binary supplements `npx ma-agents`, not replaces it. The `package.json` bin entry and npm distribution remain unchanged. [Source: architecture.md#Infrastructure-Deployment]
- **No source code changes to lib/:** If the packaging approach requires code changes to lib/ modules, reconsider the approach. The build script should work with the existing code. [Source: architecture.md#Anti-Patterns]
- **Build-time only:** The packaging tool is a `devDependency`, not a runtime dependency. [Source: architecture.md#Anti-Patterns]

### Dependency on Story 5-1

This story **cannot be implemented** until Story 5-1 selects the packaging approach. The implementation varies significantly:

**If Node SEA selected:**
- Build script uses `node --experimental-sea-config sea-config.json` + `postject` to inject blob
- Asset bundling via sea-config.json `assets` field
- May need startup shim for `fs` redirection to `sea.getAsset()`
- Cross-platform builds require CI matrix (build on each target OS)

**If pkg selected:**
- Build script uses `pkg . --targets node20-win-x64,node20-macos-x64,node20-linux-x64`
- Asset bundling via `package.json` `pkg.assets` globs
- `fs` interception is transparent (virtual `/snapshot/` filesystem)
- Cross-platform builds from single machine

### Current Project Structure to Bundle

```
bin/cli.js              → Entry point (41 lines — routes to lib/)
lib/installer.js        → Core install engine (heaviest module)
lib/agents.js           → Agent registry (11 agents, 273 lines)
lib/bmad.js             → BMAD integration
lib/bmad-customizations/ → Agent customize.yaml files
lib/bmad-workflows/      → BMAD workflow content
lib/mil498-templates/    → MIL-STD-498 DID templates
index.js                → Programmatic API
skills/                 → 28 skill directories
node_modules/           → prompts, chalk@4, fs-extra (and their deps)
```

### Binary Size Estimation

- Source code: ~50KB
- Skills: ~500KB (28 directories with markdown/json)
- BMAD content: ~200KB
- MIL-498 templates: ~150KB
- node_modules: ~2MB (prompts + chalk@4 + fs-extra)
- Node.js runtime: ~40-80MB (varies by packaging approach)
- **Estimated total: 45-85MB per platform binary**

### CI/CD & Distribution (Out of Scope)

This story covers building the binaries. Automating binary builds in CI, publishing release artifacts, versioning binaries, and distributing them to air-gapped environments are NOT covered here. A separate story (5.3) should be created when the binary pipeline is proven. The "how do binaries reach users" question is intentionally deferred to keep this story focused on build correctness.

### Phase 2 Dependencies (Cross-Reference)

If Phase 2 epics (8-12) ship before this story:
- **Epic 8 (BMAD extension module):** The binary must bundle `lib/bmad-extension/` alongside existing BMAD content. Update Task 1.3 asset bundling list.
- **Epic 9 (OpenCode):** Agent count changes from 11 to 12. AC #4 already uses dynamic language ("all registered agents").
- **Epic 11-12 (Bug/Sprint workflows):** Extension workflows are part of `lib/bmad-extension/` — bundled automatically if Epic 8 dependency is handled.

Before implementing, check current state of `lib/agents.js` and `lib/bmad-extension/` to capture any Phase 2 additions.

### Critical Guardrails

- **Do NOT modify lib/ source files** to accommodate packaging [Source: architecture.md#Anti-Patterns]
- **Do NOT add runtime dependencies** — packaging tool is devDependency only
- **Do NOT remove npm distribution** — standalone binary is additional, not replacement
- **Do NOT hardcode paths** — use path.join() even in build scripts [Source: architecture.md#Enforcement-Guidelines]
- **Preserve `--yes` flag behavior** — must work identically in binary for CI/CD use (Epic 1)

### Project Structure Notes

- Files to create: `scripts/build-standalone.js`, `dist/` output directory
- Files to modify: `package.json` (add devDependency, add build:standalone script), `.gitignore` (add dist/)
- No changes to `lib/`, `bin/`, or `skills/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5] — Story 5.2 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-Deployment] — Self-contained installer decision
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical-Constraints] — Zero runtime, air-gapped, cross-platform
- [Source: _bmad-output/implementation-artifacts/5-1-standalone-binary-packaging.md] — Prerequisite story (packaging research)
- [Source: package.json] — Current package config, dependencies, engine requirements
- [Source: lib/installer.js] — Dynamic fs operations that must work in binary
- [Source: lib/agents.js] — Agent registry (check current count; 12 agents expected after Epic 9: 7 IDE incl. OpenCode + 4 BMAD + Antigravity)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
