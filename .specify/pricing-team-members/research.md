# Phase 0: Research & Clarifications

## Decision: Database Schema - maxTeamMembers Column

**Decision**: Add `maxTeamMembers` column to `PlanConfiguration` table in Prisma schema and database.

**Rationale**:
- Current `PlanConfiguration` model already exists in schema.prisma
- All plan limits (maxChannels, maxProducts, maxCustomers) are stored in this table
- Consistency: Team member limits should follow same pattern
- Backend already reads plan limits from this table via `getPlanConfiguration()`

**Alternatives Considered**:
1. ❌ Hardcode in frontend only → Violates "database-first" constitution rule
2. ❌ Add to separate `TeamMemberLimits` table → Over-engineered, inconsistent with existing pattern
3. ✅ **CHOSEN**: Add to existing `PlanConfiguration` table → Consistent, minimal changes

**Implementation**:
- Create Prisma migration: `add_max_team_members_to_plan_configuration`
- Schema change: `maxTeamMembers Int?` (nullable, represents unlimited as NULL)
- Seed values: FREE_TRIAL=0, BASIC=3, PREMIUM=NULL, ENTERPRISE=NULL
- Backend type: `SubscriptionBillingService.getAvailablePlans()` already maps this field

---

## Decision: Limit Enforcement Point

**Decision**: Enforce team member limits in **two places**:
1. **Controller layer** (`workspace-invitation.controller.ts`) - Main validation
2. **Middleware layer** (`checkPlanLimits` middleware) - Secondary guard

**Rationale**:
- Existing pattern: Channels/Customers limits are checked in `checkPlanLimits` middleware
- Consistency: Team member limits should follow same middleware approach
- Defense in depth: Controller validates business logic, middleware validates all API calls
- Current code: `workspace-invitation.service.ts` already checks `maxTeamMembers` (per analisi.md)

**Implementation**:
- Extend `checkPlanLimits()` middleware to accept `"teamMembers"` as limitType
- Update controller to call `billingService.checkPlanLimits(workspaceId, "teamMembers")`
- Service already has `getWorkspaceUsage()` which counts existing team members

---

## Decision: Frontend Plan Limits Display

**Decision**: Fetch plan limits dynamically from `GET /subscription/plans` API instead of hardcoding in `planFeatures.ts`

**Rationale**:
- Constitution rule: "Database-First Architecture" - hardcoded values violate this
- Current issue: `planFeatures.ts` hardcodes limits; database may be out of sync
- API already exists: `GET /subscription/plans` returns `PlanInfo[]`
- Solution: Enhance API response to include `maxTeamMembers`, update frontend to use API data

**Alternatives Considered**:
1. ❌ Keep hardcoded `planFeatures.ts` → Violates constitution
2. ⚠️ Hybrid: Hardcode defaults in frontend, override with API → Complexity
3. ✅ **CHOSEN**: Fetch all limits from API → Single source of truth (database)

**Implementation**:
- API response already defined in `subscriptionBillingApi.ts` as `PlanInfo` interface
- Add `maxTeamMembers: number` to `PlanInfo` interface
- Backend: Ensure `getAvailablePlans()` includes this field in response
- Frontend: Refactor `planFeatures.ts` to use API data instead of hardcoding
- Cache: Store in React state, refresh when user changes plans

---

## Decision: Handling Unlimited Team Members

**Decision**: Represent "unlimited" as `NULL` in database, convert to `999` in UI logic for display

**Rationale**:
- Database consistency: Matches pattern for `maxProducts` (nullable)
- Business logic: Clear distinction between "exactly 0" and "no limit"
- UI clarity: Display as "Unlimited" string instead of showing "999"
- Type safety: Avoid confusion between intentional limits and sentinel values

**Implementation**:
- Schema: `maxTeamMembers Int?` (nullable)
- Seed: PREMIUM and ENTERPRISE get `NULL`
- Service layer: Treat `NULL` as unlimited in comparisons
- Frontend: Map `null` to "Unlimited" in display, use `999` for comparison logic

---

## Decision: Error Messages - i18n Keys

**Decision**: Add new i18n keys for team member limit errors in both English and Italian

**Rationale**:
- Existing pattern: Error messages in `LanguageContext.tsx` (already have invitations i18n)
- User-friendly: Error must explain limit AND suggest action (upgrade)
- Multi-language: Andrea emphasized English + Italian support

**New Keys**:
```javascript
// English (en:)
"error.teamMemberLimitReached": "Team member limit reached for your plan",
"error.teamMemberLimitInfo": "Your {{planName}} plan supports up to {{max}} team members. You currently have {{current}}.",
"error.teamMemberLimitUpgrade": "Upgrade to a higher plan for unlimited team members.",
"billing.inviteDisabled": "Invite disabled - you've reached your team member limit",

// Italian (it:)
"error.teamMemberLimitReached": "Limite di membri team raggiunto per il tuo piano",
"error.teamMemberLimitInfo": "Il tuo piano {{planName}} supporta fino a {{max}} membri del team. Ne hai {{current}}.",
"error.teamMemberLimitUpgrade": "Passa a un piano superiore per illimitati membri del team.",
"billing.inviteDisabled": "Invito disabilitato - hai raggiunto il limite di membri del team",
```

**Implementation**:
- Add keys to `LanguageContext.tsx` (both it: and en: sections)
- Backend: Return error code and details in JSON
- Frontend: Use `t()` function to render localized error message

---

## Decision: Downgrade Validation

**Decision**: Block plan downgrades if current team member count exceeds target plan's limit

**Rationale**:
- Data integrity: Cannot force-remove team members on downgrade (breaks trust)
- User experience: Clear message before downgrade attempt
- Existing pattern: Already validate other limits on downgrade (maxChannels, maxCustomers)

**Implementation**:
- Extend `changeOwnerPlan()` in `SubscriptionBillingService`
- Check: `currentTeamMemberCount > newPlanLimits.maxTeamMembers`
- If true: Throw error with message "Cannot downgrade: you have X team members. Plan Y supports only Z."
- Error response: `code: "PLAN_DOWNGRADE_BLOCKED_TEAM_MEMBERS"`

---

## Decision: Concurrent Invitation Safety

**Decision**: Use database UNIQUE constraint + application-level lock to prevent race conditions

**Rationale**:
- Current implementation: Uses Prisma transactions for team member creation
- Race condition scenario: Two requests at limit=2, both see "capacity for 1 more", both create
- Solution: Database constraint enforces at write time, app logs conflicts

**Implementation**:
- Prisma: Already uses transaction in invitation flow (verify in code)
- If not: Add `tx.$transaction()` wrapper to invitation creation
- Error handling: On unique constraint violation, return `TEAM_MEMBER_LIMIT_REACHED` to user
- Logging: Log concurrent invitation attempts for monitoring

---

## Research Summary Table

| Item | Status | Decision |
|------|--------|----------|
| Database schema change | ✅ DECIDED | Add `maxTeamMembers Int?` to `PlanConfiguration` |
| Enforcement layer | ✅ DECIDED | Controller + Middleware (both) |
| Frontend data source | ✅ DECIDED | API endpoint `/subscription/plans` (not hardcoded) |
| Unlimited representation | ✅ DECIDED | NULL in DB, "Unlimited" in UI, 999 in logic |
| i18n keys | ✅ DECIDED | Add to LanguageContext.tsx |
| Downgrade validation | ✅ DECIDED | Block if team count > new plan limit |
| Concurrency safety | ✅ DECIDED | Transactions + database constraints |

---

## Dependencies & Prerequisites

### Database
- [ ] Verify `planConfiguration` table exists in Prisma schema
- [ ] Verify `UserWorkspace` table tracks team members (should exist)
- [ ] Check if workspace has team member count query

### Backend Services
- [ ] Verify `SubscriptionBillingService.getAvailablePlans()` is complete
- [ ] Verify `workspace-invitation.service.ts` actually exists and uses `maxTeamMembers`
- [ ] Verify `checkPlanLimits` middleware can be extended

### Frontend APIs
- [ ] Verify `subscriptionBillingApi.ts` has `getAvailablePlans()` implementation
- [ ] Verify `PlanInfo` interface can accept `maxTeamMembers` field

### Libraries & Tools
- [ ] Prisma: Already available (used throughout project)
- [ ] i18n: Already using `LanguageContext.tsx` (no new dependencies)

---

## Open Questions & Clarifications

**Q1**: When user is on PREMIUM with 10 team members and downgrades to BASIC - what happens to the 7 extra members?

**A1**: DECIDED - Downgrade is **blocked** until user removes excess members. This preserves team integrity.

**Q2**: Does FREE_TRIAL (maxTeamMembers=0) mean trial users can't invite anyone?

**A2**: DECIDED - Correct. FREE_TRIAL is owner-only. This incentivizes upgrade to BASIC (allows 3 members).

**Q3**: Are team member limits per-workspace or per-owner across all workspaces?

**A3**: DECIDED - **Per-workspace** (consistent with existing channels/customers limits). Each workspace has its own team.

**Q4**: If `maxTeamMembers` is NULL (unlimited) in database, how does frontend display this?

**A4**: DECIDED - Display as "Unlimited", use 999 as sentinel in comparison logic, store NULL in database.

---

## Phase 0 Completion Checklist

- [x] All NEEDS CLARIFICATION items resolved
- [x] All decisions documented with rationale
- [x] Alternatives considered for major decisions
- [x] Dependencies identified
- [x] Prerequisites listed
- [x] Open questions answered
- [x] Ready to proceed to Phase 1: Data Model & Contracts
