# Test Analysis

## Overview
Test suite attuale copre molte logiche backend (unit + security), ma ci sono buchi sulle parti "boundary" (API esposte, websocket, storage/session management, routing FE) e poca copertura end-to-end.

## Cosa e' coperto oggi (alto livello)
**Backend**
- Unit test estesi su servizi e controller (`apps/backend/__tests__/unit/*`).
- Security test dedicati per session validation, 2FA reset, subscription billing, workspace isolation (`apps/backend/__tests__/security/*`).
- Middleware auth/role/billing con test unit (`apps/backend/__tests__/unit/middlewares/*`).

**Frontend**
- Test pagine auth/flow (`apps/frontend/__tests__/pages/*`).
- Test hooks e componenti principali (`apps/frontend/__tests__/hooks/*`, `apps/frontend/__tests__/components/*`).
- Test degli interceptors axios (`apps/frontend/__tests__/services/api.interceptors.spec.ts`).

**Backoffice**
- Test di pagine principali (`apps/backoffice/__tests__/pages/*`).

**Scheduler**
- Test di job/queue e servizi (`apps/scheduler/__tests__/*`).

## Sicurezza: parti critiche ben testate?
**Coperto**
- Session validation e session hijack detection (`apps/backend/__tests__/security/session-validation.middleware.test.ts`).
- 2FA reset flow security (`apps/backend/__tests__/security/two-factor-reset.security.test.ts`).
- Workspace isolation base (`apps/backend/__tests__/security/workspace-isolation-simple.test.ts`).
- Subscription/billing security (`apps/backend/__tests__/security/subscription-billing.security.test.ts`).
- Auth middleware basic (`apps/backend/__tests__/unit/middlewares/auth.middleware.spec.ts`).

**Gap rilevanti (non ho trovato test dedicati)**
- Controlli di auth su route pubbliche “sensibili” (es. upload statici, endpoint di debug, route esposte per errore).
- Websocket: handshake auth/session, access control per workspace, event poisoning.
- Rate limiting e brute-force su login/OTP/2FA.
- CORS/CSRF (soprattutto se cookie-based `withCredentials` e session).
- Validazione accesso file/static e path traversal (se applicabile).
- Controlli su admin-only routes e impersonation flow end-to-end.

## Funzionalita' critica: parti ben testate?
**Coperto**
- Flussi auth FE base (login/returnUrl/2FA redirect) e workspace selection.
- Servizi core backend (billing, workspace, auth, queue, LLM/agent utilities).
- Flussi scheduler (whatsapp queue, campagne, cleanup).

**Gap rilevanti (non ho trovato test dedicati)**
- Redirect root vs landing flag e fallback (FE routing).
- Websocket real-time (invalidate/refetch, toast, chat updates).
- Persistenza storage (token/user/session/workspace) e cleanup coerente.
- API errors end-to-end (401 -> clear -> redirect) con real navigation.
- Flusso completo login -> workspace -> chat (FE+BE).

## Salute della suite
- Test disabilitati presenti: `apps/backend/__tests__/unit/controllers/push.controller.spec.ts.DISABLED`, `apps/backend/__tests__/unit/services/whatsapp-queue.service.spec.ts.disabled`, `apps/backend/src/application/intent/__tests__/intent-parser.test.ts.disabled`.
- Script test manuali non in CI (`apps/backend/scripts/test-*.ts`).
- Poche integrazioni FE/BE (mancano E2E veri).

## Raccomandazioni prioritarie
1) Integrare test di sicurezza su route esposte e websocket (auth+workspace isolation).
2) Aggiungere E2E minimi per login + workspace + chat base.
3) Aggiungere test di storage/session clearing FE (auth/logout/401).
4) Riattivare o rimuovere test disabilitati, decidendo una policy.
5) Definire una "smoke suite" in CI (backend + frontend + scheduler).
