# Wizard Flow - Simplified 7 Steps (Andrea's Requirements)

## Overview
New simplified channel creation wizard reduced from 8 to 7 steps, with smart conditional logic and auto-filled fields from user profile.

## Step-by-Step Flow

### Step 1: Channel Type & Name
**What we ask:**
- Channel name (alias)
- Channel type: WhatsApp or Widget
- WhatsApp number (only if WhatsApp selected)

**Logic:**
- If Widget selected → `sellsProductsAndServices` automatically set to `false`
- If WhatsApp selected → WhatsApp number is **required**
- If Widget selected → WhatsApp number is **not required**

**Smart FAQs:**
- When user selects **WhatsApp** → Auto-load E-commerce FAQs (delivery, refund, hours, payment)
- When user selects **Widget** → Auto-load Support FAQs (services, hours, contact, consultations)

---

### Step 2: E-commerce (Conditional)
**What we ask:**
- "Do you sell products or services through this channel?"

**Visibility:**
- ✅ **Shown**: Only for WhatsApp channels
- ❌ **Hidden**: Widget channels (automatically `sellsProductsAndServices = false`)

**Logic:**
- If user answers "Yes" → Step 3 (Sales Team) will be shown
- If user answers "No" → Step 3 (Sales Team) will be **skipped**

---

### Step 3: Sales Team (Conditional)
**What we ask:**
- "Do you have sales agents or team members who manage orders?"

**Visibility:**
- ✅ **Shown**: Only if `sellsProductsAndServices = true` (from Step 2)
- ❌ **Hidden**: If `sellsProductsAndServices = false` OR Widget channel

**Logic:**
- This step is only relevant for e-commerce channels with products/services
- Widget channels never see this step

---

### Step 4: Human Support
**What we ask:**
- "Do you offer human support alongside the bot?"

**Visibility:**
- ✅ **Always shown** (both WhatsApp and Widget)

**Logic:**
- If user answers "Yes" → Escalation workflows will be available
- If user answers "No" → Bot handles everything autonomously

---

### Step 5: AUTO - Operator Contact (Auto-Filled)
**What we ask:**
- Nothing! This step is **auto-filled** from user profile

**Auto-Filled Fields:**
- `adminEmail` → Extracted from JWT token (`decoded.email`)
- `operatorEmail` → Same as `adminEmail` (from token)
- `operatorContactMethod` → Always `'email'` (Andrea's requirement)

**Why This Step?**
- Andrea's requirement: "AUTO - use email/phone from user profile"
- Reduces friction: user doesn't need to re-enter their contact info
- Security: Email comes from authenticated token (no user input)

---

### Step 6: Tone of Voice
**What we ask:**
- "Choose the tone of voice for your bot" (dropdown or radio buttons)

**Options:**
- Formal
- Friendly
- Professional
- Casual

**Logic:**
- This affects LLM prompt generation
- Stored in `toneOfVoice` field

---

### Step 7: Bot Identity
**What we ask:**
- "Describe your bot's identity" (text area)

**Examples:**
- "You are Lucia, a helpful assistant for our e-commerce store..."
- "You are Marco, a technical support specialist..."

**Logic:**
- This becomes the system prompt for the LLM
- Stored in `botIdentityResponse` field
- **Required field** (cannot proceed without this)

---

### Step 8: FAQs (Smart Suggestions)
**What we ask:**
- "Add frequently asked questions"

**Smart FAQ System:**
1. **Default FAQs** (auto-loaded based on channel type):
   - **WhatsApp E-commerce**:
     - "How long does it take to receive the order?"
     - "What is your refund policy?"
     - "What are your business hours?"
     - "What payment methods do you accept?"
   
   - **Widget Support**:
     - "What services do you offer?"
     - "What are your business hours?"
     - "How can I contact support?"
     - "Do you offer consultations?"

2. **Add FAQ Button** (intelligent suggestions):
   - Click "Add FAQ" → System suggests next relevant question
   - **WhatsApp E-commerce suggestions** (8 total):
     - "What products do you have available?"
     - "Do you ship internationally?"
     - "Can I track my order?"
     - "What is the minimum order amount?"
     - "Can I modify my order after placing it?"
     - "Do you offer gift wrapping?"
     - "Are there additional shipping costs?"
     - "Do you have a loyalty program?"
   
   - **Widget Support suggestions** (6 total):
     - "What types of services do you offer?"
     - "What are your pricing rates?"
     - "How can I schedule an appointment?"
     - "What is your response time?"
     - "Do you offer remote assistance?"
     - "What languages do you support?"

3. **Suggestion Logic**:
   - System tracks which questions are already used
   - Each click on "Add FAQ" suggests the next unused question
   - If all suggestions are used → Adds empty FAQ field
   - User can always edit/delete any FAQ

**Info Banner:**
- "You can edit these FAQs anytime after creating your channel in the Settings page"

---

## Wizard Navigation Logic

### Next Step Logic
```typescript
function getNextStep(currentStep: number): number {
  // Step 1 → Step 2 (or skip to Step 4 if Widget)
  if (currentStep === 1 && channelType === 'WIDGET') {
    return 4 // Skip Step 2 and 3 for Widget
  }
  
  // Step 2 → Step 3 (or skip to Step 4 if no e-commerce)
  if (currentStep === 2 && !sellsProductsAndServices) {
    return 4 // Skip Step 3 if no products/services
  }
  
  // All other steps → Next step
  return currentStep + 1
}
```

### Previous Step Logic
```typescript
function getPrevStep(currentStep: number): number {
  // Step 4 → Step 1 (if Widget - skipped Step 2 and 3)
  if (currentStep === 4 && channelType === 'WIDGET') {
    return 1
  }
  
  // Step 4 → Step 2 (if no e-commerce - skipped Step 3)
  if (currentStep === 4 && !sellsProductsAndServices) {
    return 2
  }
  
  // All other steps → Previous step
  return currentStep - 1
}
```

---

## Validation Rules

### Step 1 Validation
```typescript
- alias: REQUIRED (min 3 characters)
- channelType: REQUIRED ('WHATSAPP' or 'WIDGET')
- whatsappNumber: REQUIRED IF channelType === 'WHATSAPP'
```

### Step 2 Validation
```typescript
- sellsProductsAndServices: REQUIRED (boolean)
- Only shown for WhatsApp channels
```

### Step 3 Validation
```typescript
- hasSalesAgents: REQUIRED (boolean)
- Only shown if sellsProductsAndServices === true
```

### Step 4 Validation
```typescript
- hasHumanSupport: REQUIRED (boolean)
```

### Step 5 Validation
```typescript
- None (auto-filled from token)
```

### Step 6 Validation
```typescript
- toneOfVoice: REQUIRED (string)
```

### Step 7 Validation
```typescript
- botIdentityResponse: REQUIRED (min 10 characters)
```

### Step 8 Validation
```typescript
- faqs: OPTIONAL (array of { question, answer })
- If provided: both question and answer MUST be non-empty
- Empty FAQs are filtered out before submission
```

---

## Backend Data Structure

### Workspace Creation Payload
```typescript
{
  name: string,               // From Step 1 (alias)
  channelType: 'WHATSAPP' | 'WIDGET',  // From Step 1
  whatsappPhoneNumber?: string,        // From Step 1 (if WhatsApp)
  sellsProductsAndServices: boolean,   // From Step 2 (or auto false if Widget)
  hasSalesAgents?: boolean,            // From Step 3 (if e-commerce)
  hasHumanSupport: boolean,            // From Step 4
  adminEmail: string,                  // AUTO from token
  operatorEmail: string,               // AUTO from token
  operatorContactMethod: 'email',      // ALWAYS email
  toneOfVoice: string,                 // From Step 6
  botIdentityResponse: string,         // From Step 7
  faqs?: Array<{                       // From Step 8
    question: string,
    answer: string
  }>
}
```

---

## Database Schema Changes

### New Fields in Workspace Model
```prisma
model Workspace {
  // ... existing fields
  channelType        ChannelType @default(WHATSAPP)  // NEW
  operatorEmail      String?                         // NEW
  // ... rest
}

enum ChannelType {
  WHATSAPP
  TELEGRAM
  MESSENGER
  LINE
  WIDGET  // NEW
}
```

---

## User Experience Flow

### WhatsApp E-commerce Channel
```
Step 1: Channel Type (WhatsApp) + Name + Phone → FAQs auto-load (e-commerce)
  ↓
Step 2: E-commerce? → Yes
  ↓
Step 3: Sales Team? → Yes/No
  ↓
Step 4: Human Support? → Yes/No
  ↓
Step 5: (AUTO - operator email from token)
  ↓
Step 6: Tone of Voice → Friendly
  ↓
Step 7: Bot Identity → "You are Lucia..."
  ↓
Step 8: FAQs → Edit defaults + Add more from suggestions
  ↓
✅ Workspace Created
```

### Widget Support-Only Channel
```
Step 1: Channel Type (Widget) + Name → FAQs auto-load (support)
  ↓
(Skip Step 2 - E-commerce automatically false)
  ↓
(Skip Step 3 - Sales Team not relevant)
  ↓
Step 4: Human Support? → Yes/No
  ↓
Step 5: (AUTO - operator email from token)
  ↓
Step 6: Tone of Voice → Professional
  ↓
Step 7: Bot Identity → "You are Marco..."
  ↓
Step 8: FAQs → Edit defaults + Add more from suggestions
  ↓
✅ Workspace Created
```

---

## Migration Notes

### Production Deployment
1. Run migration SQL:
   ```bash
   psql $DATABASE_URL -f packages/database/prisma/migrations/20260115_add_channel_type_wizard.sql
   ```

2. Existing workspaces will have:
   - `channelType = 'WHATSAPP'` (default)
   - `operatorEmail = NULL`

3. Users can update these fields via Settings page

---

## Testing Checklist

- [ ] Create WhatsApp channel with e-commerce enabled
- [ ] Create WhatsApp channel with e-commerce disabled
- [ ] Create Widget channel (verify e-commerce step is skipped)
- [ ] Verify WhatsApp number is required for WhatsApp channels
- [ ] Verify WhatsApp number is NOT required for Widget channels
- [ ] Test FAQ auto-switch when changing channel type
- [ ] Test Add FAQ button (verify intelligent suggestions)
- [ ] Verify operator email is auto-filled from token
- [ ] Test wizard navigation (next/prev with skip logic)
- [ ] Verify FAQs with empty answers are filtered out

---

## Files Modified

### Frontend
- `apps/frontend/src/pages/WorkspaceSelectionPage.tsx` (2176 lines)
  - WizardFormData interface updated
  - WIZARD_STEPS reduced to 7
  - Smart FAQ functions added (getDefaultFAQs, getAdditionalFAQSuggestions)
  - Wizard navigation logic with skip conditions
  - Step 1 UI with channel type selection
  - Step 8 UI with intelligent Add FAQ button

### Backend
- `apps/backend/src/application/services/workspace.service.ts`
  - CreateWorkspaceData interface updated (channelType, operatorEmail)
  - UpdateWorkspaceData interface updated
  - All query selects updated

- `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`
  - Serialization updated (channelType, operatorEmail in responses)

### Database
- `packages/database/prisma/schema.prisma`
  - ChannelType enum: added WIDGET
  - Workspace model: added channelType, operatorEmail

- `packages/database/prisma/migrations/20260115_add_channel_type_wizard.sql`
  - Migration script for production

---

## Future Enhancements

### Potential Improvements
1. **FAQ Templates Library**: Pre-built FAQ sets by industry (retail, services, healthcare)
2. **Multi-language FAQs**: Auto-translate FAQs based on customer language
3. **FAQ Analytics**: Track which FAQs are most frequently triggered
4. **AI-Generated FAQ Answers**: Use LLM to suggest answers based on question
5. **Widget Customization**: Color themes, position, greeting message
6. **WhatsApp Template Messages**: Pre-approved business templates

---

## Support & Troubleshooting

### Common Issues
- **"WhatsApp number required"**: User selected WhatsApp but didn't enter phone number
- **"FAQs not saving"**: Check that both question AND answer are non-empty
- **"Widget can't sell products"**: This is by design - Widgets are support-only
- **"Operator email not set"**: Token expired or user not authenticated

### Debug Tips
- Check browser console for validation errors
- Verify JWT token contains `email` field
- Check backend logs for workspace creation errors
- Verify migration ran successfully (check `channelType` column exists)
