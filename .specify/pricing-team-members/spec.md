# Feature Specification: Pricing & Team Members Limits Update

## Overview

Update the pricing tiers to allow **team member invitations** with plan-specific limits. Currently, all plans (except Enterprise) set `maxTeamMembers: 0`, preventing team collaboration. This feature introduces tiered team member limits to enable scaling collaboration as users upgrade.

## Business Context

eChatbot is a SaaS platform with four subscription tiers: FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE. To encourage team adoption and provide clear upgrade incentives, we need to:
1. Allow team member invitations on paid plans
2. Enforce per-plan limits on number of team members
3. Provide clear messaging when limits are reached

## Functional Requirements

### FR1: Define Team Member Limits per Plan
- **FREE_TRIAL**: 0 team members (owner only, no invitations)
- **BASIC**: 3 team members (owner + up to 3 invitees)
- **PREMIUM**: Unlimited team members
- **ENTERPRISE**: Unlimited team members

### FR2: Enforce Team Member Limits in Invitation Flow
- When user attempts to invite a new team member, backend must check if workspace is at limit
- If at limit, reject invitation with clear error message (in English + Italian)
- If under limit, proceed with invitation as normal
- Limit check applies per-workspace (not per-owner across all workspaces)

### FR3: Prevent Exceeding Limits via API
- Direct API calls to create team members (not via UI) must also respect limits
- Validation must occur in middleware and controller layer

### FR4: Display Team Member Limits in UI
- Pricing page must show team member limits per plan (e.g., "Up to 3 team members")
- Plan cards must reflect updated limits
- When user is at team member limit, invite button should be disabled with tooltip

### FR5: Communicate Limits to Users
- Error messages when limit is reached must be user-friendly
- Messages must be available in English and Italian
- Suggestion to upgrade to higher tier if limit prevents needed action

## Non-Functional Requirements

### NFR1: Database-First Architecture
- All plan limits (including team members) must be stored in database `planConfiguration` table
- Backend must read from database, not from hardcoded frontend config
- Frontend may cache values but should be refreshed on plan changes

### NFR2: Consistency
- Plan limits in database must match frontend display
- No divergence between frontend and backend limit values

### NFR3: Performance
- Team member limit checks must complete in <100ms
- No new database queries per invitation beyond existing checks

### NFR4: Security
- Team member limits must be enforced per-workspace (workspace isolation)
- Only workspace owner can invite team members
- Cannot bypass limits via direct API calls

## User Stories

### US1: Invite Team Member on BASIC Plan
```
As a BASIC plan owner
I want to invite team members to my workspace
So that my team can collaborate on eChatbot
When: Up to 3 team members (owner not counted)
```

Acceptance Criteria:
- Owner can invite 1st, 2nd, and 3rd team members successfully
- 4th invitation attempt shows error: "Team member limit reached for BASIC plan. Upgrade to PREMIUM for unlimited members."
- Invite button is disabled when at limit

### US2: Attempt Invitation Over Limit
```
As a BASIC plan owner who has invited 3 team members
When I try to invite a 4th member
Then I see error message
And the invitation is rejected
And I'm offered upgrade option
```

Acceptance Criteria:
- Clear error in Italian and English
- API returns 403 with code `TEAM_MEMBER_LIMIT_REACHED`
- No invitation record is created

### US3: Upgrade to PREMIUM for Unlimited Team
```
As an owner at team member limit on BASIC
When I upgrade to PREMIUM
Then all team members are immediately active
And I can invite unlimited additional members
```

Acceptance Criteria:
- No team members are removed on upgrade
- Limit validation updates immediately
- Invite button becomes enabled again

## Edge Cases

### EC1: Team Member Limit at Plan Creation
- When workspace is created on BASIC plan, team member limit starts at 3
- Owner can immediately invite up to 3 members

### EC2: Downgrade with Excess Team Members
- User on PREMIUM with 10 team members attempts to downgrade to BASIC
- Downgrade should be blocked: "Cannot downgrade: you have 10 team members. BASIC plan supports only 3."
- User must remove 7+ team members before downgrade allowed

### EC3: Multiple Concurrent Invitations
- Two team members attempt to invite simultaneously on BASIC plan with 2 existing members
- Only first request succeeds (reaches limit of 3)
- Second request is rejected with limit reached error

### EC4: FREE_TRIAL to BASIC Transition
- User on FREE_TRIAL (0 team members allowed) upgrades to BASIC
- Can now invite up to 3 members
- Any pending invitations from trial period should be honoring new limit

## Data Model

### Changes to PlanConfiguration Table
```sql
ALTER TABLE planConfiguration ADD COLUMN maxTeamMembers INTEGER DEFAULT 0;
```

### Values per Plan
| Plan | maxTeamMembers |
|------|----------------|
| FREE_TRIAL | 0 |
| BASIC | 3 |
| PREMIUM | NULL (unlimited, represented as 999 in logic) |
| ENTERPRISE | NULL (unlimited, represented as 999 in logic) |

### Affected Entities
- `PlanConfiguration`: Add/update `maxTeamMembers` field
- `Workspace`: Already has `maxTeamMembers` limit check (existing code)
- `UserWorkspace`: Tracks team member invitations (existing)

## API Changes

### GET /subscription/plans (Public - Already Exists)
**Response Enhancement**: Add `maxTeamMembers` to each plan object

```json
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
  "pushCost": 0.02
}
```

### POST /workspaces/:workspaceId/team-members (Existing - Validation Enhancement)
**Validation Addition**: Check team member limit before creating invitation

**Error Response** (if limit exceeded):
```json
{
  "error": "Team member limit reached",
  "code": "TEAM_MEMBER_LIMIT_REACHED",
  "details": {
    "current": 3,
    "max": 3,
    "planType": "BASIC"
  }
}
```

## UI Changes

### Pricing Page (PricingPlans.tsx)
- Update plan cards to show team member limits
- Example: "Up to 3 team members"

### Billing/Invite Dialog
- Disable invite button when at limit
- Show tooltip: "Team member limit reached (3/3). Upgrade to PREMIUM for unlimited."

### Error Toast
- When invite fails due to limit: "Team member limit reached. Upgrade to PREMIUM to invite more."

## Implementation Constraints

1. **No breaking changes**: Existing team invitations must continue working
2. **Backward compatible**: FREE_TRIAL with maxTeamMembers=0 means no invites (existing behavior preserved)
3. **Database-first**: Plan limits must come from `planConfiguration` table, not hardcoded frontend config
4. **Workspace isolated**: Limits are per-workspace, not per-owner across workspaces

## Success Criteria

✅ Team members can be invited on BASIC plan (up to 3)
✅ Team members can be invited unlimited on PREMIUM/ENTERPRISE
✅ Invitations are rejected when at plan limit
✅ Error messages are user-friendly and actionable
✅ Database schema supports all limit types
✅ No hardcoded limits on frontend (all fetched from API)
✅ Unit tests verify limit enforcement
✅ All UI flows updated (pricing, invite, error handling)
