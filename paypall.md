# PayPal (Mock) - Billing Backoffice

## Scopo
Definire il flusso PayPal in backoffice (mock) e i dati che vengono salvati a livello owner. Il mock serve solo per simulare un pagamento mensile finche' non viene integrato il provider reale.

## Dati salvati (owner-level)
Campi su `User`:
- `paypalStatus`: `DISCONNECTED | CONNECTED`
- `paypalClientId`
- `paypalMerchantId`
- `paypalEmail`
- `paypalEnvironment` (es: sandbox/live)
- `paypalConnectedAt`

## Transazioni PayPal
Tabella `PayPalTransaction`:
- `id`, `userId`
- `invoiceId` (opzionale)
- `amount`, `currency`
- `status`: `SUCCESS | FAILED`
- `notes` (opzionali)
- `createdAt`
- `adminUserId` (chi ha eseguito l'azione)

## Backoffice UI
### Clients (owner card)
- Bottone **PayPal Details** nella card owner.
- Apre una modal con:
  - Status, Environment, Email, Merchant ID, Client ID, Connected At.
  - Storico transazioni PayPal (success/fail, data, note).

### Monthly Collections
- Bottone **Process Payment**: esegue un mock e ritorna `success/failed`.
- Bottone **Record Failure**: registra un tentativo fallito senza bloccare l'utente.
- **Mark Paid/Failed**: aggiorna lo stato della fattura.
- **Reset Payment**: azzera il contatore dei failure.
- **Credit Notes**: aggiunge/modifica/elimina note di credito.

## API Admin
- `GET /users/admin/:userId/paypal`  
  Ritorna config PayPal + ultime transazioni.

- `POST /users/admin/invoices/:invoiceId/paypal/mock-payment`  
  Esegue il mock pagamento mensile.  
  Risultato casuale `SUCCESS` o `FAILED`.  
  Se `SUCCESS`, crea:
  - `PayPalTransaction`
  - `BillingTransaction` con `type = INVOICE_PAID`
  - Fattura aggiornata a `PAID`
  Se `FAILED`, crea `PayPalTransaction` con stato fallito e fattura `FAILED`.

## Sicurezza
- Endpoint disponibili solo a ruoli admin/backoffice.
- Nessun segreto PayPal salvato o mostrato (solo client/merchant ID + email).
- I dati PayPal sono visibili solo agli admin nel backoffice.

## TODO per integrazione reale
- Salvare tokens reali PayPal in vault sicuro (non in DB plain).
- Webhook PayPal per conferma pagamenti reali.
- Reconciliation mensile tra invoice e payout.
- Retry policy e blocco automatico su troppi failure (solo se richiesto).
