# Story 19.5: `open-graph` Skill

Status: ready-for-dev

## Story

As an **Engineer**,
I want to run `/open-graph` in any BMAD agent,
so that the knowledge graph visualization opens in VSCode (as a webview) or in my default browser when outside VSCode — without any additional configuration.

## Acceptance Criteria

1. **Given** `open-graph` is invoked inside VSCode (detected via `process.env.TERM_PROGRAM === 'vscode'` or `process.env.VSCODE_PID !== undefined`)
   **When** the skill runs
   **Then** it generates `_bmad-output/knowledge-graph.html` (if not already current) from the JSON data
   **And** opens the HTML file using `code "<htmlPath>"` command (opens in VSCode Simple Browser / Live Preview)

2. **Given** `open-graph` is invoked outside VSCode (standard terminal)
   **When** the skill runs
   **Then** it generates `knowledge-graph.html` from the current JSON data
   **And** opens it using the platform-appropriate command: `start` (Windows), `open` (macOS), `xdg-open` (Linux)

3. **Given** `_bmad-output/knowledge-graph.json` does not exist
   **When** `open-graph` is invoked
   **Then** the skill informs the user that no knowledge graph data has been generated yet
   **And** suggests running a BMAD planning skill (e.g., `create-prd`) to seed the graph

4. **Given** `knowledge-graph.html` already exists and is newer than `knowledge-graph.json`
   **When** `open-graph` is invoked
   **Then** the skill skips regeneration and opens the existing HTML directly

5. **Given** `open-graph` is invoked from a BMAD agent
   **When** it runs
   **Then** it is available as an `anytime` phase skill (not restricted to a specific workflow phase)
   **And** it appears in the BMAD module help output

## Tasks / Subtasks

### Task 1: Create BMAD extension skill directory and files (AC: 1, 2, 3, 4, 5)

- [ ] 1.1 Create directory: `lib/bmad-extension/skills/open-graph/`
- [ ] 1.2 Create `lib/bmad-extension/skills/open-graph/bmad-skill-manifest.yaml`:
  ```yaml
  type: skill
  name: open-graph
  module: ma-skills
  ```
- [ ] 1.3 Create `lib/bmad-extension/skills/open-graph/SKILL.md` with the complete skill workflow (see Task 3)
- [ ] 1.4 Register in `lib/bmad-extension/module-help.csv` — add row:
  ```
  ma-skills,anytime,Open Knowledge Graph,open-graph,,skill:open-graph,open-graph,false,,,Open the BMAD knowledge graph visualization in VSCode or browser.,_bmad-output,knowledge-graph.json,
  ```

### Task 2: Create the IDE skill source files (AC: 1, 2, 3, 4)

- [ ] 2.1 Create `skills/open-graph/skill.json`:
  ```json
  {
    "name": "open-graph",
    "version": "1.0.0",
    "description": "Open the BMAD knowledge graph visualization in VSCode or default browser",
    "category": "workflow",
    "tags": ["knowledge-graph", "visualization", "graph"]
  }
  ```
  Note: `always_load: false` — on-demand skill, not loaded for every task.
- [ ] 2.2 Create `skills/open-graph/SKILL.md` with the same core workflow as the BMAD extension version (may have minor phrasing differences for IDE context; logic must be identical)

### Task 3: Implement `SKILL.md` workflow content (AC: 1, 2, 3, 4)

Both SKILL.md files must implement the following logic:

- [ ] 3.1 **Step 1 — Locate graph data:**
  - Resolve `graphJsonPath = <projectRoot>/_bmad-output/knowledge-graph.json`
  - If file does not exist: output `"No knowledge graph data found. Run a BMAD planning skill (e.g., create-prd, create-architecture) to generate the graph first."` and exit (AC: 3)

- [ ] 3.2 **Step 2 — Check if regeneration needed:**
  - Resolve `graphHtmlPath = <projectRoot>/_bmad-output/knowledge-graph.html`
  - Compare mtime of `knowledge-graph.html` vs `knowledge-graph.json`:
    - If HTML exists AND `html.mtime > json.mtime`: skip regeneration, proceed to Step 3 (AC: 4)
    - Otherwise: call `generate-html.js` to regenerate HTML from JSON

- [ ] 3.3 **Step 3 — Generate HTML (if needed):**
  - Run `node lib/bmad-extension/skills/open-graph/generate-html.js <graphJsonPath> <graphHtmlPath>`
  - (The `generate-html.js` script is created in Story 19.6 — this story creates a placeholder that outputs a basic diagnostic page)

- [ ] 3.4 **Step 4 — Open in appropriate viewer:**
  ```javascript
  const isVSCode = process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined;
  if (isVSCode) {
    execSync(`code "${htmlPath}"`);  // opens in VSCode Simple Browser / Live Preview
  } else {
    const openCmd = process.platform === 'win32' ? 'start' :
                    process.platform === 'darwin' ? 'open' : 'xdg-open';
    execSync(`${openCmd} "${htmlPath}"`);
  }
  ```

### Task 4: Create `generate-html.js` placeholder (AC: 1, 2 — basic version)

Story 19.6 implements the full renderer. This story creates a functional placeholder so the skill works end-to-end:

- [ ] 4.1 Create `lib/bmad-extension/skills/open-graph/generate-html.js` as a Node.js script that:
  - Accepts arguments: `node generate-html.js <jsonPath> <htmlPath>`
  - Reads `knowledge-graph.json`
  - Writes a minimal HTML page that displays `meta.node_count`, `meta.edge_count`, and a `<pre>` dump of the JSON data
  - This placeholder will be replaced by the full renderer in Story 19.6

### Task 5: Verify deployment pipeline integration (AC: 5)

- [ ] 5.1 Run `npx ma-agents` (or `node lib/cli.js`) to trigger the installer
- [ ] 5.2 Verify IDE skill appears in installed MANIFEST.yaml (e.g., `.claude/skills/MANIFEST.yaml` includes `open-graph`)
- [ ] 5.3 Verify BMAD extension copy exists at `_bmad/extensions/ma-agents-skills/skills/open-graph/` after BMAD install
- [ ] 5.4 Verify `open-graph` appears in the BMAD module help output (`anytime` phase)

## Dev Notes

### CRITICAL: Two Deployment Pipelines

This story creates files in BOTH pipelines:
1. **IDE skill source:** `skills/open-graph/skill.json` + `skills/open-graph/SKILL.md`
   - Deployed by `lib/installer.js` to all agent directories
2. **BMAD extension skill source:** `lib/bmad-extension/skills/open-graph/SKILL.md` + `bmad-skill-manifest.yaml`
   - Deployed by `lib/bmad.js` to `_bmad/extensions/ma-agents-skills/`

**Reference skill for IDE pipeline:** `skills/story-status-lookup/` (working `skill.json` + `SKILL.md`)
**Reference skill for BMAD extension:** `lib/bmad-extension/skills/add-to-sprint/` (working `SKILL.md` + `bmad-skill-manifest.yaml`)

### Prerequisite: Story 19.1 Must Be Complete (for `generate-html.js`)

This story creates a `generate-html.js` placeholder (Task 4) that becomes the integration point for Story 19.6. The `generate-html.js` interface must be stable: `node generate-html.js <jsonPath> <htmlPath>`.

### VSCode Detection Logic (Architecture-Authoritative)

```javascript
const isVSCode = process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined;
if (isVSCode) {
  execSync(`code "${htmlPath}"`);
} else {
  const openCmd = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  execSync(`${openCmd} "${htmlPath}"`);
}
```

This exact pattern is specified in architecture Decision P3-1. Do NOT use a different detection mechanism.

### Skill Count Impact

This story increases the BMAD extension module skill count from 44 to 45. The `module-help.csv` row must use phase `anytime` (not a specific workflow phase). Verify the final count in `lib/bmad-extension/module-help.csv` after adding the row.

### `generate-html.js` Interface Contract

The interface between SKILL.md and `generate-html.js` is:
```
node lib/bmad-extension/skills/open-graph/generate-html.js <jsonPath> <htmlPath>
```

Arguments:
- `<jsonPath>`: absolute path to `knowledge-graph.json`
- `<htmlPath>`: absolute path where `knowledge-graph.html` should be written

Story 19.6 replaces the placeholder with the full interactive renderer, keeping the same interface.

### `always_load: false`

This is an on-demand skill. The `skill.json` must NOT include `always_load: true`. Omitting the key defaults to `false`.

### File Structure Created by This Story

```
skills/
└── open-graph/
    ├── skill.json                 ← NEW
    └── SKILL.md                   ← NEW

lib/
└── bmad-extension/
    └── skills/
        └── open-graph/
            ├── SKILL.md           ← NEW
            ├── bmad-skill-manifest.yaml  ← NEW
            └── generate-html.js   ← NEW (placeholder; replaced by Story 19.6)
```

**Modified:**
- `lib/bmad-extension/module-help.csv` ← add `open-graph` row

### Project Structure Notes

- Skill location `lib/bmad-extension/skills/open-graph/` follows the same pattern as all other extension skills (e.g., `lib/bmad-extension/skills/add-to-sprint/`)
- Epic 19 cross-epic notes: `open-graph` skill requires Epic 15 (BMAD 6.2.1 module structure) to be complete. Epic 15 is done as of this writing.

### References

- Architecture Decision P3-1 — Layer 3: `_bmad-output/planning-artifacts/architecture.md#layer-3-open-graph-skill-and-renderer`
- Reference IDE skill: `skills/story-status-lookup/`
- Reference BMAD extension skill: `lib/bmad-extension/skills/add-to-sprint/`
- `lib/bmad-extension/module-help.csv` — for phase registration pattern
- FR: FR153 (open-graph skill, VSCode/browser detection)
- Story 19.6: `_bmad-output/implementation-artifacts/19-6-interactive-visualization-renderer.md` — replaces `generate-html.js` placeholder

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
