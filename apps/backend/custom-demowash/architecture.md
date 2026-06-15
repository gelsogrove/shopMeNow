# Demowash — Architettura

Documento di riferimento per il chatbot **custom-demowash**. Tutto quello che serve sapere per estendere, mantenere e portare in produzione il bot.

> ⚠️ **Questo documento è allineato al codice** (`agent.ts`, `state.ts`, `pii.ts`, `settings.json`, `prompts/`). Se modifichi il codice, aggiorna qui i fatti corrispondenti (sedi, tool, shape dello state, settings). Le sezioni di *ragionamento* (cache, anti-allucinazione, lingua, costi) restano valide finché non cambia il paradigma.

---

## 1. Filosofia

**Il modello LLM è il motore primario, non un componente da imbrigliare.**

Custom-demowash nasce in reazione al paradigma opposto (LLM = inaffidabile, serve un guard layer deterministico per ogni comportamento → ~5000 righe di codice, state machine XState, decine di guard, ~1600 unit test, F-log dei bug ricorrenti).

Demowash parte dall'osservazione empirica che Claude 4.x (Haiku 4.5, Sonnet 4.6, Opus 4.7) con un system prompt ben strutturato gestisce nativamente:
- Gather sequenziale dei fatti (location → macchina → display)
- Lingua sticky multi-turno (6+ lingue)
- FAQ mid-flow con pause + resume
- Cross-context awareness (es. *"tarjeta di Eixample usata a Gràcia"*)
- Tono empatico, escalation appropriata

Quindi: **la logica di business vive nel prompt**, il codice fa solo le cose che il prompt non può fare:
- side-effect verso il mondo esterno (email all'operatore, email fattura)
- persistenza dello state per-sessione
- redaction PII (pre-scan deterministico, fuori dall'LLM esterno)
- un paio di backstop deterministici stretti (es. detection venue, vedi §9)

---

## 2. Stack

- **Runtime**: Node.js 22+ con ESM, eseguito via `tsx`
- **Linguaggio**: TypeScript stretto
- **LLM provider**: OpenRouter (`OPENROUTER_API_KEY` dal `.env` locale)
- **Modello default**: `anthropic/claude-haiku-4.5` (configurabile via `settings.json` o env `LLM_MODEL`)
- **Prompt caching**: nativo Anthropic via `cache_control: { type: 'ephemeral' }`, TTL 5 minuti
- **Email**: `nodemailer` su SMTP Gmail (`GMAIL_USER` / `GMAIL_APP_PASSWORD`). Senza SMTP configurato, i briefing vengono loggati in console (dev).
- **Persistenza**: in dev `Map` in RAM; in produzione lo state va su Redis/DB Prisma del backend host, e i `patches` vengono scritti nella tabella `Customers`.

Dipendenze runtime: `nodemailer`. Dev: `tsx`, `typescript`, `@types/nodemailer`. Nient'altro.

---

## 3. Struttura filesystem

```
custom-demowash/
├── architecture.md                  ← questo documento
├── usecases.md                      ← documento canonico dei casi (single source of truth funzionale)
├── usecases_{it,en,ca,de,fr,pt}.md  ← traduzioni dei casi (riferimento QA multilingua)
├── prompts/
│   ├── common.md                    ← comportamento del bot (casi, tono, escalation, template operatore)
│   ├── franchising.md               ← flusso consulenza franchising (booking Calendar + Zoom)
│   ├── faqs.md                      ← FAQ integrate nel prompt
│   ├── machines/
│   │   ├── washer.md                ← codici display lavadora + procedure + alarmi
│   │   └── dryer.md                 ← idem secadora
│   ├── tintoria.md                  ← 2ª linea: tintorería (servizi, tempi, macchie, pagamento, tracking, fuori scope)
│   └── locations/
│       ├── eixample.md              ← Barcelona, Passeig de Gràcia (incl. tabella Precios tintorería)
│       ├── gracia.md
│       ├── mataro.md
│       ├── rubi.md
│       ├── sant-cugat.md
│       └── terrassa.md
├── agent.ts                         ← orchestratore: assembly prompt, tool dispatch, turn loop, REPL/batch, chatbotFn (entry host)
├── orders.ts                        ← store demo ordini tintorería (lookup per telefono / per numero) — fallback quando l'host non inietta un handler reale
├── state.ts                         ← SessionState, patches, lingua (sentinel trailer), rate-limit/turn counters
├── pii.ts                           ← redaction PII (pre-scan, de-redact, substitute) + detect venue
├── index.ts                         ← re-export di chatbotFn per l'import dinamico del backend
├── settings.json                    ← configurazione operativa (modello, email, cap)
├── test-contract.ts                 ← contract test della shape di I/O
├── .env                             ← OPENROUTER_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
├── package.json
└── tsconfig.json
```

> ⚠️ **Le 6 sedi sono nella provincia di Barcellona**: Mataró, Eixample (Barcelona città), Gràcia (Barcelona città), Sant Cugat, Rubí, Terrassa. I dati (prezzi, orari, programmi, numeri macchina) stanno in `prompts/locations/*.md`.

### Cosa contiene ogni file

**`common.md`** — il "comportamento" del bot, agnostico da location e modello macchina: i casi di `usecases.md` riformulati astraendo dai dati concreti; regole di tono (empatia, brevità, no spanglish); procedura di escalation con il template del briefing operatore (sezioni 🕒/📍/🔢/👤/🌐/🚨/📋/✅); fallback "escenario no contemplado"; regole cross-cutting (la tarjeta vale solo dove l'hai comprata, FAQ mid-flow → riprendi flow).

**`faqs.md`** — FAQ trasversali, iniettate come blocco dedicato nel prompt.

**`machines/washer.md`** — tutto ciò che riguarda la lavadora come hardware: tabella codici display (`WAIT`, `SELECT`, `ON`, `T-28`, `STOP:`, `END:`, `120`, `OPEN:`, `OPEN ERROR`, `ALERT OPEN:`, `ERR-01`, `ALERT`/`BLOCK`), con per ogni codice significato + procedura step-by-step + quando escalare. ⚠️ Due casi porta DISTINTI: `OPEN:` (non chiude PRIMA del lavaggio) vs `OPEN ERROR` (porta bloccata DOPO il ciclo, roba intrappolata → escalation urgente). Identico per la secadora.

**`machines/dryer.md`** — idem secadora: codici display, minuti, problemi non-display.

**`locations/<sede>.md`** — dati specifici della sede in **tabelle markdown** (anti-allucinazione, vedi §18): indirizzo, orario, prezzi lavadora/secadora **per numero macchina** con colonne *Fidelización* / *Efectivo*, programmi, metodi di pagamento. La struttura prezzi reale è *per macchina*, non per fascia di peso generica.

**Esempio reale `locations/mataro.md`** (estratto):
```markdown
# Mataró
**Dirección**: C/ del Carme 42, Mataró
**Horario**: 8:00 — 22:00

## Precios lavadora
| Núm. máquina | Peso  | Fidelización | Efectivo |
|--------------|-------|--------------|----------|
| 4            | 20 kg | 6,50 €       | 7 €      |
| 6            | 10 kg | 3,50 €       | 4 €      |

## Precios secadora
| Núm. máquina | Fidelización |
|--------------|--------------|
| 1            | 2 € / 15 min |
```

---

## 4. Assembly del system prompt

All'avvio (lazy, una sola volta per processo via `getCachedSystemPrompt`), `buildSystemPrompt()` costruisce il system prompt:

1. Legge `prompts/common.md`
2. Se presente, accoda `prompts/franchising.md` sotto header `════════ FRANCHISING CONSULTATION ════════`
3. Se presente, accoda `prompts/faqs.md` sotto header `════════ FAQS ════════`
4. Scansiona `prompts/machines/` in ordine alfabetico → header `════════ MACHINES ════════`, poi `## <Nome>` per ogni file
5. Se presente, accoda `prompts/tintoria.md` sotto header `════════ TINTORERÍA ════════` (seconda linea di servizio: limpieza profesional al banco)
6. Scansiona `prompts/locations/` in ordine alfabetico → header `════════ LOCATIONS ════════`, poi `## <Nome>` per ogni file

```
<contenuto common.md>

════════ FRANCHISING CONSULTATION ════════
<contenuto franchising.md>

════════ FAQS ════════
<contenuto faqs.md>

════════ MACHINES ════════
## Washer
<contenuto machines/washer.md>
## Dryer
<contenuto machines/dryer.md>

════════ TINTORERÍA ════════
<contenuto tintoria.md>

════════ LOCATIONS ════════
## Eixample
<contenuto locations/eixample.md>   (incl. tabella "Precios tintorería" per sede)
## Gracia
...tutte le 6 in ordine alfabetico...
```

**Due linee di servizio, un prompt:** lavandería autoservicio (MACHINES) e tintorería (TINTORERÍA) convivono nello stesso blob cached. `common.md` descrive le due linee e l'LLM instrada in modo semantico (no router, no regex — 1 sola call/turno). I prezzi tintoria sono **per sede** (tabella in ogni `locations/*.md`), come già lavatrice/asciugatrice.

Questo blob (~28k token a 6 sedi) è **il system prompt cached**. Non cambia mai tra turni della stessa sessione, né tra sessioni diverse, finché i file su disco non vengono editati.

### Perché tutto-in-uno e non swap dinamico

**Swap del prompt in base alla location attiva ROMPE la cache**: il blob cached è identificato byte-per-byte. Cambiare contenuto = nuovo blob = cache write da zero (125% del normale invece del 10% della read).

Per i numeri di Demowash (6 sedi, ~28k token):
- Tutto-in-uno: 28k × $0.10/Mtok = **$0.0028/turno** dopo il primo
- Swap dinamico: 12k × $1.25/Mtok = **$0.015/turno** ad ogni cambio di contesto

Lo swap costa **5× di più**, non meno. Inoltre rompe i casi cross-location (la "tarjeta di Eixample usata a Gràcia" richiede che il modello veda entrambe le sedi nel prompt) e il fallback "escenario no contemplado" (richiede consapevolezza di cosa è coperto).

### Quando NON funziona più tutto-in-uno

Limite pratico: ~150 location o ~30 modelli macchina (prompt ~150k token, lento e costoso anche cached). Oltre, si introduce RAG: vector search → top-K blocchi rilevanti → iniezione al momento. Per Demowash siamo lontanissimi dal limite.

---

## 5. Cache del system prompt

Nella chiamata a OpenRouter il system è un array di blocchi: **solo il primo** (il blob assemblato) porta `cache_control: { type: 'ephemeral' }`. I blocchi `SESSION STATE` + `RUNTIME` vengono accodati **senza** cache_control, così cambiano ogni turno senza invalidare la cache.

**Caratteristiche**:
- TTL 5 minuti dall'ultimo uso
- Cache condivisa tra tutte le sessioni che usano lo stesso identico blob
- Cache write: 125% del prezzo input normale (paga 1 volta)
- Cache read: 10% del prezzo input normale (paga ogni turno successivo)

In produzione con traffico continuo la cache non scade quasi mai → il cache write iniziale si paga ~1-3 volte al giorno.

**Verifica empirica** (run del 2026-05-27, `LLM_DEBUG=1` stampa `[usage] prompt=… cache_read=… cache_write=…`): system prompt ~27.700 token, cache hit ~99.97%.

---

## 6. State per-sessione

Oggetto TypeScript per-sessione (`SessionState` in `state.ts`) che tiene i fatti già noti sul cliente, così il modello non li ri-chiede.

### Shape (reale)

```typescript
interface SessionState {
  // Operativo (usato per il flow + briefing operatore)
  name?:        string
  location?:    string                                   // "Mataró" | "Eixample" | ...
  machineType?: 'washer' | 'dryer'
  machine?:     number
  displayCode?: string
  language?:    string                                   // ISO 639-1, "es" | "it" | ...

  // Profilo (mirrorato verso Customers via patches)
  companyName?: string
  address?:     string
  phone?:       string
  notes?:       string

  // PII — SOLO server-side, MAI mirrorata, mai re-inviata all'LLM in chiaro
  email?:       string
  cif?:         string
  nif?:         string
  iban?:        string
  cardFull?:    string
  cardLast4?:   string
}
```

### Dove vive

- **Dev**: `Map<sessionId, SessionEntry>` in RAM (l'entry tiene anche `patches`, `turnCount`, timestamp per rate-limit, `escalatedReasons`).
- **Produzione**: Redis (latenza bassa, TTL) o DB Prisma (persistente, multi-tenant). Stesso contratto API (`getState`, `updateState`, `resetState`, `drainPatches`).

### Mirror verso Customers (patches)

`updateState(sessionId, patch, { mirror })` aggiorna lo state in RAM e, per le sole chiavi in `MIRRORED_KEYS` (`name`, `language`, `companyName`, `address`, `phone`, `notes`), accumula un `CustomerPatch` (last-write-wins). `chatbotFn` poi fa `drainPatches` e li restituisce all'host, che li scrive nella tabella `Customers`.

- **Le PII (`email`, `cif`, `nif`, `iban`, `cardFull`, `cardLast4`) NON sono mai mirrorate**: viaggiano solo lato server (es. payload dell'email all'operatore).
- I seed/default (es. lingua dedotta dal prefisso telefonico host) usano `mirror:false` → non vengono mai scritti nel DB.

### Come finisce nel prompt

In **coda** al blob cached, ricostruito ad ogni turno da `formatStateForPrompt`:

```
[blob cached: ~28k token, immutabile]

═══ SESSION STATE ═══
Customer name: Andrea
Active location: Sant Cugat
Machine: 4 (washer)
Display: OPEN ERROR
Current language: it (keep this if the new message is too short/ambiguous to tell)

## LANGUAGE …            ← regole lingua, sempre iniettate
## OUTPUT FORMAT …       ← obbligo del trailer ⟦LANG:xx⟧
```

Più il blocco `RUNTIME` (data/ora correnti, `Turn: 1|2`, lingua del briefing operatore). Tutta coda non-cached, cambia ogni turno ma **non rompe la cache**.

### Quando si svuota

Nuova sessione; `/reset` nella REPL (`resetState`); crash/restart in dev (in prod la persistenza sopravvive). In produzione aggiungere TTL di inattività (24h consigliato).

### Multi-utente

Ogni `sessionId` (in prod = numero WhatsApp / id chat) ha il suo `SessionState`. **Il blob cached è condiviso tra tutti gli utenti**; cambia solo la coda per utente.

---

## 7. Tool (function calling)

**Quattro tool**, ognuno con una responsabilità. Non c'è `close_session`: la chiusura chat è gestita dall'host via `closeChat` nell'output (impostato dopo un'escalation). Non c'è `capture_pii`: le PII sono catturate dal pre-scan deterministico di `pii.ts` (§9), non da un tool LLM.

### 7.1 `remember`

Popola lo `SessionState`. Il modello lo chiama quando il cliente fornisce un fatto nuovo.

```typescript
remember({
  name?:        string,
  location?:    string,                  // canonico: Mataró, Eixample, Gràcia, Sant Cugat, Rubí, Terrassa
  machineType?: 'washer' | 'dryer',
  machine?:     number,
  displayCode?: string,
}) → { ok: true, state: SessionState }
```

- **Semantica merge**, non overwrite: `remember({location:"Eixample"})` non azzera `name`.
- **`machineType` è normalizzato difensivamente**: se la value contiene markup di tool-call leakato (es. `"washer</machineType>"`), si estrae comunque il token canonico.
- **`language` NON è un parametro** (a differenza di versioni precedenti del doc): una tool call sulla lingua resuscita il bug *T1 empty-reply*. La lingua viaggia come trailer di testo `⟦LANG:xx⟧`, persistita DOPO il turno (vedi §8.1).
- **Niente hardcoding di liste valide nel tool**: il tool accetta qualsiasi stringa per `location`; è il prompt a sapere che esistono 6 sedi.

### 7.2 `request_invoice`

Invia all'operatore una richiesta di fattura strutturata, via email. Il modello lo chiama **solo** dopo aver raccolto tutti e 5 i campi.

```typescript
request_invoice({
  companyName: string,
  amount:      string,        // free-form: "8.50", "8,50 €", "8 euros"
  serviceDate: string,        // ISO, DD/MM/YYYY, o naturale ("oggi"/"ayer"/"today"/"yesterday")
  email:       string,
  note:        string,        // stringa vuota se il cliente dice "no"
}) → { ok: true, invoice_id, email_sent } | { ok: false, error }
```

**Validazione (pattern "Tool refuses, LLM corrects")**: il tool valida `email` (RFC 5322-ish) e normalizza `serviceDate`. Su input non valido ritorna `ok:false` con un `error` specifico → il modello ri-chiede **solo il campo invalido**. È validazione di precondizione strutturale di tool args, non phrase-detection — quindi non viola le iron rule. Profilo (`companyName`, `note`) salvato nello state per il mirror su Customers.

### 7.3 `escalate_to_operator`

L'unico vero side-effect "human-in-the-loop". Triggera l'invio del briefing all'operatore via email.

```typescript
escalate_to_operator({
  reason: 'machine_broken' | 'door_persistent' | 'alarm_technical' | 'double_charge'
        | 'no_change' | 'invoice_request' | 'loyalty_card' | 'no_soap' | 'no_spin'
        | 'angry_customer' | 'not_covered' | 'other',
  summary: string,            // briefing strutturato, lingua = RUNTIME.operatorBriefingLanguage (default es)
}) → { ok: true, ticket_id, eta_minutes: 5, email_sent } | { ok: false, error, instruction? }
```

**Note**:
- `location` / `machine` / `name` li legge dallo `SessionState`: non vanno ripassati negli args.
- `summary` è il briefing strutturato (template di `common.md`, sezioni 🕒/📍/🔢/👤/🌐/🚨/📋/✅). Lingua del summary = quella del briefing operatore (default `es`), indipendente dalla lingua della conversazione.
- Il `ticket_id` è **interno** (audit/correlazione email): NON va comunicato al cliente.

**Pattern "Tool refuses, LLM corrects" (precondizione nome)**: prima di generare il ticket, il tool valida `state.name !== undefined`. Se manca:
```typescript
{ ok: false, error: 'missing_customer_name', instruction: 'Ask the customer their name first, save it with remember({name}), then retry.' }
```
Il modello auto-corregge nel turno successivo. È **deterministico** (l'errore arriva sempre), non viola la iron rule (non è regex su user text), si auto-documenta (`instruction`).

**Idempotenza**: `markEscalationOnce(sessionId, reason)` fa scattare l'email **una sola volta per (sessione, reason)**. Una seconda call nello stesso turno (es. retry dopo `missing_customer_name`) ritorna `ok:true, already_escalated:true` senza inviare una seconda email.

**Lato host**: dopo un'escalation andata a buon fine, `chatbotFn` ritorna `shouldEscalate:true`, `escalationSummary` (briefing post-substitution PII), `notificationEmails` (operator email) e `closeChat:true`.

### 7.4 `schedule_consultation`

Prenota la consulenza franchising con il team commerciale (flusso in `prompts/franchising.md`).

```typescript
schedule_consultation({
  slotIndex: number,          // 1-based, indice dello slot scelto dal cliente
}) → { ok: true, appointment_id, date, time, calendar_link, zoom_link } | { ok: false, error }
```

**Note**:
- Gli **slot disponibili sono generati a runtime** (`getConsultationSlots`: prossimo lunedì 10:00/15:00 + prossimo martedì 11:00, sempre nel futuro) e **iniettati nel blocco RUNTIME** — il modello offre esattamente quelli, mai date inventate. In produzione: fetch della disponibilità reale dal DB.
- **Precondizioni** ("Tool refuses, LLM corrects"): `state.name` e `state.email` devono esistere. L'email arriva nello state via pre-scan PII (§9), non via tool.
- I side-effect reali (evento Google Calendar + meeting Zoom) girano host-side via handler iniettato (`ctx.scheduleConsultation`); in REPL/batch i link restano `null` e il bot conferma solo data/ora.
- **Idempotenza**: una seconda call nella stessa sessione ritorna `ok:false` (appuntamento già preso).

### 7.5 `check_order_status`

Consulta lo stato di un ordine di **tintorería** (read-only, nessuna mutazione di state). Il cliente è identificato dal **telefono** (già noto su WhatsApp / form del demo) → **niente codice da chiedere**.

```typescript
check_order_status({
  orderNumber?: string,       // OPZIONALE — solo per ritiro di terzi (chi ha il resguardo)
}) → { ok: true, orders: [{ order_number, status: 'ready'|'in_progress', ready_date, location, items }] }
  | { ok: false, error: 'order_not_found' | 'no_orders_for_customer' }
```

**Note**:
- **Phone-first**: nel caso normale il modello chiama il tool **senza argomenti**; l'handler cerca per telefono. `orderNumber` si passa solo quando ritira un'altra persona.
- Dato **dinamico per-ordine** → non sta nel prompt (a differenza di prezzi/orari): un tool è legittimo (≠ `get_prices`).
- **Handler iniettabile** (`ctx.checkOrderStatus`): in produzione interroga il backend/POS reale per telefono+workspace; in REPL/batch/**demo sito** è assente e si usa lo store seedato `orders.ts` (per telefono ritorna un set demo, così la demo trova sempre qualcosa; per numero usa gli ordini seedati). Stesso pattern di `schedule_consultation` (iron rule #4).
- `found:false` → il bot NON inventa lo stato: per numero chiede di ricontrollare il resguardo, per telefono rimanda alla sede.

### Tool che NON aggiungo

- **`close_session` / `mark_resolved`** — la chiusura la decide l'host via `closeChat`. Non serve un tool LLM.
- **`validate_card_digits`** — solo validazione di formato; gestita nella redaction PII (§9).
- **`save_invoice_data` / `save_loyalty_data`** — `request_invoice` copre il primo; il loyalty è un `escalate_to_operator({reason:'loyalty_card'})`.
- **`get_prices` / `get_hours`** — i dati sono già nel prompt cached.
- **`detect_language` / `set_language` / `remember({language})`** — VIETATI (bug T1 empty-reply). Vedi §8.1.

---

## 8. Turn flow

```
1. Host chiama chatbotFn(input) — REPL, WhatsApp, widget o playground
2. seedLanguageIfNeeded(sessionId, input.config.language)  [no-op se già set, mirror:false]
3. Ricostruisce history da input.context.history (il DB host è la fonte)
4. agentTurn → withSessionLock(sessionId, …)   [lock async per-sessione, no race su scritture state]
5. processIncomingMessage: pre-scan PII + de-redact + seed venue   → testo pulito
6. isFirstTurn = (history.length === 0)   → il prompt emette il saluto di benvenuto
7. Loop max MAX_TOOL_HOPS (=4):
     state = getState(sessionId)
     response = callLLM(blobCached + SESSION STATE + RUNTIME, history)
     se ci sono tool_calls → esegui (remember | request_invoice | schedule_consultation | escalate_to_operator),
                              appendi i tool_result, ripeti
     se è testo → extractLanguage(content) → { reply, lang }
                  empty-reply recovery: se reply vuota → un nudge esplicito, retry una volta
                  commitLanguageFromReply(sessionId, lang)   [persiste solo se valido → sticky]
                  salva history con la reply PULITA (senza ⟦LANG⟧)
                  ritorna reply
8. drainPatches(sessionId) → patches verso Customers
9. ChatbotOutput { reply, shouldEscalate, escalationSummary, notificationEmails, closeChat, patches, meta }
```

**Cap a `MAX_TOOL_HOPS` (4) hop di tool call** per evitare loop. **Empty-reply recovery**: una completion vuota (o solo-trailer) → un re-prompt esplicito una volta sola.

---

## 8.1 Lingua — decisa dall'LLM, non da regex (sentinel trailer)

**Principio (iron rule #1)**: niente detector regex sul testo utente. Il vecchio detector (liste di parole per lingua) era accurato solo ~60-65% sui messaggi reali: le parole-funzione romanze (`la`, `no`, `un`, `que`…) collidono tra es/ca/it/pt/fr (*"He pagado pero la máquina no arranca"* veniva classificato `ca` invece di `es`). Rimosso del tutto.

**Design attuale** (in `state.ts` + `formatStateForPrompt`):

1. Il prompt (blocchi `## LANGUAGE` + `## OUTPUT FORMAT`, **sempre iniettati**) istruisce l'LLM a: rispondere nella lingua dell'**ultimo** messaggio del cliente; su input ambiguo (numero nudo, nome città, codice display, emoji, "ok") **non indovinare** ma mantenere la lingua precedente (sticky, isteresi: si cambia solo con una frase vera ≥ ~3 parole significative); accodare su riga propria il marker `⟦LANG:xx⟧`.
2. `extractLanguage(raw)` separa la reply pulita dal codice lingua. Il marker viene **sempre rimosso** prima dell'invio (regex end-anchored + strip globale).
3. `commitLanguageFromReply(sessionId, lang)`: codice valido (`isValidIso`) e diverso → `updateState({language})` con mirror → `Customers.language`; codice mancante/invalido → **no-op** (sticky): un messaggio ambiguo non declassa mai la lingua nota.
4. Il seed iniziale (`seedLanguageIfNeeded`, hint host da `customer.language`) è `mirror:false` → mai scritto nel DB.

`VALID_ISO` è permissivo (es, it, en, ca, pt, fr, de, ar, zh, …): il bot può rispondere in qualsiasi lingua supportata da Claude; un codice fuori lista è trattato come allucinato e ignorato.

**Perché NON ricrea il bug T1 empty-reply**: il codice lingua è **testo** nella stessa completion, accodato DOPO la risposta — non è una tool call, nessun hop extra, il modello non può "finire" prima di scrivere. Una completion solo-trailer dà `reply` vuota → intercettata dall'empty-reply recovery.

**Costo**: ZERO chiamate LLM aggiuntive (~5 token di sottoprodotto). Meno codice eseguito di prima.

---

## 9. PII e sicurezza — `pii.ts` (implementato, non opzionale)

La redaction PII **è implementata e gira sempre** (non è solo "consigliata per la produzione"). Pipeline in `processIncomingMessage`:

### 9.1 Pre-scan + redaction

`preScanAndRedact(input)` estrae con regex i pattern PII dal messaggio in ingresso e li sostituisce con placeholder, salvando i valori veri in `SessionState` (lato server):

| Pattern | Placeholder | Note |
|---|---|---|
| email | `[EMAIL]` | RFC-ish |
| IBAN | `[IBAN]` | prima di CIF |
| carta 16 cifre | `[CARD_FULL]` | con separatori opzionali |
| ultime 4 cifre **in contesto carta** | `tarjeta [CARD_4]` | multilingua (tarjeta/carta/card/ending in/…) |
| CIF spagnolo | `[CIF]` | |
| NIF/DNI | `[NIF]` | |
| telefono ES | `[PHONE]` | +34 opzionale + 9 cifre |

### 9.2 De-redact della history

`deRedactWithState` sostituisce nelle nuove righe ogni occorrenza letterale di valori già noti dallo state (`name`, `address`, `companyName`, `cif`, `email`, `phone`, …) con i placeholder, così non rientrano in chiaro nel context.

### 9.3 Substitute per l'operatore

`substitutePlaceholders(text, state)` rimpiazza i placeholder con i valori veri **solo** quando il testo è destinato all'operatore (email di escalation/fattura). L'LLM esterno non vede mai i valori veri dopo il pre-scan iniziale.

> Anche il log di debug (`formatStateOneLine`) redige le PII (`email`, `cif`, `nif`, `iban`, `cardFull`, `cardLast4`, `phone` → `[REDACTED]`).

### 9.4 Backstop deterministico: detect venue (BUG L)

`detectVenue(message)` riconosce i 6 toponimi canonici (accent-insensitive, word-boundary anche se incollati a script non-latino, es. `在Eixample洗`) e **seed-a `location` solo se non è ancora set**. Serve perché il modello non sempre chiama `remember({location})` quando il nome è dentro testo in altra lingua/script. **Non è intent detection**: è lo stesso principio del pre-scan PII (matching di proper noun fissi), l'unica eccezione deterministica ammessa per i fatti, e non sovrascrive mai una sede già scelta.

### 9.5 Anti-prompt-injection

System prompt statico e cached (non modificabile dall'utente); `sanitizeUserMessage` (strip control chars / zero-width / bidi); cap lunghezza messaggio (`maxMessageChars`, default 2000).

---

## 10. Integrazione col backend host

`index.ts` ri-esporta `chatbotFn`. Il backend principale fa import dinamico in base a `workspace.customChatbotId`:

```typescript
const mod = await import(`custom-${chatbotId}/index.js`)
const result = await mod.chatbotFn(input)
```

### Contratto I/O

```typescript
interface ChatbotInput {
  userMessage: string
  userName:    string
  channel:     'whatsapp' | 'widget' | 'playground'
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    language?: string                          // hint iniziale (seed)
    operatorBriefingLanguageOverride?: string | null
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]                     // { role:'user'|'assistant', content, timestamp? }
  }
}

interface ChatbotOutput {
  reply: string | null
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
  closeChat: boolean
  patches?: CustomerPatch[]                      // { key, value } → Customers
  meta: { tokensUsed: number; agentChain: string[] }
  error?: string                                 // es. 'llm_unavailable'
}
```

Il contratto è verificato da `test-contract.ts`.

---

## 11. CLI / modalità di esecuzione

### REPL interattiva (default)

```bash
npm run demo
```
Comandi: testo libero → manda all'agent; `/reset` → svuota history + state; `/state` → stampa lo state one-line; `/exit` / `/quit`.

### Batch mode

```bash
npm run demo -- --batch '[["msg1","msg2"],"/reset",["scenario 2 turn 1"]]'
```
Ogni entry array = sequenza di turni in UNA sessione; `"/reset"` = nuova sessione. Output: `[SCENARIO N]`, `[USER TN]`, `[BOT TN]`.

### Debug

```bash
npm run demo -- --debug      # setta LLM_DEBUG=1
```
Stampa `[usage] prompt=… completion=… cache_read=… cache_write=…`, `[tool_call] …`, `[lang] …`, `[state] …` ad ogni turno.

### Altri script

```bash
npm run demo:contract        # contract test della shape I/O
npm run typecheck            # tsc --noEmit
```

---

## 12. Configurazione runtime

Tre livelli, con precedenza **env var > `settings.json` > default hardcoded**:

**`settings.json`** (configurazione operativa, versionata):

| Campo | Valore attuale | Note |
|---|---|---|
| `model` | `anthropic/claude-haiku-4.5` | |
| `temperature` | `0.3` | vedi §18.3 |
| `maxTokens` | `800` | cap output |
| `maxToolHops` | `4` | cap loop tool |
| `operatorBriefingLanguage` | `es` | lingua del briefing operatore |
| `operatorEmail` | (configurato) | destinatario escalation/fattura |
| `emailFrom` / `emailSubjectPrefix` | … | header email |
| `maxMessageChars` | `2000` | anti prompt-stuffing |
| `maxMessagesPerMinute` | `30` | rate-limit (timestamp in state) |
| `maxTurnsPerSession` | `50` | cap costo per sessione |

**Env var** (`.env`, NON versionato — segreti e override):

| Variabile | Note |
|---|---|
| `OPENROUTER_API_KEY` | required |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP per nodemailer; se assenti, briefing loggati in console |
| `OPERATOR_EMAIL` | override del destinatario |
| `LLM_MODEL` / `LLM_MAX_TOKENS` / `LLM_TEMPERATURE` / `LLM_BASE_URL` | override LLM |
| `LLM_DEBUG` | se `1`, stampa usage/tracce |

> La configurazione **di comportamento** sta nel prompt; quella **operativa** in `settings.json`; i **segreti** in `.env`.

---

## 13. Cosa NON c'è (rispetto al paradigma legacy a guard-layer)

| Componente legacy | Perché non esiste qui |
|---|---|
| State machine XState | Il flow è descritto in prosa nel prompt, il modello lo segue |
| Guard pipeline | Sostituita da prompt + tool che rifiutano args invalidi |
| Branch router / family detector LLM | Una sola call LLM per turno, niente routing pre-call |
| Fact extractor deterministico generico | Il modello estrae i fatti via `remember`; unica eccezione deterministica: `detectVenue` (§9.4) |
| Rephrase layer (LLM polish) | Il modello produce direttamente il testo finale |
| Language enforcer (LLM aggiuntivo) | Lingua nativa + sentinel trailer (§8.1) |
| `display-flows.json` / flow engine | Codici display in `machines/*.md`, applicati dal modello |
| `i18n/<lang>.json` × N | Una sola fonte markdown, il modello traduce nativamente |
| F-log + regression pinning | Niente bug pattern ricorrenti da pinnare |
| 1600 unit test | Test E2E sui casi (input → output bot) + `test-contract.ts` |

**Lines of code**: ~1150 righe `agent.ts` + ~330 `state.ts` + ~240 `pii.ts` + i prompt come *documenti markdown* (~28k token), non codice.

---

## 14. Dev → Produzione checklist

La maggior parte dei punti è **già implementata** in questo POC; quelli da fare riguardano la persistenza e l'hardening host:

- ✅ **PII redaction** — fatta (`pii.ts`).
- ✅ **Per-session lock** — `withSessionLock`.
- ✅ **Idempotenza escalation** — `markEscalationOnce`.
- ✅ **Email reale** — `nodemailer` (Gmail SMTP).
- ✅ **Cap costo/abuso** — `maxToolHops`, `maxTurnsPerSession`, `maxMessagesPerMinute`, `maxMessageChars` (in settings; verificare che l'host li applichi davvero).
- ☐ **State persistente** — sposta la `Map` su Redis/Prisma con TTL (24h).
- ☐ **History persistente con sliding window** — cap a ~10-20 turni per evitare context bloat.
- ☐ **Multi-tenant** — `workspaceId` nella chiave dello state.
- ☐ **Observability** — log `llm.call` con caller/latency/cost.
- ☐ **Fallback OpenRouter down** — messaggio canned invece di `reply:null` (oggi ritorna `error:'llm_unavailable'`).

### Cosa NON serve fare

Non riscrivere lo stack; non aggiungere state machine "per sicurezza"; non frammentare in N moduli; non una suite da 1600 test — bastano test E2E sui casi + il contract test.

---

## 15. Quando questa architettura NON basta

1. **>150 sedi o >30 modelli macchina**: il prompt supera la context window pratica → RAG (vector search + iniezione top-K).
2. **SLA latenza < 1s p95**: una call LLM ha ~800-2000ms → caching risposte comuni / pre-canned.
3. **Compliance auditabilità forte** (finanza, sanità): serve ricostruire deterministicamente "perché il bot ha detto X" → rule engine + LLM-as-second-opinion. Per Demowash non è il caso.
4. **Multi-modale ad alta complessità** (immagini/video/voce simultanei): architettura multi-agente. *(Nota: l'ingestione di allegati PDF/immagini WhatsApp è un'estensione pianificata e va gestita nel layer host + tool, non nel prompt — fuori dallo scope di questa versione del documento.)*

---

## 16. Iron rules

1. **Logica nel prompt, side-effect nei tool**. Mai un detector deterministico per intent classification (eccezioni deterministiche ammesse solo per *fatti* fissi: PII e toponimi, §9).
2. **Tool fa una cosa sola**. Secondo behavior = secondo tool, non un parametro extra.
3. **State è merge, non replace**. `remember({field})` aggiorna un campo, non azzera gli altri.
4. **Cache write si paga una volta**. Niente swap del system prompt mid-session.
5. **Niente hardcoding di liste valide nei tool**. I dati di verità sono nel prompt.
6. **PII fuori dall'LLM esterno**. Redaction prima dell'invio, valori veri solo lato server.
7. **Multi-utente = state separato, prompt condiviso**.
8. **Se il bot risponde male → fix nel prompt, non nel codice**. Se ricorri al codice 2 volte di fila per lo stesso pattern, ripensa l'architettura (o aggiungi una validazione di precondizione di tool, mai una regex su intent).

---

## 17. Costi

Prezzi di riferimento (Anthropic via OpenRouter, listino 2026-05):

| Modello | Input | Cache write | Cache read | Output |
|---|---|---|---|---|
| Claude Haiku 4.5 | $1 / Mtok | $1.25 / Mtok | $0.10 / Mtok | $5 / Mtok |
| Claude Sonnet 4.6 | $3 / Mtok | $3.75 / Mtok | $0.30 / Mtok | $15 / Mtok |

### Costo per turno (Haiku 4.5, system ~27.700 token, cache hit ~99.97%)

- Cache read: 27.694 × $0.10/M = **$0.00277**
- Input non-cached (~150 tok): ~$0.00015
- Output (~150 tok): ~$0.00075
- **Totale: ~$0.0037 / turno** · Conversazione tipica (8-12 turni): ~$0.03-0.04

### Confronto annuo (10k conversazioni/giorno): prompt-driven vs legacy guard-layer

| Voce annua | Prompt-driven | Legacy guard-layer | Delta |
|---|---|---|---|
| Costo LLM | $133k | $504k | +$370k |
| Manutenzione (1 dev) | $5k | $40k | +$35k |
| Nuove feature (10/anno) | $5k | $30k | +$25k |
| Onboarding (2 hire/anno) | $0.5k | $10k | +$9.5k |
| Layer di sicurezza (one-shot) | $8k | $0 | -$8k |
| Storage audit log | $2k | $0 | -$2k |
| **Totale anno 1** | **$153k** | **$584k** | **+$431k** |

### Latenza

- Prompt-driven (1 LLM call/turno): ~800-1500ms p50, ~2500ms p95
- Legacy (4 LLM call sequenziali): ~3000-4500ms p50, ~7000ms p95

Su WhatsApp sotto 1.5s p50 = drop-off più basso.

### Quando il costo cresce in modo non lineare

History lunga (dopo turno 30 ~10-15k token non-cached → sliding window); sessioni patologiche (50+ turni → `maxTurnsPerSession`); cache miss frequenti (edit frequenti dei prompt in prod → rilascia in batch, tieni i file stabili).

---

## 18. Anti-allucinazione

Il rischio principale è che il modello inventi dati (prezzi, orari, codici) invece di pescarli dal prompt.

### 18.1 Dati strutturati in tabelle markdown

Il modello allucina **molto meno** su dati tabellari. In `locations/*.md` e `machines/*.md` i dati stanno in tabelle (prezzi *per numero macchina* con colonne Fidelización/Efectivo, codici display con significato + azione). Ogni cella ha un solo valore estraibile.

### 18.2 Regola esplicita "non inventare"

In `common.md` (inizio): se il cliente chiede prezzo/orario/codice/procedura non documentato → NON inventare, dichiararlo, elencare le 6 sedi valide o chiedere di rileggere la pantalla. Claude 4.x segue l'istruzione con alta affidabilità se esplicita e in testa al prompt.

### 18.3 Temperature = 0.3

Sotto 0.2 robotico (perde empatia); sopra 0.5 derive creative; 0.3 = equilibrio. **La temperatura non riduce le allucinazioni** — le rende solo più consistenti. Le armi vere sono §18.1 e §18.2.

### 18.4 Tool deterministico per dati critici (opzionale)

Per dati dove l'errore è inaccettabile (importi addebitati, dati legali) si potrebbe aggiungere `get_price(...)` che legge da JSON deterministico. **Per Demowash non lo facciamo** (prezzi pubblici, errore tollerabile, ROI negativo). Per casi finanziari/sanitari lo aggiungerei sempre.

### 18.5 Test E2E con assert sui dati critici

Pochi test che girano ad ogni model upgrade (es. "Mataró — lavadora 4 = 6,50€ fidelización / 7€ efectivo") catturano ~90% delle regressioni su allucinazioni dati. Costo: pochi centesimi a run.

### 18.6 Hard-script + esempi negativi concreti

Per i flussi rigidi (escalation, conferme) il prompt deve: fornire il **testo esatto** in ogni lingua (no parafrasi) con `[placeholder]`; elencare **esempi negativi concreti** ("❌ MAL: … ← inventato"); vietare aggiunte dopo il template. Caso reale: il bot post-escalation aggiungeva *"Mientras tanto puedes usar otra lavadora (la 1, 3 o 5) sin coste"* — tutto inventato. Fix: esempi negativi + template hard-scriptato → invenzioni 3/3 → 0/3. Si abbina al pattern "Tool refuses, LLM corrects" (§7.3): il validator garantisce la precondizione strutturale, il template hard-script garantisce l'output testuale.

---

## 19. Quando scegliere questo paradigma

### Prompt-driven (questo)

Cliente SMB (lavanderia, ristorante, parrucchiere); 20-50 casi d'uso; volume <100k msg/giorno; compliance leggera; team piccolo (1-2 dev); time-to-market critico; margine basso per messaggio; il cliente vuole poter modificare il bot da solo (editando markdown).

### Legacy guard-layer (XState + guard)

Enterprise regolato (banca, sanità, telco); 100+ casi, multi-tenant forte; >1M msg/giorno con SLA forti; audit log per legge; team grande con turnover; necessità di ricostruire deterministicamente "perché il bot ha detto X"; lifecycle >5 anni.

### La via realistica per la maggioranza: prompt-driven + hardening host

Prompt-driven + i punti prioritari della §14 (PII redaction ✅, cap costo + sliding window, per-session lock ✅, audit log strutturato). Si resta ~30× più snelli del legacy con garanzie operative comparabili sui rischi reali.

---

## 20. Riferimenti

- `usecases.md` (+ traduzioni `usecases_*.md`) — i casi funzionali (fonte di verità funzionale)
- `agent.ts` — orchestratore, turn loop, tool dispatch, cache, `chatbotFn`, REPL/batch
- `state.ts` — `SessionState`, patches/mirror, lingua (sentinel trailer), counters
- `pii.ts` — redaction PII + `detectVenue`
- `settings.json` — configurazione operativa
- `test-contract.ts` — contract test della shape I/O

---

*Documento aggiornato: 2026-06-12 — allineato al codice (agent.ts, state.ts, pii.ts, settings.json, prompts/): 4 tool, blocco FRANCHISING CONSULTATION, slot consulenza dinamici.*
