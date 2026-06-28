# Step 02 — Build the Dependency DAG and Compute Waves

**Goal:** Turn the epic's stories into an ordered set of execution waves so independent stories parallelize and dependents only start once their prerequisites are merged.

## 1. Build the dependency graph

For every non-skipped story, resolve its dependencies into a directed graph (edge `A → B` means "A depends on B; B must merge first"). Sources of dependencies, in priority order:

1. Explicit `depends_on` / prerequisite fields in `sprint-status.yaml` or the story spec.
2. Stated dependencies in the epic / story prose ("requires the API from story X").
3. Shared-file heuristics: if two stories are known to edit the same module, treat them as a soft conflict (same-wave concurrency risk) and prefer to sequence them.

## 2. Detect cycles

Run a topological sort. **If a cycle exists**, STOP and report the cycle to the user — a circular dependency cannot be waved automatically. Offer to (a) break the cycle by merging the stories, or (b) force a user-specified order.

## 3. Compute waves by strategy

- **`waves`** (default): Wave *k* = all stories whose dependencies are all satisfied by waves `< k`. Within a wave, cap concurrent pipelines at `max_parallel_stories`; if a wave is larger, run it in batches.
- **`sequential`**: one story per wave, in topological order.
- **`full`**: a single wave of all stories (only if the user explicitly chose this; re-warn about conflict risk).

## 4. Present the plan

Show the wave plan compactly and record it in the Run Ledger:

```
Wave 1:  S1, S2, S3        (independent)
Wave 2:  S4 (needs S1), S5 (needs S2)
Wave 3:  S6 (needs S4,S5)
```

Do **not** HALT here (the user already gave go in step-01) — but if the computed plan reveals a problem the user could not have anticipated (e.g. every story is sequential and the user expected parallelism, or a story has unresolved/dangling dependencies), surface it in one line and HALT for a decision.

Then read fully and follow `./steps/step-03-epic-branch.md`.
