# Data Model: New User Registration Flow

**Feature ID**: 174-router  
**Date**: 2025-11-18  
**Phase**: Phase 1 (Design & Contracts)

---

## Overview

This document describes the data entities involved in the new user registration flow. All entities already exist in the database schema (`backend/prisma/schema.prisma`). No schema migrations required.

---

## Entity Diagram

```
┌─────────────────┐
│   Workspace     │
│                 │
│ - id            │◄─────┐
│ - welcomeMessage│      │
│ - afterRegMsg   │      │
│ - wipMessage    │      │
└─────────────────┘      │
                         │ workspaceId
                         │
┌─────────────────┐      │
│   Customer      │      │
│                 │      │
│ - id            │──────┤
│ - phone         │      │
│ - name          │      │
│ - email         │      │
│ - language      │      │
│ - workspaceId   │──────┘
│ - isBlacklisted │
│ - isActive      │
└─────────────────┘
         │
         │ phoneNumber
         │
┌────────────────────────┐
│ RegistrationAttempts   │
│                        │
│ - id                   │
│ - phoneNumber          │
│ - workspaceId          │──────┐
│ - attemptCount         │      │
│ - lastAttemptAt        │      │
│ - isBlocked            │      │
└────────────────────────┘      │
                                │
┌─────────────────┐             │
│   ShortUrls     │             │
│                 │             │
│ - id            │             │
│ - shortCode     │             │
│ - originalUrl   │             │
│ - workspaceId   │─────────────┤
│ - clicks        │             │
│ - expiresAt     │             │
│ - isActive      │             │
└─────────────────┘             │
                                │
┌─────────────────┐             │
│  SecureToken    │             │
│                 │             │
│ - token         │             │
│ - phoneNumber   │             │
│ - workspaceId   │─────────────┘
│ - customerId    │
│ - expiresAt     │
│ - used          │
└─────────────────┘
```

---

## Entities

### 1. Workspace

**Description**: Multi-tenant workspace containing configuration for welcome messages, WIP messages, and post-registration messages.

**Schema**: `backend/prisma/schema.prisma` (lines 10-60)

**Fields**:

| Field                       | Type          | Required             | Description                                                                                |
| --------------------------- | ------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `id`                        | String (cuid) | Yes                  | Primary key                                                                                |
| `name`                      | String        | Yes                  | Workspace display name                                                                     |
| `whatsappPhoneNumber`       | String        | No                   | WhatsApp Business phone number                                                             |
| `welcomeMessage`            | JSON          | No                   | Welcome messages (multilingual): `{ "en": "...", "es": "...", "it": "..." }`               |
| `wipMessage`                | JSON          | No                   | WIP messages (multilingual) when chatbot disabled                                          |
| `afterRegistrationMessages` | JSON          | No                   | Post-registration messages (multilingual): `{ "en": "Thank you, [nome]...", "es": "..." }` |
| `challengeStatus`           | Boolean       | Yes (default: false) | If false, chatbot disabled (send WIP message)                                              |
| `debugMode`                 | Boolean       | Yes (default: true)  | Debug mode flag                                                                            |

**Relationships**:

- `hasMany` Customers
- `hasMany` RegistrationAttempts
- `hasMany` ShortUrls
- `hasMany` SecureTokens

**Validation Rules**:

- `welcomeMessage['en']` must exist (English base for translation)
- `afterRegistrationMessages['en']` must exist
- `whatsappPhoneNumber` must be unique

**State Transitions**: None (configuration entity)

**Indexes**:

- Primary: `id`
- Unique: `slug`, `whatsappPhoneNumber`

---

### 2. Customer

**Description**: Registered user who can interact with the chatbot. Created after successful registration.

**Schema**: `backend/prisma/schema.prisma`

**Fields**:

| Field                        | Type          | Required             | Description                          |
| ---------------------------- | ------------- | -------------------- | ------------------------------------ |
| `id`                         | String (cuid) | Yes                  | Primary key                          |
| `phone`                      | String        | Yes                  | Phone number (E.164 format)          |
| `name`                       | String        | Yes                  | Full name (first + last)             |
| `email`                      | String        | Yes                  | Email address (unique per workspace) |
| `company`                    | String        | Yes                  | Company name                         |
| `language`                   | String        | Yes (default: "ENG") | Preferred language code              |
| `workspaceId`                | String        | Yes                  | Foreign key to Workspace             |
| `isActive`                   | Boolean       | Yes (default: true)  | Customer active status               |
| `isBlacklisted`              | Boolean       | Yes (default: true)  | Blocked until admin approval         |
| `activeChatbot`              | Boolean       | Yes (default: true)  | Chatbot enabled for customer         |
| `privacy_accepted_at`        | DateTime      | No                   | GDPR consent timestamp               |
| `push_notifications_consent` | Boolean       | No                   | Push notification permission         |

**Relationships**:

- `belongsTo` Workspace
- `hasMany` Messages
- `hasMany` Orders
- `hasMany` ChatSessions

**Validation Rules**:

- `phone` must be unique per workspace
- `email` must be unique per workspace
- `language` must be one of: "ENG", "IT", "ESP", "PRT", "FR", "DE"
- `isBlacklisted = true` for new users (manual admin approval required)

**State Transitions**:

```
NOT EXISTS → [Registration] → isActive=true, isBlacklisted=true
isBlacklisted=true → [Admin Approval] → isBlacklisted=false
```

**Indexes**:

- Primary: `id`
- Unique: `[phone, workspaceId]`, `[email, workspaceId]`
- Index: `workspaceId`

---

### 3. RegistrationAttempts

**Description**: Tracks registration attempts for unknown phone numbers to prevent spam. Blocks users after exceeding MAX_ATTEMPTS (5).

**Schema**: `backend/prisma/schema.prisma` (lines 681-694)

**Fields**:

| Field           | Type          | Required             | Description                          |
| --------------- | ------------- | -------------------- | ------------------------------------ |
| `id`            | String (cuid) | Yes                  | Primary key                          |
| `phoneNumber`   | String        | Yes                  | Phone number attempting registration |
| `workspaceId`   | String        | Yes                  | Foreign key to Workspace             |
| `attemptCount`  | Int           | Yes (default: 0)     | Number of registration attempts      |
| `lastAttemptAt` | DateTime      | Yes (default: now)   | Timestamp of last attempt            |
| `isBlocked`     | Boolean       | Yes (default: false) | User blocked flag                    |
| `createdAt`     | DateTime      | Yes (default: now)   | First attempt timestamp              |
| `updatedAt`     | DateTime      | Yes (auto)           | Last update timestamp                |

**Relationships**:

- `belongsTo` Workspace

**Validation Rules**:

- `phoneNumber` + `workspaceId` must be unique (composite unique constraint)
- `attemptCount` incremented atomically (Prisma `increment` operation)
- `isBlocked = true` when `attemptCount > MAX_ATTEMPTS` (5)

**State Transitions**:

```
NOT EXISTS → [First Message] → attemptCount=1, isBlocked=false
attemptCount < 5 → [Subsequent Message] → attemptCount++
attemptCount = 5 → [5th Attempt] → isBlocked=true
isBlocked=true → [Registration Success] → DELETE record (clearAttempts)
```

**Business Rules**:

- Attempts reset after 24 hours (ATTEMPT_WINDOW_HOURS = 24)
- If `lastAttemptAt` < (now - 24h) → reset `attemptCount` to 1
- If `isBlocked = true` → reject all messages (return "CUSTOMER_BLACKLISTED")

**Indexes**:

- Primary: `id`
- Unique: `[phoneNumber, workspaceId]`
- Index: `workspaceId`

---

### 4. ShortUrls

**Description**: Shortened URLs for registration links. Tracks clicks and expires after 1 hour.

**Schema**: `backend/prisma/schema.prisma` (lines 716-735)

**Fields**:

| Field            | Type              | Required            | Description                         |
| ---------------- | ----------------- | ------------------- | ----------------------------------- |
| `id`             | String (cuid)     | Yes                 | Primary key                         |
| `shortCode`      | String (10 chars) | Yes                 | Unique short code (e.g., "AbC123d") |
| `originalUrl`    | Text              | Yes                 | Full registration URL with token    |
| `workspaceId`    | String            | Yes                 | Foreign key to Workspace            |
| `clicks`         | Int               | Yes (default: 0)    | Number of times link accessed       |
| `isActive`       | Boolean           | Yes (default: true) | Link active status                  |
| `expiresAt`      | DateTime          | No                  | Expiration timestamp (1 hour)       |
| `lastAccessedAt` | DateTime          | No                  | Last click timestamp                |
| `createdAt`      | DateTime          | Yes (default: now)  | Creation timestamp                  |
| `updatedAt`      | DateTime          | Yes (auto)          | Last update timestamp               |

**Relationships**:

- `belongsTo` Workspace

**Validation Rules**:

- `shortCode` must be unique (globally)
- `shortCode` generated via `crypto.randomBytes(5)` (7 characters base64)
- `expiresAt` defaults to `now() + 1 hour`
- `originalUrl` contains SecureToken

**State Transitions**:

```
NOT EXISTS → [createShortUrl] → isActive=true, clicks=0
isActive=true → [Access] → clicks++, lastAccessedAt=now
expiresAt < now → [Auto-Cleanup] → DELETE
```

**Business Rules**:

- Expired URLs (expiresAt < now) return 404
- Inactive URLs (isActive = false) return 404
- Click tracking happens before redirect
- Cleanup job runs periodically (delete expired URLs)

**Indexes**:

- Primary: `id`
- Unique: `shortCode`
- Index: `workspaceId`, `expiresAt`

---

### 5. SecureToken

**Description**: Time-limited tokens for public registration access. Contains customer phone number and workspace ID.

**Schema**: `backend/prisma/schema.prisma`

**Fields**:

| Field         | Type          | Required             | Description                                  |
| ------------- | ------------- | -------------------- | -------------------------------------------- |
| `id`          | String (cuid) | Yes                  | Primary key                                  |
| `token`       | String        | Yes                  | Secure token (UUID + HMAC signature)         |
| `phoneNumber` | String        | Yes                  | Customer phone number                        |
| `workspaceId` | String        | Yes                  | Foreign key to Workspace                     |
| `customerId`  | String        | No                   | Foreign key to Customer (after registration) |
| `userId`      | String        | No                   | Backward compatibility field                 |
| `type`        | String        | Yes                  | Token type ("registration")                  |
| `expiresAt`   | DateTime      | Yes                  | Expiration timestamp (1 hour)                |
| `used`        | Boolean       | Yes (default: false) | Token consumed flag                          |
| `createdAt`   | DateTime      | Yes (default: now)   | Creation timestamp                           |
| `updatedAt`   | DateTime      | Yes (auto)           | Last update timestamp                        |

**Relationships**:

- `belongsTo` Workspace
- `belongsTo` Customer (optional)

**Validation Rules**:

- `token` must be unique
- `expiresAt` defaults to `now() + TOKEN_EXPIRATION` (env var, default 1h)
- `type = "registration"` for this feature
- `used = true` after successful registration

**State Transitions**:

```
NOT EXISTS → [generateToken] → used=false, customerId=null
used=false → [Registration] → used=true, customerId=<new_id>
expiresAt < now → [Validation] → REJECT
used=true → [Validation] → REJECT (already consumed)
```

**Business Rules**:

- Token payload: `{ phoneNumber, workspaceId, type, expiresAt }`
- HMAC signature validates token integrity
- One-time use (used flag prevents reuse)
- Expired tokens rejected (expiresAt < now)

**Indexes**:

- Primary: `id`
- Unique: `token`
- Index: `workspaceId`, `customerId`

---

### 6. Message

**Description**: Chat messages between customer and chatbot. Includes system messages (welcome, confirmation).

**Schema**: `backend/prisma/schema.prisma` (lines 396-430)

**Fields**:

| Field               | Type          | Required              | Description                |
| ------------------- | ------------- | --------------------- | -------------------------- | ---------- | --------- | ----------- | ------ |
| `id`                | String (uuid) | Yes                   | Primary key                |
| `chatSessionId`     | String        | Yes                   | Foreign key to ChatSession |
| `direction`         | Enum          | Yes                   | "INBOUND"                  | "OUTBOUND" |
| `content`           | String        | Yes                   | Message text               |
| `type`              | Enum          | Yes (default: TEXT)   | Message type               |
| `status`            | String        | Yes (default: "sent") | Delivery status            |
| `aiGenerated`       | Boolean       | Yes (default: false)  | LLM-generated flag         |
| `whatsappStatus`    | String        | No                    | "sent"                     | "failed"   | "pending" | "delivered" | "read" |
| `whatsappMessageId` | String        | No                    | WhatsApp message ID        |
| `debugInfo`         | String        | No                    | JSON debug information     |
| `createdAt`         | DateTime      | Yes (default: now)    | Creation timestamp         |

**Relationships**:

- `belongsTo` ChatSession

**Validation Rules**:

- `content` cannot be empty
- `direction` must be "INBOUND" or "OUTBOUND"

**State Transitions** (for system messages):

```
NOT EXISTS → [sendWelcomeMessage] → direction=OUTBOUND, aiGenerated=false, whatsappStatus=pending
whatsappStatus=pending → [WhatsApp Send] → whatsappStatus=sent
whatsappStatus=sent → [WhatsApp Delivery] → whatsappStatus=delivered
```

**Business Rules**:

- System messages (welcome, confirmation) have `aiGenerated = false`
- `debugInfo` contains: `{ stage: "new_user_welcome" | "registration_confirmation", translatedViaSecurityLayer: true, language: "it" }`
- `agentSelected = "CHATBOT"` for system messages (stored in related tables)

**Indexes**:

- Primary: `id`
- Index: `chatSessionId`, `whatsappStatus`, `whatsappMessageId`

---

## Relationships Summary

```
Workspace 1──────* RegistrationAttempts
Workspace 1──────* ShortUrls
Workspace 1──────* SecureTokens
Workspace 1──────* Customers
Customer 1───────* Messages (via ChatSession)
SecureToken *────1 Customer (optional, after registration)
```

---

## Query Patterns

### 1. Check Customer Exists (Unknown User Detection)

```sql
SELECT * FROM customers
WHERE phone = '+39 333 1234567'
  AND workspaceId = 'cm9hjgq9v00014qk8fsdy4ujv'
  AND isActive = true
LIMIT 1
```

**Performance**: Index on `[phone, workspaceId]` (unique constraint)

---

### 2. Record Registration Attempt

```sql
-- Upsert pattern (Prisma)
INSERT INTO registrationAttempts (phoneNumber, workspaceId, attemptCount, lastAttemptAt)
VALUES ('+39 333 1234567', 'cm9...', 1, NOW())
ON CONFLICT (phoneNumber, workspaceId)
DO UPDATE SET
  attemptCount = attemptCount + 1,
  lastAttemptAt = NOW()
RETURNING *
```

**Performance**: Unique constraint on `[phoneNumber, workspaceId]` enables atomic upsert

---

### 3. Check if User is Blocked

```sql
SELECT * FROM registrationAttempts
WHERE phoneNumber = '+39 333 1234567'
  AND workspaceId = 'cm9...'
  AND isBlocked = true
LIMIT 1
```

**Performance**: Index on `[phoneNumber, workspaceId]`

---

### 4. Create Short URL

```sql
INSERT INTO shortUrls (shortCode, originalUrl, workspaceId, expiresAt)
VALUES ('AbC123d', 'https://...?token=xxx', 'cm9...', NOW() + INTERVAL '1 hour')
RETURNING *
```

**Performance**: Unique constraint on `shortCode` prevents collisions

---

### 5. Resolve Short URL

```sql
SELECT originalUrl FROM shortUrls
WHERE shortCode = 'AbC123d'
  AND isActive = true
  AND (expiresAt IS NULL OR expiresAt > NOW())
LIMIT 1
```

**Performance**: Unique index on `shortCode`, index on `expiresAt`

---

### 6. Validate Registration Token

```sql
SELECT * FROM secureToken
WHERE token = 'xxx-yyy-zzz'
  AND used = false
  AND expiresAt > NOW()
LIMIT 1
```

**Performance**: Unique index on `token`

---

## Data Integrity Constraints

| Constraint                             | Table                  | Purpose                               |
| -------------------------------------- | ---------------------- | ------------------------------------- |
| `@@unique([phoneNumber, workspaceId])` | `registrationAttempts` | Prevent duplicate attempt tracking    |
| `@@unique([phone, workspaceId])`       | `customers`            | Prevent duplicate customer records    |
| `@@unique([email, workspaceId])`       | `customers`            | Prevent email conflicts per workspace |
| `@unique shortCode`                    | `shortUrls`            | Prevent short code collisions         |
| `@unique token`                        | `secureToken`          | Prevent token reuse                   |

---

## Workspace Isolation Verification

**All queries MUST include `workspaceId` filter**:

✅ Customer lookup: `WHERE phone = ? AND workspaceId = ?`  
✅ Registration attempts: `WHERE phoneNumber = ? AND workspaceId = ?`  
✅ Short URLs: `WHERE workspaceId = ?`  
✅ Secure tokens: Token payload contains `workspaceId`

**Security Tests Required**:

- [ ] Token from workspace A rejected for workspace B
- [ ] Short URL from workspace A doesn't leak workspace B data
- [ ] Registration attempt counters isolated per workspace

---

## Conclusion

All data entities already exist in the database schema. No migrations required. The data model supports full workspace isolation, atomic operations (registration attempts), and time-based expiration (short URLs, tokens).
