# Quickstart Guide: New User Registration Flow

**Feature ID**: 174-router  
**Date**: 2025-11-18  
**Branch**: `174-router`

---

## Overview

This guide shows you how to test the complete new user registration flow:

1. Unknown user sends WhatsApp message
2. System sends welcome message with registration link
3. User clicks link and registers
4. System sends confirmation message

**Total time**: ~5 minutes

---

## Prerequisites

### 1. Backend Running

```bash
cd backend
npm run dev
# Should start on http://localhost:3001
```

### 2. Frontend Running (for registration form)

```bash
cd frontend
npm run dev
# Should start on http://localhost:3000
```

### 3. Database Seeded

```bash
cd backend
npm run seed
# This populates test workspace, products, etc.
```

### 4. Test Workspace Configured

**Default test workspace**: `cm9hjgq9v00014qk8fsdy4ujv`

Verify workspace has welcome message:

```bash
cd backend
npx prisma studio
# Open Workspace table → Find test workspace
# Check welcomeMessage field has English text
```

---

## Test Scenario 1: First-Time User (Welcome Message)

### Step 1: Simulate WhatsApp Message from Unknown User

**Send test message via API**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+39 333 1234567",
    "message": "Ciao",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "sessionId": null,
    "message": "Benvenuto! Sono SofiA...\n\n🔗 **Per continuare, registrati qui:**\nhttps://echatbot.ai/s/AbC123d\n\n⏰ Link valido per 1 ora"
  }
}
```

**What Happened**:

1. ✅ System checked if customer exists (NOT FOUND)
2. ✅ Detected language from phone prefix: +39 → Italian
3. ✅ Retrieved English welcome message from database
4. ✅ Translated via Security & Translation Layer
5. ✅ Generated short URL with secure token
6. ✅ Recorded registration attempt (1/5)

---

### Step 2: Verify Registration Attempt Tracking

**Check database**:

```bash
cd backend
npx prisma studio
# Open registrationAttempts table
# Find record: phoneNumber="+39 333 1234567", attemptCount=1
```

**Or via SQL**:

```sql
SELECT * FROM "registrationAttempts"
WHERE "phoneNumber" = '+39 333 1234567'
  AND "workspaceId" = 'cm9hjgq9v00014qk8fsdy4ujv';
```

**Expected**:

- `attemptCount`: 1
- `isBlocked`: false
- `lastAttemptAt`: recent timestamp

---

### Step 3: Extract Short URL

From the response above, copy the short URL:

```
https://echatbot.ai/s/AbC123d
```

**Test redirect**:

```bash
curl -I http://localhost:3001/s/AbC123d
```

**Expected Response** (302 Redirect):

```
Location: http://localhost:3000/register?token=xxx-yyy-zzz
```

---

### Step 4: Open Registration Form

1. **Copy the full redirect URL** from Step 3
2. **Open in browser**: `http://localhost:3000/register?token=xxx-yyy-zzz`
3. **Fill the form**:

   - First Name: Mario
   - Last Name: Rossi
   - Company: Acme Inc
   - Email: mario.rossi@example.com
   - Phone: +39 333 1234567 (must match!)
   - Language: Italian
   - ✅ GDPR consent

4. **Click "Registrati"**

**Expected**:

- ✅ Customer created in database
- ✅ Confirmation message sent (check logs)
- ✅ Registration attempts cleared
- ✅ Redirect to success page (or chat page)

---

### Step 5: Verify Confirmation Message

**Check backend logs**:

```bash
cd backend
# Look for:
# ✅ After-registration message translated via Security & Translation layer
# ✅ After-registration message sent for customer <id>
```

**Check database** (messages table):

```sql
SELECT * FROM "Message"
WHERE "chatSessionId" IN (
  SELECT id FROM "ChatSession"
  WHERE "customerId" = '<new_customer_id>'
)
ORDER BY "createdAt" DESC
LIMIT 1;
```

**Expected message content** (Italian):

```
Grazie per esserti registrato, Mario! Come ti posso aiutare oggi?
Vuoi vedere i tuoi ordini? Le offerte? O hai bisogno di altre informazioni?
```

---

## Test Scenario 2: Blocking After 3 Attempts

### Step 1: Send 3 Messages from Same Phone

**Attempt 1**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+34 611 223344",
    "message": "Hola",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Response: Welcome message sent, attemptCount=1
```

**Attempt 2**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+34 611 223344",
    "message": "Info",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Response: Welcome message sent, attemptCount=2
```

**Attempt 3**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+34 611 223344",
    "message": "Help",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Response: Welcome message sent, attemptCount=3
```

**Attempt 4**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+34 611 223344",
    "message": "Test",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Response: NO MESSAGE, attemptCount=4
```

**Attempt 5**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+34 611 223344",
    "message": "Please",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Response: BLOCKED (attemptCount=5, isBlocked=true)
```

**Attempt 6** (and beyond):

```bash
# Same request as above
# Response: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED" (no message sent)
```

---

### Step 2: Verify Blocking

**Check database**:

```sql
SELECT * FROM "registrationAttempts"
WHERE "phoneNumber" = '+34 611 223344';
```

**Expected**:

- `attemptCount`: 5
- `isBlocked`: true

**Check backend logs**:

```
🚫 User +34 611 223344 blocked after 5 attempts
🚫 User +34 611 223344 is blocked due to too many registration attempts
```

---

## Test Scenario 3: Language Detection

### Test Different Phone Prefixes

**Italian (+39)**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+39 333 9999999", "message": "Ciao", "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"}'
# Expected: Welcome message in ITALIAN
```

**Spanish (+34)**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+34 611 888888", "message": "Hola", "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"}'
# Expected: Welcome message in SPANISH
```

**Portuguese (+351)**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+351 912 777777", "message": "Olá", "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"}'
# Expected: Welcome message in PORTUGUESE
```

**English (default - other prefixes)**:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1 555 1234567", "message": "Hello", "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"}'
# Expected: Welcome message in ENGLISH
```

---

## Test Scenario 4: WIP Message vs Welcome Message

### WIP Message (Chatbot Disabled)

**Step 1**: Disable chatbot for workspace

```sql
UPDATE "Workspace"
SET "challengeStatus" = false
WHERE id = 'cm9hjgq9v00014qk8fsdy4ujv';
```

**Step 2**: Send message from EXISTING customer

```bash
# First, create a customer or use existing one
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+39 333 1234567",
    "message": "Ciao",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }'
# Expected: WIP message (NOT welcome message)
# "Lavori in corso. Contattaci più tardi."
```

**Step 3**: Re-enable chatbot

```sql
UPDATE "Workspace"
SET "challengeStatus" = true
WHERE id = 'cm9hjgq9v00014qk8fsdy4ujv';
```

**Verification**: WIP and Welcome are separate flows ✅

---

## Troubleshooting

### Issue: "Welcome message not configured"

**Solution**: Add English welcome message to workspace

```sql
UPDATE "Workspace"
SET "welcomeMessage" = '{
  "en": "Welcome! I am SofiA, your digital assistant. To continue, please register.",
  "it": "Benvenuto! Sono SofiA, il tuo assistente digitale. Per continuare, registrati.",
  "es": "¡Bienvenido! Soy SofiA, tu asistente digital. Para continuar, regístrate.",
  "pt": "Bem-vindo! Sou a SofiA, a sua assistente digital. Para continuar, registre-se."
}'
WHERE id = 'cm9hjgq9v00014qk8fsdy4ujv';
```

---

### Issue: "Short URL not found (404)"

**Possible causes**:

1. URL expired (>1 hour old)
2. Short code doesn't exist in database
3. `isActive = false`

**Solution**: Check `shortUrls` table

```sql
SELECT * FROM "ShortUrls"
WHERE "shortCode" = 'AbC123d';
```

If `expiresAt` < now → URL expired (generate new one)

---

### Issue: "Invalid or expired token"

**Possible causes**:

1. Token expired (>1 hour)
2. Token already used (`used = true`)
3. Phone number mismatch

**Solution**: Check `secureToken` table

```sql
SELECT * FROM "SecureToken"
WHERE "token" = 'xxx-yyy-zzz';
```

If `used = true` → Token already consumed (cannot reuse)  
If `expiresAt` < now → Token expired

---

### Issue: Registration confirmation not sent

**Check logs for**:

```
✅ After-registration message translated via Security & Translation layer
✅ After-registration message sent successfully to customer <id>
```

**If missing**: Check `RegistrationService.sendAfterRegistrationMessage()` is called

**Verify in code** (`registration.controller.ts` line 314):

```typescript
this.registrationService
  .sendAfterRegistrationMessage(customer.id)
  .then((success) => { ... })
```

---

## Verification Checklist

After testing, verify:

- [ ] Unknown user receives welcome message in correct language
- [ ] Short URL redirects to registration form
- [ ] Registration creates customer record
- [ ] Confirmation message sent after registration
- [ ] Registration attempts tracked correctly
- [ ] User blocked after 5 attempts
- [ ] Language detection works for all prefixes (+39, +34, +351)
- [ ] WIP message separate from welcome message
- [ ] All messages pass through Security & Translation Layer (check logs)
- [ ] Workspace isolation: Cannot use token from workspace A for workspace B

---

## Next Steps

After verifying the flow works:

1. **Add unit tests** (see research.md for test cases)
2. **Add integration tests** (full flow end-to-end)
3. **Add security tests** (workspace isolation)
4. **Production deployment**:
   - Update workspace welcome/confirmation messages
   - Configure WhatsApp webhook URL
   - Enable rate limiting
   - Monitor registration attempt blocks

---

## Useful Commands

### Reset Registration Attempts (for testing)

```sql
DELETE FROM "registrationAttempts"
WHERE "phoneNumber" = '+34 611 223344';
```

### Clear All Test Data

```bash
cd backend
npm run seed
# This resets database to clean state
```

### View Backend Logs in Real-Time

```bash
cd backend
npm run dev | grep -E "(Welcome|Registration|Translation)"
# Filters logs for relevant messages
```

### Check Short URL Stats

```sql
SELECT "shortCode", "clicks", "createdAt", "expiresAt"
FROM "ShortUrls"
WHERE "workspaceId" = 'cm9hjgq9v00014qk8fsdy4ujv'
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## Production Considerations

### Before Going Live

1. **Update welcome message** in production workspace (Italian + English)
2. **Update confirmation message** (Italian + English)
3. **Configure WhatsApp webhook** with proper signature validation
4. **Enable rate limiting** (100 req/15min per IP)
5. **Monitor logs** for blocking events
6. **Set up alerts** for high registration attempt failures

### Monitoring Metrics

- Registration attempts per hour
- Blocked users per day
- Average time from welcome to registration
- Short URL click-through rate
- Translation failures (should be 0)

---

## Support

For issues or questions:

- Check `backend/logs/` for detailed error messages
- Review `docs/memory-bank/PRD.md` for architecture details
- See `.specify/memory/constitution.md` for design principles
