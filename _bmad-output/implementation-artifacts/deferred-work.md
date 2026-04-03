# Deferred Work

## Deferred from: code review of 17-9-unified-sprint-status-schema (2026-04-03)

- sprint-status.yaml still uses old flat `development_status` format — migration is Story 17.23
- `generated` field in sprint-status.yaml is bare date, not ISO-8601 datetime — will be reformatted by Story 17.15 bootstrap
- No `schema_version` metadata field — can be added in a future story if schema evolution is needed
- Concurrent modification has no locking guidance — skills run serially in current architecture
- `correct-course` referenced in schema Section 4.6 but not in skill integration map — informational reference only
