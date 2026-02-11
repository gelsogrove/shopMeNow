# 🌍 Widget Language Flow Test

## Problema Identificato

Il widget NON risponde nella lingua selezionata dall'utente nella home.

## Flusso Attuale (ANALISI)

### 1. WidgetLoader.tsx (Frontend)
```typescript
// ✅ CORRETTO: Passa language dal LanguageContext
window.eChatbotConfig = {
  workspaceId: config.workspaceId,
  apiUrl: apiBaseUrl,
  title: config.title,
  language: config.language || language, // ← Usa lingua da header dropdown test
  primaryColor: config.primaryColor,
}
```

### 2. Widget Chat Controller (Backend)
```typescript
// ✅ CORRETTO: Riceve language dal body
const { visitorId, message, sessionId, language, phoneNumber } = validation.data

// ✅ CORRETTO: Normalizza lingua
const explicitLanguage = this.normalizeLanguage(language) // "it" → "ITA"

// ✅ CORRETTO: Priorità lingue
const requestedLanguage = explicitLanguage || detectedLanguageFromPhone || normalizedBrowserLang

// ✅ CORRETTO: Salva customer con lingua corretta
customer = await prisma.customers.create({
  data: {
    language: requestedLanguage || workspace.defaultLanguage || workspace.language || "ENG",
  },
})

// ✅ CORRETTO: Passa a LLM Router
const llmResult = await llmRouterService.routeMessage({
  customerLanguage, // ← customer.language (già salvato)
})
```

### 3. LLM Router Service
```typescript
// ✅ CORRETTO: Passa a TranslationAgent
const translationResult = await this.translationAgent.process({
  workspaceId: params.workspaceId,
  message: messageForTranslation,
  targetLanguage: params.customerLanguage || "it", // ← Dovrebbe essere corretto
  customerName: params.customerName,
})
```

### 4. TranslationAgent.ts
```typescript
// 🔍 DEBUG LOG PRESENTE:
logger.info(`🌍 [TranslationAgent] RECEIVED targetLanguage parameter`, {
  targetLanguage: options.targetLanguage, // ← Verifica questo log
})

// ✅ CORRETTO: Normalizza lingua
const normalizedLanguage = this.normalizeLanguage(options.targetLanguage)

// ✅ CORRETTO: Mapping completo
const mapping: Record<string, string> = {
  it: "it",
  ita: "it", // ✅ Gestisce ITA
  en: "en",
  eng: "en",
  es: "es",
  esp: "es",
  pt: "pt",
  prt: "pt",
}
```

## 🔍 Test da Eseguire

### Test 1: Verifica Widget Config
```javascript
// Nel browser console (homepage):
console.log(window.eChatbotConfig)
// Deve mostrare: { language: "es" } (se hai selezionato spagnolo)
```

### Test 2: Verifica API Request
```bash
# Network tab → POST /api/v1/widget/chat/:workspaceId
# Body deve contenere:
{
  "visitorId": "visitor_xxx",
  "message": "ciao",
  "language": "es" // ← Deve essere presente!
}
```

### Test 3: Verifica Backend Logs
```bash
# Cerca nei log backend:
grep "🌍 [TranslationAgent] RECEIVED targetLanguage" logs.txt

# Deve mostrare:
# targetLanguage: "es" (o "ESP" se normalizzato)
```

### Test 4: Verifica Customer Language
```sql
-- Controlla lingua salvata nel database
SELECT id, name, language FROM "Customers" 
WHERE "customId" LIKE 'visitor_%' 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Deve mostrare language = "ESP" (o "ITA", "ENG", etc.)
```

## 🐛 Possibili Cause

### Causa 1: Widget non passa language nel body
**Sintomo**: API request non contiene campo `language`
**Fix**: Verificare che ChatWidget.tsx includa language nel POST body

### Causa 2: Normalizzazione sbagliata
**Sintomo**: Log mostra `targetLanguage: undefined` o `targetLanguage: "it"` (sempre italiano)
**Fix**: Verificare normalizeLanguage() in widget-chat.controller.ts

### Causa 3: Customer language non aggiornato
**Sintomo**: Customer esistente ha language="ITA" ma widget invia "es"
**Fix**: Aggiungere update customer language se cambia

### Causa 4: TranslationAgent ignora targetLanguage
**Sintomo**: Log mostra targetLanguage corretto ma risposta sempre in italiano
**Fix**: Verificare buildTranslationOnlyPrompt() in shared/translation-prompts.ts

## ✅ Fix Proposto

### Se il problema è nel Widget (ChatWidget.tsx):
```typescript
// Assicurati che language sia incluso nel body
const response = await fetch(`${apiUrl}/widget/chat/${workspaceId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitorId,
    message,
    sessionId,
    language: window.eChatbotConfig?.language || 'it', // ← CRITICAL
  }),
})
```

### Se il problema è nel Controller:
```typescript
// widget-chat.controller.ts - Aggiorna customer language se cambia
if (requestedLanguage && requestedLanguage !== customer.language) {
  await prisma.customers.update({
    where: { id: customer.id },
    data: { language: requestedLanguage },
  })
  customer.language = requestedLanguage // ← Update in-memory
  logger.info("🌍 Widget language changed - updating customer", {
    customerId: customer.id,
    oldLanguage: customer.language,
    newLanguage: requestedLanguage,
  })
}
```

## 📊 Risultato Atteso

1. Utente seleziona **Español** nella home
2. Widget config: `{ language: "es" }`
3. API request: `{ language: "es" }`
4. Backend normalizza: `"es" → "ESP"`
5. Customer salvato: `language: "ESP"`
6. LLM Router: `customerLanguage: "ESP"`
7. TranslationAgent: `targetLanguage: "ESP"`
8. Risposta finale: **100% in spagnolo**

## 🔧 Prossimi Passi

1. ✅ Eseguire Test 1-4 per identificare dove si perde la lingua
2. ✅ Applicare fix appropriato basato sui risultati
3. ✅ Testare con tutte le lingue (IT, EN, ES, PT)
4. ✅ Verificare che customer language si aggiorni se utente cambia lingua
