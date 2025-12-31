# Heroku Deploy Check

## Scope
Verifica best practices e coerenza tra documentazione, script e config Heroku.

## Stato attuale (sintesi)
- Deploy multi-app: app principale (backend+frontend), backoffice, scheduler.
- Build su Heroku via `heroku-postbuild` (workspace build + prisma generate).
- Procfile separati per app, con copia in build (`heroku:backoffice`, `heroku:scheduler`).

## Punti OK
- `heroku-postbuild` per app specifiche usando `HEROKU_APP_NAME`.
- `Procfile.scheduler` separato (worker-only) e `Procfile` principale per backend.
- `.slugignore` limita file non necessari e mantiene prompt assets necessari.

## Problemi / mismatch rilevati
1) **Documentazione incongruente su numero app e nomi**
   - `docs/setup/heroku.md` parla di 3/4 app e usa nomi misti (`echatbot-app` vs `echatbot-api`).
   - Script `scripts/heroku-setup.sh` crea 3 app (app, backoffice, scheduler).

2) **Env vars configurate su app sbagliata**
   - In `docs/setup/heroku.md` molte variabili (OpenRouter, Email, WhatsApp, Cloudinary) vengono settate su `echatbot-api`, ma l'app reale e' `echatbot-app`.

3) **Release migrations su scheduler**
   - `.heroku-release` salta solo backoffice, ma scheduler non dovrebbe eseguire migration.
   - Best practice: migrazioni solo sulla app principale (backend).

4) **Backoffice build/serve**
   - `heroku:backoffice` fa `npm install -g serve` (globale). Consigliato aggiungere `serve` come dependency per evitare install global.

5) **Procfile.backoffice commento errato**
   - Commento cita worker/scheduler, ma la Procfile backoffice ha solo `web:`.

6) **docs/setup/heroku.md**
   - Contiene duplicazioni e parti incoerenti (es. sezione “Backend + Frontend” e poi “Frontend” separato con URL diversi).

## Raccomandazioni
- Allineare doc e script su: numero app, nomi app, env vars e flusso deploy.
- Limitare migrations al solo backend.
- Rendere il serve del backoffice parte delle dipendenze (no global).
- Aggiornare checklist con nomi reali e URL corretti.

## Comandi di verifica consigliati
- Build: `npm run build`
- Backend tests: `cd apps/backend && npm run test:unit`
- Deploy script: `./scripts/deploy-all-heroku.sh`

