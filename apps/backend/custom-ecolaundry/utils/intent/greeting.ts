// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Body moved verbatim. hasGreetingIntent is a greeting
// boundary signal explicitly allowed under rule #6. Test in intent.test.ts.

export function hasGreetingIntent(message: string): boolean {
  const m = message.trim()
  return (
    /\b(ciao|ciao\s+come\s+stai|hello|hey|hi|hola|buongiorno|buonasera|salve|bonjour|salut|oi)\b/i.test(m) ||
    /\bol[áa](?=\s|[!?.,;]|$)/i.test(m) ||
    /\bbuen[oa]s\s+(?:d[ií]as|tardes|noches|nits)(?=\s|[!?.,;]|$)/i.test(m) ||
    /\bbom\s+dia(?=\s|[!?.,;]|$)/i.test(m) ||
    /\bboa\s+(?:tarde|noite)(?=\s|[!?.,;]|$)/i.test(m) ||
    /^buenas(?=\s|[!?.,;]|$)/i.test(m)
  )
}
