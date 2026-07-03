# Product Requirements Document

## Project: Degraded Atlas Fixture

This is a valid PRD used as the anchor document in the degraded-project fixture.
The fixture contains other malformed/bad files to verify graceful degradation.

### Goals

- The Atlas must not crash on malformed inputs (NFR63, FR234)
- Malformed documents are omitted or noted — never silently corrupting output
- The disabled-JS baseline renders a legible, navigable site

### Requirements

FR234 — The generate command must tolerate bad-YAML frontmatter, zero-byte files,
binary files, and unknown doc types without aborting.

### Status

- status: draft
- Priority: high
