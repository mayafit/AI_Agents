---
status: ready-for-dev
---
# Product Requirements Document

This is a planning-heavy project: it has a dense PRD and no story files at
all. A project shaped like this used to produce zero graph edges — a cloud
of disconnected dots. This fixture exercises the fix.

## Epic 1: Foundation

Epic 1 covers FR1 and FR2, laying the groundwork referenced throughout this
document.

### Acceptance Criteria

FR1 must be delivered before FR2 can begin.

## Epic 2: Operational Map Shell

Epic 2 relates closely to FR26 and also touches NFR5 for performance.

## Cross-cutting concerns

This section has no single dominant entity heading, so it owns no section.
It mentions FR1, FR2, and FR26 again here (doc-level dedup must collapse
these repeats to one doc->entity edge per token, not one per occurrence).

FR30 is mentioned ONLY in this section — it has no owning epic and no
implementing story anywhere in this project, so it must still show up as an
orphan/gap even though it now has a `references` edge from this document.
