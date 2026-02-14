# Create Hardened Docker Skill

Creates production-ready hardened Docker configurations.

## Quick Start

```bash
# Create all hardened Docker files
./scripts/create-all.sh [app-name] [node-version] [nginx-version]
```

## What It Creates

✅ **Dockerfile** - Multi-stage, non-root, Alpine-based
✅ **docker-compose.yml** - Read-only filesystem, capability controls
✅ **nginx.conf** - Security headers, TLS 1.2+, gzip compression
✅ **.dockerignore** - Optimized build context
✅ **.env.example** - Environment variable template

## Usage Examples

```bash
# Create with defaults (contacts-app, node:18.20.4, nginx:1.27.3)
./scripts/create-all.sh

# Create for custom app
./scripts/create-all.sh my-app

# Create with specific versions
./scripts/create-all.sh my-app 20.11.1-alpine3.19 1.25.3-alpine3.18
```

## Generated Configuration Features

### Security Hardening
- ✅ Non-root user (nginx)
- ✅ Read-only filesystem
- ✅ Tmpfs for writable dirs
- ✅ All capabilities dropped
- ✅ No privilege escalation
- ✅ Resource limits (512MB, 1 CPU)

### Network Security
- ✅ TLS 1.2+ only
- ✅ HSTS headers
- ✅ CSP headers
- ✅ Server version hidden
- ✅ Gzip compression

### Image Optimization
- ✅ Multi-stage builds
- ✅ Alpine base images
- ✅ Build cache cleanup
- ✅ < 50MB final image

## After Creation

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 2. Build image
docker build -t my-app .

# 3. Verify security
./.agent/develop/verify-hardened-docker-skill/scripts/verify-docker-hardening.sh my-app

# 4. Start container
docker-compose up -d

# 5. Test
curl http://localhost
```

## Compliance

- ✅ CIS Docker Benchmark v1.6.0
- ✅ OWASP Docker Security Cheat Sheet
- ✅ NIST SP 800-190

## See Also

- [SKILL.md](SKILL.md) - Full documentation
- [verify-hardened-docker-skill](../verify-hardened-docker-skill) - Verify hardening
