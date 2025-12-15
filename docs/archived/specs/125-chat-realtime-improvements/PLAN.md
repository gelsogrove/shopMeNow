# Chat History Real-Time Improvements - PIANO IMPLEMENTAZIONE

**Feature ID**: 125  
**Approccio**: Progressive Enhancement (Opzione C)  
**Tempo Stimato**: 2 ore  
**Priorità**: CRITICAL + HIGH

---

## 🎯 OBIETTIVI

### **CRITICAL** (Implementare SUBITO) 🔴

1. ✅ Fix real-time message update quando invii da popup WhatsApp
2. ✅ Backend emette `new-message` dopo LLM response
3. ✅ Frontend listener aggiorna lista chat istantaneamente

### **HIGH** (Implementare questa sessione) 🟠

4. ✅ Events per `user-blocked` / `user-unblocked`
5. ✅ Event per `new-customer` (prima chat)
6. ✅ Visual feedback (toast notifications)

---

## 📋 TASK BREAKDOWN

### **PHASE 1: Backend WebSocket Audit** (15 min)

**Task 1.1**: Verificare chat.gateway.ts esistente

- [ ] Leggere file `backend/src/interfaces/websocket/chat.gateway.ts`
- [ ] Identificare eventi già implementati
- [ ] Verificare room architecture (workspace rooms)

**Task 1.2**: Identificare dove aggiungere emit

- [ ] LLM Router: dopo risposta AI → emit `new-message`
- [ ] Customer Controller: dopo block/unblock → emit eventi
- [ ] Chat Controller: dopo creazione chat → emit `new-customer`

---

### **PHASE 2: Backend - Emit new-message dopo LLM Response** (30 min)

**File**: `backend/src/services/llm-router.service.ts`

**Task 2.1**: Import WebSocket Gateway

```typescript
import { ChatGateway } from "../interfaces/websocket/chat.gateway"
```

**Task 2.2**: Inject Gateway nel constructor

```typescript
constructor(
  private prisma: PrismaClient,
  private promptProcessor: PromptProcessorService,
  private chatGateway: ChatGateway  // ← NEW
) {}
```

**Task 2.3**: Emit evento dopo salvataggio messaggio

- Location: Dopo `await this.saveConversationMessage()`
- Event: `new-message`
- Payload:
  ```typescript
  {
    id: message.id,
    sessionId: params.conversationId,
    customerId: customer.id,
    content: finalResponse,
    sender: 'agent',
    timestamp: new Date().toISOString(),
    workspaceId: params.workspaceId
  }
  ```

**Task 2.4**: Emit a workspace room

```typescript
this.chatGateway.server
  .to(`workspace:${params.workspaceId}`)
  .emit("new-message", payload)
```

---

### **PHASE 3: Backend - User Blocked/Unblocked Events** (20 min)

**File**: `backend/src/interfaces/http/controllers/customer.controller.ts`

**Task 3.1**: Inject ChatGateway in CustomerController

**Task 3.2**: Emit `user-blocked` dopo block customer

- Location: Metodo `blockCustomer()` o simile
- Event: `user-blocked`
- Payload:
  ```typescript
  {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    workspaceId: workspaceId,
    blockedBy: userId,
    timestamp: new Date().toISOString()
  }
  ```

**Task 3.3**: Emit `user-unblocked` dopo unblock customer

- Same as above con event `user-unblocked`

---

### **PHASE 4: Backend - New Customer Event** (15 min)

**File**: `backend/src/services/llm-router.service.ts` o `chat.service.ts`

**Task 4.1**: Emit `new-customer` quando viene creata nuova ChatSession

- Location: Metodo che crea ChatSession (findOrCreateChatSession)
- Condition: `if (sessionIsNew)`
- Event: `new-customer`
- Payload:
  ```typescript
  {
    customerId: customer.id,
    sessionId: session.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    language: customer.language,
    workspaceId: workspaceId,
    timestamp: new Date().toISOString()
  }
  ```

---

### **PHASE 5: Frontend - WebSocket Event Listeners** (30 min)

**File**: `frontend/src/hooks/useWebSocket.ts`

**Task 5.1**: Add listener per `user-blocked`

```typescript
socket.on(
  "user-blocked",
  (data: { customerId: string; customerName: string; workspaceId: string }) => {
    logger.info("[WebSocket] User blocked:", data)

    // Invalida chat list
    queryClient.invalidateQueries({
      queryKey: ["chats", sessionId],
    })

    // Invalida customer details se è quello aperto
    queryClient.invalidateQueries({
      queryKey: ["customer", data.customerId],
    })

    // Toast notification
    toast.warning(`Customer ${data.customerName} has been blocked`)
  }
)
```

**Task 5.2**: Add listener per `user-unblocked`

- Same as above con toast success

**Task 5.3**: Add listener per `new-customer`

```typescript
socket.on(
  "new-customer",
  (data: {
    customerId: string
    customerName: string
    customerPhone: string
  }) => {
    logger.info("[WebSocket] New customer:", data)

    // Invalida chat list per mostrare nuovo customer
    queryClient.invalidateQueries({
      queryKey: ["chats", sessionId],
    })

    // Toast notification
    toast.info(`New customer: ${data.customerName} (${data.customerPhone})`)
  }
)
```

**Task 5.4**: Improve `new-message` listener

- Add toast notification se messaggio per chat NON selezionata
- Check if chat is currently selected:
  ```typescript
  const selectedChatId = localStorage.getItem("selectedChatId")
  if (message.sessionId !== selectedChatId) {
    toast.info(`New message from ${message.customerName}`)
  }
  ```

---

### **PHASE 6: Frontend - Visual Feedback** (20 min)

**File**: `frontend/src/pages/ChatPage.tsx`

**Task 6.1**: Add WebSocket connection status indicator

```tsx
<div className="flex items-center gap-2">
  {isWebSocketConnected ? (
    <span className="flex items-center gap-1 text-green-600 text-sm">
      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
      Connected
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-600 text-sm">
      <div className="w-2 h-2 bg-red-600 rounded-full" />
      Disconnected
    </span>
  )}
</div>
```

**Task 6.2**: Add loading state quando invia messaggio

- Mostra "Sending..." durante API call
- Disabilita input textarea

**Task 6.3**: Scroll automatico a nuovo messaggio

- Quando arriva nuovo messaggio → scroll to bottom
- Solo se era già in fondo (non interrompere lettura messaggi vecchi)

---

### **PHASE 7: Testing** (30 min)

**Test 7.1**: Test Popup WhatsApp → Lista Chat

- [ ] Apri popup WhatsApp
- [ ] Invia messaggio "ciao"
- [ ] Verifica: lista chat si aggiorna SENZA refresh
- [ ] Verifica: nuovo messaggio appare nella preview
- [ ] Verifica: timestamp aggiornato

**Test 7.2**: Test User Blocked Real-Time

- [ ] Apri 2 tab del browser
- [ ] Tab 1: Blocca un customer
- [ ] Tab 2: Verifica chat list si aggiorna automaticamente
- [ ] Verifica: Toast notification appare
- [ ] Verifica: Badge "BLOCKED" appare nella chat

**Test 7.3**: Test New Customer Real-Time

- [ ] Simula nuovo customer (crea ChatSession manualmente o via API)
- [ ] Verifica: Chat list si aggiorna
- [ ] Verifica: Toast notification "New customer: [nome]"
- [ ] Verifica: Nuovo customer appare in lista

**Test 7.4**: Test WebSocket Disconnection

- [ ] Disconnetti WebSocket (chiudi server backend)
- [ ] Verifica: Indicator mostra "Disconnected"
- [ ] Invia messaggio → dovrebbe usare fallback HTTP
- [ ] Riconnetti WebSocket
- [ ] Verifica: Indicator mostra "Connected"

---

## 🔧 IMPLEMENTAZIONE STEP-BY-STEP

### **Step 1**: Audit Backend WebSocket (PHASE 1)

- Leggo `chat.gateway.ts`
- Verifico architettura esistente
- Identifico dove aggiungere emit

### **Step 2**: Backend Emit Events (PHASE 2-4)

- LLM Router: emit `new-message` dopo risposta AI
- Customer Controller: emit `user-blocked`, `user-unblocked`
- Chat Service: emit `new-customer` per nuove sessioni

### **Step 3**: Frontend Listeners (PHASE 5)

- Hook useWebSocket: add 3 nuovi listener
- Invalidate queries appropriate
- Toast notifications

### **Step 4**: Visual Improvements (PHASE 6)

- Connection status indicator
- Loading states
- Auto-scroll

### **Step 5**: Testing (PHASE 7)

- Test tutti gli scenari
- Multi-tab sync
- Disconnection handling

---

## 📊 SUCCESS CRITERIA

**Before**:

- ❌ Popup WhatsApp → no lista chat update
- ❌ Block customer → no real-time update
- ❌ New customer → no notification
- ❌ No visual feedback

**After**:

- ✅ Popup WhatsApp → lista chat si aggiorna istantaneamente
- ✅ Block customer → toast + lista aggiornata in tutte le tab
- ✅ New customer → toast notification + appare in lista
- ✅ Connection indicator mostra stato WebSocket
- ✅ Toast notifications per tutti gli eventi
- ✅ Multi-tab sync funzionante

---

## 🚀 PROSSIMI STEP (DOPO questa sessione)

### **MEDIUM Priority** (Prossima settimana)

- [ ] Implement `customer-updated` event
- [ ] Implement `unread-count-updated` event
- [ ] Add unread badge to chat list
- [ ] Disable polling when WebSocket connected

### **LOW Priority** (Nice to have)

- [ ] Typing indicator "Customer is typing..."
- [ ] Optimistic updates (add message before API response)
- [ ] Sound notification per nuovi messaggi
- [ ] Desktop notifications (browser Notification API)

---

## ⏱️ TIME BREAKDOWN

| Phase      | Task                   | Tempo        | Status  |
| ---------- | ---------------------- | ------------ | ------- |
| 1          | Backend Audit          | 15 min       | ⏳ TODO |
| 2          | LLM Router new-message | 30 min       | ⏳ TODO |
| 3          | User blocked/unblocked | 20 min       | ⏳ TODO |
| 4          | New customer event     | 15 min       | ⏳ TODO |
| 5          | Frontend listeners     | 30 min       | ⏳ TODO |
| 6          | Visual feedback        | 20 min       | ⏳ TODO |
| 7          | Testing                | 30 min       | ⏳ TODO |
| **TOTALE** |                        | **2h 40min** |         |

**Note**: Se finiamo prima, possiamo fare qualche task MEDIUM priority 😊
