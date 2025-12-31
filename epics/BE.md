# Backend Review (Best Practices, Architecture, Dead Code, Env/Secrets)

Documento di analisi backend: best practice, struttura (model/repository/router/service), codice morto e gestione .env/secrets.

---

## 1) Architettura e layering (model / repository / router / service)

**Osservazioni**
- Struttura presente e coerente: `domain/`, `repositories/`, `services/`, `interfaces/http/`, `routes/`.
- Routing centrale in `apps/backend/src/routes/index.ts` con separazione per feature.
- Controllers in `interfaces/http/controllers/` e servizi in `application/services/` + `services/` (due livelli).

**Punti di attenzione**
- Doppio livello `application/services` vs `services` può generare confusione nel boundary (cosa è dominio vs infrastruttura).
- Esiste anche `controllers/` top-level (oltre a `interfaces/http/controllers`) → possibile duplicazione o legacy.

**Miglioramenti suggeriti**
- Consolidare in modo esplicito la distinzione: “application services” vs “infrastructure services”.
- Definire naming e ownership: es. tutto HTTP in `interfaces/http/`, tutto domain in `domain/`, tutto infrastruttura in `services/`.
- Valutare se `controllers/` top-level è ancora usato (se no, rimuoverlo o spostarlo).

---

## 2) Best practices API (routing, versioning, sicurezza)

**Osservazioni**
- Versioning presente: `/api/v1` e `/api` in parallelo.
- Middleware: `helmet`, CORS, logging, JSON parser custom, error middleware.

**Punti di attenzione**
- Doppia esposizione `/api` e `/api/v1` può causare superfici doppie e incongruenze.
- Alcuni endpoint pubblici o legacy montati fuori `/api` (es. `/workspaces` root) → maggiore superficie.
- Endpoint di test/debug presenti in produzione (es. `/api/test/json-parser`).

**Miglioramenti suggeriti**
- Stabilire una sola base API (`/api/v1`) e deprecare `/api` quando possibile.
- Evitare mount root non versionati per endpoint “legacy”, o proteggerli.
- Disabilitare endpoint di test in `NODE_ENV=production`.

---

## 3) Codice “morto” o legacy

**Osservazioni**
- Presenza di hotfix/legacy e route di compatibilità (es. `workspaceRoutesLegacy`, mount multipli).
- Presenza di `temp_grouping_section.md` e cartelle legacy (`controllers/` vs `interfaces/http/controllers`).

**Punti di attenzione**
- Hotfix temporanei rimangono in prod più a lungo del previsto.
- Duplicazioni di router possono rendere difficile capire la vera source-of-truth.

**Miglioramenti suggeriti**
- Audit periodico dei route e rimozione dei legacy quando non usati.
- Aggiungere un TODO/expiry per ogni hotfix (es. “remove by date”).
- Usare logging per misurare traffico sui route legacy prima di rimuoverli.

---

## 4) .env e gestione secrets

**Osservazioni**
- `.env.example` è completo e ben organizzato.
- Esistono più file `.env` nel repo: `/.env`, `/apps/backend/.env`, `/terraform/.env` + `.env.backup.*`.

**Rischi**
- Più fonti di verità → confusione su quali variabili vengano caricate in runtime.
- `.env` reali in repo aumentano il rischio di leakage e incoerenza tra ambienti.

**Miglioramenti suggeriti**
- Tenere un solo file `.env` locale (non committato) e usare `.env.example` come base.
- Rimuovere o spostare backup `.env.backup.*` fuori dal repo.
- Definire un’unica strategia: `dotenv` caricato dal root oppure per workspace, ma non entrambe.
- Consolidare secrets in un unico secret manager (Heroku config, Vault, etc.).

---

## 5) Configurazione sicurezza e headers

**Osservazioni**
- Helmet attivo con CSP (buono), HSTS in production.

**Punti di attenzione**
- CSP include `unsafe-inline` e `unsafe-eval` (necessario per alcune librerie, ma aumenta rischio XSS).

**Miglioramenti suggeriti**
- Rimuovere `unsafe-eval` se possibile.
- Sostituire inline script con nonce/hash dove possibile.

---

## 6) Logging & monitoring

**Osservazioni**
- Logging middleware globale.
- Alcune risposte 4xx includono debug esteso (header/params).

**Punti di attenzione**
- Debug info nelle risposte può essere utile per attaccanti (information disclosure).

**Miglioramenti suggeriti**
- Loggare i dettagli internamente, ma rispondere con messaggi generici in prod.
- Separare log levels e redazione di campi sensibili.

---

## 7) Repository pattern

**Osservazioni**
- Repositories presenti (`repositories/`) e use-case/services che li consumano.
- Naming abbastanza coerente.

**Miglioramenti suggeriti**
- Verificare che i repository siano l’unico punto di accesso dati (evitare query dirette sparse).
- Documentare l’uso atteso dei repository per ogni feature.

---

## 8) Checklist rapida miglioramenti (priorità)

1. Consolidare routing pubblico e versioning (`/api` vs `/api/v1`).
2. Rimuovere hotfix/legacy dopo audit traffico.
3. Unificare `.env` e rimuovere file backup dal repo.
4. Ridurre debug info in 4xx in prod.
5. Revisione CSP per rimuovere `unsafe-eval`.

---

## 9) Impatto sul Frontend (se applichiamo i miglioramenti)

Di seguito l’impatto atteso sul FE se applichiamo le modifiche proposte:

### 9.1 Consolidare routing `/api` vs `/api/v1`
**Impatto FE**  
- Se il FE chiama `/api/*`, va aggiornato a `/api/v1/*` (o mantenere alias in backend).  

**Punti da verificare nel FE**  
- Servizi API in `apps/frontend/src/services/*` e `apps/backoffice/src/services/*` (base URL).  

**Mitigazione**  
- Mantenere `/api` come alias per un periodo di transizione o introdurre rewrite lato proxy.

### 9.2 Rimozione di route legacy pubbliche (es. `/workspaces` root)
**Impatto FE**  
- Se esistono chiamate al root `/workspaces` (senza `/api`), andranno spostate a `/api/workspaces`.  

**Mitigazione**  
- Aggiungere un audit nel FE per tutte le chiamate “root” non versionate.

### 9.3 Rimozione endpoint test/debug in produzione
**Impatto FE**  
- Nessun impatto se non sono usati dal FE.  

**Mitigazione**  
- Verificare che `/api/test/json-parser` non sia usato da FE/backoffice o da test automatizzati.

### 9.4 Riduzione debug info nelle risposte 4xx
**Impatto FE**  
- Cambiano i payload errori; eventuali UI che mostrano dettagli “debug” perderanno quelle info.  

**Mitigazione**  
- Verificare componenti che stampano errori completi (log o UI) e adattare a messaggi standard.

### 9.5 Revisione CSP / headers
**Impatto FE**  
- Possibile blocco di script inline o librerie che richiedono `unsafe-eval`.  

**Mitigazione**  
- Identificare componenti che usano inline scripts o eval (es. analytics) e migrare a nonce/hash.

---

## 10) Test da rivedere/aggiornare

### 10.1 Test backend
- Test che verificano endpoint su `/api` potrebbero dover essere aggiornati a `/api/v1`.  
- Test che si aspettano debug info nelle 4xx (es. `workspaceValidationMiddleware`) vanno aggiornati a payload ridotti.  
- Test che chiamano endpoint legacy o hotfix (es. `/workspaces` root o `/api/test/json-parser`) vanno rimossi o aggiornati.

### 10.2 Test frontend
- Test FE/Backoffice che mockano chiamate a `/api/*` possono dover essere riallineati.  
- Test E2E (se presenti) con path non versionati o legacy vanno aggiornati.

### 10.3 Test di sicurezza
- Aggiornare test di access control per verificare che le route legacy non siano più pubbliche.  
- Aggiungere test che verificano l’assenza di debug details in prod (se avete test di sicurezza).

---

## Stato attuale (sintesi)

- **Architettura**: buona separazione a layer, ma con duplicazioni (services/controllers) che possono essere consolidate.
- **Best practices**: presenti ma con alcune eccezioni (legacy routes, endpoint test/debug).
- **Secrets/env**: `.env.example` ok, ma troppe `.env` nel repo → rischio operativo/sicurezza.
- **Codice morto**: probabile presenza di legacy/hotfix; serve audit mirato per rimozione.
