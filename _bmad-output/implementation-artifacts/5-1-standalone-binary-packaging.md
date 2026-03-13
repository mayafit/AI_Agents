# Story 5.1: Evaluate and Select Standalone Binary Packaging Approach

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to evaluate Node SEA, pkg, and nexe for creating a standalone binary of ma-agents,
So that we select the right packaging approach for air-gapped distribution without npm or Node.js.

### Scope Clarification

**Existing capability (Phase 1, FR44):** Air-gapped install already works for environments that have Node.js and npm cached locally — `npx ma-agents` executes without internet access since the tool makes zero network calls. Cross-platform support (FR45) is delivered via Node.js.

**This story's scope:** Eliminate the Node.js and npm dependency entirely — produce a standalone binary that runs without any runtime prerequisites. This is the "no npm dependency" gap identified in PRD Phase 3.

## Acceptance Criteria

1. **Given** the three packaging options (Node SEA, pkg, nexe)
   **When** each is evaluated against ma-agents requirements
   **Then** a comparison document is produced in `_bmad-output/implementation-artifacts/standalone-packaging-research.md` covering:
   - Cross-platform support (Windows, macOS, Linux)
   - Binary size (baseline: ma-agents with full `skills/` directory and `_bmad/` content)
   - Node.js version requirements (current: `>=16.0.0` per `package.json:33`)
   - Ability to bundle the entire `skills/` directory (28 skill directories) as embedded assets
   - Ability to bundle BMAD content (`lib/bmad-customizations/`, `lib/bmad-workflows/`, `lib/mil498-templates/`)
   - Handling of dynamic `fs.readdirSync` and `fs.readFileSync` calls (the installer scans directories at runtime)
   - Maintenance status and community support as of 2026
   - Compatibility with the 3 runtime dependencies: `prompts`, `chalk@4`, `fs-extra`

2. **Given** the evaluation is complete
   **When** a recommendation is made
   **Then** it includes a proof-of-concept build demonstrating the chosen approach works with ma-agents
   **And** the PoC binary can successfully run `ma-agents list` (skill discovery via `fs.readdirSync`)

3. **Given** the PoC build is successful
   **When** the recommendation is documented
   **Then** it includes: chosen approach, rationale, known limitations, estimated binary size, and build script outline

4. **Given** all three packaging approaches (Node SEA, pkg, nexe) fail to handle ma-agents' dynamic fs operations
   **When** the evaluation concludes that none are viable
   **Then** the research document includes:
   - A clear "no viable option" conclusion with specific failure reasons per tool
   - Alternative approaches to evaluate (e.g., Bun compile, Deno compile, shell script with embedded tarball, self-extracting archive)
   - A recommendation on which alternative to investigate next
   **And** Story 5.2 is blocked until an alternative is selected and validated

## Tasks / Subtasks

- [ ] Task 1: Research Node SEA (Single Executable Applications) (AC: #1)
  - [ ] 1.1: Test Node SEA with Node 20+ (native support since Node 20)
  - [ ] 1.2: Evaluate asset bundling — Node SEA embeds a single JS blob; test whether `skills/` directory tree can be embedded via sea-config.json `assets` field
  - [ ] 1.3: Test dynamic `fs.readdirSync`/`fs.readFileSync` — does the binary resolve paths to embedded assets or fail?
  - [ ] 1.4: Check cross-platform build: can one machine build for Windows/macOS/Linux or does each platform require its own build?
  - [ ] 1.5: Measure binary size with all skills + BMAD content embedded
  - [ ] 1.6: Document Node SEA findings
- [ ] Task 2: Research pkg (AC: #1)
  - [ ] 2.1: Check pkg maintenance status (npm `@yao-pkg/pkg` fork since original `vercel/pkg` was deprecated)
  - [ ] 2.2: Test pkg `assets` and `scripts` configuration for bundling `skills/` and BMAD directories
  - [ ] 2.3: Test dynamic `fs` calls — pkg uses a virtual filesystem (`/snapshot/`) for embedded assets
  - [ ] 2.4: Verify cross-platform builds from single machine (pkg supports this natively)
  - [ ] 2.5: Measure binary size
  - [ ] 2.6: Document pkg findings
- [ ] Task 3: Research nexe (AC: #1)
  - [ ] 3.1: Check nexe maintenance status and Node.js version support (nexe historically lags behind Node releases)
  - [ ] 3.2: Test resource bundling capabilities for directory trees
  - [ ] 3.3: Test dynamic `fs` calls with nexe's patched `fs` module
  - [ ] 3.4: Verify cross-platform build support
  - [ ] 3.5: Measure binary size
  - [ ] 3.6: Document nexe findings
- [ ] Task 4: Build proof-of-concept (AC: #2)
  - [ ] 4.1: Select the most promising approach based on Task 1-3 findings
  - [ ] 4.2: Create a minimal build script (e.g., `scripts/build-standalone.js`)
  - [ ] 4.3: Build a PoC binary for the current platform
  - [ ] 4.4: Test: run `./ma-agents list` from the binary — verify skill discovery works
  - [ ] 4.5: Test: run `./ma-agents install --yes` to a temp directory — verify file operations work
- [ ] Task 5: Document recommendation (AC: #3)
  - [ ] 5.1: Write `_bmad-output/implementation-artifacts/standalone-packaging-research.md` with comparison table and recommendation
  - [ ] 5.2: Include build script outline for Story 5-2 to implement

## Dev Notes

### Architecture Compliance

- **Zero runtime component:** ma-agents is install-time only. The binary doesn't need to stay running — it executes, copies files, and exits. [Source: architecture.md#Technical-Constraints]
- **No network calls:** The binary must work fully offline (air-gapped). The tool already makes no network calls — packaging must preserve this. [Source: architecture.md, NFR4]
- **Cross-platform paths:** All path handling uses `path.join()` via `agents.js`. The binary must preserve this behavior. [Source: architecture.md#Enforcement-Guidelines]

### Key Technical Challenge: Dynamic File System Access

The ma-agents codebase heavily uses dynamic `fs` operations that packaging tools handle differently:

1. **Skill discovery** (`installer.js`): `fs.readdirSync('skills/')` scans for skill directories at runtime
2. **Skill reading** (`installer.js`): `fs.readFileSync(skillPath)` reads skill.json, SKILL.md, templates
3. **Agent path resolution** (`agents.js`): `process.cwd()` and `os.homedir()` for output paths (these should work normally — they're output paths, not embedded assets)
4. **BMAD content** (`bmad.js`): Reads from `lib/bmad-customizations/`, `lib/bmad-workflows/`, `lib/mil498-templates/`

The packaging tool must either:
- Intercept `fs` calls and redirect to the embedded virtual filesystem (pkg does this)
- Provide an API to access embedded assets (Node SEA does this via `sea.getAsset()`)
- Or extract assets to a temp directory at startup (any tool can do this)

### Current Dependencies

From `package.json`:
- `prompts@^2.4.2` — interactive prompts (must work in binary, no native modules)
- `chalk@4` — console colors (pure JS, should work in any packaging tool)
- `fs-extra@^11.1.1` — enhanced fs operations (pure JS, should work)
- Node.js engine: `>=16.0.0` (Node SEA requires 20+)

### Node SEA Considerations (Most Likely Choice)

Node SEA (Single Executable Applications) is the most likely winner because:
- Native to Node.js since v20 — no third-party dependency
- Actively maintained by Node.js core team
- Supports `assets` in sea-config.json (Node 21+)
- Aligns with the project's minimal-dependency philosophy

**But:** Node SEA has limitations:
- Assets accessed via `require('node:sea').getAsset()` — not transparent to `fs.readFileSync`
- May require a wrapper/shim to intercept fs calls to embedded assets
- Cross-platform builds require building on each target platform

### pkg Considerations (Strong Alternative)

pkg (`@yao-pkg/pkg` fork) is the proven alternative:
- Transparent virtual filesystem — `fs.readFileSync` works against `/snapshot/` paths automatically
- Cross-platform builds from single machine
- Mature asset bundling via `package.json` `pkg.assets` configuration
- **But:** Third-party dependency, maintenance continuity uncertain

### Research Validity

This research story produces a document, not shipping code. If Story 5.2 is not started within 3 months of completing this research, the findings should be re-validated — packaging tools evolve, Node.js versions change, and tool maintenance status shifts. Re-run at minimum the PoC build (Task 4) before proceeding.

### Critical Guardrails

- **Do NOT add packaging tool as a runtime dependency** — it's a build-time dev dependency only
- **Do NOT modify `installer.js` or `agents.js`** to accommodate packaging — if the tool can't work with the existing code, it's the wrong tool
- **Preserve zero-install npm experience** — the standalone binary is an ADDITIONAL distribution channel, not a replacement for `npx ma-agents`
- **No new runtime npm dependencies** [Source: architecture.md#Anti-Patterns]

### Project Structure Notes

- Files to create: `_bmad-output/implementation-artifacts/standalone-packaging-research.md` (research document), optionally `scripts/build-standalone.js` (PoC build script)
- Files to potentially modify: `package.json` (add `devDependencies` for build tool, add `build:standalone` script)
- No changes to `lib/` source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5] — Story 5.1 definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-Deployment] — Phase 2 self-contained installer decision (flagged as needs investigation)
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical-Constraints] — Zero runtime, air-gapped operation
- [Source: package.json] — Current dependencies, engine requirements, bin entry
- [Source: lib/installer.js] — Dynamic fs operations for skill discovery
- [Source: lib/agents.js] — Agent registry (11 agents: 7 IDE + 4 BMAD)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
