# LLM Formatter Architecture

## Overview

Il **LLMFormatterService** è il componente responsabile della formattazione delle risposte strutturate in linguaggio naturale. È l'unico servizio che effettua chiamate LLM per la formattazione del testo.

**File**: `apps/backend/src/application/llm-formatter/llm-formatter.service.ts`

## Principi di Design

1. **Single Responsibility**: L'LLM riceve dati strutturati e li formatta - NON prende decisioni
2. **Database-First**: La personalità del bot (`botIdentityResponse`) viene dal database, mai hardcoded
3. **Token Efficiency**: ~200-500 token per risposta (vs 5000+ nel vecchio sistema)
4. **Caching**: Template statici per risposte semplici (carrello vuoto, errori, saluti)

## System Prompt

Il prompt di sistema è **in italiano** per garantire risposte naturali nella lingua base:

```typescript
const BASE_SYSTEM_PROMPT = `Sei un assistente e-commerce. Il tuo UNICO compito è formattare i dati forniti in linguaggio naturale.

REGOLE CRITICHE:
1. NON inventare dati - usa SOLO i dati forniti
2. NON aggiungere o rimuovere elementi dalla lista
3. NON cambiare prezzi, quantità o nomi
4. Formatta in modo naturale e amichevole
5. RISPONDI SEMPRE NELLA LINGUA RICHIESTA (vedi "LINGUA OUTPUT")
6. Per il CARRELLO: usa trattini (-) NON numeri
7. Per le OPZIONI MENU: MANTIENI la numerazione esattamente come fornita
8. I PREZZI SONO FINALI - NON calcolare o menzionare sconti!

FORMATO OUTPUT:
- Carrello: prefisso trattino (- Prodotto - €XX.XX)
- Opzioni menu: mantieni numerazione (1. ✅ Azione)
- Prezzi: €XX.XX (mostra esattamente come fornito)
- Emoji: 🛒 🍷 📦 ✅ ❌ etc.

TONO: Sii caldo, amichevole e colloquiale - MAI robotico o formale!`
```

## Personalizzazione Dinamica

Il prompt viene arricchito dinamicamente con tre sezioni opzionali:

### 1. Bot Personality (`botIdentityResponse`)

```typescript
if (options?.botIdentity && options.botIdentity.trim() !== "") {
  prompt += `

## 🎭 LA TUA PERSONALITÀ (IMPORTANTISSIMO!)
Hai una personalità e uno stile di comunicazione specifico. Applicalo a COME presenti le informazioni:

${options.botIdentity}

Ricorda: Mantieni la personalità nel TONO, ma non modificare i DATI. Sii sempre caloroso e umano!`
}
```

**Fonte**: `Workspace.botIdentityResponse` dal database

### 2. Greeting (Primo Messaggio)

```typescript
if (options?.isFirstMessage && options?.customerName) {
  prompt += `

## 👋 SALUTO (Questo è il PRIMO messaggio!)
Inizia con un saluto caloroso e personalizzato:
- Rivolgiti al cliente per nome: "${options.customerName}"
- Presentati brevemente (sei ${botName})
- Poi fornisci le informazioni richieste
- Sii naturale, mai robotico!`
}
```

### 3. Custom AI Rules

```typescript
if (options?.customAiRules && options.customAiRules.trim() !== "") {
  prompt += `

## 🤖 REGOLE PERSONALIZZATE (ALTA PRIORITÀ)
Le seguenti regole sono state definite dal proprietario del negozio e hanno priorità sulle regole generali:

${options.customAiRules}`
}
```

**Fonte**: `Workspace.customAiRules` dal database

## FormatterOptions Interface

```typescript
export interface FormatterOptions {
  customAiRules?: string | null   // Regole AI personalizzate dal workspace
  botIdentity?: string | null     // Personalità del bot dal workspace
  customerName?: string           // Nome cliente per personalizzazione
  isFirstMessage?: boolean        // Se true, aggiungi saluto
  botName?: string                // Nome del bot (es. "BellItalia")
}
```

## Template Cached (No LLM)

Per risposte semplici, il formatter usa template statici senza chiamare l'LLM:

| Tipo | Esempio Output |
|------|----------------|
| `GREETING` | "Ciao! 👋 Come posso aiutarti oggi?" |
| `GOODBYE` | "Arrivederci! 👋 A presto!" |
| `THANKS` | "Prego! 😊 Se hai bisogno di altro, sono qui!" |
| `CART_EMPTY` | "Oops, il carrello è vuoto! 🛒 Ma niente paura..." |
| `NO_RESULTS` | "🔍 Mmh, non ho trovato nulla. Prova con altre parole!" |
| `ERROR` | "😅 Ops, qualcosa è andato storto. Riprova tra un attimo!" |
| `HUMAN_SUPPORT` | "👤 Capisco che preferisci parlare con un operatore..." |
| `HELP` | Menu completo delle funzionalità |

## Flusso di Esecuzione

```
ChatEngine.routeMessage()
    │
    ▼
formatWithCustomRules(structuredResponse, language, workspaceConfig, personalizationOptions)
    │
    ▼
LLMFormatterService.format()
    │
    ├── tryTemplateResponse() → Se match, ritorna template (0 token)
    │
    └── Altrimenti:
        │
        ├── buildSystemPrompt(options) → Prompt con personalità
        ├── buildFormattingPrompt(response, targetLanguage) → Dati strutturati
        │
        ▼
        OpenRouter API Call (gpt-4o-mini)
        │
        ▼
        FormatterResult { text, tokensUsed, model, cached }
```

## Integrazione con ChatEngine

Il ChatEngine passa le opzioni di personalizzazione al formatter:

```typescript
// In chat-engine.service.ts
private async formatWithCustomRules(
  structuredResponse: StructuredResponse,
  language: string,
  workspaceConfig: WorkspaceConfig,
  conversationHistory?: Array<{ role: string; content: string }>,
  personalizationOptions?: {
    customerName?: string
    isFirstMessage?: boolean
  }
): Promise<FormatterResult> {
  return this.llmFormatter.format(
    structuredResponse,
    language,
    conversationHistory,
    { 
      customAiRules: workspaceConfig.customAiRules,
      botIdentity: workspaceConfig.botIdentity,
      botName: workspaceConfig.name,
      customerName: personalizationOptions?.customerName,
      isFirstMessage: personalizationOptions?.isFirstMessage,
    }
  )
}
```

## WorkspaceConfig

```typescript
interface WorkspaceConfig {
  name: string                      // Nome workspace (usato come botName)
  botIdentity: string | null        // Alias per botIdentityResponse
  botIdentityResponse: string | null // Personalità dal DB
  customAiRules: string | null      // Regole AI personalizzate
  // ... altri campi
}
```

## Best Practices

1. **Non hardcodare personalità**: Tutto viene dal database (`Workspace.botIdentityResponse`)
2. **Template per risposte semplici**: Riduce costi e latenza
3. **Prompt in italiano**: Garantisce risposte naturali per la lingua base
4. **Logging dettagliato**: Ogni chiamata logga opzioni ricevute e token usati

## Logging

```typescript
logger.info("📝 [LLMFormatter] Options received", {
  hasBotIdentity: !!options?.botIdentity,
  botIdentityLength: options?.botIdentity?.length || 0,
  hasCustomAiRules: !!options?.customAiRules,
  customerName: options?.customerName,
  isFirstMessage: options?.isFirstMessage,
  botName: options?.botName,
})
```

## Vedi Anche

- [PRD.md](../PRD.md) - Specifiche complete del progetto
- [multi-agent-flow.md](./multi-agent-flow.md) - Architettura multi-agent
- [template-system.md](./template-system.md) - Sistema template
