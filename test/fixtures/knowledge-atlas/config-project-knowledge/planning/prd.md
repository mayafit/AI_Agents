# Product Requirements — Config Project (external knowledge base)

This PRD lives OUTSIDE the project's `_bmad-output`, under a sibling
`config-project-knowledge/` folder referenced via `planning_artifacts` /
`knowledgebase_path` in `_bmad/bmm/config.yaml`.

## Functional Requirements

### FR501: Multi-source knowledge scan

FR501 — the Atlas scans the union of the default `_bmad-output` source and every
configured external knowledge source.

### FR502: Source dedup

FR502 — a source that duplicates or nests within another is scanned exactly once.

## Non-Functional Requirements

### NFR501: Deterministic external fileIds

NFR501 — external-source fileIds are `<basename>/<relPath>`, machine-independent,
never absolute and never containing `..`.
