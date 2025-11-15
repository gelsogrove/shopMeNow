# Chat History Real-Time Improvements - AUDIT COMPLETO

**Data**: 13 Novembre 2025  
**Branch**: constitution-v1.5-alignment  
**Feature ID**: 125  
**Obiettivo**: Rendere la Chat History page 100% real-time e user-friendly

---

## 🎯 Problema Riportato dall'Utente

> "Quando sono dentro la popup di simulazione WhatsApp e scrivo nella chat, il chatbot mi risponde ma la chat sotto di history non si aggiorna. Prima avevamo un WebSocket che si aggiornava in tempo reale, ora devo fare refresh. Vorrei che tutte le funzionalità di questa pagina siano in tempo reale: nuovo messaggio, nuovo utente, utente bloccato, ecc."

---

## 📊 AUDIT FUNZIONALITÀ ESISTENTI

### ✅ **IMPLEMENTATO** - WebSocket Connection

**File**: `frontend/src/hooks/useWebSocket.ts`  
**Stato**: FUNZIONANTE ✅

**Eventi WebSocket Implementati**:

1. ✅ `connect` - Connessione stabilita
2. ✅ `disconnect` - Disconnessione
3. ✅ `join-workspace` - Join workspace room (emesso)
4. ✅ `workspace-joined` - Conferma join (ricevuto)
5. ✅ `new-message` - Nuovo messaggio ricevuto
   - Invalida query: `["chat-messages", sessionId]`
   - Invalida query: `["chats", sessionId]`
   - Invalida query: `["recent-chats", sessionId]`
6. ✅ `chat-updated` - Chat aggiornata (status change, ecc.)
   - Invalida query: `["chats", sessionId]`

**Configurazione**:

- URL: `http://localhost:3001` (VITE_API_URL)
- Transports: `["websocket", "polling"]`
- Reconnection: ✅ (5 tentativi, 1s delay)

**Problemi Identificati**:

- ❌ **Eventi mancanti**: `user-blocked`, `user-unblocked`, `chat-deleted`, `message-deleted`
- ❌ **No real-time per popup WhatsApp**: Quando invii messaggio da popup, la lista chat non si aggiorna istantaneamente
- ⚠️ **Invalidazione query troppo generica**: Invalida TUTTE le chat invece che solo quella specifica

---

### ✅ **IMPLEMENTATO** - Chat List Auto-Refresh

**File**: `frontend/src/contexts/ChatListContext.tsx`  
**Metodo**: `useQuery` con `refetchInterval`

**Funzionalità**:

- ✅ Polling ogni X secondi (configurabile)
- ✅ Refetch on window focus
- ✅ Refetch on mount

**Problemi**:

- ⚠️ **Polling inefficiente**: Con WebSocket funzionante, il polling dovrebbe essere disabilitato o ridotto significativamente
- ❌ **No feedback visivo**: Utente non vede quando arriva nuovo messaggio (nessun toast/notification)

---

### ✅ **IMPLEMENTATO** - Message Flow Timeline

**File**: `frontend/src/components/shared/MessageFlowDialog.tsx`  
**Stato**: FUNZIONANTE ✅

**Funzionalità**:

- ✅ Mostra step multi-agent flow
- ✅ System prompt visibile
- ✅ Token usage tracking
- ✅ Ordine corretto: PROMPT → INPUT → OUTPUT

**Problemi**:

- ✅ NESSUNO - Funziona correttamente

---

### ❌ **NON IMPLEMENTATO** - Real-Time Message Update in Popup WhatsApp

**File**: `frontend/src/components/shared/WhatsAppChatModal.tsx`  
**Problema**: Quando invii messaggio da popup → risposta AI arriva → **lista chat NON si aggiorna**

**Root Cause**:

1. Popup usa API `/chat/send-message` per inviare
2. Backend salva messaggio + risposta AI
3. Backend **NON emette evento WebSocket** `new-message` dopo risposta AI
4. Frontend non riceve notifica → nessun invalidate query → lista chat resta stale

**Fix Richiesto**:

- Backend deve emettere `new-message` dopo che LLM risponde
- Evento deve includere: `sessionId`, `content`, `timestamp`, `workspaceId`

---

### ❌ **NON IMPLEMENTATO** - Real-Time User Blocked/Unblocked

**Funzionalità Mancanti**:

1. ❌ Quando blocchi un customer → chat list non si aggiorna in real-time
2. ❌ Nessun evento WebSocket `user-blocked`
3. ❌ Nessuna notifica visiva all'utente

**Fix Richiesto**:

- Backend emette evento `user-blocked` con `customerId`, `workspaceId`
- Frontend riceve evento → invalida query chat list → mostra badge "BLOCKED"
- Toast notification: "Customer [nome] is now blocked"

---

### ❌ **NON IMPLEMENTATO** - Real-Time New Customer

**Funzionalità Mancanti**:

1. ❌ Quando arriva nuovo customer (prima chat) → chat list non si aggiorna in real-time
2. ❌ Nessun evento WebSocket `new-customer`
3. ❌ Nessuna notifica visiva

**Fix Richiesto**:

- Backend emette evento `new-customer` quando viene creato nuovo `ChatSession`
- Frontend riceve evento → invalida query → mostra toast "New customer: [nome]"

---

### ❌ **NON IMPLEMENTATO** - Real-Time Chat Deletion

**Funzionalità Mancanti**:

1. ❌ Quando elimini una chat → altre tab/utenti non vedono aggiornamento
2. ❌ Nessun evento WebSocket `chat-deleted`

**Fix Richiesto**:

- Backend emette evento `chat-deleted` con `sessionId`
- Frontend rimuove chat dalla lista istantaneamente

---

### ⚠️ **PARZIALMENTE IMPLEMENTATO** - Unread Count Update

**File**: `frontend/src/pages/ChatPage.tsx` (line 690-705)  
**Funzionalità**:

- ✅ Quando selezioni chat → chiama `/chat/:sessionId/mark-read`
- ✅ Invalida query per aggiornare unread count

**Problemi**:

- ❌ **No real-time unread count**: Se arriva nuovo messaggio mentre chat è aperta, unread count non si aggiorna in altre tab
- ❌ **No visual indicator**: Nessun badge/dot per messaggi non letti nella lista chat

**Fix Richiesto**:

- WebSocket event `unread-count-updated` con `sessionId`, `unreadCount`
- Badge visivo nella chat list per messaggi non letti

---

### ⚠️ **PARZIALMENTE IMPLEMENTATO** - Customer Details Update

**File**: `frontend/src/pages/ChatPage.tsx` (line 523-570)  
**Funzionalità**:

- ✅ Update customer info (name, email, company, discount, sales agent, language)
- ✅ API call `/customers/:customerId`
- ✅ Invalida query dopo update

**Problemi**:

- ❌ **No real-time sync**: Se modifichi customer da altra tab → questa tab non vede aggiornamento
- ❌ **No WebSocket event** `customer-updated`

**Fix Richiesto**:

- Backend emette evento `customer-updated` con `customerId`, `workspaceId`
- Frontend invalida query customer details + chat list (per aggiornare nome nella lista)

---

## 🔧 BACKEND WEBSOCKET IMPLEMENTATION STATUS

**File**: `backend/src/interfaces/websocket/chat.gateway.ts`

**Eventi Emessi dal Backend** (da verificare):

- ✅ `new-message` - Implementato?
- ✅ `chat-updated` - Implementato?
- ❌ `user-blocked` - MANCANTE
- ❌ `user-unblocked` - MANCANTE
- ❌ `new-customer` - MANCANTE
- ❌ `chat-deleted` - MANCANTE
- ❌ `customer-updated` - MANCANTE
- ❌ `unread-count-updated` - MANCANTE

**Action Items**:

1. Verificare quali eventi sono effettivamente implementati nel backend
2. Implementare eventi mancanti
3. Assicurarsi che LLM response trigger `new-message` event

---

## 📋 PIANO DI MIGLIORAMENTO

### **FASE 1: Audit Backend WebSocket** (30 min)

- [ ] Leggere `backend/src/interfaces/websocket/chat.gateway.ts`
- [ ] Verificare quali eventi sono implementati
- [ ] Identificare dove aggiungere emit per eventi mancanti

### **FASE 2: Fix Real-Time Message Update** (1 ora)

- [ ] **Backend**: Emettere `new-message` dopo LLM response in `llm-router.service.ts`
- [ ] **Frontend**: Verificare che listener `new-message` funzioni correttamente
- [ ] **Test**: Inviare messaggio da popup → verificare lista chat si aggiorna

### **FASE 3: Implement Missing WebSocket Events** (2 ore)

- [ ] **user-blocked**: Backend emette evento quando customer viene bloccato
- [ ] **user-unblocked**: Backend emette evento quando customer viene sbloccato
- [ ] **new-customer**: Backend emette evento quando viene creata nuova ChatSession
- [ ] **chat-deleted**: Backend emette evento quando chat viene eliminata
- [ ] **customer-updated**: Backend emette evento quando customer info cambia
- [ ] **unread-count-updated**: Backend emette evento quando unread count cambia

### **FASE 4: Frontend Event Listeners** (1.5 ore)

- [ ] Aggiungere listener per `user-blocked` → mostra toast + invalida query
- [ ] Aggiungere listener per `user-unblocked` → mostra toast + invalida query
- [ ] Aggiungere listener per `new-customer` → mostra toast + invalida query
- [ ] Aggiungere listener per `chat-deleted` → rimuove chat dalla lista
- [ ] Aggiungere listener per `customer-updated` → invalida query customer details
- [ ] Aggiungere listener per `unread-count-updated` → aggiorna badge unread

### **FASE 5: Visual Feedback Improvements** (1 ora)

- [ ] **Toast Notifications**: Mostra toast quando arriva nuovo messaggio (se chat non selezionata)
- [ ] **Unread Badge**: Aggiungi badge rosso con numero messaggi non letti
- [ ] **Typing Indicator**: "Customer is typing..." quando customer sta scrivendo
- [ ] **Connection Status**: Indicatore visivo connessione WebSocket (verde/rosso)

### **FASE 6: Performance Optimizations** (30 min)

- [ ] **Disable Polling**: Se WebSocket connesso, disabilita polling
- [ ] **Optimistic Updates**: Aggiungi messaggio alla lista PRIMA della risposta API
- [ ] **Debounce Invalidation**: Non invalidare query se stesso evento arriva 2+ volte in 500ms

### **FASE 7: Testing** (1 ora)

- [ ] **Test Multi-Tab**: Apri 2 tab → invia messaggio da una → verifica altra si aggiorna
- [ ] **Test Multi-User**: 2 utenti diversi → blocca customer → verifica entrambi vedono aggiornamento
- [ ] **Test Disconnection**: Disconnetti WebSocket → verifica fallback a polling funziona
- [ ] **Test Reconnection**: Riconnetti WebSocket → verifica sync stato

---

## 🎯 PRIORITÀ

### **CRITICAL (Fare SUBITO)** 🔴

1. Fix real-time message update in popup WhatsApp
2. Backend emit `new-message` dopo LLM response
3. Verificare listener WebSocket nel frontend funzionano

### **HIGH (Fare questa settimana)** 🟠

4. Implement `user-blocked` / `user-unblocked` events
5. Implement `new-customer` event
6. Add visual feedback (toast notifications)

### **MEDIUM (Fare prossima settimana)** 🟡

7. Implement `customer-updated` event
8. Implement `unread-count-updated` event
9. Add unread badge to chat list
10. Disable polling when WebSocket connected

### **LOW (Nice to have)** 🟢

11. Typing indicator
12. Connection status indicator
13. Optimistic updates

---

## 📝 NOTE TECNICHE

### **WebSocket Room Architecture**

```typescript
// Backend (chat.gateway.ts)
socket.join(`workspace:${workspaceId}`) // Tutti gli utenti del workspace
socket.join(`customer:${customerId}`) // Tutti i messaggi del customer

// Emissione eventi
io.to(`workspace:${workspaceId}`).emit("new-message", data)
io.to(`customer:${customerId}`).emit("user-blocked", data)
```

### **Frontend Query Invalidation Strategy**

```typescript
// Quando arriva nuovo messaggio per chat SELEZIONATA
queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId] })

// Quando arriva nuovo messaggio per chat NON selezionata
queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
toast.info(`New message from ${customerName}`)

// Quando customer viene bloccato
queryClient.invalidateQueries({ queryKey: ["chats", userSessionId] })
queryClient.invalidateQueries({ queryKey: ["customers", customerId] })
```

### **Event Payload Examples**

```typescript
// new-message
{
  id: string
  sessionId: string
  customerId: string
  content: string
  sender: 'customer' | 'agent'
  timestamp: string
  workspaceId: string
}

// user-blocked
{
  customerId: string
  workspaceId: string
  blockedBy: string  // userId
  reason?: string
  timestamp: string
}

// new-customer
{
  customerId: string
  sessionId: string
  customerName: string
  customerPhone: string
  workspaceId: string
  timestamp: string
}

// customer-updated
{
  customerId: string
  workspaceId: string
  updatedFields: string[]  // ['name', 'email', 'discount']
  timestamp: string
}
```

---

## ✅ SUCCESS METRICS

**Prima dell'implementazione**:

- ❌ Devi fare refresh manuale per vedere nuovi messaggi
- ❌ Nessuna notifica quando arriva nuovo messaggio
- ❌ Chat list non si aggiorna quando blocchi customer
- ❌ Nessun feedback visivo per messaggi non letti

**Dopo l'implementazione**:

- ✅ Messaggi appaiono istantaneamente senza refresh
- ✅ Toast notification quando arriva nuovo messaggio
- ✅ Chat list si aggiorna in real-time quando blocchi customer
- ✅ Badge rosso mostra numero messaggi non letti
- ✅ Multi-tab sync: modifiche in una tab visibili in tutte le altre
- ✅ Typing indicator mostra quando customer sta scrivendo
- ✅ Connection status indicator mostra stato WebSocket

---

## 🚀 NEXT STEPS

**Immediate Action**:

1. Andrea, conferma se vuoi procedere con questo piano
2. Iniziare da FASE 1: Audit Backend WebSocket
3. Implementare FASE 2: Fix Real-Time Message Update (CRITICAL)

**Questions for Andrea**:

- Vuoi che implementiamo TUTTO o solo le priorità CRITICAL/HIGH?
- C'è qualche altra funzionalità real-time che ti serve?
- Preferisci approccio "quick fix" o refactoring completo?
