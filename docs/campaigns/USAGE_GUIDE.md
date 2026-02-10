# Push Campaigns Usage Guide

Step-by-step guide for creating and managing WhatsApp push campaigns.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a Campaign](#creating-a-campaign)
3. [Targeting Options](#targeting-options)
4. [Message Templates](#message-templates)
5. [Scheduling Campaigns](#scheduling-campaigns)
6. [Managing Campaigns](#managing-campaigns)
7. [Monitoring Campaign Performance](#monitoring-campaign-performance)
8. [Credit Management](#credit-management)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before creating campaigns, ensure:

1. **WhatsApp Enabled**: Your workspace has `enableWhatsapp = true`
2. **Sufficient Credit**: Owner has enough credit balance (€1.00 per message)
3. **Active Customers**: Target customers have:
   - `activeChatbot = true`
   - `push_notifications_consent = true`
   - `isBlacklisted = false`
4. **Authentication**: Valid JWT token with workspace access

---

## Creating a Campaign

### Step 1: Choose Targeting Mode

Select one of three targeting modes:

**Option A: ALL (Broadcast to all customers)**
```json
{
  "name": "Monthly Newsletter",
  "targetingType": "ALL",
  "message": "Hi {{firstName}}, here's your monthly update!",
  "frequency": "MONTHLY",
  "sendAt": "2026-03-01T10:00:00Z"
}
```

**Option B: MANUAL (Select specific customers)**
```json
{
  "name": "VIP Exclusive Offer",
  "targetingType": "MANUAL",
  "targetCustomerIds": ["customer-1", "customer-2", "customer-3"],
  "message": "Exclusive offer for {{name}}!",
  "frequency": "ONCE"
}
```

**Option C: TAGS (Filter by tag)**
```json
{
  "name": "Premium Customer Update",
  "targetingType": "TAGS",
  "tagId": "premium",
  "message": "Hi {{firstName}}, we have something special for you!",
  "frequency": "ONCE"
}
```

### Step 2: Write Message Template

Use variables to personalize messages:

```
Hello {{firstName}},

Thank you for being a valued customer of {{workspace}}!

We have exciting news to share with you.

Visit us or reply to this message for more details.

Best regards,
The {{workspace}} Team
```

### Step 3: Configure Schedule

**One-time campaign (send now)**:
```json
{
  "frequency": "ONCE",
  "sendAt": null  // Executes in next scheduler run (within 1 minute)
}
```

**One-time campaign (scheduled)**:
```json
{
  "frequency": "ONCE",
  "sendAt": "2026-03-15T14:00:00Z"
}
```

**Recurring campaign (weekly)**:
```json
{
  "frequency": "WEEKLY",
  "sendAt": "2026-03-01T09:00:00Z"  // First run
  // Subsequent runs: 2026-03-08T09:00:00Z, 2026-03-15T09:00:00Z, etc.
}
```

### Step 4: Create Campaign via API

```bash
curl -X POST \
  'http://localhost:3001/api/workspaces/workspace-123/push-campaigns' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Spring Sale Announcement",
    "targetingType": "ALL",
    "message": "Hi {{firstName}}, our spring sale starts this weekend at {{workspace}}! Reply to learn more.",
    "frequency": "ONCE",
    "sendAt": "2026-03-15T09:00:00Z",
    "throttlePerSecond": 10,
    "batchSize": 50
  }'
```

**Response**:
```json
{
  "id": "clxyz789",
  "status": "SCHEDULED",
  "expectedRecipients": 1250,
  "sendAt": "2026-03-15T09:00:00Z"
}
```

---

## Targeting Options

### ALL - Broadcast to All Customers

Sends to all customers matching these criteria:
- `isActive = true`
- `activeChatbot = true`
- `isBlacklisted = false`
- `push_notifications_consent = true`
- `deletedAt = null`

**Use Case**: General announcements, newsletters, store updates

**Example**: Monthly newsletter to all active customers

---

### MANUAL - Select Specific Customers

Manually specify customer IDs to target.

**Use Case**: Personalized messages, VIP offers, account updates

**Example**: Send exclusive offer to top 10 customers
```json
{
  "targetingType": "MANUAL",
  "targetCustomerIds": [
    "customer-abc123",
    "customer-def456",
    "customer-ghi789"
  ]
}
```

**How to get customer IDs**:
```bash
GET /api/workspaces/:workspaceId/customers?limit=100
```

---

### TAGS - Filter by Customer Tag

Target customers with a specific tag.

**Use Case**: Segment-based campaigns (e.g., "premium", "new-customers", "inactive")

**Example**: Send re-engagement message to inactive customers
```json
{
  "targetingType": "TAGS",
  "tagId": "inactive"
}
```

**How to manage tags**:
```bash
# Get customer with tags
GET /api/workspaces/:workspaceId/customers/:id

# Update customer tags
PUT /api/workspaces/:workspaceId/customers/:id
{
  "tags": ["premium", "vip", "early-access"]
}
```

---

## Message Templates

### Available Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{name}}` | Full customer name | "John Doe" |
| `{{firstName}}` | First name only | "John" |
| `{{lastName}}` | Last name only | "Doe" |
| `{{email}}` | Email address | "john@example.com" |
| `{{phone}}` | Phone number | "+1234567890" |
| `{{company}}` | Company name | "Acme Corp" |
| `{{workspace}}` | Workspace name | "My Online Store" |

### Template Examples

**Simple Announcement**:
```
Hi {{firstName}}, we have a new product launch this Friday! 🎉
```

**Personalized Offer**:
```
Hello {{name}},

As a valued customer of {{workspace}}, we're offering you an exclusive 20% discount!

Reply with code SAVE20 to claim your offer.
```

**Appointment Reminder**:
```
Hi {{firstName}},

This is a reminder about your appointment at {{workspace}} tomorrow at 2:00 PM.

If you need to reschedule, reply to this message.
```

**Newsletter**:
```
Hello {{firstName}},

Your monthly update from {{workspace}}:

📦 New arrivals: Check out our latest collection
💰 Special offers: 15% off selected items
📞 Contact us: {{phone}}

Visit our store or reply for more information!
```

### Multi-Language Support

Messages are automatically translated to each customer's preferred language.

**Original (Italian)**:
```
Ciao {{firstName}}, abbiamo un'offerta speciale per te!
```

**Customer with Spanish language**:
```
¡Hola Juan, tenemos una oferta especial para ti!
```

**Customer with English language**:
```
Hello John, we have a special offer for you!
```

**Supported Languages**: Italian (it), English (en), Spanish (es), Portuguese (pt)

---

## Scheduling Campaigns

### Send Immediately

Set `sendAt = null` or use the `/run-now` endpoint:

```bash
POST /api/workspaces/:workspaceId/push-campaigns/:id/run-now
```

Campaign executes in the next scheduler run (within 1 minute).

---

### Schedule for Future Date

Specify exact date/time in ISO 8601 format:

```json
{
  "sendAt": "2026-03-20T14:30:00Z"
}
```

**Time Zone Handling**: All times are UTC. Convert local time to UTC before scheduling.

**Example** (schedule for 2:00 PM EST on March 20):
```javascript
// EST is UTC-5
const estTime = new Date('2026-03-20T14:00:00-05:00')
const utcTime = estTime.toISOString()  // "2026-03-20T19:00:00Z"
```

---

### Recurring Campaigns

Set `frequency` to automatically repeat:

**Weekly Newsletter** (every Monday at 9:00 AM):
```json
{
  "frequency": "WEEKLY",
  "sendAt": "2026-03-03T09:00:00Z"  // First Monday
}
```

**Monthly Report** (first day of each month):
```json
{
  "frequency": "MONTHLY",
  "sendAt": "2026-04-01T10:00:00Z"
}
```

**Quarterly Check-in** (every 3 months):
```json
{
  "frequency": "QUARTERLY",
  "sendAt": "2026-04-01T09:00:00Z"
}
```

**Behavior**:
- First run at `sendAt`
- Subsequent runs calculated automatically (`nextRunAt`)
- Maintains same time of day for each run
- Continues until manually paused or credit exhausted

---

## Managing Campaigns

### Pause Campaign

Stop campaign execution (preserves progress):

```bash
POST /api/workspaces/:workspaceId/push-campaigns/:id/pause
```

**Use Cases**:
- Temporary suspension
- Credit exhausted (auto-paused by system)
- Need to update message content

---

### Resume Campaign

Restart a paused campaign:

```bash
POST /api/workspaces/:workspaceId/push-campaigns/:id/resume
```

Campaign status changes to `SCHEDULED` and will run at next `nextRunAt` time.

---

### Cancel Campaign

Permanently cancel campaign:

```bash
POST /api/workspaces/:workspaceId/push-campaigns/:id/cancel
```

Status changes to `CANCELLED`. Cannot be resumed.

---

### Update Campaign

Modify campaign details (only for `DRAFT` or `PAUSED` campaigns):

```bash
PUT /api/workspaces/:workspaceId/push-campaigns/:id
```

**Request Body**:
```json
{
  "name": "Updated Campaign Name",
  "message": "New message content",
  "sendAt": "2026-03-21T10:00:00Z"
}
```

**Limitation**: Cannot update `RUNNING` or `COMPLETED` campaigns.

---

### Delete Campaign

Soft-delete campaign:

```bash
DELETE /api/workspaces/:workspaceId/push-campaigns/:id
```

Campaign removed from list. Cannot be recovered.

---

## Monitoring Campaign Performance

### View Campaign Status

```bash
GET /api/workspaces/:workspaceId/push-campaigns/:id
```

**Response**:
```json
{
  "id": "clxyz789",
  "name": "Spring Sale",
  "status": "RUNNING",
  "expectedRecipients": 1250,
  "actualSent": 450,
  "actualSkipped": 25,
  "actualFailed": 5,
  "lastRunAt": "2026-03-15T09:05:00Z",
  "nextRunAt": null
}
```

**Status Meanings**:
- `DRAFT` - Not yet scheduled
- `SCHEDULED` - Waiting to run
- `RUNNING` - Currently processing recipients
- `PAUSED` - Temporarily stopped
- `COMPLETED` - Finished (one-time campaigns)
- `FAILED` - Error occurred
- `CANCELLED` - Manually cancelled

---

### View Recipients

List recipients with status and error details:

```bash
GET /api/workspaces/:workspaceId/push-campaigns/:id/recipients?status=SKIPPED
```

**Response**:
```json
{
  "data": [
    {
      "id": "recipient-1",
      "customerId": "customer-123",
      "phone": "+1234567890",
      "status": "SKIPPED",
      "errorCode": "OPT_OUT",
      "errorMessage": "Marketing opt-in missing",
      "priceCharged": "0.00"
    },
    {
      "id": "recipient-2",
      "customerId": "customer-456",
      "phone": "+1234567891",
      "status": "SENT",
      "sentAt": "2026-03-15T09:05:00Z",
      "messageId": "queue-msg-789",
      "priceCharged": "1.00"
    }
  ]
}
```

**Filter Options**:
- `status=PENDING` - Not yet processed
- `status=SENT` - Successfully queued
- `status=SKIPPED` - Filtered out (see errorCode)
- `status=FAILED` - Error during processing

---

### Common Skip Reasons

| Error Code | Error Message | Action |
|------------|---------------|--------|
| `BLACKLISTED` | Customer is blacklisted | Remove from blacklist or exclude |
| `CHATBOT_INACTIVE` | Chatbot is inactive for this customer | Enable chatbot for customer |
| `OPT_OUT` | Marketing opt-in missing | Request marketing consent |
| `NO_PHONE` | Missing phone | Update customer phone number |
| `NO_CUSTOMER` | Customer not found or inactive | Verify customer exists |

---

## Credit Management

### Cost Model

- **€1.00 per message** (configurable via `PlatformConfig.PUSH_CAMPAIGN`)
- Charged when message is queued (not on delivery)
- Deducted from workspace owner's `creditBalance`

### Pre-Campaign Credit Check

System validates credit BEFORE creating campaign:

```
Required Credit = Expected Recipients × Cost Per Message
```

**Example**:
- Expected recipients: 1000
- Cost per message: €1.00
- Required credit: €1000.00

If owner has €950, campaign creation fails with error:
```json
{
  "error": "Insufficient credit for campaign"
}
```

---

### During Campaign Credit Check

Scheduler checks credit BEFORE each recipient:

1. Query owner's current `creditBalance`
2. If `creditBalance < costPerMessage`:
   - Pause campaign with `status = PAUSED`
   - Set `lastError = "Insufficient credit"`
   - Stop processing

**Recovery**:
1. Top up owner's credit
2. Resume campaign: `POST /push-campaigns/:id/resume`

---

### Monitor Credit Usage

Track credit consumption via billing transactions:

```bash
GET /api/workspaces/:workspaceId/billing/transactions?type=PUSH_CAMPAIGN
```

**Response**:
```json
[
  {
    "id": "tx-123",
    "type": "PUSH_CAMPAIGN",
    "amount": "-450.00",
    "description": "Push Campaign: Spring Sale (450 messages)",
    "createdAt": "2026-03-15T09:05:00Z"
  }
]
```

---

## Best Practices

### 1. Test with Small Audience First

Before broadcasting to all customers, test with a small group:

```json
{
  "targetingType": "MANUAL",
  "targetCustomerIds": ["test-customer-1", "test-customer-2"],
  "message": "Test message {{firstName}}"
}
```

Verify message rendering, links, and tone before scaling up.

---

### 2. Respect Customer Preferences

- Only send to customers with `push_notifications_consent = true`
- Provide opt-out mechanism in messages
- Segment campaigns by customer interest (use TAGS)

---

### 3. Optimize Send Times

Schedule campaigns when customers are most likely to engage:

- **B2C Retail**: Evenings (6-9 PM) and weekends
- **B2B Services**: Weekday mornings (9-11 AM)
- **Restaurants**: Lunch (11 AM-1 PM) and dinner (5-7 PM)

Avoid late nights and holidays.

---

### 4. Personalize Messages

Use variables to make messages feel personal:

❌ **Generic**:
```
Hello customer, we have a sale!
```

✅ **Personalized**:
```
Hi {{firstName}}, as a valued customer of {{workspace}}, we're offering you an exclusive discount!
```

---

### 5. Keep Messages Concise

WhatsApp is best for short, actionable messages:

- **Ideal length**: 1-3 sentences
- **Clear call-to-action**: "Reply YES", "Visit our store", "Click the link"
- **Avoid**: Long paragraphs, complex formatting

---

### 6. Monitor Performance

Track campaign metrics:
- **Delivery rate**: `actualSent / expectedRecipients`
- **Skip rate**: `actualSkipped / expectedRecipients`
- **Error rate**: `actualFailed / expectedRecipients`

High skip rates indicate targeting issues (blacklists, opt-outs).

---

### 7. Manage Recurring Campaigns

- Set reminders to review recurring campaigns monthly
- Pause campaigns during holidays or low-activity periods
- Update message content periodically to keep fresh

---

### 8. Rate Limiting

For large campaigns (10,000+ recipients):
- Reduce `throttlePerSecond` to avoid provider limits
- Increase `batchSize` if scheduler runs too frequently
- Monitor WhatsApp API rate limits

**Example** (slow and steady):
```json
{
  "throttlePerSecond": 5,
  "batchSize": 100
}
```

---

## Troubleshooting

### Campaign Not Sending

**Symptom**: Campaign status stuck at `SCHEDULED`, no messages sent.

**Checks**:
1. Verify `isActive = true`:
   ```bash
   GET /api/workspaces/:workspaceId/push-campaigns/:id
   ```
2. Check `sendAt` or `nextRunAt` is in the past
3. Confirm scheduler is running:
   ```bash
   npm run dev:scheduler
   ```
4. Review scheduler logs:
   ```bash
   tail -f apps/scheduler/logs/combined.log
   ```

---

### All Recipients Skipped

**Symptom**: `actualSkipped = expectedRecipients`, no messages sent.

**Checks**:
1. List recipients with errors:
   ```bash
   GET /push-campaigns/:id/recipients?status=SKIPPED
   ```
2. Review common skip reasons:
   - `OPT_OUT`: Customers need marketing consent
   - `BLACKLISTED`: Remove from blacklist or change targeting
   - `CHATBOT_INACTIVE`: Enable chatbot for customers

**Fix**: Update customer settings or change targeting criteria.

---

### Credit Exhausted

**Symptom**: Campaign paused with `lastError = "Insufficient credit"`.

**Resolution**:
1. Top up owner's credit balance
2. Resume campaign:
   ```bash
   POST /push-campaigns/:id/resume
   ```
3. Campaign continues from where it stopped

---

### Messages Not Translated

**Symptom**: All messages sent in Italian regardless of customer language.

**Checks**:
1. Verify customer has `language` field set:
   ```bash
   GET /api/workspaces/:workspaceId/customers/:id
   ```
2. Check translation service logs for errors
3. Ensure supported language: `it`, `en`, `es`, `pt`

**Fallback**: If translation fails, original message is sent.

---

### Recurring Campaign Not Repeating

**Symptom**: Campaign runs once but doesn't schedule next run.

**Checks**:
1. Verify `frequency != ONCE`
2. Check `nextRunAt` is populated:
   ```bash
   GET /push-campaigns/:id
   ```
3. Confirm campaign not manually paused

**Fix**: If `nextRunAt = null`, update campaign:
```bash
PUT /push-campaigns/:id
{
  "frequency": "WEEKLY",
  "sendAt": "2026-03-22T09:00:00Z"
}
```

---

### High Failure Rate

**Symptom**: Many recipients with `status = FAILED`.

**Checks**:
1. List failed recipients:
   ```bash
   GET /push-campaigns/:id/recipients?status=FAILED
   ```
2. Review `errorMessage` for patterns
3. Check WhatsApp API logs
4. Verify phone number formats

**Common Causes**:
- Invalid phone numbers
- WhatsApp API rate limits exceeded
- Provider service outage

---

## Need Help?

- **API Documentation**: See [API_REFERENCE.md](./API_REFERENCE.md)
- **System Overview**: See [README.md](./README.md)
- **Support**: Contact platform administrator
- **Logs**: Check `apps/scheduler/logs/` for detailed error messages
