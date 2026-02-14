# Verify Hardened Docker Skill

Comprehensive security verification for Docker configurations.

## Quick Start

```bash
# Verify all Docker security configurations
./scripts/verify-docker-hardening.sh [image-name] [container-name]
```

## What It Checks

✅ **Image Security**
- Specific version tags (no :latest)
- Non-root user execution
- No leaked secrets
- Minimal base images
- HEALTHCHECK present

✅ **Dockerfile Hardening**
- Multi-stage builds
- Read-only file permissions
- No hardcoded secrets
- Build cache cleanup

✅ **docker-compose.yml Security**
- Read-only filesystem
- Tmpfs mounts
- Capability dropping
- Resource limits
- Security options

✅ **Runtime Security**
- Non-root execution
- Read-only filesystem
- Proper permissions
- Health checks

✅ **Vulnerability Scanning**
- Trivy image scan
- Secret detection
- CVE identification

## Usage Examples

```bash
# Verify contacts-app
./scripts/verify-docker-hardening.sh contacts-app

# Verify with custom container name
./scripts/verify-docker-hardening.sh my-app my-app-container

# Quick Dockerfile check
grep "^USER" Dockerfile && echo "✅ Non-root user set"

# Quick vulnerability scan
trivy image --severity HIGH,CRITICAL contacts-app
```

## Exit Codes

- `0` - All checks passed
- `1` - CRITICAL vulnerabilities found
- `2` - Hardening checks failed
- `3` - Secret leakage detected
- `4` - Runtime security violations
- `5` - Missing required files

## Requirements

- Docker installed
- Trivy scanner (optional, for vulnerability scanning)
  ```bash
  # macOS
  brew install aquasecurity/trivy/trivy

  # Linux
  apt-get install trivy
  ```

## See Also

- [SKILL.md](SKILL.md) - Full documentation
- [create-hardened-docker-skill](../create-hardened-docker-skill) - Create hardened configs
