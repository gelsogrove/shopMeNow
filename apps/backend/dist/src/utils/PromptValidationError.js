"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptValidationError = void 0;
/**
 * PromptValidationError
 *
 * Custom error thrown when prompt validation fails (e.g., duplicate large variables).
 *
 * Constitution v1.5.0 Compliance:
 * - Principle III (Variable Uniqueness Constraint)
 * - Principle VIII Rule #6 (Context Variable Limit)
 *
 * @see .specify/memory/constitution.md
 */
class PromptValidationError extends Error {
    constructor(message) {
        super(message);
        this.code = "PROMPT_VALIDATION_ERROR";
        this.statusCode = 422; // Unprocessable Entity
        this.name = "PromptValidationError";
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PromptValidationError = PromptValidationError;
//# sourceMappingURL=PromptValidationError.js.map