# Changelog - ShopME Platform

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2025-10-31

### 🔒 Added - Message Translation Security Layer

**CRITICAL SECURITY FEATURE**: Complete refactoring to ensure ALL outbound WhatsApp messages pass through Safety & Translation layer.

#### Security Improvements

- **Mandatory Translation Layer**: All system messages MUST go through `SafetyTranslationAgent` before being sent
- **Content Blocking**: Messages blocked if safety check fails (no fallback)
- **No Bypass**: Single entry point (`LLMService.handleNewUserWelcome()`) enforced for all webhooks
- **15 Security Tests**: Comprehensive test suite created to verify translation layer compliance

#### Database Schema Changes

- **BREAKING**: Removed `welcomeMessages` (Json) field from Workspace table
- **BREAKING**: Removed `wipMessages` (Json) field from Workspace table
- **Added**: `welcomeMessage` (String) - English-only welcome message
- **Added**: `wipMessage` (String) - English-only WIP message
- **Migration**: Created `20251031000000_convert_messages_to_english_only.sql`
  - Automatically extracts 'en' value from existing JSON
  - Preserves data during migration
  - Sets default English messages

#### Backend Changes

- **LLMService**: New `translateSystemMessage()` private method for translation
- **LLMService**: New `handleNewUserWelcome()` public entry point for webhooks
- **MessageRepository**: Removed `language` parameter from all methods
- **MessageRepository**: Now throws errors instead of using hardcoded fallbacks
- **WorkspaceService**: Updated interfaces to use `string` instead of `any` for messages
- **Webhook Routes**: Refactored to use `LLMService.handleNewUserWelcome()` instead of direct sends
- **Routes**: Removed all direct WhatsApp message sends from webhook handlers

#### Frontend Changes

- **SettingsPage**: Removed language tabs (EN/IT/ES/PT)
- **SettingsPage**: Single English textarea for `welcomeMessage`
- **SettingsPage**: Single English textarea for `wipMessage`
- **SettingsPage**: Added help text explaining automatic translation
- **workspaceApi.ts**: Updated `Workspace` interface with new field names
- **WorkspaceContext**: Updated global Workspace type definition

#### Testing

- **New File**: `backend/src/__tests__/security/message-translation.security.test.ts`
- **15 Test Cases** covering:
  - Welcome message translation through SafetyTranslationAgent
  - Message blocking on safety check failure
  - Error throwing on translation failure (no fallback)
  - WIP message translation
  - Database English-only message validation
  - Translation debug info verification
  - Language detection from phone prefix
  - Code security audit (no direct sends, no hardcoded fallbacks)
  - Error handling and logging

#### Documentation

- **New**: `docs/memory-bank/01-security/message-translation-security-layer.md`
  - Complete architecture documentation
  - Migration steps explained
  - Before/after code examples
  - Usage examples and patterns
  - Security implications
  - Rollback procedure
- **Updated**: `docs/memory-bank/readme.md` with new security feature link

#### Files Changed

**Backend** (8 files):

- `prisma/schema.prisma`
- `prisma/migrations/20251031000000_convert_messages_to_english_only/migration.sql`
- `src/repositories/message.repository.ts`
- `src/services/workspace.service.ts`
- `src/services/llm.service.ts`
- `src/routes/webhooks/whatsapp.routes.ts`
- `src/routes/index.ts`
- `src/__tests__/security/message-translation.security.test.ts` (NEW)

**Frontend** (3 files):

- `src/pages/SettingsPage.tsx`
- `src/services/workspaceApi.ts`
- `src/contexts/WorkspaceContext.tsx`

**Documentation** (2 files):

- `docs/memory-bank/01-security/message-translation-security-layer.md` (NEW)
- `docs/memory-bank/readme.md`

#### Breaking Changes

⚠️ **Migration Required**: Existing workspaces must run the migration to convert JSON messages to English strings.

```bash
# Run migration
cd backend
npx prisma migrate deploy

# Verify migration
npx prisma studio
# Check Workspace table for welcomeMessage and wipMessage fields
```

#### Migration Path for Existing Workspaces

1. **Automatic**: Migration extracts 'en' value from existing `welcomeMessages` JSON
2. **Default Values**: If 'en' not found, uses default English messages from schema
3. **Frontend Update**: Admin must re-save workspace settings to see new UI
4. **No Action Required**: Translation happens automatically at runtime

#### Security Benefits

- ✅ **No bypass possible**: All messages must go through translation
- ✅ **Explicit errors**: Configuration issues visible immediately (no silent fallbacks)
- ✅ **Reduced attack surface**: Single language in database instead of multiple
- ✅ **Audit trail**: Debug info tracks all translations
- ✅ **Test coverage**: 15 security tests ensure compliance

#### Performance Impact

- **Minimal**: Translation only happens once per message send
- **Cached**: Customer language detected from phone prefix or DB
- **Fast**: OpenRouter GPT-4o-mini used for translation (~200ms)

---

## [2.0.0] - Previous Major Release

(Previous changelog entries would go here...)

---

## Upgrade Guide

### From 2.0.x to 2.1.0

1. **Backup Database**

   ```bash
   cd backend
   npm run export-workspace-backup -- <workspaceId>
   ```

2. **Pull Latest Code**

   ```bash
   git pull origin main
   ```

3. **Install Dependencies**

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. **Run Migration**

   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Verify Migration**

   - Check database: `npx prisma studio`
   - Verify `welcomeMessage` and `wipMessage` fields exist
   - Verify data was preserved (English values extracted from JSON)

6. **Restart Services**

   ```bash
   # Backend
   cd backend && npm run dev

   # Frontend
   cd frontend && npm run dev
   ```

7. **Test Functionality**

   - Go to Settings page
   - Verify single English textareas appear
   - Update welcome message
   - Save and verify
   - Test with new customer registration (check translation)

8. **Run Security Tests**
   ```bash
   cd backend
   npm run test:security -- message-translation.security.test.ts
   ```

### Rollback Procedure

If issues occur:

```bash
cd backend

# 1. Rollback migration
npx prisma migrate rollback

# 2. Restore from backup
npm run restore-workspace-backup -- <workspaceId>

# 3. Revert code
git revert <commit-hash>

# 4. Regenerate Prisma client
npx prisma generate
```

---

## Support

For questions or issues related to this release:

- 📧 Email: support@shopme.ai
- 📚 Documentation: `docs/memory-bank/01-security/message-translation-security-layer.md`
- 🐛 Issues: GitHub Issues

---

**Legend**:

- 🔒 Security fix
- 🚀 New feature
- 💥 Breaking change
- 🐛 Bug fix
- 📝 Documentation
- ♻️ Refactoring
- ⚡ Performance improvement
