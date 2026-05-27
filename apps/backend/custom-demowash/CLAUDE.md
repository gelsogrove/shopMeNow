# custom-ecolaundry-v2 — POC (Statechart-driven)

POC parallelo a `custom-ecolaundry/` (v1). v1 resta intatto e in produzione.
v2 dimostra il pattern statechart su un solo branch (`trouble-machine`).

## Perché v2

v1 ha 6 difetti strutturali documentati in `docs/v1-defects.md`:

1. **Stato sparso in 10+ campi** mutati indipendentemente da guard diverse
2. **Guard pipeline ad accumulo, stateless dentro stato**
3. **Router LLM single point of failure**
4. **Cleanup parziale**: `releaseActiveFlow` non azzera i fact
5. **Manca boundary-reset post-troubleshooting**
6. **Iron rules contraddittorie** (#1 + #6 + #14)

v2 risolve #1, #2, #4, #5 by design (statechart). #3 e #6 sono mitigati dalla
separazione di layer (detector ≠ statechart).

## Stack

- `xstate@^5.19.0` — statechart Harel, transizioni dichiarative, on-exit hooks
- `ts-pattern@^5.5.0` — pattern matching esaustivo (compile-time exhaustiveness)
- TypeScript strict, ESM, Node 22

## Layout

```
custom-ecolaundry-v2/
├── package.json
├── tsconfig.json
├── CLAUDE.md                          ← questo file
├── docs/
│   ├── architecture.md                ← layer diagram + cleanup contract
│   ├── side-by-side.md                ← confronto v1 vs v2
│   └── v1-defects.md                  ← root cause analysis
├── prompts/                           ← (futuro) prompts dedicati v2
└── src/
    ├── machines/
    │   ├── types.ts                   ← TroubleContext, TroubleEvent, DisplayCode
    │   └── trouble-machine.machine.ts ← la statechart (single source of truth)
    ├── adapters/
    │   ├── event-detector.ts          ← raw text → TroubleEvent (deterministico)
    │   └── orchestrator.ts            ← actor wrapper, processTurn(text)
    └── demo/
        └── trouble-machine-demo.ts    ← replay conversazione bug Andrea
```

## Iron rules v2 (3 sole, sostituiscono le 8 di v1)

### Rule 1 — La statechart è la sola autorità sullo stato del dialogo

- ❌ Nessun altro layer può scrivere su `TroubleContext`
- ✅ Solo `assign(...)` dentro la statechart muta il contesto
- **Perché**: elimina il difetto #1 (stato sparso). Un solo posto da capire.

### Rule 2 — Il detector emette eventi, non muta stato

- `event-detector.ts` riceve testo, ritorna `TroubleEvent`
- ❌ Nessuna mutazione di stato nel detector
- ✅ Determinismo prima (regex/token), LLM-assist solo come fallback
- **Perché**: elimina il difetto #6 (router unico arbitro). Layer separati.

### Rule 3 — Cleanup è on-exit, mai manuale

- ❌ Nessun chiamante può azzerare `displayState`/`machineType`/`machineNumber`
- ✅ L'azzeramento avviene solo via on-exit/on-entry hook della statechart
- Esempio: `entry: ['resetOperationalFacts', 'emitResolutionAck']` su `resolved`
- **Perché**: elimina i difetti #4 e #5 (cleanup parziale + boundary mancanti)

## Cosa NON ci sta in v2 (rispetto a v1)

Niente di tutto questo serve perché la statechart lo cattura by design:

- `guardForceLocation` / `guardForceMachineType` / `guardForceMachineNumber` /
  `guardForceDisplay` → sostituiti dal compound state `gathering` con `always`
  che valuta i campi mancanti
- `guardAutoStartMachineFlow` → sostituito dalla transizione `gathering` →
  `flow` quando `allFactsCollected` guard è true
- `guardResolutionAck` → sostituito dall'`entry` action di `resolved`
- `releaseActiveFlow` + `resetMachineFacts` → unificati in `resetOperationalFacts`
  on-entry di `resolved`
- `applyBranchEntryResets` → non serve: `closed` è terminale assorbente
- `boundary-resets` per trouble-machine → eliminati (terminal state assorbente)
- Sticky `activeBranch` → eliminato (lo stato dice tutto)

## Come testare

```bash
cd apps/backend/custom-ecolaundry-v2
npm install
npm run typecheck
npm run demo:trouble
```

Output atteso: `✅ BUG FIXED: v2 closes the dialogue cleanly. DOOR is gone.`

## Cosa serve per portare v2 in produzione

Non oggi — questo è solo un POC. Per produzione:

1. **Tutti i branch**: replicare statechart per `faq`, `escalation`, `payments`,
   `discount`, `loyalty`, ecc.
2. **Bridge i18n**: leggere `json/i18n/*.json` di v1 e mappare i `pendingReply.i18nKey`
3. **LLM integration**: orchestrator chiama il modello con `stage` come hint di tono
4. **Persistenza**: serializzare snapshot XState in DB per resume cross-session
5. **Tool calls**: integrare `set_machine_facts`, `set_display_state`, ecc. come
   side effects dichiarativi nelle transizioni
6. **F-log + cases.json**: portare il sistema di tracciamento

Stima onesta: **2-3 settimane** se va liscia, **4-5** realisticamente.

## Decisione architetturale registrata

- **Data**: 2026-05-27
- **Decisore**: Andrea (dopo lunga discussione su difetti v1)
- **Scelta**: XState (libreria) + ts-pattern
- **Alternative scartate**: LangGraph (troppo invasivo), Rasa (cambio stack Python),
  Mastra (troppo giovane), Botpress/Dialogflow (lock-in)
- **Reasoning**: XState aggiunge solo il layer di stato, non riscrive nulla del
  lavoro fatto (router LLM, detector, i18n, prompts, F-log restano). Risolve
  4 difetti su 6 by design.
