# Feature 204: Implementation Plan

## 🎯 Executive Summary

Questo piano implementa il nuovo flusso per utenti non registrati che permette loro di chattare liberamente ma blocca azioni specifiche (prezzi, carrello, ordini) reindirizzandoli alla registrazione.

---

## 📊 Architecture Overview

### Current State (Before)
```
User Message → Webhook → [CHECK: 5 msg limit] → BLOCK after 5 messages
```

### Target State (After)
```
User Message → Webhook → [NO LIMIT] → ChatEngine → [CHECK: isActive] 
                                                           │
                                    ┌──────────────────────┴──────────────────────┐
                                    │                                             │
                                    ▼                                             ▼
                              isActive=true                                isActive=false
                                    │                                             │
                                    ▼                                             ▼
                              FULL ACCESS                              Parse Intent normally
                                                                              │
                                                                              ▼
                                                                   ┌─────────────────────┐
                                                                   │ Intent is blocked?  │
                                                                   └─────────┬───────────┘
                                                                             │
                                                           ┌─────────────────┴─────────────────┐
                                                           │                                   │
                                                           ▼                                   ▼
                                                      NO (allow)                          YES (block)
                                                           │                                   │
                                                           ▼                                   ▼
                                                    Normal Response               Registration Prompt
```

---

## 🔧 Technical Changes

### 1. Database Schema (Prisma)

**File**: `packages/database/prisma/schema.prisma`

```prisma
model Workspace {
  // ... existing fields ...
  
  // 🆕 Feature 204: Unregistered User Messages
  registrationPromptMessage       Json?    // Message when unregistered user tries blocked action
  postRegistrationPendingMessage  Json?    // Message after registration (waiting for activation)
  userActivatedMessage            Json?    // Message when admin activates user
}
```

**Migration**: `npx prisma migrate dev --name feature_204_unregistered_user_messages`

---

### 2. WhatsApp Webhook Controller

**File**: `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`

**Changes**:
1. ❌ **REMOVE** the `MAX_UNREGISTERED_MESSAGES` check (lines ~762-797)
2. ✅ **KEEP** all other checks (rate limiting, billing, etc.)

```typescript
// ❌ REMOVE THIS ENTIRE BLOCK:
// const MAX_UNREGISTERED_MESSAGES = 5
// if (customer && !customer.isActive) {
//   const unregisteredMessageCount = await prisma.conversationMessage.count(...)
//   if (unregisteredMessageCount >= MAX_UNREGISTERED_MESSAGES) {
//     // Block logic
//   }
// }
```

---

### 3. Chat Engine Service - STEP 0.02

**File**: `apps/backend/src/application/chat-engine/chat-engine.service.ts`

**Add after STEP 0.1 (Welcome Message)**:

```typescript
// ========================================================================
// STEP 0.02: Check if customer is registered (isActive)
// ========================================================================
const customer = await this.prisma.customers.findFirst({
  where: {
    id: input.customerId,
    workspaceId: input.workspaceId,
  },
  select: {
    id: true,
    isActive: true,
    language: true,
    name: true,
  },
})

const isUnregisteredUser = customer ? !customer.isActive : true

logger.info("🔐 [ChatEngine] Registration status check", {
  customerId: input.customerId,
  isActive: customer?.isActive ?? false,
  isUnregisteredUser,
})

// Pass this flag through the entire pipeline
const pipelineContext = {
  ...input,
  isUnregisteredUser,
  customerLanguage: customer?.language || "it",
  customerName: customer?.name || "Utente",
}
```

**Propagate `isUnregisteredUser` to**:
- Intent parsing (no change needed - parse normally)
- Data loading (no change needed)
- Response building (CHECK HERE)
- LLM formatting (CHECK HERE)

---

### 4. Response Builder Service

**File**: `apps/backend/src/application/response-builder/response-builder.service.ts`

**Add new blocked intents check**:

```typescript
// 🆕 Feature 204: Blocked intents for unregistered users
const REGISTRATION_REQUIRED_INTENTS = new Set([
  "VIEW_PRICES",
  "ADD_TO_CART",
  "VIEW_CART", 
  "REMOVE_FROM_CART",
  "UPDATE_CART_QUANTITY",
  "CREATE_ORDER",
  "CHECKOUT",
  "VIEW_ORDERS",
  "VIEW_ORDER_DETAILS",
  "CANCEL_ORDER",
  "ADD_SERVICE",
  "ADD_SERVICE_TO_CART",
  "CONFIRM_ORDER",
])

// In buildResponse():
if (isUnregisteredUser && REGISTRATION_REQUIRED_INTENTS.has(intent.type)) {
  return {
    type: "REGISTRATION_REQUIRED",
    data: {
      attemptedIntent: intent.type,
      registrationLink: await this.getRegistrationLink(workspaceId),
    },
  }
}
```

---

### 5. LLM Formatter Service

**File**: `apps/backend/src/application/llm-formatter/llm-formatter.service.ts`

**Add new formatter**:

```typescript
/**
 * Format registration prompt for unregistered users
 */
async formatRegistrationPrompt(
  workspaceId: string,
  customerLanguage: string,
  attemptedIntent: string,
): Promise<string> {
  // Get workspace config with registration message
  const workspace = await this.prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      registrationPromptMessage: true,
    },
  })

  // Get message in customer's language (fallback to 'it')
  const messages = workspace?.registrationPromptMessage as Record<string, string> | null
  const message = messages?.[customerLanguage] || messages?.["it"] || DEFAULT_REGISTRATION_PROMPT

  // Generate registration link
  const registrationLink = `${process.env.FRONTEND_URL}/registration?workspace=${workspaceId}`

  // Replace variables
  return message.replace("{{registrationLink}}", registrationLink)
}

const DEFAULT_REGISTRATION_PROMPT = `Per offrirti un supporto più mirato ti chiediamo di registrarti:
👉 {{registrationLink}}

Una volta registrato, il nostro staff ti personalizzerà gli sconti e ti abiliterà a questo servizio.

🔒 Privacy: I tuoi dati sono presenti nei nostri database e non verranno inviati a terzi per nessun motivo.`
```

---

### 6. Customer Controller - Activation

**File**: `apps/backend/src/interfaces/http/controllers/customers.controller.ts`

**Modify `activateCustomer()` method**:

```typescript
async activateCustomer(req: Request, res: Response) {
  // ... existing validation ...

  // Update customer
  const updatedCustomer = await prisma.customers.update({
    where: { id: customerId },
    data: {
      isActive: true,
      activeChatbot: true, // 🆕 Also enable chatbot
    },
  })

  // 🆕 Feature 204: Send activation message via WhatsApp
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      userActivatedMessage: true,
      whatsappApiKey: true,
    },
  })

  if (updatedCustomer.phone && workspace?.whatsappApiKey) {
    const messages = workspace.userActivatedMessage as Record<string, string> | null
    const language = updatedCustomer.language || "it"
    const message = messages?.[language] || messages?.["it"] || DEFAULT_ACTIVATION_MESSAGE

    const finalMessage = message.replace("{{customerName}}", updatedCustomer.name)

    // Add to WhatsApp queue
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId: updatedCustomer.id,
        phoneNumber: updatedCustomer.phone,
        message: finalMessage,
        status: "pending",
        priority: 1, // High priority
      },
    })
  }

  return res.json({ success: true, customer: updatedCustomer })
}
```

---

### 7. Seed Data

**File**: `packages/database/prisma/seed.ts`

**Add default messages to workspace creation**:

```typescript
const registrationPromptMessage = {
  it: "Per offrirti un supporto più mirato ti chiediamo di registrarti:\n👉 {{registrationLink}}\n\nUna volta registrato, il nostro staff ti personalizzerà gli sconti e ti abiliterà a questo servizio.\n\n🔒 Privacy: I tuoi dati sono presenti nei nostri database e non verranno inviati a terzi per nessun motivo.",
  en: "To offer you more personalized support, please register:\n👉 {{registrationLink}}\n\nOnce registered, our staff will customize your discounts and enable this service for you.\n\n🔒 Privacy: Your data is stored in our databases and will not be shared with third parties.",
  // ... other languages
}

const postRegistrationPendingMessage = {
  it: "Ciao {{customerName}}, abbiamo registrato i tuoi dati!\n\nTi avviseremo il prima possibile quando il nostro servizio sarà attivo per te.\nNel frattempo la chat è disattivata.\n\nGrazie per la pazienza! 🙏",
  // ... other languages
}

const userActivatedMessage = {
  it: "Ciao {{customerName}}, abbiamo attivato il tuo utente! 🎉\n\nOra posso aiutarti con:\n✅ Vedere prezzi e offerte personalizzate\n✅ Gestire il tuo carrello\n✅ Effettuare ordini\n✅ Vedere lo storico ordini\n\nCome ti posso aiutare oggi?",
  // ... other languages
}
```

---

## 📋 Implementation Checklist

### Phase 1: Database (Day 1 - Morning)
- [ ] Add 3 new fields to Workspace schema
- [ ] Create migration
- [ ] Run `npx prisma generate`
- [ ] Update seed.ts with default messages
- [ ] Test migration on dev DB

### Phase 2: Remove Blocking Logic (Day 1 - Afternoon)
- [ ] Remove MAX_UNREGISTERED_MESSAGES from webhook controller
- [ ] Verify rate limiting still works
- [ ] Unit test: webhook accepts unlimited messages for unregistered

### Phase 3: Chat Engine Check (Day 1 - End)
- [ ] Add STEP 0.02 in chat-engine.service.ts
- [ ] Load customer with isActive field
- [ ] Pass isUnregisteredUser flag through pipeline
- [ ] Unit test: flag propagation

### Phase 4: Response Builder (Day 2 - Morning)
- [ ] Define REGISTRATION_REQUIRED_INTENTS set
- [ ] Add check in buildResponse()
- [ ] Return REGISTRATION_REQUIRED type
- [ ] Unit test: each blocked intent

### Phase 5: LLM Formatter (Day 2 - Afternoon)
- [ ] Add formatRegistrationPrompt() method
- [ ] Implement multilingua support
- [ ] Handle {{registrationLink}} variable
- [ ] Unit test: each language

### Phase 6: Admin Activation (Day 2 - End)
- [ ] Modify activateCustomer() in controller
- [ ] Add WhatsApp message sending
- [ ] Integration test: activation flow

### Phase 7: Testing (Day 3)
- [ ] E2E test: unregistered user asks price → gets registration prompt
- [ ] E2E test: unregistered user asks product info → gets normal response
- [ ] E2E test: user registers → gets pending message
- [ ] E2E test: admin activates → user gets activation message
- [ ] Security test: no price leakage

### Phase 8: Documentation (Day 3)
- [ ] Update API documentation (Swagger)
- [ ] Update PRD with new flow
- [ ] Create admin guide for activation

---

## 🔐 Security Checklist

- [ ] Rate limiting still enforced for unregistered users
- [ ] Workspace isolation maintained (workspaceId in all queries)
- [ ] No price data in responses for unregistered users
- [ ] Registration links are workspace-specific
- [ ] Admin-only activation endpoint

---

## 📊 Monitoring & Alerts

### New Metrics to Add
1. `unregistered_user_blocked_action_total` - Counter by intent type
2. `unregistered_user_registration_clicks` - Conversion tracking
3. `admin_user_activation_total` - Activation count

### Alerts
1. If unregistered user sends > 100 messages/day → Alert (potential abuse)
2. If price appears in response to unregistered user → Critical alert

---

## 🔄 Rollback Plan

If issues are detected:
1. Re-enable `MAX_UNREGISTERED_MESSAGES = 5` in webhook controller
2. Remove `isUnregisteredUser` check from Response Builder
3. Revert database migration (remove 3 fields)

Migration is non-destructive (adding nullable fields), so rollback is safe.
