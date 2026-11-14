# Story 36.1 — Gate findings: BMAD v7 at `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6`

Run date: 2026-11-14. Story: `_bmad-output/implementation-artifacts/36-1-gate-spike-v7-pinned-sha.md`. Spec: `prd/capabilities/ma-agents-v7-line.md` (F29), Decision P5-11.

## Setup used by every [RUN]

- `<S>` = `C:\Users\995472\AppData\Local\Temp\claude\22f0739adb12a89a\2ebc6e1e-9c11-4977-a2e4-2acb6e383b46\scratchpad\spike-36-1\` (outside every worktree; removed after the run). In containers `<S>` is mounted at `/work`: `MSYS_NO_PATHCONV=1 docker run --rm [--network none] -v "C:/Users/995472/AppData/Local/Temp/claude/22f0739adb12a89a/2ebc6e1e-9c11-4977-a2e4-2acb6e383b46/scratchpad/spike-36-1:/work" <image> bash /work/scripts/<script>`.
- Upstream clone: `<S>/BMAD-METHOD` — `git init; git remote add origin https://github.com/bmad-code-org/BMAD-METHOD.git; git fetch --depth 1 origin e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6; git checkout FETCH_HEAD`. Upstream citations below are `path:line` in this tree.
- Skills CLI: `cd <S>/pack; npm pack skills@1.7.6` → `skills-1.7.6.tgz`; `tar -xzf skills-1.7.6.tgz -C <S>/skills-cli --strip-components=1`; `cd <S>/skills-cli; npm install --omit=dev --ignore-scripts` (see AC2: the tarball is not self-contained). Bin entry `bin/cli.mjs`. `CLI` = `node <S>/skills-cli/bin/cli.mjs`.
- Host: Windows 11, Git Bash. uv on the host: `C:\Users\995472\AppData\Roaming\Python\Python312\Scripts\uv.exe`.
- Images (pulled online; every `--network none` run uses only these):
  - `spike361-n20` = `FROM node:20.18.1-bookworm@sha256:968ca0550acc7589a8b1324401ec6e39ace53b2c82d2aed3a278e9ff491c2b1c` (the `OFFLINE_NODE_IMAGE` of `.github/workflows/offline-install.yml:68`) `+ apt-get install strace`.
  - `spike361-n22` = `FROM node:22-bookworm` (resolved `node@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb`, Node v22.23.5, git 2.39.5) `+ apt-get install strace` (strace 6.1).
  - `spike361-n22fw` = `FROM spike361-n22 + apt-get install iptables` (AC7(b) black-hole run only).
- Container runtime: `<S>/runtime/bin/uv` from `https://github.com/astral-sh/uv/releases/download/0.13.8/uv-x86_64-unknown-linux-gnu.tar.gz` (sha256 `5acfd9177cfecf0bf87578f059728215ccc884388988f55f7a65041b57387d91`); Python installed online in `spike361-n22` with `UV_PYTHON_INSTALL_DIR=/work/runtime/python uv python install 3.11` → `cpython-3.11.18-linux-x86_64-gnu`; wheelhouse built on the host with `python -m pip download --only-binary=:all: --platform manylinux2014_x86_64 --platform manylinux_2_17_x86_64 --python-version 3.11 --implementation cp --abi cp311 -d <S>/runtime/wheelhouse "jinja2>=3.1"`.
- Telemetry opt-out set on every CLI run unless stated: `DISABLE_TELEMETRY=1 DO_NOT_TRACK=1`. Every CLI run reads stdin from `/dev/null`.
- Network-attempt capture: `strace -f -qq -e trace=connect -o <file> <cmd>`, counting `AF_INET`/`AF_INET6` lines. Positive control of the method (AC2): `node -e "fetch('https://www.skills.sh/tele/t?probe=1')"` under the same strace in `--network none` records `connect(… AF_INET, sin_port=htons(53), sin_addr=192.168.65.7 …) = -1 ENETUNREACH`, so a DNS or socket attempt is visible.
- Fixture generator `<S>/scripts/mkfixture.py` (Appendix A): `python -I mkfixture.py <out> <update_source> <version> [--questions] [--neg versions|no-member-bmod|folder-name|bmad-prefix]`. Modules `bmod-ma-ops` (members `ma-agent-sre` (agent, in `roster.toml`), `sre-check-system-status`, `ma-ops-dev-epic` with `scripts = ["scripts/migrate_v6_backlog.py"]`) and `bmod-ma-standards` (members `git-workflow-skill`, `code-review`), one shared version; `bmod-ma-ops` `required_skills` = `bmad` 6.13.0 + `bmad-agent-po` + `bmad-build` (all `github:bmad-code-org/BMAD-METHOD/skills`); `--questions` adds `ops_team_channel` (team, default `#ops`) and `ops_user_handle` (`scope = "user"`). `bmod-ma-ops` carries three members, not two, so one fixture serves AC4–AC6.
- Scratch GitHub repository: **https://github.com/mayafit/ma-bmad-spike-36-1** (private; left in place for review). `main` = `2af3dd4` (record `0.2.0`); tag `v0.1.0` = `b007864` (record `0.1.0`).

## AC1 — Scratch baseline recorded

Evidence: [RUN]

| Item | Command | Value |
|---|---|---|
| Upstream HEAD | `git -C <S>/BMAD-METHOD rev-parse HEAD` | `e734d3ac3c0f4ea31cc2c2bbbe79e86e54f2cae6` (= pin) |
| `bmod-method` version | `skills/bmod-method/bmod.toml:3` | `version = "6.13.0-next"` |
| `bmod-method` requirement | `skills/bmod-method/bmod.toml:25` | `required_skills = [{ skill = "bmad", version = "6.13.0", source = "github:bmad-code-org/BMAD-METHOD/skills" }]` |
| Skills CLI | `npm pack skills@1.7.6` | `skills 1.7.6`, bin `{"skills":"./bin/cli.mjs","add-skill":"./bin/cli.mjs"}` |
| Skills CLI `engines.node` | `<S>/skills-cli/package.json` | `>=22.20.0` |
| Skills CLI runtime deps | `package.json` `dependencies` | `{"tar":"^7.5.20","yaml":"^2.8.3"}` (7 packages installed) |
| Node / npm / git | host | v24.15.0 / 11.12.1 / 2.54.0.windows.1 |
| uv | host | uv 0.13.8 (3d97a6aad 2026-11-12 x86_64-pc-windows-msvc) |
| Python | host | 3.12.10 system; uv-managed 3.11.18 (Windows, downloaded by uv on first `uv run` for AC6) and `cpython-3.11.18-linux-x86_64-gnu` in `<S>/runtime/python` |

Floor finding: the Skills CLI declares `engines.node >=22.20.0`, higher than the spec's 20.12 (FR283/FR297/FR298). It is a hard floor: on the pinned `OFFLINE_NODE_IMAGE` (Node 20.18.1) `node <S>/skills-cli/bin/cli.mjs add …` exits 1 with `SyntaxError: The requested module 'fs/promises' does not provide an export named 'glob'` (AC2 run `n20`). The effective floor for any machine that runs the bundled Skills CLI is Node ≥ 22.20.

Upstream drift recorded for 36.7: `main` is 10 commits ahead of the pin (`gh api repos/bmad-code-org/BMAD-METHOD/compare/e734d3a...main` → `ahead_by 10`, head `e435a22`, 2026-11-12). Among them `3cf35b6 refactor!: group skills into one folder per module (#3181)` (main's `skills/` now holds `core-tools/ founder/ method/ toolsmith/`, and `skills/core-tools/bmod-core-tools/bmod.toml` declares `update_source = "github:bmad-code-org/BMAD-METHOD/skills/core-tools"`), `a867e16 feat(facilitate)!: … generic engine and template customization (#3176)` and `c67a00d fix(memlog): read and write frontmatter with PyYAML` (new PEP 723 dependency).

**PASS** — Re-run at GA: no

## AC2 — Q1: Skills CLI `add` from a local folder, unattended

Evidence: [RUN], [READ]

Online (host, fresh git project `<S>/p2-host`):

```
CLI add <S>/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code cline < /dev/null
```

- Exit 0; no prompt (stdin is `/dev/null`). Non-interactive tool-selection flag: `--agent <ids…>` (`-a`); `-y` skips confirmation.
- Installed: canonical copies in `.agents/skills/<skill>/` (shared by `cline`, whose `skillsDir` is `.agents/skills`), and `.claude/skills/<skill>` as symlinks to them (Windows: `bmad -> …/p2-host/.agents/skills/bmad/`). With `--agent claude-code` alone (AC4/AC5 runs) the skills are real folders in `.claude/skills/` and no `.agents/skills/` is created. `--copy` writes copies instead of links (container run `p11`).
- `skills-lock.json` entry: `"bmad": {"source": "../BMAD-METHOD", "sourceType": "local", "computedHash": "7fd0957c…"}` (with `--copy` also `"installMode": "copy"`). It names the local path, relative to the project. `setup.py` reads the project's `skills-lock.json` (`skills/bmad/scripts/setup.py:638-645`).

Offline (`<S>/scripts/ac2-offline.sh`, `docker run --network none … spike361-<img> bash /work/scripts/ac2-offline.sh <img> <optout|telemetry-on>`):

```
strace -f -qq -e trace=connect -o /work/logs/ac2-<img>-<mode>.strace \
  node /work/skills-cli/bin/cli.mjs add /work/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code cline < /dev/null
```

| Image | Opt-outs | Exit | Wall | `connect()` (AF_INET/6) |
|---|---|---|---|---|
| `spike361-n22` (Node 22.23.5) | `DISABLE_TELEMETRY=1 DO_NOT_TRACK=1` | 0 | 8.9 s | 0 (0 connect calls of any family) |
| `spike361-n22` | none | 0 | 14.4 s | 0 |
| `spike361-n20` (Node 20.18.1, pinned image) | set | 1 (`SyntaxError … export named 'glob'`) | 1.0 s | 0 |
| `spike361-n20` | none | 1 (same) | 0.6 s | 0 |

- Telemetry switches [READ]: `<S>/skills-cli/dist/cli.mjs:2915-2917` `isEnabled() { return !process.env.DISABLE_TELEMETRY && !process.env.DO_NOT_TRACK; }`; endpoints `:2908-2909` (`https://www.skills.sh/tele/t`, `…/tele/audit`). For a local source the install event is not sent at all: `track({event: "install", …})` runs only when `normalizedSource` (an owner/repo) is set (`:6196-6214`), which explains zero attempts even without opt-outs. Remote sources do call `track` and the audit fetch (`:5966`); `DISABLE_TELEMETRY` / `DO_NOT_TRACK` gate both.
- Tarball finding: the `npm pack` tarball has no `node_modules`; `node bin/cli.mjs --version` fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'yaml'` until `tar` and `yaml` (7 packages: `@isaacs/*`, `chownr`, `minipass`, `minizlib`, `tar`, `yallist`, `yaml`) are installed. The bundle must carry them.

**PASS** (Node ≥ 22.20; zero outbound attempts with and without the opt-outs) — Re-run at GA: yes

## AC3 — Q2: install from a `#tag`

Evidence: [RUN]

```
gh repo create mayafit/ma-bmad-spike-36-1 --private
python -I <S>/scripts/mkfixture.py <S>/fixtures/fx-ext github:mayafit/ma-bmad-spike-36-1/skills 0.1.0 --questions   # pushed as main, tagged v0.1.0
# project <S>/p3: core from the local pin (AC2 command, --agent claude-code), then
CLI add mayafit/ma-bmad-spike-36-1#v0.1.0 --skill bmod-ma-ops --skill ma-agent-sre --skill sre-check-system-status --skill ma-ops-dev-epic -y --agent claude-code   # exit 0
# bump both records to 0.2.0 on main and push (main = 2af3dd4)
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root <S>/p3 --skill <S>/p3/.claude/skills/bmad --root <S>/p3/.claude/skills --module-answers <S>/fixtures/ac5-answers.toml   # exit 0
uv run --no-cache .claude/skills/bmad/scripts/setup.py … --status --module ma-ops   # exit 0, 2 s
```

- Lock entry: `"bmod-ma-ops": {"source":"mayafit/ma-bmad-spike-36-1","ref":"v0.1.0","sourceType":"github","skillPath":"skills/bmod-ma-ops/SKILL.md", …}` — the tag is recorded; the private repository is cloned with the host's ambient git credentials.
- Status on the private repository: `"state": "could-not-check", "source": "https://raw.githubusercontent.com/mayafit/ma-bmad-spike-36-1/main/skills/bmod-ma-ops/bmod.toml", "reason": "… HTTP Error 404: Not Found"`. The update check is an unauthenticated `urllib` GET of `raw.githubusercontent.com/<owner>/<repo>/main/…` (`setup.py:1934-1942`, `:1945-1958`); `pinned` is set only after a successful fetch reports `newer-available` (`setup.py:1828`), so a private repository can never report `pinned`, `newer-available` or `current`.
- `pinned` on a public repository (control, `<S>/p12-tea-v4.0.0`): `CLI add bmad-code-org/bmad-method-test-architecture-enterprise#v4.0.0 --skill bmod-tea … -y --agent claude-code`, lock `"ref":"v4.0.0"`, then `setup.py --status --module tea` → `{"state": "pinned", "source_version": "4.0.1", "pinned_ref": "v4.0.0", "instruction": "this module is pinned to v4.0.0, which `npx skills update` keeps; to move to 4.0.1, add it again at the newer tag: npx skills add bmad-code-org/bmad-method-test-architecture-enterprise#v4.0.1 --skill bmod-tea bmad-tea …", "install": "npx skills add …#v4.0.1 --skill …"}` (exit 0). Matches `setup.py:1823-1866`, `:1869-1882` and `docs/customize/add-modules.md:43`.
- Input to AC7: `pinned` needs a SemVer lock `ref`, a lock source from the `update_source` repository (`same_repository`, `setup.py:1885-1891`) and a fetchable `main`; it is a `github:`-only, public-repository state.

**PASS** — the lock records the tag; `pinned` is shown on a public repository; the private scratch repository reports `could-not-check` (HTTP 404), so `ma-bmad-extensions` must be public for `pinned`/`current` (change set 37.1, 37.6) — Re-run at GA: yes

## AC4 — Q3: one module out of a multi-module repository under `-y`

Evidence: [RUN] — fixture `<S>/fixtures/fx-ext` (local folder), fresh projects `<S>/p4-{a,b,c}`, `CLI add <S>/fixtures/fx-ext <sel> -y --agent claude-code < /dev/null`.

| Run | `<sel>` | Exit | Installed (`.claude/skills/` = `skills-lock.json` keys) |
|---|---|---|---|
| (a) | `--skill bmod-ma-ops --skill ma-agent-sre --skill sre-check-system-status --skill ma-ops-dev-epic` | 0 | `bmod-ma-ops ma-agent-sre ma-ops-dev-epic sre-check-system-status` |
| (b) | `--skill bmod-ma-ops` | 0 | `bmod-ma-ops` only — members are not pulled |
| (c) | none | 0 | all 7: `bmod-ma-ops bmod-ma-standards code-review git-workflow-skill ma-agent-sre ma-ops-dev-epic sre-check-system-status` |

(a) installs exactly the named set and no sibling-module folder; (c) installs every skill of every module in the source. The installer must always pass the full member list.

**PASS** — Re-run at GA: yes

## AC5 — Q4: module setup driven by `setup.py --module-answers`

Evidence: [RUN] — project `<S>/p4-a` (AC4 (a) + core from the local pin). `SETUP` = `uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root <S>/p4-a --skill <S>/p4-a/.claude/skills/bmad --root <S>/p4-a/.claude/skills`.

| Step | Exit | Decisive output |
|---|---|---|
| `SETUP --list-config-questions` | 0 | `[{"module": "ma-ops", "key": "ops_team_channel", …, "default": "#ops", "scope": "team"}, {"module": "ma-ops", "key": "ops_user_handle", …, "default": "", "scope": "user"}]` |
| `SETUP` (no answers) | 1 | `error: pending question modules.ma-ops.ops_team_channel has no answer; pass --module-answers (run --list-config-questions first)` (`setup.py:2210`) |
| `SETUP --module-answers <S>/fixtures/ac5-answers.toml` | 0 | `answers_added: [{ma-ops, ops_team_channel, team, _bmad/config.toml}, {ma-ops, ops_user_handle, user, _bmad/custom/config.user.toml}]`, `status created`, `current true` |
| `uv run --no-cache _bmad/scripts/resolve_config.py --project-root <S>/p4-a --key modules.ma-ops.ops_team_channel` | 0 | `{"modules.ma-ops.ops_team_channel": "#spike-ops"}` |
| `… --key modules.ma-ops.ops_user_handle` | 0 | `{"modules.ma-ops.ops_user_handle": "spike-oncall"}` |
| second `SETUP --module-answers <same file>` | 1 | `error: --module-answers …ac5-answers.toml contains modules.ma-ops.ops_team_channel, which is not a pending question` (`setup.py:2205`) |
| fresh project `<S>/p5-missing`, file with only `ops_team_channel` | 1 | `error: --module-answers …ac5-missing.toml is missing an answer for pending question modules.ma-ops.ops_user_handle; run --list-config-questions first` (`setup.py:2216`); no `_bmad/` written |

Answers file (`[modules."<code>"]`, shape of `skills/bmad/references/setup.md:41-45`):

```toml
[modules."ma-ops"]
"ops_team_channel" = "#spike-ops"
"ops_user_handle" = "spike-oncall"
```

Landing: `_bmad/config.toml` gains `[modules.ma-ops] ops_team_channel = "#spike-ops"`; `_bmad/custom/config.user.toml` holds `[modules.ma-ops] ops_user_handle = "spike-oncall"`; `_bmad/custom/config.toml` is not created (unchanged). The installer lists questions first and sends only pending ones.

**PASS** — Re-run at GA: yes

## AC6 — Q5: `validate_manifests.py` on a minimal `bmod-ma-ops` fixture

Evidence: [RUN] — `cd <S>/fixtures/ac6-<case>; uv run --no-cache <S>/BMAD-METHOD/skills/bmad/scripts/validate_manifests.py --project-root .`; fixtures from `mkfixture.py … github:mayafit/ma-bmad-extensions/skills 1.0.0 [--neg <case>]`.

| Case | Exit | Message |
|---|---|---|
| positive | 0 | `bmod files valid: 5 skills, 2 module records, 2 knowledge documents.` |
| two records, different versions | 1 | `skills/: every module record carries one version, stamped together; bmod-ma-ops has '1.0.0', bmod-ma-standards has '0.0.9'` (`validate_manifests.py:221-222`; upstream test `tests/test_validate_manifests.py:251`) |
| member without `bmod.toml` | 1 | `skills/sre-check-system-status: missing bmod.toml` (`:70`) |
| record folder not named after its code (`bmod-mastandards`) | 1 | `skills/bmod-mastandards/bmod.toml: a module record folder is named 'bmod-ma-standards' after its code; this one is 'bmod-mastandards'` (+4 follow-on membership errors) (`:211-212`) |
| member named `bmad-foo` | 0 | `bmod files valid: 6 skills, 2 module records, 2 knowledge documents.` |

The validator accepts non-prefixed names and the agent/roster shape (`roster.toml` member `ma-agent-sre` with `skill`), and accepts a `bmad-` member: FR287 is ours to enforce (37.5).

**PASS** — Re-run at GA: yes

## AC7 — Q6: `github:` update source online and offline

Evidence: [RUN], [READ]

(a) Online.
- Private scratch repository (`<S>/p3`, AC3): `ma-ops` → `could-not-check`, HTTP 404 (raw.githubusercontent.com does not serve private repositories without a token; `setup.py:1945-1958` sends none). No `install` offer.
- Public repository (tea, AC12): `<S>/p12-tea-v4.0.1` → `{"state": "current", "source_version": "4.0.1"}`; `<S>/p12-tea-v4.0.0` → `pinned` with the `install` command `npx skills add bmad-code-org/bmad-method-test-architecture-enterprise#v4.0.1 --skill …` built by `install_command()` (`setup.py:1060-1066`, `github:` only). `setup.py` appends `/<folder>/bmod.toml` to the source path on `main` (`setup.py:1916-1942`) and fetches with `timeout=10` (`:1958`); docs: `docs/reference/module-files.md:41` ("Update checks read `bmod.toml` from the `main` branch").
- Upstream records at the pin: online, `core-tools` and `method` report `could-not-check` (`HTTP Error 404` for `https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/skills/bmod-core-tools/bmod.toml`, `<S>/p13`), because upstream `main` moved the records under `skills/<module>/` (commit `3cf35b6`, AC1). Every project installed from the pinned commit shows `could-not-check` for core and method until the pin moves.

(b) `--network none` (`<S>/scripts/ac7b-offline.sh` in `spike361-n22`, runtime env of AC11):

```
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root /work/<p> --skill /work/<p>/.claude/skills/bmad --root /work/<p>/.claude/skills --status
```

| Project | Exit | Wall | States |
|---|---|---|---|
| `p3` (core-tools, method, ma-ops) | 0 | 5.7 s | all `could-not-check` (`<urlopen error [Errno -3] Temporary failure in name resolution>`); `current: true`, `next: null` |
| `p12-tea-v4.0.0` (core-tools, method, tea) | 0 | 6.8 s | all `could-not-check`; `current: true` |
| `p12-tea-v4.0.0`, black-hole network (`spike361-n22fw`, `--cap-add NET_ADMIN`, `iptables -P OUTPUT DROP` except `lo`) | 0 | 8.8 s | 3 × `could-not-check` |

`could-not-check` counts as settled (`setup.py:1775`), so the command neither fails nor reports the install stale. Checks run sequentially (`setup.py:1728`), one per module; a host whose DNS or proxy accepts and stalls can take up to the 10 s timeout per module (8 modules in a full 4.x install).

Update path: `setup.py` spawns no process (no `subprocess` import; `npx skills …` appears only as text, `setup.py:1066`, `:1077`, `:1098`). The `bmad` agent runs `npx skills update -p -y` only for `newer-available` modules (`skills/bmad/references/setup.md:37`), which never occurs offline. Run anyway in `--network none` on `p12-tea-v4.0.0`:
- `node /work/skills-cli/bin/cli.mjs update -p -y` → exit 1, 4.2 s, `✗ Failed to check for deleted skills from bmad-code-org/bmad-method-test-architecture-enterprise` / `Failed to update 10 skill(s)`; lock `ref` stays `v4.0.0`, no files changed.
- `npx -y skills update -p -y` (empty npm cache) → exit 1 after 70.6 s, `npm error code EAI_AGAIN … request to https://registry.npmjs.org/skills failed`.

(c) `<S>/fixtures/ac6-pos` (record `update_source` and every member `source` = `github:mayafit/ma-bmad-extensions/skills`) → `validate_manifests.py` exit 0 (AC6 row 1). Negative: `fixtures/ac7c-mismatch` with `code-review` `source = "file:../skills"` → exit 1, `skills/code-review/bmod.toml: [skill] source 'file:../skills' differs from skills/bmod-ma-standards/bmod.toml update_source 'github:mayafit/ma-bmad-extensions/skills'` (`validate_manifests.py:243-244`; `docs/reference/module-files.md:65`).

FR297 rule evidence: the `github:` source works as specified offline (`could-not-check`, exit 0). Two parts of the rule's surroundings are contradicted: the online state is usable only for a public repository; and the upstream `required_skills` source `github:bmad-code-org/BMAD-METHOD/skills` (P5-11.2, FR302) no longer resolves on upstream `main` (tea v4.0.1 already declares `github:bmad-code-org/BMAD-METHOD/skills/core-tools`, AC12).

**PASS** — Re-run at GA: yes

## AC8 — Q7: Sofia store override naming a non-shipped store

Evidence: [RUN] (script), agent-performed [RUN] (STORE and BOARD activations: no CLI exists for these; the activations below are performed by the spike agent acting as Sofia from the rendered skill, not scripted).

Project `<S>/p8`: `CLI add <S>/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code`; `setup.py` (exit 0). Project file `_bmad/custom/ticketing-store-config.toml`: `description`; `[tickets] store = "jira-onprem"`, `key = "SPIKE"`, `site = "https://jira.spike.invalid"`, `mcp_server = ""`, `access`, `fields`, `reference`; `[verbs] setup / write / query` (texts prefixed `JIRA-ONPREM-SETUP`, `-WRITE`, `-QUERY`, REST v2 calls with ambient credentials) plus the F29 verb names `create`, `transition`, `assign`, `link`; `[tickets.types]` (initiative `""`, Epic, Story, Task, Bug); `[tickets.status]` (To Do, In Progress, In Review, Done, Done).

| Command (`RS` = `uv run --no-cache .claude/skills/bmad-agent-po/scripts/read_store.py --project-root <S>/p8`) | Exit | Output |
|---|---|---|
| `RS` | 0 | merged config; `json == tomllib.load(project file)` → `True` (no `jira-onprem-ticketing.toml` starter exists, so the project file is used whole: `read_store.py:47-58`, store name from `[tickets]` `:50-51`) |
| `RS -k tickets.store` | 0 | `jira-onprem` |
| `RS -k verbs.query` | 0 | `JIRA-ONPREM-QUERY: GET <site>/rest/api/2/issue/<id>; …` |
| `RS --starters` | 0 | `github, jira, linear, notion, repo, trello` |
| `tickets.py --project-root <S>/p8 next backlog` | 2 | `{"error": "store is jira-onprem: sync ticket status from the tracker first, then rerun with --synced"}` (`tickets.py:1001-1002`) — the custom name is treated as a tracker store |
| `tickets.py … next backlog --synced` | 0 | `{"store": "jira-onprem", "folder": "backlog", …}` |

Agent transcript excerpt (Sofia rendered with `uv run --no-cache _bmad/scripts/render_skill.py --project-root <S>/p8 --skill <S>/p8/.claude/skills/bmad-agent-po`, exit 0; dispatch `STORE` → `references/store-setup.md`, `BOARD` → `references/board.md`; verb table `setup | write | query`):

```
User: Sofia, set up the ticket store: we use our own on-prem Jira config.
Sofia (STORE, store-setup.md:9): ran read_store.py --starters → github, jira, linear, notion, repo, trello. Your
  store "jira-onprem" has no starter, so per :10 "the user's own config goes in whole": it stays as
  _bmad/custom/ticketing-store-config.toml, not cut down to a starter's fields.
Sofia (:11 Connect): read_store.py -k verbs.setup → "JIRA-ONPREM-SETUP: GET <site>/rest/api/2/myself …".
  Following your setup verb: GET https://jira.spike.invalid/rest/api/2/myself → curl: (6) Could not resolve
  host. Per board.md:74 I stop: the store call fails on name resolution; confirm the site and your credentials.
User: Sofia, what's on the board for the backlog?
Sofia (BOARD, board.md:14 "With a tracker, sync first"): first verb this session → read_store.py -k tickets
  (store jira-onprem, key SPIKE, site https://jira.spike.invalid). read_store.py -k verbs.query →
  "JIRA-ONPREM-QUERY: … GET <site>/rest/api/2/search?jql=…". Ran
  curl "https://jira.spike.invalid/rest/api/2/search?jql=project=SPIKE" → exit 6 (could not resolve host).
  tickets.py next backlog refuses until synced (exit 2); I report the blocked sync instead of a board view.
```

Both activations select the project's own verbs; neither consults the shipped `jira` starter. "Bring their own config file or url" (`references/store-setup.md:9-10`) is expressed on disk as the whole file at `_bmad/custom/ticketing-store-config.toml`; a URL is fetched by the agent into that file (no script reads a URL).

Verb-name finding: every shipped starter (`config/*-ticketing.toml`) and Sofia's verb table use exactly `setup`, `write`, `query`; transitions, assignment and links are parts of `write`. The extra F29 verbs `create`, `transition`, `assign`, `link` are returned by `read_store.py` but nothing in the rendered skill names them.

**PASS** — Re-run at GA: yes

## AC9 — Q8: `migrate_v6.py` and `bmad migrate method` on a copy of this repository

Evidence: [RUN] (script), agent-performed [RUN] (`bmad migrate method`).

Input: `<S>/p9` = git repo with `_bmad/` and `_bmad-output/` copied, commit `3c61bcd` (356 files). This worktree has no `_bmad/` (git-ignored); `_bmad/` is copied from the main checkout `D:\Code\AI_Agents\_bmad\` (18 files: `_config/`, `bmm/`, `core/`, `custom/`, `ma-skills/`, `scripts/`, `config.toml`, `config.user.toml`); `_bmad-output/` from `D:\Code\AI_Agents-36-1\_bmad-output\`. Then `CLI add <S>/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code` (commit `5cb85ba`).

(a) `uv run --no-cache <S>/p9/.claude/skills/bmad/scripts/migrate_v6.py --project-root <S>/p9 --skill <S>/p9/.claude/skills/bmad --root <S>/p9/.claude/skills` (no `--clean`; `migrate_v6.py:1025` is the only writer flag) → exit 0, nothing written:

```
legacy_leftovers: _config/manifest.yaml, _config/files-manifest.csv, _config/skill-manifest.csv, _config/bmad-help.csv,
  config.user.toml, core/config.yaml, core/module-help.csv, bmm/config.yaml, bmm/module-help.csv
stale_config_keys: _bmad/config.toml core.document_output_language, modules.bmm.planning_artifacts,
  modules.bmm.implementation_artifacts, modules.bmm.project_knowledge
unused_customizations: []   notes: []
```

The v6 file and keys match `LEGACY_LEFTOVERS` (`migrate_v6.py:62-74`) and `V6_KEYS` (`:76-84`); `user_name`/`communication_language` live in the leftover `_bmad/config.user.toml`. Not reported and therefore never cleaned: `_bmad/ma-skills/config.yaml` and `_bmad/ma-skills/module-help.csv` (the 3.x module). Then `setup.py` (exit 0, `status repaired`) replaced the three v6 `_bmad/scripts/*.py` and added the v7 ones (commit `6e5b366`); `knowledge.py` lists `method` `migration-1.toml` (6 → 7) and `migration-2.toml` (7 preview → 7).

(b) `bmad migrate method` — agent-performed. The spike agent reads `skills/bmad/references/migrate.md` (Find, Match, Follow, Verify) and `skills/bmod-method/migration-1.toml` and applies its guide; the file moves and the id mapping are mechanised by an agent-authored helper `<S>/scripts/ac9_migrate_method.py` (not an upstream script), run in Linux (`<S>/scripts/ac9-run.sh` in `spike361-n22`) because on the Windows host the backup copy fails with `[WinError 3] The system cannot find the path specified` on the files whose paths exceed MAX_PATH under `<S>`. Agent decisions: Match — `detect` signal 1 present (`epics.md` and `sprint-status.yaml`); questions answered with their defaults (folders confirmed, `workspace` = No, fold unstarted story files = yes); plan approval given by the spike operator on the scratch copy; `### Story N.M — title` (16, Epics 20 and 22) and `- **N.M** title` (24, Epics 36–39) are read as story headings beside the literal `### Story N.M:` form (143). Decisive steps: backup `.v6-v7-migration-backup-20261114-2059/` (file count equal), `git mv planning-artifacts initiative-ai-agents` + 23 flat documents into folders (`prd.md` → `prd-ai-agents/prd-ai-agents.md`; `architecture.md` → `architecture-doc/` because `architecture/` exists), `tickets/tickets.toml` with 36 `[[epic]]`, 237 `[[entry]]` with `v6_key`, 201 plans, 13 unstarted story files folded to `archive-v6/`, 3 older records archived, `sprint-status.yaml` and `epics.md` to `archive-v6/` unchanged, 41 bug records to `backlog/` as `bug-<slug>-plan.md` beside fresh `bug-<slug>.md` tickets, `active_initiative = "initiative-ai-agents"` in `_bmad/custom/config.user.toml`, plan `migration-v6-v7/migration-v6-v7.md` (`status: done`). Commits `c4db463`, `9a3b1d8`, `c60a03b`, `3c47f8e` + two correction commits. Simplifications (not done by the helper; a full agent run does them): Requirements/`covers` lines from the PRD coverage map, frontmatter on moved documents, path rewrites.

Id mapping of our keys (story-entry rule `migration-1.toml:129`, `id = M`; story-file rule `:133`, `<N>-<M>-<slug>.md`):
- `36-1-gate-spike-v7-pinned-sha` → epic `epic-v7-gate-pin-prove-offline-qualify-phase-5`, id 1 (from the bullet `- **36.1**`; under the literal `### Story N.M:` rule Epic 36 has no headings and the key takes the next unused id, also 1).
- `bug-*` (25 tracking keys, 41 files) → `backlog/bug-<slug>.md` + `bug-<slug>-plan.md` (target tree `:37`); no epic.
- Strict-rule id shifts (epics with no `## Epic N:` heading in `epics.md`: 24, 30, 32): `24-6/7/8/10/11/12` → ids 5/6/7/8/9/10; `30-6a`, `30-6b`, `30-7`, `30-8`, `30-9` → ids 6, 7, 8, 9, 10 (letters lost, later ids shifted). Epic slugs for them are invented (`epic-24-untitled`); Epics 32–35 live in `epics-archive-2026-11-07.md`, Epic 24 and 30 in no epics file.

Collisions (same (epic, id) or same plan stem) — reported to the PO and handed to 37.3 `migrate_v6_backlog.py`:
- Distinct files on one (epic, id): `15-8-validate-migrated-agents-and-workflows.md` vs `done/15-8-validation-report.md`; `done/16-4-validate-cross-repo-path-resolution.md` vs `16-4-validation-report.md` vs `done/16-4-validation-report.md` (the last two also collide on the plan stem `story-validation-report-plan.md`). The guide merges all records of one `<N>-<M>` into one plan (`:133`), so a validation report becomes "the newest build record" of a story.
- Tracking key slug ≠ build-record slug on one (epic, id) (same story renamed; joins by (N, M), `v6_key` keeps the tracking slug): 16-1, 16-2, 17-22, 28-1, 28-2, 28-3, 28-4, 30-3, 30-6a, 30-6b, 30-7, 30-8, 30-9, 31-10, 31-14, 31-15.
- Two-digit epics: no pair of keys or files share the digit string `N‖M` (e.g. `3-21` vs `32-1`); none found.

Tracking file: `sprint-status.yaml` has only `development_status:` (202 keys: 25 epic, 17 retrospective, 131 story, 25 bug, 4 other) — no `backlog:` or `sprints:` section exists (also none in `D:\Code\EltEye\_bmad-output\implementation-artifacts\sprint-status.yaml`). It is archived byte-identical (`cmp` against `3c61bcd`), per `:151`. The 37.3 `detect` ("contains a `backlog:` or `sprints:` key") does not fire on this project.

Counts: 131 tracking story keys, 131 joined to an entry by `v6_key`, 0 missing. Status mapping: `done→done 99`, `review→review 2`, `in-progress→in-progress 1`, `ready-for-dev→planned 8`, `backlog→planned 9`, `cancelled→backlog 11`, `cancelled→planned 1`. The status table (`:137-147`) has no row for `cancelled`, `wont-fix` or `optional`; cancelled stories come back as open work unless the agent asks. Not migrated by the helper and listed as left in place: 4 standalone keys (`rename-sqa-persona-gad-to-gadi`, `custom-source-registry-index-format`, `custom-source-log-diagnostics-and-best-effort`, `ds-1-design-studio-module-disposition-gds-wds`) and 32 other files under `implementation-artifacts/` (reports, prompts, `epic-runs/`, retrospectives).

`tickets.py` (`uv run --no-cache _bmad/method/scripts/tickets.py --project-root /work/p9 status <folder>`, the checklist item `:209`): `initiative-ai-agents` → exit 0, `{"total": 237, "done": 185, "backlog": 13, "planned": 36, "review": 2, "in-progress": 1}`; `backlog` → exit 1 on the first pass (`backlog/bug-agent-flag-does-not-actually-scope-install.md: status 'review' is not one of draft, …` — a moved v6 bug file keeps its v6 `status:`), exit 1 again after the record became a plan (`frontmatter is not valid YAML` — the helper's quoting), exit 0 after both corrections: `{"total": 41, "backlog": 24, "review": 5, "done": 12}`. No artefact lost (backup complete; tracking sources archived unchanged).

**PASS** — both ran to completion; collisions, the unmapped `cancelled` status and the absent `backlog:`/`sprints:` sections go to the PO — Re-run at GA: yes

## AC10 — Q9: `customize.toml` keys on every bind target

Evidence: [READ] (`python -I <S>/scripts/ac10_matrix.py <S>/BMAD-METHOD/skills`, `tomllib` over `skills/<name>/customize.toml`; line = first definition), [RUN]

| Target | on_complete | external_handoffs | external_sources | persistent_facts | activation_steps_prepend / append | board_after | store_after |
|---|---|---|---|---|---|---|---|
| bmad-prd | [workflow]:38 | [workflow]:127 | [workflow]:108 | [workflow]:33 | [workflow]:16 / :20 | – | – |
| bmad-architecture | [workflow]:37 | [workflow]:81 | [workflow]:75 | [workflow]:33 | :16 / :20 | – | – |
| bmad-ux | [workflow]:20 | [workflow]:94 | [workflow]:89 | [workflow]:17 | :12 / :13 | – | – |
| bmad-product-brief | [workflow]:38 | [workflow]:100 | [workflow]:85 | [workflow]:33 | :16 / :20 | – | – |
| bmad-prfaq | [workflow]:39 | – | – | [workflow]:33 | :15 / :21 | – | – |
| bmad-facilitate | [workflow]:39 | [workflow]:36 | [workflow]:24 | [workflow]:20 | :14 / :17 | – | – |
| bmad-build | [workflow]:49 | – | – | [workflow]:27 | :17 / :21 | – | – |
| bmad-build-auto | [workflow]:49 | – | – | [workflow]:27 | :17 / :21 | – | – |
| bmad-code-review | [workflow]:39 | – | – | [workflow]:33 | :15 / :21 | – | – |
| bmad-retrospective | [workflow]:39 | – | – | [workflow]:33 | :15 / :21 | – | – |
| bmad-agent-po | – | – | – | [agent]:21 | [agent]:15 / :18 | [workflow]:91 | [workflow]:103 |

Every slot of the FR290 bind target table exists at the pin. No change-set item for absent slots.

[RUN] unknown key (`<S>/p4-a`): `_bmad/custom/bmad-build.toml` = `[workflow] ma_unknown_key = "SPIKE-UNKNOWN-KEY-SENTINEL"` + `activation_steps_prepend = ["SPIKE-PREPEND-SENTINEL: …"]`.
- `uv run --no-cache _bmad/scripts/resolve_customization.py --skill <…>/bmad-build --project-root <S>/p4-a --key workflow.ma_unknown_key --key workflow.activation_steps_prepend` → exit 0, returns both values.
- `uv run --no-cache _bmad/scripts/render_skill.py --project-root <S>/p4-a --skill <…>/bmad-build` → exit 1, `HALT: …\_bmad\custom\bmad-build.toml sets keys bmad-build does not declare: workflow.ma_unknown_key` (`skills/bmad/scripts/render_skill.py:121-128`, "a stale or misspelled key halts").
- Same file without the unknown key → exit 0; line 42 of the rendered workflow is `- SPIKE-PREPEND-SENTINEL: read the ticket's Confluence page` (`bmad-build/workflow.md:43` `{{ workflow.activation_steps_prepend }}`).

The resolver passes unknown keys through; the skill does not ignore them — it refuses to activate. A bound slot that upstream removes at a later commit turns into a HALT of the target skill.

**PASS** — Re-run at GA: yes

## AC11 — Q10: `render_skill.py` offline with `--no-cache`

Evidence: [RUN] — project `/work/p11` prepared online in `spike361-n22` (`<S>/scripts/ac11-prep.sh`, `ac11-setup.sh`: `uv python install 3.11` into `/work/runtime/python`; `node /work/skills-cli/bin/cli.mjs add /work/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code --copy`; `setup.py` → `status created`). Warm cache prepared online: `UV_CACHE_DIR=/work/uvcache uv run _bmad/scripts/render_skill.py …` (exit 0, 1.7 MB). Wheelhouse: `jinja2-3.1.6-py3-none-any.whl`, `markupsafe-3.0.4-cp311-cp311-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl`. Runs: `docker run --network none … spike361-n22 bash /work/scripts/ac11-run.sh <case>`; command `uv run [--no-cache] _bmad/scripts/render_skill.py --project-root /work/p11 --skill /work/p11/.claude/skills/bmad-build`; base env `UV_PYTHON_INSTALL_DIR=/work/runtime/python UV_PYTHON_PREFERENCE=only-managed UV_PYTHON_DOWNLOADS=never UV_OFFLINE=1`.

| Case | Extra env | Exit | Wall | Decisive output |
|---|---|---|---|---|
| seeded | `UV_FIND_LINKS=/work/runtime/wheelhouse UV_NO_CACHE=1`, `--no-cache` | **0** | 4.1 s | `Installed 2 packages in 6ms` / `# Build New Preview Workflow` … `Read fully and follow: /work/p11/_bmad/render/bmad-build/…/step-01-clarify-and-route.md` |
| control 1: no `UV_FIND_LINKS` | `UV_NO_CACHE=1`, `--no-cache` | 1 | 0.9 s | `error: No solution found when resolving script dependencies` / `cause: Because jinja2 was not found in the cache and you require jinja2>=3.1, we can conclude that your requirements are unsatisfiable.` / `hint: Packages were unavailable because the network was disabled.` |
| control 2: warm cache, no wheelhouse | `UV_CACHE_DIR=/work/uvcache`, `--no-cache` | 1 | 1.0 s | same error |
| control 2b: warm cache without `--no-cache` | `UV_CACHE_DIR=/work/uvcache` | 0 | 3.7 s | renders (proves the cache is warm, so control 2 fails because of `--no-cache`) |

`uv.toml` route (FR282 / 39.2 write the settings to a file selected by `UV_CONFIG_FILE`), `<S>/scripts/ac11-uvtoml.sh`:
- With `python-install-dir = "/work/runtime/python"` in `uv.toml` → exit 2, `error: Failed to parse: /work/runtime/uv.toml … unknown field 'python-install-dir', expected one of 'required-version', …` (uv 0.13.8 has no such setting; the install dir is environment-only).
- `uv.toml` = `python-preference = "only-managed"`, `python-downloads = "never"`, `find-links = ["/work/runtime/wheelhouse"]`, `offline = true`, `no-cache = true`, plus env `UV_PYTHON_INSTALL_DIR` → exit 0 (10.4 s); same file without the env var → exit 2, `error: No interpreter found for Python >=3.11 in virtual environments or managed installations`.

Env-only seeding works; the file-only route needs `UV_PYTHON_INSTALL_DIR` in the activation environment (or the runtime placed where uv looks by default). Other PEP 723 dependencies at the pin: `bmad-agent-po/scripts/tickets.py` declares `pyyaml>=6.0.2,<7`; upstream `main` adds PyYAML to `memlog.py` (`c67a00d`).

**PASS** — Re-run at GA: yes

## AC12 — Q11: `tea` / `cis` tags that carry v7 module records

Evidence: [RUN], [READ] (`gh api repos/<repo>/contents/skills/bmod-<code>/bmod.toml?ref=<tag>`)

`bmad-method-test-architecture-enterprise` (public): tags with `skills/bmod-tea/bmod.toml`: v3.4.0 … v4.0.1. Newest: **v4.0.1**, `version = "4.0.1"`, `required_skills = [{ skill = "bmad", version = "6.13.0-next", source = "github:bmad-code-org/BMAD-METHOD/skills/core-tools" }]` (v4.0.0 and earlier: `…/skills`). `<S>/p12-tea-v4.0.1`: core from the local pin, then `CLI add bmad-code-org/bmad-method-test-architecture-enterprise#v4.0.1 --skill bmod-tea --skill bmad-tea --skill bmad-tea-teach-me-testing --skill bmad-tea-automate --skill bmad-tea-evaluate --skill bmad-tea-framework --skill bmad-tea-nfr --skill bmad-tea-test-design --skill bmad-tea-test-review --skill bmad-tea-trace -y --agent claude-code` → exit 0; `--list-config-questions` → 13 questions, answered with their defaults (`<S>/scripts/defaults_to_answers.py`); `setup.py --module-answers` → exit 0; `setup.py --module tea` → exit 0, `tea 4.0.1 scripts current`, `unmet_requirements: []`, `problems: []`; `--status` → `current`. The `…/skills/core-tools` source does not exist at the pin and setup does not object (the requirement is met by the installed `bmad` 6.13.0-next).

`bmad-module-creative-intelligence-suite` (public): none of the 15 tags (v0.1.0 … v0.3.2) has `skills/bmod-cis/bmod.toml`; `main` (`658e710`, 2026-09-21) has a record `version = "0.4.0-next"`, untagged.

Inputs to 36.3: `bmadRef.tea = v4.0.1`; `bmadRef.cis` = none (bundle omits cis; the manifest records the omission).

**FALLBACK** (cis: no tag carries a v7 record; tea PASS at v4.0.1) — Re-run at GA: yes

## AC13 — Q12: `.agents/skills` and `skills-lock.json` collision with an ma-agents 3.18.1 install

Evidence: [RUN] — `<S>/p13` = `git archive HEAD .agents | tar -x` of this worktree (135 entries incl. `.ma-agents.json`, `MANIFEST.yaml`), committed; sha256 of every file recorded before (`logs/ac13-before.sha`). `CLI add <S>/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po --skill bmad-code-review -y --agent github-copilot` (target `.agents/skills`) → exit 0.

- `.ma-agents.json` and `MANIFEST.yaml`: unchanged (`git diff --quiet HEAD -- …` true). No ma-agents-owned skill folder (`add-sprint`, `ai-audit-trail`, …) touched.
- A 3.x folder with the same name as an upstream skill is replaced whole: `bmad-code-review/` loses `steps/step-01…04-*.md` (git status `D`), `SKILL.md`/`customize.toml` rewritten, v7 files added. The plan box prints `overwrites: GitHub Copilot`; `-y` proceeds. This repo's tracked `.agents/skills/` holds 14 folders whose names v7 also ships: `bmad-advanced-elicitation`, `bmad-agent-analyst`, `bmad-agent-architect`, `bmad-agent-dev`, `bmad-agent-pm`, `bmad-agent-ux-designer`, `bmad-brainstorming`, `bmad-code-review`, `bmad-customize`, `bmad-party-mode`, `bmad-prfaq`, `bmad-product-brief`, `bmad-qa-generate-e2e-tests`, `bmad-retrospective`.
- `bmad-dev-epic/` is not in this repo's tracked `.agents/skills/` (it lives in `lib/bmad-extension/skills/` and `lib/bmad-extension-plugin/skills/`).
- `uv run --no-cache .agents/skills/bmad/scripts/setup.py --project-root <S>/p13 --skill <S>/p13/.agents/skills/bmad --root <S>/p13/.agents/skills --status` → exit 0: `problems: []`, `duplicate_skills: []`, `missing_module_records: []`; v6 `bmad-*` folders without `bmod.toml` are counted as installed members by name (`core-tools`: `bmad-advanced-elicitation`, `bmad-brainstorming`, `bmad-customize`, `bmad-party-mode`; `method`: `bmad-agent-analyst`, `…-architect`, `…-dev`, `…-pm`, `…-ux-designer`, `bmad-prfaq`, `bmad-product-brief`, `bmad-qa-generate-e2e-tests`, `bmad-retrospective`); `retired_skills` lists 10 v6 folders (`bmad-help`→`bmad`, `bmad-distillator`, `bmad-index-docs`, `bmad-shard-doc`, `bmad-create-ux-design`→`bmad-ux`, `bmad-agent-tech-writer`, `bmad-check-implementation-readiness`, `bmad-create-epics-and-stories`, `bmad-sprint-planning`, `bmad-correct-course`) for `--remove-retired`; ma-agents skills are not mentioned (ignored); `next: "bmad setup"`.

**PASS** — no silent deletion of ma-agents files; same-name upstream folders are overwritten — Re-run at GA: yes

## AC14 — Q13: upstream instruction-block markers

Evidence: [READ]

- `skills/bmad-project-context/references/template.md` exists at the pin.
- Start marker `<!-- bmad:context -->` at `skills/bmad-project-context/references/template.md:17`; end marker `<!-- /bmad:context -->` at `:52`. Both sit inside the fenced "Worked example" (```` ````markdown ```` opens at `:16`).
- No script writes the block: `skills/bmad-project-context/SKILL.md:72` has the agent "splice between the markers — the splice itself touches nothing outside them". `SKILL.md:37`, `:74` and `:97` also have the agent propose edits to other instruction files (contradictions, duplicates, `CLAUDE.md` reduced to `@AGENTS.md`), each shown to the user first — input to 36.5's six-order simulation and to FR301 (the `ma-agents` block can be proposed for de-duplication).

**PASS** — Re-run at GA: yes

## Verdict

**PASS.** No AC is STOP. AC12 is FALLBACK for cis (tea passes). AC2 passes on Node ≥ 22.20 only; the pinned `OFFLINE_NODE_IMAGE` (Node 20.18.1) cannot run the Skills CLI. Unverified: none — every negative control ran (AC6 three negatives + `bmad-foo`; AC11 two controls + warm-cache proof; AC2 strace positive control). Agent-performed (not scripted): AC8 STORE/BOARD activations; AC9(b) `bmad migrate method` (with the agent-authored helper `ac9_migrate_method.py`).

## GO lines

- **GO-37.1: GO** — AC2 PASS, AC4 PASS, AC6 PASS.
- **GO-37.2: GO** — AC2 PASS, AC4 PASS, AC5 PASS, AC6 PASS.
- **GO-36.3: GO / GO-36.4: GO / GO-36.5: GO** — AC1 PASS, AC10 PASS, AC11 PASS; 36.5 also AC14 PASS.
- **GO-38: GO** — AC8 PASS, AC10 PASS.
- **GO-39: GO** — AC2 offline PASS, AC5 PASS, AC7 PASS, AC11 PASS, AC13 PASS.

## Change set handed to

- **36.2** — Base image: Node ≥ 22.20 (`node:22-bookworm` digest above), not `node:20.18.1-bookworm`. The `uv.toml` route cannot carry `python-install-dir` (uv 0.13.8 rejects the key); prove the file route as `uv.toml` + `UV_PYTHON_INSTALL_DIR` in the activation environment, or place the runtime in uv's default managed-Python directory. Wheelhouse at the pin: `jinja2`, `markupsafe` (platform wheels; linux tag `cp311-manylinux2014_x86_64`) and `pyyaml` (`tickets.py`); upstream `main` adds PyYAML to `memlog.py`.
- **36.3** — `bmadRef.skillsCli = 1.7.6` ships with its runtime dependencies (`tar`, `yaml`, 7 packages): bundle an `npm install --omit=dev --ignore-scripts` tree or a re-packed tarball, and record its SHA-256. `bmadRef.tea = v4.0.1`; `bmadRef.cis` = none, omission recorded. `engines.node >=20.12.0` (FR298) is below the Skills CLI floor `>=22.20.0`; the installer floor becomes 22.20 or the installer checks the floor before step 3.
- **36.4** — The validator must fail on any key a target's `customize.toml` does not declare: `render_skill.py:121-128` halts the target skill on it, while `resolve_customization.py` returns it. All FR290 slots exist at the pin; the validator re-checks them per `bmadRef.core` (upstream `bmad-facilitate` changed on `main`, `a867e16`).
- **36.5** — Markers from `skills/bmad-project-context/references/template.md:17` / `:52` (inside a fenced example). The upstream writer is an agent, not a script; the simulation models a splice that touches nothing outside the markers, and records that the agent may propose (with approval) to de-duplicate instructions in other blocks (`SKILL.md:97`).
- **36.6** — `OFFLINE_NODE_IMAGE` moves to a Node ≥ 22.20 digest.
- **36.7** — Re-run AC2–AC14 on the GA tag with the commands above; expect the upstream layout change (`3cf35b6`: `skills/<module>/…`, `update_source = github:bmad-code-org/BMAD-METHOD/skills/<module>`), which changes the bundle layout, every `required_skills` source and the local-add path; re-read the bind table after `a867e16`.
- **Epic 37** — 37.1: `ma-bmad-extensions` must be a **public** GitHub repository, or `setup.py --status` reports `could-not-check` online (HTTP 404) and never `current`/`pinned`; the NFR84 "reports it `current`" gate needs it. The installer passes every member with `--skill` (the record alone pulls no members; no `--skill` installs every module). FR287 is enforced by our own check (the upstream validator accepts `bmad-foo`). `required_skills` source for `bmad`: `github:bmad-code-org/BMAD-METHOD/skills` at the pin, `…/skills/core-tools` after `3cf35b6` — tie it to `bmadRef.core`. 37.3 (`migrate_v6_backlog.py` / `bmod-ma-ops/migration-1.toml`): this project's tracking file has no `backlog:`/`sprints:` section, so the `detect` does not fire here — confirm which 3.x projects carry them before building on that shape; handle the AC9 collisions (validation reports named `<N>-<M>-validation-report.md` merged into story plans; tracking/file slug renames), the strict-rule id shifts for epics without a `## Epic N:` heading (24, 30, 32; `30-6a`/`30-6b` lose letters), the unmapped `cancelled`/`wont-fix`/`optional` statuses, moved v6 bug files whose `status: review` makes `tickets.py` exit 1, the 4 standalone non-`N-M` keys, and `_bmad/ma-skills/` (not reported by `migrate_v6.py`). Windows: backup copies of this repo exceed MAX_PATH under deep project roots.
- **Epic 38** — FR289 / 38.2 store file: Sofia's verbs are `setup`, `write`, `query` (all shipped starters; `write` covers create, transition, assign, link); the F29 verb list `setup, create, transition, query, assign, link` changes to those three, each with a REST and an MCP form. A store with no starter is read from `_bmad/custom/ticketing-store-config.toml` alone, so bind writes the whole starter there (as specified). `tickets.py next` refuses a tracker store without `--synced`; 37.3's `ma-ops-dev-epic` syncs first. 38.3: never write an undeclared key (HALT, AC10).
- **Epic 39** — 39.2: the Skills CLI run needs Node ≥ 22.20 and its bundled dependencies; opt-outs `DISABLE_TELEMETRY=1` and `DO_NOT_TRACK=1` (no attempt observed for a local source with or without them); pass `--agent <tool>` and stdin closed; do not write `python-install-dir` to `uv.toml` (rejected) — export `UV_PYTHON_INSTALL_DIR` for activations too (the `ma-agents` block names it beside `UV_CONFIG_FILE`). `update` never calls `npx skills update` offline (exit 1 after 70.6 s on `EAI_AGAIN`). 39.3: the Skills CLI replaces same-named 3.x `bmad-*` folders under `.agents/skills/` whole and leaves `.ma-agents.json`, `MANIFEST.yaml` and ma-agents skills alone; `setup.py --status` counts leftover v6 `bmad-*` folders as module members and lists 10 retired v6 skills — uninstall the 3.x `bmad-*` folders (14 share a v7 name) before `add`, and remove `_bmad/ma-skills/`. 39.5: offline `setup.py --status` on a black-holed network took 8.8 s for 3 modules (sequential, ≤ 10 s each).
- **PO / PRD (FR283, FR297, FR298, FR289, FR302)** — Node floor 22.20 instead of 20.12; `ma-bmad-extensions` public; FR289 verb names; the `required_skills` source path moves with upstream's layout; AC9 collisions and the `cancelled` mapping.

## Appendix A — `<S>/scripts/mkfixture.py`

```python
"""usage: python -I mkfixture.py <out-dir> <update_source> <version> [--questions] [--neg <case>]
neg cases: versions | no-member-bmod | folder-name | bmad-prefix"""
import argparse, shutil
from pathlib import Path
BMAD_REQ = '{ skill = "bmad", version = "6.13.0", source = "github:bmad-code-org/BMAD-METHOD/skills" }'
PO_REQ = '{ skill = "bmad-agent-po", source = "github:bmad-code-org/BMAD-METHOD/skills" }'
BUILD_REQ = '{ skill = "bmad-build", source = "github:bmad-code-org/BMAD-METHOD/skills" }'
MODULES = {"ma-ops": ["ma-agent-sre", "sre-check-system-status", "ma-ops-dev-epic"],
           "ma-standards": ["git-workflow-skill", "code-review"]}
def w(p, t): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(t, encoding="utf-8", newline="\n")
ap = argparse.ArgumentParser(); ap.add_argument("out", type=Path); ap.add_argument("source"); ap.add_argument("version")
ap.add_argument("--questions", action="store_true"); ap.add_argument("--neg"); a = ap.parse_args()
if a.out.exists(): shutil.rmtree(a.out)
skills = a.out / "skills"; modules = {k: list(v) for k, v in MODULES.items()}
if a.neg == "bmad-prefix": modules["ma-ops"].append("bmad-foo")
for code, members in modules.items():
    folder = "bmod-mastandards" if (a.neg == "folder-name" and code == "ma-standards") else f"bmod-{code}"
    version = "0.0.9" if (a.neg == "versions" and code == "ma-standards") else a.version
    req = [BMAD_REQ] + ([PO_REQ, BUILD_REQ] if code == "ma-ops" else [])
    rec = (f'[bmod]\ncode = "{code}"\nversion = "{version}"\nupdate_source = "{a.source}"\n'
           "skills = [" + ", ".join(f'"{m}"' for m in members) + "]\n"
           "required_skills = [" + ", ".join(req) + "]\n" f'pre_install_message = ""\npost_install_message = "{code} is ready."\n')
    if a.questions and code == "ma-ops":
        rec += ('\n[[bmod.config_questions]]\nkey = "ops_team_channel"\nprompt = "Which team channel receives ops reports?"\ndefault = "#ops"\n'
                '\n[[bmod.config_questions]]\nkey = "ops_user_handle"\nprompt = "Your personal on-call handle?"\ndefault = ""\nscope = "user"\n')
    w(skills / folder / "bmod.toml", rec)
    w(skills / folder / "SKILL.md", f"---\nname: {folder}\ndescription: Required bmod metadata. Never invoke this skill.\n---\n"
      f"This folder is the {code} module's record. Invoke the `bmad` skill with `setup {code}`.\n")
    w(skills / folder / "help" / "help.md", f"# {code} knowledge\n\n" + "".join(f"- `{m}`: fixture skill {m}; use it for spike testing.\n" for m in members))
    w(skills / folder / "retired.toml", 'renamed = [{ from = "bmad-dev-epic", to = "ma-ops-dev-epic" }]\n' if code == "ma-ops" else "")
    if code == "ma-ops":
        w(skills / folder / "roster.toml", '[[members]]\ncode = "ma-agent-sre"\nskill = "ma-agent-sre"\nname = "Alex"\nicon = "🛠️"\n'
          'title = "Site Reliability Engineer"\npersona = "Keeps systems available. Speaks in SLOs."\n\n'
          '[[groups]]\nid = "ops"\nname = "Ops"\nscene = "An ops review."\nmembers = ["ma-agent-sre"]\nmemory = false\n')
    for m in members:
        w(skills / m / "SKILL.md", f"---\nname: {m}\ndescription: Fixture skill {m} for the 36.1 spike. Use when testing.\n---\n# {m}\n\nFixture body.\n")
        if a.neg == "no-member-bmod" and m == "sre-check-system-status": continue
        member = f'[skill]\nbmod = "bmod-{code}"\nsource = "{a.source}"\n'
        if m == "ma-ops-dev-epic":
            member += 'scripts = ["scripts/migrate_v6_backlog.py"]\n'
            w(skills / m / "scripts" / "migrate_v6_backlog.py", '# /// script\n# requires-python = ">=3.11"\n# ///\nprint("fixture")\n')
        w(skills / m / "bmod.toml", member)
```

## Appendix B — container scripts (verbatim essentials)

- `ac2-offline.sh <label> <optout|telemetry-on>`: `P=/work/p2-$label-$mode; mkdir; git init; [optout: export DISABLE_TELEMETRY=1 DO_NOT_TRACK=1]; strace -f -qq -e trace=connect -o /work/logs/ac2-$label-$mode.strace node /work/skills-cli/bin/cli.mjs add /work/BMAD-METHOD --skill bmad --skill bmod-core-tools --skill bmod-method --skill bmad-build --skill bmad-agent-po -y --agent claude-code cline < /dev/null; grep -cE 'AF_INET6?' <strace>`.
- `ac11-run.sh <seeded|nofl|warmcache|warmcache-cached>`: see the AC11 table; `cd /work/p11; env <envs> uv run [--no-cache] _bmad/scripts/render_skill.py --project-root /work/p11 --skill /work/p11/.claude/skills/bmad-build`, wall time from `date +%s%N`.
- `ac7b-offline.sh`: AC11 seeded env + opt-outs; `strace … uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root $P --skill $P/.claude/skills/bmad --root $P/.claude/skills --status` for `P` in `/work/p3 /work/p12-tea-v4.0.0`; then `node /work/skills-cli/bin/cli.mjs update -p -y` and `timeout 120 npx -y skills update -p -y` in `/work/p12-tea-v4.0.0`.
- `ac7b-blackhole.sh` (`spike361-n22fw`, `--cap-add NET_ADMIN`, default network): `iptables -P OUTPUT DROP; iptables -A OUTPUT -o lo -j ACCEPT; ip6tables -P OUTPUT DROP`, then the `--status` call on `/work/p12-tea-v4.0.0`.
- `ac9-run.sh` (`spike361-n22`, online): `git config --global --add safe.directory '*'`; `python3 -I /work/scripts/ac9_migrate_method.py /work/p9 /work/logs/ac9b-run.json`; `uv run --no-cache _bmad/method/scripts/tickets.py --project-root /work/p9 status initiative-ai-agents` and `… status backlog`. Corrections: `ac9_fix_backlog.py` (each moved v6 bug record → `<slug>-plan.md` with v7 plan frontmatter beside a fresh `bug-<slug>.md` ticket) and `ac9_fix_titles.py` (titles as JSON-quoted YAML strings).
- `ac9_migrate_method.py` rules (agent-authored): source folders from `_bmad/config.toml` (`_bmad-output/planning-artifacts`, `_bmad-output/implementation-artifacts`); backup of `_bmad/` and `_bmad-output/` to `.v6-v7-migration-backup-<YYYYMMDD-HHMM>/` with `.gitignore` `*`; `git mv` planning folder → `initiative-ai-agents/`; each flat `*.md` → `<stem>/<stem>.md`; `## Epic N:` → `[[epic]]` `id = N`, `slug = epic-<kebab title>`; `### Story N.M:` / `### Story N.M — ` / `- **N.M** ` → `[[entry]]` `id = M`, `v6_key` = the tracking key; tracking keys or files without a heading → next unused id in numeric order; build records joined by (N, M): unstarted (`backlog`, `ready-for-dev`, `drafted`, `contexted`) → `archive-v6/`, else newest → `story-<slug>-plan.md` with `ticket`, `type: feature`, mapped `status`, older → `archive-v6/`; tracking keys past backlog with no record → minimal plan; `sprint-status.yaml` and `epics.md` → `archive-v6/` unchanged; `bug-*.md` → `backlog/`; `active_initiative` in `_bmad/custom/config.user.toml`; plan file `migration-v6-v7/migration-v6-v7.md`; one commit per step.
