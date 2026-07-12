# Story 30.9: Remove the `cline` Agent-Name-Specific Conditional from `lib/installer.js`

Status: review

## Story

As a **ma-agents maintainer**,
I want `lib/installer.js` to drive Cline-specific install behavior off the agent
registry (`lib/agents.js`'s `injectionStrategy` property) instead of literal
`agent.id === 'cline'` checks,
So that `test/agent-injection-strategy.test.js` assertion 3.3 ("installer.js
contains NO agent-name-specific logic") passes, and the architectural invariant
the test enforces — agent-specific behavior lives in the registry, not as
name literals sprinkled through the installer — is actually upheld.

This is a folded-in remediation of a pre-existing baseline defect. It
reproduces on `main` (byte-identical `installer.js`) and is independent of the
BMAD v6.10.0 integration threads running elsewhere in Epic 30.

## Background / Investigation

`lib/installer.js`'s `updateAgentInstructions()` (previously named in some
comments as `_testUpdateAgentInstructions`) contains exactly two conditionals
keyed on the literal agent id `'cline'`:

1. **Line ~1244** — dual-file drift guard:
   ```js
   if (agent.id === 'cline') {
     checkClinerulesDualFileDrift(projectRoot);
   }
   ```
   Gates a check (Story 21.5 AC #6) that compares the in-marker content of
   `.cline/clinerules.md` against a legacy `.clinerules` **file** (not
   directory) and throws `ClinerulesDualFileDriftError` on non-whitespace
   divergence. `--yes` does not bypass this.

2. **Line ~1254** — framing-template selection:
   ```js
   let frameworkTemplate = null;
   if (agent.id === 'cline' && fs.existsSync(CLINERULES_TEMPLATE_PATH)) {
     frameworkTemplate = fs.readFileSync(CLINERULES_TEMPLATE_PATH, 'utf-8');
   }
   ```
   Selects a Cline-flavored header/framing template (Story 21.5 AC #1/#2)
   used only when the instruction file is created fresh (no existing marker
   block to preserve).

`test/agent-injection-strategy.test.js` assertion **3.3** greps
`lib/installer.js` for `agent\.id\s*===\s*['"\`]<id>['"\`]` for every
registered agent id and fails if any such literal comparison exists. Both
conditionals above match the pattern for `'cline'`, so 3.3 currently fails on
`main` and in this worktree prior to the fix.

`lib/agents.js`'s `cline` entry already carries an `injectionStrategy` object
(`{ position: 'top', skipPatterns: ['---'] }`) — the registry-driven pattern
assertion 3.3 expects. The fix extends that same object with two new,
agent-agnostic capability flags that `installer.js` branches on instead of the
id literal:

- `injectionStrategy.dualFileDriftCheck: true` — opts the agent into the
  dual-file drift guard.
- `injectionStrategy.framingTemplate: 'clinerules.template.md'` — names the
  framing template (relative to `lib/templates/`) to use for fresh-file
  creation.

No other agent needs either flag today; both are simply absent (falsy) on
every other registry entry, which installer.js treats as "skip this
behavior" — exactly mirroring the existing `agent.injectionStrategy ||
{ position: 'top', skipPatterns: [] }` fallback pattern already asserted by
3.2.

## Acceptance Criteria

1. **Given** `lib/installer.js`, **When** this story lands, **Then** neither
   `agent.id === 'cline'` conditional remains — both call sites branch on an
   `injectionStrategy` property instead.
2. **Given** `lib/agents.js`'s `cline` registry entry, **When** this story
   lands, **Then** it carries `injectionStrategy.dualFileDriftCheck: true`
   and `injectionStrategy.framingTemplate: 'clinerules.template.md'`, and no
   other agent entry sets either property.
3. **Given** `test/agent-injection-strategy.test.js`, **When** run directly
   (`node test/agent-injection-strategy.test.js`), **Then** all tests pass,
   including assertion 3.3.
4. **Given** the existing Cline behavior (dual-file drift detection, fresh-file
   framing template, marker-block replace/preserve, MANIFEST path
   substitution), **When** this story lands, **Then** it is byte-for-byte
   unregressed — verified by running `test/clinerules.test.js` and
   `test/cline-workflow-reconciliation.test.js` directly, both fully green.
5. **Given** `CLINERULES_TEMPLATE_PATH` and `checkClinerulesDualFileDrift`
   (both still exported from `lib/installer.js` and consumed directly by
   `test/clinerules.test.js`), **When** this story lands, **Then** both
   remain exported with unchanged signatures/behavior — only the call-site
   gating conditions change, not the underlying functions.
6. **Given** `test/agent-injection-strategy.test.js` assertion 4.2 (every
   agent has a well-shaped `injectionStrategy` with `position: string` and,
   for non-json-merge agents, `skipPatterns: array`), **When** this story
   lands, **Then** the new `cline` fields are additive and do not break 4.2/
   4.3/4.3b.

## Tasks / Subtasks

### Task 1: Registry — add capability flags (AC: 2, 6)

- [x] 1.1 In `lib/agents.js`, extend the `cline` entry's `injectionStrategy`
      with `dualFileDriftCheck: true` and
      `framingTemplate: 'clinerules.template.md'`.

### Task 2: Installer — branch on registry, not id literal (AC: 1, 3, 5)

- [x] 2.1 Replace `if (agent.id === 'cline') { checkClinerulesDualFileDrift(...) }`
      with `if (agent.injectionStrategy?.dualFileDriftCheck) { checkClinerulesDualFileDrift(...) }`.
- [x] 2.2 Replace the framing-template conditional to resolve the template
      path from `agent.injectionStrategy?.framingTemplate` (joined with
      `lib/templates/`) instead of the hardcoded `CLINERULES_TEMPLATE_PATH`
      constant at the call site. Keep `CLINERULES_TEMPLATE_PATH` itself
      defined/exported unchanged (AC 5) — only the branch's path resolution
      changes to go through the registry field (which happens to name the
      same file for `cline` today).

### Task 3: Verification (AC: 3, 4)

- [x] 3.1 Run `node test/agent-injection-strategy.test.js` directly — all
      tests green including 3.3.
- [x] 3.2 Run `node test/clinerules.test.js` directly — all tests green
      (dual-file drift, framing template, idempotency, marker preservation
      all unregressed).
- [x] 3.3 Run `node test/cline-workflow-reconciliation.test.js` directly —
      all tests green (unrelated to this change, but part of the Cline
      behavior surface — confirms no incidental regression).
- [x] 3.4 Run `npm run build:plugin` — confirm exit 0 (no plugin bundle
      content is touched by this story, but the gate must stay green).

## Dev Notes

- Optional-chaining (`agent.injectionStrategy?.dualFileDriftCheck`) is safe
  here: every registry entry defines `injectionStrategy` as a plain object
  (assertion 4.2 already enforces this), so `?.` is defensive-but-inert in
  practice — it only matters if a future agent entry omits the property
  entirely, which 4.2 would catch anyway.
- The framing-template path is now resolved via
  `path.join(EXTRA_TEMPLATE_DIR /* == lib/templates/ */, agent.injectionStrategy.framingTemplate)`
  rather than the standalone `CLINERULES_TEMPLATE_PATH` constant, so the
  behavior generalizes to any future agent that sets `framingTemplate`
  without further installer.js edits. `CLINERULES_TEMPLATE_PATH` remains a
  separate exported constant (still pointing at the same file) because
  `test/clinerules.test.js` imports and asserts against it directly (AC 5) —
  removing or renaming it would be an unrelated breaking change outside this
  story's scope.
- No change to `checkClinerulesDualFileDrift`'s internals (still hardcodes
  `.cline/clinerules.md` vs `.clinerules` — that is a Cline-specific legacy
  migration check, not something other agents need; generalizing its
  internals is out of scope).

## Testing

- `node test/agent-injection-strategy.test.js` — must be fully green (was
  failing at 3.3 before this fix).
- `node test/clinerules.test.js` — must be fully green (regression guard for
  Cline install behavior).
- `node test/cline-workflow-reconciliation.test.js` — must be fully green
  (adjacent Cline behavior, confirms no incidental breakage).
- `npm run build:plugin` — must exit 0.
