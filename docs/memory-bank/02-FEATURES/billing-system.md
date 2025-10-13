# Sistema di Billing

Questo documento descrive il sistema di billing implementato nell'applicazione Shop.me per tracciare e gestire i costi delle diverse operazioni.

## Panoramica

Il sistema di billing è progettato per monitorare i costi di varie operazioni all'interno dell'applicazione, come interazioni con il chatbot, registrazioni di nuovi clienti, supporto umano, creazione di FAQ e attivazione di offerte. Tutti i costi vengono registrati nel database con dettagli progressivi, permettendo di visualizzare una cronologia completa delle transazioni con i relativi importi.

> **IMPORTANTE**: I messaggi delle chat devono essere conservati permanentemente poiché sono necessari per il calcolo del billing. Per questo motivo, la funzione di pulizia automatica dei messaggi vecchi nel cronjob è stata disabilitata.

## Struttura del Database

### Tabella `Billing`

La tabella `Billing` memorizza tutte le transazioni di billing con i seguenti campi:

| Campo           | Tipo        | Descrizione                              |
| --------------- | ----------- | ---------------------------------------- |
| `id`            | UUID        | Identificatore univoco della transazione |
| `workspaceId`   | UUID        | Riferimento al workspace                 |
| `customerId`    | UUID        | Riferimento al cliente (può essere null) |
| `type`          | BillingType | Tipo di operazione addebitata            |
| `description`   | String      | Descrizione dell'operazione              |
| `userQuery`     | String      | Query dell'utente (per messaggi)         |
| `amount`        | Decimal     | Importo addebitato                       |
| `previousTotal` | Decimal     | Totale precedente                        |
| `currentCharge` | Decimal     | Importo della transazione attuale        |
| `newTotal`      | Decimal     | Nuovo totale dopo la transazione         |
| `createdAt`     | DateTime    | Data e ora della transazione             |
| `updatedAt`     | DateTime    | Data e ora dell'ultimo aggiornamento     |

## Tipi di Billing e Prezzi

I tipi di billing sono definiti nell'enum `BillingType` e i prezzi corrispondenti nell'enum `BillingPrices`:

| Tipo                 | Prezzo (EUR) | Descrizione                                             | Emoji |
| -------------------- | ------------ | ------------------------------------------------------- | ----- |
| MESSAGE              | 0.15         | Costo per messaggio/interazione                         | 💬    |
| NEW_CUSTOMER         | 1.50         | Costo per nuovo cliente                                 | 👤    |
| HUMAN_SUPPORT        | 1.00         | Costo per riattivazione del chatbot dopo supporto umano | 🤝    |
| PUSH_MESSAGE         | 1.00         | Costo per notifica push                                 | 📱    |
| NEW_ORDER            | 1.50         | Costo per nuovo ordine                                  | 📦    |
| NEW_FAQ              | 0.50         | Costo per creazione di nuova FAQ                        | 📚    |
| ACTIVE_OFFER         | 0.50         | Costo per offerta attivata                              | 🎯    |
| MONTHLY_CHANNEL_COST | 19.00        | Costo fisso mensile del canale                          | 📆    |

## Servizio di Billing (`BillingService`)

Il servizio di billing (`BillingService`) fornisce metodi per tracciare le diverse operazioni di billing:

- `trackMessage(workspaceId, customerId, description, userQuery)`: Traccia il costo di un messaggio (€0.15)
- `trackNewCustomer(workspaceId, customerId, description)`: Traccia il costo di un nuovo cliente (€1.50)
- `trackNewOrder(workspaceId, customerId, description)`: Traccia il costo di un nuovo ordine (€1.50)
- `trackHumanSupport(workspaceId, customerId, description)`: Traccia il costo del supporto umano (€1.00)
- `trackPushMessage(workspaceId, customerId, description)`: Traccia il costo di un messaggio push (€1.00)
- `trackNewFAQ(workspaceId, customerId, description)`: Traccia il costo di una nuova FAQ (€0.50)
- `trackActiveOffer(workspaceId, offerId, offerTitle)`: Traccia il costo di un'offerta attivata (€0.50)
- `trackMonthlyChannelCost(workspaceId, description)`: Traccia il costo fisso mensile del canale (€19.00)

Ogni metodo:

1. Ottiene il totale precedente (da `getCurrentTotal()` o `getCurrentTotalForCustomer()`)
2. Calcola l'importo della transazione attuale dall'enum `BillingPrices`
3. Calcola il nuovo totale come somma del totale precedente e dell'importo attuale
4. Crea un record nella tabella `Billing` con tutti i dettagli della transazione
5. Registra la transazione nei log di sistema

## Trigger di Billing

Il sistema addebita automaticamente i costi in base a specifici trigger:

| Trigger                   | Tipo di Billing               | Descrizione                                            | Implementazione                                              |
| ------------------------- | ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Registrazione utente      | NEW_CUSTOMER (€1.50)          | Quando un nuovo utente completa la registrazione       | `registration.controller.ts` - `trackRegistrationCost()`     |
| Conferma ordine           | NEW_ORDER (€1.50)             | Quando un ordine viene confermato (status=CONFIRMED)   | `order.service.ts` - `createOrder()` + `updateOrderStatus()` |
| Riattivazione chatbot     | HUMAN_SUPPORT (€1.00)         | Quando l'admin riattiva il chatbot dopo supporto umano | `customers.controller.ts` - `handleAutomaticPushMessages()`  |
| Creazione FAQ             | NEW_FAQ (€0.50)               | Quando viene creata una nuova FAQ                      | `faq.controller.ts` - `createFaq()`                          |
| Attivazione offerta       | ACTIVE_OFFER (€0.50)          | Quando un'offerta viene attivata                       | `offer.controller.ts` - `updateOffer()`                      |
| Messaggio chatbot         | MESSAGE (€0.15)               | Quando un messaggio viene inviato al chatbot           | `message.repository.ts` - `saveMessage()`                    |
| Cambio percentuale sconto | PUSH_MESSAGE (€1.00)          | Quando si modifica la % di sconto di un cliente        | `customers.controller.ts` - `handleAutomaticPushMessages()`  |
| Primo giorno di ogni mese | MONTHLY_CHANNEL_COST (€19.00) | Canone mensile fisso per il canale di comunicazione    | `scheduler.service.ts` - `trackMonthlyChannelCost()`         |

### Prevenzione Double Charging

Il sistema previene l'addebito doppio in diversi modi:

1. **NEW_ORDER solo al CONFIRMED**: L'addebito di €1.50 per un nuovo ordine avviene **solo** quando l'ordine è `CONFIRMED`. Questo può accadere in due modi:

```typescript
// OPZIONE A: Ordine creato direttamente come CONFIRMED (es. dal frontend)
// In order.service.ts -> createOrder()
if (createdOrder.status === OrderStatus.CONFIRMED) {
  await this.billingService.trackNewOrder(workspaceId, customerId, orderCode)
}

// OPZIONE B: Ordine che passa da PENDING → CONFIRMED
// In order.service.ts -> updateOrderStatus()
if (status === OrderStatus.CONFIRMED && oldStatus !== OrderStatus.CONFIRMED) {
  await this.billingService.trackNewOrder(workspaceId, customerId, orderCode)
}
```

2. **Messaggi vs. HUMAN_SUPPORT**: Quando si addebita HUMAN_SUPPORT, non viene anche addebitato MESSAGE:

```typescript
if (isHumanSupport) {
  await billingService.trackHumanSupport(...);
} else {
  // Solo se NON è human support, addebita il messaggio
  await billingService.trackMessage(...);
}
```

2. **Messaggi vs. HUMAN_SUPPORT**: Quando si addebita HUMAN_SUPPORT, non viene anche addebitato MESSAGE:

```typescript
if (isHumanSupport) {
  await billingService.trackHumanSupport(...);
} else {
  // Solo se NON è human support, addebita il messaggio
  await billingService.trackMessage(...);
}
```

3. **Messaggi quando chatbot è disattivato**: Quando il chatbot è disattivato (isActiveChatbot = false), i messaggi dell'utente non vengono addebitati poiché si assume che un operatore umano stia gestendo la conversazione e il costo HUMAN_SUPPORT (€1.00) è già stato addebitato:

```typescript
// Prima di addebitare un messaggio, verifichiamo lo stato del chatbot
if (customer.activeChatbot === false) {
  // Se il chatbot è disattivato, non addebitiamo il messaggio
  logger.info(
    `[BILLING] 💰 Message cost skipped - chatbot disabled for customer ${customerId}`
  )
  return
}
```

4. **Costo mensile del canale**: Il sistema verifica che il canone MONTHLY_CHANNEL_COST sia addebitato solo una volta al mese per workspace:

```typescript
// Nel SchedulerService.ts - verifica giornalmente se è necessario addebitare il canone mensile
private async trackMonthlyChannelCost(): Promise<void> {
  try {
    // Ottiene tutti i workspace attivi
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        isActive: true,
      },
    })

    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    // Verifica se è già stato effettuato un addebito questo mese per ogni workspace
    for (const workspace of workspaces) {
      // Controlla se esiste già un addebito per questo mese
      const existingCharge = await this.prisma.billing.findFirst({
        where: {
          workspaceId: workspace.id,
          type: BillingType.MONTHLY_CHANNEL,
          createdAt: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1),
          },
        },
      })

      // Se non esiste un addebito per questo mese, effettua l'addebito
      if (!existingCharge) {
        await this.billingService.chargeMonthlyChannelCost(workspace.id)
        logger.info(`Monthly channel cost charged for workspace ${workspace.id}`)
      }
    }
  } catch (error) {
    logger.error("Error tracking monthly channel cost:", error)
  }
}
```

## Dashboard Analytics (System Logs)

Il sistema di billing è visualizzabile nella dashboard Analytics attraverso:

### Backend: `analytics.service.ts`

- `getSystemLogs()`: Recupera tutti i record di billing con i dati del cliente
- Ricalcola i totali progressivi a livello globale (workspace)
- Converte i tipi in etichette leggibili (es. MESSAGE → "💬 Message")

### Frontend: `AnalyticsPage.tsx`

- Scheda "System Logs" visualizza tutti i dati di billing
- Filtro per cliente con ricalcolo automatico dei totali
- Colonne: Data/Ora, Tipo, Cliente, Dettagli, Costo, Formula
- Riga di totale con somma dei costi e conteggio operazioni
- Area scrollabile con header e footer fissi

## Gestione degli Errori

Tutte le operazioni di billing sono racchiuse in blocchi try-catch per evitare che fallimenti nel sistema di billing blocchino le operazioni principali. Gli errori vengono registrati nei log ma le operazioni dell'utente continuano normalmente.

```typescript
try {
  await this.billingService.trackNewFAQ(
    workspaceId,
    null,
    `FAQ created: ${faq.question}`
  )
  logger.info(`[BILLING] 💰 New FAQ creation: €0.50 charged`)
} catch (billingError) {
  logger.error(`[BILLING] ❌ Failed to track new FAQ billing:`, billingError)
  // Don't fail FAQ creation if billing fails
}
```

## Dati di Test

Il file `seed.ts` include 13 transazioni di billing per testare il sistema:

- 4 × NEW_CUSTOMER (€1.50 cad) = €6.00
- 6 × MESSAGE (€0.15 cad) = €0.90
- 1 × HUMAN_SUPPORT (€1.00) = €1.00
- 1 × NEW_FAQ (€0.50) = €0.50
- 1 × ACTIVE_OFFER (€0.50) = €0.50

Totale: €8.90

## Miglioramenti Futuri

- Implementare esportazione dei dati di billing in CSV/Excel
- Aggiungere grafici di andamento mensile dei costi
- Creare sistema di fatturazione automatica
- Implementare notifiche quando si superano soglie di spesa
- Sviluppare una strategia di archiviazione per i messaggi vecchi che preservi i dati di billing (ad esempio, spostare i messaggi in una tabella di archivio anziché eliminarli)
