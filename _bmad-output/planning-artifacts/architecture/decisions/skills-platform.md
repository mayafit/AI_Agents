# Skills Platform — Architecture Decisions

> **Shard** of the [Architecture index](../../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Constrains prd/capabilities/skills-platform.md.

---

## Decisions

### Decision P2-1: Instruction Injection Priority (FR51)

**Decision:** Agent-aware TOP injection with skip patterns

The agent registry in `agents.js` gains an `injectionStrategy` property per agent:

```javascript
{
  name: 'claude-code',
  instructionFile: 'CLAUDE.md',
  injectionStrategy: {
    position: 'top',
    skipPatterns: ['---']  // skip YAML frontmatter block if present
  }
}
```

**Behavior:**
- `installer.js` reads the target instruction file
- Parses file headers based on agent-specific `skipPatterns` (frontmatter, shebang, etc.)
- Injects `<!-- MA-AGENTS-START -->` block after any required file headers but before all other content
- If block already exists (update scenario), removes old block first then injects at top
- Format awareness is centralized in `agents.js` — installer logic is format-agnostic

**Rationale:** Different agents have different file header conventions. Placing the block before a required header would cause the agent to ignore it. The skip patterns keep format knowledge in the agent registry where it belongs.

**Affects:** `installer.js` (injection logic), `agents.js` (registry schema extension)

### Decision P2-4: `critical_actions` for All BMAD Agents (FR52-FR53)

**Decision:** Ship `critical_actions` for all 11 BMAD agents (4 custom + 7 built-in)

**`critical_actions` pattern for all agents:**
```yaml
critical_actions:
  1: "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  2: "For each skill marked always_load: true, read the skill file completely"
  3: "Follow all skill directives during this session"
```

**Custom agents** (SRE, DevOps, Cyber, MIL-498): Full `.customize.yaml` with persona, menu, AND `critical_actions`. These already exist — `critical_actions` are added.

**Built-in BMM agents** (PM, Architect, Dev, QA, SM, Tech Writer, UX Designer): Minimal `.customize.yaml` with ONLY `critical_actions`. No persona or menu overrides — preserves the built-in agent behavior while injecting skill loading.

**Scope expansion:** FR53 in PRD says "All 4 BMAD agents" but the architecture covers all 11 to close the enforcement gap for built-in agents too.

**Affects:** `lib/bmad-extension/agents/` (11 customize files), `bmad.js` (deployment)

### Decision P5-4: Inline Git Workflow Guardrails in Universal Per-Tool Instruction Block (FR204–FR206) (2026-05-24)

**Context.** As of v3.12.3 the only authoritative source for git workflow rules in a ma-agents install is `skills/git-workflow-skill/SKILL.md` — a skill flagged `always_load: true` in the per-tool `MANIFEST.yaml`. The agent is expected to read the manifest on session start and then open the SKILL.md to absorb the worktree / PR / branch rules. Adversarial review of the Workshop install (2026-05-24, `D:\Code\Workshop`, ma-agents v3.12.3 + Claude Code + Cline, profile=on-prem) demonstrated this indirection is too brittle to carry the most consequential rule in the system:

1. `always_load: true` is a polite request in the composed instruction block ("Always load skills marked with always_load: true.") — not enforcement. Models routinely skip the manifest read on short tasks.
2. The only inline reminder in `CLAUDE.md` / `.cline/clinerules.md` after the existing universal + on-prem blocks have been stamped is the generic manifest-load instruction. There is no in-band reference to git, worktrees, branching, or PRs anywhere in the composed marker block. `git log -S "git workflow" -- lib/templates/ lib/installer.js` returns zero hits — the templates have never carried inline git content.
3. The Cline platform has no `SessionStart` hook equivalent to Claude Code's `verify-manifest.js` (`lib/hooks/claude-code/verify-manifest.js`). On Cline installs, the only mandatory load is `.cline/clinerules.md` itself.
4. The `_bmad-output/project-context.md` template (`lib/templates/project-context.template.md`) does contain inline git rules at lines 22–29, but its load depends on each BMAD agent's `critical_actions` step 3 firing — i.e., it only enters context when a BMAD agent (PM, Architect, Dev, …) is explicitly activated. A vanilla turn with no BMAD agent never sees those rules.

The net effect: the most consequential rule in the system (no commits to `main`/`dev`, always work in a worktree, always PR) is two indirections away from the agent's first context window. The Workshop adversarial review made this gap explicit.

**Decision.** Inline the git rules in the first context window for every supported agent by adding a dedicated instruction-block fragment that the existing composer in `lib/installer.js::composeInstructionBlock()` appends unconditionally to the universal block. The fragment is profile-independent — git discipline is not a function of which LLM serves the agent.

**Architecture fit.**

| Concern | Resolution |
|---------|-----------|
| Template location | `lib/templates/instruction-block-git.template.md` — new file. Sibling of `instruction-block-universal.template.md` and `instruction-block-onprem.template.md`. Single source of truth for the inline git body. |
| Composer change | `composeInstructionBlock({ profile, projectRoot })` in `lib/installer.js` (existing function at lines 115–138) appends the git template after the universal template and before the on-prem template (when applicable). Composition order: **universal → git → on-prem**. Pre-existing marker-block idempotency (FR176) is preserved verbatim. |
| Per-tool surface | All four marker-block injection targets already wired by Story 21.2: `CLAUDE.md` (Claude Code), `.cline/clinerules.md` (Cline), `.roo/rules/00-ma-agents.md` (Roo Code), `AGENTS.md` (OpenCode). No new file targets — only the composed content changes. Cursor, Kilocode, Copilot, Gemini inherit via the same composer pathway. |
| Relationship to `git-workflow-skill` | The skill remains the canonical home for the long-form procedure, the `scripts/start-feature.sh` / `finish-feature.sh` helpers, and the install-time git hooks (`pre-commit`, `commit-msg`, `prepare-commit-msg`). The inline template is the rule summary; the skill is the procedural detail. The inline template links to the skill explicitly so a reader who needs the scripted workflow finds it on first hop. |
| Relationship to `project-context.md` | The `## Git Workflow (ALL file-changing tasks)` section in `lib/templates/project-context.template.md` (lines 22–29) is retained — it serves the BMAD-agent activation path. The inline template is the universal path. The two are deliberately redundant: redundancy at this layer is correct because the failure modes are different. The inline template wins where no BMAD agent has been activated; `project-context.md` wins where a BMAD agent is active and has rendered the file into context. |
| Idempotency | The marker-block rewrite contract from FR176 already covers this. The new template appends to the universal block within the same marker pair; content outside the markers is preserved. Running the installer twice with the same profile produces byte-identical output. |
| Backward compatibility | Existing installs that pre-date this change have a marker block missing the git fragment. The next `npx ma-agents install` or `npx ma-agents reconfigure` run will overwrite the marker block to include the git fragment. User content outside the markers remains untouched. No migration script required. |

**Alternatives considered:**
- *Add the rules directly to `instruction-block-universal.template.md`:* Rejected. Keeping git in a separate fragment preserves single-responsibility templates, makes the composition order explicit in the installer, and lets a hypothetical future profile (e.g., a sealed-network profile that disables PR-based merge) opt out of the git block without forking the universal block.
- *Rely on hardening `verify-manifest.js` to gate the agent on actually opening `git-workflow-skill/SKILL.md`:* Rejected. The hook is Claude Code-specific; Cline, Roo Code, and OpenCode have no equivalent. The fix must work across all four marker-block targets.
- *Add a Claude Code `PreToolUse` hook on `git commit` that blocks commits to `main`/`dev`:* Considered as a complementary enforcement layer. Out of scope for this decision — the inline rule is the foundational fix; a follow-up hook can layer on top without rework. Recorded as a deferred follow-up in the Epic 26 body.
- *Replace the `always_load: true` mechanism with a hard requirement to read `git-workflow-skill/SKILL.md` on every `Edit`/`Write`:* Rejected as architecturally heavier than necessary and still per-tool-asymmetric (Claude Code has hooks; Cline does not). The inline rule reaches the model the moment the session starts, which is the only guarantee that matters for branching discipline.

**Files affected:**
- `lib/templates/instruction-block-git.template.md` (new — the inline rule body)
- `lib/installer.js` (modify `composeInstructionBlock` to load and append the git template; add a `GIT_INSTRUCTION_TEMPLATE_PATH` constant alongside the existing universal/on-prem constants)
- `lib/templates/instruction-block-universal.template.md` (no change — kept profile-neutral and git-neutral)
- `skills/git-workflow-skill/SKILL.md` (no change — remains the procedural reference)
- `lib/templates/project-context.template.md` (no change — retains its existing `## Git Workflow` section for the BMAD-agent activation path)
- `test/instruction-block-git.test.js` (new — composition order, profile coverage, idempotency, and stamping into all four per-tool injection targets)

**FR Coverage:** FR204, FR205, FR206. Builds on FR174 (universal block content), FR176 (marker idempotency), and the per-tool surface delivered by Story 21.2.

---
