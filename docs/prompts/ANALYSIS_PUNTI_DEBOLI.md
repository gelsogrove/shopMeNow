# Analisi Punti Deboli - Risposte alle Domande di Andrea

**Data**: 2025-11-17  
**Contesto**: Test delle regole LLM con domande reali

---

## 🧪 TEST CASE: Domande di Andrea

### 1. "Mostrarmi link"

**Flusso atteso**:

```
User: "mostrarmi link"
↓
Router: [Rileva richiesta di link]
❓ Quale link? Cart? Orders? Profile?
↓
Router: customerSupportAgent({ query: "mostrarmi link" })
↓
Support: "Che tipo di link ti serve? Carrello, ordini, o profilo?"
```

**✅ FUNZIONA** - Richiesta ambigua → Support Agent chiede chiarimento

---

### 2. "Voglio fare un ordine"

**Flusso atteso**:

```
User: "voglio fare un ordine"
↓
Router: cartManagementAgent({ query: "voglio fare un ordine" })
↓
Cart: "Perfetto! Prima aggiungi prodotti al carrello. Cosa vorresti ordinare?"
```

**✅ FUNZIONA** - Cart Agent gestisce richiesta generica di ordine

---

### 3. "Voglio cambiare il mio indirizzo di posta"

**Flusso atteso**:

```
User: "voglio cambiare il mio indirizzo di posta"
↓
Router: profileManagementAgent({ query: "cambia indirizzo email" })
↓
Profile: "Mi dispiace {{nome}}, non posso modificare direttamente l'email.
         Contatta il supporto per assistenza."
```

**⚠️ PROBLEMA**: ProfileAgent NON ha funzione `updateProfile(field, value)`

**📋 Regole attuali**:

- ✅ Regola 9 dice: "Non inventare funzioni"
- ✅ Profile Agent prompt dichiara: "Future: updateProfile()" (non ancora implementato)

**SOLUZIONE**: ProfileAgent risponde correttamente (escalation a Support)

---

### 4. "Avete formaggi"

**Flusso atteso**:

```
User: "avete formaggi"
↓
Router: productSearchAgent({ query: "avete formaggi" })
↓
Product Agent: [Cerca in {{PRODUCTS}}]
↓
[Trova 15 formaggi]
↓
Product Agent: "Ecco i formaggi per categoria:
  🧀 DOP (5): Parmigiano, Grana, Pecorino, Taleggio, Gorgonzola
  🧀 Freschi (4): Mozzarella, Burrata, Ricotta, Stracchino
  🧀 Stagionati (6): Asiago, Provolone, Fontina..."
```

**✅ FUNZIONA** - Regola 11 (Grouping): >8 items → raggruppa per categoria

---

### 5. "Avete la mozzarella"

**Flusso atteso**:

```
User: "avete la mozzarella"
↓
Router: productSearchAgent({ query: "avete la mozzarella" })
↓
Product Agent: [Cerca "mozzarella" in {{PRODUCTS}}]
↓
[Trova 1 prodotto: Mozzarella di Bufala Campana DOP 250g]
↓
Product Agent: "Sì! Ecco i dettagli:

🧀 **Mozzarella di Bufala Campana DOP**

📦 Codice: MOZZ-001
💰 Prezzo: €8.50 (250g)
🏷️ Certificazioni: DOP
🌍 Regione: Campania
📏 Formato: 250g
🌡️ Temperatura: Fresco (4-8°C)
📝 Descrizione: Mozzarella artigianale di latte di bufala, sapore delicato

Vuoi aggiungerla al carrello? 🛒"
```

**✅ FUNZIONA** - Regola 11: 1 prodotto → mostra TUTTI i dettagli + chiede conferma

---

### 6. "Vuoi aggiungerla nel carrello?" → User dice "SI"

**🚨 PUNTO CRITICO! Qui è dove tutto può rompersi!**

#### Scenario A: Product Agent chiede conferma (ATTUALE)

```
Product Agent: "Vuoi aggiungerla al carrello?"
User: "SI"
↓
[Messaggio arriva a backend]
↓
Router riceve: "SI"
History: [assistant: "Vuoi aggiungerla al carrello?", user: "SI"]
↓
❓ Router deve capire:
   1. User risponde a CONFERMA
   2. Context è: aggiunta mozzarella al carrello
   3. Deve delegare a CART (non Product!)
↓
✅ Router CORRETTO (con nuova Regola 2):
   cartManagementAgent({
     query: "L'utente CONFERMA aggiunta Mozzarella di Bufala Campana DOP 250g (MOZZ-001) al carrello"
   })
↓
Cart Agent: [Vede "CONFERMA" → esegue subito!]
           [Calls addToCart(productId="MOZZ-001", quantity=1)]
↓
Response: "Perfetto! ✅ Ho aggiunto Mozzarella di Bufala Campana DOP 250g al carrello (€8.50).
           Il totale è €8.50 (sconto 15% già applicato). Vuoi procedere al checkout?"
```

**✅ FUNZIONA SE**:

1. ✅ Router legge history (ultimi 3 messaggi)
2. ✅ Router rileva pattern conferma ("Vuoi...?" + "SI")
3. ✅ Router usa parola "CONFERMA" nel query
4. ✅ Router delega a CART (non Product!)
5. ✅ Cart Agent vede "CONFERMA" → esegue senza ri-chiedere

---

## 🚨 PUNTI DEBOLI TROVATI

### PROBLEMA 1: Product → Cart Delegation (CRITICO!)

**Dove si rompe**:

```
Product Agent chiede: "Vuoi aggiungere mozzarella?"
User: "SI"
↓
Router riceve "SI"
↓
❌ ERRORE POTENZIALE 1: Router delega a productSearchAgent (non cart!)
   → Product Agent: "SI per cosa?" (loop!)

❌ ERRORE POTENZIALE 2: Router delega a cartManagementAgent MA senza "CONFERMA"
   → Cart Agent: "Vuoi confermare aggiunta?" (ri-chiede!)

❌ ERRORE POTENZIALE 3: Router delega a cartManagementAgent MA senza productId
   → Cart Agent: "Quale prodotto vuoi aggiungere?" (informazione persa!)
```

**SOLUZIONE**:

- ✅ Regola 2 dice: "Usa CONFERMA quando user risponde SI a domanda conferma"
- ⚠️ MANCA: Regola esplicita "Product confirmation → delega a CART (non Product!)"
- ⚠️ MANCA: Regola "Estrai productId dalla history (MOZZ-001)"

---

### PROBLEMA 2: Message Flow Timeline NON mostra Product → Cart handoff

**Timeline attuale** (se Product chiede conferma ma Cart esegue):

```
debugInfo.steps = [
  { agent: "Router Agent", action: "Intent classification" },
  { agent: "Product Search Agent", action: "Show mozzarella details" },
  { agent: "Safety Agent", action: "Validate + translate" }
]
```

**❌ MANCA**: Secondo giro quando user dice "SI":

```
debugInfo.steps = [
  { agent: "Router Agent", action: "Context interpretation (SI)" },  ← Questo!
  { agent: "Cart Management Agent", action: "Add to cart" },         ← Questo!
  { agent: "Safety Agent", action: "Validate + translate" }
]
```

**PROBLEMA**: Se Product Agent delega a Cart, Timeline DEVE mostrare:

1. Router (interpreta "SI")
2. **Product Agent (delega a Cart)** ← QUESTO STEP MANCA!
3. Cart Agent (esegue addToCart)

**SOLUZIONE**: Regola 8 deve dire "Delegation steps MUST appear in timeline"

---

### PROBLEMA 3: Variabili al posto sbagliato (TROVATO!)

**Analisi variabili**:

| Variabile        | Dove DOVREBBE essere | Dove È ATTUALMENTE     | Problema? |
| ---------------- | -------------------- | ---------------------- | --------- |
| {{PRODUCTS}}     | Product Agent ONLY   | Product + Cart (forse) | ⚠️ CHECK  |
| {{SERVICES}}     | Product Agent ONLY   | Product Agent          | ✅ OK     |
| {{OFFERS}}       | Product Agent ONLY   | Product Agent          | ✅ OK     |
| {{CATEGORIES}}   | Product Agent ONLY   | Product Agent          | ✅ OK     |
| {{FAQ}}          | Router ONLY          | Router                 | ✅ OK     |
| {{discountUser}} | Product + Cart       | Product + Cart         | ✅ OK     |

**⚠️ DA VERIFICARE**: Cart Agent ha {{PRODUCTS}}?

---

### PROBLEMA 4: Router prompt DEBOLE su short responses

**Router attuale** (router-agent-CLEAN.md):

```markdown
## Special Cases

**Short replies (SI, NO, OK, 1)**: Check conversation history for context, then call the right function
```

**❌ PROBLEMA**: Troppo generico!

**✅ DOVREBBE DIRE**:

```markdown
## Context Interpretation for Short Responses

**When user sends**: "SI", "OK", "YES", "1", "2", "3"

**STEPS**:

1. Read last 3 messages from conversation history
2. Identify what user is confirming/selecting
3. Include keyword "CONFERMA" if replying to question
4. Extract product/order codes from history
5. Delegate to CORRECT agent (might be different from previous!)

**Examples**:

History: [Product Agent: "Vuoi aggiungere Mozzarella (MOZZ-001)?", User: "SI"]
→ cartManagementAgent({ query: "L'utente CONFERMA aggiunta Mozzarella di Bufala DOP (MOZZ-001) al carrello" })
⚠️ NOTE: Delegate to CART, not Product!

History: [Profile Agent: "Vuoi disattivare notifiche?", User: "SI"]
→ profileManagementAgent({ query: "L'utente CONFERMA disattivazione notifiche push promozionali" })

History: [Product Agent: "1) Parmigiano €15.50 2) Grana €12.80", User: "1"]
→ productSearchAgent({ query: "L'utente seleziona Parmigiano Reggiano DOP (PARM-001) dalla lista" })
```

---

## 🔧 CORREZIONI NECESSARIE

### 1. Aggiornare Regola 2 (Context Interpretation)

**AGGIUNGI**:

- ⚠️ Delegation switching: Product confirmation → delegate to CART (not Product!)
- ⚠️ Extract codes from history: (MOZZ-001), (ORD-123), etc.
- ⚠️ Pattern examples for ALL agents

---

### 2. Aggiornare Regola 8 (Message Flow Timeline)

**AGGIUNGI**:

- ⚠️ Delegation steps MUST appear in timeline
- ⚠️ Example: Product → Cart handoff shows BOTH steps

**Timeline structure for "SI" after product confirmation**:

```typescript
debugInfo.steps = [
  // First request: "avete mozzarella"
  { agent: "Router Agent", action: "Route to Product" },
  {
    agent: "Product Search Agent",
    action: "Show mozzarella + ask confirmation",
  },
  { agent: "Safety Agent", action: "Translate" },

  // Second request: "SI"
  { agent: "Router Agent", action: "Contextualize SI → delegate to Cart" },
  { agent: "Cart Management Agent", action: "Add MOZZ-001 to cart" },
  { agent: "Safety Agent", action: "Translate" },
]
```

---

### 3. Verificare variabile {{PRODUCTS}} in Cart Agent

**CHECK**: Cart Agent dovrebbe avere {{PRODUCTS}}?

**PRO**: Può mostrare dettagli prodotto quando conferma aggiunta
**CONTRO**: Viola Principle III se anche Product Agent ha {{PRODUCTS}} (duplicazione!)

**SOLUZIONE**:

- ✅ Product Agent: {{PRODUCTS}} (per ricerca)
- ❌ Cart Agent: NO {{PRODUCTS}} (usa solo productId passato)
- ✅ Cart Agent ottiene nome/prezzo da database via productId

---

### 4. Aggiungere esempi "Product → Cart" delegation in Regola 7

**MANCA**: Cross-agent awareness per delegation switching

**AGGIUNGI**:

```markdown
## Product → Cart Delegation Pattern

When Product Agent asks confirmation and user says "SI":

1. ✅ Router detects confirmation pattern
2. ✅ Router extracts product code from history
3. ⚠️ Router delegates to CART (NOT Product!)
4. ✅ Cart Agent receives: "L'utente CONFERMA aggiunta [PRODUCT] ([CODE])"
5. ✅ Cart Agent executes addToCart immediately (no re-asking)

Timeline impact:

- Request 1: Router → Product → Safety (show + ask)
- Request 2: Router → Cart → Safety (execute add)
```

---

## 📊 SUMMARY: Punti deboli trovati

| #   | Problema                                   | Gravità    | Regola Coinvolta | Fix Necessario                          |
| --- | ------------------------------------------ | ---------- | ---------------- | --------------------------------------- |
| 1   | Product → Cart delegation non esplicita    | 🔴 CRITICO | Regola 2         | Aggiungi esempi delegation switching    |
| 2   | Timeline non mostra delegation steps       | 🔴 CRITICO | Regola 8         | Aggiungi "delegation steps in timeline" |
| 3   | Router prompt troppo generico su "SI"      | 🟠 ALTO    | Regola 2         | Espandi esempi in router-agent-CLEAN.md |
| 4   | {{PRODUCTS}} forse duplicato (Cart?)       | 🟡 MEDIO   | Regola 10        | Verifica Cart Agent prompt              |
| 5   | Manca pattern "extract codes from history" | 🟠 ALTO    | Regola 2         | Aggiungi regex examples                 |
| 6   | Cross-agent delegation non documentata     | 🟡 MEDIO   | Regola 7         | Aggiungi Product→Cart section           |

---

## ✅ AZIONI IMMEDIATE

1. **Aggiorna Regola 2**: Aggiungi sezione "Delegation Switching"
2. **Aggiorna Regola 8**: Timeline MUST show delegation steps
3. **Aggiorna router-agent-CLEAN.md**: Espandi "Special Cases" con esempi completi
4. **Verifica Cart Agent**: Ha {{PRODUCTS}}? Se sì, rimuovilo (violation Principle III)
5. **Test END-TO-END**: "avete mozzarella" → "SI" → verifica timeline mostra Router→Product→Router→Cart

---

**Fine Analisi** - Punti critici identificati, pronto per correzioni!
