# Story 38.4 — Confluence engine: publish engine, page tree and collision check; the two Confluence members

Status: in-progress
Blocked on: none (38.3 merged 2026-11-16, extension `main` `626015c`, ma-agents `main` `f828c19` — this branch starts from both)
Wave: 2 (Epic 38; parallel with 38.5)

**FR:** FR290 (publish to the planning destination from the planning skills and ticket pages to the tickets destination after Sofia's board and store changes; "published pages mirror the initiative store layout under the destination's root page"), FR300 (two destinations; `tickets_space = ""` means the planning space; an empty root-page answer means a page named for the project, recorded by `ma-atlassian-confluence-record-root-page`; no answer holds a credential), FR293 (answers read only through `resolve_config.py`). **NFR:** NFR84 (every per-module gate stays green). **Decisions:** P5-11.9 (Confluence model), P5-11.4 (overlay and bind table: the publish rows), P5-11.3 (configuration only through `resolve_config.py`), P5-11 rejected alternatives (no Python port of the engine: Node is on every host for the Skills CLI).

## Story

As a **team on on-prem Confluence**,
I want the planning documents and the tickets of our initiative store published as a page tree under each destination's root page, previewed before anything is written, refused before the first write when a title would collide, and a root page recorded as a module answer,
so that BMad's planning and product-owner skills publish to our Confluence without overwriting a page we did not publish, and a re-run updates only what changed.

## Context

The epic brief (`epics.md`, "## Epic 38"): 38.4 is "Confluence engine — publish engine, page tree and collision check as `node` scripts; `ma-atlassian-confluence-plan` previews the page tree; `ma-atlassian-confluence-record-root-page` records a root page; planning and tickets destinations." The scope bullets: `ma-atlassian-bind` declares the JavaScript scripts in its `[skill] scripts`; 38.1 created the two member folders as placeholders and "38.4 gives them their content"; out of scope a Python port of the engine and a local Confluence mirror; "Builds on Epic 31 (Confluence publish engine, page tree and collision predicate, packaged as module scripts)". 38.3's D1 keeps the override generator in Python (`bind.py`) and leaves "the three Confluence scripts (publish engine, page tree, collision check — the Confluence page-collision predicate of Epic 31)" to this story; its D11 / PO item (e) leaves the final publish wording in `bind-targets.toml` `[text]` to 38.4.

F29 (`prd/capabilities/ma-agents-v7-line.md`): module record `:127-136` (`ma-atlassian-confluence-plan` "preview of the page tree an initiative would publish", `ma-atlassian-confluence-record-root-page`), Config questions `:291-310`, Destinations `:312-319` (planning: PRD, architecture, UX, brief, PRFAQ, facilitate outputs; tickets: initiative, epic and story files, build plans; "Published pages mirror the initiative store layout under the destination's root page"), FR290 `:443`, FR300 `:448`. Architecture: P5-11.9 (`decisions/bmad-integration-and-bundling.md:249-262`), the structure shard (`structure-and-boundaries.md:183-189`: `scripts/` holds "publish engine, page tree, override generator, collision check, migrate_binding.js (JavaScript)"; data flow `:236` "Publish … → `node _bmad/ma-atlassian/scripts/<engine>` → Confluence page under the planning or tickets root page").

3.x engine (ma-agents `lib/confluence-page-tree.js`, Epic 31 Story 31.10): one page per Markdown artifact under a root page, the folder mapping with the index rule (`prd.md` + `prd/` = one page), page identity (space, title), the in-plan and cross-store title-collision guard (root page included, two roots with one title shared), an operation set of `resolve_page` / `create_page` / `update_page`, no delete, no body read, and one success exit after every page has an id. `lib/confluence-publish-hook.js` is 3.x's override generator, replaced by 38.3's `bind.py`.

Upstream at `e734d3a` (the v7 initiative store): `bmad-agent-po/workflow.md:81-104` (the ticket tree: `{output_folder}/<initiative>/<initiative>.md`, `tickets/tickets.toml`, `tickets/epic-*/epic-*.md`, `tickets/epic-*/tickets/story-*.md`, `*-plan.md`, `spike-*`, `backlog/bug-*.md`, `.memlog.md`; "other skills' runs, named after it, sit above"); the planning skills' run folders (`bmad-prd` `prd-{slug}/prd-{slug}.md`, `bmad-architecture` `architecture-{slug}/…`, `bmad-ux` `ux-{slug}/` with `DESIGN.md` and `EXPERIENCE.md`, `bmad-product-brief` `brief-{slug}/…`, `bmad-prfaq` `prfaq-{slug}/…`, `bmad-facilitate` `{id}-{slug}/`; under the epic's folder when the ticket is an epic); `bmad/scripts/resolve_config.py` (`core.output_folder` holds `{project-root}`); `bmad/references/setup.md` "Answers" (`setup.py --module-answers` adds only pending answers and "never changes an existing value"; a changed answer is the agent's edit through `bmad setup`). `mcp-atlassian` 0.24.4 (`servers/confluence.py`: `confluence_get_page`, `confluence_search`, `confluence_create_page`, `confluence_update_page`; `utils/io.py` `get_file_root`).

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 re-asserts it after `bmadRef.core` moves.

1. **Page tree of the two destinations (FR290, FR300, P5-11.9).** (Re-run at GA: yes.) `scripts/confluence_page_tree.cjs` maps every Markdown file under `core.output_folder` to one destination: a file inside a folder outside the ticket tree (a planning run) to **planning**; a ticket file (`initiative-*`, `epic-*`, `story-*`, `spike-*`, `bug-*`, `*-plan`) whose folders are all ticket-tree folders (`initiative-*`, `epic-*`, `tickets`, `backlog`) to **tickets**; hidden paths, non-Markdown files and other files are left out with the reason. Pages nest as the folders do under the destination's root page; a file named after its folder is that folder's page; `tickets/` folders are not pages; a page inside a planning run carries the run's name (`ux-checkout - DESIGN`). PASS: case `tree` (the planning and tickets trees and six left-out files of the fixture, exactly). FAIL: a page the tree does not predict, or a left-out file not reported.
2. **Preview member (F29 `:133`).** (Re-run at GA: yes.) `ma-atlassian-confluence-plan` runs `node {project-root}/_bmad/ma-atlassian/scripts/confluence_page_tree.cjs --project-root {project-root}` and explains its output; it writes no file and makes no Confluence call; an empty `tickets_space` shows the planning space, an empty root-page answer the project's name; it offers the read-only check against Confluence. PASS: case `preview` (no request, project tree digest unchanged); validator `--render` 0 findings.
3. **Collision check (Epic 31 predicate).** (Re-run at GA: yes.) `scripts/confluence_collision_check.cjs` refuses: two files on one page (`same-page`); two pages of one destination with one title, the root page included (`in-destination`); two different pages with one title across destinations that share a space (`cross-destination`; two root pages with one title, and a folder page under the same parent as the other destination's page, are one page); a planned page that already exists in the space outside the destination's root page (`foreign`). The local checks run with no server; publish runs all of them before its first write. PASS: cases `collision-local` (no request), `collision-remote` (no POST/PUT; the script's own command line exits 1, `--local` 0, a clean space 0).
4. **Publish engine over REST (FR290).** (Re-run at GA: yes.) `scripts/confluence_publish.cjs publish` reads the space and every page's identity (id, version, ancestors; never a body), then writes parents first: a missing page is created, a document page whose body or parent changed is updated with the next version, a document page whose recorded body hash and parent match is `unchanged`, an existing root or folder page is left; each page is reported with its link; the body is the document's Markdown converted to well-formed storage XHTML. PASS: cases `publish` (every page with its parent and body in the mock, which refuses ill-formed XHTML), `idempotent` (second run: no write), `update` (one changed file: one PUT, version 2), `shared` (one space and one root page: the initiative and epic pages created once).
5. **No success over a failure.** (Re-run at GA: yes.) A refusal writes nothing (`published: no (refused before any Confluence call)` / `(refused before any write)`); a failed call stops the run and reports `published: no (<n> page(s) written before the failure: …)`; `published: yes` only after every page has an id. PASS: cases `failure`, `collision-local`, `collision-remote`.
6. **Token handling (FR300 "no answer holds a credential").** (Re-run at GA: yes.) REST reads a Data Center personal access token only from the environment variable `CONFLUENCE_PERSONAL_TOKEN`, sends it only as `Authorization: Bearer`, only over https (plain http only to a loopback host), refuses redirects, and never prints it; a missing token is a prerequisite (exit 2) naming the variable. PASS: case `auth` (missing: exit 2, no request; wrong: `answered 401`, the token absent from the output; an `http://` remote site: exit 2, nothing sent).
7. **Scope of a publish.** (Re-run at GA: yes.) `--path` publishes only the named documents and their parent pages; a destination with no document publishes nothing (not even its root page); a path outside the output folder (including through `..`) is left out. PASS: case `path`.
8. **MCP form (FR300 `confluence_mcp_server`).** (Re-run at GA: yes.) With the user's answer `confluence_mcp_server` set, publish makes no Confluence call, needs no token, and prints the `mcp-atlassian` 0.24.4 calls in order: `confluence_get_page` by title and space, `confluence_search` with the `ancestor` CQL (the foreign check), `confluence_create_page` / `confluence_update_page` with `content_file` and `parent_id`. PASS: case `mcp`; the hand-run of the six calls against the mock (verification record).
9. **Root-page member (F29 `:134`, FR300).** (Re-run at GA: yes.) `ma-atlassian-confluence-record-root-page` runs `confluence_publish.cjs resolve --destination <d> --page <title|id|URL>`, which prints the page found in the destination's space and the answer line `modules.ma-atlassian.<d>_root_page = "<title>"`; a page not found, or in another space, is refused; the workflow has `bmad` change the answer and then asks for `ma-atlassian-bind bind`. PASS: case `resolve` (title, id, URL; not found exit 1; another space refused); validator `--render`.
10. **Publish wording of the bind table (38.3 D11).** (Re-run at GA: yes.) The `publish_planning`, `publish_board` and `publish_store` texts of `bind-targets.toml` run the engine (`node {project-root}/_bmad/ma-atlassian/scripts/confluence_publish.cjs publish --project-root {project-root} --destination planning|tickets [--path …]`) and say what to do with its output; the read texts are unchanged. PASS: `test_bind.py --mutants` green on the new texts (16 slots bound, validator on the output).
11. **Declared, installed, offline (FR282, FR304).** (Re-run at GA: yes.) The three scripts are in `ma-atlassian-bind`'s `[skill] scripts` with `bind.py`; `setup.py` installs them to `_bmad/ma-atlassian/scripts/` (the tests run the installed copies); they use Node built-ins only; `--help` exits 0; `tools/offline_activation.py` starts a `.js`/`.cjs`/`.mjs` entry with `node`. PASS: case `help`; the `offline` job of CI.
12. **Mutation-checked.** (Re-run at GA: no.) `test_confluence_engine.py --mutants`: 19 source mutants of the three scripts, each red on its named case. PASS: `19 of 19 mutants red`.
13. **CI, README, every gate (NFR84).** (Re-run at GA: yes.) `ci.yml` `gates` runs `uv run --no-cache tools/test_confluence_engine.py --tree "$BMAD_TREE" --mutants` after the bind test; the README lists the command; every gate green locally and on the branch's Actions run.

## Tasks / Subtasks

- [x] T1 Read the epic brief, F29 (module, Config questions, Destinations, FR290, FR300), P5-11.9, the structure shard, 38.3's story (D1, D11), the 3.x engine and its test, upstream's ticket tree and the planning skills' run folders, `resolve_config.py`, `setup.md` "Answers", `mcp-atlassian` 0.24.4's Confluence tools
- [x] T2 `scripts/confluence_page_tree.cjs` (classification, tree, answers through `resolve_config.py`, preview command line) (AC1, AC2)
- [x] T3 `scripts/confluence_collision_check.cjs` (local and foreign predicates, command line) (AC3)
- [x] T4 `scripts/confluence_publish.cjs` (REST client, identity reads, writes, Markdown to storage, MCP steps, `resolve`) (AC4-AC9)
- [x] T5 `tools/confluence_dc_mock.py`, `tools/test_confluence_engine.py` (14 cases, 19 mutants) (AC1-AC12)
- [x] T6 The two members' `workflow.md` and `SKILL.md` descriptions; `bind-targets.toml` publish texts; `bmod.toml` `scripts`; `references/confluence-verbs.md` (AC2, AC8-AC11)
- [x] T7 `offline_activation.py` (node for JS entries), `ci.yml` step, README (AC11, AC13); every gate locally
- [x] T8 MCP hand-run against the mock with `mcp-atlassian==0.24.4` (AC8)
- [x] T9 Tracker rows; this file
- [ ] T10 Commit, push `feat/38-4-confluence-engine` in both repositories, PRs, Actions runs

## Dev Notes

- **Repository files (extension worktree `D:\Code\ma-bmad-extensions-38-4`).** New: `skills/ma-atlassian-bind/scripts/{confluence_publish.cjs, confluence_page_tree.cjs, confluence_collision_check.cjs}`, `skills/ma-atlassian-bind/references/confluence-verbs.md`, `tools/confluence_dc_mock.py`, `tools/test_confluence_engine.py`. Changed: `skills/ma-atlassian-bind/{bmod.toml (scripts), references/bind-targets.toml ([vars] publish_command, publish_engine; [text] three publish texts; header)}`, `skills/ma-atlassian-confluence-plan/{SKILL.md, workflow.md}`, `skills/ma-atlassian-confluence-record-root-page/{SKILL.md, workflow.md}` (placeholder sentence and workflow replaced; `customize.toml` facts kept), `tools/offline_activation.py`, `.github/workflows/ci.yml` (one step), `README.md` (one command, one paragraph). ma-agents worktree: this file, `sprint-status.yaml` (38-3 → `done`, 38-4 row).
- **D1 `.cjs`, three scripts, no dependency.** The scripts are CommonJS with the `.cjs` extension so a project whose `package.json` says `"type": "module"` cannot turn them into ES modules when they run from `_bmad/ma-atlassian/scripts/` (Node resolves the nearest `package.json` upward); the 37.4 Atlas engine (`assets/atlas.cjs`) is the precedent. They require each other by relative path, which works because setup installs every `[skill] scripts` entry into one folder. Node built-ins only (`fs`, `path`, `child_process`, `crypto`, global `fetch`, `AbortSignal.timeout`): the offline runtime ships no npm package, and the Node floor 22.20 has all of them. The epic and F29 say "JavaScript scripts run with `node`" — satisfied; the structure shard names no file. PO item (e).
- **D2 Which destination.** Upstream's ticket tree and the planning skills' run folders give a rule that needs no list of skill prefixes: a Markdown file with a folder outside the ticket tree on its path is inside another skill's run, so planning (this also takes `bmad-facilitate`'s `{id}-{slug}` runs, whose `{id}` is any template id, and a run that sits in an epic's folder); a ticket file whose folders are all ticket-tree folders is tickets. `glossary.md` and other SPEC companions at the initiative root are left out and reported. A file directly under the output folder is left out.
- **D3 Tree rules, and where they differ from 3.x.** 3.x titled a page with its file name and merged `prd.md` with `prd/`. In the v7 store a container's own file sits inside its folder (`epic-cart-rules/epic-cart-rules.md`), so the index rule becomes "a file named after its folder is that folder's page". Every container has a `tickets/` folder, and Confluence titles are unique per space, so `tickets/` is not a page: an epic hangs under its initiative, a story under its epic (mirroring the tree's containment rather than its folder names). Every `bmad-ux` run holds `DESIGN.md` and `EXPERIENCE.md`, so a page inside a planning run is titled `<run> - <name>` unless the name already starts with the run's name; without this a second UX run would always collide. PO item (d).
- **D4 One space for both destinations.** With `tickets_space` empty the destinations share a space. Two root pages with one title are one root (3.x rule). The planning tree has folder pages for the initiative and epic folders that hold planning runs; the tickets tree has the same titles as document pages. Under one shared root they are one page: the cross-destination check allows a folder page under the same parent as the other destination's page, the folder side never writes a body, and within one run a page the first destination created is reused by the second (`runPages`), so the initiative page is created once and gets its body from the tickets side. With different root pages in one space the same titles are two pages: refused, naming both, with "give the destinations different spaces or the same root page".
- **D5 The foreign check is new.** 3.x resolved (space, title) and updated whatever page it found. A lookup by title in a shared space can find another team's page, so publish first reads every page's ancestors and refuses, before any write, when a planned page exists outside the destination's root page. The MCP form gets the same check from `confluence_search` with the `ancestor` CQL, because `confluence_get_page` does not return ancestors.
- **D6 Unchanged without reading content.** A document page carries `ma-atlassian sha256:<hash of its storage body>` as its version message; a re-run compares that and the parent, from the identity read (`expand=version,ancestors`), never the body: no Confluence content reaches the disk or the process beyond identity (3.x's FR266 posture; the PRD's "local Confluence mirror" is out of scope). Whether Data Center keeps `version.message` on `POST` is a live-run item: if not, the second run updates each document page once and the third reports none. PO item (g).
- **D7 Markdown to storage, no dependency.** Front matter as a `yaml` code macro; fenced code as a `code` macro in CDATA with `]]>` split; headings, paragraphs, nested lists (a change between bullets and numbers starts a new list), pipe tables, quotes, `hr`; inline `strong`, `em`, `code`, links, with code spans and links held as atomic tokens so no generated tag can straddle another; everything else escaped. The mock parses every body as XHTML with the `ac:`/`ri:` namespaces, so the converter is tested against the shape Confluence requires; two mutants (no `&` escaping, CDATA end not split) prove the mock refuses. The MCP form sends the Markdown (`content_format: markdown`) and lets `mcp-atlassian` convert it.
- **D8 Credentials.** `CONFLUENCE_PERSONAL_TOKEN` is the variable `mcp-atlassian` reads for a Data Center PAT, so one variable serves both forms; no answer holds it (FR300). The token lives in a closure of the REST client, is sent only in the `Authorization` header, never appears in a message (a mutant that puts it into an error message is red), is sent only over https or to a loopback host (the mock), and redirects are refused so it cannot follow one to another host. Basic authentication is not offered (38.1 documents it as the Jira fallback when PATs are disabled). PO item (b).
- **D9 The MCP form prints calls.** A `node` script cannot call the agent's MCP tools, so with `confluence_mcp_server` set publish prints the ordered calls with `<id of "T">` placeholders and the agent makes them. `content_file` keeps the documents out of the tool arguments; the hand-run found that `mcp-atlassian` confines `content_file` to `MCP_ATLASSIAN_FILES_DIR` or, on stdio, the server's working directory ("Path traversal detected" otherwise) — documented in `confluence-verbs.md`.
- **D10 Root pages.** An empty root-page answer means `core.project_name` (F29 "a page named for the project"); publish creates a missing root page at the top of the space and, when the answer is empty, prints a note to record it. `setup.py --module-answers` writes only pending answers and never changes an existing one (`setup.md` "Answers"), so the record member does not write configuration: `resolve` checks the page and prints the answer line, and the workflow asks `bmad` to change the answer (the Answers step of `bmad setup`), then asks for `ma-atlassian-bind bind`, since the bound texts name the root page and `status` reports them `outdated` until then. The answer is the page title (what `status` and the texts print), not the id. PO item (c).
- **D11 Answers through the resolver.** The scripts spawn `uv run --no-cache {project-root}/_bmad/scripts/resolve_config.py --key core.output_folder --key core.project_name --key modules.ma-atlassian.<six keys>` and replace `{project-root}` in `output_folder`; they name no configuration file (the sweep's `config-reads` check is green and now lists `core.project_name`).
- **D12 Offline activation of JavaScript entries.** `tools/offline_activation.py` started every `[skill] scripts` entry with `uv run --no-cache`, which cannot run a `.cjs`; it now starts `.js`/`.cjs`/`.mjs` entries with the host's `node` (the offline container is `node:22-bookworm`) and fails on `Cannot find module` or a stack trace. 38.5's `migrate_binding.js` will meet the same path; a merge of the two branches may touch the same function.
- **D13 Publish wording.** `[vars] publish_command` is the engine's command with `{project-root}` (left for the agent, as 38.3 does), `publish_engine` says what the engine does, that it uses the token in `CONFLUENCE_PERSONAL_TOKEN` or prints MCP calls when `confluence_mcp_server` is set, and that a collision line means nothing was published. The planning rows publish "each finished document" with one `--path` per file; Sofia's `board_after` publishes the changed ticket and plan files, `store_after` the whole tickets destination. The read rows keep 38.3's `confluence_access` text.
- **D14 What a publish never does.** It deletes no page, moves no folder or root page that exists (a document page whose parent changed is moved by its update), reads no page body, and writes nothing locally. A page renamed in the store leaves its old page in place (3.x's "no delete" rule).
- **D15 Test design.** The scratch project is 38.3's (`test_bind.py`'s `World`, imported, with this story's answers): the pinned core and method skills and the `ma-atlassian` folders copied, `setup.py --module-answers` run once, which also installs the scripts to `_bmad/ma-atlassian/scripts/`; the cases run those installed copies with `node` and each starts its own mock on a free port. Team answers per case go to `_bmad/custom/config.toml` and the user's `confluence_mcp_server` to `config.user.toml`, so every answer reaches the scripts through `resolve_config.py`. Mutants copy the three scripts with one change and run only their case.
- **D16 Line endings.** The extension worktree is LF. This file and `sprint-status.yaml` are CRLF.
- **Spec items for the PO.** (a) The engine's command line is now the publish contract of the bound skills (`bind-targets.toml` `[text]`, D13); confirm the wording, which closes 38.3 item (e). (b) REST authenticates with a PAT from `CONFLUENCE_PERSONAL_TOKEN` only, https only (loopback http for the mock); confirm, or ask for Basic authentication or plain http on an internal network (D8). (c) A root page is recorded through `bmad setup`'s Answers step, since `setup.py --module-answers` cannot change an answered key; the answer is a title (D10). (d) F29 "Published pages mirror the initiative store layout": the tree collapses `tickets/` folders and prefixes titles inside planning runs (`ux-checkout - DESIGN`) because titles are unique per space (D3); amend F29 to say so, or choose another title rule. (e) F29 `:129-132`, the Epic 38 scope and the structure shard say "JavaScript"; the files are `.cjs` (D1). (f) The version bump (38.1 item (f)) is still open; versions stay `4.0.0-beta.1`. (g) Live-run items for 38.6: the Confluence version, `version.message` on create (D6), an empty body for a folder page, and the MCP form with `MCP_ATLASSIAN_FILES_DIR` (D9).

## Testing

All commands from the extension worktree root, `$BMAD_TREE` the checkout of BMAD-METHOD at `e734d3a`, `$CLI` the folder `tools/pack-skills-cli.mjs` writes:

- `uv run --no-cache tools/test_confluence_engine.py --tree $BMAD_TREE --mutants` (AC1-AC12); `uv run --no-cache tools/test_bind.py --tree $BMAD_TREE --mutants` (AC10)
- the AC13 gates as the README lists them; `install_test.py … --expect-update current,ahead` from the folder.

## Out of scope

- A Python port of the engine and a local Confluence mirror (epic). `migration-1.toml` and `migrate_binding.js` (38.5). The live Confluence run and the release gate (38.6, which names `tools/confluence_dc_mock.py` as its Confluence fixture when no live on-prem Confluence is reachable from CI). Reading Confluence before drafting (`read_planning`, `read_ticket_page`): agent directives, unchanged from 38.3.

## Verification record

Run 2026-11-16. Windows 11 host (Git Bash, Node v24.15.0, uv 0.13.8). Extension: `D:\Code\ma-bmad-extensions-38-4`, branch `feat/38-4-confluence-engine` on `main` `626015c`, commit `dfd8519` (PR mayafit/ma-bmad-extensions#11). ma-agents: `D:\Code\AI_Agents-38-4` on `main` `f828c19`. BMAD-METHOD at `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`. CI runs the same suite on Node 22.20.0 (`gates`) and the offline activation in `node:22-bookworm` with `--network none` (`offline`).

- **AC1** — [RUN] `tree`: the planning tree and the tickets tree equal the expected maps exactly. Planning: root `Planning`; folder pages `initiative-checkout` and `epic-cart-rules`; documents `prd-checkout`, `ux-checkout`, `ux-checkout - DESIGN`, `ux-checkout - EXPERIENCE`, and `architecture-cart-rules` under the epic's folder page. Tickets: the root named for the project; `initiative-checkout` → `epic-cart-rules` → the story, two plans and the spike; `backlog` → the bug. Left out: two `.memlog.md` and `.working/` (hidden path), `glossary.md` (neither a ticket nor a planning document), two `tickets.toml` (not Markdown). **PASS**
- **AC2** — [RUN] `preview`: prints `destination planning: site http://127.0.0.1:<port>, space PLAN, root page "Shop Project"`, `destination tickets: … space PLAN …` (tickets_space empty), `ux-checkout - DESIGN  (initiative-checkout/ux-checkout/DESIGN.md)` and `preview: no collision; nothing was written`. The mock received no request and the project's tree digest is unchanged. Validator `--render` → `OK: 73 member file(s), 0 override file(s), 0 finding(s)`. **PASS**
- **AC3** — [RUN] `collision-local`, mock log empty throughout:
  - different root pages in one space → `"initiative-checkout": … shared space PLAN …` and `published: no (refused before any Confluence call)`;
  - two initiatives with a `prd-checkout` run → a `same-page` title collision naming both files;
  - a tickets root page titled like a story → `the tickets root page and tickets …; … record another root page`, and the preview of that project exits 1 (`publishing would be refused`).

  `collision-remote`: a top-level `story-cart-service-scaffold` seeded in TICK → `collision: "story-cart-service-scaffold": page 98001 … outside the tickets root page` and `published: no (refused before any write)`, with zero POST/PUT. `confluence_collision_check.cjs` exits 1 (`1 collision(s); Confluence checked over REST`); with `--local` it exits 0, and on a clean space it exits 0. **PASS**
- **AC4** — [RUN]
  - `publish`: every page of both trees is in the mock with the expected parent. Document pages have a body and a `ma-atlassian sha256:` version message; folder and root pages have neither. The PRD body holds `<h1>Checkout &amp; payments &lt;v2&gt;</h1>`, the table, the link with `&amp;`, `<ol>`, the python code macro with `]]]]><![CDATA[>` and the quote. A `javascript:` link is published as text only and a control character is dropped. The output has lines like `tickets: created "story-cart-service-scaffold" (id …) http://…/pages/viewpage.action?pageId=…`, and the root-page note appears only for the unanswered tickets root.
  - `idempotent`: the second run makes no POST/PUT and reports `0 created, 0 updated`.
  - `update`: one PUT on the changed story, version 2.
  - `shared`: one space, one root. 14 pages with unique titles; `initiative-checkout` is created once, with its tickets body, under the root; a re-run writes nothing.

  **PASS**
- **AC5** — [RUN] `failure` (the mock fails every write after the second): `answered 500` and `published: no (2 page(s) written before the failure: …)`; no `published: yes`. **PASS**
- **AC6** — [RUN] `auth`:
  - no token → exit 2, `CONFLUENCE_PERSONAL_TOKEN is not set …`, no request;
  - a wrong token → `answered 401` and `published: no (0 page(s) written …)`; the token string is absent from stdout and stderr;
  - `confluence_site = http://wiki.example.test` → exit 2, `is not https`, nothing sent.

  The real token is absent from every output (also asserted in `publish`). **PASS**
- **AC7** — [RUN] `path`:
  - `--path` the PRD → exactly the project root, `initiative-checkout` and `prd-checkout` (no tickets root);
  - a relative `--path` from the project root → `ux-checkout - DESIGN` under `ux-checkout`;
  - `_bmad/custom/config.toml`, given directly or through `_bmad-output/../` → `outside the output folder`, `nothing to publish`, exit 1, no request.

  **PASS**
- **AC8** — [RUN] `mcp`, with `confluence_mcp_server = "corp-confluence"` in `config.user.toml` and no token: exit 0, no request, `via: mcp`, all four tools. The story's create call has `content_file` (an existing absolute path), `content_format: markdown` and `parent_id: <id of "epic-cart-rules">`; the search carries `ancestor = <id of "Shop Project">`.

  Hand-run: `mcp-atlassian==0.24.4` from PyPI in a throwaway venv, run as `mcp-atlassian --transport stdio` with `CONFLUENCE_URL` = the mock, `CONFLUENCE_PERSONAL_TOKEN=mock-pat` and `MCP_ATLASSIAN_FILES_DIR` = the temp folder. It listed 35 `confluence_*` tools, and all of these calls succeeded:
  - `confluence_get_page` by title (not found, then found);
  - `confluence_create_page` with storage `<p></p>` (the root page);
  - `confluence_create_page` with a `content_file` in Markdown and `parent_id` (the mock accepted the body `<h1>Story</h1><p>Totals &amp; tax &lt; 1.</p>`);
  - `confluence_search` with the ancestor CQL (one result);
  - `confluence_update_page` with `content_file`, `parent_id` and `version_comment` (version 2).

  Without `MCP_ATLASSIAN_FILES_DIR`, the two `content_file` calls answered `Path traversal detected` (recorded in `confluence-verbs.md`). **PASS**
- **AC9** — [RUN] `resolve`:
  - by title → `found: page "Shop Project" (id …) in space TICK, at the top of the space` and `answer: modules.ma-atlassian.tickets_root_page = "Shop Project" (now "")`;
  - by id and by page URL → the same page;
  - `No such page` → exit 1, `not found`;
  - a page of space OTHER, by id → exit 1, `is in space OTHER, not in the tickets space TICK`.

  The workflow hands the answer to `bmad setup` and asks for a re-bind. **PASS**
- **AC10** — [READ] `bind-targets.toml` has `[vars] publish_command` and `publish_engine`; `publish_planning` (`--destination planning --path <the document file>`), `publish_board` (`--destination tickets --path <file>` per changed file) and `publish_store` (`--destination tickets`). [RUN] `test_bind.py --mutants` → `14 passed, 0 failed; 14 of 14 mutants red`. **PASS**
- **AC11** — [RUN] `help`: each script's `--help` exits 0 with `usage: node …`; with no `_bmad/`, each prints `prerequisite:` and exits 2. The tests run the copies `setup.py` installed in `_bmad/ma-atlassian/scripts/`, and the folder install test's `ma-atlassian` project holds `bind.py` and the three `.cjs`. `offline_activation.py` runs JS entries with `node`; the `offline` job runs only in CI. **PASS** (offline: see the Actions run)
- **AC12** — [RUN] `--mutants` → `14 passed, 0 failed; 19 of 19 mutants red`. Each mutant was red on its case:

  | Case | Mutants |
  |---|---|
  | `tree` | `tickets/` kept as pages; index rule removed; run titles not prefixed; hidden paths published |
  | `preview` | no `tickets_space` fallback |
  | `collision-local` | in-destination check off; cross-destination check off |
  | `collision-remote` | foreign check off; remote check skipped |
  | `idempotent` | unchanged never detected |
  | `auth` | token in an error message; plain http allowed |
  | `path` | path outside the output folder allowed |
  | `mcp` | MCP answer ignored |
  | `publish` | no `&` escaping; CDATA end not split (the mock refused the body) |
  | `shared` | shared page created twice |
  | `failure` | failure reported as published |
  | `resolve` | resolve ignores the space |

  **PASS**
- **AC13** — [READ] `ci.yml` `gates` has one new step after the bind test; the README lists the command and one paragraph. [RUN] Windows, every gate green:

  | Gate | Result |
  |---|---|
  | manifests | `bmod files valid: 73 skills, 4 module records, 4 knowledge documents.` |
  | validator | as AC2 |
  | lint | `OK: 392 guidance file(s)` |
  | `--complete` | `73 of 73 … every package-map skill shipped` |
  | names | `77 skill folder(s)` |
  | unique names | `77 owned name(s) unique against 35 upstream name(s)` |
  | gate mutants | `9 passed, 0 failed, 1 skipped` (case folding) |
  | sweep | `OK: sweep: 77 skill folder(s), 410 text file(s); … config keys named: core.output_folder, core.project_name, modules.ma-atlassian.confluence_mcp_server, …` |
  | sweep mutants | `15 passed` |
  | block | `47 passed` |
  | migration | `13 passed` |
  | Atlas | `17 passed` |
  | Jira verbs, Jira starter | `OK … every mutant red` |
  | bind | as AC10 |
  | engine | as AC12 |
  | pack | `bin/cli.mjs` |
  | folder install | four `PASS`, `update state in ['ahead', 'current']` |

  **PASS** (Actions: see the PR)
- **Unverified**: a live Confluence Data Center run (38.6; `confluence-verbs.md` "Live run"), including whether `version.message` is kept on create and whether a folder page's empty body is accepted.
