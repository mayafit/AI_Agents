# Story 36.4 — `customize.toml` Contract Validator: module files and bind overrides

Status: review
Blocked on: 36-1
Wave: 1 (parallel with 36.3, 36.5)

**FR:** FR303 (contract validator: every owned `customize.toml` and every bind output resolves through the pinned `resolve_customization.py`, and every bound slot is defined at `bmadRef.core`; any key a target's `customize.toml` does not declare fails; also parse, no undefined variables, explicit `persistent_facts`, `{diff_file}`), FR282 (`uv run --no-cache` with the offline runtime), FR290 / FR291 (the slot check the bind generator runs on its output). **Decisions:** P5-11.4 (overlay and bind table), P5-11.6 (offline Python runtime).

## Story

As an **ma-agents maintainer authoring TOML for v7 skills**,
I want every `customize.toml` in our four modules and every override `ma-atlassian-bind` writes checked by upstream's own resolver and against the real shape of each target's `customize.toml` at the pinned commit,
so that an override in the wrong table, a slot the target does not have, or an undefined variable fails our test, not a user's skill activation — and the bind generator inherits a validator rather than writing its own.

## Context

v7 merges `customize.toml` with `_bmad/custom/<skill>.toml` and `.user.toml`. Workflow skills expose `[workflow] activation_steps_prepend/append`, `persistent_facts` (shipped empty), `on_complete` and, on some skills, `external_sources` / `external_handoffs` (`skills/bmad-build/customize.toml` at `e734d3a`: `[workflow]` `:13`, `persistent_facts = []` `:27`, `on_complete` `:49`); review lenses use `{diff_file}` (`:102-103`). Sofia (`bmad-agent-po`) takes `activation_steps_*` and `persistent_facts` under **`[agent]`** (`skills/bmad-agent-po/customize.toml:7`, `:15-21`) and has named `[workflow]` slots `spec_/tickets_/refine_/board_/validate_/replan_/store_{before,after}` (`:72-103`). `migrate_v6.py` treats keys on retired skills as cleanup (`RETIRED_CUSTOM_KEYS` / `MOVED_CUSTOM_KEYS`, `skills/bmad/scripts/migrate_v6.py:89`, `:106`).

Bind target table baseline at `e734d3a` (FR290, P5-11.4), every slot present; the classifier re-reads it per `bmadRef.core` (upstream `main` reworks `bmad-facilitate`'s customization in `a867e16`):

| Target | Slot | Line |
|---|---|---|
| `bmad-prd` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-prd/customize.toml:108`, `:127` |
| `bmad-architecture` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-architecture/customize.toml:75`, `:81` |
| `bmad-facilitate` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-facilitate/customize.toml:24`, `:36` |
| `bmad-ux` / `bmad-product-brief` / `bmad-prfaq` | `[workflow] on_complete` | `skills/bmad-ux/customize.toml:20`; `skills/bmad-product-brief/customize.toml:38`; `skills/bmad-prfaq/customize.toml:39` |
| `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-retrospective` | `[workflow] activation_steps_prepend` | `skills/bmad-build/customize.toml:17`; `skills/bmad-build-auto/customize.toml:17`; `skills/bmad-code-review/customize.toml:15`; `skills/bmad-retrospective/customize.toml:15` |
| `bmad-agent-po` | `[agent] persistent_facts`; `[workflow] board_after`, `store_after` | `skills/bmad-agent-po/customize.toml:21`; `:91`, `:103` |

The four modules' `customize.toml` files are written in Epics 37–38 inside `ma-bmad-extensions`; overrides are written by `ma-atlassian-bind` (38.3) key by key: bind parses `_bmad/custom/<skill>.toml`, inserts each owned key into its existing `[workflow]` / `[agent]` table (creating the table header only when absent), and brackets each owned key line with `# ma-atlassian:start <table>.<key>` / `# ma-atlassian:end`. A key the user already set is a collision: the file is left unchanged and the collision is reported. In `_bmad/custom/ticketing-store-config.toml` bind writes only keys the file does not yet define. This story delivers the validator and proves it on fixtures shaped like those members; 37.1 runs it in the extension repository's CI, and 38.3 runs it on the generator's output. Until 36.3 lands, the pinned tree is a scratch checkout at `e734d3a`; the validator takes its path from `--tree` or `BMAD_V7_TREE` and defaults to `bundle/bmad-method/`.

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 AC6 runs it against the GA snapshot.

1. **Real v7 resolver, via `uv run --no-cache`.** (Re-run at GA: yes.) `scripts/validate_customize.py` (PEP 723 header, `requires-python = ">=3.11"`, standard library only) and its Node wrapper `test/customize-contract-v7.test.js` locate `skills/bmad/scripts/resolve_customization.py` in the pinned tree and run it as `uv run --no-cache <script> --skill <dir> --key <key>` with an argv array. No uv or no tree → the test **fails** with a prerequisite message; it never skips. Its CI half is owned by 36.6 (Linux job with uv).
2. **Table shape per member kind (`--skills-root` mode).** (Re-run at GA: yes.) The validator walks every `customize.toml` under `--skills-root <dir>`. The fixture root `test/fixtures/customize-v7/skills/` holds one member per kind the four modules ship: an agent (`ma-agent-sre` shape), an orchestration workflow (`ma-ops-dev-epic` shape), the Atlas skill (`ma-knowledge-atlas` shape) and the bind skill (`ma-atlassian-bind` shape); the count is asserted. Each file is classified as agent or workflow by the presence of `[agent]` and checked: agents carry `persistent_facts` under `[agent]`, and `activation_steps_*` there where present; workflows carry them under `[workflow]`; no such key appears under the other table. The resolver exits 0 for the top-level key and its JSON contains every top-level key in the file (parsed independently with `tomllib`).
3. **Explicit `persistent_facts`.** (Re-run at GA: yes.) Each checked file defines `persistent_facts` explicitly and non-empty in the correct table, and the resolver output carries the same entries (upstream defaults are empty, so absence is a silent loss).
4. **Slot classifier.** (Re-run at GA: yes.) The validator exposes `classify(skill, table, key)` → `defined` / `undefined` / `retired`, reading the target's upstream `customize.toml` from the pinned tree **at run time** and every `skills/bmod-*/retired.toml`. Fixtures: `[agent] persistent_facts` on `bmad-agent-po` → defined; `[workflow] board_after` on `bmad-agent-po` → defined; `[workflow] activation_steps_prepend` on `bmad-agent-po` → undefined; `[workflow] board_afterr` → undefined; any key on `bmad-sprint-planning` → retired. No slot name is typed as a literal list in the validator.
5. **Bind target table holds at the pin.** (Re-run at GA: yes.) Every row of the table in Context classifies `defined`. For each row, a fixture `_bmad/custom/<skill>.toml` holding that key in its table, bracketed by `# ma-atlassian:start <table>.<key>` / `# ma-atlassian:end`, parses, and the resolver, run against the real upstream skill dir with the fixture in place, returns a value that contains ours. A row that turns `undefined` or `retired` fails the test naming target, table and key.
6. **Override output mode (`--custom-dir`).** (Re-run at GA: yes.) Run over a project's `_bmad/custom/`, the validator checks every file: it parses; each marker pair brackets exactly one owned key; pairs are balanced and not nested; a key appears in at most one pair; the bracketed key sits in the table its start marker names and classifies `defined` for that file's skill. Fixtures: a valid file with several owned keys passes; a user file that already has `[workflow]` with a user key, and an owned key inserted into that same table, passes and the resolver returns both keys; an unbalanced marker, a nested pair, a pair bracketing two keys, a key inside two pairs, and a pair setting `[workflow] board_afterr` each fail with the file and line. 38.3 runs this mode on the generator's output; 38.6 gates on it.
7. **No undefined variables.** (Re-run at GA: yes.) Every `{name}` and `{{…}}` placeholder in checked TOML values and in member skill markdown that v7 renders is either in the set the pinned `render_skill.py` / `resolve_config.py` define (extracted at test time from the tree, not typed) or defined by the owning skill. Shell scripts under `skills/**/scripts/` are excluded by path (Docker `--format` strings; BMAD never renders them). If 36.1 shows `render_skill.py` hard-exits on an undefined variable, the test renders each fixture skill and asserts exit 0.
8. **`{diff_file}` only.** (Re-run at GA: yes.) No checked TOML, skill markdown or override contains `{diff_output}`; a planted fixture makes the test fail (positive control).
9. **Undeclared keys fail; parse failure recorded.** (Re-run at GA: yes.) The validator fails on any key, in a module `customize.toml` override or a bind output file, that the target's `customize.toml` does not declare, naming file, table and key. At `e734d3a` `resolve_customization.py` returns such a key while `render_skill.py` halts the target skill on it (`skills/bmad/scripts/render_skill.py:121-128`: "sets keys <skill> does not declare"); the test asserts both behaviours on a fixture `_bmad/custom/bmad-build.toml` holding `[workflow] ma_unknown_key` (resolver exit 0 with the key returned; `render_skill.py` exit 1 with the HALT line), so a GA change turns it red. A malformed `_bmad/custom/bmad-prd.toml` is fed to the v7 resolver and `render_skill.py`; exit codes and output are recorded in the Verification record and asserted by the test. Both behaviours are handed to 38.3 (bind never writes an undeclared key; what bind reports when a user file does not parse).
10. **Mutation-checked.** (Re-run at GA: no.) (m1) duplicate key in a fixture `customize.toml` → AC2 red naming the file; (m2) `persistent_facts` moved from `[agent]` to `[workflow]` in the agent fixture → AC2/AC3 red; (m3) `{diff_output}` planted → AC8 red; (m4) the tree path pointed at a nonexistent dir → fails loudly; (m5) a fixture override `[workflow] activation_steps_prepend` for `bmad-agent-po` → AC4 reports `undefined` and AC6 fails; (m6) the undeclared-key check removed from the validator → AC9 red on `ma_unknown_key`.

## Tasks / Subtasks

- [x] T1 Tree locator + `uv run --no-cache` invoker with prerequisite failure (AC1)
- [x] T2 Member fixtures; shape, resolution, `persistent_facts` (AC2, AC3)
- [x] T3 Slot classifier + fixtures (AC4)
- [x] T4 Bind-table rows at the pin (AC5); `--custom-dir` mode (AC6)
- [x] T5 Placeholder inventory from the pinned tree; `{diff_file}` guard (AC7, AC8)
- [x] T6 Undeclared-key failure; parse-failure recording (AC9)
- [x] T7 Mutants m1–m6 (AC10); add the test to the chain

## Dev Notes

- Use 36.1 AC10's key matrix as the expected-values source for the bind targets; the classifier itself reads the tree, the matrix only checks the classifier.
- `persistent_facts` entries in the agent fixtures use `file:{project-root}/**/project-context.md`; confirm v7 expands `{project-root}` there (36.1 records render behaviour).
- The validator is one file with no third-party imports so 37.1 can place it in the extension repository's `tools/` unchanged and 38.3's `node` generator can spawn it through `uv run --no-cache`.
- Windows: the Node wrapper calls `spawnSync('uv', ['run', '--no-cache', script, …])`, never a shell string; quote nothing yourself.

## Testing

`test/customize-contract-v7.test.js` (new, in the chain), with the classifier's unit cases and the fixture trees under `test/fixtures/customize-v7/`. Run directly on Windows; the Linux CI run is 36.6 AC3.

## Out of scope

- The override generator, `bind` / `unbind` / `status` (38.3); the Confluence engine (38.4).
- The modules' real `customize.toml` files (37.2–37.4 write them; 37.1 runs this validator over them).

## Verification record

Run 2026-11-15, Windows 11, Git Bash, Node v24.15.0, uv 0.13.8 (Python 3.12.10 picked by `requires-python >=3.11`). Every row below is [RUN] unless marked [READ].

**Tree commit:** `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` — scratch clone (`git init; git fetch --depth 1 origin e734d3a…; git checkout FETCH_HEAD`, `git rev-parse HEAD` = pin), passed as `BMAD_V7_TREE`; removed after the run. No upstream file is committed; fixtures are authored, not copied.

**Deliverables:** `scripts/validate_customize.py` (PEP 723, `requires-python = ">=3.11"`, stdlib only — `--self-check` → `third_party_imports: []`); `test/customize-contract-v7.test.js` (appended to `npm test` after `wheelhouse-coverage.test.js`); fixtures `test/fixtures/customize-v7/` (`skills/` 4 members; `projects/` 13 override projects; `negative/` 2 skills roots). Modes: `--skills-root`, `--custom-dir`, `--classify SKILL TABLE KEY`, `--render`, `--print-placeholders`, `--json`; exit 0 / 1 findings / 2 prerequisite.

**Test run:** `BMAD_V7_TREE=<clone> node test/customize-contract-v7.test.js` → `61 passed, 0 failed` (79 s). `node test/uv-transition-resilience.test.js` → `7 passed, 0 failed` (no `uv run` in any `lib/`, `scripts/`, `bin/` JavaScript; the test file spawns `uv` with `['run', '--no-cache', …]`).

| AC | Result | Evidence |
|---|---|---|
| 1 | PASS | Validator spawns `[find_uv(), "run", "--no-cache", str(script), *args]` via `subprocess.run(argv)`; test spawns `spawnSync('uv', ['run','--no-cache', …])`. No uv / no tree → test fails at "Prerequisites" (never skips). Validator with `PATH=<node dir>` → exit 2 `prerequisite: uv not found on PATH`; `--tree <missing>` → exit 2 `prerequisite: BMAD v7 tree not found at …`. |
| 2 | PASS | `--skills-root test/fixtures/customize-v7/skills` → exit 0, 4 members: `ma-agent-sre` agent, `ma-atlassian-bind` / `ma-knowledge-atlas` / `ma-ops-dev-epic` workflow; 4 resolver calls; each top-level key returned equal to `tomllib` (`ma-agent-sre` → `agent`, `workflow`). |
| 3 | PASS | Each member's `persistent_facts` explicit and non-empty; resolver returns the same list. Control: `persistent_facts = []` → `facts-empty`. |
| 4 | PASS | `classify`: `bmad-agent-po agent.persistent_facts` defined; `workflow.board_after` defined; `workflow.activation_steps_prepend` undefined; `workflow.board_afterr` undefined; `bmad-sprint-planning` any key retired (from `skills/bmod-method/retired.toml` `removed`). The test asserts no slot name appears in the validator source. |
| 5 | PASS | All 16 rows classify `defined`; `projects/bind-rows/` (11 files, each key bracketed) → exit 0; owned rows == table; resolver (real upstream skill dir, fixture project) returns ours for every row. |
| 6 | PASS | `valid-multi` (3 owned keys in `bmad-agent-po.toml` beside user keys + 4 owned keys in `ticketing-store-config.toml`) exit 0; `user-workflow` (user `on_complete` + owned `activation_steps_prepend` in one `[workflow]`, one header) exit 0, resolver returns both. Negatives: `neg-unbalanced` `marker-unbalanced` `bmad-build.toml:3`; `neg-nested` `marker-nested` `bmad-agent-po.toml:5`; `neg-two-keys` `marker-pair-keys` `:3`; `neg-key-two-pairs` `marker-duplicate-key` `:6`; `neg-board-afterr` `slot-undefined` `:4`; also `neg-retired` `slot-retired` `bmad-sprint-planning.toml:4`. |
| 7 | PASS | Placeholder set extracted with `ast` at run time: Jinja names = keys of `_RenderContext.variables` in `render_skill.py` (`agent, config, halt, initiative_folder, rendered, workflow`); single-brace = string constants in `render_skill.py` / `resolve_config.py` (`project-root, skill-root`). Owner-defined runtime names: a member's own "`` `{x}` is ``" / "bind/set `` `{x}` `` to" line; an override may use any placeholder the target's own files use. `render_skill.py` hard-exits on an undefined variable: `negative/undefined-placeholder` → `HALT: workflow.md:9: 'ticket_url' is undefined` (exit 1), plus `placeholder-undefined` at `workflow.md:9` and `customize.toml:6`. So the test renders every member with `--render`: 4 × exit 0. Shell scripts under `scripts/` excluded by path (`ma-ops-dev-epic/scripts/container-status.sh` carries `{{.Names}}`, member passes). `{project-root}` in `persistent_facts` is **not** expanded by v7 render: output line `- file:{project-root}/**/project-context.md` under the workflow's "read `file:` globs under `{project-root}`" — the agent binds it. |
| 8 | PASS | Planted `negative/diff-output` → `diff-output` at `customize.toml:10`; `projects/neg-diff-output` → `bmad-code-review.toml:4`. |
| 9 | PASS | See the two records below. |
| 10 | PASS | Mutants below. |

**Undeclared key (`projects/neg-undeclared/_bmad/custom/bmad-build.toml`, `[workflow] ma_unknown_key = "MA-UNKNOWN-KEY-SENTINEL"`):** validator exit 1, only finding `undeclared-key` `bmad-build.toml:3` table `workflow` key `ma_unknown_key`. `uv run --no-cache <tree>/skills/bmad/scripts/resolve_customization.py --skill <tree>/skills/bmad-build --project-root <copy> --key workflow.ma_unknown_key` → exit 0, `{"workflow.ma_unknown_key": "MA-UNKNOWN-KEY-SENTINEL"}`. `uv run --no-cache …/render_skill.py --project-root <copy> --skill <tree>/skills/bmad-build` → exit 1, `HALT: <copy>\_bmad\custom\bmad-build.toml sets keys bmad-build does not declare: workflow.ma_unknown_key` (`render_skill.py:121-128`, `_check_persistent_layers`).

**Parse failure (`projects/neg-malformed-prd/_bmad/custom/bmad-prd.toml`, unterminated string at line 3):** validator exit 1, `parse` `bmad-prd.toml:3`. Resolver → exit 1, stdout empty, stderr `error: failed to parse <copy>\_bmad\custom\bmad-prd.toml: Illegal character '\n' (at line 3, column 41)` (`config_utils.py` `load_toml` → `ConfigError`). `render_skill.py --skill <tree>/skills/bmad-prd` → exit 1, `HALT: render entry is missing: <tree>\skills\bmad-prd\workflow.md` — it never reaches the override. Finding for 38.3: at the pin `bmad-prd`, `bmad-architecture`, `bmad-facilitate`, `bmad-ux`, `bmad-product-brief`, `bmad-prfaq` have no `workflow.md` (they are SKILL.md + resolver skills, so `render_skill.py`'s HALT does not guard them), and an undeclared key on them is returned by the resolver without any halt. `bmad-prd/SKILL.md:22`, `bmad-ux/SKILL.md:35` and `bmad-product-brief/SKILL.md:20` [READ] say on any resolver failure "read `{skill-root}/customize.toml` directly and use defaults", so on those three a malformed override is dropped silently (the other three were not read for this). Bind must never write an unparsable file or an undeclared key; when the user's file does not parse, bind must report and leave it unchanged. `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-retrospective`, `bmad-agent-po` render (`workflow.md` present) and halt.

**Bind-table rows ([READ] `<tree>/skills/<target>/customize.toml`, first definition; matches 36.1 AC10):** `bmad-prd` `[workflow] external_sources :108`, `external_handoffs :127`; `bmad-architecture :75`, `:81`; `bmad-facilitate :24`, `:36`; `bmad-ux on_complete :20`; `bmad-product-brief :38`; `bmad-prfaq :39`; `bmad-build activation_steps_prepend :17`; `bmad-build-auto :17`; `bmad-code-review :15`; `bmad-retrospective :15`; `bmad-agent-po` `[agent] persistent_facts :21`, `[workflow] board_after :91`, `store_after :103`. All 16 [RUN] `defined`.

**Mutants (each applied to the real file, full test run, file restored):**
- m1 duplicate `on_epic_complete` in `skills/ma-ops-dev-epic/customize.toml` → exit 1, 3 failed: `customize.toml:22 [parse] … Cannot overwrite a value (at line 22, column 27)`.
- m2 `persistent_facts` moved to `[workflow]` in `skills/ma-agent-sre/customize.toml` → exit 1, 4 failed: `customize.toml:34 [wrong-table] persistent_facts is under [workflow]` (+ `facts-missing`).
- m3 `{diff_output}` appended to `skills/ma-knowledge-atlas/workflow.md` → exit 1, 2 failed: `workflow.md:15 [diff-output]`.
- m4 `BMAD_V7_TREE=<scratchpad>/no-such-tree` → exit 1, `✗ the pinned BMAD v7 tree is present: prerequisite: no BMAD v7 tree at …no-such-tree`.
- m5 bracketed `[workflow] activation_steps_prepend` appended to `projects/bind-rows/…/bmad-agent-po.toml` → exit 1, 2 failed: `bmad-agent-po.toml:18 [slot-undefined] [workflow] activation_steps_prepend is undefined for bmad-agent-po`; the permanent fixture `projects/neg-po-prepend` holds the same case.
- m6 undeclared-key check disabled in the validator (`if False and not declares(…)`) → exit 1, 2 failed: the AC9 `ma_unknown_key` assertions.
The test also keeps m1, m2, m3, m4, m5 as in-run controls on temp copies or permanent fixtures.

**Unverified:** the Linux CI half (36.6 AC3). The `--render` path downloads `jinja2` through uv when online; offline it needs the 36.2 wheelhouse (`UV_FIND_LINKS`, `UV_OFFLINE=1`) — not run offline here. `npm test` will fail at this test until `bundle/bmad-method/` exists (36.3) or `BMAD_V7_TREE` is set: by AC1 the prerequisite fails, it does not skip.
