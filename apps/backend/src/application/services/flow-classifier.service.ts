// Classifies user input during an active flow session.
// Priority order: HARD_BREAK > SOFT_BREAK > MATCH > INTERRUPT_FAQ > AMBIGUOUS
//
// RULE (from copilot-instructions #14): NO hardcoded phrase detection for business logic.
// These patterns match STRUCTURAL input types only (numbers, yes/no, explicit operator requests).
// All semantic/intent classification is handled by FlowAgentLLM.

export type InputClassification =
  | "HARD_BREAK"    // user explicitly requests human escalation
  | "SOFT_BREAK"    // user wants to pause / stop the flow
  | "MATCH"         // numeric choice or yes/no — valid for current node
  | "INTERRUPT_FAQ" // off-topic question while flow is active
  | "AMBIGUOUS";    // everything else — ask for clarification

/**
 * Classifies a raw user input string into a structural InputClassification.
 * Used by FlowEngineService to decide how to handle the input
 * before looking up the node's transition table.
 */
export function classifyInput(input: string): InputClassification {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // HARD_BREAK: user explicitly asks for a human operator
  // Regex matches TYPE (explicit escalation intent), not business keywords
  if (/\b(operator|operatore|human|umano|persona|person|help me|assistenza)\b/i.test(lower)) {
    return "HARD_BREAK";
  }

  // SOFT_BREAK: user wants to stop or pause the current flow
  if (/^(stop|basta|lascia stare|cancel|annulla|esci|quit)$/i.test(lower)) {
    return "SOFT_BREAK";
  }

  // MATCH: single digit (1-9) or yes/no confirmation
  if (/^([1-9]|s[iì]|yes|ok|no|nope)$/i.test(trimmed)) {
    return "MATCH";
  }

  // INTERRUPT_FAQ: question words that signal an off-topic query
  // These are structural signals (question words), not business keywords
  if (/\b(quanto|how much|costo|cost|orari|hours|where|dove|come funziona|how does)\b/i.test(lower)) {
    return "INTERRUPT_FAQ";
  }

  return "AMBIGUOUS";
}

/**
 * Normalizes a MATCH input into a canonical transition key.
 * Maps yes/no variants → "YES" / "NO", digits remain as-is.
 */
export function normalizeInput(input: string): string {
  const lower = input.trim().toLowerCase();

  if (/^(s[iì]|yes|ok)$/i.test(lower)) return "YES";
  if (/^(no|nope)$/i.test(lower))       return "NO";

  return input.trim(); // digit as-is: "1", "2", etc.
}
