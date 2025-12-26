# Conversation History Layer - Spec

## 🎯 Obiettivo

Creare un layer centralizzato che **umanizza** le risposte tecniche degli agent, aggiungendo:
- Contesto dalla conversazione
- Personalità del bot (botIdentity)
- Regole business custom (customAiRules)
- Saluti appropriati
- Suggerimenti offerte
- Menu numerici contestuali

---

## 📐 Architettura

```
PRIMA (dispersiva):
──────────────────
botIdentity + customAI → sparsi in OGNI agent prompt
                      → duplicati
                      → inconsistenti
                      → risposte robotiche

DOPO (centralizzata):
─────────────────────
[Customer Message]
       ↓
[Intent Parser] → capisce intent
       ↓
[Agent Funzionale] → risposta TECNICA pura (solo dati strutturati)
       ↓
┌─────────────────────────────────────────────────────────┐
│  🆕 CONVERSATION HISTORY LAYER                          │
│  ────────────────────────────────────────────────────── │
│  • Legge storico conversazione                          │
│  • Applica botIdentity + customAiRules                  │
│  • Umanizza la risposta                                 │
│  • Sceglie menu numerico appropriato                    │
│  • Suggerisce offerte se opportuno                      │
└─────────────────────────────────────────────────────────┘
       ↓
[Translation Layer] → traduce nella lingua cliente
       ↓
[Customer Response]
```

---

## 📥 INPUT

```typescript
interface ConversationHistoryLayerInput {
  // Contesto conversazione
  workspaceId: string
  customerId: string
  customerName: string
  conversationHistory: ChatMessage[]  // ultimi 10-20 messaggi
  currentQuestion: string             // domanda attuale del cliente
  
  // Risposta tecnica dall'agent
  technicalResponse: {
    type: 'PRODUCT_LIST' | 'CATEGORY_LIST' | 'CART_STATUS' | 'ORDER_CONFIRMED' | 'SERVICE_LIST' | 'FAQ_ANSWER' | 'SUPPORT_REQUEST' | 'GREETING' | 'ERROR' | 'GENERIC'
    data: any           // dati strutturati (prodotti, carrello, etc.)
    rawMessage: string  // messaggio base generato dall'agent
  }
  
  // Personalità e regole (dal workspace)
  botIdentity: {
    name: string              // "Mario", "ShopBot", etc.
    personality: string       // botIdentityResponse - come deve comportarsi
  }
  customAiRules: string | null  // regole business specifiche
  
  // Contesto business
  activeOffers: Offer[]         // offerte attive per suggerimenti
  hasSalesAgents: boolean       // per personalizzare chi contatterà
  isFirstMessage: boolean       // per saluto iniziale
  
  // Stato conversazione
  lastAgentUsed: string         // quale agent ha risposto
  customerMood?: 'happy' | 'neutral' | 'frustrated' | 'confused'
}
```

---

## 📤 OUTPUT

```typescript
interface ConversationHistoryLayerOutput {
  // Messaggio finale umanizzato
  message: string
  
  // Menu numerico contestuale (opzionale)
  menu?: {
    type: 'numbered'
    options: MenuOption[]
  }
  
  // Metadata
  metadata: {
    addedGreeting: boolean
    suggestedOffers: boolean
    askedClarification: boolean
    menuType: string | null
    tokensUsed: number
  }
}
```

---

## 🧠 Logica del Layer

### 1. Saluto Iniziale
```
SE isFirstMessage = true:
  → Aggiungi saluto personalizzato con nome bot
  → "Ciao {customerName}! Sono {botName}, come posso aiutarti?"
```

### 2. Contesto dalla Conversazione
```
SE conversationHistory contiene ricerche recenti:
  → Riferisciti a cosa stava cercando
  → "Vedo che stavi guardando i formaggi..."

SE cliente ha chiesto la stessa cosa 2+ volte:
  → Riconosci la frustrazione
  → "Mi scuso se non sono stato chiaro prima..."
```

### 3. Suggerimento Offerte
```
SE activeOffers.length > 0 AND:
  - Cliente sta navigando prodotti (non checkout)
  - Non ha visto offerte negli ultimi 5 messaggi
  - Offerta è pertinente alla categoria che sta guardando
  
→ Suggerisci con naturalezza:
  "A proposito, abbiamo un'offerta speciale sui formaggi questa settimana! 🧀"
```

### 4. Menu Numerico Contestuale
```
DOPO PRODUCT_LIST → Menu: "Altro? / Carrello / Categorie"
DOPO CART_STATUS  → Menu: "Checkout / Continua shopping / Svuota"
DOPO ORDER_CONFIRMED → Menu: "Ordini / Prodotti"
DOPO ERROR → Menu: "Riprova / Supporto"
DOPO GREETING → Menu: "Prodotti / Categorie / Offerte / Ordini"
```

### 5. Richiesta Chiarimenti
```
SE currentQuestion è ambigua:
  → Non inventare, chiedi
  → "Non ho capito bene, intendi X o Y?"

SE risposta tecnica è vuota/errore:
  → Suggerisci alternative
  → "Non ho trovato nulla per 'xyz'. Prova con 'formaggio' o 'pasta'?"
```

### 6. Applicazione Personalità (botIdentity)
```
SE botIdentity.personality contiene "formale":
  → Usa "Lei", tono professionale
  
SE botIdentity.personality contiene "amichevole":
  → Usa "tu", emoji, tono colloquiale
  
SE botIdentity.personality contiene "esperto":
  → Aggiungi dettagli tecnici sui prodotti
```

### 7. Regole Custom (customAiRules)
```
Esempio customAiRules:
"Non menzionare mai la concorrenza. 
Spingi sempre i prodotti biologici.
Se chiedono spedizione, dire che è gratuita sopra €50."

→ Il layer applica queste regole SEMPRE
```

---

## 🗄️ Database: Agent Config

Nuovo record in `agentConfig`:

```sql
INSERT INTO "AgentConfig" (
  "workspaceId",
  "type",
  "name", 
  "model",
  "systemPrompt",
  "temperature",
  "maxTokens",
  "displayOrder",
  "isActive"
) VALUES (
  '{workspaceId}',
  'CONVERSATION_HISTORY',
  'Conversation History Layer',
  'openai/gpt-4o-mini',
  '{vedi prompt sotto}',
  0.7,  -- più creativo per umanizzare
  500,  -- risposta breve ma elaborata
  98,   -- prima di TRANSLATION (99)
  true
);
```

---

## 📝 System Prompt

```markdown
Sei il layer di umanizzazione delle risposte per un e-commerce via WhatsApp.

## IL TUO RUOLO
Ricevi risposte TECNICHE dagli agent e le trasformi in risposte UMANE e contestuali.

## IDENTITÀ BOT
Nome: {{botName}}
Personalità: {{botIdentity}}

## REGOLE BUSINESS
{{customAiRules}}

## INPUT CHE RICEVI
1. Storico conversazione (ultimi messaggi)
2. Domanda attuale del cliente
3. Risposta tecnica dall'agent
4. Offerte attive

## COSA DEVI FARE

### 1. SALUTO (solo se primo messaggio)
- Saluta con il nome del bot
- Sii caloroso ma non invadente

### 2. CONTESTO
- Se il cliente stava cercando qualcosa, riferisciti a quello
- Se ha già chiesto la stessa cosa, scusati per la confusione

### 3. UMANIZZA LA RISPOSTA
- Mantieni TUTTI i dati della risposta tecnica
- Aggiungi tono umano e naturale
- Non essere robotico

### 4. OFFERTE (opzionale)
- Suggerisci offerte SOLO se pertinenti
- Non ogni messaggio - max 1 volta ogni 5 messaggi
- Sii naturale: "A proposito..." / "Ti segnalo anche..."

### 5. CHIARIMENTI
- Se la domanda non è chiara, CHIEDI
- Non inventare risposte
- Suggerisci alternative

### 6. MENU FINALE
Aggiungi SEMPRE un menu numerico appropriato al contesto:

Dopo lista prodotti:
1. Vedere altre categorie
2. Vai al carrello
3. Torna al menu principale

Dopo carrello:
1. Procedi al checkout
2. Continua lo shopping
3. Svuota carrello

Dopo ordine confermato:
1. Vedere i tuoi ordini
2. Torna ai prodotti

## OUTPUT
Rispondi SOLO con il messaggio umanizzato + menu.
Non aggiungere spiegazioni o metadata.
```

---

## 🔧 Implementazione

### File: `ConversationHistoryLayer.ts`

```typescript
// apps/backend/src/application/layers/ConversationHistoryLayer.ts

export class ConversationHistoryLayer {
  constructor(private prisma: PrismaClient) {}
  
  async process(input: ConversationHistoryLayerInput): Promise<ConversationHistoryLayerOutput> {
    // 1. Load agent config from DB
    const config = await this.loadConfig(input.workspaceId)
    
    // 2. Build context for LLM
    const context = this.buildContext(input)
    
    // 3. Call LLM
    const response = await this.callLLM(config, context)
    
    // 4. Parse and return
    return this.parseResponse(response)
  }
}
```

### Integrazione in `llm-router.service.ts`

```typescript
// DOPO che l'agent funzionale risponde
const technicalResponse = await functionalAgent.process(...)

// PRIMA della traduzione
const humanizedResponse = await conversationHistoryLayer.process({
  workspaceId,
  customerId,
  customerName,
  conversationHistory: lastMessages,
  currentQuestion: message,
  technicalResponse,
  botIdentity: { name: workspace.botName, personality: workspace.botIdentityResponse },
  customAiRules: workspace.customAiRules,
  activeOffers: offers,
  hasSalesAgents: workspace.hasSalesAgents,
  isFirstMessage: messageCount === 1,
  lastAgentUsed: agentType
})

// POI traduzione
const translatedResponse = await translationAgent.process({
  message: humanizedResponse.message,
  targetLanguage: customerLanguage
})
```

---

## ✅ Checklist Implementazione

- [ ] 1. Creare `ConversationHistoryLayer.ts`
- [ ] 2. Creare interface types
- [ ] 3. Aggiungere `CONVERSATION_HISTORY` agent config nel seed
- [ ] 4. Integrare in `llm-router.service.ts`
- [ ] 5. Rimuovere botIdentity/customAI dagli altri agent prompts
- [ ] 6. Test: primo messaggio con saluto
- [ ] 7. Test: suggerimento offerte
- [ ] 8. Test: menu contestuali
- [ ] 9. Test: richiesta chiarimenti

---

## 💰 Costi Token

Stima per messaggio:
- Input: ~500 tokens (storico + risposta tecnica)
- Output: ~200 tokens (messaggio umanizzato)
- **Totale: ~700 tokens/messaggio** con gpt-4o-mini = ~€0.0001

---

## 🚀 Priorità

**ALTA** - Questo layer risolve:
1. Risposte robotiche
2. Mancanza di contesto
3. Personalità bot inconsistente
4. Menu numerici casuali
5. Offerte mai suggerite

Confermi Andrea? Procedo con l'implementazione?
