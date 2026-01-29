# Task 5 — Ottimizzazione dell’ordine (Ottimizzazione Trasporto)
## Clarifications

### Session 2025-12-16

- Q1: Plan Gating - Cosa vede utente Basic/Free nel menu carrello? → A: L'opzione 5 **non compare nel menu** (nascosta dal router prima che arrivi al cliente)
- Q2: Modello LLM Premium - Quale modello OpenRouter? → A: **GPT-4.1** usato solo per il menu 5 (OrderOptimizationAgentLLM)
- Q3: Fallback persistenza trasporti non configurati → A: **Ricontrollo ogni volta** che l'utente seleziona opzione 5 (no "memoria", se admin configura prezzi la feature riparte)
- Q4: Input validation su menu invalidi (5, A, null)? → A: Già gestito dal sistema menu esistente (opzione non valida = comportamento attuale)
- Q5: Prodotto senza trasporto a runtime → A: **Modifichiamo i prodotti**: trasporto **obbligatorio** in DB + campo obbligatorio nel FE

---
## Obiettivo

Aggiungere una nuova opzione nel menu:

1. ✅ Confermare l'ordine
2. 🛍️ Esplorare il catalogo
3. 🗑️ Rimuovere un articolo
4. 🧹 Cancella il carrello
5. 🚚 **Ottimizzazione dell’ordine**

**Vincolo:** non modificare il processo/flow attuale. L’implementazione deve attivarsi **solo** quando l’utente seleziona l’opzione **5**.

**Nota impatto minimo:** l’unica modifica consentita al flow esistente è la **visualizzazione del carrello** (mostrare anche il prezzo del trasporto). Tutto il resto resta invariato.

**Gating piani:** la feature è disponibile **solo** per utenti **Premium** e **Enterprise**.

* Se il workspace è **Basic/Free/Trial**, l'opzione 5 **NON compare nel menu carrello** (nascosta dal router backend prima che arrivi all'utente). Nessun messaggio di blocco, semplicemente il menu mostrerà solo opzioni 1-4.
* Se il workspace è **Premium/Enterprise**, l'opzione 5 compare regolarmente nel menu.

Quando l’utente clicca **5**, il sistema deve:

1. fare un’analisi dei **trasporti necessari** per gli articoli nel carrello,
2. calcolare e mostrare i **costi di spedizione** (anche “spalmati” per prodotto),
3. proporre prodotti per **ottimizzare** (ridurre costo/unità, riempire un trasporto già pagato, evitare di aggiungere nuovi trasporti),
4. usare un **LLM dedicato** (sub-agent) per spiegazione e raccomandazioni, con input dati deterministici dal backend.

---

## Concetti chiave

### IVA (22%) — decisione di prodotto

* **Consiglio:** usare **prezzi lordi (IVA inclusa)** in tutto il flusso chat (carrello, ottimizzazione, suggerimenti).
* Motivo: l’utente finale ragiona sempre sul prezzo che paga davvero.
* L’IVA va **mostrata in modo trasparente nel carrello**, ma **non usata come leva di ottimizzazione**.

**Regola chiave:**

* L’ottimizzazione del trasporto lavora su **prezzi lordi**.
* L’IVA **non influisce** sulle decisioni di ottimizzazione (è proporzionale e fissa al 22%).
* Il dettaglio IVA serve per chiarezza e fatturazione, non per cambiare i consigli.

> In altre parole: l’LLM ragiona come un utente (“quanto pago”), non come un contabile.

> Nota: in fattura l’IVA resta ovviamente separata come da normativa.

> **Nota importante (data-driven):** tutta la feature “Ottimizzazione dell’ordine” deve funzionare **solo se** nella tabella Trasporti sono presenti valori validi (almeno un trasporto con `price` valorizzato). Se la tabella non è configurata (prezzi mancanti), il flow 5 deve degradare in modo sicuro (messaggio informativo + nessun calcolo inventato).

### Trasporto come costo fisso per “bucket”

* Esistono diversi **tipi di trasporto** (es. Standard / Refrigerato / Congelato).
* Ogni tipo di trasporto ha un **prezzo fisso**.
* Il carrello può richiedere **1 trasporto** o **2 trasporti** (caso tipico), in base ai prodotti.
* Il costo totale spedizione = **somma** dei prezzi dei trasporti richiesti.

### “Spalmare” il costo sui prodotti

* **Tutti i prezzi mostrati all’utente devono essere rotondati** (nessun decimale visibile).
* Il calcolo interno può usare decimali, ma:

  * `totalShippingCost` → arrotondato (es. `Math.round`)
  * `shippingCostPerUnit` → arrotondato
  * `shippingAllocatedPerLine` → arrotondato
* L’eventuale differenza di arrotondamento (±1 unità di valuta) va:

  * assorbita sull’ultima riga del carrello **oppure**
  * gestita solo a livello di visualizzazione (non persistita).

Metodo consigliato (semplice e chiaro): ripartizione per **quantità**.

* `totalUnits = somma(qty)`
* `totalShipping = somma(prezzoTrasportoRichiesto)`
* `shippingPerUnit = round(totalShipping / totalUnits)`
* `shippingAllocatedPerLine = round(shippingPerUnit * qtyLine)`
* Il costo di spedizione può essere distribuito sui prodotti per mostrare un *costo medio per prodotto*.
* Metodo consigliato (semplice e chiaro): ripartizione per **quantità**.

  * `totalUnits = somma(qty)`
  * `totalShipping = somma(prezzoTrasportoRichiesto)`
  * `shippingPerUnit = totalShipping / totalUnits`
  * `shippingAllocatedPerLine = shippingPerUnit * qtyLine`
* Effetto atteso: più prodotti nel carrello → **costo spedizione per prodotto diminuisce**.

---

## Requisiti dati (DB / modello)

### Seed trasporti (valori di default con senso)

Nel seed iniziale inserire **prezzi inventati ma realistici**, semplici e arrotondati, utili per demo/test e coerenti con la logica di ottimizzazione (costi fissi per bucket).

**Proposta seed (EUR):**

* **Temperatura ambiente**: **8€**

  * costo base, logistica semplice, spedizione standard
* **Refrigerato**: **12€**

  * catena del freddo, imballi dedicati, costo intermedio
* **Frozen (Congelato)**: **15€**

  * freezer + dry ice/gel packs, costo più alto

**Linee guida seed:**

* Prezzi **interi** (coerenti con rounding UI)
* Frozen > Refrigerato > Ambiente
* Differenze abbastanza visibili da rendere chiara l’ottimizzazione (8 → 12 → 15)
* Valori sufficientemente bassi da non spaventare, ma realistici per spiegare il concetto di costo fisso

> Nota: questi valori sono solo **seed di default**. Ogni workspace può modificarli dalla dashboard.

---

### 1) Tabella Trasporti: aggiungere prezzo

Abbiamo già una tabella trasporti. Va aggiunto un campo:

* `price` (decimal)

**Impatto:** FE/BE/query/sicurezza/migrazioni.

### 2) Ogni prodotto deve avere un trasporto associato

Ogni prodotto **DEVE** avere **almeno 1 tipo di trasporto** associato (obbligatorio in DB e in FE).

Supporto per **2 trasporti** (caso speciale, es. prodotto che richiede sia refrigerazione che ulteriore protezione):

* `product.transportTypeId` (obbligatorio)
* `product.secondaryTypeId` (opzionale)

> **Regola:** Un prodotto senza trasporto primario **non deve essere aggiunto al catalogo** (DB constraint + validazione FE).
> Nel caso legacy (prodotti vecchi senza trasporto), aggiungere script di migrazione che assegna un trasporto di default (Ambiente).

---

## Backend: nuovo servizio di ottimizzazione (senza toccare checkout)

### Carrello: mostrare prezzi trasporto (requisito)

Quando si mostra il carrello (opzione 4 del sotto-menu o flow carrello esistente), deve essere visibile anche il **prezzo del trasporto** e il **dettaglio IVA (22%)**.

Regole di visualizzazione carrello:

* Tutti i prezzi sono **lordi (IVA inclusa)**.
* Per ogni prodotto:

  * prezzo prodotto (lordo)
  * prezzo trasporto associato (lordo)
* Riepilogo carrello:

  * Subtotale prodotti (lordo)
  * Subtotale trasporti (lordo)
  * **IVA 22% (inclusa nel totale)**
  * Totale complessivo

**Nota:** l’IVA è mostrata per trasparenza, ma **non viene usata** per calcoli di ottimizzazione.

Regole:

* Se il prodotto ha **1 trasporto**: mostra `Trasporto: <nome> (<prezzo>)`.
* Se il prodotto ha **2 trasporti**: mostra entrambi `Trasporto: <nome1> (<prezzo1>) + <nome2> (<prezzo2>)`.
* Tutti i prezzi mostrati sono **arrotondati**.

> Nota: questa è una modifica solo di **visualizzazione** del carrello (read-only). Non cambia il checkout.

### Pre-check configurazione Trasporti (obbligatorio)

Prima di qualsiasi calcolo:

1. Caricare i `Type` del workspace
2. Verificare:

   * esiste almeno 1 trasporto
   * ogni trasporto utilizzato dai prodotti in carrello ha `price` **non null** e `>= 0`

**Se il check fallisce (tabella non pronta / prezzi mancanti):**

* Non eseguire calcoli di spedizione
* Rispondere all’utente con un messaggio tipo:

  * “Al momento non posso ottimizzare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine.”
* (Interno) Loggare evento `TRANSPORT_PRICING_NOT_CONFIGURED` con `workspaceId`.

### Entry point

* Router / Intent: selezione menu **“5”** → azione `OPTIMIZE_ORDER`.
* Il resto delle opzioni 1-4 resta invariato.

### Service: `OrderOptimizationService`

> **Nota rounding:** tutti i valori restituiti al FE/LLM devono essere già **arrotondati**.

Input:

* `workspaceId`
* `customerId`

Responsabilità:

1. Caricare carrello e righe
2. Per ogni prodotto, leggere i trasporti (1 o 2)
3. Determinare `requiredTypes` (set univoco)
4. Calcolare:

   * `totalUnits`
   * `rawTotalShippingCost = sum(transport.price)`
   * `totalShippingCost = round(rawTotalShippingCost)`
   * `shippingCostPerUnit = round(totalShippingCost / totalUnits)`
   * `allocationByItem` (shipping “spalmato” per riga, valori arrotondati)
5. Preparare i dati per l’LLM dedicato

### Pre-check configurazione Trasporti (obbligatorio)

Prima di qualsiasi calcolo:

1. Caricare i `Type` del workspace
2. Verificare:

   * esiste almeno 1 trasporto
   * ogni trasporto utilizzato dai prodotti in carrello ha `price` **non null** e `>= 0`

**Se il check fallisce (tabella non pronta / prezzi mancanti):**

* Non eseguire calcoli di spedizione
* Rispondere all’utente con un messaggio tipo:

  * “Al momento non posso ottimizzare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine.”
* (Interno) Loggare evento `TRANSPORT_PRICING_NOT_CONFIGURED` con `workspaceId`.

### Entry point

* Router / Intent: selezione menu **“5”** → azione `OPTIMIZE_ORDER`.
* Il resto delle opzioni 1-4 resta invariato.

### Service: `OrderOptimizationService`

> **Nota rounding:** tutti i valori restituiti al FE/LLM devono essere già **arrotondati**.

Input:

* `workspaceId`
* `customerId`

Responsabilità:

1. Caricare carrello e righe
2. Per ogni prodotto, leggere i trasporti (1 o 2)
3. Determinare `requiredTypes` (set univoco)
4. Calcolare:

   * `totalUnits`
   * `rawTotalShippingCost = sum(transport.price)`
   * `totalShippingCost = round(rawTotalShippingCost)`
   * `shippingCostPerUnit = round(totalShippingCost / totalUnits)`
   * `allocationByItem` (shipping “spalmato” per riga, valori arrotondati)
5. Preparare i dati per l’LLM dedicato
   Input:

* `workspaceId`
* `customerId`

Responsabilità:

1. Caricare carrello e righe
2. Per ogni prodotto, leggere i trasporti (1 o 2)
3. Determinare `requiredTypes` (set univoco)
4. Calcolare:

   * `totalUnits`
   * `totalShippingCost = sum(transport.price)`
   * `shippingCostPerUnit = totalShippingCost / totalUnits`
   * `allocationByItem` (shipping “spalmato” per riga)
5. Preparare i dati per l’LLM dedicato

Output (per l’LLM e/o per UI):

* Trasporti richiesti + prezzi
* Totale spedizione
* Costo medio per unità / ripartizione per riga

### Entry point

* Router / Intent: selezione menu **“5”** → azione `OPTIMIZE_ORDER`.
* Il resto delle opzioni 1-4 resta invariato.

### Service: `OrderOptimizationService`

Input:

* `workspaceId`
* `customerId`

Responsabilità:

1. Caricare carrello e righe
2. Per ogni prodotto, leggere i trasporti (1 o 2)
3. Determinare `requiredTypes` (set univoco)
4. Calcolare:

   * `totalUnits`
   * `totalShippingCost = sum(transport.price)`
   * `shippingCostPerUnit = totalShippingCost / totalUnits`
   * `allocationByItem` (shipping “spalmato” per riga)
5. Preparare i dati per l’LLM dedicato

Output (per l’LLM e/o per UI):

* Trasporti richiesti + prezzi
* Totale spedizione
* Costo medio per unità / ripartizione per riga

---

## LLM dedicato: sub-agent “OrderOptimizationAgentLLM”

### Modello LLM (qualità più alta)

* Per workspace **Premium/Enterprise**, usare **GPT-4.1** tramite OpenRouter per il sub-agent OrderOptimizationAgentLLM.
* Per workspace non abilitati: non invocare questo agente (opzione 5 non compare).

### System / Prompt operativo (da usare nel canvas prompt)

**Ruolo**
Sei un assistente specializzato nell’ottimizzazione dei costi di spedizione per ordini e-commerce.

**Obiettivo**
Spiegare in modo chiaro e semplice:

* quali tipi di trasporto sono necessari per il carrello corrente,
* quanto costa la spedizione totale e perché,
* come il costo di spedizione viene distribuito sui prodotti,
* come l’utente può ottimizzare il costo aggiungendo prodotti compatibili.

**Vincoli fondamentali (OBBLIGATORI)**

* Usa **solo** i dati forniti nell’input JSON.
* **Non inventare** mai prezzi, prodotti, trasporti o calcoli.
* Tutti i valori monetari sono **già arrotondati**: non rifare calcoli numerici.
* Se i prezzi dei trasporti non sono disponibili, spiega che l’ottimizzazione non è possibile.
* Non modificare il carrello automaticamente: puoi solo **consigliare**.

**Linee guida comunicazione (migliorie 1-4)**

* **M1 (concreto):** spiega l’impatto con una frase intuitiva tipo: “Se il trasporto Frozen costa 15€, con 1 prodotto pesa tanto, con 4 prodotti pesa molto meno per ciascuno.” (senza fare calcoli).
* **M2 (focus):** evidenzia quale trasporto è “sottoutilizzato”/più inefficiente (quello con meno articoli o che pesa di più) e guida l’utente su cosa conviene fare.
* **M3 (non sempre upsell):** se l’ordine è già ben ottimizzato (1 solo trasporto o trasporti già ‘pieni’), dillo esplicitamente e fai pochi o zero suggerimenti.
* **M4 (tono soft):** usa frasi non aggressive: “Se vuoi”, “Può avere senso”, “Solo se ti serve”. Niente vendita forzata.

**Struttura della risposta**

1. **Contesto e trasparenza prezzi**

   * Specifica sempre che *tutti i prezzi sono IVA inclusa (22%)*.

2. **Sintesi trasporti**

   * Elenca i trasporti necessari (Frozen / Refrigerato / Ambiente) con il relativo **prezzo lordo**.
   * Evidenzia chiaramente se ci sono **più trasporti**.

3. **Costo di spedizione**

   * Mostra il **totale spedizione lordo**.
   * Spiega che il trasporto è un **costo fisso per tipo**.

4. **Costo stimato per prodotto (concettuale)**

   * Spiega che il costo di spedizione viene distribuito sui prodotti.
   * Usa **solo spiegazioni intuitive** (esempio: “con più prodotti il costo pesa meno”), **senza numeri aggiuntivi**.

5. **Suggerimenti di ottimizzazione (solo se utili)**

   * Identifica il trasporto più inefficiente/sottoutilizzato.
   * Suggerisci l’aggiunta di prodotti **dello stesso trasporto**.
   * Se l’ordine è già ben ottimizzato, dichiararlo esplicitamente.
   * Usa sempre un tono soft: “se vuoi”, “può avere senso”, “solo se ti serve”.

6. **Menu finale obbligatorio**
   Concludi sempre con:

   1. Dammi la lista di prodotti con trasporto **Frozen**
   2. Dammi la lista di prodotti con trasporto **Refrigerato**
   3. Dammi la lista di prodotti a **Temperatura ambiente**
   4. Mostrami il **carrello**

**Regole sul carrello (coerenza UX)**

* Il carrello mostra sempre:

  * prezzi prodotto **lordi**
  * prezzi trasporto **lordi** per tipo
  * riepilogo con IVA 22% **inclusa**
* L’LLM **non deve**:

  * mostrare quote di trasporto per prodotto nel carrello
  * rifare calcoli IVA
  * modificare il carrello

**Formato**

* Linguaggio semplice, orientato all’utente finale.
* Brevi paragrafi o bullet point.
* Nessun riferimento tecnico (DB, JSON, backend, ecc.).

---

## Logica suggerimenti (use-cases)

### Caso A — Carrello con pochi articoli (costo/unità alto)

* Spiegare che la spedizione è un costo fisso per trasporto e pesa di più con pochi articoli.
* Suggerire prodotti **compatibili con lo stesso trasporto già richiesto** (così non si aggiunge un secondo trasporto).

### Caso B — Carrello con 2 trasporti

* Spiegare che si stanno pagando **due trasporti separati**.
* Se uno dei trasporti ha pochi articoli (es. Congelato con 1 item):

  * suggerire prodotti con lo stesso trasporto per “riempire” e abbassare costo/unità di quel bucket.

---

## Chiusura analisi: menu di drill-down per tipo trasporto + carrello

**Requisito UX:** al termine dell’analisi (messaggio LLM), l’utente deve vedere sempre un mini-menu con azioni rapide, alimentate dal DB.

Mostrare:

1. Dammi la lista di prodotti con trasporto **Frozen**
2. Dammi la lista di prodotti con trasporto **Refrigerato**
3. Dammi la lista di prodotti **Temperatura ambiente**
4. Mostrami il **carrello**

### Note implementative

### Guardrail fondamentali (da NON violare)

* **Non rompere il pattern esistente**:

  * routing, intent, options-mapping e flow 1–4 restano invariati
  * il flow 5 è un’aggiunta isolata

* **Niente codice hardcoded**:

  * nomi trasporti, prezzi, prodotti, piani → sempre da DB/config
  * nessuna stringa business-critical scritta a mano nel codice

* **Dialogo fluido e coerente**:

  * risposte brevi
  * selezioni sempre numeriche
  * nessun cambio improvviso di stile o tono

* **Passare sempre dal LLM di translation**:

  * output dell’OrderOptimizationAgentLLM → translation LLM → utente
  * nessun testo utente bypassa il layer di traduzione/localizzazione

* **Non complicare le cose**:

  * calcoli solo nel backend
  * LLM solo spiegazione e suggerimenti
  * niente regole duplicate

* **Prompt nei template ufficiali**:

  * il prompt dell’OrderOptimizationAgentLLM va inserito nella cartella/template standard insieme agli altri prompt
  * niente prompt inline nel codice

* **Sicurezza**:

  * tutte le query filtrate per `workspaceId`
  * nessun dato di altri workspace passato all’LLM
  * validazione input numerici (menu e selezioni prodotto)

* **Arrotondamenti coerenti**:

  * usare **un’unica funzione di rounding condivisa**
  * stessi criteri per:

    * prezzi prodotto
    * prezzi trasporto
    * totale spedizione
    * riepilogo carrello
  * vietato arrotondare lato LLM

---

* Consigliato: mantenere calcoli in BE, LLM solo per linguaggio e raccomandazioni.
* Loggare casi anomali: prodotti senza trasporto, trasporti senza prezzo, ecc.

---

## Piano di task (roadmap implementativa)

### Fase 0 — Allineamento (pre-dev)

* [ ] Confermare nomi definitivi dei tipi trasporto (Frozen / Refrigerato / Ambiente)
* [ ] Confermare valuta workspace (es. EUR)
* [ ] Confermare piani abilitati (Premium, Enterprise)

---

### Fase 1 — Database & Seed

* [ ] Aggiungere campo `price` alla tabella `Type`
* [ ] Migrazione DB + backward compatibility
* [ ] Aggiornare seed trasporti con valori di default:

  * Ambiente: 8€
  * Refrigerato: 12€
  * Frozen: 15€
* [ ] Verifica: ogni prodotto ha almeno 1 trasporto associato
* [ ] Seed/validazione per prodotti senza trasporto (fallback deterministico)

---

### Fase 2 — Backend (logica)

* [ ] Estendere query carrello per includere trasporti e prezzi
* [ ] Implementare `OrderOptimizationService`

  * [ ] Pre-check configurazione trasporti
  * [ ] Calcolo trasporti richiesti
  * [ ] Calcolo costi spedizione (lordi, arrotondati)
  * [ ] Flag `alreadyOptimized`
* [ ] Preparazione payload per LLM (solo dati deterministici)

---

### Fase 3 — LLM & Prompt

* [ ] Creare sub-agent `OrderOptimizationAgentLLM`
* [ ] Usare modello di qualità superiore per Premium/Enterprise
* [ ] Integrare prompt definitivo dal canvas
* [ ] Verifica menu finale obbligatorio (1–4)

---

### Fase 4 — Routing & Chat Flow

* [ ] Mostrare opzione 5 solo per piani Premium/Enterprise
* [ ] Bloccare accesso manuale a 5 per piani non abilitati
* [ ] Routing sotto-menu post-analisi (1–4)
* [ ] Liste prodotti numeriche (1..N)
* [ ] Selezione prodotto → riuso flow prodotto esistente

---

### Fase 5 — Carrello (visualizzazione)

* [ ] Mostrare prezzo trasporto per prodotto
* [ ] Supporto prodotto con 2 trasporti
* [ ] Mostrare riepilogo trasporti
* [ ] Mostrare IVA 22% (inclusa)
* [ ] Nessuna modifica al checkout

---

### Fase 6 — Frontend / Dashboard

* [ ] CRUD Trasporti: campo `price`
* [ ] Form prodotto: selezione trasporto primario/secondario
* [ ] Aggiornare descrizione piani Premium/Enterprise

---

### Fase 7 — Test unitari & QA

* [ ] Test `OrderOptimizationService` (calcoli, rounding, edge case)
* [ ] Test routing menu 5 e sotto-menu
* [ ] Test carrello (1 trasporto / 2 trasporti)
* [ ] Test gating Premium/Enterprise
* [ ] Test regressione flow 1–4

---

### Fase 8 — Release

* [ ] Feature flag attivo solo Premium/Enterprise
* [ ] Deploy DB + BE
* [ ] Deploy FE
* [ ] Smoke test manuale su chat
* [ ] Monitor log errori / casi non configurati

---

## Acceptance Criteria (finali)

### Abilitazione & piani

* [ ] L’opzione **5. Ottimizzazione dell’ordine** è visibile **solo** per workspace **Premium** e **Enterprise**.
* [ ] Per workspace non abilitati, l’opzione 5 non compare oppure restituisce un messaggio di blocco senza eseguire analisi.

### Integrità del flusso esistente

* [ ] I flussi 1–4 funzionano **esattamente come prima**.
* [ ] L’unica modifica ammessa al flusso esistente è la **visualizzazione del carrello** (prezzo trasporto + IVA).

### Dati & calcoli

* [ ] Tutti i prezzi mostrati sono **lordi (IVA 22% inclusa)**.
* [ ] Tutti i prezzi sono **arrotondati** (interi).
* [ ] Il costo di spedizione è calcolato per **tipo di trasporto**, non per prodotto.
* [ ] L’IVA **non influenza** la logica di ottimizzazione.

### Ottimizzazione (flow 5)

* [ ] Alla selezione di 5 viene eseguita l’analisi solo se:

  * carrello non vuoto
  * tabella trasporti configurata con prezzi validi
* [ ] Se i prezzi dei trasporti non sono configurati, viene mostrato un messaggio informativo senza calcoli.
* [ ] L’LLM non inventa prezzi, prodotti o trasporti.
* [ ] Se l’ordine è già ben ottimizzato, viene dichiarato esplicitamente (nessun upsell forzato).

### Suggerimenti & UX

* [ ] I suggerimenti riguardano **solo prodotti compatibili** con il trasporto da ottimizzare.
* [ ] Il tono dei suggerimenti è **non aggressivo** ("se vuoi", "può avere senso").
* [ ] Le liste prodotti (Frozen / Refrigerato / Ambiente) sono:

  * generate dal DB
  * numeriche (1..N)
  * selezionabili solo tramite numero
* [ ] La selezione numerica di un prodotto riusa il **flow prodotto esistente**.

### Menu finale

* [ ] L’output dell’analisi termina **sempre** con il menu:

  1. Frozen
  2. Refrigerato
  3. Temperatura ambiente
  4. Mostra carrello

### Carrello

* [ ] Ogni prodotto mostra il **tipo di trasporto** e il **prezzo del trasporto**.
* [ ] Se un prodotto ha 2 trasporti, entrambi sono visibili.
* [ ] Il riepilogo carrello mostra:

  * subtotale prodotti
  * subtotale trasporti
  * IVA 22% (inclusa)
  * totale complessivo

### Qualità & sicurezza

* [ ] Tutte le query sono isolate per `workspaceId`.
* [ ] Il sub-agent LLM viene invocato **solo** quando necessario e solo per piani abilitati.
* [ ] I test unitari coprono i casi principali (1 trasporto, 2 trasporti, carrello vuoto, prezzi mancanti).

---

## Test unitari (minimo indispensabile)

### 1) `OrderOptimizationService`

* `should_fail_if_transport_pricing_not_configured`

  * trasporti mancanti o `price = null` → ritorna stato `NOT_CONFIGURED`.
* `should_compute_required_transport_types_from_cart`

  * carrello con prodotti multi-trasporto → set corretto.
* `should_round_all_user_visible_prices`

  * verifica che `totalShippingCost`, `shippingCostPerUnit`, `allocatedShippingCost` siano interi.
* `should_not_suggest_when_order_already_optimized`

  * 1 solo trasporto o trasporti “pieni” (policy input) → `availableUpsellProducts` vuoto o flag `alreadyOptimized`.

### 2) Routing / options-mapping

* `should_route_menu_5_only_for_premium_or_enterprise`
* `should_route_post_analysis_submenu_1_2_3_4`
* `should_route_numeric_product_selection_1_to_N_to_existing_product_flow`

### 3) Carrello view

* `should_render_transport_price_per_line_single_transport`
* `should_render_transport_price_per_line_double_transport`

> Nota: i test LLM non devono verificare “testo perfetto”, ma:
>
> * che il prompt riceva i dati corretti
> * che l’invocazione avvenga solo quando abilitato
> * che l’output includa sempre il menu finale 1-4 (se lo validate via regex/contains).
