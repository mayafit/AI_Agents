# Story 36.4 — Owned TOML Validation Against the v7 Customization Contract

Status: backlog
Blocked on: 36-1
Wave: 1 (parallel with 36.3, 36.5)

**FR:** FR278 (parse, no undefined variables, explicit `persistent_facts`, `{diff_file}`), FR277 (`uv run`), FR290 / FR291 (input: the slot validator the 38.3 generator reuses). **NFR:** NFR56 (fail loud). **Decision inputs:** P5-11.4 (overlay = per-target override table, bind/unbind idempotent), P5-11.6; Story 32.7 (cancelled; its AC structure reused).

## Story

As an **ma-agents maintainer authoring TOML for v7 skills**,
I want every TOML file we own or generate checked by upstream's own v7 resolver and against the real shape of each target's `customize.toml`,
so that an override in the wrong table, a slot name Sofia does not have, or an undefined variable fails our test instead of a user's skill activation — and Epic 38's generator inherits a validator rather than writing its own.

## Context

v7 keeps the `_bmad/custom/<skill>.toml` / `.user.toml` three-layer merge but splits the shape: workflow skills expose `[workflow] activation_steps_prepend/append`, `persistent_facts` (shipped empty), `on_complete` and, on some skills, `external_sources` / `external_handoffs` (`skills/bmad-build/customize.toml` @`e734d3a`: `[workflow]` `:13`, `persistent_facts = []` `:27`, `on_complete` `:49`); review lenses use `{diff_file}` (`:102-103`). Sofia (`bmad-agent-po`) takes `activation_steps_*` and `persistent_facts` under **`[agent]`** (`skills/bmad-agent-po/customize.toml:7`, `:15-21`) and has named `[workflow]` slots `spec_/tickets_/refine_/board_/validate_/replan_/store_{before,after}` (`:72-103`) instead of `on_complete`. `migrate_v6.py` treats keys on retired skills as cleanup (`RETIRED_CUSTOM_KEYS` / `MOVED_CUSTOM_KEYS`, `skills/bmad/scripts/migrate_v6.py:89`, `:106`).

ma-agents owns five `customize.toml` files — `lib/bmad-extension/skills/{bmad-dev-epic,ma-agent-cyber,ma-agent-devops,ma-agent-sqa,ma-agent-sre}/customize.toml` (verified by `ls`) — and generates `_bmad/custom/<skill>.toml` publish hooks for five authoring skills (`lib/confluence-publish-hook.js:139-145`, `AUTHORING_SKILL_STORES`; key `PUBLISH_HOOK_KEY = 'workflow.on_complete'` at `:173`; block built at `:985`, entry `generatePublishHooks` at `:1526`). One of those five, `bmad-create-epics-and-stories`, is retired in v7 (`skills/bmod-method/retired.toml`). The generated header says a parse failure "returns an empty table and exits 0" (`lib/confluence-publish-hook.js:1007-1009`; also `bin/cli.js:1466`); that describes the **6.10** resolver the 3.x line runs and stays true there. The existing publish-hook suite runs the resolver through `python3` / `python` / `py -3` (`test/project-layout-confluence-publish-hook.test.js:145`).

Until 36.3 lands, the pinned tree is a scratch checkout at `e734d3a`; the test takes its path from an env var and switches to 36.3's snapshot path when it exists.

## Acceptance Criteria

Tags: **[v7-carries]** = re-run at GA by 36.7 (shapes may move); **[pre-release-only]** = 3.x-era files validated only for the preview.

1. **Real v7 resolver, via `uv run --no-cache`.** [v7-carries] New `test/owned-toml-v7-contract.test.js` locates `skills/bmad/scripts/resolve_customization.py` in the pinned tree (36.3 snapshot, or `BMAD_V7_TREE`) and runs it as `uv run --no-cache <script> --skill <dir> --key <key>` via `spawnSync` with an argv array. No uv, no tree → the test **fails** with a prerequisite message; it never skips. Its CI half is owned by 36.6 (Linux job with uv).
2. **Table shape per target kind.** [v7-carries] For each owned `customize.toml` (discovered by walking `lib/bmad-extension/skills/*/` and `skills/*/`, count asserted ≥ 5 and including `bmad-dev-epic`), the test classifies it as agent or workflow by the presence of `[agent]` and asserts: agents carry `activation_steps_*` and `persistent_facts` under `[agent]`; workflows carry them under `[workflow]`. The resolver exits 0 for the top-level key and its JSON contains every top-level key in the file (parsed independently with `uv run --no-cache python -c "import tomllib…"`).
3. **Explicit `persistent_facts`.** [v7-carries] Each owned file defines `persistent_facts` explicitly and non-empty in the correct table, and the resolver output carries the same entries (upstream defaults are empty, so absence is a silent loss).
4. **Slot validator for overrides (input to 38.3).** [v7-carries] A reusable module (`lib/v7-override-slots.js` or equivalent; name recorded) reads a target's upstream `customize.toml` from the pinned tree **at run time** and answers, for (skill, table, key): `defined` / `undefined` / `retired` (from every `skills/bmod-*/retired.toml`). Fixtures: `[agent] persistent_facts` on `bmad-agent-po` → defined; `[workflow] board_after` on `bmad-agent-po` → defined; `[workflow] activation_steps_prepend` on `bmad-agent-po` → undefined; `[workflow] board_afterr` → undefined; any key on `bmad-sprint-planning` → retired. No slot name is typed as a literal list in the module.
5. **Generated publish hooks classified.** [pre-release-only] `generatePublishHooks` is run into a scratch project for the five 3.x targets; AC4's validator classifies each `workflow.on_complete`: expected four `defined` and `bmad-create-epics-and-stories` `retired`. The test asserts the classification, and for the four defined targets the resolver, run against the real upstream skill dir with the generated file in place, exits 0 and its `workflow.on_complete` contains our instruction. The retired target is recorded for 38.4, not fixed here.
6. **No undefined variables.** [v7-carries] Every `{name}` and `{{…}}` placeholder in owned TOML values and in owned skill markdown that v7 renders is either in the set the pinned `render_skill.py` / `resolve_config.py` define (extracted at test time from the tree, not typed) or defined by the owning skill. Shell scripts under `skills/**/scripts/` are excluded by path (Docker `--format` strings; BMAD never renders them). If 36.1 shows `render_skill.py` hard-exits on an undefined variable, the test renders each owned skill and asserts exit 0.
7. **`{diff_file}` only.** [v7-carries] No owned TOML, skill markdown or generated override contains `{diff_output}`; a planted fixture makes the test fail (positive control).
8. **v7 parse-failure and unknown-key behaviour recorded, 3.x text untouched.** [v7-carries] A malformed `_bmad/custom/bmad-prd.toml` and an override setting an undefined key are fed to the v7 resolver; exit codes and output are recorded in the Verification record and asserted by the test (so a GA change turns it red). The 3.x strings at `lib/confluence-publish-hook.js:1007-1009` and `bin/cli.js:1466`, `:1581`, `:1618` are **not** edited (they describe the 6.10 resolver the 3.x line ships); the v7 behaviour is handed to 38.3.
9. **Publish-hook suite gains a uv probe.** [pre-release-only] `test/project-layout-confluence-publish-hook.test.js:145`'s interpreter list gains `['uv', ['run', '--no-cache', 'python']]` tried first, keeping the `python3` fallbacks for 3.x; all existing assertions pass unchanged.
10. **Mutation-checked.** (m1) duplicate key in an owned `customize.toml` → AC2 red naming the file; (m2) `persistent_facts` moved from `[agent]` to `[workflow]` in `ma-agent-sre` → AC2/AC3 red; (m3) `{diff_output}` planted → AC7 red; (m4) the validator's tree path pointed at a nonexistent dir → fails loudly; (m5) a fixture override `[workflow] activation_steps_prepend` for `bmad-agent-po` → AC4 reports `undefined`.

## Tasks / Subtasks

- [ ] T1 Tree locator + `uv run --no-cache` invoker with prerequisite failure (AC1)
- [ ] T2 Owned file shape, resolution, `persistent_facts` (AC2, AC3)
- [ ] T3 Slot validator module + fixtures (AC4)
- [ ] T4 Publish-hook classification and resolution (AC5)
- [ ] T5 Placeholder inventory from the pinned tree; `{diff_file}` guard (AC6, AC7)
- [ ] T6 Parse-failure / unknown-key recording (AC8); publish-hook suite uv probe (AC9)
- [ ] T7 Mutants m1–m5 (AC10); add the test to the chain; `npm run build:plugin` only if a skill file changed

## Dev Notes

- Use 36.1 AC10's key matrix as the expected-values source for the FR290 targets; the validator itself reads the tree, the matrix only checks the validator.
- `persistent_facts` entries in our files use `file:{project-root}/**/project-context.md`; confirm v7 still expands `{project-root}` there (36.1 records render behaviour).
- `bmad-dev-epic/customize.toml` is rewritten as `ma-ops-dev-epic` in 37.3; validate what is on disk now and let 37.3 inherit the test.
- Windows: `spawnSync('uv', ['run', '--no-cache', script, …])`, never a shell string; quote nothing yourself.

## Testing

`test/owned-toml-v7-contract.test.js` (new, in the chain), plus the AC4 validator's own unit cases in the same file. Run directly on Windows; the Linux CI run is 36.6 AC4.

## Out of scope

- The override generator, target table and bind/unbind (38.3); retargeting Confluence hooks (38.4).
- Editing 3.x resolver-behaviour strings (AC8).
- TOML of carved modules in `ma-bmad-extensions` (37.x inherit this test).

## Verification record

Tree SHA: … ; resolver parse-failure exit / unknown-key behaviour: … ; publish-hook classification: … ; mutants m1–m5: … ; unverified: …
