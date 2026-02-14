# Quick Start Guide

Get started with AI Agent Skills in 2 minutes!

## Installation (Users)

No installation needed! Just run:

```bash
npx ai-agent-skills
```

## Using the CLI

1. **Run the tool:**
   ```bash
   npx ai-agent-skills
   ```

2. **Select "Install a skill"**

3. **Choose a skill:**
   - Code Review
   - Test Generator
   - Commit Message Generator

4. **Select your AI agents:**
   - Claude Code
   - Gemini
   - Copilot
   - Kilocode
   - Cline
   - Cursor

5. **Choose installation path:**
   - Press Enter for default path
   - Or type a custom path

6. **Done!** The skill is now available in your selected agents.

## Quick Examples

### List all available skills
```bash
npx ai-agent-skills
# Select: List available skills
```

### List supported agents
```bash
npx ai-agent-skills
# Select: List supported agents
```

### Install a skill
```bash
npx ai-agent-skills
# Select: Install a skill
# Choose: code-review
# Select agents: claude-code, cline
# Path: (press Enter for default)
```

## Using Installed Skills

After installation, use the skills in your AI agent:

**Claude Code:**
```bash
claude-code
> /code-review
```

**Other Agents:**
Check your agent's documentation for how to invoke custom skills or prompts.

## Development Quick Start

Want to add your own skills or agents?

### Add a Skill (5 minutes)

1. Create directory:
   ```bash
   mkdir skills/my-skill
   ```

2. Create `skill.json`:
   ```json
   {
     "name": "My Skill",
     "description": "What it does",
     "version": "1.0.0",
     "author": "You",
     "tags": ["tag1"]
   }
   ```

3. Create `generic.md`:
   ```markdown
   # My Skill

   Instructions for the AI agent...
   ```

4. Test it:
   ```bash
   node bin/cli.js
   ```

### Add an Agent (3 minutes)

1. Edit `lib/agents.js`

2. Add to `agents` array:
   ```javascript
   {
     id: 'my-agent',
     name: 'My Agent',
     description: 'My AI Agent',
     getSkillsPath: () => {
       // Return path based on OS
     },
     fileExtension: '.md',
     template: 'generic'
   }
   ```

3. Test it:
   ```bash
   node bin/cli.js
   ```

## Need Help?

- Read the full [README.md](README.md)
- Check [CONTRIBUTING.md](CONTRIBUTING.md)
- See [examples/](examples/) for code examples
- Open an issue on GitHub

## What's Next?

- Browse existing skills in `skills/`
- Read detailed guides in [README.md](README.md)
- Contribute your own skills!
- Add support for your favorite AI agent

Happy coding with AI agents! 🤖
