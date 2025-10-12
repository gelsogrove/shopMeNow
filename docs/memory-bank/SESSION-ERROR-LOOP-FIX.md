# Session Error Loop Fix - 12 October 2025

## 🔥 CRITICAL BUG: Infinite Retry Loop on Session Expiry

### Problem Identified

Andrea, hai segnalato che quando la sessione scade, il frontend fa un **LOOP ESAGERATO** di richieste invece di fermarsi e fare logout.

**Screenshot Analysis**:

- `GET /chat/recent` → 500 (Internal Server Error)
- Request failed with status code 500
- Loop infinito di richieste

### Root Cause

1. **Axios interceptor NON gestiva 500 errors**: Solo 401 e 400 erano gestiti
2. **React Query retry**: Default retry=3, continuava a riprovare anche dopo session error
3. **Session validation failure**: Quando sessione scade, backend ritorna 500 ma frontend non puliva localStorage

## ✅ FIXES APPLIED

### 1. api.ts - Added 500 Error Handling

**Location**: `frontend/src/services/api.ts`

**NEW CODE**:

```typescript
// 🔥 HANDLE SESSION VALIDATION ERRORS (500)
if (error.response && error.response.status === 500) {
  const errorMessage = error.response?.data?.error || ""
  const isSessionError =
    errorMessage.toLowerCase().includes("session") ||
    errorMessage.toLowerCase().includes("validation failed")

  if (isSessionError) {
    logger.error(
      "❌ Session validation failed (500) - clearing and redirecting to login"
    )

    // Clear all auth data IMMEDIATELY to stop the loop
    localStorage.removeItem("currentWorkspace")
    sessionStorage.removeItem("currentWorkspace")
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    clearSessionId()

    toast.error("Sessione non valida. Effettua nuovamente il login.")

    // IMMEDIATE redirect to stop retry loop
    window.location.href = "/auth/login"

    throw new Error("Session validation failed")
  }
}
```

**What it does**:

- ✅ Detects 500 errors related to session validation
- ✅ **IMMEDIATELY** clears all localStorage/sessionStorage
- ✅ Shows toast message to user
- ✅ **IMMEDIATE** redirect to `/auth/login`
- ✅ Throws error to stop axios from retrying

### 2. ChatListContext.tsx - Disable React Query Retry

**Location**: `frontend/src/contexts/ChatListContext.tsx`

**BEFORE**:

```typescript
const { data: chats = [], isLoading } = useQuery({
  queryKey: ["chats", sessionId],
  queryFn: async () => {
    /* ... */
  },
  staleTime: 60000,
  gcTime: 300000,
  // ❌ NO retry setting - default retry=3
})
```

**AFTER**:

```typescript
const { data: chats = [], isLoading } = useQuery({
  queryKey: ["chats", sessionId],
  queryFn: async () => {
    /* ... */
  },
  retry: false, // 🔥 FIX: Don't retry on session errors
  staleTime: 60000,
  gcTime: 300000,
})
```

**What it does**:

- ✅ Disables React Query automatic retry
- ✅ Axios interceptor handles the error and redirects
- ✅ No more infinite loop

### 3. ChatPage.tsx - Disable Retry for Languages Query

**Location**: `frontend/src/pages/ChatPage.tsx`

**BEFORE**:

```typescript
const { data: availableLanguages = [] } = useQuery<Language[]>({
  queryKey: ["languages", workspaceId],
  queryFn: async () => getLanguages(),
  enabled: !!workspaceId,
  // ❌ NO retry setting
})
```

**AFTER**:

```typescript
const { data: availableLanguages = [] } = useQuery<Language[]>({
  queryKey: ["languages", workspaceId],
  queryFn: async () => getLanguages(),
  enabled: !!workspaceId,
  retry: false, // 🔥 FIX: Don't retry on session errors
})
```

### 4. ClientsPage.tsx - Disable Retry for Clients Query

**Location**: `frontend/src/pages/ClientsPage.tsx`

**BEFORE**:

```typescript
const { data: clients = [], ... } = useQuery({
  queryKey: ["clients", workspace?.id],
  queryFn: async () => { /* ... */ },
  enabled: !!workspace?.id,
  // ❌ NO retry setting
})
```

**AFTER**:

```typescript
const { data: clients = [], ... } = useQuery({
  queryKey: ["clients", workspace?.id],
  queryFn: async () => { /* ... */ },
  enabled: !!workspace?.id,
  retry: false, // 🔥 FIX: Don't retry on session errors
})
```

## 🎯 EXPECTED BEHAVIOR AFTER FIX

### Session Expiry Flow (CORRECTED)

1. User session expires
2. Frontend makes request → Backend returns 500 with session error
3. **Axios interceptor detects 500 + session keyword**
4. **IMMEDIATELY clears localStorage/sessionStorage**
   - Removes: `currentWorkspace`, `token`, `user`, `sessionId`
5. **Shows toast**: "Sessione non valida. Effettua nuovamente il login."
6. **IMMEDIATE redirect** to `/auth/login`
7. **React Query doesn't retry** (retry: false)
8. **LOOP STOPPED** ✅

### Before vs After

**BEFORE (WRONG)**:

```
Request 1 → 500 error
Request 2 → 500 error (retry)
Request 3 → 500 error (retry)
Request 4 → 500 error (retry)
... INFINITE LOOP ...
```

**AFTER (CORRECT)**:

```
Request 1 → 500 error
↓
Axios interceptor detects session error
↓
Clear localStorage + sessionStorage
↓
Show toast
↓
Redirect to /auth/login
↓
STOP ✅
```

## 🧪 TESTING PLAN

### Manual Test

1. **Login** to application
2. **Wait for session to expire** (or delete sessionId from localStorage manually)
3. **Navigate to Chat page** or any page
4. **Verify behavior**:
   - [ ] See toast: "Sessione non valida. Effettua nuovamente il login."
   - [ ] Redirected to `/auth/login`
   - [ ] NO infinite loop in Network tab
   - [ ] localStorage cleared (check DevTools)

### Simulate Session Expiry

```javascript
// In DevTools Console:
localStorage.removeItem("sessionId")
// Then navigate to any page
```

### Check Network Tab

- [ ] Should see 1 request with 500 error
- [ ] NO subsequent retry requests
- [ ] Immediate redirect to login

## 📊 IMPACT ASSESSMENT

### Performance: **HIGH** ✅

- **FIXED**: Infinite retry loop consuming CPU/network
- **IMPROVED**: Immediate error handling and redirect

### Security: **HIGH** ✅

- **IMPROVED**: All auth data cleared immediately on session error
- **IMPROVED**: User forced to re-authenticate

### User Experience: **HIGH** ✅

- **FIXED**: No more hanging/frozen UI during session expiry
- **IMPROVED**: Clear toast message explaining what happened
- **IMPROVED**: Immediate redirect to login (no delay)

## 🚀 FILES MODIFIED

1. ✅ `frontend/src/services/api.ts` - Added 500 error handler
2. ✅ `frontend/src/contexts/ChatListContext.tsx` - Added `retry: false`
3. ✅ `frontend/src/pages/ChatPage.tsx` - Added `retry: false`
4. ✅ `frontend/src/pages/ClientsPage.tsx` - Added `retry: false`

**Total**: 4 files modified

## 📝 DEPLOYMENT NOTES

### No Backend Changes

- ✅ Backend behavior unchanged
- ✅ Still returns 500 on session validation failure

### Frontend Only

- ✅ Hot-reload will pick up changes
- ✅ No dependencies added
- ✅ No breaking changes

### Backward Compatibility

- ✅ Existing error handling still works (401, 400)
- ✅ Only adds NEW 500 handling
- ✅ React Query retry: false doesn't break anything

## 🎓 KEY PRINCIPLES

### Error Handling Best Practices

1. **Immediate Cleanup**: Clear auth data IMMEDIATELY on session error
2. **Immediate Redirect**: Don't wait for user action
3. **Disable Retry**: Let interceptor handle, don't retry automatically
4. **Clear Feedback**: Show toast message explaining what happened

### Andrea's Requirements Met

✅ **"se c'e' un problema cancella subito la session storage no?"**

- FIXED: Now clears localStorage + sessionStorage IMMEDIATELY on 500 session error
- FIXED: Immediate redirect to login
- FIXED: No more retry loop

### Key Takeaway

**ALWAYS HANDLE SESSION ERRORS AT MULTIPLE LEVELS**:

1. Axios interceptor → Detect and clean
2. React Query → Disable retry
3. localStorage → Clear immediately
4. UI → Show message + redirect

**NEVER LET RETRY LOOPS HAPPEN ON AUTH ERRORS**
