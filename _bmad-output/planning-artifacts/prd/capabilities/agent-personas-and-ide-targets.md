# Agent Personas & IDE / Tool Targets

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F6 (Specialized Agent Personas), F14 (OpenCode Agent Support),
> F22 (Cline Workflow Generation). Architecture: P2-2, P5-3.

---

## Functional Requirements

### Specialized Agent Personas (MIL-STD-498 / SRE / DevOps / Cyber)

- FR35: Engineers can target BMAD specialized agents (SRE, DevOps, Cyber, MIL-STD-498, SQA) for persona installation
- FR42: The Chief Architect can develop new specialized agent personas for enterprise-specific roles

### OpenCode Agent Support

- FR56: Engineers can target OpenCode for skill installation with skills placed in `.opencode/skills/`
- FR57: The installer injects skill references into `opencode.json` via the instructions array using JSON config merging (not replacement)

### Cline Workflow Generation

- FR199: When Cline is among the selected tools for a BMAD install, update, or migration, the installer invokes `deployClineWorkflows(projectRoot, tools)` after the BMAD operation completes — scanning `.cline/skills/` for all BMAD-installed skill subdirectories and generating a `.clinerules/workflows/<skill-name>.md` wrapper file for each one. Per Cline's official documentation, `.clinerules/` is a **directory** that Cline reads recursively; all `.md` and `.txt` files inside it are processed as rules. `.clinerules/workflows/` is a subdirectory within it for slash-command workflow definitions
- FR200: For skills that contain a `workflow.md` file, the generated wrapper delegates to that file — allowing Cline to execute the full BMAD workflow document via its native `/workflow-name` invocation. For self-contained skills (SKILL.md only), the wrapper instructs Cline to read SKILL.md while ignoring its YAML frontmatter, which Cline does not natively parse
- FR201: Cline workflow wrappers are regenerated on every qualifying install, update, and migration run — ensuring wrappers stay in sync when skills are added, updated, or removed by BMAD
- FR202: Before generating `.clinerules/workflows/` entries, the installer checks whether `.clinerules` exists as a flat file (a legacy incorrect installation artifact). If a flat file is detected at `.clinerules`, the installer removes it and proceeds to create `.clinerules/` as a proper directory. This migration is silent — no user prompt required. Instruction content previously written to the `.clinerules` flat file must not be re-injected there; `.cline/clinerules.md` is the sole injection target for Cline instruction blocks. The `checkClinerulesDualFileDrift` guard in `installer.js` must no-op when `.clinerules` is already a directory
- FR203: The Cline `instructionFiles` list in `agents.js` must include only `.cline/clinerules.md` as the instruction injection target — `.clinerules` must not appear in this list. `.cline/clinerules.md` is the single source of truth for the Cline instruction block; writing the same instruction content to both `.clinerules` and `.cline/clinerules.md` is a duplicate and is forbidden
