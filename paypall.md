# PayPal Connect - Billing Backoffice

## Scopo
Definire il flusso PayPal Connect per owner (OAuth) e i dati che vengono salvati a livello owner.

## Dati salvati (owner-level)
Campi su `User`:
- `paypalStatus`: `DISCONNECTED | CONNECTED`
- `paypalClientId`
- `paypalMerchantId`
- `paypalEmail`
- `paypalEnvironment` (es: sandbox/live)
- `paypalConnectedAt`
- `paypalAccessTokenEncrypted`
- `paypalRefreshTokenEncrypted`
- `paypalTokenExpiresAt`
- `paypalTokenScope`

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

### Workspace Selection (owner)
- Card **PayPal Account** con stato connessione e bottoni Connect/Disconnect.

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

## PayPal Connect (OAuth)
- `POST /api/paypal/connect-url` (owner only) → ritorna URL OAuth (sandbox in dev, live in prod)
- `GET /api/paypal/callback` → scambia `code` con token, salva dati su `User`
- `GET /api/paypal/status` (owner only) → stato connessione
- `POST /api/paypal/disconnect` (owner only) → disconnette e pulisce tokens

## Sicurezza (Connect)
- Token cifrati a riposo con `PAYPAL_TOKEN_ENCRYPTION_KEY`
- Callback valida `state` via JWT (CSRF)
- Solo owner (SUPER_ADMIN) può connettere/disconnettere

## TODO per integrazione real payout
- Webhook PayPal con signature verification
- Payout mensile automatico su merchantId
- Retry policy + audit log
