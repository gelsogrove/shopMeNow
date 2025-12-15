# Feature 187: Customer Query Filters - Requirements Checklist

## User Story 1 - Create Campaign with Specific Customers (P1)

### Frontend
- [ ] `CampaignSheet.tsx` - Customer checkboxes work in create mode
- [ ] `CampaignSheet.tsx` - Selected customers state (`customerIds`) is correctly managed
- [ ] `CampaignSheet.tsx` - Submit button disabled when `targetType=SELECTED` and no customers selected
- [ ] `CampaignSheet.tsx` - Pre-populate `customerIds` when editing existing campaign

### Backend
- [ ] `campaign.controller.ts` - Validate `customerIds` is array when `targetType=SELECTED`
- [ ] `campaign.controller.ts` - Log received `customerIds` for debugging
- [ ] `campaign.service.ts` - Correctly store `customerIds` in database on create
- [ ] `campaign.service.ts` - Correctly update `customerIds` in database on update
- [ ] `campaign.service.ts` - Return `customerIds` in campaign response

### Testing
- [ ] Unit test: Create campaign with `SELECTED` saves customerIds
- [ ] Unit test: Update campaign with `SELECTED` updates customerIds
- [ ] Integration test: Full flow create → retrieve → verify customerIds

---

## User Story 2 - Blocked Customers Hidden from Selection (P1)

### Frontend
- [ ] `CampaignSheet.tsx` - Filter out `isBlacklisted=true` customers
- [ ] `CampaignSheet.tsx` - Filter out `push_notifications_consent=false` customers
- [ ] `CampaignSheet.tsx` - Filter out `last_privacy_version_accepted=null` customers
- [ ] `CampaignSheet.tsx` - Log excluded customers with reason (for debugging)

### Backend
- [ ] `customer.controller.ts` - Add `?forCampaign=true` query param
- [ ] `customer.controller.ts` - Apply eligibility filters server-side when `forCampaign=true`
- [ ] Swagger docs updated for new query param

### Testing
- [ ] Unit test: Customer service filters blocked customers
- [ ] Integration test: GET /customers?forCampaign=true excludes blocked

---

## User Story 3 - Runtime Eligibility Check (P2)

### Scheduler
- [ ] `campaign-scheduler.service.ts` - Re-verify eligibility at send time
- [ ] `campaign-scheduler.service.ts` - Log skipped customers with reason
- [ ] `campaign-scheduler.service.ts` - Track "eligible" vs "attempted" count
- [ ] `campaign-scheduler.service.ts` - Update campaign stats after execution

### Testing
- [ ] Unit test: Scheduler skips blocked customers
- [ ] Unit test: Scheduler logs skip reason
- [ ] Integration test: Block customer after campaign creation → verify skipped

---

## User Story 4 - "All Customers" Campaign Excludes Blocked (P2)

### Scheduler
- [ ] `campaign-scheduler.service.ts` - Apply same filters for `targetType=ALL`
- [ ] Verify filters: `isBlacklisted=false`, `isActive=true`, `push_notifications_consent=true`

### Testing
- [ ] Unit test: ALL campaign excludes blocked customers
- [ ] Integration test: Verify blocked customer not in ALL campaign targets

---

## 360-Degree Validation

### Security
- [ ] All customer queries filter by `workspaceId`
- [ ] No cross-workspace customer data leakage
- [ ] 3-layer middleware applied to all endpoints

### Documentation
- [ ] Swagger updated for `/customers` endpoint with `forCampaign` param
- [ ] Swagger updated for campaign creation/update with `customerIds`

### Code Quality
- [ ] No temporary/debug code left in production
- [ ] All files under 500 lines
- [ ] No duplicate filtering logic (extract to shared utility)
- [ ] All imports organized and used

### Final Validation
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual QA: Create SELECTED campaign → Save → Edit → Verify selected
- [ ] Manual QA: Block customer → Create campaign → Verify hidden
