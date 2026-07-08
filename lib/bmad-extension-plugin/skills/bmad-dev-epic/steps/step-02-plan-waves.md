# Step 02 — Right-Size Stories, Build the Dependency DAG, Compute Waves

**Goal:** Make the story set sound (INVEST-compliant, focused, appropriately small) and then turn it into an ordered set of execution waves so independent stories parallelize and dependents only start once their prerequisites are merged.

## 1. INVEST & story-sizing pre-pass

Before graphing dependencies, assess **every** non-skipped story against **INVEST**:

- **I**ndependent — minimal coupling to other stories (soft-couples become dependency edges in §2, not blockers).
- **N**egotiable — describes intent, not a frozen implementation.
- **V**aluable — delivers a discrete, demonstrable slice of user/system value.
- **E**stimable — small and clear enough to estimate with confidence.
- **S**mall — completable within a single focused pipeline run; **one** focused goal.
- **T**estable — has acceptance criteria that can be verified (and later turned into e2e tests).

**Sizing / focus heuristics — a story is "too long" and should be split if any hold:**
- it pursues more than one distinct goal, or its title contains "and" joining separable outcomes;
- it spans multiple unrelated modules/layers that could ship and be tested independently;
- its acceptance criteria are so numerous that they read like several stories stapled together;
- it cannot plausibly reach Definition of Done (implement + review + e2e) in one focused pass.

**When a story is too large or multi-goal:** split it into the smallest set of INVEST-compliant sub-stories, each with one focused goal and its own acceptance criteria. Preserve the original as a parent/epic-let reference, give sub-stories derived ids (e.g. `S3` → `S3a`, `S3b`), and carry over / refine dependencies. **Present the proposed split to the user and HALT for confirmation** before committing it to `sprint-status.yaml` (splitting changes the planned scope). Record the final, right-sized story set — it is the input to §2.

> This is the planning-time pass. The per-story pipeline (`references/story-pipeline.md`) re-checks INVEST after `bmad-create-story` and can still return `needs-split` if a story only reveals its true size once its spec is fleshed out — see step-04's handling.

## 2. Build the dependency graph

For every non-skipped story, resolve its dependencies into a directed graph (edge `A → B` means "A depends on B; B must merge first"). Sources of dependencies, in priority order:

1. Explicit `depends_on` / prerequisite fields in `sprint-status.yaml` or the story spec.
2. Stated dependencies in the epic / story prose ("requires the API from story X").
3. Shared-file heuristics: if two stories are known to edit the same module, treat them as a soft conflict (same-wave concurrency risk) and prefer to sequence them.

## 3. Detect cycles

Run a topological sort. **If a cycle exists**, STOP and report the cycle to the user — a circular dependency cannot be waved automatically. Offer to (a) break the cycle by merging the stories, or (b) force a user-specified order.

## 4. Compute waves by strategy

- **`waves`** (default): Wave *k* = all stories whose dependencies are all satisfied by waves `< k`. Within a wave, cap concurrent pipelines at `max_parallel_stories`; if a wave is larger, run it in batches.
- **`sequential`**: one story per wave, in topological order.
- **`full`**: a single wave of all stories (only if the user explicitly chose this; re-warn about conflict risk).

## 5. Present the plan

Show the wave plan compactly and record it in the Run Ledger:

```
Wave 1:  S1, S2, S3        (independent)
Wave 2:  S4 (needs S1), S5 (needs S2)
Wave 3:  S6 (needs S4,S5)
```

Do **not** HALT here (the user already gave go in step-01) — but if the computed plan reveals a problem the user could not have anticipated (e.g. every story is sequential and the user expected parallelism, or a story has unresolved/dangling dependencies), surface it in one line and HALT for a decision.

Then read fully and follow `./steps/step-03-epic-branch.md`.
