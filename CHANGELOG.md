# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased (4.x)

ma-agents 4.x is not released, and nothing in this section is in a published
package. It records what the 4.x line targets and what is known not to work yet.

- **Target.** BMAD v7 at BMAD-METHOD commit
  `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (`package.json` `bmadRef.core`), a
  preview-alpha upstream commit, not a GA release; Skills CLI `skills@1.7.6`,
  tea `v4.0.1`, no cis.
- **Support line.** Until Story 39.5 qualifies 4.x on an upstream GA tag, the
  3.x line is the supported on-prem release (FR281), maintained from branch
  `maint/3.x` (cut at `v3.18.1`). 4.x packages, from Story 39.4 on, are
  pre-releases (`4.0.0-next.N`) on npm dist-tag `next`.
- **Version.** `package.json` carries `4.0.0-beta.1` from 2026-11-15, when the
  repository went public and the Epic 36 gate passed (tag `v4-gate-e734d3a`);
  the extension repository `ma-bmad-extensions` carries the same version on
  every module record. Nothing is published to npm at this version.
- **Requirements.** Node.js ≥ 22.20.0, the floor the bundled Skills CLI declares
  (`engines.node`). The v7 skills run with `uv run --no-cache`, so a machine
  needs uv, a Python 3.11 interpreter and the wheelhouse of the skill scripts'
  dependencies; offline they come from the 4.x bundle
  (`docs/on-prem-runtime.md`).

### Known limitations

- **cis is not bundled.** No tag of `bmad-module-creative-intelligence-suite`
  carries a v7 module record, so `bmadRef.cis` is empty and the bundle records
  cis as omitted; tea is bundled at `v4.0.1` (Story 36.1, FALLBACK).
- **v7 project-context adoption removes the ma-agents blocks from `CLAUDE.md`.**
  When `bmad-project-context` adopts a project, its default proposal deletes the
  `ma-agents` and `ma-standards` blocks from `CLAUDE.md` as duplicates of the
  `AGENTS.md` copies and reduces `CLAUDE.md` to `@AGENTS.md`; the next ma-agents
  install or update writes them back, and the next refresh flags them again. The
  `AGENTS.md` blocks survive byte-identical (Story 36.5 AC9; fix planned in 37.2
  and 39.2).
- **Update checks for `core-tools` and `method` report `could-not-check`.**
  Upstream `main` moved its module records after the pinned commit, so
  `setup.py --status` cannot read them online until `bmadRef.core` moves; offline
  every module reports `could-not-check`, which does not fail the command (Story
  36.1 AC7).
- **Offline token counting falls back.** `bmad-toolsmith` `count_tokens.py`
  reports `"method": "fallback"` offline, because `tiktoken` downloads its
  encoding at first use (Story 36.2).
- **A malformed customization is dropped silently on six upstream skills.**
  `bmad-prd`, `bmad-architecture`, `bmad-facilitate`, `bmad-ux`,
  `bmad-product-brief` and `bmad-prfaq` have no `workflow.md`, so a
  `_bmad/custom/<skill>.toml` that does not parse, or names an undeclared key,
  is not halted on; the skill falls back to its defaults (Story 36.4).
- **Not verified: Windows with the network adapter disabled.** The Windows
  offline runs used `UV_OFFLINE=1` and a black-hole proxy instead (Story 36.2).
- **Not verified: global install scope.** Only the project-scope `uv.toml`
  selected by `UV_CONFIG_FILE` was proven; the uv user configuration file was
  not exercised (Story 36.2).
- **Not verified by a syscall trace: no download when the interpreter is
  missing.** Shown by uv's verbose log inside `--network none` (Story 36.2).
- **Not implemented: a full-clone fallback for `bundle build`.** When a proxy
  refuses a fetch by commit, the build fails with git's error (Story 36.3).
- **The Skills CLI's dependency versions follow the registry on the build
  day.** Its ranges (`tar ^7.5.20`, `yaml ^2.8.3`) are resolved at build time,
  so a later build can pick newer patches and change `bundle/manifest.json`; the
  manifest records the exact set (Story 36.3).
- **Not verified offline: the contract validator's `--render` path.** It
  downloads `jinja2` through uv when online (Story 36.4).
- **Not verified in a human-driven session: the adoption run.** Story 36.5's two
  runs were fresh agent sessions executing the pinned skill with scripted user
  turns; Story 36.7 repeats it at GA in a real session.
- **Marker lines inside a fenced code block count as markers.** A
  `<!-- ma-agents:start -->` line quoted in a code fence in your own prose is
  matched by exact line equality (Story 36.5).
- **`npm test` does not pass on Windows.** The chain stops at pre-existing
  failures tracked as `bug-npm-test-windows-suite-health-chain`; the Linux CI job
  runs every file and gates on a known-failure allowlist (Story 36.6).

## [3.18.1] - 2026-10-17

### Fixed
- **Installing TEA failed for everyone.** ma-agents pinned `bmad-method`
  exactly but left its external modules (tea, bmb, cis) unpinned, so each
  install pulled whatever upstream had released last. TEA v2.0.x dropped the
  `src/module.yaml` that bmad-method 6.10.0 needs, so every install that
  selected tea aborted with `Module 'tea' was downloaded but its module
  definition was not found`. The suggested `--next=tea` didn't help. Online
  and offline installs of the same release had also drifted apart. Every
  bundled module is now pinned to the release the offline cache holds: tea
  `v1.19.0`, bmb `v2.1.0`, cis `v0.2.1`. The cache is stamped so the pinned
  install still works with no network, and a cache left at another release
  (such as a broken tea v2.0.2 clone) is replaced automatically.
  **Behaviour change:** a project that 3.18.0 installed at a newer upstream
  bmb or cis moves back to the pinned release on its next install or update.
- **Installs on Windows aborted with `EBUSY: resource busy or locked`.**
  After placing skills, bmad-method deletes its temporary `_bmad/<module>/<skill>`
  copies once, with no retry. A momentary lock from Defender, the search
  indexer or an editor's file watcher (for example, the project folder open in
  VS Code) killed the whole install. ma-agents now gives those deletes a
  retry budget of about 12 seconds. bmad-method itself is unchanged.
- **`bmad-help` described and routed every ma-skills entry wrongly.** The
  ma-skills `module-help.csv` used the pre-6.10 column layout, which
  bmad-method 6.10.0 loads by position. All 51 rows landed in the wrong
  columns of `_bmad/_config/bmad-help.csv` (skill = `anytime`, empty
  description), with a `header does not match canonical schema` warning on
  every install. The file now uses the current schema and gives each entry
  its own menu code, e.g. `[SSS] Generate SSS`.
- **`MANIFEST.yaml` and the `my-next-issue` skill were invalid YAML.** Skill
  descriptions were written into YAML unescaped, so the colon in
  `my-next-issue`'s description (`Jira: assignee = …`) broke its `SKILL.md`
  header and the entire `.claude/skills/MANIFEST.yaml`, the file `CLAUDE.md`
  tells the agent to read first. bmad-method also skipped the skill because
  of it and left `_bmad/ma-skills/my-next-issue/` behind after every install.
  Values are now quoted only where YAML needs it, so every other skill's
  files are unchanged.
- **`--bmad-modules bmm,bmb,cis` failed from PowerShell.** The `npx.ps1` shim
  passes an unquoted comma list as separate arguments. The help text now
  shows the quoted form: `--bmad-modules "bmm,tea,bmb"`.

## [3.18.0] - 2026-09-21

Federated knowledge stores, an authoritative committed project binding, and a
global install that does no project-scoped work (Epic 31 / PRD capability F26 /
Architecture Decision P5-9).

**MINOR, not MAJOR.** Every change below is additive: three new commands
(`bind`, `confluence-plan`, `confluence-record-root-page`), two new install
questions, new generated `config.yaml` fields, and one new committed file. No
existing command, flag or generated field is removed or changes meaning. A
project that configures no second store resolves exactly the artifact paths it
resolved before (NFR82), and `--yes` selects the previous single-repository
`file-system` defaults for both stores, so CI and non-interactive installs are
unaffected. See "Known limitations" below for what this release does *not*
close.

### Added

- **Two independent knowledge stores.** The installer now asks separately where
  the **system requirements** (product brief, PRD including its shards) and the
  **software requirements** (architecture, UX designs, epics) live. Each store
  answers independently and each selects its own `backend`. The sprint-management
  question is unchanged and remains a third, separate question. Story files and
  everything else under `implementation_artifacts` belong to **neither** store —
  they follow `sprint_management_path`, because a story is sprint execution
  state rather than a requirement, so moving a knowledge store does not move
  the stories. (FR254, FR255, FR256, FR257, FR258, FR267)
- **A `confluence` backend for either store.** A store can live in a Confluence
  space instead of on the file system, and the two stores may differ — system
  requirements in Confluence for stakeholder visibility while software
  requirements stay in git alongside the code, or any other combination. The
  installer asks for the space and for a root page; left blank, ma-agents
  generates a root page named for the project and tells the user the name it
  used. (FR257, FR259, FR260)
- **`ma-agents bind`.** Binds an already-installed project to its knowledge
  stores. It collects only the project-scoped answers and writes
  `_bmad-output/project-layout.yaml` plus `project-context.md`. It installs no
  skills and no BMAD modules, it is idempotent — a re-run against an
  already-bound project reports the existing bindings and changes nothing
  unless an answer is explicitly edited — and it never overwrites an existing
  `project-context.md`. (FR252, NFR78)
- **`ma-agents confluence-plan`** prints, for the current project, the page tree
  a publish would produce — one page per markdown artifact, nested so the pages
  mirror the source folder structure — together with the enumerated operations a
  publish performs and the order to perform them in, parents first. It writes
  nothing, anywhere: not the plan, not a cache, not a report file. The
  Confluence-capable MCP lives in the agent's tool context, not in this process,
  so this command enumerates the plan and performs none of it. (FR260, P5-9.7)
- **`ma-agents confluence-record-root-page`** records the id Confluence assigned
  to a root page it created, so later runs address the page directly instead of
  re-resolving it by title. It refuses to record when the binding was retitled
  between the plan and the write-back, and reports the refusal by name.
- **The five BMAD authoring skills now publish to a Confluence-backed store.**
  On install or `bind`, ma-agents generates `_bmad/custom/<skill>.toml` for
  `bmad-prd`, `bmad-architecture`, `bmad-create-epics-and-stories`, `bmad-ux`
  and `bmad-product-brief`, setting the upstream-sanctioned `on_complete` hook
  to run the publish path for the store that owns each artifact. This uses the
  customization channel those skills already resolve at activation, so **no
  skill document is edited** — the 41-copy preflight and the 9-copy routing gate
  are untouched. A `file-system` store gets no hook, no prompt and no message.
  The generated block is marker-delimited and idempotent: anything outside the
  markers is yours and is preserved, and a re-run changes nothing. Because the
  hook runs *after* a workflow has already told the user the artifact is ready,
  its text instructs the agent to correct that message if the publish halts.
  (FR255, FR256, FR262, FR264)
- **`ma-agents status` names two silent-failure states** it can detect in the
  customization layer: a collision that would make the team layer unparseable
  (which would discard the publish hook *and* the user's own overrides), and a
  scalar `on_complete` override in the personal layer that replaces the hook.
  Both otherwise fail silently at exit 0. (FR262)
- **`ma-agents status` reports the active install scope**, and for a global
  install lists which projects on this machine have been bound and whether a
  readable `project-layout.yaml` was found at each root. (FR253)

### Changed

- **The BMAD module set is now `bmm`, `tea`, `bmb`, `cis` — and the two
  design-studio modules are no longer shipped at all.** `gds` (Game Dev
  Studio) and `wds` (Whiteport Design Studio) are **neither bundled nor
  installed**: they are absent from `lib/bmad-cache/` and from the cache
  manifest, so `--bmad-modules` does not offer them and `--bmad-modules wds`
  is refused by name. Previously every bundled module was installed, which
  left projects with no interest in UX tooling holding an unexplained
  `design-artifacts/` tree.
  **The cost, stated plainly:** obtaining either module now requires network
  access to its upstream GitHub repository. **On an air-gapped machine
  neither is obtainable at all.** The air-gap guarantee covers the bundled
  set — `bmm`, `tea`, `bmb`, `cis` — and these two are outside it.
  **Existing installs are narrowed, not deleted**: a project that already has
  `_bmad/wds/` keeps that directory on disk; only the resolved module list
  narrows. The package is **28% smaller packed** as a result (11.3 MB → 8.1 MB).
- **`_bmad-output/project-layout.yaml` is now the authoritative, always-written
  record of where a project's knowledge lives**, carrying the backend and
  location of both stores plus sprint management. It is written on every install
  and every bind — not only in multi-repo or Jira mode, and no longer *deleted*
  when both concerns are same-repo, which is what the previous code did. Because
  `_bmad-output/` is deliberately tracked, these bindings are committed and
  shared by the whole team. (FR263, superseding FR117 and FR122)
- **`_bmad/bmm/config.yaml` is now GENERATED from that binding** rather than
  written directly from install answers, on install and on bind only. It gains
  `system_requirements_path`, `software_requirements_path` and the per-store
  backend and space-key fields, and it records which binding it was generated
  from in a `project_layout_stamp:` field. The legacy `planning_artifacts` and
  `knowledgebase_path` fields are **retained** and resolve to the software
  requirements store, so every existing reference keeps working unchanged. The
  per-developer TOML overrides (`_bmad/config.user.toml`,
  `_bmad/custom/config.user.toml`) are never touched. (FR264)
- **A global install now performs no project-scoped work.** It does not generate
  `project-context.md`, does not write `project-layout.yaml`, and does not prompt
  for knowledge-store locations, because no project is in scope at that moment.
  The chosen scope is recorded so a later `ma-agents bind` knows the install was
  global. The existing Installation Scope question and the `--global` flag are
  retained as-is. (FR248, FR251)
- **BMAD-METHOD remains per-project on a global install, and the installer now
  says so.** A confirmation spike against a live bmad-method v6.10.0 established
  that upstream has no user-level install: `bmad install --global` is an unknown
  option, and module resolution outside a project does not work. FR249 therefore
  degrades per FR250 — ma-agents skills install globally and the installer
  reports three facts: that BMAD remains project-scoped, the command that
  installs BMAD into a project, and that the F26 knowledge-store requirements
  are unaffected. This replaces the previous behaviour, which filtered BMAD
  agents out of a global install and told the user to re-run without `--global`
  — framing a working mode as a failure. (FR249, FR250)
- **Legacy single-store projects keep working, and migration is offered, never
  forced.** A `project-layout.yaml` that predates F26, or that carries only the
  single `knowledgebase_path`, is read as both stores pointing at that one
  location. The user is told the project is using the legacy single-store layout
  and given the exact command that splits it; everything keeps working until
  they run it. (FR265)

### Fail-loud behaviour (new)

- **A Confluence-backed store with no Confluence MCP halts.** Skills do not
  silently degrade and do not fall back to any local copy. The error names the
  affected store, its configured space, the fact that no Confluence MCP was
  detected, and how to configure one — or how to re-bind the store to the file
  system. It explicitly forbids falling back to the file system, creating a
  local copy, continuing with a partial or empty result, and changing the
  configured backend on the user's behalf. A Confluence-backed store with no
  Confluence MCP has no degraded mode. (FR261, FR262)
- **An unrecognised store backend halts rather than defaulting.** This is a
  deliberate departure from the sprint-tracking routing pattern, which falls
  back to the file system on an unknown value: for a knowledge store, falling
  back would resolve a store this build cannot identify to local files, which is
  exactly the silent degradation FR262 forbids.
- **A stale generated config halts.** Skills that resolve knowledge-store paths
  now run a gateway preflight that compares `_bmad/bmm/config.yaml` against the
  committed binding before any read, any write and any prompt. On disagreement
  it halts, names every store that moved and both of its locations, and
  prescribes `ma-agents bind`. The comparison is on **content, never
  timestamps** — mtime ordering is not preserved by `git pull`, `git checkout`
  or a fresh clone, so a timestamp comparison would both miss real drift and
  report drift on a clean checkout.

### Security

- **No Confluence credentials are stored on disk, anywhere.** Authentication is
  entirely the MCP server's responsibility. `project-layout.yaml` records only
  the space key and the root page's title and id — which is what makes the file
  safe to commit. Verified at the release gate by enumerating every file a
  Confluence-configured install writes and scanning every byte of each. (NFR79)

### Deliberately not implemented

- **FR266 (a local mirror of every Confluence-backed store) was RETIRED before
  implementation** and has no code, no cache, no sync direction, no sync trigger
  and no conflict-resolution path. The mirror had been justified on air-gap
  grounds, but this product's air-gap requirement means *no internet* — no npm,
  git or CDN access — not *no network*: an enterprise Confluence inside the
  perimeter is reachable on an air-gapped network. With Confluence
  unreachability reclassified as a misconfiguration rather than a working mode,
  FR262's fail-loud behaviour removes the need for a mirror entirely. The
  release gate asserts the absence as a closed set rather than as a denylist.
  (P5-9.6)

### Known limitations

> **This file does not ship on npm.** `CHANGELOG.md` is not in `package.json`'s
> `files` list, so it reaches readers on GitHub only. The two sections above are
> therefore reproduced in `README.md` — under "Deliberately not implemented" and
> "Known limitations of v3.18.0" — which **is** in the published tarball. Keep
> the two in step.

- **Every claim in this release about behaviour with a Confluence MCP *present*
  is mock-verified, not live.** No authorised Confluence MCP was available to
  the implementation or to any review, so the MCP-present branches were
  exercised against a stubbed tool context. The MCP-*absent* branch — the
  fail-loud path — is the default state and was exercised for real.
- **The publish trigger reaches the authoring skills through a file three
  parties can write.** `_bmad/custom/<skill>.toml` is written by ma-agents, by a
  human, and by the upstream `bmad-customize` skill. TOML forbids duplicate
  keys, and the upstream resolver treats a parse error in that layer as a
  *warning* — it returns an empty layer and **exits 0** — so a second writer
  adding its own `on_complete` silently discards the publish hook and every
  other override in the file. ma-agents refuses to write over a collision it can
  detect and `ma-agents status` names it, but **that check is a partial scanner,
  not a full TOML parser**: it can miss a malformation and stay silent. The
  durable fix belongs upstream in `resolve_customization.py`, which is replaced
  on every install, so it cannot be patched from here.
- **A bare non-ASCII-whitespace line authored by a user is not detected.** A
  line containing only U+00A0, U+2007 or U+3000 makes the file invalid to the
  real parser while ma-agents' reader accepts it; the customization layer is
  then dead at exit 0 with nothing reported. Such a file is already invalid
  before ma-agents touches it — this is a detection gap, not corruption. A
  byte-order mark in the same position *is* caught.
- **`_bmad-output/project-layout.yaml` carries a `generated:` date**, so two
  runs of the same answers are byte-identical only within the same calendar day.
  `ma-agents bind` declines to rewrite the file on a no-edit re-run precisely so
  that this cannot present as a spurious change.
- **`npm test` is not green on Windows**, for nine reasons that predate this
  release. The one this epic introduced — the Story 31.4 preflight block
  breaking Story 15.5's verbatim invariant — **is resolved**: the block now
  lives in the source workflow files, so the converted and source copies agree
  and that suite is green. See
  `_bmad-output/implementation-artifacts/bug-npm-test-windows-suite-health-chain.md`.
- **This release was verified on Windows only.** Linux and CI were never run, so
  every cross-platform claim here is inference rather than a result.

## [3.17.1] - 2026-07-16

### Fixed
- **An upgrade could silently delete hand-authored skills.** When a tool's
  skills directory moved between versions, the installer removed the old
  directory **recursively and unconditionally** once the new one had content —
  destroying any skill you had written there yourself, and logging it in green
  as a successful cleanup. It now reads that directory's own manifest and
  removes only what ma-agents installed; if anything else remains, the
  directory is **preserved** and the files that kept it are named. A directory
  with no manifest, an unreadable manifest, or an empty one is never removed —
  unknown provenance fails safe. **This affected `.github/copilot/skills`,
  `.github/skills`, `.roo/skills` and `.kilocode/skills` in versions 3.7.0
  through 3.17.1.** Deletions made by those versions are not recoverable from
  ma-agents — `fs.remove` leaves no backup and records nothing but the
  directory name. One known limit remains: files placed *inside* a directory
  ma-agents installed are still removed with it.
- **Antigravity no longer gets two skill trees.** ma-agents wrote
  `.antigravity/skills` while bmad-method wrote `.agent/skills`, so a single
  install produced both — and the tree the tool actually reads was patched by
  nobody, silently missing the on-prem phase prefix in a project configured
  for on-prem. The registry now matches upstream's path, and the patch targets
  are derived from what is on disk rather than from our own table, so a tree
  written by either pipeline is reached. A parity test fails on any unrecorded
  path divergence between the two tables.
- **`ma-agent-sqa` cited a manifest path that never resolves.** Its Critical
  Action 1 pointed at `_bmad/skills/MANIFEST.yaml`, one path segment short of
  the `_bmad/skills/sqa/` its registry entry declares. All four `ma-agent-*`
  personas also regained the `if it exists` guard on that instruction, so the
  step degrades cleanly in a project where the agent host was never installed
  instead of sending the agent after a missing file.
- **ma-agent personas now appear in the IDE agent picker.** The DevOps
  (Amit), Cyber (Yael), SQA (Gadi), and SRE (Alex) personas installed as
  skills but never surfaced in the GitHub Copilot agent-picker dropdown in
  VS Code, while the core BMAD personas (Mary, John, Winston, Amelia, …) did.
  BMAD's installer emits agent-picker entries (`.github/agents/<id>.agent.md`)
  only for skills its `agents-only` filter classifies as personas, and that
  filter keys **solely** off the presence of an `[agent]` section in the
  skill's `customize.toml` — it does not read the `type: agent` field in
  `bmad-skill-manifest.yaml`. The four ma-agent skills shipped no
  `customize.toml`, so the filter skipped them and no picker entry was ever
  written. Each persona now ships a `customize.toml` with an `[agent]` section
  (name, title, icon, and persona metadata mirrored from its manifest), and a
  regression test (`test/ma-agent-persona-picker.test.js`) pins the contract
  in both the source and generated plugin trees so it cannot silently regress.

## [3.17.0] - 2026-07-13

BMAD v6.10.0 integration — closed-allowlist bundle safety, an opt-in custom
marketplace source, and a non-destructive Demerzel deprecation (Epic 30 / F25).

Post-Epic-30 follow-ups folded into this release: the custom marketplace source
now also understands the **BMAD registry-index format** (`registry/official.yaml`
+ `community-index.yaml` of `repository`/`module_definition` pointers) in addition
to `.claude-plugin/marketplace.json` and single-module repos; registry entries are
installed two-level (clone the pointed repo at its `approved_tag`, resolve the
module) with skills discovered from each module's real skills root; the multi-select
is **best-effort** (a stale/broken registry entry — e.g. a nonexistent `approved_tag`
— is skipped loudly with its reason and only the resolvable subset installs, rather
than aborting everything); and `--log` now captures full install diagnostics
(per-phase breadcrumbs + otherwise-swallowed root causes) to the log file only.

### Changed
- **Bundled bmad-method updated to v6.10.0.** Upstream v6.10.0 introduces a
  new `bmad-loop` module (`type: bmad-org`, `marketplace-plugin: true`) and
  marks `bmad-automator` `deprecated: true`. The offline module-cache filter
  (`scripts/build-bmad-cache.js`) is now a **closed-by-default allowlist**
  (`{tea, bmb, cis, gds, wds}`) instead of "every `type: bmad-org` module" —
  a naive pin bump on the old open-by-default filter would have silently
  force-bundled and installed `bmad-loop` (a Python/tmux/hooks orchestrator,
  air-gap-hostile by default and overlapping ma-agents' own `bmad-dev-epic`)
  by default. A new **two-sided set-equality guard** fails the build loud on
  a resolved set that is either smaller (thin cache) or larger (a silent
  upstream addition) than the allowlist — not just the smaller-only check the
  guard previously had. `bmad-loop` stays available only as an explicit
  opt-in through a custom marketplace source (below); `bmad-dev-epic` remains
  the default air-gapped orchestrator. Two upstream installer/resolver
  changes on ma-agents' own `--custom-source` staging path (`#2511`'s
  Windows-aware local-path detection; a new fail-loud guard on empty/
  duplicate plugin-skill resolution) were regression-verified, not
  re-implemented — both are neutral-to-beneficial for ma-agents' existing
  staging.

### Added
- **Custom marketplace source (opt-in).** After module selection, the
  installer offers `Install additional BMAD extensions from a custom
  source? (y/N)` (or its non-interactive `--bmad-custom-source
  <path|url>` equivalent) to pull extensions from **one** additional BMAD
  marketplace repository (local path or an intra-perimeter Git URL, e.g.
  on-prem GitLab). ma-agents reuses bmad-method's own module discovery to
  enumerate the source's declared extensions, presents them in ma-agents'
  own wizard multiselect (the single-wizard principle is preserved —
  `bmad-method` itself runs non-interactively), and installs only the
  selected subset. Authentication relies entirely on ambient git
  credentials (SSH keys / credential helper) — zero token handling. The
  source and selected extension codes persist in `.ma-agents.json` and
  automatically re-enumerate/reconcile on every `update`, reporting
  newly-published or no-longer-available extensions without silently
  changing what is already installed. A no-source install remains
  byte-identical to a v6.10.0 install without the feature. This is the
  sanctioned path for installing a module ma-agents deliberately excludes
  from its own default bundle (e.g. a locally-published `bmad-loop`, or an
  organization's own replacement for a deprecated agent).
- **Custom source now supports both marketplace formats.** In addition to a
  `.claude-plugin/marketplace.json` bundle repo ("discovery" mode) and a
  single-module repo ("direct" mode), the custom source now understands the
  **BMAD registry-index format** used by the official
  `bmad-code-org/bmad-plugins-marketplace` — `registry/official.yaml` +
  `registry/community-index.yaml` (each a `modules:` list of `repository` +
  `module_definition` pointers). Registry entries are enumerated with their
  trust tier (bmad-certified vs. unverified/community) and installed
  two-level: ma-agents clones each selected entry's pointed-to repository
  (community entries pinned to their published `approved_tag`; the
  `approved_sha` is recorded for the persisted selection), resolves the module
  at `module_definition`, and stages it under a per-entry namespace with the
  same FR238 non-empty/unique-skill-leaf guard. Detection precedence is
  discovery → registry → direct; a registry source that resolves to zero
  installable modules fails clean before staging. Registry sources require
  network access and are unavailable to a fully offline install.

### Deprecated
- **Demerzel (ML Scientist) agent.** `ma-agent-ml` and its 12 `ml-*`
  workflow skills are no longer part of the default bundle for **new**
  installs. This is **non-destructive**: an existing install's
  `ma-agent-ml`/`ml-*` content (and any artifacts produced with it) is left
  completely untouched on update — no auto-removal, no prompt. A one-time
  notice informs users of the deprecation the first time they install or
  update. There is no in-tool migration; teams that still need ML workflows
  can install a replacement from their own organization's BMAD marketplace
  via the custom marketplace source above. This supersedes the previously
  deferred Demerzel-to-Memory-agent conversion (FR193), which is cancelled.

### Fixed
- **`lib/installer.js` no longer special-cases Cline by name.** The two
  remaining `agent.id === 'cline'` literal checks (dual-`.clinerules`-file
  drift guard, framework-template selection) now drive off the agent
  registry's `injectionStrategy` field instead, closing the last
  agent-name-specific conditional the installer carried and fixing the
  pre-existing (baseline, reproduces on `main`) test failure it caused.

## [3.16.0] - 2026-07-09

Knowledge Atlas — mermaid and draw.io diagrams now render as real diagrams.

### Added
- **Live mermaid diagrams.** Authored ` ```mermaid ` fences were shown as source
  text; they now render to SVG in the browser via a vendored, fully-offline
  mermaid runtime (`assets/mermaid.min.js`, ~2.6MB, written only when a page uses
  it). The diagram source is preserved uncorrupted (linkify/sanitize never inject
  markup into it) and remains the legible fallback with no JS.
- **Live draw.io diagrams.** `.drawio` files (mxGraph XML) rendered as a near-blank
  page; they now render via the vendored draw.io GraphViewer
  (`assets/drawio-viewer.min.js`, ~3.6MB). All diagrams.net / font / icon CDN
  endpoints in the viewer are neutralized at vendor time, so rendering is fully
  offline with no network calls.

### Notes
- Both runtimes are vendored (committed under `lib/knowledge-atlas/vendor/`) and
  copied into a site's `assets/` only when a page needs them — diagram-free sites
  carry no extra weight. Only diagram pages gain a local `<script>`; `index.html`
  stays script-free and every reading view stays legible without JavaScript.
- Render-time change — takes effect on any regenerate; no manifest bump needed.

## [3.15.5] - 2026-07-09

Knowledge Atlas — FR clicks land on the definition, not the revision history.

### Fixed
- **Clicking an FR jumped to the revision-history/changelog table.** The entity
  anchor was placed at the FR's first linkified mention, but a BMAD PRD lists FRs
  in a changelog table near the top ("…update FR21, FR91… accordingly") — so that
  became the anchor target. The anchor is now placed at the FR's **definition** —
  the `**FRn:**` / `## FRn:` occurrence immediately followed by a colon — falling
  back to first mention only when no such definition exists. Verified on Prophesys:
  FR1/FR21/FR56/FR87 anchors now sit at their requirement text, not the changelog.
  (Render-time change — takes effect on any regenerate, no manifest bump needed.)

## [3.15.4] - 2026-07-09

Knowledge Atlas — make the 3.15.3 def-site fix actually apply on in-place upgrade.

### Fixed
- **The 3.15.3 fix didn't take effect when regenerating over an existing site.**
  The classified DocType is baked into each cached `FileRecord`, and the
  incremental rebuild reuses unchanged records verbatim — so on an in-place
  re-run, `prd-validation-report.md` kept its old `prd` type and kept winning the
  def-site election. Bumped `MANIFEST_VERSION` 2 → 3 to force the one-time full
  re-extraction on upgrade (same mechanism as the 29.8 1 → 2 bump). Verified on
  Prophesys: a normal in-place regenerate now re-routes all FR links to the PRD.

## [3.15.3] - 2026-07-09

Knowledge Atlas — FR/NFR links now resolve to the PRD, not a report about it.

### Fixed
- **Requirement links pointed at the validation report instead of the PRD.**
  `classifyFile()` typed any filename containing `prd` as the canonical PRD — so
  `prd-validation-report.md` became a rival definition-site. A requirement the PRD
  actually defines (e.g. `- **FR1:** …`) could lose the def-site election to the
  report, and every link to it (from the architecture doc, the graph, etc.)
  resolved to `prd-validation-report.html#frN` rather than the PRD. Validation
  reports, checklists, reviews, and cohesion/assessment reports now classify as
  `report`, so the PRD proper always wins. Verified on Prophesys: all 35
  mis-routed FR links now point at the PRD (0 to the report). Note: a requirement
  that appears *only* in the architecture doc (not the PRD at all) still anchors
  in the architecture doc — there is no PRD description to link to.

## [3.15.2] - 2026-07-09

Knowledge Atlas — anchor precision + edge tracing, from continued real-project use.

### Fixed
- **Every entity link jumped to the same spot in a document:** all entity anchors
  (e.g. all 9 epics on `architecture.html`) were emitted as one clump at the top of
  the article, so `#epic-1` … `#epic-9` all resolved to ~6% into the page. Each
  anchor is now placed at that entity's **first actual mention** in the body, so
  clicking a different epic (or its graph node) lands where that epic is discussed.
  Anchor precision is bounded by the source: entities first mentioned in the same
  table/paragraph still land near each other, but at their own distinct positions.

### Added
- **Trace an edge in the graph:** click an edge to highlight it (drawn dark + thick,
  with a larger arrowhead) and ring **both** of its endpoint nodes, so you can find
  where a connection goes however far apart the ends sit. Click the edge again or
  click empty space to clear. Hovering an edge shows a `source → target [kind]`
  tooltip and a pointer cursor.

## [3.15.1] - 2026-07-09

Knowledge Atlas — graph interaction + navigation fixes from real-project use.

### Fixed
- **Overlapping "blob" graph:** nodes were oversized and piled on top of each other.
  Stronger charge repulsion + larger link distance now spread the graph out, and node
  glyphs are drawn at half the previous size.
- **Dragging a node sprang back:** the graph now pins a node where you drop it
  (`onNodeDragEnd` sets `fx`/`fy`); its linked neighbours follow the drag and nodes
  farther along the graph move progressively less, so you can pull a cluster apart to
  read the connections. Right-click a node to release its pin back into the layout.
- **Clicking a node "went to the start of the document":** a global `scroll-behavior:
  smooth` made the browser's on-load `#anchor` jump unreliable on long reading views.
  Switched to `auto` so entity/graph links land on the target reliably (in-page TOC and
  backlink jumps still work, just without the animation).

No breaking change to the public CLI → PATCH.

## [3.15.0] - 2026-07-09

Knowledge Atlas — **stable release** (Epic 29, FR215–234 / NFR60–69), consolidating the
beta.0–beta.2 prereleases. A pre-bundled, fully-offline static-site generator invoked by
the `bmad-knowledge` skill: authoritative scan → typed manifest → per-document reading
views + interactive typed graph + generated diagrams + orphan/gap view + offline search,
all self-contained (no CDN/network, `file://`-safe) and deterministic. Includes
config-aware knowledge-source discovery (scans the folders defined in `_bmad/bmm/config.yaml`),
reference-edge extraction so planning-centric projects produce a connected graph with
working backlinks, and resolution of authored inter-document markdown cross-links. Sealed
air-gap packaging, sanitized output, cross-platform byte-identical builds. See the beta
entries below for the detailed per-story changelog. No breaking change to the public CLI → MINOR.

## [3.15.0-beta.2] - 2026-07-09

Knowledge Atlas beta.2 — fixes authored inter-document links (found in real-project
testing). Author-written markdown cross-links between source docs (e.g.
`[roadmap](roadmap.md#…)`, `[domain model](domain-model.md)`) were emitted verbatim
and, because reading views are written flat under `docs/<slug>.html`, resolved to a
nonexistent `docs/roadmap.md` → broken links. The renderer now rewrites an authored
relative doc-link (resolved against the source doc's directory) to the corresponding
rendered page, preserving `#fragment` and handling spaced/`.MD` filenames and
`../`/subdir traversal; non-scanned targets are left untouched. Verified on a real
project: 18 → 0 broken links. No breaking change to the public CLI.

## [3.15.0-beta.1] - 2026-07-07

Knowledge Atlas beta.1 — fixes from real-project (Prophesee) testing of beta.0:

- **Broken links fixed:** the traceability spine, interactive graph, and orphan/gap
  view linked entities by their raw source path (`…/foo.md#anchor`) instead of the
  rendered page, so every click opened an empty page. All three now resolve to the
  real `docs/<slug>.html` page (link-integrity test guards it).
- **Config-aware knowledge-source discovery (Story 29.7):** the engine now reads
  `_bmad/bmm/config.yaml` and scans the project's configured knowledge folders
  (`planning_artifacts` / `implementation_artifacts` / `knowledgebase_path`) in
  addition to `_bmad-output` — resolving `{project-root}` and stripping wrapping
  quotes. Projects with no such config are unchanged (byte-identical). `.git`,
  `node_modules`, and hidden files/dirs are excluded; stale output is purged on
  regen (guarded so it can never delete a configured source).
- **Reference-edge extraction (Story 29.8):** planning-centric projects (dense PRD
  with few/no story files) previously produced a disconnected graph with no
  backlinks. The engine now derives `references` edges from the docs/sections that
  mention an entity, so the graph connects and "Referenced by" populates
  (Prophesee: 0 → 317 edges). Gap/orphan detection stays keyed on semantic edges,
  so a merely-referenced requirement is still flagged as unimplemented.

Beta.0 users should reinstall (the manifest version bumped, forcing a clean
re-extraction). No breaking change to the public CLI.

## [3.15.0-beta.0] - 2026-07-03

Knowledge Atlas — Epic 29 beta prerelease (FR215–234 / NFR60–69). Adds a
pre-bundled, offline-first static-site generator (`bmad-knowledge` skill) that
scans a project's `_bmad-output` and produces a fully self-contained knowledge
site with zero runtime dependencies. No breaking change to the public CLI
surface → MINOR; beta prerelease pending cross-platform CI sign-off.

### Added

- **Knowledge Atlas engine** (`lib/knowledge-atlas/dist/atlas.cjs`, ~737 KB committed
  bundle, FR215/FR230): scan → manifest → reading views → interactive graph → orphan/gap
  report, all in a single sealed CJS artifact. The bundle is vendored into the
  ma-agents distribution so consuming projects never run `npm install` for the Atlas.

- **`bmad-knowledge` skill** (FR215/FR230): registered in `skills/bmad-knowledge/`,
  `lib/bmad-extension/skills/bmad-knowledge/`, `module-help.csv`, and
  `marketplace.json.template`/built plugin bundle (skill count 62). Invokes the
  committed `atlas.cjs` against the project's `_bmad-output` to generate or refresh
  the knowledge site.

- **Six-page site output** (FR216–222): `index.html` (home + health snapshot),
  `search.html` (offline lunr full-text search), `graph.html` (interactive
  force-graph visualization), `diagrams.html` (Mermaid diagram viewer),
  `orphans.html` (orphaned/gap entities), and per-document reading views under
  `docs/`. All pages are fully self-contained (no CDN, no network fetch,
  `file://`-safe).

- **Manifest system** (FR223–226): incremental `manifest.json` with stable key
  ordering, schema-version guard, POSIX-relative paths (no machine-specific
  absolute paths), and LF normalization. Cross-platform byte-identical across
  Linux and Windows.

- **Offline packaging + air-gap seal** (NFR60/NFR61/NFR67): lunr browser runtime
  vendored at build time; `offline-install-verify.sh` generates and verifies an
  Atlas under `--network none`; `offline-install.yml` CI gate.

- **Determinism** (NFR62): pinned `SOURCE_DATE_EPOCH`, sorted entities, LF output,
  relativized manifest paths, CRLF-tolerant scanner — same `_bmad-output` produces
  byte-identical output on Linux and Windows from any absolute project path.

- **Graceful degradation** (NFR63/FR234): per-renderer try/catch in `generate.ts`
  (one failing page never aborts the run), tolerant scanner (binary/zero-byte/unknown
  docs skipped), bad-YAML frontmatter tolerated. Disabled-JS baseline: every page
  is legible and navigable without executing any script.

- **Output sanitization** (NFR64): `sanitizeHtml()` in `linkify.ts` — allowlist-based
  tag/attribute filter strips `<script>`, `<iframe>`, `onerror=`, `javascript:`/
  `vbscript:`/`data:` schemes from all document-rendered HTML.

- **Graph reconciliation** (NFR65): `reconcileWithKgJson()` merges the auto-extracted
  graph with hand-curated `knowledge-graph.json` if present.

- **Test suites** (Story 29.1–29.6, 315+ assertions):
  `knowledge-atlas-{smoke,manifest,render,graph,packaging,offline-safety,reconcile,
  determinism,degradation,realproject}.test.js`

- **Release gate** (Story 29.6): bundle-drift check (build-to-temp, never mutates
  committed `dist/atlas.cjs`), cross-platform determinism gate (two-path byte-identity
  + CRLF≡LF), graceful-degradation gate (malformed docs + disabled-JS baseline),
  NFR64 consolidated safety assertion, and real-project smoke against the ma-agents
  repo's own `_bmad-output`.

### Fixed

- **Bundle-drift test flaw** (Story 29.6 AC 8): the prior drift check rebuilt
  `atlas.cjs` in place and restored committed bytes in a `finally` — this mutated
  the working tree during the test run and allowed a stale committed bundle to pass.
  Rewritten to build to a temp path and byte-compare against the committed file,
  never writing to `dist/atlas.cjs`.

## [3.14.1] - 2026-06-30

Cosmetic patch: rename the SQA & Standards Expert persona **Gad → Gadi**. Display-name
only — no change to the agent id (`bmm-qa`), skill folder/name (`ma-agent-sqa`), install
dir (`_bmad/skills/sqa/`), report-file naming, or memory path. No CLI/API surface change → PATCH.

### Changed

- **Renamed SQA persona `Gad` → `Gadi`** (#126) across the installed agent registry
  (`lib/agents.js`), BMAD persona customization (`bmm-qa.customize.yaml`), the `ma-agent-sqa`
  agent skill (`SKILL.md` + manifest `displayName`), the `sqa-audit` / `sqa-ieee12207` /
  `sqa-requirements-quality` workflow report footers, `module-help.csv`, the plugin
  `marketplace.json` description, and the README. Specification docs (`prd.md`,
  `architecture.md`) updated in place with new revision-history entries; the change was
  driven through the `bmad-correct-course` workflow and delivered under the standalone story
  `rename-sqa-persona-gad-to-gadi`. Completed Epic 20/22 records and `done/*` history left intact.
- Regenerated the bundled extension plugin (`lib/bmad-extension-plugin/`) and the
  `.agents/skills/` standalone mirror to carry the new display name.

## [3.14.0] - 2026-06-27

BMAD v6.9.0 integration (Epic 28). A lean, feature-inheriting bump: the v6.9.0 module
registry path **and** schema are unchanged from v6.8.0 (verified against the npm-installed
package), so the offline cache reader needed no change; the only upstream behavioral change
that touches the wrapper — the installer's `python3`→`uv` environment check — is
warn-don't-block, and ma-agents already decides success/failure off the `execSync` exit
status, never installer stdout. No breaking change to the public CLI surface → MINOR.

### Changed

- **Bumped bmad-method 6.8.0 → 6.9.0** (FR211, supersedes FR208) and rebuilt the bundled
  offline cache (`bmadMethodVersion: 6.9.0`, `registrySchema` unchanged at `package-root-v68`)
  and the ma-agents extension plugin. Upstream v6.9.0 additions are inherited via passthrough:
  the `bmad-forge-idea` core idea-validation skill, the `bmad-architecture` lean-spine rewrite
  (with `bmad-create-architecture` retained as a forwarding shim until BMAD v7), the canonical
  `memlog.py` working-memory primitive, party-mode/brainstorming enhancements, the Astro 6
  security upgrade, and the WSL-runs-Windows-Node installer guard. `scripts/build-bmad-cache.js`
  is untouched — the registry did not relocate as it did at v6.8.0.

### Added

- **uv-transition resilience + python-scoping regression guards** (`test/uv-transition-resilience.test.js`,
  FR212/FR213/NFR59): pin that v6.9.0's warn-don't-block `uv` check cannot break the install path
  (the decision rides on the `execSync` exit status, never installer stdout), and that ma-agents
  control-plane Python stays on `python`/`python3` and is never migrated to `uv run`. The
  `ml-experiment`/`ml-infra`/`ml-eda` skills' `uv run python` guidance — which runs the user's
  ML-project scripts in the user's own `uv` env — is the documented, intentional exception.
- **Passthrough-reconciliation guards** (`test/passthrough-reconciliation-6-9-0.test.js`, FR214):
  the existing `deployClineWorkflows` reconcile generates a `bmad-forge-idea` Cline wrapper and
  tolerates the `bmad-architecture`/`bmad-create-architecture` shim pair with no dangling wrapper.
  The new `hermes-agent` and `CodeWhale` installer platforms are intentionally **not** added to
  ma-agents' platform registry (deferred per Decision P5-6(d); passthrough already deploys
  upstream support).

## [3.13.2] - 2026-06-26

Skill-discovery fixes surfaced by a real multi-agent install (cline + GitHub Copilot),
root-caused against source. No breaking change to the public CLI surface → PATCH.

### Fixed

- **SKILL.md frontmatter `name` now matches the skill folder id (#120)**: the installer
  injected `skill.json`'s human-readable display name (e.g. `Git Workflow`) as the
  generated SKILL.md frontmatter `name`, while the directory uses the kebab id
  (`git-workflow-skill`). Strict validators such as cline require the frontmatter name
  to match the containing directory, so 31 of 44 standalone skills failed to load.
  `performInstall` now emits `name: <skillId>` for every agent target; `skill.json`
  keeps its display name for listings/wizard UI.
- **GitHub Copilot now discovers installed skills (#121)**: the skill-bootstrap
  instruction (the "read `.agents/skills/MANIFEST.yaml`" block) was written to
  `.github/copilot/copilot.md`, a path Copilot does not read. It now lands in
  `.github/copilot-instructions.md` — the repository custom-instructions file Copilot
  actually loads (VS Code, Visual Studio, github.com), as the PRD specifies. Skills were
  installed correctly under `.agents/skills/` all along; only the bootstrap pointer was
  misplaced.

## [3.13.1] - 2026-06-15

Epic 27 follow-ups (stories 27.8–27.16) — fixes surfaced by an adversarial review of a
real `D:\Code\Workshop` install, root-caused against source. No breaking change to the
public CLI surface → PATCH.

### Fixed

- **verify-manifest SessionStart hook now works in real installs (27.8)**: the hook is
  copied into the target's `.claude/hooks/verify-manifest.js` and the command points
  there, instead of the dead `$CLAUDE_PROJECT_DIR/lib/...` package-relative path that
  only resolved inside the ma-agents dev repo. Legacy command strings are migrated on
  upgrade and the copied file is removed on uninstall.
- **Malformed `agents: [null]` in the project-root manifest (27.9)**: `ensureManifest`'s
  create branch now guards a null `agentId`, writing `agents: []` instead of `[null]`.
- **Mixed CRLF/LF in the composed instruction block (27.10)**: `composeInstructionBlock`
  normalizes EOL at the single return point; instruction-block templates pinned to
  `eol=lf` via `.gitattributes`.
- **Regenerated `_bmad/` tree left tracked (27.11)**: the installer now ignores `_bmad/`
  in `.gitignore` (via a new `ensureBmadDirIgnored` mirroring the plugin-stage helper);
  `_bmad-output/` remains intentionally tracked.
- **Custom output folder not propagated to every module (27.14)**: a post-install pass
  normalizes module artifact paths whose output-folder segment diverged from
  `[core] output_folder` — working around an upstream `bmad-method` `endsWith('_output_folder')`
  suffix-match that bled bmb's `skills/` default into gds artifact paths. (Upstream patch
  tracked separately; vendored code untouched.)
- **`.agents/skills` missing the standalone catalog + `MANIFEST.yaml` (27.16)**: when a
  BMAD-populated `.agents/skills` exists but no `.agents`-targeting agent was selected,
  the standalone catalog and `MANIFEST.yaml` are now backfilled so the dir is consistent.

### Changed

- **BMAD module selection is now persisted (27.13)**: the selected module set is recorded
  in `.ma-agents.json`, so a deselected module (e.g. `gds`) stays excluded across
  subsequent installs/reconfigures instead of silently returning. No persisted set →
  install-all fallback (back-compat).
- **Config path convention unified (27.15)**: `writeRepoLayoutConfig` emits the
  `{project-root}/`-prefixed form (matching `config.toml`) instead of adding a third
  bare-relative variant.
- **Project-root `.ma-agents.json` is now profile-only (27.12)**: it stores only
  profile/settings (no empty `skills: {}` / `agents: []` shape it never owned); per-agent
  skills manifests remain the authoritative inventory and `getStatus` skips the
  root-scoped manifest. (Minimum-change fix; full single-manifest redesign deferred.)

## [3.13.0] - 2026-06-13

BMAD-METHOD **v6.8.0** integration (Epic 27). Inherits upstream v6.8.0 features and
reworks the bundled-module-registry reader to follow the registry's relocation, while
preserving the air-gapped install guarantee (NFR57/NFR50). No breaking change to the
ma-agents public CLI surface → MINOR bump.

### Changed

- **Bumped `bmad-method` 6.6.0 → 6.8.0** and rebuilt the bundled offline cache and the
  plugin bundle against it. `lib/bmad.js` `BMAD_TARGET_VERSION` is now `6.8.0`. The
  bundled module set is unchanged in membership — `tea`, `bmb`, `cis`, `gds`, `wds`
  (all `type: bmad-org`) — and `wds` (Whiteport Design Studio) is an **active** module
  at 6.8.0, not retired.
- **Relocated-registry reader (FR207, P5-5)**: `scripts/build-bmad-cache.js` now reads
  the bundled module registry from its v6.8.0 package-root location
  (`bmad-modules.yaml`), trying candidate paths in order (package-root v6.8.0 →
  `tools/installer/modules/registry-fallback.yaml` → legacy
  `tools/cli/external-official-modules.yaml`) and reporting which schema it found. The
  bundle decision now keys on the registry's `type: bmad-org` field (case-insensitive,
  trimmed) instead of the pre-6.8.0 `built_in` flag; `type: experimental` (e.g.
  `automator`) is excluded, and `branch` defaults to `main` (the 6.8.0 schema omits it).

### Added

- **Thin-cache fail-loud guard (FR208, NFR56)**: `build-bmad-cache.js` aborts the build
  — before writing any `cache-manifest.json` — if the registry resolves *fewer* than the
  known bundled set (`tea, bmb, cis, gds, wds`) or contains duplicate module codes. The
  registry path has now moved twice across bmad-method versions, so silent degradation to
  a partial/empty cache is a recurring risk; the guard converts that into a loud,
  actionable failure instead of shipping a broken offline bundle that "looks" successful.
- **Cline workflow-wrapper reconciliation (FR209)**: `deployClineWorkflows` now removes
  stale `.clinerules/workflows/*.md` wrappers whose backing `.cline/skills/<name>/` no
  longer exists (e.g. after an upstream skill rename/retirement), so Cline's `/`-menu
  stops offering dead workflows. Deletion is scoped strictly to ma-agents-generated
  wrappers via a conservative content fingerprint (`isGeneratedClineWrapper`);
  user-authored files are never touched, and the operation is idempotent.

### Fixed

- **Offline `file://` origin URL hardened (release-gate review)**: `restoreGitDir` now
  builds the local origin URL with `url.pathToFileURL()` instead of string concatenation,
  producing a well-formed `file:///C:/...` (three-slash) URL on Windows and
  percent-encoding paths that contain spaces or other reserved characters. The git call
  switched from `execSync` (shell-interpolated) to `execFileSync` (arg array), matching
  the rest of the codebase. This is the URL bmad-method's `cloneExternalModule()` uses to
  satisfy `git fetch origin` offline; the previous `file://C:/...` form happened to work
  with current git but was RFC-malformed and fragile on spaced paths.
- **`wds` module description corrected**: was labelled "Web Dev Studio — retired
  upstream"; it is in fact "Whiteport Design Studio" and an active `type: bmad-org` clone
  at v6.8.0. The install wizard's module-selection prompt now shows the correct name and
  no longer implies the module is retired.

### Verification (Epic 27 release gate, Story 27.7)

- **Offline install gate (NFR57/NFR50) — PASSED.** Ran the repo's CI offline harness
  (`offline-install-verify.sh`) inside a Docker container with `--network none`
  (kernel network-namespace isolation). Egress was proven blocked, then
  `ma-agents install` completed successfully and pre-populated **all five** bundled
  modules (bmb, cis, gds, tea, wds) from the v6.8.0 cache with **zero network calls** on
  the install path; bmad-method reported BMad Core v6.8.0 and WDS installed, and all
  post-install invariants held.
- **Cross-platform suite — GREEN.** Full `npm test` chain passes on Windows; the fixes
  are EOL-robust so Linux/CI parity holds (the CRLF suite-health confounder was resolved
  in Story 27.5, not waived).
- **PluginResolver / skill-enumeration passthrough** verified against v6.8.0 (Story 27.6).
- **Plugin bundle** rebuilt at `3.13.0` via the build-time `${version}` placeholder (no
  literal embedded); `plugin-manifests.test.js` and `build-plugin.test.js` green.

## [3.12.3] - 2026-05-08

### Bug Fixes

- **Repo-layout local path no longer creates a nested `_bmad-output/<…>-artifacts/`
  subtree**: When the user picks "Local path" for knowledgebase or sprint
  management and provides e.g. `D:\foo\planning`, prior versions wrote
  `planning_artifacts: "D:/foo/planning/_bmad-output/planning-artifacts"`,
  causing bmad-method to create that nested directory inside the user's
  knowledgebase folder. The wizard prompt phrasing ("Where is your
  knowledgebase managed?") implies the answer IS the artifacts folder, not
  a parent — the install behavior now matches that interpretation.
  - `bin/cli.js writeRepoLayoutConfig`: drops the
    `/_bmad-output/<…>-artifacts/` suffix when the user-supplied path is
    not `.`. Single-repo (mode `same`, path `.`) continues to use the
    canonical `_bmad-output/...` layout — no change to existing same-repo
    installs.
  - `bin/cli.js collectLocalPath`: prompt text clarified to
    *"this is the literal folder; no extra subdirectories will be
    created"* so the contract is explicit.

### Tests

- `test/cross-repo-validation.test.js` and `test/portable-paths.test.js`:
  updated assertions to expect literal paths rather than the previous
  `<path>/_bmad-output/<...>-artifacts` form.

### Migration Notes

- **Breaking for projects that previously configured a multi-repo layout
  and committed artifacts to `<kbPath>/_bmad-output/planning-artifacts/`**.
  Existing `_bmad/bmm/config.yaml` files are not rewritten on upgrade —
  only **new installs** or runs through the layout wizard pick up the new
  contract. To migrate an existing project: move the contents of
  `<kbPath>/_bmad-output/planning-artifacts/` up into `<kbPath>/`, then
  re-run the layout wizard (`npx ma-agents config layout`). Same for
  sprint management.

## [3.12.2] - 2026-05-05

### Bug Fixes

- **Offline install regression in 3.12.1**: 3.12.1's "install all bundled modules
  by default" fix exposed a latent bug: bmad-method's `cloneExternalModule()`
  resolves the latest stable tag from GitHub's API, and on an air-gapped machine
  it falls back to reading `<moduleCacheDir>/.bmad-channel.json` — a marker file
  ma-agents never wrote when pre-populating the cache. Result: a fresh offline
  install of any external module (bmb, cis, gds, tea) failed at the first
  module with `Could not resolve stable tag for '<module>'`. (Pre-3.12.1 the bug
  was masked because ma-agents only ever requested `--modules bmm`, which ships
  built into bmad-method and skips the external-cache resolution.)
  - `lib/bmad.js`: added `ensureCacheMarker(moduleDir, manifestEntry)` that
    writes a `.bmad-channel.json` matching bmad-method's `writeChannelMarker()`
    schema (`channel: 'stable'`, `version` from manifest branch, `sha` from
    manifest commitSha). Called from `prePopulateBmadCache` after each module
    copy (and on the skip path, to repair caches left wedged by 3.12.1).
    Existing markers are never overwritten.

### Tests

- `test/bmad-module-selection.test.js`: 5 new tests for `ensureCacheMarker`
  covering schema correctness, idempotency, and no-op safety on missing
  manifest data. Total 33 tests, all passing.

## [3.12.1] - 2026-05-05

### Bug Fixes

- **BMAD module install — restore originally-intended default (FR123)**: Fixed a
  defect where the install pipeline hardcoded `['bmm']` as the BMAD module list,
  stranding the bundled `tea`, `bmb`, `cis`, and `gds` modules in
  `~/.bmad/cache/external-modules/`. The originally-intended behavior — install
  every non-retired module from the cache manifest — is now the default. Users
  can scope down with `--bmad-modules <csv>` (e.g. `--bmad-modules tea,bmb`) or
  open a multiselect prompt with bare `--bmad-modules`. `bmm` is force-included
  in every path. Retired modules (currently `wds`) are filtered out.
  - `bin/cli.js`: replaced four hardcoded `['bmm']` literals with a new
    `selectBmadModules()` helper; added `--bmad-modules` optional-value flag
    parsing in `parseFlags()`; updated `--help` and examples.
  - `lib/bmad.js`: added `BMAD_MODULE_DESCRIPTIONS`, `getInstallableBmadModules()`,
    `getInstalledBmadModules()`, `resolveBmadModules()` helpers and exported them.
  - `_bmad-output/planning-artifacts/{prd,architecture}.md`: refined FR123 and
    the parameter-mapping table to make the `--modules` default explicit.

### Tests

- `test/bmad-module-selection.test.js`: 28 new tests covering the helpers, both
  `--bmad-modules` flag forms (CSV and bare), and validation.

## [3.12.0] - 2026-05-02

### Bug Fixes

- **Cline `.clinerules` directory invariant (Story 25.4)**: Fixed a bug where ma-agents
  created `.clinerules` as a flat file (a duplicate of `.cline/clinerules.md`), which
  caused an ENOTDIR error when `deployClineWorkflows()` tried to create `.clinerules/workflows/`.
  Changes:
  - `lib/agents.js`: removed `.clinerules` from Cline `instructionFiles` — `.cline/clinerules.md`
    is the single injection target.
  - `lib/installer.js`: `checkClinerulesDualFileDrift()` now no-ops when `.clinerules`
    is a directory (correct Cline structure); only fires for legacy file installs.
  - `lib/bmad.js`: `deployClineWorkflows()` migrates a legacy `.clinerules` file to a
    directory before generating `workflows/` — ensures smooth upgrade from v3.11.0 installs.

### Tests

- `test/clinerules.test.js`: 13 tests updated to cover directory invariant, single-file
  injection, legacy migration, and drift-check no-op.

## [3.11.0] - 2026-05-02

### New Features

- **Cline workflow generation (Epic 25 / Story 25.3)**: After BMAD installs, updates,
  or migrates when Cline is a selected tool, `deployClineWorkflows()` now scans
  `.cline/skills/` and writes a `.clinerules/workflows/<skill-name>.md` wrapper for
  every installed skill. Cline users can type `/` in chat to browse and invoke all
  BMAD skills via Cline's native slash-command system. Two wrapper strategies:
  - Skills with `workflow.md` get a delegation wrapper pointing to that file.
  - SKILL.md-only skills get a read wrapper with a frontmatter-ignore instruction.
  No-op when Cline is not among the selected tools. (`lib/bmad.js`)

## [3.10.0] - 2026-05-01

### Bug Fixes

- **Jira backend first-run fix (Story 25.1)**: Fixed a bug where the Jira backend
  (`tracking_system: jira`) was ignored on the first run after install. Sprint skills
  now correctly detect and activate the Jira backend on initial invocation. (`lib/bmad.js`)

### Dependencies

- **BMAD v6.6.0**: Bundled bmad-method updated to v6.6.0, including upstream persona
  and workflow improvements.

## [3.9.0] - 2026-04-30

### New Features

- **Jira sprint backend selection at install time (Epic 14 / Stories 16.1, 16.2)**:
  The `ma-agents` wizard now offers Jira as a 4th option for sprint management
  (alongside the existing file-system options). When selected, the wizard collects
  the Jira URL and project key, writes `sprint_backend: jira`, `jira_url`, and
  `jira_project_key` to `_bmad/bmm/config.yaml`, and skips creating a local
  `sprint-status.yaml` path. (`bin/cli.js`)

- **Skill-level Jira routing in all 13 sprint management skills (Epic 14 / Stories 17.22, 14.3, 14.4)**:
  Every sprint management skill now begins with a `## Backend Routing` section that
  reads `tracking_system` from `sprint-status.yaml` and routes accordingly:
  - `file-system` → existing file-based workflow unchanged
  - `jira` → skill-specific Jira operation executed via whatever Jira-capable tool
    is available in the agent context (MCP server, plugin, or native integration)

  On Jira failure the skill pauses and offers the user:
  - *(a) Retry* — re-attempt the Jira operation
  - *(b) Switch to file management* — permanently writes `tracking_system: file-system`
    to `sprint-status.yaml` and `sprint_backend: file-system` to config, then
    completes the operation locally

  Skills covered: `add-sprint`, `add-to-sprint`, `remove-from-sprint`,
  `sprint-status-view`, `cleanup-done`, `bmad-sprint-planning`, `modify-sprint`,
  `bmad-dev-story`, `bmad-sprint-status`, `close-sprint`, `prioritize-backlog`,
  `generate-backlog`, `story-status-lookup`.

- **Jira operation descriptions specification (Epic 14 / Story 14.1)**:
  `mcp-detection-pattern-spec.md` Section 6.2 now contains per-skill Jira operation
  description tables, canonical field mapping (14 fields), and bulk-write limitations
  for `bmad-sprint-planning` and `generate-backlog`.

### Epic Completions

- **Epic 5 (Bundled BMAD Installation)** fully closed. Stories 5.5 (`buildBmadArgs()`
  explicit parameter passing, 34 unit tests) and 5.6 (space-in-path verification)
  confirmed delivered and marked done.
- **Epic 14 (Jira Backend Integration)** — Stories 14.1, 14.3, 14.4 done.
  Story 14.2 (Confluence) deferred pending PRD definition of `knowledge_backend`.

## [3.8.1] - 2026-04-29

### Bug Fixes

- **Routing alignment for copilot, roo-code, kilocode (bmad-method 6.5.0)**:
  `bmad-method 6.5.0` moved the `github-copilot`, `roo`, and `kilo` platform
  `target_dir` values from tool-specific paths (`.github/skills`, `.roo/skills`,
  `.kilocode/skills`) to the shared `.agents/skills/` directory. `lib/agents.js`
  `skillsDir`, `lib/bmad.js` `TOOL_SKILL_DIRS`, multi-tool smoke workflow, and
  smoke verifier `FLAGSHIP_DIRS` are now aligned to `.agents/skills/` for these
  three platforms. Persona skills (`ma-agent-*`) now land correctly in all five
  flagship tools under CI.
- **Migration**: `OBSOLETE_TOOL_SKILL_DIRS` extended with `.github/skills`,
  `.roo/skills`, and `.kilocode/skills` entries so stale directories from 3.8.0
  installs are automatically cleaned up on the next `ma-agents install`.
- **Invariant E (smoke test)**: Updated to skip scoping checks when two tools
  share the same directory (the shared `.agents/skills/` case).

## [3.8.0] - 2026-04-28

### Bug Fixes

- **B1 — `--agent` flag scoping**: `--agent <name>` now correctly scopes the install
  to the selected tool only. Previously, passing `--agent claude-code --yes` would
  still install skills into all registered tools. The guard `if (selectedAgentIds.length === 0)`
  in the wizard ensures the pre-selected agent is never overwritten by the
  "all agents" fallback path. (`bin/cli.js`)
- **B2 — Stale `.github/copilot/skills/` cleanup**: Added `OBSOLETE_TOOL_SKILL_DIRS`
  registry and `migrateObsoleteToolDirs()` to `lib/installer.js`. On every install/upgrade,
  the legacy `.github/copilot/skills/` directory (written by the pre-F2b routing) is
  automatically removed when the replacement `.github/skills/` directory has content.
  If the replacement is absent or empty, the obsolete directory is preserved with a
  warning. The migration is idempotent and runs before the skill install loop. (`lib/installer.js`)

### Dependency Upgrade

- Bumped `bmad-method` from `6.3.0` to `6.5.0` (exact pin). This release brings the
  42-platform baseline and confirmed TOML/YAML coexistence for config files.
- All 46 `fs-extra` call sites in `lib/installer.js` audited — confirmed safe. `ma-agents`
  invokes `bmad-method` exclusively via CLI subprocess; there is no direct `fs-extra`
  API surface shared between packages at runtime.
- `BMAD_TARGET_VERSION` in `lib/bmad.js` updated from `'6.3.0'` to `'6.5.0'`.

### Assessment Findings (no action required in this release)

- **`.agents/skills/` cross-tool standard (Story 24.11)**: None of the 5 registered tools
  (Claude Code, Copilot, Cline, Roo Code, Kilocode) migrated exclusively to `.agents/skills/`.
  Per-tool routing in `lib/agents.js` remains unchanged. This is why the semver bump is
  **minor** (3.7.0 → 3.8.0) rather than major — no existing user installation is broken.
- **Plugin resolver (Story 24.8)**: Bundle resolves via Strategy 1 (module.yaml at the
  common parent directory). No `package.json` at plugin root is required by `bmad-method`
  v6.5.0. Bundle-drift check is clean; CI gates healthy.
- **`customize.toml` on_complete hooks (Story 24.7)**: `customize.toml` is not processed
  by BMAD's `--custom-source` pipeline in v6.5.0. The hooks are defined in the file but
  not yet executed end-to-end. Deferred — no user-visible change.
- **`persistent_facts` spike (Story 24.12)**: The `persistent_facts` field is not present
  in the published `bmad-method` npm package (it exists only in the upstream monorepo HEAD).
  The marker-injection layer (`MA-AGENTS-START / MA-AGENTS-END`) remains the correct
  mechanism for persisting agent instructions. No change to installation behavior.

### Tests Added

- `test/agent-scope.test.js` — 6 regression tests for B1: verifies that installing with
  `agentIds: ['claude-code']` only writes to `.claude/skills/` and leaves `.cline/skills/`,
  `.roo/skills/`, `.kilocode/skills/`, `.github/skills/` untouched.
- `test/obsolete-tool-dirs.test.js` — 8 tests for B2: covers remove / preserve / noop /
  idempotency / frozen-registry / content-intact / recursive-removal scenarios.

---

## [3.7.0] - 2026-04-10

Epic 22 features and remediations. See commit `9dec9c5` for full details.
