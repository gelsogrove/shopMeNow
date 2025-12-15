# Feature 190: Admin Impersonate User

## Overview
Platform Admin can login as any user from the backoffice to view and manage their account. Opens in a new window with full access + special "Agent Configuration" menu.

## User Story
As a Platform Admin, I want to login as any user so that I can help them troubleshoot issues and configure their workspace settings.

## Requirements

### 1. Backoffice Button
- Add "Login as User" button on each user card in ClientsPage
- Only visible to Platform Admins
- Cannot impersonate other Platform Admins

### 2. Token Generation
- Generate special JWT token with impersonation flag
- Token duration: **1 hour**
- Token payload:
  ```typescript
  {
    userId: string,           // Target user ID
    email: string,            // Target user email
    isImpersonating: true,    // Flag to identify impersonation
    impersonatorId: string,   // Admin user ID
    impersonatorEmail: string // Admin email
  }
  ```

### 3. Frontend Changes
- Open new window with impersonation token
- Show banner: "🔑 Admin Mode - Viewing as [user email]"
- Show "Agent Configuration" menu (normally hidden from regular users)
- Show "Exit" button to close the window

### 4. Permissions
- Admin has FULL access to all user actions
- No audit log required
- Works with all workspace operations

## API Endpoints

### POST /api/users/admin/:userId/impersonate
- **Auth**: Platform Admin only
- **Response**: `{ success: true, token: string, redirectUrl: string }`

## Security
- Only Platform Admins can impersonate
- Cannot impersonate other Platform Admins
- Token expires in 1 hour
- Impersonation flag visible in all API requests (for debugging)

## UI/UX

### Backoffice Button
```
[👤 Login as User]  (blue button, opens new window)
```

### Frontend Banner (when impersonating)
```
┌────────────────────────────────────────────────────────────┐
│ 🔑 Admin Mode - Viewing as andrea.gelsomino@code.seat  [✕] │
└────────────────────────────────────────────────────────────┘
```

### Menu Changes
When `isImpersonating: true`:
- Show all normal menu items
- ADD: "Agent Configuration" menu item (🤖 icon)

## Files to Modify

### Backend
- `apps/backend/src/interfaces/http/routes/user-admin.routes.ts` - Add impersonate endpoint

### Backoffice
- `apps/backoffice/src/pages/ClientsPage.tsx` - Add "Login as User" button

### Frontend
- `apps/frontend/src/contexts/AuthContext.tsx` - Handle impersonation token
- `apps/frontend/src/components/layout/Sidebar.tsx` - Show Agent Config menu
- `apps/frontend/src/components/ImpersonationBanner.tsx` - New component
- `apps/frontend/src/App.tsx` - Add banner to layout

## Implementation Order
1. Backend: Create impersonate endpoint
2. Backoffice: Add button and handler
3. Frontend: Handle token and show banner
4. Frontend: Add Agent Configuration menu visibility

## Testing
- Test impersonation token generation
- Test token validation with impersonation flag
- Test menu visibility when impersonating
- Test banner display and close button
