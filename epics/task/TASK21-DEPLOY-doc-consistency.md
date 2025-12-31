# TASK21-DEPLOY-doc-consistency

## Description
Allineare la documentazione Heroku con gli script reali (numero app, nomi app, URL).

## Example main code
```md
# docs/setup/heroku.md
# Usa echatbot-app, echatbot-backoffice, echatbot-scheduler in modo coerente
```

## Tests involved
- N/A

## Tests to modify
- N/A

## Acceptance criteria
- `docs/setup/heroku.md` coerente con `scripts/heroku-setup.sh`.
- Nessun riferimento a app inesistenti (`echatbot-api`).

## Verification
- Review manuale doc.
