# Registration Status System

## Overview

eChatbot implements a 3-state registration system for customer management. This allows workspace owners to control whether new customers are automatically activated or require manual approval.

## Registration States

| Status | Description | Customer Experience |
|--------|-------------|---------------------|
| `NEW` | Customer has never registered | Sees `[LINK_REGISTRATION]` link in messages |
| `PENDING_APPROVAL` | Customer registered, awaiting admin | Sees "⏳ La tua registrazione è in attesa di approvazione. Ti contatteremo presto!" |
| `ACTIVE` | Fully activated customer | Registration link is removed from messages |

## Workspace Settings

### `requireManualApproval`

- **Type**: Boolean
- **Default**: `false`
- **Location**: Settings → Business Configuration

When enabled:
- New customers go to `PENDING_APPROVAL` status after registration
- Admin must manually activate them from the Customers page
- Welcome/after-registration messages are NOT sent until activation
- Customer sees "awaiting approval" message instead of registration link

When disabled (default):
- New customers are automatically `ACTIVE` after registration
- Welcome/after-registration messages are sent immediately
- No admin intervention required

### `registrationPage`

- **Type**: String (optional)
- **Location**: Settings → Business Configuration

Custom URL for the registration page. When set:
- `[LINK_REGISTRATION]` token uses this URL instead of default `/registration`
- Supports full URLs (https://mystore.com/join-us) or relative paths (/custom-register)
- Token parameter is automatically appended (?token=xxx or &token=xxx)

## Database Schema

```prisma
// In Customers model
registrationStatus RegistrationStatus @default(NEW)
isActive           Boolean            @default(false)

// In Workspace model
requireManualApproval Boolean @default(false)
registrationPage      String? @db.Text

// Enum
enum RegistrationStatus {
  NEW              // Default: customer has never registered
  PENDING_APPROVAL // Customer completed registration form, awaiting admin approval
  ACTIVE           // Admin approved, customer has full access
}
```

## Registration Flow

### Auto-Activation Flow (requireManualApproval = false)

```
1. Customer receives [LINK_REGISTRATION] in chat
2. Customer clicks link and fills registration form
3. System creates/updates customer with:
   - isActive = true
   - registrationStatus = "ACTIVE"
4. After-registration message sent immediately
5. Customer has full access
```

### Manual Approval Flow (requireManualApproval = true)

```
1. Customer receives [LINK_REGISTRATION] in chat
2. Customer clicks link and fills registration form
3. System creates/updates customer with:
   - isActive = false
   - registrationStatus = "PENDING_APPROVAL"
4. After-registration message NOT sent (pending approval)
5. Customer sees "awaiting approval" message in chat
6. Admin approves customer from Customers page
7. Customer is updated to:
   - isActive = true
   - registrationStatus = "ACTIVE"
8. Welcome message can now be sent
```

## API Response

Registration endpoint returns different responses based on activation status:

### Auto-Activated Response
```json
{
  "success": true,
  "customer": {
    "id": "cust-123",
    "name": "Mario Rossi",
    "phone": "+393331234567",
    "registrationStatus": "ACTIVE"
  },
  "message": "Registration successful",
  "requiresApproval": false
}
```

### Pending Approval Response
```json
{
  "success": true,
  "customer": {
    "id": "cust-456",
    "name": "Luigi Verdi",
    "phone": "+393339876543",
    "registrationStatus": "PENDING_APPROVAL"
  },
  "message": "Registration submitted - awaiting admin approval",
  "requiresApproval": true
}
```

## Link Replacement Behavior

The `LinkReplacementService` handles `[LINK_REGISTRATION]` token based on customer status:

| Customer Status | Token Replacement |
|-----------------|-------------------|
| `NEW` or undefined | Generate registration link with JWT token |
| `PENDING_APPROVAL` | Replace with pending approval message |
| `ACTIVE` or `isActive=true` | Remove token entirely |

## Backward Compatibility

For legacy customers without `registrationStatus` field:
- `isActive = true` is treated as `ACTIVE`
- `isActive = false` with no status is treated as `NEW`

## Testing

Run tests for this feature:

```bash
# Registration status unit tests
npm run test:unit -- --testPathPattern="registration-status"

# Link replacement with registration status
npm run test:unit -- --testPathPattern="link-replacement.service"
```

## Files Modified

- `packages/database/prisma/schema.prisma` - Added `RegistrationStatus` enum and fields
- `apps/backend/src/interfaces/http/controllers/registration.controller.ts` - Updated registration logic
- `apps/backend/src/application/services/link-replacement.service.ts` - 3-state token handling
- `apps/frontend/src/components/settings/sections/BusinessConfigSection.tsx` - Added settings UI
- `apps/frontend/src/pages/SettingsPage.tsx` - Added form handling
- `apps/frontend/src/components/settings/HelpPanel.tsx` - Added documentation
