# TODO

## Ripristinare Ecolaundry / Demowash (se un giorno servisse)

Nota archiviata il 10 settembre 2026.

**Prerequisito**: il codice sorgente dei due moduli chatbot (`custom-ecolaundry/`
e `custom-demowash/`) è salvato da Andrea su Google Drive. Serve prima
recuperare quei file (o dal Drive, o dalla storia git — vedi punto 1) prima
di poter fare qualunque ripristino.

### Cosa è stato rimosso e dove

**Commit `c4fb9cf1c`** ("delete Laudry") ha cancellato fisicamente le
cartelle dei due moduli backend, 65 file in tutto:
- `apps/backend/custom-demowash/` (agent.ts, index.ts, orders.ts, pii.ts,
  state.ts, settings.json, prompts/*, usecases*.md, ...)
- `apps/backend/custom-ecolaundry/` (agent.ts, index.ts, pii.ts, state.ts,
  settings.json, models/flow.ts, utils/*, prompts/*, usecases.md)
- `docs/ecolaundry/pdf/*.pdf` (6 documenti: playbook, PROGRAMES, guide
  risoluzione problemi)

L'ultimo commit che contiene ancora questi file è `7f940fdd3`.

**Commit `7c5d6db05`** (stesso giorno) ha rimosso tutta la superficie
web/UI collegata:
- Route `/demo/ecolaundry` e `/demo/demowash` in `App.tsx`
- Brand config in `DemoWidgetPage.tsx`
- Fallback hardcoded `ECOLAUNDRY_SLUG` in `playground.controller.ts` (ora
  lancia un errore invece di un default silenzioso)
- Pagine marketing `/laundries` e `/laundry-service` (cancellate del tutto)
- Link "Laundries" nel footer del sito
- Componente `DemowashShowcase.tsx` (era già codice morto, mai usato)
- Homepage (`HomeShowcase.tsx`): brand "DemoWash" → "eChatbot", stessa
  storia/scenario lavanderia mantenuta di proposito
- Riferimenti cosmetici (commenti/log) a "ecolaundry" in ~10 file backend

Entrambi i commit sono su `origin/main` (GitHub, repo pubblico
`gelsogrove/shopMeNow`) e deployati su Heroku produzione (release v1312).

### Passaggi per ripristinare

1. **Recuperare il codice del modulo.** Prendere `custom-demowash/` e/o
   `custom-ecolaundry/` dal backup su Google Drive e rimetterli in
   `apps/backend/`.
   Alternativa se il Drive si perde (finché il commit non viene
   riscritto/garbage-collected):
   ```
   git checkout 7f940fdd3 -- apps/backend/custom-ecolaundry apps/backend/custom-demowash docs/ecolaundry
   ```

2. **Ripristinare il workspace nel database.** Il modulo da solo non
   basta — serve un workspace nel DB con `slug` o `customChatbotId` =
   "ecolaundry"/"demowash". Verificare se il workspace originale esiste
   ancora o va ricreato da zero (regola database-first del progetto).

3. **Ricollegare il backend.** Di norma non serve toccare altro: la
   pipeline WhatsApp, il widget-chat controller ecc. risolvono già
   dinamicamente il modulo custom tramite `workspace.customChatbotId`.
   Nota: il fallback hardcoded in `playground.controller.ts` è stato
   rimosso di proposito — va richiesto esplicitamente se lo si vuole
   rimettere, non va reintrodotto in automatico.

4. **Ricreare la pagina demo pubblica** (solo se serve anche
   `/demo/<slug>` pubblica):
   - `App.tsx`: aggiungere una `<Route path="/demo/<slug>/*">`, copiando
     il pattern da una demo esistente (es. demobeauty o demosappada)
   - `DemoWidgetPage.tsx`: aggiungere una entry in `BRAND_THEMES`,
     opzionalmente in `DEMO_ITEMS_I18N` e `PUSH_CASES_I18N`

5. **Ricreare le pagine marketing** (solo se servono di nuovo
   `/laundries` e `/laundry-service`) — sono state cancellate, non solo
   scollegate:
   ```
   git show 7c5d6db05~1:apps/frontend/src/pages/LaundriesPage.tsx
   ```

6. **Homepage**: per rimettere il nome "DemoWash" nella hero (oggi dice
   "eChatbot" con la stessa storia):
   ```
   git show 7c5d6db05~1:apps/frontend/src/components/HomeShowcase.tsx
   ```

7. **Testare prima di dire "fatto"**: `npm run test:unit`, poi verifica
   manuale nel Playground della dashboard (mai testare via WhatsApp
   reale in sviluppo).

8. **Deploy su due remote**: `origin` (GitHub) e `heroku` (produzione).
   Push su GitHub da solo NON aggiorna www.echatbot.ai:
   ```
   heroku auth:whoami   # se fallisce:
   heroku login         # richiede completamento nel browser
   git push heroku main:main
   ```
