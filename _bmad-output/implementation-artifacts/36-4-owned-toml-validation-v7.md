# Story 36.4 — `customize.toml` Contract Validator: module files and bind overrides

Status: backlog
Blocked on: 36-1
Wave: 1 (parallel with 36.3, 36.5)

**FR:** FR278 (parse, no undefined variables, explicit `persistent_facts`, `{diff_file}`), FR277 (`uv run`), FR290 / FR291 (the slot check the bind generator runs on its output). **Decisions:** P5-11.4 (overlay and bind table), P5-11.6 (offline Python runtime).

## Story

As an **ma-agents maintainer authoring TOML for v7 skills**,
I want every `customize.toml` in our four modules and every override `ma-atlassian-bind` writes checked by upstream's own resolver and against the real shape of each target's `customize.toml` at the pinned commit,
so that an override in the wrong table, a slot the target does not have, or an undefined variable fails our test instead of a user's skill activation — and the bind generator inherits a validator rather than writing its own.

## Context

v7 merges `customize.toml` with `_bmad/custom/<skill>.toml` and `.user.toml`. Workflow skills expose `[workflow] activation_steps_prepend/append`, `persistent_facts` (shipped empty), `on_complete` and, on some skills, `external_sources` / `external_handoffs` (`skills/bmad-build/customize.toml` at `e734d3a`: `[workflow]` `:13`, `persistent_facts = []` `:27`, `on_complete` `:49`); review lenses use `{diff_file}` (`:102-103`). Sofia (`bmad-agent-po`) takes `activation_steps_*` and `persistent_facts` under **`[agent]`** (`skills/bmad-agent-po/customize.toml:7`, `:15-21`) and has named `[workflow]` slots `spec_/tickets_/refine_/board_/validate_/replan_/store_{before,after}` (`:72-103`). `migrate_v6.py` treats keys on retired skills as cleanup (`RETIRED_CUSTOM_KEYS` / `MOVED_CUSTOM_KEYS`, `skills/bmad/scripts/migrate_v6.py:89`, `:106`).

Bind target table baseline at `e734d3a` (FR290, P5-11.4), every slot present:

| Target | Slot | Line |
|---|---|---|
| `bmad-prd` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-prd/customize.toml:108`, `:127` |
| `bmad-architecture` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-architecture/customize.toml:75`, `:81` |
| `bmad-facilitate` | `[workflow] external_sources`, `external_handoffs` | `skills/bmad-facilitate/customize.toml:24`, `:36` |
| `bmad-ux` / `bmad-product-brief` / `bmad-prfaq` | `[workflow] on_complete` | `skills/bmad-ux/customize.toml:20`; `skills/bmad-product-brief/customize.toml:38`; `skills/bmad-prfaq/customize.toml:39` |
| `bmad-build` / `bmad-build-auto` / `bmad-code-review` / `bmad-retrospective` | `[workflow] activation_steps_prepend` | `skills/bmad-build/customize.toml:17`; `skills/bmad-build-auto/customize.toml:17`; `skills/bmad-code-review/customize.toml:15`; `skills/bmad-retrospective/customize.toml:15` |
| `bmad-agent-po` | `[agent] persistent_facts`; `[workflow] board_after`, `store_after` | `skills/bmad-agent-po/customize.toml:21`; `:91`, `:103` |

The four modules' `customize.toml` files are written in Epics 37–38 inside `ma-bmad-extensions`; overrides are written by `ma-atlassian-bind` (38.3) as `# ma-atlassian:start` / `# ma-atlassian:end` blocks in `_bmad/custom/<skill>.toml`. This story delivers the validator and proves it on fixtures shaped like those members; 37.1 runs it in the extension repository's CI, and 38.3 runs it on the generator's output. Until 36.3 lands, the pinned tree is a scratch checkout at `e734d3a`; the validator takes its path from `--tree` or `BMAD_V7_TREE` and defaults to `bundle/bmad-method/`.

## Acceptance Criteria

Each AC states **Re-run at GA**: `yes` means 36.7 AC6 runs it against the GA snapshot.

1. **Real v7 resolver, via `uv run --no-cache`.** (Re-run at GA: yes.) `scripts/validate_customize.py` (PEP 723 header, `requires-python = ">=3.11"`, standard library only) and its Node wrapper `test/customize-contract-v7.test.js` locate `skills/bmad/scripts/resolve_customization.py` in the pinned tree and run it as `uv run --no-cache <script> --skill <dir> --key <key>` with an argv array. No uv or no tree → the test **fails** with a prerequisite message; it never skips. Its CI half is owned by 36.6 (Linux job with uv).
2. **Table shape per member kind (`--skills-root` mode).** (Re-run at GA: yes.) The validator walks every `customize.toml` under `--skills-root <dir>`. The fixture root `test/fixtures/customize-v7/skills/` holds one member per kind the four modules ship: an agent (`ma-agent-sre` shape), an orchestration workflow (`ma-ops-dev-epic` shape), the Atlas skill (`ma-knowledge-atlas` shape) and the bind skill (`ma-atlassian-bind` shape); the count is asserted. Each file is classified as agent or workflow by the presence of `[agent]` and checked: agents carry `persistent_facts` under `[agent]`, and `activation_steps_*` there where present; workflows carry them under `[workflow]`; no such key appears under the other table. The resolver exits 0 for the top-level key and its JSON contains every top-level key in the file (parsed independently with `tomllib`).
3. **Explicit `persistent_facts`.** (Re-run at GA: yes.) Each checked file defines `persistent_facts` explicitly and non-empty in the correct table, and the resolver output carries the same entries (upstream defaults are empty, so absence is a silent loss).
4. **Slot classifier.** (Re-run at GA: yes.) The validator exposes `classify(skill, table, key)` → `defined` / `undefined` / `retired`, reading the target's upstream `customize.toml` from the pinned tree **at run time** and every `skills/bmod-*/retired.toml`. Fixtures: `[agent] persistent_facts` on `bmad-agent-po` → defined; `[workflow] board_after` on `bmad-agent-po` → defined; `[workflow] activation_steps_prepend` on `bmad-agent-po` → undefined; `[workflow] board_afterr` → undefined; any key on `bmad-sprint-planning` → retired. No slot name is typed as a literal list in the validator.
5. **Bind target table holds at the pin.** (Re-run at GA: yes.) Every row of the table in Context classifies `defined`. For each row, a fixture `_bmad/custom/<skill>.toml` holding one `# ma-atlassian:start` / `# ma-atlassian:end` block with that key parses, and the resolver, run against the real upstream skill dir with the fixture in place, returns a value that contains ours. A row that turns `undefined` or `retired` fails the test naming target, table and key.
6. **Override output mode (`--custom-dir`).** (Re-run at GA: yes.) Run over a project's `_bmad/custom/`, the validator checks every file: it parses; `ma-atlassian` markers are balanced, not nested, and appear at most once per file; every key inside a block classifies `defined` for that file's skill. Fixtures: a valid file passes; an unbalanced marker, a nested block, and a block setting `[workflow] board_afterr` each fail with the file and line. 38.3 runs this mode on the generator's output; 38.6 gates on it.
7. **No undefined variables.** (Re-run at GA: yes.) Every `{name}` and `{{…}}` placeholder in checked TOML values and in member skill markdown that v7 renders is either in the set the pinned `render_skill.py` / `resolve_config.py` define (extracted at test time from the tree, not typed) or defined by the owning skill. Shell scripts under `skills/**/scripts/` are excluded by path (Docker `--format` strings; BMAD never renders them). If 36.1 shows `render_skill.py` hard-exits on an undefined variable, the test renders each fixture skill and asserts exit 0.
8. **`{diff_file}` only.** (Re-run at GA: yes.) No checked TOML, skill markdown or override contains `{diff_output}`; a planted fixture makes the test fail (positive control).
9. **Parse-failure and unknown-key behaviour recorded.** (Re-run at GA: yes.) A malformed `_bmad/custom/bmad-prd.toml` and an override setting an undefined key are fed to the v7 resolver; exit codes and output are recorded in the Verification record and asserted by the test (so a GA change turns it red). The observed behaviour is handed to 38.3 (what bind reports when a user file does not parse).
10. **Mutation-checked.** (Re-run at GA: no.) (m1) duplicate key in a fixture `customize.toml` → AC2 red naming the file; (m2) `persistent_facts` moved from `[agent]` to `[workflow]` in the agent fixture → AC2/AC3 red; (m3) `{diff_output}` planted → AC8 red; (m4) the tree path pointed at a nonexistent dir → fails loudly; (m5) a fixture override `[workflow] activation_steps_prepend` for `bmad-agent-po` → AC4 reports `undefined` and AC6 fails.

## Tasks / Subtasks

- [ ] T1 Tree locator + `uv run --no-cache` invoker with prerequisite failure (AC1)
- [ ] T2 Member fixtures; shape, resolution, `persistent_facts` (AC2, AC3)
- [ ] T3 Slot classifier + fixtures (AC4)
- [ ] T4 Bind-table rows at the pin (AC5); `--custom-dir` mode (AC6)
- [ ] T5 Placeholder inventory from the pinned tree; `{diff_file}` guard (AC7, AC8)
- [ ] T6 Parse-failure / unknown-key recording (AC9)
- [ ] T7 Mutants m1–m5 (AC10); add the test to the chain

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

Tree commit: … ; resolver parse-failure exit / unknown-key behaviour: … ; bind-table rows: … ; mutants m1–m5: … ; unverified: …
