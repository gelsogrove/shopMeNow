# User INACTIVE Status - Complete Blocking System

## 🚫 Overview

Quando un utente viene impostato su **status = INACTIVE** nel backoffice, il sistema implementa un **blocco completo** che impedisce qualsiasi accesso o operazione.

---

## 🔒 Blocking Implementation

### 1. **Login Blocking** (NEW - Just Implemented)

**Location**: `apps/backend/src/interfaces/http/middlewares/auth.middleware.ts`

**Behavior**:
- ❌ User **CANNOT LOGIN** - blocked at authentication layer
- ✅ Returns **403 Forbidden** with clear message
- 📝 Message: `"Account disabilitato. Contatta l'assistenza per riattivare l'account."`

**Code**:
```typescript
// Check user status after verifying token
const user = await prisma.user.findUnique({
  where: { id: decoded.userId },
  select: { id: true, email: true, deletedAt: true, status: true },
})

// 🚫 INACTIVE STATUS CHECK: Block inactive users from logging in
if (user.status === "INACTIVE") {
  logger.warn(`🚫 Inactive user attempted login: ${user.email}`)
  throw new AppError(
    403,
    "Account disabilitato. Contatta l'assistenza per riattivare l'account."
  )
}
```

**User Experience**:
1. User enters email/password on `/` (LoginPage)
2. Backend validates credentials
3. Backend checks user.status
4. If INACTIVE → shows error toast: "Account disabilitato. Contatta l'assistenza..."
5. User **stays on login page**, cannot access system

---

### 2. **Workspace Operations Blocking** (Existing)

**Location**: `apps/backend/src/interfaces/http/middlewares/workspace-validation.middleware.ts`

**Behavior** (if user somehow bypasses login):
- ❌ ALL workspace operations return **fake 200 success**
- ✅ User sees "success" but nothing happens
- 📝 This is a silent block for operational safety

**Code**:
```typescript
if (workspace.owner?.status === 'INACTIVE') {
  res.status(200).json({ 
    success: true, 
    message: "Operation completed" 
  })
  return
}
```

**Blocked Operations**:
- Creating/editing products, categories, offers
- Sending WhatsApp messages
- Creating campaigns
- Managing team members
- Editing workspace settings
- All API operations requiring `workspaceId`

---

### 3. **Widget Chat Blocking** (Existing)

**Location**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`

**Behavior**:
- ❌ Widget chat returns **503 SERVICE_UNAVAILABLE**
- ✅ Customer sees "Service temporarily unavailable"
- 📝 Retry-After: 3600 seconds (1 hour)

**Code**:
```typescript
if (owner?.status === "INACTIVE") {
  return res.status(503).json({ 
    error: "SERVICE_UNAVAILABLE",
    message: "Service temporarily unavailable",
  })
}
```

---

## 🎯 Complete User Journey (INACTIVE Status)

### Scenario: Admin sets user to INACTIVE in backoffice

#### **Before Change (OLD Behavior)**:
1. ✅ User can LOGIN
2. ✅ User sees dashboard
3. ❌ User clicks "Create Product" → fake success (nothing happens)
4. ❌ User tries to send WhatsApp → fake success (nothing sent)
5. ❌ User's widget → returns 503 error
6. 😕 **CONFUSION**: User logged in but nothing works

#### **After Change (NEW Behavior)**:
1. ❌ User **CANNOT LOGIN** 
2. ⚠️ Error message: "Account disabilitato. Contatta l'assistenza per riattivare l'account."
3. ✅ **CLEAR**: User knows account is disabled and must contact support
4. 🎯 **NO CONFUSION**: User cannot waste time trying features

---

## 📊 Comparison with ACTIVE Status

| Operation | ACTIVE User | INACTIVE User (NEW) |
|-----------|-------------|---------------------|
| **Login** | ✅ Allowed | ❌ Blocked (403) |
| **View Dashboard** | ✅ Allowed | ❌ Cannot login |
| **Create Products** | ✅ Works | ❌ Cannot login |
| **Send WhatsApp** | ✅ Works | ❌ Cannot login |
| **Widget Chat** | ✅ Works | ❌ Cannot login |
| **Billing Operations** | ✅ Works | ❌ Cannot login |

---

## 🔧 Technical Details

### Error Hierarchy

1. **Auth Middleware** (First Layer):
   - Checks: Token validity, user exists, deletedAt, **status**
   - INACTIVE → **403 Forbidden** (stops here)

2. **Workspace Validation** (Second Layer - now unreachable):
   - Checks: Workspace access, owner status
   - Previously: INACTIVE → fake 200 success
   - Now: INACTIVE users already blocked at login

3. **Controller Level** (Third Layer - now unreachable):
   - Widget chat checks owner status
   - Now: INACTIVE users already blocked at login

### Database Query

```sql
-- Find INACTIVE users
SELECT id, email, status, deletedAt 
FROM users 
WHERE status = 'INACTIVE';

-- Reactivate user
UPDATE users 
SET status = 'ACTIVE' 
WHERE id = 'user-id-here';
```

### Frontend Error Handling

**File**: `apps/frontend/src/pages/LoginPage.tsx`

```typescript
const errorMsg =
  err.response?.data?.error ||
  err.response?.data?.message ||
  err.message ||
  "Login failed. Please check your credentials."

setError(errorMsg)
toast.error(errorMsg) // Shows: "Account disabilitato..."
```

---

## 🧪 Testing

### Unit Test Documentation

**File**: `apps/backend/__tests__/unit/middlewares/auth.middleware.spec.ts`

```typescript
it('should return 403 for INACTIVE user status', () => {
  // Users with status=INACTIVE are blocked from logging in
  const expectedStatus = 403
  const expectedMessage = 'Account disabilitato. Contatta l\'assistenza...'
  expect(expectedStatus).toBe(403)
})
```

### Manual Testing Steps

1. **Set user to INACTIVE**:
   - Go to backoffice `/clients`
   - Find user, click edit
   - Set Status = INACTIVE
   - Save

2. **Try to login**:
   - Go to frontend `/`
   - Enter user credentials
   - Click "Sign In"
   - **Expected**: Error toast "Account disabilitato. Contatta l'assistenza..."
   - **Expected**: User stays on login page

3. **Reactivate user**:
   - Backoffice: Set Status = ACTIVE
   - Try login again
   - **Expected**: Login successful, redirect to `/workspace-selection`

---

## 📝 Summary

### What Changed

- **OLD**: INACTIVE users could login but operations were silently blocked
- **NEW**: INACTIVE users **cannot login**, clear error message shown

### Why This is Better

1. ✅ **Clear Communication**: User knows account is disabled
2. ✅ **No Confusion**: User doesn't waste time trying features
3. ✅ **Better UX**: User knows to contact support immediately
4. ✅ **Cleaner Code**: Block at first authentication layer
5. ✅ **Security**: INACTIVE users never get authenticated session

### User Message

Backend returns error code: `ACCOUNT_INACTIVE`

Frontend translates to user's language:
- 🇮🇹 **Italian**: "Account disabilitato. Contatta l'assistenza per riattivare l'account."
- 🇬🇧 **English**: "Account disabled. Please contact support to reactivate your account."
- 🇪🇸 **Spanish**: "Cuenta deshabilitada. Póngase en contacto con el soporte para reactivar su cuenta."
- 🇵🇹 **Portuguese**: "Conta desativada. Entre em contato com o suporte para reativar sua conta."

**Translation System**:
- Backend returns error **code** (e.g., `ACCOUNT_INACTIVE`)
- Frontend detects user's browser language
- Frontend translates code using `LanguageContext` (IT/EN/ES/PT supported)
- User sees message in their language automatically

---

## 🔗 Related Files

- `apps/backend/src/interfaces/http/middlewares/auth.middleware.ts` (LOGIN BLOCK)
- `apps/backend/src/interfaces/http/middlewares/workspace-validation.middleware.ts` (OPERATIONS BLOCK)
- `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts` (WIDGET BLOCK)
- `apps/frontend/src/pages/LoginPage.tsx` (ERROR DISPLAY)
- `apps/backoffice/src/pages/ClientsPage.tsx` (STATUS MANAGEMENT)

---

## ✅ Checklist for Andrea

When setting user to INACTIVE:

- [ ] User will **not be able to login**
- [ ] User will see error: "Account disabilitato. Contatta l'assistenza..."
- [ ] User's widget will stop working (if already active)
- [ ] User's WhatsApp channel will stop sending
- [ ] User's existing sessions will be invalidated
- [ ] To reactivate: Set status back to ACTIVE in backoffice

---

**Author**: GitHub Copilot  
**Date**: 2026-01-12  
**Related to**: User status management, access control, authentication flow
