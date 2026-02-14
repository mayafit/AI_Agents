# Contributing to AI Agent Skills

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Ways to Contribute

1. **Add New Skills** - Create useful skills for AI agents
2. **Add Agent Support** - Add support for new AI coding agents
3. **Improve Documentation** - Enhance README and guides
4. **Fix Bugs** - Report and fix issues
5. **Suggest Features** - Propose new features

## Getting Started

### Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd ai-agent-skills

# Install dependencies
npm install

# Test the CLI
node bin/cli.js
```

## Adding a New Skill

1. Create a directory in `skills/` with your skill name (kebab-case)
2. Add `skill.json` with metadata
3. Create at least `generic.md` template
4. Optionally create agent-specific templates
5. Test your skill with multiple agents

See [README.md](README.md#how-to-add-a-new-skill) for detailed instructions.

## Adding a New Agent

1. Edit `lib/agents.js`
2. Add your agent configuration to the `agents` array
3. Test installation with existing skills

See [README.md](README.md#how-to-add-a-new-agent) for detailed instructions.

## Code Style

- Use 2 spaces for indentation
- Follow existing code structure
- Add comments for complex logic
- Keep functions focused and small

## Testing

Before submitting:

1. Test the CLI works: `node bin/cli.js`
2. Test skill installation for multiple agents
3. Verify all paths work on your OS
4. Check that new skills appear in the list

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit with clear messages: `git commit -m "feat: add new skill"`
5. Push to your fork: `git push origin feature/my-feature`
6. Open a Pull Request

## Pull Request Guidelines

- Provide clear description of changes
- Reference any related issues
- Include testing steps
- Update documentation if needed

## Skill Quality Guidelines

When contributing skills:

- **Clear Instructions**: Provide step-by-step guidance for the AI
- **Good Examples**: Include example interactions
- **Appropriate Scope**: Skill should have a focused purpose
- **Well-Documented**: Include usage instructions
- **Tested**: Verify it works with at least one agent

## Questions?

Feel free to open an issue for:
- Questions about contributing
- Clarification on guidelines
- Feature discussions

Thank you for contributing!
