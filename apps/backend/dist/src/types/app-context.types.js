"use strict";
/**
 * AppContext - Unified context object for entire request lifecycle
 *
 * OBJETIVO: Eliminar query duplicate durante toda la sesión
 * - Se construye UNA SOLA VEZ en routeMessage()
 * - Se pasa a todos los sub-agents, servicios, delegations
 * - NO más loadCustomer/loadWorkspace en cada función
 *
 * BENEFICIOS:
 * - 4 queries menos por messaggio (customer, workspace, catalog x2)
 * - Dati coerenti (stesso snapshot per tutta la richiesta)
 * - Type-safe (TypeScript controlla che tutti i campi siano usati)
 * - Compatible con LangChain (RunnableConfig pattern)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppContextBuilder = void 0;
/**
 * Builder for AppContext (ensures consistency)
 */
class AppContextBuilder {
    /**
     * Build complete AppContext from raw data
     * Should be called ONCE per request in routeMessage()
     */
    static build(options) {
        return {
            workspace: options.workspace,
            customer: options.customer,
            lastOrderCode: options.lastOrderCode,
            catalog: options.catalog,
            promptVariables: options.promptVariables,
            customerData: options.customerData,
            conversationHistory: options.conversationHistory,
            sessionId: options.sessionId,
            workspaceId: options.workspaceId,
            customerId: options.customerId,
            conversationId: options.conversationId,
            messageId: options.messageId,
            requestStartTime: new Date(),
        };
    }
    /**
     * Validate that AppContext has all required fields
     */
    static validate(context) {
        return (!!context.workspace &&
            !!context.customer &&
            !!context.catalog &&
            !!context.promptVariables &&
            !!context.sessionId);
    }
}
exports.AppContextBuilder = AppContextBuilder;
//# sourceMappingURL=app-context.types.js.map