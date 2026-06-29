---
title: System Architecture
status: ready-for-dev
---

# Architecture

## Decision Log

### P5-7: Caching Strategy

We will use an in-memory LRU cache for frequent queries.
This decision addresses NFR56 performance requirements.

### P3-1: Identity Scheme

All entities use the file-id#anchor scheme for stable identity.
Node ids are derived using the GitHub/VSCode markdown anchor algorithm.

### P5-1: Output Isolation

The engine writes only under _bmad-output/knowledge-site/.
No source files are ever modified.

## Components

The system consists of:
- Scanner (FR103 support)
- Extractor
- Graph Builder
- Renderer

Architecture Decision P5-7 and P3-1 are the key design pillars.
