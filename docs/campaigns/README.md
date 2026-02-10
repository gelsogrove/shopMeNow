# Push Campaigns System

## Overview

The Push Campaigns system enables workspace administrators to send scheduled or recurring WhatsApp promotional messages to targeted customer segments. The system supports multiple targeting modes, automatic credit management, variable replacement, and multi-language translation.

## Key Features

### 1. Targeting Modes

The system supports three targeting types:

- **ALL**: Send to all active customers with chatbot enabled and marketing consent
- **MANUAL**: Manually select specific customer IDs
- **TAGS**: Target customers by tag (single tag per campaign)

### 2. Campaign Frequency

Campaigns can be scheduled with the following frequencies:

- **ONCE**: Single execution (one-time send)
- **WEEKLY**: Repeats every 7 days
- **MONTHLY**: Repeats every month
- **QUARTERLY**: Repeats every 3 months
- **SEMIANNUAL**: Repeats every 6 months

Recurring campaigns automatically calculate `nextRunAt` based on the last execution time, maintaining the same time of day for each run.

### 3. Campaign Status Lifecycle

```
DRAFT → SCHEDULED → RUNNING → COMPLETED/SCHEDULED (for recurring)
         ↓            ↓
       PAUSED      FAILED
         ↓            ↓
       CANCELLED   PAUSED (credit exhausted)
```

**Status Definitions**:
- **DRAFT**: Campaign created but not scheduled
- **SCHEDULED**: Waiting to run at `sendAt` or `nextRunAt` time
- **RUNNING**: Currently processing recipients
- **PAUSED**: Manually paused or auto-paused due to insufficient credit
- **COMPLETED**: Finished (for ONCE frequency)
- **FAILED**: Execution error
- **CANCELLED**: Manually cancelled by admin

### 4. Recipient Filtering

All campaigns automatically filter recipients to ensure compliance and quality:

**Inclusion Criteria** (ALL must be true):
- `isActive = true` - Active customers only
- `activeChatbot = true` - Chatbot must be enabled
- `isBlacklisted = false` - Not blacklisted
- `push_notifications_consent = true` - Marketing consent given
- `deletedAt = null` - Not soft-deleted

**Recipients are SKIPPED if**:
- Missing phone number
- Blacklisted (`isBlacklisted = true`)
- Chatbot inactive (`activeChatbot = false`)
- Missing marketing consent (`push_notifications_consent = false`)
- Customer not found or inactive

### 5. Credit Management

The system implements owner-based credit management with automatic protection:

**Cost Model**:
- Default cost: €1.00 per message (configurable via `PlatformConfig.PUSH_CAMPAIGN`)
- Credit deducted from workspace owner's `creditBalance`
- Charged immediately when message is queued (not on delivery)

**Credit Check**:
- Performed before campaign creation (estimated cost validation)
- Checked before EACH recipient in scheduler job
- If insufficient credit: campaign automatically paused with status `PAUSED` and `lastError = "Insufficient credit"`

**No Safety Margin**: The system checks exact cost per message without additional buffer.

### 6. Message Processing

**Variable Replacement**:
Messages support the following variables:
- `{{name}}` - Customer full name
- `{{firstName}}` - First name only
- `{{lastName}}` - Last name only
- `{{email}}` - Customer email
- `{{phone}}` - Customer phone
- `{{company}}` - Customer company
- `{{workspace}}` - Workspace name

**Multi-Language Translation**:
- Messages automatically translated to customer's preferred language (`customer.language`)
- Supported languages: Italian (it), English (en), Spanish (es), Portuguese (pt)
- Default language: Italian
- Uses LLM-based translation service

**Example**:
```
Input: "Ciao {{firstName}}, abbiamo una nuova offerta per te!"
Customer Language: Spanish
Output: "¡Hola Juan, tenemos una nueva oferta para ti!"
```

### 7. Scheduler Integration

The push campaigns scheduler runs **every minute** (cron: `0 * * * * *`).

**Execution Flow**:
1. Find campaigns with `status = SCHEDULED`, `isActive = true`, and (`sendAt <= now` OR `nextRunAt <= now`)
2. For each campaign:
   - Validate workspace has WhatsApp enabled
   - Repopulate recipients if needed (for dynamic targeting)
   - Set status to `RUNNING`
   - Process recipients in batches (controlled by `batchSize` and `throttlePerSecond`)
   - For each recipient:
     - Validate customer exists and meets criteria
     - Check owner credit balance
     - Build message with variable replacement
     - Translate message to customer's language
     - Enqueue to `whatsapp_queue`
     - Debit credit from owner
     - Update recipient status to `SENT`
   - If credit exhausted: pause campaign with `status = PAUSED`
   - If all recipients processed: calculate `nextRunAt` for recurring campaigns or mark `COMPLETED`

**Batch Control**:
- `batchSize`: Maximum recipients to process per job run (default: 50)
- `throttlePerSecond`: Rate limit per second (default: 10)
- Actual batch size per run: `min(batchSize, throttlePerSecond)`

### 8. Recipient Status Tracking

Each recipient has a status in the `PushCampaignRecipient` table:

- **PENDING**: Waiting to be processed
- **SENT**: Successfully queued to WhatsApp
- **SKIPPED**: Filtered out (blacklisted, no consent, etc.)
- **FAILED**: Error during processing

Each recipient record includes:
- `errorCode` and `errorMessage` for failures/skips
- `sentAt` timestamp
- `messageId` reference to `whatsapp_queue` record
- `priceCharged` amount debited

## Database Schema

### PushCampaign Model

```typescript
{
  id: string                      // Campaign ID (cuid)
  workspaceId: string            // Owner workspace
  createdByUserId: string        // Creator user ID
  name: string                   // Campaign title
  status: PushCampaignStatus     // Current status
  channel: PushCampaignChannel   // Always WHATSAPP
  frequency: CampaignFrequency   // ONCE, WEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL
  isActive: boolean              // Active flag (default: true)

  // Targeting
  targetingType: CampaignTargetType  // ALL, MANUAL, TAGS
  targetCustomerIds: string[]    // For MANUAL mode
  tagId: string                  // For TAGS mode

  // Message
  message: string                // Message template with variables
  mediaUrl: string               // Optional media attachment

  // Scheduling
  sendAt: DateTime               // First run time
  nextRunAt: DateTime            // Calculated next run (recurring)
  lastRunAt: DateTime            // Last execution timestamp

  // Metrics
  expectedRecipients: int        // Estimated recipient count
  actualSent: int                // Successfully sent count
  actualFailed: int              // Failed count
  actualSkipped: int             // Skipped count

  // Billing
  costPerMessage: Decimal        // Cost per message (default: 1.00)
  billingStatus: PushCampaignBillingStatus

  // Control
  throttlePerSecond: int         // Rate limit (default: 10)
  batchSize: int                 // Batch size (default: 50)
  lastError: string              // Last error message

  // Audit
  createdAt: DateTime
  updatedAt: DateTime
}
```

### PushCampaignRecipient Model

```typescript
{
  id: string                         // Recipient ID
  campaignId: string                // Parent campaign
  workspaceId: string               // Workspace (for isolation)
  customerId: string                // Customer reference
  phone: string                     // Phone number
  status: PushCampaignRecipientStatus  // PENDING, SENT, SKIPPED, FAILED

  // Error tracking
  errorCode: string                 // Error code if failed/skipped
  errorMessage: string              // Human-readable error

  // Delivery tracking
  sentAt: DateTime                  // When queued to WhatsApp
  messageId: string                 // Reference to whatsapp_queue record
  priceCharged: Decimal             // Amount debited

  // Filters (denormalized for reporting)
  isBlacklisted: boolean
  isBlocked: boolean
  isFake: boolean
  optOutAt: DateTime

  createdAt: DateTime
  updatedAt: DateTime
}
```

## API Endpoints

See [API_REFERENCE.md](./API_REFERENCE.md) for complete endpoint documentation with request/response examples.

**Quick Reference**:
- `GET /api/workspaces/:workspaceId/push-campaigns` - List campaigns
- `POST /api/workspaces/:workspaceId/push-campaigns` - Create campaign
- `GET /api/workspaces/:workspaceId/push-campaigns/:id` - Get campaign details
- `PUT /api/workspaces/:workspaceId/push-campaigns/:id` - Update campaign
- `DELETE /api/workspaces/:workspaceId/push-campaigns/:id` - Delete campaign
- `POST /api/workspaces/:workspaceId/push-campaigns/:id/schedule` - Schedule campaign
- `POST /api/workspaces/:workspaceId/push-campaigns/:id/run-now` - Run immediately
- `POST /api/workspaces/:workspaceId/push-campaigns/:id/pause` - Pause campaign
- `POST /api/workspaces/:workspaceId/push-campaigns/:id/resume` - Resume campaign
- `POST /api/workspaces/:workspaceId/push-campaigns/:id/cancel` - Cancel campaign
- `GET /api/workspaces/:workspaceId/push-campaigns/:id/recipients` - List recipients

## Usage Guide

See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for step-by-step instructions on creating and managing campaigns.

## Security & Compliance

### Workspace Isolation
All queries filtered by `workspaceId` to ensure multi-tenant security.

### RBAC
- Campaign creation requires `authMiddleware` + workspace access
- Only workspace owner/admin can create campaigns
- Trial workspaces require `checkTrialValid` middleware

### Opt-Out Enforcement
- Automatic skip for customers without `push_notifications_consent = true`
- Blacklisted customers automatically excluded
- Inactive chatbots filtered out

### Rate Limiting
- Per-workspace throttling via `throttlePerSecond`
- Global batch size limit via `batchSize`
- Scheduler processes campaigns sequentially to prevent overload

### Credit Integrity
- Transaction-based billing (credit debit + queue creation)
- No negative balance: campaigns auto-pause when credit exhausted
- Owner-level billing (shared across all owner's workspaces)

### Audit Trail
- All campaigns track creator (`createdByUserId`)
- Recipient records include timestamps and error details
- Campaign status changes logged via `lastError` field

## Testing

**Unit Tests**: `apps/backend/__tests__/unit/push-campaign.service.spec.ts`
**Scheduler Tests**: `apps/scheduler/__tests__/push-campaigns.job.spec.ts`

**Test Coverage**:
- Campaign creation with all targeting modes
- Credit check validation
- Recipient filtering logic
- Variable replacement
- Translation service integration
- Scheduler execution flow
- Credit exhaustion handling
- Recurring campaign `nextRunAt` calculation

## Performance Considerations

**Batch Processing**:
- Default batch size: 50 recipients per minute
- Configurable per campaign via `batchSize` and `throttlePerSecond`
- Large campaigns (1000+ recipients) spread across multiple scheduler runs

**Database Queries**:
- Indexed on: `workspaceId`, `status`, `sendAt`, `nextRunAt`
- Recipient queries paginated (50 per page)

**Credit Checks**:
- Inline credit validation (no separate service call)
- Performed once per recipient during processing
- No safety margin checks (exact cost validation)

## Limitations

**Current Limitations**:
- ❌ CSV upload targeting not yet implemented
- ❌ Multi-tag targeting (only single tag supported)
- ❌ A/B testing or split variants
- ❌ Campaign analytics dashboard
- ❌ WhatsApp template message support (only text messages)
- ❌ Scheduled pause/resume (campaigns run until manually paused or credit exhausted)

**Future Enhancements**:
- CSV file upload for phone number lists
- Rich media support (images, videos, documents)
- Campaign performance analytics (open rates, click rates)
- Template message integration with WhatsApp Business API
- Advanced scheduling (time zone support, specific days of week)
- Campaign cloning and templates

## Troubleshooting

**Campaign Not Sending**:
1. Check `isActive = true`
2. Verify `status = SCHEDULED`
3. Confirm `sendAt` or `nextRunAt` is in the past
4. Check workspace has `enableWhatsapp = true`
5. Verify owner has sufficient `creditBalance`

**Recipients Skipped**:
1. Review recipient `errorCode` and `errorMessage`
2. Verify customers have `push_notifications_consent = true`
3. Check customers are not blacklisted
4. Confirm chatbot is active for customers

**Credit Exhausted**:
1. Campaign automatically paused with `status = PAUSED`
2. Check `lastError = "Insufficient credit"`
3. Top up owner's credit balance
4. Resume campaign via `POST /push-campaigns/:id/resume`

**Scheduler Not Running**:
1. Verify scheduler service is running: `npm run dev:scheduler`
2. Check logs: `apps/scheduler/logs/`
3. Confirm cron schedule: runs every minute (`0 * * * * *`)

## Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Usage Guide](./USAGE_GUIDE.md) - Step-by-step campaign creation guide
- [Backend Architecture](../memory-bank/03-architecture/backend.md) - System design
- [Billing System](../memory-bank/02-features/feature-198-owner-billing.md) - Credit management
