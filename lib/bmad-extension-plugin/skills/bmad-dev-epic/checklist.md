# bmad-dev-epic — Run Checklist

A run is correct only if every box can be checked. Use this to self-audit mid-run and before each gate.

## Intake (step-01)
- [ ] Target epic identified and its stories enumerated with dependencies.
- [ ] Epic is genuinely ready (stories have acceptance criteria); otherwise routed to planning.
- [ ] Model tiers mapped to actually-available models (collapsed to one if single-model/air-gapped).
- [ ] Parallelism strategy, max-parallel, and fix-loop cap confirmed.
- [ ] Both release gates confirmed ON (or explicitly changed by the user).
- [ ] Real test/build gate command confirmed.
- [ ] Single go/no-go confirmation received.

## Planning (step-02 / step-03)
- [ ] Every story checked against INVEST; oversized / multi-goal stories split into focused sub-stories (user-confirmed) before graphing.
- [ ] Dependency DAG built; no cycles (or cycle resolved with the user).
- [ ] Waves computed per the chosen strategy.
- [ ] Epic branch `feature/epic-<id>` created off the trunk via `git-workflow-skill` (base overridden to trunk), in its own worktree.

## Per story (step-04 / story-pipeline)
- [ ] Story branch cut from the epic branch in its own worktree, per `git-workflow-skill`.
- [ ] Spec re-checked against INVEST/size after create-story; if too large/multi-goal, returned `needs-split` (not implemented) and the orchestrator split it.
- [ ] create-story → dev-story → parallel code-review + edge-case-hunter executed.
- [ ] Blocking findings fixed within the fix-loop cap (or story marked blocked, not papered over).
- [ ] E2E tests generated and passing; test gate green on the story branch.
- [ ] Definition of Done met before the story is integrated.
- [ ] Story merged into the epic branch by the orchestrator (serialized, `--no-ff`).
- [ ] Cross-story breakage checked after each merge.

## Epic gate (step-05)
- [ ] Adversarial whole-epic review run; blocking findings cleared or HALTED.
- [ ] `npm run build:plugin` passes; bundle drift clean/committed.
- [ ] New test failures distinguished from the known pre-existing CRLF baseline.

## Release (step-06)
- [ ] `code-review` self-review on the full epic diff completed.
- [ ] GATE A confirmed by user before publish; version bumped; packed `--ignore-scripts`; tarball inspected; published `--tag beta`.
- [ ] GATE B confirmed by user before PR; single epic PR opened to the trunk; body includes blocked/follow-up section.
- [ ] PR NOT merged (left for human approval).

## Report (step-07)
- [ ] Honest summary presented, including every blocked story.
- [ ] Story worktrees cleaned up; epic worktree retained until merge.
- [ ] Run Ledger persisted.
