# General Quality Attributes (system-wide NFRs)

> **Shard** of the [PRD index](../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> The four cross-cutting quality attributes that constrain every capability.
> Capability-scoped NFRs live with their capability, not here.

---

### Security & Data Protection

- NFR1: Skills must not transmit project data externally — all content is static instruction delivery, not data collection
- NFR2: Installation process must function fully offline for air-gapped environments (the opt-in custom marketplace source per NFR71 is the sole exception — it is off by default and explicitly outside the sealed-bundle guarantee)
- NFR3: Skill content must be inspectable (plain text markdown/JSON) — no obfuscated or compiled instructions
- NFR4: BMAD customizations must not be overwritten by updates without explicit user action

### Integration Reliability

- NFR5: Skill installation must not corrupt or remove existing agent configurations — additive-only operations
- NFR6: Agent format translation must produce valid configuration for each target agent's expected format
- NFR7: Manifest operations (read/write/update) must be atomic — no partial manifest states on failure
- NFR8: BMAD install/update/customize pipeline must execute steps in strict order with rollback on failure

### Portability & Compatibility

- NFR9: CLI must produce identical results on Windows, macOS, and Linux for the same inputs
- NFR10: Skills authored once must install without modification across all supported agents
- NFR11: Adding a new agent target must not require changes to existing skills — only a new template mapping
- NFR12: The tool must function with Node.js LTS versions (current and previous)

### Maintainability

- NFR13: Adding a new agent to the registry must require only a configuration entry, not code changes to the installer core
- NFR14: Adding a new skill must require only the skill package files (skill.json + SKILL.md + templates), not installer modifications
- NFR15: Skill format must remain backward-compatible — older skills must install correctly with newer tool versions
