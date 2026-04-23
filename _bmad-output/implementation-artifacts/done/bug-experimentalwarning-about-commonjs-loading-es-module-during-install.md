---
type: bug
status: ready-for-dev
severity: medium
bug_type: other
version_found: 3.5.4
title: ExperimentalWarning about CommonJS loading ES Module during install
---

# Bug: ExperimentalWarning about CommonJS loading ES Module during install

**Severity:** medium
**Affected Component:** installer CLI (bin/cli.js + bmad-method child spawn)

## Reproduction Steps

1. Use a Node version that emits the experimental `require()` of ESM warning (Node 20.17+ through early 22.x; see Node release notes on `--experimental-require-module`).
2. From a clean working directory, run `node bin/cli.js install --yes --agent claude-code` (or equivalently `npx ma-agents install`).
3. Observe startup stderr before the BMAD banner appears.

## Expected Behavior

Installer starts cleanly with only intentional informational output. No `ExperimentalWarning` noise appears on any Node version supported by `engines` (`>=16.0.0`).

## Actual Behavior

Stderr shows a message of the form:

```
(node:XXXXX) ExperimentalWarning: CommonJS module <path> is loading ES Module <path> using require().
Support for loading ES Module in require() is an experimental feature and might change at any time.
```

The installer still completes successfully, but the warning is noisy, alarms first-time users, and appears in CI logs.

## Root Cause Hypothesis

The ma-agents CLI (`bin/cli.js`, CommonJS) spawns the bmad-method CLI (`node_modules/bmad-method/tools/bmad-npx-wrapper.js`, also CommonJS). bmad-method interacts with `@clack/prompts` and `@clack/core`, both of which declare `"type": "module"` in their `package.json`. On Node runtimes that emit `ExperimentalWarning` for `require()` of an ESM package (Node 20.17+ with `--experimental-require-module` default-on), the warning surfaces during install startup. While bmad-method already uses dynamic `import()` for the `@clack/*` packages in newer paths, the warning can still be produced by a transitive CJS → ESM require chain under certain Node versions.

## Affected Files

- `bin/cli.js`
- `lib/bmad.js`

## Suggested Fix

Install a process-level warning filter at the top of `bin/cli.js` that suppresses only `ExperimentalWarning` whose message matches the `require()`-of-ESM pattern, while re-emitting every other warning (DeprecationWarning, unhandled rejections, custom warnings) via `process.emitWarning` so they remain visible. Additionally, pass a sanitized `env` to the bmad-method child spawn in `lib/bmad.js` — set `NODE_OPTIONS` to include `--no-warnings=ExperimentalWarning` (Node 22+) or use the equivalent `NODE_NO_WARNINGS=1` as a narrow fallback — so the spawned child is equally quiet. Add `test/experimental-warning.test.js` to assert:

1. The filter swallows the specific ExperimentalWarning.
2. Unrelated warnings (e.g., a synthetic `DeprecationWarning`) are still emitted.
3. `lib/bmad.js` spawn envs include the expected suppression flag.

## Notes

- Created via `create-bug-story` workflow
- Discoverable by sprint workflows via glob: `_bmad-output/implementation-artifacts/bug-*.md`
- To add to a sprint, run `/add-to-sprint`
