# Analisi Piani, Limiti, Billing e Casistiche

## Obiettivo
Verificare i vincoli di piano (canali, clienti, team), il blocco per credito, lo stato abbonamento, la fatturazione ricorrente e la visibilità delle transazioni. Evidenziare punti deboli, bug potenziali e miglioramenti BE/FE.

---

## Stato attuale (sintesi)

### Backend
- **Owner-based billing**: `apps/backend/src/application/services/subscription-billing.service.ts`
  - Crediti e piani su **User** (owner), non su workspace.
- **Soglia credito**: `CREDIT_MIN_THRESHOLD = -10` in `SubscriptionBillingService.checkCredit/checkOwnerCredit`.
- **Limiti piano**:
  - Middleware: `apps/backend/src/interfaces/http/middlewares/billing.middleware.ts`.
  - Team invites: `apps/backend/src/application/services/workspace-invitation.service.ts`.
- **Blocchi Chat/WhatsApp**:
  - `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`
  - `apps/backend/src/application/services/workspace-access.service.ts`
- **Legacy billing**:
  - `apps/backend/src/application/services/billing.service.ts` + `apps/backend/src/services/scheduler.service.ts`
  - Registra costi su tabella legacy `billing` e deduce credito.

### Frontend
- **UI Billing**: `apps/frontend/src/components/billing/BillingSection.tsx`
- **Hook Billing**: `apps/frontend/src/contexts/BillingContext.tsx`
- **Gating team members**: `apps/frontend/src/components/workspace/TeamMembersTable.tsx`

---

## Codice principale (estratti significativi)

### 1) Soglia credito (BE)
**File**: `apps/backend/src/application/services/subscription-billing.service.ts`
```ts
const CREDIT_MIN_THRESHOLD = -10
...
return {
  hasSufficientCredit: balanceAfterDeduction >= CREDIT_MIN_THRESHOLD,
  currentBalance,
  requiredAmount,
}
```

### 2) Limite team members (BE)
**File**: `apps/backend/src/application/services/workspace-invitation.service.ts`
```ts
if (planConfig.maxTeamMembers === 0) {
  return { success: false, error: "Team invitations are not available..." }
}
if (teamMemberCount + pendingInvitesCount >= planConfig.maxTeamMembers) {
  return { success: false, error: "Team member limit reached..." }
}
```

### 3) Billing legacy (BE)
**File**: `apps/backend/src/application/services/billing.service.ts`
```ts
await this.prisma.billing.create({
  data: { workspaceId, amount: monthlyChannelCost, type: BillingType.MONTHLY_CHANNEL }
})
```

### 4) FE warning soglie credito (FE)
**File**: `apps/frontend/src/components/billing/BillingSection.tsx`
```ts
const isCreditCritical = billing.creditBalance < -12
const isCreditLow = billing.creditBalance >= -10 && billing.creditBalance < limits.lowBalanceThreshold
```

---

## Problemi / rischi / punti deboli

### 1) Doppio sistema billing (legacy vs owner-based)
- **Evidenza**: `BillingService` legacy + `SubscriptionBillingService` in parallelo.
- **Rischio**: mismatch tra Transaction History e addebiti reali.

### 2) Soglia credito FE vs BE
- **BE**: `-10`
- **FE**: `-12` (hardcoded)
- **Rischio**: UI non coerente con blocco reale.

### 3) Limiti canali non garantiti ovunque
- Alcune route potrebbero non usare `checkPlanLimits`.
- **Rischio**: creare risorse oltre piano se manca un middleware.

### 4) Pagamenti mensili + invoice non end‑to‑end
- Docs `invoice.md` descrivono generazione PDF ma non risulta collegato al ciclo mensile.

### 5) Cancellazione account/canale e retention
- Docs `soft-delete-system.md` descrivono retention 3 mesi ma mancano test automatici.

### 6) Blocchi pagamento gestiti manualmente: mancano regole esplicite
- Il processo attuale previsto è manuale: admin riprova 1–2 volte, poi blocca l’utente.
- **Backoffice**: `apps/backoffice/src/pages/ClientsPage.tsx` mostra `subscriptionStatus` ma **non** ha un’azione esplicita per impostare `PAYMENT_FAILED`. Esiste solo toggle `status` utente (ACTIVE/DISABLED).
- **API admin**: `apps/backoffice/src/services/api.ts` non espone un endpoint per cambiare `subscriptionStatus` (solo status/permissions/bonus/trial/2FA).
- **Cascade**: il blocco è implementato in `workspace-access.service.ts` e gestito dal webhook, quindi se `subscriptionStatus = PAYMENT_FAILED` viene impostato, il blocco è globale per tutti i workspace dell’owner.
- Serve un messaggio FE chiaro e consistente quando lo stato è bloccato.

---

## Casi d’errore da coprire (minimi)
1) Downgrade con superamento limiti.
2) Credito < -10 → blocco chat/queue.
3) Abbonamento PAUSED → blocco messaggi.
4) PAYMENT_FAILED → blocco globale.
5) Cancellazione account → addebito finale + retention.
6) Cancellazione canale → stop messaggi + retention.
7) Transaction History coerente con addebiti reali.

---

## Task da eseguire (lista)

### Task 1 — Unificare billing legacy vs owner-based
**Descrizione**: rimuovere o migrare `BillingService` legacy e usare solo `SubscriptionBillingService` per addebiti mensili + history.
**Output**: Transaction History coerente, un solo sistema.

### Task 2 — Allineare soglie credito FE/BE
**Descrizione**: esporre soglie da backend (`thresholds`) e usarle nel FE al posto di hardcode.
**Output**: UI coerente con blocchi reali.

### Task 3 — Audit limiti piano su tutte le route
**Descrizione**: verificare e aggiungere `checkPlanLimits` in tutte le route di creazione (channel/workspace). 
**Output**: impossibile creare risorse oltre limite.

### Task 4 — Backoffice: sessione incassi mensili per cliente
**Descrizione**: vista backoffice per amministratore che mostra importo da prelevare per owner (mese corrente), con:
- stato transazione (`PENDING`, `DONE`, `FAILED`)
- campo note
- pulsante “Mark Done”
- link fattura
**Output**: dashboard per controllo incassi con stato e note.

### Task 5 — Integrazione fatture mensili + note di credito
**Descrizione**:
- generazione fattura mensile automatica (fine mese)
- visibile in **backoffice** e **app**
- include: somma transazioni, **tasse 22%**, descrizione piano attivo
- applica eventuali **note di credito** (riduzione importo)
- cambio piano o ricariche credito → fattura sempre a fine mese
- supporto **logo aziendale** in testata fattura (`logo.png`)
**Output**: fattura scaricabile e coerente con transazioni e credit notes.

### Task 6 — Flow cancellazione + retention
**Descrizione**: addebito finale a fine mese, stop servizi, retention 3 mesi con cleanup.
**Output**: cancellazione corretta e verificabile.

### Task 7 — Test critici
**Descrizione**: aggiungere test unit/integration per credito, downgrade, cancel, invoice.
**Output**: copertura per casistiche chiave.

### Task 8 — Pagamento fallito: policy + backoffice + cascata blocchi
**Descrizione**:
- definire policy: N tentativi manuali → `PAYMENT_FAILED`
- backoffice: azione esplicita “Blocca per pagamento” con note
- blocco a cascata su tutti i workspace dell’owner (chatbot + queue + azioni)
- UI: stato e CTA per ripristino pagamento
**Output**: comportamento deterministico e visibile lato admin e lato utente.

### Task 9 — Endpoint admin per `subscriptionStatus` + UI backoffice
**Descrizione**:
- BE: endpoint admin che aggiorna `subscriptionStatus` per owner (es. `ACTIVE`, `PAUSED`, `PAYMENT_FAILED`)
- FE Backoffice: pulsante/azione “Imposta pagamento fallito” con campo note
- Audit log: salvare note e timestamp dell’azione
**Output**: gestione manuale pagamento fallito direttamente da backoffice.

---

## Note finali
- **Contatore usage (credito)** e **costo piano** sono separati.
- Pagamenti mensili e invoice sono ancora task futuri.

---

## Altri casi critici e task correlati (deep dive)

### A) Cambio piano a metà mese
**Rischio**: non è chiaro il proration e come viene riflesso in fattura finale.
**Task**:
- definire regola di pro‑rata (upgrade immediato, downgrade a fine mese)
- salvare cambio piano come evento in transaction history
- includere nel calcolo fattura (piano attivo + eventuale pro‑rata)

### B) Ricariche credito e fatturazione
**Rischio**: la ricarica è un’operazione separata dal canone; serve evidenza in fattura mensile (se richiesto) oppure in documento separato.
**Task**:
- decidere se le ricariche compaiono in fattura mensile o in ricevuta separata
- garantire coerenza tra `billingTransactions` e PDF fattura

### C) Stato `DISABLED` vs `PAYMENT_FAILED`
**Rischio**: due concetti diversi: status utente (ACTIVE/DISABLED) e subscriptionStatus (ACTIVE/PAUSED/PAYMENT_FAILED). Possono divergere.
**Task**:
- definire priorità di blocco (es. DISABLED > PAYMENT_FAILED > PAUSED)
- mostrare chiaramente nel FE lo stato reale di blocco

### D) Canali in cestino (soft delete)
**Rischio**: canale soft‑deleted potrebbe continuare a ricevere messaggi o essere conteggiato nei limiti.
**Task**:
- verificare che i conteggi limiti escludano canali `isDelete=true`
- garantire che la queue non invii messaggi per canali in trash

### E) Owner senza workspace o workspace senza owner
**Rischio**: alcune logiche billing fanno fallback, ma la gestione non è consistente.
**Task**:
- definire comportamento di errore e logging
- blocco esplicito se manca owner (evitare addebiti inconsistenti)

### F) Note di credito multiple nello stesso mese
**Rischio**: applicazione errata (duplicazione o segni invertiti).
**Task**:
- definire ordine di applicazione
- verificare che la fattura finale sia sempre `somma transazioni + IVA − note credito`

### G) Limiti team members e pending invites
**Rischio**: conteggio pending invites già considerato in BE, ma FE potrebbe mostrare “Disponibile” mentre BE rifiuta.
**Task**:
- FE deve usare conteggio membri + inviti pendenti per gating UI

### H) Blocco credito e messaggi già in queue
**Rischio**: messaggi in queue potrebbero essere inviati anche dopo blocco.
**Task**:
- verificare che `validateAndSend` esegua check di accesso/billing aggiornato
- se `PAYMENT_FAILED` o `PAUSED` → blocco prima dell’invio

### I) Transaction history per canali multipli
**Rischio**: owner con più canali deve vedere breakdown per canale.
**Task**:
- assicurare che `billingTransactions.workspaceId` sia popolato
- UI backoffice: filtro per canale

### J) Rischio mix ID a fine mese (totali errati)
**Rischio**: sommare transazioni di owner diversi o workspace sbagliati durante la chiusura mensile.\nQuesto è un rischio critico per il conto totale.
**Task**:
- verificare che tutte le query di chiusura mensile siano **owner‑scoped** e/o **workspace‑scoped**
- aggiungere test che simulano 2 owner con transazioni nello stesso mese e verificano che i totali non si mescolino

---

## Task aggiuntivi (lista)

### Task 10 — Policy proration upgrade/downgrade
**Output**: regole chiare, eventi in history, fattura corretta.

### Task 11 — Ricariche credito: fattura o ricevuta separata
**Output**: decisione documentale e implementazione coerente.

### Task 12 — Priorità blocco stati (DISABLED vs PAYMENT_FAILED)
**Output**: un’unica “source of truth” e messaggi FE coerenti.

### Task 13 — Soft delete canali + limiti + queue
**Output**: canali in trash non conteggiati né operativi.

### Task 14 — Safety check prima invio queue
**Output**: blocchi applicati anche ai messaggi già in coda.

### Task 15 — Breakdown transazioni per canale
**Output**: visibility chiara in backoffice e app.

### Task 16 — Verifica isolamento ID nei totali mensili
**Output**: nessun mix tra owner/workspace nei totali di fine mese (test dedicato).

### Task 17 — Scheduler: addebiti e disponibilità fatture post‑pagamento
**Descrizione**:
- verificare job schedulati per addebiti mensili
- assicurare che la fattura venga generata **solo dopo** pagamento confermato
- garantire che fattura sia disponibile in backoffice e app dopo il pagamento
**Output**: ciclo mensile stabile (addebito → pagamento → fattura disponibile).

### Task 18 — Aumento coverage test (alto)
**Descrizione**:
- aumentare copertura test su billing, fatture, limiti, cancellazioni e scheduler
- coprire edge case con più owner/workspace e note di credito
**Output**: coverage alto e riduzione rischio regressioni.

### Task 19 — FAQ seed per billing/plan/pagamenti
**Descrizione**:
- aggiungere FAQ seed su: cancellazione, pagamenti, ricariche, soglie credito, upgrade/downgrade
- usare FAQ come “prima linea” per risposte informative del chatbot
**Output**: supporto self‑service via chatbot + riduzione richieste manuali.
