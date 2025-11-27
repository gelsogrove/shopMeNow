# Feature Specification: Subscription & Billing System

**Feature Branch**: `185-subscription-billing-system`  
**Created**: 2025-11-26  
**Status**: Draft  
**Priority**: P0 - Critical (Revenue & Core Business)

## Overview

Implementare un sistema completo di abbonamenti, credito prepagato e billing per ShopME. Gli utenti partono con un trial FREE di 14 giorni con €29 di credito, poi devono sottoscrivere un piano (Basic/Premium/Enterprise) e ricaricare credito per continuare ad usare il servizio. Ogni operazione (messaggio, ordine, push) scala dal credito in tempo reale.

### Business Model

| Piano | Fee Mensile | Canali | Prodotti | Clienti | Features Extra |
|-------|-------------|--------|----------|---------|----------------|
| **Free Trial** | €0 (14 giorni) | 1 | 50 | 50 | €29 credito iniziale |
| **Basic** | €29/mese | 1 | 50 | 50 | Multi-language, Analytics |
| **Premium** | €49/mese | 2 | 100 | 100 | + Brand customization |
| **Enterprise** | Custom | ∞ | ∞ | ∞ | + CRM, Server dedicato, 24/7 support |

### Costi per Operazione (scalano dal credito)

| Operazione | Costo |
|------------|-------|
| Messaggio WhatsApp | €0.10 |
| Nuovo Ordine | €1.00 |
| Push Notification | €1.00 |

---

## User Scenarios & Testing

### User Story 1 - Nuovo Utente Inizia Trial (Priority: P0)

Come nuovo utente registrato, voglio iniziare automaticamente un trial FREE di 14 giorni con €29 di credito per provare la piattaforma.

**Acceptance Scenarios**:

1. **Given** mi registro come nuovo utente, **When** completo la registrazione, **Then** il mio account è impostato su piano "FREE_TRIAL" con €29.00 di credito, trial_ends_at = now + 14 giorni.

2. **Given** sono in trial, **When** visualizzo l'header, **Then** vedo badge "Trial" con countdown giorni rimanenti e saldo credito attuale.

3. **Given** sono in trial e invio un messaggio WhatsApp, **When** il messaggio viene processato, **Then** il mio credito scende di €0.10 in tempo reale.

4. **Given** sono in trial con €0.05 di credito, **When** provo a inviare un messaggio (€0.10), **Then** l'operazione viene bloccata con messaggio "Credito insufficiente. Ricarica per continuare."

5. **Given** il mio trial è scaduto (14 giorni passati), **When** provo ad accedere al servizio, **Then** vedo schermata "Trial scaduto - Scegli un piano per continuare" con opzioni Basic/Premium.

---

### User Story 2 - Visualizzazione Saldo e Limiti Real-Time (Priority: P0)

Come utente, voglio vedere in tempo reale il mio saldo credito e i contatori di utilizzo per monitorare i consumi.

**Acceptance Scenarios**:

1. **Given** sono loggato, **When** visualizzo qualsiasi pagina, **Then** nell'header vedo: saldo credito (€XX.XX), piano attuale, e icona warning se credito < €5.

2. **Given** sono nella pagina Profile/Billing, **When** visualizzo la sezione "Usage", **Then** vedo contatori: Prodotti (X/50), Clienti (X/50), Canali (X/1) con barre di progresso.

3. **Given** il mio credito scende sotto €5, **When** viene elaborata l'operazione, **Then** vedo alert in-app "Credito basso! Ricarica per evitare interruzioni" + ricevo email di notifica.

4. **Given** ho raggiunto 45/50 prodotti, **When** visualizzo il contatore, **Then** il colore passa da verde a giallo (warning).

5. **Given** ho raggiunto 50/50 prodotti, **When** provo ad aggiungere un prodotto, **Then** vedo messaggio "Limite raggiunto. Passa a Premium per aggiungere più prodotti."

---

### User Story 3 - Ricarica Credito Manuale (Priority: P0)

Come utente, voglio ricaricare il mio credito tramite una form per continuare ad usare il servizio.

**Acceptance Scenarios**:

1. **Given** sono nella pagina Billing, **When** clicco "Ricarica Credito", **Then** vedo form con importi predefiniti (€10, €25, €50, €100) o importo custom.

2. **Given** seleziono €50 e clicco "Ricarica", **When** la ricarica viene processata (simulata per ora), **Then** il mio credito aumenta di €50, vedo conferma "Ricarica completata!", e la transazione appare nello storico.

3. **Given** ho fatto una ricarica, **When** visualizzo lo storico transazioni, **Then** vedo riga con: data, tipo "RICARICA", importo "+€50.00", saldo dopo "€75.00".

---

### User Story 4 - Storico Transazioni e Fatturazione (Priority: P1)

Come utente, voglio vedere lo storico completo delle transazioni per contabilità e fatturazione.

**Acceptance Scenarios**:

1. **Given** sono nella pagina Billing, **When** visualizzo la sezione "Storico Transazioni", **Then** vedo tabella con: Data, Tipo (Messaggio/Ordine/Push/Ricarica/Fee), Descrizione, Importo, Saldo.

2. **Given** ho transazioni nell'ultimo mese, **When** filtro per periodo, **Then** vedo solo le transazioni nel range selezionato.

3. **Given** voglio scaricare le fatture, **When** clicco "Scarica Fattura", **Then** vedo link (placeholder per ora) "Fatturazione disponibile prossimamente".

4. **Given** ho fatto 100 operazioni, **When** visualizzo lo storico, **Then** la lista è paginata (20 per pagina) con totali per periodo.

---

### User Story 5 - Upgrade Piano Manuale (Priority: P0)

Come utente, voglio poter fare upgrade del mio piano quando raggiungo i limiti o voglio più features.

**Acceptance Scenarios**:

1. **Given** sono su piano Basic, **When** vado in Profile > Piano, **Then** vedo il mio piano attuale con opzione "Upgrade a Premium".

2. **Given** clicco "Upgrade a Premium", **When** confermo l'upgrade, **Then** il mio piano cambia a Premium, i limiti aumentano (2 canali, 100 prodotti, 100 clienti), e viene addebitata la differenza pro-rata.

3. **Given** sono su Premium e voglio Enterprise, **When** clicco "Contatta Sales", **Then** vedo form/info per contattare il team commerciale.

4. **Given** ho raggiunto 50/50 prodotti su Basic, **When** vedo il messaggio di limite, **Then** il messaggio include CTA "Passa a Premium" che porta alla pagina upgrade.

---

### User Story 6 - Blocco Servizio per Credito Zero (Priority: P0)

Come sistema, devo bloccare le operazioni quando l'utente ha credito insufficiente.

**Acceptance Scenarios**:

1. **Given** utente con €0.00 di credito, **When** riceve messaggio WhatsApp, **Then** il chatbot non risponde, il messaggio va in coda, e l'utente vede notifica "Servizio sospeso - Ricarica credito".

2. **Given** utente con €0.50 di credito, **When** viene creato ordine (€1.00), **Then** l'ordine viene bloccato con messaggio "Credito insufficiente per completare l'ordine".

3. **Given** utente con credito < costo operazione, **When** l'operazione viene tentata, **Then** viene loggato evento "OPERATION_BLOCKED" con dettagli.

4. **Given** il servizio è bloccato per credito zero, **When** l'utente ricarica, **Then** il servizio riprende automaticamente e i messaggi in coda vengono processati.

---

### User Story 7 - Pagina Profile con Piano Attuale (Priority: P1)

Come utente, voglio vedere nella pagina Profile il mio piano attuale e le informazioni di billing.

**Acceptance Scenarios**:

1. **Given** sono nella pagina Profile, **When** visualizzo la sezione "Il Tuo Piano", **Then** vedo: nome piano, prezzo mensile, data prossimo rinnovo, saldo credito.

2. **Given** sono in trial, **When** visualizzo "Il Tuo Piano", **Then** vedo badge "Trial", giorni rimanenti, e CTA "Scegli un piano".

3. **Given** visualizzo i limiti del piano, **When** sono vicino a un limite, **Then** vedo suggerimento contestuale per upgrade.

---

## Functional Requirements

### FR-001: Piano e Credito per Workspace
- Ogni workspace ha: `plan` (FREE_TRIAL|BASIC|PREMIUM|ENTERPRISE), `credit_balance` (decimal), `trial_ends_at` (datetime), `plan_started_at` (datetime).

### FR-002: Configurazione Limiti da API
- Tutti i limiti (prodotti, clienti, canali) e costi (messaggio, ordine, push) sono configurabili da database/API, non hardcoded.

### FR-003: Scalatura Credito Real-Time
- Ad ogni operazione (messaggio/ordine/push), il sistema scala il credito in tempo reale e aggiorna l'UI via WebSocket o polling.

### FR-004: Blocco Immediato a Credito Zero
- Quando `credit_balance <= 0`, tutte le operazioni a pagamento vengono bloccate immediatamente.

### FR-005: Blocco Trial Scaduto
- Quando `trial_ends_at < now()` e piano è FREE_TRIAL, l'accesso al servizio è bloccato fino a upgrade.

### FR-006: Limiti Piano Enforced
- Il sistema blocca creazione prodotti/clienti/canali oltre i limiti del piano.

### FR-007: Storico Transazioni Completo
- Ogni movimento di credito (addebito/ricarica/fee) viene loggato con: timestamp, tipo, importo, saldo_dopo, descrizione, workspace_id.

### FR-008: Notifiche Low-Balance
- Quando credito scende sotto soglia configurabile (default €5), invia email + alert in-app.

### FR-009: Upgrade Manuale
- L'upgrade di piano è sempre manuale, richiede conferma utente.

### FR-010: UI Contatori Header
- L'header mostra sempre: saldo credito, badge piano, warning se credito basso o trial in scadenza.

---

## Success Criteria

1. **Trial Conversion**: Almeno 30% degli utenti trial passa a piano pagato entro 14 giorni.
2. **Ricarica Media**: Utenti attivi ricaricano almeno 1 volta al mese.
3. **Tempo Blocco**: Quando credito = 0, l'operazione viene bloccata in < 100ms.
4. **Visibilità Saldo**: 95% degli utenti sa sempre quanto credito ha (survey/heatmap).
5. **Zero Revenue Loss**: Nessuna operazione viene eseguita con credito insufficiente.

---

## Key Entities

### BillingPlan (nuovo o estensione Workspace)
```
- id: UUID
- workspace_id: UUID (FK)
- plan_type: ENUM (FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE)
- credit_balance: DECIMAL(10,2)
- trial_ends_at: DATETIME (nullable)
- plan_started_at: DATETIME
- next_billing_date: DATETIME
- created_at: DATETIME
- updated_at: DATETIME
```

### BillingTransaction (nuovo)
```
- id: UUID
- workspace_id: UUID (FK)
- type: ENUM (MESSAGE, ORDER, PUSH, RECHARGE, MONTHLY_FEE, UPGRADE_FEE)
- amount: DECIMAL(10,2) (negativo per addebiti, positivo per ricariche)
- balance_after: DECIMAL(10,2)
- description: STRING
- reference_id: STRING (nullable - es. order_id, message_id)
- created_at: DATETIME
```

### PlanConfiguration (nuovo - per limiti dinamici)
```
- id: UUID
- plan_type: ENUM
- max_channels: INT
- max_products: INT
- max_customers: INT
- monthly_fee: DECIMAL(10,2)
- message_cost: DECIMAL(10,2)
- order_cost: DECIMAL(10,2)
- push_cost: DECIMAL(10,2)
- low_balance_threshold: DECIMAL(10,2)
- is_active: BOOLEAN
```

---

## UI/UX Design Guidelines

### Header Credit Display
```
┌─────────────────────────────────────────────────────────┐
│ ShopME    [Chat] [Clients] [...]     💰 €23.50  ⚠️  [JA]│
│                                       ↑ warning if <€5  │
└─────────────────────────────────────────────────────────┘
```

### Profile Page - Plan Section
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Il Tuo Piano                                         │
├─────────────────────────────────────────────────────────┤
│  [BASIC]  €29/mese                                      │
│  Prossimo rinnovo: 26 Dic 2025                         │
│                                                         │
│  💰 Credito: €23.50        [Ricarica]                  │
│                                                         │
│  📊 Utilizzo:                                          │
│  Prodotti   ████████░░  42/50                          │
│  Clienti    ██████░░░░  31/50                          │
│  Canali     ██████████  1/1                            │
│                                                         │
│  [Upgrade a Premium →]                                  │
└─────────────────────────────────────────────────────────┘
```

### Billing Page - Transaction History
```
┌─────────────────────────────────────────────────────────┐
│ 📜 Storico Transazioni              [Filtro: Ultimo mese]│
├─────────────────────────────────────────────────────────┤
│ Data        Tipo       Descrizione      Importo  Saldo │
│ 26/11 14:32 Messaggio  WhatsApp #1234   -€0.10  €23.50 │
│ 26/11 14:30 Ordine     Order #ORD-789   -€1.00  €23.60 │
│ 26/11 10:00 Ricarica   Ricarica manuale +€50.00 €24.60 │
│ 25/11 18:45 Fee        Abbonamento Basic -€29.00 -€25.40│
│                                                         │
│ [< Prev]  Pagina 1 di 5  [Next >]                      │
│                                                         │
│ [📄 Scarica Fattura] (Coming Soon)                     │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Notes (per implementazione)

### Backend
- Nuovo `BillingService` per gestire credito e transazioni
- Middleware `checkCredit` da applicare prima di operazioni a pagamento
- WebSocket events per aggiornamento real-time saldo
- Cron job per check trial scaduti e fee mensili

### Frontend
- `useBilling` hook per stato credito/piano
- `BillingContext` per accesso globale al saldo
- Componente `CreditDisplay` nell'header
- Pagina `BillingPage` con storico e ricarica

### API Endpoints (previsti)
- `GET /api/workspaces/:id/billing` - Info piano e credito
- `GET /api/workspaces/:id/billing/transactions` - Storico
- `POST /api/workspaces/:id/billing/recharge` - Ricarica
- `POST /api/workspaces/:id/billing/upgrade` - Upgrade piano
- `GET /api/billing/plans` - Configurazione piani (pubblico)

---

## Assumptions

1. La ricarica è simulata per ora (niente Stripe), form con conferma immediata.
2. Le fatture sono placeholder - link "Coming Soon".
3. Il cron per fee mensili può essere manuale inizialmente.
4. WebSocket già esiste nel progetto per real-time updates.
5. L'utente Owner gestisce il billing, Admin lo visualizza solo.

---

## Out of Scope (Fase 2)

- Integrazione Stripe/pagamenti reali
- Generazione fatture PDF
- Downgrade piano (solo upgrade per ora)
- Refund credito
- Multi-currency

---

## Dependencies

- Feature 184 (Workspace Team Invites) - per ruoli Owner/Admin
- WebSocket infrastructure esistente
- Email service per notifiche low-balance
