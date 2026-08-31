# Story 31.14 — Epic 31 Release Gate

**Status:** review
**Branch:** `feature/epic-31-story-31.14`, based on `6bc1877` (`feature/epic-31`)
**Diff under gate:** `9b936ac..HEAD` — 89 files, +38,048 / −239 at the point of assessment
**Prepared by:** the story implementer. **No verdict is claimed here.** An independent
reviewer decides whether this epic ships.

---

## 0. Read this part first

Thirteen stories and two prerequisites merged into Epic 31. Nine of them needed a fix
round. This epic's character is that its independent reviews found real defects, and
several are still open **by design**. A gate that reported everything green would be
wrong, so this one does not.

The three things a reader should take away before anything else:

1. **`npm test` is NOT green, on either platform. No remaining failure is this epic's.**
   *(This item read "one of the failures is this epic's … fails on this branch (153/4)"
   until fix round 5, and was false from `d5dbab5` onward.)*
   `test/story-15-5-workflow-skills.test.js` failed on this branch (153/4) against 157/0
   on `main`; I re-derived that independently. **It was resolved on this branch at commit
   `d5dbab5` and now reads 157/0, matching `main`** — the human authorised the resolution
   §4 recommended, and **the implementation was landed before any independent review saw
   it; it is unreviewed** (§4, §9 item 30). The nine remaining failures are genuinely
   pre-existing and I baselined every one of them against `main @ 9b936ac` rather than
   accepting the claim. **AC9 stays NOT MET on those nine plus "Linux never run"** — the
   chain short-circuits at position 11 — **not on `story-15-5`.**
2. **Every claim in this epic about behaviour with a Confluence MCP *present* is
   mock-verified, not live.** The `claude.ai Atlassian Rovo` connector is unauthorised
   and cannot be authorised from a non-interactive session. The MCP-*absent* branch —
   which is what AC5's fail-loud proof rests on — is the default state here and was
   exercised for real.
3. **Story 31.10's AC1/AC3/AC5 are PARTIALLY MET and escalated to a human.** They
   assert Confluence pages *are created*. No shipped skill's purpose is to publish a
   store, and there is no publish command. Recorded, not resolved, and `epics.md` is
   deliberately unedited.
4. **This record went through four independent review rounds and did not survive any of
   them intact.** Round 1's reviewer found one **false statement** (a defect listed as
   closed that is not — §8) and one **wrong shipping claim** (`CHANGELOG.md` does not ship
   on npm — §7). Across all four rounds the **FR266 check has been defeated six times —
   six independent attacks, six live bypasses**, each demonstrated by planting a mirror
   in a shipped file and watching the suite stay green (37/0, then 38/0, then 40/0). All
   six now fail; a further weak assertion inside the test written to close attack 5 was
   found by mutation in round 3 and repaired. **The sixth needed no evasion at all — the
   check simply never opened shipped non-markdown files, and it was a human reader, not
   any part of this process, who noticed** (§9 item 16). **Every round so far has found at
   least one live bypass, and this document does not claim the sixth was the last** (§9
   items 9, 16, 26). All findings are corrected, and the corrections are recorded as
   corrections rather than quietly folded in. **The gate's product is an honest record, and
   its first draft was not one** — which is the strongest available argument for the review
   step that caught it. §9 items 13–22 are the limits this document did not previously
   admit to, and items 23–29 the limits the later rounds added.

---

## 1. AC-by-AC results

Each entry states the method and, separately, **what the method cannot see.** The
limits are the point: this epic's record shows the confident claims are the ones that
failed.

### AC1 — Air-gap gate (NFR77, NFR80) · **Implemented, NOT executed here**

**What was done.** `.github/scripts/offline-install-verify.sh` gains two phases inside
the same `--network none` container the Epic 22 / NFR50 gate already used, and
`.github/workflows/offline-install.yml` is updated to match (job cap 8 → 14 minutes for
the two extra installs; the summary block names both new phases).

- **Step 7 — two-store, fully `file-system` install.** A two-store binding is committed
  into a fresh project *before* the install, and the install is run `--yes`, because
  FR263 makes `project-layout.yaml` authoritative: the install must **read** it rather
  than re-ask, and that is also what makes the phase runnable non-interactively. The two
  stores are **divergent on purpose** — pointing them at one directory would pass even if
  the reader collapsed them, which is precisely what
  `bug-read-existing-layout-collapses-two-stores-onto-software-store` recorded. Asserts:
  install exits 0; `_bmad/bmm/config.yaml` was generated; both backends resolve
  `file-system`; the two resolved paths are **non-empty and different**; and no
  Confluence configuration appears in either file.
- **Step 8 — global install.** `HOME`/`USERPROFILE` redirected into the container. The
  FR251 absence assertions are **bracketed by presence**: the run must first be shown to
  have genuinely installed (≥1 `SKILL.md` under `$HOME`) before an empty project root is
  allowed to mean anything — an absence assertion that passes because the install crashed
  is worthless, and this epic produced that shape six times. Then asserts that none of
  `project-layout.yaml`, `project-context.md` or `_bmad/bmm/config.yaml` appears under the
  project root. The FR250 spike verdict is **FAIL**, so the degradation path is asserted
  rather than assumed: all three notice facts must be present in the install log.
- Both phases **re-verify the egress block afterwards**, which is what turns "the install
  succeeded" into "the install succeeded with zero network calls".

**What I did close locally, since the container half could not run.** The Step 7 field
reader is not untested shell. It was executed against a **real** `_bmad/bmm/config.yaml`
generated by `cli.js` from a real divergent two-store binding:

```
system_requirements_path: "sysreq"      software_requirements_path: "swreq"
system_requirements_backend: "file-system"   software_requirements_backend: "file-system"
knowledgebase_path: "swreq"             <- FR264: the legacy field resolves to the SOFTWARE store
```

`read_field` returned each field correctly, returned **empty** for a nonexistent field
**without aborting under `set -euo pipefail`**, the distinctness assertion passed, and the
no-Confluence assertion passed. Two latent `pipefail` aborts were found by reading and
fixed in the process (`head -1` handing sed a SIGPIPE; `find | wc -l` on an empty `$HOME`),
and `read_field` was switched from `sed -n 's///p'` to an anchored `grep -E "^field:"` so
a field name that is a prefix of another cannot match loosely.

**Method limits — read these.**

- **The workflow was not run.** It is a GitHub Actions job requiring Docker and
  `--network none`; it cannot execute in this session. I validated the YAML parses
  (`js-yaml`), the shell parses (`bash -n`), and — per above — that the assertion logic
  is correct against real generated output. Every remaining assertion was derived from
  behaviour verified locally: the FR250 notice text is read from `bin/cli.js`'s own
  exported constants, and the field names are the ones `generateBmmConfig` actually
  writes. **None of that is the same as a green run.** The first CI run of this workflow
  is the real evidence and it has not happened.
- Step 8 asserts the FR250 *degradation* path. If a future bmad-method gains a
  user-level install, this phase will fail and must be rewritten — that is intended.

### AC2 — Backward compatibility (NFR76, NFR82) · **Met, within a stated bound**

**Method.** `test/release-gate-epic-31.test.js` §1, four assertions. A pre-F26 fixture
(committed artifacts, a `_bmad/bmm/config.yaml` carrying only the pre-F26 fields, no
binding) and a default-answers fixture (genuinely empty tree, asserted empty first) are
each taken through the F26 write path. The oracle is a **full-tree sha256 snapshot**,
diffed in three directions independently — added, removed, modified — so a delete cannot
pass as "no modification" and a rewrite-in-place cannot pass as "no new file".

- The added set is exactly `['_bmad-output/project-layout.yaml']`. Nothing removed.
  Every pre-existing file byte-identical.
- Resolved artifact paths pinned to their **literal pre-epic values** —
  `planning_artifacts`, `implementation_artifacts`, `knowledgebase_path`,
  `sprint_management_path` — parsed out with `js-yaml`, an outside authority. The
  expected values are stated literally in the test, **not** derived from the generator:
  deriving them would mean a generator that stopped emitting a legacy field changed both
  sides at once and still passed.
- FR265's single-store collapse checked separately: both new per-store fields resolve to
  the one location.

**Method limits.** These tests drive `writeProjectLayoutYaml` + `generateBmmConfig`, not
a full `ma-agents install`. A full install spawns bmad-method, takes minutes, and — as
§4 documents — spawns a real `npm install` against the public registry. The end-to-end
install proof is AC1's harness, which runs the real installer under `--network none`. So
AC2 proves *the F26 additions add exactly one file and change nothing else*; it does not
re-prove the whole installer.

### AC3 — Determinism (NFR81) · **Met on one platform, with a named residual**

**Method.** `test/release-gate-epic-31.test.js` §2, five assertions.

- The same answers render a byte-identical `project-layout.yaml` (AC3.1) and a
  byte-identical generated `config.yaml` (AC3.5).
- CRLF and LF inputs produce identical output, for both the existing binding (AC3.4) and
  the config being updated (AC3.5).
- The emitted binding carries no platform-dependent bytes: no `\r`, and no backslash
  separators on any `path:`/`gitUrl:` line — which matters because the file is
  **committed** and a `C:\...` in it would be unreadable to a Linux teammate (AC3.3).

**The residual, stated rather than assumed away.** `writeProjectLayoutYaml` stamps
`generated: "<YYYY-MM-DD>"` from the wall clock (`bin/cli.js:2626`). Two runs of the same
answers are byte-identical **only within the same calendar day**. `generated:` is not an
answer, so NFR81's "the same answers produce an identical file" is met in substance —
but the bound is asserted rather than waved through: AC3.2 requires `generated:` to be
the **only** line that can vary and requires its format to be **date-only**. Without that
second half, AC3.1 (which strips `generated:`) would still pass if a *second*
nondeterministic line were introduced. cli.js already knows about this: `ma-agents bind`
declines to rewrite the file on a no-edit re-run for exactly this reason
(`bin/cli.js:4914`).

> **Correction — this bound covered ONE answer shape and was written as though it were
> general.** AC3.2 ran only a single-store `mode: 'same'` binding. A two-store or
> Confluence binding emits lines that shape never produces — `space_key:`, `root_page:`, a
> second store block, a divergent `path:` — and a second nondeterministic line in any of
> them would have gone unseen. **AC3.2 now runs four shapes**: the legacy single store,
> two divergent file-system stores (FR257's motivating case), both stores
> Confluence-backed, and the mixed system-in-Confluence case. Each is rendered twice and
> required to agree line for line, and each Confluence shape must actually emit a
> `space_key:` or the extension would be decoration. The claim and the test now match.

**Method limits.** **The cross-platform half was executed on Windows only.** Linux/CI
byte-identity is inferred from the absence of platform-dependent constructs in the
output, not observed. The observation belongs to AC9's Linux run, which has not
happened.

### AC4 — No credentials on disk (NFR79) · **Met**

**Method.** `test/release-gate-epic-31.test.js` §3, five assertions, all by enumeration.

- **The file set is a closed set.** After a Confluence-configured install, the added set
  is exactly the binding and the modified set is exactly the generated config. A dotfile
  cache, a `.confluence-auth`, or an exported page body would appear here as an
  unexpected member — which a denylist over known-bad names would miss.
- **Every written byte is scanned**, over an *enumerated* file list rather than a named
  one, against eight credential shapes (password, token/api-key/secret, bearer, HTTP
  Basic blob, Atlassian `ATATT` token, URL with inline userinfo, cookie, Authorization).
- **AC4.0 is the control**: the sweep is first proved to *detect* four planted
  credentials. Without it, "no credential found" is indistinguishable from "the scanner
  is broken".
- **The confluence record's key set is asserted literally**: exactly
  `{backend, space_key, root_page{title, id}}`. Stated in the test, not read from the
  serializer — the tautology this epic produced six times.
- **AC4.4 covers the OQ-4 write-back** (`recordLearnedRootPageId`), the one route by
  which something could later be written back from Confluence. It creates no file and
  cannot widen `root_page` beyond its identity. The test branches on the returned
  outcome **by name** (`ROOT_ID_RECORDED`), so "recorded" and "refused" can never
  collapse into "did not throw".

**Method limits.** The scan covers files ma-agents writes. It cannot see a credential a
*user* puts in their MCP server configuration, which is correct — NFR79's claim is that
authentication is entirely the MCP server's responsibility.

### AC5 — Fail-loud paths proven, asserting message content (FR262, P5-9.3) · **Met for the MCP-absent path; mock-bounded for MCP-present**

**Where these paths live, because it bounds what "end to end" can mean.** Both are
executed by an **agent reading shipped instruction text** — the runtime for a skill *is*
its markdown. So each is proved in two halves, and neither half alone is the proof.

**The text half** (`test/release-gate-epic-31.test.js` §4, AC5.1–AC5.4), asserted across
**every shipped copy**, not one:

- Confluence-without-MCP names the **affected store**, the **space** (resolved from the
  configured field), the **cause** ("no Confluence MCP was detected"), the **remedy**
  (how to configure one), a **second remedy** (re-bind the store to the file system), and
  the no-side-effect guarantee. Six independent assertions, so dropping one cannot pass
  on the strength of the other five.
- The five explicit **prohibitions** are asserted separately (AC5.2): no fall back to the
  file system, no local copy, no continuing with a partial result, no changing the
  backend on the user's behalf, "has no degraded mode". These are what stop a fail-loud
  path quietly becoming a fall-back path in a later edit.
- **Default-deny is asserted** (AC5.3): an unrecognised backend must reach a third branch
  that halts, and Step B1 must be stated *not* to absorb it. This is the permissive-default
  shape, which this epic shipped once already.
- The stale-config HALT names the cause, **both values for every store that moved**, the
  remedy, the no-side-effect guarantee, and the "compare content, never timestamps"
  prohibition (OQ-2).

**The code half** (AC5.5, AC5.6), driven end to end:

- A project is bound, a config generated, the stamp read and shown to **match** — so the
  drift assertion below proves something. Then a store is moved exactly as a `git pull`
  would move it, and the recomputed stamp is required to **disagree**. That is the
  detection the shipped preflight tells the agent to rely on, exercised for real.
- An unreadable binding (git merge-conflict markers) makes `generateBmmConfig` return
  `false`, print a refusal naming the file, and leave the existing config
  **byte-identical**. "Success reported over a failed write" is one of this epic's six
  defect shapes; this closes it in the direction that matters.

**Method limits — important.**

- The **MCP-absent** branch is genuinely testable and was tested: no Confluence MCP is
  available here, so that is the real default state.
- The **MCP-present** branch is not. There is no code half for it — detection is the
  agent's tool context, which no Node process can observe — and no live Confluence MCP
  was available. Every MCP-present claim in this epic rests on a mock.
- The text half proves the *message content is correct and identical everywhere it
  ships*. It does not prove an LLM will obey it. Nothing in this repository can.

### AC6 — Global resolution (NFR83) · **Met**

**Method.** `test/release-gate-epic-31.test.js` §5, three assertions. The negative here
is "does not depend on per-machine state", and it is proved **by removal**, not by
inspection:

- A binding is written; `HOME`/`USERPROFILE` are redirected into a sandbox; the
  per-machine bound-projects registry is written at `boundProjectsPath()` and asserted to
  exist; the topology is resolved. Then the registry is **deleted**, the home is swapped
  for an empty one, and the topology is resolved again. The two results must be
  `deepStrictEqual`.
- AC6.2 proves resolution follows its **argument** rather than the cwd: two projects with
  different Confluence space keys are written, and each resolves to its own binding while
  cwd is the other. That catches a resolver consulting an ambient "current project".
- AC6.3 proves an unbound project is reported by the **named** `BINDING_UNBOUND` reason,
  not defaulted — "unbound" and "unreadable" must never collapse.

**Method limits.** This exercises the resolver in-process. It does not install a skill
globally and then activate it in a project from a globally-installed location — that path
is `test/global-install-scope.test.js` (31 assertions, PASS on this branch) plus AC1's
Step 8, neither of which I executed end to end in this session for the *activation* half.

### AC7 — FR/NFR traceability, and the FR266 negative · **See §2 and §3**

### AC8 — Docs and semver cut · **Met**. See §6 and §7.

### AC9 — Full `npm test` green on both platforms · **NOT MET**. See §4.

---

## 2. FR/NFR traceability matrix

**How this matrix was built, because the instruction that it not be a "mentions" check
is the point.** Each row names (a) the landed story, (b) a **shipped symbol, file or
byte-level fact** I verified directly in this session, and (c) the suite that pins it.
Where an outside authority exists — the PRD text, `js-yaml`, the shipped instruction
bytes — the verification is against that authority rather than against another copy of
the same source. Rows marked **partially met** say why in the same row.

Verification commands were run against `bin/cli.js`'s live exports and against
`git show HEAD:<file>` (never the working tree, which test runs mutate).

### Functional requirements

| FR | Story | Evidence verified in this session | Pinned by | Status |
|---|---|---|---|---|
| FR248 | 31.11 | `bin/cli.js` `// Step 3: Scope` block present, offering all three choices verbatim (`Project level (current directory)` / `Global (user-level settings)` / `Custom path`) — retained as-is, per the 2026-08-02 amendment | `global-install-scope` (31/0) | **Met** |
| FR249 | 31.12 | Superseded in effect by FR250's FAIL verdict — BMAD is **not** installed globally; the previous "re-run without `--global`" refusal is gone | `global-install-scope`; AC1 Step 8 | **Met as degraded** (see FR250) |
| FR250 | 31.1 (spike), 31.12 | Spike verdict recorded **FAIL** in `31-1-spike-global-install-feasibility-6-10-0.md` (`bmad install --global` = unknown option). All three degradation facts exist as exported constants `GLOBAL_BMAD_SCOPE_NOTICE_FACT_{1,2,3}` and were read out of `bin/cli.js` | `global-install-scope`; AC1 Step 8 | **Met** |
| FR251 | 31.11 | Absence bracketed by presence in both `global-install-scope` and AC1 Step 8 | `global-install-scope` (31/0) | **Met** |
| FR252 | 31.13 | `handleBind` exported **and** routed (`case 'bind':`); `--yes` parsed via `parseFlags` | `project-layout-bind` (73/0) | **Met** |
| FR253 | 31.13 | `printScopeReport`, `detectInstallScopes`, `describeBoundProjects` all exported as functions | `project-layout-bind` (73/0) | **Met** |
| FR254 | 31.5 | `REPO_LAYOUT_CONCERNS` carries exactly **three** concern records; `collectRepoLayout` drives them | `project-layout-two-store-wizard` (19/0); `project-layout-enum-single-source` (31/0) | **Met** |
| FR255 | 31.6, 31.10 | `ARTIFACT_KIND_OWNER` + `classifyArtifactPath` in `lib/confluence-page-tree.js`; `storeArtifactsDirectory` in `bin/cli.js` | `project-layout-artifact-routing` (59/0) | **Met** |
| FR256 | 31.6, 31.10 | Same mechanism, `SOFTWARE_REQUIREMENTS` owner | `project-layout-artifact-routing` (59/0) | **Met** |
| FR257 | 31.5 | `STORE_BACKENDS` = `{file-system, confluence}`; `STORE_BACKEND_VIEWS` keys are **exactly** those members (checked, not assumed); both frozen and handed out as copies | `project-layout-enum-single-source` (31/0) | **Met** |
| FR258 | 31.5 | `STORE_MODES` = `{same, local, remote}` — FR113–FR116's semantics, per store | `project-layout-two-store-wizard` (19/0) | **Met** |
| FR259 | 31.8 | `collectConfluenceStoreLocation` exported | `project-layout-confluence-configuration` (38/0) | **Met** |
| FR260 | 31.8, 31.10 | `generatedRootPageTitle` and `validateConfluenceIdentity` exported — AC3's "named for the project, and you are told the name" is checkable from the same function the wizard announces from | `project-layout-confluence-configuration` (38/0); `project-layout-confluence-page-tree` (157/0) | **Met** |
| FR261 | 31.9 | 9 shipped copies of the gate block, one sha256, anchored on the exact heading; block cites `mcp-detection-pattern-spec.md` §2.6/§2.7/§6.6 by section | AC7.2; `project-layout-confluence-routing` (97/0) | **Met (mock-bounded for MCP-present)** |
| FR262 | 31.9 | Message content asserted element-by-element across all 9 copies; five prohibitions asserted separately; default-deny third branch asserted | AC5.1–AC5.3 | **Met for MCP-absent** |
| FR263 | 31.2 | No `unlinkSync(... project-layout ...)` anywhere in `bin/cli.js` — the delete-on-single-repo branch is gone; `writeProjectLayoutYaml` runs unconditionally; `PROJECT_LAYOUT_SCHEMA_VERSION` = 2 | `project-layout-binding-spine` (69/0); AC2.1/AC2.2 | **Met** |
| FR264 | 31.3 | `generateBmmConfig` + the stamp trio (`computeProjectLayoutStamp`, `readProjectLayoutStamp`, `canonicalBindingBytes`) all exported; legacy fields verified to retain their **pre-epic literal values** via js-yaml | `project-layout-config-generation` (32/0); AC2.3/AC2.4 | **Met** |
| FR265 | 31.7 | `detectLegacySingleStore`, `topologyFromLegacyLayout`, `LEGACY_SINGLE_STORE_SPLIT_COMMAND` = `"ma-agents config layout"` (a real command, checked against the CLI's own routing) | `project-layout-legacy-single-store` (52/0); AC2.4 | **Met** |
| **FR266** | **none — retired** | **See §3. No implementation found**, re-confirmed across four fix rounds by a multi-line re-scan of all 2,332 tracked shipped markdown files — including the 2,016 the original closed set never covered — then again under a **verb-extended** vocabulary, again under a vocabulary **bound to the product's own prohibition**, and now again over **382 shipped non-markdown files** (`.toml` 72, `.yaml` 240, `.json` 70, `.yml` 0) that no version of this check had ever opened — **2,714 shipped files scanned in total**. Clean every time; **20** hits (17 markdown + 3 non-markdown), all hand-adjudicated and digest-pinned. | **AC7.4–AC7.9 — 16 tests**: 5 direct gate assertions, 7 harness controls, 1 closed-set hygiene check, 1 outside-authority binding, 2 end-to-end. *(Re-derived from the code, not from this row: `grep -c "^test('AC7\.[4-9]"` = 16.)* | **Correctly absent — and this row is NOT a closure claim.** The *result* has held under every attack. The *check* has been defeated **six times across four rounds — six independent attacks, six live bypasses found, all six now failing.** Every round so far has found one. **Do not read "all six now failing" as "no seventh exists": §9 item 9 declines to claim closure and cannot demonstrate it, item 16 says the sixth was found by a human reader and not by any part of this process, and this row claims no more than they do.** — §3, §9 items 9, 14, 16, 24, 26 |
| FR267 | 31.2, 31.6 | `CONFLUENCE_STORE_RECORDS` names exactly the two **requirement** stores; `PUBLISHING_STORES` in the page-tree module excludes `SPRINT_MANAGEMENT`; the emitted binding carries no `implementation_artifacts` record | `project-layout-binding-spine` (69/0); `project-layout-artifact-routing` (59/0) | **Met** |

### Non-functional requirements

| NFR | Story | Evidence verified in this session | Pinned by | Status |
|---|---|---|---|---|
| NFR76 | 31.11, 31.2 | Rebaselined per the 2026-08-02 amendment. Full-tree snapshot diff: added set is exactly the binding; nothing removed; every pre-existing file byte-identical | AC2.1, AC2.2 | **Met** |
| NFR77 | 31.11, 31.12 | AC1 Step 8 — global install under `--network none`, presence-bracketed, egress re-verified after | AC1 Step 8 | **Implemented, not executed** — the workflow has never run |
| NFR78 | 31.13 | `bind` does not rewrite the binding on a no-edit re-run (`bin/cli.js:4905-4918`), deliberately, so the `generated:` date cannot present as a spurious change | `project-layout-bind` (73/0) | **Met** |
| NFR79 | 31.8, 31.2 | Closed-set file enumeration + byte sweep with a positive control + literal key-set assertion + the OQ-4 write-back checked by outcome name | AC4.0–AC4.4 | **Met** |
| NFR80 | 31.9 | AC1 Step 7 (two-store, fully file-system, egress blocked); `docs/architecture.md` §3.6.1 states the posture explicitly; `project-layout-confluence-routing` runs the flow with `dns`/`net`/`http`/`https`/`tls`/`fetch` poisoned and verifies the poison **armed** | AC1 Step 7; `project-layout-confluence-routing` (97/0) | **Met in code; AC1 half not executed** |
| NFR81 | 31.2 | Byte-identity both files, CRLF/LF invariance both directions, no platform-dependent bytes, **plus a bound on the residual** — `generated:` is the only varying line and is date-only | AC3.1–AC3.5 | **Met, with the `generated:` residual named** |
| NFR82 | 31.5, 31.7 | Legacy fields resolve to their literal pre-epic values; both new per-store fields collapse onto the one location for a single-store project | AC2.3, AC2.4 | **Met** |
| NFR83 | 31.2, 31.4, 31.13 | Proved **by removal**: the per-machine registry is written, asserted present, then deleted and the home swapped for an empty one; resolved topology must be `deepStrictEqual`. Plus resolution proved to follow its argument, not cwd | AC6.1–AC6.3 | **Met** |

### Requirements NOT fully met, restated so they cannot be missed

- **Story 31.10 AC1 / AC3 / AC5 — PARTIALLY MET, escalated to a human.** They assert
  Confluence pages *are created*. The routing protocol now reaches an agent (re-sealed
  into all nine gate copies, verified at sha256 `cda3d3d99cff` in §5), but **no shipped
  skill's purpose is to publish a store**: none of `bmad-prd`, `bmad-architecture`,
  `bmad-create-epics-and-stories`, `bmad-ux`, `bmad-product-brief` is shipped by this
  package, and there is **no publish command**. Both facts were independently verified
  before this gate and re-stated here. Recorded as partially met. **Not** marked met, and
  `epics.md` is deliberately unedited.
- **FR261 / FR262 MCP-present branches** are mock-verified. See §1 AC5.
- **NFR77 / NFR80's air-gap half** is implemented but not executed. See §1 AC1.

---

## 3. AC7's negative check — FR266 has no implementation

**FR266 (a local mirror of every `confluence`-backed store) was retired 2026-08-01,
before implementation.** P5-9.6 names an accidental mirror as *the single most likely
way this epic reacquires the subsystem it removed* — and a mirror can return **with no
code changing at all**, as shipped instruction text telling an agent to keep a local
copy. A live route to exactly that was closed three commits before this story began
(markdown headings were invisible to Story 31.9's gate checks, so FR266's mirror could
have been restored verbatim to all nine shipped copies with a green suite). I assumed
there were others and went looking.

### What I searched, and how

**(a) The whole diff, by vocabulary, over-broad on purpose.** Every **added** line of
`git diff 9b936ac..HEAD` (38,871 diff lines) scanned against fourteen probes covering
FR266's four named machineries — mirror, sync direction, sync trigger, conflict
resolution — plus replica, snapshot, local copy, offline copy, write-through/back,
two-way/bidirectional, pull-down/fetch-into, stale-copy language, reconcile, and
merge-remote-content. **531 hits across 75 files.** The scan does not decide; it
enumerates, and every shipped-surface hit was adjudicated by hand. A scan that reported
zero hits from a narrow vocabulary would prove nothing.

**(b) Adjudication of the shipped surface** (`bin/`, `lib/`, `skills/`, `docs/`,
`scripts/`, `test/`, `.github/`). Every hit falls into exactly one of three classes:

- **Explicit negations.** `bin/cli.js`: *"NO local mirror, cache or sync of any kind.
  FR266 is retired at P5-9.6"* and *"it cannot write a local copy and cannot become the
  mirror FR266 retired"*. `lib/confluence-page-tree.js`: *"There is no sync direction, no
  sync trigger, no authority call and no conflict resolution, because there are never two
  copies to reconcile"*. The nine gate copies: *"do NOT write, copy, cache, export or
  reconcile a local copy of anything Confluence returns. There is no mirror and no
  cache…"*.
- **Unrelated pre-existing vocabulary.** `require.cache`; `reconcileAgentsSharedSkills`
  (Epic 15 skill reconciliation); git **merge-conflict** handling in the YAML reader;
  `~/.bmad/cache/external-modules` (bmad-method's own module cache); "mirrors the enum"
  as ordinary English; the Docker/Python/C++ skill library's cache advice.
- **Tests that assert the absence.** `snapshotTree` as the no-local-copy oracle;
  `POISON_BODY = '<<<CONFLUENCE-CONTENT-THAT-MUST-NEVER-BE-CACHED>>>'`.

**(c) A closed set, not a denylist, pinned as a test.** Adjudication-by-hand does not
survive the next commit, so AC7.5 encodes it: **every F26-subject mirror-vocabulary
passage in shipped markdown must lie inside one of the two digest-pinned blocks, or be a
hand-adjudicated, digest-pinned exception.** The subject filter
(`confluence|knowledge store|requirements store|space key|root page`) narrows *what* is
examined without narrowing *where* — a mirror instruction dropped into any shipped file is
still caught, while `npm cache clean --force` in the Docker skill is not. Both doors are
shut: a mirror added **outside** a pinned block fails AC7.5, and a mirror added **inside**
one changes its digest and fails AC7.1/AC7.2.

> ### ⟵ ROUND-1 SNAPSHOT — HISTORY, NOT CURRENT STATE
>
> **Everything in this blockquote, down to the line that ends "the suite is 37/0 on the
> clean tree", is a verbatim round-1 record and is preserved unedited.** It is written in
> the present tense and its numbers were true when written and are not true now. Read it
> as *what round 1 found and claimed*, never as a description of the check as it stands.
> In particular: *"defeatable three ways"* became **six** (rounds 2, 3 and 4 each found one
> more); *"Eight entries"* in the adjudicated set is now **twenty**; *"the suite is
> 37/0"* is now **42/0**; and AC7.5b/AC7.5c/AC7.7b are no longer the whole harness — see
> §9 items 24, 26 and 16 and the FR266 traceability row for current state. **Nothing below
> is retracted; it is simply dated.**
>
> ---
>
> **This check was defeatable three ways and the independent reviewer defeated all three.
> They planted three mirrors; the suite stayed 33/0 with every one of them in place.** Two
> are closed here, the third was already covered elsewhere. This is the single most
> important correction in this fix round, because the version of (c) described above is
> the one that failed, and the paragraph above previously described it as though it had
> not.
>
> **Attack 1 — line-splitting, and it is the DEFAULT case, not an exotic one.** The
> previous AC7.5 filtered **line by line**, requiring one line to carry *both* the F26
> subject *and* a mirror word. Appended to `skills/code-review/SKILL.md`:
>
> ```
> When the software requirements store is Confluence-backed, keep a
> local copy of every page you read and sync it back on the next run.
> ```
>
> Line 1 has the subject and no mirror word; line 2 has `local copy` and `sync` and no
> subject. **This repository hard-wraps markdown at ~80 columns, so a multi-line
> instruction is the norm** — which means a restored FR266, written the way this codebase
> actually writes prose, evaded the closed set **by default**. Any instruction long enough
> to be a real instruction wraps.
>
> **Attack 2 — scope.** A blatant single-line mirror appended to
> `lib/bmad-extension/workflows/add-sprint/workflow.md` was not scanned at all. That file
> **ships** (`lib/` is in `package.json`'s `files`) and it is this repository's own
> authored agent instruction text. The set walked three `skills/` roots and called it
> "shipped skill markdown"; the shipped agent-instruction surface is larger than that.
>
> **Attack 3 — capability bypass.** See (d).
>
> **What is now in place.** AC7.5 matches over a sliding **four-line window** rather than a
> line, and never lets a window straddle a pinned block (each file is split into unpinned
> segments first, and the window slides within a segment). Its population is derived from
> `package.json`'s `files` — the actual authority on what ships — intersected with
> `git ls-files`: **2,332 tracked markdown files, up from 316.** That is a deliberate
> superset of the 1,049 markdown files that reach the tarball (npm additionally honours the
> nested ignore files inside the vendored `lib/bmad-cache/**` packages), and a superset is
> the correct side to err on for a negative: it can over-report, which a human adjudicates,
> but it cannot let a shipped file go unscanned. A filesystem walk was rejected because
> this repository's own suites materialise `.agents/`, `_bmad/` and plugin build dirs
> mid-run, which would make the population depend on *when* the suite ran.
>
> **The widening pulls in the human documentation that legitimately discusses the
> retirement** — `README.md`'s *"There is no local mirror and no cache"* — and those cannot
> be excluded by path without reopening exactly the hole attack 2 walked through. They are
> admitted the only way that preserves a closed set: **by the sha256 of the adjudicated
> passage itself.** Eight entries, each read by hand and each carrying its reason in the
> test file. Edit one of those passages and its digest changes and it must be
> re-adjudicated; add a mirror passage anywhere and it has no digest and fails. AC7.5d
> closes the set in the other direction — every digest must still match something — so a
> stale exception cannot linger and silently widen the set.
>
> **The harness controls, which are the reason this is now believable.** AC7.4 (the
> vocabulary flags FR266 restored verbatim) and AC7.4b (the subject filter admits it and
> rejects unrelated cache advice) are retained. New: **AC7.5b** plants attack 1's exact
> text and first asserts that *neither line* satisfies a per-line filter — so the control
> proves the old set genuinely had the hole — then that the window catches it. **AC7.5c**
> asserts the population itself: attack 2's exact target file is now in scope and was not
> before, and the widening is 2,016 files. **AC7.7b** does the same for attack 3.
>
> **All three attacks were then re-planted verbatim and the suite run against them.** With
> all three in place it is **35 passed / 2 failed, exit 1** (it was 33/0). Attack 1 dies at
> AC7.5 (`skills/code-review/SKILL.md:79`), attack 2 dies at AC7.5
> (`lib/bmad-extension/workflows/add-sprint/workflow.md:204`) — each reported as its own
> separate stray, so neither is passing on the other's strength — and attack 3 dies at
> AC7.7. Reverted; the suite is **37/0** on the clean tree.

**(d) The code half, by capability rather than by intent.** `lib/confluence-page-tree.js`
— the only module in this epic that could plausibly acquire a mirror, because it is the
only one that talks about pages — is asserted to **require nothing at all.** Comments are
stripped before the scan, because the module's own header *documents* the prohibition by
naming `require('http')`, and a scan that counted its own documentation as a violation
would be measuring the wrong artifact. After stripping, the require count is **zero**.

> **Attack 3 — the capability bypass, and the correction to what this paragraph used to
> claim.** The previous version of AC7.7 enumerated a forbidden-module list behind the
> regex `/^(https?|net|tls|dgram|child_process|axios|node-fetch|undici)$/`, which **does
> not match a `node:` prefix**, and a writer list of five *sync* names. So
> `require('node:https')` plus `fs.promises.writeFile` walked past it. The reviewer
> planted exactly that and AC7.7 stayed green.
>
> **The code half was never actually undefended.** Story 31.10's suite bans `require(` in
> this module outright, and that is what caught the plant. AC7.7 was simply the weaker of
> the two guards while this document described it as the strong one. It now leads with the
> strong form — *this module requires nothing* — which is both true and stronger than any
> enumeration, with the lists kept behind it as the diagnostic that names *what* was added.
> `node:` is stripped before matching; the writer list gains the async half and the
> `fs.promises` namespace; and dynamic acquisition (`import()`, `createRequire`,
> `process.binding`, `eval`/`new Function`) is now refused too, since no enumeration of
> require *arguments* can see those. AC7.7b plants the reviewer's exact shape and first
> demonstrates that the old assertions genuinely missed it.
>
> **The forward guarantee is withdrawn.** This section previously said the module "cannot
> become a mirror **regardless of what anyone later intends**." That overstates what a test
> can enforce. What is true: *today's* module has no I/O capability, and the guard now
> fails on the shapes by which one would be added. What is not true: that no future edit
> can defeat the guard. This fix round is itself the evidence — three edits defeated the
> previous guard, and one of them was the ordinary way this codebase writes a sentence.

**(e) By path.** No shipped path under `bin/`, `lib/`, `skills/` or `scripts/` is named
for a mirror or a page cache (`mirror|confluence[-_]?cache|page[-_]?cache`).

**(f) Against the outside authority.** AC7.9 binds the absence check to the PRD: FR266
must still read `[RETIRED 2026-08-01, before implementation]` and `ID retired, never
reused.` If FR266 were ever un-retired, this gate stops asserting its absence rather than
silently contradicting a live requirement.

### Result

**FR266 has no implementation anywhere in `9b936ac..HEAD`.** No mirror, no cache, no
sync direction, no sync trigger, no conflict-resolution path — in code, in tests, or in
shipped instruction text. Every occurrence of the vocabulary on a shipped surface is
either a prohibition, an unrelated pre-existing use, or a test asserting the absence.
**Fourteen** assertions now hold that closed — up from nine — with **six** harness
controls proving the instrument detects a restoration, four of them added across the two
fix rounds specifically because the first nine did not.

**Re-run over the whole branch, my own commits included.** The scan was repeated against
`9b936ac..HEAD` after this story's four code/doc commits landed (678 added-line hits, up
from 531). The **shipped-surface file set is unchanged** — my commits added hits only in
`test/release-gate-epic-31.test.js` (the scan's own vocabulary), the offline-install
script, `README.md` and `CHANGELOG.md`. Every one of the latter two was adjudicated by
hand: *"There is no local mirror and no cache"*, *"has no code, no cache, no sync
direction, no sync trigger and no conflict-resolution path"*, *"do not fall back to any
local copy"*, and *"nested to mirror the source folder structure"* — the last describing
the page **tree's shape**, which is FR255/FR256's actual requirement, not a content
mirror. (`CHANGELOG.md` was listed here as a shipped surface. **It is not one** — see §7.
It is still worth adjudicating, because it is read on GitHub, but it is not part of the
package.)

### The multi-line re-scan of everything the closed set did not cover

**This was the reviewer's highest-value outstanding follow-up and it has now been run.**
The old closed set covered 316 markdown files under the three `skills/` roots. The
**733 shipped markdown files outside it** — 666 under `lib/bmad-cache/**`, 26 under
`lib/bmad-workflows/**`, 8 `lib/mil498-templates/**`, **7 under
`lib/bmad-extension/workflows/**`**, 6 `lib/templates/**`, and the root/`docs/`/`mil498/`
documentation — had never been scanned at all, and the line-by-line filter would have been
the wrong instrument for them anyway.

Re-scanned with the four-line window, over the tarball population first (733 files) and
then over the tracked superset the suite actually walks (**2,016 files**, which adds the
1,283 vendored `bmad-cache` markdown files npm's nested ignore rules keep out of the
tarball):

**The scan is CLEAN.** Zero in all 7 `lib/bmad-extension/workflows/**` files, zero in
`lib/bmad-workflows/**`, `lib/templates/**` and `lib/mil498-templates/**`, zero in
`mil498/**`. **Five hits, in two files, all of them adjudicated as clean:**

> **CORRECTION (fix round 3).** This paragraph read *"Zero hits in all 666
> `lib/bmad-cache/**` files"*. **That is false as this document now stands: there are
> seven** — all in the vendored GDS workflow assets, and all seven carried in the
> adjudicated list as `2ee78afd`, `bad65455`, `b6995c09`, `667ee3c2`, `fa07f6dc`,
> `18433621` and `0a953733` (the upstream `external_handoffs` and Confluence
> `headless-schemas` payload examples). The zero was true when this paragraph was written
> and stopped being true one round later, when the verb half of the vocabulary was
> extended and began matching `Confluence upload` inside those upstream examples. The
> **adjudication** of all seven is unchanged and unchallenged; only the sentence claiming
> they do not exist was wrong.
>
> **How it was found matters more than the number.** It was found by a verifier
> *re-deriving the count from the code*, not by the count sweep of fix round 2 — whose own
> §9 item 25 claims to have swept this document for exactly this defect class. Round 2
> edited line 539 of this very paragraph and left the sentence above it standing. A sweep
> that walks past a false number in the paragraph it is editing did not do the job item 25
> credits it with, and item 25 should be read with that in mind.

| File | Passage | Adjudication |
|---|---|---|
| `README.md:213` | *"**There is no local mirror and no cache.**"* | Prohibition |
| `README.md:217` | *"nothing is copied down … nothing to synchronise and nothing to fall out of date"* | Prohibition |
| `README.md:221` | *"one page per markdown artifact, nested to mirror the source folders"* | The page **tree's shape** — FR255/FR256's actual requirement, not a content mirror |
| `docs/architecture.md:213` | the bmad-org **registry** cache builder | Unrelated pre-existing subsystem (`lib/bmad-cache`), nothing to do with a knowledge store |
| `docs/architecture.md:219` | *"Installation and skill loading require no network at all … Neither reads a knowledge store"* | Negation, and the air-gap posture NFR80 requires this file to state |

All five are now digest-pinned exceptions in AC7.5 rather than hand adjudications that
expire at the next commit. **So the negative now stands on the whole shipped surface, not
on the eighth of it that happened to be under a `skills/` directory** — and it stands
against the multi-line prose shape this repository actually writes in, which is the shape
the previous check could not see.

Three further README passages were flagged when the "Deliberately not implemented" and
"Known limitations" sections were moved into it for §7's fix — **the closed set catching
its own author's new prose, which is the behaviour it exists for.** All three are the
retirement notice itself; adjudicated and pinned, **bringing the exception list to eight.**
(This paragraph previously stopped at "five", which was the count before §7's fix added
those three. The code pinned eight. Corrected in fix round 2 — no adjudication changed,
but a stale count in the one section the FR266 negative rests on is not acceptable.)

#### The verb-extended re-scan (fix round 2)

The reviewer named this the highest-value remaining check, and it has now been run: the
**verb-extended vocabulary over the same 2,016-file widening / 2,332-file tracked shipped
population**, unchanged in every other respect — same four-line window, same F26 subject
filter, same pinned-block exclusion.

**It found 8 new hits, bringing the total to 16. None is an FR266 mirror.** Every one was
read at source and adjudicated by hand; none was hand-waved, and all 8 are now
digest-pinned alongside the original 8. **The exception list is therefore 16.** The eight
original digests were re-verified unchanged — the verb family reports new *neighbourhoods*,
it does not shift the window boundaries of the existing ones.

The 8 new hits fall into exactly two classes:

| File | Passage | Adjudication |
|---|---|---|
| `README.md:14` | *"the affected skill **halts and says so** rather than quietly reading stale local files. No credentials are ever written to disk."* | **Negation, twice over.** The halt is the *anti*-mirror behaviour; the sentence the `written … to disk` probe matched is about **credentials**, not page content |
| `lib/bmad-cache/gds/…/gds-create-game-brief/SKILL.md:47` | `{"directive": "Confluence upload", "tool": "corp:confluence_upload", …}` | One-way **publish record** — see below |
| `lib/bmad-cache/gds/…/gds-gdd/assets/headless-schemas.md:24, :44` | same upstream example (Create, Update payloads) | ″ |
| `lib/bmad-cache/gds/…/gds-prd/assets/headless-schemas.md:22, :39` | same upstream example | ″ |
| `lib/bmad-cache/gds/…/gds-ux/assets/headless-schemas.md:27, :47` | same upstream example | ″ |

**The seven `lib/bmad-cache/**` hits are seven copies of one upstream JSON schema example,
and they are not our text.** `lib/bmad-cache/` is generated by
`scripts/build-bmad-cache.js` from the upstream BMAD-METHOD registry and committed so that
an air-gapped install has its modules. The matched text is an `external_handoffs` **report
field** in a headless-run result payload for the game-design (`gds`) module — a record that
a corp-specific MCP tool performed a one-way publish of a produced artifact. **A publish
handoff is not a mirror**: no local copy of anything read, no sync direction back, no
trigger, no conflict resolution, and no knowledge store of *this* product involved. It is
the same shape as this product's own FR255/FR256 publish, which FR266's retirement
explicitly leaves intact.

Pinning those seven by digest rather than excluding `lib/bmad-cache/` by path was
deliberate. The path exclusion was the easy fix and would have reopened attack 2's scope
hole across 666 shipped files. The digest pin costs nothing and buys a real property: those
bytes are *regenerated by a build*, so if upstream ever changes that example the digest
stops matching, AC7.5d fails, and a human re-adjudicates.

**What the clean result does and does not license.** It says: across every tracked shipped
markdown file, under a vocabulary that now includes the ordinary verbs as well as the
architecture nouns, there is no FR266 mirror instruction outside the pinned blocks and 16
hand-read exceptions. **That is a materially stronger negative than the noun-only scan
supported.** It does not say the vocabulary is complete — see §9 item 9, which was rewritten
in this round precisely because it had claimed more than this.

#### The non-markdown re-scan — attack 6, fix round 4

**The check scanned markdown and nothing else.** Shipped `.toml`, `.yaml`, `.yml` and
`.json` are agent-readable instruction text, they ship, and no version of AC7.5 had ever
opened one of them: for those files no verb, no proximity window and no subject filter was
ever consulted. This is the sixth attack to defeat this check and the only one that needed
no cleverness — the previous five each had to *evade* a predicate; this one walked around
the population.

**It was not hypothetical, and the vehicle was already in the tree.**
`lib/bmad-cache/gds/src/workflows/1-preproduction/gds-create-game-brief/customize.toml:114`
names Confluence outright in an `external_handoffs` directive, and that same workflow's
`SKILL.md:99` instructs an agent to *"execute each entry in `{workflow.external_handoffs}`
… Invoke the tool"*. So a handoff entry with a **read-back direction** would have been a
live, executed mirror in a file nothing scanned. **Found by a human reader, not by this
process** — see §9 item 16.

**The new population, and the authority for it.** The same authority the markdown half
uses: `package.json`'s `files` ∩ `git ls-files`. **382 files** — `.yaml` 240, `.toml` 72,
`.json` 70, `.yml` 0 (three `.yml` are tracked, all under `.github/`, none inside the
`files` roots; the extension is kept in the set so renaming a `.yaml` cannot escape).
Combined with the 2,332 markdown files, **the scan now covers 2,714 of the 3,249 tracked
files under the `files` roots.** **No path is excluded by rule** — all three real hits are
vendored `lib/bmad-cache/**`, and a `lib/bmad-cache/` path exclusion would have been the
easy fix and would have reopened attack 2's hole across 666 shipped files. They are pinned
by content digest instead, exactly as the seven vendored markdown hits were in round 2.

**How the proximity window was adapted, and why.** *(Rewritten in fix round 5, FIX-5. What
stood here justified the constant with a statistic that cannot be checked and a mechanism
that does not occur — both are removed below rather than restated. The heading used to
promise "not guessed — measured". Half of that promise is withdrawn.)*

- **Line *length* is not the difference, and the obvious argument for changing it is
  wrong.** The markdown window's stated rationale is "~80 columns × 4 lines ≈ 320
  characters". Measured: the shipped `.md` population averages **34.9** characters per
  line and the shipped `.toml`/`.yaml`/`.json` population averages **34.7**, with a
  longest line of 497 and no minified JSON anywhere in the tree. A character-span argument
  does not distinguish these populations and is **not** the reason for the change.
- **The *unit* is plausibly the difference.** In these formats an instruction is not a
  wrapped sentence; it is an **entry** — a contiguous leading comment block plus the key it
  documents. Entries run longer than a wrapped sentence, so a wider window is a reasonable
  hedge. **That is the whole of the argument for 16, and it is an argument, not a
  measurement.**
- **The statistic that used to justify 16 is WITHDRAWN, not restated.** This bullet read:
  *"Over the **745** such entries in the shipped TOML/YAML the median is **4** lines but
  the 99th percentile is **16** … 16 covers 739 of the 745 … **6 of 745 entries exceed 16
  lines** (the longest is a 118-line GitHub-Actions template header)."* **It is not
  reproducible.** The measuring script was never committed and no test pins the definition
  of an "entry", so a reader of this gate cannot check the number that justifies the
  constant. An independent reconstruction of the same phrase — *"contiguous comment block
  + key"* — returns **291 entries, median 2, p99 16, 2 over 16, max 18**, against
  745 / 4 / 16 / 6 / 118. **Only the p99 coincides.** Two defensible readings of one phrase
  differing by 2.6× on the population and 6.5× on the maximum is what an unpinned
  measurement looks like. Either figure might be right; neither is checkable, and **an
  unverifiable statistic is a worse justification than an admitted guess, because it looks
  like evidence.**
- **The stated MECHANISM does not occur either.** The withdrawn bullet claimed a four-line
  window could put the F26 subject (line 104, *"route outputs beyond local files
  (Confluence, Notion, Google Drive…)"*) and the mirror verb in **different windows within
  one entry**. It cannot. **Line 114 carries `Confluence`, `upload` and `space_key='GAME'`
  on one physical line**, so a four-line window matches it trivially — and a **one**-line
  window matches it, confirmed by a width sweep at 1/2/4/8/16/24. The example chosen to
  demonstrate the need for a wider window is an example that never needed one.
- **So 16 is an UNMEASURED ROBUSTNESS MARGIN, and it buys nothing on the current tree.**
  This part *is* reproducible, from the scan itself rather than from an uncommitted script:
  **the same three files, three hits and three digest neighbourhoods are reported at every
  window width from 4 through 24.** Not one additional passage is found by widening.
- **And it costs.** (i) A 16-line window digests more surrounding text, so an unrelated
  edit anywhere in those 16 lines changes the digest and forces a re-adjudication — that
  churn is the price of not excluding `lib/bmad-cache/` by path. (ii) **FIX-3 is the
  concrete bill for that width:** two of the three adjudications described bytes their
  16-line window did not cover, and one of the two turned out to be a window artifact that
  was not labelled as one. **At width 4 neither mis-description would have been available
  to make.**
- **It remains a bound, not a proof** — now with no number attached. An instruction split
  across a longer entry still evades. §9 item 16 states that.

> **The honest summary: 16 is defensible and unproven. 4 would very likely do the same job
> on this tree, and the wider window has so far cost more in adjudication quality than it
> has bought in coverage.** The constant is left at 16 because changing it would move every
> structured digest and force a re-adjudication of all three hits for no demonstrated
> benefit — but it is recorded here as a judgement call, not as a measurement.

The pinned-block carve-out is applied to structured files unchanged. It never fires there:
**0 of the 382** carry either `## ` heading. That is left as a rule rather than
special-cased, so a skill later shipped as YAML front matter would be pinned the same way.

**Three hits over the whole 382-file population. Every one read at source, individually.
None is an FR266 mirror.**

| Digest | File | What matched | Adjudication |
|---|---|---|---|
| `649b5cea` | `gds-create-game-brief/customize.toml` — **window `99–114`**, cited at its first line | **Not what this row used to say.** The window OPENS inside the `external_sources` examples (`:99` *"query corp:wishlist_search…"*, then `external_sources = []` at `:101`), then runs through the `external_handoffs` comment block (`:103–:114`) and **stops at `:114`**. **The key is NOT in these bytes:** `external_handoffs = []` is line **116**, and the Slack example at `:115` is outside too. The matching text is line **114**. **The file this attack was found on.** Matched text is an *example*: *"After finalize, upload brief.md and addendum.md to Confluence via `corp:confluence_upload` (space_key='GAME', parent_page='Game Briefs', …)"* | **One-way publish, and the key ships EMPTY** (`external_handoffs = []`, line 116 — read at source, though outside the digest). No copy of anything Confluence *returns*, no read-back direction, no trigger, no conflict resolution. The comment itself says *"local files always exist regardless"* — the local file is the **source**, not the cache. Same shape as this product's own FR255/FR256 publish, which FR266's retirement leaves intact, and the same upstream example already adjudicated in markdown as `2ee78afd`. **Verdict unchanged** |
| `f93251c9` | `gds-ux/customize.toml` — **window `78–93`**, cited at its first line | **A WINDOW ARTIFACT, and this row did not say so.** Line `:78` is *"# Polish passes applied to DESIGN.md and EXPERIENCE.md at finalize."* — unrelated to the adjudication. The window is **dominated by two unrelated keys**, `doc_standards` (`:78–:84`) and `external_sources` (`:86–:89`); only its last three lines (`:91–:93`) are the `external_handoffs` comment, and **the key `external_handoffs = []` is line 94, outside the window.** The matching text is line **93** alone: *"Upload DESIGN.md to Confluence via `corp:confluence_upload` (space_key='DESIGN')."* | **Same shape as `649b5cea`, also shipping empty.** A one-way publish record. **Verdict unchanged.** *One measured difference from `88a4d876`, stated so the shared label is not read as more than it is: `88a4d876` needs a window of **2 or more** to match at all, while this file still matches at a window of **1** — line 93 carries subject and verb together. The **match** is therefore not manufactured by the window; the **citation and the digested span** are* |
| `88a4d876` | `bmad-testarch-trace/workflow.yaml` — **window `20–35`**, cited at its first line | `allow_external_pointer_resolution: true # Follow local placeholder pointers (e.g., Jira/Confluence) when compatible adapters exist` — line **35**, the window's last line | **A window artifact, not an instruction — honestly adjudicated, and untouched by fix round 5.** The subject comes from that one comment — *resolving* a reference is a read, not a local copy — and the verbs (`export`, `persist`) come from two unrelated neighbouring keys (`coverage_basis` `:33`, `summary_confidence` `:34`) about the workflow's own step outputs. Nothing here copies anything Confluence returns |

> **Fix round 5, FIX-3 — why two of these three rows were rewritten.** The digest is the
> closed set's evidence trail: a human must be able to go to the cited line and *see* the
> passage the adjudication describes. Two rows failed that. `649b5cea` was described as
> *"its 13-line comment block plus the key"* when the key is four lines past the end of the
> window; `f93251c9` was described as *"the same `external_handoffs` entry"* when 13 of its
> 16 lines are two other keys and the entry's key is one line past the end. **Neither
> verdict was wrong and neither has been re-litigated** — both hits are benign one-way
> publish examples, and `88a4d876` was honestly adjudicated from the start. What was wrong
> was the *description of the bytes*, which is the part a reviewer checks.

**Two further shipped `.toml` files carry the F26 subject and correctly do *not* hit**, and
they were read too, because "the scan found nothing there" is only worth anything if
someone checked what was there: `gds-gdd/customize.toml:95` and `gds-prd/customize.toml:80`
both say only *"route outputs beyond local files (Confluence, Notion, Google Drive, ticket
systems, etc.)"* with `external_handoffs = []` and no mirror verb.

**The exception list is therefore 20** — 17 markdown + 3 non-markdown — re-derived from
`ADJUDICATED_MIRROR_PASSAGES`, not from this sentence. The live scan reports exactly 20
hits over 2,714 files and exactly 20 distinct digests, so the list has no stale entry and
no unused one.

##### Anti-vacuity proof, both directions

A widening test is worthless if it only proves the *predicate* fires; the predicate already
fired on this text before the change. The proof therefore runs a real plant in the real
shipped file and shows it turning on the **population**:

```
target : lib/bmad-cache/gds/src/workflows/1-preproduction/
         gds-create-game-brief/customize.toml   (CRLF throughout, 116 lines)
baseline git hash-object : 5c1c19b70ea74d6349b701851bba78539eaa6ef0
```

Line 116 — `external_handoffs = []` — was replaced, preserving CRLF, with the natural shape
of the attack:

```toml
external_handoffs = [{ directive = "download every Confluence page in the software
requirements store into _bmad-output/pages/ and read from there on every later run",
tool = "corp:confluence_download" }]
```

*(one physical line in the file; wrapped here only for the page)*

```
planted git hash-object : f88f667dc22cafd54d379e00d74efdf4a8bd3bf5
```

| Direction | Scan | Result |
|---|---|---|
| **Forward** | new scan, plant live | **41 passed, 1 failed, exit 1.** AC7.5 reports it as a stray: `customize.toml:115 [eb442b99] … external_handoffs = [{ directive = "download every Confluence page in …` |
| **Reverse** | population reverted to markdown-only (`git checkout HEAD~1 -- test/release-gate-epic-31.test.js`), **same plant still live**, hash-object still `f88f667d` | **40 passed, 0 failed, exit 0** |

**The second row is the load-bearing one.** The identical instruction, live in a shipped
file, is invisible to the markdown-only scan — so what closes this is the widened
population, not an assertion that was already true.

**The plant was reverted in the same step.** `git checkout HEAD -- <target>
test/release-gate-epic-31.test.js` restored both; `git hash-object` on the target returns
**`5c1c19b70ea74d6349b701851bba78539eaa6ef0`**, identical to the baseline, line 116 reads
`external_handoffs = []` again, and `git status --porcelain` shows only
` M skills/git-workflow-skill/skill.json` — the known CRLF phantom (§4). Suite back to
**42 passed, 0 failed, exit 0**.

The plant is also left behind as a permanent regression control in **AC7.5i**, which
asserts both directions in code so this cannot decay into a claim about a manual run that
never happens again.

**What this check cannot see.** Restated after the fix round, because two of the three
boundaries this section previously named turned out to be understatements of live
bypasses rather than descriptions of residual risk:

- **The window is four lines, and that is a bound, not a proof.** At ~80 columns a
  four-line window spans ~320 characters, comfortably more than one hard-wrapped
  instruction sentence. **An instruction deliberately spread across five or more lines, or
  split by an intervening list item, table row or fenced block, still evades.** I chose
  four against the wrap width rather than against an attacker: a larger window joins
  unrelated neighbouring paragraphs and produces false positives that get adjudicated away,
  which is its own failure mode. This is the honest residual of attack 1 — the *default*
  case is now closed, the *determined* case is not.
- **The vocabulary is an open list, and an ordinary synonym walked through it.** This
  bullet previously said an evasion here would need "a genuinely novel name" in "text that
  never mentions Confluence or a knowledge store", and called that remote. **That was
  wrong, and it was wrong in the direction of flattering the check.** The reviewer planted
  a complete FR266 mirror — *"download every Confluence page in the software requirements
  store and save it under `_bmad-output/pages/` … upload your edits back when you finish"* —
  which needs no novel name, names Confluence and the store outright, and is how a person
  would naturally write the instruction. It returned 37 passed, 0 failed, exit 0. The
  vocabulary has since been extended with the verb family, and that exact text now fails
  AC7.5 — but see §9 item 9: **the closed set is closed over a place and a subject; its
  verb list is open, and extending it narrows the gap without closing it.**
- **The scope is now every shipped markdown file *and* every shipped `.toml`/`.yaml`/
  `.yml`/`.json` file — 2,714 of the 3,249 tracked files under the `files` roots.**
  *(Fix round 4. This bullet previously ended "Nothing in this epic puts instruction prose
  in those files, but nothing in this suite would notice if something later did." Both
  halves were wrong in the same direction: something already did — `customize.toml:114` —
  and the sentence read as residual risk when it was describing a live hole. See the
  non-markdown re-scan above and §9 item 16.)* **535 shipped tracked files are still not
  scanned** and item 16 enumerates every one of them by extension: program text (`.py`,
  `.js`, `.ts`, `.mjs`, `.cjs`, `.sh`, `.ps1`, `.groovy` — 189), non-covered markup and
  data (`.html`, `.astro`, `.css`, `.csv`, `.xml`, `.txt`, `.svg`, `.template` — 63),
  binary formats and git internals (`.png`, `.ico`, `.pptx`, `.excalidraw`,
  `.pack`/`.idx`/`.rev`, 3 tag refs — 32), and dotfiles/extensionless manifests (251).
  **189 + 63 + 32 + 251 = 535. Do not read this as the hole being gone — read it as the
  hole being bounded and written down.**
- **The digest-pinned exception list is brittle in a specific way.** A pure re-wrap of an
  adjudicated README paragraph — reflowing it to a different column width, with no change
  in meaning — changes the digest and fails AC7.5. That is deliberate (it forces
  re-adjudication rather than assuming a rewrite is innocent) but it means this suite will
  fail on an editorial pass that changed nothing substantive, and whoever hits that must
  re-read the passage rather than reflexively re-pinning it.
- **AC7.5d proves no exception is stale; it does not prove every exception was
  adjudicated correctly.** The **twenty** reasons are mine. A reviewer should read them —
  and note that **ten of the twenty** are vendored upstream text (`lib/bmad-cache/**`) that
  I adjudicated but did not author: the seven markdown schema examples from round 2 plus
  the three non-markdown hits from round 4. *(This bullet read "sixteen" when the code held
  seventeen, and "seventeen" when round 4 took it to twenty. It has been stale at every
  round. **Re-derive it from `ADJUDICATED_MIRROR_PASSAGES` rather than from this sentence**
  — see §9 items 28 and 29.)*
- `bug-oq3-guard-scope-misses-skills-that-write-from-nested-prompt-files` records a
  related scope hole in Story 31.4's *guard*: coverage is computed from top-level
  `SKILL.md` only. My scan walks **every** shipped `.md`, so it does not inherit that hole
  — but the two scopes are different and should not be conflated.

---

## 4. AC9 — the honest answer

**Full `npm test` is NOT green.** Not on Windows, and I could not run Linux.

### What I actually ran

All 103 of the chain's 104 suites **individually**, continue-on-failure, on this branch, per the
story's own technical note that the `&&`-chained script halts early and masks downstream
breakage. `test/repo-layout.test.js` was excluded from the automated run because it
performs a real install into its own worktree (~521 paths). Per-suite wall-clock cap
applied by killing the child from Node and recorded as a **distinct `TIMEOUT` verdict**,
never as `FAIL` — no suite was ever wrapped in `timeout`, because `repo-layout` exits 143
on SIGTERM and that reads as a failure it is not.

**Result: 102 run, 12 not-PASS.** Then each not-PASS was re-run alone on a
verified-clean tree, and each one that also exists on `main` was baselined against a
detached worktree at **`9b936ac`**.

> **Reconciling the suite counts, which this document gave three different values for.**
> §4 said "102 run", the §9 addendum said "all 103 chain suites", and the chain has
> **104** entries. Re-derived from `package.json` at `HEAD`:
>
> - **104** `&&`-separated entries in the `test` script. Position 1 is `yes-flag`,
>   position 11 is `bmad-version-bump` (where the chain halts), position 20 is
>   `repo-layout`, position 104 is this story's new `release-gate-epic-31` — which is what
>   the reviewer's count of 104 reflects and which the earlier drafts predate.
> - **103** attempted, after excluding `repo-layout` as the already-known mutator. That is
>   the addendum's figure and it is correct for the instrumented run.
> - **102** produced a verdict in §4's earlier, separate run.
>
> **The one-suite gap between 103 and 102 is not reconstructible from what I recorded**,
> and I am not going to reverse-engineer a reconciliation for it — the most likely
> explanation is that §4's run predates the registration of the release-gate suite itself,
> but the run log does not survive to prove that. The 12-row disposition table below is
> complete for the suites that did report, and every "pre-existing" verdict in it was
> baselined against `9b936ac` individually, so the gap does not put any verdict in doubt.
> It does mean **"102 run" should be read as "102 verdicts recorded", not "102 of the
> chain's suites"**, and a re-run would be needed to close it properly. Re-running the
> full chain was not attempted in this fix round: it takes hours and dirties ~520 paths,
> and the finding it would confirm (AC9 NOT MET, on `story-15-5`) is already independently
> reproduced below.

### The 12, dispositioned

| Suite | Branch | `main` @ `9b936ac` | Verdict |
|---|---|---|---|
| `bmad-version-bump` | 34/2 | **34/2** | Pre-existing (bmad-method 6.9.0 in the shared `node_modules` vs. the 6.10.0 the test expects) |
| `staging-6-10-0-regression` | 7/8 | **7/8** | Pre-existing, same cause |
| `v68-pluginresolver-enumeration-passthrough` | 10/2 | **10/2** | Pre-existing, same cause |
| `migration-validation` | 199/3 | **199/3** | Pre-existing (skill-count drift: 50 folders found, 63 expected) |
| `build-plugin` | 35/1 | **35/1** | Pre-existing; its *test* also leaks an orphan build dir |
| `knowledge-atlas-smoke` | crash | **crash** | Pre-existing (missing `esbuild`/`lunr`) |
| `knowledge-atlas-render` | crash | **crash** | Pre-existing, same cause |
| `custom-marketplace-surface-drift` | 8/1 | **8/1** | Pre-existing |
| `custom-marketplace-registry` | 15/4 | **15/4** | Pre-existing |
| **`story-15-5-workflow-skills`** | **157/0** — *was 153/4; resolved at `d5dbab5`* | **157/0** | **WAS THIS EPIC'S REGRESSION. RESOLVED ON THIS BRANCH** — see below. The 153/4 reading is the pre-`d5dbab5` state and is what the disposition walk in this table was performed against |
| `project-layout-two-store-round-trip` | TIMEOUT | n/a (new) | **Not a failure.** 52/0 when run alone — see below |
| `project-layout-artifact-routing` | 58/1 | n/a (new) | **Not a failure.** 59/0 on a clean tree — see below |

**Every "pre-existing" above was verified, not accepted.** I ran the same suite at
`9b936ac` in a detached worktree and compared counts. All nine match exactly. The tenth —
`story-15-5-workflow-skills` — did **not** at the time of that walk, and that is the whole
reason for baselining: it is exactly how the 31.4/15.5 regression was found in the first
place. **It matches now.** The regression was resolved on this branch at commit `d5dbab5`
and the suite reads **157 passed, 0 failed, exit 0**, the same as `main`. See below for
what was landed, by whose authority, and what has *not* happened to it.

**`bmad-output-policy` is not in the `npm test` chain at all.** It exists at
`test/bmad-output-policy.test.js` on both branches but is absent from `package.json`'s
`test` script, so `npm test` never runs it and it cannot be a chain failure. I record this
rather than reporting it as pre-existing-green.

> **And it is not green.** Run directly in the fix round because §7's change edits
> `README.md` and this is the only other suite that reads it: **10 passed, 1 failed, exit
> 1.** The failure is `_bmad-output/ section appears within first two major sections after
> Installation` — "found 9 H2s before it". **Pre-existing and not caused by the §7 edit**:
> the `## Project Knowledge: _bmad-output/` heading is the 10th `##` in `README.md` at
> `dfd5e47` and the 10th at `HEAD`, verified against both blobs, and the fix-round
> additions are `###` subsections inside an existing `##`, so they cannot move an H2 count.
> The suite is unreachable via `npm test` and its assertion is a documentation-layout
> preference rather than a product property, but it is a red suite in this repository and
> this gate should not have left it unmentioned.

### The one that was this epic's — RESOLVED ON THIS BRANCH, and the record ran behind it

> **STATUS, STATED FIRST BECAUSE THIS DOCUMENT PREVIOUSLY STATED THE OPPOSITE.**
>
> The 31.4/15.5 contradiction **is resolved on this branch.** Commit **`d5dbab5`** landed
> the fix; commit `7e9f00e` recorded its verification evidence. **Neither commit touched
> this record**, so from `d5dbab5` until fix round 5 this section, §8's bug row and §10 all
> said the opposite — that nothing was implemented, that `story-15-5` was still 153/4, and
> that the block had been *"deliberately not patched"* pending a human's adjudication.
> **A reader would have concluded that a contested fix was being withheld for their
> decision, when it had already been landed on the branch they were being asked to gate.**
> That is the most serious defect fix round 5 was asked to close, and it is closed here.
>
> - **What is true now:** `test/story-15-5-workflow-skills.test.js` reads **157 passed,
>   0 failed, exit 0** on this branch — the same as `main` — and the preflight block is
>   present in five workflow **sources** under `lib/bmad-extension/workflows/`.
> - **By whose authority:** **the human authorised the resolution that §4 recommended.**
>   This was not an agent deciding an adjudication reserved for a human.
> - **What has NOT happened:** **the implementation was landed before an independent
>   review had seen it.** Nothing below should be read as reviewed-and-blessed. The
>   engineering is unreviewed; only the *choice of resolution* was authorised.
> - **The process ran ahead of the record.** Two commits changed the branch's headline
>   finding and left the document asserting the negation of it for four commits. That is a
>   process failure in its own right and it is recorded as one, not smoothed over.
> - **It also created a new defect.** The fix over-pinned 26 lines of live agent
>   instruction text out of the AC7.5 scan and a mirror instruction walked through the
>   hole — attack 7. See §9 item 30. Landing a fix ahead of review is not a free action.

**What was landed, and how exactly it matches the recommendation below.** `d5dbab5` is
**§4's own recommended variant, unmodified**: the Story 31.4 preflight block was added to
the authored **source** of five workflow-sourced skills under
`lib/bmad-extension/workflows/` — `add-sprint`, `add-to-sprint`, `modify-sprint`,
`sprint-status-view` **and `remove-from-sprint`** — at the same gateway position, so the
skill body and the source both carry it. **The `remove-from-sprint` instruction was
followed**: the recommendation explicitly said to include the fifth, latently-armed copy
and not only the four that failed, and the fix did. Insertions only (5 files, +560 lines,
0 deletions); the block was lifted from the already-converted `SKILL.md` with the gate's
own extraction rule rather than retyped; sha256 of each inserted block is
`ca9bf25b…67051f`, the digest AC7.1 pins. Neither test was weakened: no edit to
`test/story-15-5-workflow-skills.test.js` and none to Story 31.4's guard.

**What the failure looked like before it was fixed**, kept because the disposition table
above was walked against it. `test/story-15-5-workflow-skills.test.js` read **157/0 on
`main`, 153/4 on this branch.** The four failures were all `<skill> preserves original
content verbatim`, on `add-sprint`, `add-to-sprint`, `modify-sprint` and
`sprint-status-view` — a body ~12,500 characters longer than the source, the size of
Story 31.4's preflight block.

That was the genuine contradiction recorded in
`bug-31-4-preflight-block-breaks-story-15-5-verbatim-invariant.md`: Story 15.5's
invariant says a converted workflow skill's `SKILL.md` must contain the original content
**verbatim**; Story 31.4 AC3/AC4 require the staleness guard to be **embedded in those
skills as the first `##` section**. Both cannot hold for the same file. Three candidate
resolutions were on record and none had been chosen. **It was the release gate's headline
finding, it needed a decision rather than a patch, and it got a decision** — see the
status box above.

#### The recommendation, which was not a decision — and which was subsequently adopted

The first draft of this record offered none. That was wrong: the bug's own AC1 asks that
the contradiction be *"adjudicated explicitly and recorded"*, and it names **"a human *or*
Story 31.14's release gate"** as the venue. Declining the second half of a job I was
offered is not neutrality, it is an omission. So — **a recommendation, with the reasoning
exposed so it could be overruled.**

> **It was not overruled. The human authorised it and it was implemented at `d5dbab5`,
> exactly as written below, `remove-from-sprint` included — before any independent review
> saw the implementation.** The sentence that stood here until fix round 5 — *"The human
> still chooses, and I have implemented none of it"* — was true when written and false
> from `d5dbab5` onward. It is corrected rather than deleted so the sequence stays legible.

**What the test actually enforces, checked rather than assumed.**
`verifyContentPreserved` (`test/story-15-5-workflow-skills.test.js:222`) does
`assert.strictEqual(body, original)` — **strict equality**, not containment — where `body`
is `lib/bmad-extension/skills/<name>/SKILL.md` after frontmatter stripping and `original`
is the authored source under `lib/bmad-extension/workflows/<name>/`. Two consequences the
options list does not draw out:

- **Any byte added to the skill body breaks it.** So option 3 as written — "move the guard
  somewhere the verbatim check does not scan, while keeping it ahead of skill logic" —
  cannot leave so much as a one-line pointer in the body. It needs the pointer in the
  frontmatter (which *is* stripped before comparison) or in `skill.json`, and it then has
  to be shown that an agent reads that pointer before the body. That is a real design
  question, not a formatting one.
- **The comparison is between two files this repository owns.** `lib/bmad-extension/
  workflows/**` is this project's own authored text, not vendored upstream content — the
  same fact FIX-2's attack 2 turned on.

**My recommendation: a variant of option 3 that is not on the list — put the block in the
SOURCE as well.** Add the preflight to `lib/bmad-extension/workflows/<name>/`'s authored
content, at the same gateway position, so the skill body and the source *both* carry it.

**The insight, stated plainly, because it is the whole reason this beats options 1–3: the
contradiction was never between the two delivered requirements. It was between the
requirement and the CONVERTER.** Story 31.4 says the block must be the first `##` section
of the shipped `SKILL.md`. Story 15.5 says the converter must not add bytes. Neither
statement contradicts the other — what contradicts is the *implementation choice* that the
converter is where the block gets added. **Move the addition upstream of the converter and
both invariants hold strictly, at full strength, with nothing weakened.** Options 1, 2 and
3 each concede something: option 1 concedes strict equality across every converted skill
forever, option 2 concedes the staleness guard, option 3 concedes the block's position in
the body. **This concedes nothing.** That is not a preference between four trade-offs; it
is the observation that the trade-off was an artefact of where the code put the work.

Why I prefer it:

- **It weakens neither delivered requirement, and unlike option 3 it does not have to
  relocate anything.** Story 31.4 AC3/AC4 hold unchanged — the block stays the first `##`
  section of the shipped `SKILL.md`. Story 15.5's invariant holds unchanged **and in its
  strict form**: the conversion remains byte-for-byte lossless and additive-free, because
  the converter is no longer the thing adding the block. The contradiction dissolves
  rather than being arbitrated.
- **It puts the guard where the requirement it enforces actually lives.** All four skills
  resolve `sprint_management_path` from the generated config, which is exactly 31.4's OQ-3
  criterion for needing the guard. If the *workflow* needs the preflight, the workflow
  should say so; the current arrangement has the installer injecting it into a derivative
  and the source silently disagreeing.
- **Option 1 (containment) is the one I would argue against most strongly.** It converts a
  strict equality into a substring check across every converted workflow skill, and it
  buys the epic exactly one exemption at the price of permanently disabling the property
  for everything else. **Option 2 the bug already rates weakest**, and I agree — it trades
  a real staleness hole for a green suite.

**A live trap, and the recommendation should cover it** *(written before `d5dbab5`; the
trap is described as it stood then, and what became of it is recorded immediately after)*.
`remove-from-sprint` **has** a
workflow source (`lib/bmad-extension/workflows/remove-from-sprint/workflow.md`) **and** its
converted `lib/bmad-extension/skills/remove-from-sprint/SKILL.md` carries the preflight
block — but it is **absent from `extFiles`**, the six-entry list at
`test/story-15-5-workflow-skills.test.js:276` that drives `verifyContentPreserved`. So it
is in exactly the state the four failing skills are in, and the only reason it is not a
fifth failure is that nobody listed it. **The day anyone adds it for completeness, the
suite breaks the same way.** *(Verified: five workflow-sourced skills carry the block in
their converted `SKILL.md` — `add-sprint`, `add-to-sprint`, `modify-sprint`,
`sprint-status-view`, `remove-from-sprint` — and none of the five carries it in its
source. `create-bug-story` and `project-context-expansion` carry it in neither, which is
why they pass.)*

**So the recommendation is: add the block to `remove-from-sprint`'s source too**, not only
to the four that happen to fail today. The invariant worth holding is *"every
workflow-sourced skill carrying the preflight block has it in its source"* — which holds
uniformly, survives someone completing `extFiles`, and does not depend on which subset a
test currently enumerates. Fixing only the four leaves a latent fifth failure armed.

> **ADOPTED, INCLUDING THIS PART.** `d5dbab5` put the block in all **five** sources. The
> fifth copy is what FIX-6 below is about, and it is also where attack 7 came in — the
> `remove-from-sprint` source is the one file in the tree whose block cannot terminate its
> own extent (§9 item 30). Including the fifth copy was still right; the cost of it was a
> defect nobody looked for.

**What I did not verify, and a human must before adopting this** *(written before the
adoption; both items were subsequently checked at `7e9f00e`, and the outcome is recorded
under each)*. I have not run it. Two things still need checking: (a) whether `lib/bmad.js`'s
deploy path would then emit the block *twice* into some pipeline; (b) whether Story 31.4's
completeness test, which fails when a skill resolving a binding-derived field lacks the
guard, is satisfied by a source-carried block.

> **(a) — CHECKED, no double emission.** There is no live workflow→skill converter: the
> Story 15.5 conversion was a one-time authored step whose output is committed, and
> `scripts/build-plugin.js` copies `lib/bmad-extension/skills/` only. `npm run
> build:plugin` was run with the block present in the sources — exit 0, and `git status
> --porcelain` afterwards showed no modification to any `SKILL.md` or to
> `lib/bmad-extension-plugin/`.
>
> **(b) — CHECKED by observation rather than by reasoning.** Both pins held across the fix
> unchanged: preflight **41 copies / one sha256 `ca9bf25b…` / 13-14-14**, gate **9 / one
> sha256 / 3-3-3**, and `story-15-5-workflow-skills` went 153/4 → **157/0**. Story 31.4's
> completeness check counts copies of the block in the shipped `SKILL.md`s, which the fix
> did not touch, so it is satisfied for the same reason it was before. **This is a
> pass-by-non-disturbance, not a positive proof that a source-carried block would satisfy
> it if the converted copy were ever removed.**

**On (c) — the 41-copy preflight invariant — my earlier caveat was too pessimistic, and it
is corrected here in my own favour.** It said the 41-copy invariant "would stop covering
the copy this resolution relies on". It would not, because **the source copy is pinned
TRANSITIVELY**:

- Story 15.5's `verifyContentPreserved` does `assert.strictEqual(body, original)` — strict
  equality, so it binds **source ≡ converted**, byte for byte, in both directions;
- AC7.1 digest-pins the **converted** copy, and its 41 contains
  `lib/bmad-extension/skills/<name>/SKILL.md` for **all four** of `add-sprint`,
  `add-to-sprint`, `modify-sprint` and `sprint-status-view` *(verified by enumeration —
  each appears three times in the 41: once under `skills/`, once under
  `lib/bmad-extension/skills/`, once under `lib/bmad-extension-plugin/skills/`)*.

**The chain closes both ways.** Edit the source and 15.5 fails; edit the converted copy and
AC7.1 fails. Nothing drifts silently.

**The genuine residual is narrower than I first stated.** It is this: **no test digests the
source file directly.** The pin is transitive, so it depends entirely on those four staying
in `extFiles` — remove one and that source block goes **unpinned in both directions at
once**, because the only thing binding it to the digested copy was the strict-equality
assertion that entry drives. That is a real fragility and worth an assertion of its own,
but it is a much smaller one than "AC7.1 would need extending".

#### FIX-6 — the fix landed straight into that fragility, and one copy shipped unpinned

**The paragraph above named the failure mode and then the fix walked into it.** Of the five
source copies `d5dbab5` created, four are transitively pinned by the chain described above.
The fifth — `lib/bmad-extension/workflows/remove-from-sprint/workflow.md` — is bound by:

- **not `verifyContentPreserved`.** `remove-from-sprint` is absent from `extFiles`
  (`test/story-15-5-workflow-skills.test.js:276`, six entries), so no strict-equality
  assertion binds its source to its converted `SKILL.md`. Adding it would still fail, on
  the *second*, unrelated divergence that file carries — a Story 17.22 `## Backend Routing`
  block and two pre-write validation `<action>`s authored into the `SKILL.md` only.
- **not AC7.1.** `collectBlocks` walks only the three `skills/` roots, and
  `lib/bmad-extension/workflows/` is a prefix of none of them. The 41-copy count is
  unreachable from that source by construction — the very property `7e9f00e` proved in
  order to show the count could not move.

So from `d5dbab5` to fix round 5 that block copy was **unpinned in both directions at
once** — exactly the sentence above, arrived at from the other end. And it was worse than
unpinned: under the old heading-to-next-`## ` rule the block extracted out of that file was
**138 lines, digest `00ba6d40cb1fa3be…`, not the pinned `ca9bf25b…67051f`** — because
nothing after the block in that file is a document heading (§9 item 30).

**What pins it now, stated precisely because "it is covered" is the claim this section
exists to distrust.**

- **AC7.5j does pin this copy, in the forward direction, by digest.** The new
  canonical-length control walks every shipped file, and for this one it asserts that the
  carve-out at **lines 5–115** is **byte-identical to the canonical `ca9bf25b…67051f`
  block**. Edit those 111 lines in that source and AC7.5j fails. That is a direct digest
  pin on the source file, and it is the assertion the residual paragraph above asked for.
- **AC7.5j also pins the anomaly itself.** It names this file as the one known raw-extent
  over-run (5–142, 138 lines against a 111-line block), so the condition cannot silently
  spread to a sixth copy.
- **What AC7.5j does NOT do.** It does not bind source ≡ converted for this skill: the rest
  of the file, including the two `SKILL.md`-only divergences, is still unbound in both
  directions. It does not put `remove-from-sprint` into `extFiles` and it does not put the
  copy into AC7.1's 41. **A `SKILL.md` whose body drifts from this source outside the block
  is still caught by nothing.** That residual is unchanged and is recorded as §9 item 31.

#### Where this item now stands

**The recommendation was adopted and implemented at `d5dbab5`. Neither test was weakened
or edited. `story-15-5-workflow-skills` is 157/0.** What stood here until fix round 5 —
*"This remains a recommendation. AC9 stays NOT MET, nothing here is implemented"* — was
false in its second and third clauses from `d5dbab5` onward.

**AC9 still stays NOT MET, but no longer for this reason.** The reasons are now, and only:

1. **Linux/CI was never run.** No Linux host was available. Every Linux claim in this
   document is inference, and inference is not a run.
2. **Nine pre-existing failures** stand in the chain, and `npm test` short-circuits at
   **position 11** (`bmad-version-bump`) regardless of anything this epic did.

**`story-15-5` is not one of the reasons any more.** The implementation is nonetheless
**unreviewed**, and this record is not the place that changes: no verdict is claimed here.

### The two that look like failures and are not

- **`project-layout-two-store-round-trip` — 52/0 green when run alone.** It was killed at
  the per-suite cap. The cause is now known precisely: it drives four **real**
  `ma-agents install --yes` runs, each of which spawns bmad-method, which spawns a real
  **`npm install --omit=dev --no-audit --no-fund --no-progress` against the public npm
  registry** (observed directly in the process table: `cli.js install --yes` →
  `bmad-cli.js install` → `npm install`). The registry is reachable from this machine
  (`npm ping` = 348 ms), so this is slowness with an unbounded external dependency, not a
  deadlock. **This is itself a finding**: a suite in the `npm test` chain of a product
  whose headline NFR is air-gap operation performs a live network install, which makes
  the suite non-hermetic and its runtime unbounded. It is not an Epic 31 defect — the
  real-install pattern predates it — but the gate should say so.
- **`project-layout-artifact-routing` — 59/0 on a clean tree.** Its single in-chain
  failure was `skills/open-presentation/SKILL.md -> _bmad-output/methodology/…pptx`,
  i.e. Story 31.6's "no shipped skill cites a file this repository does not ship" guard
  firing because an **earlier suite in the same run had materialised the gitignored
  `_bmad-output/methodology/`**. That is `bug-tests-mutate-the-repository-they-run-in`
  producing a false failure exactly as filed.

### The mutation itself, and what I could not pin down

The full-chain run left **524 dirty paths** in the worktree — a regenerated `.agents/`
tree, `.ma-agents.json`, an `AGENTS.md.backup-*`, `_bmad/`, `_bmad-output/methodology/`
and `.ma-agents-plugin-stage/` — **with `repo-layout` excluded.** So at least one suite
*other than* the two named in that bug also installs into the worktree it runs in.

I attributed it. Seventeen hand-picked candidates were run individually from a
verified-clean tree, measuring **install residue only** (`.agents/`, `_bmad/`,
`_bmad-output/methodology/`, `.ma-agents-plugin-stage`, `.ma-agents.json`,
`AGENTS.md.backup-*`), so my own concurrent edits could not contaminate the reading —
`global-install-scope`, `project-layout-two-store-wizard`,
`project-layout-legacy-single-store`, `reconfigure`, `uninstall`,
`integration-verification`, `agents-md`, `rename-migration`, `retired-skills-migration`,
`config-path-migration`, `obsolete-tool-dirs`, `agent-scope`, `diag`, `offline-recompile`,
`customizations-translation`, `bmad-extension`, `routing-parity`. **All seventeen came
back clean.** So I instrumented the **whole chain**, restoring between every suite.

**The mutator is `test/yes-flag.test.js` — position 1 in the chain. Residue 0 → 520, and
it is the ONLY one:** the instrumented run completed all 103 of the 104 (repo-layout excluded) and reported exactly
one `MUTATES` line. Confirmed directly afterwards by running it alone from a
verified-clean tree — **`node test/yes-flag.test.js` → exit 0, 522 dirty paths**, the
regenerated `.agents/` tree plus `.ma-agents.json`, an `AGENTS.md.backup-*`, `_bmad/`,
`.ma-agents-plugin-stage/`, `_bmad-output/methodology/` **and a written
`_bmad-output/project-layout.yaml`.**

That is a materially worse fact than the filed bug describes, and it is worth stating
plainly:

- `bug-tests-mutate-the-repository-they-run-in` names `repo-layout` (position 20) and
  `build-plugin` (position 65). It does not name `yes-flag`, so its stated scope is
  **incomplete**.
- Because `yes-flag` runs **first**, **every `npm test` invocation begins by dirtying
  ~520 paths**, and every one of the other 102 suites therefore runs against a mutated
  working tree — including the `_bmad-output/methodology/` materialisation that produced
  `project-layout-artifact-routing`'s false 58/1 above. The bug's "concurrency" framing
  understates it: no concurrency is required, only ordering.
- One of the paths it writes is `_bmad-output/project-layout.yaml` — **this repository's
  own committed knowledge binding.** It happens to write the same single-repo default the
  repository already has, so no harm has occurred; but a suite writing an authoritative,
  committed binding into the repository it runs in is a sharper edge than "regenerates
  `.agents/`", and it is new information relative to the filed bug.
- This is **not** an Epic 31 defect. `yes-flag` is a pre-existing suite and its
  real-install behaviour predates F26. But it is the mechanism behind the false failure
  this gate had to chase, and the follow-up story that adopts that bug should add
  `yes-flag` to its scope.

**Two files show as modified throughout and are byte-identical to `HEAD`:**
`skills/git-workflow-skill/skill.json` (verified, sha256 `872ba9a1…`) and
`_bmad-output/project-context.md` (`git diff` is empty). Both are git's CRLF filter, not
changes. Left alone.

**Cleanup used throughout:** `git checkout -- .agents AGENTS.md _bmad-output`, `rm` the
root artifacts, `git clean -fdq .agents _bmad-output` — never `-x`, which would delete the
`node_modules` junction.

### What AC9 would take

1. ~~**Adjudicate the 31.4/15.5 contradiction** and land the chosen resolution. Until then
   the chain has a red suite that `main` does not.~~ **DONE — this is no longer one of the
   things AC9 takes.** The human authorised §4's recommended resolution and it was landed
   at **`d5dbab5`**; `story-15-5-workflow-skills` is **157/0, exit 0**, matching `main`, so
   the chain no longer has a red suite that `main` does not. The implementation has **not**
   been independently reviewed, and it introduced attack 7 (§9 item 30), now fixed. **The
   two items below are the entirety of what AC9 still takes.**
2. **Nine pre-existing failures** stand between position 11 and the end of the chain, so
   `npm test` short-circuits at position 11 (`bmad-version-bump`) regardless. Three are a
   shared-`node_modules` version skew (6.9.0 vs 6.10.0), two are missing Atlas
   dependencies, and the rest are their own tickets. **The new gate suite is registered
   at position 104 and is therefore unreachable via `npm test` today.** Run it directly:
   `node test/release-gate-epic-31.test.js` (**42 passed, 0 failed, exit 0** on this branch after fix round 4; 40/0 after round 3, 38/0 after round 2, 37/0 after round 1, 33/0 before it). *(This figure said "38" through the whole of round 3, when the code held 40. Re-derive it from `EXPECTED_TEST_COUNT`, which the suite itself asserts against the number of tests that actually ran, rather than from this line.)*
3. **Linux/CI was never run.** I have no Linux host. Every Linux claim in this document is
   inference, and inference is not a run.

### `skills/git-workflow-skill/skill.json`

Shows as modified in `git status` throughout. Verified byte-identical to `HEAD`
(sha256 `872ba9a1…`); the flag is git's CRLF filter. Left alone, as instructed.

---

## 5. Invariants, re-derived by an independent walk

Both were re-derived from **committed blobs** (`git show HEAD:<file>`), never the working
tree — `.agents/` is regenerated mid-run by the suites and would otherwise contaminate the
count. Enumeration is `git grep -l` against the revision; the block is taken from a line
that is **exactly** the heading up to the next column-0 `## `; CRLF normalised to LF;
sha256 over the result.

| Invariant | Expected | **Derived** | Distribution |
|---|---|---|---|
| Story 31.4 preflight (`## Knowledge Store Binding Preflight`) | 41 copies, one sha256 `ca9bf25ba475` | **41 copies, 1 distinct digest, `ca9bf25ba475f11ac760e8c92a2d41f92a21298d9f11df55881527673e67051f`** | 13 `skills/` + 14 `lib/bmad-extension/` + 14 `lib/bmad-extension-plugin/` — **exactly as stated** |
| Story 31.9 gate (`## Knowledge Store Backend Routing`) | 9 copies, one sha256 `cda3d3d99cff` | **9 copies, 1 distinct digest, `cda3d3d99cff06edb3b7bbb00bc1399d6a060fc153829fba7108cdfb91b09cfb`** | 3 + 3 + 3 — **exactly as stated** |

Both are now pinned as tests (AC7.1, AC7.2), including the distribution, so a block that
lands in one deploy pipeline and not the other fails.

**The loose-probe control, confirmed — and both numbers here were wrong.** A naive
`Backend Routing` substring probe over-matches, because it also hits Story 17.22's
sprint-tracking `## Backend Routing` block, which is a different block present in every
sprint skill. The exact-heading anchor is load-bearing. But the figures:

- **It is 61 tracked markdown files, not 60.** `git grep -l "Backend Routing" HEAD --
  "*.md"` returns 61 at `HEAD`, and 61 in the working tree. The record's own gate-record
  commit is one of the matches — this document quotes the heading, so writing the "60"
  claim made it 61.
- **AC7.3 does not measure that population.** It walks *shipped skill markdown* (316
  files), not tracked markdown, and the loose probe there matches **36**, not 61 — a 4×
  over-match against the gate's 9, not 6.7×. Citing the tracked-markdown figure as if
  AC7.3 pinned it conflated two different measurements.
- **And AC7.3 previously pinned no number at all.** It asserted `loose.length > 9`, which
  is satisfied by 10 and by 10,000. The claim that it was "pinned so nobody can quietly
  loosen it" was not true: an inequality with a floor of 9 is not a pin. It now asserts
  **exactly 36** over its own population, the same way AC7.1 and AC7.2 pin 41 and 9, with
  a failure message that says re-adjudicate rather than relax. Both figures — 36 shipped
  skill files, 61 tracked files — are recorded in the test's comment so the two are not
  conflated again.

**Quotations correctly do not count.** The run-ledger, `epics.md` and the Story 31.6
routing table all *quote* these blocks. They are indented or fenced, so none produces a
column-0 `## <heading>` line and none is counted. Verified by the derived totals landing
on 41 and 9 exactly.

### One thing the invariants do not cover

`.agents/` is a **fourth** tracked deploy surface (592 files at `HEAD`) and it is
**stale**: it carries neither block at `HEAD`, while `skills/` gained both. `git diff
9b936ac..HEAD -- .agents` is **empty** — Epic 31 changed 13 files under `skills/` and zero
under `.agents/`. Consequences:

- `.agents/` is **not** in `package.json`'s `files`, so it does **not** ship in the npm
  tarball. This is a repo-local convention, not a product surface. **Not a shipping
  defect.**
- It *is* why any suite that regenerates `.agents/` immediately produces ~500 dirty
  paths: the committed tree and the source tree genuinely disagree.
- The 41/9 invariants are correct as stated. I record `.agents/` only so a future reader
  is not surprised to find 56 and 13 when they scan a post-test-run working tree, as I
  did on my first pass.

---

## 6. Semver

**Recommendation: MINOR. `3.17.1` → `3.18.0`.** Cut and applied.

**Rationale.** Every F26 change is additive:

- Three **new** commands (`bind`, `confluence-plan`, `confluence-record-root-page`) — all
  verified to exist in `bin/cli.js`'s command routing *and* its help text before being
  documented.
- Two **new** install questions; `--yes` still selects the previous single-repository
  `file-system` default for both stores, so CI and non-interactive installs are
  unaffected.
- **New** generated `config.yaml` fields. The legacy fields (`planning_artifacts`,
  `knowledgebase_path`, `implementation_artifacts`, `sprint_management_path`) are retained
  and resolve to their **pre-epic literal values** — asserted, not assumed (AC2.3).
- One **new** committed file.

No existing command, flag or generated field is removed or changes meaning. Consistent
with the prior epic cuts (3.15.0, 3.16.0, 3.17.0), all feature additions taken as MINOR.

### What argues against MINOR — stated, because the instruction is to state it

Four candidates were considered. **None rises to a breaking change to the public CLI**,
but a reviewer should weigh them rather than take my word:

1. **`_bmad-output/project-layout.yaml` is now written unconditionally, and the previous
   code *deleted* it in single-repo mode.** For a project that was relying on that
   deletion, a new committed file appears. This is a behaviour change to a
   version-controlled artifact — the strongest argument on the list. It is not a *CLI*
   break (no command, flag or exit code changes), NFR76 explicitly rebaselines the
   comparison to post-FR263 behaviour, and the file is additive. **Recorded so a
   reviewer can disagree.**
2. **`_bmad/bmm/config.yaml` is now generated rather than written directly.** A user who
   hand-edited it will find their edits overwritten on the next install or bind. Mitigated
   by design: the per-developer TOML overrides are never touched, and the generator
   *refuses* rather than overwriting when the binding is unreadable (AC5.6). But a
   hand-edited generated file is a real-world thing.

   > **Correction — this argument is weaker than I claimed, which strengthens MINOR.**
   > `config.yaml` was **already** written and field-overwritten before this epic.
   > `9b936ac:bin/cli.js:596` — that is, the pre-F26 code on `main` — does
   > `content = writeConfigField(content, 'planning_artifacts', planningArtifacts)` and
   > several sibling calls, then `fs.writeFileSync(configPath, content, 'utf-8')`. A user
   > who hand-edited `knowledgebase_path`, `sprint_management_path`, `planning_artifacts`
   > or `implementation_artifacts` **already lost those edits on the next install**, before
   > F26 existed. What F26 changes is *where the values come from* (the committed binding
   > rather than the install answers), not *whether the file is rewritten*. So this is not
   > a new hazard, and it is materially weaker as an argument against MINOR than the draft
   > above presented it. **Accuracy runs both ways: this correction is in the direction
   > that favours the recommendation, and it is recorded for the same reason as the ones
   > that do not.**
3. **A global install no longer installs BMAD agents *and no longer tells you to re-run
   without `--global`*.** The old message framed a working mode as a failure, so this is a
   strict improvement — but scripts that grepped for that message will not find it.
4. **`schema_version` moves to 2.** Older ma-agents reading a schema-2 binding take the
   `too-new` fail-loud path. That is a forward-compatibility property, not a break in this
   direction — this release reads both.

**If a reviewer judges (1) or (2) breaking, MINOR is wrong and the cut must be MAJOR.** I
do not believe either is, and the PRD's own rebaselining of NFR76 supports that reading —
but the judgement is not mine to close.

**Files bumped:** `package.json`, `package-lock.json` (2 occurrences), and
`lib/bmad-extension-plugin/.claude-plugin/marketplace.json` via a fresh
`npm run build:plugin` (the Bundle Drift Guard enforces this). The orphan build directory
the script leaks was deleted. `test/plugin-manifests.test.js` re-run after the rebuild:
**29/0**.

---

## 7. Docs and CHANGELOG

**`README.md`** gains a **"Knowledge Stores and the Project Binding"** section covering
all five surfaces AC8 names — the two store questions, the install-scope question and
what a global answer now does, the Confluence backend and its MCP requirement, `ma-agents
bind`, and the two fail-loud behaviours — plus a "What's New in v3.18.0" block, and the
three new commands in the CLI usage list. Every documented command was checked against
`bin/cli.js`'s own `case` routing and help text first, so the docs describe the shipped
surface rather than the intended one.

**`CHANGELOG.md`** gains a `[3.18.0] - 2026-08-24` entry, Keep-a-Changelog structured,
carrying two sections the prior cuts did not need:

- **"Deliberately not implemented"** records FR266's retirement and *why* — so a future
  maintainer who finds no mirror does not helpfully add one.
- **"Known limitations"** records the mock-verification bound, the missing publish path,
  the `generated:` date residual and the Windows `npm test` state.

> ### 🔴 `CHANGELOG.md` does not ship on npm, and this section claimed it did
>
> **Verified:** `npm pack --dry-run --ignore-scripts` yields **1,929 files** and
> `CHANGELOG.md` is **not among them**. `README.md` is. The cause is plain —
> `package.json`'s `files` list names `README.md`, `SKILLS_STRUCTURE.md`,
> `CONTRIBUTING.md`, `QUICK_START.md` and `LICENSE`, and not `CHANGELOG.md`.
>
> This falsifies the sentence above ("in the shipped changelog") and the FR266 boundary
> statement in §3 that asserted both `README.md` and `CHANGELOG.md` ship. Both are
> corrected.
>
> **The decision, stated rather than silently dropped.** GitHub visibility is **not**
> sufficient for these two sections. Both exist to reach a future *maintainer or user of
> the package* — "do not helpfully add the mirror we deliberately did not build", and "the
> MCP-present paths are mock-verified, so do not trust them as tested". A reader who
> installs from npm and never visits the repository is exactly the reader they are written
> for, and that reader was never going to see them.
>
> So they are **reproduced in `README.md`**, which does ship, under "Deliberately not
> implemented" and "Known limitations of v3.18.0". `CHANGELOG.md` keeps its copy for
> GitHub readers and now carries a blockquote saying it does not ship and asking that the
> two be kept in step.
>
> **The shipped copy is deliberately the stronger of the two.** The changelog copy omitted
> the two FR262 coverage gaps this gate found (the Knowledge Atlas rendering a
> Confluence-backed store from stale local files; a Confluence-backed *system* requirements
> store having no ma-agents-owned fail-loud gate) and the Windows test-suite state. The
> README copy carries all of them, so a user reading the package does not get a
> sanitised list.
>
> **This is a duplication and duplications drift.** The note in `CHANGELOG.md` is the only
> thing holding them together, and it is a request, not a check. A follow-up could assert
> the two in step; nothing does today.

**`docs/architecture.md`** §3.6.1 (landed with Story 31.9) already states the air-gap
posture with a Confluence-backed store; not re-edited.

---

## 8. Disposition of all 20 filed defects

`_bmad-output/implementation-artifacts/bug-*.md`. Every one categorised. Where a bug's
own header still says OPEN but the code says otherwise, I checked the code and say so.

### Closed by this epic (4)

| Bug | Evidence |
|---|---|
| `bug-31-2-ac5-no-rewrite-half-was-never-implemented` | Its own header records **CLOSED by Story 31.7** (legacy preservation in `writeProjectLayoutYaml`). Corroborated: `project-layout-legacy-single-store` 52/0 and the round-trip's "(c) `install --yes` keeps a LEGACY single-store project on its config.yaml path" |
| `bug-read-existing-layout-collapses-two-stores-onto-software-store` | Header still says "OPEN — blocks Story 31.5". **The code disagrees and the code is right.** `readExistingLayout` now returns the full three-record `topology` additively, with `knowledge base` kept only as a back-compat alias onto the software store. Pinned by `project-layout-two-store-round-trip` 52/0 |
| `bug-serialize-sprint-management-passes-store-modes-enum` | Header says OPEN. **Fixed.** `serializeSprintManagement` now passes `SPRINT_MODES` to `assertWritableMode`; `STORE_MODES` survives only in the explanatory comment. Pinned by `project-layout-enum-single-source` 31/0 |
| `bug-show-current-layout-prints-undefined-for-confluence-store` | Header says OPEN. **Fixed.** `showCurrentLayout` renders through the per-backend identity view (`summarizeStoreIdentity` / `storeIdentityFields` / `renderIdentityValue`), which throws rather than degrading for a backend with no view |

> **Three bug files carry a stale `Status:` header.** The three above say OPEN (all three
> "blocks Story 31.5") when the code shows them fixed. That is a records-hygiene problem,
> not a code problem — but a reader trusting those headers would over-count this epic's
> open defects by three. Left unedited, per this epic's standing rule that a gate reports
> contradictions rather than resolving them.
>
> **This count was four in the first draft of this record, and the fourth was wrong.**
> The reviewer checked `bug-store-from-raw-open-codes-the-default-backend` against the
> source and found the file's OPEN header is **right and this record was wrong**; it is
> now dispositioned as open, below. Because that claim was falsifiable and false, the
> other three were **re-verified against `git show HEAD:bin/cli.js`** for this fix round
> rather than restated:
>
> - `read-existing-layout-collapses…` — its repro's *Actual* was "the system store is
>   rewritten as a `file-system` store pointing at the software store's location". The
>   pre-population path is `existingRecordForConcern` (`bin/cli.js:3008`), which now reads
>   `topology[concern.key]` **first** and falls back to the collapsed `knowledgebase` view
>   only when there is no topology. Each store pre-populates from its own record.
>   **Genuinely fixed.**
> - `serialize-sprint-management-passes-store-modes-enum` — `serializeSprintManagement`
>   (`bin/cli.js:2377`) reads `assertWritableMode(…, SPRINT_MODES, 'sprint_management')`.
>   `STORE_MODES` survives only in the explanatory comment above it. **Genuinely fixed.**
> - `show-current-layout-prints-undefined-for-confluence-store` — its repro's *Actual* was
>   `Mode: undefined / Path: undefined`. `showCurrentLayout` (`bin/cli.js:4600`) now
>   renders every store through `storeIdentityFields`, which **throws** for a backend with
>   no registered view rather than falling through to the file-system field names — the
>   exact substitution that produced the `undefined`s. **Genuinely fixed.**

### Open, owned by a named follow-up, and bearing directly on this gate (5)

| Bug | Disposition |
|---|---|
| `bug-31-4-preflight-block-breaks-story-15-5-verbatim-invariant` | **RESOLVED ON THIS BRANCH at `d5dbab5` — it no longer blocks AC9.** It was the gate's headline finding, independently re-confirmed here as 157/0 on `main` against 153/4 on this branch: a genuine contradiction between two delivered requirements, three candidate resolutions, none chosen. **The human adjudicated it and authorised §4's recommended variant**, which was then implemented — the preflight added to five workflow **sources**, `remove-from-sprint` included. `story-15-5-workflow-skills` is now **157/0, exit 0**. **Neither test was weakened or edited**, which is what its own report forbade. Two things this row does not claim: **the implementation has not been independently reviewed** — it was landed before any reviewer saw it — and it **introduced a new defect**, attack 7 (§9 item 30, fixed in fix round 5). **The bug file's own `Status:` header was not edited by this gate** (this record corrects itself, it does not edit other artifacts), so the file still reads OPEN; adopting the disposition is a follow-up action for its owner |
| `bug-tests-mutate-the-repository-they-run-in` | **OPEN, and it bit this gate twice**: it produced `project-layout-artifact-routing`'s false 58/1, and it left 524 dirty paths in a run with `repo-layout` excluded. **Its stated scope is incomplete** — an instrumented full-chain run attributes that to `test/yes-flag.test.js`, chain **position 1** (522 dirty paths standalone, including a written `_bmad-output/project-layout.yaml` — this repository's own committed binding). The bug names `repo-layout` and `build-plugin` only. Because `yes-flag` runs **first**, every `npm test` begins against a dirtied tree — no concurrency required, only ordering. Not an Epic 31 defect; all three suites predate it. **The follow-up story that adopts this bug must add `yes-flag` to its scope.** |
| `bug-npm-test-windows-suite-health-chain` | **OPEN, partly stale.** Its headline claim — `reconfigure.test.js` test 8.8 fails standalone on Windows — **did not reproduce**: `reconfigure` exits 0 on this branch, both in-chain and standalone. The structural claim (the `&&` chain masks downstream failures) is entirely correct and is why this gate ran all 103 suites individually. The chain now halts at **position 11** (`bmad-version-bump`), not position 32 |
| `bug-bmad-knowledge-atlas-renders-a-confluence-backed-store-from-stale-local-files` | **OPEN — a real FR262 coverage gap.** `bmad-knowledge` renders a Confluence-backed store's section from local files, silently. The AC7 negative and the AC5 gate cover the *routing* skills; the Atlas is a separate consumer that no story in this epic owns. Epic 31's cross-epic notes said the Atlas interaction "should be confirmed at the Story 31.14 gate" — **this is that confirmation, and the answer is that it is not covered.** Needs a follow-up story |
| `bug-system-requirements-store-has-no-ma-agents-owned-confluence-gate` | **OPEN — the second FR262 coverage gap, and it is structural.** The gate block is in 9 shipped skills, all of which resolve *software* requirements. A Confluence-backed **system** requirements store's only consumers are upstream BMM workflows this package does not ship, so ma-agents owns no gate for it. Directly related to the Story 31.10 AC1/AC3/AC5 escalation: the same missing-shipped-skill fact underlies both |

### Open, owned by a named follow-up, not blocking this gate (8)

| Bug | Disposition |
|---|---|
| `bug-store-from-raw-open-codes-the-default-backend` | **OPEN — needs an owner. This record previously listed it as CLOSED and that was false**, on evidence — *"zero literal `'file-system'` occurrences remain in it"* — that is checkable and does not hold. `git show HEAD:bin/cli.js`, `storeFromRaw`, **line 1830**: `const entry = { backend: 'file-system', mode, path: resolvedPath };`. The bug file's own **Reproduction step 3** is *"Observe the `backend: 'file-system'` literal in the file-system branch's returned record"*, so the literal that is still there is precisely the one the bug is named for. **Half the fix landed**: the read at the top of the function does use `DEFAULT_STORE_BACKEND`, which is why a partial check read as a complete one. The returned record still open-codes the default. Not a live defect today — `DEFAULT_STORE_BACKEND` *is* `'file-system'`, so the value is correct by coincidence — and it is the same latent-divergence class as the sprint-modes enum bug above: it becomes wrong the moment the default changes. **Severity low, but the disposition is what matters here: the file's OPEN header is right and this gate's first draft was wrong.** |
| `bug-oq3-guard-scope-misses-skills-that-write-from-nested-prompt-files` | OPEN, filed 2026-08-23. A scope hole in Story 31.4's merged guard: coverage is computed from top-level `SKILL.md` only, so a skill writing planning artifacts from a nested `prompts/` file escapes both the preflight and its own completeness check. Not a live data-loss path. **Note:** the 41-copy invariant is unaffected — it counts copies of the block, not the skills that should have one |
| `bug-dev-epic-pipeline-does-not-own-the-story-status-field` | OPEN, high, **process defect not product defect** — story subagents write `done` on self-report, inverting the review gate. Out of scope for a release gate but worth a maintainer's attention, since it is the mechanism by which an unreviewed story can look finished |
| `bug-knowledgebase-path-has-no-defined-meaning-for-a-confluence-store` | OPEN, explicitly filed as **a question, not a defect**. `knowledgebase_path` is written as `.` for a Confluence store because that is what the old code fell through to. Nothing is broken today; AC2.3 pins the value at `.` precisely because changing it would move resolved artifact paths and violate NFR82. Deciding it later is the correct sequencing |
| `bug-uninstall-skill-hardcodes-project-scope-on-update` | OPEN, needs triage. Bears on the global-install thread (a global install's update removes skills from the project location, orphaning the global copies) but is not in any Epic 31 story's scope |
| `bug-marker-merge-orphan-start-drops-content` | OPEN, backlog. Pre-existing, unrelated to F26 |
| `bug-root-skills-dir-orphaned-artifact-dirs-on-install` | OPEN, backlog. Pre-existing. **This is bug B3 (root `skills/`), which I was instructed not to touch** |
| `bug-custom-marketplace-stage-survives-install-and-is-not-gitignored` | OPEN, low, backlog. Epic 30 territory. Partially addressed by commit `b222f54` on `main` |

### Out of scope and pre-existing (3)

| Bug | Disposition |
|---|---|
| `bug-fr123-custom-content-flag-name-stale-upstream-renamed-custom-source` | OPEN, low, **documentation-only staleness**. The code already probes for both flag spellings. Epic 27/30 territory |
| `bug-wds-installed-by-default-creates-design-artifacts` | `ready-for-dev` — the PRD amendment landed 2026-08-02. Epic 30 territory, has its own path forward |
| `bug-docs-dir-created-empty-by-default-on-every-install` | **WON'T FIX**, closed 2026-08-02. No action |

**Totals: 4 closed by this epic, 13 open with a named owner or follow-up, 3 out of scope
(one of them already closed as WON'T FIX).** Of the 13 open, **two are genuine FR262
coverage gaps** (Atlas staleness; the system requirements store having no ma-agents-owned
gate).

> **Correction (fix round 5).** This sentence used to continue *"one blocks AC9
> (31.4/15.5)"*. **Nothing in this section blocks AC9 any more.** 31.4/15.5 was resolved on
> this branch at `d5dbab5` and `story-15-5-workflow-skills` is 157/0. The totals are
> deliberately **unchanged at 4 / 13 / 3**: the bug's own file still carries an `OPEN`
> header, this gate does not edit other artifacts' status headers, and counting it as
> closed here while its file says otherwise is precisely the kind of quiet renumbering the
> note below this table warns against. The two remaining blockers on AC9 are *"Linux never
> run"* and the nine pre-existing chain failures — see §4.

> **These totals were 5 / 12 / 3 in the first draft.** One bug moved from closed to open
> because its closure evidence was false — see `store-from-raw` above. The correction is
> recorded rather than applied silently, because a gate that quietly restates its own
> numbers is worth nothing. The general lesson, which applies to every "fixed" row in this
> section: **a partial fix reads exactly like a complete one to a check that stops at the
> first piece of confirming evidence.** The three surviving closure claims were each
> re-verified against the bug file's own reproduction steps for this fix round, not
> against the fix's own description.

---

## 9. Everything I could not verify, and why

This is the most important section in the document. An honest limit is worth more than a
confident claim, and this epic's record is that the confident claims are the ones that
failed.

> **Fix round 4 touched this section and added no new item.** All **29** items stand;
> nothing was deleted. **Item 16** was rewritten — it recorded the non-markdown scope hole
> as *open*, and that hole is now closed for `.toml`/`.yaml`/`.yml`/`.json` and bounded
> for everything else. Items **9, 14, 26, 28 and 29** were corrected in place with the
> counts and priors that moved. Round 4 is also the round that says the most about how
> these limits get found: **item 16 described the sixth bypass correctly, and recorded it
> as open, for a whole round before anyone acted on it.** Writing a limit down is not the
> same as closing it, and no test in this suite was ever going to tell the difference.

1. **The extended air-gap workflow has never run.** AC1's two new phases are written,
   syntax-checked (`bash -n`, `js-yaml`) and derived from behaviour I verified locally,
   but a GitHub Actions job with Docker and `--network none` cannot execute here. **The
   first CI run is the real evidence and it has not happened.** Every AC1 claim in this
   document is "implemented", never "proven".
2. **Linux/CI was never run at all.** AC3's cross-platform byte-identity and AC9's Linux
   half are both inferences from the absence of platform-dependent constructs. Inference
   is not a run.
3. **Every MCP-present claim is mock-verified.** The `claude.ai Atlassian Rovo` connector
   is unauthorised and cannot be authorised from a non-interactive session. Stories 31.9
   and 31.10 both state this; I re-state it because it is easy to lose. The MCP-*absent*
   path — AC5's actual subject — is the default state and was exercised for real.
4. **Confluence page *creation* is not demonstrable from this package.** Story 31.10's
   AC1/AC3/AC5 remain **partially met**. No shipped skill's purpose is to publish a store,
   and there is no publish command. Escalated, not resolved.
5. **The AC5 text half proves message content, not obedience.** The shipped bytes are
   correct and identical in all nine copies. Whether an LLM actually halts when it reads
   them is not something this repository can establish.
6. ~~The mutation source is unattributed.~~ **RESOLVED** — `test/yes-flag.test.js`, chain
   position 1, and it is the only one of the 103 (§4). What remains unverified is
   `test/repo-layout.test.js`, which was excluded from the instrumented run because it is
   the already-known mutator; I did not re-measure it.
7. **AC2 does not re-prove the whole installer**, only that the F26 write path adds
   exactly one file and changes nothing else. The installer's own end-to-end proof is
   AC1, which is item 1 on this list.
8. **AC6 does not exercise a globally-installed skill activating in a project.** It proves
   resolution is independent of per-machine state and follows its argument. The activation
   half lives in `global-install-scope` (which passes) and AC1 Step 8 (which has not run).
9. **The FR266 closed set is closed over a PLACE and a SUBJECT. Its VERB LIST IS OPEN, and
   an ordinary synonym walks through it.** *(Rewritten in fix round 2. What stood here was
   wrong, and this is what it said: that an evasion would need "a genuinely novel name", in
   "text that never mentions Confluence or a knowledge store" — and it called that
   "remote".)*

   What the set genuinely closes are two of its three axes. **Place:** every tracked
   shipped markdown file (2,332 of them) **plus every tracked shipped `.toml`/`.yaml`/
   `.yml`/`.json` file (382) — 2,714 files**, with the only permitted exceptions pinned by
   the sha256 of the adjudicated bytes and asserted non-stale in both directions.
   **Subject:** the passage must name an F26 store. Those two are enumerated and hold.

   > **Qualification added in fix round 3.** "Place … enumerated and hold" is true **only
   > within markdown.** Place is closed over every tracked shipped *markdown* file and
   > over nothing else. Shipped `.toml`, `.yaml` and JSON agent-readable text is outside
   > the scan entirely, and there is Confluence instruction prose in such a file today —
   > **see item 16**, which carries the limit and the example. Item 9 previously stated
   > the Place axis without that qualification, and a reader who stopped here would take
   > "enumerated" to mean "enumerated over the shipped surface". It is not.

   > **Superseded in fix round 4, and only in part.** The round-3 qualification above was
   > correct when written and its hole is now closed for `.toml`/`.yaml`/`.yml`/`.json`:
   > Place is closed over **2,714** shipped files, and `customize.toml:114` — the very
   > example it cites — is scanned and adjudicated (`649b5cea`, §3). **The shape of the
   > round-3 warning still stands, though, over a smaller remainder:** Place is *still*
   > not closed over the shipped surface. **535 tracked shipped files remain unscanned** —
   > program text, non-covered markup and data, binary formats, dotfiles — enumerated by
   > extension in item 16. A reader who takes "enumerated" to mean "enumerated over the
   > whole shipped surface" is still wrong; the difference is that the remainder is now
   > written down file-type by file-type instead of gestured at.

   **The third axis — the predicate — is a word list, and a word list is not closed against
   natural language.** The Story 31.14 reviewer demonstrated this, and the demonstration
   was not exotic:

   > Before you begin, download every Confluence page in the software requirements store
   > and save it under `_bmad-output/pages/`. Read from there for the rest of the session,
   > and upload your edits back when you finish.

   That is a mirror, a sync direction and a trigger — three of FR266's four named
   machineries — planted in a shipped skill, naming Confluence and the store outright, on
   consecutive lines well inside the four-line window. **The suite returned 37 passed, 0
   failed, exit 0.** It evaded for one reason: all nine vocabulary entries were *nouns of
   art*, the words an architecture document uses, and shipped instruction text is written
   in ordinary imperative product English. `download`, `save` and `upload back` were simply
   not on the list.

   **This was found by attack, not by design.** Nothing in the check's construction
   anticipated it; a reviewer wrote the sentence a normal author would write and it went
   straight through. Three statements follow from that and all three belong in the record:

   - The vocabulary now carries a verb family as well as the nouns, and that exact text now
     fails AC7.5 by name (control: AC7.5e). The verb-extended re-scan over the same
     2,016-file widening is clean, with 8 further hits adjudicated and pinned (§3).
   - **Extending a verb list narrows the gap; it does not close it.** `pull`, `fetch … into`,
     `keep a copy of`, `grab`, `archive`, `stage`, and any synonym a author coins in the
     sentence itself are still absent. Each extension is a response to one attack, and the
     next ordinary word is always available.

     > **CORRECTION (fix round 3), and it is the important one on this page.** That list
     > was written as if it were *the residual* — the words still missing. **It was
     > illustrative and incomplete, and a reader who took it as the residual was wrong in
     > the most consequential possible way: it omitted `copy` and `write`, and `copy` and
     > `write` were the two words the very next attack used.** They were not exotic
     > coinages. They are two of the five verbs **the product's own shipped prohibition
     > names out loud** — *"do NOT write, copy, cache, export or reconcile a local copy of
     > anything Confluence returns"* — and the detector enforcing that sentence could not
     > see either of them. Attack 5 was mounted with both, in a shipped skill file, and
     > the suite returned **38 passed, 0 failed, exit 0** for each form.
     >
     > What follows for the reader: **treat any enumeration of "still absent" words in
     > this document as illustrative only.** No such list has ever been the residual, and
     > this one demonstrably was not. The residual is "every English word not on the
     > list", which is not enumerable, which is the whole content of this item.
     >
     > What follows for the check: the verb half is no longer *only* a list. AC7.5f binds
     > the vocabulary to the shipped prohibition and fails if the product ever forbids a
     > verb the detector cannot see (verified in both directions — see item 26). That
     > closes the vocabulary against **the product's own enumeration** and against nothing
     > wider. Ordinary English outside those five verbs remains exactly as open as this
     > item has always said.
   - **I am not claiming closure here, because I cannot demonstrate it.** What I can
     demonstrate is that the **six** attacks actually mounted against this check all now
     fail *(four when this bullet was written; the fifth is attack 5, above; the sixth is
     the non-markdown population, item 16)*, and that one and a half of its three axes are
     enumerated — Place over 2,714 of the 3,249 shipped tracked files, with the 535-file
     remainder enumerated in item 16; Subject fully; and the verb half of the predicate
     only as far as the product's own five-verb prohibition reaches. A predicate over
     English prose is a heuristic. **This one was called "remote" once already and was
     not.** **Four consecutive rounds of attack have each found a live bypass, and the
     sixth was not found by any test, review layer or design principle in this process —
     a human read item 16 and recognised the vehicle. The prior that a seventh exists is
     not low, and nothing in this document should be read as claiming otherwise**
     (items 16 and 26).
10. **The wall clock on this machine is unreliable.** It advanced ~7.6 hours during a
    single suite run, so every elapsed-time figure I recorded is untrustworthy. This is why
    the round-trip suite's first result read as a hang: the durations were meaningless. All
    verdicts in §4 rest on **re-runs and exit codes**, never on timings.
11. **I did not run `test/repo-layout.test.js`** in the automated chain, because it
    installs ~521 paths into its own worktree. Its status on this branch is therefore
    unknown to me. It is in the chain at position 20 — behind the position-11 halt, so
    `npm test` does not reach it either way.
12. **Three bug files carry stale OPEN headers** (§8) — not four, as the first draft said.
    I verified the code and reported the contradiction rather than editing the files. If a
    reviewer trusts those headers over this document, they will over-count the open
    defects by three. **The fourth was this document's error, not the bug file's**: see
    item 13.

### Added by the fix round — limits this record did not previously admit to

**These are not new problems. They are problems that were here in the first draft and were
described as smaller than they were.** They belong at the top of this section rather than
the bottom, because the pattern they share is the one this gate exists to catch: a check
that reported green, described as though the green meant more than it did.

13. **This record contained a false statement about a defect closure, and it was
    checkable.** §8 listed `bug-store-from-raw-open-codes-the-default-backend` as closed on
    the evidence "zero literal `'file-system'` occurrences remain in it". The literal is at
    `bin/cli.js:1830` and it is the exact one the bug's own reproduction step 3 names. Half
    the fix had landed, and a check that stopped at the first confirming evidence read the
    half as the whole. **Corrected in §8, and the mechanism is the general warning: for
    every other "fixed" row in that table, a partial fix reads exactly like a complete one
    to a check that stops early.** The other three closure claims were re-verified against
    each bug's own reproduction steps for this fix round.
14. **The FR266 closed set was defeatable three ways** *(corrected in round 2: **four** —
    see item 24)*, **and the most important of them was the default case, not an exotic
    one.** An independent reviewer planted three mirrors and the suite stayed 33/0 on all
    three. Two are now closed and proved closed by re-planting (§3); the third was already
    covered by Story 31.10's suite while this document credited AC7.7 for it. **What this
    means for anyone reading the FR266 negative: the version of it in the first draft did
    not hold, and its confidence was not earned.** The current version is stronger and
    re-scanned across the whole shipped surface — but it earned that by failing first, not
    by being right the first time. **And it failed a fourth time in the next round**, which
    is the more important fact: two consecutive rounds of attack each found a live bypass,
    so the prior that a fifth exists is not low.

    *(Fix round 4. It failed a fifth time in round 3 and a **sixth** time in round 4. The
    sentence above was written when the count was four and is left as written; the running
    total is now six across four rounds, and the trend it describes has held every single
    time. See item 16.)*
15. **The FR266 window is four lines and a five-line split still evades.** The *default*
    prose shape is now caught; a determined one is not. Stated in §3 and repeated here
    because it is the live residual of the most serious of the three bypasses.
16. **The non-markdown scope hole is CLOSED for `.toml`/`.yaml`/`.yml`/`.json`, and still
    open for everything else this package ships. It was found by attack and closed by
    human decision, not by design.**

    **History of this item, kept because it is the point.** It has been rewritten three
    times and was wrong twice. It first read *"Nothing in this epic puts instruction prose
    there"* — misleading to the point of falsehood. Fix round 3 corrected that to *"the
    scan does not look there, and there is already Confluence instruction prose there"* —
    true, and it recorded the hole as **open**, which it then stayed. It was closed only
    when a human read this item, recognised the vehicle, and directed the work. **No test,
    no review pass and no design principle surfaced it; a reader did.** Attack 6 needed no
    cleverness at all — the check simply never opened the files.

    **What the scan now covers.** AC7.5's population is `package.json`'s `files` ∩
    `git ls-files`, the same outside authority the markdown half uses, over five
    extensions:

    | population | files | window |
    |---|---:|---:|
    | `.md` | 2,332 | 4 lines |
    | `.yaml` | 240 | 16 lines |
    | `.toml` | 72 | 16 lines |
    | `.json` | 70 | 16 lines |
    | `.yml` | 0 | 16 lines |
    | **scanned total** | **2,714** | |

    `.yml` is 0 on purpose and is listed anyway: three `.yml` files are tracked, all under
    `.github/`, none inside the `files` roots. Keeping the extension means renaming a
    `.yaml` cannot escape the scan. **No path is excluded by rule.** All three real hits
    are vendored `lib/bmad-cache/**`, and a path exclusion there would have been the easy
    fix and would have reopened attack 2's hole across 666 shipped files — the same trade
    this epic already refused once. They are pinned by content digest instead
    (`649b5cea`, `f93251c9`, `88a4d876`; adjudicated in §3).

    **What the scan still does not cover.** 3,249 tracked files sit under the `files`
    roots. 2,714 are scanned; **535 are not**, and this is the full list, by extension:

    ```
    .gitkeep 98   (no extension) 59   .py 65   .js 53   .ts 31   .mjs 23
    .sample  70   .csv 30   .sh 13   .astro 13   .html 10   .png 8
    .gitignore 5  .npmrc 5  .nvmrc 5  .prettierignore 5  .idx 5  .pack 5
    .rev 5        .css 5    .npmignore 4  .ico 4  .cjs 2  .xml 2
    .excalidraw 1 .groovy 1  .svg 1  .txt 1  .template 1  .pptx 1  .ps1 1
    .1 1  .0 1  .3 1   ← not extensions: git tag refs under
                          lib/bmad-cache/*/_git_preserved/refs/tags/v*.*.*
    ```

    Named precisely rather than waved at. **The four groups sum to 535; they were checked,
    because the first draft of this list summed to 532 and lost the three tag refs.**

    - **Program text (`.py` 65, `.js` 53, `.ts` 31, `.mjs` 23, `.cjs` 2, `.sh` 13,
      `.ps1` 1, `.groovy` 1 — 189 files).** An agent instruction embedded in a source
      comment or a template string would not be seen. AC7.7 covers `lib/confluence-page-tree.js`
      specifically and Story 31.10's suite covers more, but neither is this scan.
    - **Markup and data that is not one of the five (`.html` 10, `.astro` 13, `.css` 5,
      `.csv` 30, `.xml` 2, `.txt` 1, `.svg` 1, `.template` 1 — 63 files).** `.csv` and
      `.txt` in particular are plain text an agent can read.
    - **Binary formats and git internals (`.png` 8, `.ico` 4, `.pptx` 1, `.excalidraw` 1,
      the `.pack`/`.idx`/`.rev` objects 15, and 3 tag-ref files whose names merely end in
      `.1`/`.0`/`.3` — 32 files).** Not scannable as text at all. A `.pptx` is a zip of XML
      and a `.excalidraw` is JSON under a different extension; neither is opened.
    - **Dotfiles and manifests without an extension (`.gitkeep` 98, `.gitignore` 5,
      `.npmrc` 5, `.nvmrc` 5, `.prettierignore` 5, `.npmignore` 4, `.sample` 70, and 59
      extensionless files — 251).** Mostly empty or configuration, but "mostly" is the
      operative word and nothing here checks.

    **And the residual inside what IS covered.** The 16-line structured window is a
    bound, not a proof, and **it was not chosen against a measurement** — *(corrected in
    fix round 5, FIX-5; this passage previously cited "over the 745 comment-block-plus-key
    entries … median 4 … p99 16 … 6 of 745 entries are longer than the window", a figure
    whose measuring script was never committed, whose "entry" definition no test pins, and
    which an independent reconstruction put at 291 / 2 / 16 / 2 / 18)*. **16 is an
    unmeasured robustness margin.** It buys nothing on the current tree — the scan reports
    the same three files, three hits and three neighbourhoods at every width from 4 to 24 —
    and it costs wider digests and therefore more re-adjudication churn. **An instruction
    split across an entry longer than the window still evades, and no reproducible figure
    says how many such entries there are.** See §3 for the full withdrawal. The markdown
    window's own five-line residual (item 15) is unchanged. The
    predicate — vocabulary and subject filter — is unchanged and remains the heuristic
    item 9 describes; only its verb axis is closed, against the shipped prohibition
    (AC7.5f).

    **The vehicle, since it is what made this urgent.**
    `lib/bmad-cache/gds/src/workflows/1-preproduction/gds-create-game-brief/customize.toml`
    carries an `external_handoffs` key, and that workflow's own `SKILL.md:99` instructs an
    agent to *"execute each entry in `{workflow.external_handoffs}` … Invoke the tool"*. A
    handoff with a **read-back direction** would therefore be a live, executed mirror. It
    is proved non-vacuous by plant-and-revert in §3: the plant fails the new scan
    (41 passed / 1 failed / exit 1) and passes the markdown-only one (40 / 0 / exit 0).

    **Do not read this as "the last hole".** Six attacks have now defeated this check and
    six have been closed one at a time; that is the base rate, and it does not argue that
    the seventh does not exist.
17. **`CHANGELOG.md` does not ship on npm, and this record claimed it did.** 1,929 tarball
    entries, `CHANGELOG.md` not among them. The "Deliberately not implemented" and "Known
    limitations" sections are now reproduced in `README.md`, which does ship (§7). **The
    duplication is a new, real maintenance hazard**: two copies held in step by a request
    in a comment, with nothing asserting it.
18. **AC7.3 pinned nothing and cited the wrong population.** It asserted `> 9` — satisfied
    by any number above nine — while this document called it "pinned so nobody can quietly
    loosen it", and cited 60 tracked markdown files when its own population is 316 shipped
    skill files and the tracked figure is 61. Now pins 36 exactly, with both figures
    recorded (§5).
19. **AC7.7's forward guarantee is withdrawn.** "Cannot become a mirror regardless of what
    anyone later intends" overstates what any test enforces. Today's module has no I/O
    capability and the guard now fails on the shapes by which one would be added; that is
    all that is claimed.
20. **AC3.2's determinism bound covered one answer shape and read as general.** Now
    extended to four — legacy single-store, two divergent file-system stores, both stores
    Confluence-backed, and the mixed case (§1 AC3). The claim and the test now match.
21. **The chain-suite counts in this document disagreed with each other** (102 / 103 /
    104). Reconciled in §4, with the residual one-suite gap flagged as not reconstructible
    rather than reverse-engineered into a tidy number.
22. **The 31.4/15.5 recommendation in §4 is a recommendation, and I have not run it.**
    Three specific things need checking before anyone adopts it, and they are named there.
    A gate that recommends is still not a gate that decides. *(Round 2: an independent
    reviewer verified the proposal mechanically and endorsed it, and it now carries a
    fourth element — `remove-from-sprint`, a latent fifth failure the four-skill fix would
    have left armed. Two of the three unverified items stand; the third — the 41-copy
    invariant — was **my own caveat being too pessimistic**, and §4 now shows the source
    copy is pinned transitively in both directions. **An endorsement is still not a run,
    and the remaining two items are still unrun.**)*
23. **The gate suite could have lost assertions without saying so, and this document was
    citing its count.** Six sibling suites in this epic pin their own test count
    (`global-install-scope`, `project-layout-artifact-routing`, `project-layout-bind` and
    others); `release-gate-epic-31` did not — the one suite whose numbers this record
    quotes. A test lost to a rename or an early return would have reported nothing, and
    "0 failed" over a silently shrunken set is the same presence-rather-than-effect shape
    this epic produced six times. **Now pinned at 37 in both directions** *(38 after round
    2 added AC7.5e — the pin doing exactly its job: the surplus had to be recorded here
    before the suite would go green again)*, with the failure message naming this document
    as the other thing to update. Verified to fire: with the constant set to 99 the suite
    exits 1 on a run where all 37 assertions passed.

### Added by fix round 2 — the fourth bypass, and a stale count

24. **A fourth bypass, and this one was the ordinary case.** The reviewer planted a
    complete FR266 mirror in plain product English — *"download every Confluence page in
    the software requirements store and save it … upload your edits back when you finish"* —
    using **zero** words from `MIRROR_VOCABULARY`, and the suite returned **37 passed, 0
    failed, exit 0**. It named Confluence and the store outright and fitted the four-line
    window: neither the subject filter nor the window was the gap. **The gap was that all
    nine vocabulary entries were architecture nouns and shipped instruction text is written
    in ordinary imperative English.** The vocabulary now carries a verb family, AC7.5e pins
    the plant as a permanent control, and the verb-extended re-scan over the same 2,016-file
    widening is clean with 8 further hits adjudicated and pinned. **Item 9 is rewritten
    accordingly, and it does not claim closure**: a verb list is inherently open against
    natural language, and this was found by attack rather than by design.
25. **A stale count in the section the FR266 negative rests on.** §3 said "five hits total,
    in two files" and "all five are now digest-pinned" while the code pinned **eight** — the
    three extra being the README passages §7's own fix had added. No adjudication was wrong
    and no passage was unread, so there was no correctness defect; but round 1's count-sweep
    commit missed it, in the one section that carries the load. Corrected, and re-counted to
    **sixteen** after the verb extension. **The general point is the same one item 13
    makes:** a number that no test asserts drifts silently, and this document is full of
    numbers.

    *(And the point kept proving itself: "sixteen" became **17** in round 3 and **20** in
    round 4 — see item 29 — and §4's suite figure sat at "38" through the whole of round 3
    while the code held 40. **Every round of this record has left at least one stale count
    behind, including the two rounds whose stated job was to sweep them.** Read any number
    in this document as a claim to re-derive, not as a fact.)*

### Added by fix round 3 — the fifth bypass, a vacuous new test, vendored adjudications, and a count that moved again

26. **A fifth bypass, mounted with the product's own prohibited verbs.** The shipped gate
    block — `skills/bmad-sprint-planning/SKILL.md:149` and its 8 identical siblings —
    forbids five verbs **by name**: *"do NOT **write**, **copy**, **cache**, **export** or
    **reconcile** a local copy of anything Confluence returns."* After round 2, the
    detector that exists to enforce that sentence covered **three of the five**. A verifier
    planted, in `skills/code-review/SKILL.md`, *"copy each page you read into
    `_bmad-output/confluence/` and re-read it from there on every later run"* — and the
    `write` form of the same instruction — and the suite returned **38 passed, 0 failed,
    exit 0** for each. Neither plant is an exotic coinage: each uses a word the product
    itself prints in its own prohibition, in a shipped skill file, and walked straight past
    the check that enforces that prohibition.

    **The fix is AC7.5f, and it is deliberately not "two more words on the list."**
    Appending `copy` and `write` would have closed those two plants and nothing else — the
    same one-attack-at-a-time patch that has now been applied three times. AC7.5f asserts
    the general property instead: it **parses the prohibited-verb list out of the shipped
    bytes** (`prohibitedMirrorVerbs()` reads the gate block from the shipped files rather
    than restating the sentence in the test, because restating it would make the test its
    own authority) and **fails if the product ever forbids a verb the detector cannot
    see.** Verified **in both directions**: it asserts the sentence parses in all **9**
    shipped copies and that all 9 prohibit the *same* verbs — so the coverage loop cannot
    pass vacuously over an empty or partial set, which is FIX-4's exact defect — and it
    probes each parsed verb inside a carrier first proved inert on its own, so a verb
    passes on its own coverage and never on a neighbour's. Add a sixth verb to the shipped
    sentence and AC7.5f goes red until the vocabulary catches up. AC7.5g then proves both
    attack-5 forms end-to-end through the real scan path (item 27).

    **What this closes, and what it does not.** It closes the vocabulary against **the
    product's own enumeration and nothing wider.** The authority AC7.5f binds to is the
    shipped prohibition, not the English language; ordinary English outside those five
    verbs remains exactly as open as item 9 has always said.

    **And the prior on a sixth attack is not low.** Round 1 found three bypasses; round 2
    found a fourth (item 24); round 3 found a fifth. **Three consecutive rounds of attack
    have each found a live bypass in the check as it stood at the start of that round.**
    This item makes no prediction that the fifth was the last, and nothing elsewhere in
    this document should be read as making one — item 9 declines to claim closure for
    exactly this reason.

    > **Fix round 4 — the prediction above was right, and quickly.** Round 4 found the
    > **sixth**: the check scanned markdown only and had never opened a shipped `.toml`,
    > `.yaml`, `.yml` or `.json` file. Four consecutive rounds, four live bypasses. It is
    > also the one that says the most about the process, because it required no evasion of
    > any predicate and had been sitting in this very document as **item 16**, correctly
    > described and recorded as open, since round 3 — and no test, review layer or design
    > principle picked it up. A human reader did. **The prior on a seventh is not low
    > either**, and item 16 declines to predict otherwise.
27. **The round's own new test was vacuous, and only mutation caught it.** AC7.5g was
    written in this round to close the gap that the end-to-end proof — a planted mirror in
    a real file comes back as a stray from the *real* scan path — existed only as a manual
    replant recorded in prose, in no assertion at all. It ran three named attacks over a
    fixture built from the shipped pinned block. **Deleting the `5-copy` attack from its
    plant set outright left the suite at 40 passed, 0 failed, exit 0.**

    The reason is the whole point. AC7.5g's loop asserted something about **every plant it
    was given** and **nothing whatsoever about how many it was given**, so the set could
    silently shrink to one — or to none, with the loop body never executing — while the
    test kept its three-attack name and its green tick. It measured the list it was
    handed. It is now pinned by **name and by size in both directions**
    (`assert.deepStrictEqual(Object.keys(PLANTS).sort(), ['4a', '5-copy', '5-write'], …)`),
    so removing a plant fails this test rather than quietly reducing what it covers
    (`ab744a5`).

    **And the same shape was live in round 2's flagship control.** AC7.5e — the permanent
    control written to close attack 4a — asserted over the **source text** of the matching
    regexes (`why.join(' ')`) rather than over which patterns actually fired. That is
    satisfiable by a vocabulary in which two of its three claimed verbs can never match:
    replace the three real patterns with the single degenerate
    `/\bdownload\b|\bzzupload\b|\bzzsave\b/i`, in which only `download` can match anything,
    and the old assertion still **passed** — because the strings `upload` and `sav` appear
    inside that one regex's own source. `d307908` repaired it to collect the firing
    patterns **by identity**, one verb per inert carrier, and assert three *distinct*
    patterns fire, each of which must also fire on the joined window the scan really sees.

    **The lesson, stated without softening it.** This is the epic's recurring
    **"proves presence, not effect"** shape — the same defect as items 13, 18, 23 and 25 —
    and in this round it appeared **twice in one place: inside the control written to close
    the previous instance of it, and inside the brand-new test written in the same round to
    close the gap that control left.** Writing a test about a defect class is not
    protection against committing that defect class in the test. Neither instance was found
    by reading the test; both were found by **mutating it and watching the suite stay
    green**. That is the only method in this record that has actually worked, and it should
    be assumed necessary for every assertion added from here on.
28. **Ten of the adjudicated passages are vendored upstream text nobody here authored,
    and they will churn.** *(This item was written as "seven of the seventeen" in round 3.
    Round 4 added three more — see below. Re-derive both figures from
    `ADJUDICATED_MIRROR_PASSAGES`.)* `lib/bmad-cache/**` is not written in this repository:
    it is **generated by `scripts/build-bmad-cache.js` from the upstream BMAD registry** and
    committed so an air-gapped install has its modules. **Ten of the twenty
    adjudicated hits live there:** seven markdown copies of one `external_handoffs` schema
    example repeated across the `gds` module's `SKILL.md` and `headless-schemas.md` assets,
    **plus the three non-markdown hits round 4 added** (`649b5cea`, `f93251c9`,
    `88a4d876` — two `customize.toml` files and one `workflow.yaml`, §3). Because those
    bytes are regenerated by a build, **an upstream bump changes them, the digests stop
    matching, AC7.5d fails, and a human must re-adjudicate ten passages they did not
    write.** The three new ones are worse on this axis than the seven, and it should be
    said plainly: they are pinned at a **16-line** window rather than four, so a change to
    *any* line within 16 of the match — an upstream comment reflow, a new key inserted
    nearby — breaks the pin without touching the adjudicated sentence at all.

    **That is a real recurring maintenance cost and it was accepted deliberately.** The
    cheap alternative — excluding `lib/bmad-cache/` from the scan by path rule — was
    rejected because it **reopens attack 2's scope hole across 666 shipped files**, and
    attack 2 is precisely the bypass that a path-shaped scope produced in the first place.
    Pinning by digest keeps the set closed and pays the churn; excluding by path would have
    been quiet and wrong. Whoever hits the failure should re-read the passages rather than
    reflexively re-pinning them, which is the same warning §3 gives about re-wrapped README
    paragraphs.

    **A correction to how those seven were characterised — and this is explicitly NOT an
    FR266 finding, because it is not one.** The adjudications describe the matched text as
    *"only an example payload"*: a report field in a headless-run result recording that a
    corp-specific MCP tool performed a one-way publish. That is accurate about **the matched
    bytes**. It is not the whole truth about **those files**.
    `lib/bmad-cache/gds/src/workflows/1-preproduction/gds-create-game-brief/SKILL.md:99`
    carries a live agent directive:

    ```
    3. External handoffs: execute each entry in `{workflow.external_handoffs}` to route
       artifacts beyond local files (Confluence, Notion, ticket systems, etc.) — each
       directive names the MCP tool and the fields it needs. Invoke the tool, capture any
       URLs or IDs returned, and surface them in the user message.
    ```

    So the example payload at `:47` is the shape of a thing the same file **instructs an
    agent to execute**. It remains not an FR266 mirror — it is one-way publish of a
    produced artifact, with no local copy of anything read, no return sync direction, no
    trigger, no conflict resolution and no knowledge store of this product involved, which
    is the same shape as this product's own FR255/FR256 publish that FR266's retirement
    explicitly leaves intact — and `external_handoffs` is empty by default. **An independent
    verifier read all the adjudications and would not have failed any of them on the FR266
    question; the objection was to the characterisation, not the verdict.** The honest form
    is *"a one-way publish directive and its example payload, in vendored upstream text"*,
    not *"only an example payload."* **These seven are not re-adjudicated here and must not
    be**: the verdicts stand, the wording is what was wrong.
29. **The adjudicated-hit count moved again, and it is now twenty.** *(Round 3 wrote this
    item to record the move from 16 to **17**. Round 4 moved it again, to **20**, and this
    item is corrected in place rather than re-filed — the whole point of it is that this
    number keeps moving.)* Round 2 reported **16** (item 25); round 3, **17**; the count in
    the code is now **20**, re-derived for this item by reading the keys of
    `ADJUDICATED_MIRROR_PASSAGES` in `test/release-gate-epic-31.test.js` — 20 digests, all
    distinct: 7 `README.md`, 3 `docs/architecture.md`, 7 `lib/bmad-cache/**` markdown, and
    **3 `lib/bmad-cache/**` non-markdown** (2 `customize.toml`, 1 `workflow.yaml`).

    **Independently corroborated against the live scan, not just the list.** Running the
    scan over both populations reports **17 hits across the 2,332 markdown files and 3
    across the 382 structured files — 20 hits, 20 distinct digests, matching the 20 keys
    exactly.** So the list has no stale entry (AC7.5d's direction) and no unused one.

    **Why it moved, and it is not a new hit.** Binding the bare `write` verb into the
    vocabulary (item 26) made `docs/architecture.md:219`'s *"the installer **writes** the
    binding"* match from a window starting two lines earlier. The scan reports one window
    per neighbourhood and then strides, so the *same* prose is now reported at `:217` and
    `:221` instead of once at `:219`. §3.6.1 was therefore re-cut into **two** adjudicated
    digests (`fd970458`, `59781ed9`) replacing the single stale `425df87a` (`d307908`).
    **No passage changed, no adjudication was revised, and nothing new was admitted** — one
    reported window became two. AC7.5d caught the stale digest, which is the direction it
    exists for.

    **The lesson this record has now learned three times.** Round 1 shipped a stale count.
    Round 2's fix-round shipped a stale count and item 25 was written about it. Round 3
    found another one — including a bullet in §3 that still read "the **sixteen** reasons
    are mine" after the code held seventeen, corrected in the same commit as this item.
    **A count in this document has been stale at every single review round without
    exception.** The countermeasure is not another sweep; sweeps have been run twice and
    both times left a stale figure behind. **Treat every figure in this document as
    advisory and re-derive it from the code.** For this one the derivation is: count the
    keys of `ADJUDICATED_MIRROR_PASSAGES`. Item 13 and item 25 make the same point about
    numbers no test asserts; this is its third confirmed instance, and it is the reason no
    number here should be quoted onward without checking it first.

### Addendum — full-chain residue attribution (completed)

The instrumented run finished all **103** of the chain's **104** suites (`repo-layout` excluded as the
already-known mutator), restoring the tree between every one and measuring install
residue only.

**Exactly one `MUTATES` line: `test/yes-flag.test.js`, position 1, residue 0 → 520.**

Confirmed independently by running it alone from a verified-clean tree: exit 0, **522
dirty paths**, including a written `_bmad-output/project-layout.yaml`. §4 is updated with
the full consequence. Item 6 above is resolved.

---

## 10. What changed on this branch

| Commit | Change |
|---|---|
| `e4acea4` | `test/release-gate-epic-31.test.js` (33 assertions) + registration at chain position 104 |
| `4c10ffd` | `.github/scripts/offline-install-verify.sh` steps 7–8; `.github/workflows/offline-install.yml` cap and summary |
| `ec097ad` | `3.17.1` → `3.18.0`; `CHANGELOG.md`; `README.md`; rebuilt plugin `marketplace.json` |
| `a8833b5` | This gate record |
| `8df081b` | `sprint-status.yaml`: 31.14 → `review`, findings on its key |
| `9d2d265` | Two latent `pipefail` aborts in the new air-gap phases; `read_field` anchored and verified against real generated output |
| `f78584a`, `69a3660`, `73d6836` | FR266 scan re-run over the whole branch and its scope limits stated; the `yes-flag` attribution |

**Fix round, after independent review.** The reviewer's findings and what closed them:

| Commit | Change |
|---|---|
| `ded9d82` | **FIX-2 attacks 1 and 2.** AC7.5 matches over a four-line window and never straddles a pinned block; population widened from 316 skill-root files to 2,332 tracked shipped markdown, derived from `package.json`'s `files`; five hand-adjudicated passages digest-pinned. New AC7.5b/c/d. **FIX-4:** AC7.3 pins 36 exactly instead of `> 9` |
| `312cfcf` | **FIX-2 attack 3.** AC7.7 leads with "this module requires nothing"; `node:` stripped before matching; writer list gains the async half and `fs.promises`; dynamic acquisition refused. New AC7.7b |
| `f640130` | **FIX-3.** "Deliberately not implemented" and "Known limitations" reproduced in `README.md`, which ships; `CHANGELOG.md` notes that it does not |
| `185c8a9` | **FIX-4.** AC3.2 extended from one answer shape to four |
| `85380de` | **FIX-1.** `store-from-raw` corrected from closed to open; stale-header count 4 → 3; totals 4/13/3; the other three closure claims re-verified in source |
| `ce12467` | **FIX-2, record half.** §3 restated; the 733-file multi-line re-scan; the forward guarantee withdrawn; "what this check cannot see" rewritten |
| `c06b765` | **FIX-3/FIX-4, record half.** The shipping claim, the 61/36 loose-probe figures, and semver argument 2 corrected |
| `6900193` | **FIX-5.** The 31.4/15.5 recommendation; the 104/103/102 count reconciliation |

**Fix round 2 (the cap):**

| Commit | Change |
|---|---|
| `7b9621a` | **FIX-A steps 1–2.** `MIRROR_VOCABULARY` extended with the verb family (`download`, `upload`, `export`, `import`, `save`, `persist`, `snapshot`, `shadow`, `stash`, `store locally`, `write … to disk`); new AC7.5e pins the reviewer's plain-English plant as a permanent control; the verb-extended re-scan's 8 new hits adjudicated and digest-pinned (16 total); `EXPECTED_TEST_COUNT` 37 → 38 |
| `f222fd0` | **FIX-A step 3 and FIX-B.** §9 item 9 rewritten to the honest form; items 14, 23 corrected in place; new items 24–25; §3 gains the verb-extended re-scan and its adjudications; the "five hits / all five pinned" stale count corrected to eight, then re-counted to sixteen |
| `449a4f7` | **FIX-C.** The 31.4/15.5 recommendation strengthened: the requirement-vs-converter insight stated plainly; the AC7.1 caveat corrected in my own favour (the source copy is pinned transitively); the `remove-from-sprint` latent fifth failure recorded |

**Fix round 4 (the non-markdown scope hole, attack 6):**

| Commit | Change |
|---|---|
| *(this round)* | **AC7.5's population extended to shipped non-markdown agent-readable text.** `shippedMarkdown()` refactored into `shippedFilesWithExtensions()`; new `shippedStructuredText()` over `.toml`/`.yaml`/`.yml`/`.json` from the same `package.json` `files` ∩ `git ls-files` authority — **382 files, no path excluded by rule**; `mirrorWindowsOutsidePinnedBlocks` parameterised by window width; new `MIRROR_WINDOW_LINES_STRUCTURED = 16` — *(described in round 4 as "chosen against the measured p99 comment-block-plus-key entry length (745 entries, median 4, p99 16)"; **that justification was withdrawn in round 5, FIX-5** as unreproducible, and 16 now stands as an unmeasured robustness margin — see §3)*. AC7.5 and AC7.5d walk one combined `shippedTextToScan()` list so the forward and hygiene checks cannot diverge on scope. Three hits adjudicated and digest-pinned (`649b5cea`, `f93251c9`, `88a4d876`) — exception list 17 → **20**. New **AC7.5h** (population, pinned by extension plus the 3,249 / 2,714 / 535 arithmetic) and **AC7.5i** (end-to-end plant, asserting **both** directions). `EXPECTED_TEST_COUNT` 40 → **42** |
| *(this round)* | **Record half.** §9 item 16 rewritten from "hole open" to what is covered, what is not (all 535 remaining files by extension), and that it was found by attack and closed by human decision; §3 gains the non-markdown re-scan, the three adjudications, the window-adaptation measurements and the plant-and-revert proof; items 9, 14, 26, 28, 29 and the FR266 traceability row corrected in place; the stale "38 passed" in §4 corrected to 42. **No §9 item deleted — all 29 stand** |

**Verification run for fix round 4, on a clean tree** (every figure the brief pinned as
must-not-move, re-run rather than restated):

| Suite | Result | Exit |
|---|---|---|
| `release-gate-epic-31` | **42 / 0** (was 40/0; +2 for AC7.5h and AC7.5i) | **0** |
| **`story-15-5-workflow-skills`** | **157 / 0** — the round-3 fix holds, not regressed | **0** |
| `project-layout-confluence-routing` | 97 / 0 | 0 |
| `project-layout-confluence-page-tree` | 157 / 0 | 0 |
| `project-layout-artifact-routing` | 59 / 0 | 0 |
| `project-layout-staleness-guard` | 64 / 0 | 0 |

Story 31.4's preflight pin (**41 copies, one sha256, 13/14/14**) and Story 31.9's gate pin
(**9 copies, one sha256, 3/3/3**) both hold — AC7.1 and AC7.2 inside the run above.

**Anti-vacuity, both directions** (full detail in §3): a mirror directive planted in the
real `gds-create-game-brief/customize.toml` gives **41 / 1, exit 1** under the new scan and
**40 / 0, exit 0** under the population reverted to markdown-only. Reverted in the same
step — `git hash-object` back to `5c1c19b70ea74d6349b701851bba78539eaa6ef0`, and
`git status --porcelain` shows only ` M skills/git-workflow-skill/skill.json`, the known
CRLF phantom.

**Not run in fix round 4, deliberately:** `test/project-layout-two-store-round-trip.test.js`
(four real `npm install` runs) and `test/yes-flag.test.js` (dirties 522 paths). Their
exclusion is a cost decision, not a result.

**Verification run for fix round 1, on a clean tree:**

| Suite | Result | Exit |
|---|---|---|
| `release-gate-epic-31` | **37 / 0** (was 33/0; +4 assertions) — **38 / 0 after round 2 added AC7.5e** | 0 |
| `project-layout-confluence-routing` | 97 / 0 | 0 |
| `project-layout-confluence-page-tree` | 157 / 0 | 0 |
| `project-layout-staleness-guard` | 64 / 0 | 0 |
| `project-layout-bind` | 73 / 0 | 0 |
| `project-layout-binding-spine` | 69 / 0 | 0 |
| `project-layout-artifact-routing` | 59 / 0 | 0 |
| `project-layout-config-generation` | 32 / 0 | 0 |
| `project-layout-enum-single-source` | 31 / 0 | 0 |
| `plugin-manifests` | 29 / 0 | 0 |
| **`story-15-5-workflow-skills`** | **153 / 4** — unchanged, and deliberately so | **1** |
| `bmad-output-policy` (not in the chain) | 10 / 1 — pre-existing, see §4 | 1 |

**With the reviewer's three attacks re-planted: 35 / 2, exit 1.** Attacks 1 and 2 die at
AC7.5 as separate strays; attack 3 dies at AC7.7. Reverted with `git checkout --`; the
tree is clean and the suite is back to 37/0.

**`test/project-layout-two-store-round-trip.test.js` was NOT run in the fix round.** It
drives four real `npm install` runs against the public registry, and its 52/0 is
established. Its exclusion here is a deliberate cost decision, not a result.

**Final verification run of the ORIGINAL draft, on a clean tree** (superseded by the fix-round table above; retained so the two runs can be compared):

| Suite | Result |
|---|---|
| `release-gate-epic-31` (new) | **33 / 0**, exit 0 |
| `project-layout-artifact-routing` | 59 / 0 |
| `project-layout-binding-spine` | 69 / 0 |
| `project-layout-config-generation` | 32 / 0 |
| `project-layout-enum-single-source` | 31 / 0 |
| `project-layout-confluence-routing` | 97 / 0 |
| `project-layout-confluence-page-tree` | 157 / 0 |
| `plugin-manifests` (bundle drift, after the rebuild) | 29 / 0 |

The worktree is clean afterwards apart from `skills/git-workflow-skill/skill.json`, which
is byte-identical to `HEAD` (git's CRLF filter) and was left alone as instructed. **The
new gate suite writes nothing into the repository it runs in** — verified by running it
and re-checking `git status`.

**Not done, deliberately:** no push, no PR, no npm publish — those are human gates. No
edit to the PRD, to Decision P5-9, or to `epics.md`. No filed defect fixed. Bug B3 (root
`skills/`) untouched.

**The 31.4/15.5 contradiction IS resolved on this branch.** *(This paragraph asserted the
exact opposite from `d5dbab5` until fix round 5 — see the correction box in §4. What stood
here was: "the 31.4/15.5 contradiction is **not** resolved — a recommendation is recorded
in §4 and nothing is implemented … `story-15-5` is still 153/4".)* **The human authorised
the resolution §4 recommended, and it was landed at `d5dbab5`** — the preflight block added
to five workflow sources under `lib/bmad-extension/workflows/`, `remove-from-sprint`
included, exactly the variant §4 recommends. **`story-15-5-workflow-skills` is 157 passed,
0 failed, exit 0.** Neither `test/story-15-5-workflow-skills.test.js` nor Story 31.4's
guard was weakened or edited. **The implementation was landed before an independent review
had seen it and remains unreviewed; do not read this as reviewed-and-blessed.** It also
created attack 7 (§9 item 30), closed in fix round 5. **AC9 is still NOT MET**, on *"Linux
never run"* and the nine pre-existing failures that short-circuit `npm test` at position
11 — **not** on `story-15-5`. No bug file's `Status:` header
was edited, including the one this record was wrong about — the correction belongs in this
document, where the error was. `test/repo-layout.test.js` and
`test/project-layout-two-store-round-trip.test.js` were not run. The status of this story
remains `review`; **no verdict is claimed here, and none was claimed in the first draft
either.** That part held up.
