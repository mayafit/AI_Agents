# Project Agent Instructions

This file is auto-discovered by OpenCode and any agent that respects `AGENTS.md`.
It establishes universal safety rules, text-vs-file discipline, and BMAD phase
discipline for every agent operating in this project.

## Universal Rules

The universal rules block below is stamped and maintained by ma-agents. Edit
outside the HTML-comment `MA-AGENTS` start and end markers to preserve your
own additions — content inside the markers is regenerated on every install.

<!-- MA-AGENTS-START -->
<!-- MA-AGENTS-END -->

## Critical Behavior Rules

These rules are non-negotiable across every profile and every agent.

- **Never create files in `~/.claude/` or any user home directory.** All
  project artifacts must land inside the current working directory. Home-
  directory writes cross-contaminate between projects and are a common source
  of secret/config leakage.
- **Never write outside the project root without an explicit user request
  naming the absolute path.** "Write to disk" means the project, not the
  operator's machine.
- **Do not modify files you did not read first.** Read the current content
  before proposing or performing an edit — blind writes silently destroy user
  work.

## BMAD Phase Declaration

BMAD-METHOD organizes work into four phases. Respect the currently declared
phase; do not skip ahead to the next phase without a phase transition signal
from the user, the active skill, or the story status.

- **Discovery / PM (analysis, planning).** Deliverables: product briefs,
  PRDs, market and domain research, epics and stories lists. Do NOT produce
  code, architecture diagrams, or implementation artifacts in this phase.
  When asked "what do you think", respond in text.
- **Architecture.** Deliverables: solution design, component boundaries,
  data-flow, interface contracts. Do NOT write application code or skill
  implementations. Narrate decisions and capture them as documents.
- **Tech Lead / Stories.** Deliverables: individual story files with full
  acceptance criteria, task breakdowns, and dev notes. Do NOT begin
  implementation — stories are contracts the implementer consumes later.
- **Implementation.** Deliverables: code, tests, and the Dev Agent Record on
  the story file. At this phase, write files. Do NOT retroactively fabricate
  planning documents for code that already exists — flag the gap instead.

When no phase is declared (no active skill, no story in progress, no explicit
user statement), ask before assuming.

## Project BMAD Output Structure

BMAD artifacts live under `_bmad-output/` (or the paths configured in
`_bmad/bmm/config.yaml` when present). The install-time resolver logs the
resolved paths on each run; consult that log output if in doubt.

- **Planning artifacts** — PRDs, product briefs, market and domain research.
- **Architecture artifacts** — solution design, component boundaries. May be
  co-located with planning artifacts when no separate directory is configured.
- **Implementation artifacts (stories)** — individual story files and their
  Dev Agent Records.

Always consult the `MANIFEST.yaml` referenced inside the universal block above
for the full list of installed skills and their locations.
