# Translation & Security Layer - Summary

## 🎯 Domanda di Andrea

> "Dubito che LLM mi ritorni qualcosa di strano o spam... forse non lo abbiamo messo nel punto giusto? Forse dobbiamo metterlo quando l'utente ha isChatbot false? Oppure sempre quando inviamo un messaggio? E lo scheduler?"

---

## ✅ Risposta Breve

**Il security layer VA BENE dove l'abbiamo messo (LLM responses)**, MA dobbiamo **centralizzare** la logica e applicarlo anche in altri punti critici.

---

## 📍 Dove è ORA

✅ **LLMService.handleMessage()** - Quando chatbot risponde al cliente

---

## 🔴 Dove MANCA (e serve!)

### 1. **Campaign Scheduler** - 🚨 CRITICO

**Perché serve**:

- Campagne usano token `{{nome}}`, `{{email}}` dal database
- Cliente potrebbe avere dati malevoli nel DB
- Esempio: nome = `"; DROP TABLE--"` o email con link phishing
- **Una campagna può mandare 1000 messaggi** → alto impatto!

**Soluzione**: ✅ Applicare security layer PRIMA di inviare campagna

---

### 2. **Scheduler che chiama LLM**

**Scenario futuro**: Reminder automatici con risposta AI

**Soluzione**: ✅ Se usa LLMService → già protetto

---

## 🟢 Dove NON serve

### ❌ Admin Manual Send

**Perché NO**:

- Admin è persona fidata
- Ha già autenticazione JWT
- Rallenta UX dell'admin

**Alternative**: Link validation (check sintassi URL), ma NO spam check

---

## 💡 Soluzione: Centralizzare tutto!

### Creare `MessageSendingService`

**Unico punto** per TUTTI gli invii WhatsApp:

```typescript
await messageSendingService.sendMessage({
  phoneNumber: phone,
  message: text,
  workspaceId: workspace,
  sendType: "CHATBOT" | "ADMIN_MANUAL" | "CAMPAIGN" | "SCHEDULER",
  skipSecurityLayer: boolean, // Default: false
})
```

**Logic interna**:

```typescript
needsSecurityCheck(sendType) {
  switch(sendType) {
    case 'CHATBOT': return true    // LLM può sbagliare
    case 'CAMPAIGN': return true   // Token DB possono essere malevoli
    case 'SCHEDULER': return true  // Automatico = serve check
    case 'ADMIN_MANUAL': return false // Admin è fidato
  }
}
```

---

## 🎯 Matrice Decisionale Finale

| Scenario           | Security Layer | Perché                                  |
| ------------------ | -------------- | --------------------------------------- |
| Chatbot (LLM)      | ✅ SI          | AI può generare contenuto inappropriato |
| Admin manuale      | ❌ NO          | Admin è fidato (solo link validation)   |
| Campagna con token | ✅ SI          | Dati DB possono essere malevoli         |
| Scheduler + LLM    | ✅ SI          | AI + automation = serve protezione      |
| Notifica hardcoded | ❌ NO          | Template sicuro, nessun input esterno   |

---

## 💰 Costi

**100 messaggi/giorno** con security check:

- Input: $0.003/giorno
- Output: $0.012/giorno
- **Totale: ~$0.45/mese**

🟢 **TRASCURABILE** - vale la pena per la sicurezza!

---

## 🚀 Next Steps

1. ✅ Creare `MessageSendingService` centralizzato
2. ✅ Refactoring LLMService → usa nuovo service
3. ✅ Refactoring CampaignScheduler → usa nuovo service (IMPORTANTE!)
4. ✅ Unit test per ogni `sendType`
5. ✅ Update documentazione

---

## 📝 Conclusione

> **Andrea, avevi ragione**: Admin manual send NON serve security check.

> **MA**: Campagne e scheduler SI, perché usano dati dal database che possono essere compromessi.

> **Soluzione migliore**: Service centralizzato che decide automaticamente quando applicare security layer.

---

**Documento completo**: `docs/translation-security-layer-strategy.md`
