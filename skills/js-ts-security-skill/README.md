# JS/TS Security Skill (OWASP 2025)

Comprehensive security verification for JavaScript and TypeScript codebases following **OWASP Top 10 2025** standards.

## Usage

```bash
# Verify security of the current project
./skills/js-ts-security-skill/scripts/verify-security.sh
```

## Features

- ✅ **Dependency Auditing**: Checks for known vulnerabilities in `node_modules`.
- ✅ **Static Analysis**: Detects dangerous code patterns (eval, unsafe regex, etc.).
- ✅ **Secret Scanning**: Finds hardcoded credentials and API keys.
- ✅ **OWASP Compliance**: Maps findings to OWASP Top 10 categories.
- ✅ **Actionable Reports**: Provides clear instructions on how to fix identified issues.

## Requirements

- Node.js and npm/yarn
- `eslint` (installed in the project or globally)
- `eslint-plugin-security` (recommended for better results)

## Configuration

You can customize the audit by adding a `.securityrc` or specifying excludes in the script, though the default settings are designed to be comprehensive.
