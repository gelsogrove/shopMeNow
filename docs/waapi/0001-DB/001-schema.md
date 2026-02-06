# 001-schema

## Goal
Add WaAPI-specific fields to persist instance metadata and status, without breaking existing Meta/UltraMsg data. This is the foundation for provider switching, onboarding, and webhook updates.

## Scope
- Workspace-level provider fields (current design uses `Workspace`).
- New columns for WaAPI instance identity, phone metadata, status, webhook config, and QR cache.
- Defaults and constraints for WaAPI being the default provider.

## Data Model (Proposed)
```sql
-- Names must match the existing table and naming conventions
ALTER TABLE workspaces
  ADD COLUMN waapiInstanceId TEXT,
  ADD COLUMN waapiInstanceStatus TEXT,
  ADD COLUMN waapiPhoneNumber TEXT,
  ADD COLUMN waapiPhoneName TEXT,
  ADD COLUMN waapiWebhookUrl TEXT,
  ADD COLUMN waapiWebhookEvents TEXT[],
  ADD COLUMN waapiQrCodeData TEXT,
  ADD COLUMN waapiIsActive BOOLEAN DEFAULT true;
```

## Mapping to UI/Behavior
- `waapiPhoneNumber` is required at onboarding.
- `waapiInstanceStatus` drives UI status (authenticated/ready/disconnected).
- `waapiQrCodeData` is temporary; should be cleaned up by TTL job.
- `waapiIsActive` toggles disconnect/reconnect states.

## Critical Notes
- WaAPI uses a global Bearer API token. Do not store per-instance tokens unless returned explicitly by WaAPI.
- QR base64 is ephemeral; keep TTL short to avoid storing sensitive artifacts.

## Acceptance Criteria
1. Columns exist with appropriate nullability and defaults.
2. `waapiPhoneNumber` is required for WaAPI onboarding.
3. No existing data is invalidated by migrations.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Run migrations on a fresh DB and existing DB.
- Run unit tests covering provider switching and workspace updates.
- Update schema docs if present.
