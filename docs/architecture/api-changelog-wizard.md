# API Changelog - Wizard Simplification (January 15, 2026)

## Summary
Simplified channel creation wizard from 8 to 7 steps with smart conditional logic, channel type differentiation, and intelligent FAQ suggestions.

---

## Breaking Changes

### ⚠️ None
All changes are **backward compatible**. Existing API consumers can continue using the API without modifications.

---

## New Features

### 1. Channel Type Support
**Endpoint:** `POST /api/workspaces`  
**New Field:** `channelType`

```typescript
{
  channelType?: 'WHATSAPP' | 'WIDGET'  // Default: 'WHATSAPP'
}
```

**Behavior:**
- `WHATSAPP`: Can sell products/services (e-commerce enabled)
- `WIDGET`: Support-only (cannot sell products, `sellsProductsAndServices` forced to `false`)

**Example Request:**
```json
{
  "name": "Support Widget",
  "channelType": "WIDGET",
  "sellsProductsAndServices": false,
  "operatorEmail": "support@company.com"
}
```

---

### 2. Operator Email Field
**Endpoint:** `POST /api/workspaces`, `PUT /api/workspaces/:id`  
**New Field:** `operatorEmail`

```typescript
{
  operatorEmail?: string  // Optional operator contact email
}
```

**Behavior:**
- Replaces `operatorWhatsappNumber` in most use cases
- `operatorContactMethod` is now always `'email'` (Andrea's requirement)
- Auto-filled from authenticated user's JWT token on frontend

**Example Request:**
```json
{
  "name": "My Store",
  "channelType": "WHATSAPP",
  "whatsappPhoneNumber": "+393331234567",
  "operatorEmail": "owner@store.com",
  "operatorContactMethod": "email"
}
```

---

### 3. Smart FAQ Creation
**Endpoint:** `POST /api/workspaces`  
**Updated Field:** `faqs`

```typescript
{
  faqs?: Array<{
    question: string,
    answer: string
  }>
}
```

**Behavior:**
- Frontend auto-suggests FAQs based on `channelType`
- **E-commerce FAQs** (WhatsApp): delivery, refund, hours, payment
- **Support FAQs** (Widget): services offered, hours, contact, consultations
- Empty FAQs (no answer) are filtered out before DB insertion

**Example Request:**
```json
{
  "name": "My Store",
  "channelType": "WHATSAPP",
  "faqs": [
    {
      "question": "How long does it take to receive the order?",
      "answer": "Usually 24-48 hours for local delivery"
    },
    {
      "question": "What is your refund policy?",
      "answer": "30-day money-back guarantee"
    }
  ]
}
```

---

## Updated Endpoints

### `GET /api/workspaces`
**New Response Fields:**
```typescript
{
  workspaces: Array<{
    id: string,
    name: string,
    channelType: 'WHATSAPP' | 'WIDGET',  // NEW
    operatorEmail: string | null,        // NEW
    // ... existing fields
  }>
}
```

---

### `GET /api/workspaces/:id`
**New Response Fields:**
```typescript
{
  workspace: {
    id: string,
    name: string,
    channelType: 'WHATSAPP' | 'WIDGET',  // NEW
    operatorEmail: string | null,        // NEW
    whatsappPhoneNumber: string | null,
    sellsProductsAndServices: boolean,
    hasSalesAgents: boolean,
    hasHumanSupport: boolean,
    toneOfVoice: string,
    botIdentityResponse: string,
    // ... existing fields
  }
}
```

---

### `PUT /api/workspaces/:id`
**New Request Fields:**
```typescript
{
  channelType?: 'WHATSAPP' | 'WIDGET',  // NEW
  operatorEmail?: string,               // NEW
  // ... existing fields
}
```

---

## Database Schema Changes

### New Enum Value: `ChannelType.WIDGET`
```sql
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'WIDGET';
```

**Existing values:**
- `WHATSAPP` (default)
- `TELEGRAM`
- `MESSENGER`
- `LINE`

**New value:**
- `WIDGET` (support-only channel)

---

### New Workspace Columns
```sql
ALTER TABLE "Workspace" 
  ADD COLUMN "channelType" "ChannelType" NOT NULL DEFAULT 'WHATSAPP',
  ADD COLUMN "operatorEmail" TEXT;
```

**Field Details:**
- `channelType`: Not null, defaults to `'WHATSAPP'` for existing records
- `operatorEmail`: Nullable, existing records will have `NULL`

---

## Migration Guide

### For Backend Developers

#### 1. Run Database Migration
```bash
cd packages/database
psql $DATABASE_URL -f prisma/migrations/20260115_add_channel_type_wizard.sql
```

#### 2. Regenerate Prisma Client
```bash
cd packages/database
npx prisma generate
```

#### 3. Update Service Layer (if needed)
If you have custom logic that creates workspaces, update your interfaces:

```typescript
// OLD
interface CreateWorkspaceData {
  name: string
  whatsappPhoneNumber?: string
  // ...
}

// NEW
interface CreateWorkspaceData {
  name: string
  channelType?: 'WHATSAPP' | 'WIDGET'  // NEW
  whatsappPhoneNumber?: string          // Required only for WHATSAPP
  operatorEmail?: string                // NEW
  // ...
}
```

---

### For Frontend Developers

#### 1. Update Workspace Type Definitions
```typescript
// types/workspace.ts
export interface Workspace {
  id: string
  name: string
  channelType: 'WHATSAPP' | 'WIDGET'  // NEW
  operatorEmail: string | null        // NEW
  // ... existing fields
}
```

#### 2. Update Workspace Creation Forms
```typescript
// When creating workspace
const workspaceData = {
  name: 'My Channel',
  channelType: 'WHATSAPP', // or 'WIDGET'
  operatorEmail: user.email,
  // ... other fields
}
```

#### 3. Conditional Rendering Based on Channel Type
```tsx
{workspace.channelType === 'WHATSAPP' && (
  <div>E-commerce features available</div>
)}

{workspace.channelType === 'WIDGET' && (
  <div>Support-only mode</div>
)}
```

---

### For API Consumers

#### 1. Optional Fields
All new fields are **optional** on existing endpoints. You can continue using the API as before.

#### 2. New Field Handling
When fetching workspaces, expect new fields:

```typescript
// Response from GET /api/workspaces/:id
{
  "workspace": {
    "id": "...",
    "name": "My Store",
    "channelType": "WHATSAPP",  // NEW (will be 'WHATSAPP' for existing records)
    "operatorEmail": null,      // NEW (will be null for existing records)
    // ... existing fields
  }
}
```

---

## Validation Rules

### Channel Type Validation
```typescript
// Widget channels CANNOT have e-commerce enabled
if (channelType === 'WIDGET') {
  sellsProductsAndServices = false  // Forced
  hasSalesAgents = false            // Forced
}

// WhatsApp channels REQUIRE phone number
if (channelType === 'WHATSAPP') {
  if (!whatsappPhoneNumber) {
    throw new ValidationError('WhatsApp number required for WhatsApp channels')
  }
}
```

### Operator Email Validation
```typescript
// If provided, must be valid email format
if (operatorEmail) {
  if (!isValidEmail(operatorEmail)) {
    throw new ValidationError('Invalid operator email format')
  }
}
```

### FAQ Validation
```typescript
// FAQs with empty answers are filtered out
faqs = faqs.filter(faq => faq.question && faq.answer)
```

---

## Examples

### Example 1: Create WhatsApp E-commerce Channel
```bash
curl -X POST https://api.echatbot.ai/api/workspaces \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Store",
    "channelType": "WHATSAPP",
    "whatsappPhoneNumber": "+393331234567",
    "sellsProductsAndServices": true,
    "hasSalesAgents": true,
    "hasHumanSupport": false,
    "operatorEmail": "owner@store.com",
    "operatorContactMethod": "email",
    "toneOfVoice": "friendly",
    "botIdentityResponse": "You are Lucia, a helpful shopping assistant",
    "faqs": [
      {
        "question": "How long does it take to receive the order?",
        "answer": "24-48 hours for local delivery"
      }
    ]
  }'
```

**Response:**
```json
{
  "id": "workspace-123",
  "name": "My Store",
  "channelType": "WHATSAPP",
  "whatsappPhoneNumber": "+393331234567",
  "sellsProductsAndServices": true,
  "operatorEmail": "owner@store.com",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

### Example 2: Create Widget Support Channel
```bash
curl -X POST https://api.echatbot.ai/api/workspaces \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Widget",
    "channelType": "WIDGET",
    "sellsProductsAndServices": false,
    "hasHumanSupport": true,
    "operatorEmail": "support@company.com",
    "operatorContactMethod": "email",
    "toneOfVoice": "professional",
    "botIdentityResponse": "You are Marco, a technical support specialist",
    "faqs": [
      {
        "question": "What services do you offer?",
        "answer": "We offer consulting, training, and technical support"
      }
    ]
  }'
```

**Response:**
```json
{
  "id": "workspace-456",
  "name": "Support Widget",
  "channelType": "WIDGET",
  "whatsappPhoneNumber": null,
  "sellsProductsAndServices": false,
  "operatorEmail": "support@company.com",
  "createdAt": "2026-01-15T10:05:00Z"
}
```

---

### Example 3: Update Existing Workspace
```bash
curl -X PUT https://api.echatbot.ai/api/workspaces/workspace-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorEmail": "newemail@store.com"
  }'
```

**Response:**
```json
{
  "id": "workspace-123",
  "name": "My Store",
  "channelType": "WHATSAPP",
  "operatorEmail": "newemail@store.com",
  "updatedAt": "2026-01-15T10:10:00Z"
}
```

---

## Backward Compatibility

### Existing Workspaces
- All existing workspaces will have `channelType = 'WHATSAPP'` (default)
- All existing workspaces will have `operatorEmail = NULL`
- No functionality is broken for existing records

### Existing API Calls
- API consumers can continue sending requests without `channelType` or `operatorEmail`
- Default behavior remains unchanged (WhatsApp channel creation)

---

## Testing Checklist

- [x] Create WhatsApp channel with `channelType = 'WHATSAPP'`
- [x] Create Widget channel with `channelType = 'WIDGET'`
- [x] Verify Widget channel forces `sellsProductsAndServices = false`
- [x] Verify WhatsApp channel requires `whatsappPhoneNumber`
- [x] Verify Widget channel does NOT require `whatsappPhoneNumber`
- [x] Test FAQ creation with empty answers (should be filtered)
- [x] Test `operatorEmail` validation (must be valid email)
- [x] Verify GET endpoints return new fields
- [x] Verify PUT endpoints accept new fields
- [x] Test backward compatibility (old API calls still work)

---

## Support

### Questions?
- Slack: `#echatbot-dev`
- Email: `dev@echatbot.ai`
- Docs: `docs/architecture/wizard-7-steps-flow.md`

### Bug Reports
- GitHub Issues: https://github.com/shopmenow/shopME/issues
- Tag: `wizard`, `api-changelog`
