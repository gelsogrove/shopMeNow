## 🎯 TASK COMPLETATO: Debug Logs Widget Language

Andrea, ho aggiunto logging completo per tracciare il problema della lingua nel widget.

---

## ✅ FILE MODIFICATI

### 1. `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`

**Modifiche**:
- ✅ Log completo degli HTTP headers (incluso `Accept-Language`)
- ✅ Log del processo di rilevamento lingua (5 livelli di fallback)
- ✅ Log dell'aggiornamento customer language nel database
- ✅ Log del parametro `customerLanguage` passato all'LLM

**Log chiave da cercare**:
```
🌍 [WIDGET_DEBUG] HTTP Headers Received
🌍 [WIDGET_DEBUG] Language Detection Complete
🌍 [WIDGET_DEBUG] Calling LLMRouterService
```

### 2. `apps/backend/src/application/agents/TranslationAgent.ts`

**Modifiche**:
- ✅ Log input completo (targetLanguage ricevuto)
- ✅ Log normalizzazione lingua (ITA → it, ENG → en)
- ✅ Log risultato traduzione (confronto prima/dopo)
- ✅ Log se force-translation è stato necessario

**Log chiave da cercare**:
```
🌍 [TRANSLATION_DEBUG] Input Analysis
🌍 [TRANSLATION_DEBUG] Language Normalization
🌍 [TRANSLATION_DEBUG] Translation Complete
```

---

## 🧪 COME TESTARE (Per Andrea)

### Test 1: Apri Widget e Scrivi Messaggio

1. **Apri browser** con Developer Tools (F12)
2. **Vai alla pagina** con il widget
3. **Apri il widget** (pulsante chat)
4. **Scrivi un messaggio**: "hello" o "ciao"
5. **Aspetta la risposta**

### Test 2: Controlla Backend Logs

Nel terminal del backend, cerca questi log nell'ordine:

```
Step 1: Ricezione messaggio
--------------------------
🌍 [WIDGET_DEBUG] HTTP Headers Received {
  'accept-language': '???',  // ⬅️ Controlla questo valore!
  ...
}

Step 2: Rilevamento lingua
--------------------------
🌍 [WIDGET_DEBUG] Language Detection Complete {
  bodyLanguage: '???',              // Da widget config
  acceptLanguageHeader: '???',      // Da browser
  browserDetected: '???',           // Rilevato da header
  customerLanguageInDB: '???',      // Salvato nel DB
  workspaceDefaultLanguage: 'ITA', // Default workspace
  finalLanguageToLLM: '???',       // ⬅️ QUESTO È IMPORTANTE!
}

Step 3: Chiamata LLM
--------------------
🌍 [WIDGET_DEBUG] Calling LLMRouterService {
  customerLanguage: '???',  // ⬅️ Deve essere uguale a finalLanguageToLLM
}

Step 4: Translation Input
-------------------------
🌍 [TRANSLATION_DEBUG] Input Analysis {
  targetLanguageRaw: '???',  // Ricevuto dall'LLM Router
  messagePreview: '...',
}

Step 5: Translation Normalization
---------------------------------
🌍 [TRANSLATION_DEBUG] Language Normalization {
  inputLanguage: '???',       // Es: "ITA" o "ENG"
  normalizedLanguage: '???',  // Es: "it" o "en"  ⬅️ QUESTO VA ALL'LLM!
}

Step 6: Translation Result
--------------------------
🌍 [TRANSLATION_DEBUG] Translation Complete {
  targetLanguage: '???',
  originalPreview: '...',    // Messaggio originale
  translatedPreview: '...',  // Messaggio tradotto
  outputSameAsInput: false,  // ⬅️ Se true → LLM non ha tradotto!
}
```

### Test 3: Cosa Mandare ad Andrea (Me)

**Copia l'intero blocco di log** e mandamelo. Includi:
- [ ] Tutti i log `🌍 [WIDGET_DEBUG]`
- [ ] Tutti i log `🌍 [TRANSLATION_DEBUG]`
- [ ] Anche i log normali `📨 Widget message received`

---

## 🔍 ANALISI POSSIBILI PROBLEMI

### Scenario A: Lingua non rilevata correttamente

**Sintomo**: `finalLanguageToLLM: "ITA"` ma browser è in inglese

**Cause possibili**:
1. ❌ Header `Accept-Language` non inviato dal widget
2. ❌ Widget config ha `language: "it"` hardcoded (override browser)
3. ❌ Customer già esistente con lingua salvata diversa

**Check nel log**:
```
acceptLanguageHeader: '(not provided)'  // ❌ PROBLEMA QUI
```

### Scenario B: Lingua rilevata ma non tradotta

**Sintomo**: `normalizedLanguage: "en"` ma risposta in italiano

**Cause possibili**:
1. ❌ TranslationAgent riceve formato sbagliato ("ENG" invece di "en")
2. ❌ LLM non traduce correttamente
3. ❌ `outputSameAsInput: true` (LLM restituisce input uguale)

**Check nel log**:
```
🌍 [TRANSLATION_DEBUG] Translation Complete {
  outputSameAsInput: true  // ❌ PROBLEMA QUI!
}
```

### Scenario C: Force translation fallisce

**Sintomo**: Log mostra `wasForceTranslationNeeded: true` ma output ancora sbagliato

**Cause possibili**:
1. ❌ LLM model insufficiente
2. ❌ Prompt di traduzione non chiaro
3. ❌ Timeout o errore API OpenRouter

**Check nel log**:
```
wasForceTranslationNeeded: true
outputSameAsInput: true  // ❌ Anche dopo force!
```

---

## 🚀 PROSSIMI STEP

### Step 1: Raccogli Log (Andrea)
- [ ] Apri widget
- [ ] Scrivi messaggio
- [ ] Copia **TUTTI** i log backend
- [ ] Mandameli in chat

### Step 2: Analizza Log (Io)
- [ ] Verifico dove si rompe il flusso
- [ ] Identifico causa esatta
- [ ] Propongo fix specifico

### Step 3: Implementa Fix (Insieme)
Possibili fix in base al problema:
- **Fix A**: Widget.js - Auto-detect browser language
- **Fix B**: TranslationAgent - Migliora normalizzazione
- **Fix C**: Prompt traduzione - Rendi più esplicito
- **Fix D**: Database - Aggiorna lingua customer

---

## 📝 NOTE TECNICHE

### Flusso Attuale (Come Dovrebbe Funzionare)

```
1. Browser invia Accept-Language: it-IT
   ↓
2. Widget.js legge config.language o rileva browser
   ↓
3. POST /widget/chat con { language: "it" }
   ↓
4. Backend: detectLanguageFromHeader(Accept-Language) → "it"
   ↓
5. Customer.language salvato/aggiornato → "ITA"
   ↓
6. LLMRouter riceve customerLanguage: "ITA"
   ↓
7. TranslationAgent normalizza "ITA" → "it"
   ↓
8. LLM traduce risposta in italiano
```

### Priority di Rilevamento

```
1️⃣ Body.language (esplicito da widget)
2️⃣ Accept-Language header (browser)
3️⃣ Customer.language (salvato DB)
4️⃣ Workspace.language (default workspace)
5️⃣ "ENG" (fallback sistema)
```

---

## 📄 FILE DI RIFERIMENTO

- `/Users/gelso/workspace/shopME/DEBUG_WIDGET_LANGUAGE.md` - Analisi completa
- `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts:150-500` - Widget controller
- `apps/backend/src/application/agents/TranslationAgent.ts:70-270` - Translation logic
- `apps/frontend/public/widget.js` - Widget frontend

---

## ❓ DOMANDE PER ANDREA

Dopo che hai raccolto i log, dimmi:

1. **Quale lingua ha il tuo browser?**
   - Chrome Settings → Languages → Display in...?
   - Safari Preferences → General → Preferred Languages?

2. **Il widget config attuale ha `language` specificato?**
   - Valore in `window.eChatbotConfig.language`?

3. **Hai testato con browser in lingue diverse?**
   - Es: Browser IT vs Browser EN?

4. **La risposta è sempre in italiano?**
   - Anche se browser è in inglese?

---

Andrea, **ora testa il widget e mandami i log!** 🚀

Aspetto l'output per capire dove si blocca il flusso.
