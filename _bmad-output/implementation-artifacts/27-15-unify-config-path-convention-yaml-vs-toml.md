---
type: bug
severity: low
title: Per-module config.yaml uses relative paths while config.toml uses {project-root}/ — three conventions in play
epic: 27
---

# Bug: `.yaml` relative vs `.toml` `{project-root}/` path-convention split

**Status:** ready-for-dev
**Severity:** low
**Verdict:** ARCHITECTURE
**Affected Component:** upstream `bmad-method` (`manifest-generator.js:writeCentralConfig` ~422-582 keeps `{project-root}/`; `official-modules.js:1916-1918` strips it for `config.yaml`); ma-agents `bin/cli.js` (`writeRepoLayoutConfig` ~498-547, adds a third relative variant)

## Summary

`_bmad/bmm/config.yaml` declares `planning_artifacts: "_bmad-output/planning-artifacts"`
(relative) while `_bmad/config.toml [modules.bmm]` declares
`"{project-root}/_bmad-output/planning-artifacts"` (prefixed). Two sources of truth with
divergent path styles → a consumer reading the "wrong" file resolves a different path.

## Root Cause

Two upstream generators with deliberately different prefixing rules:
- `config.toml` via `manifest-generator.js:writeCentralConfig` **retains**
  `{project-root}/`.
- per-module `config.yaml` via `official-modules.js:1916-1918` **strips**
  `{project-root}/` for clean display/storage.

ma-agents compounds it: `writeRepoLayoutConfig` (`bin/cli.js:525-540`) appends layout
keys using bare relative `_bmad-output/...` — matching the `.yaml` style but diverging
from the `.toml`.

## Why ARCHITECTURE

Structural "two configs, two conventions" inherited from upstream and mildly compounded
locally. Reconciling to one convention is a design decision, not a single logic bug.

## Proposed Direction

Lowest-risk, ma-agents-owned: make `writeRepoLayoutConfig` (`bin/cli.js:525-540`) emit
the same `{project-root}/`-prefixed form the `.toml` uses, so ma-agents stops adding a
third variant. Document `.toml` as the install-owned source of truth and `.yaml` as the
upstream-stripped read copy. Fully eliminating the relative/absolute split needs an
upstream change to align `official-modules.js:1916-1918` with `manifest-generator.js`
(file as upstream follow-up; do not edit vendored code here).
