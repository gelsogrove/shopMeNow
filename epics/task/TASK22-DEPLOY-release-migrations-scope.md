# TASK22-DEPLOY-release-migrations-scope

## Description
Limitare le migrations Prisma alla sola app backend (evitare scheduler/backoffice).

## Example main code
```bash
# .heroku-release
if [ "$HEROKU_APP_NAME" = "echatbot-backoffice" ] || [ "$HEROKU_APP_NAME" = "echatbot-scheduler" ]; then
  echo "Skipping release"
  exit 0
fi
```

## Tests involved
- N/A

## Tests to modify
- N/A

## Acceptance criteria
- Scheduler e backoffice non eseguono `prisma migrate deploy`.
- Migrazioni restano solo su app principale.

## Verification
- Deploy di ciascuna app senza migrazioni duplicate.
