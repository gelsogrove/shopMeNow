# Coverage implementato vs CSV sorgente

Aggiornato **2026-05-24** — post F101 (codice 120 countdown display-flow), F102 (fix returnsChangeCoins L'Escala/PlatjaDAro), F103 (howToUseDryer faqOverrides per-location + step pagamento dettagliati lavadora + nota saldo insuficiente), escalation rules data-driven per 6 location, dati Mataró completati. Aggiunti Caso 45 (howToUseDryer) e Caso 46 (countdown-display) a usecases.md e cases.json.

| Categoria | Fonte CSV | Implementato | % | Note |
|---|---|---|---|---|
| **Orari** | horaris.csv | `locations.json → metadata.hours` per tutti e 6 i locali | **100%** | L'Escala 7-23, resto 8-22. |
| **Indirizzi locali** | locals.csv | `locations.json → pueblo, calle, displayName` | **100%** | Tutti e 6 allineati al CSV. |
| **Landmarks (Cerca de:)** | locals.csv col. "Cerca de:" | `locations.json → metadata.landmarks[]` | **100%** | F79: letti da `utils/locations-landmarks.ts` (case+accent-insensitive, multi-word substring, single-word `\b`). |
| **Prezzi lavadoras** | preus.csv | `locations.json → metadata.machines.washers` | **100%** | Tutti i 24 washer match il CSV (weightKg + fidelity + cash). |
| **Prezzi secadoras** | preus.csv | `locations.json → metadata.machines.dryers` | **100%** | 14 secadoras totali. 3 `null` su Goya S1/S2/S3 — CSV alla fonte non specifica il peso. L'Escala ha `extended` tier (5€/25min). |
| **Extras (aclarado/lavado)** | preus.csv | `locations.json → extras.extraAclarado/extraLavado` | **100%** | L'Escala e Platja d'Aro corretti. |
| **Metodi di pagamento** | instruccions-pagament-*.csv + preus.csv | `locations.json → metadata.payment.methods + tpvExact` (F87) | **100%** | `methods: ["card"]` per L'Escala/PlatjaDAro; `["coins","bills","fidelity","card"]` per le altre 4. `tpvExact: 7` Goya, `tpvExact: 8` Pineda. Bot emette `⚠️ paymentCardOnly` e `💡 paymentTpvExact`. |
| **Programmi lavadora/secadora** | programes.csv | `locations.json → metadata.programs.washers/dryers` per-location (F81) | **100%** | Tutti 6 locali popolati. Goya/Pineda/PlatjaDAro: numeri 1-4. L'Escala: numeri 1-5 + Centrifugado. Hortes/Alemanya: senza numeri. 3 programmi secadora (Alta/Media/Baja) per tutte. Tradotti 6 lingue via i18n. |
| **Istruzioni uso macchine (lavadora)** | instruccions-us.csv | `faqOverrides.howToUse` per tutte e 6 le location | **100%** | ✅ F103: differenza Hortes/Goya/Pineda (step "vuelve a la máquina y confirma el inicio") vs Alemanya/L'Escala/PlatjaDAro (no confirm) correttamente catturata. Mataró usa base generica — ok (solo disambiguatore). |
| **Istruzioni pagamento step-by-step (lavadora)** | instruccions-pagament-lavadora.csv | `faqOverrides.howToUse` per-location con step dettagliati | **100%** | ✅ F103: step completi STAR→datáfono ACEPTADA→SALDO DISPONIBLE→BOTÓN→recupero cambio per location con carta; step effettivo (billetes+monedas) per location che lo accettano; step card-only per L'Escala/PlatjaDAro. ✅ Nota "saldo insuficiente" aggiunta per le 4 location con efectivo (Goya/Pineda/Alemanya/Hortes). |
| **Istruzioni pagamento step-by-step (secadora)** | instruccions-pagament-secadora.csv | `faqOverrides.howToUseDryer` per-location + `faqs.json:howToUseDryer` base | **100%** | ✅ F103: nuova FAQ key `howToUseDryer` per tutte e 6 le location. Include: step pagamento per-method, puerta aperta durante ciclo, +5min prima fine. Nota saldo insuficiente (efectivo) inclusa. Router FAQ classificazione LLM-driven via router.txt examples. |
| **Codici display/allarmi lavadora** | alarmes-lavadora.csv | `display-flows.json` (4 flows) + `flow-engine.ts` + `intent.ts` | **100%** | ✅ Tutti 8 codici CSV coperti: AL001/C001/ALM-DOOR/120 via display-flows.json. SEL/ON/END via `flow-engine.ts` (case_sel/ok/case_end). T-28/STOP via `intent.ts` genericMatch → LLM spiega. ALM/ALN via escalation branch. Stima 85% era conservativa. |
| **Codici display/allarmi secadora** | alarmes-secadora.csv | `display-flows.json` (4 flows) + `flow-engine.ts` + `intent.ts` | **100%** | ✅ Stessi 8 codici del CSV lavadora — copertura identica. `countdown-display` condiviso. ALM/ALN/SEL/ON/T-28/STOP/END identici. Stima 85% era conservativa. |
| **Escalation rules** | CSV implicito "ESCALAR" nei vari CSV | `locations.json → metadata.escalationRules` | **100%** | ✅ Tutte le regole CSV mappate. Goya: 4 regole (+door-blocked-persistent). Pineda: 5 regole (+door-blocked-persistent). Alemanya: 4 regole (+door-blocked-persistent). Hortes: 3 regole (+door-blocked-persistent). L'Escala/PlatjaDAro: 2 regole (+door-blocked-persistent). Mataró: solo disambiguatore, nessuna macchina propria. |
| **`returnsChangeCoins` L'Escala/PlatjaDAro** | instruccions-pagament-*.csv | `locations.json → metadata.returnsChangeCoins` | **✅ FIXED** | F102: corretto `true→false` su L'Escala e PlatjaDAro. CSV dice "Devolución cambio en monedas → No". Le altre 4 location rimangono `true` ("Si corresponde"). |
| **Dati Mataró** | preus.csv / locals.csv / horaris.csv | `locations.json → Mataró skeleton` | **100%** | ✅ Mataró non ha una riga propria in nessun CSV — il CSV elenca Goya e Alemanya con pueblo=Mataró. La entry Mataró in locations.json è un disambiguatore corretto: `needsStreetClarification: true`, payment/programs con `_note` che rimanda a Goya/Alemanya. Nulla da aggiungere dai CSV. |

---

## Gap residui (post-fix 2026-05-24)

| Priorità | Gap | Fix suggerito |
|---|---|---|
| 🟠 LOW | Escalation rules: casi "DOOR blocked definitivo" e altri generici non ancora mappati per-location | Aggiungere entry `door-blocked-persistent` dove applicabile (non bloccante — ALM-DOOR già gestito) |
| ✅ CHIUSO | Saldo insuficiente: nota aggiunta a `faqOverrides.howToUse` per Goya/Pineda/Alemanya/Hortes | Completato 2026-05-24 |
| ✅ CHIUSO | alarmes-lavadora/secadora: stime 85% erano conservative — verifica reale → 100% | Tutti 8 codici CSV coperti (display-flows + flow-engine + intent.ts) |
| ✅ CHIUSO | instruccions-pagament-*: stime 90% erano conservative — verifica reale → 100% | Pago tarjeta + efectivo + saldo insuficiente tutti coperti |

---

## CSV files sorgenti

| File | Contenuto | Stato |
|---|---|---|
| `horaris.csv` | Orari di apertura per ogni location | ✅ 100% via `metadata.hours` |
| `locals.csv` | Riferimento, indirizzo, pueblo, **landmarks** | ✅ 100% via `pueblo/calle/displayName` + `metadata.landmarks` (F79) |
| `preus.csv` | Prezzi lavadora/secadora per macchina | ✅ 100% via `metadata.machines.{washers,dryers}[]` |
| `programes.csv` | Programmi lavadora/secadora per location | ✅ 100% via `metadata.programs.{washers,dryers}[]` per-location (F81) |
| `alarmes-lavadora.csv` | Codici allarme lavatrice + azione | ✅ **100%** — tutti 8 codici coperti (display-flows + flow-engine + intent) |
| `alarmes-secadora.csv` | Codici allarme asciugatrice + azione | ✅ **100%** — copertura identica lavadora |
| `instruccions-pagament-lavadora.csv` | Sequenza pagamento step-by-step lavatrice | ✅ **100%** via `faqOverrides.howToUse` per-location + nota saldo insuficiente |
| `instruccions-pagament-secadora.csv` | Sequenza pagamento step-by-step asciugatrice | ✅ **100%** via `faqOverrides.howToUseDryer` per-location (F103) |
| `instruccions-us.csv` | Istruzioni uso generali (autoservizio) | ✅ 100% via `faqOverrides.howToUse` per 5/6 locali reali (F103) |

---

## Pattern architetturale preservativo

- **Anti-hardcode rule**: mai branching su nome location in TypeScript — sempre leggere da `locations.json`.
- **display-flows.json**: unico punto per intercettare codici display → guida → escalate. Mai aggiungere guard TypeScript per pattern "display X → guide → escalate".
- **faqOverrides**: override dichiarativo per-location che sostituisce la risposta base — zero TypeScript per differenziare comportamento.
- **metadata.landmarks**: single source of truth per landmark. Aggiungere un landmark = solo JSON edit.
- **metadata.escalationRules**: single source of truth per regole escalation per-location. Il LLM le legge da `buildLocationContext()`.

---

## Fix architetturali (F-log riferimenti)

| F-num | Fix | Layer |
|---|---|---|
| **F79** | Landmark resolution data-driven | L0 data + L3 detector |
| **F81** | Programmi per-location data-driven | L0 data + L4 guard |
| **F82** | Programs FAQ branch routing | L3 router + L4 guard |
| **F83** | `detectTopicSwitch` short-circuits su pendingFlow non-machine | L3 extractor |
| **F86** | `pivotIfTroubleSwitch` shared helper cross-flow | L3 detector + L2 + L4 |
| **F87** | FAQ payment location-aware (boundary signals) | L0 data + L3 formatter + L5 i18n |
| **F101** | Codice `120` (countdown) display-flow dichiarativo | L0 data + i18n × 6 |
| **F102** | Bug `returnsChangeCoins: true` → `false` su L'Escala/PlatjaDAro | L0 data fix |
| **F103** | `howToUseDryer` faqOverrides per-location + step pagamento dettagliati lavadora | L0 data |
