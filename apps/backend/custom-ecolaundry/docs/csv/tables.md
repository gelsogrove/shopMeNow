# Coverage implementato vs CSV sorgente

Aggiornato 2026-05-23 — post-F87 (payment boundary signals cardOnly + tpvExact data-driven via `metadata.payment`), F86 (trouble-switch detection cross-flow), F83 (state-context typing in detectTopicSwitch), F82 (programs FAQ branch routing), F81 (programmi per-location), F79 (landmark resolution) + audit pueblos/calle + ricount secadoras 14/14 (era 11/11) + flagged bug `returnsChangeCoins` L'Escala/PlatjaDAro + corretta nota escalation rules.

| Categoria | Fonte CSV | Implementato | % | Note |
|---|---|---|---|---|
| **Orari** | horaris.csv | locations.json → `metadata.hours` per tutti e 6 i locali | **100%** | Tutti corretti (L'Escala 7-23, resto 8-22). |
| **Indirizzi locali** | locals.csv | locations.json → `pueblo`, `calle`, `displayName` | **100%** | Hortes (Granollers, Plaça de les Hortes 4), Alemanya (Mataró, C/ Alemanya 17), Pineda (Crta. N-II 1 Centro Carrefour), L'Escala (Av. Girona Carrefour), Platja d'Aro (Av. Castell d'Aro 37), Goya (C/ Francisco de Goya 117 Mataró) tutti allineati al CSV. |
| **Landmarks (Cerca de:)** | locals.csv col. "Cerca de:" | locations.json → `metadata.landmarks: string[]` per ogni location | **100%** | F79: Goya=[Mercadona,Biblioteca], Pineda=[Carrefour,Aldi,Bingo,Policia], L'Escala=[Carrefour], PlatjaDAro=[Carrefour], Hortes=[Plaça de les Hortes], Alemanya=[]. Letti dinamicamente da `utils/locations-landmarks.ts` (case+accent-insensitive, multi-word substring, single-word \\b). |
| **Prezzi lavadoras** | preus.csv | locations.json → `metadata.machines.washers` | **100%** | Tutti i 24 washer match il CSV (weightKg + fidelity + cash). L'Escala weightKg popolato 2026-05-22 (L1/L2=10kg, L3/L4=20kg). |
| **Prezzi secadoras** | preus.csv | locations.json → `metadata.machines.dryers` | **100%** | Totale 14 secadoras (3 Hortes + 2 Alemanya + 3 Goya + 2 Pineda + 2 L'Escala + 2 Platja d'Aro). 14/14 prezzo match (fidelity + cash). weightKg: 11/14 popolati; i 3 `null` sono Goya S1/S2/S3 perché il CSV alla fonte non specifica il peso (cella vuota in `preus.csv:12`) — JSON rispecchia fedelmente CSV. L'Escala ha `extended` tier (5€/25min). |
| **Metodi di pagamento** | instruccions-pagament-lavadora.csv + colonna "Cobrament datáfon" di preus.csv | locations.json → `metadata.payment.methods` + `metadata.payment.tpvExact` (F87) + legacy `metadata.loyaltyCard`/`returnsChangeCoins`/`tpvCobra` | **100%** | F87 (2026-05-23): nuovo `metadata.payment` per 6 location esposto al cliente nelle FAQ prezzi via `formatPaymentSignals`. `methods` correttamente `["card"]` per L'Escala/Platja d'Aro (no monete/billetes); `["coins","bills","fidelity","card"]` per le altre 4. `tpvExact: 7` per Goya, `tpvExact: 8` per Pineda (TPV importo esatto, no resto), `null` per le altre 4. Bot emette `⚠️ paymentCardOnly` per cardOnly location e `💡 paymentTpvExact` con `{amount}` per TPV exact. Smoke test live verificato su 5 location (Goya 7€ / Pineda 8€ / L'Escala+PlatjaDAro cardOnly / Hortes baseline). ⚠️ **Bug dati legacy ancora aperto (B7 pending refactor)**: `returnsChangeCoins: true` su L'Escala e Platja d'Aro nel JSON, ma il CSV dice "No". Da correggere a `false` per coerenza CSV-as-source-of-truth (data fix, no code change). |
| **Programmi lavadora** | programes.csv | locations.json → `metadata.programs.washers/dryers` per-location (F81) + PUSH PROG dinamico via `buildPushProgList` + branch router integration (F82) | **100%** | Tutti i 6 locali popolati. Goya/Pineda/Platja d'Aro: numeri 1-4, ordine 60º→Frío. L'Escala: numeri 1-5, ordine Frío→60º + Centrifugado. Hortes/Alemanya: senza numeri (null). Tutte le location: 3 programmi secadora (Alta/Media/Baja temperatura). Tradotti in 6 lingue via i18n keys (`programMuyCaliente`, `programCaliente`, ecc.). Guard `guardFaqPrograms` + `guardFaqProgramsAwaitLocation` per FAQ "¿qué programas tiene?". F82: `programs` registrato come faqKey nel `prompts/router.txt` (6 esempi cross-lang) + delegate-to-legacy gate nel `utils/branches/faq/handler.ts` per T1 (faqKey) e T2 (`pendingFlow='faq-programs-await-location'`). |
| **Codici display / allarmi** | alarmes-lavadora.csv + alarmes-secadora.csv | display-flows.json + washer_hs60xx.json + dryer_ed340.json | **90%** | SEL, PUSH, DOOR, ALM/A, ALM/E, ALM/DOOR (F77: anche space-separated), ALM/VAR, AL001, C001, ON, END, STOP tutti coperti. Codice `120` (conto alla rovescia) non gestito esplicitamente. |
| **Istruzioni uso macchine** | instruccions-us.csv | faqs.json → `howToUse` + flow generale | **60%** | Differenza Hortes/Goya/Pineda vs Alemanya/L'Escala/Platja d'Aro (step 4 diverso) non catturata — unica risposta generica. |
| **Macchine Mataró** | preus.csv (Mataró = Goya + Alemanya) | locations.json → Mataró skeleton; Goya e Alemanya popolati | **70%** | Mataró generico usato come disambiguatore; sub-locations hanno i dati completi. |
| **Extra (aclarado/lavado)** | preus.csv | locations.json → `extras.extraAclarado/extraLavado` | **100%** | L'Escala e Platja d'Aro corretti. |
| **Escalation rules** | (implicito nei CSV: "ESCALAR") | locations.json → `metadata.escalationRules` per Goya, Pineda, Alemanya, Hortes | **67%** | 4/6 locations coperte: Goya (`datafono-10eur-anomaly`), Pineda (`datafono-10eur-anomaly` + `dryer-minutes-stuck`), Alemanya (`card-payment-fail` + `dryer-minutes-stuck`), Hortes (`card-payment-fail`). L'Escala e Platja d'Aro: nessuna regola — i CSV "ESCALAR" sono solo generici, da valutare se servono regole specifiche per quei locali. |

## CSV files sorgenti

| File | Contenuto | Letto runtime? |
|---|---|---|
| `horaris.csv` | Orari di apertura per ogni location | ✅ via `metadata.hours` |
| `locals.csv` | Riferimento, indirizzo, pueblo, **landmarks (Cerca de:)** | ✅ pueblo/calle/displayName via top-level, landmarks via `metadata.landmarks` (F79) |
| `preus.csv` | Prezzi lavadora/secadora per macchina (fidelity + cash + capacità kg) | ✅ via `metadata.machines.{washers,dryers}[]` |
| `programes.csv` | Programmi lavadora/secadora per location (numero, nome, temperatura) | ✅ via `metadata.programs.{washers,dryers}[]` per-location (F81) — `buildPushProgList` per PUSH PROG dinamico, `formatWasherPrograms`/`formatDryerPrograms` per FAQ Caso 12.4 |
| `alarmes-lavadora.csv` | Codici allarme lavatrice + azione operatore | ✅ via `display-flows.json` + `washer_hs60xx.json` |
| `alarmes-secadora.csv` | Codici allarme asciugatrice + azione operatore | ✅ via `display-flows.json` + `dryer_ed340.json` |
| `instruccions-pagament-lavadora.csv` | Sequenza pagamento step-by-step lavatrice | ⚠️ riassunta in `faqs.json:howToUse` + flow `case_push` |
| `instruccions-pagament-secadora.csv` | Sequenza pagamento step-by-step asciugatrice | ⚠️ riassunta in `faqs.json:howToUse` + flow `case_push` |
| `instruccions-us.csv` | Istruzioni uso generali (autoservizio) | ⚠️ riassunte in `faqs.json:howToUse` |

## Pattern preservativo (data-driven L3)

Il CSV `locals.csv` colonna "Cerca de:" è ora **single source of truth** per i landmark. Aggiungere un landmark a una location esistente è un **JSON edit** (`metadata.landmarks[]`), nessun cambio TypeScript. Il resolver `utils/locations-landmarks.ts` legge dinamicamente — pattern replicabile per future arricchimenti (programmi-per-location, alarmi-per-location, instrucciones-us-per-location).

**Anti-pattern da evitare:** hardcodare in TS un array tipo `const LANDMARKS = ['Mercadona', 'Carrefour', ...]` o `if (msg.includes("Mercadona")) state.location = 'Goya'`. Iron rule violation #6 + non scala.

## Cross-flow architectural fixes (non CSV-coverage, ma correlati)

Questi fix non aggiungono coverage CSV, ma sono pattern preservativi che proteggono i dati CSV-driven dal venir corrotti da topic switch del cliente.

| F-num | Fix | Layer | Pattern |
|---|---|---|---|
| **F83** | `detectTopicSwitch` short-circuits su pendingFlow non-machine (`invoice-`/`discount-code-`/`loyalty-`/`faq-`) | L3 extractor | State-context typing: `pendingFlow` truthy NON implica machine context. Risposta canonica "6€" in invoice-ask-coste NON deve triggerare `nonTroubleshootingIncident='datafono-wrong-amount'`. |
| **F86** | `pivotIfTroubleSwitch` shared helper + gate in 9 step di gather (invoice 1 + discount-code 4 + double-charge 4) | L3 detector + L2 transition + L4 gate | Verbatim accept = topic-switch surface: ogni guard che fa `state.<field> = userMessage.trim()` DEVE chiamare `pivotIfTroubleSwitch` prima. Pattern `topicMachineTrouble` in `json/nlu-patterns.json` (6-lang, JSON-driven). |
| **F87** | FAQ payment location-aware (boundary signals): `metadata.payment.methods + tpvExact` esposto via `formatPaymentSignals` (helper in `utils/faq-payment-formatter.ts`) e appended a `formatWasherPrices`/`formatDryerPrices` quando `translateFn` passato dal guard | L0 data + L3 formatter NUOVO + L5 i18n + L4 wire | Data-driven location-aware: ogni dato CSV operazionale (payment methods, TPV exact) emerge come signal i18n condizionale nel reply. 2 nuove i18n key (`paymentCardOnly` ⚠️, `paymentTpvExact` 💡 con `{amount}`) × 6 lingue. Cleanup: rimossa `pricingDeflect` (6 cataloghi) + `faqs.json:pricing` (dead). Pattern identico a F50/F81. Split formatter (`faq-payment-formatter.ts`, 76 righe) per Iron rule #3. |

**Regola generalizzabile**: ogni dato CSV-driven (prezzi, programmi, alarmi, indirizzi, landmark) è esposto dal bot attraverso flow di gather che chiedono al cliente input strutturato. Se il gather accetta verbatim senza topic-switch detection, il cliente che pivota corrompe il dato CSV-driven. F86 chiude questa surface in modo trasversale.
