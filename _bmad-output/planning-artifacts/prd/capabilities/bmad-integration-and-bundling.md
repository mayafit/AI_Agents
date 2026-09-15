# BMAD Integration & Offline Bundling

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capabilities F3 (BMAD-METHOD Integration, incl. Bundled Installation) and
> F4 (BMAD Extension Architecture). Architecture: P2-3, P2-6.
>
> Also carries the **install-scope** thread of F26 (Global Installation & Federated
> Knowledge Stores) — FR248–FR253, NFR76–NFR78. Architecture: P5-9 (written and registered
> 2026-08-02; the install-scope half is P5-9.8).

---

## Functional Requirements

### BMAD-METHOD Integration

- FR8: Engineers can install the BMAD-METHOD framework alongside skills in a single workflow
- FR9: Engineers can update an existing BMAD installation to a newer version
- FR10: Engineers can apply organization-specific customizations to BMAD that persist across updates
- FR11: Engineers can register MIL-STD-498 workflows into an existing BMAD installation
- FR12: Engineers can trigger BMAD recompile after customization changes

### Bundled Installation

- FR74: The ma-agents npm package bundles bmad-method v6.3.0 as a direct dependency — no `npx` download at install time
- FR75: The ma-agents npm package bundles pre-cloned BMAD external modules (bmb, cis, tea, gds, wds) under `lib/bmad-cache/` — no git clone at install time
- FR76: Before invoking bmad-method install, the installer pre-populates `~/.bmad/cache/external-modules/` from the bundled cache so bmad-method finds modules locally
- FR123: The ma-agents installer collects all BMAD-relevant configuration during its own interactive wizard — selected platforms/agents, user name, project path, module selections — and passes them to bmad-method as explicit CLI flags (`--tools`, `--modules`, `--directory`, `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder`, `--custom-content`), rather than performing a silent install. For the `--modules` value, the default install set is **`bmm`, `tea`, `bmb`, `cis`**, drawn from the bundled cache manifest (`lib/bmad-cache/cache-manifest.json`). The two design-studio modules `gds` (Game Design Studio) and `wds` (Whiteport Design Studio) are **bundled but not installed by default**: they remain fully available offline through the `--bmad-modules` multiselect, so the air-gap guarantee is unchanged, but they are installed only when the user asks for them. This aligns ma-agents with upstream's own stated defaults, which declare `default_selected: false` on every bundled module and `true` only on `bmm`. The optional-value `--bmad-modules` CLI flag overrides this default — bare (no value) opens a multiselect prompt; with a CSV (e.g. `--bmad-modules tea,bmb`) it installs exactly those. `bmm` is force-included in every path because the BMad core agents live there. Experimental-channel modules (currently `automator`, `type: experimental`) are filtered out of the **bundle** unconditionally; all stable `type: bmad-org` modules — including `wds` — are **bundled** (as of the v6.8.0 integration, Epic 27; `wds` had been retired upstream at 6.3.0 and returned as an active module at 6.8.0). **Bundling and installing are distinct:** every stable module ships in the offline cache so it can be installed without network access, but only the default set above is installed without the user asking. Epic 30's `KNOWN_BUNDLED_MODULES` allowlist (`{tea, bmb, cis, gds, wds}`) and its two-sided set-equality guard (NFR73) govern the **bundle** at cache-build time, computed on the resolved registry set; they are independent of the runtime *install* default. The air-gap coverage of NFR2/NFR50/NFR57 is unchanged.
- FR124: bmad-method performs its full configuration using the explicit parameters passed by ma-agents — the `--yes` flag suppresses prompts for parameters already supplied via flags, but does not skip configuration steps
- FR125: When bmad-method introduces new CLI parameters that ma-agents has not mapped, the `--yes` flag causes bmad-method to apply its own sensible defaults for those parameters — ensuring no configuration is missed even as bmad-method evolves
- FR126: The user experiences a single unified installation wizard — bmad-method runs non-interactively with full explicit parameters, with no separate BMAD interactive prompt appearing during the ma-agents installation flow
- FR127: In non-interactive mode (`--yes --force`), ma-agents uses its own defaults for all parameters and passes them to bmad-method via the same explicit flag mechanism — identical code path as interactive mode with pre-determined answers, ensuring CI/CD installations produce identical BMAD configuration as interactive ones

### Global Installation Scope (F26)

- FR248: The installation wizard **already asks an Installation Scope question** (`bin/cli.js:1414-1437`) offering project level, global (user-level settings), and custom path; `--global` is its non-interactive equivalent. That question is retained as-is. What F26 changes is the **consequence** of choosing global: BMAD is no longer silently dropped (FR249), and the chosen scope is recorded so a later `ma-agents bind` (FR252) knows the install was global. **[AMENDED 2026-08-02 — originally written as though the interactive question did not exist and had to be built. Source verification showed it already ships; the requirement is narrowed to the behaviour change only, and Story 31.11 shrinks accordingly.]**
- FR249: When global scope is selected, BMAD modules and BMAD agents are installed globally alongside ma-agents skills — superseding the current behaviour where BMAD agents are filtered out of global installs and the user is told to re-run without `--global`. The set of BMAD modules installed globally is the same default set FR123 defines for project installs
- FR250: Global installation is **spike-gated**. Before FR249 is implemented, a confirmation spike establishes what bmad-method v6.10.0 actually supports for user-level installation — target directory, whether `--directory` accepts a user-scoped path, and how module resolution behaves outside a project. If the spike shows global BMAD install is unsupported upstream, FR249 degrades to installing ma-agents skills globally and the installer reports three things: that BMAD remains project-scoped, the command that installs BMAD into a project, and that the F26 knowledge-store requirements are unaffected. The remaining F26 requirements proceed unchanged
- FR251: A global install performs **no project-scoped work** — it does not generate `project-context.md`, does not write `project-layout.yaml`, and does not prompt for knowledge-store locations, because no project is in scope at that moment. These are deferred to the per-project bind step (FR252)
- FR252: A **project-bind step** (`ma-agents bind`, also offered automatically when a globally-installed skill activates in a project that has no `_bmad-output/project-layout.yaml`) collects only the project-scoped answers — the two knowledge-store bindings (FR254) and sprint management location — and writes `_bmad-output/project-layout.yaml` plus `project-context.md`. It installs no skills and no BMAD modules; its re-run behaviour is governed by NFR78
- FR253: `ma-agents status` reports the active install scope, and for a global install lists which projects on this machine have been bound, and for each whether a readable `project-layout.yaml` was found at its root

### BMAD Extension Architecture

- FR104: The BMAD extension module is restructured with a proper BMAD 6.2.0 `module.yaml` containing `code` (module identifier), `description`, and `module_version` fields — replacing the legacy `extends-module: bmm` pattern in the current `lib/bmad-extension/module.yaml`
- FR105: A module setup skill is created that writes module configuration to `config.yaml` (shared, git-committed), `config.user.yaml` (personal, gitignored), and `module-help.csv` (capability registry) — following the BMAD 6.2.0 anti-zombie pattern where re-running setup removes all existing entries for the module's code before writing new values
- FR106: The dual-layer agent definition pattern — base config in `lib/bmad-customizations/bmm-{agent}.customize.yaml` + extended config in `lib/bmad-extension/agents/bmm-{agent}.customize.yaml` — is consolidated into a single authoritative agent skill folder per agent under the module's `agents/` directory

## Quality Attributes (Non-Functional Requirements)

### Global Installation Scope (F26)

- NFR76: Choosing project-level scope must not change project-level install behaviour beyond what F26 itself introduces, and must add no additional prompts on subsequent runs. The comparison baseline is **post-FR263 behaviour**, not today's: a project install will now always write `_bmad-output/project-layout.yaml`, which today it does not write at all in single-repo mode and in fact deletes (`bin/cli.js:606-616`). Against that rebaselined output the install must be deterministic. **[AMENDED 2026-08-02 — the original 'byte-identical to today's' wording became unachievable the moment FR263 made project-layout.yaml unconditional; rebaselined rather than weakened.]**
- NFR77: Global installation must work fully air-gapped, on the same terms as project installation — bundled BMAD cache, no npm/git/CDN access at install time (re-asserts NFR2/NFR50/NFR57)
- NFR78: The project-bind step must be idempotent and non-destructive — re-running it against an already-bound project reports the existing bindings and changes nothing unless the user explicitly edits an answer, and it never overwrites an existing `project-context.md` (consistent with NFR23)

### BMAD Extension Compatibility

- NFR16: The BMAD extension module must survive `npx bmad-method install --action update` without losing functionality — extensions maintain independent identity and persist across BMAD updates
- NFR17: All BMAD-facing changes must use official BMAD Builder extension APIs only — `module.yaml` (module identity), `module-help.csv` (capability registration), setup skill (config management), Agent Builder (agent creation), Workflow Builder (workflow creation), skill folder standard (SKILL.md + prompts/ + resources/ + scripts/) — zero bmad-method core modifications
- NFR18: OpenCode JSON instruction injection must not corrupt existing `opencode.json` configuration — JSON config merging must be additive-only
- NFR19: Bug and sprint extension workflows must function identically whether invoked via BMAD agent menu or direct slash command. All sprint workflows must read/write the unified `sprint-status.yaml` file — no workflow may create or depend on separate `backlog.yaml` or per-sprint YAML files

### Bundled Installation

- NFR20: The bundled BMAD cache must be version-pinned (v6.3.0 current) — upgrading the bundled version is a deliberate, tested release operation, not an automatic fetch
- NFR21: The bundled installation produces deterministic `_bmad/` output from the included cache. The resulting directory structure is reproducible given the same ma-agents package version.
