---
name: bmad-knowledge
description: Generate a self-contained Knowledge Atlas HTML site from project planning and implementation artifacts
type: skill
triggers:
  - "knowledge atlas"
  - "generate knowledge site"
  - "bmad-knowledge"
---

# Knowledge Atlas Skill

Generate a self-contained, offline-ready Knowledge Atlas HTML site from the project's `_bmad-output` planning and implementation artifacts. No network access is required at generation or view time.

## Prerequisites

- The project must have a `_bmad-output/` directory (created by BMAD install).
- `ma-agents` must be installed (globally via `npx ma-agents` or as a local dependency).
- Node.js >= 18 must be available.

---

## Workflow

### Step 1 — Resolve the project root

The project root is the directory containing `_bmad-output/`. Locate it by walking up from the current working directory until `_bmad-output/` is found, or use the directory the agent is operating in.

```
projectRoot = <directory containing _bmad-output/>
bmadOutputDir = <projectRoot>/_bmad-output
outputSite = <projectRoot>/_bmad-output/knowledge-site/index.html
```

### Step 2 — Locate the engine bundle

The Knowledge Atlas engine is a pre-bundled CJS file committed inside the `ma-agents` package. Resolve it in this order:

1. **Installed package resolution (preferred):** Use Node.js module resolution to locate the bundle:
   ```js
   require.resolve('ma-agents/lib/knowledge-atlas/dist/atlas.cjs')
   ```
   This works when `ma-agents` is installed as a dependency or globally via `npx`.

2. **Dev-local fallback:** If the skill is being run from within the `ma-agents` repo itself (e.g., during development), use a path relative to the skill file:
   ```
   <skill_dir>/../../../../lib/knowledge-atlas/dist/atlas.cjs
   ```
   where `<skill_dir>` is the directory containing this SKILL.md.

3. If neither path resolves to an existing file, abort with:
   ```
   ERROR: Cannot locate atlas.cjs. Ensure ma-agents is installed:
     npm install -g ma-agents
     # or: npm install --save-dev ma-agents
   ```

### Step 3 — Run the engine

Execute the bundled engine as a Node.js subprocess. Pass `atlasPath` and
`projectRoot` as ARGUMENT-ARRAY elements (never interpolate them into a shell
string) so paths containing spaces, quotes, or shell metacharacters cannot be
misparsed or injected:

```js
const { spawnSync } = require('node:child_process');
const res = spawnSync(process.execPath, [atlasPath, projectRoot], {
  encoding: 'utf-8',
  // No `shell: true` — args go directly to the OS exec, not a shell.
});
if (res.status !== 0) {
  // Report res.stderr and abort.
  throw new Error(`atlas.cjs failed (exit ${res.status}): ${res.stderr}`);
}
const indexHtmlPath = res.stdout.trim(); // engine prints the index.html path
```

- The engine writes `_bmad-output/knowledge-site/index.html`.
- It prints the path to `stdout` on success.
- It exits with code 0 on success, non-zero on failure (error on stderr).
- It never modifies any source file — output is isolated to `_bmad-output/knowledge-site/`.

If the engine exits non-zero, report the stderr output and abort.

### Step 4 — Open the generated site

After successful generation, open `_bmad-output/knowledge-site/index.html` using
the appropriate method for the current environment. Use `execFile`/`spawn` with
an ARGUMENT ARRAY — never build a shell command string with the path
interpolated, which would be an injection vector:

**VSCode detection** (open in the editor):
```js
const { execFile } = require('node:child_process');
if (process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_PID !== undefined) {
  execFile('code', [indexHtmlPath]); // path is a discrete arg, not concatenated
}
```

**System default browser** (for all other environments) — pass the path as an
arg-array element to the platform opener:
- **Windows:** `execFile('cmd', ['/c', 'start', '', indexHtmlPath])`
- **macOS:**   `execFile('open', [indexHtmlPath])`
- **Linux:**   `execFile('xdg-open', [indexHtmlPath])`

Report the output path to the user regardless of whether the browser opens:
```
Knowledge Atlas generated: <projectRoot>/_bmad-output/knowledge-site/index.html
```

---

## Gitignore policy

The `_bmad-output/knowledge-site/` directory is automatically gitignored when BMAD installs into a project (via `ensureKnowledgeSiteIgnored`). If it is not already ignored, add the following line to `.gitignore`:

```
_bmad-output/knowledge-site/
```

---

## Notes

- **Offline by construction:** The generated `index.html` is fully self-contained — no external URLs, no CDN links, no web fonts. It can be opened from a local filesystem in any browser.
- **Deterministic output:** Pin `SOURCE_DATE_EPOCH` (Unix seconds) to get byte-identical output across runs:
  ```bash
  SOURCE_DATE_EPOCH=1700000000 node atlas.cjs "<projectRoot>"
  ```
- **No per-project install:** The engine (`atlas.cjs`) is pre-bundled in `ma-agents`. Consuming projects never run `npm install` for the Atlas engine.
