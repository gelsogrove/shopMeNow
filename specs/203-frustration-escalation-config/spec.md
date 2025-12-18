# Feature Specification: Frustration Escalation Configuration

**Feature Branch**: `203-frustration-escalation-config`  
**Created**: 2024-12-18  
**Status**: Draft  
**Input**: User description: "Configurazione trigger escalation operatore: textarea nei settings per definire quando il chatbot deve chiamare un operatore (casi di panico/frustrazione)"

## Executive Summary

Questa feature permette agli amministratori di workspace di configurare **quando** il chatbot deve automaticamente chiamare un operatore umano. Attualmente i trigger di frustrazione sono hardcodati nel codice (`merce scaduta`, `prodotto danneggiato`, etc.). Con questa feature, ogni workspace può personalizzare i propri "casi di panico" tramite una textarea nei Settings.

### Campi Coinvolti

1. **`frustrationEscalationInstructions`** (NUOVO): Textarea dove l'admin scrive quando chiamare l'operatore
2. **`hasFrustrationInstructions`** (DERIVATO): Boolean calcolato lato rendering (FE) - `true` se il campo non è vuoto

### Agenti Coinvolti

- **SalesProduct** (sellsProductsAndServices=true): Usa le istruzioni per escalation su problemi prodotti/ordini
- **Info** (sellsProductsAndServices=false): Usa le istruzioni per escalation su problemi informativi

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin configura i trigger di escalation (Priority: P1)

L'amministratore del workspace accede ai Settings e configura le situazioni specifiche in cui il chatbot deve chiamare automaticamente un operatore umano.

**Why this priority**: È il core della feature - senza questa configurazione, il resto non ha senso.

**Independent Test**: L'admin può salvare le istruzioni e vederle persistite nel database. Al reload della pagina, le istruzioni sono ancora presenti.

**Acceptance Scenarios**:

1. **Given** un admin nella pagina Settings, **When** scrive nel campo "Frustration Escalation Instructions" testo come "Chiama operatore quando: cliente ha ricevuto merce sbagliata, merce non arrivata, richiede preventivo personalizzato", **Then** il sistema salva il testo nel database campo `frustrationEscalationInstructions`

2. **Given** un admin che ha salvato le istruzioni, **When** ricarica la pagina Settings, **Then** vede il testo precedentemente inserito nel campo

3. **Given** un admin che vuole disabilitare la feature, **When** cancella tutto il testo dal campo, **Then** il sistema salva stringa vuota e `hasFrustrationInstructions` risulta `false`

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: Textarea in SettingsPage, sotto sezione Human Support
- [x] Backend API: PUT /workspaces/:workspaceId con nuovo campo
- [x] Service Layer: Validazione testo (max 5000 caratteri)
- [x] Repository: Update workspace con workspaceId filter
- [x] Database: Migration per aggiungere campo `frustrationEscalationInstructions`
- [x] Security: 3-layer middleware (authMiddleware → sessionValidation → workspaceValidation)
- [x] Testing: Unit test per save/load, test workspace isolation
- [x] Documentation: Swagger aggiornato
- [x] Concurrency: Non critico (single-user edit)
- [x] Prompt Variables: Nessuna nuova variabile grande
- [x] Code Cleanliness: Modifiche minimali ai file esistenti

---

### User Story 2 - Chatbot usa istruzioni per escalation (Priority: P1)

Quando un cliente scrive un messaggio che corrisponde a uno dei casi configurati dall'admin, il chatbot chiama automaticamente `contactOperator()`.

**Why this priority**: È il comportamento runtime che giustifica l'intera feature.

**Independent Test**: Inviando un messaggio che matcha le istruzioni configurate, il sistema chiama la funzione `contactOperator`.

**Acceptance Scenarios**:

1. **Given** workspace con `frustrationEscalationInstructions` = "Chiama operatore quando: cliente non ha ricevuto la merce", **When** cliente scrive "Non ho ricevuto il mio pacco", **Then** il LLM (Router o CustomerSupport agent) chiama `contactOperator()`

2. **Given** workspace con `frustrationEscalationInstructions` vuoto, **When** cliente scrive messaggio generico di frustrazione, **Then** il sistema usa i trigger di default (backward compatibility)

3. **Given** workspace con `frustrationEscalationInstructions` configurato, **When** cliente scrive messaggio NON correlato ai trigger configurati, **Then** il chatbot risponde normalmente senza escalation

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: N/A (runtime chatbot)
- [x] Backend API: N/A (chatbot internal)
- [x] Service Layer: PromptBuilder inietta `{{frustrationEscalationInstructions}}` nel prompt
- [x] Repository: VariableResolver carica il campo
- [x] Database: Campo già esistente dalla US1
- [x] Security: workspaceId isolation nel caricamento
- [x] Testing: Integration test con messaggio trigger
- [x] Documentation: N/A
- [x] Concurrency: Customer-level locking già presente
- [x] Prompt Variables: `{{frustrationEscalationInstructions}}` usato 1 sola volta
- [x] Code Cleanliness: Modifica template esistenti

---

### User Story 3 - Visualizzazione stato configurazione (Priority: P2)

L'admin vede chiaramente se la feature è attiva o meno (indicatore visivo).

**Why this priority**: Miglioramento UX ma non bloccante.

**Independent Test**: La UI mostra indicatore verde se configurato, grigio se vuoto.

**Acceptance Scenarios**:

1. **Given** workspace con `frustrationEscalationInstructions` non vuoto, **When** admin vede la card Human Support, **Then** vede badge "Custom Escalation Active ✅"

2. **Given** workspace con campo vuoto, **When** admin vede la card, **Then** vede badge "Using Default Triggers" o nessun badge

---

### Edge Cases

- **Campo molto lungo**: Limitare a 5000 caratteri per evitare prompt troppo grandi
- **Caratteri speciali**: Il testo viene passato al LLM, quindi caratteri speciali sono OK
- **Multilingua**: Le istruzioni sono scritte in italiano (lingua base), il LLM capisce e applica in qualsiasi lingua del cliente
- **Conflitto con humanSupportInstructions**: `humanSupportInstructions` è il MESSAGGIO al cliente, `frustrationEscalationInstructions` sono le REGOLE per il chatbot - campi diversi

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Sistema DEVE aggiungere campo `frustrationEscalationInstructions` (TEXT, nullable) alla tabella Workspace
- **FR-002**: Settings Page DEVE mostrare textarea per le istruzioni di escalation sotto "Human Support"
- **FR-003**: Sistema DEVE validare che il testo non superi 5000 caratteri
- **FR-004**: PromptBuilder DEVE includere la variabile `{{frustrationEscalationInstructions}}` nei prompt di ROUTER e CUSTOMER_SUPPORT
- **FR-005**: Se campo vuoto, il sistema DEVE usare i trigger di default hardcodati (backward compatibility)
- **FR-006**: Il campo DEVE essere isolato per workspace (multi-tenant security)
- **FR-007**: GET /workspaces/:id DEVE ritornare anche `frustrationEscalationInstructions`
- **FR-008**: PUT /workspaces/:id DEVE accettare e salvare `frustrationEscalationInstructions`

### Key Entities

- **Workspace**: Aggiunto campo `frustrationEscalationInstructions: String? @db.Text`
- **PromptVariables**: Aggiunta proprietà `frustrationEscalationInstructions: string`

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admin può configurare trigger di escalation in meno di 2 minuti
- **SC-002**: Chatbot risponde correttamente ai trigger configurati nel 95% dei casi
- **SC-003**: Zero regressioni sui trigger di default quando campo è vuoto
- **SC-004**: Tempo di caricamento Settings page non aumenta più di 50ms

---

## Assumptions

1. Le istruzioni sono scritte in italiano (lingua del catalogo) - il LLM traduce automaticamente
2. Il campo è opzionale - default vuoto significa usare trigger hardcodati
3. Non serve validazione semantica del testo (l'admin sa cosa scrive)
4. Il campo è disponibile sia per E-commerce che Info channels

---

## Technical Analysis (Reference for Planning)

### Database Changes
\`\`\`prisma
// packages/database/prisma/schema.prisma
model Workspace {
  // ... existing fields ...
  frustrationEscalationInstructions  String?  @db.Text  // 🆕 Custom escalation triggers
}
\`\`\`

### Files to Modify

**Backend**:
1. `packages/database/prisma/schema.prisma` - Add field
2. `apps/backend/src/application/services/prompt-builder/variable-resolver.service.ts` - Load new variable
3. `apps/backend/src/templates/ecommerce/00-router.template.md` - Add `{{frustrationEscalationInstructions}}`
4. `apps/backend/src/templates/informational/00-router.template.md` - Add `{{frustrationEscalationInstructions}}`
5. `apps/backend/src/templates/shared/05-customer-support.template.md` - Add `{{frustrationEscalationInstructions}}`
6. `apps/backend/src/interfaces/http/controllers/workspace.controller.ts` - Add field to GET/PUT
7. `apps/backend/src/domain/entities/workspace.entity.ts` - Add type definition

**Frontend**:
1. `apps/frontend/src/pages/SettingsPage.tsx` - Add textarea
2. `apps/frontend/src/services/workspaceApi.ts` - Add field to types

**Tests**:
1. Unit test for workspace update with new field
2. Integration test for prompt injection
3. Security test for workspace isolation

---

## Out of Scope

- UI per testare i trigger (futuro)
- Analytics su quante volte viene triggerata l'escalation
- Versioning delle istruzioni
