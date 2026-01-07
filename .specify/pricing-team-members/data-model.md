# Phase 1: Data Model

## Entity: PlanConfiguration (Enhancement)

### Overview
Existing table enhanced with team member limit field.

### Fields

| Field | Type | Default | Constraints | Purpose |
|-------|------|---------|-------------|---------|
| planType | String | - | PRIMARY KEY, UNIQUE | Identifies plan: FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE |
| displayName | String | - | NOT NULL | User-facing plan name ("Free Trial", "Basic", etc.) |
| monthlyFee | Decimal(10,2) | 0 | NOT NULL, >= 0 | Monthly subscription cost in USD |
| maxChannels | Integer | 1 | NOT NULL, > 0 | Max WhatsApp channels per workspace |
| maxProducts | Integer | NULL | NULLABLE | Max products in catalog per workspace |
| maxCustomers | Integer | 50 | NOT NULL, > 0 | Max customer records per workspace |
| **maxTeamMembers** | Integer | NULL | NULLABLE, >= 0 | **NEW FIELD** - Max team member invitations per workspace. NULL = unlimited |
| messageCost | Decimal(5,4) | 0.05 | NOT NULL, >= 0 | Cost per message in USD |
| orderCost | Decimal(5,4) | 0.25 | NOT NULL, >= 0 | Cost per order in USD |
| pushCost | Decimal(5,4) | 0.02 | NOT NULL, >= 0 | Cost per push notification in USD |
| lowBalanceThreshold | Decimal(10,2) | -10 | NOT NULL | Credit balance threshold for warnings |
| features | JSON | {} | NOT NULL | Feature flags for this plan (string-encoded or JSON) |
| createdAt | DateTime | NOW() | NOT NULL, DEFAULT | Record creation timestamp |
| updatedAt | DateTime | NOW() | NOT NULL, DEFAULT, ON UPDATE | Record last update timestamp |

### Data Values (Seed)

```sql
INSERT INTO PlanConfiguration (planType, displayName, monthlyFee, maxChannels, maxProducts, maxCustomers, maxTeamMembers, messageCost, orderCost, pushCost, lowBalanceThreshold, features)
VALUES
  ('FREE_TRIAL', 'Free Trial', 0, 1, NULL, 50, 0, 0.05, 0.25, 0.02, -10, '[]'),
  ('BASIC', 'Basic', 22, 1, NULL, 50, 3, 0.05, 0.25, 0.02, -10, '[]'),
  ('PREMIUM', 'Premium', 45, 2, NULL, 100, NULL, 0.05, 0.25, 0.02, -10, '[]'),
  ('ENTERPRISE', 'Enterprise', 140, NULL, NULL, NULL, NULL, 0.05, 0.25, 0.02, -10, '[]');
```

**Key Points**:
- FREE_TRIAL: `maxTeamMembers = 0` (owner-only, no invitations)
- BASIC: `maxTeamMembers = 3` (owner + 3 team members)
- PREMIUM: `maxTeamMembers = NULL` (unlimited)
- ENTERPRISE: `maxTeamMembers = NULL` (unlimited)

---

## Entity: UserWorkspace (Existing - No Changes)

Tracks team member invitations. Existing schema:

| Field | Type | Relationship | Purpose |
|-------|------|-------------|---------|
| id | String (UUID) | PRIMARY KEY | Unique invitation record |
| userId | String (Foreign Key) | → User | Team member's user ID |
| workspaceId | String (Foreign Key) | → Workspace | Workspace where invited |
| role | Enum (SUPER_ADMIN, ADMIN, MEMBER) | - | Team member's permission level |
| status | Enum (ACTIVE, PENDING, REVOKED) | - | Invitation state |
| createdAt | DateTime | - | Invitation creation time |
| updatedAt | DateTime | - | Last update time |

**No changes needed** - Existing model already supports team member tracking.

**Query Pattern for Limit Check**:
```typescript
const teamMemberCount = await prisma.userWorkspace.count({
  where: {
    workspaceId: workspaceId,
    status: { in: ["ACTIVE", "PENDING"] }
  }
})
```

---

## Entity: BillingInfo (Service Layer - Enhancement)

### Existing Structure (in service layer)
```typescript
interface BillingInfo {
  planType: PlanType
  creditBalance: number
  trialEndsAt: Date | null
  planStartedAt: Date
  nextBillingDate: Date | null
  isTrialExpired: boolean
  daysUntilTrialExpires: number | null
  totalRecharges: number
  subscriptionStatus: SubscriptionStatus
}
```

### Enhanced (in service response)
No changes to BillingInfo structure - limit checking is separate operation via `checkPlanLimits()`.

---

## Entity: PlanLimits (Service Layer - Enhancement)

### Existing Structure
```typescript
interface PlanLimits {
  maxChannels: number
  maxProducts: number | null
  maxCustomers: number
  maxTeamMembers: number | null      // ← NEW FIELD
  messageCost: number
  orderCost: number
  pushCost: number
  lowBalanceThreshold: number
  monthlyFee: number
}
```

### Changes
- Add `maxTeamMembers: number | null` field
- NULL represents "unlimited" in service logic
- Backend: Convert NULL to 999 for comparison logic
- Frontend: Convert NULL to "Unlimited" string for display

---

## Entity: PlanLimitCheckResult (Service Layer - Existing)

Already exists in `SubscriptionBillingService`:

```typescript
interface PlanLimitCheckResult {
  withinLimits: boolean
  current: number       // Current usage count
  max: number          // Plan limit
  limitType: "channels" | "customers" | "teamMembers"  // ← NEW TYPE OPTION
}
```

### Changes
- Add `"teamMembers"` as valid `limitType` option
- When `limitType = "teamMembers"`, `current` = count of team members, `max` = plan's `maxTeamMembers`
- If `max = null`, convert to 999 for comparison

---

## Relationships & Constraints

### Workspace → PlanConfiguration
```
Workspace.planType (Foreign Key) → PlanConfiguration.planType
```
- Workspace inherits limit values from its assigned plan
- When workspace plan changes, new limits apply immediately

### Workspace → UserWorkspace
```
Workspace (1) ──→ (many) UserWorkspace
```
- Count of `UserWorkspace` records = current team member count for workspace
- Must not exceed `PlanConfiguration.maxTeamMembers` for workspace's plan

### Validation Rules

#### Rule 1: Team Member Count Cannot Exceed Limit
```typescript
const teamCount = countTeamMembers(workspaceId)
const planLimit = getPlanConfiguration(workspace.planType).maxTeamMembers
if (planLimit !== null && teamCount >= planLimit) {
  throw new Error("Team member limit reached")
}
```

#### Rule 2: Downgrade Must Not Violate New Limit
```typescript
if (newPlanType !== workspace.planType) {
  const currentTeamCount = countTeamMembers(workspaceId)
  const newPlanLimit = getPlanConfiguration(newPlanType).maxTeamMembers
  if (newPlanLimit !== null && currentTeamCount > newPlanLimit) {
    throw new Error("Cannot downgrade: excess team members")
  }
}
```

#### Rule 3: Free Trial Allows No Invitations
```typescript
if (workspace.planType === 'FREE_TRIAL') {
  // maxTeamMembers = 0, so any invitation is rejected
  // No special code needed, validation logic handles it
}
```

---

## State Transitions

### Team Member Invitation Flow
```
User clicks "Invite Team Member" button
    ↓
    ├─→ VALIDATE: Check workspace plan limit
    │   ├─→ If at limit: SHOW ERROR, return
    │   └─→ If under limit: PROCEED
    │
    ├─→ CREATE: UserWorkspace record (status=PENDING)
    │
    ├─→ SEND: Email invitation link
    │
    └─→ WAIT: Team member accepts (status=ACTIVE)
```

### Plan Downgrade with Team Members
```
Owner clicks "Downgrade to BASIC" button
    ↓
    ├─→ VALIDATE: Check current team member count vs BASIC limit
    │   ├─→ If count > 3: SHOW ERROR "Remove X team members first"
    │   └─→ If count ≤ 3: PROCEED
    │
    └─→ UPDATE: Workspace.planType = BASIC
```

---

## Migration Plan

### Prisma Schema Changes
**File**: `apps/backend/prisma/schema.prisma`

```prisma
model PlanConfiguration {
  planType               String           @id @unique
  displayName           String
  monthlyFee            Decimal          @db.Decimal(10, 2)
  maxChannels           Int
  maxProducts           Int?
  maxCustomers          Int
  maxTeamMembers        Int?             // ← NEW FIELD
  messageCost           Decimal          @db.Decimal(5, 4)
  orderCost             Decimal          @db.Decimal(5, 4)
  pushCost              Decimal          @db.Decimal(5, 4)
  lowBalanceThreshold   Decimal          @db.Decimal(10, 2)
  features              String?          @db.Text
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@map("plan_configuration")
}
```

### Database Migration SQL
```sql
-- Create migration
ALTER TABLE plan_configuration ADD COLUMN max_team_members INTEGER NULL;

-- Update existing records
UPDATE plan_configuration SET max_team_members = 0 WHERE plan_type = 'FREE_TRIAL';
UPDATE plan_configuration SET max_team_members = 3 WHERE plan_type = 'BASIC';
UPDATE plan_configuration SET max_team_members = NULL WHERE plan_type = 'PREMIUM';
UPDATE plan_configuration SET max_team_members = NULL WHERE plan_type = 'ENTERPRISE';
```

### Seed Script Update
**File**: `apps/backend/prisma/seed.ts`

```typescript
const plans = [
  {
    planType: 'FREE_TRIAL',
    displayName: 'Free Trial',
    monthlyFee: 0,
    maxChannels: 1,
    maxProducts: null,
    maxCustomers: 50,
    maxTeamMembers: 0,  // ← NEW
    messageCost: 0.05,
    orderCost: 0.25,
    pushCost: 0.02,
    lowBalanceThreshold: -10,
    features: JSON.stringify([]),
  },
  // ... others
]
```

---

## Summary

| Component | Change Type | Scope |
|-----------|------------|-------|
| PlanConfiguration table | **ADD** `maxTeamMembers` column | Database migration |
| PlanLimits service interface | **ADD** `maxTeamMembers` field | Backend service |
| PlanLimitCheckResult | **EXTEND** limitType options | Backend validation |
| UserWorkspace model | **NO CHANGE** | Data model complete |
| Seed data | **UPDATE** plan limits | Database initialization |

**Total Changes**: Minimal - primarily adding one new field to existing table and extending service logic.
