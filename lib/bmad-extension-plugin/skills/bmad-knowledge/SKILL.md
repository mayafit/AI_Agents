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

Generate a self-contained, offline-ready Knowledge Atlas HTML site from the project's planning and implementation artifacts. No network access is required at generation or view time.

## Knowledge Store Binding Preflight

**Gateway check — run this before anything else in this skill.** Before any read, any write, any user prompt, and before any other routing or configuration step below. No other step of this skill executes until this preflight returns PROCEED.

`_bmad/bmm/config.yaml` is a GENERATED file. `ma-agents` derives it from the committed binding in `_bmad-output/project-layout.yaml` on install and on `ma-agents bind`, and records which binding it was generated from in its `project_layout_stamp:` field. If the binding has moved since — the usual cause is a `git pull` that relocated a knowledge store — every path this skill would resolve from `config.yaml` points at where the stores used to be. This preflight refuses to let that happen silently.

**This preflight is read-only.** Whatever it finds, do NOT regenerate, repair, edit or create `config.yaml`, `_bmad-output/project-layout.yaml`, or any other file, and do not offer to. Regenerating the config belongs to the installer and to `ma-agents bind`, never to a skill.

**Compare content, never timestamps.** Never decide staleness from file modification times: mtime ordering is not preserved by `git pull`, `git checkout` or a fresh clone, so it both misses real drift and reports drift on a clean checkout.

Work through the steps below IN ORDER and stop at the first branch that matches. The order is load-bearing — `_bmad-output/project-layout.yaml` is the fact, and the stamp only ever corroborates it.

### Step P1 — Read `_bmad-output/project-layout.yaml`

- **Missing, or present but blank / comments-only** → go to **Step P2**.
- **Present but unusable** — not valid YAML, unresolved merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), no readable fields, or a `schema_version:` greater than `2` → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding cannot be read.**
  > `_bmad-output/project-layout.yaml` exists but this build cannot use it: {say exactly what is wrong}.
  > Every knowledge-store path in `_bmad/bmm/config.yaml` is derived from that file, so nothing this skill would resolve can be trusted. Fix the binding by hand — if this is a merge conflict, resolve it; the file is committed, so conflicts are ordinary — then run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from it.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  Do not fall back to defaults and do not treat this as "no binding". A binding that cannot be read is a different fact from a project that has none.
- **Present and readable** → go to **Step P3**.

### Step P2 — There is no committed binding

No `_bmad-output/project-layout.yaml`. That is the pre-F26 shape and by itself it is NOT drift — but corroborate it instead of trusting it, because "a binding was never written here" and "the binding was deleted, ignored, or not pulled" look identical from the missing file alone. Read `_bmad/bmm/config.yaml`:

- **`config.yaml` does not exist either** → **HALT** and report:

  > **ma-agents — stopping: this project is not configured.**
  > Neither `_bmad-output/project-layout.yaml` nor `_bmad/bmm/config.yaml` exists, so nothing states where this project's knowledge stores live. Run `npx ma-agents install` to configure the project, or `ma-agents bind` if ma-agents is already installed and only the binding is missing.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`config.yaml` exists and contains any of `project_layout_stamp:`, `system_requirements_path:` or `software_requirements_path:`** → **HALT** and report:

  > **ma-agents — stopping: the committed knowledge binding is missing.**
  > `_bmad/bmm/config.yaml` carries {name the fields you found}, which only an F26 generation writes — so this project HAS been bound — but `_bmad-output/project-layout.yaml` is not here. The binding was deleted, is untracked or ignored, or has not been pulled. This is not a pre-F26 project, so proceeding would mean trusting generated paths against a binding that no longer exists.
  > Restore the file (for example `git checkout -- _bmad-output/project-layout.yaml`), or run `ma-agents bind` to write a fresh one.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

  Those three fields are the discriminator and they are reliable: a genuine pre-F26 `config.yaml` carries none of them. Do not skip this check. An absent stamp on its own is never evidence that a project predates the stamp.

- **`config.yaml` exists and carries none of those three fields** → this is genuinely a pre-F26 project. **PROCEED** with the rest of this skill exactly as it behaved before F26, and say nothing at all about the binding — no warning, no prompt, no offer to bind. Nothing has moved, so there is nothing to re-bind.

### Step P3 — The binding is readable: check what `config.yaml` was generated from

Read `_bmad/bmm/config.yaml`.

- **`config.yaml` does not exist** → **HALT** and report:

  > **ma-agents — stopping: the generated config is missing.**
  > `_bmad-output/project-layout.yaml` commits this project's knowledge binding, but `_bmad/bmm/config.yaml` — the file this skill resolves its paths from — has never been generated from it. Run `npx ma-agents install` to install into this project, or `ma-agents bind` if ma-agents is already installed, to generate `_bmad/bmm/config.yaml` from the committed binding.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **No `project_layout_stamp:` line at column 0 of `config.yaml`** (a commented-out or indented one does not count — it is not the field) → **HALT** and report:

  > **ma-agents — stopping: `_bmad/bmm/config.yaml` does not record which binding it came from.**
  > `_bmad-output/project-layout.yaml` exists, but `config.yaml` carries no `project_layout_stamp:`, so there is no evidence its paths were generated from the committed binding. Run `ma-agents bind` to regenerate it.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`project_layout_stamp:` is present but its value is not `sha256:` followed by exactly 64 lowercase hexadecimal characters** — truncated, uppercased, a different algorithm, unbalanced quotes, or trailing content after the digest → **HALT** and report:

  > **ma-agents — stopping: `_bmad/bmm/config.yaml` claims to have been generated and the claim cannot be read.**
  > Its `project_layout_stamp:` is {quote the value you found}, which is not a stamp ma-agents wrote (expected `sha256:` followed by 64 lowercase hex characters) — merge damage, a hand-edit, or a truncated write. Treat this config as unverified; it is NOT a config that predates the stamp. Run `ma-agents bind` to regenerate it from `_bmad-output/project-layout.yaml`.
  > Nothing has been read or written on your behalf. Stopping rather than guessing.

- **`project_layout_stamp:` is well-formed** → go to **Step P4**.

### Step P4 — Compare the committed binding against the generated fields

Derive, from `_bmad-output/project-layout.yaml`, what each generated field in `config.yaml` WOULD be if it were regenerated right now, and compare it to what `config.yaml` actually carries. This is a content comparison of the two files — never a timestamp comparison.

A schema-2 binding holds three records: `system_requirements_store:`, `software_requirements_store:` and `sprint_management:`. A legacy schema-1 binding holds a single `knowledgebase:` record, which stands for BOTH requirement stores.

| Derived from the binding | Field it generates in `config.yaml` |
| --- | --- |
| `software_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`) | `software_requirements_path:` and `knowledgebase_path:` |
| `system_requirements_store` → its `path:` (or `.` when its `backend:` is not `file-system`) | `system_requirements_path:` |
| `sprint_management` with `mode: jira` | `sprint_backend: jira`, `jira_url:`, `jira_project_key:` — and no `sprint_management_path:` |
| `sprint_management` with any other mode → its `path:` | `sprint_backend: file-system` and `sprint_management_path:` |
| software store path is `.` | `planning_artifacts: {project-root}/_bmad-output/planning-artifacts` — otherwise `planning_artifacts:` equals that path |
| sprint path is `.` | `implementation_artifacts: {project-root}/_bmad-output/implementation-artifacts` — otherwise `implementation_artifacts:` equals that path |

**Any disagreement is drift** → **HALT** and report, naming every store that moved and both of its paths:

> **ma-agents — stopping: `_bmad/bmm/config.yaml` is stale.**
> The committed binding in `_bmad-output/project-layout.yaml` no longer matches the state `_bmad/bmm/config.yaml` was generated from:
> - {store name}: was `{path in config.yaml}`, is now `{path in project-layout.yaml}`
> (one line per store that moved)
> Running this skill now would read and write artifacts where those stores used to be. Run `ma-agents bind` to regenerate `_bmad/bmm/config.yaml` from the committed binding, then run this skill again.
> Nothing has been read or written on your behalf. Stopping rather than guessing.

**If everything in the table agrees** → go to **Step P5**.

The stamp covers binding state that `config.yaml` does not carry — a store's `backend:`, a Confluence `space_key:` or `root_page:`, a `gitUrl:` — so the table alone cannot see every kind of move. If, and only if, a command shell is available to you and `ma-agents` resolves as a local dependency of this project, you may confirm the comparison exactly, without parsing the stamp yourself:

```bash
node -e "const c=require('ma-agents/bin/cli.js'),f=require('fs'),p=process.cwd();const t=c.resolveProjectTopology(p);if(!t.ok){console.log('binding:'+t.reason)}else{const s=c.readProjectLayoutStamp(f.readFileSync('_bmad/bmm/config.yaml','utf8'));console.log(s.ok?(s.value===c.computeProjectLayoutStamp(t.topology,p)?'MATCH':'DRIFT'):'stamp:'+s.reason)}"
```

`DRIFT` is authoritative: HALT with the stale-config message above even when the table found nothing, and say that the binding changed in a way `config.yaml` does not record. Never treat a failure to run this command as a result — if it does not run, the table is the check, and you say nothing about the stamp.

### Step P5 — PROCEED

The generated config matches the committed binding. Say NOTHING about the binding, the stamp or this preflight — a matched project gets no message — and continue with the rest of this skill.

## Prerequisites

- The project must have a `_bmad-output/` directory (created by BMAD install) and/or a `_bmad/bmm/config.yaml` pointing at where its knowledge actually lives.
- `ma-agents` must be installed (globally via `npx ma-agents` or as a local dependency).
- Node.js >= 18 must be available.

## Source discovery (engine-side — nothing for this skill to configure)

The engine itself resolves WHICH folders to scan — this skill just passes `projectRoot` (Step 1) and lets `atlas.cjs` do the rest:

- It always scans `<projectRoot>/<output_folder>` (`output_folder` defaults to `_bmad-output`).
- If the project has `_bmad/bmm/config.yaml`, it ALSO scans any configured `planning_artifacts`, `implementation_artifacts`, and `knowledgebase_path` folders that exist on disk — even when they live OUTSIDE `_bmad-output` (a common real-world setup: e.g. `planning_artifacts` pointing at a sibling knowledge folder). All of these are unioned and deduplicated automatically.
- A project with no `_bmad/bmm/config.yaml` (or none of the above keys) behaves exactly as before: scan `_bmad-output` only.
- The generated site is written to `<projectRoot>/<output_folder>/knowledge-site/` (so if `output_folder` is customized, the site follows it).
- Before writing, the engine purges the DEFAULT `<output_folder>/knowledge-site/` dir so removed/renamed docs leave no orphaned pages. It never touches a configured knowledge source, and it skips the purge entirely if a source resolves at/under that output dir (a warning is printed). A caller-supplied `--out` override is intentionally NOT purged — the engine only ever clears the default site dir.

---

## Workflow

### Step 1 — Resolve the project root

The project root is the directory containing `_bmad-output/` (and/or `_bmad/bmm/config.yaml`). Locate it by walking up from the current working directory until either is found, or use the directory the agent is operating in.

```
projectRoot = <directory containing _bmad-output/ and/or _bmad/bmm/config.yaml>
outputSite  = <projectRoot>/<output_folder>/knowledge-site/index.html   (output_folder defaults to _bmad-output)
```

This skill does NOT need to know which knowledge folders exist or where `output_folder` points — the engine reads `_bmad/bmm/config.yaml` itself and reports the real output path on stdout/stderr in Step 3.

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

Report the output path to the user regardless of whether the browser opens
(the ARGV output printed by the engine in Step 3 is the source of truth — it
reflects the real `output_folder`, which may differ from `_bmad-output`):
```
Knowledge Atlas generated: <projectRoot>/<output_folder>/knowledge-site/index.html
```

---

## Gitignore policy

The `<output_folder>/knowledge-site/` directory (default `_bmad-output/knowledge-site/`) is automatically gitignored when BMAD installs into a project (via `ensureKnowledgeSiteIgnored`). If it is not already ignored, add the following line to `.gitignore` (adjusted for a customized `output_folder`):

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
