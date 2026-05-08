// Display-state signals extracted from free-text customer replies.
//
// These detectors are boundary signals (rule #6 — phrase detection allowed
// for boundary signals only). They classify a customer message as one of:
//   - extra-button issue (only triggers when "extra" is explicitly named)
//   - stop intent (customer pressed STOP, multilingual)
//   - blank display reply (whole-message or inline mention of empty screen)

export function hasExtraButtonIssue(message: string): boolean {
  // RULE: Only trigger when "extra" is explicitly mentioned.
  // Generic button words alone (pulsante, pulsador, button, botton, bouton) are not enough:
  // they appear in LLM-extracted issueSummary whenever the user presses ANY button (e.g. "l'ho schiacchiato"
  // → issueSummary = "user pressed the button/pulsante"). That caused false-positive routing to case_extra_button.
  // The EXTRA button is a specific machine option — only trigger when "extra" itself is present.
  return /\bextra\b/i.test(message)
}

export function hasStopIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return /\b(stop|stop button|pressed stop|i pressed stop|bot[oó]n stop|he pulsado stop|pulsante stop|tasto stop|ho premuto stop|premuto stop|bot[oó] stop|he premut stop|pulsat stop|j'ai appuy[eé] sur stop|presse stop)\b/i.test(lower)
}

export function isBlankDisplayReply(message: string): boolean {
  const lower = message.toLowerCase().trim()
  // Whole-message match (customer answered just "blanco", "vuoto", etc.)
  if (/^(blank|empty|nothing|blank screen|screen is blank|empty screen|no display|nada|pantalla en blanco|pantalla blanca|pantalla en blanc|pantalla buida|void|vide|ecran vide|buit|nulla|schermo vuoto|schermo in bianco|schermo bianco|display vuoto)$/i.test(lower)) return true
  // Inline mention inside a longer sentence — covers "ahora la pantalla es blanca"
  // / "lo schermo è bianco" / "the screen is blank".
  if (/\b(pantalla\s+(?:es\s+)?blanc[ao]|pantalla\s+en\s+blanco|schermo\s+bianco|schermo\s+vuoto|screen\s+(?:is\s+)?(?:blank|empty)|no\s+(?:hay\s+)?nada\s+en\s+(?:la\s+)?pantalla)\b/i.test(lower)) return true
  return false
}
