---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
---

# Skill Creator

## Description
Guide for creating effective skills that extend Claude's capabilities with specialized knowledge, workflows, and tool integrations.

## Usage
Invoke this skill when creating or updating a skill package.

## Instructions

### Skill Creation Process

Follow these steps in order:

1. **Understand** the skill with concrete examples
2. **Plan** reusable skill contents (scripts, references, assets)
3. **Initialize** the skill (run `scripts/init_skill.py <name> --path <dir>`)
4. **Edit** the skill (implement resources, write SKILL.md)
5. **Package** the skill (run `scripts/package_skill.py <path>`)
6. **Iterate** based on real usage

### Core Principles

- **Concise is key**: Claude is already smart — only add context it doesn't have. Challenge each piece of information: "Does Claude really need this?"
- **Appropriate freedom**: Match specificity to task fragility. High freedom for flexible tasks, low freedom for fragile operations.
- **Progressive disclosure**: Keep SKILL.md under 500 lines. Use references/ for detailed content.

### Skill Structure

```
skill-name/
├── SKILL.md (required — YAML frontmatter + markdown body)
├── scripts/          (executable code, Python/Bash)
├── references/       (documentation loaded into context as needed)
└── assets/           (files used in output: templates, images, fonts)
```

### SKILL.md Frontmatter

Only `name` and `description` are required. Description is the primary trigger mechanism — include both what the skill does AND when to use it.

### Bundled Resources

- **scripts/**: For code that's rewritten repeatedly or needs deterministic reliability
- **references/**: For documentation Claude should reference while working (schemas, APIs, policies)
- **assets/**: For files used in output but not loaded into context (templates, images, fonts)

### What NOT to Include

Do NOT create README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md, or other auxiliary docs. Only include what an AI agent needs to execute tasks.

### Design Patterns

- **Multi-step processes**: See [references/workflows.md](references/workflows.md)
- **Output formats**: See [references/output-patterns.md](references/output-patterns.md)

### Tools

- **Initialize**: `scripts/init_skill.py <skill-name> --path <output-dir>`
- **Validate**: `scripts/quick_validate.py <skill-dir>`
- **Package**: `scripts/package_skill.py <skill-dir> [output-dir]`
