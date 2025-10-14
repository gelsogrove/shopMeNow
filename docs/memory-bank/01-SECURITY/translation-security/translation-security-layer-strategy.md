# Translation & Security Layer - Analisi e Strategia

**Data**: 13 Ottobre 2025  
**Branch**: `01-layer-security`  
**Autore**: Andrea + AI Assistant

---

## 🎯 Scopo del Documento

Questo documento analizza **quando, dove e perché** usare il **Translation & Security Layer** nel sistema ShopME, definendo una strategia chiara e centralizzata per proteggere gli utenti da contenuti inappropriati.

---

## 📋 Cos'è il Translation & Security Layer?

### Servizio: `TranslationSecurityService`

**File**: `/backend/src/services/translation-security.service.ts`

**Funzione principale**: `processResponse()`

### Cosa fa:

1. **🔒 Security Check**: Verifica che il contenuto non contenga spam, link malevoli, o contenuti inappropriati
2. **🌍 Translation**: Traduce la risposta nella lingua del cliente (se necessario)
3. **🔗 Link Validation**: Controlla che tutti i link siano nella whitelist autorizzata

### LLM utilizzato:

- **Model**: `openrouter/openai/gpt-4o-mini`
- **Temperature**: 0 (deterministica)
- **Costo**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens

### System Prompt del Security Layer:

```
You are a security and translation assistant. Your job is to:
1. Check if the response contains spam, scam, inappropriate content, or suspicious links
2. Translate the response to {targetLanguage} if needed (keep it natural)
3. Return ONLY the translated/checked text, nothing else

Rules:
- NEVER modify links or URLs
- NEVER add extra explanations
- If content is spam/scam/inappropriate: return "[BLOCKED]"
- Otherwise: return translated text
```

---

## 🔍 Situazione Attuale

### 1. **Dove viene usato ORA**

#### ✅ LLMService.handleMessage()

**File**: `/backend/src/services/llm.service.ts`  
**Linee**: 223-245

```typescript
try {
  const translationResult = await translationSecurityService.processResponse(
    finalResponse,
    userLanguage,
    allowedLinks
  )

  if (translationResult.blocked) {
    logger.warn("⚠️ SECURITY: Blocked inappropriate content", {
      customerId: customer.id,
      reason: translationResult.reason,
    })
  }

  finalResponse = translationResult.translatedText
} catch (error) {
  logger.error("❌ Translation & Security Layer failed", error)
  // Continue with original response if translation fails
}
```

**Quando si attiva**:

- ✅ Cliente invia messaggio WhatsApp
- ✅ LLM genera risposta
- ✅ **PRIMA** di inviare risposta al cliente

**Caratteristiche**:

- Si applica SOLO alle risposte dell'LLM (chatbot)
- Protegge da risposte inappropriate generate dall'AI
- Valida i link nella whitelist

---

### 2. **Dove NON viene usato**

#### ❌ Admin Manual Send

**File**: `/backend/src/interfaces/http/controllers/whatsapp-send.controller.ts`

**Cosa succede**:

```typescript
async sendMessage(req: Request, res: Response) {
  // ... validazioni security ...

  // 🔄 Convert Markdown → WhatsApp format
  const whatsappMessage = markdownToWhatsApp(message)

  // 📤 Send to WhatsApp - NO SECURITY LAYER!
  const { success, error, messageId } = await sendToWhatsApp(
    phoneNumber,
    whatsappMessage,
    workspaceId
  )
}
```

**Problema**:

- ❌ Admin può inviare qualsiasi contenuto senza controllo
- ❌ Admin potrebbe accidentalmente inviare link non validi
- ❌ Nessuna traduzione automatica

**Ragionamento di Andrea**:

> "Di certo quando un utente admin scrive non abbiamo bisogno di fare il translation server"

**Risposta**: ✅ **CORRETTO!** L'admin è una persona fidata, non serve security check.

---

#### ❌ Campaign Scheduler

**File**: `/backend/src/services/campaign-scheduler.service.ts`

**Cosa succede**:

```typescript
private async sendCampaignMessage(campaign: any, customer: any) {
  // ... validazioni security workspaceId, phone, etc ...

  // Replace tokens in message
  const { message: processedMessage } = await this.tokenService.replaceTokens(
    campaign.messagePreview,
    customer.id,
    campaign.workspaceId,
    campaign.id
  )

  // 📤 Send WhatsApp - NO SECURITY LAYER!
  const sendResult = await sendToWhatsApp(
    validCustomer.phone,
    processedMessage,
    campaign.workspaceId
  )
}
```

**Problema**:

- ❌ Campagne create da admin vengono inviate senza security check
- ❌ Token replacement potrebbe generare contenuti imprevisti
- ❌ Nessun controllo su link malevoli nelle campagne

**Domanda di Andrea**:

> "Forse dobbiamo metterlo quando l'utente ha isChatbot false?"

---

## 🤔 Analisi dei Rischi

### Scenario 1: LLM genera contenuto inappropriato

**Probabilità**: 🟡 MEDIA-BASSA

- **Perché**: Claude-3.5-Haiku è ben allenato, temperature=0
- **Ma**: Prompt injection è sempre possibile
- **Esempio**: Cliente chiede "scrivi una email di phishing"

**Mitigation attuale**: ✅ Translation & Security Layer ATTIVO

**Rischio**: 🟢 BASSO (protetto)

---

### Scenario 2: Admin invia contenuto per errore

**Probabilità**: 🟡 MEDIA

- **Perché**: Admin è umano, può fare errori
- **Esempio**: Copia/incolla link sbagliato, typo in URL
- **Impatto**: Cliente riceve messaggio con errore o link rotto

**Mitigation attuale**: ❌ NESSUNA

**Rischio**: 🟡 MEDIO (non protetto)

**Soluzione**:

- ✅ **NON serve security check** (admin è fidato)
- ⚠️ **Serve link validation** (controllo sintassi URL, no spam check)
- ✅ **Traduzione opzionale** (solo se admin lo richiede)

---

### Scenario 3: Campagna con token replacement genera contenuto imprevisto

**Probabilità**: 🔴 ALTA

- **Perché**: Token `{{nome}}`, `{{email}}` provengono da database
- **Esempio**: Cliente ha nome ""; DROP TABLE customers;--"
- **Esempio 2**: Campo email contiene link di phishing
- **Impatto**: Messaggio malevolo inviato a tutti i clienti

**Mitigation attuale**: ❌ NESSUNA

**Rischio**: 🔴 ALTO (SQL injection, XSS, phishing)

**Soluzione**:

- 🚨 **CRITICO**: Security check OBBLIGATORIO prima di invio
- ✅ Validazione link nella campagna
- ✅ Escape dei token da database (già fatto da Prisma)

---

### Scenario 4: Scheduler chiama LLMService (chatbot)

**Probabilità**: 🟢 BASSA (non implementato ancora)

- **Perché**: Futuro sistema di follow-up automatico via chatbot
- **Esempio**: "Reminder automatico ordine non pagato" con risposta AI

**Mitigation attuale**: ✅ Se usa LLMService → Security layer già attivo

**Rischio**: 🟢 BASSO (già protetto se implementato correttamente)

---

## ✅ Strategia Definitiva

### Regola Generale:

> **"Translation & Security Layer deve essere usato SOLO quando il contenuto è generato o processato da AI/sistemi automatici che manipolano dati utente"**

---

### Matrice Decisionale:

| Scenario                          | LLM? | Token DB? | Security Layer | Perché                                    |
| --------------------------------- | ---- | --------- | -------------- | ----------------------------------------- |
| **LLM risponde a cliente**        | ✅   | ❌        | ✅ SI          | AI può generare contenuto inappropriato   |
| **Admin invia messaggio manuale** | ❌   | ❌        | ❌ NO          | Admin è fidato (+ validation opzionale)   |
| **Campagna con token**            | ❌   | ✅        | ✅ SI          | Token DB possono contenere dati malevoli  |
| **Scheduler + LLM**               | ✅   | ✅        | ✅ SI          | AI + DB = doppio rischio                  |
| **Notifica sistema (no AI)**      | ❌   | ❌        | ❌ NO          | Messaggio hardcoded, nessun input esterno |

---

## 🏗️ Implementazione Centralizzata

### Nuovo Service: `MessageSendingService`

**File**: `/backend/src/services/message-sending.service.ts` (DA CREARE)

**Responsabilità**:

1. Centralizzare TUTTI gli invii di messaggi WhatsApp
2. Applicare security layer solo quando necessario
3. Log uniforme e audit trail
4. Gestione errori centralizzata

### Signature:

```typescript
interface SendMessageOptions {
  phoneNumber: string
  message: string
  workspaceId: string
  customerId?: string
  sendType: "CHATBOT" | "ADMIN_MANUAL" | "CAMPAIGN" | "SCHEDULER"
  skipSecurityLayer?: boolean // Default: false
  metadata?: any
}

class MessageSendingService {
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    // 1. Determine if security layer needed
    const needsSecurity = this.needsSecurityCheck(options.sendType)

    let finalMessage = options.message

    // 2. Apply security layer if needed
    if (needsSecurity && !options.skipSecurityLayer) {
      const securityResult = await translationSecurityService.processResponse(
        options.message,
        this.detectLanguage(options.customerId), // Auto-detect or get from customer
        this.getAllowedLinks(options.workspaceId)
      )

      if (securityResult.blocked) {
        logger.warn("🚨 Security layer blocked message", {
          sendType: options.sendType,
          reason: securityResult.reason,
        })
        throw new Error(`Message blocked: ${securityResult.reason}`)
      }

      finalMessage = securityResult.translatedText
    }

    // 3. Send via WhatsApp
    const result = await sendToWhatsApp(
      options.phoneNumber,
      finalMessage,
      options.workspaceId
    )

    // 4. Save to database with audit trail
    await this.saveMessage({
      ...options,
      finalMessage,
      whatsappResult: result,
    })

    return result
  }

  private needsSecurityCheck(sendType: string): boolean {
    switch (sendType) {
      case "CHATBOT":
        return true // LLM-generated content
      case "CAMPAIGN":
        return true // Token replacement from DB
      case "SCHEDULER":
        return true // Automated content
      case "ADMIN_MANUAL":
        return false // Trusted admin
      default:
        return true // Safe default: check everything
    }
  }
}
```

---

## 🔄 Refactoring Plan

### Step 1: Creare `MessageSendingService`

- [ ] Implementare service con security logic
- [ ] Unit test per ogni `sendType`
- [ ] Integration test con mock WhatsApp API

### Step 2: Aggiornare LLMService

```typescript
// PRIMA
const { success } = await sendToWhatsApp(phone, finalResponse, workspaceId)

// DOPO
const result = await messageSendingService.sendMessage({
  phoneNumber: phone,
  message: llmResponse,
  workspaceId,
  customerId: customer.id,
  sendType: "CHATBOT",
  metadata: { llmTokens: tokenUsage },
})
```

### Step 3: Aggiornare WhatsAppSendController

```typescript
// PRIMA (admin manual send)
await sendToWhatsApp(phoneNumber, whatsappMessage, workspaceId)

// DOPO
await messageSendingService.sendMessage({
  phoneNumber,
  message: whatsappMessage,
  workspaceId,
  customerId,
  sendType: "ADMIN_MANUAL",
  skipSecurityLayer: true, // Admin è fidato
  metadata: { sentBy: session.userId },
})
```

### Step 4: Aggiornare CampaignScheduler

```typescript
// PRIMA
await sendToWhatsApp(
  validCustomer.phone,
  processedMessage,
  campaign.workspaceId
)

// DOPO
await messageSendingService.sendMessage({
  phoneNumber: validCustomer.phone,
  message: processedMessage,
  workspaceId: campaign.workspaceId,
  customerId: customer.id,
  sendType: "CAMPAIGN",
  // Security layer ATTIVO per token replacement
  metadata: { campaignId: campaign.id, tokensUsed },
})
```

---

## 📊 Costi del Security Layer

### Scenario Realistico:

- **100 messaggi/giorno** da chatbot
- **Media 200 token** per messaggio (input + output)
- **20,000 token/giorno** = 0.02M token/giorno

**Costo**:

- Input: 0.02M × $0.15 = **$0.003/giorno** = **$0.09/mese**
- Output: 0.02M × $0.60 = **$0.012/giorno** = **$0.36/mese**

**Totale**: ~**$0.45/mese** per 100 messaggi/giorno

### Conclusione:

🟢 **COSTO TRASCURABILE** - vale assolutamente la pena per la sicurezza

---

## ⚠️ Quando NON usare il Security Layer

### 1. **Admin Manual Send**

**Perché NO**:

- ✅ Admin è una persona fidata del workspace
- ✅ Admin ha già autenticazione JWT
- ✅ Admin è responsabile del contenuto che invia
- ❌ Security layer rallenterebbe UX dell'admin

**Alternative**:

- ✅ Link syntax validation (check URL format)
- ✅ Preview del messaggio prima di inviare
- ✅ Conferma per link esterni al workspace

---

### 2. **Notifiche di Sistema Hardcoded**

**Esempio**:

```typescript
const systemMessage = "Il tuo ordine #12345 è stato confermato"
```

**Perché NO**:

- ✅ Contenuto predefinito, nessun input esterno
- ✅ Nessuna manipolazione di dati utente
- ✅ Template sicuro e testato

---

### 3. **Messaggi già verificati in cache**

**Scenario**: Messaggio identico inviato a 1000 clienti (broadcast)

**Ottimizzazione**:

```typescript
// Check security ONCE
const secureMessage = await securityLayer.processResponse(message)

// Send to 1000 customers WITHOUT re-checking
for (const customer of customers) {
  await sendToWhatsApp(customer.phone, secureMessage, workspaceId)
}
```

---

## 🎯 Conclusioni e Raccomandazioni

### ✅ Strategia Finale:

1. **Creare `MessageSendingService` centralizzato**

   - Single point of control per TUTTI gli invii
   - Security layer applicato automaticamente dove serve
   - Log e audit trail unificati

2. **Security Layer OBBLIGATORIO per**:

   - ✅ Risposte chatbot (LLM)
   - ✅ Campagne con token replacement
   - ✅ Scheduler automatico
   - ✅ Qualsiasi contenuto generato/processato da AI

3. **Security Layer OPZIONALE per**:

   - ❌ Admin manual send (skip con flag)
   - ❌ Notifiche sistema hardcoded
   - ❌ Messaggi già verificati (cache)

4. **Validation sempre necessaria**:
   - ✅ WorkspaceId matching
   - ✅ Customer phone verification
   - ✅ Link syntax check (anche per admin)

---

### 🚀 Next Steps:

1. **Implementare `MessageSendingService`** (Priority: HIGH)
2. **Refactoring LLMService** → usa nuovo service
3. **Refactoring CampaignScheduler** → usa nuovo service
4. **Unit test completi** per ogni scenario
5. **Integration test** con WhatsApp mock
6. **Update documentazione** PRD.md

---

### 📝 Note Finali:

> **Andrea aveva ragione**: Non serve security check per admin manual send. Ma serve una **strategia centralizzata** per gestire tutti i casi in modo uniforme.

> **Dubbio risolto**: Il security layer serve SEMPRE per contenuti generati da AI o processati con dati da database (token replacement). Per admin è opzionale ma consigliamo link validation.

---

**Documento creato**: 13 Ottobre 2025  
**Review**: Andrea + AI Assistant  
**Status**: ✅ APPROVED - Ready for implementation
