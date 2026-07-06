---
status: in-progress
epic: epic-9
---

# Story 9.1: Config-aware knowledge-source scan

Status: in-progress

## Story

As a BMAD user whose planning docs live outside `_bmad-output`,
I want the Knowledge Atlas to scan the configured knowledge sources,
so my external PRD/architecture are part of the graph.

## Acceptance Criteria

1. This story implements FR501 (multi-source scan) and NFR501 (deterministic
   fileIds), both defined in the external planning source.
2. Cross-source `implements` edges resolve to the external `config-project-knowledge`
   documents, not to a synthetic local node.

## Notes

Implements FR501 and NFR501. See the architecture decision P9-1 for the
source-resolution ordering.
