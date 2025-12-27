"use strict";
/**
 * 🔒 SECURE ERROR RESPONSES
 *
 * POLICY: Non esporre mai dettagli interni dell'API per sicurezza
 * - Log completi sul server (per debug)
 * - Messaggi generici al client (per sicurezza)
 *
 * Questo protegge da:
 * - Information disclosure attacks
 * - API structure enumeration
 * - Technology stack fingerprinting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureErrorResponses = void 0;
const logger_1 = __importDefault(require("./logger"));
class SecureErrorResponses {
    /**
     * 400 Bad Request - Richiesta malformata
     * NON esporre quali campi mancano o quali validazioni falliscono
     */
    static badRequest(res, internalMessage) {
        if (internalMessage) {
            logger_1.default.warn(`⚠️ Bad Request: ${internalMessage}`);
        }
        return res.status(400).json({
            error: "Bad Request",
        });
    }
    /**
     * 401 Unauthorized - Autenticazione fallita o mancante
     * NON esporre se è sessione/token/password/header mancante
     */
    static unauthorized(res, internalMessage) {
        if (internalMessage) {
            logger_1.default.warn(`⚠️ Unauthorized: ${internalMessage}`);
        }
        return res.status(401).json({
            error: "Unauthorized",
        });
    }
    /**
     * 403 Forbidden - Autenticato ma non autorizzato
     * NON esporre quali permessi mancano
     */
    static forbidden(res, internalMessage) {
        if (internalMessage) {
            logger_1.default.warn(`⚠️ Forbidden: ${internalMessage}`);
        }
        return res.status(403).json({
            error: "Forbidden",
        });
    }
    /**
     * 404 Not Found - Risorsa non trovata
     * OK esporre questo (è lo scopo dell'endpoint)
     */
    static notFound(res, resourceType, internalMessage) {
        if (internalMessage) {
            logger_1.default.warn(`⚠️ Not Found: ${internalMessage}`);
        }
        return res.status(404).json({
            error: "Not Found",
            message: resourceType ? `${resourceType} not found` : undefined,
        });
    }
    /**
     * 409 Conflict - Risorsa già esistente
     * OK esporre questo (è lo scopo della validazione)
     */
    static conflict(res, message) {
        logger_1.default.warn(`⚠️ Conflict: ${message}`);
        return res.status(409).json({
            error: "Conflict",
            message,
        });
    }
    /**
     * 422 Unprocessable Entity - Validazione fallita
     * OK esporre quali validazioni falliscono (utile per l'utente)
     */
    static validationError(res, errors) {
        logger_1.default.warn(`⚠️ Validation Error:`, errors);
        return res.status(422).json({
            error: "Validation Error",
            errors,
        });
    }
    /**
     * 500 Internal Server Error
     * NON esporre mai stack trace o dettagli interni
     */
    static internalError(res, error) {
        // Log completo sul server
        if (error instanceof Error) {
            logger_1.default.error(`❌ Internal Error: ${error.message}`);
            logger_1.default.error(`❌ Stack: ${error.stack}`);
        }
        else {
            logger_1.default.error(`❌ Internal Error:`, error);
        }
        // Messaggio generico al client
        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
    /**
     * 503 Service Unavailable - Servizio temporaneamente non disponibile
     */
    static serviceUnavailable(res, internalMessage) {
        if (internalMessage) {
            logger_1.default.error(`❌ Service Unavailable: ${internalMessage}`);
        }
        return res.status(503).json({
            error: "Service Unavailable",
        });
    }
}
exports.SecureErrorResponses = SecureErrorResponses;
//# sourceMappingURL=secure-error-responses.js.map