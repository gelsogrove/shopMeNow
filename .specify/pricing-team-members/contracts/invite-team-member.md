# API Contract: POST /workspaces/:workspaceId/team-members (Invite)

## Endpoint
```
POST /workspaces/:workspaceId/team-members
```

## Category
Protected (requires authentication + workspace ownership)

## Purpose
Create a team member invitation for a user. Validates that workspace is within team member limit for current plan.

## Request

### Path Parameters
```
workspaceId: string (UUID) - Target workspace
```

### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
X-Session-Id: {sessionId}
X-Workspace-Id: {workspaceId}
```

### Body
```json
{
  "email": "team@example.com",
  "role": "ADMIN"
}
```

### Body Schema
```typescript
interface InviteTeamMemberRequest {
  email: string              // Email of user to invite
  role: "ADMIN" | "MEMBER"   // Permission level
}
```

---

## Response

### Success (201 Created)
```json
{
  "data": {
    "id": "user-workspace-123",
    "userId": "user-456",
    "workspaceId": "workspace-789",
    "email": "team@example.com",
    "role": "ADMIN",
    "status": "PENDING",
    "createdAt": "2025-01-07T10:30:00Z"
  }
}
```

### Response Schema
```typescript
interface TeamMemberInvitation {
  id: string                        // Unique invitation ID
  userId: string
  workspaceId: string
  email: string
  role: "ADMIN" | "MEMBER"
  status: "PENDING" | "ACTIVE"
  createdAt: string                 // ISO 8601 timestamp
}

interface Response {
  data: TeamMemberInvitation
}
```

---

## Error Responses

### 403 Forbidden - Team Member Limit Reached
```json
{
  "error": "Team member limit reached",
  "code": "TEAM_MEMBER_LIMIT_REACHED",
  "details": {
    "current": 3,
    "max": 3,
    "planType": "BASIC",
    "message": "Your BASIC plan supports up to 3 team members. You currently have 3."
  }
}
```

### 400 Bad Request - Invalid Email
```json
{
  "error": "Invalid email address",
  "code": "INVALID_EMAIL"
}
```

### 409 Conflict - Already Invited
```json
{
  "error": "User already invited to this workspace",
  "code": "USER_ALREADY_INVITED"
}
```

### 401 Unauthorized - Not Owner
```json
{
  "error": "Only workspace owner can invite team members",
  "code": "NOT_AUTHORIZED"
}
```

### 404 Not Found - Workspace Not Found
```json
{
  "error": "Workspace not found",
  "code": "WORKSPACE_NOT_FOUND"
}
```

---

## Implementation Notes

### Validation Order
1. **Authentication**: Verify JWT token valid (middleware)
2. **Ownership**: Verify user is workspace owner/admin (middleware)
3. **Plan Limit**: Call `billingService.checkPlanLimits(workspaceId, "teamMembers")`
4. **Data Validation**: Verify email format, not already invited
5. **Create**: Insert `UserWorkspace` record with status=PENDING
6. **Notify**: Send invitation email to new user

### Backend Changes
- File: `apps/backend/src/interfaces/http/controllers/workspace-invitation.controller.ts`
- Method: `inviteTeamMember()` or similar
- Add limit check before creating invitation:
  ```typescript
  const limitCheck = await billingService.checkPlanLimits(
    workspaceId,
    "teamMembers"
  )
  
  if (!limitCheck.withinLimits) {
    return res.status(403).json({
      error: "Team member limit reached",
      code: "TEAM_MEMBER_LIMIT_REACHED",
      details: {
        current: limitCheck.current,
        max: limitCheck.max,
        planType: workspace.planType,
        message: `Your ${workspace.planType} plan supports up to ${limitCheck.max} team members. You currently have ${limitCheck.current}.`
      }
    })
  }
  ```

### Middleware Stack
```typescript
router.post(
  "/:workspaceId/team-members",
  authMiddleware,                          // JWT validation
  sessionValidationMiddleware,             // X-Session-Id check
  validateWorkspaceOperation,              // X-Workspace-Id + owner check
  checkPlanLimits("teamMembers"),         // NEW: Plan limit validation
  controller.inviteTeamMember.bind(controller)
)
```

### Message Localization
- Error message must be built from i18n context
- English: "Your BASIC plan supports up to 3 team members. You currently have 3."
- Italian: "Il tuo piano BASIC supporta fino a 3 membri del team. Ne hai 3."

### Error Code Reference
| Code | HTTP | Meaning |
|------|------|---------|
| TEAM_MEMBER_LIMIT_REACHED | 403 | Workspace at plan limit for team members |
| NOT_AUTHORIZED | 401 | User not owner/admin of workspace |
| WORKSPACE_NOT_FOUND | 404 | Workspace ID invalid or deleted |
| USER_ALREADY_INVITED | 409 | User already has pending/active invitation |
| INVALID_EMAIL | 400 | Email format invalid |

---

## Testing

### Happy Path (BASIC plan with space for members)
```bash
curl -X POST http://localhost:3001/api/workspaces/{workspaceId}/team-members \
  -H "Authorization: Bearer {token}" \
  -H "X-Workspace-Id: {workspaceId}" \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "role": "ADMIN"}'
```

Expected: 201 with invitation record

### Error: At Team Member Limit (BASIC plan with 3 members)
```bash
# Same request as above, but after already inviting 3 members
```

Expected: 403 with `TEAM_MEMBER_LIMIT_REACHED` error

### Error: FREE_TRIAL Plan (maxTeamMembers = 0)
```bash
# Same request for workspace on FREE_TRIAL plan
```

Expected: 403 with limit=0

### Unlimited (PREMIUM plan)
```bash
# Same request for workspace on PREMIUM plan, repeat many times
```

Expected: Always succeeds (null limit = unlimited)

---

## Related Endpoints

- `GET /workspaces/:workspaceId/team-members` - List team members
- `DELETE /workspaces/:workspaceId/team-members/:userId` - Remove team member
- `PATCH /workspaces/:workspaceId/team-members/:userId` - Update role
- `GET /subscription/plans` - Get plan limits (new field added)
- `POST /workspaces/:workspaceId/subscription-billing/change-plan` - Upgrade/downgrade plan

---
