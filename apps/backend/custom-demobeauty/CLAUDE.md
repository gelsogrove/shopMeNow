# custom-demobeauty — Orchestration rules (read every turn)

Questo file è auto-caricato quando lavori sotto `apps/backend/custom-demobeauty/`. Leggilo PRIMA di ogni modifica. Le regole sotto sono non-negoziabili.

> **Architettura completa**: [`architecture.md`](architecture.md) — leggilo se è la prima volta che lavori qui o se devi prendere decisioni di design. Questo file è il riassunto operativo delle iron rules.

Dominio: rete di **centri estetici in franchising** (Demobeauty). Sedi demo: **Navigli**, **Isola**, **Monza**.

---

## 🔒 Le iron rules — verifica su ogni modifica

### 1. Niente pezze. Logica nel prompt, non nel codice.
Se il bot risponde male, il fix sta **prima nel prompt** (`prompts/common.md`, `prompts/faqs.md`, `prompts/locations/*.md`), **poi nei tool** (`agent.ts`). **Mai** un detector regex sul testo utente per classificare l'intento.
- ❌ `if (message.includes("prenota"))`, regex su user text per scegliere una risposta.
- ✅ regex per validare gli argomenti di un tool (email, slot), pre-scan PII deterministico.

### 2. State semplice e atomico. Niente XState.
State = oggetto `SessionState` per-sessione in una `Map`. Mutato via `remember` (merge), `setCart`/`resetCart` per il carrello. Niente state machine, niente transition graph.

### 3. Tool fanno side-effect, l'LLM parla. (4 tool — `agent.ts` TOOLS è l'unica fonte di verità)
- **`remember`** — name / location (Navigli·Isola·Monza) / service. Niente campo `language`, niente PII.
- **`update_cart`** — sostituisce il carrello (servizi + prodotti) con la lista completa. Prezzi/durate solo dalle LOCATIONS.
- **`book_appointment({slotIndex})`** — prenota: valida sede+nome+telefono+email+slot, crea l'evento nel calendario, invia email, **svuota il carrello**. Idempotente (una prenotazione per sessione).
- **`escalate_to_operator({reason, summary})`** — briefing operatore + `shouldEscalate=true`. Idempotente per (sessione, reason).
- ❌ Non aggiungere tool che duplicano ciò che il prompt fa già (`get_prices`, `set_language`, `detect_intent`). Un tool nuovo SOLO per un side-effect che il prompt non può fare — discutilo prima.

### 4. Tool rifiuta, l'LLM corregge.
I tool validano args + semantica e ritornano un errore istruttivo (`missing_sede`, `missing_email`, `already_booked`, slot invalido). Non si "aggiusta" nel prompt: si rifiuta nel tool e l'LLM ri-chiede al cliente.

### 5. Lingua via trailer, non via tool.
L'LLM dichiara la lingua come trailer `⟦LANG:xx⟧`; `commitLanguageFromReply` la persiste a fine turno (sticky). Nessun elenco fisso di lingue, nessun regex sull'intento. Audio: `audioOutput: true` + voci per lingua in `settings.json`; l'host specchia la modalità (audio→audio, testo→testo).

### 6. Settings sono legge.
`settings.json` è la fonte di verità per la config del tenant (modello, email, audio, cap, privacy URL). Niente valori operativi hardcoded nel codice.

### 7. Niente codice morto, file < ~150 righe per responsabilità.
`agent.ts` orchestrazione, `state.ts` state+carrello+lingua, `pii.ts` redaction, `prompts/` contenuto. Niente import/funzioni inutilizzati (`noUnusedLocals` è attivo).

### 8. PII fuori dalla pipeline LLM.
Pre-scan deterministico in `pii.ts` → placeholder all'LLM → de-substitute solo verso operatore/email. Mai loggata, mai re-emessa nei turni successivi, mai mirrorata nei `patches`.

---

## 📐 Invarianti di dominio (non violarle)

- **Sede prima di tutto**: niente prezzi/orari/slot/prenotazioni finché la sede non è nota. Welcome → chiede la sede (Navigli/Isola/Monza).
- **Per sede**: servizi, prezzi, orari, specialiste. **Di rete (uguali ovunque)**: catalogo **prodotti** e **calendario** (uno solo per tutto il franchising, eventi taggati per sede).
- **Servizio non disponibile** in una sede → instrada alla sede più vicina che lo offre, o proponi un'alternativa locale. Mai inventare che un servizio c'è.
- **Prenotazione**: serve nome + telefono + email prima di confermare; calcola durata totale e orario di fine; offri SOLO gli slot in RUNTIME (gli altri sono occupati).
- **Carrello**: solo in memoria, si svuota dopo la prenotazione. Niente DB.
- **Escalation** per: richiesta umano, pagamenti, reclami, lead franchising, problemi su prenotazioni.
- **Media**: foto/audio/PDF ricevuti e inviati; valutazioni professionali → check-up in sede o operatore.

---

## ✅ Comandi utili

```bash
npm run typecheck     # tsc --noEmit (deve dare 0 errori)
npm run demo          # REPL locale (richiede .env con OPENROUTER_API_KEY)
npm run demo -- --debug
```

> 🚨 Non toccare gli altri custom (`custom-demowash`, `custom-demorealestate`, `custom-ecolaundry`): sono in produzione.
