# Story 32.7 — Owned TOML Validation Against the v6.12 Customization Contract

Status: backlog
Blocked on: 32-2, 32-4, 32-5
Wave: 3 (parallel with 32.8)

**FR:** FR278 (parse, no undefined `{{.var}}`, explicit `persistent_facts`, `{diff_file}`), FR277 (`uv run`). **NFR:** NFR56 (fail loud). **Decision inputs:** P5-10.4 (the `_bmad/custom/<skill>.toml` layer is the sanctioned overlay channel — so its correctness under v6.12 is a precondition for Epic 34), P5-10.6.

## Story

As an **ma-agents user upgrading to bmad-method 6.12.4**,
I want every TOML file ma-agents ships or generates to be proven valid by upstream's own resolver,
so that the v6.11+ hard exits (unparseable `_bmad/custom/<skill>.toml` → exit 1; undefined `{{.var}}` → exit 1) never surface for the first time at my skill activation.

## Context

ma-agents owns five `customize.toml` files — `lib/bmad-extension/skills/{bmad-dev-epic,ma-agent-cyber,ma-agent-devops,ma-agent-sqa,ma-agent-sre}/customize.toml` (verified complete by `find`) — and generates `_bmad/custom/<skill>.toml` team-layer overrides for five upstream authoring skills via `lib/confluence-publish-hook.js` (`AUTHORING_SKILL_STORES` at `:139-145`: `bmad-product-brief`, `bmad-prd`, `bmad-architecture`, `bmad-ux`, `bmad-create-epics-and-stories`; key `PUBLISH_HOOK_KEY = 'workflow.on_complete'` at `:173`; block built by `buildPublishHookBlock` at `:985`; generation entry `generatePublishHooks` at `:1526`). Upstream v6.12 ships `persistent_facts` empty and renamed `{diff_output}` → `{diff_file}`. ma-agents text in four places states the v6.10 behaviour that a parse failure in the team layer "returns an empty table and exits 0": the generated file's own header comment (`lib/confluence-publish-hook.js:1007-1009`) and two CLI messages (`bin/cli.js:1466`, `:1581`); a third message (`bin/cli.js:1618`) states the resolver's array-append / override-wins merge rule. Whether that is still true at 6.12.4 is 32.1 AC9(f)'s finding. The existing publish-hook suite already drives the real `resolve_customization.py`, but through `python3` / `python` / `py -3` (`test/project-layout-confluence-publish-hook.test.js:145`), with a comment explaining that `uv run` was forbidden by the guard 32.2 has now inverted. A grep at the worktree base finds no `{diff_output}` and no `{{.` placeholder in any owned TOML or skill markdown; the only `{{.…}}` hits in the repo are Docker `--format` strings in `skills/docker-hardening-verification/scripts/verify-hardening.sh` and `skills/verify-hardened-docker-skill/scripts/verify-docker-hardening.sh`, which BMAD never renders.

## Acceptance Criteria

1. **Real resolver, via `uv run`.** New `test/owned-toml-v612-contract.test.js` locates `resolve_customization.py` in the 6.12.4 tree vendored by 32.3 (`node_modules/bmad-method/src/**/scripts/resolve_customization.py`, or the installed `_bmad/scripts/` of a scratch install — whichever 32.1 AC4 showed is the shipped path) and invokes it as `uv run <script> --skill <dir> --key <key>`. If `uv` is absent the test **fails** with a prerequisite message (FR277) — it does not skip.
2. **Every owned `customize.toml` resolves.** For each of the five files (discovered by walking `lib/bmad-extension/skills/*/customize.toml` and `skills/*/customize.toml`, with an assertion that the count is ≥ 5 and includes `bmad-dev-epic`), the resolver exits 0 for its top-level key (`agent` for the four personas, `workflow` for `bmad-dev-epic`) and its JSON output contains every top-level key present in the TOML (parsed independently in the test with a TOML library or `uv run python -c 'import tomllib…'`).
3. **Explicit `persistent_facts`.** Each owned file defines `persistent_facts` explicitly and non-empty, and the resolver's output for that skill carries the same entries (outside authority: the resolver, given that upstream defaults are now empty).
4. **No undefined variables.** Every `{{…}}` and `{name}` placeholder appearing in owned TOML values and in owned skill markdown that BMAD renders is either a variable upstream defines at 6.12.4 (set extracted from the vendored upstream renderer / `render_skill.py` / config schema at test time) or one the owning skill defines itself; shell scripts under `skills/**/scripts/` are excluded by path with a stated reason. If 32.1 found a renderer that hard-exits on undefined vars, the test runs it over each owned file and asserts exit 0.
5. **`{diff_file}` only.** No owned TOML, skill markdown or generated override contains `{diff_output}`; a fixture containing it makes the test fail (positive control).
6. **Generated overrides resolve.** For each of the five authoring skills, `generatePublishHooks` is run into a scratch project with a confluence-bound `project-layout.yaml`; the resolver, run against the **real upstream skill dir** from the 6.12.4 tree with the generated `_bmad/custom/<skill>.toml` in place, exits 0 and its `workflow.on_complete` contains the ma-agents instruction. Each target skill name is asserted to exist in the 6.12.4 tree outside `v6-shims/`.
7. **Parse-failure behaviour stated truthfully.** A deliberately malformed `_bmad/custom/bmad-prd.toml` is fed to the real resolver; the test records its exit code and asserts that the text at `lib/confluence-publish-hook.js:1007-1009`, `bin/cli.js:1466` and `:1581` states that same behaviour; likewise a scratch override exercising array-vs-scalar `on_complete` checks the merge rule stated at `bin/cli.js:1618` (exit 0 + warning, or exit 1). The strings are corrected to whatever the resolver actually does; if it now exits 1, the "silently discarded" framing is removed.
8. **Existing suite on `uv run`.** `test/project-layout-confluence-publish-hook.test.js` switches its interpreter probe (`:145`) to `uv run` and drops the comment that cites the retired guard; all its existing assertions pass unchanged.
9. **Mutation-checked.** (m1) an owned `customize.toml` gets a duplicate key → AC2 red naming the file; (m2) `persistent_facts = []` in `ma-agent-sre` → AC3 red; (m3) `{diff_output}` planted in a review-related owned string → AC5 red; (m4) `buildPublishHookBlock` emits `workflow.on_complete = "x"` as a scalar beside an upstream array → AC6 red or AC6 records the resolver's verdict; (m5) the test's resolver lookup pointed at a nonexistent path → fails loudly, not skipped.

## Tasks / Subtasks

- [ ] T1 Resolver locator + `uv run` invoker; prerequisite failure (AC1)
- [ ] T2 Owned `customize.toml` resolution + key-set comparison (AC2, AC3)
- [ ] T3 Placeholder inventory against upstream's defined set; script-path exclusion (AC4, AC5)
- [ ] T4 Generated-override resolution against real upstream skill dirs (AC6)
- [ ] T5 Parse-failure + merge behaviour; correct the message sites (AC7)
- [ ] T6 Move the publish-hook suite to `uv run` (AC8)
- [ ] T7 Mutants m1–m5 (AC9); add the new test to the `npm test` chain; `npm run build:plugin` if any skill file changed

## Dev Notes

- Blocked on 32.4 (its deletions change which skills exist) and 32.5 (it rewrites `bmad-dev-epic/customize.toml`); validate the final files, not interim ones.
- AC7's message edits will put the words `uv run` (or not) into `bin/cli.js` / `lib/*.js` strings — 32.2 narrowed the control-plane guard to execution sites precisely so this is allowed; confirm `test/uv-transition-resilience.test.js` stays green.
- The publish-hook block's header comment explains why it uses a dotted key at the top of the file (`lib/confluence-publish-hook.js:995-997`); if 6.12.4's resolver changed table-merge semantics (array append vs scalar replace for `on_complete`), that comment and `detectUserLayerScalarOverrides` (`:1708`) are in scope — record, and fix only what the resolver contradicts.
- `persistent_facts` entries use `file:{project-root}/**/project-context.md`; confirm 6.12.4 still expands `{project-root}` inside `persistent_facts` (it is a model-expanded literal elsewhere — see 31-1 findings).
- Windows: `uv run` on Windows needs the script path quoted; use `spawnSync('uv', ['run', script, …])` with an argv array, never a shell string.

## Out of scope

- Generating overrides for any skill beyond the five authoring skills (Epic 34 target table).
- Changing which skills publish to Confluence, or the publish instruction text beyond AC7's factual correction.
- Owned TOML for extension modules in the new repository (Epic 33/34 port these tests).

## Verification record

Suite: … ; resolver path + version: … ; parse-failure exit code observed: … ; mutants: m1 … m5 ; unverified: …
