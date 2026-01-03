# Task 02: Completare Token `[LINK_REGISTRATION_WITH_TOKEN]`

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 1h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Completare l'implementazione del caso `[LINK_REGISTRATION_WITH_TOKEN]` nel metodo `replaceLinkTokens()` del `LLMService`.

Attualmente il caso esiste ma è un TODO - dobbiamo chiamare il metodo `generateRegistrationLink()` (già esistente) per generare un link sicuro con token JWT.

---

## 🎯 Obiettivo

Quando l'LLM include `[LINK_REGISTRATION_WITH_TOKEN]` nella risposta (perché l'utente ha chiamato una function protetta senza essere registrato), il sistema deve sostituire il token con un URL reale che porta alla pagina di registrazione con token sicuro.

---

## 💻 Esempi di Codice Principale

### File da Modificare
**Path**: `apps/backend/src/services/llm.service.ts`

### Implementazione

```typescript
/**
 * Replace all link tokens in the response with actual URLs
 */
private async replaceLinkTokens(
  response: string,
  customer: any,
  workspace: any,
  linkReplacements: any[] = []
): Promise<string> {
  let finalResponse = response

  // 🚨 NORMALIZE WRONG TOKENS (existing logic)
  const wrongProfilePatterns = [
    /\[link profilo\]/gi,
    /\[link profile\]/gi,
    /\[profilo link\]/gi,
    /link profilo(?!\w)/gi,
  ]
  wrongProfilePatterns.forEach(pattern => {
    if (pattern.test(finalResponse)) {
      logger.warn(`⚠️ LLM wrote wrong token, normalizing to [LINK_PROFILE_WITH_TOKEN]`)
      finalResponse = finalResponse.replace(pattern, "[LINK_PROFILE_WITH_TOKEN]")
    }
  })

  const wrongCartPatterns = [
    /\[link carrello\]/gi,
    /\[link cart\]/gi,
    /link carrello(?!\w)/gi,
  ]
  wrongCartPatterns.forEach(pattern => {
    if (pattern.test(finalResponse)) {
      logger.warn(`⚠️ LLM wrote wrong cart token, normalizing to [LINK_CHECKOUT_WITH_TOKEN]`)
      finalResponse = finalResponse.replace(pattern, "[LINK_CHECKOUT_WITH_TOKEN]")
    }
  })

  // 🆕 AGGIUNGERE: Normalize wrong registration patterns
  const wrongRegistrationPatterns = [
    /\[link registrazione\]/gi,
    /\[link registration\]/gi,
    /\[registrazione link\]/gi,
    /link registrazione(?!\w)/gi,
  ]
  wrongRegistrationPatterns.forEach(pattern => {
    if (pattern.test(finalResponse)) {
      logger.warn(`⚠️ LLM wrote wrong registration token, normalizing to [LINK_REGISTRATION_WITH_TOKEN]`)
      finalResponse = finalResponse.replace(pattern, "[LINK_REGISTRATION_WITH_TOKEN]")
    }
  })

  // 🔗 Lista completa dei token supportati
  const SUPPORTED_TOKENS = [
    "[LINK_CHECKOUT_WITH_TOKEN]",
    "[LINK_PROFILE_WITH_TOKEN]",
    "[LINK_CATALOG]",
    "[LINK_REGISTRATION_WITH_TOKEN]",  // Already in list
  ]

  // 🔍 Check e replace di tutti i token in sequenza
  for (const token of SUPPORTED_TOKENS) {
    if (!finalResponse.includes(token)) continue

    try {
      switch (token) {
        case "[LINK_CHECKOUT_WITH_TOKEN]": {
          // ... existing logic
          break
        }

        case "[LINK_PROFILE_WITH_TOKEN]": {
          // ... existing logic
          break
        }

        case "[LINK_CATALOG]": {
          // ... existing logic
          break
        }

        case "[LINK_REGISTRATION_WITH_TOKEN]": {
          // ✅ IMPLEMENTARE (era TODO)
          logger.info(`🔗 [TOKEN-REPLACE] Generating registration link for customer ${customer.phone}`)
          
          const registrationLink = await this.generateRegistrationLink(
            customer.phone,
            workspace.id
          )

          linkReplacements.push({
            token,
            replacedWith: registrationLink,
            tokenGenerated: "N/A", // Registration links don't use short tokens
            shortUrlCreated: false,
            timestamp: new Date().toISOString(),
          })

          finalResponse = finalResponse.replace(token, registrationLink)
          
          logger.info(`✅ [TOKEN-REPLACE] Registration link generated: ${registrationLink}`)
          break
        }

        default:
          logger.warn(`⚠️ [TOKEN-REPLACE] Unknown token: ${token}`)
      }
    } catch (error) {
      logger.error(`❌ [TOKEN-REPLACE] Error replacing ${token}:`, error)
    }
  }

  // ... rest of method (AUTO-FIX logic)
  return finalResponse
}

/**
 * Generate registration link with secure token
 * This method already exists - we just need to call it!
 */
private async generateRegistrationLink(
  phone: string,
  workspaceId: string
): Promise<string> {
  const { SecureTokenService } = require("./secure-token.service")
  const secureTokenService = new SecureTokenService()

  // Create secure token for registration (24 hours validity)
  const token = await secureTokenService.generateToken(
    {
      phone: phone,
      workspaceId: workspaceId,
      type: "registration",
    },
    "24h" // Token expiration from env
  )

  const workspaceUrl = process.env.FRONTEND_URL || "http://localhost:3000"
  return `${workspaceUrl}/registration?token=${token}`
}
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] LLM response contiene `[LINK_REGISTRATION_WITH_TOKEN]` → viene sostituito con URL valido
- [ ] URL formato: `https://domain.com/registration?token=JWT_TOKEN`
- [ ] Token JWT valido per 24h
- [ ] Token contiene: `phone`, `workspaceId`, `type: "registration"`
- [ ] Link funziona quando l'utente ci clicca (verifica manuale dopo deploy)

### Tecnici
- [ ] Metodo `generateRegistrationLink()` chiamato correttamente
- [ ] `linkReplacements` array contiene entry per il token sostituito
- [ ] Logging info prima e dopo sostituzione
- [ ] Gestione errori con try/catch (no crash se generazione fallisce)
- [ ] Pattern normalization per varianti sbagliate del token

### Test
- [ ] No errori TypeScript: `npm run build`
- [ ] Tutti i test passano: `npm run test`
- [ ] Unit test per token replacement (Task 08)

---

## 🔗 File Correlati

- `apps/backend/src/services/llm.service.ts` - Implementazione replacement
- `apps/backend/src/services/secure-token.service.ts` - Generazione token JWT
- `apps/backend/src/services/function-executor.service.ts` - Genera messaggio con token (Task 01)

---

## 📋 Checklist Implementazione

- [ ] Aggiungere pattern normalization per wrong registration tokens
- [ ] Implementare case `[LINK_REGISTRATION_WITH_TOKEN]` nel switch
- [ ] Chiamare `this.generateRegistrationLink(customer.phone, workspace.id)`
- [ ] Aggiungere entry a `linkReplacements` array
- [ ] Sostituire token nella response con `finalResponse.replace()`
- [ ] Aggiungere logging info (BEFORE + AFTER)
- [ ] Verificare gestione errori con try/catch
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Testare: `npm run test` - verificare 0 test falliti

---

**Dependencies**: Task 01 (function executor genera messaggio con token)  
**Blocks**: Task 08 (test token replacement)  
**Last Updated**: 2026-01-03
