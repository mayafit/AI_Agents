# Development Skills

This directory contains reusable skills for development workflows.

## Available Skills

### 1. Git Workflow Skill
**Directory:** `git-workflow-skill/`

Mandatory feature branch workflow for Git operations. Enforces branch creation from dev, conventional commits, automatic PR creation, and returns to dev branch after push.

**Usage:**
```bash
# Start a new feature
./git-workflow-skill/scripts/start-feature.sh feature my-feature-name

# Finish, push, create PR, and return to dev (all automatic)
./git-workflow-skill/scripts/finish-feature.sh

# Validate workflow
./git-workflow-skill/scripts/validate-workflow.sh
```

**Key Features:**
- ✅ Enforces feature branch workflow
- ✅ Prevents commits to dev/main
- ✅ Conventional commit validation
- ✅ **Automatic PR creation** (via `gh` CLI)
- ✅ **Auto-switch to dev** after push
- ✅ Git hooks for automation

**Requirements:**
- Git
- GitHub CLI (`gh`) - For automatic PR creation (optional but recommended)

---

### 2. Verify Hardened Docker Skill
**Directory:** `verify-hardened-docker-skill/`

Comprehensive security verification for Docker configurations against CIS Docker Benchmark, OWASP, and NIST SP 800-190 standards.

**Usage:**
```bash
# Verify all Docker security configurations
./verify-hardened-docker-skill/scripts/verify-docker-hardening.sh [image-name]
```

**What It Checks:**
- ✅ Image security (version tags, non-root user, no secrets)
- ✅ Dockerfile hardening (multi-stage, permissions)
- ✅ docker-compose.yml security (read-only, capabilities)
- ✅ Runtime security (non-root execution, health checks)
- ✅ Vulnerability scanning (Trivy integration)
- ✅ Secret leakage detection

**Exit Codes:**
- `0` - All checks passed
- `1` - CRITICAL vulnerabilities
- `2` - Hardening failures
- `3` - Secret leakage
- `4` - Runtime violations
- `5` - Missing files

---

### 4. JS/TS Security Skill
**Directory:** `js-ts-security-skill/`

Comprehensive security verification for JavaScript and TypeScript codebases following OWASP Top 10 standards. Detects dangerous patterns, hardcoded secrets, and vulnerable dependencies.

**Usage:**
```bash
# Verify security of the current project
./js-ts-security-skill/scripts/verify-security.sh
```

**Key Features:**
- ✅ **Dependency Auditing**: Checks for known vulnerabilities in `node_modules`.
- ✅ **Static Analysis**: Detects dangerous code patterns (eval, unsafe regex, etc.).
- ✅ **Secret Scanning**: Finds hardcoded credentials and API keys.
- ✅ **OWASP Compliance**: Maps findings to OWASP Top 10 categories.

---

### 3. Create Hardened Docker Skill
**Directory:** `create-hardened-docker-skill/`

Creates production-ready hardened Docker configurations following security best practices.

**Usage:**
```bash
# Create all hardened Docker files
./create-hardened-docker-skill/scripts/create-all.sh [app-name] [node-version] [nginx-version]
```

**What It Creates:**
- ✅ **Dockerfile** - Multi-stage, non-root, Alpine-based
- ✅ **docker-compose.yml** - Read-only filesystem, capability controls
- ✅ **nginx.conf** - Security headers, TLS 1.2+, gzip compression
- ✅ **.dockerignore** - Optimized build context
- ✅ **.env.example** - Environment variable template

**Security Features:**
- ✅ Non-root user execution (nginx)
- ✅ Read-only root filesystem
- ✅ Tmpfs mounts for writable directories
- ✅ All capabilities dropped (minimal additions)
- ✅ No privilege escalation
- ✅ Resource limits (512MB memory, 1.0 CPU)
- ✅ TLS 1.2+ only with strong ciphers
- ✅ Security headers (CSP, HSTS, X-Frame-Options)

**Compliance:**
- ✅ CIS Docker Benchmark v1.6.0
- ✅ OWASP Docker Security Cheat Sheet
- ✅ NIST Application Container Security Guide (SP 800-190)

---

## Recommended Workflow

### For New Docker Projects

1. **Create hardened configuration:**
   ```bash
   ./create-hardened-docker-skill/scripts/create-all.sh my-app
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Build and test:**
   ```bash
   docker build -t my-app .
   docker-compose up -d
   ```

4. **Verify security:**
   ```bash
   ./verify-hardened-docker-skill/scripts/verify-docker-hardening.sh my-app
   ```

5. **Fix any issues found and re-verify**

### For Existing Docker Projects

1. **Verify current configuration:**
   ```bash
   ./verify-hardened-docker-skill/scripts/verify-docker-hardening.sh my-app
   ```

2. **Review failed checks and warnings**

3. **Apply hardening fixes manually or regenerate:**
   ```bash
   ./create-hardened-docker-skill/scripts/create-all.sh my-app
   ```

4. **Re-verify after changes:**
   ```bash
   ./verify-hardened-docker-skill/scripts/verify-docker-hardening.sh my-app
   ```

### For Feature Development

1. **Start feature branch:**
   ```bash
   ./git-workflow-skill/scripts/start-feature.sh feature docker-hardening
   ```

2. **Make changes (e.g., update Dockerfile)**

3. **Verify hardening before commit:**
   ```bash
   ./verify-hardened-docker-skill/scripts/verify-docker-hardening.sh my-app
   ```

4. **Commit, push, and create PR:**
   ```bash
   ./git-workflow-skill/scripts/finish-feature.sh
   # This will:
   # - Rebase on dev
   # - Push the branch
   # - Create PR automatically
   # - Switch back to dev branch
   ```

---

### 5. Test-Accompanied Development (TAD)
**Directory:** `test-accompanied-development/`

Enforces a "Test-Alongside" policy where every public method is accompanied by a corresponding unit test. It ensures high code quality by mandating that all public interfaces are verified by automated tests at the moment of creation.

**Key Features:**
- ✅ **Automatic Enforcement**: Mandates tests for every new public method.
- ✅ **Integration**: References `test-generator` for implementation standards.
- ✅ **Workflow Guardrail**: Prevents "test debt" by requiring tests alongside code.

---

### 6. Logging Best Practices
**Directory:** `logging-best-practices/`

Standardizes structured logging (JSON) across Backend, Frontend, Realtime, and Algorithmic domains. Enforces mandatory exception logging and OpenTelemetry-aligned context fields.

**Key Features:**
- ✅ **Structured Logging**: Mandates JSON format for machine-readability.
- ✅ **Domain-Specific**: Tailored guidance for Web, Server, and High-Performance Algorithm domains.
- ✅ **Mandatory Exceptions**: Every catch block must log full stack traces.
- ✅ **Context-Rich**: Standardizes fields like `trace_id`, `placement`, and `process_name`.

---

## Requirements

### All Skills
- Bash shell
- Git

### Git Workflow Skill
- Git
- GitHub CLI (`gh`) - For automatic PR creation (optional but recommended)
  ```bash
  # Install
  brew install gh          # macOS
  winget install GitHub.cli # Windows
  apt install gh           # Linux

  # Authenticate
  gh auth login
  ```

### Docker Skills
- Docker installed
- docker-compose installed
- Trivy scanner (optional, for vulnerability scanning)
  ```bash
  # macOS
  brew install aquasecurity/trivy/trivy

  # Linux
  apt-get install trivy

  # Windows
  choco install trivy
  ```

---

## Skill Structure

Each skill follows this structure:

```
skill-name/
├── SKILL.md          # Skill definition and documentation
├── README.md         # Quick start guide
└── scripts/          # Executable scripts
    ├── script1.sh
    └── script2.sh
```

---

## Security Standards Reference

### CIS Docker Benchmark v1.6.0
Key controls implemented:
- 4.1: Create user for container
- 4.3: Verify file permissions
- 4.5: Enable Content trust
- 5.7: Don't map privileged ports
- 5.10: Set memory limit
- 5.11: Set CPU priority
- 5.12: Read-only root filesystem
- 5.25: No new privileges

### OWASP Docker Security
- Run containers as non-root
- Use minimal base images (Alpine)
- Scan for vulnerabilities
- Limit container resources
- Read-only filesystem
- Drop unnecessary capabilities
- Use security options
- Specific image tags (not :latest)

### NIST SP 800-190
- Image security and integrity
- Runtime configuration
- Resource protection
- Network isolation
- Data protection

### OWASP Top 10 2025
- A01: Broken Access Control (includes SSRF)
- A02: Security Misconfiguration
- A03: Software Supply Chain Failures
- A04: Cryptographic Failures
- A05: Injection
- A06: Insecure Design
- A07: Authentication Failures
- A08: Software or Data Integrity Failures
- A09: Logging & Alerting Failures
- A10: Mishandling of Exceptional Conditions

---

## Contributing

To add a new skill:

1. Create a new directory: `your-skill-name/`
2. Add `SKILL.md` with frontmatter:
   ```yaml
   ---
   name: your-skill
   description: Brief description
   ---
   ```
3. Add `README.md` for quick reference
4. Add scripts in `scripts/` directory
5. Update this README with the new skill

---

## References

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [NIST SP 800-190](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)
