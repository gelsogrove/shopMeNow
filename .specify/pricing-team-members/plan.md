# Phase 1: Quick Start Guide

## Overview

This document provides developers with a fast track to implementing the Pricing & Team Members Limits feature.

---

## Timeline & Effort

**Total Effort**: ~8-10 hours of focused work
- Database & Migrations: 1-2 hours
- Backend Implementation: 3-4 hours
- Frontend Implementation: 2-3 hours
- Testing & Integration: 1-2 hours

**Work Sequencing** (must follow this order):

```
Week 1:
  [1h]   Database migration & seed
  [2h]   Backend: Update services & middleware
  [1h]   Backend: Add i18n keys
  [2h]   Frontend: Fetch from API, remove hardcodes
  [1h]   Frontend: Add UI feedback (button state, tooltips)
  [1h]   Testing & verification
```

---

## Phase 1: Database (1-2 hours)

### Step 1.1: Create Prisma Migration
**File**: Create new file `apps/backend/prisma/migrations/[timestamp]_add_team_members_limit/migration.sql`

```sql
-- AddTeamMembersLimitToPlanConfiguration
ALTER TABLE plan_configuration ADD COLUMN max_team_members INTEGER NULL;

-- Update seed values
UPDATE plan_configuration SET max_team_members = 0 WHERE plan_type = 'FREE_TRIAL';
UPDATE plan_configuration SET max_team_members = 3 WHERE plan_type = 'BASIC';
UPDATE plan_configuration SET max_team_members = NULL WHERE plan_type = 'PREMIUM';
UPDATE plan_configuration SET max_team_members = NULL WHERE plan_type = 'ENTERPRISE';
```

### Step 1.2: Update Prisma Schema
**File**: `apps/backend/prisma/schema.prisma`

Find `model PlanConfiguration` and add this line:
```prisma
maxTeamMembers        Int?
```

### Step 1.3: Update Seed Script
**File**: `apps/backend/prisma/seed.ts`

Add `maxTeamMembers` to each plan object in seed data:
```typescript
{
  planType: 'BASIC',
  displayName: 'Basic',
  maxTeamMembers: 3,  // ← ADD THIS
  // ... rest of fields
}
```

### Step 1.4: Run Migration
```bash
cd apps/backend
npx prisma migrate dev --name add_team_members_limit
npx prisma generate
npm run seed
```

### Step 1.5: Verify
```bash
npx prisma studio
# Visit http://localhost:5555 and check planConfiguration table
# Verify max_team_members column exists with correct values
```

---

## Phase 2: Backend Services (3-4 hours)

### Step 2.1: Enhance PlanLimits Interface
**File**: `apps/backend/src/repositories/subscription-billing.repository.ts`

Find `interface PlanLimits` and add field:
```typescript
export interface PlanLimits {
  // ... existing fields
  maxTeamMembers: number | null  // ← ADD THIS
}
```

### Step 2.2: Update getPlanConfiguration Method
**File**: `apps/backend/src/repositories/subscription-billing.repository.ts`

Find method and update return statement to include `maxTeamMembers`:
```typescript
async getPlanConfiguration(planType: PlanType): Promise<PlanLimits | null> {
  const config = await this.prisma.planConfiguration.findUnique({
    where: { planType },
  })

  if (!config) return null

  return {
    maxChannels: config.maxChannels,
    maxCustomers: config.maxCustomers,
    maxTeamMembers: config.maxTeamMembers,  // ← ADD THIS
    // ... rest of mapping
  }
}
```

### Step 2.3: Add Team Member Count Query
**File**: `apps/backend/src/repositories/subscription-billing.repository.ts`

Add new method to get team member usage count:
```typescript
async getWorkspaceTeamMemberCount(workspaceId: string): Promise<number> {
  return this.prisma.userWorkspace.count({
    where: {
      workspaceId: workspaceId,
      status: { in: ['ACTIVE', 'PENDING'] }
    }
  })
}
```

### Step 2.4: Update checkPlanLimits Method
**File**: `apps/backend/src/application/services/subscription-billing.service.ts`

Find `checkPlanLimits()` method and extend the switch statement to handle "teamMembers":

```typescript
switch (limitType) {
  case "customers":
    current = usage.customersCount
    max = limits.maxCustomers
    break
  case "channels":
    current = usage.channelsCount
    max = limits.maxChannels
    break
  case "teamMembers":  // ← ADD THIS CASE
    current = await this.repository.getWorkspaceTeamMemberCount(workspaceId)
    max = limits.maxTeamMembers ?? 999  // NULL = unlimited
    break
  default:
    throw new Error(`Unknown limit type: ${limitType}`)
}
```

### Step 2.5: Update getAvailablePlans Method
**File**: `apps/backend/src/application/services/subscription-billing.service.ts`

Find `getAvailablePlans()` and add `maxTeamMembers` to returned object:
```typescript
async getAvailablePlans() {
  const plans = await this.repository.getAllPlanConfigurations()
  return plans.map((plan) => ({
    planType: plan.planType,
    displayName: plan.displayName,
    monthlyFee: Number(plan.monthlyFee),
    maxChannels: plan.maxChannels,
    maxTeamMembers: plan.maxTeamMembers,  // ← ADD THIS
    // ... rest of mapping
  }))
}
```

### Step 2.6: Update Middleware
**File**: `apps/backend/src/interfaces/http/middlewares/billing.middleware.ts`

The `checkPlanLimits` middleware already supports custom limitTypes. It should now work automatically with "teamMembers" since we updated the service logic above.

### Step 2.7: Add i18n Keys
**File**: `apps/frontend/src/contexts/LanguageContext.tsx`

Add these keys to both `it:` and `en:` sections:

```typescript
// In en: section
"error.teamMemberLimitReached": "Team member limit reached",
"error.teamMemberLimitInfo": "Your {{planName}} plan supports up to {{max}} team members. You currently have {{current}}.",
"error.teamMemberLimitUpgrade": "Upgrade to a higher plan for unlimited team members.",
"billing.inviteDisabled": "Invite disabled - team member limit reached",

// In it: section  
"error.teamMemberLimitReached": "Limite di membri team raggiunto",
"error.teamMemberLimitInfo": "Il tuo piano {{planName}} supporta fino a {{max}} membri del team. Ne hai {{current}}.",
"error.teamMemberLimitUpgrade": "Passa a un piano superiore per illimitati membri del team.",
"billing.inviteDisabled": "Invito disabilitato - limite di membri team raggiunto",
```

### Step 2.8: Test Backend
```bash
# Build and run tests
cd apps/backend
npm run test:unit

# Test in browser: curl endpoint
curl http://localhost:3001/subscription/plans
# Should include maxTeamMembers in response
```

---

## Phase 3: Frontend (2-3 hours)

### Step 3.1: Update API Interface
**File**: `apps/frontend/src/services/subscriptionBillingApi.ts`

Find `interface PlanInfo` and add field:
```typescript
export interface PlanInfo {
  // ... existing fields
  maxTeamMembers: number | null  // ← ADD THIS
}
```

### Step 3.2: Remove Hardcoded Limits
**File**: `apps/frontend/src/config/planFeatures.ts`

Replace hardcoded limits object with API fetch. Here's the pattern:

**OLD** (hardcoded):
```typescript
const PLAN_CONFIGS: Record<string, PlanConfig> = {
  BASIC: {
    limits: {
      channels: 1,
      customers: 50,
      teamMembers: 0,  // ← Remove this
    }
  }
}
```

**NEW** (fetch from API):
```typescript
// Keep type definitions but populate from API
export async function loadPlanConfigs(): Promise<Record<string, PlanConfig>> {
  const plans = await subscriptionBillingApi.getAvailablePlans()
  const configs: Record<string, PlanConfig> = {}
  
  plans.forEach((plan) => {
    configs[plan.planType] = {
      name: plan.displayName,
      price: plan.monthlyFee,
      limits: {
        channels: plan.maxChannels ?? 'unlimited',
        customers: plan.maxCustomers ?? 'unlimited',
        teamMembers: plan.maxTeamMembers ?? 'unlimited'  // ← Dynamic
      },
      // ... rest
    }
  })
  
  return configs
}
```

### Step 3.3: Update Component to Use API Data
**File**: `apps/frontend/src/pages/PricingPlans.tsx` (or where pricing is displayed)

Instead of directly importing PLAN_CONFIGS, fetch from API:

```typescript
import { getAvailablePlans } from '@/services/subscriptionBillingApi'

export function PricingPlans() {
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlans = async () => {
      const data = await getAvailablePlans()
      setPlans(data)
      setLoading(false)
    }
    loadPlans()
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {plans.map((plan) => (
        <PlanCard
          key={plan.planType}
          name={plan.displayName}
          price={plan.monthlyFee}
          teamMembers={plan.maxTeamMembers}  // ← Use API data
          // ...
        />
      ))}
    </div>
  )
}
```

### Step 3.4: Update PlanCard Display
**File**: `apps/frontend/src/components/PlanCard.tsx` (or similar)

Add team member limit to displayed features:

```tsx
function PlanCard({ teamMembers, ...props }) {
  const getTeamMemberDisplay = () => {
    if (teamMembers === null) return "Unlimited"
    if (teamMembers === 0) return "Not included"
    return `Up to ${teamMembers}`
  }

  return (
    <div className="plan-card">
      {/* ... existing features */}
      <Feature 
        name="Team Members" 
        value={getTeamMemberDisplay()}
        included={teamMembers !== 0}
      />
    </div>
  )
}
```

### Step 3.5: Update Invite Button State
**File**: `apps/frontend/src/components/InviteTeamMemberButton.tsx` (or similar)

Disable button when at limit:

```typescript
function InviteButton({ workspace, plan }) {
  const [teamCount, setTeamCount] = useState(0)
  
  const isAtLimit = 
    plan.maxTeamMembers !== null && 
    teamCount >= plan.maxTeamMembers
  
  return (
    <Button
      disabled={isAtLimit}
      title={isAtLimit ? "Team member limit reached" : "Invite"}
      onClick={handleInvite}
    >
      Invite Team Member
    </Button>
  )
}
```

### Step 3.6: Error Handling
**File**: `apps/frontend/src/components/InviteDialog.tsx` or invite submit handler

Catch and display limit error:

```typescript
async function submitInvite(email: string) {
  try {
    await inviteTeamMember(workspaceId, email)
    toast.success("Invitation sent!")
  } catch (error) {
    if (error.code === "TEAM_MEMBER_LIMIT_REACHED") {
      toast.error(
        t("error.teamMemberLimitInfo", {
          planName: workspace.planType,
          max: error.details.max,
          current: error.details.current
        })
      )
    } else {
      toast.error("Failed to invite team member")
    }
  }
}
```

---

## Phase 4: Testing & Verification (1-2 hours)

### Step 4.1: Database Verification
```bash
# Check schema
npx prisma studio
# Navigate to planConfiguration table
# Verify max_team_members column with correct values
```

### Step 4.2: Backend API Test
```bash
# Test endpoint
curl http://localhost:3001/subscription/plans | jq

# Expected output should include maxTeamMembers for each plan
# FREE_TRIAL: 0
# BASIC: 3
# PREMIUM: null
# ENTERPRISE: null
```

### Step 4.3: Frontend Visual Check
```bash
# Start frontend
cd apps/frontend
npm run dev

# Navigate to /pricing
# Verify team member limits display correctly
# FREE_TRIAL: "Not included" or hidden
# BASIC: "Up to 3"
# PREMIUM: "Unlimited"
# ENTERPRISE: "Unlimited"
```

### Step 4.4: Invitation Flow Test
```
1. Open workspace on BASIC plan
2. Invite 1st team member → Success
3. Invite 2nd team member → Success
4. Invite 3rd team member → Success
5. Try to invite 4th → Error (limit reached)
6. Verify error message is clear and in correct language
```

### Step 4.5: Plan Change Test
```
1. Start on BASIC (3 team members max)
2. Invite 3 members → Success
3. Try to downgrade to... wait, we can't (all plans have same or higher limits except FREE_TRIAL)
4. Upgrade to PREMIUM → Invite unlimited members → Success
```

---

## Checklist for Completion

### Database
- [ ] Migration created and applied
- [ ] Prisma schema updated
- [ ] Seed script updated
- [ ] `npx prisma generate` run successfully
- [ ] Column verified in database

### Backend
- [ ] PlanLimits interface updated
- [ ] getPlanConfiguration includes maxTeamMembers
- [ ] getWorkspaceTeamMemberCount method added
- [ ] checkPlanLimits handles "teamMembers" case
- [ ] getAvailablePlans includes maxTeamMembers in response
- [ ] i18n keys added to LanguageContext
- [ ] Tests pass: `npm run test:unit`

### Frontend
- [ ] API interface PlanInfo updated
- [ ] planFeatures.ts refactored to use API data
- [ ] PricingPlans component fetches from API
- [ ] PlanCard displays team member limits
- [ ] Invite button disabled at limit
- [ ] Error handling for limit exceeded
- [ ] i18n keys used in error messages
- [ ] Tested in browser at /pricing and invite flows

### Testing
- [ ] API endpoint returns maxTeamMembers
- [ ] Pricing page displays limits correctly
- [ ] Invite succeeds within limit
- [ ] Invite fails at limit with correct error
- [ ] Error messages display in correct language
- [ ] No console errors

---

## Common Issues & Solutions

### Issue: maxTeamMembers is null in database but shows as 0 in frontend

**Solution**: Update comparison logic to treat `null` as unlimited:
```typescript
const max = plan.maxTeamMembers ?? 999  // NULL = unlimited = 999
```

### Issue: Pricing page shows old hardcoded values

**Solution**: Clear browser cache and ensure API fetch is called:
```bash
# Check Network tab in DevTools
# Verify GET /subscription/plans returns new field
```

### Issue: Invite button not disabled at limit

**Solution**: Fetch current team member count from workspace data:
```typescript
const currentCount = workspace.teamMembers?.length ?? 0
const isAtLimit = currentCount >= plan.maxTeamMembers
```

### Issue: i18n keys not translating

**Solution**: Verify keys are in correct section:
```typescript
// Check it: and en: sections both have the keys
// Ensure LanguageContext is imported correctly
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/pricing-team-members

# Make all changes
# ... (follow phases above)

# Commit when complete
git add .
git commit -m "feat: Add team member limits per plan (FREE_TRIAL:0, BASIC:3, PREMIUM/ENTERPRISE:unlimited)"

# Push to GitHub
git push origin feature/pricing-team-members

# Create PR and request review
```

---

## Review Checklist (for PR Reviewer)

- [ ] Database migration is idempotent and reversible
- [ ] Prisma schema matches migration
- [ ] Seed values match spec (FREE:0, BASIC:3, PREMIUM/ENT:null)
- [ ] Backend API includes maxTeamMembers in response
- [ ] Frontend fetches from API (no hardcoded values)
- [ ] Error handling is user-friendly and localized
- [ ] No console errors or warnings
- [ ] All existing tests still pass
- [ ] New functionality tested manually

---

## Next Steps After Completion

1. **Deploy to staging** and verify with Andrea
2. **Monitor database queries** - ensure team member count queries are efficient
3. **Collect feedback** from early users on limit values (adjust if needed)
4. **Plan Phase 2**: Consider team role-based features (e.g., different permissions per member)

---
