# Edge Case Hunter Review: Epic 16 — Multi-Repository Project Layout

**Scope:** Stories 16.1, 16.2, 16.3, 16.4
**Date:** 2026-03-28
**Method:** Exhaustive path enumeration across all branching paths and boundary conditions

## Findings

```json
[
  {
    "location": "16.1:AC#3/Task3.1",
    "trigger_condition": "User enters empty string or whitespace-only git URL",
    "guard_snippet": "if (!gitUrl || !gitUrl.trim()) { console.log(chalk.red('Git URL cannot be empty')); /* re-prompt */ }",
    "potential_consequence": "execSync runs git clone with empty quoted arg, cryptic git error"
  },
  {
    "location": "16.1:AC#3/Task3.2",
    "trigger_condition": "User enters empty string or whitespace-only destination path",
    "guard_snippet": "if (!destPath || !destPath.trim()) { console.log(chalk.red('Destination path cannot be empty')); /* re-prompt */ }",
    "potential_consequence": "git clone writes into current directory unexpectedly"
  },
  {
    "location": "16.1:AC#3/Task3.4",
    "trigger_condition": "Git URL contains shell metacharacters like $() or backticks",
    "guard_snippet": "Use execFileSync('git', ['clone', gitUrl, destPath]) instead of execSync with string interpolation",
    "potential_consequence": "Arbitrary command injection via crafted git URL string"
  },
  {
    "location": "16.1:AC#5/Task2.2",
    "trigger_condition": "User provides relative path like '../kb' from different CWDs",
    "guard_snippet": "const resolved = path.resolve(process.cwd(), localPath); // resolve relative to install CWD, store absolute",
    "potential_consequence": "Stored relative path resolves differently when agents run later"
  },
  {
    "location": "16.1:AC#5/Task2.4",
    "trigger_condition": "User confirms non-existent local path without correction",
    "guard_snippet": "If user confirms non-existent path, log warning that path will need to exist before agents run",
    "potential_consequence": "Config stores path that does not exist; agents fail at runtime"
  },
  {
    "location": "16.1:AC#3/Task3.3",
    "trigger_condition": "Destination exists but is a file, not a directory",
    "guard_snippet": "if (fs.existsSync(destPath) && !fs.statSync(destPath).isDirectory()) { /* warn and re-prompt */ }",
    "potential_consequence": "Summary display crashes or git clone fails overwriting a file"
  },
  {
    "location": "16.1:AC#3/Task3.7",
    "trigger_condition": "Clone fails and user selects 'skip'; no fallback path stored",
    "guard_snippet": "If skip chosen after clone failure, set mode to 'same' or require valid local path before proceeding",
    "potential_consequence": "Layout object has remote mode but no cloned repo; downstream steps fail"
  },
  {
    "location": "16.1:AC#3/Task3.4",
    "trigger_condition": "Git is not installed or not on PATH",
    "guard_snippet": "try { execSync('git --version') } catch { chalk.red('git not found on PATH'); process.exit(1) }",
    "potential_consequence": "Unhelpful ENOENT error from execSync instead of clear message"
  },
  {
    "location": "16.1:AC#7/Task1.6",
    "trigger_condition": "User passes --yes with env vars for custom repo paths",
    "guard_snippet": "Document or support env vars (MA_KB_PATH, MA_SPRINT_PATH) that override defaults in --yes mode",
    "potential_consequence": "CI/CD pipelines cannot configure multi-repo without interactive prompts"
  },
  {
    "location": "16.1:AC#3/Task3.5",
    "trigger_condition": "Clone hangs due to SSH key prompt or large repo on slow network",
    "guard_snippet": "execSync('git clone ...', { timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })",
    "potential_consequence": "Installer hangs indefinitely waiting for git credential or transfer"
  },
  {
    "location": "16.2:AC#1/Task1.5",
    "trigger_condition": "config.yaml has no trailing newline or unusual YAML formatting",
    "guard_snippet": "Ensure content ends with newline before appending; use regex anchored to line start for find/replace",
    "potential_consequence": "Appended fields merge into last line, producing invalid YAML"
  },
  {
    "location": "16.2:AC#1/Task1.6",
    "trigger_condition": "config.yaml contains duplicate knowledgebase_path keys after multiple installs",
    "guard_snippet": "Regex replace existing key if found: content.replace(/^knowledgebase_path:.*$/m, newLine) || append",
    "potential_consequence": "YAML has duplicate keys; parsers may use first or last unpredictably"
  },
  {
    "location": "16.2:AC#1/Task1.4",
    "trigger_condition": "Absolute path contains YAML-special characters like colons (C:\\path or C:/path)",
    "guard_snippet": "Quote path values in YAML: knowledgebase_path: \"C:/Code/kb-repo\"",
    "potential_consequence": "Unquoted colon in Windows path produces invalid YAML"
  },
  {
    "location": "16.2:AC#2/Task2.4",
    "trigger_condition": "Path contains characters needing YAML escaping (#, %, {, })",
    "guard_snippet": "Always wrap path values in double quotes in project-layout.yaml template strings",
    "potential_consequence": "YAML comment or anchor syntax triggered by special chars in path"
  },
  {
    "location": "16.2:AC#4/Task2.4",
    "trigger_condition": "Path separator normalization differs between runs on same OS",
    "guard_snippet": "Always normalize with .replace(/\\\\/g, '/') before writing, even on Unix (idempotency)",
    "potential_consequence": "Determinism check fails; file diff shows path separator changes"
  },
  {
    "location": "16.2:AC#1/Task1.2",
    "trigger_condition": "config.yaml does not exist yet (first install before bmad-method completes)",
    "guard_snippet": "if (!fs.existsSync(configPath)) { fs.mkdirSync(path.dirname(configPath), {recursive:true}); fs.writeFileSync(configPath, '') }",
    "potential_consequence": "Read of non-existent file throws ENOENT, installer crashes"
  },
  {
    "location": "16.2:AC#3/Task3.2",
    "trigger_condition": "Previous multi-repo project-layout.yaml is stale but not deleted on mode change",
    "guard_snippet": "Log warning: 'Existing project-layout.yaml found but current config is single-repo — file may be stale'",
    "potential_consequence": "Agents read stale project-layout.yaml and use wrong paths silently"
  },
  {
    "location": "16.3:AC#3/Task4.3",
    "trigger_condition": "project-context.md exists AND single-repo mode configured",
    "guard_snippet": "Only log 'add Repository Layout manually' message when multi-repo is configured AND file exists",
    "potential_consequence": "Confusing log message shown to single-repo users who need no action"
  },
  {
    "location": "16.3:AC#2/Task3.4",
    "trigger_condition": "Template placeholder replaced with empty string leaves double blank lines",
    "guard_snippet": "Replace '{{REPO_LAYOUT_SECTION}}\\n\\n' (placeholder plus surrounding blank lines) as a unit",
    "potential_consequence": "Generated project-context.md has extra blank lines in single-repo mode"
  },
  {
    "location": "16.3:AC#1/Task2.4",
    "trigger_condition": "Mixed config: knowledgebase is external but sprint is same-repo",
    "guard_snippet": "Section generator should list each concern independently, showing '.' or 'current repository' for same-mode items",
    "potential_consequence": "Section omits same-repo concern or shows incomplete path info to agents"
  },
  {
    "location": "16.3:AC#1/Task2.2",
    "trigger_condition": "Layout config object is undefined or missing fields when generator is called",
    "guard_snippet": "if (!layout?.knowledgebase || !layout?.sprintManagement) { return ''; }",
    "potential_consequence": "TypeError accessing .mode on undefined; installer crash during generation"
  },
  {
    "location": "16.4:AC#1/Task1.3",
    "trigger_condition": "BMAD workflows use hardcoded _bmad-output/ instead of config-driven path",
    "guard_snippet": "Audit must check for literal '_bmad-output/' strings in workflow files; document each as requiring change",
    "potential_consequence": "Multi-repo config is stored but never used; artifacts always go to code repo"
  },
  {
    "location": "16.4:AC#4/Task3.1",
    "trigger_condition": "Both project-layout.yaml and config.yaml exist with conflicting paths",
    "guard_snippet": "Define precedence: config.yaml is source of truth; project-layout.yaml is informational. Document this.",
    "potential_consequence": "Agents read different files and resolve to different paths non-deterministically"
  },
  {
    "location": "16.4:AC#1/Task2.2",
    "trigger_condition": "Knowledgebase path points to repo that lacks _bmad-output/planning-artifacts/",
    "guard_snippet": "Workflows should check if target directory exists before read/write; create or error clearly",
    "potential_consequence": "Agent crashes or silently creates artifacts in wrong location"
  },
  {
    "location": "16.1:AC#5/Task2.2",
    "trigger_condition": "Path exists but is a file, not a directory",
    "guard_snippet": "if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) { chalk.yellow('Path exists but is not a directory') }",
    "potential_consequence": "Validation passes but subsequent file operations in that 'directory' fail"
  },
  {
    "location": "16.2:AC#2/Task2.5",
    "trigger_condition": "_bmad-output/ directory does not exist in fresh code repo",
    "guard_snippet": "fs.mkdirSync('_bmad-output', { recursive: true }) before writing project-layout.yaml",
    "potential_consequence": "ENOENT error writing project-layout.yaml in brand-new repository"
  },
  {
    "location": "16.1:AC#3/Task3.3",
    "trigger_condition": "Destination directory exists but is empty (not a git repo)",
    "guard_snippet": "Distinguish empty dir from populated dir/git repo in summary; offer to clone into it vs. use as-is",
    "potential_consequence": "User confirms empty directory; agents later find no artifacts and fail"
  },
  {
    "location": "16.2:AC#1/Task1.5",
    "trigger_condition": "config.yaml is read-only or locked by another process",
    "guard_snippet": "try { fs.writeFileSync(configPath, content) } catch(e) { chalk.red('Cannot write config.yaml: ' + e.message) }",
    "potential_consequence": "Unhandled EACCES or EPERM crashes installer with stack trace"
  },
  {
    "location": "16.1:AC#4/Task3.4",
    "trigger_condition": "Destination path is inside the current repository (e.g., ./external/kb)",
    "guard_snippet": "Warn if destPath resolves to a subdirectory of process.cwd(); nested repos cause git confusion",
    "potential_consequence": "Nested git repo causes submodule-like issues; commits mix repos"
  },
  {
    "location": "16.3:AC#4/Task1.2",
    "trigger_condition": "Template file does not contain {{REPO_LAYOUT_SECTION}} after manual edit",
    "guard_snippet": "if (!template.includes('{{REPO_LAYOUT_SECTION}}')) { log warning; append section at end if multi-repo }",
    "potential_consequence": "Multi-repo section silently dropped; agents have no path information"
  },
  {
    "location": "16.4:AC#4/Task3.3",
    "trigger_condition": "Knowledgebase repo path is valid but user has no read permission",
    "guard_snippet": "Validation should test fs.accessSync(kbPath, fs.constants.R_OK) and report permission error",
    "potential_consequence": "Agent discovers path but cannot read PRD; opaque permission denied error"
  },
  {
    "location": "16.2:AC#2/Task2.3",
    "trigger_condition": "Mode is 'local' but original source was cloned; no gitUrl stored",
    "guard_snippet": "Only check mode === 'remote' for gitUrl inclusion; 'local' mode must never have gitUrl even if path is a git repo",
    "potential_consequence": "Missing gitUrl for local-mode git repos may confuse future pull/sync features"
  },
  {
    "location": "16.1:AC#1/Task1.4",
    "trigger_condition": "User selects different modes for KB and sprint pointing to same external path",
    "guard_snippet": "if (kb.path === sprint.path && kb.path !== '.') { log info: 'Both concerns point to same external repo' }",
    "potential_consequence": "No issue per se but user may not realize both share one repo; worth confirming"
  },
  {
    "location": "16.2:AC#4/Task4.4",
    "trigger_condition": "Second install changes mode from remote to local for same concern",
    "guard_snippet": "When overwriting config.yaml paths, also check if project-layout.yaml needs regeneration with new mode",
    "potential_consequence": "config.yaml updated but project-layout.yaml still shows old remote mode and gitUrl"
  },
  {
    "location": "16.1:AC#3/Task3.4",
    "trigger_condition": "Disk is full during git clone; partial clone left on filesystem",
    "guard_snippet": "In catch block after clone failure: if destPath was created by clone, rimraf/remove it before retry prompt",
    "potential_consequence": "Partial clone directory passes exists-check on retry; corrupt repo used"
  },
  {
    "location": "16.3:AC#1/Task2.2",
    "trigger_condition": "Configured path contains backslashes that break markdown rendering",
    "guard_snippet": "Normalize all paths with .replace(/\\\\/g, '/') before injecting into markdown section",
    "potential_consequence": "Markdown renders backslashes as escape chars; agents see mangled paths"
  }
]
```

**Total findings: 35**
