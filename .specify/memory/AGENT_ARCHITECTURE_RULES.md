# Agent Architecture Rules - Constitution

**Created**: 2025-11-15  
**Status**: MANDATORY - Must follow these rules  
**Owner**: Andrea

---

## 🏛️ REGOLA I: Single Source of Truth per Funzioni

**RULE**: Tutte le funzioni disponibili per gli agent LLM DEVONO essere definite in UN SOLO FILE configurazione.

**IMPLEMENTATION**:

- ✅ File unico: `backend/src/config/agent-functions.config.ts`
- ✅ Backend `llm.service.ts` legge da questo file
- ✅ Frontend `/agents` legge da API che espone questo file
- ✅ Database `availableFunctions` viene popolato da questo file nel seed
- ❌ NO hardcoded functions in multiple places
- ❌ NO duplicazione definizioni

**WHY**: Evitare disallineamento tra UI admin e comportamento reale LLM

---

## 🏛️ REGOLA II: Variable Uniqueness Constraint (Aggiornata)

**RULE**: Ogni variabile grande può apparire **AL MASSIMO UNA VOLTA PER AGENT PROMPT**.

**VARIABILI GRANDI**:

- `{{PRODUCTS}}` - Lista tutti prodotti (~50k tokens)
- `{{SERVICES}}` - Lista tutti servizi (~5k tokens)
- `{{CATEGORIES}}` - Lista tutte categorie (~2k tokens)
- `{{OFFERS}}` - Lista tutte offerte (~3k tokens)

**ALLOWED**:

- ✅ `{{SERVICES}}` in Router Agent prompt
- ✅ `{{SERVICES}}` in Product Search Agent prompt (agents diversi OK)
- ✅ `{{PRODUCTS}}` in Product Search Agent prompt
- ✅ `{{CATEGORIES}}` in Product Search Agent prompt

**FORBIDDEN**:

- ❌ `{{SERVICES}}` due volte nello STESSO prompt Router Agent
- ❌ `{{PRODUCTS}}` due volte nello STESSO prompt Product Search Agent
- ❌ `{{CATEGORIES}}` due volte nello STESSO prompt

**REASON**: Ogni variabile può generare 50k+ tokens. Duplicazione NELLO STESSO PROMPT causa 100k+ prompt → API failure.

**ENFORCEMENT**:

- Validazione on save in Admin UI
- Runtime warnings in PromptProcessorService

---

## 🏛️ REGOLA III: Router Agent Responsibility (Product Questions FIRST! + NO AGENT CHAINING!)

**RULE**: Router Agent ha SOLO responsabilità di orchestrazione + storia conversazionale. **Product questions ("avete X?") MUST go to Product Search Agent FIRST**, never directly to Cart! **Router MUST WAIT for customer response after each specialist agent call** - NO chaining multiple agents without customer input!

**ROUTER AGENT DOES**:

- ✅ Mantiene storia conversazione (conversation history)
- ✅ Decide quale specialist agent chiamare
- ✅ **Route "avete X?" → Product Search Agent (ALWAYS FIRST!)**
- ✅ **WAIT for customer response after specialist agent returns** (NO auto-chaining!)
- ✅ **Route "SI" after product shown → Cart Agent with product code** (ONLY when customer confirms!)
- ✅ Risponde a FAQ semplici
- ✅ Gestisce notifiche push (manageNotifications)
- ✅ Estrae product code da conversation history quando user conferma "SI"

**ROUTER AGENT DOES NOT**:

- ❌ **Route "avete X?" directly to Cart Agent** (FORBIDDEN! Must go to Product Search first!)
- ❌ **Call multiple agents in sequence without customer input** (e.g., productSearchAgent → cartManagementAgent)
- ❌ **Auto-execute cart actions when Product Search asks "Vuoi aggiungerla?"** (MUST wait for customer "SI"!)
- ❌ Gestire logica di prodotti/servizi (delega a Product Search Agent)
- ❌ Gestire carrello direttamente (delega a Cart Management Agent)
- ❌ Gestire ordini (delega a Order Tracking Agent)
- ❌ Formattazione/tone response (questo è dei specialist)

**CRITICAL FLOW - Product Question to Cart** (2 SEPARATE customer messages!):

```
MESSAGE 1 from customer:
1. User: "avete la mozzarella?"
2. Router → productSearchAgent({ query: "avete la mozzarella?" })  ← ALWAYS FIRST!
3. Product Search: Shows Format C (8 fields: name, code, price, stock, description, supplier, region, certifications)
4. Product Search: "Vuoi aggiungerla al carrello?"
5. Router: RETURN response to customer (STOP! WAIT for next message!)

MESSAGE 2 from customer (NEW MESSAGE!):
6. User: "SI"
7. Router: Extracts product code (MOZZ-001) from conversation history
8. Router → cartManagementAgent({ query: "Utente conferma mozzarella: MOZZ-001" })
9. Cart: Adds product to cart
10. Router: RETURN response to customer (STOP!)
```

**WHY**:

- ✅ Separation of concerns - Router orchestrates, Specialists execute
- ✅ Product Search shows ALL details before cart decision (price, stock, description, etc.)
- ✅ Customer makes INFORMED decision with complete product information
- ✅ **Customer must SEE product details and CONFIRM with "SI" before adding to cart**
- ✅ Cart Agent adds product ONLY AFTER user sees details and confirms
- ❌ **Auto-calling Cart Agent skips customer decision → BAD UX!**

**FORBIDDEN PATTERNS**:

```
❌ WRONG #1 (skips product details):
User: "avete la mozzarella?"
Router → cartManagementAgent({ query: "aggiungi mozzarella" })  ← SKIPS product details!
Cart: Adds without showing price/stock/description → Bad UX!

❌ WRONG #2 (chains agents without customer input):
User: "avete la mozzarella?"
Router → productSearchAgent({ query: "avete la mozzarella?" })
Product Search: "Mozzarella... Vuoi aggiungerla?"  ← Asks customer!
Router → cartManagementAgent({ query: "..." })  ← WRONG! Customer hasn't confirmed yet!
Cart: Adds to cart  ← Customer never said "SI"!

✅ CORRECT (waits for customer confirmation):
User: "avete la mozzarella?"
Router → productSearchAgent({ query: "avete la mozzarella?" })
Product Search: "Mozzarella... Vuoi aggiungerla?"
Router → RETURN to customer (STOP! WAIT!)
User: "SI"  ← Customer confirms!
Router → cartManagementAgent({ query: "Utente conferma mozzarella: MOZZ-003" })
Cart: "Prodotto aggiunto!"
```

---

## 🏛️ REGOLA IV: Welcome/WIP Messages Format

**RULE**: `welcomeMessage` e `wipMessage` nel database sono **stringhe semplici in INGLESE**, NON oggetti JSON multi-lingua.

**DATABASE SCHEMA**:

```prisma
model Workspace {
  welcomeMessage String?  // "Welcome to eChatbot! I'm your assistant..." (plain English)
  wipMessage     String?  // "Work in progress. Contact us later." (plain English)
}
```

**ADMIN UI FORM**:

- ✅ Input type: `<textarea>` semplice
- ✅ Placeholder: "Enter welcome message in English..."
- ✅ Save: Stringa diretta (no JSON.stringify)
- ✅ Load: Stringa diretta (no JSON.parse)
- ❌ NO multi-language object `{en: "", it: "", es: ""}`
- ❌ NO JSON editor

**TRANSLATION**:

- Translation Layer (Safety & Translation Agent) traduce automaticamente in lingua cliente
- Admin scrive SOLO in inglese
- Sistema traduce runtime

**SEED DATA**:

```typescript
// backend/prisma/data/workspaceSettings.ts
export const workspaceSettings = {
  welcomeMessage: "Welcome to Bell'Italia! I'm SofiA...", // ✅ String
  wipMessage: "Work in progress. Contact us later.", // ✅ String
  // ❌ NO: welcomeMessages: { en: "", it: "" }
}
```

**WHY**: Simplicità - una sola versione, traduzione automatica

---

## 🏛️ REGOLA V: Agent Configuration UI

**RULE**: Frontend `/agents` page mostra configurazione REALE degli agent dal backend, non placeholder.

**IMPLEMENTATION**:

- ✅ Frontend chiama API: `GET /api/agent-config`
- ✅ API ritorna agent configs dal database + funzioni disponibili da `agent-functions.config.ts`
- ✅ UI mostra: nome agent, tipo, temperature, max tokens, **funzioni reali disponibili**
- ❌ NO funzioni hardcoded nel frontend
- ❌ NO placeholder "addToCart, viewCart, clearCart"

**RESPONSE EXAMPLE**:

```json
{
  "agents": [
    {
      "name": "Router Agent",
      "type": "ROUTER",
      "temperature": 0.3,
      "maxTokens": 2048,
      "availableFunctions": [
        "productSearchAgent",
        "cartManagementAgent",
        "orderTrackingAgent",
        "manageNotifications"
      ]
    },
    {
      "name": "Cart Management Agent",
      "type": "CART_MANAGEMENT",
      "availableFunctions": ["addProduct", "resetCart", "getCartLink"]
    }
  ]
}
```

**WHY**: Admin vede esattamente cosa può fare ogni agent

---

## 🏛️ REGOLA VI: No Basic/Generic Responses (Anti-Validation Pattern)

**RULE**: Tutti gli specialist agent DEVONO rispondere con dettagli completi e specifici. MAI risposte basiche/generiche.

**RATIONALE**: Elimina necessità di validation-only router pattern. Se prompt è chiaro → LLM risponde bene → nessun recovery necessario.

**FORBIDDEN RESPONSES** (❌ MAI usare):

- "Yes" / "Sì" / "Certo" / "Sure" / "OK" / "Done" / "Fatto"
- "I can help you" / "Posso aiutarti"
- "We have it" / "Abbiamo questo"
- Qualsiasi risposta < 50 caratteri
- Qualsiasi risposta senza dettagli specifici (codici prodotto, prezzi, stati ordine, etc.)

**REQUIRED RESPONSE FORMAT**:

### Product Search Agent:

```markdown
Ciao {{nome}}! Ecco [category]:

1. **Product Name** (CODE-XXX) - ~~€XX~~ **€YY** 💰 (XX% OFF)
   Brief description

2. **Product Name** (CODE-XXX) - €XX.XX
   Brief description

[Follow-up question]
```

**Minimum**: 50 characters + product list

### Cart Management Agent:

```markdown
✅ Ho aggiunto **[Product Name]** (CODE-XXX) al carrello!

[LINK_CHECKOUT_WITH_TOKEN]

Totale: €XX.XX ([N] prodotti)
Vuoi aggiungere altro?
```

**Minimum**: 50 characters + explicit product confirmation

### Order Tracking Agent:

```markdown
� Ordine **[ORDER_CODE]** - Stato: [STATUS]

Prodotti:

- [Product] x [Qty] - €XX.XX

Totale: €XX.XX
Spedizione: [STATUS]

[LINK_ORDER_WITH_TOKEN]
```

**Minimum**: 80 characters + order code + status

### Customer Support Agent:

```markdown
Ciao {{nome}}, [EMPATHY] 😔

[PROBLEM ACKNOWLEDGMENT]

SOLUZIONE:

1. [Action 1]
2. [Action 2]

[CALL TO ACTION]
```

**Minimum**: 80 characters + empathy + solution

**IMPLEMENTATION**:

- ✅ Add explicit "FORBIDDEN BASIC RESPONSES" section in each agent prompt
- ✅ Provide clear examples (❌ WRONG / ✅ CORRECT)
- ✅ Define minimum character length per agent
- ✅ Require specific data (product codes, order codes, prices, status)
- ❌ NO validation-only pattern needed (prompt handles quality)

**BENEFITS**:

- ✅ Elimina 95% dei casi di validation failure
- ✅ Riduce loop risk (LLM raramente sbaglia con istruzioni esplicite)
- ✅ Codice più semplice (meno logica validation)
- ✅ Migliore UX (risposte sempre complete)
- ✅ Risparmio token (meno recovery calls Router)

**ENFORCEMENT**: Prompt engineering (non codice). Se LLM rispetta prompt → zero validation necessaria.

---

## 🏛️ REGOLA VII: Short Reply Context Interpretation

**RULE**: Quando il Router Agent riceve risposte brevi (SI, NO, OK, 1-9), DEVE contestualizzare guardando il **MESSAGGIO PIÙ RECENTE** nella history, non il primo che trova.

**PATTERN BREVI DA GESTIRE**:

- `SI`, `SÌ`, `YES`, `OK`, `PERFETTO`, `VA BENE`
- `NO`, `NOPE`, `NON VOGLIO`
- Numeri: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`

**MANDATORY LOGIC**:

```markdown
### 2. Short Replies Need Context Interpretation

**When customer sends short responses** (SI, NO, OK, 1-9), you MUST:

1. **Read conversation history from BOTTOM to TOP** (most recent first)
2. **Find the LAST assistant message** (not the first!)
3. **Identify what question was asked** in that last message
4. **Build explicit message with "CONFERMA" keyword**

🚨 **CRITICAL RULE**: ALWAYS use the MOST RECENT assistant message, not older ones!
```

**EXAMPLES TO INCLUDE IN ROUTER PROMPT**:

````markdown
❌ **WRONG**: Looking at first/oldest message in history

```javascript
// History (oldest to newest):
// 1. "Vuoi Parmigiano?" (5 min ago)
// 2. "Vuoi disattivare notifiche?" (30 sec ago)
// Customer: "SI"

// ❌ WRONG: Router picks message #1 (oldest)
cartManagementAgent({ query: "CONFERMA Parmigiano" })
```
````

✅ **CORRECT**: Looking at LAST/newest assistant message

```javascript
// History (oldest to newest):
// 1. "Vuoi Parmigiano?" (5 min ago)
// 2. "Vuoi disattivare notifiche?" (30 sec ago)
// Customer: "SI"

// ✅ CORRECT: Router picks message #2 (most recent)
profileManagementAgent({ query: "L'utente CONFERMA di disattivare notifiche" })
```

**WHY**: Customer risponde sempre alla domanda PIÙ RECENTE, non a quelle vecchie. Se c'è una conferma da dare, è per l'ultimo task proposto.

**IMPLEMENTATION**:

- ✅ Aggiungere questa regola esplicita in Router Agent prompt (sezione "Special Cases")
- ✅ Mostrare esempio ❌ WRONG che usa messaggio vecchio
- ✅ Mostrare esempio ✅ CORRECT che usa messaggio più recente
- ✅ Usare keyword "CRITICAL RULE" per enfatizzare importanza
- ❌ NO codice custom - LLM deve capire dal prompt!

---

## 🏛️ REGOLA VIII: Product Selection Flow Pattern

**RULE**: Quando customer seleziona un prodotto da una lista numerata, il Router Agent DEVE delegare a **productSearchAgent** per mostrare dettagli completi (Format C), NON direttamente a cartManagementAgent.

**CORRECT FLOW**:

1. Customer: "che formaggi avete?"
2. Router → **productSearchAgent** (mostra lista con numeri)
3. ProductSearch mostra: "1. Parmigiano 2. Grana 3. Pecorino"
4. Customer: "2"
5. Router → **productSearchAgent** (CONFERMA selezione #2) ← **CRITICAL!**
6. ProductSearch mostra **Format C** (8 campi obbligatori: code, description, price, stock, supplier, region, certs, allergens)
7. ProductSearch chiede: "Vuoi aggiungerlo al carrello?"
8. Customer: "si"
9. Router → **cartManagementAgent** (aggiungi prodotto)

**FORBIDDEN FLOW**:

❌ **WRONG**: Skip product details step

1. ProductSearch mostra: "1. Parmigiano 2. Grana 3. Pecorino"
2. Customer: "2"
3. Router → **cartManagementAgent** directly ← **WRONG!** Skips Format C!
4. Cart asks: "Vuoi aggiungere Grana?"
5. Customer never sees full product details (supplier, region, certs, allergens)

**EXAMPLES TO UPDATE IN ROUTER PROMPT**:

**Example 4: Product Selection from List** (MUST UPDATE THIS!)

```markdown
### Example 4: Product Selection from List ✅ CORRECT FLOW
```

History:

- Assistant: "Ecco 3 formaggi: 1. Parmigiano (PARM-001) 2. Grana (GRAN-001) 3. Pecorino (PEC-001)"
- Customer: "1"

→ productSearchAgent({
query: "L'utente CONFERMA la selezione del prodotto numero 1: Parmigiano Reggiano DOP (PARM-001)"
})

🚨 **CRITICAL**: Delegate to productSearchAgent, NOT cartManagementAgent!
Product Search will show Format C (8 fields) BEFORE asking cart confirmation.

````

❌ **EXAMPLE TO ADD - WRONG PATTERN**:
```markdown
### ❌ ANTI-PATTERN: Skipping Product Details
````

History:

- Assistant: "Ecco 3 formaggi: 1. Parmigiano (PARM-001) 2. Grana (GRAN-001) 3. Pecorino (PEC-001)"
- Customer: "2"

→ cartManagementAgent({ query: "aggiungi Grana" }) ❌ WRONG!

**WHY WRONG**: Customer never sees Format C with:

- Supplier name
- Region of origin
- DOP/IGP certifications
- Allergen information
- Full product description
- Stock availability
- Actual price with discount

**CORRECT**: Delegate to productSearchAgent first, THEN Cart after details shown!

````

**WHY THIS RULE**:

- Product Search Agent prompt **requires Format C** (8 mandatory fields) before cart question
- Customer has right to see full product details (supplier, region, certs) before buying
- Transparency requirement: show allergens, certifications, origin
- Better UX: customer makes informed decision with all details

**IMPLEMENTATION**:

- ✅ Update Router Agent Example 4 with ✅ CORRECT pattern
- ✅ Add new ❌ WRONG anti-pattern example showing skip
- ✅ Add "CRITICAL" keyword to emphasize this rule
- ✅ Explain WHY (Format C requirement, transparency, UX)
- ❌ NO code changes needed - pure prompt engineering!

---

## 🏛️ REGOLA IX: Prompt Writing Best Practices

**RULE**: Ogni prompt agent DEVE seguire queste convenzioni per massimizzare comprensione LLM e ridurre errori.

### 9.1 Usa Pattern ✅ CORRECT / ❌ WRONG

**MANDATORY**: Per ogni comportamento critico, mostrare ENTRAMBI i pattern:

```markdown
❌ **WRONG**: [Descrizione comportamento sbagliato]
```javascript
// Codice esempio SBAGLIATO con commento che spiega perché
customerFunction({ wrong: "params" }) // ❌ Problema: manca context!
````

✅ **CORRECT**: [Descrizione comportamento corretto]

```javascript
// Codice esempio CORRETTO con spiegazione
customerFunction({
  query: "L'utente CONFERMA che...", // ✅ Context esplicito
})
```

**WHY**: LLM impara meglio vedendo contrasto tra giusto/sbagliato. Pattern ❌/✅ crea memoria visiva forte.

### 9.2 Usa Keyword CRITICAL, MANDATORY, FORBIDDEN

**USAGE**:

- `🚨 **CRITICAL**:` - Regola che se violata causa bug gravi
- `**MANDATORY**:` - Comportamento obbligatorio, no eccezioni
- `❌ **FORBIDDEN**:` - Pattern da NON usare mai

**EXAMPLES**:

```markdown
🚨 **CRITICAL RULE**: ALWAYS use the MOST RECENT assistant message for context!

**MANDATORY FLOW**:

1. Step A
2. Step B
3. Step C

❌ **FORBIDDEN**: Never skip Step B!
```

**WHY**: Keyword forti catturano attenzione LLM e enfatizzano importanza regola.

### 9.3 Numera Esempi e Usa Titoli Descrittivi

**PATTERN**:

```markdown
### Example 1: Short Reply Confirmation ✅

### Example 2: Product Selection from List ✅

### Example 3: Frustration Detection (P1 Priority) ✅

### ❌ ANTI-PATTERN: Skipping Context Interpretation
```

**WHY**:

- Titoli descrittivi permettono LLM di mappare situazione reale a esempio
- Numerazione sequenziale crea ordine logico
- ✅/❌ emoji rendono chiaro pattern positivo vs negativo

### 9.4 Spiega il "WHY" dopo Ogni Regola

**PATTERN**:

```markdown
**RULE**: [Cosa fare]

**WHY**: [Perché questa regola esiste]

- Benefit 1
- Benefit 2
- Problema evitato
```

**EXAMPLE**:

```markdown
**RULE**: Delegate product selection to productSearchAgent first

**WHY**:

- Product Search shows Format C (8 mandatory fields)
- Customer needs full details before buying
- Transparency requirement (allergens, certs, origin)
- Better UX: informed decision
```

**WHY THIS PATTERN**: LLM capisce meglio PERCHÉ una regola esiste, non solo COSA fare. Motivazione rinforza memoria.

### 9.5 Usa Sezioni "Special Cases" per Edge Cases

**STRUCTURE**:

```markdown
## How to Route (comportamento normale)

## Special Cases (eccezioni e pattern critici)

### 1. Frustration Detection (PRIORITY 1 - HIGHEST)

### 2. Short Replies Need Context Interpretation

### 3. Product Selection Flow Pattern
```

**WHY**: Separare "normal flow" da "edge cases" aiuta LLM a capire:

- Comportamento default (How to Route)
- Eccezioni e override (Special Cases)

### 9.6 Includi Token Usage nella Documentazione

**PATTERN**:

```markdown
**Variable**: {{PRODUCTS}}
**Typical Size**: ~50,000 tokens (500 products × 100 tokens each)
**Usage**: Max once per prompt (see REGOLA II)
```

**WHY**: LLM capisce impatto performance e può evitare pattern costosi.

---

## 📋 IMPLEMENTATION CHECKLIST

Prima di implementare, verificare:

- [ ] `agent-functions.config.ts` esiste e definisce TUTTE le funzioni
- [ ] `llm.service.ts` usa `agent-functions.config.ts` (no hardcoded)
- [ ] Database seed popola `availableFunctions` da config file
- [ ] API endpoint espone funzioni disponibili per frontend
- [ ] Frontend `/agents` legge da API (no placeholder)
- [ ] `welcomeMessage` e `wipMessage` sono stringhe semplici (no JSON)
- [ ] Admin UI usa `<textarea>` per welcome/wip (no JSON editor)
- [ ] Seed data ha stringhe semplici per welcome/wip
- [ ] Ogni variabile appare max 1 volta per prompt
- [ ] Router Agent ha solo orchestrazione (no business logic)
- [ ] **Tutti gli agent prompt hanno sezione "FORBIDDEN BASIC RESPONSES"**
- [ ] **Ogni agent ha esempi ❌ WRONG / ✅ CORRECT**
- [ ] **Minimum response length definita per ogni agent**
- [ ] **Router prompt ha "Short Replies Context Interpretation" rule (REGOLA VII)**
- [ ] **Router Example 4 mostra product selection → productSearchAgent (REGOLA VIII)**
- [ ] **Ogni regola critica ha keyword CRITICAL/MANDATORY/FORBIDDEN (REGOLA IX)**
- [ ] **Ogni esempio ha titolo descrittivo e emoji ✅/❌ (REGOLA IX)**
- [ ] **Ogni regola spiega "WHY" dopo il "WHAT" (REGOLA IX)**

---

## 🏛️ REGOLA X: Valid Link Tokens Only

**RULE**: Agents DEVONO usare SOLO i token link validi definiti nel sistema. MAI inventare o usare token deprecati.

**VALID TOKENS** (✅ ALLOWED):

- `LINK_CHECKOUT_WITH_TOKEN` - Link to cart/checkout page (step 1)
- `LINK_CHECKOUT_CONFIRM` - Link to checkout confirmation page (step 2)
- `LINK_PROFILE_WITH_TOKEN` - Link to customer profile page
- `LINK_CATALOG` - Link to PDF catalog (static URL with shortening)

**INVALID/DEPRECATED TOKENS** (❌ FORBIDDEN):

- ❌ `LINK_CART` - Does NOT exist! Use `LINK_CHECKOUT_WITH_TOKEN` instead
- ❌ `LINK_ORDER` - Does NOT exist! Show order details inline instead
- ❌ Any other token not in VALID list above

**WHY**:

- `link-replacement.service.ts` only recognizes the 5 valid tokens
- Invalid tokens are NOT replaced → customer sees raw `[LINK_CART]` text
- Causes confusion and broken user experience

**ENFORCEMENT**:

- Prompt validation must check for invalid tokens
- Runtime warnings in LinkReplacementService
- Seed validation script rejects invalid tokens

**EXAMPLES**:

❌ **WRONG** (Cart Agent using deprecated token):

```markdown
✅ Ho aggiunto **Parmigiano** al carrello!

🛒 Vedi il tuo carrello: [LINK_CART] ← Invalid! Not replaced!

Totale: €15.00
```

✅ **CORRECT** (Cart Agent using valid token):

```markdown
✅ Ho aggiunto **Parmigiano** al carrello!

🛒 Vedi il tuo carrello: [LINK_CHECKOUT_WITH_TOKEN] ← Valid! Replaced with secure link

Totale: €15.00
```

---

## 🏛️ REGOLA XI: Single Item List Pattern (WITH FULL DETAILS!)

**RULE**: Quando Product Search Agent trova **UN SOLO PRODOTTO** che corrisponde alla ricerca, DEVE mostrare **Format C completo** (tutti gli 8 campi obbligatori) e poi chiedere DIRETTAMENTE conferma carrello.

**RATIONALE**: Con 1 prodotto, cliente ha bisogno di TUTTE le informazioni (prezzo, stock, descrizione, fornitore, regione, certificazioni, allergeni) prima di decidere. Solo nome + domanda carrello è insufficiente!

**PATTERN DETECTION**:

- Se risultato ricerca = 1 prodotto → **Format C completo** (8 campi) + domanda carrello
- Se risultato ricerca > 1 prodotto → Lista numerata compatta + "Quale preferisci?"

**MANDATORY LOGIC**:

```markdown
## 🎯 SINGLE ITEM DETECTION (REGOLA XI - CRITICAL!)

**When search returns ONLY 1 product**, you MUST:

1. ✅ Show product details (Format A or Format C based on context)
2. ✅ **SKIP** "Quale preferisci?" question (there's no choice!)
3. ✅ **ASK DIRECTLY**: "Vuoi aggiungerlo al carrello?" or similar cart confirmation

**When search returns 2+ products**, you MUST:

1. ✅ Show numbered list (Format A)
2. ✅ Ask: "Quale preferisci?" or "Dimmi il numero!"
3. ✅ Wait for customer selection (1-9)
```

**EXAMPLES TO INCLUDE IN PRODUCT SEARCH PROMPT**:

❌ **WRONG** (1 product, asks "Quale preferisci?"):

```markdown
Customer: "avete la mozzarella?"
Agent: "Ecco i formaggi freschi disponibili:

1. Mozzarella di Bufala Campana DOP 250g - €7.80

Quale preferisci? �" ← WRONG! Only 1 item, no choice!
```

✅ **CORRECT** (1 product, asks cart confirmation directly):

```markdown
Customer: "avete la mozzarella?"
Agent: "Ciao {{nome}}! Ecco cosa abbiamo:

**Mozzarella di Bufala Campana DOP 250g** (MOZZ-001)
€7.80 💰 (10% discount already applied)
Stock: ✅ 25 available

Mozzarella fresca di latte di bufala dalla Campania, bianca porcellana con un interno cremoso.

Vuoi aggiungerla al carrello? 🛒" ← CORRECT! Direct cart question
```

✅ **CORRECT** (2+ products, asks "Quale preferisci?"):

```markdown
Customer: "che formaggi avete?"
Agent: "Ciao {{nome}}! Ecco i formaggi disponibili:

1. Mozzarella di Bufala DOP - €7.80
2. Parmigiano Reggiano DOP - €18.50
3. Pecorino Romano DOP - €6.20

Quale preferisci? Dimmi il numero! 🛒" ← CORRECT! Multiple items, ask choice
```

**WHY THIS RULE**:

- ✅ Better UX: No redundant "quale?" with 1 option
- ✅ Faster checkout: Direct cart question saves 1 interaction
- ✅ More natural: Mimics human shop assistant behavior
- ✅ Less confusion: Customer doesn't need to type "1" when it's obvious

**IMPLEMENTATION**:

- ✅ Add "SINGLE ITEM DETECTION" section in Product Search Agent prompt
- ✅ Show both patterns (1 item vs 2+ items) with ✅/❌ examples
- ✅ Use conditional logic: `if (results.length === 1) → cart question, else → selection question`
- ❌ NO code changes - pure prompt engineering!

---

## �🚨 VIOLATIONS TO AVOID

❌ **NO**: Funzioni hardcoded in `llm.service.ts` getAvailableFunctions()  
✅ **YES**: Funzioni da `agent-functions.config.ts`

❌ **NO**: Frontend mostra funzioni placeholder  
✅ **YES**: Frontend legge funzioni reali da API

❌ **NO**: welcomeMessage come JSON object `{en: "", it: ""}`  
✅ **YES**: welcomeMessage come stringa semplice "Welcome..."

❌ **NO**: `{{SERVICES}}` due volte nello stesso prompt  
✅ **YES**: `{{SERVICES}}` max una volta per prompt

❌ **NO**: Router Agent gestisce logica prodotti  
✅ **YES**: Router Agent delega a Product Search Agent

❌ **NO**: Router usa primo messaggio in history per contestualizzare "SI"  
✅ **YES**: Router usa ULTIMO/più recente messaggio (REGOLA VII)

❌ **NO**: Router delega selezione prodotto direttamente a Cart (salta Format C)  
✅ **YES**: Router delega a Product Search per mostrare dettagli completi (REGOLA VIII)

❌ **NO**: Prompt senza esempi ❌ WRONG / ✅ CORRECT  
✅ **YES**: Ogni pattern critico mostra entrambi (REGOLA IX)

❌ **NO**: Regole senza spiegazione "WHY"  
✅ **YES**: Ogni regola spiega motivazione e benefici (REGOLA IX)

❌ **NO**: Token link non validi come `[LINK_CART]`  
✅ **YES**: Solo token validi: LINK_CHECKOUT_WITH_TOKEN, LINK_CHECKOUT_CONFIRM, LINK_PROFILE_WITH_TOKEN, LINK_CATALOG (REGOLA X)

❌ **NO**: Chiedere "Quale preferisci?" con 1 solo prodotto  
✅ **YES**: Con 1 prodotto → domanda carrello diretta; con 2+ → lista numerata (REGOLA XI)

❌ **NO**: Cercare intera categoria quando cliente chiede prodotto specifico  
✅ **YES**: "avete la mozzarella?" → SOLO mozzarella, NON ricotta/burrata (REGOLA XII)

❌ **NO**: Rispondere senza product code visibile nel testo  
✅ **YES**: "(MOZZ-001) Mozzarella..." o "Codice: (MOZZ-001)" SEMPRE visibile (REGOLA XIII)

---

## 🏛️ REGOLA XII: Exact Product Name Matching

**RULE**: Quando customer cerca UN PRODOTTO SPECIFICO per nome, Product Search Agent DEVE cercare SOLO quel prodotto, NON tutta la categoria.

**RATIONALE**: Se cliente chiede "avete la mozzarella?", vuole SOLO mozzarella, non ricotta, burrata, o altri formaggi freschi della stessa categoria.

**PATTERN DETECTION**:

**Ricerca SPECIFICA** (cerca solo quel prodotto):

- "avete la mozzarella?" → Cerca SOLO "mozzarella" nel nome
- "vorrei il parmigiano" → Cerca SOLO "parmigiano" nel nome
- "mi serve olio d'oliva" → Cerca SOLO "olio" nel nome

**Ricerca GENERICA** (mostra categoria):

- "che formaggi avete?" → Mostra tutti i formaggi (categoria)
- "cosa avete di fresco?" → Mostra categoria "Formaggi Freschi"
- "novità?" → Mostra prodotti recenti

**EXAMPLES**:

❌ **WRONG** (specific product → returns entire category):

```markdown
Customer: "avete la mozzarella?"
Agent: "Ecco i formaggi freschi:

1. Mozzarella di Bufala DOP - €7.80
2. Ricotta Fresca - €4.50 ← WRONG! Customer didn't ask for ricotta!
3. Burrata Campana - €8.50 ← WRONG! Customer didn't ask for burrata!

Quale preferisci?"
```

**WHY WRONG**: Customer asked for "mozzarella" specifically, not all fresh cheeses. Ricotta and Burrata are NOT mozzarella!

✅ **CORRECT** (specific product → returns ONLY that product):

```markdown
Customer: "avete la mozzarella?"
Agent: "Ciao {{nome}}! Ecco cosa abbiamo:

**Mozzarella di Bufala Campana DOP 250g** (MOZZ-001)
€7.80 💰
Stock: ✅ 25 available

Mozzarella fresca di latte di bufala dalla Campania.

Vuoi aggiungerla al carrello? 🛒" ← CORRECT! Only mozzarella, direct cart question
```

✅ **CORRECT** (generic question → returns category):

```markdown
Customer: "che formaggi freschi avete?"
Agent: "Ciao {{nome}}! Ecco i formaggi freschi:

1. **Mozzarella di Bufala DOP** - €7.80
2. **Ricotta Fresca** - €4.50
3. **Burrata Campana** - €8.50

A quale sei interessato? 🛒" ← CORRECT! Generic = show category
```

**WHY THIS RULE**:

- ✅ **Relevance**: Show only what customer asked for
- ✅ **No confusion**: Don't mix similar products from same category
- ✅ **Faster UX**: 1 result → direct cart question (REGOLA XI)
- ✅ **Natural**: Human assistant shows mozzarella, not ricotta

**IMPLEMENTATION**:

- ✅ Add section in Product Search Agent prompt
- ✅ Show ❌ WRONG / ✅ CORRECT examples
- ❌ NO code changes - prompt engineering!

---

❌ **NO**: Cercare intera categoria quando cliente chiede prodotto specifico  
✅ **YES**: "avete la mozzarella?" → SOLO mozzarella, NON ricotta/burrata (REGOLA XII)

---

## REGOLA XIII: Product Code Visibility in Responses

**STATUS**: ✅ ACTIVE  
**APPLIES TO**: Product Search Agent (PRODUCT_SEARCH)  
**PRIORITY**: 🔴 CRITICAL  
**CATEGORY**: Response Format / Cart Integration

### THE RULE

**ALL responses mentioning products MUST include the product code (in parentheses)**

**WHY**: Cart Agent extracts product code from conversation history to call `addToCart(productCode)`. Without the code visible in the response, Cart Agent cannot add the product to cart (resulting in "Product not found" errors).

**MANDATORY FORMAT**:

```
Product Name (PRODUCT-CODE)
```

**EXAMPLES**:

❌ **WRONG** (NO product code visible):

```markdown
Customer: "avete la mozzarella?"
Agent: "Hai disponibile Mozzarella di Bufala Campana DOP 250g a €7.80.

Vuoi aggiungerla al tuo carrello?" ← WRONG! No code!

Customer: "si"
Cart Agent: [ERROR] "Product with code 6f3218dd-6b6d-4a6a-a93a-6082ebc7e933 not found"
↑ UUID instead of productCode because code wasn't in response!
```

**WHY WRONG**: Cart Agent cannot extract productCode from conversation history, uses UUID instead, fails to add to cart.

✅ **CORRECT** (product code visible):

```markdown
Customer: "avete la mozzarella?"
Agent: "Hai disponibile **(MOZZ-001) Mozzarella di Bufala Campana DOP 250g** a €7.80.

Vuoi aggiungerla al tuo carrello?" ← CORRECT! Code is (MOZZ-001)

Customer: "si"
Cart Agent: [SUCCESS] Extracts "MOZZ-001" from history → addToCart(MOZZ-001) → Product added! ✅
```

✅ **CORRECT** (Format C - full product card):

```markdown
**Mozzarella di Bufala Campana DOP 250g**
• Codice: (MOZZ-001) ← MUST be visible!
• Prezzo: ~€8.00~ → €7.80 💰
• Stock: ✅ 25 disponibili
• Descrizione: Mozzarella fresca di latte di bufala dalla Campania
• Fornitore: Caseificio Rossi
• Regione: Campania
• Certificazioni: DOP
• Allergeni: Latte

Vuoi aggiungerla al carrello?
```

✅ **CORRECT** (numbered list):

```markdown
Ecco i formaggi freschi:

1. **(MOZZ-001) Mozzarella di Bufala DOP 250g** - €7.80 ← Code visible!
2. **(RIC-001) Ricotta Fresca 500g** - €4.50 ← Code visible!
3. **(BUR-001) Burrata Campana 200g** - €8.50 ← Code visible!

Quale preferisci? (Rispondi con il numero)
```

**CRITICAL REQUIREMENTS**:

1. ✅ Product code MUST be visible in EVERY product mention
2. ✅ Format: `(CODE)` with parentheses (e.g., `(MOZZ-001)`)
3. ✅ Position: Next to product name (before or after)
4. ✅ Applies to: single products, numbered lists, Format C, cart questions, confirmations
5. ❌ NEVER omit code - Cart Agent depends on it!

**WHY THIS RULE**:

- ✅ **Cart Integration**: Enables seamless cart addition flow
- ✅ **Prevents Errors**: Avoids "Product not found" when user confirms
- ✅ **Traceability**: User and agent both know exact product being discussed
- ✅ **No UUID Leakage**: Code is human-readable (MOZZ-001), not UUID (6f3218dd-...)

**IMPLEMENTATION**:

- ✅ Add section in Product Search Agent prompt
- ✅ Update REGOLA VI (ABSOLUTE PRIORITY) to include code as mandatory field
- ✅ Show ❌ WRONG / ✅ CORRECT examples
- ❌ NO code changes - prompt engineering!

**FLOW EXAMPLE** (end-to-end):

```
1. Customer: "avete la mozzarella?"

2. Product Search Agent responds:
   "Hai disponibile (MOZZ-001) Mozzarella di Bufala Campana DOP 250g a €7.80.
   Vuoi aggiungerla al tuo carrello?"
   ↑ Code (MOZZ-001) is visible in response

3. Customer: "si"

4. Router Agent:
   - Reads conversation history (LAST assistant message)
   - Finds: "(MOZZ-001)" in previous response
   - Extracts: productCode = "MOZZ-001"
   - Delegates to Cart Agent with: "Utente conferma di voler aggiungere 1 prodotto mozzarella: MOZZ-001"
   ↑ Router does the extraction work!

5. Cart Agent:
   - Receives: "Utente conferma di voler aggiungere 1 prodotto mozzarella: MOZZ-001"
   - Extracts: productCode = "MOZZ-001" (from delegation query)
   - Calls: addToCart(productId: "MOZZ-001", quantity: 1)

6. Backend:
   - findByProductCode("MOZZ-001") → Found! ✅
   - Result: Product added to cart successfully!
```

**KEY RESPONSIBILITIES**:

- ✅ **Product Search Agent**: Show product code in ALL responses (REGOLA XIII)
- ✅ **Router Agent**: Extract product code and pass to Cart Agent explicitly
- ✅ **Cart Agent**: Use product code from delegation query to call addToCart
- ✅ **Backend**: Validate productCode and add to cart

---

**Violazione Tipica**: "Hai disponibile Mozzarella di Bufala Campana DOP 250g a €7.80. Vuoi aggiungerla?" ← NO CODE!

❌ **NO**: Rispondere senza product code visibile  
✅ **YES**: "(MOZZ-001) Mozzarella di Bufala..." o "Codice: (MOZZ-001)" sempre visibile!

---

## 🏛️ REGOLA XIV: Examples Must Be Explicitly Labeled (NO FAKE DATA!)

**RULE**: Ogni esempio nei prompt DEVE essere chiaramente marcato come "FAKE", "EXAMPLE ONLY", "ILLUSTRATIVE" per evitare che l'LLM copi i dati degli esempi invece di usare dati reali.

**RATIONALE**: LLM non capisce automaticamente che un esempio è illustrativo. Senza label esplicite, l'LLM può confondere esempio con realtà e copiare dati fake (es. product codes, phone numbers, order IDs).

**CRITICAL INCIDENT** (BUG #11):

```markdown
❌ **WHAT HAPPENED**:

- Product Search Agent prompt aveva esempi con code "MOZZ-001", "PARM-001"
- Database reale aveva code "FORMAG-003", "PARM-002"
- LLM ha copiato "MOZZ-001" dall'esempio invece di estrarre "FORMAG-003" da {{PRODUCTS}}
- Cart Agent ricevuto code fake → "Product not found" error
- User reaction: "molto ma molto ma molto male amico mio !!!"

❌ **ROOT CAUSE**: Prompt non specificava che MOZZ-001 era FAKE, solo esempio

- LLM ha pensato: "MOZZ-001 è un codice valido, lo uso"
- Non ha capito che doveva leggere da {{PRODUCTS}} variabile
```

**MANDATORY LABELING PATTERNS**:

### Pattern 1: Warning Banner Above Examples Section

```markdown
⚠️ **CRITICAL WARNING - EXAMPLES BELOW CONTAIN FAKE DATA** ⚠️

All product codes, phone numbers, order IDs, customer names shown in the examples below are FAKE and for ILLUSTRATION ONLY.

**YOU MUST**:

- ✅ Read REAL data from {{PRODUCTS}}, {{SERVICES}}, {{CUSTOMERS}} variables
- ✅ Extract codes/IDs from variable content, NOT from examples
- ❌ NEVER copy codes/names/IDs from examples below

---

### EXAMPLES (FAKE DATA - DO NOT COPY!)

Example 1: Product search with mozzarella
...
(MOZZ-001) Mozzarella... ← FAKE CODE! Real code in {{PRODUCTS}}
```

### Pattern 2: Inline Labels on Each Fake Data Point

```markdown
✅ **CORRECT**:
Agent: "**Mozzarella di Bufala DOP** (MOZZ-001) ← ⚠️ FAKE CODE - example only!
€7.80

Vuoi aggiungerla?"

**HOW TO GET REAL CODE**:

1. Read {{PRODUCTS}} variable: `• FORMAG-003 Mozzarella di Bufala...`
2. Extract code: FORMAG-003
3. Use in response: `(FORMAG-003) Mozzarella...` ← Real code!
```

### Pattern 3: Side-by-Side Comparison (Fake vs Real)

````markdown
❌ **WRONG** (using fake example data):

```javascript
addToCart({ code: "MOZZ-001" }) // ← FAKE CODE from examples!
// Result: Product not found ❌
```
````

✅ **CORRECT** (using real data from {{PRODUCTS}}):

```javascript
// {{PRODUCTS}} contains: "• FORMAG-003 Mozzarella di Bufala..."
addToCart({ code: "FORMAG-003" }) // ← REAL CODE from variable!
// Result: Product added successfully ✅
```

**WHY DIFFERENT**: Example codes (MOZZ-001) don't exist in database!
Only codes from {{PRODUCTS}} variable are valid.

````

**MANDATORY SECTIONS IN EVERY AGENT PROMPT**:

1. **"CRITICAL - DATA SOURCES"** section at TOP of prompt:
```markdown
## 🚨 CRITICAL - DATA SOURCES

**ALL data MUST come from these variables**:
- {{PRODUCTS}} - Real product codes, names, prices (NOT from examples!)
- {{SERVICES}} - Real service codes (NOT from examples!)
- {{CUSTOMERS}} - Real customer data (NOT from examples!)

**EXAMPLES in this prompt use FAKE data** (MOZZ-001, PARM-001, +39-123-456, etc.)
- These are for ILLUSTRATION ONLY
- NEVER copy codes/IDs/phones from examples
- ALWAYS extract from {{VARIABLES}}
````

2. **Warning labels on EVERY example** with fake data:

```markdown
Example 1: Single product response
Agent: "(MOZZ-001) Mozzarella..." ← ⚠️ FAKE! Use real code from {{PRODUCTS}}

Example 2: Cart addition
addToCart("PARM-001") ← ⚠️ FAKE CODE - example only!
```

3. **"HOW TO EXTRACT REAL DATA"** instructions:

```markdown
## HOW TO EXTRACT REAL PRODUCT CODE

**Step-by-step**:

1. Read {{PRODUCTS}} variable
2. Find product matching customer query
3. Extract code from format: `• CODE ProductName...`
4. Use EXACT code in response

**Example extraction**:
{{PRODUCTS}} contains: `• FORMAG-003 Mozzarella di Bufala Campana DOP 250g...`
↑ This is the REAL code
Extract: FORMAG-003
Use in response: "(FORMAG-003) Mozzarella di Bufala..."
```

**ENFORCEMENT**:

- ✅ Prompt validation script checks for warning banners
- ✅ Every example with fake data MUST have ⚠️ label
- ✅ "CRITICAL - DATA SOURCES" section MANDATORY at top of prompt
- ✅ Code review rejects prompts without fake data labels
- ❌ NEVER assume LLM understands "it's just an example"

**EXAMPLES OF FAKE DATA TO LABEL**:

- Product codes: MOZZ-001, PARM-001, SALUMI-003
- Phone numbers: +39-123-456-789, +39-333-444-5555
- Order IDs: ORD-12345, ORD-99999
- Customer names: Mario Rossi, Giulia Bianchi
- Emails: mario@example.com, test@test.it
- Addresses: Via Roma 123, Piazza Italia 45
- Any other placeholder data in examples

**WHY THIS RULE**:

- ✅ **Prevents data confusion**: LLM knows example ≠ reality
- ✅ **Reduces errors**: No more "Product MOZZ-001 not found"
- ✅ **Clear instructions**: LLM knows WHERE to get real data ({{VARIABLES}})
- ✅ **Better prompts**: Explicit > implicit assumptions
- ✅ **Saves debugging time**: Andrea doesn't have to fix fake data bugs!

**IMPLEMENTATION CHECKLIST**:

- [ ] Add "🚨 CRITICAL - DATA SOURCES" section at TOP of every agent prompt
- [ ] Add warning banner above examples section
- [ ] Label EVERY fake code/ID/name with ⚠️ "FAKE - example only!"
- [ ] Add "HOW TO EXTRACT REAL DATA" instructions
- [ ] Show side-by-side ❌ WRONG (fake) vs ✅ CORRECT (real) comparisons
- [ ] Update all 7 agent prompts (Router, Product Search, Cart, Orders, Support, Profile, Safety)
- [ ] Create prompt validation script to enforce labeling
- [ ] Add to seed validation: reject prompts without warnings

**ANTI-PATTERN TO AVOID**:

❌ **WRONG** (assuming LLM understands):

```markdown
Example: Customer asks for mozzarella
Agent responds with: "(MOZZ-001) Mozzarella..."
```

→ NO warning that MOZZ-001 is fake!
→ LLM thinks MOZZ-001 is valid code!
→ Copies MOZZ-001 instead of reading {{PRODUCTS}}!

✅ **CORRECT** (explicit labeling):

```markdown
⚠️ **WARNING**: Example below uses FAKE code (MOZZ-001)
Real codes come from {{PRODUCTS}} variable (e.g., FORMAG-003)

Example: Customer asks for mozzarella
Agent responds with: "(MOZZ-001) Mozzarella..." ← ⚠️ FAKE CODE - example only!

**HOW TO GET REAL CODE**:
Read {{PRODUCTS}}: `• FORMAG-003 Mozzarella...`
Extract: FORMAG-003
Use: "(FORMAG-003) Mozzarella..." ← Real code!
```

---

## 🏛️ REGOLA XV: Discount Display Format (Clean Price Lists)

**RULE**: Quando Product Search Agent mostra liste di prodotti con sconto, NON ripetere "(X% sconto)" o "(X% OFF)" su ogni riga. Mostrare la nota di sconto UNA SOLA VOLTA alla fine della lista.

**RATIONALE**: Ripetere "(10% DI SCONTO)" su ogni prodotto rende la lista verbosa e difficile da leggere. Il cliente sa già che ha uno sconto - basta ricordarglielo una volta alla fine.

**MANDATORY PATTERN**:

### Product Lists (2+ products):

```markdown
Ecco i [CATEGORY] disponibili:

1. **Torrone di Cremona IGP 200g** (DOLCI-004) ~€8.90~ → €8.10
2. **Pandoro Veronese 750g** (DOLCI-005) ~€18.50~ → €16.70
3. **Panettone Classico 1kg** (DOLCI-001) ~€22.00~ → €19.80

💰 Prezzi con sconto del {{discountUser}}% già applicato!
Quale ti interessa? (scrivi il numero) 🛒
```

### Single Product (Format C):

```markdown
**Mozzarella di Bufala Campana DOP 250g**
• Codice: (FORMAG-003)
• Prezzo: ~€8.00~ → €7.20 💰
• Stock: ✅ 25 disponibili
• Descrizione: Mozzarella fresca di latte di bufala...
• Fornitore: Caseificio Rossi
• Regione: Campania
• Certificazioni: DOP
• Allergeni: Latte

💰 Prezzo con sconto del 10% già applicato!
Vuoi aggiungerla al carrello? 🛒
```

**FORBIDDEN PATTERNS**:

❌ **WRONG** (discount repeated on each line):

```markdown
1. Torrone (DOLCI-004) €8.90 → €8.10 (10% DI SCONTO) ← NO! Troppo verboso!
2. Pandoro (DOLCI-005) €18.50 → €16.70 (10% DI SCONTO) ← NO! Ripetizione inutile!
3. Panettone (DOLCI-001) €22.00 → €19.80 (10% DI SCONTO) ← NO! Già chiaro dal prezzo scontato!
```

**WHY WRONG**:

- Cliente vede già `~€8.90~ → €8.10` = prezzo scontato chiaro
- "(10% DI SCONTO)" ripetuto 3-5-10 volte = ridondante e fastidioso
- Lista diventa troppo lunga e difficile da leggere

✅ **CORRECT** (discount shown once at the end):

```markdown
1. Torrone (DOLCI-004) ~€8.90~ → €8.10 ← Prezzo chiaro, no testo ripetuto
2. Pandoro (DOLCI-005) ~€18.50~ → €16.70
3. Panettone (DOLCI-001) ~€22.00~ → €19.80

💰 Prezzi con sconto del 10% già applicato! ← Una nota UNICA
```

**WHY CORRECT**:

- ✅ Lista pulita e leggibile
- ✅ Cliente vede sconto dai prezzi barrati (~€8.90~ → €8.10)
- ✅ Una nota finale basta per ricordare lo sconto
- ✅ Risparmio tokens (importante con liste lunghe!)

**IMPLEMENTATION**:

- ✅ Update Format B in Product Search Agent prompt
- ✅ Update Format C in Product Search Agent prompt
- ✅ Remove all "(X% sconto)" or "(X% OFF)" from product lines
- ✅ Add single note at end: "💰 Prezzi con sconto del {{discountUser}}% già applicato!"
- ❌ NO exceptions - apply to ALL product lists

**ENFORCEMENT**:

- Prompt validation checks for repeated discount text
- Seed validation rejects prompts with "(X% sconto)" on product lines
- Code review verifies discount note appears ONCE at end

---

## 📋 UPDATED IMPLEMENTATION CHECKLIST

Prima di implementare, verificare:

- [ ] `agent-functions.config.ts` esiste e definisce TUTTE le funzioni
- [ ] `llm.service.ts` usa `agent-functions.config.ts` (no hardcoded)
- [ ] Database seed popola `availableFunctions` da config file
- [ ] API endpoint espone funzioni disponibili per frontend
- [ ] Frontend `/agents` legge da API (no placeholder)
- [ ] `welcomeMessage` e `wipMessage` sono stringhe semplici (no JSON)
- [ ] Admin UI usa `<textarea>` per welcome/wip (no JSON editor)
- [ ] Seed data ha stringhe semplici per welcome/wip
- [ ] Ogni variabile appare max 1 volta per prompt
- [ ] Router Agent ha solo orchestrazione (no business logic)
- [ ] **Tutti gli agent prompt hanno sezione "FORBIDDEN BASIC RESPONSES"**
- [ ] **Ogni agent ha esempi ❌ WRONG / ✅ CORRECT**
- [ ] **Minimum response length definita per ogni agent**
- [ ] **Router prompt ha "Short Replies Context Interpretation" rule (REGOLA VII)**
- [ ] **Router Example 4 mostra product selection → productSearchAgent (REGOLA VIII)**
- [ ] **Ogni regola critica ha keyword CRITICAL/MANDATORY/FORBIDDEN (REGOLA IX)**
- [ ] **Ogni esempio ha titolo descrittivo e emoji ✅/❌ (REGOLA IX)**
- [ ] **Ogni regola spiega "WHY" dopo il "WHAT" (REGOLA IX)**
- [ ] **⚠️ OGNI ESEMPIO CON DATI FAKE HA LABEL ESPLICITA (REGOLA XIV)**
- [ ] **⚠️ OGNI PROMPT HA "CRITICAL - DATA SOURCES" SECTION (REGOLA XIV)**
- [ ] **⚠️ OGNI PROMPT HA "HOW TO EXTRACT REAL DATA" INSTRUCTIONS (REGOLA XIV)**

---

## 🚨 VIOLATIONS TO AVOID

❌ **NO**: Funzioni hardcoded in `llm.service.ts` getAvailableFunctions()  
✅ **YES**: Funzioni da `agent-functions.config.ts`

❌ **NO**: Frontend mostra funzioni placeholder  
✅ **YES**: Frontend legge funzioni reali da API

❌ **NO**: welcomeMessage come JSON object `{en: "", it: ""}`  
✅ **YES**: welcomeMessage come stringa semplice "Welcome..."

❌ **NO**: `{{SERVICES}}` due volte nello stesso prompt  
✅ **YES**: `{{SERVICES}}` max una volta per prompt

❌ **NO**: Router Agent gestisce logica prodotti  
✅ **YES**: Router Agent delega a Product Search Agent

❌ **NO**: Router usa primo messaggio in history per contestualizzare "SI"  
✅ **YES**: Router usa ULTIMO/più recente messaggio (REGOLA VII)

❌ **NO**: Router delega selezione prodotto direttamente a Cart (salta Format C)  
✅ **YES**: Router delega a Product Search per mostrare dettagli completi (REGOLA VIII)

❌ **NO**: Prompt senza esempi ❌ WRONG / ✅ CORRECT  
✅ **YES**: Ogni pattern critico mostra entrambi (REGOLA IX)

❌ **NO**: Regole senza spiegazione "WHY"  
✅ **YES**: Ogni regola spiega motivazione e benefici (REGOLA IX)

❌ **NO**: Token link non validi come `[LINK_CART]`  
✅ **YES**: Solo token validi: LINK_CHECKOUT_WITH_TOKEN, LINK_CHECKOUT_CONFIRM, LINK_PROFILE_WITH_TOKEN, LINK_CATALOG (REGOLA X)

❌ **NO**: Chiedere "Quale preferisci?" con 1 solo prodotto  
✅ **YES**: Con 1 prodotto → domanda carrello diretta; con 2+ → lista numerata (REGOLA XI)

❌ **NO**: Cercare intera categoria quando cliente chiede prodotto specifico  
✅ **YES**: "avete la mozzarella?" → SOLO mozzarella, NON ricotta/burrata (REGOLA XII)

❌ **NO**: Rispondere senza product code visibile nel testo  
✅ **YES**: "(MOZZ-001) Mozzarella..." o "Codice: (MOZZ-001)" SEMPRE visibile (REGOLA XIII)

❌ **NO**: Esempi con dati fake SENZA label "⚠️ FAKE - example only!"  
✅ **YES**: OGNI esempio con code/ID/nome fake DEVE avere warning esplicito (REGOLA XIV)

❌ **NO**: Prompt senza "CRITICAL - DATA SOURCES" section  
✅ **YES**: OGNI prompt specifica che dati vengono da {{VARIABLES}}, non da esempi (REGOLA XIV)

❌ **NO**: Assumere che LLM capisca "è solo un esempio"  
✅ **YES**: Esplicitare con warning banner e label inline su OGNI dato fake (REGOLA XIV)

❌ **NO**: Ripetere "(X% sconto)" o "(X% OFF)" su ogni riga di prodotto  
✅ **YES**: Mostrare nota sconto UNA VOLTA alla fine: "💰 Prezzi con sconto del X% già applicato!" (REGOLA XV)

---
