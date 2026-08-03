# Story 31.1: Spike/GATE — Confirm What bmad-method v6.10.0 Supports for User-Level Installation

Status: review

## Story

As the **ma-agents maintainer**,
I want to establish — against a live `npm install bmad-method@6.10.0` — what user-level installation
actually supports (target directory, whether `--directory` accepts a user-scoped path, how module
resolution behaves outside a project),
So that Story 31.12 either implements a known global BMAD install or implements a known degradation
path, rather than discovering which mid-build. (FR250)

**Gate:** This is a HARD GATE for the **global-install thread only** (Stories 31.11, 31.12). Per
P5-9.8 a negative result shrinks that thread and changes nothing in Stories 31.2–31.10. This is a
CONFIRMATION spike, not open design — P5-9.8 is already written for both outcomes. Mirrors the
27.1 / 30.1 live-install gate precedent.

---

## GATE VERDICT: **FAIL**

`bmad-method@6.10.0` has **no user-level / global install target of any kind**, and — decisively —
**no module-resolution search order** that could find a user-level `_bmad/` from inside a project.
`--directory` will happily write a full `_bmad/` tree anywhere on disk including under `$HOME`, but
nothing at runtime will ever look there. FR249 therefore degrades to the FR250 path: ma-agents
skills install globally, BMAD stays project-scoped, and the installer reports the three facts named
in AC5 below.

**No part of P5-9.1 through P5-9.7 changes. This verdict does NOT block Stories 31.2–31.10.**

---

## Method and evidence basis

Live install, outside every git worktree, into
`…/scratchpad/spike-31-1/` (scratch dir per the story's method note; the repo's own
`node_modules/bmad-method` is a stale **6.9.0** and was deliberately not cited for any upstream
fact).

- `npm install bmad-method@6.10.0` → `package.json.version === "6.10.0"` (**LIVE_INSTALL:
  confirmed**).
- The installer **was driven non-interactively** — a full successful install run, exit 0, into a
  user-scoped `--directory`. Findings below are therefore RUN evidence except where explicitly
  marked READ.

Evidence tags used per finding:

- **[RUN]** — observed by executing the 6.10.0 installer / its scripts and reading what landed on
  disk.
- **[READ]** — read from 6.10.0 source. Used where no runnable path exists (e.g. proving the
  *absence* of a feature).

### The live run

```
node node_modules/bmad-method/tools/installer/bmad-cli.js install \
  --directory "$HOME/.bmad-spike-31-1" \
  --modules bmm --tools claude-code \
  --output-folder _bmad-output \
  --user-name SpikeUser --communication-language English --document-output-language English \
  --yes
```

Result: **exit 0**, `Installed to: C:\Users\995472\.bmad-spike-31-1\_bmad`, `claude-code
configured: 46 skills → .claude/skills`, and this on disk:

```
C:\Users\995472\.bmad-spike-31-1\
  _bmad\            _config\ bmm\ core\ custom\ scripts\ config.toml config.user.toml
  _bmad-output\     planning-artifacts\ implementation-artifacts\
  docs\
  .claude\skills\   (46 BMAD skills)
```

`~/.bmad` itself was deliberately **not** used as the target — it is already occupied by BMAD's own
`~/.bmad/cache/…` clone cache on this machine, and clobbering per-machine state is not the spike's
business. A sibling `~/.bmad-spike-31-1` proves the same property (a user-scoped absolute path
under `$HOME`). The `~`-literal form was tested separately and directly (see AC1(b)).

---

## Findings per acceptance criterion

### AC1(a) — Does bmad-method have any user-level / global install target at all? → **NO**

**Not met as a capability; established as a fact.**

- **[READ]** The `install` command exposes 17 options
  (`tools/installer/commands/install.js:12-51`): `--debug`, `--directory`, `--modules`, `--tools`,
  `--list-tools`, `--set`, `--list-options`, `--action`, `--user-name`,
  `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-source`,
  `--yes`, `--channel` / `--all-stable` / `--all-next`, `--next`, `--pin`. **There is no
  `--global`, `--user`, `--scope`, or equivalent.**
- **[READ]** A case-insensitive sweep of the entire `tools/` tree for
  `user-level | userLevel | globalInstall | installScope | --global` returns **zero matches**. The
  concept does not exist in the codebase.
- **[READ]** `README.md`, `AGENTS.md` and `tools/installer/README.md` contain **zero** mentions of
  `global install | globally | user-level | machine-wide`. It is not an undocumented feature either;
  it is simply absent.
- **[READ]** The single install target is computed in `core/install-paths.js:15-18`:
  ```js
  const projectRoot = path.resolve(config.directory);
  …
  const bmadDir = path.join(projectRoot, BMAD_FOLDER_NAME);   // BMAD_FOLDER_NAME === '_bmad'
  ```
  There is exactly one target, and it is `<--directory>/_bmad`. No branch, no scope parameter.
- **[READ]** The only genuinely user-level directory bmad-method owns is the **module clone cache**
  — `~/.bmad/cache/{external-modules,community-modules,custom-modules}/`
  (`project-root.js:80,162,191`, `modules/external-manager.js:194`,
  `modules/custom-module-manager.js:363`), overridable via `BMAD_EXTERNAL_MODULES_CACHE`. That is a
  **download cache, not an installation**. Nothing resolves modules *from* it at agent-activation
  time; it exists so the installer can copy out of it.

### AC1(b) — Does `--directory` accept a user-scoped path such as `~/.bmad`, and what does it write? → **YES, with a Windows caveat; and what it writes is a project, not a global install**

**Met.**

- **[RUN]** A user-scoped absolute path under `$HOME` is accepted and fully installed to (the live
  run above, exit 0). `--directory` is validated only for writability
  (`core/install-paths.js:107-130` `ensureWritableDir`), so any writable location works. There is
  no notion of "this looks like a home directory, behave differently".
- **[RUN]** What it writes there is a **complete project skeleton**: `_bmad/` (config, modules,
  scripts, `_config/manifest.yaml`), **plus** `_bmad-output/planning-artifacts/`,
  `_bmad-output/implementation-artifacts/` and `docs/`, **plus** `.claude/skills/` with 46 skills.
  Installing "globally" this way manufactures an empty phantom project in the user's home
  directory. (This is the same eager `directories:` materialisation behind bug B2 / the empty
  `docs/` bug, now reproduced one level worse: in `$HOME`.)
- **[RUN]** **Windows caveat — `--directory ~/.bmad` (the literal form AC1(b) names) THROWS on
  Windows.** `UI.expandUserPath` (`tools/installer/ui.js:1580-1600`) tests
  `expanded.startsWith('~' + path.sep)`, and `path.sep` is `\` on win32, so a forward-slash tilde
  path falls through to the "`~username`" branch and is rejected. Exercised directly against the
  installed 6.10.0 `UI` class:
  ```
  "~/.bmad"      => THROWS: Path expansion for ~/.bmad is not supported. Please use an absolute path or ~\
  "~/.bmad/sub"  => THROWS: (same)
  "~\.bmad"      => C:\Users\995472\.bmad
  "~"            => C:\Users\995472
  ```
  On POSIX (`path.sep === '/'`) `~/.bmad` expands correctly. So the answer to AC1(b) is
  platform-dependent: **`~/.bmad` works on Linux/macOS and fails on Windows**; `~\.bmad`, `~`, and
  absolute paths work everywhere. This is an upstream cross-platform defect, not an ma-agents one —
  and it is moot for us given the verdict, since ma-agents passes an already-resolved absolute path
  (`buildBmadArgs` → `--directory "<projectRoot>"`, `lib/bmad.js:742`).
- **[READ]** Collision note: `--directory ~` (or `~\.bmad`) puts `_bmad/` next to, or *inside*,
  `~/.bmad/cache/` — conflating the install tree with BMAD's own per-machine clone cache. Two
  unrelated lifecycles in one directory.

### AC1(c) — How does module resolution behave when a BMAD agent or skill activates outside a project? → **It does not resolve. There is no search order.** ← the decisive finding

**Met. This is what makes the verdict FAIL rather than PASS.**

- **[RUN]** The generated `_bmad/bmm/config.yaml` stores **unexpanded literals**, not the install
  directory:
  ```yaml
  planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
  implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
  project_knowledge: "{project-root}/docs"
  ```
  Same in `_bmad/config.toml` under `[modules.bmm]`. The install has no idea where it lives.
- **[READ]** `{project-root}` is by design **"left as a literal placeholder for the model/tool to
  expand at runtime"** — the explicit contract comment at
  `tools/installer/ide/_config-driven.js:94`, and `expandBodyTemplate` (line 96-98) substitutes
  only `{canonicalId}` and `{target_dir}`, never `{project-root}`.
- **[RUN]** The 46 installed skills carry **~211 hard-coded `{project-root}/_bmad/…` references** —
  63 × `resolve_customization.py`, 57 × `custom/`, 38 × `memlog.py`, 35 × `bmm/config.yaml`,
  4 × `core/config.yaml`, 3 × `resolve_config.py`, plus stragglers. Every one of them is
  *relative to the project*, unconditionally.
- **[RUN]** The config resolver **hard-fails** with no fallback. `resolve_config.py` takes
  `--project-root` as `required=True` (line 144), then does `bmad_dir = project_root / "_bmad"` and
  `load_toml(bmad_dir / "config.toml", required=True)` (lines 153-156). Executed against a bare
  project directory while a fully-installed `_bmad/` sat in the user-scoped location:
  ```
  $ python …/_bmad/scripts/resolve_config.py --project-root …/fake-project --key core
  error: required config file not found: …\fake-project\_bmad\config.toml
  EXIT=1
  ```
  and against the user-scoped install itself: `EXIT=0`, config returned. **No upward walk, no
  `~/.bmad` fallback, no environment override.**
- **[READ]** The JS side is the same single join, with no search at all —
  `Installer.findBmadDir` (`core/installer.js:1638-1641`):
  ```js
  async findBmadDir(projectDir) {
    const bmadDir = path.join(projectDir, BMAD_FOLDER_NAME);
    return { bmadDir };
  }
  ```
  `bmad status` calls it with `process.cwd()` (`commands/status.js:19`) and reports "No BMAD
  installation found in the current directory" when the join misses. There is no candidate list to
  extend.
- **[READ]** The only `BMAD_*` environment variables honoured anywhere in `tools/` + `src/` are
  `BMAD_DEBUG`, `BMAD_DEBUG_MANIFEST`, `BMAD_VERBOSE_INSTALL` and
  `BMAD_EXTERNAL_MODULES_CACHE`. **There is no `BMAD_HOME`, `BMAD_PROJECT_ROOT` or
  `BMAD_CONFIG_PATH`** that a global install could set to redirect resolution.

**Consequence.** Even the most charitable global-install construction fails. Install with
`--directory ~` and the 46 skills land in `~/.claude/skills` — which genuinely *is* Claude Code's
user-level skills directory, so they would be *visible* in every project. But each one then
dereferences `{project-root}/_bmad/bmm/config.yaml`, which the agent expands to the *current
project* — where no `_bmad/` exists. The skills would be globally visible and universally broken:
strictly worse than today's honest "BMAD agents require project-level installation" skip. And if a
model instead expanded `{project-root}` to `~`, every project on the machine would write its
planning artifacts into `~/_bmad-output/`. Both branches are worse than the current behaviour.

### AC2 — FR123 flag behaviour under a user-scoped `--directory`; does `--output-folder` mean anything with no project in scope?

**Met.** All five flags parse and "work" — none of them is scope-aware, which is precisely the
problem.

| Flag | Behaviour under a user-scoped `--directory` | Evidence |
|---|---|---|
| `--directory` | Accepted; becomes `config.directory` → `path.resolve()` → the sole install root. Tilde-expanded via `UI.expandUserPath` (Windows forward-slash caveat above). Validated for writability only. | [RUN] + [READ] `ui.js:205-215`, `install-paths.js:15-18` |
| `--modules` | Unaffected by scope. `bmm`/`core` are built-in (copied from the package); externals come from the user-level `~/.bmad/cache/…` clone cache, which is **already** user-level regardless of install scope. `--modules bmm` completed with zero network. | [RUN] "2 module(s) installed"; [READ] `project-root.js:64-82` |
| `--tools` | Unaffected by scope, and **actively harmful** here: `--tools claude-code` wrote 46 skills to `<--directory>/.claude/skills`. With `--directory ~` that is the real user-level Claude dir; with any other user-scoped path it is a dead `.claude/` nobody reads. No tool handler has a user-level target variant. | [RUN]; [READ] `ide/_config-driven.js`, `ide/platform-codes.yaml` |
| `--output-folder` | **Has no meaning with no project in scope.** It is stored verbatim (`core.output_folder: _bmad-output`) and used two ways, both project-shaped: (1) the installer *eagerly creates* `<--directory>/_bmad-output/planning-artifacts`, `…/implementation-artifacts` and `<--directory>/docs`; (2) it is baked into config as the literal `{project-root}/_bmad-output/…`, resolved per-project at runtime. So the flag simultaneously **scaffolds a phantom project tree in the user's home directory** *and* **describes a path that is never the global install's own**. Under a global install the correct value for this flag does not exist. | [RUN] the three directories on disk + `bmm/config.yaml`; [READ] `installer.js:1659-1660`, `ui.js:826-828,863` |
| `--custom-content` | **Renamed upstream.** 6.10.0 exposes **`--custom-source`** (`install.js:36`); `--custom-content` is the pre-6.3.0 name. ma-agents already handles this — `resolveCustomContentFlag()` probes the installed package and downgrades (`lib/bmad.js:679-711`), so no ma-agents change is needed. Behaviour is scope-independent: it resolves a staged plugin path, and the staging path ma-agents uses is project-local (`.ma-agents-plugin-stage/`), which under a global install has no project to be local to. | [READ] `install.js:36`, `lib/bmad.js:679-711,763-769` |

**Summary for AC2:** not one of the five flags carries a scope concept. Every flag that has a
project-relative meaning (`--output-folder`, `--tools`, `--custom-source`) silently reinterprets
that meaning as *relative to `--directory`*, which under a global install produces a phantom
project rather than a global installation.

### AC3 — Verdict recorded as an explicit PASS/FAIL, appended to P5-9.8 as a spike-outcome note

**Met.** **FAIL**, recorded as an append-only, dated spike-outcome note at the end of the P5-9.8
subsection of
`_bmad-output/planning-artifacts/architecture/decisions/project-knowledge-and-repository-layout.md`
(immediately before `#### Deferred`), pointing back at this file. **No existing P5-9 text was
reworded, restructured or deleted** — P5-9.8 was already written for both outcomes, and its
"If the spike fails" rule now applies as written.

### AC4 — On PASS, the change set for 31.12 and the "only two places" confirmation

**Not applicable — the verdict is FAIL.** Recorded here anyway because the story asked the
"only two places" question to be *verified*, and **the answer is no**: the citations are correct but
the count is wrong.

Citation re-verification against `bin/cli.js` in this worktree — **all three verify exactly**:

| Cited | Verified |
|---|---|
| `1440-1452` global BMAD agent filter | ✅ 1440 = `// Step 3.4: Filter out BMAD agents for global scope…`; 1441 = `if (installScope === 'global') {`; 1446 = inner `if`; 1451 closes the inner `if`; 1452 closes the scope `if` |
| `1455` project-only guard on the whole BMAD block | ✅ 1454 = `// Step 3.5: BMAD-METHOD Integration`; 1455 = `if (installScope === 'project') {`; the block closes at 1613 — it is indeed the larger guard, skipping *all* BMAD integration |
| `1414-1437` install-scope prompt | ✅ present **in full** — a `prompts` select with three choices (`project` default, `global`, `custom`), guarded by `!isUpdate && !installPath && !yesFlag && !cliScope`. FR248-as-amended is accurate; it is not missing and must not be reported as such |

**But there are more than two project-scope encodings.** Ten `installScope` references exist in
`bin/cli.js`, of which **five** gate behaviour on scope:

| Line | Site | Kind |
|---|---|---|
| 1202 | `let installScope = cliScope \|\| 'project';` | declaration / default |
| 1428 | `installScope = 'global'` inside the wizard | assignment |
| **1441** | global BMAD agent filter | **scope gate** (anticipated) |
| **1455** | whole BMAD-METHOD integration block | **scope gate** (anticipated) |
| **1616** | `writeRepoLayoutConfig(repoLayout)` + `writeProjectLayoutYaml(repoLayout)` | **scope gate — NOT anticipated** |
| 1626 | summary line ("global (user-level)" vs "project (current directory)") | cosmetic |
| 1692 | `migrateRetiredSkills({ scope: installScope, … })` | scope-passing (correct either way) |
| 1747 | `installSkill(…, installScope, …)` | scope-passing (correct either way) |
| **1759** | `reconcileAgentsSharedSkills(process.cwd(), …)` | **scope gate — NOT anticipated** |
| **1768** | `project-context.md` repo-layout update | **scope gate — NOT anticipated** |

Plus two **hardcoded** `'project'` literals at **1668** and **1680** (`uninstallSkill(…, 'project')`
on the update path) which ignore `installScope` entirely — a latent bug for a global *update*,
independent of this epic.

Reading of that for the epic: the three unanticipated gates (1616, 1759, 1768) are exactly the
project-scoped work **FR251 says a global install must not perform**, and they are **already
correctly gated**. So this finding is good news for Story 31.11 (less to build than feared) even
though it falsifies AC4's "only two" framing. See "Notes for the planning chain" for the one
genuine interaction it creates with Story 31.2.

### AC5 — On FAIL, the exact three facts FR250's degradation path requires the installer to report

**Met. This is Story 31.12's deliverable.** When install scope is global, the installer must report
exactly these three, with this content:

1. **BMAD-METHOD remains project-scoped.** bmad-method v6.10.0 has no user-level install target and
   resolves `_bmad/` only at `<project-root>/_bmad` — so BMAD modules, agents and skills were **not**
   installed globally. ma-agents skills **were**.
2. **The command that installs BMAD into a project** — `cd <your-project> && ma-agents install`
   (project scope is the wizard default; `--global` is what selects global non-interactively). This
   replaces today's `Run again without --global to install BMAD agents into the current project.`
   at `bin/cli.js:1449`, which is directionally right but frames a supported outcome as a user
   error.
3. **The F26 knowledge-store requirements are unaffected.** The two federated stores, the
   committed `_bmad-output/project-layout.yaml` binding record and `ma-agents bind` all work
   identically under a global install — knowledge topology is a property of the project, read from
   `project-layout.yaml` at the project root, and is independent of where BMAD's own modules live.

Wording constraint for 31.12: this is a **statement of designed behaviour, not a warning**. It
must not print as `Warning:` and must not tell the user to re-run. The existing block at
`bin/cli.js:1446-1450` is the site to replace.

### AC6 — Either way, no part of P5-9.1 through P5-9.7 changes

**Met, and confirmed affirmatively rather than by omission.**

P5-9.1–P5-9.7 govern *where a project's knowledge lives* and *how it is recorded and read*. Every
one of them is expressed in terms of a **project root** and a file **committed inside the
project** — `_bmad-output/project-layout.yaml`. None of them references BMAD's own module location,
BMAD's install target, or install scope:

- **P5-9.1** (binding authority) — `project-layout.yaml` at the project root. Unaffected; in fact
  *reinforced*: because upstream resolves everything from the project root and nothing from the
  user level, a committed project-root binding file is the only mechanism that could make a
  globally-installed skill resolvable at all (NFR83).
- **P5-9.2 / P5-9.3 / P5-9.4** (generated `config.yaml`, one-way, install-and-bind-only, overwrite
  with notice, TOML overrides survive) — all concern `<project>/_bmad/bmm/config.yaml`, which the
  live run confirms is exactly where skills read it from and exactly what the installer generates.
  Unchanged. The live 6.10.0 install also **re-confirms P5-9.4's corrected file names**: `_bmad/`
  contains `config.toml` and `config.user.toml`, and module configs are YAML
  (`_bmad/bmm/config.yaml`, `_bmad/core/config.yaml`). `config.user.yaml` does **not** exist —
  independent verification of the 2026-08-02 amendment.
- **P5-9.5** (two stores + separate sprint management) — a store-model decision with no install-scope
  dependency. Unaffected.
- **P5-9.6 / P5-9.7** (Confluence MCP-conditional, fail-loud, no mirror; page structure mirrors the
  shard tree) — entirely orthogonal. Unaffected.

**A FAIL verdict must NOT be read as blocking Stories 31.2–31.10.** They were never downstream of
this gate; the epic's execution order (`epics.md:5255-5257`) places 31.1 and 31.2 as two
independent parallel gates, and 31.2 is the one that gates threads A/B/C. Thread D shrinks; threads
A, B and C proceed unchanged.

### AC7 — Air-gap posture (NFR77) for the path the verdict selects

**Met.** The selected path is: ma-agents skills global, BMAD project-scoped. Its air-gap posture is
**identical to a project install**, and the ma-agents-skills-only half is *strictly less*
network-dependent than today's project install, because it drops the BMAD invocation entirely.

- **[RUN]** The live install of `--modules bmm --tools claude-code` completed with **no git clone
  and no module download** — `bmm` and `core` are built into the npm package
  (`source: built-in`, `npmPackage: null`, `repoUrl: null` in `_bmad/_config/manifest.yaml`).
- **[READ]** External modules resolve from the **user-level** cache
  `~/.bmad/cache/external-modules/` (`project-root.js:80`), overridable via
  `BMAD_EXTERNAL_MODULES_CACHE`. ma-agents pre-populates that exact directory from its bundled
  `lib/bmad-cache/` (`lib/bmad.js:1917`, per FR76). **This cache is user-level already, entirely
  independent of install scope** — so a global install and a project install draw on the identical
  offline source. NFR77's "on the same terms as project installation" is satisfied structurally,
  not by accident.
- **[READ]** The only network call on the install path is the **best-effort version check** in
  `tools/installer/bmad-cli.js:20-53` — `execSync('npm view bmad-method@latest version')` with a
  5 s timeout inside a `try/catch` that comments "Silently fail - network issues or npm not
  available". Non-fatal, scope-independent, and pre-existing (it is equally present for project
  installs today, and Epic 27's `--network none` proof already covered it).
- **[READ]** No CDN fetch and no git operation exists on the ma-agents global-skills path (`--tools`
  handling is pure file copy).

**One thing 31.12 must NOT do in the name of air-gap:** it must not pre-populate or write anything
into `~/.bmad/` as a substitute for a global install. AC1(c) proves nothing would ever read it.

---

## Change set handed to Story 31.12 (FAIL path)

Story 31.12 becomes **a messaging and gating change, not an installer capability**. It is smaller
than the PASS branch would have been.

1. **Replace** the warning block at `bin/cli.js:1446-1450` with the AC5 three-fact report (designed
   behaviour, not a warning; no "run again without --global").
2. **Keep** the agent filter at `bin/cli.js:1441-1452` — it is correct under this verdict; only its
   user-facing text changes. Keep `bin/cli.js:1455` as-is; a global install continues to skip the
   entire BMAD-METHOD integration block, which is now the *documented, intended* behaviour rather
   than an unexamined default.
3. **Add** the recorded install scope (FR248/FR252) so a later `ma-agents bind` knows the install was
   global — that is Story 31.11's, and 31.12 consumes it.
4. **Add** a regression test pinning all three facts in the global-scope output, so the degradation
   message cannot silently rot.
5. **Do not** add a `--directory`-to-`$HOME` global BMAD install. It writes `_bmad/`,
   `_bmad-output/planning-artifacts/`, `_bmad-output/implementation-artifacts/`, `docs/` and
   `.claude/skills/` into the user's home directory and nothing ever resolves against it.

**Re-open condition (for a future BMAD version).** This gate flips to PASS only when upstream ships
**both** of: (a) a resolution search order or environment override that finds a user-level `_bmad/`
from inside an unrelated project — concretely, `Installer.findBmadDir` becoming a candidate walk and
`resolve_config.py` gaining a user-level layer; and (b) a way to install without materialising
project-scoped output directories at the install target. (a) alone is insufficient — the
`{project-root}` placeholder in `bmm/config.yaml` must also gain a global meaning.

---

## Notes for the planning chain (recorded, not acted on)

Per the story's hard boundary, nothing below was "fixed" in any planning artifact.

1. **AC4's "only two places" is falsified** (see AC4). Five scope gates, not two, plus two
   hardcoded `'project'` literals at `bin/cli.js:1668,1680`. This does not change the verdict and
   is net-favourable — three of the five are already-correct FR251 gates. Story 31.11 should be
   told they exist rather than re-deriving them.
2. **Real interaction between `bin/cli.js:1616` and Story 31.2 AC2.** Line 1616 gates
   `writeProjectLayoutYaml(repoLayout)` on `installScope === 'project'`. Story 31.2 AC2 requires
   that file be written **unconditionally** on every install. Under a *global* install there is no
   project to write it into, so "unconditionally" must mean *unconditionally within a
   project-scoped install or bind* — which is what P5-9.1 actually says ("every install and every
   bind"), and what FR251 requires ("a global install … does not write `project-layout.yaml`").
   The two are reconcilable, but 31.2's AC2 wording ("written **unconditionally** on every install")
   read literally contradicts FR251. **Flagged, not edited** — 31.2's implementer should keep the
   1616 scope gate and remove only the *same-repo* conditional and the delete branch at
   `bin/cli.js:606-616`, which is plainly the intent.
3. **`--custom-content` is stale in AC2 / FR123 / `sprint-status.yaml`.** 6.10.0 exposes
   `--custom-source`; the old name was retired at 6.3.0. Harmless — ma-agents already probes and
   downgrades (`lib/bmad.js:679-711`) — but any future re-statement of the FR123 flag list should
   say `--custom-source`.
4. **`sprint-status.yaml`'s 31-1 note carries the pre-correction citations** (`1440-1451`, guard at
   `1454`) in its parenthetical "expected" clause, even though the comment block at line 466
   correctly records the fix. Cosmetic drift in the same file; the delta verification
   (`delta-verification-f26.md:47-57`) already caught the class.
5. **Upstream defect worth an issue, not a story:** `UI.expandUserPath` rejects `~/…` on Windows
   because it compares against `path.sep`. Does not affect ma-agents (we pass resolved absolute
   paths) but it breaks the documented `--directory ~/...` UX for any Windows user of bmad-method
   directly.

## Scratch dir

`…/scratchpad/spike-31-1/` (outside every worktree) and the install target
`C:\Users\995472\.bmad-spike-31-1\` were both removed after the findings above were recorded. Every
claim tagged **[RUN]** is reproducible from the commands in this document.
