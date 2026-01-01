# Security Review Notes (API Exposure)

Questo documento raccoglie i punti di attenzione emersi sulla superficie API pubblica.
Ogni punto include rischio, impatto, evidenze nel codice e suggerimenti pratici.

---

## 1) Endpoint HOTFIX pubblico: blocco clienti senza auth (CRITICAL)

**Rischio**
- Chiunque può bloccare clienti senza autenticazione se conosce `workspaceId` e `customerId`.

**Impatto**
- Blocco account/utenti legittimi, interruzione del business, abuso mirato.

**Evidenze**
- `apps/backend/src/app.ts:234` (route `POST /api/workspaces/:workspaceId/customers/:id/block` senza middleware di auth).

**Perché è grave**
- Azione distruttiva esposta pubblicamente, nessun controllo di accesso.

**Mitigazioni consigliate**
- Rimuovere il route HOTFIX o proteggerlo con `authMiddleware` + `sessionValidationMiddleware`.
- Aggiungere rate limiting per endpoint sensibili.
- Logging e alerting su tentativi falliti o su pattern anomali.

---

## 2) Workspace routes montate senza auth a `/workspaces` (CRITICAL)

**Rischio**
- Accesso non autenticato a dati workspace (inclusi campi sensibili).

**Impatto**
- Esfiltrazione di `whatsappApiKey`, `adminEmail`, `debugMode`, informazioni operative.

**Evidenze**
- `apps/backend/src/app.ts:350` (mount diretto `app.use("/workspaces", workspaceRoutesRoot)` senza auth).
- `apps/backend/src/routes/workspace.routes.ts:83` (`GET /workspaces/current` senza auth).
- `apps/backend/src/routes/workspace.routes.ts:98` include `whatsappApiKey` in risposta.

**Perché è grave**
- Dati sensibili di configurazione esposti pubblicamente.

**Mitigazioni consigliate**
- Rimuovere il mount root non autenticato.
- Lasciare solo `/api/workspaces` con `authMiddleware`.
- Se necessario un endpoint pubblico, creare una versione “public-safe” con campo limitati.

---

## 3) Static `/uploads` senza access control (HIGH)

**Rischio**
- File caricati diventano pubblicamente accessibili.

**Impatto**
- Fatture, documenti o dati personali esposti pubblicamente.

**Evidenze**
- `apps/backend/src/app.ts:159` (serve statico di `apps/backend/uploads`).

**Mitigazioni consigliate**
- Separare asset pubblici da privati (directory dedicate).
- Servire file privati solo via endpoint autenticati con firma/URL temporanei.
- Audit dei file correnti in `/uploads`.

---

## 4) Endpoint di test JSON parser pubblico (MEDIUM)

**Rischio**
- Endpoint di debug accessibile pubblicamente può essere abusato per probing.

**Impatto**
- Log poisoning, leakage di strutture interne, superficie inutile in prod.

**Evidenze**
- `apps/backend/src/app.ts:224` (`POST /api/test/json-parser`).

**Mitigazioni consigliate**
- Rimuovere in produzione o proteggere con auth e feature flag.
- Se serve, limitare a `NODE_ENV !== "production"`.

---

## 5) Debug info dettagliata nei 4xx di `workspaceValidationMiddleware` (MEDIUM)

**Rischio**
- Risposte includono URL, headers e dettagli interni utili per reconnaissance.

**Impatto**
- Aiuta a mappare struttura delle API e comportamenti interni.

**Evidenze**
- `apps/backend/src/interfaces/http/middlewares/workspace-validation.middleware.ts:77`.

**Mitigazioni consigliate**
- Ridurre i dettagli nelle risposte pubbliche.
- Loggare i dettagli internamente, non in response.
- Differenziare output per `NODE_ENV`.

---

## 6) CORS permissivo su endpoint pubblici (LOW/MEDIUM)

**Rischio**
- Se endpoint pubblici ritornano dati sensibili, CORS può facilitarne l’uso cross-origin.

**Impatto**
- Esfiltrazione dati da frontend non autorizzati.

**Evidenze**
- `apps/backend/src/app.ts:49` (CORS configurato per domini specifici, ma alcune route sono pubbliche).

**Mitigazioni consigliate**
- Tenere i public endpoints minimali e privi di dati sensibili.
- Per API private, risposte solo a domini autorizzati.

---

## 7) CSP permissiva per `scriptSrc` (LOW)

**Rischio**
- `unsafe-inline` e `unsafe-eval` aumentano rischio XSS.

**Impatto**
- Potenziale esecuzione script non attesi.

**Evidenze**
- `apps/backend/src/app.ts:114` (Helmet CSP).

**Mitigazioni consigliate**
- Rimuovere `unsafe-eval` e limitare `unsafe-inline` quando possibile.
- Introdurre nonce/hashes per script inline.

---

## Azioni rapide consigliate (ordine suggerito)

1. Bloccare o proteggere l’endpoint HOTFIX di blocco clienti.
2. Rimuovere `/workspaces` non autenticato e revisionare risposte sensibili.
3. Separare file pubblici/privati in `/uploads` e introdurre access control.
4. Disabilitare endpoint di test in produzione.
5. Ridurre debug info nelle 4xx del middleware.

