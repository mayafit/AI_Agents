# Story 15.6: Separate Built-in Agent Customizations

Status: ready-for-dev

## Story

As a **Chief Architect**,
I want the `.customize.yaml` files for 8 built-in BMM agents moved from `lib/bmad-extension/agents/` to `lib/bmad-customize/`,
So that module-owned agents (in skill folders) are cleanly separated from customizations of other modules' agents.

## Acceptance Criteria

1. 8 built-in agent `.customize.yaml` files (bmm-pm, bmm-architect, bmm-dev, bmm-qa, bmm-sm, bmm-tech-writer, bmm-ux-designer, core-bmad-master) exist in `lib/bmad-customize/`
2. Each file contains only `critical_actions` using 6.2.0 array syntax (list of strings) — no persona, menu, or other overrides
3. `bmad.js` deploys these files from `lib/bmad-customize/` to `_bmad/_config/agents/` AFTER `--custom-content` deploys the extension module
4. `lib/bmad-extension/agents/` directory no longer exists (custom agents moved to `skills/` in 15.3, built-ins moved here)
5. `lib/bmad-customizations/` directory content is fully accounted for (custom agent content merged in 15.3, built-in content moved here)

## Tasks / Subtasks

- [ ] Task 1: Create lib/bmad-customize/ with built-in agent files (AC: #1, #2)
  - [ ] 1.1 Create `lib/bmad-customize/` directory
  - [ ] 1.2 Create `lib/bmad-customize/bmm-pm.customize.yaml` with critical_actions array only
  - [ ] 1.3 Create `lib/bmad-customize/bmm-architect.customize.yaml`
  - [ ] 1.4 Create `lib/bmad-customize/bmm-dev.customize.yaml`
  - [ ] 1.5 Create `lib/bmad-customize/bmm-qa.customize.yaml`
  - [ ] 1.6 Create `lib/bmad-customize/bmm-sm.customize.yaml`
  - [ ] 1.7 Create `lib/bmad-customize/bmm-tech-writer.customize.yaml`
  - [ ] 1.8 Create `lib/bmad-customize/bmm-ux-designer.customize.yaml`
  - [ ] 1.9 Create `lib/bmad-customize/bmm-bmad-master.customize.yaml` (note: filename may be `core-bmad-master` — check current naming)

- [ ] Task 2: Update bmad.js deployment logic (AC: #3)
  - [ ] 2.1 Read current `applyCustomizations()` function in `lib/bmad.js` (lines ~199-212)
  - [ ] 2.2 Add deployment step: copy files from `lib/bmad-customize/*.customize.yaml` to `_bmad/_config/agents/`
  - [ ] 2.3 Ensure this runs AFTER `--custom-content` deploys the extension module
  - [ ] 2.4 Ensure this runs BEFORE `--action quick-update` to apply customizations

- [ ] Task 3: Clean up old directories (AC: #4, #5)
  - [ ] 3.1 Verify all 4 custom agent files from `lib/bmad-extension/agents/` are now in `skills/` (from Story 15.3)
  - [ ] 3.2 Verify all 8 built-in agent files from `lib/bmad-extension/agents/` are now in `lib/bmad-customize/`
  - [ ] 3.3 Delete `lib/bmad-extension/agents/` directory
  - [ ] 3.4 Verify `lib/bmad-customizations/` content is fully migrated:
    - 4 custom agent `.customize.yaml` → merged into SKILL.md (Story 15.3)
    - 4 custom agent `.md` persona files → merged into SKILL.md (Story 15.3)
    - Agent-platform `.customize.yaml` files (claude-code, cursor, cline, etc.) → evaluate if still needed or if they should move too
  - [ ] 3.5 Handle remaining `lib/bmad-customizations/` files (platform-specific customizations: `claude-code.customize.yaml`, `cursor.customize.yaml`, etc.)

## Dev Notes

### Critical: Identify ALL 12 Files in lib/bmad-extension/agents/

Current contents (from codebase analysis):
```
lib/bmad-extension/agents/
├── bmm-architect.customize.yaml     ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-bmad-master.customize.yaml   ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-cyber.customize.yaml         ← CUSTOM (→ skills/ via Story 15.3)
├── bmm-dev.customize.yaml           ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-devops.customize.yaml        ← CUSTOM (→ skills/ via Story 15.3)
├── bmm-mil498.customize.yaml        ← CUSTOM (→ skills/ via Story 15.3)
├── bmm-pm.customize.yaml            ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-qa.customize.yaml            ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-sm.customize.yaml            ← BUILT-IN (→ lib/bmad-customize/)
├── bmm-sre.customize.yaml           ← CUSTOM (→ skills/ via Story 15.3)
├── bmm-tech-writer.customize.yaml   ← BUILT-IN (→ lib/bmad-customize/)
└── bmm-ux-designer.customize.yaml   ← BUILT-IN (→ lib/bmad-customize/)
```

**8 built-in + 4 custom = 12 total.** This matches.

### critical_actions Format (6.2.0 array syntax)

Each built-in `.customize.yaml` should contain ONLY:

```yaml
# MA-AGENTS: skill enforcement for {agent-name}
critical_actions:
  - "Read the skills MANIFEST at {project-root}/skills/MANIFEST.yaml"
  - "For each skill marked always_load: true, read the skill file completely"
  - "If _bmad-output/project-context.md exists, read it completely"
  - "Follow all skill directives and project-context rules during this session"
```

**No persona, no menu, no other fields.** These files ONLY add critical_actions to built-in agents.

### bmad.js Deployment Sequence (Updated)

Per architecture P2-9, the new deployment sequence is:
1. Pre-populate `~/.bmad/cache/external-modules/` from `lib/bmad-cache/`
2. Invoke bmad-method with `--custom-content "lib/bmad-extension/"` — deploys module (4 agents + all workflow skills)
3. **NEW:** Copy `lib/bmad-customize/*.customize.yaml` to `_bmad/_config/agents/` — adds critical_actions to 8 built-in agents
4. Run `--action quick-update` to apply customizations

### lib/bmad-customizations/ Residual Files

After Stories 15.3 and 15.6, the following files in `lib/bmad-customizations/` need disposition:

| File | Status |
|------|--------|
| `bmm-sre.customize.yaml` | Merged into SKILL.md (Story 15.3) |
| `bmm-devops.customize.yaml` | Merged into SKILL.md (Story 15.3) |
| `bmm-cyber.customize.yaml` | Merged into SKILL.md (Story 15.3) |
| `bmm-mil498.customize.yaml` | Merged into SKILL.md (Story 15.3) |
| `sre.md` | Merged into SKILL.md (Story 15.3) |
| `devops.md` | Merged into SKILL.md (Story 15.3) |
| `cyber.md` | Merged into SKILL.md (Story 15.3) |
| `mil498.md` | Merged into SKILL.md (Story 15.3) |
| `claude-code.customize.yaml` | **EVALUATE** — platform-specific, may still be needed by `agents.js` |
| `cursor.customize.yaml` | **EVALUATE** — platform-specific |
| `cline.customize.yaml` | **EVALUATE** — platform-specific |
| `gemini.customize.yaml` | **EVALUATE** — platform-specific |
| `generic.customize.yaml` | **EVALUATE** — platform-specific |
| `antigravity.customize.yaml` | **EVALUATE** — platform-specific |

**DO NOT delete platform-specific files** unless confirmed they're unused by `agents.js` or other modules.

### Files to Touch

| File | Change |
|------|--------|
| `lib/bmad-customize/*.customize.yaml` | NEW — 8 files with critical_actions only |
| `lib/bmad.js` | Update deployment to copy from `lib/bmad-customize/` |
| `lib/bmad-extension/agents/` | DELETE directory (after verification) |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — P2-9, built-in BMM agent customization, deployment sequence]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 15.6]
- [Source: lib/bmad-extension/agents/ — 12 current .customize.yaml files]
- [Source: lib/bmad.js — applyCustomizations() function]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
