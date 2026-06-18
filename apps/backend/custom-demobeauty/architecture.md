# Demobeauty — Architettura

Documento di riferimento per il chatbot **custom-demobeauty**: una rete di **centri estetici in franchising** su WhatsApp. Tutto quello che serve per estendere, mantenere e portare in produzione il bot.

> ⚠️ **Allineato al codice** (`agent.ts`, `state.ts`, `pii.ts`, `settings.json`, `prompts/`). Se modifichi il codice, aggiorna qui i fatti corrispondenti (sedi, tool, shape dello state, settings). Le sezioni di *ragionamento* (cache, lingua, calendario) restano valide finché non cambia il paradigma.

---

## 1. Filosofia

**Il modello LLM è il motore primario.** La logica di business vive nel **prompt**; il codice fa solo ciò che il prompt non può fare:
- side-effect verso il mondo esterno (email di conferma al cliente, briefing all'operatore, evento calendario)
- persistenza dello state per-sessione (incluso il carrello)
- redaction PII (pre-scan deterministico, fuori dall'LLM esterno)
- validazione deterministica degli argomenti dei tool (slot, carrello)

Claude 4.x con un system prompt ben strutturato gestisce nativamente: scelta della sede, listino/prezzi per sede, carrello multi-item, calcolo durata e orario di fine, upsell, escalation, lingua sticky multi-turno, e routing cross-sede quando un servizio non è disponibile.

---

## 2. Stack

- **Runtime**: Node.js 22+ ESM via `tsx`
- **Linguaggio**: TypeScript stretto (`noUnusedLocals`, `noUnusedParameters`)
- **LLM provider**: OpenRouter (`OPENROUTER_API_KEY` dal `.env` locale)
- **Modello default**: `anthropic/claude-haiku-4.5` (configurabile via `settings.json` o env `LLM_MODEL`)
- **Prompt caching**: nativo Anthropic, `cache_control: { type: 'ephemeral' }`, TTL 5 min
- **Email**: `nodemailer` su SMTP Gmail. Senza SMTP, i messaggi vengono loggati in console (dev).
- **Persistenza**: in dev `Map` in RAM; in produzione lo state va su Redis/DB del backend host, e i `patches` vengono scritti nella tabella `Customers`.

---

## 3. Struttura filesystem

```
custom-demobeauty/
├── architecture.md          ← questo documento
├── CLAUDE.md                ← regole di orchestrazione + iron rules
├── prompts/
│   ├── common.md            ← comportamento del bot (welcome, sede, carrello, prenotazione, media, push, escalation, tono)
│   ├── franchising.md       ← interesse ad aprire un centro (lead → operatore)
│   ├── faqs.md              ← FAQ integrate nel prompt
│   └── locations/
│       ├── navigli.md       ← Milano — 3 specialiste, laser, capacità 3
│       ├── isola.md         ← Milano — 2 specialiste, no laser/gel, capacità 2
│       └── monza.md         ← Monza — 2 specialiste, no laser/gel, capacità 2
├── agent.ts                ← orchestratore: assembly prompt, tool dispatch, turn loop, REPL/batch, chatbotFn (entry host)
├── state.ts                ← SessionState (incl. carrello), patches, lingua (sentinel trailer), rate-limit/turn counters
├── pii.ts                  ← redaction PII (pre-scan, de-redact, substitute) + detect sede
├── index.ts                ← re-export di chatbotFn per l'import dinamico del backend
├── settings.json           ← configurazione operativa (modello, email, audio, cap)
├── package.json
└── tsconfig.json
```

> ⚠️ **Per sede**: servizi, prezzi, orari, specialiste (in `prompts/locations/*.md`). **Uguali in tutta la rete**: il catalogo **prodotti** (stessi prodotti e prezzi in ogni sede) e il **calendario** (uno solo per tutto il franchising).

---

## 4. Assembly del system prompt

Costruito una volta al boot (`buildSystemPrompt`) e cachato. Ordine deterministico (byte-identico tra i boot → cache hit):

```
common.md
  → ════════ FRANCHISING ════════   + franchising.md
  → ════════ FAQS ════════          + faqs.md
  → ════════ LOCATIONS ════════     + locations/*.md (ordine alfabetico: isola, monza, navigli)
```

A ogni turno il prompt cachato è seguito da un blocco **RUNTIME** non cachato (data/ora, Turn, privacy URL, lingua briefing operatore, **slot disponibili per la sede agganciata**) e dal blocco **SESSION STATE** (nome, sede, servizio, carrello, appuntamento, lingua).

---

## 5. Tool (4)

| Tool | Scopo |
|---|---|
| `remember` | salva nome / sede / servizio di interesse (merge semantics) |
| `update_cart` | sostituisce il carrello con la lista completa di servizi + prodotti (REPLACE) |
| `book_appointment` | prenota: valida sede+nome+telefono+email+slot, crea evento calendario, invia email, **svuota il carrello** |
| `escalate_to_operator` | briefing all'operatore + `shouldEscalate=true` → l'host disattiva il bot (`activeChatbot=false`) |

I tool **validano** gli argomenti e rifiutano con un errore istruttivo se mancano prerequisiti (es. `missing_sede`, `missing_email`): l'LLM corregge. Nessuna patch nel prompt (vedi CLAUDE.md).

---

## 6. State per-sessione

`SessionState` (in `state.ts`): `name`, `location` (Navigli/Isola/Monza), `service`, **`cart: CartItem[]`** (servizi + prodotti, in memoria), `language`, `appointmentDate/Time/Type`, profilo (`phone`, …) e campi PII (server-only). Il carrello si svuota dopo una prenotazione confermata (`resetCart`). I `patches` (name, language, phone, …) vengono drenati e mirrorati nella tabella `Customers` dell'host.

---

## 7. Lingua, audio e media

- **Lingua**: l'LLM dichiara la lingua via trailer `⟦LANG:xx⟧`; `commitLanguageFromReply` la persiste a fine turno. Nessun elenco fisso, nessun regex sull'intento.
- **Audio**: `settings.json` ha `audioOutput: true` + voci per lingua; l'host specchia la modalità (testo→testo, audio→audio).
- **Media**: foto, audio e PDF inviati/ricevuti dal cliente; foto/documenti che richiedono valutazione professionale → check-up in sede o operatore.

---

## 8. Calendario (produzione)

**Un unico calendario per tutto il franchising.** Ogni prenotazione è un evento taggato `[SEDE][CATEGORIA][SPECIALISTA]`, con cliente + servizi + prodotti nella descrizione. La disponibilità per sede = eventi nella finestra oraria vs capacità della sede. L'handler reale (`bookAppointment`) è **iniettato dall'host**; in REPL/batch è assente → slot demo fissi (`getAppointmentSlots`) con alcuni slot volutamente "occupati" per mostrare il caso *slot non disponibile*.

---

## 9. PII

Pipeline in `pii.ts`: pre-scan deterministico (email, telefono IT, codice fiscale, IBAN, carta) → redaction con placeholder → l'LLM esterno vede solo i placeholder → de-substitute con i valori reali solo quando si invia all'operatore/email. La PII non viene mai mirrorata nei `patches` né rimandata all'LLM nei turni successivi.

---

## 10. Integrazione backend

L'host (`CustomClientChatbotService`) risolve `custom-demobeauty/index.ts` dinamicamente da `workspace.customChatbotId = "demobeauty"` (nessun registry da estendere) e chiama `chatbotFn(input)`. Su `shouldEscalate=true` l'host invia il briefing e imposta `activeChatbot=false`. Vedi `apps/backend/src/services/whatsapp/whatsapp-inbound.pipeline.ts`.
