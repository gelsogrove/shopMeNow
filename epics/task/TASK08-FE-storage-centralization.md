# TASK01-FE-storage-centralization

## Description
Centralizzare la gestione di localStorage/sessionStorage per token, user, workspace, sessionId e selectedChatId. Introdurre helper tipizzati per evitare duplicazione e logica incoerente in pagine e hook.

## Example main code
```ts
// apps/frontend/src/lib/storage.ts
export const storage = {
  getToken: () => localStorage.getItem("token"),
  setToken: (token: string) => localStorage.setItem("token", token),
  clearAuth: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("currentWorkspace")
    sessionStorage.clear()
  },
}
```

## Related services/models/best practices
- Centralizzare chiavi e accessi storage in un solo modulo.
- Evitare localStorage.clear() in componenti singoli.
- Preferire sessionStorage per sessionId per-tab.

## Tests involved
- `apps/frontend/__tests__/pages/LoginPage.GoogleOAuth.spec.tsx`
- `apps/frontend/__tests__/pages/LoginPage.returnUrl.spec.tsx`
- `apps/frontend/__tests__/pages/AcceptInvitePage.spec.tsx`
- `apps/frontend/__tests__/pages/WorkspaceSelectionPage.spec.tsx`
- `apps/frontend/__tests__/hooks/useWorkspaceRole.spec.ts`

## Tests to modify
- Aggiornare i test che leggono/scrivono direttamente localStorage.
- Aggiungere test unit per `storage.ts` (get/set/clear).

## Acceptance criteria
- Un solo modulo gestisce accessi a token/user/workspace/sessionId.
- Pagine e hook non accedono piu' direttamente a localStorage per auth/session.
- Nessun comportamento regressivo nei flow login/logout/workspace.

## Verification
- FE build: `cd apps/frontend && npm run build`
- FE tests: `cd apps/frontend && npm run test`
