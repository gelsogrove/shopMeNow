# TASK23-DEPLOY-backoffice-serve-dep

## Description
Evitare install globale di `serve` su Heroku e spostarlo tra le dependency del backoffice.

## Example main code
```json
// apps/backoffice/package.json
"dependencies": { "serve": "^14.2.0" }
```

## Tests involved
- N/A

## Tests to modify
- N/A

## Acceptance criteria
- `heroku:backoffice` non usa `npm install -g serve`.
- Backoffice serve avviato via `npx serve` o script npm locale.

## Verification
- Deploy backoffice passa senza install globale.
