# Architecture Validation & Readiness

> **Shard** of the [Architecture index](../architecture.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Validation content only. The P3/P4/P5 decision log that used to sit under this
> heading now lives in architecture/decisions/, grouped by capability.

---

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** PASS
- Node.js runtime + plain JavaScript + no build step + no framework — all align
- 4-module architecture with strict boundaries maps cleanly to the extensibility model
- Pipeline architectures (5-stage install, 6-stage BMAD) don't conflict
- P2-1 (TOP injection) and P2-2 (JSON injection) are independent strategies driven by `agents.js` registry
- P2-6 rev (explicit params) + P2-9 (module restructure) work together: `--custom-content` deploys the restructured module, explicit params ensure correct tool/module selection
- P2-9 (agents as skills) + P2-4 (critical_actions) — clean separation: custom agents embed critical_actions in SKILL.md, built-in agents get critical_actions via `.customize.yaml`
- P2-10 (multi-repo) integrates cleanly: config values written at install time, consumed by BMAD workflows at runtime
- P2-11 (unified sprint-status) + P2-10 (multi-repo) — `sprint_management_path` resolves file location, unified file eliminates cross-repo dual-write risk
- P2-11 (unified sprint-status) + P2-5 (extension workflows) — all 6 sprint workflows target the same single file, movement semantics enforce item uniqueness
- bmad-method v6.2.0 pin aligns with skill-based module structure in P2-9

**Note:** P2-3 (Extension Module Structure, 2026-03-11) is now HISTORICAL — superseded by P2-9 which restructures the extension module to follow BMAD 6.2.0 conventions. P2-4 (critical_actions) references updated: custom agents' critical_actions now live in SKILL.md (not `.customize.yaml`); built-in agent customizations now live in `lib/bmad-customize/` (not `lib/bmad-extension/agents/`).

**Pattern Consistency:** PASS
- Agent skill naming (`bmad-ma-agent-sre`) follows verified CIS convention (`bmad-cis-agent-innovation-strategist`)
- Workflow skill naming (`mil498-srs`, `sre-health-check`) follows CIS convention (`bmad-cis-innovation-strategy`)
- `bmad-skill-manifest.yaml` uses same fields as CIS (type, name, displayName, module)
- `.customize.yaml` array syntax for critical_actions matches BMAD 6.2.0 documentation
- Naming conventions (camelCase code, kebab-case files, snake_case skill.json) remain consistent

**Structure Alignment:** PASS
- `lib/bmad-extension/skills/` mirrors CIS `src/skills/` pattern
- `lib/bmad-customize/` cleanly separates module-owned agents from built-in agent customizations
- `--custom-content` deployment replaces manual file copying — follows BMAD's official deployment mechanism
- Module boundary table still holds: `bmad.js` handles extension deployment + customize deployment

### Requirements Coverage Validation

**Functional Requirements Coverage:**

| FR Category | Architectural Support | Status |
|-------------|----------------------|--------|
| Skill Management (FR1-7) | Install pipeline + manifest manager | COVERED |
| BMAD Integration (FR8-12) | BMAD pipeline architecture | COVERED |
| MIL-STD-498 Generation (FR13-23) | BMAD workflows (via extension module skills) | COVERED |
| SDLC Workflows (FR24-33) | BMAD workflows | COVERED |
| Agent Targeting (FR34-38) | Agent registry + template resolution chain | COVERED |
| Skill Authoring (FR39-43) | Skill schema contract + MANIFEST.yaml generation | COVERED |
| Environment & Deployment (FR44-47) | Cross-platform paths + offline operation | COVERED |
| Audit & Traceability (FR48-50) | BMAD workflows + ai-audit-trail skill | COVERED |
| Skill Enforcement (FR51-55) | P2-1 + P2-9 + P2-4: injection strategies, agent SKILL.md, built-in .customize.yaml | COVERED |
| OpenCode Support (FR56-57) | P2-2: JSON injection + new agent registry entry | COVERED |
| Project Knowledge (FR58-59) | Gitignore pattern: remove `_bmad-output` from `.gitignore` | COVERED |
| Bug Management (FR60-64) | P2-5: extension workflow skill + `auto-bug-detection` skill | COVERED |
| Sprint Management (FR65-71) | P2-5 + P2-11: 6 extension workflow skills (add/modify/add-to/remove-from/close sprint) operating on unified `sprint-status.yaml` | COVERED |
| Agent Activity Dashboard (FR87-93) | Deferred to Phase 3 | N/A |
| Knowledge Graph (FR141-157) | P3-1: JSON graph file, files table, skill emission, open-graph skill, self-contained renderer | COVERED |
| Knowledge Atlas (FR215-234) | P5-7: pre-bundled offline static-site generator (bmad-knowledge skill), scan-first manifest pipeline, manifest superset of knowledge-graph.json, zero-dependency-first rendering, sealed offline packaging | COVERED |
| Agent Conversion (FR94-97) | P2-9: agent skill folders with SKILL.md + bmad-skill-manifest.yaml | COVERED |
| MIL-498 Workflow Conversion (FR98-100) | P2-9: Complex Workflow skills with prompts/ step files | COVERED |
| SRE/DevOps/Cyber Conversion (FR101-103) | P2-9: skill packages with SKILL.md | COVERED |
| Module Architecture (FR104-106) | P2-9: module.yaml with code field, skills/ layout, dual-layer eliminated | COVERED |
| Upgrade Path (FR107-110) | P2-9: migration detection, backup, upgrade, merge, cleanup | COVERED |
| Multi-Repo Layout (FR111-122) | P2-10: wizard, config, project-layout.yaml, path resolution | COVERED |
| Bundled Install + Params (FR74-76, FR123-127) | P2-6 rev: buildBmadArgs(), explicit flags, --custom-content | COVERED |
| Knowledge Graph (FR141-157) | P3-1: `lib/bmad-extension/skills/open-graph/`, `_bmad-output/knowledge-graph.json`, emitting BMAD skills | COVERED |
| Knowledge Atlas (FR215-234) | P5-7: `lib/knowledge-atlas/` engine + `lib/bmad-extension/skills/bmad-knowledge/`, `_bmad-output/knowledge-site/` output, manifest reconciled with `knowledge-graph.json` | COVERED |
| Developer Infrastructure (FR73) | Tests directory defined | COVERED |
| Methodology Onboarding (FR72) | Bundled presentation deployment | COVERED |
| Project Context (FR79-86) | P2-7: template-based generation, platform paths, critical_actions | COVERED |

**Non-Functional Requirements Coverage:**

| NFR | Architectural Support | Status |
|-----|----------------------|--------|
| NFR1-4 (Security) | No network calls, plain text content, additive-only ops | COVERED |
| NFR5-8 (Integration Reliability) | Pipeline ordering, atomic manifests, additive installs | COVERED |
| NFR9-12 (Portability) | path.join centralization, template resolution chain, Node LTS | COVERED |
| NFR13-15 (Maintainability) | Config-driven agent registry, directory-scanned skills, backward compat | COVERED |
| NFR16-19 (BMAD Extension) | Module identity via code field, zero core mods, additive JSON, dual invocation | COVERED |
| NFR20-21 (Bundled Install) | Version pinning to 6.2.0, deterministic bundled output | COVERED |
| NFR22-25 (Project Context) | Template-based, idempotent, version comment | COVERED |
| NFR26-28 (Dashboard) | Deferred to Phase 3 | N/A |
| NFR29 (Atomic migration) | P2-9: backup before, restore on failure | COVERED |
| NFR30 (Functional equivalence) | P2-9: same menus, same workflows in new format | COVERED |
| NFR31 (Lint gate compliance) | P2-9: follows verified CIS module pattern | COVERED |
| NFR32 (Output equivalence) | P2-9: same templates, same step files | COVERED |
| NFR33 (Anti-zombie idempotency) | Depends on bmad-method setup skill behavior | MINOR GAP |
| NFR34-37 (Multi-Repo) | P2-10: backward compat, air-gapped, deterministic, config-driven | COVERED |
| NFR38-41 (Knowledge Graph) | P3-1: pre-computed layout + SVG, copy-pattern JSON, additive-only emission, inlined self-contained HTML | COVERED |
| NFR60-69 (Knowledge Atlas) | P5-7: sealed offline packaging (egress-blocked gate), no per-project install, non-destructive isolation, content-hash incremental, Windows/CRLF determinism, graceful degradation, sanitized output, design-system + a11y, zero-dependency-first footprint | COVERED |

### Implementation Readiness Validation

**Decision Completeness:** HIGH
- 11 Phase 2 decisions documented (P2-1 through P2-11, with P2-3 superseded by P2-9)
- 2 Phase 3 decisions documented (P3-1: BMAD Knowledge Graph — FR141-FR157, NFR38-NFR41; P3-2: SQA Agent — FR158-FR171, NFR42-NFR43)
- 1 Phase 4 decision documented (P4-1: BMAD v6.3.0 Plugin Migration — FR182-FR195, NFR50-NFR54)
- P2-6 rev includes code example with full parameter mapping table
- P2-9 includes verified module structure from CIS, manifest examples, migration detection code
- P2-10 includes wizard flow, config storage format, cross-reference file schema
- P2-11 includes unified YAML schema, movement semantics, close-sprint lifecycle, install-time backend selection (file-system / custom path / Jira), tool-agnostic Jira operation model with interactive error handling, 13-skill integration map; companion spec at `mcp-detection-pattern-spec.md`

**Pattern Completeness:** HIGH
- CIS module pattern verified against actual source code — not assumed
- Agent skill naming, manifest fields, module.yaml structure all confirmed
- `.customize.yaml` behavior (appends vs replaces) documented from BMAD 6.2.0 official docs
- `--custom-content` validation rules documented (requires module.yaml with code field)

**Structure Completeness:** HIGH
- Full directory tree updated with 44-skill extension module layout (42 + close-sprint + remove-from-sprint)
- `lib/bmad-customize/` separated from `lib/bmad-extension/`
- Module boundary table still accurate — `bmad.js` handles both extension and customize deployment
- `_bmad-output/` structure updated with `sprint-status.yaml` and `done/` archive directory

### Gap Analysis Results

**No Critical Gaps.** All 141 FRs and 37 NFRs have architectural support (excluding Phase 3 deferred items). P2-11 closes the sprint data consistency gap identified during skill development.

**Important Gaps:**
- Testing framework not yet decided — blocks regression testing
- Visual Studio integration mechanism unknown — blocks new agent target (Phase 3)
- P2-3 should be marked as HISTORICAL in the document to avoid confusion with P2-9

**Minor Gaps:**
- NFR33 (anti-zombie idempotency) depends on bmad-method behavior, not ma-agents architecture
- No formal error code catalog
- No formal logging strategy

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (141 FRs, 37 NFRs)
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped (enforcement, multi-repo path resolution, 6.2.0 migration)

**Architectural Decisions**
- [x] Critical decisions documented with rationale (P2-1 through P2-10)
- [x] Technology stack fully specified (Node.js, bmad-method v6.9.0)
- [x] Pipeline architectures defined (5-stage install, 6-stage BMAD, 14-step Phase 2 implementation)
- [x] Extensibility model formalized (config-driven agents, directory-scanned skills, BMAD module pattern)
- [x] Module architecture verified against BMAD 6.2.0 source (CIS module reference)

**Implementation Patterns**
- [x] Naming conventions established (agent skills follow CIS naming)
- [x] Structure patterns defined (skill folders, manifest files)
- [x] Format patterns specified (YAML array syntax for critical_actions)
- [x] Process patterns documented (adding agents, skills, workflows)
- [x] Anti-patterns explicitly listed (both Phase 1 and Phase 2)

**Project Structure**
- [x] Complete directory structure defined (44-skill extension module)
- [x] Component boundaries established (extension module vs customize files)
- [x] Integration points mapped (--custom-content, config.yaml, project-layout.yaml)
- [x] Requirements to structure mapping complete (all FR groups mapped)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — architecture verified against BMAD 6.2.0 source code (CIS module pattern), official documentation (customize, non-interactive install), and bmad-method CLI flags

**Key Strengths:**
- Configuration-driven extensibility eliminates code changes for the most common operations
- BMAD 6.2.0 module pattern verified against actual CIS module source — not assumed
- Explicit CLI parameter passing solves 3 known installer bugs with minimal code
- Clean separation: module-owned agents (SKILL.md) vs. built-in agent customizations (.customize.yaml)
- Multi-repo support is config-driven with no installer code changes for BMAD workflow path resolution
- Air-gapped operation preserved through bundled cache + explicit params

**Areas for Future Enhancement:**
- Testing framework decision and test suite creation
- Error code standardization
- Structured logging for diagnostic purposes
- Visual Studio integration investigation (Phase 3)
- Agent Activity Dashboard architecture (Phase 3)

---
