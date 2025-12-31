# TASK24-DEPLOY-env-vars-cleanup

## Description
Uniformare la configurazione env su Heroku (VITE_API_URL, FRONTEND_URL, OPENROUTER, EMAIL, WHATSAPP, CLOUDINARY) e documentare per app corretta.

## Example main code
```bash
# docs/setup/heroku.md
heroku config:set OPENROUTER_API_KEY=... --app echatbot-app
```

## Tests involved
- N/A

## Tests to modify
- N/A

## Acceptance criteria
- Tutte le env variables sono associate all'app corretta.
- Nessuna variabile critica configurata su app inesistente.

## Verification
- `heroku config --app <app>` mostra set coerente.
