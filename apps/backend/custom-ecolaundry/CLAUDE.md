# custom-ecolaundry — Orchestration rules (read every turn)

Questo file è auto-caricato quando lavori sotto `apps/backend/custom-ecolaundry/`. Leggilo PRIMA di ogni modifica. Le regole sotto sono non-negoziabili.

> **Documento di architettura completo**: [`architecture.md`](architecture.md) — leggilo se è la prima volta che lavori qui o se devi prendere decisioni di design. Questo file è il riassunto operativo delle iron rules.

> **Source of truth funzionale**: [`usecases.md`](usecases.md) — i 16 casi del bot. Riscrittura in moduli (`prompts/common.md` + `prompts/machines/*.md` + `prompts/locations/*.md`) in corso.

---

## 🔒 Le 13 iron rules — verifica su ogni modifica

### 1. Niente pezze. Logica nel prompt, non nel codice.

Se il bot risponde male, il fix sta nel prompt prima (`prompts/common.md`, `prompts/machines/*.md`, `prompts/locations/*.md`), nei tool poi (`agent.ts` handler). **Mai** un detector regex sul testo utente per intent classification.

❌ Forbidden: `if (message.includes("ordine"))`, regex su user text per route a un handler, switch su keyword per scegliere risposta.
✅ Allowed: regex per validare formato args di tool (CIF, email, IBAN, 4 cifre carta), pre-scan PII deterministico.

**Razionale**: l'LLM moderno (Claude 4.x) capisce il prompt strutturato. Le pezze regex nel codice sono il pattern che ha fatto esplodere ecolaundry a 16k righe + F-log F1→F112. Non lo rifacciamo.

### 2. State semplice e atomico. NIENTE XState.

State = oggetto `SessionState` per-sessione (oggetto TypeScript) in una `Map<sessionId, SessionState>`. Mutato **solo** via tool `remember` (merge, non replace).

```typescript
interface SessionState {
  name?:        string
  location?:    string
  machineType?: 'washer' | 'dryer'
  machine?:     number
  displayCode?: string
  language?:    'es' | 'ca' | 'en' | 'it' | 'fr' | 'pt'
  // PII fields — captured server-side, never sent to LLM verbatim:
  cif?:         string
  email?:       string
  phone?:       string
  cardLast4?:   string
  address?:     string
  companyName?: string
}
```

❌ Forbidden: XState, state machine, transition graphs, family detectors, root orchestrator. **Quello è ecolaundry.**
✅ Allowed: 15 righe di `state.ts` con `getState`, `updateState`, `resetState`.

**Razionale**: non abbiamo transizioni discrete con regole rigide. Abbiamo solo "campi che si popolano in qualunque ordine". XState è la trappola che ha portato ecolaundry alle 6 state machine + agent-bridge + family-detector. Non serve, non lo introduciamo.

### 3. Tool fanno side-effect, LLM parla.

Tool autorizzati (3 + 1 PII):

- **`remember(fields)`** — aggiorna `SessionState` (merge). Tool interno, sempre disponibile.
- **`capture_pii(fields)`** — variante di `remember` per i campi PII (cif, email, phone, cardLast4, address, companyName). Valida formato via regex, salva server-side. **Mai loggato, mai re-emesso.**
- **`escalate_to_operator({reason, summary, attachments?})`** — invia briefing all'operatore (email/Slack/Monday). L'unico vero side-effect verso il mondo esterno.
- **`close_session({outcome, notes?})`** — chiude sessione + analytics.

❌ Forbidden: tool che duplicano cose che il prompt fa già (`mark_resolved`, `set_language`, `detect_intent`, `get_prices`, `get_hours`). Tool con argomenti opzionali esplosivi (10+ campi). Tool che fanno 2 cose (es. `save_and_escalate`).
✅ Allowed: aggiungere un tool nuovo SOLO se fa un side-effect che il prompt non può fare. Discuti prima di aggiungerlo.

### 4. API pubblica per consumer esterni. Funziona ovunque.

`agent.ts` esporta:

```typescript
export interface AgentSession {
  sessionId:     string
  state:         SessionState
  history:       Message[]
  systemPrompt:  string          // cached, condiviso tra sessioni
  toolHandlers:  ToolHandlers    // iniettabili
}

export async function createAgentSession(opts: {
  sessionId: string
  toolHandlers?: ToolHandlers
}): Promise<AgentSession>

export async function agentTurn(session: AgentSession, message: string): Promise<string>

export function resetAgentSession(session: AgentSession): void
```

**Stessi `createAgentSession()` + `agentTurn()` vengono chiamati da**:
- CLI `runInteractive` (REPL)
- CLI `runBatch` (scripted)
- Backend Express (in produzione, via dynamic `import()` se ESM↔CJS interop necessario)

**Tool handler iniettabili** = stesso bot, behavior diverso per ambiente:
- **REPL/demo**: handler fake che stampano in console (es. `escalate_to_operator` stampa il briefing invece di mandare email)
- **Backend produzione**: handler reali (chiamano Prisma, sendEmail, sendSlack, ecc.)

❌ Forbidden: logica del turn duplicata in CLI e backend. Hardcoding di handler dentro `agentTurn`.
✅ Allowed: aggiungere nuovi handler iniettando un `ToolHandlers` diverso.

### 5. PII fuori dal LLM e fuori dallo storico.

**Definizione PII**: nome, telefono, email, CIF/NIF, IBAN, 4 cifre carta, numero carta full, indirizzo, ragione sociale.

**Pipeline obbligatoria** per OGNI messaggio utente in entrata, PRIMA di salvarlo in history o mandarlo al LLM:

```
1. PRE-SCAN regex deterministico su pattern strutturati:
     - email          → /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
     - CIF spagnolo   → /\b[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]\b/g
     - NIF spagnolo   → /\b\d{8}[A-HJ-NP-TV-Z]\b/gi
     - IBAN           → /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g
     - carta 16cifre  → /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
     - carta 4cifre   → regex con contesto: parole "tarjeta|carta|card|últimas 4|terminada en"
     - telefono       → /(\+34\s?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g
   Sostituisci match con placeholder ([EMAIL], [CIF], [NIF], [IBAN], [CARD_FULL], [CARD_4], [PHONE]).
   Salva i valori veri in SessionState (capture_pii).

2. DE-REDACT con state già noto (per turni successivi):
     Sostituisci occorrenze di state.name, state.address, state.companyName, ecc.
     con [CUSTOMER_NAME], [ADDRESS], [COMPANY_NAME], ecc.

3. history.push({role: 'user', content: messaggio_pulito})  ← SALVA IL PULITO

4. Mando al LLM messages (cui history è già pulita).
```

**Output del LLM**: il modello scrive con placeholder (`[CUSTOMER_NAME]`, `[CARD_4]`) perché vede solo placeholder in input. PRIMA di mostrare al cliente WhatsApp, il backend de-redacta lato display sostituendo placeholder → valori veri.

**Briefing operatore**: quando il modello chiama `escalate_to_operator({summary: "...[CUSTOMER_NAME]...[CIF]..."})`, l'handler **sostituisce i placeholder con i valori veri** dal `SessionState` prima di mandare l'email. Operatore vede dati veri, LLM non li ha mai visti.

**Limite noto**: il messaggio del turno in cui il PII viene introdotto la PRIMA volta passa parzialmente grezzo al LLM se il PII non è un pattern strutturato (es. il nome "Marco" al T1 prima che `capture_pii` lo salvi). Pattern strutturati (CIF/email/IBAN/carta) sono catturati dal pre-scan, mai grezzi.

❌ Forbidden: salvare PII in chiaro in history. Loggare PII in stdout/file. Mandare PII grezzi al LLM dopo il T1 in cui sono stati introdotti.
✅ Allowed: valori veri vivono in `SessionState` (RAM/Redis/DB cifrato at-rest in produzione) e nei briefing operatore generati al momento.

### 6. Tone vive nel prompt, non in CLAUDE.md.

Il "come parla il bot" (empatia, emoji, formalità, formule rituali) sta in `prompts/common.md`. Esempi:
- *"Tranquillo, ti aiuto"* per problemi tecnici
- *"Lo siento mucho"* per disservizi
- Emoji solo a fine messaggio o per stato emotivo (👋 saluto, ⚠️ avviso, ✅ conferma)
- Mai più di 1-2 emoji per messaggio

❌ Forbidden: regole di tone in `agent.ts`, in handler dei tool, in questo CLAUDE.md. Codice che riformula la risposta del modello per "renderla più empatica" (rephrase layer di ecolaundry — NO).
✅ Allowed: il modello produce direttamente l'output finale, con il tone del prompt.

### 7. Niente codice morto.

Funzioni, variabili, import, file, branch condizionali non più usati vanno **rimossi nello stesso commit** in cui diventano inutili.

❌ Forbidden:
- `// TODO: rimuovere dopo X`
- `// kept for backward compat`
- Funzioni con underscore prefix `_unused` "che servono dopo"
- File `.bak`, `.old`, `-deprecated.ts`
- Variabili settate e mai lette
- Import non usati
- Branch `if (false)` o `if (FEATURE_FLAG_NEVER_ENABLED)`

✅ Allowed: se "potrebbe servire dopo", **lascialo in git history**. Si recupera con `git log`. Il codice in main è solo quello che gira.

### 8. Niente test suite tradizionale.

No `__tests__/`, no `jest`, no `vitest`, no `mocha`. Niente file `*.test.ts` o `*.spec.ts`.

**Razionale**: il bot è LLM-driven, l'output non è deterministico byte-per-byte. Test unitari su LLM call sono fragili (assert fuzzy o falsi rossi). Test deterministici sul codice di orchestrazione (15 righe di state, 80 di redaction, 200 di dispatcher) hanno ROI negativo.

✅ Verifica obbligatoria: `npm run demo -- --debug` (REPL) o `npm run demo -- --batch '[...]' --debug` (scriptato).

### 9. Strumento unico di debug: `npm run demo -- --debug`

Quando `--debug` è attivo, `agent.ts` stampa:

- **`[usage]`** prompt/completion tokens, cache_read, cache_write (per verificare costi e cache hit rate)
- **`[tool_call]`** nome del tool + args (es. `remember({location: "Sants"})`) — per verificare che il modello chiami i tool giusti
- **`[state]`** SessionState dopo ogni turno (es. `name=Marco location=Sants machine=5 display=DOOR`)
- **`[pii_redacted]`** elenco dei pattern PII oscurati nel messaggio utente corrente (es. `email→[EMAIL], cif→[CIF]`)

❌ Forbidden: print di PII grezzi in `--debug` (anche in debug, gli `[state]` di campi PII devono essere oscurati o omessi).
✅ Allowed: stampare placeholder (`[CIF]` invece di `B12345678`).

### 10. Settings.json solo per configurazione operativa.

`settings.json` contiene:
- `model` (es. `"anthropic/claude-haiku-4.5"`)
- `temperature` (es. `0.3`)
- `maxTokens` (es. `800`)
- `maxHistoryTurns` (es. `20`, per sliding window)
- `maxToolHops` (es. `3`)
- `cacheControl` (true/false, per disattivare in test)
- `operatorBriefingLanguage` (es. `"es"`)
- `enabledLanguages` (es. `["es","ca","en","it","fr","pt"]`)

`settings.json` **NON** contiene:
- Comportamento del bot (sta in `prompts/`)
- Liste valide di location/machine/tool (stanno in `prompts/locations/*.md`, `prompts/machines/*.md`)
- Tone, formule, traduzioni (stanno in `prompts/common.md`)
- API key (sta in `.env`)

❌ Forbidden: mescolare config operativa e comportamentale (errore di ecolaundry).
✅ Allowed: aggiungere campi operativi nuovi quando servono, documentarli in `architecture.md` §11.

### 11. Anti prompt-injection di base.

Pipeline obbligatoria per ogni messaggio utente in entrata, PRIMA della redaction PII:

1. **Sanitize**: strip caratteri di controllo, zero-width (`​`-`\u200F`), bidi (`\u202A`-`\u202E`).
2. **Cap lunghezza**: max 2000 caratteri per messaggio. Eccedenza → troncata.
3. **Rate limit per sessionId**: max N messaggi/minuto (configurabile, default 30).
4. **Cap turni per sessione**: max 50 turni, poi sessione force-close con outcome="abandoned".

❌ Forbidden: fidarsi di istruzioni in `role: user` ("ignora le istruzioni precedenti"). Il modello le ignora già nativamente, ma sanitize + cap riducono la superficie d'attacco.
✅ Allowed: il system prompt resta statico cached, mai modificato da input utente.

### 12. State per-sessione, prompt condiviso.

Lo `SessionState` è **per `sessionId`** (in produzione = numero WhatsApp del cliente). Il system prompt cached (`common.md` + `machines/*.md` + `locations/*.md`) è **condiviso tra TUTTE le sessioni**.

Multi-tenant (quando attivato): chiave dello state = `workspaceId + sessionId`. Filtra sempre per `workspaceId` ad ogni read/write (regola critica del backend principale).

❌ Forbidden: state globale che mischia utenti. Modificare il system prompt per-sessione (rompe la cache).
✅ Allowed: estensione futura a Redis/DB con interfaccia `getState`/`updateState` invariata.

### 13. Concurrency safety per-sessionId.

Se lo stesso `sessionId` riceve 2 messaggi in rapida successione, devono essere processati **in serie**, non in parallelo. Race condition garantita altrimenti su `SessionState`.

Pattern: lock async per-sessionId (Map<sessionId, Promise>). Il secondo messaggio aspetta che il primo completi. Idempotency keys sui tool con side-effect (es. `escalate_to_operator` non manda 2 email per la stessa incidencia).

❌ Forbidden: due `agentTurn()` paralleli per lo stesso `sessionId` senza lock.
✅ Allowed: parallelismo tra `sessionId` diversi (ognuno ha il suo lock).

---

## 🛡 Cosa NON c'è (e perché)

Tabella di riferimento per non re-introdurre pattern di ecolaundry:

| Componente di ecolaundry | Perché NON esiste qui |
|---|---|
| State machine XState (`machines/`) | Iron rule #2: state è oggetto + Map, non grafo di transizioni |
| Guard pipeline (`utils/guards/`) | Iron rule #1: logica nel prompt |
| Branch router LLM | 1 sola call LLM/turno |
| Family detector | Idem |
| Fact extractor deterministico | Iron rule #2: usa tool `remember`, non regex sul testo libero |
| Rephrase layer (LLM polish) | Iron rule #6: tone nel prompt, modello produce output finale |
| Language enforcer (LLM extra) | Claude 4.x rispetta la lingua nativamente |
| `display-flows.json` (flow engine) | Codici display descritti in prosa in `machines/*.md` |
| `faqs.json` separato | FAQ integrate in `common.md` |
| `i18n/<lang>.json` × 6 | Una fonte (markdown), il modello traduce nativamente |
| F-log + regression pinning | Iron rule #8: no test suite |
| `check-architecture.sh` | Iron rule #7 + #8: enforcement via code review, non script |
| 1600 unit test | Iron rule #8 |
| `bug-intake-protocol` 7-step | Iron rule #1: meno superficie = meno bug ricorrenti |
| `triple-update rule` (usecases + unit + agent) | Iron rule #8: aggiorni `prompts/` + verifichi con `--debug` |
| `cases.json` (bridge usecase ↔ codice) | I casi vivono nel prompt, niente codice da mappare |

---

## 🎯 Pre-edit checklist (mentale, ogni modifica)

Prima di ogni edit, rispondi:

1. **Sto facendo bene?**
   - Fix al layer giusto: prompt prima, tool poi, mai detector regex su testo libero?
   - Address root cause o symptom?
   - Design estendibile a future location/macchine/casi senza copy-paste?

2. **Sto rompendo cache?**
   - Sto modificando il blob cached (file in `prompts/`)? OK ma invalida la cache (paghi 1 cache_write).
   - Sto modificando l'assembly del system prompt in `agent.ts`? Verifica che ordering sia deterministico (alphabetico) sennò la cache si invalida ad ogni boot.

3. **Sto introducendo PII leak?**
   - Il nuovo codice salva qualcosa in history o stampa qualcosa in log?
   - Quel qualcosa potrebbe contenere PII?
   - Se sì, passa per `redactPII()` prima di salvare/stampare?

4. **Sto introducendo codice morto?**
   - L'edit lascia funzioni/variabili/import non più usati? Rimuovi nello stesso commit.

5. **Sto introducendo XState o state-machine pattern?**
   - Se sì, **stop**. Discuti con Andrea PRIMA di scrivere codice. Probabile violazione di iron rule #2.

**Dopo l'edit**:
- `npm run typecheck` — type-level breakage
- `npm run demo -- --debug` — verifica behavior almeno sui casi toccati

---

## 🚨 Niente pezze (richiamo Andrea, 2026-05-23 da ecolaundry)

> *"Niente pezze. Sistema espandibile. Segui architettura altrimenti perdiamo il controllo."*

- **Identifica il layer prima**: prompt / tool / state / handler. Giustifica perché è quello giusto.
- **Niente patch a livello sintomo**. Fix la causa nel layer corretto.
- **Niente duplicati backward-compat**. Quando cambi un contratto, update tutti i call site.
- **Design espandibile**. Un fix per Ecolaundry deve scalare ai prossimi clienti.
- In dubbio → **chiedi ad Andrea** prima di applicare.

---

## 📊 Comandi utili

```bash
npm run typecheck                              # tsc --noEmit
npm run demo                                   # REPL interattivo (richiede OPENROUTER_API_KEY in .env)
npm run demo -- --debug                        # REPL con usage + tool_call + state + pii_redacted
npm run demo -- --batch '[["msg1","msg2"]]'    # batch scriptato (single session, 2 turni)
npm run demo -- --batch '[["m1"],"/reset",["m2"]]'  # multi-session
```

**Output `--debug` atteso**:
```
[USER T1] sono Marco, CIF B12345678, sto a Sants
[pii_redacted] cif→[CIF]
[tool_call] capture_pii({cif: "B12345678"})
[tool_call] remember({name: "Marco", location: "Sants"})
[usage] prompt=27750 completion=85 cache_read=27694 cache_write=0
[BOT T1] Ciao Marco! Come posso aiutarti a Sants?
[state] name=Marco location=Sants cif=[CIF]
```

---

## 🤝 Cosa faccio sempre, su ogni modifica

1. Rileggo le 13 iron rules.
2. Identifico il layer (prompt / tool / state / handler) prima di toccare.
3. Verifico con `npm run typecheck` + `npm run demo -- --debug` alla fine.
4. Aggiorno `architecture.md` quando cambio l'architettura (non per ogni bug fix).
5. In dubbio → chiedo ad Andrea, mai invento regole.

---

*Documento aggiornato: 2026-05-27*
