---
title: Authored Links PRD
status: in-progress
---

# Product Requirements Document

## Overview

This PRD exercises AUTHORED markdown cross-links to sibling source docs — the
confirmed real-project bug (18 broken links on Prophesys): reading-view docs
contain authored relative `.md` links that markdown-it passes through
verbatim, but every reading view is written FLAT at `docs/<slug>.html`, so
the raw link resolves against the wrong base directory.

## Links

- Sibling with anchor: see the [roadmap](roadmap.md#7-development-timetable).
- Subdirectory: see the [domain model](sub/domain-model.md).
- Parent directory: see the [glossary](../glossary.md).
- Space + uppercase extension: see the [system description](General%20System%20Description.MD).
- Sibling, no anchor: see the [roadmap again](roadmap.md).
- Genuinely non-scanned target (must NOT be rewritten): see [missing doc](missing-file.md).

## Functional Requirements

### FR201: Cross-linking

The system shall render authored cross-links correctly.
