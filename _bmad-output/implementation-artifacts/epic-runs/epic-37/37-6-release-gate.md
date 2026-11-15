# Story 37.6 — Epic 37 gate record: `ma-bmad-extensions` 4.0.0-beta.1 on BMAD v7 at `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`

Run date: 2026-11-15. Story: `_bmad-output/implementation-artifacts/37-6-release-gate.md`. Spec: `prd/capabilities/ma-agents-v7-line.md` (F29: FR282, FR295, FR297, FR302, FR304, NFR84, NFR86), Decisions P5-11.1, P5-11.2, P5-11.6; epic brief `epics.md:5902` with the PO's tag decision of 2026-11-15 (`v4.0.0-beta.1`, not `v1.0.0`). Extension tree: `main` at `7cde826` (Stories 37.1–37.5 merged, extensions PRs #1–#5) plus this story's working tree (branch `feat/37-6-release-gate`, not yet committed; CI runs are the orchestrator's to paste, see "CI runs").

## Verdict

**PASS — conditional on two items the release owner closes after the merge** (2026-11-15): every gate of NFR84 holds on `main` `7cde826` with this story's checks (table below); the two items that cannot be verified before the tag exists are the GitHub Actions runs of this branch and of `main` after the merge (the orchestrator pastes them), and the install from the real tag `v4.0.0-beta.1` (the release owner cuts the tag on the merge commit and pastes the run; the tag path itself is proved on a local clone, AC2). No STOP, no blocking finding, no new failure. Epic 38 and Epic 39 may start on the tagged commit; `bmadRef.extensions` (39.1) names `v4.0.0-beta.1`.

## Commit qualified

| Item | Value | Authority |
|---|---|---|
| Extension `main` | `7cde826e36bcb3fb84fbd12f514bbae8c375770f` (merge of PR #5, 37.5) | `git ls-remote https://github.com/mayafit/ma-bmad-extensions.git refs/heads/main`, 2026-11-15 |
| Records' version | `4.0.0-beta.1` in all four `skills/bmod-*/bmod.toml` | `validate_manifests.py` (one version); `install_test.py` derives the tag `v4.0.0-beta.1` from it |
| Tag to cut | `v4.0.0-beta.1` on the commit that merges this story (not on `7cde826`: the gate checks ship with this story) | "Tag" below |
| `bmadRef.core` | `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` = `BMAD_CORE` of `ci.yml` | ma-agents `package.json`; `bundle/manifest.json` of the 2026-11-15 build (`8515f1d4d0e5b189e48ff8249e1a4353412ddecfed8d6be2daa7e8a61c748cd7`, equal to 36.6's record) |
| `bmadRef.skillsCli` | `1.7.6` = `SKILLS_CLI` of `ci.yml` | `tools/pack-skills-cli.mjs` checks `--version` |
| `bmadRef.extensions` | `""` until 39.1 bundles the tag | FR302 |
| Wheelhouse builder | ma-agents `main` `3fc11057bd5496784b1fed49555cd34bbcc59663`, `scripts/build-wheelhouse.py` blob SHA-256 `82ea1bfd064d15c00e0d14b93d1f77c214eae2da833279f0fb3f2e6d22ee3259` (LF; `cc1259ee…` in a CRLF checkout) = `MA_AGENTS_REF` of the `offline` job | `git show 3fc1105…:scripts/build-wheelhouse.py \| sha256sum` |
| Runtime | uv 0.13.8 (`uv-x86_64-unknown-linux-gnu.tar.gz` SHA-256 `5acfd917…`), CPython 3.11.18 (`cpython-3.11.18-linux-x86_64-gnu`), 10 wheels on linux-x64, `wheelhouse-manifest.json` SHA-256 `5f602579794e1e0375b03f9717433488af2b8e69168864204dea5dbcc66d355f` (built with `--extra-skills` = this repository) | the pre-fetch step's output, 2026-11-15 |
| Container | `node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb` in CI (ma-agents' offline job's digest); `node:22.20.0-bookworm` (`915acd9e…`, the floor) in the local runs | `ci.yml`; "AC by AC" |

## Inputs

- Story 37.1 — Verification record of `37-1-repository-scaffold.md` (AC8 `--complete` deferred here; AC11 tag install unverified; "Update state" note).
- Story 37.2 — Verification record of `37-2-ma-standards-module.md`.
- Story 37.3 — Verification record of `37-3-ma-ops-module.md` (unverified: `setup.py --status` `current` for a module whose `main` record differs).
- Story 37.4 — Verification record of `37-4-ma-knowledge-module.md`.
- Story 37.5 — Verification record of `37-5-cross-module-sweep.md` (unverified: the tag install "until `v1.0.0`").
- Epic 36 — `epic-runs/epic-36/36-6-release-gate.md` (PASS; gate tag `v4-gate-e734d3a`), Story 36.2's runtime and `docs/on-prem-runtime.md`.

No 36.1 STOP exists; no PO re-plan is pending.

## AC by AC

| AC | Result | Evidence |
|---|---|---|
| 1 `--complete` with the pending module | PASS | `uv run --no-cache tools/check_assignment.py --complete` → `OK: complete assignment: 71 skill(s) in 4 module record(s); 71 of 73 package-map skills shipped; pending ma-atlassian (Epic 38): ma-atlassian-confluence-plan, ma-atlassian-confluence-record-root-page not shipped`, exit 0 (Windows and Linux); without `--complete` the 37.5 line. `ci.yml` step 8 runs `--complete`. Mutants c1–c3 red (AC6) |
| 2 Install from the tag | PASS (local tag); real tag pending | A bare clone of the worktree at `7cde826` tagged `v4.0.0-beta.1` (annotated, throwaway) and served by `git http-backend` on `127.0.0.1:8766`; `install_test.py --tree … --from-tag http://127.0.0.1:8766/ext.git --expect-update current` → `module ma-atlassian from http://127.0.0.1:8766/ext.git#v4.0.0-beta.1` … `PASS ma-atlassian`, `PASS ma-knowledge`, `PASS ma-ops`, `PASS ma-standards`, `OK: 4 module(s) installed alone from http://127.0.0.1:8766/ext.git#v4.0.0-beta.1 and reported by setup.py --status, update state in ['current']`, exit 0 (17.6 s); the server log shows `GET /ext.git/info/refs?service=git-upload-pack` + `POST /ext.git/git-upload-pack` per install; `skills-lock.json` of the `ma-knowledge` project: `"bmod-ma-knowledge": {"source": "http://127.0.0.1:8766/ext.git", "ref": "v4.0.0-beta.1", "sourceType": "git", "skillPath": "skills/bmod-ma-knowledge/SKILL.md", …}` and the same for `ma-knowledge-atlas`. Guard: `--tag v9.9.9` → `SKIP: tag v9.9.9 does not exist on http://127.0.0.1:8766/ext.git; …`, exit 0. GitHub: `--from-tag mayafit/ma-bmad-extensions` → `SKIP: tag v4.0.0-beta.1 does not exist on github.com/mayafit/ma-bmad-extensions; the install from a tag runs once it does`, exit 0 (Windows and Linux; `git ls-remote --tags` of the repository is empty). Routes that fail, recorded in the story (D2): `file:///…#tag`, dumb HTTP |
| 3 `current` online | PASS | Folder install, Windows: `status: ma-atlassian 4.0.0-beta.1 scope project update current`, the same for `ma-knowledge`, `ma-ops`, `ma-standards`; `OK: 4 module(s) installed alone from D:\Code\ma-bmad-extensions-37-6 and reported by setup.py --status, update state in ['current']` (14.8 s). Linux (branch rule, `EXPECT_UPDATE=current,ahead`): four `update current`, `OK … update state in ['ahead', 'current']`. The tag install of AC2: four `current`. Negatives on scratch copies of `skills/` + `tools/`: version `4.0.0-beta.2` → `FAIL ma-knowledge: --status update state 'ahead', expected one of ['current']: {'source': 'https://raw.githubusercontent.com/mayafit/ma-bmad-extensions/main/skills/bmod-ma-knowledge/bmod.toml', 'source_version': '4.0.0-beta.1'}`, exit 1; version `4.0.0-beta.0` → `… update state 'newer-available', expected one of ['current']: {…'source_version': '4.0.0-beta.1'}`, exit 1 |
| 4 Offline activation | PASS | Runtime prepared in `node:22.20.0-bookworm` with network (the `offline` job's pre-fetch step verbatim: `uv.tar.gz: OK`, `uv 0.13.8`, `Installed Python 3.11.18`, `linux-x64: 10 wheels: certifi-2026.10.23, charset_normalizer-3.5.2, idna-3.20, jinja2-3.1.6, markupsafe-3.0.4, pyyaml-6.0.3, regex-2026.11.9, requests-2.34.2, tiktoken-0.11.0, urllib3-2.8.0`, manifest `5f602579…`, `verify ok`). Then `docker run --rm --network none` on the same image, repository / tree (`bundle/bmad-method` at `e734d3a`) / Skills CLI / runtime mounted read-only: `runtime: uv 0.13.8 (x86_64-unknown-linux-gnu) at /rt/bin/uv; python ['.temp', 'cpython-3.11-linux-x86_64-gnu', 'cpython-3.11.18-linux-x86_64-gnu']; 10 wheel(s) for linux-x64`; `wheelhouse covers 8 owned script(s): git-workflow-skill/scripts/git_workflow.py, js-ts-security-skill/scripts/verify_security.py, ma-knowledge-atlas/scripts/build_atlas.py, ma-ops-dev-epic/scripts/migrate_v6_backlog.py, ma-standards-apply/scripts/apply_block.py, skill-creator/scripts/{init_skill,package_skill,quick_validate}.py`; `network interfaces: ['lo']`; `uv.toml: /work/uv.toml (UV_CONFIG_FILE); UV_PYTHON_INSTALL_DIR=/rt/python`; per module `add + setup: … status 'created'`, `status: <code> 4.0.0-beta.1, update 'could-not-check'` (×4), `render_skill.py: 1 / 1 / 40 / 29 member(s) rendered`, the eight script lines (`build_atlas.py: --help exit 0`, `migrate_v6_backlog.py: --help exit 0`, `verify_security.py: --help exit 0`, `git_workflow.py: --help exit 0`, `apply_block.py: --help exit 0`, `init_skill.py: --help exit 1 (usage printed)`, `package_skill.py: (no argument) exit 1 (usage printed)`, `quick_validate.py: (no argument) exit 1 (usage printed)`); `control: render of ma-atlassian-bind without find-links exits 1: No solution found when resolving script dependencies`; `OK: offline activation: 4 module(s) installed alone, 71 member(s) rendered, 8 script(s) started, every run through uv run --no-cache from the runtime with no network`, exit 0. First run (same image, 2026-11-15): 71 rendered, `FAIL ma-standards: skill-creator: scripts/package_skill.py --help exited 1: … Error: Skill folder not found: /work/ma-standards/--help` — the probe fixed (story D6), second run green |
| 5 Unique names | PASS | `uv run --no-cache tools/check_unique_names.py --tree $BMAD_TREE` → `OK: 75 owned name(s) unique against 35 upstream name(s) at <tree>`, exit 0 (Windows and Linux). Every owned frontmatter `name` equals its folder (checked on all 75) |
| 6 Mutants | PASS | `test_gate_checks.py --tree`: `ok c0 … green`, `ok c1 … package map: 'ma-atlassian-confluence-plan' (module 'ma-atlassian') is not shipped`, `ok c2 … [modules.ma-ops] pending = 'Epic 99' is stale: every skill of the module ships`, `ok c3 … pending must name the epic that ships the module`, `ok u0 … green`, `ok u1 … skills/bmod-method: name 'bmod-method' is also shipped by the pinned BMAD-METHOD snapshot (skills/bmod-method)`, `ok u2 … name 'bmad-agent-po' is also shipped … (skills/bmad-agent-po)`, `ok u3 … name 'sre-check-secrets' differs from the folder name`, `skip u4: the file system folds case`; `8 passed, 0 failed, 1 skipped` on Windows; `9 passed, 0 failed, 0 skipped` on Linux (u4 red: `2 folders share the name 'sre-day-2-ops' ignoring case`). e1, e2, e3: AC3 and AC2 |
| 7 CI and README | PASS | `ci.yml` parses: job `gates` 20 steps (8 `--complete`; 10 `check_unique_names.py`; 11 `test_gate_checks.py`; 18 `EXPECT_UPDATE`; 19, 20 `--expect-update "$EXPECT_UPDATE"`), job `offline` 8 steps (checkout, Node 22.20.0, BMAD-METHOD by sha, ma-agents builder by sha, pack, pre-pull, pre-fetch, `docker run --network none`). README lists the fourteen `gates` commands in order plus the container command |
| 8 Gates stay green | PASS | Windows: `bmod files valid: 71 skills, 4 module records, 4 knowledge documents.`; `OK: 71 member file(s), 0 override file(s), 0 finding(s)`; `OK: 380 guidance file(s) …`; `OK: 75 skill folder(s), none named bmad-*`; `OK: sweep: 75 skill folder(s), 394 text file(s); …`; `15 passed, 0 failed, 0 skipped`; `47 passed, 0 failed`; `13 passed, 0 failed`; `17 passed, 0 failed`; all exit 0 |
| 9 Linux | PASS | `node:22.20.0-bookworm` (`node v22.20.0, npm 10.9.3, git 2.39.5`, uv 0.13.8 from the tarball, `BMAD_TREE=/work/tmp/bmad-method at e734d3ac…`), the `gates` steps verbatim on a re-initialised copy of the working tree: AC8's nine lines, AC1's, AC5's, `9 passed, 0 failed, 0 skipped`, pack `/work/tmp/skills-cli/bin/cli.mjs`, `GITHUB_REF=refs/heads/feat/37-6-release-gate -> EXPECT_UPDATE=current,ahead`, four `PASS` with `update current`, the tag step `SKIP`, the `offline` job's ma-agents fetch (`git fetch --depth 1 origin 3fc1105…` + `checkout FETCH_HEAD -- scripts/build-wheelhouse.py` → blob `82ea1bfd…`); `ALL STEPS PASSED`, exit 0. AC4 in the same image under `--network none` |
| 10 Gate record and tag | this file | verdict above; the tag commands below; the tag not created in this story |

## CI runs

The orchestrator pastes the GitHub Actions runs here after the push (workflow `ci`, jobs `gates` and `offline`):

| Run | Branch / commit | Result |
|---|---|---|
| https://github.com/mayafit/ma-bmad-extensions/actions/runs/43734676798 | `feat/37-6-release-gate` at `c698e7e` (push) | `gates` + `offline`: success |
| https://github.com/mayafit/ma-bmad-extensions/actions/runs/43734681899 | pull request #6 → `main` | `gates` + `offline`: success |
| `<orchestrator pastes>` | `main` at `<merge-commit>` (after the merge; `EXPECT_UPDATE=current`) | `<result>` |
| `<orchestrator pastes>` | tag `v4.0.0-beta.1` (push of the tag starts `ci`; its tag step must show four `PASS`) | `<result>` |

The `main` run at `7cde826` (37.5's merge) is the last green run before this story: https://github.com/mayafit/ma-bmad-extensions/actions/runs/43732205527 (success).

## Tag — for the release owner, after the PO merges this story

- Name: **`v4.0.0-beta.1`** (`v` + the records' shared version, NFR86). Target: the extension `main` commit that merges `feat/37-6-release-gate` (its records carry `4.0.0-beta.1` and its CI carries every gate of this record). Not `7cde826`.
- Commands, in a checkout of `mayafit/ma-bmad-extensions` at that commit:

```
git tag -a v4.0.0-beta.1 <merge-commit> -m "ma-bmad-extensions 4.0.0-beta.1: first tag of the 4.x line (Story 37.6)"
git push origin v4.0.0-beta.1
git show --no-patch v4.0.0-beta.1
```

- Then, with `$BMAD_TREE` at `e734d3a` and `$CLI` packed by `tools/pack-skills-cli.mjs`:

```
uv run --no-cache tools/install_test.py --tree $BMAD_TREE --skills-cli $CLI --work <scratch> --from-tag mayafit/ma-bmad-extensions --expect-update current
```

  must print `module <code> from mayafit/ma-bmad-extensions#v4.0.0-beta.1` and `PASS` for `ma-atlassian`, `ma-knowledge`, `ma-ops`, `ma-standards`, each `status: <code> 4.0.0-beta.1 scope project update current`, and `OK: 4 module(s) installed alone from mayafit/ma-bmad-extensions#v4.0.0-beta.1 and reported by setup.py --status, update state in ['current']`, exit 0 — the same four lines the local tag produced (AC2). The pushed tag also starts `ci`, whose step 20 must show the same instead of `SKIP`. Paste both here:

- `git show --no-patch v4.0.0-beta.1`: `<release owner pastes>`
- `install_test.py --from-tag` output: `<release owner pastes>`
- Actions run of the tag: `<release owner pastes>`
- Then 39.1 sets ma-agents `bmadRef.extensions` to `v4.0.0-beta.1`. No npm publish in this story (39.4).

## Unverified items (every item 37.1–37.6 marked unverified)

- 37.1: the tag install (AC11) — **closed for the mechanism by this story** (AC2, local tag); the GitHub tag run remains until the tag exists (above).
- 37.2, 37.4: the GitHub Actions runs of their branches were pasted in their records; nothing else.
- 37.3: an agent-performed `bmad migrate` following `migration-1.toml` and an agent-performed `ma-ops-dev-epic` run against a live `bmad-agent-po` (rendered text read, not executed) — open, not a gate item; `setup.py --status` `current` for a module whose `main` record differs — **closed** (AC3: `ahead` / `newer-available` shown).
- 37.5: an agent-performed `cyber-vulnerability-scan` run with one scanner absent — open, not a gate item; the tag install — as 37.1.
- 37.6: the GitHub Actions runs (orchestrator); the real tag install and the tag's own run (release owner); a Windows offline run (the runtime builder supports `win-x64`; the no-network proof is Linux's `--network none`, as in 36.2/36.6); the activations are renders and script starts, not agent-performed skill runs.

## Other changes this story made outside its new files

- `tools/check_assignment.py`: the `pending` marker (summary lists a pending module's unshipped skills; a stale marker and an empty marker fail); `tools/package-map.toml`: `[modules.ma-atlassian] pending = "Epic 38"` with its comment.
- `tools/install_test.py`: `--expect-update STATES`; `--from-tag` accepts a clone URL; `SKIP` names the URL.
- `.github/workflows/ci.yml`: `gates` steps 8, 10, 11, 18–20; new job `offline` (`MA_AGENTS_REF`, `UV_SHA256`, `OFFLINE_NODE_IMAGE`).
- `README.md`: the command list, the `--complete` / `--expect-update` paragraph, the "Offline activation" section.
- No skill file changed.
