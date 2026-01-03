# Task 01: Implementare Registration Guard nel FunctionExecutorService

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 2h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Implementare un sistema di "guard" nel `FunctionExecutorService` che verifica se il customer è registrato (`isActive=true`) PRIMA di eseguire function che richiedono dati personalizzati (carrello, ordini, fatture, profilo).

Se l'utente NON è registrato, ritornare un errore con messaggio che include il token `[LINK_REGISTRATION_WITH_TOKEN]` per invitare alla registrazione.

---

## 🎯 Obiettivo

Proteggere 10 function che operano su dati personalizzati, permettendo comunque all'utente di:
- ✅ Vedere prodotti e servizi
- ✅ Chiedere informazioni
- ✅ Contattare operatore
- ❌ Aggiungere al carrello (richiede registrazione)
- ❌ Vedere ordini (richiede registrazione)
- ❌ Modificare profilo (richiede registrazione)

---

## 💻 Esempi di Codice Principale

### File da Modificare
**Path**: `apps/backend/src/services/function-executor.service.ts`

### Implementazione

```typescript
import logger from "../utils/logger"

export interface ExecutionContext {
  workspaceId: string
  customerId: string
  customerName: string
  customerLanguage: string
  customerDiscount: number
  customerIsActive: boolean  // ✅ NUOVO: aggiungere al context
}

export class FunctionExecutorService {
  // Lista function che richiedono registrazione (isActive=true)
  private readonly FUNCTIONS_REQUIRING_REGISTRATION = [
    // CART (3)
    'addToCart',
    'viewCart', 
    'clearCart',
    // ORDERS (5)
    'getLinkOrderByCode',
    'repeatOrder',
    'getOrderDetails',
    'confirmOrder',
    'showCheckout',
    // PROFILE (2)
    'handlePushNotifications',
    'getProfileLink'
  ]

  /**
   * Execute a function with registration guard
   */
  async execute(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // 🚫 REGISTRATION GUARD - Check BEFORE execution
    if (this.FUNCTIONS_REQUIRING_REGISTRATION.includes(functionName)) {
      if (!context.customerIsActive) {
        logger.info(`🚫 [FUNCTION-GUARD] Function ${functionName} requires registration`, {
          customerId: context.customerId,
          function: functionName
        })
        
        return {
          success: false,
          error: "REGISTRATION_REQUIRED",
          message: "Per questa operazione devi completare la registrazione. Clicca qui: [LINK_REGISTRATION_WITH_TOKEN]"
        }
      }
    }

    // ✅ Customer is registered OR function is public - proceed normally
    logger.info(`✅ [FUNCTION-GUARD] Executing function ${functionName}`, {
      customerId: context.customerId,
      isRegistered: context.customerIsActive
    })

    // Original switch logic
    let result: any

    switch (functionName) {
      case "addToCart":
      case "addProduct": // backward compatibility
        result = await this.addToCart(args, context)
        break

      case "viewCart":
        result = await this.viewCart(context)
        break

      case "clearCart":
        result = await this.clearCart(context)
        break

      case "getLinkOrderByCode":
        result = await this.getLinkOrderByCode(args, context)
        break

      case "repeatOrder":
        result = await this.repeatOrder(args, context)
        break

      case "getOrderDetails":
        result = await this.getOrderDetails(args, context)
        break

      case "confirmOrder":
        result = await this.confirmOrder(context)
        break

      case "showCheckout":
        result = await this.showCheckout(context)
        break

      case "handlePushNotifications":
        result = await this.handlePushNotifications(args, context)
        break

      case "getProfileLink":
        result = await this.getProfileLink(context)
        break

      // PUBLIC FUNCTIONS - no guard needed
      case "getProductDetails":
        result = await this.getProductDetails(args, context)
        break

      case "getServiceDetails":
        result = await this.getServiceDetails(args, context)
        break

      case "searchProductForStatistic":
        result = await this.searchProductForStatistic(args, context)
        break

      case "contactOperator":
        result = await this.contactOperator(context)
        break

      default:
        throw new Error(`Unknown function: ${functionName}`)
    }

    return result
  }

  // ... rest of methods unchanged
}
```

### Chiamante (chat-engine.service.ts)
Deve passare `customerIsActive` nel context:

```typescript
// In chat-engine.service.ts - quando crea ExecutionContext
const executionContext: ExecutionContext = {
  workspaceId: this.workspaceId,
  customerId: this.customerId,
  customerName: this.customerName,
  customerLanguage: this.customerLanguage,
  customerDiscount: this.customerDiscount || 0,
  customerIsActive: this.customer.isActive  // ✅ AGGIUNGERE
}

const result = await functionExecutor.execute(
  functionName,
  functionArgs,
  executionContext
)

// Se result.error === "REGISTRATION_REQUIRED"
// L'LLM riceve il messaggio con [LINK_REGISTRATION_WITH_TOKEN]
// e decide come formulare l'invito alla registrazione
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Utente NON registrato (`isActive=false`) che chiama `addToCart` riceve errore con link registrazione
- [ ] Utente NON registrato che chiama `viewCart` riceve errore con link registrazione
- [ ] Utente NON registrato che chiama `getProductDetails` funziona normalmente (public)
- [ ] Utente NON registrato che chiama `contactOperator` funziona normalmente (public)
- [ ] Utente registrato (`isActive=true`) può chiamare TUTTE le function

### Tecnici
- [ ] `FUNCTIONS_REQUIRING_REGISTRATION` array contiene esattamente 10 function
- [ ] Guard viene eseguito PRIMA del switch (no esecuzione inutile)
- [ ] Messaggio errore contiene esattamente `[LINK_REGISTRATION_WITH_TOKEN]`
- [ ] Logging corretto con level `info` (non `warn` - è comportamento normale)
- [ ] TypeScript: `ExecutionContext` interface aggiornata con `customerIsActive: boolean`

### Test
- [ ] Unit test: `function-executor-registration-guard.spec.ts` passa
- [ ] No errori TypeScript: `npm run build`
- [ ] Tutti i test passano: `npm run test`

---

## 🔗 File Correlati

- `apps/backend/src/services/function-executor.service.ts` - Implementazione guard
- `apps/backend/src/application/chat-engine/chat-engine.service.ts` - Chiamante (passa context)
- `apps/backend/src/config/agent-functions.config.ts` - Reference function list

---

## 📋 Checklist Implementazione

- [ ] Aggiungere `customerIsActive: boolean` a `ExecutionContext` interface
- [ ] Creare array `FUNCTIONS_REQUIRING_REGISTRATION` con 10 function
- [ ] Implementare guard all'inizio del metodo `execute()`
- [ ] Return error object con `REGISTRATION_REQUIRED` e messaggio con token
- [ ] Aggiungere logging per tracciare richieste bloccate
- [ ] Aggiornare chiamate in `chat-engine.service.ts` per passare `isActive`
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Testare: `npm run test` - verificare 0 test falliti

---

**Dependencies**: Nessuna (primo task)  
**Blocks**: Task 02 (token replacement), Task 08 (nuovi test)  
**Last Updated**: 2026-01-03
