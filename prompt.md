Ciao sono Andrea

> **Autore:** Andrea
> **Data:** 2026-04-27
> **Stato:** v3 — tutte le decisioni prese, pronto per task #1

---

## 1. Obiettivo

Integrare il chatbot di `docs/ecolaundry/demo/` (oggi standalone, file `chatbot.ts`) nella piattaforma eChatbot **senza riscriverlo e senza accoppiarlo direttamente al backend**.

L'idea è trattarlo come una **pura funzione TypeScript**:
- input: un JSON con il messaggio dell'utente + tutta la config necessaria
- output: un JSON con la risposta da inviare
- side-effect zero (niente DB, niente network al di fuori dell'LLM)

Chi chiama la funzione (webhook WhatsApp, widget, playground) decide poi **dove mandare il messaggio** in base alla config, e si occupa di **history**, **security check** e **recharge**.

---

## 2. Posizionamento nel sistema

```
WhatsApp / Widget / Playground
        │
        ▼
   Webhook / API entry
        │
        ▼  (1. legge config workspace dal DB)
        │  (2. legge history dal DB)
        │
        ▼
   ┌─────────────────────────────┐
   │   chatbotFn(input)          │  ← pura funzione (in custom-client-0/)
   │   - channelActive guard     │
   │   - debugChannel/wipMessage │
   │   - pipeline router/agents  │
   │   - return reply            │
   └─────────────────────────────┘
        │
        ▼
   Wrapper esterno (backend)
        │  1. salva risposta in history
        │  2. SECURITY LLM (queue WhatsApp / widget) ← già esistente
        │  3. invia su canale
        │  4. RECHARGE (in base a config sito)
        ▼
   ┌─► WhatsApp Provider
   ├─► Widget WebSocket
   └─► Playground UI
```

**Regola d'oro:** la funzione **non sa** dove andrà la risposta. Il caller decide.
**Security e recharge** sono **fuori** dalla funzione (gestiti già nelle queue WhatsApp/widget).

---

## 3. Contratto Input/Output

### 3.1 Input

```ts
type ChatbotInput = {
  // Messaggio corrente
  userMessage: string
  userName: string

  // Canale (informativo)
  channel: "whatsapp" | "widget" | "playground"

  // Configurazione workspace (letta dal DB dal wrapper)
  config: {
    workspaceId: string
    welcomeMessage: string         // primo messaggio della conversazione
    wipMessage: string             // mostrato se debugChannel=true
    channelActive: boolean         // se false → la funzione NON RISPONDE NULLA (reply: null)
    debugChannel: boolean          // se true → ritorna anche wipMessage e debug info
    isPlayground: boolean          // informativo per il wrapper (skip recharge)
    language?: string              // it/es/pt/en
    // …estendibile
  }

  // Contesto di conversazione (letto dal DB dal wrapper)
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string             // opzionale, se la logica del chatbot lo usa
    history: Array<{ role: "user" | "assistant"; content: string }>
  }
}
```

### 3.2 Output

```ts
type ChatbotOutput = {
  reply: string | null                // null se channelActive=false o errore
  wipMessage?: string                 // popolato se debugChannel=true
  shouldEscalate: boolean
  escalationSummary?: string
  error?: string                      // popolato in caso di errore (LLM, timeout, ecc.)
  meta: {
    tokensUsed: number
    agentChain: string[]
    debug?: unknown                   // popolato solo se debugChannel=true
  }
}
```

---

## 4. Struttura cartelle

```
apps/backend/custom-client-0/        ← copia della demo, NON spostare l'originale
├── index.ts                         # export chatbotFn(input): Promise<output>
├── types.ts                         # ChatbotInput / ChatbotOutput
├── chatbot.ts                       # copiato da docs/ecolaundry/demo/
├── prompts/                         # copiati da docs/ecolaundry/demo/prompts/
├── utils/                           # copiati da docs/ecolaundry/demo/utils/
├── examples/
│   ├── 01-happy-path.ts
│   └── 02-escalation.ts
└── README.md
```

**Vincoli:**
- ❌ NIENTE modifiche a `docs/ecolaundry/demo/` (resta standalone funzionante)
- ✅ Si **COPIA** tutto in `apps/backend/custom-client-0/`
- ✅ Eventuali adattamenti vanno SOLO sulla copia

**FAQ del cliente — note esplicite:**
- ✅ I corpi FAQ canned (`prompts/intents-faq/*.txt` — `discount-code`, `invoice`, `buy-loyalty-card`, `recharge-loyalty-card`, `hours-prices`, `alarm-code`) sono parte della copia.
- ✅ La logica FAQ (`utils/faq-intents.ts` — detector multilang + router + `buildFaqReply`) è parte della copia.
- ⚠️ **Welcome hardcoded → config-driven** (task #2): oggi `faq-intents.ts` ha la costante `GREETING_ES = '¡Hola! Soy el asistente virtual de Ecolaundry...'`. Va rimossa nella copia e il greeting deve arrivare da `input.config.welcomeMessage`. Firma futura: `buildFaqReply(intent, turnCount, greeting)`.
- ⚠️ **Multilingua FAQ — rimandato**: i body FAQ sono solo in spagnolo (un file per intent, non per lingua). `custom-client-0/` resta ES-only per il primo rilascio; se un futuro `custom-client-N/` parla un'altra lingua si introduce la struttura `prompts/intents-faq/{lang}/{intent}.txt` come task dedicato.
- 🧱 **Le FAQ sono per-cliente, non condivise**: ogni `custom-client-N/` porta le proprie FAQ. Coerente con §7.1 (una cartella per cliente).

---

## 5. Flusso interno della funzione

```
1. config.channelActive === false?
   → return { reply: null, … }  ← wrapper NON invia nulla

2. config.debugChannel === true?
   → output.wipMessage = config.wipMessage  (lo userà il wrapper)
   → output.meta.debug = { … }

3. context.history.length === 0?
   → prepend welcomeMessage alla risposta

4. Pipeline:
   router → specialized agent → response builder

5. return ChatbotOutput
```

**Cosa fa il wrapper DOPO il return** (in ordine):
1. Salva la risposta in `history` (DB)
2. Passa per il **security LLM** della queue WhatsApp / widget (già esistente)
3. Invia sul canale corretto
4. Esegue il **recharge** in base alla config del workspace (skip se `isPlayground`)

---

## 6. Piano di lavoro (task incrementali)

| # | Task | Output |
|---|------|--------|
| 1 | Copiare `docs/ecolaundry/demo/` → `apps/backend/custom-client-0/` | copia identica funzionante |
| 2 | Creare `types.ts` + entry `index.ts` con guard `channelActive` e `debugChannel` | scheletro compilabile |
| 3 | Wrap di `chatbot.ts` esistente come pipeline interna | funzione end-to-end |
| 4 | Esempio 1: happy path runnable | `npm run example:happy` |
| 5 | Esempio 2: escalation runnable | `npm run example:escalation` |
| 6 | Integrare nel webhook WhatsApp (chiama `chatbotFn`, poi queue security esistente) | webhook funzionante |
| 7 | Integrare nel widget WebSocket | widget funzionante |
| 8 | Recharge nel wrapper in base a config workspace | billing applicato |

**Ogni task = 1 PR separata.**

---

## 7. Decisioni finali

### 7.1 Multi-cliente ✅

**Una cartella per cliente.** `apps/backend/custom-client-0/`, `custom-client-1/`, ecc.
Un registry sceglie la funzione corretta in base al `workspaceId` del wrapper.

### 7.2 Welcome message ✅

`welcomeMessage` viene passato **nel JSON `input.config`**.
La funzione lo legge e lo prepende quando serve (primo messaggio della conversazione).

### 7.3 wipMessage ✅

`wipMessage` viene passato **nel JSON `input.config`**.
La funzione lo legge e lo include nell'output (`output.wipMessage`) quando `debugChannel=true`.
Il wrapper decide come/quando mostrarlo sul canale.

### 7.4 Errori LLM ✅

In caso di errore la funzione ritorna:
```ts
{
  reply: null,
  error: "descrizione dell'errore",   // es: "OpenRouter 402: insufficient credits"
  shouldEscalate: false,
  meta: { … }
}
```
Niente throw — il wrapper legge `output.error` e decide se loggare/notificare.

### 7.5 Test harness ✅

`custom-client-0/` riusa **gli stessi `usecases/`** della demo (case01–13).
Verrà esposto un comando tipo `npm run test:usecase -- --usecase 7` anche dal package backend.

### 7.6 Phone number — chiarimento

La domanda era: il numero di telefono del cliente (es. `+34612345678`) deve arrivare **dentro** la funzione o basta che lo conosca il wrapper esterno?

- Il wrapper **lo sa già** (gli arriva dal webhook WhatsApp)
- La funzione **ne ha bisogno?** Solo se la logica del chatbot lo usa internamente (es. lookup cliente, formattazione messaggi).

**Proposta:** lo passiamo come campo opzionale `context.phoneNumber?: string` così la funzione lo riceve ma non è obbligatorio. Se non serve, resta inutilizzato.

✅ OK così?

---

## 8. Cosa NON fa la funzione (out of scope)

- ❌ Non legge dal DB
- ❌ Non scrive nel DB (history, log, billing)
- ❌ Non sa nulla di WhatsApp/Widget (canale è solo informativo)
- ❌ Non fa security check finale (lo fa la queue WhatsApp/widget)
- ❌ Non gestisce recharge / billing
- ❌ Non manda messaggi
- ❌ Non gestisce session locks (CLAUDE.md §10)

---

## 9. Vantaggi

- ✅ La demo continua standalone (test rapidi su `docs/ecolaundry/demo/`)
- ✅ Stessa logica usata in produzione → un solo bug fix
- ✅ Testabile in isolamento (pure function)
- ✅ Nessun accoppiamento con Express/Prisma
- ✅ Playground gratuito ottenibile con `isPlayground=true`
- ✅ Multi-cliente futuro = nuova cartella `custom-client-N/`

---

## 10. Prossimo step

Andrea conferma §7.6 (phone number opzionale) → apro PR per **task #1** (copia `docs/ecolaundry/demo/` → `apps/backend/custom-client-0/`).




RAccontami in poche parole poche frasi 
- cosa hai fatto
- cosa ti manca
- passaggio di parametri
- struttura dimmi e' ben fatta? hai da migliorare? se si fallo...
- mi sembra strano che hai un file txt per ogni faq portebbee essere lenta la lettura possiamo far in qualche altro modo?
- vedi problemi di multiutente
- il chabto si intergra bene con webhook e queuee di whtaspp o widget?
- puoi ricontrollare il lavoto ? il passaggio di parametri ? capire se uttto ha senso?
-ricrdati che ogni cosa ha la sua responsabiñita
- dentro ecolaundry/doc dobbiamo aggionare la documertnazione e assicurarci che anidmo nella stessa direzionie

Acceptance Criteria
- mi connetto vedo il mio canale quando mi collegto con gelsogrove@gmail.com che si chiama Ecolandry entro dentro l'applicaizone e vedo le chats 
- posso vedere le chat rispondere...attivare disattivare chatbot vedere utenti
- posso moificare i settings dentro il worskpsae
- devo avere un campo dove e' presente il path del chatbot persanalizato dentro i settings
mettilo dentro AI personlity (occhio al CRUD che deve funzioanre bene)
- deve essere chatbot di tipo Flow  
- build deve funzionare
- test deve funzionare
- deve conitnuare a funzioonare i WIP message
- deve continuare a bloccarsi se il channel e' disattivato
- se il channel e' debugMOde=treu devo poter entrare vedere il playground chattare senza che mi ricarichi nulla sul conto
- ogni volta che c'e' un dialogo ricordati di ricaricare il conto ini base alle configurazione
- come vedi quello che cambia e' solo il motere del chatbot personalizato
- occhio al prisma
- occhio al generate di prisam
- occio al migrate di primsa
- devi fare il deploy su Heroku sei test e la build funzionano

vedi probelmi? puoi farlo ? 

IN poche parole 



SENTI MA POI 