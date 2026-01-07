# Analisi Chatbot Informativo (sellsProductsAndServices=false)

## Stato attuale del flow
- **Spartiacque**: `workspace.sellsProductsAndServices` decide e‑commerce vs informativo.
- **Flow informativo non è unico**:
  - `ChatEngine` forza `ASK_FAQ` quando `sellsProductsAndServices=false` (`apps/backend/src/application/chat-engine/chat-engine.service.ts`).
  - `RouterOrchestrationService` usa `InformationalWorkspaceStrategy` solo per intent `UNKNOWN` (`apps/backend/src/services/router-orchestration.service.ts`).
- **InformationalWorkspaceStrategy** usa `CustomerSupportAgentLLM` con template + variabili + FAQ (`apps/backend/src/strategies/informational-workspace.strategy.ts`).

## Perché il chatbot informativo “non va”
1. **Il prompt unico non copre tutti i casi**
   - `CustomerSupportAgentLLM` viene usato solo quando l’intent è `UNKNOWN`.
   - Per altri intent, il `ChatEngine` forza `ASK_FAQ` e passa dal vecchio percorso `dataLoader/responseBuilder`.
   - Risultato: a volte entrano FAQ/variabili, a volte no.

2. **Mancano Safety/Translation/LinkReplacement nel flow informativo**
   - `InformationalWorkspaceStrategy` ritorna `agentResponse.output` senza passare da Safety/Translation/LinkReplacement.
   - Token `[LINK_*]` possono restare non sostituiti; la lingua non è garantita.

3. **Variabili di supporto non sempre coerenti**
   - `CustomerSupportAgentLLM` imposta `hasHumanSupport` da `notificationEmail`, non da `hasHumanSupport`.
   - Se l’email è vuota ma `hasHumanSupport=true`, il prompt riceve `hasHumanSupport=false`.

4. **Alcuni intent bypassano il percorso informativo**
   - `GREETING`, `UPDATE_PROFILE`, `CHANGE_LANGUAGE` vengono gestiti prima del blocco informativo.
   - Se il requisito è “tutto passa dal prompt nuovo”, questi intent vanno riallineati.

## Logging/Debug (intaso)
- Vari prompt vengono loggati o salvati nei debugSteps.
- Rischio: log pesanti + leak di prompt/regole interne.
- Raccomandazione: log solo metadata (length/hash) e mostrare i prompt solo in UI debug on‑demand.

## Sicurezza
- Prompt salvati/loggati = possibile leak di dati.
- Allowed External Links può essere bypassato se non si usa il prompt informativo unico.

## Raccomandazioni (allineate alla tua richiesta)
1. **Flow unico per informativi**  
   `if (!sellsProductsAndServices)` → route unica al prompt `CustomerSupportAgentLLM` con variabili + FAQ.
2. **Hook obbligatorio**: Safety/Translation + LinkReplacement anche nel flow informativo.
3. **Variabili sempre presenti**: bot identity, personality, FAQ, address, human support, allowedExternalLinks.
4. **No log prompt**: solo metadata; debug visivo solo quando richiesto.
