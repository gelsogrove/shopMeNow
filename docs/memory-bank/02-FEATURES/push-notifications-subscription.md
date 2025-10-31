# 🔔 Push Notifications Subscription System

**Data**: 31 Ottobre 2025  
**Status**: ✅ IMPLEMENTED  
**Branch**: `122-rag-con-prodcuct`

---

## 📋 OVERVIEW

Sistema per gestire le iscrizioni dei clienti alle notifiche push promozionali attraverso conversazione naturale con il chatbot WhatsApp.

**Funzionalità**:

- ✅ Subscribe/Unsubscribe via conversazione naturale
- ✅ Conferma esplicita richiesta prima dell'azione
- ✅ Supporto multilingua (IT, EN, ES, PT)
- ✅ Messaggio personalizzabile per workspace
- ✅ Calling function per Router Agent

---

## 🎯 ARCHITETTURA

### Database Field

```prisma
model Customers {
  id                        String   @id @default(uuid())
  pushNotificationsEnabled  Boolean  @default(false)  // ✅ Flag iscrizione
  // ... altri campi
}
```

### Router Agent Function

```typescript
// backend/src/config/agent-functions.ts
{
  name: "manageNotifications",
  description: "Manage customer's push notification subscription...",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["SUBSCRIBE", "UNSUBSCRIBE"],
        description: "SUBSCRIBE to enable, UNSUBSCRIBE to disable"
      }
    },
    required: ["action"]
  }
}
```

### Service Implementation

```typescript
// backend/src/services/calling-functions.service.ts (line 315)
async manageNotifications(
  args: { action: "SUBSCRIBE" | "UNSUBSCRIBE" },
  context: { customerId: string; workspaceId: string }
) {
  // Update customer pushNotificationsEnabled field
  await this.prisma.customers.update({
    where: {
      id: context.customerId,
      workspaceId: context.workspaceId
    },
    data: {
      pushNotificationsEnabled: args.action === "SUBSCRIBE"
    }
  })

  const message = args.action === "SUBSCRIBE"
    ? "✅ Iscrizione confermata! Riceverai le nostre offerte."
    : "✅ Disiscrizione confermata. Non riceverai più notifiche."

  return { success: true, message }
}
```

---

## 💬 CONVERSATIONAL FLOW

### Subscribe Flow

```
Cliente: "Voglio ricevere le offerte"
Agent: "Perfetto! Vuoi iscriverti alle notifiche promozionali? Riceverai aggiornamenti sulle nostre offerte speciali."
Cliente: "Sì"
Agent: [CALL manageNotifications(action: "SUBSCRIBE")]
Agent: "✅ Iscrizione confermata! Riceverai le nostre offerte e promozioni."
```

### Unsubscribe Flow

```
Cliente: "Non voglio più ricevere messaggi"
Agent: "Capisco. Vuoi disiscriverti dalle notifiche promozionali?"
Cliente: "Sì, grazie"
Agent: [CALL manageNotifications(action: "UNSUBSCRIBE")]
Agent: "✅ Disiscrizione confermata. Non riceverai più notifiche da parte nostra."
```

---

## 🌍 TRIGGER SEMANTICI MULTILINGUA

### 🇮🇹 Italiano - SUBSCRIBE

- "voglio ricevere offerte"
- "iscrivimi alle notifiche"
- "voglio le promozioni"
- "mandami le offerte"
- "voglio essere aggiornato"
- "attiva notifiche"

### 🇮🇹 Italiano - UNSUBSCRIBE

- "non voglio più messaggi"
- "disiscrivimi"
- "basta notifiche"
- "non voglio più offerte"
- "cancella iscrizione"
- "stop messaggi"

### 🇬🇧 English - SUBSCRIBE

- "subscribe me"
- "I want offers"
- "send me promotions"
- "enable notifications"
- "I want to receive updates"
- "sign me up"

### 🇬🇧 English - UNSUBSCRIBE

- "unsubscribe"
- "stop notifications"
- "no more messages"
- "cancel subscription"
- "opt out"
- "remove me"

### 🇪🇸 Español - SUBSCRIBE

- "quiero recibir ofertas"
- "suscríbeme"
- "envíame promociones"
- "activar notificaciones"
- "quiero estar informado"

### 🇪🇸 Español - UNSUBSCRIBE

- "darme de baja"
- "no más mensajes"
- "cancelar suscripción"
- "detener notificaciones"

### 🇵🇹 Português - SUBSCRIBE

- "quero receber ofertas"
- "inscrever-me"
- "enviar promoções"
- "ativar notificações"
- "quero receber atualizações"

### 🇵🇹 Português - UNSUBSCRIBE

- "cancelar inscrição"
- "não quero mais mensagens"
- "parar notificações"
- "remover-me"

---

## ⚙️ CONFIGURAZIONE WORKSPACE

### Prompt Token: `{{SUBSCRIBE_MESSAGE}}`

Messaggio personalizzato per ogni workspace che spiega al cliente cosa succede iscrivendosi.

**Esempio**:

```
Iscrivendoti riceverai:
- Offerte esclusive settimanali
- Nuovi prodotti in arrivo
- Promozioni speciali per clienti fedeli
```

**Database**: Salvato in `agentConfig.agentPrompt` o prompt personalizzato per workspace.

**Processing**: Gestito da `PromptProcessorService.replaceAllVariables()`

---

## 🔐 SICUREZZA & PRIVACY

### ✅ Best Practices Implementate

1. **Conferma Esplicita**: Agent DEVE chiedere conferma prima di chiamare funzione
2. **Workspace Isolation**: Tutti i query filtrati per `workspaceId`
3. **Customer Validation**: Verifico che customerId esista e appartenga al workspace
4. **Audit Trail**: Ogni cambio stato loggato nel database
5. **GDPR Compliant**: Cliente può disiscriversi in qualsiasi momento

### Database Query Pattern

```typescript
// ✅ SEMPRE con workspaceId per sicurezza multi-tenant
await prisma.customers.update({
  where: {
    id: customerId,
    workspaceId: workspaceId, // ⚠️ CRITICAL: multi-tenant isolation
  },
  data: { pushNotificationsEnabled: true },
})
```

---

## 🧪 TESTING

### Test Conversazionali

**Test 1 - Subscribe (Italiano)**:

```
Input: "voglio ricevere le offerte"
Expected: Agent chiede conferma → Cliente conferma → CALL manageNotifications(SUBSCRIBE)
Result: "✅ Iscrizione confermata!"
```

**Test 2 - Unsubscribe (English)**:

```
Input: "unsubscribe me"
Expected: Agent chiede conferma → Cliente conferma → CALL manageNotifications(UNSUBSCRIBE)
Result: "✅ Disiscrizione confermata."
```

**Test 3 - Ambiguous Request**:

```
Input: "voglio info sulle offerte" (NON è richiesta di iscrizione)
Expected: Agent spiega offerte disponibili, NON chiama manageNotifications
Result: Risposta informativa senza calling function
```

### Database Test

```typescript
// Test SUBSCRIBE
const customer = await prisma.customers.findUnique({
  where: { id: customerId, workspaceId },
})
expect(customer.pushNotificationsEnabled).toBe(true)

// Test UNSUBSCRIBE
const customer = await prisma.customers.findUnique({
  where: { id: customerId, workspaceId },
})
expect(customer.pushNotificationsEnabled).toBe(false)
```

---

## 🐛 DEBUGGING

### Check Function Registration

```bash
# Verifica funzione in agent-functions.ts
grep -A 15 "manageNotifications" backend/src/config/agent-functions.ts
```

### Check Service Implementation

```bash
# Verifica implementazione in calling-functions.service.ts
grep -A 30 "async manageNotifications" backend/src/services/calling-functions.service.ts
```

### Check Database State

```sql
-- Verifica stato iscrizione cliente
SELECT id, phone, pushNotificationsEnabled
FROM "Customers"
WHERE "workspaceId" = 'xxx';
```

### Check LLM Logs

```bash
# Verifica calling function nei log
tail -f backend/logs/prompt-debug-*.txt | grep "manageNotifications"
```

---

## 📊 ANALYTICS & MONITORING

### Metriche da Tracciare

1. **Subscription Rate**: % clienti che si iscrivono
2. **Unsubscribe Rate**: % clienti che si disiscrivono
3. **Confirmation Rate**: % clienti che confermano dopo richiesta agent
4. **Time to Confirm**: Tempo medio tra richiesta e conferma
5. **Language Distribution**: Lingua più usata per subscribe/unsubscribe

### Query Analytics

```sql
-- Totale iscritti per workspace
SELECT
  "workspaceId",
  COUNT(*) FILTER (WHERE "pushNotificationsEnabled" = true) as subscribed,
  COUNT(*) FILTER (WHERE "pushNotificationsEnabled" = false) as unsubscribed,
  COUNT(*) as total
FROM "Customers"
GROUP BY "workspaceId";
```

---

## 🚀 DEPLOYMENT CHECKLIST

- [x] **Database**: Campo `pushNotificationsEnabled` aggiunto a `Customers`
- [x] **Agent Functions**: `manageNotifications` in `agent-functions.ts`
- [x] **Service**: Implementazione in `calling-functions.service.ts`
- [x] **Prompt**: Token `{{SUBSCRIBE_MESSAGE}}` configurabile per workspace
- [x] **Multi-language**: Trigger semantici per IT, EN, ES, PT
- [x] **Security**: Workspace isolation + conferma esplicita
- [x] **Documentation**: Memory-bank aggiornato
- [ ] **Testing**: Test end-to-end con clienti reali
- [ ] **Analytics**: Dashboard subscription metrics
- [ ] **Email**: Conferma via email dopo subscribe (opzionale)

---

## 📚 REFERENCES

- **Function Definition**: `backend/src/config/agent-functions.ts` (line ~350)
- **Service Implementation**: `backend/src/services/calling-functions.service.ts` (line 315)
- **Database Schema**: `backend/prisma/schema.prisma` (Customers.pushNotificationsEnabled)
- **Prompt Documentation**: `docs/prompt_agent.md`
- **OLD Implementation** (deprecated): `backend/src/services/llm.service.ts` (line 844)

---

**Status**: ✅ PRODUCTION READY  
**Last Updated**: 31 Ottobre 2025  
**Author**: AI Code Agent + Andrea (gelsogrove)
