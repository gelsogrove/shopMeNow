# 002-migrations

## Goal
Create DB migrations to introduce WaAPI fields and indexes with safe defaults. Migrations must be safe on production data and reversible if supported.

## Migration Plan
1. Add new nullable columns.
2. Backfill defaults where required (provider default, active flags).
3. Add indexes on lookup fields for fast webhook matching.

## Critical Code Example
```sql
CREATE INDEX workspaces_waapi_instance_id_idx ON workspaces(waapiInstanceId);
CREATE INDEX workspaces_waapi_phone_number_idx ON workspaces(waapiPhoneNumber);
```

## Edge Cases
- Workspaces currently using Meta/UltraMsg should remain valid.
- Existing `whatsappProvider` default should be updated to `waapi` only for new workspaces, not existing ones.

## Acceptance Criteria
1. Migration applies cleanly in staging and prod-like data.
2. Indexes exist and are used for lookup.
3. Rollback strategy documented (if applicable).
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Run migration + seed.
- Run DB-related tests.
