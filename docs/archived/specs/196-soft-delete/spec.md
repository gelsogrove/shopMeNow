# Feature Specification: Soft Delete System with 90-Day Retention

**Feature Branch**: `196-soft-delete`  
**Created**: 2024  
**Status**: Specification Complete - Ready for Planning  
**User Request**: "Implement soft delete system for customer unsubscribe with 90-day retention, role-aware cascade, admin-only operations, and transaction-based restore"

---

## 1. Overview & Requirements

### Context
This feature implements a comprehensive soft-delete system for multi-tenant SaaS platform with:
- Soft deletion (logical delete via `deletedAt` timestamp, not physical removal)
- 90-day retention window before automatic hard-delete (configurable via `.env`)
- Role-aware cascade behavior: Owner deletes workspace+customers+agents; Agent deletes isolated
- Admin-only operations (`isPlatformAdmin=true` required)
- Transaction-based restore with full data recovery
- Audit logging of every hard-delete operation
- Login blocking for deleted accounts
- Backoffice UI with trash management and cascade impact preview

### Critical Safety Requirement
"è importante che non sbagliamo con gli ID... disastro societario!!!" (We can't mess with IDs - deleting wrong chat would be company disaster!)
- **Chain verification**: All cascade operations verify `workspaceId` before deletion
- **Atomic transactions**: All-or-nothing cascade (no orphaned records)
- **Audit trail**: Every hard-deleted ID logged for compliance

### Configuration
```bash
# .env (production)
SOFT_DELETE_RETENTION_DAYS=90

# .env.test (test override for CI/CD)
SOFT_DELETE_RETENTION_DAYS=1  # Simulates 90 days in 1 day
```

---

## 2. User Scenarios & Testing _(mandatory)_

### User Story 1 - Owner Initiates Account Cancellation (Priority: P1)

Owner (Workspace owner) requests full account deletion including workspace, all customers, all orders, all agents.

**Why this priority**: Core feature - enables customer churn/cancellation workflows

**Independent Test**: Owner can navigate to settings → Delete Account → Confirm → Account marked `deletedAt`, login blocked, backoffice shows in trash

**Acceptance Scenarios**:

1. **Given** workspace owner logs in, **When** navigates to Settings → Account, **Then** sees "Delete Account" button
2. **Given** owner clicks "Delete Account", **When** confirms deletion, **Then**:
   - `user.deletedAt = now()` (soft-deleted)
   - `workspace.deletedAt = now()` (soft-deleted)
   - All `customer.deletedAt = now()` in workspace (soft-deleted)
   - All `agent.deletedAt = now()` in workspace (soft-deleted)
   - All `order.deletedAt = now()` for customers (soft-deleted)
   - All `message.deletedAt = now()` for customers (soft-deleted)
   - All `chatSession.deletedAt = now()` for customers (soft-deleted)
   - Transaction ATOMIC (all succeed or all rollback)
3. **Given** owner tries to login after deletion, **When** enters credentials, **Then** sees "Account deleted" message
4. **Given** workspace is deleted, **When** customers try to access platform, **Then** see "Workspace unavailable" message
5. **Given** deletion completes, **When** backoffice admin views trash, **Then** sees workspace in "Deleted Workspaces" tab with 90-day countdown

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Settings page with confirmation dialog, API call, error/success handling
- [ ] Backend API: POST `/admin/users/{id}/unsubscribe` endpoint with 3-layer middleware
- [ ] Service Layer: `UserUnsubscribeService` with role detection (owner vs agent)
- [ ] Repository: Transaction-based cascade delete across 19 tables
- [ ] Database: Migration adds `deletedAt` to User + dependent tables
- [ ] Security: 3-layer middleware (auth + platformAdmin + workspaceId verification)
- [ ] Testing: Unit test cascade logic, security test access control, integration test full lifecycle
- [ ] Documentation: Swagger updated with cascade behavior documented
- [ ] Concurrency: Prisma transaction ensures atomic cascade
- [ ] Audit: Every cascade delete logged to `SoftDeleteAuditLog` with workspaceId chain
- [ ] Code Cleanliness: No temp files, extracted helper functions, no duplication

---

### User Story 2 - Agent Account Deletion (Priority: P1)

Agent (non-owner user) requests account deletion (isolated - workspace continues).

**Why this priority**: Core feature - enables agent churn/contract termination

**Independent Test**: Agent can delete own account, agent marked deleted, workspace/customers unaffected, agent can't login

**Acceptance Scenarios**:

1. **Given** agent user logs in, **When** navigates to Settings, **Then** sees "Delete My Account" button
2. **Given** agent clicks delete, **When** confirms, **Then**:
   - `agent_user.deletedAt = now()` (soft-deleted)
   - Workspace unaffected (workspace stays active)
   - All customers still accessible by other agents
   - Agent cannot login
   - Transaction atomic
3. **Given** agent is deleted, **When** other agents view workspace, **Then** deleted agent appears greyed out in team list
4. **Given** deletion completes, **When** backoffice admin views trash, **Then** sees agent in "Deleted Agents" tab (isolated from workspace deletion)

**360-Degree Validation**:

- [ ] Frontend: Settings page with confirmation, API call, success message
- [ ] Backend API: POST `/admin/users/{id}/unsubscribe` with role detection logic
- [ ] Service Layer: `UserUnsubscribeService` checks role → routes to owner vs agent delete
- [ ] Repository: Isolated delete (only User.deletedAt, no cascade to workspace)
- [ ] Database: `deletedAt` field on User table
- [ ] Security: 3-layer middleware, role verification before cascade logic
- [ ] Testing: Unit test role detection, integration test isolated delete
- [ ] Audit: Delete logged with userId and "AGENT_ISOLATED" type

---

### User Story 3 - Backoffice Admin Trash Management (Priority: P1)

Admin views deleted items across workspace, customers, agents; can restore or permanently delete.

**Why this priority**: Core feature - enables admin control over deleted data lifecycle

**Independent Test**: Admin can view trash, see 90-day countdown, restore items, permanently delete items

**Acceptance Scenarios**:

1. **Given** backoffice admin logs in, **When** navigates to "Trash" section, **Then** sees 4 tabs: Customers | Workspaces | Agents | Operators
2. **Given** deleted customer exists, **When** admin opens "Deleted Customers" tab, **Then**:
   - Shows: ID, name, email, phone, deletion date, days-until-permanent-delete, related records count
   - Pagination enabled (50 items per page)
   - Filter by workspace/agent/date range available
3. **Given** customer in trash, **When** admin clicks "Restore", **Then**:
   - Confirmation dialog shows cascade impact: "Restoring customer will restore X orders, Y messages, Z sessions"
   - On confirm: All `deletedAt = null` in transaction
   - Customer active again, all related data visible
4. **Given** customer in trash, **When** admin clicks "Permanently Delete", **Then**:
   - Warning dialog: "This will permanently delete customer and all related records. Type 'PERMANENTLY DELETE' to confirm"
   - On confirm: Hard-delete all records (physical removal from DB)
   - Audit log: All deleted IDs, timestamp, admin user, reason
5. **Given** hard-delete scheduled time (11:20 AM), **When** scheduler runs, **Then**:
   - Finds all `deletedAt < (now - SOFT_DELETE_RETENTION_DAYS)`
   - Hard-deletes in transaction
   - Logs all IDs to `SoftDeleteAuditLog`
   - Updates `SchedulerJobStatus.lastRun`

**360-Degree Validation**:

- [ ] Frontend: TrashPage with 4 tabs, list views, restore/delete modals with cascade preview
- [ ] Backend API: GET `/admin/trash/{type}`, POST `/admin/trash/{id}/restore`, POST `/admin/trash/{id}/permanently-delete`
- [ ] Service Layer: `TrashRestoreService` for restore logic, `DeletionSchedulerService` for hard-delete
- [ ] Repository: `getSoftDeleted()`, `restoreMany()`, `hardDeleteMany()`, `getDeleteAuditTrail()`
- [ ] Database: `SoftDeleteAuditLog` table with workspaceId chain, scheduler triggers
- [ ] Security: `requirePlatformAdmin` middleware (no workspace admin access)
- [ ] Testing: Integration test restore/delete, cascade impact verification, scheduler job test
- [ ] Audit: Every hard-delete logged with full audit trail

---

### User Story 4 - Login Blocking for Deleted Accounts (Priority: P1)

User attempts login with deleted account → system prevents access with clear message.

**Why this priority**: Security - prevents deleted accounts from re-accessing platform

**Independent Test**: After account deletion, user cannot login (gets "Account deleted" message)

**Acceptance Scenarios**:

1. **Given** user account marked `deletedAt != null`, **When** user attempts login with credentials, **Then** auth succeeds BUT middleware checks `user.deletedAt`
2. **When** AuthService finds `user.deletedAt != null`, **Then** returns 403 Forbidden with message including days until permanent deletion
3. **Given** within 90-day window, user contacts support, **When** admin restores account (sets `deletedAt = null`), **Then** user can login again

**360-Degree Validation**:

- [x] Frontend: Login page handles 403 with special message, displays info about 90-day window
- [x] Backend API: AuthService.login() checks `user.deletedAt` BEFORE generating JWT (more secure than middleware check)
- [x] Service Layer: Login service returns 403 with days-until-permanent-delete message
- [x] Security: Check happens BEFORE token generation - deleted users NEVER get JWT
- [x] Testing: Unit test AuthService, integration test login flow with deleted account
- [ ] Documentation: API error code documented in Swagger

---

### User Story 5 - Data Visibility for Soft-Deleted Items (Priority: P2)

All queries exclude soft-deleted data by default; only trash queries see deleted items.

**Why this priority**: Data integrity - users should never see deleted data in normal flows

**Independent Test**: List endpoints (customers, agents, orders) exclude soft-deleted items; trash endpoints show only soft-deleted items

**Acceptance Scenarios**:

1. **Given** customer soft-deleted, **When** non-admin user calls GET `/customers`, **Then** deleted customer NOT in results
2. **Given** agent soft-deleted, **When** admin calls GET `/agents`, **Then** deleted agent NOT in results
3. **Given** order soft-deleted, **When** customer calls GET `/my-orders`, **Then** soft-deleted order NOT visible
4. **Given** same customer soft-deleted, **When** admin calls GET `/admin/trash/customers`, **Then** ONLY soft-deleted customers shown
5. **Given** multiple soft-deletes, **When** trash query runs, **Then** results paginated, sorted by deletion date DESC

**360-Degree Validation**:

- [ ] Repository: All `findMany()` queries include `...buildSoftDeleteFilter()` helper
- [ ] Database: Indexes on `deletedAt`, `(workspaceId, deletedAt)` for query performance
- [ ] Testing: Unit test each repository method includes filter; integration test list endpoints

---

### User Story 6 - Scheduler Hard-Delete at 11:20 AM (Priority: P2)

Daily scheduler job @ 11:20 AM hard-deletes all soft-deleted records past 90-day window.

**Why this priority**: Data lifecycle - automatic cleanup prevents indefinite storage

**Independent Test**: Scheduler can be manually triggered, hard-deletes expired items, logs all deleted IDs

**Acceptance Scenarios**:

1. **Given** customer soft-deleted 91 days ago, **When** scheduler runs @ 11:20 AM, **Then** customer hard-deleted (physically removed)
2. **Given** customer soft-deleted 80 days ago, **When** scheduler runs, **Then** customer NOT hard-deleted (within retention window)
3. **When** hard-delete completes, **Then** all affected IDs logged to `SoftDeleteAuditLog`
4. **Given** scheduler enabled, **When** failure occurs (e.g., DB connection), **Then** logged and notified (no silent failures)
5. **Given** scheduler disabled (`SchedulerJobStatus.isActive=false`), **When** 11:20 AM arrives, **Then** job skipped (admin can pause)

**360-Degree Validation**:

- [ ] Backend: `DeletionSchedulerService` runs daily @ 11:20 AM (not midnight to avoid load)
- [ ] Database: `SchedulerJobStatus` table tracks job state, `lastRun`, enabled flag
- [ ] Service Layer: Query `deletedAt < (now - SOFT_DELETE_RETENTION_DAYS)`, hard-delete in transaction
- [ ] Testing: Unit test scheduler query logic; integration test with simulated time (retention=1 day)
- [ ] Audit: Every hard-delete logged with workspaceId chain for compliance

---

## 3. Data Entities & Schema Changes

### Tables Requiring `deletedAt DateTime?` Field

1. **User** (admin/agent/operator accounts)
2. **Workspace** (main workspace)
3. **Customers** (end customers/buyers)
4. **Orders** (customer orders)
5. **OrderItems** (line items in orders)
6. **Messages** (WhatsApp messages)
7. **ChatSessions** (customer chat sessions)
8. **CartItems** (shopping cart items)
9. **Usage** (feature usage tracking)
10. **Billing** (billing records)
11. **Invoices** (generated invoices)
12. **Subscriptions** (active subscriptions)
13. **CouponUsage** (coupon redemptions)
14. **ProductVariants** (product variant configurations)
15. **AgentConfig** (agent prompt configurations)
16. **WorkspaceSettings** (workspace-specific settings)
17. **ChatSessionMessages** (junction table for messages)
18. **CustomerNotes** (internal notes on customers)
19. **ActivityLog** (activity audit trail)

### New Tables

**SoftDeleteAuditLog**
```prisma
model SoftDeleteAuditLog {
  id                  String    @id @default(cuid())
  workspaceId         String
  entityType          String    // "USER", "WORKSPACE", "CUSTOMER", etc.
  deletedIds          String[]  // IDs that were hard-deleted
  reason              String?   // Admin reason or "SCHEDULED_CLEANUP"
  deletedByUserId     String?   // Admin who initiated delete
  deletedAt           DateTime  @default(now())
  recordCount         Int       // Number of records deleted
  
  workspace           Workspace @relation(fields: [workspaceId], references: [id])
  @@index([workspaceId, deletedAt])
}
```

### Indexes for Performance

```prisma
// User table
@@index([workspaceId, deletedAt])  // Filter by workspace & visibility
@@index([deletedAt])               // Scheduler: find records past retention

// Workspace table
@@index([deletedAt])               // Trash queries, scheduler

// Customer table
@@index([workspaceId, deletedAt])  // Most common filter: workspace + active customers
@@index([deletedAt])               // Scheduler queries

// All other tables: similar pattern
@@index([workspaceId, deletedAt])
@@index([deletedAt])
```

---

## 4. API Endpoints

### Endpoint 1: Initiate User Unsubscribe (Owner or Agent)

**Route**: `POST /admin/users/{id}/unsubscribe`  
**Middleware**: authMiddleware → requirePlatformAdmin → validateWorkspaceOperation  
**Request**:
```json
{
  "userId": "user_123",
  "reason": "User requested deletion"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Account deletion initiated",
  "cascadeType": "OWNER_CASCADE" | "AGENT_ISOLATED",
  "affectedRecords": {
    "workspaces": 1,
    "customers": 150,
    "orders": 500,
    "messages": 2000,
    "agents": 5
  },
  "deletionDate": "2024-01-15",
  "permanentDeleteDate": "2024-04-15"
}
```

**Validation**:
- User must exist and not already deleted
- Admin must be `isPlatformAdmin=true`
- Cascade type determined by user role (owner → workspace; agent → isolated)

---

### Endpoint 2: List Soft-Deleted Customers

**Route**: `GET /admin/trash/customers?workspaceId={id}&page=1&limit=50`  
**Middleware**: authMiddleware → requirePlatformAdmin  
**Response**:
```json
{
  "items": [
    {
      "id": "cust_123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "deletedAt": "2024-01-15T10:00:00Z",
      "daysUntilPermanentDelete": 85,
      "relatedRecords": {
        "orders": 5,
        "messages": 120,
        "sessions": 3
      },
      "actions": ["restore", "permanentlyDelete"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250
  }
}
```

---

### Endpoint 3: Restore Soft-Deleted Item

**Route**: `POST /admin/trash/{id}/restore`  
**Middleware**: authMiddleware → requirePlatformAdmin → validateWorkspaceOperation  
**Request**:
```json
{
  "workspaceId": "ws_123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Item restored successfully",
  "entityType": "CUSTOMER",
  "cascadeRestored": {
    "orders": 5,
    "messages": 120,
    "sessions": 3
  },
  "restoredAt": "2024-01-15T11:30:00Z"
}
```

**Validation**:
- Item must exist and be soft-deleted (`deletedAt != null`)
- Item must be within 90-day retention window
- Restore entire cascade in transaction

---

### Endpoint 4: Permanently Delete Soft-Deleted Item

**Route**: `POST /admin/trash/{id}/permanently-delete`  
**Middleware**: authMiddleware → requirePlatformAdmin → validateWorkspaceOperation  
**Request**:
```json
{
  "workspaceId": "ws_123",
  "confirmationText": "PERMANENTLY DELETE"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Item permanently deleted",
  "entityType": "CUSTOMER",
  "deletedRecordCount": 128,
  "auditLogId": "log_123",
  "permanentlyDeletedAt": "2024-01-15T11:35:00Z"
}
```

**Validation**:
- Confirmation text must exactly match "PERMANENTLY DELETE"
- Item must be soft-deleted
- Hard-delete in transaction, log all IDs

---

### Endpoint 5: Get Soft-Delete Audit Trail

**Route**: `GET /admin/trash/audit-log?workspaceId={id}&days=30`  
**Middleware**: authMiddleware → requirePlatformAdmin  
**Response**:
```json
{
  "logs": [
    {
      "id": "log_123",
      "entityType": "CUSTOMER",
      "deletedIds": ["cust_123", "cust_456"],
      "recordCount": 2,
      "reason": "Manual permanent deletion",
      "deletedByUser": "admin_001",
      "deletedAt": "2024-01-15T11:35:00Z"
    }
  ],
  "pagination": {
    "total": 45
  }
}
```

---

## 5. Security & Authentication

### 3-Layer Middleware Stack

All trash endpoints require:

```typescript
// Layer 1: authMiddleware - JWT validation, user lookup
router.post(
  "/admin/trash/:id/restore",
  authMiddleware,              // Validates JWT, sets req.user
  requirePlatformAdmin,        // Verifies req.user.isPlatformAdmin === true
  validateWorkspaceOperation,  // Verifies workspaceId in request body matches token
  controller.restoreItem
)
```

**Layer 1: authMiddleware**
- Validates JWT token from `Authorization: Bearer {token}`
- Extracts `workspaceId` from token claim
- Sets `req.user` and `req.workspaceId`
- Rejects if JWT expired or invalid

**Layer 2: requirePlatformAdmin**
- Checks `req.user.isPlatformAdmin === true`
- Only backoffice admins can access trash
- NO workspace-admin access (security boundary)

**Layer 3: validateWorkspaceOperation**
- Verifies `req.body.workspaceId === req.workspaceId` (from middleware)
- Prevents admin of workspace A from modifying workspace B
- Double-confirms workspaceId chain

### Login Blocking Middleware

```typescript
// In authMiddleware, after user lookup:
if (user.deletedAt !== null) {
  return res.status(403).json({
    error: "Account deleted",
    message: "Your account has been deleted and cannot be accessed",
    daysUntilPermanentDelete: Math.ceil(
      (90 - (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24))
    )
  })
}
```

### Cascade Verification (Safety)

Before any cascade delete, verify entire chain:

```typescript
// In UserUnsubscribeService:
const user = await userRepo.findById(userId)
if (!user) throw new NotFoundError()

// Verify role
const role = await roleService.getUserRole(userId)

// Owner cascade
if (role === "OWNER") {
  const workspace = await workspaceRepo.findByOwnerId(userId)
  if (!workspace) throw new NotFoundError("Workspace")
  
  // Verify workspaceId chain BEFORE cascade
  if (workspace.ownerId !== userId) {
    throw new UnauthorizedError("Owner verification failed")
  }
  
  // Now perform cascade in transaction
  return await prisma.$transaction(async (tx) => {
    await tx.user.update({ data: { deletedAt: new Date() } })
    await tx.workspace.update({ data: { deletedAt: new Date() } })
    // ... cascade rest
  })
}
```

---

## 6. Backoffice UI Components

### TrashPage Component Structure

```
TrashPage.tsx
├── Tabs (4 sections)
│   ├── Tab 1: Deleted Customers
│   │   ├── List with pagination, filters
│   │   ├── Columns: ID, Name, Email, Phone, Deleted Date, Countdown, Actions
│   │   ├── Action buttons: Restore, Permanently Delete
│   │   └── Modals:
│   │       ├── RestoreModal (shows cascade impact preview)
│   │       └── PermanentDeleteModal (requires "PERMANENTLY DELETE" text)
│   │
│   ├── Tab 2: Deleted Workspaces
│   │   ├── List with pagination
│   │   ├── Columns: Workspace Name, Owner, Deletion Date, Countdown, Customer Count
│   │   └── Action buttons: Restore (with cascade preview), Permanently Delete
│   │
│   ├── Tab 3: Deleted Agents
│   │   ├── List with pagination, filter by workspace
│   │   ├── Columns: Name, Email, Role, Workspace, Deletion Date, Countdown
│   │   └── Action buttons: Restore, Permanently Delete
│   │
│   └── Tab 4: Deleted Operators (Platform-level users)
│       ├── List with pagination
│       ├── Columns: Name, Email, Deletion Date, Countdown
│       └── Action buttons: Restore, Permanently Delete
│
├── Filters (shared across tabs)
│   ├── Date range filter
│   ├── Workspace filter (for customer/agent tabs)
│   └── Search by name/email
│
├── Cascade Impact Preview Modal
│   ├── Shows: "Restoring customer will restore X orders, Y messages, Z sessions"
│   └── Buttons: Confirm | Cancel
│
└── Permanent Delete Confirmation Modal
    ├── Warning text in red
    ├── Requires typing "PERMANENTLY DELETE"
    ├── Buttons: Permanently Delete | Cancel
    └── Shows estimated deletion date if within window
```

**UI State**:
- Loading states for async operations
- Error toasts for failed operations
- Success toasts for completed operations
- Real-time countdown (updates every minute, not every second)

---

## 7. Integration Test Strategy (8-Phase Lifecycle)

### Phase 1: Setup
- Start Docker container (port 5433, isolated DB)
- Load seed with `TEST_MODE=true`
- Create test workspace + customers + orders

### Phase 2: Baseline Counts
- Get baseline counts: customers (10), orders (50), messages (200)
- Store in state for later verification

### Phase 3: Soft Delete Owner
- Delete owner account via API
- Verify:
  - `user.deletedAt != null`
  - `workspace.deletedAt != null`
  - `customer.deletedAt != null` (all 10)
  - `order.deletedAt != null` (all 50)
  - Transaction atomic (all or nothing)

### Phase 4: Query Visibility
- Try GET `/customers` → must NOT return soft-deleted customers
- Try GET `/admin/trash/customers` → MUST return soft-deleted customers
- Verify soft-delete filter working

### Phase 5: Login Blocking
- Try login with deleted user → must return 403 "Account deleted"
- Verify login middleware checking `deletedAt`

### Phase 6: Restore
- Call restore endpoint for customer
- Verify:
  - `customer.deletedAt = null` (restored)
  - `order.deletedAt = null` (cascade restored)
  - `message.deletedAt = null` (cascade restored)
  - Count = baseline (all records back)

### Phase 7: Hard Delete
- Simulate scheduler: call hard-delete endpoint for customer
- Verify:
  - Customer physically removed from DB
  - All related orders removed
  - Audit log entry created
  - Count matches baseline - deleted records

### Phase 8: Final Verification
- Verify all phases independent and isolated
- No data leakage between tests
- Concurrency: Run multiple deletes in parallel, verify isolation

---

## 8. Implementation Checklist

### Database
- [ ] Create migration: Add `deletedAt DateTime?` to 19 tables
- [ ] Create migration: Add `SoftDeleteAuditLog` table
- [ ] Add indexes: `deletedAt`, `(workspaceId, deletedAt)`
- [ ] Update Prisma schema
- [ ] Run migration in test environment

### Service Layer
- [ ] Create `UserUnsubscribeService` with role detection
- [ ] Create `DeletionSchedulerService` for 11:20 AM job
- [ ] Create `TrashRestoreService` for restore transactions
- [ ] Create `SoftDeleteHelper` utility with filter builders

### Repository Layer
- [ ] Update ALL repositories: Add `buildSoftDeleteFilter()` to queries
- [ ] Add methods: `getSoftDeleted()`, `restoreMany()`, `hardDeleteMany()`
- [ ] Add methods: `getDeleteAuditTrail()`, `getRetentionExpiredRecords()`
- [ ] Update 200+ queries to include soft-delete filter

### API & Middleware
- [ ] POST `/admin/users/{id}/unsubscribe` endpoint
- [ ] GET `/admin/trash/{type}` endpoints (customers, workspaces, agents)
- [ ] POST `/admin/trash/{id}/restore` endpoint
- [ ] POST `/admin/trash/{id}/permanently-delete` endpoint
- [ ] GET `/admin/trash/audit-log` endpoint
- [ ] Create `requirePlatformAdmin` middleware
- [ ] Enhance `authMiddleware` for login blocking
- [ ] Add 3-layer middleware stack to all endpoints

### Backoffice UI
- [ ] Create `TrashPage.tsx` with 4 tabs
- [ ] Create `DeletedCustomersList` component
- [ ] Create `DeletedWorkspacesList` component
- [ ] Create `DeletedAgentsList` component
- [ ] Create `RestoreModal` with cascade preview
- [ ] Create `PermanentDeleteModal` with confirmation text
- [ ] Add trash link to sidebar navigation
- [ ] Add filters, pagination, search

### Testing
- [ ] Integration test: 8-phase lifecycle test
- [ ] Unit tests: Service layer cascade logic
- [ ] Security tests: Middleware access control
- [ ] Unit tests: Repository soft-delete filters
- [ ] Integration test: Login blocking
- [ ] Integration test: Scheduler hard-delete

### Documentation
- [ ] Update Swagger with all 5 endpoints
- [ ] Add JSDoc comments to all new functions
- [ ] Create operations guide: "How to restore customer data"
- [ ] Create architecture diagram: Cascade flow

### Infrastructure
- [ ] `docker-compose.test.yml` with PostgreSQL on 5433
- [ ] `.env.test` with `SOFT_DELETE_RETENTION_DAYS=1`
- [ ] npm scripts: `test:soft-delete:setup`, `test:soft-delete:run`, `test:soft-delete`

---

## 9. Success Criteria

✅ **All user stories independently implementable and testable**  
✅ **All 5 API endpoints documented in Swagger**  
✅ **90-day retention window configurable via .env**  
✅ **Scheduler runs daily @ 11:20 AM with audit logging**  
✅ **Login blocking middleware prevents deleted account access**  
✅ **Backoffice UI shows cascade impact before delete**  
✅ **Transaction-based restore restores ALL related data**  
✅ **Query filters exclude soft-deleted data (except trash queries)**  
✅ **3-layer middleware blocks unauthorized access**  
✅ **Integration test verifies 8-phase lifecycle**  
✅ **All 200+ queries include soft-delete filter**  
✅ **Zero orphaned records (all cascade atomic)**  
✅ **Audit trail logs every hard-delete ID + workspaceId chain**  

---

## 10. Risk Mitigation

### Risk: Wrong records deleted (misidentified workspaceId)
**Mitigation**: 
- 3-layer middleware verifies workspaceId before cascade
- Cascade verification checks entire chain (owner → workspace → customers → orders)
- Audit logging records all deleted IDs for post-mortem analysis
- Pre-delete query shows customer count + order count for visual verification

### Risk: Partial cascade (transaction failure)
**Mitigation**:
- All cascade operations in single Prisma transaction (atomic)
- On error: entire transaction rolls back (no partial deletes)
- Error logged with full stack trace

### Risk: Data permanently lost before 90 days
**Mitigation**:
- Soft-delete prevents accidental permanent removal
- Restore available within 90 days (manual or scheduler-delayed)
- Audit trail proves deletion was intentional
- Backups still available (separate from soft-delete system)

### Risk: Scheduler job runs simultaneously on multiple instances
**Mitigation**:
- Scheduler job updates `SchedulerJobStatus.lastRun` in transaction
- Check current time ≠ last run time (prevents duplicate runs within same minute)
- Database lock on `SchedulerJobStatus` during hard-delete

---

## 11. Implementation Order (Recommended)

1. **Schema migrations** (DB foundation)
2. **Repository helper** `buildSoftDeleteFilter()` + apply to 200+ queries
3. **New services**: UserUnsubscribeService, DeletionSchedulerService, TrashRestoreService
4. **API endpoints** (backend logic)
5. **Middleware**: `requirePlatformAdmin`, enhance `authMiddleware`
6. **Backoffice UI** (frontend)
7. **Integration tests** (validation)
8. **Scheduler job** (production cleanup)

---

## 12. NEEDS CLARIFICATION

None - Design is complete and locked. Ready for planning phase.

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
