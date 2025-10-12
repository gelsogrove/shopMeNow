# WhatsApp Integration Architecture

**Data**: 12 Ottobre 2025  
**Autore**: Andrea + AI Assistant  
**Status**: 🔴 DA IMPLEMENTARE

---

## 🎯 OBIETTIVO

Integrare completamente WhatsApp Business API con il sistema ShopME per:

1. Ricevere messaggi dai clienti via webhook
2. Inviare messaggi ai clienti (operatore o sistema)
3. Gestire push notifications (sconti, chatbot attivato, ordini)
4. Monitorare stato invio/ricezione messaggi

---

## 🏗️ ARCHITETTURA GENERALE

```
┌─────────────────┐
│  WhatsApp API   │
│  (Meta/FB)      │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ WEBHOOK  │ POST /api/whatsapp/webhook
    │ INBOUND  │ (riceve messaggi)
    └────┬─────┘
         │
    ┌────▼─────────────────┐
    │ 1. Verifica numero   │
    │ 2. Trova Customer    │
    │ 3. Converti MD→WA    │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │   LLM Service        │
    │ (genera risposta)    │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ 4. Converti WA→MD    │
    │ 5. Invia a WhatsApp  │
    │ 6. Salva con status  │
    └──────────────────────┘


┌─────────────────┐
│   Frontend      │
│   (Operatore)   │
└────────┬────────┘
         │
    ┌────▼─────┐
    │   SEND   │ POST /api/whatsapp/send
    │ OUTBOUND │ (invia messaggi)
    └────┬─────┘
         │
    ┌────▼─────────────────┐
    │ 1. Valida sessione   │
    │ 2. Valida workspace  │
    │ 3. Valida customer   │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ 4. Converti WA format│
    │ 5. Invia a WhatsApp  │
    │ 6. Salva con status  │
    └──────────────────────┘


┌─────────────────┐
│  Push Events    │
│ (Sconti/Orders) │
└────────┬────────┘
         │
    ┌────▼──────────────────┐
    │ WhatsAppNotification  │
    │      Service          │
    └────┬──────────────────┘
         │
    ┌────▼─────────────────┐
    │ 1. Prepara messaggio │
    │ 2. Invia a WhatsApp  │
    │ 3. Salva con status  │
    └──────────────────────┘
```

---

## 📡 API 1: WEBHOOK INBOUND

### **Endpoint**

```
POST /api/whatsapp/webhook
```

### **Scopo**

Ricevere messaggi dai clienti WhatsApp e processarli automaticamente con LLM.

### **Flusso Completo**

```typescript
// 1. WhatsApp invia POST al nostro webhook
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "393491234567",
          "id": "wamid.xxx",
          "timestamp": "1697123456",
          "text": {
            "body": "Ciao, vorrei vedere i prodotti"
          },
          "type": "text"
        }]
      }
    }]
  }]
}

// 2. SICUREZZA: Verificare firma WhatsApp
const signature = req.headers['x-hub-signature-256']
const isValid = verifyWhatsAppSignature(req.body, signature, WHATSAPP_APP_SECRET)
if (!isValid) {
  return res.status(403).json({ error: 'Invalid signature' })
}

// 3. ESTRAZIONE: Numero di telefono
const phoneNumber = "+393491234567"

// 4. DATABASE LOOKUP: Trova customer + workspace
const customer = await prisma.customers.findFirst({
  where: { phone: phoneNumber },
  include: { workspace: true }
})

if (!customer) {
  logger.warn(`Customer not found for phone ${phoneNumber}`)
  // Invia messaggio "Registrati prima" oppure ignora
  return res.status(200).json({ status: 'customer_not_found' })
}

// 5. CONVERSIONE: WhatsApp → Markdown (per salvare nel DB)
const messageMarkdown = whatsAppToMarkdown(incomingMessage)

// 6. CHIAMA LLM SERVICE
const llmResponse = await llmService.handleMessage({
  workspaceId: customer.workspaceId,
  customerId: customer.id,
  phoneNumber: customer.phone,
  message: messageMarkdown,
  sessionId: customer.activeChatSessionId || null
})

// 7. CONVERSIONE: Markdown → WhatsApp format
const whatsappMessage = markdownToWhatsApp(llmResponse.responseText)

// 8. INVIA RISPOSTA A WHATSAPP
const { success, error, messageId } = await sendToWhatsApp(
  customer.phone,
  whatsappMessage,
  customer.workspaceId
)

// 9. SALVA NEL DB CON STATUS
await prisma.messages.create({
  data: {
    workspaceId: customer.workspaceId,
    customerId: customer.id,
    phoneNumber: customer.phone,
    message: messageMarkdown,        // Messaggio ricevuto
    response: llmResponse.responseText, // Risposta LLM
    direction: "INBOUND",
    agentSelected: "CHATBOT",
    whatsappStatus: success ? "sent" : "failed",
    whatsappError: error || null,
    whatsappMessageId: messageId || null
  }
})

// 10. WEBHOOK RESPONSE (200 OK sempre!)
return res.status(200).json({
  status: 'processed',
  messageId: messageId
})
```

### **Sicurezza**

1. **Verifica Firma WhatsApp** (OBBLIGATORIO):

   ```typescript
   import crypto from "crypto"

   function verifyWhatsAppSignature(
     payload: any,
     signature: string,
     appSecret: string
   ): boolean {
     const hmac = crypto.createHmac("sha256", appSecret)
     const digest = hmac.update(JSON.stringify(payload)).digest("hex")
     return `sha256=${digest}` === signature
   }
   ```

2. **Verifica Numero nel DB**:

   - Se numero NON esiste → ignora o invia "Registrati prima"
   - Se numero esiste → processa normalmente

3. **Rate Limiting**:
   - Max 100 messaggi/minuto per workspace
   - Blocca spam da stesso numero (max 10 msg/minuto)

### **Gestione Errori**

| Caso                  | Azione                                |
| --------------------- | ------------------------------------- |
| Customer non trovato  | Risposta 200 + ignora messaggio       |
| LLM fallisce          | Salva messaggio + risposta di default |
| WhatsApp API fallisce | Salva con `whatsappStatus: "failed"`  |
| Firma invalida        | Risposta 403 Forbidden                |

---

## 📤 API 2: SEND MESSAGE

### **Endpoint**

```
POST /api/whatsapp/send
```

### **Scopo**

Permettere agli operatori di inviare messaggi manuali ai clienti.

### **Request**

```typescript
// Headers
{
  "X-Session-Id": "uuid-session-id",
  "Content-Type": "application/json"
}

// Body
{
  "workspaceId": "workspace-uuid",
  "customerId": "customer-uuid",
  "phoneNumber": "+393491234567",
  "message": "Ciao! Il tuo ordine è pronto per la spedizione 📦"
}
```

### **Flusso Completo**

```typescript
// 1. VALIDAZIONE SESSIONE
const sessionId = req.headers["x-session-id"]
const session = await adminSessionService.validateSession(sessionId)

if (!session.valid) {
  return res.status(401).json({ error: "Invalid session" })
}

// 2. ESTRAZIONE PARAMETRI
const { workspaceId, customerId, phoneNumber, message } = req.body

// 3. VALIDAZIONE WORKSPACE
if (session.session.workspaceId !== workspaceId) {
  return res.status(403).json({
    error: "Workspace mismatch",
    message: "Session does not belong to this workspace",
  })
}

// 4. VALIDAZIONE CUSTOMER
const customer = await prisma.customers.findUnique({
  where: { id: customerId },
})

if (!customer || customer.workspaceId !== workspaceId) {
  return res
    .status(404)
    .json({ error: "Customer not found or workspace mismatch" })
}

if (customer.phone !== phoneNumber) {
  return res.status(400).json({ error: "Phone number mismatch" })
}

// 5. CONVERSIONE: Markdown → WhatsApp
const whatsappMessage = markdownToWhatsApp(message)

// 6. INVIA A WHATSAPP
const { success, error, messageId } = await sendToWhatsApp(
  phoneNumber,
  whatsappMessage,
  workspaceId
)

// 7. SALVA NEL DB
const savedMessage = await prisma.messages.create({
  data: {
    workspaceId,
    customerId,
    phoneNumber,
    message: "", // Nessun messaggio in ingresso
    response: message, // Messaggio operatore
    direction: "OUTBOUND",
    agentSelected: "OPERATOR", // Operatore manuale
    whatsappStatus: success ? "sent" : "failed",
    whatsappError: error || null,
    whatsappMessageId: messageId || null,
    sentBy: session.session.userId, // Chi ha inviato
  },
})

// 8. RISPOSTA
return res.status(200).json({
  success,
  messageId,
  savedMessageId: savedMessage.id,
  error: error || null,
})
```

### **Sicurezza**

1. ✅ **Session validation** via `X-Session-Id`
2. ✅ **Workspace isolation** - sessionId deve appartenere a workspaceId
3. ✅ **Customer ownership** - customerId deve appartenere a workspaceId
4. ✅ **Phone validation** - phoneNumber deve corrispondere a customer
5. ✅ **Audit trail** - salva `sentBy` (userId dell'operatore)

### **Response Codes**

| Code | Significato                    |
| ---- | ------------------------------ |
| 200  | Messaggio inviato con successo |
| 400  | Parametri invalidi             |
| 401  | Sessione invalida/scaduta      |
| 403  | Workspace mismatch             |
| 404  | Customer non trovato           |
| 500  | Errore WhatsApp API o DB       |

---

## 🔔 PUSH NOTIFICATIONS

### **Casi d'Uso**

1. **Chatbot Attivato/Disattivato**

   - Quando operatore abilita/disabilita chatbot per un cliente
   - Messaggio: "✅ Chatbot attivato! Da ora risponderò automaticamente"

2. **Nuovo Sconto Disponibile**

   - Quando viene creato un nuovo offer
   - Messaggio: "🎉 Nuovo sconto del 20% su tutti i prodotti!"

3. **Ordine Aggiornato**

   - Quando cambia stato ordine
   - Messaggio: "📦 Il tuo ordine #1234 è stato spedito!"

4. **Prodotto in Offerta**
   - Quando un prodotto che ha visto va in offerta
   - Messaggio: "💰 Il prodotto che hai visto è ora in offerta!"

### **Servizio Centralizzato**

```typescript
// backend/src/services/whatsapp-notification.service.ts

export class WhatsAppNotificationService {
  /**
   * Invia push notification a cliente
   */
  async sendPushNotification(
    customerId: string,
    workspaceId: string,
    message: string,
    notificationType: "CHATBOT" | "OFFER" | "ORDER" | "PRODUCT"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Get customer data
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: { phone: true, workspaceId: true },
      })

      if (!customer || customer.workspaceId !== workspaceId) {
        return {
          success: false,
          error: "Customer not found or workspace mismatch",
        }
      }

      // 2. Converti messaggio → WhatsApp format
      const whatsappMessage = markdownToWhatsApp(message)

      // 3. Invia a WhatsApp
      const { success, error, messageId } = await sendToWhatsApp(
        customer.phone,
        whatsappMessage,
        workspaceId
      )

      // 4. Salva nello storico
      await prisma.messages.create({
        data: {
          workspaceId,
          customerId,
          phoneNumber: customer.phone,
          message: "",
          response: message,
          direction: "OUTBOUND",
          agentSelected: "SYSTEM",
          whatsappStatus: success ? "sent" : "failed",
          whatsappError: error || null,
          whatsappMessageId: messageId || null,
          metadata: {
            notificationType,
            timestamp: new Date().toISOString(),
          },
        },
      })

      return { success, error }
    } catch (error) {
      logger.error(
        `Push notification failed for customer ${customerId}:`,
        error
      )
      return { success: false, error: error.message }
    }
  }
}
```

### **Integrazione nei Controller**

**Esempio: CustomersController (Chatbot Toggle)**

```typescript
// backend/src/interfaces/http/controllers/customers.controller.ts

async toggleChatbot(req: Request, res: Response) {
  const { customerId } = req.params
  const { activeChatbot, shouldNotify } = req.body
  const workspaceId = (req as any).workspaceId

  // Update customer
  await prisma.customers.update({
    where: { id: customerId },
    data: { activeChatbot }
  })

  // 🆕 SEND PUSH NOTIFICATION
  if (shouldNotify) {
    const message = activeChatbot
      ? "✅ Chatbot attivato! Da ora risponderò automaticamente ai tuoi messaggi."
      : "⏸️ Chatbot disattivato. Un operatore ti risponderà presto."

    await whatsappNotificationService.sendPushNotification(
      customerId,
      workspaceId,
      message,
      'CHATBOT'
    )
  }

  return res.json({ success: true })
}
```

**Esempio: OffersController (Nuovo Sconto)**

```typescript
// backend/src/interfaces/http/controllers/offers.controller.ts

async createOffer(req: Request, res: Response) {
  const { title, discount, categoryId } = req.body
  const workspaceId = (req as any).workspaceId

  // Create offer
  const offer = await prisma.offers.create({
    data: { title, discount, categoryId, workspaceId }
  })

  // 🆕 SEND PUSH TO ALL CUSTOMERS INTERESTED IN THIS CATEGORY
  const customers = await prisma.customers.findMany({
    where: {
      workspaceId,
      activeChatbot: true // Solo clienti con chatbot attivo
    }
  })

  const message = `🎉 Nuovo sconto del ${discount}% su ${title}! Dai un'occhiata!`

  // Invia in background (non bloccare la response)
  Promise.all(
    customers.map(customer =>
      whatsappNotificationService.sendPushNotification(
        customer.id,
        workspaceId,
        message,
        'OFFER'
      )
    )
  ).catch(err => logger.error('Push notifications failed:', err))

  return res.json({ success: true, offer })
}
```

---

## 🗄️ DATABASE SCHEMA CHANGES

### **Messages Table Update**

```prisma
model Messages {
  id                String   @id @default(uuid())
  workspaceId       String
  customerId        String?
  phoneNumber       String
  message           String   @db.Text
  response          String?  @db.Text
  direction         String   // "INBOUND" | "OUTBOUND"
  agentSelected     String?  // "CHATBOT" | "OPERATOR" | "SYSTEM"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // 🆕 WHATSAPP STATUS TRACKING
  whatsappStatus    String?  // "sent" | "failed" | "pending" | "delivered" | "read"
  whatsappError     String?  @db.Text // Error message se fallito
  whatsappMessageId String?  // ID messaggio WhatsApp (per tracking)

  // 🆕 AUDIT TRAIL
  sentBy            String?  // userId dell'operatore (se OPERATOR)

  // 🆕 METADATA
  metadata          Json?    // Extra info (notificationType, etc.)

  workspace         Workspace @relation(fields: [workspaceId], references: [id])
  customer          Customers? @relation(fields: [customerId], references: [id])

  @@index([workspaceId])
  @@index([customerId])
  @@index([phoneNumber])
  @@index([whatsappStatus])
  @@index([createdAt])
  @@map("messages")
}
```

### **Migration SQL**

```sql
-- Add new columns to messages table
ALTER TABLE messages
ADD COLUMN "whatsappStatus" VARCHAR(50),
ADD COLUMN "whatsappError" TEXT,
ADD COLUMN "whatsappMessageId" VARCHAR(255),
ADD COLUMN "sentBy" VARCHAR(255),
ADD COLUMN "metadata" JSONB;

-- Create indexes for performance
CREATE INDEX idx_messages_whatsapp_status ON messages("whatsappStatus");
CREATE INDEX idx_messages_whatsapp_message_id ON messages("whatsappMessageId");
CREATE INDEX idx_messages_sent_by ON messages("sentBy");
```

---

## 🔄 CONVERSIONI MARKDOWN ↔ WHATSAPP

### **Markdown → WhatsApp Format**

````typescript
// backend/src/utils/whatsapp-formatter.ts

export function markdownToWhatsApp(text: string): string {
  let formatted = text

  // 1. Bold: **text** → *text*
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "*$1*")

  // 2. Italic: *text* → _text_
  formatted = formatted.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "_$1_")

  // 3. Strikethrough: ~~text~~ → ~text~
  formatted = formatted.replace(/~~([^~]+)~~/g, "~$1~")

  // 4. Code: `code` → ```code```
  formatted = formatted.replace(/`([^`]+)`/g, "```$1```")

  // 5. Links: [text](url) → text: url
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")

  // 6. Lists: - item → • item
  formatted = formatted.replace(/^[\s]*-[\s]+/gm, "• ")

  // 7. Headings: # Title → *Title*
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, "*$1*")

  // 8. Emoji conversions (already work in WhatsApp)
  // No need to convert, WhatsApp supports Unicode emoji

  return formatted.trim()
}
````

### **WhatsApp → Markdown Format**

````typescript
export function whatsAppToMarkdown(text: string): string {
  let formatted = text

  // 1. Bold: *text* → **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, "**$1**")

  // 2. Italic: _text_ → *text*
  formatted = formatted.replace(/_([^_]+)_/g, "*$1*")

  // 3. Strikethrough: ~text~ → ~~text~~
  formatted = formatted.replace(/~([^~]+)~/g, "~~$1~~")

  // 4. Code: ```code``` → `code`
  formatted = formatted.replace(/```([^`]+)```/g, "`$1`")

  // 5. Lists: • item → - item
  formatted = formatted.replace(/^[\s]*•[\s]+/gm, "- ")

  return formatted.trim()
}
````

### **Test Cases**

````typescript
describe("WhatsApp Formatter", () => {
  it("converts markdown to whatsapp format", () => {
    const input =
      "**Bold** *italic* ~~strike~~ `code` [link](https://example.com)"
    const output = markdownToWhatsApp(input)
    expect(output).toBe(
      "*Bold* _italic_ ~strike~ ```code``` link: https://example.com"
    )
  })

  it("converts whatsapp to markdown format", () => {
    const input = "*Bold* _italic_ ~strike~ ```code```"
    const output = whatsAppToMarkdown(input)
    expect(output).toBe("**Bold** *italic* ~~strike~~ `code`")
  })
})
````

---

## 🌐 WHATSAPP API INTEGRATION

### **Send Message Function**

```typescript
// backend/src/services/whatsapp-api.service.ts

interface WhatsAppSendResult {
  success: boolean
  error?: string
  messageId?: string
}

export async function sendToWhatsApp(
  phoneNumber: string,
  message: string,
  workspaceId: string
): Promise<WhatsAppSendResult> {
  try {
    // 1. Get workspace WhatsApp settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        whatsappApiKey: true,
        whatsappPhoneNumber: true,
      },
    })

    if (!workspace?.whatsappApiKey || !workspace?.whatsappPhoneNumber) {
      return {
        success: false,
        error: "WhatsApp not configured for this workspace",
      }
    }

    // 2. Prepare API request
    const apiUrl = `${process.env.WHATSAPP_API_URL}/${workspace.whatsappPhoneNumber}/messages`

    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber.replace("+", ""),
      type: "text",
      text: {
        body: message,
      },
    }

    // 3. Send to WhatsApp
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workspace.whatsappApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    // 4. Handle response
    if (!response.ok) {
      const errorData = await response.text()
      logger.error(`WhatsApp API error: ${response.status} ${errorData}`)
      return {
        success: false,
        error: `WhatsApp API error: ${response.status}`,
      }
    }

    const data = await response.json()
    const messageId = data.messages?.[0]?.id

    logger.info(`WhatsApp message sent: ${messageId}`)

    return {
      success: true,
      messageId,
    }
  } catch (error) {
    logger.error("Failed to send WhatsApp message:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}
```

### **Webhook Verification (Setup)**

```typescript
// GET /api/whatsapp/webhook (one-time verification)
app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified successfully")
    res.status(200).send(challenge)
  } else {
    res.status(403).send("Verification failed")
  }
})
```

---

## 🔐 ENVIRONMENT VARIABLES

### **.env Configuration**

```bash
# WhatsApp Business API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token_here_make_it_random
WHATSAPP_APP_SECRET=your_whatsapp_app_secret_from_facebook_dashboard

# Webhook Security
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_SIGNATURE_VERIFICATION=true

# Rate Limiting
WHATSAPP_MAX_MESSAGES_PER_MINUTE_WORKSPACE=100
WHATSAPP_MAX_MESSAGES_PER_MINUTE_CUSTOMER=10

# Retry Configuration
WHATSAPP_MAX_RETRY_ATTEMPTS=3
WHATSAPP_RETRY_DELAY_MS=1000
```

### **Workspace-Specific Settings (DB)**

```typescript
// Ogni workspace ha le sue credenziali WhatsApp
{
  whatsappApiKey: "EAABxxxxx...",         // Token del workspace
  whatsappPhoneNumber: "393491234567",    // Numero WhatsApp Business
  whatsappApiToken: "optional_extra"      // Se serve altro token
}
```

---

## 📊 MONITORING & ANALYTICS

### **Metriche da Tracciare**

1. **Messaggi Inbound**

   - Totale messaggi ricevuti/giorno
   - Tempo medio risposta LLM
   - Tasso successo invio risposta

2. **Messaggi Outbound**

   - Totale messaggi inviati operatore
   - Totale push notifications
   - Tasso delivery (sent vs failed)

3. **Errori**
   - Count errori per tipo
   - Workspace con più errori
   - Customer con problemi ricorrenti

### **Query Utili**

```sql
-- Messaggi falliti oggi
SELECT COUNT(*)
FROM messages
WHERE whatsappStatus = 'failed'
AND createdAt >= CURRENT_DATE;

-- Tasso successo per workspace
SELECT
  workspaceId,
  COUNT(*) as total,
  SUM(CASE WHEN whatsappStatus = 'sent' THEN 1 ELSE 0 END) as sent,
  (SUM(CASE WHEN whatsappStatus = 'sent' THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as success_rate
FROM messages
WHERE direction = 'OUTBOUND'
GROUP BY workspaceId;

-- Errori più comuni
SELECT
  whatsappError,
  COUNT(*) as occurrences
FROM messages
WHERE whatsappStatus = 'failed'
GROUP BY whatsappError
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 🧪 TESTING STRATEGY

### **Unit Tests**

```typescript
describe('WhatsApp Formatter', () => {
  test('markdownToWhatsApp', () => { ... })
  test('whatsAppToMarkdown', () => { ... })
})

describe('WhatsApp API Service', () => {
  test('sendToWhatsApp - success', async () => { ... })
  test('sendToWhatsApp - missing config', async () => { ... })
  test('sendToWhatsApp - API error', async () => { ... })
})
```

### **Integration Tests**

```typescript
describe("Webhook Inbound", () => {
  test("processes valid message", async () => {
    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", validSignature)
      .send(validWhatsAppPayload)

    expect(response.status).toBe(200)
    // Verify message saved in DB
    // Verify LLM was called
    // Verify response sent to WhatsApp
  })

  test("rejects invalid signature", async () => {
    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", "invalid")
      .send(validWhatsAppPayload)

    expect(response.status).toBe(403)
  })
})

describe("Send Message API", () => {
  test("sends message with valid session", async () => {
    const response = await request(app)
      .post("/api/whatsapp/send")
      .set("X-Session-Id", validSessionId)
      .send({
        workspaceId,
        customerId,
        phoneNumber,
        message: "Test message",
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

### **Manual Testing**

1. **Webhook Setup**

   ```bash
   # Use ngrok to expose local server
   ngrok http 3001

   # Configure webhook URL in Facebook/Meta dashboard
   https://xxxx.ngrok.io/api/whatsapp/webhook
   ```

2. **Send Test Message**
   ```bash
   curl -X POST http://localhost:3001/api/whatsapp/send \
     -H "X-Session-Id: your-session-id" \
     -H "Content-Type: application/json" \
     -d '{
       "workspaceId": "workspace-uuid",
       "customerId": "customer-uuid",
       "phoneNumber": "+393491234567",
       "message": "Test message 🎉"
     }'
   ```

---

## 📝 IMPLEMENTATION CHECKLIST

### **Phase 1: Core Infrastructure** ✅

- [ ] Create `whatsapp-api.service.ts` con `sendToWhatsApp()`
- [ ] Create `whatsapp-formatter.ts` con conversioni MD↔WA
- [ ] Add DB migration per nuovi campi (`whatsappStatus`, etc.)
- [ ] Update Prisma schema
- [ ] Add environment variables a `.env`

### **Phase 2: Webhook Inbound** ✅

- [ ] Create `POST /api/whatsapp/webhook` endpoint
- [ ] Implement signature verification
- [ ] Implement customer lookup via phone
- [ ] Integrate con `LLMService.handleMessage()`
- [ ] Save messages con whatsappStatus
- [ ] Add rate limiting middleware

### **Phase 3: Send Message API** ✅

- [ ] Create `POST /api/whatsapp/send` endpoint
- [ ] Implement session validation
- [ ] Implement workspace/customer validation
- [ ] Send to WhatsApp + save with status
- [ ] Add audit logging

### **Phase 4: Push Notifications** ✅

- [ ] Create `WhatsAppNotificationService`
- [ ] Integrate in `CustomersController.toggleChatbot()`
- [ ] Integrate in `OffersController.create()`
- [ ] Integrate in `OrdersController.updateStatus()`
- [ ] Add notification preferences per customer

### **Phase 5: Testing & Monitoring** ✅

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Setup ngrok for webhook testing
- [ ] Create monitoring dashboard
- [ ] Setup alerts for high error rates

### **Phase 6: Documentation** ✅

- [ ] API documentation (Swagger)
- [ ] Setup guide per WhatsApp Business
- [ ] Troubleshooting guide
- [ ] Rate limiting documentation

---

## 🚨 CRITICAL NOTES

### **Andrea's Requirements (MUST FOLLOW!)**

1. ✅ **Database-First**: Tutti i messaggi salvati con status tracking
2. ✅ **Session Security**: Sempre validare sessionId + workspaceId
3. ✅ **Workspace Isolation**: Query SEMPRE filtrate per workspaceId
4. ✅ **No Hardcoding**: Config WhatsApp dal DB (workspace settings)
5. ✅ **Error Tracking**: Campo `whatsappError` per debug
6. ✅ **Conversions**: Markdown ↔ WhatsApp format in entrambe direzioni
7. ✅ **Push Integration**: Intercettare PRIMA del salvataggio storico

### **Security Checklist**

- ✅ Verify WhatsApp signature (HMAC SHA256)
- ✅ Validate session on every send request
- ✅ Check workspace ownership
- ✅ Check customer ownership
- ✅ Rate limiting per workspace e customer
- ✅ Log audit trail (chi ha inviato cosa)
- ✅ Sanitize input messages (prevent injection)

### **Performance Considerations**

- ✅ Async push notifications (non bloccare API response)
- ✅ Retry logic per WhatsApp API failures
- ✅ Connection pooling per WhatsApp requests
- ✅ Cache workspace settings (avoid DB lookup ogni volta)
- ✅ Batch push notifications quando possibile

---

## 🎯 NEXT STEPS

1. **Implementare Phase 1** (Core Infrastructure)
2. **Testare conversioni** Markdown ↔ WhatsApp
3. **Setup WhatsApp Business Account** su Meta
4. **Configurare webhook** con ngrok per testing
5. **Implementare Webhook Inbound** (Phase 2)
6. **Testare end-to-end** con veri messaggi WhatsApp
7. **Implementare Send API** (Phase 3)
8. **Integrare Push Notifications** (Phase 4)
9. **Deploy in production** con monitoring

---

**Document Version**: 1.0  
**Last Updated**: 12 Ottobre 2025  
**Status**: 🔴 Ready for Implementation
