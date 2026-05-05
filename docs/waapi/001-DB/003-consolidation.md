# 003-consolidation

## Goal
Clean up the database schema by consolidating duplicate WhatsApp credential fields. Currently, we have legacy fields on `Workspaces` and new fields also on `Workspaces`.

## Plan
1. **Migration 1**: Create a `WhatsappCredentials` JSONB column (or separate table, but JSONB on Workspace might be easier for flexible providers) OR stick to existing `WhatsappSettings` table.
   * *Better approach*: Use the `WhatsappSettings` table that already exists but seems underused.
2. **Migration 2**: Migrate data from columns (`metaAccessToken`, `ultraMsgToken`, etc.) into `WhatsappSettings` table or the new structure.
3. **Migration 3**: Drop old columns.

**Wait**: Given the scope of WaAPI, maybe just *adding* WaAPI columns is safer, and we schedule consolidation for later?
*User said: "mettiamolo ora" (do it now).*

## Revised Plan (for this Epic)
1. **Analyze**: Check `WhatsappSettings` table. Does it have a `provider` column?
2. **Execute**:
   - Ensure `WhatsappSettings` has `provider`, `instanceId`, `token`, `phoneNumber`.
   - Add `waapi` specific fields if they don't map cleanly.
   - **Crucially**: Mark `Workspace` columns (`whatsappToken`, `metaAccessToken`, etc.) as **DEPRECATED**.
   - Update code to read PREFERENTIALLY from `WhatsappSettings`.

## Acceptance Criteria
1. Schema updated to centralize credentials.
2. Code updated to read from centralized location.
3. Legacy columns marked deprecated (or dropped if we are brave, but deprecation safer).
