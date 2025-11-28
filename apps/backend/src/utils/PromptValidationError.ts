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
export class PromptValidationError extends Error {
  public readonly code: string = "PROMPT_VALIDATION_ERROR"
  public readonly statusCode: number = 422 // Unprocessable Entity

  constructor(message: string) {
    super(message)
    this.name = "PromptValidationError"
    Error.captureStackTrace(this, this.constructor)
  }
}
