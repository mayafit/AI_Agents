# Story 4.1: Visual Studio Agent Registry Entry

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Chief Architect**,
I want to understand how Visual Studio exposes AI agent configuration and add VS as a supported agent,
So that engineers can install skills into Visual Studio's AI assistant.

## Acceptance Criteria

1. **Given** Visual Studio has GitHub Copilot integration
   **When** the integration mechanism is investigated
   **Then** a technical note is produced documenting:
   - Where VS stores AI agent instructions (file paths, config directories)
   - What format VS expects (markdown, JSON, YAML, or other)
   - How VS Copilot Chat extensions handle custom instructions
   - Whether `.vs/` directory, `.editorconfig`, or another mechanism is used
   - Platform path differences (Windows-only or cross-platform VS Code distinction)

2. **Given** the research is complete
   **When** the findings are documented
   **Then** a clear recommendation exists for the agent registry configuration object fields

3. **Given** the VS agent configuration is understood
   **When** a new agent object is added to `lib/agents.js`
   **Then** it includes: name, category, platform paths, instruction file, and resource map
   **And** no changes are needed to `installer.js` or other modules (NFR13)

4. **Given** the VS agent is registered
   **When** `npx ma-agents list --agents` is run
   **Then** Visual Studio appears in the agent list

5. **Given** a skill is installed targeting the VS agent
   **When** the install completes
   **Then** skill content is placed in the correct VS configuration directory
   **And** the manifest tracks the VS agent installation

> **Note:** AC #5 overlaps with Story 4-2 scope. Verify basic install here; detailed template resolution and multi-agent testing belongs in 4-2.

## Tasks / Subtasks

- [ ] Task 1: Research Visual Studio AI agent configuration (AC: #1, #2)
  - [ ] 1.1: Investigate GitHub Copilot in Visual Studio (not VS Code) — how custom instructions are configured
  - [ ] 1.2: Check for `.github/copilot/copilot.md` support in VS (this is the VS Code Copilot instruction file per `lib/agents.js:79` — does VS use the same mechanism?)
  - [ ] 1.3: Investigate VS-specific paths: `.vs/` directory, `%APPDATA%/Microsoft/VisualStudio/`, or solution-level config
  - [ ] 1.4: Check if VS supports `.editorconfig`-adjacent AI instruction files
  - [ ] 1.5: Document findings in `_bmad-output/implementation-artifacts/vs-agent-research.md`
  - [ ] 1.6: Produce recommendation for agent registry object fields matching the actual schema: `id`, `name`, `version`, `category`, `description`, `getProjectPath()`, `getGlobalPath()`, `fileExtension`, `template`, `instructionFiles[]`, and optionally `resourceMap`
- [ ] Task 2: Add VS agent to registry (AC: #3, #4)
  - [ ] 2.1: Add agent configuration object to the agents array in `lib/agents.js` (search: `const agents = [`)
  - [ ] 2.2: Set `id`, `name`, `version`, `category` ("ide"), `description`, `fileExtension`, `template` based on research findings
  - [ ] 2.3: Implement `getProjectPath()` and `getGlobalPath()` functions with platform-specific paths (follow pattern from existing agents — Windows/macOS/Linux branches using `os.platform()`)
  - [ ] 2.4: Set `instructionFiles` array based on VS's instruction file path
  - [ ] 2.5: Add `resourceMap` only if VS uses non-standard directory names (like Cline does at `agents.js:122-125`) — otherwise omit
  - [ ] 2.6: Verify no changes needed to `installer.js` — the installer should pick up the new agent automatically (NFR13)
  - [ ] 2.5: Run `npx ma-agents list --agents` — verify VS appears
- [ ] Task 3: Test skill installation to VS agent (AC: #5)
  - [ ] 3.1: Install a skill targeting the VS agent
  - [ ] 3.2: Verify files are placed in the correct VS configuration directory
  - [ ] 3.3: Verify manifest tracks the VS installation
  - [ ] 3.4: Test on Windows (VS is primarily Windows — macOS VS for Mac is deprecated)

## Dev Notes

### Epic Scope Note

This story combines Epic 4 Story 4.1 (research) and Story 4.2 (add to registry) from the epics file into a single story. The companion story 4-2 covers template format verification — a scope not defined in the original epics. This was an intentional consolidation: research without registry implementation is incomplete, and template verification is a natural second story.

### Architecture Compliance

- **Adding a new agent = adding one object to the registry array.** No installer code changes needed. This is the core extensibility model. [Source: architecture.md#Extensibility-Model, NFR13]
- **Agent registry in `agents.js`:** Pure data + path functions. Each agent is a configuration object: name, category, platform paths, instruction file, resource map. [Source: architecture.md#Module-Boundaries]
- **Platform path centralization:** All platform awareness lives in `agents.js`. The installer uses `agents.js` for path resolution and is format-agnostic. [Source: architecture.md#Enforcement-Guidelines]

### Existing Agent Registry Pattern

Follow the exact pattern of existing agents. Example from the `copilot` agent in `lib/agents.js:60-80` (closest to VS):

```javascript
{
  id: 'copilot',
  name: 'GitHub Copilot',
  version: '1.0.0',
  category: 'ide',
  description: 'GitHub Copilot Agent Mode',
  getProjectPath: () => path.join(process.cwd(), '.github', 'copilot', 'skills'),
  getGlobalPath: () => {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'GitHub Copilot', 'skills');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'GitHub Copilot', 'skills');
    } else {
      return path.join(os.homedir(), '.config', 'github-copilot', 'skills');
    }
  },
  fileExtension: '.md',
  template: 'generic',
  instructionFiles: ['.github/copilot/copilot.md']
}
```

**Note:** Only `cline` has a `resourceMap` field (maps `references` → `docs`, `assets` → `templates`). All other agents omit it. Only add `resourceMap` for VS if research shows it uses non-standard directory names.

The VS agent may use the same `.github/copilot/copilot.md` path if VS and VS Code share the same Copilot instruction mechanism. Research (Task 1) will determine this.

### Research Priorities

**Most likely outcome:** VS uses `.github/copilot/copilot.md` (same as VS Code Copilot — see `lib/agents.js:79`). In this case:
- The existing `copilot` agent may already cover VS
- Or VS may need a separate entry with the same paths but a different `id`/`name` for clarity
- Check if VS has additional instruction files beyond what VS Code supports

**Alternative outcomes:**
- VS uses `.vs/` directory for AI instructions (solution-level)
- VS uses `%APPDATA%` paths for user-level AI config
- VS has its own instruction format (not markdown)

### Windows-Only Consideration

Visual Studio is Windows-only (macOS Visual Studio for Mac was discontinued in 2024). The agent registry entry should:
- Set platform paths for Windows only (or gracefully skip on macOS/Linux)
- Use Windows-style paths where needed (though `path.join()` handles this automatically)
- Consider that the `copilot` agent already handles `.github/` paths cross-platform

### Phase 2 Injection Strategy (NOT YET IMPLEMENTED)

**Note:** `injectionStrategy` is a Phase 2 planned feature from architecture decision P2-1. It does NOT exist in the current codebase. When Phase 2 is implemented, the VS agent may gain:

```javascript
injectionStrategy: {
  position: 'top',
  skipPatterns: ['---']  // skip YAML frontmatter
}
```

For this story, focus on the current agent schema fields only. The `injectionStrategy` will be added in a separate Phase 2 epic.

### Critical Guardrails

- **Only modify `lib/agents.js`** — no changes to installer.js, cli.js, or bmad.js [Source: architecture.md, NFR13]
- **Use `path.join()` for all paths** [Source: architecture.md#Enforcement-Guidelines]
- **No `process.platform` checks outside agents.js** — use `os.platform()` inside `getProjectPath()`/`getGlobalPath()` only [Source: architecture.md#Anti-Patterns]
- **No new npm dependencies** [Source: architecture.md#Anti-Patterns]

### Project Structure Notes

- Files to modify: `lib/agents.js` (add agent entry)
- Files to create: `_bmad-output/implementation-artifacts/vs-agent-research.md` (research findings)
- No changes to installer, CLI, or BMAD modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4] — Story 4.1 and 4.2 definitions
- [Source: _bmad-output/planning-artifacts/prd.md#IDE-Agent-Integration-Model] — VS listed as gap
- [Source: _bmad-output/planning-artifacts/architecture.md#Extensibility-Model] — Agent registry model (NFR13)
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-P2-1] — Injection strategy pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Module-Boundaries] — agents.js responsibility
- [Source: lib/agents.js] — Current agent registry (11 agents: 7 IDE + 4 BMAD)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
