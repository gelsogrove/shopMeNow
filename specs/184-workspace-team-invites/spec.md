# Feature Specification: Workspace Team Invites

**Feature Branch**: `184-workspace-team-invites`  
**Created**: 2025-01-20  
**Status**: Draft  
**Input**: User description: "ora vorrei che nella pagina dove bisogna selezionare i channel il workspace selection vorrei sotto una tabella di add Friends - sistema di inviti per team con ruoli SUPER_ADMIN/ADMIN"

## Overview

Implementare un sistema di inviti per workspace che permetta ai SUPER_ADMIN di invitare altri utenti come ADMIN. I canali (workspace) sono raggruppati per `ownerId` - un singolo invito garantisce accesso a TUTTI i canali dell'owner.

### Key Concepts

- **SUPER_ADMIN**: Chi crea il workspace/canale. Ha controllo totale.
- **ADMIN**: Utente invitato. Può lavorare ma NON può invitare/rimuovere membri o creare/eliminare canali.
- **Channel Grouping**: Campo `ownerId` nel Workspace raggruppa tutti i canali di un owner.
- **1 Invite = All Channels**: Un invito dà accesso a TUTTI i canali dello stesso owner.
- **Auto-propagation**: Nuovo canale creato → tutti gli ADMIN esistenti lo vedono automaticamente.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - SUPER_ADMIN Invita un Nuovo Membro (Priority: P1)

Come SUPER_ADMIN, voglio invitare un utente via email in modo che possa accedere a tutti i miei canali come ADMIN.

**Why this priority**: Funzionalità core - senza questa, nessun team può essere costruito.

**Independent Test**: Può essere testato inviando un invito e verificando che l'email arrivi con token valido.

**Acceptance Scenarios**:

1. **Given** sono un SUPER_ADMIN sulla WorkspaceSelectionPage, **When** clicco "Invite Member" e inserisco email valida, **Then** viene creato un invito con token 32-byte hex, hash SHA-256 salvato nel DB, email inviata con link `/accept-invite?token=xxx`, stato PENDING.

2. **Given** inserisco un'email già invitata (PENDING), **When** confermo l'invito, **Then** il sistema mostra errore "Invite already pending for this email".

3. **Given** inserisco un'email di utente già membro, **When** confermo l'invito, **Then** il sistema mostra errore "User is already a member of this workspace".

4. **Given** il servizio SMTP fallisce, **When** tento di inviare l'invito, **Then** l'invito NON viene creato e viene mostrato errore "Failed to send invitation email".

5. **Given** creo un invito, **When** verifico il database, **Then** l'invito ha `expiresAt` = now + 7 giorni.

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: InviteMemberModal con form email, loading state, error handling
- [x] Backend API: POST /api/workspaces/:workspaceId/invitations (authMiddleware, sessionValidationMiddleware, validateWorkspaceOperation, requireSuperAdmin)
- [x] Service Layer: WorkspaceInvitationService.createInvitation() con workspace isolation
- [x] Repository: Queries con workspaceId filter
- [x] Database: WorkspaceInvitation table, migrazioni
- [x] Security: Solo SUPER_ADMIN può creare inviti (requireSuperAdmin middleware)
- [x] Testing: Unit tests per service/controller/middleware
- [x] Documentation: Swagger updated
- [x] Concurrency: Transaction per creazione invito
- [x] Code Cleanliness: No temp files, no unused code

---

### User Story 2 - Utente Esistente Accetta Invito (Priority: P1)

Come utente già registrato, voglio accettare un invito cliccando il link email, senza dover fare login.

**Why this priority**: Senza accettazione, gli inviti sono inutili. Token-based = UX migliore.

**Independent Test**: Utente con account esistente clicca link e ottiene accesso a tutti i canali.

**Acceptance Scenarios**:

1. **Given** sono un utente registrato con email mario@test.com, **When** clicco il link `/accept-invite?token=xxx` (invito valido per mario@test.com), **Then** vengo aggiunto come ADMIN a TUTTI i canali dell'owner, invito status → ACCEPTED, redirect a WorkspaceSelectionPage.

2. **Given** il token è scaduto (>7 giorni), **When** clicco il link, **Then** vedo errore "Invitation has expired" con opzione di richiedere nuovo invito.

3. **Given** il token è già stato usato (status ACCEPTED), **When** clicco il link, **Then** vedo messaggio "Invitation already accepted" con redirect a login.

4. **Given** sono loggato con email diversa dall'invito, **When** clicco il link, **Then** vedo errore "This invitation was sent to a different email address".

5. **Given** accetto l'invito, **When** verifico il database, **Then** UserWorkspace entries create per TUTTI i workspace con stesso `ownerId`.

**360-Degree Validation**:

- [x] Frontend: AcceptInvitePage con gestione stati (loading, success, error, expired)
- [x] Backend API: POST /api/invitations/accept (public endpoint, no auth required)
- [x] Service Layer: WorkspaceInvitationService.acceptInvitation() + WorkspaceMemberService.addMemberToAllOwnerChannels()
- [x] Repository: Transaction per aggiungere a tutti i canali atomicamente
- [x] Database: Query per trovare tutti workspace by ownerId
- [x] Security: Token hash comparison, expiry check
- [x] Testing: Unit tests per tutti gli scenari di accettazione

---

### User Story 3 - Nuovo Utente Accetta Invito e Si Registra (Priority: P1)

Come persona senza account, voglio accettare un invito e completare la registrazione con password e 2FA.

**Why this priority**: Permette di invitare persone esterne al sistema.

**Implementation Decision**: ✅ **HANDLED BY EXISTING REGISTRATION FLOW**

> **Rationale**: Instead of creating a dedicated `InviteRegistrationPage`, new users use the existing registration flow:
> 1. User clicks invite link → sees `AcceptInvitePage` with "Log In to Accept"
> 2. Header already shows "Registrati / Login" options
> 3. User registers via standard flow (password + 2FA)
> 4. Returns to invite link (from email) → now logged in → clicks "Accept Invitation"
>
> **Benefits**:
> - No code duplication (registration, password validation, 2FA setup)
> - Single source of truth for registration logic
> - Consistent UX across all registration paths
> - Easier maintenance

**Acceptance Scenarios** (via existing flow):

1. **Given** non ho un account e ricevo invito a mario@test.com, **When** clicco il link, **Then** vedo AcceptInvitePage con header "Registrati" visibile.

2. **Given** clicco "Registrati" nell'header, **When** completo registrazione standard (password + 2FA), **Then** account creato normalmente.

3. **Given** ho completato la registrazione e sono loggato, **When** torno al link dell'invito, **Then** posso cliccare "Accept Invitation" e vengo aggiunto come ADMIN.

**360-Degree Validation**:

- [x] Frontend: Uses existing registration flow + AcceptInvitePage (**NO dedicated page needed**)
- [x] Backend API: Uses existing registration + POST /api/invitations/accept
- [x] Service Layer: Existing registration + WorkspaceInvitationService.acceptInvitation()
- [x] Security: Same password policy as normal registration (already implemented)
- [x] Testing: Covered by existing registration tests + AcceptInvitePage tests

---

### User Story 4 - SUPER_ADMIN Visualizza Team Members (Priority: P1)

Come SUPER_ADMIN, voglio vedere la lista di tutti i membri e inviti pendenti per gestire il mio team.

**Why this priority**: Necessario per gestire il team - vedere chi ha accesso.

**Independent Test**: SUPER_ADMIN apre sezione Team e vede tabella con membri e inviti.

**Acceptance Scenarios**:

1. **Given** sono SUPER_ADMIN con 2 ADMIN e 1 invito pendente, **When** apro WorkspaceSelectionPage, **Then** vedo sezione "Team" con due tab: "Members" (3 righe: me + 2 ADMIN) e "Pending Invites" (1 riga).

2. **Given** la tabella Members, **When** visualizzo le colonne, **Then** vedo: Email, Role (SUPER_ADMIN/ADMIN), Joined Date, Actions.

3. **Given** la tabella Pending Invites, **When** visualizzo le colonne, **Then** vedo: Email, Sent Date, Expires Date, Actions (Cancel).

4. **Given** un invito è scaduto, **When** visualizzo la tabella, **Then** lo stato mostra "Expired" con possibilità di re-inviare.

**360-Degree Validation**:

- [x] Frontend: TeamMembersTable con tabs, useWorkspaceRole hook
- [x] Backend API: GET /api/workspaces/:workspaceId/members, GET /api/workspaces/:workspaceId/invitations
- [x] Service Layer: WorkspaceMemberService.getMembers(), WorkspaceInvitationService.getPendingInvitations()
- [x] Security: Solo membri del workspace possono vedere (SUPER_ADMIN e ADMIN)

---

### User Story 5 - SUPER_ADMIN Rimuove un Membro (Priority: P2)

Come SUPER_ADMIN, voglio rimuovere un ADMIN dal team in modo che perda accesso a tutti i miei canali.

**Why this priority**: Gestione team - necessario ma meno urgente della creazione.

**Independent Test**: SUPER_ADMIN rimuove un ADMIN e verifica che non appaia più.

**Acceptance Scenarios**:

1. **Given** sono SUPER_ADMIN con ADMIN "mario@test.com" che ha accesso a 3 canali, **When** clicco "Remove" e confermo, **Then** TUTTE le UserWorkspace entries di Mario per i miei canali vengono eliminate.

2. **Given** tento di rimuovere me stesso (SUPER_ADMIN), **When** clicco Remove, **Then** il pulsante è disabilitato o mostra errore "Cannot remove yourself".

3. **Given** rimuovo un membro, **When** lui tenta di accedere, **Then** non vede più i miei canali nel dropdown.

4. **Given** Mario ha canali propri (è SUPER_ADMIN di altri workspace), **When** lo rimuovo dai miei, **Then** i SUOI canali non vengono toccati.

**360-Degree Validation**:

- [x] Backend API: DELETE /api/workspaces/:workspaceId/members/:userId
- [x] Service Layer: WorkspaceMemberService.removeMember() rimuove da TUTTI i canali dell'owner
- [x] Security: Solo SUPER_ADMIN può rimuovere, non può rimuovere se stesso
- [x] Testing: Unit tests con mock di transaction

---

### User Story 6 - SUPER_ADMIN Cancella Invito Pendente (Priority: P2)

Come SUPER_ADMIN, voglio cancellare un invito pendente prima che venga accettato.

**Why this priority**: Permette correzione errori (email sbagliata).

**Independent Test**: Cancellare un invito e verificare che il token non funzioni più.

**Acceptance Scenarios**:

1. **Given** ho un invito pendente per "wrong@email.com", **When** clicco "Cancel" e confermo, **Then** invito status → CANCELLED, token invalidato.

2. **Given** l'utente clicca il link dell'invito cancellato, **When** tenta di accettare, **Then** vede errore "This invitation has been cancelled".

**360-Degree Validation**:

- [x] Backend API: DELETE /api/workspaces/:workspaceId/invitations/:invitationId
- [x] Service Layer: WorkspaceInvitationService.cancelInvitation()
- [x] Security: Solo SUPER_ADMIN può cancellare

---

### User Story 7 - SUPER_ADMIN Re-invia Invito Scaduto (Priority: P3)

Come SUPER_ADMIN, voglio re-inviare un invito scaduto senza dover ricreare tutto.

**Why this priority**: Nice-to-have per UX, non critico per MVP.

**Independent Test**: Re-inviare invito scaduto e verificare nuovo token ed email.

**Acceptance Scenarios**:

1. **Given** ho un invito scaduto, **When** clicco "Resend", **Then** nuovo token generato, nuovo expiresAt, email re-inviata, vecchio token invalidato.

**360-Degree Validation**:

- [x] Backend API: POST /api/workspaces/:workspaceId/invitations/:invitationId/resend
- [x] Service Layer: WorkspaceInvitationService.resendInvitation()

---

### User Story 8 - Nuovo Canale Auto-Aggiunge ADMIN Esistenti (Priority: P2)

Come SUPER_ADMIN, quando creo un nuovo canale, voglio che tutti i miei ADMIN esistenti abbiano automaticamente accesso.

**Why this priority**: Consistenza del sistema multi-canale.

**Independent Test**: Creare nuovo canale e verificare che ADMIN esistenti lo vedano.

**Acceptance Scenarios**:

1. **Given** ho 2 ADMIN (Mario, Luigi) con accesso ai miei 3 canali, **When** creo un 4° canale, **Then** UserWorkspace entries create automaticamente per Mario e Luigi con role ADMIN.

2. **Given** creo nuovo canale, **When** Mario fa login, **Then** vede il nuovo canale nel dropdown senza azioni aggiuntive.

**360-Degree Validation**:

- [x] Service Layer: WorkspaceService.create() modificato per propagare agli ADMIN esistenti
- [x] Repository: Query per trovare tutti gli ADMIN dell'owner
- [x] Testing: Unit test per auto-propagation

---

### User Story 9 - ADMIN Vede Team ma Non Può Modificare (Priority: P2)

Come ADMIN, voglio vedere il team ma non avere i controlli per modificarlo.

**Why this priority**: Trasparenza per ADMIN senza compromettere sicurezza.

**Independent Test**: Login come ADMIN e verificare pulsanti disabilitati.

**Acceptance Scenarios**:

1. **Given** sono ADMIN, **When** apro WorkspaceSelectionPage, **Then** vedo sezione Team con tabelle Members e Pending Invites.

2. **Given** sono ADMIN, **When** guardo i pulsanti "Invite Member", "Remove", "Cancel", **Then** sono visibili ma disabilitati con `opacity-50 cursor-not-allowed`.

3. **Given** sono ADMIN e hover su pulsante disabilitato, **When** aspetto, **Then** tooltip mostra "Only workspace owner can perform this action".

**360-Degree Validation**:

- [x] Frontend: useWorkspaceRole hook, conditional button rendering
- [x] Backend API: GET endpoints accessibili a tutti i membri
- [x] Security: POST/DELETE bloccati per ADMIN via requireSuperAdmin middleware

---

### Edge Cases

- **Email case-sensitivity**: Emails normalizzate a lowercase per confronto.
- **Self-invite**: SUPER_ADMIN non può invitare se stesso (già membro).
- **Concurrent invites**: Due SUPER_ADMIN dello stesso owner invitano stessa email → primo vince, secondo riceve errore.
- **User deletes account**: Future feature - per ora non implementato.
- **Workspace deletion**: Quando SUPER_ADMIN elimina workspace, tutti gli inviti pendenti → CANCELLED.
- **Token collision**: Statisticamente impossibile con 32 bytes (256 bit), ma check unicità nel DB.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow SUPER_ADMIN to invite users via email.
- **FR-002**: System MUST generate secure 32-byte hex tokens for invitations.
- **FR-003**: System MUST store only SHA-256 hash of tokens in database.
- **FR-004**: System MUST set invitation expiry to 7 days from creation.
- **FR-005**: System MUST send invitation email with accept link.
- **FR-006**: System MUST allow existing users to accept invites without login.
- **FR-007**: System MUST allow new users to register via invite link.
- **FR-008**: System MUST enforce 2FA setup for new users registering via invite.
- **FR-009**: System MUST add accepted users to ALL workspaces with same ownerId.
- **FR-010**: System MUST auto-add existing ADMINs when SUPER_ADMIN creates new channel.
- **FR-011**: System MUST allow SUPER_ADMIN to remove ADMIN from all their channels.
- **FR-012**: System MUST allow SUPER_ADMIN to cancel pending invitations.
- **FR-013**: System MUST allow SUPER_ADMIN to resend expired invitations.
- **FR-014**: System MUST display team members and pending invites to all members.
- **FR-015**: System MUST disable invite/remove controls for ADMIN users with tooltip.
- **FR-016**: System MUST reject duplicate invites (same email, pending status).
- **FR-017**: System MUST reject invites to existing members.
- **FR-018**: System MUST NOT create invite if email sending fails.

### Non-Functional Requirements

- **NFR-001**: All endpoints MUST filter by workspaceId for multi-tenant isolation.
- **NFR-002**: Invite creation MUST use database transaction.
- **NFR-003**: Accept invitation MUST use database transaction for atomicity.
- **NFR-004**: Token comparison MUST be timing-safe (constant time).
- **NFR-005**: 100% unit test coverage for all new services/controllers/middleware.
- **NFR-006**: NO integration tests (per Andrea's requirement).

### Key Entities

- **WorkspaceInvitation**: id, email, workspaceId, tokenHash, invitedById, status (PENDING/ACCEPTED/CANCELLED/EXPIRED), expiresAt, createdAt, acceptedAt
- **Workspace.ownerId**: FK to User - groups all channels by owner
- **UserWorkspace.role**: Enum WorkspaceRole (SUPER_ADMIN, ADMIN) instead of String

---

## Database Changes

### New Enum

```prisma
enum WorkspaceRole {
  SUPER_ADMIN
  ADMIN
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  CANCELLED
  EXPIRED
}
```

### Modified Tables

```prisma
model Workspace {
  // ... existing fields
  ownerId String // NEW: FK to User (SUPER_ADMIN)
  owner   User   @relation("OwnedWorkspaces", fields: [ownerId], references: [id])
}

model UserWorkspace {
  // ... existing fields
  role WorkspaceRole // CHANGE: from String to enum
}
```

### New Table

```prisma
model WorkspaceInvitation {
  id          String           @id @default(cuid())
  email       String
  workspaceId String
  workspace   Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tokenHash   String           @unique
  invitedById String
  invitedBy   User             @relation(fields: [invitedById], references: [id])
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime
  createdAt   DateTime         @default(now())
  acceptedAt  DateTime?

  @@index([workspaceId])
  @@index([email])
  @@index([status])
}
```

---

## API Endpoints

### Invitation Endpoints

| Method | Path | Auth | Middleware | Description |
|--------|------|------|------------|-------------|
| POST | /api/workspaces/:workspaceId/invitations | JWT | auth, session, workspace, requireSuperAdmin | Create invitation |
| GET | /api/workspaces/:workspaceId/invitations | JWT | auth, session, workspace | List pending invitations |
| DELETE | /api/workspaces/:workspaceId/invitations/:id | JWT | auth, session, workspace, requireSuperAdmin | Cancel invitation |
| POST | /api/workspaces/:workspaceId/invitations/:id/resend | JWT | auth, session, workspace, requireSuperAdmin | Resend invitation |
| POST | /api/invitations/accept | Public | none | Accept invitation (existing user) |
| GET | /api/invitations/validate/:token | Public | none | Validate token and get invitation info |

> **Note**: `POST /api/invitations/accept-register` removed - new users use existing registration flow then accept invite separately.

### Member Endpoints

| Method | Path | Auth | Middleware | Description |
|--------|------|------|------------|-------------|
| GET | /api/workspaces/:workspaceId/members | JWT | auth, session, workspace | List workspace members |
| DELETE | /api/workspaces/:workspaceId/members/:userId | JWT | auth, session, workspace, requireSuperAdmin | Remove member |

---

## Frontend Components

### New Components

- `TeamMembersTable.tsx` - Main component with tabs (Members | Pending Invites)
- `InviteMemberModal.tsx` - Modal with email form
- `AcceptInvitePage.tsx` - Page for accepting invite (shows login prompt if not authenticated)

> **Note**: `InviteRegistrationPage.tsx` removed - new users use existing `/auth/register` flow then return to accept invite.

### New Hooks

- `useWorkspaceRole.ts` - Returns current user's role (SUPER_ADMIN/ADMIN) in workspace

### New Services

- `teamApi.ts` - API client for invitation and member endpoints (invitationApi + teamMemberApi)

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: SUPER_ADMIN can invite a user and they receive email within 30 seconds.
- **SC-002**: Existing user can accept invite with single click (no login required).
- **SC-003**: New user can complete registration via invite in under 3 minutes.
- **SC-004**: Removed ADMIN loses access to all channels immediately.
- **SC-005**: New channel automatically visible to all existing ADMINs.
- **SC-006**: 100% unit test coverage for all new code.
- **SC-007**: ADMIN cannot trigger any modification action (enforced by backend).
- **SC-008**: Invitation tokens are secure (32 bytes, hashed, 7-day expiry).

---

## Implementation Order

1. **Database Migration**: Add ownerId, WorkspaceRole enum, WorkspaceInvitation table
2. **Data Migration**: Populate ownerId for existing workspaces, convert role strings to enum
3. **Backend Services**: WorkspaceInvitationService, WorkspaceMemberService
4. **Backend Middleware**: requireSuperAdmin, hasWorkspaceAccess
5. **Backend Controllers**: InvitationController, MemberController
6. **Backend Routes**: Wire up all endpoints
7. **Frontend Hooks**: useWorkspaceRole
8. **Frontend API**: invitationApi, memberApi
9. **Frontend Components**: TeamMembersTable, InviteMemberModal
10. **Frontend Pages**: AcceptInvitePage, InviteRegistrationPage
11. **Unit Tests**: 100% coverage for all new code
12. **Swagger Documentation**: Update all endpoints

---

## Notes

- **WhatsApp Testing**: NOT available - this is backend/frontend only feature.
- **Email Service**: Uses existing email infrastructure.
- **2FA Flow**: Same as normal registration (password + QR code required).
- **No Integration Tests**: Per Andrea's explicit requirement.
