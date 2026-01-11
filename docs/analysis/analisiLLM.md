# Analisi Architettura LLM - Widget vs WhatsApp

## ✅ DECISIONI FINALI (11 Gennaio 2026)

| # | Domanda | Decisione |
|---|---------|-----------|
| 1 | Coda | ✅ **UNIFICATA** (MessageQueue con campo `channel`) |
| 2 | Widget risposta | ✅ **POLLING** (ogni 500ms, max 30 tentativi = 15 sec) |
| 3 | Chat storico | ✅ **ISOLATE** (chat separate per canale, carrello/ordini condivisi) |

---

## 📊 STATO ATTUALE (PROBLEMA)

### Widget (OGGI - NO Security Check)
```
Widget → Backend (LLMRouterService) → Risposta DIRETTA
         ❌ Nessun Security Check
         ❌ Nessun passaggio Scheduler
```

### WhatsApp (OGGI - OK)
```
WhatsApp → Backend → CODA → Scheduler → Security Check → WhatsApp API
                            ✅ Security Check
                            ✅ Pattern detection
```

---

## 🎯 ARCHITETTURA FUTURA

### Flusso Unificato
```
┌─────────────────────────────────────────────────────────────┐
│              MESSAGGIO (Widget O WhatsApp)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  1. LLMRouterService genera risposta                        │
│  2. Mette in MessageQueue con:                              │
│     - channel: "widget" o "whatsapp"                        │
│     - phoneNumber: (solo whatsapp)                          │
│     - visitorId: (solo widget)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SCHEDULER                               │
│  1. Prende messaggi (status: pending)                       │
│  2. ✅ SECURITY CHECK (uguale per tutti)                    │
│  3. Se channel="whatsapp":                                  │
│     → Invia a WhatsApp API                                  │
│     → status: "sent"                                        │
│  4. Se channel="widget":                                    │
│     → NON fa nulla, solo marca                              │
│     → status: "ready"                                       │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
    WhatsApp API                           Widget Polling
    (push al telefono)               (GET /widget/poll/:id)
```

---

## 📋 PIANO IMPLEMENTAZIONE

### FASE 1: Database Migration
```prisma
model WhatsAppQueue {  // O rinomina in MessageQueue
  ...
  channel     String    // "whatsapp" | "widget" - NUOVO!
  phoneNumber String?   // Nullable (NULL per widget)
  visitorId   String?   // NUOVO! (NULL per whatsapp)
  ...
}

model ChatSession {
  ...
  channel     String    @default("whatsapp") // NUOVO!
  ...
}
```

### FASE 2: Backend Changes
- Widget endpoint mette in coda con `channel: "widget"`
- Nuovo endpoint `GET /api/v1/widget/poll/:messageId`

### FASE 3: Scheduler Changes
- Logica delivery diversa per channel

### FASE 4: Widget Changes  
- Polling per risposte (500ms x 30 = 15 sec max)
- Typing indicator durante attesa

### FASE 5: Supporto Markdown Widget
- Bold, italic, link, immagini

---

---

## 🔒 SECURITY CHECKS (DETTAGLI IMPLEMENTAZIONE)

### Ordine di Validazione (Scheduler - `messageProcessor.ts`)
```
1. Rate Limit Check (database-backed hardlimit)
   → Se workspace ha 0 credits: BLOCCA + log error
   
2. Content Safety Check
   → LLM evaluation: messaggioContiene(violazione)?
   → Se SÌ: status = "blocked", log incident, NO forward
   
3. Business Rules Check (per workspace)
   → Closed hours? (agentConfig.businessHours)
   → Maintenance mode? (workspace.maintenanceMode)
   → Se SÌ: status = "queued", risposta automatica al cliente
   
4. Channel-Specific Check
   → Se channel="whatsapp": verifica numero valido + non blacklist
   → Se channel="widget": verifica visitorId valido + workspace attivo
   
5. Anti-Spam Pattern (Redis cache)
   → Stessa persona 10+ messaggi in 30 secondi?
   → Stessa domanda 5+ volte in 1 minuto?
   → Se SÌ: silenzio 30 secondi, poi risposta generica
```

### Risultato per Ogni Scenaario
- ✅ **PASS**: status = "ready" (whatsapp) o "ready" (widget), procedi
- ❌ **FAIL**: status = "blocked", NO forward, log incident
- ⏸️ **DEFERRED**: status = "queued", risposta automatica, riprova dopo 5 minuti

---

## 🔌 WIDGET POLLING HTTP CONTRACT

### Request
```http
GET /api/v1/widget/poll/{messageId}
X-Widget-Session: {sessionId}
X-Workspace-Id: {workspaceId}
```

### Response (Status 200 - Always)
```json
{
  "status": "pending|ready|blocked|error",
  "message": "Messaggio da mostrare (NULL se pending)",
  "retryAfter": 500,
  "isComplete": false,
  "timestamp": "2026-01-11T10:30:45Z"
}
```

**Status Values:**
- `pending`: Messaggio ancora in elaborazione. Fai polling dopo 500ms
- `ready`: Messaggio pronto! Mostra content + fermati (NO più polling)
- `blocked`: Messaggio rifiutato per security. Mostra errore al cliente
- `error`: Errore interno del server. Mostra "Errore temporaneo, riprova dopo"

**Logica Widget Client:**
```javascript
// Polling loop
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(`/api/v1/widget/poll/${messageId}`)
  if (response.status === 200) {
    const data = await response.json()
    if (data.status === 'ready') {
      displayMessage(data.message)
      break  // ✅ STOP
    } else if (data.status === 'blocked') {
      displayError('Messaggio non accettato per motivi di sicurezza')
      break  // ❌ STOP (non riprova)
    } else if (data.status === 'error') {
      displayError('Errore temporaneo del server')
      break  // ❌ STOP (mostra errore)
    }
    // else: status === 'pending', continua polling
  } else {
    displayError('Network error')
    break
  }
  await sleep(data.retryAfter || 500)  // Aspetta 500ms (o valore dal server)
}
// Se 30 tentativi = 15 secondi TIMEOUT
if (attempt >= 30) {
  displayError('Messaggio in elaborazione (timeout)')
}
```

### Error Responses (Rare)
```http
404 Not Found      → messageId non esiste o scaduto (widget cancella polling)
401 Unauthorized   → sessione scaduta (widget fa login e riprova)
429 Too Many Requests → Rate limit (retry after 60 secondi)
500 Server Error   → Errore critico (retry dopo 5 minuti)
```

---

## 🆔 WIDGET VISITOR ID GENERATION

### Definizione
- **visitorId**: Identificatore anonimo del visitatore widget (non loggato)
- **Scopo**: Tracciare conversazioni anonime + cartello/ordini senza login
- **Lifetime**: Session-based (scade quando widget chiuso, non persistente)

### Generazione (Frontend - `widgetInitializer.ts`)
```typescript
function generateVisitorId(): string {
  // Format: visitor_{timestamp}_{randomHash}
  // Esempio: visitor_1726262000000_a7k2m9x1
  
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)  // 8 chars
  return `visitor_${timestamp}_${random}`
}

// Salva in sessionStorage (NON localStorage!)
sessionStorage.setItem('eChatbot_visitorId', visitorId)

// Se reload: riusa lo stesso visitorId
const visitorId = sessionStorage.getItem('eChatbot_visitorId') 
  || generateVisitorId()
```

### Utilizzo nel Backend
- **Widget message**: `visitorId` inviato nel payload
- **Scheduler**: Crea `ChatSession` con `customerId: visitorId` + `isAnonymous: true`
- **Carrello/Ordini**: Cercate con `customerId = visitorId` (funziona uguale a cliente loggato)
- **Analytics**: Traccia `visitorId` come proprietà separata (non legata a User)

### Privacy Notes
- ✅ NO identificazione personale (solo numero casuale)
- ✅ NO localStorage (svanisce chiudendo widget)
- ✅ NO cross-site tracking (sessionStorage solo per questo widget)
- ✅ NO server-side persistence oltre 30 giorni (auto-cleanup)

---

## 🔒 CHANNEL IMMUTABILITY RULES

### Regola 1: Chat Isolation
```
❌ Widget customer NON PUÒ accedere a chat WhatsApp
❌ WhatsApp customer NON PUÒ accedere a chat Widget

✅ Eccezione: Carrello e Ordini CONDIVISI tra canali
   (se cliente accede sia da Widget che WhatsApp con stesso numero)
```

Implementation:
```typescript
// Repository: findChatSession(customerId, channel)
async findChatSession(customerId: string, channel: "widget" | "whatsapp") {
  return await prisma.chatSession.findFirst({
    where: {
      customerId,
      channel,  // 🔒 FILTER MANDATORIO!
      workspaceId
    }
  })
}
```

### Regola 2: Channel Assignment al Primo Messaggio
```
Una ChatSession nasce CON un canale, NON PUÒ cambiare

❌ ChatSession.channel = "whatsapp" NON diventa "widget" mai
❌ ChatSession.channel = "widget" NON diventa "whatsapp" mai

Se cliente accede da canale diverso:
✅ CREA nuova ChatSession con nuovo canale
✅ Stessa customerId, ma chat SEPARATE
```

### Regola 3: MessageQueue Channel Immutability
```
Ogni messaggio nasce in MessageQueue con channel FISSO

❌ NON cambiare MessageQueue.channel dopo creazione
❌ NON migrare messaggi tra canali

✅ Se necessario: cancella + ricrea (audit log obbligatorio)
```

---

## 🔐 WIDGET AUTHENTICATION METHODS

### Metodo 1: Anonymous (Visitor)
**Quando**: Cliente NON loggato, accede con visitorId

```typescript
// Frontend invia:
{
  "visitorId": "visitor_1726262000000_a7k2m9x1",
  "workspaceId": "{workspace_public_id}",
  "message": "Ciao!"
}

// Backend crea ChatSession:
{
  customerId: visitorId,
  channel: "widget",
  isAnonymous: true,
  visitorIdHash: hash(visitorId),  // Protezione
  expiresAt: now() + 30.days
}
```

### Metodo 2: Authenticated (Logged-in)
**Quando**: Cliente loggato con JWT token

```typescript
// Frontend invia:
{
  "token": "{jwt_token}",  // Payload: userId, workspaceId
  "message": "Voglio tracciare l'ordine #123"
}

// Backend valida token, usa userId (NO visitorId)
{
  customerId: userId,  // Vero customer ID
  channel: "widget",
  isAnonymous: false
}

// Nota: Se cliente loggato + widget, usa stesso customerId
// Permette di tracciare ordini fatti via WhatsApp anche da widget!
```

### Metodo 3: Temporary Access Token (Public Links)
**Quando**: Cliente accede via link pubblico (pagina ordini tracciamento)

```typescript
// Link: /orders-public?token={temp_token}

// Token contiene:
{
  customerId: "xxx",
  workspaceId: "yyy",
  type: "order_tracking",
  expiresIn: "1 hour"
}

// Backend valida signature + expiry
// Crea temp session (NO salva in DB, pure JWT validation)
{
  customerId,
  isTemporary: true,
  scope: "order_tracking"
}
```

### Security Checks per Metodo
| Metodo | Rate Limit | IP Check | Spam Filter | Notes |
|--------|-----------|----------|-------------|-------|
| Anonymous | ✅ per visitorId | ✅ (soft) | ✅ (aggresivo) | Esposto pubblicamente |
| Authenticated | ✅ per userId | ✅ (strict) | ✅ (medio) | Token JWT valido |
| Temp Token | ✅ per customerId | ✅ (soft) | ✅ (medio) | 1 ora validità max |

---

## 🎯 PROSSIMI PASSI

Quando vuoi procedere, iniziamo dalla **FASE 1** (Database Migration).
