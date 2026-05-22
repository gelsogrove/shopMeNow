# Coverage implementato vs CSV sorgente

Aggiornato 2026-05-22 — post-F79 (landmark resolution) + audit pueblos/calle.

| Categoria | Fonte CSV | Implementato | % | Note |
|---|---|---|---|---|
| **Orari** | horaris.csv | locations.json → `metadata.hours` per tutti e 6 i locali | **100%** | Tutti corretti (L'Escala 7-23, resto 8-22). |
| **Indirizzi locali** | locals.csv | locations.json → `pueblo`, `calle`, `displayName` | **100%** | Hortes (Granollers, Plaça de les Hortes 4), Alemanya (Mataró, C/ Alemanya 17), Pineda (Crta. N-II 1 Centro Carrefour), L'Escala (Av. Girona Carrefour), Platja d'Aro (Av. Castell d'Aro 37), Goya (C/ Francisco de Goya 117 Mataró) tutti allineati al CSV. |
| **Landmarks (Cerca de:)** | locals.csv col. "Cerca de:" | locations.json → `metadata.landmarks: string[]` per ogni location | **100%** | F79: Goya=[Mercadona,Biblioteca], Pineda=[Carrefour,Aldi,Bingo,Policia], L'Escala=[Carrefour], PlatjaDAro=[Carrefour], Hortes=[Plaça de les Hortes], Alemanya=[]. Letti dinamicamente da `utils/locations-landmarks.ts` (case+accent-insensitive, multi-word substring, single-word \\b). |
| **Prezzi lavadoras** | preus.csv | locations.json → `metadata.machines.washers` | **85%** | Dati ok per Goya, Pineda, Alemanya, Hortes. L'Escala ha `weightKg: null` (10/20kg presenti nel CSV → da popolare). Platja d'Aro ok. |
| **Prezzi secadoras** | preus.csv | locations.json → `metadata.machines.dryers` | **70%** | Goya: dryers senza `cash` separato (CSV non lo specifica). Hortes: S7/S8 hanno fidelity `3€/25min` ma cash `4€/25min` ✅. L'Escala ha `extended` tier in più. |
| **Metodi di pagamento** | instruccions-pagament-lavadora.csv | locations.json → `metadata.loyaltyCard`, `metadata.returnsChangeCoins`, `metadata.tpvCobra` | **80%** | L'Escala e Platja d'Aro: no monete/billetes non documentato esplicitamente nel JSON. |
| **Programmi lavadora** | programes.csv | washer_hs60xx.json → PUSH PROG flow (60º/40º/30º/Frío) | **80%** | L'Escala ha ordine inverso (Frío→60º) e centrifugado — non differenziato per location nel flow. |
| **Codici display / allarmi** | alarmes-lavadora.csv + alarmes-secadora.csv | display-flows.json + washer_hs60xx.json + dryer_ed340.json | **90%** | SEL, PUSH, DOOR, ALM/A, ALM/E, ALM/DOOR (F77: anche space-separated), ALM/VAR, AL001, C001, ON, END, STOP tutti coperti. Codice `120` (conto alla rovescia) non gestito esplicitamente. |
| **Istruzioni uso macchine** | instruccions-us.csv | faqs.json → `howToUse` + flow generale | **60%** | Differenza Hortes/Goya/Pineda vs Alemanya/L'Escala/Platja d'Aro (step 4 diverso) non catturata — unica risposta generica. |
| **Macchine Mataró** | preus.csv (Mataró = Goya + Alemanya) | locations.json → Mataró skeleton; Goya e Alemanya popolati | **70%** | Mataró generico usato come disambiguatore; sub-locations hanno i dati completi. |
| **Extra (aclarado/lavado)** | preus.csv | locations.json → `extras.extraAclarado/extraLavado` | **100%** | L'Escala e Platja d'Aro corretti. |
| **Escalation rules** | (implicito nei CSV: "ESCALAR") | locations.json → `metadata.escalationRules` per Goya, Pineda, Alemanya, Hortes | **70%** | Hortes e Alemanya hanno card-payment-fail. Manca regola esplicita per Pineda dryer-minutes. |

## CSV files sorgenti

| File | Contenuto | Letto runtime? |
|---|---|---|
| `horaris.csv` | Orari di apertura per ogni location | ✅ via `metadata.hours` |
| `locals.csv` | Riferimento, indirizzo, pueblo, **landmarks (Cerca de:)** | ✅ pueblo/calle/displayName via top-level, landmarks via `metadata.landmarks` (F79) |
| `preus.csv` | Prezzi lavadora/secadora per macchina (fidelity + cash + capacità kg) | ✅ via `metadata.machines.{washers,dryers}[]` |
| `programes.csv` | 4 programmi PUSH PROG (60º/40º/30º/Frío) + descrizione | ⚠️ inline in `washer_hs60xx.json` (non per location) |
| `alarmes-lavadora.csv` | Codici allarme lavatrice + azione operatore | ✅ via `display-flows.json` + `washer_hs60xx.json` |
| `alarmes-secadora.csv` | Codici allarme asciugatrice + azione operatore | ✅ via `display-flows.json` + `dryer_ed340.json` |
| `instruccions-pagament-lavadora.csv` | Sequenza pagamento step-by-step lavatrice | ⚠️ riassunta in `faqs.json:howToUse` + flow `case_push` |
| `instruccions-pagament-secadora.csv` | Sequenza pagamento step-by-step asciugatrice | ⚠️ riassunta in `faqs.json:howToUse` + flow `case_push` |
| `instruccions-us.csv` | Istruzioni uso generali (autoservizio) | ⚠️ riassunte in `faqs.json:howToUse` |

## Pattern preservativo (data-driven L3)

Il CSV `locals.csv` colonna "Cerca de:" è ora **single source of truth** per i landmark. Aggiungere un landmark a una location esistente è un **JSON edit** (`metadata.landmarks[]`), nessun cambio TypeScript. Il resolver `utils/locations-landmarks.ts` legge dinamicamente — pattern replicabile per future arricchimenti (programmi-per-location, alarmi-per-location, instrucciones-us-per-location).

**Anti-pattern da evitare:** hardcodare in TS un array tipo `const LANDMARKS = ['Mercadona', 'Carrefour', ...]` o `if (msg.includes("Mercadona")) state.location = 'Goya'`. Iron rule violation #6 + non scala.
