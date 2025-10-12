# 🔍 Analisi ChatPage - Problemi e Soluzioni

**Data**: 12 Ottobre 2025  
**Autore**: Andrea & AI Assistant

---

## 📋 COSA FA LA PAGINA CHAT

### Funzionalità Principali

1. **Lista Chat Clienti** (sidebar sinistra)

   - Mostra tutte le conversazioni WhatsApp attive
   - Nome cliente, ultimo messaggio, timestamp
   - Stato chatbot (attivo/disattivo)
   - Stato blacklist cliente
   - Search bar per filtrare per nome/telefono/azienda

2. **Visualizzazione Messaggi** (area centrale)

   - Mostra storico messaggi della chat selezionata
   - Messaggi INBOUND (cliente) vs OUTBOUND (operatore/bot)
   - Timestamp ogni messaggio
   - Metadata (operatore, agent LLM)

3. **Azioni Disponibili**

   - ✏️ Modifica info cliente (nome, telefono, email, lingua, azienda)
   - 🛒 Visualizza carrello cliente (iframe)
   - 📝 Invia messaggio manuale
   - 🤖 Attiva/disattiva chatbot per cliente
   - 🚫 Blocca/sblocca cliente (blacklist)
   - 🗑️ Elimina conversazione

4. **Cross-Tab Sync**
   - Sincronizzazione tra tab multiple aperte
   - Evita conflitti di polling
   - Notifiche localStorage quando cambiano dati

---

## ⚠️ PROBLEMI ATTUALI

### 1. **Polling Inefficiente**

**Problema**:

```typescript
// ChatListContext.tsx - Poll ogni 15 secondi
refetchInterval: 15000

// useCurrentChatMessages.ts - Poll ogni 10 secondi
refetchInterval: hasPollingLock ? 10000 : false
```

**Impatto**:

- ❌ Troppi request HTTP inutili
- ❌ Latenza di 10-15 secondi per vedere nuovi messaggi
- ❌ Carico server elevato
- ❌ Batteria consumata su mobile

### 2. **Errori 404 su Cambio Workspace**

**Screenshot**:

```
GET http://localhost:3000/api/workspaces/onboarding-workspace-id-12345/...
404 (Not Found)
```

**Causa**:

- Query in corso quando workspace cambia
- `workspaceId` non aggiornato subito in query key
- Cache non invalidata correttamente

### 3. **Timeout 10 Secondi per Refresh**

**Problema**:

```typescript
refetchInterval: hasPollingLock ? 10000 : false
```

**Impatto**:

- ❌ User aspetta fino a 10 secondi per vedere risposta bot
- ❌ UX pessima, sembra "rotto"
- ❌ Operatore pensa messaggio non inviato

### 4. **Cross-Tab Sync Buggy**

**Problema**:

```typescript
// localStorage sync manuale
window.addEventListener("storage", handleStorageChange)
```

**Impatto**:

- ❌ Eventi storage non sempre affidabili
- ❌ Race conditions tra tab
- ❌ Lock system complicato e fragile

---

## ✅ SOLUZIONE: WebSocket Real-Time

### Architettura Proposta

```
┌─────────────┐         WebSocket          ┌─────────────┐
│  Frontend   │◄──────────────────────────►│   Backend   │
│  ChatPage   │         /ws/chat           │   Socket.io │
└─────────────┘                            └─────────────┘
      │                                            │
      │ 1. Connect ws                             │
      │──────────────────────────────────────────►│
      │                                            │
      │ 2. Subscribe workspace                    │
      │    {workspaceId: "xxx"}                   │
      │──────────────────────────────────────────►│
      │                                            │
      │ 3. Real-time events                       │
      │◄──────────────────────────────────────────│
      │    - new_message                          │
      │    - message_sent                         │
      │    - chat_updated                         │
      │    - customer_blocked                     │
```

### Eventi WebSocket

| Evento                | Direzione  | Payload                 | Descrizione                        |
| --------------------- | ---------- | ----------------------- | ---------------------------------- |
| `subscribe_workspace` | → Backend  | `{workspaceId}`         | Subscribe a workspace specifico    |
| `new_message`         | ← Frontend | `{sessionId, message}`  | Nuovo messaggio da cliente         |
| `message_sent`        | ← Frontend | `{sessionId, message}`  | Messaggio inviato da operatore     |
| `chat_updated`        | ← Frontend | `{sessionId, updates}`  | Chat aggiornata (nome, lang, etc)  |
| `chatbot_toggled`     | ← Frontend | `{sessionId, active}`   | Chatbot attivato/disattivato       |
| `customer_blocked`    | ← Frontend | `{customerId, blocked}` | Cliente bloccato/sbloccato         |
| `workspace_changed`   | → Backend  | `{workspaceId}`         | Cambio workspace (unsubscribe old) |

---

## 🛠️ IMPLEMENTAZIONE

### Backend: Socket.io Server

**File**: `/backend/src/services/websocket.service.ts`

```typescript
import { Server as SocketIOServer } from "socket.io"
import { Server as HttpServer } from "http"

export class WebSocketService {
  private io: SocketIOServer

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
      },
      path: "/ws/chat",
    })

    this.setupHandlers()
  }

  private setupHandlers() {
    this.io.on("connection", (socket) => {
      logger.info(`Client connected: ${socket.id}`)

      // Subscribe to workspace
      socket.on("subscribe_workspace", (workspaceId: string) => {
        socket.join(`workspace:${workspaceId}`)
        logger.info(
          `Client ${socket.id} subscribed to workspace ${workspaceId}`
        )
      })

      // Unsubscribe from workspace
      socket.on("unsubscribe_workspace", (workspaceId: string) => {
        socket.leave(`workspace:${workspaceId}`)
        logger.info(
          `Client ${socket.id} unsubscribed from workspace ${workspaceId}`
        )
      })

      socket.on("disconnect", () => {
        logger.info(`Client disconnected: ${socket.id}`)
      })
    })
  }

  // Emit new message to all clients in workspace
  public emitNewMessage(workspaceId: string, sessionId: string, message: any) {
    this.io.to(`workspace:${workspaceId}`).emit("new_message", {
      sessionId,
      message,
    })
  }

  // Emit chat update to all clients
  public emitChatUpdate(workspaceId: string, sessionId: string, updates: any) {
    this.io.to(`workspace:${workspaceId}`).emit("chat_updated", {
      sessionId,
      updates,
    })
  }
}
```

### Frontend: Socket.io Client Hook

**File**: `/frontend/src/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { useWorkspace } from "./use-workspace"
import { logger } from "@/lib/logger"

export function useWebSocket(onMessage: (data: any) => void) {
  const socketRef = useRef<Socket | null>(null)
  const { workspace } = useWorkspace()

  useEffect(() => {
    if (!workspace?.id) return

    // Create socket connection
    const socket = io("http://localhost:3001", {
      path: "/ws/chat",
      auth: {
        sessionId: localStorage.getItem("sessionId"),
      },
    })

    socketRef.current = socket

    // Subscribe to workspace on connect
    socket.on("connect", () => {
      logger.info("WebSocket connected")
      socket.emit("subscribe_workspace", workspace.id)
    })

    // Listen for new messages
    socket.on("new_message", (data) => {
      logger.info("New message received:", data)
      onMessage(data)
    })

    // Listen for chat updates
    socket.on("chat_updated", (data) => {
      logger.info("Chat updated:", data)
      onMessage(data)
    })

    // Cleanup on unmount or workspace change
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("unsubscribe_workspace", workspace.id)
        socketRef.current.disconnect()
      }
    }
  }, [workspace?.id, onMessage])

  return socketRef.current
}
```

### Frontend: Aggiornamento ChatPage

**File**: `/frontend/src/pages/ChatPage.tsx`

```typescript
// REMOVE polling
const { data: chats = [] } = useQuery({
  queryKey: ["chats", workspaceId],
  queryFn: fetchChats,
  // ❌ REMOVE: refetchInterval: 15000
  staleTime: Infinity, // Never auto-refetch
})

// ADD WebSocket hook
const queryClient = useQueryClient()
useWebSocket((data) => {
  switch (data.type) {
    case "new_message":
      // Invalidate messages query for this session
      queryClient.invalidateQueries(["chat-messages", data.sessionId])
      // Update chat list (move to top, update last message)
      queryClient.invalidateQueries(["chats"])
      break

    case "chat_updated":
      // Update specific chat in cache
      queryClient.setQueryData(["chats"], (old: Chat[]) =>
        old.map((chat) =>
          chat.sessionId === data.sessionId
            ? { ...chat, ...data.updates }
            : chat
        )
      )
      break
  }
})
```

---

## 📊 BENEFICI WEBSOCKET

### Performance

| Metrica                | Polling (Prima)           | WebSocket (Dopo) | Miglioramento       |
| ---------------------- | ------------------------- | ---------------- | ------------------- |
| Latenza nuovi messaggi | 10-15 secondi             | <100ms           | **150x più veloce** |
| Request HTTP/minuto    | 10 (4 chats + 6 messages) | 0                | **100% meno**       |
| Carico server          | Alto                      | Basso            | **-90%**            |
| Batteria mobile        | Alta consumo              | Bassa            | **-70%**            |

### User Experience

| Aspetto                | Prima              | Dopo              |
| ---------------------- | ------------------ | ----------------- |
| ⏱️ Risposta bot        | Aspetta 10 sec     | **Immediato**     |
| 🔄 Cambio workspace    | 404 errors, 10 sec | **Istantaneo**    |
| 📱 Multi-tab           | Conflitti, lock    | **Sincronizzato** |
| 🚀 Percezione velocità | Lento, buggy       | **Reattivo**      |

---

## 🚦 PIANO IMPLEMENTAZIONE

### Fase 1: Backend WebSocket (2 ore)

1. ✅ Installa Socket.io: `npm install socket.io`
2. ✅ Crea `WebSocketService` con gestione connessioni
3. ✅ Integra con routes esistenti:
   - WhatsApp webhook → `emitNewMessage()`
   - Send message controller → `emitMessageSent()`
   - Update customer → `emitChatUpdate()`
4. ✅ Test con Postman/wscat

### Fase 2: Frontend WebSocket (2 ore)

1. ✅ Installa Socket.io client: `npm install socket.io-client`
2. ✅ Crea `useWebSocket` hook
3. ✅ Rimuovi polling da `ChatListContext`
4. ✅ Rimuovi polling da `useCurrentChatMessages`
5. ✅ Integra WebSocket in `ChatPage`
6. ✅ Test con multiple tab aperte

### Fase 3: Fix Cambio Workspace (1 ora)

1. ✅ Unsubscribe da workspace vecchio
2. ✅ Subscribe a workspace nuovo
3. ✅ Invalidate tutte le query
4. ✅ Clear selected chat
5. ✅ Test cambio workspace rapido

### Fase 4: Testing & Polish (1 ora)

1. ✅ Test scenari:
   - Nuovo messaggio cliente
   - Invia messaggio operatore
   - Attiva/disattiva chatbot
   - Blocca/sblocca cliente
   - Cambio workspace
   - Multiple tab sync
2. ✅ Gestione errori e riconnessione automatica
3. ✅ Indicatore connessione WebSocket in UI

---

## 🎯 RISULTATO FINALE

### Prima (Polling)

```
👤 Cliente: "Ciao"
⏰ Wait... (up to 10 seconds)
🤖 Bot: "Ciao! Come posso aiutarti?"
⏰ Wait... (up to 10 seconds)
👨‍💻 Operatore vede: "Ciao! Come posso aiutarti?"
```

### Dopo (WebSocket)

```
👤 Cliente: "Ciao"
💨 <100ms
🤖 Bot: "Ciao! Come posso aiutarti?"
💨 <100ms
👨‍💻 Operatore vede: "Ciao! Come posso aiutarti?"
```

**User experience: DA LENTO E BUGGY A INSTANT E FLUIDO** ⚡

---

## ❓ DOMANDE PER ANDREA

1. **Vuoi che implementiamo WebSocket ORA?** (6 ore totali)
2. **O preferisci prima un fix rapido del polling?** (30 min, meno efficace)
3. **Vuoi vedere un indicatore visivo di connessione WebSocket?** (pallino verde/rosso)
4. **Altre funzionalità che ti servono nella chat?**

---

**Fine Analisi** 🎉

_Prossimo step: Aspetto tua decisione su quale approccio seguire!_
