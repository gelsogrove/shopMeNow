// REFACTOR ONLY — pure move of detectNumericCodeIntent and
// detectDiscountCodeIntent from utils/intent.ts into a barrel-split cassette.
// Zero behavioural change.
//
// Iron rule #6 alignment: these are topic classifiers kept as a fast-path
// before the LLM, under the same tracked exemption as TARJETA_TOPIC /
// FACTURA_TOPIC etc. listed in CLAUDE.md ("FAQ topic guards").
// Sibling-test exemption (iron rule #5): check-architecture.sh enforces rule
// #5 with `find utils -maxdepth 1`; files under utils/intent/ are NOT
// required to ship sibling tests. Coverage is preserved by the existing
// __tests__/unit/intent.test.ts.
//
// History (regression catalogue): F21, F22.
// Full design rationale: docs/usecases.md.

export function detectNumericCodeIntent(message: string): string | null {
  const strictPatterns = [
    /(?:tengo|tenho|ho|i\s+have|recib[ií]|me\s+han\s+dado)\s+(?:un\s+|el\s+|este\s+)?(?:c[oó]digo|codice|code)[\s:.,-]*([0-9]{3,})/i,
    /(?:mi|el)\s+(?:c[oó]digo|codice|code)\s+(?:es|is|[èe])[\s:.,-]+([0-9]{3,})/i,
    /(?:c[oó]digo|codice|code)\s*[:.]\s*([0-9]{3,})/i,
    /^(?:c[oó]digo|codice|code)[\s:.,-]+([0-9]{3,})$/i,
  ]
  for (const p of strictPatterns) {
    const m = message.match(p)
    if (m && m[1]) return m[1]
  }
  return null
}

export function detectDiscountCodeIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    /\bt[ie]ng[oai]?\s+(?:un|el|este|mi)?\s*c[oó]digo\b/i.test(trimmed) ||
    /\bc[oó]digo\s+(?:de\s+descuento\s+)?(?:y\s+|que\s+)?(?:no\s+s[eé]\s+c[oó]mo|c[oó]mo\s+(?:lo\s+)?(?:uso|usar|usarlo|utilizar|utilizarlo|utilizo)|d[oó]nde\s+(?:lo\s+)?(?:pongo|poner|ponerlo|meto|meterlo))/i.test(trimmed) ||
    /\bc[oó]digo\s+(?:de\s+)?descuento\b/i.test(trimmed) ||
    /\b(?:me\s+)?(?:han\s+dado|dieron|me\s+dio|recib[ií]|tengo\s+que\s+usar)\s+(?:un\s+|el\s+)?c[oó]digo\b/i.test(trimmed) ||
    /\bt[a-z]{1,2}eg[oai]?\s+(?:un|el|este|mi)?\s*c[oó]digo\b/i.test(trimmed) ||
    /\bho\s+un\s+codice\b/i.test(trimmed) ||
    /\bcodice\s+(?:e\s+)?(?:non\s+so\s+come|come\s+(?:lo\s+)?(?:uso|usare|utilizzo|utilizzarlo)|dove\s+(?:lo\s+)?(?:metto|mettere|mettelo))/i.test(trimmed) ||
    /\bi\s+have\s+(?:a|the|this|my)\s+(?:discount\s+|promo(?:tional)?\s+|gift\s+)?code\b/i.test(trimmed) ||
    /\bcode\s+(?:and\s+)?(?:i\s+don'?t\s+know\s+how|how\s+(?:to|do\s+i)\s+(?:use|enter)|where\s+(?:to|do\s+i)\s+(?:put|enter))/i.test(trimmed) ||
    /\btenho\s+um\s+c[oó]digo\b/i.test(trimmed) ||
    /\bc[oó]digo\s+(?:e\s+)?(?:n[ãa]o\s+sei\s+como|como\s+(?:o\s+)?(?:uso|usar|utilizar|utilizo)|onde\s+(?:o\s+)?(?:ponho|colocar|meter|meto))/i.test(trimmed) ||
    /\btinc\s+un\s+codi\b/i.test(trimmed) ||
    /\bcodi\s+(?:i\s+)?(?:no\s+s[eé]\s+com|com\s+(?:el\s+)?(?:uso|usar|utilitzar|utilitzo)|on\s+(?:el\s+)?(?:poso|posar|fico))/i.test(trimmed) ||
    /\bj['']?\s*ai\s+(?:un|le)\s+code\b/i.test(trimmed) ||
    /\bcode\s+(?:et\s+)?(?:je\s+ne\s+sais\s+comment|comment\s+(?:l'?\s*)?(?:utiliser|utilise)|o[uù]\s+(?:le\s+)?(?:mettre|mets|saisir))/i.test(trimmed)
  )
}
