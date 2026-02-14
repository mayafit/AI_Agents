# AI Agent Skills

A universal NPX tool to install skills for AI coding agents including Claude Code, Gemini, Copilot, Kilocode, Cline, and Cursor.

## Features

- 🤖 Support for multiple AI coding agents
- 📦 Easy skill installation via NPX
- 🔧 Extensible architecture for adding new agents
- 📝 Simple skill creation system
- 🎯 Interactive CLI for user-friendly installation

## Supported Agents

- **Claude Code** - Anthropic's Claude Code CLI
- **Google Gemini** - Google Gemini Code Assist
- **GitHub Copilot** - GitHub Copilot Agent Mode
- **Kilocode** - Kilocode AI Assistant
- **Cline** - Cline AI Assistant (VSCode Extension)
- **Cursor** - Cursor AI Editor

## Installation

No installation required! Use directly with NPX:

```bash
npx ai-agent-skills
```

## Usage

### Interactive Mode

Simply run the command and follow the prompts:

```bash
npx ai-agent-skills
```

You'll be able to:
1. Choose an action (install skill, list skills, list agents)
2. Select a skill to install
3. Choose which agents to install for
4. Specify a custom installation path (optional)

### Available Skills

The package comes with example skills:

- **Code Review** - Comprehensive code review following best practices
- **Test Generator** - Generate unit and integration tests
- **Commit Message Generator** - Create conventional commit messages

## Project Structure

```
ai-agent-skills/
├── bin/
│   └── cli.js              # CLI entry point
├── lib/
│   ├── agents.js           # Agent configurations
│   └── installer.js        # Installation logic
├── skills/
│   ├── code-review/
│   │   ├── skill.json      # Skill metadata
│   │   ├── claude-code.md  # Claude Code template
│   │   ├── generic.md      # Generic template
│   │   └── cline.md        # Cline-specific template
│   ├── test-generator/
│   │   ├── skill.json
│   │   └── ...
│   └── commit-message/
│       ├── skill.json
│       └── generic.md
├── package.json
└── README.md
```

## How to Add a New Skill

Adding a new skill is straightforward. Follow these steps:

### 1. Create Skill Directory

Create a new directory under `skills/` with your skill name (use kebab-case):

```bash
mkdir skills/my-awesome-skill
```

### 2. Create Skill Metadata

Create a `skill.json` file in your skill directory:

```json
{
  "name": "My Awesome Skill",
  "description": "Brief description of what this skill does",
  "version": "1.0.0",
  "author": "Your Name",
  "tags": ["tag1", "tag2", "tag3"]
}
```

**Fields:**
- `name`: Display name for the skill
- `description`: Short description (shown in skill list)
- `version`: Semantic version number
- `author`: Your name or organization
- `tags`: Array of tags for categorization

### 3. Create Skill Templates

Create at least one template file. You can create:

#### Generic Template (recommended)
`generic.md` - Works for all agents

```markdown
# My Awesome Skill

Brief description of the skill.

## Instructions

Step-by-step instructions for the AI agent...

## Examples

Example interactions...
```

#### Agent-Specific Templates (optional)
Create specialized templates for specific agents:

- `claude-code.md` - Claude Code specific
- `cline.md` - Cline specific
- `generic.md` - Fallback for all other agents

**Template Naming Convention:**
- Use the agent's `template` field from [lib/agents.js](lib/agents.js)
- Add the agent's `fileExtension` (usually `.md`)

### 4. Template Content Guidelines

Your skill template should include:

```markdown
# Skill Name

## Description
Clear explanation of what the skill does

## Usage
How to invoke or use this skill

## Instructions
Detailed instructions for the AI agent:
1. Step 1
2. Step 2
3. ...

## Examples
Example interactions showing:
- User input
- Expected AI behavior

## Output Format (if applicable)
Template or structure for the AI's output
```

### 5. Test Your Skill

After creating your skill, test it:

```bash
npx ai-agent-skills
# Select "List available skills" to verify it appears
# Then install it to test
```

### Example: Creating a "Documentation Generator" Skill

```bash
# 1. Create directory
mkdir skills/doc-generator

# 2. Create skill.json
cat > skills/doc-generator/skill.json << 'EOF'
{
  "name": "Documentation Generator",
  "description": "Generate comprehensive documentation for code",
  "version": "1.0.0",
  "author": "AI Agent Skills",
  "tags": ["documentation", "docs", "jsdoc"]
}
EOF

# 3. Create template
cat > skills/doc-generator/generic.md << 'EOF'
# Documentation Generator

Generate comprehensive documentation for code including API docs, JSDoc, docstrings, etc.

## Instructions

1. Analyze the code structure
2. Identify public APIs, functions, classes
3. Generate documentation following the language's convention:
   - JavaScript/TypeScript: JSDoc
   - Python: Docstrings (Google/NumPy style)
   - Java: JavaDoc
   - C#: XML documentation
4. Include parameters, return types, examples
5. Add usage examples where helpful

## Output Format

Include:
- Function/method description
- Parameters with types
- Return value with type
- Examples (if complex)
- Exceptions/errors thrown

## Example

```javascript
/**
 * Calculates the sum of two numbers
 * @param {number} a - The first number
 * @param {number} b - The second number
 * @returns {number} The sum of a and b
 * @example
 * add(2, 3) // returns 5
 */
function add(a, b) {
  return a + b;
}
```
EOF
```

## How to Add a New Agent

Adding support for a new AI agent is simple. Follow these steps:

### 1. Open Agent Configuration

Edit [lib/agents.js](lib/agents.js)

### 2. Add Agent Object

Add a new agent object to the `agents` array:

```javascript
{
  id: 'my-agent',
  name: 'My Agent',
  description: 'Brief description of the agent',
  getSkillsPath: () => {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'MyAgent', 'skills');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'MyAgent', 'skills');
    } else {
      return path.join(os.homedir(), '.config', 'my-agent', 'skills');
    }
  },
  fileExtension: '.md',
  template: 'my-agent'
}
```

### 3. Agent Configuration Fields

**Required Fields:**

- `id` (string): Unique identifier (kebab-case)
  - Used internally and in CLI selection
  - Example: `'claude-code'`, `'my-agent'`

- `name` (string): Display name
  - Shown to users in the interactive menu
  - Example: `'Claude Code'`, `'My Agent'`

- `description` (string): Brief description
  - Helps users identify the agent
  - Example: `'Anthropic Claude Code CLI'`

- `getSkillsPath` (function): Returns the default skills directory path
  - Must handle Windows, macOS, and Linux
  - Returns absolute path to where skills should be installed
  - Platform-specific paths:
    - **Windows**: `AppData/Roaming/[Agent]/skills`
    - **macOS**: `Library/Application Support/[Agent]/skills`
    - **Linux**: `.config/[agent]/skills`

- `fileExtension` (string): File extension for skill files
  - Usually `'.md'` for markdown
  - Could be `'.txt'`, `'.json'`, etc. depending on agent

- `template` (string): Template identifier
  - Used to find agent-specific skill templates
  - Should match template filename (e.g., `'my-agent'` → `my-agent.md`)
  - Falls back to `'generic'` if template doesn't exist

### 4. Finding the Skills Directory

To find where your agent stores skills:

1. **Check agent documentation** - Look for skills, plugins, or extensions directory
2. **Check agent config** - Look in the agent's settings/configuration file
3. **Common locations:**
   - Windows: `%APPDATA%` or `%LOCALAPPDATA%`
   - macOS: `~/Library/Application Support/`
   - Linux: `~/.config/` or `~/.local/share/`

### 5. Test Your Agent

After adding the agent configuration:

```bash
npx ai-agent-skills
# Select "List supported agents"
# Verify your agent appears
# Try installing a skill to your new agent
```

### Example: Adding "Windsurf" Agent

```javascript
{
  id: 'windsurf',
  name: 'Windsurf',
  description: 'Windsurf AI Code Editor',
  getSkillsPath: () => {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Windsurf', 'skills');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Windsurf', 'skills');
    } else {
      return path.join(os.homedir(), '.config', 'windsurf', 'skills');
    }
  },
  fileExtension: '.md',
  template: 'generic'  // Use generic template
}
```

## Advanced: Agent-Specific Templates

If your agent has unique requirements, create agent-specific templates:

1. Set `template: 'my-agent'` in agent configuration
2. Create `my-agent.md` files in skill directories
3. The installer will use agent-specific templates when available
4. Falls back to `generic.md` if agent-specific template doesn't exist

**Example:** Claude Code might need specific formatting:

```
skills/code-review/
├── skill.json
├── claude-code.md    # Claude-specific format
├── cline.md          # Cline-specific format
└── generic.md        # Works for all others
```

## Development

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-agent-skills

# Install dependencies
npm install

# Test locally
node bin/cli.js
```

### Publishing

To publish to NPM:

```bash
# Login to NPM
npm login

# Publish
npm publish
```

After publishing, users can run:
```bash
npx ai-agent-skills
```

## Contributing

Contributions are welcome! Please feel free to submit:

- New skills
- Support for additional agents
- Bug fixes
- Documentation improvements

## License

MIT

## Support

For issues or questions, please open an issue on the GitHub repository.
