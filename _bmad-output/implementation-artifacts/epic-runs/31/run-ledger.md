# Run Ledger — Epic 31 (Global Installation & Federated Knowledge Stores)

**Run started:** 2026-08-03
**Skill:** `bmad-dev-epic` (orchestrator)
**Run scope:** **WAVE 1 ONLY** (decided 2026-08-03, option A "gate-first"). Stories 31.1 and
31.2 only. HALT and report after wave 1 — do not plan or start waves 2+ even if the dependency
graph reports them unblocked. Story 31.12's scope is undetermined until 31.1's spike reports.

## Resolved configuration

```
Epic:            31 — Global Installation & Federated Knowledge Stores (Phase 5)
Stories (epic):  14 (31.1 … 31.14)   in this run: 2 (31.1, 31.2)   skipped(done): none
                 Out of run scope by decision: 31.3–31.14 (waves 2+)
review_model:    claude-opus     exec_model: claude-sonnet     (tiers collapsed: no)
strategy:        waves           max_parallel: 3    fix_cap: 2
gates:           publish=on  pr=on   dist-tag=beta  bump=prerelease
                 ADDITIONAL RUN BOUNDARY: no npm publish, no PR, no branch push. Report only.
test_gate:       npm run build:plugin  +  targeted `node --test test/<file>.test.js`
                 (bare `npm test` is NOT trusted — halts on pre-existing MIL-498 CRLF drift on
                 Windows; baseline any failure against d:\Code\AI_Agents @ ccac270)
```

### Environment facts carried for the whole run

- **Trunk for this epic is `feat/knowledge-stores-and-global-install`, NOT `main`.** Epic 31,
  Decision P5-9 and every F26 requirement exist only on that unmerged branch. `main` is at
  `ccac270` and does not contain the epic.
- `_bmad/` is gitignored and absent from every worktree. Config and the customization resolver
  were read from `d:\Code\AI_Agents\_bmad\...` (same project; `_bmad/` is per-machine state).
- `uv` absent, `python3` unreliable → `python` used for `resolve_customization.py` (succeeded).
- Fresh worktrees have no `node_modules`; junctioned to `d:\Code\AI_Agents\node_modules`.
- `node_modules/bmad-method` is a stale **6.9.0**; `package.json:35` pins **6.10.0**. Upstream
  citations must not come from `node_modules`.
- npm registry is reachable; `bmad-method@6.10.0` resolves. The live-install spike is feasible.
- CI is broken at the GitHub account level (all jobs fail in seconds, no runner, no logs) —
  unrelated to this work, not a signal.

### Activation record

- `resolve_customization.py --skill … --key workflow` → succeeded via `python`. No team/user
  override TOML for `bmad-dev-epic`; defaults in effect.
- `persistent_facts`: `_bmad-output/project-context.md` loaded.
- Config: `_bmad/bmm/config.yaml` (main tree) — project `AI_Agents`, user `995472`, language
  English, `planning_artifacts` / `implementation_artifacts` under `_bmad-output/`.
- Readiness conditions gating the spine story were confirmed already discharged in the
  planning chain: **C-8** (per-artifact Confluence page identity NOT stored in
  `project-layout.yaml`) is in Story 31.2 AC6; **C-3** (name the component behind AC8's
  "resolver") is in Story 31.2 AC8 as "the binding resolver — the library function
  `ma-agents bind` and `ma-agents status` call". No planning artifact needed amendment.

## Story sizing (INVEST pre-pass, wave-1 stories only)

| Story | Verdict | Note |
|---|---|---|
| 31.1 | **PASS — no split** | Small; single goal (a written PASS/FAIL verdict with evidence). It is a SPIKE: no feature code. 7 ACs, all facets of one investigation. |
| 31.2 | **PASS — no split** | Medium; single goal (make `project-layout.yaml` the authoritative two-store binding record). 10 ACs but all one schema + one writer/reader pair in `bin/cli.js`; splitting would strand a half-written schema. |

## Dependency graph / waves (full epic, for reference)

```
Wave 1: 31.1 (spike — gates thread D only)  ∥  31.2 (binding spine — gates A/B/C)   ← THIS RUN
Wave 2: 31.3 (←31.2) ∥ 31.5 (←31.2) ∥ 31.11 (←31.1)                                  ← NOT RUN
Wave 3: 31.4 (←31.3) ∥ 31.6 (←31.3,31.5) ∥ 31.7 (←31.5) ∥ 31.8 (←31.5) ∥ 31.12 (←31.11)
Wave 4: 31.9 (←31.8) ∥ 31.13 (←31.3,31.5,31.8)
Wave 5: 31.10 (←31.9)
Wave 6: 31.14 (release gate ← all)
```
No cycles. Topological sort clean.

## Branch topology

```
feat/knowledge-stores-and-global-install          (epic trunk — NOT main)
  └── feature/epic-31                             (epic integration branch)
        ├── feature/epic-31-story-31.1
        └── feature/epic-31-story-31.2
```

Worktrees:
- epic: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31`
- 31.1: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31-story-31.1`
- 31.2: `d:\Code\AI_Agents-knowledge-stores\.worktrees\epic-31-story-31.2`

## Story states

| id | wave | status | worktree | branch | fix_rounds | note |
|---|---|---|---|---|---|---|
| 31.1 | 1 | in-progress | `.worktrees/epic-31-story-31.1` | `feature/epic-31-story-31.1` | 0 | spike — live bmad-method@6.10.0 install; verdict gates thread D only |
| 31.2 | 1 | in-progress | `.worktrees/epic-31-story-31.2` | `feature/epic-31-story-31.2` | 0 | binding spine; removes the `fs.unlinkSync` delete-on-single-repo branch at `bin/cli.js:612` |

<!-- updated at every state transition -->
