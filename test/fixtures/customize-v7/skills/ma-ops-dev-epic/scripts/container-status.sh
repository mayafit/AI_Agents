#!/usr/bin/env sh
# Story 36.4 fixture: a shell script under scripts/. Its Docker --format string is not a
# BMAD placeholder; the validator excludes skills/**/scripts/ by path (AC7).
docker ps --format '{{.Names}} {{.Status}}'
