# API Contract: GET /subscription/plans

## Endpoint
```
GET /subscription/plans
```

## Category
Public (unauthenticated)

## Purpose
Retrieve all available subscription plans with their features and limits for display on pricing page and plan selection dialogs.

## Request

### Headers
```
Content-Type: application/json
```

### Query Parameters
None

### Body
None

---

## Response

### Success (200 OK)
```json
{
  "data": [
    {
      "planType": "FREE_TRIAL",
      "displayName": "Free Trial",
      "monthlyFee": 0,
      "maxChannels": 1,
      "maxProducts": null,
      "maxCustomers": 50,
      "maxTeamMembers": 0,
      "messageCost": 0.05,
      "orderCost": 0.25,
      "pushCost": 0.02,
      "features": []
    },
    {
      "planType": "BASIC",
      "displayName": "Basic",
      "monthlyFee": 22,
      "maxChannels": 1,
      "maxProducts": null,
      "maxCustomers": 50,
      "maxTeamMembers": 3,
      "messageCost": 0.05,
      "orderCost": 0.25,
      "pushCost": 0.02,
      "features": ["channels", "customers", "multiLanguage", "analytics"]
    },
    {
      "planType": "PREMIUM",
      "displayName": "Premium",
      "monthlyFee": 45,
      "maxChannels": 2,
      "maxProducts": null,
      "maxCustomers": 100,
      "maxTeamMembers": null,
      "messageCost": 0.05,
      "orderCost": 0.25,
      "pushCost": 0.02,
      "features": ["channels", "customers", "teamMembers", "multiLanguage", "analytics"]
    },
    {
      "planType": "ENTERPRISE",
      "displayName": "Enterprise",
      "monthlyFee": 140,
      "maxChannels": null,
      "maxProducts": null,
      "maxCustomers": null,
      "maxTeamMembers": null,
      "messageCost": 0.05,
      "orderCost": 0.25,
      "pushCost": 0.02,
      "features": ["channels", "customers", "teamMembers", "multiLanguage", "analytics", "branding", "integrations", "dedicatedServer"]
    }
  ]
}
```

### Response Schema
```typescript
interface PlanInfo {
  planType: "FREE_TRIAL" | "BASIC" | "PREMIUM" | "ENTERPRISE"
  displayName: string
  monthlyFee: number
  maxChannels: number | null
  maxProducts: number | null
  maxCustomers: number | null
  maxTeamMembers: number | null    // NEW FIELD
  messageCost: number
  orderCost: number
  pushCost: number
  features: string[]
}

interface Response {
  data: PlanInfo[]
}
```

### Error Responses

#### 500 Internal Server Error
```json
{
  "error": "Failed to fetch plans",
  "code": "PLAN_FETCH_ERROR"
}
```

---

## Implementation Notes

### Backend Changes
- File: `apps/backend/src/application/services/subscription-billing.service.ts`
- Method: `getAvailablePlans()`
- Add `maxTeamMembers` field to returned object:
  ```typescript
  return plans.map((plan) => ({
    planType: plan.planType,
    displayName: plan.displayName,
    monthlyFee: Number(plan.monthlyFee),
    maxChannels: plan.maxChannels,
    maxProducts: plan.maxProducts,
    maxCustomers: plan.maxCustomers,
    maxTeamMembers: plan.maxTeamMembers,  // NEW
    messageCost: Number(plan.messageCost),
    orderCost: Number(plan.orderCost),
    pushCost: Number(plan.pushCost),
    features: typeof plan.features === "string"
      ? JSON.parse(plan.features)
      : plan.features ?? [],
  }))
  ```

### Frontend Changes
- File: `apps/frontend/src/services/subscriptionBillingApi.ts`
- Interface: `PlanInfo`
- Add `maxTeamMembers: number | null` to interface
- File: `apps/frontend/src/config/planFeatures.ts`
- Remove hardcoded limits, fetch from API instead

### Caching
- Cache plan data in component state/context
- Refresh on user login or plan change
- TTL: No expiration needed (plans rarely change)

---

## Testing

### Happy Path
```bash
curl -X GET http://localhost:3001/subscription/plans
```

Expected: Returns array of 4 plans with `maxTeamMembers` field populated.

### Validation
- [ ] All 4 plans returned
- [ ] FREE_TRIAL.maxTeamMembers = 0
- [ ] BASIC.maxTeamMembers = 3
- [ ] PREMIUM.maxTeamMembers = null
- [ ] ENTERPRISE.maxTeamMembers = null
- [ ] All numeric fields are numbers (not strings)
- [ ] All arrays are present

---
