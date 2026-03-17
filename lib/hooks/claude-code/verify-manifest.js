#!/usr/bin/env node

/**
 * Claude Code SessionStart Hook — MANIFEST.yaml Skill Enforcement
 *
 * Injects a context reminder at session startup to reinforce skill loading
 * from the project's MANIFEST.yaml. Runs as a standalone Node.js script
 * with no external dependencies.
 *
 * Hook event: SessionStart (matcher: "startup")
 * Exit 0 + stdout text → injected into Claude's session context
 *
 * Installed by: ma-agents installer (lib/installer.js)
 * Removed by: ma-agents uninstaller when all skills are removed
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Read hook input from stdin (JSON)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const projectDir = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

    // Look for skills MANIFEST.yaml in the project
    const manifestPath = path.join(projectDir, '.claude', 'skills', 'MANIFEST.yaml');

    if (!fs.existsSync(manifestPath)) {
      // No manifest — this project doesn't use ma-agents skills. Exit silently.
      process.exit(0);
    }

    // MANIFEST exists — inject context reminder into session
    const reminder = [
      'SKILL ENFORCEMENT ACTIVE: This project uses ma-agents skills.',
      `Read the skill manifest at ${manifestPath} before starting any task.`,
      'Load all skills marked always_load: true, then select relevant skills for the current task.',
    ].join(' ');

    process.stdout.write(reminder);
    process.exit(0);
  } catch (err) {
    // On any error, allow session to proceed (don't block startup)
    process.stderr.write(`verify-manifest hook warning: ${err.message}\n`);
    process.exit(0);
  }
});

// Handle stdin close without data (defensive)
process.stdin.on('error', () => { process.exit(0); });
