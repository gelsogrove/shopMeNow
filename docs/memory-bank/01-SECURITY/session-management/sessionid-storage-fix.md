# Bug Fix: SessionID Storage Inconsistency

**Data**: 13 Ottobre 2025  
**Branch**: `01-layer-security`  
**Tipo**: Critical Bug Fix

---

## 🐛 Problema Riscontrato

Il frontend NON inviava il `X-Session-Id` header in alcune chiamate API, causando errori 400:

```
🔍 [SESSION MIDDLEWARE] SessionID from header: MISSING
⚠️ SessionID missing for GET /workspaces/cm9hjgq9v00014qk8fsdy4ujv
Response Status: 400
```

### Root Cause

**Inconsistenza nello storage del sessionId**:

- ✅ Il sessionId viene **SALVATO** in `localStorage` (corretto)
- ❌ Alcuni file lo **CERCAVANO** in `sessionStorage` (sbagliato)

---

## 🔧 Correzioni Applicate

### 1. SettingsPage.tsx

**Prima**:

```typescript
"X-Session-Id": sessionStorage.getItem("sessionId") || "",
```

**Dopo**:

```typescript
"X-Session-Id": localStorage.getItem("sessionId") || "",
```

**File**: `/frontend/src/pages/SettingsPage.tsx` (line 106)

---

### 2. workspaceApi.ts

**Prima**:

```typescript
const sessionId = sessionStorage.getItem("sessionId")
```

**Dopo**:

```typescript
const sessionId = localStorage.getItem("sessionId")
```

**File**: `/frontend/src/services/workspaceApi.ts` (line 44)

---

### 3. Header.tsx (Logout)

**Prima**:

```typescript
sessionStorage.removeItem("sessionId")
```

**Dopo**:

```typescript
localStorage.removeItem("sessionId")
```

**File**: `/frontend/src/components/layout/Header.tsx` (line 127)

---

## ✅ Verifica Consistenza

### Storage Policy (CORRETTA):

| Dato                 | Storage          | Persist | Ragione                                 |
| -------------------- | ---------------- | ------- | --------------------------------------- |
| **sessionId**        | `localStorage`   | ✅ SI   | Deve sopravvivere a page reload         |
| **token** (JWT)      | `localStorage`   | ✅ SI   | Autenticazione persistente              |
| **user**             | `localStorage`   | ✅ SI   | Dati utente persistenti                 |
| **currentWorkspace** | `sessionStorage` | ❌ NO   | Solo per sessione browser corrente      |
| **chat-tab-lock**    | `localStorage`   | ✅ SI   | Prevenire apertura multipla (cross-tab) |

---

## 📝 Files Coinvolti

**File Corretti** (3):

1. `/frontend/src/pages/SettingsPage.tsx`
2. `/frontend/src/services/workspaceApi.ts`
3. `/frontend/src/components/layout/Header.tsx`

**File GIÀ CORRETTI** (usano localStorage):

- `/frontend/src/services/api.ts` - `setSessionId()`, `getSessionId()`, `clearSessionId()`
- `/frontend/src/pages/LoginPage.tsx` - Salva sessionId dopo login
- `/frontend/src/contexts/ChatListContext.tsx` - Legge da localStorage
- `/frontend/src/pages/ChatPage.tsx` - Legge da localStorage
- `/frontend/src/pages/WorkspaceSelectionPage.tsx` - Legge da localStorage

---

## 🧪 Test di Verifica

### Scenario Test:

1. ✅ Login con `admin@shopme.com` / `venezia44`
2. ✅ Verifica che `localStorage.getItem("sessionId")` esista
3. ✅ Naviga su Settings page
4. ✅ Verifica che chiamata `GET /api/workspaces/:id` includa header `X-Session-Id`
5. ✅ Verifica risposta 200 (non più 400)

### Expected Logs:

```
🔍 [SESSION MIDDLEWARE] SessionID from header: 0629c68c...
✅ Session valid for user admin@shopme.com
Response Status: 200
```

---

## 🚨 Reminder per Future Development

**REGOLA CRITICA**:

- **sessionId** → SEMPRE `localStorage` (NON `sessionStorage`)
- **currentWorkspace** → SEMPRE `sessionStorage` (NON `localStorage`)

**Helper Functions** (da usare sempre):

```typescript
import { getSessionId, setSessionId, clearSessionId } from "@/services/api"

// ✅ CORRETTO
const sessionId = getSessionId()

// ❌ SBAGLIATO
const sessionId = sessionStorage.getItem("sessionId")
```

---

## 📊 Impatto

**Prima della correzione**:

- ❌ Settings page: 400 error
- ❌ Workspace API calls: fallimento
- ❌ SessionID validation: missing

**Dopo la correzione**:

- ✅ Settings page: funziona correttamente
- ✅ Workspace API calls: 200 OK
- ✅ SessionID validation: presente e valido

---

**Status**: ✅ **RISOLTO E TESTATO**  
**Andrea, ora il sessionId viene sempre letto da localStorage in modo consistente!** 🚀
