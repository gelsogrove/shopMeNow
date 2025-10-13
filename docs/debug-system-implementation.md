# 🔧 Debug System Implementation - Complete

## ✅ Funzionalità Implementate

Hai richiesto l'aggiunta di funzionalità di debug avanzate alla popup WhatsApp per monitorare il comportamento del sistema. Ecco tutto quello che è stato implementato:

### 🎯 Dati di Debug Raccolti

#### 1. **Token Utilizzati**
- ✅ **Prompt Tokens**: Conta i token utilizzati per il prompt di sistema
- ✅ **Completion Tokens**: Conta i token generati nella risposta
- ✅ **Total Tokens**: Somma totale dei token utilizzati
- ✅ **Calcolo Automatico**: Se l'API non restituisce i token, usa una stima basata sui caratteri

#### 2. **Conteggi Link Attivi/Scaduti**
- ✅ **Short URLs Attivi**: Link brevi ancora validi nel database
- ✅ **Short URLs Scaduti**: Link brevi scaduti/eliminati
- ✅ **Secure Tokens Attivi**: Token sicuri ancora validi
- ✅ **Secure Tokens Scaduti**: Token sicuri scaduti

#### 3. **Function Calls Tracciate**
- ✅ **Nome Funzione**: Quale funzione è stata chiamata (GetLinkOrderByCode, ContactOperator, etc.)
- ✅ **Argomenti**: Parametri passati alla funzione
- ✅ **Risultato**: Esito della chiamata alla funzione
- ✅ **Timestamp**: Quando la funzione è stata chiamata

#### 4. **Costi delle Chiamate**
- ✅ **Prompt Cost**: Costo per i token del prompt ($USD)
- ✅ **Completion Cost**: Costo per i token di risposta ($USD)
- ✅ **Total Cost**: Costo totale della chiamata ($USD)
- ✅ **Pricing Aggiornato**: Basato sui prezzi OpenRouter per gpt-4o-mini

#### 5. **Variabili Utente**
- ✅ **Lingua**: Lingua dell'utente (it, es, pt, en)
- ✅ **Sconto**: Percentuale di sconto dell'utente
- ✅ **Ultimo Ordine**: Codice dell'ultimo ordine effettuato
- ✅ **WorkspaceId**: ID del workspace
- ✅ **CustomerId**: ID del cliente

#### 6. **Informazioni Aggiuntive**
- ✅ **Stage**: Fase di elaborazione del messaggio
- ✅ **Timestamp**: Momento esatto dell'elaborazione
- ✅ **Prompt Info**: Lunghezza prompt originale vs processato
- ✅ **Response Length**: Lunghezza della risposta finale

## 🎨 Interfaccia Utente

### 📱 Popup WhatsApp - Due Livelli di Debug

#### 1. **Quick Debug Summary** (Toggle Code 🔧)
Pannello rapido sempre visibile che mostra:
- 💰 **Costo Totale** della chiamata
- 🎯 **Token Totali** utilizzati
- 🔗 **Link Attivi** nel sistema  
- 🗑️ **Link Scaduti** nel sistema
- 🔧 **Funzione Chiamata** (se presente)
- 🌐 **Lingua** dell'utente
- 💳 **Sconto** dell'utente

#### 2. **Complete Debug Information** (Toggle Settings ⚙️)
Pannello completo con tutti i dettagli:
```json
{
  "🕐 Timestamp": "2025-09-27T15:49:30.000Z",
  "📞 Phone": "+34666777888",
  "🏢 Workspace ID": "workspace_123",
  "👤 Customer ID": "customer_456",
  "📊 Stage": "completed",
  "👤 Customer Info": {
    "Name": "Maria Garcia",
    "Language": "es",
    "Discount": "5%",
    "Company": "Garcia Imports S.L.",
    "Last Order": "ORD-003-2024"
  },
  "🌐 User Context": {
    "language": "es",
    "discount": 5,
    "lastOrder": "ORD-003-2024",
    "displayLanguage": "ESPAÑOL"
  },
  "🔗 Links Status": {
    "Short URLs Active": 12,
    "Short URLs Expired": 3,
    "Secure Tokens Active": 8,
    "Secure Tokens Expired": 15
  },
  "🎯 Token Usage": {
    "Prompt Tokens": 1250,
    "Completion Tokens": 89,
    "Total Tokens": 1339
  },
  "💰 Cost Info": {
    "Prompt Cost": "$0.000188",
    "Completion Cost": "$0.000053",
    "Total Cost": "$0.000241",
    "Currency": "USD"
  },
  "🔧 Function Calls": [
    {
      "Function 1": "GetLinkOrderByCode",
      "Arguments 1": {"orderCode": "ORD-003-2024"},
      "Result 1": {"success": true, "linkUrl": "..."}
    }
  ]
}
```

## 🔧 Implementazione Tecnica

### Backend Modifiche

1. **`/src/utils/token-calculator.ts`** - NEW
   - Funzioni per calcolare token e costi
   - Supporta stima automatica se API non restituisce dati

2. **`/src/repositories/message.repository.ts`**
   - Aggiunta funzione `getLinkCounts()` per contare link attivi/scaduti

3. **`/src/services/llm.service.ts`**
   - Modificata `handleMessage()` per raccogliere tutti i dati di debug
   - Modificata `generateLLMResponse()` per tracciare function calls e costi
   - Aggiunto supporto per debug info completo nel campo `debugInfo`

### Frontend Modifiche

4. **`/src/components/shared/WhatsAppChatModal.tsx`**
   - Aggiunto pannello "Quick Debug Summary"
   - Migliorato pannello "Complete Debug Information"
   - Reso visibile il toggle Settings per debug completo

## 📊 Esempio di Utilizzo

### Scenario: Cliente chiede "esporta il catalogo"

**Quick Summary mostrerà:**
- 💰 Cost: $0.000241
- 🎯 Tokens: 1,339
- 🔗 Active Links: 12
- 🗑️ Expired Links: 3
- 🔧 Function Called: None
- 🌐 Language: es
- 💳 Discount: 5%

**Complete Debug mostrerà tutto** inclusi:
- Dettagli completi del cliente
- Conteggi precisi di tutti i tipi di link
- Costi dettagliati per prompt e completion
- Informazioni sul prompt processato
- Stage di elaborazione completo

## 🎯 Benefici

1. **Debug del Modello**: Puoi vedere se riceve sempre i dati corretti
2. **Monitoraggio Costi**: Controllo preciso dei costi per chiamata
3. **Performance Tracking**: Monitoraggio token usage e response times  
4. **Link Management**: Visibilità sui link attivi/scaduti
5. **Function Call Debug**: Tracciamento completo delle chiamate alle funzioni
6. **User Context**: Verifica che lingua, sconto e dati utente siano corretti

## 🚀 Prossimi Passi

Il sistema è completamente implementato e pronto per il test. Puoi:

1. **Testare in Produzione**: Inviare messaggi e vedere i debug info
2. **Monitorare Costi**: Tenere traccia dei costi giornalieri
3. **Debug Issues**: Quando il modello si comporta male, avrai tutti i dati necessari
4. **Ottimizzare**: Usare i dati per ottimizzare prompts e ridurre costi

Tutto è salvato nello storico dei messaggi nel campo `debugInfo` come JSON, quindi hai persistenza completa dei dati di debug! 🎉