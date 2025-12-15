# Feature Specification: Customer Query Filters for Push Campaigns

**Feature Branch**: \`187-customer-query-filters\`  
**Created**: 2024-11-29  
**Status**: Draft  
**Input**: User description: "improve customer query filters for push campaigns. Fix Specific Client filter and ensure blocked customers are excluded from target list"

---

## 1. Executive Summary

### Problem Statement
The current push campaign system has two critical issues:
1. **"Specific Client" filter doesn't work correctly** - When selecting \`targetType: SELECTED\`, the customer selection may not persist or work as expected
2. **Blocked customers may receive campaigns** - Need to verify and strengthen the exclusion logic for blacklisted customers

### Solution Overview
Audit and fix the complete flow from frontend customer selection → API → database storage → scheduler execution to ensure:
- Customer IDs are correctly saved when using "Specific Client" (\`SELECTED\`) target type
- Blocked/blacklisted customers are excluded at all levels (API, frontend, scheduler)
- Push notification consent is verified before sending

### Business Value
- Prevent spam to customers who opted out or are blocked
- Ensure targeted campaigns actually reach selected customers
- Improve compliance with privacy regulations (GDPR)

---

## 2. User Scenarios & Testing

### User Story 1 - Create Campaign with Specific Customers (Priority: P1)

As an admin, I want to create a push campaign targeting only specific customers so that I can send personalized promotions to VIP clients.

**Why this priority**: Core functionality - if this doesn't work, the "Specific Client" feature is broken.

**Independent Test**: 
1. Create new campaign with \`targetType: SELECTED\`
2. Select 3 customers from the list
3. Save campaign
4. Edit the campaign
5. Verify the 3 customers are still selected

**Acceptance Criteria**:
- [ ] Customer selection checkboxes work in create mode
- [ ] Selected customers are saved to database
- [ ] When editing, previously selected customers are pre-checked
- [ ] Submit button is disabled until at least 1 customer is selected

---

### User Story 2 - Blocked Customers Hidden from Selection (Priority: P1)

As an admin, I should NOT see blocked/blacklisted customers in the campaign selection list, so I don't accidentally target customers who don't want messages.

**Why this priority**: Critical for compliance - sending to blocked customers violates GDPR/privacy.

**Independent Test**:
1. Block a customer via Customer Management
2. Create a new campaign with \`targetType: SELECTED\`
3. Verify the blocked customer does NOT appear in the selection list

**Acceptance Criteria**:
- [ ] Customers with \`isBlacklisted = true\` are hidden
- [ ] Customers without push consent are hidden
- [ ] Customers without GDPR acceptance are hidden
- [ ] Only eligible customers appear in selection list

---

### User Story 3 - Runtime Eligibility Check (Priority: P2)

As a system, when executing a scheduled campaign, I must re-verify customer eligibility to handle cases where a customer was blocked after campaign creation.

**Why this priority**: Edge case protection - ensures last-line-of-defense filtering.

**Independent Test**:
1. Create campaign with customer X selected
2. Block customer X
3. Trigger campaign execution
4. Verify customer X is SKIPPED (not sent)
5. Verify skip is logged with reason

**Acceptance Criteria**:
- [ ] Scheduler re-verifies eligibility at send time
- [ ] Blocked customers are skipped with log entry
- [ ] Campaign stats show "eligible" vs "attempted"

---

### User Story 4 - "All Customers" Campaign Excludes Blocked (Priority: P2)

As an admin, when I create a campaign targeting "All Customers", only eligible customers should receive it.

**Why this priority**: Prevents mass-messaging to opted-out customers.

**Independent Test**:
1. Block customer X
2. Create campaign with \`targetType: ALL\`
3. Trigger execution
4. Verify customer X is NOT included

**Acceptance Criteria**:
- [ ] \`targetType: ALL\` only includes eligible customers
- [ ] Filtering is consistent with "Specific Client" filtering

---

## 3. Technical Analysis

### 3.1 Current Implementation Status

#### Frontend: \`CampaignSheet.tsx\` (ALREADY IMPLEMENTED ✅)
\`\`\`typescript
// Lines 126-143: Customer filtering
const validCustomers = (data.data || []).filter((customer: Customer) => {
  const isBlocked = customer.isBlacklisted === true
  const hasConsentPush = customer.push_notifications_consent === true
  const hasGDPR = !!customer.last_privacy_version_accepted
  return !isBlocked && hasConsentPush && hasGDPR
})
\`\`\`

#### Backend: \`campaign-scheduler.service.ts\` (ALREADY IMPLEMENTED ✅)
\`\`\`typescript
// Lines 130-148: Target customer retrieval
if (campaign.targetType === 'SELECTED' && campaign.customerIds.length > 0) {
  customers = await this.prisma.customer.findMany({
    where: {
      workspaceId: campaign.workspaceId,
      id: { in: campaign.customerIds },
      isBlacklisted: false,
      isActive: true,
      push_notifications_consent: true,
    },
  })
}
\`\`\`

### 3.2 Identified Issues

#### Issue 1: \`customerIds\` Not Persisting (NEEDS INVESTIGATION)
**Hypothesis**: The frontend sends \`customerIds\` but they may not be saved correctly in database.

**Investigation Points**:
1. Check if \`campaignService.create()\` saves \`customerIds\` correctly
2. Check if \`campaignService.update()\` updates \`customerIds\` correctly
3. Verify the Campaign model accepts \`String[]\` for \`customerIds\`

#### Issue 2: Customer List API May Return All Customers
**Hypothesis**: The \`/workspaces/:workspaceId/customers\` API returns ALL customers including blocked ones, relying on frontend filtering.

**Recommendation**: Add server-side filtering with \`?forCampaign=true\` query param.

### 3.3 Proposed Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  CampaignSheet.tsx                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ loadCustomers()                                          │   │
│  │ GET /customers?forCampaign=true ──────────────────────► │   │
│  │ ◄────────────── Returns only eligible customers          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  customer.controller.ts                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ GET /customers?forCampaign=true                          │   │
│  │ - Apply filters: isBlacklisted, consent, GDPR            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  campaign.controller.ts                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ POST/PUT /campaigns                                      │   │
│  │ - Validate customerIds against eligible customers        │   │
│  │ - Store customerIds in database                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SCHEDULER                                 │
│  campaign-scheduler.service.ts                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ getTargetCustomers()                                     │   │
│  │ - Re-verify eligibility at send time                     │   │
│  │ - Log excluded customers with reasons                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 4. Implementation Plan

### Phase 1: Debugging & Root Cause Analysis
1. Add debug logging to \`campaignService.create()\` and \`update()\` to trace \`customerIds\`
2. Verify database schema allows \`String[]\` for \`customerIds\` (confirmed: \`customerIds String[] @default([])\`)
3. Test frontend-to-backend flow with network inspector

### Phase 2: Backend Fixes
1. **customer.controller.ts**: Add \`?forCampaign=true\` query param to filter eligible customers server-side
2. **campaign.controller.ts**: Validate that provided \`customerIds\` are all eligible before saving
3. **campaign.service.ts**: Ensure \`customerIds\` are correctly stored and retrieved

### Phase 3: Frontend Fixes
1. **CampaignSheet.tsx**: Use \`?forCampaign=true\` when loading customers
2. Verify \`customerIds\` state is correctly populated from campaign data
3. Add visual feedback for customer eligibility status

### Phase 4: Testing & Validation
1. Unit tests for customer filtering logic
2. Integration tests for campaign creation with \`SELECTED\` target
3. E2E test: Create campaign → Edit campaign → Verify customerIds persist

---

## 5. Files to Modify

### Backend
| File | Changes |
|------|---------|
| \`apps/backend/src/interfaces/http/controllers/customer.controller.ts\` | Add \`forCampaign\` filter option |
| \`apps/backend/src/interfaces/http/controllers/campaign.controller.ts\` | Add debug logging, validate customerIds |
| \`apps/backend/src/application/services/campaign.service.ts\` | Verify customerIds storage |
| \`apps/backend/src/services/campaign-scheduler.service.ts\` | Add detailed logging for excluded customers |

### Frontend
| File | Changes |
|------|---------|
| \`apps/frontend/src/components/shared/CampaignSheet.tsx\` | Update customer loading, verify state management |

### Tests
| File | Purpose |
|------|---------|
| \`apps/backend/__tests__/unit/campaign.service.spec.ts\` | Test customerIds persistence |
| \`apps/backend/__tests__/integration/campaign-customer-filter.spec.ts\` | Test customer filtering |

---

## 6. Database Schema

### Existing Schema (No Changes Required)
\`\`\`prisma
model Campaign {
  id             String            @id @default(cuid())
  workspaceId    String
  targetType     CampaignTargetType @default(ALL)
  customerIds    String[]           @default([])  // ✅ Already supports array
  // ...
}

model Customer {
  id                            String   @id @default(cuid())
  workspaceId                   String
  isBlacklisted                 Boolean  @default(false)
  isActive                      Boolean  @default(true)
  push_notifications_consent    Boolean  @default(false)
  last_privacy_version_accepted String?
  // ...
}
\`\`\`

---

## 7. API Contracts

### GET /workspaces/:workspaceId/customers
**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| forCampaign | boolean | If true, only return customers eligible for campaigns |

**Response (with forCampaign=true)**:
\`\`\`json
{
  "data": [
    {
      "id": "cust_123",
      "name": "Mario Rossi",
      "email": "mario@example.com",
      "phone": "+39123456789",
      "isBlacklisted": false,
      "push_notifications_consent": true,
      "last_privacy_version_accepted": "v2.0"
    }
  ],
  "pagination": { ... }
}
\`\`\`

---

## 8. 360-Degree Validation Checklist

- [ ] Frontend: Component design, API calls, error handling, loading states
- [ ] Backend API: Route, middleware stack (auth/session/workspace), controller
- [ ] Service Layer: Business logic, workspace isolation, error handling
- [ ] Repository: Database queries with \`workspaceId\` filter
- [ ] Database: No migration needed (schema already supports customerIds)
- [ ] Security: 3-layer middleware, workspace isolation tests
- [ ] Testing: Unit tests, security tests, integration tests
- [ ] Documentation: Swagger/OpenAPI updated with @swagger tags
- [ ] Concurrency: Transaction usage for campaign updates
- [ ] Code Cleanliness: No temp files, no unused code, no duplication

---

## 9. Testing Strategy

### Unit Tests
\`\`\`typescript
describe('CampaignService', () => {
  it('should save customerIds when targetType is SELECTED', async () => {
    const campaign = await campaignService.create({
      workspaceId: 'ws_1',
      targetType: 'SELECTED',
      customerIds: ['cust_1', 'cust_2'],
      // ...
    })
    expect(campaign.customerIds).toEqual(['cust_1', 'cust_2'])
  })
  
  it('should reject blacklisted customerIds', async () => {
    // Create blacklisted customer
    // Try to create campaign with that customer
    // Expect validation error
  })
})
\`\`\`

### Integration Tests
\`\`\`typescript
describe('Campaign Customer Filter API', () => {
  it('GET /customers?forCampaign=true excludes blocked customers', async () => {
    // Create blocked customer
    // Call API with forCampaign=true
    // Expect blocked customer NOT in response
  })
})
\`\`\`

---

## 10. Open Questions

1. **Q**: Should we show customers as "ineligible" in the UI (greyed out) or completely hide them?
   - **Proposed**: Hide them completely (current behavior) for cleaner UX

2. **Q**: Should we validate customerIds against eligibility at save time, or only at send time?
   - **Proposed**: Both - validate at save time (reject save) AND at send time (skip with log)

3. **Q**: Should scheduler send to customers who became eligible after campaign creation?
   - **Proposed**: For \`targetType: SELECTED\`, only send to originally selected IDs. For \`ALL\`, include new eligible customers.

---

## 11. References

- PRD Section: Push Notifications & Campaigns
- Related Feature: 180-whatsapp-queue
- Database Schema: \`packages/database/prisma/schema.prisma\` lines 1170-1200
