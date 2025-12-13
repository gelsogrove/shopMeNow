# 🧪 MCP - Test & Quality Assurance per LLM

Questa cartella contiene tutto il necessario per testare e validare il comportamento del chatbot Code-First LLM.

## 🎯 Filosofia

> **"Codice decide, LLM formatta"** - Le decisioni logiche sono nel codice, l'LLM si occupa solo della formattazione naturale.

### Processo di Quality Assurance

```
┌─────────────────────────────────────────────────────────────┐
│  1. LEGGI LE REGOLE                                         │
│     → regole_di_prompts.md (architettura e flow)            │
│     → PROMPT_VARIABLES.md (variabili disponibili)           │
├─────────────────────────────────────────────────────────────┤
│  2. LANCIA TEST MCP                                         │
│     → node mcp-test-client.js "Mario Rossi" "messaggio"     │
│     → Osserva log server + risposta LLM                     │
├─────────────────────────────────────────────────────────────┤
│  3. HUMAN-IN-THE-LOOP                                       │
│     → Andrea valuta: "Mi piace / Non mi piace"              │
│     → Se non piace → Fix nel codice (non nel prompt!)       │
│     → Ritesta finché non passa                              │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File in questa cartella

| File | Descrizione |
|------|-------------|
| `mcp-test-client.js` | Client per testare messaggi WhatsApp |
| `regole_di_prompts.md` | **BIBBIA** - Architettura, flow, regole |
| `PROMPT_VARIABLES.md` | Variabili disponibili nei prompt |
| `README.md` | Questa guida |

---

## 🚀 Quick Start

```bash
cd /Users/gelso/workspace/shopME/apps/backend/mcp

# Test singolo
node mcp-test-client.js "Mario Rossi" "chi sei?"

# Test concatenati (flow completo)
node mcp-test-client.js "Mario Rossi" "che prodotti avete?" && \
node mcp-test-client.js "Mario Rossi" "5"
```

## ⚙️ Opzioni

| Opzione | Default | Descrizione |
|---------|---------|-------------|
| `log=false` | true | Disabilita log server |
| `exit-first-message=false` | true | Modalità conversazione |
| `seed=true` | false | Seed database prima del test |

## 👤 Utenti Test

| Utente | Lingua | Phone |
|--------|--------|-------|
| Mario Rossi 🇮🇹 | IT | +390212345678 |
| John Smith 🇬🇧 | EN | +44123456789 |
| Maria Garcia 🇪🇸 | ES | +34666777888 |
| João Silva 🇵🇹 | PT | +351912345678 |

---

## 📋 Scenari di Test

### ✅ Funzionanti (Verificati)

| Scenario | Comando | Comportamento Atteso |
|----------|---------|---------------------|
| Identità | `"chi sei?"` | Risponde con `{{botIdentityResponse}}` |
| Location | `"dove siete?"` | Mostra indirizzo workspace |
| Categorie | `"che prodotti avete?"` | Lista 9 categorie numerate |
| Selezione | `"5"` (dopo categorie) | Mostra prodotti di "Formaggi" |
| Dettaglio | `"3"` (dopo prodotti) | Mostra dettaglio prodotto |

### 🔄 Da Testare/Fixare

| Scenario | Comando | Problema |
|----------|---------|----------|
| Grouping 6+ | Categoria con 7 prodotti | Dovrebbe raggruppare logicamente |
| Carrello | `"aggiungi mozzarella"` | Da verificare |
| Ordini | `"i miei ordini"` | Da verificare |
| FAQ | `"come posso pagare?"` | Da verificare |

---

## 🔧 Processo di Fix

Quando una risposta **non piace**:

### 1. Identifica il problema

```bash
# Guarda i log
node mcp-test-client.js "Mario Rossi" "messaggio problematico"

# Cerca nei log:
# - intentType: quale intent è stato rilevato?
# - loadedDataType: quali dati sono stati caricati?
# - responseType: quale tipo di risposta è stato costruito?
```

### 2. Consulta le regole

Apri `regole_di_prompts.md` e cerca:
- È un problema di **intent detection**? → Fix in `IntentParser`
- È un problema di **dati caricati**? → Fix in `DataLoader`
- È un problema di **logica risposta**? → Fix in `ResponseBuilder`
- È un problema di **formattazione**? → Fix in `LLMFormatter`

### 3. Applica il principio

> **"Codice decide, LLM formatta"**

- ❌ NON modificare il prompt per "convincere" l'LLM
- ✅ Modifica il CODICE per passare dati corretti all'LLM

### 4. Ritesta

```bash
node mcp-test-client.js "Mario Rossi" "messaggio problematico"
# Ripeti finché Andrea dice "Mi piace!"
```

---

## 📖 Regole Chiave (da regole_di_prompts.md)

### Architettura Code-First

```
[Messaggio utente]
       ↓
[IntentParser] → Intent deterministico (PATTERN, non LLM)
       ↓
[DataLoader] → Carica SOLO dati necessari (non 45kb!)
       ↓
[ResponseBuilder] → Logica COUNT (1-2, 3-5, 6+ items)
       ↓
[LLMFormatter] → Solo formattazione (temperatura bassa)
       ↓
[Risposta finale]
```

### Regole COUNT

| N. Items | Comportamento |
|----------|---------------|
| 0 | Messaggio "non trovato" + suggerimenti |
| 1-2 | Dettagli completi + "Vuoi aggiungerlo?" |
| 3-5 | Lista numerata con prezzi |
| 6+ | **Grouping logico** (LLM crea gruppi) |

### Variabili Pesanti (MAX 1 volta per prompt)

- `{{products}}` - Catalogo completo (~50k tokens)
- `{{categories}}` - Lista categorie (~5k tokens)
- `{{offers}}` - Offerte attive (~8k tokens)
- `{{services}}` - Servizi (~3k tokens)

---

## 🎯 Acceptance Criteria

Prima di considerare un fix "completato":

- [ ] Intent rilevato correttamente (log: `intentType`)
- [ ] Dati caricati corretti (log: `loadedDataType`)
- [ ] Risposta formattata bene (log: `responseType`)
- [ ] Andrea dice "Mi piace!"
- [ ] Test concatenato funziona (es. categorie → selezione → dettaglio)

---

## 🔍 Debug

### Log più utili

```
🎯 [CodeFirstLLM] Intent detected { type, confidence, source }
📦 [DataLoader] Loading data { intentType, count }
🏗️ [ResponseBuilder] Building response { type }
📝 [LLMFormatter] Formatting { type, tokensUsed, ms }
```

### Verificare variabili

```bash
cd /Users/gelso/workspace/shopME/apps/backend

node -e "
const { prisma } = require('./src/lib/prisma');
prisma.workspace.findFirst({
  where: { slug: 'bell-italia-vip' },
  select: { botIdentityResponse: true, address: true }
}).then(w => {
  console.log('Workspace:', JSON.stringify(w, null, 2));
  process.exit(0);
});
"
```

---

## 📞 Workflow Andrea

1. **Andrea chiede test**: "Testa X"
2. **Agente lancia MCP**: `node mcp-test-client.js "Mario Rossi" "X"`
3. **Andrea vede risposta**: "Mi piace" / "Non mi piace perché..."
4. **Se non piace**: Fix nel codice seguendo `regole_di_prompts.md`
5. **Ripeti** finché tutti gli scenari passano



cosi si fanno le query

docker exec -u postgres shop_db psql -U echatbotfy -d echatbotfy -c "SELECT (metadata->>'lastOptionsMapping') IS NOT NULL as has_mapping, metadata->'lastOptionsMapping'->>'listType' as list_type FROM search_conversations sc JOIN chat_sessions cs ON sc.\"sessionId\" = cs.id JOIN customers c ON cs.\"customerId\" = c.id WHERE c.phone = '+390212345678' AND cs.status = 'active';"
