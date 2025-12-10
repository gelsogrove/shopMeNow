# 🤖 eChatbot Prompt Templates

Questa cartella contiene i template dei prompt per tutti gli agenti LLM del sistema.

## 📂 Struttura

| File | Agente | Descrizione |
|------|--------|-------------|
| `01-router.template.md` | Router Agent | Classificazione intenti, delegazione agenti, FAQ |
| `02-product-search.template.md` | Product Search Agent | Ricerca prodotti, catalogo, raggruppamento intelligente |
| `03-cart-management.template.md` | Cart Management Agent | Operazioni carrello (add/remove/update) |
| `03-order-tracking.template.md` | Order Tracking Agent | Storico ordini, tracking, checkout, conferma |
| `04-customer-support.template.md` | Customer Support Agent | Reclami, supporto, escalation operatore |
| `05-profile-management.template.md` | Profile Management Agent | Profilo cliente, notifiche push |
| `06-security.template.md` | Security Agent | Validazione sicurezza, blocco contenuti pericolosi |
| `07-translation.template.md` | **Format, Tone & Translation Agent** | **Applica tono**, formattazione WhatsApp, traduzione multilingua |
| `08-summary.template.md` | Summary Agent | Riassunto conversazioni per email |

## 🔧 Come funziona

1. I template vengono caricati da `packages/database/prisma/data/defaultAgents.ts`
2. Durante il seed, vengono inseriti nel database come `systemPrompt` per ogni agent
3. Al runtime, `PromptProcessorService` sostituisce le variabili con i valori reali

## 📝 Variabili supportate

### Customer
- `{{nameUser}}` - Nome cliente
- `{{email}}` - Email cliente
- `{{phone}}` - Telefono cliente
- `{{discountUser}}` - Sconto personale (%)
- `{{languageUser}}` - Lingua preferita (it/en/es/pt)

### Workspace
- `{{companyName}}` - Nome azienda
- `{{url}}` - URL sito web

### Bot Config
- `{{botIdentityResponse}}` - Risposta identità bot
- `{{toneOfVoice}}` - Tono comunicazione (formal/friendly/professional/casual)
- `{{customAiRules}}` - **OVERRIDE** - Regole personalizzate

### Conditionals
```handlebars
{{#if sellsProductsAndServices}}
  // Contenuto per e-commerce
{{else}}
  // Contenuto per canale informativo
{{/if}}

{{#if hasHumanSupport}}
  // Supporto umano disponibile
{{/if}}

{{#if hasSalesAgents}}
  // Agenti vendita assegnati
{{/if}}

{{#unless allowedExternalLinks}}
  // Nessun link esterno permesso
{{/unless}}
```

### Dynamic Content (usa UNA SOLA volta per prompt!)
- `{{products}}` - Catalogo prodotti completo
- `{{services}}` - Catalogo servizi
- `{{categories}}` - Lista categorie
- `{{offers}}` - Offerte attive
- `{{faq}}` - FAQ aziendali

## ⚠️ Regole importanti

1. **OVERRIDE**: `{{customAiRules}}` ha priorità ASSOLUTA su tutto
2. **UNICITÀ**: Variabili grandi (products, services, offers, categories) MAX 1 volta per prompt
3. **TOKEN**: Considera ~50k token per {{products}} - non duplicare!
4. **LINGUA**: Tutto in italiano, Translation Agent traduce al runtime
5. **TONO**: Gestito CENTRALMENTE dal Translation Agent (non dagli altri agenti)
6. **NEUTRALITÀ**: Gli altri agenti scrivono in modo neutro/professionale

## 🌡️ Temperature

| Agente | Temperature | Motivo |
|--------|-------------|--------|
| Router | 0 | Routing deterministico, nessuna creatività |
| Product Search | 0.2 | Lettura dati precisa, minima variazione |
| Cart Management | 0.2 | Operazioni consistenti |
| Order Tracking | 0.2 | Risposte precise sugli ordini |
| Customer Support | 0.2 | Empatia consistente |
| Profile Management | 0.2 | Operazioni profilo consistenti |
| Translation | 0.1 | Traduzione consistente |
| Security | 0 | Validazione deterministica |
| Summary | 0.2 | Riassunti fattuali |

## 🔄 Aggiornamento

Per aggiornare i prompt:

1. Modifica il template in questa cartella
2. Esegui il seed: `cd apps/backend && npm run seed`
3. I nuovi prompt vengono caricati nel database

**NOTA**: Le modifiche ai template NON si applicano automaticamente ai workspace esistenti.
Per aggiornare un workspace esistente, è necessario ri-eseguire il seed o aggiornare manualmente via admin.
