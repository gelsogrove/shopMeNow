# 184 - Workspace Team Invites - Requirements Checklist

**Feature Branch**: `184-workspace-team-invites`  
**Created**: 2025-01-20  
**Status**: In Progress

---

## Database Changes

### Migrations

- [ ] Create migration for `ownerId` field in Workspace
- [ ] Create migration for `WorkspaceRole` enum (SUPER_ADMIN, ADMIN)
- [ ] Create migration for `InvitationStatus` enum (PENDING, ACCEPTED, CANCELLED, EXPIRED)
- [ ] Create migration for `WorkspaceInvitation` table
- [ ] Create migration to convert UserWorkspace.role from String to enum
- [ ] Create data migration to populate `ownerId` for existing workspaces (set to first ADMIN user)
- [ ] Create data migration to convert existing role strings to enum values
- [ ] Run `npx prisma generate` after schema changes

### Seed Updates

- [ ] Update seed to create workspaces with `ownerId`
- [ ] Update seed to use `WorkspaceRole.SUPER_ADMIN` for creator
- [ ] Add test invitation data (optional, for development)

---

## Backend Implementation

### New Services

- [ ] `WorkspaceInvitationService`
  - [ ] `createInvitation(workspaceId, email, invitedById)` - generates token, saves hash, sends email
  - [ ] `acceptInvitation(token)` - validates token, adds to all channels
  - [ ] `acceptInvitationWithRegistration(token, userData)` - creates user + accepts
  - [ ] `cancelInvitation(invitationId, workspaceId)` - sets status to CANCELLED
  - [ ] `resendInvitation(invitationId, workspaceId)` - generates new token, re-sends email
  - [ ] `getPendingInvitations(workspaceId)` - lists pending invites
  - [ ] `validateToken(token)` - returns invitation info or error

- [ ] `WorkspaceMemberService`
  - [ ] `getMembers(workspaceId)` - lists all members with roles
  - [ ] `getMembersByOwnerId(ownerId)` - lists all ADMINs for an owner
  - [ ] `addMemberToAllOwnerChannels(userId, ownerId, role)` - adds to all channels
  - [ ] `removeMember(workspaceId, userId)` - removes from all owner's channels
  - [ ] `isUserMember(workspaceId, userId)` - checks membership

### New Middleware

- [ ] `requireSuperAdmin.middleware.ts`
  - [ ] Check user's role in workspace is SUPER_ADMIN
  - [ ] Return 403 if not SUPER_ADMIN
  - [ ] Pass workspaceId from params or x-workspace-id header

- [ ] `hasWorkspaceAccess.middleware.ts` (if not already exists)
  - [ ] Verify user has access to workspace (any role)

### New Controllers

- [ ] `InvitationController`
  - [ ] `createInvitation` - POST /workspaces/:workspaceId/invitations
  - [ ] `getPendingInvitations` - GET /workspaces/:workspaceId/invitations
  - [ ] `cancelInvitation` - DELETE /workspaces/:workspaceId/invitations/:id
  - [ ] `resendInvitation` - POST /workspaces/:workspaceId/invitations/:id/resend
  - [ ] `acceptInvitation` - POST /invitations/accept (public)
  - [ ] `acceptInvitationWithRegistration` - POST /invitations/accept-register (public)
  - [ ] `validateToken` - GET /invitations/validate/:token (public)

- [ ] `MemberController`
  - [ ] `getMembers` - GET /workspaces/:workspaceId/members
  - [ ] `removeMember` - DELETE /workspaces/:workspaceId/members/:userId

### Route Updates

- [ ] Create `invitation.routes.ts` with proper middleware stack
- [ ] Create `member.routes.ts` with proper middleware stack
- [ ] Wire routes in main router
- [ ] Public routes for accept/validate (no auth required)

### Modify Existing Code

- [ ] `WorkspaceService.create()` - Set ownerId, create with SUPER_ADMIN role
- [ ] `WorkspaceService.create()` - Auto-add existing ADMINs when creating new channel
- [ ] Update workspace queries to include owner relationship

### Security Implementation

- [ ] Token generation: crypto.randomBytes(32).toString('hex')
- [ ] Token hashing: crypto.createHash('sha256').update(token).digest('hex')
- [ ] Timing-safe comparison for token validation
- [ ] Transaction for invite creation (check + create + send email)
- [ ] Transaction for accept invitation (update invite + create UserWorkspace entries)

---

## Frontend Implementation

### New Hooks

- [ ] `useWorkspaceRole.ts`
  - [ ] Returns current user's role in selected workspace
  - [ ] Returns `isSuperAdmin` boolean
  - [ ] Caches result to avoid repeated API calls

### New API Services

- [ ] `invitationApi.ts`
  - [ ] `createInvitation(workspaceId, email)`
  - [ ] `getPendingInvitations(workspaceId)`
  - [ ] `cancelInvitation(workspaceId, invitationId)`
  - [ ] `resendInvitation(workspaceId, invitationId)`
  - [ ] `acceptInvitation(token)`
  - [ ] `acceptInvitationWithRegistration(token, userData)`
  - [ ] `validateToken(token)`

- [ ] `memberApi.ts`
  - [ ] `getMembers(workspaceId)`
  - [ ] `removeMember(workspaceId, userId)`

### New Components

- [ ] `TeamMembersTable.tsx`
  - [ ] Two tabs: "Members" | "Pending Invites"
  - [ ] Members table: Email, Role, Joined Date, Actions
  - [ ] Invites table: Email, Sent Date, Expires Date, Status, Actions
  - [ ] "Invite Member" button (disabled for ADMIN with tooltip)
  - [ ] Remove/Cancel buttons (disabled for ADMIN with tooltip)
  - [ ] Resend button for expired invites

- [ ] `InviteMemberModal.tsx`
  - [ ] Email input with validation
  - [ ] Submit button with loading state
  - [ ] Error handling (duplicate, already member, SMTP failure)
  - [ ] Success message with email sent confirmation

### New Pages

- [ ] `AcceptInvitePage.tsx` (/accept-invite?token=xxx)
  - [ ] Token validation on mount
  - [ ] Loading state while validating
  - [ ] Error states: expired, cancelled, invalid, already accepted
  - [ ] For existing users: auto-accept, show success, redirect
  - [ ] For logged-in different user: show mismatch error

- [ ] `InviteRegistrationPage.tsx` (/accept-invite?token=xxx for new users)
  - [ ] Email pre-populated and readonly
  - [ ] Password input with requirements
  - [ ] 2FA setup (QR code)
  - [ ] Recovery codes display
  - [ ] Submit creates user + accepts invite
  - [ ] Redirect to login on success

### Modify Existing Components

- [ ] `WorkspaceSelectionPage.tsx`
  - [ ] Add "Team" section below channel list
  - [ ] Include TeamMembersTable component
  - [ ] Only show for workspaces where user is member

### Route Updates

- [ ] Add route for `/accept-invite` page
- [ ] Handle token query parameter

### UI/UX Details

- [ ] Disabled buttons: `opacity-50 cursor-not-allowed`
- [ ] Tooltip on hover: "Only workspace owner can perform this action"
- [ ] Loading spinners for async operations
- [ ] Toast notifications for success/error
- [ ] Confirmation dialogs for destructive actions (remove, cancel)

---

## Testing (100% Unit Coverage)

### Backend Unit Tests

- [ ] `WorkspaceInvitationService.test.ts`
  - [ ] createInvitation success
  - [ ] createInvitation duplicate email error
  - [ ] createInvitation already member error
  - [ ] createInvitation SMTP failure (no invite created)
  - [ ] acceptInvitation success (existing user)
  - [ ] acceptInvitation expired token
  - [ ] acceptInvitation cancelled invite
  - [ ] acceptInvitation already accepted
  - [ ] acceptInvitationWithRegistration success
  - [ ] acceptInvitationWithRegistration weak password
  - [ ] cancelInvitation success
  - [ ] resendInvitation success
  - [ ] validateToken valid
  - [ ] validateToken invalid
  - [ ] validateToken expired

- [ ] `WorkspaceMemberService.test.ts`
  - [ ] getMembers returns all with roles
  - [ ] addMemberToAllOwnerChannels adds to all channels
  - [ ] removeMember removes from all owner channels
  - [ ] removeMember self-removal blocked
  - [ ] isUserMember true/false cases

- [ ] `requireSuperAdmin.middleware.test.ts`
  - [ ] Allows SUPER_ADMIN
  - [ ] Blocks ADMIN with 403
  - [ ] Handles missing workspace
  - [ ] Handles missing user

- [ ] `InvitationController.test.ts`
  - [ ] All endpoints with success cases
  - [ ] All endpoints with error cases
  - [ ] Proper status codes

- [ ] `MemberController.test.ts`
  - [ ] All endpoints with success cases
  - [ ] All endpoints with error cases

- [ ] `WorkspaceService.create.test.ts` (update existing)
  - [ ] Sets ownerId correctly
  - [ ] Creates with SUPER_ADMIN role
  - [ ] Auto-adds existing ADMINs

### Frontend Unit Tests

- [ ] `useWorkspaceRole.test.ts`
  - [ ] Returns correct role
  - [ ] isSuperAdmin boolean correct

- [ ] `TeamMembersTable.test.tsx`
  - [ ] Renders members tab
  - [ ] Renders invites tab
  - [ ] Disabled buttons for ADMIN
  - [ ] Enabled buttons for SUPER_ADMIN
  - [ ] Tooltip on disabled buttons

- [ ] `InviteMemberModal.test.tsx`
  - [ ] Form validation
  - [ ] Submit success
  - [ ] Submit error handling
  - [ ] Loading state

- [ ] `AcceptInvitePage.test.tsx`
  - [ ] Loading state
  - [ ] Expired error
  - [ ] Cancelled error
  - [ ] Invalid token error
  - [ ] Success redirect

- [ ] `InviteRegistrationPage.test.tsx`
  - [ ] Email readonly
  - [ ] Password validation
  - [ ] 2FA setup flow
  - [ ] Submit success

---

## Documentation

### Swagger/OpenAPI

- [ ] POST /workspaces/:workspaceId/invitations
- [ ] GET /workspaces/:workspaceId/invitations
- [ ] DELETE /workspaces/:workspaceId/invitations/:id
- [ ] POST /workspaces/:workspaceId/invitations/:id/resend
- [ ] POST /invitations/accept
- [ ] POST /invitations/accept-register
- [ ] GET /invitations/validate/:token
- [ ] GET /workspaces/:workspaceId/members
- [ ] DELETE /workspaces/:workspaceId/members/:userId

### Code Comments

- [ ] JSDoc for all public methods
- [ ] Explain security considerations
- [ ] Document token lifecycle

---

## Validation Checklist (Before Marking Complete)

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] Test coverage at 100% for new code
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Swagger documentation complete and accurate
- [ ] No hardcoded values (all config from DB)
- [ ] All queries filter by workspaceId
- [ ] Transactions used for critical operations
- [ ] No temporary files committed
- [ ] No unused imports/code
- [ ] Files under 500 lines
- [ ] Existing tests still pass (regression check)

---

## Notes

- **NO Integration Tests**: Per Andrea's explicit requirement
- **NO WhatsApp Testing**: Feature doesn't involve WhatsApp
- **Bug Fixes**: If auth bugs found during development, fix them but ensure all tests pass
