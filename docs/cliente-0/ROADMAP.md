# Cliente-0 — Roadmap

**Owner**: Andrea
**Last updated**: 2026-05-02
**Stato**: Step A approvato, Step B da decidere a fine Step A.

---

## Visione

Un assistente WhatsApp **fluido e multilingua** per l'Ecolaundry self-service. Il cliente deve poter:

- spiegare il problema con parole sue, in qualsiasi lingua
- cambiare argomento in qualsiasi momento
- ricevere risposte calde, mai robotiche
- essere guidato passo-passo solo nei troubleshooting tecnici

Il bot deve essere **packaged**: un singolo motore, configurato per tenant via JSON, zero conoscenza di business hardcoded.

---

## Stato attuale (2026-05-02)

✅ **Funziona**:
- 32 use case di acceptance (UC1–UC32) verdi (1 LLM-flaky)
- 4 LLM coordinati (Router, Specialist washer/dryer, History, Security)
- Flow engine JSON-driven con location overrides
- Sticky facts per la conversazione
- Pause/resume di flow durante FAQ
- Tabella translations 6 lingue per le risposte deterministiche
- Test interattivo da CLI (`npm run demo`)
- README architetturale con golden rules

⚠️ **Fragile**:
- `chatbot.ts` 1235 righe, ~25 guard sovrapposti
- Bug ricorrenti dovuti a regex `\b` ASCII-boundary su accentate (Mataró, sé)
- Tono freddo/robotico fuori dai flow scriptati
- Escalation prematura quando il display non è riconosciuto
- Asciugatrice + display da lavatrice → bot escala invece di chiarire
- Cambio argomento in mezzo a un flow non sempre gestito

❌ **Non c'è**:
- Conversazione genuinamente fluida
- Tono empatico naturale
- Context-switching trasversale completo (PausedFaq, PausedNameCapture)
- LLM-as-agent con tool calling

---

## Step A — Refactoring strutturale (settimana 1)

**Obiettivo**: spezzare `handleTurn()` in 18 fasi numerate, debug strutturato, zero cambi di comportamento sui 32 usecase.

Dettaglio in [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md).

### Deliverable

- `apps/backend/custom-client-0/phases/` con 18 file ~30-80 righe ognuno
- `chatbot.ts` ridotto a ~150 righe (solo orchestrazione)
- Debug trace strutturato che mostra quale fase ha deciso e perché
- Suite usecase verde (32/32) a ogni step intermedio
- 5 nuovi test transversali (TS-1...TS-5) per il context-switch

### 8 step incrementali

1. Skeleton phases/ + Decision type + loop in chatbot.ts
2. Estrai P0 closureAck + P3 customerNameCapture
3. Estrai P1 preprocess + P5 language
4. Estrai P2 earlyDetectors
5. Estrai P6 P7 (FAQ multi-turn + detect + pause)
6. Estrai P9 routerLLM + P9.5 topicSwitch + P10 P11 P12 (gather + sticky)
7. Estrai P13 P14 (double-charge, paid-not-activated)
8. Estrai P15 P16 P17 (specialist + render + escalation)

### Bug fix in coda allo Step A (dopo step 8) — calibrati con CANONICAL_FLOWS

Vedi tabella completa in [`CANONICAL_FLOWS.md`](./CANONICAL_FLOWS.md#bug-noti-rispetto-alla-doc).

- F1 — Bug B1 + B7: Mataró + ordine numero/pagato/display (Caso 1, 2, 3) → fix in P10/P11
- F2 — Bug B2: Caso 4 deve SALTARE display, andare su "cambio devuelto?" → fix in P14
- F3 — Bug B3: Caso 7 deve SALTARE tipo+numero, andare diretto su "cambio devuelto?" → fix in P14
- F4 — Bug B4: tono di apertura sempre caldo ("Tranquilo, te ayudo"), non solo per angryTone → fix in P16 prompt history
- F5 — Bug B5: AL001 prova chiarimento (Caso 5) prima di escalare, NON è auto-escalate → fix in P12
- F6 — Bug B6: ALN identifica prima local+tipo, poi escala (Caso 13) → fix in P12
- F7 — Asciugatrice + display lavatrice (PUSH PROG): bot chiarisce mismatch → fix in P11
- F8 — Cliente in escalation che dice "ho risolto" (uscita pulita) → fix in P3
- F9 — Cambio fatto sticky in mezzo conversazione (es. "no aspetta è la 5") → fix in P9.5

### Criteri di completamento Step A

- [ ] 8 step committati separatamente
- [ ] Suite usecase 32/32 verde
- [ ] 5 test transversali TS-1...TS-5 verdi
- [ ] 5 fix funzionali F1...F5 verificati con dialog reali
- [ ] `chatbot.ts` < 200 righe
- [ ] Debug trace leggibile (`--debug` mostra quale fase ha vinto in ogni turno)

**Tempo stimato**: 3-4 sessioni di lavoro intenso.

---

## Step B — Agent-mode (decisione dopo Step A)

**Obiettivo**: trasformare il bot da "questionario guidato con interruzioni gestite" a "agente conversazionale che chiama tool per i flow tecnici".

### Cambiamenti chiave

- **1 LLM agente principale** (system prompt riscritto come agent) tiene memoria sticky, decide cosa chiedere, gestisce tono empatico naturalmente
- **Flow JSON come tool callable** (function calling): l'agent chiama `start_washer_no_start_flow(machineNumber)` quando serve guidare il troubleshooting tecnico
- **History LLM ridotto** o assorbito nell'agent
- **Guard deterministici minimi**: solo per intent ad altissimo costo (escalation, reset, name capture)
- **Test riscritti**: meno assertion `includes`, più assertion semantiche (es: "il bot ha capito che siamo a Goya?", "il bot è tornato al flow ALM dopo la FAQ?")

### Pro

- Conversazione fluida nativamente
- Tono empatico senza prompt-engineering arzigogolato
- Context-switching trasversale gratis (l'agent ha tutto il contesto)
- Aggiungere un caso = aggiungere un tool, non una fase

### Contro

- Meno deterministico → suite test va riscritta
- Costo LLM più alto (1 chiamata grande per turno invece di 4 piccole)
- Più difficile riprodurre bug esatti
- Modello GPT-4o-mini potrebbe non bastare → eventuale upgrade a GPT-4o full

### Decisione richiesta a fine Step A

- **Stesso modello GPT-4o-mini?** test costi e qualità
- **Test policy?** assertion semantiche o ancora `includes`/`excludes`?
- **Backup deterministico?** mantenere la pipeline a fasi come fallback se l'agent fallisce?

**Tempo stimato**: 1-2 settimane.

---

## Step C — Packaging tenant-ready (dopo Step B)

**Obiettivo**: rendere il bot replicabile su altri clienti senza toccare TS.

- `tenant-init` CLI scaffolding (genera `config/` partendo da template)
- Tutto il business in `config/` montato a runtime, codice TS in package npm separato
- Linter `validate-tenant-config` che verifica coerenza
- Documentazione di onboarding (un nuovo cliente arriva → in 1 giorno il suo bot è online)

**Tempo stimato**: 1 settimana.

---

## Bug noti da chiudere (priorità ordinata)

| Priorità | Bug | Fase di risoluzione |
|---|---|---|
| P0 | Tono freddo / robotico | Step A F4 + Step B |
| P0 | Escalation prematura | Step A F3 |
| P0 | Mataró non chiede via in alcuni flow | Step A F1 |
| P0 | Asciugatrice + display lavatrice | Step A F2 |
| P1 | Cliente che esce dall'escalation | Step A F5 |
| P1 | Cambio argomento in mezzo a flow | Step A P9.5 |
| P1 | Cambio lingua a metà conversazione | Step A P5 |
| P2 | UC14 LLM flaky | Test retry, accettato |
| P2 | KNOWN_LOCATIONS hardcoded in TS | Step C |
| P2 | pueblo/calle/displayName in locations.json (rischio allucinazione) | Step C |

---

## Test policy

### Tests-as-bible

- `usecases_test.json` definisce il comportamento atteso per i 32 casi business
- `regressions.json` previene il ritorno di bug noti
- I dialog markdown in `docs/cliente-0/test-runs/` sono snapshot di runtime, NON assertion

### Cosa NON cambia senza approvazione di Andrea

- Le assertion `includes` / `excludes` nei test (sono lo specifico)
- I prompt template in `prompts/*.txt`
- Il prompt processor (variable replacement)
- Lo schema Prisma del backend principale

### Cosa va sempre allineato

- README cliente-0
- ROADMAP cliente-0 (questo file)
- REFACTORING_PLAN cliente-0
- 02reglas.md (regole business)

---

## Note di lavoro

- **Andrea non vuole worktree, sempre su `main`** (CLAUDE.md)
- **Andrea fa i commit a mano** (mai `git commit` da agente)
- **Niente integration test** (solo unit test, vedi CLAUDE.md 7B)
- **Tests-are-bible** (CLAUDE.md 7A)
- **Solo modifiche pratiche, niente refactor a sorpresa** (CLAUDE.md 13)

---

## Cronologia

- 2026-05-02 — Roadmap creato. Step A approvato.
- 2026-05-02 — REFACTORING_PLAN.md scritto con sezione 2-bis transversal context-switching.
- 2026-05-02 — Bug Girona→Goya, Mataró ASCII-boundary, location-loop, hardcoded SP fixati come tappe-buchi (saranno consolidati in Step A).
