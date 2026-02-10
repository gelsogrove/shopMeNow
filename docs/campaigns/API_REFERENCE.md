# Push Campaigns API Reference

Complete API documentation for the Push Campaigns system.

## Base URL

```
http://localhost:3001/api/workspaces/:workspaceId/push-campaigns
```

All endpoints require authentication via `Authorization: Bearer <token>` header.

## Authentication

All endpoints require:
- `authMiddleware` - Valid JWT token in `Authorization` header
- Workspace access validation via `workspaceId` parameter

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints

### 1. List Campaigns

Retrieve all campaigns for a workspace.

**Endpoint**: `GET /api/workspaces/:workspaceId/push-campaigns`

**Parameters**:
- `workspaceId` (path, required) - Workspace ID

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "clxyz123",
      "workspaceId": "workspace-123",
      "createdByUserId": "user-456",
      "name": "Spring Sale 2026",
      "status": "SCHEDULED",
      "channel": "WHATSAPP",
      "frequency": "ONCE",
      "isActive": true,
      "targetingType": "ALL",
      "targetCustomerIds": [],
      "tagId": null,
      "message": "Hello {{firstName}}, check out our spring sale!",
      "sendAt": "2026-03-01T10:00:00Z",
      "nextRunAt": null,
      "lastRunAt": null,
      "expectedRecipients": 1250,
      "actualSent": 0,
      "actualFailed": 0,
      "actualSkipped": 0,
      "costPerMessage": "1.00",
      "throttlePerSecond": 10,
      "batchSize": 50,
      "createdAt": "2026-02-10T14:30:00Z",
      "updatedAt": "2026-02-10T14:30:00Z"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request` - WhatsApp not enabled for workspace
- `401 Unauthorized` - Missing or invalid auth token
- `403 Forbidden` - No access to workspace

---

### 2. Get Campaign

Retrieve a single campaign by ID.

**Endpoint**: `GET /api/workspaces/:workspaceId/push-campaigns/:id`

**Parameters**:
- `workspaceId` (path, required) - Workspace ID
- `id` (path, required) - Campaign ID

**Response**: `200 OK`
```json
{
  "id": "clxyz123",
  "workspaceId": "workspace-123",
  "name": "Spring Sale 2026",
  "status": "RUNNING",
  "frequency": "ONCE",
  "targetingType": "TAGS",
  "tagId": "vip-customers",
  "message": "Exclusive offer for {{name}}!",
  "sendAt": "2026-03-01T10:00:00Z",
  "lastRunAt": "2026-03-01T10:00:30Z",
  "actualSent": 45,
  "actualSkipped": 5,
  "costPerMessage": "1.00",
  "createdAt": "2026-02-10T14:30:00Z",
  "updatedAt": "2026-03-01T10:00:30Z"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `400 Bad Request` - WhatsApp not enabled
- `401 Unauthorized` - Invalid auth token

---

### 3. Create Campaign

Create a new push campaign.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns`

**Request Body**:
```json
{
  "name": "Weekend Flash Sale",
  "frequency": "ONCE",
  "isActive": true,
  "targetingType": "ALL",
  "message": "Hi {{firstName}}! Our weekend sale starts now. Visit {{workspace}} for exclusive deals!",
  "sendAt": "2026-03-15T09:00:00Z",
  "throttlePerSecond": 10,
  "batchSize": 50
}
```

**Request Body (MANUAL targeting)**:
```json
{
  "name": "VIP Customer Update",
  "frequency": "ONCE",
  "targetingType": "MANUAL",
  "targetCustomerIds": ["customer-1", "customer-2", "customer-3"],
  "message": "Hello {{name}}, we have an exclusive update for you!",
  "sendAt": "2026-03-15T14:00:00Z"
}
```

**Request Body (TAGS targeting)**:
```json
{
  "name": "Monthly Newsletter - Premium",
  "frequency": "MONTHLY",
  "targetingType": "TAGS",
  "tagId": "premium-subscribers",
  "message": "Hi {{firstName}}, here's your monthly update from {{workspace}}!",
  "sendAt": "2026-03-01T10:00:00Z"
}
```

**Field Definitions**:
- `name` (required) - Campaign title
- `frequency` (optional) - `ONCE`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL` (default: `ONCE`)
- `isActive` (optional) - Active flag (default: `true`)
- `targetingType` (required) - `ALL`, `MANUAL`, or `TAGS`
- `targetCustomerIds` (required if `MANUAL`) - Array of customer IDs
- `tagId` (required if `TAGS`) - Tag ID to filter customers
- `message` (required) - Message template with variables
- `templateId` (optional) - WhatsApp template ID
- `templateLocale` (optional) - Template locale (e.g., `en_US`)
- `mediaUrl` (optional) - URL to media attachment
- `sendAt` (optional) - First execution time (ISO 8601 format, default: now)
- `throttlePerSecond` (optional) - Rate limit (default: 10)
- `batchSize` (optional) - Batch size (default: 50)

**Response**: `201 Created`
```json
{
  "id": "clxyz789",
  "workspaceId": "workspace-123",
  "createdByUserId": "user-456",
  "name": "Weekend Flash Sale",
  "status": "SCHEDULED",
  "frequency": "ONCE",
  "targetingType": "ALL",
  "message": "Hi {{firstName}}! Our weekend sale starts now.",
  "sendAt": "2026-03-15T09:00:00Z",
  "nextRunAt": null,
  "expectedRecipients": 850,
  "costPerMessage": "1.00",
  "createdAt": "2026-02-10T15:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Missing required fields or invalid data
  ```json
  { "error": "Name is required" }
  { "error": "Message is required" }
  { "error": "Targeting type is required" }
  { "error": "Insufficient credit for campaign" }
  { "error": "No valid recipients found for the selected targeting" }
  ```
- `403 Forbidden` - Trial workspace limit exceeded
- `500 Internal Server Error` - Processing error

---

### 4. Update Campaign

Update an existing campaign (only for campaigns in `DRAFT` or `PAUSED` status).

**Endpoint**: `PUT /api/workspaces/:workspaceId/push-campaigns/:id`

**Request Body** (partial update allowed):
```json
{
  "name": "Updated Campaign Name",
  "message": "New message content with {{variables}}",
  "sendAt": "2026-03-16T10:00:00Z",
  "isActive": true
}
```

**Response**: `200 OK`
```json
{
  "id": "clxyz789",
  "name": "Updated Campaign Name",
  "message": "New message content with {{variables}}",
  "updatedAt": "2026-02-10T15:30:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `400 Bad Request` - Cannot update running campaign
- `500 Internal Server Error` - Update failed

---

### 5. Delete Campaign

Soft-delete a campaign (only for campaigns not currently `RUNNING`).

**Endpoint**: `DELETE /api/workspaces/:workspaceId/push-campaigns/:id`

**Response**: `204 No Content`

**Error Responses**:
- `404 Not Found` - Campaign not found
- `400 Bad Request` - Cannot delete running campaign
- `500 Internal Server Error` - Delete failed

---

### 6. Schedule Campaign

Set a campaign to `SCHEDULED` status with optional execution time.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns/:id/schedule`

**Request Body**:
```json
{
  "sendAt": "2026-03-20T14:00:00Z"
}
```

**Request Body** (schedule for immediate run):
```json
{
  "sendAt": null
}
```

**Response**: `200 OK`
```json
{
  "message": "Campaign scheduled",
  "sendAt": "2026-03-20T14:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `500 Internal Server Error` - Update failed

---

### 7. Run Now

Queue campaign for immediate execution.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns/:id/run-now`

**Response**: `200 OK`
```json
{
  "message": "Campaign queued for immediate run",
  "sendAt": "2026-02-10T15:45:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `500 Internal Server Error` - Failed to schedule

---

### 8. Pause Campaign

Pause a running or scheduled campaign.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns/:id/pause`

**Response**: `200 OK`
```json
{
  "message": "Campaign paused"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `500 Internal Server Error` - Failed to pause

---

### 9. Resume Campaign

Resume a paused campaign.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns/:id/resume`

**Response**: `200 OK`
```json
{
  "message": "Campaign resumed"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `500 Internal Server Error` - Failed to resume

---

### 10. Cancel Campaign

Cancel a scheduled or running campaign.

**Endpoint**: `POST /api/workspaces/:workspaceId/push-campaigns/:id/cancel`

**Response**: `200 OK`
```json
{
  "message": "Campaign cancelled"
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `500 Internal Server Error` - Failed to cancel

---

### 11. List Recipients

List recipients for a campaign with pagination and filtering.

**Endpoint**: `GET /api/workspaces/:workspaceId/push-campaigns/:id/recipients`

**Query Parameters**:
- `skip` (optional) - Offset for pagination (default: 0)
- `take` (optional) - Limit per page (default: 50, max: 100)
- `status` (optional) - Filter by status: `PENDING`, `SENT`, `SKIPPED`, `FAILED`

**Example**:
```
GET /api/workspaces/workspace-123/push-campaigns/clxyz789/recipients?skip=0&take=50&status=SENT
```

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "recipient-1",
      "campaignId": "clxyz789",
      "customerId": "customer-123",
      "phone": "+1234567890",
      "status": "SENT",
      "sentAt": "2026-03-15T09:05:00Z",
      "messageId": "queue-msg-456",
      "priceCharged": "1.00",
      "errorCode": null,
      "errorMessage": null,
      "createdAt": "2026-03-15T09:00:00Z"
    },
    {
      "id": "recipient-2",
      "campaignId": "clxyz789",
      "customerId": "customer-456",
      "phone": "+1234567891",
      "status": "SKIPPED",
      "sentAt": null,
      "messageId": null,
      "priceCharged": "0.00",
      "errorCode": "OPT_OUT",
      "errorMessage": "Marketing opt-in missing",
      "createdAt": "2026-03-15T09:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Campaign not found
- `400 Bad Request` - Invalid query parameters

---

## Rate Limiting

Push campaigns respect workspace-level rate limiting:
- Default: 10 messages per second (`throttlePerSecond`)
- Batch size: 50 recipients per scheduler run (`batchSize`)
- Scheduler runs every minute

**Override per campaign**:
```json
{
  "throttlePerSecond": 5,
  "batchSize": 20
}
```

---

## Error Codes

### Campaign Creation Errors

| Error Code | Description |
|------------|-------------|
| `INSUFFICIENT_CREDIT` | Owner's credit balance too low |
| `NO_RECIPIENTS` | No valid recipients for targeting |
| `WHATSAPP_DISABLED` | Workspace doesn't have WhatsApp enabled |
| `OWNER_NOT_FOUND` | Workspace owner not found |

### Recipient Error Codes

| Error Code | Description |
|------------|-------------|
| `BLACKLISTED` | Customer is blacklisted |
| `CHATBOT_INACTIVE` | Chatbot disabled for customer |
| `OPT_OUT` | Customer missing marketing consent |
| `NO_CUSTOMER` | Customer not found or inactive |
| `NO_PHONE` | Missing phone number |
| `SEND_ERROR` | Error during message queuing |

---

## Variable Replacement

Messages support variable replacement with the following keys:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{name}}` | Full name | "John Doe" |
| `{{firstName}}` | First name | "John" |
| `{{lastName}}` | Last name | "Doe" |
| `{{email}}` | Email address | "john@example.com" |
| `{{phone}}` | Phone number | "+1234567890" |
| `{{company}}` | Company name | "Acme Corp" |
| `{{workspace}}` | Workspace name | "My Store" |

**Example Template**:
```
Hello {{firstName}},

We have a special offer just for you at {{workspace}}!

Contact us at {{phone}} for more details.
```

**Rendered Output** (for customer "John Doe", workspace "My Store"):
```
Hello John,

We have a special offer just for you at My Store!

Contact us at +1234567890 for more details.
```

---

## Webhook Events

Currently not supported. Future enhancement.

---

## Postman Collection

Example Postman collection for testing:

```json
{
  "info": {
    "name": "Push Campaigns API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Campaigns",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": "{{baseUrl}}/api/workspaces/{{workspaceId}}/push-campaigns"
      }
    },
    {
      "name": "Create Campaign",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Test Campaign\",\n  \"targetingType\": \"ALL\",\n  \"message\": \"Hello {{firstName}}!\",\n  \"frequency\": \"ONCE\"\n}"
        },
        "url": "{{baseUrl}}/api/workspaces/{{workspaceId}}/push-campaigns"
      }
    }
  ]
}
```

---

## Testing with cURL

**List campaigns**:
```bash
curl -X GET \
  'http://localhost:3001/api/workspaces/workspace-123/push-campaigns' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Create campaign**:
```bash
curl -X POST \
  'http://localhost:3001/api/workspaces/workspace-123/push-campaigns' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Flash Sale",
    "targetingType": "ALL",
    "message": "Hello {{firstName}}, our sale starts now!",
    "frequency": "ONCE"
  }'
```

**Schedule for immediate run**:
```bash
curl -X POST \
  'http://localhost:3001/api/workspaces/workspace-123/push-campaigns/clxyz789/run-now' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Pause campaign**:
```bash
curl -X POST \
  'http://localhost:3001/api/workspaces/workspace-123/push-campaigns/clxyz789/pause' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
