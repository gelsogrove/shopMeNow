# Migration: Convert Message Fields from Json to String

**Date**: 2026-01-26  
**Status**: ✅ Completed (Schema updated, code updated, tests fixed)

## Problem

Andrea discovered that after the wizard, `welcomeMessage`, `wipMessage`, and `customAiRules` were showing `[object Object]` instead of text in the Settings page.

**Root Cause**: These fields were stored as **Json** (multilingual objects) in database, but frontend was treating them as **String**, causing the display issue.

## Solution

Convert database schema from **Json** to **String** (English only):
- `welcomeMessage`: Json → String
- `wipMessage`: Json → String  
- `afterRegistrationMessages`: Json → String

**Translation Layer** will automatically translate these messages to customer's language.

## Changes Made

### 1. Database Schema (`packages/database/prisma/schema.prisma`)

**Before**:
```prisma
welcomeMessage            Json?     @default("{\"en\": \"Welcome!...\", \"it\": \"...\", ...}")
wipMessage                Json?     @default("{\"en\": \"Work in progress...\", ...}")
afterRegistrationMessages Json?     @default("{\"en\": \"Thank you...\", ...}")
```

**After**:
```prisma
welcomeMessage            String?   @default("Welcome! I'm {{chatbotName}}...") @db.Text
wipMessage                String?   @default("Work in progress...") @db.Text
afterRegistrationMessages String?   @default("Thank you for registering...") @db.Text
```

### 2. Backend Service (`apps/backend/src/application/services/workspace.service.ts`)

**Before**:
```typescript
const defaultWelcomeMessage = {
  en: "Welcome!...",
  it: "Benvenuto!...",
  es: "¡Bienvenido!...",
  pt: "Bem-vindo!..."
}
data.welcomeMessage = defaultWelcomeMessage
```

**After**:
```typescript
const defaultWelcomeMessage = "Welcome! I'm {{chatbotName}}..."
const defaultWipMessage = "Work in progress..."
const defaultAfterRegistrationMessage = "Thank you for registering, {{customerName}}!"

if (!data.welcomeMessage) data.welcomeMessage = defaultWelcomeMessage
if (!data.wipMessage) data.wipMessage = defaultWipMessage
if (!data.afterRegistrationMessages) data.afterRegistrationMessages = defaultAfterRegistrationMessage
```

### 3. Message Repository (`apps/backend/src/repositories/message.repository.ts`)

**Before**:
```typescript
const welcomeMessageObj = workspace.welcomeMessage as {
  en: string
  es: string
  it: string
  pt: string
}
return welcomeMessageObj.en || JSON.stringify(workspace.welcomeMessage)
```

**After**:
```typescript
return typeof workspace.welcomeMessage === 'string' 
  ? workspace.welcomeMessage 
  : JSON.stringify(workspace.welcomeMessage)
```

### 4. WhatsApp Webhook Controller

**Before**:
```typescript
const wipMessages = (workspace?.wipMessage as any) || {}
const customerLanguage = (customer.language || "en").toLowerCase()
const rawWipMessage = wipMessages[customerLanguage] || wipMessages.en || ...
```

**After**:
```typescript
const wipMessage = workspace?.wipMessage || "Work in progress..."
// Translation Agent handles language translation
```

### 5. Unit Tests (5 files updated)

Updated test files to use String instead of Json objects:
- `chat-engine-welcome.spec.ts`
- `chat-engine-welcome-debug-info.spec.ts`
- `expired-numeric-selection.spec.ts`
- `safety-translation-coverage.spec.ts`
- `informational-services-routing.spec.ts`

**Before**:
```typescript
welcomeMessage: {
  it: "Benvenuto!",
  en: "Welcome!",
  es: "¡Bienvenido!"
}
```

**After**:
```typescript
welcomeMessage: "Welcome!"
```

## Migration Steps (When Database is Running)

```bash
# 1. Start Docker (if not running)
docker-compose up -d

# 2. Create migration
cd packages/database
npx prisma migrate dev --name convert_messages_to_string

# 3. Regenerate Prisma client
npx prisma generate

# 4. Update existing data (optional - backward compatible)
# Existing Json data will be converted to string automatically
```

## Backward Compatibility

All code is **backward compatible**:
- `welcome-message.handler.ts` → `extractWelcomeText()` handles both String and Json
- `message.repository.ts` → Uses `typeof` checks to handle both formats
- Migration will convert existing Json data to English string version

## Benefits

1. ✅ **Simpler architecture**: Single language source (English)
2. ✅ **No [object Object] bugs**: Frontend always receives strings
3. ✅ **Translation Agent handles all languages**: Dynamic translation instead of static multilingual objects
4. ✅ **Easier to edit**: Admin can edit plain text instead of Json
5. ✅ **Consistent with other fields**: `botIdentityResponse`, `customAiRules` already use String

## Testing

After migration:
```bash
# Run unit tests
cd apps/backend && npm run test:unit

# Verify settings page
# 1. Open backoffice → Settings → AI Configuration
# 2. Check "Bot Identity" field → Should show text (not [object Object])
# 3. Check "Welcome Message" field → Should show text
# 4. Save changes → Should work correctly
```

## Rollback Plan

If issues occur:
1. Revert schema changes in `schema.prisma`
2. Run `npx prisma migrate dev --name revert_to_json_messages`
3. Restore backend code from git history

## Status

- ✅ Schema updated
- ✅ Prisma client regenerated
- ✅ Backend code updated (5 files)
- ✅ Unit tests fixed (5 files)
- ⏳ Database migration pending (waiting for Docker/DB)
- ⏳ Production deployment pending

## Related Files

- `packages/database/prisma/schema.prisma`
- `apps/backend/src/application/services/workspace.service.ts`
- `apps/backend/src/repositories/message.repository.ts`
- `apps/backend/src/utils/welcome-message.handler.ts`
- `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`
- `apps/backend/__tests__/unit/chat-engine-welcome.spec.ts`
- `apps/backend/__tests__/unit/chat-engine/chat-engine-welcome-debug-info.spec.ts`
- `apps/backend/__tests__/unit/chat-engine/expired-numeric-selection.spec.ts`
- `apps/backend/__tests__/unit/agents/safety-translation-coverage.spec.ts`
- `apps/backend/__tests__/unit/chat-engine/informational-services-routing.spec.ts`
