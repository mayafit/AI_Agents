# Architecture — Config Project (external knowledge base)

This architecture document lives in the external `config-project-knowledge/`
source alongside the PRD.

## P9-1: Knowledge-source resolution order

Decision P9-1 — resolve sources in this order: the default `_bmad-output`
first, then each configured `planning_artifacts` / `implementation_artifacts` /
`knowledgebase_path` entry, unioned and deduped by resolved absolute path.

This decision backs FR501 (multi-source scan) and NFR501 (deterministic
fileIds).
